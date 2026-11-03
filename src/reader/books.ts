// Book names, the language rule and the reference parser.
//
// The rule (ported from Words' lib/i18n/language_rule.dart, the part this site needs):
//   * the chrome follows the reader's interface language (`ui`);
//   * a book name, and so a reference, follows the EDITION being read when one is given,
//     and the interface language when none is (history, pickers with no text).
// So a Chinese reader on the BSB sees "Genesis 1:1" over the text and 创世记 in the menus.
import { CATALOGUE } from './catalogue.gen.ts';
import type { BookInfo, Catalogue, EditionInfo, Ref, UiLang } from './types.ts';

export const catalogue = (): Catalogue => CATALOGUE;
export const BOOKS: readonly BookInfo[] = CATALOGUE.books;
export const EDITIONS: readonly EditionInfo[] = CATALOGUE.editions;

export const editionById = (id: string | null | undefined): EditionInfo | undefined =>
  EDITIONS.find((e) => e.id === id);

export function editionOrDefault(id: string | null | undefined, ui: UiLang): EditionInfo {
  return editionById(id) ?? editionById(CATALOGUE.defaults[ui]) ?? EDITIONS[0]!;
}

export const defaultEditionFor = (ui: UiLang): string => CATALOGUE.defaults[ui];

// ── interface language ────────────────────────────────────────────────────

/** Maps one stored or device tag to a UI language, or null (ru, fr, ... are not shipped). */
export function matchUiTag(tag: string | null | undefined): UiLang | null {
  if (!tag) return null;
  const parts = tag.replace(/_/g, '-').split('-');
  const l = parts[0]!.toLowerCase();
  if (l === 'en') return 'en';
  if (l === 'zh') {
    let script: string | undefined;
    let region: string | undefined;
    for (const p of parts.slice(1)) {
      if (p.length === 4) script = p.toLowerCase();
      else if (p.length === 2 || p.length === 3) region = p.toUpperCase();
    }
    if (script === 'hant') return 'zh-Hant';
    if (script === 'hans') return 'zh-Hans';
    if (region === 'TW' || region === 'HK' || region === 'MO') return 'zh-Hant';
    return 'zh-Hans';
  }
  return null;
}

/** explicit setting, then the device's list in order, then English. */
export function resolveUi(explicit?: string | null, device: readonly string[] = []): UiLang {
  const e = matchUiTag(explicit);
  if (e) return e;
  for (const d of device) {
    const hit = matchUiTag(d);
    if (hit) return hit;
  }
  return 'en';
}

// ── names ────────────────────────────────────────────────────────────────

/** Book name in a language. `lang` is a UI language or an edition's language. */
export function bookNameIn(book: number, lang: UiLang): string {
  const b = BOOKS[book - 1];
  if (!b) return '';
  return lang === 'en' ? b.en : b[lang];
}

/** The language a label prints in: the edition's when one is given, else the interface's. */
export function labelLanguage(ui: UiLang, edition?: string | null): UiLang {
  const e = editionById(edition);
  return e ? e.language : ui;
}

export function bookName(book: number, ui: UiLang, edition?: string | null): string {
  return bookNameIn(book, labelLanguage(ui, edition));
}

const RANGE = '–'; // en dash

/** "Genesis 1", "创世记 1:1–3". Chapter and verse text stay as numerals. */
export function referenceLabel(r: Ref, ui: UiLang, edition?: string | null): string {
  const name = bookName(r.book, ui, edition);
  let tail = `${r.chapter}`;
  if (r.v1 != null) {
    tail += `:${r.v1}`;
    if (r.v2 != null && r.v2 > r.v1) tail += `${RANGE}${r.v2}`;
  }
  return `${name} ${tail}`;
}

/** Collapses [3,4,5,7] to "3–5, 7". */
export function formatVerseRange(nums: readonly number[]): string {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  if (!s.length) return '';
  const parts: string[] = [];
  let a = s[0]!, b = a;
  for (let i = 1; i < s.length; i++) {
    const n = s[i]!;
    if (n === b + 1) b = n;
    else { parts.push(a === b ? `${a}` : `${a}${RANGE}${b}`); a = b = n; }
  }
  parts.push(a === b ? `${a}` : `${a}${RANGE}${b}`);
  return parts.join(', ');
}

/** "创世记 1:1–3, 5" for a set of verses of one chapter. */
export function referenceForVerses(book: number, chapter: number, verses: readonly number[], ui: UiLang, edition?: string | null): string {
  return `${bookName(book, ui, edition)} ${chapter}:${formatVerseRange(verses)}`;
}

// ── parsing ───────────────────────────────────────────────────────────────

const normalize = (s: string): string =>
  s.trim().toLowerCase().replace(/[.·]/g, '').replace(/\s+/g, ' ').replace(/[　]/g, ' ');

let aliasIndex: Map<string, number> | null = null;
function index(): Map<string, number> {
  if (aliasIndex) return aliasIndex;
  const m = new Map<string, number>();
  const add = (alias: string, n: number) => { const k = normalize(alias); if (k) m.set(k, n); };
  for (const b of BOOKS) {
    add(b.en, b.n); add(b['zh-Hans'], b.n); add(b['zh-Hant'], b.n);
    for (const a of CATALOGUE.enAliases[b.en] ?? []) add(a, b.n);
  }
  for (const [zh, en] of Object.entries(CATALOGUE.zhAliases)) {
    const b = BOOKS.find((x) => x.en === en);
    if (b) add(zh, b.n);
  }
  // Traditional spellings of the single-character abbreviations Words only lists in Simplified
  const trad: Record<string, string> = {
    創: 'Genesis', 傳: 'Ecclesiastes', 約: 'John', 約一: '1 John', 約二: '2 John', 約三: '3 John',
    '1約': '1 John', '2約': '2 John', '3約': '3 John', 林後: '2 Corinthians', 帖後: '2 Thessalonians',
    提後: '2 Timothy', 彼後: '2 Peter', 啓: 'Revelation', 約拿: 'Jonah',
  };
  for (const [zh, en] of Object.entries(trad)) { const b = BOOKS.find((x) => x.en === en); if (b) add(zh, b.n); }
  aliasIndex = m;
  return m;
}

/** Book number for a typed name ("Gen", "创", "創世記", "1 cor", "1约"), or null. */
export function resolveBook(input: string): number | null {
  const k = normalize(input);
  if (!k) return null;
  const hit = index().get(k);
  if (hit) return hit;
  // "1cor" -> "1 cor"
  const num = k.match(/^([1-3])\s*(.+)$/);
  if (num) {
    const again = index().get(`${num[1]} ${num[2]}`);
    if (again) return again;
    const rest = index().get(num[2]!);
    // "1 Cor" is an alias on its own; a bare "Cor" is not, so a numbered prefix is only
    // honoured for books that exist in numbered form
    if (rest) {
      const base = BOOKS[rest - 1]!.en;
      const numbered = BOOKS.find((b) => b.en === `${num[1]} ${base}`);
      if (numbered) return numbered.n;
    }
  }
  return null;
}

const CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
/** 一 / 十二 / 二十三 / 一百一十九 -> number (1..199), else null. */
export function cnNumber(s: string): number | null {
  const m = s.match(/^(?:([一二三四五六七八九])百)?(?:([一二三四五六七八九])?(十))?(?:[〇零]?([一二三四五六七八九]))?$/);
  if (!m || !s) return null;
  let n = 0;
  if (m[1]) n += CN[m[1]]! * 100;
  if (m[3]) n += (m[2] ? CN[m[2]]! : 1) * 10;
  if (m[4]) n += CN[m[4]]!;
  return n > 0 && n < 200 ? n : null;
}

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const d = parseInt(s, 10);
  return Number.isNaN(d) ? cnNumber(s) : d;
};

/** Clamps a parsed reference into the canon; null when the chapter does not exist. */
function build(book: number | null, chapter: number | null, v1: number | null, v2: number | null): Ref | null {
  if (!book || !chapter) return null;
  const b = BOOKS[book - 1]!;
  if (chapter < 1 || chapter > b.chapters) return null;
  const max = b.vc[chapter - 1]!;
  const r: Ref = { book, chapter };
  if (v1 != null) {
    if (v1 < 1 || v1 > max) return { book, chapter };
    r.v1 = v1;
    if (v2 != null && v2 > v1) r.v2 = Math.min(v2, max);
  }
  return r;
}

const SINGLE_CHAPTER = new Set(['Obadiah', 'Philemon', '2 John', '3 John', 'Jude']);

/** Parses "John 3:16-18", "约 3:16", "Gen 12", "马太福音第5章第7节", "jn3:16", a bare book. */
export function parseReference(input: string): Ref | null {
  let raw = input.trim();
  if (!raw) return null;
  raw = raw.split(';')[0]!.split(',')[0]!.trim();
  raw = raw.replace(/[–—]/g, '-').replace(/[：]/g, ':');

  // 马太福音第5章第7节 / 詩篇119篇105節 / 约翰福音三章十六节
  const zh = raw.match(/^(.*?)\s*(?:第\s*)?([0-9〇零一二三四五六七八九十百]+)\s*[章篇](?:\s*第?\s*([0-9〇零一二三四五六七八九十百]+)\s*[節节](?:\s*[到至\-~～]\s*第?\s*([0-9〇零一二三四五六七八九十百]+)\s*[節节])?)?\s*$/);
  if (zh && zh[1]) return build(resolveBook(zh[1]), num(zh[2]), num(zh[3]), num(zh[4]));

  // Book 12:3-4:5 across chapters: navigate to the start
  const xc = raw.match(/^(.*?)\s*(\d+)\s*:\s*(\d+)\s*-\s*(\d+)\s*:\s*\d+\s*$/);
  if (xc) return build(resolveBook(xc[1]!), num(xc[2]), num(xc[3]), null);

  // Book 6-9 (chapter span) -> first chapter; in a one-chapter book it is a verse span
  const cm = raw.match(/^(.*?)\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (cm) {
    const book = resolveBook(cm[1]!);
    if (book && SINGLE_CHAPTER.has(BOOKS[book - 1]!.en)) return build(book, 1, num(cm[2]), num(cm[3]));
    const r = build(book, num(cm[2]), null, null);
    if (r) return r;
  }

  const m = raw.match(/^(.*?)\s*(\d+)(?:\s*:\s*(\d+)(?:\s*-\s*(\d+))?)?\s*$/);
  if (m && m[1]) {
    const book = resolveBook(m[1]);
    // "Jude 5" means verse 5 of the only chapter
    if (book && SINGLE_CHAPTER.has(BOOKS[book - 1]!.en) && m[3] == null) return build(book, 1, num(m[2]), null);
    const r = build(book, num(m[2]), num(m[3]), num(m[4]));
    if (r) return r;
  }
  const bare = resolveBook(raw);
  if (bare) return { book: bare, chapter: 1 };
  return null;
}

/** Chapter after / before, crossing book boundaries; null at either end of the canon. */
export function stepChapter(book: number, chapter: number, delta: 1 | -1): { book: number; chapter: number } | null {
  const b = BOOKS[book - 1]!;
  if (delta === 1) {
    if (chapter < b.chapters) return { book, chapter: chapter + 1 };
    return book < 66 ? { book: book + 1, chapter: 1 } : null;
  }
  if (chapter > 1) return { book, chapter: chapter - 1 };
  return book > 1 ? { book: book - 1, chapter: BOOKS[book - 2]!.chapters } : null;
}

export const isNT = (book: number): boolean => book >= 40;
