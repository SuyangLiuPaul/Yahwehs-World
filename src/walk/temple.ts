import * as THREE from 'three';
import { buildMenorah } from '../structures/menorah.ts';
import { buildStructure } from '../structures/build.ts';
import { STRUCTURES } from '../structures/specs.ts';
import { buildPillar, buildSea, buildLaver, buildStandingCherub } from '../structures/temple-parts.ts';
import {
  ashlarStone, beatenGold, bronze as bronzeTex, cedarWood, oliveWood, veilCloth,
  carvedGold, goldPlanks, bronzePanel,
} from './textures.ts';
import { bevelBox, hanging, batchStatic, altarHorn } from './craft.ts';
import { detailedSurface } from './materials.ts';
import { buildDesert } from './environment.ts';

// Solomon's temple, generated from the counts the text states.
//
// Primary passages: 1 Kings 6–8 and 2 Chronicles 3–4. Scripture measures this
// building more densely than any other object in the canon except Ezekiel's
// never-built temple — and every number below is one of those measurements.
// The first version of this file got the massing right and the house wrong:
// it lined the holy place with bare cedar when 6:21–22 say the whole house
// was overlaid with gold, carved with cherubim, palms and open flowers
// (6:29); it drew the cherubim facing each other when 2 Chr 3:13 has them
// facing the holy place; it called the door width unstated when 6:31 and
// 6:33 give it as a fraction of the wall; it forgot the ten lampstands, the
// ten tables, the windows, the ark, the gourds on the sea and the wheels on
// the bases. This version is built from the verses, read again.
//
//   1 Kgs 6:2     house 60 × 20 × 30 cubits
//   1 Kgs 6:3     porch 20 across the front, 10 deep
//   1 Kgs 6:4     windows, narrow and latticed ("严紧的窗棂")
//   1 Kgs 6:5–6   three storeys of side chambers round the house: 5, 6, 7
//                 wide, the beams resting on ledges, not in the wall
//   1 Kgs 6:8     the door to the chambers on the right (south) side, midway,
//                 with a winding stair inside
//   1 Kgs 6:9     roof of cedar beams and boards
//   1 Kgs 6:10    each storey five cubits high
//   1 Kgs 6:15    cedar on the walls floor to ceiling; cypress on the floor
//   1 Kgs 6:16–17 oracle 20 cubits at the rear; the house before it 40
//   1 Kgs 6:18    gourds and open flowers carved in the cedar; no stone seen
//   1 Kgs 6:20    oracle 20 × 20 × 20, overlaid with pure gold; the altar of
//                 cedar overlaid with gold
//   1 Kgs 6:21–22 the whole house overlaid with gold; chains of gold across
//                 the front of the oracle
//   1 Kgs 6:23–28 two cherubim of olive wood, 10 high, wings 5 + 5, the tips
//                 touching the walls and each other; overlaid with gold
//   1 Kgs 6:29    on all the walls, both rooms, carved cherubim, palms, open
//                 flowers
//   1 Kgs 6:30    the floor of both rooms overlaid with gold
//   1 Kgs 6:31–32 the oracle's doors of olive wood, a fifth of the wall
//                 (= 4 cubits), carved and gilded
//   1 Kgs 6:33–35 the house door: olive posts a fourth of the wall (= 5
//                 cubits), two folding leaves of cypress, carved and gilded
//   1 Kgs 6:36    the inner court: three courses of hewn stone, one of cedar
//   1 Kgs 7:15–22 Jachin and Boaz — see temple-parts.ts
//   1 Kgs 7:23–26 the molten sea — see temple-parts.ts
//   1 Kgs 7:27–39 ten bases and ten lavers, five each side; the sea on the
//                 south-east
//   1 Kgs 7:48–49 the golden altar, the table of the bread, ten lampstands
//                 five right and five left before the oracle
//   1 Kgs 8:6–8   the ark set under the cherubim's wings; the pole ends seen
//                 from the holy place
//   2 Chr 3:1     the site: Mount Moriah
//   2 Chr 3:4     the porch overlaid with gold within
//   2 Chr 3:13    the cherubim stand facing the house (the holy place)
//   2 Chr 3:14    the veil of blue, purple, crimson and fine linen, cherubim
//                 worked in it
//   2 Chr 4:1     the bronze altar, 20 × 20 × 10
//   2 Chr 4:7–8   ten lampstands and ten tables, five a side
//   2 Chr 4:9     the court gates overlaid with bronze
//
// Readings this model must NOT silently settle (the card carries both):
//   · pillars 18 cubits (1 Kgs 7:15) or 35 (2 Chr 3:15) — 18 is drawn
//   · pomegranates 200 (1 Kgs 7:20) or 100 (2 Chr 3:16) — 200 are drawn
//   · the sea 2,000 baths (1 Kgs 7:26) or 3,000 (2 Chr 4:5) — reported only
//   · the porch 120 high (2 Chr 3:4) — the house height is used
//   · one table (1 Kgs 7:48) or ten (2 Chr 4:8) — ten, one carrying the bread
//
// Not stated, and therefore display rather than measurement: roof pitch
// (flat), wall thickness (1 cubit), door heights, the number and size of the
// windows, the extent of the court, the profile of the sea's bowl, the form
// of the cherubim beyond height and span, the relief figures (silhouettes
// only), and a ramp to the altar (Exodus 20:26 forbids steps).

export interface Part { mesh: THREE.Object3D; ref: string; zh: string }

/** What the builder actually produced. Every field is a number the text
 *  gives — no "39 side chambers": the text counts storeys, not rooms. */
export interface TempleCounts {
  pillars: number;
  pomegranates: number;
  oxen: number;
  gourds: number;
  lavers: number;
  lampstands: number;
  tables: number;
  cherubim: number;
  storeys: number;
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
  carved: carvedGold(2.6),
  planks: goldPlanks(),
  bronze: bronzeTex(),
  panel: bronzePanel(),
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
  // A touch under white: at full strength the sunlit faces blew out to a
  // flat sheet and the courses in the texture vanished with them.
  stone: () => new THREE.MeshStandardMaterial({
    name: 'Temple ashlar', color: 0xe4d9c2, roughness: 0.92, metalness: 0,
    map: TEX.stone.map, normalMap: TEX.stone.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.55,
  }),
  cedar: () => new THREE.MeshStandardMaterial({
    name: 'Cedar', color: 0xffffff, roughness: 0.78,
    map: TEX.cedar.map, normalMap: TEX.cedar.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
  }),
  // 6:29 on 6:22: the carving in the normal map, the gold in the colour.
  // Named "Interior …" so the page's reflection probe finds it.
  carvedGold: () => new THREE.MeshStandardMaterial({
    name: 'Interior carved gold', color: 0xffffff, metalness: 1, roughness: 0.34,
    map: TEX.carved.map, normalMap: TEX.carved.normalMap, roughnessMap: TEX.carved.roughnessMap,
    normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 1.15, side: THREE.DoubleSide,
  }),
  floorGold: () => new THREE.MeshStandardMaterial({
    name: 'Interior gold floor', color: 0xffffff, metalness: 1, roughness: 0.42,
    map: TEX.planks.map, normalMap: TEX.planks.normalMap, roughnessMap: TEX.planks.roughnessMap,
    normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.0,
  }),
  gold: () => new THREE.MeshStandardMaterial({
    name: 'Interior beaten gold', color: 0xffffff, metalness: 1, roughness: 0.28,
    map: TEX.gold.map, normalMap: TEX.gold.normalMap, roughnessMap: TEX.gold.roughnessMap,
    normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.2,
  }),
  bronze: () => new THREE.MeshStandardMaterial({
    name: 'Molten bronze', color: 0xffffff, metalness: 1, roughness: 0.52,
    map: TEX.bronze.map, normalMap: TEX.bronze.normalMap, roughnessMap: TEX.bronze.roughnessMap,
    normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.05,
  }),
  panel: () => new THREE.MeshStandardMaterial({
    name: 'Cast bronze panel', color: 0xffffff, metalness: 1, roughness: 0.5,
    map: TEX.panel.map, normalMap: TEX.panel.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 1.0,
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
  paving: () => new THREE.MeshStandardMaterial({
    name: 'Court paving', color: 0xd9ccb2, roughness: 0.96, metalness: 0,
    map: TEX.stone.map, normalMap: TEX.stone.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
  }),
};

/** A door of two leaves hung on posts, each leaf folding in two (6:34), all
 *  standing open — a shut door was a wall the tour flew through. The relief
 *  of 6:32/35 (cherubim, palms, open flowers) is the carved-gold surface. */
function foldingDoor(
  height: number, width: number, thickness: number,
  wood: THREE.Material, carved: THREE.Material, open: number, fold: number,
): THREE.Group {
  const g = new THREE.Group();
  const leaves: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leafW = width / 2 - height * 0.006;
    const hinge = new THREE.Group();
    hinge.position.set(side * (width / 2), 0, 0);
    hinge.rotation.y = -side * open;
    g.add(hinge);
    leaves.push(hinge);
    // Each leaf is two panels; the outer panel hangs from the post, the
    // inner one folds back on it.
    const panelW = leafW / 2;
    const outer = bevelBox(panelW, height, thickness, wood, 0.004);
    outer.position.set(-side * panelW / 2, height / 2, 0);
    hinge.add(outer);
    const gilt = bevelBox(panelW * 0.9, height * 0.95, thickness * 0.3, carved, 0.002);
    gilt.position.set(-side * panelW / 2, height / 2, thickness * 0.55);
    hinge.add(gilt);
    const knuckle = new THREE.Group();
    knuckle.position.set(-side * panelW, 0, 0);
    knuckle.rotation.y = side * fold;
    hinge.add(knuckle);
    const inner = bevelBox(panelW, height, thickness, wood, 0.004);
    inner.position.set(-side * panelW / 2, height / 2, 0);
    knuckle.add(inner);
    const gilt2 = bevelBox(panelW * 0.9, height * 0.95, thickness * 0.3, carved, 0.002);
    gilt2.position.set(-side * panelW / 2, height / 2, thickness * 0.55);
    knuckle.add(gilt2);
  }
  g.userData.leaves = leaves;
  // Five-sided posts for the oracle door (6:31), four-square for the house
  // (6:33): the segment count is the text's word.
  return g;
}

export function buildTemple(cubit: number): Temple {
  const g = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const C = (n: number) => n * cubit;
  const counts: TempleCounts = {
    pillars: 0, pomegranates: 0, oxen: 0, gourds: 0, lavers: 0,
    lampstands: 0, tables: 0, cherubim: 0, storeys: 0,
  };
  const addCollider = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, false);
    colliders.push(new THREE.Box3().setFromObject(o));
  };

  const stone = M.stone();
  const cedar = M.cedar();
  const gold = M.gold();
  const carved = M.carvedGold();
  const floorGold = M.floorGold();
  const bronze = M.bronze();
  const panel = M.panel();
  const olive = M.olive();

  // ── the site: Mount Moriah, 2 Chr 3:1 ─────────────────────────────────
  // A dressed platform standing proud of the highland round it. The text
  // gives the threshing floor, not a terrace plan: the platform is sized to
  // hold the house and what the text sets round it, and the highland is the
  // same generic arid set the tabernacle stands in — not a survey.
  const platW = C(160), platD = C(120), platH = C(3);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(platW, platH, platD), M.paving());
  platform.position.y = -platH / 2;
  platform.receiveShadow = true;
  platform.userData.noCast = true;
  g.add(platform);
  const desert = buildDesert((x, z) => Math.abs(x) < platW / 2 + 3 && Math.abs(z) < platD / 2 + 3);
  desert.position.y = -platH + C(0.2);
  g.add(desert);

  // ── house massing, 1 Kgs 6:2 ──────────────────────────────────────────
  // 60 long (east–west), 20 wide, 30 high, the interior at the stated
  // measures and one-cubit walls outside them. Front faces east (+x).
  const houseL = C(60), houseW = C(20), houseH = C(30);
  const wall = C(1);
  const frontX = houseL / 2;          // +30
  const rearX = -houseL / 2;          // −30
  const halfW = houseW / 2;           // ±10
  const debirL = C(20), debirH = C(20);
  const debirFrontX = rearX + debirL;  // −10

  // The floor: cypress boards overlaid with gold — 6:15, 6:30.
  const floor = bevelBox(houseL, C(0.15), houseW, floorGold, 0.003);
  floor.position.y = C(0.075);
  g.add(floor);
  addCollider(floor);

  /** A wall of ashlar with an opening cut through it (door or window row). */
  const ashlar = (w: number, h: number, t: number, x: number, y: number, z: number, rotY = 0) => {
    const m = bevelBox(w, h, t, stone, 0.01);
    m.position.set(x, y, z); m.rotation.y = rotY;
    g.add(m); addCollider(m);
    return m;
  };

  // The long walls, with the windows of 6:4 in a band above the side
  // chambers: the chambers rise to 18 cubits (6:6, 6:10), so the only wall a
  // window can pierce is above that. Seven each side, two cubits wide, five
  // high, latticed — number and size are display; the verse gives neither.
  const winY0 = C(21), winH = C(5), winW = C(2), winN = 7;
  for (const sz of [-1, 1]) {
    const z = sz * (halfW + wall / 2);
    ashlar(houseL + wall * 2, winY0, wall, 0, winY0 / 2, z);                     // below the windows
    ashlar(houseL + wall * 2, houseH - winY0 - winH, wall, 0, winY0 + winH + (houseH - winY0 - winH) / 2, z); // above
    const pitch = houseL / winN;
    // Windows centred at rearX + (i + ½)·pitch; the piers are what is left.
    for (let k = 0; k <= winN; k++) {
      const left = k === 0 ? rearX - wall : rearX + (k - 0.5) * pitch + winW / 2;
      const right = k === winN ? frontX + wall : rearX + (k + 0.5) * pitch - winW / 2;
      const pier = bevelBox(right - left, winH, wall, stone, 0.01);
      pier.position.set((left + right) / 2, winY0 + winH / 2, z);
      g.add(pier);
    }
    // The lattice ("窗棂"): cedar bars, three across and five up, in each
    // opening. Out of reach, so no collider.
    for (let i = 0; i < winN; i++) {
      const cx = rearX + (i + 0.5) * pitch;
      for (let k = 1; k < 4; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(C(0.08), winH, C(0.12)), cedar);
        bar.position.set(cx - winW / 2 + (winW * k) / 4, winY0 + winH / 2, z);
        g.add(bar);
      }
      for (let k = 1; k < 6; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(winW, C(0.08), C(0.12)), cedar);
        bar.position.set(cx, winY0 + (winH * k) / 6, z);
        g.add(bar);
      }
    }
  }
  // Rear wall.
  ashlar(houseW, houseH, wall, rearX - wall / 2, houseH / 2, 0, Math.PI / 2);
  // Front wall, with the door of 6:33: posts a fourth of the wall — a
  // five-cubit opening in a twenty-cubit front. Height is not given; twelve
  // cubits keeps the proportion of a doorway in a thirty-cubit front.
  const doorW = C(5), doorH = C(12);
  const jambW = (houseW - doorW) / 2;
  for (const sz of [-1, 1]) ashlar(jambW, houseH, wall, frontX + wall / 2, houseH / 2, sz * (doorW / 2 + jambW / 2), Math.PI / 2);
  ashlar(doorW, houseH - doorH, wall, frontX + wall / 2, doorH + (houseH - doorH) / 2, 0, Math.PI / 2);

  // ── the house within: gold on every face, carved — 6:15, 6:18, 6:21–22, 6:29
  // The old model lined the holy place with bare cedar. The text lines it
  // with cedar and then covers every board with gold, carved before the
  // gilding; what a reader sees is gold with the carving in it.
  const lining = C(0.08);
  const roomZ = halfW - lining / 2;
  for (const sz of [-1, 1]) {
    // Holy place, x −10…30; the oracle, x −30…−10 — the same surface, the
    // text's 6:29 covering both rooms.
    const wallH = bevelBox(houseL, houseH, lining, carved, 0.002);
    wallH.position.set(0, houseH / 2, sz * roomZ);
    g.add(wallH);
  }
  const rearLining = bevelBox(lining, houseH, houseW - lining * 2, carved, 0.002);
  rearLining.position.set(rearX + lining / 2, houseH / 2, 0);
  g.add(rearLining);
  const frontLining = bevelBox(lining, houseH - doorH, houseW - lining * 2, carved, 0.002);
  frontLining.position.set(frontX - lining / 2, doorH + (houseH - doorH) / 2, 0);
  g.add(frontLining);
  for (const sz of [-1, 1]) {
    const jamb = bevelBox(lining, doorH, jambW - lining, carved, 0.002);
    jamb.position.set(frontX - lining / 2, doorH / 2, sz * (doorW / 2 + (jambW - lining) / 2));
    g.add(jamb);
  }

  // The ceiling: cedar beams and boards (6:9), overlaid with gold like the
  // rest (6:22; 2 Chr 3:7 names the beams among the gilded work). Beams
  // across the width every three cubits, boards above them.
  const beamY = houseH - C(0.6);
  for (let x = rearX + C(1.5); x < frontX; x += C(3)) {
    const beam = bevelBox(C(0.8), C(1.2), houseW - lining * 2, gold, 0.006);
    beam.position.set(x, beamY, 0);
    g.add(beam);
  }
  const ceiling = bevelBox(houseL, lining, houseW, gold, 0.002);
  ceiling.position.set(0, houseH - lining / 2, 0);
  g.add(ceiling);
  // The oracle is a twenty-cubit cube (6:20): its own gilded ceiling at
  // twenty, with the upper rooms of 2 Chr 3:9 sealed above it.
  const debirCeiling = bevelBox(debirL, C(0.6), houseW - lining * 2, gold, 0.004);
  debirCeiling.position.set((rearX + debirFrontX) / 2, debirH + C(0.3), 0);
  g.add(debirCeiling);
  for (let x = rearX + C(1.5); x < debirFrontX; x += C(3)) {
    const beam = bevelBox(C(0.7), C(1.0), houseW - lining * 2, gold, 0.006);
    beam.position.set(x, debirH - C(0.5), 0);
    g.add(beam);
  }

  // The roof, seen from outside: cedar (6:9), flat — 6:9 gives a height and
  // never a pitch. A cedar cornice runs the top of the walls.
  const roof = bevelBox(houseL + wall * 2, C(0.5), houseW + wall * 2, cedar, 0.01);
  roof.position.y = houseH + C(0.25);
  g.add(roof); addCollider(roof);
  const cornice = bevelBox(houseL + wall * 2 + C(0.6), C(0.6), houseW + wall * 2 + C(0.6), cedar, 0.02);
  cornice.position.y = houseH - C(0.3);
  g.add(cornice);

  // ── the partition and the oracle door, 6:16, 6:31–32; the veil, 2 Chr 3:14
  // Cedar, gilded and carved like the rest, full height, with the oracle
  // doorway a fifth of the wall — four cubits — and two olive-wood leaves
  // standing open. The veil hangs in the opening behind them.
  const oracleDoorW = C(4), oracleDoorH = C(10);
  const partT = C(0.6);
  const partJamb = (houseW - lining * 2 - oracleDoorW) / 2;
  for (const sz of [-1, 1]) {
    const seg = bevelBox(partT, houseH, partJamb, carved, 0.003);
    seg.position.set(debirFrontX, houseH / 2, sz * (oracleDoorW / 2 + partJamb / 2));
    g.add(seg); addCollider(seg);
  }
  const partHead = bevelBox(partT, houseH - oracleDoorH, oracleDoorW, carved, 0.003);
  partHead.position.set(debirFrontX, oracleDoorH + (houseH - oracleDoorH) / 2, 0);
  g.add(partHead); addCollider(partHead);
  const oracleDoor = foldingDoor(oracleDoorH, oracleDoorW, C(0.15), olive, carved, THREE.MathUtils.degToRad(150), 0);
  oracleDoor.position.set(debirFrontX + partT / 2, 0, 0);
  oracleDoor.rotation.y = -Math.PI / 2;
  g.add(oracleDoor);
  for (const leaf of oracleDoor.userData.leaves as THREE.Group[]) addCollider(leaf);
  const veil = hanging(oracleDoorW, oracleDoorH * 0.98, M.veil());
  veil.rotation.y = Math.PI / 2;
  veil.position.set(debirFrontX - partT / 2 - C(0.1), 0, 0);
  g.add(veil);
  // No free walk through the veil; the tour cuts past it. A collider keeps
  // WASD out.
  addCollider(veil);
  // Chains of gold across the front of the oracle — 6:21. Four festoons
  // slung between gilded rings, above the doorway.
  for (let i = 0; i < 4; i++) {
    const z0 = -halfW + C(2) + i * C(4), z1 = z0 + C(4);
    const top = oracleDoorH + C(3.5);
    const chain = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(debirFrontX + partT / 2 + C(0.2), top, z0),
      new THREE.Vector3(debirFrontX + partT / 2 + C(0.6), top - C(1.6), (z0 + z1) / 2),
      new THREE.Vector3(debirFrontX + partT / 2 + C(0.2), top, z1)), 16, C(0.06), 6, false), gold);
    g.add(chain);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(C(0.16), C(0.04), 6, 16), gold);
    ring.position.set(debirFrontX + partT / 2 + C(0.15), top, z0); ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }

  // ── the house door, 6:33–35: cypress leaves, olive posts, gilded ────────
  const door = foldingDoor(doorH, doorW, C(0.18), cedar, carved, THREE.MathUtils.degToRad(155), THREE.MathUtils.degToRad(20));
  door.position.set(frontX + wall, 0, 0);
  door.rotation.y = -Math.PI / 2;
  g.add(door);
  for (const leaf of door.userData.leaves as THREE.Group[]) addCollider(leaf);
  for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(C(0.28), C(0.3), doorH + C(0.4), 4), olive);
    post.position.set(frontX + wall, (doorH + C(0.4)) / 2, sz * (doorW / 2 + C(0.3)));
    post.rotation.y = Math.PI / 4;
    g.add(post);
  }

  // ── cherubim of the oracle, 1 Kgs 6:23–28; 2 Chr 3:10–13 ──────────────
  // Ten cubits high, wings five and five: one tip at each wall, the inner
  // tips meeting at the middle of the room — so they stand side by side
  // across the width at z = ±5 — and they face the holy place (2 Chr 3:13):
  // a visitor at the veil meets them face on.
  const debirMidX = (rearX + debirFrontX) / 2;
  for (const sz of [-1, 1]) {
    const cherub = buildStandingCherub(cubit, gold);
    cherub.position.set(debirMidX - C(2), 0, sz * C(5));
    g.add(cherub);
    addCollider(cherub);
    counts.cherubim++;
  }
  // The ark set under their wings — 1 Kgs 8:6–8 — the same object the
  // measurement card builds, its poles toward the door so their ends could
  // be seen from the holy place (8:8).
  const arkSpec = STRUCTURES.find((x) => x.id === 'ark');
  if (arkSpec) {
    const ark = buildStructure(arkSpec, cubit);
    ark.traverse((o) => { if (o instanceof THREE.Mesh) o.material = gold; });
    ark.position.set(debirMidX - C(2), 0, 0);
    g.add(ark);
    addCollider(ark);
  }

  // ── the holy place: lampstands, tables, the golden altar ──────────────
  // Ten lampstands of pure gold, five on the right and five on the left
  // before the oracle (7:49; 2 Chr 4:7); ten tables, five a side (2 Chr
  // 4:8) — Kings names one table of the bread (7:48), so one of the ten
  // carries the twelve loaves; the golden altar before the oracle (6:20–22,
  // 7:48). The Exodus dimensions are used for the furniture Exodus measures.
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const menorahUnit = 1.5 / 8.6;
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = debirFrontX + C(3) + i * C(3);
      const z = sz * C(7.2);
      const { group: lamp } = buildMenorah(1.5);
      lamp.remove(lamp.children[0]!);
      const foot = new THREE.Mesh(new THREE.LatheGeometry(
        [[0, 0], [0.25, 0.01], [0.27, 0.04], [0.24, 0.08], [0.13, 0.13], [0.065, 0.22]].map(([r, y]) => new THREE.Vector2(r, y)), 40), gold);
      lamp.add(foot);
      lamp.traverse((o) => { if (o instanceof THREE.Mesh) o.material = gold; });
      lamp.position.set(x, 0, z);
      lamp.rotation.y = Math.PI / 2;
      g.add(lamp);
      addCollider(lamp);
      counts.lampstands++;
      for (const u of [0, -2.15, 2.15, -2.93, 2.93, -3.71, 3.71]) {
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), flameMat);
        flame.scale.set(0.7, 2, 1);
        flame.position.set(x + 0.045, 7.5 * menorahUnit + 0.046, z + u * menorahUnit);
        g.add(flame);
      }
    }
    // The lamps' light, as one warm point per side rather than seventy.
    const glow = new THREE.PointLight(0xffc87e, 2.2, 30, 2);
    glow.position.set(debirFrontX + C(9), C(3), sz * C(6));
    g.add(glow);
  }
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = C(4) + i * C(4.5);
      const z = sz * C(7.6);
      const table = new THREE.Group();
      const top = bevelBox(C(2), C(0.12), C(1), gold);
      top.position.y = C(1.44);
      table.add(top);
      for (const s2 of [-1, 1]) {
        const border = bevelBox(C(2.05), C(0.15), C(0.07), gold);
        border.position.set(0, C(1.49), s2 * C(0.5)); table.add(border);
      }
      for (const [sx, s2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(C(0.07), C(0.07), C(1.5), 10), gold);
        leg.position.set(sx * C(0.88), C(0.75), s2 * C(0.38));
        table.add(leg);
      }
      if (sz > 0 && i === 0) {
        // The bread of the Presence: twelve loaves in two rows — Lev 24:5–6.
        const bread = new THREE.MeshStandardMaterial({ color: 0xbb854d, roughness: 0.94 });
        for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
          const loaf = new THREE.Mesh(new THREE.SphereGeometry(C(0.24), 20, 10), bread);
          loaf.scale.set(1, 0.15, 1); loaf.position.set((r - 0.5) * C(0.85), C(1.53 + k * 0.065), 0);
          table.add(loaf);
        }
      }
      table.position.set(x, 0, z);
      table.rotation.y = Math.PI / 2;
      g.add(table);
      addCollider(table);
      counts.tables++;
    }
  }
  // The golden altar before the oracle — 6:20, 6:22, 7:48; Exodus 30:1–3
  // gives a cubit square and two high, with horns and a moulding.
  const incense = new THREE.Group();
  const iBody = bevelBox(C(1), C(2), C(1), gold, 0.01);
  iBody.position.y = C(1);
  incense.add(iBody);
  const moulding = new THREE.Mesh(new THREE.BoxGeometry(C(1.1), C(0.08), C(1.1)), gold);
  moulding.position.y = C(2) - C(0.04);
  incense.add(moulding);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const horn = altarHorn(C(0.3), C(0.085), gold);
    horn.rotation.y = Math.atan2(-sz, sx);
    horn.position.set(sx * C(0.42), C(2), sz * C(0.42));
    incense.add(horn);
  }
  incense.position.set(debirFrontX + C(2.6), 0, 0);
  g.add(incense);
  addCollider(incense);
  // A warm fill in the oracle so the gold and the figures read. Disclosed
  // in the evidence dialog; not a claim about what lit that room.
  const oracleFill = new THREE.PointLight(0xffe0a8, 1.6, 30, 2);
  oracleFill.position.set(debirMidX + C(4), C(9), 0);
  g.add(oracleFill);

  // ── the porch, 1 Kgs 6:3; 2 Chr 3:4 ───────────────────────────────────
  // Twenty across the front, ten deep, gilded within. Its height is the
  // house's; 2 Chr 3:4's 120 is on the card as the disputed reading it is.
  const porchD = C(10);
  const porchCX = frontX + wall + porchD / 2;
  for (const sz of [-1, 1]) {
    const side = bevelBox(porchD, houseH, wall, stone, 0.01);
    side.position.set(porchCX, houseH / 2, sz * (halfW + wall / 2));
    g.add(side); addCollider(side);
    const inner = bevelBox(porchD, houseH, lining, carved, 0.002);
    inner.position.set(porchCX, houseH / 2, sz * (halfW - lining / 2));
    g.add(inner);
  }
  const porchRoof = bevelBox(porchD + wall, C(0.5), houseW + wall * 2, cedar, 0.01);
  porchRoof.position.set(porchCX + wall / 2, houseH + C(0.25), 0);
  g.add(porchRoof);
  const porchCeiling = bevelBox(porchD, lining, houseW, gold, 0.002);
  porchCeiling.position.set(porchCX, houseH - lining / 2, 0);
  g.add(porchCeiling);
  // The front of the porch: a lintel beam across the open face.
  const porchLintel = bevelBox(wall, C(3), houseW + wall * 2, stone, 0.01);
  porchLintel.position.set(frontX + wall + porchD + wall / 2, houseH - C(1.5), 0);
  g.add(porchLintel);
  const porchFloor = bevelBox(porchD, C(0.2), houseW, stone, 0.008);
  porchFloor.position.set(porchCX, C(0.1), 0);
  g.add(porchFloor); addCollider(porchFloor);
  // Three shallow steps up to the porch floor — display, so the threshold
  // is not a lip to trip on.
  for (let i = 0; i < 3; i++) {
    const h = C(0.2) * (3 - i) / 3;
    const step = bevelBox(C(0.8), h, houseW, stone, 0.006);
    step.position.set(frontX + wall + porchD + wall + C(0.4) + i * C(0.8), h / 2, 0);
    g.add(step);
  }

  // ── Jachin and Boaz, 1 Kgs 7:15–22 ────────────────────────────────────
  // Before the porch; the right pillar (Jachin) north of one facing the
  // house from the east, Boaz south. Kings' 18 cubits and 200 pomegranates.
  const pillarX = frontX + wall + porchD + wall + C(4);
  const jachinZ = C(5.5), boazZ = -C(5.5);
  for (const z of [jachinZ, boazZ]) {
    const { group: p, pomegranates } = buildPillar({ cubit, height: 18, girth: 12, capital: 5, pomegranates: 200 }, bronze);
    p.position.set(pillarX, 0, z);
    g.add(p);
    addCollider(p.children[0]!);
    counts.pillars++;
    counts.pomegranates += pomegranates;
  }

  // ── the molten sea, 1 Kgs 7:23–26 ─────────────────────────────────────
  // On the south-east, to the right of one entering (7:39; 2 Chr 4:10).
  const { group: sea, oxen, gourds } = buildSea({ cubit, diameter: 10, height: 5, girth: 30 }, bronze);
  sea.position.set(frontX + C(12), 0, -halfW - C(14));
  g.add(sea);
  addCollider(sea);
  counts.oxen += oxen; counts.gourds += gourds;

  // ── ten lavers on their bases, 1 Kgs 7:27–39 ──────────────────────────
  // Five on the south side of the house, five on the north.
  for (let i = 0; i < 5; i++) {
    for (const sz of [-1, 1]) {
      const stand = buildLaver(cubit, bronze, panel);
      stand.position.set(-C(18) + i * C(10), 0, sz * (halfW + C(8)));
      stand.rotation.y = sz > 0 ? Math.PI : 0;
      g.add(stand);
      addCollider(stand);
      counts.lavers++;
    }
  }

  // ── the bronze altar, 2 Chr 4:1 ───────────────────────────────────────
  // Twenty cubits square and ten high, before the house. Its construction
  // is not described; a cast shell with a hearth ledge, horns at the corners
  // (1 Kgs 1:50 assumes them), and a ramp on the south — Exodus 20:26
  // forbids steps — which is a display choice the dialog owns.
  const altarL = C(20), altarH = C(10);
  const altar = new THREE.Group();
  for (const side of [-1, 1]) {
    const w1 = bevelBox(altarL, altarH, C(0.4), bronze, 0.012);
    w1.position.set(0, altarH / 2, side * (altarL / 2 - C(0.2)));
    altar.add(w1);
    const w2 = bevelBox(C(0.4), altarH, altarL - C(0.8), bronze, 0.012);
    w2.position.set(side * (altarL / 2 - C(0.2)), altarH / 2, 0);
    altar.add(w2);
  }
  const hearth = bevelBox(altarL - C(0.8), C(0.3), altarL - C(0.8), bronze, 0.01);
  hearth.position.y = altarH - C(0.6);
  altar.add(hearth);
  const ledge = bevelBox(altarL + C(0.6), C(0.4), altarL + C(0.6), bronze, 0.01);
  ledge.position.y = altarH * 0.5;
  altar.add(ledge);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const horn = altarHorn(C(1.2), C(0.28), bronze);
    horn.rotation.y = Math.atan2(-dz, dx);
    horn.position.set(dx * (altarL / 2 - C(0.3)), altarH, dz * (altarL / 2 - C(0.3)));
    altar.add(horn);
  }
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(C(6), altarH, C(22)), bronze);
  ramp.geometry.translate(0, altarH / 2, 0);
  // A wedge: shear the box into a ramp rising toward the altar.
  const rp = ramp.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) {
    const z = rp.getZ(i);
    if (z < 0) rp.setY(i, rp.getY(i) * Math.max(0.02, (z + C(11)) / C(22)) );
  }
  ramp.geometry.computeVertexNormals();
  ramp.position.set(0, 0, -altarL / 2 - C(11));
  altar.add(ramp);
  altar.position.set(frontX + wall + porchD + wall + C(19), 0, 0);
  g.add(altar);
  // Two colliders, not one: a single box round altar-plus-ramp is a block
  // thirty cubits long that the lane past the pillars runs straight into.
  altar.updateWorldMatrix(true, true);
  const altarBody = new THREE.Box3();
  for (const child of altar.children) if (child !== ramp) altarBody.expandByObject(child);
  colliders.push(altarBody);
  addCollider(ramp);

  // ── side chambers, 1 Kgs 6:5–10 ───────────────────────────────────────
  // Three storeys round the north, south and west — not the front — five,
  // six and seven cubits wide, each five high, the beams of every storey
  // resting on a ledge in the wall so the upper storeys stand a cubit
  // further out than the one below: the annex steps outward as it rises.
  // The door to the chambers on the south side, midway (6:8).
  const storeys: { y0: number; w: number }[] = [
    { y0: 0, w: C(5) }, { y0: C(5), w: C(6) }, { y0: C(10), w: C(7) },
  ];
  const storeyH = C(5);
  for (const st of storeys) {
    for (const sz of [-1, 1]) {
      const run = bevelBox(houseL + wall * 2, storeyH, st.w, stone, 0.01);
      run.position.set(0, st.y0 + storeyH / 2, sz * (halfW + wall + st.w / 2));
      g.add(run); addCollider(run);
    }
    const west = bevelBox(st.w, storeyH, houseW + wall * 2 + st.w * 2, stone, 0.01);
    west.position.set(rearX - wall - st.w / 2, st.y0 + storeyH / 2, 0);
    g.add(west); addCollider(west);
    // The cedar beam course each storey rests on (6:6, 6:10).
    for (const sz of [-1, 1]) {
      const beamRow = bevelBox(houseL + wall * 2 + st.w * 0.2, C(0.35), st.w + C(0.25), cedar, 0.006);
      beamRow.position.set(0, st.y0 + storeyH, sz * (halfW + wall + st.w / 2));
      g.add(beamRow);
    }
    const beamW = bevelBox(st.w + C(0.25), C(0.35), houseW + wall * 2 + st.w * 2 + C(0.3), cedar, 0.006);
    beamW.position.set(rearX - wall - st.w / 2, st.y0 + storeyH, 0);
    g.add(beamW);
    counts.storeys++;
  }
  // The chamber door, south side, midway (6:8): a dark opening in the lowest
  // storey with a cedar lintel.
  const cd = bevelBox(C(2), C(3.5), C(0.4), new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 1 }), 0.004);
  cd.position.set(0, C(1.75), -(halfW + wall + storeys[0]!.w) + C(0.1));
  g.add(cd);
  const cdl = bevelBox(C(2.6), C(0.4), C(0.5), cedar, 0.006);
  cdl.position.set(0, C(3.7), -(halfW + wall + storeys[0]!.w) + C(0.1));
  g.add(cdl);

  // ── the inner court, 1 Kgs 6:36; its gates, 2 Chr 4:9 ─────────────────
  // Three courses of hewn stone and one of cedar. The court's extent is not
  // stated for Solomon's temple; the wall here encloses the house and what
  // the text sets beside it, and says so on the card. Bronze-clad gates at
  // the east, standing open.
  const courtHalfX = C(72), courtHalfZ = C(38);
  const courseH = C(1.2);
  const courtRun = (from: THREE.Vector3, to: THREE.Vector3) => {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const yaw = -Math.atan2(dir.z, dir.x);
    for (let row = 0; row < 3; row++) {
      const course = bevelBox(len, courseH, C(0.9), stone, 0.008);
      course.position.set(mid.x, courseH * (row + 0.5), mid.z);
      course.rotation.y = yaw;
      g.add(course); addCollider(course);
    }
    const cedarRow = bevelBox(len, C(0.4), C(0.95), cedar, 0.006);
    cedarRow.position.set(mid.x, courseH * 3 + C(0.2), mid.z);
    cedarRow.rotation.y = yaw;
    g.add(cedarRow);
  };
  const gateHalf = C(8);
  courtRun(new THREE.Vector3(courtHalfX, 0, courtHalfZ), new THREE.Vector3(courtHalfX, 0, gateHalf));
  courtRun(new THREE.Vector3(courtHalfX, 0, -gateHalf), new THREE.Vector3(courtHalfX, 0, -courtHalfZ));
  courtRun(new THREE.Vector3(courtHalfX, 0, courtHalfZ), new THREE.Vector3(-courtHalfX, 0, courtHalfZ));
  courtRun(new THREE.Vector3(courtHalfX, 0, -courtHalfZ), new THREE.Vector3(-courtHalfX, 0, -courtHalfZ));
  courtRun(new THREE.Vector3(-courtHalfX, 0, courtHalfZ), new THREE.Vector3(-courtHalfX, 0, -courtHalfZ));
  for (const sz of [-1, 1]) {
    const post = bevelBox(C(1.2), C(5), C(1.2), stone, 0.01);
    post.position.set(courtHalfX, C(2.5), sz * gateHalf);
    g.add(post); addCollider(post);
    // Each leaf hangs on its post and stands swung open to the east, lying
    // nearly along the outside of the wall, so the way in is clear.
    const pivot = new THREE.Group();
    pivot.position.set(courtHalfX + C(0.7), 0, sz * (gateHalf - C(0.6)));
    pivot.rotation.y = -sz * THREE.MathUtils.degToRad(105);
    const leafLen = gateHalf - C(0.8);
    const leaf = bevelBox(C(0.2), C(4), leafLen, bronze, 0.006);
    leaf.position.set(0, C(2), -sz * leafLen / 2);
    pivot.add(leaf);
    g.add(pivot); addCollider(pivot);
  }

  batchStatic(g);

  const anchors = {
    porch: new THREE.Vector3(porchCX, 0, 0),
    holy: new THREE.Vector3((frontX + debirFrontX) / 2, 0, 0),
    debir: new THREE.Vector3(debirMidX, 0, 0),
    sea: sea.position.clone(),
    jachin: new THREE.Vector3(pillarX, 0, jachinZ),
    boaz: new THREE.Vector3(pillarX, 0, boazZ),
    altar: altar.position.clone(),
  };
  return { group: g, colliders, counts, anchors };
}
