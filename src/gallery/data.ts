// What the three gallery pages know about the 1,443 scenes, and how they say it.
//
// public/data/gallery/index.json (scripts/build-gallery-data.mjs) carries the small part every page needs at
// start-up: id, book, verse range, titles, the colour placeholder, whether a picture is served. The one-line
// summaries are a second file, loaded on the first picture page or the first search. Verse numbers are the
// canonical key bbbcccvvv (book * 1e6 + chapter * 1e3 + verse), the same keys the reader's data uses.
import { BOOKS } from '../books.ts';
import { fullLocale, hant } from '../locale.ts';
import { BOOKS_RU } from './books-ru.ts';

/** The four readings the gallery speaks. `locale()` in locale.ts answers only en|zh (Russian reads as en there). */
export type Lang = 'en' | 'zh' | 'ru';
export const lang = (): Lang => { const l = fullLocale(); return l === 'en' ? 'en' : l === 'ru' ? 'ru' : 'zh'; };

export interface Scene {
  id: string;
  /** book 1..66 */ b: number;
  /** first and last verse, canonical keys */ s: number; e: number;
  zh: string; en: string;
  /** Russian title, '' if none */ ru: string;
  /** 8-character colour placeholder, '' if none */ q: string;
  /** a gate-passed picture is served for it */ ok: boolean;
  /** 0-based position in canon order */ i: number;
}

export interface GalleryIndex {
  scenes: Scene[];
  byId: Map<string, Scene>;
  /** scenes per book, index 0 = Genesis */ books: number[];
  /** old /#journey=<id> links land on this scene */ journeyScene: Record<string, string>;
  served: number;
}

type Raw = { v: number; n: number; ok: number; books: number[]; jr: Record<string, string>; ev: [string, number, number, number, string, string, string, number, string?][] };

let indexP: Promise<GalleryIndex> | null = null;

/** One fetch for the whole site. A failed fetch is not remembered, so Retry really retries. */
export function loadIndex(): Promise<GalleryIndex> {
  if (!indexP) {
    indexP = fetch('/data/gallery/index.json')
      .then((r) => { if (!r.ok) throw new Error(`index ${r.status}`); return r.json() as Promise<Raw>; })
      .then((raw) => {
        const scenes = raw.ev.map(([id, b, s, e, zh, en, q, ok, ru], i): Scene => ({ id, b, s, e, zh, en, ru: ru ?? '', q, ok: ok === 1, i }));
        return { scenes, byId: new Map(scenes.map((x) => [x.id, x])), books: raw.books, journeyScene: raw.jr, served: raw.ok };
      });
    indexP.catch(() => { indexP = null; });
  }
  return indexP;
}

export type Summaries = { zh: string[]; en: string[]; ru: string[] };
let sumP: Promise<Summaries> | null = null;
export function loadSummaries(): Promise<Summaries> {
  if (!sumP) {
    sumP = fetch('/data/gallery/summaries.json').then((r) => { if (!r.ok) throw new Error(`summaries ${r.status}`); return r.json() as Promise<Summaries>; });
    sumP.catch(() => { sumP = null; });
  }
  return sumP;
}

// ── words ────────────────────────────────────────────────────────────────
/** The title in the reader's language; 繁體 readers get the converted script. */
export const sceneTitle = (sc: Scene) => { const l = lang(); return l === 'zh' ? hant(sc.zh) : l === 'ru' ? sc.ru || sc.en : sc.en; };
/** The other language, for the second line of a caption. */
export const sceneTitleAlt = (sc: Scene) => (lang() === 'zh' ? sc.en : hant(sc.zh));
export const bookTitle = (b: number, l: Lang = lang()) => (l === 'zh' ? hant(BOOKS[b - 1]?.zh ?? '') : l === 'ru' ? BOOKS_RU[b - 1] ?? '' : BOOKS[b - 1]?.en ?? '');

/** The one-line summary in the reader's language (English where a language has none). */
export const sceneSummary = (sums: Summaries, sc: Scene) => {
  const l = lang();
  return (l === 'zh' ? hant(sums.zh[sc.i] ?? '') : l === 'ru' ? sums.ru?.[sc.i] || sums.en[sc.i] : sums.en[sc.i] || hant(sums.zh[sc.i] ?? '')) ?? '';
};

export const chapterOf = (key: number) => Math.floor((key % 1_000_000) / 1000);
export const verseOf = (key: number) => key % 1000;

/** "Genesis 15:1–21", "Genesis 15:1–16:5", "创世记 15:1–21". */
export function refText(sc: Pick<Scene, 'b' | 's' | 'e'>, l: Lang = lang()): string {
  const name = bookTitle(sc.b, l);
  const sc1 = chapterOf(sc.s), sv = verseOf(sc.s), ec = chapterOf(sc.e), ev = verseOf(sc.e);
  const range = sc1 === ec ? (sv === ev ? `${sc1}:${sv}` : `${sc1}:${sv}–${ev}`) : `${sc1}:${sv}–${ec}:${ev}`;
  return `${name} ${range}`;
}

export const isOldTestament = (b: number) => b <= 39;

/** The scene that stands before / after this one in canon order, or null. */
export const neighbour = (ix: GalleryIndex, sc: Scene, d: -1 | 1) => ix.scenes[sc.i + d] ?? null;

/** Where "read the whole chapter" goes today: the shipped reader's own ?book=&ch= address. */
export const chapterHref = (sc: Pick<Scene, 'b' | 's'>) => `/bible.html?book=${sc.b}&ch=${chapterOf(sc.s)}`;
