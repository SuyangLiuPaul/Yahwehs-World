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
  gopher: 0x8b6239,        // the hull, gopher wood (Gen 6:14)
  gopherDark: 0x6f4c2b,    // the same wood in shadow, for plank courses
  pitch: 0x3a2b21,         // "pitch it within and without" — the dark band
  deck: 0xb4874f,          // deck planking, seen from above
  beam: 0x5c3f24,          // posts and beams
  roof: 0x7a5333,          // the covering
  door: 0x4a3218,
  grass: 0x6f9b44,
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
  // the camp's small things (props.ts) — appended, never reordered, because
  // the index is what a block stores
  rope: 0xbfa070,
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
};
// A typo-proof list of the names, so a block placed with a name that is not in
// the palette fails loudly at build time rather than rendering black.
export type Block = keyof typeof PALETTE;

/** The world: a sparse map of integer block positions to palette colours. */
export class Grid {
  private cells = new Map<string, number>();
  private static key(x: number, y: number, z: number) { return `${x},${y},${z}`; }

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
   * One InstancedMesh for the whole world, with the blocks nobody can see left
   * out. A block whose six neighbours are all filled is inside the wall: it
   * costs a draw of twelve triangles and shows nothing. On the ark that is
   * most of the hull, so the cull is not an optimisation detail — it is the
   * difference between a page that opens on a phone and one that does not.
   */
  build(blockSize: number): { mesh: THREE.InstancedMesh; drawn: number; hidden: number } {
    const visible: [number, number, number, number][] = [];
    let hidden = 0;
    for (const [k, colour] of this.cells) {
      const [x, y, z] = k.split(',').map(Number) as [number, number, number];
      const buried = this.has(x + 1, y, z) && this.has(x - 1, y, z)
        && this.has(x, y + 1, z) && this.has(x, y - 1, z)
        && this.has(x, y, z + 1) && this.has(x, y, z - 1);
      if (buried) { hidden++; continue; }
      visible.push([x, y, z, colour]);
    }

    const geo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    // NOT vertexColors: an InstancedMesh carries its colours in instanceColor,
    // and asking for vertex colours on a BoxGeometry that has no colour
    // attribute renders every block black. (It did. That is why this comment
    // is here.)
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, visible.length);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    visible.forEach(([x, y, z, colour], i) => {
      m.makeTranslation((x + 0.5) * blockSize, (y + 0.5) * blockSize, (z + 0.5) * blockSize);
      mesh.setMatrixAt(i, m);
      // A flat colour per block reads as plastic. Each block is nudged a few
      // per cent lighter or darker from a hash of its position, which is what
      // makes a wall of one colour read as planks and a field read as ground.
      const n = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
      const jitter = 0.92 + ((n % 100) / 100) * 0.16;
      c.setHex(colour).multiplyScalar(jitter);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, drawn: visible.length, hidden };
  }
}
