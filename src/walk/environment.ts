import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { detailedSurface, rockProjection } from './materials.ts';

// An ORIGINAL generic arid set, not a surveyed location of Mount Sinai.
// Domain-warped ridges give connected rock masses, branching gullies and
// scree slopes. Geometry, not a generated panorama, supplies the silhouette.
const noise = new ImprovedNoise();
const N = (x: number, z: number, seed = 0) => noise.noise(x, z, 17.3 + seed);
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

/** Where the far massifs begin. The tabernacle stands in the open, so they
 *  start close; the temple stands on a mount 460 m across, and a massif that
 *  begins at 64 m would grow out of its own slope. */
let reliefInner = 64;

function relief(x: number, z: number) {
  const d = Math.hypot(x, z);
  const wx = x + N(x * .008, z * .008) * 36;
  const wz = z + N(x * .009, z * .009, 9) * 28;
  // Separate massifs rather than a constant-radius wall around the visitor.
  let mass = 0;
  for (const [px, pz, h, sx, sz] of [[-245, -145, 110, 125, 95], [-210, 140, 93, 95, 120],
    [25, -255, 103, 125, 90], [245, -110, 88, 90, 100], [215, 230, 115, 115, 105], [-30, 290, 83, 110, 110]]) {
    mass += h! * Math.exp(-(((wx - px!) / sx!) ** 2) - ((wz - pz!) / sz!) ** 2);
  }
  let ridge = 0, weight = 1, frequency = .014, amplitude = .58;
  for (let k = 0; k < 5; k++) {
    const r = (1 - Math.abs(N(wx * frequency, wz * frequency, k * 3))) ** 2;
    ridge += r * amplitude * weight;
    weight = Math.min(1, r * 1.8); frequency *= 2.13; amplitude *= .48;
  }
  return Math.max(0, mass * (.30 + ridge * .90) - 13) * smooth(reliefInner, reliefInner + 56, d) * (1 - smooth(390, 500, d));
}

/** `clear` says where the level, built ground is — no boulders there. The
 *  default is the tabernacle's court and its approach; the temple passes its
 *  own platform. */
export function buildDesert(clear: (x: number, z: number) => boolean = (x, z) =>
  (Math.abs(x) < 25 && Math.abs(z) < 14) || (x > 20 && Math.abs(z) < 4), inner = 64) {
  reliefInner = inner;
  const group = new THREE.Group(); group.name = 'Illustrative arid environment';
  const geo = new THREE.PlaneGeometry(1000, 1000, 256, 256); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position!, colors = new Float32Array(p.count * 3);
  const base = new THREE.Color(), ochre = new THREE.Color('#efe2ce'), grey = new THREE.Color('#b4aba0');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = relief(x, z);
    p.setY(i, h - .12);
    const slope = Math.hypot(relief(x + 2, z) - relief(x - 2, z), relief(x, z + 2) - relief(x, z - 2)) / 4;
    const concavity = h - (relief(x + 4, z) + relief(x - 4, z) + relief(x, z + 4) + relief(x, z - 4)) / 4;
    base.copy(ochre).lerp(grey, smooth(.25, 1.1, slope) * .72);
    base.multiplyScalar(.92 + N(x * .055, z * .055, 20) * .18 + THREE.MathUtils.clamp(concavity * .05, -.12, .06));
    base.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const rock = detailedSurface(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .98, vertexColors: true }), 'desert-rock', 1, 0);
  // Triplanar color supplies the detail; a single-UV height map would stretch
  // on cliffs, so avoid pretending that an albedo-derived bump is rock relief.
  rockProjection(rock, 7);
  const mountain = new THREE.Mesh(geo, rock); mountain.userData.noCast = true; mountain.userData.dynamic = true;
  group.add(mountain);

  // Irregular boulders/chips make the scale transition from grains to cliffs.
  // Outside the level court only; the clear entrance path stays unobstructed.
  const stoneGeo = new THREE.IcosahedronGeometry(1, 2);
  const sp = stoneGeo.attributes.position!;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
    const r = 1 + N(x * 3, z * 3, y * 2) * .24;
    sp.setXYZ(i, x * r, y * r * .69, z * r);
  }
  stoneGeo.computeVertexNormals();
  const stoneMat = detailedSurface(new THREE.MeshStandardMaterial({color: 0xb8ab98, roughness: .98}), 'desert-rock', 1, .012);
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, 360);
  const dummy = new THREE.Object3D(); const tint = new THREE.Color();
  let index = 0;
  for (let i = 0; index < 360 && i < 4000; i++) {
    const a = i * 2.399963, radius = 18 + (Math.sin(i * 78.23) * .5 + .5) ** .65 * 105;
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    if (clear(x, z)) continue;
    const size = .075 + (Math.sin(i * 6.3) * .5 + .5) ** 5 * 1.35;
    dummy.position.set(x, Math.max(0, relief(x, z) - .12) + size * .30, z);
    dummy.scale.set(size * 1.4, size, size * .9); dummy.rotation.set(i * .3, i, i * .12); dummy.updateMatrix();
    stones.setMatrixAt(index, dummy.matrix);
    tint.setHSL(.085 + .02 * Math.sin(i), .08 + .08 * (Math.sin(i * 3) * .5 + .5), .68 + Math.sin(i * 5) * .11);
    stones.setColorAt(index, tint); index++;
  }
  stones.count = index;              // …and the ones never placed are not drawn
  stones.userData.noCast = true; group.add(stones);
  return group;
}

// ── the mount ────────────────────────────────────────────────────────────
//
// 2 Chr 3:1 puts the house on MOUNT MORIAH, at the threshing floor of Ornan
// the Jebusite. Three things in that sentence are the text's and not a
// designer's: it is a mountain, it is a threshing floor — which is put on a
// height because the wind does the winnowing — and the whole canon speaks of
// going UP to it (Ps 24:3, 122:4; Isa 2:2 has the mountain of the house
// established above the hills). The temple stood on a flat platform in a flat
// plain here, which is the one thing the text does not say.
//
// What is the text's: a mountain, a levelled summit for the house and its
// court, and a way up. What is NOT, and is said so on the card: this profile.
// No survey of Jerusalem is being claimed — the Kidron is east of the city
// (2 Sam 15:23) and the city of David is south of the house and lower than it
// (2 Sam 5:7), so the fall is steepest to the east and the ridge runs away
// south, and that is as far as the shape can be read out of the text.
//
// One function answers both the rock and the walker's feet, so what a visitor
// stands on is the same surface they can see.

export interface Mount {
  group: THREE.Group;
  /** Ground height in metres at any point — the walker's floor. */
  heightAt: (x: number, z: number) => number;
  /** The flat ground the valley settles to. */
  valleyY: number;
}

export function buildMount(summitHalfX: number, summitHalfZ: number): Mount {
  const VALLEY = -28;                 // metres below the summit
  // The rock of the summit sits a finger under the dressed paving, so the two
  // surfaces do not fight for the same pixels across the whole court.
  const SUMMIT = -0.06;
  // How far the fall runs, by side. Short to the east, where the ground drops
  // into the Kidron; long to the south, where the ridge runs down to the city.
  const RUN = { east: 34, west: 58, north: 54, south: 96 };
  // East is a scarp, not a slope: 28 m of fall in 34 steepens past 45° in its
  // middle band, which is the gradient the walker refuses to climb. So the
  // road on the south ridge is the way up, and the ground says so.
  // The road up: it arrives at the summit's south-east shoulder and runs down
  // the south ridge, because that is the side the city is on and the only
  // side gentle enough to walk.
  // Plain numbers, not vectors: this function is called about a hundred
  // thousand times to build the ground and a few times a frame to hold the
  // walker up, and allocating two Vector2s per call cost seconds of load.
  const AX = summitHalfX - 6, AZ = -summitHalfZ;
  const BX = summitHalfX + 12, BZ = -summitHalfZ - 96;
  const RX = BX - AX, RZ = BZ - AZ;
  const RLEN2 = RX * RX + RZ * RZ;
  const ROAD_HALF = 5.5;              // carriageway
  const ROAD_EDGE = 11;               // …and its shoulders

  const heightAt = (x: number, z: number): number => {
    const dx = Math.max(0, Math.abs(x) - summitHalfX);
    const dz = Math.max(0, Math.abs(z) - summitHalfZ);
    if (dx === 0 && dz === 0) return SUMMIT;                 // the levelled summit
    const d = Math.hypot(dx, dz);
    // Blend the two runs by which way the ground is actually falling.
    const wx = dx / (dx + dz);
    const run = (x > 0 ? RUN.east : RUN.west) * wx + (z > 0 ? RUN.north : RUN.south) * (1 - wx);
    // Steep at the top, easing into the valley — a plateau with an edge, not a
    // dome. A smoothstep fall is gentlest exactly where it matters most: it
    // rounded the summit over until the house was hidden behind its own hill
    // from anywhere below.
    const u = Math.min(1, d / run);
    let h = SUMMIT + (VALLEY - SUMMIT) * (1 - (1 - u) ** 2);
    // Rock, not a ramp: broken ground on the slopes, nothing on the summit.
    const rough = smooth(0, 14, d) * (1 - smooth(run, run + 40, d));
    h += (N(x * 0.035, z * 0.035, 4) * 2.1 + N(x * 0.11, z * 0.11, 8) * 0.7) * rough;

    // The road holds its own grade across all of that.
    const t = THREE.MathUtils.clamp(((x - AX) * RX + (z - AZ) * RZ) / RLEN2, 0, 1);
    const off = Math.hypot(x - (AX + RX * t), z - (AZ + RZ * t));
    if (off < ROAD_EDGE) {
      const surface = SUMMIT + (VALLEY - SUMMIT) * t;
      const blend = 1 - smooth(ROAD_HALF, ROAD_EDGE, off);
      h = Math.max(h, THREE.MathUtils.lerp(h, surface, blend));
    }
    return h;
  };

  const group = new THREE.Group();
  group.name = 'Mount Moriah — an illustrative height, not a survey';
  const SIZE = 360, SEG = 256;        // 1.4 m between samples
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position!;
  const colors = new Float32Array(p.count * 3);
  const base = new THREE.Color(), ochre = new THREE.Color('#e6d7bd'), grey = new THREE.Color('#a79c8d');
  // One evaluation per vertex, and the slope read off the neighbours already
  // in the grid. Four extra probes per vertex is five times the work for a
  // number the grid already contains.
  const row = SEG + 1, step = SIZE / SEG;
  const heights = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const h = heightAt(p.getX(i), p.getZ(i));
    heights[i] = h;
    p.setY(i, h);
  }
  for (let i = 0; i < p.count; i++) {
    const c = i % row, r = (i / row) | 0;
    const hx = (heights[i - (c > 0 ? 1 : 0)]! - heights[i + (c < SEG ? 1 : 0)]!) / (2 * step);
    const hz = (heights[i - (r > 0 ? row : 0)]! - heights[i + (r < SEG ? row : 0)]!) / (2 * step);
    const x = p.getX(i), z = p.getZ(i);
    const slope = Math.hypot(hx, hz);
    base.copy(ochre).lerp(grey, smooth(0.2, 1.0, slope) * 0.8);
    base.multiplyScalar(0.93 + N(x * 0.06, z * 0.06, 20) * 0.16);
    base.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const rock = detailedSurface(new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.97, vertexColors: true,
  }), 'desert-rock', 1, 0);
  rockProjection(rock, 7);
  const mesh = new THREE.Mesh(geo, rock);
  mesh.receiveShadow = true;
  mesh.userData.noCast = true;
  mesh.userData.dynamic = true;
  group.add(mesh);

  // Loose rock on the slopes, none on the levelled summit and none on the
  // road. Placed on the same height field the ground is drawn from.
  const stoneGeo = new THREE.IcosahedronGeometry(1, 2);
  const sp = stoneGeo.attributes.position!;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
    const r = 1 + N(x * 3, z * 3, y * 2) * 0.24;
    sp.setXYZ(i, x * r, y * r * 0.69, z * r);
  }
  stoneGeo.computeVertexNormals();
  const stoneMat = detailedSurface(new THREE.MeshStandardMaterial({
    color: 0xb3a692, roughness: 0.98,
  }), 'desert-rock', 1, 0.012);
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, 420);
  const dummy = new THREE.Object3D(); const tint = new THREE.Color();
  let placed = 0;
  for (let i = 0; placed < 420 && i < 6000; i++) {
    const a = i * 2.399963;
    const radius = summitHalfX * 0.8 + (Math.sin(i * 78.23) * 0.5 + 0.5) ** 0.6 * 120;
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius * 0.86;
    const h = heightAt(x, z);
    if (h > SUMMIT - 0.5) continue;                       // the summit stays clear
    const grade = Math.hypot(heightAt(x + 1.5, z) - heightAt(x - 1.5, z),
      heightAt(x, z + 1.5) - heightAt(x, z - 1.5)) / 3;
    if (grade < 0.08) continue;                           // and so does the road
    const size = 0.1 + (Math.sin(i * 6.3) * 0.5 + 0.5) ** 4 * 1.6;
    dummy.position.set(x, h + size * 0.3, z);
    dummy.scale.set(size * 1.4, size, size * 0.9);
    dummy.rotation.set(i * 0.3, i, i * 0.12);
    dummy.updateMatrix();
    stones.setMatrixAt(placed, dummy.matrix);
    tint.setHSL(0.085 + 0.02 * Math.sin(i), 0.08 + 0.08 * (Math.sin(i * 3) * 0.5 + 0.5),
      0.66 + Math.sin(i * 5) * 0.11);
    stones.setColorAt(placed, tint);
    placed++;
  }
  stones.count = placed;
  stones.userData.noCast = true;
  group.add(stones);
  return { group, heightAt, valleyY: VALLEY };
}
