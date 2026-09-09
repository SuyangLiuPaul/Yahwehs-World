import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { paintBasemap } from './basemap.ts';
import { createGlobe, createLighting, GLOBE_RADIUS, lonLatToVec3 } from './globe.ts';
import { Terrain } from './terrain.ts';
import { Markers } from './markers.ts';
import { bookName, bookOf } from './books.ts';
import { precisionOf, precisionStyle } from './theme.ts';
import { Route, type Journey } from './routes.ts';
import { RouteLabels } from './labels.ts';
import { applyStatic, bindSwitch, locale as currentLocale, onLocale } from './locale.ts';
import type { GeoJson, Place, PlacesBundle } from './types.ts';

type Locale = 'zh' | 'en';
let locale: Locale = currentLocale();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** A place's name in the reader's language. The English name is kept alongside
 *  rather than replaced: it is what every other Bible atlas and every English
 *  commentary calls the place, and a reader cross-referencing needs both. */
const placeName = (p: Place) => (locale === 'zh' && p.zh) ? p.zh : p.name;

const T = {
  loading:   { zh: '正在绘制世界…', en: 'Drawing the world…' },
  places:    { zh: (n: number) => `${n} 处地名`, en: (n: number) => `${n} places` },
  through:   { zh: '读到', en: 'Through' },
  atRest:    { zh: '全书 · 拖动或播放', en: 'Whole canon · scrub or play' },
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

const [bundle, journeyData, land, coastline, lakes, rivers] = await Promise.all([
  j<PlacesBundle>('/data/places.json'),
  j<{ journeys: Journey[] }>('/data/journeys.json'),
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

// Measured relief over the biblical world, fading in as the camera closes.
const terrain = new Terrain();
globe.add(terrain.mesh);

const markers = new Markers(bundle.places, bundle.events);
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
  $('p-name').textContent = placeName(p);
  // When a Chinese name is shown, the English one moves to the line below so
  // the reader can still find the place in an English reference.
  const alt = locale === 'zh' && p.zh ? p.name : '';
  const modern = p.modern && p.modern !== p.name ? `${T.modernName[locale]} · ${p.modern}` : '';
  $('p-modern').textContent = [alt, modern].filter(Boolean).join('　·　');

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

// ── routes ────────────────────────────────────────────────────────────────
// A route takes over from the verse timeline while it runs: the two answer
// different questions, and showing both at once would put a wandering camp and
// a whole canon's worth of places on screen together.
let route: Route | null = null;
let routePlaying = false;
let routeT = 0;
const routeLabels = new RouteLabels(document.body);

const routesEl = $('routes');
const rlist = $('rlist');
const rOpen = $('r-open');
const rCard = $('r-card');
const rToggle = $('r-toggle');
const rStop = $('r-stop');
const rBasis = $('r-basis');

rlist.innerHTML = journeyData.journeys.map((jr) => `
  <button class="rbtn" type="button" data-id="${jr.id}">
    <span>${jr.zh}</span><i>${jr.stopCount} 站</i>
  </button>`).join('');
setRoutesState('closed');

function setRoutesState(state: 'closed' | 'open' | 'active') {
  routesEl.dataset.state = state;
  rOpen.setAttribute('aria-expanded', String(state === 'open'));
}

function clearRoute() {
  if (route) { globe.remove(route.group); route.dispose(); route = null; }
  // Leaving a route restores the world's own up, or the globe stays tilted.
  camera.up.set(0, 1, 0);
  routePlaying = false; routeT = 0;
  routeLabels.clear();
  rCard.hidden = true;
  rBasis.textContent = '';
  rToggle.textContent = '▶';
  setRoutesState('closed');
  markers.mesh.visible = true;
  applyCursor();
}

function openRoute(id: string) {
  clearRoute();
  const jr = journeyData.journeys.find((x) => x.id === id);
  if (!jr) return;
  route = new Route(jr);
  route.setProgress(0);
  globe.add(route.group);
  routeLabels.build(route.markerObjects, locale);
  // The place field would otherwise sit under the route as visual noise.
  markers.mesh.visible = false;
  closePanel();
  rCard.hidden = false;
  setRoutesState('active');
  $('r-name').textContent = jr.zh;
  $('r-range').textContent = jr.range;
  rBasis.textContent = jr.basis;

  // The merge count is the route's own reservation; putting it in the header
  // beside the stop count means a reader meets it before the animation, not
  // after wondering why 42 stops drew 23 dots.
  const stats: [number, string, boolean][] = [
    [jr.stopCount, '站', false],
    [jr.markers.length, '个标记', false],
  ];
  if (jr.merged > 0) stats.push([jr.merged, '组共用坐标', true]);
  $('r-stats').innerHTML = stats
    .map(([n, label, caveat]) =>
      `<div${caveat ? ' class="caveat"' : ''}><b>${n}</b><span>${label}</span></div>`)
    .join('');

  frameRoute(jr);
  routeT = 0; routePlaying = true;
  rToggle.textContent = '❚❚';
  updateRouteReadout();
}

/** Moves the camera to hold the whole route.
 *
 *  Without this, opening a short journey shows nothing at all: Jesus' itinerary
 *  in Mark spans half a degree of longitude and the ark's spans six tenths, so
 *  at whatever zoom the reader happened to leave the globe on, both are a
 *  single dot. The altitude comes from the route's own angular extent. */
function frameRoute(jr: Journey) {
  const pts = jr.markers
    .filter((m) => m.lat !== null && m.lon !== null)
    .map((m) => lonLatToVec3(m.lon!, m.lat!, 0).normalize());
  if (!pts.length) return;

  const centre = pts
    .reduce((a, v) => a.add(v), new THREE.Vector3())
    .normalize();
  // Widest angle any stop sits from the centre — the route's own radius.
  const spread = Math.max(...pts.map((v) => v.angleTo(centre)));

  // The route has to fit BOTH ways, and on a portrait phone the horizontal
  // field is the binding one: a perspective camera's fov is vertical, so at
  // 375x812 the horizontal half-angle is less than half the vertical. Framing
  // to the vertical field alone left Paul's fourteen degrees of longitude
  // fitting top-to-bottom and running clean off both sides, after which the
  // camera chased the head east and west across a route it could never hold.
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const half = Math.max(0.12, Math.min(vHalf, hHalf));

  // Frame into the band that is actually visible, not into the viewport. The
  // nav sits over the top and the route card over the bottom, and in an in-app
  // browser — with its own address bar and toolbar shortening the page — those
  // two together take more than half the height. A route framed to the full
  // viewport then puts its northern stops behind the nav, which is what made a
  // stationary camera still look like it was running away.
  const band = visibleBand();
  const bandRatio = Math.max(0.25, band.height / Math.max(1, innerHeight));

  const need = Math.max(0.035, spread * 1.18);
  // The usable vertical field is only the band's share of the frame.
  const usableHalf = Math.min(half, vHalf * bandRatio);
  const alt = GLOBE_RADIUS * (Math.sin(need) / Math.tan(usableHalf) + 1 - Math.cos(need));
  const dist = THREE.MathUtils.clamp(GLOBE_RADIUS + alt, GLOBE_RADIUS * 1.09, GLOBE_RADIUS * 5);

  camera.position.copy(centre.clone().multiplyScalar(dist));

  // And aim so the route lands in the band's centre rather than the frame's.
  //
  // Camera rotation does not map to screen displacement by any simple factor —
  // it depends on the altitude and on where the route sits on the sphere, and
  // a formula derived for one produced two and a half times the intended shift
  // for another. So the correction is measured instead: nudge, project, look
  // at the residual, correct. Two passes land it inside a few pixels.
  const wantY = band.top + band.height / 2;
  const axis = new THREE.Vector3().crossVectors(centre, camera.up).normalize();
  if (axis.lengthSq() > 0.5) {
    const probe = new THREE.Vector3();
    const screenY = () => {
      camera.updateMatrixWorld(true);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      probe.copy(centre).multiplyScalar(GLOBE_RADIUS).project(camera);
      return (-probe.y + 1) / 2 * innerHeight;
    };
    // A small known rotation calibrates pixels-per-radian for this exact framing.
    const y0 = screenY();
    const PROBE = 0.02;
    camera.position.applyAxisAngle(axis, PROBE);
    const y1 = screenY();
    const pxPerRad = (y1 - y0) / PROBE;
    camera.position.applyAxisAngle(axis, -PROBE);

    if (Math.abs(pxPerRad) > 1) {
      for (let i = 0; i < 2; i++) {
        const residual = wantY - screenY();
        if (Math.abs(residual) < 2) break;
        camera.position.applyAxisAngle(axis, residual / pxPerRad);
      }
    }
  }

  controls.update();
}

/** The strip of screen the map actually shows through, measured from the DOM
 *  rather than assumed, since the chrome differs between a tab and an in-app
 *  browser and between a route being open and not. */
function visibleBand() {
  const h = Math.max(1, innerHeight);
  const navEl = document.querySelector('.sitenav') as HTMLElement | null;
  const top = navEl ? navEl.getBoundingClientRect().bottom : 0;

  let bottom = h;
  for (const el of [rCard, $('timeline')]) {
    if (!el || (el as HTMLElement).hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0) bottom = Math.min(bottom, r.top);
  }
  return { top, height: Math.max(h * 0.25, bottom - top) };
}

function updateRouteReadout() {
  if (!route) return;
  const m = route.markerAt(routeT);
  if (!m) { rStop.textContent = ''; return; }
  const label = m.stops.length > 1
    // A merged marker says so outright: these camps share one coordinate
    // because nobody knows where they were.
    ? `第 ${m.stops[0]}–${m.stops[m.stops.length - 1]} 站（${m.stops.length} 站共用一个坐标）`
    : `第 ${m.n} 站 · ${locale === 'zh' ? m.zh : m.place}`;
  rStop.textContent = label;
  $('t-ref').textContent = m.refs?.[0] ?? m.ref;
  $('t-here').textContent = m.zhAll?.length ? m.zhAll.join(' · ') : m.zh;
  $('t-count').textContent = `${route.journey.stopCount} 站 · 合并为 ${route.journey.markers.length} 个标记`;
}

rOpen.addEventListener('click', () => {
  setRoutesState(routesEl.dataset.state === 'open' ? 'closed' : 'open');
});
rlist.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.rbtn') as HTMLElement | null;
  if (!btn) return;
  openRoute(btn.dataset.id!);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && routesEl.dataset.state === 'open') setRoutesState('closed');
});
rToggle.addEventListener('click', () => {
  if (!route) return;
  if (routeT >= 1) routeT = 0;
  routePlaying = !routePlaying;
  rToggle.textContent = routePlaying ? '❚❚' : '▶';
});
$('r-clear').addEventListener('click', clearRoute);

/** Walks the route and eases the camera along with it. */
function advanceRoute(dt: number) {
  if (!route || !routePlaying) return;
  // Slow enough to read each stop; the wilderness is forty years, not a lap.
  routeT = Math.min(1, routeT + dt * 0.055);
  route.setProgress(routeT);
  updateRouteReadout();
  if (routeT >= 1) { routePlaying = false; rToggle.textContent = '▶'; }

  // The camera deliberately does NOT follow. It frames the whole route once
  // when the route opens and then stays put: a camera that chases the head
  // swings the world under the reader for the length of the journey, which is
  // motion sickness rather than travel. The entire path is on screen from the
  // first frame, the light moves along it, and panning and zooming belong to
  // whoever is looking.
}

// ── timeline ──────────────────────────────────────────────────────────────
// One step per verse that names a place: 5,582 of them, in canonical order.
// Playing it start to finish walks the entire biblical world.
const range = $<HTMLInputElement>('t-range');
range.max = String(bundle.events.length - 1);
range.value = range.max;

function applyCursor() {
  const i = Number(range.value);
  markers.setCursor(i);
  const ev = bundle.events[i];
  if (ev) {
    const book = bookName(bookOf(ev.sort), locale);
    const cv = ev.readable.replace(/^.*?(\d+:\d+.*)$/, '$1');
    $('t-ref').textContent = locale === 'zh' ? `${book} ${cv}` : ev.readable;
    $('t-here').textContent = markers.activeIndices
      .map((n) => placeName(bundle.places[n]!)).join(' · ');
  } else {
    $('t-ref').textContent = T.atRest[locale];
    $('t-here').textContent = '';
  }
  $('t-count').textContent = T.places[locale](markers.visibleCount);
  if (selected && !markers.isVisible(bundle.places.indexOf(selected))) closePanel();
}
range.addEventListener('input', () => { stop(); applyCursor(); });

// ── playback ──────────────────────────────────────────────────────────────
const VERSES_PER_SECOND = 7;
let playing = false;
let carry = 0;
const playBtn = $('t-play');

function play() {
  // Restarting from the end would show nothing move, so rewind first.
  if (Number(range.value) >= bundle.events.length - 1) { range.value = '0'; applyCursor(); }
  playing = true; carry = 0;
  playBtn.textContent = '❚❚';
  playBtn.classList.add('playing');
}
function stop() {
  playing = false;
  playBtn.textContent = '▶';
  playBtn.classList.remove('playing');
}
playBtn.addEventListener('click', () => (playing ? stop() : play()));

function advance(dt: number) {
  if (!playing) return;
  carry += dt * VERSES_PER_SECOND;
  const steps = Math.floor(carry);
  if (steps < 1) return;
  carry -= steps;
  const next = Number(range.value) + steps;
  if (next >= bundle.events.length - 1) { range.value = String(bundle.events.length - 1); stop(); }
  else range.value = String(next);
  applyCursor();
}

// The canon ranges from Tarshish to Persia, so without this half of the
// playback would happen on the far side of the globe. The camera eases toward
// whatever is being read, and yields the moment the user grabs the globe.
let userDriving = false;
controls.addEventListener('start', () => { userDriving = true; });
controls.addEventListener('end', () => { userDriving = false; });

const followTarget = new THREE.Vector3();
function follow(dt: number) {
  if (!playing || userDriving || markers.activeIndices.length === 0) return;
  let lon = 0, lat = 0;
  for (const n of markers.activeIndices) {
    lon += bundle.places[n]!.lon; lat += bundle.places[n]!.lat;
  }
  lon /= markers.activeIndices.length; lat /= markers.activeIndices.length;
  followTarget.copy(lonLatToVec3(lon, lat, camera.position.length() - GLOBE_RADIUS));
  camera.position.lerp(followTarget, Math.min(1, dt * 1.1));
}

// ── legend & i18n ─────────────────────────────────────────────────────────
function renderLegend() {
  $('legend').innerHTML = Object.entries(precisionStyle)
    .filter(([k]) => k !== 'unknown')
    .map(([, v]) => `<span><i style="background:${v.color}"></i>${locale === 'zh' ? v.labelZh : v.label}</span>`)
    .join('');
}

bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
onLocale((l) => {
  locale = l;
  applyStatic();
  renderLegend();
  applyCursor();
  if (route) routeLabels.build(route.markerObjects, locale);
  if (selected) renderPanel();
});

// ── loop ──────────────────────────────────────────────────────────────────
function fitToViewport() {
  const { w, h } = viewport();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', () => {
  fitToViewport();
  // A phone turning from portrait to landscape changes which field binds, so
  // a route framed for one orientation has to be re-framed for the other.
  if (route) frameRoute(route.journey);
});
// Catches the transition from zero size to real size, which fires no resize
// event of its own when the page was laid out hidden from the start.
new ResizeObserver(fitToViewport).observe(document.body);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.getElapsedTime();
  advance(dt);
  follow(dt);
  advanceRoute(dt);
  if (route) {
    route.faceCamera(camera.position.length(), GLOBE_RADIUS, innerHeight, camera.fov);
    route.setResolution(renderer.domElement.width, renderer.domElement.height);
    routeLabels.update(camera, globe, route.reachedIndex(routeT), innerWidth, innerHeight);
  }
  controls.update();
  terrain.update(camera.position.length(), dt);
  markers.setZoom(camera.position.length(), GLOBE_RADIUS);
  // The selection ring breathes so the eye can find it again after orbiting.
  if (selectionRing.visible) selectionRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
  renderer.render(scene, camera);
});

fitToViewport();
applyStatic();
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
    // The render loop is parked whenever the page is hidden, so playback has
    // to be drivable without rAF to be testable at all.
    advance, follow, advanceRoute, openRoute, clearRoute,
    get playing() { return playing; },
    get route() { return route; },
    /** Drives one frame of the whole route layer — path, marker sizing and
     *  labels — for inspection where rAF is parked. */
    tickRoute() {
      if (!route) return;
      controls.update(); camera.updateMatrixWorld(true); globe.updateMatrixWorld(true);
      route.faceCamera(camera.position.length(), GLOBE_RADIUS, innerHeight, camera.fov);
      route.setResolution(renderer.domElement.width, renderer.domElement.height);
      routeLabels.update(camera, globe, route.reachedIndex(routeT), innerWidth, innerHeight);
      renderer.render(scene, camera);
    },
    get routeT() { return routeT; },
    /** Renders one frame at an arbitrary size, for inspection where the page
     *  is not being painted. */
    snapshot(w = 1400, h = 900) {
      const prev = { w: renderer.domElement.width, h: renderer.domElement.height };
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      controls.update(); camera.updateMatrixWorld(true); globe.updateMatrixWorld(true);
      route?.faceCamera(camera.position.length(), GLOBE_RADIUS, h, camera.fov);
      route?.setResolution(renderer.domElement.width, renderer.domElement.height);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setSize(prev.w, prev.h, false);
      camera.aspect = Math.max(1, innerWidth) / Math.max(1, innerHeight);
      camera.updateProjectionMatrix();
      return url;
    },
  };
}
