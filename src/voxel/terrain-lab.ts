import * as THREE from 'three';
import { Grid } from './grid.ts';
import { MODELS, stamp } from './creatures.ts';
import {
  paintGround, carveRiver, scatterTrees, scatterVegetation, dressRiver, TREES, ROCKS, modelCost, noise, FINE_PER_CUBIT,
} from './terrain.ts';

// THE TERRAIN LAB: a patch of dressed ground with nothing on it but a few
// beasts for scale. It exists so the ground in terrain.ts can be looked at
// and costed on its own, before the ark scene is asked to carry it.

const CUBIT_M = 0.445;
const FPC = FINE_PER_CUBIT;
const FINEM = CUBIT_M / FPC;

// ── the world ────────────────────────────────────────────────────────────
const t0 = performance.now();
const coarse = new Grid();
const fine = new Grid();

// 120 × 80 cubits (53 × 36 m). The camera looks from +z toward -z, so the
// hills and the terrace the river falls off are at low z, "behind".
const field = { x0: 0, z0: 0, x1: 120, z1: 80 };
const ground = paintGround(coarse, {
  rect: field,
  relief: {
    height: 5, scale: 18,
    flat: { x0: 0, z0: 36, x1: 120, z1: 80 }, margin: 14,
    // a terrace across the back, three cubits up, with a ragged edge
    extra: (x, z) => { const edge = 24 + noise(x, 0, 9, 41) * 8; return 3 * Math.min(1, Math.max(0, (edge - z) / 3)); },
  },
  paths: [{ points: [[4, 72], [30, 62], [58, 58], [84, 50], [118, 46]], width: 3 }],
  ponds: [{ x: 100, z: 68, rx: 6, rz: 4 }],
});
const river = carveRiver(coarse, {
  ground, width: 4, bank: 1.5,
  points: [[22, 0], [34, 14], [46, 30], [56, 46], [66, 58], [80, 68], [92, 80]],
});
const camp = { x0: 44, z0: 60, x1: 76, z1: 78 };
const trees = scatterTrees(fine, {
  ground,
  avoid: (x, z) => x >= camp.x0 - 2 && x <= camp.x1 + 2 && z >= camp.z0 - 2 && z <= camp.z1 + 2,
});
const veg = scatterVegetation(fine, { ground });
const dress = dressRiver(fine, { river, ground });

// a few beasts and a man, for scale: they are authored at two blocks to
// the cubit, so at eight to the cubit they are stamped four times over
const at = (xc: number, zc: number): [number, number, number] => [Math.round(xc * FPC), ground.stand(FPC).y(Math.round(xc * FPC), Math.round(zc * FPC)), Math.round(zc * FPC)];
stamp(fine, MODELS.noah!, at(58, 66), 1, 4);
stamp(fine, MODELS.sheep!, at(62, 70), 3, 4);
stamp(fine, MODELS.sheep!, at(64, 73), 2, 4);
stamp(fine, MODELS.ox!, at(52, 72), 0, 4);
const buildMs = Math.round(performance.now() - t0);

// ── on screen ────────────────────────────────────────────────────────────
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed2f2);
scene.fog = new THREE.Fog(0xc4e3f7, 160, 500);

const sun = new THREE.DirectionalLight(0xfff2da, 2.4);
sun.position.set(-60, 90, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 10; sun.shadow.camera.far = 400;
const S = 70;
sun.shadow.camera.left = -S; sun.shadow.camera.right = S; sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0008;
scene.add(sun, new THREE.HemisphereLight(0xd6ecff, 0x7d6e4e, 1.2));

// the plane sits one cubit down, under the bottom of the ground layer, so
// its top face never fights the turf's
const plane = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: 0x74a24a }));
plane.rotation.x = -Math.PI / 2;
plane.position.y = -CUBIT_M - 0.01;
plane.receiveShadow = true;
scene.add(plane);

const a = coarse.build(CUBIT_M);
const b = fine.build(FINEM);
scene.add(a.mesh, b.mesh);

const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.5, 1400);
const focus = new THREE.Vector3(60 * CUBIT_M, 0.5, 44 * CUBIT_M);
const orbit = { yaw: -0.55, pitch: 0.52, dist: 62 };
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
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  orbit.yaw -= (e.clientX - drag.x) * 0.005;
  orbit.pitch = Math.min(1.3, Math.max(0.1, orbit.pitch + (e.clientY - drag.y) * 0.004));
  drag = { x: e.clientX, y: e.clientY };
  place();
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.min(300, Math.max(5, orbit.dist * (1 + Math.sign(e.deltaY) * 0.08))); place(); }, { passive: false });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ── the bill ─────────────────────────────────────────────────────────────
const costs = Object.fromEntries([...Object.entries(TREES), ...Object.entries(ROCKS)].map(([k, m]) => [k, modelCost(m)]));
const stats = {
  buildMs,
  coarse: { drawn: a.drawn, hidden: a.hidden, map: coarse.size, ground: ground.blocks, river: river.blocks },
  fine: { drawn: b.drawn, hidden: b.hidden, map: fine.size, trees: trees.blocks, vegetation: veg.blocks, riverDress: dress.blocks },
  placed: { trees: trees.placed.length, plants: veg.placed, riverDress: dress.placed },
  treeKinds: trees.placed.reduce<Record<string, number>>((m, p) => { m[p.kind] = (m[p.kind] ?? 0) + 1; return m; }, {}),
  costs,
};
const el = document.getElementById('stats');
if (el) el.textContent =
  `coarse ${a.drawn.toLocaleString()} drawn (ground ${ground.blocks.toLocaleString()}, river ${river.blocks.toLocaleString()})  ·  `
  + `fine ${b.drawn.toLocaleString()} drawn / ${fine.size.toLocaleString()} in map (trees ${trees.blocks.toLocaleString()} × ${trees.placed.length}, `
  + `plants ${veg.blocks.toLocaleString()} × ${veg.placed}, reeds+lilies ${dress.blocks.toLocaleString()})  ·  ${buildMs} ms`;

declare global {
  interface Window {
    __lab: {
      stats: typeof stats; orbit: typeof orbit; focus: THREE.Vector3;
      view: (yaw: number, pitch: number, dist: number, fxCubits?: number, fzCubits?: number) => void;
      hideStats: () => void; ready: boolean;
    };
  }
}
window.__lab = {
  stats, orbit, focus,
  view: (yaw, pitch, dist, fx, fz) => {
    orbit.yaw = yaw; orbit.pitch = pitch; orbit.dist = dist;
    if (fx !== undefined && fz !== undefined) focus.set(fx * CUBIT_M, 0.5, fz * CUBIT_M);
    place();
    renderer.render(scene, camera);
  },
  hideStats: () => { if (el) el.style.display = 'none'; },
  ready: true,
};

place();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
