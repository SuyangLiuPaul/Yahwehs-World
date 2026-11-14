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
import { buildNewJerusalemCity } from './new-jerusalem';
import { NEW_JERUSALEM_TOUR } from './new-jerusalem-tour';
import { materialsReady } from './materials';
import { Tour } from './tour';
import { installWalkMeasures } from '../structures/walk-measures';
import { applyStatic, bindSwitch, hant, onLocale, t } from '../locale';
import { installSiteMenu, loadingStep, loadingSteps, onJourneyPick, pageReady } from '../site-shell';

const DEFAULT_CUBIT = 0.445; // Rev 21:17: "according to human measurement, which is also an angel's"

interface Zone {
  id: string;
  zh: string;
  en: string;
  ref: string;
  test: (cx: number, cz: number, cy: number) => boolean;
}

const ZONES: Zone[] = [
  {
    id: 'wall-overlook',
    zh: '一百四十四肘碧玉城墙顶观景台',
    en: '144-Cubit Jasper Wall Overlook Terrace',
    ref: 'Rev 21:17–18, 25',
    test: (_cx, _cz, cy) => cy >= 132,
  },
  {
    id: 'wall-ramp',
    zh: '登城长阶（通往一百四十四肘墙顶）',
    en: 'Jasper Wall Ascent Ramp (to 144c Overlook)',
    ref: 'Rev 21:17',
    test: (cx, cz, cy) => cx >= -8 && cx <= 3.5 && cz >= 17 && cz <= 218 && cy >= 2.2,
  },
  {
    id: 'throne-forecourt',
    zh: '蓝宝石玻璃海前庭 · 宝座荣光与绿宝石虹',
    en: 'Sapphire Forecourt · Throne Glory & Emerald Rainbow',
    ref: 'Rev 4:3; 21:22–23; 22:1–5',
    test: (cx, cz) => cx <= -215 && Math.abs(cz) <= 30,
  },
  {
    id: 'gold-bridge',
    zh: '精金玻璃拱桥 · 俯瞰水晶生命河',
    en: 'Arched Gold-Glass Footbridge over the River of Life',
    ref: 'Rev 22:1',
    test: (cx, cz) =>
      Math.abs(cz) <= 9 &&
      (Math.abs(cx + 52) <= 5 || Math.abs(cx + 116) <= 5 || Math.abs(cx + 180) <= 5),
  },
  {
    id: 'river-trees',
    zh: '水晶生命水的河与两岸结十二样果子的生命树',
    en: 'Crystal River of Life & Twelve-Fruited Trees of Life',
    ref: 'Rev 22:1–2',
    test: (cx, cz) => cx >= -215 && cx <= -8 && Math.abs(cz) <= 13.5,
  },
  {
    id: 'colonnades',
    zh: '精金水晶柱廊与层叠圣城天际',
    en: 'Luminous Gold-Glass Colonnades',
    ref: 'Rev 21:16, 18, 24',
    test: (cx, cz) => cx >= -218 && cx <= -6 && Math.abs(cz) >= 32,
  },
  {
    id: 'golden-street',
    zh: '精金街道（明净如同玻璃）',
    en: 'Street of Pure Gold, Clear as Glass',
    ref: 'Rev 21:18, 21',
    test: (cx, cz) => cx >= -215 && cx <= 4 && Math.abs(cz) < 32,
  },
  {
    id: 'pearl-gate-central',
    zh: '东边中门：独颗珍珠造的敞开城门',
    en: 'Central East Gate of a Single Monolithic Pearl',
    ref: 'Rev 21:12–13, 21, 25',
    test: (cx, cz) => cx > 4 && cx <= 58 && Math.abs(cz) <= 13.5,
  },
  {
    id: 'pearl-gate-flank',
    zh: '东边侧门：独颗珍珠门与十二宝石阶',
    en: 'Flanking East Pearl Gate & Foundation Steps',
    ref: 'Rev 21:13, 21',
    test: (cx, cz) => cx > 4 && cx <= 58 && (Math.abs(cz - 112) <= 9 || Math.abs(cz + 112) <= 9),
  },
  {
    id: 'twelve-foundations',
    zh: '城墙十二层宝石根基与使徒纪念碑牌',
    en: 'Twelve Named Gemstone Foundations & Apostolic Stelae',
    ref: 'Rev 21:14, 19–20',
    test: (cx, cz) => cx > 28 && cx <= 56 && Math.abs(cz) <= 165,
  },
  {
    id: 'high-mountain',
    zh: '高大圣山东侧山顶平台',
    en: 'High Mountain Eastern Approach Terrace',
    ref: 'Rev 21:10',
    test: () => true,
  },
];

// ---------------------------------------------------------------------------
// BOOTSTRAP RENDERER, CELESTIAL GLORY LIGHTING & COMPOSER
// ---------------------------------------------------------------------------
loadingSteps(3);

const canvas = document.getElementById('stage') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

RectAreaLightUniformsLib.init();

const city = buildNewJerusalemCity(DEFAULT_CUBIT);

const scene = new THREE.Scene();
scene.background = city.skyTex;
scene.fog = new THREE.Fog(0xeee2c4, 250, 1120);

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromEquirectangular(city.skyTex);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.82;
pmrem.dispose();

loadingStep();

// Perpetual Celestial Illumination ("there will be no night there", Rev 21:23, 25; 22:5)
const hemi = new THREE.HemisphereLight('#fff8e6', '#6d948a', 0.72);
scene.add(hemi);

// Primary Glory Directional Light radiating from the Western Sanctuary across the City
const gloryLight = new THREE.DirectionalLight('#fff1cf', 2.75);
gloryLight.position.set(-195, 152, -82);
gloryLight.target.position.set(-35, 0, 0);
gloryLight.castShadow = true;
gloryLight.shadow.mapSize.set(4096, 4096);
gloryLight.shadow.camera.near = 20;
gloryLight.shadow.camera.far = 560;
const SHADOW_BOX = 148;
gloryLight.shadow.camera.left = -SHADOW_BOX;
gloryLight.shadow.camera.right = SHADOW_BOX;
gloryLight.shadow.camera.top = SHADOW_BOX;
gloryLight.shadow.camera.bottom = -SHADOW_BOX;
gloryLight.shadow.bias = -0.0004;
gloryLight.shadow.normalBias = 0.04;
scene.add(gloryLight);
scene.add(gloryLight.target);

// Secondary Celestial Fill illuminating the Eastern Jasper Wall, Pearl Gates & 12 Foundations
const eastFill = new THREE.DirectionalLight('#fff5de', 1.12);
eastFill.position.set(165, 105, 68);
scene.add(eastFill);

scene.add(city.group);

loadingStep();

const noAo: THREE.Object3D[] = [];
city.group.traverse((o) => {
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
gtaoPass.blendIntensity = 0.78;
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
const walker = new Walker(camera, canvas, city.colliders, {
  platforms: city.platforms,
  floorY: (x, z) => city.floorY(x, z),
});
scene.add(walker.yaw);
bindInputUi(walker);

function spawnOutsideEast(): void {
  walker.moveTo(88 * city.CUBIT, 0, Math.PI * 0.5, 4 * city.CUBIT);
}
spawnOutsideEast();

const tour = new Tour(city.CUBIT, NEW_JERUSALEM_TOUR);

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
  const c = city.counts;
  const rows = [
    { n: '12,000', en: 'Stadia cube (~2,220 km)', zh: '斯他丁立方 (约 2,220 公里)', ref: 'Rev 21:16' },
    { n: String(c.wallCubits), en: 'Jasper wall cubits', zh: '碧玉墙高 (肘)', ref: 'Rev 21:17' },
    { n: String(c.foundationCourses), en: 'Gemstone foundations', zh: '宝石根基', ref: 'Rev 21:19–20' },
    { n: String(c.totalPearlGates), en: 'Single-pearl gates', zh: '独颗珍珠门', ref: 'Rev 21:12, 21' },
    { n: String(c.fruitsPerTree), en: 'Fruits on Trees of Life', zh: '生命树果子', ref: 'Rev 22:2' },
  ];
  tallyEl.innerHTML = rows
    .map((r) => `<div><b>${r.n}</b><span>${t(r.en, hant(r.zh))}</span><i>${hant(r.ref)}</i></div>`)
    .join('');
}

function populateStops(): void {
  const cur = tour.currentIndex;
  stopSelectEl.innerHTML = NEW_JERUSALEM_TOUR.map(
    (s, i) => `<option value="${i}">${i + 1}/${NEW_JERUSALEM_TOUR.length} · ${t(s.en, hant(s.zh))}</option>`,
  ).join('');
  stopSelectEl.value = String(Math.max(0, cur));
}

function setGate(visible: boolean): void {
  gateEl.classList.toggle('hidden', !visible);
}

function updateHud(): void {
  const c = city.CUBIT;
  const wp = walker.position;
  const cx = wp.x / c;
  const cz = wp.z / c;
  const cy = (wp.y - 1.65) / c;

  if (pYouEl) {
    const px = Math.max(-282, Math.min(122, cx));
    const py = Math.max(-226, Math.min(226, -cz));
    pYouEl.setAttribute('cx', px.toFixed(1));
    pYouEl.setAttribute('cy', py.toFixed(1));
  }

  let z = ZONES[ZONES.length - 1]!;
  for (const item of ZONES) {
    if (item.test(cx, cz, cy)) {
      z = item;
      break;
    }
  }

  if (tour.running || tour.paused) {
    const s = NEW_JERUSALEM_TOUR[tour.currentIndex] ?? NEW_JERUSALEM_TOUR[0]!;
    whereEl.textContent = t(s.en, hant(s.zh));
    verseEl.textContent = `${s.ref} · ${Math.round(cx)}c, ${Math.round(cz)}c · 1c=${c.toFixed(3)}m`;
    stopSelectEl.value = String(Math.max(0, tour.currentIndex));
    if (tourFillEl) {
      tourFillEl.style.width = `${(((tour.currentIndex + 1) / NEW_JERUSALEM_TOUR.length) * 100).toFixed(1)}%`;
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
  const c = city.CUBIT;
  const wp = walker.position;
  const cx = wp.x / c;
  const cz = wp.z / c;
  const cy = (wp.y - 1.65) / c;

  if (cy >= 100 && cx >= -7 && cx <= 27 && cz >= 15 && cz <= 219) {
    // Keep visitor standing on the 144-cubit Jasper Wall Overlook Terrace / Ramp
    walker.moveTo(wp.x, wp.z, walker.yaw.rotation.y, (WALL_CEIL_CUBITS) * c);
  } else {
    // Clamp aerial outside stops safely back onto the walkable High Mountain Terrace or Golden Street
    const safeCx = Math.max(-246, Math.min(104, cx));
    const maxZ = safeCx > 28 ? 156 : 30;
    const safeCz = Math.max(-maxZ, Math.min(maxZ, cz));
    const ceiling = Math.max(12 * c, Math.min(16 * c, wp.y + 2 * c));
    walker.moveTo(safeCx * c, safeCz * c, walker.yaw.rotation.y, ceiling);
  }
  updateHud();
}
const WALL_CEIL_CUBITS = 148;

function exitWalk(): void {
  endTour();
  walker.exit();
  setGate(true);
  hudEl.hidden = true;
}

function inspectStop(index: number): void {
  const idx = Math.max(0, Math.min(NEW_JERUSALEM_TOUR.length - 1, index));
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

walker.onManualInput = () => {
  if (tour.running || tour.paused) endTour();
};

// Gate & HUD Controls
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
    const [cxStr, czStr, yawStr, ceilStr] = raw.split(',');
    const cx = Number(cxStr);
    const cz = Number(czStr);
    const yaw = yawStr !== undefined ? Number(yawStr) : Math.PI * 0.5;
    const ceilC = ceilStr !== undefined ? Number(ceilStr) : 14;
    if (tour.running || tour.paused) endTour();
    setGate(false);
    hudEl.hidden = false;
    walker.moveTo(cx * city.CUBIT, cz * city.CUBIT, yaw, ceilC * city.CUBIT);
    updateHud();
  });
});

// Assumptions dialog
const assumptionsEl = document.getElementById('assumptions') as HTMLDialogElement;
document.getElementById('model-info')!.addEventListener('click', () => assumptionsEl.showModal());
document.getElementById('close-assumptions')!.addEventListener('click', () => assumptionsEl.close());

// Measures drawer + live 3D cubit rescaling (`0.445 m` default angel's measure, Rev 21:17)
const measuresDialog = document.getElementById('measures-panel') as HTMLDialogElement;
const rescaledToCubit = (newCubit: number): void => {
  const prevCubit = city.CUBIT;
  if (Math.abs(newCubit - prevCubit) < 1e-4) return;
  const pose = walker.pose;
  const cx = pose.x / prevCubit;
  const cy = (pose.y ?? 1.65) / prevCubit;
  const cz = pose.z / prevCubit;

  city.rescale(newCubit);
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

installWalkMeasures({
  walk: 'new-jerusalem',
  dialog: measuresDialog,
  openers: [document.getElementById('measures'), document.getElementById('gate-measures')],
  fallbackIds: ['newjerusalem'],
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
const onCubitSlider = (ev: Event): void => {
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
const syncAllLocale = (): void => {
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

// Ready & Bake Interior Reflections for Gold-Glass Street, Jasper Wall & Pearl Gates
let readyDone = false;
let sceneReadyFlag = false;
const readyPromise = (async () => {
  await materialsReady();
  sceneReadyFlag = true;
  renderer.shadowMap.needsUpdate = true;
  const target = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const probe = new THREE.CubeCamera(0.2, 240, target);
  probe.position.set(-116 * city.CUBIT, 10 * city.CUBIT, 0);
  probe.update(renderer, scene);
  const bake = new THREE.PMREMGenerator(renderer);
  const goldenEnv = bake.fromCubemap(target.texture);
  city.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat && mat.isMeshStandardMaterial && mat.name && mat.name.startsWith('Interior')) {
      mat.envMap = goldenEnv.texture;
      mat.envMapIntensity = 1.35;
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

  city.update(dt, elapsed);

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

(globalThis as unknown as Record<string, unknown>).__newjerusalem = {
  scene,
  camera,
  renderer,
  walker,
  counts: city.counts,
  colliders: city.colliders,
  platforms: city.platforms,
  floorY: (x: number, z: number) => city.floorY(x, z),
  get CUBIT() {
    return city.CUBIT;
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
  TOUR: NEW_JERUSALEM_TOUR,
  inspectStop,
  rescale: rescaledToCubit,
  snapshot,
  hant,
};
