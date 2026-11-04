// A ratchet on the church vocabulary inside the Bible reader's own notes.
//
// The gallery captions are clean and gated (scripts/verify-gallery.mjs reads
// scripts/lib/church-vocabulary.mjs). The Bible reader's BOOK INTRODUCTIONS and
// SECTION-TITLE BACKGROUND NOTES are not: `public/data/bible/meta.json` and
// `public/data/bible/split/book/*.json` are built by
// scripts/build-bible-book-data.mjs from a SIBLING snapshot
// (`../Words-reading-plan-20261015/assets`, `../SeekSparks/assets`) that still
// carries the vocabulary the Words and Sword release trees have cleaned to
// zero. As served today: 8 × 神性, 8 × 道成肉身, 110 × 祂 and more. Re-running
// that build against the snapshot makes it WORSE (19 / 15 / 175), so the fix is
// to point the build at the cleaned source — which also brings a modernised
// Union Version text (豫备 → 预备, 希利尼 → 希腊, 该撒 → 凯撒, 巡抚 → 总督).
// That is an owner decision, not a sweep.
//
// Until it is taken, this ratchet pins the counts so they cannot grow, and
// prints them so nobody has to rediscover the problem. Scripture's own words
// are excluded: 神性 stands in Acts 17:29 and Rom 1:20 of the Union Version,
// 本体 in Heb 1:3, so `split/text/**` (the verse text) is not scanned.
//
//   node scripts/verify-bible-notes-vocabulary.mjs [--print]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZH, EN, RU } from './lib/church-vocabulary.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TERMS = [...ZH, ...EN, ...RU];

/** What is served today, 2026-11-04, measured by this script.
 *
 * These are OCCURRENCES ACROSS FILES, not distinct notes: `meta.json` and
 * `split/book/<n>.json` carry the same introductions and background notes, so
 * one sentence is counted twice (and a Traditional form once more). The numbers
 * are a ceiling to ratchet down, not a census.
 *
 * Lower it when the source is refreshed; never raise it. */
const CEILING = {
  '祂': 247,
  '神性': 19,
  '道成肉身': 17,
  '三一': 10,
  '完全是神': 4,
  '完全是人': 4,
  'trinit': 4,
  '圣子': 3,
  '圣父': 3,
  '聖子': 2,
  '聖父': 2,
  'fully god': 2,
  'fully man': 2,
  'his deity': 2,
  'pre-incarnate': 2,
  'incarnat': 2,
  '本体': 1,
  '本體': 1,
};

const files = [join(ROOT, 'public/data/bible/meta.json')];
const bookDir = join(ROOT, 'public/data/bible/split/book');
try {
  for (const f of readdirSync(bookDir)) if (f.endsWith('.json')) files.push(join(bookDir, f));
} catch {
  // split/ is regenerated; absent is not a failure here
}

const counts = {};
for (const f of files) {
  if (!statSync(f).isFile()) continue;
  const s = readFileSync(f, 'utf8');
  const low = s.toLowerCase();
  for (const t of TERMS) {
    const hay = /[a-z]/.test(t) ? low : s;
    let n = 0;
    for (let i = hay.indexOf(t); i !== -1; i = hay.indexOf(t, i + t.length)) n += 1;
    if (n) counts[t] = (counts[t] ?? 0) + n;
  }
}

let bad = 0;
const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
for (const [t, n] of rows) {
  const max = CEILING[t] ?? 0;
  const ok = n <= max;
  if (!ok) bad += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${t}: ${n} (ceiling ${max})`);
}
for (const [t, max] of Object.entries(CEILING)) {
  if (max > 0 && !(t in counts)) console.log(`ok   ${t}: 0 — the ceiling of ${max} can come down`);
}
if (bad) {
  console.error(`\n${bad} term(s) above the ceiling: the Bible-reader notes gained church-forbidden vocabulary.`);
  process.exit(1);
}
console.log(`\nall ${rows.length} terms at or under the 2026-11-04 ceiling (the ceiling itself is the open item)`);
