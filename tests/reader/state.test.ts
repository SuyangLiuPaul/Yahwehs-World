// Preferences, the hash route, and the data store (retry, timeout, no remembered failures, named errors).
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPrefs, loadPrefs, PREFS_KEY, sanitizePrefs, savePrefs } from '../../src/reader/prefs.ts';
import { canonicalRef, formatHash, parseHash } from '../../src/reader/route.ts';
import { DataStore, LoadError } from '../../src/reader/store.ts';
import { t, STRINGS } from '../../src/reader/strings.ts';

test('prefs: garbage in, defaults out; unknown editions, sizes and modes are dropped', () => {
  assert.deepEqual(sanitizePrefs(null), defaultPrefs());
  assert.deepEqual(sanitizePrefs('x'), defaultPrefs());
  const p = sanitizePrefs({ edition: { en: 'kjv', 'zh-Hans': 'niv-online', ru: 'rst' }, mode: 'sideways', parallel: ['kjv', 'kjv', 'bogus', 'asv-yhwh', 'web-yhwh', 'bsb-yhwh'], size: 7, theme: 'pink', recent: ['1:1', 'x', '19:119'] });
  assert.deepEqual(p.edition, { en: 'kjv' });
  assert.equal(p.mode, 'verse');
  assert.deepEqual(p.parallel, ['kjv', 'asv-yhwh', 'web-yhwh']);
  assert.equal(p.size, 1);
  assert.equal(p.theme, 'auto');
  assert.deepEqual(p.recent, ['1:1', '19:119']);
});

test('prefs: storage that throws, or is missing, never throws out of the reader', () => {
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadPrefs(boom), defaultPrefs());
  assert.equal(savePrefs(boom, defaultPrefs()), false);
  assert.deepEqual(loadPrefs(null), defaultPrefs());
  assert.equal(savePrefs(undefined, defaultPrefs()), false);
  const mem = new Map<string, string>();
  const ok = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  const p = { ...defaultPrefs(), mode: 'parallel' as const, parallel: ['kjv', 'cuvs-yhwh'], size: 1.25 };
  assert.equal(savePrefs(ok, p), true);
  assert.ok(mem.has(PREFS_KEY));
  assert.deepEqual(loadPrefs(ok), p);
  mem.set(PREFS_KEY, '{not json');
  assert.deepEqual(loadPrefs(ok), defaultPrefs());
});

test('route: every form of deep link round-trips', () => {
  const r = parseHash('#ref=Genesis 15:5-6&ed=kjv&lang=zh-Hant&par=kjv,cuvs-yhwh&m=parallel');
  assert.deepEqual(r, { ref: { book: 1, chapter: 15, v1: 5, v2: 6 }, ed: 'kjv', lang: 'zh-Hant', par: ['kjv', 'cuvs-yhwh'], mode: 'parallel' });
  assert.deepEqual(parseHash('#ref=Exodus%2025%3A10'), { ref: { book: 2, chapter: 25, v1: 10 } });
  assert.deepEqual(parseHash('#ref=Exodus 25:10'), { ref: { book: 2, chapter: 25, v1: 10 } });
  assert.deepEqual(parseHash('#ref=约 3:16&ed=cuvs-yhwh'), { ref: { book: 43, chapter: 3, v1: 16 }, ed: 'cuvs-yhwh' });
  assert.deepEqual(parseHash(''), {});
  assert.deepEqual(parseHash('#ed=niv&ref=nonsense&lang=fr&m=x&par=nope'), {}, 'nothing invalid gets through');
  assert.deepEqual(parseHash('#p=genesis-15-1'), {}, 'a hash that is not ours is left alone');
  assert.equal(formatHash({ ref: { book: 1, chapter: 15, v1: 5, v2: 6 }, ed: 'kjv', par: ['kjv', 'cuvs-yhwh'], mode: 'parallel' }), '#ref=Genesis%2015%3A5-6&ed=kjv&par=kjv,cuvs-yhwh&m=parallel');
  assert.deepEqual(parseHash(formatHash({ ref: { book: 19, chapter: 119 }, ed: 'asv-yhwh', lang: 'en' })), { ref: { book: 19, chapter: 119 }, ed: 'asv-yhwh', lang: 'en' });
  assert.equal(canonicalRef({ book: 62, chapter: 1 }), '1 John 1');
});

// ── store ────────────────────────────────────────────────────────────────
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test('store: a book is fetched once and served from memory', async () => {
  let calls = 0;
  const s = new DataStore({ persist: false, fetch: async () => { calls++; return json([['a']]); } });
  const [a, b] = await Promise.all([s.text('kjv', 1), s.text('kjv', 1)]);
  assert.deepEqual(a, [['a']]);
  assert.equal(a, b);
  await s.text('kjv', 1);
  assert.equal(calls, 1);
  assert.deepEqual(s.peekText('kjv', 1), [['a']]);
  assert.equal(s.peekText('kjv', 2), undefined);
});

test('store: a failed fetch is retried once, and never remembered', async () => {
  let calls = 0;
  const s = new DataStore({ persist: false, attempts: 2, fetch: async () => { calls++; if (calls < 3) throw new TypeError('Failed to fetch'); return json([['ok']]); } });
  await assert.rejects(s.text('kjv', 1), (e: unknown) => e instanceof LoadError && e.kind === 'offline');
  assert.equal(calls, 2);
  assert.deepEqual(await s.text('kjv', 1), [['ok']], 'the next ask tries again');
});

test('store: 404 is not retried; a 500 is; both say http', async () => {
  let calls = 0;
  const s404 = new DataStore({ persist: false, fetch: async () => { calls++; return json({}, 404); } });
  await assert.rejects(s404.para(1), (e: unknown) => e instanceof LoadError && e.kind === 'http');
  assert.equal(calls, 1);
  calls = 0;
  const s500 = new DataStore({ persist: false, fetch: async () => { calls++; return json({}, 500); } });
  await assert.rejects(s500.para(1), (e: unknown) => e instanceof LoadError && e.kind === 'http');
  assert.equal(calls, 2);
});

test('store: a hung request times out instead of waiting for ever', async () => {
  const s = new DataStore({ persist: false, timeoutMs: 30, attempts: 1, fetch: (_u, init) => new Promise((_res, rej) => { init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))); }) });
  const t0 = Date.now();
  await assert.rejects(s.text('kjv', 1), (e: unknown) => e instanceof LoadError && e.kind === 'timeout');
  assert.ok(Date.now() - t0 < 1000);
});

test('store: a body that is not JSON says parse, and is not retried', async () => {
  let calls = 0;
  const s = new DataStore({ persist: false, fetch: async () => { calls++; return new Response('<html>', { status: 200 }); } });
  await assert.rejects(s.headings('cuv', 1), (e: unknown) => e instanceof LoadError && e.kind === 'parse');
  assert.equal(calls, 1);
});

test('strings: every key has all three languages; placeholders survive; overrides win', () => {
  for (const [k, row] of Object.entries(STRINGS)) {
    for (const l of ['en', 'zh-Hans', 'zh-Hant'] as const) {
      assert.ok(row[l]?.length, `${k} ${l}`);
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      assert.equal(ph(row[l]), ph(row.en), `${k} ${l} placeholders`);
    }
  }
  assert.equal(t('chapterN', 'zh-Hans', { n: 3 }), '第 3 章');
  assert.equal(t('chapterN', 'en', { n: 3 }), 'Chapter 3');
  assert.equal(t('copy', 'en', undefined, { copy: 'نسخ' }), 'نسخ');
});

test('strings: nothing Chinese in the English column, and the Chinese columns hold no Latin sentences', () => {
  for (const [k, row] of Object.entries(STRINGS)) {
    assert.ok(!/[一-鿿]/.test(row.en), `${k} en`);
    for (const l of ['zh-Hans', 'zh-Hant'] as const) {
      const stripped = row[l].replace(/\{\w+\}/g, '').replace(/CC0|English|·/g, '');
      assert.ok(!/[A-Za-z]{3,}/.test(stripped), `${k} ${l}: ${row[l]}`);
    }
  }
});
