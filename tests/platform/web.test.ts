import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebPlatform } from '../../src/platform/web.ts';
import type { WebDeps } from '../../src/platform/web.ts';
import { getPlatform, setPlatformForTests } from '../../src/platform/index.ts';

function memoryCache() {
  const entries = new Map<string, Response>();
  const names: string[] = [];
  const cache = {
    async put(request: Request, response: Response) { entries.set(request.url, response.clone()); },
    async match(request: Request) { return entries.get(request.url)?.clone(); },
    async delete(request: Request) { return entries.delete(request.url); },
    async keys() { return [...entries.keys()].map(url => new Request(url)); },
  };
  return { names, entries, caches: { async open(name: string) { names.push(name); return cache as unknown as Cache; } } };
}
function streamed() {
  return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.enqueue(new Uint8Array([3, 4, 5])); c.close(); } }), { headers: { 'content-length': '5' } });
}

test('blocked storage never throws; working storage roundtrips', async () => {
  const fail = () => { throw new Error('blocked'); };
  const p = createWebPlatform({ storage: { getItem: fail, setItem: fail, removeItem: fail } });
  assert.equal(await p.storage.get('key'), null);
  await p.storage.set('key', 'value'); await p.storage.remove('key');
  const values = new Map<string, string>();
  const normal = createWebPlatform({ storage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: k => { values.delete(k); } } });
  await normal.storage.set('k', 'v'); assert.equal(await normal.storage.get('k'), 'v');
  await normal.storage.remove('k'); assert.equal(await normal.storage.get('k'), null);
});

test('streaming cache download, overwrite, readback, listing and byte accounting agree', async () => {
  const c = memoryCache(); const progress: { loaded: number; total: number | null }[] = [];
  const p = createWebPlatform({ caches: c.caches, fetch: async () => streamed(), navigator: { storage: { estimate: async () => ({ usage: 12, quota: 100 }), persist: async () => true } } });
  assert.deepEqual(await p.files.download('/file', 'pictures/full/a.webp', s => progress.push(s)), { bytes: 5 });
  assert.deepEqual(progress, [{ loaded: 2, total: 5 }, { loaded: 5, total: 5 }]);
  assert.ok(c.names.every(n => n === 'yw-packs-v1'));
  assert.equal(await p.files.exists('pictures/full/a.webp'), true);
  await p.files.download('/file', 'pictures/full/a.webp');
  await p.files.download('/file', 'pictures/full/nested/b.webp');
  assert.deepEqual(await p.files.list('pictures/full'), ['a.webp']);
  assert.equal(await p.files.bytesUsed(), 10);
  assert.deepEqual([...new Uint8Array(await p.files.read!('pictures/full/a.webp'))], [1, 2, 3, 4, 5]);
  assert.equal(p.files.url('pictures/full/a.webp'), null);
  assert.deepEqual(await p.files.estimate(), { usage: 12, quota: 100 });
  assert.equal(p.capabilities.persistentStorage, true);
  await p.files.remove('pictures/full/a.webp');
  assert.equal(await p.files.exists('pictures/full/a.webp'), false);
  assert.equal(await p.files.bytesUsed(), 5);
});

test('unknown length is null; failed and aborted downloads leave nothing', async () => {
  const c = memoryCache(); const controller = new AbortController();
  const p = createWebPlatform({ caches: c.caches, fetch: async () => streamed() });
  await assert.rejects(p.files.download('/file', 'a', () => controller.abort(), controller.signal), { name: 'AbortError' });
  assert.equal(await p.files.exists('a'), false);
  assert.equal(await p.files.bytesUsed(), 0);
  await assert.rejects(p.files.download('/file', 'b', undefined, controller.signal), { name: 'AbortError' });
  const failed = createWebPlatform({ caches: c.caches, fetch: async () => new Response('', { status: 500 }) });
  await assert.rejects(failed.files.download('/file', 'failed'), /HTTP 500/);
  assert.equal(await failed.files.exists('failed'), false);
  let total: number | null | undefined;
  const unknown = createWebPlatform({ caches: c.caches, fetch: async () => new Response('abc') });
  await unknown.files.download('/file', 'unknown', s => { total = s.total; });
  assert.equal(total, null);
  assert.equal(await unknown.files.bytesUsed(), 3);
});

test('share uses native, clipboard, cancellation and unavailable paths', async () => {
  const payload = { title: 'Title', text: 'Text', url: 'https://example.org/' };
  let shared: unknown; let copied = '';
  assert.equal(await createWebPlatform({ navigator: { share: async p => { shared = p; } } }).share(payload), 'shared');
  assert.deepEqual(shared, payload);
  const clipboard = createWebPlatform({ navigator: { clipboard: { writeText: async text => { copied = text; } } } });
  assert.equal(await clipboard.share(payload), 'copied'); assert.equal(copied, payload.url);
  await clipboard.share({ title: 'Title', text: 'Fallback' }); assert.equal(copied, 'Fallback');
  const cancelled = createWebPlatform({ navigator: { share: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } } });
  assert.equal(await cancelled.share(payload), 'cancelled');
  await assert.rejects(createWebPlatform({ navigator: {} }).share(payload), /^Error: share-unavailable/);
  await assert.rejects(createWebPlatform({ navigator: { share: async () => { throw new Error('denied'); } } }).share(payload), /denied/);
});

test('external URL filter and opener arguments', async () => {
  const opened: unknown[][] = [];
  const p = createWebPlatform({ open: (...args) => opened.push(args) });
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd']) await assert.rejects(p.openExternal(url));
  for (const url of ['https://example.org/', 'http://example.org/', 'mailto:a@example.org']) await p.openExternal(url);
  assert.equal(opened.length, 3);
  assert.deepEqual(opened[0], ['https://example.org/', '_blank', 'noopener,noreferrer']);
});

test('deep links fire on hashchange and unsubscribe', async () => {
  const listeners = new Set<() => void>(); const received: string[] = [];
  const location = { href: 'https://example.org/#a' };
  const p = createWebPlatform({ location, addEventListener(type, cb) { assert.equal(type, 'hashchange'); listeners.add(cb); }, removeEventListener(type, cb) { assert.equal(type, 'hashchange'); listeners.delete(cb); } });
  const off = p.deepLinks.onOpen(url => received.push(url));
  assert.equal(await p.deepLinks.current(), location.href);
  location.href = 'https://example.org/#b'; for (const listener of listeners) listener();
  off(); for (const listener of listeners) listener();
  assert.deepEqual(received, [location.href]); assert.equal(listeners.size, 0);
});

test('update checks handle offline, HTTP failure, same/new version and reload', async () => {
  let response: unknown = { version: '1.0.0' }; let reloaded = 0;
  const p = createWebPlatform({ currentVersion: '1.0.0', location: { href: 'https://example.org/gallery#x' }, fetch: async (url, init) => {
    assert.equal(url, '/version.json'); assert.equal(init?.cache, 'no-store');
    if (response instanceof Error) throw response;
    return Response.json(response);
  }, reload: () => { reloaded++; } });
  assert.equal(await p.updates.check(), null);
  response = { v: '1.1.0' }; assert.deepEqual(await p.updates.check(), { version: '1.1.0', url: 'https://example.org/' });
  response = new Error('offline'); assert.equal(await p.updates.check(), null);
  const failed = createWebPlatform({ fetch: async () => new Response('', { status: 503 }) }); assert.equal(await failed.updates.check(), null);
  await p.updates.apply({ version: '1.1.0', url: 'https://example.org/' }); assert.equal(reloaded, 1);
});

test('OS detection includes iPadOS reporting MacIntel with touch', () => {
  const samples: [WebDeps['navigator'], string][] = [
    [{ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 }, 'ios'],
    [{ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }, 'ios'],
    [{ userAgent: 'Mozilla/5.0 (Linux; Android 14)', maxTouchPoints: 5 }, 'android'],
    [{ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, 'windows'],
    [{ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 0 }, 'macos'],
    [{ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }, 'linux'],
  ];
  for (const [navigator, os] of samples) assert.equal(createWebPlatform({ navigator }).info.os, os);
  assert.equal(createWebPlatform({ navigator: samples[1]![0], matchMedia: () => ({ matches: false }) }).info.formFactor, 'tablet');
  assert.equal(createWebPlatform({ navigator: {}, matchMedia: () => ({ matches: true }) }).info.formFactor, 'desktop');
});

test('notifications are optional and platform selection is memoised with resettable override', async () => {
  assert.equal(createWebPlatform().notifications, undefined);
  const p = createWebPlatform({ Notification: { permission: 'default', requestPermission: async () => 'granted' } });
  assert.equal(await p.notifications!.permission(), 'default'); assert.equal(await p.notifications!.request(), 'granted');
  setPlatformForTests(p); assert.equal(await getPlatform(), p);
  setPlatformForTests(null);
  const first = getPlatform(); assert.equal(getPlatform(), first); assert.equal((await first).kind, 'web');
  setPlatformForTests(null);
});

test('abort cancels a pending reader and normalises custom fetch abort reasons', async () => {
  const c = memoryCache(); const controller = new AbortController(); let cancelled = false;
  const p = createWebPlatform({ caches: c.caches, fetch: async () => new Response(new ReadableStream({
    pull() { controller.abort(new Error('custom reason')); }, cancel() { cancelled = true; },
  })) });
  await assert.rejects(p.files.download('/file', 'pending', undefined, controller.signal), { name: 'AbortError' });
  assert.equal(cancelled, true); assert.equal(await p.files.exists('pending'), false);
  const fetchAbort = new AbortController();
  const rejected = createWebPlatform({ caches: c.caches, fetch: async () => { fetchAbort.abort(new Error('custom reason')); throw fetchAbort.signal.reason; } });
  await assert.rejects(rejected.files.download('/file', 'rejected', undefined, fetchAbort.signal), { name: 'AbortError' });
  assert.equal(await rejected.files.bytesUsed(), 0);
});

test('stream failure never commits a partial cached response', async () => {
  const c = memoryCache();
  const p = createWebPlatform({ caches: c.caches, fetch: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1, 2])); },
    pull(controller) { controller.error(new Error('connection lost')); },
  })) });
  await assert.rejects(p.files.download('/file', 'broken'), /connection lost/);
  assert.equal(await p.files.exists('broken'), false); assert.equal(await p.files.bytesUsed(), 0);
});

test('cache listing returns original Unicode file names', async () => {
  const c = memoryCache(); const p = createWebPlatform({ caches: c.caches, fetch: async () => new Response('abc') });
  await p.files.download('/file', 'data/reader/经文 text.json');
  assert.deepEqual(await p.files.list('data/reader'), ['经文 text.json']);
  assert.equal(await p.files.exists('data/reader/经文 text.json'), true);
  await p.files.remove('data/reader/经文 text.json'); assert.equal(await p.files.bytesUsed(), 0);
});
