// The gallery surface's data: the part of events.json the three pages read, in the shape
// they read it, plus the state of each picture.
//
//   node scripts/build-gallery-data.mjs [--check]
//
// Reads    public/data/events.json            (1,443 events: id, zh, en, b, s, e, ref, sum, sumEn, …)
//          data/gallery/pictures.json         (scripts/build-pictures.mjs: pass / hold / excluded per square)
//          public/data/journeys.json          (only the book each journey starts in)
// Writes   public/data/gallery/index.json     what every page needs at start-up: titles, book, verse range,
//                                              the colour placeholder, whether a picture is served
//          public/data/gallery/summaries.json one-line summaries in both languages, loaded on the first
//                                              picture page or the first search
//
// index.json is an array of arrays, not objects: 1,443 repeated key names were a third of the file.
//   ev[i] = [id, book 1..66, startVerse, endVerse, zh title, en title, lqip, served(1|0), ru title]
//   verse numbers are the canonical key bbbcccvvv (book * 1e6 + chapter * 1e3 + verse)
// The reference text ("Genesis 15:1–21") is NOT stored: src/gallery/data.ts builds it from the numbers and
// the book names, in the reader's language and script, which also removes the repeated-chapter form
// ("1:1–1:13") the older payload carries.
//
// --check rebuilds in memory and fails if the files on disk differ (the build runs it after writing).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const read = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

const events = read('public/data/events.json').events;
const pics = existsSync(join(ROOT, 'data/gallery/pictures.json')) ? read('data/gallery/pictures.json') : { p: {} };
const books = read('scripts/books.json');
const journeys = read('public/data/journeys.json').journeys;

// Russian captions: data/gallery/ru/part-*.json, { id: { t: title, s: one-line summary } }. Machine translated under the
// church rules (Words' tools/i18n/translate/terms/ru.md); not read by a native speaker, and the site says so.
const ru = {};
if (existsSync(join(ROOT, 'data/gallery/ru'))) {
  for (const f of readdirSync(join(ROOT, 'data/gallery/ru')).filter((x) => /^part-\d+\.json$/.test(x)).sort()) Object.assign(ru, read(`data/gallery/ru/${f}`));
}
const ev = events.map((e) => {
  const p = pics.p?.[e.id];
  return [e.id, e.b, e.s, e.e, e.zh, e.en, p?.q ?? '', p?.state === 'pass' ? 1 : 0, ru[e.id]?.t ?? ''];
});
const perBook = Array.from({ length: 66 }, () => 0);
for (const e of events) perBook[e.b - 1]++;

// The first plate of each journey's book range (the hash forwarder on the home page sends an old
// /#journey=<id> link there). A journey that cannot be placed is left out: the forwarder then lands on the home page.
const jr = {};
for (const j of journeys) {
  const m = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(j.rangeEn ?? '');
  const b = m ? books.findIndex((x) => x.en === m[1]) + 1 : 0;
  if (!b) continue;
  const start = b * 1e6 + Number(m[2]) * 1e3 + Number(m[3] ?? 1);
  const hit = events.find((e) => e.b === b && e.e >= start) ?? events.find((e) => e.b === b);
  if (hit) jr[j.id] = hit.id;
}

const index = { v: 1, n: ev.length, ok: ev.filter((x) => x[7]).length, books: perBook, jr, ev };
const summaries = { v: 1, zh: events.map((e) => e.sum ?? ''), en: events.map((e) => e.sumEn ?? ''), ru: events.map((e) => ru[e.id]?.s ?? '') };

const out = {
  'public/data/gallery/index.json': JSON.stringify(index),
  'public/data/gallery/summaries.json': JSON.stringify(summaries),
};
let bad = 0;
for (const [rel, text] of Object.entries(out)) {
  const f = join(ROOT, rel);
  if (CHECK) {
    if (!existsSync(f) || readFileSync(f, 'utf8') !== text) { console.error(`FAIL stale ${rel} (run node scripts/build-gallery-data.mjs)`); bad++; }
  } else {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, text);
    console.log(`${rel}: ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB`);
  }
}
if (!CHECK) console.log(`gallery data: ${ev.length} events, ${Object.keys(ru).length} Russian captions, ${index.ok} with a served picture, ${Object.keys(jr).length} journeys placed`);
process.exit(bad ? 1 : 0);
