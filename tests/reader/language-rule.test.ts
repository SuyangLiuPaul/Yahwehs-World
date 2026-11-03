// The language rule and the reference parser: ported from Words' test/language_rule_test.dart
// (ui resolver, edition names the book, ui names it when no edition is given, ranges not narrowed)
// and reference_parser's documented inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bookName, cnNumber, formatVerseRange, labelLanguage, matchUiTag, parseReference, referenceLabel, resolveBook, resolveUi, stepChapter } from '../../src/reader/books.ts';

const ref = (s: string) => parseReference(s);

test('ui resolver: explicit wins, then the device list in order, then English', () => {
  assert.equal(resolveUi('zh-Hant', ['en']), 'zh-Hant');
  assert.equal(resolveUi(null, ['fr-FR', 'zh-TW']), 'zh-Hant');
  assert.equal(resolveUi(null, ['fr-FR']), 'en');
  assert.equal(resolveUi(null, ['ru-RU', 'en-AU']), 'en');
});

test('script and region matching for Chinese', () => {
  assert.equal(matchUiTag('zh-TW'), 'zh-Hant');
  assert.equal(matchUiTag('zh_HK'), 'zh-Hant');
  assert.equal(matchUiTag('zh-Hant-CN'), 'zh-Hant');
  assert.equal(matchUiTag('zh-CN'), 'zh-Hans');
  assert.equal(matchUiTag('zh'), 'zh-Hans');
  assert.equal(matchUiTag('en-AU'), 'en');
  assert.equal(matchUiTag('fr'), null);
  assert.equal(matchUiTag('ru'), null); // no Russian in this release
});

test('the edition names the book; the interface names it when no edition is given', () => {
  assert.equal(referenceLabel({ book: 1, chapter: 17, v1: 9 }, 'en', 'cuvs-yhwh'), '创世记 17:9');
  assert.equal(referenceLabel({ book: 1, chapter: 17, v1: 9 }, 'zh-Hans'), '创世记 17:9');
  assert.equal(referenceLabel({ book: 45, chapter: 12 }, 'zh-Hant'), '羅馬書 12');
  assert.equal(referenceLabel({ book: 45, chapter: 12 }, 'en'), 'Romans 12');
  assert.equal(referenceLabel({ book: 45, chapter: 12 }, 'zh-Hant', 'kjv'), 'Romans 12', 'a Chinese reader on the KJV sees English book names over the text');
  assert.equal(referenceLabel({ book: 45, chapter: 12 }, 'en', 'cuvs-yhwh-tr'), '羅馬書 12');
  assert.equal(labelLanguage('zh-Hans', 'bsb-yhwh'), 'en');
  assert.equal(labelLanguage('en'), 'en');
  assert.equal(bookName(66, 'zh-Hans', 'cuvs-yhwh'), '启示录');
  assert.equal(bookName(66, 'zh-Hant', 'cuvs-yhwh-tr'), '啟示錄');
});

test('a range is printed with an en dash and is not narrowed', () => {
  assert.equal(referenceLabel({ book: 1, chapter: 1, v1: 1, v2: 3 }, 'en', 'kjv'), 'Genesis 1:1–3');
  assert.equal(formatVerseRange([3, 4, 5, 7]), '3–5, 7');
  assert.equal(formatVerseRange([7, 3, 4, 4, 5]), '3–5, 7');
  assert.equal(formatVerseRange([]), '');
});

test('typed references: English, abbreviations, Chinese, tight forms', () => {
  assert.deepEqual(ref('John 3:16'), { book: 43, chapter: 3, v1: 16 });
  assert.deepEqual(ref('John 3:16-18'), { book: 43, chapter: 3, v1: 16, v2: 18 });
  assert.deepEqual(ref('Gen 12:1'), { book: 1, chapter: 12, v1: 1 });
  assert.deepEqual(ref('创 12'), { book: 1, chapter: 12 });
  assert.deepEqual(ref('約 3:16'), { book: 43, chapter: 3, v1: 16 });
  assert.deepEqual(ref('jn3:16'), { book: 43, chapter: 3, v1: 16 });
  assert.deepEqual(ref('1 cor 13'), { book: 46, chapter: 13 });
  assert.deepEqual(ref('1Cor 13:4-7'), { book: 46, chapter: 13, v1: 4, v2: 7 });
  assert.deepEqual(ref('1约 1:1'), { book: 62, chapter: 1, v1: 1 });
  assert.deepEqual(ref('創世記 1:1'), { book: 1, chapter: 1, v1: 1 });
  assert.deepEqual(ref('Leviticus'), { book: 3, chapter: 1 });
  assert.deepEqual(ref('马太福音第5章第7节'), { book: 40, chapter: 5, v1: 7 });
  assert.deepEqual(ref('诗篇119篇105节'), { book: 19, chapter: 119, v1: 105 });
  assert.deepEqual(ref('约翰福音三章十六节'), { book: 43, chapter: 3, v1: 16 });
  assert.deepEqual(ref('Psalm 23'), { book: 19, chapter: 23 });
  assert.deepEqual(ref('2 Kings 19-20'), { book: 12, chapter: 19 }, 'a chapter span navigates to its start');
});

test('single-chapter books: "Jude 5" is verse 5', () => {
  assert.deepEqual(ref('Jude 5'), { book: 65, chapter: 1, v1: 5 });
  assert.deepEqual(ref('Obadiah 3'), { book: 31, chapter: 1, v1: 3 });
  assert.deepEqual(ref('Jude 14-15'), { book: 65, chapter: 1, v1: 14, v2: 15 });
});

test('things that are not references', () => {
  assert.equal(ref(''), null);
  assert.equal(ref('hello'), null);
  assert.equal(ref('Genesis 51'), null, 'no such chapter');
  assert.equal(ref('John 99'), null);
  assert.deepEqual(ref('Genesis 1:99'), { book: 1, chapter: 1 }, 'a verse past the end falls back to the chapter');
});

test('resolveBook covers every name in all three scripts and the English abbreviations', () => {
  for (let n = 1; n <= 66; n++) {
    for (const lang of ['en', 'zh-Hans', 'zh-Hant'] as const) assert.equal(resolveBook(bookName(n, lang)), n, `${n} ${lang}`);
  }
  assert.equal(resolveBook('Rev'), 66);
  assert.equal(resolveBook('Ps'), 19);
  assert.equal(resolveBook('2tim'), 55);
});

test('Chinese numerals', () => {
  assert.equal(cnNumber('十二'), 12);
  assert.equal(cnNumber('二十三'), 23);
  assert.equal(cnNumber('一百一十九'), 119);
  assert.equal(cnNumber('十十'), null);
  assert.equal(cnNumber(''), null);
});

test('stepping a chapter crosses book boundaries and stops at the ends of the canon', () => {
  assert.deepEqual(stepChapter(1, 50, 1), { book: 2, chapter: 1 });
  assert.deepEqual(stepChapter(2, 1, -1), { book: 1, chapter: 50 });
  assert.equal(stepChapter(1, 1, -1), null);
  assert.equal(stepChapter(66, 22, 1), null);
  assert.deepEqual(stepChapter(39, 4, 1), { book: 40, chapter: 1 });
});
