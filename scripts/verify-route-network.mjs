import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
  for(const mode of ['delayed','failed']){
    const context=await browser.newContext({viewport:{width:375,height:812}});
    const page=await context.newPage();
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    await page.route('**/data/terrain-color.webp',async route=>{
      if(mode==='failed'){await route.abort();return;}
      await gate;
      await route.fulfill({path:'public/data/terrain-color.webp',contentType:'image/webp'});
    });
    await page.goto('http://127.0.0.1:5175/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#loading.done');
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#loading')).opacity)<.01);
    await page.click('#r-open');await page.click('[data-id="exodus-wilderness"]');
    await page.locator('.r-step[data-stop="6"]').click();
    const camera=await page.evaluate(()=>window.__globe.camera.position.toArray());
    await page.waitForFunction(expected=>document.querySelector('#r-thumbnail').dataset.state===expected,mode==='delayed'?'loading':'error');
    assert.ok(await page.locator(mode==='delayed'?'.r-loading':'.r-error').isVisible());
    await page.screenshot({path:`handoff/evidence/phase-1/after/phone-en-terrain-${mode}.png`});
    // Navigation stays responsive even when the texture cannot arrive.
    await page.locator('.r-step[data-stop="12"]').click();
    assert.equal(await page.locator('.r-step[aria-current="step"]').getAttribute('data-stop'),'12');
    if(mode==='delayed'){
      release();
      await page.waitForFunction(()=>document.querySelector('#r-thumbnail').dataset.state==='ready');
      assert.equal(await page.locator('#r-thumbnail').getAttribute('aria-busy'),'false');
    }
    assert.deepEqual(await page.evaluate(()=>window.__globe.camera.position.toArray()),camera);
    results.push({mode,navigationResponsive:true,cameraStationary:true,thumbnail:mode==='delayed'?'ready after release':'explicit unavailable state'});
    await context.close();
  }
}finally{
  await browser.close();
  await writeFile('handoff/evidence/phase-1/after/network.json',JSON.stringify(results,null,2)+'\n');
}
console.log(JSON.stringify(results,null,2));
