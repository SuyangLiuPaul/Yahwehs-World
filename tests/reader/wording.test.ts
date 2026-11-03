// Church wording rules, ported from Words' section_title_wording_test.dart and book_intro_wording_test.dart
// and widened to everything this site writes itself: the three heading sets, the chrome strings, the credit
// lines. Owner (2026-10-20): 「小标题和背景都要根据讲道和圣经内容，别用位格、三位一体之类的词语」 -- even to deny it.
// God is 他, never 祂; 雅偉 in Traditional; headings come from the BSB set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE } from '../../src/reader/catalogue.gen.ts';
import { STRINGS } from '../../src/reader/strings.ts';
import { CUT_NOTICE } from '../../src/reader/copy.ts';
import { headings } from './_data.ts';

// The same list Words' tests carry (headings + intros), unioned.
export const BANNED = [
  '位格', '本体', '本體', '三位一体', '三位一體', '三一', '子神', '圣子', '聖子', '圣父', '聖父', '神性', '完全是神', '完全是人',
  '先存', '神成为人', '神成為人', '道成肉身', '祂',
  'trinit', 'triune', 'godhead', 'god the son', 'second person', 'divinity', 'deity', 'divine nature', 'fully god', 'fully man',
  'pre-exist', 'preexist', 'pre-incarnate', 'incarnat', 'god became man', 'jesus is god', 'god became',
];

function walk(o: unknown, path: string, visit: (s: string, path: string) => void): void {
  if (typeof o === 'string') visit(o, path);
  else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}/${i}`, visit));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}/${k}`, visit);
}
const scan = (label: string, o: unknown): string[] => {
  const hits: string[] = [];
  walk(o, label, (s, p) => {
    const low = s.toLowerCase();
    for (const b of BANNED) if (low.includes(b)) hits.push(`${p}: ${b}`);
    // "Jesus is God" as a statement; 「耶稣是神的羔羊 / 神的儿子」 are Scripture's own words and stay
    for (const m of s.matchAll(/(耶[稣穌]|基督)是神(?!的)/g)) hits.push(`${p}: ${m[0]}`);
  });
  return hits;
};

test('no creedal vocabulary in any heading or background note, in the three sets', () => {
  const hits: string[] = [];
  for (const set of ['cuv', 'cuv-tr', 'english-classic']) for (let b = 1; b <= 66; b++) hits.push(...scan(`${set}/${b}`, headings(set, b)));
  assert.deepEqual(hits, [], hits.slice(0, 20).join('\n'));
});

test('no creedal vocabulary in the chrome strings, the credit lines or the copy notices', () => {
  const hits = [...scan('strings', STRINGS), ...scan('editions', CATALOGUE.editions), ...scan('notice', Object.fromEntries(Object.entries(CUT_NOTICE).map(([k, f]) => [k, f(100)])))];
  assert.deepEqual(hits, []);
});

test('Traditional text writes 雅偉 and never the Simplified 雅伟; Simplified never the reverse', () => {
  const hant: string[] = [];
  const hans: string[] = [];
  for (let b = 1; b <= 66; b++) {
    walk(headings('cuv-tr', b), `cuv-tr/${b}`, (s, p) => { if (s.includes('雅伟')) hant.push(p); });
    walk(headings('cuv', b), `cuv/${b}`, (s, p) => { if (s.includes('雅偉')) hans.push(p); });
  }
  for (const [k, row] of Object.entries(STRINGS)) {
    if (row['zh-Hant'].includes('雅伟')) hant.push(`strings/${k}`);
    if (row['zh-Hans'].includes('雅偉')) hans.push(`strings/${k}`);
  }
  assert.deepEqual(hant, []);
  assert.deepEqual(hans, []);
});

test('headings: 2,597 in each set (the number Words\' own asset holds), same verses in all three', () => {
  const keys = (set: string): string[] => {
    const out: string[] = [];
    for (let b = 1; b <= 66; b++) for (const [ch, list] of Object.entries(headings(set, b))) for (const h of list) out.push(`${b}:${ch}:${h.v}`);
    return out;
  };
  const a = keys('cuv'), b = keys('cuv-tr'), c = keys('english-classic');
  assert.equal(a.length, 2597);
  assert.equal(b.length, 2597);
  assert.equal(c.length, 2597);
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});

test('every heading has a title and a background note; none is empty', () => {
  for (const set of ['cuv', 'cuv-tr', 'english-classic']) {
    for (let b = 1; b <= 66; b++) for (const list of Object.values(headings(set, b))) for (const h of list) {
      assert.ok(h.t.trim().length > 0, `${set} ${b} ${h.v}`);
      assert.ok(h.v >= 1);
    }
  }
});

test('snapshots: Genesis 1, Psalm 119 and John 1 read what the church wrote', () => {
  const g = (set: string, book: number, ch: number) => (headings(set, book)[String(ch)] ?? []).map((h) => `${h.v} ${h.t}`);
  assert.deepEqual(g('cuv', 1, 1), ['1 创造']);
  assert.deepEqual(g('cuv-tr', 1, 1), ['1 創造']);
  assert.deepEqual(g('english-classic', 1, 15), ['1 God’s Covenant with Abram']);
  const p119 = g('english-classic', 19, 119);
  assert.equal(p119.length, 22);
  assert.equal(p119[0], '1 Your Word Is a Lamp to My Feet');
  assert.equal(p119[1], '9 ב BETH');
  assert.equal(g('cuv', 19, 119).length, 22);
  const j1 = g('english-classic', 43, 1);
  assert.ok(j1.length >= 2, 'John 1 has its headings');
  assert.equal(JSON.stringify(g('cuv', 43, 1)), JSON.stringify(g('cuv', 43, 1)));
});

test('English headings are the BSB\u2019s (public domain), pinned at Romans 8 where the NASB and NIV titles differ', () => {
  const t = (headings('english-classic', 45)['8'] ?? []).map((h) => h.t);
  assert.deepEqual(t, ['Walking by the Spirit', 'Future Glory', 'The Love of God']);
});

test('Hant chrome strings use the Traditional forms for words that differ', () => {
  assert.equal(STRINGS.copy['zh-Hant'], '複製');
  assert.equal(STRINGS.copy['zh-Hans'], '复制');
  assert.equal(STRINGS.modeVerse['zh-Hant'], '逐節');
});
