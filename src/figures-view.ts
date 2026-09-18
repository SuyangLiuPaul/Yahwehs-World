import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SpringRig } from './walk/springs.ts';

// The live look at ONE model. Loaded on demand — a reader browsing the grid of
// pictures pays nothing for three.js until they ask to turn something round.
//
// It plays the model's own animation if it has one. Most do not yet: an
// image-to-3D generator returns a mesh, not a skeleton, so a figure is a still
// figure until it has been rigged. The viewer is written for both from the
// start so that adding a rigged model is a file drop and not a rewrite, and so
// that the page can SAY which ones move — a claim it can only make honestly if
// it reads the file rather than a list someone keeps by hand.

const loader = new GLTFLoader();

let renderer: THREE.WebGLRenderer | null = null;
let raf = 0;
let token = 0;

export interface Shown { token: number; clips: string[]; playing: string | null }

// The model on show, so a clip button can reach it.
let current: { mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[]; action: THREE.AnimationAction | null } | null = null;

/** Crossfade to another of the model's own clips. */
export function play(name: string) {
  if (!current) return;
  const clip = current.clips.find((c) => c.name === name);
  if (!clip) return;
  const next = current.mixer.clipAction(clip);
  next.reset().play();
  if (current.action && current.action !== next) current.action.crossFadeTo(next, 0.35, false);
  current.action = next;
}

export async function show(canvas: HTMLCanvasElement, url: string, height: number): Promise<Shown> {
  const mine = ++token;
  renderer ??= new THREE.WebGLRenderer({ canvas, antialias: true });
  const w = canvas.clientWidth || 480, h = canvas.clientHeight || 520;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1622);
  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x2a2318, 1.5));
  const key = new THREE.DirectionalLight(0xfff2dd, 2.4); key.position.set(2.4, 3.4, 2.8);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.8); fill.position.set(-2.6, 1.6, -1.4);
  const rim = new THREE.DirectionalLight(0xffe6b8, 1.3); rim.position.set(-0.6, 2.2, -3.4);
  scene.add(key, fill, rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: 0x16283a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const gltf = await loader.loadAsync(url);
  if (mine !== token) return { token: 0, clips: [], playing: null };   // a second card was opened
  const root = gltf.scene;
  // The same measuring loadFigure() does, because what this page claims about
  // a model is its size and that claim has to be the one the walks use.
  let box = new THREE.Box3().setFromObject(root);
  const s = height / Math.max(box.getSize(new THREE.Vector3()).y, 1e-4);
  root.scale.setScalar(s);
  box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  const turn = new THREE.Group();
  turn.add(root);
  scene.add(turn);

  box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 200);
  const r = Math.max(size.x, size.y, size.z) * 2.2;
  camera.position.set(0, mid.y + size.y * 0.2, r);
  camera.lookAt(0, mid.y, 0);

  const mixer = gltf.animations.length ? new THREE.AnimationMixer(root) : null;
  // Start on standing if there is such a clip: it is the one that shows the
  // figure, where a walk shows the motion. A reader picks the rest.
  const first = gltf.animations.find((a) => a.name === 'idle') ?? gltf.animations[0];
  current = mixer ? { mixer, clips: gltf.animations, action: null } : null;
  if (first) play(first.name);
  // Cloth that swings: the figures built here carry spring bones in the hem,
  // the girdle, the veil and the beard. A model without them returns null
  // and nothing is added.
  const springs = SpringRig.from(root);

  const clock = new THREE.Clock();
  cancelAnimationFrame(raf);
  const tick = () => {
    if (mine !== token) return;
    const dt = clock.getDelta();
    mixer?.update(dt);
    springs?.update(dt);
    // A still model is turned so it can be seen from every side. A model with
    // an animation is left facing you — the motion is the thing to look at,
    // and spinning it as well makes both unreadable.
    if (!mixer) turn.rotation.y += dt * 0.5;
    renderer!.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();
  return { token: mine, clips: gltf.animations.map((a) => a.name), playing: first?.name ?? null };
}

export function stop(t: number) {
  if (t === token) { token++; cancelAnimationFrame(raf); }
}
