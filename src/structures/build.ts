import * as THREE from 'three';
import { metres, type Structure } from './specs.ts';
import { buildMenorah, type BranchForm } from './menorah.ts';
import { buildCherub } from './cherub.ts';
import { buildPillar, buildSea } from './temple-parts.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Geometry is generated from the stated dimensions, never modelled by hand.
// The consequence that matters: move the cubit slider and every structure
// rebuilds at the new scale, because nothing here is baked.

const GOLD = 0xc9a227;
const ACACIA = 0x6b4f2a;
const LINEN = 0xe5d8bd;
const BRONZE = 0x8a6a3a;

const mat = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });

const box = (w: number, h: number, d: number, m: THREE.Material) =>
  new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.06), m);

/** A 1.7 m figure, so a metre reads as a metre. Every card gets one, even the
 *  ones where it becomes a single pixel — that is the point of those cards. */
export function humanFigure(): THREE.Group {
  const g = new THREE.Group();
  const skin = mat(0x2f3a46, { roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.72, 4, 10), skin);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), skin);
  head.position.y = 1.58;
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 4, 10), skin);
  legs.position.y = 0.36;
  g.add(body, head, legs);
  return g;
}

export function buildStructure(s: Structure, cubitM: number, form: BranchForm = 'arch'): THREE.Group {
  const g = new THREE.Group();
  const d = (key: string) => {
    const dim = s.dims.find((x) => x.key === key);
    return dim ? metres(dim.cubits, s, cubitM) : 0;
  };
  const L = d('length'), W = d('width'), H = d('height');

  switch (s.kind) {
    case 'ark': {
      // Genesis gives three numbers and three decks; a hull shape it does not
      // give, so the ark is built as the box the text describes.
      const hull = box(L, H, W, mat(ACACIA, { roughness: 0.85 }));
      hull.position.y = H / 2;
      g.add(hull);
      // "Lower, second, and third decks" — Genesis 6:16.
      for (let i = 1; i < 3; i++) {
        const deck = box(L * 1.002, H * 0.012, W * 1.002, mat(0x4a3720));
        deck.position.y = (H / 3) * i;
        g.add(deck);
      }
      // "Put a door in the side of the ark" — Genesis 6:16.
      const door = box(H * 0.09, H * 0.16, W * 1.01, mat(0x2b1f12));
      door.position.set(L * 0.18, H * 0.16, 0);
      g.add(door);
      break;
    }
    case 'chest': {
      // The chest itself, overlaid within and without — Exodus 25:11.
      const shell = mat(GOLD, { metalness: 0.88, roughness: 0.26 });
      const bright = mat(GOLD, { metalness: 0.95, roughness: 0.18 });
      const chest = box(L, H, W, shell);
      chest.position.y = H / 2;
      g.add(chest);
      // "A gold moulding around it" (25:11): a raised rim at the lip and a
      // second at the foot, so the box has an edge the eye can find. A plain
      // gold cuboid at nine cubits reads as a slab; the rims are what make
      // it read as a chest.
      const rim = (y: number, t: number) => {
        const frame = new THREE.Group();
        const d = t;
        for (const [w, dd, x, z] of [
          [L + 2 * d, d, 0, W / 2 + d / 2], [L + 2 * d, d, 0, -(W / 2 + d / 2)],
          [d, W, L / 2 + d / 2, 0], [d, W, -(L / 2 + d / 2), 0],
        ] as [number, number, number, number][]) {
          const m = box(w, t, dd, bright); m.position.set(x, y, z); frame.add(m);
        }
        return frame;
      };
      g.add(rim(H - H * 0.03, H * 0.06));
      g.add(rim(H * 0.09, H * 0.05));
      // Four feet with four rings (25:12), the poles through the rings on the
      // two long sides (25:13-14) — low, under the lip, where the text puts
      // them, and never taken out (25:15).
      const ringR = H * 0.09;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const foot = box(H * 0.14, H * 0.12, H * 0.14, bright);
        foot.position.set(sx * (L / 2 - H * 0.07), H * 0.06, sz * (W / 2 - H * 0.07));
        g.add(foot);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, H * 0.022, 10, 24), bright);
        ring.rotation.y = Math.PI / 2;   // hoop in the y-z plane so a pole along x threads it
        ring.position.set(sx * (L / 2 - H * 0.07), H * 0.18, sz * (W / 2 + H * 0.13));
        g.add(ring);
      }
      for (const sz of [-1, 1]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(H * 0.04, H * 0.04, L * 1.7, 12), shell);
        pole.rotation.z = Math.PI / 2;
        pole.position.set(0, H * 0.18, sz * (W / 2 + H * 0.13));
        g.add(pole);
        for (const sx of [-1, 1]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(H * 0.055, 12, 10), bright);
          cap.position.set(sx * L * 0.85, H * 0.18, sz * (W / 2 + H * 0.13));
          g.add(cap);
        }
      }
      // The mercy seat, its own slab on top, the same length and width as the
      // ark — Exodus 25:17 — with its own lip.
      const seat = box(L, H * 0.07, W, bright);
      seat.position.y = H + H * 0.035;
      g.add(seat);
      const seatTop = H + H * 0.07;
      // Two cherubim of hammered gold at the two ends of the mercy seat, of
      // one piece with it, wings spread upward and overshadowing it, faces
      // toward each other — Exodus 25:18-20. The text gives posture and
      // nothing else, so each is a kneeling figure — thighs, torso, head, two
      // long wings raised and swept in to meet over the seat — enough to be
      // read as a winged figure from the veil, which two domes were not.
      const cherubMat = mat(GOLD, { metalness: 0.96, roughness: 0.2, side: THREE.DoubleSide });
      for (const sx of [-1, 1]) {
        const cherub = buildCherub(H,cherubMat);
        cherub.position.set(sx * L * 0.38, seatTop, 0);
        cherub.rotation.y = sx > 0 ? Math.PI : 0;   // faces toward each other
        g.add(cherub);
      }
      break;
    }
    case 'court': {
      // Linen curtains on posts, open at the top — Exodus 27:9-18.
      const curtain = mat(LINEN, { roughness: 0.9, side: THREE.DoubleSide });
      const walls: [number, number, number, number, number][] = [
        [L, H, 0.02, 0, W / 2], [L, H, 0.02, 0, -W / 2],
      ];
      for (const [w, h, t, x, z] of walls) {
        const m = box(w, h, t, curtain); m.position.set(x, h / 2, z); g.add(m);
      }
      for (const sx of [-1, 1]) {
        const m = box(0.02, H, W, curtain); m.position.set(sx * L / 2, H / 2, 0); g.add(m);
      }
      const postCount = 20;
      for (let i = 0; i <= postCount; i++) {
        for (const sz of [-1, 1]) {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(H * 0.035, H * 0.035, H * 1.06, 8), mat(BRONZE, { metalness: 0.6 }));
          post.position.set(-L / 2 + (L / postCount) * i, H * 0.53, sz * W / 2);
          g.add(post);
        }
      }
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(L, W), mat(0xb9a888, { roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = 0.005;
      g.add(ground);
      break;
    }
    case 'cube': {
      // "As wide and high as it is long" — the verse's whole shock is that the
      // third number is the same as the first two.
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(L, H, W),
        mat(GOLD, { metalness: 0.35, roughness: 0.15, transparent: true, opacity: 0.13 }),
      );
      cube.position.y = H / 2;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(cube.geometry),
        new THREE.LineBasicMaterial({ color: 0xe8c55a, transparent: true, opacity: 0.85 }),
      );
      edges.position.y = H / 2;
      g.add(cube, edges);
      break;
    }
    case 'menorah': {
      // No dimension in the passage, so the height is the card's assumption and
      // is labelled as one. Everything else is counted from the text.
      const { group } = buildMenorah(s.assumedHeight ?? 1.5, form);
      g.add(group);
      break;
    }
    case 'templeHouse': {
      // Massing only: house 60×20×30 with a 10-cubit porch and a 20-cubit
      // cube marked at the rear. The walkable temple carries the rooms.
      const wall = mat(0xcfc0a0, { roughness: 0.9 });
      const body = box(L, H, W, wall);
      body.position.y = H / 2;
      g.add(body);
      const porchD = d('porchDepth') || 0;
      if (porchD) {
        const porch = box(porchD, H * 0.92, W, wall);
        porch.position.set(L / 2 + porchD / 2, H * 0.46, 0);
        g.add(porch);
      }
      const debir = d('debir') || 0;
      if (debir) {
        // The most holy place is a cube at the rear — drawn as a gold wire
        // volume so the reader can see the 20×20×20 inside the 60×20×30.
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(debir, debir, W),
          mat(GOLD, { metalness: 0.4, roughness: 0.2, transparent: true, opacity: 0.14 }),
        );
        cube.position.set(-L / 2 + debir / 2, debir / 2, 0);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(cube.geometry),
          new THREE.LineBasicMaterial({ color: 0xe8c55a, transparent: true, opacity: 0.9 }),
        );
        edges.position.copy(cube.position);
        g.add(cube, edges);
      }
      break;
    }
    case 'bronzePillar': {
      // The same pillar the walk stands before — capital, net, two rows of
      // pomegranates, lily-work — at the Kings height; the 35-cubit
      // Chronicles reading is named on the card, not drawn twice.
      const cub = (key: string) => s.dims.find((x) => x.key === key)?.cubits ?? 0;
      const kings = s.counts?.find((c) => c.ref.startsWith('王上'))?.n ?? 200;
      const { group } = buildPillar(
        { cubit: cubitM, height: cub('height'), girth: cub('girth'), capital: cub('capital'), pomegranates: kings },
        mat(BRONZE, { metalness: 0.85, roughness: 0.45 }));
      g.add(group);
      break;
    }
    case 'bronzeSea': {
      // 10 across, 5 high, 30 around, on twelve oxen — the walk's own sea.
      const cub = (key: string) => s.dims.find((x) => x.key === key)?.cubits ?? 0;
      const { group } = buildSea(
        { cubit: cubitM, diameter: cub('diameter'), height: cub('height'), girth: cub('girth') },
        mat(BRONZE, { metalness: 0.88, roughness: 0.4 }));
      g.add(group);
      break;
    }
    default: {
      const m = box(L || 1, H || 1, W || 1, mat(0x888888));
      m.position.y = (H || 1) / 2;
      g.add(m);
    }
  }
  return g;
}

/** Longest horizontal extent, used to frame the camera. */
export const footprint = (s: Structure, cubitM: number) => {
  if (s.dims.length === 0) return s.assumedHeight ?? 1.5;
  // The framing bound is the largest stated measure, whatever its key —
  // a pillar's girth and the sea's diameter are not named length/width.
  return Math.max(...s.dims.map((d) => metres(d.cubits, s, cubitM)));
};
