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
import { buildPalace } from './palace';
import { PALACE_TOUR } from './palace-tour';
import { desertSky } from './textures';
import { materialsReady } from './materials';
import { Tour } from './tour';
import { installWalkMeasures } from '../structures/walk-measures';
import { CUBITS } from '../structures/specs-lite';
import { applyStatic, bindSwitch, hant, onLocale, t } from '../locale';
import { installSiteMenu, loadingStep, loadingSteps, onJourneyPick, pageReady } from '../site-shell';

const DEFAULT_CUBIT = 0.445; // Common cubit (1 Kings 7:1-12; 10:14-21)

interface Zone {
  id: string;
  zh: string;
  en: string;
  ref: string;
  test: (cx: number, cz: number, cy: number) => boolean;
}

const ZONES: Zone[] = [
  {
    id: 'forest-gallery',
    zh: '利巴嫩林宫 · 十五肘高香柏木上层楼廊',
    en: 'House of the Forest · Upper Cedar Gallery (15c)',
    ref: '1 Kgs 7:3–5; 10:16–17',
    test: (cx, cz, cy) => Math.abs(cx) <= 50 && cz >= -96 && cz <= -44 && cy >= 10,
  },
  {
    id: 'forest-house',
    zh: '利巴嫩林宫（100×50×30 肘 · 五百面金盾）',
    en: 'House of the Forest of Lebanon (100 × 50 × 30c)',
    ref: '1 Kgs 7:2–5; 10:16–21',
    test: (cx, cz) => Math.abs(cx) <= 50 && cz >= -96 && cz <= -44,
  },
  {
    id: 'porch-pillars',
    zh: '柱廊与厚梁槛顶（50×30 肘）',
    en: 'Porch of Pillars & Threshold Canopy (50 × 30c)',
    ref: '1 Kgs 7:6',
    test: (cx, cz) => Math.abs(cx) <= 26 && cz >= -34.5 && cz <= 8.2,
  },
  {
    id: 'throne-dais',
    zh: '所罗门的象牙精金大宝座与六级金狮台阶',
    en: "Solomon's Ivory-and-Gold Throne & 6 Lion Steps",
    ref: '1 Kgs 10:18–20; 2 Chr 9:17–19',
    test: (cx, cz) => Math.abs(cx) <= 8.5 && cz >= 25.5 && cz <= 42.5,
  },
  {
    id: 'hall-judgment',
    zh: '审判廊 · 宝座廊（满铺雕花香柏木）',
    en: 'Hall of the Throne · Porch of Judgment',
    ref: '1 Kgs 7:7',
    test: (cx, cz) => Math.abs(cx) <= 21 && cz > 8.2 && cz <= 44.5,
  },
  {
    id: 'inner-residence',
    zh: '另一院门与所罗门自住宫室外立面',
    en: "Inner Courtyard & Solomon's Residence Facade",
    ref: '1 Kgs 7:8',
    test: (cx, cz) => cx >= -79 && cx <= -15 && cz >= 52 && cz <= 87,
  },
  {
    id: 'north-terrace',
    zh: '大院北面观殿石阶台（远眺摩利亚山雅伟圣殿）',
    en: "Northern Overlook Terrace (Vista of Yahweh's Temple)",
    ref: '1 Kgs 7:12; 10:5',
    test: (cx, cz) => Math.abs(cx) <= 46 && cz >= 89.5 && cz <= 120,
  },
  {
    id: 'great-court',
    zh: '大院（三层凿石与一层香柏木横梁）',
    en: 'The Great Court (3 Stone Courses & Cedar Beams)',
    ref: '1 Kgs 7:9–12',
    test: (cx, cz) => Math.abs(cx) <= 90 && cz >= -120 && cz <= 120,
  },
  {
    id: 'south-approach',
    zh: '王宫南门外广场',
    en: 'South Royal Approach Plaza',
    ref: '1 Kgs 7:1–12',
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
renderer.toneMappingExposure = 1.03;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const skyTex = desertSky();
scene.background = skyTex;
scene.fog = new THREE.Fog(0xd8ccb8, 220, 980);

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromEquirectangular(skyTex);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.68;
pmrem.dispose();

loadingStep();

const hemi = new THREE.HemisphereLight('#fff3dc', '#8f7553', 0.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#fff0d2', 2.85);
sun.position.set(135, 138, -145);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 560;
const SHADOW_BOX = 140;
sun.shadow.camera.left = -SHADOW_BOX;
sun.shadow.camera.right = SHADOW_BOX;
sun.shadow.camera.top = SHADOW_BOX;
sun.shadow.camera.bottom = -SHADOW_BOX;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);

const palace = buildPalace(DEFAULT_CUBIT);
scene.add(palace.group);

loadingStep();

const noAo: THREE.Object3D[] = [];
palace.group.traverse((o) => {
  if (o.userData.noAO || (o as THREE.Sprite).isSprite) noAo.push(o);
});

const camera = new THREE.PerspectiveCamera(
  58,
  Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
  0.2,
  1400,
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

// Walker Rig
const walker = new Walker(camera, canvas, palace.colliders, {
  platforms: palace.platforms,
  floorY: (x, z) => palace.floorY(x, z),
});
scene.add(walker.yaw);
bindInputUi(walker);

function spawnOutsideSouth(): void {
  walker.moveTo(0, -136 * palace.CUBIT, Math.PI);
}
spawnOutsideSouth();

const tour = new Tour(palace.CUBIT, PALACE_TOUR);

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
  const c = palace.counts;
  const rows = [
    { n: c.cedarPillars, en: 'Cedar pillars (4×15)', zh: '香柏木柱 (四行)', ref: '1 Kgs 7:2' },
    { n: c.sideChambers, en: 'Chamber beams (3×15)', zh: '三层旁室梁木', ref: '1 Kgs 7:3' },
    { n: c.largeShields, en: 'Gold large shields', zh: '锤金大盾牌', ref: '1 Kgs 10:16' },
    { n: c.smallShields, en: 'Gold bucklers', zh: '锤金小盾牌', ref: '1 Kgs 10:17' },
    { n: c.throneSteps, en: 'Ivory throne steps', zh: '象牙宝座台阶', ref: '1 Kgs 10:19' },
    { n: c.stepLions + c.armrestLions, en: 'Standing gold lions', zh: '精金立狮 (12+2)', ref: '1 Kgs 10:19–20' },
  ];
  tallyEl.innerHTML = rows
    .map((r) => `<div><b>${r.n}</b><span>${t(r.en, hant(r.zh))}</span><i>${hant(r.ref)}</i></div>`)
    .join('');
}

function populateStops(): void {
  const cur = tour.currentIndex;
  stopSelectEl.innerHTML = PALACE_TOUR.map(
    (s, i) => `<option value="${i}">${i + 1}/${PALACE_TOUR.length} · ${t(s.en, hant(s.zh))}</option>`,
  ).join('');
  stopSelectEl.value = String(Math.max(0, cur));
}

function setGate(visible: boolean): void {
  gateEl.classList.toggle('hidden', !visible);
}

function updateHud(): void {
  const c = palace.CUBIT;
  const wp = walker.position;
  const cx = wp.x / c;
  const cz = wp.z / c;
  const cy = (wp.y - palace.COURT_Y) / c;

  if (pYouEl) {
    const px = Math.max(-112, Math.min(112, cx));
    const py = Math.max(-140, Math.min(140, -cz));
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
    const s = PALACE_TOUR[tour.currentIndex] ?? PALACE_TOUR[0]!;
    whereEl.textContent = t(s.en, hant(s.zh));
    verseEl.textContent = `${s.ref} · ${Math.round(cx)}c, ${Math.round(cz)}c · 1c=${c.toFixed(3)}m`;
    stopSelectEl.value = String(Math.max(0, tour.currentIndex));
    if (tourFillEl) {
      tourFillEl.style.width = `${(((tour.currentIndex + 1) / PALACE_TOUR.length) * 100).toFixed(1)}%`;
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
  // Clamp exterior aerial stop coordinates safely inside the Great Court / South Plaza
  const safeX = THREE.MathUtils.clamp(wp.x, -82 * palace.CUBIT, 82 * palace.CUBIT);
  const safeZ = THREE.MathUtils.clamp(wp.z, -140 * palace.CUBIT, 114 * palace.CUBIT);
  const ceiling = Math.min(palace.GALLERY_Y + 3 * palace.CUBIT, Math.max(palace.DAIS_Y + 2 * palace.CUBIT, wp.y));
  walker.moveTo(safeX, safeZ, walker.yaw.rotation.y, ceiling);
  updateHud();
}

function exitWalk(): void {
  endTour();
  walker.exit();
  setGate(true);
  hudEl.hidden = true;
}

function inspectStop(index: number): void {
  const idx = Math.max(0, Math.min(PALACE_TOUR.length - 1, index));
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

walker.onManualInput = () => {
  if (tour.running || tour.paused) endTour();
};

walker.onLockChange = (locked) => {
  setGate(!locked);
  hudEl.hidden = !locked;
};

// Gate & HUD buttons
document.getElementById('enter')!.addEventListener('click', () => {
  setGate(false);
  hudEl.hidden = false;
  spawnOutsideSouth();
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

// Interactive #plan SVG minimap click-to-jump
document.querySelectorAll<SVGElement>('#plan [data-jump]').forEach((el) => {
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => {
    const raw = el.dataset.jump;
    if (!raw) return;
    const [cxStr, czStr, yawStr] = raw.split(',');
    const cx = Number(cxStr);
    const cz = Number(czStr);
    const yaw = yawStr !== undefined ? Number(yawStr) : Math.PI;
    if (tour.running || tour.paused) endTour();
    setGate(false);
    hudEl.hidden = false;
    const isGalleryJump = cx >= 42 && cz <= -46 && cz >= -94;
    const jumpCeiling = isGalleryJump ? palace.GALLERY_Y + 3 * palace.CUBIT : palace.DAIS_Y + 2 * palace.CUBIT;
    walker.moveTo(cx * palace.CUBIT, cz * palace.CUBIT, yaw, jumpCeiling);
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
  const prevCubit = palace.CUBIT;
  if (Math.abs(newCubit - prevCubit) < 1e-4) return;
  const pose = walker.pose;
  const cx = pose.x / prevCubit;
  const cy = (pose.y ?? 1.65) / prevCubit;
  const cz = pose.z / prevCubit;

  palace.rescale(newCubit);
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
  walk: 'palace',
  dialog: measuresDialog,
  openers: [document.getElementById('measures'), document.getElementById('gate-measures')],
  beforeOpen: () => {
    if (tour.running) {
      tour.pause();
      tourToggleEl.textContent = '▶';
    }
  },
});

const onCubitSlider = (ev: Event) => {
  const tgt = ev.target as HTMLInputElement | null;
  if (tgt && tgt.id === 'mp-c-range') {
    const chosen = CUBITS[Number(tgt.value)]?.m ?? DEFAULT_CUBIT;
    rescaledToCubit(chosen);
  }
};
measuresDialog.addEventListener('input', onCubitSlider);
measuresDialog.addEventListener('change', onCubitSlider);

// Sync initial cubit if user saved a non-default cubit in localStorage
try {
  const savedCubitId = localStorage.getItem('ydh.cubit');
  const savedStd = CUBITS.find((c) => c.id === savedCubitId);
  if (savedStd && Math.abs(savedStd.m - DEFAULT_CUBIT) > 1e-4) {
    rescaledToCubit(savedStd.m);
  }
} catch {
  /* ignore storage errors */
}

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

// Bake warm cedar-and-gold interior environment probe & mark page ready
let readyDone = false;
let sceneReadyFlag = false;
const readyPromise = (async () => {
  await materialsReady();
  sceneReadyFlag = true;
  renderer.shadowMap.needsUpdate = true;
  const target = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const probe = new THREE.CubeCamera(0.2, 140, target);
  probe.position.set(0, palace.FOREST_Y + 8 * palace.CUBIT, -70 * palace.CUBIT);
  probe.update(renderer, scene);
  const bake = new THREE.PMREMGenerator(renderer);
  const room = bake.fromCubemap(target.texture);
  palace.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat && mat.isMeshStandardMaterial && mat.name && mat.name.startsWith('Interior')) {
      mat.envMap = room.texture;
      mat.envMapIntensity = 1.25;
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

  palace.update(dt, elapsed);

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

(globalThis as unknown as Record<string, unknown>).__palace = {
  scene,
  camera,
  renderer,
  walker,
  counts: palace.counts,
  colliders: palace.colliders,
  platforms: palace.platforms,
  floorY: (x: number, z: number) => palace.floorY(x, z),
  get CUBIT() {
    return palace.CUBIT;
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
  TOUR: PALACE_TOUR,
  inspectStop,
  rescale: rescaledToCubit,
  snapshot,
  hant,
};
