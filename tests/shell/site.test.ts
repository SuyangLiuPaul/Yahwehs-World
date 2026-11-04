import test from 'node:test';
import assert from 'node:assert/strict';
import { NAME_ZH, PRODUCT, SITE_HOST, nameZh, apiBase, channelOf, fullPictureHost, productName, publicUrl, shortLabel, targetOf, thumbPictureHost } from '../../src/config/site.ts';

test('the website build keeps its own origin for pictures and the API', () => {
  assert.equal(targetOf({}), 'web');
  assert.equal(fullPictureHost({}), '');
  assert.equal(thumbPictureHost({}), '');
  assert.equal(apiBase({}), '');
  assert.equal(channelOf({}), 'web');
  assert.equal(fullPictureHost({ VITE_SCENES_HOST: 'https://cdn.example' }), 'https://cdn.example');
  assert.equal(thumbPictureHost({ VITE_SCENES_HOST: 'https://cdn.example' }), 'https://cdn.example');
});

test('the shell build bundles thumbnails and fetches full pictures and the API from the one site host', () => {
  const env = { VITE_TARGET: 'shell' };
  assert.equal(targetOf(env), 'shell');
  assert.equal(thumbPictureHost(env), '');
  assert.equal(fullPictureHost(env), SITE_HOST);
  assert.equal(fullPictureHost({ ...env, VITE_SCENES_HOST: 'https://cdn.example' }), SITE_HOST, 'a stray web override never redirects the shell');
  assert.equal(apiBase(env), SITE_HOST);
});

test('channel: a shell build is direct unless it says store; the web is never a channel of its own', () => {
  assert.equal(channelOf({ VITE_TARGET: 'shell' }), 'direct');
  assert.equal(channelOf({ VITE_TARGET: 'shell', VITE_SHELL_CHANNEL: 'store' }), 'store');
  assert.equal(channelOf({ VITE_SHELL_CHANNEL: 'store' }), 'web');
});

test('publicUrl is always on the site host', () => {
  assert.equal(publicUrl('/scenes.html', '#p=genesis-1-1'), `${SITE_HOST}/scenes.html#p=genesis-1-1`);
});

test('the Chinese product name is Simplified only for a 简体 page', () => {
  assert.equal(nameZh('zh-Hans'), NAME_ZH.hans);
  for (const lang of ['en', 'ru', 'zh-Hant', '']) assert.equal(nameZh(lang), NAME_ZH.hant);
  assert.equal(NAME_ZH.hant, '雅偉之界');
  assert.equal(NAME_ZH.hans, '雅伟之界');
});

// THE NAME FOLLOWS THE LANGUAGE (owner, 2026-11-04, on TestFlight build 3): an English or Russian reader must never be
// shown the Chinese name. Same rule as Words, whose Russian build also keeps the Latin "Yahweh's Words".
test('the product name a page prints is the name of that page\'s language', () => {
  assert.equal(productName('en'), "Yahweh's World");
  assert.equal(productName('ru'), "Yahweh's World");
  assert.equal(productName('zh-Hans'), '雅伟之界');
  assert.equal(productName('zh-Hant'), '雅偉之界');
  assert.equal(productName(''), "Yahweh's World");          // no language yet: the Latin name, not Chinese
  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  for (const lang of ['en', 'ru', 'en-GB', 'ru-RU', '']) assert.ok(!CJK.test(productName(lang)), `${lang} got CJK: ${productName(lang)}`);
  for (const lang of ['zh-Hans', 'zh-Hant']) assert.ok(CJK.test(productName(lang)));
});

test("the label under the icon is the short one, and Russian's is Мир", () => {
  assert.equal(shortLabel('en'), 'World');
  assert.equal(shortLabel('ru'), 'Мир');
  assert.equal(shortLabel('zh-Hans'), '雅伟之界');
  assert.equal(shortLabel('zh-Hant'), '雅偉之界');
  assert.equal(shortLabel(''), PRODUCT.en);
  // ...and it is NOT the wordmark: a launcher truncates at about eleven characters.
  assert.notEqual(shortLabel('en'), PRODUCT.wordmark);
});
