// The gallery's pictures: gate-passed text-free squares -> the site's own webp files.
//
//   node scripts/build-pictures.mjs [--scenes-root /Volumes/T7/yahwehs-globe-scenes] [--force] [--dry]
//
// Why this exists. Until the gallery surface, every plate was served from another host
// (https://yahwehs-scenes.netlify.app, merged bilingual JPEGs with the words burned into the
// pixels). The gallery serves the TEXT-FREE square (handoff/fable-gallery-release-2026-11-03.md §5):
// one picture for every language, every word beside it as HTML. This script is the only way a
// picture reaches the site:
//
//   1. It asks the same read-only gate the pipeline uses (tools/scenes/gate_check.py square --all)
//      which of the 1,443 squares pass. Only a pass is ever copied. A square that does not pass, and
//      is not on the owner's exclusion list, is NOT served: it gets the plain placeholder plate, so
//      no deep link breaks and no unreviewed picture reaches a reader.
//   2. A passing square becomes public/pictures/thumb/<id>.webp (480 px, the grid) and
//      public/pictures/full/<id>.webp (1344 px). The conversion is skipped when the source's gate
//      SHA-256 is unchanged, so a re-run costs seconds.
//   3. data/gallery/pictures.json records, per id: state, the gate's SHA-256 of the source,
//      the SHA-256 of the served full file, the colour placeholder and the aspect. verify-gallery.mjs
//      re-hashes dist against it, so "the picture on the site is the picture the gate passed" is a
//      check, not a belief.
//
// public/pictures/ is gitignored (about 260 MB); data/gallery/pictures.json is committed (it is a build
// input and a verification record, not something a reader downloads: scripts/build-gallery-data.mjs
// folds the part a page needs into public/data/gallery/index.json).
// It needs the T7 drive, Pillow (webp) and cwebp-free Python 3; the site build itself does not.
//
// Owner exclusions: tools/scenes/release-exclusions.json  { "excluded": [{ "id": "...", "reason": "..." }] }
// (absent = none). An excluded event keeps its page and shows the placeholder plate; `state: "excluded"`.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);

const SCENES_ROOT = opt('scenes-root', process.env.SCENES_ROOT || '/Volumes/T7/yahwehs-globe-scenes');
const LIVE = join(SCENES_ROOT, 'no-text-derivatives-v2', 'live');
const OUT = join(ROOT, 'public', 'pictures');
const INDEX = join(ROOT, 'data', 'gallery', 'pictures.json');
const EXCL = join(ROOT, 'tools', 'scenes', 'release-exclusions.json');

if (!existsSync(LIVE)) {
  console.error(`build-pictures: ${LIVE} is not there (is the T7 drive mounted?). Nothing was changed.`);
  process.exit(2);
}

const events = JSON.parse(readFileSync(join(ROOT, 'public/data/events.json'), 'utf8')).events;
const ids = events.map((e) => e.id);

const excluded = new Map();
if (existsSync(EXCL)) {
  for (const x of JSON.parse(readFileSync(EXCL, 'utf8')).excluded ?? []) excluded.set(x.id, x.reason ?? '');
}

// ── 1. the gate ───────────────────────────────────────────────────────────
console.log('build-pictures: asking the gate (read-only)…');
const gateRaw = spawnSync('python3', ['-I', join(ROOT, 'tools/scenes/gate_check.py'), 'square', '--all', '--json', '--scenes-root', SCENES_ROOT],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (!gateRaw.stdout) { console.error(gateRaw.stderr); process.exit(2); }
const gate = JSON.parse(gateRaw.stdout);
const verdict = new Map(gate.items.map((i) => [i.id, i]));
const vetoTable = gate.summary.vetoTableSha256;

const prev = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : { p: {} };
const filesOk = (id) => existsSync(join(OUT, 'thumb', `${id}.webp`)) && existsSync(join(OUT, 'full', `${id}.webp`));

// ── 2. what to convert ───────────────────────────────────────────────────
const jobs = [];
const plan = {};
for (const id of ids) {
  const v = verdict.get(id);
  const pass = !!v?.pass && !excluded.has(id);
  const sha = v?.measured?.sha256 ?? '';
  const old = prev.p?.[id];
  const state = excluded.has(id) ? 'excluded' : pass ? 'pass' : 'hold';
  plan[id] = { state, sha, reasons: pass ? [] : (v?.reasons ?? [{ code: 'not_in_gate' }]).slice(0, 3).map((r) => (r.detail ? `${r.code}:${r.detail}` : r.code)) };
  const same = old && old.state === state && (state !== 'pass' || old.sha === sha) && filesOk(id);
  if (same && !flag('force')) continue;
  const job = { id, thumb: join(OUT, 'thumb', `${id}.webp`), full: join(OUT, 'full', `${id}.webp`) };
  if (state === 'pass') job.src = join(LIVE, `${id}.png`);
  else job.placeholder = true;
  jobs.push(job);
}
const nPass = Object.values(plan).filter((x) => x.state === 'pass').length;
console.log(`build-pictures: gate ${gate.summary.pass} pass / ${gate.summary.fail} fail of ${gate.summary.checked}; ` +
  `${excluded.size} owner-excluded; ${jobs.length} files to write`);
if (flag('dry')) process.exit(0);

// ── 3. convert ───────────────────────────────────────────────────────────
mkdirSync(join(OUT, 'thumb'), { recursive: true });
mkdirSync(join(OUT, 'full'), { recursive: true });
const results = new Map();
if (jobs.length) {
  // The placeholder plate is rendered once; its bytes are copied for the others.
  const ph = jobs.filter((j) => j.placeholder);
  const real = jobs.filter((j) => !j.placeholder);
  const run = (list) => {
    const r = spawnSync('python3', ['-I', join(ROOT, 'scripts/lib/pictures_convert.py')],
      { input: JSON.stringify(list), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) { console.error(r.stderr); process.exit(2); }
    return JSON.parse(r.stdout);
  };
  if (ph.length) {
    const [first, ...rest] = ph;
    for (const r of run([first])) results.set(r.id, r);
    for (const j of rest) {
      copyFileSync(first.thumb, j.thumb);
      copyFileSync(first.full, j.full);
      results.set(j.id, { ...results.get(first.id), id: j.id });
    }
  }
  if (real.length) for (const r of run(real)) results.set(r.id, r);
}
const failed = [...results.values()].filter((r) => r.error);
for (const f of failed) console.error(`  convert failed: ${f.id}: ${f.error}`);

// ── 4. the index ─────────────────────────────────────────────────────────
const p = {};
let thumbBytes = 0, fullBytes = 0;
for (const id of ids) {
  const r = results.get(id);
  const old = prev.p?.[id];
  const base = plan[id];
  const entry = { state: base.state };
  if (base.state === 'pass') entry.sha = base.sha;
  else entry.why = base.reasons.length ? base.reasons : (excluded.get(id) ? [excluded.get(id)] : []);
  if (r && !r.error) {
    entry.q = r.lqip; entry.h = r.fullSha;
    if (base.state === 'pass') { entry.w = r.w; entry.ht = r.h; }
  } else if (old && !r?.error) {
    for (const k of ['q', 'h', 'w', 'ht']) if (old[k] !== undefined) entry[k] = old[k];
  }
  p[id] = entry;
  for (const kind of ['thumb', 'full']) {
    const f = join(OUT, kind, `${id}.webp`);
    if (existsSync(f)) (kind === 'thumb' ? (thumbBytes += statSync(f).size) : (fullBytes += statSync(f).size));
  }
}
const index = {
  v: 1,
  gate: { pass: gate.summary.pass, fail: gate.summary.fail, checked: gate.summary.checked, vetoTable },
  served: nPass,
  excluded: excluded.size,
  p,
};
mkdirSync(dirname(INDEX), { recursive: true });
writeFileSync(INDEX, JSON.stringify(index) + '\n');
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`build-pictures: ${nPass} squares served, ${ids.length - nPass} placeholders; ` +
  `public/pictures = thumbs ${mb(thumbBytes)} MB + full ${mb(fullBytes)} MB = ${mb(thumbBytes + fullBytes)} MB`);
if (failed.length) process.exit(1);
