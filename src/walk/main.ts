import * as THREE from 'three';
import { desertSky } from './textures.ts';
import './style.css';
import { buildTabernacle } from './tabernacle.ts';
import { Walker } from './controls.ts';
import { Tour, TOUR } from './tour.ts';
import { applyStatic, bindSwitch, onLocale, t } from '../locale.ts';

const CUBIT = 0.445;   // the common cubit; the card feed carries the argument

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

// The scene was lit by RoomEnvironment — an indoor studio — which is why the
// gold read as showroom metal under softboxes rather than as beaten plate in
// desert sun, and why the sky was a flat fill. A generated desert sky does
// both jobs: it is the background AND the light that bounces off everything.
const sky = desertSky();
scene.background = sky;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(sky).texture;
// The sky is bright, and at full strength it washed the sand to concrete and
// flattened every form: ambient light from all directions is exactly the light
// that removes shading. It fills; the sun models.
scene.environmentIntensity = 0.42;
// Haze thickens toward the horizon so distance reads as distance.
// Far enough out that the court itself stays crisp; haze belongs to the
// desert beyond it, not to a wall forty metres away.
scene.fog = new THREE.Fog(0xc8cec6, 150, 460);

const camera = new THREE.PerspectiveCamera(
  72, Math.max(1, innerWidth) / Math.max(1, innerHeight), 0.05, 400);

// Mid-morning rather than noon: a sun overhead casts no shadows worth having,
// and shadow is most of what makes a shape read as solid.
const sun = new THREE.DirectionalLight(0xfff2d6, 3.4);
sun.position.set(50, 30, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
// Sized to the built area rather than the terrain: the court is 100x50 cubits,
// so a frustum any wider spends its resolution on empty sand.
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 130;
// Without a bias, a shadow map at this scale stripes every lit surface.
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 3;
scene.add(sun);
// Sky above, sand below — the bounce off a desert floor is warm and strong,
// and it is what keeps the shaded sides of the boards from going black.
// The environment already supplies sky and bounce, so the hemisphere is only
// a floor under the shadows to keep them from going black.
scene.add(new THREE.HemisphereLight(0x9fc2e0, 0xb9a377, 0.25));

const { group, colliders, counts } = buildTabernacle(CUBIT);
group.traverse((o) => {
  if (!(o as THREE.Mesh).isMesh) return;
  o.receiveShadow = true;
  o.castShadow = o.userData.noCast !== true;
});
scene.add(group);

const walker = new Walker(camera, canvas, colliders);
scene.add(walker.yaw);
// Standing outside the eastern gate, looking in — the way anyone approaching
// the tabernacle would have come to it. A yaw of +PI/2 turns the camera's own
// -Z toward -X, which is where the court lies; -PI/2 faces the empty desert.
walker.moveTo(CUBIT * 62, 0, Math.PI / 2);

// ── where you are ─────────────────────────────────────────────────────────
// Named zones rather than coordinates, each carrying the verse that defines it.
const ZONES: { test: (x: number, z: number) => boolean; zh: string; en: string; ref: string }[] = [
  { zh: '至圣所', en: 'The most holy place', ref: '出 26:33–34 · Ex 26:33–34',
    test: (x) => x < CUBIT * -20 },
  { zh: '圣所 · 灯台 · 陈设饼桌 · 香坛',
    en: 'The holy place — lampstand, table, incense',
    ref: '出 25:23–40、26:35、30:1–6 · Ex 25:23–40, 26:35, 30:1–6',
    test: (x) => x < CUBIT * 0 },
  { zh: '会幕内', en: 'Inside the tent', ref: '出 26:15 · Ex 26:15',
    test: (x) => x < CUBIT * 10 },
  { zh: '院内 · 铜坛旁', en: 'The court — by the bronze altar', ref: '出 27:1 · Ex 27:1',
    test: (x) => x > CUBIT * 20 && x < CUBIT * 36 },
  { zh: '院子内', en: 'Inside the court', ref: '出 27:18 · Ex 27:18',
    test: (x, z) => Math.abs(x) < CUBIT * 50 && Math.abs(z) < CUBIT * 25 },
];

const gateEl = document.getElementById('gate')!;
const hud = document.getElementById('hud')!;
const whereEl = document.getElementById('where')!;
const verseEl = document.getElementById('verse')!;

const TALLY: [number, string, string, string][] = [
  [counts.courtPillars, 'pillars of the court', '院子的柱子', 'Ex 27:10–16'],
  [counts.boards, 'boards', '竖板', 'Ex 26:18–25'],
  [counts.sockets, 'silver sockets', '带卯的座', 'Ex 26:19'],
  [counts.bars, 'bars', '横闩', 'Ex 26:26–27'],
  [counts.clasps, 'gold clasps', '金钩', 'Ex 26:6'],
  [counts.curtains, 'curtains', '幔子', 'Ex 26:1'],
];
function renderTally() {
  document.getElementById('tally')!.innerHTML = TALLY
    .map(([n, en, zh, ref]) => `<div><b>${n}</b><span>${t(en, zh)}</span><i>${ref}</i></div>`)
    .join('');
}

// A phone has neither pointer lock nor a keyboard, so the enter button cannot
// ask for a lock — it would fail silently and leave the visitor at the gate for
// good. On touch the gate simply opens and the two-thumb controls take over.
const touchOnly = Walker.touchOnly;
if (touchOnly) {
  document.getElementById('enter')!.innerHTML =
    '<span data-en="Walk it myself" data-zh="自己走">Walk it myself</span>';
  document.querySelector('.keys')!.innerHTML =
    '<span data-en="drag the left half to walk" data-zh="左半屏拖动走路"></span>' +
    '<span data-en="drag the right half to look" data-zh="右半屏拖动转头"></span>';
}
document.getElementById('enter')!.addEventListener('click', () => {
  if (touchOnly) walker.enterTouch(); else canvas.click();
});
walker.onLockChange = (locked) => {
  gateEl.classList.toggle('hidden', locked);
  hud.hidden = !locked;
};

// The plan's viewBox maps the court's own extent, so the dot's position is the
// walker's actual position and not an approximation drawn to look right.
const you = document.getElementById('p-you')!;
const PLAN = { x0: 1, y0: 1, w: 130, h: 72 };
const COURT_L = CUBIT * 100, COURT_W = CUBIT * 50;

// ── the guided walk ───────────────────────────────────────────────────────
const tour = new Tour(CUBIT);
const tourBar = document.getElementById('tour-bar')!;
const tourFill = tourBar.querySelector('i') as HTMLElement;
const tourToggle = document.getElementById('tour-toggle')!;

let tourCaption: { zh: string; en: string; ref: string } | null = null;

tour.onStop = (stop, i, total) => {
  tourCaption = stop;
  whereEl.textContent = t(stop.en, stop.zh);
  verseEl.textContent = stop.ref;
  tourFill.style.width = `${((i + 1) / total * 100).toFixed(0)}%`;
  lastZone = '__tour';           // keep the zone readout from overwriting this
};
tour.onEnd = () => {
  tourCaption = null;
  tourToggle.hidden = true;
  tourBar.hidden = true;
  lastZone = '';                 // hand the readout back to the zones
};

// Any reach for the controls ends the tour. A guided walk that fights the
// visitor for the camera is worse than no guided walk.
walker.onManualInput = () => { if (tour.running) endTour(); };

function startTour() {
  gateEl.classList.add('hidden');
  hud.hidden = false;
  tourBar.hidden = false;
  tourToggle.hidden = false;
  tourToggle.textContent = '❚❚';
  const first = TOUR[0]!;
  walker.moveTo(first.x * CUBIT, first.z * CUBIT, first.yaw);
  tour.start(walker.pose);
}
function endTour() {
  tour.stop();
  tourCaption = null;
  tourToggle.hidden = true;
  tourBar.hidden = true;
  lastZone = '';
}
document.getElementById('tour')!.addEventListener('click', startTour);
tourToggle.addEventListener('click', () => {
  if (tour.running) { tour.stop(); tourToggle.textContent = '▶'; }
  else { tour.start(walker.pose); tourToggle.textContent = '❚❚'; }
});

let lastZone = '';
function updateHud() {
  const { x, z } = walker.position;
  // While the tour is speaking, the caption is its own; the plan still tracks.
  if (tourCaption) {
    const u0 = (x + COURT_L / 2) / COURT_L;
    const v0 = (z + COURT_W / 2) / COURT_W;
    you.setAttribute('cx', String(PLAN.x0 + PLAN.w * Math.max(-0.12, Math.min(1.12, u0))));
    you.setAttribute('cy', String(PLAN.y0 + PLAN.h * Math.max(-0.12, Math.min(1.12, v0))));
    return;
  }

  // World +x is the court's eastern end, which the plan draws on the right.
  const u = (x + COURT_L / 2) / COURT_L;
  const v = (z + COURT_W / 2) / COURT_W;
  you.setAttribute('cx', String(PLAN.x0 + PLAN.w * Math.max(-0.12, Math.min(1.12, u))));
  you.setAttribute('cy', String(PLAN.y0 + PLAN.h * Math.max(-0.12, Math.min(1.12, v))));

  const zone = ZONES.find((zn) => zn.test(x, z));
  const name = zone ? t(zone.en, zone.zh) : t('Outside the court', '院外');
  if (name === lastZone) return;
  lastZone = name;
  whereEl.textContent = name;
  verseEl.textContent = zone?.ref ?? '';
}

// ── loop ──────────────────────────────────────────────────────────────────
function fit() {
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe(document.body);
fit();

// ── language ──────────────────────────────────────────────────────────────
bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
function applyLocale() {
  applyStatic();
  renderTally();
  lastZone = '';                       // force the zone readout to re-render
  if (tourCaption) {
    whereEl.textContent = t(tourCaption.en, tourCaption.zh);
    verseEl.textContent = tourCaption.ref;
  }
}
onLocale(applyLocale);
applyLocale();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const pose = tour.update(dt);
  // The tour owns the camera while it runs; otherwise the walker does.
  if (pose) walker.setPose(pose); else walker.update(dt);
  updateHud();
  renderer.render(scene, camera);
});

if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__walk = {
    scene, camera, renderer, walker, counts, colliders, CUBIT, updateHud,
    tour, startTour, endTour, TOUR,
    /** Renders one frame at an arbitrary size and returns it, so the scene can
     *  be inspected where the page is not being painted. */
    snapshot(w = 1400, h = 900) {
      const prev = { w: renderer.domElement.width, h: renderer.domElement.height };
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      walker.yaw.updateMatrixWorld(true);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setSize(prev.w, prev.h, false);
      return url;
    },
  };
}
