// Copy: the shape of the text, the credit line, the cap and its notice, parallel copy (ported from Words'
// parallel_copy_test.dart) and the clipboard fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCopy, buildParallelCopy, COPY_VERSE_CAP, copyText, CUT_NOTICE, defaultLink, formatParallelCopy, heading, legacyCopy } from '../../src/reader/copy.ts';
import { editionById } from '../../src/reader/books.ts';
import { text as bookText } from './_data.ts';

const ed = (id: string) => editionById(id)!;
const textOf = (id: string, b: number, c: number) => (v: number) => bookText(id, b)[c - 1]?.[v - 1] ?? null;

test('single edition, English: heading with the edition name, numbered verses, credit, link', () => {
  const r = buildCopy({ book: 1, chapter: 1, verses: [3, 1, 2], text: textOf('bsb-yhwh', 1, 1), edition: ed('bsb-yhwh'), ui: 'en', origin: 'https://example.test' })!;
  const lines = r.text.split('\n');
  assert.equal(lines[0], 'Genesis 1:1–3 (BSB, Yahweh edition)');
  assert.match(lines[1]!, /^1 In the beginning God created/);
  assert.match(lines[3]!, /^3 And God said/);
  assert.equal(lines[4], '');
  assert.equal(lines[5], 'BSB (Yahweh) · Berean Standard Bible, public domain (CC0); the divine name restored as Yahweh.');
  assert.equal(lines[6], '— Yahweh’s World · https://example.test/bible.html#ref=Genesis%201%3A1-3&ed=bsb-yhwh');
  assert.equal(r.count, 3);
  assert.equal(r.cut, false);
  assert.deepEqual(r.ref, { book: 1, chapter: 1, v1: 1, v2: 3 });
});

test('single edition, Chinese: the heading is in the edition’s language with full-width brackets; the credit is the Words wording (© Yahweh De Hua Ministry, used with permission), never public domain, no year', () => {
  const hans = buildCopy({ book: 1, chapter: 1, verses: [1, 2, 3], text: textOf('cuvs-yhwh', 1, 1), edition: ed('cuvs-yhwh'), ui: 'zh-Hans' })!;
  assert.equal(hans.text.split('\n')[0], '创世记 1:1–3（和合本雅伟版）');
  assert.match(hans.text, /\n和合本雅伟版 · © 雅伟的话事工 · 经授权使用。\n/);
  assert.ok(!hans.text.includes('公有'));
  assert.match(hans.text, /\n— 雅伟之界 · https:\/\/world\.yahwehword\.com\/bible\.html#ref=Genesis/);
  assert.ok(!hans.text.includes('1919'));
  const hant = buildCopy({ book: 43, chapter: 3, verses: [16], text: textOf('cuvs-yhwh-tr', 43, 3), edition: ed('cuvs-yhwh-tr'), ui: 'zh-Hant' })!;
  assert.equal(hant.text.split('\n')[0], '約翰福音 3:16（和合本雅偉版）');
  assert.match(hant.text, /和合本雅偉版 · © 雅偉的話事工 · 經授權使用。/);
  assert.ok(!hant.text.includes('公有'));
  assert.match(hant.text, /— 雅偉之界/);
  // a Chinese reader copying the BSB gets an English heading and credit, with the Chinese site line
  const mixed = buildCopy({ book: 43, chapter: 3, verses: [16], text: textOf('kjv', 43, 3), edition: ed('kjv'), ui: 'zh-Hans' })!;
  assert.equal(mixed.text.split('\n')[0], 'John 3:16 (KJV)');
  assert.match(mixed.text, /— 雅伟之界/);
  assert.match(mixed.text, /KJV · King James Version \(1611 \/ 1769 revision\), public domain/);
});

test('the copy text shows the divine name as the reader sees it, and carries no markup', () => {
  const r = buildCopy({ book: 19, chapter: 23, verses: [1], text: textOf('kjv', 19, 23), edition: ed('kjv'), ui: 'en' })!;
  assert.match(r.text, /^Psalms 23:1 \(KJV\)\n1 Yahweh is my shepherd; I shall not want\./);
  const cuv = buildCopy({ book: 1, chapter: 4, verses: [1], text: textOf('cuvs-yhwh', 1, 4), edition: ed('cuvs-yhwh'), ui: 'zh-Hans' })!;
  assert.ok(!/<note|耶和华/.test(cuv.text));
});

test('short passages only: more than the cap is cut, and the copy says so', () => {
  const all = Array.from({ length: 176 }, (_v, i) => i + 1);
  const r = buildCopy({ book: 19, chapter: 119, verses: all, text: textOf('kjv', 19, 119), edition: ed('kjv'), ui: 'en' })!;
  assert.equal(COPY_VERSE_CAP, 100);
  assert.equal(r.count, 100);
  assert.equal(r.cut, true);
  assert.ok(r.text.includes(CUT_NOTICE.en(100)));
  assert.equal(r.text.split('\n')[0], 'Psalms 119:1–100 (KJV)');
  assert.ok(!r.text.includes('\n101 '));
  const small = buildCopy({ book: 19, chapter: 119, verses: all.slice(0, 100), text: textOf('kjv', 19, 119), edition: ed('kjv'), ui: 'en' })!;
  assert.equal(small.cut, false);
  assert.ok(!small.text.includes('limited'));
  const zh = buildCopy({ book: 19, chapter: 119, verses: all, text: textOf('cuvs-yhwh', 19, 119), edition: ed('cuvs-yhwh'), ui: 'zh-Hans' })!;
  assert.ok(zh.text.includes('（复制以 100 节为限，其余未复制。）'));
});

test('a verse the edition does not have is not invented; if none is there, nothing is copied', () => {
  // Matthew 17:21 is not in the BSB
  const r = buildCopy({ book: 40, chapter: 17, verses: [20, 21, 22], text: textOf('bsb-yhwh', 40, 17), edition: ed('bsb-yhwh'), ui: 'en' })!;
  assert.equal(r.count, 2);
  assert.ok(!/\n21 /.test(r.text));
  assert.equal(r.text.split('\n')[0], 'Matthew 17:20, 22 (BSB, Yahweh edition)');
  assert.equal(buildCopy({ book: 40, chapter: 17, verses: [21], text: textOf('bsb-yhwh', 40, 17), edition: ed('bsb-yhwh'), ui: 'en' }), null);
});

test('heading and link helpers', () => {
  assert.equal(heading(1, 1, [1, 2, 3, 5], ed('kjv')), 'Genesis 1:1–3, 5 (KJV)');
  assert.equal(defaultLink({ book: 62, chapter: 1, v1: 1 }, 'kjv', 'https://x.test'), 'https://x.test/bible.html#ref=1%20John%201%3A1&ed=kjv');
});

// ── parallel (ported from Words' parallel_copy_test.dart) ────────────────────
const zh = [
  { label: '雅伟版', fullName: '和合本雅伟版' },
  { label: '梁简', fullName: '梁家铿译本' },
  { label: '网简', fullName: '中文英王钦定本' },
];
const rows = [
  { ref: '8:5', texts: ['他们供奉的事本是天上事的形状和影像', '不过，那些祭司的侍奉', '这些祭司供奉之处'] },
  { ref: '8:6', texts: ['如今耶稣所得的职任是更美的', '但现在耶稣任命的侍奉是更尊贵', '但如今耶稣所得的职任是更超越的'] },
];

test('parallel, verse by verse: labels lined up with ideographic spaces (the owner’s example)', () => {
  assert.equal(formatParallelCopy({ heading: '希伯来书 8:5–6', editions: zh, rows }),
    '希伯来书 8:5–6\n' +
    '\n8:5\n' +
    '雅伟版　他们供奉的事本是天上事的形状和影像\n' +
    '梁简　　不过，那些祭司的侍奉\n' +
    '网简　　这些祭司供奉之处\n' +
    '\n8:6\n' +
    '雅伟版　如今耶稣所得的职任是更美的\n' +
    '梁简　　但现在耶稣任命的侍奉是更尊贵\n' +
    '网简　　但如今耶稣所得的职任是更超越的');
});

test('parallel: by edition, main only, English padding, a gap is left out, credits once', () => {
  const t = formatParallelCopy({ heading: '希伯来书 8:5–6', editions: zh, rows, layout: 'byEdition' });
  assert.ok(t.startsWith('希伯来书 8:5–6\n\n和合本雅伟版\n8:5 他们供奉'));
  assert.ok(t.includes('\n\n梁家铿译本\n8:5 不过'));
  assert.ok(t.endsWith('8:6 但如今耶稣所得的职任是更超越的'));
  assert.equal(formatParallelCopy({ heading: '希伯来书 8:5–6', editions: zh, rows, layout: 'mainOnly' }), '希伯来书 8:5–6\n\n8:5\n他们供奉的事本是天上事的形状和影像\n\n8:6\n如今耶稣所得的职任是更美的');
  const en = ['BSB-Y', 'KJV', 'LEB', 'NET', 'ASV-Y'].map((l) => ({ label: l, fullName: l }));
  assert.equal(formatParallelCopy({ heading: 'Hebrews 8:5', editions: en, rows: [{ ref: '8:5', texts: ['a', 'b', null, 'd', 'e'] }] }), 'Hebrews 8:5\n\n8:5\nBSB-Y  a\nKJV    b\nNET    d\nASV-Y  e');
  const lic = [{ label: 'A', fullName: 'A' }, { label: 'B', fullName: 'B', credit: 'B credit line.' }];
  const c = formatParallelCopy({ heading: 'X', editions: lic, rows: [{ ref: '1:1', texts: ['x', 'y'] }, { ref: '1:2', texts: ['x2', 'y2'] }] });
  assert.ok(c.endsWith('\n\nB credit line.'));
  assert.equal(c.split('B credit line.').length - 1, 1);
});

test('parallel copy of real verses: three editions, an omitted verse is a missing line not a shifted one, every credit once', () => {
  const eds = ['kjv', 'bsb-yhwh', 'cuvs-yhwh'].map(ed);
  const cell = (v: number, k: number) => bookText(eds[k]!.id, 40)[16]?.[v - 1] ?? null;
  const r = buildParallelCopy({ book: 40, chapter: 17, verses: [20, 21], editions: eds, cell, ui: 'en', origin: 'https://x.test' })!;
  const lines = r.text.split('\n');
  assert.equal(lines[0], 'Matthew 17:20–21');
  const v21 = r.text.slice(r.text.indexOf('17:21'));
  assert.match(v21, /KJV\s+Howbeit this kind/);
  assert.ok(!/BSB-Y\s+Howbeit/.test(v21), 'the BSB has no verse 21');
  assert.match(r.text, /雅伟版/);
  for (const e of eds) assert.equal(r.text.split(e.credit[e.language]).length - 1, 1, e.id);
  assert.match(r.text, /— Yahweh’s World/);
  assert.equal(r.count, 2);
});

// ── clipboard ────────────────────────────────────────────────────────────
function fakeDoc(execResult: boolean | 'throw') {
  const log: string[] = [];
  const ta: Record<string, unknown> = { style: {}, setAttribute() {}, focus() { log.push('focus'); }, select() { log.push('select'); }, setSelectionRange() {}, remove() { log.push('remove'); } };
  const doc = {
    activeElement: { focus() { log.push('restore'); } },
    createElement: () => ta,
    body: { appendChild() { log.push('append'); } },
    execCommand: (c: string) => { log.push(c); if (execResult === 'throw') throw new Error('no'); return execResult; },
  };
  return { doc: doc as unknown as Document, log };
}

test('clipboard: the async API when it works', async () => {
  let got = '';
  const out = await copyText('hello', { nav: { clipboard: { writeText: async (s: string) => { got = s; } } as Clipboard } });
  assert.equal(out, 'ok');
  assert.equal(got, 'hello');
});

test('clipboard: when Safari rejects the async API, the legacy path is used (and reported)', async () => {
  const { doc, log } = fakeDoc(true);
  const out = await copyText('hello', { doc, nav: { clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } as unknown as Clipboard } });
  assert.equal(out, 'fallback');
  assert.deepEqual(log, ['append', 'focus', 'select', 'copy', 'remove', 'restore']);
});

test('clipboard: no async API at all falls to the legacy path; a failing legacy path is reported, never thrown', async () => {
  assert.equal(await copyText('x', { doc: fakeDoc(true).doc, nav: {} as Navigator }), 'fallback');
  assert.equal(await copyText('x', { doc: fakeDoc(false).doc, nav: {} as Navigator }), 'failed');
  assert.equal(await copyText('x', { doc: fakeDoc('throw').doc, nav: { clipboard: { writeText: async () => { throw new Error('x'); } } as unknown as Clipboard } }), 'failed');
  assert.equal(legacyCopy('x', undefined), false);
});

test('Russian: heading in Synodal names with ASCII brackets, the Russian credit, the Russian site line and cut notice', () => {
  const r = buildCopy({ book: 43, chapter: 3, verses: [16], text: textOf('rst-yhwh', 43, 3), edition: ed('rst-yhwh'), ui: 'ru' })!;
  const lines = r.text.split('\n');
  assert.equal(lines[0], 'От Иоанна 3:16 (Синодальный перевод, издание Яхве)');
  assert.equal(lines[3], 'СП (Яхве) · Синодальный перевод (1876), общественное достояние; имя Божие восстановлено как Яхве по еврейскому тексту (Yahweh’s Words).');
  assert.match(lines[4]!, /^— Мир Яхве · https:\/\/world\.yahwehword\.com\/bible\.html#ref=John/);
  const long = buildCopy({ book: 19, chapter: 119, verses: Array.from({ length: 176 }, (_v, i) => i + 1), text: textOf('rst', 19, 119), edition: ed('rst'), ui: 'ru' })!;
  assert.ok(long.text.includes('(Копирование ограничено 100 стихами; остальное не скопировано.)'));
});

test('a passage that crosses a chapter: one heading from the first verse to the last, chapter-numbered lines, a link to the first chapter', () => {
  const r = buildCopy({ book: 1, verses: [15020, 15021, 16001, 16002], text: (v, c) => bookText('kjv', 1)[c - 1]?.[v - 1] ?? null, edition: ed('kjv'), ui: 'en', origin: 'https://x.test' })!;
  const lines = r.text.split('\n');
  assert.equal(lines[0], 'Genesis 15:20\u201316:2 (KJV)');
  assert.match(lines[1]!, /^15:20 /);
  assert.match(lines[3]!, /^16:1 Now Sarai/);
  assert.equal(r.count, 4);
  assert.deepEqual(r.ref, { book: 1, chapter: 15, v1: 20, v2: undefined });
  assert.ok(r.text.endsWith('https://x.test/bible.html#ref=Genesis%2015%3A20&ed=kjv'));
});
