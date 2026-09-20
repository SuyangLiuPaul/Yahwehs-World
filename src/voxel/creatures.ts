import { type Block, type Grid, PALETTE } from './grid.ts';

// THE LIVING THINGS, AS BLOCKS.
//
// Each creature is a list of boxes in its own local grid, built the way a
// child builds an animal out of bricks: a body, four legs, a head — and the
// ONE feature that names it. A giraffe is a neck with patches; an elephant is
// a trunk with ears; a camel is a hump under a saddle-blanket; a ram is a
// curled horn; a hen is a red comb. Get that feature right and the eye
// forgives everything else. The people get a face (two dark dots and a nose),
// hair, a beard for the men, a robe with a girdle, and hands that show.
//
// WHICH ANIMALS ARE HERE. The beasts a CC0 mesh exists for — sheep, cow, ox,
// ass, horse, swine, wolf — are voxelised from those meshes by
// tools/voxel/voxelise.py and look better than anything typed by hand. This
// file is for the rest: the eight people, and the animals no mesh was found
// for. `sheep`, `ox` and `ass` are still exported so the ark scene runs
// before the swap; they are placeholders and say so.
//
// UNITS. One block is an EIGHTH of a cubit — 0.0556 m. A man of four cubits
// is thirty-two blocks; a sheep is fifteen at the ears and twenty-one long.
// Every size below is taken from the register in src/walk/figures.ts, where
// it is stated in metres, so a camel stands over a goat here by the same
// margin it does in the field. The table at the end of the file says what
// each one measures. Getting sizes right is the whole point of this app;
// charm is allowed, but not at the cost of a wrong number.
//
// AXES. +x runs from the head to the tail (the face is at the LOW x end),
// y is up with the feet on y = 0, and z is the width, CENTRED on zero so a
// quarter turn spins the animal about its own spine. The origin is the
// ground under the front legs. Boxes are inclusive at both corners; later
// boxes overwrite earlier ones, which is how an eye, a patch or a girdle is
// painted onto a body: draw the body, then draw the mark.

/** One box of a creature: two corners and a colour, in the creature's grid. */
export type Box = [number, number, number, number, number, number, Block];

export interface Model {
  /** Blocks tall, from the ground to the highest block. */
  height: number;
  /** Blocks along x, nose to tail-tip. Optional: props.ts and terrain.ts
   *  write plain box lists, and `measure()` works it out from the boxes. */
  length?: number;
  /** Blocks across, z. */
  width?: number;
  /** The lowest x — where the nose is, relative to the origin. */
  x0?: number;
  boxes: Box[];
}

/** A model's footprint, whether or not it declared one. Placing a pair of
 *  beasts side by side needs to know how long each is, and an elephant that
 *  does not know its own length gets stamped through its mate — which is
 *  exactly what happened. */
export function measure(m: Model): { height: number; length: number; width: number; x0: number } {
  if (m.length !== undefined && m.width !== undefined && m.x0 !== undefined)
    return { height: m.height, length: m.length, width: m.width, x0: m.x0 };
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = -Infinity;
  for (const b of m.boxes) {
    x0 = Math.min(x0, b[0], b[3]); x1 = Math.max(x1, b[0], b[3]);
    z0 = Math.min(z0, b[2], b[5]); z1 = Math.max(z1, b[2], b[5]);
    y1 = Math.max(y1, b[1], b[4]);
  }
  return { height: m.height ?? y1 + 1, length: x1 - x0 + 1, width: z1 - z0 + 1, x0 };
}

/** Metres per block at the authored scale: an eighth of the common cubit. */
export const BLOCK_M = 0.445 / 8;

// ── a small vocabulary for drawing ───────────────────────────────────────

/** A box, corners in either order. */
const b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: Block): Box =>
  [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), block];

/** The same box on both sides of the spine: legs, ears, horns, eyes. */
const sym = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: Block): Box[] =>
  [b(x0, y0, z0, x1, y1, z1, block), b(x0, y0, -z0, x1, y1, -z1, block)];

/** Four legs, `t` blocks square, with the outer face at ±zOut. */
const legs = (xFront: number, xBack: number, zOut: number, top: number, t: number, block: Block, hoof: Block | null = 'hoof'): Box[] => [
  ...sym(xFront, 0, zOut, xFront + t - 1, top, zOut - t + 1, block),
  ...sym(xBack, 0, zOut, xBack + t - 1, top, zOut - t + 1, block),
  ...(hoof ? [
    ...sym(xFront, 0, zOut, xFront + t - 1, 0, zOut - t + 1, hoof),
    ...sym(xBack, 0, zOut, xBack + t - 1, 0, zOut - t + 1, hoof),
  ] : []),
];

type Paint = Block | ((x: number, y: number, z: number) => Block | null);

/** Every cell of a region, coloured by a function — the way to put a pattern
 *  on a shape. One box per cell; the inside is culled at build time anyway. */
const fill = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  f: (x: number, y: number, z: number) => Block | null): Box[] => {
  const out: Box[] = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        const c = f(x, y, z);
        if (c) out.push([x, y, z, x, y, z, c]);
      }
  return out;
};

/** A body: an elliptical cross-section (radii ry, rz about cy, cz) run along
 *  x. The half-block on each radius is what stops a 2-radius ellipse from
 *  being a plus sign. `yMin`/`yMax` keep only a band of it — a blanket over a
 *  back, a pale belly. */
const tube = (x0: number, x1: number, cy: number, cz: number, ry: number, rz: number, paint: Paint,
  o: { yMin?: number; yMax?: number } = {}): Box[] => {
  const inside = (y: number, z: number) => ((y - cy) / (ry + 0.5)) ** 2 + ((z - cz) / (rz + 0.5)) ** 2 <= 1;
  const yA = Math.max(cy - ry, o.yMin ?? -Infinity), yB = Math.min(cy + ry, o.yMax ?? Infinity);
  if (typeof paint === 'function')
    return fill(x0, yA, cz - rz, x1, yB, cz + rz, (x, y, z) => (inside(y, z) ? paint(x, y, z) : null));
  const out: Box[] = [];
  for (let y = yA; y <= yB; y++) {
    let hw = -1;
    while (inside(y, cz + hw + 1)) hw++;
    if (hw >= 0) out.push(b(x0, y, cz - hw, x1, y, cz + hw, paint));
  }
  return out;
};

/** An ellipsoid — a head, a hump, a mane. */
const blob = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, paint: Paint): Box[] => {
  const inside = (x: number, y: number, z: number) =>
    ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 + ((z - cz) / (rz + 0.5)) ** 2 <= 1;
  if (typeof paint === 'function')
    return fill(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z) => (inside(x, y, z) ? paint(x, y, z) : null));
  const out: Box[] = [];
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let z = cz - rz; z <= cz + rz; z++) {
      let hx = -1;
      while (inside(cx + hx + 1, y, z)) hx++;
      if (hx >= 0) out.push(b(cx - hx, y, z, cx + hx, y, z, paint));
    }
  return out;
};

/** A box with its edges cut back `r` — a rounded slab, a chunky head. */
const rbox = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, block: Block): Box[] => [
  b(x0 + r, y0, z0, x1 - r, y1, z1, block),
  b(x0, y0 + r, z0, x1, y1 - r, z1, block),
  b(x0, y0, z0 + r, x1, y1, z1 - r, block),
];

/** Patches: a jittered lattice of balls in space, radius `r`, one every
 *  `period` blocks; where a ball meets the skin there is a spot. Cheap, and
 *  it wraps round every face the same way, which a per-face pattern does not. */
const spotted = (base: Block, spot: Block, period: number, r: number) => {
  const hash = (i: number, j: number, k: number) => {
    let h = (i * 374761393) ^ (j * 668265263) ^ (k * 1274126177);
    h = (h ^ (h >>> 13)) * 1103515245;
    return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
  };
  return (x: number, y: number, z: number): Block => {
    const i0 = Math.floor(x / period), j0 = Math.floor(y / period), k0 = Math.floor(z / period);
    for (let i = i0; i <= i0 + 1; i++)
      for (let j = j0; j <= j0 + 1; j++)
        for (let k = k0; k <= k0 + 1; k++) {
          const px = i * period + (hash(i, j, k) - 0.5) * period * 0.6;
          const py = j * period + (hash(j, k, i) - 0.5) * period * 0.6;
          const pz = k * period + (hash(k, i, j) - 0.5) * period * 0.6;
          if ((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 <= r * r) return spot;
        }
    return base;
  };
};

/** Finishes a model: measures it, so a scene can space animals by their
 *  real footprint and a label can say how tall they stand. */
const model = (boxes: Box[]): Model => {
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [ax, , az, bx, by, bz] of boxes) {
    x0 = Math.min(x0, ax); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
    z0 = Math.min(z0, az); z1 = Math.max(z1, bz);
  }
  return { height: y1 + 1, length: x1 - x0 + 1, width: z1 - z0 + 1, x0, boxes };
};

/** Several models stood together — a hen and her chicks. */
const group = (...parts: [Model, number, number][]): Model =>
  model(parts.flatMap(([m, dx, dz]) =>
    m.boxes.map(([x0, y0, z0, x1, y1, z1, block]) => b(x0 + dx, y0, z0 + dz, x1 + dx, y1, z1 + dz, block))));

/** A model drawn at a coarser grid, blown up `k` times. Only the placeholders use it. */
const upscale = (m: Model, k: number): Model =>
  model(m.boxes.map(([x0, y0, z0, x1, y1, z1, block]) => b(x0 * k, y0 * k, z0 * k, x1 * k + k - 1, y1 * k + k - 1, z1 * k + k - 1, block)));

// ── people ───────────────────────────────────────────────────────────────
//
// Thirty-two blocks for a man (1.78 m, four cubits); thirty for a woman (the
// register's 1.63 m). From the ground: feet at 0, a robe from the flared hem
// to the shoulders, a two-block girdle at the waist with its knot and tail in
// front, a one-block neck, a four-block head. The arms hang OUTSIDE the robe
// so the hands show below the sleeves — a figure whose arms are inside the
// block of the robe is a bollard in a dress.
//
// The face is at -x: two eyes one block apart, a nose that sticks out one
// block, and for the men a beard that hangs over the chest. Men are
// short-haired, which is the rule for the whole cast (figures.ts cites 1 Cor
// 11:14); women wear a cloth over the crown that falls to the shoulders.
const person = (o: {
  robe: Block; girdle: Block; hair: Block; skin?: Block;
  woman?: boolean; beard?: boolean; headcloth?: Block; tunic?: boolean; staff?: boolean;
}): Model => {
  const skin: Block = o.skin ?? 'skin';
  const top = o.woman ? 29 : 31;            // crown of the head
  const headY = top - 3;                    // the head is four blocks
  const neckY = headY - 1;
  const sh = neckY - 1;                     // shoulder line
  const waist = sh - 13;                    // the girdle
  const hem = o.tunic ? 9 : 5;              // a worker's tunic stops at the knee
  const boxes: Box[] = [
    // feet, toes out in front of the hem; under a tunic, the shins
    ...sym(-4, 0, 1, -1, 0, 2, 'hide'),
    ...(o.tunic ? sym(-1, 1, 1, 0, hem - 1, 2, skin) : []),
    // the robe: four deep, seven wide, the hem a block wider each side (only
    // sideways — a hem that is deeper too reads as a plinth, not cloth)
    b(-2, hem, -3, 1, sh, 3, o.robe),
    o.tunic ? b(-2, hem, -4, 1, hem + 1, 4, o.robe) : b(-2, 1, -4, 1, 3, 4, o.robe),
    // the girdle, its knot, and a tail hanging from it
    b(-2, waist, -3, 1, waist + 1, 3, o.girdle),
    b(-3, waist - 1, -1, -3, waist + 1, 1, o.girdle),
    b(-3, waist - 5, 0, -3, waist - 2, 0, o.girdle),
    // arms outside the robe: sleeve from the shoulder, then a hand
    ...sym(-1, waist + 3, 4, 0, sh, 4, o.robe),
    ...sym(-1, waist, 4, 0, waist + 2, 4, skin),
    // neck and head
    b(-1, neckY, -1, 0, neckY, 1, skin),
    b(-3, headY, -2, 1, top, 2, skin),
    ...sym(-3, headY + 2, 1, -3, headY + 2, 1, 'eye'),                // eyes
    b(-4, headY + 1, 0, -4, headY + 1, 0, skin),                       // nose
    // hair: over the crown, round the back and sides, and no further down
    b(-3, top, -2, 1, top, 2, o.hair),
    b(-1, top - 1, -2, 1, top - 1, 2, o.hair),
    b(1, headY, -2, 1, top, 2, o.hair),
  ];
  if (o.beard) boxes.push(
    b(-3, headY, -2, 1, headY, 2, o.hair),                            // the jaw
    b(-4, headY - 3, -1, -3, headY, 1, o.hair),                       // hanging over the chest
  );
  if (o.headcloth) boxes.push(
    b(-3, top, -3, 1, top, 3, o.headcloth),                           // over the crown, a little wide
    b(1, sh - 2, -3, 2, top, 3, o.headcloth),                         // down the back to the shoulders
    ...sym(-2, headY, 3, 1, top, 3, o.headcloth),                     // and down the sides of the face
  );
  else if (o.woman) boxes.push(b(1, sh - 3, -2, 2, top, 2, o.hair));  // long hair down the back
  if (o.staff) boxes.push(b(-1, 0, 5, -1, top + 1, 5, 'beam'));       // a staff in the right hand, head-high
  return model(boxes);
};

// ── the flock ────────────────────────────────────────────────────────────

// A fat-tailed sheep (Lev 3:9): 0.76 m at the shoulder, 0.86 m to the ears.
// White fleece with a few tufts standing proud, a brown face and legs — the
// Awassi of the Near East. The PLACEHOLDER for the voxelised sheep; the ram
// is the same sheep with horns and is not a placeholder.
const sheepBody = (): Box[] => [
  ...legs(3, 15, 3, 5, 2, 'hide'),
  ...tube(0, 19, 9, 0, 4, 4, 'wool'),                               // the fleece, a fat barrel
  // tufts: single blocks of wool standing proud of the fleece
  ...[[2, 11], [6, 13], [10, 12], [14, 13], [17, 11], [4, 8], [12, 8]].flatMap(([x, y]) => sym(x!, y!, 5, x!, y!, 5, 'wool')),
  ...[[3, 14], [8, 14], [13, 14], [17, 14]].map(([x, y]) => b(x!, y!, 0, x!, y!, 0, 'wool')),
  b(20, 6, -2, 21, 10, 2, 'wool'),                                  // THE FAT TAIL, broad and hanging
  b(-2, 8, -2, -1, 12, 2, 'hide'),                                  // neck
  b(-6, 8, -2, -3, 13, 2, 'hide'),                                  // the face, roman-nosed
  b(-7, 8, -1, -7, 10, 1, 'hide'),                                  // muzzle
  b(-5, 14, -1, -3, 14, 1, 'wool'),                                 // a cap of wool on the poll
  ...sym(-4, 12, 3, -3, 12, 3, 'hide'),                             // ears, out to the sides
  ...sym(-6, 12, 2, -6, 12, 2, 'eye'),
];
const sheep = model(sheepBody());
// The ram: the curled horn is a spiral on each side of the head — from the
// poll, back, down behind the ear, and forward again under it.
const ramHorn: [number, number][] = [[-4, 14], [-3, 14], [-2, 14], [-1, 13], [-1, 12], [-1, 11], [-2, 10], [-3, 10], [-4, 10], [-5, 10], [-6, 11]];
const ram = model([
  ...sheepBody(),
  ...ramHorn.flatMap(([x, y]) => sym(x, y, 3, x, y, 3, 'horn')),
  ...ramHorn.slice(0, 7).flatMap(([x, y]) => sym(x, y, 4, x, y, 4, 'horn')),   // the thick root of the coil
]);

// The Syrian goat: dark, slab-sided, long ears that HANG, a beard, horns
// swept back, and a tail that points up — everything a sheep's does not,
// because Matt 25:32 turns on telling them apart. 0.80 m at the shoulder.
const goat = model([
  ...legs(2, 14, 3, 6, 2, 'goatDark'),
  ...tube(0, 17, 10, 0, 3, 3, 'goatDark'),                          // a narrow body
  b(-2, 9, -2, 0, 14, 2, 'goatDark'),                               // neck, carried up and forward
  b(-4, 12, -2, -2, 16, 2, 'goatDark'),
  b(-8, 12, -2, -4, 16, 2, 'goatDark'),                             // the head
  b(-9, 12, -1, -9, 13, 1, 'goatDark'),                             // muzzle
  b(-8, 9, 0, -7, 11, 0, 'wool'),                                   // the beard, pale, under the chin
  ...sym(-6, 12, 3, -5, 15, 3, 'goatDark'),                         // long ears, hanging
  ...sym(-8, 15, 2, -8, 15, 2, 'eye'),
  ...[[-6, 17], [-5, 18], [-4, 18], [-3, 19]].flatMap(([x, y]) => sym(x!, y!, 1, x!, y!, 1, 'horn')),   // horns, swept back
  b(18, 12, 0, 18, 15, 0, 'goatDark'),                              // tail, up
]);

// ── the beasts of burden ─────────────────────────────────────────────────

// A camel: 1.90 m at the shoulder, hump to 2.1 m, a long swan neck, dark
// knees, and the saddle-blanket the picture gives it, with tassels. The
// tallest thing in the yard but the giraffe and the elephant.
const camel = model([
  ...legs(4, 26, 4, 19, 3, 'camelTan'),
  ...sym(4, 8, 4, 6, 9, 2, 'hide'), ...sym(26, 8, 4, 28, 9, 2, 'hide'),      // dark knees
  ...tube(0, 33, 27, 0, 7, 5, 'camelTan'),                          // the body, high off the ground
  // the neck: down and forward from the chest, then up to the head
  b(-6, 22, -2, -1, 30, 2, 'camelTan'),
  b(-10, 25, -2, -6, 35, 2, 'camelTan'),
  b(-18, 33, -2, -10, 37, 2, 'camelTan'),                           // the long head, held level
  b(-19, 33, -1, -19, 35, 1, 'hide'),                               // a dark nose and split lip
  ...sym(-16, 36, 2, -16, 36, 2, 'eye'),
  ...sym(-11, 38, 2, -11, 38, 2, 'camelTan'),                       // small ears
  // the saddle blanket: a band draped over the back, one block proud
  ...tube(10, 24, 27, 0, 8, 6, 'robeRed', { yMin: 28 }),
  ...tube(14, 15, 27, 0, 8, 6, 'robeBlue', { yMin: 28 }),
  ...tube(19, 20, 27, 0, 8, 6, 'robeBlue', { yMin: 28 }),
  ...[11, 14, 17, 20, 23].flatMap((x) => sym(x, 26, 6, x, 27, 6, 'hay')),      // tassels at the hem
  ...blob(17, 36, 0, 6, 3, 3, 'camelTan'),                          // THE HUMP, up through the blanket
  b(34, 25, 0, 34, 32, 0, 'camelTan'), b(34, 22, 0, 34, 24, 0, 'hair'),         // tail with a tuft
]);

// ── the wild ─────────────────────────────────────────────────────────────

// A lion: 1.1 m at the shoulder, mane to 1.3 m, a body of two metres and
// most of a metre of tail with a black tuft. The mane is a dark ball round
// the whole head and shoulders, and the face is set into the front of it.
const lion = model([
  ...legs(3, 22, 3, 9, 3, 'lionTawny', null),
  ...sym(2, 0, 3, 5, 1, 1, 'lionTawny'), ...sym(21, 0, 3, 24, 1, 1, 'lionTawny'),   // paws, a block forward
  ...tube(0, 27, 15, 0, 5, 4, 'lionTawny'),
  ...tube(2, 25, 15, 0, 5, 4, 'sand', { yMax: 11 }),                // a pale belly
  ...blob(-2, 17, 0, 6, 6, 6, 'mane'),                              // THE MANE
  b(-11, 15, -3, -6, 21, 3, 'lionTawny'),                           // the face, proud of the mane
  b(-12, 15, -2, -12, 17, 2, 'wool'),                               // pale muzzle
  b(-13, 18, 0, -12, 18, 0, 'eye'),                                 // nose
  ...sym(-11, 19, 2, -11, 19, 2, 'eye'),
  b(-11, 14, -1, -10, 14, 1, 'mane'),                               // chin tuft
  ...sym(-7, 23, 3, -6, 24, 3, 'mane'),                             // ears, out of the top of the mane
  b(28, 17, 0, 35, 17, 0, 'lionTawny'), b(36, 18, 0, 39, 18, 0, 'lionTawny'),   // the tail, lifted at the end
  b(40, 19, 0, 41, 19, 0, 'lionTawny'), b(42, 19, 0, 43, 21, 0, 'hair'),        // its black tuft
]);

// ── the two the picture leads with ───────────────────────────────────────

// An elephant: 2.8 m at the shoulder, 3 m to the crown, five metres from
// trunk-tip to tail. Legs like pillars with toenails, ears like slabs behind
// the eyes, tusks, a twin-domed forehead, and a trunk that reaches the
// ground — the things a child draws first.
const elephant = model([
  ...legs(6, 44, 11, 23, 7, 'elephant', null),
  ...[3, 5, 7, 9].flatMap((z) => [...sym(6, 0, z, 6, 1, z, 'wool'), ...sym(44, 0, z, 44, 1, z, 'wool')]),   // toenails
  ...tube(0, 55, 37, 0, 13, 11, 'elephant'),                        // the body
  ...blob(-9, 44, 0, 10, 10, 8, 'elephant'),                        // the head
  ...sym(-12, 52, 4, -12, 52, 4, 'elephant'), ...blob(-12, 52, 4, 4, 3, 3, 'elephant'), ...blob(-12, 52, -4, 4, 3, 3, 'elephant'),   // twin domes
  ...rbox(-8, 34, 9, 3, 53, 10, 3, 'elephant'), ...rbox(-8, 34, -10, 3, 53, -9, 3, 'elephant'),   // EARS, slabs behind the eyes
  ...sym(-11, 44, 8, -10, 45, 8, 'eye'),
  // THE TRUNK: from the face, in three hanging steps, to a tip curled forward
  b(-22, 30, -3, -18, 40, 3, 'elephant'),
  b(-24, 16, -2, -21, 31, 2, 'elephant'),
  b(-26, 4, -2, -23, 17, 1, 'elephant'),
  b(-29, 2, -1, -25, 5, 1, 'elephant'),
  // TUSKS, curving forward and up either side of the trunk root
  ...sym(-30, 29, 5, -19, 31, 4, 'wool'), ...sym(-34, 31, 5, -30, 33, 4, 'wool'),
  b(56, 30, 0, 57, 44, 0, 'elephant'), b(56, 26, 0, 57, 29, 0, 'hair'),        // tail with a tuft
]);

// A giraffe: 5.2 m to the ossicones, 3 m at the shoulder, two metres of leg.
// Cream with brown patches — the patches are what make a tall yellow animal
// a giraffe rather than a ladder. The neck goes up in five steps at the lean
// of a real one, with a mane down the back of it.
const giraffe = (() => {
  const c: Block = 'giraffeCream';
  const spots = spotted(c, 'giraffeSpot', 7, 2.6);
  const boxes: Box[] = [
    ...legs(4, 30, 4, 31, 3, c),
    ...fill(4, 6, 2, 6, 31, 4, spots), ...fill(4, 6, -4, 6, 31, -2, spots),     // patches down the legs
    ...fill(30, 6, 2, 32, 31, 4, spots), ...fill(30, 6, -4, 32, 31, -2, spots),
    ...tube(0, 20, 45, 0, 8, 6, spots),                             // the body: high withers…
    ...tube(18, 37, 44, 0, 7, 6, spots),                            // …sloping to the rump
  ];
  for (let i = 0; i < 5; i++) {                                     // THE NECK, five steps up and forward
    const x = -4 * i, y = 52 + 6 * i;
    boxes.push(...fill(x - 4, y, -2, x, y + 8, 2, spots));
    boxes.push(b(x + 1, y + 3, 0, x + 1, y + 8, 0, 'hide'));       // mane down the back of the neck
  }
  boxes.push(
    b(-26, 82, -2, -19, 89, 2, c),                                  // the head, held level
    b(-30, 82, -1, -26, 86, 1, c),                                  // tapering muzzle
    b(-30, 82, -1, -30, 83, 1, 'hide'),                             // dark lips
    ...sym(-25, 87, 2, -24, 87, 2, 'eye'),
    ...sym(-22, 88, 3, -22, 88, 4, c),                              // ears, out to the sides
    ...sym(-22, 90, 1, -21, 93, 1, 'hide'),                         // OSSICONES
    b(38, 40, 0, 38, 50, 0, c), b(38, 33, 0, 38, 39, 0, 'hair'),    // tail with a long black tuft
  );
  return model(boxes);
})();

// ── birds ────────────────────────────────────────────────────────────────

// A dove (Gen 8:8), 0.33 m tall: white, with grey wing-tips and tail and an
// orange beak — a white mark with an orange point, which is what a dove is at
// any distance.
const dove = model([
  ...sym(2, 0, 1, 2, 1, 1, 'beak'),                                 // legs
  b(0, 2, -1, 4, 4, 1, 'wool'),                                     // body
  b(1, 1, -1, 3, 1, 1, 'wool'),                                     // breast
  b(-2, 3, -1, -1, 5, 1, 'wool'),                                   // head
  b(-3, 4, 0, -3, 4, 0, 'beak'),
  ...sym(-2, 5, 1, -2, 5, 1, 'eye'),
  ...sym(2, 4, 1, 4, 4, 1, 'stone'),                                // folded wings, grey at the tips
  b(5, 3, -1, 6, 3, 1, 'wool'), b(7, 3, -1, 7, 3, 1, 'stone'),      // tail
]);
const doveFlying = model([
  b(0, 1, -1, 4, 2, 1, 'wool'), b(-2, 2, -1, -1, 3, 1, 'wool'), b(-3, 3, 0, -3, 3, 0, 'beak'),
  ...sym(0, 2, 2, 3, 2, 5, 'wool'), ...sym(1, 3, 6, 2, 3, 8, 'wool'), ...sym(1, 3, 8, 2, 3, 8, 'stone'),   // wings up
  b(5, 1, -1, 7, 1, 1, 'wool'), b(7, 1, -1, 7, 1, 1, 'stone'),
]);

// A hen, 0.55 m to the comb: rust body, a darker wing, the tail up, and the
// red comb and wattle that say "chicken" before anything else does.
const hen = model([
  ...sym(2, 0, 1, 2, 1, 1, 'beak'), ...sym(1, 0, 1, 3, 0, 1, 'beak'),          // legs and toes
  ...rbox(0, 2, -2, 6, 5, 2, 1, 'henRust'),                         // the body
  ...sym(1, 3, 2, 4, 4, 2, 'hide'),                                 // a folded wing on each flank
  b(7, 5, -1, 7, 7, 1, 'hair'), b(8, 7, 0, 8, 8, 0, 'hair'),        // the tail, up and dark
  b(-1, 5, -1, 0, 6, 1, 'henRust'),                                 // neck
  b(-3, 6, -1, -1, 8, 1, 'henRust'),                                // head
  b(-3, 9, 0, -1, 9, 0, 'comb'), b(-2, 10, 0, -2, 10, 0, 'comb'),   // COMB
  b(-4, 6, 0, -4, 6, 0, 'comb'),                                    // wattle
  b(-4, 7, 0, -4, 7, 0, 'beak'),
  ...sym(-3, 8, 1, -3, 8, 1, 'eye'),
]);
const chick = model([
  b(0, 0, 0, 1, 1, 1, 'chick'), b(-1, 1, 0, -1, 2, 1, 'chick'),
  b(-2, 2, 0, -2, 2, 0, 'beak'),
]);
const henWithChicks = group([hen, 0, 0], [chick, 3, -6], [chick, 8, -3], [chick, -4, 5], [chick, 2, 7], [chick, 10, 4]);

// ── placeholders for the voxelised beasts ────────────────────────────────
// The scene stamps an ox and an ass; the real ones come from the mesh
// voxeliser. These are the old hand-drawn quarter-cubit ones blown up 2×, so
// the page runs and the sizes stay right until the swap. Not worth improving.
const oxPlaceholder = upscale(model([
  ...legs(2, 12, 3, 5, 2, 'hide'),
  b(0, 6, -3, 15, 11, 3, 'hide'), b(-2, 8, -2, -1, 11, 2, 'hide'), b(-5, 8, -2, -3, 12, 2, 'hide'),
  b(-6, 8, -1, -6, 9, 1, 'wool'), ...sym(-5, 11, 2, -5, 11, 2, 'eye'),
  ...sym(-4, 13, 2, -4, 13, 3, 'horn'), b(9, 4, -1, 11, 5, 1, 'udder'),
  b(4, 7, -3, 7, 10, -3, 'wool'), b(10, 8, 3, 13, 11, 3, 'wool'), b(16, 6, 0, 16, 11, 0, 'hide'),
]), 2);
const assPlaceholder = upscale(model([
  ...legs(2, 11, 1, 4, 1, 'assGrey'),
  b(0, 5, -2, 13, 8, 2, 'assGrey'), b(-2, 7, -1, -1, 10, 1, 'assGrey'), b(-5, 8, -1, -3, 10, 1, 'assGrey'),
  b(-5, 8, -1, -5, 8, 1, 'wool'), ...sym(-4, 10, 1, -4, 10, 1, 'eye'), ...sym(-3, 11, 1, -3, 12, 1, 'assGrey'),
  b(0, 8, 0, 13, 8, 0, 'hair'), b(14, 6, 0, 14, 8, 0, 'assGrey'),
]), 2);

export const MODELS: Record<string, Model> = {
  // the eight of Genesis 7:13 — Noah, his wife, his three sons and their wives
  noah: person({ robe: 'robeRed', girdle: 'robeBlue', hair: 'hairWhite', beard: true, staff: true }),
  noahWife: person({ robe: 'robeBlue', girdle: 'robeOchre', hair: 'hairWhite', woman: true, headcloth: 'linen' }),
  son: person({ robe: 'robeGreen', girdle: 'girdle', hair: 'hair', beard: true }),
  son2: person({ robe: 'robeOchre', girdle: 'robeRed', hair: 'hair', beard: true }),
  son3: person({ robe: 'linen', girdle: 'robeBlue', hair: 'hair', beard: true }),
  sonWife: person({ robe: 'robePlum', girdle: 'robeOchre', hair: 'hair', woman: true, headcloth: 'robeGrey' }),
  sonWife2: person({ robe: 'robeGrey', girdle: 'robeRed', hair: 'hair', woman: true, headcloth: 'linen' }),
  sonWife3: person({ robe: 'robeRed', girdle: 'girdle', hair: 'hair', woman: true }),
  worker: person({ robe: 'robeOchre', girdle: 'girdle', hair: 'hair', beard: true, tunic: true }),

  ram, goat, camel, lion, elephant, giraffe,
  dove, doveFlying, hen, chicken: hen, chick, henWithChicks,

  // placeholders until the voxelised meshes are wired in
  sheep, ox: oxPlaceholder, ass: assPlaceholder,
};

/** Stamps a model into the world at a block position, turned in quarter turns
 *  so a pair can face each other and a queue can face the ramp. The origin
 *  is the ground under the front legs, on the spine.
 *
 *  `scale` expands every authored block into a cube of that many world
 *  blocks. The models are written at eight blocks to the cubit, the fine grid
 *  of the ark scene, so the default is 1; a coarser world can pass more. */
export function stamp(grid: Grid, model: Model, at: [number, number, number], turn = 0, scale = 1) {
  const [ox, oy, oz] = at;
  for (const [x0, y0, z0, x1, y1, z1, block] of model.boxes) {
    const colour = PALETTE[block]!;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          // quarter turns about the model's own upright axis
          const [rx, rz] = turn === 0 ? [x, z] : turn === 1 ? [-z, x] : turn === 2 ? [-x, -z] : [z, -x];
          for (let sx = 0; sx < scale; sx++)
            for (let sy = 0; sy < scale; sy++)
              for (let sz = 0; sz < scale; sz++)
                grid.set(ox + rx * scale + sx, oy + y * scale + sy, oz + rz * scale + sz, colour);
        }
  }
}

// WHAT THEY MEASURE (blocks × 0.0556 m), against src/walk/figures.ts:
//   man 32 → 1.78 m (register 1.72)      woman 30 → 1.67 m (1.63)
//   ram / sheep 15 at the ears, 14 at the shoulder → 0.83 / 0.78 m (0.86 / 0.76), 29 long with the tail
//   goat 20 to the horn tips, 14 shoulder → 1.11 / 0.78 m (0.92 / 0.80)
//   camel 39 to the ears, 40 hump, 35 back → 2.17 / 2.22 / 1.94 m (2.05 / — / 1.90)
//   lion 25 to the ear tips, 21 shoulder → 1.39 / 1.17 m (not registered; a lion is ~1.2 m)
//   elephant 55 crown, 51 back → 3.06 / 2.83 m (not registered; an Asian bull ~2.7–3 m)
//   giraffe 94 → 5.2 m, 54 at the shoulder (not registered; a bull ~5 m)
//   dove 6 → 0.33 m (0.30)               hen 11 → 0.61 m (a hen is ~0.45 m; the head is up)
