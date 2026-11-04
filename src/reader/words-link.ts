// "Continue in Yahweh's Words": the one link from a chapter here into the church's own Bible app.
//
// VERIFIED, not assumed (2026-11-04). `gallery-release` §3 asked for this link and the gap audit wrote the URL as
// `https://yahwehword.com/#/bible/<book>/<ch>`, which does not exist — there is no `/bible` segment. The real
// grammar is in the Words checkout, `lib/services/url_sync_service_web.dart` and `lib/constants/book_slugs.dart`:
//
//     /#/<bookSlug>                 that book, chapter 1
//     /#/<bookSlug>/<chapter>       book + chapter
//     /#/<bookSlug>/<chapter>:<v>   book + chapter, scrolled to a verse
//     /#/...?v=<version>            in that edition
//
// Checked live in the browser: `https://yahwehword.com/#/john/3` was rewritten by the app itself to
// `https://yahwehword.com/#/john/3:1?v=bsb-yhwh` and opened John 3. Slugs are lowercase canonical English with the
// spaces taken out ("1 Samuel" -> "1samuel", "Song of Solomon" -> "songofsolomon"), which is exactly what
// `slugOf` below derives from this project's own English book names — so the two lists cannot drift apart silently
// (tests/reader/words-link.test.ts checks all 66 against the slugs Words ships).
//
// The edition is passed through only when Words has an edition of the same id. All eight of this release's ids
// exist there (`lib/constants/bible_versions.dart`), but the check is by list, not by faith: an id Words does not
// know would land the reader on an empty chapter, and no `?v=` simply leaves them on their own current edition.
import { BOOKS } from './books.ts';

export const WORDS_ORIGIN = 'https://yahwehword.com';

/** Edition ids `yahwehword.com` answers to, read from Words' `bible_versions.dart` on 2026-11-04. */
export const WORDS_EDITIONS: ReadonlySet<string> = new Set([
  'bsb-yhwh', 'kjv', 'web-yhwh', 'asv-yhwh', 'cuvs-yhwh', 'cuvs-yhwh-tr', 'rst', 'rst-yhwh',
]);

/** Words' slug rule: the canonical English name, lowercased, with every space removed. */
export function slugOf(englishName: string): string {
  return englishName.toLowerCase().replace(/\s+/g, '');
}

export interface WordsLinkInput {
  /** 1..66 */
  book: number;
  chapter: number;
  /** optional verse to land on */
  verse?: number;
  /** this reader's edition id; passed through only when Words has one of the same id */
  edition?: string;
  origin?: string;
}

/** The address of this chapter in Yahweh's Words, or null when the book number is not one of the 66. */
export function wordsChapterUrl(i: WordsLinkInput): string | null {
  const b = BOOKS[i.book - 1];
  if (!b || !(i.chapter >= 1)) return null;
  const slug = slugOf(b.en);
  const where = i.verse && i.verse >= 1 ? `${i.chapter}:${i.verse}` : `${i.chapter}`;
  const q = i.edition && WORDS_EDITIONS.has(i.edition) ? `?v=${encodeURIComponent(i.edition)}` : '';
  return `${i.origin ?? WORDS_ORIGIN}/#/${slug}/${where}${q}`;
}
