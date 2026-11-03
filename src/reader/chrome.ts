// DOM helpers the chapter reader and the passage share: theme and size, the toast, and the sheets
// (edition, parallel set, book and chapter, display). Sheets are native <dialog> elements opened with showModal():
// focus is trapped, Escape closes, the page behind is inert, and focus returns to what opened them.
import { BOOKS, bookNameIn, editionById, isNT } from './books.ts';
import { EDITIONS } from './books.ts';
import { moveEdition, pickerRows, toggleEdition, MAX_PARALLEL } from './parallel.ts';
import { SIZE_STEPS } from './prefs.ts';
import type { Session } from './session.ts';
import { escapeHtml } from './text.ts';
import type { ThemePref, UiLang } from './types.ts';

export const resolveTheme = (pref: ThemePref): 'dark' | 'light' | 'paper' => {
  if (pref !== 'auto') return pref;
  try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'paper'; } catch { return 'dark'; }
};

/** Puts the session's language, direction, theme and size on a reader root. */
export function applyChrome(root: HTMLElement, s: Session): void {
  root.lang = s.ui;
  root.dir = s.dir;
  root.dataset.theme = resolveTheme(s.prefs.theme);
  root.style.setProperty('--yr-scale', String(s.prefs.size));
}

export function reducedMotion(): boolean {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// ── toast ────────────────────────────────────────────────────────────────

export function mountToast(root: HTMLElement): (msg: string, kind?: 'ok' | 'warn') => void {
  const el = document.createElement('div');
  el.className = 'yr-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  root.appendChild(el);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (msg, kind = 'ok') => {
    el.textContent = '';
    // re-setting the text on the next frame makes assistive tech announce a repeated message again
    requestAnimationFrame(() => { el.textContent = msg; });
    el.dataset.kind = kind;
    el.classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('is-on'), kind === 'warn' ? 4200 : 2200);
  };
}

// ── sheets ───────────────────────────────────────────────────────────────

export class Sheet {
  dialog: HTMLDialogElement;
  private opener: HTMLElement | null = null;
  private render: () => string = () => '';
  private onClick: (el: HTMLElement, ev: MouseEvent) => void = () => {};

  constructor(root: HTMLElement, private s: Session, label: string) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'yr-sheet';
    this.dialog.setAttribute('aria-label', label);
    root.appendChild(this.dialog);
    this.dialog.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === this.dialog) { this.close(); return; } // the backdrop
      const act = target.closest<HTMLElement>('[data-act]');
      if (act && this.dialog.contains(act)) this.onClick(act, e);
    });
    this.dialog.addEventListener('close', () => { this.opener?.focus?.({ preventScroll: true }); this.opener = null; });
  }

  open(label: string, render: () => string, onClick: (el: HTMLElement, ev: MouseEvent) => void): void {
    this.dialog.setAttribute('aria-label', label);
    this.render = render;
    this.onClick = onClick;
    this.opener = document.activeElement as HTMLElement | null;
    this.refresh();
    if (!this.dialog.open) this.dialog.showModal();
    // dialog and its content follow the reader's language and direction
    this.dialog.lang = this.s.ui;
    this.dialog.dir = this.s.dir;
    const first = this.dialog.querySelector<HTMLElement>('[autofocus],[aria-checked="true"],[aria-pressed="true"],button');
    first?.focus({ preventScroll: true });
  }

  /** Re-render the body keeping the scroll position and the focused control. */
  refresh(): void {
    const focused = document.activeElement as HTMLElement | null;
    const key = focused && this.dialog.contains(focused) ? focused.getAttribute('data-act') + '|' + (focused.getAttribute('data-id') ?? '') : null;
    const body = this.dialog.querySelector('.yr-sheet-body') as HTMLElement | null;
    const scroll = body?.scrollTop ?? 0;
    this.dialog.innerHTML = this.render();
    const nb = this.dialog.querySelector('.yr-sheet-body') as HTMLElement | null;
    if (nb) nb.scrollTop = scroll;
    if (key) {
      const [act, id] = key.split('|');
      this.dialog.querySelector<HTMLElement>(`[data-act="${act}"][data-id="${id}"]`)?.focus({ preventScroll: true });
    }
  }

  close(): void { if (this.dialog.open) this.dialog.close(); }
  get isOpen(): boolean { return this.dialog.open; }
}

const head = (s: Session, title: string): string =>
  `<header class="yr-sheet-h"><h2 class="yr-sheet-t">${escapeHtml(title)}</h2><button type="button" class="yr-btn yr-btn-quiet" data-act="close">${escapeHtml(s.tr('done'))}</button></header>`;

const groupName = (s: Session, l: UiLang): string =>
  s.tr(l === 'en' ? 'groupEnglish' : l === 'zh-Hans' ? 'groupHans' : l === 'zh-Hant' ? 'groupHant' : 'groupRussian');

const licenceWord = (s: Session, kind: string): string => s.tr(kind === 'cc0' ? 'licenceCC0' : 'licencePD');

/** Single edition: grouped by language, the interface language's group first. */
export function editionSheetHtml(s: Session): string {
  const order: UiLang[] = [s.ui, ...(['en', 'ru', 'zh-Hans', 'zh-Hant'] as UiLang[]).filter((l) => l !== s.ui)];
  const current = s.single().id;
  const groups = order.map((l) => {
    const rows = EDITIONS.filter((e) => e.language === l);
    if (!rows.length) return '';
    return `<div role="radiogroup" aria-labelledby="yr-g-${l}"><h3 class="yr-group" id="yr-g-${l}" lang="${l}">${escapeHtml(groupName(s, l))}</h3>` +
      rows.map((e) => `<button type="button" class="yr-opt" role="radio" aria-checked="${e.id === current}" data-act="edition" data-id="${e.id}">` +
        `<span class="yr-opt-n" lang="${e.language}">${escapeHtml(e.label)}<small>${escapeHtml(e.menu)}</small></span>` +
        `<span class="yr-tag">${escapeHtml(licenceWord(s, e.licence.kind))}</span><span class="yr-radio" aria-hidden="true"></span></button>`).join('') + '</div>';
  }).join('');
  return head(s, s.tr('chooseEdition')) + `<div class="yr-sheet-body">${groups}<div class="yr-sheet-f"><button type="button" class="yr-btn yr-btn-quiet" data-act="compare">${escapeHtml(s.tr('compareEditions'))}</button></div></div>`;
}

/** The parallel set: your set in order (move, remove), then the editions to add, max three. */
export function parallelSheetHtml(s: Session): string {
  const set = s.set().map((e) => e.id);
  const rows = pickerRows(set, s.ui);
  const yours = set.map((id, i) => {
    const e = editionById(id)!;
    return `<li class="yr-set-row"><span class="yr-opt-n" lang="${e.language}">${escapeHtml(e.label)}${i === 0 ? `<small>${escapeHtml(s.tr('mainEdition'))}</small>` : ''}</span>` +
      `<button type="button" class="yr-ib" data-act="up" data-id="${id}" aria-label="${escapeHtml(s.tr('moveUp'))}: ${escapeHtml(e.label)}"${i === 0 ? ' disabled' : ''}><span aria-hidden="true">↑</span></button>` +
      `<button type="button" class="yr-ib" data-act="down" data-id="${id}" aria-label="${escapeHtml(s.tr('moveDown'))}: ${escapeHtml(e.label)}"${i === set.length - 1 ? ' disabled' : ''}><span aria-hidden="true">↓</span></button></li>`;
  }).join('');
  const order: UiLang[] = [s.ui, ...(['en', 'ru', 'zh-Hans', 'zh-Hant'] as UiLang[]).filter((l) => l !== s.ui)];
  const list = order.map((l) => {
    const inGroup = rows.filter((r) => r.group === l && !r.folded);
    if (!inGroup.length) return '';
    return `<h3 class="yr-group" lang="${l}">${escapeHtml(groupName(s, l))}</h3>` + inGroup.map((r) => {
      const e = editionById(r.id)!;
      const dis = r.disabledReason === 'max';
      return `<button type="button" class="yr-opt" role="checkbox" aria-checked="${r.checked}" data-act="toggle" data-id="${r.id}"${dis ? ' aria-disabled="true"' : ''}>` +
        `<span class="yr-opt-n" lang="${e.language}">${escapeHtml(e.label)}<small>${escapeHtml(dis ? s.tr('maxThree') : e.menu)}</small></span><span class="yr-check" aria-hidden="true"></span></button>`;
    }).join('');
  }).join('');
  const hint = set.length < 2 ? s.tr('addToCompare') : s.tr('parallelHint');
  return head(s, `${s.tr('compareEditions')} (${set.length}/${MAX_PARALLEL})`) +
    `<div class="yr-sheet-body"><ol class="yr-set" aria-label="${escapeHtml(s.tr('compareEditions'))}">${yours}</ol><p class="yr-hint">${escapeHtml(hint)}</p>${list}</div>`;
}

export interface BookSheetState { step: 'books' | 'chapters'; testament: 'ot' | 'nt'; book: number }

export function bookSheetHtml(s: Session, st: BookSheetState): string {
  const lang = s.main().language;
  if (st.step === 'chapters') {
    const b = BOOKS[st.book - 1]!;
    const grid = Array.from({ length: b.chapters }, (_x, i) => `<button type="button" class="yr-ch-btn" data-act="chapter" data-id="${i + 1}">${i + 1}</button>`).join('');
    return `<header class="yr-sheet-h"><button type="button" class="yr-btn yr-btn-quiet" data-act="back">‹ ${escapeHtml(s.tr('back'))}</button><h2 class="yr-sheet-t" lang="${lang}">${escapeHtml(bookNameIn(st.book, lang))}</h2><button type="button" class="yr-btn yr-btn-quiet" data-act="close">${escapeHtml(s.tr('close'))}</button></header>` +
      `<div class="yr-sheet-body"><h3 class="yr-group">${escapeHtml(s.tr('chapters'))}</h3><div class="yr-ch-grid">${grid}</div></div>`;
  }
  const recent = s.recentRefs();
  const rec = recent.length ? `<h3 class="yr-group">${escapeHtml(s.tr('recent'))}</h3><div class="yr-chips">${recent.map((r) => `<button type="button" class="yr-chip" lang="${lang}" data-act="recent" data-id="${r.book}:${r.chapter}">${escapeHtml(bookNameIn(r.book, lang))} ${r.chapter}</button>`).join('')}</div>` : '';
  const list = BOOKS.filter((b) => (st.testament === 'nt') === isNT(b.n)).map((b) =>
    `<button type="button" class="yr-book" lang="${lang}" data-act="book" data-id="${b.n}">${escapeHtml(bookNameIn(b.n, lang))}</button>`).join('');
  return head(s, s.tr('pickChapter')) +
    `<div class="yr-sheet-body">${rec}<div class="yr-seg" role="group" aria-label="${escapeHtml(s.tr('pickChapter'))}">` +
    `<button type="button" aria-pressed="${st.testament === 'ot'}" data-act="testament" data-id="ot">${escapeHtml(s.tr('oldTestament'))}</button>` +
    `<button type="button" aria-pressed="${st.testament === 'nt'}" data-act="testament" data-id="nt">${escapeHtml(s.tr('newTestament'))}</button></div>` +
    `<div class="yr-books">${list}</div></div>`;
}

export function displaySheetHtml(s: Session): string {
  const sizeLabels = ['A−−', 'A−', 'A', 'A+', 'A++'];
  const sizes = SIZE_STEPS.map((z, i) => `<button type="button" role="radio" aria-checked="${s.prefs.size === z}" data-act="size" data-id="${z}" aria-label="${escapeHtml(s.tr('textSize'))} ${i + 1}/5">${sizeLabels[i]}</button>`).join('');
  const themes: [ThemePref, 'themeAuto' | 'themeDark' | 'themeLight' | 'themePaper'][] = [['auto', 'themeAuto'], ['dark', 'themeDark'], ['light', 'themeLight'], ['paper', 'themePaper']];
  const th = themes.map(([v, k]) => `<button type="button" class="yr-opt" role="radio" aria-checked="${s.prefs.theme === v}" data-act="theme" data-id="${v}"><span class="yr-opt-n">${escapeHtml(s.tr(k))}</span><span class="yr-radio" aria-hidden="true"></span></button>`).join('');
  const review = s.ui === 'ru' ? `<p class="yr-hint">${escapeHtml(s.tr('notReviewed'))}</p>` : '';
  return head(s, s.tr('display')) +
    `<div class="yr-sheet-body"><h3 class="yr-group" id="yr-g-size">${escapeHtml(s.tr('textSize'))}</h3><div class="yr-sizes" role="radiogroup" aria-labelledby="yr-g-size">${sizes}</div>` +
    `<div role="radiogroup" aria-labelledby="yr-g-theme"><h3 class="yr-group" id="yr-g-theme">${escapeHtml(s.tr('theme'))}</h3>${th}</div>${review}</div>`;
}

export { toggleEdition, moveEdition };
