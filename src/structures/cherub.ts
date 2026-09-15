import * as THREE from 'three';

/** An explicitly interpretive winged, kneeling figure. Exodus 25:18–20 gives
 * number, orientation and spread wings, not anatomy, size or feather pattern.
 * This original sculpt is not presented as a recovered artifact. */
export function buildCherub(scale:number,material:THREE.Material){
 const g=new THREE.Group();
 const oval=(x:number,y:number,z:number,rx:number,ry:number,rz:number)=>{
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),material);
  m.position.set(x*scale,y*scale,z*scale);m.scale.set(rx*scale,ry*scale,rz*scale);g.add(m);return m;
 };
 // Folded legs and the rounded drape of a kneeling body, rather than blocks.
 oval(-.025,.065,0,.14,.065,.13);
 oval(.008,.245,0,.095,.20,.11).rotation.z=.14;
 oval(.036,.44,0,.09,.062,.13);
 oval(.075,.535,0,.07,.085,.064).rotation.z=.2;
 // A restrained brow/nose gives the face its inward/downward direction.
 oval(.134,.527,0,.024,.025,.017);
 for(const side of [-1,1]){
  const root=new THREE.Vector3(.018,.40,side*.075).multiplyScalar(scale);
  for(let i=0;i<10;i++){
   const f=i/9;
   const end=new THREE.Vector3(.21+.43*f,.58+.30*f,side*(.22+.05*Math.sin(f*Math.PI))).multiplyScalar(scale);
   const mid=root.clone().lerp(end,.48);mid.y+=scale*.085;
   const curve=new THREE.QuadraticBezierCurve3(root,mid,end);
   // Tapered, cupped feather surface with a fine raised shaft. Width is not
   // a cone's fixed base: it tapers gently all the way to the rounded tip.
   const vertices:number[]=[],uv:number[]=[],indices:number[]=[];
   for(let j=0;j<=16;j++){
    const t=j/16,c=curve.getPoint(t),w=scale*.039*Math.sin(Math.PI*t)**.6;
    for(const k of [-1,0,1]){
     vertices.push(c.x-w*k*.6,c.y+w*k*.55,c.z+side*w*Math.abs(k)*.28);
     uv.push(t,k/2+.5);
    }
   }
   for(let j=0;j<16;j++)for(let k=0;k<2;k++){const a=j*3+k;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
   g.add(new THREE.Mesh(geo,material));
   g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,12,scale*.0025,4,false),material));
  }
  // Small layered coverts bind the fan back into the shoulder.
  for(let i=0;i<4;i++)oval(.05+i*.032,.44+i*.027,side*(.10+i*.024),.065,.027,.036).rotation.z=.42;
 }
 return g;
}
