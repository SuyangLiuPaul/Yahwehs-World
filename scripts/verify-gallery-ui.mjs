// Behaviour of the gallery pages in a real browser: home, search, edition sheet, browse, the picture page and its passage,
// the loading and failure states, the four languages, the paper theme. 375x812 (touch) and 1440x900.
//
//   node scripts/verify-gallery-ui.mjs [--dir dist]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
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

// serviceWorkers: 'block' in every context of this file: with the installable app's worker in control, page.route() no longer sees a
// page's requests (the worker makes them), and these checks inject failures with page.route(). The worker has its own suite: verify-pwa.mjs.
async function open(vp, lang, { block = [], reduced = false } = {}) {
  const [w, h] = vp;
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
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

/** Choose a reading. The four EN | 简 | 繁 | РУ buttons are gone: one globe button opens a menu (P1-1), so every
 *  check that used to click `.lang-switch [data-locale=x]` goes through the control a reader actually has. */
async function pickLang(page, l) {
  await page.click('.sitenav .lang-btn');
  await page.waitForSelector(`.lang-pop:not([hidden]) [data-locale="${l}"]`);
  await page.click(`.lang-pop [data-locale="${l}"]`);
  await page.waitForFunction(() => document.querySelector('.sitenav .lang-btn')?.getAttribute('aria-expanded') === 'false');
}

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
    // the page-name rule (owner, 2026-11-04): 雅偉之界 in English, Russian and 繁體; 雅伟之界 only on a 简体 page. The home label reads Home.
    {
      const brand = (await page.locator('.sitenav .brand .zh').innerText()).trim();
      check(brand === (lang === 'zh-Hans' ? '雅伟之界' : '雅偉之界'), `${tag} ${lang}: the header name is ${lang === 'zh-Hans' ? '雅伟之界 (简体)' : '雅偉之界 (Traditional)'} ("${brand}")`);
      const pageTitle = await page.title();
      check(lang === 'zh-Hans' ? !pageTitle.includes('雅偉') : !pageTitle.includes('雅伟'), `${tag} ${lang}: the <title> spells the name for this language ("${pageTitle}")`);
      const pg = (await page.locator('.sitenav .brand .pg').innerText()).trim();
      check(pg === { en: 'Home', 'zh-Hans': '首页', 'zh-Hant': '首頁', ru: 'Главная' }[lang], `${tag} ${lang}: the header label on the home page is the tab's name ("${pg}")`);
    }
    if (lang === 'zh-Hant') check(!/[头无从]/.test(await page.locator('#hm-books').innerText()), `${tag} zh-Hant: book names are Traditional`);
    check(errors.length === 0, `${tag} ${lang}: home has no console error`, `${tag} ${lang}: ${errors}`);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open(vp, 'en');
    await page.goto(`${base}/`);
    await page.waitForSelector('#hm-books a');
    // language switch without a reload
    await pickLang(page, 'zh-Hans');
    await page.waitForFunction(() => document.documentElement.lang === 'zh-Hans');
    check((await page.locator('#hm-browse-h').innerText()) === '按书卷看', `${tag}: switching to 简 changes the page without a reload`);
    check(await page.evaluate(() => localStorage.getItem('ydh.locale')) === 'zh-Hans', `${tag}: the choice is remembered`);
    await pickLang(page, 'ru');
    await page.waitForFunction(() => document.documentElement.lang === 'ru');
    check((await page.locator('#hm-browse-h').innerText()) === 'По книгам', `${tag}: switching to РУ`);
    await pickLang(page, 'en');
    // ── the globe language menu (P1-1) ──────────────────────────────────────────────────────────────────
    {
      const btn = page.locator('.sitenav .lang-btn');
      const box = await btn.boundingBox();
      check(box.width >= 44 && box.height >= 44, `${tag}: the language button is a 44 px target (${Math.round(box.width)}x${Math.round(box.height)})`);
      check(await page.locator('.sitenav .lang-switch').count() === 0, `${tag}: the four EN | 简 | 繁 | РУ buttons are gone`);
      check((await btn.getAttribute('aria-haspopup')) === 'menu' && (await btn.getAttribute('aria-expanded')) === 'false', `${tag}: it says it opens a menu and that the menu is shut`);
      check(/^Language: English$/.test(await btn.getAttribute('aria-label')), `${tag}: its name is in the language being read ("${await btn.getAttribute('aria-label')}")`);
      // Enter opens it and focus lands on the current reading
      await btn.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.lang-pop:not([hidden])');
      check((await btn.getAttribute('aria-expanded')) === 'true', `${tag}: Enter opens it and aria-expanded follows`);
      const roles = await page.evaluate(() => ({
        menu: document.querySelector('.lang-pop').getAttribute('role'),
        items: [...document.querySelectorAll('.lang-pop [role="menuitemradio"]')].map((b) => [b.dataset.locale, b.textContent.trim(), b.getAttribute('aria-checked'), b.lang]),
      }));
      check(roles.menu === 'menu' && roles.items.length === 4, `${tag}: it is a menu of four readings`);
      check(JSON.stringify(roles.items.map((i) => i[0])) === JSON.stringify(['en', 'zh-Hans', 'zh-Hant', 'ru']), `${tag}: en, zh-Hans, zh-Hant, ru`);
      check(JSON.stringify(roles.items.map((i) => i[1])) === JSON.stringify(['English', '简体中文', '繁體中文', 'Русский']), `${tag}: each reading is named in its own language (${roles.items.map((i) => i[1]).join(' / ')})`);
      check(roles.items.every((i) => i[3] === i[0]), `${tag}: every row carries its own lang attribute, so it is pronounced right`);
      check(roles.items.filter((i) => i[2] === 'true').length === 1 && roles.items.find((i) => i[2] === 'true')[0] === 'en', `${tag}: exactly one row is checked, and it is the current reading`);
      check(await page.evaluate(() => document.activeElement?.dataset?.locale === 'en'), `${tag}: focus opens on the current reading`);
      const small = await page.evaluate(() => [...document.querySelectorAll('.lang-pop [role="menuitemradio"]')].filter((b) => b.getBoundingClientRect().height < 43.5).length);
      check(small === 0, `${tag}: every row is at least 44 px tall`, `${tag}: ${small} short rows`);
      // arrows move, Home/End jump, Escape closes and gives focus back
      await page.keyboard.press('ArrowDown');
      check(await page.evaluate(() => document.activeElement?.dataset?.locale === 'zh-Hans'), `${tag}: ArrowDown moves inside the menu`);
      await page.keyboard.press('End');
      check(await page.evaluate(() => document.activeElement?.dataset?.locale === 'ru'), `${tag}: End goes to the last reading`);
      await page.keyboard.press('ArrowDown');
      check(await page.evaluate(() => document.activeElement?.dataset?.locale === 'en'), `${tag}: the arrows wrap round`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('.lang-pop').hidden);
      check(await page.evaluate(() => document.activeElement?.classList.contains('lang-btn')), `${tag}: Escape closes it and focus returns to the globe`);
      // choosing a reading applies at once, with no reload, and the title and <html lang> follow
      const was = await page.evaluate(() => performance.getEntriesByType('navigation').length);
      await pickLang(page, 'zh-Hant');
      await page.waitForFunction(() => document.documentElement.lang === 'zh-Hant');
      await page.waitForTimeout(250);
      check((await page.evaluate(() => performance.getEntriesByType('navigation').length)) === was, `${tag}: it applies with no reload`);
      check(/雅偉之界/.test(await page.title()) && !/雅伟之界/.test(await page.title()), `${tag}: the document title follows ("${await page.title()}")`);
      check(/^語言[:：] 繁體中文$/.test(await btn.getAttribute('aria-label')), `${tag}: the button's name is now in 繁體 ("${await btn.getAttribute('aria-label')}")`);
      check(await page.evaluate(() => localStorage.getItem('ydh.locale')) === 'zh-Hant', `${tag}: the choice is remembered`);
      await pickLang(page, 'en');
      await page.waitForFunction(() => document.documentElement.lang === 'en');
    }
    // edition sheet (the reader module's own): opens, is a modal, Escape closes and hands focus back
    await page.click('#hm-edition');
    await page.waitForSelector('dialog.yr-sheet[open] .yr-opt');
    const opts = await page.locator('dialog.yr-sheet[open] [role="radio"].yr-opt').count();
    check(opts === 8, `${tag}: the edition sheet lists the eight editions (${opts})`);
    const ids = await page.locator('dialog.yr-sheet[open] [role="radio"].yr-opt').evaluateAll((els) => els.map((e) => e.dataset.id));
    check(JSON.stringify([...ids].sort()) === JSON.stringify(['asv-yhwh', 'bsb-yhwh', 'cuvs-yhwh', 'cuvs-yhwh-tr', 'kjv', 'rst', 'rst-yhwh', 'web-yhwh']), `${tag}: ...bsb-yhwh, kjv, web-yhwh, asv-yhwh, cuvs-yhwh, cuvs-yhwh-tr, rst-yhwh, rst`, `${tag}: sheet ids ${ids}`);
    check(await page.locator('dialog.yr-sheet[open] [role="radio"].yr-opt[aria-checked="true"]').count() === 1, `${tag}: exactly one edition is checked`);
    check((await page.locator('dialog.yr-sheet[open] [data-id="cuvs-yhwh"] .yr-tag').innerText()) === '©' && (await page.locator('dialog.yr-sheet[open] [data-id="kjv"] .yr-tag').innerText()) === 'Public domain', `${tag}: the Union Version carries the (c) chip, the KJV says public domain`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.yr-sheet[open]'));
    check(await page.evaluate(() => document.activeElement?.id === 'hm-edition'), `${tag}: Escape closes the sheet and focus returns to its button`);
    // choose another edition
    await page.click('#hm-edition'); await page.waitForSelector('dialog.yr-sheet[open] .yr-opt');
    await page.locator('dialog.yr-sheet[open] [data-id="cuvs-yhwh"]').click();
    await page.waitForFunction(() => !document.querySelector('dialog.yr-sheet[open]'));
    check((await page.locator('#hm-edition').innerText()).includes('和合本'), `${tag}: choosing an edition updates the chip`);
    // the choice is the reader's: it is in the shared record, and the picture page reads it
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('yr.prefs.v1')).edition.en === 'cuvs-yhwh'), `${tag}: the choice is kept in the reader's own record`);
    // licences sheet
    await page.click('#hm-all-licences'); await page.waitForSelector('dialog.gx-sheet[open] .gx-lic');
    check((await page.locator('dialog.gx-sheet[open] .gx-lic').count()) === 8, `${tag}: the licences sheet lists a credit per edition (8)`);
    const licText = await page.locator('dialog.gx-sheet[open]').innerText();
    check(/used with permission/.test(licText) && !/1919/.test(licText), `${tag}: the Union Version reads "used with permission" (Words' wording), no year`);
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
    { await page.waitForTimeout(300); const n0 = await page.locator('.sc-card').count(); check(n0 >= 60 && n0 % 60 === 0 && n0 <= 120, `${tag}: the first screen is whole batches of 60 cards (${n0}; the second batch may already have been asked for by the scroll sentinel)`, `${tag}: the first screen has ${n0} cards, wanted one batch of 60`); }
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
    await page.waitForSelector('.yr-passage .yr-v');
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
  // ── picture + passage (the reader module's passage view) ───────────────
  // ── side safe-area insets (iPhone Duo: 84 px on the right in portrait, where its status pill sits over the screen) ──
  // Chromium has no env() insets to emulate, so the --safe-* tokens (tokens.css) are forced to the Duo's values: every control in the top
  // bars of the picture page and the full-screen close button must then lie inside the safe rectangle, and the bar must not scroll sideways.
  if (vp[0] < 500) {
    const DUO = [466, 678]; // the Duo's CSS size: the combination the insets actually come with
    const { ctx, page } = await open(DUO, 'en');
    await page.goto(`${base}/scenes.html#p=genesis-15-1`);
    await page.waitForSelector('.yr-passage .yr-v');
    await page.addStyleTag({ content: 'html:root { --safe-right: 84px !important; --safe-left: 12px !important; }' });
    await page.waitForTimeout(150);
    const rects = await page.evaluate(() => ['#pc-back', '#pc-share', '#pc-feedback', '#pc-prev', '#pc-next', '.sitenav .lang-menu', '.sitenav .gx-search', '.sitenav .brand']
      .map((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { sel, l: Math.round(r.left), r: Math.round(r.right), w: r.width } : { sel, missing: true }; }));
    for (const r of rects) if (r.missing || r.w === 0) continue; else check(r.r <= DUO[0] - 84 && r.l >= 12, `Duo 466: ${r.sel} lies inside the side insets (left ${r.l}, right ${r.r} of ${DUO[0]}, insets 12 / 84)`);
    check(rects.some((r) => r.sel === '#pc-feedback' && !r.missing), `Duo 466: the feedback button is measured`);
    await page.click('#pc-plate');
    await page.waitForSelector('dialog.gx-fs[open]');
    const fs = await page.evaluate(() => document.querySelector('dialog.gx-fs .gx-iconbtn').getBoundingClientRect().right);
    check(fs <= DUO[0] - 84 + 1, `Duo 466: the full-screen close button clears the right inset (right edge ${Math.round(fs)} of ${DUO[0]})`);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open(vp, 'en');
    await page.goto(`${base}/scenes.html#p=genesis-15-1`);
    await page.waitForSelector('.yr-passage .yr-v');
    check((await page.locator('#pc-title').innerText()).length > 3, `${tag}: caption title`);
    check(await page.locator('#pc-plate .gx-plate.is-loaded').count() === 1 || await page.waitForSelector('#pc-plate .gx-plate.is-loaded', { timeout: 15000 }).then(() => true), `${tag}: the plate (text-free square) loaded`);
    const imgSrc = await page.locator('#pc-plate img').getAttribute('src');
    check(/^\/pictures\/full\/genesis-15-1\.webp$/.test(imgSrc), `${tag}: the plate is this site's own file (${imgSrc})`);
    const text = await page.locator('.yr-passage .yr-body').innerText();
    check(!/<H0>|<G0>|<note/.test(text), `${tag}: no markup tags in the verses`);
    check(/God.s Covenant with Abram/.test(await page.locator('.yr-passage .yr-h').first().innerText()), `${tag}: the section heading (小标题) stands over the verses`);
    check((await page.locator('.yr-passage .yr-v').count()) === 12, `${tag}: 12 verses first`);
    await page.click('.yr-passage [data-act="expand"]');
    check((await page.locator('.yr-passage .yr-v').count()) === 21, `${tag}: expanded to all 21`);
    // select two verses, copy: citation, numbered verses, the edition's credit line, a link back to the picture
    await page.locator('.yr-passage .yr-vn').nth(4).click(); await page.locator('.yr-passage .yr-vn').nth(5).click();
    check(await page.locator('.yr-passage .yr-selbar:not([hidden])').count() === 1, `${tag}: selecting verses shows the copy bar`);
    await page.click('.yr-passage [data-act="copySel"]');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check(/^Genesis 15:5.6 \(BSB, Yahweh edition\)\n5 .*\n6 .*\n\nBSB \(Yahweh\) . Berean Standard Bible, public domain \(CC0\); the divine name restored as Yahweh\.\n. Yahweh.s World . https:\/\/world\.yahwehword\.com\/p\/genesis-15-1$/s.test(clip), `${tag}: copy = citation, numbered verses, credit line, source line`, `${tag}: clipboard was ${JSON.stringify(clip)}`);
    // the edition sheet from the passage: the same eight editions
    await page.click('.yr-passage [data-act="edition"]'); await page.waitForSelector('dialog.yr-sheet[open] .yr-opt');
    check(await page.locator('dialog.yr-sheet[open] [role="radio"].yr-opt').count() === 8, `${tag}: the passage's edition sheet lists the eight editions`);
    await page.locator('dialog.yr-sheet[open] [data-id="kjv"]').click();
    await page.waitForFunction(() => !document.querySelector('dialog.yr-sheet[open]'));
    await page.waitForFunction(() => /KJV/.test(document.querySelector('.yr-passage [data-act="edition"]')?.textContent ?? ''));
    check(/Abram/.test(await page.locator('.yr-passage .yr-body').innerText()), `${tag}: choosing KJV re-reads the passage in the KJV`);
    // vertical parallel (对照): two lines per verse, an edition label on each
    await page.click('.yr-passage [data-act="parallelToggle"]'); await page.waitForSelector('.yr-passage .yr-pv');
    const pv = await page.locator('.yr-passage .yr-pv').first().locator('.yr-line').count();
    const labs = await page.locator('.yr-passage .yr-pv').first().locator('.yr-lab').allInnerTexts();
    check(pv === 2 && labs.length === 2, `${tag}: 对照 shows each verse in two editions, one under the other (${labs.join(' / ')})`);
    await page.locator('.yr-passage .yr-vn').first().click();
    await page.click('.yr-passage [data-act="copySel"]');
    const par = await page.evaluate(() => navigator.clipboard.readText());
    check(par.split('\n').length >= 4 && /world\.yahwehword\.com\/p\/genesis-15-1/.test(par), `${tag}: copying a verse in 对照 gives both editions and the link`, `${tag}: parallel copy ${JSON.stringify(par)}`);
    await page.click('.yr-passage [data-act="parallelToggle"]');
    // whole chapter: the Bible page at Genesis 15 (the whole chapter is the picture, so no verse is singled out)
    check(await page.locator('.yr-passage [data-act="whole"]').count() === 1, `${tag}: "Read the whole chapter" is offered`);
    await page.click('.yr-passage [data-act="whole"]');
    await page.waitForURL(/bible\.html#ref=/);
    await page.waitForSelector('.yr-chapter .yr-v');
    check(/Genesis 15/.test(await page.locator('.yr-title').first().innerText()) && /ref=Genesis%2015/.test(page.url()), `${tag}: it opens the Bible page at Genesis 15 (${new URL(page.url()).hash})`);
    check((await page.locator('.yr-chapter .yr-v').count()) === 21, `${tag}: ...with all 21 verses`);
    await page.goBack(); await page.waitForSelector('.yr-passage .yr-v');
    // full screen
    await page.click('#pc-plate'); await page.waitForSelector('dialog.gx-fs[open] img');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog.gx-fs'));
    pass(`${tag}: full screen opens and Escape closes it`);
    // keyboard: arrow right
    await page.evaluate(() => document.body.focus()); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
    check((await page.evaluate(() => location.hash)) !== '#p=genesis-15-1', `${tag}: ArrowRight goes to the next scene`);
    await page.waitForSelector('.yr-passage .yr-v');
    check(await noOverflow(page), `${tag}: no horizontal scroll on the picture page`);
    check(errors.length === 0, `${tag}: picture page has no console error`, `${tag}: ${errors}`);
    await ctx.close();
  }
  // a sub-chapter scene: "whole chapter" marks the scene's own verses
  {
    const { ctx, page } = await open(vp, 'en');
    await page.goto(`${base}/scenes.html#p=genesis-12-1`);
    await page.waitForSelector('.yr-passage .yr-v');
    await page.click('.yr-passage [data-act="whole"]');
    await page.waitForURL(/bible\.html#ref=/);
    await page.waitForSelector('.yr-chapter .yr-v');
    check(/ref=Genesis%2012%3A1-\d+/.test(page.url()) && (await page.locator('.yr-chapter .is-hl').count()) >= 1, `${tag}: a scene inside a chapter opens the chapter with its verses marked (${new URL(page.url()).hash})`);
    await ctx.close();
  }
  // the four languages: the chrome of the passage and the heading follow the site's language
  for (const [lang, copy, head] of [['zh-Hans', '复制', /^(?=.*[\u4e00-\u9fff])(?!.*[\u4e9e])/s], ['zh-Hant', '複製', /^(?=.*[\u4e00-\u9fff])(?!.*伟)/s], ['ru', 'Копировать', /[А-Яа-я]/]]) {
    const { ctx, page } = await open(vp, lang);
    await page.goto(`${base}/scenes.html#p=genesis-15-1`);
    await page.waitForSelector('.yr-passage .yr-v');
    const label = await page.locator('.yr-passage [data-act="copyAll"]').innerText();
    check(label === copy, `${tag} ${lang}: the passage's own buttons speak ${lang} (${label})`);
    const hd = await page.locator('.yr-passage .yr-h').first().innerText();
    check(head.test(hd), `${tag} ${lang}: the heading is in the edition's own language (${hd})`);
    check(!/(?<![A-Za-z])1919(?![A-Za-z])/.test(await page.locator('.yr-passage').innerText()), `${tag} ${lang}: no year 1919 on the picture page`);
    // the site's language switch changes the passage with no reload
    await pickLang(page, 'en');
    await page.waitForFunction(() => document.querySelector('.yr-passage [data-act="copyAll"]')?.textContent === 'Copy');
    pass(`${tag} ${lang}: switching to EN re-renders the passage in English without a reload`);
    await ctx.close();
  }
  // ── feedback: one tap on the picture opens a sheet; nothing is sent until Send ──────────────────────
  {
    const { ctx, page, errors } = await open(vp, 'en');
    const posts = [];
    let mode = 'ok'; // what the mocked /api/feedback answers
    await page.route('**/api/feedback', async (route) => {
      posts.push(JSON.parse(route.request().postData() ?? '{}'));
      if (mode === 'ok') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      if (mode === 'down') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"not_configured"}' });
      if (mode === 'rate') return route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"rate_limited"}' });
      return route.abort();
    });
    await page.goto(`${base}/scenes.html#p=genesis-15-1`);
    await page.waitForSelector('.yr-passage .yr-v');
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort().join());
    const btn = page.locator('#pc-feedback');
    const box = await btn.boundingBox();
    check(box.width >= 44 && box.height >= 44, `${tag}: the feedback button is a 44 px target (${Math.round(box.width)}x${Math.round(box.height)})`);
    const top = await page.locator('#pc-top, .pc-top').first().boundingBox();
    check(box.y < top.y + top.height + 2, `${tag}: it sits in the picture's header, beside Share`);
    check(!!(await btn.getAttribute('aria-label')) && (await btn.getAttribute('aria-haspopup')) === 'dialog', `${tag}: it has a name and says it opens a dialog`);
    await btn.click();
    await page.waitForSelector('dialog.gx-fb[open] form.fb');
    check(posts.length === 0, `${tag}: opening the sheet sends nothing`);
    check(await page.evaluate(() => document.querySelector('dialog.gx-fb').contains(document.activeElement)), `${tag}: focus is inside the sheet`);
    check((await page.locator('dialog.gx-fb [data-r]').count()) === 4 && (await page.locator('dialog.gx-fb textarea').count()) === 1 && (await page.locator('dialog.gx-fb input[type="email"]').count()) === 1, `${tag}: four reasons, a text box and an optional e-mail field`);
    const small = await page.evaluate(() => [...document.querySelectorAll('dialog.gx-fb button, dialog.gx-fb input[type="email"], dialog.gx-fb textarea')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 43.5 && !e.closest('.fb-hp'); }).map((e) => e.className || e.tagName));
    check(!small.length, `${tag}: every control in the sheet is at least 44 px tall`, `${tag}: small controls ${small}`);
    const unlabeled = await page.evaluate(() => [...document.querySelectorAll('dialog.gx-fb textarea, dialog.gx-fb input:not(.fb-hp input)')].filter((e) => !e.labels?.length && !e.getAttribute('aria-label')).length);
    check(unlabeled === 0, `${tag}: the text box and the e-mail field have labels`);
    check(/sets no cookies and does not track you/.test(await page.locator('.fb-privacy').innerText()), `${tag}: a short privacy line says what happens to the note`);
    // accessibility (axe), with the sheet open and finished sliding in (axe reads the colours of a half-transparent sheet wrongly)
    await page.waitForTimeout(450);
    await page.addScriptTag({ path: join(ROOT, 'node_modules/axe-core/axe.min.js') });
    const ax = await page.evaluate(async () => { const r = await window.axe.run({ include: [['dialog.gx-fb']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }); return r.violations.map((v) => `${v.id}(${v.impact}) ${v.nodes.length}`); });
    check(!ax.length, `${tag}: axe finds nothing in the open sheet`, `${tag}: axe ${ax}`);
    // Escape closes and hands focus back; Cancel closes; neither sends
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.gx-fb'));
    check(await page.evaluate(() => document.activeElement?.id === 'pc-feedback'), `${tag}: Escape closes the sheet and focus returns to the button`);
    await btn.click(); await page.waitForSelector('dialog.gx-fb[open]');
    await page.fill('dialog.gx-fb textarea', 'a draft I do not send');
    await page.click('dialog.gx-fb [data-cancel]');
    await page.waitForFunction(() => !document.querySelector('dialog.gx-fb'));
    check(posts.length === 0, `${tag}: Cancel sends nothing, even with text typed`);
    // an empty report is REFUSED (P1-11): Send is disabled, a line says why, and one ticked reason is enough
    await btn.click(); await page.waitForSelector('dialog.gx-fb[open]');
    check((await page.locator('dialog.gx-fb textarea').inputValue()) === '', `${tag}: the sheet opens empty again (nothing was kept)`);
    check(await page.locator('dialog.gx-fb [data-send]').isDisabled(), `${tag}: Send is disabled on an untouched form`);
    check(await page.locator('dialog.gx-fb #fb-need:not([hidden])').count() === 1 && (await page.locator('dialog.gx-fb [data-send]').getAttribute('aria-describedby')) === 'fb-need', `${tag}: a line says what is needed, and Send points at it`);
    await page.fill('dialog.gx-fb textarea', ' ');
    check(await page.locator('dialog.gx-fb [data-send]').isDisabled(), `${tag}: whitespace is not a report`);
    await page.fill('dialog.gx-fb textarea', '');
    await page.click('dialog.gx-fb [data-r="picture"]');
    await page.waitForFunction(() => !document.querySelector('dialog.gx-fb [data-send]').disabled);
    check(await page.locator('dialog.gx-fb #fb-need').isHidden(), `${tag}: one ticked reason is enough, and the line goes`);
    await page.click('dialog.gx-fb [data-send]');
    await page.waitForSelector('dialog.gx-fb .fb-done:not([hidden])');
    check(posts.length === 1 && posts[0].pictureId === 'genesis-15-1' && posts[0].message === '' && JSON.stringify(posts[0].reasons) === '["picture"]', `${tag}: a reason with no words is sent`, `${tag}: ${JSON.stringify(posts[0])}`);
    const c = posts[0].context;
    check(c.lang === 'en' && c.edition === 'bsb-yhwh' && /^Genesis 15:1.21$/.test(c.ref) && /#p=genesis-15-1$/.test(c.url) && /^(auto \((dark|paper)\)|dark|light|paper)$/.test(c.theme) && c.userAgent.length > 10 && /^\d{4}-\d\d-\d\dT/.test(c.time) && /^\d+x\d+$/.test(c.viewport), `${tag}: the context carries reference, page, language, edition, theme, browser, time`, `${tag}: ${JSON.stringify(c)}`);
    check(/Thank you/.test(await page.locator('dialog.gx-fb .fb-done').innerText()), `${tag}: success says thank you`);
    check(await page.evaluate(() => document.activeElement?.classList.contains('fb-done')), `${tag}: ...and focus moves to the message`);
    await page.click('dialog.gx-fb [data-done]'); await page.waitForFunction(() => !document.querySelector('dialog.gx-fb'));
    // reasons, text and an address
    await btn.click(); await page.waitForSelector('dialog.gx-fb[open]');
    await page.click('dialog.gx-fb [data-r="picture"]'); await page.click('dialog.gx-fb [data-r="bible"]');
    check((await page.locator('dialog.gx-fb [data-r="picture"]').getAttribute('aria-pressed')) === 'true', `${tag}: a reason can be ticked (aria-pressed)`);
    await page.fill('dialog.gx-fb textarea', 'The stars are wrong.');
    await page.fill('dialog.gx-fb input[type="email"]', 'not an address');
    await page.click('dialog.gx-fb [data-send]');
    await page.waitForSelector('dialog.gx-fb #fb-mail-err:not([hidden])');
    check(posts.length === 1 && (await page.locator('#fb-mail').getAttribute('aria-invalid')) === 'true', `${tag}: a malformed address is named and nothing is sent`);
    await page.fill('dialog.gx-fb input[type="email"]', 'reader@example.test');
    await page.click('dialog.gx-fb [data-send]');
    await page.waitForSelector('dialog.gx-fb .fb-done:not([hidden])');
    check(posts.length === 2 && JSON.stringify(posts[1].reasons.sort()) === '["bible","picture"]' && posts[1].message === 'The stars are wrong.' && posts[1].email === 'reader@example.test', `${tag}: reasons, text and address are sent as chosen`, `${tag}: ${JSON.stringify(posts[1])}`);
    await page.click('dialog.gx-fb [data-done]');
    // the function is not set up (503): a clear message, the text kept, a prefilled mailto: link, and Try again works
    mode = 'down';
    await btn.click(); await page.waitForSelector('dialog.gx-fb[open]');
    await page.click('dialog.gx-fb [data-r="caption"]');
    await page.fill('dialog.gx-fb textarea', 'Wrong reference please.');
    await page.click('dialog.gx-fb [data-send]');
    await page.waitForSelector('dialog.gx-fb .fb-fallback:not([hidden])');
    check(/could not be sent/.test(await page.locator('dialog.gx-fb .fb-live').innerText()), `${tag}: a failure is said plainly in the live region`);
    check((await page.locator('dialog.gx-fb .fb-live').getAttribute('aria-live')) === 'polite' && (await page.locator('dialog.gx-fb .fb-live').getAttribute('role')) === 'status', `${tag}: ...which is a polite status region`);
    check((await page.locator('dialog.gx-fb textarea').inputValue()) === 'Wrong reference please.', `${tag}: the typed text is still there`);
    const href = await page.locator('#fb-mailto').getAttribute('href');
    const mb = decodeURIComponent(href.split('body=')[1] ?? '');
    check(href.startsWith('mailto:support@yahwehword.com?subject=') && mb.includes('Wrong reference please.') && mb.includes('genesis-15-1') && mb.includes('Genesis 15:1') && mb.includes('Language: en') && mb.includes('Edition: bsb-yhwh') && mb.includes('Caption or reference wrong'), `${tag}: the fallback is a mailto: to support@yahwehword.com with the same context`, `${tag}: ${href.slice(0, 200)}`);
    check(href.length < 3000, `${tag}: the mailto: link is short enough for any mail client (${href.length})`);
    mode = 'ok';
    await page.click('dialog.gx-fb [data-send]');
    await page.waitForSelector('dialog.gx-fb .fb-done:not([hidden])');
    pass(`${tag}: Try again sends once the service is back`);
    await page.click('dialog.gx-fb [data-done]');
    // the network fails altogether, and the daily limit
    for (const m of ['abort', 'rate']) {
      mode = m;
      await btn.click(); await page.waitForSelector('dialog.gx-fb[open]');
      await page.click('dialog.gx-fb [data-r="other"]');   // Send needs a reason or words (P1-11)
      await page.click('dialog.gx-fb [data-send]');
      await page.waitForSelector('dialog.gx-fb .fb-fallback:not([hidden])');
      const msg = await page.locator('dialog.gx-fb .fb-live').innerText();
      check(m === 'rate' ? /Too many/.test(msg) : /could not be sent/.test(msg), `${tag}: ${m === 'rate' ? 'the daily limit is explained' : 'a dead network is explained'}, with the mailto: way out`);
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog.gx-fb'));
    }
    // the honeypot: a filled hidden field is never posted by the page
    const before = posts.length;
    await btn.click(); await page.waitForSelector('dialog.gx-fb[open]');
    await page.click('dialog.gx-fb [data-r="other"]');
    await page.evaluate(() => { document.querySelector('dialog.gx-fb input[name="website"]').value = 'x'; });
    await page.click('dialog.gx-fb [data-send]'); await page.waitForTimeout(200);
    check(posts.length === before, `${tag}: the hidden honeypot field stops a bot before any request`);
    await page.keyboard.press('Escape');
    // no personal data kept: no new storage key, no cookie
    check(await page.evaluate(() => Object.keys(localStorage).sort().join()) === keysBefore && (await page.evaluate(() => document.cookie)) === '', `${tag}: nothing is stored: no storage key was added, no cookie`);
    check(await noOverflow(page), `${tag}: no horizontal scroll with the sheet used`);
    check(errors.length === 0, `${tag}: no console error through all of it`, `${tag}: ${errors}`);
    await ctx.close();
  }
  // the sheet in all four languages and all three reading themes: words, labels, contrast
  for (const lang of ['en', 'zh-Hans', 'zh-Hant', 'ru']) for (const theme of ['dark', 'light', 'paper']) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: vp[0], height: vp[1] }, hasTouch: vp[0] < 500, isMobile: vp[0] < 500, colorScheme: theme === 'dark' ? 'dark' : 'light' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.addInitScript(([l, th]) => { try { localStorage.setItem('ydh.locale', l); localStorage.setItem('yr.prefs.v1', JSON.stringify({ theme: th })); } catch { /* */ } }, [lang, theme]);
    const page = await ctx.newPage();
    await page.goto(`${base}/scenes.html#p=genesis-15-1`);
    await page.waitForSelector('.yr-passage .yr-v');
    await page.click('#pc-feedback'); await page.waitForSelector('dialog.gx-fb[open] form.fb');
    await page.waitForTimeout(350);
    const w = await page.evaluate(() => ({ title: document.querySelector('dialog.gx-fb h2').textContent, send: document.querySelector('[data-send]').textContent, cancel: document.querySelector('[data-cancel]').textContent, chips: [...document.querySelectorAll('dialog.gx-fb [data-r]')].map((b) => b.textContent), theme: document.querySelector('dialog.gx-fb').dataset.theme, lang: document.querySelector('dialog.gx-fb').lang }));
    const WANT = { en: ['Send', 'Cancel', /[A-Za-z]/], 'zh-Hans': ['发送', '取消', /[一-鿿]/], 'zh-Hant': ['發送', '取消', /[一-鿿]/], ru: ['Отправить', 'Отмена', /[А-Яа-я]/] }[lang];
    check(w.send === WANT[0] && w.cancel === WANT[1] && w.chips.every((c) => WANT[2].test(c)) && w.chips.length === 4, `${tag} ${lang} ${theme}: the sheet speaks ${lang} (${w.title} / ${w.send})`, `${tag} ${lang}: ${JSON.stringify(w)}`);
    if (lang === 'zh-Hant') check(!/[头无从误译载]/.test(await page.locator('dialog.gx-fb').innerText()), `${tag} zh-Hant ${theme}: no Simplified characters in the sheet`);
    check(w.theme === theme && w.lang === lang, `${tag} ${lang} ${theme}: it follows the reading theme and the language (${w.theme}, lang=${w.lang})`);
    const low = await page.evaluate(() => {
      const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const d = document.querySelector('dialog.gx-fb');
      const out = [];
      for (const el of d.querySelectorAll('h2, .fb-ctx, .fb-l, .fb-privacy, .gx-pill, [data-send], [data-cancel], textarea, #fb-mail')) {
        const own = el.matches('[data-send]') ? getComputedStyle(el).backgroundColor : el.matches('textarea, input') ? getComputedStyle(el).backgroundColor : getComputedStyle(d).backgroundColor;
        const fg = rgb(getComputedStyle(el).color), bg = rgb(own);
        const [x, y] = [lum(fg), lum(bg)].sort((m, n) => n - m);
        const cr = (x + 0.05) / (y + 0.05);
        if (cr < 4.5) out.push(`${el.className || el.tagName} ${cr.toFixed(2)}`);
      }
      return out;
    });
    check(!low.length, `${tag} ${lang} ${theme}: no text in the sheet under 4.5:1`, `${tag} ${lang} ${theme}: contrast ${[...new Set(low)]}`);
    await ctx.close();
  }
  // the Bible page
  {
    const { ctx, page, errors } = await open(vp, 'en');
    await page.goto(`${base}/bible.html#ref=Psalm%20119`);
    await page.waitForSelector('.yr-chapter .yr-v');
    check(/Psalms? 119/.test(await page.locator('.yr-title').first().innerText()), `${tag}: the Bible page opens Psalm 119`);
    check(await page.evaluate(() => [...document.querySelectorAll('.sitenav .tab')].some((a) => a.getAttribute('aria-current') === 'page' && /Bible/.test(a.textContent))), `${tag}: the Bible tab is the current one`);
    await page.click('.yr-chapter [data-act="mode"][data-id="parallel"]'); await page.waitForSelector('.yr-chapter .yr-pv');
    check(await noOverflow(page), `${tag}: no horizontal scroll in 对照`);
    await page.click('.yr-chapter [data-act="display"]'); await page.waitForSelector('dialog.yr-sheet[open] [data-act="theme"]');
    await page.locator('dialog.yr-sheet[open] [data-act="theme"][data-id="paper"]').click();
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => document.querySelector('.yr-chapter').dataset.theme === 'paper' && document.documentElement.dataset.read === 'paper' && JSON.parse(localStorage.getItem('yr.prefs.v1')).theme === 'paper'), `${tag}: choosing paper changes the page, the shared setting and the site's mirror`);
    // the same session: the picture page reads in paper too, and in the same editions
    await page.goto(`${base}/scenes.html#p=genesis-15-1`); await page.waitForSelector('.yr-passage .yr-v, .yr-passage .yr-pv');
    check(await page.evaluate(() => document.querySelector('.yr-passage').dataset.theme === 'paper'), `${tag}: the picture page shares the theme`);
    check(await page.locator('.yr-passage .yr-pv').count() > 0, `${tag}: ...and the layout (the Bible page was left in 对照)`);
    check(errors.length === 0, `${tag}: Bible page has no console error`, `${tag}: ${errors}`);
    await ctx.close();
  }
  // paper: contrast of the reading surface, measured the way the audits do (WCAG ratio against the surface's own ground)
  {
    const ctx0 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: vp[0], height: vp[1] }, colorScheme: 'light' });
    await ctx0.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx0.addInitScript(() => { try { localStorage.setItem('ydh.locale', 'en'); localStorage.setItem('yr.prefs.v1', JSON.stringify({ theme: 'paper' })); } catch { /* */ } });
    const page = await ctx0.newPage();
    await page.goto(`${base}/scenes.html#p=genesis-15-1`); await page.waitForSelector('.yr-passage .yr-v');
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.yr-passage')).backgroundColor);
    check(/rgb\(24[0-9], 23[0-9], 22[0-9]\)|rgb\(244, 239, 228\)/.test(bg), `${tag}: paper makes the text column light (${bg})`);
    const low = await page.evaluate(() => {
      const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ground = rgb(getComputedStyle(document.querySelector('.yr-passage')).backgroundColor);
      const out = [];
      for (const el of document.querySelectorAll('.yr-passage .yr-h, .yr-passage .yr-t, .yr-passage .yr-credit li, .yr-passage .yr-pill, .yr-passage .yr-vn')) {
        const fg = rgb(getComputedStyle(el).color);
        const [x, y] = [lum(fg), lum(ground)].sort((m, n) => n - m);
        const cr = (x + 0.05) / (y + 0.05);
        if (cr < 4.5) out.push(`${el.className || el.tagName} ${cr.toFixed(2)}`);
      }
      return out;
    });
    check(!low.length, `${tag}: paper text column has no text under 4.5:1`, `${tag}: paper contrast ${[...new Set(low)]}`);
    await ctx0.close();
  }
  // a scene whose picture the gate has not passed still has its page (the first held one in this build, if there is one)
  const heldId = JSON.parse(readFileSync(join(DIR, 'data/gallery/index.json'), 'utf8')).ev.find((r) => r[7] !== 1)?.[0];
  if (heldId) {
    const { ctx, page } = await open(vp, 'zh-Hans');
    await page.goto(`${base}/scenes.html#p=${heldId}`);
    await page.waitForSelector('.yr-passage .yr-v');
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
    await page.route('**/data/reader/text/**', (r) => (allow ? r.continue() : r.abort()));
    await page.goto(`${base}/scenes.html#p=genesis-15-1`);
    await page.waitForSelector('.yr-passage .yr-state');
    check(await page.locator('#pc-plate .gx-plate').count() === 1, `${tag}: with the verses failing, the picture and caption still show`);
    allow = true;
    await page.click('.yr-passage .yr-state [data-act="retry"]');
    await page.waitForSelector('.yr-passage .yr-v', { timeout: 10000 });
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
// ── the plates in the reader ────────────────────────────────────────────────────────────────────────────────────
// The product is the picture AND the Scripture in one view. These are the checks that would have caught the
// regression the owner reported: /bible.html showed bare text for the whole gallery release.
{
  const tag = 'plates';
  const { ctx, page } = await open([375, 812], 'en');
  await page.goto(`${base}/bible.html#ref=Genesis%201`);
  await page.waitForSelector('figure.yr-plate img', { timeout: 15000 });
  await page.waitForFunction(() => (window.__yrPerf?.plates ?? 0) > 0, null, { timeout: 15000 });

  // Genesis 1 holds three scenes, beginning at 1:1, 1:14 and 1:26 (public/data/gallery/index.json).
  const seen = await page.locator('figure.yr-plate').evaluateAll((els) => els.map((e) => ({
    scene: e.dataset.scene, v: e.dataset.v, href: e.querySelector('a')?.getAttribute('href'),
    alt: e.querySelector('img')?.getAttribute('alt'), cap: e.querySelector('figcaption')?.textContent,
    lazy: e.querySelector('img')?.getAttribute('loading'), w: e.querySelector('img')?.getAttribute('width'),
  })));
  check(seen.length === 3, `${tag}: Genesis 1 draws 3 plates (${seen.length})`);
  check(seen.map((p) => p.v).join(' ') === '1:1 1:14 1:26', `${tag}: at the verses their scenes begin (${seen.map((p) => p.v).join(' ')})`);
  check(seen.every((p) => p.alt && p.cap && p.alt === p.cap), `${tag}: every plate has a caption and the same alt text`);
  check(seen.every((p) => p.lazy === 'lazy' && p.w), `${tag}: every plate is lazy and reserves its box`);

  // every link resolves to a real picture page, and the thumbnail itself actually loaded
  for (const p of seen) {
    const r = await page.request.get(`${base}${p.href.split('#')[0]}`);
    check(r.ok(), `${tag}: ${p.scene} links to a page that exists (${r.status()})`);
  }
  const drawn = await page.evaluate(() => [...document.querySelectorAll('figure.yr-plate img')].filter((i) => i.complete && i.naturalWidth > 0).length);
  check(drawn >= 1, `${tag}: the first plate's thumbnail is painted (${drawn}/3 in view)`);
  check(await noOverflow(page), `${tag}: a plate never pushes the page sideways`);

  // the plate must follow its heading and stand before its own verse, as the old reader drew it
  const order = await page.evaluate(() => {
    const b = document.querySelector('.yr-body');
    const i = (sel) => [...b.querySelectorAll('*')].indexOf(b.querySelector(sel));
    return { head: i('.yr-hd'), plate: i('figure.yr-plate'), verse: i('[data-k="1001"]') };
  });
  check(order.head >= 0 && order.head < order.plate && order.plate < order.verse,
    `${tag}: heading, then the plate, then the verse (${order.head} < ${order.plate} < ${order.verse})`);

  // all three layouts keep them, and none lands inside a paragraph or a verse row
  for (const mode of ['paragraph', 'parallel']) {
    await page.click(`.yr-seg button[data-id="${mode}"]`);
    await page.waitForFunction((m) => window.__yrPerf && document.querySelector(`.yr-seg button[data-id="${m}"][aria-pressed="true"]`), mode);
    await page.waitForSelector('figure.yr-plate');
    const n = await page.locator('figure.yr-plate').count();
    const bad2 = await page.evaluate(() => [...document.querySelectorAll('figure.yr-plate')].filter((f) => f.closest('p.yr-p, .yr-pv')).length);
    check(n === 3 && bad2 === 0, `${tag}: ${mode} layout keeps 3 plates, none inside a paragraph or a verse row (${n}, ${bad2} misplaced)`);
  }

  // a chapter with no scene of its own draws none (and does not repeat the one that runs into it)
  await page.click('.yr-seg button[data-id="verse"]');
  await page.goto(`${base}/bible.html#ref=Genesis%202`);
  await page.waitForFunction(() => window.__yrPerf?.verses > 0, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const g2 = await page.locator('figure.yr-plate').evaluateAll((els) => els.map((e) => e.dataset.v));
  check(g2.every((v) => v.startsWith('2:')), `${tag}: Genesis 2 draws only scenes that begin in Genesis 2 (${g2.join(' ') || 'none'})`);

  // the caption follows the interface language
  for (const [l, want] of [['zh-Hans', '起初创造天地'], ['zh-Hant', '起初創造天地'], ['ru', 'Сотворение мира']]) {
    await page.goto(`${base}/bible.html#ref=Genesis%201`);
    await page.waitForSelector('figure.yr-plate figcaption');
    await pickLang(page, l);
    await page.waitForFunction((x) => document.documentElement.lang === x, l);
    await page.waitForTimeout(400);
    const cap = (await page.locator('figure.yr-plate figcaption').first().innerText()).trim();
    check(cap === want, `${tag}: the caption is ${l} (${cap})`);
  }
  await ctx.close();
}


// ── THE READING SURFACE, on every page, in all four states, in all four languages ──────────────────────────────
// The home footer's switch was a visible no-op: it set html[data-read] and the reader honoured it, but the page the
// control lives on did not move (P0-6). It paints every surface now, so this is the check that it does, and that
// nothing a reader reads drops under WCAG AA on any of them. The ratio is computed the way a browser composites:
// the element's own colour over the first ancestor background that is not transparent.
{
  const tag = 'surface';
  const PAGES = [['/', '#hm-title'], ['/scenes.html', '.sc-card .cap'], ['/scenes.html#p=genesis-15-1', '.yr-passage .yr-v'], ['/bible.html#ref=Genesis%201', '.yr-chapter .yr-v'], ['/privacy.html', 'h1'], ['/404.html', 'h1']];
  // What `auto` must resolve to, which is what the reader module's own resolveTheme says: paper on a light system.
  const AUTO = { dark: 'dark', light: 'paper' };
  for (const [theme, scheme] of [['auto', 'dark'], ['auto', 'light'], ['dark', 'dark'], ['light', 'light'], ['paper', 'light']]) {
    const want = theme === 'auto' ? AUTO[scheme] : theme;
    for (const [path, ready] of PAGES) {
      const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 }, colorScheme: scheme });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      await ctx.addInitScript((th) => { try { localStorage.setItem('ydh.locale', 'en'); localStorage.setItem('yr.prefs.v1', JSON.stringify({ theme: th })); } catch { /* */ } }, theme);
      const page = await ctx.newPage();
      await page.goto(`${base}${path}`);
      if (!/404|privacy/.test(path)) await page.waitForSelector(ready, { timeout: 20000 });
      await page.waitForTimeout(250);
      const surf = await page.evaluate(() => document.documentElement.dataset.surf);
      check(surf === want, `${tag} ${theme}/${scheme} ${path}: html[data-surf] is ${want} (${surf})`);
      // the ground really changed, and the <meta name="theme-color"> with it
      const seen = await page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        meta: document.querySelector('meta[name="theme-color"]')?.content,
      }));
      const light = /rgb\((2[0-9]{2}), (2[0-9]{2}), (2[0-9]{2})\)/.test(seen.bg);
      check(want === 'dark' ? !light : light, `${tag} ${theme}/${scheme} ${path}: the page's own ground is ${want === 'dark' ? 'dark' : 'light'} (${seen.bg})`);
      check(seen.meta === { dark: '#0e2b4b', light: '#f8f9fb', paper: '#f4efe4' }[want], `${tag} ${theme}/${scheme} ${path}: theme-color follows (${seen.meta})`);
      // contrast of every piece of text on the page, against the ground it is actually composited over
      const low = await page.evaluate(() => {
        const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null; };
        const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        /** The composited background behind an element: walk up through transparent ancestors. A gradient's stops are
         *  averaged; the scrim over the hero PICTURE is skipped (its text is over a photograph, not over the page). */
        const ground = (el) => {
          let acc = null;
          for (let n = el; n; n = n.parentElement) {
            const st = getComputedStyle(n);
            const img = st.backgroundImage;
            if (img && img !== 'none') {
              const stops = (img.match(/rgba?\([^)]*\)/g) ?? []).map(parse).filter(Boolean).filter((c) => c.a > 0.5);
              if (stops.length) {
                const avg = { r: 0, g: 0, b: 0, a: 1 };
                for (const c of stops) { avg.r += c.r / stops.length; avg.g += c.g / stops.length; avg.b += c.b / stops.length; }
                acc = acc ? over(acc, avg) : avg;
                if (acc.a >= 0.99) return acc;
              }
            }
            const c = parse(st.backgroundColor);
            if (c && c.a > 0) { acc = acc ? over(acc, c) : c; if (acc.a >= 0.99) return acc; }
          }
          return acc ?? { r: 10, g: 30, b: 54, a: 1 };
        };
        const out = [];
        for (const el of document.querySelectorAll('h1, h2, h3, p, a, button, li, span, td, label, legend, summary, figcaption')) {
          if (!el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          if (el.closest('.hm-copy, .gx-plate, .hm-plate')) continue;      // text over a picture: not the page's ground
          const st = getComputedStyle(el);
          if (st.textShadow && st.textShadow !== 'none') continue;          // the same, where the page says so in shadow
          const fg = parse(st.color);
          if (!fg || fg.a < 0.1) continue;
          const px = parseFloat(st.fontSize), bold = parseInt(st.fontWeight, 10) >= 700;
          const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
          const cr = ratio(over(fg, ground(el)), ground(el));
          if (cr < need) out.push(`${el.tagName}.${(el.className || '').toString().split(' ')[0]} ${cr.toFixed(2)}<${need}`);
        }
        return [...new Set(out)];
      });
      check(low.length === 0, `${tag} ${theme}/${scheme} ${path}: every piece of text meets WCAG AA (${await page.locator('body').count()} body)`, `${tag} ${theme}/${scheme} ${path}: ${low.slice(0, 8).join(', ')}`);
      await ctx.close();
    }
  }
  // System follows the system LIVE: no reload, the attribute and the ground both move
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('ydh.locale', 'en'); localStorage.setItem('yr.prefs.v1', JSON.stringify({ theme: 'auto' })); } catch { /* */ } });
  const page = await ctx.newPage();
  await page.goto(`${base}/`);
  await page.waitForSelector('#hm-books a');
  check(await page.evaluate(() => document.documentElement.dataset.surf) === 'dark', `${tag}: System on a dark system is dark`);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.surf === 'paper', null, { timeout: 4000 });
  pass(`${tag}: System follows the system live, with no reload`);
  // the footer switch is no longer a no-op on the page it lives on
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('.hm-theme-pills [data-read="dark"]');
  await page.waitForFunction(() => document.documentElement.dataset.surf === 'dark');
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(before !== after, `${tag}: pressing a surface changes the HOME page itself (${before} -> ${after})`);
  check(await page.evaluate(() => document.querySelector('.hm-theme-pills [data-read="dark"]').getAttribute('aria-pressed')) === 'true', `${tag}: ...and the pill it pressed is the pressed one`);
  // the four pills are one row, not three and one (P0-6)
  const rows = await page.evaluate(() => new Set([...document.querySelectorAll('.hm-theme-pills [data-read]')].map((b) => Math.round(b.getBoundingClientRect().top))).size);
  check(rows === 1, `${tag}: the four pills sit on one row (${rows})`);
  await ctx.close();
}

// ── our own 404 and the privacy page (P0-4, P1-10) ────────────────────────────────────────────────────────────
{
  const tag = 'static';
  for (const [path, want] of [['/404.html', { en: 'That page is not here', 'zh-Hans': '没有这一页', 'zh-Hant': '沒有這一頁', ru: 'Такой страницы нет' }],
    ['/privacy.html', { en: 'Privacy', 'zh-Hans': '隐私', 'zh-Hant': '隱私', ru: 'Конфиденциальность' }]]) {
    for (const lang of ['en', 'zh-Hans', 'zh-Hant', 'ru']) {
      const { ctx, page, errors } = await open([375, 812], lang);
      const res = await page.goto(`${base}${path}`);
      check(res.ok(), `${tag} ${path} ${lang}: the page is served (${res.status()})`);
      check(await page.evaluate((l) => document.documentElement.lang === l, lang), `${tag} ${path} ${lang}: it picks the reading with no bundle`);
      const h1 = (await page.locator('h1').innerText()).trim();
      check(h1 === want[lang], `${tag} ${path} ${lang}: the heading is "${want[lang]}" (${h1})`);
      // exactly one language shows at a time
      const others = await page.evaluate(() => [...document.querySelectorAll('.t')]
        .filter((e) => getComputedStyle(e).display !== 'none')
        .map((e) => [...e.classList].find((c) => ['en', 'hans', 'hant', 'ru'].includes(c))));
      check(new Set(others).size === 1, `${tag} ${path} ${lang}: only one reading is on the page (${[...new Set(others)]})`);
      check(await noOverflow(page), `${tag} ${path} ${lang}: no horizontal scroll`);
      check(errors.length === 0, `${tag} ${path} ${lang}: no console error`, `${tag}: ${errors}`);
      if (path === '/privacy.html') {
        const txt = await page.locator('main').innerText();
        check(/support@yahwehword\.com/.test(txt), `${tag} privacy ${lang}: it says where to write`);
        check(/Netlify/.test(txt), `${tag} privacy ${lang}: it names the host`);
      }
      // no request leaves the page: self-contained, no font, no script bundle, no third party
      const reqs = [];
      page.on('request', (r) => reqs.push(r.url()));
      await page.reload();
      await page.waitForTimeout(300);
      const foreign = reqs.filter((u) => !u.startsWith(base) && !u.startsWith('data:'));
      check(foreign.length === 0, `${tag} ${path} ${lang}: no third-party request`, `${tag}: ${foreign[0]}`);
      await ctx.close();
    }
  }
  // Netlify is told to serve it with the right status for anything unknown
  const red = readFileSync(join(DIR, '_redirects'), 'utf8');
  check(/^\/\*\s+\/404\.html\s+404$/m.test(red), 'static: _redirects ends with /* -> /404.html 404');
  check(/\/privacy\s+\/privacy\.html/.test(red), 'static: /privacy is a short link to the page');
  check(readFileSync(join(DIR, 'sitemap.xml'), 'utf8').includes('/privacy.html'), 'static: the privacy page is in the sitemap');
}

await browser.close(); close();
console.log(bad ? `\n${bad} problem(s), ${ok} ok` : `\nall ${ok} checks ok`);
process.exit(bad ? 1 : 0);
