import './scenes-page.css';
import { applyStatic, bindSwitch, onLocale, t } from '../locale.ts';
import { loadingStep, loadingSteps, pageReady } from '../site-shell.ts';
import {
  bookTitle, chapterHref, isOldTestament, lang, loadIndex, loadSummaries, neighbour, refText, sceneSummary, sceneTitle,
  type GalleryIndex, type Scene, type Summaries,
} from './data.ts';
import { plate, fullUrl } from './media.ts';
import { openEditionSheet } from './edition-sheet.ts';
import { current, word, type Edition } from './editions.ts';
import { copyText, hasParallel, loadPassage, type Passage } from './passage.ts';
import { toast } from './sheet.ts';

loadingSteps(1);
bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
applyStatic();
loadingStep();
pageReady(); // the page is standing as soon as its skeleton is

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const BATCH = 60;

type Scope = 'all' | 'ot' | 'nt';
interface Route { p: string | null; b: number; scope: Scope }

let ix: GalleryIndex | null = null;
let sums: Summaries | null = null;
let limit = BATCH;

// ── the address: the hash holds the view, so back, forward and sharing all work ────────────────
function parse(): Route {
  const h = new URLSearchParams(location.hash.slice(1));
  const p = h.get('p') ?? h.get('event'); // #event= is the old lightbox's form
  const b = Number(h.get('b') ?? h.get('book')) || 0;
  const tt = h.get('t');
  return { p, b: b >= 1 && b <= 66 ? b : 0, scope: tt === 'ot' || tt === 'nt' ? tt : 'all' };
}
const go = (h: string) => { location.hash = h; };

// ── browse ──────────────────────────────────────────────────────────────
function inScope(r: Route) {
  return ix!.scenes.filter((s) => (r.b ? s.b === r.b : r.scope === 'ot' ? isOldTestament(s.b) : r.scope === 'nt' ? !isOldTestament(s.b) : true));
}

function paintBrowseHead(r: Route, n: number) {
  const total = ix!.scenes.length;
  $('sc-kicker').textContent = t(`${total.toLocaleString('en-US')} scenes · 66 books`, `${total.toLocaleString('en-US')} 幕 · 66 卷`, `${total.toLocaleString('ru-RU')} сцен · 66 книг`);
  $('sc-title').textContent = r.b ? bookTitle(r.b) : r.scope === 'ot' ? t('Old Testament', '旧约', 'Ветхий Завет') : r.scope === 'nt' ? t('New Testament', '新约', 'Новый Завет') : t('All scenes', '全部画卷', 'Все сцены');
  $('sc-count').textContent = r.b
    ? t(`${n} scenes · ${isOldTestament(r.b) ? 'Old' : 'New'} Testament, book ${r.b}`, `${n} 幕 · ${isOldTestament(r.b) ? '旧约' : '新约'}第 ${r.b} 卷`, `${n} сцен · ${isOldTestament(r.b) ? 'Ветхий' : 'Новый'} Завет, книга ${r.b}`)
    : t(`${n} scenes`, `${n} 幕`, `${n} сцен`);
  const strip = $('sc-strip');
  const chip = (label: string, hash: string, on: boolean) => `<button type="button" data-h="${hash}" aria-pressed="${on}">${label}</button>`;
  const scope = r.b ? (isOldTestament(r.b) ? 'ot' : 'nt') : r.scope;
  const books = ix!.books.map((c, i) => ({ c, b: i + 1 })).filter((x) => x.c && (scope === 'all' || (scope === 'ot') === isOldTestament(x.b)));
  strip.innerHTML = chip(t('All', '全部', 'Все'), '#', !r.b && r.scope === 'all') + chip(t('Old', '旧约', 'Ветхий'), '#t=ot', !r.b && r.scope === 'ot') + chip(t('New', '新约', 'Новый'), '#t=nt', !r.b && r.scope === 'nt')
    + '<span class="sep"></span>' + books.map((x) => chip(bookTitle(x.b), `#b=${x.b}`, r.b === x.b)).join('');
  strip.setAttribute('aria-label', t('Filter the scenes', '筛选画卷', 'Фильтр сцен'));
  document.title = `${$('sc-title').textContent} · ${t("Yahweh's World", '雅伟之界', 'Мир Яхве')}`;
}

let shown = 0;
let listNow: Scene[] = [];
function card(sc: Scene): HTMLElement {
  const a = document.createElement('a');
  a.className = 'sc-card';
  a.href = `#p=${sc.id}`;
  a.dataset.id = sc.id;
  a.append(plate(sc, { kind: 'thumb', alt: '' }));
  const cap = document.createElement('span');
  cap.className = 'cap';
  cap.textContent = sceneTitle(sc);
  const ref = document.createElement('span');
  ref.className = 'gx-mono';
  ref.textContent = refText(sc);
  a.append(cap, ref);
  return a;
}
function paintGrid(reset: boolean) {
  const grid = $('sc-grid');
  if (reset) { grid.replaceChildren(); shown = 0; }
  const next = listNow.slice(shown, limit);
  const frag = document.createDocumentFragment();
  for (const sc of next) frag.append(card(sc));
  grid.append(frag);
  shown += next.length;
  const more = $<HTMLButtonElement>('sc-more-btn');
  more.hidden = shown >= listNow.length;
  more.textContent = t(`Show more (${listNow.length - shown} left)`, `再显示一些（还有 ${listNow.length - shown} 幕）`, `Показать ещё (осталось ${listNow.length - shown})`);
}

function showBrowse(r: Route, restore?: { y: number; n: number } | null) {
  $('sc-picture').hidden = true;
  $('sc-browse').hidden = false;
  if (!ix) return;
  listNow = inScope(r);
  limit = Math.max(BATCH, restore?.n ?? 0);
  paintBrowseHead(r, listNow.length);
  paintGrid(true);
  if (restore) requestAnimationFrame(() => window.scrollTo(0, restore.y));
  else window.scrollTo(0, 0);
  // keep the current chip in view in the strip
  $('sc-strip').querySelector('[aria-pressed="true"]:not(:first-child)')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// a mouse wheel over the strip scrolls it sideways (it is one row on every screen)
$('sc-strip').addEventListener('wheel', (e) => {
  const el = e.currentTarget as HTMLElement;
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { el.scrollLeft += e.deltaY; e.preventDefault(); }
}, { passive: false });
$('sc-strip').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-h]');
  if (b) go(b.dataset.h!);
});
$('sc-grid').addEventListener('click', () => {
  // remember where the grid was, so Back from a picture lands on the same card
  history.replaceState({ y: window.scrollY, n: limit }, '');
  try { sessionStorage.setItem('gx.from', '1'); } catch { /* blocked storage: Back goes to the book instead */ }
});
$('sc-more-btn').addEventListener('click', () => { limit += BATCH; paintGrid(false); });
if ('IntersectionObserver' in window) {
  new IntersectionObserver((es) => {
    if (es.some((x) => x.isIntersecting) && !$('sc-more-btn').hidden && !$('sc-browse').hidden) { limit += BATCH; paintGrid(false); }
  }, { rootMargin: '480px' }).observe($('sc-more'));
}

// ── the picture and its passage ─────────────────────────────────────────
let scene: Scene | null = null;
const selected = new Set<number>();
let expanded = false;
let passage: Passage | null = null;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function paintPicture(sc: Scene) {
  if (!ix) return;
  const inBook = ix.scenes.filter((s) => s.b === sc.b);
  const pos = inBook.findIndex((s) => s.id === sc.id) + 1;
  const prev = neighbour(ix, sc, -1), next = neighbour(ix, sc, 1);
  const l = lang();
  $('pc-pos').textContent = `${refText(sc)} · ${pos} / ${inBook.length}`;
  $('pc-title').textContent = sceneTitle(sc);
  $('pc-ref').textContent = l === 'en' ? refText(sc) : `${refText(sc)} · ${refText(sc, 'en')}`;
  $('pc-sum').textContent = sums ? sceneSummary(sums, sc) : '';
  $('pc-credit').textContent = t("Artist's impression · drawn with AI tools, reviewed verse by verse", '画家的想象 · AI 辅助绘制，逐节审核', 'Художественный образ · создан с помощью ИИ-инструментов, проверен стих за стихом');
  $('pc-nav-t').textContent = t('Previous · Next', '上一幕 · 下一幕', 'Назад · Вперёд');
  const setNav = (id: string, to: Scene | null, label: string) => {
    const a = $<HTMLAnchorElement>(id);
    a.setAttribute('aria-label', label);
    if (to) { a.href = `#p=${to.id}`; a.removeAttribute('aria-disabled'); } else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
  };
  setNav('pc-prev', prev, t('Previous scene', '上一幕', 'Предыдущая сцена'));
  setNav('pc-next', next, t('Next scene', '下一幕', 'Следующая сцена'));
  $('pc-back').setAttribute('aria-label', t('Back to the scenes', '回到画卷', 'Назад к сценам'));
  $('pc-share').setAttribute('aria-label', t('Share this scene', '分享这一幕', 'Поделиться сценой'));
  $('pc-plate').setAttribute('aria-label', t('View the picture full screen', '全屏看画', 'Открыть картину на весь экран'));
  const pl = plate(sc, { kind: 'full', eager: true, alt: sceneTitle(sc) });
  $('pc-plate').replaceChildren(pl);
  document.title = `${sceneTitle(sc)} · ${t("Yahweh's World", '雅伟之界', 'Мир Яхве')}`;
  // the next picture is wanted next
  for (const n of [next, prev]) if (n?.ok) { const i = new Image(); i.decoding = 'async'; i.src = fullUrl(n.id); }
}

function passageSkeleton() {
  return `<div class="pc-skel" aria-hidden="true"><span class="gx-sk line w55"></span><span class="gx-sk line w92"></span><span class="gx-sk line w80"></span><span class="gx-sk line w92"></span><span class="gx-sk line w55"></span></div>`;
}

async function paintPassage(sc: Scene) {
  const host = $('pc-passage');
  host.innerHTML = passageSkeleton();
  selected.clear();
  const edition: Edition = await current();
  let p: Passage;
  try { p = await loadPassage(sc, edition); } catch {
    if (scene?.id !== sc.id) return;
    host.innerHTML = `<div class="gx-fail"><p></p><button type="button" class="gx-btn primary"></button></div>`;
    host.querySelector('p')!.textContent = t('The verses did not load. Check your connection and try again.', '经文没有载入。请检查网络后重试。', 'Стихи не загрузились. Проверьте соединение и попробуйте снова.');
    const b = host.querySelector('button')!;
    b.textContent = t('Try again', '重试', 'Повторить');
    b.addEventListener('click', () => void paintPassage(sc));
    return;
  }
  if (scene?.id !== sc.id) return; // the reader moved on while this was loading
  passage = p;
  drawPassage();
}

function drawPassage() {
  const sc = scene, p = passage;
  if (!sc || !p) return;
  const host = $('pc-passage');
  const SHOW = 12;
  const verses = expanded ? p.verses : p.verses.slice(0, SHOW);
  const rest = p.verses.length - verses.length;
  const heading = p.headings[0]?.text;
  host.innerHTML = `
    <div class="ptools">
      <button type="button" class="gx-pill gold" id="pc-ed" aria-haspopup="dialog"></button>
      ${hasParallel() ? `<button type="button" class="gx-pill" id="pc-par" aria-pressed="false">${t('Parallel', '对照', 'Параллельно')}</button>` : ''}
      <button type="button" class="gx-pill" id="pc-copy">${t('Copy', '复制', 'Копировать')}</button>
      <span class="spacer"></span>
      <a class="gx-pill" id="pc-chapter" href="${chapterHref(sc)}">${t('Whole chapter ›', '读整章 ›', 'Вся глава ›')}</a>
    </div>
    ${heading ? `<div class="heading" role="heading" aria-level="3">${esc(heading)}</div>` : ''}
    <div class="verses" id="pc-verses"></div>
    ${rest > 0 ? `<button type="button" class="gx-pill" id="pc-more" style="justify-self:start">${t(`Show the other ${rest} verses`, `展开其余 ${rest} 节`, `Показать остальные стихи (${rest})`)}</button>` : ''}
    <div class="selbar" id="pc-sel"><span class="gx-mono"></span><button type="button" class="gx-btn sm primary" id="pc-sel-copy">${t('Copy', '复制', 'Копировать')}</button><button type="button" class="gx-btn sm quiet" id="pc-sel-link">${t('Share link', '分享链接', 'Ссылка')}</button></div>
    <div class="ed-credit"></div>`;
  $('pc-ed').textContent = `${word(p.edition.name)} ▾`;
  host.querySelector('.ed-credit')!.textContent = `${word(p.edition.name)} · ${word(p.edition.credit)} ${t('Tap a verse number to select and copy.', '点经文节号可选取、复制。', 'Нажмите на номер стиха, чтобы выбрать и скопировать.')}`;
  const box = $('pc-verses');
  for (const v of verses) {
    const row = document.createElement('p');
    row.className = 'v';
    row.dataset.key = String(v.key);
    row.innerHTML = `<button type="button" class="vn" aria-pressed="false"></button><span class="tx"></span>`;
    const vn = row.querySelector<HTMLElement>('.vn')!;
    vn.textContent = String(v.n);
    vn.setAttribute('aria-label', t(`Verse ${v.n}`, `第 ${v.n} 节`, `Стих ${v.n}`));
    row.querySelector('.tx')!.textContent = v.text;
    box.append(row);
  }
  $('pc-ed').addEventListener('click', (e) => openEditionSheet(e.currentTarget as HTMLElement));
  $('pc-copy').addEventListener('click', () => void doCopy(verses.map((v) => v.key)));
  $('pc-more')?.addEventListener('click', () => { expanded = true; drawPassage(); });
  box.addEventListener('click', (e) => {
    const vn = (e.target as HTMLElement).closest<HTMLElement>('.vn');
    if (!vn) return;
    const row = vn.parentElement!;
    const k = Number(row.dataset.key);
    if (selected.has(k)) selected.delete(k); else selected.add(k);
    row.classList.toggle('sel', selected.has(k));
    vn.setAttribute('aria-pressed', String(selected.has(k)));
    paintSel();
  });
  $('pc-sel-copy').addEventListener('click', () => void doCopy([...selected]));
  $('pc-sel-link').addEventListener('click', () => void doShare());
  paintSel();
}

function paintSel() {
  const bar = $('pc-sel');
  const keys = [...selected].sort((a, b) => a - b);
  bar.classList.toggle('on', keys.length > 0);
  if (!keys.length || !scene) return;
  const first = keys[0]!, last = keys[keys.length - 1]!;
  const n = keys.length;
  bar.querySelector('.gx-mono')!.textContent = `${t(`${n} verse${n > 1 ? 's' : ''}`, `已选 ${n} 节`, `Выбрано стихов: ${n}`)} · ${refText({ b: scene.b, s: first, e: last })}`;
}

async function writeClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Safari without permission, or an insecure origin: fall back */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

async function doCopy(keys: number[]) {
  if (!passage) return;
  const text = copyText(passage, keys.sort((a, b) => a - b));
  const ok = await writeClipboard(text);
  const first = keys[0]!, last = keys[keys.length - 1]!;
  toast(ok ? `${t('Copied', '已复制', 'Скопировано')} · ${refText({ b: passage.scene.b, s: first, e: last })} (${word(passage.edition.name)})` : t('Copying did not work on this browser', '这个浏览器没能复制', 'Не удалось скопировать в этом браузере'));
}

async function doShare() {
  if (!scene) return;
  const url = `${location.origin}/p/${scene.id}`;
  if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: sceneTitle(scene), url }); return; } catch { /* cancelled: nothing to say */ }
  }
  toast((await writeClipboard(url)) ? `${t('Link copied', '链接已复制', 'Ссылка скопирована')} · ${url.replace(/^https?:\/\//, '')}` : url);
}
$('pc-share').addEventListener('click', () => void doShare());
$('pc-back').addEventListener('click', () => {
  let from = false;
  try { from = sessionStorage.getItem('gx.from') === '1'; } catch { /* no storage */ }
  if (from && history.length > 1) history.back(); else go(scene ? `#b=${scene.b}` : '#');
});

// ── full screen ─────────────────────────────────────────────────────────
function openFull() {
  if (!scene || !scene.ok) return;
  const d = document.createElement('dialog');
  d.className = 'gx-fs';
  d.setAttribute('aria-label', t('The picture, full screen', '全屏看画', 'Картина на весь экран'));
  d.innerHTML = `<button type="button" class="gx-iconbtn" aria-label=""><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button><img alt=""><div class="fs-hint"></div>`;
  d.querySelector('button')!.setAttribute('aria-label', t('Close', '关闭', 'Закрыть'));
  const img = d.querySelector('img')!;
  img.src = fullUrl(scene.id);
  img.alt = sceneTitle(scene);
  d.querySelector('.fs-hint')!.textContent = t('Tap to zoom · pinch on a phone', '点一下放大 · 手机上可双指缩放', 'Нажмите, чтобы увеличить · на телефоне — щипком');
  const back = document.activeElement as HTMLElement | null;
  d.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button')) d.close(); else d.classList.toggle('zoomed'); });
  d.addEventListener('close', () => { d.remove(); back?.focus?.({ preventScroll: true }); });
  document.body.append(d);
  d.showModal();
}
$('pc-plate').addEventListener('click', openFull);

// ── the router ──────────────────────────────────────────────────────────
async function route(restore = false) {
  const r = parse();
  if (r.p) {
    $('sc-browse').hidden = true;
    $('sc-picture').hidden = false;
    if (!ix) { $('pc-plate').innerHTML = '<span class="gx-sk plate"></span>'; $('pc-passage').innerHTML = passageSkeleton(); return; }
    const sc = ix.byId.get(r.p);
    if (!sc) { history.replaceState(null, '', '#'); showBrowse({ p: null, b: 0, scope: 'all' }); return; }
    scene = sc;
    expanded = false;
    window.scrollTo(0, 0);
    paintPicture(sc);
    void paintPassage(sc);
    // the summary is its own file: the picture and verses do not wait for it
    if (!sums) void loadSummaries().then((s) => { sums = s; if (scene === sc) paintPicture(sc); }).catch(() => {});
    return;
  }
  scene = null;
  showBrowse(r, restore ? (history.state as { y: number; n: number } | null) : null);
}

function failed() {
  const g = $('sc-grid');
  g.innerHTML = `<div class="gx-fail" style="grid-column:1/-1"><p></p><button type="button" class="gx-btn primary"></button></div>`;
  g.querySelector('p')!.textContent = t('The list of scenes did not load. Check your connection and try again.', '画卷目录没有载入。请检查网络后重试。', 'Список сцен не загрузился. Проверьте соединение и попробуйте снова.');
  const b = g.querySelector('button')!;
  b.textContent = t('Try again', '重试', 'Повторить');
  b.addEventListener('click', () => { g.innerHTML = '<span class="gx-sk plate"></span><span class="gx-sk plate"></span>'; void start(); });
}

async function start() {
  try { ix = await loadIndex(); } catch { failed(); return; }
  await route();
}

window.addEventListener('hashchange', () => void route(true));
window.addEventListener('keydown', (e) => {
  if (!scene || !ix || e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.target as HTMLElement).closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
  if (e.key === 'ArrowLeft') { const n = neighbour(ix, scene, -1); if (n) go(`#p=${n.id}`); }
  else if (e.key === 'ArrowRight') { const n = neighbour(ix, scene, 1); if (n) go(`#p=${n.id}`); }
});
document.addEventListener('gx:edition', () => { if (scene) void paintPassage(scene); });
document.addEventListener('gx:read', () => { /* paper follows html[data-read] in CSS; nothing to repaint */ });
onLocale(() => {
  applyStatic();
  if (!ix) return;
  const r = parse();
  if (scene) { paintPicture(scene); void paintPassage(scene); } else { listNow = inScope(r); paintBrowseHead(r, listNow.length); paintGrid(true); }
});
void start();
