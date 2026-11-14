import * as THREE from 'three';
import { buildLaver } from './temple-parts.ts';

export type ShowbreadVariant = 'full' | 'cutaway';
export type IncenseVariant = 'lit' | 'cutaway';
export type BronzeAltarVariant = 'tabernacle-cutaway' | 'tabernacle-full';
export type WheeledLaverVariant = 'single' | 'five-row';

interface SharedTextures {
  acacia: THREE.CanvasTexture;
  hammeredBronze: THREE.CanvasTexture;
  laverRelief: THREE.CanvasTexture;
  loaf: THREE.CanvasTexture;
}

let cachedTex: SharedTextures | null = null;

function makeSharedTex(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.userData.shared = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function getSharedTextures(): SharedTextures {
  if (cachedTex) return cachedTex;

  // 1. Acacia wood grain
  const ac = document.createElement('canvas');
  ac.width = 256;
  ac.height = 256;
  const ax = ac.getContext('2d')!;
  ax.fillStyle = '#7e4e2a';
  ax.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    const shade = 110 + Math.floor(Math.sin(y * 0.14) * 18 + Math.cos(y * 0.43) * 10);
    ax.fillStyle = `rgba(${shade}, ${Math.floor(shade * 0.62)}, ${Math.floor(shade * 0.34)}, 0.45)`;
    ax.fillRect(0, y, 256, 2);
  }
  const acacia = makeSharedTex(ac, 2, 2);

  // 2. Hammered bronze patina
  const bc = document.createElement('canvas');
  bc.width = 256;
  bc.height = 256;
  const bx = bc.getContext('2d')!;
  bx.fillStyle = '#b4743d';
  bx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const r = 4 + (i % 6);
    bx.fillStyle = i % 3 === 0 ? 'rgba(220,164,95,0.22)' : 'rgba(110,64,28,0.22)';
    bx.beginPath();
    bx.arc(x, y, r, 0, Math.PI * 2);
    bx.fill();
  }
  const hammeredBronze = makeSharedTex(bc, 2, 2);

  // 3. Cast panel relief for 1 Kings 7:29 (lions, oxen, cherubim + festooned wreaths)
  const rc = document.createElement('canvas');
  rc.width = 256;
  rc.height = 256;
  const rx = rc.getContext('2d')!;
  rx.fillStyle = '#9a6131';
  rx.fillRect(0, 0, 256, 256);
  rx.strokeStyle = '#d9a15a';
  rx.lineWidth = 6;
  rx.strokeRect(10, 10, 236, 236);
  rx.strokeStyle = '#6c3e19';
  rx.lineWidth = 3;
  rx.strokeRect(18, 18, 220, 220);

  // Stylized embossed animal/winged silhouettes + lower wreaths
  const drawEmblem = (cx: number, cy: number, winged: boolean) => {
    rx.fillStyle = '#d79e59';
    rx.beginPath();
    rx.ellipse(cx, cy + 8, 20, 11, 0, 0, Math.PI * 2);
    rx.fill();
    rx.beginPath();
    rx.arc(cx + 16, cy - 2, 8, 0, Math.PI * 2);
    rx.fill();
    if (winged) {
      rx.beginPath();
      rx.moveTo(cx - 4, cy);
      rx.quadraticCurveTo(cx - 28, cy - 28, cx + 6, cy - 22);
      rx.closePath();
      rx.fill();
    }
  };
  drawEmblem(74, 96, false);
  drawEmblem(182, 96, false);
  drawEmblem(128, 152, true);

  // Festoon wreath garland at bottom
  rx.strokeStyle = '#dca45f';
  rx.lineWidth = 5;
  rx.beginPath();
  rx.arc(76, 198, 26, 0.15 * Math.PI, 0.85 * Math.PI);
  rx.stroke();
  rx.beginPath();
  rx.arc(180, 198, 26, 0.15 * Math.PI, 0.85 * Math.PI);
  rx.stroke();
  const laverRelief = makeSharedTex(rc, 1, 1);

  // 4. Baked unleavened bread texture
  const lc = document.createElement('canvas');
  lc.width = 128;
  lc.height = 128;
  const lx = lc.getContext('2d')!;
  const grad = lx.createRadialGradient(64, 64, 12, 64, 64, 64);
  grad.addColorStop(0, '#dfb06d');
  grad.addColorStop(0.7, '#c78c48');
  grad.addColorStop(1, '#9b6229');
  lx.fillStyle = grad;
  lx.fillRect(0, 0, 128, 128);
  const loaf = makeSharedTex(lc, 1, 1);

  cachedTex = { acacia, hammeredBronze, laverRelief, loaf };
  return cachedTex;
}

/** Shared hammered/polished metal & acacia materials for furnishings. */
export function furnaceMaterials() {
  const tex = getSharedTextures();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xe7ba4c,
    metalness: 0.88,
    roughness: 0.22,
  });
  const goldAccent = new THREE.MeshStandardMaterial({
    color: 0xf4cf6b,
    metalness: 0.9,
    roughness: 0.16,
  });
  const acacia = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.acacia,
    roughness: 0.78,
  });
  const bronze = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.hammeredBronze,
    metalness: 0.72,
    roughness: 0.36,
  });
  const panel = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.laverRelief,
    metalness: 0.68,
    roughness: 0.34,
  });
  return { gold, goldAccent, acacia, bronze, panel, tex };
}

function addGoldRingsAndPoles(
  parent: THREE.Group,
  spanX: number,
  spanZ: number,
  ringY: number,
  poleLen: number,
  ringR: number,
  poleR: number,
  mat: THREE.Material,
  acaciaCoreMat?: THREE.Material,
  cutPoleTip = false,
) {
  const ringGeo = new THREE.TorusGeometry(ringR, ringR * 0.28, 10, 20);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * spanX, ringY, sz * spanZ);
      parent.add(ring);
    }
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(poleR, poleR, poleLen, 14),
      mat,
    );
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, ringY, sz * spanZ);
    parent.add(pole);

    if (acaciaCoreMat && cutPoleTip && sz < 0) {
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(poleR * 0.72, poleR * 0.72, poleLen * 0.12, 12),
        acaciaCoreMat,
      );
      core.rotation.z = Math.PI / 2;
      core.position.set(poleLen * 0.48, ringY, sz * spanZ);
      parent.add(core);
    }
  }
}

/**
 * Table of Showbread (Exodus 25:23-30; Leviticus 24:5-9):
 * 2 x 1 x 1.5 cubits acacia table overlaid with pure gold, double crown rim,
 * handbreadth border, 4 corner rings + staves, 12 unleavened loaves in 2 stacks of 6,
 * plus 2 golden frankincense bowls & libation vessels.
 */
export function buildShowbreadTable(
  cubitM: number,
  variant: ShowbreadVariant = 'full',
): THREE.Group {
  const C = cubitM;
  const L = 2 * C;
  const W = 1 * C;
  const H = 1.5 * C;
  const { gold, goldAccent, acacia, tex } = furnaceMaterials();
  const g = new THREE.Group();

  const legW = 0.105 * C;
  const topThick = 0.085 * C;
  const handbreadth = C / 6; // ~7.4cm border below apron
  const cut = variant === 'cutaway';

  // Acacia core slab + corner cutaway reveal
  if (cut) {
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(L * 0.94, topThick * 0.84, W * 0.94),
      acacia,
    );
    core.position.y = H - topThick * 0.5;
    g.add(core);

    // Partial gold shell leaving front-right corner wood exposed
    const shellBack = new THREE.Mesh(
      new THREE.BoxGeometry(L, topThick, W * 0.54),
      gold,
    );
    shellBack.position.set(0, H - topThick * 0.5, -W * 0.23);
    const shellLeft = new THREE.Mesh(
      new THREE.BoxGeometry(L * 0.52, topThick, W * 0.48),
      gold,
    );
    shellLeft.position.set(-L * 0.24, H - topThick * 0.5, W * 0.26);
    g.add(shellBack, shellLeft);
  } else {
    const top = new THREE.Mesh(new THREE.BoxGeometry(L, topThick, W), gold);
    top.position.y = H - topThick * 0.5;
    g.add(top);
  }

  // Double Golden Crown Molding (around top perimeter & around handbreadth border)
  const makeCrownPerimeter = (yCenter: number, wSpan: number, lSpan: number, h: number) => {
    const barZ = new THREE.Mesh(new THREE.BoxGeometry(lSpan + 0.03 * C, h, 0.024 * C), goldAccent);
    for (const sz of [-1, 1]) {
      const m = barZ.clone();
      m.position.set(0, yCenter, sz * (wSpan * 0.5 + 0.008 * C));
      g.add(m);
    }
    const barX = new THREE.Mesh(new THREE.BoxGeometry(0.024 * C, h, wSpan + 0.03 * C), goldAccent);
    for (const sx of [-1, 1]) {
      const m = barX.clone();
      m.position.set(sx * (lSpan * 0.5 + 0.008 * C), yCenter, 0);
      g.add(m);
    }
  };
  makeCrownPerimeter(H + 0.015 * C, W, L, 0.042 * C); // upper rim crown

  // Handbreadth border (Exod 25:25) below tabletop
  const apronY = H - topThick - handbreadth * 0.5;
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(L - legW * 1.4, handbreadth, 0.045 * C),
      cut && sz > 0 ? acacia : gold,
    );
    rail.position.set(0, apronY, sz * (W * 0.5 - legW * 0.5));
    g.add(rail);
  }
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.045 * C, handbreadth, W - legW * 1.4),
      gold,
    );
    rail.position.set(sx * (L * 0.5 - legW * 0.5), apronY, 0);
    g.add(rail);
  }
  makeCrownPerimeter(apronY - handbreadth * 0.45, W - 0.02 * C, L - 0.02 * C, 0.03 * C);

  // Four legs
  const legH = H - topThick;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const useAcacia = cut && sx > 0 && sz > 0;
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(legW, legH, legW),
        useAcacia ? acacia : gold,
      );
      leg.position.set(
        sx * (L * 0.5 - legW * 0.55),
        legH * 0.5,
        sz * (W * 0.5 - legW * 0.55),
      );
      g.add(leg);

      // Tapered foot pad
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(legW * 1.24, 0.04 * C, legW * 1.24),
        goldAccent,
      );
      foot.position.set(leg.position.x, 0.02 * C, leg.position.z);
      g.add(foot);
    }
  }

  // 4 Gold Rings below the border + 2 Gold Carrying Poles (Exod 25:26-28)
  addGoldRingsAndPoles(
    g,
    L * 0.5 - legW * 0.55,
    W * 0.5 + 0.032 * C,
    apronY - handbreadth * 0.65,
    3.15 * C,
    0.045 * C,
    0.026 * C,
    goldAccent,
    acacia,
    cut,
  );

  // 12 Loaves of Showbread in 2 stacks of 6 (Lev 24:5-6) + golden separator reeds + 2 Frankincense bowls
  const loafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.loaf,
    roughness: 0.72,
  });
  const incenseMat = new THREE.MeshStandardMaterial({
    color: 0xfaf2d6,
    emissive: 0x6b5626,
    emissiveIntensity: 0.14,
    roughness: 0.42,
  });

  const stackRadius = 0.25 * C;
  const loafThick = 0.055 * C;
  for (const sx of [-0.46 * C, 0.46 * C]) {
    // Under-dish golden tray
    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(stackRadius * 1.14, stackRadius * 1.05, 0.018 * C, 24),
      goldAccent,
    );
    tray.position.set(sx, H + 0.009 * C, 0);
    g.add(tray);

    for (let i = 0; i < 6; i++) {
      const y = H + 0.022 * C + i * (loafThick + 0.012 * C);
      const loaf = new THREE.Mesh(
        new THREE.CylinderGeometry(stackRadius, stackRadius * 1.04, loafThick, 22),
        loafMat,
      );
      loaf.position.set(sx, y + loafThick * 0.5, 0);
      loaf.rotation.y = i * 0.4;
      g.add(loaf);

      // Thin golden hollow tubes between loaves for airflow (b. Menahot / Exod 25:29 dishes)
      if (i < 5) {
        for (const rOff of [-0.09 * C, 0, 0.09 * C]) {
          const reed = new THREE.Mesh(
            new THREE.CylinderGeometry(0.007 * C, 0.007 * C, stackRadius * 1.85, 6),
            goldAccent,
          );
          reed.rotation.x = Math.PI / 2;
          reed.position.set(sx + rOff, y + loafThick + 0.006 * C, 0);
          g.add(reed);
        }
      }
    }

    // Golden Frankincense bowl atop each 6-loaf stack (Lev 24:7)
    const stackTop = H + 0.022 * C + 6 * (loafThick + 0.012 * C);
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115 * C, 0.068 * C, 0.068 * C, 20),
      goldAccent,
    );
    bowl.position.set(sx, stackTop + 0.032 * C, 0);
    g.add(bowl);

    const resin = new THREE.Mesh(
      new THREE.SphereGeometry(0.085 * C, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      incenseMat,
    );
    resin.position.set(sx, stackTop + 0.056 * C, 0);
    g.add(resin);
  }

  // Libation flagon & spoon beside the stacks (Exod 25:29)
  const flagon = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.065 * C, 0),
        new THREE.Vector2(0.088 * C, 0.09 * C),
        new THREE.Vector2(0.038 * C, 0.21 * C),
        new THREE.Vector2(0.058 * C, 0.27 * C),
      ],
      18,
    ),
    goldAccent,
  );
  flagon.position.set(0, H, -0.27 * C);
  g.add(flagon);

  return g;
}

/**
 * Altar of Incense (Exodus 30:1-10):
 * 1 x 1 x 2 cubits square acacia altar overlaid with pure gold,
 * 4 horns at upper corners, golden crown molding, 2 rings + poles,
 * glowing ember bed and rising translucent incense wisps.
 */
export function buildIncenseAltar(
  cubitM: number,
  variant: IncenseVariant = 'lit',
): THREE.Group {
  const C = cubitM;
  const W = 1 * C;
  const H = 2 * C;
  const { gold, goldAccent, acacia } = furnaceMaterials();
  const g = new THREE.Group();
  const cut = variant === 'cutaway';

  // Stepped base plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W * 1.1, 0.14 * C, W * 1.1), gold);
  plinth.position.y = 0.07 * C;
  g.add(plinth);

  const shaftH = H - 0.36 * C;
  if (cut) {
    // Inner acacia core + outer partial gold plating
    const woodShaft = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.92, shaftH * 0.98, W * 0.92),
      acacia,
    );
    woodShaft.position.y = 0.14 * C + shaftH * 0.5;
    g.add(woodShaft);

    const goldBack = new THREE.Mesh(
      new THREE.BoxGeometry(W, shaftH, W * 0.54),
      gold,
    );
    goldBack.position.set(0, 0.14 * C + shaftH * 0.5, -W * 0.23);
    const goldLeft = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.52, shaftH, W * 0.46),
      gold,
    );
    goldLeft.position.set(-W * 0.24, 0.14 * C + shaftH * 0.5, W * 0.27);
    g.add(goldBack, goldLeft);
  } else {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(W, shaftH, W), gold);
    shaft.position.y = 0.14 * C + shaftH * 0.5;
    g.add(shaft);
  }

  // Molded top & golden crown rim (Exod 30:3)
  const capY = H - 0.20 * C;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W * 1.07, 0.12 * C, W * 1.07), goldAccent);
  cap.position.y = capY;
  g.add(cap);

  for (const sz of [-1, 1]) {
    const crownBar = new THREE.Mesh(
      new THREE.BoxGeometry(W * 1.12, 0.065 * C, 0.032 * C),
      goldAccent,
    );
    crownBar.position.set(0, capY + 0.075 * C, sz * W * 0.53);
    g.add(crownBar);
  }
  for (const sx of [-1, 1]) {
    const crownBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.032 * C, 0.065 * C, W * 1.12),
      goldAccent,
    );
    crownBar.position.set(sx * W * 0.53, capY + 0.075 * C, 0);
    g.add(crownBar);
  }

  // Four corner horns rising cleanly to total H = 2C (Exod 30:2)
  const hornH = 0.16 * C;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.065 * C, hornH, 8),
        goldAccent,
      );
      horn.position.set(sx * W * 0.46, H - hornH * 0.5, sz * W * 0.46);
      g.add(horn);
    }
  }

  // Two golden rings on opposite sides below the crown + carrying poles (Exod 30:4-5)
  const ringGeo = new THREE.TorusGeometry(0.055 * C, 0.015 * C, 10, 20);
  for (const sz of [-1, 1]) {
    const ring = new THREE.Mesh(ringGeo, goldAccent);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, capY - 0.14 * C, sz * (W * 0.55));
    g.add(ring);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026 * C, 0.026 * C, 2.5 * C, 14),
      gold,
    );
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, capY - 0.14 * C, sz * (W * 0.55));
    g.add(pole);
  }

  // Golden incense censer tray + glowing embers + animated smoke plumes
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff5a1f,
    emissive: 0xff4500,
    emissiveIntensity: 0.9,
    roughness: 0.5,
  });
  const embers = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * C, 0.34 * C, 0.04 * C, 16),
    emberMat,
  );
  embers.position.y = capY + 0.075 * C;
  embers.userData.ember = 1;
  g.add(embers);

  // Subtle aromatic incense smoke wisps drifting upward
  const puffCount = cut ? 3 : 6;
  for (let i = 0; i < puffCount; i++) {
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xe6ebf5,
      transparent: true,
      opacity: 0.24 - i * 0.025,
      roughness: 1,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry((0.08 + i * 0.038) * C, 12, 10),
      smokeMat,
    );
    puff.scale.set(1.25, 0.72, 1.15);
    const baseY = capY + (0.16 + i * 0.22) * C;
    puff.position.set(Math.sin(i * 1.4) * 0.04 * C, baseY, Math.cos(i * 1.1) * 0.04 * C);
    puff.userData.smoke = { index: i, baseY, amplitude: 0.07 * C };
    g.add(puff);
  }

  return g;
}

/**
 * Bronze Altar of Burnt Offering (Exodus 27:1-8; 38:1-7):
 * 5 x 5 x 3 cubits hollow acacia boards overlaid with bronze,
 * halfway bronze grating/network (1.5 cubits height), interior perimeter ledge,
 * 4 corner horns, 4 bronze rings + carrying poles, glowing sacrificial hearth.
 */
export function buildBronzeAltar(
  cubitM: number,
  variant: BronzeAltarVariant = 'tabernacle-cutaway',
): THREE.Group {
  const C = cubitM;
  const W = 5 * C;
  const H = 3 * C;
  const wallT = 0.28 * C;
  const grateY = 1.5 * C;
  const { bronze, acacia } = furnaceMaterials();
  const g = new THREE.Group();
  const cut = variant === 'tabernacle-cutaway';

  // Solid lower rammed-earth/stone fill bed inside the hollow enclosure (Exod 20:24; 27:8)
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x5c4a3a, roughness: 0.96 });
  const earthCore = new THREE.Mesh(
    new THREE.BoxGeometry(W - wallT * 2.1, 0.72 * C, W - wallT * 2.1),
    earthMat,
  );
  earthCore.position.y = 0.36 * C;
  g.add(earthCore);

  // Outer perimeter walls (if cutaway, front wall opens 70% to reveal hollow wood core + grating)
  const addWall = (
    cx: number,
    cz: number,
    sx: number,
    sz: number,
    showWoodEdge = false,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, H - 0.22 * C, sz), bronze);
    m.position.set(cx, (H - 0.22 * C) * 0.5, cz);
    g.add(m);
    if (showWoodEdge) {
      const woodInset = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.94, (H - 0.3 * C), sz * 0.72),
        acacia,
      );
      woodInset.position.set(cx, (H - 0.22 * C) * 0.5, cz);
      g.add(woodInset);
    }
  };

  // Back, Left, Right walls full
  addWall(0, -(W * 0.5 - wallT * 0.5), W, wallT);
  addWall(-(W * 0.5 - wallT * 0.5), 0, wallT, W - wallT * 2);
  addWall(W * 0.5 - wallT * 0.5, 0, wallT, W - wallT * 2);

  if (cut) {
    // Short front corner piers revealing inner cutaway section & mid-height bronze grate
    const pierW = 0.75 * C;
    addWall(-(W * 0.5 - pierW * 0.5), W * 0.5 - wallT * 0.5, pierW, wallT, true);
    addWall(W * 0.5 - pierW * 0.5, W * 0.5 - wallT * 0.5, pierW, wallT, true);
  } else {
    addWall(0, W * 0.5 - wallT * 0.5, W - wallT * 2, wallT);
  }

  // Interior perimeter ledge (Karkov, Exod 27:5; 38:4) supporting the bronze grating at 1.5C
  const ledgeT = 0.24 * C;
  for (const [cx, cz, sx, sz] of [
    [0, -(W * 0.5 - wallT - ledgeT * 0.5), W - wallT * 2, ledgeT],
    [-(W * 0.5 - wallT - ledgeT * 0.5), 0, ledgeT, W - wallT * 2],
    [W * 0.5 - wallT - ledgeT * 0.5, 0, ledgeT, W - wallT * 2],
  ] as const) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.14 * C, sz), bronze);
    ledge.position.set(cx, grateY - 0.08 * C, cz);
    g.add(ledge);
  }

  // Bronze network / grating (Kever, Exod 27:4-5) stretched at 1.5C halfway up
  const grateSpan = W - wallT * 2 - ledgeT * 1.4;
  const barCount = 11;
  for (let i = 0; i < barCount; i++) {
    const off = -grateSpan * 0.45 + (i / (barCount - 1)) * grateSpan * 0.9;
    const barX = new THREE.Mesh(new THREE.BoxGeometry(grateSpan, 0.055 * C, 0.055 * C), bronze);
    barX.position.set(0, grateY, off);
    g.add(barX);

    const barZ = new THREE.Mesh(new THREE.BoxGeometry(0.055 * C, 0.055 * C, grateSpan), bronze);
    barZ.position.set(off, grateY, 0);
    g.add(barZ);
  }

  // Glowing altar coals & ash bed sitting on the mid-height grate
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xe64e19,
    emissive: 0xd93c0a,
    emissiveIntensity: 0.72,
    roughness: 0.78,
  });
  const coalBed = new THREE.Mesh(
    new THREE.BoxGeometry(grateSpan * 0.68, 0.12 * C, grateSpan * 0.68),
    emberMat,
  );
  coalBed.position.y = grateY + 0.09 * C;
  coalBed.userData.ember = 2;
  g.add(coalBed);

  // Subtle top corner horns rising to H = 3C (Exod 27:2)
  const hornH = 0.28 * C;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 * C, hornH, 4),
        bronze,
      );
      horn.rotation.y = Math.PI / 4;
      horn.position.set(
        sx * (W * 0.5 - wallT * 0.5),
        H - 0.22 * C + hornH * 0.5,
        sz * (W * 0.5 - wallT * 0.5),
      );
      g.add(horn);
    }
  }

  // Four cast bronze rings at mid-height grate corners + two 7-cubit bronze carrying poles (Exod 27:4-7)
  addGoldRingsAndPoles(
    g,
    W * 0.5 - 0.35 * C,
    W * 0.5 + 0.14 * C,
    grateY,
    7.4 * C,
    0.16 * C,
    0.075 * C,
    bronze,
  );

  // Bronze pots, ash shovel & sprinkling basin resting beside the altar (Exod 27:3)
  const ashPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28 * C, 0.22 * C, 0.42 * C, 16),
    bronze,
  );
  ashPot.position.set(W * 0.66, 0.21 * C, 0.55 * C);
  g.add(ashPot);

  return g;
}

/**
 * Ten Bronze Wheeled Stands & Lavers (1 Kings 7:27-39):
 * 4 x 4 x 3 cubit wheeled chassis with carved lion/ox/cherub relief panels,
 * 1.5-cubit 6-spoked chariot wheels, corner undersetters, 4-cubit basin with rippling water.
 */
export function buildWheeledLaver(
  cubitM: number,
  variant: WheeledLaverVariant = 'single',
): THREE.Group {
  const C = cubitM;
  const { bronze, panel } = furnaceMaterials();
  const g = new THREE.Group();

  const makeOne = (idx: number): THREE.Group => {
    const unit = buildLaver(C, bronze, panel);
    // Water surface inside the 4-cubit basin (rim top sits around 3C + 0.85C + 1.15C = 5.0C)
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2c83a6,
      emissive: 0x0b394d,
      emissiveIntensity: 0.25,
      metalness: 0.35,
      roughness: 0.12,
      transparent: true,
      opacity: 0.86,
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.88 * C, 40), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 4.74 * C;
    water.userData.water = idx + 1;
    unit.add(water);
    return unit;
  };

  if (variant === 'five-row') {
    const spacing = 5.4 * C;
    for (let i = 0; i < 5; i++) {
      const stand = makeOne(i);
      stand.position.x = (i - 2) * spacing;
      g.add(stand);
    }
  } else {
    g.add(makeOne(0));
  }

  return g;
}
