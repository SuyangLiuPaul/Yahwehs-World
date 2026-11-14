// Builds public/data/zh-hant.json — the Simplified → Traditional table the
// app loads when a reader is in 繁體.
//
// Two sources, in this order of authority:
//
//   1. places.json's own `zh` → `zhHant` pairs. Those come from the CUV
//      traditional gazetteer (see scripts/lib/zh-names.mjs), so they are a
//      published reading of the name, not a transformation of ours. They win.
//   2. OpenCC (cn → tw) for everything else: journey prose, scene captions,
//      inventory labels, the UI strings in src/*.ts, the build templates'
//      own Chinese, the store listing, and the data-zh attributes in the
//      HTML. OpenCC resolves the one-to-many characters by phrase —
//      后裔→後裔, 里面→裡面, 干旱→乾旱, 照着→照著 — which a character table
//      cannot do.
//
// `chars` is the fallback for strings no static scan can see: the UI composes
// a few at runtime (`${n} 处地名`). Phrase entries are tried first, so the
// character table only ever runs on what the phrase table missed.
//
// WHAT COUNTS AS A STRING is not decided here any more. scripts/lib/zh-strings.mjs owns the scan and
// scripts/audit-zh-hant.mjs imports the same function, so the set this table is built FROM is the set the audit
// checks it AGAINST. They used to carry a copy of the scan each; both copies missed every Chinese string that
// followed an English one containing an apostrophe, which is how "AI 辅助繪制" shipped under 1,443 pictures.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';
import { CJK_RUN, HAS_CJK, collectStrings, walkJson } from './lib/zh-strings.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const convert = OpenCC.Converter({ from: 'cn', to: 'tw' });

/** Gazetteer-authoritative pairs, which OpenCC must not overwrite. */
const authoritative = new Map();
const places = JSON.parse(readFileSync(join(ROOT, 'public/data/places.json'), 'utf8'));
(function collectPairs(node) {
  if (Array.isArray(node)) { for (const v of node) collectPairs(v); return; }
  if (node && typeof node === 'object') {
    if (typeof node.zh === 'string' && typeof node.zhHant === 'string' && node.zh) authoritative.set(node.zh, node.zhHant);
    for (const v of Object.values(node)) collectPairs(v);
  }
})(places);
void walkJson;

/** Every Chinese string the app can put on screen, with where it came from. */
const found = collectStrings(ROOT);
const simplified = new Set(found.keys());

// One simplified character, several traditional ones, and only the
// surrounding word decides which: 里面 is 裡面 but 公里 stays 公里; 后 is 後
// in 后裔 and 后 in 皇后. A character map cannot know, so it is not allowed
// to try — these are left alone there, and a wrong guess becomes a missed
// conversion instead. The phrase table is what handles them.
const AMBIGUOUS = new Set([
  '后', '里', '干', '发', '台', '只', '系', '制', '钟', '面', '复', '历',
  '板', '谷', '丑', '松', '咸', '范', '曲', '尽', '借', '划', '卷', '折',
  '苏', '注', '致', '御', '志', '表', '胡', '斗', '出', '着', '价', '别',
]);

// Character fallback, over exactly the characters these strings use.
const chars = {};
for (const s of simplified) {
  for (const ch of s) {
    if (ch in chars || !HAS_CJK.test(ch) || AMBIGUOUS.has(ch)) continue;
    const hant = convert(ch);
    if (hant !== ch && [...hant].length === 1) chars[ch] = hant;
  }
}
const charFallback = (s) => [...s].map((ch) => chars[ch] ?? ch).join('');

const phrases = {};
let fromGazetteer = 0;
let gazetteerRepaired = 0;
const isTraditional = (v) => convert(v) === v || convert(v).replaceAll('裡', '裏') === v;
let fromOpenCC = 0;
let loadBearing = 0;
const targets = new Map();
for (const s of simplified) {
  let hant = authoritative.has(s) ? authoritative.get(s) : convert(s);
  // Counted rule: a gazetteer reading wins only while it is really Traditional. Some places.json zhHant values are the Simplified
  // name copied across (基比亚, 北门, 红海的路, 雅伟以勒): OpenCC's phrase conversion of the same string is then the better reading.
  // 裏 and 裡 are both Traditional (the CUV prints 底格裏斯), so that pair never counts as a difference.
  if (authoritative.has(s) && !isTraditional(hant)) { hant = convert(s); gazetteerRepaired++; }
  targets.set(s, hant);
  // An entry earns its place only if leaving it out would let the character map (or CJK_RUN sub-phrases) reach a different answer.
  if (charFallback(s) !== hant) {
    if (hant === s) loadBearing++;
    phrases[s] = hant;
    if (authoritative.has(s)) fromGazetteer++; else fromOpenCC++;
  }
}
const sim = (s) => phrases[s] !== undefined ? phrases[s] : s.replace(CJK_RUN, (run) => phrases[run] ?? charFallback(run));
for (const [s, hant] of targets) {
  if (phrases[s] === undefined && sim(s) !== hant) {
    if (hant === s) loadBearing++;
    phrases[s] = hant;
    if (authoritative.has(s)) fromGazetteer++; else fromOpenCC++;
  }
}

const out = join(ROOT, 'public/data/zh-hant.json');
writeFileSync(out, JSON.stringify({ phrases, chars }, null, 0) + '\n');

const bytes = readFileSync(out).length;
console.log(`zh-hant.json: ${Object.keys(phrases).length} phrases ` +
  `(${fromGazetteer} from the gazetteer, ${fromOpenCC} from OpenCC), ` +
  `${gazetteerRepaired} gazetteer readings repaired, ${Object.keys(chars).length} character fallbacks, ` +
  `${loadBearing} load-bearing no-ops, ${(bytes / 1024).toFixed(1)} kB`);
console.log(`  scanned ${simplified.size} Chinese strings`);
