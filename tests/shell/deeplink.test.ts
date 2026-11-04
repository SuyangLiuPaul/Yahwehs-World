import test from 'node:test';
import assert from 'node:assert/strict';
import { routeForDeepLink } from '../../src/shell/deeplink.ts';

test('a shared picture link opens the picture page, with a language fragment kept', () => {
  assert.deepEqual(routeForDeepLink('https://world.yahwehword.com/p/genesis-15-1'), { kind: 'page', href: '/scenes.html#p=genesis-15-1' });
  assert.deepEqual(routeForDeepLink('https://world.yahwehword.com/p/genesis-15-1/#lang=ru'), { kind: 'page', href: '/scenes.html#p=genesis-15-1&lang=ru' });
});

test('the website pages open as themselves', () => {
  assert.deepEqual(routeForDeepLink('https://world.yahwehword.com/'), { kind: 'page', href: '/' });
  assert.deepEqual(routeForDeepLink('https://world.yahwehword.com/bible.html#ref=Psalm-23'), { kind: 'page', href: '/bible.html#ref=Psalm-23' });
  assert.deepEqual(routeForDeepLink('https://world.yahwehword.com/index.html'), { kind: 'page', href: '/' });
});

test('the custom scheme opens a picture or the offline sheet', () => {
  assert.deepEqual(routeForDeepLink('yahwehsworld://p/psalms-23-1'), { kind: 'page', href: '/scenes.html#p=psalms-23-1' });
  // The offline-pictures sheet was a stub and is gone (src/shell/boot.ts), so its link is an unknown link now and
  // must be IGNORED rather than navigating the window somewhere.
  assert.equal(routeForDeepLink('yahwehsworld://packs'), null);
  assert.equal(routeForDeepLink('yahwehsworld://packs/'), null);
});

test('anything else is ignored: other hosts, other schemes, odd ids, traversal', () => {
  for (const bad of [
    'https://evil.example/p/genesis-1-1', 'http://world.yahwehword.com/p/genesis-1-1', 'https://world.yahwehword.com.evil.example/p/x',
    'https://world.yahwehword.com/p/../../etc', 'https://world.yahwehword.com/p/a%2Fb', 'https://world.yahwehword.com/globe.html',
    'yahwehsworld://p/', 'yahwehsworld://p/Bad_Id', 'yahwehsworld://other', 'javascript:alert(1)', 'file:///etc/passwd', 'not a url', '',
  ]) assert.equal(routeForDeepLink(bad), null, bad);
});
