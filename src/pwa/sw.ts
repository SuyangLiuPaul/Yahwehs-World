// The gallery's service worker. Built by scripts/build-pwa.mjs (esbuild, one file, /sw.js) with two constants filled in:
// __PWA_BUILD__ (an id that changes with any byte of the shell) and __PWA_PRECACHE__ ([[path, revision], ...]).
// Rules, numbers and what iOS does with them: docs/gallery-pwa.md. The decisions that can be tested without a browser live in
// ./core.ts; this file is the part that touches the Cache API and the fetch event.
//
// In one breath:
//   pages        network first (3 s), the build's saved copy when the network is down or slow; a deploy is seen on the next load
//   /assets/*    this build's precache, then the network; hashed names, so an old page keeps the old scripts it came with
//   /data/*      network first, saved copy when offline; the three small start-up files are served from the precache
//   pictures     cache first with a byte budget (60 MB full, 30 MB thumbs), least recently used leave first
//   fonts        cache first with a budget (20 MB); the stylesheet is refreshed in the background
//   never        POST, ranges, /api/*, opaque responses, anything on another host
// A new worker installs in the background (its own precache) and WAITS; it takes over when every tab is closed or when the page
// asks (the "update ready" toast). No skipWaiting on its own: a page that is still running keeps the scripts and chunks it came with.
import {
  BUDGETS, CACHE_PREFIX, NAV_TIMEOUT_MS, PICTURE_TTL_MS, cacheNames, classify, currentCacheNames, isStale, pictureStubId,
  planEviction, reconcile, runtimeCacheOf, shellPage, totalBytes, touched, withEntry,
  type Index, type Kind, type RuntimeCache,
} from './core.ts';

declare const __PWA_BUILD__: string;
declare const __PWA_PRECACHE__: [string, string][];

// The few worker globals this file uses. (The project's tsconfig has the DOM library, which has no service-worker types.)
interface Ext { waitUntil(p: Promise<unknown>): void }
interface FetchEv extends Ext { request: Request; respondWith(r: Response | Promise<Response>): void }
interface MsgEv extends Ext { data: unknown; source: { postMessage(m: unknown): void } | null; ports: readonly MessagePort[] }
interface SW {
  addEventListener(t: 'install' | 'activate', f: (e: Ext) => void): void;
  addEventListener(t: 'fetch', f: (e: FetchEv) => void): void;
  addEventListener(t: 'message', f: (e: MsgEv) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void>; matchAll(o?: { type?: string; includeUncontrolled?: boolean }): Promise<{ postMessage(m: unknown): void }[]> };
  registration: { update(): Promise<void> };
  location: Location;
}
const sw = self as unknown as SW;

const BUILD = __PWA_BUILD__;
const PRECACHE = __PWA_PRECACHE__;
const PRECACHE_PATHS = new Set(PRECACHE.map(([p]) => p));
const NAMES = cacheNames(BUILD);
const ORIGIN = sw.location.origin;
const OFFLINE = '/offline.html';

// ── small helpers ─────────────────────────────────────────────────────────────────────────────────────────────────
const timeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); no(e); }); });

/** A stored page must not remember a redirect: the browser refuses a redirected response for a navigation. */
async function clean(res: Response): Promise<Response> {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: 200, statusText: 'OK', headers: res.headers });
}
/** The saved copy: the decoded bytes, the original headers minus the ones that described the wire form, plus our own size and time. */
const stamped = (buf: ArrayBuffer, res: Response, now: number): Response => {
  const h = new Headers(res.headers);
  h.delete('content-encoding'); h.delete('content-length');
  h.set('x-ydh-bytes', String(buf.byteLength));
  h.set('x-ydh-at', String(now));
  return new Response(buf, { status: 200, headers: h });
};

// ── byte-budgeted caches (pictures, thumbs, data, fonts) ───────────────────────────────────────────────────────────
// Each keeps an index {url: {bytes, used, stored}} in one entry of ydh-meta-v1. The index is rebuilt from the cache itself
// when the two disagree (the worker is stopped at any time; the browser may clear either), so it only ever has to be roughly right.
const indexes = new Map<RuntimeCache, Promise<Index>>();
let chain: Promise<unknown> = Promise.resolve();
/** All bookkeeping runs one at a time: parallel image loads must not overwrite each other's index. */
const serial = <T>(f: () => Promise<T>): Promise<T> => { const r = chain.then(f, f); chain = r.catch(() => {}); return r; };
const metaKey = (c: RuntimeCache) => new Request(`${ORIGIN}/__ydh-meta/${c}`);

async function loadIndex(c: RuntimeCache): Promise<Index> {
  let p = indexes.get(c);
  if (!p) {
    p = (async () => {
      const [meta, cache] = await Promise.all([caches.open(NAMES.meta), caches.open(NAMES[c])]);
      let ix: Index = {};
      try { const r = await meta.match(metaKey(c)); if (r) ix = (await r.json()) as Index; } catch { /* damaged: rebuilt below */ }
      const keys = await cache.keys();
      const urls = keys.map((k) => k.url);
      const sizes = new Map<string, number>();
      for (const u of urls) if (!ix[u]) {
        const r = await cache.match(u);
        sizes.set(u, Number(r?.headers.get('x-ydh-bytes')) || 0);
      }
      return reconcile(ix, urls, (u) => sizes.get(u) ?? 0, Date.now());
    })();
    indexes.set(c, p);
  }
  return p;
}
let flushTimer: ReturnType<typeof setTimeout> | undefined;
const dirty = new Set<RuntimeCache>();
function saveIndex(c: RuntimeCache, ix: Index, now = false) {
  indexes.set(c, Promise.resolve(ix));
  dirty.add(c);
  const flush = async () => {
    const meta = await caches.open(NAMES.meta);
    for (const d of [...dirty]) { dirty.delete(d); const cur = await indexes.get(d); if (cur) await meta.put(metaKey(d), new Response(JSON.stringify(cur), { headers: { 'content-type': 'application/json' } })); }
  };
  clearTimeout(flushTimer);
  if (now) return flush();
  flushTimer = setTimeout(() => { void flush().catch(() => {}); }, 600);
}

/** Store a good (200, same-origin or CORS) response in a runtime cache, evicting the least recently used to stay in budget.
 *  Never throws: a full disk or an evicted cache costs a saved copy, never the page. */
function store(c: RuntimeCache, req: Request | string, res: Response): Promise<void> {
  return serial(async () => {
    try {
      if (res.status !== 200 || res.type === 'opaque' || res.type === 'opaqueredirect') return;
      const url = typeof req === 'string' ? req : req.url;
      const buf = await res.clone().arrayBuffer();
      const bytes = buf.byteLength;
      const now = Date.now();
      let ix = await loadIndex(c);
      const cache = await caches.open(NAMES[c]);
      const old = ix[url]?.bytes ?? 0;
      const without = old ? { ...ix } : ix;
      if (old) delete without[url];
      const plan = planEviction(without, BUDGETS[c], bytes);
      if (!plan) return; // bigger than the whole budget
      for (const u of plan) { await cache.delete(u); delete without[u]; }
      const put = async () => cache.put(url, stamped(buf, res, now));
      try { await put(); } catch {
        // quota: give up half of what is saved, once, then try again
        const half = planEviction(without, Math.floor(totalBytes(without) / 2), 0) ?? [];
        for (const u of half) { await cache.delete(u); delete without[u]; }
        await put();
      }
      saveIndex(c, withEntry(without, url, bytes, now));
    } catch { /* nothing saved */ }
  });
}

async function use(c: RuntimeCache, url: string): Promise<Response | undefined> {
  const cache = await caches.open(NAMES[c]);
  const hit = await cache.match(url, { ignoreVary: true });
  if (hit) void serial(async () => { saveIndex(c, touched(await loadIndex(c), url, Date.now())); });
  return hit;
}

// ── strategies ──────────────────────────────────────────────────────────────────────────────────────────────────────
async function precacheAll(): Promise<void> {
  const cache = await caches.open(NAMES.shell);
  const todo = PRECACHE;
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(async ([path]) => {
      const res = await fetch(new Request(path, { cache: 'reload' }));
      if (!res.ok) throw new Error(`precache ${path}: ${res.status}`); // the install fails, the old worker stays, the browser tries again later
      await cache.put(path, await clean(res));
    }));
  }
}

async function navigate(req: Request, e: Ext): Promise<Response> {
  const path = new URL(req.url).pathname;
  const shell = shellPage(path);
  const stub = pictureStubId(path);
  const fallback = async (): Promise<Response> => {
    const cache = await caches.open(NAMES.shell);
    if (shell) { const hit = await cache.match(shell); if (hit) return hit; }
    if (stub) return redirectPage(`/scenes.html#p=${stub}`);
    return (await cache.match(OFFLINE)) ?? new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  };
  try {
    const res = await timeout(fetch(req), shell ? NAV_TIMEOUT_MS : 8000);
    if (res.status >= 500) return (await fallback());
    if (shell && res.status === 200) e.waitUntil(healShell(shell, res.clone()));
    return res;
  } catch { return fallback(); }
}
/** The browser may drop a cache when storage is short. The network works (this page just came from it) and the saved copy of this page is gone.
 *  If the server is still on this build, the files it serves are exactly the ones this worker was made for: save them again.
 *  If a newer build is deployed, refilling this build's cache from it would mix the two; instead look for the newer worker, which brings a whole
 *  cache of its own (the page, already on the newer build, then asks it to take over: src/gallery/pwa.ts). */
async function healShell(shell: string, res: Response): Promise<void> {
  try {
    if (await (await caches.open(NAMES.shell)).match(shell)) return;
    const built = /name="ydh-build" content="([^"]*)"/.exec(await res.text())?.[1];
    if (built === BUILD) await precacheAll(); else await sw.registration.update();
  } catch { /* the next page load tries again */ }
}
const redirectPage = (to: string) => new Response(
  `<!doctype html><meta charset="utf-8"><title>Yahweh's World</title><script>location.replace(${JSON.stringify(to)})</script><p><a href="${to}">Open</a></p>`,
  { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

/** This build's precache, then the network (and self-heal: a file the browser has dropped from the cache is put back). */
async function staticFile(req: Request): Promise<Response> {
  const cache = await caches.open(NAMES.shell);
  const path = new URL(req.url).pathname;
  const hit = await cache.match(path);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && PRECACHE_PATHS.has(path)) { try { await cache.put(path, res.clone()); } catch { /* full */ } }
  return res;
}

/** Network first; when it fails the saved copy (the precache for the three start-up files, the data cache for the rest). */
async function dataFile(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pre = PRECACHE_PATHS.has(url.pathname);
  if (pre) {
    // consistent with the page this build saved: never write a newer copy into the old build's cache
    try { return await timeout(fetch(req), NAV_TIMEOUT_MS + 1000); } catch {
      const hit = await (await caches.open(NAMES.shell)).match(url.pathname);
      if (hit) return hit;
      throw new Error('offline');
    }
  }
  try {
    const res = await timeout(fetch(req), 6000);
    if (res.status === 200) void store('data', req.url, res.clone());
    return res;
  } catch (e) {
    const hit = await use('data', req.url);
    if (hit) return hit;
    throw e;
  }
}

/** Cache first; a picture older than PICTURE_TTL_MS is checked again in the background. */
async function budgeted(c: RuntimeCache, req: Request, e: Ext, ttl: number | null): Promise<Response> {
  const hit = await use(c, req.url);
  if (hit) {
    if (ttl !== null) {
      const ix = await loadIndex(c);
      if (isStale(ix[req.url], Date.now(), ttl)) e.waitUntil(fetch(req.url, { cache: 'no-cache' }).then((r) => store(c, req.url, r)).catch(() => {}));
    }
    return hit;
  }
  const res = await fetch(req);
  if (res.status === 200) e.waitUntil(store(c, req.url, res.clone()));
  return res;
}

/** Google Fonts stylesheet: the saved copy at once, a fresh one fetched behind it. Asked with CORS so the copy is readable (and countable). */
async function fontCss(req: Request, e: Ext): Promise<Response> {
  const fresh = fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' })).then((r) => { if (r.status === 200) void store('fonts', req.url, r.clone()); return r; });
  const hit = await use('fonts', req.url);
  if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
  return fresh;
}

// ── lifecycle ─────────────────────────────────────────────────────────────────────────────────────────────────────
sw.addEventListener('install', (e) => { e.waitUntil(precacheAll()); });

sw.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set(currentCacheNames(BUILD));
    for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX) && !keep.has(k)) await caches.delete(k);
    await sw.clients.claim();
  })());
});

sw.addEventListener('fetch', (e) => {
  const req = e.request;
  const kind: Kind = classify(new URL(req.url), ORIGIN, { method: req.method, mode: req.mode, range: req.headers.has('range') }, PRECACHE_PATHS);
  if (kind === 'bypass') return;
  const run = (): Promise<Response> => {
    switch (kind) {
      case 'navigate': return navigate(req, e);
      case 'static': return staticFile(req);
      case 'data': return dataFile(req);
      case 'picture': return budgeted('pictures', req, e, PICTURE_TTL_MS);
      case 'thumb': return budgeted('thumbs', req, e, PICTURE_TTL_MS);
      case 'font-css': return fontCss(req, e);
      default: return budgeted('fonts', req, e, null); // font-file
    }
  };
  e.respondWith(run());
});

// ── messages from the page ─────────────────────────────────────────────────────────────────────────────────────────
type Msg =
  | { type: 'skip-waiting' }
  | { type: 'activate-if-alone' }
  | { type: 'get-build' }
  | { type: 'adopt'; urls: string[] }
  | { type: 'report' }
  | { type: 'clear' };

sw.addEventListener('message', (e) => {
  const m = e.data as Msg | null;
  if (!m || typeof m !== 'object') return;
  const reply = (v: unknown) => { (e.ports[0] ?? e.source)?.postMessage(v); };
  switch (m.type) {
    case 'skip-waiting': e.waitUntil(sw.skipWaiting()); break;
    // the page that asks already runs this build (it came from the network after the deploy): take over unless another tab still runs the old one
    // (includeUncontrolled: a waiting worker controls nothing yet, so its own clients() would always be empty)
    case 'activate-if-alone': e.waitUntil(sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => (l.length <= 1 ? sw.skipWaiting() : undefined))); break;
    case 'get-build': reply({ type: 'build', build: BUILD }); break;
    case 'report': e.waitUntil((async () => {
      const out: Record<string, { bytes: number; files: number; budget: number }> = {};
      for (const c of Object.keys(BUDGETS) as RuntimeCache[]) { const ix = await loadIndex(c); out[c] = { bytes: totalBytes(ix), files: Object.keys(ix).length, budget: BUDGETS[c] }; }
      reply({ type: 'report', build: BUILD, caches: out });
    })()); break;
    case 'clear': e.waitUntil((async () => {
      for (const c of Object.keys(BUDGETS) as RuntimeCache[]) { await serial(async () => { await caches.delete(NAMES[c]); saveIndex(c, {}, true); }); }
      reply({ type: 'cleared' });
    })()); break;
    case 'adopt': e.waitUntil(adopt(m.urls)); break;
  }
});

/** The page was loaded before this worker controlled it (the first visit), so its pictures and data never passed through the fetch handler.
 *  The page lists what it fetched; those are taken from the browser's own HTTP cache if it has them, and saved. */
async function adopt(urls: unknown): Promise<void> {
  if (!Array.isArray(urls)) return;
  for (const raw of urls.slice(0, 60)) {
    try {
      if (typeof raw !== 'string') continue;
      const u = new URL(raw, ORIGIN);
      const kind = classify(u, ORIGIN, { method: 'GET', mode: 'cors' }, PRECACHE_PATHS);
      const c = runtimeCacheOf(kind);
      if (!c || PRECACHE_PATHS.has(u.pathname)) continue;
      if (u.origin !== ORIGIN && kind !== 'font-file') continue;
      if ((await loadIndex(c))[u.href]) continue;
      const res = await fetch(u.href, { cache: 'force-cache' });
      await store(c, u.href, res);
    } catch { /* skip it */ }
  }
}
