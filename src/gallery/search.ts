// The search palette: one field for a reference ("创 12", "Gen 12:1"), a book, a title or the words of a summary.
// Opened from the bar's field, from ⌘K / Ctrl+K, and from the home page's "find a scene" field. Results are
// scenes; choosing one opens its picture page. Loaded on first use only (chrome.ts imports it dynamically).
import { hant, onLocale, t } from '../locale.ts';
import { bookTitle, loadIndex, loadSummaries, refText, sceneTitle, type GalleryIndex, type Scene, type Summaries } from './data.ts';
import { parseRef } from './refs.ts';
import { plate } from './media.ts';
import { openSheet } from './sheet.ts';

const MAX = 12;
const keyOf = (b: number, ch: number, v: number) => b * 1_000_000 + ch * 1000 + v;

/** Scenes that cover a chapter (or a verse) of a book; failing that, the first scene after it in that book. */
function byReference(ix: GalleryIndex, b: number, ch: number, v: number | null): Scene[] {
  const lo = keyOf(b, ch, v ?? 0), hi = keyOf(b, ch, v ?? 999);
  const inBook = ix.scenes.filter((sc) => sc.b === b);
  const hit = inBook.filter((sc) => sc.s <= hi && sc.e >= lo);
  if (hit.length) return hit;
  const after = inBook.find((sc) => sc.s > hi);
  return after ? [after] : inBook.slice(-1);
}

function byText(ix: GalleryIndex, q: string, sums: Summaries | null): Scene[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored: [number, Scene][] = [];
  for (const sc of ix.scenes) {
    const title = `${sc.zh} ${hant(sc.zh)} ${sc.en} ${sc.ru}`.toLowerCase();
    const book = `${bookTitle(sc.b, 'zh')} ${bookTitle(sc.b, 'en')} ${bookTitle(sc.b, 'ru')}`.toLowerCase();
    const body = sums ? `${sums.zh[sc.i] ?? ''} ${hant(sums.zh[sc.i] ?? '')} ${sums.en[sc.i] ?? ''} ${sums.ru?.[sc.i] ?? ''}`.toLowerCase() : '';
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      else if (book.includes(term)) score += 4;
      else if (body.includes(term)) score += 2;
      else { score = 0; break; }
    }
    if (score) scored.push([score, sc]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].i - b[1].i);
  return scored.slice(0, MAX).map((x) => x[1]);
}

let current: HTMLDialogElement | null = null;

export function openSearch(initial = '', from?: HTMLElement | null) {
  if (current?.open) { current.querySelector<HTMLInputElement>('input')?.focus(); return; }
  current = openSheet({
    title: t('Find a scene', '找一幕', 'Найти сцену'),
    className: 'gx-pal center',
    // P2-3: hand the focus back to the control that opened the palette. openSheet falls back to whatever had focus,
    // and on macOS a click on a <button> does not give it focus, so that fallback was BODY and closing the palette
    // dropped the reader at the top of the page. The caller names its trigger instead.
    returnFocus: from ?? undefined,
    render(body, close) {
      body.innerHTML = `<div class="gx-pal-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" role="combobox" aria-expanded="true" aria-controls="gx-pal-list" aria-autocomplete="list" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"></div>
        <ul class="gx-pal-list" id="gx-pal-list" role="listbox"></ul><p class="gx-pal-hint"></p>`;
      const input = body.querySelector('input')!;
      const list = body.querySelector<HTMLElement>('#gx-pal-list')!;
      const hint = body.querySelector<HTMLElement>('.gx-pal-hint')!;
      let ix: GalleryIndex | null = null;
      let sums: Summaries | null = null;
      let rows: Scene[] = [];
      let at = 0;

      const setHint = (s: string) => { hint.textContent = s; hint.hidden = !s; };
      const labels = () => {
        input.placeholder = t('Book, reference or caption, e.g. “Gen 12”, “Damascus”', '书卷、出处、画名，如「创 12」「大马色」', 'Книга, место или название, например «Быт 12», «Дамаск»');
        input.setAttribute('aria-label', t('Find a scene', '找一幕', 'Найти сцену'));
      };
      const paint = () => {
        list.replaceChildren(...rows.map((sc, n) => {
          const li = document.createElement('li');
          li.setAttribute('role', 'presentation');
          const a = document.createElement('a');
          a.className = 'gx-pal-row';
          a.id = `gx-pal-${n}`;
          a.href = `/scenes.html#p=${sc.id}`;
          a.setAttribute('role', 'option');
          a.setAttribute('aria-selected', String(n === at));
          a.append(plate(sc, { kind: 'thumb' }));
          const txt = document.createElement('span');
          txt.innerHTML = '<span class="t"></span><span class="r"></span>';
          txt.querySelector('.t')!.textContent = sceneTitle(sc);
          txt.querySelector('.r')!.textContent = refText(sc);
          a.append(txt);
          a.addEventListener('click', () => close());
          li.append(a);
          return li;
        }));
        input.setAttribute('aria-activedescendant', rows.length ? `gx-pal-${at}` : '');
      };
      const run = () => {
        if (!ix) return;
        const q = input.value.trim();
        at = 0;
        if (!q) { rows = []; paint(); setHint(t('Try 创 12, Gen 12:1, John 3, or a word from a title.', '试试「创 12」、Gen 12:1、John 3，或画名里的一个词。', 'Попробуйте «Быт 12», Gen 12:1, Ин 3 или слово из названия.')); return; }
        const ref = parseRef(q);
        rows = ref ? byReference(ix, ref.b, ref.ch, ref.v).slice(0, MAX) : [];
        if (!rows.length) rows = byText(ix, q, sums);
        paint();
        setHint(rows.length ? '' : t('No scene matches. Try a book name and chapter.', '没有找到这一幕。试试书卷名加章数。', 'Ничего не найдено. Попробуйте название книги и номер главы.'));
      };

      labels();
      setHint(t('Loading…', '正在载入…', 'Загрузка…'));
      void loadIndex().then((x) => { ix = x; input.value ||= initial; run(); }).catch(() => setHint(t('The scene list did not load. Close this and try again.', '画卷目录没有载入。关闭后重试。', 'Список сцен не загрузился. Закройте и попробуйте снова.')));
      // summaries are only needed for words inside a one-line summary: fetched on the first keystroke
      input.addEventListener('input', () => {
        run();
        if (!sums) void loadSummaries().then((s) => { sums = s; run(); }).catch(() => {});
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (!rows.length) return;
          e.preventDefault();
          at = (at + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
          list.querySelectorAll('[role=option]').forEach((el, n) => el.setAttribute('aria-selected', String(n === at)));
          input.setAttribute('aria-activedescendant', `gx-pal-${at}`);
          list.querySelector(`#gx-pal-${at}`)?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && rows[at]) {
          e.preventDefault();
          close();
          location.assign(`/scenes.html#p=${rows[at]!.id}`);
        }
      });
      onLocale(() => { if (current?.open) { labels(); run(); } });
      queueMicrotask(() => input.focus());
    },
    onClose() { current = null; },
  });
}
