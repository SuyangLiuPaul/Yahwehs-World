import './bible-book.css';
import { applyStatic, bindSwitch, fullLocale as rawLocale, hant, locale as currentLocale, onLocale, setLocale, t } from './locale.ts';
import { installSiteMenu, loadingStep, loadingSteps, pageReady } from './site-shell.ts';
import { BOOKS } from './books.ts';
import type { TrackEvent } from './events-track.ts';
import {
  eventFullUrl,
  eventRawFullUrl,
  openEventLightbox,
} from './event-media.ts';

interface BookIntro {
  subtitle: { en: string; hans: string; hant: string };
  summary: { en: string; hans: string; hant: string };
  author: { en: string; hans: string; hant: string };
  date: { en: string; hans: string; hant: string };
  audience: { en: string; hans: string; hant: string };
  themes: { en: string[]; hans: string[]; hant: string[] };
  keyPassage: string;
  keyPassageDesc: { en: string; hans: string; hant: string };
}

interface WordsSectionInfo {
  titleHans: string;
  titleHant: string;
  titleEn: string;
  contextHans: string;
  contextHant: string;
  contextEn: string;
}

interface BibleMeta {
  stats: {
    books: number;
    chapters: number;
    verses: number;
    illustrations: number;
    yhwhOccurrences: number;
    notesCount: number;
    referentMarkersTotal: number;
    referentYhwh: number;
    referentJesus: number;
    referentChrist: number;
    suppliedH0: number;
    suppliedG0: number;
  };
  intros: (BookIntro | null)[];
  paraStarts: number[];
  refVerses?: number[];
  wordsSections?: Record<string, WordsSectionInfo>;
}

interface BibleCorpus {
  books: string[][][];
}

export interface FootnoteItem {
  num: number;
  vLabel: string;
  text: string;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

// Default the Illustrated CUV-Yahweh Bible reader to Simplified Chinese
// unless the visitor explicitly saved a locale preference.
try {
  if (!localStorage.getItem('ydh.locale')) {
    await setLocale('zh-Hans');
  }
} catch {
  /* ignore storage errors */
}

loadingSteps(3);
bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
applyStatic();
installSiteMenu();

const [eventsRes, metaRes, placesRes] = await Promise.all([
  fetch('/data/events.json').then((r) => r.json() as Promise<{ events: TrackEvent[] }>),
  fetch('/data/bible/meta.json').then((r) => r.json() as Promise<BibleMeta>),
  fetch('/data/places.json').then((r) => r.json() as Promise<{ places: { id?: string; name: string; zh?: string }[] }>),
]);
const allEvents = eventsRes.events;
loadingStep();

const placeLabels = new Map<string, { en: string; zh: string }>();
placesRes.places.forEach((p, idx) => {
  const key = p.id ?? String(idx);
  placeLabels.set(key, { en: p.name, zh: p.zh ?? p.name });
  placeLabels.set(String(idx), { en: p.name, zh: p.zh ?? p.name });
});

const paraStartSet = new Set<number>(metaRes.paraStarts);
const refVerseSet = new Set<number>(metaRes.refVerses ?? []);
const wordsSections = metaRes.wordsSections ?? {};

let cuvsCorpus: BibleCorpus | null = null;
let cuvtCorpus: BibleCorpus | null = null;
let bsbCorpus: BibleCorpus | null = null;

async function ensureCorpora() {
  const loc = rawLocale();
  const tasks: Promise<void>[] = [];
  if (loc === 'zh-Hant') {
    if (!cuvtCorpus) {
      tasks.push(
        fetch('/data/bible/cuvt-yhwh.json')
          .then((r) => r.json())
          .then((d) => { cuvtCorpus = d; }),
      );
    }
  } else {
    if (!cuvsCorpus) {
      tasks.push(
        fetch('/data/bible/cuvs-yhwh.json')
          .then((r) => r.json())
          .then((d) => { cuvsCorpus = d; }),
      );
    }
  }
  if (loc === 'en' && !bsbCorpus) {
    tasks.push(
      fetch('/data/bible/bsb-yhwh.json')
        .then((r) => r.json())
        .then((d) => { bsbCorpus = d; }),
    );
  }
  if (tasks.length) await Promise.all(tasks);
}

await ensureCorpora();
loadingStep();

// Group the 1,443 events by book (1..66) and record global 1-based index
const eventsByBook = new Map<number, TrackEvent[]>();
const canonicalIndexMap = new Map<string, number>();
allEvents.forEach((ev: TrackEvent, idx: number) => {
  canonicalIndexMap.set(ev.id, idx + 1);
  const list = eventsByBook.get(ev.b) ?? [];
  list.push(ev);
  eventsByBook.set(ev.b, list);
});

// Reader State (Defaults to Genesis Chapter 1, chapter-by-chapter mode like Yahweh's Words)
let currentBook = 1; // 1..66
let currentChapter = 1; // 1..N
let fullBookMode = false; // false = single chapter (fast, clean), true = whole book

function getActiveZhBooks(): string[][][] {
  if (rawLocale() === 'zh-Hant' && cuvtCorpus) return cuvtCorpus.books;
  return (cuvsCorpus ?? cuvtCorpus)!.books;
}

function circledNumber(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21);
  if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b1 + n - 36);
  return String(n);
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a single verse with CUV-Yahweh / Yahweh's Words markers:
 * - Plain 雅伟 is NOT highlighted (natural body text).
 * - 主[雅伟], 主[耶稣], 主[基督], H0/G0, and ① ② all share ONE unified warm-gold color.
 */
function renderVerseMarkup(
  rawText: string,
  notesOut: FootnoteItem[],
  vLabel: string,
  paraNotesOut?: FootnoteItem[],
): string {
  const isHant = rawLocale() === 'zh-Hant';
  const notePlaceholders: string[] = [];

  let working = rawText.replace(/(?:<note:[^>]+>)+/g, (runMatch: string) => {
    const singleRegex = /<note:([^>]+)>/g;
    let m: RegExpExecArray | null;
    let firstNum = 0;
    let firstLocalNum = 0;
    let lastLocalNum = 0;
    const tips: string[] = [];
    while ((m = singleRegex.exec(runMatch)) !== null) {
      const clean = (m[1] ?? '').trim();
      const globalNum = notesOut.length + 1;
      const item: FootnoteItem = { num: globalNum, vLabel, text: clean };
      notesOut.push(item);
      if (paraNotesOut) {
        paraNotesOut.push(item);
        const localNum = paraNotesOut.length;
        if (!firstLocalNum) firstLocalNum = localNum;
        lastLocalNum = localNum;
      }
      if (!firstNum) firstNum = globalNum;
      tips.push(`${circledNumber(paraNotesOut ? lastLocalNum : globalNum)} ${clean}`);
    }
    const badgeText =
      lastLocalNum > firstLocalNum
        ? `${circledNumber(firstLocalNum)}\u2060\u207b\u2060${circledNumber(lastLocalNum)}`
        : circledNumber(firstLocalNum || 1);
    const idx = notePlaceholders.length;
    const tip = escapeHtml(tips.join(' | '));
    notePlaceholders.push(
      `<span class="bb-fn-ref" title="${tip}">${badgeText}</span>`,
    );
    return `\x01FN_${idx}\x02`;
  });

  working = working
    .replace(/<H0>/g, '\x01H0\x02')
    .replace(/<G0>/g, '\x01G0\x02');
  working = escapeHtml(working);

  // Unified single-color highlight for 主[雅伟], 主[耶稣], 主[基督]
  working = working.replace(
    /(主宰|主|我|他)\s*\[(雅伟|雅偉|耶稣|耶穌|基督)\]/g,
    (_, host: string, target: string) => {
      const tipHans = `按上下文意，此处“${host}”所指的是${target}。`;
      const tip = escapeHtml(isHant ? hant(tipHans) : tipHans);
      return `<span class="bb-mark" title="${tip}">${host}[${target}]</span>`;
    },
  );

  working = working.replace(
    /\b(Lord’s|Lord's|Lord|Master|Sir)\s+\[(Yahweh|Jesus|Christ)\]/g,
    (_, host: string, target: string) => {
      const tip = `By context, "${host}" here refers to ${target}.`;
      return `<span class="bb-mark" title="${tip}">${host} [${target}]</span>`;
    },
  );

  // Plain 雅伟 is NOT highlighted per user requirement

  working = working.replace(/\x01(H0|G0)\x02/g, (_, code: string) => {
    const tip =
      code === 'H0'
        ? t('H0: Supplied in translation for clarity', 'H0：原文此处无独立对应词，系中文译本按上下文补出。')
        : t('G0: Supplied in translation for clarity', 'G0：原文此处无独立对应词，系中文译本按上下文补出。');
    return `<sup class="bb-hg0-tag" title="${escapeHtml(tip)}">${code}</sup>`;
  });

  working = working.replace(/〔([^〕]+)〕/g, '<span class="bb-apparatus">〔$1〕</span>');
  working = working.replace(/\x01FN_(\d+)\x02/g, (_, idxStr: string) => {
    return notePlaceholders[Number(idxStr)] ?? '';
  });

  return working;
}

/**
 * Renders the per-paragraph indented left-accented two-column VerseNotesBlock
 * directly beneath a paragraph in the same unified warm-gold color.
 */
function renderVerseNotesBlock(
  notes: FootnoteItem[],
  showVerseRef: boolean,
): string {
  if (!notes.length) return '';
  const rowsHtml = notes
    .map((fn, idx) => {
      const badge = circledNumber(idx + 1);
      const refTag = showVerseRef ? `<span class="bb-vnb-vref">(${escapeHtml(fn.vLabel)})</span> ` : '';
      return `
        <tr class="bb-vnb-row">
          <td class="bb-vnb-num">${badge}</td>
          <td class="bb-vnb-text">${refTag}${escapeHtml(fn.text)}</td>
        </tr>
      `;
    })
    .join('');

  return `<div class="bb-verse-notes-block"><table class="bb-vnb-table"><tbody>${rowsHtml}</tbody></table></div>`;
}

function renderReaderBar() {
  const zh = currentLocale() === 'zh';
  const bMeta = BOOKS[currentBook - 1]!;
  const bookChs = getActiveZhBooks()[currentBook - 1] ?? [];
  const totalCh = bookChs.length;

  document.title = zh
    ? `${hant(bMeta.zh)} 第 ${currentChapter} 章 · ${hant('画卷圣经')}`
    : `${bMeta.en} ${currentChapter} · Illustrated Bible`;

  $('bb-open-toc').textContent = zh
    ? hant('📖 书卷目录 · 搜经文')
    : '📖 Books & Search';

  const bookSelect = $('bb-book-select') as HTMLSelectElement;
  const hebrewOpts = BOOKS.slice(0, 39)
    .map((b, idx) => {
      const bNum = idx + 1;
      const name = zh ? hant(b.zh) : b.en;
      return `<option value="${bNum}">${bNum}. ${name}</option>`;
    })
    .join('');
  const greekOpts = BOOKS.slice(39, 66)
    .map((b, idx) => {
      const bNum = idx + 40;
      const name = zh ? hant(b.zh) : b.en;
      return `<option value="${bNum}">${bNum}. ${name}</option>`;
    })
    .join('');
  bookSelect.innerHTML = `
    <optgroup label="${zh ? hant('希伯来圣经（39 卷）') : 'Hebrew Scriptures (39 Books)'}">${hebrewOpts}</optgroup>
    <optgroup label="${zh ? hant('希腊圣经（27 卷）') : 'Greek Scriptures (27 Books)'}">${greekOpts}</optgroup>
  `;
  bookSelect.value = String(currentBook);

  const chSelect = $('bb-chapter-select') as HTMLSelectElement;
  chSelect.innerHTML = bookChs
    .map(
      (_, idx) =>
        `<option value="${idx + 1}">${zh ? hant(`第 ${idx + 1} 章`) : `Ch ${idx + 1}`}</option>`,
    )
    .join('');
  chSelect.value = String(currentChapter);

  const prevBtn = $('bb-prev-ch') as HTMLButtonElement;
  const nextBtn = $('bb-next-ch') as HTMLButtonElement;
  prevBtn.disabled = currentBook === 1 && currentChapter === 1;
  nextBtn.disabled = currentBook === 66 && currentChapter >= totalCh;

  $('bb-pdf-btn').textContent = zh ? hant('📥 下载 PDF') : '📥 PDF';
}

async function renderReadingStream() {
  const zh = currentLocale() === 'zh';
  const isHant = rawLocale() === 'zh-Hant';
  await ensureCorpora();

  const bMeta = BOOKS[currentBook - 1]!;
  const bookEvs = eventsByBook.get(currentBook) ?? [];
  const zhChs = getActiveZhBooks()[currentBook - 1] ?? [];
  const enChs = bsbCorpus?.books[currentBook - 1] ?? [];
  const intro = metaRes.intros[currentBook - 1];

  // 1. Book Intro (Shown on Chapter 1 or in Full Book Mode)
  const coverEl = $('bb-book-cover');
  if (intro && (currentChapter === 1 || fullBookMode)) {
    const introSub = isHant ? intro.subtitle.hant : zh ? intro.subtitle.hans : intro.subtitle.en;
    const introSum = isHant ? intro.summary.hant : zh ? intro.summary.hans : intro.summary.en;
    const introAuthor = isHant ? intro.author.hant : zh ? intro.author.hans : intro.author.en;
    const introDate = isHant ? intro.date.hant : zh ? intro.date.hans : intro.date.en;
    const introAudience = isHant ? intro.audience.hant : zh ? intro.audience.hans : intro.audience.en;
    const introThemes = (isHant ? intro.themes.hant : zh ? intro.themes.hans : intro.themes.en).join(' · ');
    const introKeyDesc = isHant
      ? intro.keyPassageDesc.hant
      : zh
        ? intro.keyPassageDesc.hans
        : intro.keyPassageDesc.en;
    const kpLocalized = zh
      ? intro.keyPassage.replace(/^[123]?\s*[A-Za-z\s]+\s+/, `${hant(bMeta.zh)} `)
      : intro.keyPassage;

    coverEl.innerHTML = `
      <details class="bb-intro-box">
        <summary>
          <span>📘 ${zh ? hant(`《${bMeta.zh}》书卷导读：${introSub}`) : `${bMeta.en} Introduction: ${introSub}`}</span>
          <span style="font-size:12px;opacity:0.8">${zh ? hant('点击展开 ▾') : 'Expand ▾'}</span>
        </summary>
        <p class="bb-intro-summary">${escapeHtml(introSum)}</p>
        <div class="bb-intro-grid">
          <div class="bb-intro-item"><b>${t('Author', '作者')}</b><span>${escapeHtml(introAuthor)}</span></div>
          <div class="bb-intro-item"><b>${t('Date', '写作年代')}</b><span>${escapeHtml(introDate)}</span></div>
          <div class="bb-intro-item"><b>${t('Audience', '原初读者')}</b><span>${escapeHtml(introAudience)}</span></div>
          <div class="bb-intro-item"><b>${t('Themes', '核心主题')}</b><span>${escapeHtml(introThemes)}</span></div>
        </div>
        ${
          intro.keyPassage
            ? `<p class="bb-intro-summary" style="margin:8px 0 0;padding-top:8px;border-top:1px dashed rgba(232,197,90,0.22)">
                <strong style="color:var(--gold,#e8c55a)">${t('Key Passage', '核心经文')} (${escapeHtml(kpLocalized)}):</strong> ${escapeHtml(introKeyDesc)}
              </p>`
            : ''
        }
      </details>
    `;
  } else {
    coverEl.innerHTML = '';
  }

  // 2. Filter sections for the active chapter (or all sections if fullBookMode)
  const targetSections = fullBookMode
    ? bookEvs
    : bookEvs.filter((ev) => {
        const cStart = Math.floor(ev.s / 1000) % 1000;
        const cEnd = Math.floor(ev.e / 1000) % 1000;
        return cStart <= currentChapter && cEnd >= currentChapter;
      });

  const sectionsListEl = $('bb-sections-list');
  sectionsListEl.replaceChildren();
  const frag = document.createDocumentFragment();
  const seenChapters = new Set<number>();

  targetSections.forEach((ev) => {
    const bookSecIdx = bookEvs.indexOf(ev);
    const globalIdx = canonicalIndexMap.get(ev.id) ?? bookSecIdx + 1;

    const evCStart = Math.floor(ev.s / 1000) % 1000;
    const evVStart = ev.s % 1000;
    const evCEnd = Math.floor(ev.e / 1000) % 1000;
    const evVEnd = ev.e % 1000;

    const cStart = fullBookMode ? evCStart : Math.max(evCStart, currentChapter);
    const cEnd = fullBookMode ? evCEnd : Math.min(evCEnd, currentChapter);

    // Place Chapter Banner OUTSIDE and BEFORE the section card
    if (!seenChapters.has(cStart)) {
      seenChapters.add(cStart);
      const chBanner = document.createElement('div');
      chBanner.className = 'bb-chapter-banner';
      chBanner.id = `ch-${cStart}`;
      chBanner.innerHTML = `
        <span class="bb-chapter-num">${zh ? hant(`${bMeta.zh} 第 ${cStart} 章`) : `${bMeta.en} Chapter ${cStart}`}</span>
        <span class="bb-chapter-sub">${zh ? hant(`共 ${(zhChs[cStart - 1] ?? []).length} 节`) : `${(zhChs[cStart - 1] ?? []).length} verses`}</span>
      `;
      frag.appendChild(chBanner);
    }

    const ws = wordsSections[String(ev.s)];
    const titlePrimary = zh
      ? isHant
        ? ws?.titleHant || hant(ev.zh)
        : ws?.titleHans || ev.zh
      : ws?.titleEn || ev.en;
    const refLabel = zh ? hant(ev.refZh) : ev.ref;

    const ctxPrimary = zh
      ? isHant
        ? (ws?.contextHant || '').trim()
        : (ws?.contextHans || '').trim()
      : (ws?.contextEn || '').trim();
    const evSumText = (zh ? hant(ev.sum) : ev.sumEn || hant(ev.sum)).trim();
    let explainText = ctxPrimary || evSumText;
    if (
      ctxPrimary &&
      evSumText &&
      ctxPrimary !== evSumText &&
      !evSumText.includes(ctxPrimary) &&
      !ctxPrimary.includes(evSumText)
    ) {
      explainText = `${ctxPrimary} ${evSumText}`;
    } else if (evSumText.length > ctxPrimary.length) {
      explainText = evSumText;
    }

    // Build flowing paragraphs + VerseNotesBlock
    const sectionNotes: FootnoteItem[] = [];
    const blocks: string[] = [];
    let currentParaVerses: string[] = [];
    let currentParaNotes: FootnoteItem[] = [];
    let currentParaIsRef = false;

    const flushPara = () => {
      if (currentParaVerses.length > 0) {
        const notesBlockHtml = renderVerseNotesBlock(
          currentParaNotes,
          currentParaVerses.length > 1,
        );
        const paraCls = currentParaIsRef ? 'bb-para bb-para-ref' : 'bb-para';
        blocks.push(
          `<div class="bb-para-group"><p class="${paraCls}">${currentParaVerses.join(' ')}</p>${notesBlockHtml}</div>`,
        );
        currentParaVerses = [];
        currentParaNotes = [];
        currentParaIsRef = false;
      }
    };

    for (let c = cStart; c <= cEnd; c++) {
      const chVersesZh = zhChs[c - 1] ?? [];
      const chVersesEn = enChs[c - 1] ?? [];
      const activeChVerses = currentLocale() === 'en' && enChs.length ? chVersesEn : chVersesZh;
      const vMin = c === evCStart ? evVStart : 1;
      const vMax = c === evCEnd ? evVEnd : activeChVerses.length;

      if (!seenChapters.has(c)) {
        flushPara();
        seenChapters.add(c);
        blocks.push(`
          <div class="bb-chapter-banner" id="ch-${c}">
            <span class="bb-chapter-num">${zh ? hant(`${bMeta.zh} 第 ${c} 章`) : `${bMeta.en} Chapter ${c}`}</span>
          </div>
        `);
      }

      for (let v = vMin; v <= vMax; v++) {
        const vid = currentBook * 1_000_000 + c * 1000 + v;
        if (paraStartSet.has(vid) && currentParaVerses.length > 0) {
          flushPara();
        }
        if (currentParaVerses.length === 0) {
          currentParaIsRef = refVerseSet.has(vid);
        }
        const rawV = activeChVerses[v - 1] ?? '';
        const vLabel = evCStart === evCEnd ? `${v}` : `${c}:${v}`;
        const vHtml = renderVerseMarkup(rawV, sectionNotes, `${c}:${v}`, currentParaNotes);
        currentParaVerses.push(
          `<span class="bb-verse" id="v-${vid}"><span class="bb-vnum">${vLabel}</span>${vHtml}</span>`,
        );
      }
    }
    flushPara();

    const secEl = document.createElement('section');
    secEl.className = 'bb-section';
    secEl.id = `sec-${ev.id}`;

    const imgUrl = eventFullUrl(ev);
    const fallbackUrl = eventRawFullUrl(ev.id);

    secEl.innerHTML = `
      <div class="bb-sec-head">
        <h3 class="bb-sec-title">${escapeHtml(titlePrimary)}</h3>
        <div class="bb-sec-meta">
          <span class="bb-sec-ref">${escapeHtml(refLabel)} · ${zh ? hant(`画卷 #${globalIdx}`) : `Plate #${globalIdx}`}</span>
          <a class="bb-globe-chip" href="/#event=${encodeURIComponent(ev.id)}">🌍 ${zh ? hant('地球仪定位') : '3D Globe'}</a>
        </div>
      </div>
      ${explainText ? `<p class="bb-sec-explain">${escapeHtml(explainText)}</p>` : ''}
      <div class="bb-plate-frame" data-open-lb="${bookSecIdx}">
        <img loading="lazy" decoding="async" alt="${escapeHtml(titlePrimary)}" />
        <span class="bb-plate-zoom-hint">🔍 ${zh ? hant('点击全屏放大画卷') : 'Click to zoom'}</span>
      </div>
      <div class="bb-scripture-prose">
        ${blocks.join('')}
      </div>
    `;

    const imgEl = secEl.querySelector<HTMLImageElement>('.bb-plate-frame img')!;
    imgEl.onerror = () => {
      if (imgEl.src !== fallbackUrl) imgEl.src = fallbackUrl;
    };
    imgEl.src = imgUrl;

    secEl.querySelector('.bb-plate-frame')?.addEventListener('click', () => {
      openEventLightbox({
        events: bookEvs,
        index: bookSecIdx >= 0 ? bookSecIdx : 0,
      });
    });

    frag.appendChild(secEl);
  });

  sectionsListEl.appendChild(frag);
  renderBottomPager();
}

function renderBottomPager() {
  const zh = currentLocale() === 'zh';
  const pagerEl = $('bb-book-pager');
  const bookChs = getActiveZhBooks()[currentBook - 1] ?? [];
  const totalCh = bookChs.length;

  let prevLabel = '';
  if (currentChapter > 1) {
    const bMeta = BOOKS[currentBook - 1]!;
    prevLabel = zh
      ? hant(`‹ 上一章：${bMeta.zh} 第 ${currentChapter - 1} 章`)
      : `‹ Prev: ${bMeta.en} ${currentChapter - 1}`;
  } else if (currentBook > 1) {
    const prevBook = BOOKS[currentBook - 2]!;
    const prevBookChs = getActiveZhBooks()[currentBook - 2]?.length ?? 1;
    prevLabel = zh
      ? hant(`‹ 上一章：${prevBook.zh} 第 ${prevBookChs} 章`)
      : `‹ Prev: ${prevBook.en} ${prevBookChs}`;
  }

  let nextLabel = '';
  if (currentChapter < totalCh) {
    const bMeta = BOOKS[currentBook - 1]!;
    nextLabel = zh
      ? hant(`下一章：${bMeta.zh} 第 ${currentChapter + 1} 章 ›`)
      : `Next: ${bMeta.en} ${currentChapter + 1} ›`;
  } else if (currentBook < 66) {
    const nextBook = BOOKS[currentBook]!;
    nextLabel = zh
      ? hant(`下一卷：${nextBook.zh} 第 1 章 ›`)
      : `Next: ${nextBook.en} 1 ›`;
  }

  pagerEl.innerHTML = `
    <button type="button" class="bb-pager-btn" id="bb-pager-prev" ${!prevLabel ? 'disabled' : ''}>
      ${prevLabel || (zh ? hant('已是全书第一章') : 'First Chapter')}
    </button>
    <button type="button" class="bb-pager-btn" id="bb-pager-top">
      ↑ ${zh ? hant('回到顶部') : 'Back to Top'}
    </button>
    <button type="button" class="bb-pager-btn" id="bb-pager-next" ${!nextLabel ? 'disabled' : ''}>
      ${nextLabel || (zh ? hant('已是全书最后一章') : 'Last Chapter')}
    </button>
  `;

  $('bb-pager-prev')?.addEventListener('click', stepPrevChapter);
  $('bb-pager-next')?.addEventListener('click', stepNextChapter);
  $('bb-pager-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function stepPrevChapter() {
  if (currentChapter > 1) {
    navigateTo(currentBook, currentChapter - 1, true);
  } else if (currentBook > 1) {
    const prevChCount = getActiveZhBooks()[currentBook - 2]?.length ?? 1;
    navigateTo(currentBook - 1, prevChCount, true);
  }
}

function stepNextChapter() {
  const totalCh = getActiveZhBooks()[currentBook - 1]?.length ?? 1;
  if (currentChapter < totalCh) {
    navigateTo(currentBook, currentChapter + 1, true);
  } else if (currentBook < 66) {
    navigateTo(currentBook + 1, 1, true);
  }
}

async function navigateTo(bookNum: number, chapterNum: number, updateUrl: boolean, targetVerseId?: number) {
  currentBook = Math.max(1, Math.min(66, bookNum));
  const maxCh = getActiveZhBooks()[currentBook - 1]?.length ?? 1;
  currentChapter = Math.max(1, Math.min(maxCh, chapterNum));

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('book', String(currentBook));
    url.searchParams.set('ch', String(currentChapter));
    window.history.replaceState({}, '', url.toString());
  }

  renderReaderBar();
  await renderReadingStream();

  if (targetVerseId) {
    const vEl = document.getElementById(`v-${targetVerseId}`);
    if (vEl) {
      vEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

// ── Book & Chapter Grid Picker + Full-Text Search Dialog (Words Style) ──
function openTocDialog(focusSearch = false) {
  const dlg = $('bb-toc-dialog') as HTMLDialogElement;
  const zh = currentLocale() === 'zh';
  $('bb-toc-title').textContent = zh
    ? hant('选择书卷与章次 · 搜索全书经文')
    : 'Select Book & Chapter · Search Scripture';
  const searchInput = $('bb-global-search') as HTMLInputElement;
  searchInput.placeholder = zh
    ? hant('输入关键词搜索全书 31,102 节经文（如：挪亚、方舟、主[雅伟]、犹太人的优势）…')
    : 'Search all 31,102 verses...';

  renderTocBody(searchInput.value.trim());
  if (!dlg.open) dlg.showModal();
  if (focusSearch) searchInput.focus();
}

function renderTocBody(query: string) {
  const zh = currentLocale() === 'zh';
  const bodyEl = $('bb-toc-body');

  if (query.length >= 1) {
    const qLower = query.toLowerCase();
    const zhBooks = getActiveZhBooks();
    const hits: { b: number; c: number; v: number; vid: number; raw: string }[] = [];

    for (let bIdx = 0; bIdx < zhBooks.length && hits.length < 80; bIdx++) {
      const chs = zhBooks[bIdx] ?? [];
      for (let cIdx = 0; cIdx < chs.length && hits.length < 80; cIdx++) {
        const vs = chs[cIdx] ?? [];
        for (let vIdx = 0; vIdx < vs.length && hits.length < 80; vIdx++) {
          const raw = vs[vIdx] ?? '';
          if (raw.toLowerCase().includes(qLower)) {
            const b = bIdx + 1;
            const c = cIdx + 1;
            const v = vIdx + 1;
            hits.push({ b, c, v, vid: b * 1_000_000 + c * 1000 + v, raw });
          }
        }
      }
    }

    if (!hits.length) {
      bodyEl.innerHTML = `<p style="padding:18px;color:var(--ink-2)">${zh ? hant('未找到匹配的经文。') : 'No matching verses found.'}</p>`;
      return;
    }

    bodyEl.innerHTML = hits
      .map((h) => {
        const bMeta = BOOKS[h.b - 1]!;
        const ref = zh ? `${hant(bMeta.zh)} ${h.c}:${h.v}` : `${bMeta.en} ${h.c}:${h.v}`;
        const html = renderVerseMarkup(h.raw, [], `${h.c}:${h.v}`);
        return `
          <button type="button" class="bb-search-hit" data-hit-b="${h.b}" data-hit-c="${h.c}" data-hit-vid="${h.vid}">
            <div class="bb-search-hit-ref">${escapeHtml(ref)}</div>
            <div class="bb-search-hit-text">${html}</div>
          </button>
        `;
      })
      .join('');

    bodyEl.querySelectorAll<HTMLButtonElement>('[data-hit-b]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const b = Number(btn.dataset.hitB);
        const c = Number(btn.dataset.hitC);
        const vid = Number(btn.dataset.hitVid);
        ($('bb-toc-dialog') as HTMLDialogElement).close();
        navigateTo(b, c, true, vid);
      });
    });
    return;
  }

  const curBookMeta = BOOKS[currentBook - 1]!;
  const curBookChs = getActiveZhBooks()[currentBook - 1] ?? [];

  const chCellsHtml = curBookChs
    .map(
      (_, idx) =>
        `<button type="button" class="bb-ch-cell${idx + 1 === currentChapter ? ' active' : ''}" data-pick-ch="${idx + 1}">${idx + 1}</button>`,
    )
    .join('');

  const renderBookGrid = (startB: number, endB: number) =>
    BOOKS.slice(startB - 1, endB)
      .map((b, idx) => {
        const bNum = startB + idx;
        const chCnt = getActiveZhBooks()[bNum - 1]?.length ?? 0;
        const label = zh ? hant(b.zh) : b.en;
        return `
          <button type="button" class="bb-toc-card${bNum === currentBook ? ' active' : ''}" data-pick-b="${bNum}">
            <span>${label}</span>
            <small>${chCnt}${zh ? '章' : 'ch'}</small>
          </button>
        `;
      })
      .join('');

  bodyEl.innerHTML = `
    <div class="bb-testament-title">${
      zh
        ? hant(`当前书卷：《${curBookMeta.zh}》 — 点击章次直达（共 ${curBookChs.length} 章）`)
        : `Current Book: ${curBookMeta.en} — Select Chapter (${curBookChs.length})`
    }</div>
    <div class="bb-ch-grid">${chCellsHtml}</div>
    <div class="bb-testament-title">${zh ? hant('希伯来圣经（39 卷）') : 'Hebrew Scriptures (39 Books)'}</div>
    <div class="bb-toc-grid">${renderBookGrid(1, 39)}</div>
    <div class="bb-testament-title" style="margin-top:16px">${zh ? hant('希腊圣经（27 卷）') : 'Greek Scriptures (27 Books)'}</div>
    <div class="bb-toc-grid">${renderBookGrid(40, 66)}</div>
  `;

  bodyEl.querySelectorAll<HTMLButtonElement>('[data-pick-ch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = Number(btn.dataset.pickCh);
      ($('bb-toc-dialog') as HTMLDialogElement).close();
      navigateTo(currentBook, c, true);
    });
  });

  bodyEl.querySelectorAll<HTMLButtonElement>('[data-pick-b]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentBook = Number(btn.dataset.pickB);
      currentChapter = 1;
      renderTocBody('');
    });
  });
}

// ── Event Listeners ─────────────────────────────────────────────────────
$('bb-open-toc').addEventListener('click', () => openTocDialog(false));
$('bb-toc-close').addEventListener('click', () => ($('bb-toc-dialog') as HTMLDialogElement).close());
$('bb-global-search').addEventListener('input', (e) => {
  renderTocBody((e.target as HTMLInputElement).value.trim());
});

$('bb-book-select').addEventListener('change', (e) => {
  const b = Number((e.target as HTMLSelectElement).value);
  navigateTo(b, 1, true);
});

$('bb-chapter-select').addEventListener('change', (e) => {
  const c = Number((e.target as HTMLSelectElement).value);
  navigateTo(currentBook, c, true);
});

$('bb-prev-ch').addEventListener('click', stepPrevChapter);
$('bb-next-ch').addEventListener('click', stepNextChapter);

onLocale(() => {
  renderReaderBar();
  renderReadingStream();
});

// Parse initial URL params (?book=1&ch=1 or ?book=Gen&ch=18)
const initParams = new URLSearchParams(window.location.search);
const rawBookParam = (initParams.get('book') ?? '').trim();
const pBookNum = Number(rawBookParam);
if (pBookNum >= 1 && pBookNum <= 66) {
  currentBook = pBookNum;
} else if (rawBookParam) {
  const q = rawBookParam.toLowerCase();
  const matchIdx = BOOKS.findIndex(
    (b) =>
      b.en.toLowerCase().startsWith(q) ||
      b.zh === rawBookParam ||
      b.en.toLowerCase().replace(/\s+/g, '') === q.replace(/\s+/g, ''),
  );
  if (matchIdx >= 0) currentBook = matchIdx + 1;
}
const pCh = Number(initParams.get('ch'));
if (pCh >= 1) currentChapter = pCh;

await navigateTo(currentBook, currentChapter, false);
loadingStep();
pageReady();
