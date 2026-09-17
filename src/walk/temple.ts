import * as THREE from 'three';
import { buildMenorah } from '../structures/menorah.ts';
import {
  ashlarStone, beatenGold, bronze as bronzeTex, cedarWood, oliveWood, veilCloth,
} from './textures.ts';
import { bevelBox, hanging, batchStatic, altarHorn } from './craft.ts';
import { detailedSurface } from './materials.ts';

// Solomon's temple, generated from the counts the text states.
//
// Primary passages: 1 Kings 6–7 and 2 Chronicles 3–4. Scripture measures this
// building more densely than any other object in the canon except Ezekiel's
// never-built temple — and every number below is one of those measurements,
// not a proportion guessed for the screenshot.
//
//   1 Kgs 6:2     house 60 × 20 × 30 cubits
//   1 Kgs 6:3     porch 20 deep across the front, 10 cubits in front of it
//   1 Kgs 6:5–6   three stories of side chambers: lower 5, middle 6, upper 7
//   1 Kgs 6:16–17 most holy place 20 cubits at the rear; temple 40 in front
//   1 Kgs 6:20    oracle 20 × 20 × 20, overlaid with pure gold
//   1 Kgs 6:23–28 two cherubim of olive wood, 10 cubits high, wings 5+5
//   1 Kgs 6:31    olive-wood doors with five-sided posts
//   1 Kgs 6:36    inner court wall: three rows of hewn stone, one of cedar
//   1 Kgs 7:15    pillars of brass, 18 cubits high, 12 in circumference
//   1 Kgs 7:21    Jachin and Boaz at the porch
//   1 Kgs 7:23–26 molten sea: 10 across, 5 high, 30 around, on twelve oxen
//   1 Kgs 7:27–39 ten wheeled bases, 4 × 4 × 3, five on each side
//   2 Chron 3:1   the site is Mount Moriah, the threshing floor of Ornan
//   2 Chron 3:14  the veil of blue, purple, crimson and fine linen
//   2 Chron 4:1   bronze altar, 20 × 20 × 10
//
// Two readings this model must NOT silently settle:
//   · 1 Kgs 7:15 makes the pillars 18 cubits; 2 Chron 3:15 makes them 35.
//     This walk uses the Kings figure (18) and the card says both.
//   · 1 Kgs 7:26 gives the sea 2,000 baths; 2 Chron 4:5 gives 3,000.
//     Geometry is the stated 10 × 5 × 30; capacity is reported, not modelled.
//
// What the text does NOT give, and this model therefore does not invent:
// roof pitch, wall thickness, door width, porch height (2 Chron 3:3's 120
// is left as a disputed reading on the card), outer-court dimensions, or
// the form of the cherubim beyond height and wing span.

export interface Part { mesh: THREE.Object3D; ref: string; zh: string }

export interface TempleCounts {
  pillars: number;
  pomegranates: number;
  oxen: number;
  lavers: number;
  cherubim: number;
  sideChambers: number;
}

export interface Temple {
  group: THREE.Group;
  colliders: THREE.Box3[];
  counts: TempleCounts;
  /** Named places the HUD can report, in metres after cubit is applied. */
  anchors: {
    porch: THREE.Vector3;
    holy: THREE.Vector3;
    debir: THREE.Vector3;
    sea: THREE.Vector3;
    jachin: THREE.Vector3;
    boaz: THREE.Vector3;
    altar: THREE.Vector3;
  };
}

const TEX = {
  gold: beatenGold(),
  bronze: bronzeTex(),
  stone: ashlarStone(),
  cedar: cedarWood(),
  olive: oliveWood(),
  veil: veilCloth(),
};
for (const surface of Object.values(TEX)) {
  surface.map.colorSpace = THREE.SRGBColorSpace;
  if (surface.normalMap) surface.normalMap.colorSpace = THREE.NoColorSpace;
}

const M = {
  stone: () => new THREE.MeshStandardMaterial({
    name: 'Temple ashlar', color: 0xffffff, roughness: 0.92, metalness: 0,
    map: TEX.stone.map, normalMap: TEX.stone.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.55,
  }),
  cedar: () => new THREE.MeshStandardMaterial({
    name: 'Cedar boards', color: 0xffffff, roughness: 0.78,
    map: TEX.cedar.map, normalMap: TEX.cedar.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
  }),
  goldCedar: () => new THREE.MeshStandardMaterial({
    name: 'Interior gold overlay', color: 0xffffff, metalness: 1, roughness: 0.32,
    map: TEX.gold.map, normalMap: TEX.gold.normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.15,
    side: THREE.DoubleSide,
  }),
  gold: () => new THREE.MeshStandardMaterial({
    name: 'Beaten gold', color: 0xffffff, metalness: 1, roughness: 0.28,
    map: TEX.gold.map, normalMap: TEX.gold.normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.2,
  }),
  bronze: () => new THREE.MeshStandardMaterial({
    name: 'Molten bronze', color: 0xffffff, metalness: 1, roughness: 0.55,
    map: TEX.bronze.map, normalMap: TEX.bronze.normalMap,
    roughnessMap: TEX.bronze.roughnessMap,
    normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.05,
  }),
  olive: () => new THREE.MeshStandardMaterial({
    name: 'Olive wood', color: 0xffffff, roughness: 0.7,
    map: TEX.olive.map, normalMap: TEX.olive.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
  }),
  veil: () => detailedSurface(new THREE.MeshPhysicalMaterial({
    name: 'Veil', color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide,
    map: TEX.veil.map, normalMap: TEX.veil.normalMap,
    emissive: 0x1a1430, emissiveIntensity: 0.1,
    sheen: 0.5, sheenColor: 0x7b84aa, sheenRoughness: 0.85,
  }), 'veil-embroidery', 1, 0.003),
  platform: () => new THREE.MeshStandardMaterial({
    name: 'Moriah platform', color: 0xc4b596, roughness: 0.96, metalness: 0,
    map: TEX.stone.map, normalMap: TEX.stone.normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
  }),
};

/** A wide capital: the text measures height (5 cubits) and pomegranate count,
 *  not the profile. Two lathed bands plus a necking read as a capital without
 *  inventing a floral order. */
function bronzeCapital(radius: number, height: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const profile: [number, number][] = [
    [0, 0], [radius * 0.55, 0], [radius * 1.15, height * 0.18],
    [radius * 1.35, height * 0.45], [radius * 1.25, height * 0.72],
    [radius * 0.85, height * 0.95], [radius * 0.55, height], [0, height],
  ];
  const lathe = new THREE.Mesh(
    new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 36), mat);
  g.add(lathe);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.1, height * 0.06, 8, 28), mat);
  band.rotation.x = Math.PI / 2;
  band.position.y = height * 0.55;
  g.add(band);
  return g;
}

/** Twelve oxen supporting the sea — 1 Kgs 7:25: three facing north, three
 *  facing west, three facing south, three facing east. Anatomy is unstated;
 *  the body, head and four legs are enough to read the count. */
function bronzeOx(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat);
  body.scale.set(1.35, 0.85, 0.95);
  body.position.y = 0.55;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat);
  head.position.set(0.55, 0.62, 0);
  g.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat);
  muzzle.position.set(0.74, 0.52, 0);
  g.add(muzzle);
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), mat);
    horn.position.set(0.48, 0.82, sx * 0.12);
    horn.rotation.z = -0.5;
    horn.rotation.x = sx * 0.35;
    g.add(horn);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.48, 8), mat);
    leg.position.set(sx * 0.28, 0.24, sz * 0.22);
    g.add(leg);
  }
  return g;
}

/** One wheeled laver base — 1 Kgs 7:27-30. Four cubits square, three high,
 *  panels with lions, oxen and cherubim (itemised, not drawn as sculpture
 *  the text only names). Wheels under the four corners. */
function laverBase(cubit: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const S = cubit;
  const shell = bevelBox(4 * S, 3 * S, 4 * S, mat, S * 0.04);
  shell.position.y = 1.5 * S;
  g.add(shell);
  // A raised rim at the top where the basin sits (7:39).
  const rim = bevelBox(4.15 * S, 0.18 * S, 4.15 * S, mat, S * 0.03);
  rim.position.y = 3.05 * S;
  g.add(rim);
  // Basin on the stand — 7:38. Capacity 40 baths is stated; the rim profile
  // is not, so this is a simple lathed bowl.
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(([
      [0, 0], [1.55, 0.05], [1.7, 0.25], [1.65, 0.55], [1.45, 0.7], [1.35, 0.55],
      [1.2, 0.2], [0, 0.12],
    ] as [number, number][]).map(([r, y]) => new THREE.Vector2(r * S, y * S)), 28),
    mat);
  bowl.position.y = 3.14 * S;
  g.add(bowl);
  // Wheels — 7:30, "four undersetters… and the four corners had undersetters".
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(S * 0.38, S * 0.09, 8, 20), mat);
    wheel.position.set(sx * S * 1.55, S * 0.38, sz * S * 1.7);
    wheel.rotation.y = Math.PI / 2;
    g.add(wheel);
  }
  // Stylised panel relief: a raised rectangle on each face, because 7:29
  // itemises lions, oxen and cherubim between the panels without giving
  // proportions. Abstract relief, not a claimed reconstruction of the art.
  for (const [ax, sign] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]] as const) {
    const panel = bevelBox(
      ax === 'x' ? 0.06 * S : 3.1 * S, 2.1 * S, ax === 'z' ? 0.06 * S : 3.1 * S,
      mat, S * 0.02);
    panel.position.set(
      ax === 'x' ? sign * 2.02 * S : 0,
      1.55 * S,
      ax === 'z' ? sign * 2.02 * S : 0);
    g.add(panel);
  }
  return g;
}

/** Olive-wood folding door leaf with five-sided posts — 1 Kgs 6:31-34.
 *  Carved cherubim, palm trees and open flowers are named; their scale is
 *  not, so the relief is geometric, not figurative sculpture. */
function templeDoor(
  height: number, width: number, thickness: number,
  wood: THREE.Material, gold: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const leafW = width / 2 - height * 0.01;
    const leaf = bevelBox(leafW, height, thickness, wood, 0.004);
    leaf.position.set(side * (width / 4), height / 2, 0);
    g.add(leaf);
    // Gold overlay — 6:32 "the two doors also were of olive tree… and he
    // overlaid them with gold".
    const face = bevelBox(leafW * 0.92, height * 0.94, thickness * 0.15, gold, 0.002);
    face.position.set(side * (width / 4), height / 2, thickness * 0.5);
    g.add(face);
    // Carved palm-and-flower motif: a vertical trunk with three open cups.
    const trunk = new THREE.Mesh(
      new THREE.BoxGeometry(leafW * 0.08, height * 0.72, thickness * 0.08), gold);
    trunk.position.set(side * (width / 4), height * 0.5, thickness * 0.58);
    g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const cup = new THREE.Mesh(new THREE.SphereGeometry(leafW * 0.1, 10, 8), gold);
      cup.position.set(side * (width / 4), height * (0.28 + i * 0.2), thickness * 0.58);
      cup.scale.set(1, 0.55, 0.45);
      g.add(cup);
    }
  }
  // Five-sided posts — 6:31 "posts of olive tree". Five faces, so a cylinder
  // of five segments rather than a square or a round one.
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(height * 0.035, height * 0.04, height * 1.04, 5), wood);
    post.position.set(side * (width / 2 + height * 0.04), height * 0.52, 0);
    g.add(post);
  }
  return g;
}

/** Standing cherub for the oracle — olive wood, 10 cubits high, wings 5+5
 *  so that each wingtip meets the wall and its fellow's — 1 Kgs 6:23-28.
 *  Anatomy beyond height, wing span and outstretched pose is unstated. */
function templeCherub(height: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const H = height;
  // Robe / body as a tapered lathe.
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(([
      [H * 0.28, 0], [H * 0.22, H * 0.12], [H * 0.16, H * 0.35],
      [H * 0.13, H * 0.55], [H * 0.11, H * 0.72], [H * 0.07, H * 0.82],
      [0, H * 0.86],
    ] as [number, number][]).map(([r, y]) => new THREE.Vector2(r, y)), 24),
    mat);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(H * 0.07, 16, 12), mat);
  head.position.y = H * 0.9;
  g.add(head);
  // Two wings, each 5 cubits, stretched out so the tips meet in the middle
  // of the room and also reach the walls. Drawn as thick swept planes.
  const wingLen = H * 0.5;
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(wingLen * 0.55, H * 0.28, wingLen, H * 0.12);
    shape.quadraticCurveTo(wingLen * 0.7, H * 0.02, wingLen * 0.45, -H * 0.02);
    shape.quadraticCurveTo(wingLen * 0.2, -H * 0.04, 0, -H * 0.02);
    shape.closePath();
    const wing = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: H * 0.025, bevelEnabled: true, bevelSize: H * 0.008, bevelThickness: H * 0.006, bevelSegments: 2 }),
      mat);
    wing.position.set(side * H * 0.08, H * 0.72, -H * 0.01);
    wing.rotation.y = side > 0 ? 0 : Math.PI;
    // Outer tip up: the text says the wings were stretched forth.
    wing.rotation.z = side * -0.35;
    g.add(wing);
  }
  return g;
}

export function buildTemple(cubit: number): Temple {
  const g = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const C = (n: number) => n * cubit;
  const counts: TempleCounts = {
    pillars: 0, pomegranates: 0, oxen: 0, lavers: 0, cherubim: 0, sideChambers: 0,
  };

  const addCollider = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, false);
    colliders.push(new THREE.Box3().setFromObject(o));
  };

  const stone = M.stone();
  const cedar = M.cedar();
  const gold = M.gold();
  const goldWall = M.goldCedar();
  const bronze = M.bronze();
  const olive = M.olive();

  // ── the site: Mount Moriah, a dressed platform (2 Chron 3:1) ──────────
  // Scripture gives the threshing floor, not a terrace plan. The platform is
  // display: large enough to stand the house and the court furnishings the
  // text places around it, edged as dressed stone, falling away into hills.
  const platW = C(160), platD = C(120);
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(platW, C(3), platD),
    M.platform(),
  );
  platform.position.y = -C(1.5);
  platform.receiveShadow = true;
  platform.userData.noCast = true;
  g.add(platform);

  // Hills of generic highland — not a surveyed Jerusalem skyline. Geometry,
  // not a painted backdrop, so the terrace sits in a landscape.
  const hills = new THREE.Group();
  hills.name = 'Illustrative highland around Moriah';
  const hillMat = new THREE.MeshStandardMaterial({ color: 0xb5a48a, roughness: 0.98 });
  for (const [hx, hz, hs, hy] of [
    [-180, -120, 55, 0], [-200, 80, 42, 0], [-40, -200, 48, 0],
    [160, -150, 50, 0], [190, 110, 40, 0], [40, 190, 45, 0],
    [-90, 160, 38, 0],
  ] as [number, number, number, number][]) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(hs, 20, 14), hillMat);
    mound.scale.y = 0.38;
    mound.position.set(C(hx), C(hy) - C(2), C(hz));
    mound.userData.noCast = true;
    hills.add(mound);
  }
  g.add(hills);

  // ── house massing, 1 Kgs 6:2 ──────────────────────────────────────────
  // 60 long (east–west), 20 wide, 30 high. Front faces east (+x).
  const houseL = C(60), houseW = C(20), houseH = C(30);
  const wall = C(1);   // unstated thickness; 1 cubit keeps the interior
                       // dimensions equal to the stated exterior measures.
  const frontX = houseL / 2;          // +30
  const rearX = -houseL / 2;          // −30
  const halfW = houseW / 2;           // ±10

  // Debir / most holy place: rear 20 cubits, a cube — 6:16-17, 6:20.
  const debirL = C(20), debirH = C(20);
  const debirFrontX = rearX + debirL;  // −10
  // Hekal / holy place: the remaining 40 cubits — 6:17.
  const hekalL = C(40);

  // Interior floor of cypress overlaid with gold — 6:30. Visible through the
  // open door; the exterior ground is the stone platform.
  const floor = bevelBox(houseL - wall * 2, C(0.15), houseW - wall * 2, goldWall, 0.004);
  floor.position.y = C(0.075);
  g.add(floor);
  addCollider(floor);

  /** One exterior wall face of ashlar, with optional door opening. */
  function ashlarFace(
    w: number, h: number, t: number,
    pos: THREE.Vector3, rotY = 0, door?: { w: number; h: number },
  ) {
    if (!door) {
      const m = bevelBox(w, h, t, stone, 0.01);
      m.position.copy(pos);
      m.rotation.y = rotY;
      g.add(m);
      addCollider(m);
      return;
    }
    // Lintel over the door and jambs on each side.
    const sideW = (w - door.w) / 2;
    const lintelH = h - door.h;
    for (const sx of [-1, 1]) {
      const jamb = bevelBox(sideW, h, t, stone, 0.01);
      jamb.position.copy(pos);
      jamb.rotation.y = rotY;
      // Offset in local space along the wall's local x.
      const local = new THREE.Vector3(sx * (door.w / 2 + sideW / 2), 0, 0);
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      jamb.position.add(local);
      g.add(jamb);
      addCollider(jamb);
    }
    const lintel = bevelBox(door.w, lintelH, t, stone, 0.01);
    lintel.position.copy(pos);
    lintel.rotation.y = rotY;
    const up = new THREE.Vector3(0, door.h + lintelH / 2, 0);
    lintel.position.add(up);
    g.add(lintel);
    addCollider(lintel);
  }

  // The house door: unstated width. A 6-cubit (≈2.7 m) opening is the
  // traditional reading of a temple gate proportionate to a 20-cubit front;
  // the unstated section on the card owns this choice.
  const doorW = C(6), doorH = C(12);

  // North and south long walls (60 × 30). Side chambers sit outside them.
  ashlarFace(houseL, houseH, wall,
    new THREE.Vector3(0, houseH / 2, halfW + wall / 2), 0);
  ashlarFace(houseL, houseH, wall,
    new THREE.Vector3(0, houseH / 2, -(halfW + wall / 2)), 0);
  // West rear wall.
  ashlarFace(houseW, houseH, wall,
    new THREE.Vector3(rearX - wall / 2, houseH / 2, 0), Math.PI / 2);
  // East front wall, with the door.
  ashlarFace(houseW, houseH, wall,
    new THREE.Vector3(frontX + wall / 2, houseH / 2, 0), Math.PI / 2,
    { w: doorW, h: doorH });

  // Cedar lining of the hekal — 6:15 "he built the walls of the house within
  // with boards of cedar". Gold comes after; the gold overlay is drawn as a
  // thin inner face so both materials are present without z-fighting.
  // Hollow it by scaling a smaller subtractive impression: three.js has no
  // CSG here, so the lining is six faces rather than a solid box.
  function lining(
    w: number, h: number, d: number, mat: THREE.Material, pos: THREE.Vector3,
    only?: 'floor' | 'ceil' | 'walls',
  ) {
    const t = C(0.08);
    if (only !== 'ceil') {
      const f = bevelBox(w, t, d, mat, 0.002);
      f.position.copy(pos); f.position.y = pos.y + t / 2;
      g.add(f);
    }
    if (only !== 'floor') {
      const c = bevelBox(w, t, d, mat, 0.002);
      c.position.copy(pos); c.position.y = pos.y + h - t / 2;
      g.add(c);
    }
    if (only !== 'floor' && only !== 'ceil') {
      for (const sz of [-1, 1]) {
        const s = bevelBox(w, h, t, mat, 0.002);
        s.position.copy(pos);
        s.position.z = pos.z + sz * (d / 2 - t / 2);
        g.add(s);
      }
      for (const sx of [-1, 1]) {
        const e = bevelBox(t, h, d - t * 2, mat, 0.002);
        e.position.copy(pos);
        e.position.x = pos.x + sx * (w / 2 - t / 2);
        g.add(e);
      }
    }
  }

  // Hekal interior: cedar over the stone, from floor to ceiling — 6:15.
  lining(hekalL, houseH, houseW - wall * 2, cedar,
    new THREE.Vector3((frontX + debirFrontX) / 2, 0, 0));

  // Debir interior: pure gold on every face — 6:20-21. "There was nothing in
  // the house that was not covered with gold."
  lining(debirL, debirH, houseW - wall * 2, goldWall,
    new THREE.Vector3((rearX + debirFrontX) / 2, 0, 0));

  // The ceiling of the hekal is cedar; the oracle's is gold (already in the
  // lining). A flat ceiling: 6:9 gives the height of the house (30 cubits)
  // but never a roof pitch, so this model does not invent a gable.
  const roof = bevelBox(houseL, C(0.4), houseW, stone, 0.01);
  roof.position.y = houseH + C(0.2);
  g.add(roof);
  addCollider(roof);

  // The olive-wood doors of the temple — 6:31-34. Hung in the east opening.
  const door = templeDoor(doorH, doorW, C(0.2), olive, gold);
  door.position.set(frontX, 0, 0);
  door.rotation.y = -Math.PI / 2;
  g.add(door);
  addCollider(door);

  // ── the veil, 2 Chron 3:14 ────────────────────────────────────────────
  // "An oracle of blue, and purple, and crimson, and fine linen, and made
  // cherubim thereon." Hung between hekal and debir at x = −10.
  const veil = hanging(houseW - wall * 2, debirH * 0.98, M.veil(), C(3));
  veil.rotation.y = Math.PI / 2;
  veil.position.set(debirFrontX, 0, 0);
  g.add(veil);
  // Deliberately no free walk through: the educational tour cuts past it,
  // the way the tabernacle's does. A collider keeps WASD out.
  addCollider(veil);

  // ── cherubim of the oracle, 1 Kgs 6:23-28 ─────────────────────────────
  // Ten cubits high; each wing five cubits, so that the wings of one
  // touched one wall, the wings of the other the other wall, and their
  // wings met in the midst of the house — a twenty-cubit span across a
  // twenty-cubit room. They therefore stand ten cubits apart across the
  // width (z), each wing reaching the centre and the near wall.
  const cherubMat = gold;
  for (const sz of [-1, 1]) {
    const cherub = templeCherub(C(10), cherubMat);
    // sz=−1 sits at z=−5 with wings extending +z (toward the centre);
    // sz=+1 sits at z=+5 with wings extending −z. Facing each other along x.
    cherub.position.set((rearX + debirFrontX) / 2, 0, sz * C(5));
    cherub.rotation.y = sz > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(cherub);
    addCollider(cherub);
    counts.cherubim++;
  }

  // ── the holy-place furnishings ────────────────────────────────────────
  // 1 Kings 6–7 does not re-measure the lampstand, table and incense altar
  // that came from the tabernacle (1 Kgs 7:48 says they were brought in).
  // Exodus measures them; this walk places them with the Exodus dimensions
  // already used on the tabernacle page.
  const holyMidX = (frontX + debirFrontX) / 2;

  const { group: lamp } = buildMenorah(1.5);
  lamp.children[0]!.visible = false;
  lamp.remove(lamp.children[0]!);
  const lampFoot = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [0.25, 0.01], [0.27, 0.04], [0.24, 0.08], [0.13, 0.13], [0.065, 0.22]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 40), gold);
  lamp.add(lampFoot);
  lamp.traverse((o) => { if (o instanceof THREE.Mesh) o.material = gold; });
  lamp.position.set(holyMidX + C(4), 0, -halfW * 0.55);
  g.add(lamp);
  addCollider(lamp);

  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const unit = 1.5 / 8.6;
  const lampY = 7.5 * unit;
  for (const u of [0, -2.15, 2.15, -2.93, 2.93, -3.71, 3.71]) {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), flameMat);
    flame.scale.set(0.7, 2, 1);
    flame.position.set(holyMidX + C(4) + u * unit + 0.045, lampY + 0.046, -halfW * 0.55);
    g.add(flame);
  }
  const glow = new THREE.PointLight(0xffc87e, 1.4, 28, 2);
  glow.position.set(holyMidX + C(4), lampY + 0.4, -halfW * 0.55);
  g.add(glow);
  // Educational fill in the oracle so the gold and the cherubim read. Disclosed
  // in the evidence dialog — not a claim about what lit that room.
  const oracleFill = new THREE.PointLight(0xffe0a8, 1.8, 40, 2);
  oracleFill.position.set((rearX + debirFrontX) / 2 + C(4), C(8), 0);
  g.add(oracleFill);

  // Table of the Presence — Exodus 25:23; brought in per 1 Kgs 7:48.
  const table = new THREE.Group();
  const top = bevelBox(C(2), C(0.12), C(1), gold);
  top.position.y = C(1.44);
  table.add(top);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(C(0.07), C(0.07), C(1.5), 10), gold);
    leg.position.set(sx * C(0.88), C(0.75), sz * C(0.38));
    table.add(leg);
  }
  table.position.set(holyMidX + C(4), 0, halfW * 0.55);
  g.add(table);
  addCollider(table);

  // Altar of incense — Exodus 30:1-2, placed before the veil (1 Kgs 6:22).
  const incense = new THREE.Group();
  const iBody = bevelBox(C(1), C(2), C(1), gold, 0.01);
  iBody.position.y = C(1);
  incense.add(iBody);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const horn = altarHorn(C(0.25), C(0.06), gold);
    horn.rotation.y = Math.atan2(-sz, sx);
    horn.position.set(sx * C(0.42), C(2), sz * C(0.42));
    incense.add(horn);
  }
  incense.position.set(debirFrontX + C(2.5), 0, 0);
  g.add(incense);
  addCollider(incense);

  // "Chains of gold before the oracle" — 1 Kgs 6:21. Two chains across the
  // veil, so the room has the partition the text describes.
  for (const sz of [-1, 1]) {
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(C(0.35), C(0.04), 6, 18), gold);
    chain.position.set(debirFrontX - C(0.3), C(14), sz * C(6));
    chain.rotation.y = Math.PI / 2;
    g.add(chain);
  }

  // ── the porch, 1 Kgs 6:3 ──────────────────────────────────────────────
  // Twenty cubits across the front (matching the house breadth), ten in
  // front of the house. Height of the porch body uses the house height;
  // 2 Chron 3:3's "height 120" is carried on the structure card as a
  // disputed reading, not as a 120-cubit porch.
  const porchD = C(10);
  const porchCX = frontX + wall + porchD / 2;
  // Side walls of the porch.
  for (const sz of [-1, 1]) {
    const side = bevelBox(porchD, houseH, wall, stone, 0.01);
    side.position.set(porchCX, houseH / 2, sz * (halfW - wall / 2));
    g.add(side);
    addCollider(side);
  }
  // A flat porch roof at house height.
  const porchRoof = bevelBox(porchD + wall, C(0.4), houseW, stone, 0.01);
  porchRoof.position.set(porchCX + wall / 2, houseH + C(0.2), 0);
  g.add(porchRoof);
  // Porch floor.
  const porchFloor = bevelBox(porchD, C(0.2), houseW - wall, stone, 0.008);
  porchFloor.position.set(porchCX, C(0.1), 0);
  g.add(porchFloor);
  addCollider(porchFloor);

  // ── Jachin and Boaz, 1 Kgs 7:15-22 ────────────────────────────────────
  // Two pillars of brass in front of the porch. Height 18 cubits, twelve in
  // circumference (so r = 12/2π). Capitals five cubits, with pomegranates
  // (1 Kgs 7:20: two hundred per capital; 2 Chron 3:16: a hundred — the
  // card carries both). Names: the right pillar Jachin, the left Boaz.
  // Standing east of the temple looking west, the right hand is north.
  const pillarH = C(18), pillarC = C(12);
  const pillarR = pillarC / (2 * Math.PI);
  const capH = C(5);
  function raisedPillar(z: number, name: string) {
    const p = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(pillarR, pillarR * 1.06, pillarH, 28), bronze);
    shaft.position.y = pillarH / 2;
    p.add(shaft);
    // A moulded base the shaft stands on — the text does not describe one;
    // a bare cylinder sitting on stone reads as unfinished. Display only.
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(pillarR * 1.35, pillarR * 1.5, C(0.6), 28), bronze);
    base.position.y = C(0.3);
    p.add(base);
    const cap = bronzeCapital(pillarR * 1.05, capH, bronze);
    cap.position.y = pillarH;
    p.add(cap);
    // Pomegranates: two hundred on the capital (1 Kgs 7:20). Drawn as a
    // ring of small spheres at two rows — the count is the claim, the fruit
    // form is not specified.
    const rowOf = 50;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < rowOf; i++) {
        const a = (i / rowOf) * Math.PI * 2 + row * 0.04;
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(C(0.08), 6, 5), bronze);
        const rr = pillarR * (1.2 - row * 0.15);
        fruit.position.set(
          Math.cos(a) * rr,
          pillarH + capH * (0.35 + row * 0.35),
          Math.sin(a) * rr);
        p.add(fruit);
        counts.pomegranates++;
      }
    }
    p.position.set(frontX + porchD + C(4), 0, z);
    g.add(p);
    addCollider(p);
    counts.pillars++;
    return p;
  }
  // Jachin on the right of one facing the temple from the east = north (+z).
  const jachinZ = halfW * 0.55;
  const boazZ = -halfW * 0.55;
  raisedPillar(jachinZ, 'Jachin');
  raisedPillar(boazZ, 'Boaz');

  // ── the molten sea, 1 Kgs 7:23-26 ─────────────────────────────────────
  // Ten cubits from brim to brim, five high, thirty in circumference,
  // standing on twelve oxen. Capacity 2,000 baths (1 Kgs 7:26) / 3,000
  // (2 Chron 4:5) — reported on the card, not resolved here.
  const seaR = C(5), seaH = C(5);
  const sea = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(([
      [0, 0.08], [seaR * 0.55, 0.05], [seaR * 0.82, 0.2], [seaR * 0.95, seaH * 0.55],
      [seaR, seaH * 0.92], [seaR * 0.92, seaH], [seaR * 0.88, seaH * 0.92],
      [seaR * 0.85, seaH * 0.5], [seaR * 0.5, seaH * 0.08], [0, 0.1],
    ] as [number, number][]).map(([r, y]) => new THREE.Vector2(r, y)), 40),
    bronze);
  bowl.geometry.computeVertexNormals();
  bowl.position.y = C(2.2);
  sea.add(bowl);
  // A handbreadth rim is stated (7:26); the exact conversion is not. Drawn
  // as a lip about 4 cm at the common cubit.
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(seaR * 0.96, C(0.08), 8, 40), bronze);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = C(2.2) + seaH * 0.98;
  sea.add(lip);
  // Twelve oxen, three looking to each of the four cardinal faces — 7:25.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ox = bronzeOx(bronze);
    ox.position.set(Math.cos(a) * C(2.4), 0, Math.sin(a) * C(2.4));
    ox.rotation.y = -a;   // each looks outward
    // The text says they faced outward (three to each quarter).
    ox.scale.setScalar(C(1.15) / 0.85);
    sea.add(ox);
    counts.oxen++;
  }
  // Place the sea south of the house, east of the side chambers — inside the
  // court. 1 Kgs 7:39 puts it on the right of one entering the east gate,
  // i.e. the south side. Dimensions of the court are not stated; the
  // platform and this wall are display, sized to hold the furnishings.
  sea.position.set(frontX + C(12), 0, -halfW - C(14));
  g.add(sea);
  addCollider(sea);

  // ── ten lavers and their stands, 1 Kgs 7:27-39 ────────────────────────
  // Five on the right (south) side of the house, five on the left (north).
  // Each stand 4 × 4 × 3 cubits, each basin holding forty baths.
  for (let i = 0; i < 5; i++) {
    for (const sz of [-1, 1]) {
      const stand = laverBase(cubit, bronze);
      const lx = -C(18) + i * C(10);
      const lz = sz * (halfW + C(8));
      stand.position.set(lx, 0, lz);
      g.add(stand);
      addCollider(stand);
      counts.lavers++;
    }
  }

  // ── the bronze altar, 2 Chron 4:1 ─────────────────────────────────────
  // Twenty cubits square, ten high — a different altar from the tabernacle's
  // five-cubit bronze altar. Stands before the house, in front of the porch.
  const altarL = C(20), altarH = C(10);
  const altar = new THREE.Group();
  for (const side of [-1, 1]) {
    const wallA = bevelBox(altarL, altarH, C(0.25), bronze, 0.012);
    wallA.position.set(0, altarH / 2, side * (altarL / 2 - C(0.125)));
    altar.add(wallA);
    const end = bevelBox(C(0.25), altarH, altarL - C(0.5), bronze, 0.012);
    end.position.set(side * (altarL / 2 - C(0.125)), altarH / 2, 0);
    altar.add(end);
  }
  // Horns on the four corners, as the bronze altars always have (1 Kgs 1:50;
  // Exodus 27:2 for the tabernacle's). Form is interpretive.
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const horn = altarHorn(C(1.2), C(0.28), bronze);
    horn.rotation.y = Math.atan2(-dz, dx);
    horn.position.set(dx * (altarL / 2 - C(0.2)), altarH, dz * (altarL / 2 - C(0.2)));
    altar.add(horn);
  }
  altar.position.set(frontX + porchD + C(20), 0, 0);
  g.add(altar);
  addCollider(altar);

  // ── side chambers, 1 Kgs 6:5-10 ───────────────────────────────────────
  // Three storeys around the north, south and west sides of the house —
  // not the front. Lower five, middle six, upper seven cubits of floor
  // height; each chamber five cubits high to its ceiling. A rest (offset)
  // in the wall lets the beams sit without boring into the house wall.
  // Chamber width is not stated; five cubits matches the storey height and
  // is the common reading.
  const chamberW = C(5);
  const stories: { y0: number; h: number }[] = [
    { y0: 0, h: C(5) },
    { y0: C(5), h: C(6) },   // floor heights 5 and 5+6=11 per 6:6
    { y0: C(11), h: C(7) },  // upper floor at 11, seven up to 18
  ];
  for (const st of stories) {
    // Along the north and south flanks of the house only — not the porch.
    // House runs x −30…+30; chambers sit just outside those walls.
    for (const sz of [-1, 1]) {
      const run = houseL - C(4);
      const n = 5;
      for (let i = 0; i < n; i++) {
        const cw = run / n;
        const chamber = bevelBox(cw * 0.92, st.h, chamberW, stone, 0.008);
        chamber.position.set(
          rearX + C(2) + i * cw + cw / 2,
          st.y0 + st.h / 2,
          sz * (halfW + wall + chamberW / 2));
        g.add(chamber);
        addCollider(chamber);
        counts.sideChambers++;
      }
    }
    // West run.
    const nW = 3;
    for (let i = 0; i < nW; i++) {
      const cw = houseW / nW;
      const chamber = bevelBox(chamberW, st.h, cw * 0.9, stone, 0.008);
      chamber.position.set(
        rearX - wall - chamberW / 2,
        st.y0 + st.h / 2,
        -halfW + cw / 2 + i * cw);
      g.add(chamber);
      addCollider(chamber);
      counts.sideChambers++;
    }
  }

  // ── the inner court wall, 1 Kgs 6:36 ──────────────────────────────────
  // "Three rows of hewn stone, and a row of cedar beams." The court's
  // dimensions are never stated for Solomon's temple, so this wall is drawn
  // as a partial enclosure around the house and the furnishings the text
  // places beside it — not as a measured rectangle the passage never gave.
  const courtHalfX = C(72), courtHalfZ = C(38);
  const courseH = C(1.2);
  function courtRun(from: THREE.Vector3, to: THREE.Vector3) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const yaw = -Math.atan2(dir.z, dir.x);
    for (let row = 0; row < 3; row++) {
      const beam = bevelBox(len, courseH, C(0.8), stone, 0.008);
      beam.position.set(mid.x, courseH * (row + 0.5), mid.z);
      beam.rotation.y = yaw;
      g.add(beam);
    }
    const cedarRow = bevelBox(len, C(0.35), C(0.85), cedar, 0.006);
    cedarRow.position.set(mid.x, courseH * 3 + C(0.17), mid.z);
    cedarRow.rotation.y = yaw;
    g.add(cedarRow);
    // A single opening in the east wall for the approach.
  }
  // East wall split for a gate.
  const gateHalf = C(8);
  courtRun(new THREE.Vector3(courtHalfX, 0, courtHalfZ), new THREE.Vector3(courtHalfX, 0, gateHalf));
  courtRun(new THREE.Vector3(courtHalfX, 0, -gateHalf), new THREE.Vector3(courtHalfX, 0, -courtHalfZ));
  courtRun(new THREE.Vector3(courtHalfX, 0, courtHalfZ), new THREE.Vector3(-courtHalfX, 0, courtHalfZ));
  courtRun(new THREE.Vector3(courtHalfX, 0, -courtHalfZ), new THREE.Vector3(-courtHalfX, 0, -courtHalfZ));
  courtRun(new THREE.Vector3(-courtHalfX, 0, courtHalfZ), new THREE.Vector3(-courtHalfX, 0, -courtHalfZ));

  // Batch static geometry so the many pomegranates and chamber boxes do not
  // become hundreds of draw calls. Dynamic/flicker pieces opt out via
  // userData.dynamic (flames already are MeshBasic, and gold/bronze share
  // materials so they batch cleanly).
  batchStatic(g);

  const anchors = {
    porch: new THREE.Vector3(porchCX, 0, 0),
    holy: new THREE.Vector3(holyMidX, 0, 0),
    debir: new THREE.Vector3((rearX + debirFrontX) / 2, 0, 0),
    sea: sea.position.clone(),
    jachin: new THREE.Vector3(frontX + porchD + C(4), 0, jachinZ),
    boaz: new THREE.Vector3(frontX + porchD + C(4), 0, boazZ),
    altar: altar.position.clone(),
  };

  return { group: g, colliders, counts, anchors };
}
