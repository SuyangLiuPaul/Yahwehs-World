import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2,hasTouch:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report={};
const position=()=>page.evaluate(()=>window.__globe.camera.position.toArray());
const same=(a,b,message)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-5,message);
try{
  await page.goto('http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__globe);
  await page.evaluate(()=>document.fonts.ready);
  report.path=await page.evaluate(async()=>{
    const {RoutePath}=await import('/src/route-path.ts');
    const {lonLatToVec3}=await import('/src/globe.ts');
    const {journeys}=await (await fetch('/data/journeys.json')).json();
    let maxEndpointError=0,maxUniformSpeedError=0,totalLegs=0;
    const failures=[];
    for(const j of journeys){
      const p=new RoutePath(j);totalLegs+=p.legs.length;
      for(const [i,m] of j.markers.entries()){
        if(m.aside){if(Number.isFinite(p.markerT[i]))failures.push('aside entered progression: '+j.id);continue;}
        if(m.lon===null||m.lat===null)continue;
        const expect=lonLatToVec3(m.lon,m.lat,.16);
        // A gap has two endpoints at the same travelled-distance parameter.
        // Explicit stop navigation (checked below) resolves that ambiguity.
        if(p.markerT.filter(t=>Math.abs(t-p.markerT[i])<1e-10).length===1){
          const actual=p.sample(p.markerT[i],expect.clone());
          maxEndpointError=Math.max(maxEndpointError,expect.distanceTo(actual));
        }
      }
      for(const l of p.legs){
        const a=p.sample(l.from+(l.to-l.from)*.2,l.a.clone());
        const b=p.sample(l.from+(l.to-l.from)*.4,l.a.clone());
        maxUniformSpeedError=Math.max(maxUniformSpeedError,Math.abs(a.angleTo(b)-l.angle*.2));
        if(l.sea!==(j.markers[l.endMarker].leg==='sea'))failures.push('arrival mode mismatch: '+j.id);
      }
    }
    const first=journeys.find(j=>j.id==='paul-1');
    const p=new RoutePath(first);
    const visitChecks={first:p.markerT[0],last:p.markerT.at(-1),startReached:p.reached(0),endReached:p.reached(1)};
    const template=first.markers[0];
    const synthetic={...first,markers:[
      {...template,lon:0,lat:0,stops:[1]}, {...template,lon:1,lat:0,stops:[2],leg:'sea'},
      {...template,lon:null,lat:null,stops:[3]}, {...template,lon:30,lat:0,stops:[4]},
      {...template,lon:31,lat:0,stops:[5],leg:'land'}],segments:[[[0,0],[1,0]],[[30,0],[31,0]]]};
    const gap=new RoutePath(synthetic);
    const before=gap.sample(.5-1e-6,lonLatToVec3(0,0)),after=gap.sample(.5+1e-6,before.clone());
    return {totalLegs,maxEndpointError,maxUniformSpeedError,failures,visitChecks,
      gapLegs:gap.legs.length,gapJumpDegrees:before.angleTo(after)*180/Math.PI,missingT:Number.isNaN(gap.markerT[2])};
  });
  assert.deepEqual(report.path.failures,[]);
  assert.ok(report.path.maxEndpointError<1e-7,'Head misses a stop at its own progress parameter');
  assert.ok(report.path.maxUniformSpeedError<1e-9,'Head speed differs from distance scale');
  assert.deepEqual(report.path.visitChecks,{first:0,last:1,startReached:0,endReached:14});
  assert.equal(report.path.gapLegs,2);assert.ok(report.path.gapJumpDegrees>28);assert.ok(report.path.missingT);

  // Starting a route while verse playback is running must revoke its camera.
  await page.click('#t-play');await page.click('#r-open');await page.click('[data-id="exodus-wilderness"]');
  assert.equal(await page.evaluate(()=>window.__globe.playing),false);
  const still=await position();await page.click('#r-toggle');await page.waitForTimeout(1200);
  same(still,await position(),'Verse follow or journey animation moved the camera');
  await page.click('#r-toggle');
  // All 42 rows, including the camps represented by one regional point.
  const stopFailures=[];
  for(let n=1;n<=42;n++){
    await page.locator(`.r-step[data-stop="${n}"]`).click();
    const row=await page.evaluate(async()=>{
      await new Promise(requestAnimationFrame);
      const n=Number(document.querySelector('.r-step[aria-current="step"]').dataset.stop);
      const r=window.__globe.route,m=r.journey.markers.find(m=>m.stops.includes(n));
      const {lonLatToVec3}=await import('/src/globe.ts');
      return {n:String(n),ref:document.querySelector('#r-ref').textContent,text:document.querySelector('#r-stop').textContent,
        futureLabels:[...document.querySelectorAll('.rlab')].filter(el=>el.style.display!=='none'&&Number(el.dataset.marker)>r.journey.markers.indexOf(m)).length,
        error:m.lon===null?0:r.headPosition.distanceTo(lonLatToVec3(m.lon,m.lat,.16)),unlocated:!document.querySelector('#r-unlocated').hidden};
    });
    if(row.n!==String(n)||!row.ref.startsWith('Numbers 33:'))stopFailures.push({n,row});
    assert.ok(row.error<1e-7,'Selected stop does not agree with its map position');
    assert.equal(row.futureLabels,0,'Selecting a stop marked a later camp as reached');
    assert.equal(row.unlocated,n===7,'Only the corrected Red Sea camp should be unlocated');
    if(n===7){
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.rlab.now').count(),0,'An unlocated camp must not highlight a different location');
      await page.screenshot({path:'handoff/evidence/phase-1/after/phone-en-unlocated-stop-7.png'});
      await page.click('.lang-switch');
      await page.screenshot({path:'handoff/evidence/phase-1/after/phone-zh-unlocated-stop-7.png'});
      await page.click('#r-info');
      await page.locator('#r-source-stops li').nth(6).scrollIntoViewIfNeeded();
      const close=await page.locator('#r-sources-close').boundingBox();
      assert.ok(close.y>=0 && close.y+close.height<812,'Sources close control disappeared while scrolling');
      await page.screenshot({path:'handoff/evidence/phase-1/after/phone-zh-unlocated-source.png'});
      await page.click('#r-sources-close');await page.click('.lang-switch');
    }
  }
  assert.deepEqual(stopFailures,[]);report.everyExodusStopChecked=42;
  // The user's view survives zooming, mobile toolbar resize and locale changes.
  await page.click('#map-in');
  await page.mouse.move(180,350);await page.mouse.down();await page.mouse.move(210,370,{steps:10});await page.mouse.up();
  // Let the deliberately enabled manual drag inertia settle before testing
  // resize. Its decay is user input, not a resize-triggered camera fit.
  await page.waitForTimeout(4500);
  const moved=await position();
  await page.setViewportSize({width:375,height:740});await page.waitForTimeout(200);
  same(moved,await position(),'Mobile resize reframed the route');
  await page.click('.lang-switch');await page.waitForTimeout(200);
  same(moved,await position(),'Locale switch reframed the route');
  await page.setViewportSize({width:375,height:812});await page.click('#map-fit');
  await page.locator('.r-step[data-stop="10"]').click();
  const reading=await page.locator('.r-reading').boundingBox();
  const cdp=await context.newCDPSession(page);
  const touch={x:reading.x+reading.width*.8,y:reading.y+reading.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x-70,y:touch.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('.r-step[aria-current="step"]').getAttribute('data-stop'),'11');
  report.touchSwipe='passed';
  report.cameraChecks=['verse playback stopped','live playback stationary','manual drag','resize stationary','locale stationary','explicit fit'];

  report.scale=await page.evaluate(async()=>{
    const g=window.__globe,{lonLatToVec3}=await import('/src/globe.ts');
    g.camera.up.set(0,1,0);g.camera.position.copy(lonLatToVec3(35.23,31.77,30));g.camera.lookAt(0,0,0);g.camera.updateMatrixWorld(true);
    const upright=g.measureMap(g.camera,innerWidth,innerHeight);
    const point=g.camera.position.clone().normalize();
    // Independent check: intersect rays through the scale's two pixel ends
    // and measure their angle, rather than reuse the implementation formula.
    const THREE=await import('/node_modules/three/build/three.module.js');
    const ray=new THREE.Raycaster();const sphere=new THREE.Sphere(new THREE.Vector3(),100);
    const sample=x=>{ray.setFromCamera(new THREE.Vector2(x,0),g.camera);return ray.ray.intersectSphere(sphere,new THREE.Vector3());};
    const a=sample(-upright.pixels/innerWidth),b=sample(upright.pixels/innerWidth);
    const actual=a.angleTo(b)*6371.0088;
    g.camera.up.applyAxisAngle(point,Math.PI/6);g.camera.lookAt(0,0,0);g.camera.updateMatrixWorld(true);
    const tilted=g.measureMap(g.camera,innerWidth,innerHeight);
    return {km:upright.km,actualKm:actual,relativeError:Math.abs(actual-upright.km)/upright.km,north:upright.bearing,tiltedNorth:tilted.bearing};
  });
  assert.ok(report.scale.relativeError<.05);assert.ok(Math.abs(report.scale.north)<5);assert.ok(Math.abs(report.scale.tiltedNorth)>20);
  await page.click('#r-clear');await page.click('#r-open');await page.click('[data-id="paul-1"]');
  await page.click('#r-toggle');await page.waitForTimeout(500);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  report.performance=await page.evaluate(()=>new Promise(resolve=>{
    const samples=[],start=performance.now();let last=start;
    function frame(now){samples.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(frame);else{
      const sorted=samples.slice(1).sort((a,b)=>a-b);resolve({environment:'Headless Chrome on macOS, 4x CPU throttle, 375x812 at DPR 2; not a physical Android',frames:samples.length,elapsedMs:now-start,fps:samples.length*1000/(now-start),p95FrameMs:sorted[Math.floor(sorted.length*.95)],drawCalls:window.__globe.renderer.info.render.calls,triangles:window.__globe.renderer.info.render.triangles});}}
    requestAnimationFrame(frame);
  }));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  assert.ok(report.performance.fps>=55,'CPU-throttled performance below 55fps');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(report,null,2));
} finally {
  await writeFile('handoff/evidence/phase-1/after/behavior.json',JSON.stringify({...report,errors},null,2)+'\n');
  await browser.close();
}
