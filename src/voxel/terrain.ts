import { type Block, type Grid, PALETTE } from './grid.ts';
import { type Model, stamp } from './creatures.ts';

// THE GROUND, AND WHAT GROWS ON IT.
//
// The ark scene was honest and bare: a box built to the verse, standing on
// one flat green. The reference picture's charm is mostly its GROUND —
// rolling grass with flowers in it, a worn path, a stream with a fall,
// rocks, reeds, a wood behind. None of that is Scripture, and all of it is
// why the picture gets looked at, so this file dresses the ground without
// touching the ark.
//
// TWO GRIDS, and this file writes to both. Say which is which:
//
//   COARSE — one block to the CUBIT (0.445 m), the grid the ark is built on.
//     paintGround() and carveRiver() write here. A field of grass at that
//     size is Minecraft's chunkiness, which is right, and two hundred by
//     eighty cubits of it is sixteen thousand blocks, not a million. The
//     functions take `blocksPerCubit` so the ground can be made finer, and
//     every length they accept is in CUBITS.
//
//   FINE — EIGHT blocks to the cubit (0.056 m), the grid of the creatures.
//     TREES, ROCKS, scatterTrees(), scatterVegetation() and dressRiver()
//     write here, where a flower can have a stem and a crown can have
//     clumps. A mature tree of six metres is about a hundred blocks tall.
//     The models are authored at that size and are stamped with `scale: 1`.
//     `finePerCubit` is a parameter too (default 8).
//
// DETERMINISM. Nothing here calls Math.random. Every scattered thing is
// placed by a hash of its own position, so the field is the same on every
// reload and two screenshots can be laid over each other. It is a HASH and
// not a stride (`(i * k) % n`): a stride lays flowers in diagonal rows,
// which is exactly what a meadow is not, and we had that bug once.
//
// COST. A field is ONE LAYER of blocks, not a solid volume: a block per
// column plus fill under a slope so a hillside shows no holes. A tree's
// crown is a lumpy implicit shape rasterised as its SKIN ONLY — a solid
// crown at fine scale would be thirty thousand blocks in the map before
// Grid.build() threw the inside away — so what a tree costs the map is
// what it shows. Each function reports what it wrote.

type Box = Model['boxes'][number];

// ── deterministic noise ──────────────────────────────────────────────────

/** A hash of a block column to [0, 1). Same inputs, same number, forever. */
export function hash(x: number, z: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((seed | 0) + 0x9e37, 1274126177);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const hash3 = (x: number, y: number, z: number, seed: number) => hash(x, Math.imul(y, 7919) + z, seed);

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Value noise: hashed lattice values `scale` apart, blended smoothly.
 *  Returns [0, 1). Where hash() is confetti, this is weather — patches. */
export function noise(x: number, z: number, scale: number, seed = 0): number {
  const gx = Math.floor(x / scale), gz = Math.floor(z / scale);
  const u = smooth(x / scale - gx), v = smooth(z / scale - gz);
  return lerp(
    lerp(hash(gx, gz, seed), hash(gx + 1, gz, seed), u),
    lerp(hash(gx, gz + 1, seed), hash(gx + 1, gz + 1, seed), u),
    v,
  );
}

/** A few octaves of noise(), so a hill has small bumps on its big bump. */
export function fbm(x: number, z: number, scale: number, seed = 0, octaves = 3): number {
  let sum = 0, amp = 1, norm = 0, s = scale;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, z, s, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    s = Math.max(1.5, s / 2);
  }
  return sum / norm;
}

// ── geometry helpers ─────────────────────────────────────────────────────

/** A rectangle of columns, both corners inclusive. */
export interface Rect { x0: number; z0: number; x1: number; z1: number }

/** A worn track: a polyline through the field and how wide the wear is. */
export interface Path { points: [number, number][]; width: number }

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : clamp01(((px - ax) * dx + (pz - az) * dz) / len2);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function distToPolyline(px: number, pz: number, pts: [number, number][]) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const d = distToSegment(px, pz, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

/** Catmull-Rom through the control points, so a river drawn with five
 *  points bends like water rather than like a fence. */
function catmull(points: [number, number][], spacing = 1): [number, number][] {
  if (points.length < 2) return points.slice();
  const out: [number, number][] = [];
  const P = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const perSegment = Math.max(4, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / spacing));
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

// ═════════════════════════════════════════════════════════════════════════
// THE COARSE GRID: ground and water, one block to the cubit
// ═════════════════════════════════════════════════════════════════════════

/** What the top block of a column is, so what grows knows where not to. */
export type Kind = 'grass' | 'dirt' | 'sand' | 'water' | 'rock';
const KIND: Record<Kind, number> = { grass: 0, dirt: 1, sand: 2, water: 3, rock: 4 };
const KINDS: Kind[] = ['grass', 'dirt', 'sand', 'water', 'rock'];

export interface GroundOptions {
  /** The columns to paint, in CUBITS. */
  rect: Rect;
  /** Coarse blocks to the cubit. Default 1: the ark's grid. */
  blocksPerCubit?: number;
  /** The y (in coarse blocks) of the SURFACE BLOCK where the ground is
   *  level; things stand on its top face at y + 1. The ark's hull starts
   *  at 0, so the default is -1. */
  y?: number;
  seed?: number;
  /** Hills, in cubits: `height` the tallest rise, `scale` the wavelength.
   *  Inside `flat` (grown by `margin`, over which the hills fade in) the
   *  ground stays level — the camp has to stand on something flat.
   *  `extra` adds height of your own, in cubits, such as a terrace. */
  relief?: { height: number; scale: number; flat?: Rect; margin?: number; extra?: (xCubit: number, zCubit: number) => number };
  /** Worn tracks, in cubits: dirt with a ragged edge that grades to grass. */
  paths?: Path[];
  /** Still water, in cubits: cut one block below the surface, sandy rim. */
  ponds?: { x: number; z: number; rx: number; rz: number }[];
  /** Chance per grass column of a stone flush in the turf. Default 0.006. */
  stones?: number;
}

/** What paintGround hands back: the shape of the ground, for everything
 *  that has to stand on it or stay off it, and what it cost. All of its
 *  coordinates are COARSE BLOCKS; `stand()` converts for the fine grid. */
export class Ground {
  private kinds: Uint8Array;
  private heights: Int16Array;
  /** The painted area, in coarse blocks. */
  readonly rect: Rect;
  readonly w: number;
  readonly d: number;
  blocks = 0;

  constructor(rectCubits: Rect, readonly bpc: number, readonly y: number) {
    this.rect = {
      x0: Math.floor(rectCubits.x0 * bpc), z0: Math.floor(rectCubits.z0 * bpc),
      x1: Math.ceil(rectCubits.x1 * bpc) - 1 + (bpc === 1 ? 1 : 0), z1: Math.ceil(rectCubits.z1 * bpc) - 1 + (bpc === 1 ? 1 : 0),
    };
    this.w = this.rect.x1 - this.rect.x0 + 1;
    this.d = this.rect.z1 - this.rect.z0 + 1;
    this.kinds = new Uint8Array(this.w * this.d);
    this.heights = new Int16Array(this.w * this.d);
  }

  inside(x: number, z: number) {
    return x >= this.rect.x0 && x <= this.rect.x1 && z >= this.rect.z0 && z <= this.rect.z1;
  }
  private idx(x: number, z: number) { return (z - this.rect.z0) * this.w + (x - this.rect.x0); }

  /** The y of the surface block in a coarse column (outside the rect: level). */
  top(x: number, z: number): number {
    return this.inside(x, z) ? this.y + this.heights[this.idx(x, z)]! : this.y;
  }
  setTop(x: number, z: number, top: number) {
    if (this.inside(x, z)) this.heights[this.idx(x, z)] = top - this.y;
  }
  kind(x: number, z: number): Kind {
    return this.inside(x, z) ? KINDS[this.kinds[this.idx(x, z)]!]! : 'grass';
  }
  mark(x: number, z: number, kind: Kind) {
    if (this.inside(x, z)) this.kinds[this.idx(x, z)] = KIND[kind];
  }
  /** True when the coarse columns within `r` blocks of (x, z) are all grass. */
  clear(x: number, z: number, r: number): boolean {
    const step = Math.max(1, Math.floor(r / 2));
    for (let dx = -r; dx <= r; dx += step)
      for (let dz = -r; dz <= r; dz += step)
        if (this.kind(x + dx, z + dz) !== 'grass') return false;
    return true;
  }

  /** The fine grid's view of the ground: for a FINE column, the fine y a
   *  thing stands at (the top face of the coarse block under it) and what
   *  that block is. `finePerCubit` is the fine grid's resolution. */
  stand(finePerCubit: number) {
    const f = finePerCubit / this.bpc;          // fine blocks per coarse block
    return {
      y: (xf: number, zf: number) => (this.top(Math.floor(xf / f), Math.floor(zf / f)) + 1) * f,
      kind: (xf: number, zf: number) => this.kind(Math.floor(xf / f), Math.floor(zf / f)),
      clear: (xf: number, zf: number, rCubits: number) =>
        this.clear(Math.floor(xf / f), Math.floor(zf / f), Math.max(1, Math.round(rCubits * this.bpc))),
      perCoarse: f,
    };
  }
}

/**
 * Paints a field over a rectangle of the COARSE grid: one block per column,
 * grass in three greens laid in patches by noise (never stripes), worn dirt
 * where a path runs, sand round the ponds, and the odd stone. With `relief`
 * the field rolls, and the slopes are filled underneath so no hillside has
 * holes.
 *
 * Cost: about 1.0 block per column on the flat, more under slopes;
 * 120 × 80 cubits with gentle hills at one block per cubit is ~11k.
 */
export function paintGround(coarse: Grid, opts: GroundOptions): Ground {
  const P = PALETTE;
  const bpc = opts.blocksPerCubit ?? 1;
  const y = opts.y ?? -1;
  const seed = opts.seed ?? 1;
  const ground = new Ground(opts.rect, bpc, y);
  const { rect } = ground;
  const before = coarse.size;
  const c = (blocks: number) => blocks / bpc;          // a block coordinate, in cubits

  // heights first, because the fill under a slope needs the neighbours
  const relief = opts.relief;
  const heightAt = (x: number, z: number): number => {
    if (!relief) return 0;
    const xc = c(x), zc = c(z);
    let mask = 1;
    if (relief.flat) {
      const m = relief.margin ?? 12;
      const f = relief.flat;
      const dx = Math.max(f.x0 - xc, 0, xc - f.x1), dz = Math.max(f.z0 - zc, 0, zc - f.z1);
      mask = smooth(clamp01(Math.hypot(dx, dz) / m));
    }
    const n = fbm(xc, zc, relief.scale, seed + 11, 3);
    // squared, so most of the field is low and the hills are hills
    const h = relief.height * n * n * mask + (relief.extra ? relief.extra(xc, zc) : 0);
    return Math.round(h * bpc);
  };
  for (let z = rect.z0; z <= rect.z1; z++)
    for (let x = rect.x0; x <= rect.x1; x++) ground.setTop(x, z, y + heightAt(x, z));

  const paths = opts.paths ?? [];
  const ponds = opts.ponds ?? [];
  const stones = opts.stones ?? 0.006;
  for (let z = rect.z0; z <= rect.z1; z++)
    for (let x = rect.x0; x <= rect.x1; x++) {
      const xc = c(x), zc = c(z);
      const top = ground.top(x, z);
      // fill under the slope: down to one above the lowest neighbour, so a
      // step of one block shows a green edge and a cliff shows earth and rock
      const lowest = Math.min(ground.top(x - 1, z), ground.top(x + 1, z), ground.top(x, z - 1), ground.top(x, z + 1));
      for (let yy = lowest + 1; yy < top; yy++) coarse.set(x, yy, z, top - yy > 2 * bpc ? P.rock! : P.dirt!);

      // ponds: water one block down, sand on the rim, and the rim's wall
      let pond = 0;
      for (const p of ponds) {
        const d = ((xc - p.x) * (xc - p.x)) / (p.rx * p.rx) + ((zc - p.z) * (zc - p.z)) / (p.rz * p.rz);
        const edge = d + (noise(xc, zc, 2.5, seed + 3) - 0.5) * 0.2;
        if (edge <= 1) { pond = 2; break; }
        if (edge <= 1.4) pond = 1;
      }
      if (pond === 2) {
        coarse.set(x, top - 1, z, hash(x, z, seed + 4) < 0.3 ? P.waterDeep! : P.water!);
        ground.setTop(x, z, top - 1);
        ground.mark(x, z, 'water');
        continue;
      }
      if (pond === 1) {
        coarse.set(x, top, z, P.sand!);
        coarse.set(x, top - 1, z, P.sand!);
        ground.mark(x, z, 'sand');
        continue;
      }

      // worn dirt where the paths run: the edge wanders by noise, and a
      // fringe outside it is grass and dirt mixed, which is what worn looks like
      let worn = 0;
      for (const path of paths) {
        const d = distToPolyline(xc, zc, path.points);
        const hw = (path.width / 2) * (0.7 + 0.6 * noise(xc, zc, 3, seed + 5));
        if (d < hw) worn = Math.max(worn, 2 - clamp01((d - hw * 0.4) / (hw * 0.6)));
        else if (d < hw + 1) worn = Math.max(worn, 0.5);
      }
      if (worn >= 0.5) {
        const r = hash(x, z, seed + 6);
        if (worn >= 1.5 || (worn >= 1 && r < 0.8) || (worn < 1 && r < 0.35)) {
          const col = worn > 1.6 && r < 0.45 ? P.dirtLight! : r < 0.12 ? P.dirtDark! : P.dirt!;
          coarse.set(x, top, z, col);
          ground.mark(x, z, 'dirt');
          continue;
        }
      }

      // grass, in patches: two scales of noise pick among three greens, with
      // a dry yellow patch now and then so the field has weather in it
      const n = 0.62 * noise(xc, zc, 7, seed + 7) + 0.38 * noise(xc, zc, 2.5, seed + 8);
      let col = P.grass!;
      if (n < 0.37) col = P.grassDark!;
      else if (n > 0.65) col = P.grassLight!;
      if (noise(xc, zc, 9, seed + 9) > 0.8 && n > 0.5) col = P.grassDry!;
      if (hash(x, z, seed + 10) < stones) {
        // flush with the turf: a cubit cube standing proud reads as a
        // concrete block, so the loose stones are left to the fine grid
        col = hash(x, z, seed + 12) < 0.5 ? P.rock! : P.rockLight!;
        ground.mark(x, z, 'rock');
      }
      coarse.set(x, top, z, col);
    }

  ground.blocks = coarse.size - before;
  return ground;
}

export interface RiverOptions {
  /** Control points of the course in CUBITS, upstream first. */
  points: [number, number][];
  /** Full width of the water, in cubits. It varies ±30% along the course. */
  width: number;
  /** The field it runs through: the water follows the ground downhill. */
  ground: Ground;
  seed?: number;
  /** A fall the ground does not give: at fraction `t` of the course the
   *  water steps down `drop` cubits into a cut, with a pool at the foot.
   *  Where the ground itself drops (a terrace in relief.extra) the water
   *  steps down on its own and this is not needed. */
  fall?: { t: number; drop: number };
  /** Width of the sandy bank either side, in cubits. Default 1.5. */
  bank?: number;
}

export interface River {
  blocks: number;
  /** The centreline as sampled, in coarse blocks, with the water level. */
  samples: { x: number; z: number; s: number; level: number }[];
  /** Coarse columns of water: [x, z, level, still]. `still` is false on a
   *  step, where a lily would be swept away. */
  water: [number, number, number, boolean][];
  /** Coarse columns of bank: [x, z, top]. */
  banks: [number, number, number][];
  length: number;
}

/**
 * Carves a watercourse into the COARSE grid: water one block below the
 * turf, a bank of sand that walls the cut, and where the level drops, a
 * stair of water blocks with foam at the foot. The level only ever goes
 * DOWN along the course — it is set from the ground under the centreline,
 * so a stream drawn from a terrace to the flat falls off the terrace by
 * itself.
 *
 * Cost: about width × length for the water plus two banks; a 100-cubit
 * stream 4 cubits wide is ~1.2k blocks at one block per cubit.
 */
export function carveRiver(coarse: Grid, opts: RiverOptions): River {
  const P = PALETTE;
  const { ground } = opts;
  const bpc = ground.bpc;
  const seed = opts.seed ?? 2;
  const bank = (opts.bank ?? 1.5) * bpc;
  const before = coarse.size;

  // sample the course (in coarse blocks, about a block apart) and set the
  // water level, monotone downstream
  const pts = catmull(opts.points.map(([x, z]) => [x * bpc, z * bpc] as [number, number]), 1);
  const samples: River['samples'] = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [px, pz] = pts[i]!;
    if (i > 0) s += Math.hypot(px - pts[i - 1]![0], pz - pts[i - 1]![1]);
    samples.push({ x: px, z: pz, s, level: 0 });
  }
  const length = s;
  let level = Infinity;
  const fallAt = opts.fall ? opts.fall.t * length : -1;
  for (const smp of samples) {
    const g = ground.top(Math.round(smp.x), Math.round(smp.z)) - 1;
    let want = Math.min(level, g);
    if (opts.fall && smp.s >= fallAt) {
      // one block down per block along, until the drop is spent
      const stepped = Math.min(Math.round(opts.fall.drop * bpc), Math.floor(smp.s - fallAt) + 1);
      want = Math.min(want, g - stepped);
    }
    // water goes down ONE block per sample, so a cliff in the ground
    // becomes a stair of water on rock — the fall the brief asked for —
    // rather than a sheet hanging in the air
    if (level !== Infinity && want < level - 1) want = level - 1;
    level = want;
    smp.level = level;
  }
  // where the level fell steeply, a pool spreads at the foot
  const footOf: number[] = [];
  for (let i = 3; i < samples.length; i++)
    if (samples[i - 3]!.level - samples[i]!.level >= 2 && (i + 1 >= samples.length || samples[i]!.level === samples[i + 1]!.level))
      footOf.push(samples[i]!.s);

  const halfW = (opts.width / 2) * bpc;
  const widthAt = (i: number) => {
    const sAt = samples[i]!.s;
    let pool = 1;
    for (const f of footOf) if (sAt >= f - 1) pool = Math.max(pool, 1 + 0.8 * Math.exp(-(sAt - f) / (9 * bpc)));
    return halfW * (0.7 + 0.6 * noise(sAt, 0, 10 * bpc, seed + 1)) * pool;
  };

  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const smp of samples) {
    bx0 = Math.min(bx0, smp.x); bx1 = Math.max(bx1, smp.x);
    bz0 = Math.min(bz0, smp.z); bz1 = Math.max(bz1, smp.z);
  }
  const reach = halfW * 2 + bank + 2;
  const water: River['water'] = [];
  const banks: River['banks'] = [];
  const foamSpots: [number, number, number][] = [];
  for (let z = Math.floor(bz0 - reach); z <= Math.ceil(bz1 + reach); z++)
    for (let x = Math.floor(bx0 - reach); x <= Math.ceil(bx1 + reach); x++) {
      // nearest sample, by brute force: the course is short
      let bi = 0, bd = Infinity;
      for (let i = 0; i < samples.length; i++) {
        const smp = samples[i]!;
        const d = (smp.x - x) * (smp.x - x) + (smp.z - z) * (smp.z - z);
        if (d < bd) { bd = d; bi = i; }
      }
      const smp = samples[bi]!;
      const w = widthAt(bi);
      const edge = Math.sqrt(bd) + (noise(x, z, 2 * bpc, seed + 2) - 0.5) * 1.6 * bpc;
      if (edge >= w + bank) continue;
      const top = ground.top(x, z);
      const lvl = smp.level;
      if (edge < w) {
        // WATER. Clear the turf and the fill above the level, then the
        // water block. Where the course steps down, the step's water is
        // white, and where the stair runs above the ground at the foot of a
        // cliff, rock is built up under it — a stepped fall.
        coarse.carve(x, lvl + 1, z, x, Math.max(top, lvl + 1), z);
        for (let yy = top; yy < lvl; yy++) coarse.set(x, yy, z, P.rock!);
        const up = bi > 0 ? samples[bi - 1]!.level : lvl;
        const stepping = up > lvl;
        const deep = edge < w * 0.45 && !stepping;
        coarse.set(x, lvl, z, stepping && hash(x, z, seed + 8) < 0.7 ? P.foam! : deep ? P.waterDeep! : P.water!);
        if (stepping) foamSpots.push([x, lvl, z]);
        ground.setTop(x, z, lvl);
        ground.mark(x, z, 'water');
        water.push([x, z, lvl, !stepping && edge < w * 0.7]);
      } else {
        // BANK. Sand on top, and a wall down to the water level so the cut
        // shows earth and rock, not the inside of the world.
        coarse.set(x, top, z, P.sand!);
        for (let yy = lvl; yy < top; yy++) coarse.set(x, yy, z, top - yy <= 1 ? P.sand! : top - yy <= 2 * bpc ? P.dirtDark! : P.rock!);
        ground.mark(x, z, 'sand');
        banks.push([x, z, top]);
      }
    }

  // foam at the foot of every step, and a splash thrown up now and then
  for (const [x, yy, z] of foamSpots) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const nx = x + dx, nz = z + dz;
      if (ground.kind(nx, nz) === 'water' && ground.top(nx, nz) === yy && hash(nx, nz, seed + 5) < 0.45) coarse.set(nx, yy, nz, P.foam!);
    }
  }

  return { blocks: coarse.size - before, samples, water, banks, length };
}

// ═════════════════════════════════════════════════════════════════════════
// THE FINE GRID: trees, bushes, reeds, flowers, stones — eight to the cubit
// ═════════════════════════════════════════════════════════════════════════

/** Fine blocks to the cubit, the default this file authors at. */
export const FINE_PER_CUBIT = 8;

// ── a rasteriser for lumpy shapes ────────────────────────────────────────
//
// A crown is not drawn box by box. It is an implicit shape — a few
// ellipsoids thrown together, their surfaces roughened by hash — and only
// its SKIN is written out, as vertical runs of blocks. Each skin block gets
// one of three tones by what it faces: a lighter one on top, the plain one
// on the sides, a darker one underneath. That baked shading is most of why
// the crowns read as foliage at all.

/** Three tones of a material: top, side, underside. */
type Tone = [Block, Block, Block];
type Bounds = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
/** The material index at a point, or -1 for air. */
type Field = (x: number, y: number, z: number) => number;

function shell(b: Bounds, field: Field, tones: Tone[]): Box[] {
  const W = b.x1 - b.x0 + 3, H = b.y1 - b.y0 + 3, D = b.z1 - b.z0 + 3;
  const cells = new Int8Array(W * H * D).fill(-1);
  const at = (x: number, y: number, z: number) => cells[((x - b.x0 + 1) * H + (y - b.y0 + 1)) * D + (z - b.z0 + 1)]!;
  for (let x = b.x0; x <= b.x1; x++)
    for (let y = b.y0; y <= b.y1; y++)
      for (let z = b.z0; z <= b.z1; z++) cells[((x - b.x0 + 1) * H + (y - b.y0 + 1)) * D + (z - b.z0 + 1)] = field(x, y, z);
  const boxes: Box[] = [];
  for (let x = b.x0; x <= b.x1; x++)
    for (let z = b.z0; z <= b.z1; z++) {
      let runStart = 0, runBlock: Block | null = null;
      const flush = (yEnd: number) => { if (runBlock) boxes.push([x, runStart, z, x, yEnd, z, runBlock]); runBlock = null; };
      for (let y = b.y0; y <= b.y1; y++) {
        const m = at(x, y, z);
        if (m < 0) { flush(y - 1); continue; }
        const buried = at(x + 1, y, z) >= 0 && at(x - 1, y, z) >= 0 && at(x, y + 1, z) >= 0
          && at(x, y - 1, z) >= 0 && at(x, y, z + 1) >= 0 && at(x, y, z - 1) >= 0;
        if (buried) { flush(y - 1); continue; }
        const tone = tones[m]!;
        const block = at(x, y + 1, z) < 0 ? tone[0] : at(x, y - 1, z) < 0 ? tone[2] : tone[1];
        if (block !== runBlock) { flush(y - 1); runStart = y; runBlock = block; }
      }
      flush(b.y1);
    }
  return boxes;
}

/** An ellipsoid with a roughened surface: lumps of a crown are these. */
interface Lump { cx: number; cy: number; cz: number; rx: number; ry: number; rz: number; m: number }

/** The field of a set of lumps: inside the first lump that claims the
 *  point, with the surface pushed in and out by a blocky noise so a crown
 *  is clumps, not balloons. `grain` is the size of the clumps. */
function lumpField(lumps: Lump[], seed: number, grain = 4, rough = 0.35): Field {
  return (x, y, z) => {
    const bump = (hash3(Math.floor(x / grain), Math.floor(y / grain), Math.floor(z / grain), seed) - 0.5) * rough
      + (hash3(x, y, z, seed + 1) - 0.5) * 0.08;
    for (const l of lumps) {
      const dx = (x - l.cx) / l.rx, dy = (y - l.cy) / l.ry, dz = (z - l.cz) / l.rz;
      if (dx * dx + dy * dy + dz * dz <= 1 + bump) return l.m;
    }
    return -1;
  };
}

function boundsOf(lumps: Lump[]): Bounds {
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const l of lumps) {
    b.x0 = Math.min(b.x0, Math.floor(l.cx - l.rx * 1.2)); b.x1 = Math.max(b.x1, Math.ceil(l.cx + l.rx * 1.2));
    b.y0 = Math.min(b.y0, Math.floor(l.cy - l.ry * 1.2)); b.y1 = Math.max(b.y1, Math.ceil(l.cy + l.ry * 1.2));
    b.z0 = Math.min(b.z0, Math.floor(l.cz - l.rz * 1.2)); b.z1 = Math.max(b.z1, Math.ceil(l.cz + l.rz * 1.2));
  }
  return b;
}

const j = (seed: number, k: number, lo: number, hi: number) => lo + hash(seed, k, 77) * (hi - lo);
const ji = (seed: number, k: number, lo: number, hi: number) => Math.round(j(seed, k, lo, hi));

const LEAF: Tone = ['leafLight', 'leaf', 'leafDark'];
const LEAF_PALE: Tone = ['grassLight', 'leafLight', 'leaf'];
const LEAF_GOLD: Tone = ['petalYellow', 'grassDry', 'hay'];
const PINE: Tone = ['pineLight', 'pine', 'pineDark'];
const OLIVE: Tone = ['oliveLight', 'olive', 'leaf'];
const ROCK: Tone = ['rockLight', 'rock', 'rock'];
const MOSSY: Tone = ['moss', 'rock', 'rock'];

// ── the trees ────────────────────────────────────────────────────────────

/** A broadleaf: a trunk with a kink, a few limbs, and a crown of lumps —
 *  one in the middle, a ring round it, small bright ones on top. */
function broadleaf(seed: number, o: { trunkH: number; trunkW: number; crownR: number; crownH: number; tone?: Tone; tone2?: Tone }): Model {
  const boxes: Box[] = [];
  const tw = o.trunkW, half = Math.floor(tw / 2);
  // a root flare, then the trunk in two lengths with a one-block kink
  boxes.push([-half - 1, 0, -half - 1, tw - half, Math.max(1, Math.round(tw * 0.8)), tw - half, 'trunk']);
  const kink = ji(seed, 1, -1, 1), kinkZ = ji(seed, 2, -1, 1), at = Math.round(o.trunkH * 0.45);
  boxes.push([-half, 0, -half, tw - 1 - half, at, tw - 1 - half, 'trunk']);
  boxes.push([-half + kink, at, -half + kinkZ, tw - 1 - half + kink, o.trunkH + Math.round(o.crownH * 0.3), tw - 1 - half + kinkZ, 'trunk']);
  // limbs: reaching out and up into the crown
  const nb = 3 + (hash(seed, 3, 77) < 0.5 ? 1 : 0);
  const lw = Math.max(1, Math.round(tw * 0.45));
  for (let b = 0; b < nb; b++) {
    const a = (b / nb) * Math.PI * 2 + j(seed, 10 + b, 0, 1);
    const len = Math.round(o.crownR * j(seed, 20 + b, 0.5, 0.75));
    const by = o.trunkH - ji(seed, 30 + b, 1, Math.max(2, o.trunkH * 0.2));
    const steps = Math.max(2, Math.round(len / lw / 1.5));
    for (let st = 0; st <= steps; st++) {
      const u = st / steps;
      const px = Math.round(Math.cos(a) * len * u), pz = Math.round(Math.sin(a) * len * u), py = by + Math.round(u * u * len * 0.5);
      boxes.push([px - lw + 1, py, pz - lw + 1, px + lw - 1, py + lw, pz + lw - 1, 'trunk']);
    }
  }
  // the crown
  const cy = o.trunkH + Math.round(o.crownH * 0.45);
  const lumps: Lump[] = [{ cx: 0, cy, cz: 0, rx: o.crownR * 0.8, ry: o.crownH * 0.5, rz: o.crownR * 0.8, m: 0 }];
  const ring = 5 + ji(seed, 4, 0, 2);
  for (let k = 0; k < ring; k++) {
    const a = (k / ring) * Math.PI * 2 + j(seed, 40 + k, -0.3, 0.3);
    const r = o.crownR * j(seed, 50 + k, 0.45, 0.65);
    const sz = o.crownR * j(seed, 70 + k, 0.4, 0.6);
    lumps.push({
      cx: Math.cos(a) * r, cy: cy + j(seed, 60 + k, -o.crownH * 0.3, o.crownH * 0.25), cz: Math.sin(a) * r,
      rx: sz, ry: sz * j(seed, 90 + k, 0.65, 0.9), rz: sz, m: o.tone2 && hash(seed, 100 + k, 77) < 0.35 ? 1 : 0,
    });
  }
  for (let k = 0; k < 3; k++) {
    const sz = o.crownR * j(seed, 110 + k, 0.28, 0.4);
    lumps.push({
      cx: j(seed, 80 + k, -o.crownR * 0.45, o.crownR * 0.45), cy: cy + o.crownH * j(seed, 120 + k, 0.4, 0.55), cz: j(seed, 91 + k, -o.crownR * 0.45, o.crownR * 0.45),
      rx: sz, ry: sz * 0.7, rz: sz, m: 0,
    });
  }
  const b = boundsOf(lumps);
  boxes.push(...shell(b, lumpField(lumps, seed, Math.max(2, Math.round(o.crownR / 5))), [o.tone ?? LEAF, o.tone2 ?? LEAF_PALE]));
  return { height: b.y1 + 1, boxes };
}

/** A conifer: bare trunk, then tiers that shrink to a spike. Each tier is
 *  a cone that hangs a little over the one below, roughened, so the
 *  silhouette is jagged the way a fir's is. */
function conifer(seed: number, o: { h: number; r: number; tiers: number; trunkW: number }): Model {
  const boxes: Box[] = [];
  const half = Math.floor(o.trunkW / 2);
  boxes.push([-half, 0, -half, o.trunkW - 1 - half, o.h - 4, o.trunkW - 1 - half, 'trunk']);
  boxes.push([-half - 1, 0, -half - 1, o.trunkW - half, 2, o.trunkW - half, 'trunk']);
  const bare = Math.round(o.h * 0.16);
  const span = o.h - bare;
  const tierH = span / o.tiers;
  const grain = Math.max(2, Math.round(o.r / 4));
  const field: Field = (x, y, z) => {
    if (y < bare || y > o.h) return -1;
    const t = (y - bare) / span;                           // 0 at the lowest tier, 1 at the tip
    const k = Math.min(o.tiers - 1, Math.floor((y - bare) / tierH));
    const u = ((y - bare) - k * tierH) / tierH;            // 0 at the bottom of this tier
    const rTier = o.r * Math.pow(1 - (k / o.tiers), 0.85) * j(seed, k, 0.9, 1.1);
    const r = rTier * (1 - 0.55 * u) * (1 - 0.15 * t);     // each tier is a cone; skirts widest at its foot
    const ox = j(seed, 10 + k, -1, 1), oz = j(seed, 20 + k, -1, 1);
    const ang = Math.atan2(z - oz, x - ox);
    const rough = 1 + (hash3(Math.floor(x / grain), Math.floor(y / grain), Math.floor(z / grain), seed) - 0.5) * 0.3
      + 0.08 * Math.sin(ang * 7 + k);                        // a few lobes per tier, turning tier to tier
    const d = Math.hypot(x - ox, z - oz);
    return d <= r * rough ? 0 : -1;
  };
  const b = { x0: -o.r - 2, y0: bare, z0: -o.r - 2, x1: o.r + 2, y1: o.h, z1: o.r + 2 };
  boxes.push(...shell(b, field, [PINE]));
  boxes.push([0, o.h - 1, 0, 0, o.h + 2, 0, 'pine']);
  return { height: o.h + 3, boxes };
}

/** An olive: short, thick, twisted, with a low, wide, silver-green crown. */
function olive(seed: number, s = 1): Model {
  const boxes: Box[] = [];
  const S = (v: number) => Math.round(v * s);
  boxes.push([S(-5), 0, S(-5), S(5), S(2), S(5), 'bark']);
  boxes.push([S(-4), 0, S(-4), S(2), S(12), S(2), 'bark']);
  boxes.push([S(-2), S(10), S(-4), S(4), S(20), S(1), 'bark']);
  boxes.push([S(-4), S(18), S(-2), S(1), S(28), S(3), 'bark']);
  // two limbs leaning out, in steps
  for (let st = 0; st < 5; st++) {
    boxes.push([S(2 + st * 2.4), S(16 + st * 1.6), S(-1), S(5 + st * 2.4), S(19 + st * 1.6), S(2), 'bark']);
    boxes.push([S(-6 - st * 2.2), S(20 + st * 1.8), S(-1), S(-3 - st * 2.2), S(23 + st * 1.8), S(2), 'bark']);
  }
  const lumps: Lump[] = [];
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + j(seed, k, -0.4, 0.4);
    const r = j(seed, 10 + k, 6, 16) * s;
    const sz = j(seed, 30 + k, 8, 12) * s;
    lumps.push({ cx: Math.cos(a) * r, cy: (30 + j(seed, 20 + k, -4, 6)) * s, cz: Math.sin(a) * r, rx: sz, ry: sz * 0.55, rz: sz, m: 0 });
  }
  lumps.push({ cx: 0, cy: 36 * s, cz: 0, rx: 9 * s, ry: 6 * s, rz: 9 * s, m: 0 });
  const b = boundsOf(lumps);
  boxes.push(...shell(b, lumpField(lumps, seed, 3, 0.45), [OLIVE]));
  return { height: b.y1 + 1, boxes };
}

/** A palm: a leaning trunk in short lengths and a fan of fronds that rise
 *  and then droop, with a cluster of fruit under them. */
function palm(seed: number, h: number): Model {
  const boxes: Box[] = [];
  const seg = 8, segs = Math.round(h / seg);
  let x = 0, z = 0;
  const lean = hash(seed, 1, 77) < 0.5 ? 1 : -1;
  for (let k = 0; k < segs; k++) {
    if (k >= 2 && k % 2 === 0) x += lean;
    boxes.push([x - 1, k * seg, z - 1, x + 1, k * seg + seg, z + 1, 'bark']);
    if (k % 2 === 1) boxes.push([x - 2, k * seg, z - 2, x + 2, k * seg + 1, z + 2, 'trunk']);   // a ring of old leaf scars
  }
  const cx = x, cz = z, cy = segs * seg;
  boxes.push([cx - 2, cy - 4, cz - 2, cx + 2, cy, cz + 2, 'trunk']);                          // the fruit cluster
  const fronds = 7 + ji(seed, 2, 0, 2);
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + j(seed, 10 + f, -0.2, 0.2);
    const len = ji(seed, 20 + f, 24, 32);
    const dx = Math.cos(a), dz = Math.sin(a);
    for (let st = 0; st <= len; st += 1) {
      const u = st / len;
      const dy = Math.round(7 * Math.sin(u * Math.PI) - 11 * u * u);     // up, over, and down
      const px = cx + Math.round(dx * st), pz = cz + Math.round(dz * st);
      const wide = st > 5 && st < len - 6 ? 2 : st > 2 ? 1 : 0;
      const block: Block = u > 0.85 ? 'leafLight' : st % 3 === 0 ? 'leaf' : 'palmLeaf';
      // the frond is a rib with leaflets either side of it
      boxes.push([px - wide, cy + dy, pz - wide, px + wide, cy + dy, pz + wide, block]);
    }
  }
  return { height: cy + 10, boxes };
}

/** A clump of reeds: a handful of stalks, some with a brown head. */
function reeds(seed: number): Model {
  const boxes: Box[] = [];
  const n = 5 + ji(seed, 1, 0, 3);
  for (let k = 0; k < n; k++) {
    const x = ji(seed, 10 + k, -2, 2), z = ji(seed, 20 + k, -2, 2), h = ji(seed, 30 + k, 7, 13);
    boxes.push([x, 0, z, x, h, z, hash(seed, 50 + k, 77) < 0.3 ? 'grassDry' : 'reed']);
    if (hash(seed, 40 + k, 77) < 0.5) boxes.push([x, h + 1, z, x, h + 2, z, 'reedHead']);
  }
  return { height: 16, boxes };
}

function bush(seed: number, o: { r: number; berries?: Block; tone?: Tone }): Model {
  const lumps: Lump[] = [];
  const n = 3 + ji(seed, 99, 0, 2);
  for (let k = 0; k < n; k++) {
    const sz = j(seed, 20 + k, o.r * 0.55, o.r);
    lumps.push({
      cx: j(seed, k, -o.r * 0.55, o.r * 0.55), cy: sz * 0.7, cz: j(seed, 10 + k, -o.r * 0.55, o.r * 0.55),
      rx: sz, ry: sz * 0.75, rz: sz, m: 0,
    });
  }
  const b = boundsOf(lumps);
  b.y0 = 0;
  const boxes = shell(b, lumpField(lumps, seed, 3, 0.4), [o.tone ?? LEAF]);
  if (o.berries) for (let k = 0; k < 10; k++) {
    const a = j(seed, 40 + k, 0, Math.PI * 2), r = o.r * j(seed, 60 + k, 0.7, 1.05);
    const bx = Math.round(Math.cos(a) * r), bz = Math.round(Math.sin(a) * r), by = ji(seed, 50 + k, o.r * 0.4, o.r * 1.3);
    boxes.push([bx, by, bz, bx, by, bz, o.berries]);
  }
  return { height: b.y1 + 1, boxes };
}

function boulder(seed: number, r: number): Model {
  const lumps: Lump[] = [
    { cx: 0, cy: r * 0.45, cz: 0, rx: r, ry: r * 0.75, rz: r * 0.85, m: 0 },
    { cx: j(seed, 1, -r * 0.5, r * 0.5), cy: r * 0.4, cz: j(seed, 2, -r * 0.4, r * 0.4), rx: r * 0.75, ry: r * 0.6, rz: r * 0.7, m: 1 },
  ];
  const b = boundsOf(lumps);
  b.y0 = 0;
  return { height: b.y1 + 1, boxes: shell(b, lumpField(lumps, seed, 3, 0.3), [MOSSY, ROCK]) };
}

/** A flower: a stem and a head of petals round a centre. Three sizes. */
function flower(petal: Block, size: 1 | 2 | 3, stemH: number): Model {
  const boxes: Box[] = [[0, 0, 0, 0, stemH - 1, 0, 'leaf']];
  if (size === 1) boxes.push([0, stemH, 0, 0, stemH, 0, petal]);
  else if (size === 2) boxes.push([-1, stemH, 0, 1, stemH, 0, petal], [0, stemH, -1, 0, stemH, 1, petal], [0, stemH + 1, 0, 0, stemH + 1, 0, 'petalYellow' === petal ? 'hay' : 'petalYellow']);
  else boxes.push([-1, stemH, -1, 1, stemH, 1, petal], [0, stemH + 1, 0, 0, stemH + 1, 0, 'petalYellow' === petal ? 'hay' : 'petalYellow'],
    [-2, stemH, 0, -2, stemH, 0, petal], [2, stemH, 0, 2, stemH, 0, petal], [0, stemH, -2, 0, stemH, -2, petal], [0, stemH, 2, 0, stemH, 2, petal]);
  if (stemH > 3) boxes.push([1, Math.round(stemH * 0.4), 0, 1, Math.round(stemH * 0.4), 0, 'leaf']);
  return { height: stemH + 2, boxes };
}

/** A tuft of grass: a low clump of blades of different heights. Kept
 *  SHORT — a single blade ten blocks high is half a metre of green stick,
 *  and a field of those read as cactus, not grass. */
function tuft(seed: number, tall: number, block: Block): Model {
  const boxes: Box[] = [];
  const n = 3 + ji(seed, 1, 0, 2);
  for (let k = 0; k < n; k++) {
    const x = ji(seed, 10 + k, 0, 1), z = ji(seed, 20 + k, 0, 1), h = ji(seed, 30 + k, Math.max(0, tall * 0.4 - 1), tall - 1);
    boxes.push([x, 0, z, x, h, z, block]);
  }
  return { height: tall, boxes };
}

/**
 * The plants, as FINE-grid models (eight blocks to the cubit), stamped with
 * `scale: 1`. Heights: the big broadleaf and the tall conifer are 100–110
 * blocks (5.5–6 m); the plain ones 75–90 (4–5 m); an olive is ~50 (2.8 m),
 * because olives are short; a man on this grid is 32.
 *
 * Every one is seeded, so the same name always draws the same tree — use
 * the numbered variants for a wood that is not one tree repeated. What each
 * costs is in its skin, not its volume: modelCost() counts it.
 */
export const TREES: Record<string, Model> = {
  broadleaf: broadleaf(1, { trunkH: 40, trunkW: 5, crownR: 20, crownH: 30 }),
  broadleaf2: broadleaf(2, { trunkH: 34, trunkW: 4, crownR: 17, crownH: 26 }),
  broadleaf3: broadleaf(3, { trunkH: 44, trunkW: 5, crownR: 18, crownH: 28, tone2: LEAF_PALE }),
  broadleafBig: broadleaf(4, { trunkH: 52, trunkW: 6, crownR: 26, crownH: 40 }),
  broadleafGold: broadleaf(5, { trunkH: 36, trunkW: 4, crownR: 17, crownH: 26, tone: LEAF_GOLD, tone2: LEAF_PALE }),
  conifer: conifer(1, { h: 88, r: 14, tiers: 8, trunkW: 4 }),
  conifer2: conifer(2, { h: 108, r: 16, tiers: 9, trunkW: 4 }),
  conifer3: conifer(3, { h: 68, r: 11, tiers: 7, trunkW: 3 }),
  olive: olive(1, 0.85),
  olive2: olive(2, 1),
  palm: palm(1, 72),
  palm2: palm(2, 88),
  sapling: broadleaf(6, { trunkH: 14, trunkW: 2, crownR: 7, crownH: 12 }),
  sapling2: broadleaf(7, { trunkH: 20, trunkW: 2, crownR: 9, crownH: 14 }),
  bush: bush(1, { r: 8 }),
  bush2: bush(2, { r: 10 }),
  bushBerry: bush(3, { r: 8, berries: 'petalRed' }),
  bushSmall: bush(4, { r: 5 }),
  bushPale: bush(5, { r: 7, tone: LEAF_PALE }),
  reeds: reeds(1),
  reeds2: reeds(2),
  reeds3: reeds(3),
  lilypad: { height: 1, boxes: [[-3, 0, -2, 3, 0, 2, 'lilypad'], [-2, 0, -3, 2, 0, 3, 'lilypad'], [2, 0, 2, 3, 0, 3, 'water']] },
  lilyFlower: { height: 3, boxes: [[-3, 0, -2, 3, 0, 2, 'lilypad'], [-2, 0, -3, 2, 0, 3, 'lilypad'], [-1, 1, -1, 1, 1, 1, 'petalPink'], [0, 2, 0, 0, 2, 0, 'petalYellow']] },
  lilySmall: { height: 1, boxes: [[-2, 0, -1, 2, 0, 1, 'lilypad'], [-1, 0, -2, 1, 0, 2, 'lilypad']] },
};

/** The small things scatterVegetation() sows. */
export const PLANTS: Record<string, Model> = {
  daisy: flower('wool', 2, 3),
  daisyTall: flower('wool', 3, 5),
  poppy: flower('petalRed', 2, 4),
  buttercup: flower('petalYellow', 1, 2),
  buttercup2: flower('petalYellow', 2, 3),
  bluebell: flower('petalBlue', 1, 3),
  lavender: flower('petalPurple', 2, 5),
  pink: flower('petalPink', 2, 3),
  pinkTall: flower('petalPink', 3, 5),
  tuft: tuft(1, 3, 'grassLight'),
  tuft2: tuft(2, 4, 'leafLight'),
  tuft3: tuft(3, 2, 'grassLight'),
  tuftDry: tuft(4, 3, 'grassDry'),
  tuftTall: tuft(5, 6, 'leaf'),
  pebble: { height: 1, boxes: [[0, 0, 0, 1, 0, 1, 'rock']] },
  pebble2: { height: 2, boxes: [[0, 0, 0, 2, 0, 1, 'rockLight'], [1, 1, 0, 1, 1, 1, 'rock']] },
  pebble3: { height: 1, boxes: [[0, 0, 0, 0, 0, 0, 'rockLight']] },
  mushroom: { height: 3, boxes: [[0, 0, 0, 0, 1, 0, 'wool'], [-1, 2, -1, 1, 2, 1, 'petalRed'], [0, 3, 0, 0, 3, 0, 'wool']] },
};

/** Stones big enough to sit on: fine grid. */
export const ROCKS: Record<string, Model> = {
  boulder: boulder(1, 9),
  boulder2: boulder(2, 12),
  boulder3: boulder(3, 7),
  boulderSmall: boulder(4, 5),
};

/** Blocks a model writes to the map, before Grid.build()'s cull. */
export function modelCost(m: Model): number {
  let n = 0;
  for (const [x0, y0, z0, x1, y1, z1] of m.boxes)
    n += (Math.abs(x1 - x0) + 1) * (Math.abs(y1 - y0) + 1) * (Math.abs(z1 - z0) + 1);
  return n;   // an upper bound: where boxes overlap, blocks are counted twice
}

// ── scattering, on the fine grid ─────────────────────────────────────────

export interface TreeOptions {
  ground: Ground;
  /** Where to plant, in CUBITS; default the whole field. */
  rect?: Rect;
  seed?: number;
  finePerCubit?: number;
  /** One candidate per cell this many cubits across; default 16 (7 m).
   *  On 120 × 80 cubits that plants about a dozen trees for ~40k blocks;
   *  14 plants twenty for ~65k. */
  spacing?: number;
  /** Chance a candidate becomes a tree; default 0.5. */
  chance?: number;
  /** Which models, by weight. Default: a mixed wood. */
  kinds?: Record<string, number>;
  /** Cubit columns a tree must not stand on, beyond water, paths and sand. */
  avoid?: (xCubit: number, zCubit: number) => boolean;
  /** Radius of clear ground a full tree needs, in cubits; default 2.5. */
  footprint?: number;
}

export interface Placement { kind: string; x: number; y: number; z: number; turn: number }

// Weighted toward the middle sizes: the big broadleaf and the tall conifer
// are 8–13k blocks each and a wood of them would eat the budget alone.
const WOOD: Record<string, number> = {
  broadleaf: 2, broadleaf2: 3, broadleaf3: 2, broadleafBig: 0.3, broadleafGold: 0.5,
  conifer: 2, conifer2: 0.7, conifer3: 3, olive: 1.5, olive2: 0.8, palm: 0.5, palm2: 0.3,
  sapling: 1.5, sapling2: 1.2, bush: 2, bush2: 1.5, bushBerry: 1, bushSmall: 1.5, bushPale: 1,
};

/**
 * Trees and bushes over the field, on the FINE grid: one candidate per cell
 * of `spacing` cubits, jittered by hash so the wood has no rows, kept off
 * water, paths and sand, and off whatever `avoid` says. Returns where
 * everything went, in fine blocks.
 * Cost: a mature tree is 3–9k blocks (its skin), a bush 300–900.
 */
export function scatterTrees(fine: Grid, opts: TreeOptions): { blocks: number; placed: Placement[] } {
  const { ground } = opts;
  const fpc = opts.finePerCubit ?? FINE_PER_CUBIT;
  const stand = ground.stand(fpc);
  const rect = opts.rect ?? { x0: ground.rect.x0 / ground.bpc, z0: ground.rect.z0 / ground.bpc, x1: ground.rect.x1 / ground.bpc, z1: ground.rect.z1 / ground.bpc };
  const seed = opts.seed ?? 4;
  const spacing = opts.spacing ?? 16;
  const chance = opts.chance ?? 0.5;
  const kinds = opts.kinds ?? WOOD;
  const footprint = opts.footprint ?? 2.5;
  const names = Object.keys(kinds);
  const total = names.reduce((a, k) => a + kinds[k]!, 0);
  const before = fine.size;
  const placed: Placement[] = [];
  for (let cz = rect.z0; cz <= rect.z1; cz += spacing)
    for (let cx = rect.x0; cx <= rect.x1; cx += spacing) {
      const gx = Math.floor(cx / spacing), gz = Math.floor(cz / spacing);
      if (hash(gx, gz, seed) > chance) continue;
      const xc = cx + hash(gx, gz, seed + 1) * spacing, zc = cz + hash(gx, gz, seed + 2) * spacing;
      if (xc > rect.x1 || zc > rect.z1) continue;
      let pick = hash(gx, gz, seed + 3) * total, kind = names[0]!;
      for (const k of names) { pick -= kinds[k]!; if (pick <= 0) { kind = k; break; } }
      const model = TREES[kind]!;
      const x = Math.floor(xc * fpc), z = Math.floor(zc * fpc);
      const fp = model.height < 4 * fpc ? footprint * 0.5 : footprint;
      if (!stand.clear(x, z, fp)) continue;
      if (opts.avoid && opts.avoid(xc, zc)) continue;
      const turn = Math.floor(hash(gx, gz, seed + 4) * 4);
      const y = stand.y(x, z);
      stamp(fine, model, [x, y, z], turn, 1);
      placed.push({ kind, x, y, z, turn });
    }
  return { blocks: fine.size - before, placed };
}

export interface VegetationOptions {
  ground: Ground;
  /** Where to sow, in CUBITS; default the whole field. */
  rect?: Rect;
  seed?: number;
  finePerCubit?: number;
  /** Flowers per square cubit at the heart of a meadow patch (default
   *  0.25); tufts of grass per square cubit (default 0.25), thicker in the
   *  patches; pebbles per square cubit (default 0.05), everywhere. */
  flowers?: number;
  tufts?: number;
  pebbles?: number;
  /** Wavelength of the meadow patches, in cubits. Default 12. */
  patchScale?: number;
  /** Loose stones, per square cubit (default 0.001): the ROCKS models,
   *  at 200–1200 blocks each. */
  boulders?: number;
}

/**
 * Flowers, grass tufts and pebbles over the field, on the FINE grid, on
 * grass columns only. Flowers come in patches of one kind — a low noise
 * gates them and a coarser hash picks the species per patch — because a
 * meadow is drifts of colour, not confetti.
 * Cost: about 4 blocks per flower, 8 per tuft, 3 per pebble; the defaults
 * on 120 × 80 cubits are ~30k.
 */
export function scatterVegetation(fine: Grid, opts: VegetationOptions): { blocks: number; placed: number } {
  const { ground } = opts;
  const fpc = opts.finePerCubit ?? FINE_PER_CUBIT;
  const stand = ground.stand(fpc);
  const bpc = ground.bpc;
  const rect = opts.rect ?? { x0: ground.rect.x0 / bpc, z0: ground.rect.z0 / bpc, x1: ground.rect.x1 / bpc, z1: ground.rect.z1 / bpc };
  const seed = opts.seed ?? 3;
  const flowers = opts.flowers ?? 0.25, tufts = opts.tufts ?? 0.25, pebbles = opts.pebbles ?? 0.05, boulders = opts.boulders ?? 0.001;
  const patchScale = opts.patchScale ?? 12;
  const flowerKinds = ['daisy', 'daisyTall', 'poppy', 'buttercup', 'buttercup2', 'bluebell', 'lavender', 'pink', 'pinkTall'];
  const tuftKinds = ['tuft', 'tuft2', 'tuft3', 'tuftDry', 'tuftTall'];
  const pebbleKinds = ['pebble', 'pebble2', 'pebble3', 'pebble', 'mushroom'];
  const rockKinds = Object.keys(ROCKS);
  const before = fine.size;
  let placed = 0;
  // walk the field a square cubit at a time; each square sows a hashed
  // handful of things at hashed spots inside it
  for (let zc = Math.floor(rect.z0); zc < rect.z1; zc++)
    for (let xc = Math.floor(rect.x0); xc < rect.x1; xc++) {
      const cx = Math.floor(xc * bpc), cz = Math.floor(zc * bpc);
      if (ground.kind(cx, cz) !== 'grass') continue;
      const meadow = clamp01((noise(xc, zc, patchScale, seed + 1) - 0.42) / 0.3);
      // the species of this patch: one hash per patch cell, so a drift of
      // poppies is poppies and not a fruit salad
      const species = flowerKinds[Math.floor(hash(Math.floor(xc / (patchScale * 0.6)), Math.floor(zc / (patchScale * 0.6)), seed + 2) * flowerKinds.length)]!;
      const sow = (expected: number, k: number, pick: (r: number) => Model) => {
        // a Bernoulli trial per expected item, so a square can hold several
        const whole = Math.floor(expected), frac = expected - whole;
        const n = whole + (hash(xc, zc, seed + 20 + k) < frac ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const r1 = hash(xc, zc, seed + 100 + k * 10 + i), r2 = hash(xc, zc, seed + 200 + k * 10 + i);
          const x = Math.floor((xc + r1) * fpc), z = Math.floor((zc + r2) * fpc);
          if (stand.kind(x, z) !== 'grass') continue;
          const y = stand.y(x, z);
          if (fine.has(x, y, z) || fine.has(x, y + 1, z)) continue;         // something stands here already
          stamp(fine, pick(hash(xc, zc, seed + 300 + k * 10 + i)), [x, y, z], Math.floor(r1 * 4), 1);
          placed++;
        }
      };
      sow(flowers * meadow, 0, (r) => PLANTS[r < 0.8 ? species : flowerKinds[Math.floor(r * 40) % flowerKinds.length]!]!);
      sow(tufts * (0.35 + 0.65 * meadow), 1, (r) => PLANTS[r < 0.08 ? 'tuftTall' : tuftKinds[Math.floor(r * 12) % (tuftKinds.length - 1)]!]!);
      sow(pebbles, 2, (r) => PLANTS[pebbleKinds[Math.floor(r * pebbleKinds.length)]!]!);
      if (hash(xc, zc, seed + 9) < boulders && stand.clear(cx * fpc / bpc, cz * fpc / bpc, 1.5))
        sow(1, 3, (r) => ROCKS[rockKinds[Math.floor(r * rockKinds.length)]!]!);
    }
  return { blocks: fine.size - before, placed };
}

export interface DressRiverOptions {
  river: River;
  ground: Ground;
  seed?: number;
  finePerCubit?: number;
  /** Lily pads per square cubit of still water (default 0.12) and clumps
   *  of reeds per square cubit of bank (default 0.1). */
  lilies?: number;
  reeds?: number;
}

/**
 * Reeds along the banks and lily pads on the still water, on the FINE grid.
 * The river itself is coarse; this is the detail that says it is water and
 * not a blue path. Cost: ~150 blocks a clump of reeds, ~40 a lily pad.
 */
export function dressRiver(fine: Grid, opts: DressRiverOptions): { blocks: number; placed: number } {
  const { river, ground } = opts;
  const fpc = opts.finePerCubit ?? FINE_PER_CUBIT;
  const f = fpc / ground.bpc;                            // fine blocks per coarse block
  const seed = opts.seed ?? 5;
  const lilies = (opts.lilies ?? 0.12) / (ground.bpc * ground.bpc);
  const reeds = (opts.reeds ?? 0.1) / (ground.bpc * ground.bpc);
  const before = fine.size;
  let placed = 0;
  for (const [x, z, level, still] of river.water) {
    if (!still || hash(x, z, seed) >= lilies) continue;
    const fx = Math.floor((x + hash(x, z, seed + 1)) * f), fz = Math.floor((z + hash(x, z, seed + 2)) * f);
    const r = hash(x, z, seed + 3);
    const model = r < 0.25 ? TREES.lilyFlower! : r < 0.6 ? TREES.lilypad! : TREES.lilySmall!;
    // the pad sits IN the top of the water block, flush with its surface
    stamp(fine, model, [fx, (level + 1) * f - 1, fz], Math.floor(r * 4), 1);
    placed++;
  }
  for (const [x, z, top] of river.banks) {
    if (hash(x, z, seed + 4) >= reeds) continue;
    const fx = Math.floor((x + hash(x, z, seed + 5)) * f), fz = Math.floor((z + hash(x, z, seed + 6)) * f);
    const r = hash(x, z, seed + 7);
    const model = r < 0.4 ? TREES.reeds! : r < 0.7 ? TREES.reeds2! : TREES.reeds3!;
    stamp(fine, model, [fx, (top + 1) * f, fz], Math.floor(r * 4), 1);
    placed++;
  }
  return { blocks: fine.size - before, placed };
}
