// The pure part of the gallery's service worker: which cache a request belongs to, how much each cache may hold, and
// which entries go when one is full. No DOM, no service-worker globals, nothing that runs at import time, so
// tests/gallery/pwa-core.test.ts can drive every rule with plain objects. The worker itself is src/pwa/sw.ts.
// Design and limits: docs/gallery-pwa.md.

export const MiB = 1024 * 1024;

/** Every cache this site makes starts with this, so the worker can tell its own caches from anyone else's. */
export const CACHE_PREFIX = 'ydh-';

/** Byte budgets of the caches that fill as a person reads. The shell (pages, scripts, styles, the three small data files)
 *  is not in this table: it is fixed by the build and checked by scripts/build-pwa.mjs (SHELL_MAX). */
export const BUDGETS = {
  pictures: 60 * MiB, // recently viewed full-size pictures
  thumbs: 30 * MiB,   // gallery thumbnails
  data: 40 * MiB,     // Bible book data (text, headings, paragraphs) and the Traditional table, cached on use
  fonts: 20 * MiB,    // Google Fonts files the pages ask for (CJK faces come in many small slices)
} as const;
export type RuntimeCache = keyof typeof BUDGETS;

/** A picture is revalidated in the background when it is older than this (a corrected plate keeps its file name). */
export const PICTURE_TTL_MS = 3 * 24 * 3600 * 1000;
/** How long a navigation waits for the network before the saved page is shown. */
export const NAV_TIMEOUT_MS = 3000;

/** Largest the build may make the precache (bytes); the build fails above it. */
export const SHELL_MAX = 4 * MiB;

export const cacheNames = (build: string) => ({
  shell: `${CACHE_PREFIX}shell-${build}`,
  pictures: `${CACHE_PREFIX}pictures-v1`,
  thumbs: `${CACHE_PREFIX}thumbs-v1`,
  data: `${CACHE_PREFIX}data-v1`,
  fonts: `${CACHE_PREFIX}fonts-v1`,
  /** the LRU bookkeeping (one JSON entry per runtime cache) */
  meta: `${CACHE_PREFIX}meta-v1`,
});
export type CacheNames = ReturnType<typeof cacheNames>;

/** Caches that belong to this build and schema: everything else that starts with the prefix is deleted on activation. */
export const currentCacheNames = (build: string): string[] => Object.values(cacheNames(build));

export type Kind =
  | 'bypass'     // not ours: POST, ranges, other hosts, the feedback function, anything unknown
  | 'navigate'   // a page load
  | 'static'     // the shell: /assets/*, brand images, icons (cache-first from this build's precache)
  | 'data'       // /data/*: network first, saved copy when offline
  | 'picture'    // /pictures/full/*
  | 'thumb'      // /pictures/thumb/*
  | 'font-css'   // fonts.googleapis.com/css2
  | 'font-file'; // fonts.gstatic.com

export interface RequestInfo {
  method: string;
  /** Request.mode */ mode: string;
  /** has a Range header */ range?: boolean;
}

/** Same-origin paths that are never touched, whatever the method: the feedback function and Netlify's own endpoints. */
const NEVER = /^\/(?:api|\.netlify)(?:\/|$)/;

/** Which strategy a request gets. `precache` is the set of paths the build put in the shell cache. */
export function classify(url: URL, origin: string, req: RequestInfo, precache: ReadonlySet<string> = new Set()): Kind {
  if (req.method !== 'GET') return 'bypass';
  if (req.range) return 'bypass';
  if (url.origin !== origin) {
    if (url.protocol !== 'https:') return 'bypass';
    if (url.hostname === 'fonts.googleapis.com') return url.pathname.startsWith('/css') ? 'font-css' : 'bypass';
    if (url.hostname === 'fonts.gstatic.com') return 'font-file';
    return 'bypass';
  }
  const p = url.pathname;
  if (NEVER.test(p)) return 'bypass';
  if (req.mode === 'navigate') {
    // a page: .html, a pretty path, a picture share stub. Files with other extensions (sitemap.xml, robots.txt, a picture opened on its own) go to the network.
    if (p === '/' || p.endsWith('.html') || !/\.[A-Za-z0-9]{1,6}$/.test(p)) return 'navigate';
    return 'bypass';
  }
  if (p.startsWith('/pictures/full/')) return 'picture';
  if (p.startsWith('/pictures/thumb/')) return 'thumb';
  if (p.startsWith('/data/')) return 'data';
  if (p.startsWith('/assets/') || p.startsWith('/pwa/') || precache.has(p)) return 'static';
  return 'bypass';
}

/** The shell page a navigation stands for, or null (no saved copy exists for it). */
export function shellPage(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '/index.html') return '/index.html';
  if (p === '/scenes' || p === '/scenes.html' || p === '/gallery' || p === '/pictures') return '/scenes.html';
  if (p === '/bible' || p === '/bible.html') return '/bible.html';
  return null;
}

/** /p/<id> is a share stub that forwards to /scenes.html#p=<id>; its id, or null. */
export function pictureStubId(pathname: string): string | null {
  const m = /^\/p\/([A-Za-z0-9_-]{1,80})\/?(?:index\.html)?$/.exec(pathname);
  return m ? m[1]! : null;
}

/** Which runtime cache a kind fills, or null. */
export const runtimeCacheOf = (k: Kind): RuntimeCache | null =>
  k === 'picture' ? 'pictures' : k === 'thumb' ? 'thumbs' : k === 'data' ? 'data' : k === 'font-css' || k === 'font-file' ? 'fonts' : null;

// ── the least-recently-used bookkeeping ─────────────────────────────────────────────────────────────────────────────
export interface Entry { bytes: number; /** last time it was served or stored (ms) */ used: number; /** when its bytes were fetched (ms) */ stored: number }
export type Index = Record<string, Entry>;

export const totalBytes = (ix: Index): number => Object.values(ix).reduce((a, e) => a + e.bytes, 0);

/** The URLs to delete, least recently used first, so that `incoming` more bytes fit in `budget`.
 *  `null` = the new entry alone is bigger than the whole budget: do not store it, and delete nothing. */
export function planEviction(ix: Index, budget: number, incoming: number, keep?: string): string[] | null {
  if (incoming > budget) return null;
  let total = totalBytes(ix);
  const out: string[] = [];
  if (total + incoming <= budget) return out;
  const order = Object.entries(ix).filter(([u]) => u !== keep).sort((a, b) => a[1].used - b[1].used || (a[0] < b[0] ? -1 : 1));
  for (const [u, e] of order) {
    if (total + incoming <= budget) break;
    out.push(u);
    total -= e.bytes;
  }
  return out;
}

/** Index after a store: the old entry of the same URL is replaced, not added to. */
export function withEntry(ix: Index, url: string, bytes: number, now: number): Index {
  return { ...ix, [url]: { bytes, used: now, stored: now } };
}
export function touched(ix: Index, url: string, now: number): Index {
  const e = ix[url];
  return e ? { ...ix, [url]: { ...e, used: now } } : ix;
}
export const isStale = (e: Entry | undefined, now: number, ttl: number): boolean => !e || now - e.stored > ttl;

/** What a rebuilt index looks like when the cache and its bookkeeping disagree (the worker was killed before the last write,
 *  or the browser cleared one of them): entries for URLs not in the cache go, URLs the cache has but the index lacks come
 *  back with the size the response carried (`sizeOf`), used = stored = `now`. */
export function reconcile(ix: Index, cached: readonly string[], sizeOf: (url: string) => number, now: number): Index {
  const have = new Set(cached);
  const out: Index = {};
  for (const u of cached) out[u] = ix[u] ?? { bytes: sizeOf(u), used: now, stored: now };
  for (const u of Object.keys(ix)) if (!have.has(u) && out[u]) delete out[u];
  return out;
}

// ── the update flow, as a function of states ──────────────────────────────────────────────────────────────────────
/** Should the page show "an update is ready"? Not when the page itself already is that build (it came from the network after the
 *  deploy), and not when there is no worker waiting. */
export const shouldOfferUpdate = (pageBuild: string, waitingBuild: string | null): boolean => !!waitingBuild && waitingBuild !== pageBuild;
