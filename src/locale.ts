import { nameZh, productName } from './config/site.ts';

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
export type Locale = 'en' | 'zh-Hans' | 'zh-Hant' | 'ru';
// Russian was added for the gallery surface (owner, 2026-11-03). It is a fourth READING, not a third branch of
// the old two-way test: `locale()` still answers 'en' or 'zh', and a Russian reader gets 'en' from it, so every
// older page that branches on it keeps working and shows English. Code that knows Russian asks `fullLocale()`
// and writes its strings with the optional third argument of `t()` / a `data-ru` attribute.

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
    if (tag === 'ru' || tag.startsWith('ru-')) return 'ru';
  }
  return 'en';
}

/** A BCP-47 tag as this site reads it. Deliberately as lenient as the reader module's own matchUiTag(): the two
 *  used to disagree, and a link carrying `#lang=zh-TW` (or `zh_Hant`, or `ru-RU`) then switched the Bible text to
 *  繁體 / Russian while the chrome, the title and the captions around it stayed in English (P1-3). One acceptance
 *  rule, one answer. */
export function localeFromTag(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const parts = tag.replace(/_/g, '-').split('-');
  const l = parts[0]!.toLowerCase();
  if (l === 'en') return 'en';
  if (l === 'ru') return 'ru';
  if (l !== 'zh') return null;
  let script: string | undefined, region: string | undefined;
  for (const p of parts.slice(1)) {
    if (p.length === 4) script = p.toLowerCase();
    else if (p.length === 2 || p.length === 3) region = p.toUpperCase();
  }
  if (script === 'hant') return 'zh-Hant';
  if (script === 'hans') return 'zh-Hans';
  if (region === 'TW' || region === 'HK' || region === 'MO') return 'zh-Hant';
  return 'zh-Hans';
}

/** The language a link carries: `#lang=` anywhere in the hash, in any spelling the reader module accepts. */
export const langFromHash = (hash: string): Locale | null => {
  try { return localeFromTag(new URLSearchParams(hash.replace(/^#/, '')).get('lang')); } catch { return null; }
};

function initial(): Locale {
  // A shared link can carry its language (#lang=ru): it wins for this visit and is not saved.
  try {
    const l = langFromHash(location.hash);
    if (l) return l;
  } catch { /* no location (never in a browser) */ }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh-Hans' || saved === 'zh-Hant' || saved === 'ru') return saved;
    // Written by the two-language version of this site.
    if (saved === 'zh') return 'zh-Hans';
  } catch { /* private mode, blocked storage — fall through */ }
  return fromSystem();
}

let current: Locale = initial();
const listeners = new Set<(l: Lang) => void>();

const langOf = (l: Locale): Lang => (l === 'en' || l === 'ru' ? 'en' : 'zh');

export const locale = (): Lang => langOf(current);
export const fullLocale = (): Locale => current;

/** The BCP-47 tag for <html lang>, which CSS and screen readers both read. */
const htmlLang = (l: Locale): string =>
  l === 'en' ? 'en' : l === 'ru' ? 'ru' : l === 'zh-Hant' ? 'zh-Hant' : 'zh-Hans';

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

/** The CHINESE spelling of the name for this reader — Simplified only while reading 简体 — for a string that is Chinese
 *  anyway. It is not the name an English or Russian page shows; `brand()` below is. (Two spellings: config/site.ts.) */
export const brandZh = (): string => nameZh(htmlLang(current));

/** THE PRODUCT NAME IN THIS READER'S LANGUAGE: the Chinese spelling on a Chinese page, the Latin "Yahweh's World" on an
 *  English or a Russian one. Everything a reader sees the name in goes through this one function — the bar, a <title>,
 *  the hero, the install note, a sheet — so a page's title and the bar above it cannot disagree (P1-2) and no reader
 *  meets the name in a script they do not read (owner, 2026-11-04). The bar's own copy of it is in the markup, in all
 *  four readings, so that it is also right before this module exists (scripts/lib/product-name.mjs). */
export const brand = (): string => productName(htmlLang(current));

/** Puts the Chinese name inside an authored Chinese string into this reader's spelling (a <title> is authored once). */
const withBrand = (s: string): string => s.replace(/雅[伟偉]之界/g, brandZh());

/** Picks the reading, and puts Chinese into the reader's script. */
export const t = <T>(en: T, zh: T, ru?: T): T => {
  if (current === 'en') return en;
  if (current === 'ru') return ru ?? en;
  return (typeof zh === 'string' ? hant(zh) as unknown as T : zh);
};

/** `save` false for a language that came from a link rather than from the reader pressing something: it holds for
 *  this visit and does not overwrite what they chose last time. */
export async function setLocale(l: Locale, save = true) {
  if (l === current) return;
  current = l;
  if (save) { try { localStorage.setItem(KEY, l); } catch { /* nothing to do */ } }
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
export function bindSwitch(root: HTMLElement | null) {
  document.documentElement.lang = htmlLang(current);
  // The gallery surface has a globe menu instead (src/gallery/lang.ts); its pages still call this for the <html lang>.
  if (!root) return;
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
  // A page may write its <title> four ways, like any other string: <title data-en data-zh data-ru>. The generic
  // [data-en] pass below then sets it, so the tab, history and anything that unfurls the title all carry ONE
  // language instead of the bilingual "Bible · Yahweh's World | 圣经 · 雅偉之界" — which also put 圣经 (简体) next
  // to 雅偉之界 (繁體) in one string (P1-2). A page with a plain <title> keeps the old behaviour.
  if (root === document && authoredTitle && !document.querySelector('title[data-en]')) document.title = withBrand(hant(authoredTitle));
  const small = narrow?.matches ?? false;
  root.querySelectorAll<HTMLElement>('[data-en]').forEach((el) => {
    const en = (small && el.dataset.enNarrow) || el.dataset.en || '';
    const zh = (small && el.dataset.zhNarrow) || el.dataset.zh || en;
    const ru = el.dataset.ru || en;
    // A canvas has no text: its words are its accessible name (its children would be read as well).
    if (el instanceof HTMLCanvasElement) el.setAttribute('aria-label', t(en, zh, ru));
    else el.textContent = t(en, zh, ru);
  });
  // The accessible name of a landmark or group, in the reader's language (data-aria-en / -zh / -ru). The root counts too:
  // the gallery applies a nav to itself.
  const named = [...(root instanceof Element && root.matches('[data-aria-en]') ? [root as HTMLElement] : []), ...Array.from(root.querySelectorAll<HTMLElement>('[data-aria-en]'))];
  named.forEach((el) => el.setAttribute('aria-label', t(el.dataset.ariaEn || '', el.dataset.ariaZh || el.dataset.ariaEn || '', el.dataset.ariaRu || el.dataset.ariaEn || '')));
  // THE WORDMARK. The lockup in the markup carries all four readings and html[lang] shows one of them in CSS
  // (scripts/lib/product-name.mjs, the .tri rules inline in every head), so the name is right in the FIRST paint and
  // nothing here may touch it — writing it from a module is what gave an English reader a frame of the Chinese name.
  // A page written before the lockup existed carries a bare [data-brand] with no readings; that one still gets the
  // name for this language written in, which is `brand()` — the Latin wordmark on an English or Russian page.
  root.querySelectorAll<HTMLElement>('[data-brand]').forEach((el) => {
    if (!el.firstElementChild) el.textContent = brand();
  });
  // Chinese written straight into an element rather than paired with an English original.
  root.querySelectorAll<HTMLElement>('[data-zh-text]').forEach((el) => {
    el.textContent = withBrand(hant(el.dataset.zhText ?? ''));
  });
}

// A `#lang=` that arrives AFTER the page is up — a shared link pasted into the address bar of an open tab, a
// reader link from another page, Back onto an entry whose hash carried one — used to reach only whatever module
// parsed the hash for itself. On the Bible page that was the reader: the verses changed language and the bar, the
// title, the captions and the footer did not. The language of a page is one thing, so it is read in one place.
if (typeof window !== 'undefined') {
  const follow = () => {
    const l = langFromHash(location.hash);
    if (l && l !== current) void setLocale(l, false);
  };
  window.addEventListener('hashchange', follow);
  window.addEventListener('popstate', follow);
}

// Crossing the threshold — rotating a tablet does it — has to re-render, or
// the bar keeps the labels it was built with.
narrow?.addEventListener('change', () => {
  applyStatic();
  for (const fn of listeners) fn(langOf(current));
});
