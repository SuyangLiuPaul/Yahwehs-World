// Section headings (小标题): which set an edition reads, and which heading governs a verse.
//
// The set follows the EDITION, as in Words' lib/constants/section_title_map.dart:
//   CUV-derived editions read the church's Chinese set (`cuv`, `cuv-tr` for Traditional);
//   English editions read the neutral `english-classic` set (the BSB's own headings, public
//   domain), never NIV/NASB headings. The headings are the app's furniture, not part of any text.
import type { BookHeadings, HeadingEntry, HeadingSet } from './types.ts';
import { editionById } from './books.ts';

/** The same table Words ships, restricted to the six editions this site serves. */
export const SET_BY_EDITION: Readonly<Record<string, HeadingSet>> = {
  'bsb-yhwh': 'english-classic',
  kjv: 'english-classic',
  'web-yhwh': 'english-classic',
  'asv-yhwh': 'english-classic',
  'cuvs-yhwh': 'cuv',
  'cuvs-yhwh-tr': 'cuv-tr',
};

export function headingSetFor(edition: string): HeadingSet {
  return editionById(edition)?.headingSet ?? SET_BY_EDITION[edition] ?? 'english-classic';
}

/** Headings that start inside [v1, v2] of a chapter, in order. */
export function headingsIn(h: BookHeadings | null | undefined, chapter: number, v1 = 1, v2 = Infinity): HeadingEntry[] {
  return (h?.[String(chapter)] ?? []).filter((e) => e.v >= v1 && e.v <= v2).sort((a, b) => a.v - b.v);
}

/** The heading a verse sits under: the last one at or before it. */
export function headingAt(h: BookHeadings | null | undefined, chapter: number, verse: number): HeadingEntry | null {
  let hit: HeadingEntry | null = null;
  for (const e of h?.[String(chapter)] ?? []) if (e.v <= verse && (!hit || e.v > hit.v)) hit = e;
  return hit;
}
