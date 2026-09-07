// Imports the chronology already built and audited in SeekSparks, rather than
// authoring a second one.
//
// SeekSparks anchors every biblical year to Solomon's accession (Thiele) and
// counts back through intervals the text states, listing for each event the
// verses its own chain runs through. That is a decided position, documented and
// shipped in three languages, and it is the owner's to make — so this importer
// takes his years, his basis flags and his approximate flags unchanged.
//
// What it ADDS is geography: each event's `refs` are resolved into canonical
// verse ranges and matched against the OpenBible index, so an event arrives
// carrying the places its passage actually names. The dates come from
// SeekSparks; the places come from the data; nothing here is invented.
import { readFileSync, writeFileSync } from 'node:fs';
import { CHAPTERS } from './chapters.mjs';

const SRC = process.argv[2] ?? '../SeekSparks/assets/bible_timeline.json';
const timeline = JSON.parse(readFileSync(SRC, 'utf8'));
const bundle = JSON.parse(readFileSync('public/data/places.json', 'utf8'));
const BOOKS = JSON.parse(readFileSync('scripts/books.json', 'utf8'));

// Reference names in the wild differ from the canonical list in a handful of
// predictable ways; anything not covered here has to fail loudly rather than
// silently drop an event's geography.
const ALIAS = {
  'psalm': 'Psalms', 'song of solomon': 'Song of Songs', 'canticles': 'Song of Songs',
  'revelations': 'Revelation', 'acts of the apostles': 'Acts',
};
const byName = new Map();
BOOKS.forEach((b, i) => byName.set(b.en.toLowerCase(), i + 1));

function bookNumber(name) {
  const k = name.trim().toLowerCase();
  return byName.get(k) ?? byName.get((ALIAS[k] ?? '').toLowerCase()) ?? null;
}

const key = (b, c, v) => b * 1_000_000 + c * 1000 + v;

/** Parses one reference into ONE OR MORE ranges. The formats that actually
 *  occur are "Genesis 1", "Genesis 6-9", "Genesis 15:1-5", "Romans 5:12",
 *  a bare book name meaning the whole book, and comma-separated continuations
 *  like "Luke 1:5-25, 57-80" where the tail inherits the book and chapter. */
function parseRef(ref) {
  const parts = ref.split(',').map((p) => p.trim()).filter(Boolean);
  const out = [];
  let ctxBook = null, ctxChapter = null;
  for (const part of parts) {
    const r = parseOne(part, ctxBook, ctxChapter);
    if (!r) return null;
    out.push(r);
    ctxBook = r.book; ctxChapter = r.chapter;
  }
  return out;
}

function parseOne(ref, ctxBook, ctxChapter) {
  // A bare book name is the whole book — "Leviticus" as the tabernacle's setting.
  const whole = bookNumber(ref);
  if (whole) {
    return { book: whole, chapter: 1,
             start: key(whole, 1, 1), end: key(whole, CHAPTERS[whole - 1], 999) };
  }
  // A continuation like "57-80" carries no book of its own.
  if (ctxBook && /^\d+(?:\s*[-–]\s*\d+)?$/.test(ref)) {
    const [a, b] = ref.split(/\s*[-–]\s*/).map(Number);
    return { book: ctxBook, chapter: ctxChapter,
             start: key(ctxBook, ctxChapter, a), end: key(ctxBook, ctxChapter, b ?? a) };
  }

  const m = ref.trim().match(/^((?:[123]\s+)?[A-Za-z][A-Za-z\s]*?)\s+(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?$/);
  if (!m) return null;
  const book = bookNumber(m[1]);
  if (!book) return null;
  const maxCh = CHAPTERS[book - 1];

  const c1 = Number(m[2]);
  const v1 = m[3] ? Number(m[3]) : 1;
  let c2, v2;
  if (m[5] !== undefined) { c2 = Number(m[4]); v2 = Number(m[5]); }        // 1:1-2:3
  else if (m[4] !== undefined) {
    if (m[3] !== undefined) { c2 = c1; v2 = Number(m[4]); }                // 5:1-5
    else { c2 = Number(m[4]); v2 = 999; }                                  // 6-9
  } else if (m[3] !== undefined) { c2 = c1; v2 = v1; }                     // 5:12
  else { c2 = c1; v2 = 999; }                                              // 1

  if (c1 > maxCh || c2 > maxCh) return null;
  return { book, chapter: c1, start: key(book, c1, v1), end: key(book, c2, v2) };
}

// Verse key -> place indices, the same index the globe's timeline runs on.
const versePlaces = bundle.events.map((e) => [e.sort, e.p]);

const unresolved = [];
const events = timeline.events.map((e) => {
  const ranges = (e.refs ?? []).flatMap((r) => {
    const p = parseRef(r);
    if (!p) { unresolved.push(`${e.id}: "${r}"`); return []; }
    return p;
  });

  // Which verse each place came from. A multi-chapter range inevitably pulls
  // in gentilics — Shunem enters 1 Kings 1-3 only because Abishag is "the
  // Shunammite" — and adjacent episodes that are not the event. No automatic
  // rule separates those from the event's own geography, so the next best
  // thing is to show the verse beside the place and let a reviewer judge it in
  // two seconds instead of opening a Bible.
  const seen = [];
  const from = new Map();
  for (const [sort, idxs] of versePlaces) {
    if (!ranges.some((r) => sort >= r.start && sort <= r.end)) continue;
    for (const i of idxs) {
      if (!seen.includes(i)) { seen.push(i); from.set(i, []); }
      if (from.get(i).length < 3) {
        const c = Math.floor((sort % 1_000_000) / 1000), v = sort % 1000;
        from.get(i).push(`${c}:${v}`);
      }
    }
  }

  return {
    id: e.id,
    zh: e.titleZhHans, en: e.titleEn,
    summaryZh: e.descZhHans,
    era: e.era,
    // Straight from SeekSparks, unchanged.
    year: e.year,
    basis: e.basis,
    approximate: e.approximate,
    datingRefs: e.datingRefs ?? [],
    refs: e.refs ?? [],
    ranges,
    // Derived here from the geocoding data.
    placeIds: seen.map((i) => bundle.places[i].id),
    placeNames: seen.map((i) => bundle.places[i].name),
    /** Where in the passage each place is named, same order as placeNames. */
    placeAt: seen.map((i) => from.get(i).join(', ')),
    // The dates are already audited upstream; what is new and unreviewed is
    // the place linkage, so that is what the review tool asks about.
    status: 'imported',
    notes: '',
  };
});

const out = {
  meta: {
    generated: new Date().toISOString(),
    count: events.length,
    provenance:
      '事件、年份、定年依据与 approximate 标记，全部取自 SeekSparks 的 assets/bible_timeline.json，' +
      '未作改动。该年表以所罗门登基（Thiele）为锚点，按经文自述的年数上溯，' +
      '来源与审计见 SeekSparks 的 docs/WHEEL-PROVENANCE.md。' +
      '地点关联由本脚本依 refs 的经文范围，从 OpenBible.info 逐节索引算出（CC BY 4.0）。',
    anchor: timeline._meta?.anchor?.['zh-Hans'] ?? '',
  },
  events,
};

writeFileSync('data/events/seeksparks-timeline.json', JSON.stringify(out, null, 2));

const withPlaces = events.filter((e) => e.placeIds.length > 0).length;
const noRefs = events.filter((e) => e.refs.length === 0).length;
const links = events.reduce((n, e) => n + e.placeIds.length, 0);
const eras = {};
for (const e of events) eras[e.era] = (eras[e.era] ?? 0) + 1;

console.log(`导入事件            ${events.length}`);
console.log(`  能关联到地点      ${withPlaces}  (${(withPlaces / events.length * 100).toFixed(0)}%)`);
console.log(`  地点关联总数      ${links}`);
console.log(`  没有 refs 的      ${noRefs}`);
console.log(`时代分布            ${JSON.stringify(eras)}`);
if (unresolved.length) {
  console.log(`\n无法解析的引用 (${unresolved.length}):`);
  for (const u of unresolved.slice(0, 20)) console.log('  ' + u);
} else {
  console.log(`\n所有经文引用均已解析 ✓`);
}
