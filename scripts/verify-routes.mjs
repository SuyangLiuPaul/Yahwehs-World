import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url=process.env.TEST_URL??'http://127.0.0.1:5175/';
const dir=process.env.EVIDENCE_DIR??'handoff/evidence/phase-1/after';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const measurements=[],errors=[];
const strict=process.env.EXPLORE!=='1';
function check(condition,message){if(strict)assert.ok(condition,message);else if(!condition)errors.push(message);}
try {
  for(const [name,width,height] of [['phone',375,812],['tablet',768,1024],['desktop',1440,900]]){
    for(const locale of ['en','zh']){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:name!=='desktop'});
      await context.addInitScript(l=>localStorage.setItem('ydh.locale',l),locale);
      const page=await context.newPage();
      const consoleErrors=[];
      page.on('pageerror',e=>consoleErrors.push(e.message));
      page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
      await page.goto(url);
      await page.waitForSelector('#loading.done');
      await page.evaluate(()=>document.fonts.ready);
      for(const route of ['exodus-wilderness','paul-1']){
        await page.click('#r-open');
        await page.click(`[data-id="${route}"]`);
        const count=route==='exodus-wilderness'?42:15;
        check(await page.locator('.r-step').count()===count,'Every narrated stop must be selectable');
        // Real clicks, no force: viewport and hit testing are part of the test.
        await page.locator('.r-step').last().click();
        // Production terrain arrives over a network; wait for its real state,
        // not an arbitrary delay that only works against localhost.
        await page.waitForFunction(()=>document.querySelector('#r-thumbnail').dataset.state==='ready');
        await page.waitForTimeout(650);
        const data=await page.evaluate(()=>{
          const labels=[...document.querySelectorAll('.rlab')].filter(e=>e.style.display!=='none').map(e=>({text:e.textContent,box:e.getBoundingClientRect().toJSON()}));
          const overlaps=[];
          labels.forEach((a,i)=>labels.slice(i+1).forEach(b=>{if(a.box.left<b.box.right&&a.box.right>b.box.left&&a.box.top<b.box.bottom&&a.box.bottom>b.box.top)overlaps.push([a.text,b.text]);}));
          const navBottom=Math.max(document.querySelector('.sitenav').getBoundingClientRect().bottom,document.querySelector('#map-tools').getBoundingClientRect().bottom);
          const card=document.querySelector('#r-card').getBoundingClientRect();
          const outside=labels.filter(l=>l.box.left<0||l.box.right>innerWidth||l.box.top<navBottom||l.box.bottom>card.top);
          const g=window.__globe;
          const markerOutside=g ? g.route.markerObjects.filter(o=>{const v=o.position.clone().applyMatrix4(g.globe.matrixWorld).project(g.camera);const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;return x<0||x>innerWidth||y<navBottom||y>card.top;}).map(o=>o.userData.marker.n) : [];
          const smallTargets=[...document.querySelectorAll('#r-card button')].filter(e=>{const b=e.getBoundingClientRect();return b.width<44||b.height<44;}).map(e=>e.id||e.textContent);
          const thumb=document.querySelector('#r-thumbnail').getContext('2d').getImageData(0,0,160,90).data;
          const colors=new Set();for(let i=0;i<thumb.length;i+=400)colors.add(thumb.slice(i,i+3).join(','));
          return {labels:labels.length,names:labels.map(l=>l.text),overlaps,outside,markerOutside,smallTargets,thumbnailColors:colors.size,
            cardHeight:card.height,cardRatio:card.height/innerHeight,readout:document.querySelector('#r-stop').textContent,
            activeDot:document.querySelector('.r-step[aria-current="step"]').dataset.stop,
            camera:window.__globe?.camera.position.toArray(),drawCalls:window.__globe?.renderer.info.render.calls};
        });
        measurements.push({name,locale,route,...data});
        check(!data.overlaps.length,`${name}/${locale}/${route}: overlapping labels`);
        check(!data.outside.length,`${name}/${locale}/${route}: labels outside safe band`);
        check(!data.markerOutside.length,`${name}/${locale}/${route}: route markers behind controls ${data.markerOutside}`);
        check(!data.smallTargets.length,`${name}/${locale}: targets smaller than 44px`);
        check(data.thumbnailColors>8,`${name}/${locale}: empty terrain thumbnail`);
        check(data.activeDot===String(count),'Last stop selector must stay active');
        if(name==='phone')check(data.cardRatio<=.26,'Player must use at most 26% of phone height');
        if(route==='exodus-wilderness')check(data.labels>=(name==='phone'?12:name==='tablet'?16:6),`${name}/${locale}: Exodus label density ${data.labels}`);
        await page.screenshot({path:`${dir}/${name}-${locale}-${route}.png`});
        // Sources are available on phones, including every merged camp.
        await page.click('#r-info');
        check(await page.locator('#r-source-stops li').count()===count,'Source list lost a camp');
        await page.screenshot({path:`${dir}/${name}-${locale}-${route}-sources.png`});
        await page.click('#r-sources-close');
        await page.locator('.r-step').nth(2).click();
        await page.waitForTimeout(250);
        await page.screenshot({path:`${dir}/${name}-${locale}-${route}-stop-3.png`});
        // Live rAF playback, not a manually advanced dev handle.
        const before=await page.evaluate(()=>({camera:window.__globe?.camera.position.toArray(),t:window.__globe?.routeT}));
        await page.click('#r-toggle');
        // Exodus now completes an explicit camp/packing pause before travel.
        await page.waitForTimeout(route==='exodus-wilderness'?3300:1200);
        const after=await page.evaluate(()=>({camera:window.__globe?.camera.position.toArray(),t:window.__globe?.routeT}));
        if(before.camera){check(after.t>before.t,`${name}/${locale}/${route}: real frames did not advance after camp dwell (${before.t} → ${after.t})`);assert.ok(Math.hypot(...after.camera.map((v,i)=>v-before.camera[i]))<1e-8,'Playback moved the camera');}
        await page.click('#r-toggle');
        await page.click('#r-clear');
      }
      check(!consoleErrors.length,`${name}/${locale}: console errors ${consoleErrors.join('; ')}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${dir}/measurements.json`,JSON.stringify({url,measurements,errors},null,2)+'\n');
}
console.log(JSON.stringify({measurements:measurements.map(({name,locale,route,labels,overlaps,cardHeight,thumbnailColors,drawCalls})=>({name,locale,route,labels,overlaps,cardHeight,thumbnailColors,drawCalls})),errors},null,2));
