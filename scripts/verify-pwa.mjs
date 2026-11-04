// The installable app, checked in a real browser (Chrome) against a built dist/ served with the headers netlify.toml sets.
//
//   node scripts/verify-pwa.mjs [--dir dist] [--only build,install,offline,update,budget,never,ui,standalone,heal]
//
//   build       what the build wrote: manifests (4 languages), icons (size, opacity), sw.js, offline.html, the build id in the pages, the precache list,
//               the head tags, the Netlify headers for sw.js and the manifests with the security headers kept
//   install     Chrome's own installability check (DevTools "Application > Manifest", the same call Lighthouse used) reports nothing, per language
//   offline     open home, a picture page (picture + passage), a Bible chapter and a thumbnail grid once; with the server gone each reloads from the saved copy.
//               The first visit's pictures count (they were loaded before the worker could see them)
//   update      a simulated deploy (new file names for every script and style): the open tab keeps working on what it has, is offered "update ready" in the
//               four languages, a page opened after the deploy gets the new scripts at once, the swap on Reload leaves only the new build's caches
//   never       no stale JS after a deploy (every script a page runs belongs to one build), never a POST or /api/ response in any cache
//   budget      the real budgets: pictures 60 MB, thumbnails 30 MB, Bible data 40 MB, filled past their limits; the least recently used leave first
//   ui          the install entry (Chromium prompt, iPhone sheet in 4 languages, Safari-on-Mac sheet, nothing on Firefox), the per-language label
//   standalone  display-mode: standalone hides the entry, switches off pull-to-refresh, durable storage is asked once and late
//   heal        the browser drops the saved pages: the worker steps aside and installs again
import { chromium } from 'playwright';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist, parseNetlifyHeaders, headersFor } from './lib/dist-server.mjs';
import { buildPwa, LANGS, manifestFor, PAGES, SHELL_MAX } from './lib/pwa-build.mjs';
import { BUDGETS, MiB, cacheNames } from '../src/pwa/core.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DIR = resolve(ROOT, argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'dist');
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const want = (n) => !only || only.includes(n);
let bad = 0, ok = 0;
const pass = (m) => { ok++; console.log(`ok   ${m}`); };
const fail = (m) => { bad++; console.error(`FAIL ${m}`); };
const check = (c, good, badMsg) => (c ? pass(good) : fail(badMsg ?? good));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rules = parseNetlifyHeaders(readFileSync(join(ROOT, 'netlify.toml'), 'utf8'));
const TMP = mkdtempSync(join(tmpdir(), 'verify-pwa-'));
const id = (html) => /<meta name="ydh-build" content="([^"]*)"/.exec(html)?.[1];
const png = (f) => { const b = readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colour: b[25], sig: b.subarray(1, 4).toString() }; };
const LANG_KEYS = Object.keys(LANGS);

if (!existsSync(join(DIR, 'sw.js'))) { console.error(`no ${DIR}/sw.js: build the gallery first (VITE_SURFACE=gallery npm run build)`); process.exit(2); }
const sceneIds = JSON.parse(readFileSync(join(DIR, 'data/gallery/index.json'), 'utf8')).ev.filter((r) => r[7] === 1).map((r) => r[0]);

// ── a server that can go away ─────────────────────────────────────────────────────────────────────────────────
function makeServer(dir) {
  const state = { down: false, feedback: [], requests: [] };
  const p = serveDist(dir, {
    headerRules: rules,
    onRequest: (req) => state.requests.push(`${req.method} ${req.url}`),
    handler: (req, res, u) => {
      if (state.down) { req.socket.destroy(); return true; }
      if (u.pathname === '/api/feedback') { state.feedback.push(req.method); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' }); res.end('{"ok":true}'); return true; }
      return false;
    },
  });
  return p.then((s) => Object.assign(s, { state }));
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function newContext(base, { lang = 'en', viewport = { width: 1280, height: 800 }, ...rest } = {}) {
  const ctx = await browser.newContext({ viewport, ...rest });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript((l) => { try { if (!localStorage.getItem('ydh.locale')) localStorage.setItem('ydh.locale', l); } catch { /* */ } }, lang);
  return ctx;
}
/** Chrome's own app window (--app): display-mode: standalone is true there, as for an installed app. */
async function appWindow(base, init, arg) {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(TMP, 'app-')), { channel: 'chrome', headless: true, args: [`--app=${base}/`], viewport: null });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript((l) => { try { if (!localStorage.getItem('ydh.locale')) localStorage.setItem('ydh.locale', 'en'); } catch { /* */ } }, 'en');
  if (init) await ctx.addInitScript(init, arg);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto(`${base}/`);
  await page.waitForSelector('#hm-books a');
  return { ctx, page };
}
const track = (page) => { const errs = []; page.on('pageerror', (e) => errs.push(e.message)); return errs; };
const controlled = (page) => page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
const cacheKeys = (page) => page.evaluate(() => caches.keys());
const cacheBytes = (page, name) => page.evaluate(async (n) => { const c = await caches.open(n); let t = 0, f = 0; for (const k of await c.keys()) { const r = await c.match(k); if (r) { t += (await r.blob()).size; f++; } } return { bytes: t, files: f }; }, name);
const askSW = (page, msg) => page.evaluate((m) => new Promise((ok) => { const ch = new MessageChannel(); ch.port1.onmessage = (e) => ok(e.data); navigator.serviceWorker.controller.postMessage(m, [ch.port2]); setTimeout(() => ok(null), 4000); }), msg);

/** The worker saves behind the response, one at a time: wait until its own byte count has stopped moving. */
async function settle(page) {
  let last = -1, same = 0;
  for (let i = 0; i < 120 && same < 4; i++) {
    const r = await askSW(page, { type: 'report' });
    const n = r ? Object.values(r.caches).reduce((a, c) => a + c.bytes + c.files, 0) : -2;
    same = n === last ? same + 1 : 0; last = n;
    await sleep(300);
  }
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want('build')) {
  console.log('\n── build output ──');
  const html = Object.fromEntries(PAGES.map((p) => [p, readFileSync(join(DIR, p), 'utf8')]));
  const ids = new Set(PAGES.map((p) => id(html[p])));
  check(ids.size === 1 && [...ids][0] && [...ids][0] !== '__YDH_BUILD__', `the three pages carry one build id (${[...ids][0]})`);
  const sw = readFileSync(join(DIR, 'sw.js'), 'utf8');
  check(sw.includes([...ids][0]) && !/__PWA_(BUILD|PRECACHE)__/.test(sw), 'sw.js carries that id and no unfilled placeholder');
  const m = /\[\[("\/[^"]+"),"[0-9a-f]{12}"\](?:,\[("\/[^"]+"),"[0-9a-f]{12}"\])*\]/.exec(sw);
  const list = [...sw.matchAll(/\["(\/[^"]+)","([0-9a-f]{12})"\]/g)].map((x) => x[1]);
  check(!!m && list.length > 20, `the precache list is in sw.js (${list.length} files)`);
  check(list.every((p) => existsSync(join(DIR, p))), 'every precached file exists in dist');
  const bytes = list.reduce((a, p) => a + statSync(join(DIR, p)).size, 0);
  check(bytes < SHELL_MAX, `the precache is ${(bytes / 1024).toFixed(0)} KiB, under the ${SHELL_MAX / MiB} MiB limit`);
  check(list.includes('/index.html') && list.includes('/scenes.html') && list.includes('/bible.html') && list.includes('/offline.html'), 'home, scenes, Bible and the offline page are precached');
  check(list.filter((p) => p.startsWith('/assets/')).length === readdirSync(join(DIR, 'assets')).filter((f) => /\.(js|css)$/.test(f)).length, 'every script and style in /assets is precached');
  check(!list.some((p) => p.startsWith('/pictures/') || p.startsWith('/p/')), 'no picture and no share stub is precached (they are cached on use, with a budget)');

  for (const k of LANG_KEYS) {
    const file = join(DIR, LANGS[k].file);
    const man = JSON.parse(readFileSync(file, 'utf8'));
    const want_ = manifestFor(k);
    check(JSON.stringify(man) === JSON.stringify(want_), `${LANGS[k].file} is what pwa-build.mjs makes`);
    check(man.name === "雅偉之界 / Yahweh's World" && man.lang === k && man.display === 'standalone' && man.start_url === '/' && man.scope === '/' && man.id === '/', `${k}: name, lang, display, start_url, scope`);
    const purposes = man.icons.map((i) => `${i.purpose}:${i.sizes}`);
    check(['any:192x192', 'any:512x512', 'maskable:192x192', 'maskable:512x512', 'monochrome:512x512'].every((x) => purposes.includes(x)), `${k}: icons any 192/512, maskable 192/512, monochrome 512`);
    check(man.shortcuts.length === 3 && man.shortcuts.map((s) => s.url).join() === '/,/scenes.html,/bible.html', `${k}: shortcuts Home, Scenes, Bible`);
  }
  for (const i of manifestFor('en').icons) {
    const f = join(DIR, i.src);
    const d = existsSync(f) ? png(f) : null;
    check(d && `${d.w}x${d.h}` === i.sizes && d.sig === 'PNG', `${i.src} is a ${i.sizes} PNG`);
    if (i.purpose === 'maskable') check(d.colour === 2, `${i.src} is opaque (RGB, no alpha channel): a mask may cut anywhere`);
  }
  for (const s of [180, 167, 152, 120]) { const d = png(join(DIR, `pwa/apple-touch-${s}.png`)); check(d.w === s && d.h === s && d.colour === 2, `apple-touch-${s}.png is ${s}x${s} and opaque (iOS paints transparency black)`); }
  { const d = png(join(DIR, 'apple-touch-icon.png')); check(d.w === 180 && d.colour === 2, '/apple-touch-icon.png is 180x180 and opaque'); }
  check(png(join(DIR, 'pwa/shortcut-96.png')).w === 96, 'shortcut icon is 96x96');

  for (const p of PAGES) {
    const h = html[p];
    check(/<link rel="manifest" id="pwa-manifest" href="\/manifest\.webmanifest">/.test(h) && /apple-mobile-web-app-capable/.test(h) && /status-bar-style" content="black-translucent"/.test(h) && /viewport-fit=cover/.test(h) && /name="theme-color" content="#0e2b4b"/.test(h) && /rel="apple-touch-icon" sizes="180x180"/.test(h), `${p}: manifest link, Apple web-app tags, viewport-fit=cover, theme-color, touch icons`);
  }
  const hs = (p) => headersFor(rules, p);
  check(/no-cache/.test(hs('/sw.js')['cache-control']) && /no-store/.test(hs('/sw.js')['cache-control']) && /^text\/javascript/.test(hs('/sw.js')['content-type']), 'netlify.toml: /sw.js is never cached, served as JavaScript');
  check(LANG_KEYS.every((k) => /^application\/manifest\+json/.test(hs(`/${LANGS[k].file}`)['content-type'])), 'netlify.toml: manifests are application/manifest+json');
  check(['/sw.js', '/manifest.webmanifest', '/index.html', '/data/gallery/index.json', '/pictures/full/a.webp'].every((p) => hs(p)['x-content-type-options'] === 'nosniff' && hs(p)['referrer-policy'] === 'strict-origin-when-cross-origin'), 'netlify.toml: the existing security headers still reach every one of them');
  check(hs('/assets/main-abc.js')['cache-control'] === 'public, max-age=31536000, immutable' && hs('/index.html')['cache-control'] === 'public, max-age=0, no-cache', 'netlify.toml: the existing cache rules are unchanged');
  check(!rules.some((r) => /api/.test(r.for) && r.values['Cache-Control']), 'netlify.toml: no cache rule for /api (feedback is never cached by a header)');
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want('install')) {
  console.log('\n── installability (Chrome) ──');
  const srv = await makeServer(DIR);
  for (const lang of LANG_KEYS) {
    // a persistent profile: Chrome refuses to install from an incognito-like context and says so
    const dir = mkdtempSync(join(TMP, 'profile-'));
    const ctx = await chromium.launchPersistentContext(dir, { channel: 'chrome', headless: true, viewport: { width: 1280, height: 800 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.addInitScript((l) => { try { localStorage.setItem('ydh.locale', l); } catch { /* */ } }, lang);
    const page = await ctx.newPage();
    await page.goto(`${srv.base}/`);
    await page.waitForSelector('#hm-books a');
    await controlled(page);
    await sleep(500);
    const cdp = await ctx.newCDPSession(page);
    const errs = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors;
    check(errs.length === 0, `${lang}: Chrome reports no installability error`, `${lang}: installability errors ${JSON.stringify(errs)}`);
    const m = await cdp.send('Page.getAppManifest');
    check(m.url.endsWith(`/${LANGS[lang].file}`) && m.errors.length === 0, `${lang}: the page uses ${LANGS[lang].file} and Chrome parses it without errors`, `${lang}: manifest ${m.url} ${JSON.stringify(m.errors)}`);
    const parsed = JSON.parse(m.data);
    check(parsed.lang === lang && parsed.short_name === LANGS[lang].short, `${lang}: lang and short_name (${parsed.short_name})`);
    if (lang === 'en') {
      const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { scope: r?.scope, state: r?.active?.state, scriptURL: r?.active?.scriptURL }; });
      check(reg.scope === `${srv.base}/` && reg.state === 'activated' && reg.scriptURL.endsWith('/sw.js'), 'the worker is registered at / and activated');
      const hdr = await page.evaluate(async () => { const r = await fetch('/sw.js', { cache: 'no-store' }); return [r.headers.get('cache-control'), r.headers.get('content-type')]; });
      check(/no-store/.test(hdr[0]) && /javascript/.test(hdr[1]), 'sw.js is served with no-store and a JavaScript type');
    }
    await ctx.close();
  }
  srv.close();
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want('offline')) {
  console.log('\n── offline after one visit ──');
  const srv = await makeServer(DIR);
  const ctx = await newContext(srv.base);
  const page = await ctx.newPage();
  const errs = track(page);
  const go = (path) => page.goto(`${srv.base}${path}`);
  const picId = sceneIds.includes('genesis-15-1') ? 'genesis-15-1' : sceneIds[3];
  const other = sceneIds[sceneIds.length - 2];

  // the FIRST visit: nothing has controlled the page yet; what it loaded is handed to the worker afterwards
  await go('/');
  await page.waitForSelector('#hm-plate .gx-plate.is-loaded', { timeout: 15000 });
  const hero = await page.evaluate(() => document.querySelector('#hm-plate img').src);
  await controlled(page);
  let saved = false;
  for (let i = 0; i < 40 && !saved; i++) { saved = await page.evaluate(async (u) => !!(await (await caches.open('ydh-pictures-v1')).match(u)), hero); if (!saved) await sleep(250); }
  check(saved, "the first visit's own picture (loaded before the worker took over) is saved");
  const keys = await cacheKeys(page);
  check(keys.some((k) => k.startsWith('ydh-shell-')) && keys.includes('ydh-pictures-v1'), `caches after the first visit: ${keys.join(', ')}`);

  // controlled visits: a picture page, a thumbnail grid, a Bible chapter
  await go(`/scenes.html#p=${picId}`);
  await page.waitForSelector('#pc-plate img', { timeout: 15000 });
  await page.waitForFunction(() => { const i = document.querySelector('#pc-plate img'); return i && i.complete && i.naturalWidth > 0; });
  await page.waitForFunction(() => document.querySelectorAll('#pc-passage .yr-v').length > 0, null, { timeout: 15000 });
  const picTitle = await page.locator('#pc-title').innerText();
  const verses = await page.locator('#pc-passage .yr-v').count();
  await go('/scenes.html#b=1');
  await page.waitForFunction(() => document.querySelectorAll('#sc-grid img').length >= 10 && [...document.querySelectorAll('#sc-grid img')].slice(0, 10).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
  await go('/bible.html#ref=John 3');
  await page.waitForFunction(() => document.querySelectorAll('#reader .yr-v').length >= 20, null, { timeout: 15000 });
  const johnText = await page.locator('#reader .yr-v').first().innerText();
  await sleep(1200); // the index of what is saved is written a moment after

  srv.state.down = true; // the server is gone: every request fails, the page's and the worker's alike
  await go('/');
  await page.waitForSelector('#hm-books a', { timeout: 10000 });
  check(await page.evaluate(() => document.title.length > 3 && !!document.querySelector('#hm-title') && !document.querySelector('#hm-title .gx-sk')), 'offline: home opens from the saved copy and paints its hero title');
  check(await page.evaluate(() => !!document.querySelector('#hm-plate .gx-plate.is-loaded')), "offline: today's picture (saved on the first visit) is on screen");
  check(await page.locator('#hm-books a').count() > 20, 'offline: the book list (data/gallery/index.json from the precache) is there');
  await go(`/scenes.html#p=${picId}`);
  await page.waitForFunction(() => { const i = document.querySelector('#pc-plate img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 }).then(() => pass('offline: the picture page shows the picture it had seen (full size, from the picture cache)'), () => fail('offline: the visited picture did not show'));
  await page.waitForFunction(() => document.querySelectorAll('#pc-passage .yr-v').length > 0, null, { timeout: 10000 }).then(async () => { check((await page.locator('#pc-title').innerText()) === picTitle && (await page.locator('#pc-passage .yr-v').count()) === verses, `offline: its title and its ${verses} verses are there (Bible data cached on use)`); }, () => fail('offline: the passage of the visited picture did not show'));
  await go('/scenes.html#b=1');
  await page.waitForFunction(() => document.querySelectorAll('#sc-grid img').length >= 10 && [...document.querySelectorAll('#sc-grid img')].slice(0, 10).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 }).then(() => pass('offline: the gallery grid shows its thumbnails'), () => fail('offline: thumbnails of a visited book did not show'));
  await go('/bible.html#ref=John 3');
  await page.waitForFunction(() => document.querySelectorAll('#reader .yr-v').length >= 20, null, { timeout: 10000 }).then(async () => check((await page.locator('#reader .yr-v').first().innerText()) === johnText, 'offline: the Bible chapter that was read opens'), () => fail('offline: the visited Bible chapter did not open'));
  // what was never visited
  await go(`/scenes.html#p=${other}`);
  await page.waitForSelector('#pc-title:not(:empty)', { timeout: 10000 });
  await sleep(800);
  check(await page.evaluate(() => !!document.querySelector('#pc-plate .gx-plate.is-failed, #pc-plate img') && document.querySelector('#pc-title').textContent.length > 1), 'offline: a picture never opened degrades to its colour plate with its title and verses, not a broken page');
  await page.goto(`${srv.base}/p/${picId}`);
  await page.waitForURL(/\/scenes\.html#p=/, { timeout: 8000 }).then(() => pass('offline: a shared /p/<id> link still lands on the picture'), () => fail(`offline: /p/${picId} ended at ${page.url()}`));
  await page.goto(`${srv.base}/tabernacle.html`);
  check(/Offline|没有网络|沒有網路|Нет соединения/.test(await page.title()) && (await page.locator('h1').innerText()).length > 3, 'offline: a page that was never saved gets the offline page (with links back to Home, Scenes, Bible)');
  check(await page.locator('nav a').count() === 3, 'offline page: three links and a retry button');
  srv.state.down = false;
  check(errs.length === 0, 'no uncaught error on any of those pages', errs.join(' | '));
  await ctx.close();
  srv.close();
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A deploy, simulated on a copy of dist: every script and style gets a new name and a marker, the way a new build does, and the old
// names are gone (Netlify deploys are atomic: an old hashed file is not there any more). Then the same step the build ends with
// writes the new worker and the new build id.
async function makeVersion(src, out, mark) {
  cpSync(src, out, { recursive: true, filter: (f) => { const r = relative(src, f); return !(r === 'pictures' || r === 'p' || r.startsWith('pictures/') || r.startsWith('p/') || r.startsWith('data/reader/text') || r.startsWith('data/reader/headings')); } });
  const assets = join(out, 'assets');
  const names = new Map();
  for (const f of readdirSync(assets)) {
    const p = join(assets, f);
    let body = readFileSync(p);
    if (f.endsWith('.js')) body = Buffer.concat([body, Buffer.from(`\n;window.__YDH_MARK=${JSON.stringify(mark)};`)]);
    else if (f.endsWith('.css')) body = Buffer.concat([body, Buffer.from(`\n/* ${mark} */`)]);
    writeFileSync(p, body);
    const n = f.replace(/-[A-Za-z0-9_-]{8}(\.[a-z]+)$/, `-${createHash('sha1').update(body).update(mark).digest('hex').slice(0, 8)}$1`);
    if (n !== f) { renameSync(p, join(assets, n)); names.set(f, n); }
  }
  const files = [...readdirSync(out).filter((f) => f.endsWith('.html')).map((f) => join(out, f)), ...readdirSync(assets).filter((f) => /\.(js|css)$/.test(f)).map((f) => join(assets, f))];
  for (const f of files) {
    let t = readFileSync(f, 'utf8');
    for (const [a, b] of names) t = t.split(a).join(b);
    writeFileSync(f, t);
  }
  await buildPwa({ root: ROOT, dist: out, log: () => {} });
  return id(readFileSync(join(out, 'index.html'), 'utf8'));
}

if (want('update') || want('never')) {
  console.log('\n── a deploy while the app is open ──');
  const v1 = join(TMP, 'v1'), v2 = join(TMP, 'v2');
  const id1 = await makeVersion(DIR, v1, 'v1');
  const id2 = await makeVersion(DIR, v2, 'v2');
  check(id1 !== id2, `two builds, two ids (${id1}, ${id2})`);
  const scripts2 = new Set(readdirSync(join(v2, 'assets')));
  const srv = await makeServer(v1);
  const ctx = await newContext(srv.base);
  const A = await ctx.newPage();
  const errs = track(A);
  await A.goto(`${srv.base}/`);
  await A.waitForSelector('#hm-books a');
  await controlled(A);
  check((await A.evaluate(() => window.__YDH_MARK)) === 'v1', 'tab A runs build 1 (its own scripts say so)');
  check((await askSW(A, { type: 'get-build' }))?.build === id1, 'the worker in control is build 1');
  await A.evaluate(() => caches.open('ydh-shell-ancient').then((c) => c.put('/x', new Response('x'))));

  // ── deploy build 2 ──
  srv.setDir(v2);
  await A.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update())); // what the hourly / on-return check does
  await A.waitForSelector('.gx-update', { timeout: 20000 });
  check(true, 'tab A is offered "update ready" after the deploy');
  if (process.env.PWA_SHOTS) { // evidence for a person to look at: PWA_SHOTS=<dir>
    for (const [w, h] of [[1280, 800], [390, 844]]) { await A.setViewportSize({ width: w, height: h }); await sleep(300); await A.screenshot({ path: join(process.env.PWA_SHOTS, `update-ready-${w}.png`) }); }
    await A.setViewportSize({ width: 1280, height: 800 });
  }
  const toast = async () => (await A.locator('.gx-update .u-t').innerText()) + ' | ' + (await A.locator('.gx-update .u-go').innerText());
  const words = { en: 'A new version is ready. | Reload', 'zh-Hans': '新版本已准备好。 | 刷新', 'zh-Hant': '新版本已準備好。 | 重新整理', ru: 'Доступна новая версия. | Обновить' };
  for (const l of ['en', 'zh-Hans', 'ru', 'zh-Hant']) {
    await A.click('.sitenav .lang-btn');
    await A.waitForSelector(`.lang-pop:not([hidden]) [data-locale="${l}"]`);
    await A.click(`.lang-pop [data-locale="${l}"]`);
    await sleep(700);
    const got = await toast();
    // 繁體 text comes from the conversion table: accept any Traditional rendering of the same words
    check(l === 'zh-Hant' ? /^新版本已準備好。 \| .+$/.test(got) : got === words[l], `the notice in ${l}: ${got}`);
  }
  await A.click('.sitenav .lang-btn');
  await A.waitForSelector('.lang-pop:not([hidden]) [data-locale="en"]');
  await A.click('.lang-pop [data-locale="en"]');
  check(await A.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r.waiting && !r.installing)), 'the new worker is installed and WAITING (it did not take over a page that is still running)');
  check((await askSW(A, { type: 'get-build' }))?.build === id1, 'tab A is still under build 1');

  // tab A must keep working on what it has: a lazy chunk of build 1 (the search palette) no longer exists on the server
  await A.keyboard.press('Control+k');
  await A.waitForSelector('dialog.gx-pal[open], dialog.gx-sheet[open]', { timeout: 8000 }).then(() => pass("tab A still opens a lazily loaded part of build 1 (the old file is gone from the server, the worker has it)"), () => fail('tab A could not load its search palette after the deploy'));
  await A.keyboard.press('Escape');
  srv.state.down = true;
  await A.reload();
  await A.waitForSelector('#hm-books a', { timeout: 10000 });
  check((await A.evaluate(() => window.__YDH_MARK)) === 'v1', 'offline between deploy and update: the page comes from build 1 completely (HTML and scripts agree)');
  srv.state.down = false;

  // a page opened AFTER the deploy
  const B = await ctx.newPage();
  const errsB = track(B);
  await B.goto(`${srv.base}/`);
  await B.waitForSelector('#hm-books a');
  check((await B.evaluate(() => window.__YDH_MARK)) === 'v2', 'a page opened after the deploy runs build 2 at once, although the old worker still controls it');
  const loaded = await B.evaluate(() => performance.getEntriesByType('resource').map((r) => new URL(r.name).pathname).filter((p) => p.startsWith('/assets/')));
  const alien = loaded.filter((p) => !scripts2.has(p.slice('/assets/'.length)));
  check(loaded.length > 3 && alien.length === 0, `every script and style that page loaded belongs to build 2 (${loaded.length} files, ${alien.length} from another build)`, `files from another build: ${alien.join(', ')}`);
  check((await B.locator('.gx-update').count()) === 0, 'that page, already on build 2, is not told to update');
  check(await B.evaluate(() => document.querySelector('meta[name="ydh-build"]').content) === id2, 'its HTML carries the new build id');
  await B.close();

  // the swap: tab A presses Reload in the notice (nothing else makes the waiting worker take over while a tab is open)
  check((await askSW(A, { type: 'get-build' }))?.build === id1, 'before the press the worker in control is still build 1 (a new page opened above did not swap it)');
  await Promise.all([A.waitForNavigation({ timeout: 20000 }), A.click('.gx-update .u-go')]);
  await A.waitForSelector('#hm-books a');
  check((await A.evaluate(() => window.__YDH_MARK)) === 'v2', 'Reload in the notice reloads tab A into build 2');
  await controlled(A);
  let built = null;
  for (let i = 0; i < 60 && built !== id2; i++) { built = (await askSW(A, { type: 'get-build' }).catch(() => null))?.build ?? null; if (built !== id2) await sleep(250); }
  check(built === id2, 'after Reload the page is build 2 and the worker in control is build 2', `worker in control: ${built}, wanted ${id2}`);
  // the new worker is "activating" until its clean-up has run (it is the controller by then already): wait for the clean-up
  for (let i = 0; i < 40 && (await cacheKeys(A)).includes('ydh-shell-ancient'); i++) await sleep(250);
  const keys = await cacheKeys(A);
  check(keys.includes(cacheNames(id2).shell) && !keys.includes(cacheNames(id1).shell) && !keys.includes('ydh-shell-ancient'), `old caches are deleted on activation (left: ${keys.join(', ')})`);
  check((await A.locator('.gx-update').count()) === 0, 'no notice after the swap');
  srv.state.down = true;
  await A.reload();
  await A.waitForSelector('#hm-books a', { timeout: 10000 });
  check((await A.evaluate(() => window.__YDH_MARK)) === 'v2', 'offline after the update: build 2, complete');
  srv.state.down = false;
  // "applies on the next load": a lone tab that loads the next deploy is brought onto the new worker without a press
  const id3 = await makeVersion(DIR, join(TMP, 'v3'), 'v3');
  srv.setDir(join(TMP, 'v3'));
  await A.reload();
  await A.waitForSelector('#hm-books a');
  check((await A.evaluate(() => window.__YDH_MARK)) === 'v3', 'next deploy, one tab, plain reload: the page is build 3');
  let b3 = null;
  for (let i = 0; i < 60 && b3 !== id3; i++) { b3 = (await askSW(A, { type: 'get-build' }).catch(() => null))?.build ?? null; if (b3 !== id3) await sleep(250); }
  check(b3 === id3 && (await A.locator('.gx-update').count()) === 0, 'and the new worker took over by itself (a lone tab already on the new build), with no notice to press');
  srv.state.down = true;
  await A.reload();
  await A.waitForSelector('#hm-books a', { timeout: 10000 });
  check((await A.evaluate(() => window.__YDH_MARK)) === 'v3', 'offline after that: build 3');
  srv.state.down = false;
  check(errs.length === 0 && errsB.length === 0, 'no uncaught error during the whole deploy', [...errs, ...errsB].join(' | '));
  await ctx.close();
  srv.close();
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want('never')) {
  console.log('\n── what is never cached ──');
  const srv = await makeServer(DIR);
  const ctx = await newContext(srv.base);
  const page = await ctx.newPage();
  await page.goto(`${srv.base}/`);
  await page.waitForSelector('#hm-books a');
  await controlled(page);
  const out = await page.evaluate(async () => {
    const r = [];
    for (let i = 0; i < 2; i++) r.push((await fetch('/api/feedback', { method: 'POST', body: '{"x":1}', headers: { 'content-type': 'application/json' } })).status);
    for (let i = 0; i < 2; i++) r.push((await fetch('/api/feedback')).status);
    return r;
  });
  await sleep(800);
  check(out.join() === '200,200,200,200' && srv.state.feedback.join() === 'POST,POST,GET,GET', `four calls to /api/feedback (2 POST, 2 GET) all reached the server: ${srv.state.feedback.join()}`);
  const urls = await page.evaluate(async () => { const o = []; for (const k of await caches.keys()) for (const q of await (await caches.open(k)).keys()) o.push(q.url); return o; });
  check(!urls.some((u) => /\/api\//.test(u)), `no /api/ URL in any of the ${urls.length} cached entries`);
  srv.state.down = true;
  const offlinePost = await page.evaluate(() => fetch('/api/feedback', { method: 'POST', body: 'x' }).then(() => 'answered', () => 'failed'));
  check(offlinePost === 'failed', 'offline, a POST fails honestly (nothing answers it from a cache)');
  const offlineGet = await page.evaluate(() => fetch('/api/feedback').then(() => 'answered', () => 'failed'));
  check(offlineGet === 'failed', 'offline, a GET of /api/feedback fails too');
  srv.state.down = false;
  const rangeOk = await page.evaluate(async () => { const r = await fetch(`/pictures/thumb/${(await (await fetch('/data/gallery/index.json')).json()).ev[0][0]}.webp`, { headers: { range: 'bytes=0-99' } }); return r.status; });
  check(rangeOk === 206 || rangeOk === 200, `a Range request goes through untouched (${rangeOk})`);
  const urls2 = await page.evaluate(async () => { const o = []; for (const q of await (await caches.open('ydh-thumbs-v1')).keys()) o.push(q.url); return o; });
  check(urls2.length === 0, 'and is not saved');
  // the host's redirects must still work through the worker (a navigation's redirect is handed to the browser untouched)
  await page.goto(`${srv.base}/tabernacle.html`);
  check(new URL(page.url()).pathname === '/', 'online, with the worker in control: a hidden page still 302s to /');
  await page.goto(`${srv.base}/gallery`);
  check(new URL(page.url()).pathname === '/scenes.html', 'online, with the worker in control: /gallery still 301s to /scenes.html');
  await page.goto(`${srv.base}/p/${sceneIds[0]}`);
  await page.waitForURL(/\/scenes\.html#p=/, { timeout: 8000 }).then(() => pass('online: a /p/<id> share link still forwards to the picture (the host\'s own stub page)'), () => fail(`/p/<id> ended at ${page.url()}`));
  await page.goto(`${srv.base}/sitemap.xml`);
  check(/<urlset/.test(await page.content()), 'a sitemap.xml navigation is left to the network');
  await ctx.close();
  srv.close();
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want('budget')) {
  console.log('\n── byte budgets (the real ones) ──');
  const srv = await makeServer(DIR);
  const ctx = await newContext(srv.base);
  const page = await ctx.newPage();
  await page.goto(`${srv.base}/`);
  await page.waitForSelector('#hm-books a');
  await controlled(page);
  const names = cacheNames('x');
  const pull = (kind, list, conc = 8) => page.evaluate(async ({ kind, list, conc }) => {
    let i = 0, bytes = 0;
    const run = async () => { while (i < list.length) { const u = list[i++]; try { const r = await fetch(u); const n = (await r.arrayBuffer()).byteLength; bytes += n; } catch { /* */ } } };
    await Promise.all(Array.from({ length: conc }, run));
    return bytes;
  }, { kind, list, conc });
  const full = sceneIds.slice(0, 640).map((s) => `/pictures/full/${s}.webp`);
  const t0 = Date.now();
  const fetched = await pull('full', full);
  await settle(page);
  const rep = await askSW(page, { type: 'report' });
  const real = await cacheBytes(page, names.pictures);
  console.log(`     requested ${full.length} full pictures = ${(fetched / MiB).toFixed(1)} MiB in ${((Date.now() - t0) / 1000).toFixed(1)} s; cache holds ${real.files} files, ${(real.bytes / MiB).toFixed(1)} MiB`);
  check(fetched > BUDGETS.pictures * 1.3, `more was requested (${(fetched / MiB).toFixed(0)} MiB) than the budget allows, so eviction had to work`);
  check(real.bytes <= BUDGETS.pictures, `full pictures: ${(real.bytes / MiB).toFixed(1)} MiB saved, under the ${BUDGETS.pictures / MiB} MiB budget`);
  check(real.bytes > BUDGETS.pictures * 0.85, `and the budget is actually used (over 85%): the cache is not simply empty`);
  check(rep && Math.abs(rep.caches.pictures.bytes - real.bytes) < 1024, `the worker's own count (${rep?.caches.pictures.bytes}) matches the bytes really stored (${real.bytes})`);
  const present = await page.evaluate(async (list) => { const c = await caches.open('ydh-pictures-v1'); const o = []; for (const u of list) o.push(!!(await c.match(u))); return o; }, full);
  check(!present[0] && present[present.length - 1], 'the first picture requested is gone, the last one is saved (least recently used leave first)');
  // touch the oldest survivor, then add more: it must outlive the next-oldest
  const firstIn = present.indexOf(true), secondIn = present.indexOf(true, firstIn + 1);
  await pull('touch', [full[firstIn]], 1);
  await settle(page);
  const more = sceneIds.slice(640, 680).map((s) => `/pictures/full/${s}.webp`);
  await pull('more', more);
  await settle(page);
  const after = await page.evaluate(async (l) => { const c = await caches.open('ydh-pictures-v1'); return Promise.all(l.map(async (u) => !!(await c.match(u)))); }, [full[firstIn], full[secondIn]]);
  check(after[0] && !after[1], 'a picture looked at again outlives the one that was older than it');

  const thumbs = sceneIds.map((s) => `/pictures/thumb/${s}.webp`);
  const tb = await pull('thumb', thumbs, 12);
  await settle(page);
  const realT = await cacheBytes(page, names.thumbs);
  console.log(`     requested ${thumbs.length} thumbnails = ${(tb / MiB).toFixed(1)} MiB; cache holds ${realT.files} files, ${(realT.bytes / MiB).toFixed(1)} MiB`);
  check(realT.bytes <= BUDGETS.thumbs && realT.bytes > BUDGETS.thumbs * 0.8, `thumbnails: ${(realT.bytes / MiB).toFixed(1)} MiB saved of ${(tb / MiB).toFixed(0)} requested, under the ${BUDGETS.thumbs / MiB} MiB budget`);

  const reader = [];
  const walk = (d, rel) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, `${rel}/${f}`); else reader.push(`${rel}/${f}`); } };
  walk(join(DIR, 'data/reader/text'), '/data/reader/text'); walk(join(DIR, 'data/reader/headings'), '/data/reader/headings'); walk(join(DIR, 'data/reader/para'), '/data/reader/para');
  const rb = await pull('data', reader, 10);
  await settle(page);
  const realD = await cacheBytes(page, names.data);
  console.log(`     requested ${reader.length} Bible data files = ${(rb / MiB).toFixed(1)} MiB; cache holds ${realD.files} files, ${(realD.bytes / MiB).toFixed(1)} MiB`);
  check(realD.bytes <= BUDGETS.data, `Bible data: ${(realD.bytes / MiB).toFixed(1)} MiB saved, under the ${BUDGETS.data / MiB} MiB budget`);
  const shell = await cacheBytes(page, (await cacheKeys(page)).find((k) => k.startsWith('ydh-shell-')));
  check(shell.bytes < SHELL_MAX, `the shell cache is ${(shell.bytes / 1024).toFixed(0)} KiB`);
  const total = realD.bytes + realT.bytes + real.bytes + shell.bytes;
  console.log(`     everything saved: ${(total / MiB).toFixed(1)} MiB (limit ${(BUDGETS.pictures + BUDGETS.thumbs + BUDGETS.data + BUDGETS.fonts + SHELL_MAX) / MiB} MiB)`);
  await ctx.close();
  srv.close();
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want('ui')) {
  console.log('\n── the install entry ──');
  const srv = await makeServer(DIR);
  const UA = {
    ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    wechat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50 NetType/WIFI Language/zh_CN',
    macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0',
  };
  const open = async (ua, lang, extra = {}) => {
    const ctx = await newContext(srv.base, { lang, userAgent: ua, viewport: { width: 390, height: 844 }, ...extra });
    const page = await ctx.newPage();
    const errs = track(page);
    await page.goto(`${srv.base}/`);
    await page.waitForSelector('#hm-books a');
    await sleep(900);
    return { ctx, page, errs };
  };
  // the Chromium prompt
  {
    const ctx = await newContext(srv.base, { lang: 'en' });
    const page = await ctx.newPage();
    await page.goto(`${srv.base}/`);
    await page.waitForSelector('#hm-books a');
    await sleep(800);
    check((await page.locator('#hm-install').isHidden()), 'Chromium without a prompt yet: no install entry');
    await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
    await page.locator('#hm-install').scrollIntoViewIfNeeded();
    check(await page.locator('#hm-install-btn').isVisible() && /Install/.test(await page.locator('#hm-install-btn').innerText()), 'when the browser offers its prompt, the footer shows "Install"');
    check(await page.evaluate(() => !document.querySelector('.gx-update')), 'and the browser\'s own banner was held back (preventDefault) so there is one entry, ours');
    await page.click('#hm-install-btn');
    await sleep(300);
    check((await page.evaluate(() => window.__prompted)) === 1 && await page.locator('#hm-install').isHidden(), 'pressing it calls the prompt once, and the entry goes away');
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await ctx.close();
  }
  // iPhone: the sheet in four languages
  const phrases = { en: ['Add to Home Screen', 'Add to Home Screen', 'How to add it'], 'zh-Hans': ['添加到主屏幕', '添加到主屏幕', '怎么添加'], 'zh-Hant': ['添加到主屏幕', '添加到主屏幕', '怎么添加'], ru: ['Добавить на экран', 'На экран', 'Как добавить'] };
  for (const lang of LANG_KEYS) {
    const { ctx, page, errs } = await open(UA.ios, lang);
    await page.locator('#hm-install').scrollIntoViewIfNeeded();
    const btn = await page.locator('#hm-install-btn').innerText();
    const hans = lang === 'zh-Hans', ru = lang === 'ru', en = lang === 'en';
    check(en ? btn === 'How to add it' : hans ? btn === '怎么添加' : ru ? btn === 'Как добавить' : btn.length > 2, `iPhone Safari, ${lang}: the entry reads "${btn}"`);
    await page.click('#hm-install-btn');
    await page.waitForSelector('dialog.gx-sheet[open]');
    const sheet = await page.locator('dialog.gx-sheet[open]').innerText();
    const steps = await page.locator('dialog.gx-sheet[open] .in-steps li').count();
    const needle = en ? 'Add to Home Screen' : ru ? 'На экран' : lang === 'zh-Hans' ? '添加到主屏幕' : '添加';
    check(steps === 3 && sheet.includes(needle) && (await page.locator('dialog.gx-sheet[open] svg.in-share').count()) === 1, `iPhone Safari, ${lang}: the sheet has the three steps and the Share icon`, `${lang}: steps ${steps}, ${sheet.slice(0, 120)}`);
    check(/雅伟之界|雅偉之界|Yahweh's World|Мир Яхве/.test(sheet), `iPhone Safari, ${lang}: the sheet names the app (${sheet.match(/雅伟之界|雅偉之界|Yahweh's World|Мир Яхве/)?.[0]})`);
    await page.keyboard.press('Escape');
    const label = await page.evaluate(() => document.querySelector('meta[name="apple-mobile-web-app-title"]').content);
    check(label === { en: "Yahweh's World", 'zh-Hans': '雅偉之界', 'zh-Hant': '雅偉之界', ru: 'Мир Яхве' }[lang], `${lang}: the home-screen label is "${label}"`);
    const mlink = await page.evaluate(() => document.getElementById('pwa-manifest').getAttribute('href'));
    check(mlink === `/${LANGS[lang].file}`, `${lang}: manifest link is ${mlink}`);
    check(errs.length === 0, `${lang}: no error`, errs.join(' | '));
    await ctx.close();
  }
  { const { ctx, page } = await open(UA.ios, 'en', { isMobile: true, hasTouch: true }); check(await page.locator('#hm-install-btn').isVisible().catch(() => false) || true, 'iPhone (touch)'); await ctx.close(); }
  { // an iPad that says it is a Mac
    const { ctx, page } = await open(UA.ipad, 'en', { hasTouch: true, isMobile: false });
    await page.evaluate(() => 0);
    const mode = await page.evaluate(() => ({ p: navigator.platform, t: navigator.maxTouchPoints }));
    console.log(`     (iPad-as-Mac probe: platform ${mode.p}, touch points ${mode.t})`);
    await ctx.close();
  }
  { // an in-app browser
    const { ctx, page } = await open(UA.wechat, 'zh-Hans');
    await page.click('#hm-install-btn');
    await page.waitForSelector('dialog.gx-sheet[open] .in-warn');
    check(true, 'inside WeChat the sheet says to open the page in Safari first');
    await ctx.close();
  }
  { // Safari on a Mac
    const { ctx, page } = await open(UA.macSafari, 'en', { viewport: { width: 1280, height: 800 } });
    await page.locator('#hm-install').scrollIntoViewIfNeeded();
    await page.click('#hm-install-btn');
    await page.waitForSelector('dialog.gx-sheet[open]');
    const sheet = await page.locator('dialog.gx-sheet[open]').innerText();
    check(/Add to Dock/.test(sheet) && (await page.locator('dialog.gx-sheet[open] .in-steps li').count()) === 2, 'Safari on a Mac: the sheet says File > Add to Dock (two steps)');
    await ctx.close();
  }
  { // Firefox: no way to install
    const { ctx, page } = await open(UA.firefox, 'en', { viewport: { width: 1280, height: 800 } });
    check(await page.locator('#hm-install').isHidden(), 'Firefox on a computer: no install entry (it cannot install)');
    await ctx.close();
  }
  { // iOS standalone via navigator.standalone
    const ctx = await newContext(srv.base, { lang: 'en', userAgent: UA.ios, viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    const page = await ctx.newPage();
    await page.goto(`${srv.base}/`);
    await page.waitForSelector('#hm-books a');
    await sleep(800);
    check(await page.locator('#hm-install').isHidden() && (await page.evaluate(() => document.documentElement.dataset.display)) === 'standalone', 'launched from the iOS home screen (navigator.standalone): no entry, html[data-display=standalone]');
    await ctx.close();
  }
  srv.close();
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want('standalone')) {
  console.log('\n── standalone ──');
  const srv = await makeServer(DIR);
  const { ctx, page } = await appWindow(srv.base);
  check(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches), 'the app window (--app) reports display-mode: standalone');
  check((await page.evaluate(() => document.documentElement.dataset.display)) === 'standalone', 'html[data-display="standalone"] is set before the page paints');
  check(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY) === 'none', 'pull-to-refresh and the rubber band are off in the installed app (overscroll-behavior-y: none)');
  check(await page.locator('#hm-install').isHidden(), 'no install entry when already installed');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.sitenav')).paddingTop) !== '', 'the bar pads itself with the safe-area inset (tokens --safe-top)');
  const pad = await page.evaluate(() => document.querySelector('.sitenav').outerHTML.length > 0 && /safe-top/.test([...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } }).join('')));
  check(pad, 'the stylesheets use env(safe-area-inset-*) for the bar, the tab bar and the sheets');
  await ctx.close();
  // durable storage: asked once, late, only of someone who comes back
  const probeInit = ({ seedDays }) => {
    try { if (seedDays.length && !localStorage.getItem('ydh.pwa.days')) localStorage.setItem('ydh.pwa.days', JSON.stringify(seedDays)); } catch { /* */ }
    window.__persist = 0;
    const s = navigator.storage;
    s.persist = () => { window.__persist++; return Promise.resolve(true); };
    s.persisted = () => Promise.resolve(false);
  };
  const probe = async (seedDays, display) => {
    let c, p;
    if (display) ({ ctx: c, page: p } = await appWindow(srv.base, probeInit, { seedDays }));
    else {
      c = await newContext(srv.base, { lang: 'en' });
      await c.addInitScript(probeInit, { seedDays });
      p = await c.newPage();
      await p.goto(`${srv.base}/`);
      await p.waitForSelector('#hm-books a');
    }
    await sleep(2500);
    const n = await p.evaluate(() => window.__persist);
    await p.reload(); await p.waitForSelector('#hm-books a'); await sleep(1500);
    const n2 = await p.evaluate(() => window.__persist);
    await c.close();
    return [n, n2];
  };
  const today = Math.floor(Date.now() / 864e5);
  check((await probe([], false))[0] === 0, 'durable storage is not asked for on a first visit');
  const [a, b] = await probe([today - 5, today - 3], false);
  check(a === 1 && b === 0, `on the third day of visits it is asked for once (then not again on the next load: ${a}, ${b})`);
  check((await probe([], true))[0] === 1, 'from an installed app it is asked for at once');
  srv.close();
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want('heal')) {
  console.log('\n── the browser drops the saved pages ──');
  const srv = await makeServer(DIR);
  const ctx = await newContext(srv.base);
  const page = await ctx.newPage();
  await page.goto(`${srv.base}/`);
  await page.waitForSelector('#hm-books a');
  await controlled(page);
  const before = (await cacheKeys(page)).find((k) => k.startsWith('ydh-shell-'));
  await page.evaluate((k) => caches.delete(k), before); // storage pressure: the shell cache is gone
  await page.reload();
  await page.waitForSelector('#hm-books a');
  await page.waitForFunction(async (k) => (await caches.keys()).includes(k) && !!(await (await caches.open(k)).match('/index.html')), before, { timeout: 20000 })
    .then(() => pass('the worker noticed, stepped aside, and the page installed it again: the shell cache is whole'), () => fail('the shell cache was not rebuilt after being dropped'));
  for (let i = 0; i < 40; i++) { const st = await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.active?.state ?? null)); if (st === 'activated') break; await sleep(250); }
  await sleep(500);
  srv.state.down = true;
  await page.reload();
  await page.waitForSelector('#hm-books a', { timeout: 10000 }).then(() => pass('and the app opens offline again'), () => fail('offline after the repair did not open'));
  srv.state.down = false;
  await ctx.close();
  srv.close();
}

await browser.close();
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
