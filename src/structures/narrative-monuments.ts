import * as THREE from 'three';
import type { Structure } from './specs.ts';

// Four Old-Testament narrative monuments that Scripture measures or counts:
// Nehemiah's rebuilt wall (Neh 3), Elijah's twelve-stone altar on Carmel (1 Kgs 18),
// the Shunammite's walled upper room (2 Kgs 4), and the palace garden court at Susa
// (Esth 1). Every builder returns a THREE.Group in world metres seated on y = 0.
// No companion person mesh is added inside any returned group — src/structures/panel.ts
// places the single 1.72 m companion figure beside every non-cube structure.

export type NehemiahWallVariant = 'broad-wall' | 'gate-cutaway';
export type CarmelAltarVariant = 'water-filled' | 'fire-from-heaven';
export type ShunammiteChamberVariant = 'cutaway' | 'rooftop';
export type ShushanCourtVariant = 'canopied' | 'pavement-detail';

export type OtMonumentSpec = Omit<Structure, 'kind' | 'walk'> & { kind: string; walk?: string };

// ---------------------------------------------------------------------------
// Shared procedural textures (all marked userData.shared = true)
// ---------------------------------------------------------------------------

interface NarrativeTex {
  ashlar: THREE.CanvasTexture;
  fieldstone: THREE.CanvasTexture;
  rubble: THREE.CanvasTexture;
  timber: THREE.CanvasTexture;
  mudBrick: THREE.CanvasTexture;
  reed: THREE.CanvasTexture;
  earth: THREE.CanvasTexture;
  mosaic: THREE.CanvasTexture;
  flute: THREE.CanvasTexture;
  weave: THREE.CanvasTexture;
}

let cachedNarrativeTex: NarrativeTex | null = null;

function shareTex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.userData.shared = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

/** Deterministic PRNG (mulberry32) so every rebuild produces identical stones. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function drawStonePolys(
  x: CanvasRenderingContext2D,
  size: number,
  count: number,
  rMin: number,
  rMax: number,
  base: [number, number, number],
  spread: number,
  seed: number,
): void {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = r() * size;
    const cy = r() * size;
    const rad = rMin + r() * (rMax - rMin);
    const sides = 5 + Math.floor(r() * 4);
    const tone = (r() - 0.5) * spread;
    const fill = `rgb(${Math.round(base[0] + tone)}, ${Math.round(base[1] + tone)}, ${Math.round(base[2] + tone * 0.9)})`;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        x.beginPath();
        for (let s = 0; s < sides; s++) {
          const a = (s / sides) * Math.PI * 2 + i;
          const rr = rad * (0.72 + ((s * 37 + i * 11) % 7) / 20);
          const px = cx + ox + Math.cos(a) * rr;
          const py = cy + oy + Math.sin(a) * rr * 0.8;
          if (s === 0) x.moveTo(px, py);
          else x.lineTo(px, py);
        }
        x.closePath();
        x.fillStyle = fill;
        x.fill();
        x.strokeStyle = 'rgba(30, 24, 18, 0.36)';
        x.lineWidth = 1.5;
        x.stroke();
      }
    }
  }
}

function getNarrativeTex(): NarrativeTex {
  if (cachedNarrativeTex) return cachedNarrativeTex;

  // 1. Dressed Jerusalem limestone courses with drafted margins (Neh 2:8; 4:2)
  const [ac, ax] = makeCanvas(256, 256);
  ax.fillStyle = '#9c8a6c';
  ax.fillRect(0, 0, 256, 256);
  const ar = rng(11);
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    let xPos = row % 2 === 0 ? 0 : -48;
    while (xPos < 256) {
      const w = 72 + Math.floor(ar() * 64);
      const tone = 198 + Math.floor((ar() - 0.5) * 26);
      for (const ox of [0, -256, 256]) {
        ax.fillStyle = `rgb(${tone - 16}, ${tone - 26}, ${tone - 44})`;
        ax.fillRect(xPos + ox + 2, y + 2, w - 4, 60);
        ax.fillStyle = `rgb(${tone}, ${tone - 10}, ${tone - 30})`;
        ax.fillRect(xPos + ox + 7, y + 7, w - 14, 50);
      }
      xPos += w;
    }
  }
  const ashlar = shareTex(ac);

  // 2. Rough fieldstone masonry (city-side inner skin, footings, courtyard houses)
  const [fc, fx] = makeCanvas(256, 256);
  fx.fillStyle = '#5e5446';
  fx.fillRect(0, 0, 256, 256);
  drawStonePolys(fx, 256, 46, 14, 30, [152, 140, 120], 46, 23);
  const fieldstone = shareTex(fc);

  // 3. Rubble-and-mortar wall core fill
  const [rc, rx] = makeCanvas(256, 256);
  rx.fillStyle = '#4b3f31';
  rx.fillRect(0, 0, 256, 256);
  drawStonePolys(rx, 256, 120, 5, 13, [122, 108, 88], 52, 37);
  const rubble = shareTex(rc);

  // 4. Timber planks & beams (gate leaves, crossbars, furnishings)
  const [tc, tx] = makeCanvas(256, 256);
  tx.fillStyle = '#6a4425';
  tx.fillRect(0, 0, 256, 256);
  const tr = rng(41);
  for (let xPos = 0; xPos < 256; xPos += 32) {
    tx.fillStyle = (xPos / 32) % 2 === 0 ? '#764d2b' : '#63401f';
    tx.fillRect(xPos, 0, 30, 256);
    for (let k = 0; k < 6; k++) {
      tx.strokeStyle = 'rgba(40, 22, 10, 0.4)';
      tx.lineWidth = 1;
      const gx = xPos + 3 + tr() * 24;
      tx.beginPath();
      tx.moveTo(gx, 0);
      tx.bezierCurveTo(gx + 3, 80, gx - 3, 170, gx + 1, 256);
      tx.stroke();
    }
    tx.fillStyle = '#2e1a0b';
    tx.fillRect(xPos + 30, 0, 2, 256);
  }
  const timber = shareTex(tc);

  // 5. Sun-dried mud-brick under lime-clay plaster with straw flecks
  const [mc, mx] = makeCanvas(256, 256);
  mx.fillStyle = '#b79d76';
  mx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 32;
    for (let col = -1; col < 5; col++) {
      mx.strokeStyle = 'rgba(110, 86, 56, 0.32)';
      mx.lineWidth = 2;
      mx.strokeRect(col * 64 + off + 1, row * 32 + 1, 62, 30);
    }
  }
  const mr = rng(53);
  for (let i = 0; i < 240; i++) {
    mx.strokeStyle = `rgba(${200 + Math.floor(mr() * 40)}, ${170 + Math.floor(mr() * 40)}, 92, 0.52)`;
    mx.lineWidth = 1;
    const px = mr() * 256;
    const py = mr() * 256;
    const a = mr() * Math.PI;
    mx.beginPath();
    mx.moveTo(px, py);
    mx.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6);
    mx.stroke();
  }
  const mudBrick = shareTex(mc);

  // 6. Woven grass/reed ceiling mat
  const [qc, qx] = makeCanvas(128, 128);
  qx.fillStyle = '#9c7f48';
  qx.fillRect(0, 0, 128, 128);
  for (let xPos = 0; xPos < 128; xPos += 4) {
    qx.fillStyle = (xPos / 4) % 3 === 0 ? '#b6995c' : '#8a6d3a';
    qx.fillRect(xPos, 0, 3, 128);
  }
  for (let yPos = 8; yPos < 128; yPos += 24) {
    qx.fillStyle = 'rgba(72, 52, 24, 0.35)';
    qx.fillRect(0, yPos, 128, 2);
  }
  const reed = shareTex(qc);

  // 7. Trodden limestone-clay soil
  const [ec, ex] = makeCanvas(128, 128);
  ex.fillStyle = '#6d5438';
  ex.fillRect(0, 0, 128, 128);
  const er = rng(67);
  for (let i = 0; i < 520; i++) {
    const v = 70 + Math.floor(er() * 70);
    ex.fillStyle = `rgba(${v + 32}, ${v + 12}, ${v - 18}, 0.5)`;
    ex.fillRect(er() * 128, er() * 128, 2, 2);
  }
  const earth = shareTex(ec);

  // 8. Four-stone opus-sectile mosaic of Esther 1:6:
  //    bahat (imperial red porphyry), shesh (white marble/alabaster),
  //    dar (iridescent mother-of-pearl), socheret (black marble)
  const [pc, px] = makeCanvas(512, 512);
  const cell = 128;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x0 = i * cell;
      const y0 = j * cell;
      // Alternating porphyry & white alabaster ground squares
      px.fillStyle = (i + j) % 2 === 0 ? '#8c2d27' : '#f1ece0';
      px.fillRect(x0, y0, cell, cell);
      // Subtle veining
      px.strokeStyle = (i + j) % 2 === 0 ? 'rgba(225, 175, 165, 0.22)' : 'rgba(175, 165, 148, 0.28)';
      px.lineWidth = 1.5;
      px.beginPath();
      px.moveTo(x0 + 10, y0 + 28);
      px.lineTo(x0 + 96, y0 + 88);
      px.stroke();
      // Black marble (socheret) octagram / diamond frame
      px.strokeStyle = '#1c1b20';
      px.lineWidth = 6;
      px.strokeRect(x0 + 14, y0 + 14, cell - 28, cell - 28);
      // Mother-of-pearl (dar) iridescent central lozenge
      const grad = px.createLinearGradient(x0 + 26, y0 + 26, x0 + 102, y0 + 102);
      grad.addColorStop(0, '#faf3e6');
      grad.addColorStop(0.38, '#e3daf2');
      grad.addColorStop(0.68, '#d5ecec');
      grad.addColorStop(1, '#f5e4d0');
      px.fillStyle = grad;
      px.beginPath();
      px.moveTo(x0 + 64, y0 + 22);
      px.lineTo(x0 + 106, y0 + 64);
      px.lineTo(x0 + 64, y0 + 106);
      px.lineTo(x0 + 22, y0 + 64);
      px.closePath();
      px.fill();
      px.strokeStyle = '#1c1b20';
      px.lineWidth = 3;
      px.stroke();
      // Inner black marble & porphyry/alabaster eye
      px.fillStyle = '#1c1b20';
      px.fillRect(x0 + 52, y0 + 52, 24, 24);
      px.fillStyle = (i + j) % 2 === 0 ? '#f1ece0' : '#8c2d27';
      px.beginPath();
      px.arc(x0 + 64, y0 + 64, 7, 0, Math.PI * 2);
      px.fill();
    }
  }
  px.strokeStyle = '#1c1b20';
  px.lineWidth = 4;
  for (let k = 0; k <= 512; k += cell) {
    px.beginPath();
    px.moveTo(k, 0);
    px.lineTo(k, 512);
    px.moveTo(0, k);
    px.lineTo(512, k);
    px.stroke();
  }
  const mosaic = shareTex(pc);

  // 9. Fluted white marble column shaft shading
  const [uc, ux] = makeCanvas(256, 64);
  const flutes = 16;
  const fw = 256 / flutes;
  for (let f = 0; f < flutes; f++) {
    const grad = ux.createLinearGradient(f * fw, 0, (f + 1) * fw, 0);
    grad.addColorStop(0, '#d6d1c7');
    grad.addColorStop(0.5, '#fcfaf5');
    grad.addColorStop(1, '#c6c0b4');
    ux.fillStyle = grad;
    ux.fillRect(f * fw, 0, fw, 64);
  }
  const flute = shareTex(uc);

  // 10. Fine linen / cotton weave
  const [wc, wx] = makeCanvas(64, 64);
  wx.fillStyle = '#ffffff';
  wx.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 64; k += 4) {
    wx.fillStyle = 'rgba(0, 0, 0, 0.07)';
    wx.fillRect(k, 0, 1, 64);
    wx.fillRect(0, k, 64, 1);
  }
  const weave = shareTex(wc, 6, 6);

  cachedNarrativeTex = {
    ashlar,
    fieldstone,
    rubble,
    timber,
    mudBrick,
    reed,
    earth,
    mosaic,
    flute,
    weave,
  };
  return cachedNarrativeTex;
}

// ---------------------------------------------------------------------------
// Shared geometry helpers
// ---------------------------------------------------------------------------

/** BoxGeometry with world-scaled UVs so shared textures tile without stretching. */
function tiledBox(w: number, h: number, d: number, tile: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const faceDims: Array<[number, number]> = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const fd = faceDims[f];
    if (!fd) continue;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * fd[0]) / tile, (uv.getY(i) * fd[1]) / tile);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Axis-aligned block between min/max bounds (in metres). */
function span(
  parent: THREE.Object3D,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  mat: THREE.Material,
  tile = 1.6,
): THREE.Mesh {
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  const d = Math.abs(z1 - z0);
  const m = new THREE.Mesh(tiledBox(w, h, d, tile), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parent.add(m);
  return m;
}

/** Faceted natural fieldstone boulder seated with its lowest vertex at y = 0. */
function boulderGeo(r: number, seed: number, sx = 1, sy = 0.78, sz = 1): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const cache = new Map<string, number>();
  const rand = rng(seed);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let k = cache.get(key);
    if (k === undefined) {
      k = 0.8 + rand() * 0.35;
      cache.set(key, k);
    }
    pos.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb) geo.translate(0, -bb.min.y, 0);
  return geo;
}

/** Flat horizontal rectangle-with-hole (CCW outer contour, CW hole -> +Y normal after rotateX(-PI/2)). */
function rectRingShape(ow: number, od: number, iw: number, id: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-ow / 2, -od / 2);
  s.lineTo(ow / 2, -od / 2);
  s.lineTo(ow / 2, od / 2);
  s.lineTo(-ow / 2, od / 2);
  s.closePath();
  const h = new THREE.Path();
  h.moveTo(-iw / 2, -id / 2);
  h.lineTo(-iw / 2, id / 2);
  h.lineTo(iw / 2, id / 2);
  h.lineTo(iw / 2, -id / 2);
  h.closePath();
  s.holes.push(h);
  return s;
}

/** Thin cylindrical rod or cord connecting two 3D points. */
function rod(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
  mat: THREE.Material,
  seg = 8,
): THREE.Mesh {
  const d = b.clone().sub(a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// 1. Nehemiah's Rebuilt Wall (Neh 3:8, 13; 6:15; 12:31)
// ---------------------------------------------------------------------------

/**
 * Monumental ~24 × 17 × 18 cubit section of Nehemiah's rebuilt Jerusalem wall,
 * scaled by `C` (cubit in metres) so the Measures cubit slider dynamically resizes it:
 *   - Left (-X): Projecting Tower (18 c high) + inner gatehouse guardroom.
 *   - Center: Twin-leaf timber gate with heavy lintel beams, iron straps & crossbar.
 *   - Right (+X, facing the default +X/+Y/+Z camera & 1.72 m figure): 15.5-cubit
 *     (~7 m) Broad Wall section — dressed stone outer face, rough fieldstone inner
 *     face, paved wall-walk, and ('gate-cutaway') peeled parapet/core + sliced gate leaf.
 */
export function buildNehemiahWall(
  C: number,
  variant: NehemiahWallVariant = 'broad-wall',
): THREE.Group {
  const tex = getNarrativeTex();
  const g = new THREE.Group();
  const u = C;
  const cut = variant === 'gate-cutaway';

  const ashlarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.ashlar, roughness: 0.85 });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xefe5d2, map: tex.ashlar, roughness: 0.87 });
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.fieldstone, roughness: 0.95 });
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.rubble, roughness: 0.97 });
  const paveMat = new THREE.MeshStandardMaterial({ color: 0xd8caa8, map: tex.fieldstone, roughness: 0.9 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.timber, roughness: 0.78 });
  const darkTimber = new THREE.MeshStandardMaterial({ color: 0x896847, map: tex.timber, roughness: 0.82 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x3b3835, metalness: 0.74, roughness: 0.4 });
  const voidMat = new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8e7f68, roughness: 0.95, flatShading: true });

  const S = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    mat: THREE.Material,
    tile = 1.8,
  ): THREE.Mesh => span(g, x0 * u, x1 * u, y0 * u, y1 * u, z0 * u, z1 * u, mat, tile);

  // Dimensions in cubits (~23.8 x 17.6 x 18.0 cubits overall)
  const T = 15.5; // Broad Wall thickness (~6.90 m at 0.445 m/cubit)
  const zo = T / 2; // +7.75 c outer face
  const zi = -T / 2; // -7.75 c city-side face
  const foot = 1.0; // stepped fieldstone plinth
  const H = 12.2; // Broad Wall walkway height
  const skin = 2.0; // dressed outer / fieldstone inner masonry skin thickness

  const tx0 = -11.5; // Projecting Tower west edge
  const tx1 = -4.0; // Tower east edge (abuts west gate jamb)
  const gx0 = -3.2; // Gate clear passage west
  const gx1 = 2.2; // Gate clear passage east (5.4 c = 2.40 m clear width)
  const jamb = 0.8; // Dressed ashlar gate jambs
  const gH = 8.4; // Gate clear height above threshold
  const wx0 = gx1 + jamb; // +3.0 c Broad Wall start
  const wx1 = 11.5; // +11.5 c Broad Wall east section face (facing +X camera!)
  const cutX = 5.2; // Cutaway peel plane on the +X Broad Wall

  // --- 1. Stepped fieldstone foundation footing seated at y = 0 ---
  S(tx0 - 0.4, wx1 + 0.4, 0, foot, zi - 0.4, zo + 0.4, fieldMat);

  // --- 2. Projecting Tower (-X) + City-Side Gatehouse Guardroom ---
  const tzFront = zo + 1.8; // +9.55 c projecting outer face
  const tzSplit = -1.8; // front tower mass vs rear city-side guardroom
  const towerDeck = 16.4;
  const towerCrown = 18.0; // exact 18.0-cubit height

  S(tx0 - 0.3, tx1 + 0.2, 0, foot, zo, tzFront + 0.3, fieldMat);
  S(tx0, tx1, foot, towerDeck, tzSplit, tzFront, towerMat, 2.1);
  // String-course belt
  S(tx0 - 0.14, tx1 + 0.14, foot + 6.4, foot + 6.9, tzSplit - 0.1, tzFront + 0.14, ashlarMat);
  // Tower rooftop parapet & crenellated merlons (crowning at 18.0 cubits)
  const pT = 0.95;
  const pSill = 17.1;
  S(tx0, tx1, towerDeck, pSill, tzFront - pT, tzFront, towerMat);
  S(tx0, tx1, towerDeck, pSill, tzSplit, tzSplit + pT, towerMat);
  S(tx0, tx0 + pT, towerDeck, pSill, tzSplit + pT, tzFront - pT, towerMat);
  S(tx1 - pT, tx1, towerDeck, pSill, tzSplit + pT, tzFront - pT, towerMat);
  for (let x = tx0; x + 1.3 <= tx1 + 0.05; x += 2.05) {
    S(x, x + 1.25, pSill, towerCrown, tzFront - pT, tzFront, towerMat);
    S(x, x + 1.25, pSill, towerCrown, tzSplit, tzSplit + pT, towerMat);
  }
  for (let z = tzSplit + pT + 0.5; z + 1.3 <= tzFront - pT; z += 2.3) {
    S(tx0, tx0 + pT, pSill, towerCrown, z, z + 1.25, towerMat);
    S(tx1 - pT, tx1, pSill, towerCrown, z, z + 1.25, towerMat);
  }
  // Narrow vertical arrow slits
  for (const sy of [foot + 8.2, foot + 11.8]) {
    for (const sx of [tx0 + 2.1, (tx0 + tx1) / 2, tx1 - 2.1]) {
      S(sx - 0.16, sx + 0.16, sy, sy + 1.7, tzFront, tzFront + 0.05, voidMat);
    }
    S(tx1, tx1 + 0.05, sy, sy + 1.6, zo + 0.4, zo + 0.8, voidMat);
  }

  // City-side Gatehouse Guardroom recessed into rear (-Z) of tower pier (Neh 7:3; 12:25)
  const grTop = foot + 6.8;
  S(tx0, tx1, foot, foot + 0.15, zi, tzSplit, paveMat); // guardroom stone floor
  S(tx0, tx0 + 0.9, foot, grTop, zi, tzSplit, fieldMat); // west wall
  S(tx0 + 0.9, tx1, foot, grTop, zi, zi + 0.9, fieldMat); // city-side north wall
  // East wall facing gate passage with timber-linteled doorway
  S(tx1 - 0.8, tx1, foot, grTop, zi + 0.9, zi + 2.1, fieldMat);
  S(tx1 - 0.8, tx1, foot, grTop, zi + 4.1, tzSplit, fieldMat);
  S(tx1 - 0.8, tx1, foot + 4.3, grTop, zi + 2.1, zi + 4.1, fieldMat);
  S(tx1 - 0.86, tx1 + 0.06, foot + 3.95, foot + 4.3, zi + 1.9, zi + 4.3, darkTimber, 1.2);
  // Watchmen's stone bench along back wall
  S(tx0 + 1.1, tx1 - 1.0, foot + 0.15, foot + 1.05, tzSplit - 1.4, tzSplit, ashlarMat);
  if (!cut) {
    // Roofed guardroom forming lower city-side terrace behind tower
    S(tx0, tx1, grTop, H, zi, tzSplit, fieldMat);
    S(tx0, tx1, H - 0.5, H, zi + 0.8, tzSplit, paveMat);
  } else {
    // Cutaway exposes guardroom interior & cedar roof joists
    for (let x = tx0 + 1.1; x < tx1 - 0.8; x += 1.45) {
      S(x, x + 0.42, grTop - 0.45, grTop, zi + 0.4, tzSplit, darkTimber, 1.2);
    }
  }

  // --- 3. Gate Passage, Heavy Timber Beams (Neh 3:3, 6), Twin Leaves & Crossbar ---
  // Dressed stone jambs through the full 15.5-cubit Broad Wall thickness
  S(gx0 - jamb, gx0, foot, H, zi, zo, ashlarMat);
  S(gx1, gx1 + jamb, foot, H, zi, zo, ashlarMat);
  // Paved gate passage & stone threshold sill
  S(gx0, gx1, foot, foot + 0.18, zi - 0.3, zo + 0.3, paveMat);
  S(gx0, gx1, foot + 0.18, foot + 0.32, zo - 2.3, zo - 1.7, ashlarMat);

  // Timber lintel beams ("laid its beams", Neh 3:3, 6) + over-gate wall & walkway
  for (let z = zi + 0.7; z <= zo - 0.5; z += 1.4) {
    S(gx0 - 0.45, gx1 + 0.45, foot + gH - 0.65, foot + gH, z - 0.34, z + 0.34, darkTimber, 1.2);
  }
  S(gx0, gx1, foot + gH, H, zo - skin, zo, ashlarMat);
  S(gx0, gx1, foot + gH, H, zi, zi + skin, fieldMat);
  S(gx0, gx1, foot + gH, H - 0.55, zi + skin, zo - skin, rubbleMat, 1.2);
  S(gx0, gx1, H - 0.55, H, zi + skin, zo - skin, paveMat);
  // Parapet & merlons across the gatehead
  S(tx1, wx0, H, H + 1.5, zo - 1.15, zo, ashlarMat);
  for (let x = tx1 + 0.35; x + 1.4 <= wx0 + 0.1; x += 2.5) {
    S(x, x + 1.4, H + 1.5, H + 2.6, zo - 1.15, zo, ashlarMat);
  }
  S(tx1, wx0, H, H + 0.85, zi, zi + 0.8, fieldMat);

  // Twin timber gate leaves ("set up its doors, its bolts, and its bars", Neh 3:3, 6, 13–15)
  const leafW = (gx1 - gx0) / 2;
  const leafH = gH - 0.95;
  const leafY0 = foot + 0.32;
  const leafZ = zo - 2.3;
  const studGeo = new THREE.SphereGeometry(0.085 * u, 8, 6);

  const buildGateLeaf = (sliced: boolean, hingeOnRight: boolean): THREE.Group => {
    const hinge = new THREE.Group();
    const leaf = new THREE.Group();
    leaf.position.x = hingeOnRight ? -leafW * u : 0;
    hinge.add(leaf);

    const hOuter = sliced ? leafH * 0.54 : leafH;
    // Outer vertical cedar planks
    span(leaf, 0.02 * u, (leafW - 0.02) * u, 0, hOuter * u, 0, 0.24 * u, timberMat, 1.1);
    // Inner horizontal cross-plank backing (exposed higher in cutaway so 2-ply structure reads!)
    span(leaf, 0.04 * u, (leafW - 0.04) * u, 0, leafH * (sliced ? 0.78 : 1) * u, -0.22 * u, 0, darkTimber, 1.1);

    for (const fy of [0.15, 0.5, 0.84]) {
      // Internal mortised batten ribs remain visible even where outer planks are sliced away
      span(
        leaf,
        0.08 * u,
        (leafW - 0.08) * u,
        (fy * leafH - 0.22) * u,
        (fy * leafH + 0.22) * u,
        -0.42 * u,
        -0.22 * u,
        darkTimber,
        1.1,
      );
      if (fy * leafH <= hOuter) {
        for (let k = 0; k < 4; k++) {
          const stud = new THREE.Mesh(studGeo, ironMat);
          stud.position.set(((k + 0.5) / 4) * leafW * u, fy * leafH * u, 0.26 * u);
          leaf.add(stud);
        }
      }
    }
    // Forged iron hinge straps
    for (const fy of [0.13, 0.86]) {
      if (fy * leafH <= hOuter) {
        const sx0 = hingeOnRight ? leafW * 0.38 : 0;
        span(
          leaf,
          sx0 * u,
          (sx0 + leafW * 0.62) * u,
          (fy * leafH - 0.11) * u,
          (fy * leafH + 0.11) * u,
          0.24 * u,
          0.3 * u,
          ironMat,
          1,
        );
      }
    }
    return hinge;
  };

  const westLeaf = buildGateLeaf(false, false);
  westLeaf.position.set(gx0 * u, leafY0 * u, leafZ * u);
  if (cut) westLeaf.rotation.y = Math.PI * 0.36; // swung inward into passage
  g.add(westLeaf);

  const eastLeaf = buildGateLeaf(cut, true); // sliced open in 'gate-cutaway'
  eastLeaf.position.set(gx1 * u, leafY0 * u, leafZ * u);
  g.add(eastLeaf);

  // Stone bar-sockets on inside of jambs + massive iron-banded timber crossbar (beriah)
  const barY = leafY0 + leafH * 0.46;
  for (const sx of [gx0 + 0.32, gx1 - 0.32]) {
    S(sx - 0.32, sx + 0.32, barY - 0.52, barY + 0.42, leafZ - 1.15, leafZ - 0.45, ashlarMat);
  }
  const barLen = (gx1 - gx0 + 0.8) * u;
  const bar = new THREE.Mesh(tiledBox(barLen, 0.52 * u, 0.52 * u, 1.2), darkTimber);
  for (const bx of [-0.32, 0, 0.32]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.12 * u, 0.58 * u, 0.58 * u), ironMat);
    band.position.set(bx * barLen, 0, 0);
    bar.add(band);
  }
  if (cut) {
    // Retracted half-out of its eastern socket so the locking mechanism is unmistakable
    bar.position.set(((gx0 + gx1) / 2 + 1.65) * u, barY * u, (leafZ - 0.8) * u);
  } else {
    bar.position.set(((gx0 + gx1) / 2) * u, barY * u, (leafZ - 0.8) * u);
  }
  g.add(bar);

  // Vertical iron drop-bolt (man'ul) into threshold socket
  span(
    g,
    ((gx0 + gx1) / 2 - 0.14) * u,
    ((gx0 + gx1) / 2 + 0.14) * u,
    (leafY0 + (cut ? 0.55 : -0.05)) * u,
    (barY - 0.3) * u,
    (leafZ - 0.52) * u,
    (leafZ - 0.28) * u,
    ironMat,
    1,
  );

  // --- 4. Monumental 15.5-Cubit (~7 m) Broad Wall Section (+X, facing camera & 1.72 m figure) ---
  // Intact western segment next to gate (wx0 .. cutX)
  const segX1 = cut ? cutX : wx1;
  S(wx0, segX1, foot, H, zo - skin, zo, ashlarMat); // dressed outer face
  S(wx0, wx1, foot, H, zi, zi + skin, fieldMat); // rough fieldstone inner face
  S(wx0, segX1, foot, H - 0.55, zi + skin, zo - skin, rubbleMat, 1.2); // rubble core
  S(wx0, segX1, H - 0.55, H, zi + skin, zo - skin, paveMat); // wall-top choir walkway (Neh 12:31, 38)

  // Intact parapet & merlons up to segX1
  S(wx0, segX1, H, H + 1.5, zo - 1.15, zo, ashlarMat);
  for (let x = wx0 + 0.4; x + 1.4 <= segX1 + 0.05; x += 2.6) {
    S(x, x + 1.4, H + 1.5, H + 2.6, zo - 1.15, zo, ashlarMat);
  }
  S(wx0, wx1, H, H + 0.85, zi, zi + 0.8, fieldMat);

  // City-side stone stairs climbing up the inner wall face to the wall-top walkway (Neh 3:15; 12:37)
  const stSteps = 10;
  const stZ0 = zi - 1.8;
  const stZ1 = zi;
  for (let i = 0; i < stSteps; i++) {
    const x0s = wx0 + 0.8 + i * 0.72;
    S(x0s, wx1 - 0.4, foot, foot + ((i + 1) / stSteps) * (H - foot), stZ0, stZ1, fieldMat);
  }

  // In 'gate-cutaway': peel back outer dressed stone skin & parapet on +X (cutX .. wx1)
  // to reveal the 11.5-cubit rubble-and-boulder fill + timber crossbars & lacing beams!
  if (cut) {
    // Stepped down outer dressed skin (showing courses in progress)
    S(cutX, wx1, foot, foot + 3.4, zo - skin, zo, ashlarMat);
    S(cutX, cutX + 2.2, foot + 3.4, foot + 6.6, zo - skin, zo, ashlarMat);
    // Exposed rubble core mass
    S(cutX, wx1, foot, H - 1.1, zi + skin, zo - skin, rubbleMat, 1.1);

    // Longitudinal timber lacing beams & transverse timber crossbars tying inner/outer skins
    for (const ty of [foot + 4.2, foot + 7.8]) {
      S(cutX - 0.2, wx1 + 0.15, ty, ty + 0.48, zo - skin - 0.45, zo - skin + 0.08, darkTimber, 1.1);
      S(cutX - 0.2, wx1 + 0.15, ty, ty + 0.48, zi + skin - 0.08, zi + skin + 0.45, darkTimber, 1.1);
      for (let x = cutX + 0.6; x < wx1 - 0.3; x += 2.1) {
        S(x, x + 0.48, ty + 0.48, ty + 0.94, zi + skin - 0.3, zo - skin + 0.3, timberMat, 1.1);
      }
    }

    // 28 distinct unhewn core boulders embedded across top & peeled outer face
    const rr = rng(318);
    const bGeos = [boulderGeo(0.36 * u, 11), boulderGeo(0.44 * u, 17), boulderGeo(0.29 * u, 23)];
    for (let i = 0; i < 28; i++) {
      const geo = bGeos[i % bGeos.length];
      if (!geo) continue;
      const m = new THREE.Mesh(geo, rockMat);
      if (i < 16) {
        m.position.set(
          (cutX + 0.45 + rr() * (wx1 - cutX - 0.9)) * u,
          (H - 1.15) * u,
          (zi + skin + 0.55 + rr() * (T - 2 * skin - 1.1)) * u,
        );
      } else {
        m.position.set(
          (cutX + 0.55 + rr() * (wx1 - cutX - 1.1)) * u,
          (foot + 3.4 + rr() * 6.2) * u,
          (zo - skin - 0.18) * u,
        );
      }
      m.rotation.y = rr() * Math.PI * 2;
      g.add(m);
    }
  }

  return g;
}

// ---------------------------------------------------------------------------
// 2. Elijah's Twelve-Stone Altar on Mount Carmel (1 Kings 18:31–38)
// ---------------------------------------------------------------------------

function buildWaterJar(mat: THREE.Material, handleMat: THREE.Material): THREE.Group {
  const j = new THREE.Group();
  const profile = [
    [0, 0],
    [0.085, 0],
    [0.14, 0.055],
    [0.205, 0.19],
    [0.215, 0.34],
    [0.165, 0.49],
    [0.088, 0.58],
    [0.075, 0.65],
    [0.098, 0.69],
  ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 22), mat);
  j.add(body);
  // Two Canaanite/Israelite vertical loop handles from shoulder to neck
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 8, 18, Math.PI * 1.15), handleMat);
    h.position.set(sx * 0.145, 0.48, 0);
    h.rotation.z = sx > 0 ? -Math.PI * 0.48 : Math.PI * 0.48;
    if (sx < 0) h.rotation.y = Math.PI;
    j.add(h);
  }
  return j;
}

/**
 * Twelve distinct unhewn fieldstone boulders (one per tribe of Jacob, 1 Kgs 18:31)
 * arranged in a countable 12-stone perimeter ring around an earth-and-stone hearth,
 * stacked firewood, prepared burnt-offering bullock pieces (exact 1.80 m top in
 * 'water-filled'), and a deep 2-seah perimeter trench (18:32).
 * 'fire-from-heaven' renders a towering strictly-aniconic pillar of consuming fire.
 */
export function buildCarmelAltar(
  C: number,
  variant: CarmelAltarVariant = 'water-filled',
): THREE.Group {
  void C; // Unmeasured in text; built to assumedHeight = 1.8 m reference scale
  const tex = getNarrativeTex();
  const g = new THREE.Group();
  const fire = variant === 'fire-from-heaven';

  const earthMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.earth, roughness: 0.97 });
  const trenchMat = new THREE.MeshStandardMaterial({
    color: fire ? 0x211812 : 0x3b2c1d,
    roughness: fire ? 0.96 : 0.72,
  });
  const hearthMat = new THREE.MeshStandardMaterial({
    color: fire ? 0x261c17 : 0x6e6353,
    map: tex.rubble,
    roughness: 0.92,
    emissive: fire ? 0x6a1f00 : 0x000000,
    emissiveIntensity: fire ? 0.45 : 0,
  });

  const stonePalette = fire ? [0x2f2824, 0x3a312b, 0x27211d] : [0x8b8375, 0x7a7365, 0x998e7b];
  const stoneMats = stonePalette.map(
    (col) =>
      new THREE.MeshStandardMaterial({
        color: col,
        roughness: fire ? 0.94 : 0.42, // wet sheen when drenched with 12 jars of water!
        metalness: fire ? 0.02 : 0.08,
        flatShading: true,
        emissive: fire ? 0x631d00 : 0x000000,
        emissiveIntensity: fire ? 0.36 : 0,
      }),
  );

  const logMat = fire
    ? new THREE.MeshStandardMaterial({
        color: 0x261307,
        emissive: 0xff5e12,
        emissiveIntensity: 0.88,
        roughness: 0.82,
      })
    : new THREE.MeshStandardMaterial({ color: 0x4d351e, map: tex.timber, roughness: 0.55 });

  const offeringMat = fire
    ? new THREE.MeshStandardMaterial({
        color: 0x17110e,
        emissive: 0x8a2800,
        emissiveIntensity: 0.62,
        roughness: 0.9,
      })
    : new THREE.MeshStandardMaterial({ color: 0x8f3f2e, roughness: 0.52 });

  // --- 1. Ground berm & excavated 2-seah perimeter trench (1 Kgs 18:32) ---
  const gH = 0.34;
  const outerBermGeo = new THREE.ExtrudeGeometry(rectRingShape(5.6, 4.6, 3.9, 2.95), {
    depth: gH,
    bevelEnabled: false,
  });
  outerBermGeo.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(outerBermGeo, earthMat));

  // Central altar island inside the trench + trench bottom
  const island = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.52, gH, 28), earthMat);
  island.scale.set(1.0, 1.0, 0.78);
  island.position.y = gH / 2;
  g.add(island);
  span(g, -1.96, 1.96, 0, 0.045, -1.48, 1.48, trenchMat, 1.0);

  // Inner stone hearth core supporting the firewood bed
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.98, 0.76, 20), hearthMat);
  core.scale.set(1.05, 1.0, 0.78);
  core.position.y = gH + 0.38;
  g.add(core);

  // --- 2. EXACTLY 12 Distinct Fieldstone Boulders in a countable perimeter crown (18:31) ---
  const sr = rng(1831);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + 0.13;
    const rx = 1.04;
    const rz = 0.78;
    const rStone = 0.305 + (i % 3) * 0.018;
    const hScale = 1.32 + (i % 2) * 0.12;
    const geo = boulderGeo(rStone, 200 + i * 13, 0.92 + sr() * 0.14, hScale, 0.88 + sr() * 0.14);
    const mat = stoneMats[i % stoneMats.length]!;
    const stone = new THREE.Mesh(geo, mat);
    stone.position.set(Math.cos(ang) * rx, gH - 0.02, Math.sin(ang) * rz);
    stone.rotation.y = -ang + (sr() - 0.5) * 0.35;
    g.add(stone);
  }

  // --- 3. Stacked split firewood laid in order (18:33) ---
  const woodBaseY = 1.12;
  const logR = 0.062;
  const wShrink = fire ? 0.76 : 1.0;
  for (let k = 0; k < 5; k++) {
    const z = (-0.36 + k * 0.18) * wShrink;
    const halfX = (0.86 - Math.abs(k - 2) * 0.08) * wShrink;
    rod(g, new THREE.Vector3(-halfX, woodBaseY + logR, z), new THREE.Vector3(halfX, woodBaseY + logR, z), logR, logMat);
  }
  for (let k = 0; k < 6; k++) {
    const x = (-0.68 + k * 0.27) * wShrink;
    const halfZ = (0.54 - Math.abs(k - 2.5) * 0.05) * wShrink;
    rod(
      g,
      new THREE.Vector3(x, woodBaseY + logR * 2.7, -halfZ),
      new THREE.Vector3(x, woodBaseY + logR * 2.7, halfZ),
      logR,
      logMat,
    );
  }
  const woodTop = woodBaseY + logR * 3.7; // ~1.35 m

  if (!fire) {
    // --- 4a. Prepared burnt-offering bullock pieces laid on the wood (y = 1.35 .. 1.80 m exact) ---
    const chine = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), offeringMat);
    chine.scale.set(1.95, 0.78, 1.08);
    chine.position.set(-0.1, woodTop + 0.19, 0);

    const forequarter = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), offeringMat);
    forequarter.scale.set(1.22, 1.05, 1.06);
    forequarter.position.set(0.34, woodTop + 0.24, 0.03); // top reaches 1.35 + 0.24 + 0.21 = 1.80 m!

    const headCut = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10), offeringMat);
    headCut.scale.set(1.3, 0.85, 0.9);
    headCut.position.set(0.66, woodTop + 0.13, -0.05);
    g.add(chine, forequarter, headCut);

    const cutGeo = new THREE.CapsuleGeometry(0.055, 0.3, 4, 8);
    for (const [lx, lz, ry] of [
      [-0.48, 0.26, 0.25],
      [-0.08, -0.28, -0.3],
      [0.26, 0.28, 0.4],
      [-0.42, -0.24, -0.2],
    ] as const) {
      const piece = new THREE.Mesh(cutGeo, offeringMat);
      piece.rotation.z = Math.PI / 2;
      piece.rotation.y = ry;
      piece.position.set(lx, woodTop + 0.08, lz);
      g.add(piece);
    }

    // --- 4b. Glistening water filling the perimeter trench + 4 two-handled jars (18:33–35) ---
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3b8eb8,
      emissive: 0x0b2d40,
      emissiveIntensity: 0.34,
      roughness: 0.06,
      metalness: 0.28,
      transparent: true,
      opacity: 0.72,
    });
    const trenchWaterGeo = new THREE.PlaneGeometry(3.88, 2.93);
    trenchWaterGeo.rotateX(-Math.PI / 2);
    const trenchWater = new THREE.Mesh(trenchWaterGeo, waterMat);
    trenchWater.position.y = gH - 0.045; // 0.295 m deep glistening water filling trench around island
    trenchWater.userData.water = 1;
    g.add(trenchWater);

    // Water rivulets streaming down between the 12 stones into the trench
    const streamMat = new THREE.MeshStandardMaterial({
      color: 0x8ad0ec,
      emissive: 0x164a63,
      emissiveIntensity: 0.25,
      roughness: 0.05,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    });
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2 + 0.39;
      const rStream = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.78), streamMat);
      rStream.position.set(Math.cos(a) * 1.18, gH + 0.38, Math.sin(a) * 0.9);
      rStream.rotation.y = -a + Math.PI / 2;
      rStream.rotation.x = -0.22;
      g.add(rStream);
    }

    // Four two-handled terracotta water jars (kadim, 1 Kgs 18:33) on the +Z/+X berm
    const terraMat = new THREE.MeshStandardMaterial({ color: 0xb8663b, roughness: 0.8, side: THREE.DoubleSide });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xa15630, roughness: 0.84 });
    const jarCoords: Array<{ x: number; z: number; tilt?: number; rotY: number }> = [
      { x: -1.35, z: 1.88, rotY: 0.25 },
      { x: -0.45, z: 1.96, rotY: -0.4 },
      { x: 0.55, z: 1.76, tilt: -0.62, rotY: 0.1 }, // tilted toward trench pouring final jarful!
      { x: 1.48, z: 1.86, rotY: 0.75 },
    ];
    for (const jc of jarCoords) {
      const jar = buildWaterJar(terraMat, handleMat);
      jar.position.set(jc.x, gH, jc.z);
      jar.rotation.y = jc.rotY;
      if (jc.tilt !== undefined) {
        jar.position.y = gH + 0.08;
        jar.rotation.x = jc.tilt;
        // Translucent pouring arc from the tilted jar mouth into the water-filled trench
        const pour = rod(
          g,
          new THREE.Vector3(jc.x + 0.03, gH + 0.62, jc.z - 0.38),
          new THREE.Vector3(jc.x + 0.02, gH - 0.03, jc.z - 0.62),
          0.032,
          streamMat,
          10,
        );
        pour.userData.water = 2;
      }
      g.add(jar);
    }
  } else {
    // --- 4c. 'fire-from-heaven': Consumed sacrifice + STRICTLY ANICONIC Pillar of Fire (18:38) ---
    // Glowing coal & charred remnant bed atop the stones
    const emberBed = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 20, 14),
      new THREE.MeshStandardMaterial({
        color: 0xff8f29,
        emissive: 0xff4800,
        emissiveIntensity: 1.35,
        roughness: 0.4,
      }),
    );
    emberBed.scale.set(1.22, 0.34, 0.92);
    emberBed.position.y = woodTop - 0.04;
    emberBed.userData.ember = 1;
    g.add(emberBed);

    // Towering strictly-aniconic amber-gold & white-hot consuming fire column (y = 1.05 .. 5.40 m)
    // Pure concentric luminous geometry — ZERO bodily, human, or creaturely silhouette!
    const fireBaseY = 1.05;
    const pillars: Array<{
      rt: number;
      rb: number;
      h: number;
      col: number;
      em: number;
      ei: number;
      op: number;
    }> = [
      { rt: 0.18, rb: 0.46, h: 4.15, col: 0xfff7d1, em: 0xffcf48, ei: 1.65, op: 0.92 },
      { rt: 0.38, rb: 0.82, h: 4.28, col: 0xffc14d, em: 0xff8800, ei: 1.28, op: 0.48 },
      { rt: 0.64, rb: 1.18, h: 4.35, col: 0xff9429, em: 0xff5500, ei: 1.05, op: 0.24 },
    ];
    pillars.forEach((p, idx) => {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(p.rt, p.rb, p.h, 32, 1, true),
        new THREE.MeshStandardMaterial({
          color: p.col,
          emissive: p.em,
          emissiveIntensity: p.ei,
          transparent: true,
          opacity: p.op,
          side: THREE.DoubleSide,
          depthWrite: false,
          roughness: 0.25,
        }),
      );
      col.position.y = fireBaseY + p.h / 2;
      col.userData.flame = idx + 1;
      g.add(col);
    });

    // Twelve upward geometric flame tongues licking around the twelve stones
    const tongueMat = new THREE.MeshStandardMaterial({
      color: 0xffdc78,
      emissive: 0xff7b00,
      emissiveIntensity: 1.38,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    for (let t = 0; t < 12; t++) {
      const a = (t / 12) * Math.PI * 2;
      const th = 0.85 + ((t * 5) % 6) * 0.18;
      const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.14, th, 8), tongueMat);
      tongue.position.set(Math.cos(a) * 0.92, gH + 0.55 + th / 2, Math.sin(a) * 0.7);
      tongue.userData.flame = 10 + t;
      g.add(tongue);
    }

    // Wisps of white steam rising from the licked-dry trench floor (18:38)
    const steamMat = new THREE.MeshStandardMaterial({
      color: 0xf5f2eb,
      roughness: 1,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let w = 0; w < 8; w++) {
      const a = (w / 8) * Math.PI * 2 + 0.2;
      const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.85, 10, 1, true), steamMat);
      wisp.position.set(Math.cos(a) * 1.58, 0.48, Math.sin(a) * 1.18);
      g.add(wisp);
    }
  }

  return g;
}

// ---------------------------------------------------------------------------
// 3. The Shunammite's Walled Upper Room on an Israelite 4-Room House (2 Kgs 4:10)
// ---------------------------------------------------------------------------

/**
 * Two-level Iron Age Israelite four-room pillared courtyard stone house with an
 * exterior stone staircase rising to a walled upper guest chamber (aliyyat-qir)
 * whose cutaway opens directly toward the (+X, +Y, +Z) camera to display ONLY
 * the 4 furnishings named in 2 Kings 4:10: cedar bed, wooden table, chair/stool,
 * and terracotta oil lampstand. Exact rooftop height = 5.20 m (assumedHeight: 5.2).
 */
export function buildShunammiteChamber(
  C: number,
  variant: ShunammiteChamberVariant = 'cutaway',
): THREE.Group {
  void C; // Unmeasured in text; built to assumedHeight = 5.2 m reference scale
  const tex = getNarrativeTex();
  const g = new THREE.Group();
  const open = variant === 'cutaway';

  const fieldMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.fieldstone, roughness: 0.95 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.mudBrick, roughness: 0.95 });
  const chamberMat = new THREE.MeshStandardMaterial({ color: 0xf2e6cf, map: tex.mudBrick, roughness: 0.93 });
  const clayMat = new THREE.MeshStandardMaterial({ color: 0xc8ae85, map: tex.mudBrick, roughness: 0.98 });
  const reedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.reed, roughness: 0.9 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x7a5738, map: tex.timber, roughness: 0.8 });
  const earthMat = new THREE.MeshStandardMaterial({ color: 0xc2ac8c, map: tex.earth, roughness: 0.98 });
  const cedarMat = new THREE.MeshStandardMaterial({ color: 0xc4804e, map: tex.timber, roughness: 0.58 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xa68562, map: tex.timber, roughness: 0.68 });
  const matMat = new THREE.MeshStandardMaterial({ color: 0xdac69a, map: tex.reed, roughness: 0.88 });
  const linenMat = new THREE.MeshStandardMaterial({ color: 0xede5d3, map: tex.weave, roughness: 0.92 });
  const terraMat = new THREE.MeshStandardMaterial({ color: 0xba693f, roughness: 0.78 });

  const socle = 1.05; // fieldstone lower wall courses
  const roofSubY = 2.6; // underside of roof deck
  const floorUp = 2.85; // flat house roof terrace & upper-room floor

  const buildHouseWall = (x0: number, x1: number, z0: number, z1: number, topY = roofSubY): void => {
    span(g, x0, x1, 0, Math.min(socle, topY), z0, z1, fieldMat, 1.2);
    if (topY > socle) span(g, x0, x1, socle, topY, z0, z1, brickMat, 1.4);
  };

  const buildMudRoof = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): void => {
    span(g, x0, x1, y0, y0 + 0.08, z0, z1, reedMat, 0.8);
    span(g, x0, x1, y0 + 0.08, y1, z0, z1, clayMat, 1.4);
  };

  // --- 1. Ground-floor Israelite Four-Room Pillared Courtyard House (-4.6..+4.6 x -3.8..+3.8 m) ---
  span(g, -4.6, 4.6, 0, 0.04, -3.8, 3.8, earthMat, 1.2);

  // Outer perimeter walls (front +Z wall lowered in 'cutaway' to reveal pillared courtyard)
  buildHouseWall(-4.6, 4.6, -3.8, -3.25); // rear north wall
  buildHouseWall(-4.6, -4.05, -3.25, 3.8); // left west wall
  buildHouseWall(4.05, 4.6, -3.25, 3.8, open ? 1.55 : roofSubY); // right east wall lowered in cutaway
  const frontWallH = open ? 0.95 : roofSubY;
  buildHouseWall(-4.05, -0.65, 3.25, 3.8, frontWallH);
  buildHouseWall(0.65, 4.6, 3.25, 3.8, frontWallH);
  if (!open) {
    span(g, -0.8, 0.8, 2.05, 2.22, 3.22, 3.83, beamMat, 1.0);
    span(g, -0.65, 0.65, 2.22, roofSubY, 3.25, 3.8, brickMat, 1.4);
  }

  // Rear broad-room cross wall with doorway
  buildHouseWall(-4.05, -0.55, -1.95, -1.5);
  buildHouseWall(0.55, 4.05, -1.95, -1.5);
  span(g, -0.68, 0.68, 2.02, roofSubY, -1.98, -1.47, beamMat, 1.0);

  // Two rows of monolithic square limestone courtyard pillars + low stone mangers
  for (const sx of [-1.65, 1.65]) {
    for (const pz of [-0.85, 0.45, 1.75, 2.9]) {
      span(g, sx - 0.19, sx + 0.19, 0.04, roofSubY - 0.16, pz - 0.19, pz + 0.19, fieldMat, 1.0);
    }
    span(g, sx - 0.16, sx + 0.16, 0.04, 0.62, -0.65, 1.55, fieldMat, 1.0); // stone manger curb
    span(g, sx - 0.21, sx + 0.21, roofSubY - 0.16, roofSubY, -1.5, 3.25, beamMat, 1.0); // architrave timber
  }

  // Domestic storage pithos jar in ground courtyard (contrasting busy house below with quiet chamber above)
  const pithos = buildWaterJar(terraMat, terraMat);
  pithos.scale.setScalar(1.18);
  pithos.position.set(-2.9, 0.04, 1.9);
  g.add(pithos);

  // Flat house roof over rear broad room and side rooms (central courtyard remains open to sky)
  buildMudRoof(-4.6, 4.6, -3.8, -1.5, roofSubY, floorUp);
  buildMudRoof(-4.6, -1.45, -1.5, 3.8, roofSubY, floorUp);
  buildMudRoof(1.45, 4.6, -1.5, open ? 2.4 : 3.8, roofSubY, floorUp);

  // Torah roof parapet (Deut 22:8) around open roof edges (leaving stair entry on -X open)
  const pT = 0.28;
  const parTop = floorUp + 0.48;
  span(g, -4.6, 0.3, floorUp, parTop, -3.8, -3.8 + pT, brickMat, 1.4);
  span(g, -4.6, -4.6 + pT, floorUp, parTop, -3.8 + pT, -0.9, brickMat, 1.4); // gap at -0.9..+0.2 for stair landing
  span(g, -4.6, -4.6 + pT, floorUp, parTop, 0.25, 3.8, brickMat, 1.4);
  span(g, -4.6, -1.45, floorUp, parTop, 3.8 - pT, 3.8, brickMat, 1.4);
  // Courtyard well curb
  span(g, -1.45, -1.45 + pT, floorUp, parTop, -1.5, 3.8, brickMat, 1.4);
  span(g, -1.45, 0.3, floorUp, parTop, -1.5 - pT, -1.5, brickMat, 1.4);
  if (!open) {
    span(g, 4.6 - pT, 4.6, floorUp, parTop, -0.4, 3.8, brickMat, 1.4);
    span(g, 1.45, 4.6, floorUp, parTop, 3.8 - pT, 3.8, brickMat, 1.4);
    span(g, 1.45 - pT, 1.45, floorUp, parTop, -0.4, 3.8, brickMat, 1.4);
  }

  // --- 2. Exterior Stone Staircase along the left (-X) wall rising directly to the roof ---
  const nSteps = 12;
  const stRise = floorUp / nSteps;
  const stRun = 0.31;
  const stZStart = 3.65;
  for (let i = 0; i < nSteps; i++) {
    span(
      g,
      -5.45,
      -4.6,
      0,
      (i + 1) * stRise,
      stZStart - (i + 1) * stRun,
      stZStart - i * stRun,
      fieldMat,
      1.0,
    );
  }
  // Top stone landing leading onto the west roof terrace (z = -0.95 .. -0.07)
  span(g, -5.45, -4.6, 0, floorUp, -0.95, stZStart - nSteps * stRun, fieldMat, 1.1);

  // --- 3. The Walled Upper Guest Chamber (aliyyat-qir, 2 Kgs 4:10) at x = 0.3..4.6, z = -3.8..-0.4 ---
  // Back (-Z) and Left (-X) walls stand full height (4.94 m), framing the room cleanly while
  // Front (+Z) and Right (+X) walls face the (+X, +Y, +Z) camera and open in 'cutaway'!
  const cx0 = 0.3;
  const cx1 = 4.6;
  const cz0 = -3.8;
  const cz1 = -0.4;
  const cw = 0.32;
  const cWallTop = 4.94;
  const sillCut = floorUp + 0.42;

  // Full-height North (-Z) back wall & West (-X) side wall (with doorway from roof terrace)
  span(g, cx0, cx1, floorUp, cWallTop, cz0, cz0 + cw, chamberMat, 1.3);
  span(g, cx0, cx0 + cw, floorUp, cWallTop, cz0 + cw, -1.85, chamberMat, 1.3);
  span(g, cx0, cx0 + cw, floorUp, cWallTop, -1.1, cz1, chamberMat, 1.3);
  span(g, cx0, cx0 + cw, floorUp + 1.82, cWallTop, -1.85, -1.1, chamberMat, 1.3);
  span(g, cx0 - 0.03, cx0 + cw + 0.03, floorUp + 1.74, floorUp + 1.83, -1.95, -1.0, beamMat, 1.0);
  // Cedar guest door swung slightly inward
  const doorGrp = new THREE.Group();
  span(doorGrp, 0, 0.06, 0, 1.72, 0, 0.72, woodMat, 0.8);
  doorGrp.position.set(cx0 + cw, floorUp + 0.01, -1.83);
  doorGrp.rotation.y = 0.52;
  g.add(doorGrp);

  if (open) {
    // Low cutaway masonry sills on +Z and +X so room boundaries & wall thickness read clearly
    span(g, cx0 + cw, cx1, floorUp, sillCut, cz1 - cw, cz1, chamberMat, 1.3);
    span(g, cx1 - cw, cx1, floorUp, sillCut, cz0 + cw, cz1 - cw, chamberMat, 1.3);
    // In cutaway, keep two rear roof beams + narrow cornice strip at back (-Z) to hit exact 5.20 m height honestly!
    for (const bx of [cx0 + 0.35, cx0 + 0.95]) {
      span(g, bx - 0.06, bx + 0.06, cWallTop - 0.14, cWallTop, cz0 - 0.12, cz0 + 0.55, beamMat, 1.0);
    }
    buildMudRoof(cx0 - 0.04, cx1 + 0.04, cz0 - 0.04, cz0 + 0.42, cWallTop, 5.2);
  } else {
    // 'rooftop': close +Z and +X mud-brick walls (with timber-linteled window on +X & south window on +Z)
    // East (+X) wall with cooling breeze window ("a window toward Shunem")
    span(g, cx1 - cw, cx1, floorUp, cWallTop, cz0 + cw, -2.55, chamberMat, 1.3);
    span(g, cx1 - cw, cx1, floorUp, cWallTop, -1.65, cz1, chamberMat, 1.3);
    span(g, cx1 - cw, cx1, floorUp, floorUp + 1.05, -2.55, -1.65, chamberMat, 1.3);
    span(g, cx1 - cw, cx1, floorUp + 1.65, cWallTop, -2.55, -1.65, chamberMat, 1.3);
    span(g, cx1 - cw - 0.03, cx1 + 0.03, floorUp + 1.58, floorUp + 1.66, -2.68, -1.52, beamMat, 1.0);
    // Wooden window lattice Mullions
    for (const wz of [-2.32, -2.1, -1.88]) {
      rod(g, new THREE.Vector3(cx1 - cw / 2, floorUp + 1.05, wz), new THREE.Vector3(cx1 - cw / 2, floorUp + 1.58, wz), 0.018, woodMat);
    }
    // South (+Z) wall
    span(g, cx0 + cw, cx1 - cw, floorUp, cWallTop, cz1 - cw, cz1, chamberMat, 1.3);

    // Exposed round timber ceiling beams + woven grass/reed matting + rolled clay roof (exact top = 5.20 m)
    for (let x = cx0 + 0.32; x <= cx1 - 0.25; x += 0.48) {
      rod(
        g,
        new THREE.Vector3(x, cWallTop - 0.07, cz0 - 0.16),
        new THREE.Vector3(x, cWallTop - 0.07, cz1 + 0.16),
        0.068,
        beamMat,
        10,
      );
    }
    buildMudRoof(cx0 - 0.05, cx1 + 0.05, cz0 - 0.05, cz1 + 0.05, cWallTop, 5.2);
  }

  // --- 4. ONLY the 4 Named Furnishings of 2 Kings 4:10: Bed, Table, Stool/Chair, Lampstand ---
  const F = floorUp;
  // Subtle lime-plaster floor pad inside the upper chamber
  span(g, cx0 + cw, cx1 - cw, F, F + 0.02, cz0 + cw, cz1 - cw, linenMat, 1.2);
  const fY = F + 0.02;

  // (1) Bed (mittah) — along the back (-Z) wall (2 Kgs 4:10, 21, 32)
  const bx0 = 1.15;
  const bx1 = 3.15;
  const bz0 = -3.32;
  const bz1 = -2.42;
  for (const lx of [bx0 + 0.07, bx1 - 0.07]) {
    for (const lz of [bz0 + 0.07, bz1 - 0.07]) {
      rod(g, new THREE.Vector3(lx, fY, lz), new THREE.Vector3(lx, fY + 0.38, lz), 0.045, cedarMat, 10);
    }
  }
  span(g, bx0, bx1, fY + 0.34, fY + 0.44, bz0, bz1, cedarMat, 0.8); // cedar frame
  span(g, bx0 + 0.05, bx1 - 0.05, fY + 0.44, fY + 0.53, bz0 + 0.05, bz1 - 0.05, matMat, 0.6); // woven mattress
  span(g, bx0 + 0.45, bx1 - 0.08, fY + 0.53, fY + 0.58, bz0 + 0.07, bz1 - 0.07, linenMat, 0.6); // linen sheet
  const bolster = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.72, 14), linenMat);
  bolster.rotation.x = Math.PI / 2;
  bolster.position.set(bx0 + 0.24, fY + 0.6, (bz0 + bz1) / 2);
  g.add(bolster);
  span(g, bx0 - 0.02, bx0 + 0.06, fY + 0.38, fY + 0.82, bz0, bz1, cedarMat, 0.8); // headboard

  // (2) Wooden Table (shulchan) — front-right area, clearly visible from (+X, +Y, +Z)
  const tX = 3.55;
  const tZ = -1.45;
  span(g, tX - 0.42, tX + 0.42, fY + 0.68, fY + 0.74, tZ - 0.3, tZ + 0.3, woodMat, 0.8);
  for (const lx of [-0.34, 0.34]) {
    for (const lz of [-0.23, 0.23]) {
      span(g, tX + lx - 0.032, tX + lx + 0.032, fY, fY + 0.68, tZ + lz - 0.032, tZ + lz + 0.032, woodMat, 0.8);
    }
    span(g, tX + lx - 0.025, tX + lx + 0.025, fY + 0.18, fY + 0.23, tZ - 0.23, tZ + 0.23, woodMat, 0.8);
  }

  // (3) Wooden Stool / Chair (kisse) — set beside the table
  const chX = 2.65;
  const chZ = -1.35;
  span(g, chX - 0.24, chX + 0.24, fY + 0.43, fY + 0.48, chZ - 0.24, chZ + 0.24, woodMat, 0.8);
  for (const lx of [-0.19, 0.19]) {
    for (const lz of [-0.19, 0.19]) {
      span(g, chX + lx - 0.026, chX + lx + 0.026, fY, fY + 0.43, chZ + lz - 0.026, chZ + lz + 0.026, woodMat, 0.8);
    }
  }
  // Low slatted backrest on -X side facing table
  span(g, chX - 0.24, chX - 0.19, fY + 0.48, fY + 0.92, chZ - 0.24, chZ - 0.18, woodMat, 0.8);
  span(g, chX - 0.24, chX - 0.19, fY + 0.48, fY + 0.92, chZ + 0.18, chZ + 0.24, woodMat, 0.8);
  span(g, chX - 0.24, chX - 0.19, fY + 0.82, fY + 0.92, chZ - 0.24, chZ + 0.24, woodMat, 0.8);
  span(g, chX - 0.24, chX - 0.19, fY + 0.64, fY + 0.71, chZ - 0.24, chZ + 0.24, woodMat, 0.8);

  // (4) Terracotta Oil Lampstand (menorah) — beside the bed & doorway
  const lX = 3.75;
  const lZ = -2.85;
  const standProfile = [
    [0, 0],
    [0.17, 0],
    [0.15, 0.06],
    [0.065, 0.16],
    [0.042, 0.55],
    [0.055, 0.58],
    [0.038, 0.96],
    [0.11, 1.02],
    [0.12, 1.05],
    [0, 1.05],
  ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
  const lampStand = new THREE.Mesh(new THREE.LatheGeometry(standProfile, 18), terraMat);
  lampStand.position.set(lX, fY, lZ);
  g.add(lampStand);

  // Pinched-spout clay saucer oil lamp (ner) resting on top of the stand
  const bowlProfile = [
    [0, 0],
    [0.055, 0],
    [0.095, 0.028],
    [0.1, 0.052],
    [0.072, 0.062],
    [0.03, 0.052],
  ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
  const oilLamp = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 16), terraMat);
  oilLamp.position.set(lX, fY + 1.05, lZ);
  const spout = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.028, 0.042), terraMat);
  spout.position.set(lX - 0.095, fY + 1.09, lZ);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.022, 0.085, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe494, emissive: 0xff9d1c, emissiveIntensity: 1.55 }),
  );
  flame.position.set(lX - 0.12, fY + 1.145, lZ);
  flame.userData.flame = 1;
  g.add(oilLamp, spout, flame);

  return g;
}

// ---------------------------------------------------------------------------
// 4. The Palace Garden Court at Susa / Shushan (Esther 1:4–7)
// ---------------------------------------------------------------------------

function flutedShaft(r: number, h: number, flutes: number): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(r * 0.93, r, h, flutes * 4, 1, false);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const rr = Math.hypot(x, z);
    if (rr < 1e-4) continue;
    const a = Math.atan2(z, x);
    const k = 1 - 0.052 * Math.pow(Math.abs(Math.cos((a * flutes) / 2)), 2);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function vesselGeo(profile: number[][]): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0)),
    22,
  );
}

/**
 * Persian fluted white-marble colonnade (exact 7.20 m height, assumedHeight: 7.2)
 * with silver rings, cords of fine white linen and royal purple, white / green / blue
 * canopy hangings, reclining couches of gold and silver, and a 4-stone mosaic pavement
 * (porphyry, white marble, mother-of-pearl, black marble, Esth 1:6).
 * 'pavement-detail' draws back the hangings to display the 4-stone floor & diverse golden vessels (1:7).
 */
export function buildShushanCourt(
  C: number,
  variant: ShushanCourtVariant = 'canopied',
): THREE.Group {
  void C; // Unmeasured in text; built to assumedHeight = 7.2 m reference scale
  const tex = getNarrativeTex();
  const g = new THREE.Group();
  const detail = variant === 'pavement-detail';

  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf5f2eb, roughness: 0.34, metalness: 0.05 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.flute, roughness: 0.3, metalness: 0.05 });
  const mosaicMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.mosaic, roughness: 0.25, metalness: 0.1 });
  const porphyryMat = new THREE.MeshStandardMaterial({ color: 0x882b25, roughness: 0.28, metalness: 0.08 });
  const blackMarbleMat = new THREE.MeshStandardMaterial({ color: 0x1e1d23, roughness: 0.22, metalness: 0.14 });
  const pearlMat = new THREE.MeshStandardMaterial({
    color: 0xf4eee6,
    emissive: 0x262030,
    emissiveIntensity: 0.16,
    roughness: 0.16,
    metalness: 0.28,
  });

  const silverMat = new THREE.MeshStandardMaterial({ color: 0xe0e5eb, metalness: 0.95, roughness: 0.16 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xebb949,
    metalness: 0.92,
    roughness: 0.2,
    emissive: 0x3d2804,
    emissiveIntensity: 0.22,
  });
  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x8a5831, map: tex.timber, roughness: 0.68 });
  const purpleCord = new THREE.MeshStandardMaterial({ color: 0x6c2880, roughness: 0.68 });
  const linenCord = new THREE.MeshStandardMaterial({ color: 0xf4f0e4, roughness: 0.78 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x5c276e, map: tex.weave, roughness: 0.84 });

  // Three hanging colours of Esther 1:6: white (hur), cotton-green/turquoise (karpas), royal blue (tekhelet)
  const hangingCols = [0xf5f1e6, 0x3f8f7d, 0x244c9c];
  const hangingMats = hangingCols.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, map: tex.weave, roughness: 0.88, side: THREE.DoubleSide }),
  );

  // --- 1. White-marble stylobate & 4-stone mosaic pavement (Esth 1:6) ---
  const pH = 0.26;
  span(g, -7.8, 7.8, 0, pH, -5.8, 5.8, marbleMat, 2.0);
  span(g, -3.2, 3.2, 0, pH * 0.5, 5.8, 6.32, marbleMat, 2.0); // front garden step

  const paveGeo = new THREE.PlaneGeometry(14.8, 10.8);
  const puv = paveGeo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < puv.count; i++) {
    puv.setXY(i, (puv.getX(i) * 14.8) / 2.4, (puv.getY(i) * 10.8) / 2.4);
  }
  paveGeo.rotateX(-Math.PI / 2);
  const paveMesh = new THREE.Mesh(paveGeo, mosaicMat);
  paveMesh.position.y = pH + 0.004;
  g.add(paveMesh);

  // Raised 3D opus-sectile border bands & central 4-stone medallion so all 4 stones gleam in 3D relief
  const bY = pH + 0.016;
  span(g, -7.55, 7.55, pH, bY, -5.55, -5.3, porphyryMat, 1.5);
  span(g, -7.55, 7.55, pH, bY, 5.3, 5.55, porphyryMat, 1.5);
  span(g, -7.55, -7.3, pH, bY, -5.3, 5.3, porphyryMat, 1.5);
  span(g, 7.3, 7.55, pH, bY, -5.3, 5.3, porphyryMat, 1.5);
  span(g, -7.3, 7.3, pH, bY + 0.004, -5.3, -5.18, blackMarbleMat, 1.5);
  span(g, -7.3, 7.3, pH, bY + 0.004, 5.18, 5.3, blackMarbleMat, 1.5);

  // Central court 4-stone geometric star medallion (porphyry, alabaster, mother-of-pearl, black marble)
  const medOuter = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.016, 32), blackMarbleMat);
  medOuter.position.y = pH + 0.008;
  const medPorph = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.02, 32), porphyryMat);
  medPorph.position.y = pH + 0.01;
  const medAlab = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.024, 8), marbleMat);
  medAlab.position.y = pH + 0.012;
  const medPearl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.028, 8), pearlMat);
  medPearl.rotation.y = Math.PI / 8;
  medPearl.position.y = pH + 0.014;
  g.add(medOuter, medPorph, medAlab, medPearl);

  // --- 2. Two Rows of Fluted White-Marble Persian Columns + Silver Rings (y = 0.26 .. 7.20 m) ---
  const colXs = [-5.7, -1.9, 1.9, 5.7];
  const rowZs = [-4.1, 4.1];
  const shaftR = 0.3;
  const shaftY0 = 0.96;
  const shaftY1 = 6.28;
  const ringY = 5.78;

  const bellBaseGeo = vesselGeo([
    [0, 0],
    [0.52, 0],
    [0.5, 0.08],
    [0.43, 0.22],
    [0.36, 0.35],
    [0.34, 0.42],
    [0, 0.42],
  ]);
  const shaftGeo = flutedShaft(shaftR, shaftY1 - shaftY0, 16);
  const loopPts: THREE.Vector3[][] = [];

  for (const z of rowZs) {
    const rowLoops: THREE.Vector3[] = [];
    for (const x of colXs) {
      // Plinth + Achaemenid bell base + torus collar
      span(g, x - 0.46, x + 0.46, pH, pH + 0.2, z - 0.46, z + 0.46, marbleMat, 1.2);
      const base = new THREE.Mesh(bellBaseGeo, marbleMat);
      base.position.set(x, pH + 0.2, z);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 10, 28), marbleMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(x, shaftY0 - 0.02, z);

      // Fluted white marble shaft
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      shaft.position.set(x, (shaftY0 + shaftY1) / 2, z);
      g.add(base, collar, shaft);

      // Persian double-volute marble capital with gilded rosette eyes + abacus
      span(g, x - 0.42, x + 0.42, shaftY1, shaftY1 + 0.5, z - 0.3, z + 0.3, marbleMat, 1.2);
      for (const vx of [-0.42, 0.42]) {
        const vol = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.62, 20), marbleMat);
        vol.rotation.x = Math.PI / 2;
        vol.position.set(x + vx, shaftY1 + 0.28, z);
        const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.64, 14), goldMat);
        eye.rotation.x = Math.PI / 2;
        eye.position.copy(vol.position);
        g.add(vol, eye);
      }
      span(g, x - 0.58, x + 0.58, shaftY1 + 0.5, 6.98, z - 0.38, z + 0.38, marbleMat, 1.2);

      // Gleaming silver collar ring + inward silver tie-ring (Esth 1:6)
      const sCollar = new THREE.Mesh(new THREE.TorusGeometry(shaftR + 0.042, 0.036, 10, 32), silverMat);
      sCollar.rotation.x = Math.PI / 2;
      sCollar.position.set(x, ringY, z);
      const inward = -Math.sign(z);
      const sLoop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 10, 24), silverMat);
      sLoop.position.set(x, ringY - 0.11, z + inward * (shaftR + 0.13));
      g.add(sCollar, sLoop);

      rowLoops.push(new THREE.Vector3(x, ringY - 0.19, z + inward * (shaftR + 0.13)));
    }
    // Cedar architrave beam & gold cornice band crowning at exact y = 7.20 m
    span(g, -6.35, 6.35, 6.98, 7.2, z - 0.3, z + 0.3, cedarMat, 1.4);
    span(g, -6.38, 6.38, 6.95, 6.99, z - 0.32, z + 0.32, goldMat, 1.4);
    loopPts.push(rowLoops);
  }

  // --- 3. White, Green/Cotton & Royal-Blue Canopies + Fine-Linen & Purple Cords (Esth 1:6) ---
  const bays = [-3.8, 0, 3.8];
  const bayW = 3.25;
  const bayD = 7.2;
  const edgeY = 5.44;
  const sag = 0.54;

  bays.forEach((bx, bi) => {
    const mat = hangingMats[bi]!;
    const leftCol = bi;
    const rightCol = bi + 1;
    if (!detail) {
      // Full catenary-draped overhead canopy
      const geo = new THREE.PlaneGeometry(bayW, bayD, 12, 24);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const pz = pos.getZ(i);
        const fz = 1 - Math.pow((2 * pz) / bayD, 2);
        const fx = 1 - Math.pow((2 * px) / bayW, 2);
        pos.setY(i, -sag * fz - 0.12 * fx * fz);
      }
      geo.computeVertexNormals();
      const canopy = new THREE.Mesh(geo, mat);
      canopy.position.set(bx, edgeY, 0);
      g.add(canopy);

      // Paired fine-linen & purple tension cords from every canopy corner to the silver rings!
      rowZs.forEach((z, ri) => {
        const loops = loopPts[ri]!;
        const sgn = Math.sign(z);
        [leftCol, rightCol].forEach((ci, k) => {
          const lp = loops[ci]!;
          const corner = new THREE.Vector3(bx + (k === 0 ? -bayW / 2 : bayW / 2), edgeY, sgn * (bayD / 2));
          const midOffset = new THREE.Vector3(0, 0.04, 0);
          rod(g, lp, corner, 0.02, purpleCord, 6);
          rod(g, lp.clone().add(midOffset), corner.clone().add(midOffset), 0.018, linenCord, 6);
        });
      });

      // Outer colonnade festoon valances
      for (const z of rowZs) {
        const val = new THREE.Mesh(new THREE.PlaneGeometry(bayW, 0.68, 8, 1), mat);
        val.position.set(bx, 6.08, z + Math.sign(z) * 0.46);
        g.add(val);
        rod(
          g,
          new THREE.Vector3(bx - bayW / 2, 6.42, z + Math.sign(z) * 0.46),
          new THREE.Vector3(bx + bayW / 2, 6.42, z + Math.sign(z) * 0.46),
          0.02,
          silverMat,
          6,
        );
      }
    } else {
      // 'pavement-detail': canopies furled back along both colonnades & bound with purple/linen cords
      for (const [ri, z] of rowZs.entries()) {
        const sgn = Math.sign(z);
        const rollZ = sgn * (Math.abs(z) - 0.62);
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, bayW, 18), mat);
        roll.rotation.z = Math.PI / 2;
        roll.position.set(bx, ringY - 0.28, rollZ);
        const drape = new THREE.Mesh(new THREE.PlaneGeometry(bayW, 0.58, 8, 1), mat);
        drape.position.set(bx, ringY - 0.6, rollZ);
        g.add(roll, drape);

        const loops = loopPts[ri]!;
        [leftCol, rightCol].forEach((ci, k) => {
          const lp = loops[ci]!;
          const end = new THREE.Vector3(bx + (k === 0 ? -bayW / 2 : bayW / 2), ringY - 0.28, rollZ);
          rod(g, lp, end, 0.02, purpleCord, 6);
          rod(g, lp.clone().add(new THREE.Vector3(0, 0.035, 0)), end, 0.017, linenCord, 6);
        });
      }
    }
  });

  // --- 4. Reclining Banquet Couches of Gold and Silver (Esth 1:6) ---
  const addCouch = (x: number, z: number, metal: THREE.Material, headLeft: boolean): void => {
    const L = 2.05;
    const W = 0.84;
    const legGeo = vesselGeo([
      [0, 0],
      [0.062, 0],
      [0.044, 0.12],
      [0.072, 0.22],
      [0.04, 0.34],
      [0.062, 0.44],
      [0, 0.44],
    ]);
    for (const lx of [-L / 2 + 0.11, L / 2 - 0.11]) {
      for (const lz of [-W / 2 + 0.08, W / 2 - 0.08]) {
        const leg = new THREE.Mesh(legGeo, metal);
        leg.position.set(x + lx, pH, z + lz);
        g.add(leg);
      }
    }
    span(g, x - L / 2, x + L / 2, pH + 0.44, pH + 0.54, z - W / 2, z + W / 2, metal, 1);
    span(
      g,
      x - L / 2 + 0.04,
      x + L / 2 - 0.04,
      pH + 0.54,
      pH + 0.66,
      z - W / 2 + 0.04,
      z + W / 2 - 0.04,
      cushionMat,
      0.8,
    );
    const hx = headLeft ? x - L / 2 : x + L / 2;
    const headRest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, W), metal);
    headRest.position.set(hx, pH + 0.74, z);
    headRest.rotation.z = headLeft ? -0.24 : 0.24;
    const bolster = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, W - 0.1, 16), cushionMat);
    bolster.rotation.x = Math.PI / 2;
    bolster.position.set(hx + (headLeft ? 0.2 : -0.2), pH + 0.75, z);
    g.add(headRest, bolster);
  };

  addCouch(-3.3, -2.35, goldMat, true);
  addCouch(3.3, -2.35, silverMat, false);
  addCouch(-3.3, 2.35, silverMat, true);
  addCouch(3.3, 2.35, goldMat, false);

  // --- 5. Golden Drinking Vessels Diverse One from Another (Esth 1:7) ---
  // Shown on low banquet tables beside the couches (prominent in 'pavement-detail', subtle in 'canopied')
  const vesselProfiles: number[][][] = [
    // 1. Footed royal goblet
    [
      [0, 0],
      [0.07, 0],
      [0.018, 0.035],
      [0.018, 0.12],
      [0.072, 0.17],
      [0.082, 0.27],
      [0.07, 0.27],
    ],
    // 2. Shallow Achaemenid lobed phiale wine bowl
    [
      [0, 0],
      [0.06, 0],
      [0.125, 0.035],
      [0.155, 0.075],
      [0.142, 0.08],
    ],
    // 3. Slender tall-necked golden flagon
    [
      [0, 0],
      [0.055, 0],
      [0.092, 0.085],
      [0.082, 0.18],
      [0.032, 0.26],
      [0.048, 0.33],
      [0.036, 0.33],
    ],
    // 4. Fluted bellied crater-cup
    [
      [0, 0],
      [0.05, 0],
      [0.095, 0.055],
      [0.11, 0.14],
      [0.085, 0.19],
      [0.105, 0.23],
      [0.092, 0.23],
    ],
    // 5. Conical fluted horn-beaker (geometric Achaemenid cup)
    [
      [0, 0],
      [0.025, 0],
      [0.042, 0.09],
      [0.068, 0.2],
      [0.092, 0.29],
      [0.082, 0.29],
    ],
    // 6. Domed lidded golden banquet pyxis
    [
      [0, 0],
      [0.082, 0],
      [0.082, 0.11],
      [0.092, 0.125],
      [0.048, 0.175],
      [0.016, 0.215],
      [0, 0.215],
    ],
  ];

  const tableCoords: Array<[number, number]> = detail
    ? [
        [-3.3, -1.15],
        [3.3, -1.15],
        [-3.3, 1.15],
        [3.3, 1.15],
      ]
    : [
        [-3.3, 1.15],
        [3.3, 1.15],
      ];

  const tTop = pH + 0.5;
  tableCoords.forEach(([tx, tz], ti) => {
    span(g, tx - 0.56, tx + 0.56, tTop - 0.05, tTop, tz - 0.34, tz + 0.34, cedarMat, 0.8);
    span(g, tx - 0.58, tx + 0.58, tTop - 0.068, tTop - 0.048, tz - 0.36, tz + 0.36, goldMat, 0.8);
    for (const lx of [-0.46, 0.46]) {
      for (const lz of [-0.26, 0.26]) {
        span(g, tx + lx - 0.032, tx + lx + 0.032, pH, tTop - 0.05, tz + lz - 0.032, tz + lz + 0.032, cedarMat, 0.8);
      }
    }
    for (let k = 0; k < 3; k++) {
      const idx = (ti * 3 + k) % vesselProfiles.length;
      const prof = vesselProfiles[idx]!;
      const vx = tx - 0.34 + k * 0.34;
      const vz = tz + (k % 2 === 0 ? -0.08 : 0.09);
      const cup = new THREE.Mesh(vesselGeo(prof), goldMat);
      cup.position.set(vx, tTop, vz);
      g.add(cup);
      // Distinct handles on flagon (idx === 2) and twin-handled kantharos (idx === 3)
      if (idx === 2) {
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 16, Math.PI), goldMat);
        h.rotation.z = -Math.PI / 2;
        h.position.set(vx + 0.065, tTop + 0.2, vz);
        g.add(h);
      } else if (idx === 3) {
        for (const sx of [-1, 1]) {
          const h = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.01, 8, 16, Math.PI), goldMat);
          h.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
          h.position.set(vx + sx * 0.088, tTop + 0.15, vz);
          g.add(h);
        }
      }
    }
  });

  return g;
}

// ---------------------------------------------------------------------------
// Measured-to-Spec Card Metadata (OT_MONUMENT_SPECS)
// ---------------------------------------------------------------------------

/**
 * Measured-to-Spec card metadata for the 4 Old-Testament narrative monuments,
 * indented identically to STRUCTURES in src/structures/specs.ts so audit-events.mjs
 * parses every 4-space `id` and `ref` cleanly.
 */
export const OT_MONUMENT_SPECS: OtMonumentSpec[] = [
  {
    id: 'nehemiah-wall',
    zh: '尼希米重修的耶路撒冷城墙',
    en: "Nehemiah's Rebuilt Wall of Jerusalem",
    ref: 'Nehemiah 3:8',
    refZh: '尼希米记 3:8',
    textZh: '其次是银匠哈海雅的儿子乌薛修造；其次是做香的哈拿尼雅修造。他们修坚耶路撒冷，直到宽墙。',
    textEn: 'Uzziel son of Harhaiah, one of the goldsmiths, repaired the next section; and Hananiah, one of the perfume-makers, made repairs next to that. They restored Jerusalem as far as the Broad Wall.',
    dims: [
      { key: 'valleyToDung', zh: '谷门到粪厂门城墙段长', en: 'Valley Gate to Dung Gate span', cubits: 1000, ref: '尼 3:13', refEn: 'Neh 3:13' },
    ],
    kind: 'nehemiahWall',
    walk: 'nehemiah',
    counts: [
      { zh: '尼希米记第三章点名的城门', en: 'Named gates in Nehemiah 3', n: 10, ref: '尼 3:1–32', refEn: 'Neh 3:1–32' },
      { zh: '点名的城楼（哈米亚楼、哈楠业楼、炉楼、凸出来的楼）', en: 'Named towers (Meah, Hananel, Furnaces, Projecting)', n: 4, ref: '尼 3:1, 11, 25–27', refEn: 'Neh 3:1, 11, 25–27' },
      { zh: '城墙完工所用日数', en: 'Days to finish the wall', n: 52, ref: '尼 6:15', refEn: 'Neh 6:15' },
      { zh: '在城墙上行走称谢的大队', en: 'Wall-top thanksgiving choirs', n: 2, ref: '尼 12:31', refEn: 'Neh 12:31' },
    ],
    variants: {
      key: 'nehemiahWallView',
      zh: '展示视角',
      en: 'Display view',
      options: [
        {
          id: 'broad-wall',
          zh: '宽墙 · 城门与城楼',
          en: 'Broad Wall · gate & tower',
          note: '呈现宽墙、凸出城楼与双扇木城门：外侧琢石面、城内粗石面与登墙石阶，门内安有包铁大木闩与守卫房（尼 3:3、6、13–15）。',
          noteEn: 'Shows a monumental Broad Wall, projecting tower, and twin-leaf gate: dressed outer ashlar, rough fieldstone inner face with wall stairs, timber crossbar, and guardroom (Neh 3:3, 6, 13–15).',
        },
        {
          id: 'gate-cutaway',
          zh: '剖面 · 碎石墙心与木横梁',
          en: 'Cutaway · rubble core & crossbars',
          note: '揭开右侧外墙面与女墙，露出两层石面之间的碎石大石填心与纵横木拉梁；城门一扇向内推开、木闩抽出卯槽，另一扇切开显出双层厚木板结构。',
          noteEn: 'Peels back the outer stone skin and parapet to expose the boulder-and-rubble core and timber crossbars; swings one gate leaf open with the bar drawn back, and slices the other leaf to reveal its two-ply plank core.',
        },
      ],
    },
    unstated: [
      {
        zh: '经文给出的唯一尺寸是谷门到粪厂门「修城墙一千肘」（尼 3:13，约 445 至 523 米），并未记载城墙的高度与厚度。模型截取约 24 肘宽、18 肘高的城门与宽墙局部，而非拉出四百多米的细长石带，以便在 1.72 米参照人像旁看清城防构造。',
        en: 'The sole explicit dimension in the text is the 1,000-cubit Valley-to-Dung Gate span (Neh 3:13; ~445–523 m); wall height and thickness are unstated. Rather than drawing a 445 m ribbon, the model cuts a ~24 × 16 × 18 cubit Broad Wall, gate, and tower section that reads clearly beside the 1.72 m human figure.',
      },
      {
        zh: '约 7 米（约 15.5 肘）的「宽墙」厚度来自考古实测：20 世纪 70 年代在耶路撒冷犹太区发掘出一段约 7 米厚的铁器时代晚期石墙（多归入希西家加固工程，参赛 22:10），学界普遍认为即尼 3:8 与 12:38 所提的「宽墙」。这一厚度属于考古比定，而非经文数字。',
        en: "The ~7 m (~15.5-cubit) Broad Wall thickness is archaeological, measured on the late Iron Age fortification excavated in Jerusalem's Jewish Quarter in the 1970s (widely linked to Hezekiah in Isa 22:10 and identified with the Broad Wall of Neh 3:8; 12:38), not a figure written in Scripture.",
      },
      {
        zh: '门洞宽高、城楼高度、守卫房布局均参照铁器时代及波斯时期城门考古形制；经文只记各段「立起门扇，安上门闩和横木」。两队城上称谢的诗班仅列于计数，不在模型中塑人像。',
        en: 'Gate dimensions, tower height, and guardroom layout follow Iron Age and Persian-period gate archaeology; the text records only setting up the doors, bolts, and bars. The two thanksgiving choirs are recorded in the counts rather than sculpted as figures.',
      },
    ],
    punchZh: '单是谷门到粪厂门这一段就达 **一千肘（约 445 米）**，整圈十座城门、四座城楼却只用 **五十二天** 修完（尼 6:15）。站在约 **7 米厚** 的宽墙切面旁，四个 **1.72 米** 的成年人首尾相接躺下，才刚刚够横跨墙顶的步道——难怪两大队称谢诗班能在城墙顶上并肩游行（尼 12:31、38）。',
    punchEn: '**1,000 cubits (~445 m)** between the Valley Gate and Dung Gate alone — yet all ten gates and the entire circuit were completed in **52 days** (Neh 6:15). Beside a **1.72 m** person, the **~7 m** Broad Wall is wide enough for four adults lying head-to-toe across the wall-walk where the two thanksgiving choirs marched (Neh 12:31, 38).',
    compare: [
      { zh: '谷门到粪厂门段长（1000 肘）', en: 'Valley Gate to Dung Gate span (1,000 c)', m: 445 },
      { zh: '宽墙城楼参照高（18 肘）', en: 'Tower reference height (18 c)', m: 8.01 },
      { zh: '宽墙厚度（考古实测约 7 米）', en: 'Broad Wall thickness (archaeological)', m: 7.0 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'carmel-altar',
    zh: '以利亚在迦密山筑的十二石坛',
    en: "Elijah's Twelve-Stone Altar on Mount Carmel",
    ref: '1 Kings 18:31',
    refZh: '列王纪上 18:31',
    textZh: '以利亚照雅各子孙支派的数目，取了十二块石头（雅伟的话曾临到雅各说：「你的名要叫以色列。」），用这些石头为雅伟的名筑一座坛，在坛的四围挖沟，可容谷种二细亚。',
    textEn: "Elijah took twelve stones, one for each of the tribes descended from Jacob, to whom the word of Yahweh had come, saying, 'Your name shall be Israel.' With the stones he built an altar in the name of Yahweh, and he dug a trench around it large enough to hold two seahs of seed.",
    dims: [],
    kind: 'carmelAltar',
    assumedHeight: 1.8,
    counts: [
      { zh: '筑坛的石头（照雅各子孙十二支派）', en: "Stones (for Jacob's twelve tribes)", n: 12, ref: '王上 18:31', refEn: '1 Kgs 18:31' },
      { zh: '坛四围水沟容量（谷种细亚数）', en: 'Perimeter trench capacity (seahs of seed)', n: 2, ref: '王上 18:32', refEn: '1 Kgs 18:32' },
      { zh: '每次盛满水的桶/缸数', en: 'Water jars filled per pouring', n: 4, ref: '王上 18:33', refEn: '1 Kgs 18:33' },
      { zh: '连倒三次的次数', en: 'Pourings over offering & wood', n: 3, ref: '王上 18:34', refEn: '1 Kgs 18:34' },
      { zh: '倾倒的总缸数（4 缸 × 3 次）', en: 'Total jars of water poured (4 × 3)', n: 12, ref: '王上 18:33–34', refEn: '1 Kgs 18:33–34' },
    ],
    variants: {
      key: 'carmelAltarView',
      zh: '叙事时刻',
      en: 'Narrative moment',
      options: [
        {
          id: 'water-filled',
          zh: '十二缸水倾注 · 沟里满了水',
          en: 'Water-filled trench · four jars',
          note: '外圈可逐一数出十二块天然大石，坛上摆好木柴与切块的燔祭公牛；四只双耳陶水缸连倒三次，水流在坛的四围，沟里也满了水（王上 18:33–35）。',
          noteEn: 'Twelve countable unhewn fieldstones ring the hearth beneath stacked wood and the cut bullock; four amphora jars poured three times soak the stones and fill the perimeter trench with glistening water (1 Kgs 18:33–35).',
        },
        {
          id: 'fire-from-heaven',
          zh: '天火降临 · 烧干沟水',
          en: 'Fire from heaven · consuming pillar',
          note: '「于是雅伟降下火来，烧尽燔祭、木柴、石头、尘土，又烧干沟里的水」（王上 18:38）。降下的火严守无像原则，仅以纯粹的琥珀金光火焰柱呈现。',
          noteEn: '"Then the fire of Yahweh fell and burned up the sacrifice, the wood, the stones and the soil, and also licked up the water in the trench" (1 Kgs 18:38) — rendered strictly aniconically as a pure amber-gold pillar of consuming fire.',
        },
      ],
    },
    unstated: [
      {
        zh: '经文只记石头与水缸的数目，未给祭坛长宽高。模型取 1.8 米为至燔祭顶部的参照高度（契合出 20:25–26 不凿石、不设台阶就能在坛旁献祭的尺度），并将十二块原石排成一圈，方便读者逐块点数。',
        en: 'Scripture specifies counts rather than linear dimensions. The 1.8 m reference height to the top of the offering fits an unhewn altar workable from ground level without steps (cf. Exod 20:25–26), with all twelve boulders arranged around the perimeter so each stone can be counted.',
      },
      {
        zh: '「可容谷种二细亚」（王上 18:32）有两种解释：一指水沟本身的容积约合二细亚（约 15 至 24 升）；二指水沟围出的地面相当于撒二细亚谷种的面积。模型中的环沟宽深仅为示意。',
        en: '"Large enough to hold two seahs of seed" (1 Kgs 18:32) is read either as trench volume (~15–24 litres) or as the ground area sown by two seahs of seed; the trench width and depth here are illustrative.',
      },
      {
        zh: '陶水缸的具体容量与雅伟之火的视觉形态经文均未描述；火焰柱完全采用纯粹几何光柱与火舌，绝不附加任何人形或受造物形像。',
        en: 'Jar capacity and the visual form of the fire are unstated; the consuming fire is built strictly from geometric light columns and flame cones with zero anthropomorphic form.',
      },
    ],
    punchZh: '在南北分裂的时代，以利亚偏偏取了 **十二块石头**——照雅各十二支派的数目筑一座高不过胸口（参照高 **1.8 米**）的野石坛；再用四只水缸连倒三次、共 **十二缸水** 灌满四围的沟，直到天火降下，连石头、尘土与满沟的水一并烧尽（王上 18:31–38）。',
    punchEn: 'In a divided kingdom, Elijah deliberately laid **12 fieldstones** for all twelve tribes of Jacob at chest-to-shoulder scale (**1.8 m** reference height), drenched them with **4 jars × 3 = 12 jarfuls** of water until the 2-seah trench overflowed, before fire fell and consumed offering, wood, stones, soil, and trench water alike (1 Kgs 18:31–38).',
    compare: [
      { zh: '会幕铜祭坛高（3 肘）', en: 'Tabernacle bronze altar height (3 c)', m: 1.34 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '迦密山石坛参照高度', en: 'Carmel altar reference height', m: 1.8 },
    ],
  },
  {
    id: 'shunammite-chamber',
    zh: '书念妇人为以利沙盖的墙上小楼',
    en: "The Shunammite's Upper Chamber for Elisha",
    ref: '2 Kings 4:10',
    refZh: '列王纪下 4:10',
    textZh: '我们可以为他在墙上盖一间小楼，在其中安放床榻、桌子、椅子、灯台。他来到我们这里，就可以住在其中。',
    textEn: "Let's make a small walled upper room and put in it a bed and a table, a chair and a lampstand for him. Then he can stay there whenever he comes to us.",
    dims: [],
    kind: 'shunammiteChamber',
    assumedHeight: 5.2,
    counts: [
      { zh: '楼内点名安放的家具器物（床榻、桌子、椅子、灯台）', en: 'Named furnishings inside (bed, table, chair, lampstand)', n: 4, ref: '王下 4:10', refEn: '2 Kgs 4:10' },
      { zh: '香柏木床榻', en: 'Bed (mittah)', n: 1, ref: '王下 4:10, 21', refEn: '2 Kgs 4:10, 21' },
      { zh: '木桌与木椅（各一）', en: 'Table and chair/stool (1 each, 2 pieces)', n: 2, ref: '王下 4:10', refEn: '2 Kgs 4:10' },
      { zh: '陶油灯台', en: 'Lampstand (menorah)', n: 1, ref: '王下 4:10', refEn: '2 Kgs 4:10' },
    ],
    variants: {
      key: 'shunammiteView',
      zh: '展示视角',
      en: 'Display view',
      options: [
        {
          id: 'cutaway',
          zh: '剖面 · 小楼四器与四室石屋',
          en: 'Cutaway · upper room & 4 furnishings',
          note: '切开上层小楼近侧墙与屋顶，只陈列经文点名的四样器物——香柏木床榻、木桌、木椅与陶油灯台；下层展示典型铁器时代以色列四室柱院石屋与外侧登顶石阶。',
          noteEn: 'Cuts open the upper guest room (aliyya) to show ONLY the four named items — cedar bed, wooden table, chair/stool, and terracotta oil lampstand — above an Israelite four-room pillared courtyard house with exterior stairs.',
        },
        {
          id: 'rooftop',
          zh: '合顶 · 泥砖墙与草席木梁顶',
          en: 'Closed · mud-brick & reed-beam roof',
          note: '四面泥砖灰泥墙砌齐，上铺圆木横梁、草席与压实泥顶（总高 5.2 米），侧面开木格小窗，平顶四围筑有护栏（申 22:8）。',
          noteEn: 'Closes the plastered mud-brick walls under round ceiling beams, woven reed/grass matting, and packed clay roofing (5.2 m total height), surrounded by a rooftop parapet (Deut 22:8).',
        },
      ],
    },
    unstated: [
      {
        zh: '经文只说「一间有墙的小楼」（עֲלִיַּת־קִיר，王下 4:10），未给长宽高。模型取总高 5.2 米（下层院屋高约 2.85 米，上层小楼高约 2.35 米）作为铁器时代两层民居的参照尺度。',
        en: 'Scripture calls it "a small walled upper chamber" (aliyyat-qir, 2 Kgs 4:10) without dimensions. The 5.2 m reference height (~2.85 m ground storey plus ~2.35 m upper room) reflects typical Iron Age two-level domestic construction.',
      },
      {
        zh: '下层的「四室柱院屋」及外侧露石阶梯依据铁器时代以色列民居考古复原（外梯使客旅出入不必穿过内室），经文并未描写书念妇人住宅的下层平面。',
        en: 'The pillared four-room courtyard house below and the exterior stone staircase follow Iron Age Israelite domestic archaeology (allowing a guest to come and go straight from the street); the ground-floor layout is not described in the text.',
      },
      {
        zh: '此处「灯台」希伯来文虽亦作 menorah（מְנוֹרָה），但在民居中指承托单盏捏嘴陶油灯的陶制或木制灯架，并非圣所七枝金灯台；床、桌、椅的具体木作造型亦按铁器时代日常家具复原。',
        en: 'Although Hebrew uses menorah for the lampstand, in a private home this denotes a household stand holding a single pinched-spout clay oil lamp, not the seven-branched sanctuary lampstand; furniture joinery follows Iron Age domestic finds.',
      },
    ],
    punchZh: '没有金银帷幔，只有经文逐一点名的 **四件日常家具：一张床、一张桌、一把椅、一座灯台**（王下 4:10）。正是这张安静摆在二楼泥砖小屋里的客床，后来承接了书念妇人死去的独生子，见证孩子在房里连打 **七次嚏**、重新睁开眼睛（王下 4:21、32–35）。',
    punchEn: 'No gold or tapestries — only **four everyday furnishings** named one by one: **1 bed, 1 table, 1 chair, 1 lampstand** (2 Kgs 4:10). Yet on that very bed inside this modest **5.2 m**-high rooftop room the Shunammite laid her dead son, and there the child sneezed seven times and opened his eyes (2 Kgs 4:21, 32–35).',
    compare: [
      { zh: '现代两层住宅（约）', en: 'Modern two-storey house (approx.)', m: 6.0 },
      { zh: '书念妇人院屋连小楼参照高', en: 'House & upper room reference height', m: 5.2 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'shushan-court',
    zh: '书珊城王宫御园的院子',
    en: 'The Palace Garden Court at Shushan (Susa)',
    ref: 'Esther 1:6',
    refZh: '以斯帖记 1:6',
    textZh: '有白色、绿色、蓝色的帐子，用细麻绳、紫色绳从银环内系在白玉石柱上；有金银的床榻摆在红、白、黄、黑玉石铺的石地上。',
    textEn: 'There were hangings of white, green and blue, fastened with cords of fine linen and purple to silver rings and pillars of marble; the couches were of gold and silver, on a pavement of porphyry, marble, mother-of-pearl and black stone.',
    dims: [],
    kind: 'shushanCourt',
    assumedHeight: 7.2,
    counts: [
      { zh: '展示帝国荣耀财富的日数', en: 'Days displaying imperial riches', n: 180, ref: '斯 1:4', refEn: 'Esth 1:4' },
      { zh: '王宫御园院子设摆筵席的日数', en: 'Days of court garden banquet', n: 7, ref: '斯 1:5', refEn: 'Esth 1:5' },
      { zh: '天篷帐子的颜色（白、绿/棉、蓝）', en: 'Canopy hanging colours (white, green/cotton, blue)', n: 3, ref: '斯 1:6', refEn: 'Esth 1:6' },
      { zh: '镶嵌铺地的名贵石材（红、白、云母/黄、黑）', en: 'Mosaic pavement stones (porphyry, alabaster, pearl, black marble)', n: 4, ref: '斯 1:6', refEn: 'Esth 1:6' },
    ],
    variants: {
      key: 'shushanView',
      zh: '展示视角',
      en: 'Display view',
      options: [
        {
          id: 'canopied',
          zh: '三色天篷张开 · 银环与紫细麻绳',
          en: 'Draped canopies · silver rings & cords',
          note: '两排凹槽白玉石柱上架起香柏木贴金横梁，白、绿（棉）、蓝三色帐篷借细麻绳与紫色绳紧系在石柱的银环上（斯 1:6）。',
          noteEn: 'Fluted white-marble columns with Persian double-volute capitals carry white, turquoise-cotton, and royal-blue canopies tensioned by fine-linen and purple cords to silver column rings (Esth 1:6).',
        },
        {
          id: 'pavement-detail',
          zh: '收起帐篷 · 四色镶嵌石地与各异金器',
          en: 'Pavement detail · 4-stone inlay & gold vessels',
          note: '将三色帐子收起束在石柱旁，完整显露红斑石、白玉、珍珠母、黑大理石四色拼花石地、金银卧榻，以及「器皿各有不同」的纯金酒器（斯 1:6–7）。',
          noteEn: 'Draws back the canopies to reveal the four-stone mosaic floor (porphyry, white marble, mother-of-pearl, black marble), gold and silver couches, and golden drinking vessels "diverse one from another" (Esth 1:6–7).',
        },
      ],
    },
    unstated: [
      {
        zh: '以斯帖记详列材质、颜色与日数，却未记一处长宽高尺寸。模型按高 7.2 米复原一座尺度亲人的御园凉亭柱廊（考古发掘的书珊百柱大殿石柱高达约 19 至 20 米，而斯 1:5 明言筵席设在「王宫御园的院子里」而非大殿内）。',
        en: "Esther itemises materials, colours, and durations without giving linear dimensions. The 7.2 m reference height models an intimate garden-court pavilion rather than Susa's ~19–20 m Apadana hall columns, matching Esth 1:5 (\"in the court of the garden of the king's palace\").",
      },
      {
        zh: '斯 1:6 四种铺地石材的希伯来文专名（bahat、shesh、dar、socheret）学界考证不一，通常比定为红斑石、雪花白玉、珍珠母（或黄玉）与黑石；「绿色」（karpas，波斯/梵语借词）原意为细棉布，模型取青绿细棉色调兼顾两种译法。',
        en: 'Exact identifications of the four Hebrew stone terms (bahat, shesh, dar, socheret) vary among scholars — rendered here as red porphyry, white marble/alabaster, mother-of-pearl, and black marble — while karpas ("green" / fine cotton) is tinted turquoise-green.',
      },
      {
        zh: '石柱根数、金银卧榻张数与金杯的具体器形经文均未规定；桌上六种金杯故意做成造型各异，以回应「用金器皿赐酒，器皿各有不同」（斯 1:7）。',
        en: 'Column count, couch count, and individual cup profiles are unstated; six distinct golden vessel silhouettes are modelled specifically to reflect "vessels of gold, the vessels being diverse one from another" (Esth 1:7).',
      },
    ],
    punchZh: '整整 **一百八十天** 的帝国炫富之后，又是 **七天** 御园豪宴：三色帐子、两色绳索、银环白玉柱、金银卧榻、四色拼花石地、**没有两只重样的金酒杯**（斯 1:4–7）。以斯帖记全卷未提一次神的名，开篇却把波斯王庭的排场细数到脚下每一块石头——为后文整场权势的忽然翻转埋下最强烈的反差。',
    punchEn: "After **180 days** of imperial display came **7 days** in the garden court: **3** canopy colours, **2** cord dyes, silver rings on marble pillars, gold and silver couches on a **4-stone** mosaic floor, and golden cups **no two alike** (Esth 1:4–7) — itemised down to the pavement before the silent providence of Esther overturns the empire's schemes.",
    compare: [
      { zh: '波斯波利斯大殿石柱（约）', en: 'Persepolis Apadana column (approx.)', m: 19.0 },
      { zh: '书珊御园柱廊参照高度', en: 'Shushan garden court reference height', m: 7.2 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
];
