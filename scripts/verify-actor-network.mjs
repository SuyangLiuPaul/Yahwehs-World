import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR??'handoff/evidence/phase-4/network';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const report={};
try{
 const p=await browser.newPage({viewport:{width:375,height:812}});
 await p.route('**/journey-actors/viewer.ts*',r=>r.abort());await p.goto('http://127.0.0.1:5175/');await p.waitForFunction(()=>window.__globe);await p.evaluate(()=>__globe.openRoute('paul-1'));await p.click('#r-scene');
 await p.waitForSelector('#r-scene-message:not([hidden])');assert.equal(await p.locator('#story-viewer').count(),0);await p.click('#r-toggle');await p.waitForTimeout(500);assert.ok(await p.evaluate(()=>__globe.routeT>0));report.moduleFailure='Visible error; map and playback remain usable';await p.screenshot({path:`${dir}/module-failure.png`});await p.close();
 const q=await browser.newPage({viewport:{width:375,height:812}});await q.route('**/materials/desert-ground-v1.webp',r=>r.abort());await q.goto('http://127.0.0.1:5175/');await q.waitForFunction(()=>window.__globe);await q.evaluate(()=>{__globe.openRoute('exodus-wilderness');__globe.seekStop(12);});await q.click('#r-scene');await q.waitForSelector('#story-viewer[open]');await q.click('#story-play');await q.waitForTimeout(600);assert.ok(await q.evaluate(()=>__story.snapshot().time>.3));report.textureFailure='Original ochre fallback, animation still works';await q.screenshot({path:`${dir}/texture-fallback.png`});await q.close();
 await writeFile(`${dir}/network.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
