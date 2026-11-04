// Russian completeness of the gallery (owner, 2026-11-03: Chinese, English and Russian are the three languages that matter).
//
//   node scripts/verify-ru.mjs [--dir dist] [--base http://127.0.0.1:4173] [--json out.json]
//
// Two parts.
//  DATA   every scene has a Russian title and a Russian caption in Cyrillic; the Russian book names cover 66 books; the Russian
//         heading set (Words' docs/headings/ru) has an entry wherever the English set does and all of them are Cyrillic; the two
//         Synodal editions (rst, rst-yhwh) have 66 books, the same chapter and verse shape as the KJV, Cyrillic text, and the only
//         empty verses are the Synodal merges (a verse folded into the one before it).
//  PAGES  with the language set to Russian, every page and sheet a reader can open (home, edition sheet, licences sheet,
//         gallery, search, picture page with its passage / 对照 / edition sheet / feedback sheet, Bible page) is scanned
//         for visible text that carries Latin letters. Allowed: edition abbreviations and the names of the editions' own
//         labels, proper product names, and a verse reference's book-less numbers. Anything else is an English or Chinese
//         string that slipped through, and fails.
// The footer / reading-language note ("not read by a native speaker") must be present on the reader's sheet.
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist } from './lib/dist-server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const DIR = resolve(ROOT, opt('dir', 'dist'));
let bad = 0, ok = 0;
const results = [];
const check = (c, good, badMsg) => { results.push({ ok: !!c, msg: c ? good : badMsg ?? good }); if (c) { ok++; console.log(`ok   ${good}`); } else { bad++; console.error(`FAIL ${badMsg ?? good}`); } };
const CYR = /[Ѐ-ӿ]/;
const json = (f) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));

// ── DATA ────────────────────────────────────────────────────────────────
{
  const ix = json('data/gallery/index.json'), sums = json('data/gallery/summaries.json');
  const noTitle = ix.ev.filter((e) => !e[8] || !CYR.test(e[8])).map((e) => e[0]);
  check(!noTitle.length, `all ${ix.ev.length} scenes have a Cyrillic Russian title`, `${noTitle.length} scenes lack a Russian title: ${noTitle.slice(0, 5)}`);
  const noSum = ix.ev.filter((e, i) => !sums.ru?.[i] || !CYR.test(sums.ru[i])).map((e) => e[0]);
  check(!noSum.length && sums.ru.length === ix.ev.length, `all ${ix.ev.length} captions have a Cyrillic Russian text`, `${noSum.length} captions lack Russian: ${noSum.slice(0, 5)}`);
  const same = ix.ev.filter((e, i) => sums.ru[i] === sums.en[i]).length;
  check(same === 0, 'no Russian caption is the English one copied', `${same} Russian captions equal the English`);
  const latinHeavy = sums.ru.filter((r) => (r.match(/[A-Za-z]/g) ?? []).length > (r.match(/[Ѐ-ӿ]/g) ?? []).length * 0.15).length;
  check(latinHeavy === 0, 'no Russian caption is mostly Latin letters', `${latinHeavy} Russian captions are mostly Latin`);

  const R = join(DIR, 'data/reader/headings');
  const ids = (set) => { const s = new Set(); let noCyr = 0; for (const f of readdirSync(join(R, set))) for (const [c, arr] of Object.entries(JSON.parse(readFileSync(join(R, set, f), 'utf8')))) for (const e of arr) { s.add(`${f}:${c}:${e.v}`); if (set === 'ru' && !CYR.test(e.t)) noCyr++; } return { s, noCyr }; };
  const eng = ids('english-classic'), ru = ids('ru');
  const miss = [...eng.s].filter((x) => !ru.s.has(x));
  check(!miss.length, `the Russian heading set has all ${ru.s.size} headings the English set has`, `${miss.length} headings missing in Russian: ${miss.slice(0, 5)}`);
  check(ru.noCyr === 0, 'every Russian heading is Cyrillic', `${ru.noCyr} Russian headings have no Cyrillic`);

  const T = join(DIR, 'data/reader/text');
  const load = (ed, b) => JSON.parse(readFileSync(join(T, ed, `${b}.json`), 'utf8'));
  for (const ed of ['rst', 'rst-yhwh']) {
    let shape = 0, noCyr = 0, empty = [];
    for (let b = 1; b <= 66; b++) {
      const j = load(ed, b), k = load('kjv', b);
      if (j.length !== k.length || j.some((c, i) => c.length !== k[i].length)) shape++;
      j.forEach((c, i) => c.forEach((v, n) => { if (!v?.trim()) empty.push(`${b}:${i + 1}:${n + 1}`); else if (!CYR.test(v)) noCyr++; }));
    }
    check(shape === 0, `${ed}: 66 books, same chapter and verse shape as the KJV`, `${ed}: ${shape} books differ in shape`);
    check(noCyr === 0, `${ed}: every verse is Cyrillic`, `${ed}: ${noCyr} verses without Cyrillic`);
    // the Synodal text folds these verses into the one before (Acts 19:41 into 19:40, 2 Cor 11:33 into 11:32 ...): Words' bytes, pinned by SHA-256
    check(empty.length <= 8, `${ed}: only the ${empty.length} Synodal merged verses are empty (${empty.join(' ')})`, `${ed}: ${empty.length} empty verses (${empty.join(' ')})`);
  }
}

// ── PAGES ───────────────────────────────────────────────────────────────
// What may stay non-Russian on a Russian page, and why. Each rule is a decision, not a convenience.
const ALLOW = [
  /^(EN|简|繁|РУ)$/,                                                      // the language switch names each language in its own script
  /^(Yahweh's World|雅伟之界|雅偉之界)$/,                                 // the brand lockup carries the name in Chinese and English on every page
  /^Языки: English, 中文/,                                                // the home note names the three languages in their own script
  /和合本|简体中文|繁體中文|繁体中文|雅伟之|雅偉之/,                        // the Chinese editions and the sister apps are listed by their own names
  /^[\u0400-\u04FF][\u0400-\u04FF\s\d]*\d+:\d+.*·\s[A-Z0-9][A-Za-z0-9 ]+\d+:\d+/, // "Бытие 15:1–21 · Genesis 15:1–21": the English reference stays beside the Russian one on purpose
  /^(BSB|KJV|WEB|ASV|CUVS?|СП)[\w-]* ?(\(.*?\))? · /,                      // an edition's credit line is written in the edition's own language, as in Words (it travels with the copied text)
  /^[\s\d:.,;\-–—·©()+/#›‹•«»…]*$/,                                      // numbers, references, punctuation
];
const ALLOW_WORDS = new Set(['BSB', 'KJV', 'WEB', 'ASV', 'CUVS', 'CUV', 'RST', 'CC0', 'PD', 'Words', 'Sword', 'Yahweh', "Yahweh's", 'Yahweh’s', 'YHWH', 'Resend', 'e-mail', 'iPhone', 'Android', 'GitHub', 'Netlify', 'cookie', 'English', 'King', 'James', 'Version', 'Berean', 'Standard', 'Bible', 'World', 'American', 'Revised', 'LORD', 'bereanbible.com', 'ebible.org', 'Public', 'Domain', 'BSB-Y', 'CUVS-Y', 'KJV-Y', 'Yahweh', 'De', 'Hua', 'Ministry', 'eBible.org', 'gutenberg.org', 'www.gutenberg.org', 'russyn', 'Gutenberg', 'Project']);
const stripLegit = (t) => t.replace(/\S+@\S+/g, '').replace(/\b[\w.-]+\.(?:com|org|net|bible)(?:\/\S*)?/g, '').replace(/\bv\d+(?:\.\d+)+\b/g, '').replace(/\b[\w.-]+\.net\/\S+/g, '').replace(/e-mail/gi, '');

async function scan(page) {
  return page.evaluate(() => {
    const out = [];
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && (r.width > 0 || r.height > 0) && !el.closest('[hidden],[aria-hidden="true"],script,style,svg'); };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!t || !/[A-Za-z一-鿿]/.test(t)) continue;
      const el = n.parentElement; if (!el || !vis(el)) continue;
      out.push({ t, cls: el.className?.toString().slice(0, 40) ?? '', tag: el.tagName });
    }
    // attributes a reader hears or sees: aria-label, title, placeholder
    for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
      if (!vis(el)) continue;
      for (const a of ['aria-label', 'title', 'placeholder']) { const v = el.getAttribute(a); if (v && /[A-Za-z一-鿿]/.test(v)) out.push({ t: v, cls: `@${a}`, tag: el.tagName }); }
    }
    return out;
  });
}
const foreign = (items) => items.filter(({ t: raw, cls }) => {
  if (/\byr-t\b/.test(cls)) return false;                          // a verse of another edition in 对照 is data, not interface
  const t = stripLegit(raw);
  if (ALLOW.some((r) => r.test(t))) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return true;                       // Chinese in a Russian page
  // a Russian sentence that names a Latin proper noun (World English Bible, Yahweh) is Russian
  if ((t.match(/[\u0400-\u04FF]/g) ?? []).length > (t.match(/[A-Za-z]/g) ?? []).length) return false;
  const words = t.match(/[A-Za-z][A-Za-z0-9.'’-]+/g) ?? [];
  return words.some((w) => !ALLOW_WORDS.has(w));
});

const own = !opt('base', '');
const srv = own ? await serveDist(DIR) : { base: opt('base'), close() {} };
const base = srv.base;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const seen = {};
async function visit(label, vp, url, wait, act, theme = 'dark') {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: vp[0], height: vp[1] }, hasTouch: vp[0] < 500, isMobile: vp[0] < 500 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript(([l, t]) => { try { localStorage.setItem('ydh.locale', l); localStorage.setItem('yr.prefs.v1', JSON.stringify({ theme: t })); } catch { /* */ } }, ['ru', theme]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + url);
  try { await page.waitForSelector(wait, { timeout: 15000 }); } catch { check(false, '', `${label}: ${wait} never appeared`); }
  await page.waitForTimeout(800);
  if (act) { try { await act(page); } catch (e) { check(false, '', `${label}: step failed: ${e.message.split('\n')[0]}`); } await page.waitForTimeout(500); }
  const lang = await page.evaluate(() => document.documentElement.lang);
  const f = foreign(await scan(page));
  const uniq = [...new Map(f.map((x) => [x.t, x])).values()];
  check(lang === 'ru' && !uniq.length, `${label} (${vp[0]}): Russian, no foreign visible text`, `${label} (${vp[0]}, lang=${lang}): ${uniq.length} foreign strings: ${uniq.slice(0, 8).map((x) => `"${x.t.slice(0, 60)}" [${x.tag}.${x.cls}]`).join(' | ')}`);
  check(errors.length === 0, `${label}: no page error`, `${label}: ${errors}`);
  await ctx.close();
}
for (const vp of [[375, 812], [1440, 900]]) {
  await visit('home', vp, '/', '#hm-books a');
  await visit('home, edition sheet', vp, '/', '#hm-edition', async (p) => { await p.click('#hm-edition'); await p.waitForSelector('dialog.yr-sheet[open] .yr-opt'); });
  await visit('home, licences sheet', vp, '/', '#hm-all-licences', async (p) => { await p.click('#hm-all-licences'); await p.waitForSelector('dialog.gx-sheet[open] .gx-lic'); });
  await visit('gallery', vp, '/scenes.html#b=1', '.sc-card');
  await visit('gallery, one picture', vp, '/scenes.html#p=genesis-15-1', '.yr-passage .yr-v');
  await visit('picture, light', vp, '/scenes.html#p=genesis-15-1', '.yr-passage .yr-v', null, 'light');
  await visit('picture, paper', vp, '/scenes.html#p=genesis-15-1', '.yr-passage .yr-v', null, 'paper');
  await visit('picture, 对照', vp, '/scenes.html#p=genesis-15-1', '.yr-passage .yr-v', async (p) => { await p.click('.yr-passage [data-act="parallelToggle"]'); await p.waitForSelector('.yr-passage .yr-pv'); });
  await visit('picture, edition sheet', vp, '/scenes.html#p=genesis-15-1', '.yr-passage .yr-v', async (p) => { await p.click('.yr-passage [data-act="edition"]'); await p.waitForSelector('dialog.yr-sheet[open] .yr-opt'); });
  await visit('picture, feedback sheet', vp, '/scenes.html#p=genesis-15-1', '.yr-passage .yr-v', async (p) => { await p.click('#pc-feedback'); await p.waitForSelector('dialog.gx-fb[open] form.fb'); });
  await visit('picture, feedback failed', vp, '/scenes.html#p=genesis-15-1', '.yr-passage .yr-v', async (p) => { await p.route('**/api/feedback', (r) => r.fulfill({ status: 503, body: '{"error":"not_configured"}' })); await p.click('#pc-feedback'); await p.waitForSelector('dialog.gx-fb[open] form.fb'); await p.fill('dialog.gx-fb textarea', 'тест'); await p.click('dialog.gx-fb [data-send]'); await p.waitForSelector('dialog.gx-fb .fb-fallback:not([hidden])'); });
  await visit('picture, feedback thanks', vp, '/scenes.html#p=genesis-15-1', '.yr-passage .yr-v', async (p) => { await p.route('**/api/feedback', (r) => r.fulfill({ status: 200, body: '{"ok":true}' })); await p.click('#pc-feedback'); await p.waitForSelector('dialog.gx-fb[open] form.fb'); await p.click('dialog.gx-fb [data-r="other"]'); await p.click('dialog.gx-fb [data-send]'); await p.waitForSelector('dialog.gx-fb .fb-done:not([hidden])'); });
  await visit('Bible page', vp, '/bible.html#ref=Genesis%2015%3A5-6', '.yr-chapter .yr-v');
  await visit('Bible page, 对照', vp, '/bible.html#ref=Psalm%20119&m=parallel', '.yr-chapter .yr-pv');
  await visit('Bible page, reader settings', vp, '/bible.html#ref=Genesis%2015%3A5-6', '.yr-chapter .yr-v', async (p) => { await p.click('[data-act="settings"], [data-act="display"], .yr-pill[data-act="text"]'); await p.waitForSelector('dialog.yr-sheet[open]'); });
}
// "not read by a native speaker" (owner: Russian is complete but labelled): on the home page and in the reader's display sheet
{
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('ydh.locale', 'ru'); } catch { /* */ } });
  const page = await ctx.newPage();
  await page.goto(`${base}/`);
  await page.waitForSelector('#hm-books a');
  check(/ещё не прочитан носителем языка/.test(await page.locator('.hm-note').innerText()), 'home: the Russian note says the text has not been read by a native speaker', 'home: no "not read by a native speaker" note in Russian');
  await page.goto(`${base}/bible.html#ref=Genesis%2015%3A5-6`);
  await page.waitForSelector('.yr-chapter .yr-v');
  await page.click('.yr-pill[data-act="display"], [data-act="display"]');
  await page.waitForSelector('dialog.yr-sheet[open] .yr-hint');
  check(/не вычитан носителем/.test(await page.locator('dialog.yr-sheet[open] .yr-hint').innerText()), 'reader display sheet: the Russian note says the interface has not been read by a native speaker', 'reader display sheet: note missing');
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${bad ? `${bad} FAILED, ` : 'all '}${ok} checks ok`);
const o = opt('json', '');
if (o) writeFileSync(resolve(ROOT, o), JSON.stringify({ ok, bad, results }, null, 1) + '\n');
process.exit(bad ? 1 : 0);
