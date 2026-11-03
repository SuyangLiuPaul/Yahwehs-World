import './home.css';
import { applyStatic, bindSwitch, fullLocale, onLocale, t } from '../locale.ts';
import { loadingStep, loadingSteps, pageReady } from '../site-shell.ts';
import { bookTitle, isOldTestament, loadIndex, refText, sceneTitle, type GalleryIndex, type Scene } from './data.ts';
import { plate } from './media.ts';
import { BRIEFS, briefOf, choice, defaultFor } from './editions.ts';
import { readTheme, setReadTheme, type ReadTheme } from './chrome.ts';

loadingSteps(1);
bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
applyStatic();
// The page is standing as soon as its skeleton is: the plate and the lists arrive into shapes that are already there.
loadingStep();
pageReady();

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let ix: GalleryIndex | null = null;
let back = 0; // days before today
let testament: 'ot' | 'nt' = 'ot';

// ── an old globe link that has no home any more ─────────────────────────
const hash = new URLSearchParams(location.hash.slice(1));
const journey = hash.get('journey');
const oldGlobe = journey !== null || hash.has('place');

// ── the day's scene ─────────────────────────────────────────────────────
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** One scene per day from the set that passed, the same for every reader on the same date; a stride that is coprime
 *  with the count walks the whole set before repeating and does not show two neighbours on neighbouring days. */
function pickOfDay(list: Scene[], day: number): Scene {
  const n = list.length;
  let stride = 7919 % n || 1;
  while (gcd(stride, n) !== 1) stride++;
  return list[(((day * stride) % n) + n) % n]!;
}
const today = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; };
const htmlLang = () => document.documentElement.lang || 'en';
const dateOf = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() - offset);
  return new Intl.DateTimeFormat(htmlLang(), { day: 'numeric', month: 'short' }).format(d);
};

/** The reader module (its data tables and sheets) is loaded when a sheet is opened, not with the home page. */
const reader = () => import('./reader-bridge.ts');

/** The edition chip: the reader's remembered choice, read without loading the reader. */
function editionLabel(): { text: string; aria: string } {
  const c = choice();
  const name = c.parallel ? t(`Parallel · ${c.parallel}`, `对照 · ${c.parallel}`, `Параллельно · ${c.parallel}`) : briefOf(c.id)?.label ?? c.id;
  return { text: `${name} ▾`, aria: `${t('Edition', '译本', 'Издание')}: ${name}` };
}
function paintEdition() {
  const l = editionLabel();
  $('hm-edition').textContent = l.text;
  $('hm-edition').setAttribute('aria-label', l.aria);
}

async function paintHero() {
  if (!ix) return;
  const passed = ix.scenes.filter((s) => s.ok);
  if (!passed.length) return;
  const sc = pickOfDay(passed, today() - back);
  $('hm-kicker').textContent = back === 0
    ? `${t("Today's scene", '今日一幕', 'Сцена дня')} · ${dateOf(0)}`
    : `${t('An earlier scene', '往日一幕', 'Сцена прошлых дней')} · ${dateOf(back)}`;
  $('hm-title').textContent = sceneTitle(sc);
  $('hm-ref').textContent = fullLocale() === 'zh-Hans' || fullLocale() === 'zh-Hant' ? `${refText(sc)} · ${refText(sc, 'en')}` : refText(sc);
  const link = $<HTMLAnchorElement>('hm-plate');
  link.href = `/scenes.html#p=${sc.id}`;
  link.replaceChildren(plate(sc, { kind: 'full', eager: true }));
  $<HTMLAnchorElement>('hm-read').href = `/scenes.html#p=${sc.id}`;
  paintEdition();
  $('hm-day').textContent = back === 0 ? t('Today', '今天', 'Сегодня') : back === 1 ? t('Yesterday', '昨天', 'Вчера') : dateOf(back);
  $('hm-prev').setAttribute('aria-label', t('The day before', '前一天', 'Предыдущий день'));
  $('hm-next').setAttribute('aria-label', t('The day after', '后一天', 'Следующий день'));
  $<HTMLButtonElement>('hm-next').disabled = back === 0;
  $<HTMLButtonElement>('hm-prev').disabled = back >= passed.length - 1;
  document.title = `${t("Yahweh's World", '雅伟之界', 'Мир Яхве')} · ${sceneTitle(sc)}`;
}

// ── browse by book ──────────────────────────────────────────────────────
function paintBrowse() {
  if (!ix) return;
  const ot = ix.books.slice(0, 39).reduce((a, b) => a + b, 0);
  const nt = ix.books.slice(39).reduce((a, b) => a + b, 0);
  const seg = document.querySelectorAll<HTMLButtonElement>('.hm-seg button');
  seg[0]!.textContent = `${t('Old', '旧约', 'Ветхий')} · ${ot.toLocaleString(htmlLang())}`;
  seg[1]!.textContent = `${t('New', '新约', 'Новый')} · ${nt.toLocaleString(htmlLang())}`;
  seg.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === testament)));
  const list: string[] = [];
  ix.books.forEach((n, i) => {
    const b = i + 1;
    if (!n || isOldTestament(b) !== (testament === 'ot')) return;
    list.push(`<a href="/scenes.html#b=${b}"><span>${bookTitle(b)}</span><b>${n}</b></a>`);
  });
  $('hm-books').innerHTML = list.join('');
}

// ── the footer ──────────────────────────────────────────────────────────
function paintLicences() {
  const ids = [defaultFor(), 'bsb-yhwh', 'cuvs-yhwh', 'rst-yhwh'].filter((id, i, a) => a.indexOf(id) === i).slice(0, 3);
  $('hm-licences').innerHTML = ids.map((id) => {
    const e = briefOf(id)!;
    const how = e.lic === '©' ? t('church edition, used with permission', '教会版，经授权使用', 'издание церкви, с разрешения') : e.lic === 'CC0' ? t('public domain (CC0)', '公有领域（CC0）', 'общественное достояние (CC0)') : t('public domain', '公有领域', 'общественное достояние');
    return `<a href="#licences" data-lic>${e.label.replace(/&/g, '&amp;')} · ${how}</a>`;
  }).join('');
  const n = BRIEFS.length;
  $('hm-all-licences').textContent = t(`All ${n} editions and licences ›`, `全部 ${n} 个译本与授权 ›`, `Все издания и лицензии (${n}) ›`);
}

function paintTheme() {
  const cur = readTheme();
  document.querySelectorAll<HTMLButtonElement>('[data-read]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.read === cur)));
}

function paintNotice() {
  if (!oldGlobe) return;
  const box = $('hm-notice');
  const target = journey && ix?.journeyScene[journey];
  box.hidden = false;
  box.innerHTML = `<span></span>${target ? '<a class="gx-btn quiet sm" href=""></a>' : ''}`;
  box.querySelector('span')!.textContent = t('The globe is not open in this version; the scenes are.', '地球版暂未开放；这里是画卷。', 'Глобус в этой версии пока закрыт; здесь — сцены.');
  const a = box.querySelector<HTMLAnchorElement>('a');
  if (a && target) { a.href = `/scenes.html#p=${target}`; a.textContent = t('See the first scene of that journey', '看这条路线的第一幕', 'Первая сцена этого путешествия'); }
}

function paintAll() { void paintHero(); paintBrowse(); paintLicences(); paintTheme(); paintNotice(); }

// ── wiring ──────────────────────────────────────────────────────────────
$('hm-prev').addEventListener('click', () => { back++; void paintHero(); });
$('hm-next').addEventListener('click', () => { if (back > 0) { back--; void paintHero(); } });
const openLic = (from: HTMLElement) => void Promise.all([reader(), import('./licences.ts')]).then(([, m]) => m.openLicences(from));
$('hm-edition').addEventListener('click', (e) => {
  const from = e.currentTarget as HTMLElement;
  void reader().then(async (m) => (await import('../reader/index.ts')).openEditionPicker(m.readerSession(), from));
});
$('hm-all-licences').addEventListener('click', (e) => openLic(e.currentTarget as HTMLElement));
$('hm-licences').addEventListener('click', (e) => { const a = (e.target as HTMLElement).closest('[data-lic]'); if (a) { e.preventDefault(); openLic(a as HTMLElement); } });
document.querySelectorAll<HTMLButtonElement>('.hm-seg button').forEach((b) => b.addEventListener('click', () => { testament = b.dataset.t as 'ot' | 'nt'; paintBrowse(); }));
document.querySelectorAll<HTMLButtonElement>('[data-read]').forEach((b) => b.addEventListener('click', () => { setReadTheme(b.dataset.read as ReadTheme); paintTheme(); }));
document.addEventListener('gx:edition', paintEdition);
onLocale(() => { applyStatic(); paintAll(); });
window.addEventListener('hashchange', () => location.reload());

function failed() {
  const books = $('hm-books');
  books.innerHTML = `<div class="gx-fail"><p></p><button type="button" class="gx-btn primary"></button></div>`;
  books.querySelector('p')!.textContent = t('The list of scenes did not load. Check your connection and try again.', '画卷目录没有载入。请检查网络后重试。', 'Список сцен не загрузился. Проверьте соединение и попробуйте снова.');
  const btn = books.querySelector('button')!;
  btn.textContent = t('Try again', '重试', 'Повторить');
  btn.addEventListener('click', () => { books.replaceChildren(); void start(); });
  $('hm-title').textContent = t("Yahweh's World", '雅伟之界', 'Мир Яхве');
  $('hm-kicker').textContent = '';
}

async function start() {
  try {
    ix = await loadIndex();
  } catch { failed(); return; }
  paintAll();
  void fetch('/version.json').then((r) => r.json()).then((v: { version?: string }) => {
    if (v.version) $('hm-version').textContent = `v${v.version}`;
  }).catch(() => {});
}
paintTheme();
paintLicences();
paintEdition();
void start();
