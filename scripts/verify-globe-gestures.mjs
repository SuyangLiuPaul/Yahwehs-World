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
  await page.goto((process.env.TEST_URL ?? 'http://127.0.0.1:5175') + '/');
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
  await page.click('#routes-open'); await page.click('[data-journey="paul-1"]');
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

  // Door cards sit over the globe. A press on one belongs to the globe from its first event; the card
  // opens only for a tap under 5 px and never on the tail of a drag. Touch-action must be none.
  await reset(); await page.waitForTimeout(800);
  const doorAt = () => page.evaluate(() => {
    const d = [...document.querySelectorAll('.door')].find(e => e.style.pointerEvents === 'auto' && !e.classList.contains('door--dot'));
    if (!d) return null; const r = d.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: d.getAttribute('href'), touchAction: getComputedStyle(d).touchAction };
  });
  const door = await doorAt(); assert.ok(door, 'No door card is visible at the test pose');
  assert.equal(door.touchAction, 'none');
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.door') !== null, door), true, 'The door is not the element under its own centre');
  const urlBefore = page.url(), startPose = (await pose()).position;
  await page.mouse.move(door.x, door.y); await page.mouse.down();
  await page.mouse.move(door.x + 40, door.y, { steps: 8 }); await page.mouse.up();
  const dragged = (await pose()).position;
  assert.ok(Math.hypot(...dragged.map((v, i) => v - startPose[i])) > .01, 'A mouse drag that began on a door did not turn the globe');
  await page.waitForTimeout(300); assert.equal(page.url(), urlBefore, 'A drag that began on a door opened it');
  await reset(); await page.waitForTimeout(800);
  const door2 = await doorAt(), start2 = (await pose()).position;
  await touch('touchStart', [{ x: door2.x, y: door2.y, id: 7 }]);
  await touch('touchMove', [{ x: door2.x + 30, y: door2.y + 6, id: 7 }]);
  await touch('touchEnd', []); await page.waitForTimeout(300);
  assert.ok(Math.hypot(...(await pose()).position.map((v, i) => v - start2[i])) > .01, 'A touch drag that began on a door did not turn the globe');
  assert.equal(page.url(), urlBefore, 'A touch drag that began on a door opened it');
  assert.equal((await pose()).selected, undefined, 'A drag from a door selected a marker');
  // A tap under 5 px opens the door; so does the keyboard. Each on a fresh page.
  for (const how of ['mouse', 'touch', 'keyboard']) {
    const p2 = await context.newPage();
    // Only the navigation is under test; do not load the walk pages (the dev server would broadcast their build errors).
    await p2.route(u => /\/(ark|tabernacle|temple)\.html$/.test(u.pathname), r => r.fulfill({ contentType: 'text/html', body: '<title>walk</title>' }));
    await p2.goto((process.env.TEST_URL ?? 'http://127.0.0.1:5175') + '/'); await p2.waitForFunction(() => window.__globe);
    await p2.evaluate(async () => { const { lonLatToVec3 } = await import('/src/globe.ts'); __globe.camera.position.copy(lonLatToVec3(35, 31, 25)); __globe.controls.update(); });
    await p2.bringToFront();
    await p2.waitForFunction(() => [...document.querySelectorAll('.door')].some(x => x.style.pointerEvents === 'auto' && !x.classList.contains('door--dot')), null, { timeout: 8000 });
    const d = await p2.evaluate(() => {
      const e = [...document.querySelectorAll('.door')].find(x => x.style.pointerEvents === 'auto' && !x.classList.contains('door--dot')); const r = e.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: e.getAttribute('href') };
    });
    const nav = p2.waitForURL('**' + d.href, { waitUntil: 'commit', timeout: 5000 });
    if (how === 'mouse') { await p2.mouse.move(d.x, d.y); await p2.mouse.down(); await p2.mouse.move(d.x + 3, d.y + 2); await p2.mouse.up(); }
    else if (how === 'touch') await p2.touchscreen.tap(d.x, d.y);
    else { await p2.evaluate(() => [...document.querySelectorAll('.door')].find(x => x.style.pointerEvents === 'auto' && !x.classList.contains('door--dot')).focus()); await p2.keyboard.press('Enter'); }
    await nav; await p2.close();
  }
  report.checks.push('Door cards: drags (mouse, touch) turn the globe and never open the card; taps and Enter open it');

  // The globe is reachable from the keyboard (apple-look › accessibility › Mobility).
  const stage = page.locator('#stage');
  assert.equal(await stage.getAttribute('tabindex'), '0');
  assert.equal(await stage.getAttribute('role'), 'application');
  assert.equal(await stage.getAttribute('aria-label'), 'Biblical world globe. Drag to turn it, scroll or pinch to zoom, arrow keys to turn, plus and minus to zoom, Home to fit the current route.');
  assert.equal(await stage.getAttribute('data-zh'), '圣经世界地球。拖动可转动，滚轮或双指可缩放；方向键转动，加减号缩放，Home 键回到当前路线。');
  assert.equal(await page.locator('#stage-help').textContent(), await stage.getAttribute('aria-label'));
  // Home = the route's own framing, the same pose "Fit route" gives.
  await page.click('#map-fit'); const fit = (await pose()).position;
  await stage.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp');
  assert.ok(Math.hypot(...(await pose()).position.map((v, i) => v - fit[i])) > .01, 'Arrow keys did not turn the globe');
  await page.keyboard.press('Home'); same((await pose()).position, fit, 'Home did not restore the route framing');
  await page.click('#r-clear'); await reset(); await page.waitForTimeout(600); await stage.focus();
  // One arrow press is exactly a 24 px drag (Shift: 120 px) at this altitude; nothing coasts afterwards.
  const dragBy = async (dx, dy) => { await reset(); await page.mouse.move(100, 400); await page.mouse.down(); await page.mouse.move(100 + dx, 400 + dy, { steps: 4 }); await page.mouse.up(); return (await pose()).position; };
  for (const [key, shift, dx, dy] of [['ArrowLeft', false, 24, 0], ['ArrowRight', false, -24, 0], ['ArrowUp', false, 0, 24], ['ArrowDown', false, 0, -24], ['ArrowLeft', true, 120, 0]]) {
    // Pointer drags are measured from a point away from the door cards; the starting pose is the same reset.
    const viaPointer = await dragBy(dx, dy);
    await reset(); await stage.focus(); await page.keyboard.press(shift ? `Shift+${key}` : key);
    const viaKey = (await pose()).position; await page.waitForTimeout(200);
    same(viaKey, viaPointer, `${shift ? 'Shift+' : ''}${key} is not a ${Math.abs(dx || dy)} px drag`);
    same((await pose()).position, viaKey, `${key} coasted`);
  }
  await reset(); await stage.focus(); const d0 = (await pose()).distance;
  await page.keyboard.press('+'); const d1 = (await pose()).distance; assert.ok(d1 < d0);
  await page.keyboard.press('-'); assert.ok((await pose()).distance > d1);
  await page.evaluate(() => __globe.select(__globe.bundle.places.find(p => p.name === 'Jerusalem')));
  await stage.focus(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('#panel').isHidden(), true, 'Escape did not close the place card');
  await page.evaluate(() => { document.getElementById('t-range')?.focus(); });
  const rangeBefore = (await pose()).position; await page.keyboard.press('ArrowLeft');
  same((await pose()).position, rangeBefore, 'Arrow keys turned the globe while another control had focus');
  report.checks.push('Globe keyboard: named, focusable, arrows = 24 px drag (Shift 120), +/- zoom, Home fits the route, Escape closes the card, no coast');

  // A real visible marker still opens a reading panel after the gestures.
  await reset();
  // Marker sizes ease toward the new zoom over a few frames; picking a marker before they settle misses it.
  await page.waitForTimeout(600);
  const findMarker = () => page.evaluate(() => {
    const g = __globe;
    // A marker the reader can actually see (label thinning hides some), clear of every door card, its stem and its ring.
    return g.bundle.places.map((p, i) => ({ s: g.screenOf(p), i })).find(({ s, i }) => g.markers.isVisible(i) && s.x > 55 && s.x < 300 && s.y > 240 && s.y < 440 && document.elementFromPoint(s.x, s.y)?.id === 'stage' && ![...document.querySelectorAll('.door')].some(d => { const r = d.getBoundingClientRect(); return r.width && s.x > r.left - 24 && s.x < r.right + 24 && s.y > r.top - 24 && s.y < r.bottom + 60; }))?.s;
  });
  const point = await findMarker();
  assert.ok(point); await page.mouse.click(point.x, point.y);
  assert.ok((await pose()).selected, 'A genuine click no longer selects markers');
  await page.click('#panel-close');
  // Selecting a place moves the camera and the door cards with it; find a marker no card covers now.
  await reset(); await page.waitForTimeout(600);
  const point2 = await findMarker(); assert.ok(point2);
  await touch('touchStart', [{ x: point2.x, y: point2.y, id: 4 }]);
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
