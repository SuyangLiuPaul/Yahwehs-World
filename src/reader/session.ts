// The state a reader and the passages beside it share: preferences, the interface language, the data store.
// One Session per page (the default is shared); a host that wants isolation passes its own.
import { BOOKS, defaultEditionFor, editionById, editionOrDefault, resolveUi } from './books.ts';
import { chineseScriptOf, defaultPairing, normalizeSet } from './parallel.ts';
import { loadPrefs, savePrefs, SIZE_STEPS } from './prefs.ts';
import { DataStore } from './store.ts';
import type { StringKey, StringOverrides } from './strings.ts';
import { t } from './strings.ts';
import type { EditionInfo, Mode, Prefs, Ref, ThemePref, UiLang } from './types.ts';
import { UI_LANG_INFO } from './types.ts';
import type { RouteState } from './route.ts';

export interface ReaderOptions {
  /** Interface language; default: the stored site locale, else the device's. */
  locale?: UiLang;
  /** Where the generated data lives (default `/data/reader`). */
  dataBase?: string;
  /** `hash`: the chapter reader owns #ref=… and history. `none`: the host does (passages always use none). */
  route?: 'hash' | 'none';
  /** Origin used in copied links. */
  origin?: string;
  linkFor?: (ref: Ref, edition: string) => string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  fetch?: typeof fetch;
  /** Skip Cache Storage (tests). */
  persistData?: boolean;
  /** Direction of the chrome; follows the language table, overridable for RTL readiness tests. */
  dir?: 'ltr' | 'rtl';
  /** Word overrides (RTL fixture, a host's own wording). */
  strings?: StringOverrides;
  /** Shared state; omit for the page-wide default. */
  session?: Session;
  /** The element that scrolls (default: the document). */
  scroller?: HTMLElement | null;
  /** Called after the chapter changes. */
  onNavigate?: (ref: Ref) => void;
  /** Called when the reader wants to open a chapter itself (passage: "read the whole chapter"). */
  onOpenChapter?: (ref: Ref) => void;
  onCopy?: (info: { text: string; count: number; cut: boolean; outcome: 'ok' | 'fallback' | 'failed' }) => void;
}

export type ChangeKind = 'locale' | 'edition' | 'mode' | 'parallel' | 'size' | 'theme';

const LOCALE_KEY = 'ydh.locale';

function storageOf(o: ReaderOptions): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (o.storage !== undefined) return o.storage;
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function initialLocale(o: ReaderOptions, storage: Pick<Storage, 'getItem'> | null): UiLang {
  if (o.locale) return o.locale;
  let saved: string | null = null;
  try { saved = storage?.getItem(LOCALE_KEY) ?? null; } catch { /* blocked */ }
  const device = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language ?? '']) : [];
  return resolveUi(saved === 'zh' ? 'zh-Hans' : saved, device);
}

export class Session {
  ui: UiLang;
  prefs: Prefs;
  store: DataStore;
  opts: ReaderOptions;
  private storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  private listeners = new Set<(k: ChangeKind) => void>();
  private toasts = new Set<(msg: string, kind: 'ok' | 'warn') => void>();
  /** device Chinese script, for an English reader's first pairing */
  chinese: 'zh-Hans' | 'zh-Hant';

  constructor(opts: ReaderOptions = {}) {
    this.opts = opts;
    this.storage = storageOf(opts);
    this.ui = initialLocale(opts, this.storage);
    this.prefs = loadPrefs(this.storage);
    this.store = new DataStore({ base: opts.dataBase, fetch: opts.fetch, persist: opts.persistData });
    this.chinese = chineseScriptOf(typeof navigator !== 'undefined' ? navigator.languages ?? [] : []);
  }

  // ── reading the state ────────────────────────────────────────────────

  get dir(): 'ltr' | 'rtl' { return this.opts.dir ?? UI_LANG_INFO[this.ui].dir; }
  /** The one-edition choice for the current interface language. */
  single(): EditionInfo { return editionOrDefault(this.prefs.edition[this.ui], this.ui); }
  mode(): Mode { return this.prefs.mode; }
  /** Editions on screen, main first. More than one only in parallel mode. */
  set(): EditionInfo[] {
    if (this.prefs.mode !== 'parallel') return [this.single()];
    const base = this.prefs.parallel.length ? this.prefs.parallel : defaultPairing(this.single().id, this.chinese);
    return normalizeSet(base.slice(1), base[0]!).map((id) => editionById(id)!);
  }
  main(): EditionInfo { return this.set()[0]!; }
  tr(key: StringKey, vars?: Record<string, string | number>): string { return t(key, this.ui, vars, this.opts.strings); }

  // ── changing it ──────────────────────────────────────────────────────

  onChange(fn: (k: ChangeKind) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  onToast(fn: (msg: string, kind: 'ok' | 'warn') => void): () => void { this.toasts.add(fn); return () => this.toasts.delete(fn); }
  toast(msg: string, kind: 'ok' | 'warn' = 'ok'): void { for (const f of this.toasts) f(msg, kind); }
  private emit(k: ChangeKind, save = true): void { if (save) savePrefs(this.storage, this.prefs); for (const f of [...this.listeners]) f(k); }

  setLocale(l: UiLang, persist = false): void {
    if (l === this.ui) return;
    this.ui = l;
    if (persist) { try { this.storage?.setItem(LOCALE_KEY, l); } catch { /* blocked */ } }
    // the edition follows the language only when the reader has not chosen one for it (single() does exactly that)
    this.emit('locale', false);
  }

  setEdition(id: string): void {
    if (!editionById(id)) return;
    if (this.prefs.mode === 'parallel') {
      const set = this.set().map((e) => e.id);
      this.prefs.parallel = normalizeSet(set.slice(1), id);
    }
    this.prefs.edition[this.ui] = id;
    this.emit('edition');
  }

  setMode(m: Mode): void {
    if (m === this.prefs.mode) return;
    if (m === 'parallel' && this.prefs.parallel.length < 2) this.prefs.parallel = defaultPairing(this.single().id, this.chinese);
    this.prefs.mode = m;
    this.emit('mode');
  }

  setParallel(ids: readonly string[]): void {
    const set = normalizeSet(ids.slice(1), ids[0] ?? this.single().id);
    this.prefs.parallel = set;
    this.prefs.edition[this.ui] = set[0]!;
    this.emit('parallel');
  }

  setSize(size: number): void {
    if (!SIZE_STEPS.includes(size as never)) return;
    this.prefs.size = size;
    this.emit('size');
  }

  setTheme(theme: ThemePref): void { this.prefs.theme = theme; this.emit('theme'); }

  remember(book: number, chapter: number): void {
    const key = `${book}:${chapter}`;
    this.prefs.recent = [key, ...this.prefs.recent.filter((x) => x !== key)].slice(0, 5);
    savePrefs(this.storage, this.prefs);
  }

  /** A shared link's #lang / #ed / #par / #m: applied for this visit, saved only once the reader changes something. */
  applyLink(s: RouteState): void {
    if (s.lang) { this.ui = s.lang; }
    if (s.ed) this.prefs.edition[this.ui] = s.ed;
    if (s.par && s.par.length) { this.prefs.parallel = normalizeSet(s.par.slice(1), s.par[0]!); this.prefs.edition[this.ui] = this.prefs.parallel[0]!; }
    if (s.mode) this.prefs.mode = s.mode;
    if (s.mode === 'parallel' && this.prefs.parallel.length < 2) this.prefs.parallel = defaultPairing(this.single().id, this.chinese);
  }

  recentRefs(): { book: number; chapter: number }[] {
    return this.prefs.recent.map((r) => { const [b, c] = r.split(':').map(Number); return { book: b!, chapter: c! }; }).filter((r) => r.book >= 1 && r.book <= 66 && BOOKS[r.book - 1] && r.chapter >= 1);
  }
}

let shared: Session | null = null;
export function sessionFor(o: ReaderOptions): Session {
  if (o.session) return o.session;
  return (shared ??= new Session(o));
}
/** For tests and hosts that remount from scratch. */
export function resetSharedSession(): void { shared = null; }

export { defaultEditionFor };
