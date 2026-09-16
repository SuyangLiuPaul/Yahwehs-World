// Writes public/version.json — what a deployed site answers when asked which
// release it is serving. tools/release_web.sh re-fetches it after a deploy to
// decide whether the deploy actually landed, on the principle that the CLI's
// exit code cannot carry a state the service sets afterwards.
//
// Generated at build time rather than committed, so it cannot disagree with
// package.json. ALWAYS the plain release version: a dev build's trailing
// number is for a reader to see, and anything that compares versions — this
// file, the update check in src/updates.ts, Android's versionCode — reads the
// release version alone.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
writeFileSync(join(ROOT, 'public/version.json'), JSON.stringify({ version }) + '\n');
console.log(`version.json: ${version}`);
