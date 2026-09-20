import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// A REVIEW PAGE for the rigged animals: an elephant and a giraffe, each with the
// clips baked by tools/ark/rig_quadruped.py. Click a clip to play it; ?t=1.3 freezes
// the clip at that many seconds so a still can be taken of any moment of a move.

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc8f2);
const sun = new THREE.DirectionalLight(0xffe2b8, 4.6);
sun.position.set(14, 22, 16); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
scene.add(sun, new THREE.HemisphereLight(0xdcebff, 0xa8a880, 3.2));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x8a9a4a }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 4.2, 15.5);
camera.lookAt(0, 3.0, 0);

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const mixers: THREE.AnimationMixer[] = [];
const actions: Record<string, THREE.AnimationAction>[] = [];
const bar = document.getElementById('bar')!;
const info = document.getElementById('info')!;
let clip = q.get('clip') ?? 'walk';
const freeze = q.has('t') ? Number(q.get('t')) : null;

function play(name: string) {
  clip = name;
  actions.forEach((set) => {
    for (const [k, a] of Object.entries(set)) { if (k === name) a.reset().fadeIn(0.25).play(); else a.fadeOut(0.25); }
  });
  bar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.getAttribute('data-clip') === name));
}

const SETS: { file: string; x: number; extra: string; scale: number }[] = [
  { file: 'elephant', x: -3.6, extra: 'trumpet', scale: 1 },
  { file: 'giraffe', x: 3.4, extra: 'graze', scale: 0.72 },
];
let loaded = 0;
for (const s of SETS) {
  loader.load(`/models/ark/rig/${s.file}-rig.glb`, (gltf) => {
    const root = gltf.scene;
    root.position.x = s.x; root.scale.setScalar(s.scale);
    // both face +x in their own frame; turn them a little toward the camera
    root.rotation.y = -0.5;
    root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.SkinnedMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const m = o.material as THREE.MeshStandardMaterial; m.roughness = 0.9; m.metalness = 0; m.flatShading = true;
      }
    });
    scene.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const set: Record<string, THREE.AnimationAction> = {};
    for (const c of gltf.animations) set[c.name] = mixer.clipAction(c);
    mixers.push(mixer); actions.push(set);
    if (++loaded === SETS.length) {
      for (const name of ['walk', 'idle', 'trumpet', 'graze']) {
        const b = document.createElement('button');
        b.textContent = ({ walk: '走', idle: '站立', trumpet: '象鸣', graze: '低头吃草' } as Record<string, string>)[name]!;
        b.setAttribute('data-clip', name);
        b.onclick = () => play(name);
        bar.appendChild(b);
      }
      play(clip);
      if (freeze !== null) { mixers.forEach((m) => m.setTime(freeze)); }
      info.textContent = `clips: ${gltf.animations.map((a) => a.name).join(', ')}`;
      (window as unknown as { __ready: boolean }).__ready = true;
    }
  });
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (freeze === null) mixers.forEach((m) => m.update(dt)); else mixers.forEach((m) => m.update(0));
  renderer.render(scene, camera);
});
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
