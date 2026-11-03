// Behaviour of the gallery pages in a real browser: home, search, edition sheet, browse, the picture page and its passage,
// the loading and failure states, the four languages, the paper theme. 375x812 (touch) and 1440x900.
//
//   node scripts/verify-gallery-ui.mjs [--dir dist]
import { chromium } from 'playwright';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist } from './lib/dist-server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DIR = resolve(ROOT, argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'dist');
let bad = 0, ok = 0;
const pass = (m) => { ok++; console.log(`ok   ${m}`); };
const fail = (m) => { bad++; console.error(`FAIL ${m}`); };
const check = (c, good, badMsg) => (c ? pass(good) : fail(badMsg ?? good));

const { base, close } = await serveDist(DIR);
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function open(vp, lang, { block = [], reduced = false } = {}) {
  const [w, h] = vp;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  for (const b of block) await ctx.route(b, (r) => r.abort());
  await ctx.addInitScript((l) => { try { localStorage.setItem('ydh.locale', l); } catch { /* */ } }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

for (const vp of [[375, 812], [1440, 900]]) {
  const tag = `${vp[0]}`;
  // ── home ────────────────────────────────────────────────────────────
  for (const lang of ['en', 'zh-Hans', 'zh-Hant', 'ru']) {
    const { ctx, page, errors } = await open(vp, lang);
    await page.goto(`${base}/`);
    await page.waitForSelector('#hm-title:not(:has(.gx-sk))');
    await page.waitForSelector('#hm-plate .gx-plate.is-loaded', { timeout: 15000 });
    check(await page.evaluate((l) => document.documentElement.lang === l, lang), `${tag} ${lang}: <html lang> follows the language`);
    check(await noOverflow(page), `${tag} ${lang}: home has no horizontal scroll`);
    const title = await page.locator('#hm-title').innerText();
    check(title.length > 2, `${tag} ${lang}: hero title "${title}"`);
    const ruTitle = lang === 'ru' ? /[А-Яа-я]/.test(title) : true;
    check(ruTitle, `${tag} ${lang}: Russian reader sees a Russian title`);
    if (lang === 'zh-Hant') check(!/[头无从]/.test(await page.locator('#hm-books').innerText()), `${tag} zh-Hant: book names are Traditional`);
    check(errors.length === 0, `${tag} ${lang}: home has no console error`, `${tag} ${lang}: ${errors}`);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open(vp, 'en');
    await page.goto(`${base}/`);
    await page.waitForSelector('#hm-books a');
    // language switch without a reload
    await page.click('.lang-switch [data-locale="zh-Hans"]');
    await page.waitForFunction(() => document.documentElement.lang === 'zh-Hans');
    check((await page.locator('#hm-browse-h').innerText()) === '按书卷看', `${tag}: switching to 简 changes the page without a reload`);
    check(await page.evaluate(() => localStorage.getItem('ydh.locale')) === 'zh-Hans', `${tag}: the choice is remembered`);
    await page.click('.lang-switch [data-locale="ru"]');
    await page.waitForFunction(() => document.documentElement.lang === 'ru');
    check((await page.locator('#hm-browse-h').innerText()) === 'По книгам', `${tag}: switching to РУ`);
    await page.click('.lang-switch [data-locale="en"]');
    // edition sheet: opens, is a modal, Escape closes and hands focus back
    await page.click('#hm-edition');
    await page.waitForSelector('dialog.gx-sheet[open] .gx-opt');
    const opts = await page.locator('dialog.gx-sheet[open] .gx-opt').count();
    check(opts >= 3, `${tag}: the edition sheet lists the editions this build has (${opts})`);
    check(await page.locator('dialog.gx-sheet[open] .gx-opt[aria-checked="true"]').count() === 1, `${tag}: exactly one edition is checked`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.gx-sheet[open]'));
    check(await page.evaluate(() => document.activeElement?.id === 'hm-edition'), `${tag}: Escape closes the sheet and focus returns to its button`);
    // choose another edition
    await page.click('#hm-edition'); await page.waitForSelector('.gx-opt');
    await page.locator('dialog.gx-sheet[open] .gx-opt', { hasText: 'Simplified' }).click();
    await page.waitForFunction(() => !document.querySelector('dialog.gx-sheet[open]'));
    check((await page.locator('#hm-edition').innerText()).includes('CUV'), `${tag}: choosing an edition updates the chip`);
    // licences sheet
    await page.click('#hm-all-licences'); await page.waitForSelector('dialog.gx-sheet[open] .gx-lic');
    check((await page.locator('dialog.gx-sheet[open] .gx-lic').count()) >= 3, `${tag}: the licences sheet lists a credit per edition`);
    await page.keyboard.press('Escape');
    // search
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
    await page.waitForSelector('dialog.gx-pal[open] input');
    await page.fill('dialog.gx-pal[open] input', '创 12');
    await page.waitForSelector('.gx-pal-row');
    const first = await page.locator('.gx-pal-row .r').first().innerText();
    check(/Genesis 12/.test(first), `${tag}: "创 12" finds Genesis 12 (${first})`);
    await page.fill('dialog.gx-pal[open] input', 'Gen 12:1');
    await page.waitForFunction(() => /Genesis 12/.test(document.querySelector('.gx-pal-row .r')?.textContent ?? ''));
    pass(`${tag}: "Gen 12:1" finds Genesis 12`);
    await page.fill('dialog.gx-pal[open] input', '大马色');
    await page.waitForSelector('.gx-pal-row', { timeout: 10000 });
    check((await page.locator('.gx-pal-row').count()) >= 1, `${tag}: "大马色" finds scenes by their words`);
    await page.fill('dialog.gx-pal[open] input', 'Быт 12');
    await page.waitForFunction(() => /Genesis 12|Бытие 12/.test(document.querySelector('.gx-pal-row .r')?.textContent ?? ''));
    pass(`${tag}: "Быт 12" (Russian short name) finds Genesis 12`);
    await page.fill('dialog.gx-pal[open] input', 'zzzzqq');
    await page.waitForFunction(() => document.querySelector('.gx-pal-hint')?.textContent && !document.querySelector('.gx-pal-row'));
    pass(`${tag}: a query with no match says so`);
    await page.fill('dialog.gx-pal[open] input', 'Gen 15');
    await page.waitForSelector('.gx-pal-row');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.waitForURL(/scenes\.html#p=/);
    pass(`${tag}: Enter on a result opens its picture page (${new URL(page.url()).hash})`);
    check(errors.length === 0, `${tag}: no console error through all of it`, `${tag}: ${errors}`);
    await ctx.close();
  }
  // ── browse ──────────────────────────────────────────────────────────
  {
    const { ctx, page, errors } = await open(vp, 'en');
    await page.goto(`${base}/scenes.html`);
    await page.waitForSelector('.sc-card');
    check((await page.locator('.sc-card').count()) === 60, `${tag}: the first screen is one batch of 60 cards`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => document.querySelectorAll('.sc-card').length > 60, null, { timeout: 8000 });
    pass(`${tag}: scrolling to the end loads the next batch`);
    await page.click('#sc-strip [data-h="#b=1"]');
    await page.waitForFunction(() => document.getElementById('sc-title').textContent === 'Genesis');
    check((await page.locator('.sc-card').count()) === 60, `${tag}: Genesis shows its first 60 of 83`);
    check(page.url().endsWith('#b=1'), `${tag}: the filter is in the address (${new URL(page.url()).hash})`);
    // open a card, then Back restores the scroll
    await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(150);
    const y0 = await page.evaluate(() => Math.round(scrollY));
    // a reader clicks a card that is on screen: pick one that is, so the page is not scrolled to reach it
    const visible = await page.evaluateHandle(() => [...document.querySelectorAll('.sc-card')].find((c) => { const r = c.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 80; }));
    await visible.asElement().click();
    await page.waitForSelector('#pc-verses .v');
    const id = await page.evaluate(() => location.hash);
    await page.click('#pc-next, a#pc-next').catch(() => {});
    await page.waitForTimeout(300);
    check((await page.evaluate(() => location.hash)) !== id, `${tag}: Next scene changes the address (${id} -> ${await page.evaluate(() => location.hash)})`);
    await page.goBack(); await page.waitForTimeout(300);
    check((await page.evaluate(() => location.hash)) === id, `${tag}: Back returns to the previous scene`);
    await page.goBack(); await page.waitForSelector('.sc-card'); await page.waitForTimeout(500);
    const y1 = await page.evaluate(() => Math.round(scrollY));
    check(Math.abs(y1 - y0) < 120, `${tag}: Back from a picture restores the grid scroll (${y0} -> ${y1})`);
    check(await noOverflow(page), `${tag}: no horizontal scroll`);
    check(errors.length === 0, `${tag}: browse has no console error`, `${tag}: ${errors}`);
    await ctx.close();
  }
  // ── picture + passage ───────────────────────────────────────────────
  {
    const { ctx, page, errors } = await open(vp, 'en');
    await page.goto(`${base}/scenes.html#p=genesis-15-1`);
    await page.waitForSelector('#pc-verses .v');
    check((await page.locator('#pc-title').innerText()).length > 3, `${tag}: caption title`);
    check(await page.locator('#pc-plate .gx-plate.is-loaded').count() === 1 || await page.waitForSelector('#pc-plate .gx-plate.is-loaded', { timeout: 15000 }).then(() => true), `${tag}: the plate (text-free square) loaded`);
    const imgSrc = await page.locator('#pc-plate img').getAttribute('src');
    check(/^\/pictures\/full\/genesis-15-1\.webp$/.test(imgSrc), `${tag}: the plate is this site's own file (${imgSrc})`);
    const text = await page.locator('#pc-verses').innerText();
    check(!/<H0>|<G0>|<note/.test(text), `${tag}: no markup tags in the verses`);
    check((await page.locator('#pc-verses .v').count()) === 12, `${tag}: 12 verses first`);
    await page.click('#pc-more');
    check((await page.locator('#pc-verses .v').count()) === 21, `${tag}: expanded to all 21`);
    // select two verses, copy
    await page.locator('#pc-verses .v .vn').nth(4).click(); await page.locator('#pc-verses .v .vn').nth(5).click();
    check(await page.locator('#pc-sel.on').count() === 1, `${tag}: selecting verses shows the copy bar`);
    await page.click('#pc-sel-copy');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check(/^Genesis 15:5–6 \(BSB, Yahweh\)\n5 .*\n6 .*\n\n— Yahweh's World · world\.yahwehword\.com\/p\/genesis-15-1$/s.test(clip), `${tag}: copy = citation, numbered verses, source line`, `${tag}: clipboard was ${JSON.stringify(clip)}`);
    // whole chapter link
    check((await page.locator('#pc-chapter').getAttribute('href')) === '/bible.html?book=1&ch=15', `${tag}: "whole chapter" opens the reader at Genesis 15`);
    // full screen
    await page.click('#pc-plate'); await page.waitForSelector('dialog.gx-fs[open] img');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog.gx-fs'));
    pass(`${tag}: full screen opens and Escape closes it`);
    // keyboard: arrow right
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
    check((await page.evaluate(() => location.hash)) !== '#p=genesis-15-1', `${tag}: ArrowRight goes to the next scene`);
    // reading theme
    await page.evaluate(() => { document.documentElement.dataset.read = 'paper'; });
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.pc-right')).backgroundColor);
    check(/rgb\(24[0-9], 23[0-9], 22[0-9]\)/.test(bg), `${tag}: paper makes the text column light (${bg})`);
    // contrast of the paper text column, measured the way the audits do (WCAG ratio, text against the column's own ground)
    const low = await page.evaluate(() => {
      const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bg = rgb(getComputedStyle(document.querySelector('.pc-right')).backgroundColor);
      const out = [];
      for (const el of document.querySelectorAll('.pc-right .heading, .pc-right .tx, .pc-right .ed-credit, .pc-right .gx-pill, .pc-right .vn')) {
        const fg = rgb(getComputedStyle(el).color);
        const [x, y] = [lum(fg), lum(bg)].sort((m, n) => n - m);
        const cr = (x + 0.05) / (y + 0.05);
        if (cr < 4.5) out.push(`${el.className || el.tagName} ${cr.toFixed(2)}`);
      }
      return out;
    });
    check(!low.length, `${tag}: paper text column has no text under 4.5:1`, `${tag}: paper contrast ${[...new Set(low)]}`);
    await page.evaluate(() => { document.documentElement.dataset.read = 'dark'; });
    check(await noOverflow(page), `${tag}: no horizontal scroll on the picture page`);
    check(errors.length === 0, `${tag}: picture page has no console error`, `${tag}: ${errors}`);
    await ctx.close();
  }
  // a scene whose picture the gate has not passed still has its page
  {
    const { ctx, page } = await open(vp, 'zh-Hans');
    await page.goto(`${base}/scenes.html#p=genesis-5-1`);
    await page.waitForSelector('#pc-verses .v');
    check(await page.locator('#pc-plate .gx-plate.is-pending').count() === 1 && await page.locator('#pc-plate img').count() === 0, `${tag}: a held scene shows the plain plate and requests no picture`);
    check((await page.locator('.gx-pending').innerText()).includes('还在画'), `${tag}: ...with its line of words as HTML`);
    await ctx.close();
  }
  // failure states are named and retry works
  {
    let allow = false;
    const { ctx, page } = await open(vp, 'en');
    await page.route('**/data/gallery/index.json', (r) => (allow ? r.continue() : r.abort()));
    await page.goto(`${base}/`);
    await page.waitForSelector('#hm-books .gx-fail');
    check(/did not load/.test(await page.locator('#hm-books .gx-fail').innerText()), `${tag}: home names a failed scene list and offers Try again`);
    allow = true;
    await page.click('#hm-books .gx-fail button');
    await page.waitForSelector('#hm-books a', { timeout: 10000 });
    pass(`${tag}: Try again recovers the home page`);
    await ctx.close();
  }
  {
    let allow = false;
    const { ctx, page } = await open(vp, 'en');
    await page.route('**/data/bible/split/text/**', (r) => (allow ? r.continue() : r.abort()));
    await page.goto(`${base}/scenes.html#p=genesis-15-1`);
    await page.waitForSelector('#pc-passage .gx-fail');
    check(await page.locator('#pc-plate .gx-plate').count() === 1, `${tag}: with the verses failing, the picture and caption still show`);
    allow = true;
    await page.click('#pc-passage .gx-fail button');
    await page.waitForSelector('#pc-verses .v', { timeout: 10000 });
    pass(`${tag}: the passage recovers on Try again`);
    await ctx.close();
  }
  // reduced motion: no running animation
  {
    const { ctx, page } = await open(vp, 'en', { reduced: true });
    await page.goto(`${base}/scenes.html`); await page.waitForSelector('.sc-card'); await page.waitForTimeout(500);
    const n = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length);
    check(n === 0, `${tag}: reduced motion runs no infinite animation (${n})`);
    await ctx.close();
  }
}
await browser.close(); close();
console.log(bad ? `\n${bad} problem(s), ${ok} ok` : `\nall ${ok} checks ok`);
process.exit(bad ? 1 : 0);
