import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR??'handoff/evidence/phase-4/performance';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2});const page=await context.newPage(),report={};
try{
 await page.goto('http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__globe);
 await page.evaluate(()=>{__globe.openRoute('exodus-wilderness');__globe.seekStop(12);});await page.waitForTimeout(600);
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const sample=()=>page.evaluate(()=>new Promise(resolve=>{const frames=[];let start=performance.now(),last=start;const tick=now=>{frames.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(tick);else{const sorted=[...frames].sort((a,b)=>a-b);resolve({fps:frames.length*1000/(now-start),p95:sorted[Math.floor(sorted.length*.95)],globe:__globe.renderer.info.render,scene:window.__story?.renderer.info.render});}};requestAnimationFrame(tick);}));
 await page.click('#r-toggle');report.map=await sample();await page.click('#r-toggle');await page.click('#r-scene');await page.waitForSelector('#story-viewer[open]');await page.click('#story-play');report.camp=await sample();
 await page.click('#story-close');await page.evaluate(()=>{__globe.openRoute('elijah');__globe.seekStop(4);});await page.click('#r-scene');await page.waitForSelector('#story-viewer[open]');await page.locator('#story-scrub').evaluate(el=>{el.value='650';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#story-play');report.fire=await sample();
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 // Close/reopen uses the same bounded renderer and cached geometries.
 const memory=await page.evaluate(()=>({...__story.renderer.info.memory}));
 for(let i=0;i<8;i++){await page.click('#story-close');await page.click('#r-scene');await page.waitForSelector('#story-viewer[open]');}
 report.memory={before:memory,after:await page.evaluate(()=>({...__story.renderer.info.memory})),dialogs:await page.locator('#story-viewer').count()};
 assert.equal(report.memory.dialogs,1);assert.ok(report.memory.after.geometries<=memory.geometries+1);
 assert.ok(report.map.fps>=55);assert.ok(report.camp.fps>=55);assert.ok(report.fire.fps>=55);
 report.limit='Desktop Chrome 4× CPU throttle; not a physical Android/Safari/GPU certification.';
 await writeFile(`${dir}/performance.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
