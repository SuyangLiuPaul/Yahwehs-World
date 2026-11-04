// Performance budgets as a check that fails.
//
//   node tools/perf/budget.mjs                                    # against the dev site
//   node tools/perf/budget.mjs --base http://localhost:4173        # against a local `vite preview`
//   node tools/perf/budget.mjs --only assets                       # the no-browser half, for a fast CI gate
//   node tools/perf/budget.mjs --json out.json                     # the numbers, for a trend line
//
// It measures the same way tools/perf/measure.mjs does (the same probe, the same device class, the same throttle)
// and compares each number with tools/perf/budgets.json. Exit code 1 means a budget is over; the line says by how
// much, so a regression names itself. Nothing here writes to the site or to src/.
//
// WHY A SCRIPT AND NOT A LIGHTHOUSE RUN: the three things that actually hurt this product — the frames through
// 1,443 cards, the DOM a 176-verse chapter builds, and the latency of a language switch — are none of them in a
// Lighthouse report. This runs them.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { INIT_SCRIPT, frameStats, tbt } from './lib/probe.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

const BASE = arg('base', 'https://yahwehsworld-dev.netlify.app').replace(/\/$/, '');
const ONLY = (arg('only', 'assets,routes,scroll,interactions')).split(',');
const JSON_OUT = arg('json', '');
const B = JSON.parse(await readFile(arg('budgets', join(HERE, 'budgets.json')), 'utf8'));

const PROFILE = { width: 390, height: 844, dpr: 3, cpu: 4 };
const NET_FAST4G = { offline: false, downloadThroughput: (9000 * 1024) / 8, uploadThroughput: (1500 * 1024) / 8, latency: 40 };
const ROUTES = {
  home: '/', scenes: '/scenes.html', scene: '/scenes.html#p=genesis-1-1',
  gen1: '/bible.html#ref=Genesis%201', ps119: '/bible.html#ref=Psalm%20119',
  parallel: '/bible.html#ref=Psalm%20119&par=bsb-yhwh,cuvs-yhwh&m=parallel',
};
const SETTLE = {
  home: 'main, .hero, .gx-plate', scenes: '.sc-card', scene: '#pc-plate img',
  gen1: '.yr-v, .yr-p', ps119: '.yr-v, .yr-p', parallel: '.yr-pv, .yr-v',
};

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KB = (n) => n / 1024;

/** One budget line. `over` decides pass/fail; a missing measurement is a failure, not a pass. */
function check(group, subject, metric, got, limit, unit = '') {
  const ok = typeof got === 'number' && Number.isFinite(got) && got <= limit;
  results.push({ group, subject, metric, got, limit, unit, ok, missing: typeof got !== 'number' || !Number.isFinite(got) });
  return ok;
}

// ── assets: no browser, so this half is a cheap gate on its own ──────────────────────────────────────────────────
async function suiteAssets() {
  // BYTES ON THE WIRE, not bytes after decoding. Node's fetch transparently gunzips, so `arrayBuffer().byteLength`
  // of /data/gallery/index.json is 193 KiB where the browser transfers 67 KiB — a budget set on the wrong one of
  // those two would be wrong by 3x. `content-length` survives the decode and is the compressed length.
  const head = async (path) => {
    const r = await fetch(BASE + path, { headers: { 'accept-encoding': 'br, gzip' } });
    if (!r.ok) return null;
    const len = Number(r.headers.get('content-length'));
    const buf = await r.arrayBuffer();
    return Number.isFinite(len) && len > 0 ? len : buf.byteLength;
  };
  const fontsCss = await fetch(`${BASE}/fonts/fonts.css`).then((r) => (r.ok ? r.text() : '')).catch(() => '');
  const urls = [...fontsCss.matchAll(/url\('([^']+\.woff2)'\)/g)].map((m) => m[1]);
  let worst = 0, worstName = '';
  const cjk = [];
  for (const u of urls) {
    const n = await head(u);
    if (n == null) continue;
    if (n > worst) { worst = n; worstName = u; }
    if (/cjk/i.test(u)) cjk.push([u, n]);
  }
  check('assets', worstName || 'fonts', 'largest font file KB', +KB(worst).toFixed(0), B.assets.maxFontFileKB, 'KB');
  // what ONE Chinese page actually needs: the sans and the serif of its own script
  const forScript = (tag) => cjk.filter(([u]) => u.includes(tag)).reduce((s, [, n]) => s + n, 0);
  for (const tag of ['sc', 'tc']) {
    check('assets', `cjk-${tag}`, 'CJK fonts per page KB', +KB(forScript(tag)).toFixed(0), B.assets.maxCjkFontsPerPageKB, 'KB');
  }
  check('assets', '/data/gallery/index.json', 'compressed KB', +KB(await head('/data/gallery/index.json') ?? NaN).toFixed(0), B.assets.galleryIndexKB, 'KB');
  // Psalms is the longest book file the reader ever fetches in one go
  check('assets', '/data/reader/text/bsb-yhwh/19.json', 'compressed KB', +KB(await head('/data/reader/text/bsb-yhwh/19.json') ?? NaN).toFixed(0), B.assets.longestChapterJsonKB, 'KB');
}

// ── the browser half ────────────────────────────────────────────────────────────────────────────────────────────
async function withPage(browser, fn, { net = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: PROFILE.width, height: PROFILE.height }, deviceScaleFactor: PROFILE.dpr,
    isMobile: true, hasTouch: true, locale: 'en-US', serviceWorkers: 'allow',
  });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: PROFILE.cpu });
  if (net) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', NET_FAST4G); }
  try { return await fn(page, ctx); } finally { await ctx.close(); }
}

async function settle(page, route) {
  await page.waitForSelector(SETTLE[route] ?? 'body', { timeout: 45000 }).catch(() => {});
  await page.waitForFunction('!document.getElementById("loading") || document.getElementById("loading").classList.contains("done")', null, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await sleep(600);
}

async function measureLoad(page, route) {
  await page.goto(BASE + ROUTES[route], { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
  await settle(page, route);
  const p = await page.evaluate('({lcp:__perf.lcp,cls:__perf.cls,longTasks:__perf.longTasks,res:__perf.resources()})');
  return {
    lcp: Math.round(p.lcp), cls: +p.cls.toFixed(4), tbt: tbt(p.longTasks),
    bytesKB: +KB(p.res.reduce((s, r) => s + (r.transfer || r.encoded || 0), 0)).toFixed(0),
    requests: p.res.length,
  };
}

async function suiteRoutes(browser) {
  for (const route of Object.keys(B.routes)) {
    const b = B.routes[route];
    await withPage(browser, async (page, ctx) => {
      const cold = await measureLoad(page, route);
      await sleep(1200);                      // the worker registers on idle
      const page2 = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page2);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: PROFILE.cpu });
      await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', NET_FAST4G);
      const warm = await measureLoad(page2, route);
      check('routes', route, 'LCP cold', cold.lcp, b.lcpCold, 'ms');
      check('routes', route, 'LCP warm', warm.lcp, b.lcpWarm, 'ms');
      check('routes', route, 'TBT cold', cold.tbt, b.tbt, 'ms');
      check('routes', route, 'CLS cold', cold.cls, b.cls, '');
      check('routes', route, 'bytes cold', cold.bytesKB, b.bytesKB, 'KB');
      check('routes', route, 'requests cold', cold.requests, b.requests, '');
    });
  }
}

async function suiteScroll(browser) {
  for (const [id, b] of Object.entries(B.scroll)) {
    await withPage(browser, async (page) => {
      const path = id.startsWith('gallery') ? '/scenes.html' : ROUTES.ps119;
      await page.goto(BASE + path, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
      await page.waitForSelector(id.startsWith('gallery') ? '.sc-card' : '.yr-v, .yr-p', { timeout: 45000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      if (id === 'gallery-1443') {
        await page.evaluate(`(async () => { const b = document.getElementById('sc-more-btn'); for (let i=0;i<40 && b && !b.hidden;i++) { b.click(); await new Promise(r=>setTimeout(r,80)); } })()`);
        await sleep(1500);
      }
      await page.evaluate('__perf.reset()');
      const [deltas] = await Promise.all([page.evaluate('__perf.frames(12000)'), page.evaluate('__perf.fling(40000, 80)')]);
      const f = frameStats(deltas);
      const dom = await page.evaluate('__perf.dom()');
      // dropped (>33.3 ms) and not over16: at 60 Hz half of a perfectly smooth run measures a hair over 16.7
      check('scroll', id, '% frames dropped', f.pctDropped, b.pctDropped, '%');
      check('scroll', id, '% frames > 20 ms', f.pctOver20, b.pctOver20, '%');
      check('scroll', id, 'p99 frame', f.p99, b.p99, 'ms');
      check('scroll', id, 'worst frame', f.worst, b.worst, 'ms');
      check('scroll', id, 'DOM nodes after', dom.nodes, b.nodesAfter, '');
    }, { net: false });
  }
}

const ACTS = {
  'lang-menu-open': { route: 'scenes', act: (p) => p.click('.lang-btn'), then: '.lang-pop:not([hidden])' },
  'lang-switch-hant': { route: 'scenes', act: async (p) => { await p.click('.lang-btn'); await p.click('[data-locale="zh-Hant"]'); }, then: 'html[lang="zh-Hant"]' },
  'search-open': { route: 'scenes', act: (p) => p.keyboard.press('Control+k'), then: 'dialog.gx-pal[open] input' },
  'search-type': { route: 'scenes', pre: async (p) => { await p.keyboard.press('Control+k'); await p.waitForSelector('dialog.gx-pal[open] input'); await sleep(900); }, act: (p) => p.type('dialog.gx-pal input', 'damascus', { delay: 90 }), then: '.gx-pal-row, .gx-pal-hint:not([hidden])' },
  'verse-select': { route: 'ps119', act: (p) => p.click('.yr-vn'), then: '.is-sel' },
  'chapter-next': { route: 'ps119', act: (p) => p.click('[data-act="next"]'), then: '.yr-body .yr-v, .yr-body .yr-p' },
  'scene-next': { route: 'scene', act: (p) => p.click('#pc-next'), then: '#pc-plate img' },
};

async function suiteInteractions(browser) {
  for (const [id, b] of Object.entries(B.interactions)) {
    const c = ACTS[id];
    if (!c) { results.push({ group: 'interactions', subject: id, metric: 'defined', ok: false, missing: true, got: null, limit: null, unit: '' }); continue; }
    await withPage(browser, async (page) => {
      await page.goto(BASE + ROUTES[c.route], { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
      await page.waitForSelector(SETTLE[c.route], { timeout: 45000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await sleep(800);
      if (c.pre) await c.pre(page);
      await page.evaluate('__perf.reset()');
      const t0 = Date.now();
      await c.act(page);
      let visible = null;
      try { await page.waitForSelector(c.then, { timeout: 12000 }); visible = Date.now() - t0; } catch { /* missing */ }
      await sleep(400);
      const tasks = await page.evaluate('__perf.longTasks.map(t => t.d)');
      check('interactions', id, 'to visible', visible, b.visibleMs, 'ms');
      check('interactions', id, 'worst long task', Math.max(0, ...tasks), b.worstTask, 'ms');
    }, { net: false });
  }
}

// ── report ──────────────────────────────────────────────────────────────────────────────────────────────────────
const SUITES = { assets: suiteAssets, routes: suiteRoutes, scroll: suiteScroll, interactions: suiteInteractions };

let browser = null;
for (const name of ONLY) {
  const fn = SUITES[name];
  if (!fn) { console.error(`no budget group "${name}"`); process.exitCode = 2; continue; }
  if (name !== 'assets' && !browser) browser = await chromium.launch();
  await (name === 'assets' ? fn() : fn(browser));
}
if (browser) await browser.close();

const failed = results.filter((r) => !r.ok);
const w = (s, n) => String(s).padEnd(n);
console.log(`\nperformance budgets · ${BASE} · ${B.profile}\n`);
console.log(`${w('', 6)}${w('group', 14)}${w('subject', 42)}${w('metric', 24)}${w('measured', 12)}budget`);
for (const r of results) {
  console.log(`${w(r.ok ? ' ok ' : 'FAIL', 6)}${w(r.group, 14)}${w(r.subject, 42)}${w(r.metric, 24)}${w(r.missing ? 'MISSING' : `${r.got}${r.unit}`, 12)}${r.limit}${r.unit}`);
}
console.log(`\n${results.length - failed.length}/${results.length} within budget`);
if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
if (failed.length) {
  console.error(`\n${failed.length} over budget:`);
  for (const r of failed) console.error(`  ${r.group}/${r.subject}: ${r.metric} ${r.missing ? 'not measured' : `${r.got}${r.unit} > ${r.limit}${r.unit}`}`);
  process.exit(1);
}
process.exit(0);
