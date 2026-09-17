import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { detailedSurface, rockProjection } from './materials.ts';

// An ORIGINAL generic arid set, not a surveyed location of Mount Sinai.
// Domain-warped ridges give connected rock masses, branching gullies and
// scree slopes. Geometry, not a generated panorama, supplies the silhouette.
const noise = new ImprovedNoise();
const N = (x: number, z: number, seed = 0) => noise.noise(x, z, 17.3 + seed);
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

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
  return Math.max(0, mass * (.30 + ridge * .90) - 13) * smooth(64, 120, d) * (1 - smooth(390, 500, d));
}

/** `clear` says where the level, built ground is — no boulders there. The
 *  default is the tabernacle's court and its approach; the temple passes its
 *  own platform. */
export function buildDesert(clear: (x: number, z: number) => boolean = (x, z) =>
  (Math.abs(x) < 25 && Math.abs(z) < 14) || (x > 20 && Math.abs(z) < 4)) {
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
  for (let i = 0; index < 360; i++) {
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
  stones.userData.noCast = true; group.add(stones);
  return group;
}
