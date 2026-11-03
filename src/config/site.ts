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

/** The names a reader sees. The product name is Traditional wherever it is a name (store title, icon, About). */
export const PRODUCT = {
  /** The official name, as a store lists it and as the About page writes it. */
  full: "雅偉之界 / Yahweh's World",
  /** The label under the icon, by reading language. Russian follows the site's own wording (the manifests use the same). */
  en: "Yahweh's World",
  zhHant: '雅偉之界',
  /** Native labels (icon, store title, window title) have no page language, so they stay Traditional (owner, 2026-11-03).
   *  Inside a page the rule is NAME_ZH below: Simplified only while the page language is zh-Hans. */
  zhHans: '雅偉之界',
  ru: 'Мир Яхве',
} as const;

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
