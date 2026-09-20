import * as THREE from 'three';
import { Grid, PALETTE } from './grid.ts';
import { MODELS, stamp } from './creatures.ts';
import { PROPS, scatter } from './props.ts';

// A CONTACT SHEET OF THE PROPS. Every prop from props.ts, stamped in a
// labelled grid under the same light and the same camera angle as the ark
// page, so each can be judged as it will be seen. Not a page of the site.
//   ?only=crate,barrel   a subset, larger
//   ?scatter=1           the scatter() test instead of the grid

const CUBIT_M = 0.445, FINEM = CUBIT_M / 8;      // props are authored at an eighth of a cubit
const q = new URLSearchParams(location.search);
const only = q.get('only')?.split(',').filter(Boolean);
const names = only && only.length ? only : Object.keys(PROPS);

const grid = new Grid();
const labels: { text: string; at: THREE.Vector3 }[] = [];

if (q.get('scatter')) {
  // the scatter test: a yard, with a few beasts as things to avoid
  const W = 240, D = 140;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) grid.set(x, -1, z, PALETTE.dirt!);
  const items = Object.entries(PROPS).map(([name, model]) => ({ name, model, count: 2 }));
  const placed = scatter(grid, items, { x0: 0, z0: 0, x1: W - 1, z1: D - 1, seed: Number(q.get('seed') ?? 7), gap: 2 });
  labels.push({ text: `${placed.length} placed of ${items.length * 2}`, at: new THREE.Vector3(W / 2 * FINEM, 0, (D + 4) * FINEM) });
} else {
  const CELL = Number(q.get('cell') ?? (only ? 44 : 40)), COLS = only ? Math.min(names.length, 4) : 8;
  names.forEach((name, i) => {
    const m = PROPS[name];
    if (!m) return;
    const cx = (i % COLS) * CELL, cz = Math.floor(i / COLS) * CELL;
    for (let x = 0; x < CELL - 2; x++) for (let z = 0; z < CELL - 2; z++) grid.set(cx + x, -1, cz + z, (i % 2 ? PALETTE.dirt : PALETTE.sand)!);
    // centre the prop's footprint in the cell
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [bx0, , bz0, bx1, , bz1] of m.boxes) { x0 = Math.min(x0, bx0); x1 = Math.max(x1, bx1); z0 = Math.min(z0, bz0); z1 = Math.max(z1, bz1); }
    const ox = cx + Math.round((CELL - 2 - (x1 - x0 + 1)) / 2) - x0, oz = cz + Math.round((CELL - 2 - (z1 - z0 + 1)) / 2) - z0;
    stamp(grid, m, [ox, 0, oz], 0, 1);
    labels.push({ text: `${name} ${x1 - x0 + 1}×${m.height}×${z1 - z0 + 1}`, at: new THREE.Vector3((cx + (CELL - 2) / 2) * FINEM, 0, (cz + CELL - 1) * FINEM) });
  });
  // a man for scale, in a spare column at the end of the first row
  const cx = COLS * CELL, cz = 0;
  for (let x = 0; x < CELL - 2; x++) for (let z = 0; z < CELL - 2; z++) grid.set(cx + x, -1, cz + z, PALETTE.grass!);
  stamp(grid, MODELS.worker!, [cx + 12, 0, cz + 12], 3, 4);
  labels.push({ text: 'man, 32 tall', at: new THREE.Vector3((cx + (CELL - 2) / 2) * FINEM, 0, (cz + CELL - 1) * FINEM) });
}

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed2f2);
const { mesh } = grid.build(FINEM);
scene.add(mesh);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x74a24a }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -FINEM; ground.receiveShadow = true;
scene.add(ground);

const box = new THREE.Box3().setFromObject(mesh);
const centre = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());

const sun = new THREE.DirectionalLight(0xfff2da, 2.4);
sun.position.set(centre.x - 60, 75, centre.z + 60);
sun.target.position.copy(centre);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const R = Math.max(size.x, size.z) * 0.8;
sun.shadow.camera.left = -R; sun.shadow.camera.right = R; sun.shadow.camera.top = R; sun.shadow.camera.bottom = -R;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target, new THREE.HemisphereLight(0xd6ecff, 0x7d6e4e, 1.2));

// the ark page's angle: yaw −0.5, pitch 0.42 — orthographic, so every cell is seen alike
const yaw = Number(q.get('yaw') ?? -0.5), pitch = Number(q.get('pitch') ?? 0.42);
const aspect = innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
const dist = 300;
camera.position.set(centre.x + Math.sin(yaw) * Math.cos(pitch) * dist, centre.y + Math.sin(pitch) * dist, centre.z + Math.cos(yaw) * Math.cos(pitch) * dist);
camera.lookAt(centre);
camera.updateMatrixWorld();
camera.matrixWorldInverse.copy(camera.matrixWorld).invert();   // only refreshed at render otherwise
// fit the frustum to the eight corners of what was built, seen from that angle
let fx = 0, fy = 0;
for (const cx of [box.min.x, box.max.x]) for (const cy of [box.min.y - 1, box.max.y]) for (const cz of [box.min.z, box.max.z + 2]) {
  const v = new THREE.Vector3(cx, cy, cz).applyMatrix4(camera.matrixWorldInverse);
  fx = Math.max(fx, Math.abs(v.x)); fy = Math.max(fy, Math.abs(v.y));
}
const halfW = Math.max(fx, fy * aspect) * 1.04, halfH = halfW / aspect;
camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
camera.updateProjectionMatrix();

const layer = document.getElementById('labels')!;
for (const { text, at } of labels) {
  const el = document.createElement('div');
  el.className = 'label'; el.textContent = text;
  const p = at.clone().project(camera);
  el.style.left = `${((p.x + 1) / 2) * innerWidth}px`;
  el.style.top = `${((1 - p.y) / 2) * innerHeight}px`;
  layer.appendChild(el);
}

renderer.render(scene, camera);
(window as unknown as { __sheetReady: boolean }).__sheetReady = true;
