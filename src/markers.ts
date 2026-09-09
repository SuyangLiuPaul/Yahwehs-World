import * as THREE from 'three';
import { lonLatToVec3 } from './globe.ts';
import { precisionOf } from './theme.ts';
import type { BibleEvent, Place } from './types.ts';

// One InstancedMesh carries every place, so 1,332 markers cost a single draw
// call and the timeline can restyle any of them by rewriting a matrix and a
// colour rather than touching the scene graph.
const BASE_RADIUS = 0.62;

/** How many events a place stays visibly warm after it is last named. Long
 *  enough that a run through one chapter reads as a moving front, short enough
 *  that the map does not saturate by the time Joshua finishes campaigning. */
const AFTERGLOW = 55;

/** Floor brightness for somewhere the narrative has already been. Visited
 *  places never disappear — the point of the timeline is accumulation. */
const VISITED = 0.3;

export class Markers {
  readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly baseScale: number[];
  private readonly baseColor: THREE.Color[];
  /** Event index at which each place was most recently named, or -1. */
  private readonly lastSeen: Int32Array;
  private readonly scratch = new THREE.Color();
  private visibleCountCache = 0;
  /** Per-instance scale from the last cursor pass, before the zoom factor. */
  private readonly curScale: Float32Array;
  /** Markers are sized for the whole-globe view. Held at that size they become
   *  beach balls the moment the camera drops to terrain height, so the world
   *  size tracks camera distance and the screen size stays put. */
  private zoomK = 1;
  /** Places named by the verse the cursor is sitting on. */
  activeIndices: number[] = [];

  constructor(readonly places: Place[], readonly events: BibleEvent[]) {
    const geo = new THREE.SphereGeometry(BASE_RADIUS, 10, 8);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.25 });
    this.mesh = new THREE.InstancedMesh(geo, mat, places.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // A place named once and a place named 955 times should not read the same,
    // but the counts span three orders of magnitude — hence the log.
    this.baseScale = places.map((p) => 0.75 + Math.log10(1 + p.verseCount) * 1.15);

    this.baseColor = places.map((p) => {
      const c = new THREE.Color(precisionOf(p.precision).color);
      // A disputed identification is dimmed rather than hidden: the place is
      // real, our knowledge of where it sat is not.
      if (p.rivals > 1) c.multiplyScalar(0.72);
      return c;
    });

    this.lastSeen = new Int32Array(places.length).fill(-1);
    this.curScale = new Float32Array(places.length);
    this.setCursor(events.length - 1);
  }

  /** Replays the canon from the beginning up to `cursor` and restyles every
   *  marker from what it finds. A full replay is 8,700 integer writes, which is
   *  cheap enough to redo on every scrub and keeps backward seeking exact —
   *  incremental stepping would have to unwind history to go backwards. */
  setCursor(cursor: number) {
    const clamped = Math.max(-1, Math.min(cursor, this.events.length - 1));
    this.lastSeen.fill(-1);
    for (let i = 0; i <= clamped; i++) {
      for (const p of this.events[i]!.p) this.lastSeen[p] = i;
    }
    this.activeIndices = clamped >= 0 ? [...this.events[clamped]!.p] : [];

    let visible = 0;
    for (let i = 0; i < this.places.length; i++) {
      const seen = this.lastSeen[i]!;
      if (seen < 0) {
        this.curScale[i] = 0;
      } else {
        visible++;
        const age = clamped - seen;
        // Warm just after being named, settling to the visited floor.
        const heat = age === 0 ? 1 : Math.max(0, 1 - age / AFTERGLOW);
        const brightness = VISITED + (1 - VISITED) * heat;
        this.curScale[i] = this.baseScale[i]! * (1 + heat * 0.85);
        this.scratch.copy(this.baseColor[i]!).multiplyScalar(brightness);
        // The verse's own places get lifted toward gold so the eye lands on
        // what is being read right now, not merely on what is bright.
        if (age === 0) this.scratch.lerp(GOLD, 0.55);
        this.mesh.setColorAt(i, this.scratch);
      }
    }

    this.visibleCountCache = visible;
    this.writeMatrices();
    this.mesh.instanceColor!.needsUpdate = true;
  }

  /** Rewrites every instance matrix from the cached scales and the current
   *  zoom factor. Kept separate from setCursor because zooming must not
   *  re-run the 8,700-write event replay on every frame. */
  private writeMatrices() {
    for (let i = 0; i < this.places.length; i++) {
      this.dummy.scale.setScalar(this.curScale[i]! * this.zoomK);
      // Lift with the zoom too, so a marker never sinks into the relief.
      this.dummy.position.copy(
        lonLatToVec3(this.places[i]!.lon, this.places[i]!.lat, 0.35 + 0.5 * this.zoomK));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
  }

  /** Screen-size compensation. The markers were tuned at the opening distance
   *  of four radii; world size tracks distance from there, floored so they do
   *  not vanish entirely when the camera is right down on the ground. */
  setZoom(cameraDistance: number, globeRadius: number) {
    // Slightly faster than linear: at terrain height the markers should be
    // dots the labels hang off, not spheres the map hangs off.
    const t = cameraDistance / (globeRadius * 4);
    const k = THREE.MathUtils.clamp(Math.pow(t, 1.5), 0.075, 1.15);
    if (Math.abs(k - this.zoomK) < 0.004) return;
    this.zoomK = k;
    this.writeMatrices();
  }

  get visibleCount() { return this.visibleCountCache; }

  isVisible(index: number) { return this.lastSeen[index]! >= 0; }
}

const GOLD = new THREE.Color('#f2d071');
