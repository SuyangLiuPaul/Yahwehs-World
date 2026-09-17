import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto('http://127.0.0.1:5175/temple.html');
await page.waitForFunction(() => !!globalThis.__temple, null, { timeout: 40000 });
console.log(await page.evaluate(() => {
  const W = globalThis.__temple, c = W.CUBIT, R = 0.32;
  const rows = [];
  for (let x = 68; x <= 88; x += 1) {
    const blocked = W.colliders.some((b) =>
      !(b.max.y <= 0.05 || b.min.y >= 1.78 ||
        x * c + R < b.min.x || x * c - R > b.max.x || R < b.min.z || -R > b.max.z));
    rows.push(`${x}${blocked ? ' #' : ' .'}`);
  }
  return rows.join('  ');
}));
await b.close();
