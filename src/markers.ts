import * as THREE from 'three';
import { lonLatToVec3 } from './globe.ts';
import { precisionOf } from './theme.ts';
import type { Place } from './types.ts';

// One InstancedMesh carries every place, so 1,332 markers cost a single draw
// call and the timeline can hide or reveal any of them by rewriting a matrix
// rather than touching the scene graph.
const BASE_RADIUS = 0.62;

export class Markers {
  readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly scales: number[];
  /** Places currently past the timeline cursor; index into `places`. */
  private visible = new Set<number>();

  constructor(readonly places: Place[]) {
    const geo = new THREE.SphereGeometry(BASE_RADIUS, 10, 8);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.25 });
    this.mesh = new THREE.InstancedMesh(geo, mat, places.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // A place named once and a place named four hundred times should not read
    // the same, but raw counts span three orders of magnitude — hence the log.
    this.scales = places.map((p) => 0.75 + Math.log10(1 + p.verseCount) * 1.15);

    const color = new THREE.Color();
    places.forEach((p, i) => {
      color.set(precisionOf(p.precision).color);
      // A disputed identification is dimmed rather than hidden: the place is
      // real, our knowledge of where it sat is not.
      if (p.rivals > 1) color.multiplyScalar(0.72);
      this.mesh.setColorAt(i, color);
    });
    this.mesh.instanceColor!.needsUpdate = true;

    this.setCursor(Number.POSITIVE_INFINITY);
  }

  /** Shows every place first mentioned at or before `cursor` (a bbbcccvvv
   *  canonical key). Hidden places collapse to zero scale. */
  setCursor(cursor: number) {
    this.visible.clear();
    this.places.forEach((p, i) => {
      const shown = p.first !== null && p.first <= cursor;
      if (shown) this.visible.add(i);
      const v = lonLatToVec3(p.lon, p.lat, 0.5);
      this.dummy.position.copy(v);
      this.dummy.scale.setScalar(shown ? this.scales[i]! : 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
  }

  get visibleCount() { return this.visible.size; }

  isVisible(index: number) { return this.visible.has(index); }
}
