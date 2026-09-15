import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sampleLeg} from './route-path.ts';
import type {Route} from './routes.ts';

/** Authored miniatures, not historical models or scaled geography. A single
 * vertex-colour material and instancing keep the complete layer to 2 draws. */
function miniature(kind:'ship'|'camel'){
 const parts:THREE.BufferGeometry[]=[];
 const part=(geo:THREE.BufferGeometry,color:string,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,rz=0)=>{
  geo.scale(sx,sy,sz);geo.rotateX(rx);geo.rotateZ(rz);geo.translate(x,y,z);
  const g=geo.toNonIndexed();const p=g.attributes.position!,n=g.attributes.normal!;const c=new THREE.Color(color);const colors=[];
  for(let i=0;i<p.count;i++){const k=.72+.28*Math.max(0,n.getY(i)*.8+n.getX(i)*.5);colors.push(c.r*k,c.g*k,c.b*k);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));parts.push(g);
 };
 if(kind==='ship'){
  part(new THREE.SphereGeometry(1,10,4), '#865334',0,.11,0,1,.25,.35);
  part(new THREE.BoxGeometry(1.5,.035,.45),'#bd9263',0,.28);
  part(new THREE.CylinderGeometry(.02,.028,1.4,5),'#986637',0,.91);
  part(new THREE.CylinderGeometry(.02,.02,1.35,5),'#986637',0,1.42,0,1,1,1,0,Math.PI/2);
  const sail=new THREE.PlaneGeometry(1.24,.9,8,6),p=sail.attributes.position!;
  for(let i=0;i<p.count;i++)p.setZ(i,Math.cos(p.getX(i)*2.3)*Math.cos(p.getY(i)*2.8)*.20);
  sail.computeVertexNormals();part(sail,'#e5d7b9',0,.99,0);
 }else{
  part(new THREE.SphereGeometry(1,8,4),'#9c7044',0,.65,0,.47,.28,.19);
  part(new THREE.SphereGeometry(1,8,3),'#b38a59',-.08,.9,0,.20,.21,.15);
  part(new THREE.CylinderGeometry(.075,.1,.55,6),'#b38a59',.43,.96,0,1,1,1,0,-.5);
  part(new THREE.SphereGeometry(1,6,3),'#9c7044',.60,1.21,0,.18,.12,.09);
  for(const x of [-.3,.3])for(const z of [-.13,.13])part(new THREE.CylinderGeometry(.035,.035,.55,5),'#785236',x,.27,z);
  part(new THREE.BoxGeometry(.35,.11,.43),'#634e3f',-.08,.97,0);
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return geometry;
}
export class Staffage{
 readonly group=new THREE.Group();
 private material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false});
 private ships=new THREE.InstancedMesh(miniature('ship'),this.material,6);
 private camels=new THREE.InstancedMesh(miniature('camel'),this.material,5);
 private dummy=new THREE.Object3D();private opacity=0;
 constructor(){this.ships.count=0;this.camels.count=0;this.ships.frustumCulled=false;this.camels.frustumCulled=false;this.group.add(this.ships,this.camels);}
 update(route:Route|null,camera:THREE.PerspectiveCamera,dt:number){
  const dist=camera.position.length(),target=route?THREE.MathUtils.clamp((2.2-dist/100)/.3,0,1):0;
  this.opacity+=(target-this.opacity)*(1-Math.exp(-dt*10));this.material.opacity=this.opacity;
  this.group.visible=this.opacity>.01;if(!this.group.visible||!route)return;
  const scale=Math.max(.05,(dist-100)*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/innerHeight*12);
  let shipCount=0;
  const used:THREE.Vector3[]=[];
  for(const leg of route.path.legs){
   if(!leg.sea||shipCount>=6)continue;
   const p=sampleLeg(leg,.5,new THREE.Vector3());
   if(used.some(v=>v.distanceTo(p)<scale*3))continue;used.push(p.clone());
   const normal=p.clone().normalize(),tangent=sampleLeg(leg,.51,new THREE.Vector3()).sub(p).normalize();
   // Miniature sits adjacent to, not over, the route stroke.
   p.addScaledVector(new THREE.Vector3().crossVectors(tangent,normal),scale*1.4);
   this.place(p,normal,tangent,scale);this.ships.setMatrixAt(shipCount++,this.dummy.matrix);
  }
  this.ships.count=shipCount;this.ships.instanceMatrix.needsUpdate=true;
  // One schematic caravan beside a land segment, not on a disputed camp.
  const land=route.path.legs.find(l=>!l.sea&&l.angle>.008);
  this.camels.count=land?5:0;
  if(land){
   for(let i=0;i<5;i++){
    const p=sampleLeg(land,.40+i*.025,new THREE.Vector3()),normal=p.clone().normalize();
    const tangent=sampleLeg(land,.405+i*.025,new THREE.Vector3()).sub(p).normalize();
    p.addScaledVector(new THREE.Vector3().crossVectors(tangent,normal),scale*2.1);
    this.place(p,normal,tangent,scale*.7);this.camels.setMatrixAt(i,this.dummy.matrix);
   }
   this.camels.instanceMatrix.needsUpdate=true;
  }
 }
 private place(p:THREE.Vector3,normal:THREE.Vector3,tangent:THREE.Vector3,scale:number){
  const z=new THREE.Vector3().crossVectors(tangent,normal).normalize();const x=new THREE.Vector3().crossVectors(normal,z).normalize();
  this.dummy.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,normal,z));
  this.dummy.position.copy(p);this.dummy.scale.setScalar(scale);this.dummy.updateMatrix();
 }
}
