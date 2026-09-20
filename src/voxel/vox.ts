import type { Grid } from './grid.ts';

// BLOCK MODELS THAT CAME FROM REAL MODELS.
//
// The creatures in creatures.ts are typed out by hand, a box at a time, and it
// shows: a hand-built sheep is forty blocks and reads as a lump. These are the
// other route — a real mesh run through tools/voxel/voxelise.py in Blender and
// written out as a block list. The sheep below is six hundred and eighty-two
// blocks and has ears, a fleece and feet.
//
// The meshes are the CC0 packs found in the asset search (Quaternius), free for
// commercial use; provenance is recorded in handoff/MANIFEST-assets.md. The
// point is not that they are free — it is that an animal's PROPORTIONS are the
// hard part, and those are already right in a modelled animal.
//
// One block here is an eighth of a cubit (0.0556 m), which is the scene's fine
// grid: a sheep sixteen blocks tall, a man thirty-two.

export interface VoxModel {
  name: string;
  /** width, height, depth in blocks. */
  size: [number, number, number];
  /** x, y, z, colour — colour is a plain 0xRRGGBB, already in sRGB. */
  blocks: [number, number, number, number][];
  source?: string;
}

const cache = new Map<string, Promise<VoxModel | null>>();

/** Loads one voxelised model. A missing file is not an error: the scene falls
 *  back to the hand-built creature, so a half-finished set still renders. */
export function loadVox(name: string): Promise<VoxModel | null> {
  let got = cache.get(name);
  if (!got) {
    got = fetch(`/models/vox/${name}.json`)
      .then((r) => (r.ok ? r.json() as Promise<VoxModel> : null))
      .catch(() => null);
    cache.set(name, got);
  }
  return got;
}

/** Loads several, and hands back only the ones that exist. */
export async function loadVoxSet(names: string[]): Promise<Record<string, VoxModel>> {
  const got = await Promise.all(names.map((n) => loadVox(n)));
  const out: Record<string, VoxModel> = {};
  names.forEach((n, i) => { const m = got[i]; if (m) out[n] = m; });
  return out;
}

/**
 * Stamps a voxelised model into the world.
 *
 * The model is centred on x and z and stood on `at`'s y, the same rule
 * loadFigure() uses for the app's other models — a thing whose feet are not on
 * the ground is the one fault this project never tolerates.
 *
 * `turn` is quarter turns, so a pair can face each other and a queue can face
 * the ramp.
 */
export function stampVox(grid: Grid, model: VoxModel, at: [number, number, number], turn = 0, scale = 1) {
  const [ox, oy, oz] = at;
  const [w, , d] = model.size;
  const cx = Math.floor(w / 2), cz = Math.floor(d / 2);
  for (const [bx, by, bz, colour] of model.blocks) {
    const x = bx - cx, z = bz - cz;
    const [rx, rz] = turn === 0 ? [x, z] : turn === 1 ? [-z, x] : turn === 2 ? [-x, -z] : [z, -x];
    if (scale === 1) {
      grid.set(ox + rx, oy + by, oz + rz, colour);
    } else {
      for (let sx = 0; sx < scale; sx++)
        for (let sy = 0; sy < scale; sy++)
          for (let sz = 0; sz < scale; sz++)
            grid.set(ox + rx * scale + sx, oy + by * scale + sy, oz + rz * scale + sz, colour);
    }
  }
}
