// One locale for the whole site, remembered between visits.
//
// Three readings: English, 简体, 繁體. The reader's system decides which one
// opens — a visitor whose phone is in Chinese should not have to find a
// switch to read Chinese — and anything that is not one of the three falls
// back to English, which is the language most visitors can read.
//
// 简体 and 繁體 are the SAME language to every branch in this codebase: the
// text is identical, only the characters differ. So `locale()` still answers
// 'zh' or 'en', every existing `locale === 'zh'` test goes on working, and
// the script is applied underneath — by `t()` for authored strings, by
// `hant()` for strings that come out of the data. Making the script a third
// value of the branching type would have meant auditing every one of those
// tests for a distinction none of them cares about.

/** What code branches on: which language is being read. */
export type Lang = 'en' | 'zh';
/** What the reader actually chose, script included. */
export type Locale = 'en' | 'zh-Hans' | 'zh-Hant';

const KEY = 'ydh.locale';

/** The reader's system languages, in their order of preference, mapped onto
 *  what this site has. `zh` with no region is Simplified: it is what a bare
 *  "Chinese" preference means on the overwhelming majority of devices, and
 *  the gazetteer's own names are Simplified-first. */
function fromSystem(): Locale {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];
  for (const raw of tags) {
    const tag = raw.toLowerCase();
    if (tag === 'zh' || tag.startsWith('zh-')) {
      if (/hant|tw|hk|mo/.test(tag)) return 'zh-Hant';
      return 'zh-Hans';
    }
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
  }
  return 'en';
}

function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh-Hans' || saved === 'zh-Hant') return saved;
    // Written by the two-language version of this site.
    if (saved === 'zh') return 'zh-Hans';
  } catch { /* private mode, blocked storage — fall through */ }
  return fromSystem();
}

let current: Locale = initial();
const listeners = new Set<(l: Lang) => void>();

const langOf = (l: Locale): Lang => (l === 'en' ? 'en' : 'zh');

export const locale = (): Lang => langOf(current);
export const fullLocale = (): Locale => current;

/** The BCP-47 tag for <html lang>, which CSS and screen readers both read. */
const htmlLang = (l: Locale): string =>
  l === 'en' ? 'en' : l === 'zh-Hant' ? 'zh-Hant' : 'zh-Hans';

// ── 繁體 ──────────────────────────────────────────────────────────────────
// public/data/zh-hant.json, built by scripts/build-zh-hant.mjs: place names
// as the traditional CUV gazetteer gives them, everything else converted by
// OpenCC at build time, where it can resolve 后/後 and 里/裡 by phrase. Only
// a reader in 繁體 ever downloads it.
let table: { phrases: Record<string, string>; chars: Record<string, string> } | null = null;
let loading: Promise<void> | null = null;

export function ensureScript(): Promise<void> {
  if (current !== 'zh-Hant' || table) return Promise.resolve();
  loading ??= fetch(`${import.meta.env.BASE_URL}data/zh-hant.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((t) => { table = t; })
    // A reader in 繁體 who cannot reach the table sees 简体 rather than a
    // blank page. It is the same text; the characters are the wrong ones.
    .catch(() => { table = null; });
  return loading;
}

// A reader who arrives already in 繁體 starts rendering before the table can
// possibly have loaded. Its arrival changes every Chinese string on screen,
// which is the same event as a locale change from the page's point of view —
// so it is announced as one, and every page's existing re-render handler
// picks it up without knowing this mechanism exists.
if (current === 'zh-Hant') {
  void ensureScript().then(() => {
    if (table) for (const fn of listeners) fn('zh');
  });
}

/** Every run of Chinese characters and Chinese punctuation, so a string that
 *  mixes Chinese with markup, digits or English is converted a phrase at a
 *  time rather than as one blob that matches nothing. */
const CJK_RUN = /[　-〿一-鿿！-･]+/g;

/** Simplified in, what this reader should see out. Identity unless they are
 *  reading 繁體 and the table has arrived.
 *
 *  Phrases first, characters only as a last resort, and in that order for a
 *  reason: 里 is 裡 in 里面 and stays 里 in 公里, and no character table can
 *  know which. scripts/build-zh-hant.mjs therefore collects every Chinese
 *  string this codebase contains so that the phrase lookup is what normally
 *  answers; the character map exists for strings composed at runtime that no
 *  static scan could have seen. */
export function hant(s: string): string {
  if (current !== 'zh-Hant' || !table || !s) return s;
  const whole = table.phrases[s];
  if (whole !== undefined) return whole;
  return s.replace(CJK_RUN, (run) => {
    const phrase = table!.phrases[run];
    if (phrase !== undefined) return phrase;
    let out = '';
    for (const ch of run) out += table!.chars[ch] ?? ch;
    return out;
  });
}

/** Picks the reading, and puts Chinese into the reader's script. */
export const t = <T>(en: T, zh: T): T => {
  if (current === 'en') return en;
  return (typeof zh === 'string' ? hant(zh) as unknown as T : zh);
};

export async function setLocale(l: Locale) {
  if (l === current) return;
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* nothing to do */ }
  document.documentElement.lang = htmlLang(l);
  // The table has to be in hand before anything re-renders, or the first
  // paint after the switch is the wrong script.
  await ensureScript();
  for (const fn of listeners) fn(langOf(l));
}

export const onLocale = (fn: (l: Lang) => void) => { listeners.add(fn); };

/** Wires the language control: one button per reading, the current one
 *  pressed. A cycling toggle would have been smaller, but with three
 *  readings it hides two of them behind a state the reader has to discover
 *  by pressing — and 繁體 is exactly the one a 简体 reader would never think
 *  to look for. */
export function bindSwitch(root: HTMLElement) {
  document.documentElement.lang = htmlLang(current);
  const mark = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.locale === current));
    });
  };
  mark();
  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-locale]');
    if (!btn) return;
    void setLocale(btn.dataset.locale as Locale).then(mark);
  });
  onLocale(mark);
}

/** Wraps a `{ key: { zh, en } }` string table so that reading `.zh` gives
 *  the reader's script. The conversion is lazy — a getter, and a wrapper
 *  around the entries that are functions of their arguments — because the
 *  table arrives after the first read and because switching back to 简体
 *  has to produce 简体 again, which converting the strings in place could
 *  not do. Call sites go on writing `T.stop[locale](n)`. */
export function localized<T extends Record<string, { zh: unknown; en: unknown }>>(defs: T): T {
  const out: Record<string, { zh: unknown; en: unknown }> = {};
  for (const [key, entry] of Object.entries(defs)) {
    out[key] = {
      en: entry.en,
      get zh() {
        const zh = entry.zh;
        if (typeof zh === 'string') return hant(zh);
        if (typeof zh === 'function') {
          return (...args: unknown[]) => hant(String((zh as (...a: unknown[]) => unknown)(...args)));
        }
        return zh;
      },
    };
  }
  return out as T;
}

// The tab title is Chinese too, and it is the one piece of the page that is
// read outside it — in the tab strip, in history, in a bookmark. Captured
// once as authored, so re-applying never converts an already-converted one.
const authoredTitle = typeof document !== 'undefined' ? document.title : '';

/** A phone is not a small desktop: the nav there carries the wordmark, three
 *  tabs, the settings button and three language buttons, and 照着经文的尺寸
 *  does not fit beside all of that. An element may offer a shorter reading
 *  for that width in data-en-narrow / data-zh-narrow; it is used only there,
 *  and only if it was written. */
const narrow = typeof matchMedia === 'function'
  ? matchMedia('(max-width: 480px)')
  : null;

/** Applies [data-en]/[data-zh] pairs anywhere in the document. */
export function applyStatic(root: ParentNode = document) {
  if (root === document && authoredTitle) document.title = hant(authoredTitle);
  const small = narrow?.matches ?? false;
  root.querySelectorAll<HTMLElement>('[data-en]').forEach((el) => {
    const en = (small && el.dataset.enNarrow) || el.dataset.en || '';
    const zh = (small && el.dataset.zhNarrow) || el.dataset.zh || en;
    el.textContent = t(en, zh);
  });
  // Chinese written straight into an element — the wordmark — rather than
  // paired with an English original.
  root.querySelectorAll<HTMLElement>('[data-zh-text]').forEach((el) => {
    el.textContent = hant(el.dataset.zhText ?? '');
  });
}

// Crossing the threshold — rotating a tablet does it — has to re-render, or
// the bar keeps the labels it was built with.
narrow?.addEventListener('change', () => {
  applyStatic();
  for (const fn of listeners) fn(langOf(current));
});
