import test from 'node:test';
import assert from 'node:assert/strict';
import { createPackManager, formatBytes, parseManifest } from '../../src/core/packs.ts';
import type { PackInfo, PackStatus, PacksManifest } from '../../src/core/packs.ts';
import { createWebPlatform } from '../../src/platform/web.ts';
import type { Platform } from '../../src/platform/types.ts';

const digest = '0'.repeat(64);
function manifest(): PacksManifest {
  return { v: 1, version: 'build-1', host: 'https://example.org', packs: [
    { id: 'thumbs', bundled: true, path: 'pictures/thumb', bytes: 3, files: [['a.webp', 3, digest]] },
    { id: 'full', bundled: false, path: 'pictures/full', bytes: 9, files: [['a.webp', 3, digest], ['b.webp', 3, digest], ['c.webp', 3, digest]] },
    { id: 'editions', bundled: true, path: 'data/reader', bytes: 3, files: [['catalogue.json', 3, digest]] },
  ] };
}
function fake(kind: Platform['kind'] = 'web') {
  const stored = new Map<string, Uint8Array>(); const calls: string[] = []; const urls: string[] = []; const attempts = new Map<string, number>();
  const failures = new Set<string>(); const removals: string[] = [];
  let afterDownload: (() => void) | undefined;
  let active = 0; let peak = 0;
  const p: Platform = {
    ...createWebPlatform({ navigator: {} }), kind,
    files: {
      async download(url, dest, progress, signal) {
        if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        calls.push(dest); urls.push(url); attempts.set(dest, (attempts.get(dest) ?? 0) + 1);
        active++; peak = Math.max(peak, active);
        try {
          await Promise.resolve();
          if (failures.has(dest)) throw new Error(`failed ${dest}`);
          progress?.({ loaded: 1, total: 3 }); progress?.({ loaded: 3, total: 3 });
          if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
          stored.set(dest, new Uint8Array([1, 2, 3])); afterDownload?.(); return { bytes: 3 };
        } finally { active--; }
      },
      async exists(dest) { return stored.has(dest); },
      async remove(dest) { removals.push(dest); stored.delete(dest); },
      async list(dir) { return [...stored.keys()].filter(key => key.startsWith(`${dir}/`) && !key.slice(dir.length + 1).includes('/')).map(key => key.slice(dir.length + 1)); },
      async bytesUsed() { return [...stored.values()].reduce((n, b) => n + b.length, 0); },
      async estimate() { return { usage: await this.bytesUsed(), quota: 100 }; },
      url(dest) { return stored.has(dest) ? `asset:${dest}` : null; },
      async read(dest) { return stored.get(dest)!.slice().buffer as ArrayBuffer; },
    },
  };
  return { p, stored, calls, urls, attempts, failures, removals, peak: () => peak, afterDownload(cb: () => void) { afterDownload = cb; } };
}

test('parseManifest validates shape, host, sizes, duplicates and unsafe names', () => {
  assert.deepEqual(parseManifest(manifest()), manifest());
  for (const host of ['http://example.org', 'file:///tmp', 'javascript:alert(1)', 'not a url', 'https://u:p@example.org']) assert.throws(() => parseManifest({ ...manifest(), host }));
  for (const name of ['../escape.webp', 'a/b.webp', 'a\\b.webp', 'a..b.webp', '%2e%2e', 'a?x', '/absolute']) {
    const m = manifest(); m.packs[1]!.files[0]![0] = name; assert.throws(() => parseManifest(m), name);
  }
  for (const value of [null, {}, { ...manifest(), v: 2 }, { ...manifest(), version: 1 }, { ...manifest(), packs: {} }]) assert.throws(() => parseManifest(value));
  const change = (edit: (p: PackInfo) => void) => { const m = manifest(); edit(m.packs[1]!); assert.throws(() => parseManifest(m)); };
  change(p => { p.bytes = -1; }); change(p => { p.bytes = 100; }); change(p => { p.files[0]![2] = 'bad'; });
  change(p => { p.files[0]![1] = 0.5; }); change(p => { p.path = '../pictures'; }); change(p => { p.files.push(p.files[0]!); });
  assert.throws(() => parseManifest({ ...manifest(), packs: [manifest().packs[0], manifest().packs[0]] }));
});

test('formatBytes uses deterministic binary units', () => {
  assert.equal(formatBytes(51234567), '48.9 MiB'); assert.equal(formatBytes(214000000), '204.1 MiB');
  assert.equal(formatBytes(1610612736), '1.50 GiB'); assert.equal(formatBytes(0), '0.0 MiB');
  assert.equal(formatBytes(1024 ** 3, 'ru'), '1.00 GiB');
});

test('complete download aggregates progress, limits concurrency and removes files', async () => {
  const f = fake(); const m = createPackManager({ platform: f.p, manifest: manifest(), concurrency: 2 });
  const updates: PackStatus[] = []; const times: number[] = [];
  assert.equal((await m.status('full')).state, 'absent'); assert.equal(m.info().length, 3);
  const s = await m.download('full', { onProgress(s) { updates.push(s); times.push(Date.now()); } });
  assert.deepEqual(s, { state: 'complete', doneFiles: 3, doneBytes: 9, totalFiles: 3, totalBytes: 9 });
  assert.equal((await m.status('full')).state, 'complete');
  assert.equal(f.peak(), 2); assert.equal(updates.at(-1)?.state, 'complete');
  for (let i = 1; i < times.length - 1; i++) assert.ok(times[i]! - times[i - 1]! >= 100);
  assert.deepEqual(f.urls, ['https://example.org/pictures/full/a.webp', 'https://example.org/pictures/full/b.webp', 'https://example.org/pictures/full/c.webp']);
  assert.deepEqual(await m.usage(), { usedBytes: 9, quotaBytes: 100 });
  await m.remove('full'); assert.equal((await m.status('full')).state, 'absent'); assert.equal(f.stored.size, 0);
});

test('resume skips existing files and a completed second download does no work', async () => {
  const f = fake(); f.stored.set('pictures/full/a.webp', new Uint8Array([1, 2, 3]));
  const m = createPackManager({ platform: f.p, manifest: manifest() });
  assert.deepEqual(await m.status('full'), { state: 'partial', doneFiles: 1, doneBytes: 3, totalFiles: 3, totalBytes: 9 });
  assert.equal((await m.download('full')).state, 'complete'); assert.equal(f.calls.length, 2);
  assert.ok(!f.calls.includes('pictures/full/a.webp'));
  await m.download('full'); assert.equal(f.calls.length, 2);
});

test('abort resolves partial, stops new work and resumes later', async () => {
  const f = fake(); const c = new AbortController(); f.afterDownload(() => c.abort());
  const m = createPackManager({ platform: f.p, manifest: manifest(), concurrency: 1 });
  const s = await m.download('full', { signal: c.signal });
  assert.equal(s.state, 'partial'); assert.equal(s.doneFiles, 1); assert.equal(f.calls.length, 1);
  const already = new AbortController(); already.abort();
  assert.equal((await m.download('full', { signal: already.signal })).state, 'partial'); assert.equal(f.calls.length, 1);
  f.afterDownload(() => {}); assert.equal((await m.download('full')).state, 'complete'); assert.equal(f.calls.length, 3);
});

test('one failing file is tried twice; other files finish before error and retry can recover', async () => {
  const f = fake(); f.failures.add('pictures/full/a.webp');
  const m = createPackManager({ platform: f.p, manifest: manifest(), concurrency: 2 });
  const s = await m.download('full'); assert.equal(s.state, 'error'); assert.equal(s.doneFiles, 2); assert.equal(s.doneBytes, 6);
  assert.match(s.error!, /failed pictures\/full\/a.webp/); assert.equal(f.attempts.get('pictures/full/a.webp'), 2);
  assert.ok(f.stored.has('pictures/full/b.webp')); assert.ok(f.stored.has('pictures/full/c.webp'));
  assert.equal((await m.status('full')).state, 'error'); f.failures.clear();
  assert.equal((await m.download('full')).state, 'complete'); assert.equal(f.attempts.get('pictures/full/b.webp'), 1);
});

test('verify hashes stored bytes; mismatch removes the file on both attempts', async () => {
  const f = fake(); let hashes = 0;
  const m = createPackManager({ platform: f.p, manifest: manifest(), sha256: async b => {
    hashes++; assert.deepEqual([...new Uint8Array(b)], [1, 2, 3]); return 'f'.repeat(64);
  } });
  const s = await m.download('full', { verify: true });
  assert.equal(s.state, 'error'); assert.match(s.error!, /SHA-256 mismatch/);
  assert.equal(f.stored.size, 0); assert.equal(hashes, 6); assert.equal(f.removals.length, 6);
  const good = createPackManager({ platform: f.p, manifest: manifest(), sha256: async () => digest });
  assert.equal((await good.download('full', { verify: true })).state, 'complete');
});

test('default SHA-256 verifies real content without an injected hasher', async () => {
  const f = fake(); const data = manifest();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([1, 2, 3])))].map(n => n.toString(16).padStart(2, '0')).join('');
  for (const file of data.packs[1]!.files) file[2] = digest;
  const m = createPackManager({ platform: f.p, manifest: data });
  assert.equal((await m.download('full', { verify: true })).state, 'complete');
});

test('native bundled packs are no-ops; web bundled packs can be cached', async () => {
  for (const kind of ['tauri', 'capacitor'] as const) {
    const f = fake(kind); const m = createPackManager({ platform: f.p, manifest: manifest() });
    assert.equal((await m.status('thumbs')).state, 'bundled'); assert.equal((await m.download('thumbs')).state, 'bundled');
    await m.remove('thumbs'); assert.equal(f.calls.length, 0); assert.equal(f.removals.length, 0);
  }
  const f = fake(); const m = createPackManager({ platform: f.p, manifest: manifest() });
  assert.equal((await m.status('thumbs')).state, 'absent'); assert.equal((await m.download('thumbs')).state, 'complete');
});

test('localFullUrl only exposes refreshed files and remove invalidates them', async () => {
  const f = fake('tauri'); f.stored.set('pictures/full/a.webp', new Uint8Array([1, 2, 3]));
  const m = createPackManager({ platform: f.p, manifest: manifest() });
  assert.equal(m.localFullUrl('a'), null); await m.refresh(); assert.equal(m.localFullUrl('a'), 'asset:pictures/full/a.webp');
  assert.equal(m.localFullUrl('missing'), null); assert.equal(m.localFullUrl('../a'), null);
  await m.remove('full'); assert.equal(m.localFullUrl('a'), null);
});

test('default concurrency is four and simultaneous calls share a single download', async () => {
  const f = fake(); const data = manifest(); const p = data.packs[1]!;
  p.files.push(['d.webp', 3, digest], ['e.webp', 3, digest]); p.bytes = 15;
  const m = createPackManager({ platform: f.p, manifest: data });
  const first = m.download('full'); const second = m.download('full'); assert.equal(first, second);
  assert.equal((await first).state, 'complete'); assert.equal(f.peak(), 4); assert.equal(f.calls.length, 5);
});
