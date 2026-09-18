import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadFigure } from './walk/figures.ts';
import { SpringRig } from './walk/springs.ts';

// The springs review page (figures-springs.html): two copies of a figure,
// one skinned to the body alone and one with its spring bones swung by
// src/walk/springs.ts, playing the same clip in step. It also exposes
// window.__capture for a headless browser to pull frame strips from, which
// is how the review sheets in the handoff were made.

const q = new URLSearchParams(location.search);
const GLB = q.get('glb') ?? '/models/springs/man.glb';
const BASE = q.get('base') ?? GLB;
const HEIGHT = Number(q.get('height') ?? 1.72);
// ?crowd=N stands N more copies of the sprung figure behind the pair, each
// with its own mixer and springs, for the cost per figure; ?lod=1 lets the
// far cut-off apply to them (it is off for the measurement otherwise).
const CROWD = Number(q.get('crowd') ?? 0);
const LOD = q.get('lod') === '1';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1622);
scene.add(new THREE.HemisphereLight(0xdce8ff, 0x2a2318, 1.5));
const key = new THREE.DirectionalLight(0xfff2dd, 2.4); key.position.set(2.4, 3.4, 2.8); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -3; key.shadow.camera.right = key.shadow.camera.top = 3;
const fill = new THREE.DirectionalLight(0xbfd4ff, 0.8); fill.position.set(-2.6, 1.6, -1.4);
const rim = new THREE.DirectionalLight(0xffe6b8, 1.3); rim.position.set(-0.6, 2.2, -3.4);
scene.add(key, fill, rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: 0x16283a, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
const turn = new THREE.Group(); scene.add(turn);

interface Shown { group: THREE.Group; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[]; springs: SpringRig | null; action?: THREE.AnimationAction }
const shown: Shown[] = [];

async function stand(url: string, x: number, withSprings: boolean): Promise<Shown> {
  const group = await loadFigure(url, HEIGHT);
  group.position.x = x;
  turn.add(group);
  // loadFigure hands back the scene root only; the clips are on
  // gltf.animations, which it does not return. So the clips are read a
  // second time through the loader's cache — cheap, and figures.ts stays as it is.
  const clips = (await loader.loadAsync(url)).animations;
  const mixer = new THREE.AnimationMixer(group);
  const springs = withSprings ? SpringRig.from(group) : null;
  if (withSprings && !springs) console.warn(`${url}: no spring bones in this file`);
  return { group, mixer, clips, springs };
}
const loader = new GLTFLoader();

function play(s: Shown, name: string, fade = 0.3) {
  const clip = s.clips.find((c) => c.name === name) ?? s.clips[0];
  if (!clip) return;
  const next = s.mixer.clipAction(clip);
  next.reset().play();
  if (s.action && s.action !== next) s.action.crossFadeTo(next, fade, false);
  s.action = next;
}

// ── helpers: colliders as capsules, chains as lines ─────────────────────
const helpers = new THREE.Group(); helpers.visible = false; scene.add(helpers);
const capMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, wireframe: true, transparent: true, opacity: 0.35 });
const capsules: { mesh: THREE.Mesh; c: SpringRig['colliders'][number] }[] = [];
let chainLines: THREE.LineSegments | null = null;
function buildHelpers(rig: SpringRig) {
  for (const c of rig.colliders) {
    // a capsule of radius 1 and cylinder length 1; scaled to the collider each frame
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 3, 10), capMat);
    helpers.add(mesh); capsules.push({ mesh, c });
  }
  const pos = new Float32Array(rig.joints.length * 6);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  chainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffb74d }));
  helpers.add(chainLines);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
function updateHelpers(rig: SpringRig) {
  if (!helpers.visible) return;
  for (const { mesh, c } of capsules) {
    const len = c.wa.distanceTo(c.wb);
    mesh.position.addVectors(c.wa, c.wb).multiplyScalar(0.5);
    _b.subVectors(c.wb, c.wa);
    if (_b.lengthSq() > 1e-9) _q.setFromUnitVectors(_up, _b.normalize()); else _q.identity();
    mesh.quaternion.copy(_q);
    // the unit capsule's straight part is 1 long: stretch it to len, keep the caps round
    mesh.geometry.dispose();
    mesh.geometry = new THREE.CapsuleGeometry(c.wr, len, 3, 10);
  }
  if (chainLines) {
    const pos = chainLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    rig.joints.forEach((j, i) => {
      _a.setFromMatrixPosition(j.bone.matrixWorld);
      pos.setXYZ(i * 2, _a.x, _a.y, _a.z); pos.setXYZ(i * 2 + 1, j.cur.x, j.cur.y, j.cur.z);
    });
    pos.needsUpdate = true;
  }
}

// ── the page ────────────────────────────────────────────────────────────
const stats = document.getElementById('stats')!;
let slow = false, turning = false;
const ms: number[] = [];
const crowd: Shown[] = [];
let crowdMs = 0;

function raiseCrowd(sprung: Shown) {
  // One load, many skeletons: SkeletonUtils.clone gives each copy its own
  // bones (a plain clone would share them, and every copy would move as one).
  const cols = Math.ceil(Math.sqrt(CROWD));
  for (let i = 0; i < CROWD; i++) {
    const group = skeletonClone(sprung.group) as THREE.Group;
    group.position.set((i % cols - cols / 2) * 1.1, 0, -2 - Math.floor(i / cols) * 1.2);
    turn.add(group);
    const mixer = new THREE.AnimationMixer(group);
    const springs = SpringRig.from(group);
    if (springs && !LOD) springs.farDistance = 1e9;
    const s: Shown = { group, mixer, clips: sprung.clips, springs };
    crowd.push(s);
  }
}

async function main() {
  const [base, sprung] = await Promise.all([stand(BASE, -0.75, false), stand(GLB, 0.75, true)]);
  shown.push(base, sprung);
  if (CROWD > 0) raiseCrowd(sprung);
  (window as unknown as { __rig: SpringRig | null }).__rig = sprung.springs;   // for probing from a headless browser
  if (sprung.springs) buildHelpers(sprung.springs);
  const names = sprung.clips.map((c) => c.name);
  const bar = document.getElementById('clips')!;
  const start = q.get('clip') ?? (names.includes('walk') ? 'walk' : names[0] ?? '');
  for (const n of names) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = n;
    b.setAttribute('aria-pressed', String(n === start));
    b.onclick = () => { for (const s of [...shown, ...crowd]) play(s, n); for (const o of Array.from(bar.children)) o.setAttribute('aria-pressed', String(o === b)); };
    bar.appendChild(b);
  }
  for (const s of shown) play(s, start, 0);
  crowd.forEach((s, i) => { play(s, start, 0); s.mixer.setTime(i * 0.37); });
  const toggle = (id: string, fn: (on: boolean) => void) => {
    const b = document.getElementById(id)!;
    b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); fn(on); };
  };
  toggle('springs', (on) => { if (sprung.springs) { sprung.springs.enabled = on; if (!on) sprung.springs.reset(); } });
  toggle('colliders', (on) => { helpers.visible = on; });
  toggle('bones', (on) => { if (chainLines) chainLines.visible = on; helpers.visible = on || capsules[0]?.mesh.visible === true; });
  toggle('slow', (on) => { slow = on; });
  toggle('turn', (on) => { turning = on; });
  if (q.get('helpers')) { helpers.visible = true; document.getElementById('colliders')!.setAttribute('aria-pressed', 'true'); }
  // ?springs=0: the right figure with its chains at rest — the weighting alone
  if (q.get('springs') === '0' && sprung.springs) { sprung.springs.enabled = false; document.getElementById('springs')!.setAttribute('aria-pressed', 'false'); }
  resize();
  loop();
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  camera.position.set(0, HEIGHT * 0.62, HEIGHT * 2.6);
  camera.lookAt(0, HEIGHT * 0.5, 0);
}
addEventListener('resize', resize);

const _camPos = new THREE.Vector3(), _figPos = new THREE.Vector3();
function advance(dt: number) {
  for (const s of shown) {
    s.mixer.update(dt);
    s.springs?.update(dt);
  }
  if (crowd.length) {
    camera.getWorldPosition(_camPos);
    const t0 = performance.now();
    for (const s of crowd) {
      s.mixer.update(dt);
      s.springs?.update(dt, s.group.getWorldPosition(_figPos).distanceTo(_camPos));
    }
    crowdMs = performance.now() - t0;
  }
}

const clock = new THREE.Clock();
let capturing = false;
function loop() {
  requestAnimationFrame(loop);
  if (capturing) return;
  const dt = clock.getDelta() * (slow ? 0.25 : 1);
  if (turning) turn.rotation.y += dt * 0.4;
  advance(dt);
  const rig = shown[1]?.springs;
  if (rig) {
    updateHelpers(rig);
    ms.push(rig.lastMs); if (ms.length > 120) ms.shift();
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    stats.textContent = `springs: ${rig.joints.length} joints, ${rig.colliders.length} colliders — ${avg.toFixed(3)} ms/frame (avg of ${ms.length})`
      + (crowd.length ? `\ncrowd of ${crowd.length}: mixers + springs ${crowdMs.toFixed(2)} ms/frame, springs alone ${crowd.reduce((a, s) => a + (s.springs?.lastMs ?? 0), 0).toFixed(2)} ms` : '');
  } else stats.textContent = 'no spring bones in this file';
  renderer.render(scene, camera);
}

// For a headless browser: frames of one clip, both figures, at a fixed step.
// Pre-rolls a couple of seconds so the springs are in their loop, not falling
// from rest, then returns `frames` PNG data URLs `1/fps` apart.
(window as unknown as { __capture: (o: { clip?: string; frames?: number; fps?: number; preroll?: number; angle?: number }) => Promise<string[]> })
  .__capture = async ({ clip, frames = 12, fps = 24, preroll = 2, angle = 0 }) => {
    capturing = true;
    if (clip) for (const s of shown) play(s, clip, 0);
    // each figure turns on its own spot, so "before" stays on the left
    // whichever way they face
    for (const s of shown) s.group.rotation.y = angle;
    const rig = shown[1]?.springs; rig?.reset(); ms.length = 0;
    const dt = 1 / fps;
    for (let i = 0; i < preroll * fps; i++) advance(dt);
    const out: string[] = [];
    for (let i = 0; i < frames; i++) {
      advance(dt);
      if (rig) ms.push(rig.lastMs);
      if (rig) updateHelpers(rig);
      renderer.render(scene, camera);
      out.push(canvas.toDataURL('image/png'));
    }
    capturing = false;
    return out;
  };
(window as unknown as { __stats: () => { joints: number; colliders: number; ms: number; crowd: number; crowdSpringsMs: number; crowdAllMs: number } }).__stats = () => {
  const rig = shown[1]?.springs;
  return { joints: rig?.joints.length ?? 0, colliders: rig?.colliders.length ?? 0, ms: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0,
    crowd: crowd.length, crowdSpringsMs: crowd.reduce((a, s) => a + (s.springs?.lastMs ?? 0), 0), crowdAllMs: crowdMs };
};

main().catch((e) => { stats.textContent = String(e); console.error(e); });
