import * as T from 'three';
import {sampleLeg, type PathLeg} from './route-path.ts';
import {lonLatToVec3} from './globe.ts';
import type {Route} from './routes.ts';
import type {GeoJson} from './types.ts';
import {ActorBatch} from './journey-actors/geometry.ts';
import {ActorModels} from './journey-actors/models.ts';
import type {CampPhase} from './journey-actors/camp-playback.ts';
import {W as MASK_W, H as MASK_H} from './basemap.ts';

/** Modern land is a visual exclusion mask, NOT ancient navigability.
 *
 * Rasterized at the basemap's own resolution (imported, not duplicated) —
 * this used to run at a fixed 1440x720 (4px/degree, ~28km/pixel) while the
 * coastline actually drawn on screen is painted at 4096x2048 (~10km/pixel).
 * That gap is exactly wide enough to smooth away a real headland or inlet:
 * reported directly against the Levantine coast near Caesarea, where the
 * ship rendered visibly inland of the coastline the player can see, because
 * the coarse mask called that stretch "water" several kilometres before the
 * fine-grained coastline actually does. Matching resolutions doesn't fix
 * every case — a mask can only be as good as the polygon data underneath it
 * — but it stops the mask from being wrong in a way the basemap already
 * proves it doesn't have to be. */
function landMask(land:GeoJson){
  const canvas=document.createElement('canvas');canvas.width=MASK_W;canvas.height=MASK_H;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  for(const f of land.features){
    const g=f.geometry;if(!g)continue;
    const polys=g.type==='Polygon'?[g.coordinates as number[][][]]:g.type==='MultiPolygon'?g.coordinates as number[][][][]:[];
    for(const poly of polys){ctx.beginPath();for(const ring of poly){ring.forEach(([lon,lat],i)=>{const x=(lon!+180)/360*MASK_W,y=(90-lat!)/180*MASK_H;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.fill('evenodd');}
  }
  const pixels=ctx.getImageData(0,0,MASK_W,MASK_H).data;
  return (p:T.Vector3)=>{
    const lon=Math.atan2(-p.z,p.x)*180/Math.PI,lat=Math.asin(p.y/p.length())*180/Math.PI;
    const x=T.MathUtils.clamp(Math.floor((lon+180)/360*MASK_W),0,MASK_W-1),y=T.MathUtils.clamp(Math.floor((90-lat)/180*MASK_H),0,MASK_H-1);
    return pixels[(y*MASK_W+x)*4+3]!>128;
  };
}
/** A person's display scale, wherever a scene places one. One constant,
 * not a number repeated at every call site: a passenger on the ship's deck
 * is the same walker model as one on the road, and should read as the same
 * size — reported directly against the map, where the ship crew stood out
 * as visibly smaller than the very same figures a moment earlier on land. */
const PERSON_SCALE = .72;
/** How wide a band of "land" along a sea leg still counts as sea. The route
 * line is a great-circle chord between two ports, not a pilot's course, so
 * it clips islets and headlands the real voyage sailed around — measured
 * across Paul's four journeys, those clipped spans run 1-31km, while a leg
 * that genuinely crosses a landmass (the 914km run on the second journey)
 * stays on land for 302km without a break. Anything narrower than this is
 * the chord cutting a corner, and blanking the ship for it just made the
 * hull blink out mid-voyage; anything wider is real ground, and a ship
 * drawn over it is the beached hull reported earlier. */
const SEA_GAP_KM = 50;
export class Staffage {
  readonly group=new T.Group();
  private material=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false});
  private batch=new ActorBatch(this.material,4);
  // Loaded characters and ship, standing in for the procedural miniature
  // wherever the text gives no measurement to draw from instead (D19).
  // Loading happens once, in the background, starting at construction; every
  // call site below falls back to the procedural piece until — and unless —
  // it finishes. See journey-actors/models.ts for why each is safe to fail.
  private models=new ActorModels();
  private walkerSlots:{group:T.Object3D;mixer:T.AnimationMixer}[]=[];
  // A journey's last stop poses its figures seated rather than walking (see
  // placeSeatedFigures) — a separate pool from walkerSlots because those are
  // already mid-walk-cycle clones; reusing one would mean un-posing a walker
  // back to neutral rather than ever actually needing to.
  private seatedSlots:{group:T.Object3D;mixer:T.AnimationMixer}[]=[];
  private shipSlot:T.Object3D|null=null;
  private opacity=0;private time=0;private key='';private water=false;private maskAge=1;
  private p=new T.Vector3();private normal=new T.Vector3();private tangent=new T.Vector3();private side=new T.Vector3();private basis=new T.Matrix4();
  private camLocal=new T.Vector3();private tiltAxis=new T.Vector3();private invQuat=new T.Quaternion();
  private probe=new T.Vector3();
  private onLand:(p:T.Vector3)=>boolean;
  /** Sea legs whose path is confidently open water, not a coastal hop that
   * happens to be tagged `sea` in the source text. A `sea` leg is a claim
   * about how the text says the travellers went, not about the geometry of
   * the great-circle chord `RoutePath` draws between its two endpoints —
   * and for a short hop between two ports on the same coast (Caesarea up
   * the Levantine shore, say), that chord can run so close to the coastline
   * for its whole length that the ship reads as beached, not sailing,
   * however the harbour-margin or mask fidelity is tuned. Sample a leg's
   * interior against the mask once and only trust it for 'sailing' if most
   * of those samples land in open water — measured directly against this
   * app's own journeys, a leg is either comfortably past that bar
   * (paul-rome's Crete-to-Malta run, sampled fully open) or well under it
   * (this same journey's first hop out of Caesarea, barely a third) —
   * nothing sits close enough to the line to make the threshold fragile.
   * Memoized per `PathLeg` object, lazily, rather than keyed to the route's
   * own id and computed on change: `Staffage` already tracked a route
   * change by comparing `route.journey.id`, a string that stays the same
   * across two separate opens of the same journey even though `RoutePath`
   * builds fresh `PathLeg` objects each time — reusing that string as this
   * cache's invalidation signal would silently serve stale verdicts (or
   * `false` for a leg it had never actually checked) against the new
   * objects. A plain per-object cache sidesteps the question entirely. */
  private navigableLegs=new WeakMap<PathLeg,boolean>();
  private isNavigable(leg:PathLeg){
    let known=this.navigableLegs.get(leg);
    if(known===undefined){
      const tmp=new T.Vector3();let open=0,samples=0;
      for(let f=.15;f<=.85+1e-9;f+=.1){sampleLeg(leg,f,tmp);samples++;if(!this.onLand(tmp))open++;}
      known=open/samples>=.5;
      this.navigableLegs.set(leg,known);
    }
    return known;
  }
  /** Whether the ship belongs at `progress` along `leg`. A single mask
   * lookup is not enough on its own: the chord clips islets and headlands,
   * and treating each one as shore blinked the hull out and left nothing but
   * the route's own progress dot moving. So when the point reads as land,
   * probe half a SEA_GAP_KM to either side along the same leg — if open
   * water lies on both sides, this is a sliver the chord cut across and the
   * ship sails on; if either probe is also land, it is a real crossing, and
   * the caller shows the party on foot rather than a hull aground. */
  private isOpenWater(leg:PathLeg,progress:number){
    if(!this.onLand(this.p))return true;
    const legKm=leg.angle*6371.0088;
    if(legKm<=0)return false;
    const span=leg.to-leg.from;
    if(span<=0)return false;
    const half=(SEA_GAP_KM/2)/legKm;
    const f=(progress-leg.from)/span;
    for(const d of [-half,half]){
      sampleLeg(leg,T.MathUtils.clamp(f+d,0,1),this.probe);
      if(this.onLand(this.probe))return false;
    }
    return true;
  }
  readonly state={mode:'hidden',people:0,tents:0,ship:0,anchor:[0,0,0],phase:'rest'};
  hit(ray:T.Raycaster){
    if(!this.group.visible||this.opacity<.2)return false;
    const objects=[...this.batch.meshes.values()].filter(m=>m.visible&&m.count>0);
    objects.forEach(m=>m.computeBoundingSphere());
    return ray.intersectObjects(objects,false).some(hit=>hit.distance<ray.ray.origin.length());
  }
  screenBox(camera:T.PerspectiveCamera){
    if(!this.group.visible||this.state.mode==='hidden')return null;
    this.group.updateWorldMatrix(true,true);
    const points:T.Vector3[]=[];
    for(const x of [-4,4])for(const y of [0,3.3])for(const z of [-2,4])points.push(new T.Vector3(x,y,z).applyMatrix4(this.batch.group.matrixWorld).project(camera));
    const xs=points.map(p=>(p.x+1)*innerWidth/2),ys=points.map(p=>(1-p.y)*innerHeight/2);
    return new DOMRect(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  }
  constructor(land:GeoJson){
    this.onLand=landMask(land);this.group.add(this.batch.group);
    // Cartographic miniatures have an oblique display tilt, not geographic
    // size — lifted so the tilt doesn't push their feet under the sphere.
    // The tilt's own AXIS is computed per frame in update(), not fixed here:
    // see TILT_AXIS there for why.
    this.batch.group.position.y=1.3;
  }
  /** Grows the pool of loaded walker actors up to `n`, lazily and once — the
   * largest a scene ever asks for is 3 (Paul's land legs, the ship's deck),
   * so the pool never needs to grow again after its first two calls. Does
   * nothing once `ActorModels` has nothing left to hand out, which is also
   * the correct behaviour before the model has finished loading. */
  private ensureWalkerSlots(n:number){
    while(this.walkerSlots.length<n){
      const spawned=this.models.spawnWalker(this.walkerSlots.length);
      if(!spawned)return;
      this.batch.group.add(spawned.group);
      this.walkerSlots.push(spawned);
    }
  }
  private ensureSeatedSlots(n:number){
    while(this.seatedSlots.length<n){
      const spawned=this.models.spawnWalker(this.seatedSlots.length,true);
      if(!spawned)return;
      this.batch.group.add(spawned.group);
      this.seatedSlots.push(spawned);
    }
  }
  private ensureShipSlot(){
    if(this.shipSlot)return;
    const ship=this.models.spawnShip();
    if(!ship)return;
    this.batch.group.add(ship);
    this.shipSlot=ship;
  }
  /** Places `count` figures at `posFn(i)`: a loaded character wherever the
   * model has finished loading, the procedural miniature otherwise — the
   * substitution the ship's hull already made, extended to the people next
   * to it. `walking` drives the walk-cycle mixer; false leaves a spawned
   * figure at rest, for a passenger standing on a moving deck. */
  private placeFigures(count:number,posFn:(i:number)=>[number,number,number],scale:number,walking:boolean,dt:number){
    if(this.models.walkersReady)this.ensureWalkerSlots(count);
    const useModels=this.models.walkersReady&&this.walkerSlots.length>=count;
    for(let i=0;i<count;i++){
      const [x,y,z]=posFn(i);
      if(useModels){
        const slot=this.walkerSlots[i]!;
        slot.group.visible=true;slot.group.position.set(x,y,z);slot.group.scale.setScalar(scale);
        if(walking)slot.mixer.update(dt);
      }else{
        this.batch.person(x,z,this.time,i,scale,y,walking);
      }
    }
  }
  /** Same placement as placeFigures, posed seated (see poseSitting) instead
   * of walking — for a journey's last stop. The procedural fallback has no
   * seated pose to offer, so it stands at rest instead: arrived is still
   * closer to the truth than mid-stride, even without the loaded model. */
  private placeSeatedFigures(count:number,posFn:(i:number)=>[number,number,number],scale:number){
    if(this.models.walkersReady)this.ensureSeatedSlots(count);
    const useModels=this.models.walkersReady&&this.seatedSlots.length>=count;
    for(let i=0;i<count;i++){
      const [x,y,z]=posFn(i);
      if(useModels){
        const slot=this.seatedSlots[i]!;
        slot.group.visible=true;slot.group.position.set(x,y,z);slot.group.scale.setScalar(scale);
      }else{
        this.batch.person(x,z,this.time,i,scale,y,false);
      }
    }
  }
  update(route:Route|null,camera:T.PerspectiveCamera,dt:number,progress=0,playing=false,ordinal:number|null=null,campPhase:CampPhase='rest',tentScale=1){
    const key=route?.journey.id??'';
    if(key!==this.key){this.key=key;this.time=0;this.opacity=0;this.maskAge=1;}
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(playing&&!reducedMotion)this.time+=dt;
    const dist=camera.position.length();
    const marker=route&&(ordinal===null?route.markerAt(progress):route.journey.markers.find(m=>m.stops.includes(ordinal)));
    // `aside` and a missing coordinate are structural — there is nowhere to
    // stand the miniature. `attested` is not: an unattested marker is an
    // inferred waypoint that still has a coordinate and still sits on a drawn
    // leg, and the uncertainty is already carried twice over (the marker
    // draws in `uncertainMat`, and the card says "inferred waypoint, not an
    // explicitly recorded stop"). Gating the figures on it too suppressed
    // them for whole legs at a time — 37% of Paul's second journey, where
    // `markerAt` holds an unattested Iconium or Jerusalem for the entire
    // stretch that follows it — which reads as the people vanishing, not as
    // a claim being withheld.
    const valid=!!marker&&marker.lat!==null&&marker.lon!==null&&!marker.aside;
    const target=route&&valid?T.MathUtils.clamp((2.2-dist/100)/.3,0,1):0;
    this.opacity+=(target-this.opacity)*(1-Math.exp(-dt*10));this.material.opacity=this.opacity;
    this.batch.begin();this.state.mode='hidden';this.state.people=0;this.state.tents=0;this.state.ship=0;this.state.phase=campPhase;
    for(const slot of this.walkerSlots)slot.group.visible=false;
    for(const slot of this.seatedSlots)slot.group.visible=false;
    if(this.shipSlot)this.shipSlot.visible=false;
    this.group.visible=valid&&this.opacity>.01;
    if(!this.group.visible||!route||!marker){this.batch.finish();return;}
    const leg=route.path.legs.find(l=>progress<l.to-1e-10)??route.path.legs.at(-1);
    if(ordinal!==null)this.p.copy(lonLatToVec3(marker.lon!,marker.lat!,.18));else this.p.copy(route.headPosition);
    this.normal.copy(this.p).normalize();
    if(leg){sampleLeg(leg,.501,this.tangent).sub(sampleLeg(leg,.5,this.side));this.tangent.addScaledVector(this.normal,-this.tangent.dot(this.normal)).normalize();}
    else this.tangent.crossVectors(new T.Vector3(0,1,0),this.normal).normalize();
    if(this.tangent.lengthSq()<.5)this.tangent.set(1,0,0).cross(this.normal).normalize();
    this.side.crossVectors(this.tangent,this.normal).normalize();this.tangent.crossVectors(this.normal,this.side).normalize();
    this.basis.makeBasis(this.tangent,this.normal,this.side);
    this.group.quaternion.setFromRotationMatrix(this.basis);this.group.position.copy(this.p);
    // The oblique display tilt (see the constructor) has to lean the
    // miniature toward whichever way the camera actually is, not toward a
    // fixed local axis: a fixed axis is defined relative to `tangent`
    // (direction of travel), and travel heads a different way at every
    // marker — reported directly against Syracuse, on a leg heading roughly
    // north, where the fixed tilt laid the figure on its side instead of
    // leaning it forward. Rotate the camera direction into this group's own
    // local frame, drop the vertical (normal) component to get "which way
    // is the camera, along the ground", and tilt around the axis
    // perpendicular to that — so the model's top always leans toward camera,
    // whichever way it's currently facing.
    this.invQuat.copy(this.group.quaternion).invert();
    this.camLocal.copy(camera.position).sub(this.p).applyQuaternion(this.invQuat).normalize();
    const groundLenSq=this.camLocal.x*this.camLocal.x+this.camLocal.z*this.camLocal.z;
    if(groundLenSq>1e-6){
      const s=1/Math.sqrt(groundLenSq);
      this.tiltAxis.set(this.camLocal.z*s,0,-this.camLocal.x*s);
      this.batch.group.quaternion.setFromAxisAngle(this.tiltAxis,.85);
    }else{
      this.batch.group.quaternion.identity(); // camera directly overhead: no ground direction to lean toward
    }
    const scale=Math.max(.025,(dist-100)*2*Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.max(1,innerHeight)*16);
    this.group.scale.setScalar(scale);this.state.anchor=this.p.toArray();
    const exodus=route.journey.id==='exodus-wilderness';
    // The land mask is a coarse 0.25°/pixel raster with no margin: a point one
    // pixel offshore already reads as water, which is not far enough for a
    // hull twice the old procedural size (SHIP_LEGIBILITY, journey-actors/
    // models.ts) to clear a harbour visually — reported directly against
    // Caesarea on the live map. A uniform buffer on the mask itself was tried
    // and reverted: dilating land by even one pixel bridges real, narrow-but-
    // navigable sea gaps the app's own routes sail through (mid-Aegean, the
    // Malta channel). So the fix is temporal, not spatial — soften the
    // first/last stretch of a sea leg's own progress span, sized in real
    // kilometres (`leg.angle` is the raw great-circle radians for just this
    // leg, unnormalized by RoutePath's own progress scaling — see
    // route-path.ts) rather than a flat percentage, so a 900km crossing and a
    // 60km hop both get roughly the same physical clearance near harbour
    // instead of wildly different ones. Capped at 35% per side so a very
    // short sea leg still keeps a real sailing window in its middle.
    const HARBOR_BUFFER_KM=20;
    const legKm=leg?leg.angle*6371.0088:0;
    const marginFrac=leg&&legKm>0?Math.min(.35,HARBOR_BUFFER_KM/legKm):0;
    const seaMargin=leg?(leg.to-leg.from)*marginFrac:0;
    // A leg tagged `sea` in the source text but not `navigableLegs` (see its
    // own comment) is a coastal hop the mask can't confidently place at open
    // water anywhere along its length — treated as a land leg throughout,
    // same as a leg that was never `sea` to begin with.
    const isSeaLeg=!!leg&&leg.sea&&this.isNavigable(leg);
    const inSeaMargin=!!(isSeaLeg&&ordinal===null&&(progress<=leg!.from+seaMargin||progress>=leg!.to-seaMargin));
    let sailing=false;
    if(isSeaLeg&&ordinal===null&&!inSeaMargin&&progress>leg!.from&&progress<leg!.to){
      this.maskAge+=dt;if(this.maskAge>.1){this.water=this.isOpenWater(leg!,progress);this.maskAge=0;}
      sailing=this.water;
    }
    if(sailing){
      const hullDrawn=this.models.shipReady;
      if(hullDrawn){this.ensureShipSlot();if(this.shipSlot){this.shipSlot.visible=true;this.shipSlot.rotation.z=Math.sin(this.time*.8)*.035;}}
      this.batch.ship(this.time,hullDrawn,this.models.walkersReady,this.models.shipDeckY);
      if(this.models.walkersReady)this.placeFigures(3,(i)=>[-.75+i*.7,this.models.shipDeckY,.27],PERSON_SCALE,false,dt);
      this.state.mode='sailing';this.state.ship=1;this.state.people=3;
    }else{
      const count=exodus?12:route.journey.id==='elijah'?1:3;
      const camping=exodus&&campPhase!=='travel'&&(ordinal!==null||!playing);
      // The journey's own last stop, not just any reason this branch fired
      // (a land leg mid-route, the sea-margin either side of a harbour):
      // arrived, not still travelling, so the figures sit rather than walk.
      // Exodus keeps its own camp/muster distinction instead.
      const isFinalStop=!exodus&&(ordinal!==null?marker.stops.includes(route.journey.stopCount):progress>=1);
      if(exodus){
        for(let i=0;i<count;i++){
          const x=camping?(i%4-1.5)*.75:-(i%6)*.65;
          const z=camping?1.6+Math.floor(i/4)*.58:(Math.floor(i/6)-.5)*.85;
          this.batch.person(x,z,this.time,i,PERSON_SCALE,0,playing&&!camping);
        }
      }else if(isFinalStop){
        this.placeSeatedFigures(count,(i)=>[-(i%6)*.65,0,(Math.floor(i/6)-.5)*.85],PERSON_SCALE);
      }else{
        // Paul-style land travel: a loaded character wherever it has finished
        // loading, the procedural miniature otherwise (D19). The exodus's
        // 12-person camp muster above stays procedural on purpose — a dozen
        // identical rigged clones would read as a crowd of twins, not a
        // nation, and the InstancedMesh batch is what keeps that scene cheap.
        this.placeFigures(count,(i)=>[-(i%6)*.65,0,(Math.floor(i/6)-.5)*.85],PERSON_SCALE,playing&&!reducedMotion,dt);
      }
      if(camping){for(let i=0;i<3;i++)this.batch.put('tent',(i-1)*2.05,0,-1,.65,0,0,Math.max(.03,tentScale));this.state.tents=3;}
      this.state.mode=camping?'camp':isFinalStop?'arrived':'walking';this.state.people=count;
      if(route.journey.id==='elijah'&&marker.stops.includes(4)&&ordinal===4){
        for(let i=0;i<12;i++){const a=i%4*Math.PI/2;this.batch.put('stone',1.5+Math.cos(a)*.48,.2+Math.floor(i/4)*.33,Math.sin(a)*.48,1.1,i);}
        this.batch.put('wood',1.5,1.2,0,.8);this.batch.put('offering',1.5,1.4,0,.8);
        this.state.mode='altar';
      }
    }
    this.batch.finish();
  }
}
