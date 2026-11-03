// Turns a passage (or a chapter) and its data into HTML. Pure: strings in, string out, no DOM,
// so the layout rules are tested in node and run the same in the browser.
//
// Three layouts, one markup vocabulary:
//   verse      one line per verse, number in the margin           .yr-v
//   paragraph  running text, numbers inline, paragraphs from the data  .yr-p > .yr-v
//   parallel   interleaved: verse N of edition A, then B, then C under one number  .yr-pv > .yr-line
// A verse an edition omits is a dash line in parallel (never skipped), and simply absent in a single edition,
// as it is in the printed book.
import type { BookHeadings, BookPara, BookText, EditionInfo, HeadingEntry, Mode, UiLang } from './types.ts';
import { buildRows } from './parallel.ts';
import { headingAt, headingsIn } from './headings.ts';
import { keyChapter, keyVerse, vkey, creditLine } from './copy.ts';
import { escapeHtml, tokenize, tokensToHtml } from './text.ts';
import { t, type StringOverrides } from './strings.ts';

export interface Segment { chapter: number; v1?: number; v2?: number }

export interface BodyModel {
  uid: string;
  ui: UiLang;
  mode: Mode;
  book: number;
  segments: Segment[];
  /** in set order; more than one in parallel mode */
  editions: EditionInfo[];
  texts: (BookText | null)[];
  /** headings of the MAIN edition's set, per segment chapter's book (the book is the same for the whole passage) */
  headings: BookHeadings | null;
  para: BookPara | null;
  selected: ReadonlySet<number>;
  /** verse keys to mark as the deep link's target */
  highlight?: ReadonlySet<number>;
  /** passage: show at most this many verses until expanded */
  limit?: number;
  expanded?: boolean;
  /** headings whose background note is open, as "chapter:verse" */
  openContext?: ReadonlySet<string>;
  strings?: StringOverrides;
}

export interface BodyOut { html: string; total: number; shown: number; keys: number[] }

const langAttr = (e: EditionInfo): string => e.language;

function headingHtml(m: BodyModel, chapter: number, h: HeadingEntry, carried: boolean): string {
  const id = `${m.uid}-h${chapter}-${h.v}`;
  const open = m.openContext?.has(`${chapter}:${h.v}`) ?? false;
  const info = h.c
    ? `<button type="button" class="yr-hi" aria-expanded="${open}" aria-controls="${id}-c" aria-label="${escapeHtml(t('aboutSection', m.ui, undefined, m.strings))}"><span aria-hidden="true">i</span></button>` +
      `<p class="yr-ctx" id="${id}-c"${open ? '' : ' hidden'}>${escapeHtml(h.c)}</p>`
    : '';
  return `<div class="yr-hd${carried ? ' is-carried' : ''}" data-hv="${chapter}:${h.v}"><h3 class="yr-h" id="${id}" lang="${langAttr(m.editions[0]!)}">${escapeHtml(h.t)}</h3>${info}</div>`;
}

function numberButton(m: BodyModel, k: number): string {
  const sel = m.selected.has(k);
  return `<button type="button" class="yr-vn" data-k="${k}" aria-pressed="${sel}" aria-label="${escapeHtml(t('selectVerse', m.ui, { n: keyVerse(k) }, m.strings))}"><span aria-hidden="true">${keyVerse(k)}</span></button>`;
}

function verseText(m: BodyModel, k: number, raw: string, e: EditionInfo): string {
  return tokensToHtml(tokenize(raw, e.id), e.id, `${m.uid}-n${k}-${e.id}`, (n) => t('noteN', m.ui, { n }, m.strings));
}

const cls = (m: BodyModel, k: number): string => `${m.selected.has(k) ? ' is-sel' : ''}${m.highlight?.has(k) ? ' is-hl' : ''}`;

export function renderBody(m: BodyModel): BodyOut {
  const main = m.editions[0]!;
  const parallel = m.mode === 'parallel' && m.editions.length > 1;
  const multiChapter = m.segments.length > 1;
  const out: string[] = [];
  const keys: number[] = [];
  let shown = 0;
  let total = 0;

  // First count the rows so "show the other N" is right even when the limit cuts early.
  const segRows = m.segments.map((s) => {
    const rows = buildRows(m.texts, s.chapter, s.v1, s.v2).filter((r) => parallel || r.cells[0] != null);
    total += rows.length;
    return rows;
  });
  const cap = m.limit != null && !m.expanded ? m.limit : Infinity;

  m.segments.forEach((seg, si) => {
    const all = segRows[si]!;
    if (!all.length) return;
    const room = cap - shown;
    if (room <= 0) return;
    const rows = all.slice(0, room);
    shown += rows.length;
    if (multiChapter) out.push(`<h4 class="yr-ch" data-chapter="${seg.chapter}">${escapeHtml(t('chapterN', m.ui, { n: seg.chapter }, m.strings))}</h4>`);

    // headings that fall inside what is shown, plus the one the first verse sits under
    const first = rows[0]!.v, last = rows[rows.length - 1]!.v;
    const hs = headingsIn(m.headings, seg.chapter, first, last);
    const carriedHead = headingAt(m.headings, seg.chapter, first);
    const headFor = new Map<number, { h: HeadingEntry; carried: boolean }>();
    if (carriedHead && carriedHead.v < first && seg.v1 != null && seg.v1 > 1) headFor.set(first, { h: carriedHead, carried: true });
    for (const h of hs) headFor.set(h.v, { h, carried: false });
    const paraStarts = new Set(m.para?.[String(seg.chapter)] ?? []);

    if (m.mode === 'paragraph' && !parallel) {
      let open = false;
      for (const r of rows) {
        const k = vkey(seg.chapter, r.v);
        keys.push(k);
        const hd = headFor.get(r.v);
        if (hd) { if (open) { out.push('</p>'); open = false; } out.push(headingHtml(m, seg.chapter, hd.h, hd.carried)); }
        if (!open || paraStarts.has(r.v)) { if (open) out.push('</p>'); out.push(`<p class="yr-p" lang="${langAttr(main)}">`); open = true; }
        out.push(`<span class="yr-v${cls(m, k)}" data-k="${k}" id="${m.uid}-k${k}">${numberButton(m, k)}<span class="yr-t">${verseText(m, k, r.cells[0]!, main)}</span> </span>`);
      }
      if (open) out.push('</p>');
      return;
    }

    for (const r of rows) {
      const k = vkey(seg.chapter, r.v);
      keys.push(k);
      const hd = headFor.get(r.v);
      if (hd) out.push(headingHtml(m, seg.chapter, hd.h, hd.carried));
      if (parallel) {
        const lines = m.editions.map((e, i) => {
          const raw = r.cells[i];
          const label = `<span class="yr-lab" aria-hidden="true">${escapeHtml(e.narrow)}</span>`;
          const sr = `<span class="yr-sr">${escapeHtml(e.narrow)}: </span>`;
          if (raw == null) return `<p class="yr-line is-gap" lang="${langAttr(e)}" data-ed="${e.id}">${sr}<span class="yr-t" aria-label="${escapeHtml(t('notInEdition', m.ui, undefined, m.strings))}">—</span>${label}</p>`;
          return `<p class="yr-line" lang="${langAttr(e)}" data-ed="${e.id}">${sr}<span class="yr-t">${verseText(m, k, raw, e)}</span>${label}</p>`;
        });
        out.push(`<div class="yr-pv${cls(m, k)}" data-k="${k}" id="${m.uid}-k${k}">${numberButton(m, k)}<div class="yr-pl">${lines.join('')}</div></div>`);
      } else {
        out.push(`<p class="yr-v${cls(m, k)}" data-k="${k}" id="${m.uid}-k${k}" lang="${langAttr(main)}">${numberButton(m, k)}<span class="yr-t">${verseText(m, k, r.cells[0]!, main)}</span></p>`);
      }
    }
  });

  return { html: out.join(''), total, shown, keys };
}

/** The quiet credit block under a passage: one line per edition on screen. */
export function renderCredit(editions: readonly EditionInfo[], ui: UiLang, strings?: StringOverrides): string {
  return `<ul class="yr-credit" aria-label="${escapeHtml(t('creditLabel', ui, undefined, strings))}">${editions.map((e) => `<li lang="${e.language}">${escapeHtml(creditLine(e))}</li>`).join('')}</ul>`;
}

export { keyChapter };
