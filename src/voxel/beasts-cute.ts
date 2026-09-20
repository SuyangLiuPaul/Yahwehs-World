import type { Model } from './creatures.ts';
import type { Block } from './grid.ts';
import { Body } from './beasts-opus.ts';

// THE CUBE-PET STYLE, LEARNED FROM KENNEY'S — second pass.
//
// Kenney's cube-pets giraffe and elephant were taken apart to see what makes
// them charming (about 420 triangles each). They turned out to be:
//
//   · ONE FAT BODY, ROUNDED — a chamfered cube, not a box. The corner radius is
//     large, about a fifth of the body's width, which is what stops it reading
//     as a crate and makes it read as a soft toy.
//   · HUGE EYES, FLAT ON THE FACE — a white disc, a dark pupil, a catch-light.
//   · THREE TONES OF ONE HUE, PAINTED IN — lighter on top, darker underneath.
//   · ONE FEATURE THAT NAMES IT — on the elephant, big ROUND ears and a trunk
//     that tapers; on the giraffe, two knobbed horns, ears and spots.
//
// The first pass had slab ears, a stiff pipe neck and a blocky trunk, and it
// read as a robot. This pass rounds everything: ears are discs, the trunk and
// neck are swept tapered shafts, and the head is its own soft block.

type Tones = [Block, Block, Block];

/** A rounded box: every cell within `r` of the inner box. */
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

const banded = (y0: number, y1: number, t: Tones) => (y: number): Block => {
  const f = (y - y0) / Math.max(1, y1 - y0);
  return f > 0.68 ? t[0] : f > 0.3 ? t[1] : t[2];
};

/** A flat round plate standing out from a side of the body (an ear, a spot). */
function discZ(b: Body, cx: number, cy: number, z: number, radius: number, thick: number, tone: (y: number) => Block) {
  for (let x = -radius; x <= radius; x++)
    for (let y = -radius; y <= radius; y++)
      if (x * x + y * y <= radius * radius + 0.5)
        for (let t = 0; t < thick; t++) b.put(cx + x, cy + y, z + t, tone(cy + y));
}

/** A big cartoon eye on a face at x = faceX, the face looking toward -x. */
function eye(b: Body, faceX: number, cy: number, cz: number, radius: number) {
  for (let y = -radius; y <= radius; y++)
    for (let z = -radius; z <= radius; z++)
      if (y * y + z * z <= radius * radius + 0.6) b.put(faceX - 1, cy + y, cz + z, 'cuteEyeWhite');
  const pr = Math.max(2, Math.round(radius * 0.64));
  const toward = cz > 0 ? -1 : 1;                         // pupils look slightly inward
  for (let y = -pr; y <= pr; y++)
    for (let z = -pr; z <= pr; z++)
      if (y * y + z * z <= pr * pr + 0.5) b.put(faceX - 2, cy + y - 1, cz + z + toward, 'cutePupil');
  b.put(faceX - 3, cy + 1, cz + toward * 2, 'cuteEyeWhite');
  b.put(faceX - 3, cy + 2, cz + toward * 2, 'cuteEyeWhite');
}

// ── the giraffe ──────────────────────────────────────────────────────────
const g = new Body();
{
  const tan: Tones = ['cuteTanTop', 'cuteTan', 'cuteTanDark'];
  for (const [lx, lz] of [[-13, -10], [-13, 10], [13, -10], [13, 10]] as [number, number][]) {
    rbox(g, lx - 4, 0, lz - 4, lx + 4, 16, lz + 4, 2, () => 'cuteHoof');
    rbox(g, lx - 4, 12, lz - 4, lx + 4, 22, lz + 4, 2, () => 'cuteTanDark');     // the leg's top, joining the body
  }
  // a fat, properly rounded body
  rbox(g, -24, 14, -18, 24, 50, 18, 8, banded(14, 50, tan));
  // the neck rises from the front of the body, leaning slightly toward the face
  g.shaft([-16, 44, 0], [-24, 76, 0], 9.5, 7.2, 'cuteTan');
  // the head: a soft rounded block with the face on -x
  rbox(g, -46, 68, -15, -14, 96, 15, 8, banded(68, 96, tan));
  eye(g, -46, 84, -8, 5);
  eye(g, -46, 84, 8, 5);
  rbox(g, -50, 72, -6, -44, 79, 6, 3, () => 'cuteNose');                         // the muzzle
  g.put(-51, 76, -3, 'cutePupil'); g.put(-51, 76, 3, 'cutePupil');               // nostrils
  for (const s of [-1, 1]) {
    g.shaft([-28, 96, s * 8], [-28, 103, s * 8], 1.6, 1.4, 'cuteTan');           // horn
    g.blob(-28, 105, s * 8, 3.0, 2.6, 3.0, 'cuteHoof');                          // its round knob
    discZ(g, -22, 88, s > 0 ? 15 : -18, 5, 3, () => 'cuteTanDark');             // ear
  }
  g.shaft([24, 40, 0], [30, 30, 0], 2.0, 1.6, 'cuteTanDark');                    // tail
  // spots, painted only where the animal exists, in a lattice with jitter
  const spots: [number, number, number, number][] = [
    [-4, 42, 18, 5], [10, 30, 18, 5], [-16, 26, 18, 4], [16, 44, 18, 4], [2, 22, 18, 3.5],
    [-2, 36, -18, 5], [12, 26, -18, 5], [-14, 42, -18, 4], [6, 46, 4, 4],
    [-26, 60, 8, 4], [-26, 72, -8, 4], [-28, 84, 8, 3.5], [-34, 90, -14, 4], [-38, 76, 15, 4.5],
  ];
  for (const [sx, sy, sz, sr] of spots)
    for (const c of g.all())
      if ((c.block === 'cuteTan' || c.block === 'cuteTanTop' || c.block === 'cuteTanDark') &&
          Math.hypot(c.x - sx, c.y - sy, c.z - sz) < sr) g.paint(c.x, c.y, c.z, 'cutePatch');
}
export const GIRAFFE_CUTE: Model = { height: 108, boxes: g.boxes() };

// ── the elephant ─────────────────────────────────────────────────────────
const e = new Body();
{
  const grey: Tones = ['cuteGreyTop', 'cuteGrey', 'cuteGreyDark'];
  for (const [lx, lz] of [[-12, -14], [-12, 14], [20, -14], [20, 14]] as [number, number][])
    rbox(e, lx - 7, 0, lz - 7, lx + 7, 15, lz + 7, 3, () => 'cuteLegGrey');
  // one big rounded body, and the head as a second rounded block in front
  rbox(e, -8, 12, -22, 36, 50, 22, 8, banded(12, 50, grey));
  rbox(e, -40, 16, -19, -6, 54, 19, 9, banded(16, 54, grey));
  eye(e, -40, 42, -10, 5);
  eye(e, -40, 42, 10, 5);
  // the trunk: a tapered shaft hanging from the middle of the face, curling out at the tip
  e.shaft([-40, 30, 0], [-46, 16, 0], 7.0, 5.4, 'cuteGrey');
  e.shaft([-46, 16, 0], [-52, 6, 0], 5.4, 4.0, 'cuteGreyDark');
  e.blob(-53, 5, 0, 4.4, 3.2, 4.4, 'cuteGreyDark');
  for (const s of [-1, 1]) {
    e.shaft([-42, 26, s * 10], [-52, 22, s * 12], 2.1, 1.3, 'cuteTusk');        // tusk
    // BIG ROUND EARS, standing proud of the sides of the head — the feature
    discZ(e, -16, 38, s > 0 ? 19 : -25, 13, 6, () => 'cuteGreyDark');
    discZ(e, -16, 38, s > 0 ? 24 : -26, 9, 1, () => 'cuteGrey');               // the lighter inside of the ear
  }
  e.shaft([36, 32, 0], [42, 22, 0], 2.2, 1.6, 'cuteGreyDark');                  // tail
}
export const ELEPHANT_CUTE: Model = { height: 56, boxes: e.boxes() };
