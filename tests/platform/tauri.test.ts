import test from 'node:test';
import assert from 'node:assert/strict';
import { createTauriPlatform } from '../../src/platform/tauri.ts';
import type { TauriDeps } from '../../src/platform/tauri.ts';

function fixture(channel: 'store' | 'direct' = 'direct') {
  const files = new Map<string, Uint8Array>(); const directories = new Set<string>();
  const settings = new Map<string, unknown>(); const opened: string[] = []; const converted: string[] = [];
  let saved = 0; let fetched = 0; let release = 'v1.3.0'; let listener: ((urls: string[]) => void) | undefined; let removed = 0;
  let write: ((path: string) => void) | undefined;
  const deps: TauriDeps = {
    channel, shareWeb: {},
    core: { convertFileSrc(path) { converted.push(path); return `asset:${path}`; } },
    path: { appLocalDataDir: async () => '/app/data', join: async (...parts) => parts.join('/') },
    fs: {
      async writeFile(path, data) { assert.ok(data instanceof Uint8Array); files.set(String(path), data as Uint8Array); write?.(String(path)); },
      async readFile(path) { return files.get(String(path))!.slice() as Uint8Array<ArrayBuffer>; },
      async exists(path) { return files.has(String(path)) || directories.has(String(path)); },
      async remove(path) { files.delete(String(path)); },
      async mkdir(path, opts) { assert.equal(opts?.recursive, true); directories.add(String(path)); },
      async stat(path) { return { size: files.get(String(path))?.byteLength ?? 0 } as Awaited<ReturnType<NonNullable<TauriDeps['fs']>['stat']>>; },
      async readDir(path) { return [...files.keys()].filter(f => f.startsWith(`${path}/`) && !f.slice(String(path).length + 1).includes('/')).map(f => ({ name: f.split('/').at(-1)!, isFile: true, isDirectory: false, isSymlink: false })); },
    },
    store: { async load(file) {
      assert.equal(file, 'yw-settings.json');
      return { async get<T>(key: string) { return settings.get(key) as T | undefined; }, async set(key, value) { settings.set(key, structuredClone(value)); }, async delete(key) { return settings.delete(key); }, async save() { saved++; } };
    } },
    opener: { async openUrl(url) { opened.push(url); } },
    os: { platform: () => 'android', version: () => '14', arch: () => 'aarch64', locale: async () => 'zh-CN' },
    app: { getVersion: async () => '1.2.3' },
    deepLink: { async onOpenUrl(cb) { listener = cb; return () => { removed++; listener = undefined; }; }, async getCurrent() { return ['yw://gallery/a', 'yw://gallery/b']; } },
    fetch: async url => {
      fetched++;
      if (String(url).includes('/releases/latest')) return Response.json({ tag_name: release, html_url: 'https://github.com/example/releases/latest' });
      return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.enqueue(new Uint8Array([3])); c.close(); } }), { headers: { 'content-length': '3' } });
    },
  };
  return { deps, files, directories, settings, opened, converted, saved: () => saved, fetched: () => fetched, setRelease(v: string) { release = v; }, onWrite(cb: (path: string) => void) { write = cb; }, fire(urls: string[]) { listener?.(urls); }, removed: () => removed };
}

test('native download writes under app data, persists index, converts URL and survives adapter reload', async () => {
  const f = fixture(); const p = await createTauriPlatform(f.deps); const progress: number[] = [];
  assert.equal(p.files.url('pictures/full/a.webp'), null);
  assert.deepEqual(await p.files.download('https://example.org/file', 'pictures/full/a.webp', s => progress.push(s.loaded)), { bytes: 3 });
  assert.deepEqual(progress, [2, 3]);
  assert.deepEqual([...f.files.get('/app/data/pictures/full/a.webp')!], [1, 2, 3]);
  assert.ok(f.directories.has('/app/data/pictures/full'));
  assert.deepEqual(f.settings.get('files.index'), { 'pictures/full/a.webp': 3 });
  assert.equal(await p.files.bytesUsed(), 3); assert.equal(await p.files.exists('pictures/full/a.webp'), true);
  assert.equal(p.files.url('pictures/full/a.webp'), 'asset:/app/data/pictures/full/a.webp');
  assert.deepEqual(f.converted, ['/app/data/pictures/full/a.webp']);
  assert.deepEqual(await p.files.list('pictures/full'), ['a.webp']);
  assert.deepEqual(await p.files.estimate(), { usage: 3, quota: null });
  assert.equal((await p.files.read!('pictures/full/a.webp')).byteLength, 3);
  const reloaded = await createTauriPlatform(f.deps);
  assert.equal(await reloaded.files.bytesUsed(), 3); assert.equal(reloaded.files.url('pictures/full/a.webp'), 'asset:/app/data/pictures/full/a.webp');
  await reloaded.files.remove('pictures/full/a.webp'); assert.equal(await reloaded.files.bytesUsed(), 0);
  assert.deepEqual(await reloaded.files.list('pictures/full'), []);
  assert.equal(await reloaded.files.exists('pictures/full/a.webp'), false); assert.equal(reloaded.files.url('pictures/full/a.webp'), null);
  assert.equal(p.info.os, 'android'); assert.equal(p.info.formFactor, 'phone'); assert.equal(p.info.locale, 'zh-CN');
  assert.equal(p.notifications, undefined); assert.equal(p.capabilities.notifications, false);
});

test('native settings save changes, and concurrent downloads preserve all index entries', async () => {
  const f = fixture(); const p = await createTauriPlatform(f.deps);
  await p.storage.set('key', 'value'); assert.equal(await p.storage.get('key'), 'value');
  await p.storage.remove('key'); assert.equal(await p.storage.get('key'), null); assert.equal(f.saved(), 2);
  await Promise.all(['a', 'b', 'c', 'd'].map(dest => p.files.download('https://example.org/file', dest)));
  assert.equal(await p.files.bytesUsed(), 12);
  assert.deepEqual(f.settings.get('files.index'), { a: 3, b: 3, c: 3, d: 3 });
});

test('abort before download, during stream and during write leaves no file or index', async () => {
  for (const when of ['before', 'stream', 'write']) {
    const f = fixture(); const p = await createTauriPlatform(f.deps); const c = new AbortController();
    if (when === 'before') c.abort();
    if (when === 'write') f.onWrite(() => c.abort());
    await assert.rejects(p.files.download('https://example.org/file', 'pictures/full/a.webp', () => { if (when === 'stream') c.abort(); }, c.signal), { name: 'AbortError' });
    assert.equal(f.files.size, 0); assert.equal(await p.files.bytesUsed(), 0);
    assert.deepEqual(f.settings.get('files.index') ?? {}, {});
  }
});

test('failed native write cleans up a partially written file', async () => {
  const f = fixture(); const original = f.deps.fs!.writeFile;
  f.deps.fs!.writeFile = async (...args) => { await original(...args); throw new Error('disk full'); };
  const p = await createTauriPlatform(f.deps);
  await assert.rejects(p.files.download('https://example.org/file', 'a'), /disk full/);
  assert.equal(f.files.size, 0); assert.equal(await p.files.bytesUsed(), 0);
});

test('store channel never calls releases API', async () => {
  const f = fixture('store'); const p = await createTauriPlatform(f.deps);
  assert.equal(await p.updates.check(), null); assert.equal(f.fetched(), 0); assert.equal(p.capabilities.updates, false);
});

test('direct updates compare three numeric segments, open newer release, reject equal/older and tolerate offline', async () => {
  const f = fixture(); const p = await createTauriPlatform(f.deps);
  assert.deepEqual(await p.updates.check(), { version: '1.3.0', url: 'https://github.com/example/releases/latest' });
  await p.updates.apply((await p.updates.check())!); assert.equal(f.opened.length, 1);
  for (const version of ['v1.2.3', 'v1.2.3.10', 'v1.1.9', 'v0.9.99', 'invalid']) { f.setRelease(version); assert.equal(await p.updates.check(), null); }
  f.setRelease('v2.0.0'); assert.equal((await p.updates.check())?.version, '2.0.0');
  const offline = await createTauriPlatform({ ...f.deps, fetch: async () => { throw new Error('offline'); } }); assert.equal(await offline.updates.check(), null);
});

test('native external URL filter, deep links and early unsubscribe', async () => {
  const f = fixture(); const p = await createTauriPlatform(f.deps);
  await assert.rejects(p.openExternal('javascript:alert(1)')); await assert.rejects(p.openExternal('file:///secret'));
  await p.openExternal('https://example.org/'); await p.openExternal('mailto:a@example.org'); assert.equal(f.opened.length, 2);
  const received: string[] = []; const off = p.deepLinks.onOpen(url => received.push(url));
  await Promise.resolve(); f.fire(['yw://one', 'yw://two']); off(); f.fire(['yw://three']);
  assert.deepEqual(received, ['yw://one', 'yw://two']); assert.equal(f.removed(), 1);
  assert.equal(await p.deepLinks.current(), 'yw://gallery/a');
  const early = p.deepLinks.onOpen(url => received.push(url)); early(); await Promise.resolve();
  assert.equal(f.removed(), 2); f.fire(['yw://late']); assert.equal(received.length, 2);
});

test('native share falls back to webview clipboard and reports cancellation', async () => {
  const f = fixture(); let copied = '';
  const p = await createTauriPlatform({ ...f.deps, shareWeb: { clipboard: { async writeText(text) { copied = text; } } } });
  assert.equal(await p.share({ title: 'Title', url: 'https://example.org/' }), 'copied'); assert.equal(copied, 'https://example.org/');
  const cancelled = await createTauriPlatform({ ...f.deps, shareWeb: { async share() { throw Object.assign(new Error(), { name: 'AbortError' }); } } });
  assert.equal(await cancelled.share({ title: 'Title' }), 'cancelled');
  const tablet = await createTauriPlatform({ ...f.deps, isTablet: true }); assert.equal(tablet.info.formFactor, 'tablet');
});

test('list shows only files this adapter wrote and indexed (a stray half-written file is not "stored")', async () => {
  const f = fixture(); const p = await createTauriPlatform(f.deps);
  await p.files.download('https://example.org/file', 'pictures/full/a.webp');
  f.files.set('/app/data/pictures/full/stray.webp', new Uint8Array([9]));
  assert.deepEqual(await p.files.list('pictures/full'), ['a.webp']);
});
