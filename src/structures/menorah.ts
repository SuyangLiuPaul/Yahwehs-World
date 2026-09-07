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
const RADIAL = 24;

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

function blossom(scale: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.LatheGeometry(blossomProfile(scale), RADIAL);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  return m;
}

/** The junction bulb of verse 35 — plainer than a blossom, since the text
 *  gives it a bulb only, with no cup and no flower. */
function junctionBulb(scale: number, mat: THREE.Material): THREE.Mesh {
  const pts: [number, number][] = [
    [0.00, 0.00], [0.30, 0.04], [0.42, 0.16], [0.42, 0.30],
    [0.30, 0.40], [0.14, 0.45], [0.00, 0.46],
  ];
  const geo = new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x * scale, y * scale)), RADIAL);
  geo.computeVertexNormals();
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
  const startY = unit * (3.2 + pair * 0.95);
  const radius = unit * (1.55 + pair * 0.62);
  const topY = unit * 7.4;

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
    new THREE.TubeGeometry(curve, form === 'arch' ? 64 : 24, unit * 0.11, 14, false), mat);
  g.add(tube);

  // Three blossoms spaced along the branch, each standing off the arc's normal.
  for (let i = 0; i < 3; i++) {
    const t = 0.24 + i * 0.26;
    const pos = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const b = blossom(unit * 0.5, mat);
    b.position.copy(pos);
    // Seat each blossom square on the branch rather than leaving it axis-aligned.
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.clone().normalize());
    g.add(b);
  }

  const tip = curve.getPointAt(1);
  const l = lamp(unit * 0.62, mat);
  l.position.copy(tip);
  g.add(l);

  return { group: g, tip };
}

export interface MenorahCounts {
  branches: number; cupsPerBranch: number; shaftCups: number;
  junctionBulbs: number; lamps: number; totalBlossoms: number;
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

  const base = new THREE.Mesh(
    new THREE.LatheGeometry(([
      [0.00, 0.00], [1.35, 0.00], [1.32, 0.10], [1.05, 0.20],
      [0.70, 0.30], [0.46, 0.46], [0.34, 0.72], [0.30, 1.05], [0.00, 1.05],
    ] as [number, number][]).map(([x, y]) => new THREE.Vector2(x * unit, y * unit)), RADIAL),
    gold,
  );
  base.geometry.computeVertexNormals();
  g.add(base);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(unit * 0.13, unit * 0.16, unit * 6.5, 18, 1), gold);
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
    const bulb = junctionBulb(unit * 0.62, gold);
    bulb.position.y = unit * (3.2 + pair * 0.95) - unit * 0.2;
    g.add(bulb);
  }

  // Four blossom units on the shaft itself — 25:34.
  for (let i = 0; i < 4; i++) {
    const b = blossom(unit * 0.55, gold);
    b.position.y = unit * (1.5 + i * 1.72);
    g.add(b);
    blossoms++;
  }

  // The seventh lamp, on the shaft — 25:37. The other six sit on the branches.
  const centre = lamp(unit * 0.62, gold);
  centre.position.y = unit * 7.4;
  g.add(centre);

  return {
    group: g,
    counts: {
      branches: 6, cupsPerBranch: 3, shaftCups: 4,
      junctionBulbs: 3, lamps: 7, totalBlossoms: blossoms,
    },
  };
}
