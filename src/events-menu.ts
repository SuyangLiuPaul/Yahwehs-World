// A way into the 1,443 that is not the track.
//
// The band track answers "where are the events" and "how sure is this date".
// It cannot answer "take me to the crossing of the Red Sea", because at 1232px
// the average band is under a pixel wide — drawing all of them and expecting a
// reader to hit one is the same mistake the verse slider made before the
// book/chapter/verse picker was added next to it (main.ts says so in its own
// words: "scrubbing 5,582 raw events by dragging a slider to find one specific
// verse is not really navigation").
//
// So: a book chooser and a search box, in the same shape as that picker. Only
// one book's events are in the DOM at a time — a median book has 12, the
// largest 150 — and a search shows the best matches with the total said out
// loud, so the reader is never silently looking at a truncated list.
import { bookName } from './books.ts';
import { locale as currentLocale, hant, onLocale, t } from './locale.ts';
import type { EventsTrack, TrackEvent } from './events-track.ts';

const MAX_RESULTS = 80;

export function installEventsMenu(track: EventsTrack, open: (ev: TrackEvent) => void) {
  const openBtn = document.getElementById('t-events-open') as HTMLButtonElement;
  const panel = document.getElementById('t-events-menu') as HTMLElement;
  const search = document.getElementById('t-events-search') as HTMLInputElement;
  const bookSel = document.getElementById('t-events-book') as HTMLSelectElement;
  const closeBtn = document.getElementById('t-events-menu-close') as HTMLButtonElement;
  const countEl = document.getElementById('t-events-count') as HTMLElement;
  const list = document.getElementById('t-events-list') as HTMLElement;
  if (!openBtn || !panel || !list) return;

  const all = track.all;
  const byBook = new Map<number, TrackEvent[]>();
  for (const ev of all) {
    let arr = byBook.get(ev.b);
    if (!arr) { arr = []; byBook.set(ev.b, arr); }
    arr.push(ev);
  }
  for (const arr of byBook.values()) arr.sort((a, b) => a.s - b.s);
  const books = [...byBook.keys()].sort((a, b) => a - b);

  openBtn.hidden = false;

  const label = (ev: TrackEvent) => (currentLocale() === 'zh' ? hant(ev.zh) : ev.en);
  const ref = (ev: TrackEvent) => (currentLocale() === 'zh' ? hant(ev.refZh) : ev.ref);

  // A row used to carry the event's year range and a date mark (disputed /
  // undated / dated from the spine). Both went when the year axis went — see
  // the note at the top of events-track.ts. The reference is what a reader
  // navigates by, and it is the one thing here that is attested rather than
  // derived.
  function render(items: TrackEvent[], total: number) {
    list.replaceChildren();
    for (const ev of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ev-row';
      row.dataset.id = ev.id;

      const name = document.createElement('b');
      name.textContent = label(ev);
      const meta = document.createElement('span');
      meta.textContent = ref(ev);
      row.append(name, meta);
      row.addEventListener('click', () => {
        open(ev);
        panel.hidden = true;
        openBtn.setAttribute('aria-expanded', 'false');
      });
      list.append(row);
    }
    countEl.textContent = items.length < total
      ? t(`${items.length} of ${total} shown — narrow the search`,
          `显示 ${items.length} / ${total} 条——再输入几个字`)
      : total === 0
        ? t('Nothing matches', '没有匹配的事件')
        : t(`${total} event${total === 1 ? '' : 's'}`, `${total} 条事件`);
    if (currentLocale() === 'zh') countEl.textContent = hant(countEl.textContent);
  }

  function refresh() {
    const q = search.value.trim().toLowerCase();
    if (q) {
      // Every token has to appear somewhere, rather than the whole query as
      // one substring. "Exod 14" found nothing while the reference read
      // "Exodus 14:1–14:31" — the reader typed the abbreviation everyone uses
      // and the list said there is no such event.
      const tokens = q.split(/\s+/).filter(Boolean);
      const hits = all.filter((ev) => {
        const hay = `${ev.en} ${ev.zh} ${hant(ev.zh)} ${ev.ref} ${ev.refZh}`.toLowerCase();
        return tokens.every((tk) => hay.includes(tk));
      });
      render(hits.slice(0, MAX_RESULTS), hits.length);
      return;
    }
    const arr = byBook.get(Number(bookSel.value)) ?? [];
    render(arr, arr.length);
  }

  function fillBooks() {
    const keep = bookSel.value;
    bookSel.replaceChildren();
    for (const b of books) {
      const opt = document.createElement('option');
      opt.value = String(b);
      opt.textContent = `${bookName(b, currentLocale())} (${byBook.get(b)!.length})`;
      bookSel.append(opt);
    }
    if (keep) bookSel.value = keep;
  }

  function relabel() {
    search.placeholder = t('Search 1,443 events', '搜索 1443 条事件');
    search.setAttribute('aria-label', search.placeholder);
    fillBooks();
    refresh();
  }

  openBtn.addEventListener('click', () => {
    const show = panel.hidden;
    panel.hidden = !show;
    openBtn.setAttribute('aria-expanded', String(show));
    if (show) {
      if (!bookSel.options.length) fillBooks();
      refresh();
      search.focus();
    }
  });
  closeBtn.addEventListener('click', () => {
    panel.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
  });
  bookSel.addEventListener('change', () => { search.value = ''; refresh(); });
  search.addEventListener('input', refresh);
  onLocale(relabel);

  relabel();
}
