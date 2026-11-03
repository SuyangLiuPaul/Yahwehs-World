// The renderer is pure, so its layout rules are tested here without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBody, renderCredit } from '../../src/reader/render.ts';
import type { BodyModel } from '../../src/reader/render.ts';
import { editionById } from '../../src/reader/books.ts';
import { headings, readJson, text } from './_data.ts';
import type { BookPara } from '../../src/reader/types.ts';

const ed = (id: string) => editionById(id)!;
function model(over: Partial<BodyModel> & { book: number; ids: string[]; chapter: number }): BodyModel {
  const { ids, chapter, ...rest } = over as BodyModel & { ids: string[]; chapter: number };
  const main = ed(ids[0]!);
  return {
    uid: 't', ui: 'en', mode: 'verse', segments: [{ chapter }], editions: ids.map(ed), texts: ids.map((id) => text(id, rest.book)),
    headings: headings(main.headingSet, rest.book), para: readJson<BookPara>(`para/${rest.book}.json`), selected: new Set(), ...rest,
  } as BodyModel;
}
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('verse mode: one .yr-v per verse with a numbered button, the heading before its first verse', () => {
  const r = renderBody(model({ book: 1, chapter: 15, ids: ['bsb-yhwh'] }));
  assert.equal(r.shown, 21);
  assert.equal(count(r.html, /class="yr-v[ "]/g), 21);
  assert.equal(count(r.html, /class="yr-vn"/g), 21);
  assert.match(r.html, /<h3 class="yr-h"[^>]*>God’s Covenant with Abram<\/h3>/);
  assert.ok(r.html.indexOf('yr-hd') < r.html.indexOf('data-k="15001"'));
  assert.match(r.html, /aria-label="Select verse 1"/);
});

test('every piece of text is escaped: no raw < from a note or a heading reaches the markup', () => {
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['cuvs-yhwh'], ui: 'zh-Hans', headings: { '1': [{ v: 1, t: '<b>x</b>', c: 'a & b' }] } }));
  assert.ok(!r.html.includes('<b>x'));
  assert.match(r.html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(r.html, /a &amp; b/);
});

test('selection and deep-link marks are classes and aria-pressed, and only on the verses named', () => {
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['kjv'], selected: new Set([1002]), highlight: new Set([1003, 1004]) }));
  assert.equal(count(r.html, /is-sel/g), 1);
  assert.equal(count(r.html, /is-hl/g), 2);
  assert.equal(count(r.html, /aria-pressed="true"/g), 1);
});

test('paragraph mode: paragraph starts from the data, headings break paragraphs, numbers inline', () => {
  const para = readJson<BookPara>('para/1.json');
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['bsb-yhwh'], mode: 'paragraph' }));
  const starts = new Set(para['1']);
  assert.equal(count(r.html, /<p class="yr-p"/g) >= starts.size, true);
  assert.equal(count(r.html, /class="yr-v"/g) + count(r.html, /class="yr-v is-/g), 31);
  assert.ok(!r.html.includes('<p class="yr-v'));
});

test('parallel mode: lines per edition in set order, labels, language on every line, a dash for an omitted verse', () => {
  const r = renderBody(model({ book: 40, chapter: 17, ids: ['kjv', 'bsb-yhwh', 'cuvs-yhwh'], mode: 'parallel' }));
  const v21 = r.html.slice(r.html.indexOf('data-k="17021"'), r.html.indexOf('data-k="17022"'));
  assert.equal(count(v21, /class="yr-line/g), 3);
  assert.equal(count(v21, /is-gap/g), 1);
  assert.ok(v21.indexOf('data-ed="kjv"') < v21.indexOf('data-ed="bsb-yhwh"') && v21.indexOf('data-ed="bsb-yhwh"') < v21.indexOf('data-ed="cuvs-yhwh"'));
  assert.match(v21, /lang="zh-Hans"/);
  assert.match(v21, /aria-label="not in this edition"/);
  assert.equal(r.shown, 27);
});

test('parallel with a single edition reads as verse mode', () => {
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['kjv'], mode: 'parallel' }));
  assert.ok(!r.html.includes('yr-pv'));
});

test('a passage: limit cuts the run, total says how many are left, expanded shows all; the carried heading appears when the range starts inside a section', () => {
  const m = model({ book: 1, chapter: 15, ids: ['bsb-yhwh'], segments: [{ chapter: 15, v1: 5, v2: 21 }], limit: 5 });
  const r = renderBody(m);
  assert.deepEqual([r.shown, r.total], [5, 17]);
  assert.match(r.html, /is-carried/);
  assert.equal(renderBody({ ...m, expanded: true }).shown, 17);
});

test('a passage across two chapters labels each chapter and counts the limit across them', () => {
  const m = model({ book: 1, chapter: 15, ids: ['kjv'], segments: [{ chapter: 15, v1: 19 }, { chapter: 16, v2: 3 }], limit: 12 });
  const r = renderBody(m);
  assert.deepEqual(r.keys, [15019, 15020, 15021, 16001, 16002, 16003]);
  assert.equal(count(r.html, /class="yr-ch"/g), 2);
  assert.match(r.html, /Chapter 15/);
  assert.match(renderBody({ ...m, ui: 'ru' }).html, /Глава 16/);
});

test('footnotes: the marker is a button with aria-expanded and its note follows, hidden', () => {
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['cuvs-yhwh'], ui: 'zh-Hans' }));
  assert.match(r.html, /<button type="button" class="yr-fn" aria-expanded="false" aria-controls="t-n1020-cuvs-yhwh-1" aria-label="注 1">/);
  assert.match(r.html, /<span class="yr-note" id="t-n1020-cuvs-yhwh-1" role="note" hidden>/);
});

test('the credit block lists one line per edition, in its own language', () => {
  const h = renderCredit([ed('kjv'), ed('cuvs-yhwh'), ed('rst')], 'en');
  assert.equal(count(h, /<li /g), 3);
  assert.match(h, /lang="zh-Hans">和合本雅伟版 · © 雅伟的话事工 · 经授权使用/);
  assert.match(h, /lang="ru">СП · Синодальный перевод \(1876\), общественное достояние/);
});
