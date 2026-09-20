import * as THREE from 'three';

// A WORLD MADE OF BLOCKS, MEASURED IN CUBITS.
//
// The owner asked whether the blocky look is easier than the photographic one.
// It is, and for this app it is also more HONEST, which is the better reason:
// Scripture measures in cubits and never draws anything. A block world has no
// opinion about what the planks looked like — it only claims a count. So the
// grid here is not decorative: ONE BLOCK IS HALF A CUBIT, and every wall,
// deck and door below is placed by the numbers in src/structures/specs.ts.
// Three hundred cubits is six hundred blocks, and you can count them.
//
// Why half a cubit and not one: a man is four cubits tall, and a figure eight
// blocks high can have a head, a body and legs; four blocks cannot. Half a
// cubit is also close to the 0.5 m "block" the eye already reads as a block
// from games, so the scene looks right without being scaled to look right.

/** Blocks per cubit. The whole world is an integer grid in these units. */
export const BPC = 2;

/** The palette. Index, not colour, is stored per block — one byte per block
 *  instead of three floats, and a palette swap re-tints the whole world. */
export const PALETTE: Record<string, number> = {
  gopher: 0xa67447,        // the hull, gopher wood (Gen 6:14)
  gopherDark: 0x9c6c41,    // the same wood in shadow, for plank courses
  pitch: 0x3a2a20,         // "pitch it within and without" — the dark band
  deck: 0xc89a5e,          // deck planking, seen from above
  beam: 0x6f4d2c,          // posts and beams
  roof: 0xc4a070,          // the covering
  door: 0x4a3218,
  grass: 0x9aa254,
  dirt: 0x8a6a45,
  sand: 0xcbb187,
  water: 0x3f7fa6,
  stone: 0x9a968f,
  hay: 0xd9b95c,
  tent: 0xc9bca4,
  tentDark: 0x6d5f4c,
  wool: 0xf2ece0,
  hide: 0x9c6b3f,
  skin: 0xd9a97e,
  robeRed: 0xa2503c,
  robeBlue: 0x41618c,
  robeGreen: 0x5d7a4a,
  robeGrey: 0xb9b2a4,
  hair: 0x4a3a2c,
  hairWhite: 0xe6e1d6,
  leaf: 0x4f7a3a,
  trunk: 0x6b4a2c,
  // the second timber pass: a wall of one brown reads as a slab, so the
  // planking now runs light course / dark course with a seam line between,
  // and the heavy timbers that stand proud of it are darker again
  gopherSeam: 0x6e4a2b,    // the shadow line between two courses of planking
  wale: 0x8a5a30,          // the heavy horizontal timbers down the length
  pitchSeam: 0x3b2c22,     // the same, in the pitched band below the waterline
  lamp: 0xffcf7a,          // a lit lamp, painted bright rather than lit
  lampIron: 0x40352c,
  rope: 0xb9a179,
  ironDark: 0x4a4038,
  post: 0xb07a48,          // the vertical posts, LIGHTER than the planking so
                           // they catch the light instead of reading as gaps
  latticeGlow: 0xffc85a,   // behind the open course under the eave
  // the camp's small things (props.ts) — appended, never reordered, because
  // the index is what a block stores
  clay: 0xb8794d,
  clayDark: 0x8a5535,
  iron: 0x4a4644,
  copper: 0xb8722f,
  sackcloth: 0xa8926a,
  sackDark: 0x7d6a4c,
  straw: 0xe8d283,
  wicker: 0xc79c58,
  fire: 0xff8a2a,
  ember: 0xd23f1c,
  flame: 0xffd452,
  charcoal: 0x2a2320,
  // ── the ground and what grows on it (src/voxel/terrain.ts) ──────────
  // Appended, never reordered: the entries above are referenced by name
  // from the creatures and the ark, and a field is only ever painted from
  // here. Three greens for grass because one green is a billiard table.
  grassLight: 0xb2b062,
  grassDark: 0x7c8447,
  grassDry: 0xc2b46b,
  dirtDark: 0x715539,
  dirtLight: 0xa48c66,
  mud: 0x5f4a33,
  rock: 0x7d7872,
  rockLight: 0xaaa59c,
  moss: 0x5f8f3f,
  waterDeep: 0x2f6b92,
  foam: 0xe9f3f7,
  leafLight: 0x6f9e48,
  leafDark: 0x3d6330,
  pine: 0x2f5f3a,
  pineLight: 0x45784a,
  pineDark: 0x24492d,
  olive: 0x7d9a6a,
  oliveLight: 0xa3b88f,
  bark: 0x8a6b4a,
  palmLeaf: 0x5c9a3e,
  reed: 0x98a44f,
  reedHead: 0x6a4a2e,
  petalPink: 0xe58bb0,
  petalYellow: 0xf1c94c,
  petalPurple: 0x8d6fbe,
  petalBlue: 0x6a94d8,
  petalRed: 0xd1483f,
  lilypad: 0x4f8a3a,
  // ── added for the quarter-cubit creatures (src/voxel/creatures.ts) ──
  // Appended, never reordered: the index is what a block stores.
  eye: 0x1f1a16,           // a one-block dark dot, which is all a face needs
  hoof: 0x3d3229,
  horn: 0xb8a180,          // ram, goat and ox horn — bone, not wood
  udder: 0xe3a89b,
  giraffeCream: 0xe8d6a3,
  giraffeSpot: 0x8f5a2a,
  elephant: 0x8e8c90,      // a cool grey, so it is not the same stone as the yard
  lionTawny: 0xcf9d55,
  mane: 0x7b4b20,
  assGrey: 0x8b8378,
  goatDark: 0x4f3b2b,      // the Syrian goat is dark; a brown goat is a small ox
  camelTan: 0xc7a06b,
  henRust: 0xb56f3a,
  chick: 0xf2d04c,
  comb: 0xd0392b,
  beak: 0xe6b73c,
  robeOchre: 0xc4923f,
  robePlum: 0x6f4b6e,
  linen: 0xe9dfc8,
  girdle: 0x5a3b22,
};
// A typo-proof list of the names, so a block placed with a name that is not in
// the palette fails loudly at build time rather than rendering black.
export type Block = keyof typeof PALETTE;

/** The world: a sparse map of integer block positions to palette colours.
 *
 *  The key is a NUMBER, not "x,y,z". Ambient occlusion asks each block about
 *  its twenty-six neighbours, which on this scene is some two million lookups;
 *  with string keys that is seconds of string building, and with packed
 *  integers it is milliseconds. Coordinates are valid in ±2048 blocks, which
 *  at a quarter cubit to the block is a world half a kilometre across. */
export class Grid {
  private cells = new Map<number, number>();
  private static key(x: number, y: number, z: number) {
    return ((x + 2048) * 4096 + (y + 2048)) * 4096 + (z + 2048);
  }

  get size() { return this.cells.size; }

  set(x: number, y: number, z: number, colour: number) {
    this.cells.set(Grid.key(x | 0, y | 0, z | 0), colour);
  }

  has(x: number, y: number, z: number) { return this.cells.has(Grid.key(x, y, z)); }

  /** A solid box, inclusive of both corners, in BLOCK units. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colour: number) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x <= bx; x++)
      for (let y = ay; y <= by; y++)
        for (let z = az; z <= bz; z++) this.set(x, y, z, colour);
  }

  /** A hollow box: the six faces, nothing inside. Walls of a room, a hull. */
  shell(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    colour: number, opts: { top?: boolean; bottom?: boolean } = {}) {
    const top = opts.top ?? true, bottom = opts.bottom ?? true;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const onSide = x === x0 || x === x1 || z === z0 || z === z1;
          const onTop = y === y1 && top, onBottom = y === y0 && bottom;
          if (onSide || onTop || onBottom) this.set(x, y, z, colour);
        }
  }

  /** Remove blocks — a doorway cut through a wall that is already standing. */
  carve(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.cells.delete(Grid.key(x, y, z));
  }

  /**
   * ONE MESH, ONLY THE FACES YOU CAN SEE, WITH THE CORNERS DARKENED.
   *
   * The first version of this drew every block as an instanced cube: a
   * hundred and thirty thousand cubes, one and a half million triangles, and
   * every one of them lit flat. Blocks looked like painted cardboard, because
   * what makes a block world look SOLID is not the blocks — it is the dirt in
   * the corners. Two changes, both standard in voxel renderers and both worth
   * more than any amount of prop-adding:
   *
   *   · only the faces with nothing in front of them are emitted, which cuts
   *     the triangles by roughly two thirds;
   *   · each face corner is darkened by how much geometry crowds it (the
   *     "ambient occlusion" every Minecraft-alike uses), so an inside corner,
   *     the foot of a wall and the underside of a beam all go dark on their
   *     own, and the eye reads depth.
   *
   * The quad is split along its darker diagonal, without which a face with
   * one dark corner shows an obvious seam.
   */
  build(blockSize: number): { mesh: THREE.Mesh; drawn: number; hidden: number; faces: number } {
    const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
    let drawn = 0, hidden = 0, faces = 0;
    const c = new THREE.Color();

    // The six faces. Each carries its outward normal, the two in-plane axes,
    // and the four corners of the quad wound anticlockwise seen from outside.
    // `ax`/`bx` are which axis index runs across the face — the ambient
    // occlusion below needs them to know where a corner's neighbours are.
    const FACES: { n: [number, number, number]; u: number; v: number; corners: [number, number, number][] }[] = [
      { n: [1, 0, 0], u: 2, v: 1, corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
      { n: [-1, 0, 0], u: 2, v: 1, corners: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]] },
      { n: [0, 1, 0], u: 0, v: 2, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
      { n: [0, -1, 0], u: 0, v: 2, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
      { n: [0, 0, 1], u: 0, v: 1, corners: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]] },
      { n: [0, 0, -1], u: 0, v: 1, corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
    ];
    const at = (b: [number, number, number], d: number[]) => this.has(b[0] + d[0]!, b[1] + d[1]!, b[2] + d[2]!) ? 1 : 0;

    for (const [k, colour] of this.cells) {
      // unpack the numeric key
      const z = (k % 4096) - 2048;
      const y = (((k - (z + 2048)) / 4096) % 4096) - 2048;
      const x = ((k - (z + 2048)) / 4096 - (y + 2048)) / 4096 - 2048;
      const here: [number, number, number] = [x, y, z];

      let anyFace = false;
      for (const face of FACES) {
        const n = face.n;
        if (this.has(x + n[0], y + n[1], z + n[2])) continue;   // that face is buried
        anyFace = true;
        faces++;

        // AMBIENT OCCLUSION, the standard corner rule: step one cell out along
        // the normal, then ask the two neighbours either side of this corner
        // and the one diagonally between them. Two sides filled and the corner
        // is fully dark whatever the diagonal does.
        const ao: number[] = [];
        for (const corner of face.corners) {
          const du = corner[face.u]! * 2 - 1, dv = corner[face.v]! * 2 - 1;
          const o1 = [n[0], n[1], n[2]]; o1[face.u] = o1[face.u]! + du;
          const o2 = [n[0], n[1], n[2]]; o2[face.v] = o2[face.v]! + dv;
          const oc = [n[0], n[1], n[2]]; oc[face.u] = oc[face.u]! + du; oc[face.v] = oc[face.v]! + dv;
          const s1 = at(here, o1), s2 = at(here, o2);
          const level = (s1 && s2) ? 0 : 3 - (s1 + s2 + at(here, oc));
          // THE CURVE MATTERS, AND IT IS NOT LINEAR IN WHAT YOU SEE.
          // A BufferAttribute's colours are in LINEAR space, and three.js
          // converts to sRGB on output — so an evenly spaced ramp lands
          // unevenly on screen. These four values are chosen in linear space
          // to display as roughly 0.66 / 0.79 / 0.90 / 1.00.
          ao.push([0.39, 0.58, 0.79, 1.0][level]!);
        }

        // the block's own shade, hashed off its position, so a wall of one
        // colour still reads as separate planks
        // KILLING THE FLAT FACE. A measurement of our render against the
        // reference counted 1,704 distinct colours in ours against 9,134 in
        // theirs, and found one 32-pixel tile in six to be a single solid
        // colour. Nothing in a painted scene is one flat colour, and the fix
        // costs nothing: two hashes, at two different scales.
        //   · per-block jitter, so no two bricks match;
        //   · a RUN at plank scale, so a wall reads as boards laid in courses
        //     rather than as a field of confetti.
        const h = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
        const run = ((Math.floor(x / 7) * 2654435761) ^ (y * 40503) ^ (Math.floor(z / 7) * 2246822519)) >>> 0;
        const jitter = (0.91 + ((h % 100) / 100) * 0.18) * (0.94 + ((run % 100) / 100) * 0.12);

        const base = pos.length / 3;
        for (let i = 0; i < 4; i++) {
          const corner = face.corners[i]!;
          pos.push((x + corner[0]) * blockSize, (y + corner[1]) * blockSize, (z + corner[2]) * blockSize);
          nor.push(n[0], n[1], n[2]);
          // Shadowed blocks go COOL as well as dark. ephtracy's own face table
          // in MagicaVoxel does the same thing — his lit top is (1.17, 1.15,
          // 1.25) and his shadow side (0.37, 0.35, 0.55), so blue climbs as
          // the face darkens. A purely neutral multiply is what makes voxel
          // ambient occlusion read as soot.
          const a = ao[i]!;
          c.setHex(colour).multiplyScalar(jitter * a);
          const cool = (1 - a) * 0.22;
          col.push(c.r * (1 - cool), c.g * (1 - cool * 0.7), c.b * (1 + cool * 0.5));
        }
        // split the quad along its darker diagonal, or a face with one dark
        // corner shows an obvious seam across it
        if (ao[0]! + ao[2]! > ao[1]! + ao[3]!) {
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        } else {
          idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        }
      }
      if (anyFace) drawn++; else hidden++;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, drawn, hidden, faces };
  }
}
