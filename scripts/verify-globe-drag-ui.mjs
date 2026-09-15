import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Production-capable: observe SVG leader anchors, never a private camera handle.
const url = process.env.TEST_URL ?? 'http://127.0.0.1:5175/';
const dir = process.env.EVIDENCE_DIR ?? 'handoff/evidence/phase-5/ui';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { url, measurements: [], errors: [] };
try {
  for (const [name, width, height] of [['phone', 375, 812], ['tablet', 768, 1024], ['desktop', 1440, 900]]) {
    for (const locale of ['en', 'zh']) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: name !== 'desktop' });
      await context.addInitScript(l => localStorage.setItem('ydh.locale', l), locale);
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      page.on('pageerror', e => report.errors.push(e.message));
      page.on('console', e => { if (e.type() === 'error') report.errors.push(e.text()); });
      await page.goto(url); await page.waitForSelector('#loading.done'); await page.evaluate(() => document.fonts.ready);
      if (process.env.PRODUCTION === '1') assert.equal(await page.evaluate(() => typeof window.__globe), 'undefined');
      await page.click('#r-open'); await page.click('[data-id="paul-1"]'); await page.locator('.r-step').last().click();
      await page.waitForFunction(() => document.querySelector('#r-thumbnail').dataset.state === 'ready');
      const anchors = () => page.evaluate(() => [...document.querySelectorAll('.route-leaders line')].map((el, i) => ({ i, x: Number(el.getAttribute('x1')), y: Number(el.getAttribute('y1')), visible: el.style.display !== 'none' })));
      for (const zoom of ['fit', 'close']) {
        await page.click('#map-fit');
        if (zoom === 'close') await page.click('#map-in');
        await page.waitForTimeout(120);
        const before = await anchors();
        const y = (await page.locator('#r-card').boundingBox()).y * .55;
        const x = width / 2, delta = 40;
        assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x, y }), 'stage');
        if (name === 'desktop') { await page.mouse.move(x, y); await page.mouse.down(); }
        else await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        for (let i = 1; i <= 8; i++) {
          if (name === 'desktop') await page.mouse.move(x + delta * i / 8, y);
          else await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + delta * i / 8, y, id: 1 }] });
          await page.waitForTimeout(20);
        }
        await page.waitForTimeout(50); const held = await anchors();
        if (name === 'desktop') await page.mouse.up();
        else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(400); const released = await anchors();
        const rows = before.filter(a => a.visible && held[a.i].visible && released[a.i].visible).map(a => ({
          i: a.i, gain: (held[a.i].x - a.x) / delta,
          releaseDriftPx: Math.hypot(released[a.i].x - held[a.i].x, released[a.i].y - held[a.i].y),
        }));
        assert.ok(rows.length >= 2, `${name}/${locale}/${zoom}: too few comparable route anchors`);
        assert.ok(rows.every(r => r.gain > .45 && r.gain < 1.2), `Route races the drag: ${JSON.stringify(rows)}`);
        assert.ok(rows.every(r => r.releaseDriftPx < .1), 'Globe coasts after release');
        assert.equal(await page.locator('#panel').isVisible(), false, 'Drag opened a place panel');
        report.measurements.push({ name, locale, zoom, input: name === 'desktop' ? 'mouse' : 'touch', anchors: rows });
        await page.screenshot({ path: `${dir}/${name}-${locale}-${zoom}.png` });
      }
      // Explicit Fit remains available after manual movement. Then let actual
      // route playback run and verify the projected map positions stay fixed.
      await page.click('#map-fit'); await page.locator('.r-step').nth(2).click(); await page.waitForTimeout(100);
      const beforePlay = await anchors(); await page.click('#r-toggle'); await page.waitForTimeout(1100); await page.click('#r-toggle');
      const afterPlay = await anchors();
      for (const a of beforePlay.filter(a => a.visible && afterPlay[a.i].visible)) {
        assert.ok(Math.hypot(a.x - afterPlay[a.i].x, a.y - afterPlay[a.i].y) < .1, 'Route playback moved the map');
      }
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close(); await writeFile(`${dir}/ui.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(`Passed ${report.measurements.length} bilingual viewport/zoom cases using only rendered UI`);
