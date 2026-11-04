// The four readings and how each one spells its own name, read from src/gallery/lang.ts so the bar's markup and the
// menu's behaviour cannot name different languages. Same pattern as scripts/lib/product-name.mjs: the one source is
// the TypeScript the app itself imports, and the build template parses it rather than keeping a second copy.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/gallery/lang.ts'), 'utf8');
const block = /export const LANG_NAMES[^[]*\[([\s\S]*?)\n\];/.exec(src);
if (!block) throw new Error('src/gallery/lang.ts: LANG_NAMES not found');

export const LANGS = [...block[1].matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*tag:\s*'([^']+)'\s*\}/g)]
  .map((m) => ({ id: m[1], name: m[2], tag: m[3] }));

if (LANGS.length !== 4) throw new Error(`src/gallery/lang.ts: expected 4 readings, parsed ${LANGS.length}`);
