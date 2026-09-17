// The joins between the pages.
//
// This app had four doors and no corridors. The globe knows 1,443 events and
// ten journeys; /structures.html knows the things built to scriptural
// measurements; /tabernacle.html is a tabernacle you can walk into;
// /temple.html is Solomon's temple you can walk into. A reader who opened
// 「立起会幕、神荣光充满」 on the globe was standing on Exodus 40 with the
// tabernacle one tab away and nothing on screen saying so.
//
// Everything here is JOINED ON THE VERSE, not asserted by hand. Every part of
// this app already cites chapter and verse — a journey states the passage it
// is read out of, a structure states the verse that gives its measurements,
// an event carries the range it covers — so the join is: do these two cite
// overlapping text. That keeps the corridors honest as the data grows, and it
// means a wrong link is a wrong reference somewhere, which the audit can see.
//
// The exceptions are marked AUTHORED below: which verses count as "this is
// the tabernacle you can walk into" (or the temple) is a judgement, not
// something the data states, so they are verse anchors written out in the
// open rather than a rule pretending to derive them.
import { refKey } from './books.ts';
import { STRUCTURES } from './structures/specs.ts';
import type { Journey } from './routes.ts';
import type { TrackEvent } from './events-track.ts';

export interface Bridge {
  kind: 'journey' | 'structure' | 'walk';
  /** Journey id, structure id, or 'tabernacle' / 'temple' for a walk. */
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

// AUTHORED. /temple.html is Solomon's house. These are the passages where a
// reader is looking at that building being measured, built or dedicated.
// 1 Kings 8 (the dedication) is in the same stretch and is deliberately not
// here — it is the prayer, not the plan.
const TEMPLE_WALK_ANCHORS = [
  '1 Kings 6:2', '1 Kings 6:16', '1 Kings 6:37',
  '1 Kings 7:15', '1 Kings 7:23',
  '2 Chronicles 3:1', '2 Chronicles 4:1',
].map(refKey).filter((k): k is number => k !== null);

/** Structures, joined on the verse each one says gives its measurements. */
const STRUCTURE_ANCHORS = STRUCTURES
  .map((s) => ({ s, key: refKey(s.ref) }))
  .filter((x): x is { s: typeof STRUCTURES[number]; key: number } => x.key !== null);

// AUTHORED. /ark.html is the ark of Genesis 6. The whole specification is
// 6:14–16, and 7:13 is the day they went in.
const ARK_WALK_ANCHORS = ['Genesis 6:14', 'Genesis 6:15', 'Genesis 6:16', 'Genesis 7:13']
  .map(refKey)
  .filter((k): k is number => k !== null);

const inEvent = (ev: TrackEvent, key: number) => ev.s <= key && key <= ev.e;

/** Everywhere else in this app this event can take the reader. */
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
    out.push({ kind: 'walk', id: 'tabernacle', zh: '走进会幕', en: 'Walk into the tabernacle' });
  }
  if (TEMPLE_WALK_ANCHORS.some((k) => inEvent(ev, k))) {
    out.push({ kind: 'walk', id: 'temple', zh: '走进圣殿', en: "Walk into Solomon's temple" });
  }
  if (ARK_WALK_ANCHORS.some((k) => inEvent(ev, k))) {
    out.push({ kind: 'walk', id: 'ark', zh: '走进方舟', en: "Walk into Noah's ark" });
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

const WALK_PAGES: Record<string, string> = {
  tabernacle: '/tabernacle.html',
  temple: '/temple.html',
  ark: '/ark.html',
};

export const href = (b: Bridge) => {
  if (b.kind === 'walk') return WALK_PAGES[b.id] ?? '/tabernacle.html';
  return `/structures.html#${b.id}`;
};