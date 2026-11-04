import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { galleryShell } from '../../scripts/lib/vite-gallery-surface.mjs';

const want = ['/', '/bible.html', '/scenes.html'];
const hrefs = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].map((m) => m[1]);

test('all gallery pages build desktop and phone bars in Home, Bible, Scenes order', () => {
  for (const file of ['home.html', 'gallery-scenes.html', 'gallery-bible.html']) {
    const html = galleryShell(file);
    for (const cls of ['tab', 'tb']) {
      assert.deepEqual(hrefs(html, new RegExp(`class="${cls}" href="([^" ]+)"`, 'g')), want, `${file} ${cls}`);
      const current = new RegExp(`class="${cls}" href="([^" ]+)" aria-current="page"`).exec(html)?.[1];
      assert.equal(current, { 'home.html': '/', 'gallery-scenes.html': '/scenes.html', 'gallery-bible.html': '/bible.html' }[file]);
    }
  }
});

test('committed root bars and fallback page links keep the same order', () => {
  for (const file of ['index.html', 'scenes.html', 'bible.html']) {
    const html = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    for (const cls of ['tab', 'tb']) assert.deepEqual(hrefs(html, new RegExp(`class="${cls}" href="([^" ]+)"`, 'g')).slice(0, 3), want, `${file} ${cls}`);
  }
  for (const file of ['404.html', 'privacy.html', 'offline.html']) {
    const html = readFileSync(new URL(`../../src/pwa/${file}`, import.meta.url), 'utf8');
    assert.deepEqual(hrefs(html, /<a href="([^" ]+)"><span class="t en">(?:Home|Bible|Scenes)<\/span>/g), want, file);
  }
});
