import * as THREE from 'three';
import { metres, type Structure } from './specs.ts';
import { buildMenorah, type BranchForm } from './menorah.ts';

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
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

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
      const chest = box(L, H, W, mat(GOLD, { metalness: 0.85, roughness: 0.28 }));
      chest.position.y = H / 2;
      g.add(chest);
      // The mercy seat, its own slab on top — Exodus 25:17.
      const seat = box(L * 1.03, H * 0.06, W * 1.03, mat(GOLD, { metalness: 0.9, roughness: 0.2 }));
      seat.position.y = H * 1.02;
      g.add(seat);
      // Two cherubim facing each other, wings overshadowing — Exodus 25:18-20.
      // Only the stated posture is rendered; the text describes no form.
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(
          new THREE.SphereGeometry(H * 0.2, 12, 10, 0, Math.PI),
          mat(GOLD, { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }),
        );
        wing.position.set(sx * L * 0.3, H * 1.16, 0);
        wing.rotation.set(Math.PI / 2, 0, sx * -0.5);
        g.add(wing);
      }
      // Poles through the rings — the ark was never meant to be set down.
      for (const sz of [-1, 1]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(H * 0.035, H * 0.035, L * 1.6, 10),
          mat(GOLD, { metalness: 0.8, roughness: 0.35 }),
        );
        pole.rotation.z = Math.PI / 2;
        pole.position.set(0, H * 0.6, sz * W * 0.62);
        g.add(pole);
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
  const of = (k: string) => {
    const dim = s.dims.find((x) => x.key === k);
    return dim ? metres(dim.cubits, s, cubitM) : 0;
  };
  return Math.max(of('length'), of('width'), of('height'));
};
