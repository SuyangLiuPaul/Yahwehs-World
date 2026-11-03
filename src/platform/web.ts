import type { DownloadProgress, OsName, Platform } from './types.ts';

export interface ShareWeb {
  share?: (p: { title: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
}
export interface WebNavigator extends ShareWeb {
  language?: string; userAgent?: string; platform?: string; maxTouchPoints?: number;
  storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }>; persist?: () => Promise<boolean> };
}
export interface WebDeps {
  fetch?: typeof fetch;
  caches?: Pick<CacheStorage, 'open'>;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  navigator?: WebNavigator;
  open?: (url: string, target: string, features: string) => unknown;
  location?: { href: string };
  addEventListener?: (type: 'hashchange', listener: () => void) => void;
  removeEventListener?: (type: 'hashchange', listener: () => void) => void;
  currentVersion?: string; versionUrl?: string;
  reload?: () => void;
  matchMedia?: (query: string) => { matches: boolean };
  Notification?: { permission: NotificationPermission; requestPermission(): Promise<NotificationPermission> };
}

export function abortCheck(signal?: AbortSignal) {
  if (signal?.aborted) { const error = new Error('Download aborted'); error.name = 'AbortError'; throw error; }
}
export function relativePath(dest: string): string {
  if (!dest || dest.includes('\\') || dest.split('/').some(p => !p || p === '.' || p === '..') || /[?#:%\u0000-\u001f]/.test(dest)) throw new Error('Invalid relative file path');
  return dest;
}
export function externalUrl(url: string): string {
  if (!['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) throw new Error('External URL scheme is not allowed');
  return url;
}
export async function shareWith(nav: ShareWeb, p: { title: string; text?: string; url?: string }): ReturnType<Platform['share']> {
  if (nav.share) {
    try { await nav.share(p); return 'shared'; }
    catch (e) { if ((e as Error)?.name === 'AbortError') return 'cancelled'; throw e; }
  }
  if (nav.clipboard) { await nav.clipboard.writeText(p.url ?? p.text ?? ''); return 'copied'; }
  throw new Error('share-unavailable: sharing and clipboard are unsupported');
}
export async function downloadBytes(fetcher: typeof fetch, url: string, progress?: (p: DownloadProgress) => void, signal?: AbortSignal): Promise<{ data: Uint8Array<ArrayBuffer>; headers: Headers }> {
  abortCheck(signal);
  let response: Response;
  try { response = await fetcher(url, { signal }); }
  catch (error) { abortCheck(signal); throw error; }
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const header = response.headers.get('content-length');
  const total = header !== null && Number.isFinite(Number(header)) && Number(header) >= 0 ? Number(header) : null;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = response.body?.getReader();
  const cancel = () => { void reader?.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (reader) {
      while (true) {
        abortCheck(signal);
        const next = await reader.read();
        abortCheck(signal);
        if (next.done) break;
        chunks.push(next.value); loaded += next.value.byteLength;
        progress?.({ loaded, total });
      }
    }
    abortCheck(signal);
    const data = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    if (!loaded) progress?.({ loaded, total });
    return { data, headers: response.headers };
  } catch (error) { abortCheck(signal); throw error; }
  finally { signal?.removeEventListener('abort', cancel); if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
}

export function createWebPlatform(deps: WebDeps = {}): Platform {
  const nav = deps.navigator ?? globalThis.navigator ?? {};
  const cacheStorage = deps.caches ?? globalThis.caches;
  const fetcher = deps.fetch ?? globalThis.fetch;
  const location = deps.location ?? globalThis.location;
  const media = deps.matchMedia ?? (typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia.bind(globalThis) : undefined);
  const notification = deps.Notification ?? globalThis.Notification;
  const add = deps.addEventListener ?? globalThis.addEventListener?.bind(globalThis);
  const remove = deps.removeEventListener ?? globalThis.removeEventListener?.bind(globalThis);
  const backing = () => deps.storage ?? globalThis.localStorage;
  const cache = () => { if (!cacheStorage) throw new Error('File storage unavailable'); return cacheStorage.open('yw-packs-v1'); };
  const key = (dest: string) => new Request(`https://packs.invalid/${relativePath(dest)}`);
  const ua = nav.userAgent ?? '';
  const touch = (nav.maxTouchPoints ?? 0) > 1;
  const os: OsName = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(nav.platform ?? ua) && touch) ? 'ios'
    : /Android/i.test(ua) ? 'android' : /Mac/i.test(ua) ? 'macos' : /Windows/i.test(ua) ? 'windows' : /Linux/i.test(ua) ? 'linux' : 'web';
  return {
    kind: 'web',
    info: { kind: 'web', os, locale: nav.language ?? 'en', channel: 'web', formFactor: media?.('(min-width: 900px)').matches ? 'desktop' : touch ? (/iPad/i.test(ua) || os === 'ios' && /Mac/i.test(nav.platform ?? '') ? 'tablet' : 'phone') : media ? 'phone' : 'unknown' },
    capabilities: { files: !!cacheStorage, share: !!(nav.share || nav.clipboard), notifications: !!notification, deepLinks: !!add, updates: !!fetcher, persistentStorage: !!nav.storage?.persist },
    storage: {
      async get(k) { try { return backing()?.getItem(k) ?? null; } catch { return null; } },
      async set(k, v) { try { backing()?.setItem(k, v); } catch { /* Blocked/private storage is optional. */ } },
      async remove(k) { try { backing()?.removeItem(k); } catch { /* Blocked/private storage is optional. */ } },
    },
    files: {
      async download(url, dest, progress, signal) {
        const request = key(dest);
        const c = await cache();
        const { data, headers } = await downloadBytes(fetcher, url, progress, signal);
        abortCheck(signal);
        const storedHeaders = new Headers(headers);
        storedHeaders.delete('content-encoding'); storedHeaders.delete('content-length');
        storedHeaders.set('x-yw-bytes', String(data.byteLength));
        await c.put(request, new Response(data, { headers: storedHeaders }));
        if (signal?.aborted) { await c.delete(request); abortCheck(signal); }
        return { bytes: data.byteLength };
      },
      async exists(dest) { return !!(await (await cache()).match(key(dest))); },
      async remove(dest) { await (await cache()).delete(key(dest)); },
      async list(dir) {
        const prefix = `${key(dir).url}/`;
        return (await (await cache()).keys()).map(r => r.url.startsWith(prefix) ? r.url.slice(prefix.length) : '').filter(n => !!n && !n.includes('/')).map(n => decodeURIComponent(n));
      },
      async bytesUsed() {
        const c = await cache(); let bytes = 0;
        for (const request of await c.keys()) if (request.url.startsWith('https://packs.invalid/')) bytes += Number((await c.match(request))?.headers.get('x-yw-bytes') ?? 0);
        return bytes;
      },
      async estimate() { const e = await nav.storage?.estimate?.(); return { usage: e?.usage ?? null, quota: e?.quota ?? null }; },
      url() { return null; },
      async read(dest) { const r = await (await cache()).match(key(dest)); if (!r) throw new Error('Stored file not found'); return r.arrayBuffer(); },
    },
    share: p => shareWith(nav, p),
    async openExternal(url) { (deps.open ?? globalThis.open?.bind(globalThis))?.(externalUrl(url), '_blank', 'noopener,noreferrer'); },
    deepLinks: {
      onOpen(cb) { const listener = () => cb(location?.href ?? ''); add?.('hashchange', listener); return () => remove?.('hashchange', listener); },
      async current() { return location?.href ?? null; },
    },
    updates: {
      async check() {
        try {
          const r = await fetcher(deps.versionUrl ?? '/version.json', { cache: 'no-store' });
          if (!r.ok) return null;
          const json = await r.json(); const version = json.version ?? json.v;
          return typeof version === 'string' && version !== deps.currentVersion ? { version, url: `${new URL(location.href).origin}/` } : null;
        } catch { return null; }
      },
      async apply() { (deps.reload ?? (() => globalThis.location?.reload()))(); },
    },
    ...(notification ? { notifications: { async permission() { return notification.permission; }, async request() { return notification.requestPermission(); } } } : {}),
  };
}
