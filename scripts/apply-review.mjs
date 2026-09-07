// Applies the first-pass review, now that its recommendations were adopted.
//
// Four repairs, and the one that matters most is the first, because it is the
// only one that could be turned into a check rather than a judgement.
//
// 1. GENTILICS. A multi-chapter range pulls in places that are only where a
//    person came from — 1 Kings 1-3 acquires Shunem solely through "Abishag the
//    Shunammite". With the BSB text on hand this can be checked rather than
//    guessed, but only with POSITIVE evidence.
//
//    The first attempt tested for the place name's ABSENCE from the verse, and
//    removed 192 links. That rule was wrong: absence also happens when the two
//    sources simply spell a place differently. It threw out the Negev because
//    BSB writes "Negev" against OpenBible's "Negeb", Heliopolis because BSB
//    uses the Hebrew "On", and the Jordan Valley because BSB says "the plain of
//    the Jordan". So the rule now requires a demonym to actually be present —
//    a word sharing the place's stem and carrying a gentilic ending — and a
//    place is dropped only when its own name is absent AND such a word is
//    there. Applied to every event, not just the flagged ones.
// 2. SCOPE. Four entries span most of a book and resolve to 136-397 places.
//    Those are periods, not events with a location, and pinning one would put
//    397 dots on a single moment.
// 3. LOCATIONS BY HAND. Five intertestamental entries carry no biblical
//    reference and can never be located by a scriptural index, though three
//    name their place in their own summary. Assigned explicitly and marked as
//    assigned, never silently mixed in with the derived ones.
// 4. PROPHECY vs EVENT. The temple's destruction cites the passages predicting
//    it, forty years early. The references are kept as what they are and the
//    location is set by hand.
import { readFileSync, writeFileSync } from 'node:fs';

const file = JSON.parse(readFileSync('data/events/seeksparks-timeline.json', 'utf8'));
const places = JSON.parse(readFileSync('public/data/places.json', 'utf8'));
const bsb = JSON.parse(readFileSync('../SeekSparks/assets/bsb.json', 'utf8'));

const text = new Map();
for (const v of Object.values(bsb)) text.set(`${v.book} ${v.chapter}:${v.verse}`, v.text);

const placeByName = new Map(places.places.map((p) => [p.name, p]));
const bookOfRef = (refs) => (refs[0] ?? '').replace(/\s+\d+.*$/, '');
/** OpenBible's disambiguating ordinal is not part of the name in the text. */
const bare = (n) => n.replace(/\s+\d+$/, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the place's own name appears as a word in the verse. */
function namedInVerse(book, chapterVerse, placeName) {
  const t = text.get(`${book} ${chapterVerse}`);
  if (!t) return null;                       // verse not in this text; do not judge
  return new RegExp(`\\b${esc(bare(placeName))}\\b`, 'i').test(t);
}

const GENTILIC = /(ite|ites|ish|ian|ians|ean|eans|itess)$/i;
/** A demonym adds a syllable; a spelling variant does not. "Beth-shean" is one
 *  letter longer than "Beth-shan" and merely happens to end in -ean, while
 *  "Shunammite" runs four longer than "Shunem". Requiring the extra length
 *  keeps variants from being mistaken for demonyms. */
const MIN_EXTRA = 3;

/** The demonym actually present, or null. Requires a word that shares the
 *  place's opening stem AND ends in a gentilic suffix — "Shunammite" for
 *  Shunem, "Gileadite" for Gilead. Spelling variants like "Negev" for "Negeb"
 *  carry no such ending and are left alone. */
function demonymIn(book, chapterVerse, placeName) {
  const t = text.get(`${book} ${chapterVerse}`);
  if (!t) return null;
  const stem = bare(placeName).replace(/[^A-Za-z]/g, '').slice(0, 4);
  if (stem.length < 3) return null;
  for (const w of t.split(/[^A-Za-z'’-]+/)) {
    if (w.length < bare(placeName).replace(/[^A-Za-z]/g, '').length + MIN_EXTRA) continue;
    if (!w.toLowerCase().startsWith(stem.toLowerCase())) continue;
    if (GENTILIC.test(w)) return w;
  }
  return null;
}

// ── 1. gentilic filter, applied to every event ────────────────────────────
let dropped = 0, kept = 0, unjudged = 0, spelling = 0;
const droppedExamples = [];

for (const e of file.events) {
  if (!e.placeAt || !e.refs.length) continue;
  const book = bookOfRef(e.refs);
  const keepIdx = [];
  const gentilic = [];

  e.placeNames.forEach((name, i) => {
    const cvs = (e.placeAt[i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    // A place survives if it is named outright in ANY verse it was found in.
    const verdicts = cvs.map((cv) => namedInVerse(book, cv, name));
    if (verdicts.every((v) => v === null)) { keepIdx.push(i); unjudged++; return; }
    if (verdicts.some((v) => v === true)) { keepIdx.push(i); kept++; return; }

    // Named nowhere in its verses. Drop it only if a demonym is there to
    // explain why — otherwise this is a spelling difference, and the place
    // stays.
    let found = null;
    for (const cv of cvs) { found = demonymIn(book, cv, name); if (found) break; }
    if (!found) { keepIdx.push(i); spelling++; return; }

    gentilic.push({ name, at: cvs[0], demonym: found });
    dropped++;
    if (droppedExamples.length < 14) droppedExamples.push(`${e.zh}: ${name} ← 「${found}」 @ ${book} ${cvs[0]}`);
  });

  if (gentilic.length) {
    e.gentilic = gentilic;
    e.placeIds = keepIdx.map((i) => e.placeIds[i]);
    e.placeNames = keepIdx.map((i) => e.placeNames[i]);
    e.placeAt = keepIdx.map((i) => e.placeAt[i]);
  }
}

// ── 2. scope, for the entries that are periods rather than events ─────────
const SCOPE = {
  '分地给十二支派': 'book', '士师时代': 'period',
  '耶利米预言': 'book', '以赛亚预言': 'book', '四百年沉默期': 'period',
};
for (const [zh, scope] of Object.entries(SCOPE)) {
  const e = file.events.find((x) => x.zh === zh);
  if (!e) throw new Error(`scope target missing: ${zh}`);
  e.scope = scope;
  e.scopeNote = scope === 'book'
    ? '范围为整卷或近整卷，所列地名是该卷提到的全部地点，不是单一事件的发生地。地图上按范围呈现，不钉单点。'
    : '这是一个时段，不是一个有地点的事件。地图上不钉单点。';
}

// ── 3 & 4. locations assigned by hand, and marked as such ────────────────
const MANUAL = {
  '七十士译本开始翻译': { place: 'Alexandria', why: '摘要明载「在亚历山大被译为希腊文」。' },
  '马加比起义':        { place: 'Jerusalem', why: '摘要明载「重新洁净圣殿」，圣殿在耶路撒冷。' },
  '罗马征服犹太':      { place: 'Jerusalem', why: '摘要明载「庞培攻陷耶路撒冷」。' },
  '亚历山大征服波斯':  { place: 'Persia', why: '摘要明载所征服者为波斯帝国；此处标的是被征服的帝国，不是某一场战役。' },
  '圣殿被毁':          { place: 'Jerusalem', why: '所引经文（太 24:1-2、可 13:1-2）是耶稣的预言，早于事件约四十年，无法据以定位。事件本身发生在耶路撒冷。' },
};
for (const [zh, m] of Object.entries(MANUAL)) {
  const e = file.events.find((x) => x.zh === zh);
  if (!e) throw new Error(`manual target missing: ${zh}`);
  const p = placeByName.get(m.place);
  if (!p) throw new Error(`gazetteer has no ${m.place}`);
  e.manualPlace = { id: p.id, name: p.name, zh: p.zh ?? '', lat: p.lat, lon: p.lon, why: m.why };
  if (zh === '圣殿被毁') {
    e.propheticRefs = e.refs;
    e.refsNote = '所引经文是预言，不是事件的记载。地点为人工指定。';
  }
}

// ── status ────────────────────────────────────────────────────────────────
let approved = 0, repaired = 0;
for (const e of file.events) {
  const wasFlagged = e.recommend === 'edited';
  e.status = 'approved';
  e.reviewedBy = 'first pass adopted by owner';
  if (wasFlagged) { e.repaired = true; repaired++; } else approved++;
}

file.meta.review = {
  adopted: new Date().toISOString(),
  approvedDirectly: approved,
  repairedThenApproved: repaired,
  gentilicLinksRemoved: dropped,
  note: '族称过滤依 BSB 原文逐节核对：地名原词未在该节出现者判为人物籍贯，予以移除，' +
        '被移除者留在 gentilic 字段可查。范围为整卷/时段者标 scope，不钉单点。' +
        '无经文可定位者的地点为人工指定，记于 manualPlace 并附理由。',
};

writeFileSync('data/events/seeksparks-timeline.json', JSON.stringify(file, null, 2));

console.log(`族称链接移除      ${dropped}`);
console.log(`地名确在经文中    ${kept}`);
console.log(`无从判断（原文缺）${unjudged}`);
console.log(`名字未见但无族称，判为译名差异，保留 ${spelling}`);
console.log(`\n标为范围/时段    ${Object.keys(SCOPE).length}`);
console.log(`人工指定地点      ${Object.keys(MANUAL).length}`);
console.log(`\n直接通过          ${approved}`);
console.log(`修复后通过        ${repaired}`);
console.log(`\n移除样例：`);
for (const d of droppedExamples) console.log('  ' + d);
