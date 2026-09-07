import * as THREE from 'three';

// The lampstand of Exodus 25:31-40, built from the counts the passage states.
//
// This is the most minutely specified object in Scripture. The text does not
// merely say "ornate" — it says how many of each thing there is, and where:
//
//   25:32  six branches, three out of one side and three out of the other
//   25:33  three almond-blossom cups on EACH branch, each with a bulb and a flower
//   25:34  four almond-blossom cups on the central shaft, each with bulb and flower
//   25:35  a bulb under each of the three pairs where branches leave the shaft
//   25:37  seven lamps
//   25:39  one talent of pure gold — about 34 kg
//
// So the detail here is not an artist's flourish and not a generative model's
// guess: 6×3 + 4 = 22 blossom units, 3 junction bulbs, 7 lamps. Every one of
// them is a number in the passage. What the passage never gives is the
// lampstand's SIZE — no height, no span, nothing. That gap is carried in the
// spec's `unstated` list rather than papered over.

// Lathe resolution — this object is read close up, so it can afford it.
const RADIAL = 40;

/** "Of hammered work" — מִקְשָׁה, Exodus 25:31,36. Hammered gold is not a
 *  machined surface: it undulates, and that undulation is what makes the metal
 *  read as beaten rather than cast, because it breaks the environment
 *  reflection into moving highlights. Low-frequency displacement along the
 *  normals, seeded so a rebuild reproduces the same piece. */
function hammered(geo: THREE.BufferGeometry, amp: number, seed = 1): THREE.BufferGeometry {
  geo.computeVertexNormals();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Three octaves of cheap deterministic noise; no texture, no asset.
    const n =
      Math.sin(x * 41 * seed + y * 33) * 0.6 +
      Math.sin(y * 57 - z * 47 * seed) * 0.3 +
      Math.sin((x + z) * 89) * 0.1;
    pos.setXYZ(i,
      x + nor.getX(i) * n * amp,
      y + nor.getY(i) * n * amp,
      z + nor.getZ(i) * n * amp);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Five petals, because an almond blossom has five. Exodus 25:33 does not say
 *  "a flower" — it says the cups are "shaped like almond blossoms", and the
 *  almond's five-petalled form is the one botanical fact the simile carries.
 *  So the petals are as much a reading of the verse as the count of cups is. */
function almondPetals(scale: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    // A partial sphere patch makes a cupped petal in one cheap geometry.
    const geo = new THREE.SphereGeometry(scale * 0.36, 14, 9, 0, Math.PI * 0.78, 0, Math.PI * 0.5);
    geo.scale(1, 0.34, 1.35);
    hammered(geo, scale * 0.006, 2 + i);
    const petal = new THREE.Mesh(geo, mat);
    const a = (i / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * scale * 0.34, 0, Math.sin(a) * scale * 0.34);
    petal.rotation.set(-1.05, -a, 0);
    g.add(petal);
  }
  return g;
}

/** Profile of one almond-blossom unit: the cup (calyx), the bulb below it and
 *  the flower above, revolved as one form because verse 36 insists the whole
 *  lampstand is "one hammered piece" — the parts are not separate castings. */
function blossomProfile(scale: number): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.00, 0.00],
    [0.34, 0.03],  // bulb (כַּפְתֹּר) swelling out
    [0.46, 0.12],
    [0.44, 0.22],
    [0.30, 0.30],
    [0.22, 0.36],  // waist between bulb and cup
    [0.26, 0.44],
    [0.40, 0.56],  // cup (גָּבִיעַ) flaring like an almond calyx
    [0.46, 0.68],
    [0.40, 0.74],
    [0.30, 0.78],  // lip drawing back in
    [0.34, 0.86],
    [0.48, 0.96],  // flower (פֶּרַח) opening at the top
    [0.52, 1.04],
    [0.44, 1.08],
    [0.16, 1.10],
    [0.00, 1.12],
  ];
  return p.map(([x, y]) => new THREE.Vector2(x * scale, y * scale));
}

function blossom(scale: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const geo = hammered(new THREE.LatheGeometry(blossomProfile(scale), RADIAL), scale * 0.009);
  g.add(new THREE.Mesh(geo, mat));
  // The blossom opens at the top of the unit, where the profile flares.
  const petals = almondPetals(scale, mat);
  petals.position.y = scale * 1.0;
  g.add(petals);
  return g;
}

/** The junction bulb of verse 35 — plainer than a blossom, since the text
 *  gives it a bulb only, with no cup and no flower. */
function junctionBulb(scale: number, mat: THREE.Material): THREE.Mesh {
  const pts: [number, number][] = [
    [0.00, 0.00], [0.30, 0.04], [0.42, 0.16], [0.42, 0.30],
    [0.30, 0.40], [0.14, 0.45], [0.00, 0.46],
  ];
  const geo = hammered(new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x * scale, y * scale)), RADIAL), scale * 0.012, 3);
  return new THREE.Mesh(geo, mat);
}

/** A lamp (נֵר) — the seven of verse 37, sitting on shaft and branch tips. */
function lamp(scale: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(([
      [0.00, 0.00], [0.26, 0.02], [0.38, 0.10], [0.42, 0.20],
      [0.40, 0.26], [0.34, 0.26], [0.34, 0.22], [0.24, 0.10], [0.00, 0.06],
    ] as [number, number][]).map(([x, y]) => new THREE.Vector2(x * scale, y * scale)), RADIAL),
    mat,
  );
  bowl.geometry.computeVertexNormals();
  // The spout the wick lies in — a lamp of this period is a pinched bowl.
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.11 * scale, 0.2 * scale, 12, 1, true), mat);
  spout.rotation.z = -Math.PI / 2.2;
  spout.position.set(0.38 * scale, 0.15 * scale, 0);
  g.add(bowl, spout);
  return g;
}

/** The two readings of the branch shape. Exodus gives the branches' number and
 *  their ornaments but never their form, and the two oldest independent
 *  witnesses disagree:
 *
 *   'arch'     — the Arch of Titus relief, Rome, 1st century AD, carved within
 *                a generation of the Temple's fall. Circular branches. Nearly
 *                every menorah image of the last 2,000 years descends from it.
 *                Its BASE, however, is widely held to be unreliable, which is
 *                itself the main argument that the relief is not exact.
 *   'straight' — Maimonides, 12th century, drawn in his own hand in the Oxford
 *                manuscript of his Commentary on the Mishnah and again in the
 *                Mishneh Torah; his son Avraham confirmed the straight lines
 *                were deliberate. Chabad depicts it this way to this day.
 *
 * The page ships both and lets the reader switch, because the text does not
 * settle it and neither should this renderer. */
export type BranchForm = 'arch' | 'straight';

/** One branch, carrying its three blossom units (verse 33) and a lamp at the
 *  tip. The path differs by reading; everything mounted on it does not. */
function branch(
  side: 1 | -1, pair: number, unit: number, mat: THREE.Material, form: BranchForm,
): { group: THREE.Group; tip: THREE.Vector3 } {
  const g = new THREE.Group();

  // The three pairs leave the shaft at different heights and open to different
  // radii, so all six tips finish level with the shaft's lamp — the arrangement
  // shown on the Arch of Titus relief and assumed by "so that they give light
  // in front of it" (25:37).
  const startY = unit * (2.55 + pair * 1.02);
  const radius = unit * (2.15 + pair * 0.78);
  const topY = unit * 7.5;

  const start = new THREE.Vector3(0, startY, 0);
  const end = new THREE.Vector3(side * radius, topY, 0);

  const curve = form === 'arch'
    ? new THREE.CatmullRomCurve3([
        start,
        new THREE.Vector3(side * radius * 0.42, startY + (topY - startY) * 0.42, 0),
        new THREE.Vector3(side * radius * 0.92, startY + (topY - startY) * 0.82, 0),
        end,
      ])
    // Maimonides' reading: a straight diagonal out of the shaft, then vertical
    // to the lamp, which is how his sketch renders it.
    : new THREE.CatmullRomCurve3([
        start,
        new THREE.Vector3(side * radius * 0.5, startY + (topY - startY) * 0.5, 0),
        new THREE.Vector3(side * radius, topY - unit * 0.02, 0),
        end,
      ], false, 'catmullrom', 0);

  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, form === 'arch' ? 72 : 28, unit * 0.125, 16, false), mat);
  g.add(tube);

  // Three blossoms spaced along the branch, each standing off the arc's normal.
  for (let i = 0; i < 3; i++) {
    const t = 0.17 + i * 0.30;
    const pos = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const b = blossom(unit * 0.78, mat);
    b.position.copy(pos);
    // Seat each blossom square on the branch rather than leaving it axis-aligned.
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.clone().normalize());
    g.add(b);
  }

  const tip = curve.getPointAt(1);
  const l = lamp(unit * 0.72, mat);
  l.position.copy(tip);
  g.add(l);

  return { group: g, tip };
}

export interface MenorahCounts {
  branches: number; cupsPerBranch: number; shaftCups: number;
  junctionBulbs: number; lamps: number; totalBlossoms: number;
}

/** The two-tiered hexagonal base carved on the Arch of Titus, with the
 *  recessed decorated panels the relief shows on each face. It is also the
 *  single strongest argument AGAINST the relief's accuracy: Jewish tradition
 *  describes a tripod, and the panel creatures on the Roman carving would not
 *  belong on a Temple vessel. The card says so; the geometry follows whichever
 *  reading the reader picked. */
function archBase(unit: number, mat: THREE.Material, panelMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const tiers: [number, number, number][] = [
    // radius, height, y
    [2.05, 0.34, 0.00],
    [1.52, 0.38, 0.34],
    [0.95, 0.34, 0.72],
  ];
  for (const [r, h, y] of tiers) {
    const drum = new THREE.Mesh(
      hammered(new THREE.CylinderGeometry(r * unit * 0.93, r * unit, h * unit, 6, 1), unit * 0.006, 5),
      mat);
    drum.position.y = (y + h / 2) * unit;
    g.add(drum);
    // A recessed panel on each of the six flat faces. A hexagon's faces lie at
    // r·cos(30°) from the axis, not at r — placing them at the vertex radius
    // pushes them straight out through the corners.
    const faceR = r * Math.cos(Math.PI / 6);
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2 + Math.PI / 6;
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(r * unit * 0.62, h * unit * 0.52, unit * 0.03), panelMat);
      // Sunk just inside the face so it reads as chased into the metal.
      panel.position.set(
        Math.cos(a) * faceR * unit * 0.965, (y + h / 2) * unit, Math.sin(a) * faceR * unit * 0.965);
      panel.rotation.y = -a + Math.PI / 2;
      g.add(panel);
    }
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(r * unit * 0.95, unit * 0.035, 8, 6), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = (y + h) * unit;
    g.add(rim);
  }
  const neck = new THREE.Mesh(
    hammered(new THREE.LatheGeometry(([
      [0.62, 0.00], [0.50, 0.10], [0.36, 0.24], [0.30, 0.42], [0.00, 0.42],
    ] as [number, number][]).map(([x, y]) => new THREE.Vector2(x * unit, (y + 0.94) * unit)), RADIAL),
      unit * 0.008, 6),
    mat);
  g.add(neck);
  return g;
}

/** The tripod base of rabbinic tradition — three feet under a turned stem,
 *  which is how Maimonides' own sketch and the mainstream halakhic
 *  description have it, against the Roman relief. */
function tripodBase(unit: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    hammered(new THREE.LatheGeometry(([
      [0.00, 0.00], [0.72, 0.03], [0.62, 0.20], [0.44, 0.44],
      [0.36, 0.78], [0.30, 1.20], [0.00, 1.20],
    ] as [number, number][]).map(([x, y]) => new THREE.Vector2(x * unit, y * unit)), RADIAL),
      unit * 0.008, 7),
    mat);
  g.add(stem);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, unit * 0.85, 0),
      new THREE.Vector3(Math.cos(a) * unit * 0.80, unit * 0.46, Math.sin(a) * unit * 0.80),
      new THREE.Vector3(Math.cos(a) * unit * 1.50, unit * 0.13, Math.sin(a) * unit * 1.50),
      new THREE.Vector3(Math.cos(a) * unit * 1.72, 0, Math.sin(a) * unit * 1.72),
    ]);
    const leg = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, unit * 0.10, 12, false), mat);
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(unit * 0.17, 16, 12), mat);
    foot.position.set(Math.cos(a) * unit * 1.74, unit * 0.08, Math.sin(a) * unit * 1.74);
    g.add(foot);
  }
  return g;
}

/** Builds the lampstand at `height` metres in the chosen reading, and reports
 *  what it actually made so the card can state the counts rather than assert
 *  them. */
export function buildMenorah(
  height: number, form: BranchForm = 'arch',
): { group: THREE.Group; counts: MenorahCounts } {
  const g = new THREE.Group();

  // "Of pure gold" (25:31), hammered from a single talent (25:39). Low
  // roughness with a trace of variation reads as hammered rather than cast.
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd4af37, metalness: 1.0, roughness: 0.22,
  });

  // The whole form is laid out in one unit so changing `height` rescales every
  // ornament together — the same discipline as the cubit slider.
  const unit = height / 8.6;

  // The base is carried by the same reading as the branches, because the two
  // witnesses disagree about both: the relief shows tiers, the tradition a
  // tripod, and it would be incoherent to mix them.
  const panel = new THREE.MeshStandardMaterial({
    color: 0xb8912c, metalness: 1.0, roughness: 0.42,
  });
  g.add(form === 'arch' ? archBase(unit, gold, panel) : tripodBase(unit, gold));

  const shaft = new THREE.Mesh(
    hammered(new THREE.CylinderGeometry(unit * 0.13, unit * 0.17, unit * 6.5, 24, 6), unit * 0.005, 4),
    gold);
  shaft.position.y = unit * 4.3;
  g.add(shaft);

  let blossoms = 0;

  // Six branches, three a side (25:32), in three pairs.
  for (let pair = 0; pair < 3; pair++) {
    for (const side of [1, -1] as const) {
      const { group } = branch(side, pair, unit, gold, form);
      g.add(group);
      blossoms += 3;                                    // 25:33
    }
    // "A bulb under each pair of branches" — 25:35.
    const bulb = junctionBulb(unit * 0.78, gold);
    bulb.position.y = unit * (2.55 + pair * 1.02) - unit * 0.24;
    g.add(bulb);
  }

  // Four blossom units on the shaft itself — 25:34.
  for (let i = 0; i < 4; i++) {
    const b = blossom(unit * 0.55, gold);
    b.position.y = unit * (1.85 + i * 1.42);
    g.add(b);
    blossoms++;
  }

  // The seventh lamp, on the shaft — 25:37. The other six sit on the branches.
  const centre = lamp(unit * 0.72, gold);
  centre.position.y = unit * 7.5;
  g.add(centre);

  return {
    group: g,
    counts: {
      branches: 6, cupsPerBranch: 3, shaftCups: 4,
      junctionBulbs: 3, lamps: 7, totalBlossoms: blossoms,
    },
  };
}
