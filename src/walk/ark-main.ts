import * as THREE from 'three';
import { desertSky } from './textures.ts';
import './style.css';
import { buildArk } from './ark.ts';
import { Walker } from './controls.ts';
import { bindInputUi } from './hud-input.ts';
import { Tour } from './tour.ts';
import { ARK_TOUR } from './ark-tour.ts';
import { applyStatic, bindSwitch, hant, onLocale, t } from '../locale.ts';
import { installUpdateChecker } from '../updates.ts';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { materialsReady as loadMaterials } from './materials.ts';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const CUBIT = 0.445;   // the common cubit; the card feed carries the argument

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.info.autoReset = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

// Same desert sky as the tabernacle walk: background AND the light that
// bounces off the ashlar. No HDRI file, nothing to license.
const sky = desertSky();
scene.background = sky;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(sky).texture;
scene.environmentIntensity = 0.7;
// Haze belongs to the hills beyond the platform, not to the house forty
// metres away.
scene.fog = new THREE.Fog(0xc8c2b4, 320, 1100);

const camera = new THREE.PerspectiveCamera(
  65, Math.max(1, innerWidth) / Math.max(1, innerHeight), 0.04, 1200);

const sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
// The sun stands in the SOUTH. Both walks put east at +x and north at +z, and
// the sun was at +z — north — which at the latitude of Jerusalem (31.8°N) it
// never is: the sun's declination never exceeds 23.4°, so the midday sun is
// south of the zenith every day of the year. It also left the whole south
// side in shade, which is the side the molten sea, the lavers and the door of
// the side chambers are on.
sun.position.set(90, 70, -80);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
// The house is 60 × 20 × 30 cubits (~27 × 9 × 13 m); the court furnishings
// spread wider. Frustum sized to the built area, not the hills.
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 40;
sun.shadow.camera.far = 320;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.006;
sun.shadow.radius = 3;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x9fc2e0, 0xb9a377, 0.28));

const { group, colliders, platforms, counts, anchors, floorY, ready } = buildArk(CUBIT);
group.traverse((o) => {
  if (!(o as THREE.Mesh).isMesh) return;
  o.receiveShadow = true;
  o.castShadow = o.userData.noCast !== true;
});
scene.add(group);

// Three decks under a pitched hull, lit by a slot one cubit high: the lower
// two would be black. These fills are an educational choice, and the Evidence
// dialog says so — they are not a claim that the ark was lit.
RectAreaLightUniformsLib.init();
for (const deck of [0, 10, 20]) {
  for (const x of [-120, -60, 0, 60, 120]) {
    const fill = new THREE.RectAreaLight(0xffe0bd, deck === 20 ? 1.5 : 2.8, CUBIT * 40, CUBIT * 30);
    fill.position.set(CUBIT * x, CUBIT * (deck + 8.6), 0);
    fill.rotation.x = -Math.PI / 2;
    scene.add(fill);
  }
}

const materialsReady = loadMaterials();
const sceneReady = Promise.all([materialsReady, ready]).then(([ok]) => {
  document.body.dataset.materials = ok ? 'ready' : 'fallback';
  renderer.shadowMap.needsUpdate = true;
  document.body.dataset.reflections = 'ready';
  return ok;
});
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
void ready.then(() => { renderer.shadowMap.needsUpdate = true; });
pmrem.dispose();

const walker = new Walker(camera, canvas, colliders, { platforms, floorY });
scene.add(walker.yaw);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 }));
composer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, 1, 1);
ao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1.3, thickness: 0.2, distanceFallOff: 1, samples: 8 });
ao.updatePdMaterial({ radius: 4, rings: 2, samples: 8 });
ao.blendIntensity = 0.85;
composer.addPass(ao);
composer.addPass(new OutputPass());

// At the foot of the ramp, looking up at the door in the side — the one
// moment in the account when a person could have walked in: after 6:16, and
// before 7:16 shuts it. One place, named once: the free walk starts here and
// every handover from the tour comes back here.
const SPAWN = { x: 0, z: -CUBIT * 62, facing: Math.PI };
const spawn = () => walker.moveTo(SPAWN.x, SPAWN.z, SPAWN.facing);
spawn();

// Where the visitor is. On a hull three hundred cubits long, "which deck" is
// most of the answer, so height decides it before the plan does.
const ZONES: { test: (x: number, z: number, y: number) => boolean; zh: string; en: string; ref: string }[] = [
  { zh: '上层', en: 'The third deck', ref: '创 6:16 · Gen 6:16',
    test: (x, z, y) => y > CUBIT * 17 && Math.abs(x) < CUBIT * 150 && Math.abs(z) < CUBIT * 25 },
  { zh: '中层', en: 'The second deck', ref: '创 6:16 · Gen 6:16',
    test: (x, z, y) => y > CUBIT * 7 && Math.abs(x) < CUBIT * 150 && Math.abs(z) < CUBIT * 25 },
  { zh: '下层', en: 'The lower deck', ref: '创 6:16 · Gen 6:16',
    test: (x, z, y) => y > -CUBIT && Math.abs(x) < CUBIT * 150 && Math.abs(z) < CUBIT * 25 },
  { zh: '门口', en: 'At the door', ref: '创 6:16 · Gen 6:16',
    test: (x, z) => Math.abs(x) < CUBIT * 12 && z < -CUBIT * 24 && z > -CUBIT * 70 },
  { zh: '方舟之外', en: 'Outside the ark', ref: '创 6:14–16 · Gen 6:14–16',
    test: () => true },
];

const gateEl = document.getElementById('gate')!;
const film = document.querySelector<HTMLVideoElement>('#gate-film video');
function setGate(visible: boolean) {
  gateEl.classList.toggle('hidden', !visible);
  if (!film) return;
  if (visible) void film.play().catch(() => { /* no clip on this gate yet */ });
  else film.pause();
}
const hud = document.getElementById('hud')!;
const whereEl = document.getElementById('where')!;
const verseEl = document.getElementById('verse')!;

// Every line is a number the text gives, or a count the builder made while
// building.
const TALLY: [number, string, string, string][] = [
  [counts.lengthCubits, 'cubits long', '肘长', 'Gen 6:15'],
  [counts.widthCubits, 'cubits broad', '肘宽', 'Gen 6:15'],
  [counts.heightCubits, 'cubits high', '肘高', 'Gen 6:15'],
  [counts.decks, 'decks: lower, second, third', '层：上、中、下', 'Gen 6:16'],
  [counts.doors, 'door, in the side', '门，开在旁边', 'Gen 6:16'],
  [counts.lightCubits, 'cubit of light opening', '肘高的透光处', 'Gen 6:16'],
  [counts.rooms, 'rooms built along the decks', '舱内的隔间', 'Gen 6:14'],
  // The numbers the text counts, drawn on one kind each. There is no species
  // list in the account, so there is none here.
  [counts.clean, 'of a clean kind — seven males, seven females', '洁净的一类：七公七母', 'Gen 7:2'],
  [counts.unclean, 'of a kind not clean — one male, one female', '不洁净的一类：一公一母', 'Gen 7:2'],
  [counts.birds, 'fowls of the air, seven and seven', '空中的飞鸟：七公七母', 'Gen 7:3'],
  [counts.people, 'people: Noah, his wife, three sons, three wives', '八个人：挪亚夫妇与三子三媳', 'Gen 7:13'],
  [counts.ribs, 'ribs of timber on the hull', '船身的肋木', '—'],
  [counts.trees, 'trees standing on the plain', '平原上的树', '—'],
];
function renderTally() {
  document.getElementById('tally')!.innerHTML = TALLY
    .map(([n, en, zh, ref]) => `<div><b>${n}</b><span>${t(en, zh)}</span><i>${hant(ref)}</i></div>`)
    .join('');
}

// The stick, the run and jump buttons and the key legend — all of them
// following the walker's observed input mode rather than a guess at the
// device. See src/walk/hud-input.ts.
bindInputUi(walker);
const touchOnly = Walker.touchOnly;
document.getElementById('enter')!.addEventListener('click', () => {
  // A device with no pointer lock cannot be asked for one: it fails silently
  // and the visitor never gets past the gate.
  if (touchOnly || walker.inputMode === 'touch') walker.enterTouch(); else canvas.click();
});
setGate(true);

walker.onLockChange = (locked) => {
  setGate(!locked);
  hud.hidden = !locked;
};

// Plan viewBox maps the hull (300 × 50 cubits plus margin).
const you = document.getElementById('p-you')!;
const PLAN = { x0: 1, y0: 1, w: 130, h: 72 };
const COURT_L = CUBIT * 330, COURT_W = CUBIT * 76;

const tour = new Tour(CUBIT, ARK_TOUR);
const tourBar = document.getElementById('tour-bar')!;
const tourFill = tourBar.querySelector('i') as HTMLElement;
const tourToggle = document.getElementById('tour-toggle')!;
const stopSelect = document.getElementById('tour-stop') as HTMLSelectElement;
const veilFade = document.getElementById('view-transition')!;

let tourCaption: { zh: string; en: string; ref: string } | null = null;

tour.onStop = (stop, i, total) => {
  tourCaption = stop;
  whereEl.textContent = t(stop.en, stop.zh);
  verseEl.textContent = stop.ref;
  tourFill.style.width = `${((i + 1) / total * 100).toFixed(0)}%`;
  lastZone = '__tour';
  stopSelect.value = String(i);
};
tour.onEnd = () => {
  tourToggle.textContent = '↺';
  tourToggle.setAttribute('aria-label', t('Replay the tour', '重新导览'));
};

walker.onManualInput = () => { if (tour.running || tour.paused) endTour(); };

function startTour() {
  setGate(false);
  hud.hidden = false;
  tourBar.hidden = false;
  tourToggle.hidden = false;
  tourToggle.textContent = '❚❚';
  tourToggle.setAttribute('aria-label', t('Pause tour', '暂停导览'));
  const first = ARK_TOUR[0]!;
  walker.moveTo(first.x * CUBIT, first.z * CUBIT,
    Math.atan2(-(first.at.x - first.x), -(first.at.z - first.z)));
  tour.start(walker.pose);
}
/** A tour can end in the air, or over the side of the mountain. Handing the
 *  visitor back a camera in either place is not a handover: the owner took
 *  control at the closing stop, was set down on the north slope under a scarp
 *  too steep to climb, and was stuck there. The rule is now about the ground
 *  under them rather than about which stop the tour happened to end on —
 *  anyone who is not standing on the paved summit is returned to the gate. */
function landIfAirborne() {
  // Aboard is fine, and so is standing on the ground outside; in the air over
  // the hull is not.
  const { x, y, z } = walker.position;
  const aboard = Math.abs(x) < CUBIT * 150 && Math.abs(z) < CUBIT * 25 && y < CUBIT * 26;
  if (aboard || y < 3) return;
  spawn();
}
function endTour() {
  tour.stop();
  landIfAirborne();
  tourCaption = null;
  tourToggle.hidden = true;
  tourBar.hidden = true;
  lastZone = '';
}
document.getElementById('tour')!.addEventListener('click', startTour);
tourToggle.addEventListener('click', () => {
  if (tour.running) {
    tour.pause(); tourToggle.textContent = '▶';
    tourToggle.setAttribute('aria-label', t('Resume tour', '继续导览'));
  } else if (tour.paused) {
    tour.resume(); tourToggle.textContent = '❚❚';
    tourToggle.setAttribute('aria-label', t('Pause tour', '暂停导览'));
  } else startTour();
});
function inspectStop(index: number) {
  // Jumping to a stop is a tour action: the gate must not sit over the view.
  setGate(false);
  hud.hidden = false;
  tourBar.hidden = false;
  tour.pause(); walker.setPose(tour.goTo(index)); tourToggle.hidden = false;
  tourToggle.textContent = '▶';
  tourToggle.setAttribute('aria-label', t('Resume tour', '继续导览'));
}
stopSelect.addEventListener('change', () => inspectStop(Number(stopSelect.value)));
document.getElementById('tour-prev')!.addEventListener('click', () => inspectStop(tour.currentIndex - 1));
document.getElementById('tour-next')!.addEventListener('click', () => inspectStop(tour.currentIndex + 1));
function exitWalk() { endTour(); walker.exit(); setGate(true); hud.hidden = true; }
document.getElementById('walk-exit')!.addEventListener('click', exitWalk);
addEventListener('keydown', (e) => { if (e.code === 'Escape') exitWalk(); });
document.getElementById('model-info')!.addEventListener('click', () => {
  if (tour.running) { tour.pause(); tourToggle.textContent = '▶'; }
  (document.getElementById('assumptions') as HTMLDialogElement).showModal();
});

let lastZone = '';
function updateHud() {
  const { x, z } = walker.position;
  const u = (x + COURT_L / 2) / COURT_L;
  const v = (z + COURT_W / 2) / COURT_W;
  you.setAttribute('cx', String(PLAN.x0 + PLAN.w * Math.max(-0.12, Math.min(1.12, u))));
  you.setAttribute('cy', String(PLAN.y0 + PLAN.h * Math.max(-0.12, Math.min(1.12, v))));
  if (tourCaption) return;

  const zone = ZONES.find((zn) => zn.test(x, z, walker.position.y - 1.65));
  const name = zone ? t(zone.en, zone.zh) : t('In the court', '院内');
  if (name === lastZone) return;
  lastZone = name;
  whereEl.textContent = name;
  verseEl.textContent = zone?.ref ?? '';
}

function fit() {
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  camera.aspect = w / h;
  camera.fov = w < h ? 84 : 65;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  ao.setSize(Math.ceil(w * 0.6), Math.ceil(h * 0.6));
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe(document.body);
fit();

bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
installUpdateChecker();
function applyLocale() {
  applyStatic();
  renderTally();
  stopSelect.replaceChildren(...ARK_TOUR.map((s, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${i + 1} / ${ARK_TOUR.length} · ${t(s.en, s.zh)}`;
    return option;
  }));
  if (tour.currentIndex >= 0) stopSelect.value = String(tour.currentIndex);
  document.getElementById('tour-prev')!.setAttribute('aria-label', t('Previous stop', '上一站'));
  document.getElementById('tour-next')!.setAttribute('aria-label', t('Next stop', '下一站'));
  lastZone = '';
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
  // A paused tour still owns the camera. Without this the walker's own
  // physics ran under a posed camera, and every stop above head height fell
  // out of the sky the moment the tour was paused — which is also how the
  // aerial views were first photographed from the floor.
  if (pose) walker.setPose(pose); else if (!tour.paused) walker.update(dt);
  veilFade.style.opacity = String(tour.fade);
  updateHud();
  renderer.info.reset();
  composer.render();
});

if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__ark = {
    scene, camera, renderer, walker, counts, colliders, platforms, anchors, CUBIT, updateHud,
    tour, startTour, endTour, TOUR: ARK_TOUR, ready, materialsReady: sceneReady, inspectStop,
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
