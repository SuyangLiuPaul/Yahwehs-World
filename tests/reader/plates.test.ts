// Where a plate goes in the text. The rule is pure (src/reader/plates.ts), so it is tested here without a browser,
// and then once through the renderer to prove the markup comes out where the rule says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { placePlates, plateVerses, type ScenePlate } from '../../src/reader/plates.ts';
import { renderBody } from '../../src/reader/render.ts';
import type { BodyModel } from '../../src/reader/render.ts';
import { editionById } from '../../src/reader/books.ts';
import { headings, readJson, text } from './_data.ts';
import type { BookPara } from '../../src/reader/types.ts';

const plate = (id: string, chapter: number, verse: number): ScenePlate => ({
  id, chapter, verse, title: `title ${id}`, href: `/scenes.html#p=${id}`,
  src: `/pictures/thumb/${id}.webp`, w: 800, h: 450,
});

// Genesis 1's three scenes, as public/data/gallery/index.json has them.
const GEN1 = [plate('genesis-1-1', 1, 1), plate('genesis-1-14', 1, 14), plate('genesis-1-26', 1, 26)];
const versesTo = (n: number) => Array.from({ length: n }, (_v, i) => i + 1);

test('verse layout: each plate anchors on its own first verse', () => {
  const a = placePlates({ plates: GEN1, chapter: 1, verses: versesTo(31), mode: 'verse' });
  assert.deepEqual([...a.keys()].sort((x, y) => x - y), [1, 14, 26]);
  assert.equal(a.get(14)![0]!.id, 'genesis-1-14');
  assert.deepEqual(plateVerses(a), [1, 14, 26]);
});

test('parallel layout anchors like verse layout: the plate is drawn once, above the columns', () => {
  const a = placePlates({ plates: GEN1, chapter: 1, verses: versesTo(31), mode: 'parallel' });
  assert.deepEqual([...a.keys()].sort((x, y) => x - y), [1, 14, 26]);
  assert.equal([...a.values()].reduce((n, l) => n + l.length, 0), 3);
});

test('only scenes that START in the displayed chapter are drawn', () => {
  // a scene running Genesis 1:26–2:3 belongs to chapter 1, and must not reappear in chapter 2
  const a = placePlates({ plates: GEN1, chapter: 2, verses: versesTo(25), mode: 'verse' });
  assert.equal(a.size, 0);
});

test('a chapter with no scenes gets no plates, and the map is simply empty', () => {
  const a = placePlates({ plates: [], chapter: 1, verses: versesTo(31), mode: 'verse' });
  assert.equal(a.size, 0);
  assert.deepEqual(plateVerses(a), []);
});

test('a scene starting mid-chapter is placed at that verse, not at the top', () => {
  const a = placePlates({ plates: [plate('psalm-119-97', 119, 97)], chapter: 119, verses: versesTo(176), mode: 'verse' });
  assert.deepEqual([...a.keys()], [97]);
});

test('a scene whose first verse is not on screen gets no plate (a passage shows a slice)', () => {
  const a = placePlates({ plates: GEN1, chapter: 1, verses: [14, 15, 16, 17, 18, 19], mode: 'verse' });
  assert.deepEqual([...a.keys()], [14]); // 1 and 26 are off screen
});

test('two scenes beginning on the same verse both appear, in a stable order', () => {
  const a = placePlates({ plates: [plate('b-2-1', 2, 1), plate('a-2-1', 2, 1)], chapter: 2, verses: versesTo(10), mode: 'verse' });
  assert.deepEqual(a.get(1)!.map((p) => p.id), ['a-2-1', 'b-2-1']);
});

test('paragraph layout: the plate moves to the start of the paragraph holding its verse, never inside it', () => {
  // paragraphs open at 1 and 10; a scene starting at 12 is drawn before the paragraph that begins at 10
  const a = placePlates({
    plates: [plate('x-1-12', 1, 12)], chapter: 1, verses: versesTo(20),
    paraStarts: new Set([1, 10]), mode: 'paragraph',
  });
  assert.deepEqual([...a.keys()], [10]);
});

test('paragraph layout: a heading is a paragraph boundary, so a plate at a heading verse stays on that verse', () => {
  const a = placePlates({
    plates: [plate('x-1-14', 1, 14)], chapter: 1, verses: versesTo(31),
    paraStarts: new Set([1]), headingVerses: new Set([14]), mode: 'paragraph',
  });
  assert.deepEqual([...a.keys()], [14]);
});

test('paragraph layout: a verse before any boundary falls back to the first verse on screen', () => {
  const a = placePlates({
    plates: [plate('x-1-3', 1, 3)], chapter: 1, verses: [2, 3, 4],
    paraStarts: new Set([10]), mode: 'paragraph',
  });
  assert.deepEqual([...a.keys()], [2]);
});

// ── through the renderer ──────────────────────────────────────────────────────

const ed = (id: string) => editionById(id)!;
function model(over: Partial<BodyModel> & { book: number; ids: string[]; chapter: number }): BodyModel {
  const { ids, chapter, ...rest } = over as BodyModel & { ids: string[]; chapter: number };
  const main = ed(ids[0]!);
  return {
    uid: 't', ui: 'en', mode: 'verse', segments: [{ chapter }], editions: ids.map(ed), texts: ids.map((id) => text(id, rest.book)),
    headings: headings(main.headingSet, rest.book), para: readJson<BookPara>(`para/${rest.book}.json`), selected: new Set(), ...rest,
  } as BodyModel;
}

test('the renderer draws a figure per plate, with a caption, a link to the scene and a reserved box', () => {
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['bsb-yhwh'], plates: GEN1 }));
  assert.equal(r.plates, 3);
  assert.equal((r.html.match(/<figure class="yr-plate"/g) ?? []).length, 3);
  assert.match(r.html, /href="\/scenes\.html#p=genesis-1-1"/);
  assert.match(r.html, /alt="title genesis-1-1"/);
  assert.match(r.html, /<figcaption class="yr-plate-cap">title genesis-1-1<\/figcaption>/);
  assert.match(r.html, /width="800" height="450"/);
  assert.match(r.html, /aspect-ratio:800\/450/);
  assert.match(r.html, /loading="lazy"/);
  assert.match(r.html, /aria-label="title genesis-1-1 — open the picture"/);
});

test('the plate comes after its heading and before its first verse, as the old reader drew it', () => {
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['bsb-yhwh'], plates: [plate('genesis-1-1', 1, 1)] }));
  const head = r.html.indexOf('yr-hd');
  const fig = r.html.indexOf('yr-plate');
  const v1 = r.html.indexOf('data-k="1001"');
  assert.ok(head >= 0 && fig > head, 'heading first, then the plate');
  assert.ok(fig < v1, 'the plate stands before the verse it belongs to');
});

test('paragraph layout never puts a figure inside a <p>', () => {
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['bsb-yhwh'], mode: 'paragraph', plates: GEN1 }));
  assert.equal(r.plates, 3);
  // Walk the markup with a tag stack and check no figure ever starts while a verse paragraph is open.
  // The heading's background note is a <p class="yr-ctx"> too, so the stack has to know which <p> is which.
  const token = /<p class="(yr-p|yr-ctx)"|<\/p>|<figure class="yr-plate"/g;
  const stack: string[] = [];
  let seen = 0;
  for (let m = token.exec(r.html); m; m = token.exec(r.html)) {
    if (m[1]) stack.push(m[1]);
    else if (m[0] === '</p>') stack.pop();
    else { seen++; assert.ok(!stack.includes('yr-p'), `figure ${seen} started inside an open paragraph`); }
  }
  assert.equal(seen, 3);
  assert.deepEqual(stack, [], 'a paragraph was left unclosed');
});

test('plate titles and hrefs are escaped like every other piece of text', () => {
  const nasty: ScenePlate = { ...plate('x', 1, 1), title: '<b>x</b> & "y"', href: '/scenes.html#p=<x>' };
  const r = renderBody(model({ book: 1, chapter: 1, ids: ['kjv'], plates: [nasty] }));
  assert.ok(!r.html.includes('<b>x</b> &'));
  assert.match(r.html, /&lt;b&gt;x&lt;\/b&gt; &amp; &quot;y&quot;/);
  assert.match(r.html, /#p=&lt;x&gt;/);
});

test('no plates supplied: the chapter renders exactly as before', () => {
  const a = renderBody(model({ book: 1, chapter: 1, ids: ['bsb-yhwh'] }));
  const b = renderBody(model({ book: 1, chapter: 1, ids: ['bsb-yhwh'], plates: [] }));
  assert.equal(a.plates, 0);
  assert.equal(a.html, b.html);
  assert.ok(!a.html.includes('yr-plate'));
});
