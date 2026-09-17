// Trims data/events/all-events.json into public/data/events.json — the copy
// the browser downloads.
//
// The authored file carries everything a reviewer needs: provenance, parallel
// passages, per-event notes, the reviewer's own status field. The reader needs
// none of that, and it is two thirds of the bytes. What ships is what the
// track draws and what a reader sees when they open one: the name, the
// passage, the one-line summary, the year band and why it has those numbers,
// and the places the verse range resolved to.
//
// NOTHING here authors, re-dates or re-summarises anything — it is a
// projection. all-events.json is generated (scripts/build-all-events.mjs) and
// must not be hand-edited; corrections go to summary-overrides.json and are
// picked up upstream.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(readFileSync(join(ROOT, 'data/events/all-events.json'), 'utf8'));

// `dateSource.kind === 'spine'` means the year came straight from a SeekSparks
// spine entry rather than being bounded by the ones around it — the firmest
// dating this dataset has. NOTE: 309 events carry it, not 105. The 105 spine
// entries are what the dates were taken FROM (many events share one: 28 events
// are dated from `isaiah` alone), so "the 105 spine events" do not exist as a
// subset of these 1,443. What the track can honestly show is which events are
// spine-dated, and that is what `spine` marks.
const spineOf = (e) => ((e.dateSource || {}).kind === 'spine' ? 1 : 0);

const events = src.events.map((e) => {
  const out = {
    id: e.id,
    zh: e.zh,
    en: e.en,
    b: e.book,
    s: e.start,
    e: e.end,
    ref: e.ref,
    refZh: e.refZh,
    sum: e.summaryZh,
    basis: e.dateBasis,
    c: e.dateConfidence,
    p: e.placeIds ?? [],
  };
  if (e.yearEarly !== null && e.yearEarly !== undefined) out.y0 = e.yearEarly;
  if (e.yearLate !== null && e.yearLate !== undefined) out.y1 = e.yearLate;
  if (spineOf(e)) out.spine = 1;
  return out;
});

const payload = {
  meta: {
    count: events.length,
    // Carried through so the page can say what these are without a second
    // fetch, and so the clearance travels with the data it cleared.
    generated: src.meta.generated,
    cleared: src.meta.candidatesCleared?.date ?? null,
    notReviewed: src.meta.candidatesCleared?.notReviewed ?? '',
  },
  events,
};

const out = join(ROOT, 'public/data/events.json');
writeFileSync(out, JSON.stringify(payload));

const kb = (n) => `${Math.round(n / 1024)} kB`;
const dated = events.filter((e) => e.y0 !== undefined).length;
console.log(
  `events.json: ${events.length} events (${dated} dated, ${events.length - dated} undated), ` +
  `${events.filter((e) => e.c === 'disputed').length} disputed, ` +
  `${events.filter((e) => e.spine).length} spine-dated, ${kb(readFileSync(out).length)}`,
);
