import './style.css';
import '../structures/panel.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Walker } from './controls';
import { bindInputUi } from './hud-input';
import { buildEzekiel } from './ezekiel';
import { EZEKIEL_TOUR } from './ezekiel-tour';
import { desertSky } from './textures';
import { materialsReady } from './materials';
import { Tour } from './tour';
import { installMeasures } from '../structures/panel';
import { structuresFor } from '../structures/specs';
import { applyStatic, bindSwitch, hant, onLocale, t } from '../locale';
import { installSiteMenu, loadingStep, loadingSteps, onJourneyPick, pageReady } from '../site-shell';

const DEFAULT_CUBIT = 0.525; // Ezek 40:5 long cubit (1 cubit + 1 handbreadth)

const EZEKIEL_STRUCTURES = structuresFor('ezekiel');

interface Zone {
  id: string;
  zh: string;
  en: string;
  ref: string;
  test: (cx: number, cz: number) => boolean;
}

const ZONES: Zone[] = [
  {
    id: 'debir',
    zh: '至圣所（20×20 肘）',
    en: 'Most Holy Place · Debir',
    ref: 'Ezek 41:3–4',
    test: (cx, cz) => cx >= -136 && cx <= -115 && Math.abs(cz) <= 10,
  },
  {
    id: 'hekhal',
    zh: '圣所（棕树与二脸基路伯 · 40×20 肘）',
    en: 'Holy Place · Hekhal',
    ref: 'Ezek 41:1–2, 18–22',
    test: (cx, cz) => cx >= -115 && cx <= -69 && Math.abs(cz) <= 10,
  },
  {
    id: 'porch',
    zh: '圣殿廊子（乌兰）与十级台阶',
    en: 'Temple Porch (Ulam) & 10 Steps',
    ref: 'Ezek 40:48–49',
    test: (cx, cz) => cx >= -69 && cx <= -50 && Math.abs(cz) <= 14,
  },
  {
    id: 'altar',
    zh: '内院中心：阶梯燔祭坛',
    en: 'Inner Court · Stepped Altar',
    ref: 'Ezek 43:13–17',
    test: (cx, cz) => cx >= -22 && cx <= 22 && Math.abs(cz) <= 22,
  },
  {
    id: 'inner-court',
    zh: '内院（100×100 肘）',
    en: 'Inner Court (100 × 100 cubits)',
    ref: 'Ezek 40:47',
    test: (cx, cz) => Math.abs(cx) <= 50 && Math.abs(cz) <= 50,
  },
  {
    id: 'east-inner-gate',
    zh: '东内门楼（八级台阶）',
    en: 'East Inner Gatehouse (8 steps)',
    ref: 'Ezek 40:31–32',
    test: (cx, cz) => cx >= 50 && cx <= 110 && Math.abs(cz) <= 14,
  },
  {
    id: 'north-inner-gate',
    zh: '北内门楼（八张宰牲石桌）',
    en: 'North Inner Gatehouse (Slaughtering Tables)',
    ref: 'Ezek 40:38–43',
    test: (cx, cz) => Math.abs(cx) <= 14 && cz >= 50 && cz <= 110,
  },
  {
    id: 'south-inner-gate',
    zh: '南内门楼（八级台阶）',
    en: 'South Inner Gatehouse (8 steps)',
    ref: 'Ezek 40:28–31',
    test: (cx, cz) => Math.abs(cx) <= 14 && cz >= -110 && cz <= -50,
  },
  {
    id: 'kitchen',
    zh: '外院角室煮祭肉厨房（40×30 肘）',
    en: 'Corner Boiling Kitchen (40 × 30 cubits)',
    ref: 'Ezek 46:21–24',
    test: (cx, cz) => Math.abs(cx) >= 205 && Math.abs(cx) <= 252 && Math.abs(cz) >= 216 && Math.abs(cz) <= 252,
  },
  {
    id: 'east-outer-gate',
    zh: '东外门楼（七级台阶）',
    en: 'East Outer Gatehouse (7 steps)',
    ref: 'Ezek 40:6–22',
    test: (cx, cz) => cx >= 198 && cx <= 258 && Math.abs(cz) <= 14,
  },
  {
    id: 'north-outer-gate',
    zh: '北外门楼（七级台阶）',
    en: 'North Outer Gatehouse (7 steps)',
    ref: 'Ezek 40:20–23',
    test: (cx, cz) => Math.abs(cx) <= 14 && cz >= 198 && cz <= 258,
  },
  {
    id: 'south-outer-gate',
    zh: '南外门楼（七级台阶）',
    en: 'South Outer Gatehouse (7 steps)',
    ref: 'Ezek 40:24–27',
    test: (cx, cz) => Math.abs(cx) <= 14 && cz >= -258 && cz <= -198,
  },
  {
    id: 'river-east',
    zh: '流向东方的生命河与果树（结 47）',
    en: 'Living River Flowing East & Fruit Trees',
    ref: 'Ezek 47:1–12',
    test: (cx, cz) => cx > 256 && Math.abs(cz + 16) <= 45,
  },
  {
    id: 'outer-court',
    zh: '外院与下层铺石地（利斯帕）',
    en: 'Outer Court & Lower Pavement (Ritzpah)',
    ref: 'Ezek 40:17–19',
    test: (cx, cz) => Math.abs(cx) <= 250 && Math.abs(cz) <= 250,
  },
  {
    id: 'outside',
    zh: '圣山外围平台',
    en: 'High Mountain Approach Terrace',
    ref: 'Ezek 40:2',
    test: () => true,
  },
];

// ---------------------------------------------------------------------------
// BOOTSTRAP RENDERER & SCENE
// ---------------------------------------------------------------------------
loadingSteps(3);

const canvas = document.getElementById('stage') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const skyTex = desertSky();
scene.background = skyTex;
scene.fog = new THREE.Fog(0xd8ccb8, 280, 1250);

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromEquirectangular(skyTex);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.65;
pmrem.dispose();

loadingStep();

const hemi = new THREE.HemisphereLight('#fff2da', '#8e7452', 0.58);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#fff0d2', 2.85);
sun.position.set(160, 145, -135);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 640;
const SHADOW_BOX = 175;
sun.shadow.camera.left = -SHADOW_BOX;
sun.shadow.camera.right = SHADOW_BOX;
sun.shadow.camera.top = SHADOW_BOX;
sun.shadow.camera.bottom = -SHADOW_BOX;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);

const ezekiel = buildEzekiel(DEFAULT_CUBIT);
scene.add(ezekiel.group);

loadingStep();

const noAo: THREE.Object3D[] = [];
ezekiel.group.traverse((o) => {
  if (o.userData.noAO || (o as THREE.Sprite).isSprite) noAo.push(o);
});

const camera = new THREE.PerspectiveCamera(
  58,
  Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
  0.2,
  1600,
);
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 }),
);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
composer.addPass(new RenderPass(scene, camera));
const gtaoPass = new GTAOPass(scene, camera, 1, 1);
gtaoPass.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1.3, thickness: 0.2, distanceFallOff: 1, samples: 8 });
gtaoPass.updatePdMaterial({ radius: 4, rings: 2, samples: 8 });
gtaoPass.blendIntensity = 0.82;
if (noAo.length) {
  const origAoRender = gtaoPass.render.bind(gtaoPass);
  gtaoPass.render = (ren, writeBuf, readBuf, delta, maskActive) => {
    for (const o of noAo) o.visible = false;
    origAoRender(ren, writeBuf, readBuf, delta, maskActive);
    for (const o of noAo) o.visible = true;
  };
}
composer.addPass(gtaoPass);
composer.addPass(new OutputPass());

// Walker Rig (`scene.add(walker.yaw)`)
const walker = new Walker(camera, canvas, ezekiel.colliders, {
  platforms: ezekiel.platforms,
  floorY: (x, z) => ezekiel.floorY(x, z),
});
scene.add(walker.yaw);
bindInputUi(walker);

function spawnOutsideEast(): void {
  walker.moveTo(274 * ezekiel.CUBIT, 0, Math.PI * 0.5);
}
spawnOutsideEast();

const tour = new Tour(ezekiel.CUBIT, EZEKIEL_TOUR);

// ---------------------------------------------------------------------------
// HUD, TALLY, GATE, STOP SELECTOR, PLAN SVG, MEASURES & ASSUMPTIONS
// ---------------------------------------------------------------------------
const gateEl = document.getElementById('gate')!;
const hudEl = document.getElementById('hud')!;
const whereEl = document.getElementById('where')!;
const verseEl = document.getElementById('verse')!;
const pYouEl = document.getElementById('p-you');
const tourBarEl = document.getElementById('tour-bar')!;
const tourFillEl = tourBarEl.querySelector('i') as HTMLElement | null;
const tourToggleEl = document.getElementById('tour-toggle')!;
const stopSelectEl = document.getElementById('tour-stop') as HTMLSelectElement;
const veilFadeEl = document.getElementById('view-transition')!;
const tallyEl = document.getElementById('tally')!;

function renderTally(): void {
  const c = ezekiel.counts;
  const rows = [
    { n: c.outerGates + c.innerGates, en: 'Gatehouses (50×25c)', zh: '内外门楼 (50×25肘)', ref: 'Ezek 40:6–37' },
    { n: c.outerChambers, en: 'Ritzpah chambers', zh: '铺石地旁屋', ref: 'Ezek 40:17' },
    { n: c.kitchens, en: 'Boiling kitchens', zh: '四角煮肉院', ref: 'Ezek 46:21–24' },
    { n: c.fruitTrees, en: 'River fruit trees', zh: '生命河果树', ref: 'Ezek 47:7, 12' },
  ];
  tallyEl.innerHTML = rows
    .map((r) => `<div><b>${r.n}</b><span>${t(r.en, hant(r.zh))}</span><i>${hant(r.ref)}</i></div>`)
    .join('');
}

function populateStops(): void {
  const cur = tour.currentIndex;
  stopSelectEl.innerHTML = EZEKIEL_TOUR.map(
    (s, i) => `<option value="${i}">${i + 1}/${EZEKIEL_TOUR.length} · ${t(s.en, hant(s.zh))}</option>`,
  ).join('');
  stopSelectEl.value = String(Math.max(0, cur));
}

function setGate(visible: boolean): void {
  gateEl.classList.toggle('hidden', !visible);
}

function updateHud(): void {
  const c = ezekiel.CUBIT;
  const wp = walker.position;
  const cx = wp.x / c;
  const cz = wp.z / c;
  const cy = (wp.y - ezekiel.OUTER_Y) / c;

  if (pYouEl) {
    const px = Math.max(-270, Math.min(270, cx));
    const py = Math.max(-270, Math.min(270, -cz));
    pYouEl.setAttribute('cx', px.toFixed(1));
    pYouEl.setAttribute('cy', py.toFixed(1));
  }

  let z = ZONES[ZONES.length - 1]!;
  for (const item of ZONES) {
    if (item.test(cx, cz)) {
      z = item;
      break;
    }
  }
  if (tour.running || tour.paused) {
    const s = EZEKIEL_TOUR[tour.currentIndex] ?? EZEKIEL_TOUR[0]!;
    whereEl.textContent = t(s.en, hant(s.zh));
    verseEl.textContent = `${s.ref} · ${Math.round(cx)}c, ${Math.round(cz)}c · 1c=${c.toFixed(3)}m`;
    stopSelectEl.value = String(Math.max(0, tour.currentIndex));
    if (tourFillEl) {
      tourFillEl.style.width = `${(((tour.currentIndex + 1) / EZEKIEL_TOUR.length) * 100).toFixed(1)}%`;
    }
  } else {
    whereEl.textContent = t(z.en, hant(z.zh));
    verseEl.textContent = `${z.ref} · (${Math.round(cx)}c, ${Math.round(cz)}c, Y ${cy.toFixed(1)}c · 1c=${c.toFixed(3)}m)`;
  }
}

function startTour(): void {
  setGate(false);
  hudEl.hidden = false;
  tourBarEl.hidden = false;
  tourToggleEl.hidden = false;
  tour.start(walker.pose);
  updateHud();
}

function endTour(): void {
  tour.stop();
  tourToggleEl.hidden = true;
  tourBarEl.hidden = true;
  veilFadeEl.style.opacity = '0';
  const wp = walker.position;
  // Cap floor search below any overhead gate lintel or sanctuary roof above the walker
  const ceiling = Math.min(ezekiel.TEMPLE_Y + 4 * ezekiel.CUBIT, Math.max(ezekiel.OUTER_Y + 2 * ezekiel.CUBIT, wp.y));
  walker.moveTo(wp.x, wp.z, walker.yaw.rotation.y, ceiling);
  updateHud();
}

function exitWalk(): void {
  endTour();
  walker.exit();
  setGate(true);
  hudEl.hidden = true;
}

function inspectStop(index: number): void {
  const idx = Math.max(0, Math.min(EZEKIEL_TOUR.length - 1, index));
  setGate(false);
  hudEl.hidden = false;
  tourBarEl.hidden = false;
  tourToggleEl.hidden = false;
  tour.pause();
  const pose = tour.goTo(idx);
  walker.setPose(pose);
  tourToggleEl.textContent = '▶';
  updateHud();
  composer.render();
}

tour.onStop = () => {
  tourToggleEl.textContent = '❚❚';
  updateHud();
};
tour.onEnd = () => endTour();

walker.onLockChange = (locked) => {
  setGate(!locked);
  hudEl.hidden = !locked;
};

// Gate buttons
document.getElementById('enter')!.addEventListener('click', () => {
  setGate(false);
  hudEl.hidden = false;
  spawnOutsideEast();
  if (Walker.touchOnly || walker.inputMode === 'touch') walker.enterTouch();
  else canvas.click();
});
document.getElementById('tour')!.addEventListener('click', startTour);
document.getElementById('walk-exit')!.addEventListener('click', exitWalk);
tourToggleEl.addEventListener('click', () => {
  if (tour.running) {
    tour.pause();
    tourToggleEl.textContent = '▶';
  } else if (tour.paused) {
    tour.resume();
    tourToggleEl.textContent = '❚❚';
  }
});
document.getElementById('tour-prev')!.addEventListener('click', () => inspectStop(tour.currentIndex - 1));
document.getElementById('tour-next')!.addEventListener('click', () => inspectStop(tour.currentIndex + 1));
stopSelectEl.addEventListener('change', () => inspectStop(Number(stopSelectEl.value)));

// Interactive #plan click-to-jump
document.querySelectorAll<SVGElement>('#plan [data-jump]').forEach((el) => {
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => {
    const raw = el.dataset.jump;
    if (!raw) return;
    const [cxStr, czStr, yawStr] = raw.split(',');
    const cx = Number(cxStr);
    const cz = Number(czStr);
    const yaw = yawStr !== undefined ? Number(yawStr) : Math.PI * 0.5;
    if (tour.running || tour.paused) endTour();
    setGate(false);
    hudEl.hidden = false;
    walker.moveTo(cx * ezekiel.CUBIT, cz * ezekiel.CUBIT, yaw, ezekiel.TEMPLE_Y + 2 * ezekiel.CUBIT);
    updateHud();
  });
});

// Assumptions dialog
const assumptionsEl = document.getElementById('assumptions') as HTMLDialogElement;
document.getElementById('model-info')!.addEventListener('click', () => assumptionsEl.showModal());
document.getElementById('close-assumptions')!.addEventListener('click', () => assumptionsEl.close());

// Measures drawer + live 3D cubit rescaling
const measuresDialog = document.getElementById('measures-panel') as HTMLDialogElement;
const rescaledToCubit = (newCubit: number) => {
  const prevCubit = ezekiel.CUBIT;
  if (Math.abs(newCubit - prevCubit) < 1e-4) return;
  const pose = walker.pose;
  const cx = pose.x / prevCubit;
  const cy = (pose.y ?? 1.65) / prevCubit;
  const cz = pose.z / prevCubit;

  ezekiel.rescale(newCubit);
  renderer.shadowMap.needsUpdate = true;
  walker.setPose({
    x: cx * newCubit,
    y: cy * newCubit,
    z: cz * newCubit,
    yaw: pose.yaw,
    pitch: pose.pitch,
  });
  (tour as unknown as { cubit: number }).cubit = newCubit;
  updateHud();
};

installMeasures({
  cards: EZEKIEL_STRUCTURES,
  dialog: measuresDialog,
  openers: [document.getElementById('measures'), document.getElementById('gate-measures')],
  beforeOpen: () => {
    if (tour.running) {
      tour.pause();
      tourToggleEl.textContent = '▶';
    }
  },
});

const cubitMapByRange: Record<string, number> = {
  '0': 0.445,
  '1': 0.518,
  '2': 0.525,
};
const onCubitSlider = (ev: Event) => {
  const tgt = ev.target as HTMLInputElement | null;
  if (tgt && tgt.id === 'mp-c-range') {
    rescaledToCubit(cubitMapByRange[tgt.value] ?? DEFAULT_CUBIT);
  }
};
measuresDialog.addEventListener('input', onCubitSlider);
measuresDialog.addEventListener('change', onCubitSlider);

// Shell, Locale & Keyboard
installSiteMenu();
bindSwitch(document.querySelector<HTMLElement>('.lang-switch'));
const syncAllLocale = () => {
  applyStatic();
  renderTally();
  populateStops();
  updateHud();
};
syncAllLocale();
onLocale(syncAllLocale);
onJourneyPick((id) => {
  window.location.href = `/#journey=${id}`;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !document.querySelector('dialog[open]')) {
    if (!hudEl.hidden) exitWalk();
    return;
  }
  if (e.key.toLowerCase() === 't' && !document.querySelector('dialog[open]')) {
    if (tour.running) endTour();
    else startTour();
  }
});

function fit(): void {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  camera.aspect = w / h;
  camera.fov = w < h ? 76 : 58;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  gtaoPass.setSize(Math.ceil(w * 0.6), Math.ceil(h * 0.6));
}
window.addEventListener('resize', fit);
new ResizeObserver(fit).observe(document.body);
fit();

// Ready & frame loop
let readyDone = false;
let sceneReadyFlag = false;
const readyPromise = (async () => {
  await materialsReady();
  sceneReadyFlag = true;
  renderer.shadowMap.needsUpdate = true;
  const target = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const probe = new THREE.CubeCamera(0.2, 160, target);
  probe.position.set(-100 * ezekiel.CUBIT, ezekiel.TEMPLE_Y + 6 * ezekiel.CUBIT, 0);
  probe.update(renderer, scene);
  const bake = new THREE.PMREMGenerator(renderer);
  const room = bake.fromCubemap(target.texture);
  ezekiel.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat && mat.isMeshStandardMaterial && mat.name && mat.name.startsWith('Interior')) {
      mat.envMap = room.texture;
      mat.envMapIntensity = 1.2;
      mat.needsUpdate = true;
    }
  });
  target.dispose();
  bake.dispose();
  renderer.shadowMap.needsUpdate = true;
  readyDone = true;
  loadingStep();
  pageReady();
})();

let lastT = performance.now();
let elapsed = 0;
function tick(now: number): void {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
  lastT = now;
  elapsed += dt;

  ezekiel.update(dt, elapsed);

  if (tour.running) {
    const pose = tour.update(dt);
    if (pose) walker.setPose(pose);
    veilFadeEl.style.opacity = String(tour.fade.toFixed(3));
  } else if (!tour.paused) {
    walker.update(dt);
  }

  updateHud();
  composer.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function snapshot(w = 1400, h = 900): string {
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  gtaoPass.setSize(Math.ceil(w * 0.6), Math.ceil(h * 0.6));
  composer.render();
  const data = canvas.toDataURL('image/png');
  fit();
  return data;
}

(globalThis as unknown as Record<string, unknown>).__ezekiel = {
  scene,
  camera,
  renderer,
  walker,
  counts: ezekiel.counts,
  colliders: ezekiel.colliders,
  platforms: ezekiel.platforms,
  floorY: (x: number, z: number) => ezekiel.floorY(x, z),
  get CUBIT() {
    return ezekiel.CUBIT;
  },
  get materialsReady() {
    return sceneReadyFlag;
  },
  get ready() {
    return readyDone ? true : readyPromise;
  },
  updateHud,
  tour,
  startTour,
  endTour,
  TOUR: EZEKIEL_TOUR,
  inspectStop,
  rescale: rescaledToCubit,
  snapshot,
  hant,
};
