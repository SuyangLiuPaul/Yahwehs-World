import * as THREE from 'three';
import { lonLatToVec3 } from './globe.ts';
import type { Terrain } from './terrain.ts';
import type { RouteMarker } from './routes.ts';

/** A separate camera and a tiny render target: taking a thumbnail never
 * touches the reader's camera, controls, route visibility or terrain fade. */
export class RouteThumbnail {
  private readonly target = new THREE.WebGLRenderTarget(160,90);
  private readonly camera = new THREE.PerspectiveCamera(42,160/90,.1,1000);
  private readonly scene = new THREE.Scene();
  private readonly cache = new Map<string, ImageData>();
  private requested = 0;
  private lastKey = '';
  constructor(private renderer: THREE.WebGLRenderer, globe: THREE.Group,
    private terrain: Terrain, private canvas: HTMLCanvasElement) {
    const base=globe.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
    this.scene.add(new THREE.Mesh(base.geometry,new THREE.MeshBasicMaterial({map:base.material.map})));
    const surface=terrain.mesh.clone();
    surface.material=(terrain.mesh.material as THREE.Material).clone();
    (surface.material as THREE.MeshBasicMaterial).opacity=1;
    surface.visible=true;
    this.scene.add(surface);
    this.target.texture.colorSpace=THREE.SRGBColorSpace;
  }
  clear(){ this.requested++; this.lastKey=''; this.canvas.getContext('2d')?.clearRect(0,0,160,90); }
  show(marker: RouteMarker) {
    const key=marker.lon+','+marker.lat;
    if(key===this.lastKey)return;
    this.lastKey=key;
    const request=++this.requested;
    if(marker.lon===null||marker.lat===null){this.canvas.getContext('2d')?.clearRect(0,0,160,90);return;}
    const cached=this.cache.get(key);
    if(cached){this.canvas.getContext('2d')?.putImageData(cached,0,0);return;}
    void this.draw(marker,key,request).catch(()=>{if(request===this.requested)this.lastKey='';});
  }
  private async draw(m:RouteMarker,key:string,request:number){
    await this.terrain.ready;
    if(request!==this.requested)return;
    const at=lonLatToVec3(m.lon!,m.lat!);
    this.camera.position.copy(at).multiplyScalar(1.09);
    this.camera.lookAt(at);this.camera.updateMatrixWorld(true);
    const previous=this.renderer.getRenderTarget();
    try {this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera);}
    finally {this.renderer.setRenderTarget(previous);}
    const pixels=new Uint8Array(160*90*4);
    await this.renderer.readRenderTargetPixelsAsync(this.target,0,0,160,90,pixels);
    const image=new ImageData(160,90);
    for(let y=0;y<90;y++)image.data.set(pixels.subarray((89-y)*640,(90-y)*640),y*640);
    if(this.cache.size>=48)this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key,image);
    if(request===this.requested)this.canvas.getContext('2d')?.putImageData(image,0,0);
  }
}
