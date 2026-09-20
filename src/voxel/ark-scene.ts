import { Grid, PALETTE } from './grid.ts';
import { MODELS, stamp } from './creatures.ts';

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
/** Fine blocks to the cubit. The coarse grid is one block to the cubit. */
export const FINE = 4;

const L = CUBITS.length, W = CUBITS.breadth, H = CUBITS.height;

export interface BuildOptions {
  /** Cut the near side away so the three decks show, as the reference
   *  picture's "Deck 1 / 2 / 3" buttons promise. */
  cutaway?: boolean;
  /** The camp, the animals and the eight — none of it stated by the text. */
  scenery?: boolean;
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
  // The lowest four courses are pitch: "thou shalt pitch it within and
  // without with pitch" (6:14). The planking is drawn by alternating two
  // woods every third course, which is what makes a wall of one colour read
  // as timber rather than as a slab.
  const plank = (y: number) => (y < 4 ? P.pitch! : (Math.floor(y / 3) % 2 ? P.gopher! : P.gopherDark!));
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
  // RIB TIMBERS. A hundred and thirty-four metres of one brown is a slab, not
  // a ship: the eye needs something to count along. A rib every ten cubits is
  // a shipwright's spacing and it makes the length legible — you can see that
  // the ark is thirty ribs long. The text does not specify ribs.
  for (let x = 0; x < L; x += 10)
    for (let y = 0; y < H; y++) {
      coarse.set(x, y, 0, P.beam!);
      if (!cut) coarse.set(x, y, W - 1, P.beam!);
    }
  // corner posts, the full height, at all four corners
  for (let y = 0; y < H; y++)
    for (const [x, z] of [[0, 0], [L - 1, 0], [0, W - 1], [L - 1, W - 1]] as [number, number][])
      if (!cut || z === 0) coarse.set(x, y, z, P.beam!);

  // the roof over it, with an eave standing one cubit proud of the sides so
  // the hull gets a shadow line down its length, and the pitched floor (only
  // worth drawing when the hull is open)
  for (let x = -1; x <= L; x++)
    for (let z = -1; z <= (cut ? cutAt + 1 : W); z++) {
      coarse.set(x, H, z, P.roof!);
      if (cut && x >= 0 && x < L && z >= 0) coarse.set(x, 0, z, P.pitch!);
    }
  // a ridge along the middle of the roof, one course proud
  for (let x = 0; x < L; x++) coarse.set(x, H + 1, Math.round(W / 2), P.beam!);

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
  const doorX = Math.round(L * 0.5), doorW = 4, doorH = 6;
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
  for (let x = 2; x < L - 2; x++) {
    coarse.carve(x, H - 1, 0, x, H - 1, 0);
    if (!cut) coarse.carve(x, H - 1, W - 1, x, H - 1, W - 1);
  }

  if (!opts.scenery) return { coarse, fine, door: { x: doorX, height: doorH } };

  // ── the camp: not one word of this is stated ───────────────────────────
  // Everything below is in quarter cubits, four times the coarse numbers.
  const f = (cubits: number) => Math.round(cubits * FINE);
  const groundY = 0;

  // the ramp down from the door to the yard
  const rampFromZ = f(W), rampLen = f(14);
  for (let i = 0; i < rampLen; i++) {
    const y = f(doorH) - Math.round((i / rampLen) * f(doorH));
    fine.box(f(doorX - doorW / 2), y, rampFromZ + i, f(doorX + doorW / 2), y, rampFromZ + i, P.deck!);
  }

  // scaffolding against the hull, as in the reference picture — the ark took
  // a hundred and twenty years, so there is still a stage standing
  for (let x = f(doorX + 12); x < f(doorX + 40); x += f(4)) {
    for (let y = 0; y < f(16); y++) fine.set(x, y, rampFromZ + 2, P.beam!);
    for (let y = f(5); y < f(16); y += f(5))
      fine.box(x, y, rampFromZ, x + f(4), y, rampFromZ + 2, P.beam!);
  }

  // a worn dirt yard in front of the door, one block deep, and a fence round it
  for (let x = f(doorX - 26); x < f(doorX + 26); x++)
    for (let z = rampFromZ; z < rampFromZ + f(26); z++) fine.set(x, groundY - 1, z, P.dirt!);
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

  // hay, because the beasts have to eat for a year (Genesis 6:21)
  for (let i = 0; i < 16; i++) {
    const x = f(doorX - 24) + ((i * 37) % f(48)), z = rampFromZ + f(5) + ((i * 23) % f(18));
    fine.box(x, groundY, z, x + 3, groundY + 2, z + 3, P.hay!);
  }

  // the beasts, two and two (Genesis 7:9), turned toward the ramp
  const pairs: [keyof typeof MODELS, number, number][] = [
    ['elephant', -24, 6], ['giraffe', -22, 15], ['ox', -14, 10], ['camel', 10, 8],
    ['ass', 17, 15], ['lion', 21, 6], ['sheep', -10, 18], ['goat', -6, 12],
    ['ram', 8, 19], ['chicken', 3, 21],
  ];
  for (const [kind, dx, dz] of pairs) {
    const m = MODELS[kind]!;
    const x = f(doorX + dx), z = rampFromZ + f(dz);
    stamp(fine, m, [x, groundY, z], 3);
    stamp(fine, m, [x, groundY, z + f(2.5)], 3);
  }

  // the eight: Noah, his wife, his three sons and their wives (Genesis 7:13)
  const eight: [keyof typeof MODELS, number][] = [
    ['noah', -5], ['noahWife', -3.2], ['son', -1.4], ['sonWife', 0.4],
    ['son', 2.2], ['sonWife', 4], ['son', 5.8], ['sonWife', 7.6],
  ];
  for (const [who, dx] of eight) stamp(fine, MODELS[who]!, [f(doorX + dx), groundY, rampFromZ + f(17)], 3);

  // two still at work on the stage
  stamp(fine, MODELS.worker!, [f(doorX + 14), groundY, rampFromZ + f(3)], 3);
  stamp(fine, MODELS.worker!, [f(doorX + 30), groundY, rampFromZ + f(2)], 2);

  // ── the furniture of a lived-in place ──────────────────────────────────
  // None of this is Scripture and all of it is why the reference picture
  // looks warm: a banner, lamps at the door, tents, trees, and flowers in
  // the grass. A true thing drawn coldly still does not get looked at.

  // a banner on a pole beside the ramp, with a dove on it (Genesis 8:8)
  for (let y = 0; y < f(9); y++) fine.set(f(doorX + 9), groundY + y, rampFromZ + f(1), P.beam!);
  fine.box(f(doorX + 9) + 1, groundY + f(5), rampFromZ + f(1), f(doorX + 9) + 10, groundY + f(8), rampFromZ + f(1), P.robeBlue!);
  fine.box(f(doorX + 9) + 4, groundY + f(6), rampFromZ + f(1) - 1, f(doorX + 9) + 7, groundY + f(7), rampFromZ + f(1) - 1, P.wool!);

  // lamps either side of the door, on posts
  for (const dx of [-doorW / 2 - 2, doorW / 2 + 2]) {
    const x = f(doorX + dx);
    for (let y = 0; y < f(4); y++) fine.set(x, groundY + y, rampFromZ + 1, P.beam!);
    fine.box(x - 1, groundY + f(4), rampFromZ, x + 1, groundY + f(4) + 2, rampFromZ + 2, P.hay!);
  }

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

  // trees: a trunk and a blocky crown, scattered clear of the yard
  const tree = (cx: number, cz: number, h: number) => {
    for (let y = 0; y < h; y++) fine.set(cx, groundY + y, cz, P.trunk!);
    const r = Math.max(2, Math.round(h / 3));
    for (let x = -r; x <= r; x++)
      for (let y = -r; y <= r; y++)
        for (let z = -r; z <= r; z++)
          if (x * x + y * y + z * z <= r * r + 1) fine.set(cx + x, groundY + h + y, cz + z, P.leaf!);
  };
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const x = f(doorX) + side * (f(30) + ((i * 91) % f(90)));
    const z = rampFromZ + f(3) + ((i * 57) % f(30));
    tree(x, z, f(3) + (i % 4));
  }

  // flowers and tufts in the grass, three blocks at a time, so the ground is
  // not one flat green
  const bloom = [P.robeRed!, P.hay!, P.wool!, P.leaf!];
  // A hash, not a modulo. `(i * 131) % width` walks a constant stride and lays
  // the flowers in tidy diagonal rows, which is exactly what a meadow is not.
  const hash = (n: number) => { let h = n * 374761393 + 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
  for (let i = 0; i < 900; i++) {
    const x = f(doorX - 90) + Math.floor(hash(i) * f(180));
    const z = rampFromZ + f(1) + Math.floor(hash(i + 9871) * f(38));
    fine.set(x, groundY, z, bloom[Math.floor(hash(i + 555) * bloom.length)]!);
  }

  // a pond off the near side, with a sandy rim — water is the one thing this
  // whole story is about, and a flat green field never says so
  const pondX = f(doorX - 70), pondZ = rampFromZ + f(22);
  for (let x = -f(9); x <= f(9); x++)
    for (let z = -f(6); z <= f(6); z++) {
      const d = (x * x) / (f(9) * f(9)) + (z * z) / (f(6) * f(6));
      if (d <= 1) fine.set(pondX + x, groundY - 1, pondZ + z, P.water!);
      else if (d <= 1.35) fine.set(pondX + x, groundY - 1, pondZ + z, P.sand!);
    }

  return { coarse, fine, door: { x: doorX, height: doorH } };
}
