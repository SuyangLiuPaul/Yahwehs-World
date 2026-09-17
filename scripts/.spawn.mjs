import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:5175/temple.html');
await page.waitForFunction(() => !!globalThis.__temple, null, { timeout: 40000 });
await page.evaluate(() => Promise.all([__temple.ready, __temple.materialsReady]));
// What a visitor sees the moment they choose "walk it myself".
await page.evaluate(() => { document.getElementById('gate').classList.add('hidden'); document.getElementById('hud').hidden = false; });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/shots/spawn.png' });
// …and where the tour leaves them now.
await page.evaluate(() => { const W = globalThis.__temple; W.startTour(); W.inspectStop(W.TOUR.length - 1); W.endTour(); });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/shots/after-tour.png' });
console.log(await page.evaluate(() => {
  const p = globalThis.__temple.walker.position, c = globalThis.__temple.CUBIT;
  return { x: +(p.x / c).toFixed(0), z: +(p.z / c).toFixed(0), eye: +p.y.toFixed(2) };
}));
await b.close();
