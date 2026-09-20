import * as THREE from 'three';
import { Grid } from './grid.ts';
import { MODELS, stamp, measure } from './creatures.ts';
import { stampVox, type VoxModel } from './vox.ts';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// A BAKE-OFF. The same giraffe and the same elephant, from every source we
// have, standing in a row at the same real height, lit the same way. The point
// is to answer one question by eye: is a hand-typed model, a voxelised
// low-poly model, or a purpose-built voxel model the one worth building on.

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc9f0);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(-40, 60, 70); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 250 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0012;
scene.add(sun, new THREE.HemisphereLight(0xcfe3ff, 0xb8a070, 0.8));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x84a558 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const BLOCK = 0.445 / 8;                       // the scene's fine grid
const load = (n: string) => fetch(`/models/vox2/${n}.json`).then((r) => r.ok ? r.json() as Promise<VoxModel> : null).catch(() => null);

const labels: { text: string; x: number; h: number }[] = [];

async function main() {
  const [gk, ek, epp] = await Promise.all([load('giraffe-k'), load('elephant-k'), load('elephant-pp')]);
  const grid = new Grid();
  let x = 0;
  const put = (name: string, place: (at: [number, number, number]) => void, wide: number, tall: number) => {
    place([x + Math.round(wide / 2), 0, 0]);
    labels.push({ text: name, x: (x + wide / 2) * BLOCK, h: (tall + 6) * BLOCK });
    x += wide + 24;
  };
  const hand = (key: string) => {
    const m = MODELS[key]!; const s = measure(m);
    put(`${key} — hand-typed`, (at) => stamp(grid, m, at, 0, 1), s.length, s.height);
  };
  hand('giraffe');
  if (gk) put('giraffe — Kenney cube-pets (CC0)', (at) => stampVox(grid, gk, at, 1), gk.size[2], gk.size[1]);
  hand('elephant');
  if (ek) put('elephant — Kenney cube-pets (CC0)', (at) => stampVox(grid, ek, at, 1), ek.size[2], ek.size[1]);
  if (epp) put('elephant — Poly by Google (CC-BY)', (at) => stampVox(grid, epp, at, 1), epp.size[2], epp.size[1]);

  const { mesh } = grid.build(BLOCK);
  scene.add(mesh);

  // AND THE THIRD OPTION: Kenney's cube-pets loaded AS THEY ARE, no
  // voxelising at all. They are already blocky animals with faces, built by
  // hand; running them through a voxeliser only destroys what makes them
  // good. The research said this plainly and it is worth seeing side by side.
  const loader = new GLTFLoader();
  const asIs: [string, number][] = [['animal-giraffe', 5.23], ['animal-elephant', 3.12], ['animal-lion', 1.39], ['animal-cow', 1.45]];
  for (const [file, metres] of asIs) {
    const gltf = await loader.loadAsync(`/models/kenney/${file}.glb`).catch(() => null);
    if (!gltf) continue;
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.setScalar(metres / Math.max(size.y, 1e-4));
    const after = new THREE.Box3().setFromObject(root);
    const c = after.getCenter(new THREE.Vector3());
    root.position.set(x * BLOCK - c.x, -after.min.y, -c.z);
    root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(root);
    labels.push({ text: `${file} — Kenney, used as-is`, x: x * BLOCK, h: metres + 0.6 });
    x += Math.round((after.max.x - after.min.x) / BLOCK) + 30;
  }

  const span = x * BLOCK;
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(span * 0.5 - span * 0.25, span * 0.20, span * 0.55);
  camera.lookAt(span * 0.5, 2.4, 0);
  sun.target.position.set(span * 0.5, 2, 0); sun.target.updateMatrixWorld(); scene.add(sun.target);
  renderer.render(scene, camera);
  (window as unknown as { __ready: boolean; __labels: typeof labels }).__ready = true;
  (window as unknown as { __labels: typeof labels }).__labels = labels;
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}
void main();
