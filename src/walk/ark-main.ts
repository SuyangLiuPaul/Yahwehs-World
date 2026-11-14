import * as THREE from 'three';
import { desertSky } from './textures.ts';
import './style.css';
import { buildArk, type ArkAtmosphere } from './ark.ts';
import { Walker } from './controls.ts';
import { bindInputUi } from './hud-input.ts';
import { Tour } from './tour.ts';
import { ARK_TOUR } from './ark-tour.ts';
import { applyStatic, bindSwitch, hant, onLocale, t } from '../locale.ts';
import { installUpdateChecker } from '../updates.ts';
import { installSiteMenu, loadingStep, loadingSteps, pageReady } from '../site-shell.ts';
import { installWalkMeasures } from '../structures/walk-measures.ts';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { materialsReady as loadMaterials } from './materials.ts';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

let cubit = 0.445; // the common cubit; interactive card handles comparison

function makeStormSky(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1f2b3a');
  grad.addColorStop(0.38, '#364659');
  grad.addColorStop(0.55, '#596979');
  grad.addColorStop(0.68, '#46525f');
  grad.addColorStop(1.0, '#2a3036');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.info.autoReset = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const dawnSky = desertSky();
let stormSky: THREE.CanvasTexture | null = null;
let stormEnv: THREE.Texture | null = null;
const pmrem = new THREE.PMREMGenerator(renderer);
const dawnEnv = pmrem.fromEquirectangular(dawnSky).texture;
pmrem.dispose();

scene.background = dawnSky;
scene.environment = dawnEnv;
scene.environmentIntensity = 0.72;
scene.fog = new THREE.Fog(0xc8c2b4, 320, 1100);

const camera = new THREE.PerspectiveCamera(
  65, Math.max(1, innerWidth) / Math.max(1, innerHeight), 0.04, 1200,
);

const sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
sun.position.set(92, 74, -84);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -95;
sun.shadow.camera.right = 95;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.camera.near = 35;
sun.shadow.camera.far = 340;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.006;
sun.shadow.radius = 3;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0xa3c6e4, 0xb59c6f, 0.34);
scene.add(hemi);

let ark = buildArk(cubit);
const attachShadows = (root: THREE.Object3D) => {
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    o.receiveShadow = true;
    o.castShadow = o.userData.noCast !== true;
  });
};
attachShadows(ark.group);
scene.add(ark.group);

// Soft overhead educational fills so the deep timber lower decks read clearly.
RectAreaLightUniformsLib.init();
const fillsGroup = new THREE.Group();
scene.add(fillsGroup);
const rebuildFills = (c: number) => {
  fillsGroup.clear();
  for (const deck of [0, 10, 20]) {
    for (const x of [-80, 0, 80]) {
      const fill = new THREE.RectAreaLight(0xffe0bd, deck === 20 ? 0.85 : 1.35, c * 58, c * 28);
      fill.position.set(c * x, c * (deck + 8.6), 0);
      fill.rotation.x = -Math.PI / 2;
      fillsGroup.add(fill);
    }
  }
};
rebuildFills(cubit);

const materialsReady = loadMaterials();
const sceneReady = Promise.all([materialsReady, ark.ready]).then(([ok]) => {
  document.body.dataset.materials = ok ? 'ready' : 'fallback';
  renderer.shadowMap.needsUpdate = true;
  document.body.dataset.reflections = 'ready';
  return ok;
});

loadingSteps(3);
loadingStep();
let handover: 'waiting' | 'ready' | 'done' = 'waiting';
void sceneReady.then(() => {
  loadingStep();
  handover = 'ready';
  renderTally();
});
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
void ark.ready.then(() => {
  renderer.shadowMap.needsUpdate = true;
});

const floorY = (x: number, z: number) => ark.floorY(x, z);
const walker = new Walker(camera, canvas, ark.colliders, {
  platforms: ark.platforms,
  floorY,
});
scene.add(walker.yaw);

const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 }),
);
composer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, 1, 1);
ao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1.3, thickness: 0.2, distanceFallOff: 1, samples: 8 });
ao.updatePdMaterial({ radius: 4, rings: 2, samples: 8 });
ao.blendIntensity = 0.82;
composer.addPass(ao);
composer.addPass(new OutputPass());

const SPAWN = { x: 0, z: -62, facing: Math.PI };
const spawn = () => walker.moveTo(SPAWN.x * cubit, SPAWN.z * cubit, SPAWN.facing, 1);
spawn();

const ZONES: { test: (x: number, z: number, y: number) => boolean; zh: string; en: string; ref: string }[] = [
  {
    zh: '上层', en: 'The third deck', ref: '创 6:16 · Gen 6:16',
    test: (x, z, y) => y > cubit * 17 && Math.abs(x) < cubit * 150 && Math.abs(z) < cubit * 25,
  },
  {
    zh: '中层', en: 'The second deck', ref: '创 6:16 · Gen 6:16',
    test: (x, z, y) => y > cubit * 7 && Math.abs(x) < cubit * 150 && Math.abs(z) < cubit * 25,
  },
  {
    zh: '下层', en: 'The lower deck', ref: '创 6:16 · Gen 6:16',
    test: (x, z, y) => y > -cubit && Math.abs(x) < cubit * 150 && Math.abs(z) < cubit * 25,
  },
  {
    zh: '门口', en: 'At the door', ref: '创 6:16 · Gen 6:16',
    test: (x, z) => Math.abs(x) < cubit * 12 && z < -cubit * 24 && z > -cubit * 70,
  },
  {
    zh: '方舟之外', en: 'Outside the ark', ref: '创 6:14–16 · Gen 6:14–16',
    test: () => true,
  },
];

const gateEl = document.getElementById('gate')!;
const film = document.querySelector<HTMLVideoElement>('#gate-film video');
function setGate(visible: boolean) {
  gateEl.classList.toggle('hidden', !visible);
  if (!film) return;
  if (visible) void film.play().catch(() => { /* no clip on gate */ });
  else film.pause();
}
const hud = document.getElementById('hud')!;
const whereEl = document.getElementById('where')!;
const verseEl = document.getElementById('verse')!;
const atmoBtn = document.getElementById('atmo-toggle');

const tally = (): [number, string, string, string][] => [
  [ark.counts.lengthCubits, 'cubits long', '肘长', 'Gen 6:15'],
  [ark.counts.widthCubits, 'cubits broad', '肘宽', 'Gen 6:15'],
  [ark.counts.heightCubits, 'cubits high', '肘高', 'Gen 6:15'],
  [ark.counts.decks, 'decks: lower, second, third', '层：上、中、下', 'Gen 6:16'],
  [ark.counts.doors, 'door, in the side', '门，开在旁边', 'Gen 6:16'],
  [ark.counts.lightCubits, 'cubit of light opening', '肘高的透光处', 'Gen 6:16'],
  [ark.counts.rooms, 'rooms built along the decks', '舱内的隔间', 'Gen 6:14'],
  [ark.counts.clean, 'of a clean kind — seven males, seven females', '洁净的一类：七公七母', 'Gen 7:2'],
  [ark.counts.unclean, 'of a kind not clean — one male, one female', '不洁净的一类：一公一母', 'Gen 7:2'],
  [ark.counts.birds, 'fowls of the air, seven and seven', '空中的飞鸟：七公七母', 'Gen 7:3'],
  [ark.counts.people, 'people: Noah, his wife, three sons, three wives', '八个人：挪亚夫妇与三子三媳', 'Gen 7:13'],
  [ark.counts.ribs, 'ribs of timber on the hull', '船身的肋木', '—'],
  [ark.counts.trees, 'trees standing on the plain', '平原上的树', '—'],
];

function renderTally() {
  const el = document.getElementById('tally');
  if (!el) return;
  el.innerHTML = tally()
    .map(([n, en, zh, ref]) => `<div><b>${n}</b><span>${t(en, zh)}</span><i>${hant(ref)}</i></div>`)
    .join('');
}

bindInputUi(walker);
const touchOnly = Walker.touchOnly;
function enterWalk() {
  if (touchOnly || walker.inputMode === 'touch') walker.enterTouch();
  else canvas.click();
}
document.getElementById('enter')!.addEventListener('click', enterWalk);
setGate(true);

walker.onLockChange = (locked) => {
  setGate(!locked);
  hud.hidden = !locked;
};

// Plan viewBox (132 x 74): X spans [-165C, +165C] -> [1, 131]; Z spans [+38C, -66C] -> [1, 73]
const you = document.getElementById('p-you')!;
const PLAN = { x0: 1, y0: 1, w: 130, h: 72 };

const tour = new Tour(cubit, ARK_TOUR);
const tourBar = document.getElementById('tour-bar')!;
const tourFill = tourBar.querySelector('i') as HTMLElement;
const tourToggle = document.getElementById('tour-toggle')!;
const stopSelect = document.getElementById('tour-stop') as HTMLSelectElement;
const veilFade = document.getElementById('view-transition')!;

let tourCaption: { zh: string; en: string; ref: string } | null = null;
let lastZone = '';

tour.onStop = (stop, i, total) => {
  tourCaption = stop;
  whereEl.textContent = t(stop.en, stop.zh);
  verseEl.textContent = hant(stop.ref);
  tourFill.style.width = `${(((i + 1) / total) * 100).toFixed(0)}%`;
  lastZone = '__tour';
  stopSelect.value = String(i);
};
tour.onEnd = () => {
  tourToggle.textContent = '↺';
  tourToggle.setAttribute('aria-label', t('Replay the tour', '重新导览'));
};

walker.onManualInput = () => {
  if (tour.running || tour.paused) endTour();
};

function startTour() {
  setGate(false);
  hud.hidden = false;
  tourBar.hidden = false;
  tourToggle.hidden = false;
  tourToggle.textContent = '❚❚';
  tourToggle.setAttribute('aria-label', t('Pause tour', '暂停导览'));
  const first = ARK_TOUR[0]!;
  walker.moveTo(
    first.x * cubit,
    first.z * cubit,
    Math.atan2(-(first.at.x - first.x), -(first.at.z - first.z)),
  );
  tour.start(walker.pose);
}

function landIfAirborne() {
  const { x, y, z } = walker.position;
  const aboard = Math.abs(x) < cubit * 150 && Math.abs(z) < cubit * 25 && y < cubit * 26;
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
    tour.pause();
    tourToggle.textContent = '▶';
    tourToggle.setAttribute('aria-label', t('Resume tour', '继续导览'));
  } else if (tour.paused) {
    tour.resume();
    tourToggle.textContent = '❚❚';
    tourToggle.setAttribute('aria-label', t('Pause tour', '暂停导览'));
  } else {
    startTour();
  }
});

function inspectStop(index: number) {
  setGate(false);
  hud.hidden = false;
  tourBar.hidden = false;
  tour.pause();
  walker.setPose(tour.goTo(index));
  tourToggle.hidden = false;
  tourToggle.textContent = '▶';
  tourToggle.setAttribute('aria-label', t('Resume tour', '继续导览'));
}

stopSelect.addEventListener('change', () => inspectStop(Number(stopSelect.value)));
document.getElementById('tour-prev')!.addEventListener('click', () => inspectStop(tour.currentIndex - 1));
document.getElementById('tour-next')!.addEventListener('click', () => inspectStop(tour.currentIndex + 1));

function exitWalk() {
  endTour();
  walker.exit();
  setGate(true);
  hud.hidden = true;
}
document.getElementById('walk-exit')!.addEventListener('click', exitWalk);

addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || document.querySelector('dialog[open]')) return;
  exitWalk();
});

document.getElementById('model-info')!.addEventListener('click', () => {
  if (tour.running) {
    tour.pause();
    tourToggle.textContent = '▶';
  }
  (document.getElementById('assumptions') as HTMLDialogElement).showModal();
});

function syncAtmoLabel() {
  if (!atmoBtn) return;
  const isStorm = ark.atmosphere === 'storm';
  atmoBtn.textContent = isStorm ? t('Dawn', '晨曦') : t('Storm', '风雨');
  atmoBtn.setAttribute('aria-pressed', String(isStorm));
}

function setAtmosphere(mode: ArkAtmosphere) {
  ark.setAtmosphere(mode);
  const isStorm = mode === 'storm';
  if (isStorm && !stormSky) {
    stormSky = makeStormSky();
    const p = new THREE.PMREMGenerator(renderer);
    stormEnv = p.fromEquirectangular(stormSky).texture;
    p.dispose();
  }
  scene.background = isStorm ? stormSky! : dawnSky;
  scene.environment = isStorm ? stormEnv! : dawnEnv;
  scene.environmentIntensity = isStorm ? 0.36 : 0.72;
  scene.fog = new THREE.Fog(isStorm ? 0x3b4856 : 0xc8c2b4, isStorm ? 140 : 320, isStorm ? 620 : 1100);
  sun.color.setHex(isStorm ? 0x8da4be : 0xfff0d6);
  sun.intensity = isStorm ? 0.65 : 2.5;
  hemi.color.setHex(isStorm ? 0x5c738f : 0xa3c6e4);
  hemi.groundColor.setHex(isStorm ? 0x2e3336 : 0xb59c6f);
  hemi.intensity = isStorm ? 0.25 : 0.34;
  renderer.toneMappingExposure = isStorm ? 0.92 : 1.08;
  syncAtmoLabel();
}

atmoBtn?.addEventListener('click', () => {
  setAtmosphere(ark.atmosphere === 'dawn' ? 'storm' : 'dawn');
});

function setCubit(nextCubit: number) {
  if (!Number.isFinite(nextCubit) || nextCubit <= 0.1 || Math.abs(nextCubit - cubit) < 1e-4) return;
  const cx = walker.position.x / cubit;
  const cz = walker.position.z / cubit;
  const facing = walker.pose.yaw;
  cubit = nextCubit;
  scene.remove(ark.group);
  ark = buildArk(cubit);
  attachShadows(ark.group);
  scene.add(ark.group);
  rebuildFills(cubit);
  walker.setColliders(ark.colliders, ark.platforms);
  walker.moveTo(cx * cubit, cz * cubit, facing);
  void ark.ready.then(() => {
    renderer.shadowMap.needsUpdate = true;
    renderTally();
  });
  Object.assign(arkExport, {
    counts: ark.counts,
    colliders: ark.colliders,
    platforms: ark.platforms,
    anchors: ark.anchors,
    CUBIT: cubit,
    ready: ark.ready,
  });
}

installWalkMeasures({
  walk: 'ark',
  dialog: document.getElementById('measures-panel') as HTMLDialogElement,
  openers: [document.getElementById('measures'), document.getElementById('gate-measures')],
  beforeOpen: () => {
    if (tour.running) {
      tour.pause();
      tourToggle.textContent = '▶';
    }
  },
});

function updateHud() {
  const { x, z } = walker.position;
  const u = (x / cubit + 165) / 330;
  const v = (38 - z / cubit) / 104;
  you.setAttribute('cx', String(PLAN.x0 + PLAN.w * Math.max(-0.08, Math.min(1.08, u))));
  you.setAttribute('cy', String(PLAN.y0 + PLAN.h * Math.max(-0.08, Math.min(1.08, v))));
  if (tourCaption) return;

  const zone = ZONES.find((zn) => zn.test(x, z, walker.position.y - 1.65));
  const name = zone ? t(zone.en, zone.zh) : t('In the ark', '方舟内');
  if (name === lastZone) return;
  lastZone = name;
  whereEl.textContent = name;
  verseEl.textContent = zone ? hant(zone.ref) : '';
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
installSiteMenu();

function applyLocale() {
  applyStatic();
  renderTally();
  syncAtmoLabel();
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
    verseEl.textContent = hant(tourCaption.ref);
  }
}
onLocale(applyLocale);
applyLocale();

const clock = new THREE.Clock();
const measuresDialog = document.getElementById('measures-panel') as HTMLDialogElement | null;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (handover === 'done' && (document.hidden || Boolean(measuresDialog?.open))) return;
  const pose = tour.update(dt);
  if (pose) walker.setPose(pose);
  else if (!tour.paused) walker.update(dt);
  ark.update(dt);
  veilFade.style.opacity = String(tour.fade);
  updateHud();
  renderer.info.reset();
  composer.render();
  if (handover === 'ready') {
    handover = 'done';
    pageReady();
  }
});

const arkExport: Record<string, unknown> = {
  scene,
  camera,
  renderer,
  walker,
  walk: walker,
  counts: ark.counts,
  colliders: ark.colliders,
  platforms: ark.platforms,
  floorY,
  anchors: ark.anchors,
  CUBIT: cubit,
  updateHud,
  tour,
  startTour,
  endTour,
  enterWalk,
  enter: enterWalk,
  exitWalk,
  TOUR: ARK_TOUR,
  ready: ark.ready,
  materialsReady: sceneReady,
  inspectStop,
  setAtmosphere,
  setCubit,
  snapshot(w = 1400, h = 900) {
    const prev = { w: renderer.domElement.width, h: renderer.domElement.height };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    walker.yaw.updateMatrixWorld(true);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    renderer.setSize(prev.w, prev.h, false);
    return url;
  },
};

(globalThis as unknown as Record<string, unknown>).__ark = arkExport;
