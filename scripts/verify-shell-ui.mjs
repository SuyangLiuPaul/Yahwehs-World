// The shell content in a real browser (Chromium standing in for the web views): node scripts/verify-shell-ui.mjs [--dir dist-shell]
// The shell's boot script runs here with the WEB platform adapter (there is no Tauri), which is exactly the fallback path; the Tauri
// adapter itself is covered by tests/platform/tauri.test.ts with fake plugins and, for the real thing, by running the built app.
//   - every page loads without a script error; <html data-target="shell" data-shell data-channel> are set
//   - thumbnails are requested from this origin (bundled), full pictures from SITE_HOST (never from this origin)
//   - the "Offline pictures" entry opens the sheet and lists the three packs with the byte counts of packs.json
//   - the font stylesheet is switched on by boot.ts (no inline handler), and nothing else leaves the app for another host
//   - THE NAME FOLLOWS THE LANGUAGE: the bar's wordmark reads "Yahweh's World" to an English and a Russian reader,
//     雅伟之界 to a 简体 one and 雅偉之界 to a 繁體 one, with no CJK character anywhere in the name of a page that is
//     not Chinese (owner, 2026-11-04, on TestFlight build 3, where every language's bar read 雅偉之界)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist } from './lib/dist-server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DIR = resolve(ROOT, argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'dist-shell');
const SITE_HOST = /export const SITE_HOST = '([^']+)'/.exec(readFileSync(join(ROOT, 'src/config/site.ts'), 'utf8'))[1];
const packs = JSON.parse(readFileSync(join(DIR, 'data/packs.json'), 'utf8'));
let bad = 0, ok = 0;
const check = (c, m) => { if (c) { ok++; console.log(`ok   ${m}`); } else { bad++; console.error(`FAIL ${m}`); } };
const mib = (n) => `${(n / 1048576).toFixed(1)} MiB`;

// a 1x1 webp standing in for a picture the site would serve
const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const { base, close } = await serveDist(DIR);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const foreign = [];
  const fullHits = [];
  ctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u);
  });
  await ctx.route(`${SITE_HOST}/pictures/full/*`, (r) => { fullHits.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/webp', body: PIXEL }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => { try { localStorage.setItem('ydh.locale', 'en'); } catch { /* */ } });

  for (const path of ['/', '/scenes.html', '/bible.html']) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
    await page.goto(base + path, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.shell !== undefined, null, { timeout: 8000 }).catch(() => {});
    const flags = await page.evaluate(() => ({ t: document.documentElement.dataset.target, s: document.documentElement.dataset.shell, c: document.documentElement.dataset.channel }));
    check(errors.length === 0, `${path}: no script error${errors.length ? ` (${errors[0]})` : ''}`);
    check(flags.t === 'shell' && !!flags.s && ['direct', 'store'].includes(flags.c), `${path}: html data-target=shell data-shell=${flags.s} data-channel=${flags.c}`);
    const late = await page.evaluate(() => [...document.querySelectorAll('link[data-late-font]')].map((l) => l.media));
    check(late.every((m) => m === 'all'), `${path}: the web-font stylesheet is switched on by boot.ts (${late.length} link)`);
    await page.close();
  }

  // the picture page: bundled thumbnail, fetched full picture
  const page = await ctx.newPage();
  await page.goto(`${base}/scenes.html`, { waitUntil: 'load' });
  await page.waitForSelector('.gx-plate img', { timeout: 8000 });
  await page.waitForTimeout(1200);
  const gridSrcs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.currentSrc || i.src).filter((s) => /\/pictures\//.test(s)));
  check(gridSrcs.length > 0 && gridSrcs.every((s) => s.startsWith(`${base}/pictures/thumb/`)), `the grid's thumbnails come from the bundle (${gridSrcs.length})`);
  await page.goto('about:blank');
  await page.goto(`${base}/scenes.html#p=genesis-15-1`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const srcs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.currentSrc || i.src).filter((s) => /\/pictures\//.test(s)));
    check(srcs.every((s) => !s.startsWith(`${base}/pictures/full/`)), 'no full picture is requested from the bundle');
  check(fullHits.length > 0 && fullHits.every((u) => u.startsWith(`${SITE_HOST}/pictures/full/`)), `full pictures are requested from ${SITE_HOST} (${fullHits.length})`);

  // The offline-pictures sheet was a stub and the entry has been removed until it is real (P1-5): what is checked is
  // that it is GONE, so it cannot creep back in unreviewed, and that the pack manager behind it still works.
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.waitForSelector('.sitenav', { timeout: 8000 });
  await page.waitForTimeout(600);
  check(await page.locator('[data-shell-packs]').count() === 0, 'no "Offline pictures" entry in the bar (the stub sheet is out)');
  check(await page.locator('.gx-packs-row').count() === 0, 'nothing of the stub sheet is in the page');
  check(packs.packs.length === 3 && packs.packs.every((p) => p.bytes > 0), `the pack manifest still lists three packs with byte counts (${packs.packs.map((p) => mib(p.bytes)).join(', ')})`);

  // ── the name, in each of the four readings ──────────────────────────────────────────────────────────────────────
  // Checked in the SHELL's own dist because this is the build the owner tests: the gallery's dist and this one take the
  // bar from the same generator, and that is exactly the kind of agreement that holds until it does not.
  {
    const WANT = { en: "Yahweh's World", 'zh-Hans': '雅伟之界', 'zh-Hant': '雅偉之界', ru: "Yahweh's World" };
    const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
    for (const lang of ['en', 'zh-Hans', 'zh-Hant', 'ru']) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await c.addInitScript((l) => { try { localStorage.setItem('ydh.locale', l); } catch { /* */ } }, lang);
      const pg = await c.newPage();
      await pg.goto(`${base}/`, { waitUntil: 'load' });
      await pg.waitForSelector('.sitenav .brand', { timeout: 8000 });
      const wm = await pg.evaluate(() => {
        const el = document.querySelector('.sitenav .brand .wm');
        if (!el) return null;
        const shown = [...el.children].filter((i) => getComputedStyle(i).display !== 'none');
        return { text: (shown.length ? shown : [el]).map((i) => i.textContent.trim()).join(''), shown: shown.length, lockup: el.children.length };
      });
      // A dist built before the wordmark lockup existed has `<span class="zh" data-brand>` with one Chinese name in it
      // and nothing else: that IS the build-3 fault, so it fails here rather than being waved through. Run
      // `npm run app:dist` and this file again.
      check(!!wm && wm.lockup === 4, `${lang}: the bar carries the wordmark in all four readings (${wm ? `${wm.lockup} readings` : 'NO .wm ELEMENT: this dist-shell was built before the per-language wordmark — run npm run app:dist'})`);
      check(wm?.text === WANT[lang], `${lang}: the wordmark reads "${WANT[lang]}" (${wm ? `"${wm.text}"` : 'stale dist-shell'})`);
      if (lang === 'en' || lang === 'ru') check(!CJK.test(wm?.text ?? ''), `${lang}: no Chinese character in the name of a non-Chinese page (${wm ? `"${wm.text}"` : 'stale dist-shell'})`);
      await c.close();
    }
  }

  const other = foreign.filter((u) => !u.startsWith(SITE_HOST) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
  check(other.length === 0, `no request leaves the app except to ${SITE_HOST} and the font host (both in the CSP)${other.length ? ` (${other[0]})` : ''}`);
} finally {
  await browser.close();
  close();
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
