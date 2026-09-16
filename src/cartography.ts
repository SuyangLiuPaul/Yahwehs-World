import * as THREE from 'three';
import { GLOBE_RADIUS } from './globe.ts';
import { fullLocale, hant } from './locale.ts';

const EARTH_KM=6371.0088;
/** Project a measured great-circle distance in the screen's horizontal
 * tangent direction. The globe remains curved; the scale is local. */
export function measureMap(camera:THREE.PerspectiveCamera,width:number,height:number){
  camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);
  const centre=ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(),GLOBE_RADIUS),new THREE.Vector3());
  if(!centre)return null;
  const n=centre.clone().normalize();
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).projectOnPlane(n).normalize();
  const point=(distance:number,sign:number)=>n.clone().multiplyScalar(Math.cos(distance/EARTH_KM/2))
    .addScaledVector(right,sign*Math.sin(distance/EARTH_KM/2)).multiplyScalar(GLOBE_RADIUS).project(camera);
  const projected=(km:number)=>{
    const a=point(km,-1),b=point(km,1);
    return Math.hypot((b.x-a.x)*width/2,(b.y-a.y)*height/2);
  };
  const desired=width<520?120:140;
  const steps=[1,2,5,10,20,50,100,200,500,1000];
  const km=steps.reduce((best,k)=>Math.abs(projected(k)-desired)<Math.abs(projected(best)-desired)?k:best,steps[0]!);
  const north=new THREE.Vector3(0,1,0).projectOnPlane(n).normalize();
  const from=centre.clone().project(camera),to=centre.clone().add(north).project(camera);
  const bearing=Math.atan2((to.x-from.x)*width,(to.y-from.y)*height)*180/Math.PI;
  return {km,pixels:projected(km),bearing,centre:centre.toArray(),hundredKmPixels:projected(100)};
}

export class Cartography {
  private readonly root=document.getElementById('cartography')!;
  private lastKey='';
  update(camera:THREE.PerspectiveCamera,w:number,h:number,locale:'en'|'zh'){
    const key=[w,h,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].map(v=>v.toFixed(5)).join(',')+fullLocale();
    if(key===this.lastKey)return;
    this.lastKey=key;
    if(camera.position.length()>GLOBE_RADIUS*3){this.root.hidden=true;return;}
    const measured=measureMap(camera,w,h);
    if(!measured){this.root.hidden=true;return;}
    this.root.hidden=false;
    this.root.setAttribute('aria-label',locale==='zh'?hant('屏幕中心的局部比例尺'):'Local scale at screen centre');
    document.getElementById('map-scale')!.style.width=measured.pixels+'px';
    document.getElementById('scale-mid')!.textContent=String(measured.km/2);
    document.getElementById('scale-end')!.textContent=measured.km+(locale==='zh'?hant(' 公里'):' km');
    const north=document.getElementById('map-north')!;
    north.hidden=Math.abs(measured.bearing)<5;
    north.querySelector<HTMLElement>('.north-arrow')!.style.transform='rotate('+measured.bearing+'deg)';
  }
}
