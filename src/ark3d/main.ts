import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// THE ARK, MODELLED IN BLENDER AND SHOWN HERE.
//
// Unlike /voxel.html, nothing in this building is generated in the browser: it
// is one 2 MB glTF made by tools/ark/build_ark.py (bevelled planks, ribs, wales,
// iron straps, a door, a ramp, a scaffold, a roof and railing), loaded as it is.
// The page adds only what a viewer needs — light, sky, ground and a camera.

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;      // what Blender's "Khronos PBR Neutral" matches
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc8f2);
scene.fog = new THREE.Fog(0xd8e6ee, 160, 520);

// Fill-dominant, as the light study found the cosy look to be: the sky gives
// more than the sun, and the ground bounce is cool rather than warm.
const sun = new THREE.DirectionalLight(0xffe2b8, 4.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 60, bottom: -60, near: 1, far: 400 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target, new THREE.HemisphereLight(0xdcebff, 0xa8a880, 3.2));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: 0x8a9a4a }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.5, 1500);
const view = { yaw: 0.62, pitch: 0.16, dist: 95, at: new THREE.Vector3(30, 6, 8) };
function place() {
  camera.position.set(
    view.at.x + Math.sin(view.yaw) * Math.cos(view.pitch) * view.dist,
    view.at.y + Math.sin(view.pitch) * view.dist,
    view.at.z + Math.cos(view.yaw) * Math.cos(view.pitch) * view.dist);
  camera.lookAt(view.at);
  sun.position.copy(view.at).add(new THREE.Vector3(Math.sin(view.yaw + 0.7) * 80, 70, Math.cos(view.yaw + 0.7) * 80));
  sun.target.position.copy(view.at); sun.target.updateMatrixWorld();
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.load('/models/ark/ark.glb', (gltf) => {
  const ark = gltf.scene;
  // The glTF exporter turns Blender's +y (where the door is) into three's -z,
  // which faces away from the default camera. Mirroring z puts the door side
  // toward the viewer; three flips the winding for a negative scale by itself.
  ark.scale.z = -1;
  ark.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material as THREE.MeshStandardMaterial;
      m.roughness = 0.9; m.metalness = 0;
      m.flatShading = true;                              // crisp bevel facets
      m.needsUpdate = true;
    }
  });
  scene.add(ark);
  const box = new THREE.Box3().setFromObject(ark);
  const size = box.getSize(new THREE.Vector3());
  let tris = 0;
  ark.traverse((o) => { if (o instanceof THREE.Mesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
  const st = document.getElementById('stats');
  if (st) st.textContent = `${size.x.toFixed(1)} × ${size.z.toFixed(1)} × ${size.y.toFixed(1)} m · ${Math.round(tris).toLocaleString()} triangles · Blender → glTF`;
  (window as unknown as { __ready: boolean }).__ready = true;
});

let drag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.yaw -= (e.clientX - drag.x) * 0.005;
  view.pitch = Math.min(1.2, Math.max(0.02, view.pitch + (e.clientY - drag.y) * 0.004));
  drag = { x: e.clientX, y: e.clientY }; place();
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.dist = Math.min(300, Math.max(15, view.dist * (1 + Math.sign(e.deltaY) * 0.08))); place(); }, { passive: false });

const VIEWS: Record<string, [number, number, number, number, number, number]> = {
  'v-wide': [0.62, 0.16, 95, 30, 6, 8], 'v-door': [0.42, 0.12, 30, 28, 4, 12], 'v-bow': [1.15, 0.2, 60, 6, 6, 8],
};
for (const [id, [yaw, pitch, dist, ax, ay, az]] of Object.entries(VIEWS))
  document.getElementById(id)?.addEventListener('click', () => { Object.assign(view, { yaw, pitch, dist }); view.at.set(ax, ay, az); place(); });

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
place();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
