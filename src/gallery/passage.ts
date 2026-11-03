// The passage under a picture: the verses an event covers, in the reader's edition, with the heading they sit under.
//
// INTEGRATION POINT (the reader work in the other worktree: editions, copy, headings, vertical parallel).
// This file is the whole seam between the picture page and Bible text. The page calls `loadPassage()` and
// `copyText()`; both go through a PassageProvider. The default provider below reads the data this repo already
// ships (split text files, the Words-derived headings in book/<n>.json). To swap in the shared reader core:
//
//     import { setPassageProvider } from './passage.ts';
//     setPassageProvider({ load, copyText, parallel });   // same shape as PassageProvider
//
// `parallel` is optional: while it is absent the picture page shows no 对照 control. Nothing outside this file
// and editions.ts knows how verses are fetched, numbered, headed or copied.
import { t } from '../locale.ts';
import { chapterOf, refText, verseOf, type Scene } from './data.ts';
import { word, type Edition } from './editions.ts';

export interface Verse { key: number; ch: number; n: number; text: string }
export interface Heading { key: number; text: string }
export interface Passage { edition: Edition; verses: Verse[]; headings: Heading[]; scene: Scene }

export interface PassageProvider {
  /** The verses of scene.s..scene.e in this edition (missing verses are left out of `verses`, never invented). */
  load(scene: Scene, edition: Edition): Promise<Passage>;
  /** The text for the clipboard: the chosen verses with their citation (and a licence line where the edition needs one). */
  copyText(p: Passage, keys: readonly number[]): string;
  /** Interleaves up to three editions verse by verse. Absent until the vertical-parallel work lands. */
  parallel?(scene: Scene, editions: readonly Edition[]): Promise<Passage[]>;
}

const SPLIT = '/data/bible/split';
type Book = { words?: Record<string, { titleHans?: string; titleHant?: string; titleEn?: string }> };
const textCache = new Map<string, Promise<string[][]>>();
const bookCache = new Map<number, Promise<Book>>();
function fetchJson<T>(url: string, cache: Map<string | number, Promise<T>>, k: string | number): Promise<T> {
  let p = cache.get(k);
  if (!p) {
    p = fetch(url).then((r) => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json() as Promise<T>; });
    p.catch(() => cache.delete(k)); // a failed fetch is retried, not remembered
    cache.set(k, p);
  }
  return p;
}
const textOf = (ed: Edition, b: number) =>
  fetchJson<string[][]>(ed.legacyDir ? `${SPLIT}/text/${ed.legacyDir}/${b}.json` : `/data/bible/${ed.id}/${b}.json`, textCache as Map<string | number, Promise<string[][]>>, `${ed.id}/${b}`);
const bookOf = (b: number) => fetchJson<Book>(`${SPLIT}/book/${b}.json`, bookCache as Map<string | number, Promise<Book>>, b);

/** The shipped text carries markup the reader turns into footnote badges and "supplied word" tags (<H0>, <G0>, <note: …>).
 *  A passage under a picture is plain reading text, so the tags go; the bracketed referent marks (主[雅伟], Lord [Yahweh]) stay,
 *  exactly as the edition prints them. */
const clean = (s: string | null | undefined) => (s ?? '').replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ').trim();

const defaultProvider: PassageProvider = {
  async load(scene, edition) {
    const [text, book] = await Promise.all([textOf(edition, scene.b), bookOf(scene.b).catch((): Book => ({}))]);
    const verses: Verse[] = [];
    for (let ch = chapterOf(scene.s); ch <= chapterOf(scene.e); ch++) {
      const rows = text[ch - 1] ?? [];
      const from = ch === chapterOf(scene.s) ? verseOf(scene.s) : 1;
      const to = ch === chapterOf(scene.e) ? verseOf(scene.e) : rows.length;
      for (let n = from; n <= Math.min(to, rows.length); n++) {
        const s = clean(rows[n - 1]);
        if (s) verses.push({ key: scene.b * 1_000_000 + ch * 1000 + n, ch, n, text: s });
      }
    }
    // The heading the event starts under (the Words-derived titles in book/<n>.json), in the edition's own script.
    const w = book.words?.[String(scene.s)];
    const hd = w && (edition.group === 'zh-Hans' ? w.titleHans : edition.group === 'zh-Hant' ? w.titleHant : edition.group === 'en' ? w.titleEn : '');
    const headings: Heading[] = hd ? [{ key: scene.s, text: hd }] : [];
    return { edition, verses, headings, scene };
  },
  copyText(p, keys) {
    const picked = p.verses.filter((v) => keys.includes(v.key));
    if (!picked.length) return '';
    const first = picked[0]!, last = picked[picked.length - 1]!;
    const lang = p.edition.group === 'ru' ? 'ru' : p.edition.group === 'en' ? 'en' : 'zh';
    const cite = refText({ b: p.scene.b, s: first.key, e: last.key }, lang);
    // "BSB (Yahweh)" -> "BSB, Yahweh", so the citation's own parentheses are the only ones
    const name = word(p.edition.name).replace(/\s*[(（]([^)）]*)[)）]/, ', $1');
    const body = picked.map((v) => `${v.n} ${v.text}`).join('\n');
    const open = lang === 'zh' ? '（' : ' (', shut = lang === 'zh' ? '）' : ')';
    return `${cite}${open}${name}${shut}\n${body}\n\n— ${t("Yahweh's World", '雅伟之界', 'Мир Яхве')} · world.yahwehword.com/p/${p.scene.id}`;
  },
};

let provider: PassageProvider = defaultProvider;
export function setPassageProvider(p: PassageProvider) { provider = p; }
export const hasParallel = () => typeof provider.parallel === 'function';
export const loadPassage = (scene: Scene, edition: Edition) => provider.load(scene, edition);
export const copyText = (p: Passage, keys: readonly number[]) => provider.copyText(p, keys);
export const parallel = (scene: Scene, editions: readonly Edition[]) => provider.parallel!(scene, editions);


