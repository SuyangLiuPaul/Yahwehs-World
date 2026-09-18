// Every var(--x) in the stylesheets resolves to something that exists.
//
// Written because two did not. `--lh-loose` and `--sp-8` were never defined,
// and CSS does not complain: an invalid value makes the WHOLE declaration
// invalid, so `padding: 72px 24px var(--sp-8) 24px` threw away the 72px as
// well and the page title rendered underneath the nav bar. The same fault had
// already shipped in nav.css, where one bad line-height inside a `font:`
// shorthand dropped the family, the size and the weight with it.
//
// A typo'd token is silent, it is easy to make, and it breaks more than the
// property it is in. So it is counted.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const files = readdirSync(SRC).filter((f) => f.endsWith('.css'));

const defined = new Set();
// Names a stylesheet may use without defining: set from JavaScript at run time,
// or given a fallback at every use site.
const RUNTIME = new Set(['--footer-height', '--safe-top', '--safe-right', '--safe-bottom', '--safe-left']);
const texts = new Map();
for (const f of files) {
  const s = readFileSync(join(SRC, f), 'utf8');
  texts.set(f, s);
  for (const m of s.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
}
// …and anything an inline style or a module writes.
for (const f of readdirSync(SRC)) {
  if (!f.endsWith('.ts')) continue;
  const s = readFileSync(join(SRC, f), 'utf8');
  for (const m of s.matchAll(/setProperty\(\s*'(--[\w-]+)'/g)) defined.add(m[1]);
}

const missing = [];
let used = 0;
for (const [f, s] of texts) {
  for (const m of s.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    used++;
    const [, name, hasFallback] = m;
    if (defined.has(name) || RUNTIME.has(name) || hasFallback) continue;
    const line = s.slice(0, m.index).split('\n').length;
    missing.push(`${f}:${line}  var(${name}) is used and never defined`);
  }
}

console.log(missing.length
  ? `${missing.length} of ${used} custom-property uses do not resolve:\n` + missing.join('\n')
  : `tokens: all ${used} uses of a custom property resolve (${defined.size} defined)`);
process.exit(missing.length ? 1 : 0);
