import * as THREE from 'three';
import { lonLatToVec3 } from './globe.ts';

// Routes are drawn ON the sphere, not through it: every leg is subdivided along
// the great circle between its ends and lifted clear of the surface, so a line
// from Egypt to Moab bends over the Sinai rather than tunnelling under it.
//
// Two things the renderer must not smooth over, both of them the journey's own
// conditions. A marker standing for several camps is drawn differently from one
// standing for a single identified site, because the gazetteer gives those
// camps one shared coordinate and the map should not imply eight known
// locations where there is one guess. And a run with no coordinate breaks the
// line instead of being bridged.

export interface RouteMarker {
  n: number; place: string; zh: string;
  lat: number | null; lon: number | null;
  ref: string; leg: string | null; attested: boolean; aside: boolean; note: string;
  stops: number[]; places: string[]; zhAll: string[]; refs: string[];
}

export interface Journey {
  id: string; zh: string; en: string; range: string; basis: string;
  stopCount: number; merged: number; unlocated: number;
  markers: RouteMarker[];
  /** Each segment is a run of [lon, lat] the line may legitimately join. */
  segments: [number, number][][];
}

const LIFT = 0.55;
const GOLD = new THREE.Color('#e8c55a');
const DIM = new THREE.Color('#8a6f2a');

/** Great-circle interpolation, so the drawn leg is the path over the ground. */
function arc(a: THREE.Vector3, b: THREE.Vector3, steps: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = a.clone().normalize().lerp(b.clone().normalize(), i / steps).normalize();
    out.push(v.multiplyScalar(a.length()));
  }
  return out;
}

export class Route {
  readonly group = new THREE.Group();
  private readonly tubes: { mesh: THREE.Mesh; count: number }[] = [];
  private readonly markerMeshes: THREE.Object3D[] = [];
  private totalDrawable = 0;

  constructor(readonly journey: Journey) {
    for (const seg of journey.segments) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < seg.length - 1; i++) {
        const a = lonLatToVec3(seg[i]![0], seg[i]![1], LIFT);
        const b = lonLatToVec3(seg[i + 1]![0], seg[i + 1]![1], LIFT);
        // Longer legs get more subdivision so the arc stays on the ground.
        const span = a.angleTo(b);
        const steps = Math.max(6, Math.round(span * 90));
        const piece = arc(a, b, steps);
        pts.push(...(i === 0 ? piece : piece.slice(1)));
      }
      if (pts.length < 2) continue;

      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, Math.max(24, pts.length), 0.26, 8, false);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: GOLD }));
      const count = geo.index!.count;
      geo.setDrawRange(0, 0);
      this.tubes.push({ mesh, count });
      this.totalDrawable += count;
      this.group.add(mesh);
    }

    // Unit-sized; the real size is set every frame from the camera distance,
    // so a marker keeps a constant apparent size instead of swelling into a
    // blob the moment the route is examined closely.
    const single = new THREE.SphereGeometry(1, 12, 10);
    const cluster = new THREE.SphereGeometry(1, 14, 12);

    for (const m of journey.markers) {
      if (m.lat === null || m.lon === null) continue;
      const many = m.stops.length > 1;
      const mesh = new THREE.Mesh(
        many ? cluster : single,
        new THREE.MeshStandardMaterial({
          color: many ? DIM : GOLD,
          // A cluster marker is translucent: it stands for a place we do not
          // know, and it should not look as solid as one we do.
          transparent: many, opacity: many ? 0.55 : 1,
          roughness: 0.35, metalness: 0.5,
          emissive: many ? DIM : GOLD, emissiveIntensity: 0.25,
        }),
      );
      mesh.position.copy(lonLatToVec3(m.lon, m.lat, LIFT));
      mesh.visible = false;
      // A cluster stands for several camps and reads slightly larger, but only
      // slightly — it is a weaker claim, not a more important place.
      mesh.userData.marker = m;
      mesh.userData.sizeFactor = many ? 1.55 : 1;
      this.markerMeshes.push(mesh);
      this.group.add(mesh);
    }
  }

  get markerObjects() { return this.markerMeshes; }

  /** Keeps markers a constant apparent size as the camera moves in and out.
   *  Fixed-radius spheres are unusable up close: at route zoom they overlap
   *  into one mass and bury the line they are supposed to annotate. */
  faceCamera(cameraDistance: number, globeRadius: number) {
    const k = Math.max(0.18, (cameraDistance - globeRadius) / 260);
    for (const m of this.markerMeshes) m.scale.setScalar(k * (m.userData.sizeFactor as number));
  }

  /** Reveals the route up to `t` in 0..1, and the markers the line has reached. */
  setProgress(t: number) {
    const target = Math.max(0, Math.min(1, t)) * this.totalDrawable;
    let used = 0;
    for (const { mesh, count } of this.tubes) {
      const here = Math.max(0, Math.min(count, target - used));
      // Triangles come in threes; a partial one renders as a shard.
      mesh.geometry.setDrawRange(0, Math.floor(here / 3) * 3);
      used += count;
    }
    const reached = Math.round(t * this.markerMeshes.length);
    this.markerMeshes.forEach((m, i) => { m.visible = i < reached; });
  }

  /** The marker the head is currently at, for the readout. */
  markerAt(t: number): RouteMarker | null {
    const i = Math.min(this.markerMeshes.length - 1,
                       Math.max(0, Math.round(t * this.markerMeshes.length) - 1));
    return (this.markerMeshes[i]?.userData.marker as RouteMarker) ?? null;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material)?.dispose();
    });
  }
}
