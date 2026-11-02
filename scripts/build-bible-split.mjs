// Splits the Bible reader's data by book so /bible.html loads the one book it
// is showing, not all 66 books in two languages (loading audit 2026-11-14,
// "What remains" 1). Nothing here is new content: every byte is cut out of
// files that already exist, and --check proves the pieces put back together
// equal the originals.
//
//   node scripts/build-bible-split.mjs           write public/data/bible/split/
//   node scripts/build-bible-split.mjs --check   rebuild in memory, compare to disk and to the sources
//
// Inputs (kept, still used by the epub/pdf builders and by full-text search):
//   public/data/bible/{bsb,cuvs,cuvt}-yhwh.json   { books: string[book][chapter][verse] }
//   public/data/bible/meta.json                   intros, paraStarts, refVerses, wordsSections, referents, stats
//   public/data/events.json                       1,443 events (each has b = book 1..66)
// Outputs, under public/data/bible/split/:
//   core.json              { chapters: number[66] }  chapter count per book (the pickers need all 66 at once)
//   text/<tr>/<n>.json     string[chapter][verse] for book n, tr = bsb | cuvs | cuvt
//   book/<n>.json          { intro, paraStarts, refVerses, words, events }  for book n only
//                          events carry `ci`, the event's 1-based position in events.json (the
//                          reader numbers sections by it)
// `meta.referents` (385 KB raw) is not written anywhere: nothing in src/ reads it.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public/data/bible');
const OUT = join(SRC, 'split');
const CHECK = process.argv.includes('--check');
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const bookOf = (vid) => Math.floor(vid / 1_000_000);

const meta = read(join(SRC, 'meta.json'));
const events = read(join(ROOT, 'public/data/events.json')).events;
const TR = ['bsb', 'cuvs', 'cuvt'];
const corpus = Object.fromEntries(TR.map((t) => [t, read(join(SRC, `${t}-yhwh.json`)).books]));
const nBooks = corpus.cuvs.length;
if (nBooks !== 66) throw new Error(`expected 66 books, got ${nBooks}`);
for (const t of TR) if (corpus[t].length !== 66) throw new Error(`${t}: ${corpus[t].length} books`);

const files = new Map(); // relative path -> JSON text
const put = (rel, obj) => files.set(rel, JSON.stringify(obj));

put('core.json', { chapters: corpus.cuvs.map((b) => b.length) });
for (const t of TR) for (let i = 0; i < 66; i++) put(`text/${t}/${i + 1}.json`, corpus[t][i]);

const paraByBook = Array.from({ length: 67 }, () => []);
for (const v of meta.paraStarts) paraByBook[bookOf(v)].push(v);
const refByBook = Array.from({ length: 67 }, () => []);
for (const v of meta.refVerses ?? []) refByBook[bookOf(v)].push(v);
const wordsByBook = Array.from({ length: 67 }, () => ({}));
for (const [k, w] of Object.entries(meta.wordsSections ?? {})) wordsByBook[bookOf(Number(k))][k] = w;
const evByBook = Array.from({ length: 67 }, () => []);
events.forEach((ev, idx) => evByBook[ev.b].push({ ...ev, ci: idx + 1 }));
for (let b = 1; b <= 66; b++) {
  put(`book/${b}.json`, { intro: meta.intros[b - 1] ?? null, paraStarts: paraByBook[b], refVerses: refByBook[b], words: wordsByBook[b], events: evByBook[b] });
}

if (!CHECK) {
  for (const [rel, text] of files) {
    const f = join(OUT, rel);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, text);
  }
  console.log(`wrote ${files.size} files to ${OUT}`);
  process.exit(0);
}

// --check: the files on disk are exactly what a rebuild would write, and they
// reassemble to the originals.
let bad = 0;
const fail = (m) => { bad++; console.error('FAIL ' + m); };
for (const [rel, text] of files) {
  const f = join(OUT, rel);
  if (!existsSync(f)) fail(`missing ${rel}`);
  else if (readFileSync(f, 'utf8') !== text) fail(`stale ${rel}`);
}
const onDisk = [];
const walk = (d, p = '') => { for (const e of readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(join(d, e.name), p + e.name + '/') : onDisk.push(p + e.name); };
if (existsSync(OUT)) walk(OUT);
for (const rel of onDisk) if (!files.has(rel)) fail(`unexpected ${rel}`);
const back = (rel) => JSON.parse(files.get(rel));
for (const t of TR) {
  const again = Array.from({ length: 66 }, (_, i) => back(`text/${t}/${i + 1}.json`));
  if (JSON.stringify(again) !== JSON.stringify(corpus[t])) fail(`${t}: reassembled text differs`);
}
const parts = Array.from({ length: 66 }, (_, i) => back(`book/${i + 1}.json`));
if (JSON.stringify(parts.flatMap((p) => p.paraStarts)) !== JSON.stringify(meta.paraStarts)) fail('paraStarts differ');
if (JSON.stringify(parts.flatMap((p) => p.refVerses)) !== JSON.stringify(meta.refVerses ?? [])) fail('refVerses differ');
if (JSON.stringify(parts.map((p) => p.intro)) !== JSON.stringify(meta.intros.map((x) => x ?? null))) fail('intros differ');
const words = Object.assign({}, ...parts.map((p) => p.words));
if (JSON.stringify(Object.keys(words).sort()) !== JSON.stringify(Object.keys(meta.wordsSections ?? {}).sort())) fail('wordsSections keys differ');
for (const k of Object.keys(words)) if (JSON.stringify(words[k]) !== JSON.stringify(meta.wordsSections[k])) { fail(`wordsSections ${k} differs`); break; }
const evBack = parts.flatMap((p) => p.events).sort((a, b) => a.ci - b.ci).map(({ ci, ...ev }) => ev);
if (JSON.stringify(evBack) !== JSON.stringify(events)) fail('events differ');
if (back('core.json').chapters.some((n, i) => n !== corpus.cuvt[i].length || n !== corpus.cuvs[i].length)) fail('chapter counts differ between cuvs and cuvt');
if (corpus.bsb.some((b, i) => b.length !== corpus.cuvs[i].length)) console.warn('note: bsb chapter counts differ from cuvs in some books (the reader uses the Chinese count)');
console.log(bad ? `${bad} problem(s)` : `ok: ${files.size} files, reassemble to the originals`);
process.exit(bad ? 1 : 0);
