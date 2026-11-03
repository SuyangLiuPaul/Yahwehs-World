// Pure service-worker rules, install metadata and the headers the deployed files receive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUDGETS, MiB, cacheNames, classify, currentCacheNames, isStale, pictureStubId,
  planEviction, reconcile, runtimeCacheOf, shellPage, shouldOfferUpdate, touched, withEntry,
} from '../../src/pwa/core.ts';
import type { Entry, Index, Kind, RequestInfo } from '../../src/pwa/core.ts';
import { platformOf } from '../../src/pwa/platform.ts';
// @ts-expect-error plain ES module without types
import { collectPrecache, ICONS, LANGS, manifestFor, NAME_FULL } from '../../scripts/lib/pwa-build.mjs';
// @ts-expect-error plain ES module without types
import { headersFor, parseNetlifyHeaders } from '../../scripts/lib/dist-server.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const origin = 'https://example.test';
const get: RequestInfo = { method: 'GET', mode: 'no-cors' };
const nav: RequestInfo = { method: 'GET', mode: 'navigate' };
const kind = (path: string, req = get, precache: ReadonlySet<string> = new Set()) =>
  classify(new URL(path, origin), origin, req, precache);

test('POST feedback bypasses the worker', () => {
  assert.equal(kind('/api/feedback', { ...get, method: 'POST' }), 'bypass');
});
test('GET feedback bypasses the worker even as a navigation or precache entry', () => {
  assert.equal(kind('/api/feedback'), 'bypass');
  assert.equal(kind('/api/feedback', nav, new Set(['/api/feedback'])), 'bypass');
});
test('Netlify functions bypass the worker', () => {
  assert.equal(kind('/.netlify/functions/x'), 'bypass');
});
test('Range requests bypass even a normally cached picture', () => {
  assert.equal(kind('/pictures/full/a.webp', { ...get, range: true }), 'bypass');
});
test('another HTTPS host bypasses the worker', () => {
  assert.equal(kind('https://other.test/assets/x-abc.js'), 'bypass');
});
test('Google Fonts CSS is font-css', () => {
  assert.equal(kind('https://fonts.googleapis.com/css2?family=Inter'), 'font-css');
});
test('Google Fonts files are font-file', () => {
  assert.equal(kind('https://fonts.gstatic.com/s/inter/v1/a.woff2'), 'font-file');
});
test('HTTP other-host requests bypass, including font hosts', () => {
  for (const url of ['http://other.test/assets/x.js', 'http://fonts.googleapis.com/css2?family=Inter', 'http://fonts.gstatic.com/s/inter/v1/a.woff2']) {
    assert.equal(kind(url), 'bypass', url);
  }
});
test('the home page is a navigation', () => {
  assert.equal(kind('/', nav), 'navigate');
});
test('the scenes page is a navigation', () => {
  assert.equal(kind('/scenes.html', nav), 'navigate');
});
test('the Bible page is a navigation', () => {
  assert.equal(kind('/bible.html', nav), 'navigate');
});
test('a picture share stub is a navigation', () => {
  assert.equal(kind('/p/genesis-15-1', nav), 'navigate');
});
test('a sitemap navigation bypasses the worker', () => {
  assert.equal(kind('/sitemap.xml', nav), 'bypass');
});
test('a full picture opened as a navigation bypasses the worker', () => {
  assert.equal(kind('/pictures/full/a.webp', nav), 'bypass');
});
test('a full picture requested in no-cors mode is picture', () => {
  assert.equal(kind('/pictures/full/a.webp'), 'picture');
});
test('a thumbnail is thumb', () => {
  assert.equal(kind('/pictures/thumb/a.webp'), 'thumb');
});
test('gallery JSON is data', () => {
  assert.equal(kind('/data/gallery/index.json'), 'data');
});
test('hashed scripts are static', () => {
  assert.equal(kind('/assets/x-abc.js'), 'static');
});
test('PWA icons are static', () => {
  assert.equal(kind('/pwa/icon-192.png'), 'static');
});
test('the brand image is static only when precached', () => {
  assert.equal(kind('/brand-logo.webp', get, new Set(['/brand-logo.webp'])), 'static');
  assert.equal(kind('/brand-logo.webp'), 'bypass');
});
test('the version probe bypasses the worker', () => {
  assert.equal(kind('/version.json'), 'bypass');
});
test('font host exceptions still require GET without Range and a CSS endpoint', () => {
  assert.equal(kind('https://fonts.googleapis.com/not-css'), 'bypass');
  assert.equal(kind('https://fonts.googleapis.com/css2', { ...get, method: 'POST' }), 'bypass');
  assert.equal(kind('https://fonts.gstatic.com/a.woff2', { ...get, range: true }), 'bypass');
});

test('root and index.html use the home shell', () => {
  for (const path of ['/', '/index.html', '/index.html/']) assert.equal(shellPage(path), '/index.html', path);
});
test('scenes and gallery aliases, including trailing slashes, use the scenes shell', () => {
  for (const path of ['/scenes', '/scenes.html', '/gallery', '/pictures']) {
    assert.equal(shellPage(path), '/scenes.html', path);
    assert.equal(shellPage(`${path}/`), '/scenes.html', `${path}/`);
  }
});
test('Bible aliases use the Bible shell', () => {
  for (const path of ['/bible', '/bible.html', '/bible/', '/bible.html/']) assert.equal(shellPage(path), '/bible.html', path);
});
test('a page without a saved shell returns null', () => {
  assert.equal(shellPage('/tabernacle.html'), null);
});
test('picture share IDs survive trailing slash and index.html', () => {
  for (const path of ['/p/genesis-15-1', '/p/genesis-15-1/', '/p/genesis-15-1/index.html']) {
    assert.equal(pictureStubId(path), 'genesis-15-1', path);
  }
});
test('empty or nested picture share paths have no ID', () => {
  assert.equal(pictureStubId('/p/'), null);
  assert.equal(pictureStubId('/p/a/b'), null);
});
test('each request kind selects its runtime cache or has none', () => {
  const cases: [Kind, string | null][] = [
    ['picture', 'pictures'], ['thumb', 'thumbs'], ['data', 'data'], ['font-css', 'fonts'],
    ['font-file', 'fonts'], ['static', null], ['navigate', null], ['bypass', null],
  ];
  for (const [input, expected] of cases) assert.equal(runtimeCacheOf(input), expected, input);
});

const entry = (bytes: number, used: number, stored = used): Entry => ({ bytes, used, stored });
test('eviction removes the least recently used entries first', () => {
  const ix = { '/new': entry(4, 30), '/old': entry(4, 10), '/middle': entry(4, 20) };
  assert.deepEqual(planEviction(ix, 8, 4), ['/old', '/middle']);
});
test('eviction stops as soon as incoming bytes fit', () => {
  assert.deepEqual(planEviction({ '/a': entry(5, 1), '/b': entry(5, 2), '/c': entry(5, 3) }, 12, 2), ['/a']);
});
test('an index that already fits evicts nothing', () => {
  assert.deepEqual(planEviction({ '/a': entry(3, 1) }, 10, 2), []);
});
test('an incoming entry over budget returns null without touching the index', () => {
  const ix = Object.freeze({ '/a': Object.freeze(entry(5, 1)) });
  assert.equal(planEviction(ix, 10, 11), null);
  assert.deepEqual(ix, { '/a': entry(5, 1) });
});
test('keep is never evicted, even when it is the oldest', () => {
  assert.deepEqual(planEviction({ '/keep': entry(5, 0), '/b': entry(5, 1), '/c': entry(5, 2) }, 10, 5, '/keep'), ['/b', '/c']);
});
test('equal last-use times break ties by URL regardless of insertion order', () => {
  assert.deepEqual(planEviction({ '/c': entry(3, 1), '/a': entry(3, 1), '/b': entry(3, 1) }, 6, 3), ['/a', '/b']);
});
test('an exact fit evicts nothing', () => {
  assert.deepEqual(planEviction({ '/a': entry(6, 1) }, 10, 4), []);
});
test('200 seeded indexes fit after evicting a minimal prefix ordered by used and URL', () => {
  let seed = 0x13579bdf;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let trial = 0; trial < 200; trial++) {
    const ix: Index = {};
    const count = next() % 24;
    for (let i = 0; i < count; i++) ix[`/picture-${i}`] = entry(1 + next() % 100, next() % 7);
    const budget = 1 + next() % 800;
    const incoming = next() % (budget + 1);
    const before = structuredClone(ix);
    const evicted = planEviction(ix, budget, incoming);
    assert.notEqual(evicted, null, `trial ${trial}`);
    const order = Object.keys(ix).sort((a, b) => ix[a]!.used - ix[b]!.used || (a < b ? -1 : a > b ? 1 : 0));
    assert.deepEqual(evicted, order.slice(0, evicted!.length), `trial ${trial}: prefix`);
    const removed = new Set(evicted!);
    const remaining = Object.entries(ix).filter(([url]) => !removed.has(url)).reduce((sum, [, e]) => sum + e.bytes, 0);
    assert.ok(remaining + incoming <= budget, `trial ${trial}: budget`);
    if (evicted!.length) assert.ok(remaining + incoming + ix[evicted!.at(-1)!]!.bytes > budget, `trial ${trial}: minimal`);
    assert.deepEqual(ix, before, `trial ${trial}: input unchanged`);
  }
});

test('withEntry replaces an existing URL and keeps unrelated entries unchanged', () => {
  const ix = { '/a': entry(10, 1, 0), '/b': entry(20, 2) };
  const out = withEntry(ix, '/a', 3, 99);
  assert.deepEqual(out, { '/a': entry(3, 99), '/b': entry(20, 2) });
  assert.equal(Object.keys(out).length, 2);
  assert.deepEqual(ix, { '/a': entry(10, 1, 0), '/b': entry(20, 2) });
});
test('withEntry adds a missing URL with both timestamps set to now', () => {
  assert.deepEqual(withEntry({}, '/a', 7, 20), { '/a': entry(7, 20) });
});
test('touched changes only used, preserving stored bytes and other entries', () => {
  const ix = { '/a': entry(10, 3, 1), '/b': entry(20, 2) };
  assert.deepEqual(touched(ix, '/a', 99), { '/a': entry(10, 99, 1), '/b': entry(20, 2) });
  assert.deepEqual(ix, { '/a': entry(10, 3, 1), '/b': entry(20, 2) });
});
test('touching a missing URL leaves the index unchanged', () => {
  const ix = { '/a': entry(1, 2) };
  assert.strictEqual(touched(ix, '/missing', 99), ix);
});
test('exactly the TTL is fresh, and TTL plus one millisecond is stale', () => {
  const e = entry(1, 900, 100);
  assert.equal(isStale(e, 1100, 1000), false);
  assert.equal(isStale(e, 1101, 1000), true);
});
test('a missing entry is stale', () => {
  assert.equal(isStale(undefined, 0, 1000), true);
});
test('reconcile drops missing URLs, sizes new URLs and preserves existing entries', () => {
  const ix = { '/gone': entry(100, 1), '/kept': entry(20, 5, 3) };
  const calls: string[] = [];
  const out = reconcile(ix, ['/kept', '/new-a', '/new-b'], (url) => { calls.push(url); return url === '/new-a' ? 7 : 11; }, 99);
  assert.deepEqual(out, { '/kept': entry(20, 5, 3), '/new-a': entry(7, 99), '/new-b': entry(11, 99) });
  assert.strictEqual(out['/kept'], ix['/kept']);
  assert.deepEqual(calls, ['/new-a', '/new-b']);
  assert.deepEqual(ix, { '/gone': entry(100, 1), '/kept': entry(20, 5, 3) });
});

test('a different waiting build offers an update', () => {
  assert.equal(shouldOfferUpdate('a', 'b'), true);
});
test('the page build already matching the worker offers no update', () => {
  assert.equal(shouldOfferUpdate('a', 'a'), false);
});
test('no waiting build offers no update', () => {
  assert.equal(shouldOfferUpdate('a', null), false);
});
test('cache names include the build shell and six distinct owned caches', () => {
  assert.equal(cacheNames('abc').shell, 'ydh-shell-abc');
  const names = currentCacheNames('abc');
  assert.equal(names.length, 6);
  assert.equal(new Set(names).size, 6);
  assert.ok(names.every((name) => name.startsWith('ydh-')));
  assert.deepEqual(names, Object.values(cacheNames('abc')));
});
test('runtime budgets are 60, 30, 40 and 20 MiB', () => {
  assert.equal(MiB, 1024 * 1024);
  assert.deepEqual(BUDGETS, { pictures: 60 * MiB, thumbs: 30 * MiB, data: 40 * MiB, fonts: 20 * MiB });
});

const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const macSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const platforms = [
  ['iPhone Safari', iphoneSafari, 'iPhone', 5, 'ios', true, false],
  ['iPhone Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/117.0.5938.117 Mobile/15E148 Safari/604.1', 'iPhone', 5, 'ios', true, false],
  ['iPad desktop Safari', macSafari, 'MacIntel', 5, 'ios', true, false],
  ['macOS Safari 17', macSafari, 'MacIntel', 0, 'mac-safari', false, false],
  ['macOS Chrome', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36', 'MacIntel', 0, 'other', false, false],
  ['macOS Firefox', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:117.0) Gecko/20100101 Firefox/117.0', 'MacIntel', 0, 'other', false, false],
  ['Windows Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/117.0.2045.31', 'Win32', 0, 'other', false, false],
  ['Android Chrome', 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36', 'Linux armv8l', 5, 'other', false, false],
  ['iPhone WeChat', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.43(0x18002b2c) NetType/WIFI Language/en', 'iPhone', 5, 'ios', true, true],
] as const;
for (const [name, ua, platform, touches, family, ios, inApp] of platforms) {
  test(`platformOf: ${name}`, () => {
    assert.deepEqual(platformOf(ua, platform, touches), { family, ios, inApp });
  });
}

const shortNames = { en: "Yahweh's World", 'zh-Hans': '雅偉之界', 'zh-Hant': '雅偉之界', ru: 'Мир Яхве' };
test('the four manifest filenames are distinct and start with manifest', () => {
  assert.deepEqual(Object.keys(LANGS).sort(), Object.keys(shortNames).sort());
  const files = Object.values(LANGS).map((lang: { file: string }) => lang.file);
  assert.equal(new Set(files).size, 4);
  for (const file of files) assert.match(file, /^manifest/);
});
for (const key of Object.keys(LANGS) as (keyof typeof shortNames)[]) {
  test(`manifestFor(${key}) carries the exact identity, install settings and real icons`, () => {
    const manifest = manifestFor(key);
    assert.equal(NAME_FULL, "雅偉之界 / Yahweh's World");
    assert.equal(manifest.name, "雅偉之界 / Yahweh's World");
    assert.equal(manifest.lang, key);
    assert.equal(manifest.short_name, shortNames[key]);
    for (const field of ['id', 'start_url', 'scope']) assert.equal(manifest[field], '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, '#0e2b4b');
    assert.equal(manifest.background_color, '#0a1e36');
    assert.deepEqual(manifest.icons, ICONS);
    for (const purpose of ['any', 'maskable']) for (const sizes of ['192x192', '512x512']) {
      assert.ok(manifest.icons.some((icon: { purpose: string; sizes: string }) => icon.purpose === purpose && icon.sizes === sizes), `${purpose} ${sizes}`);
    }
    assert.ok(manifest.icons.some((icon: { purpose: string; sizes: string }) => icon.purpose === 'monochrome' && icon.sizes === '512x512'));
    const existsInPublic = (src: string) => {
      assert.ok(src.startsWith('/pwa/'), src);
      assert.ok(statSync(join(root, 'public', src)).isFile(), src);
    };
    for (const icon of manifest.icons) existsInPublic(icon.src);
    assert.equal(manifest.shortcuts.length, 3);
    assert.deepEqual(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url), ['/', '/scenes.html', '/bible.html']);
    for (const shortcut of manifest.shortcuts) {
      assert.ok(shortcut.icons.some((icon: { sizes: string }) => icon.sizes === '96x96'));
      for (const icon of shortcut.icons) existsInPublic(icon.src);
    }
    assert.ok(Array.isArray(manifest.categories) && manifest.categories.length > 0);
    assert.deepEqual(JSON.parse(JSON.stringify(manifest)), manifest);
  });
}

// All fixture writes stay in this worktree and are removed even if an assertion fails.
function precacheFixture(run: (dist: string) => void) {
  const dist = mkdtempSync(join(root, '.pwa-core-test-'));
  try {
    for (const path of ['index.html', 'scenes.html', 'bible.html', 'offline.html', 'brand-logo.webp', 'favicon.png', 'icon-sm.svg', 'apple-touch-icon.png', 'data/gallery/index.json', 'data/gallery/summaries.json']) {
      const file = join(dist, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, path);
    }
    run(dist);
  } finally { rmSync(dist, { recursive: true, force: true }); }
}
test('collectPrecache sorts paths, hashes bytes and includes only JS and CSS assets', () => {
  precacheFixture((dist) => {
    mkdirSync(join(dist, 'assets'));
    for (const name of ['z.js', 'a.css', 'ignored.png', 'ignored.js.map']) writeFileSync(join(dist, 'assets', name), name);
    mkdirSync(join(dist, 'data/reader'), { recursive: true });
    writeFileSync(join(dist, 'data/reader/catalogue.json'), '{}');
    const { list, bytes } = collectPrecache(dist);
    const paths = list.map(([path]: [string, string]) => path);
    assert.deepEqual(paths, [
      '/apple-touch-icon.png', '/assets/a.css', '/assets/z.js', '/bible.html', '/brand-logo.webp',
      '/data/gallery/index.json', '/data/gallery/summaries.json', '/data/reader/catalogue.json',
      '/favicon.png', '/icon-sm.svg', '/index.html', '/offline.html', '/scenes.html',
    ]);
    let expectedBytes = 0;
    for (const [path, revision] of list) {
      const content = readFileSync(join(dist, path));
      expectedBytes += content.length;
      assert.equal(revision, createHash('sha256').update(content).digest('hex').slice(0, 12), path);
    }
    assert.equal(bytes, expectedBytes);
    assert.deepEqual(collectPrecache(dist), { list, bytes });
    writeFileSync(join(dist, 'assets/z.js'), 'changed');
    assert.notEqual(collectPrecache(dist).list.find(([path]: [string, string]) => path === '/assets/z.js')[1], list.find(([path]: [string, string]) => path === '/assets/z.js')[1]);
  });
});
test('collectPrecache permits an absent optional reader catalogue', () => {
  precacheFixture((dist) => {
    assert.equal(collectPrecache(dist).list.length, 10);
    assert.ok(!collectPrecache(dist).list.some(([path]: [string, string]) => path === '/data/reader/catalogue.json'));
  });
});
test('collectPrecache rejects a missing mandatory shell file', () => {
  precacheFixture((dist) => {
    rmSync(join(dist, 'scenes.html'));
    assert.throws(() => collectPrecache(dist), /pwa: \/scenes\.html is in the precache list but not in/);
  });
});
test('collectPrecache rejects a shell over four MiB', () => {
  precacheFixture((dist) => {
    writeFileSync(join(dist, 'index.html'), Buffer.alloc(4 * MiB));
    assert.throws(() => collectPrecache(dist), /over the 4 MiB limit/);
  });
});

const rules = parseNetlifyHeaders(readFileSync(join(root, 'netlify.toml'), 'utf8'));
test('the worker is never HTTP cached and has a JavaScript content type', () => {
  const headers = headersFor(rules, '/sw.js');
  assert.match(headers['cache-control'], /\bno-cache\b/);
  assert.match(headers['cache-control'], /\bno-store\b/);
  assert.match(headers['content-type'], /^text\/javascript/);
});
test('worker-specific rules preserve the global security headers', () => {
  const headers = headersFor(rules, '/sw.js');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
});
test('default and translated manifests have the manifest JSON content type', () => {
  for (const path of ['/manifest.webmanifest', '/manifest.zh-Hant.webmanifest']) {
    assert.match(headersFor(rules, path)['content-type'], /^application\/manifest\+json/, path);
  }
});
test('hashed JavaScript is immutable for a year', () => {
  assert.equal(headersFor(rules, '/assets/index-abc.js')['cache-control'], 'public, max-age=31536000, immutable');
});
test('index.html and the root revalidate on every request', () => {
  for (const path of ['/index.html', '/']) assert.equal(headersFor(rules, path)['cache-control'], 'public, max-age=0, no-cache', path);
});
test('gallery data must revalidate', () => {
  assert.equal(headersFor(rules, '/data/gallery/index.json')['cache-control'], 'public, max-age=0, must-revalidate');
});
test('the version probe is no-cache', () => {
  assert.equal(headersFor(rules, '/version.json')['cache-control'], 'public, max-age=0, no-cache');
});
test('no API-specific header block sets Cache-Control on feedback responses', () => {
  assert.ok(rules.length > 0, 'the real Netlify header blocks were parsed');
  for (const rule of rules) {
    if (rule.for.includes('/api')) assert.ok(!Object.keys(rule.values).some((key) => key.toLowerCase() === 'cache-control'), rule.for);
  }
  assert.equal(headersFor(rules, '/api/feedback')['cache-control'], undefined);
});
