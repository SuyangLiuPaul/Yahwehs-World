// How a verse of Words' data becomes text on screen and text on the clipboard.
//
// Ported from Words' lib/constants/text_patterns.dart (sanitizeForCopy, displayVerseText,
// englishDivineName, the divine-name rule) and lib/utils/build_verse_content_spans.dart (what
// `<note:>`, `{}` and `[]` mean on screen). The data files are Words' bytes; this is the only
// place their markup is interpreted.

const NOTE = /<note:([^>]+)>/g;
const BRACE = /\{([^}]+)\}/g;
const PILCROW = /[¶§]\s*/g;

/** Editions whose `[...]` is the edition's own mark for "supplied by the editor" and stays printed. */
export const BRACKET_EDITIONS: ReadonlySet<string> = new Set(['cuvs-yhwh', 'cuvs-yhwh-tr']);

const HAS_CJK = /[㐀-鿿]/;

// ── divine name ──────────────────────────────────────────────────────────

const OF_LORDS = /^ OF LORDS\b/;
const NEXT_WORD = /^[,:;.!?’”"]*\s+([A-Za-z]+)/;
const PREV_WORD = /([A-Za-z]+)[,:;]?\s+$/;
const inCapitals = (w: string): boolean =>
  w.length >= 2 && w !== 'LORD' && w !== 'GOD' && w !== 'LORDS' && /^[A-Z]+$/.test(w);

/** English half of the rule: only the printed small-capital forms are the name; "Lord" stays. */
export function englishDivineName(text: string): string {
  if (!text.includes('LORD') && !text.includes('GOD') && !text.includes('JEHOVAH')) return text;
  const out = text
    .replace(/\b[Tt]he LORD (?:JEHOVAH|GOD)\b/g, 'Yah Yahweh')
    .replace(/\bGOD the LORD\b/g, 'Yah Yahweh')
    .replace(/\bLORD JEHOVAH\b/g, 'Yah Yahweh')
    .replace(/\bLord GOD\b/g, 'Lord Yahweh')
    .replace(/\bGOD the Lord\b/g, 'Yahweh the Lord')
    .replace(/\bJEHOVAH\b/g, 'YAHWEH')
    .replace(/\bLORD(['’])S\b/g, (_m, q: string) => `LORD${q}s`);
  return out.replace(/\b(THE |[Tt]he )?LORD\b/g, (m: string, art: string | undefined, offset: number) => {
    const after = out.slice(offset + m.length);
    if (OF_LORDS.test(after)) return m; // Revelation 19:16, kyrios: never the name
    const next = after.match(NEXT_WORD)?.[1] ?? '';
    const prev = out.slice(offset > 40 ? offset - 40 : 0, offset).match(PREV_WORD)?.[1] ?? '';
    if (art === 'THE ' || inCapitals(prev) || inCapitals(next)) return 'YAHWEH';
    return 'Yahweh';
  });
}

/** 耶和华 -> 雅伟, 耶和華 -> 雅偉; English small-capital LORD -> Yahweh. */
export function normalizeDivineNames(text: string): string {
  return englishDivineName(text.replace(/耶和华/g, '雅伟').replace(/耶和華/g, '雅偉'));
}

const collapse = (t: string): string => t.replace(/([，。；：？！、])\1+/g, '$1').replace(/ {2,}/g, ' ');

/** Plain text for the clipboard and search: notes removed, supplied words kept as words. */
export function sanitizeForCopy(text: string): string {
  return collapse(
    normalizeDivineNames(
      text.replace(NOTE, '').replace(BRACE, '$1').replace(PILCROW, '').replace(/\n/g, ' '),
    ).trim(),
  );
}

/** Like the above for a verse as the reader shows it in a line of plain text:
 *  an editor's insertion in a Chinese edition keeps its mark (〔雅伟〕), English supplied words read as words. */
export function displayPlain(text: string): string {
  const t = sanitizeForCopy(text).replace(/\[([^\]]+)\]/g, (_m, inner: string) => (HAS_CJK.test(inner) ? `〔${inner}〕` : inner));
  return t.replace(/[\[\]{}]/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ── tokens for the screen ────────────────────────────────────────────────

export type Token =
  | { k: 'text'; s: string }
  /** an editor's mark: printed with its brackets in the Yahweh Chinese editions, plain otherwise */
  | { k: 'ed'; s: string }
  | { k: 'note'; n: number; s: string };

/** Cleans one verse into tokens. Footnote numbers restart at 1 in each verse (as Words' note block does). */
export function tokenize(raw: string, edition: string): Token[] {
  let t = raw.replace(PILCROW, '').replace(/\n/g, ' ');
  t = t.replace(BRACE, '$1');
  // a stray space between an annotation and CJK text is an artefact of the source (Words: collapseAnnotationSpacing)
  const cjk = '[\\u3000-\\u303f\\u4e00-\\u9fff\\uff00-\\uffef]';
  t = t.replace(new RegExp(`([}\\]>])[ \\t]+(${cjk})`, 'g'), '$1$2').replace(new RegExp(`(${cjk})[ \\t]+([{\\[<])`, 'g'), '$1$2');
  const out: Token[] = [];
  const re = /<note:([^>]+)>|\[([^\]]+)\]/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  const push = (s: string) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev && prev.k === 'text') prev.s += s; else out.push({ k: 'text', s });
  };
  while ((m = re.exec(t))) {
    push(normalizeDivineNames(t.slice(last, m.index)));
    if (m[1] != null) out.push({ k: 'note', n: ++n, s: m[1].trim() });
    else out.push({ k: 'ed', s: normalizeDivineNames(m[2]!) });
    last = m.index + m[0].length;
  }
  push(normalizeDivineNames(t.slice(last)));
  // trim the edges of the verse
  const first = out[0];
  if (first && first.k === 'text') first.s = first.s.replace(/^\s+/, '');
  const end = out[out.length - 1];
  if (end && end.k === 'text') end.s = end.s.replace(/\s+$/, '');
  // a bracket opened in one verse and closed in another leaves a lone bracket: drop it
  for (const tok of out) if (tok.k === 'text') tok.s = tok.s.replace(/[\[\]]/g, '').replace(/ {2,}/g, ' ');
  return out;
}

/** The `[x]` of an editor's mark as it should print: with brackets only in the Chinese editions. */
export function editorMark(s: string, edition: string): string {
  return BRACKET_EDITIONS.has(edition) ? `[${s}]` : s;
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const escapeHtml = esc;

/** HTML for the tokens of a verse. Footnote markers are buttons; `idPrefix` makes their ids unique. */
export function tokensToHtml(tokens: readonly Token[], edition: string, idPrefix: string, noteLabel: (n: number) => string): string {
  let html = '';
  for (const t of tokens) {
    if (t.k === 'text') html += esc(t.s);
    else if (t.k === 'ed') html += `<span class="yr-ed">${esc(editorMark(t.s, edition))}</span>`;
    else html += `<button type="button" class="yr-fn" data-fn="${idPrefix}" aria-expanded="false" aria-controls="${idPrefix}-notes" aria-label="${esc(noteLabel(t.n))}"><span aria-hidden="true">${t.n}</span></button>`;
  }
  return html;
}

export function notesHtml(tokens: readonly Token[], idPrefix: string): string {
  const notes = tokens.filter((t): t is Extract<Token, { k: 'note' }> => t.k === 'note');
  if (!notes.length) return '';
  return `<ol class="yr-notes" id="${idPrefix}-notes" hidden>${notes.map((n) => `<li value="${n.n}">${esc(n.s)}</li>`).join('')}</ol>`;
}
