import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {effectMaterial} from './effects.ts';

export type Piece = 'person'|'leg'|'arm'|'ship'|'sail'|'tent'|'bundle'|'horse'|'chariot'|'stone'|'wood'|'offering'|'flame'|'whirl'|'cloak'|'jar'|'water';
const cache = new Map<Piece,T.BufferGeometry>();
/** Vertical offset `person()` adds under the torso to seat the legs. Pulled
 * out as a constant, rather than left as a literal `.34` in two places,
 * because `personStandingHeight()` below has to reproduce the same placement
 * to measure a figure it never actually assembles. */
const LEG_Y_OFFSET = .34;
/** Original story miniatures. Dimensions, faces, dress and vessel construction
 * are illustrative, never archaeological reconstructions. Local +X is forward. */
export function geometry(kind:Piece) {
  if(cache.has(kind))return cache.get(kind)!;
  const parts:T.BufferGeometry[]=[];
  const part=(g:T.BufferGeometry,c:string,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>{
    g.scale(sx,sy,sz);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);
    const flat=g.index?g.toNonIndexed():g;
    if(flat!==g)g.dispose();
    if(kind!=='flame'&&kind!=='whirl')flat.deleteAttribute('uv');
    const colors=new Float32Array(flat.attributes.position!.count*3),color=new T.Color(c);
    for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
    flat.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(flat);
  };
  const ball=(c:string,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>part(new T.SphereGeometry(1,12,8),c,x,y,z,sx,sy,sz);
  const box=(c:string,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>part(new T.BoxGeometry(1,1,1),c,x,y,z,sx,sy,sz);
  const rod=(a:T.Vector3,b:T.Vector3,r:number,c:string)=>{
    const g=new T.CylinderGeometry(r,r,a.distanceTo(b),7);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));
    const p=a.clone().add(b).multiplyScalar(.5);part(g,c,p.x,p.y,p.z);
  };
  const V=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
  if(kind==='person'){
    part(new T.CylinderGeometry(.16,.26,.63,12),'#e7d7ad',0,.66,0,1,1,.8);
    part(new T.CylinderGeometry(.192,.2,.065,12),'#8b5740',0,.61,0,1,1,.86);
    // Woven cloak and hem, rather than a faceless cone.
    ball('#687d7d',-.10,.79,0,.16,.32,.245);
    ball('#bc825d',.015,1.12,0,.195,.225,.19);
    part(new T.SphereGeometry(.204,12,7,0,Math.PI*2,0,1.3),'#493f34',.015,1.15);
    ball('#bf8967',.202,1.12,0,.065,.052,.051);
    for(const z of [-.088,.088])ball('#302c27',.182,1.165,z,.015,.021,.018);
    for(let i=0;i<9;i++)rod(V(Math.cos(i*.7)*.245,.365,Math.sin(i*.7)*.19),V(Math.cos(i*.7)*.248,.40,Math.sin(i*.7)*.193),.008,'#ad8a5c');
  }else if(kind==='arm'){
    rod(V(0,0,0),V(.03,-.34,0),.071,'#d6c191');
    ball('#bc825d',.045,-.38,0,.067,.077,.064);
  }else if(kind==='leg'){
    part(new T.CylinderGeometry(.068,.057,.32,8),'#c5ac7e',0,-.15);
    ball('#805534',.04,-.31,0,.13,.045,.07);
  }else if(kind==='ship'){
    // Lofted clinker-like hull, pointed ends; open deck with gunwales.
    const verts:number[]=[],indices:number[]=[];
    for(let i=0;i<=24;i++){
      const x=-2+i/6,w=.65*Math.pow(Math.sin(i/24*Math.PI),.65);
      for(let j=0;j<=12;j++){
        const a=j/12*Math.PI;verts.push(x,.48-.6*Math.sin(a)+.2*Math.pow(Math.abs(x)/2,4),w*Math.cos(a));
      }
    }
    for(let i=0;i<24;i++)for(let j=0;j<12;j++){const a=i*13+j;indices.push(a,a+1,a+13,a+1,a+14,a+13);}
    const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(verts,3));hull.setIndex(indices);hull.computeVertexNormals();part(hull,'#825131');
    for(let i=-8;i<=8;i++){
      const x=i*.2,w=.58*Math.pow(Math.cos(x/2*Math.PI/2),.65);
      box(i%2?'#b88650':'#c39861',x,.43,0,.19,.06,w*2);
    }
    for(const sign of [-1,1])for(let i=0;i<24;i++){
      const a=i/24*Math.PI,b=(i+1)/24*Math.PI;
      rod(V(-2+i/6,.51+.2*Math.pow(Math.abs(-2+i/6)/2,4),sign*.65*Math.pow(Math.sin(a),.65)),V(-2+(i+1)/6,.51+.2*Math.pow(Math.abs(-2+(i+1)/6)/2,4),sign*.65*Math.pow(Math.sin(b),.65)),.045,'#d4ad71');
    }
    rod(V(0,.44,0),V(0,3.2,0),.05,'#775337');
    rod(V(0,2.95,-1.24),V(0,2.95,1.24),.035,'#996b40');
    for(const x of [-1.65,1.65])for(const z of [-.35,.35])rod(V(0,3.05,0),V(x,.55,z),.009,'#c9b687');
    for(const x of [-1.25,.95])box('#805234',x,.65,0,.16,.08,.97);
    rod(V(-1.65,.63,-.4),V(-2.25,-.1,-.7),.035,'#9f7245');
    box('#a17c50',-2.15,.02,-.65,.35,.05,.18);
    for(const z of [-.32,.32])ball('#976545',-.85,.66,z,.15,.21,.15);
  }else if(kind==='sail'){
    const g=new T.PlaneGeometry(2.28,1.75,18,12),p=g.attributes.position!;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i);p.setXYZ(i,.34*Math.cos(x*.95)*Math.cos(y*1.5)+.025*Math.sin(x*26),y+2.01,x);
    }
    g.computeVertexNormals();part(g,'#f3e2b6');
    for(let k=-4;k<=4;k++)rod(V(.02,1.15,k*.25),V(.04,2.87,k*.25),.006,'#c8b280');
  }else if(kind==='tent'){
    // Open front, bowed woven panels, ridge rope, pegs, seams.
    for(const side of [-1,1]){
      const g=new T.PlaneGeometry(2.6,1,16,12),p=g.attributes.position!;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),f=p.getY(i)+.5;
        p.setXYZ(i,x,.16+f*1.25-.12*Math.sin(f*Math.PI),side*(1-f)*1.08);
      }
      g.computeVertexNormals();part(g,side===1?'#705c43':'#8a7454');
      for(let k=-5;k<=5;k++)rod(V(k*.22,.15,side*1.08),V(k*.22,1.41,0),.008,'#b19a70');
    }
    for(const x of [-1.25,1.25])rod(V(x,0,0),V(x,1.45,0),.036,'#af8b54');
    rod(V(-1.38,1.45,0),V(1.38,1.45,0),.026,'#ab8a59');
    for(const x of [-1.3,1.3])for(const z of [-1.6,1.6]){
      rod(V(x,.5,Math.sign(z)*.82),V(x,0,z),.009,'#cbb98f');rod(V(x,-.03,z),V(x+.03,.15,z),.023,'#9a744a');
    }
    box('#b78a53',0,.012,0,2.3,.016,1.9);
  }else if(kind==='bundle'){
    ball('#ae8a5f',0,.15,0,.34,.15,.19);
    for(const x of [-.17,.17])part(new T.TorusGeometry(.16,.012,5,12),'#514d39',x,.15,0,1,1,1,0,Math.PI/2);
  }else if(kind==='horse'){
    ball('#e6ad61',0,.8,0,.65,.33,.25);ball('#ffe3a1',.58,1.1,0,.20,.42,.19);
    ball('#efc478',.78,1.40,0,.29,.14,.14);
    for(const z of [-.1,.1])part(new T.ConeGeometry(.055,.18,5),'#ffd692',.64,1.58,z);
    for(const x of [-.4,.4])for(const z of [-.18,.18])rod(V(x,.7,z),V(x+.10,0,z),.06,'#cf8637');
    rod(V(-.58,.9,0),V(-.88,.45,0),.045,'#8b4d2b');
    for(let i=0;i<7;i++)ball('#fff0b3',.34+i*.022,1.05+i*.075,0,.07,.09,.14);
  }else if(kind==='chariot'){
    box('#e8ae57',0,.42,0,.85,.1,1.15);box('#f5c579',.4,.77,0,.09,.7,1.12);
    for(const z of [-.55,.55])box('#d28a42',0,.62,z,.8,.40,.06);
    for(const z of [-.7,.7]){
      part(new T.TorusGeometry(.40,.045,7,20),'#ffd785',0,.42,z);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(V(0,.42,z),V(Math.cos(a)*.38,.42+Math.sin(a)*.38,z),.025,'#a86835');}
    }
    rod(V(0,.42,-.8),V(0,.42,.8),.05,'#a67340');rod(V(.4,.44,0),V(2.4,.44,0),.04,'#e9b46c');
  }else if(kind==='stone'){
    part(new T.IcosahedronGeometry(1,1),'#a39177',0,0,0,.33,.23,.27);
  }else if(kind==='wood'){
    part(new T.CylinderGeometry(.10,.13,1.4,7),'#75513a',0,0,0,1,1,1,0,0,Math.PI/2);
  }else if(kind==='offering'){
    // Prepared offering, deliberately non-graphic. Not a living animal.
    for(let i=0;i<5;i++)ball('#785a45',Math.cos(i*2.4)*.35,0,Math.sin(i*2.4)*.35,.22,.12,.20);
  }else if(kind==='water'){
    ball('#8bc4d3',0,0,0,.06,.09,.06);
  }else if(kind==='flame'){
    for(let i=0;i<3;i++)part(new T.PlaneGeometry(.8,1.6,1,1),'#ffffff',0,.8,0,1,1,1,0,i*Math.PI/3);
  }else if(kind==='whirl'){
    part(new T.CylinderGeometry(1.1,.42,4,40,14,true),'#ffffff',0,2);
  }else if(kind==='cloak'){
    part(new T.PlaneGeometry(.7,1,8,8),'#9c6b41',0,.025,0,1,1,1,-Math.PI/2);
  }else{
    part(new T.LatheGeometry([new T.Vector2(.09,0),new T.Vector2(.19,.06),new T.Vector2(.22,.24),new T.Vector2(.09,.4),new T.Vector2(.1,.44)],12),'#b77c4e');
    part(new T.TorusGeometry(.13,.025,6,12),'#cd9569',0,.3,.17);
  }
  const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());g.computeBoundingSphere();cache.set(kind,g);return g;
}

/** Foot-to-crown height of one procedural person at `scale=1`, so a loaded
 * character model can be scaled to stand exactly as tall as the miniature it
 * replaces without a second, independently-guessed number living in
 * `journey-actors/models.ts`. Measured off the real merged geometry — not
 * hand-derived from the vertex math above, which would go stale silently if
 * the art ever changed. */
export function personStandingHeight(): number {
  const person=geometry('person'), leg=geometry('leg');
  if(!person.boundingBox)person.computeBoundingBox();
  if(!leg.boundingBox)leg.computeBoundingBox();
  const legTop=leg.boundingBox!.max.y+LEG_Y_OFFSET, legBottom=leg.boundingBox!.min.y+LEG_Y_OFFSET;
  return Math.max(person.boundingBox!.max.y,legTop)-Math.min(person.boundingBox!.min.y,legBottom);
}

/** Bow-to-stern length of the procedural hull at `scale=1` — the ruler a
 * loaded ship model is fitted against, for the same reason as above. */
export function shipHullLength(): number {
  const hull=geometry('ship');
  if(!hull.boundingBox)hull.computeBoundingBox();
  return hull.boundingBox!.max.x-hull.boundingBox!.min.x;
}

/** One draw per piece, shared by the globe and the inspectable story stage. */
export class ActorBatch {
  readonly group=new T.Group();
  readonly meshes=new Map<Piece,T.InstancedMesh>();
  private dummy=new T.Object3D();
  private tint=new T.Color();
  private fire=effectMaterial();private dust=effectMaterial(true);
  constructor(readonly material:T.Material,private renderOrder=0){}
  begin(){for(const mesh of this.meshes.values())mesh.count=0;}
  put(kind:Piece,x:number,y:number,z:number,scale=1,yaw=0,rz=0,sy=1,color='#ffffff'){
    let mesh=this.meshes.get(kind);
    if(!mesh){const effect=kind==='flame'||kind==='whirl';mesh=new T.InstancedMesh(geometry(kind),kind==='flame'?this.fire:kind==='whirl'?this.dust:this.material,64);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=!effect;mesh.receiveShadow=!effect;mesh.renderOrder=this.renderOrder;mesh.userData.piece=kind;this.group.add(mesh);this.meshes.set(kind,mesh);}
    if(mesh.count>=64)return;
    this.dummy.position.set(x,y,z);this.dummy.rotation.set(0,yaw,rz);this.dummy.scale.set(scale,scale*sy,scale);this.dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count,this.dummy.matrix);mesh.setColorAt(mesh.count++,this.tint.set(color));
  }
  person(x:number,z:number,time:number,index=0,scale=1,y=0,walk=true,yaw=0,working=false){
    const stride=walk?Math.sin(time*7+index*.9)*.55:0;
    const bob=walk?Math.abs(Math.sin(time*7+index*.9))*.025:0;
    const colors=['#ffffff','#e1d2b0','#b6cbd0','#e5b7a0','#bfc7a4'];
    this.put('person',x,y+bob,z,scale,yaw,0,1,colors[index%colors.length]);
    for(const side of [-1,1])this.put('leg',x+Math.sin(yaw)*side*.11*scale,y+LEG_Y_OFFSET*scale,z+Math.cos(yaw)*side*.11*scale,scale,yaw,stride*side);
    for(const side of [-1,1])this.put('arm',x+Math.sin(yaw)*side*.235*scale,y+.88*scale+bob,z+Math.cos(yaw)*side*.235*scale,scale,yaw,working?1.1+Math.sin(time*2+index)*.12:-stride*side);
  }
  /** `hullDrawn` is true when a loaded model is standing in for the hull and
   * sail. `passengersDrawn` is true when a caller is placing loaded walker
   * models on the deck itself, at `deckY`, instead of the three procedural
   * passengers this method would otherwise put there — so the deck is never
   * empty if either half of the substitution failed to arrive. */
  ship(time:number,hullDrawn=false,passengersDrawn=false,deckY=.56){
    if(!hullDrawn){this.put('ship',0,0,0);this.put('sail',0,0,0,1,Math.sin(time*.8)*.035);}
    if(!passengersDrawn)for(let i=0;i<3;i++)this.person(-.75+i*.7,.27,time,i,.40,deckY,false);
  }
  finish(time=0){this.fire.uniforms.uTime!.value=time;this.dust.uniforms.uTime!.value=time;for(const mesh of this.meshes.values()){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}}
  dispose(){for(const m of this.meshes.values())m.dispose();this.material.dispose();this.fire.dispose();this.dust.dispose();this.group.clear();}
}
