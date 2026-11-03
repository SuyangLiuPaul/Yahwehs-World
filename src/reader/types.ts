// Shared shapes of the reader module. Nothing here touches the DOM.

/** The interface languages of this release (owner, 2026-11-03): English, Chinese in both scripts, Russian. */
export type UiLang = 'en' | 'zh-Hans' | 'zh-Hant' | 'ru';
export const UI_LANGS: readonly UiLang[] = ['en', 'zh-Hans', 'zh-Hant', 'ru'];

/** Words' convention (tools/i18n/languages.json): a language is "reviewed" only when a named person has read the whole pack.
 *  Russian ships bundled in Words with no reviewer, so it is shown as not yet read by a native speaker. */
export const UI_LANG_INFO: Record<UiLang, { endonym: string; dir: 'ltr' | 'rtl'; reviewed: boolean }> = {
  en: { endonym: 'English', dir: 'ltr', reviewed: true },
  'zh-Hans': { endonym: '简体中文', dir: 'ltr', reviewed: true },
  'zh-Hant': { endonym: '繁體中文', dir: 'ltr', reviewed: true },
  ru: { endonym: 'Русский', dir: 'ltr', reviewed: false },
};

/** Reading layout: one verse a line, paragraphs, or the interleaved 对照 layout. */
export type Mode = 'verse' | 'paragraph' | 'parallel';
export type ThemePref = 'auto' | 'dark' | 'light' | 'paper';
export type HeadingSet = 'cuv' | 'cuv-tr' | 'english-classic' | 'ru';

export interface EditionInfo {
  id: string;
  /** The edition's own language, which names the books and the credit line. */
  language: UiLang;
  /** Proper name, never translated (Words' rule). */
  label: string;
  menu: string;
  narrow: string;
  note: string;
  headingSet: HeadingSet;
  /** Name used in the first line of a copy: "BSB, Yahweh edition", "和合本雅伟版". */
  copyName: string;
  credit: Record<UiLang, string>;
  licence: {
    kind: 'cc0' | 'public-domain';
    holder: string;
    url?: string;
    note: Record<UiLang, string>;
  };
  sha256: string;
  bytes: number;
  verses: number;
}

export interface BookInfo {
  n: number;
  en: string;
  'zh-Hans': string;
  'zh-Hant': string;
  ru: string;
  chapters: number;
  /** Verse count per chapter (the union of the six editions). */
  vc: number[];
}

export interface Catalogue {
  v: number;
  wordsCommit: string;
  defaults: Record<UiLang, string>;
  editions: EditionInfo[];
  books: BookInfo[];
  enAliases: Record<string, string[]>;
  zhAliases: Record<string, string>;
  /** Russian full names and abbreviations -> English book name */
  ruAliases: Record<string, string>;
}

/** A passage inside one chapter. `v1`/`v2` absent = the whole chapter. */
export interface Ref {
  book: number;
  chapter: number;
  v1?: number;
  v2?: number;
}

export interface HeadingEntry {
  v: number;
  t: string;
  c?: string;
}

/** One book of one edition: chapters of verses; a verse the edition omits is null. */
export type BookText = (string | null)[][];
/** chapter number (string) -> headings starting in it. */
export type BookHeadings = Record<string, HeadingEntry[]>;
/** chapter number (string) -> verses that start a paragraph. */
export type BookPara = Record<string, number[]>;

/** What a data fetch can end in; the view shows a named state for each. */
export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface Prefs {
  /** edition chosen per UI language; absent = that language's default */
  edition: Partial<Record<UiLang, string>>;
  mode: Mode;
  /** parallel set: the main edition is the first; max 3 */
  parallel: string[];
  size: number;
  theme: ThemePref;
  /** most recent chapters, newest first, as "book:chapter" */
  recent: string[];
}
