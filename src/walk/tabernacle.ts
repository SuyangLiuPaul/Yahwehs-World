import * as THREE from 'three';
import { buildMenorah } from '../structures/menorah.ts';
import {
  beatenGold, bronze as bronzeTex, goatHair, hide, linen as linenTex, sand as sandTex,
  veilCloth, embroidered,
} from './textures.ts';
import { buildStructure } from '../structures/build.ts';
import { STRUCTURES } from '../structures/specs.ts';

// The tabernacle of Exodus 26-27, generated from the counts the text states.
//
// This is the passage readers skip, and it is the densest specification in
// Scripture. It does not say "boards" — it says how many, how wide, how tall,
// and how many sockets go under each one:
//
//   26:1     ten curtains, each 28 x 4 cubits
//   26:6     fifty gold clasps
//   26:7-8   eleven goat-hair curtains, each 30 x 4 cubits
//   26:15-25 forty-eight boards: twenty south, twenty north, six west, two corners
//            each 10 x 1.5 cubits, on ninety-six silver sockets, two per board
//   26:26-28 fifteen bars, five to a side
//   26:32    the veil on four pillars, four silver sockets
//   26:37    the screen on five pillars, five bronze sockets
//   27:1     the bronze altar, 5 x 5 x 3 cubits
//   27:9-15  the court: twenty pillars south, twenty north, ten west,
//            three and three flanking a twenty-cubit gate on four
//   27:18    the court itself, 100 x 50, hangings 5 cubits high
//
// Sixty court pillars, forty-eight boards, ninety-six sockets, fifty clasps.
// Density here is not an art decision — it is arithmetic from the passage, and
// every piece can name the verse that put it there.

export interface Part { mesh: THREE.Object3D; ref: string; zh: string }

/** What the builder actually produced, so the UI can state the tally instead of
 *  asserting it. Every field is a number Exodus gives. */
export interface TabernacleCounts {
  courtPillars: number; boards: number; sockets: number;
  clasps: number; bars: number; curtains: number;
}

export interface Tabernacle {
  group: THREE.Group;
  /** Axis-aligned boxes the walker cannot pass through. */
  colliders: THREE.Box3[];
  counts: TabernacleCounts;
}

// Textures are generated once and shared: a hundred boards carrying a hundred
// copies of the same canvas would cost a hundred uploads to the GPU.
const TEX = {
  gold: beatenGold(), linen: linenTex(), veil: veilCloth(),
  bronze: bronzeTex(), sand: sandTex(), hide: hide(), goat: goatHair(),
  // 26:31 works cherubim into the veil; 26:36 and 27:16 call the door and gate
  // screens "the work of an embroiderer" without naming a figure.
  veilWork: embroidered(true), screenWork: embroidered(false),
};

const M = {
  // Linen is thin, and sunlight goes through it. Without that the shaded face
  // of a hanging goes dead grey and the court reads as concrete panels; a warm
  // emissive stands in for the light bleeding through, which is what the eye
  // is actually reading when it calls a fabric a fabric.
  linen: () => new THREE.MeshStandardMaterial({
    color: 0xf7f2e6, roughness: 0.96, side: THREE.DoubleSide,
    map: TEX.linen.map, normalMap: TEX.linen.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    emissive: 0x6b6250, emissiveIntensity: 0.42,
  }),
  acacia: () => new THREE.MeshStandardMaterial({ color: 0x6a4c28, roughness: 0.8 }),
  // Metals reflect more of the environment than everything else does. A metal
  // lit at the same envMapIntensity as cloth has nothing to shine with.
  gold: () => new THREE.MeshStandardMaterial({
    color: 0xffe9a8, metalness: 1, roughness: 0.22,
    map: TEX.gold.map, normalMap: TEX.gold.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    envMapIntensity: 2.4,
  }),
  silver: () => new THREE.MeshStandardMaterial({
    color: 0xe4e6ea, metalness: 1, roughness: 0.3,
    normalMap: TEX.gold.normalMap, normalScale: new THREE.Vector2(0.35, 0.35),
    envMapIntensity: 2.0,
  }),
  bronze: () => new THREE.MeshStandardMaterial({
    color: 0xd9a868, metalness: 0.95, roughness: 0.45,
    map: TEX.bronze.map, normalMap: TEX.bronze.normalMap,
    envMapIntensity: 2.0,
  }),
  hide: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.92,
    map: TEX.hide.map, normalMap: TEX.hide.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
  }),
  goat: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, side: THREE.DoubleSide,
    map: TEX.goat.map, normalMap: TEX.goat.normalMap,
  }),
  veil: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide,
    map: TEX.veilWork.map, normalMap: TEX.veilWork.normalMap,
    emissive: 0x241c3a, emissiveIntensity: 0.45,
  }),
  screen: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide,
    map: TEX.screenWork.map, normalMap: TEX.screenWork.normalMap,
    emissive: 0x241c3a, emissiveIntensity: 0.45,
  }),
  ground: () => new THREE.MeshStandardMaterial({
    color: 0xcbb894, roughness: 1,
    map: TEX.sand.map, normalMap: TEX.sand.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
  }),
};

export function buildTabernacle(cubit: number): Tabernacle {
  const g = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const C = (n: number) => n * cubit;

  const counts: TabernacleCounts = {
    courtPillars: 0, boards: 0, sockets: 0, clasps: 0, bars: 0, curtains: 0,
  };

  const addCollider = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, false);
    colliders.push(new THREE.Box3().setFromObject(o));
  };

  // ── the court, Exodus 27:9-18 ──────────────────────────────────────────
  const courtL = C(100), courtW = C(50), hangH = C(5);

  // A displaced floor. A perfectly flat plane reads as a table the building was
  // set on; the desert has drift in it, and the horizon needs something to
  // catch the light unevenly.
  const groundGeo = new THREE.PlaneGeometry(courtL * 14, courtL * 14, 96, 96);
  const gp = groundGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), y = gp.getY(i);
    const d = Math.hypot(x, y);
    // Flat where the tabernacle stands; the ground was levelled for it.
    const away = Math.min(1, Math.max(0, (d - courtL * 0.75) / (courtL * 2)));
    const h = (Math.sin(x * 0.012) * Math.cos(y * 0.009) + Math.sin(x * 0.031 + y * 0.027) * 0.4);
    gp.setZ(i, h * cubit * 1.8 * away);
  }
  groundGeo.computeVertexNormals();
  const sandMesh = new THREE.Mesh(groundGeo, M.ground());
  sandMesh.rotation.x = -Math.PI / 2;
  sandMesh.receiveShadow = true;
  // The floor must NOT cast. A 623-unit plane in the shadow map sets the depth
  // range for everything in it, and a two-metre pillar then has no precision
  // left to write a shadow with — which is why the court had none at all.
  sandMesh.userData.noCast = true;
  g.add(sandMesh);

  const linen = M.linen();
  const bronze = M.bronze();
  const silver = M.silver();

  /** A run of hangings on its pillars. Each pillar carries one bronze socket,
   *  a silver hook and a silver band — 27:10-11 names all three. */
  function hangingRun(
    from: THREE.Vector3, to: THREE.Vector3, pillars: number, height: number, mat: THREE.Material,
  ) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const mid = from.clone().add(to).multiplyScalar(0.5);

    // Cloth on a rope sags between its posts. A plane hung dead flat is the
    // single detail that made the court read as cardboard panels.
    const segs = Math.max(8, pillars * 6);
    const clothGeo = new THREE.PlaneGeometry(len, height, segs, 6);
    const cp = clothGeo.attributes.position as THREE.BufferAttribute;
    const bay = len / Math.max(1, pillars - 1);
    for (let i = 0; i < cp.count; i++) {
      const u = cp.getX(i) + len / 2;               // 0..len along the run
      const v = (cp.getY(i) + height / 2) / height; // 0 bottom .. 1 top
      const inBay = (u % bay) / bay;                // 0..1 across one bay
      const sag = Math.sin(inBay * Math.PI);        // deepest mid-bay
      // Hangs from the top rope: the top edge stays put, the middle bellies.
      cp.setZ(i, sag * (1 - v) * cubit * 0.22 + sag * cubit * 0.05);
      cp.setY(i, cp.getY(i) - sag * v * cubit * 0.12);
    }
    clothGeo.computeVertexNormals();
    const cloth = new THREE.Mesh(clothGeo, mat);
    cloth.position.set(mid.x, height / 2, mid.z);
    cloth.rotation.y = -Math.atan2(dir.z, dir.x);
    g.add(cloth);
    addCollider(cloth);

    for (let i = 0; i < pillars; i++) {
      const t = pillars === 1 ? 0.5 : i / (pillars - 1);
      const p = from.clone().lerp(to, t);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(cubit * 0.11, cubit * 0.13, height * 1.06, 12), bronze);
      post.position.set(p.x, height * 0.53, p.z);
      g.add(post);
      const socket = new THREE.Mesh(
        new THREE.CylinderGeometry(cubit * 0.2, cubit * 0.24, cubit * 0.16, 12), bronze);
      socket.position.set(p.x, cubit * 0.08, p.z);
      g.add(socket);
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(cubit * 0.14, cubit * 0.03, 6, 12), silver);
      band.rotation.x = Math.PI / 2;
      band.position.set(p.x, height * 0.94, p.z);
      g.add(band);
      counts.courtPillars++;
    }
  }

  const hx = courtL / 2, hz = courtW / 2;
  // Twenty pillars each on the long sides, ten on the west — 27:10-12.
  hangingRun(new THREE.Vector3(-hx, 0, -hz), new THREE.Vector3(hx, 0, -hz), 20, hangH, linen);
  hangingRun(new THREE.Vector3(-hx, 0, hz), new THREE.Vector3(hx, 0, hz), 20, hangH, linen);
  hangingRun(new THREE.Vector3(-hx, 0, -hz), new THREE.Vector3(-hx, 0, hz), 10, hangH, linen);
  // The east end: fifteen cubits of hangings on three pillars each side of a
  // twenty-cubit gate carried on four — 27:14-16.
  const gateHalf = C(10);
  hangingRun(new THREE.Vector3(hx, 0, -hz), new THREE.Vector3(hx, 0, -gateHalf), 3, hangH, linen);
  hangingRun(new THREE.Vector3(hx, 0, gateHalf), new THREE.Vector3(hx, 0, hz), 3, hangH, linen);
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(C(20), hangH), M.screen());
  gate.position.set(hx, hangH / 2, 0);
  gate.rotation.y = -Math.PI / 2;
  g.add(gate);
  for (let i = 0; i < 4; i++) {
    const z = -gateHalf + (C(20) / 3) * i;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(cubit * 0.11, cubit * 0.13, hangH * 1.06, 12), bronze);
    post.position.set(hx, hangH * 0.53, z);
    g.add(post);
    counts.courtPillars++;
  }

  // ── the bronze altar, Exodus 27:1 ──────────────────────────────────────
  const altar = new THREE.Mesh(new THREE.BoxGeometry(C(5), C(3), C(5)), bronze);
  altar.position.set(hx - C(22), C(1.5), 0);
  g.add(altar);
  addCollider(altar);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    // "Horns on its four corners" — 27:2. Large enough to read from across
    // the court; a horn the size of a finger is not a horn.
    const horn = new THREE.Mesh(new THREE.ConeGeometry(cubit * 0.28, cubit * 0.9, 8), bronze);
    horn.position.set(hx - C(22) + dx * C(2.3), C(3.4), dz * C(2.3));
    g.add(horn);
  }
  // "A grating, a bronze network" halfway up (27:4-5), and the poles it was
  // carried by, through rings on two sides (27:6-7).
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(C(5.1), cubit * 0.07, cubit * 0.07), bronze);
    bar.position.set(hx - C(22), C(1.5), i * C(1));
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(cubit * 0.07, cubit * 0.07, C(5.1)), bronze);
    bar2.position.set(hx - C(22) + i * C(1), C(1.5), 0);
    g.add(bar2);
  }
  for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(cubit * 0.09, cubit * 0.09, C(7), 10), bronze);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(hx - C(22), C(2.6), sz * C(2.7));
    g.add(pole);
  }

  // ── the laver, Exodus 30:18 ─────────────────────────────────────────
  // "A bronze basin with its bronze stand, for washing, between the tent of
  // meeting and the altar." No dimension is given; this one stands hip-high,
  // which is what a basin for washing hands and feet has to be.
  const laver = new THREE.Group();
  const basin = new THREE.Mesh(
    new THREE.LatheGeometry(([
      [0, 0], [0.55, 0.02], [0.62, 0.12], [0.6, 0.3], [0.52, 0.36], [0.5, 0.32], [0.42, 0.14], [0, 0.1],
    ] as [number, number][]).map(([x, y]) => new THREE.Vector2(x * cubit * 1.6, y * cubit * 1.6)), 32),
    bronze);
  basin.geometry.computeVertexNormals();
  basin.position.y = C(1.1);
  const stand = new THREE.Mesh(
    new THREE.LatheGeometry(([
      [0, 0], [0.5, 0], [0.42, 0.08], [0.16, 0.2], [0.14, 0.9], [0.3, 1.0], [0, 1.02],
    ] as [number, number][]).map(([x, y]) => new THREE.Vector2(x * cubit * 1.2, y * cubit * 1.1)), 24),
    bronze);
  stand.geometry.computeVertexNormals();
  laver.add(basin, stand);
  laver.position.set(hx - C(36), 0, 0);
  g.add(laver);
  addCollider(laver);

  // ── the dwelling itself, Exodus 26 ─────────────────────────────────────
  // Twenty boards a side at a cubit and a half make the thirty-cubit length.
  const boardW = C(1.5), boardH = C(10);
  const tentL = boardW * 20, tentW = C(10);
  const tentX = -hx + C(30);
  const gold = M.gold();

  // `west` boards run along z and so turn ninety degrees. The old test rotated
  // only a board whose z happened to be zero, which left the whole west wall as
  // slats set edge-on — a picket fence with daylight through it, in the one
  // room the text seals off from everyone.
  function boardRow(count: number, place: (i: number) => [number, number, number], west = false) {
    for (let i = 0; i < count; i++) {
      const [x, y, z] = place(i);
      const board = new THREE.Mesh(new THREE.BoxGeometry(boardW * 0.98, boardH, cubit * 0.3), gold);
      board.position.set(x, y, z);
      if (west) board.rotation.y = Math.PI / 2;
      g.add(board);
      counts.boards++;
      // "Two sockets under one board" — 26:19. Ninety-six in all.
      for (const s of [-0.3, 0.3]) {
        const sock = new THREE.Mesh(
          new THREE.BoxGeometry(boardW * 0.42, cubit * 0.22, cubit * 0.42), silver);
        sock.position.set(x + (west ? 0 : s * boardW), cubit * 0.11, z + (west ? s * boardW : 0));
        g.add(sock);
        counts.sockets++;
      }
    }
  }

  const x0 = tentX - tentL / 2 + boardW / 2;
  boardRow(20, (i) => [x0 + i * boardW, boardH / 2, -tentW / 2]);   // 26:18 south
  boardRow(20, (i) => [x0 + i * boardW, boardH / 2,  tentW / 2]);   // 26:20 north
  boardRow(6,  (i) => [tentX - tentL / 2, boardH / 2, -tentW / 2 + boardW + i * boardW], true); // 26:22 west
  boardRow(2,  (i) => [tentX - tentL / 2, boardH / 2, (i ? 1 : -1) * (tentW / 2 - boardW * 0.4)], true); // 26:23 corners

  // Fifteen bars, five to a side — 26:26-27.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(cubit * 0.09, cubit * 0.09, tentL, 8), gold);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(tentX, boardH * (0.16 + i * 0.18), side * (tentW / 2 + cubit * 0.2));
      g.add(bar);
      counts.bars++;
    }
  }
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(cubit * 0.09, cubit * 0.09, tentW, 8), gold);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(tentX - tentL / 2 - cubit * 0.2, boardH * (0.16 + i * 0.18), 0);
    g.add(bar);
    counts.bars++;
  }

  // Ten linen curtains over the frame, joined by fifty gold clasps — 26:1,6.
  // These are the CEILING seen from inside; from outside they lie under three
  // more layers.
  for (let i = 0; i < 10; i++) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(tentL / 10 * 0.98, tentW + cubit * 0.6), linen);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x0 - boardW / 2 + (tentL / 10) * (i + 0.5), boardH + cubit * 0.05, 0);
    g.add(strip);
    counts.curtains++;
  }
  for (let i = 0; i < 50; i++) {
    const clasp = new THREE.Mesh(new THREE.TorusGeometry(cubit * 0.07, cubit * 0.02, 6, 10), gold);
    clasp.position.set(
      x0 + (tentL / 50) * i, boardH + cubit * 0.09,
      (i % 2 ? 1 : -1) * tentW * 0.32);
    clasp.rotation.x = Math.PI / 2;
    g.add(clasp);
    counts.clasps++;
  }

  // Over the linen: goat hair (26:7), then ram skins dyed red, then sea-cow
  // hides (26:14). From outside the tabernacle was a dark leather tent — the
  // gold boards were only ever seen from within. Rendering the boards on the
  // outside, as this did, showed a building the text says nobody saw. The
  // covering stops short of the east end, where the door screen hangs.
  const coverH = boardH + cubit * 0.45;
  const coverL = tentL + cubit * 0.9;
  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(coverL, coverH, tentW + cubit * 1.4), M.hide());
  cover.position.set(tentX - cubit * 0.75, coverH / 2, 0);
  g.add(cover);
  // The goat-hair layer is a cubit longer than the linen (26:13) and hangs
  // below the hide, so it shows as a dark fringe at the base.
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(coverL + cubit * 0.3, cubit * 1.1, tentW + cubit * 1.7), M.goat());
  skirt.position.set(tentX - cubit * 0.75, cubit * 0.55, 0);
  g.add(skirt);

  // The veil on four pillars, dividing holy from most holy — 26:31-33.
  const veilX = tentX - tentL / 2 + C(20);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(tentW, boardH * 0.96), M.veil());
  veil.rotation.y = Math.PI / 2;
  veil.position.set(veilX, boardH * 0.48, 0);
  g.add(veil);
  addCollider(veil);
  // A pillar with its socket and its hook — the veil's four stand in silver
  // (26:32), the door's five in bronze (26:37); both are gold-overlaid with
  // gold hooks. The curtain hangs from the hooks, so the hooks sit at the top.
  const pillar = (x: number, z: number, socketMat: THREE.Material) => {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(cubit * 0.15, cubit * 0.15, boardH, 14), gold);
    p.position.set(x, boardH / 2, z);
    g.add(p);
    const socket = new THREE.Mesh(
      new THREE.CylinderGeometry(cubit * 0.22, cubit * 0.27, cubit * 0.18, 14), socketMat);
    socket.position.set(x, cubit * 0.09, z);
    g.add(socket);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(cubit * 0.2, cubit * 0.15, cubit * 0.12, 14), gold);
    cap.position.set(x, boardH - cubit * 0.06, z);
    g.add(cap);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(cubit * 0.06, cubit * 0.018, 6, 12), gold);
    hook.position.set(x, boardH - cubit * 0.12, z);
    g.add(hook);
  };
  for (let i = 0; i < 4; i++) pillar(veilX, -tentW / 2 + (tentW / 3) * i, silver);
  // The screen at the door — 26:36: "a curtain for the entrance to the tent,
  // of blue, purple and scarlet yarn and finely twisted linen, the work of an
  // embroiderer", on five pillars — 26:37. The pillars were here and the
  // curtain was not, so the tent simply had no door.
  const doorX = tentX + tentL / 2;
  const doorScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(tentW, boardH * 0.96), M.screen());
  doorScreen.rotation.y = -Math.PI / 2;
  // The curtain hangs from hooks on the pillars, so it sits a hand's breadth
  // inside them and the five pillars stand in front of it, seen from the
  // court. With the curtain outside, the pillars were invisible and the door
  // read as a square of cloth on a black frame.
  doorScreen.position.set(doorX - cubit * 0.2, boardH * 0.48, 0);
  g.add(doorScreen);
  // No collider: this is the way in. The veil keeps its own, because the one
  // barrier in this building that means something is the one at 26:33.
  for (let i = 0; i < 5; i++) pillar(doorX, -tentW / 2 + (tentW / 4) * i, bronze);

  // ── the holy place furnishings, Exodus 25, 30 ─────────────────────────
  // Walking into an empty gold box teaches nothing. These three are what stood
  // in the holy place, and the passage measures every one of them, so they can
  // be built the same way the building was — from the numbers.
  const holyMidX = (veilX + doorX) / 2;

  // "Put the table outside the veil on the north side of the tabernacle, and
  // the lampstand opposite it on the south side" — Exodus 26:35.
  const { group: lamp } = buildMenorah(1.5);
  lamp.position.set(holyMidX, 0, -tentW * 0.3);
  g.add(lamp);
  addCollider(lamp);

  // "Make its seven lamps and set them up on it so that they light the space
  // in front of it" — 25:37. The lampstand was the only light inside; unlit,
  // the holy place is a dark box. Seven small flames, and one point light
  // standing in for all of them together.
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const unit = 1.5 / 8.6;
  const lampY = 7.5 * unit;
  for (const u of [0, -2.15, 2.15, -2.93, 2.93, -3.71, 3.71]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 8), flameMat);
    flame.position.set(holyMidX + u * unit, lampY + 0.14, -tentW * 0.3);
    g.add(flame);
  }
  const glow = new THREE.PointLight(0xffb45a, 14, 12, 1.6);
  glow.position.set(holyMidX, lampY + 0.3, -tentW * 0.3);
  glow.castShadow = true;
  glow.shadow.mapSize.set(1024, 1024);
  glow.shadow.bias = -0.002;
  g.add(glow);

  // The table of the Presence: two cubits by one, a cubit and a half high —
  // Exodus 25:23, overlaid with gold and crowned with a moulding.
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(C(2), C(0.12), C(1)), gold);
  top.position.y = C(1.5);
  table.add(top);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const legMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(cubit * 0.07, cubit * 0.07, C(1.5), 10), gold);
    legMesh.position.set(sx * C(0.88), C(0.75), sz * C(0.38));
    table.add(legMesh);
  }
  // "Put the bread of the Presence on this table" — 25:30; twelve loaves in
  // two rows of six — Leviticus 24:5-6.
  const bread = new THREE.MeshStandardMaterial({ color: 0xd9b57a, roughness: 0.85 });
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 6; i++) {
      const loaf = new THREE.Mesh(
        new THREE.CylinderGeometry(cubit * 0.11, cubit * 0.12, cubit * 0.06, 14), bread);
      loaf.position.set((i - 2.5) * cubit * 0.3, C(1.5) + cubit * 0.09 + r * cubit * 0.055,
                        (r - 0.5) * cubit * 0.35);
      table.add(loaf);
    }
  }
  table.position.set(holyMidX, 0, tentW * 0.3);
  g.add(table);
  addCollider(table);

  // ── the ark, Exodus 25:10-22, in the most holy place ───────────────────
  // Behind the veil. The same generator the measurement cards use, so it is
  // the same object: two and a half cubits by one and a half by one and a
  // half, with the mercy seat and the two cherubim.
  const arkSpec = STRUCTURES.find((x) => x.id === 'ark');
  if (arkSpec) {
    const ark = buildStructure(arkSpec, cubit);
    ark.position.set(tentX - tentL / 2 + C(5), 0, 0);
    // Length across the room, north–south, so that from the veil the two
    // cherubim stand side by side facing each other, as 25:20 describes
    // them. Lengthwise, the near one hid the far one and the pair read as a
    // single trophy.
    ark.rotation.y = Math.PI / 2;
    g.add(ark);
    addCollider(ark);
    // The most holy place had no lamp; its light was the presence between the
    // cherubim (25:22). A dim glow from above the mercy seat stands in for
    // what cannot be modelled, so that the one object in the room is not lost
    // in the dark.
    const presence = new THREE.SpotLight(0xfff0c8, 26, 12, 0.55, 0.7, 1.4);
    presence.position.set(tentX - tentL / 2 + C(5), C(8.5), 0);
    presence.target.position.set(tentX - tentL / 2 + C(5), 0, 0);
    g.add(presence, presence.target);
    const glow = new THREE.PointLight(0xfff0c8, 0.35, 5, 1.8);
    glow.position.set(tentX - tentL / 2 + C(5), C(2.2), 0);
    g.add(glow);
  }

  // The altar of incense: a cubit square and two cubits high, with horns —
  // Exodus 30:1-3. It stands before the veil, 30:6.
  const incense = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(C(1), C(2), C(1)), gold);
  body.position.y = C(1);
  incense.add(body);
  for (const [hx, hz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(cubit * 0.09, C(0.3), 8), gold);
    horn.position.set(hx * C(0.42), C(2.15), hz * C(0.42));
    incense.add(horn);
  }
  // "A gold moulding around it" (30:3), two gold rings under the moulding on
  // opposite sides, and poles through them (30:4-5).
  const moulding = new THREE.Mesh(new THREE.BoxGeometry(C(1.1), cubit * 0.08, C(1.1)), gold);
  moulding.position.y = C(2) - cubit * 0.04;
  incense.add(moulding);
  for (const hz of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(cubit * 0.09, cubit * 0.02, 8, 18), gold);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, C(1.7), hz * C(0.6));
    incense.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(cubit * 0.035, cubit * 0.035, C(2.6), 10), gold);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, C(1.7), hz * C(0.6));
    incense.add(pole);
  }
  incense.position.set(veilX + C(2.2), 0, 0);
  g.add(incense);
  addCollider(incense);

  // ── the land, so the tabernacle is somewhere ────────────────────────────
  // A ring of low mountains at the horizon. Numbers 2 puts the whole camp of
  // Israel around this court and Exodus 19 puts Sinai over it; a court on a
  // flat plane to the edge of the world is a court on a table. These are
  // scenery, not scripture, and sit far enough out that they are only ever a
  // silhouette under haze.
  const ringGeo = new THREE.CylinderGeometry(courtL * 5.2, courtL * 6.5, courtL * 1.6, 96, 6, true);
  const rp = ringGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    const a = Math.atan2(z, x);
    const peak = Math.abs(Math.sin(a * 5.3) * 0.6 + Math.sin(a * 13.1) * 0.25 + Math.sin(a * 29) * 0.12);
    const t = (y + courtL * 0.8) / (courtL * 1.6);
    rp.setY(i, -courtL * 0.8 + t * courtL * (0.5 + peak * 1.1));
  }
  ringGeo.computeVertexNormals();
  const mountains = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
    color: 0x8a7658, roughness: 1, side: THREE.BackSide,
  }));
  mountains.userData.noCast = true;
  g.add(mountains);

  return { group: g, colliders, counts };
}
