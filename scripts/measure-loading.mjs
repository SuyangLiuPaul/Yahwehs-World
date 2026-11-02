// Loading measurements with realistic compression and a throttled phone.
//
//   node scripts/measure-loading.mjs [--dir dist] [--profile mobile|desktop|both]
//        [--pages /,/scenes.html,/bible.html,/figures.html,/plan.html] [--json out.json]
//        [--top] [--shifts]   (--shifts lists each layout shift with the elements that moved)
//
// It serves a built dist/ itself (so it never depends on `vite preview`, which
// sends no compression) and compresses text the way Netlify does: brotli when
// the browser accepts it. Bytes are reported both ways:
//   wire = bytes actually transferred (Content-Encoding applied)  <- what a reader pays
//   raw  = decoded bytes                                          <- what a parser sees
// "ready" is the moment the page's own #loading screen lifts (class "done"),
// or, on pages that have none, load + 500 ms. Google Fonts is blocked so the
// numbers do not move with a third party; the fonts are not in any budget here.
// The mobile profile: 390x844, 1.6 Mbit/s down, 150 ms RTT, CPU 4x slower.
// Single cold run per page (fresh context); treat differences under ~10% as noise.
import http from 'node:http';
import zlib from 'node:zlib';
import { readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1']] : a), []));
const DIR = resolve(ROOT, args.dir || 'dist');
const PROFILES = args.profile === 'desktop' ? ['desktop'] : args.profile === 'mobile' ? ['mobile'] : ['mobile', 'desktop'];
const PAGES = (args.pages || '/,/scenes.html,/bible.html,/figures.html,/plan.html').split(',');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.woff2': 'font/woff2' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.geojson', '.svg', '.bin']);
const cache = new Map();

function serve() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = join(DIR, p);
    if (!file.startsWith(DIR) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('nf'); return; }
    const ext = extname(file);
    let body = readFileSync(file);
    const h = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store', vary: 'Accept-Encoding' };
    const ae = String(req.headers['accept-encoding'] || '');
    if (COMPRESSIBLE.has(ext) && body.length > 1024) {
      const enc = ae.includes('br') ? 'br' : ae.includes('gzip') ? 'gzip' : null;
      if (enc) {
        const key = enc + file + statSync(file).mtimeMs;
        if (!cache.has(key)) cache.set(key, enc === 'br'
          ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })
          : zlib.gzipSync(body, { level: 6 }));
        body = cache.get(key);
        h['content-encoding'] = enc;
      }
    }
    h['content-length'] = body.length;
    res.writeHead(200, h); res.end(body);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const PROFILE = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, net: { latency: 150, down: (1.6 * 1e6) / 8, up: (0.75 * 1e6) / 8 }, cpu: 4 },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, net: { latency: 20, down: (50 * 1e6) / 8, up: (20 * 1e6) / 8 }, cpu: 1 },
};

async function measure(browser, base, page, profile) {
  const P = PROFILE[profile];
  const ctx = await browser.newContext({ viewport: P.viewport, deviceScaleFactor: P.deviceScaleFactor, isMobile: P.isMobile, hasTouch: P.hasTouch, serviceWorkers: 'block' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript(() => {
    localStorage.setItem('ydh.locale', 'en');
    window.__m = { fcp: null, cls: 0, shifts: [] };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__m.cls += e.value; window.__m.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(3), n: (e.sources || []).slice(0, 3).map((x) => { const n = x.node; return n ? (n.nodeName || '#') + (n.id ? '#' + n.id : '') + (n.className && n.className.baseVal === undefined ? '.' + String(n.className).split(' ')[0] : '') : '?'; }) }); } }).observe({ type: 'layout-shift', buffered: true });
  });
  const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: P.net.latency, downloadThroughput: P.net.down, uploadThroughput: P.net.up });
  if (P.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  const reqs = new Map(); const t0 = { v: null };
  cdp.on('Network.requestWillBeSent', (e) => { if (t0.v === null) t0.v = e.timestamp; reqs.set(e.requestId, { url: e.request.url.replace(base, ''), t: e.timestamp, raw: 0, wire: 0, done: null }); });
  cdp.on('Network.dataReceived', (e) => { const r = reqs.get(e.requestId); if (r) r.raw += e.dataLength; });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.wire = e.encodedDataLength; r.done = e.timestamp; } });
  const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
  const start = Date.now();
  await pg.goto(base + page, { waitUntil: 'commit' });
  const hasLoading = await pg.waitForSelector('#loading', { state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  let ready = null;
  if (hasLoading) {
    await pg.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 120000, polling: 100 }).catch(() => {});
    ready = Date.now() - start;
  } else { await pg.waitForLoadState('load'); await pg.waitForTimeout(500); ready = Date.now() - start; }
  const atReady = [...reqs.values()].filter((r) => r.done !== null);
  const m = await pg.evaluate(() => window.__m);
  await pg.waitForTimeout(1500); // let post-ready (lazy) requests land, reported separately
  const all = [...reqs.values()].filter((r) => r.done !== null);
  const sum = (a, k) => a.reduce((s, r) => s + r[k], 0);
  const out = {
    page, profile, readyMs: ready, fcpMs: m.fcp && Math.round(m.fcp), cls: +m.cls.toFixed(3), shifts: m.shifts, errors,
    requestsAtReady: atReady.length, wireAtReadyKB: Math.round(sum(atReady, 'wire') / 1024), rawAtReadyKB: Math.round(sum(atReady, 'raw') / 1024),
    requestsTotal: all.length, wireTotalKB: Math.round(sum(all, 'wire') / 1024), rawTotalKB: Math.round(sum(all, 'raw') / 1024),
    top: all.sort((a, b) => b.wire - a.wire).slice(0, 8).map((r) => `${(r.wire / 1024).toFixed(0)} KB wire / ${(r.raw / 1024).toFixed(0)} KB raw  ${r.url.slice(0, 70)}`),
  };
  await ctx.close();
  return out;
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const profile of PROFILES) for (const page of PAGES) {
    const r = await measure(browser, base, page, profile);
    results.push(r);
    console.log(`${profile.padEnd(8)} ${page.padEnd(15)} fcp ${String(r.fcpMs).padStart(5)} ms  ready ${String(r.readyMs).padStart(6)} ms  wire@ready ${String(r.wireAtReadyKB).padStart(5)} KB (raw ${String(r.rawAtReadyKB).padStart(5)})  total wire ${String(r.wireTotalKB).padStart(5)} KB (raw ${String(r.rawTotalKB).padStart(5)})  req ${r.requestsTotal}  cls ${r.cls}${r.errors.length ? '  ERR ' + r.errors[0] : ''}`);
    if (args.shifts) for (const sh of r.shifts) console.log(`      shift ${sh.v} at ${sh.t} ms  ${sh.n.join(' ')}`);
    if (args.top) for (const t of r.top) console.log('      ' + t);
  }
} finally { await browser.close(); server.close(); }
if (args.json) writeFileSync(resolve(args.json), JSON.stringify(results, null, 1));
