// The product name's Chinese spellings, read from src/config/site.ts (the one source) so the build templates never carry a literal.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/config/site.ts'), 'utf8');
const m = /export const NAME_ZH = \{ hans: '([^']+)', hant: '([^']+)' \}/.exec(site);
if (!m) throw new Error('src/config/site.ts: NAME_ZH not found');
export const NAME_HANS = m[1];
export const NAME_HANT = m[2];
