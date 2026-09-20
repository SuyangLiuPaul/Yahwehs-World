import { type Block, type Grid } from './grid.ts';
import { type Box, type Model, stamp } from './creatures.ts';

// THE SMALL THINGS OF A BUILDING SITE, AS BLOCKS.
//
// A hull and a field are a diagram. What makes the reference picture a PLACE
// is the clutter round the ark: crates, barrels, a ladder left against the
// staging, a fire with a pot over it. None of it is stated by Genesis and all
// of it says that people have been working here for a long time.
//
// SCALE. Everything in this file is authored in EIGHTH CUBITS — one block ≈
// 0.056 m — and stamped with `scale: 1`. (The creatures are authored at half
// a cubit and multiplied up; a barrel needs its hoops one block thin and its
// staves one block wide, so the props are drawn at final size.) A man is
// thirty-two blocks; a barrel a cubit high is eight; a crate a cubit across is
// eight by eight. The comment on each prop gives the size it stands for.
//
// THE CAMERA. The scene is seen three-quarters from above, from the -x / +z
// corner, at about 25–40°, so the TOP, the +z face and the -x face are what
// gets looked at, and detail is spent there. Later boxes overwrite earlier
// ones, which is how a hoop or a lid is drawn onto a solid body.

const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Block): Box => [x0, y0, z0, x1, y1, z1, c];

// ── shape helpers ────────────────────────────────────────────────────────

/** A 32-bit mixing hash of two integers, in (0, 1). Used for flecks of straw
 *  and for scatter(). NOT `(i * k) % n`: a constant stride lays things in
 *  diagonal rows, and a yard is not tidy. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return ((h >>> 0) + 0.5) / 4294967296;
}

/** Which cells of a w×w square are inside a round footprint of width w.
 *  The threshold is a little generous of a true circle, because a block
 *  circle that is exact goes pointed at the four poles, and a barrel with
 *  four points is a nut. */
function discCells(w: number): boolean[][] {
  const c = (w - 1) / 2, r2 = c * c + 0.7 * c;
  const cells: boolean[][] = [];
  for (let i = 0; i < w; i++) {
    cells.push([]);
    for (let j = 0; j < w; j++) cells[i]!.push((i - c) ** 2 + (j - c) ** 2 <= r2);
  }
  return cells;
}
/** The same footprint as one [from, to] run per row. */
function disc(w: number): [number, number][] {
  return discCells(w).map((row) => [row.indexOf(true), row.lastIndexOf(true)]);
}

/** An upright drum: rounded footprint w×w with its corner at (x, z), from y0 to y1. */
function drum(x: number, y0: number, z: number, w: number, y1: number, c: Block): Box[] {
  return disc(w).map(([a, b], i) => B(x + a, y0, z + i, x + b, y1, z + i, c));
}
/**
 * A drum with STAVES: the rim cells are coloured by the angle they sit at,
 * alternating between two woods every sector, so a barrel shows its planks
 * from every side. `weave` shifts the pattern one sector per row, which turns
 * staves into basketwork.
 */
function stavedDrum(x: number, y0: number, z: number, w: number, y1: number, cA: Block, cB: Block, sectors = 12, weave = false): Box[] {
  const cells = discCells(w), c = (w - 1) / 2;
  const out: Box[] = drum(x, y0, z, w, y1, cA);
  for (let i = 0; i < w; i++)
    for (let j = 0; j < w; j++) {
      if (!cells[i]![j]) continue;
      const rim = !(cells[i - 1]?.[j] && cells[i + 1]?.[j] && cells[i]![j - 1] && cells[i]![j + 1]);
      if (!rim) continue;
      const sector = Math.floor(((Math.atan2(i - c, j - c) + Math.PI) / (2 * Math.PI)) * sectors);
      if (!weave) { if (sector % 2) out.push(B(x + j, y0, z + i, x + j, y1, z + i, cB)); continue; }
      for (let y = y0; y <= y1; y++) if ((sector + y) % 2) out.push(B(x + j, y, z + i, x + j, y, z + i, cB));
    }
  return out;
}
/** A drum lying along x: rounded section in y–z, from x for `len` blocks. */
function roll(x: number, y: number, z: number, w: number, len: number, c: Block): Box[] {
  return disc(w).map(([a, b], i) => B(x, y + i, z + a, x + len - 1, y + i, z + b, c));
}
/** A lying drum with staves, as stavedDrum. */
function stavedRoll(x: number, y: number, z: number, w: number, len: number, cA: Block, cB: Block, sectors = 12): Box[] {
  const cells = discCells(w), c = (w - 1) / 2;
  const out: Box[] = roll(x, y, z, w, len, cA);
  for (let i = 0; i < w; i++)
    for (let j = 0; j < w; j++) {
      if (!cells[i]![j]) continue;
      const rim = !(cells[i - 1]?.[j] && cells[i + 1]?.[j] && cells[i]![j - 1] && cells[i]![j + 1]);
      if (!rim) continue;
      const sector = Math.floor(((Math.atan2(i - c, j - c) + Math.PI) / (2 * Math.PI)) * sectors);
      if (sector % 2) out.push(B(x, y + i, z + j, x + len - 1, y + i, z + j, cB));
    }
  return out;
}
/** A flat ring of width w and the given thickness at y: a hearth, a coil of rope, a cart wheel's rim. */
function ring(x: number, y: number, z: number, w: number, c: Block, thick = 1): Box[] {
  const outer = discCells(w), hole = w - 2 * thick > 0 ? discCells(w - 2 * thick) : null;
  const out: Box[] = [];
  for (let i = 0; i < w; i++) {
    let run: number | null = null;
    for (let j = 0; j <= w; j++) {
      const on = j < w && outer[i]![j] && !(hole && hole[i - thick]?.[j - thick]);
      if (on && run === null) run = j;
      if (!on && run !== null) { out.push(B(x + run, y, z + i, x + j - 1, y, z + i, c)); run = null; }
    }
  }
  return out;
}
/** A spoked wheel standing in the y–z plane at x, its lower-back corner at
 *  (y, z): an iron rim, two crossed spokes and a hub. */
function wheel(x: number, y: number, z: number, w: number, rim: Block, spoke: Block): Box[] {
  const c0 = Math.floor((w - 1) / 2), c1 = Math.ceil((w - 1) / 2);
  return [
    ...ring(0, 0, 0, w, rim).map(([x0, , z0, x1, , z1, c]) => B(x, y + x0, z + z0, x, y + x1, z + z1, c)),
    B(x, y + c0, z, x, y + c1, z + w - 1, spoke), B(x, y, z + c0, x, y + w - 1, z + c1, spoke),
    B(x, y + c0, z + c0, x, y + c1, z + c1, rim),
  ];
}
/** The twelve edges of a box — the battens that make a plain block a crate. */
function frame(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Block): Box[] {
  return [
    B(x0, y0, z0, x0, y1, z0, c), B(x1, y0, z0, x1, y1, z0, c), B(x0, y0, z1, x0, y1, z1, c), B(x1, y0, z1, x1, y1, z1, c),
    B(x0, y0, z0, x1, y0, z0, c), B(x0, y1, z0, x1, y1, z0, c), B(x0, y0, z1, x1, y0, z1, c), B(x0, y1, z1, x1, y1, z1, c),
    B(x0, y0, z0, x0, y0, z1, c), B(x0, y1, z0, x0, y1, z1, c), B(x1, y0, z0, x1, y0, z1, c), B(x1, y1, z0, x1, y1, z1, c),
  ];
}
/** A straight run of single blocks from one point to another, stepped — a
 *  tripod leg, a diagonal brace, a leaning rail. `thick` widens it in x and z. */
function strut(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Block, thick = 1): Box[] {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  const out: Box[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), z = Math.round(z0 + (z1 - z0) * t);
    out.push(B(x, y, z, x + thick - 1, y, z + thick - 1, c));
  }
  return out;
}
/** Single blocks of a second colour sprinkled through a box: stalks in hay,
 *  lichen on stone. Deterministic, from the cell's own position. */
function fleck(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Block, share = 0.2, seed = 1): Box[] {
  const out: Box[] = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        if (hash(seed * 1000003 + x * 7919 + y * 131, z) < share) out.push(B(x, y, z, x, y, z, c));
  return out;
}
const moved = (boxes: Box[], dx: number, dy: number, dz: number): Box[] =>
  boxes.map(([x0, y0, z0, x1, y1, z1, c]) => B(x0 + dx, y0 + dy, z0 + dz, x1 + dx, y1 + dy, z1 + dz, c));
// A Box is itself an array, so `.flat()` would shred it into numbers: a part
// whose first element is a number is one box, otherwise it is a list of them.
const model = (height: number, ...parts: (Box | Box[])[]): Model =>
  ({ height, boxes: parts.flatMap((p) => (typeof p[0] === 'number' ? [p as Box] : (p as Box[]))) });

// ── the props ────────────────────────────────────────────────────────────

// a wooden crate: three planks a side, battens on every edge; 8 blocks = 1 cubit ≈ 0.45 m a side
const crate = model(8,
  B(0, 0, 0, 7, 7, 7, 'gopher'),
  B(0, 2, 0, 7, 2, 7, 'gopherDark'), B(0, 5, 0, 7, 5, 7, 'gopherDark'),          // plank seams round the sides
  B(0, 7, 2, 7, 7, 2, 'gopherDark'), B(0, 7, 5, 7, 7, 5, 'gopherDark'),          // and across the lid
  frame(0, 0, 0, 7, 7, 7, 'beam'),
);
// a long crate with a middle batten each side; 12 × 10 × 12 ≈ 0.67 × 0.55 × 0.67 m
const crateLarge = model(10,
  B(0, 0, 0, 11, 9, 11, 'gopher'),
  ...[2, 5, 8].map((y) => B(0, y, 0, 11, y, 11, 'gopherDark')),
  ...[3, 6, 9].map((z) => B(0, 9, z, 11, 9, z, 'gopherDark')),
  frame(0, 0, 0, 11, 9, 11, 'beam'),
  B(6, 0, 0, 6, 9, 0, 'beam'), B(6, 0, 11, 6, 9, 11, 'beam'), B(0, 0, 6, 0, 9, 6, 'beam'), B(11, 0, 6, 11, 9, 6, 'beam'),
  B(0, 9, 6, 11, 9, 6, 'beam'),
);
// a barrel: staves, a belly a block proud of the heads, three iron hoops, a dark lid with a bung; 10 wide, 12 tall ≈ 0.55 × 0.67 m
const barrel = model(12,
  stavedDrum(1, 0, 1, 8, 11, 'gopher', 'gopherDark', 10),
  stavedDrum(0, 2, 0, 10, 9, 'gopher', 'gopherDark', 12),
  drum(1, 1, 1, 8, 1, 'iron'), drum(0, 5, 0, 10, 5, 'iron'), drum(1, 10, 1, 8, 10, 'iron'),
  drum(1, 11, 1, 8, 11, 'gopherDark'), B(4, 11, 4, 5, 11, 5, 'pitch'),
);
// a lantern: an iron cage round a flame, a pyramid cap and a loop to hang it by; 6 × 6, 10 tall ≈ 0.33 × 0.55 m
const lantern = model(10,
  B(0, 0, 0, 5, 0, 5, 'iron'), B(0, 1, 0, 5, 2, 5, 'fire'), B(0, 3, 0, 5, 6, 5, 'flame'),
  frame(0, 0, 0, 5, 7, 5, 'iron'), B(0, 7, 0, 5, 7, 5, 'iron'), B(1, 8, 1, 4, 8, 4, 'iron'), B(2, 9, 2, 3, 9, 3, 'rope'),
);
// a clay cooking pot, a belly on a narrow foot, a neck and a flared rim; 6 wide, 9 tall ≈ 0.33 × 0.5 m
const clayPot = model(9,
  drum(1, 0, 1, 4, 0, 'clayDark'), drum(0, 1, 0, 6, 5, 'clay'), drum(0, 3, 0, 6, 3, 'clayDark'),
  drum(1, 6, 1, 4, 7, 'clayDark'), drum(0, 8, 0, 6, 8, 'clay'), drum(1, 8, 1, 4, 8, 'charcoal'),
);

export const PROPS: Record<string, Model> = {
  crate,
  crateLarge,
  // two crates and a third on top, set back — the stack every yard has; 18 wide, 16 tall
  crateStack: model(16, crate.boxes, moved(crate.boxes, 10, 0, 2), moved(crate.boxes, 4, 8, 2)),
  barrel,
  // the same barrel on its side on two chocks, hoops ringing it; 12 long, 10 across
  barrelSide: model(10,
    B(2, 0, 2, 9, 0, 2, 'beam'), B(2, 0, 7, 9, 0, 7, 'beam'),
    stavedRoll(0, 0, 0, 10, 12, 'gopher', 'gopherDark', 12),
    ...[1, 5, 10].map((x) => roll(x, 0, 0, 10, 1, 'iron')),
    roll(0, 0, 0, 10, 1, 'gopherDark'), roll(11, 0, 0, 10, 1, 'gopherDark'),      // the two heads
    B(0, 4, 2, 0, 5, 7, 'beam'), B(11, 4, 2, 11, 5, 7, 'beam'),                    // a batten across each head
  ),
  clayPot,
  // an amphora on its narrow foot, a painted band, two handles at the shoulder; 8 wide with handles, 12 tall ≈ 0.67 m
  amphora: model(12,
    drum(2, 0, 2, 2, 1, 'clayDark'), drum(1, 2, 1, 4, 2, 'clay'), drum(0, 3, 0, 6, 7, 'clay'), drum(0, 5, 0, 6, 5, 'clayDark'),
    drum(1, 8, 1, 4, 8, 'clay'), drum(2, 9, 2, 2, 10, 'clayDark'), drum(1, 11, 1, 4, 11, 'clay'), drum(2, 11, 2, 2, 11, 'charcoal'),
    B(-1, 6, 2, -1, 9, 3, 'clayDark'), B(6, 6, 2, 6, 9, 3, 'clayDark'),           // handles
  ),
  // a big-bellied water jar, a dark band, water showing in the mouth; 10 wide, 11 tall ≈ 0.55 × 0.61 m
  waterJar: model(11,
    drum(2, 0, 2, 6, 1, 'clayDark'), drum(0, 2, 0, 10, 7, 'clay'), drum(0, 5, 0, 10, 5, 'clayDark'),
    drum(1, 8, 1, 8, 8, 'clay'), drum(2, 9, 2, 6, 9, 'clayDark'), drum(2, 10, 2, 6, 10, 'clay'), drum(3, 10, 3, 4, 10, 'water'),
  ),
  // a tall oil jar with a red band and a wooden stopper; 6 wide, 14 tall ≈ 0.78 m
  oilJar: model(14,
    drum(1, 0, 1, 4, 0, 'clayDark'), drum(0, 1, 0, 6, 9, 'clay'), drum(0, 4, 0, 6, 5, 'robeRed'), drum(0, 8, 0, 6, 8, 'clayDark'),
    drum(1, 10, 1, 4, 10, 'clayDark'), drum(2, 11, 2, 2, 12, 'clayDark'), drum(1, 13, 1, 4, 13, 'beam'),
  ),
  // a tied sack standing up, a seam down the side, gathered above the cord; 8 × 6, 12 tall ≈ 0.67 m
  sack: model(12,
    B(0, 0, 0, 7, 5, 5, 'sackcloth'), B(1, 6, 1, 6, 7, 4, 'sackcloth'), B(2, 8, 1, 5, 8, 4, 'sackcloth'),
    B(3, 0, 5, 3, 5, 5, 'sackDark'), B(0, 0, 2, 0, 5, 2, 'sackDark'),
    B(2, 9, 2, 5, 9, 3, 'rope'), B(2, 10, 1, 5, 11, 4, 'sackcloth'), B(2, 11, 1, 2, 11, 1, 'sackDark'), B(5, 11, 4, 5, 11, 4, 'sackDark'),
  ),
  // an open sack of grain, round-bellied, the rim rolled down, grain heaped above it; 8 × 8, 10 tall ≈ 0.55 m
  grainSack: model(10,
    drum(0, 0, 0, 8, 6, 'sackcloth'), B(0, 3, 0, 7, 3, 7, 'sackDark'),
    ring(0, 7, 0, 8, 'sackDark', 2), ring(0, 8, 0, 8, 'sackDark', 1),
    drum(1, 7, 1, 6, 8, 'straw'), drum(2, 9, 2, 4, 9, 'straw'), fleck(1, 7, 1, 6, 9, 6, 'hay', 0.3, 3),
  ),
  // three sacks, two below and one slumped across them; 16 wide, 11 tall
  sackPile: model(11,
    B(0, 0, 0, 7, 5, 5, 'sackcloth'), B(8, 0, 0, 15, 5, 5, 'sackDark'), B(3, 0, 5, 3, 5, 5, 'sackDark'), B(12, 0, 5, 12, 5, 5, 'sackcloth'),
    B(2, 6, 0, 13, 9, 5, 'sackcloth'), B(3, 10, 1, 12, 10, 4, 'sackcloth'),
    B(3, 6, 0, 3, 10, 5, 'rope'), B(12, 6, 0, 12, 10, 5, 'rope'), B(2, 6, 0, 2, 9, 5, 'sackDark'), B(13, 6, 0, 13, 9, 5, 'sackDark'),
  ),
  // a round hay bale on its side, two cords round it, the spiral on the ends; 14 long, 12 across ≈ 0.78 × 0.67 m
  hayBaleRound: model(12,
    roll(0, 0, 0, 12, 14, 'hay'), fleck(0, 0, 0, 13, 11, 11, 'straw', 0.18, 5),
    roll(3, 0, 0, 12, 1, 'rope'), roll(10, 0, 0, 12, 1, 'rope'),
    ...[0, 13].flatMap((x) => [roll(x, 2, 2, 8, 1, 'straw'), roll(x, 4, 4, 4, 1, 'hay'), roll(x, 5, 5, 2, 1, 'straw')]),
  ),
  // a square bale with two cords, stalks showing; 12 × 8 × 8 ≈ 0.67 × 0.45 × 0.45 m
  hayBaleSquare: model(8,
    B(0, 0, 0, 11, 7, 7, 'hay'), fleck(0, 0, 0, 11, 7, 7, 'straw', 0.2, 2), B(2, 0, 0, 2, 7, 7, 'rope'), B(9, 0, 0, 9, 7, 7, 'rope'),
  ),
  // a loose heap of forked hay, a dome; 12 across, 8 tall ≈ 0.67 × 0.45 m
  hayHeap: model(8,
    ...[12, 12, 11, 10, 9, 7, 5, 3].map((w, y) => drum(Math.floor((12 - w) / 2), y, Math.floor((12 - w) / 2), w, y, 'hay')),
    fleck(0, 0, 0, 11, 7, 11, 'straw', 0.3, 8),
  ),
  // a wooden bucket, staved and hooped, water in it, an iron bail; 6 wide, 9 tall with the bail ≈ 0.33 m
  bucket: model(9,
    stavedDrum(0, 0, 0, 6, 5, 'gopherDark', 'gopher', 8), drum(0, 1, 0, 6, 1, 'iron'), drum(0, 5, 0, 6, 5, 'iron'), drum(1, 5, 1, 4, 5, 'water'),
    B(0, 6, 2, 0, 7, 2, 'iron'), B(5, 6, 2, 5, 7, 2, 'iron'), B(0, 8, 2, 5, 8, 2, 'iron'),
  ),
  // a copper pail with an iron rim and a rope handle; 6 wide, 8 tall
  pail: model(8,
    drum(0, 0, 0, 6, 5, 'copper'), drum(0, 5, 0, 6, 5, 'iron'), drum(1, 5, 1, 4, 5, 'water'),
    B(3, 6, 0, 3, 6, 0, 'rope'), B(3, 6, 5, 3, 6, 5, 'rope'), B(3, 7, 0, 3, 7, 5, 'rope'),
  ),
  // a basket of woven wicker, fruit in it, a hoop handle; 8 wide, 10 tall ≈ 0.45 × 0.55 m
  basket: model(10,
    stavedDrum(0, 0, 0, 8, 4, 'wicker', 'gopherDark', 12, true), drum(0, 5, 0, 8, 5, 'gopherDark'),
    drum(1, 5, 1, 6, 5, 'robeRed'), fleck(1, 5, 1, 6, 5, 6, 'ember', 0.35, 4), B(3, 6, 3, 4, 6, 4, 'robeRed'),
    B(0, 6, 3, 0, 8, 3, 'wicker'), B(7, 6, 3, 7, 8, 3, 'wicker'), B(0, 9, 3, 7, 9, 3, 'wicker'),
  ),
  lantern,
  // a lamp post on a stone foot with an arm and a lantern hung from it; 30 tall ≈ 1.7 m, lantern at head height
  lanternPost: model(30,
    B(-2, 0, -2, 3, 1, 3, 'stone'), B(0, 0, 0, 1, 28, 1, 'beam'), B(0, 29, 0, 9, 29, 1, 'beam'),
    strut(2, 24, 0, 6, 28, 0, 'gopherDark'), moved(lantern.boxes, 4, 19, -2),
  ),
  // a ladder leaning back a block for every three up, rungs every third block; 6 wide, 30 tall ≈ 1.7 m
  ladder: model(30,
    ...Array.from({ length: 10 }, (_, k) => [
      B(0, 3 * k, -k, 0, 3 * k + 2, -k, 'beam'), B(5, 3 * k, -k, 5, 3 * k + 2, -k, 'beam'), B(1, 3 * k + 1, -k, 4, 3 * k + 1, -k, 'gopher'),
    ]).flat(),
  ),
  // a scaffold bay: four standards, a plank stage, a brace, a handline, and a jib with a pulley lowering a crate; 16 × 14, 30 tall ≈ 1.7 m
  scaffold: model(30,
    ...[[0, 0], [15, 0], [0, 7], [15, 7]].map(([x, z]) => B(x!, 0, z!, x!, 27, z!, 'beam')),
    ...[14, 27].flatMap((y) => [B(0, y, 0, 15, y, 0, 'beam'), B(0, y, 7, 15, y, 7, 'beam'), B(0, y, 0, 0, y, 7, 'beam'), B(15, y, 0, 15, y, 7, 'beam')]),
    ...[0, 2, 4, 6].map((z) => B(0, 15, z, 15, 15, z + 1, z % 4 ? 'gopherDark' : 'deck')),       // the stage
    B(0, 19, 7, 15, 19, 7, 'rope'), B(0, 16, 7, 0, 19, 7, 'beam'), B(15, 16, 7, 15, 19, 7, 'beam'),   // handline along the back
    strut(0, 0, 0, 15, 13, 0, 'gopherDark'), strut(0, 0, 7, 15, 13, 7, 'gopherDark'),                  // diagonal braces
    B(7, 28, 0, 8, 28, 12, 'beam'), strut(7, 23, 0, 7, 27, 4, 'gopherDark'), strut(8, 23, 0, 8, 27, 4, 'gopherDark'),   // the jib and its knee
    B(6, 26, 11, 9, 27, 11, 'iron'), B(7, 25, 11, 8, 28, 11, 'iron'),                                   // the sheave
    B(7, 7, 11, 7, 24, 11, 'rope'),                                                                    // the fall
    moved(crate.boxes, 4, 0, 7), B(7, 8, 11, 7, 8, 11, 'rope'),                                        // the load, sitting at the foot
  ),
  // a stack of logs, three-two-one, sawn ends pale with a dark heart; 16 long, 12 deep, 12 tall ≈ 0.9 m long
  logPile: model(12,
    ...[[0, 0], [0, 4], [0, 8], [4, 2], [4, 6], [8, 4]].flatMap(([y, z]) => [
      roll(0, y!, z!, 4, 16, 'trunk'), roll(0, y!, z!, 4, 1, 'deck'), roll(15, y!, z!, 4, 1, 'deck'),
      B(0, y! + 1, z! + 1, 0, y! + 2, z! + 2, 'gopherDark'), B(15, y! + 1, z! + 1, 15, y! + 2, z! + 2, 'gopherDark'),
    ]),
  ),
  // a pair of sawhorses, legs splayed, a plank across them with a saw standing in the cut and a mallet beside it; 19 long, 14 tall
  sawhorse: model(14,
    ...[0, 12].flatMap((x) => [
      strut(x, 0, 0, x, 6, 3, 'beam', 2), strut(x, 0, 7, x, 6, 4, 'beam', 2), B(x, 7, 3, x + 1, 7, 4, 'beam'), B(x, 3, 1, x + 1, 3, 6, 'gopherDark'),
    ]),
    B(0, 7, 3, 13, 7, 4, 'beam'),
    B(-2, 8, 2, 16, 8, 5, 'deck'), B(7, 8, 2, 7, 8, 5, 'pitch'),                                        // the plank and the cut
    B(5, 9, 3, 10, 12, 3, 'iron'), B(5, 9, 3, 5, 9, 3, 'flame'),                                        // the saw plate, one tooth glinting
    B(10, 12, 3, 11, 13, 3, 'gopherDark'), B(11, 11, 3, 11, 11, 3, 'gopherDark'),                       // its handle
    B(13, 9, 4, 14, 10, 5, 'gopherDark'), B(15, 9, 4, 16, 9, 4, 'beam'),                                // the mallet
  ),
  // a two-wheeled hand cart, spoked wheels, shafts trailing, sacks in the bed; 21 long, 8 wide, 10 tall ≈ 1.2 m
  handCart: model(10,
    B(0, 5, 0, 11, 5, 7, 'deck'), B(0, 5, 3, 11, 5, 3, 'gopherDark'),
    B(0, 6, 0, 11, 7, 0, 'gopher'), B(0, 6, 7, 11, 7, 7, 'gopher'), B(0, 6, 0, 0, 7, 7, 'gopher'),
    ...[0, 11].flatMap((x) => [B(x, 5, 0, x, 7, 0, 'beam'), B(x, 5, 7, x, 7, 7, 'beam')]), B(6, 6, 0, 6, 7, 0, 'beam'), B(6, 6, 7, 6, 7, 7, 'beam'),
    B(-1, 3, 0, 12, 4, 7, 'beam'),                                                                     // the axle
    wheel(-1, 0, 0, 8, 'iron', 'gopherDark'), wheel(12, 0, 0, 8, 'iron', 'gopherDark'),
    B(12, 5, 0, 19, 5, 0, 'beam'), B(12, 5, 7, 19, 5, 7, 'beam'),                                      // the shafts
    B(2, 6, 1, 6, 9, 6, 'sackcloth'), B(7, 6, 1, 10, 8, 6, 'sackDark'), B(4, 6, 1, 4, 9, 6, 'sackDark'),
  ),
  // a wheelbarrow, one spoked wheel forward, two legs and two handles back, a load of stone; 16 long, 6 wide, 8 tall
  wheelbarrow: model(8,
    B(2, 4, 0, 9, 4, 5, 'deck'), B(2, 5, 0, 9, 6, 0, 'gopher'), B(2, 5, 5, 9, 6, 5, 'gopher'), B(9, 5, 1, 9, 6, 4, 'gopher'),
    B(2, 5, 1, 2, 5, 4, 'gopher'), B(2, 4, 0, 2, 6, 0, 'beam'), B(2, 4, 5, 2, 6, 5, 'beam'),
    wheel(0, 0, 0, 6, 'iron', 'gopherDark'), B(1, 2, 2, 1, 3, 3, 'iron'),                              // the wheel and its axle end
    B(9, 0, 0, 9, 3, 0, 'beam'), B(9, 0, 5, 9, 3, 5, 'beam'),
    B(10, 4, 0, 15, 4, 0, 'beam'), B(10, 4, 5, 15, 4, 5, 'beam'),
    B(3, 5, 1, 8, 6, 4, 'stone'), B(4, 7, 2, 7, 7, 3, 'stone'), fleck(3, 5, 1, 8, 7, 4, 'robeGrey', 0.3, 6),
  ),
  // a signpost with two boards pointing opposite ways, lettering as dashes; 30 tall ≈ 1.7 m, boards 10 long
  signpost: model(31,
    B(0, 0, 0, 1, 29, 1, 'beam'), B(0, 30, 0, 1, 30, 1, 'gopherDark'),
    B(2, 24, 0, 11, 26, 0, 'deck'), B(12, 25, 0, 12, 25, 0, 'deck'), B(4, 25, 0, 5, 25, 0, 'pitch'), B(7, 25, 0, 9, 25, 0, 'pitch'),
    B(-10, 18, 0, -1, 20, 0, 'deck'), B(-11, 19, 0, -11, 19, 0, 'deck'), B(-8, 19, 0, -6, 19, 0, 'pitch'), B(-4, 19, 0, -3, 19, 0, 'pitch'),
  ),
  // a banner on a crossbar, swallow-tailed, a white dove on red; pole 30 tall ≈ 1.7 m, cloth 10 wide
  bannerPole: model(31,
    B(0, 0, 0, 1, 28, 1, 'beam'), B(-5, 28, 0, 6, 28, 1, 'beam'), B(0, 29, 0, 1, 30, 1, 'copper'),
    B(-4, 14, 2, 5, 27, 2, 'robeRed'), B(-4, 12, 2, -1, 13, 2, 'robeRed'), B(2, 12, 2, 5, 13, 2, 'robeRed'),
    B(-4, 26, 2, 5, 26, 2, 'hay'), B(-4, 15, 2, 5, 15, 2, 'hay'),                                      // a pale border top and bottom
    B(-1, 19, 2, 2, 20, 2, 'wool'), B(3, 21, 2, 3, 21, 2, 'wool'), B(0, 21, 2, 1, 22, 2, 'wool'), B(-2, 18, 2, -2, 18, 2, 'wool'),   // the dove
  ),
  // a water trough, plank sides on corner posts, water a block below the rim; 16 long, 6 wide, 6 tall ≈ 0.9 m
  trough: model(6,
    B(0, 0, 0, 15, 0, 5, 'gopherDark'), B(0, 1, 0, 15, 5, 0, 'gopherDark'), B(0, 1, 5, 15, 5, 5, 'gopherDark'),
    B(0, 1, 0, 0, 5, 5, 'gopherDark'), B(15, 1, 0, 15, 5, 5, 'gopherDark'),
    B(0, 3, 0, 15, 3, 5, 'gopher'), B(1, 1, 1, 14, 4, 4, 'water'),
    ...[[0, 0], [15, 0], [0, 5], [15, 5]].map(([x, z]) => B(x!, 0, z!, x!, 5, z!, 'beam')),
  ),
  // a feed trough on trestle ends, heaped with hay; 16 long, 10 tall ≈ 0.9 × 0.55 m
  feedTrough: model(10,
    B(0, 0, 0, 0, 3, 5, 'beam'), B(15, 0, 0, 15, 3, 5, 'beam'), B(0, 1, 1, 0, 2, 4, 'gopherDark'), B(15, 1, 1, 15, 2, 4, 'gopherDark'),
    B(0, 4, 0, 15, 4, 5, 'gopherDark'), B(0, 5, 0, 15, 8, 0, 'gopherDark'), B(0, 5, 5, 15, 8, 5, 'gopherDark'),
    B(0, 5, 0, 0, 8, 5, 'gopherDark'), B(15, 5, 0, 15, 8, 5, 'gopherDark'), B(0, 6, 0, 15, 6, 5, 'gopher'),
    B(1, 5, 1, 14, 8, 4, 'hay'), B(3, 9, 1, 12, 9, 4, 'hay'), fleck(1, 5, 1, 14, 9, 4, 'straw', 0.25, 9),
  ),
  // a gate between two posts: stiles, three rails, a diagonal, iron straps at the hinges; 20 wide, 19 tall ≈ 1.1 × 1.05 m
  gate: model(19,
    B(0, 0, 0, 1, 17, 1, 'beam'), B(18, 0, 0, 19, 17, 1, 'beam'), B(0, 18, 0, 1, 18, 1, 'gopherDark'), B(18, 18, 0, 19, 18, 1, 'gopherDark'),
    B(2, 0, 0, 3, 14, 0, 'gopher'), B(16, 0, 0, 17, 14, 0, 'gopher'),
    ...[1, 6, 12].map((y) => B(2, y, 0, 17, y + 1, 0, 'gopher')),
    strut(4, 2, 0, 15, 12, 0, 'gopherDark'), strut(4, 3, 0, 15, 13, 0, 'gopherDark'),
    B(2, 2, 0, 6, 2, 0, 'iron'), B(2, 12, 0, 6, 12, 0, 'iron'),
  ),
  // planks stacked crib-wise, each course across the last; 16 × 16, 6 tall
  plankStack: model(6,
    ...[0, 2, 4].flatMap((y) => [0, 6, 12].map((z) => B(0, y, z, 15, y, z + 3, y === 2 ? 'deck' : 'gopher'))),
    ...[1, 3, 5].flatMap((y) => [0, 6, 12].map((x) => B(x, y, 0, x + 3, y, 15, y === 3 ? 'gopher' : 'deck'))),
  ),
  // a coil of rope, three turns high, the end trailing off; 12 across, 3 tall ≈ 0.67 × 0.17 m
  ropeCoil: model(3,
    ring(0, 0, 0, 12, 'sackDark', 3), ring(0, 1, 0, 12, 'rope', 3), ring(1, 2, 1, 10, 'rope', 2),
    B(9, 0, 11, 9, 0, 15, 'rope'), B(9, 0, 15, 14, 0, 15, 'rope'),
  ),
  // a fire pit: a two-deep ring of stones, two logs crossed on the coals, flame on top; 14 across, 7 tall ≈ 0.78 m
  firePit: model(7,
    ring(0, 0, 0, 14, 'stone', 2), ring(0, 1, 0, 14, 'stone', 2), fleck(0, 0, 0, 13, 1, 13, 'robeGrey', 0.25, 7),
    drum(2, 0, 2, 10, 0, 'charcoal'),
    B(3, 1, 6, 10, 2, 7, 'trunk'), B(6, 1, 3, 7, 2, 10, 'trunk'), B(3, 1, 6, 3, 2, 7, 'deck'), B(6, 1, 3, 7, 2, 3, 'deck'),
    drum(4, 3, 4, 6, 3, 'ember'), drum(5, 4, 5, 4, 4, 'fire'), B(6, 5, 6, 7, 5, 7, 'flame'), B(6, 6, 7, 6, 6, 7, 'flame'),
  ),
  // a cooking pot hung by a rope from a tripod over a small fire; 14 across, 18 tall ≈ 1 m
  cookingTripod: model(18,
    strut(0, 0, 0, 6, 17, 6, 'beam', 2), strut(12, 0, 0, 6, 17, 6, 'beam', 2), strut(6, 0, 12, 6, 17, 6, 'beam', 2),
    B(6, 17, 6, 7, 17, 7, 'rope'), B(6, 14, 6, 6, 16, 6, 'rope'),
    drum(4, 8, 4, 6, 11, 'iron'), drum(5, 7, 5, 4, 7, 'iron'), drum(5, 11, 5, 4, 11, 'clayDark'),
    B(4, 12, 6, 4, 13, 6, 'iron'), B(9, 12, 6, 9, 13, 6, 'iron'), B(4, 14, 6, 9, 14, 6, 'iron'),      // the bail
    drum(4, 0, 4, 6, 0, 'charcoal'), drum(5, 1, 5, 4, 1, 'fire'), B(6, 2, 6, 7, 2, 7, 'flame'), B(6, 3, 6, 6, 3, 6, 'flame'),
  ),
  // a wooden chest, a rounded lid, two iron bands, a copper lock plate; 12 × 8 × 8 ≈ 0.67 × 0.45 m
  chest: model(8,
    B(0, 0, 0, 11, 5, 7, 'gopher'), B(0, 3, 0, 11, 3, 7, 'gopherDark'),
    B(0, 6, 0, 11, 6, 7, 'gopherDark'), B(0, 7, 1, 11, 7, 6, 'gopherDark'), B(0, 7, 3, 11, 7, 4, 'gopher'),
    B(2, 0, 0, 2, 7, 7, 'iron'), B(9, 0, 0, 9, 7, 7, 'iron'), B(5, 4, 7, 6, 5, 7, 'copper'),
  ),
  // a sheaf of straw, spread at the foot and the head, tied at the waist; 6 wide, 12 tall ≈ 0.67 m
  strawBundle: model(12,
    drum(0, 0, 0, 6, 2, 'straw'), drum(1, 3, 1, 4, 4, 'straw'), drum(1, 5, 1, 4, 6, 'sackDark'),
    drum(1, 7, 1, 4, 8, 'straw'), drum(0, 9, 0, 6, 10, 'straw'), drum(0, 11, 0, 6, 11, 'hay'),
    fleck(0, 0, 0, 5, 11, 5, 'hay', 0.2, 10),
  ),
  // a chicken coop on short legs: plank walls, a slatted front with a pop-hole and a ramp, a stepped thatched lean-to roof; 16 × 15 footprint, 12 tall ≈ 0.9 × 0.67 m
  chickenCoop: model(12,
    ...[[0, 0], [12, 0], [0, 8], [12, 8]].map(([x, z]) => B(x!, 0, z!, x! + 1, 1, z! + 1, 'beam')),
    B(0, 2, 0, 13, 2, 9, 'deck'),
    B(0, 3, 0, 13, 8, 0, 'gopherDark'), B(0, 3, 0, 0, 8, 9, 'gopherDark'), B(13, 3, 0, 13, 8, 9, 'gopherDark'),
    ...[4, 6].map((y) => B(0, y, 0, 13, y, 9, 'gopher')),
    B(1, 3, 1, 12, 8, 4, 'charcoal'), B(1, 3, 5, 12, 3, 8, 'hay'),
    ...[0, 2, 4, 9, 11, 13].map((x) => B(x, 3, 9, x, 8, 9, 'beam')), B(0, 7, 9, 13, 8, 9, 'gopherDark'),
    B(5, 0, 12, 8, 0, 13, 'deck'), B(5, 1, 11, 8, 1, 11, 'deck'), B(5, 2, 10, 8, 2, 10, 'deck'),      // the ramp to the pop-hole
    B(-1, 9, -1, 14, 9, 10, 'hay'), B(-1, 10, -1, 14, 10, 6, 'hay'), B(-1, 11, -1, 14, 11, 2, 'hay'),    // thatch
    fleck(-1, 9, -1, 14, 11, 10, 'straw', 0.3, 11), B(-1, 9, 10, 14, 9, 10, 'sackDark'),                 // its trimmed eave
  ),
  // a big pot, a wide bowl and a small jug set down together; 18 wide, 9 tall
  potCluster: model(9,
    clayPot.boxes,
    drum(7, 0, 5, 8, 2, 'clay'), drum(7, 1, 5, 8, 1, 'clayDark'), drum(8, 2, 6, 6, 2, 'clayDark'),
    drum(13, 0, 1, 4, 5, 'clay'), drum(13, 3, 1, 4, 3, 'clayDark'), drum(14, 5, 2, 2, 5, 'charcoal'), B(17, 2, 2, 17, 4, 2, 'clayDark'),
  ),
};

// ── scatter ──────────────────────────────────────────────────────────────

export interface ScatterItem {
  model: Model;
  /** how many copies to place */
  count: number;
  /** which quarter turns are allowed; all four by default */
  turns?: number[];
  /** a name carried through to the result, for the caller's bookkeeping */
  name?: string;
}

/** A rectangle of ground, in blocks, both corners inclusive. */
export interface Footprint { x0: number; z0: number; x1: number; z1: number }

export interface ScatterOptions extends Footprint {
  /** ground level, block y; default 0 */
  y?: number;
  /** a different seed is a different arrangement; the same seed is the same one, every load */
  seed?: number;
  /** clear ground kept round each prop, in blocks; default 2 */
  gap?: number;
  /** attempts per copy before it is given up; default 40 */
  tries?: number;
  /** ground already taken — a tent, a beast, the ramp — that nothing may land on */
  avoid?: Footprint[];
}

export interface Placed extends Footprint { name?: string; at: [number, number, number]; turn: number }

/** The ground a model covers, after a quarter turn, relative to its origin. */
export function footprintOf(m: Model, turn = 0): Footprint {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [bx0, , bz0, bx1, , bz1] of m.boxes)
    for (const [x, z] of [[bx0, bz0], [bx1, bz1], [bx0, bz1], [bx1, bz0]] as [number, number][]) {
      const [rx, rz] = turn === 0 ? [x, z] : turn === 1 ? [-z, x] : turn === 2 ? [-x, -z] : [z, -x];
      x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); z0 = Math.min(z0, rz); z1 = Math.max(z1, rz);
    }
  return { x0, z0, x1, z1 };
}

const overlaps = (a: Footprint, b: Footprint, gap: number) =>
  a.x0 <= b.x1 + gap && b.x0 <= a.x1 + gap && a.z0 <= b.z1 + gap && b.z0 <= a.z1 + gap;

/**
 * Drops props into a rectangle of ground without overlap, the same way every
 * time for the same seed, so a screenshot taken tomorrow can be laid over one
 * taken today. Larger props are placed first so they get room; a copy that
 * finds no room after `tries` attempts is dropped, and the caller can see
 * from the returned list how many landed.
 */
export function scatter(grid: Grid, items: ScatterItem[], opts: ScatterOptions): Placed[] {
  const y = opts.y ?? 0, seed = opts.seed ?? 1, gap = opts.gap ?? 2, tries = opts.tries ?? 40;
  const placed: Placed[] = [];
  const taken: Footprint[] = [...(opts.avoid ?? [])];

  const area = (m: Model) => { const f = footprintOf(m, 0); return (f.x1 - f.x0 + 1) * (f.z1 - f.z0 + 1); };
  const order = items.map((it, i) => ({ it, i })).sort((a, b) => area(b.it.model) - area(a.it.model) || a.i - b.i);

  for (const { it, i } of order) {
    const turns = it.turns && it.turns.length ? it.turns : [0, 1, 2, 3];
    for (let c = 0; c < it.count; c++) {
      const id = seed * 7919 + i * 131 + c;
      for (let t = 0; t < tries; t++) {
        const turn = turns[Math.floor(hash(id, t * 3 + 1) * turns.length)]!;
        const f = footprintOf(it.model, turn);
        const lox = opts.x0 - f.x0, hix = opts.x1 - f.x1, loz = opts.z0 - f.z0, hiz = opts.z1 - f.z1;
        if (hix < lox || hiz < loz) break;                              // does not fit the rectangle at all
        const ax = lox + Math.floor(hash(id, t * 3 + 2) * (hix - lox + 1));
        const az = loz + Math.floor(hash(id, t * 3 + 3) * (hiz - loz + 1));
        const fp: Footprint = { x0: ax + f.x0, z0: az + f.z0, x1: ax + f.x1, z1: az + f.z1 };
        if (taken.some((o) => overlaps(fp, o, gap))) continue;
        stamp(grid, it.model, [ax, y, az], turn, 1);
        taken.push(fp);
        placed.push({ ...fp, name: it.name, at: [ax, y, az], turn });
        break;
      }
    }
  }
  return placed;
}
