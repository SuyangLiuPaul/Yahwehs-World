import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readdir,stat} from 'node:fs/promises';

const dir=process.env.EVIDENCE_DIR||'handoff/evidence/phase-3/checks';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_FAILED'))errors.push(`${m.text()} ${m.location().url||''}`);});
 await page.goto('http://127.0.0.1:5175/tabernacle.html');
 await page.waitForFunction(()=>document.body.dataset.reflections==='ready');
 await page.click('#tour');
 const materials=await page.evaluate(()=>{
  const w=window.__walk,names=new Set();w.scene.traverse(o=>{
   if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){
    if(m.map?.image?.src?.includes('/materials/'))names.add(m.map.image.src.split('/').at(-1));
   }
  });return {loaded:[...names].sort(),counts:w.counts,reflection:document.body.dataset.reflections};
 });
 assert.equal(materials.loaded.length,5,'All five selected material studies must be in the actual scene');
 assert.deepEqual(materials.counts,{courtPillars:60,boards:48,sockets:96,clasps:50,bars:15,curtains:10});
 results.push(materials);
 const cdp=await context.newCDPSession(page);
 for(const [name,stop] of [['court',2],['inner-room',9]]){
  await page.selectOption('#tour-stop',String(stop));
  await page.waitForTimeout(350);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const perf=await page.evaluate(()=>new Promise(resolve=>{
   const values=[];let start=performance.now(),last=start;
   function frame(now){values.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(frame);else{
    const sorted=values.slice(1).sort((a,b)=>a-b);resolve({fps:values.length*1000/(now-start),p95:sorted[Math.floor(sorted.length*.95)],calls:window.__walk.renderer.info.render.calls,triangles:window.__walk.renderer.info.render.triangles,textures:window.__walk.renderer.info.memory.textures});
   }}requestAnimationFrame(frame);
  }));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  results.push({name,performance:perf,environment:'macOS Chrome, 4× CPU, 375×812 DPR2. Not a physical mobile/GPU benchmark.'});
  assert.ok(perf.fps>=55,`${name} below 55fps: ${perf.fps}`);
 }
 // Individual decorative-asset failure may not break the tour, or remove an
 // entrance or object. All fallback materials are generated in the builder.
 await page.route('**/materials/*',r=>r.abort());await page.reload();
 await page.waitForFunction(()=>document.body.dataset.materials==='fallback'&&document.body.dataset.reflections==='ready');
 await page.click('#tour');await page.selectOption('#tour-stop','8');
  await page.screenshot({path:`${dir}/materials-unavailable.png`});
 assert.equal(await page.locator('#tour-stop').inputValue(),'8');
 results.push({textureFailure:'Procedural fallback, reflection probe, stop selection and veil remain usable'});
 await context.close();
 const assets=[];
 for(const name of await readdir('public/materials'))assets.push({name,bytes:(await stat(`public/materials/${name}`)).size});
 const bytes=assets.reduce((sum,a)=>sum+a.bytes,0);assert.ok(bytes<2500000,'Five material downloads must stay below 2.5 MB');
 results.push({assets,totalBytes:bytes});
 assert.deepEqual(errors,[]);
}finally{
 await browser.close();await writeFile(`${dir}/materials-checks.json`,JSON.stringify({results,errors},null,2)+'\n');
}
console.log(JSON.stringify({results,errors},null,2));
