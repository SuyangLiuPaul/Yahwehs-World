// First-view transfer budget. Run after `vite build`:
//   node scripts/check-budget.mjs [--dir dist] [--json]
// Exits 1 if any page's first view is over its budget, so it can sit in CI.
//
// "First view" here is what a reader must download before the page's own
// loading screen can lift: the HTML, every script / stylesheet / preload /
// modulepreload / image the HTML names, the shell's own images (nav mark,
// loading mark, tab icon), and the data the page's script fetches at start-up
// (EXTRA below, named by hand because a script's fetch() is not in the HTML).
// It deliberately leaves out what arrives AFTER the screen lifts (terrain
// texture, scene thumbnails, models) and Google Fonts (another origin).
//
// Sizes are on the wire: text is brotli-compressed at quality 5, which is what
// scripts/measure-loading.mjs serves and close to what Netlify sends; images,
// webp, gzip files and glb are counted as they are. The budgets are the sizes
// measured on 2026-11-14 (see docs/loading-audit-2026-11-14.md) plus about 20%,
// so a change that doubles a payload fails and ordinary drift does not. Raise a
// number here only on purpose, in the same commit that says why.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { brotliCompressSync, constants } from 'node:zlib';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DIR = resolve(ROOT, argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'dist');
const KB = 1024;

// page -> { budget in KB (all first-view bytes), js budget in KB, extra start-up data }
const PAGES = {
  'index.html':    { budget: 800,  js: 330, extra: ['/data/places.json', '/data/journeys.json', /^\/assets\/world\.bin-.*\.gz$/] },
  'scenes.html':   { budget: 300,  js: 40,  extra: ['/data/events.json', /^\/assets\/scene-lqip-.*\.json$/] },
  'plan.html':     { budget: 330,  js: 60,  extra: ['/data/events.json', '/data/journeys.json'] },
  // The figures page's cards are 300 KB of lazy JPEGs on top of this (the 3D viewer
  // and three.js load only when a card is opened); the budget is its code.
  'figures.html':  { budget: 80,   js: 40,  extra: [] },
  'bible.html':    { budget: 3100, js: 60,  extra: ['/data/bible/bsb-yhwh.json', '/data/bible/cuvs-yhwh.json', '/data/bible/meta.json', '/data/events.json', '/data/places.json'] },
  // The walks are model pages: their budget is the code and styles needed to
  // start; the models themselves are loaded behind the walk's own progress UI.
  'tabernacle.html': { budget: 480, js: 420, extra: [] },
  'temple.html':     { budget: 470, js: 410, extra: [] },
  // ark.html carries a 465 KB reference JPEG in its own markup, which is most of this.
  'ark.html':        { budget: 950, js: 320, extra: [] },
};

const TEXT = new Set(['.html', '.js', '.css', '.json', '.svg', '.mjs']);
const wire = (file) => {
  const buf = readFileSync(file);
  return TEXT.has(extname(file)) && buf.length > 1024
    ? brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length
    : buf.length;
};
const local = (url) => join(DIR, url.split('?')[0].replace(/^\//, ''));

function refs(html) {
  const out = new Set();
  const tag = /<(script|link|img)\b([^>]*)>/g;
  let m;
  while ((m = tag.exec(html))) {
    const [, name, attrs] = m;
    const get = (a) => (attrs.match(new RegExp(`\\b${a}="([^"]*)"`)) || [])[1];
    const url = name === 'link' ? get('href') : get('src');
    if (!url || !url.startsWith('/') || url.startsWith('//')) continue;
    if (name === 'link') {
      const rel = get('rel') || '';
      if (!/(^|\s)(stylesheet|modulepreload|preload|icon)(\s|$)/.test(rel)) continue;
      if (rel.includes('preload') && !rel.includes('modulepreload') && get('as') !== 'fetch') continue;
    }
    out.add(url);
  }
  return [...out];
}

let bad = 0;
const rows = [];
for (const [page, cfg] of Object.entries(PAGES)) {
  const htmlPath = join(DIR, page);
  if (!existsSync(htmlPath)) { console.error(`FAIL ${page}: not in ${DIR} (run vite build first)`); bad++; continue; }
  const html = readFileSync(htmlPath, 'utf8');
  const files = new Map([[`/${page}`, htmlPath]]);
  for (const u of refs(html)) files.set(u.split('?')[0], local(u));
  for (const e of cfg.extra) {
    if (typeof e === 'string') files.set(e, local(e));
    else {
      const hit = readdirSync(join(DIR, 'assets')).map((f) => `/assets/${f}`).find((f) => e.test(f));
      if (hit) files.set(hit, local(hit)); else { console.error(`FAIL ${page}: no file in dist/assets matches ${e}`); bad++; }
    }
  }
  let total = 0, js = 0;
  const missing = [];
  const parts = [];
  for (const [url, path] of files) {
    if (!existsSync(path) || !statSync(path).isFile()) { missing.push(url); continue; }
    const w = wire(path);
    total += w;
    if (extname(path) === '.js') js += w;
    parts.push([w, url]);
  }
  parts.sort((a, b) => b[0] - a[0]);
  const over = total > cfg.budget * KB, jsOver = js > cfg.js * KB;
  rows.push({ page, kb: +(total / KB).toFixed(0), budget: cfg.budget, jsKb: +(js / KB).toFixed(0), jsBudget: cfg.js, files: files.size, top: parts.slice(0, 3).map(([w, u]) => `${(w / KB).toFixed(0)} KB ${u}`) });
  if (missing.length) { console.error(`FAIL ${page}: referenced but not in dist: ${missing.join(', ')}`); bad++; }
  if (over) { console.error(`FAIL ${page}: first view ${(total / KB).toFixed(0)} KB > budget ${cfg.budget} KB. Largest: ${parts.slice(0, 3).map(([w, u]) => `${(w / KB).toFixed(0)} KB ${u}`).join('; ')}`); bad++; }
  if (jsOver) { console.error(`FAIL ${page}: first-view JS ${(js / KB).toFixed(0)} KB > budget ${cfg.js} KB`); bad++; }
}

if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else for (const r of rows) console.log(`${r.page.padEnd(16)} ${String(r.kb).padStart(5)} / ${String(r.budget).padStart(5)} KB   js ${String(r.jsKb).padStart(4)} / ${String(r.jsBudget).padStart(4)} KB   ${r.files} files   ${r.top[0] ?? ''}`);
console.log(bad ? `${bad} problem(s)` : 'ok: every first view is inside its budget');
process.exit(bad ? 1 : 0);
