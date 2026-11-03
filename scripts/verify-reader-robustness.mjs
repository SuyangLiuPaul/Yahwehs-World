// Robustness acceptance for src/reader (plan §3.1), run against the standalone demo build.
//
//   npm run reader:demo && node scripts/verify-reader-robustness.mjs [--dir dist-reader] [--only offline,a11y] [--json out.json]
//
// Serves dist-reader/ itself (gzip, Netlify-like cache headers) and drives Chrome. Every case prints `ok` or `FAIL`
// and a measured number where one exists; the numbers are written to docs/evidence/gallery-2026-11/reader-robustness.json.
// Exit 1 on any failure.
//
// Cases: basics, offline, slow, degraded, rtl, long, language, history, deeplinks, a11y, scale, copy, editions,
//        passage, notes, wording.
import http from 'node:http';
import zlib from 'node:zlib';
import { readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIR = resolve(ROOT, arg('--dir') ?? 'dist-reader');
const ONLY = (arg('--only') ?? '').split(',').filter(Boolean);
const OUT = resolve(ROOT, arg('--json') ?? 'docs/evidence/gallery-2026-11/reader-robustness.json');
if (!existsSync(DIR)) { console.error(`no ${DIR}: run npm run reader:demo first`); process.exit(1); }

// ── static server ───────────────────────────────────────────────────────────
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const gz = new Map();
let shellCache = 'public, max-age=0, must-revalidate'; // Netlify's default for html; the offline-reload case changes it
const server = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname.startsWith('/__blocked/')) { r.writeHead(404); r.end(); return; }
  const f = join(DIR, u.pathname === '/' ? 'reader-demo.html' : u.pathname);
  if (!f.startsWith(DIR) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; }
  const type = T[extname(f)] ?? 'application/octet-stream';
  let body = gz.get(f);
  if (!body) { body = zlib.gzipSync(readFileSync(f), { level: 6 }); gz.set(f, body); }
  const hashed = /\/assets\//.test(f);
  r.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'content-length': body.length, 'cache-control': hashed ? 'public, max-age=31536000, immutable' : f.endsWith('.html') ? shellCache : 'public, max-age=0, must-revalidate' });
  r.end(body);
});
await new Promise((o) => server.listen(0, '127.0.0.1', o));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });

// ── harness ─────────────────────────────────────────────────────────────────
const results = [];
let bad = 0;
const ok = (cond, msg, data) => {
  results.push({ ok: !!cond, msg, ...(data !== undefined ? { data } : {}) });
  if (!cond) { bad++; console.error(`FAIL ${msg}${data !== undefined ? '  ' + JSON.stringify(data) : ''}`); }
  else console.log(`ok   ${msg}${data !== undefined ? '  ' + JSON.stringify(data) : ''}`);
};
const want = (name) => !ONLY.length || ONLY.includes(name);
const VP = { phone: { width: 375, height: 812 }, desktop: { width: 1440, height: 900 } };
const LANGS = ['en', 'zh-Hans', 'zh-Hant', 'ru'];

async function open(o = {}) {
  const ctx = await browser.newContext({
    viewport: o.viewport ?? VP.phone, colorScheme: o.colorScheme ?? 'light', reducedMotion: o.reducedMotion ?? 'no-preference',
    locale: o.locale ?? 'en-US', permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: false, serviceWorkers: 'block',
  });
  if (o.init) await ctx.addInitScript(o.init);
  await ctx.addInitScript(() => {
    window.__cls = 0; window.__skel = null; window.__firstVerseAt = null;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new MutationObserver(() => {
      if (window.__skel === null && document.querySelector('.yr-skel')) window.__skel = performance.now();
      if (window.__firstVerseAt === null && document.querySelector('.yr-v .yr-t, .yr-pv .yr-t')) window.__firstVerseAt = performance.now();
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url().replace(base, '')));
  return { ctx, page, errs, reqs };
}
const ready = (page) => page.waitForSelector('html[data-ready="1"]', { timeout: 30000 });
async function go(h, url) { await h.page.goto(base + url); await ready(h.page); await h.page.waitForSelector('.yr-body .yr-v, .yr-body .yr-pv, .yr-body .yr-state', { timeout: 30000 }); }
const title = (page) => page.locator('.yr-title').first().textContent();
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const chromeText = (page) => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.yr-bar, .yr-tools, .yr-status, .yr-selbar, .yr-sheet[open], .yr-foot .yr-btn').forEach((el) => out.push(el.innerText));
  return out.join('\n');
});
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0; };

// ── cases ───────────────────────────────────────────────────────────────────

async function basics() {
  for (const [vn, vp] of Object.entries(VP)) for (const lang of LANGS) {
    const h = await open({ viewport: vp });
    await go(h, `/reader-demo.html?view=chapter&lang=${lang}#ref=Genesis 1`);
    const n = await h.page.locator('.yr-v').count();
    const lg = await h.page.evaluate(() => [document.documentElement.lang, document.querySelector('.yr').lang]);
    const heading = await h.page.locator('.yr-h').first().textContent();
    ok(n === 31 && lg[0] === lang && lg[1] === lang && h.errs.length === 0 && (await noHScroll(h.page)), `${vn} ${lang}: Genesis 1 renders 31 verses, lang=${lang}, no errors, no horizontal scroll`, { title: await title(h.page), heading });
    const cls = await h.page.evaluate(() => window.__cls);
    ok(cls < 0.02, `${vn} ${lang}: layout shift ${cls.toFixed(4)} (< 0.02)`);
    await h.ctx.close();
  }
}

async function offline() {
  const h = await open({ init: () => { localStorage.setItem('yr.prefs.v1', JSON.stringify({ edition: { en: 'kjv' } })); } });
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1');
  await h.page.locator('[data-act="next"]').click(); await h.page.waitForSelector('.yr-title:has-text("Genesis 2")');
  await h.ctx.setOffline(true);
  // 1. a chapter of a book already seen
  await h.page.locator('[data-act="next"]').click(); await h.page.waitForSelector('.yr-title:has-text("Genesis 3")', { timeout: 5000 });
  ok(await h.page.locator('.yr-v').count() > 10, 'offline: a chapter of a book already read renders (in-memory)');
  // 2. a book never seen: a named state with Retry, the bar still works
  await h.page.evaluate(() => { location.hash = '#ref=Exodus 1'; }); await h.page.waitForSelector('.yr-state', { timeout: 30000 });
  const msg = await h.page.locator('.yr-state').innerText();
  ok(/offline/i.test(msg) && (await h.page.locator('.yr-state [data-act="retry"]').count()) === 1, 'offline: an unseen book shows the named offline state with Retry (no blank, no endless skeleton)', { msg: msg.replace(/\n/g, ' ') });
  ok(await h.page.locator('.yr-skel').count() === 0, 'offline: no skeleton left behind');
  ok(await h.page.locator('.yr-bar [data-act="pick"]').isEnabled() && await h.page.locator('.yr-bar [data-act="next"]').isEnabled(), 'offline: the chapter bar still works');
  await h.page.locator('.yr-state [data-act="retry"]').click(); await h.page.waitForTimeout(2500);
  ok(await h.page.locator('.yr-state').count() === 1, 'offline: Retry while still offline stays on the named state');
  await h.ctx.setOffline(false);
  await h.page.locator('.yr-state [data-act="retry"]').click(); await h.page.waitForSelector('.yr-v', { timeout: 15000 });
  ok(await title(h.page) === 'Exodus 1', 'offline: back online, Retry loads the chapter');
  await h.ctx.close();

  // 3. fresh page load while offline: the shell is cacheable (a host that sets max-age, or a service worker), the data comes from Cache Storage
  shellCache = 'public, max-age=600';
  const h2 = await open();
  await go(h2, '/reader-demo.html?view=chapter&lang=en#ref=Psalm 23');
  const before = await h2.page.locator('.yr-v').first().innerText();
  await h2.page.waitForTimeout(600); // let the background revalidation settle
  await h2.ctx.setOffline(true);
  await h2.page.goto('about:blank'); await h2.page.goto(base + '/reader-demo.html?view=chapter&lang=en#ref=Psalm 23'); await ready(h2.page); await h2.page.waitForSelector('.yr-v, .yr-state', { timeout: 15000 });
  const after = (await h2.page.locator('.yr-v').count()) ? await h2.page.locator('.yr-v').first().innerText() : 'STATE';
  ok(after === before, 'offline: a reload while offline renders the chapter read before (data kept in Cache Storage)', { before: before.slice(0, 40) });
  await h2.ctx.close();
  shellCache = 'public, max-age=0, must-revalidate';
}

async function slow() {
  const out = {};
  for (const [vn, vp] of Object.entries(VP)) {
    const h = await open({ viewport: vp });
    const cdp = await h.ctx.newCDPSession(h.page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6e6 / 8), uploadThroughput: (750e3 / 8) });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0; const sizes = {};
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
    cdp.on('Network.responseReceived', (e) => { sizes[e.requestId] = e.response.url.replace(base, ''); });
    const t0 = Date.now();
    await h.page.goto(base + '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1');
    await ready(h.page);
    await h.page.waitForSelector('.yr-v .yr-t', { timeout: 60000 });
    const ms = Date.now() - t0;
    const skel = await h.page.evaluate(() => ({ skel: window.__skel, verse: window.__firstVerseAt, cls: window.__cls }));
    out[vn] = { firstTextMs: ms, kbTransferred: Math.round(bytes / 1024), skeletonBeforeText: skel.skel !== null && skel.skel < skel.verse, cls: +skel.cls.toFixed(4) };
    ok(ms < 6000, `slow (1.6 Mbit/s, 150 ms RTT, 4x CPU) ${vn}: first verse readable in ${ms} ms (budget 6000), ${Math.round(bytes / 1024)} KB over the wire`, out[vn]);
    ok(out[vn].skeletonBeforeText || ms < 400, `slow ${vn}: a skeleton, not a blank page or spinner, shows before the text`);
    ok(skel.cls < 0.02, `slow ${vn}: layout shift ${skel.cls.toFixed(4)}`);
    ok(bytes / 1024 <= 125, `slow ${vn}: first-view transfer ${Math.round(bytes / 1024)} KB <= 125 KB budget (measured 102 KB + 20%)`);
    await h.ctx.close();
  }
  return out;
}

async function degraded() {
  // the catalogue is bundled: there is no editions.json to fail, and blocking it changes nothing
  let h = await open();
  await h.ctx.route('**/data/reader/catalogue.json', (r) => r.abort());
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1');
  ok(!h.reqs.some((u) => /catalogue\.json/.test(u)) && (await h.page.locator('.yr-v').count()) === 31, 'degraded: the edition list is bundled in the script; the page never asks for catalogue.json');
  await h.ctx.close();
  // headings and paragraph data failing: the verses still read
  h = await open();
  await h.ctx.route('**/data/reader/headings/**', (r) => r.abort());
  await h.ctx.route('**/data/reader/para/**', (r) => r.abort());
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 15');
  ok((await h.page.locator('.yr-v').count()) === 21 && (await h.page.locator('.yr-h').count()) === 0 && h.errs.length === 0, 'degraded: headings and paragraph data unreachable, the verses still read, no error');
  await h.page.locator('[data-act="mode"][data-id="paragraph"]').click(); await h.page.waitForSelector('.yr-p');
  ok((await h.page.locator('.yr-p .yr-v').count()) === 21, 'degraded: paragraph mode without paragraph data reads as one run');
  await h.ctx.close();
  // a second edition failing in parallel: the main edition reads, the notice says which one is missing
  h = await open();
  await h.ctx.route('**/data/reader/text/kjv/**', (r) => r.abort());
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1&par=bsb-yhwh,kjv&m=parallel');
  const st = await h.page.locator('.yr-status').innerText();
  ok(/KJV/.test(st) && (await h.page.locator('.yr-v, .yr-pv').count()) > 20, 'degraded: parallel with one edition unreachable shows the main edition and names the missing one', { status: st });
  await h.ctx.close();
  // a 404 for the main book data: named error with Retry
  h = await open();
  await h.ctx.route('**/data/reader/text/bsb-yhwh/2.json', (r) => r.fulfill({ status: 404, body: '' }));
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Exodus 1');
  ok((await h.page.locator('.yr-state [data-act="retry"]').count()) === 1 && /could not be loaded/i.test(await h.page.locator('.yr-state').innerText()), 'degraded: a missing book file shows "could not be loaded" with Retry');
  await h.ctx.close();
}

async function rtl() {
  const h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en&rtl=1#ref=Genesis 1');
  const g = await h.page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const v = document.querySelector('.yr-v');
    return {
      dir: document.documentElement.dir, rootDir: document.querySelector('.yr').dir,
      prevX: r('[data-act="prev"]').x, nextX: r('[data-act="next"]').x,
      numX: v.querySelector('.yr-vn').getBoundingClientRect().x, textX: v.querySelector('.yr-t').getBoundingClientRect().x,
      textAlign: getComputedStyle(document.querySelector('.yr-t')).textAlign,
      pill: document.querySelector('[data-act="mode"]').textContent, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      clipped: [...document.querySelectorAll('.yr-bar button, .yr-tools button')].filter((b) => b.scrollWidth > b.clientWidth + 1).length,
      glyphPrev: document.querySelector('[data-act="prev"]').textContent,
    };
  });
  ok(g.dir === 'rtl' && g.rootDir === 'rtl', 'rtl: dir=rtl reaches the page and the reader root');
  ok(g.numX > g.textX, 'rtl: verse numbers sit on the right of their text', { numX: Math.round(g.numX), textX: Math.round(g.textX) });
  ok(g.prevX > g.nextX, 'rtl: the chapter bar mirrors (previous on the right)', { prevX: Math.round(g.prevX), nextX: Math.round(g.nextX), glyph: g.glyphPrev });
  ok(g.scrollW <= g.clientW + 1 && g.clipped === 0, 'rtl: no horizontal scroll, no clipped chrome', g);
  ok(/آيات/.test(g.pill), 'rtl: Arabic strings from the fixture replace the chrome words');
  await h.page.locator('[data-act="pick"]').click();
  ok(await h.page.locator('.yr-sheet[open]').count() === 1 && await h.page.evaluate(() => document.querySelector('.yr-sheet').dir) === 'rtl', 'rtl: the sheet opens mirrored');
  await h.page.keyboard.press('Escape');
  await h.page.evaluate(() => document.activeElement.blur());
  await h.page.keyboard.press('ArrowLeft'); // in RTL ArrowLeft goes to the next chapter
  await h.page.waitForSelector('.yr-title:has-text("Genesis 2")', { timeout: 5000 }).catch(() => {});
  ok((await title(h.page)) === 'Genesis 2', 'rtl: ArrowLeft steps forward');
  await h.ctx.close();
}

async function long() {
  const out = {};
  for (const [vn, vp] of Object.entries(VP)) {
    const h = await open({ viewport: vp });
    await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Psalm 119&par=bsb-yhwh,kjv,cuvs-yhwh&m=parallel');
    const perf = await h.page.evaluate(() => ({ ...window.__yrPerf, nodes: document.querySelectorAll('.yr *').length, lines: document.querySelectorAll('.yr-line').length }));
    ok(perf.verses === 176 && perf.lines === 528, `long ${vn}: Psalm 119 in 3 editions, 176 rows / 528 lines`, perf);
    ok(perf.renderMs < 120, `long ${vn}: Psalm 119 x3 renders in ${perf.renderMs.toFixed(1)} ms after data (< 120)`);
    const t = await h.page.evaluate(() => new Promise((res) => {
      const max = document.documentElement.scrollHeight - innerHeight, times = []; let last = performance.now(), y = 0; const t0 = last;
      const f = (now) => { times.push(now - last); last = now; y = (y + 14) % max; scrollTo(0, y); if (now - t0 < 3000) requestAnimationFrame(f); else res(times); };
      requestAnimationFrame(f);
    }));
    const p50 = pct(t, .5), p95 = pct(t, .95), over = t.filter((x) => x > 33.4).length / t.length;
    out[vn] = { frames: t.length, p50: +p50.toFixed(1), p95: +p95.toFixed(1), over33pct: +(over * 100).toFixed(1) };
    ok(p50 <= 17.5 && over < 0.05, `long ${vn}: scrolling Psalm 119 x3 for 3 s: median frame ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, ${(over * 100).toFixed(1)}% over 33 ms`, out[vn]);
    ok(await noHScroll(h.page), `long ${vn}: no horizontal scroll`);
    await h.ctx.close();
  }
  const h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1&m=paragraph');
  const a = await h.page.evaluate(() => window.__yrPerf);
  await h.page.evaluate(() => { location.hash = '#ref=1 Chronicles 1'; }); await h.page.waitForSelector('.yr-title:has-text("1 Chronicles 1")');
  const b = await h.page.evaluate(() => window.__yrPerf);
  ok(a.renderMs < 120 && b.renderMs < 120 && b.verses === 54, `long: Genesis 1 paragraph ${a.renderMs.toFixed(1)} ms, 1 Chronicles 1 (54 verses of names) ${b.renderMs.toFixed(1)} ms`);
  await h.ctx.close();
  return out;
}

async function language() {
  const h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=John 3:16');
  await h.page.evaluate(() => { window.__marker = 1; });
  const audit = { en: /[一-鿿Ѐ-ӿ]/, 'zh-Hans': /[A-Za-z]{3,}|[Ѐ-ӿ]/, 'zh-Hant': /[A-Za-z]{3,}|[Ѐ-ӿ]/, ru: /[A-Za-z]{3,}|[一-鿿]/ };
  const expect = { en: { mode: 'Verses', ed: 'BSB (Yahweh)', t: 'John 3' }, 'zh-Hans': { mode: '逐节', ed: '和合本雅伟版', t: '约翰福音 3' }, 'zh-Hant': { mode: '逐節', ed: '和合本雅偉版', t: '約翰福音 3' }, ru: { mode: 'По стихам', ed: 'СП (Яхве)', t: 'От Иоанна 3' } };
  for (const lang of [...LANGS, 'en']) {
    await h.page.selectOption('#lang', lang);
    await h.page.waitForFunction((l) => document.querySelector('.yr').lang === l, lang);
    await h.page.waitForTimeout(250);
    const g = await h.page.evaluate(() => ({ marker: window.__marker, html: document.documentElement.lang, mode: document.querySelector('[data-act="mode"]').textContent, ed: document.querySelector('.yr-pill span').textContent, t: document.querySelector('.yr-title').textContent, aria: document.querySelector('[data-act="next"]').getAttribute('aria-label') }));
    ok(g.marker === 1 && g.html === lang && g.mode === expect[lang].mode && g.ed === expect[lang].ed && g.t.startsWith(expect[lang].t), `language: switched to ${lang} without a reload; chrome, book name and default edition follow`, g);
    // select a verse and open the display sheet so the selection bar and a sheet are audited too
    await h.page.locator('.yr-vn').first().click();
    await h.page.locator('[data-act="display"]').click();
    const text = (await chromeText(h.page)).replace(/BSB \(Yahweh\)|KJV|WEB|ASV \(Yahweh\)|和合本雅[伟偉]版|СП \(Яхве\)|СП|English|Русский|简体中文|繁體中文|Aa|A[+−]+/g, '');
    const m = text.match(audit[lang]);
    ok(!m, `language: nothing from another language left in the ${lang} chrome`, m ? { found: m[0] } : undefined);
    await h.page.keyboard.press('Escape');
    await h.page.keyboard.press('Escape');
  }
  // a reader's own choice is remembered per language: KJV for English survives a visit to Chinese
  await h.page.selectOption('#lang', 'en'); await h.page.waitForFunction(() => document.querySelector('.yr').lang === 'en');
  await h.page.locator('.yr-pill[data-act="edition"]').click(); await h.page.locator('.yr-sheet [data-id="kjv"]').click();
  await h.page.waitForFunction(() => document.querySelector('.yr-pill span').textContent === 'KJV');
  await h.page.selectOption('#lang', 'zh-Hans'); await h.page.waitForFunction(() => document.querySelector('.yr').lang === 'zh-Hans'); await h.page.waitForTimeout(200);
  const zhEd = await h.page.locator('.yr-pill span').first().textContent();
  await h.page.selectOption('#lang', 'en'); await h.page.waitForFunction(() => document.querySelector('.yr').lang === 'en'); await h.page.waitForTimeout(200);
  const enEd = await h.page.locator('.yr-pill span').first().textContent();
  ok(zhEd === '和合本雅伟版' && enEd === 'KJV', 'language: the edition changes to the language default only when the reader has not chosen one (KJV kept for English)', { zhEd, enEd });
  ok(h.errs.length === 0, 'language: no errors across the switches', h.errs.slice(0, 2));
  await h.ctx.close();
}

async function history() {
  const h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1');
  await h.page.locator('[data-act="next"]').click(); await h.page.waitForSelector('.yr-title:has-text("Genesis 2")');
  await h.page.evaluate(() => scrollTo(0, 600)); await h.page.waitForTimeout(150);
  await h.page.locator('[data-act="next"]').click(); await h.page.waitForSelector('.yr-title:has-text("Genesis 3")');
  ok((await h.page.evaluate(() => location.hash)) === '#ref=Genesis%203', 'history: a chapter step is a history entry with its own #ref', { hash: await h.page.evaluate(() => location.hash) });
  await h.page.goBack(); await h.page.waitForSelector('.yr-title:has-text("Genesis 2")'); await h.page.waitForTimeout(300);
  const y = await h.page.evaluate(() => scrollY);
  ok(Math.abs(y - 600) <= 40, `history: Back restores the previous chapter and its scroll position (${Math.round(y)} vs 600)`);
  await h.page.goBack(); await h.page.waitForSelector('.yr-title:has-text("Genesis 1")');
  await h.page.goForward(); await h.page.waitForSelector('.yr-title:has-text("Genesis 2")');
  ok(true, 'history: Back, Back, Forward walks Genesis 3, 2, 1, 2');
  // book picker navigation is history too; the edition change does not add an entry
  const len = await h.page.evaluate(() => history.length);
  await h.page.locator('.yr-pill[data-act="edition"]').click(); await h.page.locator('.yr-sheet [data-id="kjv"]').click(); await h.page.waitForTimeout(400);
  ok((await h.page.evaluate(() => history.length)) === len, 'history: switching edition replaces the entry instead of adding one');
  await h.ctx.close();
}

async function deeplinks() {
  const cases = [
    ['#ref=Exodus 25:10', { title: 'Exodus 25', hl: [25010] }],
    ['#ref=Exodus%2025%3A10-12', { title: 'Exodus 25', hl: [25010, 25011, 25012] }],
    ['#ref=约 3:16&ed=cuvs-yhwh&lang=zh-Hans', { title: '约翰福音 3', hl: [3016], edition: '和合本雅伟版' }],
    ['#ref=Genesis 15:5-6&par=kjv,cuvs-yhwh&m=parallel', { title: 'Genesis 15', hl: [15005, 15006], parallel: 2 }],
    ['#lang=ru&ref=Рим 8', { title: 'Римлянам 8', edition: 'СП (Яхве)' }],
    ['#ed=asv-yhwh&ref=Psalm 23', { title: 'Psalms 23', edition: 'ASV (Yahweh)' }],
    ['#ref=nonsense', { title: 'Genesis 1' }],
    ['', { title: 'Genesis 1' }],
  ];
  for (const [hash, exp] of cases) {
    const h = await open();
    await go(h, `/reader-demo.html?view=chapter&lang=en${hash}`);
    await h.page.waitForTimeout(400);
    const g = await h.page.evaluate(() => ({
      title: document.querySelector('.yr-title')?.textContent, hl: [...document.querySelectorAll('.is-hl')].map((e) => Number(e.dataset.k)),
      edition: document.querySelector('.yr-pill span')?.textContent, parallel: document.querySelector('.yr-pv') ? document.querySelector('.yr-pv').querySelectorAll('.yr-line').length : 0, docTitle: document.title,
      inView: (() => { const e = document.querySelector('.is-hl'); if (!e) return null; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })(),
    }));
    const pass = g.title === exp.title && (!exp.hl || JSON.stringify(g.hl) === JSON.stringify(exp.hl)) && (!exp.edition || g.edition === exp.edition) && (!exp.parallel || g.parallel === exp.parallel) && (!exp.hl || g.inView);
    ok(pass && h.errs.length === 0, `deep link ${hash || '(none)'} -> ${g.title}${exp.hl ? ' verses ' + g.hl.map((k) => k % 1000).join(',') + (g.inView ? ' in view' : ' NOT in view') : ''}`, { got: g, errs: h.errs.slice(0, 1) });
    await h.ctx.close();
  }
}

async function a11y() {
  const axeSrc = readFileSync(join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
  const runAxe = async (page) => page.evaluate(async () => { const r = await window.axe.run(document, { resultTypes: ['violations'] }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.html?.slice(0, 120) })); });
  const summary = {};
  for (const scheme of ['light', 'dark']) for (const theme of ['auto', 'dark', 'light', 'paper']) for (const lang of LANGS) {
    if (!(lang === 'en' || theme === 'auto')) continue;
    const h = await open({ colorScheme: scheme, init: `localStorage.setItem('yr.prefs.v1', ${JSON.stringify(JSON.stringify({ theme }))})` });
    await go(h, `/reader-demo.html?view=chapter&lang=${lang}#ref=John 1`);
    await h.page.addScriptTag({ content: axeSrc });
    await h.page.locator('.yr-vn').nth(2).click();
    await h.page.locator('.yr-hi').first().click();
    const v = (await runAxe(h.page)).filter((x) => x.impact === 'serious' || x.impact === 'critical');
    summary[`${scheme}/${theme}/${lang}`] = v.length;
    ok(v.length === 0, `a11y axe: 0 serious or critical (system ${scheme}, theme ${theme}, ${lang})`, v.length ? v : undefined);
    await h.ctx.close();
  }
  const h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1');
  await h.page.addScriptTag({ content: axeSrc });
  // every sheet, open, through axe
  for (const [act, name] of [['pick', 'book picker'], ['edition', 'edition sheet'], ['display', 'display sheet']]) {
    await h.page.locator(`[data-act="${act}"]`).click();
    const v = (await runAxe(h.page)).filter((x) => x.impact === 'serious' || x.impact === 'critical');
    ok(v.length === 0, `a11y axe: ${name} open, 0 serious or critical`, v.length ? v : undefined);
    await h.page.keyboard.press('Escape');
  }
  // focus trap, Escape, focus return
  const opener = h.page.locator('.yr-pill[data-act="edition"]');
  await opener.focus(); await opener.press('Enter');
  const trapped = [];
  for (let i = 0; i < 14; i++) { await h.page.keyboard.press('Tab'); trapped.push(await h.page.evaluate(() => !!document.activeElement.closest('.yr-sheet') || document.activeElement === document.body)); }
  ok(trapped.every(Boolean), 'a11y: Tab never reaches the page behind an open sheet (focus stays in the sheet or leaves to the browser, 14 presses)');
  await h.page.keyboard.press('Escape');
  ok(await h.page.locator('.yr-sheet[open]').count() === 0 && await h.page.evaluate(() => document.activeElement?.dataset?.act) === 'edition', 'a11y: Escape closes the sheet and focus returns to its opener');
  // sheets are modal: the page behind is inert
  await opener.click();
  ok(await h.page.evaluate(() => !!document.querySelector('.yr-sheet').matches(':modal')), 'a11y: an open sheet is modal');
  await h.page.keyboard.press('Escape');
  // target size 44 px for every button that is not inline in running text
  const small = await h.page.evaluate(() => [...document.querySelectorAll('.yr button')].filter((b) => !b.closest('.yr-sheet[open]') && !b.classList.contains('yr-fn') && !b.closest('.yr-p') && b.offsetParent).map((b) => ({ c: b.className, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })).filter((b) => b.w < 43.5 || b.h < 43.5));
  ok(small.length === 0, 'a11y: every button (outside running text) is at least 44 x 44 px', small.slice(0, 4));
  // keyboard: verse number, Enter selects, the bar appears, Enter on Copy copies with the credit, Escape clears
  await h.page.locator('.yr-vn').nth(0).focus();
  await h.page.keyboard.press('Enter');
  const pressed = await h.page.locator('.yr-vn').nth(0).getAttribute('aria-pressed');
  ok(pressed === 'true' && await h.page.locator('.yr-selbar:not([hidden])').count() === 1, 'a11y: a verse number is reachable and selectable from the keyboard; the selection bar appears');
  await h.page.locator('.yr-selbar [data-act="copySel"]').focus(); await h.page.keyboard.press('Enter');
  await h.page.waitForTimeout(300);
  const clip = await h.page.evaluate(() => navigator.clipboard.readText());
  ok(/^Genesis 1:1 \(BSB, Yahweh edition\)\n1 In the beginning/.test(clip) && /public domain \(CC0\)/.test(clip), 'a11y: Copy from the keyboard puts the verse, the edition and its credit line on the clipboard');
  await h.page.keyboard.press('Escape');
  ok(await h.page.locator('.yr-selbar:not([hidden])').count() === 0, 'a11y: Escape clears the selection');
  // semantics a screen reader needs
  const sem = await h.page.evaluate(() => ({
    region: document.querySelector('.yr').getAttribute('role'), label: document.querySelector('.yr').getAttribute('aria-label'),
    live: document.querySelector('.yr-toast').getAttribute('aria-live'), vnLabel: document.querySelector('.yr-vn').getAttribute('aria-label'),
    h2: [...document.querySelectorAll('h2')].filter((e) => e.offsetParent).length, h3: [...document.querySelectorAll('h3')].filter((e) => e.offsetParent).length, lang: document.querySelector('.yr-v').lang,
    pressedNum: document.querySelectorAll('.yr-vn[aria-pressed]').length, verses: document.querySelectorAll('.yr-vn').length,
  }));
  ok(sem.region === 'region' && sem.label === 'Bible reader' && sem.live === 'polite' && sem.vnLabel === 'Select verse 1' && sem.h2 === 1 && sem.pressedNum === sem.verses && sem.lang === 'en', 'a11y: landmark, live region, verse labels, one h2 then h3 headings, lang on text', sem);
  await h.ctx.close();
  // reduced motion
  const hr = await open({ reducedMotion: 'reduce' });
  await go(hr, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1');
  await hr.page.locator('.yr-pill[data-act="edition"]').click();
  const anim = await hr.page.evaluate(() => { const s = getComputedStyle(document.querySelector('.yr-sheet')); return { name: s.animationName, dur: s.animationDuration }; });
  const toastT = await hr.page.evaluate(() => getComputedStyle(document.querySelector('.yr-toast')).transitionDuration);
  ok(parseFloat(anim.dur) <= 0.02 && parseFloat(toastT) <= 0.02, 'a11y: with reduced motion the sheet and toast do not move or fade over time', { anim, toastT });
  await hr.ctx.close();
  return summary;
}

async function scale() {
  const out = [];
  for (const [vn, vp] of Object.entries(VP)) for (const zoom of [1.25, 1.5, 2]) for (const step of [1, 1.5]) for (const mode of ['verse', 'parallel']) {
    const viewport = { width: Math.round(vp.width / zoom), height: Math.round(vp.height / zoom) };
    const h = await open({ viewport, init: `localStorage.setItem('yr.prefs.v1', ${JSON.stringify(JSON.stringify({ size: step, mode, parallel: mode === 'parallel' ? ['bsb-yhwh', 'kjv', 'cuvs-yhwh'] : [] }))})` });
    await go(h, '/reader-demo.html?view=chapter&lang=en#ref=John 3');
    await h.page.locator('.yr-vn').first().click();
    await h.page.evaluate(() => scrollTo(0, 0));
    const g = await h.page.evaluate(() => {
      const els = [...document.querySelectorAll('.yr-bar > *, .yr-tools > *')].filter((e) => e.offsetParent);
      const boxes = els.map((e) => e.getBoundingClientRect());
      let overlap = 0; const pairs = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) { overlap++; pairs.push([els[i].className || els[i].dataset.act, els[j].className || els[j].dataset.act]); } }
      const wide = [...document.querySelectorAll('.yr *')].filter((e) => e.offsetParent && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 3).map((e) => e.className || e.tagName);
      const sel = [...document.querySelectorAll('.yr-selbar > *')].map((e) => e.getBoundingClientRect()); let selOverlap = 0; for (let i = 0; i < sel.length; i++) for (let j = i + 1; j < sel.length; j++) { const a = sel[i], b = sel[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) selOverlap++; }
      overlap += selOverlap;
      const clipped = [...document.querySelectorAll('.yr-bar button, .yr-tools button, .yr-selbar button')].filter((b) => b.scrollWidth > b.clientWidth + 1).length;
      const bar = document.querySelector('.yr-bar').getBoundingClientRect();
      return { overlap, pairs: pairs.slice(0, 2), wide, clipped, hs: document.documentElement.scrollWidth - document.documentElement.clientWidth, barVisible: bar.height > 0 && bar.right <= innerWidth + 1 };
    });
    const pass = g.overlap === 0 && g.clipped === 0 && g.hs <= 1 && g.barVisible;
    out.push({ vn, zoom, step, mode, ...g, pass });
    ok(pass, `scale ${vn} zoom ${Math.round(zoom * 100)}% x text step ${step} (${mode}): no overlap, no clipped controls, no horizontal scroll`, pass ? undefined : g);
    await h.ctx.close();
  }
  return out;
}

async function copy() {
  // 1. a verse range, with the credit, in every language edition
  const cases = [
    ['en', 'bsb-yhwh', 'Genesis 1:1–2 (BSB, Yahweh edition)', 'BSB (Yahweh) · Berean Standard Bible, public domain (CC0)'],
    ['zh-Hans', 'cuvs-yhwh', '创世记 1:1–2（和合本雅伟版）', '和合本雅伟版 · 和合本，公有领域；神名作雅伟。'],
    ['zh-Hant', 'cuvs-yhwh-tr', '創世記 1:1–2（和合本雅偉版）', '和合本雅偉版 · 和合本，公有領域；神名作雅偉。'],
    ['ru', 'rst-yhwh', 'Бытие 1:1–2 (Синодальный перевод, издание Яхве)', 'СП (Яхве) · Синодальный перевод (1876), общественное достояние'],
  ];
  for (const [lang, ed, head, credit] of cases) {
    const h = await open({ init: `localStorage.setItem('yr.prefs.v1', ${JSON.stringify(JSON.stringify({ edition: { [lang]: ed } }))})` });
    await go(h, `/reader-demo.html?view=chapter&lang=${lang}&origin=https://w.test#ref=Genesis 1`);
    await h.page.locator('.yr-vn').nth(0).click(); await h.page.locator('.yr-vn').nth(1).click();
    await h.page.locator('[data-act="copySel"]').click(); await h.page.waitForTimeout(300);
    const clip = await h.page.evaluate(() => navigator.clipboard.readText());
    const lines = clip.split('\n');
    ok(lines[0] === head && clip.includes(credit) && /— .+ · https:\/\/w\.test\/bible\.html#ref=Genesis%201%3A1-2&ed=/.test(clip) && !clip.includes('1919') && !/<note|耶和华/.test(clip), `copy ${lang}: heading "${head}", numbered verses, credit line, link`, { first: lines.slice(0, 2).join(' | ').slice(0, 90) });
    await h.ctx.close();
  }
  // 2. Safari: the async clipboard rejects; the legacy path must carry the copy
  let h = await open({ init: () => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new DOMException('no', 'NotAllowedError')) });
    const real = document.execCommand.bind(document); window.__legacy = [];
    document.execCommand = (c) => { if (c === 'copy') { window.__legacy.push(document.activeElement && document.activeElement.value); return true; } return real(c); };
  } });
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=John 3');
  await h.page.locator('.yr-vn').nth(15).click(); await h.page.locator('[data-act="copySel"]').click(); await h.page.waitForTimeout(300);
  const leg = await h.page.evaluate(() => window.__legacy);
  const toast = await h.page.locator('.yr-toast').innerText();
  ok(leg.length === 1 && /^John 3:16 \(BSB, Yahweh edition\)\n16 For God so loved the world/.test(leg[0] ?? '') && toast === 'Copied', 'copy: when the async clipboard is refused the execCommand fallback carries the same text, and the toast still says Copied', { toast });
  await h.ctx.close();
  // 3. both fail: a named failure, no throw
  h = await open({ init: () => { Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('x')) }); document.execCommand = () => false; } });
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=John 3');
  await h.page.locator('.yr-vn').nth(0).click(); await h.page.locator('[data-act="copySel"]').click(); await h.page.waitForTimeout(300);
  ok(/Copy failed/.test(await h.page.locator('.yr-toast').innerText()) && h.errs.length === 0, 'copy: with both paths refused the reader says so and throws nothing');
  await h.ctx.close();
  // 4. short passages only: Psalm 119 selected whole is cut at 100 verses, with the notice
  h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Psalm 119');
  await h.page.locator('.yr-vn').first().click(); await h.page.locator('.yr-vn').last().click({ modifiers: ['Shift'] });
  const sel = await h.page.locator('.yr-sel-n').innerText();
  await h.page.locator('[data-act="copySel"]').click(); await h.page.waitForTimeout(300);
  const clip = await h.page.evaluate(() => navigator.clipboard.readText());
  const toast2 = await h.page.locator('.yr-toast').innerText();
  ok(/176 selected/.test(sel) && clip.split('\n')[0] === 'Psalms 119:1–100 (BSB, Yahweh edition)' && clip.includes('(Copy is limited to 100 verses; the rest were left out.)') && !/\n101 /.test(clip) && /first 100/.test(toast2), 'copy: all 176 verses of Psalm 119 selected -> 100 copied, the notice is in the text and in the toast', { sel, toast: toast2 });
  await h.ctx.close();
  // 5. Ctrl+C with verses selected copies them with the credit; a native text selection gets the credit appended
  h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=John 3');
  await h.page.locator('.yr-vn').nth(15).click();
  const viaEvent = await h.page.evaluate(() => { const dt = new DataTransfer(); const e = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }); document.querySelector('.yr-body').dispatchEvent(e); return { prevented: e.defaultPrevented, text: dt.getData('text/plain') }; });
  ok(viaEvent.prevented && viaEvent.text.startsWith('John 3:16 (BSB, Yahweh edition)'), 'copy: Ctrl/Cmd+C with a verse selected copies it as a citation');
  await h.page.keyboard.press('Escape');
  const nat = await h.page.evaluate(() => {
    const t = document.querySelector('[data-k="3016"] .yr-t'); const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const dt = new DataTransfer(); const e = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }); t.dispatchEvent(e); return dt.getData('text/plain');
  });
  ok(nat.startsWith('For God so loved the world') && !/^16/.test(nat) && nat.includes('BSB, Yahweh edition') && nat.includes('public domain (CC0)'), 'copy: a native text selection copies as plain text (no verse numbers) with the heading and credit appended', { nat: nat.slice(0, 80) });
  await h.ctx.close();
  // 6. parallel copy: every edition's line, labelled, credits once
  h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=John 3&par=bsb-yhwh,kjv,cuvs-yhwh&m=parallel');
  await h.page.locator('.yr-vn').nth(15).click(); await h.page.locator('[data-act="copySel"]').click(); await h.page.waitForTimeout(300);
  const pc = await h.page.evaluate(() => navigator.clipboard.readText());
  ok(/^John 3:16\n\n3:16\nBSB-Y\s+For God so loved/.test(pc) && /\nKJV\s+For God so loved/.test(pc) && /\n雅伟版　?\s*.*神爱世人/.test(pc) && pc.split('Berean Standard Bible, public domain').length === 2, 'copy: parallel copy lists every edition under the verse, labels lined up, each credit once', { head: pc.slice(0, 70) });
  await h.ctx.close();
  // 7. selection survives an edition switch; a verse the new edition lacks says so on copy
  h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Matthew 17');
  await h.page.locator('.yr-vn').nth(20).click();
  const keyBefore = await h.page.evaluate(() => document.querySelector('.is-sel')?.dataset.k);
  await h.page.locator('.yr-pill[data-act="edition"]').click(); await h.page.locator('.yr-sheet [data-id="kjv"]').click(); await h.page.waitForTimeout(500);
  const keyAfter = await h.page.evaluate(() => document.querySelector('.is-sel')?.dataset.k);
  ok(keyBefore === keyAfter && keyAfter != null, 'copy: the selection survives an edition switch', { keyBefore, keyAfter });
  await h.ctx.close();
}

async function editions() {
  const h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 1');
  const bsb = await h.page.locator('.yr-v .yr-t').nth(19).innerText();
  await h.page.evaluate(() => { document.querySelector('[data-k="1020"]').scrollIntoView({ block: 'start' }); });
  await h.page.evaluate(() => scrollBy(0, -80));
  const before = await h.page.evaluate(() => { const bar = document.querySelector('.yr-bar').getBoundingClientRect().height; return [...document.querySelectorAll('.yr-v')].find((e) => e.getBoundingClientRect().bottom > bar + 4)?.dataset.k; });
  const labels = [];
  for (const [id, label] of [['kjv', 'KJV'], ['web-yhwh', 'WEB'], ['asv-yhwh', 'ASV (Yahweh)'], ['rst-yhwh', 'СП (Яхве)'], ['cuvs-yhwh', '和合本雅伟版'], ['cuvs-yhwh-tr', '和合本雅偉版'], ['bsb-yhwh', 'BSB (Yahweh)']]) {
    await h.page.locator('.yr-pill[data-act="edition"]').click();
    await h.page.locator(`.yr-sheet [data-id="${id}"]`).click(); await h.page.waitForTimeout(350);
    const g = await h.page.evaluate(() => { const bar = document.querySelector('.yr-bar').getBoundingClientRect().height; return { pill: document.querySelector('.yr-pill span').textContent, top: [...document.querySelectorAll('.yr-v')].find((e) => e.getBoundingClientRect().bottom > bar + 4)?.dataset.k, lang: document.querySelector('.yr-v').lang, title: document.querySelector('.yr-title').textContent }; });
    labels.push(g.pill);
    ok(g.pill === label && Math.abs(Number(g.top) - Number(before)) <= 1, `editions: ${label} -> pill, ${g.lang} text, title "${g.title}", the same verse stays at the top (${before} -> ${g.top})`);
  }
  const final = await h.page.locator('.yr-v .yr-t').nth(19).innerText();
  ok(final === bsb, 'editions: back to BSB (Yahweh) the text is exactly what it was');
  // remembered across a reload
  await h.page.locator('.yr-pill[data-act="edition"]').click(); await h.page.locator('.yr-sheet [data-id="kjv"]').click(); await h.page.waitForTimeout(300);
  await h.page.reload(); await ready(h.page); await h.page.waitForSelector('.yr-v');
  ok((await h.page.locator('.yr-pill span').first().textContent()) === 'KJV', 'editions: the choice is remembered after a reload');
  // headings follow the edition's set
  await go(h, '/reader-demo.html?view=chapter&lang=zh-Hans#ref=Genesis 15&ed=cuvs-yhwh'); const zhH = await h.page.locator('.yr-h').first().textContent();
  await go(h, '/reader-demo.html?view=chapter&lang=zh-Hant#ref=Genesis 15&ed=cuvs-yhwh-tr'); const hantH = await h.page.locator('.yr-h').first().textContent();
  await go(h, '/reader-demo.html?view=chapter&lang=en#ref=Genesis 15&ed=kjv'); const enH = await h.page.locator('.yr-h').first().textContent();
  await go(h, '/reader-demo.html?view=chapter&lang=ru#ref=Genesis 15&ed=rst'); const ruH = await h.page.locator('.yr-h').first().textContent();
  ok(enH === 'God’s Covenant with Abram' && ruH === 'Завет Бога с Аврамом' && zhH.length > 1 && hantH.length > 1 && zhH !== enH, 'editions: section headings follow the edition (cuv, cuv-tr, english-classic, ru)', { zhH, hantH, enH, ruH });
  // parallel: first-time pairing, max 3, order, the main edition
  const h2 = await open();
  await go(h2, '/reader-demo.html?view=chapter&lang=en#ref=John 1');
  await h2.page.locator('[data-act="mode"][data-id="parallel"]').click(); await h2.page.waitForSelector('.yr-pv');
  const pair = await h2.page.evaluate(() => [...document.querySelector('.yr-pv').querySelectorAll('.yr-line')].map((l) => l.dataset.ed));
  ok(JSON.stringify(pair) === JSON.stringify(['bsb-yhwh', 'cuvs-yhwh']) && (await h2.page.locator('.yr-pill span').first().textContent()) === '对照 · 2'.replace('对照', 'Parallel'), 'parallel: first time on, an English reader gets BSB (Yahweh) + 和合本雅伟版; the pill reads Parallel · 2', { pair });
  await h2.page.locator('.yr-pill[data-act="edition"]').click();
  await h2.page.locator('.yr-sheet [data-act="toggle"][data-id="kjv"]').click();
  const full = await h2.page.locator('.yr-sheet [data-act="toggle"][aria-disabled="true"]').count();
  await h2.page.locator('.yr-sheet [data-act="toggle"][data-id="asv-yhwh"]').click({ force: true });
  const stillThree = await h2.page.locator('.yr-set-row').count();
  ok(full === 4 && stillThree === 3, 'parallel: at three editions the four other listed rows (the other Chinese script is folded away) are disabled with the reason, and a fourth is refused', { disabledRows: full, set: stillThree });
  await h2.page.locator('.yr-sheet [data-act="down"][data-id="bsb-yhwh"]').click();
  await h2.page.keyboard.press('Escape'); await h2.page.waitForTimeout(400);
  const order = await h2.page.evaluate(() => [...document.querySelector('.yr-pv').querySelectorAll('.yr-line')].map((l) => l.dataset.ed));
  ok(JSON.stringify(order) === JSON.stringify(['cuvs-yhwh', 'bsb-yhwh', 'kjv']), 'parallel: moving the main edition down reorders the lines and changes the main edition', { order });
  const g = await h2.page.evaluate(() => ({ title: document.querySelector('.yr-title').textContent, gaps: document.querySelectorAll('.yr-line.is-gap').length }));
  ok(g.title.startsWith('约翰福音'), 'parallel: the book is named in the main edition’s language', g);
  await h2.page.evaluate(() => { location.hash = '#ref=Matthew 17&par=kjv,bsb-yhwh&m=parallel'; }); await h2.page.waitForSelector('.yr-title:has-text("Matthew 17")');
  await h2.page.waitForTimeout(300);
  const gap = await h2.page.evaluate(() => { const row = document.querySelector('[data-k="17021"]'); return { lines: row.querySelectorAll('.yr-line').length, gap: row.querySelectorAll('.yr-line.is-gap').length, txt: row.querySelector('.is-gap .yr-t')?.textContent, sr: row.querySelector('.is-gap .yr-t')?.getAttribute('aria-label') }; });
  ok(gap.lines === 2 && gap.gap === 1 && gap.txt === '—' && /not in this edition/.test(gap.sr), 'parallel: Matthew 17:21, absent from the BSB, is a dash line labelled "not in this edition", not a shifted row', gap);
  await h.ctx.close(); await h2.ctx.close();
}

async function passage() {
  const h = await open();
  await go(h, '/reader-demo.html?view=passage&lang=en&b=1&from=15:1&to=15:21&limit=12');
  const n = await h.page.locator('.yr-v').count();
  const more = await h.page.locator('[data-act="expand"]').innerText();
  ok(n === 12 && more === 'Show the other 9 verses', 'passage: Genesis 15 shows 12 verses and "Show the other 9 verses"', { n, more });
  ok((await h.page.locator('.yr-h').first().textContent()) === 'God’s Covenant with Abram', 'passage: the heading the passage sits under is shown');
  await h.page.locator('[data-act="expand"]').click(); await h.page.waitForSelector('[data-act="collapse"]');
  ok((await h.page.locator('.yr-v').count()) === 21, 'passage: expand shows all 21');
  await h.page.locator('[data-act="parallelToggle"]').click(); await h.page.waitForSelector('.yr-pv');
  ok((await h.page.locator('.yr-pv').count()) === 21 && (await h.page.locator('[data-act="parallelToggle"]').getAttribute('aria-pressed')) === 'true', 'passage: the Parallel pill turns on interleaved lines (shared first-time pairing)');
  await h.page.locator('[data-act="whole"]').click();
  ok(/open chapter 1:15/.test(await h.page.locator('#info').innerText()), 'passage: "Read the whole chapter" calls the host’s onOpenChapter with the chapter');
  await h.ctx.close();
  // crossing a chapter
  const x = await open();
  await go(x, '/reader-demo.html?view=passage&lang=zh-Hans&b=1&from=15:19&to=16:3&limit=12');
  const g = await x.page.evaluate(() => ({ ch: [...document.querySelectorAll('.yr-ch')].map((e) => e.textContent), keys: [...document.querySelectorAll('.yr-v')].map((e) => e.dataset.k).join(',') }));
  ok(g.ch.length === 2 && g.ch[0] === '第 15 章' && g.ch[1] === '第 16 章' && g.keys === '15019,15020,15021,16001,16002,16003', 'passage: a passage across two chapters shows both, labelled', g);
  await x.page.locator('.yr-vn').nth(2).click(); await x.page.locator('.yr-vn').nth(3).click();
  await x.page.locator('[data-act="copySel"]').click(); await x.page.waitForTimeout(300);
  const clip = await x.page.evaluate(() => navigator.clipboard.readText());
  ok(clip.startsWith('创世记 15:21–16:1（和合本雅伟版）\n15:21 ') && clip.includes('\n16:1 '), 'passage: copying across the chapter break gives one heading and chapter-numbered lines', { first: clip.split('\n')[0] });
  await x.ctx.close();
}

async function notes() {
  const h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=zh-Hans#ref=Genesis 1');
  const fn = h.page.locator('.yr-fn').first();
  ok((await fn.count()) === 1, 'notes: Genesis 1 in the 和合本雅伟版 has its footnote marker');
  const id = await fn.getAttribute('aria-controls');
  ok(await h.page.locator(`#${id}`).isHidden(), 'notes: the note is hidden until asked for');
  await fn.focus(); await h.page.keyboard.press('Enter');
  ok((await fn.getAttribute('aria-expanded')) === 'true' && await h.page.locator(`#${id}`).isVisible() && /天空/.test(await h.page.locator(`#${id}`).innerText()), 'notes: Enter on the marker opens the note inline (keyboard reachable)');
  await h.page.keyboard.press('Enter');
  ok(await h.page.locator(`#${id}`).isHidden(), 'notes: pressing again closes it');
  // headings: the background note toggles
  await h.page.locator('.yr-hi').first().click();
  ok(await h.page.locator('.yr-ctx').first().isVisible(), 'headings: the (i) button opens the section’s background note');
  await h.ctx.close();
}

async function wording() {
  const banned = ['位格', '三位一体', '三位一體', '三一', '祂', 'trinit', 'triune', 'godhead', 'ипостас', 'троиц', 'воплощ', '1919'];
  for (const lang of LANGS) {
    const h = await open();
    const ref = { en: 'John 1', 'zh-Hans': 'John 1', 'zh-Hant': 'John 1', ru: 'John 1' }[lang];
    await go(h, `/reader-demo.html?view=chapter&lang=${lang}#ref=${ref}`);
    await h.page.locator('.yr-hi').first().click();
    await h.page.locator('[data-act="display"]').click();
    const text = (await h.page.evaluate(() => document.body.innerText)).toLowerCase();
    const hit = banned.find((b) => text.includes(b));
    ok(!hit, `wording ${lang}: John 1 as rendered (chrome, headings, notes, credit) carries no creedal vocabulary, no 祂, no year 1919`, hit ? { hit } : undefined);
    await h.ctx.close();
  }
  const h = await open();
  await go(h, '/reader-demo.html?view=chapter&lang=zh-Hant#ref=Psalm 23');
  const t = await h.page.evaluate(() => document.querySelector('.yr-credit').innerText + document.querySelector('.yr-body').innerText);
  ok(!t.includes('雅伟') && /雅偉/.test(t), 'wording zh-Hant: Traditional pages write 雅偉, never 雅伟');
  await h.ctx.close();
}

const cases = { basics, offline, slow, degraded, rtl, long, language, history, deeplinks, a11y, scale, copy, editions, passage, notes, wording };
const numbers = {};
for (const [name, fn] of Object.entries(cases)) {
  if (!want(name)) continue;
  console.log(`\n== ${name}`);
  try { const r = await fn(); if (r) numbers[name] = r; }
  catch (e) { ok(false, `${name}: threw ${e.message}`, String(e.stack).split('\n').slice(0, 3)); }
}
await browser.close();
server.close();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), chrome: browser.version?.() ?? 'chrome', passed: results.filter((r) => r.ok).length, failed: bad, numbers, results }, null, 1) + '\n');
console.log(`\n${results.length - bad}/${results.length} ok, ${bad} failed -> ${OUT.replace(ROOT + '/', '')}`);
process.exit(bad ? 1 : 0);
