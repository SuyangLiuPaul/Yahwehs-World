import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR??'handoff/evidence/phase-4/behavior';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2,hasTouch:true});const page=await context.newPage();const report={},errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
 await page.goto('http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__globe);
 report.camp=await page.evaluate(async()=>{
  const {CampPlayback}=await import('/src/journey-actors/camp-playback.ts');__globe.openRoute('exodus-wilderness');const clock=new CampPlayback(__globe.route),visited=new Set(),phases=new Set();let prior=0,maxSpeedError=0,frames=0;
  while(!clock.done&&frames++<6000){const was=clock.travelling,t=clock.t;clock.advance(.05);visited.add(clock.ordinal);phases.add(clock.phase);if(clock.t<prior)throw Error('route reversed');prior=clock.t;
    if(was&&clock.travelling)maxSpeedError=Math.max(maxSpeedError,Math.abs(clock.t-t-.05/67.2));}
  return {visited:[...visited],phases:[...phases],maxSpeedError,done:clock.done,t:clock.t,frames};
 });
 assert.deepEqual(report.camp.visited,Array.from({length:42},(_,i)=>i+1));assert.ok(report.camp.done);assert.equal(report.camp.t,1);assert.ok(report.camp.maxSpeedError<1e-9);
 await page.locator('.r-step[data-stop="42"]').click();await page.locator('.r-step[data-stop="7"]').click();await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>__globe.staffage.group.visible),false,'Unlocated camp received actors');
 await page.click('#r-toggle');await page.waitForTimeout(300);
 assert.equal(await page.locator('.r-step[aria-current="step"]').getAttribute('data-stop'),'7','Resume at an unlocated camp restarted the journey');await page.click('#r-toggle');
 await page.screenshot({path:`${dir}/phone-unlocated.png`});
 await page.locator('.r-step[data-stop="12"]').click();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>__globe.staffage.state.tents),3);
 await page.screenshot({path:`${dir}/phone-camp.png`});
 const camera=await page.evaluate(()=>__globe.camera.position.toArray());await page.click('#r-toggle');await page.waitForTimeout(1300);await page.click('#r-toggle');
 await page.screenshot({path:`${dir}/phone-packing.png`});
 const matrices=()=>page.evaluate(()=>__globe.staffage.group.children[0].children.filter(m=>m.visible).map(m=>Array.from(m.instanceMatrix.array).slice(0,m.count*16)));
 const before=await matrices();await page.waitForTimeout(400);assert.deepEqual(await matrices(),before,'Paused actors keep moving');
 assert.ok(await page.evaluate(c=>__globe.camera.position.distanceTo({x:c[0],y:c[1],z:c[2]})<1e-8,camera),'Map camera followed camp');
 await page.click('#r-clear');await page.click('#r-open');await page.click('[data-id="paul-1"]');await page.locator('.r-step[data-stop="2"]').click();await page.click('#r-toggle');
 await page.waitForFunction(()=>__globe.staffage.state.mode==='sailing');await page.click('#r-toggle');await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>__globe.staffage.state.ship),1);assert.equal(await page.evaluate(()=>__globe.staffage.state.people),3);
 await page.screenshot({path:`${dir}/phone-sailing.png`});
 const sourceT=await page.evaluate(()=>__globe.routeT);
 await page.click('#r-scene');await page.waitForSelector('#story-viewer[open]');await page.click('#story-play');await page.waitForTimeout(800);await page.click('#story-play');
 const scene=await page.evaluate(()=>__story.snapshot());assert.ok(scene.time>.5);await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>__story.snapshot())).time,scene.time);
 assert.equal(await page.evaluate(()=>__globe.routeT),sourceT,'Inspector advanced map route');
 // User orbit changes only the inspector, and reset is explicit.
 const original=await page.evaluate(()=>__story.camera.position.toArray());await page.mouse.move(150,210);await page.mouse.down();await page.mouse.move(210,245,{steps:12});await page.mouse.up();
 assert.notDeepEqual(await page.evaluate(()=>__story.camera.position.toArray()),original);await page.click('#story-reset');
 await page.click('#story-lang');assert.equal(await page.locator('#story-title').textContent(),'与保罗一同渡海');assert.match(await page.locator('#story-context').textContent(),/保罗/);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#story-viewer').evaluate(d=>d.open),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'r-scene');
 report.playPauseOrbitLocale='passed';report.errors=errors;assert.deepEqual(errors,[]);
 // Deterministic stage semantics, without hiding defects behind a flattering pose.
 await page.evaluate(()=>{__globe.openRoute('elijah');__globe.seekStop(4);});await page.click('#r-scene');await page.waitForSelector('#story-viewer[open]');
 report.stages=await page.evaluate(()=>{
  const scrub=f=>{const s=document.getElementById('story-scrub');s.value=String(f*1000);s.dispatchEvent(new Event('input',{bubbles:true}));return __story.snapshot();};
  const stones=scrub(.15),water=scrub(.3),fire=scrub(.72),consumed=scrub(1);
  document.querySelector('[data-story="whirlwind"]').click();const ascent=scrub(.62),end=scrub(1);
  return {stones,water,fire,consumed,ascent,end};
 });
 assert.equal(report.stages.stones.pieces.stone,12);assert.equal(report.stages.water.pieces.water,56);assert.equal(report.stages.water.pieces.jar,4);assert.equal(report.stages.fire.pieces.flame,18);assert.equal(report.stages.consumed.pieces.stone,0);
 assert.equal(report.stages.ascent.pieces.horse,2);assert.equal(report.stages.ascent.pieces.whirl,1);assert.equal(report.stages.end.pieces.person,1);assert.equal(report.stages.end.pieces.cloak,1);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.click('#story-close');await page.click('#r-clear');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__globe.staffage.group.visible),false);
 await writeFile(`${dir}/behavior.json`,JSON.stringify(report,null,2));console.log('All 42 camps, constant travel speed, unlocated suppression, ship passengers, pause/orbit/locale, and scene counts passed');
}finally{await browser.close();}
