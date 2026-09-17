import * as THREE from 'three';

// The bronze and gold work of Solomon's temple — 1 Kings 7 and 2 Chronicles
// 3–4 — built once here and used by both the walk (/temple.html) and the
// measurement cards (/structures.html), so the pillar a reader measures is
// the pillar they walk past.
//
// Every number is the text's. Where the text gives a count and no form (the
// oxen, the pomegranates, the gourds, the lions on the panels) the form is the
// least that reads as the thing named, and the count is exact. Where the text
// gives nothing (the profile of the sea's bowl, an ox's anatomy) the choice is
// display and is said to be in the evidence dialog.

type Mat = THREE.Material;
const V2 = (r: number, y: number) => new THREE.Vector2(r, y);
const lathe = (pts: [number, number][], mat: Mat, seg = 40) => {
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg), mat);
  m.geometry.computeVertexNormals();
  return m;
};

// ── Jachin and Boaz, 1 Kgs 7:15–22 ──────────────────────────────────────
// 7:15 height 18, circumference 12 → r = 12/2π ≈ 1.91 cubits
// 7:16 capitals 5 cubits
// 7:17 nets of chequer-work and wreaths of chain-work, seven to a capital
// 7:18 two rows of pomegranates about the net
// 7:19 lily-work, four cubits across
// 7:20 the pomegranates on the "belly" (鼓肚) by the net: two rows, 200
// 7:41 "如球的顶" — the capitals are bowl-shaped
// 2 Chr 3:16 counts 100 pomegranates; the card carries both, the walk draws
// the Kings figure, and `pomegranates` says what was drawn.
export interface PillarSpec { cubit: number; height: number; girth: number; capital: number; pomegranates: number }

export function buildPillar(spec: PillarSpec, bronze: Mat): { group: THREE.Group; pomegranates: number } {
  const { cubit: C } = spec;
  const H = spec.height * C, capH = spec.capital * C;
  const r = (spec.girth * C) / (2 * Math.PI);
  const g = new THREE.Group();
  let pomegranates = 0;

  // The shaft — a plain cast cylinder; 7:15 gives nothing to flute.
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, H, 40, 1), bronze);
  shaft.position.y = H / 2;
  g.add(shaft);
  // A cast base ring. Not stated; a cylinder standing on bare stone reads as
  // unfinished, and the ring is a display choice the dialog owns.
  g.add(lathe([[0, 0], [r * 1.5, 0], [r * 1.5, C * 0.35], [r * 1.25, C * 0.55], [r * 1.05, C * 0.7], [0, C * 0.7]], bronze));

  // The capital: 5 cubits in all. A neck, then the bowl (the "belly" of 7:20,
  // the "球" of 7:41), then the lily-work flaring to four cubits across (7:19).
  const cap = new THREE.Group();
  cap.position.y = H;
  const neckH = capH * 0.14, bowlH = capH * 0.5, lilyH = capH - neckH - bowlH;
  cap.add(lathe([[0, 0], [r * 0.95, 0], [r * 0.9, neckH * 0.5], [r * 0.98, neckH], [0, neckH]], bronze, 32));
  // The belly is only a little wider than the shaft: the lily-work above it
  // is four cubits across (7:19), a two-cubit radius, and a belly wider than
  // that would swallow the flower — which is what happened at 1.32 r.
  const bowlR = r * 1.12;
  const belly = lathe([
    [0, 0], [r * 0.98, 0], [bowlR * 0.92, bowlH * 0.18], [bowlR, bowlH * 0.45],
    [bowlR * 0.94, bowlH * 0.72], [r * 1.05, bowlH * 0.95], [r * 0.95, bowlH], [0, bowlH],
  ], bronze);
  belly.position.y = neckH;
  cap.add(belly);
  // The net (网子): chequer-work over the belly — rings and bars of cast
  // bronze, and the seven wreaths of chain (7:17) hung from the rim.
  const netY0 = neckH + bowlH * 0.12, netY1 = neckH + bowlH * 0.88;
  for (let i = 0; i <= 5; i++) {
    const y = netY0 + (netY1 - netY0) * (i / 5);
    const rr = radiusAt(y);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr + C * 0.03, C * 0.025, 6, 48), bronze);
    ring.rotation.x = Math.PI / 2; ring.position.y = y;
    cap.add(ring);
  }
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const y = netY0 + (netY1 - netY0) * (k / 6);
      const rr = radiusAt(y) + C * 0.03;
      pts.push(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
    }
    cap.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, C * 0.02, 5, false), bronze));
  }
  for (let i = 0; i < 7; i++) {
    // Seven wreaths of chain, each a festoon hung between two points on the
    // net's upper ring.
    const a0 = (i / 7) * Math.PI * 2, a1 = ((i + 1) / 7) * Math.PI * 2;
    const rr = radiusAt(netY1) + C * 0.06;
    const p0 = new THREE.Vector3(Math.cos(a0) * rr, netY1, Math.sin(a0) * rr);
    const p1 = new THREE.Vector3(Math.cos(a1) * rr, netY1, Math.sin(a1) * rr);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    mid.multiplyScalar((rr + C * 0.1) / mid.length()); mid.y = netY1 - C * 0.45;
    cap.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 12, C * 0.035, 6, false), bronze));
  }
  // Two rows of pomegranates round the belly — 7:20. A pomegranate is a
  // small sphere with a calyx; the count is the claim.
  const perRow = Math.round(spec.pomegranates / 2);
  for (let row = 0; row < 2; row++) {
    const y = neckH + bowlH * (0.36 + row * 0.28);
    const rr = radiusAt(y) + C * 0.11;
    for (let i = 0; i < perRow; i++) {
      const a = (i / perRow) * Math.PI * 2 + row * (Math.PI / perRow);
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(C * 0.075, 8, 6), bronze);
      fruit.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      cap.add(fruit);
      const calyx = new THREE.Mesh(new THREE.ConeGeometry(C * 0.035, C * 0.05, 5), bronze);
      calyx.position.set(Math.cos(a) * (rr + C * 0.075), y, Math.sin(a) * (rr + C * 0.075));
      calyx.rotation.z = -Math.PI / 2; calyx.rotation.y = -a;
      cap.add(calyx);
      pomegranates++;
    }
  }
  // Lily-work — 7:19, 7:22: the top flares to four cubits across, drawn as a
  // ring of twelve petals curving outward.
  // Four cubits across at the top (7:19): the petals rise from the cup and
  // lean out to a two-cubit radius. They used to start inside the cup's own
  // radius and were never seen; now the cup is the narrow part and the
  // petals are the wide one.
  const lilyR = 2 * C;
  const petals = 12;
  const reach = lilyR * 1.12 - r * 0.95;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(reach * 0.3, lilyH * 0.5, reach, lilyH);
    shape.quadraticCurveTo(reach * 0.8, lilyH * 0.95, reach * 0.55, lilyH * 0.72);
    shape.quadraticCurveTo(reach * 0.15, lilyH * 0.4, -C * 0.08, lilyH * 0.05);
    shape.closePath();
    const petal = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: C * 0.35, bevelEnabled: true, bevelSize: C * 0.03, bevelThickness: C * 0.02, bevelSegments: 2 }), bronze);
    petal.geometry.translate(0, 0, -C * 0.175);
    petal.position.set(Math.cos(a) * r * 0.95, neckH + bowlH, Math.sin(a) * r * 0.95);
    // The shape grows along its local +x; rotation.y = −a turns that to the
    // radial direction, so each petal opens outward from the cup.
    petal.rotation.y = -a;
    cap.add(petal);
  }
  // The cup the petals rise from.
  const cup = lathe([[0, 0], [r * 0.95, 0], [r * 0.9, lilyH * 0.45], [r * 1.0, lilyH * 0.8], [0, lilyH * 0.8]], bronze);
  cup.position.y = neckH + bowlH;
  cap.add(cup);
  g.add(cap);
  return { group: g, pomegranates };

  /** Radius of the bowl profile at a height within the capital. */
  function radiusAt(y: number) {
    const t = (y - neckH) / bowlH;
    if (t <= 0 || t >= 1) return r;
    return r * 0.98 + (bowlR - r * 0.98) * Math.sin(t * Math.PI) ** 0.7;
  }
}

// ── The molten sea, 1 Kgs 7:23–26 ───────────────────────────────────────
// 7:23 round, 5 high, 10 across, 30 around
// 7:24 gourds (野瓜) under the brim, ten to the cubit, in two rows, cast with it
// 7:25 on twelve oxen, three to each quarter, hindquarters inward
// 7:26 a handbreadth thick; brim like a cup's, like a lily; 2,000 baths
//      (2 Chr 4:5: 3,000 — reported, not modelled)
export interface SeaSpec { cubit: number; diameter: number; height: number; girth: number }

export function buildSea(spec: SeaSpec, bronze: Mat): { group: THREE.Group; oxen: number; gourds: number } {
  const C = spec.cubit;
  const R = (spec.diameter / 2) * C, H = spec.height * C;
  const g = new THREE.Group();
  const oxScale = C * 1.55;
  // Height of an ox's back at that scale — the bowl stands ON them (7:25).
  const back = 0.86 * oxScale;
  const bowl = lathe([
    [0, 0.02], [R * 0.42, 0], [R * 0.72, H * 0.06], [R * 0.9, H * 0.24], [R * 0.97, H * 0.5],
    [R * 0.99, H * 0.76], [R * 1.0, H * 0.9],
    // 7:26: the brim like a cup's brim, like a lily — it flares.
    [R * 1.07, H * 0.985], [R * 1.1, H],
    [R * 1.04, H * 0.99], [R * 0.96, H * 0.94], [R * 0.93, H * 0.7], [R * 0.86, H * 0.28], [R * 0.6, H * 0.14], [0, H * 0.12],
  ], bronze, 64);
  bowl.position.y = back - C * 0.05;
  g.add(bowl);
  // Two rows of gourds under the brim, ten to the cubit (7:24): 300 a row
  // on a thirty-cubit girth.
  // Ten to the cubit on the thirty-cubit line the text measures round it
  // (7:23–24) — 300 a row, not π × 10 × 10: the count is the text's, not
  // the geometry's.
  let gourds = 0;
  const n = 10 * spec.girth;
  for (let row = 0; row < 2; row++) {
    const y = bowl.position.y + H * (0.86 - row * 0.09);
    const rr = R * (0.995 - row * 0.02);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + row * (Math.PI / n);
      const gourd = new THREE.Mesh(new THREE.SphereGeometry(C * 0.045, 6, 5), bronze);
      gourd.scale.set(1, 1.25, 1);
      gourd.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      g.add(gourd);
      gourds++;
    }
  }
  // Twelve oxen, three to each cardinal face, tails inward (7:25).
  let oxen = 0;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const ox = buildOx(bronze);
    ox.scale.setScalar(oxScale);
    ox.position.set(Math.cos(a) * R * 0.55, 0, Math.sin(a) * R * 0.55);
    // Face outward: the ox's +x is its head.
    ox.rotation.y = -a;
    g.add(ox);
    oxen++;
  }
  return { group: g, oxen, gourds };
}

/** An ox at unit scale, head toward +x, standing on y=0, back at y≈0.86.
 *  7:25 names the animal and its facing; the anatomy is the least that reads
 *  as an ox from a few paces: barrel, dewlap, neck, head with muzzle and
 *  horns, four legs with hooves, a tail. */
export function buildOx(mat: Mat): THREE.Group {
  const g = new THREE.Group();
  const el = (x: number, y: number, z: number, rx: number, ry: number, rz: number, rot = 0) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
    m.scale.set(rx, ry, rz); m.position.set(x, y, z); m.rotation.z = rot;
    g.add(m); return m;
  };
  el(0, 0.56, 0, 0.5, 0.29, 0.26);              // barrel
  el(0.36, 0.62, 0, 0.26, 0.24, 0.22);           // shoulders/hump
  el(-0.36, 0.55, 0, 0.22, 0.24, 0.2);           // haunches
  el(0.16, 0.42, 0, 0.32, 0.12, 0.18);           // dewlap/belly line
  el(0.6, 0.66, 0, 0.16, 0.13, 0.13, -0.5);      // neck
  el(0.78, 0.72, 0, 0.13, 0.1, 0.1);             // head
  el(0.9, 0.66, 0, 0.09, 0.06, 0.075);           // muzzle
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.16, 6), mat);
    horn.position.set(0.76, 0.84, s * 0.09);
    horn.rotation.z = 0.3; horn.rotation.x = s * 0.9;
    g.add(horn);
    const ear = el(0.72, 0.78, s * 0.11, 0.03, 0.05, 0.02);
    ear.rotation.x = s * 0.8;
  }
  for (const sx of [-0.33, 0.3]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 8), mat);
    leg.position.set(sx, 0.21, sz * 0.14);
    g.add(leg);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.06, 8), mat);
    hoof.position.set(sx, 0.03, sz * 0.14);
    g.add(hoof);
  }
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.55, 0.62, 0), new THREE.Vector3(-0.62, 0.45, 0.02), new THREE.Vector3(-0.6, 0.2, 0.03),
  ]), 8, 0.02, 5, false), mat);
  g.add(tail);
  return g;
}

// ── A laver on its wheeled base, 1 Kgs 7:27–39 ──────────────────────────
// 7:27 base 4 × 4 × 3
// 7:28–29 panels (心子) between ledges, with lions, oxen and cherubim, and
//         wreaths hanging beneath
// 7:30 four bronze wheels and axles; undersetters at the four corners
// 7:31 a round mouth a cubit high, a cubit and a half across
// 7:32–33 wheels a cubit and a half high, made like chariot wheels — axle,
//         felloe, spokes and nave all cast
// 7:38 the laver itself four cubits across, forty baths
export function buildLaver(cubit: number, bronze: Mat, panel: Mat): THREE.Group {
  const C = cubit;
  const g = new THREE.Group();
  const S = 4 * C, baseH = 3 * C;
  // Corner posts and ledges — the frame the panels sit in.
  const post = (x: number, z: number) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(C * 0.32, baseH, C * 0.32), bronze);
    p.position.set(x, baseH / 2, z); g.add(p);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(sx * (S / 2 - C * 0.16), sz * (S / 2 - C * 0.16));
  for (const y of [C * 0.55, baseH - C * 0.2]) {
    for (const [ax, sign] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]] as const) {
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? C * 0.28 : S, C * 0.22, ax === 'z' ? C * 0.28 : S), bronze);
      ledge.position.set(ax === 'x' ? sign * (S / 2 - C * 0.14) : 0, y, ax === 'z' ? sign * (S / 2 - C * 0.14) : 0);
      g.add(ledge);
    }
  }
  // The four panels, each carrying the relief of 7:29 — as a cast plate
  // whose figures are in its normal map, the way the carved gold is.
  const panelW = S - C * 0.64, panelH = baseH - C * 0.95;
  for (const [ax, sign] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]] as const) {
    const geo = new THREE.PlaneGeometry(panelW, panelH);
    const m = new THREE.Mesh(geo, panel);
    const off = S / 2 - C * 0.1;
    if (ax === 'x') { m.position.set(sign * off, C * 0.55 + C * 0.11 + panelH / 2, 0); m.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { m.position.set(0, C * 0.55 + C * 0.11 + panelH / 2, sign * off); m.rotation.y = sign > 0 ? 0 : Math.PI; }
    g.add(m);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? C * 0.1 : panelW, panelH, ax === 'z' ? C * 0.1 : panelW), bronze);
    backing.position.copy(m.position);
    backing.position.x -= ax === 'x' ? sign * C * 0.06 : 0;
    backing.position.z -= ax === 'z' ? sign * C * 0.06 : 0;
    g.add(backing);
  }
  // Wheels like chariot wheels — 7:32–33: a cubit and a half high, with
  // felloe, six spokes and a nave, on axles under the base.
  const wheelR = 0.75 * C;
  for (const sx of [-1, 1]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(C * 0.07, C * 0.07, S + C * 0.7, 8), bronze);
    axle.rotation.x = Math.PI / 2; axle.position.set(sx * S * 0.3, wheelR, 0);
    g.add(axle);
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.position.set(sx * S * 0.3, wheelR, sz * (S / 2 + C * 0.2));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(wheelR - C * 0.06, C * 0.06, 8, 32), bronze);
      wheel.add(rim);
      const nave = new THREE.Mesh(new THREE.CylinderGeometry(C * 0.14, C * 0.14, C * 0.22, 12), bronze);
      nave.rotation.x = Math.PI / 2; wheel.add(nave);
      for (let i = 0; i < 6; i++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(C * 0.035, C * 0.035, wheelR - C * 0.1, 6), bronze);
        spoke.rotation.z = (i / 6) * Math.PI * 2;
        spoke.position.set(Math.sin((i / 6) * Math.PI * 2) * (wheelR / 2 - C * 0.03), Math.cos((i / 6) * Math.PI * 2) * (wheelR / 2 - C * 0.03), 0);
        wheel.add(spoke);
      }
      g.add(wheel);
    }
  }
  // Undersetters at the corners (7:30, 7:34) — shoulders rising to carry the
  // laver — and the round mouth, a cubit high and a cubit and a half across
  // (7:31), the laver sits in.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(C * 0.5, C * 0.5, C * 0.5), bronze);
    shoulder.position.set(sx * (S / 2 - C * 0.3), baseH + C * 0.2, sz * (S / 2 - C * 0.3));
    g.add(shoulder);
  }
  const mouth = lathe([[0, 0], [0.75 * C, 0], [0.8 * C, C], [0.7 * C, C], [0, C * 0.98]], bronze, 32);
  mouth.position.y = baseH;
  g.add(mouth);
  // The laver: four cubits across (7:38). A wide basin with a rolled lip;
  // the profile is display.
  const lR = 2 * C;
  const laver = lathe([
    [0, 0], [lR * 0.35, 0], [lR * 0.8, C * 0.25], [lR * 0.97, C * 0.8], [lR, C * 1.05], [lR * 1.05, C * 1.15],
    [lR * 0.98, C * 1.18], [lR * 0.92, C * 1.05], [lR * 0.75, C * 0.4], [lR * 0.3, C * 0.15], [0, C * 0.14],
  ], bronze, 48);
  laver.position.y = baseH + C * 0.85;
  g.add(laver);
  return g;
}

// ── A standing cherub of the oracle, 1 Kgs 6:23–28 / 2 Chr 3:10–13 ───────
// Ten cubits high; two wings of five cubits each, spread so that the tips
// meet the walls and each other; overlaid with gold (6:28); standing facing
// the holy place (2 Chr 3:13). The anatomy beyond "a winged figure" is
// unstated, so this is a robed figure, arms at the sides, wings level.
export function buildStandingCherub(cubit: number, gold: Mat): THREE.Group {
  const C = cubit;
  const H = 10 * C;
  const g = new THREE.Group();
  // Robe: a lathe with falling folds, feet to shoulders at 0.8 H.
  const robeH = H * 0.8;
  const sections: [number, number][] = [
    [0, H * 0.13], [robeH * 0.06, H * 0.125], [robeH * 0.3, H * 0.105], [robeH * 0.55, H * 0.09],
    [robeH * 0.78, H * 0.085], [robeH * 0.92, H * 0.1], [robeH, H * 0.085],
  ];
  const p: number[] = [], uv: number[] = [], ix: number[] = [];
  const seg = 48;
  for (let j = 0; j < sections.length; j++) for (let k = 0; k <= seg; k++) {
    const [y, r] = sections[j]!, a = (k / seg) * Math.PI * 2;
    const folds = 1 + (1 - y / robeH) * (0.035 * Math.cos(a * 11) + 0.02 * Math.sin(a * 19));
    p.push(Math.cos(a) * r * folds, y, Math.sin(a) * r * folds);
    uv.push(k / seg, y / robeH);
    if (j < sections.length - 1 && k < seg) { const q = j * (seg + 1) + k; ix.push(q, q + seg + 1, q + 1, q + 1, q + seg + 1, q + seg + 2); }
  }
  const robe = new THREE.BufferGeometry();
  robe.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  robe.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  robe.setIndex(ix); robe.computeVertexNormals();
  g.add(new THREE.Mesh(robe, gold));
  // Shoulders, neck, head.
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), gold);
  shoulders.scale.set(H * 0.11, H * 0.05, H * 0.085); shoulders.position.y = robeH;
  g.add(shoulders);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.028, H * 0.034, H * 0.05, 14), gold);
  neck.position.y = robeH + H * 0.04; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), gold);
  head.scale.set(H * 0.045, H * 0.058, H * 0.048); head.position.y = robeH + H * 0.115;
  g.add(head);
  // Arms at the sides, hands lowered.
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, robeH - H * 0.01, s * H * 0.09),
      new THREE.Vector3(H * 0.02, robeH - H * 0.2, s * H * 0.115),
      new THREE.Vector3(H * 0.04, robeH - H * 0.38, s * H * 0.105),
    ]), 12, H * 0.022, 8, false), gold);
    g.add(arm);
  }
  // Two wings, each 5 cubits from the shoulder to the tip, spread level
  // across the room (6:27). The wing is a feathered surface: primaries
  // trailing from a curved leading edge, two rows, so it reads as a wing and
  // not a paddle.
  const wingLen = 5 * C;
  for (const s of [-1, 1]) {
    const root = new THREE.Vector3(0, robeH - H * 0.03, s * H * 0.06);
    const edge = new THREE.CubicBezierCurve3(
      root,
      new THREE.Vector3(-H * 0.02, robeH + H * 0.12, s * wingLen * 0.3),
      new THREE.Vector3(-H * 0.03, robeH + H * 0.1, s * wingLen * 0.75),
      new THREE.Vector3(-H * 0.02, robeH + H * 0.01, s * wingLen));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(edge, 40, H * 0.016, 8, false), gold));
    // A membrane behind the feathers so the wing has no daylight through it.
    const shape = new THREE.Shape();
    const pts = edge.getPoints(24);
    shape.moveTo(pts[0]!.z, pts[0]!.y);
    for (const q of pts) shape.lineTo(q.z, q.y);
    shape.lineTo(s * wingLen * 0.98, robeH - H * 0.14);
    shape.quadraticCurveTo(s * wingLen * 0.5, robeH - H * 0.3, s * H * 0.05, robeH - H * 0.16);
    shape.closePath();
    // Behind the feathers, so from the front — the side a visitor sees,
    // 2 Chr 3:13 — the wing reads as feathers and not as a gilded paddle.
    const membrane = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), gold);
    membrane.rotation.y = Math.PI / 2; membrane.position.x = -H * 0.05;
    g.add(membrane);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 20; i++) {
      const t = 0.05 + i * 0.94 / 19;
      const r0 = edge.getPoint(t);
      const length = (0.10 + 0.16 * Math.sin(Math.min(1, t * 1.15) * Math.PI)) * H * (row ? 0.55 : 1);
      const drop = new THREE.Vector3(-H * 0.005 * row, -length, s * length * 0.25);
      const end = r0.clone().add(drop);
      const mid = r0.clone().lerp(end, 0.5); mid.x -= H * 0.01;
      const curve = new THREE.QuadraticBezierCurve3(r0, mid, end);
      const verts: number[] = [], faces: number[] = [];
      const width = H * 0.03 * (row ? 0.8 : 1);
      for (let j = 0; j <= 10; j++) {
        const f = j / 10, c = curve.getPoint(f);
        const w = width * Math.sin(Math.PI * f) ** 0.6;
        verts.push(c.x, c.y, c.z - s * w, c.x, c.y, c.z + s * w);
      }
      for (let j = 0; j < 10; j++) { const a = j * 2; faces.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const feather = new THREE.BufferGeometry();
      feather.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      feather.setIndex(faces); feather.computeVertexNormals();
      const fm = new THREE.Mesh(feather, gold);
      fm.position.x = -H * 0.02 - row * H * 0.012;
      g.add(fm);
    }
  }
  return g;
}
