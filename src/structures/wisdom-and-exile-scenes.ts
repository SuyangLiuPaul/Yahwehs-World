import * as THREE from 'three';

function makeBoulder(rx: number, ry: number, rz: number, mat: THREE.Material, seed: number): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const k = 0.87 + 0.16 * Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.7 - seed * 1.3);
    pos.setXYZ(i, vx * rx * k, vy * ry * k, vz * rz * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function makeShortHairedPerson(
  heightM: number,
  tunicColor: number,
  sashColor: number,
  pose: 'standing' | 'seated' | 'lying' = 'standing',
): THREE.Group {
  const s = heightM / 1.72;
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc2926b, roughness: 0.74 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x261c17, roughness: 0.88 });
  const tunic = new THREE.MeshStandardMaterial({ color: tunicColor, roughness: 0.85 });
  const sash = new THREE.MeshStandardMaterial({ color: sashColor, roughness: 0.8 });

  if (pose === 'lying') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 1.35 * s, 12), tunic);
    body.rotation.z = Math.PI / 2;
    body.scale.set(1, 1, 0.65);
    body.position.set(0.22 * s, 0.14 * s, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.095 * s, 12, 10), skin);
    head.scale.set(0.92, 0.9, 1.04);
    head.position.set(-0.56 * s, 0.21 * s, 0);
    const shortHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.098 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.54),
      hair,
    );
    shortHair.position.set(-0.58 * s, 0.23 * s, 0);
    shortHair.rotation.z = Math.PI * 0.38;
    g.add(body, head, shortHair);
    return g;
  }

  if (pose === 'seated') {
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

// ── 1. David's Temple Treasury & Pattern Table (1 Chr 22:14; 28:11–18) ────────
export function buildDavidPreparations(C: number, variant: string): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdad0bd, roughness: 0.86 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0xa69c89, roughness: 0.9 });
  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x8a522a, roughness: 0.76 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf0c243, metalness: 0.88, roughness: 0.2 });
  const silverMat = new THREE.MeshStandardMaterial({ color: 0xd4dbe3, metalness: 0.85, roughness: 0.24 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb67238, metalness: 0.76, roughness: 0.34 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x3b4047, metalness: 0.68, roughness: 0.45 });

  if (variant === 'blueprint-table') {
    const tw = Math.max(2.2, 6 * C);
    const td = Math.max(1.3, 3.4 * C);
    const th = 0.9;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(tw + 2.2, 0.16, td + 2.2), darkStone);
    floor.position.y = 0.08;
    g.add(floor);

    const tabletop = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.11, td), cedarMat);
    tabletop.position.y = 0.16 + th;
    g.add(tabletop);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, th, 0.11), cedarMat);
        leg.position.set(sx * (tw * 0.45), 0.16 + th * 0.5, sz * (td * 0.43));
        g.add(leg);
      }
    }

    // Scale pattern of Solomon's Temple on David's table (1 Chr 28:11-18)
    const mScale = tw * 0.022; // scaled 60x20 cubits maquette
    const ty = 0.16 + th + 0.055;
    const body = new THREE.Mesh(new THREE.BoxGeometry(40 * mScale, 22 * mScale, 20 * mScale), cedarMat);
    body.position.set(-0.22 * tw, ty + 11 * mScale, 0);
    const ulam = new THREE.Mesh(new THREE.BoxGeometry(10 * mScale, 26 * mScale, 20 * mScale), goldMat);
    ulam.position.set(-0.22 * tw + 25 * mScale, ty + 13 * mScale, 0);
    const mhpRoof = new THREE.Mesh(new THREE.BoxGeometry(20 * mScale, 18 * mScale, 20 * mScale), goldMat);
    mhpRoof.position.set(-0.22 * tw - 10 * mScale, ty + 9.2 * mScale, 0);
    g.add(body, ulam, mhpRoof);

    // Written parchment scrolls & weighed blank vessels (1 Chr 28:12, 14-18)
    for (let i = 0; i < 2; i++) {
      const scroll = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.48, 10),
        new THREE.MeshStandardMaterial({ color: 0xebdcb8, roughness: 0.78 }),
      );
      scroll.rotation.x = Math.PI / 2;
      scroll.rotation.z = 0.22 * (i === 0 ? 1 : -1);
      scroll.position.set(0.28 * tw, ty + 0.045, -0.22 * td + i * 0.34);
      g.add(scroll);
    }
    const lampBlank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 0.34, 10), goldMat);
    lampBlank.position.set(0.22 * tw, ty + 0.17, 0.24 * td);
    const cupBlank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.16, 10), silverMat);
    cupBlank.position.set(0.35 * tw, ty + 0.08, 0.2 * td);
    g.add(lampBlank, cupBlank);

    return g;
  }

  // Default: Stockpile yard beside 20-cubit sanctuary reference beam (1 Chr 22:14)
  const beamSpan = Math.max(7.2, 20 * C); // directly tracks 20-cubit sanctuary breadth!
  const bayW = beamSpan * 0.52;

  const terrace = new THREE.Mesh(new THREE.BoxGeometry(beamSpan + 1.4, 0.2, bayW + 2.4), darkStone);
  terrace.position.y = 0.1;
  g.add(terrace);

  // Back reference beam measuring exactly 20 cubits (1 Chr 28:11 / 1 Kgs 6:2)
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(beamSpan, 0.26, 0.28), cedarMat);
  gauge.position.set(0, 0.2 + 0.13, -(bayW * 0.5 + 0.72));
  g.add(gauge);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.35, 0.32), stoneMat);
    post.position.set(sx * beamSpan * 0.5, 0.2 + 0.675, -(bayW * 0.5 + 0.72));
    g.add(post);
  }

  // Gold ingot pyramid (100,000 talents) with subtle shimmer
  for (let row = 0; row < 4; row++) {
    const n = 4 - row;
    for (let x = 0; x < n; x++) {
      for (let z = 0; z < n; z++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), goldMat);
        bar.position.set(-beamSpan * 0.34 + (x - (n - 1) * 0.5) * 0.38, 0.2 + 0.08 + row * 0.17, -0.8 + (z - (n - 1) * 0.5) * 0.28);
        if (row === 3) bar.userData.shimmer = x + 1;
        g.add(bar);
      }
    }
  }

  // Larger Silver ingot pyramid (1,000,000 talents = 10x gold mass)
  for (let row = 0; row < 5; row++) {
    const n = 5 - row;
    for (let x = 0; x < n; x++) {
      for (let z = 0; z < n; z++) {
        const ingot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.24), silverMat);
        ingot.position.set(-beamSpan * 0.06 + (x - (n - 1) * 0.5) * 0.39, 0.2 + 0.09 + row * 0.19, -0.75 + (z - (n - 1) * 0.5) * 0.3);
        g.add(ingot);
      }
    }
  }

  // Cast bronze rings/columns & forged iron bundles ("without weight", 1 Chr 22:14)
  for (let i = 0; i < 6; i++) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.35, 10), bronzeMat);
    cyl.rotation.z = Math.PI / 2;
    cyl.position.set(beamSpan * 0.24, 0.2 + 0.14 + Math.floor(i / 3) * 0.26, -1.0 + (i % 3) * 0.32);
    g.add(cyl);
  }
  for (let i = 0; i < 8; i++) {
    const rod = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.11, 0.14), ironMat);
    rod.position.set(beamSpan * 0.24, 0.2 + 0.055 + Math.floor(i / 4) * 0.12, 0.65 + (i % 4) * 0.18);
    g.add(rod);
  }

  // Dressed ashlar stones & cedar logs in foreground bay
  for (let i = 0; i < 6; i++) {
    const ashlar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.36, 0.42), stoneMat);
    ashlar.position.set(-beamSpan * 0.33 + (i % 3) * 0.74, 0.2 + 0.18 + Math.floor(i / 3) * 0.37, 1.25);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 2.2, 10), cedarMat);
    log.rotation.z = Math.PI / 2;
    log.position.set(-beamSpan * 0.04, 0.2 + 0.15 + Math.floor(i / 3) * 0.28, 1.05 + (i % 3) * 0.34);
    g.add(ashlar, log);
  }

  return g;
}

// ── 2. Enclosed Garden, Sealed Fountain & Wisdom's Seven Pillars (Song 4:12; Prov 9:1)
export function buildEnclosedGarden(_C: number, variant: string): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xdad0bc, roughness: 0.88 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0xa49984, roughness: 0.9 });
  const cedar = new THREE.MeshStandardMaterial({ color: 0x734422, roughness: 0.8 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4a442, metalness: 0.82, roughness: 0.26 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x45733b, roughness: 0.86 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2689a8,
    emissive: 0x0b3648,
    emissiveIntensity: 0.45,
    roughness: 0.14,
    metalness: 0.22,
    transparent: true,
    opacity: 0.86,
  });

  if (variant === 'seven-pillars-portico') {
    const pw = 7.4;
    const pd = 5.4;
    const base = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.36, pd), stone);
    base.position.y = 0.18;
    const step = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.56, 0.18, pd + 0.56), darkStone);
    step.position.y = 0.09;
    g.add(step, base);

    // Seven carved limestone pillars of Wisdom's house (Prov 9:1)
    const pCoords: [number, number][] = [
      [-2.7, -1.9], [-0.9, -1.9], [0.9, -1.9], [2.7, -1.9],
      [-2.7, 1.75], [0.0, 1.75], [2.7, 1.75],
    ];
    for (const [px, pz] of pCoords) {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.48), darkStone);
      plinth.position.set(px, 0.36 + 0.11, pz);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.05, 14), stone);
      shaft.position.set(px, 0.36 + 0.22 + 1.525, pz);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.46), stone);
      cap.position.set(px, 0.36 + 3.38, pz);
      g.add(plinth, shaft, cap);
    }
    const lintelRear = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.32, 0.44), cedar);
    lintelRear.position.set(0, 0.36 + 3.65, -1.9);
    const lintelFront = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.32, 0.44), cedar);
    lintelFront.position.set(0, 0.36 + 3.65, 1.75);
    g.add(lintelRear, lintelFront);

    // Wisdom's set table with mixed wine amphorae & bread loaves (Prov 9:2-5)
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.76, 1.25), cedar);
    table.position.set(0, 0.36 + 0.38, -0.1);
    g.add(table);
    const terra = new THREE.MeshStandardMaterial({ color: 0xb65d38, roughness: 0.7 });
    for (let i = 0; i < 3; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.42, 12), terra);
      jar.position.set(-0.7 + i * 0.7, 0.36 + 0.76 + 0.21, -0.1);
      g.add(jar);
    }
    return g;
  }

  // Default: Walled orchard garden, barred gate & sealed living spring (Song 4:12-15)
  const gw = 7.2;
  const gd = 6.6;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.2, gd), darkStone);
  floor.position.y = 0.1;
  const turf = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.65, 0.05, gd - 0.65), grass);
  turf.position.y = 0.225;
  g.add(floor, turf);

  // Perimeter stone garden wall with barred cedar front gate ("garden inclosed", Song 4:12)
  const wh = 2.05;
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(gw, wh, 0.34), stone);
  wallN.position.set(0, 0.2 + wh * 0.5, -gd * 0.5 + 0.17);
  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.34, wh, gd), stone);
  wallW.position.set(-gw * 0.5 + 0.17, 0.2 + wh * 0.5, 0);
  const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.34, wh, gd), stone);
  wallE.position.set(gw * 0.5 - 0.17, 0.2 + wh * 0.5, 0);
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(2.3, wh, 0.34), stone);
  frontL.position.set(-2.45, 0.2 + wh * 0.5, gd * 0.5 - 0.17);
  const frontR = new THREE.Mesh(new THREE.BoxGeometry(2.3, wh, 0.34), stone);
  frontR.position.set(2.45, 0.2 + wh * 0.5, gd * 0.5 - 0.17);
  const gateLeaf = new THREE.Mesh(new THREE.BoxGeometry(2.05, wh * 0.9, 0.14), cedar);
  gateLeaf.position.set(0, 0.2 + wh * 0.45, gd * 0.5 - 0.17);
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.12, 0.22), brass);
  crossbar.position.set(0, 0.2 + 1.05, gd * 0.5 - 0.1);
  g.add(wallN, wallW, wallE, frontL, frontR, gateLeaf, crossbar);

  // Sealed octagonal fountain & living spring channels (Song 4:12, 15)
  const wellRim = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.95, 0.72, 8), stone);
  wellRim.position.set(0, 0.25 + 0.36, -0.35);
  const sealCap = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.14, 8), brass);
  sealCap.position.set(0, 0.25 + 0.78, -0.35);
  const springBasin = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.08, 12), waterMat);
  springBasin.position.set(0, 0.25 + 0.69, 0.85);
  springBasin.userData.water = 1;
  g.add(wellRim, sealCap, springBasin);

  // Four fruiting pomegranate trees around the spring (Song 4:13)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x35692c, roughness: 0.76 });
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xc22b2b, roughness: 0.45 });
  const treeCoords: [number, number][] = [[-2.0, -1.6], [2.0, -1.6], [-2.0, 1.2], [2.0, 1.2]];
  for (const [tx, tz] of treeCoords) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.35, 8), cedar);
    trunk.position.set(tx, 0.25 + 0.675, tz);
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), leafMat);
    crown.scale.set(1.15, 0.85, 1.15);
    crown.position.set(tx, 0.25 + 1.68, tz);
    g.add(trunk, crown);
    for (let f = 0; f < 4; f++) {
      const ang = (f / 4) * Math.PI * 2;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), fruitMat);
      pom.position.set(tx + Math.cos(ang) * 0.62, 0.25 + 1.55, tz + Math.sin(ang) * 0.62);
      g.add(pom);
    }
  }

  return g;
}

// ── 3. Jeremiah's Potter's Wheel & Sealed Deeds in Earthen Jar (Jer 18; 32) ───
export function buildPottersHouse(_C: number, variant: string): THREE.Group {
  const g = new THREE.Group();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc4b08e, roughness: 0.92 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x998e7b, roughness: 0.88 });
  const clayWet = new THREE.MeshStandardMaterial({ color: 0x8f5638, roughness: 0.42 });
  const clayFired = new THREE.MeshStandardMaterial({ color: 0xb8653c, roughness: 0.72 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2b, roughness: 0.84 });

  if (variant === 'earthen-jar-deeds') {
    // Courtyard scribal table: bronze scale with 17 silver shekels, sealed/unsealed deeds, earthen jar (Jer 32:9-14)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 2.4), floorMat);
    slab.position.y = 0.08;
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.72, 1.2), woodMat);
    table.position.set(0, 0.16 + 0.36, 0);
    g.add(slab, table);

    const ty = 0.16 + 0.72;
    const brass = new THREE.MeshStandardMaterial({ color: 0xd6a642, metalness: 0.85, roughness: 0.25 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xe3e8ed, metalness: 0.86, roughness: 0.22 });
    const papyrus = new THREE.MeshStandardMaterial({ color: 0xebd9b3, roughness: 0.78 });

    // Equal-arm balance holding 17 silver shekel pieces (Jer 32:9)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.62, 10), brass);
    post.position.set(-0.68, ty + 0.31, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.025, 0.025), brass);
    arm.position.set(-0.68, ty + 0.6, 0);
    const panL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.03, 14), brass);
    panL.position.set(-0.98, ty + 0.28, 0);
    const panR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.03, 14), brass);
    panR.position.set(-0.38, ty + 0.28, 0);
    g.add(post, arm, panL, panR);
    for (let i = 0; i < 6; i++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 8), silver);
      coin.position.set(-0.98 + ((i % 3) - 1) * 0.045, ty + 0.305 + Math.floor(i / 3) * 0.016, 0);
      g.add(coin);
    }

    // Two purchase deeds: sealed roll + open duplicate (Jer 32:11)
    const sealed = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 12), papyrus);
    sealed.rotation.x = Math.PI / 2;
    sealed.position.set(0.0, ty + 0.045, -0.22);
    const openDoc = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.32), papyrus);
    openDoc.position.set(0.02, ty + 0.01, 0.22);
    g.add(sealed, openDoc);

    // Tall two-handled storage jar preserving the deeds long-term (Jer 32:14)
    const jarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.62, 16), clayFired);
    jarBody.position.set(0.75, ty + 0.31, 0);
    const jarNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.16, 14), clayFired);
    jarNeck.position.set(0.75, ty + 0.68, 0);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.04, 14), stoneMat);
    lid.position.set(0.75, ty + 0.78, 0);
    g.add(jarBody, jarNeck, lid);

    return g;
  }

  // Default: Judean potter's workshop with dual-stone wheel, wet clay, marred pot & kiln (Jer 18:2-4)
  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 4.4), floorMat);
  courtyard.position.y = 0.1;
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 0.28), stoneMat);
  backWall.position.set(0, 0.2 + 1.1, -2.06);
  g.add(courtyard, backWall);

  // Dual-stone potter's wheel ("ha-obnayim": lower flywheel + upper working disc on vertical shaft)
  const wx = -0.75;
  const wz = -0.15;
  const lowerWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.12, 18), stoneMat);
  lowerWheel.position.set(wx, 0.2 + 0.24, wz);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 10), woodMat);
  spindle.position.set(wx, 0.2 + 0.48, wz);
  const upperWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 18), stoneMat);
  upperWheel.position.set(wx, 0.2 + 0.78, wz);
  const activePot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.34, 14), clayWet);
  activePot.position.set(wx, 0.2 + 0.99, wz);
  g.add(lowerWheel, spindle, upperWheel, activePot);

  // Short-haired seated potter leaning beside the wheel (Jer 18:3) + slumped marred vessel beside him (18:4)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.46), stoneMat);
  seat.position.set(wx - 0.62, 0.2 + 0.25, wz);
  const potter = makeShortHairedPerson(1.72, 0x7d654d, 0x453528, 'seated');
  potter.position.set(wx - 0.62, 0.2 + 0.5, wz);
  potter.rotation.y = Math.PI / 2;
  const marredPot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), clayWet);
  marredPot.scale.set(1.25, 0.55, 0.95);
  marredPot.position.set(wx + 0.45, 0.2 + 0.08, wz + 0.35);
  g.add(seat, potter, marredPot);

  // Wooden drying rack of finished pottery
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.35, 0.44), woodMat);
  rack.position.set(0.35, 0.2 + 0.675, -1.62);
  g.add(rack);
  for (let i = 0; i < 4; i++) {
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.24, 10), clayFired);
    jug.position.set(-0.18 + i * 0.35, 0.2 + 1.47, -1.62);
    g.add(jug);
  }

  // Mudbrick updraft kiln on right with glowing firebox & rising smoke
  const kx = 1.65;
  const kz = -0.35;
  const kiln = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.85, 1.55, 14), clayFired);
  kiln.position.set(kx, 0.2 + 0.775, kz);
  const coalMat = new THREE.MeshStandardMaterial({ color: 0xc23513, emissive: 0xeb4c18, emissiveIntensity: 0.78 });
  const fireMouth = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.28), coalMat);
  fireMouth.position.set(kx, 0.2 + 0.26, kz + 0.76);
  fireMouth.userData.ember = 1;
  g.add(kiln, fireMouth);
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c7, transparent: true, opacity: 0.22, depthWrite: false });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18 + i * 0.05, 8, 6), smokeMat);
    puff.position.set(kx, 0.2 + 1.7 + i * 0.24, kz);
    puff.userData.smoke = { index: i + 1, baseY: 1.9 + i * 0.24, amplitude: 0.24 };
    g.add(puff);
  }

  return g;
}

// ── 4. Jacob's Ladder & Anointed Bethel Pillar (Gen 28:11–22) ──────────────────
export function buildBethelPillar(_C: number, variant: string): THREE.Group {
  if (variant === 'anointed-pillar') {
    const g = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({ color: 0xc2b8a3, roughness: 0.9 });
    const outcrop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.22, 3.0), rock);
    outcrop.position.y = 0.11;
    g.add(outcrop);

    // Standing anointed limestone pillar ("matzevah", ~1.38m tall, Gen 28:18)
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.38, 0.34), rock);
    pillar.position.set(0, 0.22 + 0.69, 0);
    pillar.rotation.z = 0.025;
    g.add(pillar);

    // Glistening golden olive oil poured over top & down front face (Gen 28:18)
    const oilMat = new THREE.MeshStandardMaterial({
      color: 0xe6b635,
      emissive: 0x5c4208,
      emissiveIntensity: 0.38,
      roughness: 0.12,
      metalness: 0.25,
    });
    const oilCrown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.36), oilMat);
    oilCrown.position.set(0, 0.22 + 1.39, 0);
    oilCrown.userData.shimmer = 1;
    const oilTrickle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.03), oilMat);
    oilTrickle.position.set(0.05, 0.22 + 0.92, 0.175);
    g.add(oilCrown, oilTrickle);

    // Terra-cotta oil flask & ring of chock stones
    const flask = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.11, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: 0xb65d38, roughness: 0.68 }),
    );
    flask.position.set(0.58, 0.22 + 0.14, 0.32);
    g.add(flask);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const chock = makeBoulder(0.14, 0.1, 0.13, rock, i + 2);
      chock.position.set(Math.cos(ang) * 0.34, 0.22 + 0.07, Math.sin(ang) * 0.28);
      g.add(chock);
    }
    return g;
  }

  // Night Bethel hillside diorama on museum plinth: stone pillow, sleeping Jacob, rising stairway & aniconic glory
  const g = makeMuseumPlinth(9.2, 7.4);
  const plinthTop = 0.54;
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x5d5a63, roughness: 0.92 });
  const limestone = new THREE.MeshStandardMaterial({ color: 0xd4cab4, roughness: 0.86 });
  const stairMat = new THREE.MeshStandardMaterial({ color: 0xe6d6ad, emissive: 0x5c471e, emissiveIntensity: 0.28, roughness: 0.65 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffe99c,
    emissive: 0xf0be4a,
    emissiveIntensity: 0.82,
    transparent: true,
    opacity: 0.88,
  });

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.45, 7.0), ridgeMat);
  ridge.position.set(0, plinthTop + 0.225, 0);
  g.add(ridge);

  // Sleeping short-haired Jacob with limestone pillow stone (Gen 28:11)
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.34), limestone);
  pillow.position.set(-2.35, plinthTop + 0.45 + 0.11, 1.45);
  const jacob = makeShortHairedPerson(1.68, 0x7d654d, 0x3b4d63, 'lying');
  jacob.position.set(-1.68, plinthTop + 0.45, 1.45);
  g.add(pillow, jacob);

  // Ascending stone ramp-stairway ("sullam", earth to heaven, Gen 28:12)
  const steps = 22;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.15 - t * 0.25, 0.16, 0.38), stairMat);
    step.position.set(-1.5 + t * 3.8, plinthTop + 0.55 + t * 5.2, 0.6 - t * 2.2);
    step.rotation.y = -0.48;
    g.add(step);
  }

  // Strictly aniconic radiance rings at summit ("Yahweh stood above it", Gen 28:13 — zero bodily form)
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55 + r * 0.32, 0.055, 8, 28), glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(2.3, plinthTop + 5.95 + r * 0.28, -1.6);
    ring.userData.shimmer = r + 1;
    g.add(ring);
  }

  // Stylized luminous messenger silhouettes ascending/descending (no faces, modest luminous wing emblems)
  const msgMat = new THREE.MeshStandardMaterial({ color: 0xf7eed7, emissive: 0xd9af54, emissiveIntensity: 0.6 });
  for (let m = 0; m < 6; m++) {
    const t = 0.16 + m * 0.135;
    const msg = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.55, 10), msgMat);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.04), msgMat);
    wingL.position.set(-0.2, 0.15, -0.06);
    wingL.rotation.z = 0.35;
    const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.04), msgMat);
    wingR.position.set(0.2, 0.15, -0.06);
    wingR.rotation.z = -0.35;
    msg.add(col, wingL, wingR);
    msg.position.set(-1.5 + t * 3.8 + (m % 2 === 0 ? -0.22 : 0.22), plinthTop + 0.95 + t * 5.2, 0.6 - t * 2.2);
    g.add(msg);
  }

  return g;
}

// ── 5. Leviticus Perpetual Burnt-Offering Altar & Five Offerings (Lev 1–7) ───
export function buildPerpetualAltar(C: number, variant: string): THREE.Group {
  const g = new THREE.Group();
  const stoneFloor = new THREE.MeshStandardMaterial({ color: 0xcbb998, roughness: 0.92 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb8743a, metalness: 0.78, roughness: 0.32 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4527, roughness: 0.85 });
  const crimson = new THREE.MeshStandardMaterial({ color: 0xa11e1e, roughness: 0.48 });
  const coalMat = new THREE.MeshStandardMaterial({ color: 0xc23513, emissive: 0xe84d1a, emissiveIntensity: 0.82 });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffb336,
    emissive: 0xff6212,
    emissiveIntensity: 0.88,
    transparent: true,
    opacity: 0.9,
  });

  // Bronze altar built strictly to Exod 27:1 dimensions: 5 × 5 cubits, 3 cubits tall (cubit-reactive!)
  const w = 5 * C;
  const h = 3 * C;

  const buildAltarUnit = (ax: number, az: number) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), bronze);
    frame.position.set(ax, 0.16 + h * 0.5, az);
    g.add(frame);
    // Four corner horns with sin-offering blood touch (Exod 27:2; Lev 4:25)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11 * C, 0.42 * C, 8), bronze);
        horn.position.set(ax + sx * (w * 0.46), 0.16 + h + 0.21 * C, az + sz * (w * 0.46));
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06 * C, 8, 6), crimson);
        tip.position.set(ax + sx * (w * 0.46), 0.16 + h + 0.36 * C, az + sz * (w * 0.46));
        g.add(horn, tip);
      }
    }
    // Stacked cleft wood & ever-burning hearth flames + embers + smoke (Lev 6:12-13)
    const bed = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.16 * C, w * 0.72), coalMat);
    bed.position.set(ax, 0.16 + h + 0.04, az);
    bed.userData.ember = 1;
    g.add(bed);
    for (let i = -2; i <= 2; i++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.18 * C, 0.62 * C, 7), flameMat);
      fl.position.set(ax + i * 0.26 * C, 0.16 + h + 0.34 * C, az + ((i % 2) * 0.18 - 0.08) * C);
      fl.userData.flame = Math.abs(i) + 1;
      g.add(fl);
    }
    const smokeMat = new THREE.MeshStandardMaterial({ color: 0xe3ddd5, transparent: true, opacity: 0.22, depthWrite: false });
    for (let s = 0; s < 3; s++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24 + s * 0.07, 8, 6), smokeMat);
      puff.position.set(ax, 0.16 + h + 0.9 + s * 0.32, az);
      puff.userData.smoke = { index: s + 1, baseY: h + 1.0 + s * 0.32, amplitude: 0.28 };
      g.add(puff);
    }
    // Unstepped earthen/bronze southern ramp (Exod 20:26; Lev 9:22)
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, h * 0.45, w * 0.95), stoneFloor);
    ramp.position.set(ax, 0.16 + h * 0.22, az + w * 0.92);
    ramp.rotation.x = 0.32;
    g.add(ramp);
  };

  if (variant === 'five-offerings-table') {
    const court = new THREE.Mesh(new THREE.BoxGeometry(Math.max(5.8, 12 * C), 0.16, Math.max(4.4, 9 * C)), stoneFloor);
    court.position.y = 0.08;
    g.add(court);
    buildAltarUnit(0, -1.8 * C);

    // Five ordered offering stations (Lev 1-7): Burnt, Grain, Peace, Sin, Trespass
    const flourMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe5b942, metalness: 0.85, roughness: 0.24 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xdce2ea, metalness: 0.85, roughness: 0.22 });
    const span = Math.max(4.4, 9.6 * C);
    for (let idx = 0; idx < 5; idx++) {
      const sx = -span * 0.4 + (span * 0.8 * idx) / 4;
      const sz = 1.65 * C;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.72, 0.65), wood);
      plinth.position.set(sx, 0.16 + 0.36, sz);
      g.add(plinth);
      const topY = 0.16 + 0.72;
      if (idx === 0) {
        const logs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.32), wood);
        logs.position.set(sx, topY + 0.07, sz);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.12, 10), bronze);
        bowl.position.set(sx + 0.18, topY + 0.06, sz + 0.14);
        g.add(logs, bowl);
      } else if (idx === 1) {
        const flour = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 12), flourMat);
        flour.position.set(sx - 0.12, topY + 0.08, sz);
        const oil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 10), goldMat);
        oil.position.set(sx + 0.16, topY + 0.1, sz);
        g.add(flour, oil);
      } else if (idx === 2) {
        const cakes = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12), wood);
        cakes.position.set(sx, topY + 0.05, sz);
        g.add(cakes);
      } else if (idx === 3) {
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.14, 12), bronze);
        basin.position.set(sx, topY + 0.07, sz);
        const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 10), crimson);
        drop.position.set(sx, topY + 0.14, sz);
        g.add(basin, drop);
      } else {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), bronze);
        beam.position.set(sx, topY + 0.175, sz);
        const shekels = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), silverMat);
        shekels.position.set(sx + 0.14, topY + 0.03, sz);
        g.add(beam, shekels);
      }
    }
    return g;
  }

  // Default: 1:1 5x5x3 cubit Bronze Altar with perpetual fire, ash-pans & bronze laver utensils
  const court = new THREE.Mesh(new THREE.BoxGeometry(w + 2.6, 0.16, w + 3.2), stoneFloor);
  court.position.set(0, 0.08, 0.5 * C);
  g.add(court);
  buildAltarUnit(0, -0.45 * C);
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, w + 1.4, 8), bronze);
    pole.rotation.x = Math.PI / 2;
    pole.position.set(sx * (w * 0.5 + 0.12), 0.16 + h * 0.45, -0.45 * C);
    g.add(pole);
  }
  const ashPan = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), bronze);
  ashPan.position.set(w * 0.72, 0.16 + 0.06, -0.45 * C);
  g.add(ashPan);

  return g;
}

// ── 6. Job Out of the Whirlwind: Foundations, Sea Doors & Constellations (Job 38)
export function buildJobWhirlwind(_C: number, variant: string): THREE.Group {
  if (variant === 'pleiades-and-orion') {
    const g = makeMuseumPlinth(9.6, 9.6);
    const py = 0.54;
    const nightMat = new THREE.MeshStandardMaterial({ color: 0x0e1424, roughness: 0.88 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd9aa45, metalness: 0.85, roughness: 0.24 });
    const starBlue = new THREE.MeshStandardMaterial({ color: 0x8cc9ff, emissive: 0x4ca2ff, emissiveIntensity: 0.9 });
    const starGold = new THREE.MeshStandardMaterial({ color: 0xffe296, emissive: 0xe6a832, emissiveIntensity: 0.88 });

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.5, 0.18, 40), nightMat);
    disc.position.y = py + 0.09;
    const mazzarothRing = new THREE.Mesh(new THREE.TorusGeometry(4.15, 0.065, 8, 48), brass);
    mazzarothRing.rotation.x = Math.PI / 2;
    mazzarothRing.position.y = py + 0.24;
    g.add(disc, mazzarothRing);

    // Two brass celestial meridian arcs carrying the named star groups (Job 38:31-32)
    const arc1 = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.04, 8, 40, Math.PI), brass);
    arc1.position.y = py + 0.24;
    const arc2 = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.04, 8, 40, Math.PI), brass);
    arc2.rotation.y = Math.PI / 2;
    arc2.position.y = py + 0.24;
    g.add(arc1, arc2);

    // 1. Pleiades (7 blue-white star cluster bound closely with golden links, Job 38:31)
    const pCenter = new THREE.Vector3(-1.45, py + 2.65, -1.1);
    const pleiadesPts: [number, number, number][] = [
      [0, 0, 0], [0.22, 0.1, 0.08], [-0.24, 0.08, -0.05], [0.14, -0.18, 0.12],
      [-0.16, -0.14, -0.14], [0.35, -0.04, -0.1], [-0.05, 0.24, 0.12],
    ];
    for (let i = 0; i < pleiadesPts.length; i++) {
      const [dx, dy, dz] = pleiadesPts[i]!;
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 1), starBlue);
      st.position.set(pCenter.x + dx, pCenter.y + dy, pCenter.z + dz);
      st.userData.shimmer = i + 1;
      g.add(st);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.016, 6, 20), brass);
    band.position.copy(pCenter);
    band.userData.orbitGlow = 1;
    g.add(band);

    // 2. Orion (3-star belt & 4 outer corner stars with loosened bronze cords, Job 38:31)
    const oCenter = new THREE.Vector3(1.55, py + 2.45, 0.95);
    const orionPts: [number, number, number][] = [
      [-0.25, 0, 0], [0, 0.03, 0], [0.25, 0.06, 0], // Belt
      [-0.55, 0.72, -0.12], [0.52, 0.66, 0.12], [-0.46, -0.68, 0.1], [0.48, -0.64, -0.1],
    ];
    for (let i = 0; i < orionPts.length; i++) {
      const [dx, dy, dz] = orionPts[i]!;
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(i < 3 ? 0.11 : 0.125, 1), starGold);
      st.position.set(oCenter.x + dx, oCenter.y + dy, oCenter.z + dz);
      st.userData.ember = i + 1;
      g.add(st);
    }

    // 3. The Bear / Dipper (Job 38:32) circling high in northern arch
    const arcturusPts: [number, number, number][] = [
      [-1.2, 3.65, 1.4], [-0.85, 3.8, 1.25], [-0.45, 3.72, 1.15], [0.05, 3.55, 1.1],
      [0.18, 3.22, 1.25], [0.65, 3.2, 1.15], [0.75, 3.52, 0.95],
    ];
    for (let i = 0; i < arcturusPts.length; i++) {
      const [ax, ay, az] = arcturusPts[i]!;
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 1), starGold);
      st.position.set(ax, py + ay, az);
      g.add(st);
    }

    return g;
  }

  // Default: Cosmological cutaway on museum plinth (Job 38:1-11)
  const g = makeMuseumPlinth(10.2, 8.2);
  const py = 0.54;
  const bedrock = new THREE.MeshStandardMaterial({ color: 0x453d36, roughness: 0.92 });
  const strata = new THREE.MeshStandardMaterial({ color: 0x6b5c4c, roughness: 0.88 });
  const cornerstone = new THREE.MeshStandardMaterial({ color: 0xebd494, metalness: 0.45, roughness: 0.38 });
  const brassLine = new THREE.MeshStandardMaterial({ color: 0xf2c54b, emissive: 0x8c6312, emissiveIntensity: 0.45 });
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x164e70,
    emissive: 0x062033,
    emissiveIntensity: 0.4,
    roughness: 0.14,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
  });
  const doorBronze = new THREE.MeshStandardMaterial({ color: 0x7a512a, metalness: 0.72, roughness: 0.38 });

  // Left crustal cutaway & sunken foundation sockets + cornerstone + measuring line (Job 38:4-6)
  const earthSlab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.85, 7.6), bedrock);
  earthSlab.position.set(-2.35, py + 0.425, 0);
  const upperCrust = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.32, 7.5), strata);
  upperCrust.position.set(-2.35, py + 0.98, 0);
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.45, 8), strata);
  socket.position.set(-1.6, py + 1.15, -0.35);
  const corner = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.72, 0.88), cornerstone);
  corner.position.set(-1.6, py + 1.54, -0.35);
  g.add(earthSlab, upperCrust, socket, corner);

  // Brass measuring line stretched across foundation posts (Job 38:5)
  for (const px of [-4.2, 0.1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8), brassLine);
    p.position.set(px, py + 1.55, 1.35);
    g.add(p);
  }
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 4.3, 8), brassLine);
  line.rotation.z = Math.PI / 2;
  line.position.set(-2.05, py + 1.9, 1.35);
  g.add(line);

  // Right surging ocean stopped by monumental twin bolted sea doors (Job 38:8-11)
  const ocean = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.08, 7.5), seaMat);
  ocean.position.set(2.55, py + 0.54, 0);
  ocean.userData.water = 1;
  g.add(ocean);
  for (const sz of [-1.2, 1.2]) {
    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.35, 2.25), doorBronze);
    doorLeaf.position.set(0.32, py + 1.18, sz);
    g.add(doorLeaf);
  }
  const boltBar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 4.9), brassLine);
  boltBar.position.set(0.18, py + 1.45, 0);
  g.add(boltBar);

  // Aniconic spiraling whirlwind column descending above seated Job ("out of the whirlwind", Job 38:1)
  const whirlMat = new THREE.MeshStandardMaterial({
    color: 0xe8e0cf,
    emissive: 0x705c38,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.72,
  });
  for (let i = 0; i < 8; i++) {
    const rad = 0.24 + i * 0.16;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.075, 8, 24), whirlMat);
    ring.rotation.x = Math.PI / 2 + 0.08 * (i % 2 === 0 ? 1 : -1);
    ring.position.set(-2.45 + Math.sin(i * 0.7) * 0.18, py + 2.0 + i * 0.42, -1.25);
    ring.userData.orbitGlow = i + 1;
    g.add(ring);
  }

  const jobFig = makeShortHairedPerson(1.65, 0x6b5c4d, 0x3b3128, 'seated');
  jobFig.position.set(-3.15, py + 1.14, 1.85);
  jobFig.rotation.y = 0.6;
  g.add(jobFig);

  return g;
}

// ── 7. Caesarea Praetorium & Agrippa Audience Hall (Acts 23:35; 25:23) ────────
export function buildCaesareaHall(_C: number, variant: string): THREE.Group {
  const marble = new THREE.MeshStandardMaterial({ color: 0xe6decb, roughness: 0.65 });
  const limestone = new THREE.MeshStandardMaterial({ color: 0xd1c5ae, roughness: 0.84 });
  const mosaic = new THREE.MeshStandardMaterial({ color: 0xb8a382, roughness: 0.76 });
  const purple = new THREE.MeshStandardMaterial({ color: 0x6b225e, roughness: 0.78 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x166382,
    emissive: 0x062030,
    emissiveIntensity: 0.35,
    roughness: 0.16,
    metalness: 0.25,
    transparent: true,
    opacity: 0.84,
  });

  if (variant === 'promontory-praetorium') {
    const g = makeMuseumPlinth(10.8, 7.8);
    const py = 0.54;
    const reef = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.45, 5.2), limestone);
    reef.position.set(-1.35, py + 0.225, 0);
    const sea = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.26, 7.4), waterMat);
    sea.position.set(0, py + 0.13, 0);
    sea.userData.water = 1;
    g.add(sea, reef);

    // Lower rock-cut peristyle sea-pool & surrounding 4 colonnades of Herod's Promontory Palace
    const pool = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.1, 2.0), waterMat);
    pool.position.set(-2.35, py + 0.47, 0);
    pool.userData.water = 2;
    g.add(pool);
    for (let i = 0; i < 6; i++) {
      for (const sz of [-1.25, 1.25]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.72, 10), marble);
        col.position.set(-3.8 + i * 0.58, py + 0.45 + 0.36, sz);
        g.add(col);
      }
    }

    // Upper eastern terrace + basilica audience hall (akroaterion) & guard wing (Acts 23:35; 25:23)
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.72, 5.8), limestone);
    terrace.position.set(2.15, py + 0.36, 0);
    const basilica = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.35, 3.6), marble);
    basilica.position.set(2.1, py + 0.72 + 0.675, -0.4);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 0.65, 4), new THREE.MeshStandardMaterial({ color: 0xb65d38, roughness: 0.78 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(2.1, py + 0.72 + 1.66, -0.4);
    g.add(terrace, basilica, roof);
    return g;
  }

  // Default: 1:1 Cutaway Audience Basilica (akroaterion) beside 1.72m figure (Acts 25:23; 26:1)
  const g = new THREE.Group();
  const hallW = 10.6;
  const hallD = 8.0;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(hallW, 0.22, hallD), mosaic);
  floor.position.y = 0.11;
  g.add(floor);

  // Mediterranean waves glimpsed outside the left/west colonnade terrace
  const sea = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, hallD), waterMat);
  sea.position.set(-hallW * 0.5 - 0.85, 0.06, 0);
  sea.userData.water = 1;
  g.add(sea);

  // Fluted marble basilica colonnade (6 north + 6 south, clean plain columns without heraldic banners/eagles)
  for (let i = 0; i < 6; i++) {
    const cx = -3.8 + i * 1.52;
    for (const cz of [-3.4, 3.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 4.1, 14), marble);
      col.position.set(cx, 0.22 + 2.05, cz);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.62), marble);
      cap.position.set(cx, 0.22 + 4.22, cz);
      g.add(col, cap);
    }
  }
  const apseWall = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.3, hallD - 0.8), limestone);
  apseWall.position.set(hallW * 0.5 - 0.21, 0.22 + 2.15, 0);
  g.add(apseWall);

  // Raised stone bema tribunal dais with Festus, Agrippa II & Bernice seats (Acts 25:23)
  const dais = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.62, 4.4), marble);
  dais.position.set(3.6, 0.22 + 0.31, 0);
  g.add(dais);
  for (const sz of [-1.25, 0, 1.25]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.62), marble);
    seat.position.set(3.85, 0.22 + 0.62 + 0.24, sz);
    const fig = makeShortHairedPerson(1.7, sz === 0 ? 0x6b225e : 0x521d48, 0xd4a442, 'seated');
    fig.position.set(3.65, 0.22 + 0.62 + 0.48, sz);
    fig.rotation.y = -Math.PI / 2;
    g.add(seat, fig);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 4.2), purple);
  canopy.position.set(3.6, 0.22 + 3.45, 0);
  g.add(canopy);

  // Five short-haired chiliarchs / tribunes flanking north bench + chained short-haired Paul standing in defense (Acts 26:1)
  for (let t = 0; t < 4; t++) {
    const trib = makeShortHairedPerson(1.72, 0x82735f, 0x8f2929, 'seated');
    trib.position.set(0.2 + t * 0.82, 0.22, -2.55);
    g.add(trib);
  }
  const paul = makeShortHairedPerson(1.68, 0x7d654d, 0x3b4d63, 'standing');
  paul.position.set(-0.65, 0.22, 0);
  paul.rotation.y = Math.PI / 2;
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x595e66, metalness: 0.75, roughness: 0.35 });
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6), chainMat);
  chain.position.set(-0.65, 0.22 + 0.52, 0.24);
  chain.rotation.z = 0.4;
  g.add(paul, chain);

  return g;
}
