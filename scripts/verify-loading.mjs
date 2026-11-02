// Static checks for the opening screen (no browser needed).
//   node scripts/verify-loading.mjs
// 1. every page carries the loading block with one live region (role=status,
//    aria-busy) and the retry state, and the critical CSS is inline;
// 2. the Google Fonts stylesheet is not render-blocking on any page;
// 3. index.html preloads exactly the URLs src/main.ts fetches (same ?v=);
// 4. nothing in src/*.css redefines the #loading rules (they live in the head).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index', 'bible', 'scenes', 'tabernacle', 'temple', 'ark', 'figures', 'plan'];
let bad = 0;
const fail = (m) => { bad++; console.error('FAIL ' + m); };

for (const p of pages) {
  const h = readFileSync(join(ROOT, p + '.html'), 'utf8');
  if ((h.match(/id="loading" role="status"/g) || []).length !== 1 || !h.includes('id="loading" role="status" aria-live="polite" aria-busy="true"')) fail(`${p}: needs exactly one loading live region`);
  if (!h.includes('id="loading-retry"')) fail(`${p}: no retry state`);
  if (!/<style>[^<]*#loading\{position:fixed/.test(h)) fail(`${p}: critical CSS not inline`);
  const font = h.match(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/g) || [];
  if (font.length !== 2) fail(`${p}: expected font link + noscript twin, got ${font.length}`);
  if (font[0] && !font[0].includes('media="print"')) fail(`${p}: fonts stylesheet blocks rendering`);
  if (/<img id="loading-globe"[^>]*>/.test(h) && !/<img id="loading-globe"[^>]*width="180" height="180"/.test(h)) fail(`${p}: loading globe has no explicit size`);
}

const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
const ver = main.match(/\$\{u\}\?v=([0-9-]+)/)?.[1];
const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
const pre = [...idx.matchAll(/<link rel="preload" as="fetch" crossorigin href="([^"]+)"/g)].map((m) => m[1]);
const fetched = [...main.matchAll(/\bj<.*?>\('(\/data\/[^']+)'\)/g)].map((m) => m[1]);
if (!ver) fail('main.ts: could not find the ?v= version');
if (fetched.length < 6) fail(`main.ts: found ${fetched.length} start-up fetches, expected 6`);
for (const u of fetched) if (!pre.includes(`${u}?v=${ver}`)) fail(`index.html does not preload ${u}?v=${ver}`);
for (const u of pre) if (!fetched.some((f) => u === `${f}?v=${ver}`)) fail(`index.html preloads ${u} that main.ts no longer fetches`);

for (const f of readdirSync(join(ROOT, 'src')).filter((f) => f.endsWith('.css'))) {
  if (/^\s*#loading(-globe|-bar)?\s*[{,.]/m.test(readFileSync(join(ROOT, 'src', f), 'utf8'))) fail(`src/${f} redefines #loading (belongs in build-shell.mjs)`);
}
console.log(bad ? `${bad} problem(s)` : `ok: ${pages.length} pages, ${pre.length} preloads`);
process.exit(bad ? 1 : 0);
