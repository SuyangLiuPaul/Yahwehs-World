import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A LOW-POLY GIRAFFE AND ELEPHANT, GENERATED IN CODE.
//
// The style is the one in the two screenshots the owner sent: real proportions
// (a long neck, columnar legs, a big flat ear), a surface made of a few dozen
// large flat triangles, and — on the giraffe — patches that are just triangles
// coloured brown or yellow one by one. There is no texture at all. Everything
// is built from three things:
//
//   · ellipsoids   — an icosphere scaled to a body, a head, a muzzle;
//   · tubes        — a polygon swept along a path, for legs, neck, trunk;
//   · a paint pass — every triangle is given a flat colour of its own.
//
// Flat shading does the rest: with only six sides on a leg and eighty faces on
// a body, each facet catches the light differently, which is the whole look.
// Units are metres; the giraffe stands about 5.4 m and the elephant 3.2 m, and
// both face +x.

type Vec = [number, number, number];

/** A cheap hash of a position, so a colour depends on WHERE a triangle is and
 *  neighbouring triangles of one face agree. */
function hash3(x: number, y: number, z: number) {
  let h = (Math.round(x * 6) * 374761393 + Math.round(y * 6) * 668265263 + Math.round(z * 6) * 2246822519) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** An ellipsoid: an icosphere scaled, turned and moved. Not indexed, so every
 *  triangle has its own vertices and can be flat-shaded and painted alone. */
function blob(c: Vec, r: Vec, rot: Vec = [0, 0, 0], detail = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);        // already non-indexed
  g.scale(r[0], r[1], r[2]);
  g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]);
  g.translate(c[0], c[1], c[2]);
  return g;
}

/** A tube swept along `pts`, with a radius at each point and few sides. The
 *  ends are closed. Frames are built from a fixed reference so a slender leg
 *  does not twist. */
function tube(pts: Vec[], radii: number[], sides = 6, spin = 0): THREE.BufferGeometry {
  const P = pts.map((p) => new THREE.Vector3(...p));
  const rings: THREE.Vector3[][] = [];
  P.forEach((p, i) => {
    const d = (P[Math.min(i + 1, P.length - 1)]!.clone().sub(P[Math.max(i - 1, 0)]!)).normalize();
    const ref = Math.abs(d.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(d, ref).normalize();
    const v = new THREE.Vector3().crossVectors(d, u).normalize();
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + spin;
      ring.push(p.clone().addScaledVector(u, Math.cos(a) * radii[i]!).addScaledVector(v, Math.sin(a) * radii[i]!));
    }
    rings.push(ring);
  });
  const out: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings.length - 1; i++)
    for (let s = 0; s < sides; s++) {
      const a = rings[i]![s]!, b = rings[i]![(s + 1) % sides]!, c = rings[i + 1]![(s + 1) % sides]!, d = rings[i + 1]![s]!;
      tri(a, b, c); tri(a, c, d);
    }
  const cap = (ring: THREE.Vector3[], centre: THREE.Vector3, flip: boolean) => {
    for (let s = 0; s < sides; s++) {
      const a = ring[s]!, b = ring[(s + 1) % sides]!;
      if (flip) tri(centre, b, a); else tri(centre, a, b);
    }
  };
  cap(rings[0]!, P[0]!, true);
  cap(rings[rings.length - 1]!, P[P.length - 1]!, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/** Give every triangle its own flat colour, chosen by `fn` from its centre. */
function paint(g: THREE.BufferGeometry, fn: (c: THREE.Vector3, i: number) => THREE.ColorRepresentation): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Vector3(), colour = new THREE.Color();
  for (let t = 0; t < pos.count / 3; t++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3(pos.getX(t * 3 + k), pos.getY(t * 3 + k), pos.getZ(t * 3 + k)));
    c.multiplyScalar(1 / 3);
    colour.set(fn(c, t));
    for (let k = 0; k < 3; k++) { col[(t * 3 + k) * 3] = colour.r; col[(t * 3 + k) * 3 + 1] = colour.g; col[(t * 3 + k) * 3 + 2] = colour.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Reduce a part to exactly position + colour, so every part has the same
 *  attributes and they can be merged, then give it flat normals. */
const flat = (g: THREE.BufferGeometry) => {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  out.setAttribute('color', g.getAttribute('color'));
  out.computeVertexNormals();
  return out;
};

const material = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

// ── the giraffe ──────────────────────────────────────────────────────────
export function makeGiraffe(): THREE.Mesh {
  const YEL = 0xf0d63c, YEL2 = 0xe6c92e, BRN = 0x7a4a26, BRN2 = 0x5e3819, DARK = 0x4a2f1c;
  // patches: a triangle is brown or yellow by where it is, in blotches a
  // quarter-metre across, so the pattern reads as patches and not as noise
  const patch = (c: THREE.Vector3, share: number) => hash3(c.x * 0.55, c.y * 0.55, c.z * 0.55) < share ? (hash3(c.x, c.y, c.z + 9) > 0.5 ? BRN : BRN2) : (hash3(c.x, c.y + 3, c.z) > 0.5 ? YEL : YEL2);
  const parts: THREE.BufferGeometry[] = [];

  // the barrel, a little higher at the shoulder than at the rump
  parts.push(paint(blob([0.0, 3.0, 0], [1.4, 0.86, 0.56], [0, 0, 0.12], 1), (c) => patch(c, 0.34)));
  // legs: hip or shoulder, knee, ankle, hoof — front pair forward, back pair back
  for (const [x, z, front] of [[0.85, 0.28, 1], [0.85, -0.28, 1], [-0.85, 0.28, 0], [-0.85, -0.28, 0]] as [number, number, number][]) {
    const top = front ? 2.75 : 2.6, kneeX = x + (front ? 0.05 : -0.16);
    parts.push(paint(tube(
      [[x, top, z], [kneeX, 1.35, z], [x + (front ? 0.02 : 0.02), 0.35, z], [x + 0.02, 0.1, z]],
      [0.2, 0.11, 0.075, 0.1], 6), (c) => c.y < 0.16 ? DARK : patch(c, c.y > 1.3 ? 0.4 : 0.12)));
  }
  // neck: from the withers up and forward, thinning as it goes
  parts.push(paint(tube(
    [[0.8, 3.15, 0], [1.15, 3.9, 0], [1.55, 4.6, 0], [1.95, 5.2, 0]],
    [0.46, 0.34, 0.25, 0.2], 6), (c) => patch(c, 0.32)));
  // head: a tapering skull and a long muzzle, tilted forward
  parts.push(paint(blob([2.22, 5.3, 0], [0.5, 0.24, 0.23], [0, 0, -0.32], 1), (c) => c.y > 5.36 ? BRN : (hash3(c.x, c.y, c.z) > 0.6 ? YEL2 : YEL)));
  parts.push(paint(blob([2.52, 5.16, 0], [0.24, 0.13, 0.13], [0, 0, -0.32], 1), () => 0xd9b56a));
  // ears, ossicones and their knobs, and an eye
  for (const z of [0.2, -0.2]) {
    parts.push(paint(blob([2.05, 5.4, z * 1.5], [0.2, 0.06, 0.1], [0.3 * Math.sign(z), 0, 0.5], 0), () => BRN));
    parts.push(paint(tube([[2.15, 5.48, z * 0.7], [2.13, 5.72, z * 0.7]], [0.04, 0.035], 5), () => YEL));
    parts.push(paint(blob([2.13, 5.76, z * 0.7], [0.07, 0.07, 0.07], [0, 0, 0], 0), () => DARK));
    parts.push(paint(blob([2.36, 5.35, z * 1.1], [0.04, 0.04, 0.04], [0, 0, 0], 0), () => 0x1a120a));
  }
  // tail: a thin rope with a dark tuft
  parts.push(paint(tube([[-1.3, 3.05, 0], [-1.45, 2.4, 0], [-1.42, 1.85, 0]], [0.06, 0.045, 0.035], 5), () => YEL2));
  parts.push(paint(blob([-1.42, 1.72, 0], [0.09, 0.2, 0.09], [0, 0, 0], 0), () => BRN2));

  const geo = mergeGeometries(parts.map(flat), false)!;
  const mesh = new THREE.Mesh(geo, material());
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'giraffe';
  return mesh;
}

// ── the elephant ─────────────────────────────────────────────────────────
export function makeElephant(): THREE.Mesh {
  const shade = (base: number, c: THREE.Vector3, amt = 0.07) => {
    const k = 1 + (hash3(c.x, c.y, c.z) - 0.5) * 2 * amt;
    return new THREE.Color(base).multiplyScalar(k);
  };
  const HIDE = 0x7a6d58, HIDE2 = 0x655a48, EAR = 0x86775c, TUSK = 0xf1ede2, NAIL = 0xb8ad94;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(paint(blob([0, 2.0, 0], [1.75, 1.15, 1.0], [0, 0, 0], 1), (c) => shade(c.y < 1.5 ? HIDE2 : HIDE, c)));
  // the head, big and set forward
  parts.push(paint(blob([1.95, 2.3, 0], [0.85, 0.95, 0.72], [0, 0, 0], 1), (c) => shade(HIDE, c)));
  // ears: broad flat fans, swept back from the head and standing out from it
  for (const s of [1, -1]) {
    parts.push(paint(blob([1.45, 2.65, s * 0.95], [0.72, 0.95, 0.07], [0, s * 0.42, 0.12], 1), (c) => shade(EAR, c, 0.1)));
  }
  // trunk: from the face down and curling out at the tip
  parts.push(paint(tube(
    [[2.6, 2.05, 0], [3.0, 1.45, 0], [3.15, 0.85, 0], [3.05, 0.4, 0], [2.85, 0.2, 0]],
    [0.36, 0.3, 0.24, 0.18, 0.13], 7), (c) => shade(HIDE, c, 0.08)));
  // tusks
  for (const s of [1, -1])
    parts.push(paint(tube([[2.55, 1.55, s * 0.36], [3.0, 1.25, s * 0.52], [3.3, 1.3, s * 0.5]], [0.075, 0.05, 0.02], 5), () => TUSK));
  // legs: thick columns with a flared foot
  for (const [x, z] of [[1.15, 0.55], [1.15, -0.55], [-1.1, 0.55], [-1.1, -0.55]] as [number, number][]) {
    parts.push(paint(tube([[x, 1.7, z], [x, 0.9, z], [x, 0.22, z], [x, 0.0, z]], [0.5, 0.4, 0.4, 0.46], 7), (c) => c.y < 0.2 ? NAIL : shade(HIDE2, c, 0.08)));
  }
  // eyes and a tail
  for (const s of [1, -1]) parts.push(paint(blob([2.45, 2.55, s * 0.55], [0.05, 0.05, 0.05], [0, 0, 0], 0), () => 0x14100a));
  parts.push(paint(tube([[-1.7, 2.3, 0], [-1.95, 1.6, 0], [-1.9, 0.95, 0]], [0.08, 0.06, 0.05], 5), () => HIDE2));
  parts.push(paint(blob([-1.9, 0.85, 0], [0.1, 0.18, 0.1], [0, 0, 0], 0), () => 0x2c261c));

  const geo = mergeGeometries(parts.map(flat), false)!;
  const mesh = new THREE.Mesh(geo, material());
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'elephant';
  return mesh;
}
