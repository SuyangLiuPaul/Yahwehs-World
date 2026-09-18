import * as THREE from 'three';
import { Crowd } from './crowd.ts';
import { FIGURES } from './figures.ts';

// The crowd bench. ?n=<count> people on a plain, the camera flying a fixed
// path through them, and the numbers on screen and on window.__crowd so a
// script can read them. The path is a function of the crowd's clock, not of
// wall time, so the same second of the same count is the same picture on
// every machine — which is what makes the screenshots comparable.
//
// DENSITY. One person per 2.5 m² is a loose crowd on the move (a packed one
// is two per m²), and the field is sized to hold `n` of them at that: 1,000
// fills a 50 m square, 50,000 a 354 m one. So the counts also test different
// things — at 1,000 everyone is within the mid ring and the VAT does the
// work; at 50,000 most of the field is past 150 m and it is the impostors'.

const params = new URLSearchParams(location.search);
const N = Math.max(1, Math.min(200000, Number(params.get('n') ?? 1000)));
const DPR = Number(params.get('dpr') ?? Math.min(devicePixelRatio, 2));
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.info.autoReset = false;

const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd3e6);
scene.fog = new THREE.Fog(0xbfd3e6, 200, 900);
const sky = new THREE.HemisphereLight(0xdce8ff, 0x8a7a60, 1.4);
const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.position.set(60, 90, 40); scene.add(sky, sun);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 1200);

const side = Math.sqrt(N * 2.5);
const half = side / 2;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(side + 400, side + 400),
  new THREE.MeshStandardMaterial({ color: 0xa08b68, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const grid = new THREE.GridHelper(side, Math.max(2, Math.round(side / 10)), 0x6b5a3e, 0x8a7654);
(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35;
grid.position.y = 0.02; scene.add(grid);

// A fixed pseudo-random placement (LCG), so the crowd is the same on every load.
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const crowd = await Crowd.load({
  meta: '/models/crowd/man.json', full: '/models/crowd/man-full.glb',
  height: FIGURES.man!.height, capacity: N, renderer,
  field: { minX: -half, maxX: half, minZ: -half, maxZ: half },
  sheetLights: [sky, sun],
});
// Everyone walks the same general way, as a crowd on a road does, within a
// spread of ±25°; one in eight stands.
for (let i = 0; i < N; i++) {
  const x = -half + rnd() * side, z = -half + rnd() * side;
  const standing = (i % 8) === 3;
  crowd.set(i, x, z, (rnd() - 0.5) * 0.9, standing ? 1 : 0, i);
}
scene.add(crowd);
// Every program now, not at the first frame that draws each tier: the far
// tiers are empty until the camera climbs, and a shader compiled mid-flight
// is a frame that lasts a second — which is what the numbers would show if
// the compile were left to happen inside the measured window.
renderer.compile(scene, camera);

// The camera's path: in among them at eye height for 12 s, then 18 s up and
// back to see the whole field. Eye height first so the near ring is in the
// first screenshot; height second so the far rings are in the next. (The
// bench samples at t = 3 and t = 20; a sample is read 4.5 s after the seek,
// so both must still be inside their segment then.)
function fly(t: number) {
  const u = (t % 30) / 30;
  if (u < 0.4) {                        // walking through, eye level
    const v = u / 0.4;
    camera.position.set(-half * 0.6 + v * half * 0.8, 1.7, half * 0.55 - v * half * 0.3);
    camera.lookAt(camera.position.x + Math.sin(0.4), 1.5, camera.position.z - Math.cos(0.4));
  } else {                              // climbing to the field's edge
    const v = (u - 0.4) / 0.6, h = 3 + v * (side * 0.28);
    camera.position.set(half * 0.2 + v * half * 0.5, h, half * 0.25 + v * (half * 0.9 + 60));
    camera.lookAt(0, 0, -half * 0.2);
  }
}

const frames: number[] = [];
let last = performance.now(), hudAt = 0;
const stats = { gpu, n: N, side, fps: 0, ms: 0, ms95: 0, updateMs: 0, tris: 0, calls: 0,
  near: 0, lod0: 0, lod1: 0, far: 0, culled: 0, time: 0, dpr: DPR, width: innerWidth, height: innerHeight };

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = crowd.time + dt;
  fly(t);
  crowd.update(dt, camera);
  renderer.info.reset();
  renderer.render(scene, camera);
  frames.push(dt * 1000);
  if (frames.length > 240) frames.shift();
  if (now - hudAt > 250) {
    hudAt = now;
    const sorted = [...frames].sort((a, b) => a - b);
    const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
    Object.assign(stats, {
      fps: 1000 / mean, ms: mean, ms95: sorted[Math.floor(sorted.length * 0.95)] ?? mean,
      updateMs: crowd.stats.updateMs, tris: renderer.info.render.triangles, calls: renderer.info.render.calls,
      near: crowd.stats.near, lod0: crowd.stats.lod0, lod1: crowd.stats.lod1, far: crowd.stats.far,
      culled: crowd.stats.culled, time: crowd.time,
    });
    const esc = (x: string) => x.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
    hud.innerHTML =
      `crowd  <b>${N.toLocaleString()}</b> on ${side.toFixed(0)} m² · ${esc(gpu)}\n` +
      `frame  ${stats.ms.toFixed(1)} ms mean · ${stats.ms95.toFixed(1)} ms p95 · ${stats.fps.toFixed(0)} fps\n` +
      `update ${stats.updateMs.toFixed(2)} ms cpu · ${stats.calls} draws · ${(stats.tris / 1e6).toFixed(2)} M tris\n` +
      `tiers  near ${stats.near} · lod0 ${stats.lod0} · lod1 ${stats.lod1} · far ${stats.far} · culled ${stats.culled}\n` +
      `t=${crowd.time.toFixed(1)} s · ${innerWidth}×${innerHeight} @${DPR}`;
  }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});
declare global { interface Window { __crowd: { stats: typeof stats; seek(t: number): void; ready: boolean;
  dbg: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; crowd: Crowd; THREE: typeof THREE } } } }
window.__crowd = {
  stats, ready: true,
  // Jump the crowd's clock, for a screenshot at a known point of the path.
  seek(t: number) { crowd.time = t; frames.length = 0; },
  // For timing one tier at a time from the console.
  dbg: { renderer, scene, camera, crowd, THREE },
};
requestAnimationFrame(frame);
