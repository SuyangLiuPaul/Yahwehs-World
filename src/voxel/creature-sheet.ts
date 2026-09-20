import * as THREE from 'three';
import { Grid } from './grid.ts';
import { BLOCK_M, MODELS, stamp, type Model, measure } from './creatures.ts';

// A CONTACT SHEET OF THE CREATURES.
//
// Every model in creatures.ts stood in a row on a green ground, labelled, lit
// the way the ark page lights them and seen from its camera angle — so a
// change to one animal can be judged against the others at a glance, and so
// the sizes can be checked side by side, which is the point of the file.
// Dev-only: voxel-creatures.html is not in the build.
//
//   ?names=sheep,ram,goat   a subset, framed close
//   ?turn=1                 quarter turns, to see the other side
//   ?gap=8                  blocks between neighbours

const q = new URLSearchParams(location.search);
const names = (q.get('names')?.split(',').filter((n) => n in MODELS)) ?? Object.keys(MODELS);
// turn 3 faces the camera; the row runs across the screen from left to right
const turn = Number(q.get('turn') ?? 3);
const gap = Number(q.get('gap') ?? 6);

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed2f2);

const sun = new THREE.DirectionalLight(0xfff2da, 2.4);
sun.position.set(-40, 60, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
sun.shadow.bias = -0.0008;
scene.add(sun, new THREE.HemisphereLight(0xd6ecff, 0x7d6e4e, 1.2));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: 0x74a24a }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ── the row ──────────────────────────────────────────────────────────────
const grid = new Grid();
let cursor = 0;
const labels: { text: string; x: number; z: number; h: number; w: number }[] = [];
for (const name of names) {
  const m: Model = MODELS[name]!;
  const size = measure(m);
  // the model's footprint after the turn: an odd turn swaps length and width
  const across = turn % 2 ? size.width : size.length;
  // stand each one centred on the cursor, so a wide one and a narrow one
  // both sit under their label; the origin is on the spine at the front legs
  const centre = cursor + across / 2;
  const originX = turn === 0 ? centre - (size.x0 + size.length / 2)
    : turn === 2 ? centre + (size.x0 + size.length / 2)
    : centre;                                                         // z is already centred
  stamp(grid, m, [Math.round(originX), 0, 0], turn, 1);
  const metres = (m.height * BLOCK_M).toFixed(2);
  labels.push({ text: `${name} ${m.height}b · ${metres} m`, x: centre * BLOCK_M, z: 0, h: (m.height + 2) * BLOCK_M, w: Math.max(across, 14) * BLOCK_M });
  cursor += across + gap;
}
const { mesh, drawn } = grid.build(BLOCK_M);
scene.add(mesh);

// labels as sprites, so they turn with the camera
for (const l of labels) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(248,243,232,.92)'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#3b2f22'; g.font = '600 44px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(l.text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  const w = Math.max(l.w * 1.6, 1.2);
  sp.scale.set(w, w * (96 / 640), 1);
  sp.position.set(l.x, l.h + 0.2, l.z);
  scene.add(sp);
}

// ── camera: three-quarter view, thirty degrees above the horizon ─────────
const rowW = cursor * BLOCK_M;
const rowH = Math.max(...names.map((n) => MODELS[n]!.height)) * BLOCK_M;
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 2000);
const focus = new THREE.Vector3(rowW / 2, rowH * 0.4, 0);
const span = Math.max(rowW * 1.02, rowH * 2.2);
const dist = (span / 2) / Math.tan(THREE.MathUtils.degToRad(36 / 2)) / Math.max(1, camera.aspect) * 1.05 + 4;
const yaw = -0.6, pitch = THREE.MathUtils.degToRad(30);
camera.position.set(
  focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
  focus.y + Math.sin(pitch) * dist,
  focus.z + Math.cos(yaw) * Math.cos(pitch) * dist,
);
camera.lookAt(focus);
sun.target.position.copy(focus);
scene.add(sun.target);
const S = Math.max(rowW, 20);
sun.shadow.camera.left = -S; sun.shadow.camera.right = S; sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
sun.shadow.camera.updateProjectionMatrix();

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
// frames are counted so a screenshot script can wait for a drawn one
declare global { interface Window { __sheetReady: boolean; __sheetFrames: number; __sheet: Record<string, unknown> } }
window.__sheetFrames = 0;
window.__sheet = { names, drawn, rowW, rowH, dist, camera: camera.position.toArray(), focus: focus.toArray(), renderer, mesh, scene };
renderer.setAnimationLoop(() => { renderer.render(scene, camera); window.__sheetFrames++; });
window.__sheetReady = true;
