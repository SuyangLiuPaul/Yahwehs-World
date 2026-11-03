// Adds the service worker, the manifests and the offline page to a built gallery dist (what the build does itself at its end).
//   node scripts/build-pwa.mjs [--dir dist]
// Safe to run again on the same directory; verify-pwa.mjs uses it to simulate a deploy.
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPwa } from './lib/pwa-build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dist = resolve(ROOT, argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'dist');
await buildPwa({ root: ROOT, dist });
