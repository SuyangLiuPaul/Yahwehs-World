import './scenes-gallery.css';
import { BOOKS } from './books.ts';
import { UNITS } from './plan-units.ts';
import { applyStatic, bindSwitch, hant, locale as currentLocale, onLocale, t } from './locale.ts';
import { installSiteMenu, loadingStep, loadingSteps, pageReady } from './site-shell.ts';
import type { TrackEvent } from './events-track.ts';
import { eventRawThumbUrl, eventThumbUrl, openEventLightbox } from './event-media.ts';

loadingSteps(2);
loadingStep();
bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
installSiteMenu();
applyStatic();

interface EventsPayload {
  meta: { count: number };
  events: TrackEvent[];
}

const res = await fetch('/data/events.json');
const payload = (await res.json()) as EventsPayload;
const allEvents = payload.events;
loadingStep();

type ScopeFilter = 'all' | 'ot' | 'nt' | 'mapped';
let currentScope: ScopeFilter = 'all';
let currentUnit = '';
let currentBook = 0;
let searchQuery = '';
let rawOnlyMode = false;
let visibleLimit = 60;
const BATCH_SIZE = 60;

// Precompute unit ranges [from, to)
const unitRanges = new Map<string, [number, number]>();
UNITS.forEach((u, i) => {
  const next = UNITS[i + 1]?.from ?? Infinity;
  unitRanges.set(u.id, [u.from, next]);
});

// Precompute book counts
const bookCounts = new Map<number, number>();
for (const ev of allEvents) {
  bookCounts.set(ev.b, (bookCounts.get(ev.b) ?? 0) + 1);
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const searchInput = $<HTMLInputElement>('sg-search');
const unitSelect = $<HTMLSelectElement>('sg-unit');
const bookSelect = $<HTMLSelectElement>('sg-book');
const modeBtn = $<HTMLButtonElement>('sg-mode-btn');
const resetBtn = $<HTMLButtonElement>('sg-reset-btn');
const booksStrip = $('sg-books-strip');
const statsEl = $('sg-stats');
const gridEl = $('sg-grid');
const loadMoreBtn = $<HTMLButtonElement>('sg-load-more');
const showingCountEl = $('sg-showing-count');
const hintEl = $('sg-hint');

let currentFiltered: TrackEvent[] = [];

function getFilteredEvents(): TrackEvent[] {
  const q = searchQuery.trim().toLowerCase();
  const uRange = currentUnit ? unitRanges.get(currentUnit) : null;

  return allEvents.filter((ev) => {
    if (currentScope === 'ot' && ev.b > 39) return false;
    if (currentScope === 'nt' && ev.b < 40) return false;
    if (currentScope === 'mapped' && (!ev.p || ev.p.length === 0)) return false;
    if (uRange && !(ev.s >= uRange[0] && ev.s < uRange[1])) return false;
    if (currentBook > 0 && ev.b !== currentBook) return false;
    if (q) {
      const hay = `${ev.id} ${ev.zh} ${ hant(ev.zh)} ${ev.en} ${ev.ref} ${ev.refZh} ${hant(ev.refZh)} ${ev.sum} ${ev.sumEn ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderHeaderAndControls() {
  const zh = currentLocale() === 'zh';
  document.title = zh
    ? `${hant('圣经画卷 · 雅伟之界')} | Biblical Scenes · Yahweh's World`
    : `Biblical Scenes · Yahweh's World`;

  $('sg-kicker').textContent = zh
    ? hant('1,443 幅正典事件画卷 · 按创世记至启示录经文顺序排列')
    : '1,443 CANONICAL EVENT ILLUSTRATIONS · GENESIS TO REVELATION';

  $('sg-title').textContent = zh
    ? hant('圣经画卷全集')
    : 'Biblical Event Illustrations';

  $('sg-lede').textContent = zh
    ? hant('汇集整本圣经 66 卷书、56 个叙事单元的全部 1,443 幅事件画卷。现已全量呈现 1,443 / 1,443 幅中英双语去游戏 UI 正式版画卷，点击任意画卷可高清放大、一键切换纯画境原图，或跳转到 3D 地球仪定位事件发生地。')
    : 'Browse all 1,443 canonical event illustrations across all 66 books and 56 narrative units of the Bible. All 1,443 / 1,443 bilingual non-gamified plates are now complete—click any plate to inspect in high resolution, toggle the uncropped original artwork, or jump directly to its coordinates on the 3D Globe.';

  $('sg-quick-links').innerHTML = `
    <a class="sg-quick-link" href="/">${zh ? hant('🌍 打开 3D 圣经地球仪') : '🌍 Open 3D Globe'}</a>
    <a class="sg-quick-link" href="/plan.html">${zh ? hant('📜 按 56 个叙事单元导览') : '📜 56 Narrative Units'}</a>
    <a class="sg-quick-link" href="/figures.html">${zh ? hant('🧍 3D 人物与 394 立绘库') : '🧍 3D Figures & 394 Cutouts'}</a>
  `;

  const otCount = allEvents.filter((e) => e.b <= 39).length;
  const ntCount = allEvents.filter((e) => e.b >= 40).length;
  const mappedCount = allEvents.filter((e) => e.p && e.p.length > 0).length;

  const statItems: { id: ScopeFilter; num: number; label: string }[] = [
    { id: 'all', num: allEvents.length, label: t('All Biblical Events (66 Books)', '全部正典事件画卷（66 卷书）') },
    { id: 'ot', num: otCount, label: t('Hebrew Scriptures (Gen–Mal)', '希伯来圣经（创世记—玛拉基书）') },
    { id: 'nt', num: ntCount, label: t('Greek Scriptures (Matt–Rev)', '希腊圣经（马太福音—启示录）') },
    { id: 'mapped', num: mappedCount, label: t('Geolocated on 3D Globe', '已锚定地球仪坐标事件') },
  ];

  statsEl.innerHTML = statItems.map((st) => `
    <button type="button" class="sg-stat-btn${currentScope === st.id ? ' active' : ''}" data-scope="${st.id}">
      <b>${st.num.toLocaleString('en-US')}</b>
      <span>${st.label}</span>
    </button>
  `).join('');

  statsEl.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentScope = btn.dataset.scope as ScopeFilter;
      visibleLimit = BATCH_SIZE;
      renderHeaderAndControls();
      updateGrid();
    });
  });

  searchInput.placeholder = zh
    ? hant('搜索事件名称、经文引用（如：创世记 1、出埃及记 14、Luke 15）或摘要关键词…')
    : 'Search event title, scripture reference (e.g. Genesis 1, Exodus 14, Luke 15), or keywords…';

  // Populate 56 Narrative Units select
  const prevUnit = currentUnit;
  unitSelect.innerHTML = `<option value="">${t('All 56 Narrative Units', '全部 56 个圣经叙事单元')}</option>` +
    UNITS.map((u, idx) => {
      const r = unitRanges.get(u.id)!;
      const cnt = allEvents.filter((e) => e.s >= r[0] && e.s < r[1]).length;
      const name = zh ? hant(u.zh) : u.en;
      return `<option value="${u.id}">${idx + 1}. ${name} (${cnt})</option>`;
    }).join('');
  unitSelect.value = prevUnit;

  // Populate 66 Books select
  const prevBook = String(currentBook);
  bookSelect.innerHTML = `<option value="0">${t('All 66 Books of the Bible', '全部 66 卷圣经书卷')}</option>` +
    BOOKS.map((b, idx) => {
      const bNum = idx + 1;
      const cnt = bookCounts.get(bNum) ?? 0;
      const name = zh ? hant(b.zh) : b.en;
      return `<option value="${bNum}">${bNum}. ${name} (${cnt})</option>`;
    }).join('');
  bookSelect.value = prevBook;

  modeBtn.textContent = zh
    ? hant(rawOnlyMode ? '🎨 当前：纯画境原图 (点击切回双语版)' : '🖼️ 当前：双语正式版 (1,443 / 1,443 全集)')
    : (rawOnlyMode ? '🎨 Showing: Raw Artwork (Switch to Bilingual)' : '🖼️ Showing: Bilingual Edition (All 1,443 Plates)');

  resetBtn.textContent = zh ? hant('重置筛选') : 'Reset Filters';

  // Render 66 Books horizontal chip strip
  booksStrip.innerHTML = `<button type="button" class="sg-book-chip${currentBook === 0 ? ' active' : ''}" data-b="0">${t('All Books', '全部书卷')}<small>${allEvents.length}</small></button>` +
    BOOKS.map((b, idx) => {
      const bNum = idx + 1;
      if (currentScope === 'ot' && bNum > 39) return '';
      if (currentScope === 'nt' && bNum < 40) return '';
      const cnt = bookCounts.get(bNum) ?? 0;
      const name = zh ? hant(b.zh) : b.en;
      return `<button type="button" class="sg-book-chip${currentBook === bNum ? ' active' : ''}" data-b="${bNum}">${name}<small>${cnt}</small></button>`;
    }).join('');

  booksStrip.querySelectorAll<HTMLButtonElement>('[data-b]').forEach((chip) => {
    chip.addEventListener('click', () => {
      currentBook = Number(chip.dataset.b);
      bookSelect.value = String(currentBook);
      visibleLimit = BATCH_SIZE;
      renderHeaderAndControls();
      updateGrid();
    });
  });

  hintEl.textContent = zh
    ? hant('💡 提示：点击任意画卷可全屏高清放大、左右翻阅并直达 3D 地球仪')
    : '💡 Tip: Click any illustration to open full-screen zoom, flip with arrow keys, or locate on the 3D Globe';
}

function createCard(ev: TrackEvent, idxInFiltered: number, canonicalIdx: number): HTMLElement {
  const zh = currentLocale() === 'zh';
  const card = document.createElement('article');
  card.className = 'sg-card';
  card.id = `ev-${ev.id}`;

  const thumbSrc = rawOnlyMode ? eventRawThumbUrl(ev.id) : eventThumbUrl(ev);
  const rawThumb = eventRawThumbUrl(ev.id);
  const titlePrimary = zh ? hant(ev.zh) : ev.en;
  const titleSub = zh ? ev.en : hant(ev.zh);
  const refStr = zh ? hant(ev.refZh) : ev.ref;
  const sumStr = zh ? hant(ev.sum) : (ev.sumEn || hant(ev.sum));
  const verBadge = (ev.img ?? 'm') === 'm' && !rawOnlyMode
    ? (zh ? hant('双语画卷') : 'Bilingual')
    : (zh ? hant('纯画境') : 'Original');

  card.innerHTML = `
    <div class="sg-card-media">
      <img loading="lazy" decoding="async" alt="" />
      <span class="sg-card-badge">#${canonicalIdx}</span>
      <span class="sg-card-ver">${verBadge}</span>
    </div>
    <div class="sg-card-body">
      <div class="sg-card-ref">${refStr}</div>
      <h2 class="sg-card-title"></h2>
      <div class="sg-card-sub"></div>
      <p class="sg-card-sum"></p>
      <div class="sg-card-foot">
        <button type="button" class="sg-card-btn sg-open-lb">${zh ? hant('🔍 高清详览') : '🔍 Inspect'}</button>
        <a class="sg-card-btn" href="/bible.html#event=${encodeURIComponent(ev.id)}">${zh ? hant('📖 读经') : '📖 Read'}</a>
        <a class="sg-card-btn sg-card-globe" href="/#event=${encodeURIComponent(ev.id)}">${
          ev.p?.length
            ? (zh ? hant(`🌍 定位 (${ev.p.length})`) : `🌍 Globe (${ev.p.length})`)
            : (zh ? hant('🌍 时间轴') : '🌍 Timeline')
        }</a>
      </div>
    </div>
  `;

  const img = card.querySelector<HTMLImageElement>('img')!;
  img.alt = titlePrimary;
  img.onerror = () => {
    if (img.src !== rawThumb) img.src = rawThumb;
  };
  img.src = thumbSrc;

  card.querySelector<HTMLElement>('.sg-card-title')!.textContent = titlePrimary;
  card.querySelector<HTMLElement>('.sg-card-sub')!.textContent = titleSub;
  card.querySelector<HTMLElement>('.sg-card-sum')!.textContent = sumStr;

  const openLb = () => {
    openEventLightbox({
      events: currentFiltered,
      index: idxInFiltered,
      isScenesPage: true,
    });
  };
  card.querySelector('.sg-card-media')!.addEventListener('click', openLb);
  card.querySelector('.sg-card-title')!.addEventListener('click', openLb);
  card.querySelector('.sg-open-lb')!.addEventListener('click', openLb);

  return card;
}

const canonicalIndexMap = new Map<string, number>();
allEvents.forEach((e, i) => canonicalIndexMap.set(e.id, i + 1));

function updateGrid() {
  currentFiltered = getFilteredEvents();
  const zh = currentLocale() === 'zh';
  const hasFilters = currentScope !== 'all' || currentUnit !== '' || currentBook > 0 || searchQuery.trim() !== '';
  resetBtn.hidden = !hasFilters;

  const shown = currentFiltered.slice(0, visibleLimit);
  showingCountEl.textContent = zh
    ? hant(`当前显示 ${shown.length} / ${currentFiltered.length} 幅画卷（总计 ${allEvents.length} 幅）`)
    : `Showing ${shown.length} of ${currentFiltered.length} illustrations (${allEvents.length} total)`;

  gridEl.replaceChildren();
  const frag = document.createDocumentFragment();
  shown.forEach((ev, idx) => {
    frag.appendChild(createCard(ev, idx, canonicalIndexMap.get(ev.id) ?? idx + 1));
  });
  gridEl.appendChild(frag);

  loadMoreBtn.hidden = shown.length >= currentFiltered.length;
  if (!loadMoreBtn.hidden) {
    const rem = currentFiltered.length - shown.length;
    loadMoreBtn.textContent = zh
      ? hant(`继续加载更多画卷（剩余 ${rem} 幅）`)
      : `Load More Illustrations (${rem} remaining)`;
  }
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  visibleLimit = BATCH_SIZE;
  updateGrid();
});

unitSelect.addEventListener('change', () => {
  currentUnit = unitSelect.value;
  visibleLimit = BATCH_SIZE;
  updateGrid();
});

bookSelect.addEventListener('change', () => {
  currentBook = Number(bookSelect.value);
  visibleLimit = BATCH_SIZE;
  renderHeaderAndControls();
  updateGrid();
});

modeBtn.addEventListener('click', () => {
  rawOnlyMode = !rawOnlyMode;
  renderHeaderAndControls();
  updateGrid();
});

resetBtn.addEventListener('click', () => {
  currentScope = 'all';
  currentUnit = '';
  currentBook = 0;
  searchQuery = '';
  searchInput.value = '';
  visibleLimit = BATCH_SIZE;
  renderHeaderAndControls();
  updateGrid();
});

loadMoreBtn.addEventListener('click', () => {
  visibleLimit += BATCH_SIZE;
  updateGrid();
});

// Infinite scroll observer on loadMoreBtn
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !loadMoreBtn.hidden) {
      visibleLimit += BATCH_SIZE;
      updateGrid();
    }
  }, { rootMargin: '360px' });
  io.observe(loadMoreBtn);
}

function handleHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return;
  const params = new URLSearchParams(raw);
  const evId = params.get('event');
  const unitId = params.get('unit');
  const bookParam = params.get('book');

  if (unitId && unitRanges.has(unitId)) {
    currentUnit = unitId;
    visibleLimit = BATCH_SIZE;
    renderHeaderAndControls();
    updateGrid();
  } else if (bookParam) {
    const b = Number(bookParam);
    if (b >= 1 && b <= 66) {
      currentBook = b;
      visibleLimit = BATCH_SIZE;
      renderHeaderAndControls();
      updateGrid();
    }
  }

  if (evId) {
    const idx = allEvents.findIndex((e) => e.id === evId);
    if (idx >= 0) {
      openEventLightbox({
        events: allEvents,
        index: idx,
        isScenesPage: true,
      });
    }
  }
}

onLocale(() => {
  applyStatic();
  renderHeaderAndControls();
  updateGrid();
});

renderHeaderAndControls();
updateGrid();
pageReady();
handleHash();
window.addEventListener('hashchange', handleHash);
