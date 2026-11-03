// Vertical (interleaved) parallel reading: the set rules and the row model.
//
// Decisions are the owner's of 2026-10-19 (docs/parallel-mode-plan.md §0), restated for this site:
//   * at most 3 editions;
//   * the first is the main edition (it names the books, the headings and the first line);
//   * first time: the current edition + one of the other language -- a Chinese reader gets
//     BSB (Yahweh); an English reader gets 和合本雅伟版 in the reader's own Chinese script;
//   * one edition is allowed (reads like normal reading);
//   * rows are aligned by verse number, which the six editions share (checked in
//     tests/reader/alignment.test.ts); a verse an edition omits is an em-dash line, never a shift.
import type { BookText, UiLang } from './types.ts';
import { EDITIONS, editionById } from './books.ts';
import { MAX_PARALLEL } from './prefs.ts';

export { MAX_PARALLEL };

/** Valid ids only, no duplicates, main first, at most 3. */
export function normalizeSet(ids: readonly string[], main: string): string[] {
  const out = [main];
  for (const id of ids) if (editionById(id) && !out.includes(id)) out.push(id);
  return out.slice(0, MAX_PARALLEL);
}

/** The first-time pairing for a reader whose main edition is `main`.
 *  `chinese` is the script an English reader gets (from their device, default Simplified). */
export function defaultPairing(main: string, chinese: 'zh-Hans' | 'zh-Hant' = 'zh-Hans'): string[] {
  const lang = editionById(main)?.language ?? 'en';
  if (lang === 'en') return [main, chinese === 'zh-Hant' ? 'cuvs-yhwh-tr' : 'cuvs-yhwh'];
  return [main, 'bsb-yhwh'];
}

/** Which Chinese script an English reader's device prefers (Traditional if a Hant/TW/HK tag comes before any Hans). */
export function chineseScriptOf(deviceLanguages: readonly string[]): 'zh-Hans' | 'zh-Hant' {
  for (const raw of deviceLanguages) {
    const t = raw.toLowerCase();
    if (t === 'zh' || t.startsWith('zh-')) return /hant|tw|hk|mo/.test(t) ? 'zh-Hant' : 'zh-Hans';
  }
  return 'zh-Hans';
}

export interface PickerRow {
  id: string;
  group: UiLang;
  checked: boolean;
  /** why the row cannot be switched on, if it cannot (shown as the reason, not hidden) */
  disabledReason: 'max' | null;
  folded: boolean;
}

/** The rows of the "add an edition" list: grouped by language, the other Chinese script folded away
 *  unless it is in the set or is the interface's script; at the cap, unchecked rows say why. */
export function pickerRows(set: readonly string[], ui: UiLang): PickerRow[] {
  const inSet = new Set(set);
  const full = set.length >= MAX_PARALLEL;
  return EDITIONS.map((e) => {
    const otherScript = (e.language === 'zh-Hans' && ui === 'zh-Hant') || (e.language === 'zh-Hant' && ui !== 'zh-Hant');
    // an English UI shows Simplified; a Hant UI shows Traditional; the other is folded unless in use
    const folded = otherScript && !inSet.has(e.id);
    return { id: e.id, group: e.language, checked: inSet.has(e.id), disabledReason: !inSet.has(e.id) && full ? 'max' as const : null, folded };
  });
}

/** Toggle one edition in the set; the main (first) edition cannot be removed, the cap is honoured. */
export function toggleEdition(set: readonly string[], id: string): string[] {
  if (set.includes(id)) return set.length > 1 && set[0] !== id ? set.filter((x) => x !== id) : [...set];
  return set.length >= MAX_PARALLEL ? [...set] : [...set, id];
}

/** Move an edition up or down in the order; moving row 0 changes the main edition. */
export function moveEdition(set: readonly string[], id: string, dir: -1 | 1): string[] {
  const i = set.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= set.length) return [...set];
  const out = [...set];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export interface ParallelRow {
  v: number;
  /** raw text per edition, in set order; null = the edition has no such verse */
  cells: (string | null)[];
}

/** Rows for a chapter. A verse appears if ANY edition has it; an absent one is null (shown as a dash). */
export function buildRows(texts: readonly (BookText | null)[], chapter: number, v1 = 1, v2 = Infinity): ParallelRow[] {
  const chapters = texts.map((t) => t?.[chapter - 1] ?? null);
  const max = Math.max(0, ...chapters.map((c) => c?.length ?? 0));
  const rows: ParallelRow[] = [];
  for (let v = Math.max(1, v1); v <= Math.min(max, v2); v++) {
    const cells = chapters.map((c) => c?.[v - 1] ?? null);
    if (cells.some((c) => c != null)) rows.push({ v, cells });
  }
  return rows;
}
