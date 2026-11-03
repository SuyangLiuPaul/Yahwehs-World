// After `vite build` with VITE_TARGET=shell (npm run app:dist): turn dist-shell/ into exactly what a native app carries.
//
//   1. removes what only a website needs: the 1,443 share stubs (/p/<id>), sitemap, robots, _redirects, and the PWA files
//      (service worker, offline page, manifests, install icons): a service worker must never be registered under tauri://localhost
//   2. writes data/packs.json: the offline-pack manifest (src/core/packs.ts reads it): the bundled thumbnails and Bible data
//      (so the app can say how much it already carries) and the full pictures the site serves (byte count and SHA-256 per file)
//   3. prints the size table and fails when the bundle is over the budget (docs/gallery-shells.md: 100 MiB for shell + thumbnails + Bible data)
//
// Reads public/pictures/full (the same files the site serves, built by scripts/build-pictures.mjs) for the pack; writes only dist-shell/.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, process.env.VITE_OUT_DIR || 'dist-shell');
const SITE_HOST = /export const SITE_HOST = '([^']+)'/.exec(readFileSync(join(ROOT, 'src/config/site.ts'), 'utf8'))?.[1];
if (!SITE_HOST) throw new Error('src/config/site.ts: SITE_HOST not found');
export const BUDGET_BYTES = 100 * 1024 * 1024;

const MiB = (n) => `${(n / 1048576).toFixed(1)} MiB`;
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, base));
    else out.push({ rel: relative(base, p).split('\\').join('/'), abs: p, bytes: st.size });
  }
  return out;
}

if (!existsSync(join(OUT, 'index.html'))) throw new Error(`${OUT} has no index.html: run npm run app:dist`);

// 1. what only the website needs
const REMOVE = ['p', 'sitemap.xml', 'robots.txt', '_redirects', 'sw.js', 'offline.html', 'pwa', 'version.json.map'];
for (const name of readdirSync(OUT)) {
  if (REMOVE.includes(name) || /^manifest.*\.webmanifest$/.test(name)) rmSync(join(OUT, name), { recursive: true, force: true });
}

// 2. the pack manifest
const pack = (id, bundled, path, files) => ({
  id, bundled, path,
  bytes: files.reduce((n, f) => n + f.bytes, 0),
  files: files.map((f) => [f.name, f.bytes, f.sha]),
});
const filesOf = (dir) => walk(dir).map((f) => ({ name: f.rel, bytes: f.bytes, sha: sha256(f.abs) }));

const thumbDir = join(OUT, 'pictures/thumb');
const fullDir = join(ROOT, 'public/pictures/full');
const readerDir = join(OUT, 'data/reader');
for (const [what, dir] of [['thumbnails', thumbDir], ['full pictures', fullDir], ['Bible data', readerDir]]) {
  if (!existsSync(dir)) throw new Error(`missing ${what}: ${dir}`);
}
if (existsSync(join(OUT, 'pictures/full'))) throw new Error('dist-shell carries pictures/full: the shell must fetch full pictures from the site');
const thumbs = filesOf(thumbDir);
const full = filesOf(fullDir);
const reader = filesOf(readerDir);
const packs = [pack('thumbs', true, 'pictures/thumb', thumbs), pack('full', false, 'pictures/full', full), pack('editions', true, 'data/reader', reader)];
const version = createHash('sha256').update(JSON.stringify(packs.map((p) => [p.id, p.files]))).digest('hex').slice(0, 12);
mkdirSync(join(OUT, 'data'), { recursive: true });
writeFileSync(join(OUT, 'data/packs.json'), `${JSON.stringify({ v: 1, version, host: SITE_HOST, packs })}\n`);

// 3. sizes
const all = walk(OUT);
const total = all.reduce((n, f) => n + f.bytes, 0);
const under = (prefix) => all.filter((f) => f.rel.startsWith(prefix)).reduce((n, f) => n + f.bytes, 0);
const rows = [
  ['thumbnails (pictures/thumb)', under('pictures/thumb/'), `${thumbs.length} files`],
  ['Bible data (data/reader)', under('data/reader/'), `${reader.length} files`],
  ['code, pages, other', total - under('pictures/thumb/') - under('data/reader/'), ''],
  ['bundle total (dist-shell)', total, `${all.length} files`],
  ['full pictures (fetched, not bundled)', packs[1].bytes, `${full.length} files`],
];
console.log(`[shell-dist] pack version ${version}, host ${SITE_HOST}`);
for (const [k, n, note] of rows) console.log(`[shell-dist] ${k.padEnd(40)} ${MiB(n).padStart(11)}  ${note}`);
writeFileSync(join(OUT, 'shell-sizes.json'), `${JSON.stringify({ totalBytes: total, thumbBytes: under('pictures/thumb/'), readerBytes: under('data/reader/'), fullBytes: packs[1].bytes, budgetBytes: BUDGET_BYTES, version }, null, 2)}\n`);
if (total > BUDGET_BYTES) {
  console.error(`[shell-dist] OVER BUDGET: ${MiB(total)} > ${MiB(BUDGET_BYTES)}`);
  process.exit(1);
}
