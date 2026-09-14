// Builds the complete event layer — every section of Scripture, Genesis to
// Revelation — by deriving it from data that already exists rather than
// authoring a second system.
//
// Four inputs, none of them invented here:
//   section_titles.json   SeekSparks' curated section titles for all 66 books,
//                         in 简体 / 繁體 / English, each with a starting verse
//                         and a one-line context blurb. These are the passage
//                         boundaries; a section runs to the verse before the
//                         next one begins, across chapter breaks.
//   gospel_synopsis.json  71 harmony events (Robertson 1922, public domain),
//   ot_synopsis.json      139 parallel groups (Kings//Chronicles and the rest).
//                         Both exist so one event can carry more than one
//                         reference instead of being counted twice.
//   bible_timeline.json   the Thiele-anchored spine, already reviewed, which
//                         supplies every year. Nothing here dates anything on
//                         its own authority.
//   places.json           the OpenBible verse index, from which each event's
//                         geography is COMPUTED. An event's name and boundary
//                         are proposals; its places are not.
import { readFileSync, writeFileSync } from 'node:fs';

const SS = '../SeekSparks/assets';
const BOOKS = JSON.parse(readFileSync('scripts/books.json', 'utf8'));
const sections = JSON.parse(readFileSync(`${SS}/section_titles.json`, 'utf8'));
const gospel = JSON.parse(readFileSync(`${SS}/gospel_synopsis.json`, 'utf8'));
const otsyn = JSON.parse(readFileSync(`${SS}/ot_synopsis.json`, 'utf8'));
const cuv = JSON.parse(readFileSync(`${SS}/cuvs-yhwh.json`, 'utf8'));
const spine = JSON.parse(readFileSync('data/events/seeksparks-timeline.json', 'utf8')).events;
const bundle = JSON.parse(readFileSync('public/data/places.json', 'utf8'));
// Section blurbs were written as study notes, and about one in seven of them
// interprets or applies rather than saying what happens. Those were rewritten
// against the passage itself; the rewrites live here so a regeneration keeps
// them instead of reverting to the blurb.
const overrides = JSON.parse(readFileSync('data/events/summary-overrides.json', 'utf8')).summaries;

const key = (b, c, v) => b * 1_000_000 + c * 1000 + v;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── book naming ───────────────────────────────────────────────────────────
// books.json is the canon order this product uses; the section set spells one
// book differently and the Chinese text a second way again.
const ALIAS = { 'Song of Songs': 'Song of Solomon' };
const enToNum = new Map(BOOKS.map((b, i) => [b.en, i + 1]));
for (const [a, b] of Object.entries(ALIAS)) enToNum.set(b, enToNum.get(a));
enToNum.set('Psalm', 19);

// ── last verse of every chapter, read from the text itself ────────────────
const lastVerse = new Map();
for (const row of cuv) {
  const b = +row.id.slice(0, 3), c = +row.id.slice(3, 6), v = +row.id.slice(6);
  const k = `${b}:${c}`;
  if (!lastVerse.has(k) || lastVerse.get(k) < v) lastVerse.set(k, v);
}
const lastChapter = new Map();
for (const k of lastVerse.keys()) {
  const [b, c] = k.split(':').map(Number);
  if (!lastChapter.has(b) || lastChapter.get(b) < c) lastChapter.set(b, c);
}

// ── verse -> place indices ────────────────────────────────────────────────
const versePlaces = new Map();
for (const ev of bundle.events) versePlaces.set(ev.sort, ev.p);
const sortedVerseKeys = [...versePlaces.keys()].sort((a, b) => a - b);

function placesIn(start, end) {
  const seen = [];
  // Binary search to the first key >= start, then walk.
  let lo = 0, hi = sortedVerseKeys.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sortedVerseKeys[m] < start) lo = m + 1; else hi = m; }
  for (let i = lo; i < sortedVerseKeys.length && sortedVerseKeys[i] <= end; i++) {
    for (const p of versePlaces.get(sortedVerseKeys[i])) if (!seen.includes(p)) seen.push(p);
  }
  return seen;
}

// ── the spine, parsed into ranges so overlap can be tested ────────────────
// Spine refs look like "Genesis 1", "Exodus 12-13", "Luke 2:1-20".
function parseRef(ref) {
  // A whole book, with no chapter at all ("Leviticus").
  const whole = ref.match(/^\s*((?:[123]\s+)?[A-Za-z][A-Za-z ]*?)\s*$/);
  if (whole) {
    const b = enToNum.get(whole[1].trim());
    if (!b) return null;
    const lc = lastChapter.get(b);
    return { book: b, start: key(b, 1, 1), end: key(b, lc, lastVerse.get(`${b}:${lc}`) ?? 200) };
  }
  // A comma list ("Luke 1:5-25, 57-80") spans from the first to the last.
  if (ref.includes(',')) {
    const head = ref.split(',')[0];
    const tail = ref.split(',').pop().trim();
    const a = parseRef(head);
    if (!a) return null;
    const t = tail.match(/^(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+))?$/);
    if (!t) return a;
    const c = t[2] ? +t[1] : a.end / 1000 % 1000 | 0;
    const v = t[3] ? +t[3] : (t[2] ? +t[2] : +t[1]);
    return { book: a.book, start: a.start, end: key(a.book, c, v) };
  }
  const m = ref.match(/^\s*((?:[123]\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?\s*$/);
  if (!m) return null;
  const book = enToNum.get(m[1].trim());
  if (!book) return null;
  const c1 = +m[2];
  const v1 = m[3] ? +m[3] : 1;
  let c2, v2;
  if (m[4] && m[5]) { c2 = +m[4]; v2 = +m[5]; }
  else if (m[4] && m[3]) { c2 = c1; v2 = +m[4]; }        // "Luke 2:1-20"
  else if (m[4]) { c2 = +m[4]; v2 = lastVerse.get(`${book}:${c2}`) ?? 200; }  // "Exodus 12-13"
  else { c2 = c1; v2 = m[3] ? v1 : (lastVerse.get(`${book}:${c1}`) ?? 200); }
  return { book, start: key(book, c1, v1), end: key(book, c2, v2) };
}

// A spine event's position is its FIRST reference. The others are
// cross-references — "the Fall" carries Romans 5:12, "Enoch walked with God"
// carries Hebrews 11:5 — and treating a New Testament citation as the place
// where an antediluvian event happened put -3127 on the book of Hebrews and,
// through the bounding rule below, on Revelation.
const spineRanges = [];
let spineUnparsed = 0;
for (const e of spine) {
  const first = (e.refs ?? [])[0];
  if (!first) continue;
  const p = parseRef(first);
  if (p) spineRanges.push({ ...p, year: e.year, zh: e.zh, id: e.id, approximate: e.approximate });
  else spineUnparsed++;
}
spineRanges.sort((a, b) => a.start - b.start);

// ── parallels: one event, more than one reference ─────────────────────────
// A section that falls inside a synopsis group is tagged with that group, so
// the same event in Kings and in Chronicles, or in three Gospels, is one event
// carrying several references rather than three events telling one story.
const parallels = [];   // { id, en, zh, ranges: [{book,start,end,ref}] }
for (const g of otsyn.groups) {
  const ranges = [];
  for (const r of g.refs) {
    const b = enToNum.get(r.book);
    if (!b) continue;
    // A group may run across a chapter break, and says so in endChapter. Five
    // of the 139 do; ignoring the field printed "2 Chronicles 3:15-1".
    const ec = r.endChapter ?? r.chapter;
    ranges.push({ book: b, start: key(b, r.chapter, r.start), end: key(b, ec, r.end),
                  ref: ec === r.chapter
                    ? `${r.book} ${r.chapter}:${r.start}–${r.end}`
                    : `${r.book} ${r.chapter}:${r.start}–${ec}:${r.end}` });
  }
  if (ranges.length > 1) parallels.push({ id: `ot-${g.id}`, en: g.en, zh: g.zh, ranges });
}
for (const g of gospel.events) {
  const ranges = [];
  for (const ref of Object.values(g.refs)) {
    const p = parseRef(ref.replace(/(\d)-(\d)/, '$1-$2'));
    if (p) ranges.push({ ...p, ref });
  }
  if (ranges.length > 1) {
    parallels.push({ id: `gospel-${g.id}`, en: g.title.en, zh: g.title['zh-Hans'], ranges });
  }
}

function parallelsFor(book, start, end) {
  const out = [];
  for (const p of parallels) {
    const mine = p.ranges.find((r) => r.book === book && r.start <= end && r.end >= start);
    if (!mine) continue;
    const others = p.ranges.filter((r) => r !== mine).map((r) => r.ref);
    if (others.length) out.push({ group: p.id, en: p.en, zh: p.zh, alsoIn: others });
  }
  return out;
}

// ── dating ladder ─────────────────────────────────────────────────────────
// (a) the spine already dates this passage -> take its year, never re-derive;
// (b) otherwise bound it by the nearest dated passages before and after in
//     canonical order -> a band, marked inferred;
// (c) where the genre supports no date at all -> null, marked none.
const UNDATED_BOOKS = new Set([18, 19, 20, 21, 22, 25]);   // Job, Ps, Pr, Ecc, Song, Lam
function dateFor(book, start, end) {
  const hits = spineRanges.filter((r) => r.start <= end && r.end >= start);
  if (hits.length) {
    const ys = hits.map((h) => h.year).filter((y) => y !== null && y !== undefined);
    if (ys.length) {
      const lo = Math.min(...ys), hi = Math.max(...ys);
      // Genesis 1-11 is dated on the spine by adding up genealogical spans.
      // The 105 spine events were reviewed and approved with those numbers, so
      // they are kept (D4); but the premises — no gaps in the genealogies,
      // life-spans read literally — are contested, and the existing Genesis
      // candidate file rejected them outright. The disagreement is recorded
      // rather than resolved here.
      const primordial = book === 1 && end < key(1, 12, 1);
      return {
        yearEarly: lo, yearLate: hi,
        dateConfidence: primordial ? 'disputed' : 'inferred',
        dateBasis: `与年表重叠：${hits.map((h) => h.zh).join('、')}。年代取自 SeekSparks 年表（以所罗门登基为锚点，按经文自述年数上溯），本项目不另行推算。` + (primordial ? '创世记 1—11 章的年份由家谱年数累加得出，其前提（家谱无断代、寿数按字面）本身有争议；此处保留年表的数字，但标为有争议。' : ''),
        dateSource: { kind: 'spine', of: [...new Set(hits.map((h) => h.id))] },
      };
    }
  }
  if (UNDATED_BOOKS.has(book) || book <= 1 && start < key(1, 12, 1)) {
    return { yearEarly: null, yearLate: null, dateConfidence: 'none',
      dateBasis: '该段落体裁或位置不支持绝对定年，本项目不给年份。',
      dateSource: { kind: 'none' } };
  }
  const before = [...spineRanges].filter((r) => r.end < start && r.year != null).pop();
  const after = spineRanges.find((r) => r.start > end && r.year != null);
  if (before && after) {
    // Canonical order is not chronological order — Mark 1 follows Matthew 28 in
    // the canon and precedes it by seven years — so the band is the pair's
    // min and max, never "the one before" and "the one after".
    const lo = Math.min(before.year, after.year), hi = Math.max(before.year, after.year);
    return { yearEarly: lo, yearLate: hi, dateConfidence: 'inferred',
      dateBasis: `年表未直接收录此段。按正典顺序夹逼：一侧是「${before.zh}」（${before.year}）、另一侧是「${after.zh}」（${after.year}），故落在 ${lo}—${hi} 之间。区间宽度即为不确定度，不是精度。`,
      dateSource: { kind: 'bounded', before: before.id, after: after.id } };
  }
  return { yearEarly: null, yearLate: null, dateConfidence: 'none',
    dateBasis: '年表前后皆无可夹逼的已定年事件，本项目不给年份。',
    dateSource: { kind: 'none' } };
}

// ── build ─────────────────────────────────────────────────────────────────
const setZh = sections.sets['cuv'];
const setEn = sections.sets['english-classic'];
const all = [];
const perBook = new Map();
let noTitleEn = 0;

for (let bi = 0; bi < BOOKS.length; bi++) {
  const meta = BOOKS[bi];
  const book = bi + 1;
  const nameForSet = ALIAS[meta.en] ?? meta.en;
  const zhChapters = setZh[nameForSet];
  const enChapters = setEn[nameForSet] ?? {};
  if (!zhChapters) { console.warn(`no sections for ${meta.en}`); continue; }

  // Flatten to an ordered list of starts.
  const starts = [];
  for (const [ch, list] of Object.entries(zhChapters)) {
    for (const s of list) starts.push({ c: +ch, v: s.verse, title: s.title, context: s.context });
  }
  starts.sort((a, b) => a.c - b.c || a.v - b.v);

  const enIndex = new Map();
  for (const [ch, list] of Object.entries(enChapters)) {
    for (const s of list) enIndex.set(`${ch}:${s.verse}`, s.title);
  }

  const maxCh = lastChapter.get(book);
  const events = starts.map((s, i) => {
    const next = starts[i + 1];
    let c2, v2;
    if (next) {
      if (next.v > 1) { c2 = next.c; v2 = next.v - 1; }
      else { c2 = next.c - 1; v2 = lastVerse.get(`${book}:${c2}`) ?? 1; }
    } else { c2 = maxCh; v2 = lastVerse.get(`${book}:${maxCh}`) ?? 1; }
    // A section that starts at verse 1 of a chapter the previous one already
    // covers can collapse; keep it as a single verse rather than inverting.
    if (key(book, c2, v2) < key(book, s.c, s.v)) { c2 = s.c; v2 = s.v; }

    const start = key(book, s.c, s.v), end = key(book, c2, v2);
    const pl = placesIn(start, end);
    const en = enIndex.get(`${s.c}:${s.v}`) ?? null;
    if (!en) noTitleEn++;
    const d = dateFor(book, start, end);
    const par = parallelsFor(book, start, end);
    const refEn = `${meta.en} ${s.c}:${s.v}–${c2}:${v2}`;
    const refZh = `${meta.zh} ${s.c}:${s.v}–${c2}:${v2}`;

    return {
      id: `${slug(meta.en)}-${s.c}-${s.v}`,
      zh: s.title, en: en ?? s.title,
      book, start, end,
      ref: refEn, refZh,
      refs: [refEn, ...par.flatMap((p) => p.alsoIn)],
      parallels: par.map((p) => ({ group: p.group, zh: p.zh, en: p.en, alsoIn: p.alsoIn })),
      summaryZh: overrides[`${slug(meta.en)}-${s.c}-${s.v}`] ?? s.context ?? '',
      yearEarly: d.yearEarly, yearLate: d.yearLate,
      dateBasis: d.dateBasis, dateConfidence: d.dateConfidence, dateSource: d.dateSource,
      placeIds: pl.map((i2) => bundle.places[i2].id),
      placeNames: pl.map((i2) => bundle.places[i2].name),
      placeNamesZh: pl.map((i2) => bundle.places[i2].zh ?? null),
      status: 'candidate',
      notes: '',
    };
  });

  perBook.set(book, events);
  all.push(...events);
}

// ── write ─────────────────────────────────────────────────────────────────
const provenance = '段落边界、标题与导语取自 SeekSparks assets/section_titles.json（app 自撰，非某一出版译本的分段）；平行经文取自 gospel_synopsis.json（Robertson 1922，公有领域）与 ot_synopsis.json；年代取自 SeekSparks 年表，未直接收录者按正典顺序夹逼；地点由脚本从 OpenBible.info 逐节索引算出（CC BY 4.0），不是人工指定。全部 status=candidate，等待审阅。';

writeFileSync('data/events/all-events.json', JSON.stringify({
  meta: {
    generated: new Date().toISOString(),
    count: all.length,
    books: perBook.size,
    provenance,
    divineName: '中文引用以雅伟版和合本（SeekSparks cuvs-yhwh.json）为准，神名作「雅伟」。',
  },
  events: all,
}, null, 2));

const withPlaces = all.filter((e) => e.placeIds.length).length;
const withYear = all.filter((e) => e.yearEarly !== null).length;
const withPar = all.filter((e) => e.parallels.length).length;
console.log(`${all.length} 个事件，覆盖 ${perBook.size} 卷`);
console.log(`  ${withPlaces} 个关联到至少一处地点 (${(withPlaces / all.length * 100).toFixed(0)}%)`);
console.log(`  ${withYear} 个有年代 (${(withYear / all.length * 100).toFixed(0)}%)`);
console.log(`  ${withPar} 个有平行经文 (${(withPar / all.length * 100).toFixed(0)}%)`);
console.log(`  ${noTitleEn} 段没有英文标题，暂用中文标题占位`);
