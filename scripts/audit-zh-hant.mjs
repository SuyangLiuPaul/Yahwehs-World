// npm run audit:zh-hant — what a 繁體 reader would still see in Simplified characters.
//
// Replays src/locale.ts's hant() (whole-string phrase, then per-run phrase, then the character map) over every Chinese string the
// app can put on screen, and flags every output character that has a distinct Traditional form (OpenCC cn -> tw changes it) and is not one
// of the ambiguous characters the generator refuses to guess (those are judged by phrase instead: the output must equal OpenCC's phrase
// conversion of the source). Exit 1 when anything is left, so it can stand in a gate. The table is built by scripts/build-zh-hant.mjs.
//
// The scan itself lives in scripts/lib/zh-strings.mjs and the BUILDER imports the same function, so this check can no longer be
// green over a smaller set of strings than the table was built from. It was: both scripts matched quoted literals with a regex that
// desynchronised on the apostrophe in "Artist's impression", so the credit line under every picture — '画家的想象 · AI 辅助绘制,
// 逐节审核' — was in neither, and 辅 never reached the character table. The sources now covered are src/ and scripts/lib/ code
// (strings AND template chunks), the build templates, every .html page (data-zh, data-zh-narrow, data-zh-text, data-aria-zh, title,
// content and element text), the runtime JSON payloads, and the store listing.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';
import { HAS_CJK, CJK_RUN, collectStrings } from './lib/zh-strings.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const convert = OpenCC.Converter({ from: 'cn', to: 'tw' });
const AMBIGUOUS = new Set('后里干发台只系制钟面复历板谷丑松咸范曲尽借划卷折苏注致御志表胡斗出着价别');
const table = JSON.parse(readFileSync(process.env.ZH_TABLE ?? join(ROOT, 'public/data/zh-hant.json'), 'utf8'));

// the replica of locale.ts hant()
const hant = (s) => {
  if (table.phrases[s] !== undefined) return table.phrases[s];
  return s.replace(CJK_RUN, (run) => {
    if (table.phrases[run] !== undefined) return table.phrases[run];
    let out = ''; for (const ch of run) out += table.chars[ch] ?? ch; return out;
  });
};

const strings = collectStrings(ROOT);

// valid Traditional characters that OpenCC would still map (征戰, 僕倒, 岳母, 占卜, 游, 裏)
const VALID_TRAD = new Set('征仆岳占游裏凶');
const hanOnly = (ch) => ch !== convert(ch) && !VALID_TRAD.has(ch);
const leftovers = new Map(); // char -> {count, sample, where}
let badStrings = 0, phraseMismatch = 0;
const mismatchSamples = [];
for (const [s, where] of strings) {
  const out = hant(s);
  let bad = false;
  for (const ch of out) {
    if (!HAS_CJK.test(ch) || AMBIGUOUS.has(ch) || !hanOnly(ch)) continue;
    bad = true;
    const e = leftovers.get(ch) ?? { count: 0, sample: out.slice(0, 40), where };
    e.count++; leftovers.set(ch, e);
  }
  if (bad) badStrings++;
  // an ambiguous character (后 里 发 ...) is judged by phrase: if OpenCC converts the source and the reader gets it back unchanged, it is a miss
  if ([...s].some((c) => AMBIGUOUS.has(c)) && out === s && convert(s) !== s) { phraseMismatch++; if (mismatchSamples.length < 12) mismatchSamples.push(`${where}: ${s.slice(0, 30)} -> ${out.slice(0, 30)}`); }
}
console.log(`strings audited: ${strings.size}`);
console.log(`strings with a leftover Simplified-only character: ${badStrings}`);
console.log(`leftover characters (distinct): ${leftovers.size}, occurrences: ${[...leftovers.values()].reduce((a, e) => a + e.count, 0)}`);
for (const [ch, e] of [...leftovers].sort((a, b) => b[1].count - a[1].count).slice(0, 25)) console.log(`  ${ch} x${e.count}  ${e.where}  ${e.sample}`);
console.log(`strings with an ambiguous character that OpenCC converts and the reader gets unchanged: ${phraseMismatch}`);
for (const m of mismatchSamples) console.log(`  ${m}`);
process.exit(badStrings === 0 && phraseMismatch === 0 ? 0 : 1);
