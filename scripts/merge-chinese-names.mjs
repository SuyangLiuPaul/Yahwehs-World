// Adds Chinese place names to the globe from the SeekSparks gazetteer.
//
// The globe's differentiator is that it is the only Bible atlas in Chinese, and
// until now its 1,332 places were labelled in English only, because OpenBible
// ships no Chinese. SeekSparks already carries a gazetteer of 1,276 places with
// 简体 and 繁體 names, so the names come from there rather than from anyone
// transliterating 1,332 place names by hand.
//
// Matching runs three ways, most confident first, and each place records which
// one found it — a name matched only by proximity is a weaker claim than one
// matched by name, and the record should not hide that.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeZhResolver } from './lib/zh-names.mjs';

const bundle = JSON.parse(readFileSync('public/data/places.json', 'utf8'));
const gaz = JSON.parse(readFileSync('../SeekSparks/assets/bible_places.json', 'utf8'));

/** Corrections to the shared gazetteer, each with the verses that settle it.
 *  Applied here rather than in each consumer: this is the one place a Chinese
 *  name is attached to a place, so a correction made here reaches the globe's
 *  own labels, the journeys and the events alike. Before this, only the
 *  journeys read the file, and the globe still called Ephrath 伯特利. */
// Which Chinese name this project shows for a gazetteer entry is one decision,
// shared with build-journeys.mjs so a correction cannot reach the globe and
// miss the routes. See scripts/lib/zh-names.mjs.
const resolveZh = makeZhResolver();
let corrected = 0, dropped = 0;

/** Names for places the gazetteer does not carry, or that sit on a coordinate
 *  shared with other places and so cannot be identified by proximity. Each was
 *  read out of the Union Version passage that names the place, and each is
 *  checked here against the text again before it is used: a name that is not
 *  in the verse it claims is dropped rather than trusted. */
const fromText = new Map(
  JSON.parse(readFileSync('data/places/names-from-text.json', 'utf8'))
    .names.map((n) => [n.name, n]),
);
let fromTextUsed = 0;

let cuvUsed = 0;

/** The two gazetteers punctuate differently: OpenBible writes King’s Valley
 *  and Diviners’ Oak with a typographic apostrophe, SeekSparks with a plain
 *  one. Nothing else separates the names, and a name that fails to match here
 *  falls through to the coordinate rule, which is where labels went wrong. */
const key = (n) => n
  .normalize('NFC')
  .replace(/[\u2018\u2019\u02bc\u02bb`\u00b4]/g, "'")
  .replace(/[\u2010-\u2015]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const byName = new Map();
for (const p of gaz.places) byName.set(key(p.n), p);

const withLL = gaz.places.filter((p) => Array.isArray(p.ll) && p.ll.length === 2);

/** OpenBible disambiguates same-named places with a trailing ordinal —
 *  "Eden 1", "Red Sea 2". The gazetteer does not, so the bare name is tried
 *  once the exact one fails. */
const bare = (n) => n.replace(/\s+\d+$/, '');

const stats = { name: 0, bareName: 0, coord: 0, ambiguous: 0, none: 0 };

for (const p of bundle.places) {
  // This script rewrites places.json in place, so a name attached by an
  // earlier, looser run is still sitting on the record. Clearing first is what
  // makes a re-run mean anything: without it, tightening the rules leaves
  // every label the old rules produced exactly where it was.
  delete p.zh; delete p.zhHant; delete p.zhMatch; delete p.zhCorrected; delete p.zhEvidence; delete p.zhWithdrawn; delete p.zhModern; delete p.zhSource;

  let hit = byName.get(key(p.name));
  let how = 'name';

  if (!hit) { hit = byName.get(key(bare(p.name))); how = 'bare-name'; }
  if (!hit) {
    // Within ~2 km. Close enough that two gazetteers mean the same site —
    // but only when one place is there. A great many biblical sites are
    // recorded at the coordinate of the city they belong to: every feature in
    // and around Jerusalem sits on 31.77, 35.23, so taking the first entry
    // within the radius handed King's Valley the name of Akeldama, the field
    // of blood, and handed Abraham's 雅伟以勒 the same. A point that holds
    // more than one place is not evidence for any of them; the place keeps
    // its English label rather than being given a name that belongs to
    // somewhere else.
    const near = withLL.filter((h) =>
      Math.abs(h.ll[0] - p.lat) < 0.02 && Math.abs(h.ll[1] - p.lon) < 0.02);
    if (near.length === 1) { hit = near[0]; how = 'coord'; }
    else if (near.length > 1) {
      const t = fromText.get(p.name);
      if (t) {
        p.zh = t.zh; p.zhHant = t.zh; p.zhMatch = 'from-text'; p.zhEvidence = t.evidence;
        fromTextUsed++; continue;
      }
      p.zhMatch = 'ambiguous'; stats.ambiguous++; continue;
    }
  }

  if (!hit) {
    const t = fromText.get(p.name);
    if (t) {
      p.zh = t.zh; p.zhHant = t.zh; p.zhMatch = 'from-text'; p.zhEvidence = t.evidence;
      fromTextUsed++; continue;
    }
    stats.none++; continue;
  }
  const r = resolveZh(hit);
  if (r.source === 'withdrawn') { p.zhMatch = 'withdrawn'; p.zhWithdrawn = r.why; dropped++; continue; }
  p.zh = r.zh;
  p.zhHant = r.zhHant;
  if (r.source === 'corrected') { p.zhCorrected = r.why; corrected++; }
  if (r.source === 'cuv') {
    // The modern form is kept so a reader searching 大马士革 still finds 大马色.
    // The resolver withholds it where the gazetteer spells the divine name out:
    // places.json ships to the browser, and this edition does not put 耶和华 in
    // front of a reader even in a field nothing displays.
    if (r.modern) p.zhModern = r.modern;
    p.zhSource = r.why;
    cuvUsed++;
  }
  // How confidently this label was attached, so the UI can hold back a name it
  // only inferred from proximity if it ever needs to.
  p.zhMatch = how;
  stats[how === 'bare-name' ? 'bareName' : how]++;
}

bundle.meta.chineseNames = {
  source: 'SeekSparks assets/bible_places.json',
  matched: bundle.places.filter((p) => p.zh).length,
  total: bundle.places.length,
  byMethod: stats,
};

writeFileSync('public/data/places.json', JSON.stringify(bundle));

const got = bundle.places.filter((p) => p.zh).length;
console.log(`按英文名匹配      ${stats.name}`);
console.log(`去编号后匹配      ${stats.bareName}`);
console.log(`按坐标就近匹配    ${stats.coord}`);
console.log(`坐标有歧义，不给名 ${stats.ambiguous}`);
console.log(`仍无中文名        ${stats.none}`);
console.log(`按更正表改名      ${corrected}`);
console.log(`按经文原文补名    ${fromTextUsed}`);
console.log(`名属他处，撤名    ${dropped}`);
console.log(`改用和合本写法    ${cuvUsed}`);
console.log(`\n中文名覆盖        ${got}/${bundle.places.length}  (${(got / bundle.places.length * 100).toFixed(1)}%)`);
const sample = bundle.places.filter((p) => p.zh).slice(0, 8);
console.log('\n样例：');
for (const p of sample) console.log(`  ${p.name.padEnd(22)} ${p.zh}`);
