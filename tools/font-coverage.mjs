#!/usr/bin/env node
// Character inventory for the self-hosted web fonts in public/fonts.
//
// WHAT THIS IS FOR. The pages must never ask fonts.googleapis.com for a face,
// and they must never fall back to a system font either — the owner made full
// coverage of the shipped text a hard acceptance criterion. So the subsets in
// public/fonts have to be built from the characters that can actually reach the
// screen, and something has to prove they still cover them after the text
// changes. This script is both halves: it collects the inventory, and it reads
// the built woff2 cmaps back to check them.
//
// USAGE
//   node tools/font-coverage.mjs --report            counts per group
//   node tools/font-coverage.mjs --emit <dir>        write <group>.txt char lists
//   node tools/font-coverage.mjs --check             verify public/fonts covers them
//   node tools/font-coverage.mjs --missing <group>   list what one group is missing
//   flags: --margin=full|punct|none   (default full; see MARGIN below)
//
// HOW TEXT IS ATTRIBUTED. Every source file is walked with a language tag, so a
// Han character read out of a Simplified source lands in the SC set and one read
// out of a Traditional source lands in the TC set. JSON objects re-tag
// themselves from their key names ("hans"/"hant"/"en"/"ru"), which is how the
// trilingual data files (meta.json, catalogue.json, events.json) get split
// correctly. Anything untagged counts for BOTH CJK sets, which is the safe
// direction. Latin and Cyrillic are collected from every source regardless of
// tag — over-collecting there costs a few hundred bytes.
//
// MARGIN. On top of the measured set the CJK subsets get, by default, the whole
// CJK symbols/punctuation block, the fullwidth forms, and the common-use Han of
// each script (GB2312 level 1 for SC, Big5 level 1 for TC — decoded from
// Python's own codecs, so the list is reproducible and needs no network). That
// way a late edit to a verse or a UI string does not immediately fall back to a
// system font. --report prints measured and shipped counts separately.
//
// Node builtins only. `--check` shells out to `python3 -I` for fontTools.

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => join(ROOT, ...a);

// ---------------------------------------------------------------- groups

// Google Fonts' own unicode-range split, so a Russian page downloads only the
// Cyrillic file. Order matters: a codepoint is assigned to the FIRST group that
// claims it. Anything a Latin/Cyrillic family needs that no group claims is
// swept into `latin` by assign(), so nothing measured can be lost.
// These strings are also the `unicode-range` declared in public/fonts/fonts.css
// — the same list has to do both jobs, because a glyph in a file whose
// @font-face does not claim its codepoint is a glyph the browser will never
// use. `node tools/font-coverage.mjs --ranges` prints them in CSS form.
//
// `latin` is Google's own latin range PLUS the arrow, math, technical, enclosed
// and box-drawing blocks. Google leaves those to a separate "symbols" sheet
// that we are not loading, and the pages use ← → ≈ ≤ ≥ ↻ ⌘ ① ② in UI chrome,
// so they have to be claimed by something. Nothing may fall outside every
// range: groups() refuses to lose a codepoint and says which one.
export const RANGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02BE-02BF,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-21FF,U+2200-22FF,U+2300-23FF,U+2460-24FF,U+2500-257F,U+2580-259F,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
  'cyrillic-ext': 'U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
  // Greek and Hebrew are not UI languages, but both reach shipped pages: the
  // Psalm 119 acrostic headings and the ark's Hebrew object labels carry
  // pointed Hebrew, and a handful of scene notes quote Greek words
  // (στάδιον). Noto Sans/Serif CJK carry neither pointed Hebrew nor accented
  // Greek, so they get their own tiny groups rather than a system fallback.
  greek: 'U+0370-03FF,U+1F00-1FFF',
  hebrew: 'U+0590-05FF,U+FB1D-FB4F',
  // Geometric shapes and box drawing. The UI really does set ▾ in the edition
  // chevron, ▸ in the install instructions and ▶ on the walk controls, and none
  // of Inter, Spectral or IBM Plex Mono carries all three — so they come out of
  // Noto Sans Symbols 2 instead of out of whatever the platform has. Kept after
  // `latin` in this list so the arrows and enclosed numbers Inter DOES have
  // stay in its latin file.
  // Box drawing (U+2500-257F) is deliberately NOT here: it only ever appears
  // in section-rule comments in the CSS and TypeScript, the sweep picks it up
  // anyway, and IBM Plex Mono already carries it — so leaving it to fall
  // through into `latin` keeps it covered without a second symbols file.
  symbols: 'U+25A0-25FF',
};

// Default-ignorable codepoints: no font needs a glyph for them, so they must
// not count as a coverage requirement. Without this, every subset "fails" on
// the variation selector in an emoji and on the bidi controls beside the
// Hebrew.
const isIgnorable = (cp) =>
  cp === 0x00ad || cp === 0x034f || cp === 0xfeff ||
  (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x2028 && cp <= 0x202e) ||
  (cp >= 0x2060 && cp <= 0x206f) || (cp >= 0xfe00 && cp <= 0xfe0f) ||
  (cp >= 0xfff9 && cp <= 0xfffb);

// Measured codepoints that are NOT display text: they are the endpoints of
// character-class ranges in the source sweep. U+9FFF closes /[一-鿿]/ in
// src/locale.ts and /[㐀-鿿]/ in src/reader/text.ts. Noto Serif CJK happens to
// have it and Noto Sans CJK does not, which would fail the check over a
// character no reader can ever see. Add to this list only with the grep that
// proves the codepoint appears solely inside a regular expression.
const SWEEP_ARTEFACTS = new Set([0x9fff]);

const parseRanges = (spec) =>
  spec.split(',').map((r) => {
    const [a, b] = r.replace(/U\+/g, '').split('-');
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
const RANGE_SETS = Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, parseRanges(v)]));
const inRanges = (cp, rs) => rs.some(([a, b]) => cp >= a && cp <= b);

const isCyrillic = (cp) =>
  (cp >= 0x0400 && cp <= 0x052f) || (cp >= 0x1c80 && cp <= 0x1c88) ||
  (cp >= 0x2de0 && cp <= 0x2dff) || (cp >= 0xa640 && cp <= 0xa69f);

const isHan = (cp) =>
  (cp >= 0x3400 && cp <= 0x4dbf) ||   // ext A
  (cp >= 0x4e00 && cp <= 0x9fff) ||   // unified
  (cp >= 0xf900 && cp <= 0xfaff) ||   // compat ideographs
  (cp >= 0x20000 && cp <= 0x3134f);   // ext B+ (surrogate pairs in the JSON)

// CJK punctuation, fullwidth forms, vertical forms, kana (names in notes),
// bopomofo, and the ideographic description characters: everything that must
// come out of the CJK face rather than the Latin one.
const isCjkFurniture = (cp) =>
  (cp >= 0x2e80 && cp <= 0x2fdf) || (cp >= 0x3000 && cp <= 0x303f) ||
  (cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x3100 && cp <= 0x312f) ||
  (cp >= 0x31a0 && cp <= 0x31bf) || (cp >= 0x3200 && cp <= 0x33ff) ||
  (cp >= 0xfe10 && cp <= 0xfe19) || (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xffef);

const isCjk = (cp) => isHan(cp) || isCjkFurniture(cp);

// Scripts we do NOT bundle a font for. Reported loudly rather than silently
// dropped: nothing in public/fonts covers them, so the page reaches for
// whatever the platform happens to have.
const isGreek = (cp) => (cp >= 0x0370 && cp <= 0x03ff) || (cp >= 0x1f00 && cp <= 0x1fff);
const isHebrew = (cp) => (cp >= 0x0590 && cp <= 0x05ff) || (cp >= 0xfb1d && cp <= 0xfb4f);

const OTHER_SCRIPTS = [
  ['Arabic', (cp) => cp >= 0x0600 && cp <= 0x06ff],
  ['Devanagari', (cp) => cp >= 0x0900 && cp <= 0x097f],
  ['Emoji/pictographs', (cp) => (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf)],
];

// ---------------------------------------------------------------- collection

const sets = {
  latin: new Set(),      // every codepoint seen anywhere that no other set claims
  cyrillic: new Set(),
  greek: new Set(),
  hebrew: new Set(),
  sc: new Set(),         // CJK needed to render Simplified — everything, serif face
  tc: new Set(),         // CJK needed to render Traditional — everything, serif face
  scUi: new Set(),       // the subset of `sc` that the SANS stack can ever draw
  tcUi: new Set(),       // the subset of `tc` that the SANS stack can ever draw
  other: new Map(),      // script name -> Set, for the gap report
};
const provenance = new Map(); // group -> Map(file -> count of new codepoints)

function note(group, file) {
  if (!provenance.has(group)) provenance.set(group, new Map());
  const m = provenance.get(group);
  m.set(file, (m.get(file) ?? 0) + 1);
}

// WHY THERE ARE TWO CJK SETS. Noto Serif SC/TC draw the Bible body; Noto Sans
// SC/TC draw only UI chrome — nav, captions, headings, footnotes, credits.
// Subsetting both to the same union made the two sans files carry ~4,000 Han
// characters that only ever occur in verse text they will never be asked to
// draw, which is 1.1 MB of dist for nothing. So every source is collected with
// a `ui` flag: true means "the sans stack can draw this", and only those
// characters go into scUi/tcUi.
//
// The verse files are the ONLY sources with ui=false, and even there the
// footnotes are pulled back out: in Words' format a footnote is an inline
// `<note:…>` marker inside the verse string, and src/reader/reader.css draws
// `.yr-note` with --yr-ui, i.e. the sans face. Everything else — book intros,
// heading context, licence notes, scene summaries — is collected as UI,
// because the brief is right that over-including is cheap and a missing glyph
// in the chrome is the exact regression this split could cause.
//
// tag: 'sc' | 'tc' | 'both' | 'latin' | 'cyr'
function eat(text, tag, file, ui = true) {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || isIgnorable(cp)) continue;
    if (isCyrillic(cp)) {
      if (!sets.cyrillic.has(cp)) note('cyrillic', file);
      sets.cyrillic.add(cp);
      continue;
    }
    if (isGreek(cp)) { if (!sets.greek.has(cp)) note('greek', file); sets.greek.add(cp); continue; }
    if (isHebrew(cp)) { if (!sets.hebrew.has(cp)) note('hebrew', file); sets.hebrew.add(cp); continue; }
    if (isCjk(cp)) {
      // Furniture (。、「」（）) is needed by whichever script is on the page,
      // so it always goes to both; only Han is attributed.
      const to = isHan(cp) && tag !== 'both' ? (tag === 'tc' ? ['tc'] : tag === 'sc' ? ['sc'] : []) : ['sc', 'tc'];
      for (const t of (to.length ? to : ['sc', 'tc'])) {
        if (!sets[t].has(cp)) note('cjk-' + t, file);
        sets[t].add(cp);
        if (ui) sets[t === 'sc' ? 'scUi' : 'tcUi'].add(cp);
      }
      continue;
    }
    let other = null;
    for (const [name, test] of OTHER_SCRIPTS) if (test(cp)) { other = name; break; }
    if (other) {
      if (!sets.other.has(other)) sets.other.set(other, new Set());
      sets.other.get(other).add(cp);
      note('other:' + other, file);
      continue;
    }
    if (!sets.latin.has(cp)) note('latin', file);
    sets.latin.add(cp);
  }
}

// Key names that re-tag the subtree they introduce.
const KEY_TAG = {
  en: 'latin', english: 'latin', 'english-classic': 'latin',
  hans: 'sc', 'zh-Hans': 'sc', zh: 'sc', zhHans: 'sc', zh_cn: 'sc', cuv: 'sc', cuvs: 'sc',
  hant: 'tc', 'zh-Hant': 'tc', zhHant: 'tc', zh_tw: 'tc', 'cuv-tr': 'tc', cuvt: 'tc',
  ru: 'cyr', russian: 'cyr',
};

/** Fields whose text the SANS stack can never draw, so they feed the serif sets only (ui=false).
 *  `c` is a section heading's context paragraph, drawn by .yr-ctx in --yr-read (src/reader/reader.css). It is the
 *  largest body of Chinese prose in the product outside the Bible itself; while it was set in the UI sans it pushed
 *  its whole vocabulary into the two sans CJK subsets, which the serif subsets already carry in full. */
const SERIF_ONLY_KEYS = new Set(['c']);

function walkJson(node, tag, file, ui = true) {
  if (node == null) return;
  if (typeof node === 'string') return eat(node, tag, file, ui);
  if (typeof node === 'number' || typeof node === 'boolean') return;
  if (Array.isArray(node)) { for (const v of node) walkJson(v, tag, file, ui); return; }
  for (const [k, v] of Object.entries(node)) {
    eat(k, tag, file, ui);                // keys can be display text (zh-hant.json)
    walkJson(v, KEY_TAG[k] ?? tag, file, ui && !SERIF_ONLY_KEYS.has(k));
  }
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { console.error(`! could not parse ${path}: ${e.message}`); return null; }
}

function eachFile(dir, fn) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) eachFile(p, fn);
    else fn(p, name);
  }
}

const rel = (p) => p.slice(ROOT.length + 1);

function sourceJson(path, tag, ui = true) {
  if (!existsSync(path)) return false;
  const j = readJson(path);
  if (j != null) walkJson(j, tag, rel(path), ui);
  return true;
}

function sourceDir(dir, tag, ui = true) {
  if (!existsSync(dir)) return false;
  eachFile(dir, (p) => { if (p.endsWith('.json')) sourceJson(p, tag, ui); });
  return true;
}

// A verse-text source: the body is serif-only, but any `<note:…>` inside it is
// a footnote that src/reader/reader.css draws with --yr-ui, so its characters
// must reach the sans set too. Same marker in the gallery's own bible bundle
// (see src/reader/text.ts, which parses it).
const NOTE = /<note:([^>]*)>/g;
let noteChars = 0;
function eatVerse(text, tag, file) {
  eat(text, tag, file, false);
  for (const m of text.matchAll(NOTE)) { noteChars += m[1].length; eat(m[1], tag, file, true); }
}

function walkVerses(node, tag, file) {
  if (typeof node === 'string') return eatVerse(node, tag, file);
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const v of node) walkVerses(v, tag, file); return; }
  for (const [k, v] of Object.entries(node)) walkVerses(v, KEY_TAG[k] ?? tag, file);
}

function sourceVerses(path, tag) {
  if (!existsSync(path)) return false;
  const j = readJson(path);
  if (j != null) walkVerses(j, tag, rel(path));
  return true;
}

function sourceVerseDir(dir, tag) {
  if (!existsSync(dir)) return false;
  eachFile(dir, (p) => { if (p.endsWith('.json')) sourceVerses(p, tag); });
  return true;
}

// ---------------------------------------------------------------- the sources

const LANG_TAG = { en: 'latin', 'zh-Hans': 'sc', 'zh-Hant': 'tc', ru: 'cyr' };
const notes = [];
let zhHant = null;

// The Traditional pages are produced by converting the Simplified strings at
// runtime through public/data/zh-hant.json, so whatever the SANS Simplified
// face must draw, the SANS Traditional face must be able to draw the converted
// form of. Characters: direct. Phrases: a phrase can only occur in UI text if
// every character of its KEY is already in the UI Simplified set, so its value
// is pulled in exactly when that holds — generous, and it cannot admit a
// phrase that no UI string can contain.
function closeHantUi() {
  if (!zhHant) return;
  const has = (s) => [...s].every((ch) => !isHan(ch.codePointAt(0)) || sets.scUi.has(ch.codePointAt(0)));
  for (const [k, v] of Object.entries(zhHant.chars ?? {}))
    if (has(k)) eat(String(v), 'tc', 'public/data/zh-hant.json (UI closure)', true);
  for (const [k, v] of Object.entries(zhHant.phrases ?? {}))
    if (has(k)) eat(String(v), 'tc', 'public/data/zh-hant.json (UI closure)', true);
  // And the reverse: a Traditional-native UI string (the "hant" fields) may
  // contain a character the Simplified side never has. Those arrived tagged
  // 'tc' with ui=true already, so nothing more is needed there.
}

function collect() {
  // 1. Reader editions. The catalogue is the authority on which editions the
  //    reader serves and what language each one is.
  const cat = readJson(P('public/data/reader/catalogue.json')) ?? { editions: [] };
  walkJson(cat, 'both', 'public/data/reader/catalogue.json');
  for (const ed of cat.editions ?? []) {
    const tag = LANG_TAG[ed.language] ?? 'both';
    const shipped = sourceVerseDir(P('public/data/reader/text', ed.id), tag);
    if (!shipped) {
      // Not under public/ — may still be copied in by a build step.
      const alt = P('data/text/bible', ed.id);
      if (sourceVerseDir(alt, tag)) notes.push(`edition ${ed.id} (${ed.language}) is NOT under public/ — read from data/text/bible/${ed.id}; it must be copied in by a build step or it will not render`);
      else notes.push(`edition ${ed.id} (${ed.language}) has NO text on disk — catalogue lists it but nothing ships it`);
    }
    if (ed.headingSet) {
      const hs = P('public/data/reader/headings', ed.headingSet);
      if (existsSync(hs)) sourceDir(hs, tag);
    }
  }
  sourceDir(P('public/data/reader/headings'), 'both');  // any set not claimed above
  sourceDir(P('public/data/reader/para'), 'both');

  // 2. The gallery's own bible bundle (bsb / cuvs / cuvt + the yhwh editions).
  const BIBLE_TAG = { bsb: 'latin', cuvs: 'sc', cuvt: 'tc' };
  for (const [name, tag] of Object.entries(BIBLE_TAG)) sourceVerseDir(P('public/data/bible/split/text', name), tag);
  sourceVerses(P('public/data/bible/bsb-yhwh.json'), 'latin');
  sourceVerses(P('public/data/bible/cuvs-yhwh.json'), 'sc');
  sourceVerses(P('public/data/bible/cuvt-yhwh.json'), 'tc');
  sourceJson(P('public/data/bible/meta.json'), 'both');
  sourceJson(P('public/data/bible/split/core.json'), 'both');
  sourceDir(P('public/data/bible/split/book'), 'both');

  // 3. Scene titles and summaries. index.json rows are
  //    [id, book, start, end, zh, en, asset, ok, ru?] — 5th is Simplified,
  //    6th English, optional 9th Russian.
  const gi = readJson(P('public/data/gallery/index.json'));
  if (gi) {
    const f = 'public/data/gallery/index.json';
    for (const row of gi.ev ?? []) {
      if (!Array.isArray(row)) { walkJson(row, 'both', f); continue; }
      row.forEach((cell, i) => {
        if (typeof cell !== 'string') return;
        eat(cell, i === 4 ? 'sc' : i === 5 ? 'latin' : i === 8 ? 'cyr' : 'both', f);
      });
    }
    for (const [k, v] of Object.entries(gi)) if (k !== 'ev') walkJson(v, KEY_TAG[k] ?? 'both', f);
  }
  const sum = readJson(P('public/data/gallery/summaries.json'));
  if (sum) walkJson(sum, 'both', 'public/data/gallery/summaries.json');  // keys zh/en/ru re-tag

  // 4. zh-Hant conversion table. Keys are what Simplified sources contain;
  //    values are what a Traditional reader actually sees. Both halves count,
  //    on their own side.
  const zh = readJson(P('public/data/zh-hant.json'));
  if (zh) {
    const f = 'public/data/zh-hant.json';
    // The table is machinery, not display text, and it covers verse text as
    // well as chrome — so it feeds the full (serif) sets with ui=false. What
    // the SANS Traditional face needs is the conversion of the UI text only,
    // which closeHantUi() works out below once everything has been collected.
    for (const table of [zh.phrases, zh.chars]) {
      if (!table) continue;
      for (const [k, v] of Object.entries(table)) { eat(k, 'sc', f, false); eat(String(v), 'tc', f, false); }
    }
  }
  zhHant = zh;

  // 5. The remaining display-bearing data files.
  for (const n of ['events.json', 'places.json', 'journeys.json', 'scenes.json', 'inventory.json'])
    sourceJson(P('public/data', n), 'both');

  // 6. UI strings. A crude sweep of the TypeScript and of the page shells: the
  //    whole file, not just the literals, because data-en/data-zh/data-ru
  //    attributes and visible text are what we are after and both are cheap to
  //    over-collect.
  eachFile(P('src'), (p) => {
    if (/\.(ts|tsx|js|mjs|css|json)$/.test(p)) eat(readFileSync(p, 'utf8'), 'both', rel(p));
  });
  for (const name of readdirSync(ROOT)) {
    if (name.endsWith('.html')) eat(readFileSync(P(name), 'utf8'), 'both', name);
  }

  // Must run last: it reads the finished Simplified UI set.
  closeHantUi();
}

// ---------------------------------------------------------------- margin

function commonHan(codec, lo, hi) {
  // GB2312 level 1 (0xB0A1-0xD7F9) is the 3,755 most common Simplified
  // characters; Big5 level 1 (0xA440-0xC67E) is the 5,401 常用字. Decoded with
  // Python's own codecs so the list is reproducible offline.
  const py = `
import sys
out = []
for hi in range(${lo >> 8}, ${(hi >> 8) + 1}):
    for lo in range(0, 256):
        try:
            c = bytes([hi, lo]).decode('${codec}')
        except Exception:
            continue
        if len(c) == 1 and 0x3400 <= ord(c) <= 0x9fff:
            out.append(ord(c))
sys.stdout.write(','.join(map(str, sorted(set(out)))))
`;
  try {
    const out = execFileSync('python3', ['-I', '-c', py], { encoding: 'utf8', maxBuffer: 1 << 24 });
    return out ? out.split(',').map(Number) : [];
  } catch (e) {
    console.error(`! could not build the ${codec} common-use list (${e.message}); shipping the measured set only`);
    return [];
  }
}

function withMargin(mode) {
  const ship = {
    latin: new Set(sets.latin),
    cyrillic: new Set(sets.cyrillic),
    greek: new Set(sets.greek),
    hebrew: new Set(sets.hebrew),
    sc: new Set(sets.sc),
    tc: new Set(sets.tc),
    scUi: new Set(sets.scUi),
    tcUi: new Set(sets.tcUi),
  };
  if (mode === 'none') return ship;
  // The margin goes through the same ignorable filter as the measured text, so
  // a block-wide range does not demand glyphs for bidi controls or spaces that
  // are not drawn.
  for (const s of Object.values(ship)) for (const cp of [...s]) if (isIgnorable(cp)) s.delete(cp);
  // Greek and Hebrew are quoted words, not UI languages, so their margin is the
  // whole of each base block (monotonic Greek, Hebrew letters + points) — a few
  // hundred glyphs, a few KB. Polytonic Greek is NOT added: nothing shipped
  // uses it and it would triple the file.
  for (let cp = 0x0386; cp <= 0x03ce; cp++) ship.greek.add(cp);
  for (let cp = 0x0591; cp <= 0x05f4; cp++) ship.hebrew.add(cp);
  if (ship.hebrew.size) { ship.hebrew.add(0x200e); ship.hebrew.add(0x200f); }
  // Punctuation margin: the whole CJK symbols block and the fullwidth forms.
  // Both the serif and the sans sets get the punctuation margin: the UI uses
  // 「」（）、。 as much as the Bible does.
  const cjk = [ship.sc, ship.tc, ship.scUi, ship.tcUi];
  for (let cp = 0x3000; cp <= 0x303f; cp++) for (const s of cjk) s.add(cp);
  for (let cp = 0xff01; cp <= 0xff5e; cp++) for (const s of cjk) s.add(cp);
  for (let cp = 0xffe0; cp <= 0xffe6; cp++) for (const s of cjk) s.add(cp);
  // Latin margin: Latin-1 + Latin Extended-A + general punctuation + currency,
  // so a new UI string with a dash or a quote mark cannot miss.
  for (const [a, b] of [[0x20, 0x7e], [0xa0, 0x17f], [0x2000, 0x206f], [0x20a0, 0x20bf], [0x2116, 0x2116], [0x2190, 0x2199], [0x2212, 0x2212]])
    for (let cp = a; cp <= b; cp++) ship.latin.add(cp);
  // Cyrillic margin: modern Russian, and ONLY what the `cyrillic` group's own range claims.
  //
  // It used to be the whole 0400-04FF block. Google's split puts 0460-052F in CYRILLIC-EXT, so 156 of those margin
  // codepoints landed in a group the product does not use one character of: five files (Inter, Spectral 500 and 600,
  // Plex Mono 400 and 500), 30 KiB of dist, carrying historic and non-Slavic Cyrillic that no Russian page, no
  // Synodal verse and no UI string contains. Margin is insurance against a NEW character; insurance on a block the
  // product will never enter is just weight. Anything measured there is still shipped, because the loop below only
  // trims the MARGIN and `latinish` in groups() still places every measured codepoint.
  for (let cp = 0x0400; cp <= 0x04ff; cp++) if (inRanges(cp, RANGE_SETS.cyrillic)) ship.cyrillic.add(cp);
  ship.cyrillic.add(0x2116);
  if (mode === 'full') {
    // The common-use margin goes on the SERIF sets only. On the sans sets it
    // would undo the whole point of the split: the sans faces exist to carry
    // chrome, and padding them with 3,755 + 5,401 common characters costs more
    // than the split saves.
    for (const cp of commonHan('gb2312', 0xb0a1, 0xd7f9)) ship.sc.add(cp);
    for (const cp of commonHan('big5', 0xa440, 0xc67e)) ship.tc.add(cp);
  }
  for (const s of Object.values(ship)) for (const cp of [...s]) if (isIgnorable(cp)) s.delete(cp);
  return ship;
}

// ---------------------------------------------------------------- emit

// Codepoints RANGES does not claim. Filled in by groups(); a non-empty set is
// a bug in RANGES above, not in the text.
const unclaimed = new Set();

// group name -> the codepoints that group's file must carry.
export function groups(mode = 'full') {
  const ship = withMargin(mode);
  const out = {};
  for (const g of Object.keys(RANGES)) out[g] = new Set();
  const latinish = [...ship.latin, ...ship.cyrillic, ...ship.greek, ...ship.hebrew];
  for (const cp of latinish) {
    let placed = false;
    for (const g of Object.keys(RANGES)) {
      if (inRanges(cp, RANGE_SETS[g])) { out[g].add(cp); placed = true; break; }
    }
    // A codepoint claimed by no range would be built into the latin file and
    // then never used, because its @font-face would not declare it. Put it in
    // `latin` so it is not lost, and say so, because RANGES needs widening.
    if (!placed) {
      out.latin.add(cp);
      unclaimed.add(cp);
    }
  }
  out['cjk-sc-serif'] = ship.sc;
  out['cjk-tc-serif'] = ship.tc;
  out['cjk-sc-sans'] = ship.scUi;
  out['cjk-tc-sans'] = ship.tcUi;
  return out;
}

const chars = (set) => [...set].sort((a, b) => a - b).map((cp) => String.fromCodePoint(cp)).join('');

// ---------------------------------------------------------------- check

// The @font-face group a given file is expected to cover, derived from its
// name — <Family>-<weight>-<group>.woff2, where <weight> is either one value or
// a variable range: Spectral-500-latin.woff2, Inter-400-600-cyrillic.woff2.
function builtFonts() {
  const dir = P('public/fonts');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.woff2'))
    .map((n) => {
      const m = n.match(/^(.+?)-(\d+(?:-\d+)?)-(latin-ext|latin|cyrillic-ext|cyrillic|greek|hebrew|symbols|cjk-sc-serif|cjk-tc-serif|cjk-sc-sans|cjk-tc-sans)\.woff2$/);
      return m ? { file: n, family: m[1], weight: m[2], group: m[3], path: join(dir, n) } : { file: n, group: null, path: join(dir, n) };
    });
}

function cmapOf(paths) {
  const py = `
import sys, json
from fontTools.ttLib import TTFont
out = {}
for p in sys.argv[1:]:
    f = TTFont(p, lazy=True)
    out[p] = sorted(f.getBestCmap().keys())
    f.close()
sys.stdout.write(json.dumps(out))
`;
  const out = execFileSync('python3', ['-I', '-c', py, ...paths], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return JSON.parse(out);
}

// ---------------------------------------------------------------- main

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const a = argv.find((x) => x.startsWith(n + '=')); return a ? a.slice(n.length + 1) : d; };
const MODE = val('--margin', 'full');

collect();
const measured = {
  latin: sets.latin, cyrillic: sets.cyrillic, greek: sets.greek, hebrew: sets.hebrew,
  'cjk-sc-serif': sets.sc, 'cjk-tc-serif': sets.tc,
  'cjk-sc-sans': sets.scUi, 'cjk-tc-sans': sets.tcUi,
};
const shipped = groups(MODE);

if (flag('--emit')) {
  const dir = argv[argv.indexOf('--emit') + 1];
  if (!dir) { console.error('--emit needs a directory'); process.exit(2); }
  mkdirSync(dir, { recursive: true });
  for (const [g, set] of Object.entries(shipped)) {
    writeFileSync(join(dir, `${g}.txt`), chars(set), 'utf8');
    console.log(`${g}.txt  ${set.size} codepoints`);
  }
  process.exit(0);
}

// A CSS unicode-range built from an actual codepoint set, runs collapsed.
// The CJK groups cannot use a hand-written block list: the sans faces carry a
// sparse ~1,700 characters out of the CJK area, and a @font-face that claimed
// the whole block would have the browser pick the sans file for a verse-only
// character it has not got. With the exact range the browser skips it and
// falls through to the serif face in the same stack, which does have it.
function cssRange(set) {
  const cps = [...set].sort((a, b) => a - b);
  const out = [];
  const h = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  for (let i = 0; i < cps.length; i++) {
    let j = i;
    while (j + 1 < cps.length && cps[j + 1] === cps[j] + 1) j++;
    out.push(i === j ? h(cps[i]) : `${h(cps[i])}-${h(cps[j]).slice(2)}`  /* CSS grammar: U+4E00-4E01; 'U+4E00-U+4E01' is invalid and Chrome drops the whole descriptor */);
    i = j;
  }
  return out.join(',');
}

if (flag('--ranges')) {
  const g = argv[argv.indexOf('--ranges') + 1];
  if (g && !g.startsWith('--')) {
    // One group, as the exact set its file was built from.
    const set = shipped[g];
    if (!set) { console.error(`unknown group ${g}; try ${Object.keys(shipped).join(', ')}`); process.exit(2); }
    console.log(cssRange(set));
    process.exit(0);
  }
  for (const [name, spec] of Object.entries(RANGES)) console.log(`${name}:\n  unicode-range: ${spec};`);
  for (const name of ['cjk-sc-serif', 'cjk-tc-serif', 'cjk-sc-sans', 'cjk-tc-sans'])
    console.log(`${name}: ${shipped[name].size} codepoints — use \`--ranges ${name}\` for the exact unicode-range`);
  process.exit(0);
}

if (flag('--report') || argv.length === 0) {
  console.log(`font coverage — margin=${MODE}\n`);
  console.log('group          measured   shipped');
  for (const g of ['latin', 'cyrillic', 'greek', 'hebrew', 'cjk-sc-serif', 'cjk-sc-sans', 'cjk-tc-serif', 'cjk-tc-sans']) {
    const m = measured[g].size;
    const s = g === 'latin'
      ? shipped.latin.size + shipped['latin-ext'].size
      : g === 'cyrillic' ? shipped.cyrillic.size + shipped['cyrillic-ext'].size : shipped[g].size;
    console.log(`${g.padEnd(14)} ${String(m).padStart(8)}  ${String(s).padStart(8)}`);
  }
  console.log('\nsubset files to build (codepoints each):');
  for (const [g, set] of Object.entries(shipped)) console.log(`  ${g.padEnd(14)} ${set.size}`);
  const han = (s) => [...s].filter(isHan).length;
  console.log(`\nmeasured Han only: serif SC ${han(sets.sc)}, TC ${han(sets.tc)}`);
  console.log(`                   sans  SC ${han(sets.scUi)}, TC ${han(sets.tcUi)}  (UI chrome, captions, headings, footnotes, credits — no verse text)`);
  console.log(`footnote text pulled out of the verse files for the sans sets: ${noteChars} characters`);
  if (sets.other.size) {
    console.log('\nSCRIPTS WITH NO BUNDLED FONT (these fall back to the system):');
    for (const [name, set] of sets.other) {
      const sample = [...set].slice(0, 12).map((c) => String.fromCodePoint(c)).join('');
      const where = [...(provenance.get('other:' + name) ?? new Map())].sort((a, b) => b[1] - a[1]).slice(0, 4);
      console.log(`  ${name}: ${set.size} codepoints  e.g. ${sample}`);
      for (const [f, n] of where) console.log(`      ${f} (${n})`);
    }
  } else {
    console.log('\nno unbundled script reaches a shipped page.');
  }
  if (unclaimed.size)
    console.log(`\nRANGES CLAIMS NEITHER OF THESE — widen RANGES.latin or they will be built but never used:\n  ${[...unclaimed].map((cp) => `U+${cp.toString(16).toUpperCase()}(${String.fromCodePoint(cp)})`).join(' ')}`);
  for (const n of notes) console.log(`\nNOTE: ${n}`);
  process.exit(0);
}

if (flag('--missing')) {
  const g = argv[argv.indexOf('--missing') + 1];
  const set = shipped[g];
  if (!set) { console.error(`unknown group ${g}; try ${Object.keys(shipped).join(', ')}`); process.exit(2); }
  console.log(chars(set));
  process.exit(0);
}

if (flag('--check')) {
  // WHAT PASSING MEANS. A CSS font stack falls through family by family, so the
  // requirement is not "every file carries every character" — it is "for each
  // unicode-range group, the files in public/fonts between them carry every
  // MEASURED character of that group". That is exactly the owner's criterion:
  // no character on a shipped page reaches a system font. Spectral has no ①
  // and IBM Plex Mono has no ḥ; both are caught by Inter further down the
  // stack, and that is fine. Per-file gaps are printed as information so it is
  // visible which position in the stack is doing the catching, and the margin
  // (characters added as insurance, not measured) can never fail the run.
  const built = builtFonts();
  if (!built.length) { console.error('no .woff2 in public/fonts — run tools/subset-fonts.sh first'); process.exit(1); }
  for (const u of built.filter((b) => !b.group))
    console.error(`! ${u.file} does not follow <Family>-<weight>-<group>.woff2; not checked`);
  const known = built.filter((b) => b.group);
  const maps = cmapOf(known.map((b) => b.path));
  const required = groups('none');  // measured only, assigned to the same groups
  const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}(${String.fromCodePoint(cp)})`;
  let bad = 0;

  for (const g of Object.keys(shipped)) {
    const must = [...(required[g] ?? [])].filter((cp) => !SWEEP_ARTEFACTS.has(cp));
    const files = known.filter((b) => b.group === g);
    if (!files.length) {
      if (!must.length) continue;
      bad++;
      console.log(`FAIL group ${g}: no file in public/fonts covers it (${must.length} measured codepoints need it)`);
      continue;
    }
    const union = new Set();
    for (const b of files) for (const cp of maps[b.path]) union.add(cp);
    const miss = must.filter((cp) => !union.has(cp));
    const bytes = files.reduce((n, b) => n + statSync(b.path).size, 0);
    if (miss.length) {
      bad++;
      console.log(`FAIL group ${g}: ${miss.length} of ${must.length} measured codepoints are in no file`);
      console.log('     ' + miss.slice(0, 40).map(hex).join(' ') + (miss.length > 40 ? ` … (+${miss.length - 40})` : ''));
    } else {
      console.log(`ok   group ${g.padEnd(13)} ${String(must.length).padStart(5)} measured codepoints covered by ${files.length} file(s), ${(bytes / 1024).toFixed(0)} KiB`);
    }
    for (const b of files) {
      const have = new Set(maps[b.path]);
      const own = must.filter((cp) => !have.has(cp));
      const marginShort = [...shipped[g]].filter((cp) => !have.has(cp) && !own.includes(cp)).length;
      const bits = [`${have.size} glyphs`];
      if (own.length) bits.push(`lacks ${own.length} measured (${own.slice(0, 8).map(hex).join(' ')}${own.length > 8 ? ' …' : ''}) — caught further down the stack`);
      if (marginShort) bits.push(`${marginShort} margin-only codepoints absent upstream`);
      console.log(`       ${b.file.padEnd(40)} ${(statSync(b.path).size / 1024).toFixed(0).padStart(5)} KiB  ${bits.join('; ')}`);
    }
  }

  // ---- public/fonts/fonts.css vs the files it names -------------------
  // Two ways a stylesheet can lie about a subset, both silent in a browser:
  //   A) it declares a range NARROWER than the file, so glyphs that were paid
  //      for can never be selected;
  //   B) it declares a range WIDER than the file, so the browser picks this
  //      face for a character it has not got.
  //
  // (B) is not a fault on its own — Spectral has no ① and IBM Plex Mono has no
  // ḥ, and the browser falls through to Inter, which declares that codepoint
  // and has it. It IS a fault when NO rule in the stylesheet both claims the
  // codepoint and contains it, because then the fall-through ends at the
  // platform. That is the regression the sans/serif CJK split could cause —
  // src/reader/reader.css's --yr-ui lists no serif CJK face after "Noto Sans
  // SC" — so that is what is checked: for every measured codepoint, at least
  // one @font-face must claim it AND have it.
  const cssPath = P('public/fonts/fonts.css');
  if (!existsSync(cssPath)) {
    bad++;
    console.log('\nFAIL public/fonts/fonts.css is missing');
  } else {
    const css = readFileSync(cssPath, 'utf8');
    const byFile = new Map(known.map((b) => [b.file, b]));
    const parsed = [];
    let rules = 0, seen = new Set();
    for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const block = m[1];
      const url = (block.match(/url\(['"]?([^'")]+)['"]?\)/) || [])[1];
      const ur = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
      const fam = (block.match(/font-family:\s*['"]([^'"]+)['"]/) || [])[1];
      if (!url) continue;
      rules++;
      const file = url.split('/').pop();
      const b = byFile.get(file);
      if (!b) { bad++; console.log(`\nFAIL fonts.css @font-face '${fam}' names ${file}, which is not a parsable file in public/fonts`); continue; }
      seen.add(file);
      if (!ur) { bad++; console.log(`\nFAIL fonts.css @font-face '${fam}' (${file}) declares no unicode-range`); continue; }
      const declared = parseRanges(ur.replace(/\s+/g, ''));
      const have = new Set(maps[b.path]);
      const mustGroup = new Set([...(required[b.group] ?? [])].filter((cp) => !SWEEP_ARTEFACTS.has(cp)));
      parsed.push({ file, fam, declared, have, group: b.group });
      // (A) built but unreachable — always a fault: bytes paid for, never used.
      const unreachable = [...have].filter((cp) => mustGroup.has(cp) && !inRanges(cp, declared));
      if (unreachable.length) {
        bad++;
        console.log(`\nFAIL ${file}: unicode-range does not claim ${unreachable.length} measured codepoint(s) the file contains — built and unusable`);
        console.log('     ' + unreachable.slice(0, 20).map(hex).join(' '));
      }
    }
    // (B) every measured codepoint must be claimed-AND-held by some rule.
    for (const g of Object.keys(shipped)) {
      const must = [...(required[g] ?? [])].filter((cp) => !SWEEP_ARTEFACTS.has(cp));
      const orphaned = must.filter((cp) => !parsed.some((r) => inRanges(cp, r.declared) && r.have.has(cp)));
      if (orphaned.length) {
        bad++;
        console.log(`\nFAIL group ${g}: ${orphaned.length} measured codepoint(s) are in no @font-face that both claims and contains them — these reach a system font`);
        console.log('     ' + orphaned.slice(0, 20).map(hex).join(' '));
      }
    }
    const orphan = known.filter((b) => !seen.has(b.file));
    if (orphan.length) {
      bad++;
      console.log(`\nFAIL ${orphan.length} file(s) in public/fonts are named by no @font-face in fonts.css: ${orphan.map((b) => b.file).join(', ')}`);
    }
    if (!bad) console.log(`\nfonts.css: ${rules} @font-face rules, every declared unicode-range matches its file exactly.`);
  }

  if (unclaimed.size) {
    bad++;
    console.log(`\nFAIL RANGES claims none of these, so they are built but can never be used:\n  ${[...unclaimed].map(hex).join(' ')}`);
  }
  if (SWEEP_ARTEFACTS.size)
    console.log(`\nnot required: ${[...SWEEP_ARTEFACTS].map(hex).join(' ')} — regex range endpoints in src/, never display text (see SWEEP_ARTEFACTS).`);
  if (sets.other.size) {
    console.log('\nWARNING — scripts with no bundled font:');
    for (const [name, set] of sets.other) {
      const where = [...(provenance.get('other:' + name) ?? new Map())].sort((a, b) => b[1] - a[1]).slice(0, 3);
      console.log(`  ${name}: ${set.size} codepoints — ${where.map(([f]) => f).join(', ')}`);
    }
  }
  console.log(bad ? `\n${bad} problem(s).` : '\nevery measured codepoint on a shipped page is covered by a bundled font.');
  process.exit(bad ? 1 : 0);
}

console.error('usage: font-coverage.mjs [--report|--emit <dir>|--check|--missing <group>] [--margin=full|punct|none]');
process.exit(2);
