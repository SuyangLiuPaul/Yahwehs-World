// Turns a raw candidate file into the full event records the review tool and
// the globe consume.
//
// The important half of this script is what it does NOT take from the author.
// An event's name and passage boundary are proposals a reviewer has to judge;
// its geography is not. For each candidate the script resolves the verse range
// against the OpenBible index and attaches whatever places actually appear in
// those verses. So "the Exodus passes through Succoth and Etham" is a fact read
// out of the data, even while "this passage is the Exodus" is still a claim
// awaiting review.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { CHAPTERS } from './chapters.mjs';

const bundle = JSON.parse(readFileSync('public/data/places.json', 'utf8'));
const BOOKS = JSON.parse(readFileSync('scripts/books.json', 'utf8'));

const key = (b, c, v) => b * 1_000_000 + c * 1000 + v;

// Verse key -> place indices, from the same index the timeline runs on.
const versePlaces = new Map();
for (const ev of bundle.events) versePlaces.set(ev.sort, ev.p);

const files = readdirSync('data/events').filter((f) => f.endsWith('.raw.json'));
let total = 0, withPlaces = 0;

for (const file of files) {
  const raw = JSON.parse(readFileSync(`data/events/${file}`, 'utf8'));
  const book = raw.book;
  const meta = BOOKS[book - 1];
  const maxCh = CHAPTERS[book - 1];

  const events = raw.events.map(([id, zh, en, from, to, summaryZh, dateKey]) => {
    const [c1, v1] = from.split(':').map(Number);
    const [c2, v2] = to.split(':').map(Number);
    if (c1 > maxCh || c2 > maxCh) {
      throw new Error(`${id}: chapter out of range for ${meta.en} (has ${maxCh})`);
    }
    const start = key(book, c1, v1);
    const end = key(book, c2, v2);
    if (end < start) throw new Error(`${id}: range ends before it starts`);

    // Every place named anywhere inside the passage, in first-appearance order.
    const seen = [];
    for (const [sort, idxs] of versePlaces) {
      if (sort < start || sort > end) continue;
      for (const i of idxs) if (!seen.includes(i)) seen.push(i);
    }

    const dating = raw.dating[dateKey];
    if (!dating) throw new Error(`${id}: unknown dating group "${dateKey}"`);

    return {
      id: `${meta.en.toLowerCase().replace(/\s+/g, '-')}-${id}`,
      zh, en, book, start, end,
      ref: `${meta.en} ${c1}:${v1}–${c2}:${v2}`,
      refZh: `${meta.zh} ${c1}:${v1}–${c2}:${v2}`,
      summaryZh,
      yearEarly: dating.yearEarly, yearLate: dating.yearLate,
      dateBasis: dating.dateBasis, dateConfidence: dating.dateConfidence,
      placeIds: seen.map((i) => bundle.places[i].id),
      placeNames: seen.map((i) => bundle.places[i].name),
      status: 'candidate',
      notes: '',
    };
  });

  total += events.length;
  withPlaces += events.filter((e) => e.placeIds.length > 0).length;

  const out = {
    meta: {
      book, zh: meta.zh, en: meta.en,
      generated: new Date().toISOString(),
      provenance: raw.provenance,
    },
    events,
  };
  const name = file.replace('.raw.json', '.json');
  writeFileSync(`data/events/${name}`, JSON.stringify(out, null, 2));
  const places = events.reduce((n, e) => n + e.placeIds.length, 0);
  console.log(`${meta.zh.padEnd(6)} ${String(events.length).padStart(3)} 个候选  ·  ${places} 个地点关联  →  data/events/${name}`);
}

console.log(`\n合计 ${total} 个候选，其中 ${withPlaces} 个能关联到至少一处地点（${(withPlaces / total * 100).toFixed(0)}%）`);
console.log(`全部 status = candidate，等待审阅`);
