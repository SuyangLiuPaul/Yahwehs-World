// The divine-name rule and the verse-markup rules, ported from Words' divine_name_false_hits_test.dart and
// sanitize_collapse_test.dart; same expectations, over this site's six editions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allVerses } from './_data.ts';
import { displayPlain, englishDivineName, normalizeDivineNames, sanitizeForCopy, tokenize, tokensToHtml } from '../../src/reader/text.ts';

const key = (b: number, c: number, v: number) => `${b}:${c}:${v}`;
const shown = new Map<string, Map<string, string>>();
const raw = new Map<string, Map<string, string>>();
for (const id of ['kjv', 'bsb-yhwh', 'asv-yhwh', 'web-yhwh']) {
  const s = new Map<string, string>(), r = new Map<string, string>();
  for (const [b, c, v, t] of allVerses(id)) { const plain = t.replace(/<[^>]*>/g, ''); r.set(key(b, c, v), plain); s.set(key(b, c, v), sanitizeForCopy(plain)); }
  shown.set(id, s); raw.set(id, r);
}
const at = (ed: string, b: number, c: number, v: number) => shown.get(ed)!.get(key(b, c, v)) ?? '';

test('Revelation 19:16 keeps LORD OF LORDS (the title of Jesus) in every edition that prints it', () => {
  let n = 0;
  for (const ed of shown.keys()) {
    const t = at(ed, 66, 19, 16);
    assert.ok(!t.includes('Yahweh'), ed);
    if ((raw.get(ed)!.get(key(66, 19, 16)) ?? '').includes('LORD OF LORDS')) { n++; assert.ok(t.includes('LORD OF LORDS'), ed); }
  }
  assert.ok(n >= 2);
});

test('New Testament: the name only where the text quotes YHWH (the KJV’s four Psalm 110:1 quotations)', () => {
  const NT = { 'kjv': new Set(['40:22:44', '41:12:36', '42:20:42', '44:2:34']) } as Record<string, Set<string>>;
  const count = (s: string) => (s.match(/\bYahweh\b|\bYAHWEH\b/g) ?? []).length;
  for (const ed of shown.keys()) {
    const hits = new Set<string>();
    for (const [k, v] of shown.get(ed)!) {
      if (Number(k.split(':')[0]) >= 40 && count(v) > count(raw.get(ed)!.get(k)!)) hits.add(k);
    }
    assert.deepEqual([...hits].sort(), [...(NT[ed] ?? [])].sort(), ed);
  }
});

test('a line in capitals never reads "THE Yahweh"', () => {
  const bad = /\b[A-Z]{2,}[,:;]? Yahweh\b|\bYahweh[,:;]? (?!GOD\b)[A-Z]{2,}\b/;
  for (const ed of shown.keys()) {
    const hits = [...shown.get(ed)!].filter(([, v]) => bad.test(v)).map(([k]) => k);
    assert.deepEqual(hits, [], ed);
  }
});

test('the King James: kyrios and Adonai stay Lord; the name where it prints LORD', () => {
  const k = (b: number, c: number, v: number) => at('kjv', b, c, v);
  assert.match(k(43, 20, 28), /My Lord and my God/);
  assert.match(k(44, 11, 20), /preaching the Lord Jesus/);
  assert.match(k(44, 15, 11), /the Lord Jesus Christ/);
  assert.match(k(44, 22, 10), /What shall I do, Lord\?/);
  assert.match(k(1, 18, 3), /My Lord, if now/);
  assert.match(k(19, 2, 4), /the Lord shall have them in derision/);
  assert.match(k(23, 6, 1), /I saw also the Lord sitting/);
  assert.match(k(3, 24, 11), /blasphemed the name of Yahweh/);
  assert.ok(k(40, 22, 44).startsWith('Yahweh said unto my Lord'));
  assert.match(k(1, 15, 2), /Lord Yahweh, what wilt thou give me/);
  assert.match(k(19, 68, 20), /unto Yahweh the Lord belong/);
  assert.match(k(23, 12, 2), /for Yah Yahweh is my strength/);
  assert.match(k(19, 83, 18), /whose name alone is YAHWEH/);
  assert.match(k(2, 28, 36), /HOLINESS TO YAHWEH/);
  assert.match(k(24, 23, 6), /YAHWEH OUR RIGHTEOUSNESS/);
  assert.match(k(5, 28, 58), /YAHWEH THY GOD/);
  assert.ok(k(2, 34, 6).startsWith('And Yahweh passed by before him, and proclaimed, Yahweh, Yahweh God'));
});

test('BSB (Yahweh): the capitals inscriptions name Yahweh in capitals', () => {
  assert.match(at('bsb-yhwh', 2, 28, 36), /HOLY TO YAHWEH\.$/);
  assert.match(at('bsb-yhwh', 2, 39, 30), /HOLY TO YAHWEH\.$/);
  assert.match(at('bsb-yhwh', 38, 14, 20), /HOLY TO YAHWEH will be inscribed/);
  assert.match(at('bsb-yhwh', 26, 48, 35), /will be: YAHWEH IS THERE\./);
});

test('mixed-case Lord is never touched; LORD alone is', () => {
  assert.equal(englishDivineName('the Lord of lords'), 'the Lord of lords');
  assert.equal(englishDivineName('O LORD, my strength'), 'O Yahweh, my strength');
  assert.equal(englishDivineName("the LORD'S house"), "Yahweh's house");
  assert.equal(englishDivineName('KING OF KINGS, AND LORD OF LORDS.'), 'KING OF KINGS, AND LORD OF LORDS.');
  assert.equal(normalizeDivineNames('耶和华是我的牧者；耶和華'), '雅伟是我的牧者；雅偉');
});

test('stripping a note leaves one punctuation mark, not two (Revelation 1:8)', () => {
  assert.equal(sanitizeForCopy('我是俄梅戛，<note: 阿拉法，俄梅戛：是希利尼字母首末二字>，是昔在'), '我是俄梅戛，是昔在');
  assert.equal(sanitizeForCopy('亚衲族的始祖。<note: 基列亚巴就是希伯仑>。'), '亚衲族的始祖。');
  assert.equal(sanitizeForCopy('a；；b'), 'a；b');
  assert.equal(sanitizeForCopy('a，，，b'), 'a，b');
  assert.equal(sanitizeForCopy('a。。。。b'), 'a。b');
  assert.equal(sanitizeForCopy('我是阿拉法，我是俄梅戛，是昔在'), '我是阿拉法，我是俄梅戛，是昔在');
  assert.equal(sanitizeForCopy('In the beginning  God\n'), 'In the beginning God');
});

test('supplied words keep their content: {braces} and [square] are markup, not text to throw away', () => {
  assert.equal(sanitizeForCopy('because {they exist no longer}'), 'because they exist no longer');
  assert.equal(sanitizeForCopy('主[雅伟]神说'), '主[雅伟]神说');
  assert.equal(displayPlain('主[雅伟]神说'), '主〔雅伟〕神说');
  assert.equal(displayPlain('the Lord [Yahweh] knows'), 'the Lord Yahweh knows');
  assert.equal(sanitizeForCopy('¶ In the beginning'), 'In the beginning');
});

test('tokens: notes become numbered markers per verse; editor marks keep brackets only in the Chinese editions', () => {
  const t = tokenize('神说：要有光<note: 原文作"天空的表面">。又有<note: 第二>光。', 'cuvs-yhwh');
  assert.deepEqual(t.map((x) => x.k), ['text', 'note', 'text', 'note', 'text']);
  assert.equal((t[1] as { n: number }).n, 1);
  assert.equal((t[3] as { n: number }).n, 2);
  const html = tokensToHtml(tokenize('主[雅伟]的使者', 'cuvs-yhwh'), 'cuvs-yhwh', 'p', (n) => `Note ${n}`);
  assert.match(html, /\[雅伟\]/);
  const en = tokensToHtml(tokenize('the Lord [Yahweh] knows', 'bsb-yhwh'), 'bsb-yhwh', 'p', (n) => `Note ${n}`);
  assert.ok(!en.includes('['));
  assert.match(en, /Yahweh/);
  const withNote = tokenize('a<note: x < y & "z">b', 'kjv');
  const noteHtml = tokensToHtml(withNote, 'kjv', 'p', (n) => `Note ${n}`);
  assert.match(noteHtml, /x &lt; y &amp; &quot;z&quot;/);
  assert.match(noteHtml, /aria-expanded="false" aria-controls="p-1"/);
  assert.match(noteHtml, /<span class="yr-note" id="p-1" role="note" hidden>/);
});

test('markup in the data never reaches the screen as markup: no < or > or { or [ in any rendered verse of the six editions', () => {
  for (const id of ['kjv', 'bsb-yhwh', 'asv-yhwh', 'web-yhwh', 'cuvs-yhwh', 'cuvs-yhwh-tr']) {
    for (const [b, c, v, t] of allVerses(id)) {
      const toks = tokenize(t, id);
      for (const tk of toks) if (tk.k === 'text') assert.ok(!/[<>{}\[\]]/.test(tk.s), `${id} ${b}:${c}:${v} -> ${tk.s.slice(0, 40)}`);
    }
  }
});
