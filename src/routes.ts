import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { lonLatToVec3 } from './globe.ts';
import { RoutePath, ROUTE_LIFT, sampleLeg } from './route-path.ts';

export interface RouteMarker {
  n: number; place: string; zh: string;
  lat: number | null; lon: number | null;
  ref: string; leg: string | null; attested: boolean; aside: boolean; note: string;
  noteEn?: string;
  stops: number[]; places?: string[]; zhAll?: string[]; refs?: string[];
}
export interface Journey {
  id: string; zh: string; en: string;
  range: string; rangeEn: string; basis: string; basisEn: string;
  stopCount: number; merged: number; unlocated: number;
  markers: RouteMarker[];
  segments: [number, number][][];
}
const AHEAD = new THREE.Color('#74808e');
const BEHIND = new THREE.Color('#c9a227');
const HEAD = new THREE.Color('#ece2cd');
interface RenderLeg { geo: LineGeometry; mat: LineMaterial; ts: number[]; colors: number[] }

export class Route {
  readonly group = new THREE.Group();
  readonly path: RoutePath;
  private readonly legs: RenderLeg[] = [];
  private readonly markerMeshes: THREE.Object3D[] = [];
  private readonly arrows: THREE.Mesh[] = [];
  private readonly head: THREE.Mesh;
  private readonly aheadArrow = new THREE.MeshBasicMaterial({ color: '#9a7d2e', transparent: true, opacity: .45, depthWrite: false });
  private readonly behindArrow = new THREE.MeshBasicMaterial({ color: '#c9a227', transparent: true, opacity: .8, depthWrite: false });
  private readonly reachedMat = new THREE.MeshBasicMaterial({ color: '#c9a227', depthWrite: false });
  private readonly nowMat = new THREE.MeshBasicMaterial({ color: '#e8c55a', depthWrite: false });
  private readonly pendingMat = new THREE.MeshBasicMaterial({ color: '#74808e', transparent: true, opacity: .6, depthWrite: false });
  private readonly uncertainMat = new THREE.MeshBasicMaterial({ color: '#9a7d2e', transparent: true, opacity: .55, depthWrite: false });
  readonly heading = new THREE.Vector3();
  private progress = -1;
  private focusedMarker: number | null = null;

  constructor(readonly journey: Journey) {
    this.path = new RoutePath(journey);
    const point = new THREE.Vector3();
    const arrowGeo = new THREE.ConeGeometry(.5, 1.4, 3);
    for (const leg of this.path.legs) {
      const steps = Math.max(8, Math.ceil(leg.angle * 300));
      const flat: number[] = [], ts: number[] = [];
      for (let i=0; i<=steps; i++) {
        sampleLeg(leg, i/steps, point);
        flat.push(point.x, point.y, point.z);
        ts.push(leg.from + (leg.to-leg.from)*i/steps);
      }
      const colors = new Array<number>(flat.length).fill(0);
      const geo = new LineGeometry(); geo.setPositions(flat); geo.setColors(colors);
      const mat = new LineMaterial({ linewidth: 3, vertexColors: true,
        transparent: true, dashed: leg.sea, dashSize: .1, gapSize: .07,
        depthTest: true, depthWrite: false });
      const line = new Line2(geo, mat); line.computeLineDistances(); line.renderOrder = 2;
      this.group.add(line); this.legs.push({geo, mat, ts, colors});
      if (leg.angle > .018) {
        const arrow = new THREE.Mesh(arrowGeo, this.aheadArrow);
        sampleLeg(leg, .6, arrow.position);
        const direction = sampleLeg(leg, .61, new THREE.Vector3()).sub(arrow.position).normalize();
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction);
        arrow.userData.t = leg.from + (leg.to-leg.from)*.6;
        arrow.renderOrder = 3; this.arrows.push(arrow); this.group.add(arrow);
      }
    }
    const disc = new THREE.CircleGeometry(1, 24);
    const ring = new THREE.RingGeometry(1, 1.36, 24);
    const rim = new THREE.MeshBasicMaterial({color:'#0b1a2b', depthWrite:false});
    journey.markers.forEach((m, index) => {
      if (m.lat === null || m.lon === null) return;
      const group = new THREE.Group();
      group.position.copy(lonLatToVec3(m.lon, m.lat, ROUTE_LIFT + .005));
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), group.position.clone().normalize());
      group.add(new THREE.Mesh(disc, this.pendingMat), new THREE.Mesh(ring, rim));
      group.children.forEach(c=>{c.renderOrder=3;});
      group.userData = {marker:m, index, sizeFactor:m.stops.length>1 ? 1.2 : 1};
      this.markerMeshes.push(group); this.group.add(group);
    });
    this.head = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({color:'#ece2cd'}));
    this.head.renderOrder = 4; this.group.add(this.head);
    this.setProgress(0);
  }
  get markerObjects() { return this.markerMeshes; }
  get headPosition() { return this.head.position; }
  setProgress(t: number) {
    const progress = THREE.MathUtils.clamp(t, 0, 1);
    this.focusedMarker=null;
    if (progress === this.progress) return;
    this.progress = progress;
    const c = new THREE.Color();
    for (const leg of this.legs) {
      leg.ts.forEach((vt, i) => {
        if (vt > progress) c.copy(AHEAD);
        else c.copy(BEHIND).lerp(HEAD, Math.max(0,1-(progress-vt)/.025));
        leg.colors[i*3]=c.r; leg.colors[i*3+1]=c.g; leg.colors[i*3+2]=c.b;
      });
      // Reuse GPU buffers; no per-leg buffer allocation on every frame.
      const starts = leg.geo.getAttribute('instanceColorStart');
      const ends = leg.geo.getAttribute('instanceColorEnd');
      for (let i=0; i<leg.ts.length-1; i++) {
        starts.setXYZ(i, leg.colors[i*3]!, leg.colors[i*3+1]!, leg.colors[i*3+2]!);
        ends.setXYZ(i, leg.colors[(i+1)*3]!, leg.colors[(i+1)*3+1]!, leg.colors[(i+1)*3+2]!);
      }
      starts.needsUpdate=true; ends.needsUpdate=true;
    }
    const reached = this.path.reached(progress);
    for (const group of this.markerMeshes) {
      const index = group.userData.index as number;
      const m = group.userData.marker as RouteMarker;
      const face = group.children[0] as THREE.Mesh;
      face.material = index === reached ? this.nowMat
        : m.stops.length>1 || m.aside || !m.attested ? this.uncertainMat
        : this.path.markerT[index]! <= progress ? this.reachedMat : this.pendingMat;
    }
    for (const arrow of this.arrows) arrow.material = arrow.userData.t<=progress ? this.behindArrow : this.aheadArrow;
    this.path.sample(progress, this.head.position);
    this.path.sample(Math.min(1, progress+.0001), this.heading).sub(this.head.position).normalize();
    this.head.visible = this.path.legs.length>0 && progress>0 && progress<1;
  }
  markerAt(t: number): RouteMarker | null { return this.journey.markers[this.path.reached(t)] ?? null; }
  reachedIndex(t: number) {
    if(this.focusedMarker!==null){
      // The two sides of an unlocated stage share a distance parameter,
      // but selecting the missing stage must not reveal the next camp.
      let last=-1;
      this.markerMeshes.forEach((m,i)=>{if(m.userData.index<=this.focusedMarker!)last=i;});
      return last;
    }
    return this.markerMeshes.findIndex(m=>m.userData.index===this.path.reached(t));
  }
  highlightedIndex(t: number) {
    return this.focusedMarker===null ? this.reachedIndex(t) : this.markerMeshes.findIndex(m=>m.userData.index===this.focusedMarker);
  }
  focusMarker(index: number) {
    const marker=this.journey.markers[index];
    if(!marker)return;
    this.focusedMarker=index;
    this.head.visible=false;
    if(marker.lon!==null&&marker.lat!==null)this.head.position.copy(lonLatToVec3(marker.lon,marker.lat,ROUTE_LIFT));
    for(const group of this.markerMeshes){
      const face=group.children[0] as THREE.Mesh;
      const at=group.userData.index as number;
      const m=group.userData.marker as RouteMarker;
      face.material=at===index ? this.nowMat
        : m.stops.length>1||m.aside||!m.attested ? this.uncertainMat
        : at<index ? this.reachedMat : this.pendingMat;
    }
  }
  progressAt(index: number) { return this.path.markerT[index]; }
  faceCamera(cameraDistance: number, globeRadius: number, screenHeight=800, vFovDeg=42) {
    const worldPerPx = 2*Math.max(1,cameraDistance-globeRadius)*Math.tan(vFovDeg*Math.PI/360)/Math.max(1,screenHeight);
    for (const m of this.markerMeshes) m.scale.setScalar(worldPerPx*3.2*(m.userData.sizeFactor as number));
    this.head.scale.setScalar(worldPerPx*3.4);
    for (const a of this.arrows) a.scale.setScalar(worldPerPx*4);
    for (const l of this.legs) { l.mat.dashSize=worldPerPx*9; l.mat.gapSize=worldPerPx*6; }
  }
  setResolution(w: number, h: number) { for(const leg of this.legs) leg.mat.resolution.set(w,h); }
  dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>([this.aheadArrow,this.behindArrow,this.reachedMat,this.nowMat,this.pendingMat,this.uncertainMat]);
    this.group.traverse(o=>{const m=o as THREE.Mesh; if(m.geometry)geometries.add(m.geometry);
      if(m.material) (Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat)); });
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
  }
}
