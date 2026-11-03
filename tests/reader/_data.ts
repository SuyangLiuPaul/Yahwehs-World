// Test helpers: the generated reader data (built on demand) and the Words checkout (optional).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BookHeadings, BookText } from '../../src/reader/types.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = join(ROOT, 'public/data/reader');
export const WORDS = process.env.WORDS_PATH ?? '/Volumes/androidbuild/Words-184';
export const hasWords = existsSync(join(WORDS, 'assets/kjv.json'));

if (!existsSync(join(DATA, 'catalogue.json'))) {
  // The data is generated, not committed: build it the way `npm run reader:data` does.
  execFileSync('node', [join(ROOT, 'scripts/reader-editions.mjs'), '--words', WORDS], { stdio: 'inherit' });
}

export const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(DATA, rel), 'utf8')) as T;
export const text = (ed: string, book: number): BookText => readJson<BookText>(`text/${ed}/${book}.json`);
export const headings = (set: string, book: number): BookHeadings => readJson<BookHeadings>(`headings/${set}/${book}.json`);
export const EDITION_IDS = ['bsb-yhwh', 'kjv', 'web-yhwh', 'asv-yhwh', 'cuvs-yhwh', 'cuvs-yhwh-tr', 'rst-yhwh', 'rst'] as const;

/** All verses of an edition as [book, chapter, verse, raw text]. */
export function* allVerses(ed: string): Generator<[number, number, number, string]> {
  for (let b = 1; b <= 66; b++) {
    const t = text(ed, b);
    for (let c = 0; c < t.length; c++) for (let v = 0; v < t[c]!.length; v++) { const s = t[c]![v]; if (s != null) yield [b, c + 1, v + 1, s]; }
  }
}
