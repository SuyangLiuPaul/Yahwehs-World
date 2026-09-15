import { chromium } from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
const phase=process.env.WALK_PHASE||'before';
const dir=`handoff/evidence/phase-2/${phase}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const metrics=[];
try{
 for(const [name,width,height] of [['desktop',1440,900],['phone',375,812],['tablet',768,1024]]){
  for(const locale of (process.env.QUICK?['en']:['en','zh'])){
   const context=await browser.newContext({viewport:{width,height}});
   await context.addInitScript(l=>localStorage.setItem('ydh.locale',l),locale);
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:5175/tabernacle.html');
   await page.waitForFunction(()=>window.__walk);await page.evaluate(()=>document.fonts.ready);
   await page.click('#tour');
   const count=await page.evaluate(()=>window.__walk.TOUR.length);
   for(let i=0;i<count;i++){
    await page.evaluate(i=>{
     const w=window.__walk,s=w.TOUR[i],c=w.CUBIT;w.tour.stop();
     w.walker.setPose({x:s.x*c,z:s.z*c,yaw:Math.atan2(-(s.at.x-s.x),-(s.at.z-s.z)),
      pitch:s.atY===undefined?(s.pitch||0):Math.atan2(s.atY*c-1.65,Math.hypot(s.at.x-s.x,s.at.z-s.z)*c)});
     w.tour.onStop?.(s,i,w.TOUR.length);w.updateHud();
    },i);
    await page.waitForTimeout(350);
    await page.screenshot({path:`${dir}/${name}-${locale}-walk-${String(i+1).padStart(2,'0')}.png`});
    metrics.push(await page.evaluate(({name,locale,i})=>({name,locale,stop:i+1,counts:window.__walk.counts,render:window.__walk.renderer.info.render}),{name,locale,i}));
   }
   if(errors.length)throw Error(errors.join('\n'));await context.close();
  }
 }
}finally{await browser.close();await writeFile(`${dir}/walk-metrics.json`,JSON.stringify(metrics,null,2)+'\n');}
console.log(`Saved ${metrics.length} actual tour views to ${dir}`);
