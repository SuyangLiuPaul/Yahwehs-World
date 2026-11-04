// The performance harness for the gallery surface: it measures, it changes nothing.
//
//   node tools/perf/measure.mjs --base https://yahwehsworld-dev.netlify.app --out docs/review/perf-2026-11-04
//   node tools/perf/measure.mjs --suite load --engine chromium --profile phone4x
//   node tools/perf/measure.mjs --suite interact --engine webkit        (WebKit: no throttling, fewer metrics)
//
// WHAT IT PRODUCES
//   <out>/load.json       per route × device class × cache state: LCP, CLS, TBT, long tasks with attribution, bytes
//   <out>/scroll.json     frame deltas through the 1,443-card gallery and through Psalm 119
//   <out>/interact.json   latency of the twelve interactions the owner named
//   <out>/memory.json     heap after 200 plates and after 20 chapter changes
//   <out>/decode.json     thumb vs full picture decode cost
//   <out>/summary.md      the same numbers as tables, to paste into the report
//
// DEVICE CLASSES. A CPU throttle is the only honest way to stand in for a phone from a Mac, and only Chromium
// has one (CDP Emulation.setCPUThrottlingRate). 1x is this Mac; 4x approximates a mid-range phone and 6x a
// low-end Android, which is how Lighthouse's own mobile preset is calibrated. WebKit runs unthrottled and is
// there for the ENGINE difference (iOS and macOS shells are WKWebView), not for the device difference — every
// WebKit row is labelled so no one reads it as an iPhone number.
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INIT_SCRIPT, frameStats, tbt, inpOf, bytesByKind, kindOf } from './lib/probe.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);

const BASE = (arg('base', 'https://yahwehsworld-dev.netlify.app')).replace(/\/$/, '');
const OUT = arg('out', '');
const SUITES = (arg('suite', 'all')).split(',');
const ENGINES = (arg('engine', 'chromium,webkit')).split(',');
const ONLY_PROFILE = arg('profile', '');
const REPEATS = Number(arg('repeats', '1'));

// ── routes ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A scene id and the two chapters are fixed so every run compares with every other. Psalm 119 is the long one
// (176 verses) and Genesis 1 is the one with the most plates per screen.
const SCENE = 'genesis-1-1';
const ROUTES = {
  home: '/',
  scenes: '/scenes.html',
  scene: `/scenes.html#p=${SCENE}`,
  gen1: '/bible.html#ref=Genesis%201',
  ps119: '/bible.html#ref=Psalm%20119',
  parallel: '/bible.html#ref=Psalm%20119&par=bsb-yhwh,cuvs-yhwh&m=parallel',
};

// ── device classes ──────────────────────────────────────────────────────────────────────────────────────────────
const PROFILES = [
  { id: 'desktop1x', label: 'desktop (1x CPU)', cpu: 1, width: 1440, height: 900, dpr: 2, mobile: false },
  { id: 'phone4x', label: 'mid phone (4x CPU)', cpu: 4, width: 390, height: 844, dpr: 3, mobile: true },
  { id: 'phone6x', label: 'low-end Android (6x CPU)', cpu: 6, width: 390, height: 844, dpr: 2.625, mobile: true },
  { id: 'ipad1x', label: 'iPad (1x CPU)', cpu: 1, width: 1024, height: 1366, dpr: 2, mobile: true },
];
// Lighthouse's "fast 4G": 9 Mbit down, 1.5 up, 40 ms RTT, applied with the standard 0.9 throughput fudge.
const NET_FAST4G = { offline: false, downloadThroughput: (9000 * 1024) / 8, uploadThroughput: (1500 * 1024) / 8, latency: 40 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function launch(engine) {
  const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ args: ['--enable-features=LongAnimationFrameTiming'] });
  return browser;
}

/** A fresh context (cold cache, no service worker) at one device class, with the probe installed. */
async function freshContext(browser, profile) {
  const ctx = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    isMobile: profile.mobile && browser.browserType().name() === 'chromium',
    hasTouch: profile.mobile,
    locale: 'en-US',
    serviceWorkers: 'allow',
  });
  await ctx.addInitScript(INIT_SCRIPT);
  // A selector that is wrong must cost seconds, not half a minute: a missed case is reported, never waited out.
  ctx.setDefaultTimeout(12000);
  return ctx;
}

/** CPU and network throttling. Chromium only; a WebKit page is returned unthrottled and says so. */
async function throttle(page, profile, { net = true } = {}) {
  if (page.context().browser().browserType().name() !== 'chromium') return { cpu: 1, net: false, note: 'WebKit: no CDP throttling' };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  if (net) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', NET_FAST4G); }
  return { cpu: profile.cpu, net, cdp };
}

const read = (page, expr) => page.evaluate(expr);

/** Everything the probe holds, after a load has settled. */
async function harvest(page, { until } = {}) {
  const [nav, res, dom, heap, yr, p] = await Promise.all([
    read(page, '__perf.nav()'), read(page, '__perf.resources()'), read(page, '__perf.dom()'),
    read(page, '__perf.heap()'),
    // the reader module times its own render and leaves the number on the page (src/reader/view.ts renderAll)
    read(page, 'window.__yrPerf ?? null'),
    read(page, '({lcp:__perf.lcp,lcpEl:__perf.lcpEl,lcpUrl:__perf.lcpUrl,cls:__perf.cls,shifts:__perf.shifts,longTasks:__perf.longTasks,loafs:__perf.loafs,events:__perf.events,fonts:__perf.fonts,fontsReady:__perf.fontsReady,errors:__perf.errors,support:__perf.support})'),
  ]);
  const bytes = bytesByKind(res);
  const total = res.reduce((s, r) => s + (r.transfer || r.encoded || 0), 0);
  return {
    nav, dom, heap, yrPerf: yr,
    lcp: Math.round(p.lcp), lcpEl: p.lcpEl, lcpUrl: p.lcpUrl,
    cls: +p.cls.toFixed(4), shifts: p.shifts,
    tbt: tbt(p.longTasks, until ?? Infinity),
    longTasks: p.longTasks.length,
    longTasksMs: p.longTasks.reduce((s, t) => s + t.d, 0),
    worstTasks: [...p.longTasks].sort((a, b) => b.d - a.d).slice(0, 6),
    loafs: [...p.loafs].sort((a, b) => b.d - a.d).slice(0, 8),
    fonts: p.fonts, fontsReady: p.fontsReady ?? null,
    requests: res.length, bytesTotal: total, bytes,
    biggest: [...res].sort((a, b) => (b.transfer || b.encoded) - (a.transfer || a.encoded)).slice(0, 12)
      .map((r) => ({ url: r.url.replace(BASE, ''), kind: kindOf(r), bytes: r.transfer || r.encoded, dur: r.dur })),
    errors: p.errors, support: p.support,
  };
}

/** Wait until the route has actually painted its content, not merely fired load. */
async function settle(page, route) {
  const done = {
    home: '.gx-plate img, .hero, main',
    scenes: '.sc-card',
    scene: '#pc-plate img',
    gen1: '.yr-v, .yr-p',
    ps119: '.yr-v, .yr-p',
    parallel: '.yr-pv, .yr-v',
  }[route] ?? 'body';
  try { await page.waitForSelector(done, { timeout: 45000 }); } catch { /* recorded as a miss, not a crash */ }
  // the loading screen hides itself when the page says it is standing
  try { await page.waitForFunction('!document.getElementById("loading") || document.getElementById("loading").classList.contains("done")', null, { timeout: 15000 }); } catch { /* ditto */ }
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await sleep(600); // let a late layout shift and a late long task be seen
}

// ── suite: load ─────────────────────────────────────────────────────────────────────────────────────────────────
async function suiteLoad(browser, profile, rows) {
  const engine = browser.browserType().name();
  for (const [route, path] of Object.entries(ROUTES)) {
    for (let rep = 0; rep < REPEATS; rep++) {
      // COLD: new context, nothing stored, no worker.
      const ctx = await freshContext(browser, profile);
      const page = await ctx.newPage();
      const th = await throttle(page, profile);
      const t0 = Date.now();
      await page.goto(BASE + path, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
      await settle(page, route);
      const cold = await harvest(page);
      cold.wallMs = Date.now() - t0;

      // WARM: the same context, so the HTTP cache AND the service worker it just installed are in play.
      await sleep(1200); // the worker registers on idle (chrome.ts: requestIdleCallback, 4 s timeout)
      const swState = await page.evaluate(`navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.map(x => ({scope:x.scope, active: !!x.active, waiting: !!x.waiting}))) : []`).catch(() => []);
      const page2 = await ctx.newPage();
      await throttle(page2, profile);
      const t1 = Date.now();
      await page2.goto(BASE + path, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
      await settle(page2, route);
      const warm = await harvest(page2);
      warm.wallMs = Date.now() - t1;

      rows.push({ engine, profile: profile.id, route, rep, throttle: th.cpu, net: th.net ? 'fast4G' : 'none', sw: swState, cold, warm });
      log(`  ${engine}/${profile.id}/${route}  cold LCP ${cold.lcp}ms TBT ${cold.tbt}ms CLS ${cold.cls} ${(cold.bytesTotal / 1024).toFixed(0)}KB · warm LCP ${warm.lcp}ms TBT ${warm.tbt}ms`);
      await ctx.close();
    }
  }
}

// ── suite: scroll ───────────────────────────────────────────────────────────────────────────────────────────────
// A fling driven from inside the page (scrollBy every frame) with rAF deltas recorded at the same time: the frames
// are the page's own, so a janky one is a frame a reader's thumb would have felt.
async function suiteScroll(browser, profile, rows) {
  const engine = browser.browserType().name();
  const cases = [
    { id: 'gallery-1443', path: '/scenes.html', wait: '.sc-card', px: 60000, perFrame: 90, ms: 20000, pre: async (page) => {
      // Fill the grid the way the IntersectionObserver does: press "show more" until all 1,443 cards are in the DOM.
      await page.evaluate(`(async () => {
        const btn = document.getElementById('sc-more-btn');
        for (let i = 0; i < 40 && btn && !btn.hidden; i++) { btn.click(); await new Promise(r => setTimeout(r, 120)); }
      })()`);
      await sleep(1500);
    } },
    { id: 'gallery-progressive', path: '/scenes.html', wait: '.sc-card', px: 40000, perFrame: 60, ms: 16000 },
    { id: 'ps119', path: '/bible.html#ref=Psalm%20119', wait: '.yr-v, .yr-p', px: 30000, perFrame: 60, ms: 14000 },
    { id: 'ps119-parallel', path: '/bible.html#ref=Psalm%20119&par=bsb-yhwh,cuvs-yhwh&m=parallel', wait: '.yr-pv, .yr-v', px: 30000, perFrame: 60, ms: 14000 },
  ];
  for (const c of cases) {
    const ctx = await freshContext(browser, profile);
    const page = await ctx.newPage();
    await throttle(page, profile, { net: false }); // a fling is a CPU/compositor test; the network would only add noise
    await page.goto(BASE + c.path, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
    await page.waitForSelector(c.wait, { timeout: 45000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    if (c.pre) await c.pre(page);
    const before = await read(page, '__perf.dom()');
    const heapBefore = await read(page, '__perf.heap()');
    await read(page, '__perf.reset()');
    const [deltas, flung] = await Promise.all([
      page.evaluate(`__perf.frames(${c.ms})`),
      page.evaluate(`__perf.fling(${c.px}, ${c.perFrame})`),
    ]);
    const after = await read(page, '__perf.dom()');
    const heapAfter = await read(page, '__perf.heap()');
    const p = await read(page, '({longTasks:__perf.longTasks,loafs:__perf.loafs})');
    rows.push({
      engine, profile: profile.id, case: c.id, throttle: profile.cpu,
      frames: frameStats(deltas), flung, before, after, heapBefore, heapAfter,
      longTasks: p.longTasks.length, worstTasks: [...p.longTasks].sort((a, b) => b.d - a.d).slice(0, 5),
      loafs: [...p.loafs].sort((a, b) => b.d - a.d).slice(0, 6),
    });
    const f = frameStats(deltas);
    log(`  ${engine}/${profile.id}/${c.id}  ${f.frames} frames, ${f.pctOver16}% over 16.7ms, p95 ${f.p95}ms, worst ${f.worst}ms, nodes ${before.nodes}→${after.nodes}`);
    await ctx.close();
  }
}

// ── suite: interact ─────────────────────────────────────────────────────────────────────────────────────────────
// Each case: open the route, settle, then one real input. Latency is measured two ways — the wall time from the
// input to the DOM condition that means "the reader can see it", and the event-timing duration the browser itself
// reports (which is what INP is built from).
async function suiteInteract(browser, profile, rows) {
  const engine = browser.browserType().name();
  const cases = [
    { id: 'lang-menu-open', path: '/scenes.html', wait: '.sc-card',
      act: async (p) => p.click('.lang-btn'), then: '.lang-pop:not([hidden])' },
    { id: 'lang-switch-hant', path: '/scenes.html', wait: '.sc-card',
      act: async (p) => { await p.click('.lang-btn'); await p.click('[data-locale="zh-Hant"]'); }, then: 'html[lang="zh-Hant"]' },
    { id: 'surface-paper', path: '/bible.html#ref=Genesis%201', wait: '.yr-v, .yr-p',
      act: async (p) => { await p.click('[data-act="display"]'); await p.waitForSelector('dialog[open]'); await p.click('dialog[open] [data-act="theme"][data-id="paper"]'); }, then: 'html[data-surf="paper"]', optional: true },
    { id: 'search-open', path: '/scenes.html', wait: '.sc-card',
      act: async (p) => p.keyboard.press('Control+k'), then: 'dialog.gx-pal[open] input' },
    { id: 'search-type', path: '/scenes.html', wait: '.sc-card',
      pre: async (p) => { await p.keyboard.press('Control+k'); await p.waitForSelector('dialog.gx-pal[open] input'); await sleep(900); },
      act: async (p) => p.type('dialog.gx-pal input', 'damascus', { delay: 90 }), then: '.gx-pal-row, .gx-pal-hint:not([hidden])' },
    { id: 'feedback-sheet', path: `/scenes.html#p=${SCENE}`, wait: '#pc-plate img',
      act: async (p) => p.click('#pc-feedback'), then: 'dialog.gx-fb[open]' },
    { id: 'verse-select', path: '/bible.html#ref=Psalm%20119', wait: '.yr-v, .yr-p',
      act: async (p) => p.click('.yr-vn'), then: '.yr-selbar:not([hidden]), .is-sel' },
    { id: 'verse-copy', path: '/bible.html#ref=Psalm%20119', wait: '.yr-v, .yr-p',
      pre: async (p) => { await p.click('.yr-vn'); await sleep(400); },
      act: async (p) => p.click('[data-act="copySel"]'), then: '.yr-toast', optional: true },
    // Turning parallel on is the expensive half: the layout changes AND a second book file is fetched and rendered.
    { id: 'parallel-on', path: '/bible.html#ref=Psalm%20119', wait: '.yr-v, .yr-p',
      act: async (p) => p.click('[data-act="mode"][data-id="parallel"]'), then: '.yr-pv' },
    // Adding a THIRD edition from the compare sheet: the reader's own "add an edition" path.
    { id: 'parallel-add', path: '/bible.html#ref=Psalm%20119&par=bsb-yhwh,cuvs-yhwh&m=parallel', wait: '.yr-pv',
      // In parallel mode the edition pill opens the COMPARE sheet directly (view.ts:629), not the single-edition one.
      pre: async (p) => { await p.click('[data-act="edition"]'); await p.waitForSelector('dialog[open] [data-act="toggle"]'); await sleep(400); },
      act: async (p) => p.click('dialog[open] [data-act="toggle"][data-id="kjv"]'), then: '.yr-pl .yr-line[data-ed="kjv"]' },
    { id: 'parallel-off', path: '/bible.html#ref=Psalm%20119&par=bsb-yhwh,cuvs-yhwh&m=parallel', wait: '.yr-pv',
      act: async (p) => p.click('[data-act="mode"][data-id="verse"]'), then: '.yr-body .yr-v' },
    { id: 'chapter-next', path: '/bible.html#ref=Psalm%20119', wait: '.yr-v, .yr-p',
      act: async (p) => p.click('[data-act="next"]'), then: '.yr-body .yr-v, .yr-body .yr-p', optional: true },
    { id: 'text-size-up', path: '/bible.html#ref=Psalm%20119', wait: '.yr-v, .yr-p',
      pre: async (p) => { await p.click('[data-act="display"]'); await p.waitForSelector('dialog[open] [data-act="size"]'); await sleep(300); },
      act: async (p) => p.click('dialog[open] [data-act="size"]:last-of-type'), then: '.yr-body', optional: true },
    { id: 'scene-next', path: `/scenes.html#p=${SCENE}`, wait: '#pc-plate img',
      act: async (p) => p.click('#pc-next'), then: '#pc-plate img' },
    { id: 'back-nav', path: `/scenes.html#p=${SCENE}`, wait: '#pc-plate img',
      act: async (p) => p.goBack(), then: '.sc-card', optional: true },
  ];
  for (const c of cases) {
    const ctx = await freshContext(browser, profile);
    const page = await ctx.newPage();
    await throttle(page, profile, { net: false });
    let row = { engine, profile: profile.id, case: c.id, throttle: profile.cpu };
    try {
      await page.goto(BASE + c.path, { waitUntil: 'commit', timeout: 60000 });
      await page.waitForSelector(c.wait, { timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await sleep(800);
      if (c.pre) await c.pre(page);
      await read(page, '__perf.reset()');
      const heapBefore = await read(page, '__perf.heap()');
      const t0 = Date.now();
      await c.act(page);
      let visible = null;
      try { await page.waitForSelector(c.then, { timeout: 12000 }); visible = Date.now() - t0; } catch { visible = null; }
      await sleep(500);
      const p = await read(page, '({events:__perf.events,longTasks:__perf.longTasks,loafs:__perf.loafs,cls:__perf.cls,shifts:__perf.shifts})');
      const heapAfter = await read(page, '__perf.heap()');
      const yrPerf = await read(page, 'window.__yrPerf ?? null');
      row = { ...row, visibleMs: visible, yrPerf, ...inpOf(p.events),
        eventMax: Math.max(0, ...p.events.map((e) => e.d)),
        longTasks: p.longTasks.length, worstTask: Math.max(0, ...p.longTasks.map((t) => t.d)),
        tasks: [...p.longTasks].sort((a, b) => b.d - a.d).slice(0, 4),
        loafs: [...p.loafs].sort((a, b) => b.d - a.d).slice(0, 4),
        cls: +p.cls.toFixed(4), shifts: p.shifts.slice(0, 4),
        heapBefore, heapAfter };
      log(`  ${engine}/${profile.id}/${c.id}  visible ${visible ?? 'MISS'}ms, worst event ${row.eventMax}ms, worst task ${row.worstTask}ms`);
    } catch (e) {
      row.error = String(e).split('\n')[0];
      log(`  ${engine}/${profile.id}/${c.id}  ${c.optional ? 'skipped' : 'FAILED'}: ${row.error}`);
    }
    rows.push(row);
    await ctx.close();
  }
}

// ── suite: memory ───────────────────────────────────────────────────────────────────────────────────────────────
// Two growth questions the owner asked: 200 plates scrolled, and 20 chapter changes. Chromium only
// (performance.memory); WebKit gives no heap number from inside the page.
async function suiteMemory(browser, profile, rows) {
  const engine = browser.browserType().name();
  if (engine !== 'chromium') { rows.push({ engine, profile: profile.id, note: 'no heap API in WebKit' }); return; }
  // performance.memory is USELESS here: Chrome quantises usedJSHeapSize into coarse buckets unless the browser was
  // started with --enable-precise-memory-info, so every sample of a growing page comes back the same number (the
  // first run of this suite reported 9.5 MB for 538 nodes and for 7,453). CDP answers honestly:
  //   Runtime.getHeapUsage        real bytes used / total
  //   Performance.getMetrics      Nodes, JSEventListeners, LayoutCount, RecalcStyleCount, LayoutDuration
  // The last two are what say whether a fix moved layout work, not merely bytes.
  const probeOf = async (page) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Runtime.enable').catch(() => {});
    await cdp.send('Performance.enable').catch(() => {});
    return async (label) => {
      const heap = await cdp.send('Runtime.getHeapUsage').catch(() => ({}));
      const met = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }));
      const m = Object.fromEntries((met.metrics ?? []).map((x) => [x.name, x.value]));
      const dom = await read(page, '__perf.dom()');
      return {
        label, used: heap.usedSize ?? 0, total: heap.totalSize ?? 0,
        nodes: dom.nodes, imgs: dom.imgs, scrollH: dom.scrollH,
        cdpNodes: m.Nodes, listeners: m.JSEventListeners, layouts: m.LayoutCount,
        recalcs: m.RecalcStyleCount, layoutMs: m.LayoutDuration != null ? +(m.LayoutDuration * 1000).toFixed(1) : undefined,
        styleMs: m.RecalcStyleDuration != null ? +(m.RecalcStyleDuration * 1000).toFixed(1) : undefined,
      };
    };
  };
  // 200 plates
  {
    const ctx = await freshContext(browser, profile);
    const page = await ctx.newPage();
    await throttle(page, profile, { net: false });
    await page.goto(`${BASE}/scenes.html`, { waitUntil: 'commit' });
    await page.waitForSelector('.sc-card', { timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    const samples = [];
    const snap = await probeOf(page);
    const sample = async (label) => samples.push(await snap(label));
    await sample('start');
    for (let i = 0; i < 4; i++) {
      await page.evaluate(`(async () => { const b = document.getElementById('sc-more-btn'); for (let i=0;i<1 && b && !b.hidden;i++) { b.click(); } })()`);
      await page.evaluate('__perf.fling(12000, 80)');
      await sleep(900);
      await sample(`+${(i + 1) * 60} cards`);
    }
    // all 1,443, then a full sweep
    await page.evaluate(`(async () => { const b = document.getElementById('sc-more-btn'); for (let i=0;i<40 && b && !b.hidden;i++) { b.click(); await new Promise(r=>setTimeout(r,80)); } })()`);
    await sleep(2000);
    await sample('all cards in DOM');
    await page.evaluate('__perf.fling(200000, 160)');
    await sleep(2500);
    await sample('after full sweep');
    rows.push({ engine, profile: profile.id, case: 'gallery-plates', samples });
    log(`  ${engine}/${profile.id}/gallery-plates  ${samples.map((s) => `${s.label}: ${(s.used / 1048576).toFixed(1)}MB/${s.nodes}n`).join(' · ')}`);
    await ctx.close();
  }
  // 20 chapter changes
  {
    const ctx = await freshContext(browser, profile);
    const page = await ctx.newPage();
    await throttle(page, profile, { net: false });
    await page.goto(`${BASE}/bible.html#ref=Genesis%201`, { waitUntil: 'commit' });
    await page.waitForSelector('.yr-v, .yr-p', { timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    const samples = [];
    const snap = await probeOf(page);
    const sample = async (label) => samples.push(await snap(label));
    await sample('Genesis 1');
    const refs = ['Genesis 2', 'Genesis 3', 'Exodus 1', 'Exodus 20', 'Leviticus 1', 'Numbers 1', 'Deuteronomy 1', 'Joshua 1', 'Judges 1', 'Ruth 1',
      '1 Samuel 1', 'Psalm 1', 'Psalm 119', 'Isaiah 1', 'Isaiah 53', 'Matthew 1', 'Matthew 5', 'John 1', 'Romans 8', 'Revelation 1'];
    for (let i = 0; i < refs.length; i++) {
      await page.evaluate(`location.hash = '#ref=' + encodeURIComponent(${JSON.stringify(refs[i])})`);
      await sleep(1400);
      if (i % 5 === 4) await sample(`after ${i + 1} changes (${refs[i]})`);
    }
    await sample('after 20 changes');
    // and again after a forced collection, so the number is retention and not garbage waiting to be swept
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable').catch(() => {});
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    await sleep(800);
    await sample('after 20 changes + GC');
    rows.push({ engine, profile: profile.id, case: 'chapter-changes', samples });
    log(`  ${engine}/${profile.id}/chapter-changes  ${samples.map((s) => `${s.label}: ${(s.used / 1048576).toFixed(1)}MB/${s.nodes}n`).join(' · ')}`);
    await ctx.close();
  }
}

// ── suite: decode ───────────────────────────────────────────────────────────────────────────────────────────────
async function suiteDecode(browser, profile, rows) {
  const engine = browser.browserType().name();
  const ctx = await freshContext(browser, profile);
  const page = await ctx.newPage();
  await throttle(page, profile, { net: false });
  await page.goto(`${BASE}/scenes.html`, { waitUntil: 'commit' });
  await page.waitForSelector('.sc-card', { timeout: 45000 });
  const ids = await page.evaluate(`Array.from(document.querySelectorAll('.sc-card')).slice(0, 6).map(a => a.dataset.id)`);
  for (const id of ids) {
    for (const kind of ['thumb', 'full']) {
      const r = await page.evaluate(`__perf.decode(${JSON.stringify(`${BASE}/pictures/${kind}/${id}.webp`)})`).catch((e) => ({ err: String(e) }));
      rows.push({ engine, profile: profile.id, id, kind, ...r });
    }
  }
  const t = rows.filter((r) => r.kind === 'thumb' && r.decodeMs), f = rows.filter((r) => r.kind === 'full' && r.decodeMs);
  const avg = (a, k) => (a.length ? (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(1) : '-');
  log(`  ${engine}/${profile.id}/decode  thumb ${avg(t, 'decodeMs')}ms (${avg(t, 'bytes')}B) · full ${avg(f, 'decodeMs')}ms (${avg(f, 'bytes')}B)`);
  await ctx.close();
}

// ── suite: offline ──────────────────────────────────────────────────────────────────────────────────────────────
// What a reader meets when the line is gone: the worker install cost, and the fallback page's own startup.
async function suiteOffline(browser, profile, rows) {
  const engine = browser.browserType().name();
  const ctx = await freshContext(browser, profile);
  const page = await ctx.newPage();
  await throttle(page, profile);
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: 'commit' }).catch(() => {});
  await settle(page, 'home');
  // the worker registers on idle; wait for it to finish installing and record what it fetched
  let swReady = null;
  try {
    await page.waitForFunction('navigator.serviceWorker && navigator.serviceWorker.controller || (navigator.serviceWorker && navigator.serviceWorker.getRegistrations().then(r=>r.some(x=>x.active)))', null, { timeout: 30000 });
    swReady = Date.now() - t0;
  } catch { /* not installed in the window */ }
  await sleep(3000);
  const caches = await page.evaluate(`(async () => {
    if (!window.caches) return null;
    const names = await caches.keys();
    const out = [];
    for (const n of names) { const c = await caches.open(n); out.push({ name: n, entries: (await c.keys()).length }); }
    return out;
  })()`).catch(() => null);
  const afterSw = await harvest(page);
  rows.push({ engine, profile: profile.id, case: 'sw-install', swReadyMs: swReady, caches, requests: afterSw.requests, bytesTotal: afterSw.bytesTotal, longTasksMs: afterSw.longTasksMs });

  // offline.html on its own
  const page2 = await ctx.newPage();
  await throttle(page2, profile);
  const t1 = Date.now();
  await page2.goto(`${BASE}/offline.html`, { waitUntil: 'commit' }).catch(() => {});
  await page2.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  const off = await harvest(page2);
  rows.push({ engine, profile: profile.id, case: 'offline.html', wallMs: Date.now() - t1, lcp: off.lcp, requests: off.requests, bytesTotal: off.bytesTotal, nav: off.nav, dom: off.dom });
  log(`  ${engine}/${profile.id}/offline  sw ready ${swReady ?? 'MISS'}ms, caches ${JSON.stringify(caches)}, offline.html LCP ${off.lcp}ms ${(off.bytesTotal / 1024).toFixed(0)}KB`);
  await ctx.close();
}

// ── runner ──────────────────────────────────────────────────────────────────────────────────────────────────────
const SUITE_FN = { load: suiteLoad, scroll: suiteScroll, interact: suiteInteract, memory: suiteMemory, decode: suiteDecode, offline: suiteOffline };

async function main() {
  const want = SUITES.includes('all') ? Object.keys(SUITE_FN) : SUITES;
  const profiles = ONLY_PROFILE ? PROFILES.filter((p) => p.id === ONLY_PROFILE) : PROFILES;
  const out = {};
  for (const suite of want) {
    const fn = SUITE_FN[suite];
    if (!fn) { console.error(`no suite "${suite}"`); continue; }
    const rows = out[suite] = [];
    for (const engine of ENGINES) {
      const browser = await launch(engine);
      // Only Chromium has a CPU throttle, so only Chromium is run at every device class; WebKit runs once,
      // at the phone viewport, as the engine reading.
      const list = engine === 'chromium' ? profiles : profiles.filter((p) => p.id === 'phone4x' || profiles.length === 1);
      for (const profile of list) {
        log(`\n[${suite}] ${engine} · ${profile.label}`);
        try { await fn(browser, profile, rows); } catch (e) { console.error(`  suite failed: ${e}`); rows.push({ engine, profile: profile.id, fatal: String(e) }); }
      }
      await browser.close();
    }
    if (OUT) {
      await mkdir(OUT, { recursive: true });
      await writeFile(join(OUT, `${suite}.json`), JSON.stringify({ base: BASE, at: new Date().toISOString(), rows }, null, 2));
      log(`\nwrote ${join(OUT, `${suite}.json`)}`);
    }
  }
  if (OUT) {
    await writeFile(join(OUT, 'summary.md'), summarise(out));
    log(`wrote ${join(OUT, 'summary.md')}`);
  }
}

/** The same numbers as Markdown tables, so the report is copied and not retyped. */
function summarise(out) {
  const L = [`# Measured ${new Date().toISOString()} · ${BASE}`, ''];
  if (out.load?.length) {
    L.push('## Load', '', '| engine | class | route | cache | LCP ms | CLS | TBT ms | long tasks | requests | KB | LCP element |', '|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of out.load) for (const state of ['cold', 'warm']) {
      const m = r[state]; if (!m) continue;
      L.push(`| ${r.engine} | ${r.profile} | ${r.route} | ${state} | ${m.lcp} | ${m.cls} | ${m.tbt} | ${m.longTasks} (${m.longTasksMs}ms) | ${m.requests} | ${(m.bytesTotal / 1024).toFixed(0)} | ${m.lcpEl} |`);
    }
    L.push('', '### Bytes by kind (cold)', '', '| engine | class | route | js | css | font | thumb | full | reader-data | data |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const r of out.load) {
      const b = r.cold?.bytes ?? {}; const kb = (k) => (b[k] ? `${(b[k].transfer / 1024).toFixed(0)} (${b[k].n})` : '-');
      L.push(`| ${r.engine} | ${r.profile} | ${r.route} | ${kb('js')} | ${kb('css')} | ${kb('font')} | ${kb('thumb')} | ${kb('full')} | ${kb('reader-data')} | ${kb('data')} |`);
    }
  }
  if (out.scroll?.length) {
    L.push('', '## Scroll', '', '| engine | class | case | frames | dropped >33ms | % >20ms | % >16.7ms | % >8.3ms | p50 | p95 | p99 | worst | nodes before→after | heap MB |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of out.scroll) {
      if (!r.frames) continue;
      const f = r.frames;
      const heap = r.heapAfter ? `${(r.heapBefore.used / 1048576).toFixed(1)}→${(r.heapAfter.used / 1048576).toFixed(1)}` : '-';
      L.push(`| ${r.engine} | ${r.profile} | ${r.case} | ${f.frames} | ${f.dropped} (${f.pctDropped}%) | ${f.pctOver20} | ${f.pctOver16} | ${f.pctOver8} | ${f.p50} | ${f.p95} | ${f.p99} | ${f.worst} | ${r.before?.nodes}→${r.after?.nodes} | ${heap} |`);
    }
  }
  if (out.interact?.length) {
    L.push('', '## Interactions', '', '| engine | class | case | visible ms | INP ms | worst event ms | worst task ms | CLS | reader render ms (verses) |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of out.interact) {
      const yr = r.yrPerf ? `${r.yrPerf.renderMs?.toFixed?.(1) ?? r.yrPerf.renderMs} (${r.yrPerf.verses})` : '-';
      L.push(`| ${r.engine} | ${r.profile} | ${r.case} | ${r.visibleMs ?? (r.error ? 'n/a' : '-')} | ${r.inp ?? '-'} | ${r.eventMax ?? '-'} | ${r.worstTask ?? '-'} | ${r.cls ?? '-'} | ${yr} |`);
    }
  }
  if (out.memory?.length) {
    L.push('', '## Memory', '', '| engine | class | case | sample | JS heap MB | DOM nodes | CDP nodes | imgs | listeners | layouts | recalcs | layout ms | style ms |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of out.memory) for (const s of r.samples ?? []) {
      L.push(`| ${r.engine} | ${r.profile} | ${r.case} | ${s.label} | ${(s.used / 1048576).toFixed(2)} | ${s.nodes} | ${s.cdpNodes ?? '-'} | ${s.imgs} | ${s.listeners ?? '-'} | ${s.layouts ?? '-'} | ${s.recalcs ?? '-'} | ${s.layoutMs ?? '-'} | ${s.styleMs ?? '-'} |`);
    }
  }
  if (out.decode?.length) {
    L.push('', '## Picture decode', '', '| engine | class | id | kind | bytes | fetch ms | decode ms | px |', '|---|---|---|---|---|---|---|---|');
    for (const r of out.decode) L.push(`| ${r.engine} | ${r.profile} | ${r.id} | ${r.kind} | ${r.bytes ?? '-'} | ${r.fetchMs ?? '-'} | ${r.decodeMs ?? '-'} | ${r.w}×${r.h} |`);
  }
  if (out.offline?.length) {
    L.push('', '## Service worker / offline', '', '```json', JSON.stringify(out.offline, null, 2), '```');
  }
  return L.join('\n') + '\n';
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
