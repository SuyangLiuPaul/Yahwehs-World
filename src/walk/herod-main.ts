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
import { buildHerod } from './herod';
import { HEROD_TOUR } from './herod-tour';
import { desertSky } from './textures';
import { materialsReady } from './materials';
import { Tour } from './tour';
import { installWalkMeasures } from '../structures/walk-measures';
import { applyStatic, bindSwitch, hant, onLocale, t } from '../locale';
import { installSiteMenu, loadingStep, loadingSteps, onJourneyPick, pageReady } from '../site-shell';

const DEFAULT_CUBIT = 0.50; // Second-Temple standard cubit (~0.50 m; rescalable via Measures)

interface Zone {
  id: string;
  zh: string;
  en: string;
  ref: string;
  test: (cx: number, cz: number) => boolean;
}

const ZONES: Zone[] = [
  {
    id: 'kodesh-kodashim',
    zh: '至圣所 · 裸露天然根基石（20×20 肘）',
    en: 'Most Holy Place · Bare Foundation Stone',
    ref: 'Matt 27:51 · War 5.219 · Yoma 5:2',
    test: (cx, cz) => cx >= -135 && cx <= -113.8 && Math.abs(cz) <= 10.5,
  },
  {
    id: 'hekhal',
    zh: '圣所 · 金灯台、陈设饼桌与金香坛（40×20 肘）',
    en: 'Holy Place (Hekhal) · Menorah, Showbread & Incense Altar',
    ref: 'Luke 1:8–11 · Heb 9:2',
    test: (cx, cz) => cx > -113.8 && cx <= -67 && Math.abs(cz) <= 10.5,
  },
  {
    id: 'ulam',
    zh: '百肘圣殿前廊（乌兰）、金葡萄树与十二级台阶',
    en: '100-Cubit Sanctuary Porch (Ulam), Golden Vine & 12 Steps',
    ref: 'John 2:20 · Mark 13:1 · War 5.208–210',
    test: (cx, cz) => cx > -67 && cx <= -37 && Math.abs(cz) <= 50,
  },
  {
    id: 'altar',
    zh: '三十二肘刷白石祭坛、朱红中线与南坡道',
    en: '32×32 Whitewashed Altar, Scarlet Line & Southern Ramp',
    ref: 'Matt 23:18–19 · Middot 3:1–4',
    test: (cx, cz) => cx >= -29.5 && cx <= 3.5 && cz >= -48.5 && cz <= 16.5,
  },
  {
    id: 'slaughtering',
    zh: '祭坛北侧：二十四宰牲环与八张大理石桌',
    en: 'Northern Slaughtering Rings & Marble Tables',
    ref: 'Middot 3:5',
    test: (cx, cz) => cx >= -29 && cx <= 4 && cz > 18 && cz <= 58,
  },
  {
    id: 'azarah',
    zh: '以色列院、祭司院与大公议会凿石厅',
    en: 'Court of Israel, Priests’ Court & Chamber of Hewn Stone',
    ref: 'Middot 2:6 · 5:1, 4',
    test: (cx, cz) => cx >= -162 && cx <= 25 && Math.abs(cz) <= 67.5,
  },
  {
    id: 'nicanor',
    zh: '十五级利未半圆石阶与尼迦挪铜门',
    en: '15 Semicircular Levitical Steps & Nicanor Gate',
    ref: 'Ps 120–134 · Middot 2:5',
    test: (cx, cz) => cx > 25 && cx <= 49 && Math.abs(cz) <= 19,
  },
  {
    id: 'women-court',
    zh: '女院（135×135 肘）、十三银库奉献箱与住棚节金灯台',
    en: 'Court of the Women · 13 Treasury Chests & 4 Golden Lampstands',
    ref: 'Mark 12:41–44 · John 8:12, 20',
    test: (cx, cz) => cx >= 30 && cx <= 165 && Math.abs(cz) <= 67.5,
  },
  {
    id: 'beautiful-gate',
    zh: '美门（哥林多铜门）',
    en: 'Beautiful Gate (Corinthian Bronze Gate)',
    ref: 'Acts 3:2, 10 · War 5.201',
    test: (cx, cz) => cx > 164 && cx <= 173 && Math.abs(cz) <= 14,
  },
  {
    id: 'soreg-chel',
    zh: '索雷格石雕隔墙、警告石碑与十肘赫尔平台',
    en: 'Soreg Warning Balustrade, 14 Steps & 10-Cubit Chel Terrace',
    ref: 'Acts 21:28 · Eph 2:14 · Middot 2:3',
    test: (cx, cz) => cx >= -199 && cx <= 201 && Math.abs(cz) <= 102,
  },
  {
    id: 'antonia',
    zh: '西北角安东尼亚营楼四塔要塞与营楼台阶',
    en: 'Antonia Fortress Citadel & Steps',
    ref: 'Acts 21:31–40 · War 5.238–245',
    test: (cx, cz) => cx <= -150 && cz >= 112 && cz <= 208,
  },
  {
    id: 'royal-stoa',
    zh: '南侧皇家柱廊（四排共 162 根科林斯白柱）',
    en: 'Royal Stoa Basilica (162 Corinthian Columns)',
    ref: 'Matt 21:12 · Ant. 15.411–416',
    test: (cx, cz) => cz <= -288 && cz >= -344 && cx >= -232 && cx <= 302,
  },
  {
    id: 'solomon-portico',
    zh: '东墙所罗门廊',
    en: 'Solomon’s Portico',
    ref: 'John 10:23 · Acts 3:11, 5:12',
    test: (cx, cz) => cx >= 266 && cx <= 302 && cz > -288 && cz <= 190,
  },
  {
    id: 'hulda-gates',
    zh: '南墙户勒大朝圣台阶、双门与三门',
    en: 'Southern Hulda Steps, Double Gate & Triple Gate',
    ref: 'Luke 2:46 · Middot 1:3',
    test: (_cx, cz) => cz < -344,
  },
  {
    id: 'gentiles-court',
    zh: '圣殿山外邦人院铺石广场',
    en: 'Temple Mount · Court of the Gentiles',
    ref: 'Matt 21:12 · Luke 19:45–47',
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
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const skyTex = desertSky();
scene.background = skyTex;
scene.fog = new THREE.Fog(0xdacdb8, 320, 1450);

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromEquirectangular(skyTex);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.65;
pmrem.dispose();

loadingStep();

const hemi = new THREE.HemisphereLight('#fff3dc', '#8d7554', 0.58);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#fff1d4', 2.85);
sun.position.set(190, 185, -165);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 760;
const SHADOW_BOX = 225;
sun.shadow.camera.left = -SHADOW_BOX;
sun.shadow.camera.right = SHADOW_BOX;
sun.shadow.camera.top = SHADOW_BOX;
sun.shadow.camera.bottom = -SHADOW_BOX;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);

const herod = buildHerod(DEFAULT_CUBIT);
scene.add(herod.group);

loadingStep();

const noAo: THREE.Object3D[] = [];
herod.group.traverse((o) => {
  if (o.userData.noAO || (o as THREE.Sprite).isSprite) noAo.push(o);
});

const camera = new THREE.PerspectiveCamera(
  58,
  Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
  0.2,
  1800,
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
gtaoPass.blendIntensity = 0.8;
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
const walker = new Walker(camera, canvas, herod.colliders, {
  platforms: herod.platforms,
  floorY: (x, z) => herod.floorY(x, z),
});
scene.add(walker.yaw);
bindInputUi(walker);

function spawnEastGentiles(): void {
  walker.moveTo(214 * herod.CUBIT, 0, Math.PI * 0.5, 4 * herod.CUBIT);
}
spawnEastGentiles();

const tour = new Tour(herod.CUBIT, HEROD_TOUR);

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
  const c = herod.counts;
  const rows = [
    { n: c.royalStoaColumns, en: 'Royal Stoa columns', zh: '皇家柱廊白柱', ref: 'Ant. 15.413' },
    { n: c.soregStelae, en: 'Soreg warning stelae', zh: '索雷格警告石碑', ref: 'Acts 21:28' },
    { n: c.treasuryChests, en: 'Treasury chests', zh: '银库号角奉献箱', ref: 'Mark 12:41' },
    { n: c.sukkotLamps, en: 'Golden lampstands', zh: '住棚节金灯台', ref: 'John 8:12' },
    { n: c.leviticalSteps, en: 'Levitical steps', zh: '尼迦挪半圆石阶', ref: 'Middot 2:5' },
    { n: c.sanctuaryCubits, en: 'Sanctuary cubits tall', zh: '圣殿总高（肘）', ref: 'War 5.207' },
  ];
  tallyEl.innerHTML = rows
    .map((r) => `<div><b>${r.n}</b><span>${t(r.en, hant(r.zh))}</span><i>${hant(r.ref)}</i></div>`)
    .join('');
}

function populateStops(): void {
  const cur = tour.currentIndex;
  stopSelectEl.innerHTML = HEROD_TOUR.map(
    (s, i) => `<option value="${i}">${i + 1}/${HEROD_TOUR.length} · ${t(s.en, hant(s.zh))}</option>`,
  ).join('');
  stopSelectEl.value = String(Math.max(0, cur));
}

function setGate(visible: boolean): void {
  gateEl.classList.toggle('hidden', !visible);
}

function updateHud(): void {
  const c = herod.CUBIT;
  const wp = walker.position;
  const cx = wp.x / c;
  const cz = wp.z / c;
  const cy = (wp.y - herod.GENTILES_Y) / c;

  if (pYouEl) {
    const px = Math.max(-248, Math.min(312, cx));
    const py = Math.max(-208, Math.min(405, -cz));
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
    const s = HEROD_TOUR[tour.currentIndex] ?? HEROD_TOUR[0]!;
    whereEl.textContent = t(s.en, hant(s.zh));
    verseEl.textContent = `${s.ref} · ${Math.round(cx)}c, ${Math.round(cz)}c · 1c=${c.toFixed(3)}m`;
    stopSelectEl.value = String(Math.max(0, tour.currentIndex));
    if (tourFillEl) {
      tourFillEl.style.width = `${(((tour.currentIndex + 1) / HEROD_TOUR.length) * 100).toFixed(1)}%`;
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

  const c = herod.CUBIT;
  const wp = walker.position;
  const cx = wp.x / c;
  const cz = wp.z / c;

  const onEsplanade = cx >= -226 && cx <= 296 && cz >= -336 && cz <= 186;
  const onHuldaPlaza = Math.abs(cx) <= 84 && cz >= -404 && cz <= -346;

  if (!onEsplanade && !onHuldaPlaza) {
    // Aerial stop outside retaining walls hands back cleanly on the East Court of the Gentiles
    spawnEastGentiles();
  } else if (wp.y < -0.5 * c) {
    // Inside subterranean Hulda vault or Southern Plaza: cap below Royal Stoa slab
    walker.moveTo(wp.x, wp.z, walker.yaw.rotation.y, -0.5 * c);
  } else {
    // Cap below all portico/gate/sanctuary roofs while supporting up to Sanctuary & Altar top
    const ceiling = Math.min(18.0 * c, Math.max(2.5 * c, wp.y));
    walker.moveTo(wp.x, wp.z, walker.yaw.rotation.y, ceiling);
  }
  updateHud();
}

function exitWalk(): void {
  endTour();
  walker.exit();
  setGate(true);
  hudEl.hidden = true;
}

function inspectStop(index: number): void {
  const idx = Math.max(0, Math.min(HEROD_TOUR.length - 1, index));
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

// Gate & HUD controls
document.getElementById('enter')!.addEventListener('click', () => {
  setGate(false);
  hudEl.hidden = false;
  spawnEastGentiles();
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
    const ceiling = cz < -344 ? 0 : 18 * herod.CUBIT;
    walker.moveTo(cx * herod.CUBIT, cz * herod.CUBIT, yaw, ceiling);
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
  const prevCubit = herod.CUBIT;
  if (Math.abs(newCubit - prevCubit) < 1e-4) return;
  const pose = walker.pose;
  const cx = pose.x / prevCubit;
  const cy = (pose.y ?? 1.65) / prevCubit;
  const cz = pose.z / prevCubit;

  herod.rescale(newCubit);
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
  walk: 'herod',
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
  '2': 0.523,
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

// Ready & interior CubeCamera reflection bake
let readyDone = false;
let sceneReadyFlag = false;
const readyPromise = (async () => {
  await materialsReady();
  sceneReadyFlag = true;
  renderer.shadowMap.needsUpdate = true;
  const target = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const probe = new THREE.CubeCamera(0.2, 180, target);
  probe.position.set(-93 * herod.CUBIT, herod.TEMPLE_Y + 8 * herod.CUBIT, 0);
  probe.update(renderer, scene);
  const bake = new THREE.PMREMGenerator(renderer);
  const room = bake.fromCubemap(target.texture);
  herod.group.traverse((o) => {
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

  herod.update(dt, elapsed);

  if (tour.running) {
    const pose = tour.update(dt);
    if (pose) walker.setPose(pose);
    veilFadeEl.style.background = tour.crossing === 'veil' ? '#1a102c' : '#090b0e';
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

(globalThis as unknown as Record<string, unknown>).__herod = {
  scene,
  camera,
  renderer,
  walker,
  counts: herod.counts,
  colliders: herod.colliders,
  platforms: herod.platforms,
  floorY: (x: number, z: number) => herod.floorY(x, z),
  get CUBIT() {
    return herod.CUBIT;
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
  TOUR: HEROD_TOUR,
  inspectStop,
  rescale: rescaledToCubit,
  snapshot,
  hant,
};
