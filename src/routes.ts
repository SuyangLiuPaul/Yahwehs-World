import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
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
  segments: [number, number][][];
}

const LIFT = 0.55;

/** Great-circle interpolation, so the drawn leg is the path over the ground. */
function arc(a: THREE.Vector3, b: THREE.Vector3, steps: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = a.clone().normalize().lerp(b.clone().normalize(), i / steps).normalize();
    out.push(v.multiplyScalar(a.length()));
  }
  return out;
}

// The path is a screen-space line, not a tube. A TubeGeometry has a world
// radius, so it reads as a pipe laid over the ground and swells or vanishes
// with the zoom; a Line2 holds a constant width in pixels, which is what a
// drawn route is. Its colour comes from per-vertex colours updated as the
// journey advances, so travelled and untravelled are one continuous line
// rather than two objects, and the road ahead is present but recessive.

const C_AHEAD = new THREE.Color('#66788a');
const C_BEHIND = new THREE.Color('#c9a227');
const C_HEAD = new THREE.Color('#fff2c4');

interface Leg {
  line: Line2; geo: LineGeometry; mat: LineMaterial;
  /** Fraction of the whole journey this leg spans. */
  from: number; to: number;
  /** One t per vertex, for colouring against progress. */
  ts: number[];
  colors: Float32Array;
}

export class Route {
  readonly group = new THREE.Group();
  private readonly legs: Leg[] = [];
  private readonly markerMeshes: THREE.Object3D[] = [];
  /** Chevrons along the path. A route that only shows its direction while it
   *  animates has no direction at rest, and at rest is how it is mostly seen. */
  private readonly arrows: THREE.Mesh[] = [];
  /** Points along the whole path, for placing the head. */
  private readonly spine: THREE.Vector3[] = [];
  private readonly head: THREE.Mesh;
  /** Unit vector along travel at the head. */
  readonly heading = new THREE.Vector3(1, 0, 0);
  private progress = 0;

  constructor(readonly journey: Journey) {
    const legIndex = new Map<string, string>();
    for (const m of journey.markers) {
      if (m.lat === null || m.lon === null) continue;
      legIndex.set(`${m.lon.toFixed(4)},${m.lat.toFixed(4)}`, m.leg ?? 'land');
    }

    // Length-weighted so the head moves at a steady speed over the ground
    // rather than lingering on short legs and racing over long ones.
    let total = 0;
    const raw: { pts: THREE.Vector3[]; sea: boolean; len: number }[] = [];
    for (const seg of journey.segments) {
      for (let i = 0; i < seg.length - 1; i++) {
        const a = lonLatToVec3(seg[i]![0], seg[i]![1], LIFT);
        const b = lonLatToVec3(seg[i + 1]![0], seg[i + 1]![1], LIFT);
        const span = a.angleTo(b);
        const pts = arc(a, b, Math.max(8, Math.round(span * 120)));
        const sea = legIndex.get(`${seg[i + 1]![0].toFixed(4)},${seg[i + 1]![1].toFixed(4)}`) === 'sea';
        raw.push({ pts, sea, len: span });
        total += span;
        this.spine.push(...(i === 0 ? pts : pts.slice(1)));
      }
    }

    let walked = 0;
    for (const { pts, sea, len } of raw) {
      const from = walked / total;
      walked += len;
      const to = walked / total;

      const flat: number[] = [];
      const ts: number[] = [];
      pts.forEach((v, i) => {
        flat.push(v.x, v.y, v.z);
        ts.push(from + (to - from) * (i / Math.max(1, pts.length - 1)));
      });
      const colors = new Float32Array(pts.length * 3);

      const geo = new LineGeometry();
      geo.setPositions(flat);
      geo.setColors(Array.from(colors));

      const mat = new LineMaterial({
        linewidth: 3.2,          // pixels, held constant across zoom
        vertexColors: true,
        transparent: true,
        // A sailing verb in the text gives a dashed leg; a verb of going gives
        // a solid one. The distinction is the journey's, not decoration.
        //
        // The dash lengths are set per frame from the camera distance, not
        // fixed here. LineMaterial measures them in world units, and 2.2 units
        // is 140 km — which zoomed out is a dash and zoomed in is a gap longer
        // than the leg, so a sea crossing simply vanished.
        dashed: sea,
        dashSize: 2.2, gapSize: 2.0,
        depthTest: true, depthWrite: false,
      });
      mat.resolution.set(1, 1);
      if (sea) mat.defines.USE_DASH = '';

      const line = new Line2(geo, mat);
      line.computeLineDistances();
      line.renderOrder = 2;
      this.legs.push({ line, geo, mat, from, to, ts, colors });
      this.group.add(line);
    }

    const single = new THREE.SphereGeometry(1, 14, 12);
    for (const m of journey.markers) {
      if (m.lat === null || m.lon === null) continue;
      const many = m.stops.length > 1;
      const mesh = new THREE.Mesh(single, new THREE.MeshStandardMaterial({
        color: many ? 0x9a7d2e : 0xe8c55a,
        // A cluster marker is translucent: it stands for a place we do not
        // know, and it should not look as solid as one we do.
        transparent: true, opacity: many ? 0.5 : 0.95,
        roughness: 0.3, metalness: 0.55,
        emissive: many ? 0x6b5620 : 0xc9a227, emissiveIntensity: 0.35,
      }));
      mesh.position.copy(lonLatToVec3(m.lon, m.lat, LIFT));
      mesh.renderOrder = 3;
      mesh.userData.marker = m;
      mesh.userData.sizeFactor = many ? 1.5 : 1;
      this.markerMeshes.push(mesh);
      this.group.add(mesh);
    }

    // Chevrons every so often along the spine, pointed the way of travel.
    const chevGeo = new THREE.ConeGeometry(0.5, 1.25, 4);
    const chevMat = new THREE.MeshBasicMaterial({
      color: 0xc9a227, transparent: true, opacity: 0.55, depthWrite: false,
    });
    const EVERY = 26;
    for (let i = EVERY; i < this.spine.length - 2; i += EVERY) {
      const here = this.spine[i]!;
      const next = this.spine[i + 1]!;
      const chev = new THREE.Mesh(chevGeo, chevMat);
      chev.position.copy(here);
      // Point along travel, lying on the surface rather than standing up from it.
      chev.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), next.clone().sub(here).normalize());
      chev.renderOrder = 3;
      chev.userData.t = i / (this.spine.length - 1);
      this.arrows.push(chev);
      this.group.add(chev);
    }

    // The travelling head — where the company is right now.
    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: 0.95 }),
    );
    this.head.renderOrder = 4;
    this.group.add(this.head);

    this.setProgress(0);
  }

  get markerObjects() { return this.markerMeshes; }
  get headPosition() { return this.head.position; }

  setProgress(t: number) {
    this.progress = Math.max(0, Math.min(1, t));
    const c = new THREE.Color();
    for (const leg of this.legs) {
      leg.ts.forEach((vt, i) => {
        if (vt > this.progress) c.copy(C_AHEAD);
        else {
          // A short bright run just behind the head reads as motion.
          const heat = Math.max(0, 1 - (this.progress - vt) / 0.05);
          c.copy(C_BEHIND).lerp(C_HEAD, heat);
        }
        leg.colors[i * 3] = c.r;
        leg.colors[i * 3 + 1] = c.g;
        leg.colors[i * 3 + 2] = c.b;
      });
      leg.geo.setColors(Array.from(leg.colors));
    }
    const reached = Math.round(this.progress * this.markerMeshes.length);
    this.markerMeshes.forEach((m, i) => { m.visible = i < reached; });
    // Chevrons ahead of the head stay, dimmer: the direction of the road not
    // yet walked is exactly what a reader wants to know at rest.
    for (const a of this.arrows) {
      const t = a.userData.t as number;
      (a.material as THREE.MeshBasicMaterial).opacity = t <= this.progress ? 0.7 : 0.24;
    }

    if (this.spine.length > 1) {
      // Interpolate between spine points instead of snapping to one. A route
      // has a few hundred vertices and takes eighteen seconds, so snapping
      // advances the head about ten times a second — which is exactly the
      // stepping that makes a flight read as a slide.
      const f = this.progress * (this.spine.length - 1);
      const i = Math.min(this.spine.length - 2, Math.floor(f));
      this.head.position.lerpVectors(this.spine[i]!, this.spine[i + 1]!, f - i);
      this.head.visible = this.progress > 0.001 && this.progress < 0.999;
    }

    // Direction of travel at the head, for orienting the camera along the route
    // rather than at whatever bearing it happened to start on.
    if (this.spine.length > 1) {
      const f = this.progress * (this.spine.length - 1);
      const i = Math.min(this.spine.length - 2, Math.floor(f));
      this.heading.copy(this.spine[i + 1]!).sub(this.spine[i]!).normalize();
    }
  }

  /** The marker the head has most recently reached. */
  markerAt(t: number): RouteMarker | null {
    const i = Math.min(this.markerMeshes.length - 1,
                       Math.max(0, Math.round(t * this.markerMeshes.length) - 1));
    return (this.markerMeshes[i]?.userData.marker as RouteMarker) ?? null;
  }

  /** Index of the marker the head has reached, for label emphasis. */
  reachedIndex(t: number) {
    return Math.max(0, Math.round(t * this.markerMeshes.length) - 1);
  }

  /** Keeps markers a constant apparent size as the camera moves in and out.
   *  Fixed-radius spheres are unusable up close: at route zoom they overlap
   *  into one mass and bury the line they are supposed to annotate. */
  faceCamera(cameraDistance: number, globeRadius: number, screenHeight = 800, vFovDeg = 42) {
    const k = Math.max(0.14, (cameraDistance - globeRadius) / 300);
    for (const m of this.markerMeshes) m.scale.setScalar(k * (m.userData.sizeFactor as number));
    this.head.scale.setScalar(k * 1.25);
    for (const a of this.arrows) a.scale.setScalar(k * 0.9);

    // Hold the dash pattern at a constant size on screen. World-unit dashes
    // scale with the zoom, so a pattern tuned for the whole Mediterranean
    // leaves one gap covering an entire crossing once the reader moves in.
    const alt = Math.max(1, cameraDistance - globeRadius);
    const worldPerPx = (2 * alt * Math.tan((vFovDeg * Math.PI) / 360)) / Math.max(1, screenHeight);
    for (const leg of this.legs) {
      if (!leg.mat.dashed) continue;
      leg.mat.dashSize = worldPerPx * 9;
      leg.mat.gapSize = worldPerPx * 6;
      leg.mat.needsUpdate = true;
    }
  }

  /** Line width is in pixels, so the material has to know the drawing size. */
  setResolution(w: number, h: number) {
    for (const leg of this.legs) leg.mat.resolution.set(w, h);
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material)?.dispose();
    });
  }
}
