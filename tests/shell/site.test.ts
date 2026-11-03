import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE_HOST, apiBase, channelOf, fullPictureHost, publicUrl, targetOf, thumbPictureHost } from '../../src/config/site.ts';

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
