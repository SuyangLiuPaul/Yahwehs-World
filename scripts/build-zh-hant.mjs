// Builds public/data/zh-hant.json — the Simplified → Traditional table the
// app loads when a reader is in 繁體.
//
// Two sources, in this order of authority:
//
//   1. places.json's own `zh` → `zhHant` pairs. Those come from the CUV
//      traditional gazetteer (see scripts/lib/zh-names.mjs), so they are a
//      published reading of the name, not a transformation of ours. They win.
//   2. OpenCC (cn → tw) for everything else: journey prose, scene captions,
//      inventory labels, the UI strings in src/*.ts, and the data-zh
//      attributes in the HTML. OpenCC resolves the one-to-many characters
//      by phrase — 后裔→後裔, 里面→裡面, 干旱→乾旱, 照着→照著 — which a
//      character table cannot do.
//
// `chars` is the fallback for strings no static scan can see: the UI composes
// a few at runtime (`${n} 处地名`). Phrase entries are tried first, so the
// character table only ever runs on what the phrase table missed.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const convert = OpenCC.Converter({ from: 'cn', to: 'tw' });
const HAS_CJK = /[一-鿿]/;

/** Every Chinese string the app can put on screen. */
const simplified = new Set();
/** Gazetteer-authoritative pairs, which OpenCC must not overwrite. */
const authoritative = new Map();

function walkJson(node, onString) {
  if (typeof node === 'string') { if (HAS_CJK.test(node)) onString(node); return; }
  if (Array.isArray(node)) { for (const v of node) walkJson(v, onString); return; }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) walkJson(v, onString);
  }
}

// 1 — the gazetteer's own traditional readings.
const places = JSON.parse(readFileSync(join(ROOT, 'public/data/places.json'), 'utf8'));
walkJson(places, () => {});
(function collectPairs(node) {
  if (Array.isArray(node)) { for (const v of node) collectPairs(v); return; }
  if (node && typeof node === 'object') {
    if (typeof node.zh === 'string' && typeof node.zhHant === 'string' && node.zh) {
      authoritative.set(node.zh, node.zhHant);
    }
    for (const v of Object.values(node)) collectPairs(v);
  }
})(places);

// 2 — everything else that carries Chinese.
for (const file of ['places.json', 'journeys.json', 'scenes.json', 'inventory.json']) {
  const data = JSON.parse(readFileSync(join(ROOT, 'public/data', file), 'utf8'));
  walkJson(data, (s) => simplified.add(s));
}


// UI strings: `zh: '…'` / `zh: "…"` literals and the static chunks of the
// template literals in the `zh:` arrow functions.
// Every .ts under src/, at any depth. Listing the directories by hand missed
// src/walk and src/structures — the two Chinese-primary pages — so their text
// had no phrase entries and fell to the character map, which does not carry
// 闩 at all and left 横闩 half-converted on the page.
function* tsFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* tsFiles(path);
    else if (entry.isFile() && entry.name.endsWith('.ts')) yield path;
  }
}
{
  for (const file of tsFiles(join(ROOT, 'src'))) {
    const text = readFileSync(file, 'utf8');
    // EVERY string literal that contains Chinese, whatever it is assigned to.
    // Scanning only the `zh:` keys left the pages that are Chinese-primary —
    // Measures, the Tabernacle walk — out of the table entirely, and their
    // text would then have fallen to the character map, where 公里 becomes
    // 公裡. Breadth here is what keeps that map idle.
    for (const m of text.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) if (HAS_CJK.test(m[1])) simplified.add(unescape(m[1]));
    for (const m of text.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) if (HAS_CJK.test(m[1])) simplified.add(unescape(m[1]));
    for (const m of text.matchAll(/`((?:[^`\\]|\\.)*)`/g)) if (HAS_CJK.test(m[1])) addTemplate(unescape(m[1]));
  }
}

/** Source-level escapes, so the key matches the string the app actually holds. */
function unescape(literal) {
  return literal.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(['"`\\])/g, '$1');
}

function addTemplate(literal) {
  for (const chunk of literal.split(/\$\{[^}]*\}/)) {
    if (HAS_CJK.test(chunk)) simplified.add(chunk);
  }
}

// The HTML pages: data-zh attributes, and the Chinese that is written straight
// into an element (the brand wordmark, the <title>) rather than paired with an
// English data-en.
for (const page of readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const text = readFileSync(join(ROOT, page), 'utf8');
  for (const m of text.matchAll(/data-zh="([^"]*)"/g)) if (HAS_CJK.test(m[1])) simplified.add(m[1]);
  for (const m of text.matchAll(/>([^<>]*)</g)) {
    const inner = m[1].trim();
    if (HAS_CJK.test(inner)) simplified.add(inner);
  }
}

// src/locale.ts looks a string up whole, and failing that looks up each run
// of Chinese characters and punctuation inside it. So the table has to be
// keyed the same way, or a string that mixes Chinese with markup or digits
// would find nothing and fall through to the character map.
const CJK_RUN = /[　-〿一-鿿！-･]+/g;
for (const s of [...simplified]) {
  for (const run of s.match(CJK_RUN) ?? []) simplified.add(run);
}

// 2b — the event text (events.json, the gallery's index and summaries). These were never scanned, so a scene description such as
// 「地发生青草」 reached a 繁體 reader half converted: its characters were not in the character map (they come only from scanned
// strings) and 发 is on the ambiguous list, which the map must not guess. Their characters now feed the map, and a whole string gets a
// phrase entry ONLY when the character map alone would convert it wrongly (the counted rule: it keeps the table small instead of
// repeating 1,443 long descriptions verbatim). A string or run that another source also contributed keeps the full-entry rule.
const eventStrings = new Set();
for (const file of ['events.json', 'gallery/index.json', 'gallery/summaries.json']) {
  const p = join(ROOT, 'public/data', file);
  if (!existsSync(p)) continue;
  walkJson(JSON.parse(readFileSync(p, 'utf8')), (s) => {
    for (const x of [s, ...(s.match(CJK_RUN) ?? [])]) if (!simplified.has(x)) eventStrings.add(x);
  });
}
for (const s of eventStrings) simplified.add(s);

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
for (const s of simplified) {
  let hant = authoritative.has(s) ? authoritative.get(s) : convert(s);
  // Counted rule: a gazetteer reading wins only while it is really Traditional. Some places.json zhHant values are the Simplified
  // name copied across (基比亚, 北门, 红海的路, 雅伟以勒): OpenCC's phrase conversion of the same string is then the better reading.
  // 裏 and 裡 are both Traditional (the CUV prints 底格裏斯), so that pair never counts as a difference.
  if (authoritative.has(s) && !isTraditional(hant)) { hant = convert(s); gazetteerRepaired++; }
  // An entry earns its place if it changes the string, OR if leaving it out
  // would let the character map reach a different answer. The second case is
  // the one that matters for 公里: converting it is a no-op, but without the
  // entry the fallback would have had a go at 里.
  const needed = eventStrings.has(s) ? charFallback(s) !== hant : (hant !== s || charFallback(s) !== hant);
  if (!needed) continue;
  if (hant === s) loadBearing++;
  phrases[s] = hant;
  if (authoritative.has(s)) fromGazetteer++; else fromOpenCC++;
}

const out = join(ROOT, 'public/data/zh-hant.json');
writeFileSync(out, JSON.stringify({ phrases, chars }, null, 0) + '\n');

const bytes = readFileSync(out).length;
console.log(`zh-hant.json: ${Object.keys(phrases).length} phrases ` +
  `(${fromGazetteer} from the gazetteer, ${fromOpenCC} from OpenCC), ` +
  `${gazetteerRepaired} gazetteer readings repaired, ${Object.keys(chars).length} character fallbacks, ${(bytes / 1024).toFixed(1)} kB`);
