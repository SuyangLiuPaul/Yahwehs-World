import { chromium } from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
const phase=process.env.WALK_PHASE||'before';
// Which walk: the tabernacle by default; WALK_PAGE=temple.html WALK_HANDLE=__temple
// captures the temple's tour the same way, so both walks are judged from the
// same camera positions a reader actually reaches.
const walkPage=process.env.WALK_PAGE||'tabernacle.html';
const handle=process.env.WALK_HANDLE||'__walk';
const dir=process.env.EVIDENCE_DIR||`handoff/evidence/phase-2/${phase}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const metrics=[];
try{
 for(const [name,width,height] of [['desktop',1440,900],['phone',375,812],['tablet',768,1024]]){
  for(const locale of (process.env.QUICK?['en']:['en','zh'])){
   const context=await browser.newContext({viewport:{width,height}});
   await context.addInitScript(l=>localStorage.setItem('ydh.locale',l),locale);
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:5175/${walkPage}`);
   await page.waitForFunction(h=>window[h],handle);await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(h=>Promise.all([window[h].ready,window[h].materialsReady]),handle);
   await page.click('#tour');
   const count=await page.evaluate(h=>window[h].TOUR.length,handle);
   for(let i=0;i<count;i++){
    await page.evaluate(({i,h})=>{
     const w=window[h],s=w.TOUR[i],c=w.CUBIT;w.tour.stop();
     w.walker.setPose({x:s.x*c,z:s.z*c,yaw:Math.atan2(-(s.at.x-s.x),-(s.at.z-s.z)),
      pitch:s.atY===undefined?(s.pitch||0):Math.atan2(s.atY*c-1.65,Math.hypot(s.at.x-s.x,s.at.z-s.z)*c)});
     w.tour.onStop?.(s,i,w.TOUR.length);w.updateHud();
    },{i,h:handle});
    await page.waitForTimeout(350);
    await page.screenshot({path:`${dir}/${name}-${locale}-walk-${String(i+1).padStart(2,'0')}.png`});
    metrics.push(await page.evaluate(({name,locale,i,h})=>({name,locale,stop:i+1,counts:window[h].counts,render:window[h].renderer.info.render}),{name,locale,i,h:handle}));
   }
   if(errors.length)throw Error(errors.join('\n'));await context.close();
  }
 }
}finally{await browser.close();await writeFile(`${dir}/walk-metrics.json`,JSON.stringify(metrics,null,2)+'\n');}
console.log(`Saved ${metrics.length} actual tour views to ${dir}`);
