// What the gallery's own pages (the home page) need to know about the Bible editions WITHOUT loading the reader:
// a name for the chip, the licence word, and which edition a reading starts with. Everything else (the sheet, the
// licence texts, the credit lines, the data) is the reader module's catalogue, loaded on demand.
//
// Owner, 2026-11-03: only the editions we hold the rights to, the same ids and bytes as Yahweh's Words and Yahweh's
// Sword: bsb-yhwh, kjv, web-yhwh, asv-yhwh, cuvs-yhwh, cuvs-yhwh-tr, and for the Russian reader rst-yhwh and rst.
//
// This table is a copy of three fields of src/reader/catalogue.gen.ts (itself generated from Words); tests/gallery/
// editions-brief.test.ts fails when the two differ, so there is one source of truth and this is only its cheap shadow.
import { fullLocale } from '../locale.ts';

/** `lic`: PD public domain, CC0, © the church's own edition, used with permission (Words' record). */
export interface Brief { id: string; label: string; lic: 'PD' | 'CC0' | '©' }

export const BRIEFS: readonly Brief[] = [
  { id: 'bsb-yhwh', label: 'BSB (Yahweh)', lic: 'CC0' },
  { id: 'kjv', label: 'KJV', lic: 'PD' },
  { id: 'web-yhwh', label: 'WEB', lic: 'PD' },
  { id: 'asv-yhwh', label: 'ASV (Yahweh)', lic: 'PD' },
  { id: 'cuvs-yhwh', label: '和合本雅伟版', lic: '©' },
  { id: 'cuvs-yhwh-tr', label: '和合本雅偉版', lic: '©' },
  { id: 'rst-yhwh', label: 'СП (Яхве)', lic: 'PD' },
  { id: 'rst', label: 'СП', lic: 'PD' },
];
/** The edition a reading starts with when the reader has not chosen one. */
export const DEFAULTS = { en: 'bsb-yhwh', 'zh-Hans': 'cuvs-yhwh', 'zh-Hant': 'cuvs-yhwh-tr', ru: 'rst-yhwh' } as const;

export const briefOf = (id: string) => BRIEFS.find((b) => b.id === id);
export const defaultFor = (l = fullLocale()) => DEFAULTS[l];

/** The reader's remembered choices: the same record the reader module keeps ('yr.prefs.v1'), read without loading it. */
export interface Choice { id: string; parallel: number }
export function choice(l = fullLocale()): Choice {
  try {
    const p = JSON.parse(localStorage.getItem('yr.prefs.v1') ?? '{}') as { edition?: Record<string, string>; mode?: string; parallel?: string[] };
    const id = p.edition?.[l];
    const par = p.mode === 'parallel' && Array.isArray(p.parallel) && p.parallel.length > 1 ? p.parallel.length : 0;
    return { id: id && briefOf(id) ? id : defaultFor(l), parallel: par };
  } catch { return { id: defaultFor(l), parallel: 0 }; }
}
