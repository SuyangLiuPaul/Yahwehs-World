import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A LOW-POLY GIRAFFE AND ELEPHANT, GENERATED IN CODE.
//
// The style is the one in the reference: real proportions, a surface of a few
// hundred large flat triangles, no texture at all, and — on the giraffe —
// patches that are simply triangles coloured brown instead of yellow.
//
// THE THING THAT MAKES OR BREAKS IT IS THE SILHOUETTE, and the first version
// of this file got that wrong in a way worth recording. It built each animal
// out of separate ellipsoids and tubes: a sphere for the body, a tube for the
// neck, sticks for the legs. Every one of those parts visibly intersected the
// next, so the neck did not flow out of the shoulder, it was jammed into it,
// and the whole thing read as a toy assembled from spare parts.
//
// So the body, neck and head are now ONE LOFTED SURFACE, swept along a single
// spine from tail to muzzle, with an elliptical cross-section at every station
// that is wider at the barrel and narrows through the neck. The silhouette is
// therefore continuous by construction, which is most of the battle. The legs
// are lofted too, with a real bend at the knee and hock, and they are pushed
// far enough into the body that the joint is hidden inside the barrel rather
// than crossing it in the open.
//
// Units are metres. Both animals face +x and stand on y = 0.

type Vec = [number, number, number];

/** One cross-section of a lofted body: where it is, and its half-width (z)
 *  and half-height (y). Keeping the two separate is what lets a giraffe be
 *  deep through the chest and narrow across it. */
interface Station { at: Vec; w: number; h: number }

/** Sweeps an elliptical cross-section along a spine. Rings are built with a
 *  world-up reference rather than a parallel transport frame: these animals
 *  never loop or roll, and a fixed reference means no accumulated twist. */
function loft(stations: Station[], sides = 8, capStart = true, capEnd = true): THREE.BufferGeometry {
  const P = stations.map((s) => new THREE.Vector3(...s.at));
  const rings: THREE.Vector3[][] = [];
  const UP = new THREE.Vector3(0, 1, 0);

  stations.forEach((st, i) => {
    const prev = P[Math.max(i - 1, 0)]!, next = P[Math.min(i + 1, P.length - 1)]!;
    const dir = next.clone().sub(prev).normalize();
    // The reference axis must not be parallel to the spine. Using world up
    // unconditionally looks fine on a back or a neck and DESTROYS a leg: a
    // leg runs almost straight down, so dir x up collapses towards zero and
    // normalising it amplifies floating-point noise into a wildly twisting
    // ring — which showed up as thin spikes fanning out of every knee.
    const ref = Math.abs(dir.dot(UP)) > 0.85 ? new THREE.Vector3(0, 0, 1) : UP;
    const side = new THREE.Vector3().crossVectors(dir, ref).normalize();
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      ring.push(P[i]!.clone()
        .addScaledVector(side, Math.cos(a) * st.w)
        .addScaledVector(up, Math.sin(a) * st.h));
    }
    rings.push(ring);
  });

  const out: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings.length - 1; i++)
    for (let s = 0; s < sides; s++) {
      const a = rings[i]![s]!, b = rings[i]![(s + 1) % sides]!;
      const c = rings[i + 1]![(s + 1) % sides]!, d = rings[i + 1]![s]!;
      tri(a, b, c); tri(a, c, d);
    }
  const cap = (ring: THREE.Vector3[], centre: THREE.Vector3, flip: boolean) => {
    for (let s = 0; s < sides; s++) {
      const a = ring[s]!, b = ring[(s + 1) % sides]!;
      if (flip) tri(centre, b, a); else tri(centre, a, b);
    }
  };
  if (capStart) cap(rings[0]!, P[0]!, true);
  if (capEnd) cap(rings[rings.length - 1]!, P[P.length - 1]!, false);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/** A flat shape — an ear, mostly — given as a 2D outline, thickened and then
 *  placed. The outline is triangulated as a fan from its centroid, which is
 *  fine for the convex-ish leaf shapes used here. */
function plate(outline: [number, number][], thick: number, place: (v: THREE.Vector3) => void): THREE.BufferGeometry {
  const n = outline.length;
  const cx = outline.reduce((a, p) => a + p[0], 0) / n;
  const cy = outline.reduce((a, p) => a + p[1], 0) / n;
  const out: number[] = [];
  const V = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z); place(v); return v; };
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const h = thick / 2;
  for (let i = 0; i < n; i++) {
    const p = outline[i]!, q = outline[(i + 1) % n]!;
    // front and back faces
    tri(V(p[0], p[1], h), V(q[0], q[1], h), V(cx, cy, h));
    tri(V(q[0], q[1], -h), V(p[0], p[1], -h), V(cx, cy, -h));
    // the rim
    tri(V(p[0], p[1], -h), V(q[0], q[1], -h), V(q[0], q[1], h));
    tri(V(p[0], p[1], -h), V(q[0], q[1], h), V(p[0], p[1], h));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/** A small faceted ball, for eyes and horn knobs. */
function ball(c: Vec, r: number, detail = 0): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.translate(c[0], c[1], c[2]);
  return g;
}

/** Give every triangle one flat colour, chosen from where its centre sits. */
function paint(g: THREE.BufferGeometry, fn: (c: THREE.Vector3) => THREE.ColorRepresentation): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Vector3(), colour = new THREE.Color();
  for (let t = 0; t < pos.count / 3; t++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3(pos.getX(t * 3 + k), pos.getY(t * 3 + k), pos.getZ(t * 3 + k)));
    c.multiplyScalar(1 / 3);
    colour.set(fn(c));
    for (let k = 0; k < 3; k++) {
      col[(t * 3 + k) * 3] = colour.r; col[(t * 3 + k) * 3 + 1] = colour.g; col[(t * 3 + k) * 3 + 2] = colour.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Strip to position + colour so every part merges, and flat-shade it. */
const flat = (g: THREE.BufferGeometry) => {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  out.setAttribute('color', g.getAttribute('color'));
  out.computeVertexNormals();
  return out;
};

const material = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

function build(parts: THREE.BufferGeometry[], name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(mergeGeometries(parts.map(flat), false)!, material());
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name;
  return mesh;
}

/** A leg: lofted down a bent path, so it has a knee rather than being a stick.
 *  `bend` shifts the middle joint forward or back, which is the whole
 *  difference between a foreleg and a hind leg. */
function leg(x: number, z: number, top: number, radii: [number, number, number, number, number], bend: number, hoofTop: number): Station[] {
  // NOTE the caller passes capStart=false: a capped top ring sitting just
  // under the skin fans into visible spikes through the barrel.
  const r = radii;
  return [
    { at: [x, top, z], w: r[0], h: r[0] },
    { at: [x + bend * 0.25, top - (top - hoofTop) * 0.34, z], w: r[1], h: r[1] },
    { at: [x + bend, top - (top - hoofTop) * 0.58, z], w: r[2], h: r[2] },          // knee / hock
    { at: [x + bend * 0.15, top - (top - hoofTop) * 0.86, z], w: r[3], h: r[3] },
    { at: [x + bend * 0.1, hoofTop, z], w: r[4], h: r[4] },
  ];
}

// ── the giraffe ──────────────────────────────────────────────────────────

export function makeGiraffe(): THREE.Mesh {
  const YEL = 0xf7dc55, YEL2 = 0xefd13f, BRN = 0x93571f, BRN2 = 0x7a4518;
  const HORN = 0x6d4a2a, DARK = 0x3f2a18, MUZZLE = 0xd8c091;

  // PATCHES. Scattered centres on the body, and a triangle takes the brown of
  // whichever centre it falls inside. Patches therefore come out as solid
  // polygonal blotches with clean edges, the way a giraffe's actually are,
  // rather than as the per-triangle speckle a plain hash gives.
  const centres: [number, number, number, number][] = [];
  {
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    // along the barrel
    for (let i = 0; i < 40; i++)
      centres.push([-1.15 + rnd() * 2.0, 2.66 + rnd() * 0.95, -0.66 + rnd() * 1.32, 0.19 + rnd() * 0.08]);
    // up the neck, following it as it climbs and moves forward
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      centres.push([0.95 + t * 1.05 + (rnd() - 0.5) * 0.22, 3.45 + t * 2.0 + (rnd() - 0.5) * 0.22,
        (rnd() - 0.5) * 0.52, 0.13 + rnd() * 0.05]);
    }
    // down the upper legs
    for (const lx of [0.66, -0.74])
      for (const lz of [0.3, -0.3])
        for (let i = 0; i < 3; i++)
          centres.push([lx + (rnd() - 0.5) * 0.2, 2.1 + rnd() * 0.7, lz + (rnd() - 0.5) * 0.2, 0.13 + rnd() * 0.05]);
  }
  const coat = (c: THREE.Vector3) => {
    for (const [x, y, z, r] of centres) {
      const dx = c.x - x, dy = c.y - y, dz = c.z - z;
      if (dx * dx + dy * dy + dz * dz < r * r) return (x + y) % 0.4 > 0.2 ? BRN : BRN2;
    }
    return (c.x + c.y * 1.7) % 0.5 > 0.25 ? YEL : YEL2;
  };

  const parts: THREE.BufferGeometry[] = [];

  // ONE SURFACE from the tail root, along the back, up the neck and out to the
  // muzzle. The topline rises to the withers and falls to the rump, which is
  // the giraffe's most recognisable line after the neck itself.
  parts.push(paint(loft([
    { at: [-1.30, 2.86, 0], w: 0.16, h: 0.18 },
    { at: [-1.12, 2.96, 0], w: 0.34, h: 0.42 },
    { at: [-0.82, 3.00, 0], w: 0.46, h: 0.60 },
    { at: [-0.40, 3.02, 0], w: 0.52, h: 0.70 },
    { at: [ 0.05, 3.06, 0], w: 0.53, h: 0.74 },
    { at: [ 0.48, 3.14, 0], w: 0.50, h: 0.74 },      // withers, the high point
    { at: [ 0.80, 3.26, 0], w: 0.42, h: 0.64 },
    { at: [ 1.00, 3.52, 0], w: 0.33, h: 0.44 },      // the neck leaves the shoulder
    { at: [ 1.18, 3.95, 0], w: 0.26, h: 0.32 },
    { at: [ 1.38, 4.45, 0], w: 0.23, h: 0.28 },
    { at: [ 1.58, 4.92, 0], w: 0.21, h: 0.26 },
    { at: [ 1.76, 5.32, 0], w: 0.19, h: 0.24 },
    { at: [ 1.92, 5.60, 0], w: 0.18, h: 0.23 },
    { at: [ 2.08, 5.74, 0], w: 0.20, h: 0.24 },      // the skull widens
    { at: [ 2.30, 5.76, 0], w: 0.19, h: 0.21 },
    { at: [ 2.48, 5.70, 0], w: 0.14, h: 0.15 },      // and tapers to the muzzle
    { at: [ 2.62, 5.62, 0], w: 0.11, h: 0.12 },
  ], 9), (c) => (c.x > 2.42 && c.y < 5.74) ? MUZZLE : coat(c)));

  // four legs, front pair bending back at the knee, hind pair forward at the hock
  parts.push(paint(loft(leg(0.62, 0.30, 3.18, [0.22, 0.17, 0.12, 0.085, 0.10], -0.10, 0.10), 7, false), coat));
  parts.push(paint(loft(leg(0.62, -0.30, 3.18, [0.22, 0.17, 0.12, 0.085, 0.10], -0.10, 0.10), 7, false), coat));
  parts.push(paint(loft(leg(-0.78, 0.30, 3.10, [0.23, 0.18, 0.125, 0.085, 0.10], 0.16, 0.10), 7, false), coat));
  parts.push(paint(loft(leg(-0.78, -0.30, 3.10, [0.23, 0.18, 0.125, 0.085, 0.10], 0.16, 0.10), 7, false), coat));
  // hooves
  for (const [x, z] of [[0.58, 0.30], [0.58, -0.30], [-0.72, 0.30], [-0.72, -0.30]] as [number, number][])
    parts.push(paint(loft([{ at: [x, 0.13, z], w: 0.105, h: 0.105 }, { at: [x, 0.0, z], w: 0.115, h: 0.115 }], 7), () => DARK));

  // the mane: one continuous low ridge along the back of the neck, not a row
  // of separate plates — scattered plates read as specks at any distance
  parts.push(paint(loft([
    { at: [0.98, 3.60, 0], w: 0.018, h: 0.05 },
    { at: [1.15, 4.04, 0], w: 0.018, h: 0.06 },
    { at: [1.34, 4.54, 0], w: 0.018, h: 0.06 },
    { at: [1.54, 5.00, 0], w: 0.018, h: 0.055 },
    { at: [1.72, 5.40, 0], w: 0.018, h: 0.05 },
    { at: [1.88, 5.68, 0], w: 0.015, h: 0.04 },
  ], 5), () => BRN2));

  // ears, laid back from the skull, and two ossicones with knobs
  for (const s of [1, -1]) {
    parts.push(paint(plate([[0, 0], [0.13, 0.05], [0.2, 0.0], [0.13, -0.075]], 0.035,
      (v) => { const o = v.clone(); v.set(2.02 - o.x * 0.55, 5.82 + o.y, s * (0.16 + o.x * 0.82) + o.z); }), () => YEL2));
    parts.push(paint(loft([
      { at: [2.06, 5.88, s * 0.085], w: 0.036, h: 0.036 },
      { at: [2.04, 6.06, s * 0.095], w: 0.030, h: 0.030 },
    ], 6), () => HORN));
    parts.push(paint(ball([2.04, 6.10, s * 0.095], 0.058), () => DARK));
    parts.push(paint(ball([2.28, 5.80, s * 0.175], 0.035), () => DARK));   // eye
  }
  // nostril dots
  for (const s of [1, -1]) parts.push(paint(ball([2.63, 5.62, s * 0.05], 0.022), () => DARK));

  // the tail, hanging with a dark tuft
  parts.push(paint(loft([
    { at: [-1.12, 3.00, 0], w: 0.07, h: 0.07 },      // begins INSIDE the rump
    { at: [-1.30, 2.60, 0], w: 0.05, h: 0.05 },
    { at: [-1.38, 2.10, 0], w: 0.038, h: 0.038 },
    { at: [-1.38, 1.80, 0], w: 0.032, h: 0.032 },
  ], 6), () => YEL2));
  parts.push(paint(loft([
    { at: [-1.40, 1.82, 0], w: 0.055, h: 0.055 },
    { at: [-1.40, 1.58, 0], w: 0.075, h: 0.075 },
    { at: [-1.40, 1.44, 0], w: 0.03, h: 0.03 },
  ], 6), () => DARK));

  return build(parts, 'giraffe');
}

// ── the elephant ─────────────────────────────────────────────────────────

export function makeElephant(): THREE.Mesh {
  const HIDE = 0xa1968a, HIDE2 = 0x8d8276, EAR = 0x968b7e, EARIN = 0x9e9386;
  const TUSK = 0xefe9d8, NAIL = 0xcfc6b2, DARK = 0x201a12;

  const skin = (c: THREE.Vector3) => {
    // a faint variation between facets, so a big flat flank is not one tone
    const n = Math.sin(c.x * 7.3) * 0.5 + Math.sin(c.y * 5.9 + 1.7) * 0.3 + Math.sin(c.z * 6.7 + 3.1) * 0.2;
    // a gentle gradient down the body rather than a hard line at one height:
    // the hard version put the elephant in dark boots
    const t = THREE.MathUtils.clamp((c.y - 0.4) / 1.9, 0, 1);
    return new THREE.Color(HIDE2).lerp(new THREE.Color(HIDE), t).multiplyScalar(1 + n * 0.045);
  };

  const parts: THREE.BufferGeometry[] = [];

  // ONE SURFACE from the rump, along a back that dips behind the shoulder,
  // over the domed head and down into the trunk. An elephant's head and body
  // are a single continuous mass; modelling them as two balls was exactly
  // what made the last attempt read as a toy.
  parts.push(paint(loft([
    { at: [-1.82, 1.95, 0], w: 0.30, h: 0.42 },
    { at: [-1.70, 2.10, 0], w: 0.72, h: 0.78 },
    { at: [-1.35, 2.16, 0], w: 0.96, h: 1.00 },
    { at: [-0.85, 2.14, 0], w: 1.04, h: 1.06 },
    { at: [-0.30, 2.08, 0], w: 1.05, h: 1.06 },      // the back dips slightly
    { at: [ 0.28, 2.10, 0], w: 1.03, h: 1.06 },
    { at: [ 0.85, 2.20, 0], w: 0.96, h: 1.04 },      // rises again at the shoulder
    { at: [ 1.32, 2.28, 0], w: 0.84, h: 0.96 },
    { at: [ 1.70, 2.36, 0], w: 0.74, h: 0.86 },      // the head begins, no seam
    { at: [ 2.05, 2.40, 0], w: 0.66, h: 0.80 },      // domed forehead
    { at: [ 2.34, 2.26, 0], w: 0.56, h: 0.68 },
    { at: [ 2.54, 2.00, 0], w: 0.44, h: 0.52 },
    { at: [ 2.66, 1.72, 0], w: 0.34, h: 0.38 },      // and turns down into the trunk
    { at: [ 2.76, 1.36, 0], w: 0.27, h: 0.29 },
    { at: [ 2.86, 0.98, 0], w: 0.22, h: 0.23 },
    { at: [ 2.94, 0.62, 0], w: 0.18, h: 0.19 },
    { at: [ 2.96, 0.34, 0], w: 0.15, h: 0.16 },
    { at: [ 2.88, 0.16, 0], w: 0.13, h: 0.13 },      // the tip curls forward
    { at: [ 2.72, 0.10, 0], w: 0.11, h: 0.10 },
  ], 10), skin));

  // four columns, thick and barely tapered, with a flare at the foot
  for (const [x, z, top] of [[1.02, 0.62, 2.05], [1.02, -0.62, 2.05], [-1.16, 0.62, 2.0], [-1.16, -0.62, 2.0]] as [number, number, number][]) {
    parts.push(paint(loft([
      { at: [x, top, z], w: 0.44, h: 0.44 },
      { at: [x, top * 0.66, z], w: 0.38, h: 0.38 },
      { at: [x, top * 0.34, z], w: 0.35, h: 0.35 },
      { at: [x, 0.22, z], w: 0.38, h: 0.38 },
      { at: [x, 0.0, z], w: 0.42, h: 0.42 },
    ], 8), (c) => (c.y < 0.2 ? new THREE.Color(NAIL) : skin(c))));
  }

  // EARS. A proper leaf outline with the top corner square and the lower edge
  // falling away, swept back off the head — a disc reads as a dinner plate,
  // and that was the single worst thing about the previous elephant.
  for (const s of [1, -1]) {
    const outline: [number, number][] = [
      [0.0, 0.62], [0.42, 0.66], [0.72, 0.42], [0.86, 0.0],
      [0.78, -0.46], [0.52, -0.80], [0.18, -0.88], [-0.04, -0.52], [-0.10, 0.10],
    ];
    const put = (v: THREE.Vector3) => {
      const o = v.clone();
      // lay the ear on a plane swept back and slightly outward from the skull
      v.set(1.66 - o.x * 0.74 + o.z * 0.2, 2.44 + o.y, s * (0.66 + o.x * 0.62 + Math.abs(o.z)));
    };
    parts.push(paint(plate(outline, 0.07, put), (c) => new THREE.Color(Math.abs(c.z) < 0.9 ? EARIN : EAR)));
  }

  // tusks, curving out, forward and up
  for (const s of [1, -1])
    parts.push(paint(loft([
      { at: [2.46, 1.62, s * 0.30], w: 0.072, h: 0.072 },
      { at: [2.74, 1.32, s * 0.40], w: 0.058, h: 0.058 },
      { at: [3.02, 1.10, s * 0.45], w: 0.042, h: 0.042 },
      { at: [3.24, 1.06, s * 0.46], w: 0.022, h: 0.022 },
    ], 6), () => TUSK));

  // eyes, small and set low on the cheek
  for (const s of [1, -1]) parts.push(paint(ball([2.28, 2.28, s * 0.52], 0.052), () => DARK));

  // the tail
  parts.push(paint(loft([
    { at: [-1.84, 2.02, 0], w: 0.08, h: 0.08 },
    { at: [-1.98, 1.42, 0], w: 0.06, h: 0.06 },
    { at: [-1.96, 0.92, 0], w: 0.05, h: 0.05 },
  ], 6), skin));
  parts.push(paint(loft([
    { at: [-1.96, 0.94, 0], w: 0.07, h: 0.07 },
    { at: [-1.96, 0.72, 0], w: 0.09, h: 0.09 },
    { at: [-1.96, 0.60, 0], w: 0.03, h: 0.03 },
  ], 6), () => DARK));

  return build(parts, 'elephant');
}
