// The one place the shell-visible constants live. Plain TypeScript with no `import.meta` and no DOM, so the node tests, the
// build scripts (scripts/shell-dist.mjs reads it) and the browser all import the same file.
//
//   SITE_HOST   where the site, the full-size pictures and the feedback function are served from. The native shells bundle the
//               thumbnails and the Bible data and fetch every full picture from here; changing the host is a one-line edit in this
//               file, and `npm run verify:shell` fails if src-tauri/tauri.conf.json (the CSP) or docs disagree with it.
//   channel     how a build reaches a reader: 'web' (the site), 'store' (App Store, TestFlight, Play, Microsoft Store: the store
//               updates it, the app never offers a download), 'direct' (GitHub releases, notarised DMG, Windows installer: the app
//               may point at the release page).
export const SITE_HOST = 'https://world.yahwehword.com';

/** The names a reader sees.
 *
 *  Named like Words (owner, 2026-11-04). Three kinds of name, and they are not the same string:
 *
 *    wordmark   The Latin name, never shortened: "Yahweh's World". The bar's second line, running English prose.
 *    short      The LABEL under the icon, per language. A launcher gives a label about eleven characters before it
 *               truncates, and "Yahweh's World" came back as "Yahweh's W…" on a home screen; Words solved this years
 *               ago by shipping a short label per language, so this does the same. Russian is 'Мир' for the same
 *               reason. These also go in each manifest's short_name and in apple-mobile-web-app-title.
 *    store      The TITLE in a store, per store locale. Russian keeps the Latin name, as Words's Russian listing does.
 *
 *  The combined "雅偉之界 / Yahweh's World" is gone from everything a reader sees. It was written for a bilingual
 *  audience that no page actually has — every page knows its language — and at 20 characters it was the string that
 *  pushed every title, every og:site_name and every installer name over the length its field allows.
 *
 *  THE NAME FOLLOWS THE LANGUAGE (owner, 2026-11-04, on the TestFlight build 3). The wordmark in the bar used to be
 *  the Chinese name on every page: an English reader and a Russian reader both met 雅偉之界 above the word "Home" /
 *  "Главная" and had no way to read the name of the thing they were using. The rule is Words's rule, and it is
 *  `productName` below:
 *
 *      en       Yahweh's World        zh-Hans  雅伟之界
 *      ru       Yahweh's World        zh-Hant  雅偉之界
 *
 *  Russian keeps the Latin name, exactly as Words's Russian build keeps "Yahweh's Words"; the SHORT icon label is the
 *  one Russian string, 'Мир', because a launcher has eleven characters and no room for prose.
 *
 *  The two Chinese spellings live in NAME_ZH below and the 简体 spelling is used only while the page language is
 *  zh-Hans — the 2026-11-03 "Traditional wherever it is a name" ruling, narrowed by the 2026-11-04 naming decision. */
export const PRODUCT = {
  /** The Latin wordmark. Never shortened, never translated. */
  wordmark: "Yahweh's World",
  /** The label under the icon / in a launcher, by language. */
  en: 'World',
  zhHans: '雅伟之界',
  zhHant: '雅偉之界',
  ru: 'Мир',
  /** The title a store lists, by store locale. */
  store: {
    'en-US': "Yahweh's World",
    'zh-Hans': '雅伟之界',
    'zh-Hant': '雅偉之界',
    ru: "Yahweh's World",
  },
} as const;

/** THE NAME A PAGE OF THIS LANGUAGE SHOWS. The wordmark everywhere a reader sees it — the bar, a <title>, a hero, a
 *  sheet, an install note — comes from here, so no page can show a name in a language its reader does not read.
 *  A page's markup carries all four readings and `html[lang]` picks one in CSS (the .tri lockup in
 *  scripts/build-shell.mjs), so the right name is on screen in the FIRST paint; this is what the modules use after. */
export const productName = (pageLang: string): string =>
  (pageLang === 'zh-Hans' ? NAME_ZH.hans : pageLang === 'zh-Hant' ? NAME_ZH.hant : PRODUCT.wordmark);

/** The label under the icon for a page language: the one place Russian is 'Мир' and English is 'World' (PRODUCT.short). */
export const shortLabel = (pageLang: string): string =>
  (pageLang === 'zh-Hans' ? PRODUCT.zhHans : pageLang === 'zh-Hant' ? PRODUCT.zhHant : pageLang === 'ru' ? PRODUCT.ru : PRODUCT.en);

/** The two Chinese spellings of the name. Owner rule: 雅伟之界 only while the page language is 简体 (zh-Hans), 雅偉之界 on a
 *  繁體 page — and on an English or Russian page NEITHER is shown, because `productName` gives those the Latin wordmark.
 *  These two are still what a Chinese string composed at run time needs (locale.ts `withBrand`), and every page, script and
 *  build template takes them from here (scripts/lib/product-name.mjs reads this file for the build; `npm run verify:shell`
 *  fails on a stray literal). */
export const NAME_ZH = { hans: '雅伟之界', hant: '雅偉之界' } as const;

/** The Chinese spelling to use for a page language. Only for a string that is Chinese anyway: an English or Russian page
 *  gets its name from `productName`, not from here. */
export const nameZh = (pageLang: string): string => (pageLang === 'zh-Hans' ? NAME_ZH.hans : NAME_ZH.hant);

export type Channel = 'web' | 'store' | 'direct';
export type Target = 'web' | 'shell';

interface Env {
  VITE_TARGET?: string;
  VITE_SCENES_HOST?: string;
  VITE_SHELL_CHANNEL?: string;
}

export const targetOf = (env: Env): Target => (env.VITE_TARGET === 'shell' ? 'shell' : 'web');

export const channelOf = (env: Env): Channel => {
  if (targetOf(env) !== 'shell') return 'web';
  return env.VITE_SHELL_CHANNEL === 'store' ? 'store' : 'direct';
};

/** Where full-size pictures come from. Shell: always the site (the bundle carries thumbnails only). Web: this site's own /pictures/
 *  unless VITE_SCENES_HOST overrides it. Thumbnails are never remote in the shell, so they have no host here. */
export const fullPictureHost = (env: Env): string => (targetOf(env) === 'shell' ? SITE_HOST : env.VITE_SCENES_HOST ?? '');

/** Thumbnails: this origin, except when VITE_SCENES_HOST points the web build somewhere else. */
export const thumbPictureHost = (env: Env): string => (targetOf(env) === 'shell' ? '' : env.VITE_SCENES_HOST ?? '');

/** Base for /api/*: relative on the web, absolute in the shell (a shell page is tauri://localhost, which has no functions). */
export const apiBase = (env: Env): string => (targetOf(env) === 'shell' ? SITE_HOST : '');

/** The canonical public URL of a page the reader is on: what a shared link or a feedback report should carry. */
export const publicUrl = (pathname: string, hash: string): string => `${SITE_HOST}${pathname}${hash}`;
