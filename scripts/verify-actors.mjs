import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR??'handoff/evidence/phase-4/local';await mkdir(dir,{recursive:true});
const url=process.env.TEST_URL??'http://127.0.0.1:5175/';
const browser=await chromium.launch({channel:'chrome',headless:true});const report={cases:[],errors:[]};
try{
 for(const [name,width,height] of [['phone',375,812],['tablet',768,1024],['desktop',1440,900]])for(const lang of ['en','zh']){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:name==='phone'});
  await context.addInitScript(l=>localStorage.setItem('ydh.locale',l),lang);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
  await page.goto(url);await page.waitForSelector('#loading.done');await page.evaluate(()=>document.fonts.ready);
  const choose=async id=>{if(await page.locator('#r-clear').isVisible())await page.click('#r-clear');await page.click('#r-open');await page.click(`[data-id="${id}"]`);};
  for(const id of ['paul-1','exodus-wilderness','elijah']){
   await choose(id);
   const camera=await page.evaluate(()=>window.__globe?.camera.position.toArray());
   if(id==='exodus-wilderness')await page.locator('.r-step[data-stop="12"]').click();
   if(id==='elijah')await page.locator('.r-step[data-stop="4"]').click();
   await page.waitForTimeout(500);
   await page.screenshot({path:`${dir}/${name}-${lang}-${id}-map.png`});
   await page.click('#r-scene');await page.waitForSelector('#story-viewer[open]');
   const stories=id==='elijah'?['carmel','flight','whirlwind']:id==='paul-1'?['sailing']:['camp'];
   for(const story of stories){
    if(stories.length>1)await page.click(`[data-story="${story}"]`);
    // Scrub real controls; production has no debug handle.
    const fractions={sailing:.40,camp:.33,carmel:.72,flight:.45,whirlwind:.56};
    await page.locator('#story-scrub').evaluate((el,value)=>{el.value=String(value*1000);el.dispatchEvent(new Event('input',{bubbles:true}));},fractions[story]);
    await page.waitForTimeout(150);
    await page.screenshot({path:`${dir}/${name}-${lang}-${story}-scene.png`});
    const progressBefore=Number(await page.locator('#story-scrub').inputValue());
    await page.click('#story-play');await page.waitForTimeout(350);await page.click('#story-play');
    const progressAfter=Number(await page.locator('#story-scrub').inputValue());
    assert.ok(progressAfter>progressBefore,`${name}/${lang}/${story}: real scene playback did not advance`);
    await page.waitForTimeout(150);assert.equal(Number(await page.locator('#story-scrub').inputValue()),progressAfter,'Paused scene progress changed');
    const metrics=await page.evaluate(()=>{
     const canvas=document.querySelector('#story-canvas').getBoundingClientRect(),dialog=document.querySelector('#story-viewer');
     const controls=['story-close','story-play','story-replay','story-reset','story-lang'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,width:r.width,height:r.height};});
     return {canvas:{width:canvas.width,height:canvas.height},overflow:dialog.scrollWidth>dialog.clientWidth+1,controls,state:window.__story?.snapshot()};
    });
    assert.equal(metrics.overflow,false);assert.ok(metrics.canvas.width>200&&metrics.canvas.height>=300);
    metrics.controls.forEach(c=>assert.ok(c.width>=44&&c.height>=44,JSON.stringify(c)));
    report.cases.push({viewport:name,lang,story,...metrics});
   }
   await page.click('#story-close');assert.equal(await page.locator('#story-viewer').evaluate(d=>d.open),false);
   if(camera){const actual=await page.evaluate(()=>window.__globe.camera.position.toArray());assert.ok(Math.hypot(...actual.map((v,i)=>v-camera[i]))<1e-8,'Inspector moved map camera');}
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);
 await writeFile(`${dir}/actors.json`,JSON.stringify(report,null,2));console.log(`${report.cases.length} scene/viewport/locale cases passed`);
}finally{await browser.close();}
