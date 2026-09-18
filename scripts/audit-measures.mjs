// Proves the Measures panel is on every walk, holds the right cards, and can
// still be read — at both widths, in both readings.
//
// Written because deleting /structures.html moved eight cards into four pages,
// and "the panel opens" is not the claim that matters. The claims that matter
// are countable: which cards a page holds (specs.ts decides, and a walk that
// silently held none would look identical to one that worked), that the cubit
// slider still changes every number on them, and that the model beside them is
// actually drawn rather than a black box with a card over it.
//
// Usage: node scripts/audit-measures.mjs [url] [evidence-dir]   (dev server up)
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const URL = process.argv[2] ?? 'http://localhost:5175';
const DIR = process.argv[3] ?? 'handoff/evidence/measures-in-walks';
await mkdir(DIR, { recursive: true });

// What each page must hold, from the rule in specs.ts: the card goes where the
// thing physically stands. Written out here so the audit is a check and not a
// restatement of the code it is checking.
// `cubitMoves` is whether the cubit slider is expected to change the metres on
// these cards. It is false for New Jerusalem alone, and that is not a defect:
// Revelation 21:16 measures in stadia, not cubits (`unit` in specs.ts), so a
// card that moved with the cubit would be the bug.
const PAGES = [
  { path: '/ark.html', handle: '__ark', cards: ['noah'], cubitMoves: true },
  { path: '/tabernacle.html', handle: '__walk', cards: ['ark', 'court', 'menorah'], cubitMoves: true },
  { path: '/temple.html', handle: '__temple', cards: ['temple', 'pillars', 'bronze-sea'], cubitMoves: true },
  { path: '/plan.html', handle: null, cards: ['newjerusalem'], cubitMoves: false, open: '#measures=newjerusalem' },
];
const VIEWPORTS = [['desktop', 1280, 800], ['phone', 390, 844]];
const LOCALES = [['hans', 'zh-Hans'], ['en', 'en']];

// Real Chrome, as scripts/verify-shared-navigation.mjs uses. The bundled
// headless shell in this checkout never delivers a click to a walk page — it
// hangs on `#model-info` too, which predates the Measures panel — so a sweep
// on it would report a panel that cannot be opened by a reader who can.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
let bad = 0;
const fail = (what, why) => { bad++; console.log(`  FAIL  ${what}: ${why}`); };

for (const [vname, width, height] of VIEWPORTS) {
  for (const [lname, locale] of LOCALES) {
    for (const p of PAGES) {
      const ctx = await browser.newContext({ viewport: { width, height } });
      await ctx.addInitScript((l) => {
        localStorage.setItem('ydh.locale', l);
        // The cubit is remembered across pages now, so a run that inherited a
        // previous one would measure a different card than it says it does.
        localStorage.removeItem('ydh.cubit');
      }, locale);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const label = `${vname}-${lname}${p.path.replace('.html', '').replace('/', '-')}`;

      await page.goto(URL + p.path + (p.open ?? ''), { waitUntil: 'networkidle' });
      if (p.handle) await page.waitForFunction((h) => !!globalThis[h], p.handle, { timeout: 40_000 });
      await page.evaluate(() => document.fonts.ready);

      // The walks open the panel from the gate, which is the one entry a
      // reader has before they are inside; the plan page opens it by hash.
      if (!p.open) await page.click('#gate-measures');
      await page.waitForSelector('#measures-panel[open]', { timeout: 20_000 });
      await page.waitForTimeout(900);   // let the preview draw a few frames

      const seen = await page.$$eval('#measures-panel .mp-card', (els) =>
        els.map((e) => e.dataset.id));
      if (String(seen) !== String(p.cards)) fail(label, `cards ${JSON.stringify(seen)} ≠ ${JSON.stringify(p.cards)}`);

      // The canvas has to have real layout, or the model is a 1×1 pixel behind
      // a card — which is exactly what happens if it is sized before the
      // dialog is opened.
      const stage = await page.$eval('#measures-panel .mp-stage canvas', (c) => ({
        css: [c.clientWidth, c.clientHeight],
        buffer: [c.width, c.height],
      }));
      if (stage.css[0] < 80 || stage.css[1] < 80) fail(label, `stage laid out ${stage.css.join('×')}`);
      if (stage.buffer[0] < 80 || stage.buffer[1] < 80) fail(label, `stage backing store ${stage.buffer.join('×')}`);

      // Nothing in the panel may run off the side of it. The cards are long
      // Chinese paragraphs in a box that is 27rem wide on a desktop and the
      // whole screen on a phone, and a table with four columns in it.
      const overflow = await page.$eval('#measures-panel .mp-body', (b) => b.scrollWidth - b.clientWidth);
      if (overflow > 1) fail(label, `panel scrolls sideways by ${overflow}px`);

      // The cubit is the argument these cards exist to carry: moving it has to
      // move every metre figure on the card in front of the reader.
      const before = await page.$$eval('#measures-panel .mp-card td.m', (t) => t.map((e) => e.textContent));
      await page.$eval('#mp-c-range', (r) => {
        r.value = '1';
        r.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForTimeout(300);
      const after = await page.$$eval('#measures-panel .mp-card td.m', (t) => t.map((e) => e.textContent));
      const moved = before.filter((v, i) => v !== after[i] && /\d/.test(v ?? '')).length;
      const numeric = before.filter((v) => /\d/.test(v ?? '')).length;
      if (p.cubitMoves && numeric && moved < numeric) {
        fail(label, `the cubit moved ${moved} of ${numeric} metre figures`);
      }
      if (!p.cubitMoves && moved) fail(label, `${moved} figures moved with the cubit, and this card is not in cubits`);
      // And where it governs nothing it is not offered at all.
      const cubitShown = await page.$eval('#measures-panel .mp-cubit',
        (e) => getComputedStyle(e).display !== 'none');
      if (cubitShown !== p.cubitMoves) {
        fail(label, `cubit control ${cubitShown ? 'shown' : 'hidden'}, expected the opposite`);
      }
      await page.$eval('#mp-c-range', (r) => {
        r.value = '0';
        r.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForTimeout(400);

      await page.screenshot({ path: `${DIR}/${label}.png` });
      if (errors.length) fail(label, `console: ${errors.join(' | ')}`);

      report.push({
        page: p.path, viewport: vname, locale, cards: seen,
        stage: stage.css.join('×'), cubitControl: cubitShown ? 'shown' : 'hidden',
        cubitCellsMoved: `${moved}/${numeric}`,
        sidewaysOverflowPx: overflow, errors,
      });
      console.log(`  ok    ${label}  cards ${seen.join(',') || '—'}  stage ${stage.css.join('×')}  cubit moved ${moved}/${numeric}`);
      await ctx.close();
    }
  }
}
await browser.close();
await writeFile(`${DIR}/checks.json`, JSON.stringify(report, null, 2) + '\n');
console.log(bad
  ? `\n${bad} checks failed.`
  : `\n${report.length} panel states checked: every card is on the page that holds the thing it measures.`);
process.exit(bad ? 1 : 0);
