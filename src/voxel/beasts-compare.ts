import * as THREE from 'three';
import { Grid } from './grid.ts';
import { stamp, measure, type Model } from './creatures.ts';
import * as opus from './beasts-opus.ts';

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
    ['giraffe · Opus', opus.GIRAFFE],
    ['giraffe · Fable', fable.GIRAFFE],
    ['elephant · Opus', opus.ELEPHANT],
    ['elephant · Fable', fable.ELEPHANT],
  ];

  const grid = new Grid();
  let x = 0;
  for (const [name, model] of entries) {
    if (!model) continue;
    const s = measure(model);
    stamp(grid, model, [x - s.x0, 0, 0], 0, 1);
    labels.push({ text: `${name} — ${s.height}b, ${(s.height * BLOCK).toFixed(2)} m, ${model.boxes.length} boxes`, x: (x + s.length / 2) * BLOCK, h: (s.height + 8) * BLOCK });
    x += s.length + 26;
  }
  const built = grid.build(BLOCK);
  scene.add(built.mesh);

  // Frame the row properly: work out the distance from whichever is binding,
  // the row's width or the tallest animal, instead of guessing a multiple of
  // the span — which put the camera four metres from a five-metre giraffe.
  const span = x * BLOCK;
  const tallest = Math.max(...entries.filter(([, m]) => m).map(([, m]) => measure(m!).height)) * BLOCK;
  const fov = 24, aspect = innerWidth / innerHeight;
  const half = THREE.MathUtils.degToRad(fov) / 2;
  const forHeight = (tallest * 1.35 / 2) / Math.tan(half);
  const forWidth = (span * 1.05 / 2) / Math.tan(half) / aspect;
  const dist = Math.max(forHeight, forWidth);
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 900);
  const yaw = 0.42, pitch = 0.32;                       // a three-quarter view, ~18° up
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
  const w = window as unknown as { __ready: boolean; __labels: typeof labels; __blocks: number };
  w.__labels = labels; w.__blocks = built.drawn; w.__ready = true;
}
void main();
