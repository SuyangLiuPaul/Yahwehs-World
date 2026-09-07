// Converts the OpenBible.info Bible Geocoding dataset (CC BY 4.0) into the
// compact places bundle the globe loads at runtime.
//
// An ancient place carries no coordinate of its own: it is located only through
// its associations with modern places, each scored by OpenBible. We take the
// best-scoring association as the location and keep that score as the
// confidence, so an uncertain identification stays visibly uncertain rather
// than being flattened into a confident dot.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const SRC = process.argv[2];
if (!SRC) { console.error('usage: build-places.mjs <path-to-Bible-Geocoding-Data>'); process.exit(1); }

const readJsonl = (f) =>
  readFileSync(resolve(SRC, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const ancient = readJsonl('data/ancient.jsonl');
const modern = readJsonl('data/modern.jsonl');

const modernById = new Map(modern.map((m) => [m.id, m]));

// OpenBible scores run roughly -400..1200; anything at or below zero is a
// rejected identification, so it must not silently become a map pin.
const MIN_SCORE = 1;

const places = [];
const unlocated = [];

for (const a of ancient) {
  const assoc = Object.entries(a.modern_associations ?? {})
    .filter(([, v]) => v && typeof v.score === 'number')
    .sort((x, y) => y[1].score - x[1].score);

  const verses = a.verses ?? [];
  const sorts = verses.map((v) => Number(v.sort)).filter(Number.isFinite);

  const base = {
    id: a.id,
    name: a.friendly_id,
    slug: a.url_slug,
    types: a.types ?? [],
    verseCount: verses.length,
    first: sorts.length ? Math.min(...sorts) : null,
    last: sorts.length ? Math.max(...sorts) : null,
    refs: verses.slice(0, 60).map((v) => v.osis),
    readable: verses.slice(0, 60).map((v) => v.readable),
  };

  const best = assoc.find(([id, v]) => v.score >= MIN_SCORE && modernById.get(id)?.lonlat);
  if (!best) { unlocated.push(base); continue; }

  const [modernId, link] = best;
  const m = modernById.get(modernId);
  const [lon, lat] = m.lonlat.split(',').map(Number);

  places.push({
    ...base,
    lon, lat,
    confidence: link.score,
    // How tightly the modern place itself is pinned — a `settlement` is a known
    // ruin, a `distance` is "somewhere this far from a known point".
    precision: m.precision?.type ?? 'unknown',
    precisionNote: m.precision?.description ?? '',
    modern: link.name,
    modernId,
    // How many rival identifications OpenBible weighed. >1 means scholars disagree.
    rivals: assoc.filter(([, v]) => v.score >= MIN_SCORE).length,
  });
}

places.sort((a, b) => (a.first ?? 9e9) - (b.first ?? 9e9));

const out = {
  meta: {
    source: 'OpenBible.info Bible Geocoding',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://www.openbible.info/geo/',
    generated: new Date().toISOString(),
    located: places.length,
    unlocated: unlocated.length,
  },
  places,
  unlocated,
};

mkdirSync(dirname('public/data/places.json'), { recursive: true });
writeFileSync('public/data/places.json', JSON.stringify(out));

const pct = (n) => `${((n / ancient.length) * 100).toFixed(1)}%`;
console.log(`古代地点总数      ${ancient.length}`);
console.log(`  已定位          ${places.length}  (${pct(places.length)})`);
console.log(`  无法定位        ${unlocated.length}  (${pct(unlocated.length)})`);
const byPrec = {};
for (const p of places) byPrec[p.precision] = (byPrec[p.precision] ?? 0) + 1;
console.log('定位精度分布      ', byPrec);
const disputed = places.filter((p) => p.rivals > 1).length;
console.log(`有多个竞争考据的  ${disputed}  (${pct(disputed)})`);
console.log(`输出              public/data/places.json`);
