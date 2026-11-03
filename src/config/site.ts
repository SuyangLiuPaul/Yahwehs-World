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
  en: "Yahweh's World",
  zhHant: '雅偉之界',
  /** Simplified UI may show 雅伟之界 in running text, but a *name* stays Traditional (owner, 2026-11-03). */
  zhHans: '雅偉之界',
  ru: "Yahweh's World",
} as const;

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
