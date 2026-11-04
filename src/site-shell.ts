import { applyStatic, brand, fullLocale, hant, onLocale, setLocale, t, type Locale } from './locale.ts';
import { UNITS } from './plan-units.ts';

// Two things every page shares, and neither of them belonged to any one page.
//
//   · THE DOOR. A page in this app paints its text in a few milliseconds and
//     its scene in a few seconds, and in between it looks finished. The owner
//     opened the tabernacle, saw an empty black frame with two buttons under
//     it, and pressed them. So every page now opens behind the loading screen
//     and does not hand itself over until its own scene says it is standing.
//     The screen's markup is in the HTML (scripts/build-shell.mjs), because a
//     loading screen a module has to draw arrives after the thing it is meant
//     to cover.
//
//   · THE INDEX. The nav bar holds six destinations and already overflowed on
//     a phone — the owner photographed "Ar" cut off at the right edge. The
//     plan has fifty-six units. A bar cannot grow; a sheet can. So the bar
//     keeps what is built and 全部 opens the whole of it: what you can walk
//     into today, and every unit of the plan with what it is waiting on.

const $ = (id: string) => document.getElementById(id);

// ── the loading screen ───────────────────────────────────────────────────

let steps = 0, done = 0;

/** Says how many milestones this page will report before it is ready. */
export function loadingSteps(n: number) { steps = n; done = 0; bar(); }

/** One milestone reached. */
export function loadingStep() { done++; bar(); }

function bar() {
  const el = $('loading-bar');
  if (el) el.style.width = `${steps ? Math.min(done / steps, 1) * 100 : 0}%`;
}

/** The page is standing: hand it over. Safe to call twice. */
export function pageReady() {
  const el = $('loading-bar');
  if (el) el.style.width = '100%';
  $('loading')?.classList.add('done');
}

// ── the index of everything ──────────────────────────────────────────────

/** What is built, in the order the nav has it. `zh` is the long reading. */
const BUILT: { href: string; zh: string; en: string; noteZh: string; noteEn: string }[] = [
  { href: '/', zh: '🌍 3D 圣经地球仪', en: '🌍 3D Biblical Globe', noteZh: '1,332 处圣经地名、1,443 个事件坐标定位与 10 条行程动态演示', noteEn: '1,332 biblical places, 1,443 geolocated events & 10 animated routes' },
  { href: '/bible.html', zh: '📖 《和合本雅伟版 · 画卷圣经》 (全书)', en: '📖 Illustrated CUV-Yahweh Bible (66 Books)', noteZh: '全书 66 卷 31,102 节经文与 1,443 幅正典画卷一对一嵌合，含主[雅伟]/主[耶稣]/主[基督]、H0/G0 与 ①② 随段小注及 EPUB 下载', noteEn: 'All 66 books (31,102 verses) paired 1-to-1 with 1,443 canonical plates, referent markers, ①② notes & EPUB download' },
  { href: '/scenes.html', zh: '🖼️ 圣经画卷全集 (1,443 幅)', en: '🖼️ Biblical Scenes Gallery (1,443)', noteZh: '创世记至启示录 1,443 幅中英双语事件插画，支持按书卷与单元检索', noteEn: 'All 1,443 canonical event illustrations across 66 books & 56 units' },
  { href: '/tabernacle.html', zh: '🏛️ 走进摩西会幕 (1:1 漫游)', en: '🏛️ Walk into the Tabernacle', noteZh: '出埃及记 26–27 · 第一人称实尺走进院落、圣所与至圣所', noteEn: 'Exodus 26–27 · First-person 1:1 walk through court & sanctuary' },
  { href: '/temple.html', zh: '🏛️ 走进所罗门圣殿 (1:1 漫游)', en: "🏛️ Walk into Solomon's Temple", noteZh: '列王纪上 6–7；历代志下 3–4 · 第一人称实尺走进圣殿与内院', noteEn: '1 Kings 6–7; 2 Chronicles 3–4 · First-person 1:1 walk' },
  { href: '/ark.html', zh: '🚢 走进挪亚方舟 (1:1 漫游)', en: "🚢 Walk into Noah's Ark", noteZh: '创世记 6–8 · 第一人称走进三层甲板与方舟内部结构', noteEn: 'Genesis 6–8 · First-person walk inside the 3-deck Ark' },
  { href: '/scene-assembly.html', zh: '🎬 3D 动态场景工坊与沙盘', en: '🎬 3D Animated Diorama Scenes', noteZh: '方舟登船、三层剖面、会幕营地与圣殿献殿 3D 骨骼动画沙盘', noteEn: 'Interactive 3D dioramas with rigged & animated biblical figures' },
  { href: '/figures.html', zh: '🧍 人物与活物库 (3D + 394 立绘)', en: '🧍 People, Creatures & 394 Cutouts', noteZh: '85+ 可交互骨骼动画 3D 模型、真实身高比例尺与 394 张透明立绘', noteEn: '85+ animated 3D models, scale comparisons & 394 transparent cutouts' },
  { href: '/plan.html', zh: '📜 圣经全景 (56 个叙事单元)', en: '📜 Bible Panorama (56 Units)', noteZh: '整本圣经划分为 56 个叙事单元，串联经文、画卷、地图、路线与 3D 空间', noteEn: 'All 56 narrative units connecting scripture, art, maps, routes & 3D' },
];

type State = 'live' | 'building' | 'planned';

/** One unit's state: walkable today, being built, or still on paper. */
function stateOf(u: (typeof UNITS)[number]): State {
  if (u.walk) return 'live';
  if (u.plan?.some((p) => p.status === 'live')) return 'live';
  if (u.plan?.some((p) => p.status === 'building')) return 'building';
  return 'planned';
}

const STATE_TEXT: Record<State, { zh: string; en: string }> = {
  live: { zh: '已开放 3D', en: 'Open' },
  building: { zh: '开发中', en: 'In development' },
  planned: { zh: '已配画卷', en: 'Illustrated' },
};

function render(menu: HTMLElement) {
  const counts = { live: 0, building: 0, planned: 0 };
  for (const u of UNITS) counts[stateOf(u)]++;

  const rows = UNITS.map((u, idx) => {
    const s = stateOf(u);
    const href = u.walk ? u.walk.href : `/plan.html#u-${u.id}`;
    const what = u.walk
      ? t(u.walk.en, u.walk.zh)
      : t(u.plan?.[0]?.en ?? 'Illustrated unit', u.plan?.[0]?.zh ?? '含事件画卷与经文定位');
    return `<li class="am-row am-${s}"><a href="${href}">
      <span class="am-name">${idx + 1}. ${t(u.en, hant(u.zh))}</span>
      <span class="am-what">${what}</span>
      <span class="am-state">${t(STATE_TEXT[s].en, STATE_TEXT[s].zh)}</span>
    </a></li>`;
  }).join('');

  menu.innerHTML = `<div class="am-sheet" role="dialog" aria-modal="true" aria-label="${t('Everything in this app', `${brand()} · 全景导览`)}">
    <header>
      <h2>${t(`${brand()} · Full Guide`, `${brand()} · 全景导览`)}</h2>
      <button type="button" id="all-close" aria-label="${t('Close', '关闭')}">✕</button>
    </header>
    <div class="am-phone">
      <button type="button" id="am-routes" class="am-routes"><span>${t('Routes', '路线')}</span><i aria-hidden="true">›</i></button>
      <div class="am-lang" role="group" aria-label="Language / 语言">${(['en', 'zh-Hans', 'zh-Hant'] as const).map((l) =>
        `<button type="button" data-locale="${l}" lang="${l}" aria-pressed="${fullLocale() === l}">${l === 'en' ? 'EN' : l === 'zh-Hans' ? '简' : '繁'}</button>`).join('')}</div>
    </div>
    <p class="am-lede">${t(
      `Explore the entire Bible across 1,443 canonical events, 1,332 geographical places, 10 animated journeys, 394 character cutouts, 85+ rigged 3D models, and 1:1 measured 3D spaces across 56 narrative units.`,
      `汇集整本圣经 1,443 个正典事件与双语画卷、1,332 处考据地名、10 条动态行程路线、394 张透明立绘、85+ 骨骼动画 3D 模型，以及按圣经尺寸 1:1 建造的 3D 空间（共 56 个叙事单元）。`)}</p>
    <h3>${t('Core Modules · Open Now', '核心功能模块 · 点击直达')}</h3>
    <ul class="am-built">${BUILT.map((b) => `<li><a href="${b.href}">
      <span class="am-name">${t(b.en, hant(b.zh))}</span>
      <span class="am-what">${t(b.noteEn, hant(b.noteZh))}</span>
    </a></li>`).join('')}</ul>
    <h3>${t('All 56 Biblical Narrative Units', '整本圣经 56 个叙事单元目录')}</h3>
    <ol class="am-units">${rows}</ol>
  </div>`;
  menu.querySelector('#all-close')?.addEventListener('click', () => close());
}

// ── the two shelves in the bar ───────────────────────────────────────────
//
// 走进 holds the walks and 路线 holds the journeys. Neither is a new kind of
// thing: both are lists that were going to outgrow a row of tabs, and both
// are opened the same way, so they are opened by the same function.

/** The controls that open a menu: the one in the top bar and, on a phone, the one in the tab bar
 *  (`data-opens`). Both are kept in step; focus goes back to whichever one is on screen. */
const triggersOf = (id: string, own: HTMLElement | null) =>
  [own, ...Array.from(document.querySelectorAll<HTMLElement>(`[data-opens="${id}"]`))].filter((b): b is HTMLElement => !!b);
const onScreen = (els: HTMLElement[]) => els.find((b) => b.getClientRects().length > 0) ?? els[0];
const setExpanded = (els: HTMLElement[], v: boolean) => els.forEach((b) => b.setAttribute('aria-expanded', String(v)));

type Shelf = { buttons: HTMLElement[]; panel: HTMLElement; fill?: () => Promise<void> | void };
const shelves: Shelf[] = [];

function closeShelves(except?: Shelf) {
  for (const s of shelves) {
    if (s === except) continue;
    s.panel.hidden = true;
    setExpanded(s.buttons, false);
  }
}

function shelf(buttonId: string, panelId: string, fill?: Shelf['fill']) {
  const panel = $(panelId);
  const buttons = triggersOf(panelId, $(buttonId));
  if (!buttons.length || !panel) return;
  const s: Shelf = { buttons, panel, fill };
  shelves.push(s);
  let filled = false;
  const toggle = async () => {
    const showing = !panel.hidden;
    closeShelves(s);
    // An All sheet that is open gives way to the shelf, the way one tab replaces another.
    if (open) close(false);
    if (showing) { panel.hidden = true; setExpanded(buttons, false); return; }
    if (!filled && fill) { await fill(); filled = true; }
    panel.hidden = false;
    setExpanded(buttons, true);
    (panel.querySelector('a, button') as HTMLElement | null)?.focus();
  };
  buttons.forEach((b) => b.addEventListener('click', toggle));
  panel.addEventListener('click', () => { panel.hidden = true; setExpanded(buttons, false); });
}

/** The globe page takes journeys itself rather than through the address bar,
 *  so choosing one does not reload the scene. Any page that does not register
 *  a handler simply follows the link, which is what the links are for. */
let takeJourney: ((id: string) => void) | null = null;
export function onJourneyPick(fn: (id: string) => void) { takeJourney = fn; }

type Journey = { id: string; en: string; zh: string; stopCount: number };
let journeys: Journey[] = [];

async function fillRoutes() {
  const panel = $('routemenu');
  if (!panel) return;
  if (!journeys.length) {
    try {
      const r = await fetch('/data/journeys.json');
      journeys = (await r.json()).journeys as Journey[];
    } catch {
      // The names come from the same payload the globe draws the stops from,
      // so they can never name a journey that is not there. If it cannot be
      // had, say so rather than showing an empty shelf.
      panel.innerHTML = `<p class="dd-none">${t('Routes unavailable', '路线未载入')}</p>`;
      return;
    }
  }
  drawRoutes();
  onLocale(drawRoutes);
}

function drawRoutes() {
  const panel = $('routemenu');
  if (!panel || !journeys.length) return;
  panel.innerHTML = journeys.map((jr) => `<a href="/#journey=${jr.id}" data-journey="${jr.id}">
    <span class="dd-name">${t(jr.en, hant(jr.zh))}</span>
    <span class="dd-of">${t(`${jr.stopCount} stops`, `${jr.stopCount} 站`)}</span>
  </a>`).join('');
  panel.querySelectorAll<HTMLAnchorElement>('a[data-journey]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (!takeJourney) return;
      e.preventDefault();
      takeJourney(a.dataset.journey!);
    });
  });
}

let open = false;
function close(refocus = true) {
  const menu = $('allmenu');
  if (!menu) return;
  menu.hidden = true;
  open = false;
  const buttons = triggersOf('allmenu', $('all-open'));
  setExpanded(buttons, false);
  if (refocus) onScreen(buttons)?.focus();
}

/** On a phone the tab strip scrolls sideways, and it opens at the left, so on
 *  every page but the first the tab you are standing on was off the edge or
 *  cut in half ("Glo"). Wayfinding has to answer "where am I" without a swipe:
 *  bring the current tab to the middle of the strip. Instant, not animated:
 *  it happens before the reader has seen the bar. */
function centreCurrentTab() {
  const strip = document.querySelector<HTMLElement>('.sitenav ol');
  const cur = strip?.querySelector<HTMLElement>('[aria-current]');
  if (!strip || !cur || strip.scrollWidth <= strip.clientWidth) return;
  const to = cur.getBoundingClientRect(), from = strip.getBoundingClientRect();
  // A tab wider than the strip (the strip is ~34 px at 375 px wide, beside the
  // brand, 全部, 路线 and the language switch) cannot be centred: start it at
  // the left edge so its first characters, not its middle, are what shows.
  const slack = strip.clientWidth - to.width;
  strip.scrollLeft += to.left - from.left - (slack > 0 ? slack / 2 : 0);
}

/** Wires 全部, 走进 and 路线. Every page calls this. */
export function installSiteMenu() {
  // The gallery surface has none of these menus (scripts/lib/vite-gallery-surface.mjs writes a three-item bar), and the
  // index above names pages that surface does not build: nothing to wire, and the build drops all of it.
  if (import.meta.env.VITE_SURFACE === 'gallery') return;
  centreCurrentTab();
  // Webfonts and the language switch change the tabs' widths after first paint.
  window.addEventListener('load', centreCurrentTab, { once: true });
  onLocale(centreCurrentTab);
  shelf('walk-open', 'walkmenu');
  shelf('routes-open', 'routemenu', fillRoutes);
  // One press anywhere else puts them away — a shelf left hanging over the
  // map after the reader has moved on is the same fault as the pill was.
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.tab-group, .tabbar, #allmenu')) closeShelves();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeShelves(); });

  const menu = $('allmenu');
  const buttons = triggersOf('allmenu', $('all-open'));
  if (!menu || !buttons.length) return;
  let drawn = false;
  const draw = () => { render(menu); drawn = true; };
  buttons.forEach((button) => button.addEventListener('click', () => {
    if (open) return close();
    closeShelves();
    if (!drawn) draw();
    menu.hidden = false;
    open = true;
    setExpanded(buttons, true);
    (menu.querySelector('#all-close') as HTMLElement | null)?.focus();
  }));
  menu.addEventListener('click', (e) => {
    if (e.target === menu) return close();
    // The phone-only rows at the top of the sheet: the journeys, and the language.
    const target = e.target as HTMLElement;
    const lang = target.closest<HTMLElement>('[data-locale]');
    if (lang) { void setLocale(lang.dataset.locale as Locale); return; }
    if (target.closest('#am-routes')) { close(false); $('routes-open')?.click(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) close(); });
  // The sheet says aria-modal, so the page behind it must not be reachable by
  // keyboard: Tab cycled through all 65 links and then walked out into the
  // page underneath, which a screen-reader or switch user cannot see is dimmed.
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !open) return;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')).filter((el) => el.checkVisibility());
    if (!items.length) return;
    const first = items[0]!, last = items[items.length - 1]!, at = document.activeElement;
    if (e.shiftKey && (at === first || !menu.contains(at))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !menu.contains(at))) { e.preventDefault(); first.focus(); }
  });
  // The sheet is built from the plan and the plan is bilingual: redraw it, or
  // a reader who switches language while it is open gets the other one.
  onLocale(() => { if (drawn) draw(); applyStatic(document.querySelector('.sitenav') ?? document); });
}

/* Menus and sheets grow out of the control that opened them (apple-motion §7): when one is shown, point its
   transform-origin at the trigger's centre so the 160 ms scale-from-.96 reads as coming from the button.
   Done here because every page loads this module and the menus toggle plain `hidden`. */
const TRIGGERS: Record<string, string> = {
  routemenu: 'routes-open', walkmenu: 'walk-open', allmenu: 'all-open',
  't-goto': 't-goto-open', 't-events-menu': 't-events-open',
};
function pointAtTrigger(menu: HTMLElement) {
  const own = document.getElementById(TRIGGERS[menu.id] ?? '');
  // The top-bar button is not on screen on a phone: use the one in the tab bar, or the pill that opened it.
  const fallbacks = [...Array.from(document.querySelectorAll<HTMLElement>(`[data-opens="${menu.id}"]`)),
    ...(menu.id === 'routemenu' ? [document.getElementById('gm-routes'), ...Array.from(document.querySelectorAll<HTMLElement>('[data-opens="allmenu"]'))] : [])];
  const trigger = [own, ...fallbacks].find((b): b is HTMLElement => !!b && b.getClientRects().length > 0);
  if (!trigger) return;
  const m = menu.getBoundingClientRect(), t = trigger.getBoundingClientRect();
  menu.style.setProperty('--origin-x', `${Math.round(t.left + t.width / 2 - m.left)}px`);
  menu.style.setProperty('--origin-y', `${Math.round(t.top + t.height / 2 - m.top)}px`);
}
if (typeof MutationObserver !== 'undefined') {
  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target as HTMLElement;
      if (!el.hidden && el.id in TRIGGERS) pointAtTrigger(el);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
}
