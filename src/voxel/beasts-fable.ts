import type { Block } from './grid.ts';
import type { Box, Model } from './creatures.ts';

// THE GIRAFFE AND THE ELEPHANT, BUILT AS VOLUMES AND THEN CUT INTO BOXES.
//
// The brief: 1 block = 1/8 cubit = 0.0556 m; the giraffe 94 blocks to the
// ossicone tips, the elephant 56 to the crown; nose at low x, feet on y = 0,
// centred on z; and a silhouette that names the animal from twenty metres
// away at a fifth of the frame — which at that distance is two or three
// pixels per block. So nothing that matters is one block wide: ossicones are
// 2×2 and six tall, the mane is a two-deep ridge, tusks start four blocks
// thick, and the giraffe's patches are six-block polygons with cream seams
// rather than freckles.
//
// HOW THEY ARE DRAWN. A child builds a brick animal from cuboids; a sculptor
// builds it from lumps and sausages. The sausage is the right tool here — a
// leg is a sausage, a neck is a sausage at sixty degrees, a trunk is three
// sausages end to end, a tusk is a curved one — so each animal is authored
// into a volume (a Map of cells) with a few rounded primitives, painted on
// its SURFACE cells only, and then compiled into `Box[]` by merging runs
// along x. The interior of the body becomes one box per (y, z) row, so the
// box count stays in the low thousands however much pattern is on the skin.

// ── a volume of cells ───────────────────────────────────────────────────

const K = 1024, H = 512;
const key = (x: number, y: number, z: number) => ((x + H) * K + (y + H)) * K + (z + H);
const unkey = (k: number): [number, number, number] => {
  const z = (k % K) - H; k = (k - (z + H)) / K;
  const y = (k % K) - H; k = (k - (y + H)) / K;
  return [k - H, y, z];
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type P3 = [number, number, number];

class Vol {
  cells = new Map<number, Block>();

  set(x: number, y: number, z: number, c: Block) { this.cells.set(key(x, y, z), c); }
  get(x: number, y: number, z: number) { return this.cells.get(key(x, y, z)); }

  /** A solid box, corners in either order. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Block) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, c);
  }

  /** An ellipsoid. The half-block on each radius keeps a small one from being
   *  a plus sign, the same rule creatures.ts uses. */
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: Block) {
    const ax = rx + 0.5, ay = ry + 0.5, az = rz + 0.5;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const fx = ((x - cx) / ax) ** 2; if (fx > 1) continue;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        const fy = fx + ((y - cy) / ay) ** 2; if (fy > 1) continue;
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
          if (fy + ((z - cz) / az) ** 2 <= 1) this.set(x, y, z, c);
      }
    }
  }

  /** A sausage: a rounded tube from p0 to p1 whose radius tapers from r0 to
   *  r1, with a separate half-width across z (w0 → w1) so a neck can be deep
   *  but narrow. Built by stamping ellipsoids along the axis; the ends are
   *  rounded by construction, which is what a joint or a nose looks like. */
  sausage(p0: P3, r0: number, p1: P3, r1: number, c: Block, w0 = r0, w1 = r1) {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    const steps = Math.max(1, Math.ceil(len * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = lerp(r0, r1, t), w = lerp(w0, w1, t);
      this.ellipsoid(lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t), lerp(p0[2], p1[2], t), r, r, w, c);
    }
  }

  /** A body along x: at every x from x0 to x1, `f` gives the centre height
   *  and the two radii of the elliptical cross-section — so the back can
   *  slope, the chest can drop, the loin can pinch. */
  tubeX(x0: number, x1: number, f: (x: number) => { cy: number; ry: number; rz: number; cz?: number }, c: Block) {
    for (let x = x0; x <= x1; x++) {
      const { cy, ry, rz, cz = 0 } = f(x);
      if (ry <= 0 || rz <= 0) continue;
      const ay = ry + 0.5, az = rz + 0.5;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        const fy = ((y - cy) / ay) ** 2; if (fy > 1) continue;
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
          if (fy + ((z - cz) / az) ** 2 <= 1) this.set(x, y, z, c);
      }
    }
  }

  /** The cells with at least one open face — the only ones anyone sees. */
  surface(): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (const k of this.cells.keys()) {
      const [x, y, z] = unkey(k);
      if (!this.cells.has(key(x + 1, y, z)) || !this.cells.has(key(x - 1, y, z)) ||
          !this.cells.has(key(x, y + 1, z)) || !this.cells.has(key(x, y - 1, z)) ||
          !this.cells.has(key(x, y, z + 1)) || !this.cells.has(key(x, y, z - 1))) out.push([x, y, z]);
    }
    return out;
  }

  /** Recolours surface cells: `f` sees the cell and what it is made of and
   *  returns a new block or null to leave it. Interior cells are never
   *  touched — they are never drawn. */
  paint(f: (x: number, y: number, z: number, base: Block) => Block | null) {
    for (const [x, y, z] of this.surface()) {
      const base = this.get(x, y, z)!;
      const c = f(x, y, z, base);
      if (c) this.set(x, y, z, c);
    }
  }

  /** Cuts the volume into boxes: same-colour runs along x, one box each. */
  compile(): Box[] {
    const rows = new Map<number, [number, Block][]>();
    for (const [k, c] of this.cells) {
      const [x, y, z] = unkey(k);
      const rk = (y + H) * K + (z + H);
      let row = rows.get(rk);
      if (!row) rows.set(rk, row = []);
      row.push([x, c]);
    }
    const boxes: Box[] = [];
    for (const [rk, row] of rows) {
      const z = (rk % K) - H, y = (rk - (z + H)) / K - H;
      row.sort((a, b) => a[0] - b[0]);
      let start = row[0]![0], prev = start, colour = row[0]![1];
      for (let i = 1; i <= row.length; i++) {
        const next = row[i];
        if (next && next[0] === prev + 1 && next[1] === colour) { prev = next[0]; continue; }
        boxes.push([start, y, z, prev, y, z, colour]);
        if (next) { start = prev = next[0]; colour = next[1]; }
      }
    }
    return boxes;
  }
}

/** Finishes a model the way creatures.ts does: measured from its boxes. */
const finish = (boxes: Box[]): Model => {
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [ax, , az, bx, by, bz] of boxes) {
    x0 = Math.min(x0, ax); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
    z0 = Math.min(z0, az); z1 = Math.max(z1, bz);
  }
  return { height: y1 + 1, length: x1 - x0 + 1, width: z1 - z0 + 1, x0, boxes };
};

/** Piecewise-linear interpolation through (x, value) keys — the profile of
 *  a back, a belly, a width, written as a handful of landmarks. */
const keyed = (keys: [number, number][]) => (x: number): number => {
  if (x <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const [xa, va] = keys[i - 1]!, [xb, vb] = keys[i]!;
    if (x <= xb) return lerp(va, vb, (x - xa) / (xb - xa));
  }
  return keys[keys.length - 1]![1];
};

/** A deterministic hash in [0, 1). */
const hash = (i: number, j: number, k: number, s: number) => {
  let h = (i * 374761393) ^ (j * 668265263) ^ (k * 1274126177) ^ (s * 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return (((h ^ (h >>> 16)) >>> 0) % 10007) / 10007;
};

/** A giraffe's coat is not spots: it is a net. Polygonal patches with narrow
 *  pale seams between them — a Voronoi diagram, which this is: a jittered
 *  lattice of seed points, one per `period` blocks; a cell is seam-coloured
 *  where its nearest and second-nearest seeds are nearly equidistant, and
 *  patch-coloured otherwise. `seam` in blocks sets how wide the pale lines
 *  are. Evaluated in 3D so the pattern wraps every face the same way. */
const reticulated = (period: number, seam: number, seed: number) =>
  (x: number, y: number, z: number): boolean => {
    const i0 = Math.floor(x / period), j0 = Math.floor(y / period), k0 = Math.floor(z / period);
    let d1 = Infinity, d2 = Infinity;
    for (let i = i0 - 1; i <= i0 + 1; i++)
      for (let j = j0 - 1; j <= j0 + 1; j++)
        for (let k = k0 - 1; k <= k0 + 1; k++) {
          const px = (i + 0.15 + hash(i, j, k, seed) * 0.7) * period;
          const py = (j + 0.15 + hash(j, k, i, seed + 1) * 0.7) * period;
          const pz = (k + 0.15 + hash(k, i, j, seed + 2) * 0.7) * period;
          const d = Math.hypot(x - px, y - py, z - pz);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
    return d2 - d1 > seam;       // true inside a patch, false on the seam
  };

// ── THE GIRAFFE ─────────────────────────────────────────────────────────
//
// A bull: 5.2 m to the ossicones (94 blocks), 3.0 m at the withers (54),
// legs of 2 m, a neck of 1.85 m at fifty-seven degrees — about a third of
// the height, as the brief says. The back slopes from the withers to a rump
// eight blocks lower, which with the neck is the whole silhouette: a giraffe
// is a wedge with a pole on the high end. Chest deep, loin pinched, hocks
// well back, tail with a black tuft to the hock. The coat is a reticulated
// net of liver patches on cream, fading to plain cream below the knees and
// on the belly, with a cream face, a dark muzzle and dark ossicones.
export const GIRAFFE: Model = (() => {
  const v = new Vol();
  const tan: Block = 'giraffeTanHide';
  const dark: Block = 'giraffeManeHair';

  // the torso: withers at x≈2 (top block 54), rump at x≈36 (top 46)
  const back = keyed([[-8, 47], [-2, 52], [2, 54], [10, 53], [22, 50], [32, 47], [38, 46], [42, 44]]);
  const belly = keyed([[-8, 42], [-2, 36], [6, 34], [18, 35], [30, 36], [38, 38], [42, 41]]);
  const half = keyed([[-8, 3], [-2, 6], [4, 7.5], [16, 7], [28, 6.5], [36, 6.5], [42, 3]]);
  v.tubeX(-8, 42, (x) => ({ cy: (back(x) + belly(x)) / 2, ry: (back(x) - belly(x)) / 2, rz: half(x) }), tan);

  // legs: front pair straight, 2 m to the elbow, a knee bump and a dark hoof
  for (const s of [-1, 1]) {
    const z = 4.5 * s;
    v.sausage([4, 1, z], 2.2, [4, 20, z], 2.4, tan);
    v.sausage([4, 20, z], 2.8, [3, 40, z], 3.4, tan);
    v.ellipsoid(4, 19, z, 2.8, 2.5, 2.6, tan);                       // the knee
    v.box(3, 0, z - 2, 5, 1, z + 2, 'hoof');
    // hind pair: cannon vertical from the hoof to the hock, then the gaskin
    // forward and up to the stifle, and a thigh that joins the rump
    const zh = 4.5 * s;
    v.sausage([37, 1, zh], 2.2, [37, 16, zh], 2.4, tan);
    v.ellipsoid(37.5, 16, zh, 2.8, 2.6, 2.6, tan);                   // the hock, which stands proud behind
    v.sausage([37, 16, zh], 2.6, [33, 32, zh], 3.2, tan);
    v.sausage([33, 32, zh], 3.6, [34, 42, zh], 4.2, tan);
    v.box(36, 0, zh - 2, 38, 1, zh + 2, 'hoof');
  }

  // THE NECK: from the withers at (2, 52) to the poll at (-16, 80), thirty-
  // three blocks — deep and narrow at the base, half that at the head
  const n0: P3 = [3, 50, 0], n1: P3 = [-16, 80, 0];
  v.sausage(n0, 6.5, n1, 3.4, tan, 4.5, 2.6);
  // the mane: a dark ridge two deep along the back of the neck, standing a
  // block proud, from the withers up to between the ears
  {
    const dx = n1[0] - n0[0], dy = n1[1] - n0[1], L = Math.hypot(dx, dy);
    const nx = dy / L, ny = -dx / L;                                 // the normal that points up and back
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, r = lerp(6.5, 3.4, t) + 0.8;
      const cx = Math.round(lerp(n0[0], n1[0], t) + nx * r), cy = Math.round(lerp(n0[1], n1[1], t) + ny * r);
      v.box(cx, cy, 0, cx, cy + 1, 0, dark);
      v.box(cx + 1, cy - 1, 0, cx + 1, cy, 0, dark);
    }
  }

  // THE HEAD: a cranium, a long muzzle angled down a little, dark lips
  v.ellipsoid(-18, 84, 0, 5.5, 4.5, 3.6, tan);
  v.sausage([-20, 83, 0], 3.6, [-31, 79.5, 0], 2.6, tan, 3.2, 2.2);
  v.box(-32, 78, -2, -31, 80, 2, dark);                              // the muzzle, dark
  v.box(-33, 79, -1, -33, 80, 1, dark);
  v.ellipsoid(-15, 87, 0, 3.5, 2.5, 3, tan);                         // the poll
  // eyes: big and dark, on the sides of the skull; two blocks each so they
  // survive the distance
  for (const s of [-1, 1]) {
    v.box(-22, 84, 4 * s, -21, 85, 4 * s, 'eye');
    // ears: out to the sides and a little back, two thick so they read
    v.box(-17, 86, 4 * s, -15, 87, 8 * s, tan);
    v.box(-16, 88, 6 * s, -15, 88, 8 * s, tan);
    // OSSICONES: 2×2 posts, six tall, with a knob — dark, at 93 the top
    v.box(-16, 88, 2 * s, -15, 92, 3 * s, dark);
    v.box(-17, 92, 2 * s, -14, 93, 4 * s, dark);
  }

  // the tail: a two-block cord from the rump, a black tuft to the hock
  v.box(40, 36, 0, 41, 44, 0, tan);
  v.box(41, 26, 0, 41, 35, 0, tan);
  v.box(41, 17, -1, 42, 27, 1, dark);

  // THE COAT: a net of patches, seven blocks across with a block-wide seam
  const net = reticulated(7.5, 1.3, 11);
  v.paint((x, y, z, base) => {
    if (base !== tan) return null;
    if (y < 14) return null;                                         // pale below the knee
    if (x <= -19) return null;                                       // a cream face
    if (x > -8 && x < 42 && y < 38 && Math.abs(z) <= 4) return null; // a cream belly
    return net(x, y, z) ? 'giraffePatchHide' : null;
  });

  return finish(v.compile());
})();

// ── THE ELEPHANT ────────────────────────────────────────────────────────
//
// An African bull: 2.83 m at the shoulder (51 blocks), 3.12 m to the crown
// (56), and five and a half metres from the tusk tips to the tail. The
// signature from any angle is the mass on pillars, and then the three things
// that stick out of the mass: the trunk hanging to the ground, the ears
// spread like sails, and the tusks — so the ears here are a metre and a half
// tall and flared, the tusks are 1.3 m and ivory against grey, and the trunk
// is a full two metres with a curled tip. The back has the African saddle:
// high at the shoulder, a dip, and the hips up again.
export const ELEPHANT: Model = (() => {
  const v = new Vol();
  const grey: Block = 'elephantGreyHide';
  const shade: Block = 'elephantDarkHide';

  // the torso: shoulder top at 50 (block), saddle to 48, hips at 49
  const back = keyed([[-8, 42], [-3, 48], [4, 50], [12, 50], [24, 48], [38, 49], [46, 48], [54, 44], [58, 38]]);
  const belly = keyed([[-8, 32], [-3, 27], [4, 24], [20, 23], [36, 24], [48, 26], [54, 30], [58, 35]]);
  const half = keyed([[-8, 7], [-3, 10.5], [4, 12], [16, 12.5], [30, 12], [44, 11.5], [52, 9], [58, 4]]);
  v.tubeX(-8, 58, (x) => ({ cy: (back(x) + belly(x)) / 2, ry: (back(x) - belly(x)) / 2, rz: half(x) }), grey);

  // LEGS: pillars. Front pair under the shoulder, straight; hind pair a
  // little behind the hip with a heavier thigh. A flared foot with toenails.
  for (const s of [-1, 1]) {
    const z = 7 * s;
    v.sausage([8, 2, z], 4.4, [8, 30, z], 4.8, grey);
    v.ellipsoid(8, 1.5, z, 5.2, 2, 5.2, grey);                        // the foot, a little wider
    v.sausage([46, 2, z - s * 0.5], 4.2, [44, 30, z - s * 0.5], 5.6, grey);
    v.ellipsoid(46, 1.5, z - s * 0.5, 5, 2, 5, grey);
    // toenails: pale blocks round the front of each foot
    for (const dz of [-3, 0, 3]) {
      v.box(3, 0, z + dz, 3, 1, z + dz, 'toenailIvory');
      v.box(41, 0, z - s * 0.5 + dz, 41, 1, z - s * 0.5 + dz, 'toenailIvory');
    }
  }

  // THE HEAD: huge, and held so the crown is above the shoulder. A broad
  // skull, a bulging forehead, and a lower face that narrows to the trunk
  v.ellipsoid(-14, 44, 0, 11, 10.5, 9, grey);                        // the skull: top block 55
  v.ellipsoid(-20, 46, 0, 6, 7, 8, grey);                            // the forehead, forward and high
  v.ellipsoid(-19, 37, 0, 7, 6, 6.5, grey);                          // the face, down to the trunk root
  v.box(-24, 32, -3, -18, 34, 3, shade);                             // the mouth line under the trunk root
  // eyes, small and low on the side of the head
  for (const s of [-1, 1]) v.box(-21, 42, 8 * s, -20, 43, 9 * s, 'eye');

  // EARS: a sail on each side — hinged at the head just behind the eye,
  // sweeping back and OUT so they widen the silhouette from every angle.
  // Two blocks thick; the outline is an upper lobe over a smaller lower one.
  for (const s of [-1, 1]) {
    for (let x = -12; x <= 9; x++) {
      const t = (x + 12) / 21;                                       // 0 at the hinge, 1 at the back edge
      const z = 9 + t * 8;                                           // flare: 9 at the hinge, 17 at the edge
      for (let y = 22; y <= 55; y++) {
        const upper = ((x + 1) / 11) ** 2 + ((y - 45) / 10.5) ** 2 <= 1;
        const lower = ((x + 5) / 7.5) ** 2 + ((y - 33) / 10.5) ** 2 <= 1;
        if (!upper && !lower) continue;
        const zi = Math.round(z * s);
        v.set(x, y, zi, grey);
        v.set(x, y, zi + s, grey);
      }
    }
  }

  // THE TRUNK: from the face in three sausages — down and a little forward,
  // then down to the ground, then the tip curled forward. Root nine thick.
  v.sausage([-24, 37, 0], 4.6, [-30, 22, 0], 3.6, grey);
  v.sausage([-30, 22, 0], 3.6, [-33, 6, 0], 2.8, grey);
  v.sausage([-33, 6, 0], 2.8, [-39, 2, 0], 2.2, grey);
  // rings on the trunk: a darker band every fourth block, the wrinkles a
  // trunk is covered in, painted on the surface below the face
  v.paint((x, y, _z, base) => (base === grey && x <= -26 && y <= 33 && y % 4 === 0 ? shade : null));

  // TUSKS: from the lip either side of the trunk, forward and out, curving
  // up at the tip. Four thick at the root, ivory
  for (const s of [-1, 1]) {
    v.sausage([-24, 33, 4.5 * s], 2.2, [-32, 30, 5.5 * s], 2, 'tuskIvory');
    v.sausage([-32, 30, 5.5 * s], 2, [-40, 30, 6.5 * s], 1.6, 'tuskIvory');
    v.sausage([-40, 30, 6.5 * s], 1.6, [-47, 34, 7 * s], 1.2, 'tuskIvory');
  }

  // the tail: a cord from the rump to the hock, with a dark tuft
  v.box(56, 36, 0, 57, 42, 0, grey);
  v.box(57, 24, 0, 57, 35, 0, grey);
  v.box(57, 16, -1, 58, 25, 1, shade);

  return finish(v.compile());
})();
