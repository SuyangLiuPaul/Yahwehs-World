import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR||'handoff/evidence/phase-2/after';await mkdir(dir,{recursive:true});
const url=process.env.TEST_URL||'http://127.0.0.1:5175';
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[],errors=[];
try{
 for(const [name,width,height] of [['phone',375,812],['tablet',768,1024],['desktop',1440,900]]){
  for(const locale of ['en','zh']){
   const context=await browser.newContext({viewport:{width,height},hasTouch:name!=='desktop'});
   await context.addInitScript(l=>localStorage.setItem('ydh.locale',l),locale);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${url}/tabernacle.html`);await page.waitForFunction(()=>document.body.dataset.laver==='ready');
   await page.evaluate(()=>document.fonts.ready);
   await page.click('#tour');await page.click('#tour-toggle');
   const stopBefore=await page.locator('#tour-stop').inputValue();
   await page.waitForTimeout(450);assert.equal(await page.locator('#tour-stop').inputValue(),stopBefore);
   await page.click('#tour-toggle');assert.equal(await page.locator('#tour-stop').inputValue(),stopBefore);
   for(let i=0;i<10;i++){
    await page.selectOption('#tour-stop',String(i));
    const wrong=await page.evaluate(()=>Array.from(document.querySelectorAll('#hud button,#hud select')).filter(e=>{
     const b=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&(b.width<44||b.height<44||b.left<0||b.right>innerWidth||b.bottom>innerHeight-39);
    }).map(e=>e.id));assert.deepEqual(wrong,[],`${name}/${locale}: HUD control bounds`);
    assert.equal(await page.locator('#tour-stop').inputValue(),String(i));
   }
   await page.click('#tour-prev');assert.equal(await page.locator('#tour-stop').inputValue(),'8');
   await page.click('#tour-next');assert.equal(await page.locator('#tour-stop').inputValue(),'9');
   await page.click('#model-info');assert.ok(await page.locator('#assumptions').isVisible());
   await page.screenshot({path:`${dir}/${name}-${locale}-evidence.png`});
   await page.click('.dialog-close');await page.click('#walk-exit');assert.ok(await page.locator('#gate').isVisible());
   results.push({name,locale,stops:10,model:'ready',controls:'44px and in bounds',pauseResume:'same stop',previousNext:'pass',evidence:'pass',exit:'pass'});
   await context.close();
  }
 }
 // Honest, repeatable CPU-emulated measurement, not a physical phone claim.
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2});const page=await context.newPage();
 await page.goto('http://127.0.0.1:5175/tabernacle.html');await page.waitForFunction(()=>window.__walk&&document.body.dataset.laver==='ready');
 await page.click('#tour');await page.selectOption('#tour-stop','5');
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const perf=await page.evaluate(()=>new Promise(resolve=>{let last=performance.now(),start=last;const samples=[];
  function frame(now){samples.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(frame);else{const s=samples.slice(1).sort((a,b)=>a-b);resolve({fps:samples.length*1000/(now-start),p95FrameMs:s[Math.floor(s.length*.95)],render:window.__walk.renderer.info.render,geometry:window.__walk.renderer.info.memory.geometries,textures:window.__walk.renderer.info.memory.textures});}}requestAnimationFrame(frame);
 }));
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 results.push({performance:perf,environment:'macOS headless Chrome, 4× CPU, 375×812 DPR2; not a physical Android'});
 assert.ok(perf.fps>=55,`Walk below target: ${perf.fps}`);
 // Failed optional GLB leaves a readable bronze-basin fallback, not a broken page.
 await page.route('**/models/laver.glb',r=>r.abort());await page.reload();await page.waitForFunction(()=>document.body.dataset.laver==='fallback');
 await page.click('#tour');await page.selectOption('#tour-stop','3');await page.screenshot({path:`${dir}/phone-en-laver-fallback.png`});
 results.push({modelFailure:'procedural fallback remains usable'});
 await context.close();assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(`${dir}/walk-checks.json`,JSON.stringify({results,errors},null,2)+'\n');}
console.log(JSON.stringify({results,errors},null,2));
