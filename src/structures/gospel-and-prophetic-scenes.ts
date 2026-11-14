import * as THREE from 'three';

function makeBoulder(rx: number, ry: number, rz: number, mat: THREE.Material, seed: number): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const k = 0.87 + 0.17 * Math.sin(vx * 3.3 + seed) * Math.cos(vz * 2.9 - seed * 1.4);
    pos.setXYZ(i, vx * rx * k, vy * ry * k, vz * rz * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function makeShortHairedPerson(
  heightM: number,
  tunicColor: number,
  sashColor: number,
  seated = false,
): THREE.Group {
  const s = heightM / 1.72;
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc2926b, roughness: 0.74 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x261c17, roughness: 0.88 });
  const tunic = new THREE.MeshStandardMaterial({ color: tunicColor, roughness: 0.85 });
  const sash = new THREE.MeshStandardMaterial({ color: sashColor, roughness: 0.8 });

  if (seated) {
    const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 0.42 * s, 12), tunic);
    fold.position.set(0, 0.21 * s, 0.08 * s);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.145 * s, 0.18 * s, 0.56 * s, 12), tunic);
    torso.scale.set(1.05, 1, 0.72);
    torso.position.set(0, 0.52 * s, -0.02 * s);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.092 * s, 12, 10), skin);
    head.scale.set(0.88, 1.06, 0.92);
    head.position.set(0, 0.92 * s, -0.02 * s);
    const shortHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.096 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.54),
      hair,
    );
    shortHair.scale.set(0.89, 0.95, 0.94);
    shortHair.position.set(0, 0.935 * s, -0.026 * s);
    g.add(fold, torso, head, shortHair);
    return g;
  }

  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.03 * s, 0.2 * s), hair);
    foot.position.set(side * 0.08 * s, 0.015 * s, 0.02 * s);
    g.add(foot);
  }
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.205 * s, 1.16 * s, 14), tunic);
  robe.scale.set(1.05, 1, 0.72);
  robe.position.y = 0.78 * s;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.168 * s, 0.172 * s, 0.07 * s, 14), sash);
  belt.scale.set(1.06, 1, 0.73);
  belt.position.y = 0.96 * s;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.046 * s, 0.054 * s, 0.08 * s, 10), skin);
  neck.position.y = 1.42 * s;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.094 * s, 14, 12), skin);
  head.scale.set(0.88, 1.07, 0.94);
  head.position.y = 1.54 * s;
  // Short cropped hair strictly above ears/collar (1 Cor 11:14)
  const shortHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.098 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.54),
    hair,
  );
  shortHair.scale.set(0.89, 0.95, 0.95);
  shortHair.position.set(0, 1.558 * s, -0.008 * s);
  shortHair.rotation.x = -0.2;
  g.add(robe, belt, neck, head, shortHair);
  return g;
}

function makeMuseumPlinth(spanX: number, spanZ: number, baseH = 0.54): THREE.Group {
  const g = new THREE.Group();
  const walnut = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.7, metalness: 0.08 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.78, metalness: 0.12 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd3a748, roughness: 0.28, metalness: 0.84 });

  const sub = new THREE.Mesh(new THREE.BoxGeometry(spanX + 0.76, baseH * 0.68, spanZ + 0.76), walnut);
  sub.position.y = baseH * 0.34;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(spanX + 0.2, baseH * 0.36, spanZ + 0.2), slate);
  upper.position.y = baseH * 0.82;
  g.add(sub, upper);

  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(spanX + 0.8, 0.04, 0.07), brass);
    rail.position.set(0, baseH * 0.68, sz * ((spanZ + 0.72) * 0.5));
    g.add(rail);
  }
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, spanZ + 0.8), brass);
    rail.position.set(sx * ((spanX + 0.72) * 0.5), baseH * 0.68, 0);
    g.add(rail);
  }
  return g;
}

// ── 1. Crossing the Red Sea: Parted Walls & Pillar of Cloud/Fire (Exod 14:22) ─
export function buildRedSeaCrossing(_C: number, variant: string): THREE.Group {
  if (variant === 'seabed-and-wheels') {
    // 1:1 scale study beside the 1.72m figure: 4.2m wall of water + mired chariot with detached wheels (Exod 14:22, 25)
    const g = new THREE.Group();
    const seabedMat = new THREE.MeshStandardMaterial({ color: 0x9b8662, roughness: 0.94 });
    const wetSandMat = new THREE.MeshStandardMaterial({ color: 0x6e5f44, roughness: 0.68 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d826e, roughness: 0.88 });
    const wallWaterMat = new THREE.MeshStandardMaterial({
      color: 0x1c758f,
      emissive: 0x093545,
      emissiveIntensity: 0.36,
      roughness: 0.14,
      metalness: 0.22,
      transparent: true,
      opacity: 0.84,
    });
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xe2f5f7,
      roughness: 0.4,
      transparent: true,
      opacity: 0.75,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb87e3c, metalness: 0.75, roughness: 0.32 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x694221, roughness: 0.8 });

    const pad = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 4.4), seabedMat);
    pad.position.y = 0.09;
    g.add(pad);

    const mudPatch = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.04, 24), wetSandMat);
    mudPatch.position.set(0.65, 0.19, 0.15);
    g.add(mudPatch);

    // Towering 4.2m sheer water wall rising along -X side (nearly 2.5× height of the 1.72m person)
    const wallH = 4.2;
    const wallCore = new THREE.Mesh(new THREE.BoxGeometry(1.55, wallH, 4.2), wallWaterMat);
    wallCore.position.set(-1.95, 0.18 + wallH * 0.5, 0);
    wallCore.userData.water = 1;
    g.add(wallCore);

    // Undulating vertical wave ribs along the inner water face
    for (let i = 0; i < 6; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, wallH * 0.96, 12), wallWaterMat);
      col.position.set(-1.14 + (i % 2) * 0.06, 0.18 + wallH * 0.48, -1.65 + i * 0.66);
      col.userData.water = 2 + i * 0.25;
      g.add(col);
    }
    const foamCrest = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 4.24), foamMat);
    foamCrest.position.set(-1.95, 0.18 + wallH + 0.06, 0);
    g.add(foamCrest);

    // Scattered seabed cobbles on the dry lane
    for (let i = 0; i < 10; i++) {
      const rock = makeBoulder(0.11 + (i % 3) * 0.04, 0.06, 0.09, stoneMat, i * 2.1);
      rock.position.set(-0.6 + (i % 4) * 0.72, 0.21, -1.5 + Math.floor(i / 4) * 1.35);
      g.add(rock);
    }

    // Mired Late Bronze Age Egyptian chariot cab + pole + TWO detached 6-spoke wheels (Exod 14:25)
    const chariot = new THREE.Group();
    const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.92), woodMat);
    cabFloor.position.y = 0.24;
    const shieldWall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.74, 14, 1, true, -Math.PI * 0.5, Math.PI),
      bronzeMat,
    );
    shieldWall.rotation.y = Math.PI / 2;
    shieldWall.position.set(0.12, 0.61, 0);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 1.48, 10), bronzeMat);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(-0.08, 0.22, 0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 2.0, 8), woodMat);
    pole.rotation.z = Math.PI / 2 - 0.14;
    pole.position.set(1.1, 0.34, 0);
    chariot.add(cabFloor, shieldWall, axle, pole);
    chariot.position.set(0.55, 0.12, -0.15);
    chariot.rotation.z = -0.18; // tilted down onto axle without wheels!
    chariot.rotation.y = 0.18;
    g.add(chariot);

    const buildSpokedWheel = (radius = 0.48) => {
      const w = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.036, 8, 24), bronzeMat);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 12), bronzeMat);
      hub.rotation.x = Math.PI / 2;
      w.add(rim, hub);
      for (let sp = 0; sp < 6; sp++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, radius * 1.9, 6), woodMat);
        spoke.rotation.z = (sp * Math.PI) / 3;
        w.add(spoke);
      }
      return w;
    };

    const wheel1 = buildSpokedWheel(0.48);
    wheel1.rotation.set(1.22, 0.25, 0.4);
    wheel1.position.set(0.22, 0.29, 0.98);
    const wheel2 = buildSpokedWheel(0.48);
    wheel2.rotation.set(1.42, -0.35, -0.2);
    wheel2.position.set(1.38, 0.24, -0.92);
    g.add(wheel1, wheel2);

    return g;
  }

  // Night crossing diorama: dry seabed corridor + parted left/right water walls + aniconic Pillar of Cloud & Fire
  const spanX = 12.2;
  const spanZ = 8.4;
  const g = makeMuseumPlinth(spanX, spanZ, 0.54);
  const baseY = 0.54;

  const sandMat = new THREE.MeshStandardMaterial({ color: 0xc2aa7d, roughness: 0.94 });
  const dryCorridorMat = new THREE.MeshStandardMaterial({ color: 0xa68e62, roughness: 0.92 });
  const seaWallMat = new THREE.MeshStandardMaterial({
    color: 0x196985,
    emissive: 0x072c3d,
    emissiveIntensity: 0.35,
    roughness: 0.16,
    metalness: 0.24,
    transparent: true,
    opacity: 0.84,
  });
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0xdff3f6,
    roughness: 0.45,
    transparent: true,
    opacity: 0.72,
  });

  // Western Egyptian shore (-X) & eastern wilderness shore (+X) + continuous dry seabed lane (Exod 14:21-22)
  const seabedFloor = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.18, spanZ), dryCorridorMat);
  seabedFloor.position.y = baseY + 0.09;
  g.add(seabedFloor);

  for (const sx of [-1, 1]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.38, spanZ), sandMat);
    bank.position.set(sx * (spanX * 0.5 - 1.05), baseY + 0.19, 0);
    g.add(bank);
  }

  // Towering parted water walls on North (-Z) and South (+Z) sides of the dry channel
  const channelHalfW = 1.38;
  const seaSpanX = spanX - 4.25;
  const wallD = spanZ * 0.5 - channelHalfW;
  const wallH = 1.95;

  for (const sz of [-1, 1]) {
    const centerZ = sz * (channelHalfW + wallD * 0.5);
    const body = new THREE.Mesh(new THREE.BoxGeometry(seaSpanX, wallH, wallD), seaWallMat);
    body.position.set(0, baseY + 0.18 + wallH * 0.5, centerZ);
    body.userData.water = sz > 0 ? 1 : 2;
    const capFoam = new THREE.Mesh(new THREE.BoxGeometry(seaSpanX + 0.04, 0.12, wallD + 0.04), foamMat);
    capFoam.position.set(0, baseY + 0.18 + wallH + 0.05, centerZ);
    g.add(body, capFoam);

    // Sculpted vertical wave columns along the dry corridor edges
    for (let i = 0; i < 11; i++) {
      const wx = -seaSpanX * 0.46 + (seaSpanX * 0.92 * i) / 10;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, wallH * 0.96, 10), seaWallMat);
      col.position.set(wx, baseY + 0.18 + wallH * 0.48, sz * (channelHalfW + 0.1));
      col.userData.water = 1 + (i % 3) * 0.4;
      g.add(col);
    }
  }

  // Strictly aniconic Pillar of Cloud (dark thundercloud facing west) & Pillar of Fire (glowing east) at x = -2.35 (Exod 14:19-20)
  const pillarX = -2.35;
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.92, transparent: true, opacity: 0.9 });
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xff6f1a,
    emissiveIntensity: 1.45,
    roughness: 0.25,
    transparent: true,
    opacity: 0.88,
  });

  const pillarCore = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 3.6, 14), fireMat);
  pillarCore.position.set(pillarX + 0.12, baseY + 2.0, 0);
  pillarCore.userData.flame = 1;
  g.add(pillarCore);

  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.48 + (i % 2) * 0.12, 12, 10), cloudMat);
    puff.position.set(pillarX - 0.18 + (i % 2) * 0.12, baseY + 0.65 + i * 0.48, ((i % 3) - 1) * 0.22);
    g.add(puff);
  }
  const crownHalo = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.045, 8, 28), fireMat);
  crownHalo.rotation.x = Math.PI / 2;
  crownHalo.position.set(pillarX, baseY + 3.65, 0);
  crownHalo.userData.orbitGlow = 1;
  g.add(crownHalo);

  // Eastern half of corridor (+X): Israelite torch column advancing to eastern shore (InstancedMesh)
  const nTorches = 72;
  const torchGeo = new THREE.SphereGeometry(0.055, 6, 5);
  const torchMat = new THREE.MeshStandardMaterial({
    color: 0xffe08a,
    emissive: 0xff9a28,
    emissiveIntensity: 1.5,
  });
  const torches = new THREE.InstancedMesh(torchGeo, torchMat, nTorches);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < nTorches; i++) {
    const lane = i % 6;
    const rank = Math.floor(i / 6);
    const tx = -1.25 + rank * 0.56 + (lane % 2) * 0.14;
    const tz = -0.82 + lane * 0.33 + Math.sin(rank * 0.9) * 0.08;
    const ty = baseY + (tx > 3.9 ? 0.54 : 0.34);
    mtx.makeTranslation(tx, ty, tz);
    torches.setMatrixAt(i, mtx);
  }
  torches.instanceMatrix.needsUpdate = true;
  g.add(torches);

  // Western side (-X behind the cloud): miniature bronze chariot boxes (representative sample of Pharaoh's 600 chosen chariots)
  const bronzeChariotMat = new THREE.MeshStandardMaterial({ color: 0xb88140, metalness: 0.72, roughness: 0.36 });
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.2), bronzeChariotMat);
      ch.position.set(-5.25 + r * 0.58, baseY + 0.46, -0.78 + c * 0.52);
      g.add(ch);
    }
  }

  return g;
}

// ── 2. Mount Sinai Bounds, Cloud & Fire, Altar & Twelve Pillars (Exod 19, 24) ─
export function buildSinaiBounds(_C: number, variant: string): THREE.Group {
  if (variant === 'altar-twelve-pillars') {
    // 1:1 ground-level scene at foot of Sinai: unhewn fieldstone altar + 12 granite pillars (Exod 24:4-7)
    const g = new THREE.Group();
    const gravelMat = new THREE.MeshStandardMaterial({ color: 0xc2a178, roughness: 0.94 });
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0x995843, roughness: 0.88 });
    const altarStoneMat = new THREE.MeshStandardMaterial({ color: 0x8a513e, roughness: 0.9 });
    const coalMat = new THREE.MeshStandardMaterial({ color: 0xff6224, emissive: 0xff4500, emissiveIntensity: 1.35 });
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xffdf7a, emissive: 0xff8a18, emissiveIntensity: 1.45 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb97c3a, metalness: 0.75, roughness: 0.3 });
    const scrollMat = new THREE.MeshStandardMaterial({ color: 0xf2e4c4, roughness: 0.72 });

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.95, 0.16, 40), gravelMat);
    pad.position.y = 0.08;
    g.add(pad);

    // Unhewn stacked stone altar (Exod 20:25; 24:4 — zero dressed tool marks)
    const altar = new THREE.Group();
    for (let row = 0; row < 3; row++) {
      const n = row === 0 ? 7 : row === 1 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + row * 0.4;
        const rad = 0.52 - row * 0.08;
        const b = makeBoulder(0.32, 0.18, 0.26, altarStoneMat, row * 11 + i);
        b.position.set(Math.cos(a) * rad, 0.2 + row * 0.26, Math.sin(a) * rad);
        b.rotation.y = a;
        altar.add(b);
      }
    }
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.1, 14), coalMat);
    coals.position.y = 0.92;
    coals.userData.ember = 1;
    altar.add(coals);
    for (let f = 0; f < 3; f++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 8), flameMat);
      fl.position.set((f - 1) * 0.18, 1.12, (f % 2 === 0 ? -0.08 : 0.1));
      fl.userData.flame = f + 1;
      altar.add(fl);
    }
    altar.position.set(0, 0.12, -0.35);
    g.add(altar);

    // Twelve standing unhewn granite pillars arranged in solemn semicircle behind/around the altar (Exod 24:4)
    for (let i = 0; i < 12; i++) {
      const frac = (i - 5.5) / 5.5;
      const ang = frac * Math.PI * 0.64;
      const rad = 2.45;
      const h = 1.48 + (i % 3) * 0.14;
      const stele = makeBoulder(0.22, h * 0.5, 0.16, graniteMat, i * 3.7 + 1);
      stele.position.set(Math.sin(ang) * rad, 0.16 + h * 0.45, -Math.cos(ang) * rad - 0.15);
      stele.rotation.y = -ang + (i % 2 === 0 ? 0.06 : -0.08);
      g.add(stele);
    }

    // Two bronze blood basins & flat stone reading plinth with unrolled Book of the Covenant (Exod 24:6-7)
    for (const bx of [-0.95, 0.95]) {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.16, 16), bronzeMat);
      basin.position.set(bx, 0.24, 0.85);
      const redPool = new THREE.Mesh(
        new THREE.CircleGeometry(0.21, 16),
        new THREE.MeshStandardMaterial({ color: 0x7b1616, roughness: 0.2 }),
      );
      redPool.rotation.x = -Math.PI / 2;
      redPool.position.set(bx, 0.322, 0.85);
      g.add(basin, redPool);
    }

    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.66, 0.46), graniteMat);
    desk.position.set(0, 0.48, 1.35);
    const scrollSheet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.32), scrollMat);
    scrollSheet.position.set(0, 0.83, 1.35);
    scrollSheet.rotation.x = 0.12;
    g.add(desk, scrollSheet);
    for (const sx of [-0.26, 0.26]) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.35, 10), scrollMat);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(sx, 0.84, 1.35);
      g.add(roll);
    }

    return g;
  }

  // Mountain Diorama: jagged Sinai massif in thick cloud & fire + stone bounds + 12 foot pillars (Exod 19:12-18)
  const spanX = 11.6;
  const spanZ = 9.2;
  const g = makeMuseumPlinth(spanX, spanZ, 0.54);
  const baseY = 0.54;

  const desertMat = new THREE.MeshStandardMaterial({ color: 0xc29e74, roughness: 0.94 });
  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x8e523f, roughness: 0.88 });
  const darkPeakMat = new THREE.MeshStandardMaterial({ color: 0x5c342a, roughness: 0.86 });
  const boundMat = new THREE.MeshStandardMaterial({ color: 0x9e8c72, roughness: 0.9 });
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0x2f3644,
    roughness: 0.92,
    transparent: true,
    opacity: 0.9,
  });
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xff621a,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  const boltMat = new THREE.MeshStandardMaterial({ color: 0xfff099, emissive: 0xffd040, emissiveIntensity: 1.5 });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0x464e5e,
    transparent: true,
    opacity: 0.22,
    roughness: 0.95,
  });

  const plain = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.2, spanZ), desertMat);
  plain.position.y = baseY + 0.1;
  g.add(plain);

  // Multi-crag granite massif (west-center at (-0.6, 0, -0.4))
  const crags: [number, number, number, number, boolean][] = [
    [-0.6, -0.4, 2.35, 3.35, false],
    [-1.7, -0.85, 1.55, 2.45, false],
    [0.45, -0.75, 1.45, 2.25, false],
    [-0.55, 0.65, 1.6, 2.15, false],
    [-0.62, -0.35, 0.95, 3.85, true],
  ];
  for (let i = 0; i < crags.length; i++) {
    const [cx, cz, rad, h, dark] = crags[i]!;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), dark ? darkPeakMat : graniteMat);
    cone.position.set(cx, baseY + 0.2 + h * 0.5, cz);
    cone.rotation.y = i * 0.7;
    g.add(cone);
  }

  // Aniconic descending fire & glowing summit fissures (Exod 19:18) + thundercloud crown & furnace smoke
  const fireCore = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.15, 10), fireMat);
  fireCore.position.set(-0.62, baseY + 4.05, -0.35);
  fireCore.userData.flame = 1;
  g.add(fireCore);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 1.05 + (i % 3) * 0.42;
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.62 + (i % 2) * 0.18, 10, 8), cloudMat);
    cloud.position.set(-0.6 + Math.cos(a) * r, baseY + 3.6 + (i % 3) * 0.35, -0.38 + Math.sin(a) * r * 0.85);
    g.add(cloud);
  }

  for (let b = 0; b < 3; b++) {
    const a = b * 2.1 + 0.4;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.95, 4), boltMat);
    bolt.position.set(-0.6 + Math.cos(a) * 1.1, baseY + 3.25, -0.38 + Math.sin(a) * 0.95);
    bolt.rotation.z = (b % 2 === 0 ? 1 : -1) * 0.38;
    bolt.userData.shimmer = b + 1;
    g.add(bolt);
  }

  for (let s = 0; s < 5; s++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.42 + s * 0.08, 10, 8), smokeMat);
    puff.position.set(-0.6, baseY + 4.35, -0.35);
    puff.userData.smoke = { index: s, baseY: baseY + 4.2, amplitude: 0.48 };
    g.add(puff);
  }

  // Bounds set about the mountain foot (Exod 19:12, 23): continuous cairn & rope boundary cordon
  const boundPts = 28;
  for (let i = 0; i < boundPts; i++) {
    const a = (i / boundPts) * Math.PI * 2;
    const bx = -0.55 + Math.cos(a) * 3.55;
    const bz = -0.35 + Math.sin(a) * 2.95;
    const cairn = makeBoulder(0.16, 0.14, 0.14, boundMat, i * 1.9);
    cairn.position.set(bx, baseY + 0.3, bz);
    g.add(cairn);
  }
  const boundRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.25, 0.025, 6, 48),
    new THREE.MeshStandardMaterial({ color: 0xe2b857, roughness: 0.45 }),
  );
  boundRing.rotation.x = Math.PI / 2;
  boundRing.scale.set(1.09, 0.91, 1);
  boundRing.position.set(-0.55, baseY + 0.32, -0.35);
  g.add(boundRing);

  // Just outside southeast boundary (+X, +Z): Moses' altar & 12 tribal pillars (Exod 24:4)
  const altarBox = makeBoulder(0.32, 0.22, 0.28, graniteMat, 5);
  altarBox.position.set(3.4, baseY + 0.38, 1.95);
  g.add(altarBox);
  for (let p = 0; p < 12; p++) {
    const px = 2.6 + (p % 6) * 0.36;
    const pz = 2.55 + Math.floor(p / 6) * 0.42;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.42, 7), graniteMat);
    pillar.position.set(px, baseY + 0.41, pz);
    g.add(pillar);
  }

  return g;
}

// ── 3. Songs of Ascents: Up to Zion & Fifteen Steps (Ps 24:3; 120–134) ────────
export function buildZionAscent(_C: number, variant: string): THREE.Group {
  if (variant === 'fifteen-steps') {
    // 1:1 architectural study: 15 semicircular concentric limestone steps ascending to Sanctuary court gates
    const g = new THREE.Group();
    const ashlarMat = new THREE.MeshStandardMaterial({ color: 0xe0d3b8, roughness: 0.82 });
    const stepMat = new THREE.MeshStandardMaterial({ color: 0xd6c7a8, roughness: 0.84 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe6b945, metalness: 0.86, roughness: 0.24 });
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xc27f3e, metalness: 0.8, roughness: 0.28 });

    const count = 15;
    const riser = 0.21;
    const tread = 0.34;
    const totalR = 4.9;
    for (let i = 0; i < count; i++) {
      const r = totalR - i * tread * 0.65;
      const h = (i + 1) * riser;
      const step = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, riser, 24, 1, false, Math.PI * 0.08, Math.PI * 0.84),
        stepMat,
      );
      step.rotation.y = -Math.PI * 0.5;
      step.position.set(0, h - riser * 0.5, -2.1);
      g.add(step);
    }

    // Top threshold wall & twin sanctuary brass/gold portal piers at back (-Z)
    const topY = count * riser;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(5.2, topY, 2.2), ashlarMat);
    plat.position.set(0, topY * 0.5, -2.55);
    g.add(plat);

    for (const sx of [-1, 1]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.8, 0.72), ashlarMat);
      pier.position.set(sx * 1.45, topY + 1.4, -2.1);
      g.add(pier);
      const torch = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 8), goldMat);
      torch.position.set(sx * 1.45, topY + 2.95, -2.1);
      torch.userData.flame = sx > 0 ? 1 : 2;
      g.add(torch);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.52, 0.78), ashlarMat);
    lintel.position.set(0, topY + 2.55, -2.1);
    const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 2.28, 0.14), copperMat);
    leftDoor.position.set(-0.46, topY + 1.14, -2.06);
    const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 2.28, 0.14), copperMat);
    rightDoor.position.set(0.46, topY + 1.14, -2.06);
    g.add(lintel, leftDoor, rightDoor);

    // 4 short-haired white-robed Levites standing on varied steps with silver trumpets & lyres
    const leviPos: [number, number, number][] = [
      [-1.35, 3 * riser, -0.3],
      [1.25, 5 * riser, -0.5],
      [-0.85, 8 * riser, -0.9],
      [0.95, 11 * riser, -1.25],
    ];
    for (const [lx, ly, lz] of leviPos) {
      const lev = makeShortHairedPerson(1.7, 0xf3ede0, 0x355c87, false);
      lev.position.set(lx, ly, lz);
      lev.rotation.y = Math.PI;
      const harp = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 12), goldMat);
      harp.position.set(0.22, 1.24, 0.18);
      lev.add(harp);
      g.add(lev);
    }

    return g;
  }

  // Pilgrim climb relief: Siloam pool at south foot climbing Ophel steps with 15 Song beacons to Temple crest
  const spanX = 10.6;
  const spanZ = 9.2;
  const g = makeMuseumPlinth(spanX, spanZ, 0.54);
  const baseY = 0.54;

  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0xc9b997, roughness: 0.88 });
  const valleyMat = new THREE.MeshStandardMaterial({ color: 0x8f9273, roughness: 0.9 });
  const ashlarMat = new THREE.MeshStandardMaterial({ color: 0xe4d7be, roughness: 0.8 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf0c14b,
    emissive: 0xa66a14,
    emissiveIntensity: 0.45,
    metalness: 0.72,
    roughness: 0.28,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x267e99,
    emissive: 0x0a3949,
    emissiveIntensity: 0.35,
    roughness: 0.16,
    transparent: true,
    opacity: 0.86,
  });

  // Flanking Kidron/Tyropoeon valley base & rising terraced limestone Ophel spur (+Z low -> -Z high)
  const valleyFloor = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.16, spanZ), valleyMat);
  valleyFloor.position.y = baseY + 0.08;
  g.add(valleyFloor);

  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const h = 0.24 + t * 2.25;
    const w = 7.4 - t * 2.1;
    const zStart = 3.9 - i * 0.52;
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.62), ridgeMat);
    terrace.position.set(0, baseY + h * 0.5, zStart);
    g.add(terrace);
  }

  // Siloam water pool at southern foot (+Z)
  const poolRim = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 1.35), ashlarMat);
  poolRim.position.set(0, baseY + 0.24, 3.85);
  const poolWater = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 1.12), waterMat);
  poolWater.position.set(0, baseY + 0.34, 3.85);
  poolWater.userData.water = 1;
  g.add(poolRim, poolWater);

  // Crown sanctuary enclosure on northern crest (-Z)
  const crestY = baseY + 2.52;
  const precinct = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.34, 2.2), ashlarMat);
  precinct.position.set(0, crestY + 0.17, -3.35);
  const sanWalls = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.92, 1.35), ashlarMat);
  sanWalls.position.set(0, crestY + 0.8, -3.45);
  const facadeGold = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.86, 0.08), goldMat);
  facadeGold.position.set(0, crestY + 0.78, -2.76);
  g.add(precinct, sanWalls, facadeGold);

  // Stepped zigzag stone pilgrim stair with 15 Song-of-Ascents warm gold beacons (Ps 120–134)
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const z = 3.1 - t * 5.65;
    const x = Math.sin(t * Math.PI * 2.5) * 0.82;
    const y = baseY + 0.38 + t * 2.18;
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.24, 8), goldMat);
    beacon.position.set(x, y + 0.12, z);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), goldMat);
    orb.position.set(x, y + 0.27, z);
    orb.userData.ember = (i % 7) + 1;
    g.add(beacon, orb);
  }

  return g;
}

// ── 4. Isaiah 6 Temple Vision: Aniconic High Throne & Six-Winged Seraphim ─────
export function buildIsaiahThrone(C: number, variant: string): THREE.Group {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xecb942, metalness: 0.86, roughness: 0.22 });
  const warmGoldMat = new THREE.MeshStandardMaterial({
    color: 0xffd569,
    emissive: 0xd98a1c,
    emissiveIntensity: 0.35,
    metalness: 0.82,
    roughness: 0.24,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xf4c85b,
    emissive: 0xa86414,
    emissiveIntensity: 0.28,
    metalness: 0.78,
    roughness: 0.28,
    side: THREE.DoubleSide,
  });
  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x6b4324, roughness: 0.8 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.82 });
  const trainMat = new THREE.MeshStandardMaterial({
    color: 0x5c245a,
    emissive: 0x2c0e32,
    emissiveIntensity: 0.28,
    roughness: 0.56,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xebb742, metalness: 0.84, roughness: 0.26 });
  const coalMat = new THREE.MeshStandardMaterial({ color: 0xff5a1c, emissive: 0xff3b00, emissiveIntensity: 1.55 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb87c3e, metalness: 0.78, roughness: 0.3 });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0xbfc7d4,
    transparent: true,
    opacity: 0.22,
    roughness: 0.95,
  });

  // Helper building a six-winged Seraph per Isaiah 6:2 (2 covering face, 2 covering feet, 2 outstretched flying)
  const buildSeraph = (scaleM: number, idx: number): THREE.Group => {
    const s = new THREE.Group();
    // Radiant central torso/pillar (face strictly hidden behind upper pair of crossed wings!)
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scaleM, 0.08 * scaleM, 1.3 * scaleM, 10), warmGoldMat);
    core.position.y = 0.72 * scaleM;
    s.add(core);

    for (const side of [-1, 1]) {
      // Pair 1 (2 upper wings): swept upward and folded inward across head/face (covering face!)
      const upperWing = new THREE.Mesh(new THREE.BoxGeometry(0.46 * scaleM, 0.52 * scaleM, 0.05 * scaleM), wingMat);
      upperWing.position.set(side * 0.16 * scaleM, 1.34 * scaleM, 0.14 * scaleM);
      upperWing.rotation.set(0.28, -side * 0.58, side * 0.25);
      s.add(upperWing);

      // Pair 2 (2 lower wings): swept downward and folded inward over lower legs/feet (covering feet!)
      const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scaleM, 0.56 * scaleM, 0.045 * scaleM), wingMat);
      lowerWing.position.set(side * 0.14 * scaleM, 0.28 * scaleM, 0.12 * scaleM);
      lowerWing.rotation.set(-0.22, -side * 0.52, -side * 0.18);
      s.add(lowerWing);

      // Pair 3 (2 middle flight wings): wide feathered span stretched out for flying
      const flyInner = new THREE.Mesh(new THREE.BoxGeometry(0.95 * scaleM, 0.34 * scaleM, 0.04 * scaleM), wingMat);
      flyInner.position.set(side * 0.62 * scaleM, 0.92 * scaleM, -0.04 * scaleM);
      flyInner.rotation.z = side * 0.26;
      const flyTip = new THREE.Mesh(new THREE.BoxGeometry(0.65 * scaleM, 0.24 * scaleM, 0.035 * scaleM), wingMat);
      flyTip.position.set(side * 1.25 * scaleM, 1.12 * scaleM, -0.06 * scaleM);
      flyTip.rotation.z = side * 0.42;
      flyInner.userData.shimmer = idx;
      s.add(flyInner, flyTip);
    }
    return s;
  };

  if (variant === 'altar-live-coal') {
    // Focused cubit-reactive Altar of Incense with glowing coals, bronze tongs lifting coal & six-winged Seraph
    const aw = 2.0 * C;
    const ah = 2.8 * C;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(10 * C, 0.3 * C, 8 * C), stoneMat);
    plat.position.y = 0.15 * C;
    g.add(plat);

    const altarBody = new THREE.Mesh(new THREE.BoxGeometry(aw, ah, aw), bronzeMat);
    altarBody.position.set(-1.1 * C, 0.3 * C + ah * 0.5, 0);
    g.add(altarBody);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18 * C, 0.45 * C, 6), goldMat);
        horn.position.set(-1.1 * C + sx * aw * 0.42, 0.3 * C + ah + 0.2 * C, sz * aw * 0.42);
        g.add(horn);
      }
    }
    const grate = new THREE.Mesh(new THREE.BoxGeometry(aw * 0.78, 0.22 * C, aw * 0.78), coalMat);
    grate.position.set(-1.1 * C, 0.3 * C + ah + 0.06 * C, 0);
    grate.userData.ember = 1;
    g.add(grate);

    for (let s = 0; s < 5; s++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.45 * C, 10, 8), smokeMat);
      puff.position.set(-1.1 * C, 0.3 * C + ah + 0.4 * C, 0);
      puff.userData.smoke = { index: s, baseY: 0.3 * C + ah + 0.3 * C, amplitude: 0.85 * C };
      g.add(puff);
    }

    // Long bronze tongs lifting a bright incandescent coal off the altar toward the Seraph (Isa 6:6)
    const liftedCoal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 * C, 0), coalMat);
    liftedCoal.position.set(0.35 * C, 0.3 * C + ah + 1.15 * C, 0.2 * C);
    liftedCoal.userData.flame = 1;
    const tong1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * C, 0.03 * C, 1.9 * C, 6), goldMat);
    tong1.rotation.z = 0.52;
    tong1.position.set(1.05 * C, 0.3 * C + ah + 1.75 * C, 0.24 * C);
    const tong2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * C, 0.03 * C, 1.9 * C, 6), goldMat);
    tong2.rotation.z = 0.62;
    tong2.position.set(1.05 * C, 0.3 * C + ah + 1.84 * C, 0.16 * C);
    g.add(liftedCoal, tong1, tong2);

    const seraph = buildSeraph(2.8 * C, 1);
    seraph.position.set(2.3 * C, 1.5 * C, -0.2 * C);
    seraph.rotation.y = -0.35;
    g.add(seraph);
    return g;
  }

  // Full cutaway 20×20 cubit Temple sanctuary + High Throne + glowing aniconic Glory + full floor train + 2 Seraphim
  const W = 20 * C;
  const H = 20 * C;
  const D = 20 * C;
  const wallT = 0.9 * C;

  // Golden temple floor (1 Kgs 6:30)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * C, 0.6 * C, D + 4 * C), goldMat);
  floor.position.y = 0.3 * C;
  g.add(floor);

  // Back wall (-Z, Most Holy direction) & Left wall (-X, cedar-framed with gold panels; Right/+X cut open to view!)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallT), cedarMat);
  backWall.position.set(0, 0.6 * C + H * 0.5, -D * 0.5);
  const backGold = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, H * 0.9, 0.1 * C), goldMat);
  backGold.position.set(0, 0.6 * C + H * 0.5, -D * 0.5 + wallT * 0.55);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H * 0.85, D), cedarMat);
  leftWall.position.set(-W * 0.5, 0.6 * C + H * 0.425, 0);
  g.add(backWall, backGold, leftWall);

  // Front threshold posts (eastern entrance +Z) vibrating amid smoke (Isa 6:4)
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.1 * C, H * 0.92, 1.1 * C), stoneMat);
    post.position.set(sx * 3.8 * C, 0.6 * C + H * 0.46, D * 0.5);
    g.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.6 * C, 1.2 * C, 1.2 * C), goldMat);
  lintel.position.set(0, 0.6 * C + H * 0.94, D * 0.5);
  g.add(lintel);

  // Elevated High Throne dais (Isa 6:1)
  for (let st = 0; st < 6; st++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry((9 - st * 0.7) * C, 0.75 * C, (11 - st * 0.9) * C),
      stoneMat,
    );
    step.position.set(0, 0.6 * C + (st + 0.5) * 0.75 * C, -D * 0.24 - st * 0.35 * C);
    g.add(step);
  }
  const daisY = 0.6 * C + 6 * 0.75 * C;
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(3.8 * C, 5.2 * C, 0.7 * C), goldMat);
  seatBack.position.set(0, daisY + 2.6 * C, -D * 0.38);
  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(3.8 * C, 1.6 * C, 2.8 * C), goldMat);
  seatBase.position.set(0, daisY + 0.8 * C, -D * 0.32);
  g.add(seatBack, seatBase);

  // Strictly Aniconic Glory Radiance on the High Throne (concentric radiant golden-white light halos — zero figure!)
  const gloryCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.35 * C, 18, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      emissive: 0xffdf7a,
      emissiveIntensity: 1.75,
      transparent: true,
      opacity: 0.92,
    }),
  );
  gloryCore.position.set(0, daisY + 3.1 * C, -D * 0.3);
  gloryCore.userData.shimmer = 1;
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.5 * C, 0.14 * C, 8, 36), warmGoldMat);
  ring1.position.set(0, daisY + 3.1 * C, -D * 0.29);
  ring1.userData.orbitGlow = 1;
  g.add(gloryCore, ring1);

  // "His train filled the temple" (Isa 6:1): flowing purple & gold hem billows down stairs across the full floor
  for (let row = 0; row < 5; row++) {
    const fold = new THREE.Mesh(
      new THREE.CylinderGeometry((2.4 + row * 1.45) * C, (3.1 + row * 1.55) * C, 0.55 * C, 20),
      trainMat,
    );
    fold.scale.set(1.1, 1, 0.78);
    fold.position.set(0, Math.max(0.88 * C, daisY + 0.2 * C - row * 0.95 * C), -D * 0.22 + row * 2.55 * C);
    const trim = new THREE.Mesh(new THREE.TorusGeometry((2.9 + row * 1.5) * C, 0.09 * C, 6, 32), trimMat);
    trim.rotation.x = Math.PI / 2;
    trim.scale.set(1.1, 0.78, 1);
    trim.position.copy(fold.position);
    trim.position.y -= 0.22 * C;
    g.add(fold, trim);
  }

  // Two six-winged Seraphim hovering right & left above the throne (Isa 6:2)
  for (const sx of [-1, 1]) {
    const seraph = buildSeraph(3.1 * C, sx > 0 ? 2 : 3);
    seraph.position.set(sx * 5.6 * C, daisY + 4.4 * C, -D * 0.18);
    seraph.rotation.y = -sx * 0.32;
    g.add(seraph);
  }

  // Incense altar near eastern threshold & rising smoke filling the sanctuary (Isa 6:4)
  const incenseAltar = new THREE.Mesh(new THREE.BoxGeometry(1.5 * C, 2.2 * C, 1.5 * C), bronzeMat);
  incenseAltar.position.set(0, 0.6 * C + 1.1 * C, D * 0.28);
  const coals = new THREE.Mesh(new THREE.BoxGeometry(1.15 * C, 0.18 * C, 1.15 * C), coalMat);
  coals.position.set(0, 0.6 * C + 2.25 * C, D * 0.28);
  coals.userData.ember = 2;
  g.add(incenseAltar, coals);

  for (let s = 0; s < 6; s++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.95 * C, 10, 8), smokeMat);
    puff.position.set(((s % 3) - 1) * 2.2 * C, 3.2 * C, (D * 0.22) - (s % 2) * 3.0 * C);
    puff.userData.smoke = { index: s, baseY: 3.1 * C, amplitude: 2.0 * C };
    g.add(puff);
  }

  return g;
}

// ── 5. Sermon on the Mount & Feeding the 5,000 Amphitheatre (Matt 5:1; 14:19) ─
export function buildBeatitudesHillside(_C: number, variant: string): THREE.Group {
  const spanX = 12.2;
  const spanZ = 9.8;
  const g = makeMuseumPlinth(spanX, spanZ, 0.54);
  const baseY = 0.54;
  const ranksMode = variant === 'five-thousand-ranks';

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f7841, roughness: 0.88 });
  const limestoneMat = new THREE.MeshStandardMaterial({ color: 0x9b927f, roughness: 0.9 });
  const basaltMat = new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.86 });
  const lakeMat = new THREE.MeshStandardMaterial({
    color: 0x1d6a87,
    emissive: 0x092c3b,
    emissiveIntensity: 0.35,
    roughness: 0.16,
    metalness: 0.28,
    transparent: true,
    opacity: 0.86,
  });

  // Rising Galilee limestone/basalt slope descending from north (-Z high hill) to Sea of Galilee shoreline (+Z)
  const tiers = 10;
  for (let i = 0; i < tiers; i++) {
    const frac = i / (tiers - 1); // 0 at bottom lake, 1 at hill crest (-Z)
    const h = 0.16 + frac * 1.95;
    const z = 1.65 - frac * 5.85;
    const d = 0.85;
    const row = new THREE.Mesh(new THREE.BoxGeometry(spanX, h, d), grassMat);
    row.position.set(0, baseY + h * 0.5, z);
    g.add(row);
  }

  // Sea of Galilee shoreline band along +Z edge & distant Golan ridge margin
  const shore = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.16, 2.75), lakeMat);
  shore.position.set(0, baseY + 0.09, spanZ * 0.5 - 1.38);
  shore.userData.water = 1;
  const golanBank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.32, 1.35), limestoneMat);
  golanBank.position.set(spanX * 0.5 - 1.6, baseY + 0.16, spanZ * 0.5 - 0.68);
  g.add(shore, golanBank);

  // At upper crest (-Z): speaker's dark basalt seat boulder with folded unbleached linen cloak ONLY (zero Jesus face!)
  const crestY = baseY + 2.12;
  const seatBoulder = makeBoulder(0.54, 0.38, 0.44, basaltMat, 4);
  seatBoulder.position.set(0, crestY + 0.28, -4.05);
  const foldedMantle = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.08, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xede5d4, roughness: 0.85 }),
  );
  foldedMantle.position.set(0, crestY + 0.64, -4.05);
  g.add(seatBoulder, foldedMantle);

  // 12 short-haired disciples seated in a crescent right around the crest boulder (Matt 5:1)
  for (let d = 0; d < 12; d++) {
    const ang = -Math.PI * 0.42 + (d / 11) * Math.PI * 0.84;
    const rad = 1.35 + (d % 2) * 0.32;
    const disc = makeShortHairedPerson(0.42, 0xd8cdb6, 0x4f6882, true);
    disc.position.set(Math.sin(ang) * rad, crestY - 0.08, -4.05 + Math.cos(ang) * rad * 0.85);
    disc.rotation.y = Math.atan2(-Math.sin(ang), -Math.cos(ang));
    g.add(disc);
  }

  // Instanced crowd facing uphill toward the speaker's seat (220 natural amphitheatre vs ordered companies of 100s & 50s!)
  const crowdGeo = new THREE.CylinderGeometry(0.068, 0.092, 0.24, 8);
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const headGeo = new THREE.SphereGeometry(0.048, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xc2926b, roughness: 0.78 });
  const palette = [0xcfc2aa, 0xa87654, 0x627a96, 0x8a5e44, 0xbfa06a, 0x7b8a6b];

  const coords: [number, number, number][] = [];
  if (ranksMode) {
    // Distinct organized rectangular companies of 50s & 100s on the green grass (Mark 6:40; Matt 14:19)
    for (let groupRow = 0; groupRow < 3; groupRow++) {
      for (let groupCol = -2; groupCol <= 2; groupCol++) {
        const cx = groupCol * 2.15;
        const cz = -2.2 + groupRow * 1.48;
        const cols = 5;
        const rows = 3;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = cx + (c - 2) * 0.32;
            const z = cz + (r - 1) * 0.32;
            const frac = Math.max(0, Math.min(1, (1.65 - z) / 5.85));
            const y = baseY + 0.16 + frac * 1.95;
            coords.push([x, y, z]);
          }
        }
      }
    }

    // Add 12 woven leftover baskets & 5 round barley loaves + 2 fish beside the crest stone (Matt 14:17, 20)
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xb68e50, roughness: 0.88 });
    const loafMat = new THREE.MeshStandardMaterial({ color: 0xc99c58, roughness: 0.85 });
    const fishMat = new THREE.MeshStandardMaterial({ color: 0x6a8096, metalness: 0.35, roughness: 0.55 });
    for (let b = 0; b < 12; b++) {
      const bx = -1.6 + (b < 6 ? b * 0.24 : 1.76 + (b - 6) * 0.24);
      const bz = -3.3 + (b % 2) * 0.24;
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.16, 10), basketMat);
      basket.position.set(bx, crestY - 0.08, bz);
      g.add(basket);
    }
    const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.04, 14), limestoneMat);
    platter.position.set(0.68, crestY + 0.02, -3.55);
    g.add(platter);
    for (let l = 0; l < 5; l++) {
      const a = (l / 5) * Math.PI * 2;
      const loaf = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.035, 10), loafMat);
      loaf.position.set(0.68 + Math.cos(a) * 0.11, crestY + 0.055, -3.55 + Math.sin(a) * 0.11);
      g.add(loaf);
    }
    for (let f = 0; f < 2; f++) {
      const fish = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), fishMat);
      fish.scale.set(1.9, 0.55, 0.75);
      fish.position.set(0.68 + (f === 0 ? -0.05 : 0.07), crestY + 0.07, -3.52 + f * 0.06);
      g.add(fish);
    }
  } else {
    // Organic dense amphitheatre arcs on the hillside listening to the Sermon on the Mount (Matt 5:1)
    for (let arc = 0; arc < 8; arc++) {
      const zBase = -2.6 + arc * 0.56;
      const arcCount = 18 + arc * 3;
      const width = 6.2 + arc * 0.72;
      for (let i = 0; i < arcCount; i++) {
        const u = (i / Math.max(1, arcCount - 1)) - 0.5;
        const x = u * width + Math.sin(i * 2.1 + arc) * 0.09;
        const z = zBase - Math.cos(u * 2.4) * 0.26 + Math.cos(i * 1.7) * 0.06;
        const frac = Math.max(0, Math.min(1, (1.65 - z) / 5.85));
        const y = baseY + 0.16 + frac * 1.95;
        coords.push([x, y, z]);
      }
    }
  }

  const bodies = new THREE.InstancedMesh(crowdGeo, crowdMat, coords.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, coords.length);
  const mtx = new THREE.Matrix4();
  const cTmp = new THREE.Color();
  coords.forEach(([x, y, z], idx) => {
    mtx.makeTranslation(x, y + 0.12, z);
    bodies.setMatrixAt(idx, mtx);
    cTmp.setHex(palette[idx % palette.length]!);
    bodies.setColorAt(idx, cTmp);
    mtx.makeTranslation(x, y + 0.265, z);
    heads.setMatrixAt(idx, mtx);
  });
  bodies.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  g.add(bodies, heads);

  return g;
}

// ── 6. 1st-Century Galilee Boat in the Storm & Great Calm (Mark 4:37–39) ──────
export function buildGalileeBoat(_C: number, variant: string): THREE.Group {
  const g = new THREE.Group();
  const calmMode = variant === 'great-calm';

  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x734926, roughness: 0.82 });
  const oakRibMat = new THREE.MeshStandardMaterial({ color: 0x4d2f18, roughness: 0.88 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x8b5d34, roughness: 0.82 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x623d1e, roughness: 0.84 });
  const linenMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc7, roughness: 0.86 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x8f3f2c, roughness: 0.88 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb0925e, roughness: 0.92 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x165f7a,
    emissive: 0x062330,
    emissiveIntensity: 0.38,
    roughness: 0.14,
    metalness: 0.28,
    transparent: true,
    opacity: 0.84,
  });
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0xdff2f6,
    roughness: 0.42,
    transparent: true,
    opacity: 0.72,
  });

  // Water sea stage seated cleanly on y = 0
  if (calmMode) {
    const mirrorSea = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.14, 48), waterMat);
    mirrorSea.position.y = 0.07;
    mirrorSea.userData.water = 1;
    g.add(mirrorSea);
  } else {
    // Choppy dark storm swell trough (Mark 4:37) with curling crest breaking over port gunwale
    const seaBed = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.22, 6.4), waterMat);
    seaBed.position.y = 0.11;
    seaBed.userData.water = 1;
    g.add(seaBed);

    for (let w = 0; w < 6; w++) {
      const waveGeo = new THREE.CylinderGeometry(0.28, 0.42, 10.0, 12);
      waveGeo.rotateZ(Math.PI / 2);
      waveGeo.scale(1, 0.72, 1.35);
      const wave = new THREE.Mesh(waveGeo, waterMat);
      wave.position.set(0, 0.24 + (w % 2) * 0.16, -2.55 + w * 1.02);
      wave.userData.water = 1.2 + w * 0.3;
      g.add(wave);
    }
    // Breaking foaming wave crest curling right into the midship port gunwale ("waves beat into the ship")
    const crest = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.75, 0.65), foamMat);
    crest.position.set(0.2, 1.02, -1.05);
    crest.rotation.x = 0.48;
    g.add(crest);
  }

  // 1:1 Galilee Fishing Boat (~8.2 m × 2.3 m × 1.2 m — matching Kinneret / Ginosar 1st-century hull proportions)
  const boat = new THREE.Group();
  const L = 8.2;
  const B = 2.3;
  const H = 1.2;

  // Keel timber & hull strakes built cleanly along X (bow +X, stern -X)
  const keel = new THREE.Mesh(new THREE.BoxGeometry(L * 0.88, 0.18, 0.22), oakRibMat);
  keel.position.y = 0.09;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(B * 0.44, B * 0.34, L * 0.76, 14), cedarMat);
  bottom.scale.set(1, 1, 0.38);
  bottom.rotation.z = Math.PI / 2;
  bottom.position.y = 0.34;
  boat.add(keel, bottom);

  // Port & Starboard curved sheer hull bulwarks & gunwales (open waist so internal ribs are clear)
  const slices = 11;
  for (let i = 0; i < slices; i++) {
    const frac = i / (slices - 1); // 0 stern (-X) -> 1 bow (+X)
    const x = (frac - 0.5) * L * 0.86;
    const beamFactor = Math.sin(0.22 + frac * (Math.PI - 0.44));
    const halfW = (B * 0.5) * beamFactor;

    // U-shaped internal oak frame rib
    const floorRib = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, halfW * 1.65), oakRibMat);
    floorRib.position.set(x, 0.24, 0);
    boat.add(floorRib);

    for (const sz of [-1, 1]) {
      const sidePost = new THREE.Mesh(new THREE.BoxGeometry(0.1, H * 0.78, 0.09), oakRibMat);
      sidePost.position.set(x, 0.24 + H * 0.38, sz * halfW * 0.9);
      sidePost.rotation.x = -sz * 0.18;
      boat.add(sidePost);

      if (i < slices - 1) {
        const nextFrac = (i + 1) / (slices - 1);
        const nextHalfW = (B * 0.5) * Math.sin(0.22 + nextFrac * (Math.PI - 0.44));
        const dx = L * 0.86 / (slices - 1);
        const dz = (nextHalfW - halfW) * sz;
        const segLen = Math.hypot(dx, dz) + 0.04;
        const plank = new THREE.Mesh(new THREE.BoxGeometry(segLen, H * 0.76, 0.08), cedarMat);
        plank.position.set(x + dx * 0.5, 0.68, sz * ((halfW + nextHalfW) * 0.5));
        plank.rotation.y = -Math.atan2(dz, dx);
        boat.add(plank);
      }
    }
  }

  // Stem & sternpost curved timbers
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 0.16), oakRibMat);
    post.position.set(sx * L * 0.46, 0.84, 0);
    post.rotation.z = -sx * 0.34;
    boat.add(post);
  }

  // Raised STERN DECK (-X) where the cushion lies (Mark 4:38 — strictly NO figure of Jesus!) & foredeck (+X)
  const sternDeck = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.09, B * 0.68), deckMat);
  sternDeck.position.set(-L * 0.31, 0.86, 0);
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.62, 12), cushionMat);
  cushion.scale.set(0.65, 1, 1.0);
  cushion.rotation.z = Math.PI / 2;
  cushion.rotation.y = Math.PI / 2;
  cushion.position.set(-L * 0.32, 1.02, 0);
  const foreDeck = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, B * 0.54), deckMat);
  foreDeck.position.set(L * 0.34, 0.82, 0);
  boat.add(sternDeck, cushion, foreDeck);

  // Midship thwart benches & coiled dragnet
  for (const bx of [-0.95, 0.15, 1.25]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, B * 0.86), deckMat);
    bench.position.set(bx, 0.84, 0);
    boat.add(bench);
  }
  const netBundle = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.14, 8, 18), ropeMat);
  netBundle.rotation.x = Math.PI / 2;
  netBundle.position.set(1.85, 0.44, 0.25);
  boat.add(netBundle);

  // 4 Wooden Rowing Oars along port/starboard gunwales
  for (const sx of [-0.75, 0.85]) {
    for (const sz of [-1, 1]) {
      const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 3.1, 8), mastMat);
      oar.rotation.x = sz * 1.12;
      oar.position.set(sx, 0.86, sz * 1.45);
      boat.add(oar);
    }
  }

  // Mast: stepped upright with furled linen yardarm in 'great-calm', lowered down thwarts in 'storm-waves'
  if (calmMode) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 4.6, 10), mastMat);
    mast.position.set(0.35, 2.55, 0);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 3.8, 10), mastMat);
    yard.rotation.x = Math.PI / 2;
    yard.position.set(0.35, 4.35, 0);
    const furled = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.4, 10), linenMat);
    furled.rotation.x = Math.PI / 2;
    furled.position.set(0.35, 4.24, 0);
    boat.add(mast, yard, furled);
    boat.position.set(0, 0.06, 0);
  } else {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 4.5, 10), mastMat);
    mast.rotation.z = Math.PI / 2;
    mast.position.set(0.25, 0.96, 0.22);
    const furled = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.5, 10), linenMat);
    furled.rotation.z = Math.PI / 2;
    furled.position.set(0.15, 0.99, 0.34);
    // Water sloshing inside the lower bilge ("now full", Mark 4:37)
    const bilgeWater = new THREE.Mesh(new THREE.BoxGeometry(L * 0.6, 0.24, B * 0.62), waterMat);
    bilgeWater.position.set(0, 0.42, 0);
    bilgeWater.userData.water = 2;
    boat.add(mast, furled, bilgeWater);

    boat.position.set(0, 0.34, 0.18);
    boat.rotation.x = 0.22;
    boat.rotation.z = 0.11;
  }

  g.add(boat);
  return g;
}

// ── 7. Bethlehem Stone Manger & Guest-Chamber House (Luke 2:7 — NO ox/ass!) ────
export function buildBethlehemManger(_C: number, variant: string): THREE.Group {
  const g = new THREE.Group();
  const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xded0b6, roughness: 0.85 });
  const wornStoneMat = new THREE.MeshStandardMaterial({ color: 0xc8b89b, roughness: 0.9 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x6b4728, roughness: 0.86 });
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xd2b368, roughness: 0.92 });
  const linenMat = new THREE.MeshStandardMaterial({ color: 0xf4eee0, roughness: 0.82 });
  const clayMat = new THREE.MeshStandardMaterial({ color: 0xa66343, roughness: 0.78 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffde7a, emissive: 0xff8a18, emissiveIntensity: 1.5 });

  // Reusable monolithic carved limestone feeding trough + wrapped swaddling cloth (strictly zero face!)
  const buildStoneManger = (scale = 1): THREE.Group => {
    const m = new THREE.Group();
    const mw = 0.95 * scale;
    const mh = 0.56 * scale;
    const md = 0.58 * scale;
    // Hollow stone block: base slab + 4 thick chiseled stone walls
    const base = new THREE.Mesh(new THREE.BoxGeometry(mw, mh * 0.52, md), wornStoneMat);
    base.position.y = mh * 0.26;
    m.add(base);
    for (const sz of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(mw, mh * 0.48, 0.11 * scale), limestoneMat);
      side.position.set(0, mh * 0.76, sz * (md * 0.5 - 0.055 * scale));
      m.add(side);
    }
    for (const sx of [-1, 1]) {
      const endW = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, mh * 0.48, md - 0.22 * scale), limestoneMat);
      endW.position.set(sx * (mw * 0.5 - 0.06 * scale), mh * 0.76, 0);
      m.add(endW);
    }
    // Straw bedding layer inside hollowed trough
    const straw = new THREE.Mesh(new THREE.BoxGeometry(mw * 0.72, 0.09 * scale, md * 0.6), strawMat);
    straw.position.y = mh * 0.56;
    m.add(straw);
    // Clean white linen swaddling bands wrapping the newborn (Luke 2:7, 12 — pure folded cloth bundle, no face!)
    const bundle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.115 * scale, 0.28 * scale, 6, 12),
      linenMat,
    );
    bundle.rotation.z = Math.PI / 2;
    bundle.position.set(0, mh * 0.72, 0);
    m.add(bundle);
    for (let s = -2; s <= 2; s++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.122 * scale, 0.015 * scale, 6, 14), linenMat);
      band.rotation.y = Math.PI / 2 + 0.18;
      band.position.set(s * 0.075 * scale, mh * 0.72, 0);
      m.add(band);
    }
    return m;
  };

  if (variant === 'stone-manger-detail') {
    // 1:1 close-up study beside the 1.72m person: monolithic chiselled stone manger + hitching pier + Herodian clay oil lamp
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 2.2), wornStoneMat);
    pad.position.y = 0.08;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.38, 0.44), limestoneMat);
    pier.position.set(-0.82, 0.16 + 0.69, 0);
    const hitchRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), wornStoneMat);
    hitchRing.position.set(-0.58, 0.85, 0);
    hitchRing.rotation.y = Math.PI / 2;
    const manger = buildStoneManger(1.15);
    manger.position.set(0.28, 0.16, 0);

    // 1st-century Herodian wheel-made terracotta oil lamp on pier ledge
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.045, 12), clayMat);
    lamp.position.set(-0.82, 1.56, 0.05);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 8), flameMat);
    flame.position.set(-0.82, 1.62, 0.11);
    flame.userData.flame = 1;

    g.add(pad, pier, hitchRing, manger, lamp, flame);
    return g;
  }

  // Cutaway two-level Bethlehem Judean house: crowded upper guest-chamber (+1.05m) & lower stone-trough bay (Luke 2:7)
  // Zero wooden European barn, zero ox, zero donkey!
  const hw = 6.6;
  const hd = 5.0;
  const baseFloor = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.18, hd), wornStoneMat);
  baseFloor.position.y = 0.09;
  g.add(baseFloor);

  // Back wall (-Z) & Left outer wall (-X) in dressed Judean limestone ashlar (front/+Z and right/+X cutaway!)
  const wallH = 3.45;
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(hw, wallH, 0.38), limestoneMat);
  backWall.position.set(0, 0.18 + wallH * 0.5, -hd * 0.5 + 0.19);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.38, wallH, hd), limestoneMat);
  leftWall.position.set(-hw * 0.5 + 0.19, 0.18 + wallH * 0.5, 0);
  g.add(backWall, leftWall);

  // Cutaway exposed cypress/cedar roof beams along back ceiling
  for (let i = 0; i < 6; i++) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, hd * 0.52, 8), timberMat);
    beam.rotation.x = Math.PI / 2;
    beam.position.set(-hw * 0.4 + i * 1.05, 0.18 + wallH - 0.1, -hd * 0.24);
    g.add(beam);
  }

  // Left half (-X): Raised Guest-Chamber platform (katalyma, +0.98 m up 4 stone steps) packed full of traveler gear
  const upperH = 0.98;
  const upperPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.2, upperH, hd - 0.5), limestoneMat);
  upperPlatform.position.set(-1.35, 0.18 + upperH * 0.5, 0.15);
  g.add(upperPlatform);
  for (let st = 0; st < 4; st++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.28, (st + 1) * (upperH / 4), 1.05), wornStoneMat);
    step.position.set(1.12 - st * 0.28, 0.18 + ((st + 1) * upperH) / 8, 1.35);
    g.add(step);
  }

  // Rolled traveler bedding mats & storage jars filling the crowded upper katalyma ("no room in the guest room")
  const matColors = [0x9e4b3a, 0x4b6a88, 0x85744a, 0x735244];
  for (let r = 0; r < 6; r++) {
    const matRoll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 1.05, 10),
      new THREE.MeshStandardMaterial({ color: matColors[r % matColors.length]!, roughness: 0.88 }),
    );
    matRoll.rotation.z = Math.PI / 2;
    matRoll.position.set(-2.2 + (r % 2) * 1.28, 0.18 + upperH + 0.14, -1.6 + Math.floor(r / 2) * 1.05);
    matRoll.rotation.y = (r % 3 - 1) * 0.15;
    g.add(matRoll);
  }
  for (let j = 0; j < 4; j++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.48, 12), clayMat);
    jar.position.set(-2.65 + (j % 2) * 0.38, 0.18 + upperH + 0.24, -1.75 + Math.floor(j / 2) * 0.45);
    g.add(jar);
  }

  // Right lower bay (+X, ground floor level): Three limestone piers carrying carved monolithic mangers between them!
  const pierXs = [0.65, 1.85, 3.0];
  for (const px of pierXs) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.25, 0.46), limestoneMat);
    pier.position.set(px, 0.18 + 1.125, -0.45);
    g.add(pier);
  }
  const primaryManger = buildStoneManger(1.0);
  primaryManger.position.set(1.25, 0.18, -0.45);
  // Secondary empty feeding trough between outer piers showing typical domestic architecture
  const emptyTrough = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.52, 0.48), wornStoneMat);
  emptyTrough.position.set(2.42, 0.18 + 0.26, -0.45);
  g.add(primaryManger, emptyTrough);

  // Wall niche clay oil lamp casting warm light down onto the limestone trough
  const wallLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 10), clayMat);
  wallLamp.position.set(1.25, 1.55, -2.08);
  const lampFlame = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.12, 8), flameMat);
  lampFlame.position.set(1.25, 1.63, -2.06);
  lampFlame.userData.flame = 1;
  g.add(wallLamp, lampFlame);

  return g;
}
