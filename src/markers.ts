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

/** Screen radius, in pixels, of a marker whose `baseScale` is 1. Everything is
 *  measured from here: the least-named place is about 2px across, Jerusalem
 *  about 8. Matched to what the whole-globe view already looked like. */
const DOT_PX = 2.05;

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
  private routePlaces = new Set<string>();
  private routeActive = false;
  /** Which places survive the screen-space thinning in `PlaceLabels`. Owned
   *  there, read here: a place the map has decided not to draw a name for at
   *  this distance should not leave a nameless dot behind either. */
  private mask: Uint8Array | null = null;
  /** Places named by the verse the cursor is sitting on. */
  activeIndices: number[] = [];

  constructor(readonly places: Place[], readonly events: BibleEvent[]) {
    // Unlit, so the marker reads as a filled dot rather than a lit bead. A
    // shaded sphere with a specular highlight puts a glass ball on top of a
    // painted map: it says "object sitting on the page" when the whole point
    // is a symbol printed into it. In silhouette the same geometry is exactly
    // the map dot it should have been, and it needs no billboarding to face
    // the reader from anywhere on the sphere.
    const geo = new THREE.SphereGeometry(BASE_RADIUS, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ transparent: true });
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
        const heat = this.routeActive ? 0 : age === 0 ? 1 : Math.max(0, 1 - age / AFTERGLOW);
        const brightness = VISITED + (1 - VISITED) * heat;
        this.curScale[i] = this.baseScale[i]! * (1 + heat * 0.85);
        this.scratch.copy(this.baseColor[i]!).multiplyScalar(brightness);
        // The verse's own places get lifted toward gold so the eye lands on
        // what is being read right now, not merely on what is bright.
        if (age === 0 && !this.routeActive) this.scratch.lerp(GOLD, 0.55);
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
      const scale=this.routeActive?Math.min(1.4,this.baseScale[i]!):this.curScale[i]!;
      const thinned = this.mask !== null && this.mask[i] === 0;
      this.dummy.scale.setScalar(
        thinned || this.routePlaces.has(this.places[i]!.name) ? 0 : scale * this.zoomK);
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
  setZoom(cameraDistance: number, globeRadius: number, dt = 1/60, screenHeight=800, fov=42) {
    const material=this.mesh.material as THREE.MeshBasicMaterial;
    const target=this.routeActive ? THREE.MathUtils.lerp(.25,1,THREE.MathUtils.clamp((cameraDistance/globeRadius-1.8)/.5,0,1)) : 1;
    material.opacity+=(target-material.opacity)*(1-Math.exp(-dt*8));
    // One world unit per screen pixel at the surface, so a marker's size on
    // screen is exactly its `baseScale` and does not move with the camera.
    //
    // The old curve was `distance^1.5`, tuned by eye at the whole-globe view. It
    // undershoots badly on approach: by the time the camera is at 1.1 radii the
    // same marker covers four times the screen it did far out, and Jerusalem —
    // the largest, because the text names it 955 times — becomes a 70px balloon
    // sitting on the country it is supposed to mark. DOT_PX is chosen so the
    // whole-globe view is unchanged; everything nearer than that is the fix.
    const perPixel = 2*Math.max(1,cameraDistance-globeRadius)*Math.tan(fov*Math.PI/360)/screenHeight;
    const k = perPixel*(this.routeActive ? 1 : DOT_PX)/BASE_RADIUS;
    if (Math.abs(k - this.zoomK) < 0.0001) return;
    this.zoomK = k;
    this.writeMatrices();
  }

  /** World-space radius of a marker as currently drawn, so a label can be set
   *  down beside its dot instead of underneath it. The active place swells to
   *  nearly twice its base size, which at terrain height is wider than the name
   *  it belongs to. */
  worldRadius(i: number) {
    const scale = this.routeActive ? Math.min(1.4, this.baseScale[i]!) : this.curScale[i]!;
    return scale * this.zoomK * BASE_RADIUS;
  }

  get visibleCount() { return this.visibleCountCache; }

  /** Adopt the thinning mask, and redraw only when it has actually moved.
   *  `visibleCount` is deliberately left alone: the counter under the timeline
   *  reports how much of the canon has been read, not how much of it the
   *  current camera distance has room to print. */
  setMask(mask: Uint8Array) { this.mask = mask; this.writeMatrices(); }

  setRoute(names: string[] | null) {
    this.routeActive=names!==null;
    this.routePlaces=new Set(names??[]);
    this.setCursor(this.events.length-1);
  }

  isVisible(index: number) { return this.lastSeen[index]! >= 0; }
}

const GOLD = new THREE.Color('#f2d071');
