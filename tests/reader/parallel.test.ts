// Vertical parallel: the owner's decisions of 2026-10-19 (max 3; first-time pairing; one is allowed), the picker
// rules, and the alignment audit over all 31,102 verses for every pair of the six editions
// (the same audit Words ran through the originals, here by shared verse number, which these six share).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, chineseScriptOf, defaultPairing, MAX_PARALLEL, moveEdition, normalizeSet, pickerRows, toggleEdition } from '../../src/reader/parallel.ts';
import { EDITION_IDS, text } from './_data.ts';
import { tokenize } from '../../src/reader/text.ts';

test('at most three editions; the main one is first; unknown ids and duplicates are dropped', () => {
  assert.equal(MAX_PARALLEL, 3);
  assert.deepEqual(normalizeSet(['kjv', 'asv-yhwh', 'web-yhwh', 'cuvs-yhwh'], 'bsb-yhwh'), ['bsb-yhwh', 'kjv', 'asv-yhwh']);
  assert.deepEqual(normalizeSet(['bsb-yhwh', 'nope', 'kjv', 'kjv'], 'bsb-yhwh'), ['bsb-yhwh', 'kjv']);
  assert.deepEqual(normalizeSet([], 'kjv'), ['kjv'], 'one edition is allowed');
});

test('first-time pairing: an English reader gets 和合本雅伟版 in their script; a Chinese reader gets BSB (Yahweh)', () => {
  assert.deepEqual(defaultPairing('bsb-yhwh'), ['bsb-yhwh', 'cuvs-yhwh']);
  assert.deepEqual(defaultPairing('kjv', 'zh-Hant'), ['kjv', 'cuvs-yhwh-tr']);
  assert.deepEqual(defaultPairing('cuvs-yhwh'), ['cuvs-yhwh', 'bsb-yhwh']);
  assert.deepEqual(defaultPairing('cuvs-yhwh-tr'), ['cuvs-yhwh-tr', 'bsb-yhwh']);
  assert.deepEqual(defaultPairing('rst-yhwh'), ['rst-yhwh', 'bsb-yhwh'], 'a Russian reader gets the BSB (Yahweh)');
  assert.equal(chineseScriptOf(['en-AU', 'zh-TW']), 'zh-Hant');
  assert.equal(chineseScriptOf(['en-AU', 'zh-CN']), 'zh-Hans');
  assert.equal(chineseScriptOf(['en']), 'zh-Hans');
  assert.equal(chineseScriptOf(['zh-Hant-HK', 'zh-CN']), 'zh-Hant');
});

test('toggle and move: the cap holds, the main edition cannot be removed, moving row 0 changes the main edition', () => {
  assert.deepEqual(toggleEdition(['bsb-yhwh', 'kjv'], 'asv-yhwh'), ['bsb-yhwh', 'kjv', 'asv-yhwh']);
  assert.deepEqual(toggleEdition(['bsb-yhwh', 'kjv', 'asv-yhwh'], 'web-yhwh'), ['bsb-yhwh', 'kjv', 'asv-yhwh'], 'at the cap nothing is added');
  assert.deepEqual(toggleEdition(['bsb-yhwh', 'kjv'], 'kjv'), ['bsb-yhwh']);
  assert.deepEqual(toggleEdition(['bsb-yhwh', 'kjv'], 'bsb-yhwh'), ['bsb-yhwh', 'kjv'], 'the main edition stays');
  assert.deepEqual(moveEdition(['a', 'b', 'c'] as string[], 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(moveEdition(['a', 'b', 'c'] as string[], 'a', -1), ['a', 'b', 'c']);
  assert.deepEqual(moveEdition(['a', 'b', 'c'] as string[], 'c', 1), ['a', 'b', 'c']);
});

test('picker rows: grouped by language, the other Chinese script folded unless in use, the cap explained', () => {
  const en = pickerRows(['bsb-yhwh', 'cuvs-yhwh'], 'en');
  assert.equal(en.length, 8);
  assert.equal(en.find((r) => r.id === 'cuvs-yhwh-tr')!.folded, true);
  assert.equal(en.find((r) => r.id === 'cuvs-yhwh')!.folded, false);
  const hant = pickerRows(['cuvs-yhwh-tr', 'bsb-yhwh'], 'zh-Hant');
  assert.equal(hant.find((r) => r.id === 'cuvs-yhwh')!.folded, true);
  assert.equal(hant.find((r) => r.id === 'cuvs-yhwh-tr')!.folded, false);
  // in use beats folded
  assert.equal(pickerRows(['bsb-yhwh', 'cuvs-yhwh-tr'], 'en').find((r) => r.id === 'cuvs-yhwh-tr')!.folded, false);
  const full = pickerRows(['bsb-yhwh', 'kjv', 'asv-yhwh'], 'en');
  assert.equal(full.find((r) => r.id === 'web-yhwh')!.disabledReason, 'max');
  assert.equal(full.find((r) => r.id === 'kjv')!.disabledReason, null, 'removing is always allowed');
});

test('rows: a verse appears if any edition has it; an omission is null, never a shift', () => {
  const t = ['kjv', 'bsb-yhwh', 'cuvs-yhwh'].map((id) => text(id, 40));
  const rows = buildRows(t, 17);
  const v21 = rows.find((r) => r.v === 21)!;
  assert.ok(v21.cells[0] && v21.cells[2]);
  assert.equal(v21.cells[1], null);
  assert.deepEqual(rows.map((r) => r.v), Array.from({ length: 27 }, (_v, i) => i + 1), 'Matthew 17 has 27 verses, 21 included');
  assert.deepEqual(buildRows(t, 17, 20, 22).map((r) => r.v), [20, 21, 22]);
  assert.deepEqual(buildRows(t, 99), []);
});

test('alignment audit: all 31,102 verses, every ordered pair of the eight editions', () => {
  const books = Object.fromEntries(EDITION_IDS.map((id) => [id, Array.from({ length: 66 }, (_x, b) => text(id, b + 1))]));
  const missing: Record<string, number> = {};
  for (const main of EDITION_IDS) {
    for (const other of EDITION_IDS) {
      if (main === other) continue;
      let gaps = 0, lost = 0, total = 0;
      for (let b = 0; b < 66; b++) {
        const mt = books[main]![b]!, ot = books[other]![b]!;
        assert.equal(mt.length, ot.length, `${main}/${other} chapters in book ${b + 1}`);
        for (let c = 0; c < mt.length; c++) {
          const rows = buildRows([mt, ot], c + 1);
          for (const r of rows) {
            total++;
            if (r.cells[0] != null && r.cells[1] == null) gaps++;
            if (r.cells[0] == null && r.cells[1] == null) lost++;
          }
        }
      }
      assert.equal(lost, 0, `${main} -> ${other}: a verse in neither`);
      missing[`${main}->${other}`] = gaps;
      assert.ok(total >= 31086, `${main}->${other} rows ${total}`);
    }
  }
  // the same figures Words' audit printed: KJV and the 和合本 keep everything; the critical-text editions leave 16 (WEB 4) out
  for (const o of EDITION_IDS) {
    if (o === 'kjv') continue;
    assert.equal(missing[`${o}->kjv`], 0, `${o} -> kjv has no gap`);
  }
  assert.equal(missing['kjv->bsb-yhwh'], 16);
  assert.equal(missing['cuvs-yhwh->bsb-yhwh'], 16);
  assert.equal(missing['cuvs-yhwh-tr->asv-yhwh'], 16);
  assert.equal(missing['kjv->web-yhwh'], 4);
  assert.equal(missing['kjv->cuvs-yhwh'], 0);
  assert.equal(missing['bsb-yhwh->cuvs-yhwh-tr'], 0);
  assert.equal(missing['kjv->rst-yhwh'], 0, 'the Synodal is numbered like the KJV in Words');
  assert.equal(missing['rst->kjv'], 0);
  assert.equal(missing['rst-yhwh->bsb-yhwh'], 16);
  console.log('# gaps by pair: ' + JSON.stringify(missing));
});

test('Psalm 119 in three editions: 176 rows, and the rows plus their tokens are built in well under 120 ms', () => {
  const t = ['bsb-yhwh', 'kjv', 'cuvs-yhwh'].map((id) => text(id, 19));
  const t0 = performance.now();
  const rows = buildRows(t, 119);
  let n = 0;
  for (const r of rows) r.cells.forEach((c, k) => { if (c) n += tokenize(c, ['bsb-yhwh', 'kjv', 'cuvs-yhwh'][k]!).length; });
  const ms = performance.now() - t0;
  assert.equal(rows.length, 176);
  assert.ok(n >= 176 * 3);
  assert.ok(ms < 120, `${ms.toFixed(1)} ms`);
  console.log(`# Psalm 119 x3: ${rows.length} rows, ${n} tokens in ${ms.toFixed(2)} ms`);
});
