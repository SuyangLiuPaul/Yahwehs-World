import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR||'handoff/evidence/phase-1/navigation';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
try{
  for(const [name,width,height] of [['phone',375,812],['tablet',768,1024],['desktop',1440,900]]){
    for(const locale of ['en','zh']){
      const context=await browser.newContext({viewport:{width,height}});
      await context.addInitScript(l=>localStorage.setItem('ydh.locale',l),locale);
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      for(const surface of ['structures','tabernacle']){
        await page.goto(`http://127.0.0.1:5175/${surface}.html`);
        await page.waitForFunction(s=>Boolean(s==='structures'?window.__structures:window.__walk),surface);
        await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(450);
        const credit=await page.locator('.source-credit').innerText();assert.ok(credit.includes('OpenBible.info')&&credit.includes('CC BY 4.0'));
        const rect=await page.locator('.source-credit').boundingBox();assert.ok(rect.y+rect.height<=height+1);
        await page.screenshot({path:`${dir}/${name}-${locale}-${surface}.png`});
        // The credits reserve space below the controls, including during a tour.
        if(surface==='tabernacle'){
          await page.click('#tour');await page.waitForTimeout(600);
          const hud=await page.locator('#hud').boundingBox();assert.ok(hud.y+hud.height<=rect.y+1);
          await page.screenshot({path:`${dir}/${name}-${locale}-tour-entry.png`});
        }else{
          const control=await page.locator('#cubit').boundingBox();assert.ok(control.y+control.height<=rect.y+1);
        }
        report.push({name,locale,surface,creditVisible:true,controlOverlap:false,errors:[...errors]});
      }
      assert.deepEqual(errors,[]);await context.close();
    }
  }
}finally{await browser.close();await writeFile(`${dir}/checks.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
