import * as THREE from 'three';

export type HighPriestVariant = 'vested' | 'breastpiece';

interface SharedMaps {
  linen: THREE.CanvasTexture;
  ephod: THREE.CanvasTexture;
  sash: THREE.CanvasTexture;
  plate: THREE.CanvasTexture;
}

let cachedMaps: SharedMaps | null = null;

function markShared<T extends THREE.Texture>(tex: T): T {
  tex.userData.shared = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function getSharedMaps(): SharedMaps {
  if (cachedMaps) return cachedMaps;

  // Fine linen subtle checkered weave (Exod 28:39)
  const lc = document.createElement('canvas');
  lc.width = 128;
  lc.height = 128;
  const lx = lc.getContext('2d')!;
  lx.fillStyle = '#f2eadc';
  lx.fillRect(0, 0, 128, 128);
  lx.fillStyle = 'rgba(205, 192, 168, 0.28)';
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      if (((x + y) >> 3) % 2 === 0) lx.fillRect(x, y, 7, 7);
    }
  }
  lx.strokeStyle = 'rgba(182, 166, 138, 0.25)';
  lx.lineWidth = 1;
  for (let i = 0; i < 128; i += 8) {
    lx.beginPath();
    lx.moveTo(i, 0);
    lx.lineTo(i, 128);
    lx.moveTo(0, i);
    lx.lineTo(128, i);
    lx.stroke();
  }
  const linen = markShared(new THREE.CanvasTexture(lc));
  linen.wrapS = linen.wrapT = THREE.RepeatWrapping;
  linen.repeat.set(6, 10);

  // Ephod rich striped weave: gold, techelet blue, purple, scarlet, white linen (Exod 28:6)
  const ec = document.createElement('canvas');
  ec.width = 256;
  ec.height = 256;
  const ex = ec.getContext('2d')!;
  const stripes = [
    { c: '#1f4e8c', w: 18 }, // blue
    { c: '#d9b24c', w: 10 }, // gold thread
    { c: '#5b2868', w: 18 }, // purple
    { c: '#9e2323', w: 18 }, // scarlet
    { c: '#efe7d6', w: 14 }, // fine linen
    { c: '#d9b24c', w: 8 },  // gold thread
  ];
  let y = 0;
  while (y < 256) {
    for (const s of stripes) {
      ex.fillStyle = s.c;
      ex.fillRect(0, y, 256, s.w);
      ex.fillStyle = 'rgba(255,255,255,0.12)';
      for (let x = 0; x < 256; x += 12) {
        ex.fillRect(x + (y % 6), y + 1, 5, Math.max(1, s.w - 3));
      }
      y += s.w;
      if (y >= 256) break;
    }
  }
  const ephod = markShared(new THREE.CanvasTexture(ec));
  ephod.wrapS = ephod.wrapT = THREE.RepeatWrapping;
  ephod.repeat.set(2, 2);

  // Embroidered sash tapestry band (Exod 28:39)
  const sc = document.createElement('canvas');
  sc.width = 256;
  sc.height = 64;
  const sx = sc.getContext('2d')!;
  sx.fillStyle = '#efe7d6';
  sx.fillRect(0, 0, 256, 64);
  const bandColors = ['#1f4e8c', '#63286e', '#a82424', '#d4ad42'];
  for (let x = 0; x < 256; x += 16) {
    sx.fillStyle = bandColors[(x >> 4) % bandColors.length] ?? '#1f4e8c';
    sx.fillRect(x + 2, 10, 12, 44);
    sx.fillStyle = '#f6eedb';
    sx.fillRect(x + 6, 26, 4, 12);
  }
  const sash = markShared(new THREE.CanvasTexture(sc));
  sash.wrapS = sash.wrapT = THREE.RepeatWrapping;

  // Gold Crown Frontlet ("HOLINESS TO YAHWEH / 归雅伟为圣") - Exod 28:36
  const pc = document.createElement('canvas');
  pc.width = 512;
  pc.height = 128;
  const px = pc.getContext('2d')!;
  const grad = px.createLinearGradient(0, 0, 512, 128);
  grad.addColorStop(0, '#f3d473');
  grad.addColorStop(0.5, '#d6a536');
  grad.addColorStop(1, '#f1cf6b');
  px.fillStyle = grad;
  px.fillRect(0, 0, 512, 128);
  px.strokeStyle = '#7e5912';
  px.lineWidth = 6;
  px.strokeRect(8, 8, 496, 112);
  px.fillStyle = '#4c3206';
  px.textAlign = 'center';
  px.textBaseline = 'middle';
  px.font = '700 32px Georgia, serif';
  px.fillText('HOLINESS TO YAHWEH', 256, 46);
  px.font = '700 30px "PingFang SC", "Noto Serif SC", serif';
  px.fillText('归雅伟为圣', 256, 88);
  const plate = markShared(new THREE.CanvasTexture(pc));

  cachedMaps = { linen, ephod, sash, plate };
  return cachedMaps;
}

/**
 * High Priest garments (Exodus 28) on an accurate 1.72m short-haired human stature (1 Cor 11:14).
 * Scales the 1-span breastpiece dynamically with `cubitM` (`span = 0.5 * cubitM`).
 */
export function buildHighPriest(
  cubitM = 0.445,
  variant: HighPriestVariant = 'vested',
  heightM = 1.72,
): THREE.Group {
  const g = new THREE.Group();
  const maps = getSharedMaps();
  const s = heightM / 1.72;
  const span = Math.max(0.18, Math.min(0.32, 0.5 * cubitM));

  // Shared PBR materials
  const mSkin = new THREE.MeshStandardMaterial({ color: 0xb9855e, roughness: 0.68 });
  const mHair = new THREE.MeshStandardMaterial({ color: 0x261a14, roughness: 0.88 });
  const mSandal = new THREE.MeshStandardMaterial({ color: 0x563922, roughness: 0.85 });
  const mLinen = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps.linen,
    roughness: 0.86,
  });
  const mSash = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps.sash,
    roughness: 0.78,
  });
  const mBlue = new THREE.MeshStandardMaterial({
    color: 0x1e4f8d,
    roughness: 0.74,
    side: THREE.DoubleSide,
  });
  const mBlueCord = new THREE.MeshStandardMaterial({ color: 0x2762ad, roughness: 0.52 });
  const mEphod = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps.ephod,
    roughness: 0.58,
    metalness: 0.14,
    side: THREE.DoubleSide,
  });
  const mGold = new THREE.MeshStandardMaterial({
    color: 0xe6b949,
    metalness: 0.86,
    roughness: 0.24,
  });
  const mGoldPlate = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps.plate,
    metalness: 0.65,
    roughness: 0.28,
  });
  const mPomegranate = new THREE.MeshStandardMaterial({ color: 0x8d1b2e, roughness: 0.48 });
  const mCrimson = new THREE.MeshStandardMaterial({ color: 0x9f2326, roughness: 0.68 });
  const mOnyx = new THREE.MeshStandardMaterial({
    color: 0x181a1f,
    roughness: 0.16,
    metalness: 0.28,
  });

  // Modest sandals + ankles
  for (const side of [-1, 1]) {
    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.095 * s, 0.022 * s, 0.24 * s),
      mSandal,
    );
    sole.position.set(side * 0.092 * s, 0.011 * s, 0.024 * s);
    g.add(sole);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.075 * s, 0.044 * s, 0.19 * s),
      mSkin,
    );
    foot.position.set(side * 0.092 * s, 0.042 * s, 0.014 * s);
    g.add(foot);

    const ankle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042 * s, 0.038 * s, 0.065 * s, 12),
      mSkin,
    );
    ankle.position.set(side * 0.092 * s, 0.075 * s, -0.005 * s);
    g.add(ankle);
  }

  // 1. Fine Linen Inner Tunic (Kuttonet, Exod 28:39)
  const tunicBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.182 * s, 0.245 * s, 1.32 * s, 26),
    mLinen,
  );
  tunicBody.scale.set(1.06, 1, 0.72);
  tunicBody.position.y = 0.74 * s;
  g.add(tunicBody);

  // Tunic neckline & sleeves
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.092 * s, 0.016 * s, 10, 20),
    mLinen,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 1.40 * s, 0);
  g.add(collar);

  for (const side of [-1, 1]) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.215 * s, 1.34 * s, 0);
    armGroup.rotation.z = side * 0.17;
    armGroup.rotation.x = variant === 'breastpiece' ? -0.18 : -0.06;

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056 * s, 0.068 * s, 0.48 * s, 16),
      mLinen,
    );
    sleeve.position.y = -0.23 * s;
    armGroup.add(sleeve);

    const wristBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.069 * s, 0.069 * s, 0.025 * s, 16),
      mGold,
    );
    wristBand.position.y = -0.46 * s;
    armGroup.add(wristBand);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.042 * s, 12, 10),
      mSkin,
    );
    hand.scale.set(0.85, 1.25, 0.7);
    hand.position.y = -0.51 * s;
    armGroup.add(hand);

    g.add(armGroup);
  }

  // 2. Blue Robe of the Ephod (Me'il, Exod 28:31-35)
  const blueRobe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.194 * s, 0.242 * s, 1.03 * s, 28, 1, true),
    mBlue,
  );
  blueRobe.scale.set(1.07, 1, 0.74);
  blueRobe.position.y = 0.875 * s;
  g.add(blueRobe);

  // Woven binding around neck opening so it will not tear (Exod 28:32)
  const robeCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.105 * s, 0.017 * s, 10, 24),
    mBlue,
  );
  robeCollar.rotation.x = Math.PI / 2;
  robeCollar.scale.set(1.05, 0.85, 1);
  robeCollar.position.y = 1.385 * s;
  g.add(robeCollar);

  // Shoulder mantle of the blue robe
  const blueShoulders = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115 * s, 0.198 * s, 0.07 * s, 24),
    mBlue,
  );
  blueShoulders.scale.set(1.08, 1, 0.75);
  blueShoulders.position.y = 1.375 * s;
  g.add(blueShoulders);

  // 24 Alternating Hem Ornaments: 12 Pomegranates (blue/purple/scarlet) + 12 Golden Bells (Exod 28:33-34)
  const hemCount = 24;
  const rx = 0.258 * s;
  const rz = 0.178 * s;
  const bellGeo = new THREE.ConeGeometry(0.018 * s, 0.036 * s, 12, 1, true);
  const clapperGeo = new THREE.SphereGeometry(0.007 * s, 8, 6);
  const pomGeo = new THREE.SphereGeometry(0.022 * s, 12, 10);
  const calyxGeo = new THREE.ConeGeometry(0.011 * s, 0.014 * s, 6);

  for (let i = 0; i < hemCount; i++) {
    const a = (i / hemCount) * Math.PI * 2;
    const hx = Math.cos(a) * rx;
    const hz = Math.sin(a) * rz;
    if (i % 2 === 0) {
      const pom = new THREE.Group();
      const body = new THREE.Mesh(pomGeo, i % 4 === 0 ? mPomegranate : mCrimson);
      body.scale.set(1, 1.12, 1);
      const calyx = new THREE.Mesh(calyxGeo, mBlueCord);
      calyx.rotation.x = Math.PI;
      calyx.position.y = -0.024 * s;
      pom.add(body, calyx);
      pom.position.set(hx, 0.342 * s, hz);
      g.add(pom);
    } else {
      const bell = new THREE.Group();
      const cup = new THREE.Mesh(bellGeo, mGold);
      cup.userData.shimmer = i;
      const clapper = new THREE.Mesh(clapperGeo, mGold);
      clapper.position.y = -0.018 * s;
      bell.add(cup, clapper);
      bell.position.set(hx, 0.340 * s, hz);
      g.add(bell);
    }
  }

  // 3. Embroidered Linen Sash (Avnet) & hanging ends (Exod 28:39)
  const sashBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205 * s, 0.212 * s, 0.08 * s, 26),
    mSash,
  );
  sashBand.scale.set(1.07, 1, 0.74);
  sashBand.position.y = 0.99 * s;
  g.add(sashBand);

  for (const offset of [-0.036, 0.028]) {
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.044 * s, 0.32 * s, 0.014 * s),
      mSash,
    );
    tail.position.set(offset * s, 0.80 * s, 0.155 * s);
    tail.rotation.z = offset * -1.2;
    g.add(tail);
  }

  // 4. Ephod: woven front/back apron, waistband, shoulder straps & onyx shoulder stones (Exod 28:6-14)
  const ephodFront = new THREE.Mesh(
    new THREE.CylinderGeometry(0.198 * s, 0.228 * s, 0.64 * s, 24, 1, true, -0.78, 1.56),
    mEphod,
  );
  ephodFront.scale.set(1.08, 1, 0.76);
  ephodFront.position.y = 1.06 * s;
  g.add(ephodFront);

  const ephodBack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.198 * s, 0.228 * s, 0.64 * s, 24, 1, true, Math.PI - 0.78, 1.56),
    mEphod,
  );
  ephodBack.scale.set(1.08, 1, 0.76);
  ephodBack.position.y = 1.06 * s;
  g.add(ephodBack);

  const ephodBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.212 * s, 0.216 * s, 0.056 * s, 28),
    mEphod,
  );
  ephodBelt.scale.set(1.08, 1, 0.76);
  ephodBelt.position.y = 1.03 * s;
  g.add(ephodBelt);

  // Ephod gold trim border
  const goldTrimTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.22 * s, 0.012 * s, 0.012 * s),
    mGold,
  );
  goldTrimTop.position.set(0, 1.375 * s, 0.148 * s);
  g.add(goldTrimTop);

  const stoneY = 1.418 * s;
  const stoneX = 0.132 * s;
  for (const side of [-1, 1]) {
    // Ephod shoulder strap arching over each shoulder
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.125 * s, 1.35 * s, 0.14 * s),
      new THREE.Vector3(side * 0.132 * s, 1.425 * s, 0.01 * s),
      new THREE.Vector3(side * 0.125 * s, 1.35 * s, -0.14 * s),
    ]);
    const strap = new THREE.Mesh(
      new THREE.TubeGeometry(strapCurve, 12, 0.022 * s, 6, false),
      mEphod,
    );
    strap.scale.set(1.3, 0.55, 1);
    g.add(strap);

    // Filigree gold setting + onyx shoulder stone (Exod 28:9-12)
    const ouch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032 * s, 0.034 * s, 0.015 * s, 14),
      mGold,
    );
    ouch.position.set(side * stoneX, stoneY, 0.008 * s);
    g.add(ouch);

    const stone = new THREE.Mesh(
      new THREE.SphereGeometry(0.024 * s, 14, 10),
      mOnyx,
    );
    stone.scale.set(1, 0.48, 1.15);
    stone.position.set(side * stoneX, stoneY + 0.01 * s, 0.008 * s);
    g.add(stone);
  }

  // 5. Breastpiece of Judgment: folded square 1 span x 1 span (0.5 * cubitM) + 12 stones (Exod 28:15-30)
  const bpW = span;
  const bpH = span;
  const bpCenterY = 1.21 * s;
  const bpGroup = new THREE.Group();
  bpGroup.position.set(0, bpCenterY, 0.162 * s);

  // Back wall of doubled breastpiece pouch + Urim & Thummim inside
  const bpBack = new THREE.Mesh(
    new THREE.BoxGeometry(bpW, bpH, 0.010 * s),
    mEphod,
  );
  bpGroup.add(bpBack);

  const bpFrame = new THREE.Mesh(
    new THREE.BoxGeometry(bpW + 0.016 * s, bpH + 0.016 * s, 0.008 * s),
    mGold,
  );
  bpFrame.position.z = -0.004 * s;
  bpGroup.add(bpFrame);

  // Urim (radiant white) & Thummim (deep smoked crystal) inside the fold (Exod 28:30)
  const mUrim = new THREE.MeshStandardMaterial({
    color: 0xfffcf2,
    emissive: 0xd8c37a,
    emissiveIntensity: variant === 'breastpiece' ? 0.55 : 0.12,
    roughness: 0.15,
  });
  const mThummim = new THREE.MeshStandardMaterial({
    color: 0x24344c,
    emissive: 0x3b6da8,
    emissiveIntensity: variant === 'breastpiece' ? 0.45 : 0.08,
    roughness: 0.18,
  });
  const urim = new THREE.Mesh(new THREE.OctahedronGeometry(0.019 * s, 1), mUrim);
  urim.scale.set(1.1, 1.3, 0.5);
  urim.position.set(-0.028 * s, 0.005 * s, 0.010 * s);
  const thummim = new THREE.Mesh(new THREE.OctahedronGeometry(0.019 * s, 1), mThummim);
  thummim.scale.set(1.1, 1.3, 0.5);
  thummim.position.set(0.028 * s, 0.005 * s, 0.010 * s);
  bpGroup.add(urim, thummim);

  // Hinged front square leaf with 12 bezel-set gemstones (in 'breastpiece' variant, slightly swung forward)
  const frontPivot = new THREE.Group();
  frontPivot.position.set(0, -bpH * 0.5, 0.016 * s);
  if (variant === 'breastpiece') {
    frontPivot.rotation.x = 0.48; // Opens the doubled pouch cleanly to reveal Urim & Thummim
  }

  const frontPlate = new THREE.Mesh(
    new THREE.BoxGeometry(bpW, bpH, 0.012 * s),
    mEphod,
  );
  frontPlate.position.set(0, bpH * 0.5, 0.004 * s);
  frontPivot.add(frontPlate);

  // Gold border molding on front plate
  const bpRimTop = new THREE.Mesh(
    new THREE.BoxGeometry(bpW + 0.014 * s, 0.011 * s, 0.016 * s),
    mGold,
  );
  bpRimTop.position.set(0, bpH, 0.005 * s);
  const bpRimBot = bpRimTop.clone();
  bpRimBot.position.set(0, 0, 0.005 * s);
  frontPivot.add(bpRimTop, bpRimBot);

  // 4 rows x 3 columns of gemstones (Exod 28:17-20)
  const gemColors = [
    0xb81d2a, 0xd8b136, 0x1d7d44, // Row 1: sardius, topaz, emerald
    0x278e8d, 0x1b4298, 0xe8eff8, // Row 2: turquoise/carbuncle, sapphire, diamond
    0xd66b1f, 0xa8643a, 0x6f318c, // Row 3: jacinth, agate, amethyst
    0x859936, 0x1e2124, 0x3b8055, // Row 4: beryl, onyx, jasper
  ];
  const bezelGeo = new THREE.CylinderGeometry(bpW * 0.115, bpW * 0.125, 0.009 * s, 12);
  const gemGeo = new THREE.OctahedronGeometry(bpW * 0.09, 1);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const gx = (col - 1) * (bpW * 0.275);
      const gy = bpH * 0.5 + (1.5 - row) * (bpH * 0.205);

      const bezel = new THREE.Mesh(bezelGeo, mGold);
      bezel.rotation.x = Math.PI / 2;
      bezel.position.set(gx, gy, 0.012 * s);
      frontPivot.add(bezel);

      const gm = new THREE.MeshStandardMaterial({
        color: gemColors[idx],
        roughness: 0.14,
        metalness: 0.15,
        emissive: gemColors[idx],
        emissiveIntensity: 0.12,
      });
      const gem = new THREE.Mesh(gemGeo, gm);
      gem.scale.set(1, 1.15, 0.55);
      gem.position.set(gx, gy, 0.017 * s);
      gem.userData.shimmer = idx + 20;
      frontPivot.add(gem);
    }
  }
  bpGroup.add(frontPivot);

  // 4 Gold Rings at corners of the breastpiece + 2 chains up to onyx ouch + 2 blue cords down to ephod belt
  const ringGeo = new THREE.TorusGeometry(0.013 * s, 0.0038 * s, 8, 16);
  for (const side of [-1, 1]) {
    // Upper corner rings + braided gold chains to shoulder stones
    const upperRingWorld = new THREE.Vector3(
      side * (bpW * 0.48),
      bpCenterY + bpH * 0.45,
      0.168 * s,
    );
    const upperRing = new THREE.Mesh(ringGeo, mGold);
    upperRing.position.copy(upperRingWorld);
    g.add(upperRing);

    const chainCurve = new THREE.CatmullRomCurve3([
      upperRingWorld,
      new THREE.Vector3(side * (stoneX * 0.9), 1.375 * s, 0.13 * s),
      new THREE.Vector3(side * stoneX, stoneY, 0.025 * s),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(chainCurve, 12, 0.0048 * s, 6, false), mGold));

    // Lower corner rings + blue cords down to ephod waistband rings
    const lowerRingWorld = new THREE.Vector3(
      side * (bpW * 0.48),
      bpCenterY - bpH * 0.46,
      0.168 * s,
    );
    const lowerRing = new THREE.Mesh(ringGeo, mGold);
    lowerRing.position.copy(lowerRingWorld);
    g.add(lowerRing);

    const beltRingPos = new THREE.Vector3(side * 0.145 * s, 1.045 * s, 0.162 * s);
    const beltRing = new THREE.Mesh(ringGeo, mGold);
    beltRing.position.copy(beltRingPos);
    g.add(beltRing);

    const cordCurve = new THREE.CatmullRomCurve3([
      lowerRingWorld,
      new THREE.Vector3(side * 0.135 * s, 1.075 * s, 0.175 * s),
      beltRingPos,
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 8, 0.004 * s, 6, false), mBlueCord));
  }
  g.add(bpGroup);

  // 6. Neck, Head, Short Hair & Short Beard (1 Cor 11:14)
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056 * s, 0.064 * s, 0.095 * s, 14),
    mSkin,
  );
  neck.position.y = 1.435 * s;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.104 * s, 20, 16), mSkin);
  head.scale.set(0.86, 1.06, 0.94);
  head.position.y = 1.545 * s;
  g.add(head);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.015 * s, 0.036 * s, 6), mSkin);
  nose.rotation.x = Math.PI * 0.42;
  nose.position.set(0, 1.535 * s, 0.098 * s);
  g.add(nose);

  // Short cropped hair cap & neat beard (strictly short hair per 1 Cor 11:14)
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.108 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    mHair,
  );
  hairCap.scale.set(0.87, 0.96, 0.96);
  hairCap.position.set(0, 1.56 * s, -0.008 * s);
  hairCap.rotation.x = -0.22;
  g.add(hairCap);

  const beard = new THREE.Mesh(
    new THREE.SphereGeometry(0.088 * s, 14, 10, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.44),
    mHair,
  );
  beard.scale.set(0.90, 1.08, 0.96);
  beard.position.set(0, 1.505 * s, 0.012 * s);
  g.add(beard);

  // 7. Fine-Linen Turban / Mitre (Mitznefet) wrapped cleanly up to 1.72m (Exod 28:39)
  const wrap1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.108 * s, 0.032 * s, 12, 26),
    mLinen,
  );
  wrap1.rotation.x = Math.PI / 2;
  wrap1.scale.set(0.92, 1.02, 1);
  wrap1.position.y = 1.62 * s;
  g.add(wrap1);

  const wrap2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.104 * s, 0.032 * s, 12, 26),
    mLinen,
  );
  wrap2.rotation.x = Math.PI / 2 + 0.07;
  wrap2.scale.set(0.92, 1.02, 1);
  wrap2.position.y = 1.658 * s;
  g.add(wrap2);

  const mitreCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.114 * s, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mLinen,
  );
  mitreCrown.scale.set(0.92, 0.72, 1.0);
  mitreCrown.position.y = 1.645 * s;
  g.add(mitreCrown);

  // 8. Pure Gold Crown Plate (Tzitz) tied with Blue Lace (Exod 28:36-38)
  const blueLace = new THREE.Mesh(
    new THREE.TorusGeometry(0.117 * s, 0.0055 * s, 8, 28),
    mBlueCord,
  );
  blueLace.rotation.x = Math.PI / 2;
  blueLace.scale.set(0.92, 1.03, 1);
  blueLace.position.y = 1.615 * s;
  g.add(blueLace);

  // Curved engraved gold frontlet facing forward (+Z)
  const frontlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.120 * s, 0.120 * s, 0.042 * s, 24, 1, true, -0.78, 1.56),
    mGoldPlate,
  );
  frontlet.scale.set(0.93, 1, 1.04);
  frontlet.position.y = 1.618 * s;
  g.add(frontlet);

  const frontletBack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118 * s, 0.118 * s, 0.042 * s, 24, 1, true, -0.78, 1.56),
    mGold,
  );
  frontletBack.scale.set(0.93, 1, 1.04);
  frontletBack.position.y = 1.618 * s;
  g.add(frontletBack);

  return g;
}
