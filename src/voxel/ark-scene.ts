import { Grid, PALETTE } from './grid.ts';
import { MODELS, stamp } from './creatures.ts';
import { stampVox, type VoxModel } from './vox.ts';
import { PROPS, scatter } from './props.ts';
import { paintGround, scatterTrees, scatterVegetation } from './terrain.ts';

// NOAH'S ARK, BUILT FROM THE NUMBERS AND NOTHING ELSE.
//
//   "The length of the ark shall be three hundred cubits, the breadth of it
//    fifty cubits, and the height of it thirty cubits." — Genesis 6:15
//
// So it is a BOX. Every painting of the ark — including the reference picture
// this scene was asked to match — gives it a ship's bow, a keel and a curved
// sheer, and the text gives none of those. Where the picture and the verse
// disagree, this scene follows the verse, and the panel says which parts of
// what you are looking at were stated and which were chosen. That is the only
// reason to build it in blocks at all: a block is a count, not a drawing.
//
// TWO BLOCK SIZES, which is the whole trick of the look:
//   · the ark is built in WHOLE CUBITS — three hundred blocks long, so the
//     grid you can see is the measurement itself;
//   · the people, beasts and camp are built in QUARTER cubits, so a man four
//     cubits tall is sixteen blocks and can have a face, and a lamb is not a
//     single brick. One coarse mesh and one fine mesh, two draw calls.
//
// STATED: 300 × 50 × 30 cubits; three decks (6:16); a door in the side
// (6:16); a window finished to a cubit above (6:16); pitch within and without
// (6:14); rooms (6:14). CHOSEN: where the door sits along the side, how the
// rooms are divided, the ramp, the scaffolding, the camp, every animal and
// person outside the ark, and every colour.

export const CUBITS = { length: 300, breadth: 50, height: 30 } as const;
/** Fine blocks to the cubit. The coarse grid is one block to the cubit.
 *
 *  This was four, and a sheep came out eight blocks tall — still a lump. At
 *  eight to the cubit a block is 5.6 cm: a man is thirty-two blocks, a barrel
 *  eight, and a voxelised animal has room for ears and feet. The ark stays at
 *  one block to the cubit, where each block IS a stated measurement. */
export const FINE = 8;
/** Hand-built creatures in creatures.ts are authored at half a cubit a block,
 *  so they need blowing up by this much to stand in the fine grid. */
const HANDMADE = FINE / 2;

const L = CUBITS.length, W = CUBITS.breadth, H = CUBITS.height;

export interface BuildOptions {
  /** Cut the near side away so the three decks show, as the reference
   *  picture's "Deck 1 / 2 / 3" buttons promise. */
  cutaway?: boolean;
  /** The camp, the animals and the eight — none of it stated by the text. */
  scenery?: boolean;
  /** Voxelised creatures, by name. Where one is present it is used instead of
   *  the hand-built model of the same name; where it is missing the hand-built
   *  one still stands, so a half-finished set renders. */
  vox?: Record<string, VoxModel>;
}

export interface World { coarse: Grid; fine: Grid; door: { x: number; height: number } }

export function buildArkWorld(opts: BuildOptions = {}): World {
  const coarse = new Grid();
  const fine = new Grid();
  const P = PALETTE;
  const cut = opts.cutaway ?? false;
  // With the near side open, the hull is cut from this cubit forward.
  const cutAt = cut ? Math.round(W * 0.55) : W;

  // ── the hull ───────────────────────────────────────────────────────────
  // A hundred and thirty-four metres of one flat brown reads as a fence, not
  // as a ship. What makes timber read as timber, in a picture or in blocks,
  // is the SEAMS: courses of planking with a shadow line between them, heavy
  // wales running the length, and ribs close enough together to count. None
  // of it is stated by Genesis — the text gives three numbers and pitch — but
  // a surface has to be made of something, and these are the choices a
  // shipwright would make. The panel says so.
  //
  // The lowest four courses are pitch: "thou shalt pitch it within and
  // without with pitch" (6:14).
  // Two woods twenty-five per cent apart turned the hull into a barcode. The
  // courses are now within a few per cent of each other and it is the SEAM —
  // one dark row every three cubits — that does the work.
  const plank = (y: number) => {
    if (y < 2) return y === 1 ? P.pitchSeam! : P.pitch!;   // pitch, two cubits only
    const course = Math.floor((y - 2) / 3);
    if ((y - 2) % 3 === 2) return P.gopherSeam!;
    return course % 2 ? P.gopher! : P.gopherDark!;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      coarse.set(x, y, 0, plank(y));                        // the far side
      if (!cut) coarse.set(x, y, W - 1, plank(y));          // the near side
    }
    for (let z = 0; z < cutAt; z++) {
      coarse.set(0, y, z, plank(y));                        // the two ends
      coarse.set(L - 1, y, z, plank(y));
    }
    if (cut) for (let x = 0; x < L; x++) coarse.set(x, y, cutAt, plank(y));   // the cut face
  }

  // RIBS, every five cubits and STANDING PROUD of the planking by one cubit.
  // Ribs flush with the wall are just a stripe of another colour; a rib that
  // stands out casts its own shadow down the hull, and that shadow is most of
  // what the eye reads as depth. Sixty of them along the length.
  for (let x = 0; x < L; x += 4)
    for (let y = 0; y < H; y++) {
      coarse.set(x, y, -1, P.post!);
      if (!cut) coarse.set(x, y, W, P.post!);
    }
  // WALES: the heavy timbers that run the whole length, also standing proud.
  // They cut the height into bands, which is what stops the hull reading as
  // one tall blank thing.
  for (const y of [8, 17]) {
    for (let x = 0; x < L; x++) {
      coarse.set(x, y, -1, P.wale!);
      if (!cut) coarse.set(x, y, W, P.wale!);
    }
    for (let z = 0; z < cutAt; z++) {
      coarse.set(-1, y, z, P.wale!);
      coarse.set(L, y, z, P.wale!);
    }
  }
  // the ends get ribs too, or the bow reads as a blank panel
  for (let z = 0; z < cutAt; z += 5)
    for (let y = 0; y < H; y++) {
      coarse.set(-1, y, z, P.beam!);
      coarse.set(L, y, z, P.beam!);
    }
  // corner posts, the full height, at all four corners
  for (let y = 0; y < H; y++)
    for (const [x, z] of [[-1, -1], [L, -1], [-1, W], [L, W]] as [number, number][])
      if (!cut || z === -1) coarse.set(x, y, z, P.beam!);

  // THE ROOF, with a two-cubit eave all round. The overhang is what puts a
  // band of shadow along the top of the hull; without it the wall and the
  // roof are one flat shape.
  // The roof is the biggest single surface in the scene — twenty-two metres by
  // a hundred and thirty-four — and one flat brown reads as a tarpaulin. It
  // gets the same treatment as the hull: boards running the length, in courses
  // three cubits wide with a seam between, so the eye has something to travel
  // along.
  const board = (z: number) => {
    const course = Math.floor((z + 2) / 3);
    if ((z + 2) % 3 === 2) return P.gopherSeam!;
    return course % 2 ? P.roof! : P.wale!;
  };
  for (let x = -2; x <= L + 1; x++)
    for (let z = -2; z <= (cut ? cutAt + 1 : W + 1); z++) {
      coarse.set(x, H, z, board(z));
      if (cut && x >= 0 && x < L && z >= 0) coarse.set(x, 0, z, P.pitch!);
    }
  // purlins across the boards every ten cubits, standing one course proud
  for (let x = 0; x < L; x += 12)
    for (let z = -2; z <= (cut ? cutAt + 1 : W + 1); z++) coarse.set(x, H, z, P.beam!);
  // rafter ends showing under the eave, every five cubits
  for (let x = 0; x < L; x += 5) {
    coarse.set(x, H - 1, -2, P.beam!);
    if (!cut) coarse.set(x, H - 1, W + 1, P.beam!);
  }
  // a ridge down the middle, two courses proud
  for (let x = -1; x <= L; x++) {
    coarse.set(x, H + 1, Math.round(W / 2), P.wale!);
    coarse.set(x, H + 1, Math.round(W / 2) - 1, P.beam!);
  }

  // LAMPS along the side. Painted bright rather than lit — one real light in
  // the doorway is worth the cost, twenty down a hull are not, and a bright
  // block beside a dark one reads as a lamp perfectly well at this distance.
  for (let x = 12; x < L - 12; x += 24) {
    if (cut) break;
    coarse.set(x, 12, W + 1, P.lampIron!);
    coarse.set(x, 11, W + 1, P.lamp!);
  }

  // ── three decks ────────────────────────────────────────────────────────
  //   "with lower, second, and third stories shalt thou make it" — 6:16
  // The text gives the count, not the spacing; even spacing is the choice.
  // Nothing is drawn inside a closed hull: it would be a hundred thousand
  // blocks nobody can see.
  const decks = [Math.round(H / 4), Math.round(H / 2), Math.round((H * 3) / 4)];
  if (cut) {
    for (const y of decks) {
      for (let x = 0; x < L; x++)
        for (let z = 0; z <= cutAt; z++) coarse.set(x, y, z, P.deck!);
      // a bulkhead every ten cubits, with a gangway left open down the middle
      for (let x = 0; x < L; x += 10)
        for (let z = 0; z <= cutAt; z++) {
          const gangway = Math.abs(z - W / 2) < 3;
          if (!gangway) for (let dy = 1; dy < decks[1]! - decks[0]!; dy++) coarse.set(x, y + dy, z, P.beam!);
        }
    }
  }

  // ── the door in the side ───────────────────────────────────────────────
  //   "And the door of the ark shalt thou set in the side thereof" — 6:16
  // The verse fixes the side; where along it is the choice. Amidships, four
  // cubits wide and six high, so the ox of Genesis 7 walks in without
  // stooping.
  // WHERE ALONG THE SIDE. Genesis fixes the side and says nothing else, so
  // this is a free choice — and it is a composition choice as much as
  // anything. Amidships (x = L/2) puts the door, the ramp and the whole camp
  // seventy metres from either end, so no single view can hold the bow and
  // the animals at once. A fifth of the way along keeps everything in one
  // frame, which is how the reference picture reads as a place rather than a
  // wall. The panel lists this under "chosen".
  const doorX = Math.round(L * 0.2), doorW = 4, doorH = 6;
  if (!cut) {
    coarse.carve(doorX - doorW / 2, 1, W - 1, doorX + doorW / 2, doorH, W - 1);
    for (let y = 1; y <= doorH + 1; y++) {
      coarse.set(doorX - doorW / 2 - 1, y, W - 1, P.beam!);
      coarse.set(doorX + doorW / 2 + 1, y, W - 1, P.beam!);
    }
    for (let x = doorX - doorW / 2 - 1; x <= doorX + doorW / 2 + 1; x++) coarse.set(x, doorH + 1, W - 1, P.beam!);
  }

  // A PORCH BEHIND THE DOOR. The opening was carved correctly and still read
  // as a slightly darker patch of wall: what you see through it is the inside
  // of the far side, in shadow, the same brown. So a few cubits of lit floor
  // and a back wall are built inside the doorway. It is the same trick the
  // reference picture uses — a warm mouth — and it is what makes a hole in a
  // wall look like a way in.
  if (!cut) {
    for (let z = W - 8; z < W - 1; z++)
      for (let x = doorX - 6; x <= doorX + 6; x++) {
        coarse.set(x, 0, z, P.deck!);
        if (z === W - 8) for (let y = 1; y <= doorH; y++) coarse.set(x, y, z, P.beam!);
      }
    for (let y = 1; y <= doorH; y++)
      for (let z = W - 8; z < W - 1; z++) {
        coarse.set(doorX - 6, y, z, P.beam!);
        coarse.set(doorX + 6, y, z, P.beam!);
      }
  }

  // ── the window ─────────────────────────────────────────────────────────
  //   "A window shalt thou make to the ark, and in a cubit shalt thou finish
  //    it above" — 6:16. The plainest reading of a hard verse: an opening a
  // cubit high under the eaves. Others read a single window of one cubit.
  // This takes the running opening, and the panel says it is a reading.
  // Read as a LATTICE: a course of open cubit-wide gaps between short posts,
  // running the whole length under the eave, with the lit inside of the ark
  // showing through. It gives the top of the hull a line of dark-and-gold
  // that a plain slot cannot, and it is what the verse most plainly
  // describes — an opening finished to a cubit below the roof.
  for (let x = 1; x < L - 1; x++) {
    const openGap = x % 2 === 1;
    for (const z of cut ? [0] : [0, W - 1]) {
      if (openGap) {
        coarse.carve(x, H - 1, z, x, H - 1, z);
        // the warm inside, one course behind the opening
        coarse.set(x, H - 1, z === 0 ? 1 : W - 2, P.latticeGlow!);
      } else {
        coarse.set(x, H - 1, z, P.post!);
      }
    }
  }

  if (!opts.scenery) return { coarse, fine, door: { x: doorX, height: doorH } };

  // ── the camp: not one word of this is stated ───────────────────────────
  // Everything below is in quarter cubits, four times the coarse numbers.
  const f = (cubits: number) => Math.round(cubits * FINE);
  const groundY = 0;

  // THE RAMP, six cubits wide with a rail down each side and cross-cleats for
  // a hoof to grip. The first one was a bare plank four cubits wide and read
  // as a diving board.
  const rampFromZ = f(W), rampLen = f(16), rampHalf = f(3);
  for (let i = 0; i < rampLen; i++) {
    const y = f(doorH) - Math.round((i / rampLen) * f(doorH));
    fine.box(f(doorX) - rampHalf, y, rampFromZ + i, f(doorX) + rampHalf, y, rampFromZ + i, P.deck!);
    if (i % f(1) === 0)                                   // a cleat every cubit
      fine.box(f(doorX) - rampHalf, y + 1, rampFromZ + i, f(doorX) + rampHalf, y + 1, rampFromZ + i, P.beam!);
    for (const side of [-rampHalf - 1, rampHalf + 1]) {   // the two rails
      fine.set(f(doorX) + side, y + 1, rampFromZ + i, P.beam!);
      fine.set(f(doorX) + side, y + 4, rampFromZ + i, P.beam!);
      if (i % f(2) === 0) for (let dy = 1; dy <= 4; dy++) fine.set(f(doorX) + side, y + dy, rampFromZ + i, P.beam!);
    }
  }

  // SCAFFOLDING, the stage the ark is still being built from. Uprights,
  // ledgers, diagonal braces and two boarded lifts: the braces are the part
  // that makes it read as scaffolding rather than as a ladder, because a
  // rectangle of sticks is a fence and a braced rectangle is a structure.
  const scafX0 = f(doorX + 14), scafX1 = f(doorX + 46), bay = f(4);
  const scafZ = rampFromZ + 2, scafD = f(3), scafTop = f(20);
  for (let x = scafX0; x <= scafX1; x += bay) {
    for (let y = 0; y < scafTop; y++) {                   // uprights, front and back
      fine.set(x, y, scafZ + scafD, P.beam!);
      fine.set(x, y, scafZ, P.beam!);
    }
    for (let y = f(6); y < scafTop; y += f(6))            // ledgers across the bay
      fine.box(x, y, scafZ, x, y, scafZ + scafD, P.beam!);
    // a diagonal brace across each bay, alternating direction
    if (x + bay <= scafX1) {
      const rise = f(6), run = bay;
      for (let t = 0; t <= run; t++) {
        const up = Math.round((t / run) * rise);
        const dir = ((x - scafX0) / bay) % 2 === 0 ? t : run - t;
        fine.set(x + dir, up, scafZ + scafD, P.beam!);
      }
    }
  }
  for (const lift of [f(6), f(12)])                       // two boarded lifts
    for (let x = scafX0; x <= scafX1; x++)
      for (let z = scafZ; z <= scafZ + scafD; z++) fine.set(x, lift, z, P.deck!);
  // a ladder from the ground to the first lift
  for (let y = 0; y < f(12); y++) {
    fine.set(scafX0 + f(1), y, scafZ + scafD + 1, P.beam!);
    fine.set(scafX0 + f(2), y, scafZ + scafD + 1, P.beam!);
    if (y % 3 === 0) fine.box(scafX0 + f(1), y, scafZ + scafD + 1, scafX0 + f(2), y, scafZ + scafD + 1, P.beam!);
  }

  // A CRANE: an A-frame with a jib, a rope over it and a crate on the hook,
  // halfway up. Every picture of a ship being built has one, and it is the
  // single prop that says "this thing is unfinished and enormous".
  const craneX = f(doorX - 34), craneZ = rampFromZ + f(4), craneTop = f(26);
  for (let y = 0; y < craneTop; y++) {                    // the two legs, leaning in
    const lean = Math.round((1 - y / craneTop) * f(3));
    fine.set(craneX - lean, y, craneZ, P.beam!);
    fine.set(craneX + lean, y, craneZ + f(3), P.beam!);
  }
  fine.box(craneX, craneTop, craneZ, craneX, craneTop, craneZ + f(3), P.beam!);   // the head
  for (let i = 0; i <= f(7); i++) fine.set(craneX, craneTop - Math.round(i / 3), craneZ - i, P.beam!);  // the jib
  const hookZ = craneZ - f(7);
  for (let y = f(10); y < craneTop - f(2); y++) fine.set(craneX, y, hookZ, P.rope!);   // the fall
  fine.box(craneX - f(1), f(8), hookZ - f(1), craneX + f(1), f(10), hookZ + f(1), P.gopher!);  // the crate on it

  // NO DIRT YARD HERE. It used to be painted at y = -1, which is underneath
  // the flat ground plane the renderer draws — eighty-six thousand blocks that
  // nobody could ever see, a third of the whole scene. The ground is the
  // terrain builder's job and it paints on the coarse grid, where a patch this
  // size costs a few hundred blocks instead.
  const fence = (x0: number, z0: number, x1: number, z1: number) => {
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        if (x === x0 || x === x1 || z === z0 || z === z1) {
          if ((x + z) % 3 === 0) fine.box(x, groundY, z, x, groundY + 3, z, P.beam!);
          fine.set(x, groundY + 2, z, P.beam!);
        }
  };
  fence(f(doorX - 26), rampFromZ + f(4), f(doorX - 7), rampFromZ + f(22));
  fence(f(doorX + 7), rampFromZ + f(4), f(doorX + 26), rampFromZ + f(22));

  // THE YARD, DRESSED. The charm of the picture we are chasing is not the
  // building — it is that the ground in front of it is covered in the stuff
  // of a year's work: fodder, crates, jars, tools, a fire. Placed by
  // scatter(), which is a deterministic hash, so the same scene comes back
  // every reload and a screenshot can be compared with last week's.
  scatter(fine, [
    { model: PROPS.hayBaleRound!, count: 5 },
    { model: PROPS.hayBaleSquare!, count: 6 },
    { model: PROPS.hayHeap!, count: 3 },
    { model: PROPS.crateStack!, count: 4 },
    { model: PROPS.crateLarge!, count: 5 },
    { model: PROPS.crate!, count: 8 },
    { model: PROPS.barrel!, count: 7 },
    { model: PROPS.barrelSide!, count: 3 },
    { model: PROPS.sackPile!, count: 4 },
    { model: PROPS.grainSack!, count: 5 },
    { model: PROPS.waterJar!, count: 4 },
    { model: PROPS.amphora!, count: 4 },
    { model: PROPS.potCluster!, count: 3 },
    { model: PROPS.basket!, count: 5 },
    { model: PROPS.chest!, count: 3 },
    { model: PROPS.strawBundle!, count: 6 },
  ], { x0: f(doorX - 30), z0: rampFromZ + f(3), x1: f(doorX + 34), z1: rampFromZ + f(26),
       y: groundY, seed: 7, gap: 2, avoid: [
         // the ramp and its approach stay clear, or the beasts cannot get up
         { x0: f(doorX) - f(5), z0: rampFromZ, x1: f(doorX) + f(5), z1: rampFromZ + f(18) },
       ] });

  // the working end: timber, tools and the fire, by the scaffold
  scatter(fine, [
    { model: PROPS.logPile!, count: 3 },
    { model: PROPS.plankStack!, count: 4 },
    { model: PROPS.sawhorse!, count: 3 },
    { model: PROPS.handCart!, count: 2 },
    { model: PROPS.wheelbarrow!, count: 2 },
    { model: PROPS.ropeCoil!, count: 3 },
    { model: PROPS.bucket!, count: 4 },
    { model: PROPS.pail!, count: 3 },
    { model: PROPS.firePit!, count: 1 },
    { model: PROPS.cookingTripod!, count: 1 },
    { model: PROPS.oilJar!, count: 3 },
    { model: PROPS.chickenCoop!, count: 1 },
    { model: PROPS.feedTrough!, count: 3 },
    { model: PROPS.trough!, count: 2 },
  ], { x0: f(doorX + 12), z0: rampFromZ + f(4), x1: f(doorX + 52), z1: rampFromZ + f(24),
       y: groundY, seed: 19, gap: 2 });

  // the beasts, two and two (Genesis 7:9), turned toward the ramp
  const pairs: [keyof typeof MODELS, number, number][] = [
    ['elephant', -24, 6], ['giraffe', -22, 15], ['ox', -14, 10], ['camel', 10, 8],
    ['ass', 17, 15], ['lion', 21, 6], ['sheep', -10, 18], ['goat', -6, 12],
    ['ram', 8, 19], ['chicken', 3, 21],
  ];
  const beast = (kind: string, x: number, z: number, turn: number) => {
    const real = opts.vox?.[kind];
    if (real) stampVox(fine, real, [x, groundY, z], turn);
    else if (MODELS[kind]) stamp(fine, MODELS[kind]!, [x, groundY, z], turn, HANDMADE);
  };
  for (const [kind, dx, dz] of pairs) {
    const x = f(doorX + dx), z = rampFromZ + f(dz);
    beast(kind, x, z, 3);
    beast(kind, x, z + f(2.5), 3);
  }

  // the eight: Noah, his wife, his three sons and their wives (Genesis 7:13)
  const eight: [keyof typeof MODELS, number][] = [
    ['noah', -5], ['noahWife', -3.2], ['son', -1.4], ['sonWife', 0.4],
    ['son', 2.2], ['sonWife', 4], ['son', 5.8], ['sonWife', 7.6],
  ];
  for (const [who, dx] of eight) beast(who, f(doorX + dx), rampFromZ + f(17), 3);

  // two still at work on the stage
  beast('worker', f(doorX + 14), rampFromZ + f(3), 3);
  beast('worker', f(doorX + 30), rampFromZ + f(2), 2);

  // ── the furniture of a lived-in place ──────────────────────────────────
  // None of this is Scripture and all of it is why the reference picture
  // looks warm: a banner, lamps at the door, tents, trees, and flowers in
  // the grass. A true thing drawn coldly still does not get looked at.

  // a banner beside the ramp, and lantern posts down the path from it, which
  // is what carries the eye from the door out into the camp after dark
  stamp(fine, PROPS.bannerPole!, [f(doorX + 9), groundY, rampFromZ + f(1)], 0, 1);
  stamp(fine, PROPS.signpost!, [f(doorX - 14), groundY, rampFromZ + f(21)], 0, 1);
  for (let i = 0; i < 6; i++)
    stamp(fine, PROPS.lanternPost!, [f(doorX - 22 + i * 10), groundY, rampFromZ + f(19)], 0, 1);
  stamp(fine, PROPS.lantern!, [f(doorX - doorW / 2 - 2), groundY, rampFromZ + 1], 0, 1);
  stamp(fine, PROPS.lantern!, [f(doorX + doorW / 2 + 2), groundY, rampFromZ + 1], 0, 1);
  stamp(fine, PROPS.gate!, [f(doorX - 7), groundY, rampFromZ + f(13)], 0, 1);

  // tents of the camp, off to one side — a pitched roof on four walls
  const tent = (cx: number, cz: number, w: number) => {
    for (let i = 0; i <= w; i++) {
      const h = Math.round((w / 2 - Math.abs(i - w / 2)) * 1.3) + f(1);
      fine.box(cx + i, groundY, cz, cx + i, groundY + h, cz + w, i % 5 === 0 ? P.tentDark! : P.tent!);
      fine.box(cx + i, groundY, cz + w, cx + i, groundY + h, cz + w, P.tent!);
    }
  };
  tent(f(doorX - 48), rampFromZ + f(6), f(6));
  tent(f(doorX - 40), rampFromZ + f(14), f(5));
  tent(f(doorX + 38), rampFromZ + f(10), f(6));

  // ── the ground, the wood and the meadow ────────────────────────────────
  // All of this is terrain.ts: the ground and the water are painted on the
  // COARSE grid, where a 0.445 m block is the right chunkiness and a field
  // costs ten thousand blocks instead of a million; the trees, flowers and
  // tufts go on the FINE grid, where the detail actually shows.
  //
  // The camp stands on a level patch — hills are pretty but the ark has to
  // sit flat — and a worn track runs from the foot of the ramp out through
  // the yard, which is what the eye follows into the scene.
  const field = { x0: -40, z0: -22, x1: 210, z1: 112 };
  const ground = paintGround(coarse, {
    rect: field,
    y: -1,
    seed: 11,
    relief: { height: 5, scale: 46, flat: { x0: -14, z0: -12, x1: L + 14, z1: W + 34 }, margin: 16 },
    paths: [
      { points: [[doorX, W + 2], [doorX, W + 18], [doorX - 16, W + 30], [doorX - 34, W + 40]], width: 3.2 },
      { points: [[doorX + 6, W + 16], [doorX + 26, W + 24], [doorX + 48, W + 26]], width: 2.4 },
    ],
    ponds: [{ x: doorX - 52, z: W + 40, rx: 11, rz: 7 }],
    stones: 0.004,
  });
  scatterTrees(fine, {
    ground, finePerCubit: FINE, seed: 5, spacing: 20, chance: 0.55,
    rect: { x0: -34, z0: -18, x1: 200, z1: 106 },
    // nothing grows where the ark stands, nor in the dressed yard
    avoid: (x, z) => (x > -6 && x < L + 6 && z > -6 && z < W + 4)
      || (x > doorX - 34 && x < doorX + 56 && z > W + 1 && z < W + 28),
  });
  scatterVegetation(fine, {
    ground, finePerCubit: FINE, seed: 23,
    rect: { x0: -30, z0: -14, x1: 196, z1: 104 },
    flowers: 0.10, tufts: 0.12, pebbles: 0.02, boulders: 0.0006,
  });

  return { coarse, fine, door: { x: doorX, height: doorH } };
}
