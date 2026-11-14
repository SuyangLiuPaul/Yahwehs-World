import * as THREE from 'three';
import { altarHorn, batchStatic, bevelBox } from './craft';
import { buildDesert } from './environment';
import { rockProjection } from './materials';
import { buildEzekielTextures } from './ezekiel-tex';

export interface EzekielCounts {
  outerChambers: number;
  kitchens: number;
  outerGates: number;
  innerGates: number;
  sideChambers: number;
  fruitTrees: number;
}

export interface EzekielTemple {
  group: THREE.Group;
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  counts: EzekielCounts;
  CUBIT: number;
  OUTSIDE_Y: number;
  OUTER_Y: number;
  INNER_Y: number;
  TEMPLE_Y: number;
  floorY: (x: number, z: number) => number;
  rescale: (newCubit: number) => number;
  update: (dt: number, elapsed: number) => void;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic mountain + eastern river wadi height in CUBITS (`Ezek 40:2`, `47:1-12`).
 * Outer Court sits at 0 c; outer approach plaza sits at -1.68 c (7 steps of 0.24 c below).
 */
export function mountainCubits(cx: number, cz: number, visual = false): number {
  const OUTSIDE = -1.68;
  const edge = Math.max(Math.abs(cx), Math.abs(cz));
  if (edge <= 249.5) return 0;
  // Physics ground ramps smoothly over 8 cubits (slope 0.21 << MAX_CLIMB=1.0) beneath stair treads
  // so Walker walks smoothly up the 7 steps without tripping vertical-cliff guard; visual mesh sits crisp at OUTSIDE.
  if (edge < 257.5) return visual ? OUTSIDE : OUTSIDE * ((edge - 249.5) / 8);
  if (edge <= 284) return OUTSIDE;

  // Eastern river valley wadi centered along Z = -15.5 cubits outside East Wall
  const riverZ = -15.5 - Math.sin(Math.max(0, cx - 256) / 140) * 6;
  const inEast = cx > 256 ? smoothstep(260, 295, cx) : 0;
  const wadiWeight = inEast * Math.exp(-Math.pow((cz - riverZ) / 48, 2));

  const slope = smoothstep(284, 490, edge);
  const ridge =
    Math.sin(cx * 0.032) * Math.cos(cz * 0.029) * 2.2 +
    Math.sin(cx * 0.075 + cz * 0.06) * 0.85;
  const mountainDrop = OUTSIDE - slope * 48 + slope * ridge;

  // Gentle east slope following the Living River down into the Arabah / Dead Sea plain
  const riverSlope = smoothstep(256, 480, cx);
  const streamChannel = Math.exp(-Math.pow((cz - riverZ) / 16, 2)) * 1.1 * riverSlope;
  const wadiFloor = OUTSIDE - riverSlope * 9.5 - streamChannel;

  return mountainDrop * (1 - wadiWeight) + wadiFloor * wadiWeight;
}

export function buildEzekiel(initialCubit = 0.525): EzekielTemple {
  const tex = buildEzekielTextures();
  const root = new THREE.Group();
  root.name = 'EzekielTempleRoot';

  const unitGroup = new THREE.Group();
  unitGroup.name = 'EzekielUnitScale';
  root.add(unitGroup);

  // Use cubit = 1 inside unitGroup for geometry & unscaled colliders/platforms,
  // OR build directly in cubit-1 space and scale unitGroup cleanly on demand!
  // Actually building in 1-unit = 1-cubit world space and scaling `unitGroup` by `cubit`
  // makes rescale(newCubit) instantaneous (< 1 ms, zero GPU rebuild)!
  const STEP_C = 0.24; // 25 * 0.24 = 6.00 c exact total rise (Ezek 41:8)
  const OUTSIDE_C = -7 * STEP_C; // -1.68 c
  const OUTER_C = 0;
  const INNER_C = 8 * STEP_C; // +1.92 c
  const TEMPLE_C = INNER_C + 10 * STEP_C; // +4.32 c

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  unitGroup.add(staticGroup);
  unitGroup.add(dynamicGroup);

  const rawColliders: THREE.Box3[] = [];
  const rawPlatforms: THREE.Box3[] = [];
  const colliders: THREE.Box3[] = [];
  const platforms: THREE.Box3[] = [];

  const counts: EzekielCounts = {
    outerChambers: 0,
    kitchens: 0,
    outerGates: 0,
    innerGates: 0,
    sideChambers: 0,
    fruitTrees: 0,
  };

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
    uvMul = 0.22,
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
  ): void {
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const d = Math.abs(z1 - z0);
    addBoxMesh(staticGroup, cx, Math.min(y0, y1), cz, w, h, d, mat);
    if (collide) pushCollider(x0, y0, z0, x1, y1, z1);
  }

  // ---------------------------------------------------------------------------
  // 1. VERY HIGH MOUNTAIN TERRAIN (Ezek 40:2) + OUTER PLAZA + DESERT HORIZON
  // ---------------------------------------------------------------------------
  const mountainMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c5ad86'),
    roughness: 0.94,
    metalness: 0.01,
  });
  rockProjection(mountainMat, 60);

  const terrainSize = 1360; // cubits (±680 c)
  const segs = 160;
  const tGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
  tGeo.rotateX(-Math.PI / 2);
  const pos = tGeo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const edge = Math.max(Math.abs(vx), Math.abs(vz));
    // Sink terrain mesh slightly inside the paved precinct so courtFloor never z-fights
    const y = mountainCubits(vx, vz, true) - (edge < 250.2 ? 0.35 : 0);
    pos.setY(i, y);
  }
  tGeo.computeVertexNormals();
  const mountainMesh = new THREE.Mesh(tGeo, mountainMat);
  mountainMesh.receiveShadow = true;
  mountainMesh.castShadow = false;
  mountainMesh.userData.dynamic = true; // large terrain keeps own UV projection
  mountainMesh.userData.noCast = true;
  dynamicGroup.add(mountainMesh);

  // Outer surrounding desert ring scaled outside the 500×500 precinct & eastern river valley
  const desert = buildDesert(() => true, 265);
  desert.scale.set(2.6, 0.85, 2.6);
  desert.position.y = -52;
  desert.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.userData.dynamic = true;
      o.userData.noCast = true;
    }
  });
  dynamicGroup.add(desert);

  // Eastern Valley Grassy Banks along the Living River (Ezek 47:7, 12)
  const bankMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4d7c3f'),
    roughness: 0.92,
  });
  for (const side of [-1, 1]) {
    const bankGeo = new THREE.PlaneGeometry(240, 36, 48, 8);
    bankGeo.rotateX(-Math.PI / 2);
    const bp = bankGeo.attributes.position!;
    for (let i = 0; i < bp.count; i++) {
      const lx = bp.getX(i) + 378; // 258 .. 498 c
      const riverCenterZ = -15.5 - Math.sin(Math.max(0, lx - 256) / 140) * 6;
      const riverHalf = 2.0 + smoothstep(256, 480, lx) * 12.5;
      const lz = riverCenterZ + side * (riverHalf + 15) + bp.getZ(i);
      bp.setX(i, lx);
      bp.setZ(i, lz);
      bp.setY(i, mountainCubits(lx, lz) + 0.24);
    }
    bankGeo.computeVertexNormals();
    const bank = new THREE.Mesh(bankGeo, bankMat);
    bank.receiveShadow = true;
    bank.userData.dynamic = true;
    bank.userData.noCast = true;
    dynamicGroup.add(bank);
  }

  // ---------------------------------------------------------------------------
  // 2. OUTER COURTYARD (500 x 500 c) + RITZPAH PAVEMENT + OUTER WALL (6 x 6 c)
  // ---------------------------------------------------------------------------
  const courtFloor = new THREE.Mesh(new THREE.BoxGeometry(500, 0.4, 500), tex.pavingMat);
  courtFloor.position.set(0, -0.2, 0);
  courtFloor.receiveShadow = true;
  courtFloor.userData.dynamic = true;
  courtFloor.userData.noCast = true;
  dynamicGroup.add(courtFloor);
  pushPlatform(-250, -0.4, -250, 250, 0.0, 250);

  // Lower Pavement (Ritzpah, 50 c band along East, North, South inside wall, Ezek 40:17-18)
  const addPavingBand = (x0: number, z0: number, x1: number, z1: number) => {
    const w = Math.abs(x1 - x0);
    const d = Math.abs(z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), tex.ritzpahMat);
    m.position.set((x0 + x1) * 0.5, -0.015, (z0 + z1) * 0.5);
    m.receiveShadow = true;
    m.userData.dynamic = true;
    m.userData.noCast = true;
    dynamicGroup.add(m);
  };
  addPavingBand(200, 12.5, 250, 220);
  addPavingBand(200, -220, 250, -12.5);
  addPavingBand(12.5, 200, 210, 250);
  addPavingBand(-210, 200, -12.5, 250);
  addPavingBand(12.5, -250, 210, -200);
  addPavingBand(-210, -250, -12.5, -200);

  // Outer Wall (6 c thick x 6 c high above Outer Court, Ezek 40:5)
  // West wall continuous (-256..-250)
  addSolidBlock(-256, OUTSIDE_C, -256, -250, 6, 256, tex.ashlarMat);
  // North wall (gap -12.5..+12.5 for North Outer Gate)
  addSolidBlock(-250, OUTSIDE_C, 250, -12.5, 6, 256, tex.ashlarMat);
  addSolidBlock(12.5, OUTSIDE_C, 250, 256, 6, 256, tex.ashlarMat);
  // South wall (gap -12.5..+12.5 for South Outer Gate)
  addSolidBlock(-250, OUTSIDE_C, -256, -12.5, 6, -250, tex.ashlarMat);
  addSolidBlock(12.5, OUTSIDE_C, -256, 256, 6, -250, tex.ashlarMat);
  // East wall (gap -12.5..+12.5 for East Outer Gate, plus arched water culvert at Z = -18.5..-13.0)
  addSolidBlock(250, OUTSIDE_C, 12.5, 256, 6, 250, tex.ashlarMat);
  addSolidBlock(250, OUTSIDE_C, -13.0, 256, 6, -12.5, tex.ashlarMat);
  addSolidBlock(250, 2.8, -18.5, 256, 6, -13.0, tex.ashlarMat); // stone arch lintel over river
  addSolidBlock(250, OUTSIDE_C, -250, 256, 6, -18.5, tex.ashlarMat);

  // ---------------------------------------------------------------------------
  // 3. THIRTY OUTER CHAMBERS (Ezek 40:17) & FOUR CORNER KITCHENS (Ezek 46:21-24)
  // ---------------------------------------------------------------------------
  const smokePuffs: { sprite: THREE.Sprite; baseY: number; phase: number; speed: number }[] = [];

  function buildOuterChamber(cx: number, cz: number, rotY: number): void {
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.rotation.y = rotY;
    // Backing against outer wall (+Z local = outer wall edge), open veranda facing -Z local
    addBoxMesh(g, 0, 0, 2, 22, 7.5, 14, tex.ashlarMat); // chamber volume
    addBoxMesh(g, 0, 7.5, 0, 24, 1.1, 18, tex.ashlarTrimMat); // entablature roof cornice
    // 4 veranda limestone columns facing courtyard
    for (const px of [-9.5, -3.2, 3.2, 9.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, 7.5, 12), tex.ashlarTrimMat);
      col.position.set(px, 3.75, -7.2);
      col.castShadow = true;
      col.receiveShadow = true;
      g.add(col);
    }
    // Cedar doorway frame facing inward
    addBoxMesh(g, 0, 0, -5.05, 4.4, 5.2, 0.35, tex.cedarPlainMat);
    staticGroup.add(g);

    // Axis-aligned collider for chamber footprint
    const hw = Math.abs(Math.cos(rotY)) * 11 + Math.abs(Math.sin(rotY)) * 8.5;
    const hd = Math.abs(Math.sin(rotY)) * 11 + Math.abs(Math.cos(rotY)) * 8.5;
    pushCollider(cx - hw, 0, cz - hd, cx + hw, 8.6, cz + hd);
    counts.outerChambers++;
  }

  // 10 North Chambers, 10 South Chambers, 10 East Chambers = 30 total (Ezek 40:17)
  const bayCoords = [-182, -148, -114, -80, -46, 46, 80, 114, 148, 182];
  for (const bx of bayCoords) {
    buildOuterChamber(bx, 240, 0); // North
    buildOuterChamber(bx, -240, Math.PI); // South
  }
  const eastBayZ = [-188, -154, -120, -86, -52, 46, 80, 114, 148, 182];
  for (const bz of eastBayZ) {
    buildOuterChamber(240, bz, Math.PI / 2); // East
  }

  // Four Corner Boiling Kitchens (40 x 30 c each, Ezek 46:21-24)
  const kitchenSpecs = [
    { x0: 210, z0: 220, x1: 250, z1: 250, openSide: 'W' as const },
    { x0: 210, z0: -250, x1: 250, z1: -220, openSide: 'W' as const },
    { x0: -250, z0: 220, x1: -210, z1: 250, openSide: 'E' as const },
    { x0: -250, z0: -250, x1: -210, z1: -220, openSide: 'E' as const },
  ];
  for (const k of kitchenSpecs) {
    // Interior walls (6 c high) leaving an 8-c courtyard doorway on the inward side
    const mx = (k.x0 + k.x1) * 0.5;
    const mz = (k.z0 + k.z1) * 0.5;
    // N/S boundary walls of the 40x30 kitchen
    const innerZ = k.z0 > 0 ? k.z0 : k.z1;
    addSolidBlock(k.x0, 0, innerZ - 1.5, k.x1, 5.5, innerZ + 1.5, tex.ashlarMat);
    // Inward X wall with doorway
    const doorWallX = k.openSide === 'W' ? k.x0 : k.x1;
    addSolidBlock(doorWallX - 1.5, 0, k.z0, doorWallX + 1.5, 5.5, mz - 4.5, tex.ashlarMat);
    addSolidBlock(doorWallX - 1.5, 0, mz + 4.5, doorWallX + 1.5, 5.5, k.z1, tex.ashlarMat);
    // Masonry boiling hearths along N & S kitchen walls (Ezek 46:23)
    for (const hz of [k.z0 + 4, k.z1 - 4]) {
      addSolidBlock(k.x0 + 4, 0, hz - 2, k.x1 - 4, 1.8, hz + 2, tex.hearthMat);
      for (let i = 0; i < 3; i++) {
        const cxp = k.x0 + 9 + i * 11;
        // Bronze boiling cauldron + glowing embers
        const embers = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.25, 16), tex.emberMat);
        embers.position.set(cxp, 1.9, hz);
        staticGroup.add(embers);
        const cauldron = new THREE.Mesh(
          new THREE.SphereGeometry(1.45, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65),
          tex.bronzeMat,
        );
        cauldron.position.set(cxp, 2.7, hz);
        cauldron.castShadow = true;
        staticGroup.add(cauldron);
      }
    }
    // Gentle steam plume rising from kitchen center-hearths
    for (let s = 0; s < 3; s++) {
      const spMat = new THREE.SpriteMaterial({
        map: tex.smokeTex,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(spMat);
      const sx = mx + (s - 1) * 9;
      const sz = mz + (s % 2 === 0 ? -9 : 9);
      sp.position.set(sx, 4.5, sz);
      sp.scale.set(5.5, 5.5, 1);
      sp.userData.dynamic = true;
      sp.userData.noCast = true;
      sp.userData.noAO = true;
      dynamicGroup.add(sp);
      smokePuffs.push({ sprite: sp, baseY: 4.0, phase: s * 2.1 + k.x0 * 0.03, speed: 0.65 });
    }
    counts.kitchens++;
  }

  // ---------------------------------------------------------------------------
  // 4. THREE OUTER & THREE INNER GATEHOUSES (50 x 25 c, Ezek 40:6-43)
  // ---------------------------------------------------------------------------
  function buildGatehouse(dir: 'E' | 'N' | 'S', inner: boolean): void {
    const startDist = inner ? 100 : 250;
    const baseFloor = inner ? INNER_C : OUTER_C;
    const approachFloor = inner ? OUTER_C : OUTSIDE_C;
    const stepCount = inner ? 8 : 7;

    // Map gate-local (u: 0..50 from outer wall inward, v: -12.5..+12.5 transverse) -> world (x, z)
    const toWorld = (u: number, v: number): [number, number] => {
      if (dir === 'E') return [startDist - u, v];
      if (dir === 'N') return [v, startDist - u];
      return [-v, -startDist + u];
    };

    const addLocalBox = (
      u0: number,
      y0: number,
      v0: number,
      u1: number,
      y1: number,
      v1: number,
      mat: THREE.Material,
      collide = true,
    ) => {
      const [wx0, wz0] = toWorld(u0, v0);
      const [wx1, wz1] = toWorld(u1, v1);
      addSolidBoxWorld(
        Math.min(wx0, wx1),
        y0,
        Math.min(wz0, wz1),
        Math.max(wx0, wx1),
        y1,
        Math.max(wz0, wz1),
        mat,
        collide,
      );
    };

    function addSolidBoxWorld(
      x0: number,
      y0: number,
      z0: number,
      x1: number,
      y1: number,
      z1: number,
      mat: THREE.Material,
      collide = true,
    ) {
      addSolidBlock(x0, y0, z0, x1, y1, z1, mat, collide);
    }

    // Walkable gate floor slab (platform)
    const [fx0, fz0] = toWorld(0, -12.5);
    const [fx1, fz1] = toWorld(50, 12.5);
    addBoxMesh(
      staticGroup,
      (fx0 + fx1) * 0.5,
      approachFloor,
      (fz0 + fz1) * 0.5,
      Math.abs(fx1 - fx0),
      baseFloor - approachFloor + 0.04,
      Math.abs(fz1 - fz0),
      tex.pavingMat,
    );
    pushPlatform(
      Math.min(fx0, fx1),
      approachFloor,
      Math.min(fz0, fz1),
      Math.max(fx0, fx1),
      baseFloor + 0.04,
      Math.max(fz0, fz1),
    );

    // 7 or 8 Exterior Stair Treads at u = -stepCount..0 (each tread 1.0 c deep, 14 c wide)
    for (let s = 0; s < stepCount; s++) {
      const topY = approachFloor + (s + 1) * STEP_C;
      const uOuter = -(stepCount - s);
      const uInner = uOuter + 1.05;
      const [sx0, sz0] = toWorld(uOuter, -7.2);
      const [sx1, sz1] = toWorld(uInner, 7.2);
      addBoxMesh(
        staticGroup,
        (sx0 + sx1) * 0.5,
        approachFloor,
        (sz0 + sz1) * 0.5,
        Math.abs(sx1 - sx0),
        topY - approachFloor,
        Math.abs(sz1 - sz0),
        tex.ashlarTrimMat,
      );
      pushPlatform(
        Math.min(sx0, sx1),
        approachFloor,
        Math.min(sz0, sz1),
        Math.max(sx0, sx1),
        topY,
        Math.max(sz0, sz1),
      );
    }
    // Flanking stair cheek-walls (balustrades outside |v| >= 7.2)
    for (const side of [-1, 1]) {
      addLocalBox(-stepCount, approachFloor, side * 7.2, 0, baseFloor + 2.5, side * 9.0, tex.ashlarMat);
    }

    // Gatehouse layout: outer threshold (6), 3 guardrooms (6 ea) + 2 pilasters (5 ea),
    // inner threshold (6), porch (8), porch jambs (2) = 50 c.
    // Inner gatehouse flips the porch outward to u = 0..10 (Ezek 40:31, 34, 37)!
    const toGateU = (u: number) => (inner ? 50 - u : u);
    const seg = (a: number, b: number): [number, number] => {
      const ua = toGateU(a);
      const ub = toGateU(b);
      return [Math.min(ua, ub), Math.max(ua, ub)];
    };

    const H_TOWER = baseFloor + 18;
    const H_LINTEL = baseFloor + 12; // 12 c clear headroom in central corridor!

    // Outer flanking side walls full length (|v| = 11..12.5)
    for (const side of [-1, 1]) {
      addLocalBox(0, baseFloor, side * 11.0, 50, H_TOWER, side * 12.5, tex.ashlarMat);
    }

    // Helper for jambs/pilasters flanking the 10-cubit clear passage (|v| = 5.0..11.0)
    const addPierPair = (uA: number, uB: number, hTop: number, palmFace: boolean) => {
      const [u0, u1] = seg(uA, uB);
      for (const side of [-1, 1]) {
        addLocalBox(u0, baseFloor, side * 5.0, u1, hTop, side * 11.0, tex.ashlarMat);
        if (palmFace) {
          // Carved limestone palm relief veneer facing central walkway (Ezek 40:16, 22, 26)
          addLocalBox(u0 + 0.15, baseFloor + 0.5, side * 4.88, u1 - 0.15, hTop - 2.5, side * 5.02, tex.palmPilasterMat, false);
        }
      }
      // Overhead lintel spanning central opening strictly above H_LINTEL
      addLocalBox(u0, H_LINTEL, -5.0, u1, hTop, 5.0, tex.ashlarTrimMat);
    };

    // Outer Threshold (0..6)
    addPierPair(0, 6, H_TOWER, true);
    // Guardroom 1 (6..12): 1-c sill border + open recess behind |v| = 5..11
    {
      const [u0, u1] = seg(6, 12);
      for (const side of [-1, 1]) {
        addLocalBox(u0, baseFloor, side * 5.0, u1, baseFloor + 1.0, side * 6.0, tex.ashlarTrimMat);
        addLocalBox(u0, H_LINTEL, side * 5.0, u1, H_TOWER, side * 11.0, tex.ashlarMat);
      }
    }
    // Pilaster 1 (12..17) — 5 cubits with palm trees
    addPierPair(12, 17, H_TOWER, true);
    // Guardroom 2 (17..23)
    {
      const [u0, u1] = seg(17, 23);
      for (const side of [-1, 1]) {
        addLocalBox(u0, baseFloor, side * 5.0, u1, baseFloor + 1.0, side * 6.0, tex.ashlarTrimMat);
        addLocalBox(u0, H_LINTEL, side * 5.0, u1, H_TOWER, side * 11.0, tex.ashlarMat);
      }
    }
    // Pilaster 2 (23..28) — 5 cubits with palm trees
    addPierPair(23, 28, H_TOWER, true);
    // Guardroom 3 (28..34)
    {
      const [u0, u1] = seg(28, 34);
      for (const side of [-1, 1]) {
        addLocalBox(u0, baseFloor, side * 5.0, u1, baseFloor + 1.0, side * 6.0, tex.ashlarTrimMat);
        addLocalBox(u0, H_LINTEL, side * 5.0, u1, H_TOWER, side * 11.0, tex.ashlarMat);
      }
    }
    // Inner Threshold (34..40)
    addPierPair(34, 40, H_TOWER, false);
    // Porch (40..48, 8 c open vestibule with high coffered ceiling)
    {
      const [u0, u1] = seg(40, 48);
      for (const side of [-1, 1]) {
        addLocalBox(u0, baseFloor, side * 7.8, u1, H_TOWER, side * 11.0, tex.ashlarMat);
      }
      addLocalBox(u0, H_LINTEL + 1.5, -7.8, u1, H_TOWER, 7.8, tex.cedarPlainMat);
    }
    // Porch Jambs (48..50, 2 c with palm trees)
    addPierPair(48, 50, H_TOWER, true);

    // Special Feature: North Inner Gate Slaughtering Tables & Double Hooks (Ezek 40:38-43)
    if (inner && dir === 'N') {
      // 4 hewn stone tables inside the Porch (v = ±5.8..±7.4, leaving |v| < 5.5 wide open!)
      for (const side of [-1, 1]) {
        for (const tu of [3.5, 7.0]) {
          addLocalBox(tu - 0.8, baseFloor, side * 5.9, tu + 0.8, baseFloor + 1.5, side * 7.4, tex.ashlarTrimMat);
        }
        // Double hooks (shephatayim) mounted along porch side walls
        for (const hu of [3.0, 5.2, 7.4]) {
          addLocalBox(hu - 0.15, baseFloor + 2.6, side * 7.55, hu + 0.15, baseFloor + 3.1, side * 7.8, tex.bronzeMat, false);
        }
        // 4 tables outside beside the 8 steps (Ezek 40:40-41)
        for (const tu of [-5.5, -2.5]) {
          addLocalBox(tu - 0.8, approachFloor, side * 9.3, tu + 0.8, approachFloor + 1.5, side * 10.9, tex.ashlarTrimMat);
        }
      }
    }

    if (inner) counts.innerGates++;
    else counts.outerGates++;
  }

  buildGatehouse('E', false);
  buildGatehouse('N', false);
  buildGatehouse('S', false);
  buildGatehouse('E', true);
  buildGatehouse('N', true);
  buildGatehouse('S', true);

  // ---------------------------------------------------------------------------
  // 5. INNER COURT (100 x 100 c, X/Z = -50..+50) & PRIESTS' CHAMBERS (40:44-46)
  // ---------------------------------------------------------------------------
  const innerFloor = new THREE.Mesh(new THREE.BoxGeometry(100, INNER_C, 100), tex.pavingMat);
  innerFloor.position.set(0, INNER_C * 0.5, 0);
  innerFloor.receiveShadow = true;
  innerFloor.userData.dynamic = true;
  innerFloor.userData.noCast = true;
  dynamicGroup.add(innerFloor);
  pushPlatform(-50, 0, -50, 50, INNER_C, 50);

  // Inner Court Perimeter Wall (connecting East/North/South Inner Gates)
  // East inner wall (X = +50..+54), open at Gate (-5..+5) and River arch (-18.5..-13.0)
  addSolidBlock(50, OUTER_C, 12.5, 54, INNER_C + 6, 54, tex.ashlarMat);
  addSolidBlock(50, OUTER_C, -13.0, 54, INNER_C + 6, -5, tex.ashlarMat);
  addSolidBlock(50, OUTER_C, 5, 54, INNER_C + 6, 12.5, tex.ashlarMat);
  addSolidBlock(50, INNER_C + 2.2, -18.5, 54, INNER_C + 6, -13.0, tex.ashlarMat); // river culvert arch
  addSolidBlock(50, OUTER_C, -54, 54, INNER_C + 6, -18.5, tex.ashlarMat);
  // North inner wall (Z = +50..+54)
  addSolidBlock(12.5, OUTER_C, 50, 50, INNER_C + 6, 54, tex.ashlarMat);
  addSolidBlock(-50, OUTER_C, 50, -12.5, INNER_C + 6, 54, tex.ashlarMat);
  // South inner wall (Z = -54..-50)
  addSolidBlock(12.5, OUTER_C, -54, 50, INNER_C + 6, -50, tex.ashlarMat);
  addSolidBlock(-50, OUTER_C, -54, -12.5, INNER_C + 6, -50, tex.ashlarMat);
  // West retaining wall flanking 10 Temple Steps (-50..-52)
  addSolidBlock(-52, OUTER_C, 10, -49, INNER_C + 4, 50, tex.ashlarMat);
  addSolidBlock(-52, OUTER_C, -50, -49, INNER_C + 4, -10, tex.ashlarMat);

  // Priests' Chambers beside North & South Inner Gates (Ezek 40:44-46)
  for (const [cz, openSouth] of [
    [41, true],
    [-41, false],
  ] as [number, boolean][]) {
    addSolidBlock(16, INNER_C, cz - 7, 46, INNER_C + 7.5, cz + 7, tex.ashlarMat);
    const colZ = openSouth ? cz - 8.2 : cz + 8.2;
    for (const px of [19, 27, 35, 43]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 7.5, 10), tex.ashlarTrimMat);
      col.position.set(px, INNER_C + 3.75, colZ);
      col.castShadow = true;
      staticGroup.add(col);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. STEPPED ALTAR OF BURNT OFFERING AT CENTER (0, 0) (Ezek 43:13-17)
  // ---------------------------------------------------------------------------
  const AY = INNER_C;
  // Base gutter curb (18 x 18 c) — open on East (-2.6..+2.6) for steps
  addSolidBlock(-9, AY, -9, 9, AY + 0.6, -8, tex.ashlarTrimMat);
  addSolidBlock(-9, AY, 8, 9, AY + 0.6, 9, tex.ashlarTrimMat);
  addSolidBlock(-9, AY, -8, -8, AY + 0.6, 8, tex.ashlarTrimMat);
  // Lower Settle: 16 x 16 c (height 2 c)
  addSolidBlock(-8, AY, -8, 8, AY + 2, 8, tex.ashlarMat);
  // Upper Settle: 14 x 14 c (height +4 c = AY + 6)
  addSolidBlock(-7, AY + 2, -7, 7, AY + 6, 7, tex.ashlarMat);
  // Altar Hearth (Ariel): 12 x 12 c (height +4 c = AY + 10)
  addSolidBlock(-6, AY + 6, -6, 6, AY + 10, 6, tex.ashlarTrimMat);

  // Hearth sunken basalt rim & glowing sacrificial embers on top (AY + 10)
  addBoxMesh(staticGroup, 0, AY + 9.95, 0, 9.2, 0.22, 9.2, tex.hearthMat);
  const altarEmber = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.25, 7.8), tex.emberMat);
  altarEmber.position.set(0, AY + 10.12, 0);
  altarEmber.userData.dynamic = true;
  dynamicGroup.add(altarEmber);

  // 4 Corner Horns (1 c tall, Ezek 43:15)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const horn = altarHorn(1.15, 0.55, tex.ashlarTrimMat);
      horn.position.set(sx * 5.3, AY + 10.0, sz * 5.3);
      horn.castShadow = true;
      staticGroup.add(horn);
    }
  }

  // Altar Eastern Steps (Ezek 43:17) — 12 walkable treads facing East (+X)
  for (let s = 0; s < 12; s++) {
    const topY = AY + ((s + 1) / 12) * 9.5;
    const xEnd = 16.0 - s * 0.82;
    const xStart = xEnd - 0.85;
    addBoxMesh(staticGroup, (xStart + xEnd) * 0.5, AY, 0, 0.85, topY - AY, 4.6, tex.ashlarTrimMat);
    pushPlatform(xStart, AY, -2.3, xEnd, topY, 2.3);
  }
  for (const side of [-1, 1]) {
    addSolidBlock(7.5, AY, side * 2.35, 16.0, AY + 3.0, side * 3.1, tex.ashlarMat);
  }

  // Dynamic Altar Flame Glow & Light
  const altarLight = new THREE.PointLight('#ff9a3c', 18, 45, 1.5);
  altarLight.position.set(0, AY + 12.2, 0);
  altarLight.userData.dynamic = true;
  dynamicGroup.add(altarLight);

  // ---------------------------------------------------------------------------
  // 7. TEMPLE HOUSE (HaBayit, Ezek 40:48-49; 41:1-26) ON 10 STEPS (TEMPLE_Y)
  // ---------------------------------------------------------------------------
  // 10 Temple Steps (X = -50..-56, Z = -9..+9, rising INNER_C -> TEMPLE_C)
  for (let s = 0; s < 10; s++) {
    const topY = INNER_C + (s + 1) * STEP_C;
    const xEast = -50 - s * 0.6;
    const xWest = xEast - 0.65;
    addBoxMesh(staticGroup, (xEast + xWest) * 0.5, INNER_C, 0, 0.65, topY - INNER_C, 18.0, tex.ashlarTrimMat);
    pushPlatform(xWest, INNER_C, -9.0, xEast, topY, 9.0);
  }
  for (const side of [-1, 1]) {
    addSolidBlock(-56, INNER_C, side * 9.0, -50, TEMPLE_C + 2.0, side * 10.4, tex.ashlarMat);
  }

  // Raised Temple Foundation Platform (6 c high above outside, Ezek 41:8)
  const templeDeck = new THREE.Mesh(new THREE.BoxGeometry(100, TEMPLE_C, 60), tex.pavingMat);
  templeDeck.position.set(-106, TEMPLE_C * 0.5, 0);
  templeDeck.receiveShadow = true;
  templeDeck.userData.dynamic = true;
  templeDeck.userData.noCast = true;
  dynamicGroup.add(templeDeck);
  pushPlatform(-156, 0, -30, -56, TEMPLE_C, 30);

  const TY = TEMPLE_C;
  const H_HOUSE = TY + 20;

  // PORCH (Ulam, X = -56..-68 = 12 c, Z = -10..+10 = 20 c interior, Ezek 40:48-49)
  // Entrance Jambs 5 c wide framing 14-cubit clear opening (|Z| < 7.0)
  for (const side of [-1, 1]) {
    addSolidBlock(-60, TY, side * 7.0, -56, H_HOUSE, side * 14.0, tex.ashlarMat); // entrance jamb piers
    addSolidBlock(-68, TY, side * 10.0, -60, H_HOUSE, side * 14.0, tex.ashlarMat); // porch side walls
    // Two monumental entrance pillars (Ezek 40:49) flanking entrance outside jambs
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 16.5, 18), tex.bronzeMat);
    pil.position.set(-57.6, TY + 8.25, side * 7.6);
    pil.castShadow = true;
    staticGroup.add(pil);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 0.8, 1.8, 16), tex.debirGoldMat);
    cap.position.set(-57.6, TY + 17.1, side * 7.6);
    cap.castShadow = true;
    staticGroup.add(cap);
  }
  // Porch roof & entrance lintel above Y = TY + 15 c
  addSolidBlock(-68, TY + 15, -14, -56, H_HOUSE + 2, 14, tex.ashlarTrimMat);

  // PORCH-TO-HEKHAL DIVIDING WALL (6 c thick, X = -68..-74, doorway 10 c wide |Z| < 5, Ezek 41:1)
  for (const side of [-1, 1]) {
    addSolidBlock(-74, TY, side * 5.0, -68, H_HOUSE, side * 14.0, tex.ashlarMat);
    // Open carved cedar double-leaf doors swung safely beside jambs (Ezek 41:23-25)
    addBoxMesh(staticGroup, -71, TY, side * 4.75, 4.4, 12.5, 0.35, tex.cedarCarvedMat);
  }
  addSolidBlock(-74, TY + 13.5, -5.0, -68, H_HOUSE, 5.0, tex.ashlarTrimMat);

  // HOLY PLACE (Hekhal, 40 x 20 c: X = -74..-114, Z = -10..+10, Ezek 41:2, 18-22)
  for (const side of [-1, 1]) {
    // 6-cubit solid inner sanctuary walls (|Z| = 10..16)
    addSolidBlock(-142, TY, side * 10.0, -74, H_HOUSE, side * 16.0, tex.ashlarMat);
    // Interior cedar paneling carved with alternating Palm Trees & Two-Faced Cherubim (Ezek 41:18-20)
    const panelW = 10; // 4 panels of 10 c along the 40 c Hekhal wall
    for (let k = 0; k < 4; k++) {
      const px = -79 - k * panelW;
      const pMesh = bevelBox(panelW - 0.15, 13.5, 0.28, tex.cedarCarvedMat, 0.02);
      pMesh.position.set(px, TY + 6.9, side * 9.82);
      const uv = pMesh.geometry.attributes.uv;
      if (uv) {
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
        uv.needsUpdate = true;
      }
      pMesh.receiveShadow = true;
      staticGroup.add(pMesh);
    }
    // Gilded upper cornice & cedar clerestory trim
    addBoxMesh(staticGroup, -94, TY + 14.0, side * 9.75, 40, 1.2, 0.4, tex.debirGoldMat);
  }
  // Coffered Cedar Ceiling above Hekhal (TY + 18.5..20)
  addSolidBlock(-114, TY + 18.5, -10.2, -74, H_HOUSE + 0.5, 10.2, tex.cedarPlainMat);

  // WOODEN ALTAR-TABLE ("This is the table that is before Yahweh", Ezek 41:22: 3 c high x 2 x 2)
  addBoxMesh(staticGroup, -109, TY, 0, 2.0, 2.8, 2.0, tex.cedarPlainMat, 0.04, 0.45);
  addBoxMesh(staticGroup, -109, TY + 2.8, 0, 2.25, 0.25, 2.25, tex.debirGoldMat, 0.02, 0.4);
  for (const sx of [-0.95, 0.95]) {
    for (const sz of [-0.95, 0.95]) {
      const finial = altarHorn(0.45, 0.18, tex.debirGoldMat);
      finial.position.set(-109 + sx, TY + 3.05, sz);
      staticGroup.add(finial);
    }
  }
  pushCollider(-110.0, TY, -1.0, -108.0, TY + 3.5, 1.0);

  // DEBĪR DIVIDING WALL (2 c thick, X = -114..-116, doorway 6 c wide |Z| < 3, Ezek 41:3)
  for (const side of [-1, 1]) {
    addSolidBlock(-116, TY, side * 3.0, -114, H_HOUSE, side * 10.0, tex.cedarCarvedMat);
    // Open golden-cedar double doors tucked inside jambs
    addBoxMesh(staticGroup, -115, TY, side * 2.82, 1.8, 11.5, 0.22, tex.debirGoldMat);
  }
  addSolidBlock(-116, TY + 12.0, -3.0, -114, H_HOUSE, 3.0, tex.debirGoldMat);

  // MOST HOLY PLACE (Debir, 20 x 20 c: X = -116..-136, Z = -10..+10, Ezek 41:4)
  addSolidBlock(-142, TY, -16, -136, H_HOUSE, 16, tex.ashlarMat); // rear wall
  addBoxMesh(staticGroup, -135.82, TY, 0, 0.28, 15.0, 19.6, tex.debirGoldMat); // golden inner walls
  addBoxMesh(staticGroup, -126, TY, 9.82, 19.6, 15.0, 0.28, tex.debirGoldMat);
  addBoxMesh(staticGroup, -126, TY, -9.82, 19.6, 15.0, 0.28, tex.debirGoldMat);
  addSolidBlock(-136, TY + 17.5, -10.2, -116, H_HOUSE + 0.5, 10.2, tex.debirGoldMat);

  // Soft golden sanctuary interior lighting (picked up by CubeCamera + real-time)
  const hekhalLight = new THREE.PointLight('#ffd27d', 14, 52, 1.4);
  hekhalLight.position.set(-96, TY + 13, 0);
  hekhalLight.userData.dynamic = true;
  dynamicGroup.add(hekhalLight);

  const debirLight = new THREE.PointLight('#ffdf8a', 18, 42, 1.4);
  debirLight.position.set(-126, TY + 12, 0);
  debirLight.userData.dynamic = true;
  dynamicGroup.add(debirLight);

  // 3-STORY SIDE CHAMBERS (Ezek 41:5-11: N, S, W, 30 rooms/story stepped wider upward 4->5->6 c)
  // Flanking Z = ±16..±25 and X = -142..-150
  for (let story = 0; story < 3; story++) {
    const sy0 = TY + story * 5.0;
    const sy1 = sy0 + 4.8;
    const outerZ = 22.0 + story * 1.0; // steps wider upward on recessed wall ledges!
    const outerX = -148.0 - story * 1.0;
    for (const side of [-1, 1]) {
      addSolidBlock(-148, sy0, side * outerZ, -72, sy1, side * (outerZ + 3.2), tex.ashlarMat);
      // Partition ribs dividing chambers along N/S (11 bays each side)
      for (let i = 0; i <= 10; i++) {
        const rx = -75 - i * 6.8;
        addBoxMesh(staticGroup, rx, sy0, side * (16 + (outerZ - 16) * 0.5), 0.7, 4.6, outerZ - 15.8, tex.ashlarTrimMat);
        counts.sideChambers++;
      }
    }
    // West side-chamber gallery
    addSolidBlock(outerX - 3.0, sy0, -outerZ, outerX, sy1, outerZ, tex.ashlarMat);
    for (let j = -3; j <= 3; j++) {
      addBoxMesh(staticGroup, -145, sy0, j * 5.2, 6.2, 4.6, 0.7, tex.ashlarTrimMat);
    }
  }
  // Roof slab over 3-story side chambers
  addSolidBlock(-151, TY + 14.8, 15.8, -71, TY + 15.8, 25.5, tex.ashlarTrimMat);
  addSolidBlock(-151, TY + 14.8, -25.5, -71, TY + 15.8, -15.8, tex.ashlarTrimMat);
  addSolidBlock(-151, TY + 14.8, -25.5, -141.5, TY + 15.8, 25.5, tex.ashlarTrimMat);

  // ---------------------------------------------------------------------------
  // 8. BINYAN (SEPARATE BUILDING 70x90 c, Ezek 41:12-15) & PRIESTS' SACRISTIES (42:1-14)
  // ---------------------------------------------------------------------------
  // Binyan behind 18-c rear Gizrah (X = -168..-248, Z = -50..+50, height 18 c)
  addSolidBlock(-248, OUTER_C, -50, -168, OUTER_C + 18, 50, tex.ashlarMat);
  // Monumental exterior buttress pilasters along Binyan East facade facing Temple
  for (let bz = -44; bz <= 44; bz += 11) {
    addBoxMesh(staticGroup, -167.5, OUTER_C, bz, 1.4, 17.5, 2.6, tex.ashlarTrimMat);
  }

  // North & South 3-Story Stepped Priests' Sacristy Blocks (Ezek 42:1-14)
  // Across 20-c Gizrah walkways (Z = +47..+97 and Z = -97..-47, X = -150..-50)
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 3; tier++) {
      const tzIn = 47 + tier * 5.5;
      const tzOut = 97;
      const ty0 = OUTER_C + tier * 5.2;
      addSolidBlock(
        -150,
        ty0,
        side > 0 ? tzIn : -tzOut,
        -50,
        ty0 + 5.0,
        side > 0 ? tzOut : -tzIn,
        tex.ashlarMat,
      );
      // Colonnade gallery pillars along stepped sacristy terraces (42:3, 6)
      for (let px = -144; px <= -56; px += 11) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 5.0, 10), tex.ashlarTrimMat);
        col.position.set(px, ty0 + 2.5, side * (tzIn + 1.2));
        col.castShadow = true;
        staticGroup.add(col);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 9. ANICONIC EASTERN GLORY RADIANCE SHAFTS (Ezek 43:1-5 — ZERO HUMAN FORM!)
  // ---------------------------------------------------------------------------
  const gloryBeams: { mesh: THREE.Mesh; baseOpacity: number; phase: number }[] = [];
  const beamConfigs = [
    { x: 225, y: 26, z: 0, len: 120, w: 18, tilt: 0.38, op: 0.16 },
    { x: 155, y: 24, z: 0, len: 115, w: 20, tilt: 0.36, op: 0.17 },
    { x: 75, y: 22, z: 0, len: 105, w: 17, tilt: 0.35, op: 0.18 },
    { x: -18, y: 21, z: 0, len: 95, w: 18, tilt: 0.33, op: 0.19 },
    { x: -64, y: 18, z: 0, len: 64, w: 13, tilt: 0.3, op: 0.22 },
    { x: -94, y: 15, z: 0, len: 46, w: 11, tilt: 0.25, op: 0.24 },
  ];
  for (let i = 0; i < beamConfigs.length; i++) {
    const bc = beamConfigs[i]!;
    const bMat = new THREE.MeshBasicMaterial({
      map: tex.beamTex,
      color: new THREE.Color('#ffda82'),
      transparent: true,
      opacity: bc.op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const rot of [0, Math.PI / 2]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(bc.w, bc.len), bMat);
      plane.position.set(bc.x, bc.y, bc.z);
      plane.rotation.z = Math.PI * 0.5 - bc.tilt;
      if (rot !== 0) plane.rotateY(rot);
      plane.userData.dynamic = true;
      plane.userData.noCast = true;
      plane.userData.noAO = true;
      dynamicGroup.add(plane);
      gloryBeams.push({ mesh: plane, baseOpacity: bc.op, phase: i * 0.8 + rot });
    }
  }

  // ---------------------------------------------------------------------------
  // 10. LIVING RIVER (Ezek 47:1-12) & FRUIT TREES ON BOTH BANKS
  // ---------------------------------------------------------------------------
  // Build custom continuous river ribbon from south Temple threshold (X = -56, Z = -14)
  // south of the Altar, through East Inner & Outer culvert arches, widening East to +480 c!
  const riverSegsX = 110;
  const rPositions: number[] = [];
  const rUvs: number[] = [];
  const rIndices: number[] = [];

  for (let i = 0; i <= riverSegsX; i++) {
    const t = i / riverSegsX;
    const rx = -56 + t * 536; // -56 .. +480 c
    const riverZ = rx <= 256 ? -15.5 : -15.5 - Math.sin((rx - 256) / 140) * 6;
    const halfW =
      rx < 256
        ? 1.35 + smoothstep(-56, 256, rx) * 0.65
        : 2.0 + smoothstep(256, 480, rx) * 12.2;

    let ry = INNER_C + 0.09;
    if (rx >= 50 && rx < 56) {
      // Gentle cascade down from Inner Court level to Outer Court level inside culvert
      ry = INNER_C + 0.09 - smoothstep(50, 56, rx) * (INNER_C - OUTER_C);
    } else if (rx >= 56 && rx <= 250) {
      ry = OUTER_C + 0.095;
    } else if (rx > 250 && rx < 260) {
      ry = OUTER_C + 0.095 - smoothstep(250, 260, rx) * (OUTER_C - OUTSIDE_C);
    } else if (rx >= 260) {
      ry = mountainCubits(rx, riverZ) + 0.48;
    }

    rPositions.push(rx, ry, riverZ - halfW);
    rPositions.push(rx, ry, riverZ + halfW);
    rUvs.push(t * 28, 0);
    rUvs.push(t * 28, 1);

    if (i < riverSegsX) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      rIndices.push(a, b, c, b, d, c);
    }
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPositions, 3));
  rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
  rGeo.setIndex(rIndices);
  rGeo.computeVertexNormals();
  const riverMesh = new THREE.Mesh(rGeo, tex.waterMat);
  riverMesh.receiveShadow = true;
  riverMesh.userData.dynamic = true;
  riverMesh.userData.noCast = true;
  dynamicGroup.add(riverMesh);

  // Subtle limestone spring portal beside south edge of Temple threshold (Ezek 47:1) + low steppable curbs
  addBoxMesh(staticGroup, -56, INNER_C, -15.5, 2.2, 2.2, 4.2, tex.ashlarTrimMat);
  for (const cz of [-17.4, -13.6]) {
    addBoxMesh(staticGroup, -2, INNER_C, cz, 102, 0.14, 0.4, tex.ashlarTrimMat);
    addBoxMesh(staticGroup, 152, OUTER_C, cz, 194, 0.14, 0.4, tex.ashlarTrimMat);
  }

  // Fruit Trees along BOTH banks of the Living River East of Outer Wall (Ezek 47:7, 12)
  function addFruitTree(tx: number, tz: number, scale: number): void {
    const ty = mountainCubits(tx, tz);
    const tg = new THREE.Group();
    tg.position.set(tx, ty, tz);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.75 * scale, 5.2 * scale, 8), tex.barkMat);
    trunk.position.y = 2.6 * scale;
    trunk.castShadow = true;
    tg.add(trunk);

    const crowns: [number, number, number, number][] = [
      [0, 6.2, 0, 3.0],
      [-1.5, 5.3, 1.1, 2.2],
      [1.6, 5.5, -1.0, 2.1],
    ];
    for (const [cx, cy, cz, rad] of crowns) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(rad * scale, 1), tex.foliageMat);
      crown.position.set(cx * scale, cy * scale, cz * scale);
      crown.castShadow = true;
      crown.receiveShadow = true;
      tg.add(crown);
    }
    staticGroup.add(tg);
    counts.fruitTrees++;
  }

  for (let i = 0; i < 14; i++) {
    const rx = 272 + i * 14.5;
    const riverZ = -15.5 - Math.sin((rx - 256) / 140) * 6;
    const offset = 6.5 + smoothstep(256, 480, rx) * 14.0;
    addFruitTree(rx, riverZ + offset, 0.9 + (i % 3) * 0.16);
    addFruitTree(rx + 6, riverZ - offset, 0.95 + ((i + 1) % 3) * 0.15);
  }

  // Batch static architectural geometry before applying live cubit scaling
  batchStatic(staticGroup);

  // Scale helper so dynamic Cubit slider updates 3D scale + colliders + platforms cleanly!
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
    altarLight.distance = 45 * cubitVal;
    hekhalLight.distance = 52 * cubitVal;
    debirLight.distance = 42 * cubitVal;
  };

  syncScaledBoxes(currentCubit);

  const result: EzekielTemple = {
    group: root,
    colliders,
    platforms,
    counts,
    CUBIT: currentCubit,
    OUTSIDE_Y: OUTSIDE_C * currentCubit,
    OUTER_Y: OUTER_C * currentCubit,
    INNER_Y: INNER_C * currentCubit,
    TEMPLE_Y: TEMPLE_C * currentCubit,
    floorY(x: number, z: number): number {
      return mountainCubits(x / result.CUBIT, z / result.CUBIT) * result.CUBIT;
    },
    rescale(newCubit: number): number {
      const clamped = Math.max(0.4, Math.min(0.6, newCubit));
      currentCubit = clamped;
      result.CUBIT = clamped;
      result.OUTSIDE_Y = OUTSIDE_C * clamped;
      result.OUTER_Y = OUTER_C * clamped;
      result.INNER_Y = INNER_C * clamped;
      result.TEMPLE_Y = TEMPLE_C * clamped;
      syncScaledBoxes(clamped);
      return clamped;
    },
    update(dt: number, elapsed: number): void {
      // Scroll Living River flow East (+X)
      tex.waterAlbedo.offset.x -= dt * 0.42;
      tex.waterNormal.offset.x -= dt * 0.65;
      tex.waterNormal.offset.y += Math.sin(elapsed * 0.7) * dt * 0.04;

      // Warm sacrificial altar ember breathing
      const emberPulse = 1.3 + Math.sin(elapsed * 3.1) * 0.25 + Math.sin(elapsed * 7.3) * 0.1;
      tex.emberMat.emissiveIntensity = emberPulse;
      altarLight.intensity = 17 + Math.sin(elapsed * 3.6) * 3.2;

      // Gentle boiling kitchen steam rise
      for (const p of smokePuffs) {
        const cycle = (elapsed * 0.28 + p.phase) % 1;
        p.sprite.position.y = p.baseY + cycle * 11;
        const mat = p.sprite.material as THREE.SpriteMaterial;
        mat.opacity = Math.sin(cycle * Math.PI) * 0.34;
        const sc = 4.2 + cycle * 4.5;
        p.sprite.scale.set(sc, sc, 1);
      }

      // Subtle living shimmer on the Eastern Glory radiance shafts (Ezek 43:2)
      for (const b of gloryBeams) {
        const mat = b.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = b.baseOpacity * (0.86 + 0.14 * Math.sin(elapsed * 1.15 + b.phase));
      }
    },
  };

  return result;
}
