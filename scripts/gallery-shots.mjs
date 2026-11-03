// Screenshots of the gallery surface: the referee (handoff/09). Serves dist/ and shoots each page at each viewport,
// language and theme into docs/evidence/gallery-2026-11/shots/.
//
//   node scripts/gallery-shots.mjs [--dir dist] [--out docs/evidence/gallery-2026-11/shots]
//        [--viewports 375x812,768x1024,1440x900] [--langs en,zh-Hans,zh-Hant,ru] [--themes dark,light,paper]
//        [--base http://127.0.0.1:4173] [--all-themes]   (--base shoots an already running preview instead of serving dist/; --all-themes shoots every page in every theme, home and gallery included)
//        [--pages home,gallery,picture,reader,parallel,reader-parallel,sheet,picture-sheet,licences,feedback,feedback-failed,feedback-thanks,held]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist } from './lib/dist-server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const DIR = resolve(ROOT, args.dir || 'dist');
const OUT = resolve(ROOT, args.out || 'docs/evidence/gallery-2026-11/shots');
const VPS = (args.viewports || '375x812,1440x900').split(',').map((s) => s.split('x').map(Number));
const LANGS = (args.langs || 'en,zh-Hans').split(',');
const THEMES = (args.themes || 'dark,light,paper').split(',');
const PAGES = (args.pages || 'home,gallery,picture,reader,parallel,reader-parallel,sheet,picture-sheet,licences,feedback,feedback-failed,feedback-thanks,held').split(',');
mkdirSync(OUT, { recursive: true });

const { base, close } = args.base ? { base: args.base, close() {} } : await serveDist(DIR);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
// Which themes a page is shot in: the home page and the gallery stay dark by design (the plates were drawn to sit on
// dark); the reading surfaces (picture, reader) are shot in all three; sheets and the parallel layout in dark and paper.
const ALL = ['dark', 'light', 'paper'], TWO = ['dark', 'paper'], DARK = ['dark'];
const SHOTS = {
  home: { url: '/', wait: '#hm-title:not(:has(.gx-sk))', themes: DARK },
  gallery: { url: '/scenes.html#b=1', wait: '.sc-card', themes: DARK },
  picture: { url: '/scenes.html#p=genesis-15-1', wait: '.yr-passage .yr-v', themes: ALL },
  reader: { url: '/bible.html#ref=Genesis%2015%3A5-6', wait: '.yr-chapter .yr-v', themes: ALL },
  parallel: { url: '/scenes.html#p=genesis-15-1', wait: '.yr-passage .yr-v', themes: TWO, act: async (p) => { await p.click('.yr-passage [data-act="parallelToggle"]'); await p.waitForSelector('.yr-passage .yr-pv'); await p.waitForTimeout(300); } },
  'reader-parallel': { url: '/bible.html#ref=Psalm%20119&m=parallel', wait: '.yr-chapter .yr-pv', themes: TWO },
  sheet: { url: '/', wait: '#hm-edition', themes: TWO, act: async (p) => { await p.click('#hm-edition'); await p.waitForSelector('dialog.yr-sheet[open] .yr-opt'); await p.waitForTimeout(400); } },
  'picture-sheet': { url: '/scenes.html#p=genesis-15-1', wait: '.yr-passage .yr-v', themes: TWO, act: async (p) => { await p.click('.yr-passage [data-act="edition"]'); await p.waitForSelector('dialog.yr-sheet[open] .yr-opt'); await p.waitForTimeout(400); } },
  licences: { url: '/', wait: '#hm-all-licences', themes: DARK, act: async (p) => { await p.click('#hm-all-licences'); await p.waitForSelector('dialog.gx-sheet[open] .gx-lic'); await p.waitForTimeout(400); } },
  feedback: { url: '/scenes.html#p=genesis-15-1', wait: '.yr-passage .yr-v', themes: ALL, act: async (p) => { await p.click('#pc-feedback'); await p.waitForSelector('dialog.gx-fb[open] form.fb'); await p.click('dialog.gx-fb [data-r="picture"]'); await p.fill('dialog.gx-fb textarea', ''); await p.waitForTimeout(500); } },
  'feedback-failed': { url: '/scenes.html#p=genesis-15-1', wait: '.yr-passage .yr-v', themes: TWO, act: async (p) => { await p.route('**/api/feedback', (r) => r.fulfill({ status: 503, body: '{"error":"not_configured"}' })); await p.click('#pc-feedback'); await p.waitForSelector('dialog.gx-fb[open] form.fb'); await p.fill('dialog.gx-fb textarea', 'The stars look wrong.'); await p.click('dialog.gx-fb [data-send]'); await p.waitForSelector('dialog.gx-fb .fb-fallback:not([hidden])'); await p.waitForTimeout(400); } },
  'feedback-thanks': { url: '/scenes.html#p=genesis-15-1', wait: '.yr-passage .yr-v', themes: DARK, act: async (p) => { await p.route('**/api/feedback', (r) => r.fulfill({ status: 200, body: '{"ok":true}' })); await p.click('#pc-feedback'); await p.waitForSelector('dialog.gx-fb[open] form.fb'); await p.click('dialog.gx-fb [data-send]'); await p.waitForSelector('dialog.gx-fb .fb-done:not([hidden])'); await p.waitForTimeout(400); } },
  held: { url: '/scenes.html#p=exodus-13-17', wait: '.yr-passage .yr-v', themes: DARK },
};
const errors = [];
for (const [w, h] of VPS) for (const lang of LANGS) for (const theme of THEMES) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1, hasTouch: w < 500, isMobile: w < 500, colorScheme: theme === 'dark' ? 'dark' : 'light' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  // the theme is the reader module's own preference ('yr.prefs.v1'), the one the pages and the home page's switch share
  await ctx.addInitScript(([l, t]) => { try { localStorage.setItem('ydh.locale', l); localStorage.setItem('yr.prefs.v1', JSON.stringify({ theme: t })); } catch { /* about:blank has no storage */ } }, [lang, theme]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}x${h} ${lang} ${e.message}`));
  for (const name of PAGES) {
    const s = SHOTS[name];
    if (!s.themes.includes(theme) && !process.argv.includes('--all-themes')) continue;
    await page.goto('about:blank'); // a hash-only change would keep an open sheet from the shot before
    await page.goto(base + s.url);
    try { await page.waitForSelector(s.wait, { timeout: 15000 }); } catch { errors.push(`${w}x${h} ${lang} ${name}: ${s.wait} never appeared`); }
    await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('done') !== false, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    if (s.act) await s.act(page);
    const file = join(OUT, `${name}-${w}x${h}-${lang}-${theme}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 72, fullPage: name === 'home' && w >= 1000 });
    console.log(file.replace(ROOT + '/', ''));
  }
  await ctx.close();
}
await browser.close(); close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
