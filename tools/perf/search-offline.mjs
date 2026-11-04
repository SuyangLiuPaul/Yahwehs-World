// Reproducible CPU-only before/after scan; no browser, network or source writes.
// node tools/perf/search-offline.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildSearchIndex, searchIndex } from '../../src/gallery/search-index.ts';
import { BOOKS } from '../../src/books.ts';
import { BOOKS_RU } from '../../src/gallery/books-ru.ts';

const json = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const raw = json('public/data/gallery/index.json');
const sums = json('public/data/gallery/summaries.json');
const table = json('public/data/zh-hant.json');
const ix = { scenes: raw.ev.map(([id, b, s, e, zh, en, q, ok, ru], i) => ({ id, b, s, e, zh, en, ru: ru ?? '', q, ok: ok === 1, i })) };
const queries = ['damascus', '大马色', '大馬色', 'Дамаск', 'Genesis', '创世记', '創世記', 'Бытие', 'world beginning', 'nonexistent'];

// Original byText scoring, including the per-keystroke field construction.
function before(q, bookTitle, hant) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  for (const sc of ix.scenes) {
    const title = `${sc.zh} ${hant(sc.zh)} ${sc.en} ${sc.ru}`.toLowerCase();
    const book = `${bookTitle(sc.b, 'zh')} ${bookTitle(sc.b, 'en')} ${bookTitle(sc.b, 'ru')}`.toLowerCase();
    const body = `${sums.zh[sc.i] ?? ''} ${hant(sums.zh[sc.i] ?? '')} ${sums.en[sc.i] ?? ''} ${sums.ru?.[sc.i] ?? ''}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      else if (book.includes(term)) score += 4;
      else if (body.includes(term)) score += 2;
      else { score = 0; break; }
    }
    if (score) scored.push([score, sc]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].i - b[1].i).slice(0, 12).map((r) => r[1]);
}
for (const locale of ['en', 'zh-Hans', 'zh-Hant', 'ru']) {
  let calls = 0;
  const hant = (s) => {
    calls++;
    if (locale !== 'zh-Hant' || !s) return s;
    return table.phrases[s] ?? s.replace(/[　-〿一-鿿！-･]+/g, (run) => table.phrases[run] ?? [...run].map((ch) => table.chars[ch] ?? ch).join(''));
  };
  const book = (b, l) => l === 'zh' ? hant(BOOKS[b - 1]?.zh ?? '') : l === 'ru' ? BOOKS_RU[b - 1] ?? '' : BOOKS[b - 1]?.en ?? '';
  const t0 = performance.now();
  const expected = [];
  for (let i = 0; i < 10; i++) for (const q of queries) expected.push(before(q, book, hant).map((s) => s.id));
  const beforeMs = performance.now() - t0, beforeCalls = calls;
  calls = 0;
  const t1 = performance.now();
  const index = buildSearchIndex(ix, sums, book, hant);
  const buildMs = performance.now() - t1, buildCalls = calls;
  const t2 = performance.now();
  let n = 0;
  for (let i = 0; i < 10; i++) for (const q of queries) assert.deepEqual(searchIndex(index, q).map((s) => s.id), expected[n++]);
  console.log(JSON.stringify({ locale, scenes: ix.scenes.length, queries: n, identical: true,
    beforeMs: +beforeMs.toFixed(2), indexBuildMs: +buildMs.toFixed(2), afterMs: +(performance.now() - t2).toFixed(2),
    beforeConversions: beforeCalls, indexConversions: buildCalls, afterConversions: calls - buildCalls }));
}
