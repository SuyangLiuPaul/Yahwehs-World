import './plan.css';
import { applyStatic, bindSwitch, hant, onLocale, t } from './locale.ts';
import { installUpdateChecker } from './updates.ts';
import { installSiteMenu, loadingSteps, loadingStep, pageReady } from './site-shell.ts';
import { UNITS, unitFor, type Depth, type Status, type Unit } from './plan-units.ts';
import { journeySpan } from './bridges.ts';
import { measuresHref, STRUCTURES } from './structures/specs.ts';
import { refKey } from './books.ts';
import type { Journey } from './routes.ts';

// The plan, as a page rather than as a promise.
//
// The owner's instruction is that every event in the canon should reach 3D,
// however hard it is. So the target on this page is not "coverage" in the
// abstract: it is that each of the 56 units has a three-dimensional scene of
// its own — a building to walk into, or the event standing where it happened.
// Two of them do. The page counts the rest rather than describing them.
//
// Everything counted here is counted from the payloads the app already ships:
// which unit each of the 1,443 events falls in, how many of them the text
// locates, which journeys' own cited verses fall inside a unit, which
// structures' measurement verses do. The only authored parts are the units
// themselves (src/plan-units.ts) and what is planned but not built — and the
// planned things are drawn as dashed and say "under development", because a
// plan that looks like a feature list is a lie told in CSS.

interface RawEvent { id: string; s: number; e: number; p: unknown[]; ref: string; refZh: string }

const $ = (id: string) => document.getElementById(id)!;

const DEPTHS: { key: Depth; zh: string; en: string; zhWhat: string; enWhat: string }[] = [
  { key: 'verse', zh: '经文', en: 'Passage', zhWhat: '记载、摘要，以及年代的依据。1,443 个事件全都有。', enWhat: 'The passage, its summary and the basis for its date. All 1,443 have it.' },
  { key: 'map', zh: '地图', en: 'On the map', zhWhat: '事件发生的地点，落在地球上。只在经文指明地点时才有。', enWhat: 'The place, on the globe — only where the text names one.' },
  { key: 'route', zh: '路线', en: 'Route', zhWhat: '一站一站画在地形上的行程，每站注明出处经文。', enWhat: 'A journey across the terrain, every stop citing its verse.' },
  { key: 'measure', zh: '尺寸', en: 'Measures', zhWhat: '照经文所记的尺寸做的卡片。', enWhat: 'A card built to the measurements the text states.' },
  { key: 'scene', zh: '3D 场景', en: '3D scene', zhWhat: '事件本身的三维场景，站在事情发生的地方，按记载所描述的建。', enWhat: 'The event itself in three dimensions, standing where it happens, built from what the passage describes.' },
  { key: 'walk', zh: '走进去', en: 'Walk in', zhWhat: '可以自己走进去的建筑。', enWhat: 'A building you can walk into on your own feet.' },
];

const STATUS: Record<Status, { zh: string; en: string }> = {
  live: { zh: '已上线', en: 'Live' },
  building: { zh: '开发中', en: 'Under development' },
  planned: { zh: '计划中', en: 'Planned' },
};

type Row = {
  unit: Unit;
  events: number;
  placed: number;
  journeys: Journey[];
  structures: { id: string; zh: string; en: string }[];
  /** The span this unit turned out to cover, in both languages: the first
   *  event's citation opening and the last one's ending. Read off the data,
   *  so a unit's printed passage can never disagree with its contents. */
  span: { en: [string, string]; zh: [string, string] } | null;
  /** The first citation in the unit, for the link back to the globe. */
  ref: string | null;
};

const rows: Row[] = [];
let total = 0;

const chip = (cls: string, label: string, note: string, href?: string) => {
  const inner = `${label}${note ? ` <em>${note}</em>` : ''}`;
  return href
    ? `<a class="chip ${cls}" href="${href}">${inner}</a>`
    : `<span class="chip ${cls}">${inner}</span>`;
};

function render() {
  $('plan-title').textContent = t('The whole plan', '完整的计划');
  $('plan-lede').innerHTML = t(
    'The aim is that every event in the canon can be seen in three dimensions — a building to walk into, or the event standing where it happened. This page is the whole of it, in the order the canon is read, cut into units. Each unit shows how deep it goes today and what its 3D would be built from; dashed means it does not exist yet. Where the text describes nothing measurable, the entry says that instead of promising a building.',
    '目标是圣经里的每一个事件都能用三维看见——可以走进去的建筑，或者站在事情发生的地方。这一页就是全部，按圣经的次序分成单元。每个单元写明它现在做到哪一层，以及它的 3D 会照什么来建；虚线框的是还没做出来的。经文没有可量之物的，就写明这一点，而不是许一座建筑。');

  $('ladder').innerHTML = DEPTHS.map((d) => `
    <div class="rung">
      <b>${t(d.en, d.zh)}</b>
      <span>${t(d.enWhat, d.zhWhat)}</span>
    </div>`).join('');

  // What fraction of the canon's events sit in a unit that has reached each
  // depth. Counted, never claimed.
  const reach = { walk: 0, route: 0, map: 0, verse: 0 };
  for (const r of rows) {
    // Exclusive buckets, counted per EVENT and not per unit: a unit with one
    // located place does not make all of its events mapped, and saying it did
    // turned 55% into 84% on the first draft of this bar.
    if (r.unit.walk) reach.walk += r.events;
    else if (r.journeys.length) reach.route += r.events;
    else { reach.map += r.placed; reach.verse += r.events - r.placed; }
  }
  const pc = (n: number) => `${((n / Math.max(1, total)) * 100).toFixed(0)}%`;
  $('bar').innerHTML = (['walk', 'route', 'map', 'verse'] as const)
    .map((k2) => `<i class="b-${k2}" style="width:${pc(reach[k2])}"></i>`).join('');
  // The target, counted: a unit has its own 3D when you can walk into it.
  const own3d = rows.filter((r) => r.unit.walk).length;
  const building = rows.filter((r) => (r.unit.plan ?? []).some((q) => q.status === 'building')).length;
  const planned = UNITS.length - own3d - building;
  $('tally-line').textContent = t(
    `Target: all ${total.toLocaleString()} events in 3D. ${UNITS.length} units — ${own3d} have a 3D scene of their own, ${building} in development, ${planned} planned. Today: walk-in ${pc(reach.walk)} of events · route ${pc(reach.route)} · mapped ${pc(reach.map)} · passage only ${pc(reach.verse)}`,
    `目标：${total.toLocaleString()} 个事件全部做成 3D。${UNITS.length} 个单元——${own3d} 个已有自己的 3D 场景，${building} 个开发中，${planned} 个计划中。目前：可走进的事件 ${pc(reach.walk)} · 有路线 ${pc(reach.route)} · 有地点 ${pc(reach.map)} · 只有经文 ${pc(reach.verse)}`);

  $('units').innerHTML = rows.map((r) => {
    const chips: string[] = [];
    const first = r.ref;
    chips.push(chip('live', t('Passage', '经文'), t(`${r.events} events`, `${r.events} 个事件`),
      first ? `/#ref=${encodeURIComponent(first)}` : '/'));
    if (r.placed) {
      chips.push(chip('live', t('On the map', '地图'),
        t(`${r.placed} located`, `${r.placed} 处有地点`),
        first ? `/#ref=${encodeURIComponent(first)}` : '/'));
    }
    for (const jr of r.journeys) {
      chips.push(chip('live', t('Route', '路线'), t(jr.en, jr.zh), `/#journey=${jr.id}`));
    }
    for (const st of r.structures) {
      chips.push(chip('live', t('Measures', '尺寸'), t(st.en, st.zh), measuresHref(st.id)));
    }
    if (r.unit.walk) {
      chips.push(chip('walk live', t('Walk in', '走进去'), t(r.unit.walk.en, r.unit.walk.zh), r.unit.walk.href));
    }
    for (const p of r.unit.plan ?? []) {
      const depth = DEPTHS.find((d) => d.key === p.depth)!;
      chips.push(chip(p.status, `${t(depth.en, depth.zh)} · ${t(STATUS[p.status].en, STATUS[p.status].zh)}`,
        t(p.en, p.zh)));
    }
    return `
      <article class="unit" id="u-${r.unit.id}">
        <h2>${t(r.unit.en, r.unit.zh)}</h2>
        <p class="where">${hant(passageOf(r))}</p>
        <p class="counts"><b>${r.events}</b>${t('events', '个事件')}</p>
        <div class="chips">${chips.join('')}</div>
      </article>`;
  }).join('');

  $('plan-note').innerHTML = t(
    'The counts on this page are computed from the same payloads the rest of the site uses: each event is assigned to the unit its opening verse falls in, a route is listed under a unit when the verses its own stops cite fall inside it, and a measurement card when the verse it is built from does. Nothing here is a hand-kept list that can drift out of date — if a journey is added, it appears.',
    '这一页的数字是从本站其它页面用的同一份数据算出来的：每个事件按它起始的经节归入所属单元；一条路线只有在它各站所引的经节落在该单元之内时才列在那里；尺寸卡同理。这里没有手工维护的清单，不会跟数据脱节——加一条路线，它就会出现。');
  applyStatic();
}

/** "Genesis 1:1 … Genesis 2:25", from the unit's own first and last events. */
const opening = (ref: string) => ref.split('–')[0]!.trim();
const ending = (ref: string) => { const p = ref.split('–'); return (p[p.length - 1] ?? ref).trim(); };
function passageOf(r: Row): string {
  if (!r.span) return '';
  const [a, b] = t(r.span.en, r.span.zh);
  return a === b ? a : `${a} – ${b}`;
}

async function load() {
  const [{ events }, { journeys }] = await Promise.all([
    fetch('/data/events.json').then((r) => r.json() as Promise<{ events: RawEvent[] }>),
    fetch('/data/journeys.json').then((r) => r.json() as Promise<{ journeys: Journey[] }>),
  ]);
  total = events.length;

  const byUnit = new Map<string, Row>();
  for (const u of UNITS) byUnit.set(u.id, { unit: u, events: 0, placed: 0, journeys: [], structures: [], span: null, ref: null });

  let unassigned = 0;
  for (const ev of events) {
    const u = unitFor(ev.s);
    if (!u) { unassigned++; continue; }
    const row = byUnit.get(u.id)!;
    row.events++;
    if (Array.isArray(ev.p) && ev.p.length) row.placed++;
    if (!row.span) {
      row.ref = ev.ref;
      row.span = { en: [opening(ev.ref), ending(ev.ref)], zh: [opening(ev.refZh), ending(ev.refZh)] };
    } else {
      row.span.en[1] = ending(ev.ref);
      row.span.zh[1] = ending(ev.refZh);
    }
  }
  // An event that belongs to no unit is a hole in the plan, and the page says
  // so rather than quietly showing a smaller total.
  if (unassigned) {
    const warn = document.createElement('p');
    warn.className = 'where';
    warn.textContent = `${unassigned} events are outside every unit.`;
    $('plan').prepend(warn);
  }

  for (const jr of journeys) {
    const [a] = journeySpan(jr);
    const u = unitFor(a);
    if (u) byUnit.get(u.id)!.journeys.push(jr);
  }
  for (const st of STRUCTURES) {
    const key = refKey(st.ref ?? '');
    const u = key === null ? null : unitFor(key);
    if (u) byUnit.get(u.id)!.structures.push({ id: st.id, zh: st.zh, en: st.en });
  }

  rows.push(...UNITS.map((u) => byUnit.get(u.id)!));
  loadingStep();
  render();
  // The counts come out of the events payload, which is three quarters of a
  // megabyte: until it lands this page is a heading and nothing else.
  pageReady();
}

bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
installUpdateChecker();
installSiteMenu();
loadingSteps(2);
loadingStep();
onLocale(() => { if (rows.length) render(); });
void load();

// The cards no walk holds yet — New Jerusalem, measured in Revelation 21:16
// with nowhere to walk into. Their chips link here by hash (see measuresHref in
// specs.ts), so this page is where that card is read until its walk exists.
//
// Loaded on demand, not with the page. The panel renders its previews with
// three.js, and this is the one page in the app that is otherwise text: making
// every reader of the plan download a 3D engine for a card most of them will
// not open is a cost with nothing on the other side of it.
{
  let installed = false;
  const wantsMeasures = () => /^#measures(=|$)/.test(location.hash);
  const install = async () => {
    if (installed) return;
    installed = true;
    const [{ installMeasures }, { homelessStructures }] = await Promise.all([
      import('./structures/panel.ts'),
      import('./structures/specs.ts'),
    ]);
    // installMeasures reads the hash itself, so the card asked for opens as
    // soon as the module lands — whether the reader arrived on that link or
    // clicked the chip a moment ago.
    installMeasures({
      cards: homelessStructures(),
      dialog: document.getElementById('measures-panel') as HTMLDialogElement,
      openers: [],
    });
  };
  if (wantsMeasures()) void install();
  addEventListener('hashchange', () => { if (wantsMeasures()) void install(); });
}
