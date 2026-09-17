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

/** An interpretive swept horn profile. The four horns are specified; their
 * curvature and dimensions are not. Continuous rings avoid cone-like spikes. */
export function altarHorn(height:number,radius:number,material:THREE.Material){
  const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(),new THREE.Vector3(0,height*.45,0),
    new THREE.Vector3(height*.10,height*.78,0),new THREE.Vector3(height*.32,height,0));
  const p:number[]=[],uv:number[]=[],ix:number[]=[];
  for(let j=0;j<=24;j++){
    const t=j/24,c=curve.getPoint(t),tangent=curve.getTangent(t),n=new THREE.Vector3(tangent.y,-tangent.x,0);
    const r=radius*(1-t)**.75;
    for(let k=0;k<=24;k++){
      const a=k/24*Math.PI*2;
      p.push(c.x+n.x*Math.cos(a)*r,c.y+n.y*Math.cos(a)*r,c.z+Math.sin(a)*r);uv.push(k/24,t);
      if(j<24&&k<24){const q=j*25+k;ix.push(q,q+25,q+1,q+1,q+25,q+26);}
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();
  return new THREE.Mesh(geo,material);
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
    // Keep the rest shape, so anything that deforms this cloth can let go of
    // it again.
    panel.userData.rest=(geo.attributes.position as THREE.BufferAttribute).array.slice();
  }
  return g;
}

/** Presses a hanging toward the viewer, as a hand or a lens pressed into it
 *  would: a bell of displacement along the cloth's own facing, centred on the
 *  point of contact and falling away from it.
 *
 *  Passing the veil used to be a picture of cloth faded over the screen, which
 *  is what a scene change looks like and not what a curtain looks like. The
 *  camera now goes THROUGH the cloth, and the cloth gives where it meets it —
 *  it does not part, because 幔子 is a barrier the text keeps shut (Lev 16:2),
 *  and a curtain that opens by itself for a visitor says something the text
 *  does not. */
export function pressCloth(group:THREE.Group,atY:number,atZ:number,depth:number,radius=.55){
  group.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const rest=o.userData.rest as Float32Array|undefined;
    if(!rest)return;
    const p=o.geometry.attributes.position as THREE.BufferAttribute;
    const local=atY-o.position.y;
    for(let i=0;i<p.count;i++){
      const y=rest[i*3+1]!,x=rest[i*3]!;
      // The panel is built in its own XY plane and turned into place by the
      // group, so "across" is x and "up" is y; the bulge runs along z.
      const d2=((y-local)/radius)**2+((x-atZ)/radius)**2;
      p.setZ(i,rest[i*3+2]!+depth*Math.exp(-d2));
    }
    p.needsUpdate=true;
    o.geometry.computeVertexNormals();
  });
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
    const cloned=o.geometry.clone().applyMatrix4(o.matrixWorld);
    const geo=cloned.index?cloned.toNonIndexed():cloned;
    if(geo!==cloned)cloned.dispose();
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
