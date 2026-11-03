// The seam that puts the 1,443 painted scenes back into the Bible text.
//
// The reader module (src/reader) is Words-derived and knows nothing about this site's pictures; it asks a host for
// the plates of a book through ReaderOptions.platesFor and places each one at the verse its event begins
// (src/reader/plates.ts). This file is that host's answer: it turns the gallery index — already in memory for the
// scenes page and the search palette — into the reader's ScenePlate shape, in the reader's language.
//
// The thumbnail is the same file the gallery grid uses: bundled in every native shell (docs/gallery-shells.md) and
// served from this site's own /pictures/thumb on the web, so a chapter reads with its pictures offline. A tap goes
// to the scene's own page, where the full-size picture is.
import { fullLocale } from '../locale.ts';
import type { ScenePlate } from '../reader/index.ts';
import { chapterOf, loadIndex, sceneTitle, verseOf, type GalleryIndex, type Scene } from './data.ts';
import { lqipGradient, thumbUrl } from './media.ts';

/** Every thumbnail is 480 px wide and 16:9 (scripts/lib/pictures_convert.py: THUMB_W = 480), so the reader can
 *  reserve the exact box before the file arrives and nothing below the plate moves when it lands. */
const THUMB_W = 480;
const THUMB_H = 270;

let ix: GalleryIndex | null = null;
/** book -> the scenes that begin in it, canon order. Built once per book, on first ask. */
const byBook = new Map<number, ScenePlate[]>();
/** language the cache was built in: a language switch throws it away. */
let cacheLang = '';

function toPlate(sc: Scene): ScenePlate {
  return {
    id: sc.id,
    chapter: chapterOf(sc.s),
    verse: verseOf(sc.s),
    title: sceneTitle(sc),
    href: `/scenes.html#p=${sc.id}`,
    src: thumbUrl(sc.id),
    w: THUMB_W,
    h: THUMB_H,
    tint: lqipGradient(sc.q) ?? undefined,
  };
}

/**
 * The plates of one book, for ReaderOptions.platesFor. Synchronous: it answers from the index already in memory and
 * returns an empty list while the index is still on the wire (the caller re-renders when `ready` resolves).
 * Only scenes with a served picture are offered; one still being drawn has a page but no plate in the text.
 */
export function platesFor(book: number): readonly ScenePlate[] {
  if (!ix) return [];
  // sceneTitle() reads the site locale, so the captions change with the language: drop the cache when it does
  const l = fullLocale();
  if (l !== cacheLang) { byBook.clear(); cacheLang = l; }
  let list = byBook.get(book);
  if (!list) {
    list = ix.scenes.filter((s) => s.b === book && s.ok).map(toPlate);
    byBook.set(book, list);
  }
  return list;
}

/** Loads the index if it is not in memory yet. Resolves true when platesFor can answer. */
export async function readyPlates(): Promise<boolean> {
  if (ix) return true;
  try {
    ix = await loadIndex();
    byBook.clear();
    cacheLang = fullLocale();
    return true;
  } catch {
    return false; // no index, no plates: the chapter still reads
  }
}
