// Produces a complete, reviewable inventory of every place-event the globe can
// draw, laid over EVERY chapter of Scripture — all 66 books and all 1,189
// chapters, not only the 852 that happen to name a place.
//
// That distinction is the whole value of the document. Built from the
// geocoding data alone, the ledger silently omits 337 chapters and reads as
// though the map covers the Bible. Listing every chapter and marking the empty
// ones turns it from a list of what exists into an audit of what is missing.
//
// Nothing here is authored or inferred: rows come from the OpenBible dataset
// and the canon's own chapter counts, so this is an audit of the data rather
// than a summary of anyone's memory of the Bible.
import { readFileSync, writeFileSync } from 'node:fs';
import { CHAPTERS } from './chapters.mjs';

const bundle = JSON.parse(readFileSync('public/data/places.json', 'utf8'));
const BOOKS = JSON.parse(readFileSync('scripts/books.json', 'utf8'));

const books = new Map();

for (const ev of bundle.events) {
  const b = Math.floor(ev.sort / 1_000_000);
  const c = Math.floor((ev.sort % 1_000_000) / 1000);
  const v = ev.sort % 1000;

  if (!books.has(b)) books.set(b, { n: b, ...BOOKS[b - 1], chapters: new Map(), places: new Set(), events: 0 });
  const book = books.get(b);
  if (!book.chapters.has(c)) book.chapters.set(c, { n: c, verses: [], places: new Set() });
  const ch = book.chapters.get(c);

  const names = ev.p.map((i) => bundle.places[i].name);
  ch.verses.push({ v, ref: ev.readable, places: names });
  book.events++;
  for (const n of names) { ch.places.add(n); book.places.add(n); }
}

const out = {
  meta: {
    generated: new Date().toISOString(),
    source: bundle.meta.source,
    license: bundle.meta.license,
    totalEvents: bundle.events.length,
    totalInstances: bundle.meta.instances,
    totalPlaces: bundle.meta.located,
    booksCovered: books.size,
    booksTotal: 66,
    chaptersTotal: CHAPTERS.reduce((a, b) => a + b, 0),
  },
  // Every book, every chapter — a chapter with no locatable place still gets a
  // row, carrying an empty place list rather than being dropped.
  books: BOOKS.map((meta, idx) => {
    const n = idx + 1;
    const found = books.get(n);
    const total = CHAPTERS[idx];
    const chapters = [];
    for (let c = 1; c <= total; c++) {
      const hit = found?.chapters.get(c);
      chapters.push(hit
        ? { n: c, events: hit.verses.length, places: [...hit.places], verses: hit.verses }
        : { n: c, events: 0, places: [], verses: [] });
    }
    return {
      n, en: meta.en, zh: meta.zh,
      events: found?.events ?? 0,
      places: found?.places.size ?? 0,
      totalChapters: total,
      coveredChapters: chapters.filter((c) => c.events > 0).length,
      chapters,
    };
  }),
  // The five books that name no locatable place at all. Stating them keeps the
  // inventory honest: they are not missing data, they simply have no geography.
  booksWithoutPlaces: BOOKS
    .map((b, i) => ({ n: i + 1, ...b }))
    .filter((b) => !books.has(b.n)),
};

writeFileSync('public/data/inventory.json', JSON.stringify(out));

const covered = out.books.reduce((n, b) => n + b.coveredChapters, 0);
const listed = out.books.reduce((n, b) => n + b.chapters.length, 0);
if (listed !== out.meta.chaptersTotal) throw new Error(`listed ${listed} chapters, canon has ${out.meta.chaptersTotal}`);
console.log(`书卷有地名事件的      ${out.meta.booksCovered}/66`);
console.log(`章节全部列出          ${listed}（正典总章数）`);
console.log(`  其中有地名事件      ${covered}`);
console.log(`  其中没有地名        ${listed - covered}`);
console.log(`事件（含地名的经文）  ${out.meta.totalEvents}`);
console.log(`地点实例              ${out.meta.totalInstances}`);
console.log(`无地名的书卷          ${out.booksWithoutPlaces.map((b) => b.zh).join('、') || '（无）'}`);
console.log(`输出                  public/data/inventory.json`);
