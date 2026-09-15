import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const dir = process.env.EVIDENCE_DIR ?? 'handoff/evidence/phase-5/gestures';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { checks: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5175/');
  await page.waitForFunction(() => window.__globe);
  const pose = () => page.evaluate(() => ({ position: __globe.camera.position.toArray(), distance: __globe.camera.position.length(), selected: __globe.selected?.name, speed: __globe.controls.rotateSpeed }));
  const reset = async (radius = 125, lat = 31, lon = 35) => page.evaluate(async ({ radius, lat, lon }) => {
    const { lonLatToVec3 } = await import('/src/globe.ts');
    __globe.camera.position.copy(lonLatToVec3(lon, lat, radius - 100)); __globe.controls.update();
    __globe.camera.updateMatrixWorld(true); __globe.globe.updateMatrixWorld(true);
  }, { radius, lat, lon });
  const same = (a, b, message) => assert.ok(Math.hypot(...a.map((v, i) => v - b[i])) < 1e-7, message);
  const drag = async (steps, y = 0) => {
    await page.mouse.move(130, 300); await page.mouse.down();
    await page.mouse.move(170, 300 + y, { steps }); await page.mouse.up();
    return (await pose()).position;
  };
  await reset(); const one = await drag(1, 20);
  await reset(); const many = await drag(40, 20);
  same(one, many, 'Pointer event count changed the travel distance');
  report.checks.push('Mouse distance is independent of event count');

  // Loop back to where the gesture began: preserve the open reading panel.
  await reset();
  await page.evaluate(() => __globe.select(__globe.bundle.places.find(p => p.name === 'Jerusalem')));
  const selected = (await pose()).selected; assert.ok(selected);
  assert.equal(await page.evaluate(() => document.elementFromPoint(130, 200).id), 'stage');
  await page.mouse.move(130, 200); await page.mouse.down();
  await page.mouse.move(195, 230, { steps: 10 }); await page.mouse.move(130, 200, { steps: 10 }); await page.mouse.up();
  assert.equal((await pose()).selected, selected, 'A returning drag was treated as a click');
  report.checks.push('Returning drag does not close/open a place panel');

  const touch = async (type, touchPoints) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    // CDP acknowledges before Chrome dispatches a coalesced pointer move.
    await page.waitForTimeout(40);
  };
  // Two fingers apart zoom in without rotating. Releasing just one finger
  // must not click; the remaining finger can then drag without a jump.
  const before = await pose();
  await touch('touchStart', [{ x: 100, y: 200, id: 1 }, { x: 190, y: 200, id: 2 }]);
  await touch('touchMove', [{ x: 90, y: 200, id: 1 }, { x: 200, y: 200, id: 2 }]);
  const zoomed = await pose();
  assert.ok(zoomed.distance < before.distance && zoomed.distance >= 108);
  same(zoomed.position.map(v => v / zoomed.distance), before.position.map(v => v / before.distance), 'Pinch rotated the globe');
  await touch('touchEnd', [{ x: 200, y: 200, id: 2 }]);
  same((await pose()).position, zoomed.position, 'Lifting one finger jumped the camera');
  await touch('touchMove', [{ x: 105, y: 200, id: 1 }]);
  const moved = await pose();
  assert.ok(Math.hypot(...moved.position.map((v, i) => v - zoomed.position[i])) > .01);
  await touch('touchEnd', []); await page.waitForTimeout(250);
  same((await pose()).position, moved.position, 'Pinch-to-drag coasted on release');
  assert.equal((await pose()).selected, selected, 'Pinch release was treated as a tap');
  assert.equal(await page.locator('#stage').evaluate(el => el.classList.contains('dragging')), false);
  report.checks.push('Pinch zoom, one-finger transition, no release jump or accidental tap');

  // An OS interruption must not leave the cursor in its grabbing state.
  await touch('touchStart', [{ x: 130, y: 200, id: 3 }]);
  await touch('touchMove', [{ x: 150, y: 200, id: 3 }]);
  await touch('touchCancel', []);
  assert.equal(await page.locator('#stage').evaluate(el => el.classList.contains('dragging')), false);
  assert.equal((await pose()).selected, selected);
  await page.click('#panel-close');
  report.checks.push('Cancelled touch clears gesture state without selecting');

  // Real zoom buttons/wheel refresh sensitivity before the next drag.
  await page.click('#r-open'); await page.click('[data-id="paul-1"]');
  await reset(200); const speed = (await pose()).speed;
  await page.click('#map-in'); assert.ok((await pose()).speed < speed);
  await page.mouse.move(130, 300); const preWheel = await pose(); await page.mouse.wheel(0, 80); await page.waitForTimeout(100);
  assert.ok((await pose()).distance > preWheel.distance && (await pose()).speed > preWheel.speed);
  for (let i = 0; i < 16; i++) await page.click('#map-in');
  assert.ok(Math.abs((await pose()).distance - 108) < 1e-7);
  for (let i = 0; i < 24; i++) await page.click('#map-out');
  assert.ok(Math.abs((await pose()).distance - 600) < 1e-7);
  report.checks.push('Zoom buttons and wheel update drag gain; both zoom bounds hold');

  // Check north-up behavior near both poles and across ±180° longitude.
  for (const [lat, lon] of [[-89, 35], [0, 35], [89, 35], [31, -179.9], [31, 179.9]]) {
    await reset(125, lat, lon); await drag(20, lat > 0 ? -40 : 40);
    const p = await pose(); assert.ok(p.position.every(Number.isFinite));
    assert.ok(Math.abs(p.distance - 125) < 1e-7);
  }
  report.checks.push('Extreme latitudes and the date line remain finite and on the same orbit');

  // A real visible marker still opens a reading panel after the gestures.
  await page.click('#r-clear'); await reset();
  const point = await page.evaluate(() => {
    const g = __globe;
    return g.bundle.places.map(p => g.screenOf(p)).find(p => p.x > 55 && p.x < 300 && p.y > 240 && p.y < 440);
  });
  assert.ok(point); await page.mouse.click(point.x, point.y);
  assert.ok((await pose()).selected, 'A genuine click no longer selects markers');
  await page.click('#panel-close');
  await touch('touchStart', [{ x: point.x, y: point.y, id: 4 }]);
  await touch('touchEnd', []);
  assert.ok((await pose()).selected, 'A genuine touch no longer selects markers');
  report.checks.push('Genuine mouse and touch taps still open place details');
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: `${dir}/phone-marker-tap.png` });
} finally {
  await browser.close();
  await writeFile(`${dir}/gestures.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
