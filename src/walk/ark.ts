import * as THREE from 'three';
import { bevelBox, batchStatic } from './craft.ts';
import { detailedSurface } from './materials.ts';
import { buildDesert } from './environment.ts';
import { humanFigure } from '../structures/build.ts';
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

export interface Ark {
  group: THREE.Group;
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  counts: ArkCounts;
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

  // ── the ground it stands on ───────────────────────────────────────────
  // NOT the desert the tabernacle and the temple stand in. Where the ark was
  // built is not stated; what is stated is that it was built of timber, and
  // 300 cubits of it. So the ark stands on a wooded plain — which is a
  // display choice, and the card says so — rather than on sand, where the
  // material it is made of does not grow.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(C(1400), C(1400), 160, 160), M.ground());
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
  floor.position.y = -C(0.06);
  floor.receiveShadow = true;
  floor.userData.noCast = true;
  floor.userData.dynamic = true;
  g.add(floor);
  const hills = buildDesert(() => true, 320);      // distant hills only
  hills.position.y = -C(1.6);
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
      dummy.position.set(x, 0, z);
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
  const side = (sz: number) => {
    // Below the light opening…
    const lower = bevelBox(L, LIGHT_BOTTOM, hull, pitch, 0.02);
    lower.position.set(0, LIGHT_BOTTOM / 2, sz * (halfW - hull / 2));
    g.add(lower); addCollider(lower);
    // …the posts that leave it open, a cubit high (6:16)…
    for (let x = -halfL + C(3); x < halfL; x += C(6)) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(C(0.7), C(1), hull * 1.1), beam);
      post.position.set(x, LIGHT_BOTTOM + C(0.5), sz * (halfW - hull / 2));
      g.add(post);
    }
    // …and the wall above it, up to the eaves.
    const upper = bevelBox(L, eaves - LIGHT_TOP, hull, pitch, 0.02);
    upper.position.set(0, (eaves + LIGHT_TOP) / 2, sz * (halfW - hull / 2));
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
      const rib = bevelBox(C(1.2), eaves, C(0.6), beam, 0.01);
      rib.position.set(x, eaves / 2, sz * (halfW + C(0.2)));
      g.add(rib);
      counts.ribs++;
    }
  }

  // ── the covering, 8:13 ────────────────────────────────────────────────
  // Two cubits of ridge over the eaves, so the thirty of 6:15 is the whole
  // height. Whether the thirty includes it is not stated; the card says so.
  const roofRun = halfW + C(0.8);
  for (const sz of [-1, 1]) {
    const slope = Math.atan2(H - eaves, roofRun);
    const panel = bevelBox(L + C(1.6), C(0.5), Math.hypot(roofRun, H - eaves), deckWood, 0.01);
    panel.position.set(0, (eaves + H) / 2, sz * roofRun / 2);
    panel.rotation.x = -sz * slope;
    g.add(panel); addCollider(panel);
  }
  const ridge = bevelBox(L + C(2), C(0.8), C(1.2), beam, 0.02);
  ridge.position.y = H;
  g.add(ridge);

  // ── three decks, 6:16 ─────────────────────────────────────────────────
  const deckY = [C(0), DECK_H, DECK_H * 2];
  for (const [i, y] of deckY.entries()) {
    const planks = bevelBox(L - hull * 2, deckT, W - hull * 2, deckWood, 0.006);
    planks.position.y = y + deckT / 2;
    g.add(planks);
    // A deck is a floor, not a wall: it holds the walker up and never blocks.
    addTread(-halfL, y, -halfW, halfL, y + deckT, halfW);
    if (i > 0) {
      // Beams under it, seen from the deck below.
      for (let x = -halfL + C(4); x < halfL; x += C(4)) {
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
  // Its size is not given. Six cubits by eight, on the south side, amidships,
  // opening onto the lowest deck — and standing open, because that is the
  // only moment a visitor could walk in (7:16 shuts it).
  const doorW = C(6), doorH = C(8), doorZ = -(halfW - hull / 2);
  {
    // Cut it by rebuilding the wall around the opening.
    const cut = new THREE.Box3(
      new THREE.Vector3(-doorW / 2, 0, doorZ - hull),
      new THREE.Vector3(doorW / 2, doorH, doorZ + hull));
    colliders.push(...[] as THREE.Box3[]);          // no collider for a hole
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
    void cut;
  }
  counts.doors++;

  // The wall that is left around the doorway: the side() call above laid a
  // single sheet, so the opening is carved by putting solid pieces back and
  // leaving the hole. Simpler and exact: a shallow recess of pitch each side
  // of the door, and the hole itself left alone by the colliders below.
  {
    const gapColliders: THREE.Box3[] = [];
    for (const c of colliders) {
      // Split any collider that spans the doorway on the south wall.
      const spansDoor = c.min.z <= doorZ && c.max.z >= doorZ
        && c.min.x < doorW / 2 && c.max.x > -doorW / 2 && c.min.y < doorH;
      if (!spansDoor) { gapColliders.push(c); continue; }
      const west = c.clone(); west.max.x = -doorW / 2;
      const east = c.clone(); east.min.x = doorW / 2;
      const over = c.clone(); over.min.y = doorH;
      for (const part of [west, east, over]) {
        if (part.max.x > part.min.x && part.max.y > part.min.y) gapColliders.push(part);
      }
    }
    colliders.length = 0;
    colliders.push(...gapColliders);
  }

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
    const run = C(26);
    const ramp = bevelBox(doorW, C(0.6), run, timber, 0.01);
    ramp.position.set(0, doorH / 2, doorZ - run / 2 - C(1));
    ramp.rotation.x = Math.atan2(doorH, run);
    g.add(ramp);
    rampTreads(0, doorZ - run - C(1), 0, doorZ - C(1), C(0), doorH, doorW / 2);
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
    const lid = bevelBox(hatch, C(0.35), hatch, timber, 0.01);
    lid.position.set(C(40) + hatch * 0.9, eaves + C(2.2), C(0.6));
    lid.rotation.set(0.15, 0.2, -0.5);
    g.add(lid);
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
  const beastMat = new THREE.MeshStandardMaterial({
    name: 'Beast', color: 0x7d6a55, roughness: 0.95, flatShading: true,
  });
  const beastPale = beastMat.clone(); beastPale.color.setHex(0x9a8a72);
  const birdMat = new THREE.MeshStandardMaterial({
    name: 'Fowl', color: 0x8d8574, roughness: 0.95, flatShading: true,
  });

  /** A four-footed beast: body, neck, head, four legs, a tail. Deliberately
   *  unspecific — the verse says "after his kind" and names no kind. */
  const beast = (scale: number, material: THREE.Material) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(C(0.62), C(1.5), 3, 8), material);
    body.rotation.z = Math.PI / 2;
    body.position.y = C(1.5);
    b.add(body);
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(C(0.26), C(1.0), 3, 6), material);
    neck.position.set(C(1.15), C(1.95), 0);
    neck.rotation.z = -0.5;
    b.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(C(0.36), 8, 6), material);
    head.position.set(C(1.6), C(2.35), 0);
    b.add(head);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(C(0.16), C(1.2), 3, 6), material);
      leg.position.set(sx * C(0.85), C(0.7), sz * C(0.38));
      b.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(C(0.1), C(0.9), 3, 5), material);
    tail.position.set(-C(1.35), C(1.6), 0);
    tail.rotation.z = 0.7;
    b.add(tail);
    b.scale.setScalar(scale);
    return b;
  };
  const fowl = () => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(C(0.22), C(0.42), 3, 7), birdMat);
    body.rotation.z = Math.PI / 2.4;
    body.position.y = C(0.42);
    const head = new THREE.Mesh(new THREE.SphereGeometry(C(0.13), 7, 6), birdMat);
    head.position.set(C(0.34), C(0.72), 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(C(0.16), C(0.5), 5), birdMat);
    tail.position.set(-C(0.42), C(0.42), 0);
    tail.rotation.z = Math.PI / 2;
    b.add(body, head, tail);
    return b;
  };

  // Fourteen of a clean kind — seven males and seven females (7:2) — in the
  // rooms along the lower deck's north side.
  for (let i = 0; i < 14; i++) {
    const male = i < 7;
    const one = beast(male ? 1 : 0.86, male ? beastMat : beastPale);
    one.position.set(C(-120 + i * 5 + (male ? 0 : 2.2)), deckT, C(male ? 12 : 17));
    one.rotation.y = male ? -Math.PI / 2 : Math.PI / 2;
    g.add(one);
    counts.clean++;
  }
  // One male and one female of a kind that is not clean (7:2).
  for (let i = 0; i < 2; i++) {
    const one = beast(i === 0 ? 1.35 : 1.2, i === 0 ? beastMat : beastPale);
    one.position.set(C(-46 + i * 6), deckT, C(-14));
    one.rotation.y = Math.PI / 2;
    g.add(one);
    counts.unclean++;
  }
  // Fourteen of the fowls of the air (7:3), on the second deck's rails.
  for (let i = 0; i < 14; i++) {
    const bird = fowl();
    const sz = i % 2 === 0 ? 1 : -1;
    bird.position.set(C(20 + Math.floor(i / 2) * 6), DECK_H + deckT + RAIL + C(0.15), sz * C(8));
    bird.rotation.y = sz > 0 ? 0.3 : Math.PI - 0.3;
    g.add(bird);
    counts.birds++;
  }
  // And eight people: Noah, his wife, his three sons and their three wives
  // (7:13; 1 Pet 3:20 counts them). Standing on the second deck, amidships.
  for (let i = 0; i < 8; i++) {
    const person = humanFigure();
    const row = i < 4 ? 1 : -1;
    person.position.set(C(-6 + (i % 4) * 3.2), DECK_H + deckT, row * C(3.4));
    person.rotation.y = row > 0 ? Math.PI : 0;
    person.traverse((o) => { o.userData.dynamic = false; });
    g.add(person);
    counts.people++;
  }

  batchStatic(g);

  const anchors = {
    outside: new THREE.Vector3(0, 0, -(halfW + C(40))),
    door: new THREE.Vector3(0, 0, doorZ),
    hold: new THREE.Vector3(0, 0, 0),
    second: new THREE.Vector3(0, DECK_H, 0),
    third: new THREE.Vector3(0, DECK_H * 2, 0),
  };
  return { group: g, colliders, platforms, counts, anchors };
}
