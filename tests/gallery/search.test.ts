import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, searchIndex } from '../../src/gallery/search-index.ts';
import type { GalleryIndex, Scene } from '../../src/gallery/data.ts';

const scenes = Array.from({ length: 16 }, (_, i): Scene => ({ id: `scene-${i}`, i, b: 1, s: 1001001, e: 1001009,
  zh: '创造世界', en: 'Creation of the world', ru: 'Сотворение мира', q: '', ok: true }));
const ix = { scenes } as GalleryIndex;
const sums = { zh: scenes.map(() => '起初'), en: scenes.map(() => 'beginning'), ru: scenes.map(() => 'начало') };
let conversions = 0;
const index = buildSearchIndex(ix, sums, (_b, l) => ({ zh: '创世记', en: 'Genesis', ru: 'Бытие' }[l]), (s) => { conversions++; return s.replace('创造', '創造'); });
for (const q of ['creation', '创造', '創造', 'Сотворение', 'GENESIS beginning', 'Бытие начало', '创世记 起初']) {
  test(`search matches ${q} in canonical order with a 12-row cap`, () => {
    const before = conversions;
    assert.deepEqual(searchIndex(index, q).map((s) => s.i), Array.from({ length: 12 }, (_, i) => i));
    assert.equal(conversions, before, 'keystrokes never reconvert text');
  });
}
test('all terms required, blank and unmatched queries empty', () => {
  for (const q of ['', '   ', 'world nonexistent']) assert.deepEqual(searchIndex(index, q), []);
});
test('title matches outrank book and summary matches; ties use scene index', () => {
  const rows = [
    { scene: scenes[2]!, title: 'hit', book: '', body: '' },
    { scene: scenes[1]!, title: '', book: 'hit', body: '' },
    { scene: scenes[0]!, title: '', book: '', body: 'hit' },
  ];
  assert.deepEqual(searchIndex(rows, 'hit').map((s) => s.i), [2, 1, 0]);
});
