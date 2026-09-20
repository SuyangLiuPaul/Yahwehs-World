import { type Block, type Grid, PALETTE } from './grid.ts';

// THE LIVING THINGS, AS BLOCKS.
//
// Each one is a short list of boxes in its own local grid, written the way a
// child builds an animal out of bricks: a body, four legs, a head, and the one
// feature that tells you what it is — the giraffe's neck, the elephant's
// trunk, the ram's horn. They are deliberately crude. A blocky sheep is
// honest about being a toy; a photographic sheep is a claim about a sheep.
//
// SCALE. One block is half a cubit (grid.ts). A man is four cubits, so eight
// blocks: two of leg, three of body, one of neck, two of head. Every creature
// below is sized against that man, so a camel really does stand over a sheep
// the way it does in the field, and the sizes carry the same numbers the
// register in src/walk/figures.ts already states in metres.

/** One box of a creature: from corner to corner, in the creature's own grid. */
export type Box = [number, number, number, number, number, number, Block];

export interface Model {
  /** How many blocks tall, for placing it on the ground and for the label. */
  height: number;
  boxes: Box[];
}

// ── people ───────────────────────────────────────────────────────────────
// Eight blocks: legs 0–1, robe 2–4, head 6–7. The robe is one block wider
// than the shoulders, which is what makes a blocky figure read as a person in
// a robe rather than a person in a suit.
const person = (robe: Block, hair: Block, beard = true): Model => ({
  height: 8,
  boxes: [
    [1, 0, 1, 1, 1, 2, 'skin'], [3, 0, 1, 3, 1, 2, 'skin'],      // feet and shins
    [0, 2, 0, 4, 4, 3, robe],                                     // the robe, to the ankle
    [0, 5, 1, 4, 5, 2, robe],                                     // shoulders
    [0, 3, 1, 0, 4, 2, 'skin'], [4, 3, 1, 4, 4, 2, 'skin'],       // hands at the hem
    [1, 6, 1, 3, 7, 2, 'skin'],                                   // head
    [1, 7, 0, 3, 7, 3, hair],                                     // hair over the crown
    ...(beard ? [[1, 6, 0, 3, 6, 0, hair] as Box] : []),          // beard, on the face side
  ],
});

// ── beasts ───────────────────────────────────────────────────────────────
const quadruped = (opts: {
  body: Block; legs?: Block; length: number; height: number; width: number;
  legLen: number; head: Block; horn?: Block; tail?: boolean;
  /** a camel's hump, a lion's mane — the one feature that names the animal */
  hump?: boolean; mane?: Block; snout?: boolean;
}): Model => {
  const { body, legs = body, length, height, width, legLen, head, horn } = opts;
  const top = legLen + height - 1;
  const mid = Math.floor(width / 2);
  const boxes: Box[] = [
    [0, legLen, 0, length - 1, top, width - 1, body],                       // barrel
    // legs INSET from the corners by one: legs flush with the ends read as a
    // table, and a table does not look like an animal.
    [0, 0, 0, 0, legLen - 1, 0, legs], [0, 0, width - 1, 0, legLen - 1, width - 1, legs],
    [length - 2, 0, 0, length - 2, legLen - 1, 0, legs],
    [length - 2, 0, width - 1, length - 2, legLen - 1, width - 1, legs],
    [-1, top - 1, 0, -1, top, width - 1, head],                             // head over the front legs
    [-1, top + 1, 0, -1, top + 1, 0, head], [-1, top + 1, width - 1, -1, top + 1, width - 1, head],  // ears
  ];
  if (opts.snout) boxes.push([-2, top - 1, mid, -2, top - 1, mid, head]);
  if (horn) boxes.push([-1, top + 2, 0, -1, top + 2, width - 1, horn]);
  if (opts.hump) boxes.push([1, top + 1, 0, 3, top + 1, width - 1, body]);
  if (opts.mane) boxes.push([0, top - 1, 0, 0, top + 1, width - 1, opts.mane], [-1, top + 1, 0, -1, top + 1, width - 1, opts.mane]);
  if (opts.tail) boxes.push([length, legLen + 1, mid, length, top, mid, body]);
  return { height: top + (horn ? 3 : 2), boxes };
};

export const MODELS: Record<string, Model> = {
  // the eight of Genesis 7:13 — Noah, his wife, his three sons and their wives
  noah: person('robeRed', 'hairWhite'),
  noahWife: person('robeBlue', 'hairWhite', false),
  son: person('robeGreen', 'hair'),
  sonWife: person('robeGrey', 'hair', false),
  worker: person('robeGrey', 'hair'),

  sheep: quadruped({ body: 'wool', legs: 'hide', length: 4, height: 2, width: 2, legLen: 2, head: 'wool' }),
  ram: quadruped({ body: 'wool', legs: 'hide', length: 4, height: 2, width: 2, legLen: 2, head: 'wool', horn: 'hide' }),
  goat: quadruped({ body: 'hide', legs: 'hide', length: 4, height: 2, width: 2, legLen: 2, head: 'hide', horn: 'beam' }),
  ox: quadruped({ body: 'hide', legs: 'beam', length: 6, height: 3, width: 3, legLen: 3, head: 'hide', horn: 'wool', tail: true }),
  ass: quadruped({ body: 'stone', legs: 'stone', length: 5, height: 2, width: 2, legLen: 3, head: 'stone', tail: true, snout: true }),
  camel: quadruped({ body: 'sand', legs: 'sand', length: 6, height: 3, width: 2, legLen: 5, head: 'sand', tail: true, hump: true, snout: true }),
  lion: quadruped({ body: 'hay', legs: 'hay', length: 5, height: 2, width: 3, legLen: 2, head: 'hide', tail: true, mane: 'hide' }),

  // the two the picture leads with, because they say "every kind" at a glance
  elephant: {
    height: 9,
    boxes: [
      [0, 4, 0, 6, 7, 4, 'stone'],                                  // body
      [0, 0, 0, 1, 3, 1, 'stone'], [0, 0, 3, 1, 3, 4, 'stone'],
      [5, 0, 0, 6, 3, 1, 'stone'], [5, 0, 3, 6, 3, 4, 'stone'],     // four legs
      [-2, 4, 1, -1, 7, 3, 'stone'],                                // head
      [-2, 5, 0, -1, 6, 0, 'stone'], [-2, 5, 4, -1, 6, 4, 'stone'], // ears
      [-3, 1, 2, -2, 4, 2, 'stone'],                                // trunk
      [-3, 3, 1, -3, 3, 1, 'wool'], [-3, 3, 3, -3, 3, 3, 'wool'],   // tusks
    ],
  },
  giraffe: {
    height: 14,
    boxes: [
      [0, 6, 0, 4, 8, 2, 'hay'],                                    // body
      [0, 0, 0, 0, 5, 0, 'hay'], [0, 0, 2, 0, 5, 2, 'hay'],
      [4, 0, 0, 4, 5, 0, 'hay'], [4, 0, 2, 4, 5, 2, 'hay'],         // long legs
      [-1, 9, 1, -1, 12, 1, 'hay'],                                 // neck
      [-2, 12, 1, -1, 13, 1, 'hay'],                                // head
    ],
  },
  dove: { height: 2, boxes: [[0, 0, 0, 1, 1, 0, 'wool'], [-1, 1, 0, -1, 1, 0, 'wool']] },
  chicken: { height: 3, boxes: [[0, 1, 0, 1, 2, 1, 'wool'], [0, 0, 0, 0, 0, 0, 'hay'], [1, 0, 1, 1, 0, 1, 'hay'], [-1, 2, 0, -1, 2, 1, 'robeRed']] },
};

/** Stamps a model into the world at a block position, turned in quarter turns
 *  so a pair can face each other and a queue can face the ramp.
 *
 *  `scale` expands every authored block into a cube of that many world blocks.
 *  The models above are written at two blocks to the cubit because that is the
 *  size a person is comfortable to draw at; the world's fine grid is four, so
 *  the default doubles them and a man comes out sixteen blocks tall. */
export function stamp(grid: Grid, model: Model, at: [number, number, number], turn = 0, scale = 2) {
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
