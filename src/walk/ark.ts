import * as THREE from 'three';
import { bevelBox, batchStatic } from './craft.ts';
import { detailedSurface } from './materials.ts';
import { buildDesert } from './environment.ts';
import { loadFigure, place } from './figures.ts';
import { beatenGold, bronze as bronzeTex, cedarWood, oliveWood, sand as sandTex } from './textures.ts';

// Noah's ark, at the size Genesis gives it.
//
// The whole specification is four verses, and every number in this file comes
// from them:
//
//   6:14   gopher wood; "rooms" — literally nests, 一间一间地造; pitched with
//          pitch within and without
//   6:15   three hundred cubits long, fifty broad, thirty high
//   6:16   a light opening (צֹהַר) finished to a cubit; the door in the side;
//          lower, second and third storeys
//   6:21   food of every kind, gathered and stored
//   7:16   and Yahweh shut him in
//   8:6    Noah opened the window (חַלּוֹן) of the ark
//   8:13   Noah removed the covering of the ark
//
// That is all the text says about the building of it. So:
//
// STATED, and built here: the three dimensions; three decks; one door, in the
// side; a light opening a cubit high; the ark divided into rooms; pitch inside
// and out.
//
// NOT STATED, and therefore a display choice this file marks rather than
// hides: the hull's SHAPE — the text gives three numbers and no bow, no stern
// and no keel, and תֵּבָה is a chest (the same word as the basket Moses was
// put in, Ex 2:3), so it is drawn as a chest; the size of the door; how the
// decks are reached; the size and arrangement of the rooms; whether the thirty
// cubits includes the covering (it is drawn as though it does); the timber
// framing; and the ground it stands on.
//
// The ark is drawn finished and standing on dry land with its door open,
// which is the only moment in the account when a person could walk in: after
// 6:16 and before 7:16, where Yahweh shuts the door.

export interface ArkCounts {
  lengthCubits: number;
  widthCubits: number;
  heightCubits: number;
  decks: number;
  doors: number;
  lightCubits: number;
  rooms: number;
  ribs: number;
  /** What is aboard, in the numbers the text counts — see 7:2–3 and 6:19. */
  clean: number;
  unclean: number;
  birds: number;
  people: number;
  trees: number;
}

/** The figures aboard: a kind, how many, and how tall it stands.
 *
 *  The numbers are the text's (7:2–3; 7:13). The KINDS are the text's only
 *  where it names them — the raven and the dove are named in this very
 *  account (8:7–12) — and elsewhere they are a display choice standing for a
 *  number the text does give. The heights are ordinary adult sizes, because
 *  a figure of the wrong size teaches the wrong thing about the ark. */
export const ABOARD = [
  { file: 'ox', kind: 'clean', count: 14, height: 1.45, zh: '洁净的畜类 · 七公七母', en: 'a clean kind — seven males, seven females', ref: 'Gen 7:2' },
  { file: 'camel', kind: 'unclean', count: 2, height: 2.05, zh: '不洁净的畜类 · 一公一母（利 11:4 指明骆驼不洁净）', en: 'a kind not clean — one male, one female (Lev 11:4 names the camel)', ref: 'Gen 7:2; Lev 11:4' },
  { file: 'dove', kind: 'bird', count: 14, height: 0.3, zh: '飞鸟 · 七公七母（创 8:8 的鸽子）', en: 'fowls — seven and seven (the dove of Gen 8:8)', ref: 'Gen 7:3; 8:8' },
  { file: 'raven', kind: 'raven', count: 1, height: 0.5, zh: '乌鸦（创 8:7 先放出的那一只）', en: 'the raven, sent out first (Gen 8:7)', ref: 'Gen 8:7' },
  { file: 'man', kind: 'man', count: 4, height: 1.72, zh: '挪亚与他的三个儿子', en: 'Noah and his three sons', ref: 'Gen 7:13' },
  { file: 'woman', kind: 'woman', count: 4, height: 1.63, zh: '挪亚的妻子与三个儿妇', en: 'Noah\'s wife and his three sons\' wives', ref: 'Gen 7:13' },
] as const;

export interface Ark {
  group: THREE.Group;
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  /** The ground outside the hull, which is a cradle's height below the ark's
   *  own floor. */
  floorY: number;
  counts: ArkCounts;
  /** Resolves when the generated figures have been loaded and placed. */
  ready: Promise<boolean>;
  anchors: {
    outside: THREE.Vector3;
    door: THREE.Vector3;
    hold: THREE.Vector3;
    second: THREE.Vector3;
    third: THREE.Vector3;
  };
}

const TEX = {
  wood: cedarWood(),
  dark: oliveWood(),
  pitch: bronzeTex(),
  sand: sandTex(),
  gold: beatenGold(),
};
for (const surface of Object.values(TEX)) {
  surface.map.colorSpace = THREE.SRGBColorSpace;
  if (surface.normalMap) surface.normalMap.colorSpace = THREE.NoColorSpace;
}

const M = {
  // Gopher wood is named and not identified (6:14); this is timber, not a
  // claim about a species.
  timber: () => new THREE.MeshStandardMaterial({
    name: 'Gopher timber', color: 0xbb9a6d, roughness: 0.86,
    map: TEX.wood.map, normalMap: TEX.wood.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
  }),
  beam: () => new THREE.MeshStandardMaterial({
    name: 'Timber beam', color: 0x9b7c53, roughness: 0.9,
    map: TEX.dark.map, normalMap: TEX.dark.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
  }),
  // "Pitch it within and without with pitch" (6:14). Outside, that is what
  // you see: a black hull, not a wooden one.
  pitch: () => detailedSurface(new THREE.MeshStandardMaterial({
    name: 'Pitch', color: 0x2a2320, roughness: 0.62, metalness: 0.05,
    map: TEX.pitch.map, normalMap: TEX.pitch.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
  }), 'desert-rock', 9, 0.004),
  deck: () => new THREE.MeshStandardMaterial({
    name: 'Deck planking', color: 0xa8875d, roughness: 0.92,
    map: TEX.wood.map, normalMap: TEX.wood.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
  }),
  ground: () => detailedSurface(new THREE.MeshStandardMaterial({
    name: 'Ground', color: 0xffffff, roughness: 0.97, vertexColors: true,
    map: TEX.sand.map, normalMap: TEX.sand.normalMap,
  }), 'desert-ground', 260, 0.02),
  bark: () => new THREE.MeshStandardMaterial({
    name: 'Bark', color: 0x6b5336, roughness: 0.95,
    map: TEX.wood.map, normalMap: TEX.wood.normalMap,
  }),
  leaf: () => new THREE.MeshStandardMaterial({
    name: 'Foliage', color: 0xffffff, roughness: 0.92, flatShading: true,
  }),
};

export function buildArk(cubit: number): Ark {
  const g = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const platforms: THREE.Box3[] = [];
  const C = (n: number) => n * cubit;
  const counts: ArkCounts = {
    lengthCubits: 300, widthCubits: 50, heightCubits: 30,
    decks: 0, doors: 0, lightCubits: 1, rooms: 0, ribs: 0,
    clean: 0, unclean: 0, birds: 0, people: 0, trees: 0,
  };
  const addCollider = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, false);
    colliders.push(new THREE.Box3().setFromObject(o));
  };
  const addTread = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    platforms.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));

  const timber = M.timber();
  const beam = M.beam();
  const pitch = M.pitch();
  const deckWood = M.deck();

  // ── the three numbers, 6:15 ───────────────────────────────────────────
  const L = C(300), W = C(50), H = C(30);
  const halfL = L / 2, halfW = W / 2;
  const hull = C(1);                    // wall thickness — not stated
  const DECK_H = C(10);                 // three storeys in thirty cubits (6:16)
  const deckT = C(0.5);
  const eaves = C(28);                  // the covering rises the last two
  const LIGHT_BOTTOM = C(26.6);         // the opening of 6:16, a cubit high
  const LIGHT_TOP = LIGHT_BOTTOM + C(1);
  // A hull is built on blocks, not laid in the mud: the ground is the datum
  // minus this, and the space between is filled with keel blocks and shores.
  // Nothing about it is stated — a ship three hundred cubits long has to be
  // held up while it is built, and the card says that is the whole argument.
  const LIFT = C(2.6);

  // ── the ground it stands on ───────────────────────────────────────────
  // NOT the desert the tabernacle and the temple stand in. Where the ark was
  // built is not stated; what is stated is that it was built of timber, and
  // 300 cubits of it. So the ark stands on a wooded plain — which is a
  // display choice, and the card says so — rather than on sand, where the
  // material it is made of does not grow.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(C(1400), C(1400), 160, 160), M.ground());
  floor.position.y = -LIFT;
  const fp = floor.geometry.attributes.position as THREE.BufferAttribute;
  const fc = new Float32Array(fp.count * 3);
  const green = new THREE.Color(0x9fb06a), dry = new THREE.Color(0xe8dcc4), mix = new THREE.Color();
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), y = fp.getY(i);
    const d = Math.hypot(x, y);
    fp.setZ(i, -Math.sin(x * 0.02) * 0.2 - Math.cos(y * 0.017) * 0.24);
    // Green under the ark, drying out toward the hills, so the plain meets
    // them instead of ending at them in a line.
    mix.copy(green).lerp(dry, THREE.MathUtils.smoothstep(d, C(150), C(340)));
    mix.toArray(fc, i * 3);
  }
  floor.geometry.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  floor.geometry.computeVertexNormals();
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.noCast = true;
  floor.userData.dynamic = true;
  g.add(floor);
  const hills = buildDesert(() => true, 320);      // distant hills only
  hills.position.y = -LIFT - C(1.6);
  g.add(hills);

  // Timber standing where timber grows. Instanced, three sizes, none of them
  // within reach of the hull or the ramp.
  {
    const trunkGeo = new THREE.CylinderGeometry(C(0.26), C(0.42), C(7), 6);
    trunkGeo.translate(0, C(3.5), 0);
    const crownGeo = new THREE.IcosahedronGeometry(C(3.4), 1);
    crownGeo.translate(0, C(9), 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, M.bark(), 420);
    const crowns = new THREE.InstancedMesh(crownGeo, M.leaf(), 420);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let n = 0;
    for (let i = 0; n < 420 && i < 6000; i++) {
      // Two unrelated hashes, because the golden angle draws visible arcs.
      const h1 = (Math.sin(i * 127.1) * 43758.5453) % 1;
      const h2 = (Math.sin(i * 311.7) * 24634.6345) % 1;
      const a = (h1 < 0 ? h1 + 1 : h1) * Math.PI * 2;
      const r = C(70) + ((h2 < 0 ? h2 + 1 : h2) ** 0.7) * C(420);
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
      if (Math.abs(x) < halfL + C(20) && Math.abs(z) < halfW + C(70)) continue;
      const scale = 0.7 + (Math.sin(i * 7.77) * 0.5 + 0.5) * 0.9;
      dummy.position.set(x, -LIFT, z);
      dummy.rotation.y = i;
      dummy.scale.set(scale, scale * (0.85 + 0.3 * Math.sin(i * 3.1)), scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(n, dummy.matrix);
      crowns.setMatrixAt(n, dummy.matrix);
      tint.setHSL(0.24 + 0.05 * Math.sin(i * 1.7), 0.34, 0.40 + 0.09 * Math.sin(i * 5));
      crowns.setColorAt(n, tint);
      n++;
    }
    trunks.count = n; crowns.count = n;
    trunks.userData.noCast = true; crowns.userData.noCast = true;
    g.add(trunks); g.add(crowns);
    counts.trees = n;
  }

  // ── the hull: a chest, because that is the only shape the text gives ──
  //
  // The door of 6:16 is a HOLE, so the wall it is in has to be laid in pieces
  // around it. The first version laid one sheet three hundred cubits long and
  // stood a frame in front of it: from outside the doorway was a drawing, and
  // the owner said 门也没有. Its size is not given. Six cubits by eight, on
  // the south side amidships, opening onto the lowest deck.
  const doorW = C(6), doorH = C(8), doorZ = -(halfW - hull / 2);
  const DOOR_SIDE = -1;                 // the door is in the south side
  const side = (sz: number) => {
    const z = sz * (halfW - hull / 2);
    /** A piece of the wall below the light opening. */
    const wall = (x0: number, x1: number, y0: number, y1: number) => {
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
      const piece = bevelBox(x1 - x0, y1 - y0, hull, pitch, 0.02);
      piece.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
      g.add(piece); addCollider(piece);
    };
    // Below the light opening — around the doorway, on the side it is in.
    if (sz === DOOR_SIDE) {
      wall(-halfL, -doorW / 2, 0, LIGHT_BOTTOM);          // west of the door
      wall(doorW / 2, halfL, 0, LIGHT_BOTTOM);            // east of it
      wall(-doorW / 2, doorW / 2, doorH, LIGHT_BOTTOM);   // and over its head
    } else {
      wall(-halfL, halfL, 0, LIGHT_BOTTOM);
    }
    // …the posts that leave it open, a cubit high (6:16)…
    for (let x = -halfL + C(3); x < halfL; x += C(6)) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(C(0.7), C(1), hull * 1.1), beam);
      post.position.set(x, LIGHT_BOTTOM + C(0.5), sz * (halfW - hull / 2));
      g.add(post);
    }
    // …and the wall above it, up to the eaves.
    const upper = bevelBox(L, eaves - LIGHT_TOP, hull, pitch, 0.02);
    upper.position.set(0, (eaves + LIGHT_TOP) / 2, z);
    g.add(upper); addCollider(upper);
  };
  side(1); side(-1);

  for (const sx of [-1, 1]) {
    const end = bevelBox(hull, eaves, W, pitch, 0.02);
    end.position.set(sx * (halfL - hull / 2), eaves / 2, 0);
    g.add(end); addCollider(end);
  }

  // The ribs: timber standing proud of the pitch every five cubits. Framing
  // is not described; a hull this size has some, and this is what it looks
  // like when it does.
  for (let x = -halfL + C(5); x < halfL; x += C(5)) {
    for (const sz of [-1, 1]) {
      // …except across the doorway, where one of them stood in the opening.
      if (sz === DOOR_SIDE && Math.abs(x) < doorW / 2 + C(0.6)) continue;
      const rib = bevelBox(C(1.2), eaves, C(0.6), beam, 0.01);
      rib.position.set(x, eaves / 2, sz * (halfW + C(0.2)));
      g.add(rib);
      counts.ribs++;
    }
  }

  // Keel blocks down the centre line and raking shores on both sides: what
  // holds a hull up on land while it is built.
  for (let x = -halfL + C(6); x < halfL - C(4); x += C(12)) {
    const block = bevelBox(C(4), LIFT, C(9), beam, 0.02);
    block.position.set(x, -LIFT / 2, 0);
    g.add(block); addCollider(block);
    for (const sz of [-1, 1]) {
      const shore = bevelBox(C(1.1), LIFT * 2.1, C(1.1), beam, 0.02);
      shore.position.set(x, -LIFT / 2 + C(0.4), sz * (halfW - C(1.2)));
      shore.rotation.x = sz * 0.42;
      g.add(shore);
      const pad = bevelBox(C(2.2), C(0.5), C(2.2), beam, 0.02);
      pad.position.set(x, -LIFT + C(0.25), sz * (halfW + C(1.6)));
      g.add(pad);
    }
  }

  // ── the covering, 8:13 ────────────────────────────────────────────────
  // Two cubits of ridge over the eaves, so the thirty of 6:15 is the whole
  // height. Whether the thirty includes it is not stated; the card says so.
  const roofRun = halfW + C(0.8);
  const OVER = C(1.4);                  // how far each panel crosses the ridge
  for (const sz of [-1, 1]) {
    const slope = Math.atan2(H - eaves, roofRun);
    const len = Math.hypot(roofRun, H - eaves) + OVER;
    const panel = bevelBox(L + C(1.6), C(0.5), len, deckWood, 0.01);
    // Placed from the EAVE inward, so the extra length crosses the ridge and
    // laps the other panel instead of leaving a slit of daylight down the
    // whole three hundred cubits — which is what the first version did, and
    // what the owner saw from inside as a bright line in the ceiling.
    const mid = (roofRun - OVER) / 2;
    panel.position.set(0, (eaves + H) / 2 - Math.sin(slope) * OVER / 2, sz * mid);
    panel.rotation.x = -sz * slope;
    g.add(panel); addCollider(panel);
  }
  const ridge = bevelBox(L + C(2), C(0.8), C(1.2), beam, 0.02);
  ridge.position.y = H;
  g.add(ridge);

  // ── three decks, 6:16 ─────────────────────────────────────────────────
  //
  // Each deck above the lowest has a hole cut in it where the ramp from the
  // deck below arrives. Without it the ramp runs up into a ceiling: the owner
  // walked it, saw a plank climbing into the underside of the deck above, and
  // said 应该开个口. The hole and the ramp are computed from the same numbers
  // so they cannot drift apart.
  const deckY = [C(0), DECK_H, DECK_H * 2];
  const RAMP_HALF = C(3.2);                       // half the ramp's width
  /** Where the ramp INTO deck `i` lands, in x. Deck 0 has none. */
  const rampSpan = (i: number): [number, number] | null => {
    if (i === 0) return null;
    const sx = (i - 1) % 2 === 0 ? 1 : -1;
    const near = sx * (halfL - hull - C(4));
    const far = sx * (halfL - hull - C(30));
    return [Math.min(near, far), Math.max(near, far)];
  };
  for (const [i, y] of deckY.entries()) {
    const span = rampSpan(i);
    const x0 = -halfL + hull, x1 = halfL - hull;
    const z0 = -halfW + hull, z1 = halfW - hull;
    /** One piece of decking, as mesh and as floor. */
    const deckPiece = (ax: number, bx: number, az: number, bz: number) => {
      if (bx - ax < 0.01 || bz - az < 0.01) return;
      const piece = bevelBox(bx - ax, deckT, bz - az, deckWood, 0.006);
      piece.position.set((ax + bx) / 2, y + deckT / 2, (az + bz) / 2);
      g.add(piece);
      addTread(ax, y, az, bx, y + deckT, bz);
    };
    if (!span) {
      deckPiece(x0, x1, z0, z1);
    } else {
      const [hx0, hx1] = span;
      deckPiece(x0, hx0, z0, z1);                 // before the opening
      deckPiece(hx1, x1, z0, z1);                 // after it
      deckPiece(hx0, hx1, z0, -RAMP_HALF);        // and the strips beside it
      deckPiece(hx0, hx1, RAMP_HALF, z1);
    }
    if (i > 0) {
      // Beams under it, seen from the deck below — and not across the hole.
      for (let x = -halfL + C(4); x < halfL; x += C(4)) {
        if (span && x > span[0] - C(2) && x < span[1] + C(2)) continue;
        const joist = bevelBox(C(0.8), C(0.9), W - hull * 2, beam, 0.01);
        joist.position.set(x, y - C(0.45), 0);
        g.add(joist);
      }
    }
    counts.decks++;
  }

  // ── "one room and another", 6:14 ──────────────────────────────────────
  // Stalls down both sides of every deck with a gangway between them. The
  // size and arrangement are not given; these are five cubits wide and
  // sixteen deep, which leaves eighteen cubits of gangway down the middle.
  const PEN = C(5), PEN_DEEP = C(16), RAIL = C(1.6);
  for (const y of deckY) {
    for (const sz of [-1, 1]) {
      const backZ = sz * (halfW - hull);
      const frontZ = sz * (halfW - hull - PEN_DEEP);
      for (let x = -halfL + hull; x < halfL - hull - PEN; x += PEN) {
        const hole = rampSpan(deckY.indexOf(y) + 1);
        if (hole && x + PEN > hole[0] && x < hole[1]) continue;   // the stair well
        // …and nothing across the doorway: a stall stood in it, so a visitor
        // came in at the door and walked straight into a partition.
        if (y === deckY[0] && sz === DOOR_SIDE
          && x + PEN > -doorW / 2 - C(1) && x < doorW / 2 + C(1)) continue;
        // The partition between this room and the next.
        const wall = bevelBox(C(0.35), C(3.2), PEN_DEEP, timber, 0.006);
        wall.position.set(x, y + C(1.6) + deckT, (backZ + frontZ) / 2);
        g.add(wall); addCollider(wall);
        // …and the rail across its front, with the gap a beast walks through.
        const bar = bevelBox(PEN - C(1.8), C(0.25), C(0.3), timber, 0.006);
        bar.position.set(x + PEN / 2 + C(0.9), y + deckT + RAIL, frontZ);
        g.add(bar);
        counts.rooms++;
      }
      // The long rail at the gangway's edge, broken at every stall door.
      const kerb = bevelBox(L - hull * 2, C(0.5), C(0.3), timber, 0.006);
      kerb.position.set(0, y + deckT + C(0.25), frontZ);
      g.add(kerb);
    }
  }

  // ── the door in the side, 6:16 ────────────────────────────────────────
  // The opening itself is cut in side() above, where the wall is laid. What
  // is here is what frames it: jambs, a head, a sill, and the leaf standing
  // open — because the ark is drawn between 6:16 and 7:16, and 7:16 is where
  // Yahweh shuts the door.
  {
    // The jambs and the head, in timber.
    for (const sx of [-1, 1]) {
      const jamb = bevelBox(C(0.9), doorH + C(0.9), hull * 1.4, beam, 0.01);
      jamb.position.set(sx * (doorW / 2 + C(0.45)), (doorH + C(0.9)) / 2, doorZ);
      g.add(jamb); addCollider(jamb);
    }
    const head = bevelBox(doorW + C(1.8), C(0.9), hull * 1.4, beam, 0.01);
    head.position.set(0, doorH + C(0.45), doorZ);
    g.add(head); addCollider(head);
    // The leaf, swung open against the hull.
    const leaf = bevelBox(doorW * 0.96, doorH * 0.96, C(0.5), timber, 0.01);
    leaf.position.set(doorW / 2 + doorW * 0.48 + C(0.6), doorH / 2, doorZ - C(1.4));
    leaf.rotation.y = 0.32;
    g.add(leaf); addCollider(leaf);
    // The sill, level with the lowest deck, so the ramp lands on timber and
    // the threshold is something a foot meets rather than an edge.
    const sill = bevelBox(doorW + C(1.8), deckT, hull * 2.6, beam, 0.01);
    sill.position.set(0, deckT / 2, doorZ - C(0.3));
    g.add(sill);
    addTread(-doorW / 2 - C(0.9), 0, doorZ - hull * 1.3 - C(0.3),
      doorW / 2 + C(0.9), deckT, doorZ + hull * 1.3 - C(0.3));
  }
  counts.doors++;

  // ── the way up to the door, and between the decks ─────────────────────
  // Not described. A ramp to the door and a ramp between each pair of decks:
  // a ladder would keep a visitor out of two thirds of the ark.
  const rampTreads = (x0: number, z0: number, x1: number, z1: number,
    y0: number, y1: number, halfWidth: number, steps = 26) => {
    for (let i = 0; i < steps; i++) {
      const a = i / steps, b = (i + 1) / steps;
      const ax = x0 + (x1 - x0) * a, bx = x0 + (x1 - x0) * b;
      const az = z0 + (z1 - z0) * a, bz = z0 + (z1 - z0) * b;
      const top = y0 + (y1 - y0) * b;
      addTread(Math.min(ax, bx) - (x1 === x0 ? halfWidth : 0), top - C(0.6),
        Math.min(az, bz) - (z1 === z0 ? halfWidth : 0),
        Math.max(ax, bx) + (x1 === x0 ? halfWidth : 0), top,
        Math.max(az, bz) + (z1 === z0 ? halfWidth : 0));
    }
  };
  // Outside: from the ground up to the door.
  {
    // The ramp climbs to the SILL, which is the lowest deck — not to the head
    // of the doorway. The first one rose the door's full height and arrived at
    // the lintel, which is what the owner saw and called 反的. So the rise is
    // only the cradle's height.
    const run = C(14);
    const top = deckT;                  // the sill, which is the lowest deck
    const rise = LIFT + top;
    const foot = doorZ - run - C(1), head = doorZ - C(1);
    const ramp = bevelBox(doorW, C(0.6), Math.hypot(run, rise), timber, 0.01);
    ramp.position.set(0, (top - LIFT) / 2, (foot + head) / 2);
    // NEGATIVE: a positive rotation about x drops the end nearer the hull,
    // which laid the board high at the ground and low at the door while the
    // treads under it climbed the other way. That is the 反的 the owner saw.
    ramp.rotation.x = -Math.atan2(rise, run);
    g.add(ramp);
    rampTreads(0, foot, 0, head, -LIFT, top, doorW / 2, 20);
    for (let i = 1; i <= 2; i++) {
      const t = i / 3;                  // measured from the door
      const z = head - run * t;
      const h = rise * (1 - t) + C(0.3);
      const trestle = bevelBox(doorW * 0.8, h, C(0.7), beam, 0.02);
      trestle.position.set(0, -LIFT + h / 2, z);
      g.add(trestle);
    }
  }
  // Inside: one ramp at each end, turning back on itself so it fits.
  for (const [i, y] of deckY.entries()) {
    if (i === deckY.length - 1) break;
    const sx = i % 2 === 0 ? 1 : -1;                  // fore, then aft
    const x0 = sx * (halfL - hull - C(4));
    const x1 = sx * (halfL - hull - C(30));
    const z = 0;
    const ramp = bevelBox(Math.abs(x1 - x0), C(0.5), C(6), timber, 0.01);
    ramp.position.set((x0 + x1) / 2, y + DECK_H / 2 + deckT, z);
    ramp.rotation.z = -sx * Math.atan2(DECK_H, Math.abs(x1 - x0));
    g.add(ramp);
    rampTreads(x1, z, x0, z, y + DECK_H + deckT, y + deckT, C(3));
  }

  // ── the window of 8:6, and the light of 6:16 ──────────────────────────
  // A hatch in the covering over the third deck. 8:6 calls it a window and
  // does not size it; 8:13 has the covering itself come off.
  {
    const hatch = C(4);
    const frame = bevelBox(hatch + C(1), C(0.4), hatch + C(1), beam, 0.01);
    frame.position.set(C(40), eaves + C(1.1), 0);
    frame.rotation.z = 0.02;
    g.add(frame);
    // Lying back on the covering beside the opening, on its hinge — not
    // hanging in the air over it.
    const lid = bevelBox(hatch, C(0.35), hatch, timber, 0.01);
    lid.position.set(C(40) + hatch * 1.05, eaves + C(1.5), C(0.4));
    lid.rotation.set(0.04, 0.05, -0.12);
    g.add(lid);
    const hinge = bevelBox(C(0.5), C(0.25), hatch, beam, 0.01);
    hinge.position.set(C(40) + hatch / 2, eaves + C(1.35), 0);
    g.add(hinge);
  }

  // ── what is aboard, 6:19–20; 7:2–3, 7:13 ──────────────────────────────
  //
  // The text counts, and does not list. It gives KINDS — "after his kind" —
  // and it gives numbers: of every clean beast seven males and seven females,
  // of beasts that are not clean one male and one female, of the fowls of the
  // air seven and seven (7:2–3); and two of every sort into the ark (6:19).
  // There is no species list anywhere in the account, so a census would be an
  // invention dressed as data.
  //
  // What is drawn is therefore the NUMBERS, on one kind of each: fourteen of
  // a clean beast, two of an unclean one, fourteen birds. The forms are
  // generic — a four-footed beast, a bird — and identify nothing. The card
  // says all of this.
  // The figures are generated meshes loaded from public/models — see
  // figures.ts for the rule they are held to. They arrive after this function
  // returns, so they are added to the group afterwards and never batched.
  const ready = (async () => {
    try {
      const templates = new Map<string, THREE.Group>();
      await Promise.all(ABOARD.map(async (a) => {
        templates.set(a.file, await loadFigure(`/models/${a.file}.glb`, a.height));
      }));
      const ox = templates.get('ox')!, camel = templates.get('camel')!;
      const dove = templates.get('dove')!, raven = templates.get('raven')!;
      const man = templates.get('man')!, woman = templates.get('woman')!;

      // Fourteen of a clean kind, in the rooms along the lower deck's north
      // side: seven on one side of the gangway, seven on the other (7:2).
      // Each beast stands in the middle of a room rather than across its
      // partition: the rooms start at the bow and are five cubits apart, so
      // room n has its centre at −146.5 + 5n.
      const room = (n: number) => C(-146.5 + n * 5);
      for (let i = 0; i < 14; i++) {
        const male = i < 7;
        const n = (male ? i : i - 7) + 12;
        g.add(place(ox, room(n), deckT, C(male ? 13 : -13), male ? -Math.PI / 2 : Math.PI / 2, i));
        counts.clean++;
      }
      // One male and one female of a kind that is not clean (7:2; Lev 11:4
      // names the camel among those that are not).
      for (let i = 0; i < 2; i++) {
        g.add(place(camel, room(26 + i * 2), deckT, C(i === 0 ? 14 : -14),
          i === 0 ? -Math.PI / 2 : Math.PI / 2, i));
        counts.unclean++;
      }
      // Fourteen of the fowls of the air on the second deck's rails (7:3),
      // and the raven that was sent out first (8:7).
      for (let i = 0; i < 14; i++) {
        const sz = i % 2 === 0 ? 1 : -1;
        g.add(place(dove, C(16 + Math.floor(i / 2) * 7), DECK_H + deckT + RAIL, sz * C(8),
          sz > 0 ? 0.4 : Math.PI - 0.4, i));
        counts.birds++;
      }
      g.add(place(raven, C(70), DECK_H + deckT + RAIL, C(8), 0.6));
      // And the eight: Noah, his wife, his three sons and their three wives
      // (7:13; 1 Pet 3:20 counts them as eight).
      //
      // Not two ranks facing each other: eight people standing about a deck
      // eighteen cubits wide. The offsets are fixed numbers rather than random
      // ones so that what a reader photographs today is what they find
      // tomorrow — and so this file stays the single answer to where they are.
      const EIGHT: [number, number, number][] = [
        [-9.5, 4.2, Math.PI * 0.86], [-5.0, 2.4, Math.PI * 1.15],
        [-1.2, 4.6, Math.PI * 0.72], [2.6, 2.8, Math.PI * 1.04],
        [-8.6, -3.0, -0.22], [-4.4, -5.0, 0.34],
        [-0.6, -2.8, -0.12], [3.4, -4.6, 0.46],
      ];
      EIGHT.forEach(([x, z, facing], i) => {
        g.add(place(i < 4 ? man : woman, C(x), DECK_H + deckT, C(z), facing, i));
        counts.people++;
      });
      return true;
    } catch {
      return false;                       // the walk still stands without them
    }
  })();

  batchStatic(g);

  const anchors = {
    outside: new THREE.Vector3(0, 0, -(halfW + C(40))),
    door: new THREE.Vector3(0, 0, doorZ),
    hold: new THREE.Vector3(0, 0, 0),
    second: new THREE.Vector3(0, DECK_H, 0),
    third: new THREE.Vector3(0, DECK_H * 2, 0),
  };
  return { group: g, colliders, platforms, counts, ready, anchors, floorY: -LIFT };
}
