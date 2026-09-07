// Produces a complete, reviewable inventory of every place-event the globe can
// draw, grouped book → chapter → verse. This is a coverage document: it says
// exactly what Scripture the map already reaches and, by omission, what it
// does not. Nothing here is authored or inferred — every row comes from the
// OpenBible dataset, so the inventory can be trusted as an audit of the data
// rather than a summary of someone's memory of the Bible.
import { readFileSync, writeFileSync } from 'node:fs';

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
  },
  books: [...books.values()]
    .sort((a, b) => a.n - b.n)
    .map((b) => ({
      n: b.n, en: b.en, zh: b.zh,
      events: b.events,
      places: b.places.size,
      chapters: [...b.chapters.values()]
        .sort((x, y) => x.n - y.n)
        .map((c) => ({ n: c.n, events: c.verses.length, places: [...c.places], verses: c.verses })),
    })),
  // The five books that name no locatable place at all. Stating them keeps the
  // inventory honest: they are not missing data, they simply have no geography.
  booksWithoutPlaces: BOOKS
    .map((b, i) => ({ n: i + 1, ...b }))
    .filter((b) => !books.has(b.n)),
};

writeFileSync('public/data/inventory.json', JSON.stringify(out));

const chapters = out.books.reduce((n, b) => n + b.chapters.length, 0);
console.log(`书卷有地名事件的      ${out.meta.booksCovered}/66`);
console.log(`章节有地名事件的      ${chapters}`);
console.log(`事件（含地名的经文）  ${out.meta.totalEvents}`);
console.log(`地点实例              ${out.meta.totalInstances}`);
console.log(`无地名的书卷          ${out.booksWithoutPlaces.map((b) => b.zh).join('、') || '（无）'}`);
console.log(`输出                  public/data/inventory.json`);
