// A still of every model in the catalogue, for the 人物 page.
//
// Why stills and not fifteen live canvases. A card grid that starts fifteen
// WebGL contexts is a grid that will not open on a phone — browsers cap the
// number of contexts at about sixteen and drop the oldest — and it downloads
// fifteen megabytes of GLB to show fifteen thumbnails. So the grid is pictures,
// and the live viewer is ONE context, opened for the one model you asked for.
//
// The still is rendered by the same rule the walks use: scaled to the height
// the register states, standing on y = 0. What you see in the card is the size
// it actually is, which is the only claim this project ever makes about it.
//
//   node scripts/render-figures.mjs            all of them
//   node scripts/render-figures.mjs man priest just those
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'figures');
await mkdir(OUT, { recursive: true });

// The catalogue is TypeScript; rather than compile it, read the ids and the
// heights straight out of it. If this ever stops matching, the page will show
// a missing picture, which is a visible failure rather than a silent one.
const src = await readFile(join(ROOT, 'src', 'catalogue.ts'), 'utf8');
const reg = await readFile(join(ROOT, 'src', 'walk', 'figures.ts'), 'utf8');
const heights = new Map();
for (const m of reg.matchAll(/(\w+):\s*\{\s*file:\s*'([^']+)',\s*height:\s*([\d.]+)/g))
  heights.set(m[2], Number(m[3]));
const items = [];
for (const m of src.matchAll(/fromRegister\('(\w+)'/g))
  items.push({ id: m[1], height: heights.get(m[1]) });
for (const m of src.matchAll(/\{\s*id:\s*'([\w-]+)',\s*kind:[^}]*?height:\s*([\d.]+)/g))
  items.push({ id: m[1], height: Number(m[2]) });

const only = process.argv.slice(2);
const wanted = only.length ? items.filter((i) => only.includes(i.id)) : items;

const W = 600, H = 760;
const HTML = `<!doctype html><meta charset=utf8>
<style>html,body{margin:0;background:#0b1622}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/nm/three/build/three.module.js","three/addons/":"/nm/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const p = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setSize(${W}, ${H}); renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1622);
scene.add(new THREE.HemisphereLight(0xdce8ff, 0x2a2318, 1.5));
const key = new THREE.DirectionalLight(0xfff2dd, 2.4); key.position.set(2.4, 3.4, 2.8); scene.add(key);
const fill = new THREE.DirectionalLight(0xbfd4ff, .8); fill.position.set(-2.6, 1.6, -1.4); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffe6b8, 1.3); rim.position.set(-.6, 2.2, -3.4); scene.add(rim);
// The ground the figure stands on, so the height reads as a height and not as
// a thing floating in a void.
const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48),
  new THREE.MeshStandardMaterial({ color: 0x16283a, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const gltf = await new GLTFLoader().loadAsync('/model.glb');
const root = gltf.scene;
let box = new THREE.Box3().setFromObject(root);
const s = Number(p.get('h')) / box.getSize(new THREE.Vector3()).y;
root.scale.setScalar(s);
box = new THREE.Box3().setFromObject(root);
const c = box.getCenter(new THREE.Vector3());
root.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
scene.add(root);
box = new THREE.Box3().setFromObject(root);
const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
const camera = new THREE.PerspectiveCamera(30, ${W} / ${H}, .01, 200);
const r = Math.max(size.x, size.y, size.z) * 2.1;
const a = Math.PI * 0.28;
camera.position.set(mid.x + r * Math.sin(a), mid.y + size.y * .22, mid.z + r * Math.cos(a));
camera.lookAt(mid.x, mid.y, mid.z);
renderer.render(scene, camera);
let tris = 0;
root.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
window.__out = { url: renderer.domElement.toDataURL('image/jpeg', 0.84), tris };
</script>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W + 20, height: H + 20 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
let current = null;
await page.route('**/*', async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === '/' ) return route.fulfill({ contentType: 'text/html', body: HTML });
  if (u.pathname === '/model.glb') return route.fulfill({ contentType: 'model/gltf-binary', body: await readFile(current) });
  if (u.pathname.startsWith('/nm/')) {
    try { return route.fulfill({ contentType: 'text/javascript', body: await readFile(join(ROOT, 'node_modules', u.pathname.slice(4))) }); }
    catch { return route.fulfill({ status: 404, body: '' }); }
  }
  return route.fulfill({ status: 404, body: '' });
});

const done = [];
for (const item of wanted) {
  current = join(ROOT, 'public', 'models', `${item.id}.glb`);
  if (!existsSync(current)) { console.log(`  ${item.id}: no model file, skipped`); continue; }
  errs.length = 0;
  await page.goto(`http://127.0.0.1/?h=${item.height}`);
  try { await page.waitForFunction(() => window.__out, null, { timeout: 60000 }); }
  catch { console.log(`  ${item.id}: FAILED — ${errs[0] ?? 'timed out'}`); continue; }
  const { url, tris } = await page.evaluate(() => window.__out);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  await writeFile(join(OUT, `${item.id}.jpg`), buf);
  done.push(`${item.id} ${item.height}m ${Math.round(tris).toLocaleString()} tris ${(buf.length / 1024).toFixed(0)} kB`);
}
await browser.close();
console.log(done.join('\n'));
console.log(`figures: ${done.length} of ${wanted.length} rendered into public/figures/`);
