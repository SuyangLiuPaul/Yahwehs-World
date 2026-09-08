import * as THREE from 'three';
import { buildMenorah } from '../structures/menorah.ts';

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

const M = {
  linen:  () => new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.88, side: THREE.DoubleSide }),
  goat:   () => new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.95, side: THREE.DoubleSide }),
  acacia: () => new THREE.MeshStandardMaterial({ color: 0x6a4c28, roughness: 0.8 }),
  gold:   () => new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.28 }),
  silver: () => new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 1, roughness: 0.34 }),
  bronze: () => new THREE.MeshStandardMaterial({ color: 0x8c6a3a, metalness: 0.9, roughness: 0.45 }),
  veil:   () => new THREE.MeshStandardMaterial({ color: 0x4a3b6e, roughness: 0.88, side: THREE.DoubleSide }),
  ground: () => new THREE.MeshStandardMaterial({ color: 0xa8977a, roughness: 1 }),
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

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(courtL * 14, courtL * 14), M.ground());
  sand.rotation.x = -Math.PI / 2;
  g.add(sand);

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

    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(len, height), mat);
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
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(C(20), hangH), M.veil());
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
    // "Horns on its four corners" — 27:2.
    const horn = new THREE.Mesh(new THREE.ConeGeometry(cubit * 0.16, cubit * 0.5, 8), bronze);
    horn.position.set(hx - C(22) + dx * C(2.5), C(3.25), dz * C(2.5));
    g.add(horn);
  }

  // ── the dwelling itself, Exodus 26 ─────────────────────────────────────
  // Twenty boards a side at a cubit and a half make the thirty-cubit length.
  const boardW = C(1.5), boardH = C(10);
  const tentL = boardW * 20, tentW = C(10);
  const tentX = -hx + C(30);
  const gold = M.gold();

  function boardRow(count: number, place: (i: number) => [number, number, number]) {
    for (let i = 0; i < count; i++) {
      const [x, y, z] = place(i);
      const board = new THREE.Mesh(new THREE.BoxGeometry(boardW * 0.98, boardH, cubit * 0.3), gold);
      board.position.set(x, y, z);
      if (Math.abs(z) < 0.001) board.rotation.y = Math.PI / 2;
      g.add(board);
      counts.boards++;
      // "Two sockets under one board" — 26:19. Ninety-six in all.
      for (const s of [-0.3, 0.3]) {
        const sock = new THREE.Mesh(
          new THREE.BoxGeometry(boardW * 0.42, cubit * 0.22, cubit * 0.42), silver);
        sock.position.set(x + (board.rotation.y ? 0 : s * boardW), cubit * 0.11,
                          z + (board.rotation.y ? s * boardW : 0));
        g.add(sock);
        counts.sockets++;
      }
    }
  }

  const x0 = tentX - tentL / 2 + boardW / 2;
  boardRow(20, (i) => [x0 + i * boardW, boardH / 2, -tentW / 2]);   // 26:18 south
  boardRow(20, (i) => [x0 + i * boardW, boardH / 2,  tentW / 2]);   // 26:20 north
  boardRow(6,  (i) => [tentX - tentL / 2, boardH / 2, -tentW / 2 + boardW + i * boardW]); // 26:22 west
  boardRow(2,  (i) => [tentX - tentL / 2, boardH / 2, (i ? 1 : -1) * (tentW / 2 - boardW * 0.4)]); // 26:23 corners

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

  // The veil on four pillars, dividing holy from most holy — 26:31-33.
  const veilX = tentX - tentL / 2 + C(20);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(tentW, boardH * 0.96), M.veil());
  veil.rotation.y = Math.PI / 2;
  veil.position.set(veilX, boardH * 0.48, 0);
  g.add(veil);
  addCollider(veil);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(cubit * 0.13, cubit * 0.13, boardH, 12), gold);
    p.position.set(veilX, boardH / 2, -tentW / 2 + (tentW / 3) * i);
    g.add(p);
  }
  // The screen at the door on five pillars — 26:36-37.
  const doorX = tentX + tentL / 2;
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(cubit * 0.13, cubit * 0.13, boardH, 12), gold);
    p.position.set(doorX, boardH / 2, -tentW / 2 + (tentW / 4) * i);
    g.add(p);
  }

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
  table.position.set(holyMidX, 0, tentW * 0.3);
  g.add(table);
  addCollider(table);

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
  incense.position.set(veilX + C(2.2), 0, 0);
  g.add(incense);
  addCollider(incense);

  return { group: g, colliders, counts };
}
