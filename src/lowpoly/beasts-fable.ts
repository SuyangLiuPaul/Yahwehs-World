import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A LOW-POLY GIRAFFE AND ELEPHANT, GENERATED IN CODE — the "fable" entry.
//
// Style: Poly-by-Google. Real proportions, a skin of a few hundred large flat
// triangles, no texture, one colour per triangle. On the giraffe the patches
// are nothing more than triangles painted brown.
//
// How this differs from a plain tube loft, which is what makes a model read as
// a toy assembled from pipes:
//   - every station of a loft carries its own side count, so the body can be
//     ten-sided while the trunk or the neck falls to six, and the strip between
//     two rings of different counts is stitched by walking both rings by angle;
//   - ring vertices are jittered (seeded) around and along the spine, and the
//     diagonal of each quad is chosen at random, so the facets are irregular
//     large triangles rather than a regular grid;
//   - cross-sections are superellipses with separate up and down (fore and aft
//     on a leg) radii, so a back can be flat while a belly hangs, and a thigh
//     can carry its muscle behind the bone.
//
// Units are metres. Both animals face +x and stand on y = 0.

type Vec = [number, number, number];

/** One cross-section of a lofted body.
 *  `w` half-width along the side axis; `up`/`down` half-heights along the frame's
 *  up axis (for a leg, whose spine points down, "up" is forward). `k` is the
 *  superellipse exponent: 1 is an ellipse, smaller is squarer. `n` sides. */
interface Station { at: Vec; w: number; up: number; down?: number; k?: number; n?: number }

interface LoftOpts {
  seed?: number;
  sides?: number;
  jitter?: number;
  /** cap offsets along the spine; `false` leaves the end open */
  capStart?: number | false;
  capEnd?: number | false;
}

// ── small deterministic randomness ─────────────────────────────────────────

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A hash of a point to [0,1). Used per triangle (on its centroid) and on the
 *  integer lattice for value noise. */
function hash3(x: number, y: number, z: number, seed = 0): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 91.17) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth 3D value noise in [0,1]; `cell` is the lattice spacing in metres. */
function noise3(x: number, y: number, z: number, cell: number, seed = 0): number {
  x /= cell; y /= cell; z /= cell;
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const fx = sm(x - x0), fy = sm(y - y0), fz = sm(z - z0);
  let v = 0;
  for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = 0; dz <= 1; dz++)
    v += hash3(x0 + dx, y0 + dy, z0 + dz, seed) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
  return v;
}

// ── geometry ────────────────────────────────────────────────────────────────

const SIDE = new THREE.Vector3(0, 0, 1);

/** Sweeps a superelliptical cross-section along a spine, with a per-station
 *  side count, seeded vertex jitter and random quad diagonals. */
function loft(stations: Station[], opts: LoftOpts = {}): THREE.BufferGeometry {
  const { seed = 1, sides = 8, jitter = 0.24, capStart = 0, capEnd = 0 } = opts;
  const rnd = mulberry(seed);
  const P = stations.map((s) => new THREE.Vector3(...s.at));
  const last = P.length - 1;
  const dirs = P.map((_, i) => P[Math.min(i + 1, last)]!.clone().sub(P[Math.max(i - 1, 0)]!).normalize());

  const rings: { pts: THREE.Vector3[]; par: number[] }[] = [];
  stations.forEach((st, i) => {
    const dir = dirs[i]!;
    // frame: up = SIDE × dir (world +y for a horizontal spine, +x for a leg),
    // side re-derived so it is perpendicular even when the spine leaves the xy plane
    const up = new THREE.Vector3().crossVectors(SIDE, dir).normalize();
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    const n = st.n ?? sides, k = st.k ?? 0.8, down = st.down ?? st.up;
    const seg = Math.min(
      i > 0 ? P[i]!.distanceTo(P[i - 1]!) : Infinity,
      i < last ? P[i]!.distanceTo(P[i + 1]!) : Infinity);
    const isEnd = i === 0 || i === last;
    const pts: THREE.Vector3[] = [], par: number[] = [];
    for (let s = 0; s < n; s++) {
      const jp = (s === 0 ? rnd() * 0.5 : rnd() - 0.5) * 2 * jitter / n;
      const jt = isEnd ? 0 : (rnd() - 0.5) * jitter * Math.min(seg, st.w + st.up) * 0.6;
      const rr = 1 + (rnd() - 0.5) * 0.07;
      const t = s / n + jp;
      par.push(t);
      const a = t * Math.PI * 2, c = Math.cos(a), si = Math.sin(a);
      const x = Math.sign(c) * Math.pow(Math.abs(c), k) * st.w * rr;
      const y = Math.sign(si) * Math.pow(Math.abs(si), k) * (si >= 0 ? st.up : down) * rr;
      pts.push(P[i]!.clone().addScaledVector(side, x).addScaledVector(up, y).addScaledVector(dir, jt));
    }
    rings.push({ pts, par });
  });

  const out: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  // stitch each pair of rings by walking both by angle; when the two next
  // vertices are close in angle the choice is random, which breaks the grid
  for (let i = 0; i < last; i++) {
    const A = rings[i]!, B = rings[i + 1]!;
    const nA = A.pts.length, nB = B.pts.length;
    const pa = (j: number) => (j < nA ? A.par[j]! : A.par[j - nA]! + 1);
    const pb = (j: number) => (j < nB ? B.par[j]! : B.par[j - nB]! + 1);
    let a = 0, b = 0;
    const tol = 0.45 / Math.max(nA, nB);
    while (a < nA || b < nB) {
      const nextA = pa(a + 1), nextB = pb(b + 1);
      const takeA = b >= nB || (a < nA && nextA - nextB <= (rnd() - 0.5) * tol);
      if (takeA) { tri(A.pts[a % nA]!, B.pts[b % nB]!, A.pts[(a + 1) % nA]!); a++; }
      else { tri(A.pts[a % nA]!, B.pts[b % nB]!, B.pts[(b + 1) % nB]!); b++; }
    }
  }
  if (capStart !== false) {
    const R = rings[0]!, c = P[0]!.clone().addScaledVector(dirs[0]!, -capStart);
    for (let s = 0; s < R.pts.length; s++) tri(c, R.pts[s]!, R.pts[(s + 1) % R.pts.length]!);
  }
  if (capEnd !== false) {
    const R = rings[last]!, c = P[last]!.clone().addScaledVector(dirs[last]!, capEnd);
    for (let s = 0; s < R.pts.length; s++) tri(c, R.pts[(s + 1) % R.pts.length]!, R.pts[s]!);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/** A flat leaf — an ear — from a 2D outline in the local xy plane, thickened
 *  along local z. With `inner` > 0 the face is an outer band plus an inner
 *  ring fanned to the centre, and `cup` pushes that inner ring along -z so the
 *  ear is dished rather than a slab. `basis` places it: local x, y, z axes and
 *  origin in world space. */
function leaf(outline: [number, number][], thick: number, basis: { x: Vec; y: Vec; at: Vec }, inner = 0, cup = 0, seed = 3): THREE.BufferGeometry {
  const n = outline.length;
  const rnd = mulberry(seed);
  const cx = outline.reduce((a, p) => a + p[0], 0) / n;
  const cy = outline.reduce((a, p) => a + p[1], 0) / n;
  const X = new THREE.Vector3(...basis.x).normalize();
  const Y = new THREE.Vector3(...basis.y);
  Y.addScaledVector(X, -Y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const O = new THREE.Vector3(...basis.at);
  const V = (x: number, y: number, z: number) => O.clone().addScaledVector(X, x).addScaledVector(Y, y).addScaledVector(Z, z);
  const out: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const h = thick / 2;
  const ring = inner > 0
    ? outline.map(([x, y]) => [cx + (x - cx) * inner + (rnd() - 0.5) * 0.06, cy + (y - cy) * inner + (rnd() - 0.5) * 0.06] as [number, number])
    : null;
  for (let i = 0; i < n; i++) {
    const p = outline[i]!, q = outline[(i + 1) % n]!;
    if (ring) {
      const rp = ring[i]!, rq = ring[(i + 1) % n]!;
      // outer band, both faces
      tri(V(p[0], p[1], h), V(q[0], q[1], h), V(rp[0], rp[1], h - cup));
      tri(V(q[0], q[1], h), V(rq[0], rq[1], h - cup), V(rp[0], rp[1], h - cup));
      tri(V(q[0], q[1], -h), V(p[0], p[1], -h), V(rp[0], rp[1], -h - cup));
      tri(V(rq[0], rq[1], -h - cup), V(q[0], q[1], -h), V(rp[0], rp[1], -h - cup));
      // inner fan
      tri(V(rp[0], rp[1], h - cup), V(rq[0], rq[1], h - cup), V(cx, cy, h - cup * 1.4));
      tri(V(rq[0], rq[1], -h - cup), V(rp[0], rp[1], -h - cup), V(cx, cy, -h - cup * 1.4));
    } else {
      tri(V(p[0], p[1], h), V(q[0], q[1], h), V(cx, cy, h - cup));
      tri(V(q[0], q[1], -h), V(p[0], p[1], -h), V(cx, cy, -h - cup));
    }
    // rim
    tri(V(p[0], p[1], -h), V(q[0], q[1], -h), V(q[0], q[1], h));
    tri(V(p[0], p[1], -h), V(q[0], q[1], h), V(p[0], p[1], h));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/** A faceted knob: eyes, ossicone tips. */
function knob(c: Vec, r: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.translate(c[0], c[1], c[2]);
  return g;
}

/** A serrated ridge — the giraffe's mane — as a thin fin of alternating
 *  triangles standing along a line of (base, tip) pairs. */
function fin(pairs: [THREE.Vector3, THREE.Vector3][], thick: number): THREE.BufferGeometry {
  const out: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const off = new THREE.Vector3(0, 0, thick / 2);
  for (let i = 0; i < pairs.length - 1; i++) {
    const [b0, t0] = pairs[i]!, [b1, t1] = pairs[i + 1]!;
    for (const s of [1, -1]) {
      const o = off.clone().multiplyScalar(s);
      const B0 = b0.clone().add(o), B1 = b1.clone().add(o), T0 = t0.clone().add(o), T1 = t1.clone().add(o);
      if (s > 0) { tri(B0, B1, T0); tri(T0, B1, T1); } else { tri(B1, B0, T0); tri(B1, T0, T1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

// ── paint and assembly ──────────────────────────────────────────────────────

type Paint = (c: THREE.Vector3, h: number) => THREE.ColorRepresentation;

/** Give every triangle one flat colour from its centroid; the painter also
 *  gets a per-triangle hash so it can vary tone facet by facet. */
function paint(g: THREE.BufferGeometry, fn: Paint): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Vector3(), colour = new THREE.Color();
  for (let t = 0; t < pos.count / 3; t++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3(pos.getX(t * 3 + k), pos.getY(t * 3 + k), pos.getZ(t * 3 + k)));
    c.multiplyScalar(1 / 3);
    colour.set(fn(c, hash3(Math.round(c.x * 1e4), Math.round(c.y * 1e4), Math.round(c.z * 1e4))));
    for (let k = 0; k < 3; k++) {
      col[(t * 3 + k) * 3] = colour.r; col[(t * 3 + k) * 3 + 1] = colour.g; col[(t * 3 + k) * 3 + 2] = colour.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Strip to position + colour only, so every part merges and the result has
 *  exactly the two attributes the viewer expects. Flat shading derives normals
 *  per facet in the shader, so none are stored. */
const strip = (g: THREE.BufferGeometry) => {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  out.setAttribute('color', g.getAttribute('color'));
  return out;
};

function build(parts: THREE.BufferGeometry[], name: string): THREE.Mesh {
  const geom = mergeGeometries(parts.map(strip), false)!;
  const mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name;
  return mesh;
}

const tone = (hex: number, f: number) => new THREE.Color(hex).multiplyScalar(f);

// ── the giraffe ─────────────────────────────────────────────────────────────

export function makeGiraffe(): THREE.Mesh {
  const YEL = 0xe9c62e, YEL2 = 0xdcb61f, YEL3 = 0xf1d34c, PALE = 0xf0dc7a;
  const BRN = 0x74431f, BRN2 = 0x633718, DARK = 0x3a2412, HORN = 0x6b4526;

  // PATCHES. A smooth noise field gives the patches their cluster, a
  // per-triangle hash gives them their ragged triangular edges. The threshold
  // moves by region: dense on the barrel, sparser up the neck, none below the
  // knee or on the face, and the belly is plain.
  const tones = (h: number) => ({ yellow: h < 0.55 ? YEL : h < 0.8 ? YEL2 : YEL3, brown: h < 0.5 ? BRN : BRN2 });
  const patchy = (c: THREE.Vector3, h: number, thr: number) => {
    const { yellow, brown } = tones(h);
    return noise3(c.x, c.y, c.z, 0.34, 11) * 0.72 + h * 0.28 > thr ? brown : yellow;
  };
  const coat = (c: THREE.Vector3, h: number) => {                // body, neck and head
    if (c.x > 2.08 && c.y > 4.85) return tones(h).yellow;        // face
    if (c.x < 1.0 && c.y < 2.5) return h < 0.75 ? PALE : tones(h).yellow;   // belly
    if (c.x < 1.0 && c.y < 2.75) return patchy(c, h, 0.6);      // lower flank, sparse
    return patchy(c, h, c.x > 0.95 && c.y > 3.45 ? 0.52 : 0.47); // neck sparser than barrel
  };
  const legCoat = (c: THREE.Vector3, h: number) =>
    c.y < 1.5 ? tones(h).yellow : patchy(c, h, c.y < 2.2 ? 0.66 : 0.56);

  const parts: THREE.BufferGeometry[] = [];

  // ONE SURFACE from the rump along the back, up the neck and out to the muzzle.
  // The topline falls from the withers to the rump, the chest is deep and the
  // flank tucks up, the neck leaves the top of the chest at ~55° and the head
  // levels out to point forward.
  parts.push(paint(loft([
    { at: [-1.22, 2.98, 0], w: 0.20, up: 0.18, down: 0.28, n: 8 },
    { at: [-1.05, 3.02, 0], w: 0.40, up: 0.28, down: 0.50, n: 8 },
    { at: [-0.65, 3.05, 0], w: 0.50, up: 0.30, down: 0.62, n: 8 },
    { at: [-0.22, 3.06, 0], w: 0.52, up: 0.30, down: 0.70, n: 8 },
    { at: [ 0.22, 3.10, 0], w: 0.50, up: 0.30, down: 0.74, n: 8 },
    { at: [ 0.58, 3.20, 0], w: 0.45, up: 0.28, down: 0.70, n: 8 },   // withers
    { at: [ 0.84, 3.36, 0], w: 0.36, up: 0.22, down: 0.52, n: 8 },
    { at: [ 1.00, 3.62, 0], w: 0.28, up: 0.20, down: 0.34, n: 7 },   // neck leaves the shoulder
    { at: [ 1.18, 3.98, 0], w: 0.24, up: 0.20, down: 0.26, n: 7 },
    { at: [ 1.40, 4.36, 0], w: 0.21, up: 0.19, down: 0.23, n: 7 },
    { at: [ 1.62, 4.72, 0], w: 0.19, up: 0.18, down: 0.21, n: 7 },
    { at: [ 1.84, 5.02, 0], w: 0.18, up: 0.17, down: 0.19, n: 7 },
    { at: [ 2.02, 5.18, 0], w: 0.18, up: 0.15, down: 0.19, n: 7 },   // poll: the neck turns to the head
    { at: [ 2.22, 5.24, 0], w: 0.22, up: 0.14, down: 0.21, n: 7 },   // skull widest at the eyes
    { at: [ 2.44, 5.20, 0], w: 0.18, up: 0.12, down: 0.19, n: 7 },
    { at: [ 2.66, 5.12, 0], w: 0.14, up: 0.10, down: 0.15, n: 6 },
    { at: [ 2.86, 5.05, 0], w: 0.12, up: 0.09, down: 0.12, n: 6 },   // muzzle
    { at: [ 2.98, 5.02, 0], w: 0.09, up: 0.07, down: 0.09, n: 6 },
  ], { seed: 21, capEnd: 0.05 }), coat));

  // LEGS. Front pair nearly straight with a slight set-back at the knee, hind
  // pair with the stifle forward and the hock behind. Cross-sections are
  // elliptical: deeper fore-aft than wide, with the thigh muscle at the back.
  const legs: Station[][] = [];
  for (const s of [1, -1]) {
    const z = s * 0.30;
    legs.push([
      { at: [0.56, 2.95, z], w: 0.20, up: 0.30, down: 0.30, n: 6 },
      { at: [0.55, 2.40, z], w: 0.15, up: 0.20, down: 0.20, n: 6 },
      { at: [0.50, 1.55, z], w: 0.10, up: 0.13, down: 0.12, n: 6 },   // knee
      { at: [0.54, 0.95, z], w: 0.08, up: 0.10, down: 0.09, n: 5 },
      { at: [0.60, 0.24, z], w: 0.09, up: 0.10, down: 0.09, n: 5 },   // fetlock
      { at: [0.61, 0.12, z], w: 0.09, up: 0.10, down: 0.09, n: 5 },
    ]);
    legs.push([
      { at: [-0.86, 2.95, z], w: 0.21, up: 0.34, down: 0.32, n: 6 },
      { at: [-0.72, 2.40, z], w: 0.17, up: 0.28, down: 0.25, n: 6 },  // thigh, sloping forward
      { at: [-0.60, 2.05, z], w: 0.13, up: 0.19, down: 0.18, n: 6 },  // stifle
      { at: [-0.98, 1.25, z], w: 0.10, up: 0.11, down: 0.14, n: 5 },  // hock
      { at: [-0.92, 0.24, z], w: 0.09, up: 0.10, down: 0.09, n: 5 },  // fetlock
      { at: [-0.91, 0.12, z], w: 0.09, up: 0.10, down: 0.09, n: 5 },
    ]);
  }
  legs.forEach((L, i) => parts.push(paint(loft(L, { seed: 40 + i, capStart: false, capEnd: false }), legCoat)));
  // hooves
  for (const [x, z] of [[0.61, 0.30], [0.61, -0.30], [-0.91, 0.30], [-0.91, -0.30]] as [number, number][])
    parts.push(paint(loft([
      { at: [x, 0.13, z], w: 0.09, up: 0.10, down: 0.09, n: 5, k: 0.7 },
      { at: [x + 0.01, 0.0, z], w: 0.10, up: 0.12, down: 0.10, n: 5, k: 0.7 },
    ], { seed: 50, jitter: 0.1, capStart: false }), () => DARK));

  // MANE: a serrated fin down the back of the neck
  {
    const pairs: [THREE.Vector3, THREE.Vector3][] = [];
    const spine: Vec[] = [[0.92, 3.42, 0], [1.00, 3.62, 0], [1.18, 3.98, 0], [1.40, 4.36, 0], [1.62, 4.72, 0], [1.84, 5.02, 0], [2.02, 5.18, 0]];
    const rad = [0.28, 0.20, 0.20, 0.19, 0.18, 0.17, 0.15];
    for (let i = 0; i < spine.length; i++) {
      const p = new THREE.Vector3(...spine[i]!);
      const nx = new THREE.Vector3(...spine[Math.min(i + 1, spine.length - 1)]!).sub(new THREE.Vector3(...spine[Math.max(i - 1, 0)]!)).normalize();
      const up = new THREE.Vector3(-nx.y, nx.x, 0);
      pairs.push([p.clone().addScaledVector(up, rad[i]! - 0.03), p.clone().addScaledVector(up, rad[i]! + (i % 2 ? 0.10 : 0.06))]);
      if (i < spine.length - 1) {
        // a mid point so the serration is twice as fine as the stations
        const q = new THREE.Vector3(...spine[i + 1]!).add(p).multiplyScalar(0.5);
        const r = (rad[i]! + rad[i + 1]!) / 2;
        pairs.push([q.clone().addScaledVector(up, r - 0.03), q.clone().addScaledVector(up, r + (i % 2 ? 0.06 : 0.10))]);
      }
    }
    parts.push(paint(fin(pairs, 0.03), () => BRN2));
  }

  // HEAD FURNITURE: leaf ears out to the sides, two ossicones with dark knobs,
  // eyes on the widest part of the skull, nostrils.
  for (const s of [1, -1]) {
    parts.push(paint(leaf(
      [[0, 0], [0.10, 0.09], [0.24, 0.09], [0.36, 0.0], [0.24, -0.08], [0.10, -0.09]], 0.03,
      { x: [-0.28, 0.30, s * 0.90], y: [0, 1, 0], at: [2.20, 5.30, s * 0.15] }, 0, 0.02, 5 + s),
      (_c, h) => (h < 0.6 ? YEL : YEL3)));
    parts.push(paint(loft([
      { at: [2.16, 5.26, s * 0.075], w: 0.040, up: 0.040, n: 5, k: 1 },
      { at: [2.13, 5.46, s * 0.090], w: 0.030, up: 0.030, n: 5, k: 1 },
    ], { seed: 60, jitter: 0.1, capStart: false }), () => HORN));
    parts.push(paint(knob([2.13, 5.48, s * 0.09], 0.055), () => DARK));
    parts.push(paint(knob([2.30, 5.28, s * 0.20], 0.040), () => DARK));   // eye
  }

  // TAIL, hanging, with a dark tuft
  parts.push(paint(loft([
    { at: [-1.22, 2.98, 0], w: 0.045, up: 0.045, n: 5, k: 1 },
    { at: [-1.36, 2.55, 0], w: 0.035, up: 0.035, n: 5, k: 1 },
    { at: [-1.34, 2.05, 0], w: 0.028, up: 0.028, n: 5, k: 1 },
  ], { seed: 70, jitter: 0.1, capStart: false, capEnd: false }), () => YEL2));
  parts.push(paint(loft([
    { at: [-1.34, 2.06, 0], w: 0.04, up: 0.04, n: 5, k: 1 },
    { at: [-1.34, 1.80, 0], w: 0.08, up: 0.09, n: 5, k: 1 },
    { at: [-1.34, 1.55, 0], w: 0.03, up: 0.03, n: 5, k: 1 },
  ], { seed: 71, jitter: 0.2 }), () => DARK));

  return build(parts, 'giraffe');
}

// ── the elephant ────────────────────────────────────────────────────────────

export function makeElephant(): THREE.Mesh {
  const HIDE = 0x555044, TUSK = 0xefe8d6, PAD = 0x8a8272, DARK = 0x1a1510;

  // one hide colour, varied by a few percent per facet so a flank is not one
  // tone even where two facets face the same way
  const skin = (_c: THREE.Vector3, h: number) => tone(HIDE, 0.94 + h * 0.13);

  const parts: THREE.BufferGeometry[] = [];

  // ONE SURFACE from the rump, along a back that peaks at the shoulder, over a
  // slight dip at the neck, up the domed skull, down the forehead and into the
  // trunk, which hangs to the ground and curls forward at the tip. Body ten
  // sides, trunk falling to six.
  parts.push(paint(loft([
    { at: [-1.92, 2.28, 0], w: 0.32, up: 0.36, down: 0.42, k: 0.75, n: 10 },
    { at: [-1.76, 2.32, 0], w: 0.72, up: 0.66, down: 0.72, k: 0.72, n: 10 },
    { at: [-1.45, 2.34, 0], w: 0.95, up: 0.76, down: 0.86, k: 0.70, n: 10 },
    { at: [-1.00, 2.36, 0], w: 1.05, up: 0.78, down: 0.92, k: 0.68, n: 10 },
    { at: [-0.30, 2.36, 0], w: 1.08, up: 0.76, down: 0.95, k: 0.68, n: 10 },
    { at: [ 0.40, 2.38, 0], w: 1.06, up: 0.80, down: 0.93, k: 0.70, n: 10 },
    { at: [ 0.95, 2.40, 0], w: 0.98, up: 0.82, down: 0.86, k: 0.72, n: 10 },   // shoulder, 3.22 high
    { at: [ 1.35, 2.42, 0], w: 0.84, up: 0.70, down: 0.72, k: 0.75, n: 10 },
    { at: [ 1.68, 2.46, 0], w: 0.68, up: 0.54, down: 0.60, k: 0.78, n: 10 },   // neck dip
    { at: [ 2.00, 2.52, 0], w: 0.62, up: 0.72, down: 0.56, k: 0.80, n: 10 },   // dome of the skull
    { at: [ 2.30, 2.52, 0], w: 0.58, up: 0.70, down: 0.50, k: 0.80, n: 10 },
    { at: [ 2.56, 2.40, 0], w: 0.50, up: 0.54, down: 0.42, k: 0.82, n: 10 },   // forehead turns down
    { at: [ 2.74, 2.14, 0], w: 0.36, up: 0.36, down: 0.30, k: 0.85, n: 8 },    // trunk root
    { at: [ 2.86, 1.80, 0], w: 0.26, up: 0.26, down: 0.24, k: 0.9, n: 8 },
    { at: [ 2.96, 1.42, 0], w: 0.22, up: 0.22, down: 0.20, k: 0.9, n: 7 },
    { at: [ 3.05, 0.95, 0], w: 0.18, up: 0.17, down: 0.16, k: 0.9, n: 7 },
    { at: [ 3.07, 0.36, 0], w: 0.13, up: 0.13, down: 0.12, k: 0.9, n: 6 },
    { at: [ 2.98, 0.13, 0], w: 0.11, up: 0.10, down: 0.10, k: 0.9, n: 6 },    // tip curls forward
    { at: [ 2.84, 0.07, 0], w: 0.08, up: 0.07, down: 0.07, k: 0.9, n: 6 },
  ], { seed: 101, capEnd: 0.03 }), skin));

  // LEGS: columns, barely tapered, with a real shoulder and thigh at the top,
  // a slight set-back at the front wrist and a forward knee behind, and a
  // flare at the foot. The lowest band is painted as the pad and nails.
  const foot = (c: THREE.Vector3, h: number) => (c.y < 0.1 ? tone(PAD, 0.95 + h * 0.1) : skin(c, h));
  const legs: Station[][] = [];
  for (const s of [1, -1]) {
    const z = s * 0.53;
    legs.push([
      { at: [0.95, 2.36, z], w: 0.39, up: 0.50, down: 0.48, k: 0.85, n: 6 },
      { at: [0.93, 1.80, z], w: 0.37, up: 0.41, down: 0.39, k: 0.85, n: 6 },
      { at: [0.89, 1.00, z], w: 0.30, up: 0.32, down: 0.30, k: 0.85, n: 6 },   // wrist
      { at: [0.91, 0.45, z], w: 0.30, up: 0.32, down: 0.30, k: 0.85, n: 6 },
      { at: [0.92, 0.18, z], w: 0.33, up: 0.36, down: 0.33, k: 0.8, n: 6 },
      { at: [0.92, 0.00, z], w: 0.36, up: 0.40, down: 0.35, k: 0.7, n: 6 },
    ]);
    legs.push([
      { at: [-1.12, 2.34, z], w: 0.41, up: 0.62, down: 0.52, k: 0.85, n: 6 },
      { at: [-1.06, 1.85, z], w: 0.40, up: 0.50, down: 0.42, k: 0.85, n: 6 },  // thigh
      { at: [-1.02, 1.35, z], w: 0.32, up: 0.35, down: 0.33, k: 0.85, n: 6 },  // knee
      { at: [-1.14, 0.55, z], w: 0.29, up: 0.30, down: 0.30, k: 0.85, n: 6 },
      { at: [-1.15, 0.18, z], w: 0.32, up: 0.34, down: 0.32, k: 0.8, n: 6 },
      { at: [-1.15, 0.00, z], w: 0.35, up: 0.38, down: 0.34, k: 0.7, n: 6 },
    ]);
  }
  legs.forEach((L, i) => parts.push(paint(loft(L, { seed: 120 + i, capStart: false }), foot)));

  // LOWER JAW: a short wedge under the trunk root, so the tusks have a lip to
  // come out of rather than being pinned to the trunk
  parts.push(paint(loft([
    { at: [2.36, 1.88, 0], w: 0.30, up: 0.22, down: 0.26, k: 0.85, n: 6 },
    { at: [2.60, 1.74, 0], w: 0.22, up: 0.15, down: 0.18, k: 0.85, n: 6 },
    { at: [2.76, 1.60, 0], w: 0.12, up: 0.08, down: 0.10, k: 0.85, n: 6 },
  ], { seed: 160, capStart: false, capEnd: 0.03 }), skin));

  // EARS: big leaves, square-cornered at the top, falling away to a rounded
  // lobe at the bottom, hung from behind the eye and swept back and out, with
  // a dish so they are not slabs.
  for (const s of [1, -1]) {
    const outline: [number, number][] = [
      [0.00, 0.48], [0.42, 0.60], [0.90, 0.44], [1.08, -0.10],
      [0.84, -0.66], [0.36, -0.92], [-0.04, -0.55],
    ];
    parts.push(paint(leaf(outline, 0.06,
      { x: [-0.78, -0.06, s * 0.62], y: [0.06, 1, 0], at: [2.12, 2.56, s * 0.46] }, 0.52, 0.06, 130 + s),
      skin));
  }

  // TUSKS, out of the upper jaw, curving forward, out and up
  for (const s of [1, -1])
    parts.push(paint(loft([
      { at: [2.58, 1.86, s * 0.20], w: 0.085, up: 0.085, n: 4, k: 1 },
      { at: [2.82, 1.56, s * 0.29], w: 0.070, up: 0.070, n: 4, k: 1 },
      { at: [3.06, 1.36, s * 0.36], w: 0.052, up: 0.052, n: 4, k: 1 },
      { at: [3.30, 1.30, s * 0.41], w: 0.030, up: 0.030, n: 4, k: 1 },
    ], { seed: 140, jitter: 0.12, capStart: false, capEnd: 0.05 }), (_c, h) => tone(TUSK, 0.96 + h * 0.06)));

  // EYES, small, on the side of the skull ahead of the ear
  for (const s of [1, -1]) parts.push(paint(knob([2.42, 2.60, s * 0.56], 0.05), () => DARK));

  // TAIL
  parts.push(paint(loft([
    { at: [-1.92, 2.34, 0], w: 0.07, up: 0.07, n: 4, k: 1 },
    { at: [-2.06, 1.75, 0], w: 0.05, up: 0.05, n: 4, k: 1 },
    { at: [-2.03, 1.15, 0], w: 0.04, up: 0.04, n: 4, k: 1 },
  ], { seed: 150, jitter: 0.1, capStart: false, capEnd: false }), skin));
  parts.push(paint(loft([
    { at: [-2.03, 1.16, 0], w: 0.05, up: 0.05, n: 4, k: 1 },
    { at: [-2.03, 0.95, 0], w: 0.07, up: 0.08, n: 4, k: 1 },
    { at: [-2.03, 0.78, 0], w: 0.02, up: 0.02, n: 4, k: 1 },
  ], { seed: 151, jitter: 0.2, capStart: false }), () => DARK));

  return build(parts, 'elephant');
}
