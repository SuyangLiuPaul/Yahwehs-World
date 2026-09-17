import * as THREE from 'three';
import { desertSky } from './textures.ts';
import './style.css';
import { buildTemple } from './temple.ts';
import { Walker } from './controls.ts';
import { bindInputUi } from './hud-input.ts';
import { Tour } from './tour.ts';
import { TEMPLE_TOUR } from './temple-tour.ts';
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
scene.fog = new THREE.Fog(0xc8c2b4, 220, 900);

const camera = new THREE.PerspectiveCamera(
  65, Math.max(1, innerWidth) / Math.max(1, innerHeight), 0.04, 1200);

const sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
// The sun stands in the SOUTH. Both walks put east at +x and north at +z, and
// the sun was at +z — north — which at the latitude of Jerusalem (31.8°N) it
// never is: the sun's declination never exceeds 23.4°, so the midday sun is
// south of the zenith every day of the year. It also left the whole south
// side in shade, which is the side the molten sea, the lavers and the door of
// the side chambers are on.
sun.position.set(60, 44, -34);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
// The house is 60 × 20 × 30 cubits (~27 × 9 × 13 m); the court furnishings
// spread wider. Frustum sized to the built area, not the hills.
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 25;
sun.shadow.camera.far = 160;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.006;
sun.shadow.radius = 3;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x9fc2e0, 0xb9a377, 0.28));

const { group, colliders, platforms, floorY, counts, veilCanvas, summit } = buildTemple(CUBIT);
const ready = Promise.resolve(true);
group.traverse((o) => {
  if (!(o as THREE.Mesh).isMesh) return;
  o.receiveShadow = true;
  o.castShadow = o.userData.noCast !== true;
});
scene.add(group);

// Broad educational fill inside the hekal so the gold overlay and the
// lampstand read; disclosed in Evidence. Not a claim about divine light.
RectAreaLightUniformsLib.init();
const roomFill = new THREE.RectAreaLight(0xffe6c4, 3.2, 10, 5);
roomFill.position.set(CUBIT * 8, CUBIT * 10, 0);
roomFill.lookAt(CUBIT * 0, 0, 0);
scene.add(roomFill);

const materialsReady = loadMaterials();
const sceneReady = Promise.all([materialsReady, ready]).then(([ok]) => {
  document.body.dataset.materials = ok ? 'ready' : 'fallback';
  renderer.shadowMap.needsUpdate = true;
  const target = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const probe = new THREE.CubeCamera(0.08, 80, target);
  probe.position.set(CUBIT * 8, CUBIT * 9, 0);
  probe.update(renderer, scene);
  const bake = new THREE.PMREMGenerator(renderer);
  const room = bake.fromCubemap(target.texture);
  const materials = new Set<THREE.MeshStandardMaterial>();
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (m instanceof THREE.MeshStandardMaterial && m.name.startsWith('Interior ')) materials.add(m);
      if (m instanceof THREE.MeshStandardMaterial && m.name.includes('gold')) materials.add(m);
    }
  });
  materials.forEach((m) => { m.envMap = room.texture; m.envMapIntensity = 1.25; m.needsUpdate = true; });
  target.dispose(); bake.dispose();
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

// Inside the gate and north of the axis, looking at the porch. One place,
// named once: the free walk starts here and every handover from the tour
// comes back here.
//
// NOT on the axis, which is where it used to be. The bronze altar is twenty
// cubits square and stands in the court directly before the house, so a
// visitor set down on the centre line opens their eyes two cubits from a wall
// of bronze and sees nothing else at all. Off the corner of the altar, the
// first frame is the porch, the two pillars and the house behind them.
const SPAWN = { x: CUBIT * 64, z: CUBIT * 27, facing: Math.atan2(30, 27) };
const spawn = () => walker.moveTo(SPAWN.x, SPAWN.z, SPAWN.facing);
spawn();

// Where the visitor is, now that "where" includes how high. The first two
// entries are places the walk could not reach at all before this pass.
const ZONES: { test: (x: number, z: number, y: number) => boolean; zh: string; en: string; ref: string }[] = [
  { zh: '旁屋顶上', en: 'On the roof of the side chambers', ref: '王上 6:6、6:8 · 1 Kgs 6:6, 6:8',
    test: (_x, _z, y) => y > CUBIT * 13 },
  { zh: '铜坛上', en: 'On the bronze altar', ref: '代下 4:1；出 20:26 · 2 Chr 4:1; Ex 20:26',
    test: (x, z, y) => y > CUBIT * 8 && Math.abs(x - CUBIT * 61) < CUBIT * 12 && Math.abs(z) < CUBIT * 12 },
  { zh: '至圣所', en: 'The most holy place', ref: '王上 6:16–20 · 1 Kgs 6:16–20',
    test: (x, z) => x < CUBIT * -10 && x > CUBIT * -30 && Math.abs(z) < CUBIT * 10 },
  { zh: '圣所', en: 'The holy place', ref: '王上 6:17 · 1 Kgs 6:17',
    test: (x, z) => x < CUBIT * 30 && x >= CUBIT * -10 && Math.abs(z) < CUBIT * 10 },
  { zh: '廊', en: 'The porch', ref: '王上 6:3 · 1 Kgs 6:3',
    test: (x, z) => x >= CUBIT * 30 && x < CUBIT * 42 && Math.abs(z) < CUBIT * 10 },
  { zh: '铜坛前', en: 'By the bronze altar', ref: '代下 4:1 · 2 Chr 4:1',
    test: (x, z) => x > CUBIT * 48 && Math.abs(z) < CUBIT * 12 && Math.abs(x - CUBIT * 60) < CUBIT * 12 },
  { zh: '铜海旁', en: 'By the molten sea', ref: '王上 7:23 · 1 Kgs 7:23',
    test: (x, z) => z < CUBIT * -12 && x > CUBIT * 40 },
  { zh: '院内', en: 'In the court', ref: '王上 6:36 · 1 Kgs 6:36',
    test: (x, z) => Math.abs(x) < CUBIT * 55 && Math.abs(z) < CUBIT * 28 },
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

// Every line is a number the text gives and the builder counted while
// building. There is no "39 side chambers" here any more: 6:5–10 count
// storeys, not rooms, and a tally that says more than the verse is a claim.
const TALLY: [number, string, string, string][] = [
  [counts.pillars, 'bronze pillars', '铜柱', '1 Kgs 7:15'],
  [counts.pomegranates, 'pomegranates on the two capitals', '两柱顶的石榴', '1 Kgs 7:42'],
  [counts.oxen, 'oxen under the sea', '铜海下的牛', '1 Kgs 7:25'],
  [counts.gourds, 'gourds cast under its brim', '海边的野瓜', '1 Kgs 7:24'],
  [counts.lavers, 'lavers on wheeled bases', '盆座与盆', '1 Kgs 7:38'],
  [counts.lampstands, 'lampstands of gold', '金灯台', '1 Kgs 7:49'],
  [counts.tables, 'tables', '桌子', '2 Chr 4:8'],
  [counts.cherubim, 'cherubim in the oracle', '至圣所基路伯', '1 Kgs 6:23'],
  [counts.storeys, 'storeys of side chambers', '旁屋层数', '1 Kgs 6:6'],
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

// Plan viewBox maps the court extent (110 × 56 cubits plus margin).
const you = document.getElementById('p-you')!;
const PLAN = { x0: 1, y0: 1, w: 130, h: 72 };
const COURT_L = CUBIT * 110, COURT_W = CUBIT * 56;

const tour = new Tour(CUBIT, TEMPLE_TOUR);
const tourBar = document.getElementById('tour-bar')!;
const tourFill = tourBar.querySelector('i') as HTMLElement;
const tourToggle = document.getElementById('tour-toggle')!;
const stopSelect = document.getElementById('tour-stop') as HTMLSelectElement;
const veilFade = document.getElementById('view-transition')!;

// Crossing into the most holy place used to be a dissolve to near-black: the
// owner walked it and said it did not feel like a veil at all, which is fair —
// a black screen is what a scene change looks like, not what a curtain looks
// like. The screen now fills with the veil's own woven face (2 Chr 3:14: blue,
// purple, crimson and fine linen, with cherubim worked in it) and the weave
// swells as the camera passes through it, while the tour keeps the camera
// moving along the line rather than standing still behind a fade.
let veilDressed = false;
let veilUrl = '';
function dressVeil(fade: number) {
  if (!veilDressed) {
    veilUrl ||= veilCanvas.toDataURL('image/png');
    veilFade.style.backgroundImage = `url(${veilUrl})`;
    veilFade.style.backgroundColor = '#241c3d';
    veilDressed = true;
  }
  veilFade.style.backgroundSize = `${(170 + 190 * fade).toFixed(0)}%`;
  veilFade.style.backgroundPosition = 'center';
}
function undressVeil() {
  if (!veilDressed) return;
  veilFade.style.backgroundImage = '';
  veilFade.style.backgroundColor = '';
  veilDressed = false;
}

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
  const first = TEMPLE_TOUR[0]!;
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
function onSummit() {
  const { x, y, z } = walker.position;
  return Math.abs(x) < summit.halfX && Math.abs(z) < summit.halfZ && y < 4;
}
function landIfAirborne() {
  if (onSummit()) return;
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
  stopSelect.replaceChildren(...TEMPLE_TOUR.map((s, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${i + 1} / ${TEMPLE_TOUR.length} · ${t(s.en, s.zh)}`;
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
  const fade = tour.fade;
  veilFade.style.opacity = String(fade);
  if (fade > 0 && tour.crossing === 'veil') dressVeil(fade); else if (fade === 0) undressVeil();
  updateHud();
  renderer.info.reset();
  composer.render();
});

if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__temple = {
    scene, camera, renderer, walker, counts, colliders, platforms, floorY, CUBIT, updateHud,
    tour, startTour, endTour, TOUR: TEMPLE_TOUR, ready, materialsReady: sceneReady, inspectStop,
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
