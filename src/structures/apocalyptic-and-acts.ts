import * as THREE from 'three';
import type { Structure, WalkHome } from './specs.ts';
import { buildMenorah } from './menorah.ts';

// Four New-Testament models: Paul's grain ship (Acts 27), the throne room of
// Revelation 4, the seven lampstands of Revelation 1, and the house of Acts 2.
// None of them has a single stated dimension, so every one is built to an
// `assumedHeight` and says so on its card (dims: [], unit: undefined).
//
// Two rules hold across the file:
//  - No companion figure is added here: panel.ts already stands one 1.72 m
//    person beside every non-cube structure.
//  - The Revelation and Pentecost scenes are strictly aniconic. The throne is
//    stone and light only (Rev 4:3); the one among the lampstands is shown only
//    as light (Rev 1:16); the elders are seats and crowns; the disciples are
//    not modelled at all, only the house and the tongues of fire.

export type PaulShipVariant = 'hull-cutaway' | 'melita-reef';
export type Rev4ThroneVariant = 'full-council' | 'throne-and-lamps';
export type SevenLampstandsVariant = 'seven-churches' | 'compare-menorah';
export type PentecostRoomVariant = 'cutaway-flames' | 'jerusalem-house';

export type NtVisionKind = 'paulShip' | 'rev4ThroneRoom' | 'sevenLampstands' | 'pentecostRoom';

/** Card shape. `kind` is narrowed to the four new kinds so the array drops into
 *  STRUCTURES as soon as StructureKind is extended; none of the four has a walk. */
export type NtVisionSpec = Omit<Structure, 'kind' | 'walk'> & { kind: NtVisionKind; walk?: WalkHome };

// ---------------------------------------------------------------------------
// Shared textures
// ---------------------------------------------------------------------------

interface NtTex {
  ashlar: THREE.CanvasTexture;
  cedar: THREE.CanvasTexture;
  hullPlank: THREE.CanvasTexture;
  linen: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  sail: THREE.CanvasTexture;
}

let cachedNtTex: NtTex | null = null;

function shareTex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.userData.shared = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function getNtTex(): NtTex {
  if (cachedNtTex) return cachedNtTex;

  // 1. Jerusalem cut limestone ashlar with drafted margins
  const [ac, ax] = canvas2d(256, 256);
  ax.fillStyle = '#cfc4ad';
  ax.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const off = (row % 2) * 40;
    for (let col = -1; col < 4; col++) {
      const x = col * 80 + off;
      const tone = 214 + (((row * 5 + col * 13) & 7) - 3) * 3;
      ax.fillStyle = `rgb(${tone - 22}, ${tone - 28}, ${tone - 40})`;
      ax.fillRect(x + 1, y + 1, 78, 30);
      ax.fillStyle = `rgb(${tone}, ${tone - 6}, ${tone - 20})`;
      ax.fillRect(x + 5, y + 5, 70, 22);
    }
  }
  const ashlar = shareTex(ac, 2, 2);

  // 2. Lebanon cedar beams: warm red-brown grain
  const [cc, cx] = canvas2d(256, 64);
  cx.fillStyle = '#8a4f2c';
  cx.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 40; i++) {
    const y = (i * 37) % 64;
    cx.strokeStyle = i % 3 === 0 ? 'rgba(60,28,12,0.55)' : 'rgba(170,104,62,0.4)';
    cx.lineWidth = 1 + (i % 2);
    cx.beginPath();
    cx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) cx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2.5);
    cx.stroke();
  }
  const cedar = shareTex(cc, 1, 1);

  // 3. Plank-on-frame hull strakes with pitch seams
  const [hc, hx] = canvas2d(256, 256);
  hx.fillStyle = '#6b4526';
  hx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    const tone = 98 + ((y / 16) % 3) * 9;
    hx.fillStyle = `rgb(${tone + 14}, ${tone - 22}, ${tone - 58})`;
    hx.fillRect(0, y + 2, 256, 13);
    hx.fillStyle = '#2b1a0e';
    hx.fillRect(0, y, 256, 2);
    for (let x = ((y / 16) % 2) * 64; x < 256; x += 128) hx.fillRect(x, y, 2, 16);
  }
  const hullPlank = shareTex(hc, 6, 2);

  // 4. White linen cloth (Rev 4:4 white garments -> white seat cloths)
  const [lc, lx] = canvas2d(128, 128);
  lx.fillStyle = '#f4f1ea';
  lx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) {
    lx.fillStyle = 'rgba(200,192,176,0.35)';
    lx.fillRect(i, 0, 1, 128);
    lx.fillRect(0, i, 128, 1);
  }
  const linen = shareTex(lc, 2, 2);

  // 5. Speckled coastal sand and reef stone
  const [sc, sx] = canvas2d(128, 128);
  sx.fillStyle = '#c9b48a';
  sx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = (i * 7919) % 128;
    const u = (i * 104729) % 128;
    sx.fillStyle = i % 4 === 0 ? 'rgba(90,76,58,0.5)' : 'rgba(236,222,190,0.6)';
    sx.fillRect(u, v, 2, 2);
  }
  const sand = shareTex(sc, 4, 4);

  // 6. Weathered linen sailcloth with stitched seams
  const [pc, px] = canvas2d(128, 128);
  px.fillStyle = '#e3d6b8';
  px.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    px.fillStyle = 'rgba(150,128,92,0.45)';
    px.fillRect(x, 0, 2, 128);
  }
  const sail = shareTex(pc, 1, 1);

  cachedNtTex = { ashlar, cedar, hullPlank, linen, sand, sail };
  return cachedNtTex;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function addBox(
  parent: THREE.Object3D,
  w: number, h: number, d: number,
  mat: THREE.Material,
  x: number, y: number, z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Wraps a built group so its lowest point sits exactly on y = 0. */
function seatOnGround(inner: THREE.Group): THREE.Group {
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const out = new THREE.Group();
  if (Number.isFinite(box.min.y)) inner.position.y -= box.min.y;
  out.add(inner);
  return out;
}

function std(
  color: number,
  opts: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts });
}

function goldMat(): THREE.MeshStandardMaterial {
  return std(0xe8bd4a, { emissive: 0x5a3a08, emissiveIntensity: 0.2, metalness: 0.95, roughness: 0.2 });
}

function flameMat(): THREE.MeshStandardMaterial {
  return std(0xffd36b, { emissive: 0xff7a12, emissiveIntensity: 1.45, roughness: 0.25, transparent: true, opacity: 0.92 });
}

/** One flickering cone flame whose base sits at (x, y, z). */
function addFlame(parent: THREE.Object3D, r: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seed: number): THREE.Mesh {
  const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), mat);
  f.position.set(x, y + h * 0.5, z);
  f.userData.flame = seed;
  parent.add(f);
  return f;
}

function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, seg = 32): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, 8, false), mat);
}

// ---------------------------------------------------------------------------
// 1. Paul's Alexandrian grain ship (Acts 27)
// ---------------------------------------------------------------------------

const SHIP_L = 24.0; // display deck length (not stated in Acts 27)
const SHIP_B = 7.2;
const SHIP_D = 3.4;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Half-beam at station t (t = 0 stern, t = 1 bow): fuller stern, finer bow. */
function shipHalfBeam(t: number): number {
  const tt = clamp01(t);
  const p = tt < 0.5 ? 0.42 : 0.62;
  return (SHIP_B / 2) * Math.max(0.035, Math.pow(Math.sin(Math.PI * tt), p));
}

/** Gunwale (sheer line) height above keel datum: rises to stern and bow. */
function shipSheer(t: number): number {
  const tt = clamp01(t);
  let y = SHIP_D + 0.45 * (2 * tt - 1) * (2 * tt - 1);
  if (tt < 0.32) y += 1.0 * Math.pow((0.32 - tt) / 0.32, 2);
  if (tt > 0.82) y += 0.5 * Math.pow((tt - 0.82) / 0.18, 2);
  return y;
}

/** Keel line with rocker toward the ends so the hull closes into stem and sternpost. */
function shipKeel(t: number): number {
  return 0.82 * SHIP_D * Math.pow(Math.abs(2 * clamp01(t) - 1), 4);
}

function shipX(t: number): number {
  return (t - 0.5) * SHIP_L;
}

/** Point on the hull skin; phi = -PI/2 port gunwale, 0 keel, +PI/2 starboard gunwale. */
function shipPoint(t: number, phi: number, out = 0): THREE.Vector3 {
  const hw = shipHalfBeam(t) + out;
  const top = shipSheer(t);
  const keel = shipKeel(t) - out;
  const z = hw * Math.sin(phi);
  const y = top - (top - keel) * Math.pow(Math.abs(Math.cos(phi)), 0.55);
  return new THREE.Vector3(shipX(t), y, z);
}

function hullShellGeometry(t0: number, t1: number, phi0: number, phi1: number, segU = 56, segV = 22): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segU; i++) {
    const t = t0 + ((t1 - t0) * i) / segU;
    for (let j = 0; j <= segV; j++) {
      const phi = phi0 + ((phi1 - phi0) * j) / segV;
      const p = shipPoint(t, phi);
      pos.push(p.x, p.y, p.z);
      uv.push(i / segU, j / segV);
    }
  }
  const row = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A horizontal plank surface inside the hull (deck or hold floor), following the sheer. */
function shipFloorGeometry(t0: number, t1: number, zSide: 'port' | 'both', yAt: (t: number) => number, widthAt: (t: number) => number, segU = 40): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const segV = 4;
  for (let i = 0; i <= segU; i++) {
    const t = t0 + ((t1 - t0) * i) / segU;
    const hw = widthAt(t);
    for (let j = 0; j <= segV; j++) {
      const s = j / segV;
      const z = zSide === 'port' ? -hw + hw * s : -hw + 2 * hw * s;
      pos.push(shipX(t), yAt(t), z);
      uv.push(i / segU, s);
    }
  }
  const row = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Roman iron-stocked anchor (shank, stock, two curved arms), built standing, ~1.9 m. */
function buildAnchor(iron: THREE.Material, wood: THREE.Material): THREE.Group {
  const a = new THREE.Group();
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.8, 10), iron);
  shank.position.y = 0.9;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.1), wood);
  stock.position.y = 1.62;
  stock.rotation.y = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 16), iron);
  ring.position.y = 1.88;
  const arms = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 20, Math.PI), iron);
  arms.rotation.z = Math.PI;
  arms.position.y = 0.6;
  a.add(shank, stock, ring, arms);
  for (const sx of [-1, 1]) {
    const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 4), iron);
    fluke.position.set(sx * 0.55, 0.66, 0);
    a.add(fluke);
  }
  return a;
}

function buildAmphora(clay: THREE.Material): THREE.Mesh {
  const prof = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.05, 0.04),
    new THREE.Vector2(0.17, 0.3),
    new THREE.Vector2(0.2, 0.55),
    new THREE.Vector2(0.15, 0.78),
    new THREE.Vector2(0.06, 0.88),
    new THREE.Vector2(0.06, 1.0),
  ];
  return new THREE.Mesh(new THREE.LatheGeometry(prof, 14), clay);
}

/** Small ship's boat (skaphe, Acts 27:16, 30), ~4.2 m. */
function buildSkiff(wood: THREE.Material): THREE.Group {
  const s = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    wood,
  );
  shell.scale.set(2.1, 0.55, 0.75);
  shell.position.y = 0.55;
  s.add(shell);
  for (let k = -1; k <= 1; k++) addBox(s, 0.12, 0.05, 1.3, wood, k * 0.8, 0.48, 0);
  return s;
}

/**
 * 1. Paul's Alexandrian grain ship (Acts 27:6, 37-44).
 *    'hull-cutaway' — the fourteenth night at anchor (27:27-29): starboard half cut
 *    away to show hold, grain sacks and amphorae (cargo still aboard before 27:38),
 *    frapping cables (27:17), skiff hoisted on deck (27:16-17), mainsail lowered,
 *    steering oars lashed up, and four anchors cast from the stern (27:29).
 *    'melita-reef' — the grounding at Malta (27:39-41): anchors cut loose and left
 *    on the bottom, rudder bands loosed, foresail hoisted to the wind (27:40), bow
 *    stuck fast on the bank where two seas meet, stern breaking up in the surf (27:41).
 *    Built to a 14.0 m display height (masthead); no dimension is stated in Acts.
 */
export function buildPaulShip(C: number, variant: PaulShipVariant = 'hull-cutaway'): THREE.Group {
  void C; // Unmeasured in Scripture: display scale from assumedHeight = 14.0 m
  const tex = getNtTex();
  const g = new THREE.Group();
  const reef = variant === 'melita-reef';

  const hullMat = std(0x9b6a40, { map: tex.hullPlank, roughness: 0.82, side: THREE.DoubleSide });
  const deckMat = std(0xb88a5a, { map: tex.hullPlank, roughness: 0.85, side: THREE.DoubleSide });
  const darkWood = std(0x4a2f1a, { roughness: 0.8 });
  const rope = std(0xc8ad78, { roughness: 0.95 });
  const iron = std(0x3b3b40, { metalness: 0.7, roughness: 0.5 });
  const sailMat = std(0xe8dcc0, { map: tex.sail, roughness: 0.9, side: THREE.DoubleSide });
  const sackMat = std(0xcdb88c, { roughness: 0.95 });
  const clay = std(0xb5643a, { roughness: 0.8 });
  const gilt = goldMat();
  const sea = std(0x1f5f7a, {
    emissive: 0x0a2836, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.15,
    transparent: true, opacity: 0.42, depthWrite: false,
  });
  const foam = std(0xf3f8fb, { roughness: 0.6, transparent: true, opacity: 0.85 });

  // --- Sea (display depth compressed: the soundings of 27:28 were 37 m and 28 m) ---
  const seaH = reef ? 1.5 : 2.3;
  const seaLen = SHIP_L * 1.9;
  const seaWid = SHIP_B * 3.2;
  const seaBlock = new THREE.Mesh(new THREE.BoxGeometry(seaLen, seaH, seaWid), sea);
  seaBlock.position.set(-SHIP_L * 0.15, seaH / 2, 0);
  seaBlock.userData.water = 1;
  g.add(seaBlock);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(seaLen, 0.06, seaWid), std(0xa8956d, { map: tex.sand, roughness: 0.95 }));
  bed.position.set(-SHIP_L * 0.15, 0.03, 0);
  g.add(bed);

  // --- The ship itself, built around its keel datum ---
  const ship = new THREE.Group();
  const draft = 1.9;
  // Keel datum above the sea floor: afloat at anchor; aground, the hull rides high on the bank
  const keelDatum = reef ? 0.72 : seaH - draft;
  const t0 = reef ? 0.07 : 0; // in the reef view the stern has broken away (27:41)
  const phiEnd = reef ? Math.PI / 2 : 0; // cutaway keeps only the port half

  ship.add(new THREE.Mesh(hullShellGeometry(t0, 1, -Math.PI / 2, phiEnd), hullMat));

  // Wale / rubbing strakes along the outside of the sheer
  for (const drop of [0.25, 0.9]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = t0 + ((1 - t0) * i) / 24;
      const p = shipPoint(t, -Math.PI / 2, 0.05);
      p.y -= drop;
      pts.push(p);
    }
    ship.add(tube(pts, 0.09, darkWood, 48));
    if (reef) {
      ship.add(tube(pts.map((p) => new THREE.Vector3(p.x, p.y, -p.z)), 0.09, darkWood, 48));
    }
  }

  // Keel timber
  const keelPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) keelPts.push(shipPoint(t0 + ((1 - t0) * i) / 20, 0, 0.06));
  ship.add(tube(keelPts, 0.14, darkWood, 40));

  // Decks and hold floor
  const deckY = (t: number) => shipSheer(t) - 0.32;
  const deckW = (t: number) => shipHalfBeam(t) * 0.97;
  ship.add(new THREE.Mesh(shipFloorGeometry(Math.max(t0, 0.03), 0.97, reef ? 'both' : 'port', deckY, deckW), deckMat));
  if (!reef) {
    const holdY = (t: number) => shipKeel(t) + 0.55;
    const holdW = (t: number) => shipHalfBeam(t) * 0.62;
    ship.add(new THREE.Mesh(shipFloorGeometry(0.16, 0.86, 'port', holdY, holdW), deckMat));

    // Frames (ribs) seen in section
    for (let k = 1; k < 14; k++) {
      const t = 0.07 + (k / 14) * 0.86;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 10; j++) pts.push(shipPoint(t, -Math.PI / 2 + (j / 10) * (Math.PI / 2), -0.08));
      ship.add(tube(pts, 0.07, darkWood, 16));
    }

    // Grain sacks (Alexandrian wheat, 27:38 had not yet happened) and amphorae
    const sackGeo = new THREE.SphereGeometry(0.32, 10, 8);
    for (let i = 0; i < 9; i++) {
      for (let r = 0; r < 3; r++) {
        for (let layer = 0; layer < 2; layer++) {
          const t = 0.33 + i * 0.04;
          const sack = new THREE.Mesh(sackGeo, sackMat);
          sack.scale.set(1.25, 0.62, 0.9);
          sack.position.set(shipX(t), shipKeel(t) + 0.55 + 0.2 + layer * 0.38, -0.35 - r * 0.62);
          ship.add(sack);
        }
      }
    }
    for (let i = 0; i < 10; i++) {
      const t = 0.69 + (i % 5) * 0.03;
      const amph = buildAmphora(clay);
      amph.position.set(shipX(t), shipKeel(t) + 0.55, -0.45 - Math.floor(i / 5) * 0.55);
      ship.add(amph);
    }
    for (let i = 0; i < 6; i++) {
      const t = 0.2 + (i % 3) * 0.035;
      const amph = buildAmphora(clay);
      amph.position.set(shipX(t), shipKeel(t) + 0.55, -0.45 - Math.floor(i / 3) * 0.6);
      ship.add(amph);
    }
  }

  // Frapping cables passed under the hull (hypozomata, 27:17)
  for (const t of [0.3, 0.44, 0.58, 0.72]) {
    const pts: THREE.Vector3[] = [];
    const steps = 14;
    for (let j = 0; j <= steps; j++) pts.push(shipPoint(t, -Math.PI / 2 + (j / steps) * (phiEnd + Math.PI / 2), 0.07));
    ship.add(tube(pts, 0.05, rope, 28));
  }

  // Swan-neck sternpost (chenikos), gilded goose head
  const sternT = 0.0;
  const sx0 = shipX(sternT);
  const sy0 = shipSheer(sternT);
  const swanPts = [
    new THREE.Vector3(sx0 + 0.6, sy0 - 1.0, 0),
    new THREE.Vector3(sx0 - 0.3, sy0 + 0.3, 0),
    new THREE.Vector3(sx0 - 0.6, sy0 + 1.8, 0),
    new THREE.Vector3(sx0 + 0.1, sy0 + 2.9, 0),
    new THREE.Vector3(sx0 + 0.9, sy0 + 3.0, 0),
  ];
  const swan = new THREE.Group();
  swan.add(tube(swanPts, 0.17, darkWood, 36));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), gilt);
  head.position.copy(swanPts[4]!);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 8), gilt);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(swanPts[4]!.x + 0.36, swanPts[4]!.y - 0.04, 0);
  swan.add(head, beak);
  if (reef) {
    // Broken off with the stern and lying flat in the surf astern (27:41)
    swan.position.set(-swanPts[0]!.x, -swanPts[0]!.y, 0);
    const fallen = new THREE.Group();
    fallen.add(swan);
    fallen.rotation.x = Math.PI * 0.46;
    fallen.rotation.y = 0.35;
    fallen.position.set(sx0 - 2.6, seaH + 0.12, 2.2);
    fallen.userData.water = 25;
    g.add(fallen);
  } else {
    ship.add(swan);
  }

  // Bow stem and cutwater
  const bx = shipX(1);
  ship.add(tube([
    new THREE.Vector3(bx - 1.2, shipKeel(0.95), 0),
    new THREE.Vector3(bx + 0.1, shipSheer(1) - 0.8, 0),
    new THREE.Vector3(bx + 0.35, shipSheer(1) + 0.4, 0),
  ], 0.14, darkWood, 20));

  // Stern cabin (port half only in the cutaway)
  const cabT = 0.13;
  const cabW = shipHalfBeam(cabT) * 0.75;
  const cabin = addBox(ship, 2.6, 1.7, reef ? cabW * 2 : cabW, std(0x8e6a46, { map: tex.hullPlank, roughness: 0.8 }),
    shipX(cabT), deckY(cabT) + 0.85, reef ? 0 : -cabW / 2);
  addBox(ship, 3.0, 0.14, (reef ? cabW * 2 : cabW) + 0.3, darkWood, cabin.position.x, deckY(cabT) + 1.77, cabin.position.z);

  // Twin steering oars on the quarters (27:40)
  for (const side of reef ? [-1, 1] : [-1]) {
    const t = 0.1;
    const hw = shipHalfBeam(t) + 0.25;
    const oar = new THREE.Group();
    const loom = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.4, 10), darkWood);
    loom.position.y = -2.4;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.9, 0.12), darkWood);
    blade.position.y = -4.6;
    oar.add(loom, blade);
    oar.position.set(shipX(t), shipSheer(t) + 0.3, side * hw);
    // Lashed up at anchor; rudder bands loosed and blades dropped for the run ashore (27:40)
    oar.rotation.z = reef ? -0.8 : -1.15;
    ship.add(oar);
  }

  // Mainmast, yard and sail
  const mastT = 0.55;
  const mastBaseY = shipKeel(mastT) + 0.4;
  const mastTopY = 14.0 - keelDatum - (reef ? 0.58 : 0); // masthead at ~14.0 m display height above seabed
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, mastTopY - mastBaseY, 14), darkWood);
  mast.position.set(shipX(mastT), (mastTopY + mastBaseY) / 2, 0);
  ship.add(mast);
  const yardY = reef ? mastTopY - 1.6 : deckY(mastT) + 3.2; // yard lowered at anchor (27:17 "lowered the gear")
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, SHIP_B * 2.1, 10), darkWood);
  yard.rotation.x = Math.PI / 2;
  yard.position.set(shipX(mastT) + 0.25, yardY, 0);
  ship.add(yard);
  const furl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, SHIP_B * 1.9, 12), sailMat);
  furl.rotation.x = Math.PI / 2;
  furl.position.set(shipX(mastT) + 0.45, yardY - 0.25, 0);
  ship.add(furl);
  // Stays and halyards
  ship.add(tube([new THREE.Vector3(shipX(mastT), mastTopY, 0), new THREE.Vector3(shipX(0.98), shipSheer(0.98), 0)], 0.03, rope, 4));
  ship.add(tube([new THREE.Vector3(shipX(mastT), mastTopY, 0), new THREE.Vector3(shipX(0.08), shipSheer(0.08), 0)], 0.03, rope, 4));
  for (const s of [-1, 1]) {
    ship.add(tube([new THREE.Vector3(shipX(mastT), mastTopY - 0.6, 0), new THREE.Vector3(shipX(mastT - 0.04), shipSheer(mastT), s * shipHalfBeam(mastT))], 0.025, rope, 4));
  }

  // Raked foremast with the foresail (artemon) — hoisted to the wind in 27:40
  const foreT = 0.9;
  const fore = new THREE.Group();
  fore.position.set(shipX(foreT), deckY(foreT), 0);
  fore.rotation.z = -0.5;
  const foreMast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.2, 10), darkWood);
  foreMast.position.y = 2.6;
  const foreYard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 8), darkWood);
  foreYard.rotation.x = Math.PI / 2;
  foreYard.position.set(0.15, 4.9, 0);
  fore.add(foreMast, foreYard);
  if (reef) {
    const foresail = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2, 6, 6), sailMat);
    const p = foresail.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / 1.2;
      p.setZ(i, (1 - u * u) * 0.45); // bellied by the wind
    }
    p.needsUpdate = true;
    foresail.geometry.computeVertexNormals();
    foresail.rotation.y = Math.PI / 2;
    foresail.position.set(0.4, 3.25, 0);
    fore.add(foresail);
  } else {
    const ff = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 10), sailMat);
    ff.rotation.x = Math.PI / 2;
    ff.position.set(0.3, 4.75, 0);
    fore.add(ff);
  }
  ship.add(fore);

  // Four anchors cast out of the stern (27:29) / cut loose and left in the sea (27:40)
  const sternX = shipX(0.04);
  const anchorPts: Array<[number, number]> = [[-6.5, -3.4], [-7.6, -1.1], [-7.6, 1.1], [-6.5, 3.4]];

  if (!reef) {
    // Skiff hoisted aboard (27:16-17), lashed on the port side of the deck
    const skiff = buildSkiff(std(0x7a5233, { roughness: 0.85, side: THREE.DoubleSide }));
    skiff.position.set(shipX(0.33), deckY(0.33), -1.5);
    ship.add(skiff);
  }

  // Ship placement on its keel datum; aground, the bow is pitched up onto the bank (27:41)
  ship.position.y = keelDatum;
  if (reef) {
    ship.rotation.z = 0.05;
  }
  g.add(ship);

  // Anchors lying on the sea floor astern, with cables
  const anchorGroupX = sternX;
  anchorPts.forEach(([dx, dz], i) => {
    const anc = buildAnchor(iron, darkWood);
    anc.rotation.z = Math.PI / 2;
    anc.rotation.y = i * 0.3 - 0.45;
    anc.position.set(anchorGroupX + dx, 0.66, dz); // arms resting on the bed
    g.add(anc);
    const ringPos = new THREE.Vector3(anchorGroupX + dx + 1.85, 0.2, dz);
    if (!reef) {
      const hawse = new THREE.Vector3(sternX + 0.3, ship.position.y + shipSheer(0.04) - 0.5, dz * 0.25);
      g.add(tube([ringPos, new THREE.Vector3((ringPos.x + hawse.x) / 2, seaH * 0.45, dz * 0.6), hawse], 0.04, rope, 16));
    } else {
      // Cut cable ends trailing from each anchor (27:40)
      g.add(tube([ringPos, new THREE.Vector3(ringPos.x + 1.2, 0.5, dz * 0.9), new THREE.Vector3(ringPos.x + 1.8, 0.9, dz * 0.85)], 0.04, rope, 8));
    }
  });

  if (reef) {
    // Sandbank / reef under the bow: "a place where two seas met" (27:41)
    const bankMat = std(0xc2ab7e, { map: tex.sand, roughness: 0.95 });
    const bank = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), bankMat);
    bank.scale.set(9.5, seaH + 0.35, 7.0);
    bank.position.set(shipX(0.9), 0, 0);
    g.add(bank);
    const reefStone = std(0x6f6556, { roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + (i % 3) * 0.25, 0), reefStone);
      const a = (i / 9) * Math.PI * 2;
      r.position.set(shipX(0.9) + Math.cos(a) * 6.5, seaH * 0.7, Math.sin(a) * 4.8);
      g.add(r);
    }

    // Two wave-trains meeting astern; surf breaking on the shattered stern
    for (let k = 0; k < 6; k++) {
      for (const dir of [-1, 1]) {
        const crest = new THREE.Mesh(new THREE.TorusGeometry(4.2 + k * 1.1, 0.09, 6, 32, Math.PI * 0.45), foam);
        crest.rotation.x = -Math.PI / 2;
        crest.rotation.z = dir > 0 ? Math.PI * 0.62 : Math.PI * 0.93;
        crest.position.set(sternX - 1, seaH + 0.04, dir * 2.5);
        crest.userData.water = k + 2;
        g.add(crest);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const spray = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + (i % 3) * 0.15, 0), foam);
      spray.position.set(shipX(0.07) + Math.cos(a) * 1.2, seaH + 0.25 + (i % 4) * 0.25, Math.sin(a) * 3.2);
      spray.userData.water = 10 + i;
      g.add(spray);
    }
    // Splintered planks and stern timbers adrift (27:41, 44 "on planks or on pieces of the ship")
    for (let i = 0; i < 14; i++) {
      const plank = addBox(g, 2.2 + (i % 4) * 0.6, 0.1, 0.3, hullMat,
        sternX - 1.5 - (i % 5) * 1.6, seaH + 0.04, -4.5 + i * 0.7);
      plank.rotation.y = i * 0.9;
      plank.userData.water = 30 + i;
    }
    // Jagged broken strake ends at the torn stern
    for (let j = 0; j < 9; j++) {
      const phi = -Math.PI / 2 + (j / 8) * Math.PI;
      const p = shipPoint(t0, phi);
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9 + (j % 3) * 0.4, 4), darkWood);
      shard.rotation.z = Math.PI / 2;
      shard.position.set(p.x - 0.3, p.y + ship.position.y, p.z);
      g.add(shard);
    }
  }

  return seatOnGround(g);
}

// ---------------------------------------------------------------------------
// 2. The throne room of Revelation 4
// ---------------------------------------------------------------------------

/** Pedestal lamp of fire (Rev 4:5), ~1.25 m. */
function buildFireLamp(gold: THREE.Material, fire: THREE.Material, seed: number): THREE.Group {
  const l = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.08, 16), gold);
  foot.position.y = 0.04;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 12), gold);
  shaft.position.y = 0.53;
  const knop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), gold);
  knop.position.y = 0.6;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gold);
  bowl.rotation.x = Math.PI;
  bowl.position.y = 1.18;
  bowl.scale.y = 0.7;
  l.add(foot, shaft, knop, bowl);
  addFlame(l, 0.12, 0.42, fire, 0, 1.12, 0, seed);
  return l;
}

/** Golden victor's crown (stephanos, Rev 4:4, 10): a wreath band with eight points. */
function buildCrown(gold: THREE.MeshStandardMaterial, seed: number): THREE.Group {
  const c = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 24), gold);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.03;
  band.userData.shimmer = seed;
  c.add(band);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.1, 4), gold);
    leaf.position.set(Math.cos(a) * 0.13, 0.1, Math.sin(a) * 0.13);
    c.add(leaf);
  }
  return c;
}

/**
 * One living creature as an emblem-pillar (Rev 4:6-8): six wings in three pairs,
 * eye-studs before and behind, crowned by a non-figurative emblem of its likeness
 * (4:7: lion, ox, face as a man, flying eagle). No body or face is modelled.
 */
function buildLivingCreatureEmblem(
  emblem: 'lion' | 'ox' | 'man' | 'eagle',
  gold: THREE.Material,
  body: THREE.Material,
  wing: THREE.Material,
  eye: THREE.Material,
  pupil: THREE.Material,
): THREE.Group {
  const c = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.16, 16), gold);
  base.position.y = 0.08;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.7, 14), body);
  column.position.y = 1.0;
  c.add(base, column);

  // Six wings: three pairs, upper / middle / lower (4:8)
  const pairs = [
    { y: 1.75, rz: 0.75, len: 1.1 },
    { y: 1.35, rz: 0.15, len: 1.0 },
    { y: 0.95, rz: -0.45, len: 0.85 },
  ];
  pairs.forEach((p, pi) => {
    for (const s of [-1, 1]) {
      const wg = new THREE.Group();
      wg.position.set(s * 0.18, p.y, 0);
      wg.rotation.z = s * p.rz;
      wg.rotation.y = s * -0.25;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(p.len, 0.26 - pi * 0.04, 0.04), wing);
      blade.position.x = s * p.len * 0.5;
      wg.add(blade);
      // "full of eyes all around and within" (4:8)
      for (let e = 0; e < 3; e++) {
        for (const fz of [-1, 1]) {
          const ey = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eye);
          ey.scale.z = 0.5;
          ey.position.set(s * p.len * (0.3 + e * 0.25), 0, fz * 0.03);
          const pu = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), pupil);
          pu.position.set(ey.position.x, 0, fz * 0.045);
          wg.add(ey, pu);
        }
      }
      c.add(wg);
    }
  });
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r * 0.5;
      const rad = 0.29 - r * 0.025;
      const ey = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eye);
      ey.position.set(Math.cos(a) * rad, 0.4 + r * 0.38, Math.sin(a) * rad);
      c.add(ey);
    }
  }

  // Four-sided emblem capital (4 directional relief bosses + primary Rev 4:7 crest)
  const capital = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.46), body);
  capital.position.y = 1.94;
  const capRim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.52), gold);
  capRim.position.y = 2.08;
  c.add(capital, capRim);
  for (let q = 0; q < 4; q++) {
    const qa = (q * Math.PI) / 2;
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), gold);
    boss.rotation.z = Math.PI / 2;
    boss.rotation.y = qa;
    boss.position.set(Math.cos(qa) * 0.24, 1.94, Math.sin(qa) * 0.24);
    c.add(boss);
  }
  const top = 2.11;
  if (emblem === 'lion') {
    const mane = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 10, 20), gold);
    mane.position.y = top + 0.26;
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), body);
    core.position.y = top + 0.26;
    c.add(mane, core);
  } else if (emblem === 'ox') {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), body);
    block.position.y = top + 0.15;
    const horns = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 16, Math.PI), gold);
    horns.position.y = top + 0.26;
    c.add(block, horns);
  } else if (emblem === 'man') {
    // A plain gold medallion, deliberately featureless
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), gold);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = top + 0.24;
    c.add(disc);
  } else {
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 4), gold);
    crest.rotation.x = Math.PI / 2;
    crest.position.set(0, top + 0.2, 0.12);
    const spread = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.14), body);
    spread.position.y = top + 0.12;
    c.add(crest, spread);
  }
  return c;
}

/**
 * 2. The throne room of Revelation 4:2-11.
 *    Strictly aniconic: the throne is empty of any figure; the One seated is shown
 *    only as jasper-and-carnelian radiance (4:3) beneath an emerald rainbow that
 *    encircles the throne. Seven lamps of fire burn before it (4:5); four
 *    six-winged living creatures stand around it as emblem-pillars (4:6-8); and
 *    24 white seats each hold a golden crown (4:4, 10) with no seated statue.
 *    Built to an 8.5 m display height (top of the rainbow).
 */
export function buildRev4ThroneRoom(C: number, variant: Rev4ThroneVariant = 'full-council'): THREE.Group {
  void C; // Unmeasured vision: display scale from assumedHeight = 8.5 m
  const tex = getNtTex();
  const g = new THREE.Group();
  const full = variant === 'full-council';

  const gold = goldMat();
  const fire = flameMat();
  const glassSea = std(0xd9f4ff, {
    emissive: 0x2f7fa8, emissiveIntensity: 0.22, metalness: 0.55, roughness: 0.04,
    transparent: true, opacity: 0.72,
  });
  const jasper = std(0xeefcf3, {
    emissive: 0x9fe8c4, emissiveIntensity: 0.4, metalness: 0.25, roughness: 0.08,
    transparent: true, opacity: 0.68,
  });
  const carnelian = std(0xd8452e, {
    emissive: 0x8a1a0c, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.15,
    transparent: true, opacity: 0.85,
  });
  const emerald = std(0x1fd17a, {
    emissive: 0x0d8a4a, emissiveIntensity: 0.8, roughness: 0.15, metalness: 0.2,
    transparent: true, opacity: 0.6,
  });
  const lightning = std(0xf4f7ff, { emissive: 0xbcd4ff, emissiveIntensity: 1.3, roughness: 0.2 });
  const linen = std(0xf6f3ec, { map: tex.linen, roughness: 0.88 });
  const marble = std(0xe9e6df, { roughness: 0.5, metalness: 0.05 });

  // --- Sea of glass, clear as crystal (4:6) ---
  const seaR = full ? 7.0 : 4.3;
  const seaH = 0.16;
  const sea = new THREE.Mesh(new THREE.CylinderGeometry(seaR, seaR + 0.1, seaH, 64), glassSea);
  sea.position.y = seaH / 2;
  sea.userData.water = 1;
  g.add(sea);
  const seaRim = new THREE.Mesh(new THREE.TorusGeometry(seaR + 0.05, 0.05, 8, 64), gold);
  seaRim.rotation.x = Math.PI / 2;
  seaRim.position.y = seaH;
  g.add(seaRim);

  // --- Stepped dais of carnelian and jasper ---
  const steps: Array<[number, THREE.Material]> = [[1.9, carnelian], [1.55, jasper], [1.2, carnelian]];
  let y = seaH;
  for (const [r, m] of steps) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22, 40), m);
    st.position.y = y + 0.11;
    g.add(st);
    y += 0.22;
  }
  const daisTop = y;

  // --- The throne: stone and light, no figure ---
  const tz = -0.25;
  addBox(g, 1.4, 0.5, 1.1, jasper, 0, daisTop + 0.25, tz);
  addBox(g, 1.5, 0.08, 1.2, carnelian, 0, daisTop + 0.54, tz);
  const back = addBox(g, 1.4, 2.5, 0.22, jasper, 0, daisTop + 1.8, tz - 0.5);
  void back;
  addBox(g, 1.55, 0.14, 0.3, carnelian, 0, daisTop + 3.1, tz - 0.5);
  for (const s of [-1, 1]) {
    addBox(g, 0.16, 0.5, 1.0, carnelian, s * 0.72, daisTop + 0.83, tz);
  }

  // Radiance above the empty seat: jasper-white core, carnelian aura (4:3)
  const gloryY = daisTop + 1.75;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 2), std(0xffffff, { emissive: 0xe9fff4, emissiveIntensity: 1.5, roughness: 0.1 }));
  core.position.set(0, gloryY, tz);
  core.userData.ember = 1;
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), std(0xff7a5c, {
    emissive: 0xd8452e, emissiveIntensity: 0.9, transparent: true, opacity: 0.3, roughness: 0.2, depthWrite: false,
  }));
  aura.position.copy(core.position);
  aura.userData.ember = 2;
  g.add(core, aura);
  // Column of light rising from the throne
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 5.2, 24, 1, true), std(0xfffbe8, {
    emissive: 0xfff2c4, emissiveIntensity: 1.0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
  }));
  beam.position.set(0, daisTop + 3.2, tz);
  g.add(beam);
  // Radiating rays (geometric starburst)
  for (let r = 0; r < 12; r++) {
    const a = (r / 12) * Math.PI * 2;
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.04, 1.3, 6), lightning);
    ray.position.set(Math.cos(a) * 0.95, gloryY + Math.sin(a) * 0.95, tz);
    ray.rotation.z = a - Math.PI / 2;
    g.add(ray);
  }

  // Lightnings proceeding from the throne (4:5): zig-zag bolts
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2 + 0.3;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < 6; k++) {
      const rr = 1.1 + k * 0.35;
      const jitter = (k % 2 === 0 ? 0.18 : -0.18);
      pts.push(new THREE.Vector3(Math.cos(a + jitter * 0.4) * rr, gloryY + 0.8 + k * 0.32 + jitter, tz + Math.sin(a + jitter * 0.4) * rr * 0.6));
    }
    const bolt = tube(pts, 0.025, lightning, 24);
    bolt.userData.ember = 3 + b;
    g.add(bolt);
  }

  // --- Emerald rainbow encircling the throne (4:3): top of outer band = 8.5 m ---
  const bowR = 3.55;
  const bowTube = 0.11;
  const bowCY = 8.5 - bowR - bowTube;
  const bow = new THREE.Mesh(new THREE.TorusGeometry(bowR, bowTube, 14, 96), emerald);
  bow.position.set(0, bowCY, tz - 0.2);
  bow.userData.orbitGlow = 2;
  const bowInner = new THREE.Mesh(new THREE.TorusGeometry(bowR - 0.28, 0.05, 10, 96), std(0x7dffc0, {
    emissive: 0x2fd98a, emissiveIntensity: 0.7, transparent: true, opacity: 0.45, roughness: 0.15,
  }));
  bowInner.position.copy(bow.position);
  bowInner.userData.orbitGlow = 3;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.06, 10, 72), emerald);
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, daisTop + 0.05, tz);
  g.add(bow, bowInner, halo);

  // --- Seven lamps of fire burning before the throne (4:5) ---
  const lampR = full ? 3.35 : 2.7;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI / 2 + (i - 3) * 0.24;
    const lamp = buildFireLamp(gold, fire, i + 1);
    lamp.position.set(Math.cos(a) * lampR, seaH, tz + Math.sin(a) * lampR);
    g.add(lamp);
  }

  if (!full) return seatOnGround(g);

  // --- Four living creatures around the throne at the four cardinal axes (4:6-8) ---
  const body = std(0xf1e2b8, { emissive: 0x4a3a12, emissiveIntensity: 0.15, metalness: 0.5, roughness: 0.3 });
  const wing = std(0xfff5d6, { emissive: 0x6b5514, emissiveIntensity: 0.18, metalness: 0.6, roughness: 0.25, side: THREE.DoubleSide });
  const eye = std(0xbff4ff, { emissive: 0x4fc3e0, emissiveIntensity: 0.6, roughness: 0.1 });
  const pupil = std(0x0d1a26, { roughness: 0.2 });
  const emblems: Array<'lion' | 'ox' | 'man' | 'eagle'> = ['lion', 'ox', 'man', 'eagle'];
  emblems.forEach((em, i) => {
    const a = (i * Math.PI) / 2;
    const cr = buildLivingCreatureEmblem(em, gold, body, wing, eye, pupil);
    cr.position.set(Math.cos(a) * 2.35, seaH, tz + Math.sin(a) * 2.35);
    cr.rotation.y = -a - Math.PI / 2;
    g.add(cr);
  });

  // --- 24 seats in a white marble ring, each holding a golden crown (4:4, 10) ---
  const ringIn = 4.6;
  const ringOut = 6.6;
  const ringStep = new THREE.Mesh(new THREE.RingGeometry(ringIn, ringOut, 72), marble);
  ringStep.rotation.x = -Math.PI / 2;
  ringStep.position.y = seaH + 0.22;
  const ringWall = new THREE.Mesh(new THREE.CylinderGeometry(ringOut, ringOut, 0.22, 72, 1, true), marble);
  ringWall.position.y = seaH + 0.11;
  const ringWallIn = new THREE.Mesh(new THREE.CylinderGeometry(ringIn, ringIn, 0.22, 72, 1, true), marble);
  ringWallIn.position.y = seaH + 0.11;
  g.add(ringStep, ringWall, ringWallIn);

  const seatBase = seaH + 0.22;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + Math.PI / 24;
    const seat = new THREE.Group();
    addBox(seat, 0.8, 0.46, 0.66, linen, 0, 0.23, 0);
    addBox(seat, 0.84, 0.05, 0.7, gold, 0, 0.485, 0);
    addBox(seat, 0.8, 1.0, 0.12, linen, 0, 0.96, -0.3);
    addBox(seat, 0.86, 0.06, 0.16, gold, 0, 1.49, -0.3);
    const crown = buildCrown(gold, i + 1);
    crown.position.set(0, 0.51, 0.04);
    seat.add(crown);
    const rr = (ringIn + ringOut) / 2;
    seat.position.set(Math.cos(a) * rr, seatBase, tz + Math.sin(a) * rr);
    // face the throne: local +Z points to centre
    seat.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
    g.add(seat);
  }

  return seatOnGround(g);
}

// ---------------------------------------------------------------------------
// 3. The seven golden lampstands (Revelation 1:12-20)
// ---------------------------------------------------------------------------

/** One freestanding single-lamp golden lampstand (lychnia), ~1.5 m. */
function buildChurchLampstand(gold: THREE.MeshStandardMaterial, fire: THREE.Material, seed: number): THREE.Group {
  const l = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), gold);
    foot.position.set(Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.26, 8), gold);
    leg.position.set(Math.cos(a) * 0.1, 0.16, Math.sin(a) * 0.1);
    leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    l.add(foot, leg);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 16), gold);
  plate.position.y = 0.3;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.02, 12), gold);
  shaft.position.y = 0.82;
  l.add(plate, shaft);
  for (const ky of [0.55, 0.85, 1.15]) {
    const knop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), gold);
    knop.scale.y = 0.75;
    knop.position.y = ky;
    knop.userData.shimmer = seed;
    l.add(knop);
  }
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.06, 0.07, 18), gold);
  pan.position.y = 1.36;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), gold);
  lamp.scale.set(1.3, 0.55, 1);
  lamp.position.y = 1.43;
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 8), gold);
  nozzle.rotation.z = -Math.PI / 2;
  nozzle.position.set(0.12, 1.44, 0);
  l.add(pan, lamp, nozzle);
  addFlame(l, 0.035, 0.13, fire, 0.15, 1.45, 0, seed);
  return l;
}

function buildStarCrystal(mat: THREE.Material, seed: number): THREE.Group {
  const s = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), mat);
  core.userData.ember = seed;
  s.add(core);
  for (let k = 0; k < 4; k++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.36, 4), mat);
    spike.rotation.z = (k * Math.PI) / 4;
    s.add(spike);
  }
  return s;
}

/**
 * 3. The seven golden lampstands (Rev 1:12-20).
 *    'seven-churches' — seven separate lampstands in an open arc, with only light in
 *    their midst (1:13, 16: "his face was like the sun shining in all its
 *    brilliance") and seven star-crystals above (1:16, 20). No figure, face or body.
 *    'compare-menorah' — the seven church lampstands in a row beside the single
 *    seven-lamp menorah of Exodus 25:31-37 on one platform.
 *    Built to a 3.0 m display height (top star); no dimension is stated.
 */
export function buildSevenLampstands(C: number, variant: SevenLampstandsVariant = 'seven-churches'): THREE.Group {
  void C; // Unmeasured: display scale from assumedHeight = 3.0 m
  const g = new THREE.Group();
  const gold = goldMat();
  const fire = flameMat();
  const stoneMat = std(0x2a2f3a, { roughness: 0.75, metalness: 0.1 });
  const starMat = std(0xf2f8ff, { emissive: 0xbfe0ff, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.3 });

  if (variant === 'compare-menorah') {
    const platH = 0.12;
    addBox(g, 7.0, platH, 2.4, stoneMat, 0, platH / 2, 0);
    // Gold inlay line separating the two passages
    addBox(g, 0.04, 0.01, 2.2, gold, 0.55, platH + 0.005, 0);
    for (let i = 0; i < 7; i++) {
      const ls = buildChurchLampstand(gold, fire, i + 1);
      ls.position.set(-3.0 + i * 0.52, platH, 0);
      g.add(ls);
    }
    // Exodus 25 menorah at its traditional 1.5 m, with seven flames as build.ts lights it
    const h = 1.5;
    const { group: menorah } = buildMenorah(h, 'arch');
    const unit = h / 8.6;
    const topY = unit * 7.5;
    const xs = [0];
    for (let pair = 0; pair < 3; pair++) {
      const r = unit * (2.15 + pair * 0.78);
      xs.push(-r, r);
    }
    xs.forEach((bx, idx) => {
      addFlame(menorah, unit * 0.1, unit * 0.42, fire, bx + unit * 0.25, topY + unit * 0.13, 0, idx + 11);
    });
    menorah.updateMatrixWorld(true);
    const mb = new THREE.Box3().setFromObject(menorah);
    menorah.position.set(2.0, platH - mb.min.y, 0);
    g.add(menorah);
    return seatOnGround(g);
  }

  // --- 'seven-churches' ---
  const platH = 0.1;
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.8, platH, 64), stoneMat);
  plat.position.y = platH / 2;
  g.add(plat);
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.025, 6, 96), gold);
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = platH + 0.01;
  g.add(inlay);

  // Seven lampstands in an arc open toward the viewer (+Z)
  const arcR = 2.9;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 1.5 + ((i - 3) / 3) * (Math.PI * 0.68);
    const ls = buildChurchLampstand(gold, fire, i + 1);
    ls.position.set(Math.cos(a) * arcR, platH, Math.sin(a) * arcR);
    ls.rotation.y = -a;
    g.add(ls);
  }

  // Light in the midst of the lampstands (1:13, 16): sun-bright sphere and rays only
  const lightY = 1.6;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.38, 28, 20), std(0xfffef2, {
    emissive: 0xfff3b0, emissiveIntensity: 1.6, roughness: 0.1,
  }));
  sun.position.y = lightY;
  sun.userData.ember = 1;
  const corona = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 20), std(0xffe28a, {
    emissive: 0xffb81c, emissiveIntensity: 1.0, transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false,
  }));
  corona.position.y = lightY;
  corona.userData.ember = 2;
  g.add(sun, corona);
  const rayMat = std(0xfff6cf, { emissive: 0xffd24a, emissiveIntensity: 1.3, roughness: 0.2, transparent: true, opacity: 0.8 });
  const dirs: THREE.Vector3[] = [];
  for (let i = 0; i < 20; i++) {
    // golden-angle spiral for evenly spread rays in 3D
    const yy = 1 - (i + 0.5) * (2 / 20);
    const rr = Math.sqrt(1 - yy * yy);
    const th = i * 2.399963;
    dirs.push(new THREE.Vector3(Math.cos(th) * rr, yy, Math.sin(th) * rr));
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (const d of dirs) {
    const len = 0.7;
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.035, len, 6), rayMat);
    ray.quaternion.setFromUnitVectors(up, d.clone().multiplyScalar(-1));
    ray.position.set(d.x * (0.45 + len / 2), lightY + d.y * (0.45 + len / 2), d.z * (0.45 + len / 2));
    g.add(ray);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.02, 8, 64), rayMat);
  ring.position.y = lightY;
  ring.userData.orbitGlow = 1;
  g.add(ring);

  // Seven stars (1:16, 20): a small arc of star-crystals above, top at 3.0 m
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.15 + (i / 6) * Math.PI * 0.7;
    const star = buildStarCrystal(starMat, i + 3);
    star.position.set(Math.cos(a) * 0.9, 2.93 - Math.sin(a) * 0.25, 0.15);
    g.add(star);
  }

  return seatOnGround(g);
}

// ---------------------------------------------------------------------------
// 4. The upper room at Pentecost (Acts 1:13-15; 2:1-4)
// ---------------------------------------------------------------------------

/** Small wheel-made clay oil lamp with a flame at the nozzle. */
function buildClayLamp(clay: THREE.Material, fire: THREE.Material, seed: number): THREE.Group {
  const l = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), clay);
  body.scale.set(1.3, 0.5, 1);
  body.position.y = 0.035;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.07, 8), clay);
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.set(0.1, 0.035, 0);
  l.add(body, nozzle);
  addFlame(l, 0.02, 0.08, fire, 0.13, 0.05, 0, seed);
  return l;
}

/** Divided tongue of fire (Acts 2:3): two flames parting from one glowing root. */
function buildDividedTongue(fire: THREE.Material, glow: THREE.Material, seed: number): THREE.Group {
  const t = new THREE.Group();
  const root = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), glow);
  root.userData.ember = seed;
  t.add(root);
  for (const s of [-1, 1]) {
    const tilt = new THREE.Group();
    tilt.rotation.z = s * 0.32;
    addFlame(tilt, 0.07, 0.36, fire, 0, 0.02, 0, seed * 2 + (s > 0 ? 1 : 0));
    t.add(tilt);
  }
  return t;
}

/**
 * 4. The house of Acts 2:1-4, built as a 1st-century Jerusalem two-storey
 *    ashlar house with its upper room (hyperoon, Acts 1:13): exterior stone
 *    stair, barrel-vaulted ground hall, arcaded upper hall under cedar beams,
 *    clay oil lamps, and divided tongues of fire in the room.
 *    'cutaway-flames' removes the near wall and roof to look inside.
 *    'jerusalem-house' shows the whole house with its walled courtyard.
 *    No persons are modelled. Built to a 6.2 m display height (parapet top).
 */
export function buildPentecostRoom(C: number, variant: PentecostRoomVariant = 'cutaway-flames'): THREE.Group {
  void C; // Unmeasured: display scale from assumedHeight = 6.2 m
  const tex = getNtTex();
  const g = new THREE.Group();
  const cut = variant === 'cutaway-flames';

  const stone = std(0xd8ccb2, { map: tex.ashlar, roughness: 0.88 });
  const stoneDark = std(0xb4a68a, { map: tex.ashlar, roughness: 0.9 });
  const plaster = std(0xe6dccb, { roughness: 0.92, side: THREE.DoubleSide });
  const cedar = std(0x8a4f2c, { map: tex.cedar, roughness: 0.75 });
  const floorMat = std(0xc9b99a, { map: tex.sand, roughness: 0.95 });
  const opening = std(0x1d1712, { roughness: 1 });
  const clay = std(0xb06a3e, { roughness: 0.85 });
  const fire = flameMat();
  const glow = std(0xffe9a8, { emissive: 0xffa21f, emissiveIntensity: 1.3, roughness: 0.2 });

  const W = 12.0; // x
  const D = 9.0; // z
  const T = 0.5; // wall thickness
  const groundH = 2.9;
  const slab = 0.25;
  const upperH = 2.55;
  const roofSlab = 0.2;
  const parapet = 0.3;
  const upperFloorY = groundH + slab; // 3.15
  const roofY = upperFloorY + upperH; // 5.70
  const roofTop = roofY + roofSlab; // 5.90 (+0.30 parapet = 6.20)

  // Foundation / ground floor slab
  addBox(g, W + 0.4, 0.12, D + 0.4, stoneDark, 0, 0.06, 0);

  // --- Ground storey walls ---
  const wallZ = (z: number, h: number, y0: number, xLen = W) => addBox(g, xLen, h, T, stone, 0, y0 + h / 2, z);
  const wallX = (x: number, h: number, y0: number, zLen = D, zc = 0) => addBox(g, T, h, zLen, stone, x, y0 + h / 2, zc);
  wallZ(-D / 2 + T / 2, groundH, 0.12);
  wallX(-W / 2 + T / 2, groundH, 0.12);
  wallX(W / 2 - T / 2, groundH, 0.12);
  if (cut) {
    // Low cut stub of the near wall so the vaults read
    wallZ(D / 2 - T / 2, 0.6, 0.12);
  } else {
    wallZ(D / 2 - T / 2, groundH, 0.12);
    addBox(g, 1.2, 2.0, 0.06, opening, -2.0, 0.12 + 1.0, D / 2 + 0.01); // street door
  }

  // Barrel vaults of the ground hall running along x, on two pier rows
  const bayR = (D - 2 * T) / 6; // three bays across z
  for (let b = 0; b < 3; b++) {
    const zc = -D / 2 + T + bayR + b * 2 * bayR;
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(bayR, bayR, W - 2 * T, 24, 1, true, 0, Math.PI), plaster);
    // Theta 0..PI is the +x half of the cylinder; turning the axis onto x lifts that half to +y
    vault.rotation.z = Math.PI / 2;
    vault.position.set(0, groundH - bayR, zc);
    g.add(vault);
  }
  for (let r = 1; r < 3; r++) {
    const zc = -D / 2 + T + r * 2 * bayR;
    for (let k = 0; k < 5; k++) {
      const x = -W / 2 + T + 0.3 + (k * (W - 2 * T - 0.6)) / 4;
      addBox(g, 0.5, groundH - bayR - 0.12, 0.5, stoneDark, x, 0.12 + (groundH - bayR - 0.12) / 2, zc);
    }
  }

  // Upper floor slab (stone over the vaults), rear part only in cutaway so the vaults stay visible
  if (cut) {
    addBox(g, W, slab, D * 0.62, stone, 0, groundH + slab / 2, -D * 0.19);
    addBox(g, W, slab * 0.4, D * 0.38, cedar, 0, groundH + slab * 0.8, D * 0.31); // timber floor over the near bay
  } else {
    addBox(g, W, slab, D, stone, 0, groundH + slab / 2, 0);
  }
  addBox(g, W - 2 * T, 0.02, D - 2 * T, floorMat, 0, upperFloorY + 0.01, 0);

  // --- Upper storey (the hyperoon) ---
  wallZ(-D / 2 + T / 2, upperH, upperFloorY);
  if (cut) {
    // Side walls kept only on the rear half
    wallX(-W / 2 + T / 2, upperH, upperFloorY, D * 0.55, -D * 0.225);
    wallX(W / 2 - T / 2, upperH, upperFloorY, D * 0.55, -D * 0.225);
  } else {
    wallX(-W / 2 + T / 2, upperH, upperFloorY);
    wallX(W / 2 - T / 2, upperH, upperFloorY);
    wallZ(D / 2 - T / 2, upperH, upperFloorY);
    // Arched windows on the street front
    for (let k = -2; k <= 2; k++) {
      addBox(g, 0.7, 1.1, 0.06, opening, k * 2.2, upperFloorY + 1.1, D / 2 + 0.01);
      const arch = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16, 0, Math.PI), opening);
      arch.position.set(k * 2.2, upperFloorY + 1.65, D / 2 + 0.012);
      g.add(arch);
    }
  }
  // Rear-wall arched windows (seen from inside in the cutaway)
  for (let k = -2; k <= 2; k++) {
    addBox(g, 0.7, 1.1, 0.06, opening, k * 2.2, upperFloorY + 1.1, -D / 2 + T + 0.01);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16, 0, Math.PI), opening);
    arch.position.set(k * 2.2, upperFloorY + 1.65, -D / 2 + T + 0.012);
    g.add(arch);
  }
  // Upper door on the east wall, reached by the outer stair
  addBox(g, 0.06, 1.9, 1.0, opening, W / 2 + 0.01, upperFloorY + 0.95, -D / 2 + 1.6);

  // Central arcade of the upper hall: columns and arches carrying the beams
  const arcadeZ = 0;
  const colXs = [-3.6, -1.2, 1.2, 3.6];
  for (const cx of colXs) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, upperH - 0.5, 14), stone);
    col.position.set(cx, upperFloorY + (upperH - 0.5) / 2, arcadeZ);
    const cap = addBox(g, 0.5, 0.14, 0.5, stoneDark, cx, upperFloorY + upperH - 0.43, arcadeZ);
    void cap;
    g.add(col);
  }
  const arcXs = [-W / 2 + T, ...colXs, W / 2 - T];
  for (let i = 0; i < arcXs.length - 1; i++) {
    const x0 = arcXs[i]!;
    const x1 = arcXs[i + 1]!;
    const span = x1 - x0;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.12, 8, 20, Math.PI), stone);
    arch.scale.y = 0.38;
    arch.position.set((x0 + x1) / 2, upperFloorY + upperH - 0.38, arcadeZ);
    g.add(arch);
  }
  // Cedar roof beams spanning across z
  for (let k = 0; k < 10; k++) {
    const x = -W / 2 + T + 0.4 + (k * (W - 2 * T - 0.8)) / 9;
    addBox(g, 0.22, 0.28, D - 2 * T, cedar, x, roofY - 0.14, 0);
  }
  addBox(g, W - 2 * T, 0.24, 0.3, cedar, 0, roofY - 0.4, arcadeZ); // summer beam over the arcade

  // Roof and parapet (Deut 22:8)
  if (cut) {
    addBox(g, W, roofSlab, D * 0.22, stone, 0, roofY + roofSlab / 2, -D / 2 + D * 0.11);
    addBox(g, W, parapet, T * 0.6, stone, 0, roofTop + parapet / 2, -D / 2 + T * 0.3);
  } else {
    addBox(g, W, roofSlab, D, stone, 0, roofY + roofSlab / 2, 0);
    addBox(g, W, parapet, T * 0.6, stone, 0, roofTop + parapet / 2, -D / 2 + T * 0.3);
    addBox(g, W, parapet, T * 0.6, stone, 0, roofTop + parapet / 2, D / 2 - T * 0.3);
    addBox(g, T * 0.6, parapet, D, stone, -W / 2 + T * 0.3, roofTop + parapet / 2, 0);
    addBox(g, T * 0.6, parapet, D, stone, W / 2 - T * 0.3, roofTop + parapet / 2, 0);
  }

  // --- Exterior stone stair up the east wall to the upper door ---
  const nSteps = 13;
  const rise = (upperFloorY - 0.12) / nSteps;
  const run = 0.36;
  const stairW = 1.1;
  const stairX = W / 2 + stairW / 2;
  const topZ = -D / 2 + 1.6 + 0.8;
  for (let s = 0; s < nSteps; s++) {
    const h = 0.12 + rise * (s + 1);
    const z = topZ + (nSteps - s) * run;
    addBox(g, stairW, h, run, stoneDark, stairX, h / 2, z);
  }
  addBox(g, stairW, upperFloorY, 1.2, stoneDark, stairX, upperFloorY / 2, -D / 2 + 1.6); // landing
  // Sloping outer parapet of the stair
  const railLen = Math.hypot(nSteps * run, upperFloorY);
  const rail = addBox(g, 0.18, 0.5, railLen, stone, stairX + stairW / 2, 0.12 + upperFloorY / 2 + 0.25, topZ + (nSteps * run) / 2 + run / 2);
  rail.rotation.x = Math.atan2(upperFloorY, nSteps * run);

  // --- Clay oil lamps on ledges along the upper walls ---
  const ledgeY = upperFloorY + 1.75;
  let lampSeed = 40;
  for (let k = 0; k < 6; k++) {
    const x = -W / 2 + 1.3 + k * 1.9;
    addBox(g, 0.4, 0.06, 0.18, stoneDark, x + 0.2, ledgeY - 0.03, -D / 2 + T + 0.09);
    const lamp = buildClayLamp(clay, fire, lampSeed++);
    lamp.position.set(x + 0.1, ledgeY, -D / 2 + T + 0.09);
    g.add(lamp);
  }
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const z = -D / 2 + 1.4 + k * 1.6;
      const x = sx * (W / 2 - T - 0.09);
      addBox(g, 0.18, 0.06, 0.4, stoneDark, x, ledgeY - 0.03, z);
      const lamp = buildClayLamp(clay, fire, lampSeed++);
      lamp.position.set(x, ledgeY, z);
      lamp.rotation.y = sx > 0 ? Math.PI : 0;
      g.add(lamp);
    }
  }

  // --- Divided tongues of fire in the room (Acts 2:3), display count 12 ---
  for (let i = 0; i < 12; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const tongue = buildDividedTongue(fire, glow, i + 1);
    tongue.position.set(-3.9 + col * 2.6 + (row % 2) * 0.6, upperFloorY + 1.55 + ((i * 7) % 5) * 0.08, -2.6 + row * 2.4);
    g.add(tongue);
  }
  // The sound "like the blowing of a violent wind" filling the house (2:2): faint swirling bands
  const windMat = std(0xf6f1e4, { emissive: 0xfff2d0, emissiveIntensity: 0.45, transparent: true, opacity: 0.22, roughness: 0.4, depthWrite: false });
  for (let k = 0; k < 3; k++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.4 + k * 1.1, 0.03, 6, 64, Math.PI * 1.4), windMat);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, upperFloorY + 2.15 + k * 0.08, -0.2);
    band.userData.orbitGlow = k + 1;
    g.add(band);
  }

  // --- Courtyard of the house ---
  if (!cut) {
    const cy0 = D / 2;
    const cDepth = 6.0;
    const cwH = 2.2;
    addBox(g, W + 1.6, 0.06, cDepth, floorMat, 0.8, 0.03, cy0 + cDepth / 2);
    addBox(g, T, cwH, cDepth, stone, -W / 2 + T / 2, cwH / 2, cy0 + cDepth / 2);
    addBox(g, T, cwH, cDepth, stone, W / 2 + 1.6 - T / 2, cwH / 2, cy0 + cDepth / 2);
    addBox(g, (W + 1.6) / 2 - 0.8, cwH, T, stone, -W / 2 + ((W + 1.6) / 2 - 0.8) / 2, cwH / 2, cy0 + cDepth - T / 2);
    addBox(g, (W + 1.6) / 2 - 0.8, cwH, T, stone, W / 2 + 1.6 - ((W + 1.6) / 2 - 0.8) / 2, cwH / 2, cy0 + cDepth - T / 2);
    // Gate lintel
    addBox(g, 2.0, 0.35, T, cedar, 0.8, cwH + 0.1, cy0 + cDepth - T / 2);
    // Cistern mouth
    const cistern = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.45, 20), stoneDark);
    cistern.position.set(-3.0, 0.27, cy0 + 2.6);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20), cedar);
    cap.position.set(-3.0, 0.52, cy0 + 2.6);
    g.add(cistern, cap);
    // Storage jars by the wall
    const jarProf = [
      new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.16, 0.05), new THREE.Vector2(0.22, 0.35),
      new THREE.Vector2(0.18, 0.6), new THREE.Vector2(0.09, 0.68), new THREE.Vector2(0.1, 0.74),
    ];
    const jarGeo = new THREE.LatheGeometry(jarProf, 14);
    for (let j = 0; j < 4; j++) {
      const jar = new THREE.Mesh(jarGeo, clay);
      jar.position.set(-W / 2 + 0.8 + j * 0.55, 0.06, cy0 + cDepth - 1.0);
      g.add(jar);
    }
  }

  return seatOnGround(g);
}

// ---------------------------------------------------------------------------
// Card metadata, indented like STRUCTURES in specs.ts so audit-events.mjs reads
// every 4-space `id` and `ref` line.
// ---------------------------------------------------------------------------

export const NT_VISION_SPECS: NtVisionSpec[] = [
  {
    id: 'paul-ship',
    zh: '保罗所乘的亚历山大运粮船',
    en: "Paul's Alexandrian Grain Ship",
    ref: 'Acts 27:37',
    refZh: '使徒行传 27:37',
    textZh: '我们在船上的共有二百七十六个人。',
    textEn: 'Altogether there were 276 of us on board.',
    dims: [],
    counts: [
      { zh: '船上的人数', en: 'Souls on board', n: 276, ref: '徒 27:37', refEn: 'Acts 27:37' },
      { zh: '从船尾抛下的锚', en: 'Anchors dropped from the stern', n: 4, ref: '徒 27:29', refEn: 'Acts 27:29' },
      { zh: '第一次探深（寻）', en: 'First sounding (fathoms)', n: 20, ref: '徒 27:28', refEn: 'Acts 27:28' },
      { zh: '第二次探深（寻）', en: 'Second sounding (fathoms)', n: 15, ref: '徒 27:28', refEn: 'Acts 27:28' },
      { zh: '在亚得里亚海飘来飘去的夜数', en: 'Nights driven across the Adriatic', n: 14, ref: '徒 27:27', refEn: 'Acts 27:27' },
    ],
    kind: 'paulShip',
    walk: undefined,
    assumedHeight: 14.0,
    unit: undefined,
    variants: {
      key: 'shipView',
      zh: '展示时刻',
      en: 'Moment shown',
      options: [
        {
          id: 'hull-cutaway',
          zh: '第十四夜抛锚 · 半边船体剖开',
          en: 'Fourteenth night at anchor · half-hull cutaway',
          note: '切开右舷，露出船舱里的麦袋与陶瓮（27:38 才把麦子抛在海里）、兜住船底的缆索（27:17）、收上船的小船（27:16），以及从船尾抛下的四个锚（27:29）。',
          noteEn: 'Starboard half cut away to show the wheat sacks and jars still in the hold (not jettisoned until 27:38), the cables undergirding the hull (27:17), the boat hoisted aboard (27:16) and the four anchors let down from the stern (27:29).',
        },
        {
          id: 'melita-reef',
          zh: '米利大搁浅 · 船头胶住，船尾冲坏',
          en: 'Aground at Malta · bow stuck fast, stern broken',
          note: '砍断锚缆、把锚弃在海里，松开舵绳，拉起前帆（27:40）；遇着两水夹流的地方，船头胶住不动，船尾被浪的猛力冲坏（27:41）。',
          noteEn: 'Anchors cut away and left in the sea, rudder ropes untied, foresail hoisted (27:40); striking a sandbar where two seas met, the bow stuck fast and the stern was broken by the pounding surf (27:41).',
        },
      ],
    },
    unstated: [
      {
        zh: '**船有多长，经文一个数字都没有给。** 这里的 24 米甲板长、14 米桅顶只是展示用的参照高度。古代亚历山大运粮船大小悬殊：琉善笔下的「伊西斯号」约 55 米，约瑟夫说他坐过的船载了约六百人。能载 276 人的船，实际很可能比这个模型大。',
        en: '**Acts gives no length, beam or tonnage.** The 24 m deck and 14 m masthead are display conventions. Alexandrian grain ships varied widely: Lucian describes the Isis at about 55 m, and Josephus sailed on one carrying about 600; a ship holding 276 may well have been larger than this model.',
      },
      {
        zh: '「用缆索捆绑船底」（27:17）的具体做法有争议：横向兜住船身，还是纵向从船头拉到船尾，古代文献都有。这里按横向兜底处理。',
        en: 'How the ship was undergirded (27:17) is debated: cables passed under the hull crosswise, or rigged lengthwise from bow to stern. Crosswise frapping is shown.',
      },
      {
        zh: '一寻约 1.85 米，二十寻约 37 米，十五寻约 28 米。模型里的海水深度大幅压缩，不按比例。',
        en: 'A fathom is about 1.85 m, so the soundings were about 37 m and 28 m. The sea in the model is heavily compressed, not to scale.',
      },
      {
        zh: '搁浅的确切地点经文只说是「两水夹流的地方」（27:41），马耳他的圣保罗湾是传统说法。这条船的船名和船首标记都没有记载；28:11 的「丢斯古利」是另一条船。',
        en: 'The grounding site is described only as a place where two seas met (27:41); St Paul\'s Bay on Malta is the traditional identification. This ship\'s name and figurehead are not recorded; the Twin Brothers of 28:11 belong to a different ship.',
      },
    ],
    punchZh: '**二百七十六个人**，十四夜不见日头星辰，四个锚抛在船尾等天亮……船头胶住，船尾冲坏，结果「众人都得了救，上了岸」（27:44）。',
    punchEn: '**276 people**, fourteen nights without sun or stars, four anchors out astern waiting for daylight; then the bow stuck and the stern broke, "and in this way everyone reached land safely" (27:44).',
    compare: [
      { zh: '模型甲板长（展示参照）', en: 'Model deck length (display)', m: 24.0 },
      { zh: '模型桅顶高（展示参照）', en: 'Model masthead height (display)', m: 14.0 },
      { zh: '第一次探深：二十寻', en: 'First sounding: 20 fathoms', m: 37.0 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'rev4-throne-room',
    zh: '启示录第四章天上的宝座',
    en: 'The Throne Room of Revelation 4',
    ref: 'Revelation 4:4',
    refZh: '启示录 4:4',
    textZh: '宝座的周围又有二十四个座位，其上坐着二十四位长老，身穿白衣，头上戴着金冠冕。',
    textEn: 'Surrounding the throne were twenty-four other thrones, and seated on them were twenty-four elders. They were dressed in white and had crowns of gold on their heads.',
    dims: [],
    counts: [
      { zh: '宝座周围的座位', en: 'Thrones around the throne', n: 24, ref: '启 4:4', refEn: 'Rev 4:4' },
      { zh: '金冠冕', en: 'Crowns of gold', n: 24, ref: '启 4:4, 10', refEn: 'Rev 4:4, 10' },
      { zh: '宝座前点着的火灯', en: 'Lamps of fire before the throne', n: 7, ref: '启 4:5', refEn: 'Rev 4:5' },
      { zh: '四活物', en: 'Living creatures', n: 4, ref: '启 4:6', refEn: 'Rev 4:6' },
      { zh: '每个活物的翅膀', en: 'Wings per creature', n: 6, ref: '启 4:8', refEn: 'Rev 4:8' },
    ],
    kind: 'rev4ThroneRoom',
    walk: undefined,
    assumedHeight: 8.5,
    unit: undefined,
    variants: {
      key: 'throneView',
      zh: '展示范围',
      en: 'View',
      options: [
        {
          id: 'full-council',
          zh: '全景 · 二十四座位、四活物、七灯与玻璃海',
          en: 'Full council · 24 thrones, 4 living creatures, 7 lamps, sea of glass',
          note: '中央宝座只用碧玉与红宝石的光彩呈现（4:3），座上不放任何人形；二十四个白色座位上只放金冠冕，不塑长老的身形；四活物以六翼与满身眼睛的徽记柱表示。',
          noteEn: 'The central throne is shown only by the radiance of jasper and carnelian (4:3), with no figure upon it; the 24 white seats hold only their golden crowns, with no sculpted elders; the living creatures are six-winged emblem pillars full of eyes.',
        },
        {
          id: 'throne-and-lamps',
          zh: '近景 · 宝座、绿宝石虹、七灯与玻璃海',
          en: 'Close view · throne, emerald rainbow, 7 lamps, sea of glass',
          note: '只留宝座、围着宝座的绿宝石色的虹（4:3）、宝座前的七盏火灯（4:5）和宝座前如同水晶的玻璃海（4:6）。',
          noteEn: 'Only the throne, the emerald rainbow encircling it (4:3), the seven lamps of fire before it (4:5) and the crystal-clear sea of glass (4:6).',
        },
      ],
    },
    unstated: [
      {
        zh: '**整章没有一个尺寸。** 8.5 米只是虹顶的展示参照高度。约翰描述坐在宝座上的，只说「看那坐着的，好像碧玉和红宝石」（4:3），没有描述形貌；模型据此只用宝石的光，宝座上不放任何形象。',
        en: '**The chapter gives no measurement at all.** 8.5 m is a display height for the top of the rainbow. John describes the one seated only as having "the appearance of jasper and ruby" (4:3), with no form described, so the model shows only the light of the stones and nothing on the throne.',
      },
      {
        zh: '「有虹围着宝座，好像绿宝石」（4:3）：虹是竖立如拱，还是平放如环，经文没有说。这里两者都画：竖立的翠绿光环，加上宝座脚下的一道平环。',
        en: 'Whether the emerald rainbow "encircling" the throne (4:3) stands upright or lies flat is not said; both are drawn, an upright emerald ring and a flat ring at the foot of the throne.',
      },
      {
        zh: '四活物「头一个像狮子，第二个像牛犊，第三个脸面像人，第四个像飞鹰」（4:7），模型只用简化徽记表示，不塑形体。二十四个座位排成圆环、玻璃海的大小与位置，都是展示安排。',
        en: 'The living creatures are like a lion, an ox, one with a face like a man, and a flying eagle (4:7); here they are reduced to emblems, not bodies. The circular ring of 24 seats and the size and placement of the sea of glass are display choices.',
      },
    ],
    punchZh: '**二十四个座位、二十四顶金冠冕、七盏火灯、四活物各有六个翅膀** —— 全是数出来的，没有一个是量出来的。宝座上只有光。',
    punchEn: '**24 thrones, 24 golden crowns, 7 lamps of fire, 4 living creatures with 6 wings each**: everything is counted and nothing is measured. On the throne there is only light.',
    compare: [
      { zh: '虹顶展示高度（参照）', en: 'Rainbow top display height (assumed)', m: 8.5 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'seven-lampstands',
    zh: '七个金灯台',
    en: 'The Seven Golden Lampstands',
    ref: 'Revelation 1:12',
    refZh: '启示录 1:12',
    textZh: '我转过身来，要看是谁发声与我说话；既转过来，就看见七个金灯台。',
    textEn: 'I turned around to see the voice that was speaking to me. And when I turned I saw seven golden lampstands.',
    dims: [],
    counts: [
      { zh: '金灯台（就是七个教会）', en: 'Golden lampstands (the seven churches)', n: 7, ref: '启 1:12, 20', refEn: 'Rev 1:12, 20' },
      { zh: '星（就是七个教会的使者）', en: 'Stars (the messengers of the seven churches)', n: 7, ref: '启 1:16, 20', refEn: 'Rev 1:16, 20' },
    ],
    kind: 'sevenLampstands',
    walk: undefined,
    assumedHeight: 3.0,
    unit: undefined,
    variants: {
      key: 'lampstandView',
      zh: '展示方式',
      en: 'View',
      options: [
        {
          id: 'seven-churches',
          zh: '七灯台围成弧形 · 当中只有光',
          en: 'Seven lampstands in an arc · only light in their midst',
          note: '七个各自独立的金灯台排成弧形，当中「面貌如同烈日放光」（1:16），所以这里看见的是光，不是脸；上方是七颗星。',
          noteEn: 'Seven separate golden lampstands in an arc; in their midst a face "like the sun shining in all its brilliance" (1:16), so what is shown is the light, not a face. Seven stars hang above.',
        },
        {
          id: 'compare-menorah',
          zh: '对照出埃及记 25 章的灯台',
          en: 'Beside the menorah of Exodus 25',
          note: '同一平台上，左边是启示录的七个独立灯台，右边是出埃及记 25:31–37 那一个有七盏灯的金灯台。',
          noteEn: 'On one platform: Revelation\'s seven separate lampstands on the left, and the single seven-lamp menorah of Exodus 25:31–37 on the right.',
        },
      ],
    },
    unstated: [
      {
        zh: '**灯台的高度与样式，经文都没有说。** 这里每座约 1.5 米、单盏灯，3.0 米是星顶的展示参照高度。灯台排成弧形也是展示安排，经文只说那一位在「灯台中间」（1:13）。',
        en: '**Neither height nor form of the lampstands is given.** Each is shown about 1.5 m tall with a single lamp; 3.0 m is a display height for the stars. The arc is a display choice; the text says only "among the lampstands" (1:13).',
      },
      {
        zh: '1:13–16 描写了「一位好像人子」的衣着、头发、眼目、脚和口中的利剑。模型一概不塑人形，只用光来表示。',
        en: 'Revelation 1:13–16 describes one like a son of man, his robe, hair, eyes, feet and the sharp sword from his mouth. None of this is sculpted; the model shows only light.',
      },
    ],
    punchZh: '出埃及记 25 章是**一个**灯台上点七盏灯；启示录 1 章是**七个**灯台，各是一个教会，各自可以「从原处挪去」（2:5）。',
    punchEn: 'Exodus 25 is **one** lampstand bearing seven lamps; Revelation 1 is **seven** lampstands, each a church, each of which can be "removed from its place" (2:5).',
    compare: [
      { zh: '每座灯台（展示参照）', en: 'Each lampstand (display)', m: 1.5 },
      { zh: '会幕金灯台（传统估算）', en: 'Tabernacle menorah (traditional)', m: 1.5 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'upper-room-pentecost',
    zh: '五旬节的楼房',
    en: 'The Upper Room at Pentecost',
    ref: 'Acts 2:2',
    refZh: '使徒行传 2:2',
    textZh: '忽然，从天上有响声下来，好像一阵大风吹过，充满了他们所坐的屋子；',
    textEn: 'Suddenly a sound like the blowing of a violent wind came from heaven and filled the whole house where they were sitting.',
    dims: [],
    counts: [
      { zh: '聚会的人数', en: 'People gathered', n: 120, ref: '徒 1:15', refEn: 'Acts 1:15' },
      { zh: '使徒（马提亚补上）', en: 'Apostles (with Matthias)', n: 12, ref: '徒 1:26', refEn: 'Acts 1:26' },
    ],
    kind: 'pentecostRoom',
    walk: undefined,
    assumedHeight: 6.2,
    unit: undefined,
    variants: {
      key: 'roomView',
      zh: '展示方式',
      en: 'View',
      options: [
        {
          id: 'cutaway-flames',
          zh: '剖开墙与屋顶 · 看见楼房里分开的火舌',
          en: 'Walls and roof cut away · divided tongues of fire inside',
          note: '拿掉近侧的墙与大半屋顶，看见楼下的拱顶厅、楼上的拱廊与香柏木梁、墙边的陶油灯，以及「舌头如火焰显现出来，分开落在他们各人头上」（2:3）。不塑任何人物。',
          noteEn: 'Near wall and most of the roof removed to show the vaulted ground hall, the arcaded upper hall under cedar beams, the clay lamps, and the "tongues of fire that separated and came to rest on each of them" (2:3). No persons are modelled.',
        },
        {
          id: 'jerusalem-house',
          zh: '完整的两层院落房屋',
          en: 'Whole two-storey courtyard house',
          note: '按一世纪耶路撒冷石造房屋展示：外墙石阶通往楼上，平顶四围有栏杆（申 22:8），前有院子和水池口。',
          noteEn: 'A 1st-century Jerusalem stone house: an outer stair to the upper floor, a flat roof with a parapet (Deut 22:8), and a walled courtyard with a cistern mouth.',
        },
      ],
    },
    unstated: [
      {
        zh: '**房子多大，经文没有说。** 这里约 12 x 9 米、6.2 米高，只够说明一百二十人（1:15）需要多大的地方。',
        en: '**The size of the house is not stated.** About 12 x 9 m and 6.2 m high is shown only to suggest the room 120 people (1:15) would need.',
      },
      {
        zh: '2:1–2 只说他们「都聚集在一处」、风声「充满了他们所坐的屋子」，并没有明说就是 1:13 的那间楼房；把两处连在一起是传统读法。今天锡安山上的「最后晚餐厅」是十字军时期的建筑，比使徒行传晚了一千多年。',
        en: 'Acts 2:1–2 says only that they were all together in one place and the sound filled the house; it does not explicitly name the upper room of 1:13, which is a traditional link. The Cenacle on Mount Zion today is a Crusader-period building, over a thousand years later.',
      },
      {
        zh: '火舌的数目经文没有给，只说落在「他们各人头上」（2:3）。这里的十二道只是展示数目。',
        en: 'The number of tongues of fire is not given; they rested "on each of them" (2:3). The twelve shown are a display count.',
      },
    ],
    punchZh: '**一百二十个人**聚在一处，忽然有响声像大风吹过，充满了整间屋子，火焰般的舌头分开落在各人头上（2:2–3）。',
    punchEn: '**120 people** in one place, then a sound like a violent wind filling the whole house, and tongues of fire separating to rest on each of them (2:2–3).',
    compare: [
      { zh: '房屋展示高度（含栏杆）', en: 'House display height (to parapet)', m: 6.2 },
      { zh: '楼上房间净高（展示参照）', en: 'Upper room clear height (display)', m: 2.55 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
];
