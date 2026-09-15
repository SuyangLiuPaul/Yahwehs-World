import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small edge radii catch light; the overall stated dimensions stay fixed. */
export function bevelBox(w:number,h:number,d:number,material:THREE.Material,r=.008){
  const geo=new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/5,h/5,d/5));
  const p=geo.attributes.position!,n=geo.attributes.normal!,uv=geo.attributes.uv!;
  // Metre-based texture coordinates stop a tall board stretching one hammer
  // mark into a four-metre stripe. Same density on every face and edge.
  for(let i=0;i<p.count;i++){
    const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
    uv.setXY(i,(nx>ny&&nx>nz?p.getZ(i):p.getX(i))*2,(ny>nz&&ny>nx?p.getZ(i):p.getY(i))*2);
  }
  return new THREE.Mesh(geo,material);
}
export function cord(points:THREE.Vector3[],radius:number,material:THREE.Material){
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(8,points.length*3),radius,5,false),material);
}
/** Vertical hanging with real folds. Opening narrows at the top: fabric is
 * gathered aside for this educational display, not erased from the scene. */
export function hanging(width:number,height:number,material:THREE.Material,opening=0){
  const g=new THREE.Group();
  for(const side of (opening>0?[-1,1]:[0])){
    const half=side===0?width:width/2;
    const geo=new THREE.PlaneGeometry(half,height,Math.ceil(half*18),24);
    const p=geo.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<p.count;i++){
      const v=(p.getY(i)+height/2)/height;
      const u=(p.getX(i)+half/2)/half;
      let x=p.getX(i)+(side*width/4);
      if(side){
        const inner=side<0?u:1-u;
        x+=side*opening*.5*inner*(.8+.2*Math.sin(v*Math.PI));
      }
      const waves=Math.sin(u*half*20)*.043+Math.sin(u*half*8+.5)*.022;
      p.setXYZ(i,x,p.getY(i)+.018*Math.cos(u*half*18)*(1-v),waves*(.7+.3*v));
    }
    geo.computeVertexNormals();const panel=new THREE.Mesh(geo,material);panel.position.y=height/2;g.add(panel);
  }
  return g;
}

/** Static authored meshes become one GPU draw per material. Colliders and
 * semantic bounds are computed before batching; moving/loaded assets opt out. */
export function batchStatic(root:THREE.Group){
  root.updateMatrixWorld(true);
  const buckets=new Map<string,{material:THREE.Material;cast:boolean;receive:boolean;geos:THREE.BufferGeometry[]}>();
  const originals:THREE.Mesh[]=[];
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||Array.isArray(o.material)||o.userData.dynamic)return;
    if(o instanceof THREE.InstancedMesh)return;
    const cast=o.userData.noCast!==true;
    const key=o.material.uuid+String(cast);
    if(!buckets.has(key))buckets.set(key,{material:o.material,cast,receive:true,geos:[]});
    const geo=o.geometry.clone().applyMatrix4(o.matrixWorld).toNonIndexed();
    // All static geometry is PBR position/normal/uv, with no morph attributes.
    for(const name of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(name))geo.deleteAttribute(name);
    if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position!.count*2),2));
    buckets.get(key)!.geos.push(geo);originals.push(o);
  });
  for(const {material,cast,geos} of buckets.values()){
    const geometry=mergeGeometries(geos);if(!geometry)throw Error('Static scene geometry mismatch');
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=cast;mesh.receiveShadow=true;mesh.userData.noCast=!cast;
    mesh.name='Batched · '+(material.name||material.type);root.add(mesh);
    geos.forEach(g=>g.dispose());
  }
  originals.forEach(o=>{o.removeFromParent();o.geometry.dispose();});
}
