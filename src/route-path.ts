import * as THREE from 'three';
import { lonLatToVec3 } from './globe.ts';
import type { Journey } from './routes.ts';

export const ROUTE_LIFT = 0.16;
export interface PathLeg {
  a: THREE.Vector3; b: THREE.Vector3; angle: number;
  from: number; to: number; sea: boolean;
  startMarker: number; endMarker: number;
}

/** One distance parameter for line, head, stops and player. Return visits
 * stay separate; unlocated stops break runs instead of inventing crossings. */
export class RoutePath {
  readonly legs: PathLeg[] = [];
  readonly markerT: number[];
  readonly totalAngle: number;

  constructor(readonly journey: Journey) {
    this.markerT = journey.markers.map(() => NaN);
    let previous = -1, distance = 0;
    const matches = (p: [number, number], lon: number, lat: number) =>
      Math.abs(p[0] - lon) < 1e-5 && Math.abs(p[1] - lat) < 1e-5;
    journey.markers.forEach((m, index) => {
      if (m.aside) return;
      if (m.lon === null || m.lat === null) { previous = -1; return; }
      const p = journey.markers[previous];
      if (p && p.lon !== null && p.lat !== null) {
        const drawable = journey.segments.some(segment => segment.some((point, i) =>
          i > 0 && matches(segment[i - 1]!, p.lon!, p.lat!) && matches(point, m.lon!, m.lat!)));
        if (drawable) {
          const a = lonLatToVec3(p.lon, p.lat, ROUTE_LIFT);
          const b = lonLatToVec3(m.lon, m.lat, ROUTE_LIFT);
          const angle = a.angleTo(b);
          if (angle > 1e-10) {
            this.legs.push({a, b, angle, from: distance, to: distance + angle,
              sea: m.leg === 'sea', startMarker: previous, endMarker: index});
            distance += angle;
          }
        }
      }
      this.markerT[index] = distance;
      previous = index;
    });
    this.totalAngle = distance;
    this.markerT.forEach((d, i) => { if (Number.isFinite(d)) this.markerT[i] = distance ? d / distance : 0; });
    for (const leg of this.legs) { leg.from /= distance; leg.to /= distance; }
  }
  get distanceKm() { return this.totalAngle * 6371.0088; }
  reached(t: number) {
    let reached = -1;
    this.markerT.forEach((at, i) => { if (at <= t + 1e-10) reached = i; });
    return reached;
  }
  sample(t: number, out: THREE.Vector3) {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    const leg = this.legs.find(l => clamped < l.to - 1e-12) ?? this.legs.at(-1);
    if (!leg) {
      const m = this.journey.markers.find(m => !m.aside && m.lon !== null && m.lat !== null);
      if (m) out.copy(lonLatToVec3(m.lon!, m.lat!, ROUTE_LIFT));
      return out;
    }
    return sampleLeg(leg, (clamped-leg.from)/(leg.to-leg.from), out);
  }
}
export function sampleLeg(leg: PathLeg, fraction: number, out: THREE.Vector3) {
  const f = THREE.MathUtils.clamp(fraction, 0, 1), sin = Math.sin(leg.angle);
  if (Math.abs(sin) < 1e-9) return out.copy(leg.a).lerp(leg.b, f).normalize().multiplyScalar(leg.a.length());
  return out.copy(leg.a).multiplyScalar(Math.sin((1-f)*leg.angle)/sin)
    .addScaledVector(leg.b, Math.sin(f*leg.angle)/sin);
}
