import * as THREE from 'three';
import { buildCherub } from './cherub.ts';

/** Builds the Ark of the Covenant (2.5 × 1.5 × 1.5 cubits) with its mercy seat, carrying poles and two golden cherubim (Exod 25:10-20). */
export function buildArkChest(C: number): THREE.Group {
  const L = 2.5 * C;
  const W = 1.5 * C;
  const H = 1.5 * C;
  const g = new THREE.Group();

  const gold = new THREE.MeshStandardMaterial({
    color: 0xecb943,
    metalness: 0.88,
    roughness: 0.22,
  });
  const crownGold = new THREE.MeshStandardMaterial({
    color: 0xf7cf65,
    metalness: 0.92,
    roughness: 0.16,
  });

  // Stepped corner feet & box chest overlaid in gold
  const legH = 0.08 * C;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18 * C, legH, 0.18 * C), crownGold);
      foot.position.set(sx * (L * 0.5 - 0.1 * C), legH * 0.5, sz * (W * 0.5 - 0.1 * C));
      g.add(foot);
    }
  }

  const bodyH = H - legH - 0.08 * C;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(L, bodyH, W), gold);
  chest.position.y = legH + bodyH * 0.5;
  g.add(chest);

  // Molded gold crown border rimming upper edge (Exod 25:11)
  const rimH = 0.09 * C;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(L + 0.09 * C, rimH, W + 0.09 * C), crownGold);
  rim.position.y = H - 0.02 * C;
  g.add(rim);

  // Mercy Seat (Kapporet, 2.5 x 1.5 cubits) crowning top
  const lid = new THREE.Mesh(new THREE.BoxGeometry(L + 0.04 * C, 0.07 * C, W + 0.04 * C), gold);
  lid.position.y = H + 0.05 * C;
  g.add(lid);

  // Four gold rings at the four feet + two carrying poles along X axis (Exod 25:12-15)
  const ringGeo = new THREE.TorusGeometry(0.08 * C, 0.024 * C, 10, 20);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, crownGold);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * (L * 0.5 - 0.12 * C), legH + 0.12 * C, sz * (W * 0.5 + 0.04 * C));
      g.add(ring);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * C, 0.04 * C, L * 1.62, 14), gold);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, legH + 0.12 * C, sz * (W * 0.5 + 0.04 * C));
    g.add(pole);
  }

  // Two golden Cherubim facing each other across the Mercy Seat (Exod 25:18-20)
  for (const sx of [-1, 1]) {
    const cherub = buildCherub(C * 0.88, crownGold);
    cherub.position.set(sx * L * 0.34, H + 0.085 * C, 0);
    cherub.rotation.y = sx > 0 ? Math.PI : 0;
    cherub.userData.shimmer = sx > 0 ? 1 : 2;
    g.add(cherub);
  }

  return g;
}
