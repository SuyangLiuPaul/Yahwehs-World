// The reader's DOM: a chapter reader and a passage (the verses under a picture) built from one class.
//
// Both render with render.ts, load with store.ts, and share the Session (edition, layout, language, size, theme).
// What differs: the chapter reader has the chapter bar, the book picker and the location hash; the passage has
// the "read the whole chapter" link and shows the first few verses until expanded.
import { afterLayout } from './layout.ts';
import { editionById, labelLanguage, referenceLabel, stepChapter } from './books.ts';
import { applyChrome, bookSheetHtml, displaySheetHtml, editionSheetHtml, mountToast, parallelSheetHtml, reducedMotion, Sheet } from './chrome.ts';
import type { BookSheetState } from './chrome.ts';
import { buildCopy, buildParallelCopy, copyText, creditLine, heading, keyChapter, keyVerse, passageLabel, selectionText, shareOrCopy, vkey } from './copy.ts';
import { wordsChapterUrl } from './words-link.ts';
import { headingSetFor } from './headings.ts';
import { moveEdition, toggleEdition } from './parallel.ts';
import { renderBody, renderCredit } from './render.ts';
import type { Segment } from './render.ts';
import { formatHash, parseHash } from './route.ts';
import { sessionFor, type ReaderOptions, type Session } from './session.ts';
import { LoadError } from './store.ts';
import { escapeHtml } from './text.ts';
import type { BookHeadings, BookPara, BookText, EditionInfo, Mode, Ref } from './types.ts';

export interface PassageSpec {
  book: number;
  from: { chapter: number; verse: number };
  to: { chapter: number; verse: number };
  /** verses shown before "show the other N" (default 12) */
  limit?: number;
}

export interface ReaderHandle {
  el: HTMLElement;
  session: Session;
  /** Chapter reader: go to a chapter (and highlight a verse range). Passage: replace the passage. */
  goto(target: Ref | PassageSpec): Promise<void>;
  current(): Ref;
  /** Re-render with the session's present state (after a host changes language or theme). */
  refresh(): Promise<void>;
  destroy(): void;
}

interface Data {
  editions: EditionInfo[];
  texts: (BookText | null)[];
  headings: BookHeadings | null;
  para: BookPara | null;
}

let uidCounter = 0;

export class ReaderView implements ReaderHandle {
  el: HTMLElement;
  session: Session;
  private kind: 'chapter' | 'passage';
  private opts: ReaderOptions;
  private uid: string;
  private ref: Ref;
  private spec: PassageSpec | null = null;
  private data: Data | null = null;
  private selected = new Set<number>();
  private anchorKey: number | null = null;
  private openContext = new Set<string>();
  private expanded = false;
  private seq = 0;
  private bodyEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private footEl!: HTMLElement;
  private selbar!: HTMLElement;
  private toastFn!: (msg: string, kind?: 'ok' | 'warn') => void;
  private sheet!: Sheet;
  private bookState: BookSheetState = { step: 'books', testament: 'ot', book: 1 };
  private off: (() => void)[] = [];
  private lastShown = { shown: 0, total: 0, keys: [] as number[] };
  private notice: string | null = null;
  private highlight = new Set<number>();
  private mq: MediaQueryList | null = null;

  constructor(host: HTMLElement, kind: 'chapter' | 'passage', opts: ReaderOptions, start: Ref | PassageSpec) {
    this.kind = kind;
    this.opts = opts;
    this.session = sessionFor(opts);
    this.uid = `yr${++uidCounter}`;
    if (kind === 'passage') {
      this.spec = start as PassageSpec;
      this.ref = { book: this.spec.book, chapter: this.spec.from.chapter, v1: this.spec.from.verse };
    } else {
      this.ref = start as Ref;
    }
    this.el = host;
    this.build();
    this.wire();
  }

  // ── structure ───────────────────────────────────────────────────────

  private build(): void {
    const s = this.session;
    this.el.classList.add('yr', kind(this.kind));
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', s.tr(this.kind === 'chapter' ? 'reader' : 'passage'));
    applyChrome(this.el, s);
    this.el.innerHTML = this.kind === 'chapter' ? '<div class="yr-bar"></div>' : '';
    const tools = document.createElement('div');
    tools.className = 'yr-tools';
    this.el.appendChild(tools);
    this.statusEl = document.createElement('div');
    this.statusEl.className = 'yr-status';
    this.statusEl.setAttribute('role', 'status');
    this.el.appendChild(this.statusEl);
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'yr-body';
    this.bodyEl.id = `${this.uid}-body`;
    this.bodyEl.setAttribute('aria-live', 'polite');
    this.bodyEl.setAttribute('aria-label', s.tr('chapterText'));
    this.el.appendChild(this.bodyEl);
    this.footEl = document.createElement('div');
    this.footEl.className = 'yr-foot';
    this.el.appendChild(this.footEl);
    this.selbar = document.createElement('div');
    this.selbar.className = 'yr-selbar';
    this.selbar.setAttribute('role', 'region');
    this.selbar.hidden = true;
    this.el.appendChild(this.selbar);
    this.toastFn = mountToast(this.el);
    this.sheet = new Sheet(this.el, s, s.tr('edition'));
    this.renderTools();
  }

  private wire(): void {
    const s = this.session;
    this.el.addEventListener('click', (e) => this.onClick(e));
    // on the document: with focus on the page body the arrows still step chapters (the handler checks where the focus is)
    const key = (e: KeyboardEvent) => this.onKey(e);
    document.addEventListener('keydown', key);
    this.off.push(() => document.removeEventListener('keydown', key));
    this.el.addEventListener('copy', (e) => this.onNativeCopy(e as ClipboardEvent));
    this.off.push(s.onChange((k) => { void this.onSessionChange(k); }));
    this.off.push(s.onToast((m, kd) => this.toastFn(m, kd)));
    if (this.kind === 'chapter' && this.opts.route === 'hash') {
      const pop = (e: PopStateEvent) => { void this.fromHash(e.state?.yrScroll as number | undefined); };
      addEventListener('popstate', pop);
      addEventListener('hashchange', () => { /* popstate covers history moves; a typed hash fires both */ });
      this.off.push(() => removeEventListener('popstate', pop));
    }
    try {
      this.mq = matchMedia('(prefers-color-scheme: dark)');
      const f = () => { if (s.prefs.theme === 'auto') applyChrome(this.el, s); };
      this.mq.addEventListener('change', f);
      this.off.push(() => this.mq?.removeEventListener('change', f));
    } catch { /* no matchMedia */ }
  }

  destroy(): void {
    this.off.forEach((f) => f());
    this.off = [];
    this.seq++;
    this.el.innerHTML = '';
    this.el.classList.remove('yr', kind(this.kind));
  }

  current(): Ref { return { ...this.ref }; }

  // ── showing ─────────────────────────────────────────────────────────

  /** Chapter reader: start from the location hash if it names a passage. */
  async start(): Promise<void> {
    if (this.kind === 'chapter' && this.opts.route === 'hash') {
      const r = parseHash(location.hash);
      if (r.lang || r.ed || r.par || r.mode) { this.session.applyLink(r); applyChrome(this.el, this.session); this.renderTools(); }
      if (r.ref) this.ref = r.ref;
      await this.show(this.ref, { history: 'replace' });
    } else {
      await this.show(this.ref, { history: 'none' });
    }
  }

  async goto(target: Ref | PassageSpec): Promise<void> {
    if (this.kind === 'passage') {
      this.spec = target as PassageSpec;
      this.ref = { book: this.spec.book, chapter: this.spec.from.chapter, v1: this.spec.from.verse };
      this.expanded = false;
      this.selected.clear();
      this.syncSelection();
      await this.show(this.ref, { history: 'none' });
    } else {
      await this.show(target as Ref, { history: this.opts.route === 'hash' ? 'push' : 'none' });
    }
  }

  async refresh(): Promise<void> {
    applyChrome(this.el, this.session);
    this.renderTools();
    await this.show(this.ref, { history: 'none', keepAnchor: true });
  }

  private segments(): Segment[] {
    if (this.kind === 'passage' && this.spec) {
      const { from, to } = this.spec;
      const out: Segment[] = [];
      for (let c = from.chapter; c <= to.chapter; c++) {
        out.push({ chapter: c, v1: c === from.chapter ? from.verse : undefined, v2: c === to.chapter ? to.verse : undefined });
      }
      return out;
    }
    return [{ chapter: this.ref.chapter }];
  }

  private async load(): Promise<{ data: Data; failed: string[] }> {
    const s = this.session;
    const editions = s.set();
    const book = this.ref.book;
    const main = editions[0]!;
    const settled = await Promise.allSettled([
      ...editions.map((e) => s.store.text(e.id, book)),
      s.store.headings(headingSetFor(main.id), book),
      s.store.para(book),
    ]);
    const n = editions.length;
    const texts: (BookText | null)[] = editions.map((_e, i) => { const r = settled[i]!; return r.status === 'fulfilled' ? (r.value as BookText) : null; });
    const hs = settled[n]!, ps = settled[n + 1]!;
    const failed = editions.filter((_e, i) => texts[i] === null).map((e) => e.label);
    if (texts[0] === null) {
      const err = (settled[0] as PromiseRejectedResult).reason;
      throw err instanceof LoadError ? err : new LoadError('http', String(err));
    }
    // a failed extra edition is dropped from the screen (the main edition still reads); the notice says which
    const keep = editions.map((_e, i) => texts[i] !== null);
    return {
      failed,
      data: {
        editions: editions.filter((_e, i) => keep[i]),
        texts: texts.filter((_t, i) => keep[i]),
        headings: hs.status === 'fulfilled' ? (hs.value as BookHeadings) : null,
        para: ps.status === 'fulfilled' ? (ps.value as BookPara) : null,
      },
    };
  }

  private peekAll(): boolean {
    const s = this.session;
    const book = this.ref.book;
    return s.set().every((e) => s.store.peekText(e.id, book)) && !!s.store.peekHeadings(headingSetFor(s.main().id), book) && !!s.store.peekPara(book);
  }

  private async show(ref: Ref, o: { history: 'push' | 'replace' | 'none'; keepAnchor?: boolean; scroll?: number }): Promise<void> {
    const s = this.session;
    const my = ++this.seq;
    const prevBook = this.ref.book, prevChapter = this.ref.chapter;
    this.ref = this.kind === 'passage' ? this.ref : ref;
    if (this.kind === 'chapter' && (prevBook !== ref.book || prevChapter !== ref.chapter)) { this.selected.clear(); this.syncSelection(); this.openContext.clear(); }
    const anchor = o.keepAnchor ? this.captureAnchor() : null;
    this.highlight = new Set();
    if (this.kind === 'chapter' && ref.v1 != null) for (let v = ref.v1; v <= (ref.v2 ?? ref.v1); v++) this.highlight.add(vkey(ref.chapter, v));

    let skeleton: ReturnType<typeof setTimeout> | undefined;
    if (!this.peekAll()) {
      this.bodyEl.setAttribute('aria-busy', 'true');
      skeleton = setTimeout(() => { if (my === this.seq) this.bodyEl.innerHTML = this.skeletonHtml(); }, 150);
    }
    try {
      const { data, failed } = await this.load();
      clearTimeout(skeleton);
      if (my !== this.seq) return;
      this.data = data;
      this.notice = failed.length ? `${s.tr('loadFailed')} (${failed.join(', ')})` : null;
      this.bodyEl.removeAttribute('aria-busy');
      this.renderAll();
      this.updateHistory(o.history, o.scroll);
      this.setDocTitle();
      await afterLayout();
      if (my !== this.seq) return;
      if (anchor) this.restoreAnchor(anchor);
      else if (this.kind === 'chapter') this.scrollToTarget(o.scroll);
      s.remember(this.ref.book, this.ref.chapter);
      this.opts.onNavigate?.(this.current());
      this.prefetch();
    } catch (e) {
      clearTimeout(skeleton);
      if (my !== this.seq) return;
      this.bodyEl.removeAttribute('aria-busy');
      this.data = null;
      const offline = e instanceof LoadError && (e.kind === 'offline' || e.kind === 'timeout');
      const msg = offline ? s.tr('offlineChapter') : s.tr('loadFailed');
      this.bodyEl.innerHTML = `<div class="yr-state" role="alert"><p>${escapeHtml(msg)}</p><button type="button" class="yr-btn" data-act="retry">${escapeHtml(s.tr('retry'))}</button></div>`;
      this.footEl.innerHTML = '';
      this.renderTools();
      this.updateHistory(o.history, o.scroll);
      this.setDocTitle();
    }
  }

  private skeletonHtml(): string {
    return `<div class="yr-skel" aria-hidden="true">${'<i></i>'.repeat(9)}</div><p class="yr-sr" role="status">${escapeHtml(this.session.tr('loading'))}</p>`;
  }

  private prefetch(): void {
    if (this.kind !== 'chapter') return;
    const s = this.session;
    const idle = (f: () => void) => ('requestIdleCallback' in window ? (window as unknown as { requestIdleCallback(f: () => void): void }).requestIdleCallback(f) : setTimeout(f, 300));
    idle(() => {
      for (const d of [1, -1] as const) {
        const n = stepChapter(this.ref.book, this.ref.chapter, d);
        if (n && n.book !== this.ref.book) for (const e of s.set()) void s.store.text(e.id, n.book).catch(() => {});
      }
    });
  }

  // ── rendering ───────────────────────────────────────────────────────

  private bodyModel() {
    const d = this.data!;
    const s = this.session;
    return {
      uid: this.uid, ui: s.ui, mode: s.mode() as Mode, book: this.ref.book, segments: this.segments(),
      editions: d.editions, texts: d.texts, headings: d.headings, para: d.para, selected: this.selected, highlight: this.highlight,
      // the picture page already shows its own plate above the verses, so a passage never repeats it
      plates: this.kind === 'chapter' ? this.opts.platesFor?.(this.ref.book) ?? [] : [],
      limit: this.kind === 'passage' ? this.spec?.limit ?? 12 : undefined, expanded: this.expanded, openContext: this.openContext, strings: s.opts.strings,
    };
  }

  private renderAll(): void {
    const s = this.session;
    const d = this.data!;
    const t0 = performance.now();
    const out = renderBody(this.bodyModel());
    this.lastShown = { shown: out.shown, total: out.total, keys: out.keys };
    const lang = labelLanguage(s.ui, d.editions[0]!.id);
    const title = this.kind === 'chapter'
      ? `<h2 class="yr-title" lang="${lang}" tabindex="-1">${escapeHtml(referenceLabel({ book: this.ref.book, chapter: this.ref.chapter }, s.ui, d.editions[0]!.id))}</h2>`
      : '';
    this.bodyEl.innerHTML = title + out.html;
    const more = this.kind === 'passage' && out.total > out.shown
      ? `<button type="button" class="yr-btn yr-btn-quiet yr-more" data-act="expand">${escapeHtml(s.tr('showMore', { n: out.total - out.shown }))}</button>`
      : this.kind === 'passage' && this.expanded && out.total > (this.spec?.limit ?? 12)
        ? `<button type="button" class="yr-btn yr-btn-quiet yr-more" data-act="collapse">${escapeHtml(s.tr('showLess'))}</button>` : '';
    this.footEl.innerHTML = more + renderCredit(d.editions, s.ui, s.opts.strings) + this.wordsLinkHtml();
    this.statusEl.textContent = this.notice ?? '';
    this.statusEl.classList.toggle('is-on', !!this.notice);
    this.renderTools();
    this.syncSelection();
    // measured by the robustness script
    (window as unknown as Record<string, unknown>).__yrPerf = { renderMs: performance.now() - t0, verses: out.shown, plates: out.plates, uid: this.uid };
  }

  /** Re-render a container's innerHTML without losing the keyboard's place. */
  private keepFocus(container: HTMLElement, fill: () => void): void {
    const f = document.activeElement as HTMLElement | null;
    const key = f && container.contains(f) ? { act: f.dataset.act, id: f.dataset.id } : null;
    fill();
    if (key?.act) {
      const my = this.seq;
      void afterLayout().then(() => {
        if (my !== this.seq || !container.isConnected) return;
        if (document.activeElement !== f && document.activeElement !== document.body) return;
        container.querySelector<HTMLElement>(`[data-act="${key.act}"]${key.id != null ? `[data-id="${key.id}"]` : ''}`)?.focus({ preventScroll: true });
      });
    }
  }

  private renderTools(): void {
    const s = this.session;
    const tools = this.el.querySelector('.yr-tools') as HTMLElement;
    const set = s.set();
    const parallel = s.mode() === 'parallel' && set.length > 1;
    const edLabel = parallel ? s.tr('parallelN', { n: set.length }) : set[0]!.label;
    const pill = `<button type="button" class="yr-pill${parallel ? ' is-gold' : ''}" data-act="edition" aria-haspopup="dialog" lang="${parallel ? s.ui : set[0]!.language}"><span>${escapeHtml(edLabel)}</span><span aria-hidden="true" class="yr-caret">\u25be</span></button>`;
    if (this.kind === 'chapter') {
      const lang = labelLanguage(s.ui, set[0]!.id);
      const bar = this.el.querySelector('.yr-bar') as HTMLElement;
      const prev = stepChapter(this.ref.book, this.ref.chapter, -1), next = stepChapter(this.ref.book, this.ref.chapter, 1);
      const rtl = s.dir === 'rtl';
      this.keepFocus(bar, () => {
        bar.innerHTML =
          `<button type="button" class="yr-ib" data-act="prev" aria-label="${escapeHtml(s.tr('prevChapter'))}"${prev ? '' : ' disabled'}><span aria-hidden="true">${rtl ? '\u203a' : '\u2039'}</span></button>` +
          `<button type="button" class="yr-pick" data-act="pick" aria-haspopup="dialog" aria-label="${escapeHtml(s.tr('pickChapter'))}" lang="${lang}"><span>${escapeHtml(referenceLabel({ book: this.ref.book, chapter: this.ref.chapter }, s.ui, set[0]!.id))}</span><span aria-hidden="true" class="yr-caret">\u25be</span></button>` +
          pill +
          `<button type="button" class="yr-ib" data-act="next" aria-label="${escapeHtml(s.tr('nextChapter'))}"${next ? '' : ' disabled'}><span aria-hidden="true">${rtl ? '\u2039' : '\u203a'}</span></button>`;
      });
      const modes: [Mode, 'modeVerse' | 'modeParagraph' | 'modeParallel'][] = [['verse', 'modeVerse'], ['paragraph', 'modeParagraph'], ['parallel', 'modeParallel']];
      this.keepFocus(tools, () => {
        tools.innerHTML = `<div class="yr-seg" role="group" aria-label="${escapeHtml(s.tr('layout'))}">${modes.map(([m, k]) => `<button type="button" aria-pressed="${s.mode() === m}" data-act="mode" data-id="${m}">${escapeHtml(s.tr(k))}</button>`).join('')}</div>` +
          `<button type="button" class="yr-ib yr-aa" data-act="display" aria-haspopup="dialog" aria-label="${escapeHtml(s.tr('display'))}"><span aria-hidden="true">Aa</span></button>`;
      });
    } else {
      const sp = this.spec;
      const whole = sp ? `<button type="button" class="yr-pill" data-act="whole">${escapeHtml(s.tr('wholeChapter'))} <span aria-hidden="true">${s.dir === 'rtl' ? '\u2039' : '\u203a'}</span></button>` : '';
      this.keepFocus(tools, () => {
        tools.innerHTML = pill +
          `<button type="button" class="yr-pill" data-act="parallelToggle" aria-pressed="${s.mode() === 'parallel'}">${escapeHtml(s.tr('modeParallel'))}</button>` +
          `<button type="button" class="yr-pill" data-act="copyAll">${escapeHtml(s.tr('copy'))}</button>` + whole;
      });
    }
  }

  /**
   * "Continue in Yahweh's Words", once per chapter, under the credit.
   *
   * Only in the chapter reader: a passage under a picture already carries "read the whole chapter", and two exits
   * stacked under eight verses is noise. `rel="noopener"` and `target="_blank"` on the web; inside a shell the
   * click is intercepted (see `wire`) and handed to the system browser, because a Bible app opening inside the
   * app's own window with no way back is worse than no link.
   */
  private wordsLinkHtml(): string {
    if (this.kind !== 'chapter' || !this.data) return '';
    const s = this.session;
    const href = wordsChapterUrl({ book: this.ref.book, chapter: this.ref.chapter, edition: this.data.editions[0]!.id });
    if (!href) return '';
    return `<p class="yr-words"><a class="yr-words-a" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" data-yr-external>` +
      `${escapeHtml(s.tr('continueInWords'))} <span aria-hidden="true">${s.dir === 'rtl' ? '‹' : '›'}</span></a></p>`;
  }

  // ── selection ───────────────────────────────────────────────────────

  private syncSelection(): void {
    const s = this.session;
    this.bodyEl.querySelectorAll<HTMLElement>('[data-k].yr-v, [data-k].yr-pv').forEach((el) => {
      const k = Number(el.dataset.k);
      const on = this.selected.has(k);
      el.classList.toggle('is-sel', on);
      el.querySelector('.yr-vn')?.setAttribute('aria-pressed', String(on));
    });
    this.el.classList.toggle('has-sel', this.selected.size > 0);
    if (!this.selected.size || !this.data) { this.selbar.hidden = true; this.selbar.innerHTML = ''; return; }
    const keys = [...this.selected].sort((a, b) => a - b);
    const main = this.data.editions[0]!;
    const label = passageLabel(this.ref.book, keys, labelLanguage(s.ui, main.id));
    // "Open picture" only when the FIRST selected verse is the one a scene starts at: the plate is rendered at that
    // verse, so the link is the one already on the page and there is nothing to guess.
    const plate = this.plateAt(keys[0]!);
    this.selbar.setAttribute('aria-label', s.tr('selectionBar'));
    this.selbar.hidden = false;
    this.selbar.innerHTML = `<span class="yr-sel-n">${escapeHtml(s.tr('selectedN', { n: keys.length, ref: label }))}</span>` +
      `<button type="button" class="yr-btn yr-btn-primary" data-act="copySel">${escapeHtml(s.tr('copy'))}</button>` +
      `<button type="button" class="yr-btn" data-act="shareSel">${escapeHtml(s.tr('share'))}</button>` +
      `<button type="button" class="yr-btn" data-act="linkSel">${escapeHtml(s.tr('copyLink'))}</button>` +
      (plate ? `<button type="button" class="yr-btn" data-act="openPic">${escapeHtml(s.tr('openPicture'))}</button>` : '') +
      `<button type="button" class="yr-btn yr-btn-quiet" data-act="clearSel">${escapeHtml(s.tr('clear'))}</button>`;
  }

  /** The scene plate drawn at a verse key, if this chapter has one there. */
  private plateAt(k: number): { href: string; id: string } | null {
    const el = this.bodyEl.querySelector<HTMLElement>(`.yr-plate[data-v="${keyChapter(k)}:${keyVerse(k)}"] .yr-plate-a`);
    const id = el?.closest<HTMLElement>('.yr-plate')?.dataset.scene;
    return el && id ? { href: (el as HTMLAnchorElement).getAttribute('href') ?? '', id } : null;
  }

  /**
   * A tap on a verse.
   *
   * First tap selects it. A tap on another verse while something is selected EXTENDS the run from the anchor to
   * it — the same gesture Words uses, and the one a reader expects when they are picking out a passage rather than
   * a scatter of verses. Shift-click does the same on a keyboard. A tap on a verse that is already selected takes
   * it out again, so nothing is a trap.
   */
  private toggleKey(k: number, range: boolean): void {
    const keys = this.lastShown.keys;
    const extend = (range || (this.selected.size > 0 && !this.selected.has(k))) && this.anchorKey != null;
    if (extend) {
      const a = keys.indexOf(this.anchorKey!), b = keys.indexOf(k);
      if (a >= 0 && b >= 0) { for (const x of keys.slice(Math.min(a, b), Math.max(a, b) + 1)) this.selected.add(x); this.syncSelection(); return; }
    }
    if (this.selected.has(k)) this.selected.delete(k); else this.selected.add(k);
    this.anchorKey = k;
    this.syncSelection();
  }

  // ── copy ────────────────────────────────────────────────────────────

  private copyInput(keys: number[]) {
    const d = this.data!;
    const s = this.session;
    const common = { book: this.ref.book, verses: keys, ui: s.ui, origin: this.opts.origin, linkFor: this.opts.linkFor };
    if (s.mode() === 'parallel' && d.editions.length > 1) {
      return buildParallelCopy({ ...common, editions: d.editions, cell: (v, e, c) => d.texts[e]?.[c - 1]?.[v - 1] ?? null });
    }
    return buildCopy({ ...common, edition: d.editions[0]!, text: (v, c) => d.texts[0]?.[c - 1]?.[v - 1] ?? null });
  }

  private async copyKeys(keys: number[]): Promise<void> {
    const s = this.session;
    if (!this.data || !keys.length) return;
    const r = this.copyInput(keys);
    if (!r) { s.toast(s.tr('nothingToCopy'), 'warn'); return; }
    const outcome = await copyText(r.text);
    this.opts.onCopy?.({ text: r.text, count: r.count, cut: r.cut, outcome });
    if (outcome === 'failed') s.toast(s.tr('copyFailed'), 'warn');
    else if (r.cut) s.toast(s.tr('copiedLimited', { n: r.count }), 'warn');
    else s.toast(s.tr('copied'));
  }

  private async copyLink(keys: number[]): Promise<void> {
    const s = this.session;
    if (!this.data || !keys.length) return;
    const r = this.copyInput(keys);
    if (!r) return;
    const link = r.text.split('\n').pop()!.replace(/^.*?· /, '');
    const outcome = await copyText(link);
    s.toast(outcome === 'failed' ? s.tr('copyFailed') : s.tr('linkCopied'), outcome === 'failed' ? 'warn' : 'ok');
  }

  private async shareKeys(keys: number[]): Promise<void> {
    const s = this.session;
    if (!this.data || !keys.length) return;
    const r = this.copyInput(keys);
    if (!r) { s.toast(s.tr('nothingToCopy'), 'warn'); return; }
    const link = r.text.split('\n').pop()!.replace(/^.*?· /, '');
    const main = this.data.editions[0]!;
    const title = passageLabel(this.ref.book, [...this.selected].sort((a, b) => a - b), labelLanguage(s.ui, main.id));
    // The text already ends with "— <site> · <link>", so the url is not repeated into it.
    const out = this.opts.share
      ? await this.opts.share({ title, text: r.text, url: link }).catch(() => 'failed' as const)
      : await shareOrCopy({ title, text: r.text, url: link });
    if (out === 'shared') s.toast(s.tr('shared'));
    else if (out === 'copied') s.toast(s.tr('copied'));
    else if (out === 'failed') s.toast(s.tr('copyFailed'), 'warn');
    // 'cancelled': the reader closed the sheet; say nothing.
  }

  /**
   * The system copy (Cmd/Ctrl+C, the iOS callout menu's Copy, Android's floating Copy).
   *
   * Whatever the reader selected, what lands on the clipboard is passage shape: the reference in the edition's
   * language, the verses, the edition's credit line and a link back — [buildCopy], with the same 100-verse cap the
   * Copy button applies. A drag that covers two or more whole verses is served that way; a drag inside one verse
   * keeps the exact words the reader picked (they may have wanted half a sentence) and still carries the reference
   * and the credit. Either way the verse-number gutter, the parallel edition tags, the footnote markers and the
   * screen-reader-only spans are left out ([selectionText]).
   */
  private onNativeCopy(e: ClipboardEvent): void {
    if (!this.data || !e.clipboardData) return;
    const sel = getSelection();
    const native = sel && sel.rangeCount > 0 && !sel.isCollapsed && this.bodyEl.contains(sel.anchorNode);
    if (this.selected.size && !native) {
      const r = this.copyInput([...this.selected].sort((a, b) => a - b));
      if (r) { e.clipboardData.setData('text/plain', r.text); e.preventDefault(); this.session.toast(r.cut ? this.session.tr('copiedLimited', { n: r.count }) : this.session.tr('copied'), r.cut ? 'warn' : 'ok'); }
      return;
    }
    if (!native || !sel) return;
    const keys: number[] = [];
    this.bodyEl.querySelectorAll<HTMLElement>('[data-k].yr-v, [data-k].yr-pv').forEach((el) => { if (sel.containsNode(el, true)) keys.push(Number(el.dataset.k)); });
    if (!keys.length) return;
    if (keys.length > 1) {
      const r = this.copyInput(keys);
      if (r) { e.clipboardData.setData('text/plain', r.text); e.preventDefault(); }
      return;
    }
    const main = this.data.editions[0]!;
    const text = selectionText(sel.getRangeAt(0), this.el.ownerDocument);
    if (!text) return;
    e.clipboardData.setData('text/plain', `${text}\n\n${heading(this.ref.book, undefined, keys, main)}\n${creditLine(main)}`);
    e.preventDefault();
  }

  // ── events ──────────────────────────────────────────────────────────

  private async onSessionChange(k: string): Promise<void> {
    applyChrome(this.el, this.session);
    // the sheet shows the new state at once; the page behind catches up when its data is in
    if (this.sheet.isOpen) this.refreshSheet();
    if (k === 'size' || k === 'theme') return;
    this.renderTools();
    await this.show(this.ref, { history: this.kind === 'chapter' && this.opts.route === 'hash' ? 'replace' : 'none', keepAnchor: true });
  }

  private sheetKind: 'edition' | 'parallel' | 'book' | 'display' | null = null;
  private sheetFrom: HTMLElement | null = null;
  private refreshSheet(): void {
    if (this.sheetKind) this.openSheet(this.sheetKind, false);
  }

  private openSheet(kind: 'edition' | 'parallel' | 'book' | 'display', focus = true, from?: HTMLElement | null): void {
    const s = this.session;
    this.sheetKind = kind;
    if (from) this.sheetFrom = from;
    const act = (el: HTMLElement) => this.onSheetAction(kind, el);
    const label = { edition: s.tr('chooseEdition'), parallel: s.tr('compareEditions'), book: s.tr('pickChapter'), display: s.tr('display') }[kind];
    const render = () => kind === 'edition' ? editionSheetHtml(s) : kind === 'parallel' ? parallelSheetHtml(s) : kind === 'book' ? bookSheetHtml(s, this.bookState) : displaySheetHtml(s);
    if (!focus && this.sheet.isOpen) { this.sheet.dialog.lang = s.ui; this.sheet.dialog.dir = s.dir; this.sheet['render'] = render; this.sheet['onClick'] = act; this.sheet.refresh(); return; }
    this.sheet.open(label, render, act, this.sheetFrom);
  }

  private onSheetAction(kind: string, el: HTMLElement): void {
    const s = this.session;
    const id = el.dataset.id ?? '';
    switch (el.dataset.act) {
      case 'close': this.sheet.close(); break;
      case 'edition': s.setEdition(id); this.sheet.close(); this.announceEdition(); break;
      case 'compare': s.setMode('parallel'); this.openSheet('parallel'); break;
      case 'toggle': {
        if (el.getAttribute('aria-disabled') === 'true') { s.toast(s.tr('maxThree'), 'warn'); break; }
        const next = toggleEdition(s.set().map((e) => e.id), id);
        s.setParallel(next);
        if (next.length < 2) s.setMode('verse');
        else s.setMode('parallel');
        break;
      }
      case 'up': case 'down': s.setParallel(moveEdition(s.set().map((e) => e.id), id, el.dataset.act === 'up' ? -1 : 1)); break;
      case 'size': s.setSize(Number(id)); break;
      case 'theme': s.setTheme(id as never); break;
      case 'testament': this.bookState = { ...this.bookState, testament: id as 'ot' | 'nt' }; this.sheet.refresh(); break;
      case 'book': this.bookState = { ...this.bookState, step: 'chapters', book: Number(id) }; this.sheet.refresh(); break;
      case 'back': this.bookState = { ...this.bookState, step: 'books' }; this.sheet.refresh(); break;
      case 'chapter': this.sheet.close(); void this.goto({ book: this.bookState.book, chapter: Number(id) }); break;
      case 'recent': { const [b, c] = id.split(':').map(Number); this.sheet.close(); void this.goto({ book: b!, chapter: c! }); break; }
    }
    void kind;
  }

  private announceEdition(): void {
    const s = this.session;
    s.toast(s.tr('editionSwitched', { name: s.main().menu }));
  }

  private onClick(e: MouseEvent): void {
    const s = this.session;
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t || !this.el.contains(t) || this.sheet.dialog.contains(t)) { this.onBodyClick(e); return; }
    if (t.classList.contains('yr-vn')) { this.toggleKey(Number(t.dataset.k), e.shiftKey); return; }
    if (t.classList.contains('yr-fn')) {
      const open = t.getAttribute('aria-expanded') !== 'true';
      t.setAttribute('aria-expanded', String(open));
      const note = document.getElementById(t.getAttribute('aria-controls') ?? '');
      if (note) note.hidden = !open;
      return;
    }
    if (t.classList.contains('yr-hi')) {
      const open = t.getAttribute('aria-expanded') !== 'true';
      t.setAttribute('aria-expanded', String(open));
      const ctx = document.getElementById(t.getAttribute('aria-controls') ?? '');
      if (ctx) ctx.hidden = !open;
      const hv = (t.closest('.yr-hd') as HTMLElement | null)?.dataset.hv;
      if (hv) { if (open) this.openContext.add(hv); else this.openContext.delete(hv); }
      return;
    }
    switch (t.dataset.act) {
      case 'prev': case 'next': this.step(t.dataset.act === 'next' ? 1 : -1); break;
      case 'pick': this.bookState = { step: 'books', testament: this.ref.book >= 40 ? 'nt' : 'ot', book: this.ref.book }; this.openSheet('book', true, t); break;
      case 'mode': s.setMode(t.dataset.id as Mode); break;
      case 'edition': this.openSheet(s.mode() === 'parallel' ? 'parallel' : 'edition', true, t); break;
      case 'display': this.openSheet('display', true, t); break;
      case 'retry': s.store.forget(); void this.show(this.ref, { history: 'none' }); break;
      case 'expand': this.expanded = true; void this.rerenderKeepingAnchor(); break;
      case 'collapse': this.expanded = false; void this.rerenderKeepingAnchor(); break;
      case 'parallelToggle': s.setMode(s.mode() === 'parallel' ? 'verse' : 'parallel'); break;
      case 'copyAll': void this.copyKeys(this.selected.size ? [...this.selected] : this.lastShown.keys); break;
      case 'copySel': void this.copyKeys([...this.selected]); break;
      case 'shareSel': void this.shareKeys([...this.selected].sort((a, b) => a - b)); break;
      case 'linkSel': void this.copyLink([...this.selected]); break;
      case 'openPic': {
        const p = this.plateAt([...this.selected].sort((a, b) => a - b)[0]!);
        if (p?.href) location.assign(p.href);
        break;
      }
      case 'clearSel': this.selected.clear(); this.syncSelection(); break;
      case 'whole': this.opts.onOpenChapter?.({ book: this.ref.book, chapter: this.spec?.from.chapter ?? this.ref.chapter }); break;
    }
  }

  /**
   * A click in the reading text that was not on a control: the verse under it is selected.
   *
   * Text selection comes first and always wins. A drag that leaves words highlighted, or a click inside a
   * selection the reader has just made with the system handles, does nothing here — otherwise choosing a phrase to
   * copy would also light up the whole verse and change what Cmd+C sends. A click on the plate (a link) or on any
   * control is left to that element.
   */
  private onBodyClick(e: MouseEvent): void {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (!target || !this.bodyEl.contains(target)) return;
    if (target.closest('a, button, input, textarea, select, [contenteditable]')) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed) return;
    const v = target.closest<HTMLElement>('[data-k].yr-v, [data-k].yr-pv');
    if (!v?.dataset.k) return;
    this.toggleKey(Number(v.dataset.k), e.shiftKey);
  }

  private async rerenderKeepingAnchor(): Promise<void> {
    if (!this.data) return;
    const a = this.captureAnchor();
    const my = this.seq;
    this.renderAll();
    await afterLayout();
    if (my !== this.seq) return;
    if (a) this.restoreAnchor(a);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.sheet.isOpen || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    if (el !== document.body && !this.el.contains(el)) return;
    if (e.key === 'Escape' && this.selected.size) { this.selected.clear(); this.syncSelection(); e.stopPropagation(); return; }
    if (this.kind !== 'chapter') return;
    const inControl = el.closest('button, input, select, textarea, [role="radio"], [role="checkbox"]');
    if (inControl) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); this.step(this.session.dir === 'rtl' ? -1 : 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(this.session.dir === 'rtl' ? 1 : -1); }
  }

  private step(d: 1 | -1): void {
    const n = stepChapter(this.ref.book, this.ref.chapter, d);
    if (n) void this.goto({ book: n.book, chapter: n.chapter }).then(() => { window.scrollTo?.({ top: 0 }); this.bodyEl.querySelector<HTMLElement>('.yr-title')?.focus({ preventScroll: true }); });
  }

  // ── scroll anchors and history ──────────────────────────────────────

  private scroller(): { top(): number; by(dy: number): void } {
    const sc = this.opts.scroller;
    if (sc) return { top: () => sc.getBoundingClientRect().top, by: (dy) => { sc.scrollTop += dy; } };
    return { top: () => 0, by: (dy) => { window.scrollBy({ top: dy, behavior: 'instant' as ScrollBehavior }); } };
  }

  /** The first verse on screen and how far from the top it is: after a re-render it goes back to the same place. */
  private captureAnchor(): { k: number; top: number } | null {
    const sc = this.scroller();
    const bar = (this.el.querySelector('.yr-bar') as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
    const line = sc.top() + bar;
    for (const el of Array.from(this.bodyEl.querySelectorAll<HTMLElement>('[data-k]'))) {
      if (!el.classList.contains('yr-v') && !el.classList.contains('yr-pv')) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > line + 4) return { k: Number(el.dataset.k), top: r.top };
    }
    return null;
  }

  private restoreAnchor(a: { k: number; top: number }): void {
    const el = this.bodyEl.querySelector<HTMLElement>(`[data-k="${a.k}"]`);
    if (!el) return;
    this.scroller().by(el.getBoundingClientRect().top - a.top);
  }

  private scrollToTarget(restore?: number): void {
    if (restore != null) { window.scrollTo?.({ top: restore, behavior: 'instant' as ScrollBehavior }); return; }
    const first = this.highlight.size ? Math.min(...this.highlight) : null;
    const el = first != null ? this.bodyEl.querySelector<HTMLElement>(`[data-k="${first}"]`) : null;
    if (el) { el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }); return; }
    if (this.opts.route === 'hash') window.scrollTo?.({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  private hashState() {
    const s = this.session;
    const def = editionById(s.single().id)!;
    const set = s.set();
    return {
      ref: this.ref,
      ed: s.mode() === 'parallel' ? undefined : (s.prefs.edition[s.ui] ? def.id : undefined),
      par: s.mode() === 'parallel' ? set.map((e) => e.id) : undefined,
      mode: s.mode(),
    };
  }

  private updateHistory(how: 'push' | 'replace' | 'none', scroll?: number): void {
    if (this.kind !== 'chapter' || this.opts.route !== 'hash' || how === 'none') return;
    const h = formatHash(this.hashState()) || '#';
    if (location.hash === h || (h === '#' && !location.hash)) { history.replaceState({ ...(history.state ?? {}), yrScroll: scroll }, '', location.href); }
    else if (how === 'push') {
      // remember where the page being left was scrolled to, so Back lands on it
      history.replaceState({ ...(history.state ?? {}), yrScroll: window.scrollY }, '', location.href);
      history.pushState({ yr: 1 }, '', h);
    } else history.replaceState({ ...(history.state ?? {}), yr: 1 }, '', h);
  }

  /** The tab's name follows the chapter on screen, whatever moved it there.
   *
   *  This used to live at the end of updateHistory(), which fromHash() calls with history: 'none' — so Back onto
   *  Isaiah 40 rendered Isaiah 40 under the title "以赛亚书 41", and a pasted #ref= link on an open page rendered the
   *  right chapter under the wrong name. History entries, bookmarks and anything that unfurls a title all read it.
   *  It is set from the one place that knows what is actually rendered. */
  private setDocTitle(): void {
    if (this.kind !== 'chapter' || this.opts.route !== 'hash') return;
    const main = this.session.main();
    try { document.title = `${referenceLabel({ book: this.ref.book, chapter: this.ref.chapter }, this.session.ui, main.id)} · ${main.label}`; } catch { /* no document */ }
  }

  private async fromHash(scroll?: number): Promise<void> {
    const r = parseHash(location.hash);
    if (r.lang || r.ed || r.par || r.mode) { this.session.applyLink(r); applyChrome(this.el, this.session); this.renderTools(); }
    await this.show(r.ref ?? { book: 1, chapter: 1 }, { history: 'none', scroll });
  }
}

const kind = (k: 'chapter' | 'passage'): string => (k === 'chapter' ? 'yr-chapter' : 'yr-passage');

