// The gallery's home page shows an edition chip without loading the reader, from a small table (src/gallery/editions.ts).
// That table is a shadow of the reader's catalogue (generated from Words); this fails when the two drift apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BRIEFS, DEFAULTS } from '../../src/gallery/editions.ts';
import { CATALOGUE } from '../../src/reader/catalogue.gen.ts';

const chip = (kind: string) => (kind === 'cc0' ? 'CC0' : kind === 'permission' ? '©' : 'PD');

test('the home page table lists exactly the reader catalogue’s eight editions, in order, with the same label and licence chip', () => {
  assert.deepEqual(BRIEFS.map((b) => b.id), CATALOGUE.editions.map((e) => e.id));
  assert.deepEqual(BRIEFS.map((b) => b.id), ['bsb-yhwh', 'kjv', 'web-yhwh', 'asv-yhwh', 'cuvs-yhwh', 'cuvs-yhwh-tr', 'rst-yhwh', 'rst']);
  for (const b of BRIEFS) {
    const e = CATALOGUE.editions.find((x) => x.id === b.id)!;
    assert.equal(b.label, e.label, b.id);
    assert.equal(b.lic, chip(e.licence.kind), `${b.id} licence chip`);
  }
});

test('the default edition of each reading is the reader’s', () => {
  assert.deepEqual({ ...DEFAULTS }, CATALOGUE.defaults);
});

test('the church’s Union Version is (c), used with permission, never public domain (Words’ record)', () => {
  for (const id of ['cuvs-yhwh', 'cuvs-yhwh-tr']) {
    assert.equal(BRIEFS.find((b) => b.id === id)!.lic, '©');
    const e = CATALOGUE.editions.find((x) => x.id === id)!;
    assert.equal(e.licence.kind, 'permission');
    for (const l of ['en', 'zh-Hans', 'zh-Hant', 'ru'] as const) assert.ok(!/public domain|公有|общественное достояние/i.test(e.credit[l] + e.licence.note[l]), `${id} ${l}`);
  }
});
