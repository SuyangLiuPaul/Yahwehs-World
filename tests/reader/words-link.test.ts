// "Continue in Yahweh's Words": the link must land on a route Words actually registers.
//
// The grammar and the slug rule were read out of the Words checkout (Words-184:
// lib/services/url_sync_service_web.dart, lib/constants/book_slugs.dart) and checked live on 2026-11-04:
// https://yahwehword.com/#/john/3 was rewritten by the app to #/john/3:1?v=bsb-yhwh and opened John 3.
// This test pins the 66 slugs and the edition pass-through so a rename on either side is caught here.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BOOKS } from '../../src/reader/books.ts';
import { WORDS_EDITIONS, slugOf, wordsChapterUrl } from '../../src/reader/words-link.ts';

test('slugs are lowercase canonical English with the spaces taken out', () => {
  assert.equal(slugOf('Genesis'), 'genesis');
  assert.equal(slugOf('1 Samuel'), '1samuel');
  assert.equal(slugOf('Song of Solomon'), 'songofsolomon');
  assert.equal(slugOf('Revelation'), 'revelation');
});

test('every one of the 66 books makes a slug with no spaces, dots or capitals', () => {
  assert.equal(BOOKS.length, 66);
  for (const b of BOOKS) {
    const s = slugOf(b.en);
    assert.match(s, /^[a-z0-9]+$/, `${b.en} -> ${s}`);
  }
  // the ones Words' own comment calls out by name
  assert.equal(slugOf(BOOKS[8]!.en), '1samuel');
  assert.equal(slugOf(BOOKS[21]!.en), 'songofsolomon');
  assert.equal(slugOf(BOOKS[18]!.en), 'psalms');
});

test('a chapter link carries the chapter and, when Words has it, the edition', () => {
  assert.equal(wordsChapterUrl({ book: 43, chapter: 3, edition: 'bsb-yhwh' }), 'https://yahwehword.com/#/john/3?v=bsb-yhwh');
  assert.equal(wordsChapterUrl({ book: 1, chapter: 1, edition: 'cuvs-yhwh-tr' }), 'https://yahwehword.com/#/genesis/1?v=cuvs-yhwh-tr');
  assert.equal(wordsChapterUrl({ book: 19, chapter: 119, verse: 105, edition: 'rst-yhwh' }), 'https://yahwehword.com/#/psalms/119:105?v=rst-yhwh');
});

test('an edition Words does not have is left off rather than guessed', () => {
  assert.equal(wordsChapterUrl({ book: 43, chapter: 3, edition: 'not-an-edition' }), 'https://yahwehword.com/#/john/3');
  assert.equal(wordsChapterUrl({ book: 43, chapter: 3 }), 'https://yahwehword.com/#/john/3');
});

test('all eight editions of this release are ones Words answers to', () => {
  for (const id of ['bsb-yhwh', 'kjv', 'web-yhwh', 'asv-yhwh', 'cuvs-yhwh', 'cuvs-yhwh-tr', 'rst', 'rst-yhwh']) {
    assert.ok(WORDS_EDITIONS.has(id), id);
  }
});

test('a book number outside 1..66 has no link', () => {
  assert.equal(wordsChapterUrl({ book: 0, chapter: 1 }), null);
  assert.equal(wordsChapterUrl({ book: 67, chapter: 1 }), null);
  assert.equal(wordsChapterUrl({ book: 1, chapter: 0 }), null);
});
