// The joins between the three pages.
//
// This app had three doors and no corridors. The globe knows 1,443 events and
// ten journeys; /structures.html knows five things built to scriptural
// measurements; /tabernacle.html is a tabernacle you can walk into. A reader
// who opened 「立起会幕、神荣光充满」 on the globe was standing on Exodus 40
// with the tabernacle one tab away and nothing on screen saying so.
//
// Everything here is JOINED ON THE VERSE, not asserted by hand. Every part of
// this app already cites chapter and verse — a journey states the passage it
// is read out of, a structure states the verse that gives its measurements,
// an event carries the range it covers — so the join is: do these two cite
// overlapping text. That keeps the corridors honest as the data grows, and it
// means a wrong link is a wrong reference somewhere, which the audit can see.
//
// The one exception is marked AUTHORED below: which verses count as "this is
// the tabernacle you can walk into" is a judgement, not something the data
// states, so it is four verse anchors written out in the open rather than a
// rule pretending to derive them.
import { refKey } from './books.ts';
import { STRUCTURES } from './structures/specs.ts';
import type { Journey } from './routes.ts';
import type { TrackEvent } from './events-track.ts';

export interface Bridge {
  kind: 'journey' | 'structure' | 'walk';
  /** Journey id, structure id, or '' for the walk. */
  id: string;
  zh: string;
  en: string;
}

/** The canonical span a journey is read out of, taken from the verses its own
 *  stops cite. Not from `range`/`rangeEn`, which are prose for a reader and
 *  come in two languages and three shapes ("1 Samuel 4 – 2 Samuel 6"). */
export function journeySpan(jr: Journey): [number, number] {
  const keys: number[] = [];
  for (const m of jr.markers) {
    for (const ref of m.refs ?? [m.ref]) {
      const k = refKey(ref);
      if (k !== null) keys.push(k);
    }
  }
  if (!keys.length) return [0, -1]; // matches nothing, rather than everything
  return [Math.min(...keys), Math.max(...keys)];
}

/** Events whose passage overlaps the journey's. The claim this makes is
 *  exactly "inside the passage this journey is read out of" — not "happened
 *  at a stop on the route", which would be a different and much weaker claim,
 *  since a route's stops are places and an event's place list is not the
 *  route's itinerary. The UI says the former. */
export function eventsInJourney(jr: Journey, events: readonly TrackEvent[]): TrackEvent[] {
  const [lo, hi] = journeySpan(jr);
  return events.filter((ev) => ev.e >= lo && ev.s <= hi);
}

// AUTHORED. /tabernacle.html is the tent and its court; these are the passages
// where a reader is looking at that thing being specified, built or raised.
// Exodus 32 (the calf) sits between two of them and is deliberately not here:
// it is in the same chapters, and it is not the tabernacle.
const WALK_ANCHORS = ['Exodus 26:1', 'Exodus 27:18', 'Exodus 36:8', 'Exodus 40:17']
  .map(refKey)
  .filter((k): k is number => k !== null);

/** Structures, joined on the verse each one says gives its measurements. */
const STRUCTURE_ANCHORS = STRUCTURES
  .map((s) => ({ s, key: refKey(s.ref) }))
  .filter((x): x is { s: typeof STRUCTURES[number]; key: number } => x.key !== null);

const inEvent = (ev: TrackEvent, key: number) => ev.s <= key && key <= ev.e;

/** Everywhere else in the app this event can take the reader. */
export function bridgesFor(ev: TrackEvent, journeys: readonly Journey[]): Bridge[] {
  const out: Bridge[] = [];
  for (const jr of journeys) {
    const [lo, hi] = journeySpan(jr);
    if (ev.e >= lo && ev.s <= hi) out.push({ kind: 'journey', id: jr.id, zh: jr.zh, en: jr.en });
  }
  for (const { s, key } of STRUCTURE_ANCHORS) {
    if (inEvent(ev, key)) out.push({ kind: 'structure', id: s.id, zh: s.zh, en: s.en });
  }
  if (WALK_ANCHORS.some((k) => inEvent(ev, k))) {
    out.push({ kind: 'walk', id: '', zh: '走进会幕', en: 'Walk into the tabernacle' });
  }
  return out;
}

/** The first event that is about this structure, so the structure card can
 *  send the reader back to the globe and land on the right passage. */
export function eventForStructure(id: string, events: readonly TrackEvent[]): TrackEvent | null {
  const anchor = STRUCTURE_ANCHORS.find((a) => a.s.id === id);
  if (!anchor) return null;
  return events.find((ev) => inEvent(ev, anchor.key)) ?? null;
}

/** A journey that is about the same object as a structure card — the ark
 *  travels in 1 Samuel and is measured in Exodus, and the two pages had no
 *  idea about each other. Joined on the id they already share. */
export function structureForJourney(id: string): { id: string; zh: string; en: string } | null {
  const s = STRUCTURES.find((x) => x.id === id);
  return s ? { id: s.id, zh: s.zh, en: s.en } : null;
}

export const href = (b: Bridge) =>
  b.kind === 'walk' ? '/tabernacle.html' : `/structures.html#${b.id}`;
