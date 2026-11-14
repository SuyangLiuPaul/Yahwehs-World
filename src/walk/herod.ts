import * as THREE from 'three';
import { batchStatic, bevelBox, hanging } from './craft';
import { rockProjection } from './materials';
import { buildHerodTextures } from './herod-tex';

export interface HerodCounts {
  royalStoaColumns: number;
  soregStelae: number;
  treasuryChests: number;
  sukkotLamps: number;
  leviticalSteps: number;
  sanctuaryCubits: number;
}

export interface HerodTemple {
  group: THREE.Group;
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  counts: HerodCounts;
  CUBIT: number;
  HULDA_PLAZA_Y: number;
  GENTILES_Y: number;
  CHEL_Y: number;
  WOMEN_Y: number;
  ISRAEL_Y: number;
  PRIESTS_Y: number;
  TEMPLE_Y: number;
  ANTONIA_Y: number;
  floorY: (x: number, z: number) => number;
  rescale: (newCubit: number) => number;
  update: (dt: number, elapsed: number) => void;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const HULDA_PLAZA_C = -10.0;
const HULDA_TUNNEL_C = -5.2;
const GENTILES_C = 0.0;
const CHEL_C = 2.8; // 14 steps * 0.20 c
const WOMEN_C = 3.8; // +5 steps * 0.20 c
const ISRAEL_C = 6.8; // +15 semicircular steps * 0.20 c
const PRIESTS_C = 7.55; // +3 Duchan steps * 0.25 c
const ALTAR_TOP_C = 16.55; // PRIESTS_C + 9.0 c
const TEMPLE_C = 13.55; // PRIESTS_C + 12 steps * 0.50 c
const ANTONIA_C = 8.0; // 32 steps * 0.25 c

/**
 * First-century Jerusalem topography in CUBITS around the 530x530 Temple Mount
 * (X = -230..+300, Z = -340..+190).
 *
 * When `visual = true`, the terrain mesh sits cleanly at -28 c inside the retaining-wall
 * footprint so ZERO hills can ever protrude through the Temple Mount pavement!
 * When `visual = false`, returns the smooth physics base ground height (`<= 0.65` gradient
 * everywhere so `Walker.tryMove` never hits an artificial ground-cliff check).
 */
export function jerusalemTerrainCubits(cx: number, cz: number, visual = false): number {
  // 1. Inside the Temple Mount Retaining Wall box (X = -232..+302, Z = -346..+192)
  if (cx >= -232 && cx <= 302 && cz >= -346 && cz <= 192) {
    if (visual) {
      return -28.0;
    }
    // Smooth depression beneath the Double (-59..-37) & Triple (+33..+67) Hulda tunnels/stairwells
    // so downstairs pilgrims stand at -5.20 c while upstairs Royal Stoa walkers ride the 0.0 platform
    // with ground gradient <= 0.58 << MAX_CLIMB (1.0).
    if (cz <= -250) {
      const doubleWeight =
        smoothstep(-68, -59, cx) * (1 - smoothstep(-37, -28, cx));
      const tripleWeight =
        smoothstep(24, 33, cx) * (1 - smoothstep(67, 76, cx));
      const w = Math.max(doubleWeight, tripleWeight);
      if (w > 0) {
        let tunnelY = HULDA_TUNNEL_C;
        if (cz > -284) {
          tunnelY = HULDA_TUNNEL_C * (1 - Math.min(1, (cz - -284) / 26));
        }
        return tunnelY * w;
      }
    }
    return GENTILES_C;
  }

  // 2. Southern Hulda Pilgrim Approach Plaza & Steps (Z = -418..-346, X = -105..+105)
  if (cz < -346 && cz >= -430 && Math.abs(cx) <= 118) {
    const xBlend = 1 - smoothstep(92, 118, Math.abs(cx));
    let southH = HULDA_PLAZA_C;
    if (cz > -376) {
      // Smoothly rises beneath the 20 Southern Hulda steps (-376..-346: -10.0 -> -5.20 c)
      if (visual) {
        southH = HULDA_PLAZA_C - 0.35;
      } else {
        southH = HULDA_PLAZA_C + ((cz - -376) / 30) * (HULDA_TUNNEL_C - HULDA_PLAZA_C);
      }
    } else if (cz < -406) {
      // Ophel pilgrim road sloping gently south toward Siloam
      southH = HULDA_PLAZA_C - (( -406 - cz) / 24) * 8.0;
    } else if (visual) {
      southH = HULDA_PLAZA_C - 0.3;
    }
    const valleyDrop = -36 - smoothstep(-346, -430, cz) * 14;
    return southH * xBlend + valleyDrop * (1 - xBlend);
  }

  // 3. Surrounding Valleys & Ridges (Kidron + Mount of Olives East, Tyropoeon + Upper City West, Ophel South, Bezetha North)
  const dxEast = Math.max(0, cx - 302);
  const dxWest = Math.max(0, -232 - cx);
  const dzNorth = Math.max(0, cz - 192);
  const dzSouth = Math.max(0, -346 - cz);
  const distOut = Math.max(dxEast, dxWest, dzNorth, dzSouth);

  let h = -28.0;

  if (dxEast > 0 && dxEast >= Math.max(dxWest, dzNorth * 0.7, dzSouth * 0.7)) {
    // Kidron Valley floor around cx = 385 (-56 c), rising East to Mount of Olives (+54 c at cx = 620..760)
    const intoKidron = smoothstep(0, 82, dxEast);
    const upOlives = smoothstep(90, 330, dxEast);
    const crestFade = 1 - smoothstep(420, 560, dxEast) * 0.35;
    const ridgeUndulation = Math.sin(cz * 0.012) * 5.5 + Math.cos(cx * 0.018 + cz * 0.015) * 2.4;
    h = -28 - intoKidron * 28 + upOlives * 110 * crestFade + upOlives * ridgeUndulation;
  } else if (dxWest > 0 && dxWest >= Math.max(dzNorth * 0.8, dzSouth * 0.8)) {
    // Tyropoeon Valley floor around cx = -285 (-38 c), rising West to Upper City / Western Hill (+22 c)
    const intoTyropoeon = smoothstep(0, 52, dxWest);
    const upUpperCity = smoothstep(64, 240, dxWest);
    const gentleRoll = Math.sin(cz * 0.016) * 3.0;
    h = -26 - intoTyropoeon * 12 + upUpperCity * 60 + upUpperCity * gentleRoll;
  } else if (dzSouth > 0) {
    // Ophel & Hinnom Valley dropping southward
    h = -28 - smoothstep(0, 220, dzSouth) * 34 + Math.sin(cx * 0.02) * 2.5;
  } else {
    // Northern rock-cut fossa & Bezetha hill
    const fossa = smoothstep(0, 35, dzNorth);
    const upBezetha = smoothstep(45, 220, dzNorth);
    h = -18 - fossa * 6 + upBezetha * 32 + Math.cos(cx * 0.018) * 2.5;
  }

  // Ensure smooth collar right along the outer base of the retaining walls
  const collar = smoothstep(0, 16, distOut);
  return -28 * (1 - collar) + h * collar;
}

/**
 * Outward-wound 6-vertex solid triangular prism / ramp along +Z (`z0 -> z1`, rising `y0 -> y1` across `x0..x1`).
 * Cross-products verified analytically so every triangle normal points strictly outward!
 */
function createNorthClimbingRampGeo(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  uvScale = 0.22,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];

  const pushTri = (
    ax: number, ay: number, az: number, au: number, av: number,
    bx: number, by: number, bz: number, bu: number, bv: number,
    cx: number, cy: number, cz: number, cu: number, cv: number,
  ) => {
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    uvs.push(au * uvScale, av * uvScale, bu * uvScale, bv * uvScale, cu * uvScale, cv * uvScale);
  };

  const w = x1 - x0;
  const run = z1 - z0;
  const rise = y1 - y0;
  const slopeLen = Math.hypot(run, rise);

  // 1. Sloped Top Face (+Y, -Z outward): (v0, v4, v5) & (v0, v5, v1)
  pushTri(x0, y0, z0, 0, 0, x0, y1, z1, 0, slopeLen, x1, y1, z1, w, slopeLen);
  pushTri(x0, y0, z0, 0, 0, x1, y1, z1, w, slopeLen, x1, y0, z0, w, 0);

  // 2. West Side Triangle (-X outward): (v0, v2, v4)
  pushTri(x0, y0, z0, 0, 0, x0, y0, z1, run, 0, x0, y1, z1, run, rise);

  // 3. East Side Triangle (+X outward): (v1, v5, v3)
  pushTri(x1, y0, z0, 0, 0, x1, y1, z1, run, rise, x1, y0, z1, run, 0);

  // 4. North Back Face (+Z outward): (v2, v3, v5) & (v2, v5, v4)
  pushTri(x0, y0, z1, 0, 0, x1, y0, z1, w, 0, x1, y1, z1, w, rise);
  pushTri(x0, y0, z1, 0, 0, x1, y1, z1, w, rise, x0, y1, z1, 0, rise);

  // 5. Bottom Face (-Y outward): (v0, v1, v3) & (v0, v3, v2)
  pushTri(x0, y0, z0, 0, 0, x1, y0, z0, w, 0, x1, y0, z1, w, run);
  pushTri(x0, y0, z0, 0, 0, x1, y0, z1, w, run, x0, y0, z1, 0, run);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

export function buildHerod(initialCubit = 0.50): HerodTemple {
  const tex = buildHerodTextures();
  const root = new THREE.Group();
  root.name = 'HerodTempleRoot';

  const unitGroup = new THREE.Group();
  unitGroup.name = 'HerodUnitScale';
  root.add(unitGroup);

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  unitGroup.add(staticGroup);
  unitGroup.add(dynamicGroup);

  const rawColliders: THREE.Box3[] = [];
  const rawPlatforms: THREE.Box3[] = [];
  const colliders: THREE.Box3[] = [];
  const platforms: THREE.Box3[] = [];

  const counts: HerodCounts = {
    royalStoaColumns: 0,
    soregStelae: 0,
    treasuryChests: 0,
    sukkotLamps: 0,
    leviticalSteps: 15,
    sanctuaryCubits: 100,
  };

  const smokePuffs: { sprite: THREE.Sprite; baseY: number; phase: number }[] = [];
  const flameSprites: { sprite: THREE.Sprite; baseScale: number; phase: number }[] = [];
  const sunBeams: { mesh: THREE.Mesh; baseOpacity: number; phase: number }[] = [];

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
    uvMul = 0.18,
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

  function addSolidBlock(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    mat: THREE.Material,
    collide = true,
    uvMul = 0.18,
  ): THREE.Mesh {
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const d = Math.abs(z1 - z0);
    const m = addBoxMesh(staticGroup, cx, Math.min(y0, y1), cz, w, h, d, mat, 0.03, uvMul);
    if (collide) pushCollider(x0, y0, z0, x1, y1, z1);
    return m;
  }

  function addFlame(x: number, y: number, z: number, scale: number, phase: number): void {
    const mat = new THREE.SpriteMaterial({
      map: tex.flameTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.set(x, y, z);
    sp.scale.set(scale, scale * 1.35, 1);
    sp.userData.dynamic = true;
    sp.userData.noCast = true;
    sp.userData.noAO = true;
    dynamicGroup.add(sp);
    flameSprites.push({ sprite: sp, baseScale: scale, phase });
  }

  function addCorinthianColumn(
    x: number,
    y0: number,
    z: number,
    totalH: number,
    radius: number,
    collide = true,
  ): void {
    // Attic base
    addBoxMesh(staticGroup, x, y0, z, radius * 2.5, totalH * 0.04, radius * 2.5, tex.marbleMat, 0.02, 0.4);
    const torus = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.18, radius * 1.24, totalH * 0.03, 14),
      tex.marbleMat,
    );
    torus.position.set(x, y0 + totalH * 0.055, z);
    torus.castShadow = true;
    torus.receiveShadow = true;
    staticGroup.add(torus);

    // Fluted white shaft
    const shaftH = totalH * 0.82;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.88, radius, shaftH, 16),
      tex.corinthianMarbleMat,
    );
    shaft.position.set(x, y0 + totalH * 0.07 + shaftH * 0.5, z);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    staticGroup.add(shaft);

    // Corinthian acanthus bell capital + abacus
    const capH = totalH * 0.09;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.32, radius * 0.88, capH, 14),
      tex.sanctuaryWhiteMat,
    );
    cap.position.set(x, y0 + totalH * 0.89 + capH * 0.5, z);
    cap.castShadow = true;
    staticGroup.add(cap);

    addBoxMesh(
      staticGroup,
      x,
      y0 + totalH * 0.975,
      z,
      radius * 2.75,
      totalH * 0.025,
      radius * 2.75,
      tex.sanctuaryWhiteMat,
      0.02,
      0.4,
    );

    if (collide) {
      pushCollider(x - radius * 1.05, y0, z - radius * 1.05, x + radius * 1.05, y0 + totalH, z + radius * 1.05);
    }
  }

  // ===========================================================================
  // 1. JERUSALEM VALLEYS & MOUNT OF OLIVES TOPOGRAPHY (ZERO HILLS INSIDE MOUNT!)
  // ===========================================================================
  const hillsMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c7b28c'),
    roughness: 0.94,
    metalness: 0.01,
  });
  rockProjection(hillsMat, 55);

  const terrainSpan = 1680; // -840..+840 cubits
  const terrainSegs = 176;
  const tGeo = new THREE.PlaneGeometry(terrainSpan, terrainSpan, terrainSegs, terrainSegs);
  tGeo.rotateX(-Math.PI / 2);
  const tPos = tGeo.attributes.position!;
  for (let i = 0; i < tPos.count; i++) {
    const vx = tPos.getX(i);
    const vz = tPos.getZ(i);
    tPos.setY(i, jerusalemTerrainCubits(vx, vz, true));
  }
  tGeo.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(tGeo, hillsMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  terrainMesh.userData.dynamic = true;
  terrainMesh.userData.noCast = true;
  dynamicGroup.add(terrainMesh);

  // Olive groves along the western slopes of the Mount of Olives & Gethsemane (Matt 24:3; 26:36; Luke 19:37)
  function addOliveTree(tx: number, tz: number, sc: number): void {
    const ty = jerusalemTerrainCubits(tx, tz, true);
    const g = new THREE.Group();
    g.position.set(tx, ty, tz);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45 * sc, 0.85 * sc, 4.6 * sc, 7),
      tex.barkMat,
    );
    trunk.position.y = 2.3 * sc;
    trunk.castShadow = true;
    g.add(trunk);

    for (const [ox, oy, oz, rad] of [
      [0, 5.4, 0, 3.2],
      [-1.7, 4.7, 1.1, 2.3],
      [1.8, 4.8, -1.0, 2.2],
    ] as [number, number, number, number][]) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(rad * sc, 1), tex.oliveFoliageMat);
      crown.position.set(ox * sc, oy * sc, oz * sc);
      crown.scale.set(1.15, 0.78, 1.15);
      crown.castShadow = true;
      crown.receiveShadow = true;
      g.add(crown);
    }
    staticGroup.add(g);
  }

  for (let i = 0; i < 34; i++) {
    const ox = 430 + (i % 6) * 44 + ((i * 17) % 19);
    const oz = -240 + Math.floor(i / 6) * 92 + ((i * 29) % 31);
    addOliveTree(ox, oz, 1.0 + (i % 3) * 0.22);
  }

  // ===========================================================================
  // 2. HERODIAN RETAINING WALLS, SOUTHERN HULDA STEPS & DOUBLE / TRIPLE GATES
  // ===========================================================================
  // Court of the Gentiles Paving Slabs (530 x 530 c: X = -230..+300, Z = -340..+190)
  // Split around the two open Hulda exit stairwells (Z = -284..-258, X = -59..-37 & +33..+67)
  const addPavingSlab = (x0: number, z0: number, x1: number, z1: number, yTop: number, mat = tex.pavingMat) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), mat);
    m.position.set((x0 + x1) * 0.5, yTop - 0.15, (z0 + z1) * 0.5);
    m.receiveShadow = true;
    m.userData.dynamic = true;
    m.userData.noCast = true;
    dynamicGroup.add(m);
    pushPlatform(x0, yTop - 0.3, z0, x1, yTop, z1);
  };

  // Main Northern/Central Court of Gentiles (-258..+190)
  addPavingSlab(-230, -258, 300, 190, GENTILES_C);
  // Royal Stoa Floor (-340..-284) — bridges cleanly over the subterranean Hulda tunnels!
  addPavingSlab(-230, -340, 300, -284, GENTILES_C, tex.opusSectileMat);
  // Strip between -284 and -258 flanking the two Hulda exit stairwells
  addPavingSlab(-230, -284, -59, -258, GENTILES_C);
  addPavingSlab(-37, -284, 33, -258, GENTILES_C);
  addPavingSlab(67, -284, 300, -258, GENTILES_C);

  // Decorative Opus Sectile Pilgrim Plazas on East & South Courts (Josephus War 5.192)
  for (const [ox0, oz0, ox1, oz1] of [
    [202, -65, 266, 65],
    [-160, -245, 160, -195],
  ] as [number, number, number, number][]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ox1 - ox0, 0.04, oz1 - oz0), tex.opusSectileMat);
    m.position.set((ox0 + ox1) * 0.5, 0.01, (oz0 + oz1) * 0.5);
    m.receiveShadow = true;
    m.userData.dynamic = true;
    m.userData.noCast = true;
    dynamicGroup.add(m);
  }

  // Monumental Exterior Herodian Retaining Box (descending to -29 c into Kidron/Tyropoeon/Ophel)
  // East Retaining Wall (X = +298..+302) with ceremonial Shushan Gate portal relief at Z = -8..+8
  addSolidBlock(298, -29, -346, 302, 26, 192, tex.herodianAshlarMat, true, 0.1);
  addBoxMesh(staticGroup, 302.2, 0, 0, 0.8, 18, 16, tex.sanctuaryWhiteMat, 0.03, 0.16); // Shushan Gate relief (Middot 1:3)

  // West Retaining Wall (X = -234..-230) + Robinson's Arch springer & pier + Wilson's Arch bridge
  addSolidBlock(-234, -29, -346, -230, 26, 192, tex.herodianAshlarMat, true, 0.1);
  // Robinson's Arch stepped pier at SW (Z = -308..-286)
  addSolidBlock(-242, -28, -308, -234, -4, -286, tex.herodianAshlarMat, false, 0.12);
  addSolidBlock(-258, -28, -308, -250, -4, -286, tex.herodianAshlarMat, false, 0.12);
  // Wilson's Arch bridge spanning Tyropoeon toward Upper City (Z = -28..-12)
  addSolidBlock(-285, -24, -28, -234, 0, -12, tex.herodianAshlarMat, false, 0.12);

  // North Retaining Wall (Z = +188..+192, East of Antonia)
  addSolidBlock(-152, -29, 188, 302, 26, 192, tex.herodianAshlarMat, true, 0.1);

  // Southern Retaining Wall (Z = -346..-340) pierced by Double Gate (-59..-37) & Triple Gate (+33..+67)
  // Lower wall piers flanking gates (from -29 up to 0)
  addSolidBlock(-234, -29, -346, -59, 0, -340, tex.herodianAshlarMat, true, 0.1);
  addSolidBlock(-49, HULDA_TUNNEL_C, -346, -47, -0.3, -340, tex.herodianAshlarMat); // Double Gate central pier!
  addSolidBlock(-37, -29, -346, 33, 0, -340, tex.herodianAshlarMat, true, 0.1);
  addSolidBlock(43, HULDA_TUNNEL_C, -346, 45, -0.3, -340, tex.herodianAshlarMat); // Triple Gate pier 1!
  addSolidBlock(55, HULDA_TUNNEL_C, -346, 57, -0.3, -340, tex.herodianAshlarMat); // Triple Gate pier 2!
  addSolidBlock(67, -29, -346, 302, 0, -340, tex.herodianAshlarMat, true, 0.1);
  // Upper Southern Wall above Y = -0.30 c (forming South backing wall of the Royal Stoa up to +27 c)
  addSolidBlock(-234, -0.3, -346, 302, 27, -340, tex.herodianAshlarMat, true, 0.1);
  // Ornate carved Herodian lintel friezes over Double & Triple Hulda Gates
  addBoxMesh(staticGroup, -48, -0.4, -346.3, 24, 3.2, 0.8, tex.sanctuaryWhiteMat, 0.03, 0.2);
  addBoxMesh(staticGroup, 50, -0.4, -346.3, 36, 3.2, 0.8, tex.sanctuaryWhiteMat, 0.03, 0.2);

  // Southern Hulda Pilgrim Plaza (Z = -408..-376, X = -92..+92, Y = -10.0 c)
  addPavingSlab(-92, -408, 92, -376, HULDA_PLAZA_C);
  // Flanking Southern Plaza retaining cheek walls + two ritual immersion bathhouses (Mikva'ot, Acts 2:41)
  addSolidBlock(-96, -14, -408, -92, -3.5, -346, tex.herodianAshlarMat);
  addSolidBlock(92, -14, -408, 96, -3.5, -346, tex.herodianAshlarMat);
  for (const side of [-1, 1]) {
    addSolidBlock(side * 74 - 10, HULDA_PLAZA_C, -404, side * 74 + 10, HULDA_PLAZA_C + 5.5, -388, tex.herodianAshlarMat);
  }

  // 20 Monumental Southern Hulda Steps (Z = -376..-346, X = -86..+86, rising -10.0 -> -5.20 c)
  for (let s = 0; s < 20; s++) {
    const topY = HULDA_PLAZA_C + (s + 1) * 0.24;
    const zSouth = -376 + s * 1.5;
    const zNorth = zSouth + 1.56;
    addBoxMesh(
      staticGroup,
      0,
      HULDA_PLAZA_C,
      (zSouth + zNorth) * 0.5,
      172,
      topY - HULDA_PLAZA_C,
      1.56,
      tex.herodianAshlarMat,
      0.02,
      0.16,
    );
    pushPlatform(-86, HULDA_PLAZA_C, zSouth, 86, topY, zNorth);
  }

  // Subterranean Hulda Gate Passages (-346..-284 at Y = -5.20 c) & 20 Ascending Exit Steps (-284..-258 -> 0.0 c)
  const buildHuldaTunnelAndExit = (x0: number, x1: number, piersX: number[]) => {
    // Tunnel floor (-346..-284)
    addPavingSlab(x0, -346, x1, -284, HULDA_TUNNEL_C);
    // Side walls of subterranean tunnel & stairwell
    addSolidBlock(x0 - 2.0, HULDA_TUNNEL_C, -346, x0, 0.0, -258, tex.herodianAshlarMat);
    addSolidBlock(x1, HULDA_TUNNEL_C, -346, x1 + 2.0, 0.0, -258, tex.herodianAshlarMat);
    // Waist-high stone balustrades framing open stairwell on Court of Gentiles (Y = 0..2.3 c)
    addSolidBlock(x0 - 1.5, 0.0, -285.5, x0, 2.3, -258, tex.sanctuaryWhiteMat);
    addSolidBlock(x1, 0.0, -285.5, x1 + 1.5, 2.3, -258, tex.sanctuaryWhiteMat);
    addSolidBlock(x0 - 1.5, 0.0, -285.5, x1 + 1.5, 2.3, -284, tex.sanctuaryWhiteMat);

    // Interior monolithic piers & carved ceiling cupolas inside tunnel
    for (const px of piersX) {
      for (const pz of [-330, -312, -294]) {
        addSolidBlock(px - 1.0, HULDA_TUNNEL_C, pz - 1.0, px + 1.0, -0.3, pz + 1.0, tex.sanctuaryWhiteMat);
      }
    }
    // Warm oil-lamp lighting inside underground Hulda vaults
    const tLight = new THREE.PointLight('#ffcf86', 8, 38, 1.4);
    tLight.position.set((x0 + x1) * 0.5, -1.2, -315);
    tLight.userData.dynamic = true;
    dynamicGroup.add(tLight);

    // 20 Walkable Exit Steps emerging onto Court of the Gentiles (Z = -284..-258, 0.26 c rise each)
    for (let s = 0; s < 20; s++) {
      const topY = HULDA_TUNNEL_C + (s + 1) * 0.26;
      const zS = -284 + s * 1.3;
      const zN = zS + 1.36;
      addBoxMesh(
        staticGroup,
        (x0 + x1) * 0.5,
        HULDA_TUNNEL_C,
        (zS + zN) * 0.5,
        x1 - x0,
        topY - HULDA_TUNNEL_C,
        1.36,
        tex.herodianAshlarMat,
        0.02,
        0.2,
      );
      pushPlatform(x0, HULDA_TUNNEL_C, zS, x1, topY, zN);
    }
  };

  buildHuldaTunnelAndExit(-59, -37, [-48]); // Double Gate Passage (clear lanes: X = -54 and X = -42.5)
  buildHuldaTunnelAndExit(33, 67, [44, 56]); // Triple Gate Passage (clear lanes: X = 38.5, 50, 61.5)

  // ===========================================================================
  // 3. ROYAL STOA (SOUTH BASILICA, Ant. 15.411-416) & SOLOMON'S PORTICO (John 10:23)
  // ===========================================================================
  // 4 rows of 40 white Corinthian columns + 2 end pilasters = 162 columns!
  // Rows at Z = -338.5 (engaged South), -323.5, -303.5, -289.0 (open North facade)
  const stoaRowZ = [-338.5, -323.5, -303.5, -289.0];
  for (let i = 0; i < 40; i++) {
    const cx = -222 + i * 13.2; // i=34 -> 226.8, i=35 -> 240.0 (clear bay at X = 233.4!)
    for (let r = 0; r < 4; r++) {
      const cz = stoaRowZ[r]!;
      const colH = r === 1 || r === 2 ? 27.0 : 25.0;
      addCorinthianColumn(cx, 0, cz, colH, 0.92, r > 0);
      counts.royalStoaColumns++;
    }
  }
  // 2 Monumental Corner End Pilasters completing Josephus' exact 162 count (Ant. 15.413)
  addCorinthianColumn(-228.5, 0, -313.5, 27.0, 1.05, true);
  addCorinthianColumn(296.5, 0, -313.5, 27.0, 1.05, true);
  counts.royalStoaColumns += 2;

  // Royal Stoa Side Aisle Cedar Coffered Roofs (25 c high) & Soaring 50-c Central Clerestory Nave!
  addSolidBlock(-230, 25.0, -340, 298, 27.2, -323.0, tex.royalCedarMat, true, 0.14); // South aisle roof
  addSolidBlock(-230, 25.0, -304.0, 298, 27.2, -288.0, tex.royalCedarMat, true, 0.14); // North aisle roof
  // Clerestory walls rising from 27 c to 48 c with rhythmic window piers
  for (const cz of [-323.5, -303.5]) {
    addSolidBlock(-230, 27.0, cz - 0.9, 298, 31.0, cz + 0.9, tex.sanctuaryWhiteMat, false);
    addSolidBlock(-230, 42.0, cz - 1.0, 298, 48.5, cz + 1.0, tex.sanctuaryWhiteMat, false);
    for (let i = 0; i < 20; i++) {
      const px = -220 + i * 26.4;
      addBoxMesh(staticGroup, px, 31.0, cz, 3.4, 11.0, 1.8, tex.herodianAshlarMat, 0.02, 0.2);
    }
  }
  // Central Nave Coffered Cedar Roof + Terracotta/Limestone Clerestory Ridge (50 c high!)
  addSolidBlock(-230, 48.5, -325.0, 298, 50.8, -302.0, tex.royalCedarMat, true, 0.12);
  addBoxMesh(staticGroup, 34, 50.8, -313.5, 528, 1.6, 24.5, tex.terracottaRoofMat, 0.02, 0.08);

  // Money-Changers' Cedar Tables & Empty Wicker Dove Cages near Royal Stoa margin (Matt 21:12; John 2:14-16)
  for (const tx of [-135, -118, 96, 114]) {
    addSolidBlock(tx - 2.2, 0, -281, tx + 2.2, 1.6, -278.5, tex.royalCedarMat);
    // Stacked Bronze/Silver Shekel Coin Trays & Empty Woven Cages (zero animal figures)
    addBoxMesh(staticGroup, tx - 0.9, 1.6, -279.8, 0.9, 0.22, 0.9, tex.corinthianBronzeMat, 0.01, 0.5);
    addBoxMesh(staticGroup, tx + 1.0, 1.6, -279.7, 1.1, 1.1, 1.1, tex.soregLatticeMat, 0.02, 0.5);
  }

  // SOLOMON'S PORTICO along East Wall (X = +270..+298, Z = -286..+186: John 10:23; Acts 3:11; 5:12)
  for (let z = -276; z <= 180; z += 12) {
    if (Math.abs(z) < 9) continue; // Wide clear bay aligned with Shushan Gate & Beautiful Gate axis
    addCorinthianColumn(270, 0, z, 25.0, 0.78, true);
    addCorinthianColumn(284, 0, z, 25.0, 0.78, true);
  }
  addSolidBlock(268.5, 25.0, -288, 300, 27.4, 188, tex.royalCedarMat, true, 0.14);

  // Western Portico (X = -230..-208, Z = -286..+142) & Northern Portico (Z = +168..+188, X = -150..+268)
  for (let z = -276; z <= 132; z += 13) {
    addCorinthianColumn(-210, 0, z, 25.0, 0.76, true);
  }
  addSolidBlock(-232, 25.0, -288, -208.5, 27.2, 145, tex.royalCedarMat, true, 0.14);

  for (let x = -142; x <= 258; x += 13) {
    addCorinthianColumn(x, 0, 168, 25.0, 0.76, true);
  }
  addSolidBlock(-152, 25.0, 166.5, 270, 27.2, 190, tex.royalCedarMat, true, 0.14);

  // ===========================================================================
  // 4. SOREG WARNING BALUSTRADE (Acts 21:28; Eph 2:14), 14 STEPS & 10-C CHEL
  // ===========================================================================
  const addSoregRun = (x0: number, z0: number, x1: number, z1: number) => {
    addSolidBlock(x0, 0, z0, x1, 3.0, z1, tex.soregLatticeMat, true, 0.35);
  };
  const addWarningStele = (cx: number, cz: number, faceEastWest: boolean) => {
    const w = faceEastWest ? 0.65 : 2.1;
    const d = faceEastWest ? 2.1 : 0.65;
    addSolidBlock(cx - w * 0.5, 0, cz - d * 0.5, cx + w * 0.5, 1.4, cz + d * 0.5, tex.herodianAshlarMat);
    addSolidBlock(cx - w * 0.45, 1.4, cz - d * 0.45, cx + w * 0.45, 3.6, cz + d * 0.45, tex.soregSteleMat);
    counts.soregStelae++;
  };

  // East Soreg (X = +199, open Z = -9..+9)
  addSoregRun(198.6, 9, 199.4, 100.5);
  addSoregRun(198.6, -100.5, 199.4, -9);
  addWarningStele(199.5, 10.6, true);
  addWarningStele(199.5, -10.6, true);

  // West Soreg (X = -195, open Z = -9..+9)
  addSoregRun(-195.4, 9, -194.6, 100.5);
  addSoregRun(-195.4, -100.5, -194.6, -9);
  addWarningStele(-195.5, 10.6, true);
  addWarningStele(-195.5, -10.6, true);

  // North & South Soreg (Z = ±100.5, open at X = -102..-86, -23..-7, +89..+107)
  for (const side of [-1, 1]) {
    const sz0 = side * 100.1;
    const sz1 = side * 100.9;
    addSoregRun(-195.4, sz0, -102, sz1);
    addSoregRun(-86, sz0, -23, sz1);
    addSoregRun(-7, sz0, 89, sz1);
    addSoregRun(107, sz0, 199.4, sz1);
    for (const sx of [-84.5, -5.5, 87.5, 108.5]) {
      addWarningStele(sx, side * 101.0, false);
    }
  }

  // 10-Cubit Chel Terrace Platform (X = -181..+185, Z = -86.5..+86.5, Y = +2.80 c)
  addBoxMesh(staticGroup, 2, 0, 0, 366, CHEL_C, 173, tex.pavingMat, 0.02, 0.15);
  pushPlatform(-181, 0, -86.5, 185, CHEL_C, 86.5);

  // 14 Walkable Steps from Court of the Gentiles onto Chel Terrace (Middot 2:3; War 5.195)
  for (let s = 0; s < 14; s++) {
    const topY = (s + 1) * 0.2;
    const out = (14 - s) * 0.85;
    const inn = out - 0.9;
    // East 14 steps (+185..+196.9)
    addBoxMesh(staticGroup, 185 + (out + inn) * 0.5, 0, 0, 0.9, topY, 173 + out * 2, tex.herodianAshlarMat, 0.01, 0.2);
    pushPlatform(185 + inn, 0, -86.5 - out, 185 + out, topY, 86.5 + out);
    // West 14 steps (-192.9..-181)
    addBoxMesh(staticGroup, -181 - (out + inn) * 0.5, 0, 0, 0.9, topY, 173 + out * 2, tex.herodianAshlarMat, 0.01, 0.2);
    pushPlatform(-181 - out, 0, -86.5 - out, -181 - inn, topY, 86.5 + out);
    // North & South 14 steps (±86.5..±98.4)
    for (const side of [-1, 1]) {
      addBoxMesh(staticGroup, 2, 0, side * (86.5 + (out + inn) * 0.5), 366 + out * 2, topY, 0.9, tex.herodianAshlarMat, 0.01, 0.2);
      pushPlatform(-181 - out, 0, side > 0 ? 86.5 + inn : -86.5 - out, 185 + out, topY, side > 0 ? 86.5 + out : -86.5 - inn);
    }
  }

  // ===========================================================================
  // 5. INNER AZARAH FORTRESS WALLS, BEAUTIFUL GATE (Acts 3:2) & COURT OF WOMEN
  // ===========================================================================
  // Court of the Women Platform (135 x 135 c: X = +30..+165, Z = -67.5..+67.5, Y = +3.80 c)
  addBoxMesh(staticGroup, 97.5, 0, 0, 135, WOMEN_C, 135, tex.opusSectileMat, 0.02, 0.14);
  pushPlatform(30, 0, -67.5, 165, WOMEN_C, 67.5);

  const WALL_TOP = WOMEN_C + 26; // ~30 c above Chel (~40 c exterior impression)

  // East Wall of Court of the Women (X = +165..+171) & 50-Cubit BEAUTIFUL / CORINTHIAN GATE (Acts 3:2, 10; War 5.201-205)
  addSolidBlock(165, CHEL_C, 14, 171, WALL_TOP, 72.5, tex.herodianAshlarMat);
  addSolidBlock(165, CHEL_C, -72.5, 171, WALL_TOP, -14, tex.herodianAshlarMat);
  // Beautiful Gate 50-c Gatehouse Jambs (|Z| = 6..14) & Soaring Lintel (above WOMEN_C + 24)
  for (const side of [-1, 1]) {
    addSolidBlock(164, CHEL_C, side * 6.0, 172, WOMEN_C + 48, side * 14.0, tex.sanctuaryWhiteMat);
    // Open chased Corinthian-bronze double gate leaves!
    addBoxMesh(staticGroup, 168, WOMEN_C, side * 5.65, 5.2, 22.0, 0.45, tex.corinthianBronzeMat, 0.03, 0.25);
  }
  addSolidBlock(164, WOMEN_C + 24, -14, 172, WOMEN_C + 50, 14, tex.sanctuaryWhiteMat);
  addBoxMesh(staticGroup, 172.2, WOMEN_C + 25, 0, 0.5, 6.0, 18.0, tex.corinthianBronzeMat, 0.02, 0.25);
  // 5 Walkable Steps inside the Beautiful Gate (X = +171..+165, rising CHEL_C -> WOMEN_C)
  for (let s = 0; s < 5; s++) {
    const topY = CHEL_C + (s + 1) * 0.2;
    const xE = 171.2 - s * 1.2;
    const xW = xE - 1.28;
    addBoxMesh(staticGroup, (xE + xW) * 0.5, CHEL_C, 0, 1.28, topY - CHEL_C, 12.0, tex.marbleMat, 0.02, 0.3);
    pushPlatform(xW, CHEL_C, -6.0, xE, topY, 6.0);
  }

  // North & South Fortress Walls (Z = ±67.5..±72.5, X = -167..+171)
  // Pierced by Women's N/S Gates (X = +93..+103) and Azarah N/S Gates (X = -99..-89 and -20..-10)
  for (const side of [-1, 1]) {
    const zIn = side * 67.5;
    const zOut = side * 72.5;
    addSolidBlock(-167, CHEL_C, zIn, -99, WALL_TOP + 4, zOut, tex.herodianAshlarMat);
    addSolidBlock(-89, CHEL_C, zIn, -20, WALL_TOP + 4, zOut, tex.herodianAshlarMat);
    addSolidBlock(-10, CHEL_C, zIn, 93, WALL_TOP, zOut, tex.herodianAshlarMat);
    addSolidBlock(103, CHEL_C, zIn, 165, WALL_TOP, zOut, tex.herodianAshlarMat);

    // Gate towers + gilded gate lintels over the 3 gates on each side (War 5.201)
    for (const gx of [-94, -15, 98]) {
      addSolidBlock(gx - 8, WALL_TOP - 2, zIn - side * 0.5, gx + 8, WALL_TOP + 14, zOut + side * 0.5, tex.sanctuaryWhiteMat);
      addBoxMesh(staticGroup, gx - 4.7, CHEL_C + 2, (zIn + zOut) * 0.5, 0.35, 16, 4.4, tex.sanctuaryGoldMat, 0.02, 0.3);
      addBoxMesh(staticGroup, gx + 4.7, CHEL_C + 2, (zIn + zOut) * 0.5, 0.35, 16, 4.4, tex.sanctuaryGoldMat, 0.02, 0.3);
    }

    // 5 Walkable Steps at Women's N/S Gates (X = 93..103, CHEL_C -> WOMEN_C)
    for (let s = 0; s < 5; s++) {
      const topY = CHEL_C + (s + 1) * 0.2;
      const zA = side * (72.5 - s * 1.0);
      const zB = side * (72.5 - (s + 1.05) * 1.0);
      addBoxMesh(staticGroup, 98, CHEL_C, (zA + zB) * 0.5, 10, topY - CHEL_C, 1.05, tex.herodianAshlarMat);
      pushPlatform(93, CHEL_C, Math.min(zA, zB), 103, topY, Math.max(zA, zB));
    }

    // 19 Walkable Steps at Azarah N/S Gates (X = -99..-89 & -20..-10, CHEL_C -> PRIESTS_C)
    for (const gx of [-94, -15]) {
      for (let s = 0; s < 19; s++) {
        const topY = CHEL_C + (s + 1) * 0.25;
        const zA = side * (72.5 - s * 0.46);
        const zB = side * (72.5 - (s + 1.1) * 0.46);
        addBoxMesh(staticGroup, gx, CHEL_C, (zA + zB) * 0.5, 10, topY - CHEL_C, 0.52, tex.herodianAshlarMat);
        pushPlatform(gx - 5, CHEL_C, Math.min(zA, zB), gx + 5, topY, Math.max(zA, zB));
      }
    }
  }
  // West Azarah Fortress Wall (X = -167..-162, continuous behind Sanctuary, Middot 5:1)
  addSolidBlock(-167, CHEL_C, -72.5, -162, WALL_TOP + 4, 72.5, tex.herodianAshlarMat);

  // 4 Open-Roofed Corner Chambers of Court of the Women (40 x 40 c, Middot 2:5):
  // SE Nazirites (Acts 21:23-26), NE Wood, NW Lepers, SW Oil & Wine
  const womenChambers = [
    { x0: 125, z0: -67.5, x1: 165, z1: -27.5, doorX: 143, innerZ: -27.5, kind: 'nazirite' as const },
    { x0: 125, z0: 27.5, x1: 165, z1: 67.5, doorX: 143, innerZ: 27.5, kind: 'wood' as const },
    { x0: 30, z0: 27.5, x1: 70, z1: 67.5, doorX: 57, innerZ: 27.5, kind: 'leper' as const },
    { x0: 30, z0: -67.5, x1: 70, z1: -27.5, doorX: 57, innerZ: -27.5, kind: 'oil' as const },
  ];
  for (const ch of womenChambers) {
    const wallX = ch.x0 > 100 ? ch.x0 : ch.x1;
    // Inner X wall continuous (40 c)
    addSolidBlock(wallX - 1.2, WOMEN_C, ch.z0, wallX + 1.2, WOMEN_C + 14, ch.z1, tex.herodianAshlarMat);
    // Inner Z wall with 10-cubit arched doorway facing central plaza
    addSolidBlock(ch.x0, WOMEN_C, ch.innerZ - 1.2, ch.doorX - 5, WOMEN_C + 14, ch.innerZ + 1.2, tex.herodianAshlarMat);
    addSolidBlock(ch.doorX + 5, WOMEN_C, ch.innerZ - 1.2, ch.x1, WOMEN_C + 14, ch.innerZ + 1.2, tex.herodianAshlarMat);
    addSolidBlock(ch.doorX - 5, WOMEN_C + 10.5, ch.innerZ - 1.2, ch.doorX + 5, WOMEN_C + 14, ch.innerZ + 1.2, tex.sanctuaryWhiteMat);

    const mx = (ch.x0 + ch.x1) * 0.5;
    const mz = (ch.z0 + ch.z1) * 0.5;
    if (ch.kind === 'nazirite') {
      // Nazirite peace-offering hearths & bronze cauldrons (Acts 21:24; Middot 2:5)
      addSolidBlock(mx - 8, WOMEN_C, mz - 2, mx + 8, WOMEN_C + 1.8, mz + 2, tex.hearthMat);
      for (const ox of [-5, 0, 5]) {
        const pot = new THREE.Mesh(
          new THREE.SphereGeometry(1.3, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65),
          tex.bronzeMat,
        );
        pot.position.set(mx + ox, WOMEN_C + 2.5, mz);
        staticGroup.add(pot);
      }
    } else if (ch.kind === 'wood') {
      // Sortedblemish-free altar wood stacks
      for (const oz of [-7, 7]) {
        addSolidBlock(mx - 9, WOMEN_C, mz + oz - 2.2, mx + 9, WOMEN_C + 3.8, mz + oz + 2.2, tex.royalCedarMat);
      }
    } else if (ch.kind === 'leper') {
      // Stone purification basin (Luke 17:14; Negaim 14:8)
      addSolidBlock(mx - 3.5, WOMEN_C, mz - 3.5, mx + 3.5, WOMEN_C + 2.2, mz + 3.5, tex.marbleMat);
    } else {
      // Ceramic oil & wine storage jars
      for (let r = -1; r <= 1; r += 2) {
        for (let k = -2; k <= 2; k++) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 2.4, 10), tex.terracottaRoofMat);
          jar.position.set(mx + k * 3.2, WOMEN_C + 1.2, mz + r * 6);
          jar.castShadow = true;
          staticGroup.add(jar);
        }
      }
    }
  }

  // Upper Women's Balcony / Gallery (Ezrat Nashim, Middot 2:5) along N, S & E colonnades
  for (const side of [-1, 1]) {
    for (let x = 74; x <= 122; x += 9.6) {
      addCorinthianColumn(x, WOMEN_C, side * 25.0, 12.0, 0.58, true);
    }
    // Upper balcony deck & lattice screen
    addSolidBlock(71, WOMEN_C + 12.0, side * 24.2, 124, WOMEN_C + 13.0, side * 27.5, tex.royalCedarMat);
    addBoxMesh(staticGroup, 97.5, WOMEN_C + 13.0, side * 24.4, 53, 2.4, 0.4, tex.soregLatticeMat, 0.02, 0.35);
  }
  for (const z of [-22, -13, 13, 22]) {
    addCorinthianColumn(160, WOMEN_C, z, 12.0, 0.58, true);
  }
  addSolidBlock(159, WOMEN_C + 12.0, -26, 165, WOMEN_C + 13.0, -9, tex.royalCedarMat);
  addSolidBlock(159, WOMEN_C + 12.0, 9, 165, WOMEN_C + 13.0, 26, tex.royalCedarMat);

  // 13 Trumpet-Shaped Treasury Chests (Shofarot: Mark 12:41-44; Luke 21:1-4; John 8:20; Shekalim 6:5)
  const addTreasuryChest = (cx: number, cz: number) => {
    addSolidBlock(cx - 0.75, WOMEN_C, cz - 0.75, cx + 0.75, WOMEN_C + 1.4, cz + 0.75, tex.royalCedarMat);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.48, 1.35, 12), tex.corinthianBronzeMat);
    neck.position.set(cx, WOMEN_C + 2.05, cz);
    neck.rotation.z = 0.16;
    neck.castShadow = true;
    staticGroup.add(neck);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.18, 0.35, 12), tex.sanctuaryGoldMat);
    bell.position.set(cx - 0.12, WOMEN_C + 2.78, cz);
    bell.rotation.z = 0.28;
    staticGroup.add(bell);
    counts.treasuryChests++;
  };
  for (const tx of [76, 83, 90, 97, 104, 111, 118]) addTreasuryChest(tx, -23.6); // 7 South chests
  for (const tx of [78, 86, 94, 102, 110, 118]) addTreasuryChest(tx, 23.6); // + 6 North chests = 13!

  // 4 Towering Golden Sukkot Lampstands (50 c tall, John 8:12; Sukkah 5:2-4)
  for (const [lx, lz] of [
    [82, -16.5],
    [82, 16.5],
    [112, -16.5],
    [112, 16.5],
  ] as [number, number][]) {
    addSolidBlock(lx - 1.8, WOMEN_C, lz - 1.8, lx + 1.8, WOMEN_C + 2.4, lz + 1.8, tex.marbleMat);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.72, 38, 14), tex.sanctuaryGoldMat);
    shaft.position.set(lx, WOMEN_C + 21.4, lz);
    shaft.castShadow = true;
    staticGroup.add(shaft);

    // 4 Golden Oil Bowls on cross-arms + Festive Flames
    for (const [ax, az] of [
      [1.8, 0],
      [-1.8, 0],
      [0, 1.8],
      [0, -1.8],
    ] as [number, number][]) {
      addBoxMesh(staticGroup, lx + ax * 0.5, WOMEN_C + 39.2, lz + az * 0.5, Math.abs(ax) + 0.3, 0.35, Math.abs(az) + 0.3, tex.sanctuaryGoldMat);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 0.9, 12), tex.sanctuaryGoldMat);
      bowl.position.set(lx + ax, WOMEN_C + 39.8, lz + az);
      staticGroup.add(bowl);
      addFlame(lx + ax, WOMEN_C + 41.0, lz + az, 2.4, lx * 0.1 + az);
    }
    // Slender Levitical Ladder beside shaft (Sukkah 5:2)
    addBoxMesh(staticGroup, lx - 1.1, WOMEN_C + 2.4, lz, 0.18, 37.0, 0.7, tex.royalCedarMat, 0.01, 0.4);
    counts.sukkotLamps++;
  }

  // ===========================================================================
  // 6. 15 SEMICIRCULAR LEVITICAL STEPS & NICANOR GATE (Middot 2:5; Yoma 3:10)
  // ===========================================================================
  for (let s = 0; s < 15; s++) {
    const rOuter = 18.0 - s * 0.85; // R = 18.0 (X=48) down to R = 6.1 (X=36.1)
    const topY = WOMEN_C + (s + 1) * 0.2;
    const h = topY - WOMEN_C;
    const stepCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(rOuter, rOuter, h, 28, 1, false, 0, Math.PI),
      tex.marbleMat,
    );
    stepCyl.position.set(30, WOMEN_C + h * 0.5, 0);
    stepCyl.castShadow = true;
    stepCyl.receiveShadow = true;
    staticGroup.add(stepCyl);

    // 9 overlapping AABB platform bands approximating the semicircular arc smoothly from every angle
    const bands = 9;
    for (let b = 0; b < bands; b++) {
      const z0 = -rOuter + (b / bands) * (2 * rOuter);
      const z1 = -rOuter + ((b + 1) / bands) * (2 * rOuter);
      const zMid = Math.min(rOuter * 0.96, Math.max(Math.abs(z0), Math.abs(z1)) * 0.82);
      const xReach = 30 + Math.sqrt(Math.max(0.5, rOuter * rOuter - zMid * zMid));
      pushPlatform(29.5, WOMEN_C, z0, xReach, topY, z1);
    }
  }
  // Top threshold platform through Nicanor Gate (X = 25..36.2, Z = -6..+6)
  pushPlatform(25, WOMEN_C, -6.0, 36.2, ISRAEL_C, 6.0);

  // Nicanor Gate Wall (X = +25..+30) & Gleaming Burnished Corinthian-Bronze Nicanor Doors!
  addSolidBlock(25, WOMEN_C, 12.5, 30, WALL_TOP + 4, 67.5, tex.herodianAshlarMat);
  addSolidBlock(25, WOMEN_C, -67.5, 30, WALL_TOP + 4, -12.5, tex.herodianAshlarMat);
  for (const side of [-1, 1]) {
    addSolidBlock(24.5, WOMEN_C, side * 5.5, 30.5, WOMEN_C + 48, side * 12.5, tex.sanctuaryWhiteMat);
    addBoxMesh(staticGroup, 27.5, ISRAEL_C, side * 5.15, 4.6, 20.0, 0.42, tex.corinthianBronzeMat, 0.03, 0.25);
  }
  addSolidBlock(24.5, ISRAEL_C + 20.5, -12.5, 30.5, WOMEN_C + 50, 12.5, tex.sanctuaryWhiteMat);
  addBoxMesh(staticGroup, 30.6, ISRAEL_C + 21.5, 0, 0.45, 5.2, 15.0, tex.corinthianBronzeMat, 0.02, 0.25);

  // ===========================================================================
  // 7. COURT OF ISRAEL (135x11c), DUCHAN, CHAMBER OF HEWN STONE & PRIESTS' COURT
  // ===========================================================================
  // Court of Israel (X = +14..+25, Z = -67.5..+67.5, Y = +6.80 c)
  addBoxMesh(staticGroup, 19.5, 0, 0, 11, ISRAEL_C, 135, tex.pavingMat, 0.02, 0.16);
  pushPlatform(14, 0, -67.5, 25, ISRAEL_C, 67.5);

  // 3 Levitical Singing Steps (Duchan, X = +11.5..+14.0, rising +6.80 -> +7.55 c, Middot 2:6)
  for (let s = 0; s < 3; s++) {
    const topY = ISRAEL_C + (s + 1) * 0.25;
    const xE = 14.0 - s * 0.84;
    const xW = xE - 0.9;
    addBoxMesh(staticGroup, (xE + xW) * 0.5, ISRAEL_C, 0, 0.9, topY - ISRAEL_C, 135, tex.marbleMat, 0.01, 0.2);
    pushPlatform(xW, ISRAEL_C, -67.5, xE, topY, 67.5);
  }

  // Court of the Priests & Sanctuary Surroundings (X = -162..+11.5, Z = -67.5..+67.5, Y = +7.55 c)
  addBoxMesh(staticGroup, -75.25, 0, 0, 173.5, PRIESTS_C, 135, tex.pavingMat, 0.02, 0.14);
  pushPlatform(-162, 0, -67.5, 11.5, PRIESTS_C, 67.5);

  // Chamber of Hewn Stone (Lishkat HaGazit — Sanhedrin Hall at SE corner, Middot 5:4; Acts 4:5-7)
  addSolidBlock(2, PRIESTS_C, -67.5, 24, PRIESTS_C + 16, -53, tex.sanctuaryWhiteMat);
  for (const cx of [5, 11, 17, 22]) {
    addCorinthianColumn(cx, PRIESTS_C, -51.8, 13.5, 0.55, true);
  }

  // ===========================================================================
  // 8. 32x32 WHITE-WASHED ALTAR, 32-C RAMP, LAVER & NORTH SLAUGHTERING AREA
  // ===========================================================================
  // Altar Base (Yesod, 32x32 c: X = -29..+3, Z = -16..+16, Y = +7.55..+8.55 c)
  // Recessed 1 cubit on South & East leaving the famous SE hornless base notch (Middot 3:1)!
  addSolidBlock(-29, PRIESTS_C, -15, 2, PRIESTS_C + 1.0, 16, tex.whitewashMat);
  addSolidBlock(-29, PRIESTS_C, -16, 1, PRIESTS_C + 1.0, -15, tex.whitewashMat);
  addSolidBlock(2, PRIESTS_C, -14, 3, PRIESTS_C + 1.0, 16, tex.whitewashMat);

  // Middle Ledge / Circuit (Sovev, 30x30 c: X = -28..+2, Z = -15..+15, Y = +8.55..+13.55 c)
  addSolidBlock(-28, PRIESTS_C + 1.0, -15, 2, PRIESTS_C + 6.0, 15, tex.whitewashMat);

  // Scarlet Mid-Line (Chut Shel Sikra, Middot 3:1) girdling the Altar at 5 c above floor (+12.55 c)
  addBoxMesh(staticGroup, -13, PRIESTS_C + 4.9, 0, 30.25, 0.24, 30.25, tex.scarletMat, 0.01, 0.4);

  // Altar Hearth (Ma'arachah, 28x28 c: X = -27..+1, Z = -14..+14, Y = +13.55..+16.55 c)
  addSolidBlock(-27, PRIESTS_C + 6.0, -14, 1, ALTAR_TOP_C, 14, tex.whitewashMat);

  // 4 Hollow 1x1x1-Cubit Corner Horns (Middot 3:2)
  for (const hx of [-26.5, 0.5]) {
    for (const hz of [-13.5, 13.5]) {
      addSolidBlock(hx - 0.5, ALTAR_TOP_C, hz - 0.5, hx + 0.5, ALTAR_TOP_C + 1.0, hz - 0.28, tex.whitewashMat);
      addSolidBlock(hx - 0.5, ALTAR_TOP_C, hz + 0.28, hx + 0.5, ALTAR_TOP_C + 1.0, hz + 0.5, tex.whitewashMat);
      addSolidBlock(hx - 0.5, ALTAR_TOP_C, hz - 0.28, hx - 0.28, ALTAR_TOP_C + 1.0, hz + 0.28, tex.whitewashMat);
      addSolidBlock(hx + 0.28, ALTAR_TOP_C, hz - 0.28, hx + 0.5, ALTAR_TOP_C + 1.0, hz + 0.28, tex.whitewashMat);
      addBoxMesh(staticGroup, hx, ALTAR_TOP_C + 0.05, hz, 0.54, 0.5, 0.54, tex.hearthMat);
    }
  }

  // Central Sacrificial Pyre & Glowing Embers on Altar Top (leaving 7-c outer walkway around hearth!)
  addSolidBlock(-19, ALTAR_TOP_C, -6, -7, ALTAR_TOP_C + 1.2, 6, tex.hearthMat);
  const altarEmber = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.28, 10.5), tex.emberMat);
  altarEmber.position.set(-13, ALTAR_TOP_C + 1.25, 0);
  altarEmber.userData.dynamic = true;
  dynamicGroup.add(altarEmber);

  const altarLight = new THREE.PointLight('#ff9c3e', 18, 52, 1.5);
  altarLight.position.set(-13, ALTAR_TOP_C + 4.0, 0);
  altarLight.userData.dynamic = true;
  dynamicGroup.add(altarLight);

  for (let s = 0; s < 5; s++) {
    const spMat = new THREE.SpriteMaterial({
      map: tex.smokeTex,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(spMat);
    sp.position.set(-13 + (s - 2) * 1.4, ALTAR_TOP_C + 3.0, (s % 2 === 0 ? -1 : 1) * 1.2);
    sp.scale.set(6, 6, 1);
    sp.userData.dynamic = true;
    sp.userData.noCast = true;
    sp.userData.noAO = true;
    dynamicGroup.add(sp);
    smokePuffs.push({ sprite: sp, baseY: ALTAR_TOP_C + 2.5, phase: s * 0.2 });
  }

  // WALKABLE 32-CUBIT x 16-CUBIT SOUTHERN RAMP (Kevesh, Middot 3:3: Z = -48..-16, X = -21..-5)
  const rampGeo = createNorthClimbingRampGeo(-21, -5, PRIESTS_C, ALTAR_TOP_C - 0.15, -48, -16, 0.18);
  const rampMesh = new THREE.Mesh(rampGeo, tex.whitewashMat);
  rampMesh.castShadow = true;
  rampMesh.receiveShadow = true;
  staticGroup.add(rampMesh);
  // Bridge across the slight air-gap (Avir) at Z = -16..-14 onto Altar Hearth
  addBoxMesh(staticGroup, -13, ALTAR_TOP_C - 0.4, -15.0, 16, 0.35, 2.2, tex.whitewashMat, 0.02, 0.2);

  // 36 smooth overlapping horizontal platform slices along the 32-cubit ramp (rise = 0.246 c each)
  const RAMP_SLICES = 36;
  for (let i = 0; i < RAMP_SLICES; i++) {
    const t0 = i / RAMP_SLICES;
    const t1 = (i + 1) / RAMP_SLICES;
    const zS = -48 + t0 * 33.8;
    const zN = -48 + t1 * 33.8 + 0.2;
    const topY = PRIESTS_C + t1 * (ALTAR_TOP_C - 0.15 - PRIESTS_C);
    pushPlatform(-21, PRIESTS_C, zS, -5, topY, zN);
  }

  // BRONZE LAVER (Kiyor) on 12-Spigot Ben-Katin Pedestal between Porch & Altar South (Middot 3:6; Yoma 3:10)
  addSolidBlock(-36.2, PRIESTS_C, -24.2, -31.8, PRIESTS_C + 1.2, -19.8, tex.marbleMat);
  const laverStem = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 2.2, 16), tex.bronzeMat);
  laverStem.position.set(-34, PRIESTS_C + 2.3, -22);
  laverStem.castShadow = true;
  staticGroup.add(laverStem);
  const laverBowl = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 20, 14, 0, Math.PI * 2, Math.PI * 0.38, Math.PI * 0.62),
    tex.corinthianBronzeMat,
  );
  laverBowl.position.set(-34, PRIESTS_C + 4.4, -22);
  laverBowl.castShadow = true;
  staticGroup.add(laverBowl);
  for (let sp = 0; sp < 12; sp++) {
    const a = (sp * Math.PI * 2) / 12;
    addBoxMesh(staticGroup, -34 + Math.cos(a) * 1.5, PRIESTS_C + 2.5, -22 + Math.sin(a) * 1.5, 0.35, 0.25, 0.35, tex.sanctuaryGoldMat);
  }

  // NORTHERN SLAUGHTERING RINGS, 8 MARBLE TABLES & 8 HOOK PILLARS (Beit HaMitbachayim, Middot 3:5)
  // 24 Iron/Bronze Rings in 4 rows of 6 at Z = +22..+31 (flush on floor — clear Z = +18..+35 walkway!)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const rx = -25 + col * 4.4;
      const rz = 22.5 + row * 2.6;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 16), tex.ironMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(rx, PRIESTS_C + 0.06, rz);
      staticGroup.add(ring);
    }
  }
  // 8 Low White Marble Tables (2 rows of 4 at Z = +36.5 & +41.5)
  for (const tz of [36.5, 41.5]) {
    for (let col = 0; col < 4; col++) {
      const tx = -23 + col * 6.5;
      addSolidBlock(tx - 1.5, PRIESTS_C, tz - 1.0, tx + 1.5, PRIESTS_C + 1.4, tz + 1.0, tex.marbleMat);
    }
  }
  // 8 Dwarf Stone Pillars with Cedar Blocks & Iron Hooks (Z = +47.5 & +53.5)
  for (const pz of [47.5, 53.5]) {
    for (let col = 0; col < 4; col++) {
      const px = -23 + col * 6.5;
      addSolidBlock(px - 0.65, PRIESTS_C, pz - 0.65, px + 0.65, PRIESTS_C + 4.2, pz + 0.65, tex.herodianAshlarMat);
      addBoxMesh(staticGroup, px, PRIESTS_C + 4.2, pz, 1.8, 0.55, 1.8, tex.royalCedarMat);
      addBoxMesh(staticGroup, px, PRIESTS_C + 3.6, pz - 0.75, 0.16, 0.4, 0.3, tex.ironMat);
    }
  }

  // ===========================================================================
  // 9. 12 STEPS & 100x100x100 T-PLAN SANCTUARY (Beit HaMikdash: War 5.207-223; Middot 4)
  // ===========================================================================
  // 12 Walkable Steps up to Sanctuary Porch (X = -37.2..-51.0, Z = -11..+11, rise = 0.50 c -> +13.55 c)
  for (let s = 0; s < 12; s++) {
    const topY = PRIESTS_C + (s + 1) * 0.5;
    const xE = -37.2 - s * 1.15;
    const xW = xE - 1.22;
    addBoxMesh(staticGroup, (xE + xW) * 0.5, PRIESTS_C, 0, 1.22, topY - PRIESTS_C, 22.0, tex.sanctuaryWhiteMat, 0.02, 0.2);
    pushPlatform(xW, PRIESTS_C, -11.0, xE, topY, 11.0);
  }
  for (const side of [-1, 1]) {
    addSolidBlock(-51, PRIESTS_C, side * 11.0, -37.2, TEMPLE_C + 2.2, side * 12.6, tex.sanctuaryWhiteMat);
  }

  // 6-Cubit Sanctuary Podium (T-plan: 100 c wide Z = -50..+50 at Ulam X = -67..-51; 70 c wide Z = -35..+35 behind X = -151..-67)
  addBoxMesh(staticGroup, -59, PRIESTS_C, 0, 16, 6.0, 100, tex.sanctuaryWhiteMat, 0.03, 0.14);
  pushPlatform(-67, PRIESTS_C, -50, -51, TEMPLE_C, 50);
  addBoxMesh(staticGroup, -109, PRIESTS_C, 0, 84, 6.0, 70, tex.sanctuaryWhiteMat, 0.03, 0.14);
  pushPlatform(-151, PRIESTS_C, -35, -67, TEMPLE_C, 35);

  const SANCT_TOP = TEMPLE_C + 100; // 100 cubits tall! (Middot 4:6; War 5.207)

  // ULAM 100x100 EAST FACADE (X = -56..-51, Z = -50..+50, open portal |Z| <= 10 x 40 c high!)
  for (const side of [-1, 1]) {
    // T-wing facade piers (|Z| = 10..50)
    addSolidBlock(-56, TEMPLE_C, side * 10, -51, SANCT_TOP, side * 50, tex.sanctuaryWhiteMat, true, 0.1);
    // Ulam wing side/back enclosures (|Z| = 35..50, X = -67..-56)
    addSolidBlock(-67, TEMPLE_C, side * 35, -56, SANCT_TOP - 8, side * 50, tex.sanctuaryWhiteMat, true, 0.1);
    // Ulam interior side walls (|Z| = 15..35, X = -67..-56, with Bet HaChalifot knife chambers, Middot 4:7)
    addSolidBlock(-67, TEMPLE_C, side * 15, -56, SANCT_TOP, side * 35, tex.sanctuaryWhiteMat, true, 0.1);

    // Monumental Gilded Wall Plates & Engaged Golden Corinthian Pilasters on East Facade (War 5.208, 222; Bar-Kokhba coin)
    for (const pz of [14, 28, 42]) {
      addBoxMesh(staticGroup, -50.7, TEMPLE_C + 2, side * pz, 0.7, 86, 3.2, tex.sanctuaryGoldMat, 0.02, 0.15);
    }
    addBoxMesh(staticGroup, -50.85, TEMPLE_C + 44, side * 30, 0.35, 16, 36, tex.sanctuaryGoldMat, 0.02, 0.16);
  }
  // Upper Facade above the 20x40 Ulam Portal (Y = TEMPLE_C + 40 .. SANCT_TOP)
  addSolidBlock(-56, TEMPLE_C + 40, -10, -51, SANCT_TOP, 10, tex.sanctuaryWhiteMat, true, 0.1);
  // 5 Carved Oak/Cedar Frieze Beams embedded above Ulam portal (Middot 3:7)
  for (let b = 0; b < 5; b++) {
    addBoxMesh(staticGroup, -50.75, TEMPLE_C + 40.5 + b * 2.4, 0, 0.6, 1.4, 22 + b * 2, tex.hekhalCedarMat, 0.02, 0.25);
  }
  // Golden Facade Entablature & Golden Roof Spikes (Kelayah — keeping birds off roof, Middot 4:6; War 5.224)
  addBoxMesh(staticGroup, -50.65, SANCT_TOP - 6, 0, 0.8, 4.5, 100.4, tex.sanctuaryGoldMat, 0.02, 0.12);
  for (let z = -48; z <= 48; z += 4) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 2.2, 6), tex.sanctuaryGoldMat);
    spike.position.set(-51.2, SANCT_TOP + 1.1, z);
    staticGroup.add(spike);
  }
  // Ulam Ceiling (Y = TEMPLE_C + 44..100)
  addSolidBlock(-67, TEMPLE_C + 44, -15, -56, SANCT_TOP, 15, tex.hekhalCedarMat);

  // HEKHAL DIVIDING WALL (6 c thick: X = -73..-67, Golden Portal 10 c wide |Z| <= 5 x 20 c high)
  for (const side of [-1, 1]) {
    addSolidBlock(-73, TEMPLE_C, side * 5, -67, SANCT_TOP, side * 16, tex.sanctuaryWhiteMat);
    // Great Golden Folding Doors swung open inside jambs (Middot 4:1; War 5.210)
    addBoxMesh(staticGroup, -70, TEMPLE_C, side * 4.68, 5.2, 19.5, 0.38, tex.sanctuaryGoldMat, 0.02, 0.25);
  }
  addSolidBlock(-73, TEMPLE_C + 20, -5, -67, SANCT_TOP, 5, tex.sanctuaryGoldMat);

  // COLOSSAL GOLDEN VINE above the Hekhal Entrance inside Ulam (Middot 3:8; Josephus War 5.210)
  for (const vy of [22.5, 26.0, 29.5]) {
    addBoxMesh(staticGroup, -66.6, TEMPLE_C + vy, 0, 0.6, 0.55, 18.0, tex.royalCedarMat);
  }
  for (let branch = -7; branch <= 7; branch += 2.0) {
    const vineArc = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.18, 8, 14, Math.PI), tex.sanctuaryGoldMat);
    vineArc.position.set(-66.2, TEMPLE_C + 25.5 + (Math.abs(branch) % 2) * 1.8, branch);
    vineArc.rotation.y = Math.PI / 2;
    staticGroup.add(vineArc);
    // Hanging man-sized golden grape clusters (War 5.210)!
    for (let g = 0; g < 4; g++) {
      const grape = new THREE.Mesh(
        new THREE.SphereGeometry(0.42 - g * 0.07, 10, 8),
        tex.sanctuaryGoldMat,
      );
      grape.position.set(-66.0, TEMPLE_C + 24.4 - g * 0.62, branch + (g % 2) * 0.18);
      staticGroup.add(grape);
    }
  }

  // HEKHAL (HOLY PLACE: 40 x 20 x 40 c, X = -113..-73, Z = -10..+10)
  for (const side of [-1, 1]) {
    addSolidBlock(-140, TEMPLE_C, side * 10, -73, SANCT_TOP, side * 16, tex.sanctuaryWhiteMat);
    // Gilded Cedar Botanical Wainscot Panels (strictly aniconic rosettes & vines, zero figures!)
    for (let p = 0; p < 4; p++) {
      addBoxMesh(staticGroup, -78 - p * 10, TEMPLE_C, side * 9.75, 9.8, 38, 0.35, tex.hekhalCedarMat, 0.02, 0.22);
    }
    addBoxMesh(staticGroup, -93, TEMPLE_C + 19, side * 9.58, 40, 1.0, 0.35, tex.sanctuaryGoldMat, 0.02, 0.2);
  }
  // Hekhal Coffered Golden Ceiling at +40 c, with Upper Chamber (Aliyah, 40 c high, Middot 4:5-6) above up to SANCT_TOP!
  addSolidBlock(-135, TEMPLE_C + 40, -16, -73, SANCT_TOP, 16, tex.hekhalCedarMat);

  // 1) SEVEN-BRANCHED GOLDEN MENORAH on South side of Hekhal (X = -92, Z = -5.8; Heb 9:2; War 5.217)
  {
    const mx = -92;
    const mz = -5.8;
    // Stepped golden base + central stem
    addSolidBlock(mx - 1.1, TEMPLE_C, mz - 1.1, mx + 1.1, TEMPLE_C + 0.7, mz + 1.1, tex.sanctuaryGoldMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 3.2, 12), tex.sanctuaryGoldMat);
    stem.position.set(mx, TEMPLE_C + 2.3, mz);
    staticGroup.add(stem);
    // 3 concentric semicircular golden branch pairs (aligned E-W along X) + 7 oil cups & flames!
    for (const r of [0.65, 1.25, 1.85]) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 8, 20, Math.PI), tex.sanctuaryGoldMat);
      arc.position.set(mx, TEMPLE_C + 3.85, mz);
      arc.rotation.z = Math.PI;
      staticGroup.add(arc);
    }
    for (const bx of [-1.85, -1.25, -0.65, 0, 0.65, 1.25, 1.85]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.09, 0.25, 10), tex.sanctuaryGoldMat);
      cup.position.set(mx + bx, TEMPLE_C + 3.98, mz);
      staticGroup.add(cup);
      addFlame(mx + bx, TEMPLE_C + 4.35, mz, 0.55, bx * 2);
    }
    // 3-stepped dressing stone (Even HaMenorah, Tamid 3:9) beside Menorah
    addSolidBlock(mx - 0.6, TEMPLE_C, mz + 1.2, mx + 0.6, TEMPLE_C + 0.9, mz + 2.1, tex.marbleMat);
  }

  // 2) GOLDEN TABLE OF SHOWBREAD on North side of Hekhal (X = -92, Z = +5.8; Matt 12:4; Heb 9:2; War 5.216)
  {
    const tx = -92;
    const tz = 5.8;
    addSolidBlock(tx - 1.2, TEMPLE_C, tz - 0.75, tx + 1.2, TEMPLE_C + 1.65, tz + 0.75, tex.sanctuaryGoldMat);
    // 2 stacks of 6 unleavened loaves + 2 golden frankincense cups (Menachot 11:5)
    for (const sx of [-0.55, 0.55]) {
      for (let l = 0; l < 6; l++) {
        addBoxMesh(staticGroup, tx + sx, TEMPLE_C + 1.68 + l * 0.16, tz, 0.82, 0.12, 0.95, tex.sanctuaryGoldMat, 0.02, 0.5);
      }
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.24, 10), tex.sanctuaryGoldMat);
      cup.position.set(tx + sx, TEMPLE_C + 2.75, tz);
      staticGroup.add(cup);
    }
  }

  // 3) GOLDEN ALTAR OF INCENSE centered before the Veil (X = -105.5, Z = 0; Luke 1:9-11; War 5.218)
  {
    const ix = -105.5;
    addSolidBlock(ix - 0.85, TEMPLE_C, -0.85, ix + 0.85, TEMPLE_C + 2.1, 0.85, tex.sanctuaryGoldMat);
    for (const hx of [-0.72, 0.72]) {
      for (const hz of [-0.72, 0.72]) {
        addBoxMesh(staticGroup, ix + hx, TEMPLE_C + 2.1, hz, 0.24, 0.35, 0.24, tex.sanctuaryGoldMat);
      }
    }
    addFlame(ix, TEMPLE_C + 2.38, 0, 0.52, 1.7);
  }

  // BABYLONIAN DOUBLE VEIL (Parokhet / Amah Traksin: X = -113.2 & -114.2, Matt 27:51; Yoma 5:1; War 5.212-214)
  // Outer curtain folded open on North (+6.2..+9.8), inner curtain folded open on South (-9.8..-6.2) — ZERO collider!
  const outerVeil = hanging(16.0, 26.0, tex.veilMat, 0);
  outerVeil.rotation.y = Math.PI / 2;
  outerVeil.position.set(-113.2, TEMPLE_C, -1.8);
  outerVeil.traverse((o) => {
    o.userData.dynamic = true;
    o.userData.noCast = true;
    o.userData.noAO = true;
  });
  dynamicGroup.add(outerVeil);

  const innerVeil = hanging(16.0, 26.0, tex.veilMat, 0);
  innerVeil.rotation.y = Math.PI / 2;
  innerVeil.position.set(-114.2, TEMPLE_C, 1.8);
  innerVeil.traverse((o) => {
    o.userData.dynamic = true;
    o.userData.noCast = true;
    o.userData.noAO = true;
  });
  dynamicGroup.add(innerVeil);

  // MOST HOLY PLACE (Kodesh HaKodashim: 20 x 20 c, X = -134.5..-114.5, Z = -10..+10)
  // STRICTLY EMPTY & ANICONIC (Josephus War 5.219; Mishnah Middot 5:2; Yoma 5:2):
  // NO Ark of the Covenant, NO cherubim statues, NO human/animal/divine figures!
  addSolidBlock(-140.5, TEMPLE_C, -16, -134.5, SANCT_TOP, 16, tex.sanctuaryWhiteMat); // 6-c West Sanctuary Wall
  addBoxMesh(staticGroup, -134.25, TEMPLE_C, 0, 0.35, 39.5, 19.6, tex.sanctuaryGoldMat, 0.02, 0.2);
  addBoxMesh(staticGroup, -124.5, TEMPLE_C, 9.75, 19.6, 39.5, 0.35, tex.sanctuaryGoldMat, 0.02, 0.2);
  addBoxMesh(staticGroup, -124.5, TEMPLE_C, -9.75, 19.6, 39.5, 0.35, tex.sanctuaryGoldMat, 0.02, 0.2);

  // BARE BEDROCK FOUNDATION STONE (Even HaShetiyah — 3 fingerbreadths = ~0.125 c above floor, Yoma 5:2)!
  const stoneGeo = new THREE.CylinderGeometry(3.1, 3.6, 0.125, 11);
  const sPos = stoneGeo.attributes.position!;
  for (let i = 0; i < sPos.count; i++) {
    const vx = sPos.getX(i);
    const vz = sPos.getZ(i);
    const ang = Math.atan2(vz, vx);
    const jag = 1.0 + 0.14 * Math.sin(ang * 3 + 0.6) + 0.08 * Math.cos(ang * 5);
    sPos.setX(i, vx * jag * 1.18);
    sPos.setZ(i, vz * jag * 0.92);
  }
  stoneGeo.computeVertexNormals();
  const foundationStone = new THREE.Mesh(stoneGeo, tex.bedrockMat);
  foundationStone.position.set(-124.5, TEMPLE_C + 0.0625, 0);
  foundationStone.receiveShadow = true;
  staticGroup.add(foundationStone);
  pushPlatform(-128.2, TEMPLE_C, -3.2, -120.8, TEMPLE_C + 0.125, 3.2);

  // 38 Three-Story Side Chambers (Ta'im, Middot 4:3-4) enclosing N, S & W of Sanctuary Body (X = -151..-67, Z = ±16..±35)
  for (const side of [-1, 1]) {
    addSolidBlock(-151, TEMPLE_C, side * 16, -67, TEMPLE_C + 46, side * 35, tex.sanctuaryWhiteMat, true, 0.12);
    for (let st = 1; st <= 3; st++) {
      addBoxMesh(staticGroup, -109, TEMPLE_C + st * 14.5, side * 35.2, 84, 1.1, 0.6, tex.sanctuaryGoldMat, 0.02, 0.18);
    }
  }
  addSolidBlock(-151, TEMPLE_C, -16, -140.5, TEMPLE_C + 46, 16, tex.sanctuaryWhiteMat, true, 0.12);

  // Interior Sanctuary Warm Lighting
  const hekhalLight = new THREE.PointLight('#ffd480', 18, 56, 1.35);
  hekhalLight.position.set(-93, TEMPLE_C + 14, 0);
  hekhalLight.userData.dynamic = true;
  dynamicGroup.add(hekhalLight);

  const debirLight = new THREE.PointLight('#ffe09c', 14, 38, 1.4);
  debirLight.position.set(-124.5, TEMPLE_C + 13, 0);
  debirLight.userData.dynamic = true;
  dynamicGroup.add(debirLight);

  // Subtle Morning Sunbeams slanting from East over the Mount of Olives into Ulam & Courts (noAO = true)
  for (const [bx, by, bz, bw, bl] of [
    [168, 22, 0, 14, 68],
    [28, 24, 0, 13, 64],
    [-54, 32, 0, 16, 74],
  ] as [number, number, number, number, number][]) {
    const bMat = new THREE.MeshBasicMaterial({
      map: tex.beamTex,
      color: new THREE.Color('#ffde8e'),
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(bw, bl), bMat);
    plane.position.set(bx, by, bz);
    plane.rotation.z = Math.PI * 0.5 - 0.42;
    plane.userData.dynamic = true;
    plane.userData.noCast = true;
    plane.userData.noAO = true;
    dynamicGroup.add(plane);
    sunBeams.push({ mesh: plane, baseOpacity: 0.16, phase: bx * 0.04 });
  }

  // ===========================================================================
  // 10. ANTONIA FORTRESS 4-TOWER CITADEL AT NW CORNER (Acts 21:31-40; War 5.238-247)
  // ===========================================================================
  // Rock-cut Moriah Scarp & Walkable Tribune Terrace (X = -230..-152, Z = +145..+205, ANTONIA_C = +8.00 c)
  addSolidBlock(-232, -28, 145, -152, ANTONIA_C, 206, tex.bedrockMat, false, 0.12);
  addBoxMesh(staticGroup, -191, 0, 175, 78, ANTONIA_C, 60, tex.pavingMat, 0.02, 0.15);
  pushPlatform(-230, 0, 145, -152, ANTONIA_C, 205);

  // 32 Walkable Antonia Steps descending South onto Court of the Gentiles (Acts 21:35, 40: Z = +113..+145, X = -195..-175)
  for (let s = 0; s < 32; s++) {
    const topY = (s + 1) * 0.25;
    const zS = 113 + s * 1.0;
    const zN = zS + 1.06;
    addBoxMesh(staticGroup, -185, 0, (zS + zN) * 0.5, 20.0, topY, 1.06, tex.herodianAshlarMat, 0.02, 0.2);
    pushPlatform(-195, 0, zS, -175, topY, zN);
  }
  for (const sx of [-196.2, -173.8]) {
    addSolidBlock(sx - 1.0, 0, 113, sx + 1.0, ANTONIA_C + 2.4, 145, tex.herodianAshlarMat);
  }
  // Parapet along Tribune Overlook Landing leaving stair head (-195..-175) wide open!
  addSolidBlock(-230, ANTONIA_C, 144.5, -195, ANTONIA_C + 2.4, 146.2, tex.herodianAshlarMat);
  addSolidBlock(-175, ANTONIA_C, 144.5, -168, ANTONIA_C + 2.4, 146.2, tex.herodianAshlarMat);

  // Antonia Praetorium Keep Body (Z = +158..+202, leaving Z = +145..+158 as Paul's open portico landing!)
  addSolidBlock(-226, ANTONIA_C, 158, -156, ANTONIA_C + 38, 202, tex.herodianAshlarMat, true, 0.12);
  for (const cx of [-202, -192, -182, -172]) {
    addCorinthianColumn(cx, ANTONIA_C, 152, 14.0, 0.62, true);
  }
  addSolidBlock(-208, ANTONIA_C + 14, 150, -168, ANTONIA_C + 16, 158, tex.royalCedarMat);

  // 4 Corner Towers: NW, NE, SW (50 c tall) + SE 70-Cubit Overlook Keep Tower (War 5.242)!
  const antoniaTowers: [number, number, number, number, number][] = [
    [-232, 190, -214, 208, 50], // NW
    [-168, 190, -150, 208, 50], // NE
    [-232, 146, -214, 164, 50], // SW
    [-168, 145, -150, 163, 70], // SE 70-cubit Temple Overlook Tower!
  ];
  for (const [tx0, tz0, tx1, tz1, th] of antoniaTowers) {
    addSolidBlock(tx0, ANTONIA_C, tz0, tx1, ANTONIA_C + th, tz1, tex.herodianAshlarMat, true, 0.11);
    addBoxMesh(
      staticGroup,
      (tx0 + tx1) * 0.5,
      ANTONIA_C + th,
      (tz0 + tz1) * 0.5,
      tx1 - tx0 + 1.4,
      2.2,
      tz1 - tz0 + 1.4,
      tex.sanctuaryWhiteMat,
      0.03,
      0.16,
    );
  }

  // Batch all static geometry per material
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
    altarLight.distance = 52 * cubitVal;
    hekhalLight.distance = 56 * cubitVal;
    debirLight.distance = 38 * cubitVal;
  };

  syncScaledBoxes(currentCubit);

  const result: HerodTemple = {
    group: root,
    colliders,
    platforms,
    counts,
    CUBIT: currentCubit,
    HULDA_PLAZA_Y: HULDA_PLAZA_C * currentCubit,
    GENTILES_Y: GENTILES_C * currentCubit,
    CHEL_Y: CHEL_C * currentCubit,
    WOMEN_Y: WOMEN_C * currentCubit,
    ISRAEL_Y: ISRAEL_C * currentCubit,
    PRIESTS_Y: PRIESTS_C * currentCubit,
    TEMPLE_Y: TEMPLE_C * currentCubit,
    ANTONIA_Y: ANTONIA_C * currentCubit,
    floorY(x: number, z: number): number {
      return jerusalemTerrainCubits(x / result.CUBIT, z / result.CUBIT, false) * result.CUBIT;
    },
    rescale(newCubit: number): number {
      const clamped = Math.max(0.4, Math.min(0.6, newCubit));
      currentCubit = clamped;
      result.CUBIT = clamped;
      result.HULDA_PLAZA_Y = HULDA_PLAZA_C * clamped;
      result.GENTILES_Y = GENTILES_C * clamped;
      result.CHEL_Y = CHEL_C * clamped;
      result.WOMEN_Y = WOMEN_C * clamped;
      result.ISRAEL_Y = ISRAEL_C * clamped;
      result.PRIESTS_Y = PRIESTS_C * clamped;
      result.TEMPLE_Y = TEMPLE_C * clamped;
      result.ANTONIA_Y = ANTONIA_C * clamped;
      syncScaledBoxes(clamped);
      return clamped;
    },
    update(_dt: number, elapsed: number): void {
      // Sacrificial Altar ember glow
      const pulse = 1.35 + Math.sin(elapsed * 3.0) * 0.24 + Math.sin(elapsed * 7.1) * 0.1;
      tex.emberMat.emissiveIntensity = pulse;
      altarLight.intensity = 17.5 + Math.sin(elapsed * 3.4) * 3.0;

      // Rising sacrificial smoke plume from the 32x32 Altar
      for (const p of smokePuffs) {
        const cycle = (elapsed * 0.22 + p.phase) % 1;
        p.sprite.position.y = p.baseY + cycle * 22;
        const mat = p.sprite.material as THREE.SpriteMaterial;
        mat.opacity = Math.sin(cycle * Math.PI) * 0.34;
        const sc = 4.5 + cycle * 6.5;
        p.sprite.scale.set(sc, sc, 1);
      }

      // Gentle flicker on Sukkot Lampstands & Sanctuary Menorah oil lamps
      for (const f of flameSprites) {
        const flick = 0.9 + 0.12 * Math.sin(elapsed * 6.2 + f.phase) + 0.05 * Math.cos(elapsed * 13.4 + f.phase);
        f.sprite.scale.set(f.baseScale * flick, f.baseScale * 1.35 * flick, 1);
      }

      // Subtle atmospheric morning light shimmer
      for (const b of sunBeams) {
        const mat = b.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = b.baseOpacity * (0.88 + 0.12 * Math.sin(elapsed * 1.05 + b.phase));
      }
    },
  };

  return result;
}
