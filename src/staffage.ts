import * as T from 'three';
import {sampleLeg} from './route-path.ts';
import {lonLatToVec3} from './globe.ts';
import type {Route} from './routes.ts';
import type {GeoJson} from './types.ts';
import {ActorBatch} from './journey-actors/geometry.ts';
import {ActorModels} from './journey-actors/models.ts';
import type {CampPhase} from './journey-actors/camp-playback.ts';

/** Modern land is a visual exclusion mask, NOT ancient navigability. */
function landMask(land:GeoJson){
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=720;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  for(const f of land.features){
    const g=f.geometry;if(!g)continue;
    const polys=g.type==='Polygon'?[g.coordinates as number[][][]]:g.type==='MultiPolygon'?g.coordinates as number[][][][]:[];
    for(const poly of polys){ctx.beginPath();for(const ring of poly){ring.forEach(([lon,lat],i)=>{const x=(lon!+180)*4,y=(90-lat!)*4;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.fill('evenodd');}
  }
  const pixels=ctx.getImageData(0,0,1440,720).data;
  return (p:T.Vector3)=>{
    const lon=Math.atan2(-p.z,p.x)*180/Math.PI,lat=Math.asin(p.y/p.length())*180/Math.PI;
    const x=T.MathUtils.clamp(Math.floor((lon+180)*4),0,1439),y=T.MathUtils.clamp(Math.floor((90-lat)*4),0,719);
    return pixels[(y*1440+x)*4+3]!>128;
  };
}
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
  private shipSlot:T.Object3D|null=null;
  private opacity=0;private time=0;private key='';private water=false;private maskAge=1;
  private p=new T.Vector3();private normal=new T.Vector3();private tangent=new T.Vector3();private side=new T.Vector3();private basis=new T.Matrix4();
  private onLand:(p:T.Vector3)=>boolean;
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
    // Cartographic miniatures have an oblique display tilt, not geographic size.
    // Lift their display base so the tilt does not push feet under the sphere.
    this.batch.group.rotation.x=.85;this.batch.group.position.y=1.3;
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
  update(route:Route|null,camera:T.PerspectiveCamera,dt:number,progress=0,playing=false,ordinal:number|null=null,campPhase:CampPhase='rest',tentScale=1){
    const key=route?.journey.id??'';
    if(key!==this.key){this.key=key;this.time=0;this.opacity=0;this.maskAge=1;}
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(playing&&!reducedMotion)this.time+=dt;
    const dist=camera.position.length();
    const marker=route&&(ordinal===null?route.markerAt(progress):route.journey.markers.find(m=>m.stops.includes(ordinal)));
    const valid=!!marker&&marker.lat!==null&&marker.lon!==null&&!marker.aside&&marker.attested;
    const target=route&&valid?T.MathUtils.clamp((2.2-dist/100)/.3,0,1):0;
    this.opacity+=(target-this.opacity)*(1-Math.exp(-dt*10));this.material.opacity=this.opacity;
    this.batch.begin();this.state.mode='hidden';this.state.people=0;this.state.tents=0;this.state.ship=0;this.state.phase=campPhase;
    for(const slot of this.walkerSlots)slot.group.visible=false;
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
    const scale=Math.max(.025,(dist-100)*2*Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.max(1,innerHeight)*16);
    this.group.scale.setScalar(scale);this.state.anchor=this.p.toArray();
    const exodus=route.journey.id==='exodus-wilderness';
    if(leg?.sea&&ordinal===null&&progress>leg.from&&progress<leg.to){
      this.maskAge+=dt;if(this.maskAge>.1){this.water=!this.onLand(this.p);this.maskAge=0;}
      if(this.water){
        const hullDrawn=this.models.shipReady;
        if(hullDrawn){this.ensureShipSlot();if(this.shipSlot){this.shipSlot.visible=true;this.shipSlot.rotation.z=Math.sin(this.time*.8)*.035;}}
        this.batch.ship(this.time,hullDrawn,this.models.walkersReady,this.models.shipDeckY);
        if(this.models.walkersReady)this.placeFigures(3,(i)=>[-.75+i*.7,this.models.shipDeckY,.27],.40,false,dt);
        this.state.mode='sailing';this.state.ship=1;this.state.people=3;
      }
    }else if(!leg?.sea||ordinal!==null||exodus||progress===0||progress>=1){
      const count=exodus?12:route.journey.id==='elijah'?1:3;
      const camping=exodus&&campPhase!=='travel'&&(ordinal!==null||!playing);
      if(exodus){
        for(let i=0;i<count;i++){
          const x=camping?(i%4-1.5)*.75:-(i%6)*.65;
          const z=camping?1.6+Math.floor(i/4)*.58:(Math.floor(i/6)-.5)*.85;
          this.batch.person(x,z,this.time,i,.72,0,playing&&!camping);
        }
      }else{
        // Paul-style land travel: a loaded character wherever it has finished
        // loading, the procedural miniature otherwise (D19). The exodus's
        // 12-person camp muster above stays procedural on purpose — a dozen
        // identical rigged clones would read as a crowd of twins, not a
        // nation, and the InstancedMesh batch is what keeps that scene cheap.
        this.placeFigures(count,(i)=>[-(i%6)*.65,0,(Math.floor(i/6)-.5)*.85],.72,playing&&!reducedMotion,dt);
      }
      if(camping){for(let i=0;i<3;i++)this.batch.put('tent',(i-1)*2.05,0,-1,.65,0,0,Math.max(.03,tentScale));this.state.tents=3;}
      this.state.mode=camping?'camp':'walking';this.state.people=count;
      if(route.journey.id==='elijah'&&marker.stops.includes(4)&&ordinal===4){
        for(let i=0;i<12;i++){const a=i%4*Math.PI/2;this.batch.put('stone',1.5+Math.cos(a)*.48,.2+Math.floor(i/4)*.33,Math.sin(a)*.48,1.1,i);}
        this.batch.put('wood',1.5,1.2,0,.8);this.batch.put('offering',1.5,1.4,0,.8);
        this.state.mode='altar';
      }
    }
    this.batch.finish();
  }
}
