// Mechanical review of data/events/all-events.json.
//
// Most of what "reviewing 1,443 events" means is checkable against the text
// itself: does the citation resolve, is the place actually named there, do the
// years sit inside the band the spine allows, does anything fall between two
// events and so go unmentioned. None of that needs a person. What does need a
// person is the part this script deliberately does not touch: whether an event
// is the right unit at all, whether a disputed date should be published, and
// whether a contested identification is one this project wants to endorse.
//
// Run from the repo root. Writes a report; changes nothing.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const A = '../SeekSparks/assets';
const verses = JSON.parse(readFileSync(`${A}/cuvs-yhwh.json`, 'utf8'));
const places = JSON.parse(readFileSync(`${A}/bible_places.json`, 'utf8'));
const doc = JSON.parse(readFileSync('data/events/all-events.json', 'utf8'));
const events = doc.events ?? doc;

// ── the text, addressable by the same bbbcccvvv key the events use ────────
const byId = new Map();
for (const v of verses) byId.set(Number(v.id), v);
const ids = [...byId.keys()].sort((a, b) => a - b);
const passage = (start, end) => {
  const out = [];
  for (const id of ids) { if (id > end) break; if (id >= start) out.push(byId.get(id).text); }
  return out.join('');
};

// ── place names, as the Union Version spells them ─────────────────────────
const placeZh = new Map();
for (const p of (places.places ?? places)) {
  const zh = p.zh ?? p.s ?? p['zh-Hans'];
  if (p.id && zh) placeZh.set(p.id, zh);
}

const findings = [];
const note = (kind, ev, detail) =>
  findings.push({ kind, id: ev.id, ref: ev.ref, detail });

// ── A · does every citation resolve to real verses? ───────────────────────
for (const ev of events) {
  if (!(ev.start <= ev.end)) note('range-inverted', ev, `${ev.start} > ${ev.end}`);
  if (!byId.has(ev.start)) note('start-not-a-verse', ev, String(ev.start));
  if (!byId.has(ev.end)) note('end-not-a-verse', ev, String(ev.end));
  if (!passage(ev.start, ev.end)) note('empty-passage', ev, 'no verses in range');
  for (const r of ev.parallels ?? []) {
    if (typeof r === 'object' && r.start != null && !byId.has(r.start))
      note('parallel-unresolved', ev, JSON.stringify(r));
  }
}

// ── B · does anything in the canon fall between two events? ───────────────
const covered = new Uint8Array(ids.length);
const pos = new Map(ids.map((id, i) => [id, i]));
for (const ev of events) {
  for (let i = pos.get(ev.start) ?? 0; i < ids.length && ids[i] <= ev.end; i++) covered[i] = 1;
}
const gaps = [];
for (let i = 0; i < ids.length; i++) {
  if (covered[i]) continue;
  const s = i;
  while (i < ids.length && !covered[i]) i++;
  gaps.push([ids[s], ids[i - 1], i - s]);
}

// ── C · does each Chinese place name hold up against the text? ────────────
// Not "is it named in this passage" — OpenBible attaches a place to a verse
// because that is where the scene happens, not only when the verse says the
// name, so most of those misses are nothing. The test that means something is
// per place, over every verse the gazetteer cites for it: a name that never
// once appears in any of them is not the name the Union Version uses, and the
// interesting question is then whether it is some OTHER place's name.
const BOOKNO = {
  Gen: 1, Exo: 2, Lev: 3, Num: 4, Deu: 5, Jos: 6, Jdg: 7, Rut: 8, '1Sa': 9, '2Sa': 10,
  '1Ki': 11, '2Ki': 12, '1Ch': 13, '2Ch': 14, Ezr: 15, Neh: 16, Est: 17, Job: 18, Psa: 19,
  Pro: 20, ccl: 21, Sng: 22, Isa: 23, Jer: 24, Lam: 25, Eze: 26, Dan: 27, Hos: 28, Joe: 29,
  Amo: 30, Oba: 31, Jon: 32, Mic: 33, nah: 34, hum: 34, Hah: 35, Hab: 35, Zep: 36, Hag: 37,
  Zec: 38, Mal: 39, Mat: 40, Mar: 41, Luk: 42, Joh: 43, Act: 44, Rom: 45, '1Co': 46,
  '2Co': 47, Gal: 48, eph: 49, Eph: 49, hil: 50, Col: 51, '1Th': 52, '2Th': 53, '1Ti': 54,
  '2Ti': 55, tus: 56, Tit: 56, Phm: 57, Heb: 58, Jam: 59, '1Pe': 60, '2Pe': 61, '1Jo': 62,
  '2Jo': 63, '3Jo': 64, ude: 65, Rev: 66,
};
const WHOLE = verses.map((v) => v.text).join('');
// Read through this repo's corrections, or the audit reports the upstream's
// state rather than the site's: the names the globe actually shows are the
// corrected ones, and a withdrawn name is no longer a claim about anywhere.
const gazDoc = JSON.parse(readFileSync('data/events/gazetteer-corrections.json', 'utf8'));
const corr = new Map(gazDoc.corrections.map((c) => [c.name, c]));
const gone = new Set((gazDoc.removals?.places ?? []).map((c) => c.name));
// The Union Version's own rendering replaces the gazetteer's modern one, and
// three entries cite the wrong verse upstream — both have to be read through
// or the audit keeps reporting a state the site left behind.
const cuvZh = new Map(
  JSON.parse(readFileSync('data/places/cuv-renderings.json', 'utf8'))
    .renderings.filter((r) => r.cuvZh).map((r) => [r.name, r.cuvZh]),
);
const noCuv = new Set(
  JSON.parse(readFileSync('data/places/cuv-renderings.json', 'utf8'))
    .noCuvName.map((r) => r.name),
);
// `nameAttestedAt` is where the NAME appears, which is not always the verse
// the location is anchored to: OpenBible pins Mount Ephron to Joshua 18:15,
// Benjamin's southern border, while the name 以弗仑山 is written at Joshua 15:9,
// Judah's northern border — the same line described from the other side.
const refFix = new Map((gazDoc.refCorrections?.places ?? [])
  .map((c) => [c.name, c.nameAttestedAt ?? c.ref]));

const wrongName = [], unknownName = [];
for (const g of (places.places ?? places)) {
  if (gone.has(g.n) || noCuv.has(g.n)) continue;
  const zh = cuvZh.get(g.n) ?? corr.get(g.n)?.zh ?? g.s;
  if (!zh || !g.refs?.length) continue;
  const fixed = refFix.get(g.n);
  const refs = fixed
    ? [{ book: fixed.split(' ')[0], chapter: fixed.split(' ')[1].split(':')[0], verse: fixed.split(' ')[1].split(':')[1] }]
    : g.refs;
  let seen = false, checked = 0;
  for (const r of refs) {
    const b = BOOKNO[r.book];
    if (b === undefined) continue;
    const v = byId.get(b * 1_000_000 + Number(r.chapter) * 1_000 + Number(r.verse));
    if (!v) continue;
    checked++;
    if (v.text.includes(zh)) { seen = true; break; }
  }
  if (!checked || seen) continue;
  (WHOLE.includes(zh) ? wrongName : unknownName).push([checked, g.n, zh]);
}
wrongName.sort((a, b) => b[0] - a[0]);
unknownName.sort((a, b) => b[0] - a[0]);

// ── D · how much of the summary's vocabulary comes from the passage? ──────
// A screening heuristic, not a verdict: a summary written from the passage
// reuses its words, so the low-overlap tail is where to look first.
const STOP = new Set([...'的了在是和与就也都不有他她它们这那个之为以而於于于所被把从向对及並并中上下前后时因此其名说话作做一二三四五六七八九十百千万年日月天人主神我你您又再还很最多少大小出入去来到已未又或者但若如虽然则即乃自能可要将会得着过起同各凡当只更且'] );
const cjk = (s) => [...s].filter((c) => /[一-鿿]/.test(c) && !STOP.has(c));
const overlap = [];
for (const ev of events) {
  if (!ev.summaryZh) { note('summary-missing', ev, ''); continue; }
  const text = passage(ev.start, ev.end) + (ev.parallels ?? [])
    .map((r) => (typeof r === 'object' && r.start != null ? passage(r.start, r.end) : '')).join('');
  const chars = new Set(cjk(ev.summaryZh));
  if (!chars.size) continue;
  let hit = 0;
  for (const c of chars) if (text.includes(c)) hit++;
  overlap.push({ id: ev.id, ref: ev.ref, share: hit / chars.size,
                 missing: [...chars].filter((c) => !text.includes(c)).join(''),
                 summary: ev.summaryZh });
}
overlap.sort((a, b) => a.share - b.share);

// ── E · do the years sit where the testament says they should? ────────────
for (const ev of events) {
  if (ev.yearEarly == null || ev.yearLate == null) continue;
  if (ev.yearEarly > ev.yearLate) note('year-band-inverted', ev, `${ev.yearEarly}..${ev.yearLate}`);
  if (ev.book >= 40 && ev.yearLate < -100) note('nt-dated-bc', ev, `${ev.yearEarly}..${ev.yearLate}`);
  if (ev.book <= 39 && ev.yearEarly > 100) note('ot-dated-ad', ev, `${ev.yearEarly}..${ev.yearLate}`);
}

// ── F · the divine name ───────────────────────────────────────────────────
for (const ev of events) {
  const blob = `${ev.zh}${ev.summaryZh ?? ''}${ev.dateBasis ?? ''}`;
  if (blob.includes('耶和华')) note('divine-name', ev, '耶和华 in authored text');
}

// ── G · the divine name, in everything that ships ─────────────────────────
// The events check above only covers the events. 耶和华 reached a place label
// and a route's own basis note without anything noticing, because nothing was
// looking at the two files the browser actually downloads.
// The same sweep counts the modern place spellings D16 replaced: the labels say
// 西乃山 now, and a note beside them saying 西奈山 is the same fault in prose.
const NEEDLES = ['耶和华', 'LORD', 'The Lord Will Provide', 'The Lord Is There', ...(
  JSON.parse(readFileSync('data/places/cuv-renderings.json', 'utf8')).proseSubstitutions?.pairs ?? []
).map((p) => p.from)];
// `zhModern` and `nameOriginal` are the two fields allowed to hold the replaced
// form — provenance, and so a search for 大马士革 still reaches 大马色 — and
// nothing displays either as a label.
const shipped = [];
const sweep = (o, hits, path = '') => {
  if (typeof o === 'string') {
    if (path.endsWith('.zhModern') || path.endsWith('.nameOriginal')) return;
    for (const needle of NEEDLES) { let i = -1; while ((i = o.indexOf(needle, i + 1)) !== -1) hits.set(needle, (hits.get(needle) ?? 0) + 1); }
  } else if (Array.isArray(o)) o.forEach((v, i) => sweep(v, hits, `${path}[${i}]`));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) sweep(v, hits, `${path}.${k}`);
};
// Every JSON the browser downloads, not a list written once and left behind.
// The whole point of this check is that nothing reaches a reader with the
// divine name or a modern spelling in it, and a payload added later is exactly
// how that guarantee goes quietly false — events.json (P4) was shipping for a
// day before it was listed here. Anything dropped into public/data is swept.
const SHIPPED = readdirSync('public/data')
  .filter((f) => f.endsWith('.json'))
  // Generated lookup tables, not prose: zh-hant.json is keyed BY simplified
  // strings, so it necessarily contains whatever the other files contain.
  .filter((f) => f !== 'zh-hant.json' && f !== 'version.json')
  .map((f) => `public/data/${f}`);
for (const f of SHIPPED) {
  const hits = new Map();
  sweep(JSON.parse(readFileSync(f, 'utf8')), hits);
  for (const [needle, n] of hits) shipped.push([`${f} · ${needle}`, n]);
}

// ── F · do the corridors between the three pages still land? ──────────────
// src/bridges.ts joins the pages on the verse each part already cites: a
// journey states the passage its stops come from, a structure states the verse
// that measures it, and four authored anchors say which verses are the
// tabernacle you can walk into. If any of those stops falling inside an event,
// a link in the interface silently goes nowhere — the kind of failure nobody
// reports, because a chip that is not there looks like a page without one.
//
// The anchors are READ OUT of the files that own them rather than restated
// here. A second copy of the list is how a correction lands in one place and
// not the other; this repo has paid for that lesson twice.
const enBooks = [...readFileSync('src/books.ts', 'utf8')
  .matchAll(/\{ en: '([^']+)', zh: '[^']+' \}/g)].map((m) => m[1]);
const enNo = new Map(enBooks.map((n, i) => [n, i + 1]));
const refToKey = (ref) => {
  const m = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(ref);
  const b = m && enNo.get(m[1]);
  return b ? b * 1_000_000 + Number(m[2]) * 1000 + Number(m[3] ?? 0) : null;
};
const eventsAt = (key) => events.filter((e) => e.start <= key && key <= e.end).length;
const corridors = [];

const journeysDoc = JSON.parse(readFileSync('public/data/journeys.json', 'utf8'));
for (const jr of journeysDoc.journeys) {
  const keys = jr.markers
    .flatMap((m) => m.refs ?? [m.ref])
    .map(refToKey)
    .filter((k) => k !== null);
  if (!keys.length) { corridors.push([`journey ${jr.id}`, 'no stop cites a verse this table knows']); continue; }
  const [lo, hi] = [Math.min(...keys), Math.max(...keys)];
  const n = events.filter((e) => e.end >= lo && e.start <= hi).length;
  if (!n) corridors.push([`journey ${jr.id}`, `passage ${lo}–${hi} contains no event`]);
}

const specsSrc = readFileSync('src/structures/specs.ts', 'utf8');
let lastId = null;
for (const line of specsSrc.split('\n')) {
  const id = /^\s{4}id: '([^']+)'/.exec(line);
  if (id) { lastId = id[1]; continue; }
  const ref = /^\s{4}ref: '([^']+)'/.exec(line);
  if (!ref || !lastId) continue;
  const key = refToKey(ref[1]);
  if (key === null) corridors.push([`structure ${lastId}`, `cannot read "${ref[1]}"`]);
  else if (!eventsAt(key)) corridors.push([`structure ${lastId}`, `${ref[1]} falls in no event`]);
}

const walkAnchors = [...(/const WALK_ANCHORS = \[([^\]]+)\]/
  .exec(readFileSync('src/bridges.ts', 'utf8'))?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (!walkAnchors.length) corridors.push(['tabernacle', 'no anchors found in src/bridges.ts']);
for (const a of walkAnchors) {
  const key = refToKey(a);
  if (key === null || !eventsAt(key)) corridors.push(['tabernacle', `${a} falls in no event`]);
}

// ── report ────────────────────────────────────────────────────────────────
const byKind = {};
for (const f of findings) (byKind[f.kind] ??= []).push(f);
const lines = [];
lines.push(`# Mechanical review of ${events.length} events`, '');
lines.push(`Verses in the canon: ${ids.length}. Covered by some event: ${covered.reduce((a, b) => a + b, 0)}.`, '');
lines.push('## Findings by kind', '');
const kinds = Object.keys(byKind).sort();
if (!kinds.length) lines.push('None.', '');
for (const k of kinds) {
  lines.push(`### ${k} — ${byKind[k].length}`, '');
  for (const f of byKind[k].slice(0, 40)) lines.push(`- \`${f.id}\` ${f.ref} — ${f.detail}`);
  if (byKind[k].length > 40) lines.push(`- …and ${byKind[k].length - 40} more`);
  lines.push('');
}
lines.push('## The divine name and modern spellings in what ships', '');
if (!shipped.length) lines.push(`None. ${SHIPPED.map((f) => `\`${f}\``).join(', ')} are clean.`, '');
for (const [f, n] of shipped) lines.push(`- **${f} — ${n} occurrences.** This edition reads 雅伟 and the Union Version spellings (D16).`);
lines.push('');
lines.push(`## Place names the Union Version never uses at that place`, '');
lines.push(`### The name belongs to somewhere else — ${wrongName.length}`, '');
lines.push('The name is in the Union Version, but at a different place. Each needs a verse read.', '');
for (const [n, en, zh] of wrongName) lines.push(`- ${en} → ${zh} (${n} verses cite it; none say ${zh})`);
lines.push('', `### The name is nowhere in the Union Version — ${unknownName.length}`, '');
lines.push('Modern Mandarin renderings and descriptive translations: 大马士革 for 大马色,');
lines.push('黎巴嫩 for 利巴嫩, 马耳他 for 米利大. Not errors — a decision about which');
lines.push('naming the globe should follow. See the open question in this file.', '');
for (const [n, en, zh] of unknownName) lines.push(`- ${en} → ${zh} (${n} verses)`);
lines.push('');
lines.push(`## Passages no event cites — ${gaps.length} runs`, '');
const fmt = (id) => { const v = byId.get(id); return `${v.book} ${v.chapter}:${v.verse}`; };
for (const [s, e, n] of gaps.slice(0, 60)) lines.push(`- ${fmt(s)} – ${fmt(e)} (${n} verses)`);
if (gaps.length > 60) lines.push(`- …and ${gaps.length - 60} more runs`);
lines.push('', `Total uncited verses: ${gaps.reduce((a, g) => a + g[2], 0)}`, '');
lines.push(`## Corridors between the pages — ${corridors.length} broken`, '');
lines.push('Every link in src/bridges.ts is a verse citation landing inside an event.', '');
if (!corridors.length) lines.push('All journeys, structure measurements and tabernacle anchors land.', '');
for (const [what, why] of corridors) lines.push(`- **${what}** — ${why}`);
lines.push('');
lines.push('## Summaries whose words are least like the passage', '');
lines.push('Screening only — a low share means look, not that it is wrong.', '');
for (const o of overlap.slice(0, 40))
  lines.push(`- \`${o.id}\` ${o.ref} — ${(o.share * 100).toFixed(0)}% (absent: ${o.missing})\n  ${o.summary}`);
writeFileSync('handoff/EVENT-REVIEW.md', lines.join('\n') + '\n');

console.log(`findings: ${findings.length}`);
for (const k of kinds) console.log(`  ${k}: ${byKind[k].length}`);
console.log(`耶和华 / modern spellings in shipped payloads: ${shipped.length ? shipped.map(([f, n]) => `${f}:${n}`).join(', ') : 'none'}`);
console.log(`names that belong elsewhere: ${wrongName.length}; names absent from the CUV: ${unknownName.length}`);
console.log(`uncited verses: ${gaps.reduce((a, g) => a + g[2], 0)} in ${gaps.length} runs`);
console.log(`corridors that land nowhere: ${corridors.length}`);
for (const [what, why] of corridors) console.log(`  ${what}: ${why}`);
console.log(`lowest summary overlap: ${(overlap[0]?.share * 100).toFixed(0)}%`);
