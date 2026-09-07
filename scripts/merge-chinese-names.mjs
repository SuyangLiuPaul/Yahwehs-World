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

const bundle = JSON.parse(readFileSync('public/data/places.json', 'utf8'));
const gaz = JSON.parse(readFileSync('../SeekSparks/assets/bible_places.json', 'utf8'));

const byName = new Map();
for (const p of gaz.places) byName.set(p.n.toLowerCase(), p);

const withLL = gaz.places.filter((p) => Array.isArray(p.ll) && p.ll.length === 2);

/** OpenBible disambiguates same-named places with a trailing ordinal —
 *  "Eden 1", "Red Sea 2". The gazetteer does not, so the bare name is tried
 *  once the exact one fails. */
const bare = (n) => n.replace(/\s+\d+$/, '');

const stats = { name: 0, bareName: 0, coord: 0, none: 0 };

for (const p of bundle.places) {
  let hit = byName.get(p.name.toLowerCase());
  let how = 'name';

  if (!hit) { hit = byName.get(bare(p.name).toLowerCase()); how = 'bare-name'; }
  if (!hit) {
    // Within ~2 km. Close enough that two gazetteers mean the same site.
    hit = withLL.find((h) => Math.abs(h.ll[0] - p.lat) < 0.02 && Math.abs(h.ll[1] - p.lon) < 0.02);
    how = 'coord';
  }

  if (!hit) { stats.none++; continue; }
  p.zh = hit.s;
  p.zhHant = hit.t;
  // How confidently this label was attached, so the UI can hold back a name it
  // only inferred from proximity if it ever needs to.
  p.zhMatch = how;
  stats[how === 'bare-name' ? 'bareName' : how]++;
}

bundle.meta.chineseNames = {
  source: 'SeekSparks assets/bible_places.json',
  matched: bundle.places.length - stats.none,
  total: bundle.places.length,
  byMethod: stats,
};

writeFileSync('public/data/places.json', JSON.stringify(bundle));

const got = bundle.places.length - stats.none;
console.log(`按英文名匹配      ${stats.name}`);
console.log(`去编号后匹配      ${stats.bareName}`);
console.log(`按坐标就近匹配    ${stats.coord}`);
console.log(`仍无中文名        ${stats.none}`);
console.log(`\n中文名覆盖        ${got}/${bundle.places.length}  (${(got / bundle.places.length * 100).toFixed(1)}%)`);
const sample = bundle.places.filter((p) => p.zh).slice(0, 8);
console.log('\n样例：');
for (const p of sample) console.log(`  ${p.name.padEnd(22)} ${p.zh}`);
