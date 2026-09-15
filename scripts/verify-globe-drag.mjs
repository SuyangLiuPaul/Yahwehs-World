import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const baseline = process.env.BASELINE === '1';
const dir = process.env.EVIDENCE_DIR ?? `handoff/evidence/phase-5/${baseline ? 'before' : 'after'}`;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { baseline, environment: 'Desktop Chrome; touch input is CDP-emulated, not physical iOS/Android', measurements: [], errors: [] };
try {
  for (const [name, width, height] of [['phone', 375, 812], ['tablet', 768, 1024], ['desktop', 1440, 900]]) {
    for (const locale of baseline ? ['en'] : ['en', 'zh']) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
      await context.addInitScript(l => localStorage.setItem('ydh.locale', l), locale);
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push(e.message));
      await page.goto('http://127.0.0.1:5175/');
      await page.waitForFunction(() => window.__globe);
      const cdp = await context.newCDPSession(page);
      for (const radius of [108, 125, 200, 400]) {
        for (const axis of ['x', 'y']) {
          for (const input of baseline || name === 'desktop' ? ['mouse'] : ['mouse', 'touch']) {
            await page.evaluate(async radius => {
              const g = window.__globe;
              const { lonLatToVec3 } = await import('/src/globe.ts');
              const damping = g.controls.enableDamping;
              g.controls.enableDamping = false; g.controls.update(); g.controls.enableDamping = damping;
              g.camera.position.copy(lonLatToVec3(35, 31, radius - 100));
              g.controls.update(); g.camera.updateMatrixWorld(true);
              window.__dragAnchor = g.camera.position.clone().setLength(100);
            }, radius);
            const sample = () => page.evaluate(() => {
              const g = window.__globe;
              g.camera.updateMatrixWorld(true);
              const p = window.__dragAnchor.clone().project(g.camera);
              return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2, camera: g.camera.position.toArray(), speed: g.controls.rotateSpeed };
            });
            const start = { x: width / 2, y: height / 2 };
            const end = { x: start.x + (axis === 'x' ? 40 : 0), y: start.y + (axis === 'y' ? 40 : 0) };
            const before = await sample();
            if (input === 'mouse') { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
            else await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
            for (let i = 1; i <= 8; i++) {
              const x = start.x + (end.x - start.x) * i / 8, y = start.y + (end.y - start.y) * i / 8;
              if (input === 'mouse') await page.mouse.move(x, y);
              else await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
              await page.waitForTimeout(16);
            }
            const held = await sample();
            if (input === 'mouse') await page.mouse.up();
            else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await page.waitForTimeout(baseline ? 1800 : 250);
            const released = await sample();
            const gain = (released[axis] - before[axis]) / 40;
            const drift = Math.hypot(released.x - held.x, released.y - held.y);
            const row = { name, locale, radius, axis, input, gain, releaseDriftPx: drift, speed: before.speed };
            report.measurements.push(row);
            if (!baseline) {
              assert.ok(gain > .6 && gain < 1.15, `Surface must track the drag, not race it: ${JSON.stringify(row)}`);
              assert.ok(drift < .1, `Release must stop the globe: ${JSON.stringify(row)}`);
            }
            if (radius === 125 && axis === 'x' && input === 'mouse') await page.screenshot({ path: `${dir}/${name}-${locale}-drag.png` });
          }
        }
      }
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await writeFile(`${dir}/drag.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
