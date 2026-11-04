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
 *  Inside a page the Chinese spelling follows NAME_ZH below: 雅伟之界 only while the page language is 简体. The
 *  launcher labels follow the same rule, so a phone set to 简体 gets 雅伟之界 under the icon — which is the one place
 *  the 2026-11-03 "Traditional wherever it is a name" ruling was overridden by the 2026-11-04 naming decision. */
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

/** The name to print inside a page of this language: the Chinese spelling for a Chinese page, the wordmark otherwise. */
export const productName = (pageLang: string): string =>
  (pageLang === 'zh-Hans' ? NAME_ZH.hans : pageLang === 'zh-Hant' ? NAME_ZH.hant : PRODUCT.wordmark);

/** The Chinese name as a page shows it. Owner rule (2026-11-04): 雅偉之界 (Traditional) in English, Russian and 繁體 pages,
 *  雅伟之界 only while the page language is 简体 (zh-Hans). Every page, script and build template takes the two spellings from
 *  here (scripts/lib/product-name.mjs reads this file for the build; `npm run verify:shell` fails on a stray literal). */
export const NAME_ZH = { hans: '雅伟之界', hant: '雅偉之界' } as const;

/** The Chinese name to show for a page language ('zh-Hans' is the only one that gets the Simplified spelling). */
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
