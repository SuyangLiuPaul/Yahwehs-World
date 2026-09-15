import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ActorBatch, type Piece} from './geometry.ts';
import {STORIES,phaseIndex,type StoryId} from './stories.ts';
import {locale,onLocale,bindSwitch,type Locale} from '../locale.ts';
import {localiseRef} from '../books.ts';
import './viewer.css';

const $=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
const tr=(en:string,zh:string)=>locale()==='en'?en:zh;
let singleton:StoryViewer|undefined;
export function openStory(id:StoryId,options:StoryId[],context:Record<Locale,string>){
  try{singleton??=new StoryViewer();}catch(error){document.getElementById('story-viewer')?.remove();throw error;}
  singleton.open(id,options,context);
}

/** Lazy, isolated inspector: closing it stops rendering; it never touches the
 * globe camera, route coordinates or route progress. */
class StoryViewer {
  private dialog=document.createElement('dialog');
  private renderer:T.WebGLRenderer;
  private scene=new T.Scene();
  private camera=new T.PerspectiveCamera(38,1,.1,80);
  private controls:OrbitControls;
  private batch=new ActorBatch(new T.MeshStandardMaterial({vertexColors:true,roughness:.88,side:T.DoubleSide}));
  private ground=new T.Mesh(new T.CylinderGeometry(7,7.15,.28,96),new T.MeshStandardMaterial({color:'#c7ac7e',roughness:1}));
  private water=new T.Mesh(new T.CircleGeometry(6.98,96),new T.MeshStandardMaterial({color:'#267284',roughness:.38,metalness:.25}));
  private trench=new T.Mesh(new T.TorusGeometry(1.22,.085,8,64),new T.MeshStandardMaterial({color:'#6c9d9e',roughness:.25,metalness:.15}));
  private foam=new T.InstancedMesh(new T.BoxGeometry(.46,.012,.025),new T.MeshBasicMaterial({color:'#bbd8d4',transparent:true,opacity:.45}),80);
  private dummy=new T.Object3D();
  private id:StoryId='camp';private time=0;private playing=false;private last=0;private frame=0;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private context:Record<Locale,string>={en:'',zh:''};private options:StoryId[]=[];private lastPhase=-1;private selected:Piece|null=null;
  constructor(){
    this.dialog.id='story-viewer';this.dialog.setAttribute('aria-labelledby','story-title');
    this.dialog.innerHTML=`<header class="story-header"><div><span id="story-eyebrow"></span><h2 id="story-title"></h2></div><button id="story-lang" type="button"></button><button id="story-close" type="button"></button></header>
      <div id="story-options" role="group"></div><div class="story-layout"><div class="story-visual"><canvas id="story-canvas" tabindex="0" role="img"></canvas><span id="story-art-label"></span><p id="story-hint"></p><button id="story-reset" type="button"></button></div>
      <section class="story-copy"><p id="story-context"></p><p id="story-text"></p><a id="story-ref" target="_blank" rel="noopener"></a><p id="story-caveat"></p><details><summary id="story-detail-title"></summary><p id="story-detail"></p></details></section></div>
      <footer class="story-footer"><div class="story-controls"><button id="story-play" type="button"></button><button id="story-replay" type="button"></button><span id="story-phase" role="status"></span></div><input id="story-scrub" type="range" min="0" max="1000" step="1" value="0"><div id="story-phases" role="group"></div></footer>`;
    document.body.append(this.dialog);
    this.renderer=new T.WebGLRenderer({canvas:$<HTMLCanvasElement>('story-canvas'),antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.scene.background=new T.Color('#18333c');
    this.scene.add(new T.HemisphereLight('#e6eff1','#8c7554',2.1));
    const sun=new T.DirectionalLight('#fff0d2',3.2);sun.position.set(-6,12,8);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:35});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;this.scene.add(sun);
    this.ground.position.y=-.17;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.water.rotation.x=-Math.PI/2;this.water.position.y=.01;this.water.receiveShadow=true;this.scene.add(this.water);
    this.trench.rotation.x=-Math.PI/2;this.trench.position.y=.01;this.scene.add(this.trench);
    this.foam.frustumCulled=false;this.scene.add(this.foam,this.batch.group);
    // Existing authored Higgsfield material; no new generation or API dependency.
    new T.TextureLoader().load('/materials/desert-ground-v1.webp',texture=>{
      texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(5,5);texture.anisotropy=4;
      this.ground.material.map=texture;this.ground.material.needsUpdate=true;this.render();
    },undefined,()=>{/* The ochre material remains usable offline. */});
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=false;this.controls.enablePan=false;
    this.controls.minDistance=6;this.controls.maxDistance=24;this.controls.maxPolarAngle=Math.PI*.48;this.controls.target.set(0,1,0);
    this.controls.addEventListener('change',()=>{if(!this.playing)this.render();});
    $('story-close').onclick=()=>this.dialog.close();
    this.dialog.addEventListener('close',()=>{this.playing=false;cancelAnimationFrame(this.frame);this.renderer.setAnimationLoop(null);});
    $('story-play').onclick=()=>{if(this.time>=STORIES[this.id].duration)this.time=0;this.playing=!this.playing;this.last=0;this.copy();this.run();};
    $('story-replay').onclick=()=>{this.time=0;this.playing=true;this.lastPhase=-1;this.last=0;this.copy();this.run();};
    $('story-reset').onclick=()=>this.resetCamera();
    $('story-scrub').oninput=()=>{this.playing=false;this.time=Number($<HTMLInputElement>('story-scrub').value)/1000*STORIES[this.id].duration;this.copy();this.render();};
    bindSwitch($('story-lang'));onLocale(()=>{if(this.dialog.open)this.copy();});
    new ResizeObserver(()=>{if(this.dialog.open){const r=this.renderer.domElement.getBoundingClientRect();this.renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);this.camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);this.camera.updateProjectionMatrix();this.render();}}).observe($('story-canvas'));
    let down:{x:number,y:number}|null=null;
    this.renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if(!down||Math.hypot(down.x-e.clientX,down.y-e.clientY)>6){down=null;return;}down=null;
      const r=this.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.x)/r.width*2-1,1-(e.clientY-r.y)/r.height*2),this.camera);
      const objects=[...this.batch.meshes.values()].filter(m=>m.visible&&m.count>0);objects.forEach(m=>m.computeBoundingSphere());
      const hit=ray.intersectObjects(objects,false)[0];
      if(hit){this.selected=hit.object.userData.piece;this.copy();($('story-detail').parentElement as HTMLDetailsElement).open=true;}
    });
    this.renderer.domElement.addEventListener('keydown',e=>{
      if(e.key===' '){e.preventDefault();$('story-play').click();}
      if(e.key.toLowerCase()==='r')this.resetCamera();
    });
    if(import.meta.env.DEV)(globalThis as unknown as Record<string,unknown>).__story={viewer:this,renderer:this.renderer,camera:this.camera,batch:this.batch,snapshot:()=>({id:this.id,time:this.time,playing:this.playing,phase:phaseIndex(this.id,this.time),pieces:Object.fromEntries([...this.batch.meshes].map(([k,m])=>[k,m.count]))})};
  }
  open(id:StoryId,options:StoryId[],context:Record<Locale,string>){
    cancelAnimationFrame(this.frame);this.last=0;
    this.id=id;this.options=options;this.context=context;this.time=0;this.playing=false;this.lastPhase=-1;this.selected=null;
    if(!this.dialog.open)this.dialog.showModal();this.copy();this.resetCamera();this.render();
    $('story-play').focus();
  }
  private resetCamera(){
    if(this.id==='sailing')this.camera.position.set(5.8,4.6,6.2);
    else if(this.id==='carmel'||this.id==='flight')this.camera.position.set(7.5,6,9);
    else this.camera.position.set(9,8,11);
    this.controls.target.set(0,1,0);this.controls.update();this.render();
  }
  private copy(){
    const story=STORIES[this.id];
    $('story-eyebrow').textContent=tr('A JOURNEY, BROUGHT TO LIFE','把行程读成画面');
    $('story-title').textContent=story.title[locale()];$('story-close').textContent='×';$('story-close').setAttribute('aria-label',tr('Close scene','关闭场景'));
    $('story-text').textContent=story.text[locale()];$('story-caveat').textContent=story.caveat[locale()];
    $('story-context').textContent=this.id==='whirlwind'?tr('After the Jordan crossing · exact site unknown','过约旦河之后 · 精确地点未定'):this.id==='carmel'?tr('Mount Carmel · exact altar site unknown','迦密山 · 祭坛精确位置未定'):this.id==='flight'?tr('Jezreel → Beersheba → wilderness → Horeb','耶斯列 → 别是巴 → 旷野 → 何烈'):this.context[locale()];
    const ref=$<HTMLAnchorElement>('story-ref');ref.href=story.url;ref.textContent=localiseRef(story.ref,locale())+' ↗';
    $('story-art-label').textContent=tr('INTERPRETIVE 3D · NOT TO SCALE','艺术示意 · 非实地比例');
    $('story-hint').textContent=tr('Drag to turn · pinch or scroll to zoom · tap a model','拖动旋转 · 双指或滚轮缩放 · 点模型看说明');
    $('story-reset').textContent=tr('Reset view','复位视角');
    $('story-canvas').setAttribute('aria-label',story.title[locale()]+tr('. Interactive illustration. Space to play; R to reset view.','. 交互示意。空格播放；R键复位视角。'));
    $('story-play').textContent=this.playing?tr('Ⅱ Pause','Ⅱ 暂停'):this.time>=story.duration?tr('↻ Replay','↻ 重播'):tr('▶ Play scene','▶ 播放场景');
    $('story-replay').textContent=tr('↻ Restart','↻ 从头开始');
    $('story-scrub').setAttribute('aria-label',tr('Scene progress','场景进度'));
    $('story-options').replaceChildren();
    for(const id of this.options){const b=document.createElement('button');b.type='button';b.dataset.story=id;b.textContent=STORIES[id].title[locale()];b.setAttribute('aria-pressed',String(id===this.id));b.onclick=()=>this.open(id,this.options,this.context);$('story-options').append(b);}
    $('story-phases').replaceChildren();
    story.phases[locale()].forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.dataset.phase=String(i);b.textContent=`${i+1} · ${p}`;b.onclick=()=>{this.time=(i+.25)/story.phases.en.length*story.duration;this.playing=false;this.copy();this.render();};$('story-phases').append(b);});
    const name=this.selected==='ship'||this.selected==='sail'?tr('The vessel','船只'):this.selected==='tent'||this.selected==='bundle'?tr('Camp equipment','营地器具'):this.selected==='chariot'||this.selected==='horse'||this.selected==='whirl'?tr('Fire and whirlwind','火与旋风'):tr('People & details','人物与细节');
    $('story-detail-title').textContent=name;
    $('story-detail').textContent=tr('Tap a model to inspect its category. All geometry is original. Faces, garments, movements, tent folds and hull joinery are artistic choices. Only explicit scriptural counts are presented as counts; the small crowd is representative. ', '点模型可查看类别。所有模型均为原创。面容、衣饰、动作、帐篷褶皱和船体接合方式均为艺术选择。只有经文明文给出的数字才作为数量依据；小队伍仅作代表。 ')+story.caveat[locale()];
    this.lastPhase=-1;this.progress();
  }
  private progress(){
    const p=phaseIndex(this.id,this.time);$<HTMLInputElement>('story-scrub').value=String(Math.round(this.time/STORIES[this.id].duration*1000));
    if(p!==this.lastPhase){this.lastPhase=p;$('story-phase').textContent=STORIES[this.id].phases[locale()][p]!;
      $('story-phases').querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===p));});}
    $('story-scrub').setAttribute('aria-valuetext',STORIES[this.id].phases[locale()][p]!);
  }
  private run(){
    cancelAnimationFrame(this.frame);
    if(!this.dialog.open||!this.playing){this.render();return;}
    this.frame=requestAnimationFrame(now=>{if(!this.playing||!this.dialog.open)return;if(!this.last)this.last=now;const dt=document.hidden?0:Math.min(.05,(now-this.last)/1000);this.last=now;
      this.time=Math.min(STORIES[this.id].duration,this.time+dt);if(this.time>=STORIES[this.id].duration){this.playing=false;this.copy();}this.render();if(this.playing)this.run();});
  }
  private render(){
    if(!this.dialog.open)return;
    const t=this.time,p=phaseIndex(this.id,t),motion=this.reduced.matches?0:t,b=this.batch;
    b.begin();this.water.visible=this.id==='sailing';this.foam.visible=this.water.visible;this.trench.visible=false;
    b.group.rotation.set(0,0,0);b.group.position.set(0,0,0);
    if(this.id==='sailing'){
      b.ship(motion);b.group.position.y=.13+Math.sin(motion*.85)*.035;b.group.rotation.z=Math.sin(motion*.62)*.012;
      for(let i=0;i<80;i++){
        const x=((i*2.718-motion*.22)%12+12)%12-6,z=Math.sin(i*8.7)*5.5;
        this.dummy.position.set(x,.035+Math.sin(motion+i)*.008,z);this.dummy.scale.setScalar(.6+(i%5)*.25);this.dummy.rotation.set(0,.15,0);this.dummy.updateMatrix();this.foam.setMatrixAt(i,this.dummy.matrix);
      }this.foam.instanceMatrix.needsUpdate=true;
    }else if(this.id==='camp'){
      const stretch=p===0?T.MathUtils.smoothstep(t,0,4):p===2?1-T.MathUtils.smoothstep(t,10.5,14):p===3?0:1;
      for(let i=0;i<3;i++){
        if(stretch>.02)b.put('tent',(i-1)*3.35,0,-1.4,1,0,0,Math.max(.03,stretch));
        if(p>=2)b.put('bundle',p===3?(i-1.5)*1.35+(t-15)*.55+.12:(i-1)*2.7,p===3?.65:.05,p===3?.5:1,.8);
        b.put('jar',(i-1)*3.35+.8,0,-.35,.8);
      }
      for(let i=0;i<12;i++){
        const walk=p===3,shift=walk?(t-15)*.55:0;
        const working=(p===0||p===2)&&i<3;
        const x=working?(i-1)*3.35:(i%4-1.5)*1.35+shift,z=working?.15:.5+Math.floor(i/4)*.85;
        b.person(x,z,motion,i,.78,0,walk,working?Math.PI/2:0,working);
      }
    }else if(this.id==='flight'){
      for(let i=0;i<34;i++)b.put('stone',Math.sin(i*3.1)*5,-.05,Math.cos(i*9)*5,.4+i%3*.2,i);
      b.person((t/18-.5)*4,0,motion,0,1.15,0,true);
    }else if(this.id==='carmel'){
      const consumed=T.MathUtils.smoothstep(t,17.7,19.8),size=1-consumed;
      for(let i=0;i<12;i++){
        const a=(i%4)*Math.PI/2+(Math.floor(i/4)%2)*Math.PI/4;
        if(size>.01)b.put('stone',Math.cos(a)*.53*size,(.2+Math.floor(i/4)*.38)*size,Math.sin(a)*.53*size,1.25*size,i);
      }
      if(size>.01){for(let i=0;i<5;i++)b.put('wood',0,1.25*size,(i-2)*.17,size,i%2?Math.PI/2:0);b.put('offering',0,1.49*size,0,size);}
      this.trench.visible=p>=1&&consumed<.9;
      b.person(-2,0,motion,0,1,0,false,0,p===2); // Prayer, never a casting beam from his hands.
      for(let i=0;i<4;i++)b.person(1.4+i*.65,2,motion,i+1,.8,0,false,Math.PI);
      if(p===1){const pour=(t-4.4)%1.4667/1.4667;
        for(let j=0;j<4;j++){const a=j*Math.PI/2;b.put('jar',Math.cos(a)*1.6,1.85,Math.sin(a)*1.6,1,-a,-.9);
          for(let i=0;i<14;i++){const f=(pour+i/14)%1;b.put('water',Math.cos(a)*(1.6-f),2.05-f*f*1.1,Math.sin(a)*(1.6-f),1);}}}
      if(p===3){for(let i=0;i<18;i++){const a=i*2.4,r=.25+(i%4)*.19;b.put('flame',Math.cos(a)*r,1+((motion+i*.37)%1)*1.3,Math.sin(a)*r,.55+(i%3)*.13);}}
    }else{
      // After the crossing, not a guessed topographic reconstruction.
      const separate=T.MathUtils.smoothstep(t,5.5,10),ascend=T.MathUtils.smoothstep(t,11,16.5);
      b.person(-2.2,1.7,motion,1,1,0,p===0);
      if(ascend<.99)b.person(1.8+separate,-2,motion,0,1,ascend*4.5,p===0);
      if(p===1||p===2){
        const x=-4+separate*4;b.put('chariot',x,0,0,.9);
        for(const z of [-.55,.55])b.put('horse',x+2,0,z,.82);
        for(let i=0;i<20;i++)b.put('flame',x+.3+Math.sin(i*2.7)*1.1,.15+(motion+i*.2)%1,Math.cos(i*2.7)*.7,.3);
        for(const z of [-.55,.55])for(let i=0;i<5;i++)b.put('flame',x+1.6+i*.2,.6,z,.26);
      }
      if(p===2)b.put('whirl',2.8,0,-2,1,motion*.15);
      if(p>=2)b.put('cloak',2.8,Math.max(.025,(1-ascend)*1.1),-2);
      if(p===3){
        b.begin();const approach=T.MathUtils.smoothstep(t,16.5,20.5),lift=T.MathUtils.smoothstep(t,20.5,22);
        b.person(-2.2+approach*4.2,1.7-approach*3.2,motion,1,1,0,approach<1,.65,lift>0);
        b.put('cloak',2.8,.025+lift*.65,-2);
      }
    }
    b.finish(motion);this.progress();this.renderer.render(this.scene,this.camera);
  }
}
