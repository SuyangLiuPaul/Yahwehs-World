// The editions: which six, whose bytes, and that nothing user-visible carries the year the owner ruled out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGUE } from '../../src/reader/catalogue.gen.ts';
import { allVerses, DATA, EDITION_IDS, hasWords, readJson, ROOT, WORDS } from './_data.ts';
import { STRINGS } from '../../src/reader/strings.ts';
import { sanitizeForCopy } from '../../src/reader/text.ts';

const lock = JSON.parse(readFileSync(join(ROOT, 'src/reader/sources.lock.json'), 'utf8')) as { wordsCommit: string; files: Record<string, { sha256: string; bytes: number }> };

test('exactly the eight editions the owner allowed (English, Chinese in both scripts, Russian), in this order', () => {
  assert.deepEqual(CATALOGUE.editions.map((e) => e.id), [...EDITION_IDS]);
  assert.deepEqual(CATALOGUE.defaults, { en: 'bsb-yhwh', 'zh-Hans': 'cuvs-yhwh', 'zh-Hant': 'cuvs-yhwh-tr', ru: 'rst-yhwh' });
});

test('the catalogue pins the Words commit and every edition SHA equals the lock', () => {
  assert.equal(CATALOGUE.wordsCommit, lock.wordsCommit);
  for (const e of CATALOGUE.editions) {
    const l = lock.files[`assets/${e.id}.json`];
    assert.ok(l, e.id);
    assert.equal(e.sha256, l.sha256, e.id);
    assert.equal(e.bytes, l.bytes, e.id);
  }
});

test('the catalogue equals the one on disk (what the page fetches)', () => {
  assert.deepEqual(readJson('catalogue.json'), JSON.parse(JSON.stringify(CATALOGUE)));
});

test('Words source files still hash to the lock (skipped when no Words checkout is mounted)', { skip: !hasWords }, () => {
  for (const [p, l] of Object.entries(lock.files)) {
    const sha = createHash('sha256').update(readFileSync(join(WORDS, p))).digest('hex');
    assert.equal(sha, l.sha256, p);
  }
});

test('per-book files put back together equal Words\' verse list, verse for verse', { skip: !hasWords }, () => {
  for (const id of EDITION_IDS) {
    const rows = JSON.parse(readFileSync(join(WORDS, `assets/${id}.json`), 'utf8')) as { id: string; text: string }[];
    const mine = new Map<number, string>();
    for (const [b, c, v, s] of allVerses(id)) mine.set(b * 1e6 + c * 1e3 + v, s);
    assert.equal(mine.size, rows.length, id);
    for (const r of rows) assert.equal(mine.get(Number(r.id)), r.text, `${id} ${r.id}`);
  }
});

test('all six number the verses the same way: 31,102 in the union, the omissions are only the known ones', () => {
  const union = new Set<number>();
  const per = new Map<string, Set<number>>();
  for (const id of EDITION_IDS) {
    const s = new Set<number>();
    for (const [b, c, v] of allVerses(id)) s.add(b * 1e6 + c * 1e3 + v);
    per.set(id, s);
    for (const x of s) union.add(x);
  }
  assert.equal(union.size, 31102);
  // KJV and the 和合本 print all of them; the critical-text editions leave out a handful (Matthew 17:21 and its kind)
  assert.equal(per.get('kjv')!.size, 31102);
  assert.equal(per.get('cuvs-yhwh')!.size, 31102);
  assert.equal(per.get('cuvs-yhwh-tr')!.size, 31102);
  assert.equal(per.get('rst-yhwh')!.size, 31102, 'Words numbers the Synodal like the others');
  assert.equal(per.get('rst')!.size, 31102);
  assert.equal(31102 - per.get('bsb-yhwh')!.size, 16);
  assert.equal(31102 - per.get('asv-yhwh')!.size, 16);
  assert.equal(31102 - per.get('web-yhwh')!.size, 4);
  assert.ok(!per.get('bsb-yhwh')!.has(40017021), 'Matthew 17:21 is not in the BSB');
});

test('no 耶和华 / 耶和華 in a Yahweh edition, and no Jehovah or LORD left once the divine-name rule has run', () => {
  for (const id of EDITION_IDS) {
    for (const [b, c, v, s] of allVerses(id)) {
      assert.ok(!/耶和[华華]/.test(s), `${id} ${b}:${c}:${v} raw`);
      const shown = sanitizeForCopy(s);
      // the three altar names (Jehovahjireh, Jehovahnissi, Jehovahshalom) are place names, kept as printed
      assert.ok(!/Jehovah/i.test(shown.replace(/Jehovah[- ]?(jireh|nissi|shalom)/gi, '')), `${id} ${b}:${c}:${v}`);
      // kyrios in capitals (Revelation 19:16) is the one LORD that stays
      if (!(b === 66 && c === 19 && v === 16)) assert.ok(!/\bLORD\b/.test(shown), `${id} ${b}:${c}:${v} still says LORD: ${shown.slice(0, 60)}`);
    }
  }
});

test('the year the owner ruled out is not written anywhere user-visible', () => {
  const visible = JSON.stringify(CATALOGUE.editions.map((e) => ({ ...e, sha256: '', bytes: 0 }))) + JSON.stringify(STRINGS);
  assert.ok(!visible.includes('1919'), 'catalogue or strings contain 1919');
  for (const set of ['cuv', 'cuv-tr', 'english-classic']) {
    for (let b = 1; b <= 66; b++) assert.ok(!JSON.stringify(readJson(`headings/${set}/${b}.json`)).includes('1919'), `${set} ${b}`);
  }
});

test('the Union Version editions use Words\u2019 wording: © Yahweh De Hua Ministry, used with permission (not public domain), no year', () => {
  const hans = CATALOGUE.editions.find((e) => e.id === 'cuvs-yhwh')!;
  const hant = CATALOGUE.editions.find((e) => e.id === 'cuvs-yhwh-tr')!;
  assert.equal(hans.licence.kind, 'permission');
  assert.equal(hant.licence.kind, 'permission');
  // Words' assets/i18n/ui/<lang>.json aboutLicenseCuvsYhwh, word for word
  assert.equal(hans.licence.note.en, '© Yahweh De Hua Ministry · used with permission.');
  assert.equal(hans.licence.note['zh-Hans'], '© 雅伟的话事工 · 经授权使用。');
  assert.equal(hans.licence.note['zh-Hant'], '© 雅偉的話事工 · 經授權使用。');
  assert.equal(hans.licence.note.ru, '© Yahweh De Hua Ministry · используется с разрешения.');
  assert.match(hans.credit['zh-Hans'], /^和合本雅伟版 · © 雅伟的话事工 · 经授权使用。$/);
  assert.match(hant.credit['zh-Hant'], /^和合本雅偉版 · © 雅偉的話事工 · 經授權使用。$/);
  assert.match(hans.credit.en, /Chinese Union Version/);
  assert.match(hans.credit.en, /used with permission/);
  for (const e of [hans, hant]) for (const l of ['en', 'zh-Hans', 'zh-Hant', 'ru'] as const) {
    assert.ok(!/public domain|公有|общественное достояние/i.test(e.credit[l] + e.licence.note[l]), `${e.id} ${l} must not claim public domain`);
    assert.ok(!/1919/.test(e.credit[l] + e.licence.note[l]), `${e.id} ${l} prints a year`);
  }
  for (const e of CATALOGUE.editions) for (const l of ['en', 'zh-Hans', 'zh-Hant', 'ru'] as const) assert.ok(e.credit[l] && e.licence.note[l], `${e.id} ${l}`);
});

test('Russian: the Яхве edition never says Иегова; the plain Synodal is as printed (a handful of Иегова are in the publisher\u2019s text)', () => {
  let plain = 0;
  for (const [b, c, v, s] of allVerses('rst-yhwh')) assert.ok(!/Иегов/.test(s), `rst-yhwh ${b}:${c}:${v}`);
  for (const [, , , s] of allVerses('rst')) if (/Иегов/.test(s)) plain++;
  assert.equal(plain, 7);
  let yahve = 0;
  for (const [, , , s] of allVerses('rst-yhwh')) if (/Яхве/.test(s)) yahve++;
  assert.ok(yahve > 4000, `Яхве in ${yahve} verses`);
});

test('Russian editions are the plain eBible.org Synodal (public domain), never the licensed Strong\u2019s-tagged text', () => {
  for (const id of ['rst', 'rst-yhwh']) {
    const e = CATALOGUE.editions.find((x) => x.id === id)!;
    assert.equal(e.language, 'ru');
    assert.equal(e.licence.kind, 'public-domain');
    assert.match(e.credit.ru, /общественное достояние/);
    assert.match(e.licence.holder, /eBible\.org/);
    for (const [, , , s] of allVerses(id)) assert.ok(!/<[^>]*(strong|lio)[^>]*>/i.test(s));
  }
});

test('the divine name is spelled for each script: 雅伟 in Simplified credits, 雅偉 in Traditional', () => {
  for (const e of CATALOGUE.editions) {
    // the credit is printed in the edition's own language, so that is the one that must be right
    if (e.language === 'zh-Hant') assert.ok(!/雅伟/.test(e.credit['zh-Hant']), `${e.id} credit (Hant)`);
    if (e.language === 'zh-Hans') assert.ok(!/雅偉/.test(e.credit['zh-Hans']), `${e.id} credit (Hans)`);
    assert.ok(!/雅伟/.test(e.licence.note['zh-Hant']), `${e.id} licence note (Hant)`);
    assert.ok(!/雅偉/.test(e.licence.note['zh-Hans']), `${e.id} licence note (Hans)`);
  }
});

test('sizes: the data a passage needs is one book of one edition', () => {
  const kb = (rel: string) => readFileSync(join(DATA, rel)).length / 1024;
  assert.ok(kb('text/kjv/19.json') < 400, 'Psalms in KJV');
  assert.ok(kb('text/cuvs-yhwh/1.json') < 250);
});
