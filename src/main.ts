import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { paintBasemap } from './basemap.ts';
import { createGlobe, createLighting, GLOBE_RADIUS, lonLatToVec3 } from './globe.ts';
import { Markers } from './markers.ts';
import { bookName, endOfBook, bookOf } from './books.ts';
import { precisionOf, precisionStyle } from './theme.ts';
import type { GeoJson, Place, PlacesBundle } from './types.ts';

type Locale = 'zh' | 'en';
let locale: Locale = 'zh';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const T = {
  loading:   { zh: '正在绘制世界…', en: 'Drawing the world…' },
  places:    { zh: (n: number) => `${n} 处地名`, en: (n: number) => `${n} places` },
  through:   { zh: '读到', en: 'Through' },
  firstIn:   { zh: '首次出现', en: 'First named in' },
  modernName:{ zh: '今名', en: 'Modern' },
  precision: { zh: '定位依据', en: 'Located by' },
  confidence:{ zh: '考据强度', en: 'Identification' },
  mentions:  { zh: '经文提及', en: 'Mentions' },
  refsTitle: { zh: '出现于', en: 'Appears in' },
  disputed:  { zh: (n: number) => `${n} 种考据并存`, en: (n: number) => `${n} rival identifications` },
  settled:   { zh: '考据一致', en: 'Undisputed' },
  times:     { zh: (n: number) => `${n} 次`, en: (n: number) => `${n}×` },
  andMore:   { zh: (n: number) => `…另有 ${n} 处`, en: (n: number) => `…and ${n} more` },
};

// ── data ──────────────────────────────────────────────────────────────────
const j = <T,>(u: string) => fetch(u).then((r) => {
  if (!r.ok) throw new Error(`${u} → ${r.status}`);
  return r.json() as Promise<T>;
});

const [bundle, land, coastline, lakes, rivers] = await Promise.all([
  j<PlacesBundle>('/data/places.json'),
  j<GeoJson>('/data/ne_50m_land.geojson'),
  j<GeoJson>('/data/ne_50m_coastline.geojson'),
  j<GeoJson>('/data/ne_50m_lakes.geojson'),
  j<GeoJson>('/data/ne_50m_rivers_lake_centerlines.geojson'),
]);

// ── scene ─────────────────────────────────────────────────────────────────
const canvas = $<HTMLCanvasElement>('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

// A page that first loads at zero size — a background tab, a hidden iframe,
// some PWA launch paths — makes innerWidth/innerHeight 0. Feeding 0/0 to the
// camera writes NaN through the projection matrix, and nothing renders ever
// again, even after the page is shown. So every size read goes through here.
const viewport = () => ({
  w: Math.max(1, innerWidth),
  h: Math.max(1, innerHeight),
  real: innerWidth > 0 && innerHeight > 0,
});

const camera = new THREE.PerspectiveCamera(42, viewport().w / viewport().h, 1, 4000);
// Opens looking at the Levant rather than the mid-Atlantic: the map's subject
// should be on screen before the user touches anything.
camera.position.copy(lonLatToVec3(35, 31, 300));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.42;
controls.minDistance = GLOBE_RADIUS * 1.08;
controls.maxDistance = GLOBE_RADIUS * 6;
controls.enablePan = false;
controls.zoomSpeed = 0.7;

createLighting(scene);
const globe = createGlobe(paintBasemap({ land, coastline, lakes, rivers }));
scene.add(globe);

const markers = new Markers(bundle.places);
globe.add(markers.mesh);

// A ring that snaps to the selected place — cheaper and clearer than
// re-colouring an instance, and it survives the timeline hiding things.
const selectionRing = new THREE.Mesh(
  new THREE.TorusGeometry(2.1, 0.16, 8, 40),
  new THREE.MeshBasicMaterial({ color: 0xe8c55a, transparent: true, opacity: 0.95 }),
);
selectionRing.visible = false;
globe.add(selectionRing);

// ── interaction ───────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = -1;
let selected: Place | null = null;

function pick(ev: PointerEvent): number {
  pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  for (const hit of raycaster.intersectObject(markers.mesh)) {
    const i = hit.instanceId;
    if (i !== undefined && markers.isVisible(i)) return i;
  }
  return -1;
}

canvas.addEventListener('pointermove', (ev) => {
  hovered = pick(ev);
  canvas.classList.toggle('over-place', hovered >= 0);
});

// Distinguishes a click from the end of a drag, so orbiting the globe past a
// marker does not fling the panel open.
let downAt = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (ev) => { downAt = { x: ev.clientX, y: ev.clientY }; });
canvas.addEventListener('pointerup', (ev) => {
  if (Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 5) return;
  const i = pick(ev);
  if (i >= 0) select(bundle.places[i]!); else closePanel();
});

function select(p: Place) {
  selected = p;
  const pos = lonLatToVec3(p.lon, p.lat, 0.6);
  selectionRing.position.copy(pos);
  selectionRing.lookAt(0, 0, 0);
  selectionRing.visible = true;
  renderPanel();
}

function closePanel() {
  selected = null;
  selectionRing.visible = false;
  $('panel').hidden = true;
}
$('panel-close').addEventListener('click', closePanel);

function renderPanel() {
  const p = selected;
  if (!p) return;
  $('panel').hidden = false;
  $('p-name').textContent = p.name;
  $('p-modern').textContent = p.modern && p.modern !== p.name
    ? `${T.modernName[locale]} · ${p.modern}` : '';

  const prec = precisionOf(p.precision);
  const badges = [`<span class="badge" style="color:${prec.color}">${locale === 'zh' ? prec.labelZh : prec.label}</span>`];
  badges.push(p.rivals > 1
    ? `<span class="badge disputed">${T.disputed[locale](p.rivals)}</span>`
    : `<span class="badge" style="color:#7f9c7a">${T.settled[locale]}</span>`);
  $('p-badges').innerHTML = badges.join('');

  const first = p.first !== null ? bookName(bookOf(p.first), locale) : '—';
  $('p-meta').innerHTML = `
    <dt>${T.mentions[locale]}</dt><dd>${T.times[locale](p.verseCount)}</dd>
    <dt>${T.firstIn[locale]}</dt><dd>${first}</dd>
    <dt>${T.precision[locale]}</dt><dd>${p.precisionNote || prec.label}</dd>
    <dt>${T.confidence[locale]}</dt><dd>${p.confidence}</dd>`;

  $('p-refs-title').textContent = T.refsTitle[locale];
  const shown = p.readable.slice(0, 24);
  const rest = p.verseCount - shown.length;
  $('p-refs').textContent = shown.join(' · ') + (rest > 0 ? `  ${T.andMore[locale](rest)}` : '');
}

// ── timeline ──────────────────────────────────────────────────────────────
const range = $<HTMLInputElement>('t-range');

function applyCursor() {
  const book = Number(range.value);
  markers.setCursor(endOfBook(book));
  $('t-book').textContent = `${T.through[locale]} ${bookName(book, locale)}`;
  $('t-count').textContent = T.places[locale](markers.visibleCount);
  if (selected && selected.first !== null && bookOf(selected.first) > book) closePanel();
}
range.addEventListener('input', applyCursor);

// ── legend & i18n ─────────────────────────────────────────────────────────
function renderLegend() {
  $('legend').innerHTML = Object.entries(precisionStyle)
    .filter(([k]) => k !== 'unknown')
    .map(([, v]) => `<span><i style="background:${v.color}"></i>${locale === 'zh' ? v.labelZh : v.label}</span>`)
    .join('');
}

$('lang').addEventListener('click', () => {
  locale = locale === 'zh' ? 'en' : 'zh';
  $('lang').textContent = locale === 'zh' ? 'EN' : '中文';
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  renderLegend();
  applyCursor();
  if (selected) renderPanel();
});

// ── loop ──────────────────────────────────────────────────────────────────
function fitToViewport() {
  const { w, h } = viewport();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', fitToViewport);
// Catches the transition from zero size to real size, which fires no resize
// event of its own when the page was laid out hidden from the start.
new ResizeObserver(fitToViewport).observe(document.body);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  controls.update();
  // The selection ring breathes so the eye can find it again after orbiting.
  if (selectionRing.visible) selectionRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
  renderer.render(scene, camera);
});

fitToViewport();
renderLegend();
applyCursor();
$('loading').classList.add('done');
console.info(
  `%c雅伟之界 · 圣经世界%c  ${bundle.meta.located} located / ${bundle.meta.unlocated} unlocated  ·  ${bundle.meta.source} (${bundle.meta.license})`,
  'color:#e8c55a;font-weight:600', 'color:#7d8896',
);

// Dev-only handle. Picking and camera framing are the two things that are
// tedious to verify by eye, and this makes both scriptable from the console.
// Guarded by import.meta.env.DEV, so it is dropped from a production build.
if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__globe = {
    scene, camera, controls, markers, globe, bundle,
    /** Screen-space position of a place, for synthetic pointer events. */
    screenOf(place: Place) {
      const v = lonLatToVec3(place.lon, place.lat, 0.5).applyMatrix4(globe.matrixWorld).project(camera);
      return { x: (v.x + 1) / 2 * innerWidth, y: (-v.y + 1) / 2 * innerHeight, z: v.z };
    },
    select,
    get selected() { return selected; },
  };
}
