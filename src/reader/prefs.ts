// Reader preferences: one small JSON value, every access guarded (private windows and blocked
// storage throw or come back empty; the reader must read the same without it).
import type { Mode, Prefs, ThemePref, UiLang } from './types.ts';
import { editionById } from './books.ts';

export const PREFS_KEY = 'yr.prefs.v1';
export const SIZE_STEPS = [0.875, 1, 1.125, 1.25, 1.5] as const;
export const DEFAULT_SIZE = 1;
export const MAX_PARALLEL = 3;

export const defaultPrefs = (): Prefs => ({ edition: {}, mode: 'verse', parallel: [], size: DEFAULT_SIZE, theme: 'auto', recent: [] });

const MODES: readonly Mode[] = ['verse', 'paragraph', 'parallel'];
const THEMES: readonly ThemePref[] = ['auto', 'dark', 'light', 'paper'];

export function sanitizePrefs(raw: unknown): Prefs {
  const p = defaultPrefs();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  if (r.edition && typeof r.edition === 'object') {
    for (const l of ['en', 'zh-Hans', 'zh-Hant'] as UiLang[]) {
      const id = (r.edition as Record<string, unknown>)[l];
      if (typeof id === 'string' && editionById(id)) p.edition[l] = id;
    }
  }
  if (MODES.includes(r.mode as Mode)) p.mode = r.mode as Mode;
  if (Array.isArray(r.parallel)) p.parallel = [...new Set(r.parallel.filter((x): x is string => typeof x === 'string' && !!editionById(x)))].slice(0, MAX_PARALLEL);
  if (typeof r.size === 'number' && SIZE_STEPS.includes(r.size as never)) p.size = r.size;
  if (THEMES.includes(r.theme as ThemePref)) p.theme = r.theme as ThemePref;
  if (Array.isArray(r.recent)) p.recent = r.recent.filter((x): x is string => typeof x === 'string' && /^\d+:\d+$/.test(x)).slice(0, 5);
  return p;
}

export function loadPrefs(storage: Pick<Storage, 'getItem'> | null | undefined): Prefs {
  try {
    const s = storage?.getItem(PREFS_KEY);
    return s ? sanitizePrefs(JSON.parse(s)) : defaultPrefs();
  } catch { return defaultPrefs(); }
}

export function savePrefs(storage: Pick<Storage, 'setItem'> | null | undefined, p: Prefs): boolean {
  try { storage?.setItem(PREFS_KEY, JSON.stringify(p)); return !!storage; } catch { return false; }
}
