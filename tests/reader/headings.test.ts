// Heading-set mapping: ported from Words' section_title_map.dart tests (set ids resolve; script parity is not crossed;
// the follow-the-edition rule), plus the lookup rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { headingAt, headingSetFor, headingsIn, SET_BY_EDITION } from '../../src/reader/headings.ts';
import { CATALOGUE } from '../../src/reader/catalogue.gen.ts';
import { hasWords, headings, WORDS } from './_data.ts';

test('heading set follows the edition: cuv for 和合本 Simplified, cuv-tr for Traditional, english-classic for English', () => {
  assert.equal(headingSetFor('cuvs-yhwh'), 'cuv');
  assert.equal(headingSetFor('cuvs-yhwh-tr'), 'cuv-tr');
  for (const e of ['kjv', 'bsb-yhwh', 'web-yhwh', 'asv-yhwh']) assert.equal(headingSetFor(e), 'english-classic', e);
});

test('the catalogue and the table agree, and every set id exists in the data', () => {
  for (const e of CATALOGUE.editions) {
    assert.equal(SET_BY_EDITION[e.id], e.headingSet, e.id);
    assert.ok(Object.keys(headings(e.headingSet, 1)).length > 0, e.id);
  }
});

test('script parity is not crossed: no Traditional edition reads the Simplified set', () => {
  for (const e of CATALOGUE.editions) {
    if (e.language === 'zh-Hant') assert.equal(e.headingSet, 'cuv-tr');
    if (e.language === 'zh-Hans') assert.equal(e.headingSet, 'cuv');
    if (e.language === 'en') assert.equal(e.headingSet, 'english-classic');
  }
});

test('equals Words\' section_title_map.dart for the six editions (skipped without a Words checkout)', { skip: !hasWords }, () => {
  const dart = readFileSync(join(WORDS, 'lib/constants/section_title_map.dart'), 'utf8');
  for (const [id, set] of Object.entries(SET_BY_EDITION)) {
    const m = dart.match(new RegExp(`'${id}':\\s*'([^']+)'`));
    assert.equal(m?.[1], set, id);
  }
});

test('headingAt: the last heading at or before the verse; none before the first', () => {
  const h = headings('english-classic', 19); // Psalms
  assert.equal(headingAt(h, 119, 1)?.v, 1);
  assert.equal(headingAt(h, 119, 8)?.v, 1);
  assert.equal(headingAt(h, 119, 9)?.v, 9);
  assert.equal(headingAt(h, 119, 176)?.v, 169);
  assert.equal(headingAt({ '2': [{ v: 5, t: 'x' }] }, 2, 3), null);
});

test('headingsIn: only those starting inside the range, in order', () => {
  const h = headings('english-classic', 19);
  assert.deepEqual(headingsIn(h, 119, 8, 26).map((x) => x.v), [9, 17, 25]);
  assert.deepEqual(headingsIn(h, 119).length, 22);
  assert.deepEqual(headingsIn(h, 7), headingsIn(h, 7));
});
