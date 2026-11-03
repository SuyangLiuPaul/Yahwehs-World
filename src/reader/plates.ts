// The plates: the painted scenes, standing in the reading text at the verse where their event begins.
//
// This is the signature of the product — the picture and the Scripture are ONE view, not a gallery beside a reader.
// The old full-site reader (src/bible-book.ts, still served at the dev /bible.html) cut a chapter into event
// sections and drew each scene's plate between the section heading and that section's first verse:
//
//     <section class="bb-section">
//       <div class="bb-sec-head"> h3 title · reference · plate # · globe chip </div>
//       <p class="bb-sec-explain"> the section's summary </p>
//       <div class="bb-plate-frame"> <img loading="lazy"> </div>   <-- the plate, AFTER the heading
//       <div class="bb-scripture-prose"> the verses </div>         <-- and BEFORE the verses
//     </section>
//
// The reader module is Words-derived and knows nothing about scenes, so the host (src/gallery/plates.ts) supplies
// them and this file decides only WHERE each one goes. Pure: no DOM and no fetch, so the placement rules are tested
// in node (tests/reader/plates.test.ts) and run the same on the web and in every native shell.
import type { Mode } from './types.ts';

export interface ScenePlate {
  /** The scene's id, e.g. "genesis-1-1". Also the key of its own page, /scenes.html#p=<id>. */
  id: string;
  /** Chapter and verse where the scene's passage STARTS. A scene is drawn once, in the chapter it begins in. */
  chapter: number;
  verse: number;
  /** The title in the reader's language: the caption, and the picture's alt text. */
  title: string;
  /** Where a tap goes: the scene's own page. */
  href: string;
  /** The bundled thumbnail (in a shell this is a local file; on the web it is this site's own /pictures/thumb). */
  src: string;
  /** Intrinsic size, so the space is reserved before the file arrives and the text does not jump. */
  w: number;
  h: number;
  /** A CSS colour (the gallery's 8-character placeholder as a gradient), painted until the thumbnail does. */
  tint?: string;
}

/** Plates grouped by the verse they are drawn immediately before. */
export type PlateAnchors = ReadonlyMap<number, readonly ScenePlate[]>;

export interface PlacementInput {
  plates: readonly ScenePlate[];
  /** The chapter being rendered. */
  chapter: number;
  /** The verses actually on screen, in order (a passage shows a slice of a chapter). */
  verses: readonly number[];
  /** Verses that begin a paragraph, from the reader's own paragraph data. */
  paraStarts?: ReadonlySet<number> | null;
  /** Verses carrying a section heading. A heading always begins a paragraph, so it is a paragraph boundary too. */
  headingVerses?: ReadonlySet<number> | null;
  mode: Mode;
}

const EMPTY: PlateAnchors = new Map();

/**
 * Which verse each plate is drawn before.
 *
 * verse and parallel layouts   the plate sits immediately before its own first verse.
 * paragraph layout             the plate sits before the PARAGRAPH that contains its first verse, because a plate
 *                              dropped between two verses of one paragraph would break the running text in half.
 *                              In practice the two coincide: a scene's first verse almost always carries the section
 *                              heading, and a heading already starts a paragraph.
 *
 * A scene whose first verse is not on screen gets no plate: it is drawn in the chapter where it begins, once.
 */
export function placePlates(i: PlacementInput): PlateAnchors {
  if (!i.plates.length || !i.verses.length) return EMPTY;

  const shown = new Set(i.verses);
  // Scenes that START in this chapter, at a verse that is on screen, in canon order.
  const mine = i.plates
    .filter((p) => p.chapter === i.chapter && shown.has(p.verse))
    .sort((a, b) => a.verse - b.verse || a.id.localeCompare(b.id));
  if (!mine.length) return EMPTY;

  const anchorOf = i.mode === 'paragraph' ? paragraphAnchor(i) : (v: number) => v;

  const out = new Map<number, ScenePlate[]>();
  for (const p of mine) {
    const at = anchorOf(p.verse);
    const list = out.get(at);
    if (list) list.push(p);
    else out.set(at, [p]);
  }
  return out;
}

/** In paragraph layout: the first verse of the paragraph a verse belongs to. */
function paragraphAnchor(i: PlacementInput): (verse: number) => number {
  // Every verse at which a new paragraph opens. The first verse on screen always opens one; so does every verse in
  // the paragraph data, and every verse with a heading (render.ts closes the open paragraph before a heading).
  const bounds: number[] = [];
  for (const v of i.verses) {
    if (bounds.length === 0 || i.paraStarts?.has(v) || i.headingVerses?.has(v)) bounds.push(v);
  }
  return (verse: number): number => {
    let at = bounds[0]!;
    for (const b of bounds) {
      if (b > verse) break;
      at = b;
    }
    return at;
  };
}

/** The verses that carry a plate, for a host that wants to mark them (and for the verify scripts). */
export function plateVerses(a: PlateAnchors): number[] {
  const out: number[] = [];
  for (const list of a.values()) for (const p of list) out.push(p.verse);
  return out.sort((x, y) => x - y);
}
