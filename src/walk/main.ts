import * as THREE from 'three';
import { desertSky } from './textures.ts';
import './style.css';
import { buildTabernacle } from './tabernacle.ts';
import { Walker } from './controls.ts';
import { Tour, TOUR } from './tour.ts';
import { applyStatic, bindSwitch, hant, onLocale, t } from '../locale.ts';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { materialsReady as loadMaterials } from './materials.ts';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const CUBIT = 0.445;   // the common cubit; the card feed carries the argument

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.info.autoReset=false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

// The scene was lit by RoomEnvironment — an indoor studio — which is why the
// gold read as showroom metal under softboxes rather than as beaten plate in
// desert sun, and why the sky was a flat fill. A generated desert sky does
// both jobs: it is the background AND the light that bounces off everything.
const sky = desertSky();
scene.background = sky;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(sky).texture;
// The sky is bright, and at full strength it washed the sand to concrete and
// flattened every form: ambient light from all directions is exactly the light
// that removes shading. It fills; the sun models.
scene.environmentIntensity = 0.65;
// Haze thickens toward the horizon so distance reads as distance.
// Far enough out that the court itself stays crisp; haze belongs to the
// desert beyond it, not to a wall forty metres away.
scene.fog = new THREE.Fog(0xcbd1cd, 190, 740);

const camera = new THREE.PerspectiveCamera(
  65, Math.max(1, innerWidth) / Math.max(1, innerHeight), 0.04, 900);

// Mid-morning rather than noon: a sun overhead casts no shadows worth having,
// and shadow is most of what makes a shape read as solid.
const sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
sun.position.set(50, 30, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
// Sized to the built area rather than the terrain: the court is 100x50 cubits,
// so a frustum any wider spends its resolution on empty sand.
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 130;
// Without a bias, a shadow map at this scale stripes every lit surface.
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.006;
sun.shadow.radius = 3;
scene.add(sun);
// Sky above, sand below — the bounce off a desert floor is warm and strong,
// and it is what keeps the shaded sides of the boards from going black.
// The environment already supplies sky and bounce, so the hemisphere is only
// a floor under the shadows to keep them from going black.
scene.add(new THREE.HemisphereLight(0x9fc2e0, 0xb9a377, 0.25));

const { group, colliders, counts, ready } = buildTabernacle(CUBIT);
group.traverse((o) => {
  if (!(o as THREE.Mesh).isMesh) return;
  o.receiveShadow = true;
  o.castShadow = o.userData.noCast !== true;
});
scene.add(group);
// Broad educational fill, not a pinprick reflected as a white disc in the
// boards. The oil lamps remain visible; this fill is disclosed in Evidence.
RectAreaLightUniformsLib.init();
const roomFill=new THREE.RectAreaLight(0xffe6c4,2.2,3,1.8);
roomFill.position.set(-8,3.65,0);roomFill.lookAt(-8,0,0);scene.add(roomFill);

// A single static local reflection probe stops indoor gold reflecting the
// open desert sky as if the tent had no walls. Never refreshed while walking.
const materialsReady=loadMaterials();
const sceneReady=Promise.all([materialsReady,ready]).then(([ok])=>{
  document.body.dataset.materials=ok?'ready':'fallback';
  renderer.shadowMap.needsUpdate=true;
  const target=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType});
  const probe=new THREE.CubeCamera(.08,45,target);probe.position.set(-9,2.2,0);
  probe.update(renderer,scene);
  const bake=new THREE.PMREMGenerator(renderer);
  const room=bake.fromCubemap(target.texture);
  const materials=new Set<THREE.MeshStandardMaterial>();
  group.traverse(o=>{
    if(o instanceof THREE.Mesh){
      for(const m of (Array.isArray(o.material)?o.material:[o.material])){
        if(m instanceof THREE.MeshStandardMaterial&&m.name.startsWith('Interior '))materials.add(m);
      }
    }
  });
  materials.forEach(m=>{m.envMap=room.texture;m.envMapIntensity=1.3;m.needsUpdate=true;});
  target.dispose();bake.dispose();document.body.dataset.reflections='ready';
  return ok;
});
// The architecture and sun are static. Build the shadow atlas once, then
// refresh when the authored GLB arrives, not on every first-person frame.
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
void ready.then(ok=>{renderer.shadowMap.needsUpdate=true;document.body.dataset.laver=ok?'ready':'fallback';});
pmrem.dispose();

const walker = new Walker(camera, canvas, colliders);
scene.add(walker.yaw);
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:2}));
composer.setPixelRatio(Math.min(devicePixelRatio,1.5));
composer.addPass(new RenderPass(scene,camera));
const ao=new GTAOPass(scene,camera,1,1);
ao.updateGtaoMaterial({radius:.7,distanceExponent:1.3,thickness:.15,distanceFallOff:1,samples:8});
ao.updatePdMaterial({radius:4,rings:2,samples:8});
ao.blendIntensity=.9;
composer.addPass(ao);composer.addPass(new OutputPass());
// Standing outside the eastern gate, looking in — the way anyone approaching
// the tabernacle would have come to it. A yaw of +PI/2 turns the camera's own
// -Z toward -X, which is where the court lies; -PI/2 faces the empty desert.
walker.moveTo(CUBIT * 62, 0, Math.PI / 2);

// ── where you are ─────────────────────────────────────────────────────────
// Named zones rather than coordinates, each carrying the verse that defines it.
const ZONES: { test: (x: number, z: number) => boolean; zh: string; en: string; ref: string }[] = [
  { zh: '至圣所', en: 'The most holy place', ref: '出 26:33–34 · Ex 26:33–34',
    test: (x,z) => x < CUBIT * -25 && x>CUBIT*-35 && Math.abs(z)<CUBIT*5 },
  { zh: '圣所 · 灯台 · 陈设饼桌 · 香坛',
    en: 'The holy place — lampstand, table, incense',
    ref: '出 25:23–40、26:35、30:1–6 · Ex 25:23–40, 26:35, 30:1–6',
    test: (x,z) => x < CUBIT * -5 && x>=CUBIT*-25 && Math.abs(z)<CUBIT*5 },
  { zh: '会幕内', en: 'Inside the tent', ref: '出 26:15 · Ex 26:15',
    test: (x) => x < CUBIT * 10 },
  { zh: '院内 · 铜坛旁', en: 'The court — by the bronze altar', ref: '出 27:1 · Ex 27:1',
    test: (x) => x > CUBIT * 20 && x < CUBIT * 36 },
  { zh: '院子内', en: 'Inside the court', ref: '出 27:18 · Ex 27:18',
    test: (x, z) => Math.abs(x) < CUBIT * 50 && Math.abs(z) < CUBIT * 25 },
];

const gateEl = document.getElementById('gate')!;

/** display:none does not pause a video — it keeps decoding, and a looping clip
 * decoding behind a WebGL walk costs enough frames that the controls feel
 * unresponsive and the visitor reads it as being stuck. Every place that shows
 * or hides the gate goes through here so the film cannot be left running. */
const film = document.querySelector<HTMLVideoElement>('#gate-film video');
function setGate(visible: boolean) {
  gateEl.classList.toggle('hidden', !visible);
  if (!film) return;
  if (visible) void film.play().catch(() => {/* autoplay refused; poster stands */});
  else film.pause();
}
const hud = document.getElementById('hud')!;
const whereEl = document.getElementById('where')!;
const verseEl = document.getElementById('verse')!;

const TALLY: [number, string, string, string][] = [
  [counts.courtPillars, 'pillars of the court', '院子的柱子', 'Ex 27:10–16'],
  [counts.boards, 'boards', '竖板', 'Ex 26:18–25'],
  [counts.sockets, 'silver sockets', '带卯的座', 'Ex 26:19'],
  [counts.bars, 'bars', '横闩', 'Ex 26:26–27'],
  [counts.clasps, 'gold clasps', '金钩', 'Ex 26:6'],
  [counts.curtains, 'curtains', '幔子', 'Ex 26:1'],
];
function renderTally() {
  document.getElementById('tally')!.innerHTML = TALLY
    .map(([n, en, zh, ref]) => `<div><b>${n}</b><span>${t(en, zh)}</span><i>${hant(ref)}</i></div>`)
    .join('');
}

// A phone has neither pointer lock nor a keyboard, so the enter button cannot
// ask for a lock — it would fail silently and leave the visitor at the gate for
// good. On touch the gate simply opens and the two-thumb controls take over.
const touchOnly = Walker.touchOnly;
if (touchOnly) {
  document.getElementById('enter')!.innerHTML =
    '<span data-en="Walk it myself" data-zh="自己走">Walk it myself</span>';
  document.querySelector('.keys')!.innerHTML =
    '<span data-en="drag the left half to walk" data-zh="左半屏拖动走路"></span>' +
    '<span data-en="drag the right half to look" data-zh="右半屏拖动转头"></span>';
}
document.getElementById('enter')!.addEventListener('click', () => {
  if (touchOnly) walker.enterTouch(); else canvas.click();
});
// The gate is up at load; ask once, since a muted autoplay is refused often
// enough that leaving it to the attribute shows a still where a clip was meant.
setGate(true);

walker.onLockChange = (locked) => {
  setGate(!locked);
  hud.hidden = !locked;
};

// The plan's viewBox maps the court's own extent, so the dot's position is the
// walker's actual position and not an approximation drawn to look right.
const you = document.getElementById('p-you')!;
const PLAN = { x0: 1, y0: 1, w: 130, h: 72 };
const COURT_L = CUBIT * 100, COURT_W = CUBIT * 50;

// ── the guided walk ───────────────────────────────────────────────────────
const tour = new Tour(CUBIT);
const tourBar = document.getElementById('tour-bar')!;
const tourFill = tourBar.querySelector('i') as HTMLElement;
const tourToggle = document.getElementById('tour-toggle')!;
const stopSelect=document.getElementById('tour-stop') as HTMLSelectElement;
const veilFade=document.getElementById('view-transition')!;

let tourCaption: { zh: string; en: string; ref: string } | null = null;

tour.onStop = (stop, i, total) => {
  tourCaption = stop;
  whereEl.textContent = t(stop.en, stop.zh);
  verseEl.textContent = stop.ref;
  tourFill.style.width = `${((i + 1) / total * 100).toFixed(0)}%`;
  lastZone = '__tour';           // keep the zone readout from overwriting this
  stopSelect.value=String(i);
};
tour.onEnd = () => {
  tourToggle.textContent='↺';
  tourToggle.setAttribute('aria-label',t('Replay the tour','重新导览'));
};

// Any reach for the controls ends the tour. A guided walk that fights the
// visitor for the camera is worse than no guided walk.
walker.onManualInput = () => { if (tour.running||tour.paused) endTour(); };

function startTour() {
  setGate(false);
  hud.hidden = false;
  tourBar.hidden = false;
  tourToggle.hidden = false;
  tourToggle.textContent = '❚❚';
  tourToggle.setAttribute('aria-label',t('Pause tour','暂停导览'));
  const first = TOUR[0]!;
  // Start already facing the first stop's subject, so the tour does not open
  // by swinging the whole world around.
  walker.moveTo(first.x * CUBIT, first.z * CUBIT,
                Math.atan2(-(first.at.x - first.x), -(first.at.z - first.z)));
  tour.start(walker.pose);
}
function endTour() {
  tour.stop();
  tourCaption = null;
  tourToggle.hidden = true;
  tourBar.hidden = true;
  lastZone = '';
}
document.getElementById('tour')!.addEventListener('click', startTour);
tourToggle.addEventListener('click', () => {
  if (tour.running) { tour.pause(); tourToggle.textContent = '▶';tourToggle.setAttribute('aria-label',t('Resume tour','继续导览')); }
  else if(tour.paused){tour.resume();tourToggle.textContent='❚❚';tourToggle.setAttribute('aria-label',t('Pause tour','暂停导览'));}
  else startTour();
});
function inspectStop(index:number){
  tour.pause();walker.setPose(tour.goTo(index));tourToggle.hidden=false;
  tourToggle.textContent='▶';tourToggle.setAttribute('aria-label',t('Resume tour','继续导览'));
}
stopSelect.addEventListener('change',()=>inspectStop(Number(stopSelect.value)));
document.getElementById('tour-prev')!.addEventListener('click',()=>inspectStop(tour.currentIndex-1));
document.getElementById('tour-next')!.addEventListener('click',()=>inspectStop(tour.currentIndex+1));
function exitWalk(){endTour();walker.exit();setGate(true);hud.hidden=true;}
document.getElementById('walk-exit')!.addEventListener('click',exitWalk);
addEventListener('keydown',e=>{if(e.code==='Escape')exitWalk();});
document.getElementById('model-info')!.addEventListener('click',()=>{
  if(tour.running){tour.pause();tourToggle.textContent='▶';}
  (document.getElementById('assumptions') as HTMLDialogElement).showModal();
});

let lastZone = '';
function updateHud() {
  const { x, z } = walker.position;
  // While the tour is speaking, the caption is its own; the plan still tracks.
  if (tourCaption) {
    const u0 = (x + COURT_L / 2) / COURT_L;
    const v0 = (z + COURT_W / 2) / COURT_W;
    you.setAttribute('cx', String(PLAN.x0 + PLAN.w * Math.max(-0.12, Math.min(1.12, u0))));
    you.setAttribute('cy', String(PLAN.y0 + PLAN.h * Math.max(-0.12, Math.min(1.12, v0))));
    return;
  }

  // World +x is the court's eastern end, which the plan draws on the right.
  const u = (x + COURT_L / 2) / COURT_L;
  const v = (z + COURT_W / 2) / COURT_W;
  you.setAttribute('cx', String(PLAN.x0 + PLAN.w * Math.max(-0.12, Math.min(1.12, u))));
  you.setAttribute('cy', String(PLAN.y0 + PLAN.h * Math.max(-0.12, Math.min(1.12, v))));

  const zone = ZONES.find((zn) => zn.test(x, z));
  const name = zone ? t(zone.en, zone.zh) : t('Outside the court', '院外');
  if (name === lastZone) return;
  lastZone = name;
  whereEl.textContent = name;
  verseEl.textContent = zone?.ref ?? '';
}

// ── loop ──────────────────────────────────────────────────────────────────
function fit() {
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  camera.aspect = w / h;
  // Keep a whole furnishing visible in a portrait viewport; this changes
  // only on resize, never in response to playback progress.
  camera.fov=w<h?84:65;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w,h);
  // Contact shading at half resolution, denoised; geometry remains full res.
  ao.setSize(Math.ceil(w*.6),Math.ceil(h*.6));
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe(document.body);
fit();

// ── language ──────────────────────────────────────────────────────────────
bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
function applyLocale() {
  applyStatic();
  renderTally();
  stopSelect.replaceChildren(...TOUR.map((s,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1} / ${TOUR.length} · ${t(s.en,s.zh)}`;return option;}));
  if(tour.currentIndex>=0)stopSelect.value=String(tour.currentIndex);
  document.getElementById('tour-prev')!.setAttribute('aria-label',t('Previous stop','上一站'));
  document.getElementById('tour-next')!.setAttribute('aria-label',t('Next stop','下一站'));
  lastZone = '';                       // force the zone readout to re-render
  if (tourCaption) {
    whereEl.textContent = t(tourCaption.en, tourCaption.zh);
    verseEl.textContent = tourCaption.ref;
  }
}
onLocale(applyLocale);
applyLocale();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const pose = tour.update(dt);
  // The tour owns the camera while it runs; otherwise the walker does.
  if (pose) walker.setPose(pose); else walker.update(dt);
  veilFade.style.opacity=String(tour.fade);
  updateHud();
  renderer.info.reset();composer.render();
});

if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__walk = {
    scene, camera, renderer, walker, counts, colliders, CUBIT, updateHud,
    tour, startTour, endTour, TOUR, ready, materialsReady: sceneReady, inspectStop,
    /** Renders one frame at an arbitrary size and returns it, so the scene can
     *  be inspected where the page is not being painted. */
    snapshot(w = 1400, h = 900) {
      const prev = { w: renderer.domElement.width, h: renderer.domElement.height };
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      walker.yaw.updateMatrixWorld(true);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setSize(prev.w, prev.h, false);
      return url;
    },
  };
}
