// Static checks on a built gallery dist/ (VITE_SURFACE=gallery) and on what the gallery pages are made of.
//
//   node scripts/verify-gallery.mjs [--dir dist] [--strict-pictures]
//
// 1 surface     only the three pages are built; no hidden page, no model/figure/material/film/geo asset is published
// 2 words       no 1919 in anything a visitor can read; no 祂, 耶和华, Jehovah, Trinity/位格/Троица/Иегова vocabulary in
//               the captions; no emoji in the gallery's own pages and sources
// 3 pictures    every served picture is the gate's picture: SHA-256 of dist/pictures/full/<id>.webp equals the one
//               recorded by scripts/build-pictures.mjs; no square that did not pass is served; no other host serves any
// 4 urls        /p/<id> exists for every scene and points at /scenes.html#p=<id>; sitemap and robots are there
// 5 links       no gallery page, script or stylesheet links to a hidden page
// --strict-pictures (the release gate, handoff/fable-gallery-release §5.2): every event must be `pass` or owner-excluded
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hitCaption as bannedHit, ZH, EN, RU, NAMES } from './lib/church-vocabulary.mjs';
const CHURCH_TERMS = { zh: [...ZH, ...NAMES.zh], en: [...EN, ...NAMES.en], ru: [...RU, ...NAMES.ru] };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DIR = resolve(ROOT, argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'dist');
const STRICT = argv.includes('--strict-pictures');
let bad = 0, ok = 0;
const pass = (m) => { ok++; console.log(`ok   ${m}`); };
const fail = (m) => { bad++; console.error(`FAIL ${m}`); };
const check = (cond, good, badMsg) => (cond ? pass(good) : fail(badMsg));
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}
if (!existsSync(join(DIR, 'index.html'))) { console.error(`no dist at ${DIR} (run VITE_SURFACE=gallery npm run build)`); process.exit(2); }
const files = [...walk(DIR)];
const rel = (f) => f.slice(DIR.length);

// ── 1 surface ──────────────────────────────────────────────────────────
const HIDDEN_PAGES = ['tabernacle', 'temple', 'ezekiel', 'ark', 'figures', 'figures-springs', 'plan', 'video', 'scene-assembly', 'crowd-test', 'voxel', 'lowpoly', 'rig-test'];
check(HIDDEN_PAGES.every((p) => !existsSync(join(DIR, `${p}.html`))), 'no hidden page is built', `hidden pages in dist: ${HIDDEN_PAGES.filter((p) => existsSync(join(DIR, `${p}.html`)))}`);
check(!existsSync(join(DIR, 'previews')), 'no previews/ folder', 'previews/ is published');
const HEAVY = ['models', 'figures', 'materials', 'film', 'scenes', 'cutouts-webp', 'studies'];
check(HEAVY.every((d) => !existsSync(join(DIR, d))), 'no models/figures/materials/film folder is published', `heavy folders published: ${HEAVY.filter((d) => existsSync(join(DIR, d)))}`);
for (const f of ['data/places.json', 'data/journeys.json', 'data/ne_50m_land.geojson', 'data/terrain-color.webp', 'data/events.json']) check(!existsSync(join(DIR, f)), `${f} is not published`, `${f} is published`);
for (const f of ['index.html', 'scenes.html', 'bible.html', '_redirects', 'sitemap.xml', 'robots.txt', 'version.json']) check(existsSync(join(DIR, f)), `${f} is there`, `${f} is missing`);
const bytes = files.reduce((a, f) => a + statSync(f).size, 0);
const byTop = {};
for (const f of files) { const top = rel(f).split('/')[1] ?? '.'; byTop[top] = (byTop[top] ?? 0) + statSync(f).size; }
console.log(`     dist: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB (${Object.entries(byTop).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${(v / 1048576).toFixed(1)} MB`).join(', ')})`);
// The plan's cap is 300 MB (MiB, as measured since the first report). 2026-11-03 with all 1,443 squares served: pictures 253.0 MB (WebP q76 for both sizes,
// docs/evidence/gallery-2026-11/pictures-quality-sweep.md) + 37.6 MB of Bible text for the eight editions + 2.7 MB of pages and share stubs = 293.3 MB.
// The check was 320 while the owner had not accepted going over; it is back to the plan's number.
const LIMIT_MB = 300;
check(bytes < LIMIT_MB * 1048576, `dist is under ${LIMIT_MB} MB (${(bytes / 1048576).toFixed(1)} MB)`, `dist is ${(bytes / 1048576).toFixed(1)} MB, limit ${LIMIT_MB} MB`);

// ── 2 words ────────────────────────────────────────────────────────────
const TEXTY = new Set(['.html', '.js', '.css', '.json', '.txt', '.xml', '.svg']);
const readable = files.filter((f) => TEXTY.has(extname(f)) && !rel(f).startsWith('/data/reader/text/'));
const YEAR = /(?<![0-9a-fA-F])1919(?![0-9a-fA-F])/;
const withYear = readable.filter((f) => YEAR.test(readFileSync(f, 'utf8')));
// the Bible's own text (the reader's 8 editions, per book) is scanned too: a verse never carries that year, a credit might
const bibleYear = files.filter((f) => rel(f).startsWith('/data/reader/text/') && extname(f) === '.json' && YEAR.test(readFileSync(f, 'utf8')));
check(!withYear.length && !bibleYear.length, 'the year 1919 appears nowhere in dist', `1919 appears in: ${[...withYear, ...bibleYear].map(rel).slice(0, 8)}`);

const idx = read(join(DIR, 'data/gallery/index.json'));
const sums = read(join(DIR, 'data/gallery/summaries.json'));
// The list this gate used to carry was SHORTER than the one
// tests/reader/wording.test.ts carries: no 神性, no 道成肉身, no 本体, no
// 圣子/圣父, no 完全是神/完全是人, no 先存. Three served Chinese captions
// (micah-7-1, matthew-17-1, mark-9-1) said 神性 and this check stayed green.
// Both now read scripts/lib/church-vocabulary.mjs, so there is one list.
const titles = { zh: idx.ev.map((r) => r[4]), en: idx.ev.map((r) => r[5]), ru: idx.ev.map((r) => r[8] ?? '') };
for (const l of ['zh', 'en', 'ru']) {
  const hits = [...titles[l].map((t, i) => [i, t]), ...sums[l].map((t, i) => [i, t])]
    .map(([i, t]) => [i, t, bannedHit[l](t)]).filter(([, , b]) => b);
  check(!hits.length, `${l} captions carry no banned church vocabulary (1,443 titles + summaries, ${CHURCH_TERMS[l].length} terms)`,
    `${l} captions: ${hits.length} banned (e.g. ${hits[0] && idx.ev[hits[0][0]][0]} «${hits[0] && hits[0][2]}»: ${hits[0] && hits[0][1].slice(0, 40)})`);
}
check(idx.ev.every((r) => r[8]), 'every scene has a Russian title', `${idx.ev.filter((r) => !r[8]).length} scenes without a Russian title`);
check(sums.ru.every((s) => s), 'every scene has a Russian summary', `${sums.ru.filter((s) => !s).length} scenes without a Russian summary`);

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const own = ['home.html', 'gallery-scenes.html', 'gallery-bible.html', ...[...walk(join(ROOT, 'src/gallery'))].map((f) => f.slice(ROOT.length + 1)),
  ...[...walk(join(ROOT, 'src/reader'))].map((f) => f.slice(ROOT.length + 1)).filter((f) => /\.(ts|css)$/.test(f))];
const emoji = own.filter((f) => EMOJI.test(readFileSync(join(ROOT, f), 'utf8')));
check(!emoji.length, 'no emoji in the gallery pages and sources', `emoji in: ${emoji}`);
for (const f of ['index.html', 'scenes.html', 'bible.html']) {
  const html = readFileSync(join(DIR, f), 'utf8');
  check(!EMOJI.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), `${f} markup has no emoji`, `${f} markup has emoji`);
}

// ── 2b the reader module's data: the 8 editions, Words' bytes, Words' licence wording ─────────────────
{
  const dir = join(DIR, 'data/reader');
  check(existsSync(join(dir, 'catalogue.json')), 'data/reader/catalogue.json is published', 'data/reader is not in dist (npm run reader:data, then build)');
  if (existsSync(join(dir, 'catalogue.json'))) {
    const cat = read(join(dir, 'catalogue.json'));
    const lock = read(join(ROOT, 'src/reader/sources.lock.json'));
    const WANT = ['bsb-yhwh', 'kjv', 'web-yhwh', 'asv-yhwh', 'cuvs-yhwh', 'cuvs-yhwh-tr', 'rst-yhwh', 'rst'];
    check(JSON.stringify(cat.editions.map((e) => e.id)) === JSON.stringify(WANT), `exactly the 8 editions the owner named are published (${WANT.join(', ')})`, `editions in dist: ${cat.editions.map((e) => e.id)}`);
    const shaBad = cat.editions.filter((e) => lock.files[`assets/${e.id}.json`]?.sha256 !== e.sha256);
    check(!shaBad.length, 'every edition carries the SHA-256 of the Words file it was cut from (pinned in src/reader/sources.lock.json)', `SHA differs from the lock: ${shaBad.map((e) => e.id)}`);
    const missingBooks = WANT.flatMap((id) => Array.from({ length: 66 }, (_x, i) => `text/${id}/${i + 1}.json`)).filter((f) => !existsSync(join(dir, f)));
    check(!missingBooks.length, 'all 66 books of all 8 editions are there', `${missingBooks.length} book files missing (e.g. ${missingBooks[0]})`);
    const heads = ['cuv', 'cuv-tr', 'english-classic', 'ru'].flatMap((h) => Array.from({ length: 66 }, (_x, i) => `headings/${h}/${i + 1}.json`)).filter((f) => !existsSync(join(dir, f)));
    check(!heads.length, 'the four heading sets (小标题) are there for all 66 books', `${heads.length} heading files missing`);
    // Words' record for the church's Union Version editions: used with permission, (c) chip, never public domain
    const cuv = cat.editions.filter((e) => e.id.startsWith('cuvs-yhwh'));
    const claim = cuv.filter((e) => e.licence.kind !== 'permission' || Object.values({ ...e.credit, ...e.licence.note }).some((v) => /public domain|公有|общественное достояние/i.test(v)));
    check(cuv.length === 2 && !claim.length, "the Union Version editions keep Words' wording (used with permission) and are not called public domain", `Union Version licence is wrong in: ${claim.map((e) => e.id)}`);
    const reader = readFileSync(join(DIR, 'bible.html'), 'utf8');
    check(/reader-page|\/assets\/bible-[\w-]+\.js/.test(reader), 'bible.html is the reader module page', 'bible.html is not the reader page');
  }
}

// ── 3 pictures ─────────────────────────────────────────────────────────
const pics = read(join(ROOT, 'data/gallery/pictures.json'));
const ids = idx.ev.map((r) => r[0]);
const missing = ids.filter((id) => !existsSync(join(DIR, 'pictures/full', `${id}.webp`)) || !existsSync(join(DIR, 'pictures/thumb', `${id}.webp`)));
check(!missing.length, `every scene has a thumb and a full file (${ids.length})`, `${missing.length} scenes lack a picture file (e.g. ${missing[0]}) — run node scripts/build-pictures.mjs`);
let served = 0, shaBad = [];
const placeholder = new Set();
for (const id of ids) {
  const e = pics.p[id];
  const f = join(DIR, 'pictures/full', `${id}.webp`);
  if (!e || !existsSync(f)) continue;
  const h = createHash('sha256').update(readFileSync(f)).digest('hex');
  if (e.h && h !== e.h) shaBad.push(id);
  if (e.state === 'pass') served++; else placeholder.add(h);
}
check(!shaBad.length, `served pictures are byte-identical to what the gate passed and the build recorded (${served})`, `${shaBad.length} pictures differ from data/gallery/pictures.json (e.g. ${shaBad[0]})`);
check(placeholder.size <= 1, 'every unserved scene shows the one plain placeholder', `${placeholder.size} different placeholder files`);
const flagged = idx.ev.filter((r) => r[7] === 1 && pics.p[r[0]]?.state !== 'pass');
check(!flagged.length, 'the index marks a picture served only when the gate passed it', `${flagged.length} scenes marked served without a pass`);
const notPass = ids.filter((id) => pics.p[id]?.state === 'hold');
console.log(`     pictures: ${served} served, ${notPass.length} held by the gate, ${ids.filter((id) => pics.p[id]?.state === 'excluded').length} owner-excluded`);
if (STRICT) check(!notPass.length, 'strict: every scene passed or is owner-excluded', `strict: ${notPass.length} scenes neither pass nor excluded (tools/scenes/release-exclusions.json)`);
else if (notPass.length) console.log(`     (not strict: ${notPass.length} held scenes show the placeholder; --strict-pictures is the release gate)`);
const jsAndHtml = files.filter((f) => ['.html', '.js', '.css'].includes(extname(f)) && !rel(f).startsWith('/p/'));
const otherHost = jsAndHtml.filter((f) => /yahwehs-scenes\.netlify\.app/.test(readFileSync(f, 'utf8')));
check(!otherHost.length, 'no page or script reads pictures from another host', `old picture host referenced in: ${otherHost.map(rel)}`);

// ── 4 urls ─────────────────────────────────────────────────────────────
const stubBad = ids.filter((id) => {
  const f = join(DIR, 'p', id, 'index.html');
  return !existsSync(f) || !readFileSync(f, 'utf8').includes(`/scenes.html#p=${id}`);
});
check(!stubBad.length, `/p/<id> exists for all ${ids.length} scenes and points at the picture page`, `${stubBad.length} /p/<id> pages missing or wrong (e.g. ${stubBad[0]})`);
const sm = readFileSync(join(DIR, 'sitemap.xml'), 'utf8');
// Four pages now: home, scenes, bible and the privacy page (P1-10). 404.html is deliberately NOT in the sitemap.
const SITE_PAGES = ['/', '/scenes.html', '/bible.html', '/privacy.html'];
check((sm.match(/<loc>/g) ?? []).length === ids.length + SITE_PAGES.length, `sitemap lists the ${SITE_PAGES.length} pages and ${ids.length} pictures`, `sitemap has ${(sm.match(/<loc>/g) ?? []).length} urls`);
check(SITE_PAGES.every((u) => sm.includes(`<loc>https://world.yahwehword.com${u}</loc>`)), 'sitemap names each page', `missing: ${SITE_PAGES.filter((u) => !sm.includes(`<loc>https://world.yahwehword.com${u}</loc>`))}`);
check(!sm.includes('404.html'), 'the 404 page is not in the sitemap');

// ── 5 links ────────────────────────────────────────────────────────────
const HIDE = /["'`(](?:\/(?:tabernacle|temple|ezekiel|ark|figures|figures-springs|plan|video|scene-assembly)\.html|\/previews\/)/;
const gallery = jsAndHtml.filter((f) => /^\/(index|scenes|bible)\.html$|^\/assets\//.test(rel(f)));
const linking = gallery.filter((f) => HIDE.test(readFileSync(f, 'utf8')));
check(!linking.length, 'no gallery page or script links to a hidden page', `links to hidden pages in: ${linking.map(rel)}`);

console.log(bad ? `\n${bad} problem(s), ${ok} ok` : `\nall ${ok} checks ok`);
process.exit(bad ? 1 : 0);
