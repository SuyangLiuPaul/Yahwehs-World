// Owner's rule (2026-11-03): the year 1919 is never written anywhere a visitor can read it. The reader module's own test walks
// its catalogue and headings; this one walks everything else the gallery surface ships or builds from: its pages, its sources,
// its captions (titles and summaries in four readings), the reader's data, the Words-derived verse text, and the generated
// edition catalogue. (scripts/verify-gallery.mjs scans the built dist/ for the same thing.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
// not part of a longer number or a hash
const YEAR = /(?<![0-9a-fA-F])1919(?![0-9a-fA-F])/;

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p); else yield p;
  }
}
const hits = (files: Iterable<string>) => [...files].filter((f) => YEAR.test(readFileSync(f, 'utf8'))).map((f) => f.slice(ROOT.length + 1));

test('no gallery page, source or stylesheet writes 1919', () => {
  const files = [
    ...['home.html', 'gallery-scenes.html', 'gallery-bible.html'].map((f) => join(ROOT, f)),
    ...[...walk(join(ROOT, 'src/gallery')), ...walk(join(ROOT, 'src/reader'))].filter((f) => /\.(ts|css|json)$/.test(f)),
    join(ROOT, 'scripts/lib/vite-gallery-surface.mjs'),
  ];
  assert.deepEqual(hits(files), []);
});

test('no caption in any reading writes 1919 (titles and summaries: en, zh, ru; the editorial overrides)', () => {
  const files = [...walk(join(ROOT, 'public/data/gallery')), ...walk(join(ROOT, 'data/gallery'))].filter((f) => extname(f) === '.json');
  assert.ok(files.length >= 3);
  assert.deepEqual(hits(files), []);
});

test('no edition text, heading, paragraph table or credit line in the reader data writes 1919', () => {
  const dir = join(ROOT, 'public/data/reader');
  if (!existsSync(dir)) { console.warn('public/data/reader is not built here (npm run reader:data): the verse text was not scanned'); return; }
  const files = [...walk(dir)].filter((f) => extname(f) === '.json');
  assert.ok(files.length > 800, `${files.length} reader data files`);
  assert.deepEqual(hits(files), []);
});
