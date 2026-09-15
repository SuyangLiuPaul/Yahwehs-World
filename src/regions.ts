import * as THREE from 'three';
import {lonLatToVec3} from './globe.ts';
import {placeLabel} from './names.ts';
import type {Place} from './types.ts';

// Cartographic label anchors, NOT site identifications or period boundaries.
// Names and scripture references are inherited from the one audited gazetteer
// (D16–D17). Positions are display anchors within the named broad geography.
const ANCHORS:[string,number,number,'land'|'water'][]=[
 ['Egypt',32.1,28.8,'land'],['Wilderness of Sinai',33.85,28.28,'land'],
 ['Red Sea 2',32.8,28.25,'water'],['Great Sea',32,32.4,'water'],
 ['Canaan',35.6,32.4,'land'],['Arabia 1',39.5,28,'land'],
 ['Cyprus',33,35.4,'land'],['Crete',24.9,35.1,'land'],
 ['Asia',27.8,39,'land'],['Pamphylia',30.5,36.8,'land'],
 ['Pisidia',30.7,38.6,'land'],['Lycaonia',33.4,38.6,'land'],
 ['Cilicia',34.7,37.3,'land'],['Syria 1',37.9,34.3,'land'],
 ['Lebanon',36,34.1,'land'],['Mesopotamia',40.5,36.5,'land'],
 ['Assyria',44,36.2,'land'],['Babylonia',44.4,32.5,'land'],
 ['Macedonia',23,41,'land'],['Achaia',22.5,38,'land'],
 ['Italy',13.2,42.5,'land'],['Adriatic Sea',18,39.8,'water'],
];
const overlap=(a:DOMRect,b:DOMRect)=>a.left<b.right+6&&a.right>b.left-6&&a.top<b.bottom+4&&a.bottom>b.top-4;
export class RegionLabels{
 private readonly root=document.createElement('div');
 private labels:{el:HTMLSpanElement;point:THREE.Vector3;place:Place}[]=[];
 private last=''; private time=0;
 constructor(places:Place[]){
  this.root.id='region-labels';this.root.setAttribute('aria-hidden','true');document.body.append(this.root);
  for(const [name,lon,lat,kind] of ANCHORS){
   const place=places.find(p=>p.name===name);if(!place)throw Error(`Missing region gazetteer entry ${name}`);
   const el=document.createElement('span');el.className=`region-label ${kind}`;
   el.dataset.source=place.refs[0]||'';el.title=`${place.refs[0]} · cartographic label, not a boundary`;
   this.root.append(el);this.labels.push({el,point:lonLatToVec3(lon,lat,.06),place});
  }
 }
 update(camera:THREE.PerspectiveCamera,globe:THREE.Group,locale:'en'|'zh',top:number,bottom:number,dt:number){
  this.time+=dt;if(this.time<.09)return;this.time=0;
  const dist=camera.position.length()/100;
  this.root.hidden=dist>3||dist<1.08;if(this.root.hidden)return;
  if(this.last!==locale){this.labels.forEach(l=>l.el.textContent=placeLabel(l.place.name,l.place.zh,locale));this.last=locale;}
  this.root.style.opacity=String(Math.min(1,(3-dist)/.5));
  const occupied=Array.from(document.querySelectorAll<HTMLElement>('.rlab')).filter(e=>e.style.display!=='none').map(e=>e.getBoundingClientRect());
  const cameraLocal=globe.worldToLocal(camera.position.clone());
  for(const label of this.labels){
   const p=label.point;
   if(p.dot(cameraLocal)<=10000){label.el.style.display='none';continue;}
   const v=p.clone().applyMatrix4(globe.matrixWorld).project(camera);
   const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;
   label.el.style.display='block';label.el.style.left=`${x}px`;label.el.style.top=`${y}px`;
   const rect=label.el.getBoundingClientRect();
   if(rect.left<8||rect.right>innerWidth-8||rect.top<top||rect.bottom>bottom||occupied.some(o=>overlap(rect,o)))label.el.style.display='none';
   else occupied.push(rect);
  }
 }
}
