import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { buildTabernacle } from './tabernacle.ts';
import { Walker } from './controls.ts';

const CUBIT = 0.445;   // the common cubit; the card feed carries the argument

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9db4c8);
scene.fog = new THREE.Fog(0x9db4c8, 40, 190);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;

const camera = new THREE.PerspectiveCamera(
  72, Math.max(1, innerWidth) / Math.max(1, innerHeight), 0.05, 400);

// Desert noon: one hard sun, a warm bounce off the sand, a cool sky fill.
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.set(38, 52, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 160;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbcd4e8, 0xc8b590, 1.1));

const { group, colliders, counts } = buildTabernacle(CUBIT);
group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(group);

const walker = new Walker(camera, canvas, colliders);
scene.add(walker.yaw);
// Standing outside the eastern gate, looking in — the way anyone approaching
// the tabernacle would have come to it. A yaw of +PI/2 turns the camera's own
// -Z toward -X, which is where the court lies; -PI/2 faces the empty desert.
walker.moveTo(CUBIT * 62, 0, Math.PI / 2);

// ── where you are ─────────────────────────────────────────────────────────
// Named zones rather than coordinates, each carrying the verse that defines it.
const ZONES: { test: (x: number, z: number) => boolean; zh: string; ref: string }[] = [
  { zh: '至圣所', ref: '出 26:33–34',
    test: (x) => x < CUBIT * -20 },
  { zh: '圣所', ref: '出 26:33',
    test: (x) => x < CUBIT * 0 },
  { zh: '会幕内', ref: '出 26:15',
    test: (x) => x < CUBIT * 10 },
  { zh: '院内 · 铜坛旁', ref: '出 27:1',
    test: (x) => x > CUBIT * 20 && x < CUBIT * 36 },
  { zh: '院子内', ref: '出 27:18',
    test: (x, z) => Math.abs(x) < CUBIT * 50 && Math.abs(z) < CUBIT * 25 },
];

const gateEl = document.getElementById('gate')!;
const hud = document.getElementById('hud')!;
const whereEl = document.getElementById('where')!;
const verseEl = document.getElementById('verse')!;

document.getElementById('tally')!.innerHTML = [
  [counts.courtPillars, '院子的柱子', '出 27:10–16'],
  [counts.boards, '竖板', '出 26:18–25'],
  [counts.sockets, '带卯的座', '出 26:19'],
  [counts.bars, '横闩', '出 26:26–27'],
  [counts.clasps, '金钩', '出 26:6'],
  [counts.curtains, '幔子', '出 26:1'],
].map(([n, zh, ref]) => `<li><b>${n}</b><span>${zh}</span><i>${ref}</i></li>`).join('');

document.getElementById('enter')!.addEventListener('click', () => canvas.click());
walker.onLockChange = (locked) => {
  gateEl.classList.toggle('hidden', locked);
  hud.hidden = !locked;
};

let lastZone = '';
function updateHud() {
  const { x, z } = walker.position;
  const zone = ZONES.find((zn) => zn.test(x, z));
  const name = zone?.zh ?? '院外';
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

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  walker.update(Math.min(clock.getDelta(), 0.1));
  updateHud();
  renderer.render(scene, camera);
});

if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__walk = {
    scene, camera, renderer, walker, counts, colliders, CUBIT,
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
