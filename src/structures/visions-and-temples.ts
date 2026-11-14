import * as THREE from 'three';
import type {
  BilingualText,
  CompareItem,
  CountItem,
  Dim,
  VariantOption,
} from './specs.ts';
import { buildMenorah } from './menorah.ts';
import { buildIncenseAltar, buildShowbreadTable } from './furnishings.ts';

export type HerodSanctuaryVariant = 'facade' | 'cutaway';
export type SecondTempleVariant = 'cyrus-decree' | 'compare-solomon';
export type WildernessCampVariant = 'proportional' | 'compact';
export type EzekielWheelsVariant = 'full-vision' | 'wheel-detail';

export type VisionTempleKind =
  | 'herodSanctuary'
  | 'secondTemple'
  | 'wildernessCamp'
  | 'ezekielWheels';

export type VisionTempleWalk = 'herod' | 'tabernacle' | 'ezekiel';

export interface VisionTempleSpec {
  id: string;
  zh: string;
  en: string;
  ref: string;
  refZh: string;
  textZh: string;
  textEn: string;
  dims: Dim[];
  kind: VisionTempleKind;
  counts?: CountItem[];
  assumedHeight?: number;
  variants?: {
    key: string;
    zh: string;
    en: string;
    options: VariantOption[];
  };
  unstated: BilingualText[];
  punchZh: string;
  punchEn: string;
  compare: CompareItem[];
  unit?: { zh: string; en: string; m: number; note: string; noteEn: string };
  walk?: VisionTempleWalk;
}

interface VisionTempleTex {
  herodAshlar: THREE.CanvasTexture;
  goldPlate: THREE.CanvasTexture;
  cyrusStone: THREE.CanvasTexture;
  cedarTimber: THREE.CanvasTexture;
  veilTapestry: THREE.CanvasTexture;
  berylRim: THREE.CanvasTexture;
  stripeGate: THREE.CanvasTexture;
  compassE: THREE.CanvasTexture;
  compassS: THREE.CanvasTexture;
  compassW: THREE.CanvasTexture;
  compassN: THREE.CanvasTexture;
}

let cachedVisionTex: VisionTempleTex | null = null;

function shareTex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.userData.shared = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function makeCompassDiskTex(letter: 'N' | 'E' | 'S' | 'W', highlightEast: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = highlightEast ? '#3e2c14' : '#262019';
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = highlightEast ? '#f4ca59' : '#c89b4b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = highlightEast ? '#ffe082' : '#e6cfa0';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 67);
  const t = new THREE.CanvasTexture(c);
  t.userData.shared = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function getVisionTempleTex(): VisionTempleTex {
  if (cachedVisionTex) return cachedVisionTex;

  // 1. Snow-white Herodian drafted-margin limestone ashlar (Mark 13:1; War 5.222)
  const hc = document.createElement('canvas');
  hc.width = 256;
  hc.height = 256;
  const hx = hc.getContext('2d')!;
  hx.fillStyle = '#ddd6c7';
  hx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const off = (row % 2) * 32;
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + off;
      const tone = 238 + (((row * 7 + col * 11) & 7) - 3) * 2;
      // Recessed Herodian margin frame
      hx.fillStyle = `rgb(${tone - 14}, ${tone - 18}, ${tone - 26})`;
      hx.fillRect(x + 1, y + 1, 62, 30);
      // Raised smooth boss face
      hx.fillStyle = `rgb(${tone}, ${tone - 4}, ${tone - 11})`;
      hx.fillRect(x + 5, y + 4, 54, 24);
    }
  }
  const herodAshlar = shareTex(hc, 6, 6);

  // 2. Gleaming Herodian beaten gold facade cladding plates (War 5.208, 222)
  const gc = document.createElement('canvas');
  gc.width = 256;
  gc.height = 256;
  const gx = gc.getContext('2d')!;
  const gGrad = gx.createLinearGradient(0, 0, 256, 256);
  gGrad.addColorStop(0, '#f7d569');
  gGrad.addColorStop(0.5, '#e2b13c');
  gGrad.addColorStop(1, '#f5ce5b');
  gx.fillStyle = gGrad;
  gx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      gx.strokeStyle = 'rgba(130, 88, 16, 0.55)';
      gx.lineWidth = 3;
      gx.strokeRect(x + 4, y + 4, 56, 56);
      gx.strokeStyle = 'rgba(255, 243, 190, 0.5)';
      gx.lineWidth = 1.5;
      gx.strokeRect(x + 10, y + 10, 44, 44);
    }
  }
  const goldPlate = shareTex(gc, 4, 4);

  // 3. Heavy post-exilic dressed limestone rollers / gelal blocks (Ezra 5:8; 6:4)
  const zc = document.createElement('canvas');
  zc.width = 256;
  zc.height = 256;
  const zx = zc.getContext('2d')!;
  zx.fillStyle = '#bfb299';
  zx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 6; row++) {
    const y = row * 42;
    const off = (row % 2) * 42;
    for (let col = -1; col < 4; col++) {
      const x = col * 84 + off;
      const v = 198 + (((row * 5 + col * 9) & 15) - 7) * 2;
      zx.fillStyle = `rgb(${v}, ${v - 11}, ${v - 27})`;
      zx.fillRect(x + 2, y + 2, 80, 38);
      zx.strokeStyle = 'rgba(78, 66, 48, 0.45)';
      zx.lineWidth = 2;
      zx.strokeRect(x + 2, y + 2, 80, 38);
    }
  }
  const cyrusStone = shareTex(zc, 4, 2);

  // 4. New Lebanon cedar timber courses (Ezra 3:7; 6:4)
  const tc = document.createElement('canvas');
  tc.width = 256;
  tc.height = 256;
  const tx = tc.getContext('2d')!;
  tx.fillStyle = '#754423';
  tx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    tx.fillStyle = y % 64 === 0 ? '#87512c' : '#65391c';
    tx.fillRect(0, y, 256, 29);
    tx.fillStyle = '#3b200e';
    tx.fillRect(0, y + 29, 256, 3);
  }
  const cedarTimber = shareTex(tc, 4, 2);

  // 5. Temple Veil tapestry in blue, fine white linen, scarlet & purple (War 5.212; Matt 27:51)
  const vc = document.createElement('canvas');
  vc.width = 256;
  vc.height = 256;
  const vx = vc.getContext('2d')!;
  const veilCols = ['#1c4c8c', '#5b2269', '#a32229', '#efe7d6'];
  for (let x = 0; x < 256; x += 16) {
    vx.fillStyle = veilCols[(x >> 4) % veilCols.length] ?? '#1c4c8c';
    vx.fillRect(x, 0, 16, 256);
  }
  for (let y = 16; y < 256; y += 48) {
    vx.fillStyle = 'rgba(238, 196, 84, 0.42)';
    vx.fillRect(0, y, 256, 5);
  }
  const veilTapestry = shareTex(vc, 2, 2);

  // 6. Sea-beryl / chrysolite (tarshish) crystalline wheel band (Ezek 1:16; 10:9)
  const bc = document.createElement('canvas');
  bc.width = 256;
  bc.height = 128;
  const bx = bc.getContext('2d')!;
  const bGrad = bx.createLinearGradient(0, 0, 0, 128);
  bGrad.addColorStop(0, '#7ef0d4');
  bGrad.addColorStop(0.5, '#2fa88e');
  bGrad.addColorStop(1, '#7ef0d4');
  bx.fillStyle = bGrad;
  bx.fillRect(0, 0, 256, 128);
  for (let x = 16; x < 256; x += 32) {
    bx.strokeStyle = 'rgba(255, 232, 148, 0.65)';
    bx.lineWidth = 2;
    bx.beginPath();
    bx.ellipse(x, 64, 11, 7, 0, 0, Math.PI * 2);
    bx.stroke();
    bx.fillStyle = '#123d3a';
    bx.beginPath();
    bx.arc(x, 64, 3.5, 0, Math.PI * 2);
    bx.fill();
  }
  const berylRim = shareTex(bc, 6, 1);

  // 7. Tabernacle eastern gate striped screen (Exod 27:16)
  const sc = document.createElement('canvas');
  sc.width = 256;
  sc.height = 128;
  const sx = sc.getContext('2d')!;
  const gCols = ['#efe8d8', '#1e4e8d', '#5c246b', '#a32424'];
  for (let x = 0; x < 256; x += 16) {
    sx.fillStyle = gCols[(x >> 4) % gCols.length] ?? '#efe8d8';
    sx.fillRect(x, 0, 16, 128);
  }
  const stripeGate = shareTex(sc, 3, 1);

  const compassE = makeCompassDiskTex('E', true);
  const compassS = makeCompassDiskTex('S', false);
  const compassW = makeCompassDiskTex('W', false);
  const compassN = makeCompassDiskTex('N', false);

  cachedVisionTex = {
    herodAshlar,
    goldPlate,
    cyrusStone,
    cedarTimber,
    veilTapestry,
    berylRim,
    stripeGate,
    compassE,
    compassS,
    compassW,
    compassN,
  };
  return cachedVisionTex;
}

/**
 * 1. Herod's Temple Sanctuary (Beit HaMikdash — John 2:20; Mark 13:1;
 *    Mishnah Middot 4:6-7; Josephus Jewish War 5.207-224):
 *    100 x 100 x 100 cubit T-plan Sanctuary in snow-white limestone & gleaming gold plates,
 *    12 eastern steps, open 40 x 20 c Ulam portal crowned by the colossal Golden Vine,
 *    40 x 20 x 40 c Hekhal (Menorah, Showbread Table, Incense Altar), twin Veil,
 *    and strictly empty 20 x 20 x 40 c Most Holy Place with bare Even HaShetiyah bedrock.
 */
export function buildHerodSanctuary(
  C: number,
  variant: HerodSanctuaryVariant = 'facade',
): THREE.Group {
  const tex = getVisionTempleTex();
  const g = new THREE.Group();
  const cut = variant === 'cutaway';

  const whiteStone = new THREE.MeshStandardMaterial({
    color: 0xfbf7ee,
    map: tex.herodAshlar,
    roughness: 0.78,
    metalness: 0.04,
  });
  const podiumStone = new THREE.MeshStandardMaterial({
    color: 0xe6decb,
    map: tex.herodAshlar,
    roughness: 0.86,
  });
  const cutFaceMat = new THREE.MeshStandardMaterial({
    color: 0xc8bba2,
    roughness: 0.9,
  });
  const goldClad = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.goldPlate,
    metalness: 0.88,
    roughness: 0.2,
    emissive: 0x3b2906,
    emissiveIntensity: 0.1,
  });
  const brightGold = new THREE.MeshStandardMaterial({
    color: 0xf9d55b,
    metalness: 0.93,
    roughness: 0.16,
    emissive: 0x4a3308,
    emissiveIntensity: 0.14,
  });
  const cedar = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.cedarTimber,
    roughness: 0.78,
  });
  const veilMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.veilTapestry,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const rawBedrock = new THREE.MeshStandardMaterial({
    color: 0x9c9282,
    roughness: 0.97,
    metalness: 0.02,
  });

  // Forecourt pavement pad seated at y = 0 (min.y = 0)
  const apron = new THREE.Mesh(new THREE.BoxGeometry(126 * C, 0.25 * C, 110 * C), podiumStone);
  apron.position.set(7 * C, 0.125 * C, 0);
  g.add(apron);

  // Solid 6-cubit foundation podium (Atum, Middot 4:6) in T-plan:
  // East Ulam head: x in [28C, 50C] (22c deep), z in [-50C, +50C] (100c wide)
  // Rear Sanctuary body: x in [-50C, 28C] (78c deep), z in [-35C, +35C] (70c wide)
  const podiumH = 6 * C;
  if (!cut) {
    const ulamPodium = new THREE.Mesh(new THREE.BoxGeometry(22 * C, podiumH, 100 * C), podiumStone);
    ulamPodium.position.set(39 * C, podiumH * 0.5, 0);
    g.add(ulamPodium);
  } else {
    // Keep North + central portal podium (z in [-50C, +14C]) at full 6c; expose South T-shoulder plan at 1.4c
    const ulamPodiumMain = new THREE.Mesh(new THREE.BoxGeometry(22 * C, podiumH, 64 * C), podiumStone);
    ulamPodiumMain.position.set(39 * C, podiumH * 0.5, -18 * C);
    const ulamPodiumSouthFoot = new THREE.Mesh(
      new THREE.BoxGeometry(22 * C, 1.4 * C, 36 * C),
      cutFaceMat,
    );
    ulamPodiumSouthFoot.position.set(39 * C, 0.7 * C, 32 * C);
    g.add(ulamPodiumMain, ulamPodiumSouthFoot);
  }

  const rearPodium = new THREE.Mesh(new THREE.BoxGeometry(78 * C, podiumH, 70 * C), podiumStone);
  rearPodium.position.set(-11 * C, podiumH * 0.5, 0);
  g.add(rearPodium);

  // 12 Approach Steps on the East (Middot 3:6) ascending 0 -> 6C over x in [50C, 62C]
  const stepSpanZ = 34 * C;
  for (let i = 0; i < 12; i++) {
    const h = ((i + 1) / 12) * podiumH;
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.02 * C, h, stepSpanZ), whiteStone);
    step.position.set(61.5 * C - i * 1.0 * C, h * 0.5, 0);
    g.add(step);
  }
  for (const sz of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(12.5 * C, podiumH * 0.72, 1.8 * C), whiteStone);
    cheek.position.set(56 * C, podiumH * 0.36, sz * (stepSpanZ * 0.5 + 0.9 * C));
    g.add(cheek);
  }

  // Elevation constants above podium (y = 6C):
  // Lower Sanctuary story: y = 6C .. 46C (40c tall)
  // Middle cedar joist & ornamental ceiling zone: y = 46C .. 51C (5c)
  // Upper Chamber (Aliyah): y = 51C .. 91C (40c tall)
  // Upper roof & parapet: y = 91C .. 98C (7c), Golden bird spikes: y = 98C .. 100C (total = 100C!)
  const wallH = 90 * C; // y = 6C .. 96C main masonry massing
  const parapetH = 2 * C; // y = 96C .. 98C

  // --- Ulam East Facade & T-Plan Shoulders (x in [28C, 50C], z in [-50C, +50C]) ---
  // Portal opening is 20c wide (z in [-10C, +10C]) x 40c high (y in [6C, 46C]).
  // North Ulam wing (z in [-50C, -10C], width 40C): always full height
  const northUlamFront = new THREE.Mesh(new THREE.BoxGeometry(5 * C, wallH, 40 * C), whiteStone);
  northUlamFront.position.set(47.5 * C, podiumH + wallH * 0.5, -30 * C);
  const northShoulder = new THREE.Mesh(new THREE.BoxGeometry(17 * C, wallH, 15 * C), whiteStone);
  northShoulder.position.set(36.5 * C, podiumH + wallH * 0.5, -42.5 * C);
  const northUlamSide = new THREE.Mesh(new THREE.BoxGeometry(17 * C, wallH, 5 * C), whiteStone);
  northUlamSide.position.set(36.5 * C, podiumH + wallH * 0.5, -32.5 * C);
  g.add(northUlamFront, northShoulder, northUlamSide);

  // Over-portal Ulam facade lintel & upper wall (z in [-10C, +10C], y in [46C, 96C], height 50C)
  const overPortal = new THREE.Mesh(new THREE.BoxGeometry(5 * C, 50 * C, 20 * C), whiteStone);
  overPortal.position.set(47.5 * C, 46 * C + 25 * C, 0);
  g.add(overPortal);

  // South Ulam jamb & wing: full 40C wing in 'facade'; narrow 4C portal jamb in 'cutaway' so portal stays framed!
  if (!cut) {
    const southUlamFront = new THREE.Mesh(new THREE.BoxGeometry(5 * C, wallH, 40 * C), whiteStone);
    southUlamFront.position.set(47.5 * C, podiumH + wallH * 0.5, 30 * C);
    const southShoulder = new THREE.Mesh(new THREE.BoxGeometry(17 * C, wallH, 15 * C), whiteStone);
    southShoulder.position.set(36.5 * C, podiumH + wallH * 0.5, 42.5 * C);
    const southUlamSide = new THREE.Mesh(new THREE.BoxGeometry(17 * C, wallH, 5 * C), whiteStone);
    southUlamSide.position.set(36.5 * C, podiumH + wallH * 0.5, 32.5 * C);
    g.add(southUlamFront, southShoulder, southUlamSide);
  } else {
    const southJamb = new THREE.Mesh(new THREE.BoxGeometry(5 * C, wallH, 4 * C), whiteStone);
    southJamb.position.set(47.5 * C, podiumH + wallH * 0.5, 12 * C);
    g.add(southJamb);
  }

  // Gleaming Gold Facade Plates & 4 Towering Engaged Pilasters on the East Facade (War 5.208, 222)
  const pilasterZ = cut ? [-44 * C, -14 * C, 12 * C] : [-44 * C, -14 * C, 14 * C, 44 * C];
  pilasterZ.forEach((pz, idx) => {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(1.4 * C, wallH, 3.4 * C), goldClad);
    pil.position.set(50.3 * C, podiumH + wallH * 0.5, pz);
    pil.userData.shimmer = idx + 1;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2 * C, 3.2 * C, 4.6 * C), brightGold);
    cap.position.set(50.5 * C, podiumH + wallH - 1.6 * C, pz);
    g.add(pil, cap);
  });

  // Gilded coffered facade panels flanking the open portal + radiant upper golden tablet
  const goldPanelPositions = cut ? [-29 * C] : [-29 * C, 29 * C];
  goldPanelPositions.forEach((pz, idx) => {
    for (const py of [24 * C, 68 * C]) {
      const gp = new THREE.Mesh(new THREE.BoxGeometry(0.6 * C, 26 * C, 20 * C), goldClad);
      gp.position.set(50.15 * C, py, pz);
      gp.userData.shimmer = idx + 3;
      g.add(gp);
    }
  });
  const upperPortalGold = new THREE.Mesh(new THREE.BoxGeometry(0.7 * C, 28 * C, 18 * C), goldClad);
  upperPortalGold.position.set(50.2 * C, 72 * C, 0);
  upperPortalGold.userData.shimmer = 5;
  g.add(upperPortalGold);

  // 5 Carved Oak/Cedar Lintel Beams alternating with stone courses over the 40x20c Ulam portal (Middot 3:7)
  for (let b = 0; b < 5; b++) {
    const beamW = (22 + b * 2) * C;
    const beamZ = cut ? Math.min(beamW * 0.5, 14 * C) - beamW * 0.5 : 0;
    const actualW = cut ? beamW * 0.5 + 14 * C : beamW;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.1 * C, 1.05 * C, actualW), cedar);
    beam.position.set(50.25 * C, 46.8 * C + b * 2.1 * C, cut ? (14 * C - actualW * 0.5) : beamZ);
    g.add(beam);
  }

  // --- Colossal Golden Vine above the Inner Sanctuary Doorway inside the Ulam (Middot 3:8; War 5.210) ---
  // Hekhal East partition wall at x = 28C..34C with 20x10c golden inner gateway
  for (const sz of [-1, 1]) {
    const zSpan = cut && sz > 0 ? 9 * C : 20 * C;
    const zPos = cut && sz > 0 ? 9.5 * C : sz * 15 * C;
    const hekEastJamb = new THREE.Mesh(new THREE.BoxGeometry(6 * C, 40 * C, zSpan), goldClad);
    hekEastJamb.position.set(31 * C, 26 * C, zPos);
    g.add(hekEastJamb);
  }
  const hekEastOver = new THREE.Mesh(
    new THREE.BoxGeometry(6 * C, 20 * C, cut ? 24 * C : 30 * C),
    goldClad,
  );
  hekEastOver.position.set(31 * C, 36 * C, cut ? -3 * C : 0);
  g.add(hekEastOver);

  // Open folded golden inner doors (20c tall, 5c per leaf)
  for (const sz of [-1, 1]) {
    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(4.6 * C, 19.5 * C, 0.5 * C), brightGold);
    doorLeaf.position.set(33.5 * C, 15.8 * C, sz * 4.8 * C);
    doorLeaf.rotation.y = sz * 0.25;
    doorLeaf.userData.shimmer = sz > 0 ? 2 : 4;
    g.add(doorLeaf);
  }

  // Cedar support crossbeams & Colossal Golden Vine with hanging man-high grape clusters
  const vineBeam = new THREE.Mesh(new THREE.BoxGeometry(1.2 * C, 1.2 * C, 19 * C), cedar);
  vineBeam.position.set(36 * C, 41 * C, 0);
  g.add(vineBeam);

  const vineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(36.2 * C, 28 * C, -8.5 * C),
    new THREE.Vector3(36.5 * C, 39.5 * C, -5.5 * C),
    new THREE.Vector3(36.8 * C, 41.2 * C, 0),
    new THREE.Vector3(36.5 * C, 39.5 * C, 5.5 * C),
    new THREE.Vector3(36.2 * C, 28 * C, 8.5 * C),
  ]);
  const vineTrunk = new THREE.Mesh(
    new THREE.TubeGeometry(vineCurve, 32, 0.45 * C, 10, false),
    brightGold,
  );
  vineTrunk.userData.shimmer = 1;
  g.add(vineTrunk);

  const clusterZs = [-6.8, -4.2, -1.8, 0, 1.8, 4.2, 6.8];
  clusterZs.forEach((cz, idx) => {
    const cy = 38.8 * C - Math.abs(cz) * 0.55 * C;
    const clusterG = new THREE.Group();
    clusterG.position.set(36.9 * C, cy, cz * C);
    // Conical man-high golden grape cluster (~3.6 cubits tall, War 5.210)
    for (let ring = 0; ring < 5; ring++) {
      const rRing = (0.55 - ring * 0.09) * C;
      const count = Math.max(1, 6 - ring);
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + ring * 0.5;
        const grape = new THREE.Mesh(new THREE.SphereGeometry(0.28 * C, 8, 6), brightGold);
        grape.position.set(
          Math.cos(a) * rRing * 0.65,
          -ring * 0.62 * C,
          Math.sin(a) * rRing,
        );
        clusterG.add(grape);
      }
    }
    clusterG.userData.shimmer = (idx % 4) + 1;
    g.add(clusterG);
  });

  // --- Rear Sanctuary Body (x in [-50C, 28C], z in [-35C, +35C], height to 100C) ---
  // North Sanctuary outer wall + 3-story side chambers (always intact)
  const northOuter = new THREE.Mesh(new THREE.BoxGeometry(78 * C, wallH, 5 * C), whiteStone);
  northOuter.position.set(-11 * C, podiumH + wallH * 0.5, -32.5 * C);
  const westOuter = new THREE.Mesh(
    new THREE.BoxGeometry(6 * C, wallH, cut ? 49 * C : 70 * C),
    whiteStone,
  );
  westOuter.position.set(-47 * C, podiumH + wallH * 0.5, cut ? -10.5 * C : 0);
  g.add(northOuter, westOuter);

  // North inner sanctuary gilded wall (z = -10C.. -15C)
  const northInnerLower = new THREE.Mesh(new THREE.BoxGeometry(66 * C, 40 * C, 5 * C), goldClad);
  northInnerLower.position.set(-5 * C, 26 * C, -12.5 * C);
  const westInnerLower = new THREE.Mesh(new THREE.BoxGeometry(6 * C, 40 * C, 20 * C), goldClad);
  westInnerLower.position.set(-36 * C, 26 * C, 0);
  g.add(northInnerLower, westInnerLower);

  // Gilded Sanctuary floor (61C x 20C covering Hekhal + Veil + Most Holy Place)
  const sancFloor = new THREE.Mesh(new THREE.BoxGeometry(61 * C, 0.5 * C, 20 * C), goldClad);
  sancFloor.position.set(-2.5 * C, podiumH + 0.25 * C, 0);
  g.add(sancFloor);

  // --- 40 x 20 x 40 c Hekhal Furnishings (Menorah S, Showbread Table N, Incense Altar before Veil) ---
  const { group: menorahGroup } = buildMenorah(1.65, 'arch');
  menorahGroup.position.set(6 * C, podiumH + 0.5 * C, 5.2 * C);
  // 7 gentle olive-oil flames atop the Menorah
  const mUnit = 1.65 / 8.6;
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffdf80,
    emissive: 0xff8c1a,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const mXs = [0, -2.15 * mUnit, 2.15 * mUnit, -2.93 * mUnit, 2.93 * mUnit, -3.71 * mUnit, 3.71 * mUnit];
  mXs.forEach((fx, fi) => {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(mUnit * 0.12, mUnit * 0.45, 8), flameMat);
    fl.position.set(fx, mUnit * 7.85, 0);
    fl.userData.flame = fi + 1;
    menorahGroup.add(fl);
  });
  g.add(menorahGroup);

  const showbread = buildShowbreadTable(C, 'full');
  showbread.position.set(6 * C, podiumH + 0.5 * C, -5.2 * C);
  g.add(showbread);

  const incense = buildIncenseAltar(C, 'lit');
  incense.position.set(-7.5 * C, podiumH + 0.5 * C, 0);
  g.add(incense);

  // --- Twin Woven Veil (Amah Traksin: 1-cubit gap at x = -12C and x = -13C, Middot 4:7; Yoma 5:1) ---
  const veilWidth = cut ? 13.5 * C : 19.6 * C;
  const veilZ = cut ? -3.25 * C : 0;
  for (const vx of [-12 * C, -13 * C]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * C, 0.18 * C, 20 * C, 10), brightGold);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(vx, 45.6 * C, 0);
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(veilWidth, 39.2 * C), veilMat);
    curtain.rotation.y = Math.PI / 2;
    curtain.position.set(vx, 26 * C, veilZ);
    g.add(rod, curtain);
  }

  // --- STRICTLY EMPTY 20 x 20 x 40 c Most Holy Place (x in [-33C, -13C], z in [-10C, +10C]) ---
  // ZERO Ark, ZERO cherubim statues, ZERO divine/human silhouette (Josephus War 5.219)!
  // ONLY the bare rough-hewn Foundation Stone (Even HaShetiyah, Mishnah Yoma 5:2, 3 fingerbreadths high)
  const stoneGroup = new THREE.Group();
  stoneGroup.position.set(-23 * C, podiumH + 0.5 * C, 0);
  const baseSlab = new THREE.Mesh(new THREE.CylinderGeometry(2.8 * C, 3.3 * C, 0.34 * C, 7), rawBedrock);
  baseSlab.scale.set(1.25, 1, 0.92);
  baseSlab.position.y = 0.17 * C;
  const crestSlab = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * C, 2.3 * C, 0.22 * C, 6), rawBedrock);
  crestSlab.position.set(-0.3 * C, 0.32 * C, 0.2 * C);
  stoneGroup.add(baseSlab, crestSlab);
  g.add(stoneGroup);

  // --- Middle 5-cubit Cedar Beam Ceiling (y = 46C .. 51C) & 40-cubit Upper Chamber (y = 51C .. 91C) ---
  const midWidth = cut ? 49 * C : 70 * C;
  const midZ = cut ? -10.5 * C : 0;
  const midDeck = new THREE.Mesh(new THREE.BoxGeometry(84 * C, 5 * C, midWidth), cedar);
  midDeck.position.set(-8 * C, 48.5 * C, midZ);
  g.add(midDeck);

  // Upper Chamber North & West inner gilded-cedar lining
  const upperNorthInner = new THREE.Mesh(new THREE.BoxGeometry(66 * C, 40 * C, 4 * C), cedar);
  upperNorthInner.position.set(-5 * C, 71 * C, -12 * C);
  const upperWestInner = new THREE.Mesh(new THREE.BoxGeometry(5 * C, 40 * C, 20 * C), cedar);
  upperWestInner.position.set(-35.5 * C, 71 * C, 0);
  g.add(upperNorthInner, upperWestInner);

  if (!cut) {
    // Full enclosed South outer wall + exterior pilasters
    const southOuter = new THREE.Mesh(new THREE.BoxGeometry(78 * C, wallH, 5 * C), whiteStone);
    southOuter.position.set(-11 * C, podiumH + wallH * 0.5, 32.5 * C);
    g.add(southOuter);

    for (const sz of [-1, 1]) {
      for (let p = 0; p < 6; p++) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(2.6 * C, wallH, 1.1 * C), goldClad);
        pil.position.set(-42 * C + p * 13.5 * C, podiumH + wallH * 0.5, sz * 35.3 * C);
        g.add(pil);
      }
    }
  } else {
    // Cutaway mode: expose the 3-story South side chambers (Middot 4:3-4: 5c, 6c, 7c stepped widths)
    // along z in [10C, 32C] with visible cedar decks & stone partition ribs!
    const southInnerStub = new THREE.Mesh(new THREE.BoxGeometry(66 * C, 3.2 * C, 4 * C), cutFaceMat);
    southInnerStub.position.set(-5 * C, podiumH + 1.6 * C, 12 * C);
    g.add(southInnerStub);

    const storeyYs = [6 * C, 19 * C, 32 * C];
    storeyYs.forEach((sy, tier) => {
      const chW = (5 + tier) * C;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(66 * C, 0.9 * C, chW + 4 * C), cedar);
      deck.position.set(-5 * C, sy + 0.45 * C, 14 * C + chW * 0.5);
      g.add(deck);
      for (let cell = 0; cell <= 5; cell++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(1.1 * C, 12.2 * C, chW + 3.5 * C), whiteStone);
        rib.position.set(-35 * C + cell * 12 * C, sy + 6.5 * C, 14 * C + chW * 0.5);
        g.add(rib);
      }
    });
  }

  // --- Upper Roof Deck, 3-Cubit Parapet & Golden Scarecrow Spikes crowning at exact y = 100C (War 5.224) ---
  const roofRear = new THREE.Mesh(new THREE.BoxGeometry(78 * C, 5 * C, midWidth), whiteStone);
  roofRear.position.set(-11 * C, 93.5 * C, midZ);
  const roofUlamW = cut ? 64 * C : 100 * C;
  const roofUlamZ = cut ? -18 * C : 0;
  const roofUlam = new THREE.Mesh(new THREE.BoxGeometry(22 * C, 5 * C, roofUlamW), whiteStone);
  roofUlam.position.set(39 * C, 93.5 * C, roofUlamZ);
  g.add(roofRear, roofUlam);

  // Parapet cornice (y = 96C .. 98C) + Golden spikes (y = 98C .. 100C)
  const parapetFront = new THREE.Mesh(new THREE.BoxGeometry(2.2 * C, parapetH, roofUlamW), brightGold);
  parapetFront.position.set(49 * C, 97 * C, roofUlamZ);
  const parapetNorth = new THREE.Mesh(new THREE.BoxGeometry(78 * C, parapetH, 2.2 * C), brightGold);
  parapetNorth.position.set(-11 * C, 97 * C, -34 * C);
  g.add(parapetFront, parapetNorth);

  if (!cut) {
    const parapetSouth = parapetNorth.clone();
    parapetSouth.position.z = 34 * C;
    g.add(parapetSouth);
  }

  const spikeGeo = new THREE.ConeGeometry(0.28 * C, 2.0 * C, 6);
  const zMinSpike = -48;
  const zMaxSpike = cut ? 12 : 48;
  for (let sz = zMinSpike; sz <= zMaxSpike; sz += 6) {
    const sp = new THREE.Mesh(spikeGeo, brightGold);
    sp.position.set(49 * C, 99 * C, sz * C);
    g.add(sp);
  }
  for (let sx = -48; sx <= 26; sx += 8) {
    const spN = new THREE.Mesh(spikeGeo, brightGold);
    spN.position.set(sx * C, 99 * C, -34 * C);
    g.add(spN);
    if (!cut) {
      const spS = new THREE.Mesh(spikeGeo, brightGold);
      spS.position.set(sx * C, 99 * C, 34 * C);
      g.add(spS);
    }
  }

  return g;
}

/**
 * 2. Zerubbabel's Second Temple (Ezra 6:3-4; 3:2-3, 12; Haggai 2:3):
 *    60 cubits high x 60 cubits wide Cyrus royal decree volume, built with
 *    3 courses of great dressed stones (even gelal) + 1 top course of new cedar timber,
 *    with the Altar of Burnt Offering (Ezra 3:3) and 1.72m human scale figure.
 *    Variant 'compare-solomon' places a translucent golden ghost volume of Solomon's
 *    60 x 20 x 30 c Temple alongside to visualize Ezra 3:12 and Haggai 2:3.
 */
export function buildSecondTemple(
  C: number,
  variant: SecondTempleVariant = 'cyrus-decree',
): THREE.Group {
  const tex = getVisionTempleTex();
  const g = new THREE.Group();
  const compare = variant === 'compare-solomon';

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.cyrusStone,
    roughness: 0.88,
  });
  const foundationMat = new THREE.MeshStandardMaterial({
    color: 0xcbc0a8,
    map: tex.cyrusStone,
    roughness: 0.92,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.cedarTimber,
    roughness: 0.78,
  });
  const decreePostMat = new THREE.MeshStandardMaterial({
    color: 0xd4aa45,
    metalness: 0.72,
    roughness: 0.34,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xeb551c,
    emissive: 0xd83b08,
    emissiveIntensity: 0.75,
    roughness: 0.75,
  });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0xe6e1d6,
    transparent: true,
    opacity: 0.2,
    roughness: 0.95,
  });

  const zOff = compare ? -24 * C : 0;

  // Shared Temple Mount limestone bedrock terrace seated at y = 0
  const terraceW = compare ? 114 * C : 76 * C;
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(108 * C, 0.5 * C, terraceW), foundationMat);
  terrace.position.set(10 * C, 0.25 * C, compare ? -4 * C : 0);
  g.add(terrace);

  // --- Zerubbabel's Temple & 60 x 60 c Cyrus Decree Volume (Ezra 6:3-4) ---
  const zGroup = new THREE.Group();
  zGroup.position.z = zOff;
  g.add(zGroup);

  // Exact 60c high x 60c wide x 60c deep Cyrus Decree Royal Envelope (y = 0 .. 60C)
  const decreeGeo = new THREE.BoxGeometry(60 * C, 60 * C, 60 * C);
  const decreeWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(decreeGeo),
    new THREE.LineBasicMaterial({ color: 0xf0c95e, transparent: true, opacity: 0.78 }),
  );
  decreeWire.position.set(0, 30 * C, 0);
  zGroup.add(decreeWire);

  // 4 slender bronze-capped survey corner markers rising to the 60c royal ceiling
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32 * C, 0.38 * C, 60 * C, 8),
        decreePostMat,
      );
      post.position.set(sx * 30 * C, 30 * C, sz * 30 * C);
      zGroup.add(post);
    }
  }

  // THREE COURSES OF GREAT DRESSED STONES + ONE TOP COURSE OF NEW TIMBER (Ezra 6:4; 5:8):
  // Built across the 60c decree breadth (outer court/side-storehouse podium + sanctuary house)
  // Course 1 of Great Stones (y = 0.5C .. 10.5C): 60c wide x 60c long megalithic podium & side wings
  const stoneCourse1 = new THREE.Mesh(new THREE.BoxGeometry(60 * C, 10 * C, 60 * C), foundationMat);
  stoneCourse1.position.set(0, 5.5 * C, 0);
  zGroup.add(stoneCourse1);

  // Course 2 of Great Stones (y = 10.5C .. 20.5C): stepped side-chamber massing (58c x 46c) + 60c east pylon wall
  const stoneCourse2Body = new THREE.Mesh(new THREE.BoxGeometry(58 * C, 10 * C, 44 * C), stoneMat);
  stoneCourse2Body.position.set(0, 15.5 * C, 0);
  const stoneCourse2Facade = new THREE.Mesh(new THREE.BoxGeometry(8 * C, 10 * C, 58 * C), stoneMat);
  stoneCourse2Facade.position.set(25 * C, 15.5 * C, 0);
  zGroup.add(stoneCourse2Body, stoneCourse2Facade);

  // Course 3 of Great Stones (y = 20.5C .. 30.5C): Sanctuary main hall & eastern facade (56c x 30c, 54c pylon)
  const stoneCourse3Body = new THREE.Mesh(new THREE.BoxGeometry(56 * C, 10 * C, 30 * C), stoneMat);
  stoneCourse3Body.position.set(-1 * C, 25.5 * C, 0);
  const stoneCourse3Facade = new THREE.Mesh(new THREE.BoxGeometry(8 * C, 10 * C, 52 * C), stoneMat);
  stoneCourse3Facade.position.set(25 * C, 25.5 * C, 0);
  zGroup.add(stoneCourse3Body, stoneCourse3Facade);

  // Subtle horizontal recessed mortar seams emphasizing the 3 megalithic stone tiers
  for (const seamY of [10.5 * C, 20.5 * C, 30.5 * C]) {
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(59 * C, 0.55 * C, seamY < 15 * C ? 59 * C : 53 * C),
      timberMat,
    );
    ledge.position.set(0, seamY, 0);
    zGroup.add(ledge);
  }

  // Course 4 — ONE TOP COURSE OF NEW LEBANON CEDAR TIMBER (Ezra 6:4; 3:7, y = 30.5C .. 39.5C):
  const timberCourseBody = new THREE.Mesh(new THREE.BoxGeometry(56 * C, 8.5 * C, 29 * C), timberMat);
  timberCourseBody.position.set(-1 * C, 35 * C, 0);
  const timberCourseFacade = new THREE.Mesh(new THREE.BoxGeometry(8.2 * C, 9 * C, 50 * C), timberMat);
  timberCourseFacade.position.set(25 * C, 35.2 * C, 0);
  zGroup.add(timberCourseBody, timberCourseFacade);

  // Projecting cedar rafter ends & austere timber-framed eastern sanctuary portal (zero gold plates, zero bronze pillars)
  for (let i = -5; i <= 5; i++) {
    const rafter = new THREE.Mesh(new THREE.BoxGeometry(1.4 * C, 0.9 * C, 0.9 * C), timberMat);
    rafter.position.set(29.5 * C, 39.2 * C, i * 4.2 * C);
    zGroup.add(rafter);
  }
  const portalRecess = new THREE.Mesh(
    new THREE.BoxGeometry(1.6 * C, 20 * C, 11 * C),
    new THREE.MeshStandardMaterial({ color: 0x29180d, roughness: 0.92 }),
  );
  portalRecess.position.set(29.1 * C, 20.5 * C, 0);
  const portalFrameTop = new THREE.Mesh(new THREE.BoxGeometry(2.2 * C, 1.8 * C, 14 * C), timberMat);
  portalFrameTop.position.set(29.2 * C, 31.2 * C, 0);
  zGroup.add(portalRecess, portalFrameTop);

  // Eastern approach steps ascending 0.5C -> 10.5C up the first stone course
  for (let s = 0; s < 8; s++) {
    const sh = ((s + 1) / 8) * 10 * C;
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.25 * C, sh, 16 * C), stoneMat);
    st.position.set(39.5 * C - s * 1.2 * C, 0.5 * C + sh * 0.5, 0);
    zGroup.add(st);
  }

  // Altar of Burnt Offering rebuilt first on its ancient bases (Ezra 3:2-3)
  const altarX = 49 * C;
  const altarBody = new THREE.Mesh(new THREE.BoxGeometry(12 * C, 6 * C, 12 * C), stoneMat);
  altarBody.position.set(altarX, 3.5 * C, 0);
  zGroup.add(altarBody);
  for (const hx of [-1, 1]) {
    for (const hz of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(1.2 * C, 1.4 * C, 1.2 * C), stoneMat);
      horn.position.set(altarX + hx * 5.4 * C, 7.2 * C, hz * 5.4 * C);
      zGroup.add(horn);
    }
  }
  // Southern altar ramp (Exod 20:26)
  for (let r = 0; r < 6; r++) {
    const rh = ((r + 1) / 6) * 5.6 * C;
    const rSeg = new THREE.Mesh(new THREE.BoxGeometry(4.2 * C, rh, 1.6 * C), stoneMat);
    rSeg.position.set(altarX, 0.5 * C + rh * 0.5, 14.8 * C - r * 1.5 * C);
    zGroup.add(rSeg);
  }
  const hearth = new THREE.Mesh(new THREE.BoxGeometry(8 * C, 0.45 * C, 8 * C), emberMat);
  hearth.position.set(altarX, 6.65 * C, 0);
  hearth.userData.ember = 1;
  zGroup.add(hearth);

  for (let sm = 0; sm < 4; sm++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry((1.2 + sm * 0.45) * C, 10, 8), smokeMat.clone());
    const baseY = 7.8 * C + sm * 2.2 * C;
    puff.position.set(altarX, baseY, 0);
    puff.userData.smoke = { index: sm, baseY, amplitude: 2.2 * C };
    zGroup.add(puff);
  }

  // --- Variant 'compare-solomon': Translucent Golden Ghost of Solomon's 60 x 20 x 30 c Temple (Ezra 3:12; Hag 2:3) ---
  if (compare) {
    const sGroup = new THREE.Group();
    sGroup.position.z = 26 * C;
    g.add(sGroup);

    const ghostGold = new THREE.MeshStandardMaterial({
      color: 0xffd863,
      emissive: 0xb88014,
      emissiveIntensity: 0.45,
      metalness: 0.65,
      roughness: 0.2,
      transparent: true,
      opacity: 0.34,
    });
    const ghostDebir = new THREE.MeshStandardMaterial({
      color: 0xffe88c,
      emissive: 0xd99b1e,
      emissiveIntensity: 0.62,
      metalness: 0.8,
      roughness: 0.16,
      transparent: true,
      opacity: 0.48,
    });
    const ghostLine = new THREE.LineBasicMaterial({
      color: 0xffe484,
      transparent: true,
      opacity: 0.88,
    });

    const podH = 3 * C;
    const sPodium = new THREE.Mesh(new THREE.BoxGeometry(74 * C, podH, 34 * C), ghostGold);
    sPodium.position.set(5 * C, 0.5 * C + podH * 0.5, 0);
    sGroup.add(sPodium);

    // 60 x 20 x 30 c Main Sanctuary + 10 x 20 x 30 c East Porch (1 Kgs 6:2-3)
    const houseGeo = new THREE.BoxGeometry(60 * C, 30 * C, 20 * C);
    const houseMesh = new THREE.Mesh(houseGeo, ghostGold);
    houseMesh.position.set(0, 0.5 * C + podH + 15 * C, 0);
    houseMesh.userData.shimmer = 1;
    const houseEdges = new THREE.LineSegments(new THREE.EdgesGeometry(houseGeo), ghostLine);
    houseEdges.position.copy(houseMesh.position);
    sGroup.add(houseMesh, houseEdges);

    const porchGeo = new THREE.BoxGeometry(10 * C, 30 * C, 20 * C);
    const porchMesh = new THREE.Mesh(porchGeo, ghostGold);
    porchMesh.position.set(35 * C, 0.5 * C + podH + 15 * C, 0);
    const porchEdges = new THREE.LineSegments(new THREE.EdgesGeometry(porchGeo), ghostLine);
    porchEdges.position.copy(porchMesh.position);
    sGroup.add(porchMesh, porchEdges);

    // 20 x 20 x 20 c inner pure-gold Debir cube (1 Kgs 6:20)
    const debirGeo = new THREE.BoxGeometry(19.6 * C, 19.8 * C, 19.6 * C);
    const debirMesh = new THREE.Mesh(debirGeo, ghostDebir);
    debirMesh.position.set(-20 * C, 0.5 * C + podH + 10 * C, 0);
    debirMesh.userData.shimmer = 2;
    sGroup.add(debirMesh);

    // 3-tier side chambers along North & South (5/6/7c)
    for (let t = 0; t < 3; t++) {
      const cw = (5 + t) * C;
      for (const sz of [-1, 1]) {
        const ch = new THREE.Mesh(new THREE.BoxGeometry(60 * C, 5 * C, cw), ghostGold);
        ch.position.set(0, 0.5 * C + podH + t * 5.2 * C + 2.5 * C, sz * (10 * C + cw * 0.5));
        sGroup.add(ch);
      }
    }

    // Twin ghost pillars Jachin & Boaz (18 + 5 = 23c high, missing in Zerubbabel's Temple!)
    for (const sz of [-1, 1]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(1.9 * C, 2.0 * C, 23 * C, 16),
        ghostDebir,
      );
      col.position.set(38.5 * C, 0.5 * C + podH + 11.5 * C, sz * 6.5 * C);
      sGroup.add(col);
    }
  }

  return g;
}

/**
 * 3. Israel's 12-Tribe Wilderness Encampment (Numbers 2:1-34; 3:14-39; Exodus 27:18):
 *    Central 100 x 50 c Tabernacle Court + strictly aniconic Pillar of Cloud/Fire radiance,
 *    inner ring of 4 Levite divisions (Moses/Aaron E, Kohath S, Gershon W, Merari N),
 *    and 4 outer 3-tribe standard camps sized STRICTLY PROPORTIONAL to census counts:
 *    Judah E (186,400), Dan N (157,600), Reuben S (151,450), Ephraim W (108,100),
 *    on a directional N / E / S / W desert compass plinth.
 */
export function buildWildernessCamp(
  C: number,
  variant: WildernessCampVariant = 'proportional',
): THREE.Group {
  const tex = getVisionTempleTex();
  const g = new THREE.Group();
  const compact = variant === 'compact';

  const desertSand = new THREE.MeshStandardMaterial({ color: 0xcab388, roughness: 0.95 });
  const desertRim = new THREE.MeshStandardMaterial({ color: 0x9e845b, roughness: 0.9 });
  const compassBronze = new THREE.MeshStandardMaterial({
    color: 0xc79544,
    metalness: 0.78,
    roughness: 0.3,
  });
  const linenMat = new THREE.MeshStandardMaterial({
    color: 0xf4ede0,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.stripeGate,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  const goatTentMat = new THREE.MeshStandardMaterial({ color: 0x42352c, roughness: 0.92 });
  const leviteTentMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb2, roughness: 0.86 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xebb944, metalness: 0.88, roughness: 0.22 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb5753d, metalness: 0.72, roughness: 0.35 });

  // Camp layout radii in cubits:
  // Central Tabernacle Court: 100c (E-W along X) x 50c (N-S along Z), x in [-50C, +50C], z in [-25C, +25C]
  // Uniform camp depth D_camp = 52C, tangential width W_tribe = (census / 1000) * 0.96 * C
  // -> Every single tribe's parcel footprint area = D_camp * W_tribe is 100% proportional to census!
  const campDepth = 52 * C;
  const widthPerThousand = 0.96 * C;
  const innerCampX = (compact ? 94 : 138) * C;
  const innerCampZ = (compact ? 84 : 126) * C;
  const outerPlinthHalfX = innerCampX + campDepth + 24 * C;
  const outerPlinthHalfZ = innerCampZ + campDepth + 24 * C;
  const plinthH = 0.8 * C;

  // Desert base plinth seated at y = 0 (min.y = 0)
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(outerPlinthHalfX * 2, plinthH, outerPlinthHalfZ * 2),
    desertSand,
  );
  plinth.position.y = plinthH * 0.5;
  const plinthFrame = new THREE.Mesh(
    new THREE.BoxGeometry(outerPlinthHalfX * 2 + 2.4 * C, plinthH * 0.75, outerPlinthHalfZ * 2 + 2.4 * C),
    desertRim,
  );
  plinthFrame.position.y = plinthH * 0.375;
  g.add(plinth, plinthFrame);

  // Inlaid bronze N-S & E-W cardinal compass lines + E/S/W/N directional medallions
  const axisEW = new THREE.Mesh(
    new THREE.BoxGeometry(outerPlinthHalfX * 1.92, 0.12 * C, 0.8 * C),
    compassBronze,
  );
  axisEW.position.y = plinthH + 0.06 * C;
  const axisNS = new THREE.Mesh(
    new THREE.BoxGeometry(0.8 * C, 0.12 * C, outerPlinthHalfZ * 1.92),
    compassBronze,
  );
  axisNS.position.y = plinthH + 0.06 * C;
  g.add(axisEW, axisNS);

  const compassDefs: Array<{ x: number; z: number; map: THREE.CanvasTexture }> = [
    { x: outerPlinthHalfX - 9 * C, z: 0, map: tex.compassE },
    { x: 0, z: outerPlinthHalfZ - 9 * C, map: tex.compassS },
    { x: -(outerPlinthHalfX - 9 * C), z: 0, map: tex.compassW },
    { x: 0, z: -(outerPlinthHalfZ - 9 * C), map: tex.compassN },
  ];
  for (const cd of compassDefs) {
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5 * C, 6.8 * C, 0.35 * C, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: cd.map, roughness: 0.45, metalness: 0.3 }),
    );
    disk.rotation.y = -Math.PI / 2;
    disk.position.set(cd.x, plinthH + 0.18 * C, cd.z);
    g.add(disk);
  }

  // --- Central 100 x 50 c Tabernacle Court (Exod 27:18) ---
  const y0 = plinthH;
  const courtL = 100 * C;
  const courtW = 50 * C;
  const fenceH = 5 * C;

  const sacredPad = new THREE.Mesh(
    new THREE.BoxGeometry(courtL + 4 * C, 0.22 * C, courtW + 4 * C),
    new THREE.MeshStandardMaterial({ color: 0xdccaa4, roughness: 0.9 }),
  );
  sacredPad.position.set(0, y0 + 0.11 * C, 0);
  g.add(sacredPad);

  // North, South, West linen curtains + East 15c wings & 20c woven gate screen
  for (const sz of [-1, 1]) {
    const nsWall = new THREE.Mesh(new THREE.PlaneGeometry(courtL, fenceH), linenMat);
    nsWall.position.set(0, y0 + fenceH * 0.5 + 0.2 * C, sz * courtW * 0.5);
    g.add(nsWall);

    const eWing = new THREE.Mesh(new THREE.PlaneGeometry(15 * C, fenceH), linenMat);
    eWing.rotation.y = Math.PI / 2;
    eWing.position.set(courtL * 0.5, y0 + fenceH * 0.5 + 0.2 * C, sz * 17.5 * C);
    g.add(eWing);
  }
  const wWall = new THREE.Mesh(new THREE.PlaneGeometry(courtW, fenceH), linenMat);
  wWall.rotation.y = Math.PI / 2;
  wWall.position.set(-courtL * 0.5, y0 + fenceH * 0.5 + 0.2 * C, 0);
  const eGate = new THREE.Mesh(new THREE.PlaneGeometry(20 * C, fenceH), gateMat);
  eGate.rotation.y = Math.PI / 2;
  eGate.position.set(courtL * 0.5 + 0.08 * C, y0 + fenceH * 0.5 + 0.2 * C, 0);
  g.add(wWall, eGate);

  // Court perimeter posts (every 5c)
  const postGeo = new THREE.CylinderGeometry(0.22 * C, 0.25 * C, fenceH, 6);
  for (let i = 0; i <= 20; i++) {
    const px = -courtL * 0.5 + i * 5 * C;
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(postGeo, bronzeMat);
      p.position.set(px, y0 + fenceH * 0.5 + 0.2 * C, sz * courtW * 0.5);
      g.add(p);
    }
  }

  // 5 x 5 x 3 c Bronze Altar, Bronze Laver & 30 x 10 x 10 c Tabernacle Tent
  const bAltar = new THREE.Mesh(new THREE.BoxGeometry(5 * C, 3 * C, 5 * C), bronzeMat);
  bAltar.position.set(24 * C, y0 + 1.6 * C, 0);
  const altarGlow = new THREE.Mesh(
    new THREE.BoxGeometry(3.4 * C, 0.3 * C, 3.4 * C),
    new THREE.MeshStandardMaterial({ color: 0xff6e24, emissive: 0xe64500, emissiveIntensity: 0.9 }),
  );
  altarGlow.position.set(24 * C, y0 + 3.2 * C, 0);
  altarGlow.userData.ember = 2;
  const bLaver = new THREE.Mesh(new THREE.CylinderGeometry(2.1 * C, 1.4 * C, 2.4 * C, 12), bronzeMat);
  bLaver.position.set(11 * C, y0 + 1.3 * C, 0);
  const tentCore = new THREE.Mesh(new THREE.BoxGeometry(30 * C, 10 * C, 10 * C), goldMat);
  tentCore.position.set(-20 * C, y0 + 5.2 * C, 0);
  const tentCover = new THREE.Mesh(
    new THREE.BoxGeometry(31.2 * C, 3.2 * C, 11.4 * C),
    new THREE.MeshStandardMaterial({ color: 0x7d2323, roughness: 0.86 }),
  );
  tentCover.position.set(-20 * C, y0 + 9.2 * C, 0);
  g.add(bAltar, altarGlow, bLaver, tentCore, tentCover);

  // STRICTLY ANICONIC Pillar of Cloud & Warm Fire Radiance above the Tabernacle (Exod 40:38; Num 9:15-16)
  const fireColumnMat = new THREE.MeshStandardMaterial({
    color: 0xffd269,
    emissive: 0xff8c1a,
    emissiveIntensity: 1.15,
    transparent: true,
    opacity: 0.62,
    roughness: 0.25,
  });
  const fireCore = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6 * C, 4.2 * C, 28 * C, 16),
    fireColumnMat,
  );
  fireCore.position.set(-27 * C, y0 + 24 * C, 0);
  fireCore.userData.ember = 1;
  g.add(fireCore);

  const cloudBaseMat = new THREE.MeshStandardMaterial({
    color: 0xfaf3e3,
    emissive: 0x7d5820,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.24,
    roughness: 0.9,
  });
  for (let cl = 0; cl < 7; cl++) {
    const cMat = cloudBaseMat.clone();
    const rCloud = (4.8 + cl * 1.15) * C;
    const billow = new THREE.Mesh(new THREE.SphereGeometry(rCloud, 14, 10), cMat);
    const baseY = y0 + (13 + cl * 4.5) * C;
    billow.position.set(-27 * C, baseY, 0);
    billow.userData.smoke = { index: cl, baseY, amplitude: 2.0 * C };
    g.add(billow);
  }

  // --- Inner Ring: 4 Levite Divisions around the Tabernacle (Num 1:53; 3:21-38) ---
  const leviteTentGeo = new THREE.ConeGeometry(2.4 * C, 3.2 * C, 4);
  const placeLeviteDivision = (
    cx: number,
    cz: number,
    alongZ: boolean,
    count: number,
  ) => {
    const spacing = 6.2 * C;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) * 0.5) * spacing;
      const t = new THREE.Mesh(leviteTentGeo, leviteTentMat);
      t.rotation.y = Math.PI * 0.25;
      t.position.set(
        cx + (alongZ ? 0 : off),
        y0 + 1.6 * C,
        cz + (alongZ ? off : 0),
      );
      g.add(t);
    }
  };
  const levX = (compact ? 68 : 84) * C;
  const levZ = (compact ? 46 : 60) * C;
  placeLeviteDivision(levX, 0, true, 4); // East: Moses, Aaron & Priests (Num 3:38)
  placeLeviteDivision(0, levZ, false, 9); // South: Kohathites (8,600, Num 3:28-29)
  placeLeviteDivision(-levX, 0, true, 8); // West: Gershonites (7,500, Num 3:22-23)
  placeLeviteDivision(0, -levZ, false, 7); // North: Merarites (6,200, Num 3:34-35)

  // --- Outer Ring: 4 Three-Tribe Standard Camps, Strictly Proportional to Census Counts (Numbers 2) ---
  interface TribeDef {
    census: number;
    isLead: boolean;
  }
  interface CampQuarter {
    dir: 'E' | 'S' | 'W' | 'N';
    bannerColor: number;
    padColor: number;
    tribes: [TribeDef, TribeDef, TribeDef];
  }

  const quarters: CampQuarter[] = [
    {
      // East (Num 2:3-9): Total = 186,400 (Issachar 54,400 | Judah 74,600 | Zebulun 57,400)
      dir: 'E',
      bannerColor: 0xa82428,
      padColor: 0xb89668,
      tribes: [
        { census: 54400, isLead: false },
        { census: 74600, isLead: true },
        { census: 57400, isLead: false },
      ],
    },
    {
      // South (Num 2:10-16): Total = 151,450 (Gad 45,650 | Reuben 46,500 | Simeon 59,300)
      dir: 'S',
      bannerColor: 0xc45c26,
      padColor: 0xb59164,
      tribes: [
        { census: 45650, isLead: false },
        { census: 46500, isLead: true },
        { census: 59300, isLead: false },
      ],
    },
    {
      // West (Num 2:18-24): Total = 108,100 (Manasseh 32,200 | Ephraim 40,500 | Benjamin 35,400)
      dir: 'W',
      bannerColor: 0x224c8c,
      padColor: 0xad8d64,
      tribes: [
        { census: 32200, isLead: false },
        { census: 40500, isLead: true },
        { census: 35400, isLead: false },
      ],
    },
    {
      // North (Num 2:25-31): Total = 157,600 (Asher 41,500 | Dan 62,700 | Naphtali 53,400)
      dir: 'N',
      bannerColor: 0x1f6e5c,
      padColor: 0xb39368,
      tribes: [
        { census: 41500, isLead: false },
        { census: 62700, isLead: true },
        { census: 53400, isLead: false },
      ],
    },
  ];

  const tribeGap = 3.2 * C;
  const tentGeo = new THREE.ConeGeometry(2.3 * C, 2.7 * C, 4);

  for (const q of quarters) {
    const widths = q.tribes.map((tr) => (tr.census / 1000) * widthPerThousand);
    const totalSpan = widths[0]! + widths[1]! + widths[2]! + tribeGap * 2;
    let cursor = -totalSpan * 0.5;

    const bannerMat = new THREE.MeshStandardMaterial({
      color: q.bannerColor,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const padMat = new THREE.MeshStandardMaterial({
      color: q.padColor,
      roughness: 0.92,
    });

    q.tribes.forEach((tr, ti) => {
      const w = widths[ti]!;
      const tangCenter = cursor + w * 0.5;
      cursor += w + tribeGap;

      const alongZ = q.dir === 'E' || q.dir === 'W';
      const sign = q.dir === 'E' || q.dir === 'S' ? 1 : -1;
      const radialCenter = (alongZ ? innerCampX : innerCampZ) + campDepth * 0.5;

      const cx = alongZ ? sign * radialCenter : tangCenter;
      const cz = alongZ ? tangCenter : sign * radialCenter;
      const sizeX = alongZ ? campDepth : w;
      const sizeZ = alongZ ? w : campDepth;

      // Grounded tribal parcel mat strictly proportional in area to census count
      const parcel = new THREE.Mesh(new THREE.BoxGeometry(sizeX, 0.36 * C, sizeZ), padMat);
      parcel.position.set(cx, y0 + 0.18 * C, cz);
      const parcelBorder = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(sizeX, 0.4 * C, sizeZ)),
        new THREE.LineBasicMaterial({
          color: tr.isLead ? 0xf5ce62 : 0x7d6542,
          transparent: true,
          opacity: 0.75,
        }),
      );
      parcelBorder.position.copy(parcel.position);
      g.add(parcel, parcelBorder);

      // Proportional tent grid inside the tribal parcel (~1 tent mesh per 3,000 census soldiers)
      const targetTents = Math.max(8, Math.round(tr.census / 3000));
      const cols = Math.max(3, Math.round(Math.sqrt((targetTents * sizeX) / sizeZ)));
      const rows = Math.max(3, Math.round(targetTents / cols));
      let placed = 0;
      for (let r = 0; r < rows && placed < targetTents; r++) {
        for (let c = 0; c < cols && placed < targetTents; c++) {
          const txPos = cx + ((c + 0.5) / cols - 0.5) * (sizeX - 6 * C);
          const tzPos = cz + ((r + 0.5) / rows - 0.5) * (sizeZ - 6 * C);
          const tent = new THREE.Mesh(tentGeo, goatTentMat);
          tent.rotation.y = Math.PI * 0.25;
          tent.position.set(txPos, y0 + 1.55 * C, tzPos);
          g.add(tent);
          placed++;
        }
      }

      // Standard Banner (Degel for the 4 lead tribes, smaller Ensign Ot for the 8 companion tribes — Num 2:2)
      const poleH = (tr.isLead ? 22 : 13) * C;
      const innerEdgeR = (alongZ ? innerCampX : innerCampZ) + 2.5 * C;
      const bx = alongZ ? sign * innerEdgeR : tangCenter;
      const bz = alongZ ? tangCenter : sign * innerEdgeR;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24 * C, 0.3 * C, poleH, 8),
        tr.isLead ? goldMat : bronzeMat,
      );
      pole.position.set(bx, y0 + poleH * 0.5, bz);
      const finial = new THREE.Mesh(
        new THREE.OctahedronGeometry((tr.isLead ? 1.1 : 0.7) * C, 0),
        goldMat,
      );
      finial.position.set(bx, y0 + poleH + 0.8 * C, bz);
      const flagW = (tr.isLead ? 9.5 : 5.8) * C;
      const flagH = (tr.isLead ? 5.6 : 3.4) * C;
      const flag = new THREE.Mesh(new THREE.BoxGeometry(flagW, flagH, 0.22 * C), bannerMat);
      flag.position.set(bx + flagW * 0.48, y0 + poleH - flagH * 0.55, bz);
      g.add(pole, finial, flag);
    });
  }

  return g;
}

/**
 * Builds one orthogonal Beryl/Chrysolite Wheel-Within-a-Wheel (Ophan — Ezek 1:15-18; 10:9-13):
 * Two intersecting 90-degree vertical rings (E-W and N-S) enabling movement in any of the
 * four cardinal directions without turning, studded all around both rims with crystalline eyes.
 */
function buildSingleOphanWheel(
  radius: number,
  berylMat: THREE.Material,
  goldMat: THREE.Material,
  irisMat: THREE.Material,
  pupilMat: THREE.Material,
  seedOffset = 0,
): THREE.Group {
  const wg = new THREE.Group();
  const rimTube = radius * 0.085;

  // Ring A (XY plane — rolls East-West) & Ring B (ZY plane — rolls North-South, slightly nested so 90° poles interlock cleanly)
  const rings: Array<{ rotY: number; r: number }> = [
    { rotY: 0, r: radius },
    { rotY: Math.PI / 2, r: radius * 0.965 },
  ];

  rings.forEach(({ rotY, r }, rIdx) => {
    const rg = new THREE.Group();
    rg.rotation.y = rotY;

    // Main translucent beryl rim + twin burnished-gold outer/inner edge moldings
    const mainRim = new THREE.Mesh(new THREE.TorusGeometry(r, rimTube, 16, 64), berylMat);
    const outerFlange = new THREE.Mesh(
      new THREE.TorusGeometry(r + rimTube * 0.78, rimTube * 0.22, 10, 64),
      goldMat,
    );
    const innerFlange = new THREE.Mesh(
      new THREE.TorusGeometry(r - rimTube * 0.78, rimTube * 0.22, 10, 64),
      goldMat,
    );
    rg.add(mainRim, outerFlange, innerFlange);

    // 8 radial electrum-gold spokes
    for (let sp = 0; sp < 8; sp++) {
      const ang = (sp / 8) * Math.PI * 2;
      const spokeLen = (r - rimTube) * 2;
      if (sp < 4) {
        const spoke = new THREE.Mesh(
          new THREE.CylinderGeometry(rimTube * 0.2, rimTube * 0.2, spokeLen, 8),
          goldMat,
        );
        spoke.rotation.z = ang;
        rg.add(spoke);
      }
    }

    // 24 Crystalline Eye Bosses studded all around the rim (Ezek 1:18; 10:12)
    const eyeCount = 24;
    const bezelGeo = new THREE.TorusGeometry(rimTube * 0.46, rimTube * 0.11, 8, 14);
    const irisGeo = new THREE.OctahedronGeometry(rimTube * 0.36, 1);
    const pupilGeo = new THREE.SphereGeometry(rimTube * 0.18, 8, 6);

    for (let i = 0; i < eyeCount; i++) {
      const a = ((i + 0.5) / eyeCount) * Math.PI * 2;
      const ex = Math.cos(a) * r;
      const ey = Math.sin(a) * r;
      for (const sideZ of [-1, 1]) {
        const eyeG = new THREE.Group();
        eyeG.position.set(ex, ey, sideZ * rimTube * 0.88);
        if (sideZ < 0) eyeG.rotation.y = Math.PI;

        const bezel = new THREE.Mesh(bezelGeo, goldMat);
        const iris = new THREE.Mesh(irisGeo, irisMat);
        iris.scale.set(1.15, 0.82, 0.55);
        const pupil = new THREE.Mesh(pupilGeo, pupilMat);
        pupil.position.z = rimTube * 0.16;
        eyeG.add(bezel, iris, pupil);
        rg.add(eyeG);
      }
    }

    wg.add(rg);
    void rIdx;
  });

  // Top & bottom interlocking gold pole collars + glowing central chashmal hub
  for (const sy of [-1, 1]) {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(rimTube * 1.15, rimTube * 1.15, rimTube * 0.9, 12),
      goldMat,
    );
    collar.position.y = sy * (radius - rimTube * 0.2);
    wg.add(collar);
  }

  const hubCore = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.16, 1), irisMat);
  hubCore.userData.shimmer = seedOffset + 1;
  const hubGyro = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.24, rimTube * 0.18, 10, 32),
    goldMat,
  );
  hubGyro.userData.orbitGlow = seedOffset + 1;
  wg.add(hubCore, hubGyro);

  return wg;
}

/**
 * Builds one stylized architectural four-winged, four-faced burnished-bronze cherubic form
 * (Ezek 1:5-14): straight upright legs with rounded calf-hoof bases, two folded body wings,
 * two lofty outstretched upper wings, and a stylized 4-directional sculptural capital head.
 */
function buildArchitecturalCherubForm(
  heightM: number,
  bronzeMat: THREE.Material,
  goldMat: THREE.Material,
): THREE.Group {
  const cg = new THREE.Group();
  const u = heightM / 4.2;

  // Straight upright legs & rounded burnished calf-hoof soles (Ezek 1:7)
  for (const sx of [-1, 1]) {
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * u, 0.24 * u, 0.22 * u, 14), goldMat);
    hoof.position.set(sx * 0.26 * u, 0.11 * u, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * u, 0.16 * u, 1.45 * u, 12), bronzeMat);
    leg.position.set(sx * 0.26 * u, 0.94 * u, 0);
    cg.add(hoof, leg);
  }

  // Architectural bronze torso column
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * u, 0.34 * u, 1.4 * u, 12), bronzeMat);
  torso.position.y = 2.28 * u;
  cg.add(torso);

  // Two lower wings folded across the body (Ezek 1:11, 23)
  for (const sx of [-1, 1]) {
    const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(0.65 * u, 1.45 * u, 0.14 * u), goldMat);
    lowerWing.position.set(sx * 0.28 * u, 2.05 * u, 0.34 * u);
    lowerWing.rotation.y = -sx * 0.38;
    lowerWing.rotation.z = sx * 0.18;
    const lowerWingBack = lowerWing.clone();
    lowerWingBack.position.z = -0.34 * u;
    lowerWingBack.rotation.y = sx * 0.38;
    cg.add(lowerWing, lowerWingBack);
  }

  // Stylized 4-directional architectural capital head (Ezek 1:10: 4 faces pointing to the 4 quarters)
  const headCore = new THREE.Mesh(new THREE.BoxGeometry(0.56 * u, 0.62 * u, 0.56 * u), bronzeMat);
  headCore.position.y = 3.32 * u;
  const crownCap = new THREE.Mesh(new THREE.BoxGeometry(0.64 * u, 0.12 * u, 0.64 * u), goldMat);
  crownCap.position.y = 3.68 * u;
  cg.add(headCore, crownCap);

  // 4 stylized architectural relief bosses on the 4 faces (+Z front brow, +X lion boss, -X ox-horn boss, -Z eagle crest)
  const frontBrow = new THREE.Mesh(new THREE.BoxGeometry(0.32 * u, 0.36 * u, 0.12 * u), goldMat);
  frontBrow.position.set(0, 3.3 * u, 0.32 * u);
  const lionMane = new THREE.Mesh(new THREE.TorusGeometry(0.2 * u, 0.06 * u, 8, 12), goldMat);
  lionMane.rotation.y = Math.PI / 2;
  lionMane.position.set(0.31 * u, 3.32 * u, 0);
  const oxHorns = new THREE.Mesh(
    new THREE.TorusGeometry(0.22 * u, 0.045 * u, 8, 12, Math.PI),
    goldMat,
  );
  oxHorns.rotation.y = Math.PI / 2;
  oxHorns.rotation.x = Math.PI;
  oxHorns.position.set(-0.31 * u, 3.45 * u, 0);
  const eagleCrest = new THREE.Mesh(new THREE.ConeGeometry(0.14 * u, 0.28 * u, 4), goldMat);
  eagleCrest.rotation.x = -Math.PI / 2;
  eagleCrest.position.set(0, 3.32 * u, -0.38 * u);
  cg.add(frontBrow, lionMane, oxHorns, eagleCrest);

  // Two lofty outstretched upper wings sweeping upward & along the square edges so wingtips touch neighbors (Ezek 1:9, 11)
  for (const dir of [-1, 1]) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(0, 3.05 * u, 0);
    wingGroup.rotation.y = dir > 0 ? 0 : Math.PI * 0.5;
    for (let f = 0; f < 4; f++) {
      const featherLen = (1.14 - f * 0.16) * u;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(featherLen, 0.16 * u, 0.09 * u),
        f === 0 ? goldMat : bronzeMat,
      );
      blade.position.set(featherLen * 0.5 + 0.16 * u, (0.68 - f * 0.14) * u, 0);
      blade.rotation.z = 0.52 - f * 0.07;
      wingGroup.add(blade);
    }
    cg.add(wingGroup);
  }

  return cg;
}

/**
 * 4. Ezekiel's Chariot-Vision & Ophannim Wheels (Ezekiel 1:4-28; 10:9-17):
 *    4 orthogonal intersecting beryl/chrysolite Wheel-within-a-Wheel (Ophannim) assemblies
 *    studded with crystalline eyes, 4 architectural four-winged cherubic forms, central coals of fire,
 *    overarching translucent Crystal Expanse (Rakia, 1:22), and Sapphire Throne Geometry (1:26)
 *    crowned STRICTLY ANICONICALLY with pure amber-fire (chashmal) glow & 7-band Rainbow (1:27-28) —
 *    ZERO human silhouette, torso, head, or figure on the throne!
 */
export function buildEzekielWheels(
  C: number,
  variant: EzekielWheelsVariant = 'full-vision',
): THREE.Group {
  void C; // Unmeasured prophetic vision: scaled to exact assumedHeight = 9.0 m (matching menorah & highpriest)
  const tex = getVisionTempleTex();
  const g = new THREE.Group();

  const berylMat = new THREE.MeshStandardMaterial({
    color: 0x62e3c4,
    map: tex.berylRim,
    emissive: 0x166352,
    emissiveIntensity: 0.38,
    metalness: 0.42,
    roughness: 0.16,
    transparent: true,
    opacity: 0.88,
  });
  const electrumGold = new THREE.MeshStandardMaterial({
    color: 0xf7cf59,
    emissive: 0x6e490a,
    emissiveIntensity: 0.28,
    metalness: 0.92,
    roughness: 0.16,
  });
  const irisGemMat = new THREE.MeshStandardMaterial({
    color: 0x9effe6,
    emissive: 0x2ec4a6,
    emissiveIntensity: 0.65,
    metalness: 0.35,
    roughness: 0.12,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x0c1b29,
    metalness: 0.7,
    roughness: 0.15,
  });
  const burnishedBronze = new THREE.MeshStandardMaterial({
    color: 0xd98f38,
    emissive: 0x422205,
    emissiveIntensity: 0.22,
    metalness: 0.88,
    roughness: 0.22,
  });
  const basaltPlinthMat = new THREE.MeshStandardMaterial({
    color: 0x1c2533,
    roughness: 0.82,
    metalness: 0.18,
  });

  if (variant === 'wheel-detail') {
    // Up-close inspection of ONE 3.60m-diameter orthogonal Wheel-within-a-Wheel (paired with panel.ts's 1.72m figure)
    const baseH = 0.12;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.05, baseH, 36), basaltPlinthMat);
    base.position.y = baseH * 0.5;
    g.add(base);

    const rWheel = 1.8;
    const ophan = buildSingleOphanWheel(rWheel, berylMat, electrumGold, irisGemMat, pupilMat, 1);
    ophan.position.set(0, baseH + rWheel + rWheel * 0.085, 0);
    g.add(ophan);

    return g;
  }

  // --- Variant 'full-vision': Complete 9.00m Chariot-Vision Geometry (y = 0 .. 9.00 m exact) ---
  // 1. River Chebar dark stone plinth (y = 0 .. 0.18 m) + shimmering water band (Ezek 1:1, 3)
  const plinthH = 0.18;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.45, plinthH, 48), basaltPlinthMat);
  plinth.position.y = plinthH * 0.5;
  const chebarWater = new THREE.Mesh(
    new THREE.RingGeometry(3.45, 4.18, 48),
    new THREE.MeshStandardMaterial({
      color: 0x1e6b8c,
      emissive: 0x0b3247,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.4,
    }),
  );
  chebarWater.rotation.x = -Math.PI / 2;
  chebarWater.position.y = plinthH + 0.008;
  chebarWater.userData.water = 1;
  g.add(plinth, chebarWater);

  // 2. Four Orthogonal Beryl Ophannim Double-Wheels (radius = 1.32 m) at the four corners (Ezek 1:15-18)
  const wheelR = 1.32;
  const wheelRim = wheelR * 0.085;
  const wheelCorners: Array<[number, number]> = [
    [1.92, 1.92],
    [-1.92, 1.92],
    [-1.92, -1.92],
    [1.92, -1.92],
  ];
  wheelCorners.forEach(([wx, wz], idx) => {
    const w = buildSingleOphanWheel(wheelR, berylMat, electrumGold, irisGemMat, pupilMat, idx + 1);
    w.position.set(wx, plinthH + wheelR + wheelRim, wz);
    g.add(w);
  });

  // 3. Four Architectural Four-Winged Burnished-Bronze Cherubic Forms (y = 0.18 .. 4.38 m, Ezek 1:5-14)
  const cherubCoords: Array<{ x: number; z: number; rotY: number }> = [
    { x: 1.15, z: 1.15, rotY: Math.PI * 0.5 },
    { x: -1.15, z: 1.15, rotY: 0 },
    { x: -1.15, z: -1.15, rotY: -Math.PI * 0.5 },
    { x: 1.15, z: -1.15, rotY: Math.PI },
  ];
  for (const cc of cherubCoords) {
    const ch = buildArchitecturalCherubForm(4.2, burnishedBronze, electrumGold);
    ch.position.set(cc.x, plinthH, cc.z);
    ch.rotation.y = cc.rotY;
    g.add(ch);
  }

  // 4. Blazing Coals of Fire & Lightning Torches in the midst of the four creatures (Ezek 1:13)
  const coalCoreMat = new THREE.MeshStandardMaterial({
    color: 0xff8a2b,
    emissive: 0xff4500,
    emissiveIntensity: 1.25,
    roughness: 0.35,
  });
  const coalCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 1), coalCoreMat);
  coalCore.position.set(0, 1.65, 0);
  coalCore.userData.ember = 1;
  g.add(coalCore);

  const lightningMat = new THREE.MeshStandardMaterial({
    color: 0xffe694,
    emissive: 0xff9d1c,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  for (let t = 0; t < 6; t++) {
    const torch = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 6), lightningMat);
    const a = (t / 6) * Math.PI * 2;
    torch.position.set(Math.cos(a) * 0.52, 2.05, Math.sin(a) * 0.52);
    torch.userData.flame = t + 1;
    g.add(torch);
  }

  // 5. Overarching Translucent Crystal Expanse (Rakia — "like awesome crystal", Ezek 1:22, y = 4.48 .. 4.86 m)
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xc9f0ff,
    emissive: 0x3b8ec4,
    emissiveIntensity: 0.36,
    metalness: 0.32,
    roughness: 0.08,
    transparent: true,
    opacity: 0.46,
  });
  const rakiaSlabGeo = new THREE.CylinderGeometry(3.35, 3.65, 0.34, 16);
  const rakiaSlab = new THREE.Mesh(rakiaSlabGeo, crystalMat);
  rakiaSlab.position.y = 4.67;
  const rakiaEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(rakiaSlabGeo),
    new THREE.LineBasicMaterial({ color: 0xe6f9ff, transparent: true, opacity: 0.8 }),
  );
  rakiaEdges.position.copy(rakiaSlab.position);
  g.add(rakiaSlab, rakiaEdges);

  // 6. Sapphire / Lapis Lazuli Throne Structure above the Expanse (Ezek 1:26, y = 4.84 .. 6.72 m)
  const sapphireMat = new THREE.MeshStandardMaterial({
    color: 0x1a4cb8,
    emissive: 0x0d2b73,
    emissiveIntensity: 0.48,
    metalness: 0.55,
    roughness: 0.16,
  });
  const dais1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.24, 2.5), sapphireMat);
  dais1.position.y = 4.96;
  const dais2 = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.24, 1.95), sapphireMat);
  dais2.position.y = 5.2;
  const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.48, 1.25), sapphireMat);
  throneSeat.position.set(0, 5.56, -0.05);
  const throneBack = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.38, 0.22), sapphireMat);
  throneBack.position.set(0, 6.03, -0.58);
  g.add(dais1, dais2, throneSeat, throneBack);

  for (const sx of [-1, 1]) {
    const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 1.18), sapphireMat);
    armRest.position.set(sx * 0.62, 5.95, -0.05);
    const armTrim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 1.22), electrumGold);
    armTrim.position.set(sx * 0.62, 6.18, -0.05);
    g.add(armRest, armTrim);
  }
  const throneBackEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.38, 1.4, 0.24)),
    new THREE.LineBasicMaterial({ color: 0x7ab4ff, transparent: true, opacity: 0.85 }),
  );
  throneBackEdges.position.copy(throneBack.position);
  g.add(throneBackEdges);

  // 7. STRICTLY ANICONIC Chashmal Amber-Fire Radiance & Overarching 7-Band Rainbow (Ezek 1:27-28):
  //    PURE GEOMETRIC LIGHT & SPECTRAL ARCS ONLY — ZERO HUMAN SILHOUETTE, HEAD, TORSO, OR FIGURE!
  const gloryCenterY = 6.35;

  // Blazing inner Chashmal (electrum/amber) core + outer translucent fire envelope
  const chashmalCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.46, 2),
    new THREE.MeshStandardMaterial({
      color: 0xfff0a6,
      emissive: 0xffb319,
      emissiveIntensity: 1.55,
      roughness: 0.12,
    }),
  );
  chashmalCore.position.set(0, gloryCenterY + 0.12, 0.05);
  chashmalCore.userData.ember = 2;

  const amberAura = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffba42,
      emissive: 0xff6f00,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.36,
      roughness: 0.2,
    }),
  );
  amberAura.position.set(0, gloryCenterY, 0.05);
  amberAura.userData.ember = 3;

  // Purely geometric equatorial fire ring dividing upper electrum brilliance & lower fire radiance (1:27)
  const fireEquator = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.038, 10, 48),
    electrumGold,
  );
  fireEquator.rotation.x = Math.PI / 2;
  fireEquator.position.set(0, gloryCenterY, 0.05);
  fireEquator.userData.orbitGlow = 2;
  g.add(chashmalCore, amberAura, fireEquator);

  // Radial geometric light rays (non-anthropomorphic starburst)
  for (let r = 0; r < 10; r++) {
    const ang = (r / 10) * Math.PI;
    const ray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.045, 1.55, 6),
      lightningMat,
    );
    ray.position.set(Math.cos(ang) * 0.92, gloryCenterY + Math.sin(ang) * 0.92, 0.05);
    ray.rotation.z = ang - Math.PI * 0.5;
    g.add(ray);
  }

  // Overarching 7-Band Spectral Rainbow (Ezek 1:28):
  // Outer band radius = 2.61 m + tube 0.04 m -> exact top y = 6.35 + 2.65 = 9.00 m (assumedHeight = 9.0)!
  const rainbowColors = [
    0x7c3aed, // Violet (innermost)
    0x2563eb, // Sapphire-Blue
    0x06b6d4, // Cyan-Beryl
    0x10b981, // Emerald-Green
    0xfacc15, // Amber-Gold
    0xf97316, // Fiery Orange
    0xef4444, // Crimson-Red (outermost, crowning at y = 9.00 m)
  ];
  rainbowColors.forEach((col, bi) => {
    const arcR = 2.07 + bi * 0.09; // bi = 6 -> 2.61 m + 0.04 m tube = 2.65 m -> 6.35 + 2.65 = 9.00 m
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(arcR, 0.04, 10, 64, Math.PI),
      new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.72,
        transparent: true,
        opacity: 0.52,
        roughness: 0.18,
      }),
    );
    band.position.set(0, gloryCenterY, 0);
    g.add(band);
  });

  return g;
}

/**
 * Measured-to-Spec card metadata for the 4 new structures, ready to be wired into specs.ts.
 * Indented identically to STRUCTURES in src/structures/specs.ts so audit-events.mjs parses
 * every 4-space `id` and `ref` cleanly.
 */
export const VISION_TEMPLE_SPECS: VisionTempleSpec[] = [
  {
    id: 'herod-sanctuary',
    zh: '希律圣殿主殿',
    en: "Herod's Temple Sanctuary",
    ref: 'John 2:20',
    refZh: '约翰福音 2:20',
    textZh: '犹太人便说：「这殿是四十六年才造成的，你三日内就再建立起来吗？」',
    textEn: 'The Jews replied, "It has taken forty-six years to build this temple, and you are going to raise it in three days?"',
    dims: [
      { key: 'facadeW', zh: '东向廊殿（乌兰）总宽', en: 'East facade (Ulam) width', cubits: 100, ref: '尺寸篇 4:6–7；战记 5.207', refEn: 'Middot 4:6–7; War 5.207' },
      { key: 'height',  zh: '主殿总高（含上层楼）', en: 'Total height (incl. upper room)', cubits: 100, ref: '尺寸篇 4:6；战记 5.207', refEn: 'Middot 4:6; War 5.207' },
      { key: 'length',  zh: '东西总纵深',           en: 'Total east-west length', cubits: 100, ref: '尺寸篇 4:7', refEn: 'Middot 4:7' },
      { key: 'rearW',   zh: '后段殿身宽（T 形窄腰）', en: 'Rear sanctuary width (T-stem)', cubits: 70, ref: '尺寸篇 4:7；战记 5.207', refEn: 'Middot 4:7; War 5.207' },
      { key: 'portalH', zh: '乌兰无扇东门高',       en: 'Open Ulam portal height', cubits: 40, ref: '尺寸篇 3:7', refEn: 'Middot 3:7' },
      { key: 'portalW', zh: '乌兰无扇东门宽',       en: 'Open Ulam portal width', cubits: 20, ref: '尺寸篇 3:7', refEn: 'Middot 3:7' },
      { key: 'hekhalL', zh: '圣所（外殿）内长',     en: 'Holy Place (Hekhal) length', cubits: 40, ref: '尺寸篇 4:7；战记 5.215', refEn: 'Middot 4:7; War 5.215' },
      { key: 'debirL',  zh: '至圣所内长宽',         en: 'Most Holy Place square', cubits: 20, ref: '尺寸篇 4:7；战记 5.219', refEn: 'Middot 4:7; War 5.219' },
    ],
    kind: 'herodSanctuary',
    walk: 'herod',
    counts: [
      { zh: '登乌兰前廊台阶', en: 'Steps up to the Ulam porch', n: 12, ref: '尺寸篇 3:6；战记 5.207', refEn: 'Middot 3:6; War 5.207' },
      { zh: '环殿三层旁屋总数', en: 'Three-tier side chambers', n: 38, ref: '尺寸篇 4:3', refEn: 'Middot 4:3' },
      { zh: '隔开至圣所的双层幔子', en: 'Twin sanctuary veils (1-cubit gap)', n: 2, ref: '尺寸篇 4:7；太 27:51', refEn: 'Middot 4:7; Matt 27:51' },
    ],
    variants: {
      key: 'herodSanctuaryView',
      zh: '展示视角',
      en: 'Architectural view',
      options: [
        {
          id: 'facade',
          zh: '百肘白石金板立面 · 十二级台阶与金葡萄树',
          en: '100-cubit white & gold T-facade · 12 steps & Golden Vine',
          note: '按《密西拿·尺寸篇》4:6–7 与约瑟夫《犹太战记》5.207–224 复原：雪白琢石镶巨幅金板，前廊展宽百肘如雄狮宽肩，门楣悬垂一人高的纯金葡萄串。',
          noteEn: 'Reconstructs the 100×100×100 cubit T-plan sanctuary of Mishnah Middot 4:6–7 and Josephus War 5.207–224: snow-white limestone, flashing gold plates, and the colossal Golden Vine.',
        },
        {
          id: 'cutaway',
          zh: '南翼剖面 · 圣所三器、双幔与空无一物的至圣所',
          en: 'South cutaway · Hekhal vessels, twin veil & empty Most Holy Place',
          note: '剖开南肩、三层旁屋与四十肘上层楼，显露四十肘圣所（灯台、陈设饼桌、香坛）、双层幔子，以及第二圣殿**空无约柜、唯露裸石根基石**的至圣所（战记 5.219）。',
          noteEn: 'Slices away the south shoulder, 3-story chambers, and 40-cubit upper room to reveal the Hekhal vessels, twin veil, and **completely empty Most Holy Place** holding only the bare Foundation Stone (War 5.219).',
        },
      ],
    },
    unstated: [
      {
        zh: '新约福音书（约 2:20；可 13:1；太 27:51）记载了四十六年工期、宏伟白石与殿里的幔子，但百肘 T 形平面与各段细数来自《密西拿·尺寸篇》（Middot）与亲历者约瑟夫《犹太战记》卷五，而非圣经经文直接开列。',
        en: 'The Gospels record the 46-year construction (John 2:20), massive stones (Mark 13:1), and sanctuary veil (Matt 27:51), while the 100×100×100 cubit T-plan figures come from Mishnah Middot and eyewitness Josephus (War 5.207–224) rather than biblical verse.',
      },
      {
        zh: '乌兰东门尺寸两处古籍略有差异：《密西拿·尺寸篇》3:7 记门高四十肘、宽二十肘；约瑟夫《犹太战记》5.208 记高七十肘、宽二十五肘。此处采用尺寸篇的 40×20 肘。',
        en: 'Ulam portal opening differs between sources: Mishnah Middot 3:7 gives 40×20 cubits, whereas Josephus War 5.208 gives 70×25 cubits; Middot 40×20 cubits is built here.',
      },
      {
        zh: '第二圣殿的至圣所内没有约柜（耶 3:16；约瑟夫《犹太战记》5.219 明言「里面空无一物」），仅有一块高出地面三指宽的天然磐石「根基石」（Even HaShetiyah，赎罪日篇 5:2）。模型严守历史与圣经实情，绝不虚添约柜或神像。',
        en: 'The Second-Temple Most Holy Place contained no Ark of the Covenant (Josephus War 5.219: "nothing at all lay within it"), only the bare bedrock Foundation Stone rising three fingerbreadths above the floor (Mishnah Yoma 5:2).',
      },
    ],
    punchZh: '百肘宽、百肘深、百肘高——相当于 **十五层现代高楼（约 45 至 52 米）** 的雪白巨石与纯金立面耸立在圣殿山巅，站在十二级台阶下的 **1.72 米**真人连基座一半都不到；而穿过重重金门与双幔之后，最核心的至圣所却是一间空荡荡的房间，只露出一块天然磐石。',
    punchEn: '**100 × 100 × 100 cubits** (~44.5 to 51.8 m — fifteen storeys tall) of snow-white stone and blazing gold plates towering above a **1.72 m** visitor, yet behind the monumental twin veil the Most Holy Place stood **completely empty** save for bare bedrock.',
    compare: [
      { zh: '巴黎凯旋门（高）', en: 'Arc de Triomphe, Paris (height)', m: 50 },
      { zh: '希律圣殿主殿高与宽（100 肘）', en: "Herod's Sanctuary height & width (100 c)", m: 44.5 },
      { zh: '所罗门圣殿高（30 肘）', en: "Solomon's Temple height (30 c)", m: 13.35 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'second-temple',
    zh: '所罗巴伯重建的第二圣殿',
    en: "Zerubbabel's Second Temple",
    ref: 'Ezra 6:3',
    refZh: '以斯拉记 6:3',
    textZh: '古列王元年，他降旨论到耶路撒冷神的殿，要建造这殿为献祭之处，坚立殿的根基。殿高六十肘，宽六十肘，用三层大石头，一层新木头，经费要出于王库。',
    textEn: 'In the first year of King Cyrus, the king issued a decree concerning the temple of God in Jerusalem: Let the temple be rebuilt as a place to present sacrifices, and let its foundations be laid. It is to be sixty cubits high and sixty cubits wide, with three courses of large stones and one of timbers.',
    dims: [
      { key: 'decreeH',  zh: '古列诏书上限高',     en: 'Cyrus decree height',      cubits: 60, ref: '拉 6:3',   refEn: 'Ezra 6:3' },
      { key: 'decreeW',  zh: '古列诏书上限宽',     en: 'Cyrus decree width',       cubits: 60, ref: '拉 6:3',   refEn: 'Ezra 6:3' },
      { key: 'solomonL', zh: '对照：所罗门殿长',   en: "Compare: Solomon's length", cubits: 60, ref: '王上 6:2', refEn: '1 Kgs 6:2' },
      { key: 'solomonH', zh: '对照：所罗门殿高',   en: "Compare: Solomon's height", cubits: 30, ref: '王上 6:2', refEn: '1 Kgs 6:2' },
      { key: 'solomonW', zh: '对照：所罗门殿内宽', en: "Compare: Solomon's width",  cubits: 20, ref: '王上 6:2', refEn: '1 Kgs 6:2' },
    ],
    kind: 'secondTemple',
    counts: [
      { zh: '大石头层数（滚石筑墙）', en: 'Courses of great dressed stones', n: 3, ref: '拉 6:4；5:8', refEn: 'Ezra 6:4; 5:8' },
      { zh: '新木头层数（黎巴嫩香柏木）', en: 'Top course of new timber', n: 1, ref: '拉 6:4；3:7', refEn: 'Ezra 6:4; 3:7' },
    ],
    variants: {
      key: 'secondTempleView',
      zh: '历史对照',
      en: 'Historical comparison',
      options: [
        {
          id: 'cyrus-decree',
          zh: '古列王诏书规模（60×60 肘框 · 三石一木与燔祭坛）',
          en: 'Cyrus decree volume (60×60 c frame · 3 stone + 1 timber)',
          note: '呈现亚兰文诏书给定的高六十肘、宽六十肘皇家拨款外框（拉 6:3），墙体按「三层大石头、一层新木头」（6:4）砌筑，东院先立燔祭坛（拉 3:2–3）。',
          noteEn: 'Shows the 60×60 cubit Achaemenid decree envelope (Ezra 6:3), built in three courses of heavy ashlar stone topped by one course of new cedar timber (6:4), fronted by the rebuilt altar (3:2–3).',
        },
        {
          id: 'compare-solomon',
          zh: '并排对照所罗门旧殿金影（拉 3:12；该 2:3）',
          en: "Side-by-side ghost of Solomon's Temple (Ezra 3:12; Hag 2:3)",
          note: '把被掳归回之民的朴素石木圣殿与所罗门 **60×20×30 肘纯金包覆、立有雅斤波阿斯双铜柱** 的旧殿金影并置，直观理解为何见过旧殿的老年人放声痛哭（拉 3:12）。',
          noteEn: "Places Zerubbabel's austere stone-and-timber house beside a translucent golden ghost of Solomon's **60×20×30 cubit** gilded Temple and twin bronze pillars to visualize why elders wept in Ezra 3:12 and Haggai 2:3.",
        },
      ],
    },
    unstated: [
      {
        zh: '以斯拉记 6:3 的波斯宫廷亚兰文档案只写了「高六十肘、宽六十肘」，未写东西长度！学者普遍认为这是王库拨款的最高建筑外廓上限（含两侧附属库房），殿基仍沿用所罗门旧址六十肘长。模型用金色线框标出 60×60 肘诏书包络，不把未记细节伪装成施工详图。',
        en: 'The Aramaic archival decree in Ezra 6:3 specifies height (60 cubits) and width (60 cubits) without stating length — widely understood as a royal treasury maximum envelope (including side chambers) laid over the 60-cubit Solomonic foundation. A wireframe marks the 60×60 cubit decree boundary honestly.',
      },
      {
        zh: '「三层大石头、一层新木头」（拉 6:4）既可指抗震石墙每三皮巨石嵌一道香柏木拉结梁（对照王上 6:36 内院做法），也可指下部石墙与上部木构层；模型兼顾两种读法的可视层次。',
        en: '"Three courses of large stones and one of new timber" (Ezra 6:4; cf. 1 Kgs 6:36) may describe seismic cedar tie-beams set above every three courses of heavy stone or an upper timber storey; rendered clearly as three monumental stone tiers crowned by cedar.',
      },
      {
        zh: '拉 3:2–3 记载归回百姓在立殿根基前先在旧基上筑起祭坛献燔祭，但经文未记此坛具体肘数。',
        en: 'Ezra 3:2–3 records that the altar of burnt offering was rebuilt first upon its former site, without recording its exact post-exilic cubit dimensions.',
      },
    ],
    punchZh: '诏书允许的包络宽达 **六十肘、高六十肘（约 26.7 米）**，外廓甚至大过所罗门内殿；但当你切到并排金影就会明白拉 3:12 与该 2:3 的眼泪——没有满殿精金、没有两根十八肘铜柱、没有约柜，只有被掳归回之民在废墟上垒起的**三层大石与一层新木**。',
    punchEn: 'Cyrus’s decree permitted a **60 × 60 cubit (~26.7 m)** envelope, yet toggling Solomon’s golden ghost beside it explains the tears of Ezra 3:12 and Haggai 2:3: gone were the pure gold plates, Jachin and Boaz, and the Ark — replaced by austere **heavy stone and new timber**.',
    compare: [
      { zh: '古列诏书高与宽（60 肘）', en: 'Cyrus decree height & width (60 c)', m: 26.7 },
      { zh: '所罗门圣殿高（30 肘）', en: "Solomon's Temple height (30 c)", m: 13.35 },
      { zh: '所罗门圣殿内宽（20 肘）', en: "Solomon's Temple width (20 c)", m: 8.9 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'wilderness-camp',
    zh: '旷野十二支派安营图',
    en: "Israel's 12-Tribe Wilderness Camp",
    ref: 'Numbers 2:2',
    refZh: '民数记 2:2',
    textZh: '以色列人要各归自己的纛下，在本族的旗号那里，对着会幕的四围安营。',
    textEn: 'The Israelites are to camp around the tent of meeting some distance from it, each of them under their standard and holding the banners of their family.',
    dims: [
      { key: 'courtL', zh: '中心会幕院子长', en: 'Central court length',      cubits: 100, ref: '出 27:18',     refEn: 'Exod 27:18' },
      { key: 'courtW', zh: '中心会幕院子宽', en: 'Central court width',       cubits: 50,  ref: '出 27:18',     refEn: 'Exod 27:18' },
      { key: 'tentL',  zh: '会幕帐幕长',     en: 'Tabernacle tent length',    cubits: 30,  ref: '出 26:18',     refEn: 'Exod 26:18' },
      { key: 'tentW',  zh: '会幕帐幕宽与高', en: 'Tabernacle width & height', cubits: 10,  ref: '出 26:16, 22', refEn: 'Exod 26:16, 22' },
      { key: 'courtH', zh: '细麻院帷高',     en: 'Court curtain height',      cubits: 5,   ref: '出 27:18',     refEn: 'Exod 27:18' },
    ],
    kind: 'wildernessCamp',
    walk: 'tabernacle',
    counts: [
      { zh: '东营（日出之地）· 犹大纛下三支派', en: 'East · Camp of Judah (3 tribes)',   n: 186400, ref: '民 2:9',  refEn: 'Num 2:9' },
      { zh: '北营 · 但纛下三支派',             en: 'North · Camp of Dan (3 tribes)',    n: 157600, ref: '民 2:31', refEn: 'Num 2:31' },
      { zh: '南营 · 流便纛下三支派',           en: 'South · Camp of Reuben (3 tribes)', n: 151450, ref: '民 2:16', refEn: 'Num 2:16' },
      { zh: '西营 · 以法莲纛下三支派',         en: 'West · Camp of Ephraim (3 tribes)', n: 108100, ref: '民 2:24', refEn: 'Num 2:24' },
      { zh: '十二支派男丁总数（二十岁以上）',   en: 'Total census (12 tribes, 20+ yrs)', n: 603550, ref: '民 2:32', refEn: 'Num 2:32' },
      { zh: '内圈利未人总数（一个月以上）',     en: 'Inner ring Levites (1 mo+)',        n: 22000,  ref: '民 3:39', refEn: 'Num 3:39' },
    ],
    variants: {
      key: 'campLayout',
      zh: '营距比例',
      en: 'Camp spacing',
      options: [
        {
          id: 'proportional',
          zh: '严守人数面积比例 · 留出圣所缓冲带（民 2:2）',
          en: 'Strictly census-proportional · open sacred buffer',
          note: '外圈十二支派每一营区的占地面积与帐棚密度严格正比于民数记 2 章核点人数：东营犹大（**186,400**）比西营以法莲（**108,100**）宽出近七成，内圈由利未四营护卫会幕（民 1:53；3:21–38）。',
          noteEn: 'Every tribal parcel is strictly proportional in footprint area to its Numbers 2 census count — Judah on the east (**186,400**) visibly outweighs Ephraim on the west (**108,100**) by 72% — ringed around the four Levite divisions and 100×50 cubit Tabernacle.',
        },
        {
          id: 'compact',
          zh: '紧凑鸟瞰阵型 · 近看会幕与利未四营',
          en: 'Compact diagram spacing · close Tabernacle & Levite view',
          note: '收窄营间旷野缓冲带，便于在同一视野内近距离审视 100×50 肘会幕院子、东门摩西亚伦营位与外圈十二支派旗号，同时完全保留各支派人数面积比。',
          noteEn: 'Tightens the desert buffer so the 100×50 cubit Tabernacle courtyard, four Levite stations, and 12 tribal standards read up close while preserving exact census area ratios.',
        },
      ],
    },
    unstated: [
      {
        zh: '「对着会幕的四围安营」的具体相隔肘数，民数记 2:2 没有写出（后世拉比传统据书 3:4 推算为二千肘安息日路程，若按真实二千肘留白，中心会幕在屏幕上将缩成一个小点）；模型用两种示意间距呈现，而中心会幕严格按 100×50 肘建模。',
        en: 'Numbers 2:2 says "some distance" around the Tent of Meeting without stating a cubit gap (later tradition inferred 2,000 cubits from Josh 3:4, at which scale the Tabernacle would vanish to a speck); two schematic buffer spacings are provided around the exact 100×50 cubit court.',
      },
      {
        zh: '各支派每户帐棚的尺寸与营区总长宽未见经文记载；模型令每一支派地块的宽度严格正比于民数记 2 章的人口数，以真实反映四方营阵的不对称体量。',
        en: 'Individual family tent sizes and total camp perimeter are unstated; each tribe’s parcel width is scaled directly to its Numbers 2 census count to show the true asymmetry of the four quarters.',
      },
      {
        zh: '各营「纛」（degel）与「旗号」（ot）上的图案经文只字未提（狮、人、牛、鹰之说出自后世拉比《民数记大传》，并非圣经文本）；模型仅以纯色织旗区分四营，绝不添画圣经未记的图像；会幕上方的云柱火柱亦严守无形像光云（出 40:38）。',
        en: 'Scripture never describes emblems on the tribal standards (lion/man/ox/eagle come from late midrash, not Numbers 2); plain colored banners are used, and the pillar of cloud and fire above the Tabernacle is rendered strictly aniconically (Exod 40:38).',
      },
    ],
    punchZh: '这不是一个四面均等的几何方阵：东边日出之地犹大三支派多达 **186,400 人**，西边以法莲三支派只有 **108,100 人**；中间由 **22,000 名利未人**四面环卫（摩西亚伦守东门，哥辖南、革顺西、米拉利北），正中锁着 **100 × 50 肘**的会幕与昼夜不离的云火光辉。',
    punchEn: 'Not an equal geometric square, but a living census map: **186,400** camp on the east under Judah versus **108,100** on the west under Ephraim, buffering **22,000 Levites** in four inner divisions around the **100 × 50 cubit** Tabernacle.',
    compare: [
      { zh: '标准足球场（长）', en: 'Football pitch (length)', m: 105 },
      { zh: '中心会幕院子（长 100 肘）', en: 'Central Tabernacle court (100 c)', m: 44.5 },
      { zh: '会幕帐幕（长 30 肘）', en: 'Tabernacle tent (30 c)', m: 13.35 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'ezekiel-wheels',
    zh: '以西结书第一章水苍玉套轮异象',
    en: "Ezekiel's Chariot-Wheels & Expanse",
    ref: 'Ezekiel 1:16',
    refZh: '以西结书 1:16',
    textZh: '轮的形状和作法好像水苍玉。四轮都是一个样式，形状和作法好像轮中套轮。轮行走的时候，向四方都能直行，并不掉转。至于轮辋，高而可畏；四个轮辋周围满有眼睛。',
    textEn: 'This was the appearance and structure of the wheels: They sparkled like beryl, and all four looked alike. Each appeared to be made like a wheel intersecting a wheel. As they moved, they would go in any one of the four directions without turning as they went. Their rims were high and awesome, and all four rims were full of eyes all around.',
    dims: [],
    counts: [
      { zh: '四活物（结 10:20 明指基路伯）', en: 'Living creatures (cherubim, 10:20)', n: 4, ref: '结 1:5；10:20',    refEn: 'Ezek 1:5; 10:20' },
      { zh: '每个活物的脸面（四向）',       en: 'Faces per creature',                 n: 4, ref: '结 1:6, 10',       refEn: 'Ezek 1:6, 10' },
      { zh: '每个活物的翅膀（两上相连、两下遮体）', en: 'Wings per creature (2 up, 2 down)', n: 4, ref: '结 1:6, 11', refEn: 'Ezek 1:6, 11' },
      { zh: '水苍玉轮中套轮（活物旁各一）', en: 'Beryl double-wheels (Ophannim)',     n: 4, ref: '结 1:15–16；10:9', refEn: 'Ezek 1:15–16; 10:9' },
    ],
    kind: 'ezekielWheels',
    walk: 'ezekiel',
    assumedHeight: 9.0,
    variants: {
      key: 'wheelsView',
      zh: '异象视距',
      en: 'Vision view',
      options: [
        {
          id: 'full-vision',
          zh: '迦巴鲁河畔全异象 · 四套轮、水晶穹苍、蓝宝石座与虹光',
          en: 'Full vision · 4 double-wheels, crystal expanse, sapphire throne & rainbow',
          note: '完整呈现结 1:4–28 的空间层级：底层四组正交水苍玉套轮与四翼擦亮铜色活物，中间碳火电光（1:13），头顶可畏的水晶穹苍（1:22），其上蓝宝石宝座纯以**精金琥珀火光（chashmal）与七彩虹弧**（1:27–28）显荣，绝不描绘人形轮廓。',
          noteEn: 'Full spatial hierarchy of Ezek 1:4–28: four orthogonal beryl double-wheels, four-winged burnished-bronze cherubic forms, central coals of fire, crystal expanse (1:22), and sapphire throne crowned **strictly aniconically** with pure amber-fire radiance and overarching rainbow (1:27–28).',
        },
        {
          id: 'wheel-detail',
          zh: '单组正交「轮中套轮」特写 · 高而可畏的满眼轮辋',
          en: 'Single orthogonal wheel-within-a-wheel detail · eye-studded rims',
          note: '把一组高 3.6 米的正交双环套轮立在 **1.72 米**参照人物身旁，细看结 1:16–18 为何说「向四方都能直行，并不掉转」：东西向与南北向两道水苍玉高轮辋呈 90 度咬合，满镶晶莹眼饰。',
          noteEn: 'Sets one 3.6 m orthogonal double-wheel beside a **1.72 m** human scale figure to show how two 90-degree intersecting beryl rims move straight toward any of the four compass points without pivoting (Ezek 1:16–18).',
        },
      ],
    },
    unstated: [
      {
        zh: '以西结书第 1 章与第 40–48 章截然不同：第 1 章没有给出任何一个肘数，只说轮辋「高而可畏」（1:18），全靠「四活物、四脸、四翼、四套轮」的精确计数构建空间秩序。此处总高 9.0 米仅为展示参照高度，不是经文尺寸。',
        en: 'Unlike Ezekiel 40–48, chapter 1 gives zero cubit measurements — stating only that the rims were "high and awesome" (1:18) while specifying exact counts of fours. The 9.0 m total height is a display convention, not a scriptural measure.',
      },
      {
        zh: '「轮中套轮」（ophan b-tokh ha-ophan，结 1:16）古今主要有两种几何读法：正交九十度咬合双轮（无需转向即可向东南西北四方直行，1:17）或同平面同心套环。本模型采用最能解释「向四方直行并不掉转」的正交双环结构。',
        en: '"A wheel within a wheel" (1:16) has two classic geometric readings: two vertical rings intersecting at 90 degrees (explaining straight motion in all four directions without turning, 1:17) or concentric coplanar rings; orthogonal rings are built here.',
      },
      {
        zh: '结 1:26–28 连用三重谨慎限定语（「宝座的形像」「仿佛……的形状」「这就是雅伟荣耀的形像的样式」）。遵照申命记 4:12, 15 不可为雅伟造任何形像的诫命，蓝宝石宝座上方仅呈现纯粹的精金琥珀光辉（chashmal）与云中彩虹（1:27–28），绝不绘制任何人体轮廓。',
        en: 'Ezekiel 1:26–28 stacks three layers of reverent indirection ("likeness of a throne... appearance of the likeness of the glory of Yahweh"). Honoring Deut 4:12, 15, only pure amber-electrum fire radiance (chashmal) and the overarching rainbow crown the sapphire throne — with zero human figure or silhouette.',
      },
    ],
    punchZh: '以西结书 40 至 48 章量遍了每一道门槛的肘数，第 1 章在迦巴鲁河边却**一个尺寸也没给**——只记下**四活物、十六张脸、十六只翅膀、四组满布眼睛的水苍玉正交套轮**，托起水晶穹苍与蓝宝石座上的虹光荣耀。',
    punchEn: 'Where chapters 40–48 measure every threshold in cubits, chapter 1 gives **zero linear dimensions** — building awe through pure geometry and count: **4 four-winged forms, 4 eye-studded orthogonal beryl double-wheels**, a **crystal expanse**, and **aniconic amber-fire glory** beneath a **rainbow**.',
    compare: [
      { zh: '异象总展示高度（传统参照）', en: 'Full vision display height (assumed)', m: 9.0 },
      { zh: '单组水苍玉套轮高（特写参照）', en: 'Single beryl double-wheel (detail)', m: 3.6 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
];
