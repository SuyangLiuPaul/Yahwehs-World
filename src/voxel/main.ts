import * as THREE from 'three';
import { buildArkWorld, CUBITS, FINE } from './ark-scene.ts';
import { loadVoxSet, type VoxModel } from './vox.ts';

// THE BLOCK WORLD, ON SCREEN.
//
// The owner sent three pictures of a game — ark, tabernacle, temple — and
// asked for that. This page is the honest half of that picture: the camera
// angle, the warm light, the blocky beasts and the panel furniture are all
// matched on purpose, and the building underneath them is the one the text
// measures rather than the one the picture draws. Everything here is
// generated from numbers when the page loads; not one model file is fetched.

const CUBIT_M = 0.445;                 // the common cubit, as src/structures/specs.ts
const COARSE = CUBIT_M;                // the ark: one block to the cubit
const FINEM = CUBIT_M / FINE;          // people and beasts: four blocks to the cubit

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed2f2);
scene.fog = new THREE.Fog(0xc4e3f7, 220, 700);

// A bright, kind morning: a low sun from the left, a blue sky bounce and a
// warm bounce off the ground, which is what keeps the side of a plank the sun
// misses from going black.
const sun = new THREE.DirectionalLight(0xfff4e0, 2.15);
sun.position.set(-120, 150, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 600;
const S = 120;
sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0012;
scene.add(sun, new THREE.HemisphereLight(0xdceeff, 0x8f7f5c, 1.55));

// A lamp in the doorway. One point light, and it does the job the reference
// picture's glowing door does: it says the way in is open and somebody is home.
// Intensity 260 over 26 metres washed a bright disc across the hull the size
// of a house. A lamp is a lamp: enough to warm the doorway and a stride of
// the ramp, and no further.
const doorLamp = new THREE.PointLight(0xffc781, 26, 11, 2);
scene.add(doorLamp);

// The ground is a plane, not blocks: a field of grass a hundred metres across
// would be two hundred thousand cubes to say one flat green thing.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400),
  new THREE.MeshLambertMaterial({ color: 0x74a24a }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.5, 1400);

// ── the far country ──────────────────────────────────────────────────────
// Hills on the horizon and a few clouds. Not blocks: half a dozen flat shapes
// behind the fog do the same work for nothing, and no verse is involved.
const hills = new THREE.Group();
for (let i = 0; i < 14; i++) {
  const w = 120 + (i * 53) % 220, h = 26 + (i * 31) % 46;
  const hill = new THREE.Mesh(
    new THREE.ConeGeometry(w * 0.5, h, 4),
    new THREE.MeshLambertMaterial({ color: i % 3 ? 0x6f8a5e : 0x8a9a76 }),
  );
  const a = (i / 14) * Math.PI * 2;
  hill.position.set(66 + Math.cos(a) * 520, h / 2 - 4, 22 + Math.sin(a) * 520);
  hill.rotation.y = a;
  hills.add(hill);
}
scene.add(hills);
for (let i = 0; i < 16; i++) {
  const cloud = new THREE.Mesh(
    new THREE.BoxGeometry(18 + (i * 7) % 26, 5, 10 + (i * 5) % 14),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  cloud.position.set(((i * 97) % 400) - 60, 78 + (i % 4) * 9, ((i * 61) % 300) - 90);
  scene.add(cloud);
}

// ── the world ────────────────────────────────────────────────────────────

let built: THREE.Mesh[] = [];
const state = { cutaway: false, scenery: true };
// The voxelised creatures, fetched once. Until they arrive the scene draws the
// hand-built ones, so the page is never empty waiting on a download.
let vox: Record<string, VoxModel> = {};

function raise() {
  const t0 = performance.now();
  for (const m of built) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); scene.remove(m); }
  built = [];
  const world = buildArkWorld({ cutaway: state.cutaway, scenery: state.scenery, vox });
  doorLamp.position.set(world.door.x * COARSE, 2.2, (CUBITS.breadth - 4) * COARSE);
  doorLamp.visible = !state.cutaway;
  const a = world.coarse.build(COARSE);
  const b = world.fine.build(FINEM);
  built = [a.mesh, b.mesh];
  scene.add(a.mesh, b.mesh);
  const ms = Math.round(performance.now() - t0);
  const stats = document.getElementById('stats');
  if (stats) {
    stats.textContent =
      `${CUBITS.length}×${CUBITS.breadth}×${CUBITS.height} 肘 · ${(CUBITS.length * CUBIT_M).toFixed(0)} m · `
      + `${(a.drawn + b.drawn).toLocaleString()} blocks · ${((a.faces + b.faces) * 2).toLocaleString()} triangles · ${ms} ms`;
  }
}

// ── camera: a diorama, turned but not flown ──────────────────────────────
//
// The reference pictures are all one shot: three-quarters from above, close
// to 35°. That angle IS the look, so the camera keeps it and only turns and
// zooms. Letting it fly would show the scene from angles nobody dressed,
// which is how a diorama stops looking like one.
const focus = new THREE.Vector3(CUBITS.length * COARSE * 0.5, 6, CUBITS.breadth * COARSE * 1.6);
const orbit = { yaw: -0.5, pitch: 0.42, dist: 180 };
function place() {
  camera.position.set(
    focus.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
    focus.y + Math.sin(orbit.pitch) * orbit.dist,
    focus.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
  );
  camera.lookAt(focus);
  sun.target.position.copy(focus);
  sun.target.updateMatrixWorld();
}
scene.add(sun.target);

let drag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', (e) => { drag = null; canvas.releasePointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  orbit.yaw -= (e.clientX - drag.x) * 0.005;
  orbit.pitch = Math.min(1.2, Math.max(0.12, orbit.pitch + (e.clientY - drag.y) * 0.004));
  drag = { x: e.clientX, y: e.clientY };
  place();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  orbit.dist = Math.min(460, Math.max(30, orbit.dist * (1 + Math.sign(e.deltaY) * 0.08)));
  place();
}, { passive: false });

// ── the panel furniture ──────────────────────────────────────────────────

const press = (id: string, on: boolean) => document.getElementById(id)?.setAttribute('aria-pressed', String(on));

document.getElementById('b-cutaway')?.addEventListener('click', () => {
  state.cutaway = !state.cutaway; press('b-cutaway', state.cutaway); raise();
});
document.getElementById('b-scenery')?.addEventListener('click', () => {
  state.scenery = !state.scenery; press('b-scenery', state.scenery); raise();
});
const VIEWS: Record<string, [number, number, number]> = {
  'v-wide': [-0.5, 0.42, 180], 'v-door': [-0.35, 0.22, 52], 'v-end': [-1.45, 0.3, 120],
};
for (const [id, [yaw, pitch, dist]] of Object.entries(VIEWS)) {
  document.getElementById(id)?.addEventListener('click', () => {
    orbit.yaw = yaw; orbit.pitch = pitch; orbit.dist = dist; place();
    for (const o of Object.keys(VIEWS)) press(o, o === id);
  });
}
document.getElementById('b-photo')?.addEventListener('click', () => {
  press('b-photo', document.body.classList.toggle('photo'));
});

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// A handle for looking at the scene from a script, the way the crowd bench
// exposes window.__crowd.
declare global { interface Window { __voxel: { orbit: typeof orbit; focus: THREE.Vector3; place: () => void; state: typeof state; raise: () => void } } }
window.__voxel = { orbit, focus, place, state, raise };

raise();
place();
void loadVoxSet(['sheep', 'cow', 'ox', 'ass', 'horse', 'swine', 'wolf'])
  .then((got) => { if (Object.keys(got).length) { vox = got; raise(); } });
press('b-scenery', true);
press('v-wide', true);
renderer.setAnimationLoop(() => renderer.render(scene, camera));
