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

// The path is one mesh whose colour is decided per-fragment from how far along
// it sits. That is what makes travelled and untravelled read as one continuous
// journey rather than two objects: the road ahead is already there, waiting,
// and the light moves along it.
const PATH_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const PATH_FRAG = `
  uniform float uProgress;
  uniform float uDash;      // 0 = solid land leg, >0 = dashes per unit for sea
  uniform vec3 uAhead;
  uniform vec3 uBehind;
  uniform vec3 uHead;
  varying vec2 vUv;
  void main() {
    float t = vUv.x;
    // A sea leg is dashed, because the text's sailing verbs describe a crossing
    // and not a road; a land leg is solid.
    if (uDash > 0.0 && fract(t * uDash) > 0.55) discard;
    if (t > uProgress) {
      // Not yet reached: visible but recessive, so the shape of the whole
      // journey is legible before it has been walked.
      gl_FragColor = vec4(uAhead, 0.30);
      return;
    }
    // A short bright run just behind the head reads as motion.
    float heat = smoothstep(0.055, 0.0, uProgress - t);
    gl_FragColor = vec4(mix(uBehind, uHead, heat), 0.72 + heat * 0.28);
  }`;

interface Leg { mesh: THREE.Mesh; from: number; to: number }

export class Route {
  readonly group = new THREE.Group();
  private readonly legs: Leg[] = [];
  private readonly markerMeshes: THREE.Object3D[] = [];
  /** Points along the whole path, for placing the head. */
  private readonly spine: THREE.Vector3[] = [];
  private readonly head: THREE.Mesh;
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

      const geo = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts), Math.max(10, pts.length), 0.17, 8, false);
      const mat = new THREE.ShaderMaterial({
        vertexShader: PATH_VERT, fragmentShader: PATH_FRAG,
        transparent: true, depthWrite: false,
        uniforms: {
          uProgress: { value: 0 },
          uDash: { value: sea ? Math.max(6, len * 260) : 0 },
          uAhead: { value: new THREE.Color('#6c7a8a') },
          uBehind: { value: new THREE.Color('#c9a227') },
          uHead: { value: new THREE.Color('#fff2c4') },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;
      this.legs.push({ mesh, from, to });
      this.group.add(mesh);
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
    for (const { mesh, from, to } of this.legs) {
      const local = (this.progress - from) / Math.max(1e-6, to - from);
      (mesh.material as THREE.ShaderMaterial).uniforms.uProgress!.value =
        Math.max(0, Math.min(1, local));
    }
    const reached = Math.round(this.progress * this.markerMeshes.length);
    this.markerMeshes.forEach((m, i) => { m.visible = i < reached; });

    if (this.spine.length) {
      const i = Math.min(this.spine.length - 1,
                         Math.floor(this.progress * (this.spine.length - 1)));
      this.head.position.copy(this.spine[i]!);
      this.head.visible = this.progress > 0.001 && this.progress < 0.999;
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
  faceCamera(cameraDistance: number, globeRadius: number) {
    const k = Math.max(0.14, (cameraDistance - globeRadius) / 300);
    for (const m of this.markerMeshes) m.scale.setScalar(k * (m.userData.sizeFactor as number));
    this.head.scale.setScalar(k * 1.25);
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material)?.dispose();
    });
  }
}
