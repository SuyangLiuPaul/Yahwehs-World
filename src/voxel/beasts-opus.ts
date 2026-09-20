import type { Model } from './creatures.ts';
import type { Block } from './grid.ts';

// A GIRAFFE AND AN ELEPHANT, BUILT BLOCK BY BLOCK.
//
// One block is an eighth of a cubit, 5.56 cm. The giraffe stands 94 blocks —
// 5.23 m — and the elephant 56, which is 3.12 m at the crown and 2.83 m at
// the shoulder. Those are real animals' measurements, not what looked right.
//
// What makes a blocky animal read is not the number of blocks. It is the
// SILHOUETTE, and specifically the few proportions the eye checks without
// being asked: on a giraffe, that the neck is about a third of the whole
// height, that the back slopes from shoulder down to rump, and that the legs
// are longer than the body is deep. Get those and a crude model reads; miss
// them and no amount of detail rescues it.
//
// BUILT AS CELLS, NOT AS A LIST OF BOXES. The first version of this file
// emitted boxes directly and painted the giraffe's patches onto a lattice —
// which put half of them in mid-air beside the animal, because nothing
// checked whether there was any hide at that spot. Filling a map of cells
// first means a patch can ask "is this animal here?" before it paints, and
// the answer is free.

type Cell = { x: number; y: number; z: number; block: Block };

class Body {
  private cells = new Map<number, Block>();
  private static key = (x: number, y: number, z: number) => ((x + 256) * 512 + (y + 256)) * 512 + (z + 256);

  put(x: number, y: number, z: number, block: Block) {
    this.cells.set(Body.key(Math.round(x), Math.round(y), Math.round(z)), block);
  }

  get(x: number, y: number, z: number) {
    return this.cells.get(Body.key(Math.round(x), Math.round(y), Math.round(z)));
  }

  /** Repaints a cell only if something is already there — how a marking goes
   *  onto an animal instead of floating beside it. */
  paint(x: number, y: number, z: number, block: Block) {
    const k = Body.key(Math.round(x), Math.round(y), Math.round(z));
    if (this.cells.has(k)) this.cells.set(k, block);
  }

  /** A solid ellipsoid — the shape almost every part of an animal really is. */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, block: Block) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1.02) this.put(x, y, z, block);
        }
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: Block) {
    for (let x = Math.round(x0); x <= Math.round(x1); x++)
      for (let y = Math.round(y0); y <= Math.round(y1); y++)
        for (let z = Math.round(z0); z <= Math.round(z1); z++) this.put(x, y, z, block);
  }

  /** A limb or a neck: a round shaft swept along a path, tapering as it goes. */
  shaft(from: [number, number, number], to: [number, number, number],
    rFrom: number, rTo: number, block: Block) {
    const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = rFrom + (rTo - rFrom) * t;
      this.blob(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t, r, r, r, block);
    }
  }

  /** Everything, as one box per cell — the mesher merges faces anyway, so
   *  there is nothing to gain from packing them into larger boxes here. */
  boxes(): [number, number, number, number, number, number, Block][] {
    const out: [number, number, number, number, number, number, Block][] = [];
    for (const [k, block] of this.cells) {
      const z = (k % 512) - 256;
      const y = (((k - (z + 256)) / 512) % 512) - 256;
      const x = ((k - (z + 256)) / 512 - (y + 256)) / 512 - 256;
      out.push([x, y, z, x, y, z, block]);
    }
    return out;
  }

  get size() { return this.cells.size; }

  all(): Cell[] {
    const out: Cell[] = [];
    for (const [k] of this.cells) {
      const z = (k % 512) - 256;
      const y = (((k - (z + 256)) / 512) % 512) - 256;
      const x = ((k - (z + 256)) / 512 - (y + 256)) / 512 - 256;
      out.push({ x, y, z, block: this.cells.get(k)! });
    }
    return out;
  }
}

const hash = (a: number, b: number, c: number) => {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ── the giraffe ──────────────────────────────────────────────────────────

const g = new Body();
{
  const shoulder = 52, rump = 44;
  // the barrel: deeper at the shoulder, sloping down to the rump
  for (let x = -8; x <= 22; x++) {
    const t = (x + 8) / 30;
    const top = shoulder - t * (shoulder - rump);
    g.blob(x, top - 7, 0, 0.6, 7.5 - t, 6.5 - t * 1.2, 'giraffeHide');
  }
  // four long legs, tapering to the ankle, with dark hooves
  for (const [lx, lz] of [[-5, -4], [-5, 4], [18, -4], [18, 4]] as [number, number][]) {
    const top = lx < 0 ? shoulder - 9 : rump - 9;
    g.shaft([lx, top, lz], [lx + (lx < 0 ? 1 : -1), 2, lz], 3.2, 1.9, 'giraffeHide');
    g.blob(lx + (lx < 0 ? 1 : -1), 1, lz, 2.4, 1.6, 2.4, 'hoof');
  }
  // the neck, leaning forward as it rises — a vertical neck reads as a chimney
  const neckTop: [number, number, number] = [-17, 86, 0];
  g.shaft([-6, shoulder - 2, 0], neckTop, 4.6, 2.6, 'giraffeHide');
  // head: skull, muzzle, ossicones, ears
  g.blob(-19, 88, 0, 3.2, 2.6, 2.4, 'giraffeHide');
  g.blob(-23, 87, 0, 2.6, 1.9, 2.0, 'giraffeMuzzle');
  g.box(-25, 87, -1, -24, 87, 1, 'hoof');                       // nostrils
  for (const s of [-1, 1]) {
    g.shaft([-18, 90, s * 1.6], [-18, 93, s * 1.8], 1.0, 0.9, 'giraffeHide');  // ossicone
    g.blob(-18, 93.5, s * 1.8, 1.2, 1.1, 1.1, 'giraffeMane');                  // its tuft
    g.blob(-16, 90, s * 4, 1.4, 1.6, 2.2, 'giraffeHide');                      // ear
    g.put(-21, 89, s * 3, 'eye');
  }
  // the tail, and the mane along the back of the neck
  g.shaft([22, rump - 4, 0], [25, rump - 12, 0], 1.2, 0.9, 'giraffeHide');
  g.blob(25, rump - 15, 0, 1.0, 2.6, 1.0, 'giraffeMane');
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    const x = -6 + (neckTop[0] + 6) * t, y = (shoulder - 2) + (neckTop[1] - shoulder + 2) * t;
    const r = 4.6 + (2.6 - 4.6) * t;
    g.paint(x + r * 0.7, y + r * 0.5, 0, 'giraffeMane');
  }

  // THE PATCHES — and this time asked of the animal, not of the air. Every
  // cell already placed is tested against a coarse noise lattice, so a patch
  // wraps round the body's own surface and stops at its edge.
  for (const c of g.all()) {
    if (c.block !== 'giraffeHide') continue;
    const n = hash(Math.floor((c.x + 40) / 5), Math.floor((c.y + 40) / 5), Math.floor((c.z + 40) / 5));
    const jitter = hash(c.x, c.y, c.z) * 0.22;
    if (n + jitter < 0.42) g.paint(c.x, c.y, c.z, 'giraffePatch');
  }
}

export const GIRAFFE: Model = { height: 94, boxes: g.boxes() };

// ── the elephant ─────────────────────────────────────────────────────────
// The three things that name it: a trunk reaching near the ground, ears like
// sails, and legs that are columns rather than sticks.

const e = new Body();
{
  const back = 50;
  // the barrel — the biggest single mass, rounded, not a slab
  for (let x = -14; x <= 20; x++) {
    const t = (x + 14) / 34;
    const bulge = Math.sin(t * Math.PI);
    e.blob(x, back - 11, 0, 0.6, 11 + bulge * 1.5, 10 + bulge * 2, 'elephantHide');
  }
  // four pillars
  for (const [lx, lz] of [[-8, -7], [-8, 7], [14, -7], [14, 7]] as [number, number][]) {
    e.shaft([lx, back - 16, lz], [lx, 3, lz], 5.2, 4.4, 'elephantHide');
    e.blob(lx, 1.5, lz, 5.0, 1.8, 5.0, 'elephantFoot');
  }
  // the head, set low and forward, and a domed brow
  e.blob(-19, back - 7, 0, 7.5, 8.5, 7.5, 'elephantHide');
  e.blob(-20, back + 1, 0, 5.5, 4.0, 6.0, 'elephantHide');
  for (const s of [-1, 1]) e.put(-24, back - 4, s * 5, 'eye');
  // the ears: broad and thin, swept back, standing proud of the head
  for (const s of [-1, 1])
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 18; j++) {
        const u = i / 15, v = j / 17;
        // an ear is roughly an oval; drop the corners so it is not a slab
        if ((u - 0.5) ** 2 / 0.27 + (v - 0.5) ** 2 / 0.3 > 1) continue;
        e.put(-21 + i, back - 14 + j, s * (7.5 + u * 3.5), 'elephantEar');
      }
  // the trunk, tapering and swinging forward
  const trunk: [number, number, number][] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    trunk.push([-25 - Math.sin(t * 1.9) * 6, back - 12 - t * 28, 0]);
  }
  for (let i = 0; i < trunk.length - 1; i++)
    e.shaft(trunk[i]!, trunk[i + 1]!, 3.6 - (i / trunk.length) * 2.1, 3.4 - ((i + 1) / trunk.length) * 2.1, 'elephantHide');
  // tusks, curving out and up from under the trunk
  for (const s of [-1, 1])
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      e.blob(-26 - t * 7, back - 16 + t * t * 5, s * (3.5 + t * 1.5), 1.2 - t * 0.4, 1.2 - t * 0.4, 1.2 - t * 0.4, 'tusk');
    }
  // a rope of a tail
  e.shaft([19, back - 8, 0], [22, back - 22, 0], 1.6, 1.0, 'elephantHide');
  e.blob(22, back - 25, 0, 1.0, 2.4, 1.0, 'elephantTail');
  // wrinkles: a few darker cells along the flank, so the hide is not one tone
  for (const c of e.all()) {
    if (c.block !== 'elephantHide') continue;
    if (hash(c.x, Math.floor(c.y / 2), c.z) > 0.9) e.paint(c.x, c.y, c.z, 'elephantFoot');
  }
}

export const ELEPHANT: Model = { height: 56, boxes: e.boxes() };
