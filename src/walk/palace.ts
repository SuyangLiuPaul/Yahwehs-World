import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { batchStatic, bevelBox } from './craft';
import { buildDesert } from './environment';
import { rockProjection } from './materials';

export interface PalaceCounts {
  cedarPillars: number;
  sideChambers: number;
  windowRanks: number;
  largeShields: number;
  smallShields: number;
  throneSteps: number;
  stepLions: number;
  armrestLions: number;
  goldVessels: number;
}

export interface SolomonPalace {
  group: THREE.Group;
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  counts: PalaceCounts;
  CUBIT: number;
  OUTSIDE_Y: number;
  COURT_Y: number;
  FOREST_Y: number;
  GALLERY_Y: number;
  PORCH_Y: number;
  THRONE_Y: number;
  DAIS_Y: number;
  TERRACE_Y: number;
  floorY: (x: number, z: number) => number;
  rescale: (newCubit: number) => number;
  update: (dt: number, elapsed: number) => void;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic Ophel & Southern Mount Moriah ridge height in CUBITS (1 Kings 7:1-12; 10:5).
 * Great Court sits level at 0 c; South Royal Approach sits at -1.20 c (5 steps below);
 * Northern Mount Moriah rises smoothly north of the Great Court (+Z) up to +18 c for Solomon's Temple.
 */
export function ophelCubits(cx: number, cz: number, visual = false): number {
  const OUTSIDE = -1.20;
  const ax = Math.abs(cx);

  // Inside the 180 x 240 cubit Great Court
  if (ax <= 89.6 && cz >= -119.6 && cz <= 119.6) {
    return 0;
  }

  // Smooth physics ramp beneath the 5 South Royal Gate steps (gradient 0.20 << MAX_CLIMB = 1.0)
  if (ax <= 14 && cz < -119.6 && cz >= -125.6) {
    return visual ? OUTSIDE : OUTSIDE * ((-119.6 - cz) / 6.0);
  }

  // Level South Royal Approach Plaza
  if (ax <= 48 && cz < -119.6 && cz >= -154) {
    return OUTSIDE;
  }

  // Northern Mount Moriah ridge ascending from Z = +120 up to Solomon's Temple platform (+18 c)
  if (cz > 119.6) {
    const northRise = smoothstep(122, 178, cz) * 18.0;
    const northBackDrop = smoothstep(282, 390, cz) * 36.0;
    const eastWestFall = smoothstep(62, 195, ax) * 42.0;
    const undulation = Math.sin(cx * 0.04) * Math.cos(cz * 0.035) * 1.1 * smoothstep(68, 130, ax);
    return northRise - northBackDrop - eastWestFall + undulation;
  }

  // East (Kidron Valley), West (Tyropoeon Valley) & South (City of David ridge) slopes
  const dx = Math.max(0, ax - 90);
  const dzSouth = Math.max(0, -154 - cz);
  const eastSteep = cx > 90 ? smoothstep(0, 140, dx) * 40 : 0;
  const westSlope = cx < -90 ? smoothstep(0, 155, dx) * 30 : 0;
  const southSpur = smoothstep(0, 180, dzSouth) * 24;
  const plazaBlend = cz < -119.6 && cz >= -154 ? smoothstep(48, 92, ax) * 8 : 0;
  const ripple = Math.sin(cx * 0.045 + 0.7) * Math.cos(cz * 0.038) * 1.2 * smoothstep(8, 65, dx + dzSouth);

  return OUTSIDE - eastSteep - westSlope - southSpur - plazaBlend + ripple;
}

interface PalaceMaterials {
  pavingMat: THREE.MeshStandardMaterial;
  plazaMat: THREE.MeshStandardMaterial;
  ashlarMat: THREE.MeshStandardMaterial;
  megalithMat: THREE.MeshStandardMaterial;
  cedarMat: THREE.MeshStandardMaterial;
  darkCedarMat: THREE.MeshStandardMaterial;
  carvedCedarMat: THREE.MeshStandardMaterial;
  goldMat: THREE.MeshStandardMaterial;
  ivoryMat: THREE.MeshStandardMaterial;
  bronzeMat: THREE.MeshStandardMaterial;
  royalCarpetMat: THREE.MeshStandardMaterial;
  windowGlowMat: THREE.MeshBasicMaterial;
  emberMat: THREE.MeshStandardMaterial;
  smokeTex: THREE.CanvasTexture;
}

function buildPalaceMaterials(): PalaceMaterials {
  const makeTex = (
    size: number,
    draw: (ctx: CanvasRenderingContext2D, s: number) => void,
    rx = 1,
    ry = 1,
    srgb = true,
  ): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    draw(ctx, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };

  // 1. Costly sawed & drafted Jerusalem meleke limestone ashlars (1 Kgs 7:9-12)
  const ashlarMap = makeTex(512, (ctx, s) => {
    ctx.fillStyle = '#dfd3ba';
    ctx.fillRect(0, 0, s, s);
    const rows = 8;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      const off = (r % 2) * (s * 0.25);
      for (let c = -1; c < 4; c++) {
        const x = c * (s * 0.5) + off;
        const v = (((r * 13 + c * 29) & 15) - 7) * 1.8;
        ctx.fillStyle = `rgb(${224 + v}, ${211 + v}, ${184 + v})`;
        ctx.fillRect(x + 3, y + 3, s * 0.5 - 6, rh - 6);
        // Drafted margin bevel
        ctx.strokeStyle = 'rgba(250, 243, 226, 0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 7, y + 7, s * 0.5 - 14, rh - 14);
        ctx.strokeStyle = 'rgba(116, 102, 78, 0.42)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, s * 0.5 - 4, rh - 4);
      }
    }
  });

  const ashlarBump = makeTex(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const rh = s / rows;
      ctx.fillStyle = '#555555';
      for (let r = 0; r < rows; r++) {
        const y = r * rh;
        ctx.fillRect(0, y, s, 3);
        const off = (r % 2) * (s * 0.25);
        for (let c = 0; c < 4; c++) {
          ctx.fillRect((c * s * 0.5 + off) % s, y, 3, rh);
        }
      }
    },
    1,
    1,
    false,
  );

  // 2. Great Court Limestone Paving Flags
  const pavingMap = makeTex(
    512,
    (ctx, s) => {
      ctx.fillStyle = '#d8cbb2';
      ctx.fillRect(0, 0, s, s);
      const n = 8;
      const cell = s / n;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const shade = (((r * 17 + c * 31) & 15) - 8) * 1.6;
          ctx.fillStyle = `rgb(${216 + shade}, ${203 + shade}, ${178 + shade})`;
          ctx.fillRect(c * cell + 2, r * cell + 2, cell - 4, cell - 4);
        }
      }
      ctx.strokeStyle = 'rgba(110, 96, 74, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, s);
        ctx.moveTo(0, i * cell);
        ctx.lineTo(s, i * cell);
        ctx.stroke();
      }
    },
    34,
    44,
  );

  // 3. Trimmed Lebanon Cedar Planks & Columns (1 Kgs 7:2-3)
  const cedarMap = makeTex(512, (ctx, s) => {
    ctx.fillStyle = '#824b28';
    ctx.fillRect(0, 0, s, s);
    for (let p = 0; p < 8; p++) {
      const y = (p * s) / 8;
      const tone = ((p * 11) % 5) * 5 - 10;
      ctx.fillStyle = `rgb(${132 + tone}, ${76 + Math.round(tone * 0.6)}, ${41 + Math.round(tone * 0.4)})`;
      ctx.fillRect(0, y, s, s / 8 - 2);
      // Woodgrain streaks
      for (let g = 0; g < 18; g++) {
        const gy = y + ((g * 3.5) % (s / 8 - 4));
        ctx.fillStyle = g % 2 === 0 ? 'rgba(64, 32, 14, 0.22)' : 'rgba(176, 112, 66, 0.16)';
        ctx.fillRect(0, gy, s, 1.5);
      }
      ctx.fillStyle = 'rgba(42, 20, 8, 0.55)';
      ctx.fillRect(0, y + s / 8 - 2, s, 2);
    }
  });

  // 4. Carved Lebanon Cedar Coffered Wall Paneling (Hall of Judgment, 1 Kgs 7:7)
  const carvedCedarMap = makeTex(512, (ctx, s) => {
    ctx.fillStyle = '#6f3d1e';
    ctx.fillRect(0, 0, s, s);
    const cells = 4;
    const cw = s / cells;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const x = c * cw;
        const y = r * cw;
        ctx.strokeStyle = '#47240f';
        ctx.lineWidth = 6;
        ctx.strokeRect(x + 8, y + 8, cw - 16, cw - 16);
        ctx.strokeStyle = '#b98246';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 15, y + 15, cw - 30, cw - 30);
        // Stylised botanical lotus / palmette rosette in cedar relief
        const cx = x + cw * 0.5;
        const cy = y + cw * 0.5;
        ctx.strokeStyle = 'rgba(204, 148, 82, 0.55)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(cx, cy, cw * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
          ctx.lineTo(cx + Math.cos(a) * (cw * 0.18), cy + Math.sin(a) * (cw * 0.18));
          ctx.stroke();
        }
      }
    }
  });

  // 5. Hammered Pure Gold (1 Kgs 10:16-21)
  const goldBump = makeTex(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
      let seed = 41;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      for (let i = 0; i < 220; i++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const rad = 5 + rnd() * 10;
        const grd = ctx.createRadialGradient(x, y, 1, x, y, rad);
        grd.addColorStop(0, 'rgba(220,220,220,0.45)');
        grd.addColorStop(1, 'rgba(128,128,128,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    2,
    2,
    false,
  );

  // 6. Carved Elephant Ivory with subtle grain & gold inlay border (1 Kgs 10:18)
  const ivoryMap = makeTex(256, (ctx, s) => {
    ctx.fillStyle = '#f6eedc';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 36; i++) {
      ctx.strokeStyle = 'rgba(222, 206, 175, 0.36)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, i * 7.2);
      ctx.quadraticCurveTo(s * 0.5, i * 7.2 + 5, s, i * 7.2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#d9ac42';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, s - 12, s - 12);
  });

  // 7. Soft Rising Smoke Sprite Texture (for distant Temple Bronze Altar)
  const smokeTex = makeTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s * 0.5, s * 0.5, 4, s * 0.5, s * 0.5, s * 0.48);
    g.addColorStop(0, 'rgba(246, 238, 224, 0.52)');
    g.addColorStop(0.5, 'rgba(228, 218, 204, 0.22)');
    g.addColorStop(1, 'rgba(228, 218, 204, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  const pavingMat = new THREE.MeshStandardMaterial({
    name: 'CourtPaving',
    map: pavingMap,
    roughness: 0.86,
    metalness: 0.02,
  });

  const plazaMat = new THREE.MeshStandardMaterial({
    name: 'ApproachPaving',
    color: new THREE.Color('#cbbca0'),
    roughness: 0.9,
    metalness: 0.02,
  });

  const ashlarMat = new THREE.MeshStandardMaterial({
    name: 'CostlyAshlar',
    map: ashlarMap,
    bumpMap: ashlarBump,
    bumpScale: 0.03,
    roughness: 0.82,
    metalness: 0.02,
  });

  const megalithMat = new THREE.MeshStandardMaterial({
    name: 'FoundationMegalith',
    color: new THREE.Color('#cfc0a3'),
    map: ashlarMap,
    bumpMap: ashlarBump,
    bumpScale: 0.045,
    roughness: 0.86,
    metalness: 0.02,
  });

  const cedarMat = new THREE.MeshStandardMaterial({
    name: 'InteriorCedar',
    map: cedarMap,
    roughness: 0.72,
    metalness: 0.04,
  });

  const darkCedarMat = new THREE.MeshStandardMaterial({
    name: 'InteriorDarkCedar',
    color: new THREE.Color('#68391c'),
    map: cedarMap,
    roughness: 0.76,
    metalness: 0.04,
  });

  const carvedCedarMat = new THREE.MeshStandardMaterial({
    name: 'InteriorCarvedCedar',
    map: carvedCedarMap,
    roughness: 0.66,
    metalness: 0.08,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    name: 'InteriorGold',
    color: new THREE.Color('#f4c44e'),
    bumpMap: goldBump,
    bumpScale: 0.018,
    roughness: 0.23,
    metalness: 0.88,
  });

  const ivoryMat = new THREE.MeshStandardMaterial({
    name: 'InteriorIvory',
    map: ivoryMap,
    roughness: 0.3,
    metalness: 0.06,
  });

  const bronzeMat = new THREE.MeshStandardMaterial({
    name: 'BurnishedBronze',
    color: new THREE.Color('#b87738'),
    bumpMap: goldBump,
    bumpScale: 0.015,
    roughness: 0.34,
    metalness: 0.82,
  });

  const royalCarpetMat = new THREE.MeshStandardMaterial({
    name: 'InteriorRoyalTrim',
    color: new THREE.Color('#7a2226'),
    roughness: 0.82,
    metalness: 0.04,
  });

  const windowGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffefc8'),
  });

  const emberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff8c2b'),
    emissive: new THREE.Color('#ff6a14'),
    emissiveIntensity: 1.6,
    roughness: 0.7,
  });

  return {
    pavingMat,
    plazaMat,
    ashlarMat,
    megalithMat,
    cedarMat,
    darkCedarMat,
    carvedCedarMat,
    goldMat,
    ivoryMat,
    bronzeMat,
    royalCarpetMat,
    windowGlowMat,
    emberMat,
    smokeTex,
  };
}

/**
 * Builds a noble sculpted standing lion geometry in unit cubits (+Z forward, +Y up, base at Y = 0),
 * with strictly positive scales so all triangle normals wind outward cleanly.
 */
function createStandingLionGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pushPart = (geo: THREE.BufferGeometry, m: THREE.Matrix4) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
    }
    parts.push(g);
    geo.dispose();
  };

  const mat4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const eul = new THREE.Euler();

  const addPrim = (
    geo: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    pos.set(x, y, z);
    eul.set(rx, ry, rz);
    q.setFromEuler(eul);
    scl.set(sx, sy, sz);
    mat4.compose(pos, q, scl);
    pushPart(geo, mat4);
  };

  // Plinth base
  addPrim(new THREE.BoxGeometry(0.92, 0.16, 1.56), 0, 0.08, 0);
  // Four standing legs + paws
  for (const lx of [-0.26, 0.26]) {
    for (const lz of [-0.46, 0.46]) {
      addPrim(new THREE.CylinderGeometry(0.10, 0.09, 0.72, 10), lx, 0.52, lz);
      addPrim(new THREE.SphereGeometry(0.12, 10, 8), lx, 0.20, lz + 0.06, 0.95, 0.65, 1.25);
    }
  }
  // Muscular torso & ribcage
  addPrim(new THREE.SphereGeometry(0.36, 14, 10), 0, 0.96, -0.08, 0.88, 0.86, 1.65);
  addPrim(new THREE.SphereGeometry(0.39, 14, 10), 0, 1.06, 0.34, 0.96, 0.98, 1.05);
  // Royal sculpted mane collar
  addPrim(new THREE.SphereGeometry(0.44, 14, 12), 0, 1.32, 0.48, 1.02, 1.12, 0.96, -0.18, 0, 0);
  // Lion head, broad brow & muzzle
  addPrim(new THREE.SphereGeometry(0.28, 12, 10), 0, 1.44, 0.68, 0.96, 0.92, 1.05);
  addPrim(new THREE.BoxGeometry(0.28, 0.22, 0.28), 0, 1.36, 0.88);
  // Rounded ears
  for (const ex of [-0.21, 0.21]) {
    addPrim(new THREE.SphereGeometry(0.085, 8, 8), ex, 1.66, 0.58, 0.8, 1.0, 0.6);
  }
  // Curved tail rising proudly at rear
  addPrim(new THREE.CylinderGeometry(0.045, 0.055, 0.62, 8), 0, 1.22, -0.68, 1, 1, 1, -0.42, 0, 0);
  addPrim(new THREE.SphereGeometry(0.09, 8, 8), 0, 1.50, -0.80, 0.9, 1.2, 0.9);

  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

export function buildPalace(initialCubit = 0.445): SolomonPalace {
  const mats = buildPalaceMaterials();
  const root = new THREE.Group();
  root.name = 'SolomonPalaceRoot';

  // Build in 1-unit = 1-cubit space and scale unitGroup by cubit so live rescaling is < 1 ms
  const unitGroup = new THREE.Group();
  unitGroup.name = 'PalaceUnitScale';
  root.add(unitGroup);

  const OUTSIDE_C = -1.20;
  const COURT_C = 0.0;
  const FOREST_C = 1.20;
  const GALLERY_C = FOREST_C + 15.0; // +16.20 c (15 cubits above Forest House floor)
  const PORCH_C = 1.80;
  const THRONE_C = 2.40;
  const DAIS_C = THRONE_C + 6 * 0.36; // +4.56 c (6 steps above Hall of Judgment floor)
  const TERRACE_C = 3.60; // 12 steps up to Northern Temple-Vista Overlook Terrace

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  unitGroup.add(staticGroup);
  unitGroup.add(dynamicGroup);

  const rawColliders: THREE.Box3[] = [];
  const rawPlatforms: THREE.Box3[] = [];
  const colliders: THREE.Box3[] = [];
  const platforms: THREE.Box3[] = [];

  const counts: PalaceCounts = {
    cedarPillars: 0,
    sideChambers: 0,
    windowRanks: 3,
    largeShields: 0,
    smallShields: 0,
    throneSteps: 0,
    stepLions: 0,
    armrestLions: 0,
    goldVessels: 0,
  };

  function pushCollider(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    rawColliders.push(
      new THREE.Box3(
        new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
        new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)),
      ),
    );
  }

  function pushPlatform(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    rawPlatforms.push(
      new THREE.Box3(
        new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
        new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)),
      ),
    );
  }

  function addBoxMesh(
    parent: THREE.Object3D,
    cx: number,
    y0: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    bevel = 0.03,
    uvMul = 0.16,
  ): THREE.Mesh {
    const m = bevelBox(w, h, d, mat, bevel);
    m.position.set(cx, y0 + h * 0.5, cz);
    const uv = m.geometry.attributes.uv;
    if (uv) {
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * uvMul, uv.getY(i) * uvMul);
      }
      uv.needsUpdate = true;
    }
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function addSolidBlock(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    mat: THREE.Material,
    collide = true,
  ): THREE.Mesh {
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const d = Math.abs(z1 - z0);
    const m = addBoxMesh(staticGroup, cx, Math.min(y0, y1), cz, w, h, d, mat);
    if (collide) pushCollider(x0, y0, z0, x1, y1, z1);
    return m;
  }

  /**
   * Builds a 1 Kings 7:12 wall segment: 3 courses of costly hewn limestone + 1 top course of cedar beams.
   */
  function addCourtWallSegment(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    baseY = 0,
    courseH = 1.35,
    collide = true,
  ): void {
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const w = Math.abs(x1 - x0);
    const d = Math.abs(z1 - z0);
    // 3 dressed ashlar courses
    for (let c = 0; c < 3; c++) {
      const inset = c * 0.04;
      addBoxMesh(
        staticGroup,
        cx,
        baseY + c * courseH,
        cz,
        Math.max(0.4, w - inset * 2),
        courseH - 0.02,
        Math.max(0.4, d - inset * 2),
        mats.ashlarMat,
        0.03,
        0.18,
      );
    }
    // 1 top course of trimmed Lebanon cedar beams (1 Kgs 7:12)
    const cedarH = courseH * 0.88;
    addBoxMesh(
      staticGroup,
      cx,
      baseY + 3 * courseH,
      cz,
      w + 0.14,
      cedarH,
      d + 0.14,
      mats.darkCedarMat,
      0.04,
      0.2,
    );
    if (collide) {
      pushCollider(x0, baseY - 0.5, z0, x1, baseY + 3 * courseH + cedarH, z1);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. OPHEL & MOUNT MORIAH RIDGE + DISTANT DESERT HORIZON (ZERO HILLS IN COURT)
  // ---------------------------------------------------------------------------
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ccb690'),
    roughness: 0.94,
    metalness: 0.01,
  });
  rockProjection(ridgeMat, 52);

  const terrainSpan = 960;
  const tGeo = new THREE.PlaneGeometry(terrainSpan, terrainSpan, 144, 144);
  tGeo.rotateX(-Math.PI / 2); // +Y outward normal
  const tPos = tGeo.attributes.position!;
  for (let i = 0; i < tPos.count; i++) {
    const vx = tPos.getX(i);
    const vz = tPos.getZ(i);
    const inCourt = Math.abs(vx) <= 90.2 && vz >= -120.2 && vz <= 120.2;
    const y = ophelCubits(vx, vz, true) - (inCourt ? 0.55 : 0);
    tPos.setY(i, y);
  }
  tGeo.computeVertexNormals();
  const ridgeMesh = new THREE.Mesh(tGeo, ridgeMat);
  ridgeMesh.receiveShadow = true;
  ridgeMesh.castShadow = false;
  ridgeMesh.userData.dynamic = true;
  ridgeMesh.userData.noCast = true;
  dynamicGroup.add(ridgeMesh);

  // Far horizon desert ring pushed well outside & below so ZERO hills intrude into the Great Court
  const desert = buildDesert(() => true, 265);
  desert.scale.set(2.6, 0.85, 2.6);
  desert.position.y = -50;
  desert.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.userData.dynamic = true;
      o.userData.noCast = true;
    }
  });
  dynamicGroup.add(desert);

  // ---------------------------------------------------------------------------
  // 2. GREAT COURT PAVEMENT, SOUTH APPROACH PLAZA & 3-STONE + 1-CEDAR WALL (7:9, 12)
  // ---------------------------------------------------------------------------
  const courtSlab = new THREE.Mesh(new THREE.BoxGeometry(180, 0.5, 240), mats.pavingMat);
  courtSlab.position.set(0, -0.25, 0);
  courtSlab.receiveShadow = true;
  courtSlab.userData.dynamic = true;
  courtSlab.userData.noCast = true;
  dynamicGroup.add(courtSlab);
  pushPlatform(-90, -0.5, -120, 90, COURT_C, 120);

  // South Royal Approach Plaza outside the South Gate
  const southPlaza = new THREE.Mesh(new THREE.BoxGeometry(88, 0.4, 34), mats.plazaMat);
  southPlaza.position.set(0, OUTSIDE_C - 0.2, -137);
  southPlaza.receiveShadow = true;
  southPlaza.userData.dynamic = true;
  southPlaza.userData.noCast = true;
  dynamicGroup.add(southPlaza);
  pushPlatform(-44, OUTSIDE_C - 0.4, -154, 44, OUTSIDE_C, -120);

  // Perimeter Great Court Wall (180 x 240 c): 3 courses hewn stone + 1 course cedar beams
  // West & East perimeter walls
  addCourtWallSegment(-92.2, -121.5, -89.6, 121.5, COURT_C, 1.38, true);
  addCourtWallSegment(89.6, -121.5, 92.2, 121.5, COURT_C, 1.38, true);
  // North perimeter wall (acts as waist-high balustrade above the +3.60c Northern Overlook Terrace!)
  addCourtWallSegment(-92.2, 118.8, 92.2, 121.4, COURT_C, 1.38, true);
  // South perimeter wall split cleanly around the 14-cubit-wide South Royal Gate (X in [-7, +7])
  addCourtWallSegment(-92.2, -121.5, -11.5, -118.9, OUTSIDE_C, 1.68, true);
  addCourtWallSegment(11.5, -121.5, 92.2, -118.9, OUTSIDE_C, 1.68, true);

  // South Royal Gatehouse Piers & Cedar Architrave Lintel (clear doorway X in [-7, +7])
  addSolidBlock(-11.5, OUTSIDE_C, -122.4, -7.0, 12.6, -118.2, mats.ashlarMat, true);
  addSolidBlock(7.0, OUTSIDE_C, -122.4, 11.5, 12.6, -118.2, mats.ashlarMat, true);
  addSolidBlock(-12.2, 9.6, -122.8, 12.2, 11.4, -117.8, mats.darkCedarMat, true);
  addSolidBlock(-12.0, 11.4, -122.5, 12.0, 13.2, -118.0, mats.ashlarMat, false);
  addBoxMesh(staticGroup, 0, 13.2, -120.25, 25.0, 1.1, 5.0, mats.cedarMat);

  // 5 Walkable Limestone Steps ascending through South Royal Gate (-1.20 c -> 0.00 c)
  for (let i = 0; i < 5; i++) {
    const z0 = -125.0 + i * 1.05;
    const topY = OUTSIDE_C + (i + 1) * 0.24;
    addBoxMesh(staticGroup, 0, OUTSIDE_C - 0.1, (z0 - 118.9) * 0.5, 15.6, topY - OUTSIDE_C + 0.1, -118.9 - z0, mats.ashlarMat);
    pushPlatform(-7.8, OUTSIDE_C - 0.2, z0, 7.8, topY, -118.8);
  }

  // ---------------------------------------------------------------------------
  // 3. HOUSE OF THE FOREST OF LEBANON (100 x 50 x 30 CUBITS, 1 Kgs 7:2-5; 10:16-17, 21)
  //    Bounds: X in [-50, +50] (100c), Z in [-95, -45] (50c), Height = 30c above plinth (1.20c..31.20c)
  // ---------------------------------------------------------------------------
  // Costly 8- and 10-cubit foundation stone podium (1 Kgs 7:10)
  addBoxMesh(staticGroup, 0, -0.2, -70, 102.4, FOREST_C + 0.2, 52.4, mats.megalithMat, 0.04, 0.1);
  // Cedar floor planking across the 100 x 50 interior
  addBoxMesh(staticGroup, 0, FOREST_C - 0.08, -70, 97.0, 0.1, 47.0, mats.cedarMat, 0.01, 0.25);
  pushPlatform(-50, 0, -95, 50, FOREST_C, -45);

  // 5 Walkable Steps at South Portal (Z = -100.2 .. -95.0, X in [-8.5, +8.5])
  for (let i = 0; i < 5; i++) {
    const z0 = -100.2 + i * 1.04;
    const topY = (i + 1) * 0.24;
    addBoxMesh(staticGroup, 0, 0, (z0 - 94.8) * 0.5, 17.0, topY, -94.8 - z0, mats.ashlarMat);
    pushPlatform(-8.5, 0, z0, 8.5, topY, -94.8);
  }
  // 5 Walkable Steps at North Portal (Z = -45.0 .. -39.8, X in [-8.5, +8.5])
  for (let i = 0; i < 5; i++) {
    const z1 = -39.8 - i * 1.04;
    const topY = (i + 1) * 0.24;
    addBoxMesh(staticGroup, 0, 0, (-45.2 + z1) * 0.5, 17.0, topY, z1 + 45.2, mats.ashlarMat);
    pushPlatform(-8.5, 0, -45.2, 8.5, topY, z1);
  }

  const FH_TOP = FOREST_C + 30.0; // 31.20 c

  // East & West End Walls (X = +-50, solid costly ashlar exterior + warm cedar interior lining)
  addSolidBlock(-50.0, 0, -95.0, -48.4, FH_TOP, -45.0, mats.ashlarMat, true);
  addBoxMesh(staticGroup, -48.25, FOREST_C, -70, 0.28, 29.6, 46.8, mats.cedarMat);
  addSolidBlock(48.4, 0, -95.0, 50.0, FH_TOP, -45.0, mats.ashlarMat, true);
  addBoxMesh(staticGroup, 48.25, FOREST_C, -70, 0.28, 29.6, 46.8, mats.cedarMat);

  // South & North Long Walls (Z = -95 and Z = -45) with 15c-wide portals (X in [-7.5, +7.5])
  // Lower wall zone up to clerestory sill (Y = 0 .. 17.8 c)
  const CLERESTORY_BASE = FOREST_C + 16.6; // 17.80 c
  for (const wz of [-94.2, -45.8]) {
    const zMin = wz - 0.8;
    const zMax = wz + 0.8;
    // West & East lower wall wings flanking the central portal
    addSolidBlock(-50.0, 0, zMin, -7.5, CLERESTORY_BASE, zMax, mats.ashlarMat, true);
    addSolidBlock(7.5, 0, zMin, 50.0, CLERESTORY_BASE, zMax, mats.ashlarMat, true);
    // Squared cedar portal jambs & lintel (1 Kgs 7:5, clear headroom 14.5 c)
    addBoxMesh(staticGroup, -7.8, FOREST_C, wz, 0.9, 14.6, 2.1, mats.darkCedarMat);
    addBoxMesh(staticGroup, 7.8, FOREST_C, wz, 0.9, 14.6, 2.1, mats.darkCedarMat);
    addSolidBlock(-8.2, FOREST_C + 14.4, zMin, 8.2, CLERESTORY_BASE, zMax, mats.darkCedarMat, true);
    // Interior cedar paneling along lower walls
    const innerZ = wz < -70 ? wz + 0.88 : wz - 0.88;
    addBoxMesh(staticGroup, -28.0, FOREST_C, innerZ, 40.5, 16.4, 0.22, mats.cedarMat);
    addBoxMesh(staticGroup, 28.0, FOREST_C, innerZ, 40.5, 16.4, 0.22, mats.cedarMat);
    // Open folded cedar door leaves recessed against jambs
    for (const dx of [-6.9, 6.9]) {
      addBoxMesh(staticGroup, dx, FOREST_C, wz + (wz < -70 ? 1.5 : -1.5), 0.35, 13.8, 2.6, mats.carvedCedarMat);
    }
  }

  // 3 Tiers of Opposing Squared Clerestory Windows (1 Kgs 7:4-5: window opposite window in 3 ranks!)
  // 12 window bays across X (-41.25 .. +41.25, step 7.5 c), North directly opposite South!
  const sunBeams: { mesh: THREE.Mesh; baseOpacity: number; phase: number }[] = [];
  const sunBeamMatProto = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffe49e'),
    transparent: true,
    opacity: 0.085,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  for (const wz of [-94.2, -45.8]) {
    const zMin = wz - 0.8;
    const zMax = wz + 0.8;
    // Collider for upper clerestory wall (well above gallery head height if kept inside wall thickness!)
    pushCollider(-50.0, CLERESTORY_BASE, zMin, 50.0, FH_TOP, zMax);

    // Corner masonry piers
    addBoxMesh(staticGroup, -47.2, CLERESTORY_BASE, wz, 5.6, FH_TOP - CLERESTORY_BASE, 1.6, mats.ashlarMat);
    addBoxMesh(staticGroup, 47.2, CLERESTORY_BASE, wz, 5.6, FH_TOP - CLERESTORY_BASE, 1.6, mats.ashlarMat);

    for (let rank = 0; rank < 3; rank++) {
      const bandY = CLERESTORY_BASE + rank * 4.2;
      // Horizontal ashlar spandrel & cedar sill beam
      addBoxMesh(staticGroup, 0, bandY, wz, 88.8, 1.15, 1.6, mats.ashlarMat);
      addBoxMesh(staticGroup, 0, bandY + 1.15, wz, 89.2, 0.35, 1.85, mats.darkCedarMat);
      const winH = 2.35;
      const winY = bandY + 1.5;

      // Mullion piers between the 12 squared windows
      for (let m = 0; m <= 12; m++) {
        const mx = -45.0 + m * 7.5;
        addBoxMesh(staticGroup, mx, winY, wz, 4.1, winH, 1.6, mats.ashlarMat);
      }
      // 12 Squared Cedar Window Frames ("all doorways & windows had squared frames", 1 Kgs 7:5)
      for (let wIdx = 0; wIdx < 12; wIdx++) {
        const wx = -41.25 + wIdx * 7.5;
        // Left, right, top squared cedar casing
        addBoxMesh(staticGroup, wx - 1.55, winY, wz, 0.32, winH, 1.9, mats.darkCedarMat);
        addBoxMesh(staticGroup, wx + 1.55, winY, wz, 0.32, winH, 1.9, mats.darkCedarMat);
        addBoxMesh(staticGroup, wx, winY + winH - 0.3, wz, 3.4, 0.32, 1.9, mats.darkCedarMat);
        // Warm sky-glowing window aperture pane
        const pane = new THREE.Mesh(new THREE.BoxGeometry(2.75, winH - 0.35, 0.18), mats.windowGlowMat);
        pane.position.set(wx, winY + (winH - 0.35) * 0.5, wz);
        pane.userData.noCast = true;
        staticGroup.add(pane);
      }
      // Top cornice above rank
      addBoxMesh(staticGroup, 0, winY + winH, wz, 89.2, 0.35, 1.85, mats.darkCedarMat);
    }
    // Crowning cedar parapet beam at roof line
    addBoxMesh(staticGroup, 0, FH_TOP - 0.8, wz, 100.8, 0.95, 2.0, mats.darkCedarMat);
  }

  // Angled warm golden sunlight shafts slanting down from South clerestory windows into the cedar hall
  for (let b = 0; b < 8; b++) {
    const bx = -37.5 + b * 10.7;
    const beamMat = sunBeamMatProto.clone();
    const beamGeo = new THREE.CylinderGeometry(1.15, 2.65, 24.5, 12, 1, true);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(bx, FOREST_C + 14.8, -82.5);
    beam.rotation.x = -0.62; // slants from South high windows northward (+Z) onto nave & pillars
    beam.rotation.z = -0.14;
    beam.castShadow = false;
    beam.receiveShadow = false;
    beam.userData.noAO = true;
    beam.userData.dynamic = true;
    beam.userData.noCast = true;
    dynamicGroup.add(beam);
    sunBeams.push({ mesh: beam, baseOpacity: 0.075 + (b % 3) * 0.012, phase: b * 0.9 });
  }

  // 4 Rows of 15 Towering Lebanon Cedar Pillars (4 x 15 = 60 per MT 7:2; LXX 3x15=45 noted in Evidence)
  const rowZs = [-85.5, -77.0, -63.0, -54.5];
  const colH = 27.2;
  for (const rz of rowZs) {
    for (let i = 0; i < 15; i++) {
      const cx = -42.0 + i * 6.0;
      // Dressed stone plinth base
      addBoxMesh(staticGroup, cx, FOREST_C, rz, 2.0, 0.65, 2.0, mats.ashlarMat);
      // Towering turned Lebanon cedar shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.80, colH, 14), mats.cedarMat);
      shaft.position.set(cx, FOREST_C + 0.65 + colH * 0.5, rz);
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      staticGroup.add(shaft);
      // Bronze necking ring + carved cedar bracket capital
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.28, 14), mats.goldMat);
      ring.position.set(cx, FOREST_C + 0.65 + colH - 0.3, rz);
      staticGroup.add(ring);
      addBoxMesh(staticGroup, cx, FOREST_C + 0.65 + colH, rz, 2.35, 0.95, 2.35, mats.darkCedarMat);

      pushCollider(cx - 0.80, FOREST_C, rz - 0.80, cx + 0.80, FOREST_C + 29.0, rz + 0.80);
      counts.cedarPillars++;
    }
    // Massive longitudinal trimmed cedar architrave beam (1 Kgs 7:2)
    addBoxMesh(staticGroup, 0, FOREST_C + 28.8, rz, 96.4, 1.15, 1.5, mats.darkCedarMat);
  }

  // 15 Transverse Cedar Roof Beams + Full Coffered Cedar Roof Deck (1 Kgs 7:3)
  for (let i = 0; i < 15; i++) {
    const cx = -42.0 + i * 6.0;
    addBoxMesh(staticGroup, cx, FOREST_C + 29.2, -70, 1.1, 0.95, 47.6, mats.cedarMat);
  }
  addBoxMesh(staticGroup, 0, FH_TOP - 0.1, -70, 99.6, 0.85, 49.6, mats.cedarMat);

  // 3 Tiers x 15 = 45 Upper Cedar Side-Chamber Alcove Beams (1 Kgs 7:3: "45, 15 in a row")
  // Built as framed cedar structural chamber-bays along the North upper colonnade aisle (Z = -58.8)
  // above head height so both MT counts (4 rows of pillars AND 45 chamber-beams in 3x15) stand visibly!
  for (let tier = 0; tier < 3; tier++) {
    const ty = FOREST_C + 16.2 + tier * 4.1;
    addBoxMesh(staticGroup, 0, ty, -58.75, 90.0, 0.38, 6.8, mats.cedarMat);
    for (let b = 0; b < 15; b++) {
      const bx = -42.0 + b * 6.0;
      addBoxMesh(staticGroup, bx, ty + 0.38, -58.75, 0.42, 3.65, 6.4, mats.darkCedarMat);
      counts.sideChambers++;
    }
  }

  // ---------------------------------------------------------------------------
  // WALKABLE CEDAR STAIRWAY (+15.0 CUBITS) & UPPER CEDAR GALLERY OVERLOOK
  // ---------------------------------------------------------------------------
  // 40 wide cedar steps ascending East along the South aisle (Z in [-93.0, -88.1]):
  // Starts at X = -36.0 (Y = 1.20 c) -> reaches X = +2.0 at GALLERY_C = 16.20 c (+15.0 c net rise!)
  // Step rise = 0.375 c (0.167 m at 0.445 m, 0.197 m at 0.525 m — well under 0.50 m!)
  for (let s = 0; s < 40; s++) {
    const sx0 = -36.0 + s * 0.95;
    const sx1 = sx0 + 1.12;
    const topY = FOREST_C + (s + 1) * 0.375;
    // Visual cedar tread + stringer support
    addBoxMesh(staticGroup, (sx0 + sx1) * 0.5, topY - 0.38, -90.55, 1.12, 0.38, 4.9, mats.cedarMat);
    if (s % 4 === 0) {
      addBoxMesh(staticGroup, (sx0 + sx1) * 0.5, FOREST_C, -90.55, 0.55, topY - FOREST_C, 4.5, mats.darkCedarMat);
    }
    pushPlatform(sx0, FOREST_C, -93.0, sx1, topY, -88.1);
  }
  // Stair north-side carved cedar guardrail (guides walker cleanly up the 4.9c-wide stair)
  for (let s = 0; s < 10; s++) {
    const rx = -34.2 + s * 3.8;
    const ry = FOREST_C + (s + 0.5) * 1.5;
    addBoxMesh(staticGroup, rx, ry, -88.0, 0.35, 2.1, 0.35, mats.darkCedarMat);
    addBoxMesh(staticGroup, rx, ry + 1.85, -88.0, 3.9, 0.25, 0.38, mats.goldMat);
  }
  pushCollider(-36.0, FOREST_C, -88.15, 1.8, GALLERY_C + 1.8, -87.8);

  // Upper Cedar Gallery Deck (Y = 16.20 c, 15.0 c above hall floor):
  // 1) South-East Promenade (X: +1.8 .. +48.2, Z: -93.2 .. -87.8)
  addBoxMesh(staticGroup, 25.0, GALLERY_C - 0.55, -90.5, 46.6, 0.55, 5.5, mats.cedarMat);
  pushPlatform(1.8, GALLERY_C - 0.6, -93.2, 48.2, GALLERY_C, -87.8);
  // 2) East Grand Overlook Balcony spanning full 50-cubit hall width! (X: +42.2 .. +48.2, Z: -93.2 .. -46.8)
  addBoxMesh(staticGroup, 45.2, GALLERY_C - 0.55, -70.0, 6.2, 0.55, 46.4, mats.cedarMat);
  pushPlatform(42.2, GALLERY_C - 0.6, -93.2, 48.2, GALLERY_C, -46.8);
  // 3) North Upper Gallery Promenade (X: -48.2 .. +48.2, Z: -52.2 .. -46.8)
  addBoxMesh(staticGroup, 0.0, GALLERY_C - 0.55, -49.5, 96.4, 0.55, 5.5, mats.cedarMat);
  pushPlatform(-48.2, GALLERY_C - 0.6, -52.2, 48.2, GALLERY_C, -46.8);
  // 4) West Overlook Balcony (X: -48.2 .. -42.2, Z: -85.5 .. -46.8)
  addBoxMesh(staticGroup, -45.2, GALLERY_C - 0.55, -66.15, 6.2, 0.55, 38.7, mats.cedarMat);
  pushPlatform(-48.2, GALLERY_C - 0.6, -85.5, -42.2, GALLERY_C, -46.8);

  // Gallery Carved Cedar & Gold Balustrades (1.85 c = 0.82 m high so walker stays safely on gallery)
  const addBalustrade = (x0: number, z0: number, x1: number, z1: number) => {
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const w = Math.max(0.36, Math.abs(x1 - x0));
    const d = Math.max(0.36, Math.abs(z1 - z0));
    addBoxMesh(staticGroup, cx, GALLERY_C, cz, w, 0.35, d, mats.darkCedarMat);
    addBoxMesh(staticGroup, cx, GALLERY_C + 1.55, cz, w, 0.3, d, mats.darkCedarMat);
    addBoxMesh(staticGroup, cx, GALLERY_C + 1.85, cz, w + 0.06, 0.1, d + 0.06, mats.goldMat);
    const len = Math.max(w, d);
    const posts = Math.max(2, Math.floor(len / 2.2));
    for (let p = 0; p <= posts; p++) {
      const t = p / posts;
      const px = w >= d ? THREE.MathUtils.lerp(Math.min(x0, x1) + 0.2, Math.max(x0, x1) - 0.2, t) : cx;
      const pz = d > w ? THREE.MathUtils.lerp(Math.min(z0, z1) + 0.2, Math.max(z0, z1) - 0.2, t) : cz;
      addBoxMesh(staticGroup, px, GALLERY_C + 0.35, pz, 0.24, 1.2, 0.24, mats.cedarMat);
    }
    pushCollider(x0, GALLERY_C, z0, x1, GALLERY_C + 1.95, z1);
  };
  addBalustrade(2.2, -87.95, 42.2, -87.6); // South-East inner rail
  addBalustrade(42.0, -87.8, 42.38, -52.2); // East Balcony nave overlook rail
  addBalustrade(-42.2, -52.4, 42.2, -52.05); // North Gallery inner rail
  addBalustrade(-42.38, -85.5, -42.0, -52.2); // West Balcony nave overlook rail
  addBalustrade(-48.2, -85.7, -42.0, -85.35); // West Balcony south stop rail

  // ---------------------------------------------------------------------------
  // 200 LARGE GOLD SHIELDS + 300 GOLD BUCKLERS + PURE-GOLD VESSELS (1 Kgs 10:16-17, 21)
  // ---------------------------------------------------------------------------
  // 200 Large Beaten-Gold Shields (tsinnah, 10:16) via InstancedMesh
  const largeShieldParts: THREE.BufferGeometry[] = [];
  const lsBody = new THREE.CylinderGeometry(0.82, 0.76, 0.12, 16);
  lsBody.scale(0.72, 1.0, 1.38);
  lsBody.rotateX(Math.PI * 0.5);
  const lsBoss = new THREE.SphereGeometry(0.24, 12, 8);
  lsBoss.scale(1.0, 1.3, 0.45);
  lsBoss.translate(0, 0, 0.08);
  for (const g of [lsBody, lsBoss]) {
    const ng = g.index ? g.toNonIndexed() : g;
    largeShieldParts.push(ng);
  }
  const largeShieldGeo = mergeGeometries(largeShieldParts);
  largeShieldParts.forEach((g) => g.dispose());

  const largeShieldMesh = new THREE.InstancedMesh(largeShieldGeo, mats.goldMat, 200);
  largeShieldMesh.castShadow = true;
  largeShieldMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let lsIdx = 0;
  // 100 along South wall (50 West + 50 East in lower & upper friezes) + 100 along North wall = 200 exact!
  for (const side of [-1, 1]) {
    const wz = side < 0 ? -93.02 : -46.98;
    const rotY = side < 0 ? 0 : Math.PI;
    // 25 on West lower wall + 25 on East lower wall
    for (const wing of [-1, 1]) {
      for (let k = 0; k < 25; k++) {
        const row = k < 13 ? 0 : 1;
        const col = k < 13 ? k : k - 13;
        const span = k < 13 ? 12 : 11;
        const wx = wing * (9.8 + (col / span) * 36.2);
        // Above stair on SW wing, lift shields cleanly above stair line
        const baseY = side < 0 && wing < 0 ? FOREST_C + 10.2 + row * 3.1 : FOREST_C + 6.8 + row * 3.4;
        dummy.position.set(wx, baseY, wz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        largeShieldMesh.setMatrixAt(lsIdx++, dummy.matrix);
      }
    }
    // 50 along upper clerestory/gallery frieze (25 West + 25 East) -> Wait: we already placed 50 per side (25*2)!
    // 2 sides * 2 wings * 25 = 100! Let's place the remaining 100 along East (50) and West (50) end walls!
  }
  for (const exSide of [-1, 1]) {
    const wx = exSide < 0 ? -48.02 : 48.02;
    const rotY = exSide < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    for (let k = 0; k < 50; k++) {
      const row = Math.floor(k / 10); // 5 tiers of 10 shields across the 50-cubit cedar end walls!
      const col = k % 10;
      const wz = -90.5 + (col / 9) * 41.0;
      const wy = FOREST_C + 5.8 + row * 4.4 + (row >= 2 ? 3.2 : 0);
      dummy.position.set(wx, wy, wz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      largeShieldMesh.setMatrixAt(lsIdx++, dummy.matrix);
    }
  }
  largeShieldMesh.count = lsIdx;
  largeShieldMesh.instanceMatrix.needsUpdate = true;
  dynamicGroup.add(largeShieldMesh);
  counts.largeShields = lsIdx; // 200 exact!

  // 300 Beaten-Gold Bucklers (magen, 10:17): 5 round convex shields mounted on each of the 60 cedar pillars!
  const bucklerParts: THREE.BufferGeometry[] = [];
  const bkDisc = new THREE.CylinderGeometry(0.62, 0.58, 0.09, 16);
  bkDisc.rotateX(Math.PI * 0.5);
  const bkBoss = new THREE.SphereGeometry(0.18, 10, 8);
  bkBoss.scale(1, 1, 0.5);
  bkBoss.translate(0, 0, 0.06);
  for (const g of [bkDisc, bkBoss]) {
    bucklerParts.push(g.index ? g.toNonIndexed() : g);
  }
  const bucklerGeo = mergeGeometries(bucklerParts);
  bucklerParts.forEach((g) => g.dispose());

  const bucklerMesh = new THREE.InstancedMesh(bucklerGeo, mats.goldMat, 300);
  bucklerMesh.castShadow = true;
  bucklerMesh.receiveShadow = true;
  let bkIdx = 0;
  for (const rz of rowZs) {
    const faceNaveRot = rz < -70 ? 0 : Math.PI;
    const faceAisleRot = rz < -70 ? Math.PI : 0;
    const dzNave = rz < -70 ? 0.80 : -0.80;
    for (let i = 0; i < 15; i++) {
      const cx = -42.0 + i * 6.0;
      // 3 bucklers facing the central nave (low, mid, high) + 2 facing the side aisle = 5 per pillar x 60 = 300!
      for (const hOff of [7.2, 13.5, 20.4]) {
        dummy.position.set(cx, FOREST_C + hOff, rz + dzNave);
        dummy.rotation.set(0, faceNaveRot, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bucklerMesh.setMatrixAt(bkIdx++, dummy.matrix);
      }
      for (const hOff of [9.6, 17.6]) {
        dummy.position.set(cx, FOREST_C + hOff, rz - dzNave);
        dummy.rotation.set(0, faceAisleRot, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bucklerMesh.setMatrixAt(bkIdx++, dummy.matrix);
      }
    }
  }
  bucklerMesh.count = bkIdx;
  bucklerMesh.instanceMatrix.needsUpdate = true;
  dynamicGroup.add(bucklerMesh);
  counts.smallShields = bkIdx; // 300 exact!

  // Pure-Gold Royal Drinking Vessels on Two Carved Cedar Banquet Tables (1 Kgs 10:21)
  // Placed along nave margins Z = -74.0 and Z = -66.0 so central Z = -70 nave stays 100% open!
  for (const [tx, tz] of [
    [-18.0, -74.0],
    [18.0, -74.0],
  ] as const) {
    addBoxMesh(staticGroup, tx, FOREST_C + 1.65, tz, 7.6, 0.28, 2.2, mats.carvedCedarMat);
    addBoxMesh(staticGroup, tx, FOREST_C + 1.93, tz, 7.7, 0.06, 2.3, mats.goldMat);
    for (const lx of [-3.3, 3.3]) {
      for (const lz of [-0.85, 0.85]) {
        addBoxMesh(staticGroup, tx + lx, FOREST_C, tz + lz, 0.34, 1.65, 0.34, mats.darkCedarMat);
      }
    }
    pushCollider(tx - 3.9, FOREST_C, tz - 1.2, tx + 3.9, FOREST_C + 2.5, tz + 1.2);

    // 12 pure-gold chalices, pitchers & platters per table
    for (let v = 0; v < 12; v++) {
      const vx = tx - 3.1 + (v % 6) * 1.24;
      const vz = tz + (v < 6 ? -0.46 : 0.46);
      const isPitcher = v % 3 === 0;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(isPitcher ? 0.22 : 0.16, 0.14, isPitcher ? 0.72 : 0.46, 10),
        mats.goldMat,
      );
      stem.position.set(vx, FOREST_C + 1.99 + (isPitcher ? 0.36 : 0.23), vz);
      stem.castShadow = true;
      staticGroup.add(stem);
      counts.goldVessels++;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. PORCH OF PILLARS (50 x 30 CUBITS, 1 Kgs 7:6) + THRESHOLD CANOPY (AV)
  //    Bounds: X in [-25, +25] (50c), Z in [-22, +8] (30c), Fore-Porch Z in [-28, -22]
  // ---------------------------------------------------------------------------
  addBoxMesh(staticGroup, 0, -0.2, -7.0, 51.6, PORCH_C + 0.2, 31.2, mats.ashlarMat, 0.03, 0.14);
  addBoxMesh(staticGroup, 0, -0.2, -25.0, 33.0, PORCH_C + 0.2, 6.8, mats.ashlarMat, 0.03, 0.14);
  pushPlatform(-25, 0, -22, 25, PORCH_C, 8);
  pushPlatform(-16.5, 0, -28.4, 16.5, PORCH_C, -22);

  // 6 Walkable Limestone Steps ascending North from Great Court (Z = -34.4 .. -28.4, X in [-12, +12])
  for (let i = 0; i < 6; i++) {
    const z0 = -34.4 + i * 1.0;
    const topY = (i + 1) * 0.30;
    addBoxMesh(staticGroup, 0, 0, (z0 - 28.2) * 0.5, 24.0, topY, -28.2 - z0, mats.ashlarMat);
    pushPlatform(-12.0, 0, z0, 12.0, topY, -28.2);
  }
  // Low flanking cheek-walls beside Porch steps
  addSolidBlock(-13.8, 0, -34.4, -12.0, 2.5, -28.0, mats.ashlarMat, true);
  addSolidBlock(12.0, 0, -34.4, 13.8, 2.5, -28.0, mats.ashlarMat, true);

  const PORCH_TOP = PORCH_C + 22.0; // 23.80 c
  // Fore-Porch Columns & Heavy Carved Cedar Canopy Beam ("av", 1 Kgs 7:6)
  for (const fx of [-14.5, -9.0, 9.0, 14.5]) {
    addBoxMesh(staticGroup, fx, PORCH_C, -26.4, 1.9, 0.6, 1.9, mats.ashlarMat);
    const fc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.74, 15.6, 14), mats.cedarMat);
    fc.position.set(fx, PORCH_C + 0.6 + 7.8, -26.4);
    fc.castShadow = true;
    staticGroup.add(fc);
    addBoxMesh(staticGroup, fx, PORCH_C + 16.2, -26.4, 2.1, 0.85, 2.1, mats.darkCedarMat);
    pushCollider(fx - 0.75, PORCH_C, -27.15, fx + 0.75, PORCH_C + 17.0, -25.65);
  }
  // Projecting Threshold Canopy Entablature ("av")
  addBoxMesh(staticGroup, 0, PORCH_C + 17.05, -25.0, 34.4, 1.85, 7.2, mats.darkCedarMat);
  addBoxMesh(staticGroup, 0, PORCH_C + 18.9, -25.0, 35.2, 0.55, 7.8, mats.goldMat);

  // Double Hypostyle Colonnade inside Porch of Pillars (leaving 16.4c wide central axis!)
  for (const pz of [-20.5, -10.5, -0.5]) {
    for (const px of [-20.5, -14.8, -9.0, 9.0, 14.8, 20.5]) {
      addBoxMesh(staticGroup, px, PORCH_C, pz, 2.0, 0.65, 2.0, mats.ashlarMat);
      const pc = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.82, 19.6, 14), mats.cedarMat);
      pc.position.set(px, PORCH_C + 0.65 + 9.8, pz);
      pc.castShadow = true;
      staticGroup.add(pc);
      addBoxMesh(staticGroup, px, PORCH_C + 20.25, pz, 2.3, 0.95, 2.3, mats.darkCedarMat);
      pushCollider(px - 0.82, PORCH_C, pz - 0.82, px + 0.82, PORCH_C + 21.2, pz + 0.82);
    }
    addBoxMesh(staticGroup, 0, PORCH_C + 21.2, pz, 48.6, 0.8, 1.5, mats.darkCedarMat);
  }

  // Porch East & West Wing Walls + Coffered Roof
  addSolidBlock(-25.0, 0, -22.0, -23.5, PORCH_TOP, 8.0, mats.ashlarMat, true);
  addBoxMesh(staticGroup, -23.35, PORCH_C, -7.0, 0.25, 21.4, 28.8, mats.cedarMat);
  addSolidBlock(23.5, 0, -22.0, 25.0, PORCH_TOP, 8.0, mats.ashlarMat, true);
  addBoxMesh(staticGroup, 23.35, PORCH_C, -7.0, 0.25, 21.4, 28.8, mats.cedarMat);
  addBoxMesh(staticGroup, 0, PORCH_TOP, -7.0, 50.6, 1.1, 30.6, mats.darkCedarMat);
  addBoxMesh(staticGroup, 0, PORCH_TOP + 1.1, -7.0, 51.2, 0.7, 31.2, mats.ashlarMat);

  // North Partition Wall between Porch of Pillars and Hall of the Throne (clear 14c portal X in [-7, +7])
  addSolidBlock(-25.0, 0, 6.6, -7.0, PORCH_TOP + 1.5, 8.2, mats.ashlarMat, true);
  addSolidBlock(7.0, 0, 6.6, 25.0, PORCH_TOP + 1.5, 8.2, mats.ashlarMat, true);
  addSolidBlock(-7.6, PORCH_C + 15.2, 6.5, 7.6, PORCH_TOP + 1.5, 8.3, mats.darkCedarMat, true);

  // ---------------------------------------------------------------------------
  // 5. HALL OF THE THRONE / PORCH OF JUDGMENT (1 Kgs 7:7) & IVORY-GOLD LION THRONE (10:18-20)
  //    Bounds: X in [-20, +20] (40c), Z in [+8, +44] (36c), Height = 24c above 2.40c floor
  // ---------------------------------------------------------------------------
  // 2 Threshold Steps from Porch (1.80c) up into Hall of Judgment (2.40c)
  addBoxMesh(staticGroup, 0, PORCH_C, 8.5, 14.0, 0.30, 1.0, mats.ashlarMat);
  pushPlatform(-7.0, PORCH_C, 8.0, 7.0, PORCH_C + 0.30, 9.2);
  addBoxMesh(staticGroup, 0, PORCH_C, 9.5, 14.0, 0.60, 1.0, mats.ashlarMat);
  pushPlatform(-7.0, PORCH_C, 9.0, 7.0, THRONE_C, 10.2);

  // Hall Podium + Floor-to-Rafter Cedar Floor & Coffered Paneling ("from floor to rafters", 1 Kgs 7:7)
  addBoxMesh(staticGroup, 0, -0.2, 26.0, 41.2, THRONE_C + 0.2, 36.4, mats.ashlarMat, 0.03, 0.14);
  addBoxMesh(staticGroup, 0, THRONE_C - 0.06, 26.5, 37.2, 0.08, 33.4, mats.cedarMat, 0.01, 0.22);
  // Royal crimson-and-gold axial runner leading up to the 6 Throne steps
  addBoxMesh(staticGroup, 0, THRONE_C + 0.01, 18.0, 6.6, 0.04, 16.0, mats.royalCarpetMat, 0.005, 0.2);
  pushPlatform(-20, 0, 9.8, 20, THRONE_C, 44.0);

  const HALL_TOP = THRONE_C + 24.0; // 26.40 c

  // North Rear Wall behind Throne (Z in [42.4, 44.0]) — solid stone outside, full carved cedar + gold fillets inside
  addSolidBlock(-20.0, 0, 42.4, 20.0, HALL_TOP, 44.0, mats.ashlarMat, true);
  addBoxMesh(staticGroup, 0, THRONE_C, 42.18, 37.2, 23.6, 0.32, mats.carvedCedarMat, 0.02, 0.22);

  // West & East Walls (X = +-20) with 7-cubit clear royal doors (Z in [17.0, 24.0]) + exterior 8-step stairs!
  for (const sx of [-1, 1]) {
    const xOut = sx * 20.0;
    const xIn = sx * 18.5;
    // South segment (Z: 8.0 .. 17.0) & North segment (Z: 24.0 .. 44.0)
    addSolidBlock(xOut, 0, 8.0, xIn, HALL_TOP, 17.0, mats.ashlarMat, true);
    addSolidBlock(xOut, 0, 24.0, xIn, HALL_TOP, 44.0, mats.ashlarMat, true);
    addSolidBlock(xOut, THRONE_C + 13.0, 17.0, xIn, HALL_TOP, 24.0, mats.darkCedarMat, true);

    // Interior floor-to-rafter carved cedar paneling
    const panelX = sx * 18.32;
    addBoxMesh(staticGroup, panelX, THRONE_C, 12.6, 0.28, 23.4, 8.8, mats.carvedCedarMat, 0.02, 0.22);
    addBoxMesh(staticGroup, panelX, THRONE_C, 33.2, 0.28, 23.4, 18.2, mats.carvedCedarMat, 0.02, 0.22);
    addBoxMesh(staticGroup, panelX, THRONE_C + 13.0, 20.5, 0.28, 10.4, 7.0, mats.carvedCedarMat, 0.02, 0.22);

    // Exterior 8-step stairs descending from side portal (2.40 c) to Great Court (0.0 c)
    for (let st = 0; st < 8; st++) {
      const topY = THRONE_C - st * 0.30;
      const xa = sx * (20.0 + st * 0.95);
      const xb = sx * (20.0 + (st + 1) * 0.95 + 0.12);
      addBoxMesh(staticGroup, (xa + xb) * 0.5, 0, 20.5, Math.abs(xb - xa), topY, 7.2, mats.ashlarMat);
      pushPlatform(xa, 0, 16.9, xb, topY, 24.1);
    }

    // High clerestory window apertures in Hall of Judgment
    for (let w = 0; w < 3; w++) {
      const wz = 27.5 + w * 5.5;
      const wpane = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.6, 2.2), mats.windowGlowMat);
      wpane.position.set(sx * 18.1, THRONE_C + 18.8, wz);
      wpane.userData.noCast = true;
      staticGroup.add(wpane);
    }
  }

  // Carved Cedar Coffered Rafters & Ceiling in Hall of Judgment (1 Kgs 7:7)
  for (let r = 0; r < 7; r++) {
    const rz = 11.5 + r * 5.0;
    addBoxMesh(staticGroup, 0, HALL_TOP - 1.1, rz, 37.6, 0.95, 0.95, mats.darkCedarMat);
    addBoxMesh(staticGroup, 0, HALL_TOP - 1.16, rz, 37.6, 0.1, 0.3, mats.goldMat);
  }
  addBoxMesh(staticGroup, 0, HALL_TOP - 0.15, 26.0, 40.4, 0.9, 36.4, mats.cedarMat);
  addBoxMesh(staticGroup, 0, HALL_TOP + 0.75, 26.0, 41.0, 0.65, 37.0, mats.ashlarMat);

  // Golden clerestory light shaft illuminating Solomon's Ivory-and-Gold Throne (noAO = true)
  const throneShaftMat = sunBeamMatProto.clone();
  throneShaftMat.opacity = 0.11;
  const throneShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 4.2, 21.5, 16, 1, true), throneShaftMat);
  throneShaft.position.set(3.5, THRONE_C + 12.2, 35.6);
  throneShaft.rotation.z = 0.32;
  throneShaft.userData.noAO = true;
  throneShaft.userData.dynamic = true;
  throneShaft.userData.noCast = true;
  dynamicGroup.add(throneShaft);
  sunBeams.push({ mesh: throneShaft, baseOpacity: 0.11, phase: 2.1 });

  // ---------------------------------------------------------------------------
  // SOLOMON'S GREAT IVORY THRONE OVERLAID WITH PURE GOLD (1 Kgs 10:18-20; 2 Chr 9:17-19)
  // ---------------------------------------------------------------------------
  const lionGeo = createStandingLionGeometry();
  const placeGoldenLion = (x: number, y: number, z: number, rotY: number, scale = 1.0) => {
    const lion = new THREE.Mesh(lionGeo.clone(), mats.goldMat);
    lion.position.set(x, y, z);
    lion.rotation.y = rotY;
    lion.scale.setScalar(scale);
    lion.castShadow = true;
    lion.receiveShadow = true;
    staticGroup.add(lion);
  };

  // 6 Walkable Ascending Steps (Z = 26.0 .. 33.2, each 1.20c deep x 0.36c rise) + 12 Standing Golden Lions!
  for (let s = 0; s < 6; s++) {
    const z0 = 26.0 + s * 1.20;
    const topY = THRONE_C + (s + 1) * 0.36;
    // Ivory step riser framed in pure gold, extending back under dais
    addBoxMesh(staticGroup, 0, THRONE_C, (z0 + 33.4) * 0.5, 13.0, topY - THRONE_C, 33.4 - z0, mats.ivoryMat);
    addBoxMesh(staticGroup, 0, topY - 0.07, z0 + 0.1, 13.08, 0.08, 0.22, mats.goldMat);
    // Royal runner up central 5.6-cubit walkable path
    addBoxMesh(staticGroup, 0, topY - 0.01, z0 + 0.6, 5.6, 0.03, 1.2, mats.royalCarpetMat);

    pushPlatform(-6.5, THRONE_C, z0, 6.5, topY, 33.4);
    counts.throneSteps++;

    // Two standing golden lions on each step (left X = -5.35, right X = +5.35 -> 12 step lions, 1 Kgs 10:20!)
    // Facing south (-Z, rotY = Math.PI) with slight inward regal turn toward approaching supplicants!
    placeGoldenLion(-5.35, topY, z0 + 0.62, Math.PI - 0.18, 0.96);
    placeGoldenLion(5.35, topY, z0 + 0.62, -Math.PI + 0.18, 0.96);
    counts.stepLions += 2;

    // Small pedestal colliders around the outer lion rows, leaving X in [-4.4, +4.4] (8.8c = 3.9m) wide open!
    pushCollider(-6.4, topY, z0, -4.45, topY + 2.2, z0 + 1.2);
    pushCollider(4.45, topY, z0, 6.4, topY + 2.2, z0 + 1.2);
  }

  // Throne Dais Platform (X in [-7.5, +7.5], Z in [33.2, 40.8], Y = DAIS_C = 4.56 c)
  addBoxMesh(staticGroup, 0, THRONE_C, 37.0, 15.0, DAIS_C - THRONE_C, 7.6, mats.ivoryMat);
  addBoxMesh(staticGroup, 0, DAIS_C - 0.08, 37.0, 15.14, 0.1, 7.74, mats.goldMat);
  pushPlatform(-7.5, THRONE_C, 33.2, 7.5, DAIS_C, 40.8);
  // Side balustrades on Dais so walker doesn't drop 2.16c off Dais sides accidentally
  addSolidBlock(-7.5, DAIS_C, 33.4, -7.1, DAIS_C + 1.85, 40.8, mats.goldMat, true);
  addSolidBlock(7.1, DAIS_C, 33.4, 7.5, DAIS_C + 1.85, 40.8, mats.goldMat, true);

  // Golden Footstool Fastened to the Throne (2 Chr 9:18: "a footstool of gold attached to the throne")
  addBoxMesh(staticGroup, 0, DAIS_C, 35.35, 2.4, 0.52, 1.35, mats.goldMat);
  addBoxMesh(staticGroup, 0, DAIS_C + 0.52, 35.35, 2.1, 0.12, 1.1, mats.ivoryMat);

  // Great Ivory Throne Seat, Carved Armrests ("yadot") & Rounded Back ("rosh agol", 1 Kgs 10:18-19)
  // Throne base plinth
  addBoxMesh(staticGroup, 0, DAIS_C, 37.2, 4.2, 0.55, 2.8, mats.goldMat);
  // Ivory seat frame & cushion
  addBoxMesh(staticGroup, 0, DAIS_C + 0.55, 37.1, 3.3, 1.15, 2.3, mats.ivoryMat);
  addBoxMesh(staticGroup, 0, DAIS_C + 1.70, 37.05, 3.0, 0.28, 2.05, mats.royalCarpetMat);
  // Armrests (yadot) overlaid in gold + ivory panels
  for (const ax of [-1.52, 1.52]) {
    addBoxMesh(staticGroup, ax, DAIS_C + 1.70, 37.05, 0.34, 1.05, 2.2, mats.ivoryMat);
    addBoxMesh(staticGroup, ax, DAIS_C + 2.75, 37.05, 0.42, 0.18, 2.35, mats.goldMat);
  }
  // Rounded Back of the Throne (1 Kgs 10:19: "the throne had a rounded top behind it")
  addBoxMesh(staticGroup, 0, DAIS_C + 1.70, 38.12, 3.36, 3.2, 0.42, mats.ivoryMat);
  addBoxMesh(staticGroup, 0, DAIS_C + 1.70, 38.34, 3.52, 3.25, 0.14, mats.goldMat);
  // Arched semicircular ivory-and-gold crown (Cylinder along Z axis)
  const roundTopIvory = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.42, 24, 1, false, 0, Math.PI), mats.ivoryMat);
  roundTopIvory.rotation.z = Math.PI * 0.5;
  roundTopIvory.rotation.y = Math.PI * 0.5;
  roundTopIvory.position.set(0, DAIS_C + 4.90, 38.12);
  roundTopIvory.castShadow = true;
  staticGroup.add(roundTopIvory);

  const roundTopGold = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.16, 12, 28, Math.PI), mats.goldMat);
  roundTopGold.position.set(0, DAIS_C + 4.90, 38.12);
  roundTopGold.castShadow = true;
  staticGroup.add(roundTopGold);

  // Two Standing Golden Lions beside the Armrests (1 Kgs 10:19)!
  placeGoldenLion(-2.25, DAIS_C + 0.55, 37.0, Math.PI, 1.08);
  placeGoldenLion(2.25, DAIS_C + 0.55, 37.0, Math.PI, 1.08);
  counts.armrestLions = 2;
  lionGeo.dispose();

  // Collider around Throne & Armrest Lions (leaving Z in [33.2, 34.6] in front of footstool walkable!)
  pushCollider(-2.9, DAIS_C, 34.7, 2.9, DAIS_C + 7.2, 38.8);

  // ---------------------------------------------------------------------------
  // 6. INNER COURTYARD GATE & FACADE TOWARD SOLOMON'S OWN HOUSE (1 Kgs 7:8)
  //    Bounds: X in [-78, -16], Z in [+54, +86] (explicitly unmeasured in 1 Kgs 7:8)
  // ---------------------------------------------------------------------------
  // 3-stone + 1-cedar Inner Court Wall with open 8-cubit bronze-and-cedar portal at X in [-51, -43]
  addCourtWallSegment(-78.0, 53.6, -51.0, 55.4, COURT_C, 1.32, true);
  addCourtWallSegment(-43.0, 53.6, -16.0, 55.4, COURT_C, 1.32, true);
  addCourtWallSegment(-78.0, 53.6, -76.2, 86.0, COURT_C, 1.32, true);
  addCourtWallSegment(-17.8, 53.6, -16.0, 86.0, COURT_C, 1.32, true);

  // Inner Courtyard Gate Piers & Cedar Architrave (X in [-51, -43] clear!)
  addSolidBlock(-53.2, COURT_C, 53.2, -51.0, 10.5, 55.8, mats.ashlarMat, true);
  addSolidBlock(-43.0, COURT_C, 53.2, -40.8, 10.5, 55.8, mats.ashlarMat, true);
  addSolidBlock(-53.8, 8.6, 53.0, -40.2, 10.6, 56.0, mats.darkCedarMat, true);
  // Open bronze-overlaid cedar gate leaves
  addBoxMesh(staticGroup, -50.5, COURT_C, 56.6, 0.32, 8.2, 3.2, mats.bronzeMat);
  addBoxMesh(staticGroup, -43.5, COURT_C, 56.6, 0.32, 8.2, 3.2, mats.bronzeMat);

  // Exterior Colonnaded Facade of Solomon's Own Residence & House of Pharaoh's Daughter (Z = 69..86)
  // Rendered honestly as an exterior porticoed massing rather than an invented room layout (1 Kgs 7:8)
  addSolidBlock(-76.2, COURT_C, 69.5, -17.8, 16.8, 86.0, mats.ashlarMat, true);
  addBoxMesh(staticGroup, -47.0, 15.2, 69.3, 58.6, 1.6, 1.2, mats.darkCedarMat);
  // Cedar portico colonnade across residence courtyard facade
  for (let i = 0; i < 7; i++) {
    const rx = -68.0 + i * 7.0;
    const rc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.66, 12.6, 12), mats.cedarMat);
    rc.position.set(rx, 6.8, 66.8);
    rc.castShadow = true;
    staticGroup.add(rc);
    addBoxMesh(staticGroup, rx, 0, 66.8, 1.6, 0.5, 1.6, mats.ashlarMat);
    pushCollider(rx - 0.65, 0, 66.15, rx + 0.65, 13.5, 67.45);
  }
  addBoxMesh(staticGroup, -47.0, 13.1, 68.0, 48.0, 1.1, 3.4, mats.darkCedarMat);

  // ---------------------------------------------------------------------------
  // 7. NORTHERN STEPPED OVERLOOK TERRACE (1 Kgs 7:12; 10:5) & SOLOMON'S TEMPLE VISTA
  // ---------------------------------------------------------------------------
  // 12 Walkable Limestone Steps ascending North from Z = 90.0 to Z = 104.4 (X in [-24, +24], rise = 0.30 c)
  for (let i = 0; i < 12; i++) {
    const z0 = 90.0 + i * 1.20;
    const topY = (i + 1) * 0.30;
    addBoxMesh(staticGroup, 0, 0, (z0 + 104.6) * 0.5, 48.0, topY, 104.6 - z0, mats.ashlarMat);
    pushPlatform(-24.0, 0, z0, 24.0, topY, 104.6);
  }
  // Retaining cheek walls flanking the 12 steps
  addSolidBlock(-25.8, 0, 90.0, -24.0, 4.2, 104.4, mats.ashlarMat, true);
  addSolidBlock(24.0, 0, 90.0, 25.8, 4.2, 104.4, mats.ashlarMat, true);

  // Panoramic Northern Overlook Terrace (X in [-45, +45], Z in [104.4, 118.8], Y = TERRACE_C = 3.60 c)
  addBoxMesh(staticGroup, 0, 0, 111.6, 90.0, TERRACE_C, 14.4, mats.ashlarMat, 0.03, 0.14);
  addBoxMesh(staticGroup, 0, TERRACE_C - 0.06, 111.6, 88.6, 0.08, 13.8, mats.pavingMat, 0.01, 0.18);
  pushPlatform(-45.0, 0, 104.4, 45.0, TERRACE_C, 118.8);
  // Terrace side & south-wing parapets so walker cannot drop off the 3.60c terrace sides
  addSolidBlock(-45.6, 0, 104.2, -44.6, TERRACE_C + 2.0, 119.0, mats.ashlarMat, true);
  addSolidBlock(44.6, 0, 104.2, 45.6, TERRACE_C + 2.0, 119.0, mats.ashlarMat, true);
  addSolidBlock(-45.0, TERRACE_C, 104.2, -24.0, TERRACE_C + 1.9, 104.9, mats.ashlarMat, true);
  addSolidBlock(24.0, TERRACE_C, 104.2, 45.0, TERRACE_C + 1.9, 104.9, mats.ashlarMat, true);

  // Bronze Decorative Braziers along the Great Court & Northern Terrace
  for (const [bx, by, bz] of [
    [-10.5, COURT_C, -102.0],
    [10.5, COURT_C, -102.0],
    [-15.0, COURT_C, -35.5],
    [15.0, COURT_C, -35.5],
    [-20.0, TERRACE_C, 116.5],
    [20.0, TERRACE_C, 116.5],
  ] as const) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 2.2, 10), mats.bronzeMat);
    stand.position.set(bx, by + 1.1, bz);
    stand.castShadow = true;
    staticGroup.add(stand);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.45, 0.55, 12), mats.bronzeMat);
    bowl.position.set(bx, by + 2.35, bz);
    staticGroup.add(bowl);
    const coal = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mats.emberMat);
    coal.scale.set(1, 0.35, 1);
    coal.position.set(bx, by + 2.55, bz);
    coal.userData.noAO = true;
    coal.userData.dynamic = true;
    dynamicGroup.add(coal);
    pushCollider(bx - 0.75, by, bz - 0.75, bx + 0.75, by + 2.8, bz + 0.75);
  }

  // ---------------------------------------------------------------------------
  // 8. SOLOMON'S TEMPLE RISING ON THE NORTHERN MOUNT MORIAH RIDGE (1 Kgs 6-7; 7:12; 10:5)
  //    Oriented East (+X) on the summit platform (Z = 175..275, Y_base = +18.0 c)
  // ---------------------------------------------------------------------------
  const TM_Y = 18.0;
  // King's Stepped Stone Ascent Viaduct ("his ascent by which he went up to the house of Yahweh", 1 Kgs 10:5)
  for (let v = 0; v < 14; v++) {
    const vz = 123.5 + v * 3.7;
    const vy = 1.0 + (v / 13) * (TM_Y - 1.0);
    addBoxMesh(staticGroup, 0, vy - 5.0, vz, 14.0, 5.2, 4.0, mats.ashlarMat, 0.03, 0.12);
    addBoxMesh(staticGroup, -6.6, vy + 0.2, vz, 0.8, 1.5, 4.0, mats.ashlarMat);
    addBoxMesh(staticGroup, 6.6, vy + 0.2, vz, 0.8, 1.5, 4.0, mats.ashlarMat);
  }

  // Temple Mount Summit Platform & Inner Court Wall (3 stone courses + 1 cedar course, 1 Kgs 6:36; 7:12)
  addBoxMesh(staticGroup, 8.0, TM_Y - 8.0, 224.0, 132.0, 8.0, 96.0, mats.megalithMat, 0.04, 0.08);
  addCourtWallSegment(-58.0, 176.0, -7.5, 178.4, TM_Y, 1.35, false);
  addCourtWallSegment(7.5, 176.0, 74.0, 178.4, TM_Y, 1.35, false);
  addCourtWallSegment(-58.0, 270.0, 74.0, 272.4, TM_Y, 1.35, false);
  addCourtWallSegment(-58.0, 176.0, -55.6, 272.4, TM_Y, 1.35, false);
  addCourtWallSegment(71.6, 176.0, 74.0, 272.4, TM_Y, 1.35, false);
  // Temple South Inner Court Gatehouse
  addBoxMesh(staticGroup, -9.5, TM_Y, 177.2, 4.0, 11.0, 4.2, mats.ashlarMat);
  addBoxMesh(staticGroup, 9.5, TM_Y, 177.2, 4.0, 11.0, 4.2, mats.ashlarMat);
  addBoxMesh(staticGroup, 0, TM_Y + 9.2, 177.2, 23.5, 2.2, 4.6, mats.darkCedarMat);

  // Solomon's Temple Sanctuary (60 x 20 x 30 cubits, 1 Kgs 6:2) on raised 2-cubit stylobate (Y = 20..50 c)
  const T_FLOOR = TM_Y + 2.2;
  addBoxMesh(staticGroup, -4.0, TM_Y, 224.0, 76.0, 2.2, 38.0, mats.ashlarMat);
  // Main 60 x 20 x 30 Sanctuary Body (X: -36..+24, Z: 214..234)
  addBoxMesh(staticGroup, -6.0, T_FLOOR, 224.0, 60.0, 30.0, 20.0, mats.ashlarMat, 0.04, 0.12);
  addBoxMesh(staticGroup, -6.0, T_FLOOR + 29.2, 224.0, 61.2, 1.4, 21.2, mats.goldMat);
  // 3-Story Stepped Cedar Side Chambers (5, 6, 7 cubits wide, each 5 cubits high = 15c, 1 Kgs 6:5-10)
  for (let st = 0; st < 3; st++) {
    const w = 20.0 + (5 + st) * 2;
    addBoxMesh(staticGroup, -10.0, T_FLOOR + st * 5.2, 224.0, 65.0 + st * 1.2, 5.1, w, mats.cedarMat, 0.03, 0.15);
  }
  // Gilded East Ulam Porch (20 wide x 10 deep x 30 high, X: +24..+34, 1 Kgs 6:3; 2 Chr 3:4)
  addBoxMesh(staticGroup, 29.0, T_FLOOR, 224.0, 10.0, 30.0, 20.0, mats.ashlarMat, 0.04, 0.12);
  addBoxMesh(staticGroup, 34.1, T_FLOOR + 1.0, 224.0, 0.5, 24.0, 11.0, mats.goldMat);

  // Jachin & Boaz (18c bronze shafts + 5c lily capitals = 23c, 1 Kgs 7:15-22)
  for (const pz of [217.0, 231.0]) {
    addBoxMesh(staticGroup, 36.8, T_FLOOR, pz, 3.2, 1.2, 3.2, mats.ashlarMat);
    const bShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.95, 18.0, 16), mats.bronzeMat);
    bShaft.position.set(36.8, T_FLOOR + 1.2 + 9.0, pz);
    bShaft.castShadow = true;
    staticGroup.add(bShaft);
    const bCap = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.8, 5.0, 16), mats.bronzeMat);
    bCap.position.set(36.8, T_FLOOR + 19.2 + 2.5, pz);
    staticGroup.add(bCap);
  }

  // Molten Bronze Sea (10c diameter x 5c high, 1 Kgs 7:23-26) at SE of Temple
  const seaBowl = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 3.6, 5.0, 20), mats.bronzeMat);
  seaBowl.position.set(42.0, TM_Y + 4.2, 204.0);
  staticGroup.add(seaBowl);
  addBoxMesh(staticGroup, 42.0, TM_Y, 204.0, 7.6, 1.8, 7.6, mats.bronzeMat);

  // 20 x 20 x 10 Bronze Altar (2 Chr 4:1) at X = +54, Z = +224 + Sacrificial Ember & Rising Smoke
  addBoxMesh(staticGroup, 54.0, TM_Y, 224.0, 20.0, 6.0, 20.0, mats.bronzeMat);
  addBoxMesh(staticGroup, 54.0, TM_Y + 6.0, 224.0, 16.0, 4.0, 16.0, mats.bronzeMat);
  const altarGlow = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.6, 12.0), mats.emberMat);
  altarGlow.position.set(54.0, TM_Y + 10.2, 224.0);
  altarGlow.userData.noAO = true;
  altarGlow.userData.dynamic = true;
  dynamicGroup.add(altarGlow);

  const smokePuffs: { sprite: THREE.Sprite; baseY: number; phase: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const smMat = new THREE.SpriteMaterial({
      map: mats.smokeTex,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(smMat);
    sp.position.set(54.0 + (i % 2 - 0.5) * 2.0, TM_Y + 11.5, 224.0 + ((i % 3) - 1) * 1.6);
    sp.userData.noAO = true;
    sp.userData.dynamic = true;
    dynamicGroup.add(sp);
    smokePuffs.push({ sprite: sp, baseY: TM_Y + 11.5, phase: i / 6 });
  }

  // ---------------------------------------------------------------------------
  // 9. WARM INTERIOR POINT LIGHTS (SCALED DYNAMICALLY WITH CUBIT)
  // ---------------------------------------------------------------------------
  const forestWestLight = new THREE.PointLight('#ffd89a', 18, 62, 1.5);
  forestWestLight.position.set(-22, FOREST_C + 14.0, -70);
  unitGroup.add(forestWestLight);

  const forestEastLight = new THREE.PointLight('#ffd89a', 18, 62, 1.5);
  forestEastLight.position.set(22, FOREST_C + 14.0, -70);
  unitGroup.add(forestEastLight);

  const porchLight = new THREE.PointLight('#ffe2b0', 14, 48, 1.5);
  porchLight.position.set(0, PORCH_C + 12.0, -8);
  unitGroup.add(porchLight);

  const throneLight = new THREE.PointLight('#ffdf96', 22, 52, 1.4);
  throneLight.position.set(0, THRONE_C + 11.5, 31.5);
  unitGroup.add(throneLight);

  // Batch all static architectural geometry into minimal GPU draw calls
  batchStatic(staticGroup);

  let currentCubit = initialCubit;
  const syncScaledBoxes = (cubitVal: number) => {
    colliders.length = 0;
    for (const b of rawColliders) {
      colliders.push(
        new THREE.Box3(b.min.clone().multiplyScalar(cubitVal), b.max.clone().multiplyScalar(cubitVal)),
      );
    }
    platforms.length = 0;
    for (const p of rawPlatforms) {
      platforms.push(
        new THREE.Box3(p.min.clone().multiplyScalar(cubitVal), p.max.clone().multiplyScalar(cubitVal)),
      );
    }
    unitGroup.scale.setScalar(cubitVal);
    forestWestLight.distance = 62 * cubitVal;
    forestEastLight.distance = 62 * cubitVal;
    porchLight.distance = 48 * cubitVal;
    throneLight.distance = 52 * cubitVal;
  };

  syncScaledBoxes(currentCubit);

  const result: SolomonPalace = {
    group: root,
    colliders,
    platforms,
    counts,
    CUBIT: currentCubit,
    OUTSIDE_Y: OUTSIDE_C * currentCubit,
    COURT_Y: COURT_C * currentCubit,
    FOREST_Y: FOREST_C * currentCubit,
    GALLERY_Y: GALLERY_C * currentCubit,
    PORCH_Y: PORCH_C * currentCubit,
    THRONE_Y: THRONE_C * currentCubit,
    DAIS_Y: DAIS_C * currentCubit,
    TERRACE_Y: TERRACE_C * currentCubit,
    floorY(x: number, z: number): number {
      return ophelCubits(x / result.CUBIT, z / result.CUBIT) * result.CUBIT;
    },
    rescale(newCubit: number): number {
      const clamped = Math.max(0.4, Math.min(0.6, newCubit));
      currentCubit = clamped;
      result.CUBIT = clamped;
      result.OUTSIDE_Y = OUTSIDE_C * clamped;
      result.COURT_Y = COURT_C * clamped;
      result.FOREST_Y = FOREST_C * clamped;
      result.GALLERY_Y = GALLERY_C * clamped;
      result.PORCH_Y = PORCH_C * clamped;
      result.THRONE_Y = THRONE_C * clamped;
      result.DAIS_Y = DAIS_C * clamped;
      result.TERRACE_Y = TERRACE_C * clamped;
      syncScaledBoxes(clamped);
      return clamped;
    },
    update(_dt: number, elapsed: number): void {
      // Subtle sunbeam shimmer inside House of the Forest & Hall of Judgment
      for (const b of sunBeams) {
        const mat = b.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = b.baseOpacity * (0.88 + 0.12 * Math.sin(elapsed * 0.95 + b.phase));
      }
      // Brazier & Temple Altar ember pulse
      mats.emberMat.emissiveIntensity = 1.45 + Math.sin(elapsed * 3.2) * 0.25;
      // Distant Temple Bronze Altar rising sacrificial smoke
      for (const p of smokePuffs) {
        const cycle = (elapsed * 0.22 + p.phase) % 1;
        p.sprite.position.y = p.baseY + cycle * 16;
        const sm = p.sprite.material as THREE.SpriteMaterial;
        sm.opacity = Math.sin(cycle * Math.PI) * 0.3;
        const sc = 5.0 + cycle * 6.5;
        p.sprite.scale.set(sc, sc, 1);
      }
    },
  };

  return result;
}
