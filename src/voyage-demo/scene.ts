import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { detailedSurface, rockProjection, materialsReady } from '../walk/materials.ts';

// The close scene: real water, a lit shore, and the generated ship/walkers
// (D19, handoff/13-asset-library.md) brought up to a scale where the text no
// longer names anything. Mountable rather than page-owned, so the globe
// (src/main.ts) can open it as an overlay reached by clicking the ship on an
// actual route, and close back to the map — not send the reader to a
// separate URL. `voyage-demo.html` is the other caller: a thin dev harness
// against the same module, kept for fast iteration on this file alone.
//
// Nothing here claims to be an excavated place; it never puts a name to what
// it shows, which is exactly why it is allowed the licence a labelled map
// is not.

// ── how fast people walk ────────────────────────────────────────────────
// The canned Casual_Walk clip played at its native rate reads as marching
// rather than travelling — reported directly against the globe's own use of
// it. This is now the one place that rate is set; the globe's own loader
// (journey-actors/models.ts) carries the same constant.
const WALK_RATE = 0.62;

export interface VoyageHandle {
  /** Resolves once the generated pieces have loaded (or failed — this scene
   *  has no procedural fallback of its own; it is the fallback's showcase,
   *  not a route the map depends on). */
  readonly ready: Promise<void>;
  animating: boolean;
  outlinesVisible: boolean;
  autoRotate: boolean;
  /** Whether the render loop itself runs at all — distinct from `animating`,
   *  which only freezes the walk/sail simulation while still drawing every
   *  frame. The globe's overlay sets this false while the canvas is hidden,
   *  so a closed scene costs nothing; the standalone page never touches it. */
  active: boolean;
  /** Call after the canvas's own on-screen size changes — an overlay opening
   *  is exactly such a change, and the caller knows when that happens. */
  resize(width: number, height: number): void;
  /** Full teardown: stops the loop, disposes geometries/materials/textures,
   *  releases the WebGL context. Not part of the open/close flow the globe
   *  uses today (that keeps the scene warm and just hides the canvas, so
   *  reopening is instant and the models are never re-fetched) — kept for
   *  whichever caller eventually does need to let this go, and so the cost
   *  of keeping it alive is a stated choice, not an oversight. */
  dispose(): void;
}

function outlineMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0x1c150e, side: THREE.BackSide });
}

/** The classic inverted-hull trick: a backface-only, unlit, slightly larger
 * copy of the same mesh, drawn first. It is what actually reads as "a
 * character" rather than "a specimen" at this scale — the low-poly geometry
 * on its own was never going to carry that, and it was not built to. */
function addStaticOutline(mesh: THREE.Object3D, scale = 1.045) {
  const outline = mesh.clone(true);
  outline.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = outlineMaterial(); });
  // `clone()` copies `mesh`'s CURRENT scale (the ship's is ~15x, fitting its
  // raw geometry to a real hull length), and the outline is then parented
  // under that same `mesh` — so a `multiplyScalar` here compounded with the
  // inherited parent scale and blew the outline up roughly 15x too big,
  // swallowing most of the sky. It has to be a plain local scale instead,
  // expressed relative to `mesh`'s own space, not `mesh`'s own scale again.
  outline.scale.setScalar(scale);
  outline.position.set(0, 0, 0);
  outline.rotation.set(0, 0, 0);
  // A negative renderOrder, not scene-graph position, is what gets this drawn
  // before the coloured mesh it surrounds — three.js sorts opaque objects by
  // renderOrder regardless of parentage.
  outline.renderOrder = -1;
  mesh.add(outline);
  return outline;
}

// Same two bugs as the globe's own loader (journey-actors/models.ts), fixed
// the same way, because they are properties of the source files, not of
// where the files are used: metalness=1 with no map, and a skinned rig whose
// true height lives in its skeleton, not in Box3.setFromObject.
function clampMetalness(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (std.metalness !== undefined && !std.metalnessMap) std.metalness = Math.min(std.metalness, 0.06);
    }
  });
}
function skeletonHeight(root: THREE.Object3D): number {
  const box = new THREE.Box3(); const v = new THREE.Vector3(); let skinned = false;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    skinned = true;
    for (const bone of sm.skeleton.bones) box.expandByPoint(bone.getWorldPosition(v));
  });
  if (!skinned) box.setFromObject(root);
  return Math.max(0.1, box.max.y - box.min.y);
}
const FACING_CORRECTION = Math.PI / 2; // these rigs face local +Z; the scene calls forward +X.
function castShadows(root: THREE.Object3D) {
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
}

// "Bigger and cuter, no problem" — explicit direction, and the opposite
// instinct from the globe (where these figures are meant to be found, not
// stared at). CUTE_SCALE only pushes them past life-size; it does not touch
// proportion, which stays whatever the source model already is.
const CUTE_SCALE = 1.35;

/** A generated tileable normal map — an analytic sum of five periodic
 * swells, each an integer number of cycles across the tile so it wraps with
 * no seam — rather than a downloaded water-normals photo. Encodes a real
 * slope field, not decorative noise: the highlights the Water shader draws
 * from it are the slope of an actual (if invented) wave surface. */
function oceanNormalMap(size = 512): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const twoPi = Math.PI * 2;
  const waves = [
    { kx: 3, ky: 1, amp: 1.0, phase: 0.0 },
    { kx: -2, ky: 4, amp: 0.62, phase: 1.3 },
    { kx: 7, ky: -3, amp: 0.34, phase: 2.7 },
    { kx: -9, ky: -6, amp: 0.17, phase: 0.4 },
    { kx: 13, ky: 5, amp: 0.08, phase: 4.1 },
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hx = 0, hy = 0;
      for (const w of waves) {
        const kx = (w.kx * twoPi) / size, ky = (w.ky * twoPi) / size;
        const phase = x * kx + y * ky + w.phase;
        const s = Math.sin(phase);
        hx += -w.amp * kx * s; hy += -w.amp * ky * s;
      }
      const nx = -hx, ny = -hy, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * size + x) * 4;
      data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ── what actually makes a hull read as sailing, not anchored ──────────────
// Three things, none of which needed Blender: a real draft (part of the hull
// below the waterline, not the whole thing perched on top of it), an actual
// heading and forward progress instead of bobbing in place, and a wake.
//
// Water.js never displaces its own mesh — the ripples are shading, not
// geometry — so there is no real wave height to sample from the water object
// itself. This is a second, independent analytic wave field for the hull to
// physically respond to. It is not claimed to line up pixel-for-pixel with
// the shader's own scroll; it only has to feel like the same sea.
function waveHeight(x: number, z: number, t: number): number {
  return 0.10 * Math.sin(x * 0.05 + z * 0.03 + t * 1.1)
       + 0.06 * Math.sin(x * 0.09 - z * 0.07 + t * 1.7 + 1.3)
       + 0.03 * Math.sin(x * 0.16 + z * 0.14 - t * 2.3 + 2.7);
}

/** A soft trailing foam strip: bright near the stern, fading over its length
 * and tapering at the edges. Cheap — one plane, one canvas texture — and it
 * carries more of "this hull is moving" than the hull's own animation does. */
function makeWakeTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const along = Math.pow(1 - y / size, 1.4); // 1 at the stern, 0 at the tail
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 2 - 1;
      const across = Math.max(0, 1 - Math.abs(u) * 1.3);
      const i = (y * size + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      // 190 read as barely there against the water's own pale tone — measured
      // by sampling a top-down render, not judged from the angled view where
      // the difference is easy to miss. 250 is close to opaque at the ship
      // end and still tapers to nothing by the tail.
      img.data[i + 3] = Math.round(along * across * 250);
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export function mountVoyage(canvas: HTMLCanvasElement): VoyageHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  // Without an explicit setSize, the drawing buffer stays at the canvas
  // element's HTML default (300×150) and CSS just stretches that across the
  // viewport — every edge in the scene reads pixelated, and it looks like a
  // rendering-quality problem when it is only ever this one missing call.
  const initialW = canvas.clientWidth || innerWidth, initialH = canvas.clientHeight || innerHeight;
  renderer.setSize(initialW, initialH, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // A touch brighter and more saturated than the tabernacle's 1.05 — this
  // scene is asking to read as bright and cheerful, not reverent interior light.
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, initialW / initialH, 0.1, 2500);
  camera.position.set(30, 15, 36);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 3.2, -6);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 8;
  controls.maxDistance = 160;
  controls.maxPolarAngle = Math.PI * 0.49; // never dip the camera under the water
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.update();

  // ── sky + sun ────────────────────────────────────────────────────────────
  // Not three.js's Sky.js. That is a genuine Preetham atmosphere simulation,
  // and simulations have a failure mode a hand-authored gradient does not:
  // its Rayleigh term away from the sun runs weak enough, even at a generous
  // turbidity, that an orbiting camera drifts into near-black sky the moment
  // it swings past the anti-solar point — found by isolating the shader from
  // the rest of the scene and sweeping the sun-to-view angle, not by
  // guessing. A cheerful, stylised scene never wanted the physics; it wanted
  // a sky that is never wrong to look at, so this is a plain two-stop
  // gradient instead.
  const sun = new THREE.Vector3();
  const sunElevation = 46, sunAzimuth = -125;
  {
    const phi = THREE.MathUtils.degToRad(90 - sunElevation);
    const theta = THREE.MathUtils.degToRad(sunAzimuth);
    sun.setFromSphericalCoords(1, phi, theta);
  }
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        horizon: { value: new THREE.Color(0xdcefe6) },
        zenith: { value: new THREE.Color(0x3f8fd1) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 horizon; uniform vec3 zenith;
        varying vec3 vDir;
        void main() {
          float t = smoothstep(-0.05, 0.55, vDir.y);
          gl_FragColor = vec4(mix(horizon, zenith, t), 1.0);
        }`,
    }),
  );
  scene.add(skyDome);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyEnvScene = new THREE.Scene();
  skyEnvScene.add(skyDome.clone());
  const envRT = pmrem.fromScene(skyEnvScene, 0, 0.1, 2200);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;
  // Same gradient, painted flat: the safety net if any pixel ever misses the
  // dome, and what a viewer briefly sees before the dome's first paint.
  scene.background = new THREE.Color(0x9fd2e8);

  const sunLight = new THREE.DirectionalLight(0xfff3d9, 3.1);
  sunLight.position.copy(sun).multiplyScalar(120);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -55; sunLight.shadow.camera.right = 55;
  sunLight.shadow.camera.top = 45; sunLight.shadow.camera.bottom = -45;
  sunLight.shadow.camera.near = 40; sunLight.shadow.camera.far = 220;
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(0xbcdcff, 0xc9a877, 0.55);
  scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xcfe6ea, 0.0016);

  // ── water ──────────────────────────────────────────────────────────────
  const waterNormals = oceanNormalMap(512);
  const waterGeo = new THREE.PlaneGeometry(4000, 4000);
  const water = new Water(waterGeo, {
    textureWidth: 1024, textureHeight: 1024,
    waterNormals,
    sunDirection: sun.clone(),
    sunColor: 0xfff3d6,
    // Shallow, sunlit sea-green near the boat rather than open-ocean navy —
    // this is a coast, not mid-Mediterranean.
    waterColor: 0x1c5f5a,
    distortionScale: 2.6,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size!.value = 1.6;
  scene.add(water);

  // ── shore ──────────────────────────────────────────────────────────────
  // An original illustrative beach, not a surveyed cove — same status as the
  // tabernacle's desert surround (walk/environment.ts), built the same way:
  // geometry carries the shape, the generated ground/rock studies from
  // Phase 3 carry the surface detail.
  const noise = new ImprovedNoise();
  const N = (x: number, z: number, seed = 0) => noise.noise(x, z, 11 + seed);
  function shoreHeight(x: number, z: number) {
    const wx = x + N(x * 0.02, z * 0.02) * 5;
    const wz = z + N(x * 0.021, z * 0.021, 4) * 5;
    const rise = THREE.MathUtils.smoothstep(z, -4, 26);
    const dune = (N(wx * 0.045, wz * 0.045, 2) * 0.5 + 0.5) * 2.4;
    const grain = (N(wx * 0.16, wz * 0.16, 8) * 0.5 + 0.5) * 0.5;
    return rise * (0.5 + dune + grain) - (1 - rise) * 1.4;
  }
  const shoreGeo = new THREE.PlaneGeometry(260, 260, 220, 220);
  shoreGeo.rotateX(-Math.PI / 2);
  {
    const p = shoreGeo.attributes.position!;
    const colors = new Float32Array(p.count * 3);
    const wet = new THREE.Color('#8a7454'), dry = new THREE.Color('#e4d3ab'), grass = new THREE.Color('#aab07a');
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = shoreHeight(x, z);
      p.setY(i, h);
      const damp = THREE.MathUtils.smoothstep(h, -0.4, 0.6);
      c.copy(wet).lerp(dry, damp).lerp(grass, THREE.MathUtils.smoothstep(h, 2.4, 4.2));
      c.multiplyScalar(0.9 + N(x * 0.05, z * 0.05, 30) * 0.14);
      c.toArray(colors, i * 3);
    }
    shoreGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    shoreGeo.computeVertexNormals();
  }
  const shoreMat = detailedSurface(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, vertexColors: true }), 'desert-ground', 14, 0.09);
  const shore = new THREE.Mesh(shoreGeo, shoreMat);
  shore.receiveShadow = true;
  scene.add(shore);

  // Scattered shore rocks, the same triplanar-projected material as the
  // tabernacle's desert stones — cheap detail that makes the sand read as a
  // real place to stand rather than a painted disc.
  const stoneGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const sp = stoneGeo.attributes.position!;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
      const r = 1 + N(x * 3, z * 3, y * 2 + 40) * 0.22;
      sp.setXYZ(i, x * r, y * r * 0.72, z * r);
    }
    stoneGeo.computeVertexNormals();
  }
  const stoneMat = detailedSurface(new THREE.MeshStandardMaterial({ color: 0xb7ab97, roughness: 0.97 }), 'desert-rock', 1, 0.02);
  rockProjection(stoneMat, 1.1);
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, 46);
  stones.castShadow = true; stones.receiveShadow = true;
  {
    const dummy = new THREE.Object3D(); const tint = new THREE.Color();
    let count = 0;
    for (let i = 0; count < 46; i++) {
      const a = i * 2.399963, radius = 6 + ((Math.sin(i * 12.9) * 0.5 + 0.5) ** 0.6) * 42;
      const x = Math.cos(a) * radius * 0.9, z = Math.sin(a) * radius * 0.5 + 14;
      if (z < 2) continue;
      const size = 0.14 + (Math.sin(i * 5.1) * 0.5 + 0.5) ** 4 * 0.9;
      dummy.position.set(x, shoreHeight(x, z) + size * 0.3, z);
      dummy.scale.set(size * 1.3, size, size * 0.85);
      dummy.rotation.set(i * 0.4, i * 1.7, i * 0.21);
      dummy.updateMatrix();
      stones.setMatrixAt(count, dummy.matrix);
      tint.setHSL(0.09, 0.1, 0.62 + Math.sin(i * 4) * 0.08);
      stones.setColorAt(count, tint);
      count++;
    }
  }
  scene.add(stones);

  const loader = new GLTFLoader();

  async function loadWalker(url: string, standHeight: number): Promise<{ template: THREE.Object3D; clip: THREE.AnimationClip }> {
    const gltf: GLTF = await loader.loadAsync(url);
    clampMetalness(gltf.scene);
    castShadows(gltf.scene);
    gltf.scene.rotation.y = FACING_CORRECTION;
    const fit = (standHeight / skeletonHeight(gltf.scene)) * CUTE_SCALE;
    gltf.scene.scale.setScalar(fit);
    const clip = gltf.animations[0];
    if (!clip) throw new Error(`${url}: no clip`);
    return { template: gltf.scene, clip };
  }

  function spawnWalker(asset: { template: THREE.Object3D; clip: THREE.AnimationClip }, phase: number) {
    const group = new THREE.Group();
    const inner = SkeletonUtils.clone(asset.template);
    group.add(inner);
    addStaticOutline(inner, 1.05);
    const mixer = new THREE.AnimationMixer(inner);
    const action = mixer.clipAction(asset.clip);
    action.timeScale = WALK_RATE;
    action.play();
    mixer.update(phase);
    return { group, mixer };
  }

  let animating = true;
  const mixers: THREE.AnimationMixer[] = [];
  const walkers: { group: THREE.Object3D; mixer: THREE.AnimationMixer; path: (t: number) => [number, number] }[] = [];
  let shipGroup: THREE.Group | null = null;
  let wake: THREE.Mesh | null = null;
  let shipPath: ((t: number) => [number, number]) | null = null;
  let shipLength = 0;

  const ready = (async () => {
    const PERSON_HEIGHT = 1.72; // metres — this scene has no procedural
    // miniature to fit against, so it fits to a plain human-scale reference.
    const [traveller, shepherd, shipGltf] = await Promise.all([
      loadWalker('models/traveller-v1.glb', PERSON_HEIGHT),
      loadWalker('models/shepherd-v1.glb', PERSON_HEIGHT),
      loader.loadAsync('models/roman-grain-ship-v1.glb'),
    ]);

    // Ship: fit to a plausible real length for a coastal grain vessel
    // (source gives no measurement — Acts 27 names the ship, not its size —
    // so this is a chosen, stated number, not a recovered one).
    const SHIP_LENGTH = 22 * CUTE_SCALE;
    shipLength = SHIP_LENGTH;
    clampMetalness(shipGltf.scene); castShadows(shipGltf.scene);
    const shipBox = new THREE.Box3().setFromObject(shipGltf.scene);
    const shipSize = shipBox.getSize(new THREE.Vector3());
    const shipScale = SHIP_LENGTH / (shipSize.x || 1);
    shipGltf.scene.scale.setScalar(shipScale);
    // A real draft, not the whole hull perched on the surface: ~0.9 m for a
    // 22 m coastal grain vessel is a plausible ratio for a shallow-draft
    // merchant hull, scaled with everything else.
    const DRAFT = 0.9 * CUTE_SCALE;
    shipGltf.scene.position.y = -shipBox.min.y * shipScale - DRAFT;
    shipGroup = new THREE.Group();
    shipGroup.add(shipGltf.scene);
    addStaticOutline(shipGltf.scene, 1.02);
    scene.add(shipGroup);
    const shipDeckY = 0.36 * shipSize.y * shipScale - DRAFT; // conservative deck estimate

    // A slow loop just offshore rather than a fixed anchor point — the hull
    // needs an actual heading and forward progress to read as sailing, not
    // just a place to bob. Radii chosen to stay clear of the shore's rise
    // (shoreHeight starts climbing at z > -4).
    const shipAnchor = new THREE.Vector2(-2, -26);
    shipPath = (t: number): [number, number] => {
      const a = t * 0.07;
      return [shipAnchor.x + Math.cos(a) * 11, shipAnchor.y + Math.sin(a) * 5];
    };

    const wakeTexture = makeWakeTexture();
    wake = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: wakeTexture, transparent: true, depthWrite: false }),
    );
    wake.rotation.x = -Math.PI / 2;
    scene.add(wake);

    // One sailor standing on deck — static, matching how the globe already
    // treats a passenger riding a moving vessel (no canned rowing/paddling
    // clip exists in the animation library actually searched for one).
    const sailor = spawnWalker(traveller, 1.1);
    sailor.mixer.timeScale = 0; // frozen pose: standing, not marching in place
    sailor.group.position.set(1.4, shipDeckY, 0.6);
    sailor.group.rotation.y = -0.4;
    shipGroup.add(sailor.group);
    mixers.push(sailor.mixer);

    // Two figures walking the beach — where WALK_RATE actually shows.
    const beachWalk = (a: THREE.Vector2, b: THREE.Vector2) => (t: number): [number, number] => {
      const u = (Math.sin(t * 0.12) + 1) / 2; // slow there-and-back, not a lap
      return [THREE.MathUtils.lerp(a.x, b.x, u), THREE.MathUtils.lerp(a.y, b.y, u)];
    };
    const specs: [typeof traveller, THREE.Vector2, THREE.Vector2, number][] = [
      [traveller, new THREE.Vector2(-16, 10), new THREE.Vector2(14, 16), 0],
      [shepherd, new THREE.Vector2(10, 20), new THREE.Vector2(-10, 9), 2.1],
    ];
    for (const [asset, from, to, phase] of specs) {
      const w = spawnWalker(asset, phase);
      scene.add(w.group);
      mixers.push(w.mixer);
      walkers.push({ ...w, path: beachWalk(from, to) });
    }
  })();

  void materialsReady();

  const clock = new THREE.Clock();
  let t = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (animating) {
      t += dt;
      water.material.uniforms.time!.value += dt * 0.62;
      for (const m of mixers) m.update(dt);
      for (const w of walkers) {
        const [x, z] = w.path(t);
        w.group.position.set(x, shoreHeight(x, z), z);
        // Face along the direction of travel — derivative of the same path.
        const [x2, z2] = w.path(t + 0.05);
        w.group.rotation.y = Math.atan2(x2 - x, z2 - z);
      }
      if (shipGroup && shipPath && wake) {
        // Heading from the path's own tangent — the same technique the
        // beach walkers use above, and the globe's own route-following in
        // staffage.ts: never a hand-set angle, always the derivative of
        // where the thing is actually going.
        const [sx, sz] = shipPath(t);
        const [sx2, sz2] = shipPath(t + 0.08);
        const heading = Math.atan2(sx2 - sx, sz2 - sz);
        shipGroup.position.x = sx; shipGroup.position.z = sz;
        shipGroup.rotation.y = heading;

        // Heave and pitch from the same wave field the water's normal map is
        // built from — sampled at the bow and stern so the hull actually
        // responds to passing swell instead of oscillating on its own clock.
        // This nudges rotation.x/.z directly after the heading is set rather
        // than composing a proper rigid-body basis (the way staffage.ts's
        // makeBasis does for the globe's actors) — correct for small angles;
        // a version that needs to survive a hard turn should build the
        // basis properly instead.
        const half = shipLength * 0.42;
        const fx = Math.sin(heading), fz = Math.cos(heading);
        const bow = waveHeight(sx + fx * half, sz + fz * half, t);
        const stern = waveHeight(sx - fx * half, sz - fz * half, t);
        shipGroup.position.y = (bow + stern) / 2;
        shipGroup.rotation.x = Math.atan2(bow - stern, shipLength * 0.85);
        shipGroup.rotation.z = Math.sin(t * 0.5) * 0.018;

        // The wake: a strip trailing from the stern along the current
        // heading, just proud of the water plane so it never z-fights it.
        const wakeLength = shipLength * 2.1, wakeWidth = shipLength * 0.5;
        wake.position.set(sx - fx * half, 0.02, sz - fz * half);
        wake.rotation.y = heading;
        wake.scale.set(wakeWidth, wakeLength, 1);
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }
  let active = true;
  renderer.setAnimationLoop(frame);

  if (import.meta.env.DEV) {
    (globalThis as unknown as Record<string, unknown>).__voyage = {
      scene, camera, renderer, controls, water,
      get shipGroup() { return shipGroup; },
      walkers, mixers,
      snapshot(w = 1400, h = 900) {
        const prev = { w: renderer.domElement.width, h: renderer.domElement.height };
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL('image/png');
        renderer.setSize(prev.w, prev.h, false);
        camera.aspect = initialW / initialH; camera.updateProjectionMatrix();
        return url;
      },
    };
  }

  return {
    ready: ready.then(() => undefined),
    get animating() { return animating; },
    set animating(v: boolean) { animating = v; },
    get outlinesVisible() {
      let visible = true;
      scene.traverse((o) => { if (o.renderOrder === -1) visible = o.visible; });
      return visible;
    },
    set outlinesVisible(v: boolean) {
      scene.traverse((o) => { if (o.renderOrder === -1) o.visible = v; });
    },
    get autoRotate() { return controls.autoRotate; },
    set autoRotate(v: boolean) { controls.autoRotate = v; },
    get active() { return active; },
    set active(v: boolean) {
      if (v === active) return;
      active = v;
      renderer.setAnimationLoop(active ? frame : null);
      if (active) clock.getDelta(); // discard the gap while paused as one big dt
    },
    resize(width: number, height: number) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      controls.dispose();
      envRT.dispose();
      pmrem.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const m of mats) {
          for (const key of Object.keys(m) as (keyof typeof m)[]) {
            const value = m[key];
            if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
          }
          m.dispose();
        }
      });
      // Water.js keeps its own reflection WebGLRenderTarget in closure with
      // no public accessor, so it cannot be disposed from outside — a known,
      // small leak on full teardown. Harmless for the actual open/close flow
      // this scene is built for, which keeps one instance alive for the
      // page's lifetime rather than calling this.
      renderer.dispose();
    },
  };
}
