import type { Model } from './creatures.ts';
import type { Block } from './grid.ts';
import { Body } from './beasts-opus.ts';

// THE CUBE-PET STYLE, LEARNED FROM KENNEY'S.
//
// Kenney's cube-pets giraffe and elephant were taken apart to see what makes
// them charming (about 420 triangles each). What they turned out to be:
//
//   · ONE BODY, NOT PARTS. The whole animal is a single chamfered cube with the
//     face on its front, standing on four stubby leg cubes. There is no neck
//     and no separate head. Proportion is the joke.
//   · HUGE EYES, FLAT ON THE FACE. A white disc, a dark pupil, a tiny highlight,
//     each eye about a fifth of the animal's height. That is nearly all of the
//     expression; the mouth is a single small nose block.
//   · THREE TONES OF ONE HUE, PAINTED IN. Lighter on top, darker underneath,
//     picked from a tiny palette rather than lit — which is why they read as
//     soft even in flat lighting.
//   · THE ONE FEATURE THAT NAMES IT. Two knobbed horns and a few spots for the
//     giraffe; a snout, two white tusks and side-plate ears for the elephant.
//
// This applies those four rules at the scene's block size and keeps the real
// registered heights (giraffe 94 blocks, elephant 56). Cube-pets ignore scale
// entirely; this one cannot, and the giraffe therefore gets a thick short neck
// that Kenney's does not have — at five metres a giraffe with no neck at all
// stops being recognisable.

type Tones = [Block, Block, Block];   // top, side, underside

/** A rounded box: every cell within `r` of the inner box, so the corners are
 *  chamfered and it never reads as a razor-edged crate. */
function rbox(b: Body, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  r: number, tone: (y: number) => Block) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        const cx = Math.min(Math.max(x, x0 + r), x1 - r);
        const cy = Math.min(Math.max(y, y0 + r), y1 - r);
        const cz = Math.min(Math.max(z, z0 + r), z1 - r);
        if (Math.hypot(x - cx, y - cy, z - cz) <= r + 0.35) b.put(x, y, z, tone(y));
      }
}

/** Top third light, middle mid, bottom third dark — the painted shading. */
const banded = (y0: number, y1: number, t: Tones) => (y: number): Block => {
  const f = (y - y0) / Math.max(1, y1 - y0);
  return f > 0.68 ? t[0] : f > 0.3 ? t[1] : t[2];
};

/** A big flat cartoon eye on a face at x = faceX (the face looks toward -x). */
function eye(b: Body, faceX: number, cy: number, cz: number, radius: number) {
  for (let y = -radius; y <= radius; y++)
    for (let z = -radius; z <= radius; z++)
      if ((y * y) / (radius * radius) + (z * z) / (radius * radius) <= 1.05) b.put(faceX - 1, cy + y, cz + z, 'cuteEyeWhite');
  const pr = Math.max(2, Math.round(radius * 0.62));
  for (let y = -pr; y <= pr; y++)
    for (let z = -pr; z <= pr; z++)
      if (y * y + z * z <= pr * pr + 0.5) { b.put(faceX - 2, cy + y - 1, cz + z + (cz > 0 ? -1 : 1), 'cutePupil'); }
  b.put(faceX - 3, cy + 1, cz + (cz > 0 ? -2 : 2), 'cuteEyeWhite');      // the catch-light
}

// ── the giraffe ──────────────────────────────────────────────────────────
const g = new Body();
{
  const tan: Tones = ['cuteTanTop', 'cuteTan', 'cuteTanDark'];
  // four stubby legs
  for (const [lx, lz] of [[-14, -9], [-14, 9], [14, -9], [14, 9]] as [number, number][])
    rbox(g, lx - 4, 0, lz - 4, lx + 4, 15, lz + 4, 1, () => 'cuteHoof');
  // the body — one fat chamfered cube
  rbox(g, -22, 12, -16, 22, 46, 16, 3, banded(12, 46, tan));
  // a short thick neck, then the big head with the face on the front
  rbox(g, -28, 40, -8, -14, 74, 8, 2, banded(40, 74, tan));
  rbox(g, -40, 66, -14, -16, 90, 14, 3, banded(66, 90, tan));
  // the face: enormous eyes, a nose block, two nostril dots
  eye(g, -40, 80, -7, 5);
  eye(g, -40, 80, 7, 5);
  g.box(-43, 70, -5, -40, 75, 5, 'cuteNose');
  g.put(-44, 73, -2, 'cutePupil'); g.put(-44, 73, 2, 'cutePupil');
  // two knobbed horns and two small ears
  for (const s of [-1, 1]) {
    g.box(-27, 90, s * 6 - 1, -26, 95, s * 6, 'cuteTan');
    g.box(-28, 96, s * 6 - 2, -25, 98, s * 6 + 1, 'cuteHoof');
    g.box(-24, 82, s * 14, -22, 87, s * 15, 'cuteTanDark');
  }
  g.box(20, 32, -1, 25, 34, 1, 'cuteTanDark');                             // a stub of a tail
  // the spots: darker patches painted only onto cells that exist
  const spots: [number, number, number][] = [
    [-4, 38, 16], [10, 26, 16], [-14, 22, 16], [16, 40, 16], [0, 30, -16], [12, 34, -16], [-12, 40, -16],
    [-22, 56, 8], [-22, 66, -8], [-22, 50, -8], [-30, 84, 14], [-26, 74, -14], [4, 46, 4], [-6, 46, -8], [12, 46, 8],
  ];
  for (const [sx, sy, sz] of spots)
    for (const c of g.all())
      if ((c.block === 'cuteTan' || c.block === 'cuteTanTop' || c.block === 'cuteTanDark') &&
          Math.hypot(c.x - sx, c.y - sy, c.z - sz) < 4.6) g.paint(c.x, c.y, c.z, 'cutePatch');
}
export const GIRAFFE_CUTE: Model = { height: 98, boxes: g.boxes() };

// ── the elephant ─────────────────────────────────────────────────────────
const e = new Body();
{
  const grey: Tones = ['cuteGreyTop', 'cuteGrey', 'cuteGreyDark'];
  for (const [lx, lz] of [[-12, -13], [-12, 13], [18, -13], [18, 13]] as [number, number][])
    rbox(e, lx - 6, 0, lz - 6, lx + 6, 14, lz + 6, 2, () => 'cuteLegGrey');
  // the body behind, and a HEAD in front of it — a second, taller block, so the
  // animal has the two-mass silhouette that says "elephant" before any detail
  rbox(e, -14, 12, -20, 30, 48, 20, 4, banded(12, 48, grey));
  rbox(e, -42, 16, -17, -12, 52, 17, 4, banded(16, 52, grey));
  // the face on the front of the head, x = -42: two huge eyes above a trunk
  eye(e, -42, 40, -9, 5);
  eye(e, -42, 40, 9, 5);
  rbox(e, -62, 6, -6, -42, 34, 6, 2, () => 'cuteGrey');                     // the trunk, hanging
  e.box(-65, 6, -5, -62, 12, 5, 'cuteGreyDark');                            // its darker tip
  for (const s of [-1, 1]) {
    e.box(-54, 24, s * 11 - 1, -43, 27, s * 11 + 1, 'cuteTusk');            // two short white tusks
    e.box(-56, 25, s * 11 - 1, -54, 29, s * 11 + 1, 'cuteTusk');
    // ears: big flat plates on the sides of the head, standing proud of it
    rbox(e, -36, 28, s > 0 ? 17 : -25, -14, 56, s > 0 ? 25 : -17, 2, () => 'cuteGreyDark');
  }
  e.box(30, 26, -2, 38, 40, 2, 'cuteGreyDark');                            // the tail
}
export const ELEPHANT_CUTE: Model = { height: 56, boxes: e.boxes() };
