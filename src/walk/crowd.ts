import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { HEIGHT, SHADE, TURN } from './figures.ts';

// A crowd: one figure, thousands of times, at three costs.
//
// handoff/FIGURES.md wants 600,000 on foot at the exodus and "a crowd is one
// figure placed three thousand times". figures.place() does that honestly
// for a few dozen — one geometry, many transforms — but every copy it makes
// is a full skinned mesh with its own skeleton update, and a few hundred is
// where a phone stops. So a crowd is not placed with place(); it is drawn by
// this, which spends its budget by distance:
//
//   NEAR  (< 15 m)   the real thing. A pooled copy of the full skinned GLB
//                    with an AnimationMixer, because at three metres a reader
//                    is looking at a face, a hand, the hem of a robe, and
//                    nothing baked survives that. The pool is small (sixteen)
//                    and the copies are handed to whoever is nearest.
//   MID   (15–60 m)  the VAT figure, ~3,000 triangles. tools/autorig/vat.py
//                    baked the clips into a texture, one texel per vertex per
//                    frame; the vertex shader reads its own row and there are
//                    no bones, no skinning, no per-copy CPU work. One instanced
//                    draw for all of them, each at its own moment in the cycle.
//   FAR   (60–150 m) the same, at ~600 triangles.
//   BEYOND (> 150 m) a billboard: a quad showing one of 8 pre-rendered angles
//                    of the VAT figure at one of a few phases, cut from a
//                    sprite sheet this renders once at load. At 150 m a man is
//                    ten pixels tall; two triangles is what he is worth.
//
// Every copy still differs from its neighbour the way place() insists on —
// the ±4% height table, the four shades, its own moment in the walk — and
// the table is the same FIXED one, so a reader's screenshot is repeatable.
//
// WHAT IS SHARED, WHAT IS PER-COPY. The geometry, the atlas, the animation
// textures and the one material are shared by the whole crowd. Per copy the
// GPU holds a 4×4 matrix and two small attributes: iAnim = (clip, rate,
// offset, scale) and iTint. That is 92 bytes a person; 50,000 people is
// 4.6 MB, rewritten each frame the camera moves, which is the real cost of
// this design and is measured in crowd-test.
//
// WHY THE BUCKETS ARE REBUILT ON THE CPU. The obvious shortcut — one
// InstancedMesh per LOD each holding ALL members, with the vertex shader
// collapsing the ones not at its LOD — runs every LOD's vertex shader over
// every member: 50,000 × 3,900 vertices for the lod0 mesh alone, whether or
// not a person is near. Compacting the visible members of each tier into
// that tier's InstancedMesh costs a loop over the members in JS and an
// upload, and it also lets the same loop do frustum culling, which is what
// makes a fly-through cheap: most of the crowd is behind the camera.

/** What tools/autorig/vat.py writes beside the textures. */
export interface VatMeta {
  source: string;
  atlas: string;
  /** Rest-pose height of the baked mesh, metres; the crowd scales it to the figure's stated height. */
  height: number;
  facing: number[];
  lods: { mesh: string; pos: string; nrm: string; verts: number; tris: number;
          texWidth: number; texHeight: number; rowsPerFrame: number; frames: number;
          bounds: { min: number[]; max: number[] } }[];
  clips: Record<string, { first: number; frames: number; fps: number; duration: number;
                          min: number[]; max: number[]; speed?: number }>;
}

export interface CrowdOptions {
  /** URL of the vat.py .json; the other files are beside it. */
  meta: string;
  /** The full skinned GLB for the near ring. Without it the near ring is lod0. */
  full?: string;
  /** Stated height of the figure in metres (FIGURES.man.height). */
  height: number;
  /** How many members the crowd can hold. */
  capacity: number;
  /** Needed to render the impostor sheet once at load. */
  renderer: THREE.WebGLRenderer;
  /** Ring radii, metres. */
  near?: number; mid?: number; far?: number;
  /** Full skinned copies kept for the near ring. */
  nearPool?: number;
  /** Walkers wrap inside this box (x/z); leave unset for a crowd that stays put. */
  field?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** The scene's lights, cloned to light the impostor sheet, so the far ring
   *  is lit the way the rings in front of it are. Without them: a plain
   *  sky-and-sun of its own. */
  sheetLights?: THREE.Light[];
}

export interface CrowdStats {
  near: number; lod0: number; lod1: number; far: number; culled: number;
  /** ms spent in update() on the CPU */
  updateMs: number;
}

const MAX_CLIPS = 4;
const SHEET = { angles: 8, cols: 12, cell: [64, 128] as [number, number], frame: [1.2, 2.4] as [number, number] };

interface Tier {
  mesh: THREE.InstancedMesh; anim: THREE.InstancedBufferAttribute; tint: THREE.InstancedBufferAttribute;
  /** instances written this frame */
  n: number;
}

interface Member {
  x: number; z: number; heading: number; clip: number; n: number;
  /** m/s along heading; 0 for anyone standing */
  speed: number; rate: number; offset: number;
}

/** Per-instance attributes shared by the VAT shader and the impostor shader. */
function instanceAttrs(geometry: THREE.BufferGeometry, cap: number) {
  const anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  anim.setUsage(THREE.DynamicDrawUsage); tint.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('iAnim', anim);
  geometry.setAttribute('iTint', tint);
  return { anim, tint };
}

/** The VAT material: MeshStandardMaterial, lit and shadowed like everything
 *  else, with its vertex stage replaced by two texture reads.
 *
 *  The position texture is addressed by gl_VertexID — the geometry was written
 *  by vat.py in the same order, which is the one contract this depends on —
 *  and the frame comes from the instance's own clock, uTime × rate + offset,
 *  wrapped to the clip. Two frames are fetched and mixed so that idle, baked
 *  at 12 fps, still moves smoothly. texelFetch, not texture2D: the texel is
 *  the datum, and any filtering would blend neighbouring VERTICES. */
function vatMaterial(atlas: THREE.Texture, pos: THREE.Texture, nrm: THREE.Texture,
  lod: VatMeta['lods'][number], clips: THREE.Vector4[]) {
  const m = new THREE.MeshStandardMaterial({
    map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, metalness: 0,
  });
  const uniforms = {
    uPos: { value: pos }, uNrm: { value: nrm }, uTime: { value: 0 },
    uLayout: { value: new THREE.Vector4(lod.texWidth, lod.rowsPerFrame, 0, 0) },
    uClips: { value: clips },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uPos; uniform sampler2D uNrm; uniform float uTime;
        uniform vec4 uLayout; uniform vec4 uClips[${MAX_CLIPS}];
        attribute vec4 iAnim; attribute vec3 iTint; varying vec3 vTint;
        ivec2 vatTexel(int v, int frame) {
          int W = int(uLayout.x); int R = int(uLayout.y);
          return ivec2(v % W, frame * R + v / W);
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec4 clip = uClips[int(iAnim.x + 0.5)];           // first, frames, fps, duration
        float ft = mod(uTime * iAnim.y + iAnim.z, clip.w) * clip.z;
        float f0 = floor(ft); float fw = ft - f0;
        int i0 = int(clip.x) + int(f0);
        int i1 = int(clip.x) + int(min(f0 + 1.0, clip.y - 1.0));
        ivec2 t0 = vatTexel(gl_VertexID, i0), t1 = vatTexel(gl_VertexID, i1);
        vec3 vatP = mix(texelFetch(uPos, t0, 0).xyz, texelFetch(uPos, t1, 0).xyz, fw);
        vec3 vatN = mix(texelFetch(uNrm, t0, 0).xyz, texelFetch(uNrm, t1, 0).xyz, fw) * 2.0 - 1.0;
        vec3 objectNormal = normalize(vatN);
        vTint = iTint;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vatP;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= vTint;');
  };
  // Two LODs share the shader text but not the textures; three caches programs
  // by the material's customProgramCacheKey, so give each its own.
  m.customProgramCacheKey = () => `vat:${lod.mesh}`;
  m.userData.uniforms = uniforms;
  return m;
}

/** The billboard: a quad that turns to face the camera about its own y, and
 *  shows the sheet cell for the angle the camera sees it from and the phase
 *  its clock is at. The sheet was rendered lit, in linear light, so the
 *  fragment only tints it and hands it to the renderer's tone mapping. */
function impostorMaterial(sheet: THREE.Texture, cells: THREE.Vector4[]) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uSheet: { value: null }, uTime: { value: 0 }, uCells: { value: cells },
      uGrid: { value: new THREE.Vector2(SHEET.cols, SHEET.angles) },
      uFrame: { value: new THREE.Vector2(SHEET.frame[0], SHEET.frame[1]) },
    }]),
    // The scene's fog, through three's own chunks: the hand-off at 150 m is
    // between a lit, fogged mesh and this, and without fog here the far
    // crowd would sit in front of the haze it stands in.
    fog: true,
    vertexShader: `
      uniform float uTime; uniform vec4 uCells[${MAX_CLIPS}]; uniform vec2 uGrid; uniform vec2 uFrame;
      attribute vec4 iAnim; attribute vec3 iTint;
      varying vec2 vUv; varying vec3 vTint;
      #include <fog_pars_vertex>
      void main() {
        vec4 clip = uCells[int(iAnim.x + 0.5)];            // colStart, cols, duration, 0
        vec3 centre = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec2 fwd = normalize(vec2(instanceMatrix[2].x, instanceMatrix[2].z));   // the figure faces +z
        vec3 toCam = cameraPosition - centre;
        float psi = atan(toCam.x, toCam.z);                 // where the camera is, world
        float theta = atan(fwd.x, fwd.y);                   // where the figure looks, world
        float rel = psi - theta;                            // where the camera is, to the figure
        float a = mod(floor(rel / 6.2831853 * uGrid.y + 0.5), uGrid.y);
        float phase = mod(uTime * iAnim.y + iAnim.z, clip.z) / clip.z;
        float col = clip.x + floor(phase * clip.y);
        vUv = vec2((col + uv.x) / uGrid.x, (a + uv.y) / uGrid.y);
        vTint = iTint;
        vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
        vec3 p = centre + right * (position.x * uFrame.x * iAnim.w) + vec3(0.0, position.y * uFrame.y * iAnim.w, 0.0);
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D uSheet; varying vec2 vUv; varying vec3 vTint;
      #include <fog_pars_fragment>
      void main() {
        vec4 c = texture2D(uSheet, vUv);
        if (c.a < 0.5) discard;
        gl_FragColor = vec4(c.rgb * vTint, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  // Set after the merge: UniformsUtils.merge clones every value it is given
  // and refuses to clone a render target's texture — it puts null there and
  // warns — which made the whole far ring discard itself.
  m.uniforms['uSheet']!.value = sheet;
  return m;
}

export class Crowd extends THREE.Group {
  readonly members: Member[] = [];
  readonly stats: CrowdStats = { near: 0, lod0: 0, lod1: 0, far: 0, culled: 0, updateMs: 0 };
  time = 0;
  private near: number; private mid: number; private far: number;
  private field: CrowdOptions['field'];
  private tiers: Tier[];
  private uniforms: { uTime: { value: number } }[];
  private pool: { obj: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>;
                  mats: THREE.MeshStandardMaterial[]; base: THREE.Color[]; member: number }[] = [];
  private pooled = new Map<number, number>();
  private clipNames: string[];
  private durations: number[];
  /** metres per baked metre: the figure's stated height over the bake's */
  private unit: number;
  /** m/s of the baked walk at rate 1 — measured by vat.py off the planted foot. */
  readonly walkSpeed: number;
  private frustum = new THREE.Frustum();
  private pv = new THREE.Matrix4();
  private cam = new THREE.Vector3();

  private constructor(meta: VatMeta, opts: CrowdOptions,
    tiers: Tier[], uniforms: Crowd['uniforms'], full: THREE.Group | null, clipNames: string[]) {
    super();
    this.near = opts.near ?? 15; this.mid = opts.mid ?? 60; this.far = opts.far ?? 150;
    this.field = opts.field;
    this.tiers = tiers; this.uniforms = uniforms;
    this.clipNames = clipNames;
    this.durations = clipNames.map((c) => meta.clips[c]!.duration);
    this.unit = opts.height / meta.height;
    this.slotOf = new Int32Array(opts.capacity).fill(-1);
    this.memberAt = new Int32Array(opts.capacity).fill(-1);
    this.walkSpeed = (meta.clips['walk']?.speed ?? 1.2) * this.unit;
    for (const t of tiers) { t.mesh.frustumCulled = false; t.mesh.castShadow = false; this.add(t.mesh); }
    if (full) this.buildPool(full, opts.nearPool ?? 16);
  }

  /** Loads everything the crowd needs and renders its impostor sheet. */
  static async load(opts: CrowdOptions): Promise<Crowd> {
    const base = opts.meta.slice(0, opts.meta.lastIndexOf('/') + 1);
    const meta = await (await fetch(opts.meta)).json() as VatMeta;
    const gltf = new GLTFLoader(), exr = new EXRLoader(), tex = new THREE.TextureLoader();
    const data = (t: THREE.Texture) => {
      t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
      t.colorSpace = THREE.NoColorSpace; return t;
    };
    const atlas = await tex.loadAsync(base + meta.atlas);
    atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
    // The mesh's UVs are glTF's (origin top-left), which is why GLTFLoader
    // turns flipY off on every texture it loads; this atlas is loaded beside
    // the mesh rather than inside it, so the same has to be done here. With
    // the flip left on, every face reads a different island: a patchwork.
    atlas.flipY = false;
    const clipNames = Object.keys(meta.clips).slice(0, MAX_CLIPS);
    const clips = Array.from({ length: MAX_CLIPS }, (_, i) => {
      const c = meta.clips[clipNames[i] ?? clipNames[0]!]!;
      return new THREE.Vector4(c.first, c.frames, c.fps, c.duration);
    });
    const tiers: Tier[] = [], uniforms: Crowd['uniforms'] = [];
    for (const lod of meta.lods.slice(0, 2)) {
      const [scene, pos, nrm] = await Promise.all([
        gltf.loadAsync(base + lod.mesh), exr.loadAsync(base + lod.pos), tex.loadAsync(base + lod.nrm)]);
      const geometry = (scene.scene.children[0] as THREE.Mesh).geometry;
      const material = vatMaterial(atlas, data(pos), data(nrm), lod, clips);
      const mesh = new THREE.InstancedMesh(geometry, material, opts.capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      tiers.push({ mesh, ...instanceAttrs(geometry, opts.capacity), n: 0 });
      uniforms.push(material.userData.uniforms);
    }
    // The impostor sheet, from lod0, and the quads that show it.
    const cells = clipNames.map((c, i) => {
      const cols = i === 0 ? 8 : Math.max(1, Math.floor((SHEET.cols - 8) / Math.max(1, clipNames.length - 1)));
      return { start: i === 0 ? 0 : 8 + (i - 1) * cols, cols, duration: meta.clips[c]!.duration };
    });
    const cellVec = Array.from({ length: MAX_CLIPS }, (_, i) => {
      const c = cells[i] ?? cells[0]!; return new THREE.Vector4(c.start, c.cols, c.duration, 0);
    });
    const sheet = renderSheet(opts.renderer, tiers[0]!, uniforms[0]!, cells, opts.height / meta.height, opts.sheetLights);
    const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const imp = new THREE.InstancedMesh(quad, impostorMaterial(sheet.texture, cellVec), opts.capacity);
    imp.material.userData['sheet'] = sheet;          // kept so the sheet can be read back and checked
    imp.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    imp.count = 0;
    tiers.push({ mesh: imp, ...instanceAttrs(quad, opts.capacity), n: 0 });
    uniforms.push((imp.material as THREE.ShaderMaterial).uniforms as { uTime: { value: number } });

    let full: THREE.Group | null = null;
    // The full figure is optional in fact as well as in the type: a crowd
    // whose near ring cannot be loaded is still a crowd, drawn at lod0 close
    // up, and says so in the console rather than refusing to appear.
    const g = opts.full ? await gltf.loadAsync(opts.full).catch((e: unknown) => {
      console.warn(`crowd: no full figure at ${opts.full}; the near ring is lod0`, e); return null; }) : null;
    if (g) {
      // Scaled and grounded exactly as figures.loadFigure does, so the near
      // copy stands where the VAT copy stood, at the same height.
      const root = g.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 1e-4) root.scale.setScalar(opts.height / size.y);
      const scaled = new THREE.Box3().setFromObject(root);
      const centre = scaled.getCenter(new THREE.Vector3());
      root.position.set(-centre.x, -scaled.min.y, -centre.z);
      full = new THREE.Group(); full.add(root);
      full.animations = g.animations;
    }
    return new Crowd(meta, opts, tiers, uniforms, full, clipNames);
  }

  private buildPool(template: THREE.Group, size: number) {
    for (let k = 0; k < size; k++) {
      const obj = cloneSkinned(template);
      const mixer = new THREE.AnimationMixer(obj);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const clip of template.animations) actions[clip.name] = mixer.clipAction(clip);
      // Materials are cloned per pooled copy so that a tint can be set on
      // assignment without touching the copy next to it.
      const mats: THREE.MeshStandardMaterial[] = [], base: THREE.Color[] = [];
      // SkeletonUtils.clone gives every skinned mesh of the copy its own
      // Skeleton — ten per copy for this figure, each with its own bone
      // texture to compute and upload every frame, though all ten are the
      // same 52 bones. Bind them all to the first, so a copy is one skeleton.
      let shared: THREE.Skeleton | null = null;
      obj.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) {
          if (!shared) shared = o.skeleton;
          else if (o.skeleton !== shared && o.skeleton.bones.length === shared.bones.length
            && o.skeleton.bones.every((b, k) => b === shared!.bones[k])) o.bind(shared, o.bindMatrix);
        }
        if (o instanceof THREE.Mesh) {
          const m = (o.material as THREE.MeshStandardMaterial).clone();
          o.material = m; o.castShadow = true; o.receiveShadow = true;
          // A skinned mesh is culled by the bounds of its REST geometry, and
          // the sleeves of this figure rest nowhere near where the arm takes
          // them: close up, with the feet out of frame, the sleeves vanished
          // and the forearms went bare. The crowd's own loop already decides
          // who is on screen, so the copies need no second opinion.
          o.frustumCulled = false;
          mats.push(m); base.push(m.color.clone());
        }
      });
      obj.visible = false;
      this.add(obj);
      this.pool.push({ obj, mixer, actions, mats, base, member: -1 });
    }
  }

  /** Places (or re-places) member `i`, like figures.place(): `n` picks its
   *  height, shade and, for someone standing, the turn of its head; the
   *  moment in the cycle comes from `n` too, so no two neighbours step
   *  together. `clip` is an index into the baked clips (0 = walk, 1 = idle). */
  set(i: number, x: number, z: number, heading: number, clip: number, n: number) {
    const standing = this.clipNames[clip] !== 'walk';
    const rate = 1 + ((n * 7919) % 11 - 5) * 0.012;      // ±6% stride tempo, fixed by n
    const m: Member = {
      x, z, heading: heading + (standing ? TURN[n % TURN.length]! : 0), clip, n,
      speed: standing ? 0 : this.walkSpeed * rate * HEIGHT[n % HEIGHT.length]!,
      rate, offset: ((n * 2654435761) % 1000) / 1000 * this.durations[clip]!,
    };
    this.members[i] = m;
  }

  /** Advances the crowd by `dt` seconds and re-sorts it into tiers around `camera`. */
  update(dt: number, camera: THREE.Camera) {
    const t0 = performance.now();
    this.time += dt;
    for (const u of this.uniforms) u.uTime.value = this.time;
    camera.updateMatrixWorld();
    this.cam.setFromMatrixPosition(camera.matrixWorld);
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    const planes = this.frustum.planes;
    const near2 = this.near * this.near, mid2 = this.mid * this.mid, far2 = this.far * this.far;
    const keep2 = near2 * 1.44;                       // hysteresis: released at 1.2 × near
    const s = this.stats;
    s.near = s.lod0 = s.lod1 = s.far = s.culled = 0;
    for (const tier of this.tiers) tier.n = 0;
    const field = this.field;
    const fw = field ? field.maxX - field.minX : 0, fd = field ? field.maxZ - field.minZ : 0;
    const candidates: number[] = [], cand2: number[] = [];
    const [lod0, lod1, imp] = this.tiers as [Tier, Tier, Tier];

    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i]!;
      let px = m.x, pz = m.z;
      if (m.speed > 0) {
        const d = m.speed * this.time;
        px += Math.sin(m.heading) * d; pz += Math.cos(m.heading) * d;
        if (field) {
          px = field.minX + ((((px - field.minX) % fw) + fw) % fw);
          pz = field.minZ + ((((pz - field.minZ) % fd) + fd) % fd);
        }
      }
      const sc = this.unit * HEIGHT[m.n % HEIGHT.length]!;
      const dx = px - this.cam.x, dz = pz - this.cam.z, dy = sc * 0.9 - this.cam.y;
      const d2 = dx * dx + dz * dz + dy * dy;
      const slot = this.pooled.get(i);
      if (slot !== undefined) {
        if (d2 < keep2) { this.placePooled(slot, px, pz, m, sc, dt); s.near++; continue; }
        this.release(slot);
      }
      // Frustum: a sphere about the chest, generous enough for a swung arm.
      let out = false;
      const r = 1.3 * sc, cy = sc * 0.9;
      for (let k = 0; k < 6; k++) {
        const p = planes[k]!;
        if (p.normal.x * px + p.normal.y * cy + p.normal.z * pz + p.constant < -r) { out = true; break; }
      }
      if (out) { s.culled++; continue; }
      if (d2 < near2 && this.pool.length) { candidates.push(i); cand2.push(d2); }
      const tier = d2 < mid2 ? lod0 : d2 < far2 ? lod1 : imp;
      // Someone who will be given a pooled copy below is written to lod0 too;
      // the pool is filled after the loop, and unfilled candidates keep their
      // lod0 slot so nobody vanishes for a frame.
      this.write(tier, i, px, pz, m, sc);
    }
    // The nearest first: the pool goes to whoever is closest, up to its size.
    if (candidates.length) {
      const order = candidates.map((_, k) => k).sort((a, b) => cand2[a]! - cand2[b]!);
      for (const k of order) {
        const i = candidates[k]!;
        if (this.pooled.has(i)) continue;
        const slot = this.pool.findIndex((p) => p.member < 0);
        if (slot < 0) break;
        this.assign(slot, i);
        // Take it back out of lod0: swap the last lod0 instance into its place.
        this.unwrite(lod0, i);
        const m = this.members[i]!, sc = this.unit * HEIGHT[m.n % HEIGHT.length]!;
        this.placePooled(slot, this.currentX(m), this.currentZ(m), m, sc, 0);
        s.near++;
      }
    }
    lod0.mesh.count = lod0.n; lod1.mesh.count = lod1.n; imp.mesh.count = imp.n;
    s.lod0 = lod0.n; s.lod1 = lod1.n; s.far = imp.n;
    for (const tier of this.tiers) {
      tier.mesh.instanceMatrix.needsUpdate = true;
      tier.anim.needsUpdate = true; tier.tint.needsUpdate = true;
      tier.mesh.instanceMatrix.addUpdateRange(0, tier.n * 16);
      tier.anim.addUpdateRange(0, tier.n * 4);
      tier.tint.addUpdateRange(0, tier.n * 3);
    }
    s.updateMs = performance.now() - t0;
  }

  /** member → its lod0 slot this frame, and the reverse; only read for
   *  members written this frame, so neither needs clearing. */
  private slotOf: Int32Array;
  private memberAt: Int32Array;

  private write(tier: Tier, i: number, px: number, pz: number, m: Member, sc: number) {
    const k = tier.n++;
    const e = tier.mesh.instanceMatrix.array as Float32Array;
    const c = Math.cos(m.heading) * sc, sn = Math.sin(m.heading) * sc, o = k * 16;
    // rotation about y by heading, scale sc, translation — column-major
    e[o] = c; e[o + 1] = 0; e[o + 2] = -sn; e[o + 3] = 0;
    e[o + 4] = 0; e[o + 5] = sc; e[o + 6] = 0; e[o + 7] = 0;
    e[o + 8] = sn; e[o + 9] = 0; e[o + 10] = c; e[o + 11] = 0;
    e[o + 12] = px; e[o + 13] = 0; e[o + 14] = pz; e[o + 15] = 1;
    const a = tier.anim.array as Float32Array, ao = k * 4;
    a[ao] = m.clip; a[ao + 1] = m.rate; a[ao + 2] = m.offset; a[ao + 3] = sc;
    const shade = SHADE[m.n % SHADE.length]!;
    const t = tier.tint.array as Float32Array, to = k * 3;
    t[to] = ((shade >> 16) & 255) / 255; t[to + 1] = ((shade >> 8) & 255) / 255; t[to + 2] = (shade & 255) / 255;
    if (tier === this.tiers[0]) { this.slotOf[i] = k; this.memberAt[k] = i; }
  }

  /** Takes member `i` out of lod0 by moving the last instance into its slot. */
  private unwrite(tier: Tier, i: number) {
    const k = this.slotOf[i]!;
    if (k < 0 || this.memberAt[k] !== i) return;
    const last = --tier.n;
    if (k !== last) {
      const e = tier.mesh.instanceMatrix.array as Float32Array;
      e.copyWithin(k * 16, last * 16, last * 16 + 16);
      (tier.anim.array as Float32Array).copyWithin(k * 4, last * 4, last * 4 + 4);
      (tier.tint.array as Float32Array).copyWithin(k * 3, last * 3, last * 3 + 3);
      const moved = this.memberAt[last]!;
      this.memberAt[k] = moved; this.slotOf[moved] = k;
    }
    this.slotOf[i] = -1;
  }

  private currentX(m: Member) {
    if (m.speed === 0) return m.x;
    const f = this.field, x = m.x + Math.sin(m.heading) * m.speed * this.time;
    if (!f) return x;
    const w = f.maxX - f.minX; return f.minX + ((((x - f.minX) % w) + w) % w);
  }
  private currentZ(m: Member) {
    if (m.speed === 0) return m.z;
    const f = this.field, z = m.z + Math.cos(m.heading) * m.speed * this.time;
    if (!f) return z;
    const d = f.maxZ - f.minZ; return f.minZ + ((((z - f.minZ) % d) + d) % d);
  }

  private assign(slot: number, i: number) {
    const p = this.pool[slot]!, m = this.members[i]!;
    p.member = i; this.pooled.set(i, slot); p.obj.visible = true;
    const name = this.clipNames[m.clip]!;
    for (const [n, a] of Object.entries(p.actions)) { if (n !== name) a.stop(); }
    const a = p.actions[name];
    if (a) {
      // Its clock is the crowd's clock, so the swap does not jump a step.
      a.reset().play();
      a.timeScale = m.rate;
      a.time = (this.time * m.rate + m.offset) % this.durations[m.clip]!;
    }
    const shade = new THREE.Color(SHADE[m.n % SHADE.length]!);
    p.mats.forEach((mat, k) => mat.color.copy(p.base[k]!).multiply(shade));
  }

  private release(slot: number) {
    const p = this.pool[slot]!;
    this.pooled.delete(p.member); p.member = -1; p.obj.visible = false;
  }

  private placePooled(slot: number, px: number, pz: number, m: Member, sc: number, dt: number) {
    const p = this.pool[slot]!;
    p.obj.position.set(px, 0, pz);
    p.obj.rotation.y = m.heading;
    p.obj.scale.setScalar(sc / this.unit);   // the template is already at the stated height
    if (dt > 0) p.mixer.update(dt);
  }

  dispose() {
    for (const t of this.tiers) { t.mesh.geometry.dispose(); (t.mesh.material as THREE.Material).dispose(); }
  }
}

/** Renders the impostor sheet: lod0, lit plainly, from `angles` directions at
 *  each clip's phases, into one texture. Done once at load with the crowd's
 *  own lod0 mesh (one instance, identity matrix) so the sprite is exactly the
 *  figure the mid ring draws, and the hand-off at 150 m is between two
 *  pictures of the same thing. */
function renderSheet(renderer: THREE.WebGLRenderer, tier: Tier,
  uniforms: { uTime: { value: number } }, cells: { start: number; cols: number; duration: number }[], scale: number,
  lights?: THREE.Light[]) {
  const [cw, ch] = SHEET.cell, [fw, fh] = SHEET.frame;
  const rt = new THREE.WebGLRenderTarget(cw * SHEET.cols, ch * SHEET.angles, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  const scene = new THREE.Scene();
  if (lights?.length) {
    for (const l of lights) scene.add(l.clone());
  } else {
    scene.add(new THREE.HemisphereLight(0xdce8ff, 0x6a5a48, 1.6));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.position.set(2, 4, 3); scene.add(sun);
  }
  const mesh = tier.mesh;
  const parent = mesh.parent;
  scene.add(mesh);
  // one instance at the origin, at the stated height, facing +z
  const e = mesh.instanceMatrix.array as Float32Array;
  e.fill(0, 0, 16); e[0] = e[5] = e[10] = scale; e[15] = 1;
  const t = tier.tint.array as Float32Array; t[0] = t[1] = t[2] = 1;
  const a = tier.anim.array as Float32Array;
  mesh.count = 1;
  const cam = new THREE.OrthographicCamera(-fw / 2, fw / 2, fh, 0, 0.1, 20);
  const prevTarget = renderer.getRenderTarget(), prevClear = renderer.autoClear;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.autoClear = false;
  rt.scissorTest = true;
  cells.forEach((cell, clip) => {
    for (let col = 0; col < cell.cols; col++) {
      uniforms.uTime.value = (col + 0.5) / cell.cols * cell.duration;
      a[0] = clip; a[1] = 1; a[2] = 0; a[3] = scale;
      tier.anim.needsUpdate = true; tier.tint.needsUpdate = true; mesh.instanceMatrix.needsUpdate = true;
      for (let row = 0; row < SHEET.angles; row++) {
        const phi = row / SHEET.angles * Math.PI * 2;
        cam.position.set(Math.sin(phi) * 10, fh / 2, Math.cos(phi) * 10);
        cam.lookAt(0, fh / 2, 0);
        // the camera looks along the ground at half height; the frame spans
        // 0..fh vertically because `top`/`bottom` are set around that centre
        cam.top = fh / 2; cam.bottom = -fh / 2; cam.updateProjectionMatrix();
        // A target's viewport and scissor are applied by setRenderTarget and
        // nowhere else, so it is set again for every cell; set once outside
        // the loop, every cell painted the whole sheet, and the far crowd
        // was a field of grey squares.
        rt.viewport.set((cell.start + col) * cw, row * ch, cw, ch);
        rt.scissor.set((cell.start + col) * cw, row * ch, cw, ch);
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
      }
    }
  });
  renderer.autoClear = prevClear;
  renderer.setRenderTarget(prevTarget);
  rt.scissorTest = false;
  rt.viewport.set(0, 0, rt.width, rt.height);
  mesh.count = 0;
  scene.remove(mesh);
  if (parent) parent.add(mesh);
  uniforms.uTime.value = 0;
  return rt;
}
