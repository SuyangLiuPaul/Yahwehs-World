import * as T from 'three';
import {sampleLeg} from './route-path.ts';
import {lonLatToVec3} from './globe.ts';
import type {Route} from './routes.ts';
import type {GeoJson} from './types.ts';
import {ActorBatch} from './journey-actors/geometry.ts';
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
  update(route:Route|null,camera:T.PerspectiveCamera,dt:number,progress=0,playing=false,ordinal:number|null=null,campPhase:CampPhase='rest',tentScale=1){
    const key=route?.journey.id??'';
    if(key!==this.key){this.key=key;this.time=0;this.opacity=0;this.maskAge=1;}
    if(playing&&!matchMedia('(prefers-reduced-motion: reduce)').matches)this.time+=dt;
    const dist=camera.position.length();
    const marker=route&&(ordinal===null?route.markerAt(progress):route.journey.markers.find(m=>m.stops.includes(ordinal)));
    const valid=!!marker&&marker.lat!==null&&marker.lon!==null&&!marker.aside&&marker.attested;
    const target=route&&valid?T.MathUtils.clamp((2.2-dist/100)/.3,0,1):0;
    this.opacity+=(target-this.opacity)*(1-Math.exp(-dt*10));this.material.opacity=this.opacity;
    this.batch.begin();this.state.mode='hidden';this.state.people=0;this.state.tents=0;this.state.ship=0;this.state.phase=campPhase;
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
      if(this.water){this.batch.ship(this.time);this.state.mode='sailing';this.state.ship=1;this.state.people=3;}
    }else if(!leg?.sea||ordinal!==null||exodus||progress===0||progress>=1){
      const count=exodus?12:route.journey.id==='elijah'?1:3;
      const camping=exodus&&campPhase!=='travel'&&(ordinal!==null||!playing);
      for(let i=0;i<count;i++){
        const x=camping?(i%4-1.5)*.75:-(i%6)*.65;
        const z=camping?1.6+Math.floor(i/4)*.58:(Math.floor(i/6)-.5)*.85;
        this.batch.person(x,z,this.time,i,.72,0,playing&&!camping);
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
