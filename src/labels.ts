import * as THREE from 'three';
import { GLOBE_RADIUS } from './globe.ts';
import type { RouteMarker } from './routes.ts';
import { placeLabel } from './names.ts';

export interface SafeBand { top: number; height: number }
interface LabelItem {
  el: HTMLElement; leader: SVGLineElement; pos: THREE.Vector3;
  marker: RouteMarker; w: number; h: number;
}
interface Box { left: number; right: number; top: number; bottom: number }

export class RouteLabels {
  readonly root = document.createElement('div');
  private items: LabelItem[] = [];
  private measuredAt = -1;
  private layoutKey = '';
  private readonly world = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly near = new THREE.Vector3();
  constructor(parent: HTMLElement) { this.root.className='route-labels'; parent.appendChild(this.root); }

  build(markers: THREE.Object3D[], locale: 'zh'|'en') {
    this.clear();
    void document.fonts.ready.then(()=>{this.measuredAt=-1;});
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.classList.add('route-leaders'); svg.setAttribute('aria-hidden','true');
    this.root.appendChild(svg);
    this.items=markers.map((mesh,i)=>{
      const m=mesh.userData.marker as RouteMarker;
      const el=document.createElement('div');
      el.className='rlab'+(i===0?' start':i===markers.length-1?' end':'')+(m.stops.length>1?' many':'');
      el.dataset.marker=String(mesh.userData.index ?? i);
      const ord=document.createElement('b');
      ord.textContent=m.stops.length>1 ? m.stops[0]+'–'+m.stops.at(-1) : String(m.n);
      const name=document.createElement('span'); name.textContent=placeLabel(m.place,m.zh,locale);
      el.append(ord,name);
      if(i===0||i===markers.length-1) {
        const tag=document.createElement('u');
        tag.textContent=locale==='zh'?(i===0?'起':'终'):(i===0?'S':'E');
        tag.setAttribute('aria-label',locale==='zh'?(i===0?'起点':'终点'):(i===0?'Start':'End'));
        el.appendChild(tag);
      }
      if(m.stops.length>1)el.title=locale==='zh'?'多个营站共用区域坐标；实际位置未定':'Multiple camps share a regional coordinate; exact sites are uncertain.';
      el.style.display='none';
      this.root.appendChild(el);
      const leader=document.createElementNS(svg.namespaceURI,'line') as SVGLineElement;
      leader.style.display='none'; svg.appendChild(leader);
      return {el,leader,pos:mesh.position.clone(),marker:m,w:0,h:0};
    });
  }
  clear(){this.root.replaceChildren();this.items=[];this.measuredAt=-1;this.layoutKey='';}
  private measure(width:number){
    if(this.measuredAt===width)return;
    for(const it of this.items){it.el.style.visibility='hidden';it.el.style.display='';}
    for(const it of this.items){it.w=it.el.offsetWidth;it.h=it.el.offsetHeight;}
    for(const it of this.items){it.el.style.display='none';it.el.style.visibility='';}
    this.measuredAt=width;
  }
  update(camera:THREE.PerspectiveCamera, globe:THREE.Object3D,reached:number,w:number,h:number,band:SafeBand={top:0,height:h},highlight=reached){
    if(!this.items.length||w<2||h<2)return;
    const key=[w,h,reached,highlight,band.top,band.height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,...globe.matrixWorld.elements].map(v=>v.toFixed(5)).join(',');
    if(key===this.layoutKey&&this.measuredAt===w)return;
    this.measure(w);
    this.layoutKey=key;
    const candidates:{it:LabelItem;x:number;y:number;op:number;rank:number}[]=[];
    const camLength=camera.position.length();
    this.items.forEach((it,i)=>{
      it.el.style.display='none';it.leader.style.display='none';it.el.classList.toggle('now',i===highlight);
      if(i>reached||it.marker.aside)return;
      this.world.copy(it.pos).applyMatrix4(globe.matrixWorld);
      this.direction.copy(this.world).sub(camera.position);
      const nearest=THREE.MathUtils.clamp(-camera.position.dot(this.direction)/this.direction.lengthSq(),0,1);
      this.near.copy(camera.position).addScaledVector(this.direction,nearest);
      // Perspective sphere occlusion, rather than just the far hemisphere.
      if(this.near.lengthSq()<(GLOBE_RADIUS+.05)**2)return;
      const facing=this.world.dot(camera.position)/(this.world.length()*camLength);
      const op=THREE.MathUtils.clamp((facing-GLOBE_RADIUS/camLength)/.035,0,1);
      this.world.project(camera);
      if(this.world.z>1||this.world.z< -1||Math.abs(this.world.x)>1||Math.abs(this.world.y)>1)return;
      candidates.push({it,x:(this.world.x+1)*w/2,y:(1-this.world.y)*h/2,op,
        rank:i===highlight?0:i===0||i===this.items.length-1?1:it.marker.stops.length>1?3:2});
    });
    candidates.sort((a,b)=>a.rank-b.rank||b.op-a.op);
    const placed:{c:typeof candidates[number];box:Box}[]=[];
    const edge=8, top=band.top+edge, bottom=band.top+band.height-edge;
    for(const c of candidates){
      const {it,x,y}=c;
      if(x<edge||x>w-edge||y<top||y>bottom)continue;
      // D9: fixed attachment above the marker. Only frame-edge clipping
      // flips the attachment; collisions drop a label, never slide it.
      let left=x-it.w/2;
      if(left<edge)left=x+5;
      else if(left+it.w>w-edge)left=x-it.w-5;
      let yTop=y-it.h-8;
      if(yTop<top)yTop=y+8;
      const box={left,right:left+it.w,top:yTop,bottom:yTop+it.h};
      if(box.left<edge||box.right>w-edge||box.top<top||box.bottom>bottom)continue;
      placed.push({c,box});
    }
    const clashes=(a:Box,b:Box)=>a.left<b.right+2&&a.right>b.left-2&&a.top<b.bottom+2&&a.bottom>b.top-2;
    const fixed:typeof placed=[];
    for(const p of placed.filter(p=>p.c.rank<2))if(!fixed.some(f=>clashes(p.box,f.box)))fixed.push(p);
    const pool=placed.filter(p=>p.c.rank>=2&&!fixed.some(f=>clashes(p.box,f.box)));
    // Pick the largest compatible set of fixed-position boxes. First-fit was
    // losing two short labels to one wide name even though neither needed to
    // move. The graph is tiny (23 wilderness markers) and cached until the
    // camera, stop, viewport or font changes.
    let best:typeof placed=[];
    const choose=(rest:typeof placed,chosen:typeof placed)=>{
      if(chosen.length+rest.length<=best.length)return;
      if(!rest.length){best=chosen;return;}
      const [first,...tail]=rest;
      choose(tail.filter(p=>!clashes(first!.box,p.box)),[...chosen,first!]);
      choose(tail,chosen);
    };
    choose(pool,[]);
    for(const {c,box} of [...fixed,...best]){
      const {it,x,y}=c;
      it.el.style.display='';it.el.style.opacity=String(c.op);
      it.el.style.transform='translate('+box.left+'px,'+box.top+'px)';
      const endX=THREE.MathUtils.clamp(x,box.left,box.right);
      const endY=THREE.MathUtils.clamp(y,box.top,box.bottom);
      it.leader.setAttribute('x1',String(x));it.leader.setAttribute('y1',String(y));
      it.leader.setAttribute('x2',String(endX));it.leader.setAttribute('y2',String(endY));
      it.leader.style.display='';it.leader.style.opacity=String(c.op);
    }
  }
}
