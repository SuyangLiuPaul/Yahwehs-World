import * as THREE from 'three';
import { buildArkWorld, CUBITS, FINE } from './ark-scene.ts';
import { loadVoxSet, type VoxModel } from './vox.ts';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// THE BLOCK WORLD, ON SCREEN.
//
// The owner sent three pictures of a game — ark, tabernacle, temple — and
// asked for that. This page is the honest half of that picture: the camera
// angle, the warm light, the blocky beasts and the panel furniture are all
// matched on purpose, and the building underneath them is the one the text
// measures rather than the one the picture draws. Everything here is
// generated from numbers when the page loads; not one model file is fetched.

const CUBIT_M = 0.445;                 // the common cubit, as src/structures/specs.ts
const COARSE = CUBIT_M;                // the ark: one block to the cubit
const FINEM = CUBIT_M / FINE;          // people and beasts: four blocks to the cubit

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Neutral, not ACES. ACES converts through the AP1 gamut and shifts hue,
// which is what flattens a saturated stylised palette; Neutral leaves any
// pixel under 0.76 linear untouched.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;      // r182+: this is the soft one

const scene = new THREE.Scene();
// A GRADIENT SKY, not a flat slab. The measurement of our old frame found the
// top tenth of the image was one constant colour with a standard deviation of
// zero, which reads as an unfinished scene more than anything else in it.
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 24, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x88ccfc) }, bottom: { value: new THREE.Color(0xd6ecfa) } },
    vertexShader: 'varying float vH; void main(){ vH = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float vH; void main(){ gl_FragColor = vec4(mix(bottom, top, clamp(vH*1.6, 0.0, 1.0)), 1.0); }',
  }),
);
scene.add(sky);
// The far end of a hundred and thirty-four metres should go pale rather
// than simply run out of frame: recession is what sells the length.
scene.fog = new THREE.Fog(0xdcd3bd, 130, 460);

// A bright, kind morning: a low sun from the left, a blue sky bounce and a
// warm bounce off the ground, which is what keeps the side of a plank the sun
// misses from going black.
// THE RATIO IS THE LOOK. Measured off Townscaper and corroborated by
// MagicaVoxel's own shipped defaults (sun 0.6, sky 0.7): the cosy look is
// FILL-DOMINANT — the sky gives more light than the sun, about 1.28×. This
// scene had it backwards, sun 2.2 against a 0.8 sky, which is why it read
// hard and contrasty where the reference reads soft.
// (Intensities are ~3× what they would have been before three r155, which
// stopped scaling lights by π internally.)
const sun = new THREE.DirectionalLight(0xffd9a0, 3.5);
// Lower and further round than it was. A high sun lights the roof and leaves
// the whole side of the hull — the thing you are actually looking at — in its
// own shade; a raking sun from over the camera's shoulder picks out every rib
// and wale instead, which is the only reason the planking reads at all.
sun.position.set(-150, 95, 210);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 600;
const S = 105;
sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0012;
const fill = new THREE.DirectionalLight(0xffe0b0, 0.5);
fill.position.set(140, 90, 180);          // over the camera's shoulder, no shadows
// A COOL ground bounce, not a warm one. A warm ground tint drives the shadow
// side warm; every measurement of the reference look has shadows going COOL
// (red/blue ratio about 0.66) while the lit faces go warm.
scene.add(sun, fill, new THREE.HemisphereLight(0x9fc2d6, 0x6d7f74, 4.5));

// A lamp in the doorway. One point light, and it does the job the reference
// picture's glowing door does: it says the way in is open and somebody is home.
// Intensity 260 over 26 metres washed a bright disc across the hull the size
// of a house. A lamp is a lamp: enough to warm the doorway and a stride of
// the ramp, and no further.
const doorLamp = new THREE.PointLight(0xffc781, 26, 11, 2);
scene.add(doorLamp);

// The ground is a plane, not blocks: a field of grass a hundred metres across
// would be two hundred thousand cubes to say one flat green thing.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400),
  new THREE.MeshLambertMaterial({ color: 0x74a24a }),
);
ground.rotation.x = -Math.PI / 2;
// Two centimetres below the voxel ground's top face. The painted terrain's
// surface block sits at y = -1 and its top face lands exactly on zero, so a
// plane AT zero z-fights with every square of it; this one only shows past
// the edge of what terrain.ts painted, as the far field.
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

// A slightly long lens. At 36° and wider everything falls away from the
// centre and the hull looks like it is toppling backwards.
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.5, 1400);

// ── the far country ──────────────────────────────────────────────────────
// Hills on the horizon and a few clouds. Not blocks: half a dozen flat shapes
// behind the fog do the same work for nothing, and no verse is involved.
const hills = new THREE.Group();
for (let i = 0; i < 14; i++) {
  const w = 120 + (i * 53) % 220, h = 26 + (i * 31) % 46;
  const hill = new THREE.Mesh(
    new THREE.ConeGeometry(w * 0.5, h, 4),
    new THREE.MeshLambertMaterial({ color: i % 3 ? 0x6f8a5e : 0x8a9a76 }),
  );
  const a = (i / 14) * Math.PI * 2;
  hill.position.set(66 + Math.cos(a) * 520, h / 2 - 4, 22 + Math.sin(a) * 520);
  hill.rotation.y = a;
  hills.add(hill);
}
scene.add(hills);
for (let i = 0; i < 16; i++) {
  const cloud = new THREE.Mesh(
    new THREE.BoxGeometry(18 + (i * 7) % 26, 5, 10 + (i * 5) % 14),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  cloud.position.set(((i * 97) % 400) - 60, 78 + (i % 4) * 9, ((i * 61) % 300) - 90);
  scene.add(cloud);
}

// ── the world ────────────────────────────────────────────────────────────

let built: THREE.Mesh[] = [];
const state = { cutaway: false, scenery: true };
// The voxelised creatures, fetched once. Until they arrive the scene draws the
// hand-built ones, so the page is never empty waiting on a download.
let vox: Record<string, VoxModel> = {};

function raise() {
  const t0 = performance.now();
  for (const m of built) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); scene.remove(m); }
  built = [];
  const world = buildArkWorld({ cutaway: state.cutaway, scenery: state.scenery, vox });
  doorLamp.position.set(world.door.x * COARSE, 2.2, (CUBITS.breadth - 4) * COARSE);
  doorLamp.visible = !state.cutaway;
  const a = world.coarse.build(COARSE);
  const b = world.fine.build(FINEM);
  built = [a.mesh, b.mesh];
  scene.add(a.mesh, b.mesh);
  const ms = Math.round(performance.now() - t0);
  const stats = document.getElementById('stats');
  if (stats) {
    stats.textContent =
      `${CUBITS.length}×${CUBITS.breadth}×${CUBITS.height} 肘 · ${(CUBITS.length * CUBIT_M).toFixed(0)} m · `
      + `${(a.drawn + b.drawn).toLocaleString()} blocks · ${((a.faces + b.faces) * 2).toLocaleString()} triangles · ${ms} ms`;
  }
}

// ── camera: a diorama, turned but not flown ──────────────────────────────
//
// The reference pictures are all one shot: three-quarters from above, close
// to 35°. That angle IS the look, so the camera keeps it and only turns and
// zooms. Letting it fly would show the scene from angles nobody dressed,
// which is how a diorama stops looking like one.
const focus = new THREE.Vector3(58 * COARSE, 7 * COARSE, 60 * COARSE);
const orbit = { yaw: -0.82, pitch: 0.24, dist: 62 };
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
canvas.addEventListener('pointerup', (e) => { drag = null; canvas.releasePointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  orbit.yaw -= (e.clientX - drag.x) * 0.005;
  orbit.pitch = Math.min(1.2, Math.max(0.12, orbit.pitch + (e.clientY - drag.y) * 0.004));
  drag = { x: e.clientX, y: e.clientY };
  place();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  orbit.dist = Math.min(460, Math.max(30, orbit.dist * (1 + Math.sign(e.deltaY) * 0.08)));
  place();
}, { passive: false });

// ── the panel furniture ──────────────────────────────────────────────────

const press = (id: string, on: boolean) => document.getElementById(id)?.setAttribute('aria-pressed', String(on));

document.getElementById('b-cutaway')?.addEventListener('click', () => {
  state.cutaway = !state.cutaway; press('b-cutaway', state.cutaway); raise();
});
document.getElementById('b-scenery')?.addEventListener('click', () => {
  state.scenery = !state.scenery; press('b-scenery', state.scenery); raise();
});
const VIEWS: Record<string, [number, number, number]> = {
  'v-wide': [-0.82, 0.24, 62], 'v-door': [-0.30, 0.20, 34], 'v-end': [-1.5, 0.30, 150],
};
for (const [id, [yaw, pitch, dist]] of Object.entries(VIEWS)) {
  document.getElementById(id)?.addEventListener('click', () => {
    orbit.yaw = yaw; orbit.pitch = pitch; orbit.dist = dist; place();
    for (const o of Object.keys(VIEWS)) press(o, o === id);
  });
}
document.getElementById('b-photo')?.addEventListener('click', () => {
  press('b-photo', document.body.classList.toggle('photo'));
});

// BLOOM, for the lamps and the lattice under the eave. Only the brightest
// things in frame pass the threshold, so the hull does not glow — the lit
// doorway, the lantern posts and the warm line under the roof do, which is
// the whole reason those were painted bright in the first place.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Threshold 0.72 in LINEAR space caught the sky and half the hull and turned
// the whole frame to milk. The composer's passes run before tone mapping, so
// the threshold has to sit above where ordinary lit surfaces land: only the
// lamps, which are painted near white, get past 1.0.
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.45, 1.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// A handle for looking at the scene from a script, the way the crowd bench
// exposes window.__crowd.
declare global { interface Window { __voxel: { orbit: typeof orbit; focus: THREE.Vector3; place: () => void; state: typeof state; raise: () => void } } }
window.__voxel = { orbit, focus, place, state, raise };

raise();
place();
void loadVoxSet(['sheep', 'cow', 'ox', 'ass', 'horse', 'swine', 'wolf'])
  .then((got) => { if (Object.keys(got).length) { vox = got; raise(); } });
press('b-scenery', true);
press('v-wide', true);
renderer.setAnimationLoop(() => composer.render());
