import * as THREE from 'three';
import { bevelBox, batchStatic } from './craft.ts';
import { detailedSurface } from './materials.ts';
import { buildDesert } from './environment.ts';
import { loadFigure, place } from './figures.ts';
import { sand as sandTex } from './textures.ts';

// Noah's ark at the exact cubit specification of Genesis 6:14-16; 7:13; 8:6-13.
// Every figure and measurement follows the four verses honestly:
//   6:14  gopher wood; rooms ("nests"); pitched within and without with pitch
//   6:15  300 cubits long, 50 broad, 30 high
//   6:16  a light opening (tsohar) finished to 1 cubit; 1 door in the side;
//         lower, second and third storeys
//   6:21  food gathered and stored
//   8:6   window hatch opened in the covering
//   8:13  roof covering removed
//
// Shape, doorway size, stairwell geometry, framing ribs/knees, stalls and
// dry-land timbered plain are reasoned architectural choices documented here
// and in the Evidence dialog.

export type ArkAtmosphere = 'dawn' | 'storm';

export interface ArkCounts {
  lengthCubits: number;
  widthCubits: number;
  heightCubits: number;
  decks: number;
  doors: number;
  lightCubits: number;
  rooms: number;
  ribs: number;
  clean: number;
  unclean: number;
  birds: number;
  people: number;
  trees: number;
}

export const ABOARD = [
  { file: 'ox', kind: 'clean', count: 14, height: 1.45, zh: '洁净的畜类 · 七公七母', en: 'a clean kind — seven males, seven females', ref: 'Gen 7:2' },
  { file: 'camel', kind: 'unclean', count: 2, height: 2.05, zh: '不洁净的畜类 · 一公一母（利 11:4 指明骆驼不洁净）', en: 'a kind not clean — one male, one female (Lev 11:4 names the camel)', ref: 'Gen 7:2; Lev 11:4' },
  { file: 'dove', kind: 'bird', count: 14, height: 0.3, zh: '飞鸟 · 七公七母（创 8:8 的鸽子）', en: 'fowls — seven and seven (the dove of Gen 8:8)', ref: 'Gen 7:3; 8:8' },
  { file: 'raven', kind: 'raven', count: 1, height: 0.5, zh: '乌鸦（创 8:7 先放出的那一只）', en: 'the raven, sent out first (Gen 8:7)', ref: 'Gen 8:7' },
  { file: 'man', kind: 'man', count: 4, height: 1.72, zh: '挪亚与他的三个儿子', en: 'Noah and his three sons', ref: 'Gen 7:13' },
  { file: 'woman', kind: 'woman', count: 4, height: 1.63, zh: '挪亚的妻子与三个儿妇', en: 'Noah\'s wife and his three sons\' wives', ref: 'Gen 7:13' },
] as const;

export interface Ark {
  group: THREE.Group;
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  floorY: (x: number, z: number) => number;
  counts: ArkCounts;
  ready: Promise<boolean>;
  anchors: {
    outside: THREE.Vector3;
    door: THREE.Vector3;
    hold: THREE.Vector3;
    second: THREE.Vector3;
    third: THREE.Vector3;
  };
  update: (dt: number) => void;
  setAtmosphere: (mode: ArkAtmosphere) => void;
  atmosphere: ArkAtmosphere;
}

interface TexSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
}

const seedRand = (s: number) => {
  let x = (s | 0) || 1;
  return () => {
    x = (x * 1664525 + 1013904223) | 0;
    return ((x >>> 0) % 100000) / 100000;
  };
};

function makeCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, srgb = true): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function heightToNormal(heightCanvas: HTMLCanvasElement, strength = 2.6): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  const dst = ctx.createImageData(w, h);
  const at = (x: number, y: number) => src[(((y + h) % h) * w + ((x + w) % w)) * 4]! / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(-dx, -dy, 1);
      const i = (y * w + x) * 4;
      dst.data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      dst.data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      dst.data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      dst.data[i + 3] = 255;
    }
  }
  ctx.putImageData(dst, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Shipwright planking with strake seams, grain, knots, oakum caulking and trunnels. */
function makePlankSet(
  baseRgb: [number, number, number],
  darkRgb: [number, number, number],
  pitchCaulk: boolean,
  repeat: [number, number],
  seed: number,
  size = 256,
): TexSet {
  const S = size;
  const rng = seedRand(seed);
  const rows = 8;
  const rowH = S / rows;

  const hCanvas = document.createElement('canvas');
  hCanvas.width = hCanvas.height = S;
  const hCtx = hCanvas.getContext('2d')!;
  hCtx.fillStyle = '#9a9a9a';
  hCtx.fillRect(0, 0, S, S);

  const rCanvas = document.createElement('canvas');
  rCanvas.width = rCanvas.height = S;
  const rCtx = rCanvas.getContext('2d')!;
  rCtx.fillStyle = pitchCaulk ? '#b5b5b5' : '#dcdcdc';
  rCtx.fillRect(0, 0, S, S);

  const map = makeCanvas(S, (ctx) => {
    for (let r = 0; r < rows; r++) {
      const y0 = r * rowH;
      const tone = 0.86 + rng() * 0.28;
      const cr = Math.min(255, Math.round(baseRgb[0] * tone));
      const cg = Math.min(255, Math.round(baseRgb[1] * tone));
      const cb = Math.min(255, Math.round(baseRgb[2] * tone));
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(0, y0, S, rowH);

      for (let g = 0; g < 22; g++) {
        const gy = y0 + 2 + rng() * (rowH - 4);
        const alpha = 0.08 + rng() * 0.16;
        const dr = Math.round(darkRgb[0] * (0.85 + rng() * 0.25));
        const dg = Math.round(darkRgb[1] * (0.85 + rng() * 0.25));
        const db = Math.round(darkRgb[2] * (0.85 + rng() * 0.25));
        ctx.strokeStyle = `rgba(${dr},${dg},${db},${alpha.toFixed(2)})`;
        ctx.lineWidth = 0.8 + rng() * 1.4;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        const wave = (rng() - 0.5) * 4;
        ctx.bezierCurveTo(S * 0.33, gy + wave, S * 0.66, gy - wave, S, gy);
        ctx.stroke();

        hCtx.strokeStyle = `rgba(115,115,115,${(alpha * 0.9).toFixed(2)})`;
        hCtx.lineWidth = 1;
        hCtx.beginPath();
        hCtx.moveTo(0, gy);
        hCtx.bezierCurveTo(S * 0.33, gy + wave, S * 0.66, gy - wave, S, gy);
        hCtx.stroke();
      }

      const bx = Math.round(((r * 97 + rng() * 60) % (S - 40)) + 20);
      ctx.fillStyle = pitchCaulk ? '#181412' : '#2e2217';
      ctx.fillRect(bx - 1, y0, 2, rowH);
      hCtx.fillStyle = '#2a2a2a';
      hCtx.fillRect(bx - 1, y0, 2, rowH);

      for (const tx of [bx - 6, bx + 6, S * 0.25, S * 0.75]) {
        const px = ((tx % S) + S) % S;
        for (const ty of [y0 + rowH * 0.28, y0 + rowH * 0.72]) {
          ctx.fillStyle = '#251a11';
          ctx.beginPath();
          ctx.arc(px, ty, 1.6, 0, Math.PI * 2);
          ctx.fill();
          hCtx.fillStyle = '#d4d4d4';
          hCtx.beginPath();
          hCtx.arc(px, ty, 1.6, 0, Math.PI * 2);
          hCtx.fill();
        }
      }

      ctx.fillStyle = pitchCaulk ? 'rgba(18,15,14,0.88)' : 'rgba(38,27,18,0.68)';
      ctx.fillRect(0, y0, S, 2);
      hCtx.fillStyle = '#181818';
      hCtx.fillRect(0, y0, S, 2.5);
      rCtx.fillStyle = pitchCaulk ? '#606060' : '#a8a8a8';
      rCtx.fillRect(0, y0, S, 2);
    }

    if (pitchCaulk) {
      for (let i = 0; i < 32; i++) {
        const x = rng() * S, y = rng() * S, w = 10 + rng() * 34, h = 4 + rng() * 8;
        ctx.fillStyle = `rgba(14,12,11,${(0.08 + rng() * 0.16).toFixed(2)})`;
        ctx.fillRect(x, y, w, h);
        rCtx.fillStyle = `rgb(${75 + Math.round(rng() * 55)},${75 + Math.round(rng() * 55)},${75 + Math.round(rng() * 55)})`;
        rCtx.fillRect(x, y, w, h);
      }
    }
  });

  const normalMap = heightToNormal(hCanvas, 2.5);
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.needsUpdate = true;

  for (const t of [map, normalMap, roughnessMap]) {
    t.repeat.set(repeat[0], repeat[1]);
  }
  return { map, normalMap, roughnessMap };
}

function makeStrawSet(): TexSet {
  const S = 256;
  const rng = seedRand(91);
  const hCanvas = document.createElement('canvas');
  hCanvas.width = hCanvas.height = S;
  const hCtx = hCanvas.getContext('2d')!;
  hCtx.fillStyle = '#707070';
  hCtx.fillRect(0, 0, S, S);

  const map = makeCanvas(S, (ctx) => {
    ctx.fillStyle = '#b99952';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 550; i++) {
      const x = rng() * S, y = rng() * S, a = rng() * Math.PI, len = 10 + rng() * 22;
      const dx = Math.cos(a) * len, dy = Math.sin(a) * len;
      const lum = 0.78 + rng() * 0.4;
      ctx.strokeStyle = `rgb(${Math.min(255, Math.round(198 * lum))},${Math.min(255, Math.round(166 * lum))},${Math.min(255, Math.round(86 * lum))})`;
      ctx.lineWidth = 1.2 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x - dx * 0.5, y - dy * 0.5);
      ctx.lineTo(x + dx * 0.5, y + dy * 0.5);
      ctx.stroke();

      const hVal = Math.round(115 + rng() * 120);
      hCtx.strokeStyle = `rgb(${hVal},${hVal},${hVal})`;
      hCtx.lineWidth = 1.5;
      hCtx.beginPath();
      hCtx.moveTo(x - dx * 0.5, y - dy * 0.5);
      hCtx.lineTo(x + dx * 0.5, y + dy * 0.5);
      hCtx.stroke();
    }
  });
  const normalMap = heightToNormal(hCanvas, 2.2);
  map.repeat.set(4, 3);
  normalMap.repeat.set(4, 3);
  return { map, normalMap };
}

function makeSunbeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255, 232, 178, 0.0)');
  grad.addColorStop(0.14, 'rgba(255, 232, 178, 0.32)');
  grad.addColorStop(0.65, 'rgba(255, 218, 152, 0.14)');
  grad.addColorStop(1.0, 'rgba(255, 210, 140, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  // Soft horizontal feathering via destination-in mask
  ctx.globalCompositeOperation = 'destination-in';
  const side = ctx.createLinearGradient(0, 0, 128, 0);
  side.addColorStop(0.0, 'rgba(0,0,0,0)');
  side.addColorStop(0.28, 'rgba(0,0,0,1)');
  side.addColorStop(0.72, 'rgba(0,0,0,1)');
  side.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeGlowSprite(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0.0, 'rgba(255, 238, 190, 0.95)');
  g.addColorStop(0.32, 'rgba(255, 178, 86, 0.5)');
  g.addColorStop(1.0, 'rgba(255, 130, 40, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Graceful procedural animal/human fallbacks if any external GLB is missing or offline. */
function buildProceduralFigure(file: string, height: number): THREE.Group {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: file === 'ox' ? 0x6f4b32
      : file === 'camel' ? 0xb79667
      : file === 'dove' ? 0xf2eee8
      : file === 'raven' ? 0x1d1f24
      : file === 'man' ? 0x876747
      : 0x6f5544,
    roughness: 0.86,
  });
  const limbMat = new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 0.9 });
  const addPart = (geo: THREE.BufferGeometry, x: number, y: number, z: number, mat = bodyMat, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.dynamic = true;
    root.add(m);
  };

  if (file === 'ox' || file === 'camel') {
    const legH = height * 0.48;
    const torsoY = legH + height * 0.22;
    const len = height * 1.35;
    addPart(new THREE.BoxGeometry(height * 0.44, height * 0.46, len), 0, torsoY, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addPart(new THREE.CylinderGeometry(height * 0.06, height * 0.05, legH, 8),
          sx * height * 0.14, legH * 0.5, sz * len * 0.36, limbMat);
      }
    }
    if (file === 'camel') {
      addPart(new THREE.SphereGeometry(height * 0.2, 10, 8), 0, torsoY + height * 0.22, 0);
      addPart(new THREE.CylinderGeometry(height * 0.09, height * 0.13, height * 0.45, 8),
        0, torsoY + height * 0.2, len * 0.52, bodyMat, 0.55);
      addPart(new THREE.BoxGeometry(height * 0.16, height * 0.16, height * 0.28),
        0, torsoY + height * 0.42, len * 0.68);
    } else {
      addPart(new THREE.BoxGeometry(height * 0.26, height * 0.26, height * 0.32),
        0, torsoY + height * 0.08, len * 0.56);
      for (const sx of [-1, 1]) {
        addPart(new THREE.ConeGeometry(height * 0.04, height * 0.24, 6),
          sx * height * 0.18, torsoY + height * 0.24, len * 0.58, limbMat, 0, -sx * 0.8);
      }
    }
  } else if (file === 'dove' || file === 'raven') {
    addPart(new THREE.SphereGeometry(height * 0.34, 10, 8), 0, height * 0.48, 0);
    addPart(new THREE.SphereGeometry(height * 0.18, 8, 6), 0, height * 0.78, height * 0.24);
    addPart(new THREE.ConeGeometry(height * 0.06, height * 0.2, 6), 0, height * 0.76, height * 0.42, limbMat, Math.PI / 2);
  } else {
    // Modest tunic/robe figure with short hair for male (1 Cor 11:14) or head-scarf for female
    const robeMat = new THREE.MeshStandardMaterial({
      color: file === 'man' ? 0x7d6346 : 0x675468,
      roughness: 0.88,
    });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc2936e, roughness: 0.78 });
    const hairMat = new THREE.MeshStandardMaterial({ color: file === 'man' ? 0x2b2018 : 0x5c4637, roughness: 0.9 });
    addPart(new THREE.CylinderGeometry(height * 0.11, height * 0.18, height * 0.74, 10), 0, height * 0.37, 0, robeMat);
    addPart(new THREE.SphereGeometry(height * 0.095, 10, 8), 0, height * 0.88, 0, skinMat);
    addPart(new THREE.SphereGeometry(height * 0.098, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      0, height * 0.9, -height * 0.01, hairMat, -0.25);
    if (file === 'woman') {
      addPart(new THREE.CylinderGeometry(height * 0.105, height * 0.135, height * 0.18, 10),
        0, height * 0.84, -height * 0.02, robeMat);
    }
  }
  root.userData.dynamic = true;
  return root;
}

/** Builds a smooth double-arch optical rainbow band (aniconic natural sky phenomenon). */
function buildRainbowArc(radius: number): THREE.Mesh {
  const segs = 96;
  const bandW = radius * 0.065;
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const stops = [
    new THREE.Color(0xd96854),
    new THREE.Color(0xe6a54b),
    new THREE.Color(0xe8db6b),
    new THREE.Color(0x6ec27e),
    new THREE.Color(0x5da4dc),
    new THREE.Color(0x7c78d4),
  ];
  const bands = stops.length;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = Math.PI * (0.04 + t * 0.92);
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let b = 0; b < bands; b++) {
      const r = radius + (b / (bands - 1) - 0.5) * bandW;
      pos.push(ca * r, sa * r * 0.72, 0);
      const c = stops[b]!;
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let b = 0; b < bands - 1; b++) {
      const a0 = i * bands + b;
      const b0 = a0 + 1;
      const a1 = (i + 1) * bands + b;
      const b1 = a1 + 1;
      idx.push(a0, a1, b0, b0, a1, b1);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.dynamic = true;
  mesh.userData.noCast = true;
  return mesh;
}

export function buildArk(cubit: number): Ark {
  const g = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const platforms: THREE.Box3[] = [];
  const C = (n: number) => n * cubit;

  const counts: ArkCounts = {
    lengthCubits: 300,
    widthCubits: 50,
    heightCubits: 30,
    decks: 0,
    doors: 0,
    lightCubits: 1,
    rooms: 0,
    ribs: 0,
    clean: 0,
    unclean: 0,
    birds: 0,
    people: 0,
    trees: 0,
  };

  const addCollider = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, false);
    colliders.push(new THREE.Box3().setFromObject(o));
  };
  const addTread = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    platforms.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));

  // ── Procedural PBR texture packs ─────────────────────────────────────────
  const pitchSet = makePlankSet([44, 37, 33], [16, 13, 12], true, [14, 3], 101, 512);
  const interiorSet = makePlankSet([82, 58, 38], [42, 27, 16], true, [12, 3], 202, 256);
  const deckSet = makePlankSet([126, 94, 58], [76, 52, 28], false, [18, 6], 303, 512);
  const timberSet = makePlankSet([148, 112, 68], [94, 66, 38], false, [4, 2], 404, 256);
  const beamSet = makePlankSet([98, 72, 42], [56, 38, 22], false, [3, 1], 505, 256);
  const strawSet = makeStrawSet();
  const sandSurface = sandTex();
  sandSurface.map.colorSpace = THREE.SRGBColorSpace;
  if (sandSurface.normalMap) sandSurface.normalMap.colorSpace = THREE.NoColorSpace;

  const pitchMat = detailedSurface(new THREE.MeshStandardMaterial({
    name: 'Pitched gopher hull',
    color: 0x625650,
    roughness: 0.62,
    metalness: 0.06,
    map: pitchSet.map,
    normalMap: pitchSet.normalMap,
    roughnessMap: pitchSet.roughnessMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
  }), 'desert-rock', 10, 0.004);

  const interiorWallMat = new THREE.MeshStandardMaterial({
    name: 'Interior pitched timber',
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.03,
    map: interiorSet.map,
    normalMap: interiorSet.normalMap,
    roughnessMap: interiorSet.roughnessMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
  });

  const deckMat = new THREE.MeshStandardMaterial({
    name: 'Deck planking',
    color: 0xffffff,
    roughness: 0.86,
    map: deckSet.map,
    normalMap: deckSet.normalMap,
    roughnessMap: deckSet.roughnessMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
  });

  const timberMat = new THREE.MeshStandardMaterial({
    name: 'Gopher timber',
    color: 0xffffff,
    roughness: 0.82,
    map: timberSet.map,
    normalMap: timberSet.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
  });

  const beamMat = new THREE.MeshStandardMaterial({
    name: 'Structural timber',
    color: 0xffffff,
    roughness: 0.88,
    map: beamSet.map,
    normalMap: beamSet.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
  });

  const ironMat = new THREE.MeshStandardMaterial({
    name: 'Forged bronze',
    color: 0x3f3224,
    roughness: 0.46,
    metalness: 0.78,
  });

  const strawMat = new THREE.MeshStandardMaterial({
    name: 'Straw bedding',
    color: 0xffffff,
    roughness: 0.95,
    map: strawSet.map,
    normalMap: strawSet.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
  });

  const jarMat = new THREE.MeshStandardMaterial({
    name: 'Earthenware jar',
    color: 0xb76f4b,
    roughness: 0.82,
  });

  const groundMat = detailedSurface(new THREE.MeshStandardMaterial({
    name: 'Wooded plain',
    color: 0xffffff,
    roughness: 0.96,
    vertexColors: true,
    map: sandSurface.map,
    normalMap: sandSurface.normalMap,
  }), 'desert-ground', 260, 0.02);

  const barkMat = new THREE.MeshStandardMaterial({
    name: 'Tree bark',
    color: 0x5c462d,
    roughness: 0.95,
    map: beamSet.map,
    normalMap: beamSet.normalMap,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    name: 'Foliage',
    color: 0xffffff,
    roughness: 0.9,
    flatShading: true,
  });

  // ── The Genesis 6:15 dimensions ──────────────────────────────────────────
  const L = C(300), W = C(50), H = C(30);
  const halfL = L / 2, halfW = W / 2;
  const hull = C(1);
  const innerSkin = C(0.14);
  const DECK_H = C(10);
  const deckT = C(0.5);
  const eaves = C(28);
  const LIGHT_BOTTOM = C(26.6);
  const LIGHT_TOP = LIGHT_BOTTOM + C(1);
  const LIFT = C(2.6);

  // ── Ground heightfield (shared identically by terrain mesh, Walker and tour audit) ──
  const floorY = (x: number, z: number): number => {
    const ax = Math.max(0, Math.abs(x) - C(168));
    const az = Math.max(0, Math.abs(z) - C(74));
    const d = Math.hypot(ax, az);
    const blend = THREE.MathUtils.smoothstep(d, 0, C(95));
    const swell = Math.sin(x * 0.016) * C(0.55) + Math.cos(z * 0.019) * C(0.6);
    const ridge = Math.pow(THREE.MathUtils.smoothstep(Math.hypot(x, z * 1.15), C(240), C(640)), 1.7) * C(38);
    return -LIFT + blend * swell + ridge;
  };

  {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(C(1400), C(1400), 108, 108), groundMat);
    const fp = floor.geometry.attributes.position as THREE.BufferAttribute;
    const fc = new Float32Array(fp.count * 3);
    const green = new THREE.Color(0x95aa62);
    const meadow = new THREE.Color(0xb8b279);
    const dry = new THREE.Color(0xdfd1b4);
    const mix = new THREE.Color();
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i);
      const planeY = fp.getY(i);
      const z = -planeY; // after rotation.x = -PI/2
      const fy = floorY(x, z);
      fp.setZ(i, fy);
      const d = Math.hypot(x, z);
      mix.copy(green).lerp(meadow, THREE.MathUtils.smoothstep(d, C(60), C(210)));
      mix.lerp(dry, THREE.MathUtils.smoothstep(d, C(190), C(430)));
      mix.toArray(fc, i * 3);
    }
    floor.geometry.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    floor.geometry.computeVertexNormals();
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.noCast = true;
    floor.userData.dynamic = true;
    g.add(floor);

    const hills = buildDesert(() => true, 320);
    hills.position.y = -LIFT - C(1.2);
    g.add(hills);
  }

  // Ground-anchored timber forest outside the shipyard apron
  {
    const trunkGeo = new THREE.CylinderGeometry(C(0.26), C(0.45), C(7.4), 7);
    trunkGeo.translate(0, C(3.7), 0);
    const crownGeo = new THREE.IcosahedronGeometry(C(3.6), 1);
    crownGeo.translate(0, C(9.4), 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, 460);
    const crowns = new THREE.InstancedMesh(crownGeo, leafMat, 460);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let n = 0;
    for (let i = 0; n < 460 && i < 6500; i++) {
      const h1 = (Math.sin(i * 127.1) * 43758.5453) % 1;
      const h2 = (Math.sin(i * 311.7) * 24634.6345) % 1;
      const a = (h1 < 0 ? h1 + 1 : h1) * Math.PI * 2;
      const r = C(74) + ((h2 < 0 ? h2 + 1 : h2) ** 0.7) * C(440);
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.82;
      if (Math.abs(x) < halfL + C(24) && Math.abs(z) < halfW + C(74)) continue;
      const scale = 0.72 + (Math.sin(i * 7.77) * 0.5 + 0.5) * 0.95;
      dummy.position.set(x, floorY(x, z), z);
      dummy.rotation.y = i * 1.13;
      dummy.scale.set(scale, scale * (0.85 + 0.32 * Math.sin(i * 3.1)), scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(n, dummy.matrix);
      crowns.setMatrixAt(n, dummy.matrix);
      tint.setHSL(0.26 + 0.05 * Math.sin(i * 1.7), 0.36, 0.25 + 0.07 * Math.sin(i * 5));
      crowns.setColorAt(n, tint);
      n++;
    }
    trunks.count = n;
    crowns.count = n;
    trunks.userData.noCast = true;
    crowns.userData.noCast = true;
    g.add(trunks);
    g.add(crowns);
    counts.trees = n;
  }

  // ── Outer Hull, Interior Pitch Wainscoting, Wales & Side Door Opening ─────
  const doorW = C(6.4), doorH = C(8.5), doorZ = -(halfW - hull / 2);
  const DOOR_SIDE = -1;

  const side = (sz: number) => {
    const z = sz * (halfW - hull / 2);
    const innerZ = sz * (halfW - hull - innerSkin * 0.5);

    const wall = (x0: number, x1: number, y0: number, y1: number) => {
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
      const piece = bevelBox(x1 - x0, y1 - y0, hull, pitchMat, 0.02);
      piece.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
      g.add(piece);
      addCollider(piece);

      // Pitched warm-timber interior lining facing inward ("pitch within and without")
      const inner = bevelBox(x1 - x0, y1 - y0, innerSkin, interiorWallMat, 0.005);
      inner.position.set((x0 + x1) / 2, (y0 + y1) / 2, innerZ);
      inner.userData.noCast = true;
      g.add(inner);
    };

    if (sz === DOOR_SIDE) {
      wall(-halfL, -doorW / 2, 0, LIGHT_BOTTOM);
      wall(doorW / 2, halfL, 0, LIGHT_BOTTOM);
      wall(-doorW / 2, doorW / 2, doorH, LIGHT_BOTTOM);
    } else {
      wall(-halfL, halfL, 0, LIGHT_BOTTOM);
    }

    // Continuous 1-cubit light opening (tsohar, Gen 6:16) with timber sill & mullions
    const sillLedge = bevelBox(L, C(0.28), hull * 1.18, beamMat, 0.008);
    sillLedge.position.set(0, LIGHT_BOTTOM - C(0.14), z);
    g.add(sillLedge);

    const postGeo = new THREE.BoxGeometry(C(0.55), C(1), hull * 1.06);
    const postCount = Math.floor((L - C(6)) / C(6)) + 1;
    const posts = new THREE.InstancedMesh(postGeo, beamMat, postCount);
    const dummy = new THREE.Object3D();
    let pn = 0;
    for (let x = -halfL + C(3); x < halfL && pn < postCount; x += C(6)) {
      dummy.position.set(x, LIGHT_BOTTOM + C(0.5), z);
      dummy.updateMatrix();
      posts.setMatrixAt(pn++, dummy.matrix);
    }
    posts.count = pn;
    g.add(posts);

    const upper = bevelBox(L, eaves - LIGHT_TOP, hull, pitchMat, 0.02);
    upper.position.set(0, (eaves + LIGHT_TOP) / 2, z);
    g.add(upper);
    addCollider(upper);

    // Exterior horizontal heavy wales / rubbing strakes at deck lines & eaves
    for (const wy of [C(0.5), DECK_H, DECK_H * 2, LIGHT_BOTTOM - C(0.4), eaves - C(0.5)]) {
      const wale = (ax: number, bx: number) => {
        if (bx - ax < 0.05) return;
        const w = bevelBox(bx - ax, C(0.65), C(0.32), beamMat, 0.01);
        w.position.set((ax + bx) / 2, wy, sz * (halfW + C(0.14)));
        g.add(w);
      };
      if (sz === DOOR_SIDE && wy < doorH) {
        wale(-halfL, -doorW / 2 - C(0.8));
        wale(doorW / 2 + C(0.8), halfL);
      } else {
        wale(-halfL, halfL);
      }
    }
  };
  side(1);
  side(-1);

  for (const sx of [-1, 1]) {
    const end = bevelBox(hull, eaves, W, pitchMat, 0.02);
    end.position.set(sx * (halfL - hull / 2), eaves / 2, 0);
    g.add(end);
    addCollider(end);

    const endInner = bevelBox(innerSkin, eaves, W - hull * 2, interiorWallMat, 0.005);
    endInner.position.set(sx * (halfL - hull - innerSkin * 0.5), eaves / 2, 0);
    endInner.userData.noCast = true;
    g.add(endInner);

    // Horizontal wales and vertical end ribs wrapping both ends cleanly
    for (const wy of [C(0.5), DECK_H, DECK_H * 2, LIGHT_BOTTOM - C(0.4), eaves - C(0.5)]) {
      const ew = bevelBox(C(0.32), C(0.65), W + C(0.3), beamMat, 0.01);
      ew.position.set(sx * (halfL + C(0.14)), wy, 0);
      g.add(ew);
    }
    for (let z = -halfW + C(5); z <= halfW - C(5); z += C(5)) {
      const erib = bevelBox(C(0.62), eaves, C(1.1), beamMat, 0.01);
      erib.position.set(sx * (halfL + C(0.26)), eaves / 2, z);
      g.add(erib);
    }
  }

  // Opaque pitched bottom bilge plate so interior fill lights never bleed under the hull
  {
    const underbelly = bevelBox(L, C(0.42), W, pitchMat, 0.01);
    underbelly.position.set(0, -C(0.21), 0);
    g.add(underbelly);
  }

  // Exterior hull ribs every 5 cubits (instanced for high geometric fidelity at low draw cost)
  {
    const ribGeo = new THREE.BoxGeometry(C(1.15), eaves, C(0.65));
    const ribMat = beamMat;
    const maxRibs = 130;
    const ribs = new THREE.InstancedMesh(ribGeo, ribMat, maxRibs);
    const dummy = new THREE.Object3D();
    let rn = 0;
    for (let x = -halfL + C(5); x < halfL; x += C(5)) {
      for (const sz of [-1, 1]) {
        if (sz === DOOR_SIDE && Math.abs(x) < doorW / 2 + C(0.9)) continue;
        dummy.position.set(x, eaves / 2, sz * (halfW + C(0.28)));
        dummy.updateMatrix();
        ribs.setMatrixAt(rn++, dummy.matrix);
      }
    }
    ribs.count = rn;
    counts.ribs = rn;
    g.add(ribs);
  }

  // Keel blocks, longitudinal keel sleepers, wedges and raking shores holding the hull on dry land
  {
    for (const sz of [-1, 1]) {
      const bilgeBeam = bevelBox(L - C(6), C(0.55), C(0.9), beamMat, 0.01);
      bilgeBeam.position.set(0, -C(0.28), sz * (halfW - C(1.2)));
      g.add(bilgeBeam);
    }
    for (let x = -halfL + C(6); x < halfL - C(4); x += C(12)) {
      const block = bevelBox(C(4), LIFT, C(9.5), beamMat, 0.02);
      block.position.set(x, -LIFT / 2, 0);
      g.add(block);
      addCollider(block);

      for (const sz of [-1, 1]) {
        const shore = bevelBox(C(1.05), LIFT * 2.15, C(1.05), beamMat, 0.02);
        shore.position.set(x, -LIFT / 2 + C(0.45), sz * (halfW - C(1.1)));
        shore.rotation.x = sz * 0.43;
        g.add(shore);

        const pad = bevelBox(C(2.3), C(0.5), C(2.3), beamMat, 0.02);
        pad.position.set(x, -LIFT + C(0.25), sz * (halfW + C(1.7)));
        g.add(pad);
      }
    }
  }

  // ── The Covering (Gen 8:13) & Open Window Hatch (Gen 8:6) ─────────────────
  {
    const roofRun = halfW + C(0.9);
    const OVER = C(1.4);
    const slope = Math.atan2(H - eaves, roofRun);
    const len = Math.hypot(roofRun, H - eaves) + OVER;
    const mid = (roofRun - OVER) / 2;

    // North roof slope: solid pitched cedar/cypress covering
    const northPanel = bevelBox(L + C(1.8), C(0.5), len, pitchMat, 0.01);
    northPanel.position.set(0, (eaves + H) / 2 - (Math.sin(slope) * OVER) / 2, mid);
    northPanel.rotation.x = -slope;
    g.add(northPanel);
    addCollider(northPanel);

    // South roof slope split cleanly around the 8:6 window hatch at x = 40C, z = -12C..-7C
    const hx0 = C(38), hx1 = C(42), hz0 = -C(11.5), hz1 = -C(7.0);
    const sRoofSeg = (ax: number, bx: number, az: number, bz: number) => {
      // az, bz measured inward from eaves toward ridge (extending past 0 to overlap ridge)
      const segZ0 = Math.max(-halfW - C(0.9), az);
      const segZ1 = Math.min(OVER, bz);
      if (bx - ax < 0.05 || segZ1 - segZ0 < 0.05) return;
      const zMid = (segZ0 + segZ1) / 2;
      const runFromRidge = -zMid;
      const segY = H - runFromRidge * Math.tan(slope);
      const spanZ = (segZ1 - segZ0) / Math.cos(slope);
      const seg = bevelBox(bx - ax, C(0.5), spanZ, pitchMat, 0.01);
      seg.position.set((ax + bx) / 2, segY, zMid);
      seg.rotation.x = slope;
      g.add(seg);
      addCollider(seg);
    };
    sRoofSeg(-halfL - C(0.9), hx0, -halfW - C(0.9), OVER);
    sRoofSeg(hx1, halfL + C(0.9), -halfW - C(0.9), OVER);
    sRoofSeg(hx0, hx1, -halfW - C(0.9), hz0);
    sRoofSeg(hx0, hx1, hz1, OVER);

    const ridge = bevelBox(L + C(2.2), C(1.1), C(2.1), beamMat, 0.02);
    ridge.position.y = H + C(0.02);
    g.add(ridge);

    // Framed 8:6 window hatch coaming + propped open plank shutter beside opening
    const hy = H - 9.25 * cubit * Math.tan(slope);
    for (const sz of [-1, 1]) {
      const curb = bevelBox(C(4.8), C(0.5), C(0.45), beamMat, 0.01);
      curb.position.set(C(40), H + zSlopeOffset(sz > 0 ? hz1 : hz0, slope) + C(0.28), sz > 0 ? hz1 : hz0);
      curb.rotation.x = slope;
      g.add(curb);
    }
    for (const sx of [hx0, hx1]) {
      const curb = bevelBox(C(0.45), C(0.5), (hz1 - hz0) / Math.cos(slope), beamMat, 0.01);
      curb.position.set(sx, hy + C(0.28), (hz0 + hz1) / 2);
      curb.rotation.x = slope;
      g.add(curb);
    }
    const lid = bevelBox(C(4.4), C(0.32), (hz1 - hz0) / Math.cos(slope) + C(0.3), timberMat, 0.01);
    lid.position.set(C(44.1), hy + C(0.75), (hz0 + hz1) / 2 + C(0.2));
    lid.rotation.set(slope + 0.05, 0.06, -0.18);
    g.add(lid);
    const hinge = bevelBox(C(0.45), C(0.3), C(4.2), ironMat, 0.01);
    hinge.position.set(hx1, hy + C(0.45), (hz0 + hz1) / 2);
    hinge.rotation.x = slope;
    g.add(hinge);
  }

  function zSlopeOffset(zPos: number, roofSlope: number) {
    return -(-zPos) * Math.tan(roofSlope);
  }

  // ── Exposed King-Post Roof Trusses & Third-Deck Longitudinal Plates ───────
  {
    const trussW = W - hull * 2;
    for (const sz of [-1, 1]) {
      const topPlate = bevelBox(L - hull * 2, C(0.75), C(0.85), beamMat, 0.01);
      topPlate.position.set(0, LIGHT_TOP - C(0.35), sz * C(8.5));
      g.add(topPlate);
    }
    for (let x = -halfL + C(10); x <= halfL - C(10); x += C(10)) {
      const tie = bevelBox(C(0.65), C(0.72), trussW, beamMat, 0.01);
      tie.position.set(x, LIGHT_TOP + C(0.05), 0);
      g.add(tie);

      const king = bevelBox(C(0.6), C(2.4), C(0.65), beamMat, 0.01);
      king.position.set(x, LIGHT_TOP + C(1.25), 0);
      g.add(king);

      for (const sz of [-1, 1]) {
        const brace = bevelBox(C(0.45), C(0.48), C(9.5), beamMat, 0.01);
        brace.position.set(x, LIGHT_TOP + C(1.0), sz * C(4.6));
        brace.rotation.x = -sz * 0.21;
        g.add(brace);
      }
    }
  }

  // ── Three Storeys, Floor Joists & Stairwell Openings (Gen 6:16) ───────────
  const deckY = [C(0), DECK_H, DECK_H * 2];
  const RAMP_HALF = C(3.4);

  // Stairwell spans tightly matched to ramp endpoints:
  //   Deck 1 -> Deck 2 (i=1, fore): ramp goes x=142.2 -> 117.2, hole covers [117.2, 146]
  //   Deck 2 -> Deck 3 (i=2, aft):  ramp goes x=-142.2 -> -117.2, hole covers [-146, -117.2]
  const rampSpan = (i: number): [number, number] | null => {
    if (i === 0) return null;
    if (i === 1) return [C(117.2), C(146)];
    return [-C(146), -C(117.2)];
  };

  // Walkable slatted light-grate positions on Decks 2 and 3 letting tsohar sunbeams reach Deck 1
  const GRATE_XS = [-84, -38, 38, 84];

  for (const [i, y] of deckY.entries()) {
    const span = rampSpan(i);
    const x0 = -halfL + hull, x1 = halfL - hull;
    const z0 = -halfW + hull, z1 = halfW - hull;

    const deckPiece = (ax: number, bx: number, az: number, bz: number) => {
      if (bx - ax < 0.01 || bz - az < 0.01) return;
      const piece = bevelBox(bx - ax, deckT, bz - az, deckMat, 0.006);
      piece.position.set((ax + bx) / 2, y + deckT / 2, (az + bz) / 2);
      g.add(piece);
      addTread(ax, y, az, bx, y + deckT, bz);
    };

    if (!span) {
      deckPiece(x0, x1, z0, z1);
    } else {
      const [hx0, hx1] = span;
      // Split center strip at light-grates so sunbeams slant down visually, while adding
      // continuous walkable treads + wooden cross-slats across every grate!
      const buildCenterDeck = (cx0: number, cx1: number) => {
        const grates = GRATE_XS.map((gx) => [C(gx - 3.2), C(gx + 3.2)] as [number, number])
          .filter(([ga, gb]) => ga > cx0 + C(2) && gb < cx1 - C(2))
          .sort((a, b) => a[0] - b[0]);

        let cursor = cx0;
        for (const [ga, gb] of grates) {
          deckPiece(cursor, ga, -C(3.4), C(3.4));
          // Grate side curbs + slatted cross-bars (no collider, full walkable platform tread)
          for (let sx = ga + C(0.4); sx < gb; sx += C(0.85)) {
            const slat = bevelBox(C(0.26), deckT * 0.72, C(6.4), timberMat, 0.004);
            slat.position.set(sx, y + deckT * 0.56, 0);
            g.add(slat);
          }
          addTread(ga, y, -C(3.4), gb, y + deckT, C(3.4));
          cursor = gb;
        }
        deckPiece(cursor, cx1, -C(3.4), C(3.4));
      };

      deckPiece(x0, hx0, z0, -C(3.4));
      deckPiece(x0, hx0, C(3.4), z1);
      buildCenterDeck(x0, hx0);

      deckPiece(hx1, x1, z0, -C(3.4));
      deckPiece(hx1, x1, C(3.4), z1);
      buildCenterDeck(hx1, x1);

      deckPiece(hx0, hx1, z0, -RAMP_HALF);
      deckPiece(hx0, hx1, RAMP_HALF, z1);
    }

    if (i > 0) {
      // Heavy transverse floor joists every 4 cubits — omit across stairwell & center of grates
      for (let x = -halfL + C(4); x < halfL; x += C(4)) {
        if (span && x > span[0] - C(1.8) && x < span[1] + C(1.8)) continue;
        const joist = bevelBox(C(0.75), C(0.88), W - hull * 2, beamMat, 0.01);
        joist.position.set(x, y - C(0.44), 0);
        g.add(joist);
      }

      // Longitudinal spine purlins at z = +/-8.5C framing the 17-cubit royal nave
      for (const sz of [-1, 1]) {
        const purlin = bevelBox(L - hull * 2, C(0.8), C(0.85), beamMat, 0.01);
        purlin.position.set(0, y - C(0.55), sz * C(8.5));
        g.add(purlin);
      }
    }
    counts.decks++;
  }

  // ── Full-height Colonade Pillars & Knee Braces down z = +/-8.5C ───────────
  {
    const pillarGeo = new THREE.BoxGeometry(C(0.88), DECK_H - deckT, C(0.88));
    const braceGeo = new THREE.BoxGeometry(C(0.42), C(2.8), C(0.46));
    const pInst = new THREE.InstancedMesh(pillarGeo, beamMat, 200);
    const bInst = new THREE.InstancedMesh(braceGeo, beamMat, 400);
    const dummy = new THREE.Object3D();
    let pn = 0, bn = 0;

    for (const [di, y] of deckY.entries()) {
      const topH = di === 2 ? LIGHT_TOP - y - deckT : DECK_H - deckT;
      const scaleY = topH / (DECK_H - deckT);
      for (let x = -halfL + C(12); x <= halfL - C(12); x += C(12)) {
        // Leave central side-door nave (+/-8C) majestic and unobstructed
        if (Math.abs(x) < C(8)) continue;
        for (const sz of [-1, 1]) {
          const pz = sz * C(8.5);
          dummy.position.set(x, y + deckT + topH / 2, pz);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, scaleY, 1);
          dummy.updateMatrix();
          pInst.setMatrixAt(pn++, dummy.matrix);

          // Corner knee braces framing the upper beam above eye height
          for (const dir of [-1, 1]) {
            dummy.position.set(x + dir * C(1.15), y + deckT + topH - C(1.25), pz);
            dummy.rotation.set(0, 0, dir * Math.PI / 4);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            bInst.setMatrixAt(bn++, dummy.matrix);
          }
        }
      }
    }
    pInst.count = pn;
    bInst.count = bn;
    g.add(pInst);
    g.add(bInst);
  }

  // ── Rooms ("one room and another", qinnim, Gen 6:14) & Furnishings ────────
  const PEN = C(5), PEN_DEEP = C(16), RAIL = C(1.65);
  {
    const strawPlaces: [number, number, number][] = [];
    const troughPlaces: [number, number, number][] = [];
    const jarPlaces: [number, number, number, number][] = [];
    const cratePlaces: [number, number, number, number][] = [];

    for (const [di, y] of deckY.entries()) {
      const holeAbove = rampSpan(di + 1);
      const holeHere = rampSpan(di);
      for (const sz of [-1, 1]) {
        const backZ = sz * (halfW - hull);
        const frontZ = sz * (halfW - hull - PEN_DEEP); // +/-8C

        for (let x = -halfL + hull; x < halfL - hull - PEN; x += PEN) {
          if (holeAbove && x + PEN > holeAbove[0] - C(1) && x < holeAbove[1] + C(1)) continue;
          if (holeHere && x + PEN > holeHere[0] - C(1) && x < holeHere[1] + C(1)) continue;
          // Leave central cross-aisle (|x| < 5.5C) completely open on Lower Deck
          // so entering at the side door opens straight to the north wall (38 m clear).
          if (di === 0 && x + PEN > -C(5.5) && x < C(5.5)) continue;

          const wall = bevelBox(C(0.34), C(3.1), PEN_DEEP, timberMat, 0.006);
          wall.position.set(x, y + deckT + C(1.55), (backZ + frontZ) / 2);
          g.add(wall);
          addCollider(wall);

          const post = bevelBox(C(0.45), C(3.4), C(0.45), beamMat, 0.008);
          post.position.set(x, y + deckT + C(1.7), frontZ);
          g.add(post);

          const bar = bevelBox(PEN - C(1.8), C(0.24), C(0.28), timberMat, 0.006);
          bar.position.set(x + PEN / 2 + C(0.8), y + deckT + RAIL, frontZ);
          g.add(bar);

          const roomIdx = Math.round((x + halfL - hull) / PEN);
          const roomCenter = x + PEN / 2;

          // Straw bedding & troughs on Deck 1 livestock pens
          if (di === 0 && ((roomIdx >= 7 && roomIdx <= 17) || (roomIdx >= 20 && roomIdx <= 28))) {
            strawPlaces.push([roomCenter, y + deckT + C(0.06), frontZ + sz * C(7.2)]);
            troughPlaces.push([roomCenter, y + deckT + C(0.55), frontZ + sz * C(1.5)]);
          }

          // Provision jars & lashed wooden supply crates on Deck 2 bays (outside gangway)
          if (di === 1 && roomIdx % 3 === 0 && Math.abs(roomCenter) < C(108)) {
            jarPlaces.push([roomCenter - C(1.1), y + deckT, frontZ + sz * C(3.0), 1.0]);
            jarPlaces.push([roomCenter + C(0.2), y + deckT, frontZ + sz * C(2.2), 0.78]);
            cratePlaces.push([roomCenter + C(1.2), y + deckT + C(0.95), frontZ + sz * C(5.2), (roomIdx % 5) * 0.2]);
          }

          // Roosting bars on Third Deck bays (birds, Gen 6:14 nests)
          if (di === 2 && roomIdx % 2 === 0 && roomIdx >= 14 && roomIdx <= 38) {
            const perch = bevelBox(PEN - C(0.8), C(0.16), C(0.18), timberMat, 0.003);
            perch.position.set(roomCenter, y + deckT + C(2.85), frontZ + sz * C(3.2));
            g.add(perch);
          }

          counts.rooms++;
        }

        // Low kerb along stall fronts, cleanly split across central nave and stairwells
        const addKerbSpan = (ax: number, bx: number) => {
          if (bx - ax < C(1)) return;
          const k = bevelBox(bx - ax, C(0.45), C(0.28), timberMat, 0.006);
          k.position.set((ax + bx) / 2, y + deckT + C(0.225), frontZ);
          g.add(k);
        };
        if (di === 0) {
          addKerbSpan(x0Edge(), -C(5.5));
          addKerbSpan(C(5.5), C(116));
        } else {
          addKerbSpan(di === 2 ? -C(116) : x0Edge(), di === 1 ? C(116) : x1Edge());
        }
      }
    }

    function x0Edge() { return -halfL + hull; }
    function x1Edge() { return halfL - hull; }

    // Instanced straw bedding mats
    if (strawPlaces.length) {
      const sGeo = new THREE.BoxGeometry(PEN - C(0.8), C(0.12), PEN_DEEP - C(3.2));
      const sInst = new THREE.InstancedMesh(sGeo, strawMat, strawPlaces.length);
      const dummy = new THREE.Object3D();
      strawPlaces.forEach(([px, py, pz], idx) => {
        dummy.position.set(px, py, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sInst.setMatrixAt(idx, dummy.matrix);
      });
      sInst.userData.noCast = true;
      g.add(sInst);
    }

    // Instanced feeding troughs
    if (troughPlaces.length) {
      const tGeo = new THREE.BoxGeometry(C(3.2), C(0.82), C(1.2));
      const tInst = new THREE.InstancedMesh(tGeo, beamMat, troughPlaces.length);
      const dummy = new THREE.Object3D();
      troughPlaces.forEach(([px, py, pz], idx) => {
        dummy.position.set(px, py, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        tInst.setMatrixAt(idx, dummy.matrix);
      });
      g.add(tInst);
    }

    // Lathe-turned earthenware provision jars (Gen 6:21)
    if (jarPlaces.length) {
      const pts = [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(C(0.55), 0),
        new THREE.Vector2(C(0.95), C(0.95)),
        new THREE.Vector2(C(0.92), C(1.75)),
        new THREE.Vector2(C(0.48), C(2.3)),
        new THREE.Vector2(C(0.6), C(2.55)),
        new THREE.Vector2(C(0.46), C(2.58)),
      ];
      const jarGeo = new THREE.LatheGeometry(pts, 14);
      const jInst = new THREE.InstancedMesh(jarGeo, jarMat, jarPlaces.length);
      const dummy = new THREE.Object3D();
      jarPlaces.forEach(([px, py, pz, s], idx) => {
        dummy.position.set(px, py, pz);
        dummy.rotation.set(0, idx * 0.7, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        jInst.setMatrixAt(idx, dummy.matrix);
      });
      g.add(jInst);
    }

    // Supply crates
    if (cratePlaces.length) {
      const cGeo = new THREE.BoxGeometry(C(2.1), C(1.9), C(2.1));
      const cInst = new THREE.InstancedMesh(cGeo, timberMat, cratePlaces.length);
      const dummy = new THREE.Object3D();
      cratePlaces.forEach(([px, py, pz, rot], idx) => {
        dummy.position.set(px, py, pz);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cInst.setMatrixAt(idx, dummy.matrix);
      });
      g.add(cInst);
    }
  }

  // ── The Door in the Side, Swung Open (Gen 6:16 before 7:16) ──────────────
  {
    for (const sx of [-1, 1]) {
      const jamb = bevelBox(C(0.95), doorH + C(0.95), hull * 1.45, beamMat, 0.01);
      jamb.position.set(sx * (doorW / 2 + C(0.48)), (doorH + C(0.95)) / 2, doorZ);
      g.add(jamb);
      addCollider(jamb);
    }
    const head = bevelBox(doorW + C(1.9), C(0.95), hull * 1.45, beamMat, 0.01);
    head.position.set(0, doorH + C(0.48), doorZ);
    g.add(head);
    addCollider(head);

    // Hinged plank door leaf swung open east against the hull with bronze hinge straps
    const leaf = bevelBox(doorW * 0.96, doorH * 0.96, C(0.55), timberMat, 0.01);
    leaf.position.set(doorW / 2 + doorW * 0.48 + C(0.72), doorH / 2, doorZ - C(1.5));
    leaf.rotation.y = 0.28;
    g.add(leaf);
    addCollider(leaf);

    for (const sy of [C(2.1), C(6.4)]) {
      const strap = bevelBox(doorW * 0.72, C(0.32), C(0.68), ironMat, 0.005);
      strap.position.set(doorW / 2 + doorW * 0.42 + C(0.72), sy, doorZ - C(1.45));
      strap.rotation.y = 0.28;
      g.add(strap);
    }

    // Level threshold sill flush with Lower Deck
    const sill = bevelBox(doorW + C(1.9), deckT, hull * 2.8, beamMat, 0.01);
    sill.position.set(0, deckT / 2, doorZ - C(0.3));
    g.add(sill);
    addTread(
      -doorW / 2 - C(0.95), 0, doorZ - hull * 1.4 - C(0.3),
      doorW / 2 + C(0.95), deckT, doorZ + hull * 1.4 - C(0.3),
    );
  }
  counts.doors++;

  // ── Exterior Entry Ramp & Fore/Aft Interior Ramps ─────────────────────────
  const rampTreads = (
    x0: number, z0: number, x1: number, z1: number,
    y0: number, y1: number, halfWidth: number, steps = 32,
  ) => {
    for (let i = 0; i < steps; i++) {
      const a = i / steps, b = (i + 1) / steps;
      const ax = x0 + (x1 - x0) * a, bx = x0 + (x1 - x0) * b;
      const az = z0 + (z1 - z0) * a, bz = z0 + (z1 - z0) * b;
      const top = y0 + (y1 - y0) * b;
      addTread(
        Math.min(ax, bx) - (x1 === x0 ? halfWidth : 0),
        top - C(0.65),
        Math.min(az, bz) - (z1 === z0 ? halfWidth : 0),
        Math.max(ax, bx) + (x1 === x0 ? halfWidth : 0),
        top,
        Math.max(az, bz) + (z1 === z0 ? halfWidth : 0),
      );
    }
  };

  // Exterior boarding gangway rising 3.1C from ground (-2.6C) up to Lower Deck sill (+0.5C)
  {
    const run = C(14.5);
    const top = deckT;
    const rise = LIFT + top;
    const foot = doorZ - run - C(1.0);
    const head = doorZ - C(1.0);
    const rampLen = Math.hypot(run, rise);
    const angle = Math.atan2(rise, run);

    const ramp = bevelBox(doorW, C(0.6), rampLen, timberMat, 0.01);
    ramp.position.set(0, (top - LIFT) / 2, (foot + head) / 2);
    ramp.rotation.x = -angle;
    g.add(ramp);

    // Anti-slip cross cleats along ramp deck
    for (let k = 1; k < 14; k++) {
      const f = k / 14;
      const cleat = bevelBox(doorW - C(0.5), C(0.1), C(0.24), beamMat, 0.004);
      cleat.position.set(0, -LIFT + rise * f + C(0.26), foot + run * f);
      cleat.rotation.x = -angle;
      g.add(cleat);
    }

    // Side rails strictly outside ramp width so walking is smooth and unobstructed
    for (const sx of [-1, 1]) {
      const rail = bevelBox(C(0.25), C(0.32), rampLen, beamMat, 0.008);
      rail.position.set(sx * (doorW / 2 + C(0.22)), (top - LIFT) / 2 + C(2.1), (foot + head) / 2);
      rail.rotation.x = -angle;
      g.add(rail);
      for (const f of [0.08, 0.5, 0.92]) {
        const st = bevelBox(C(0.32), C(2.4), C(0.32), beamMat, 0.008);
        st.position.set(sx * (doorW / 2 + C(0.22)), -LIFT + rise * f + C(1.1), foot + run * f);
        g.add(st);
      }
    }

    rampTreads(0, foot, 0, head, -LIFT, top, doorW / 2, 24);
    for (let i = 1; i <= 2; i++) {
      const frac = i / 3;
      const z = head - run * frac;
      const h = rise * (1 - frac) + C(0.3);
      const trestle = bevelBox(doorW * 0.82, h, C(0.75), beamMat, 0.02);
      trestle.position.set(0, -LIFT + h / 2, z);
      g.add(trestle);
    }
  }

  // Interior Fore (x: 142.2 -> 117.2) & Aft (x: -142.2 -> -117.2) Ramps
  for (const [i, y] of deckY.entries()) {
    if (i === deckY.length - 1) break;
    const sx = i % 2 === 0 ? 1 : -1;
    const x0 = sx * C(142.2);
    const x1 = sx * C(117.2);
    const z = 0;
    const run = Math.abs(x1 - x0);
    const angle = Math.atan2(DECK_H, run);
    const rampLen = Math.hypot(run, DECK_H);

    const ramp = bevelBox(rampLen, C(0.5), C(6.4), timberMat, 0.01);
    ramp.position.set((x0 + x1) / 2, y + DECK_H / 2 + deckT - C(0.15), z);
    ramp.rotation.z = -sx * angle;
    g.add(ramp);

    for (let k = 1; k < 22; k++) {
      const f = k / 22;
      const cleat = bevelBox(C(0.24), C(0.08), C(5.8), beamMat, 0.004);
      cleat.position.set(x0 + (x1 - x0) * f, y + deckT + DECK_H * f + C(0.14), z);
      cleat.rotation.z = -sx * angle;
      g.add(cleat);
    }

    // Stairwell balustrades on the landing deck above (never extending into deck below)
    const upperY = y + DECK_H + deckT;
    const [hx0, hx1] = [Math.min(x0, x1), Math.max(x0, x1)];
    for (const sz of [-1, 1]) {
      const topRail = bevelBox(hx1 - hx0 + C(2.8), C(0.24), C(0.28), beamMat, 0.006);
      topRail.position.set((hx0 + hx1) / 2, upperY + C(2.1), sz * (RAMP_HALF + C(0.2)));
      g.add(topRail);
      for (const px of [hx0, (hx0 + hx1) / 2, hx1]) {
        const post = bevelBox(C(0.32), C(2.2), C(0.32), beamMat, 0.006);
        post.position.set(px, upperY + C(1.1), sz * (RAMP_HALF + C(0.2)));
        g.add(post);
      }
    }

    rampTreads(x1, z, x0, z, y + DECK_H + deckT, y + deckT, C(3.2), 36);
  }

  // ── Interior Hanging Oil Lanterns, Glow Sprites & Dust-Filtered Sunbeams ───
  const glowTex = makeGlowSprite();
  const sunbeamTex = makeSunbeamTexture();
  const lanternGlows: { sprite: THREE.Sprite; baseScale: number; phase: number }[] = [];
  const lanternLights: { light: THREE.PointLight; baseIntensity: number; phase: number }[] = [];
  const sunbeamMeshes: { mesh: THREE.Mesh; baseOpacity: number }[] = [];

  {
    const lanternPositions: [number, number, number][] = [];
    for (const [di, y] of deckY.entries()) {
      const ly = y + (di === 2 ? C(26.8) - y : DECK_H - C(1.35));
      for (const lx of [-108, -72, -36, 0, 36, 72, 108]) {
        for (const sz of [-1, 1]) {
          lanternPositions.push([C(lx), ly, sz * C(8.5)]);
        }
      }
    }

    const cageGeo = new THREE.CylinderGeometry(C(0.32), C(0.22), C(0.75), 6, 1, false);
    const chainGeo = new THREE.CylinderGeometry(C(0.05), C(0.05), C(0.85), 5);
    const lInst = new THREE.InstancedMesh(cageGeo, ironMat, lanternPositions.length);
    const chInst = new THREE.InstancedMesh(chainGeo, ironMat, lanternPositions.length);
    const dummy = new THREE.Object3D();
    lanternPositions.forEach(([px, py, pz], idx) => {
      dummy.position.set(px, py, pz);
      dummy.rotation.set(0, idx * 0.4, 0);
      dummy.updateMatrix();
      lInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(px, py + C(0.7), pz);
      dummy.updateMatrix();
      chInst.setMatrixAt(idx, dummy.matrix);

      const spMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffc66e,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(spMat);
      sp.position.set(px, py - C(0.05), pz);
      const baseScale = C(2.1);
      sp.scale.setScalar(baseScale);
      sp.userData.dynamic = true;
      sp.userData.noCast = true;
      g.add(sp);
      lanternGlows.push({ sprite: sp, baseScale, phase: idx * 1.37 });
    });
    lInst.userData.noCast = true;
    chInst.userData.noCast = true;
    g.add(lInst);
    g.add(chInst);

    // Bounded real point lights providing warm amber pools across all three decks
    const lightSpots: [number, number, number][] = [
      [-96, 7.5, 0], [-36, 7.5, 0], [0, 7.5, -6], [64, 7.5, 0], [126, 7.5, 0],
      [-96, 17.5, 0], [0, 17.5, 0], [96, 17.5, 0],
      [-64, 26.2, 0], [40, 26.2, -3],
    ];
    lightSpots.forEach(([lx, ly, lz], idx) => {
      const pt = new THREE.PointLight(0xffb55a, 8.5, C(28), 1.6);
      pt.position.set(C(lx), C(ly), C(lz));
      pt.userData.dynamic = true;
      g.add(pt);
      lanternLights.push({ light: pt, baseIntensity: 8.5, phase: idx * 2.1 });
    });

    // Angled volumetric light shafts streaming through the tsohar & slatted light grates
    const beamGeo = new THREE.PlaneGeometry(C(11), C(22));
    for (const bx of [-84, -38, 38, 84]) {
      const bmMat = new THREE.MeshBasicMaterial({
        map: sunbeamTex,
        color: 0xffecd0,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const beamMesh = new THREE.Mesh(beamGeo, bmMat);
      beamMesh.position.set(C(bx), C(14.5), C(2.5));
      beamMesh.rotation.set(0.34, 0, 0);
      beamMesh.userData.dynamic = true;
      beamMesh.userData.noCast = true;
      g.add(beamMesh);
      sunbeamMeshes.push({ mesh: beamMesh, baseOpacity: 0.42 });

      const crossBeam = new THREE.Mesh(beamGeo, bmMat.clone());
      crossBeam.position.copy(beamMesh.position);
      crossBeam.rotation.set(0.34, Math.PI / 2, 0);
      crossBeam.userData.dynamic = true;
      crossBeam.userData.noCast = true;
      g.add(crossBeam);
      sunbeamMeshes.push({ mesh: crossBeam, baseOpacity: 0.36 });
    }
    // Shaft through the open Gen 8:6 roof hatch
    const hatchBeam = new THREE.Mesh(new THREE.PlaneGeometry(C(6.5), C(14)), new THREE.MeshBasicMaterial({
      map: sunbeamTex,
      color: 0xfff0d6,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    hatchBeam.position.set(C(40), C(23.5), -C(4.8));
    hatchBeam.rotation.set(0.45, 0, 0);
    hatchBeam.userData.dynamic = true;
    hatchBeam.userData.noCast = true;
    g.add(hatchBeam);
    sunbeamMeshes.push({ mesh: hatchBeam, baseOpacity: 0.48 });
  }

  // Drifting golden dust motes illuminated inside the central nave
  let dustPoints: THREE.Points;
  let dustBaseY: Float32Array;
  {
    const MOTE_N = 520;
    const pos = new Float32Array(MOTE_N * 3);
    dustBaseY = new Float32Array(MOTE_N);
    const rng = seedRand(777);
    for (let i = 0; i < MOTE_N; i++) {
      pos[i * 3] = C((rng() - 0.5) * 260);
      const yVal = C(1.5 + rng() * 24.5);
      pos[i * 3 + 1] = yVal;
      dustBaseY[i] = yVal;
      pos[i * 3 + 2] = C((rng() - 0.5) * 18);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: glowTex,
      color: 0xffe0a6,
      size: C(0.42),
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dustPoints = new THREE.Points(geo, mat);
    dustPoints.userData.dynamic = true;
    dustPoints.userData.noCast = true;
    g.add(dustPoints);
  }

  // ── Natural Optical Sky Rainbow (Gen 9:13, visible in 'dawn' mode) & Exterior Rain ──
  const rainbow = buildRainbowArc(C(290));
  rainbow.position.set(-C(18), -LIFT - C(22), C(410));
  rainbow.rotation.y = 0.14;
  g.add(rainbow);

  const RAIN_N = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 6);
  const rainSeed = new Float32Array(RAIN_N * 3);
  {
    const rng = seedRand(808);
    for (let i = 0; i < RAIN_N; i++) {
      // Distributed strictly outside the pitched hull apron or far above roof
      let rx = C((rng() - 0.5) * 380);
      let rz = C((rng() - 0.5) * 220);
      if (Math.abs(rx) < halfL + C(6) && Math.abs(rz) < halfW + C(6)) {
        rz = (rz < 0 ? -1 : 1) * (halfW + C(8 + rng() * 65));
      }
      const ry = C(rng() * 52);
      rainSeed[i * 3] = rx;
      rainSeed[i * 3 + 1] = ry;
      rainSeed[i * 3 + 2] = rz;
      rainPos[i * 6] = rx;
      rainPos[i * 6 + 1] = ry;
      rainPos[i * 6 + 2] = rz;
      rainPos[i * 6 + 3] = rx - C(0.35);
      rainPos[i * 6 + 4] = ry - C(2.2);
      rainPos[i * 6 + 5] = rz;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  }
  const rainLines = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0xbdd0e6, transparent: true, opacity: 0.42 }),
  );
  rainLines.visible = false;
  rainLines.userData.dynamic = true;
  rainLines.userData.noCast = true;
  g.add(rainLines);

  // ── Loaded Figures (with procedural fallbacks if any GLB fails) ─────────
  const ready = (async () => {
    const templates = new Map<string, THREE.Group>();
    let allGlb = true;
    await Promise.all(ABOARD.map(async (a) => {
      try {
        templates.set(a.file, await loadFigure(`/models/${a.file}.glb`, a.height));
      } catch {
        allGlb = false;
        templates.set(a.file, buildProceduralFigure(a.file, a.height));
      }
    }));

    const ox = templates.get('ox')!;
    const camel = templates.get('camel')!;
    const dove = templates.get('dove')!;
    const raven = templates.get('raven')!;
    const man = templates.get('man')!;
    const woman = templates.get('woman')!;

    // 14 of a clean kind (7 males north, 7 females south) in stalls room(8..14), x = -106.5..-76.5
    const room = (n: number) => C(-146.5 + n * 5);
    for (let i = 0; i < 14; i++) {
      const male = i < 7;
      const n = (male ? i : i - 7) + 8;
      g.add(place(ox, room(n), deckT, C(male ? 13 : -13), male ? -Math.PI / 2 : Math.PI / 2, i));
      counts.clean++;
    }

    // 2 of an unclean kind (1 male, 1 female camel, Gen 7:2; Lev 11:4)
    for (let i = 0; i < 2; i++) {
      g.add(place(camel, room(21 + i * 2), deckT, C(i === 0 ? 14 : -14), i === 0 ? -Math.PI / 2 : Math.PI / 2, i));
      counts.unclean++;
    }

    // 14 doves (Gen 7:3; 8:8) & the raven (Gen 8:7) perched on Third Deck stall rails under tsohar
    for (let i = 0; i < 14; i++) {
      const sz = i % 2 === 0 ? 1 : -1;
      g.add(place(dove, C(-66 + Math.floor(i / 2) * 8), DECK_H * 2 + deckT + RAIL, sz * C(8),
        sz > 0 ? 0.35 : Math.PI - 0.35, i));
      counts.birds++;
    }
    g.add(place(raven, C(-18), DECK_H * 2 + deckT + RAIL, C(8), 0.5));

    // Noah, his wife, his three sons and their three wives amidships on Second Deck (Gen 7:13)
    const EIGHT: [number, number, number][] = [
      [-9.5, 4.2, Math.PI * 0.86], [-5.0, 2.4, Math.PI * 1.15],
      [-1.2, 4.6, Math.PI * 0.72], [2.6, 2.8, Math.PI * 1.04],
      [-8.6, -3.0, -0.22], [-4.4, -5.0, 0.34],
      [-0.6, -2.8, -0.12], [3.4, -4.6, 0.46],
    ];
    EIGHT.forEach(([x, z, facing], i) => {
      g.add(place(i < 4 ? man : woman, C(x), DECK_H + deckT, C(z), facing, i));
      counts.people++;
    });

    return allGlb;
  })();

  batchStatic(g);

  let atmosphere: ArkAtmosphere = 'dawn';
  let elapsed = 0;

  const setAtmosphere = (mode: ArkAtmosphere) => {
    atmosphere = mode;
    const isStorm = mode === 'storm';
    rainbow.visible = !isStorm;
    rainLines.visible = isStorm;
    for (const s of sunbeamMeshes) {
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = isStorm ? s.baseOpacity * 0.14 : s.baseOpacity;
    }
    for (const l of lanternLights) {
      l.baseIntensity = isStorm ? 16 : 8.5;
    }
    (dustPoints.material as THREE.PointsMaterial).opacity = isStorm ? 0.32 : 0.65;
  };

  const update = (dt: number) => {
    elapsed += dt;
    for (const lg of lanternGlows) {
      const f = 0.9 + 0.12 * Math.sin(elapsed * 7.2 + lg.phase) + 0.05 * Math.cos(elapsed * 13.1 + lg.phase);
      lg.sprite.scale.setScalar(lg.baseScale * f);
      (lg.sprite.material as THREE.SpriteMaterial).opacity = atmosphere === 'storm' ? 0.96 : 0.78;
    }
    for (const ll of lanternLights) {
      const f = 0.92 + 0.08 * Math.sin(elapsed * 6.4 + ll.phase);
      ll.light.intensity = ll.baseIntensity * f;
    }
    const dPos = dustPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dPos.count; i++) {
      dPos.setY(i, dustBaseY[i]! + Math.sin(elapsed * 0.55 + i * 0.7) * C(0.45));
    }
    dPos.needsUpdate = true;

    if (rainLines.visible) {
      const rPos = rainGeo.attributes.position as THREE.BufferAttribute;
      const fall = (elapsed * 34) % C(54);
      for (let i = 0; i < RAIN_N; i++) {
        const bx = rainSeed[i * 3]!;
        let by = rainSeed[i * 3 + 1]! - fall;
        if (by < -LIFT) by += C(54);
        const bz = rainSeed[i * 3 + 2]!;
        rPos.setXYZ(i * 2, bx, by, bz);
        rPos.setXYZ(i * 2 + 1, bx - C(0.35), by - C(2.2), bz);
      }
      rPos.needsUpdate = true;
    }
  };

  const anchors = {
    outside: new THREE.Vector3(0, 0, -(halfW + C(40))),
    door: new THREE.Vector3(0, 0, doorZ),
    hold: new THREE.Vector3(0, 0, 0),
    second: new THREE.Vector3(0, DECK_H, 0),
    third: new THREE.Vector3(0, DECK_H * 2, 0),
  };

  const arkObj: Ark = {
    group: g,
    colliders,
    platforms,
    floorY,
    counts,
    ready,
    anchors,
    update,
    setAtmosphere,
    get atmosphere() {
      return atmosphere;
    },
  };
  return arkObj;
}
