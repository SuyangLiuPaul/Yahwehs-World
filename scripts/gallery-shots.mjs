// Screenshots of the gallery surface: the referee (handoff/09). Serves dist/ and shoots each page at each viewport,
// language and theme into docs/evidence/gallery-2026-11/shots/.
//
//   node scripts/gallery-shots.mjs [--dir dist] [--out docs/evidence/gallery-2026-11/shots]
//        [--viewports 375x812,768x1024,1440x900] [--langs en,zh-Hans,zh-Hant,ru] [--themes dark,paper]
//        [--pages home,gallery,picture,reader,sheet]
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
const THEMES = (args.themes || 'dark').split(',');
const PAGES = (args.pages || 'home,gallery,picture,reader').split(',');
mkdirSync(OUT, { recursive: true });

const { base, close } = await serveDist(DIR);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const SHOTS = {
  home: { url: '/', wait: '#hm-title:not(:has(.gx-sk))' },
  gallery: { url: '/scenes.html#b=1', wait: '.sc-card' },
  picture: { url: '/scenes.html#p=genesis-15-1', wait: '#pc-verses .v' },
  reader: { url: '/bible.html?book=1&ch=15', wait: 'body.bb-ready' },
  sheet: { url: '/', wait: '#hm-edition', act: async (p) => { await p.click('#hm-edition'); await p.waitForSelector('dialog.gx-sheet[open] .gx-opt'); await p.waitForTimeout(400); } },
};
const errors = [];
for (const [w, h] of VPS) for (const lang of LANGS) for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1, hasTouch: w < 500, isMobile: w < 500, colorScheme: theme === 'paper' ? 'light' : 'dark' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript(([l, t]) => { localStorage.setItem('ydh.locale', l); localStorage.setItem('ydh.read', t === 'paper' ? 'paper' : 'dark'); }, [lang, theme]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}x${h} ${lang} ${e.message}`));
  for (const name of PAGES) {
    const s = SHOTS[name];
    await page.goto(base + s.url);
    try { await page.waitForSelector(s.wait, { timeout: 15000 }); } catch { errors.push(`${w}x${h} ${lang} ${name}: ${s.wait} never appeared`); }
    await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('done') !== false, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    if (s.act) await s.act(page);
    const file = join(OUT, `${name}-${w}x${h}-${lang}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: name === 'home' && w >= 1000 });
    console.log(file.replace(ROOT + '/', ''));
  }
  await ctx.close();
}
await browser.close(); close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
