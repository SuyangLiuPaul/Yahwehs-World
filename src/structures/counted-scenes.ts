import * as THREE from 'three';
import { buildCherub } from './cherub.ts';

export type JordanCrossingVariant = 'riverbed-ark' | 'gilgal-monument';
export type GideonDioramaVariant = 'three-companies' | 'pitcher-torch-horn';
export type ArkToZionVariant = 'six-paces' | 'tent-of-david';

/**
 * Compact 2.5 x 1.5 x 1.5 cubit Ark of the Covenant in gold with two facing
 * cherubim and permanent carrying poles along X (Exod 25:10-20).
 */
function buildMeasuredArk(C: number): THREE.Group {
  const L = 2.5 * C;
  const W = 1.5 * C;
  const H = 1.5 * C;
  const g = new THREE.Group();

  const gold = new THREE.MeshStandardMaterial({ color: 0xecb943, metalness: 0.88, roughness: 0.22 });
  const crown = new THREE.MeshStandardMaterial({ color: 0xf7cf65, metalness: 0.92, roughness: 0.16 });

  const legH = 0.08 * C;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16 * C, legH, 0.16 * C), crown);
      foot.position.set(sx * (L * 0.5 - 0.1 * C), legH * 0.5, sz * (W * 0.5 - 0.1 * C));
      g.add(foot);
    }
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H - legH - 0.06 * C, W), gold);
  body.position.y = legH + (H - legH - 0.06 * C) * 0.5;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(L + 0.08 * C, 0.08 * C, W + 0.08 * C), crown);
  rim.position.y = H - 0.02 * C;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(L + 0.04 * C, 0.06 * C, W + 0.04 * C), gold);
  lid.position.y = H + 0.04 * C;
  g.add(body, rim, lid);

  const ringGeo = new THREE.TorusGeometry(0.075 * C, 0.022 * C, 8, 16);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, crown);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * (L * 0.5 - 0.12 * C), legH + 0.12 * C, sz * (W * 0.5 + 0.04 * C));
      g.add(ring);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * C, 0.042 * C, L * 1.95, 12), gold);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, legH + 0.12 * C, sz * (W * 0.5 + 0.04 * C));
    g.add(pole);
  }

  for (const sx of [-1, 1]) {
    const ch = buildCherub(C * 0.85, crown);
    ch.position.set(sx * L * 0.34, H + 0.075 * C, 0);
    ch.rotation.y = sx > 0 ? Math.PI : 0;
    ch.userData.shimmer = sx > 0 ? 1 : 2;
    g.add(ch);
  }

  return g;
}

/**
 * Short-haired Levitical Ark bearer (1 Cor 11:14) in fine white linen tunic,
 * shoulder positioned to carry poles.
 */
function buildLeviticalBearer(C: number, facingX = 1): THREE.Group {
  const s = (C / 0.445) * 0.98; // ~1.68 m scaled cleanly with C
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc2926b, roughness: 0.72 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x261c17, roughness: 0.88 });
  const linen = new THREE.MeshStandardMaterial({ color: 0xf4eee0, roughness: 0.85 });
  const sash = new THREE.MeshStandardMaterial({ color: 0x2f5380, roughness: 0.78 });

  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.03 * s, 0.2 * s), hair);
    foot.position.set(facingX * 0.02 * s, 0.015 * s, side * 0.08 * s);
    g.add(foot);
  }

  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1.18 * s, 14), linen);
  robe.scale.set(0.72, 1, 1.05);
  robe.position.y = 0.76 * s;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.168 * s, 0.172 * s, 0.07 * s, 14), sash);
  belt.scale.set(0.73, 1, 1.06);
  belt.position.y = 0.96 * s;
  g.add(robe, belt);

  // Inner arm raised slightly toward shoulder pole, outer arm steadying
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * s, 0.038 * s, 0.46 * s, 8), linen);
  arm.position.set(facingX * 0.05 * s, 1.24 * s, 0);
  arm.rotation.z = -facingX * 0.35;
  g.add(arm);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.052 * s, 0.08 * s, 10), skin);
  neck.position.y = 1.38 * s;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.092 * s, 14, 12), skin);
  head.scale.set(0.92, 1.08, 0.86);
  head.position.y = 1.5 * s;
  const shortHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.096 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hair,
  );
  shortHair.scale.set(0.94, 0.95, 0.87);
  shortHair.position.set(-facingX * 0.008 * s, 1.515 * s, 0);
  g.add(neck, head, shortHair);

  return g;
}

/** Round river boulder cluster mesh. */
function makeRiverStone(rx: number, ry: number, rz: number, mat: THREE.Material, seed: number): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const bump = 0.88 + 0.16 * Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.7 + seed * 1.3);
    pos.setXYZ(i, vx * rx * bump, vy * ry * bump, vz * rz * bump);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// ── 1. Jordan Crossing & Twelve Memorial Stones (Joshua 3:16; 4:3, 9, 20) ─────
export function buildJordanTwelveStones(C: number, variant: JordanCrossingVariant): THREE.Group {
  const g = new THREE.Group();
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xcab58a, roughness: 0.92 });
  const mudBedMat = new THREE.MeshStandardMaterial({ color: 0x7a6c56, roughness: 0.96 });
  const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xbab09c, roughness: 0.88 });
  const riverStoneMat = new THREE.MeshStandardMaterial({ color: 0x736f68, roughness: 0.78, metalness: 0.06 });
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x5c7344, roughness: 0.86 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a7d91,
    emissive: 0x0d3642,
    emissiveIntensity: 0.35,
    roughness: 0.16,
    metalness: 0.25,
    transparent: true,
    opacity: 0.84,
  });
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0xdff2f5,
    roughness: 0.45,
    transparent: true,
    opacity: 0.65,
  });

  if (variant === 'gilgal-monument') {
    // 12 upright/set river boulders lifted from Jordan and set up at Gilgal (Josh 4:20-24)
    const terraceW = 14 * C;
    const terraceD = 12 * C;
    const bank = new THREE.Mesh(new THREE.BoxGeometry(terraceW, 0.8 * C, terraceD), sandMat);
    bank.position.y = 0.4 * C;
    g.add(bank);

    // Adjacent flowing Jordan stream edge on the East (-X / +X side)
    const jordanEdge = new THREE.Mesh(new THREE.BoxGeometry(3.5 * C, 0.48 * C, terraceD), waterMat);
    jordanEdge.position.set(terraceW * 0.5 + 1.75 * C, 0.24 * C, 0);
    jordanEdge.userData.water = 1;
    g.add(jordanEdge);

    // Low limestone paving ring under the 12 stones at Gilgal
    const ringBed = new THREE.Mesh(new THREE.CylinderGeometry(4.6 * C, 4.9 * C, 0.22 * C, 24), limestoneMat);
    ringBed.position.set(-0.6 * C, 0.88 * C, 0);
    g.add(ringBed);

    // 12 River Boulders from the Jordan riverbed (one per tribe, Josh 4:2, 20)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const rad = 3.3 * C;
      const h = (1.15 + (i % 3) * 0.22) * C;
      const stone = makeRiverStone(0.62 * C, h * 0.55, 0.54 * C, riverStoneMat, i * 1.7 + 3);
      stone.position.set(-0.6 * C + Math.cos(angle) * rad, 0.99 * C + h * 0.42, Math.sin(angle) * rad);
      stone.rotation.y = angle * 1.3;
      g.add(stone);
    }

    // Center commemorative rough plinth
    const centerPlinth = makeRiverStone(1.0 * C, 0.4 * C, 0.9 * C, limestoneMat, 42);
    centerPlinth.position.set(-0.6 * C, 1.15 * C, 0);
    g.add(centerPlinth);

    // Reed clusters along the Jordan eastern verge
    for (let i = -4; i <= 4; i++) {
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.18 * C, 1.4 * C, 6), reedMat);
      reed.position.set(terraceW * 0.5 - 0.3 * C, 1.4 * C, i * 1.2 * C);
      g.add(reed);
    }

    return g;
  }

  // Variant 'riverbed-ark': dry Jordan riverbed + heaped upstream water wall + 4 bearers + 12 riverbed stones
  const bedW = 14 * C;
  const bedD = 16 * C;
  const bed = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.4 * C, bedD), mudBedMat);
  bed.position.y = 0.2 * C;
  g.add(bed);

  // Sloping West & East earthen river banks
  for (const sx of [-1, 1]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(3.2 * C, 2.2 * C, bedD), sandMat);
    bank.position.set(sx * (bedW * 0.5 + 1.5 * C), 1.1 * C, 0);
    g.add(bank);
    for (let k = -5; k <= 5; k++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.45 * C, 8, 6), reedMat);
      bush.scale.y = 1.6;
      bush.position.set(sx * (bedW * 0.5 + 0.5 * C), 2.35 * C, k * 1.35 * C);
      g.add(bush);
    }
  }

  // Dry riverbed cobbles
  for (let i = 0; i < 36; i++) {
    const rx = ((i * 37) % 11) - 5;
    const rz = (((i * 53) % 13) - 6) * 1.05;
    const cob = makeRiverStone(0.42 * C, 0.16 * C, 0.36 * C, riverStoneMat, i + 1);
    cob.position.set(rx * C, 0.42 * C, rz * C);
    g.add(cob);
  }

  // Heaped-up Jordan water wall far upstream (-Z, Josh 3:16 "stood up in a heap far away at Adam")
  const wallH = 6.2 * C;
  const waterWall = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.1 * C, wallH, 3.6 * C), waterMat);
  waterWall.position.set(0, 0.4 * C + wallH * 0.5, -bedD * 0.5 + 1.8 * C);
  waterWall.userData.water = 2;
  g.add(waterWall);

  for (let i = 0; i < 6; i++) {
    const crest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45 * C, 0.72 * C, wallH, 10),
      i % 2 === 0 ? waterMat : foamMat,
    );
    crest.position.set((-5 + i * 2) * C, 0.4 * C + wallH * 0.5, -bedD * 0.5 + 3.45 * C);
    crest.userData.water = 3 + i;
    g.add(crest);
  }

  // Four short-haired Levitical Priests holding the Ark of the Covenant on poles in mid-Jordan (Josh 3:17)
  const arkGroup = new THREE.Group();
  const arkY = 2.85 * C; // shoulder pole height above dry bed
  const ark = buildMeasuredArk(C);
  ark.position.set(0, arkY - 0.2 * C, 0);
  arkGroup.add(ark);

  for (const px of [-2.05 * C, 2.05 * C]) {
    for (const pz of [-0.85 * C, 0.85 * C]) {
      const priest = buildLeviticalBearer(C, 1);
      priest.position.set(px, 0.4 * C, pz);
      arkGroup.add(priest);
    }
  }
  arkGroup.position.set(-1.4 * C, 0, 1.2 * C);
  g.add(arkGroup);

  // The 12 stones Joshua set up right inside the Jordan beside the priests' feet (Josh 4:9)
  const cairnBase = new THREE.Mesh(new THREE.BoxGeometry(3.2 * C, 0.24 * C, 2.4 * C), limestoneMat);
  cairnBase.position.set(3.2 * C, 0.5 * C, 1.2 * C);
  g.add(cairnBase);
  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const stone = makeRiverStone(0.36 * C, 0.28 * C, 0.34 * C, riverStoneMat, i + 19);
    stone.position.set(2.15 * C + col * 0.7 * C, 0.76 * C + (row === 1 ? 0.14 * C : 0), 0.45 * C + row * 0.72 * C);
    g.add(stone);
  }

  // Brass distance demarcation strip at downstream edge (+Z) denoting 2,000-cubit reverence margin (Josh 3:4)
  const markerStrip = new THREE.Mesh(
    new THREE.BoxGeometry(bedW * 0.82, 0.1 * C, 0.22 * C),
    new THREE.MeshStandardMaterial({ color: 0xd9b350, metalness: 0.78, roughness: 0.3 }),
  );
  markerStrip.position.set(0, 0.44 * C, bedD * 0.5 - 1.2 * C);
  g.add(markerStrip);

  return g;
}

// ── 2. Gideon's 300 in Three Companies / Pitcher-Torch-Horn (Judges 7:16-20) ───
export function buildGideonThreeHundred(_C: number, variant: GideonDioramaVariant): THREE.Group {
  if (variant === 'pitcher-torch-horn') {
    // 1:1 close museum artifact triad in metres: broken pitcher + blazing torch + curved ram's horn
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x3b3834, roughness: 0.85 });
    const clay = new THREE.MeshStandardMaterial({ color: 0xb86640, roughness: 0.88, side: THREE.DoubleSide });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd1a447, metalness: 0.82, roughness: 0.28 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xd8c39b, roughness: 0.52 });
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffc65c,
      emissive: 0xff621a,
      emissiveIntensity: 0.98,
      transparent: true,
      opacity: 0.92,
    });

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 1.15), stone);
    plinth.position.y = 0.07;
    g.add(plinth);

    // 1) Half-broken Ribbed Earthenware Pitcher (kad) on left (-X)
    const pitcher = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.21, 0.46, 18, 4, true, 0.4, Math.PI * 1.42),
      clay,
    );
    pitcher.position.set(-0.34, 0.37, 0);
    const pBase = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.08, 18), clay);
    pBase.position.set(-0.34, 0.18, 0);
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.14, 16, 1, true, 0.4, Math.PI * 1.42),
      clay,
    );
    neck.position.set(-0.34, 0.65, 0);
    g.add(pitcher, pBase, neck);

    // Shattered terracotta shards scattered around pitcher base
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 1.4 - 0.5;
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.11), clay);
      shard.position.set(-0.34 + Math.cos(a) * 0.3, 0.155, Math.sin(a) * 0.3);
      shard.rotation.y = a * 2.1;
      g.add(shard);
    }

    // 2) Blazing Resin Torch held upright inside broken pitcher opening (Judg 7:16, 20)
    const torchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.58, 10), wood);
    torchHandle.position.set(-0.32, 0.48, 0.02);
    torchHandle.rotation.z = -0.14;
    const torchHead = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.04, 0.16, 12), wood);
    torchHead.position.set(-0.27, 0.78, 0.02);
    torchHead.rotation.z = -0.14;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.34, 12), flameMat);
    flame.position.set(-0.24, 1.0, 0.02);
    flame.userData.flame = 1;
    g.add(torchHandle, torchHead, flame);

    // 3) Curved Ribbed Ram's-Horn Shofar resting on brass cradle (+X)
    for (const dx of [0.18, 0.56]) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.22, 8), brass);
      stand.position.set(dx, 0.25, 0);
      g.add(stand);
    }
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.12, 0.36, 0.04),
      new THREE.Vector3(0.32, 0.33, -0.08),
      new THREE.Vector3(0.55, 0.42, 0.02),
      new THREE.Vector3(0.68, 0.58, 0.14),
    ]);
    const shofar = new THREE.Mesh(new THREE.TubeGeometry(hornCurve, 28, 0.035, 10, false), hornMat);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 14, 1, true), hornMat);
    bell.position.set(0.7, 0.61, 0.16);
    bell.rotation.set(-0.55, 0, -0.68);
    g.add(shofar, bell);

    return g;
  }

  // Variant 'three-companies': Night valley diorama around Midianite camp with EXACTLY 300 torches (3 x 100!)
  const g = new THREE.Group();
  const spanX = 11.6;
  const spanZ = 9.2;
  const baseY = 0.54;

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(spanX + 0.8, baseY, spanZ + 0.8),
    new THREE.MeshStandardMaterial({ color: 0x161922, roughness: 0.78 }),
  );
  plinth.position.y = baseY * 0.5;
  const brass = new THREE.MeshStandardMaterial({ color: 0xc99c3c, metalness: 0.84, roughness: 0.3 });
  const rim = new THREE.Mesh(new THREE.BoxGeometry(spanX + 0.84, 0.04, spanZ + 0.84), brass);
  rim.position.y = baseY * 0.68;
  g.add(plinth, rim);

  // Night valley bowl (Harod spring/Gilboa ridge on SW -> flat Jezreel floor -> Hill of Moreh ridge on North)
  const cols = 64;
  const rows = 54;
  const terrainY = (x: number, z: number): number => {
    const r = Math.hypot(x * 0.82, z);
    // Flat central Midianite camp basin (r < 2.2), surrounded by 3 vantage hill slopes
    const rimRise = Math.max(0, (r - 2.15) * 0.38);
    const northSlope = Math.max(0, (-z - 1.6) * 0.35);
    return baseY + 0.18 + Math.min(1.55, rimRise * 0.75 + northSlope * 0.45) + 0.06 * Math.sin(x * 1.4) * Math.cos(z * 1.3);
  };

  const pos = new Float32Array(cols * rows * 3);
  const col = new Float32Array(cols * rows * 3);
  const cTmp = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const z = (r / (rows - 1) - 0.5) * spanZ;
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1) - 0.5) * spanX;
      const idx = r * cols + c;
      const y = terrainY(x, z);
      pos[idx * 3 + 0] = x;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = z;
      const hFrac = Math.min(1, (y - baseY - 0.18) / 1.4);
      cTmp.setRGB(0.18 + hFrac * 0.16, 0.21 + hFrac * 0.13, 0.22 + hFrac * 0.08);
      col[idx * 3 + 0] = cTmp.r;
      col[idx * 3 + 1] = cTmp.g;
      col[idx * 3 + 2] = cTmp.b;
    }
  }
  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  }
  const vGeo = new THREE.BufferGeometry();
  vGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  vGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  vGeo.setIndex(indices);
  vGeo.computeVertexNormals();
  g.add(new THREE.Mesh(vGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 })));

  // Midianite black goat-hair camp tents clustered inside the valley basin (Judg 7:12)
  const tentMat = new THREE.MeshStandardMaterial({ color: 0x26211e, roughness: 0.94 });
  const campGeo = new THREE.ConeGeometry(0.14, 0.14, 4);
  const tents = new THREE.InstancedMesh(campGeo, tentMat, 48);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + (i % 3) * 0.2;
    const rad = 0.25 + ((i * 19) % 100) / 68;
    const tx = Math.cos(a) * rad * 1.15;
    const tz = Math.sin(a) * rad * 0.88;
    dummy.position.set(tx, terrainY(tx, tz) + 0.07, tz);
    dummy.rotation.y = a;
    dummy.updateMatrix();
    tents.setMatrixAt(i, dummy.matrix);
  }
  g.add(tents);

  // EXACTLY 300 torches in THREE separate company arcs (100 torches per company — Judg 7:16!)
  const flameInst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.055, 0.18, 6),
    new THREE.MeshStandardMaterial({
      color: 0xffd066,
      emissive: 0xff6d1c,
      emissiveIntensity: 0.98,
    }),
    300,
  );
  const arcBands = [
    [-Math.PI * 0.88, -Math.PI * 0.28], // Company 1 (NW-N Moreh arc, 100 torches)
    [-Math.PI * 0.16, Math.PI * 0.44], // Company 2 (NE-E edge arc, 100 torches)
    [Math.PI * 0.56, Math.PI * 1.16], // Company 3 (S-SW Harod arc, 100 torches)
  ] as const;

  let idx = 0;
  for (let comp = 0; comp < 3; comp++) {
    const [a0, a1] = arcBands[comp]!;
    for (let k = 0; k < 100; k++) {
      // Arrange 100 torches per company in 2 staggered curved ranks of 50 along the ridge
      const rank = k >= 50 ? 1 : 0;
      const u = (k % 50) / 49;
      const theta = a0 + (a1 - a0) * u;
      const radius = 3.15 + rank * 0.36;
      const x = Math.cos(theta) * radius * 1.12;
      const z = Math.sin(theta) * radius * 0.88;
      dummy.position.set(x, terrainY(x, z) + 0.12, z);
      dummy.rotation.set(0, theta, 0);
      dummy.updateMatrix();
      flameInst.setMatrixAt(idx++, dummy.matrix);
    }
  }
  flameInst.userData.ember = 1;
  g.add(flameInst);

  return g;
}

// ── 3. Ark Brought Up to Zion — Six Paces & Tent of David (2 Sam 6:13, 17) ────
export function buildArkUpToZion(C: number, variant: ArkToZionVariant): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd4c8af, roughness: 0.86 });
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xc2b498, roughness: 0.88 });
  const fieldstoneMat = new THREE.MeshStandardMaterial({ color: 0x9b9282, roughness: 0.94 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9b14e, metalness: 0.82, roughness: 0.28 });

  if (variant === 'tent-of-david') {
    // Stepped courtyard platform in the City of David + pitched open-curtained Tent of David (2 Sam 6:17)
    const court = new THREE.Mesh(new THREE.BoxGeometry(12 * C, 0.32 * C, 12 * C), stoneMat);
    court.position.y = 0.16 * C;
    g.add(court);

    const tentL = 7.5 * C;
    const tentW = 7.5 * C;
    const tentH = 5.4 * C;
    const tentX = -1.6 * C;

    const linen = new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.86, side: THREE.DoubleSide });
    const navyPurple = new THREE.MeshStandardMaterial({ color: 0x3b2c5c, roughness: 0.78, side: THREE.DoubleSide });
    const crimson = new THREE.MeshStandardMaterial({ color: 0x8f2828, roughness: 0.78, side: THREE.DoubleSide });
    const cedar = new THREE.MeshStandardMaterial({ color: 0x6e4323, roughness: 0.8 });

    // Raised dais inside David's Tent
    const dais = new THREE.Mesh(new THREE.BoxGeometry(4.2 * C, 0.24 * C, 3.6 * C), stepMat);
    dais.position.set(tentX, 0.44 * C, 0);
    g.add(dais);

    // The Ark set in the midst of David's pitched tent (2 Sam 6:17)
    const ark = buildMeasuredArk(C);
    ark.position.set(tentX, 0.56 * C, 0);
    ark.rotation.y = Math.PI / 2;
    g.add(ark);

    // Open-fronted pitched tent frame (west wall closed, N/S half-draped so Ark stays visible)
    const postGeo = new THREE.CylinderGeometry(0.11 * C, 0.13 * C, tentH, 10);
    for (const px of [tentX - tentL * 0.5, tentX, tentX + tentL * 0.5]) {
      for (const pz of [-tentW * 0.5, tentW * 0.5]) {
        const post = new THREE.Mesh(postGeo, cedar);
        post.position.set(px, 0.32 * C + tentH * 0.5, pz);
        g.add(post);
      }
    }
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(tentW, tentH), navyPurple);
    backWall.rotation.y = Math.PI / 2;
    backWall.position.set(tentX - tentL * 0.5, 0.32 * C + tentH * 0.5, 0);
    const northCloth = new THREE.Mesh(new THREE.PlaneGeometry(tentL, tentH), linen);
    northCloth.position.set(tentX, 0.32 * C + tentH * 0.5, -tentW * 0.5);
    const southCurtain = new THREE.Mesh(new THREE.PlaneGeometry(tentL * 0.42, tentH), crimson);
    southCurtain.position.set(tentX - tentL * 0.29, 0.32 * C + tentH * 0.5, tentW * 0.5);
    const roofCanopy = new THREE.Mesh(new THREE.ConeGeometry(tentL * 0.72, 1.8 * C, 4), linen);
    roofCanopy.rotation.y = Math.PI / 4;
    roofCanopy.position.set(tentX, 0.32 * C + tentH + 0.9 * C, 0);
    g.add(backWall, northCloth, southCurtain, roofCanopy);

    // Altar of burnt & peace offerings right before the Tent (+X entrance, 2 Sam 6:17-18)
    const altar = new THREE.Mesh(new THREE.BoxGeometry(2.6 * C, 1.35 * C, 2.6 * C), fieldstoneMat);
    altar.position.set(3.4 * C, 0.32 * C + 0.675 * C, 0);
    const embers = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95 * C, 1.05 * C, 0.16 * C, 12),
      new THREE.MeshStandardMaterial({ color: 0xff8a2b, emissive: 0xe64a19, emissiveIntensity: 0.92 }),
    );
    embers.position.set(3.4 * C, 0.32 * C + 1.38 * C, 0);
    embers.userData.ember = 1;
    g.add(altar, embers);

    for (let i = 0; i < 4; i++) {
      const sm = new THREE.Mesh(
        new THREE.SphereGeometry((0.35 + i * 0.1) * C, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xeae5dc, transparent: true, opacity: 0.22, roughness: 1 }),
      );
      sm.position.set(3.4 * C, 2.0 * C, 0);
      sm.userData.smoke = { index: i, baseY: 2.0 * C + i * 0.5 * C, amplitude: 0.8 * C };
      g.add(sm);
    }

    return g;
  }

  // Variant 'six-paces': Ascent roadway with 6 gold-inlaid pace slabs + 4 bearers + roadside sacrifice altar
  const roadL = 13.5 * C;
  const roadW = 7.4 * C;
  const road = new THREE.Mesh(new THREE.BoxGeometry(roadL, 0.4 * C, roadW), stoneMat);
  road.position.y = 0.2 * C;
  g.add(road);

  // Six marked pace paving slabs along X from the starting threshold toward pace 6 (2 Sam 6:13)
  for (let p = 0; p < 6; p++) {
    const px = -5.2 * C + p * 1.45 * C;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(1.18 * C, 0.08 * C, 3.6 * C),
      p === 5 ? brassMat : stepMat,
    );
    slab.position.set(px, 0.44 * C, -0.6 * C);
    g.add(slab);
  }

  // Stepped ascent continuing toward the City of David beyond pace 6
  for (let st = 0; st < 4; st++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.0 * C, (0.28 + st * 0.26) * C, roadW * 0.92), stepMat);
    step.position.set(3.8 * C + st * 0.85 * C, 0.4 * C + (0.28 + st * 0.26) * 0.5 * C, 0);
    g.add(step);
  }

  // Four short-haired Levites carrying the Ark on shoulder poles right over the sixth pace (1 Chr 15:15)
  const carryX = 2.05 * C;
  const ark = buildMeasuredArk(C);
  ark.position.set(carryX, 2.75 * C, -0.6 * C);
  g.add(ark);

  for (const dx of [-2.0 * C, 2.0 * C]) {
    for (const dz of [-0.85 * C, 0.85 * C]) {
      const levite = buildLeviticalBearer(C, 1);
      levite.position.set(carryX + dx, 0.48 * C, -0.6 * C + dz);
      g.add(levite);
    }
  }

  // Wayside uncut-stone sacrifice altar beside pace 6 (ox & fatling sacrifice, 2 Sam 6:13)
  const altarX = 2.05 * C;
  const altarZ = 2.25 * C;
  const altarBlock = new THREE.Mesh(new THREE.BoxGeometry(2.1 * C, 1.3 * C, 1.9 * C), fieldstoneMat);
  altarBlock.position.set(altarX, 0.4 * C + 0.65 * C, altarZ);
  const coals = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75 * C, 0.85 * C, 0.14 * C, 10),
    new THREE.MeshStandardMaterial({ color: 0xff8a2b, emissive: 0xe64a19, emissiveIntensity: 0.9 }),
  );
  coals.position.set(altarX, 0.4 * C + 1.32 * C, altarZ);
  coals.userData.ember = 2;
  g.add(altarBlock, coals);

  for (let i = 0; i < 4; i++) {
    const sm = new THREE.Mesh(
      new THREE.SphereGeometry((0.3 + i * 0.08) * C, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8e3da, transparent: true, opacity: 0.22, roughness: 1 }),
    );
    sm.position.set(altarX, 1.9 * C, altarZ);
    sm.userData.smoke = { index: i, baseY: 1.9 * C + i * 0.45 * C, amplitude: 0.7 * C };
    g.add(sm);
  }

  return g;
}
