import { hant, onLocale, t } from './locale.ts';
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
  { href: '/', zh: '圣经世界', en: 'The globe', noteZh: '1,443 个事件，落在地球上', noteEn: '1,443 events, on the globe' },
  { href: '/structures.html', zh: '照着经文的尺寸', en: 'Measures', noteZh: '按经文所记的尺寸做的卡片', noteEn: 'Cards built to the measurements the text states' },
  { href: '/tabernacle.html', zh: '走进会幕', en: 'Walk into the tabernacle', noteZh: '出埃及记 26–27', noteEn: 'Exodus 26–27' },
  { href: '/temple.html', zh: '走进圣殿', en: 'Walk into the temple', noteZh: '列王纪上 6–7；历代志下 3–4', noteEn: '1 Kings 6–7; 2 Chronicles 3–4' },
  { href: '/ark.html', zh: '走进方舟', en: 'Walk into the ark', noteZh: '创世记 6–8', noteEn: 'Genesis 6–8' },
  { href: '/plan.html', zh: '完整的计划', en: 'The whole plan', noteZh: '56 个单元，逐项的进度', noteEn: '56 units, counted' },
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
  live: { zh: '可以走进去', en: 'Open' },
  building: { zh: '开发中', en: 'In development' },
  planned: { zh: '计划中', en: 'Planned' },
};

function render(menu: HTMLElement) {
  const counts = { live: 0, building: 0, planned: 0 };
  for (const u of UNITS) counts[stateOf(u)]++;

  const rows = UNITS.map((u) => {
    const s = stateOf(u);
    const href = u.walk ? u.walk.href : `/plan.html#u-${u.id}`;
    const what = u.walk
      ? t(u.walk.en, u.walk.zh)
      : t(u.plan?.[0]?.en ?? 'Planned', u.plan?.[0]?.zh ?? '计划中');
    return `<li class="am-row am-${s}"><a href="${href}">
      <span class="am-name">${t(u.en, hant(u.zh))}</span>
      <span class="am-what">${what}</span>
      <span class="am-state">${t(STATE_TEXT[s].en, STATE_TEXT[s].zh)}</span>
    </a></li>`;
  }).join('');

  menu.innerHTML = `<div class="am-sheet" role="dialog" aria-modal="true" aria-label="${t('Everything in this app', '这个应用的全部')}">
    <header>
      <h2>${t('Everything in this app', '这个应用的全部')}</h2>
      <button type="button" id="all-close" aria-label="${t('Close', '关闭')}">✕</button>
    </header>
    <p class="am-lede">${t(
      `The whole Bible is the target: all 1,443 events in three dimensions. That is 56 units — ${counts.live} you can open today, ${counts.building} in development, ${counts.planned} still on paper. Nothing here is hidden until it is finished.`,
      `目标是整本圣经：1,443 个事件全部做成三维。共 56 个单元 — 现在可以打开的 ${counts.live} 个，开发中 ${counts.building} 个，还在纸上的 ${counts.planned} 个。没有做完的也照样列在这里。`)}</p>
    <h3>${t('Open now', '现在就可以进去')}</h3>
    <ul class="am-built">${BUILT.map((b) => `<li><a href="${b.href}">
      <span class="am-name">${t(b.en, hant(b.zh))}</span>
      <span class="am-what">${t(b.noteEn, hant(b.noteZh))}</span>
    </a></li>`).join('')}</ul>
    <h3>${t('The whole plan, unit by unit', '全部计划，逐个单元')}</h3>
    <ol class="am-units">${rows}</ol>
  </div>`;
  menu.querySelector('#all-close')?.addEventListener('click', close);
}

let open = false;
function close() {
  const menu = $('allmenu'), button = $('all-open');
  if (!menu) return;
  menu.hidden = true;
  open = false;
  button?.setAttribute('aria-expanded', 'false');
  (button as HTMLElement | null)?.focus();
}

/** Wires 全部. Every page calls this. */
export function installSiteMenu() {
  const menu = $('allmenu'), button = $('all-open');
  if (!menu || !button) return;
  let drawn = false;
  const draw = () => { render(menu); drawn = true; };
  button.addEventListener('click', () => {
    if (open) return close();
    if (!drawn) draw();
    menu.hidden = false;
    open = true;
    button.setAttribute('aria-expanded', 'true');
    (menu.querySelector('#all-close') as HTMLElement | null)?.focus();
  });
  menu.addEventListener('click', (e) => { if (e.target === menu) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) close(); });
  // The sheet is built from the plan and the plan is bilingual: redraw it, or
  // a reader who switches language while it is open gets the other one.
  onLocale(() => { if (drawn) draw(); });
}
