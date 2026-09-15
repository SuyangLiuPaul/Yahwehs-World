import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR||'handoff/evidence/phase-2/after';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const events=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:375,height:812}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.TEST_URL||'http://127.0.0.1:5175'}/tabernacle.html`);
 await page.waitForFunction(()=>document.body.dataset.laver==='ready');await page.click('#tour');
 const start=Date.now();let previous='';
 while(Date.now()-start<150000){
  const index=await page.locator('#tour-stop').inputValue();
  if(index!==previous){previous=index;events.push({stop:Number(index)+1,elapsedMs:Date.now()-start});console.log(`Tour reached stop ${Number(index)+1}/10`);}
  if((await page.locator('#tour-toggle').textContent())==='↺')break;
  await page.waitForTimeout(900);
 }
 assert.equal(await page.locator('#tour-toggle').textContent(),'↺','Tour never reached replay state');
 assert.deepEqual(events.map(e=>e.stop),[1,2,3,4,5,6,7,8,9,10]);
 await page.screenshot({path:`${dir}/phone-en-tour-completed.png`});
 await page.click('#tour-toggle');assert.equal(await page.locator('#tour-stop').inputValue(),'0');
 await page.click('#walk-exit');assert.ok(await page.locator('#gate').isVisible());assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(`${dir}/tour-playback.json`,JSON.stringify({events,errors},null,2)+'\n');}
