// Copy: what the clipboard receives, with the edition's credit line, and how it gets there.
//
// Shape (the owner's brief, plan §2.4, Words' decorateCopy):
//
//   创世记 1:1–3（和合本雅伟版）          <- reference in the EDITION's language, edition name
//   1 起初，神创造天地。                   <- verses with numbers
//   …
//
//   和合本雅伟版 · 和合本，公有领域；神名作雅伟。   <- credit line, in the edition's language
//   （复制以 100 节为限…）                          <- only when the selection was cut
//   — 雅伟之界 · https://…/bible.html#ref=…
//
// Short passages only: a copy carries at most COPY_VERSE_CAP verses (the cap Words puts on licensed text,
// kOnlineCopyVerseCap), and says so when it cut. Parallel copies follow Words' lib/utils/parallel_copy.dart.
import { NAME_ZH } from '../config/site.ts';
import type { EditionInfo, Ref, UiLang } from './types.ts';
import { bookNameIn, formatVerseRange } from './books.ts';
import { canonicalRef } from './route.ts';
import { sanitizeForCopy } from './text.ts';

export const COPY_VERSE_CAP = 100;

// The source line of a copied passage. Russian takes the Latin wordmark, as the store listing and the Russian pages
// do (owner, 2026-11-04: Words keeps the Latin name in ru). The curly apostrophe is deliberate: this is prose.
const SITE: Record<UiLang, string> = { en: 'Yahweh’s World', 'zh-Hans': NAME_ZH.hans, 'zh-Hant': NAME_ZH.hant, ru: 'Yahweh’s World' };
export const DEFAULT_ORIGIN = 'https://world.yahwehword.com';

/** The notice appended when a copy was cut; in the language of the page the reader is on. */
export const CUT_NOTICE: Record<UiLang, (cap: number) => string> = {
  en: (n) => `(Copy is limited to ${n} verses; the rest were left out.)`,
  'zh-Hans': (n) => `（复制以 ${n} 节为限，其余未复制。）`,
  'zh-Hant': (n) => `（複製以 ${n} 節為限，其餘未複製。）`,
  ru: (n) => `(Копирование ограничено ${n} стихами; остальное не скопировано.)`,
};

/** A verse of a passage that may cross chapters: chapter * 1000 + verse. */
export const vkey = (chapter: number, verse: number): number => chapter * 1000 + verse;
export const keyChapter = (k: number): number => Math.floor(k / 1000);
export const keyVerse = (k: number): number => k % 1000;

export interface CopyInput {
  book: number;
  /** Given: `verses` are verse numbers of this chapter. Absent: `verses` are composite keys (vkey), possibly across chapters. */
  chapter?: number;
  verses: readonly number[];
  /** raw text for a verse of the main edition, or null */
  text: (v: number, chapter: number) => string | null;
  edition: EditionInfo;
  ui: UiLang;
  origin?: string;
  linkFor?: (ref: Ref, edition: string) => string;
  cap?: number;
}

export interface CopyResult {
  text: string;
  /** verses actually carried */
  count: number;
  cut: boolean;
  ref: Ref;
}

const paren = (lang: UiLang, s: string): string => (lang === 'zh-Hans' || lang === 'zh-Hant' ? `（${s}）` : ` (${s})`);

export function defaultLink(ref: Ref, edition: string, origin = DEFAULT_ORIGIN): string {
  return `${origin}/bible.html#ref=${encodeURIComponent(canonicalRef(ref))}&ed=${edition}`;
}

/** The credit line of an edition, in its own language. */
export const creditLine = (e: EditionInfo): string => e.credit[e.language];

const toKeys = (chapter: number | undefined, verses: readonly number[]): number[] =>
  [...new Set(verses.map((v) => (chapter == null ? v : vkey(chapter, v))))].sort((a, b) => a - b);

/** "Genesis 1:1–3, 5" within a chapter; "Genesis 15:5–16:2" across chapters. */
export function passageLabel(book: number, keys: readonly number[], lang: UiLang): string {
  const name = bookNameIn(book, lang);
  const first = keys[0]!, last = keys[keys.length - 1]!;
  if (keyChapter(first) === keyChapter(last)) return `${name} ${keyChapter(first)}:${formatVerseRange(keys.map(keyVerse))}`;
  return `${name} ${keyChapter(first)}:${keyVerse(first)}\u2013${keyChapter(last)}:${keyVerse(last)}`;
}

export function heading(book: number, chapter: number | undefined, verses: readonly number[], e: EditionInfo): string {
  return `${passageLabel(book, toKeys(chapter, verses), e.language)}${paren(e.language, e.copyName)}`;
}

function refOf(book: number, keys: readonly number[]): Ref {
  const first = keys[0]!, last = keys[keys.length - 1]!;
  // a link to a passage that crosses chapters points at its first chapter
  const sameChapter = keyChapter(first) === keyChapter(last);
  return { book, chapter: keyChapter(first), v1: keyVerse(first), v2: sameChapter ? keyVerse(last) : undefined };
}

export function buildCopy(i: CopyInput): CopyResult | null {
  const cap = i.cap ?? COPY_VERSE_CAP;
  const all = toKeys(i.chapter, i.verses);
  const picked = all.slice(0, cap);
  const lines: string[] = [];
  const carried: number[] = [];
  const multi = new Set(picked.map(keyChapter)).size > 1;
  for (const k of picked) {
    const t = i.text(keyVerse(k), keyChapter(k));
    if (t == null) continue; // the edition has no such verse: it is not invented
    lines.push(`${multi ? `${keyChapter(k)}:` : ''}${keyVerse(k)} ${sanitizeForCopy(t)}`);
    carried.push(k);
  }
  if (!carried.length) return null;
  const cut = all.length > cap;
  const ref = refOf(i.book, carried);
  const link = (i.linkFor ?? ((r, e) => defaultLink(r, e, i.origin)))(ref, i.edition.id);
  const out = [heading(i.book, undefined, carried, i.edition), ...lines, '', creditLine(i.edition)];
  if (cut) out.push(CUT_NOTICE[i.ui](cap));
  out.push(`— ${SITE[i.ui]} · ${link}`);
  return { text: out.join('\n'), count: carried.length, cut, ref };
}

// ── parallel ──────────────────────────────────────────────────────────────

export interface ParallelCopyEdition { label: string; fullName: string; credit?: string }
export interface ParallelCopyRow { ref: string; texts: (string | null)[] }
export type ParallelLayout = 'compare' | 'byEdition' | 'mainOnly';

/** Display width: CJK and full-width characters count two columns. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const r = ch.codePointAt(0)!;
    const wide = (r >= 0x1100 && r <= 0x115f) || (r >= 0x2e80 && r <= 0xa4cf) || (r >= 0xac00 && r <= 0xd7a3) || (r >= 0xf900 && r <= 0xfaff) || (r >= 0xfe30 && r <= 0xfe4f) || (r >= 0xff00 && r <= 0xff60) || (r >= 0xffe0 && r <= 0xffe6) || (r >= 0x20000 && r <= 0x3fffd);
    w += wide ? 2 : 1;
  }
  return w;
}

function pad(label: string, width: number, cjk: boolean): string {
  const missing = width - displayWidth(label);
  if (cjk) return `${label}${'　'.repeat(Math.floor(missing / 2))}${' '.repeat(missing % 2)}　`;
  return `${label}${' '.repeat(missing)}  `;
}

/** Port of Words' formatParallelCopy (default options): heading, then for each verse its number on its own line
 *  and one labelled line per edition, labels lined up; a missing edition line is left out; credits once at the end. */
export function formatParallelCopy(o: { heading: string; editions: ParallelCopyEdition[]; rows: ParallelCopyRow[]; layout?: ParallelLayout }): string {
  const layout = o.layout ?? 'compare';
  let out = o.heading;
  const shown = layout === 'mainOnly' ? o.editions.slice(0, 1) : o.editions;
  const labels = shown.map((e) => e.label);
  const cjk = labels.some((l) => displayWidth(l) > l.length);
  const lw = labels.reduce((m, l) => Math.max(m, displayWidth(l)), 0);
  if (layout === 'byEdition') {
    shown.forEach((e, i) => {
      const lines = o.rows.filter((r) => (r.texts[i] ?? '') !== '').map((r) => `${r.ref} ${r.texts[i]}`);
      if (!lines.length) return;
      out += `\n\n${e.fullName}\n${lines.join('\n')}`;
    });
  } else {
    for (const r of o.rows) {
      const lines: string[] = [];
      for (let i = 0; i < shown.length && i < r.texts.length; i++) {
        const t = r.texts[i];
        if (t == null || t === '') continue;
        lines.push(`${shown.length === 1 ? '' : pad(labels[i]!, lw, cjk)}${t}`);
      }
      if (!lines.length) continue;
      out += `\n\n${r.ref}\n${lines.join('\n')}`;
    }
  }
  const credits = [...new Set(shown.map((e) => e.credit).filter((c): c is string => !!c))];
  if (credits.length) out += `\n\n${credits.join('\n')}`;
  return out;
}

export interface ParallelCopyInput {
  book: number;
  chapter?: number;
  verses: readonly number[];
  /** set order; the first is the main edition */
  editions: readonly EditionInfo[];
  /** cells[verse] = raw text per edition in set order */
  cell: (v: number, editionIndex: number, chapter: number) => string | null;
  ui: UiLang;
  origin?: string;
  linkFor?: (ref: Ref, edition: string) => string;
  cap?: number;
}

export function buildParallelCopy(i: ParallelCopyInput): CopyResult | null {
  const cap = i.cap ?? COPY_VERSE_CAP;
  const all = toKeys(i.chapter, i.verses);
  const picked = all.slice(0, cap);
  const main = i.editions[0]!;
  const rows: ParallelCopyRow[] = [];
  const carried: number[] = [];
  for (const k of picked) {
    const texts = i.editions.map((_e, e) => { const t = i.cell(keyVerse(k), e, keyChapter(k)); return t == null ? null : sanitizeForCopy(t); });
    if (texts.every((t) => t == null)) continue;
    rows.push({ ref: `${keyChapter(k)}:${keyVerse(k)}`, texts });
    carried.push(k);
  }
  if (!carried.length) return null;
  const cut = all.length > cap;
  const names = i.editions.map((e) => e.narrow);
  const head = passageLabel(i.book, carried, main.language);
  const body = formatParallelCopy({
    heading: head,
    editions: i.editions.map((e, k) => ({ label: names[k]!, fullName: e.menu, credit: creditLine(e) })),
    rows,
  });
  const ref = refOf(i.book, carried);
  const link = (i.linkFor ?? ((r, e) => defaultLink(r, e, i.origin)))(ref, main.id);
  const tail = [cut ? CUT_NOTICE[i.ui](cap) : null, `— ${SITE[i.ui]} · ${link}`].filter(Boolean).join('\n');
  return { text: `${body}\n${tail}`, count: carried.length, cut, ref };
}

// ── clipboard ─────────────────────────────────────────────────────────────

export type CopyOutcome = 'ok' | 'fallback' | 'failed';

/** Copy text to the clipboard and never throw. The async API first; when Safari rejects it (outside a
 *  user-activation window, or without permission), the synchronous legacy path, which works exactly there. */
export async function copyText(text: string, deps: { doc?: Document; nav?: Pick<Navigator, 'clipboard'> } = {}): Promise<CopyOutcome> {
  const nav = deps.nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  try {
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(text); return 'ok'; }
  } catch { /* fall through to the legacy path */ }
  return legacyCopy(text, deps.doc) ? 'fallback' : 'failed';
}

export function legacyCopy(text: string, doc: Document | undefined = typeof document !== 'undefined' ? document : undefined): boolean {
  if (!doc) return false;
  const active = doc.activeElement as HTMLElement | null;
  const ta = doc.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none';
  doc.body.appendChild(ta);
  let ok = false;
  try {
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = doc.execCommand('copy');
  } catch { ok = false; }
  ta.remove();
  try { active?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
  return ok;
}
