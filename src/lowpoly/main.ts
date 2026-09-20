import * as THREE from 'three';
import { makeElephant, makeGiraffe } from './beasts.ts';
import { makeElephant as fableElephant, makeGiraffe as fableGiraffe } from './beasts-fable.ts';

// The two animals, alone, on a plain olive ground. Drag to turn; the buttons
// choose one or both. No texture, no post-processing: the look is the flat
// facets and the soft shadow.

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const GROUND = 0x98a64c;
const scene = new THREE.Scene();
scene.background = new THREE.Color(GROUND);
scene.fog = new THREE.Fog(GROUND, 30, 90);

const sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
sun.position.set(-6, 9, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
// A strongly green ground bounce tints every animal olive — the elephant came
// out mossy and the giraffe's yellow went dull. The ground term is kept, but
// desaturated and weaker, with the sky carrying most of the fill.
scene.add(sun, sun.target, new THREE.HemisphereLight(0xe8f1ff, 0x9a9a72, 1.5));
scene.add(new THREE.AmbientLight(0xfff6e8, 0.35));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: GROUND }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// ?by=opus | fable | vs — the last stands the two authors' animals side by
// side under exactly this scene's light, which is the only fair comparison.
const q0 = new URLSearchParams(location.search);
const by = (q0.get('by') ?? 'opus') as 'opus' | 'fable' | 'vs';
const giraffe = by === 'fable' ? fableGiraffe() : makeGiraffe();
const elephant = by === 'fable' ? fableElephant() : makeElephant();
scene.add(giraffe, elephant);
const rival = by === 'vs' ? { giraffe: fableGiraffe(), elephant: fableElephant() } : null;
if (rival) scene.add(rival.giraffe, rival.elephant);

const view = { yaw: 0.6, pitch: 0.14, mode: 'both' as 'both' | 'giraffe' | 'elephant' };
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);

function layout() {
  const both = view.mode === 'both';
  giraffe.visible = view.mode !== 'elephant';
  elephant.visible = view.mode !== 'giraffe';
  if (rival) {
    // MINE ON THE LEFT, THE RIVAL'S ON THE RIGHT, side by side at the same
    // depth. Standing them in two rows one behind the other looked like a
    // comparison but was not one: the nearer pair is simply bigger.
    const gap = view.mode === 'elephant' ? 5.2 : 3.6;
    giraffe.position.set(both ? -4.4 : -gap, 0, both ? -2.6 : 0);
    elephant.position.set(both ? 2.4 : -gap, 0, both ? -2.6 : 0);
    rival.giraffe.visible = giraffe.visible; rival.elephant.visible = elephant.visible;
    rival.giraffe.position.set(both ? -4.4 : gap, 0, both ? 3.4 : 0);
    rival.elephant.position.set(both ? 2.4 : gap, 0, both ? 3.4 : 0);
  } else {
    giraffe.position.set(both ? -4.4 : 0, 0, 0);
    elephant.position.set(both ? 2.4 : 0, 0, 0);
  }
  place();
}

function place() {
  const both = view.mode === 'both';
  const tall = view.mode === 'elephant' ? 3.8 : 6.5;
  const width = (rival ? (both ? 1.35 : 2.4) : 1) * (both ? 16 : view.mode === 'elephant' ? 7 : 5);
  const half = THREE.MathUtils.degToRad(camera.fov) / 2;
  const aspect = innerWidth / innerHeight;
  const dist = Math.max((tall * 1.25) / 2 / Math.tan(half), (width * 1.1) / 2 / Math.tan(half) / aspect);
  const at = new THREE.Vector3(both ? 0.2 : 0.4, tall * 0.44, 0);
  camera.position.set(
    at.x + Math.sin(view.yaw) * Math.cos(view.pitch) * dist,
    at.y + Math.sin(view.pitch) * dist,
    at.z + Math.cos(view.yaw) * Math.cos(view.pitch) * dist);
  camera.lookAt(at);
  // the sun rides with the camera, a little to its left and above, so the faces
  // you are looking at are always the lit ones
  const sy = view.yaw + 0.55;
  sun.position.set(at.x + Math.sin(sy) * 10, at.y + 8, at.z + Math.cos(sy) * 10);
  sun.target.position.copy(at); sun.target.updateMatrixWorld();
}

let drag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.yaw -= (e.clientX - drag.x) * 0.006;
  view.pitch = Math.min(0.9, Math.max(0.02, view.pitch + (e.clientY - drag.y) * 0.004));
  drag = { x: e.clientX, y: e.clientY };
  place();
});
for (const id of ['both', 'giraffe', 'elephant'] as const)
  document.getElementById(`b-${id}`)?.addEventListener('click', () => {
    view.mode = id; layout();
    for (const o of ['both', 'giraffe', 'elephant']) document.getElementById(`b-${o}`)?.setAttribute('aria-pressed', String(o === id));
  });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); place(); });

const q = new URLSearchParams(location.search);
if (q.get('mode')) view.mode = q.get('mode') as typeof view.mode;
if (q.get('yaw')) view.yaw = Number(q.get('yaw'));
layout();
document.getElementById(`b-${view.mode}`)?.setAttribute('aria-pressed', 'true');
let tris = 0;
for (const m of [giraffe, elephant]) tris += m.geometry.getAttribute('position').count / 3;
const who = by === 'vs' ? 'left: Opus · right: Fable' : by;
const stats = document.getElementById('stats'); if (stats) stats.textContent = `${who} — giraffe ${(giraffe.geometry.getAttribute('position').count / 3).toLocaleString()} tris · elephant ${(elephant.geometry.getAttribute('position').count / 3).toLocaleString()} tris · no textures`;
renderer.setAnimationLoop(() => renderer.render(scene, camera));
(window as unknown as { __ready: boolean }).__ready = true;
void tris;
