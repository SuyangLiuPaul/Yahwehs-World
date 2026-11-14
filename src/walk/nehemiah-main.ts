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
import { buildNehemiah, insideCity, NEHEMIAH_DEFAULT_CUBIT } from './nehemiah';
import { NEHEMIAH_TOUR } from './nehemiah-tour';
import { desertSky } from './textures';
import { materialsReady } from './materials';
import { Tour } from './tour';
import { installWalkMeasures } from '../structures/walk-measures';
import { applyStatic, bindSwitch, hant, onLocale, t } from '../locale';
import { installSiteMenu, loadingStep, loadingSteps, onJourneyPick, pageReady } from '../site-shell';

const DEFAULT_CUBIT = NEHEMIAH_DEFAULT_CUBIT; // 0.445 m standard cubit (rescalable across 0.445 / 0.518 / 0.525 m)

interface Zone {
  id: string;
  zh: string;
  en: string;
  ref: string;
  test: (cx: number, cz: number) => boolean;
}

const ZONES: Zone[] = [
  {
    id: 'temple-house',
    zh: '所罗巴伯重建圣殿（六十肘宽、六十肘高）',
    en: 'Zerubbabel’s Second Temple (60 × 60 cubits)',
    ref: 'Ezra 6:3–4',
    test: (cx, cz) => cx >= 80 && cx <= 152 && cz >= 218 && cz <= 282,
  },
  {
    id: 'temple-altar',
    zh: '圣殿东院与重建的燔祭坛',
    en: 'Temple Court & Rebuilt Altar of Burnt Offering',
    ref: 'Ezra 3:2–3; Neh 12:40',
    test: (cx, cz) => cx > 152 && cx <= 184 && cz >= 218 && cz <= 282,
  },
  {
    id: 'sheep-gate',
    zh: '羊门与祭司修造段',
    en: 'Sheep Gate & Priests’ Wall Sector',
    ref: 'Neh 3:1, 32; 12:39',
    test: (cx, cz) => cx >= 125 && cx <= 175 && cz >= 322 && cz <= 368,
  },
  {
    id: 'north-towers',
    zh: '哈米亚楼（百人楼）与哈楠业楼',
    en: 'Tower of the Hundred (Meah) & Tower of Hananel',
    ref: 'Neh 3:1; 12:39',
    test: (cx, cz) => cx >= 20 && cx < 125 && cz >= 324 && cz <= 372,
  },
  {
    id: 'fish-gate',
    zh: '鱼门（北城通道）',
    en: 'Fish Gate',
    ref: 'Neh 3:3; 12:39',
    test: (cx, cz) => cx >= -42 && cx <= 12 && cz >= 320 && cz <= 368,
  },
  {
    id: 'old-gate',
    zh: '古门（耶沙拿门）',
    en: 'Old Gate (Jeshanah)',
    ref: 'Neh 3:6; 12:39',
    test: (cx, cz) => cx >= -124 && cx < -68 && cz >= 320 && cz <= 368,
  },
  {
    id: 'broad-wall',
    zh: '宽墙（哈革玛哈拉哈巴 · 十六肘厚城垣）',
    en: 'The Broad Wall (HaChomah HaRechavah · 16 cubits thick)',
    ref: 'Neh 3:8; 12:38',
    test: (cx, cz) => cx >= -226 && cx <= -194 && cz >= 122 && cz <= 240,
  },
  {
    id: 'tower-furnaces',
    zh: '炉楼（西墙戍楼）',
    en: 'Tower of the Furnaces',
    ref: 'Neh 3:11; 12:38',
    test: (cx, cz) => cx >= -232 && cx <= -196 && cz >= 72 && cz < 122,
  },
  {
    id: 'valley-gate',
    zh: '谷门（夜间巡城起点 · 两班称谢诗班分道处）',
    en: 'Valley Gate · Parting Point of the Two Choirs',
    ref: 'Neh 2:13; 3:13; 12:31',
    test: (cx, cz) => cx >= -240 && cx <= -192 && cz >= -26 && cz <= 42,
  },
  {
    id: 'dung-gate',
    zh: '粪厂门（欣嫩子谷南端）',
    en: 'Dung Gate · Overlooking Hinnom Valley',
    ref: 'Neh 3:13–14; 12:31',
    test: (cx, cz) => cx >= -74 && cx <= -18 && cz >= -342 && cz <= -302,
  },
  {
    id: 'siloam-fountain',
    zh: '泉门、西罗亚池（设拉池）与王园梯田',
    en: 'Fountain Gate, Pool of Shelah (Siloam) & King’s Garden',
    ref: 'Neh 3:15; 12:37',
    test: (cx, cz) => cx >= -10 && cx <= 118 && cz >= -312 && cz <= -256,
  },
  {
    id: 'city-of-david-steps',
    zh: '从大卫城下来的阶梯与大卫宫旧址',
    en: 'Stairs of the City of David & House of David Terrace',
    ref: 'Neh 3:15; 12:37',
    test: (cx, cz) => cx >= 6 && cx <= 52 && cz > -256 && cz <= -182,
  },
  {
    id: 'water-gate-square',
    zh: '水门宽阔广场与以斯拉宣读律法书木台',
    en: 'Water Gate Square & Ezra’s Wooden Podium',
    ref: 'Neh 3:26; 8:1–8; 12:37',
    test: (cx, cz) => cx >= 30 && cx <= 108 && cz >= 4 && cz <= 64,
  },
  {
    id: 'ophel-tower',
    zh: '俄斐勒突出来的大楼',
    en: 'Great Projecting Tower of Ophel',
    ref: 'Neh 3:25–27',
    test: (cx, cz) => cx >= 76 && cx <= 116 && cz > 64 && cz <= 106,
  },
  {
    id: 'horse-gate',
    zh: '马门与祭司住宅段',
    en: 'Horse Gate & Priests’ Houses',
    ref: 'Neh 3:28',
    test: (cx, cz) => cx >= 122 && cx <= 178 && cz >= 96 && cz <= 136,
  },
  {
    id: 'east-gate',
    zh: '东门（正对圣殿与汲沦溪）',
    en: 'East Gate · Facing the Kidron Valley',
    ref: 'Neh 3:29',
    test: (cx, cz) => cx > 176 && cx <= 212 && cz >= 228 && cz <= 274,
  },
  {
    id: 'miphkad-gate',
    zh: '哈米弗甲门（检阅门）与城角楼',
    en: 'Inspection Gate (Miphkad) & Upper Chamber of the Corner',
    ref: 'Neh 3:31–32',
    test: (cx, cz) => cx > 176 && cx <= 212 && cz > 274 && cz <= 352,
  },
  {
    id: 'city-interior',
    zh: '耶路撒冷城内与大卫城山脊',
    en: 'Walled Jerusalem & City of David Ridge',
    ref: 'Neh 7:4; 11:1',
    test: (cx, cz) => insideCity(cx, cz),
  },
  {
    id: 'kidron-olives',
    zh: '汲沦溪谷与橄榄山坡',
    en: 'Kidron Valley & Mount of Olives',
    ref: 'Neh 2:15; 8:15',
    test: (cx) => cx > 90,
  },
  {
    id: 'hinnom-valley',
    zh: '欣嫩子谷与城外山坡',
    en: 'Valley of Hinnom & Outer Hills',
    ref: 'Neh 2:13–15; 11:30',
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
scene.fog = new THREE.Fog(0xd8ccb8, 260, 1280);

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromEquirectangular(skyTex);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.65;
pmrem.dispose();

loadingStep();

const hemi = new THREE.HemisphereLight('#fff3dc', '#887454', 0.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#fff0d2', 2.8);
sun.position.set(220, 195, -175);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 25;
sun.shadow.camera.far = 780;
const SHADOW_BOX = 215;
sun.shadow.camera.left = -SHADOW_BOX;
sun.shadow.camera.right = SHADOW_BOX;
sun.shadow.camera.top = SHADOW_BOX;
sun.shadow.camera.bottom = -SHADOW_BOX;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);

const nehemiah = buildNehemiah(DEFAULT_CUBIT);
scene.add(nehemiah.group);

loadingStep();

const noAo: THREE.Object3D[] = [];
nehemiah.group.traverse((o) => {
  if (o.userData.noAO || (o as THREE.Sprite).isSprite) noAo.push(o);
});

const camera = new THREE.PerspectiveCamera(
  58,
  Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
  0.2,
  1700,
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

const walker = new Walker(camera, canvas, nehemiah.colliders, {
  platforms: nehemiah.platforms,
  floorY: (x, z) => nehemiah.floorY(x, z),
});
scene.add(walker.yaw);
bindInputUi(walker);

function spawnOutsideValleyGate(): void {
  const cx = -232;
  const cz = 0;
  const ceil = (nehemiah.plan.groundC(cx, cz) + 4.5) * nehemiah.CUBIT;
  walker.moveTo(cx * nehemiah.CUBIT, cz * nehemiah.CUBIT, -Math.PI * 0.5, ceil);
}
spawnOutsideValleyGate();

const tour = new Tour(nehemiah.CUBIT, NEHEMIAH_TOUR);

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
  const c = nehemiah.counts;
  const rows = [
    { n: String(c.gates), en: 'Rebuilt city gates', zh: '重修城门', ref: 'Neh 3:1–32' },
    { n: String(c.towers), en: 'Named fortress towers', zh: '具名戍楼', ref: 'Neh 3:1, 11, 26' },
    { n: `${c.broadWallCubits}c`, en: 'Broad Wall thickness', zh: '宽墙厚度（肘）', ref: 'Neh 3:8; 12:38' },
    { n: `${c.templeCubits}×${c.templeCubits}c`, en: 'Second Temple span', zh: '重建圣殿尺度', ref: 'Ezra 6:3–4' },
    { n: String(c.daysRebuilt), en: 'Days to finish wall', zh: '修完城墙日数', ref: 'Neh 6:15' },
  ];
  tallyEl.innerHTML = rows
    .map((r) => `<div><b>${r.n}</b><span>${t(r.en, hant(r.zh))}</span><i>${hant(r.ref)}</i></div>`)
    .join('');
}

function populateStops(): void {
  const cur = tour.currentIndex;
  stopSelectEl.innerHTML = NEHEMIAH_TOUR.map(
    (s, i) => `<option value="${i}">${i + 1}/${NEHEMIAH_TOUR.length} · ${t(s.en, hant(s.zh))}</option>`,
  ).join('');
  stopSelectEl.value = String(Math.max(0, cur));
}

function setGate(visible: boolean): void {
  gateEl.classList.toggle('hidden', !visible);
}

function updateHud(): void {
  const c = nehemiah.CUBIT;
  const wp = walker.position;
  const cx = wp.x / c;
  const cz = wp.z / c;
  const cy = wp.y / c;

  if (pYouEl) {
    const px = Math.max(-248, Math.min(228, cx));
    const py = Math.max(-375, Math.min(355, -cz));
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
    const s = NEHEMIAH_TOUR[tour.currentIndex] ?? NEHEMIAH_TOUR[0]!;
    whereEl.textContent = t(s.en, hant(s.zh));
    whereEl.dataset.en = s.en;
    whereEl.dataset.zh = s.zh;
    verseEl.textContent = `${s.ref} · ${Math.round(cx)}c, ${Math.round(cz)}c · 1c=${c.toFixed(3)}m`;
    stopSelectEl.value = String(Math.max(0, tour.currentIndex));
    if (tourFillEl) {
      tourFillEl.style.width = `${(((tour.currentIndex + 1) / NEHEMIAH_TOUR.length) * 100).toFixed(1)}%`;
    }
  } else {
    whereEl.textContent = t(z.en, hant(z.zh));
    whereEl.dataset.en = z.en;
    whereEl.dataset.zh = z.zh;
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
  const gFloor = nehemiah.floorY(wp.x, wp.z);
  // If ending from a high aerial overview, set down cleanly on ground; otherwise keep current wall-walk or court level
  const ceiling = wp.y > nehemiah.MAX_WALL_Y + 8 * nehemiah.CUBIT ? gFloor + 6 * nehemiah.CUBIT : wp.y + 0.6;
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
  const idx = Math.max(0, Math.min(NEHEMIAH_TOUR.length - 1, index));
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
  spawnOutsideValleyGate();
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
    const [cxStr, czStr, yawStr, modeStr] = raw.split(',');
    const cx = Number(cxStr);
    const cz = Number(czStr);
    const yaw = yawStr !== undefined ? Number(yawStr) : 0;
    if (tour.running || tour.paused) endTour();
    setGate(false);
    hudEl.hidden = false;
    const ceiling =
      modeStr === 'wall'
        ? nehemiah.MAX_WALL_Y
        : (nehemiah.plan.groundC(cx, cz) + 4.8) * nehemiah.CUBIT;
    walker.moveTo(cx * nehemiah.CUBIT, cz * nehemiah.CUBIT, yaw, ceiling);
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
  const prevCubit = nehemiah.CUBIT;
  if (Math.abs(newCubit - prevCubit) < 1e-4) return;
  const pose = walker.pose;
  const cx = pose.x / prevCubit;
  const cy = (pose.y ?? 1.65) / prevCubit;
  const cz = pose.z / prevCubit;

  nehemiah.rescale(newCubit);
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
  walk: 'nehemiah',
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
  const tm = nehemiah.plan.temple;
  const target = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const probe = new THREE.CubeCamera(0.2, 160, target);
  probe.position.set(118 * nehemiah.CUBIT, (tm.level + tm.podium + 7) * nehemiah.CUBIT, 250 * nehemiah.CUBIT);
  probe.update(renderer, scene);
  const bake = new THREE.PMREMGenerator(renderer);
  const room = bake.fromCubemap(target.texture);
  nehemiah.group.traverse((o) => {
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

let firstFrameDrawn = false;
let lastT = performance.now();
let elapsed = 0;
function tick(now: number): void {
  if (firstFrameDrawn && (document.hidden || Boolean(measuresDialog?.open))) {
    lastT = now;
    requestAnimationFrame(tick);
    return;
  }
  const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
  lastT = now;
  elapsed += dt;

  nehemiah.update(dt, elapsed);

  if (tour.running) {
    const pose = tour.update(dt);
    if (pose) walker.setPose(pose);
    veilFadeEl.style.opacity = String(tour.fade.toFixed(3));
  } else if (!tour.paused) {
    walker.update(dt);
  }

  updateHud();
  composer.render();
  firstFrameDrawn = true;
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

(globalThis as unknown as Record<string, unknown>).__nehemiah = {
  scene,
  camera,
  renderer,
  walker,
  counts: nehemiah.counts,
  colliders: nehemiah.colliders,
  platforms: nehemiah.platforms,
  floorY: (x: number, z: number) => nehemiah.floorY(x, z),
  get CUBIT() {
    return nehemiah.CUBIT;
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
  TOUR: NEHEMIAH_TOUR,
  inspectStop,
  rescale: rescaledToCubit,
  snapshot,
  hant,
};
