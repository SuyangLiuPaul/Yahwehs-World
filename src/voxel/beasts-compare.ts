import * as THREE from 'three';
import { Grid } from './grid.ts';
import { stamp, measure, type Model } from './creatures.ts';
import * as opus from './beasts-opus.ts';
import * as cute from './beasts-cute.ts';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// THE BAKE-OFF. Two authors, the same brief, the same camera, the same light.
// Whichever entrants exist get stamped in a row; a missing one is skipped, so
// this page renders whether the other side has landed yet or not.

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc9f0);
const sun = new THREE.DirectionalLight(0xffd9a0, 3.5);
sun.position.set(-30, 50, 60); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 200 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
scene.add(sun, new THREE.HemisphereLight(0x9fc2d6, 0x6d7f74, 4.5));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x9aa254 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const BLOCK = 0.445 / 8;
const labels: { text: string; x: number; h: number }[] = [];

async function main() {
  // the other entrant writes its own file; load it only if it is there
  // The path is built at run time so TypeScript does not demand the file
  // exist: the other entrant may not have landed yet, and this page should
  // still render what it has.
  let fable: { GIRAFFE?: Model; ELEPHANT?: Model } = {};
  try { fable = await import(/* @vite-ignore */ `./beasts-${'fable'}.ts`); } catch { fable = {}; }

  const entries: [string, Model | undefined][] = [
    ['giraffe · cute (Opus)', cute.GIRAFFE_CUTE],
    ['elephant · cute (Opus)', cute.ELEPHANT_CUTE],
    ['giraffe · Opus', opus.GIRAFFE],
    ['giraffe · Fable', fable.GIRAFFE],
    ['elephant · Opus', opus.ELEPHANT],
    ['elephant · Fable', fable.ELEPHANT],
  ];

  // ?only=cute renders just the entrants whose label contains that text, and
  // skips the bought models, so a single design can be judged up close.
  const only = new URLSearchParams(location.search).get('only');
  const grid = new Grid();
  let x = 0;
  for (const [name, model] of entries) {
    if (!model) continue;
    if (only && !name.includes(only)) continue;
    const s = measure(model);
    stamp(grid, model, [x - s.x0, 0, 0], 0, 1);
    labels.push({ text: `${name} — ${s.height}b, ${(s.height * BLOCK).toFixed(2)} m, ${model.boxes.length} boxes`, x: (x + s.length / 2) * BLOCK, h: (s.height + 8) * BLOCK });
    x += s.length + 26;
  }
  const built = grid.build(BLOCK);
  const dbg = new URLSearchParams(location.search);
  if (dbg.get('double')) (built.mesh.material as THREE.Material).side = THREE.DoubleSide;
  if (dbg.get('noshadow')) { built.mesh.castShadow = false; built.mesh.receiveShadow = false; }
  scene.add(built.mesh);
  (window as unknown as { __tris: number }).__tris = built.faces * 2;

  // AND THE READY-MADE ONES, loaded as they come — no voxelising. Both of
  // these are already stylised blocky animals built by hand; running them
  // through a voxeliser only destroys what makes them good.
  const loader = new GLTFLoader();
  const bought: [string, string, number][] = [
    ['giraffe · Kenney (CC0)', 'animal-giraffe', 5.23],
    ['giraffe · Poly by Google (CC-BY)', 'pp-giraffe', 5.23],
    ['elephant · Kenney (CC0)', 'animal-elephant', 3.12],
    ['elephant · Poly by Google (CC-BY)', 'pp-elephant', 3.12],
  ];
  for (const [name, file, metres] of only ? [] : bought) {
    const gltf = await loader.loadAsync(`/models/kenney/${file}.glb`).catch(() => null);
    if (!gltf) continue;
    const root = gltf.scene;
    // Some of these are Z-up (Poly by Google exports that way), which lands
    // the animal on its side. If the model is deeper than it is tall, stand
    // it up before measuring anything.
    let box = new THREE.Box3().setFromObject(root);
    let size = box.getSize(new THREE.Vector3());
    if (size.z > size.y * 1.6) {
      root.rotation.x = -Math.PI / 2;
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root);
      size = box.getSize(new THREE.Vector3());
    }
    root.scale.setScalar(metres / Math.max(size.y, 1e-4));
    box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(x * BLOCK + (box.max.x - box.min.x) / 2 - c.x, -box.min.y, -c.z);
    root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(root);
    let tris = 0;
    root.traverse((o) => { if (o instanceof THREE.Mesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
    labels.push({ text: `${name} — ${Math.round(tris).toLocaleString()} tris`, x: x * BLOCK + (box.max.x - box.min.x) / 2, h: metres + 0.8 });
    x += Math.round((box.max.x - box.min.x) / BLOCK) + 26;
  }

  // Frame the row properly: work out the distance from whichever is binding,
  // the row's width or the tallest animal, instead of guessing a multiple of
  // the span — which put the camera four metres from a five-metre giraffe.
  const span = x * BLOCK;
  const tallest = (only ? 5.6 : 5.23 * 1.02);
  const fov = 24, aspect = innerWidth / innerHeight;
  const half = THREE.MathUtils.degToRad(fov) / 2;
  const forHeight = (tallest * 1.35 / 2) / Math.tan(half);
  const forWidth = (span * 1.05 / 2) / Math.tan(half) / aspect;
  const dist = Math.max(forHeight, forWidth);
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 900);
  const yaw = only ? -0.7 : 0.42, pitch = only ? 0.22 : 0.32;                       // a three-quarter view, ~18° up
  const at = new THREE.Vector3(span * 0.5, tallest * 0.45, 0);
  camera.position.set(
    at.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    at.y + Math.sin(pitch) * dist,
    at.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(at);
  sun.target.position.copy(at); sun.target.updateMatrixWorld(); scene.add(sun.target);
  const S = Math.max(span, tallest) * 0.8;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
  sun.shadow.camera.updateProjectionMatrix();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  // Wait for every texture to actually decode before declaring the page
  // ready. The first screenshot caught Kenney's models mid-load and they came
  // out plain white — the geometry was there, the colormap was not.
  await new Promise<void>((resolve) => {
    if (!THREE.DefaultLoadingManager.itemStart) return resolve();
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    THREE.DefaultLoadingManager.onLoad = done;
    setTimeout(done, 4000);                       // never hang on a missing file
  });
  // one more frame so the freshly decoded textures are uploaded
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const w = window as unknown as { __ready: boolean; __labels: typeof labels; __blocks: number };
  w.__labels = labels; w.__blocks = built.drawn; w.__ready = true;
}
void main();
