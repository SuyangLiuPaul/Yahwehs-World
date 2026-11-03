// Every Chinese string the product can put on screen, collected the same way twice.
//
// scripts/build-zh-hant.mjs (which BUILDS the 繁體 table) and scripts/audit-zh-hant.mjs (which PROVES the table
// leaves nothing Simplified behind) used to each carry their own copy of the scan. They agreed, which is worse than
// disagreeing: both ran `/'((?:[^'\\\n]|\\.)*)'/g` over the file text, and that regex has no idea what a string is.
// One apostrophe inside a DOUBLE-quoted English sibling —
//
//     t("Artist's impression · drawn with AI tools…", '画家的想象 · AI 辅助绘制，逐节审核', '…')
//
// — opens a "literal" at `'s`, closes it at the quote in front of 画家, and the Chinese string that follows is never
// seen by either script. So 辅 never reached the character table (P0-3: "AI 辅助繪制" under all 1,443 pictures) and
// the audit reported 0 leftovers while looking straight past it. The scanner below reads the file the way the
// language does — comments, escapes, all three quote kinds, and regex literals — and both scripts import it, so a
// source the one scans is a source the other checks.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const HAS_CJK = /[一-鿿]/;
/** Every run of Chinese characters and Chinese punctuation: how src/locale.ts hant() keys its lookups. */
export const CJK_RUN = /[　-〿一-鿿！-･]+/g;

/** Source-level escapes, so a key matches the string the app actually holds. */
export function unescapeLiteral(literal) {
  return literal.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(['"`\\])/g, '$1');
}

/** True where a `/` opens a regex literal rather than dividing: after an operator, a comma, an opening bracket or a keyword. */
const REGEX_OK = /(^|[({[,;:=!&|?+\-*%~^<>]|\b(?:return|typeof|case|in|of|new|delete|void|do|else|yield|await)\s*)$/;

/**
 * The string and template literals of one JavaScript/TypeScript file, in source order.
 * Templates are returned split on `${…}`, because only their static chunks are translatable text.
 * @returns {string[]} raw literal bodies (still escaped; pass each through unescapeLiteral)
 */
export function scanLiterals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  // what came before the cursor, with strings and comments already removed: enough to tell `/` apart from a regex
  let prev = '';
  const note = (ch) => { if (!/\s/.test(ch)) prev = (prev + ch).slice(-12); };
  while (i < n) {
    const c = src[i];
    // comments
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    // a regex literal: skipped whole, so a quote inside its character class cannot open a string
    if (c === '/' && REGEX_OK.test(prev)) {
      let j = i + 1, cls = false, ok = false;
      for (; j < n; j++) {
        const d = src[j];
        if (d === '\\') { j++; continue; }
        if (d === '\n') break;
        if (cls) { if (d === ']') cls = false; continue; }
        if (d === '[') { cls = true; continue; }
        if (d === '/') { ok = true; break; }
      }
      if (ok) { i = j + 1; prev = '/'; continue; }
      // not a regex after all (a lone division at the end of a line): fall through
    }
    if (c === '"' || c === "'" || c === '`') {
      const tpl = c === '`';
      let j = i + 1, body = '', depth = 0;
      const chunks = [];
      for (; j < n; j++) {
        const d = src[j];
        if (d === '\\') { body += d + (src[j + 1] ?? ''); j++; continue; }
        if (!tpl && (d === '\n' || d === c)) break;           // an unterminated quote stops at the line end
        if (tpl && d === '$' && src[j + 1] === '{') {
          // a substitution: close this chunk and skip the expression (nested braces, strings and all)
          chunks.push(body); body = '';
          j += 2; depth = 1;
          for (; j < n && depth > 0; j++) {
            const e = src[j];
            if (e === '{') depth++;
            else if (e === '}') depth--;
            else if (e === '"' || e === "'" || e === '`') { // a string inside the expression
              const q = e; j++;
              for (; j < n; j++) { if (src[j] === '\\') { j++; continue; } if (src[j] === q) break; }
            }
          }
          j--;
          continue;
        }
        if (tpl && d === '`') break;
        body += d;
      }
      chunks.push(body);
      for (const chunk of chunks) if (chunk) out.push(chunk);
      i = j + 1;
      prev = 'x';
      continue;
    }
    note(c);
    i++;
  }
  return out;
}

/** Every .ts / .mjs / .js file under `dir`, at any depth. */
export function* codeFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') yield* codeFiles(p); }
    else if (/\.(ts|mjs|js)$/.test(e.name) && !e.name.endsWith('.d.ts')) yield p;
  }
}

/** The attributes that carry Chinese a page renders. data-zh-narrow and data-aria-zh were never scanned before. */
const HTML_ATTRS = ['data-zh', 'data-zh-narrow', 'data-zh-text', 'data-aria-zh', 'title', 'content', 'aria-label', 'placeholder'];

/** Chinese from one HTML page: the localised attributes and the text written straight into an element. */
export function scanHtml(text, onString) {
  for (const attr of HTML_ATTRS) {
    for (const m of text.matchAll(new RegExp(`${attr}="([^"]*)"`, 'g'))) if (HAS_CJK.test(m[1])) onString(m[1]);
  }
  for (const m of text.matchAll(/>([^<>]*)</g)) {
    const inner = m[1].trim();
    if (HAS_CJK.test(inner)) onString(inner);
  }
}

export function walkJson(node, onString) {
  if (typeof node === 'string') { if (HAS_CJK.test(node)) onString(node); return; }
  if (Array.isArray(node)) { for (const v of node) walkJson(v, onString); return; }
  if (node && typeof node === 'object') for (const v of Object.values(node)) walkJson(v, onString);
}

/** The gazetteer-shaped payloads: place names, journeys, the inventory. Scanned FIRST. */
export const PLACE_JSON = ['places.json', 'journeys.json', 'scenes.json', 'inventory.json'];
/** The event text: descriptions, captions, summaries. Scanned LAST, so a string another source also carries keeps
 *  that source — which is what lets the builder apply the counted "event strings earn a phrase entry only when the
 *  character map alone would get them wrong" rule to exactly the strings it was written for. */
export const EVENT_JSON = ['events.json', 'gallery/index.json', 'gallery/summaries.json'];
/** The JSON payloads a page converts at run time. */
export const RUNTIME_JSON = [...PLACE_JSON, ...EVENT_JSON];
/** Where a string found in EVENT_JSON is recorded. */
export const isEventSource = (where) => EVENT_JSON.some((f) => where === `data/${f}`);

/** The store listing: its Chinese is shipped text too, and nothing used to check it. */
export const STORE_JSON = ['docs/store-listing/world-1.0.0.json'];

/**
 * Every Chinese string of this checkout, with where it came from. One function, so the builder and the auditor
 * cannot look at different sets.
 * @returns {Map<string, string>} string -> the file it was found in
 */
export function collectStrings(ROOT, { runtimeJson = true, store = true } = {}) {
  const found = new Map();
  const add = (s, where) => { if (s && HAS_CJK.test(s) && !found.has(s)) found.set(s, where); };

  if (runtimeJson) {
    for (const f of PLACE_JSON) {
      const p = join(ROOT, 'public/data', f);
      if (existsSync(p)) walkJson(JSON.parse(readFileSync(p, 'utf8')), (s) => add(s, `data/${f}`));
    }
  }
  if (store) {
    for (const f of STORE_JSON) {
      const p = join(ROOT, f);
      if (existsSync(p)) walkJson(JSON.parse(readFileSync(p, 'utf8')), (s) => add(s, f));
    }
  }
  // the code: src/ (the app) and scripts/lib/ (the build templates that write Chinese into the pages)
  for (const dir of ['src', 'scripts/lib']) {
    const base = join(ROOT, dir);
    if (!existsSync(base)) continue;
    for (const file of codeFiles(base)) {
      const where = file.slice(ROOT.length + 1);
      for (const raw of scanLiterals(readFileSync(file, 'utf8'))) add(unescapeLiteral(raw), where);
    }
  }
  // the page templates in scripts/build-shell.mjs and the gallery surface write Chinese directly
  for (const f of ['scripts/build-shell.mjs', 'scripts/lib/vite-gallery-surface.mjs']) {
    const p = join(ROOT, f);
    if (existsSync(p)) for (const raw of scanLiterals(readFileSync(p, 'utf8'))) add(unescapeLiteral(raw), f);
  }
  for (const page of readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
    scanHtml(readFileSync(join(ROOT, page), 'utf8'), (s) => add(s, page));
  }
  // src/locale.ts looks a string up whole, then run by run, so the table has to be keyed both ways
  for (const [s, where] of [...found]) {
    for (const run of s.match(CJK_RUN) ?? []) add(run, where);
  }
  // LAST: the event text (see EVENT_JSON). Both the string and its runs, so the counted rule sees them as its own.
  if (runtimeJson) {
    for (const f of EVENT_JSON) {
      const p = join(ROOT, 'public/data', f);
      if (!existsSync(p)) continue;
      walkJson(JSON.parse(readFileSync(p, 'utf8')), (s) => {
        for (const x of [s, ...(s.match(CJK_RUN) ?? [])]) add(x, `data/${f}`);
      });
    }
  }
  return found;
}
