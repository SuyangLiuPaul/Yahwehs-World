// Turns the SeekSparks journeys into route data the globe can draw.
//
// The merging rule is not a rendering convenience — it is the journey's own
// stated condition, and dropping it would make the map assert things the
// sources do not. Numbers 33 records the wilderness itinerary stop by stop and
// says Moses wrote it at the LORD's command, so the ORDER is not a modern
// reconstruction. Where the camps actually stood mostly is: most were never
// identified on the ground, and the gazetteer gives many of them one shared
// regional coordinate.
//
// So consecutive stops resolving to the same point become ONE marker carrying
// the whole run of ordinals, with no line drawn between them — because there is
// no known line between them. And where a stop has no coordinate at all the
// route breaks rather than being joined through it: a gap is true, and an
// invented straight line is not.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeZhResolver, makeProseNormaliser, makeEnNormaliser } from './lib/zh-names.mjs';

const journeys = JSON.parse(readFileSync('../SeekSparks/assets/bible_journeys.json', 'utf8'));

/** Inherited prose → the edition's spellings and divine name (see lib/zh-names). */
const yhwh = makeProseNormaliser();
const en = makeEnNormaliser();
const gaz = JSON.parse(readFileSync('../SeekSparks/assets/bible_places.json', 'utf8'));
const bundle = JSON.parse(readFileSync('public/data/places.json', 'utf8'));

// Chinese names are not decided here. The upstream gazetteer is a shared asset
// this repo does not edit; which name this project shows for one of its entries
// — the Union Version's own rendering, a correction with the verse that settles
// it, or nothing at all when the name belongs elsewhere — is one decision, and
// it lives in scripts/lib/zh-names.mjs so that it cannot reach the globe and
// miss the routes, which is exactly what happened twice.
const resolveZh = makeZhResolver();
const gazByName = new Map(gaz.places.map((p) => [p.n, p]));
const mineByName = new Map(bundle.places.map((p) => [p.name, p]));

function locate(name) {
  const g = gazByName.get(name);
  if (g && Array.isArray(g.ll) && g.ll.length === 2) {
    const r = resolveZh(g);
    return { lat: g.ll[0], lon: g.ll[1], zh: r.zh, zhHant: r.zhHant,
             from: r.source === 'gazetteer' ? 'gazetteer' : `gazetteer+${r.source}` };
  }
  const m = mineByName.get(name);
  if (m) return { lat: m.lat, lon: m.lon, zh: m.zh ?? '', zhHant: m.zhHant ?? '', from: 'openbible' };
  return null;
}

const out = journeys.journeys.map((j) => {
  const stops = j.stops.map((s, i) => {
    const loc = locate(s.place);
    return {
      n: i + 1,
      place: en.placeName(s.place),
      zh: loc?.zh || s.place,
      lat: loc?.lat ?? null,
      lon: loc?.lon ?? null,
      coordFrom: loc?.from ?? null,
      ref: `${s.book} ${s.chapter}:${s.verse}`,
      leg: s.leg ?? null,
      // The text does not place the travellers here at all.
      attested: s.attested !== false,
      // Named by the narrative but never reached — aimed at and missed, feared
      // and avoided. Drawn detached, taking no ordinal in the line.
      aside: s.kind === 'aside',
      note: yhwh(s.note?.['zh-Hans'] ?? ''),
    };
  });

  // Collapse consecutive stops that resolve to the same point.
  const markers = [];
  for (const s of stops) {
    if (s.aside) { markers.push({ ...s, stops: [s.n], aside: true }); continue; }
    const last = markers[markers.length - 1];
    const same = last && !last.aside && last.lat !== null && s.lat !== null &&
      Math.abs(last.lat - s.lat) < 1e-4 && Math.abs(last.lon - s.lon) < 1e-4;
    if (same) {
      last.stops.push(s.n);
      last.places.push(s.place);
      last.zhAll.push(s.zh);
      last.refs.push(s.ref);
    } else {
      markers.push({ ...s, stops: [s.n], places: [s.place], zhAll: [s.zh], refs: [s.ref] });
    }
  }

  // The drawable line: consecutive markers that both have a coordinate. A
  // marker with none ends the current run and starts a new one after it.
  const segments = [];
  let run = [];
  for (const m of markers) {
    if (m.aside) continue;
    if (m.lat === null) { if (run.length > 1) segments.push(run); run = []; continue; }
    run.push([m.lon, m.lat]);
  }
  if (run.length > 1) segments.push(run);

  const merged = markers.filter((m) => m.stops.length > 1).length;
  return {
    id: j.id,
    zh: j.name['zh-Hans'], en: j.name.en,
    // The upstream asset carries both languages for these two; taking only the
    // Chinese one left the route card speaking Chinese inside the English
    // interface, so both are carried through and the page picks one.
    range: j.range['zh-Hans'], rangeEn: j.range.en,
    // The shared asset's Chinese prose writes the divine name 耶和华; this
    // project reads the 雅伟 edition throughout, and a route's own note should
    // not be the one place on the site that says otherwise.
    basis: yhwh(j.basis['zh-Hans']), basisEn: en.prose(j.basis.en),
    style: j.style, mark: j.mark,
    stopCount: stops.length,
    markers, segments,
    merged,
    unlocated: stops.filter((s) => s.lat === null).length,
  };
});

writeFileSync('public/data/journeys.json', JSON.stringify({
  meta: {
    source: 'SeekSparks assets/bible_journeys.json；坐标取自其地名录，缺者回退 OpenBible',
    note: journeys.note,
    generated: new Date().toISOString(),
  },
  journeys: out,
}));

console.log('路线'.padEnd(22) + '站数  标记  合并  无坐标  线段');
for (const j of out) {
  console.log(
    j.zh.padEnd(20) +
    String(j.stopCount).padStart(4) +
    String(j.markers.length).padStart(6) +
    String(j.merged).padStart(6) +
    String(j.unlocated).padStart(8) +
    String(j.segments.length).padStart(6));
}
