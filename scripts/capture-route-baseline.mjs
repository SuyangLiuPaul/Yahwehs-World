import { chromium } from 'playwright';
import { access, mkdir, writeFile } from 'node:fs/promises';

// The committed baseline belongs to f78d47a, not the current implementation.
// A reproduction must use that checkout and a new output directory.
const dir = process.env.EVIDENCE_DIR ?? 'handoff/evidence/phase-1/before';
const exists = await access(`${dir}/measurements.json`).then(() => true, () => false);
if (exists) throw new Error('Baseline already exists. Use f78d47a and a new EVIDENCE_DIR; do not overwrite historical evidence.');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const [name, width, height] of [['phone',375,812],['tablet',768,1024],['desktop',1440,900]]) {
    for (const locale of ['en','zh']) {
      const context = await browser.newContext({ viewport:{width,height}, deviceScaleFactor:1 });
      await context.addInitScript(l => localStorage.setItem('ydh.locale',l),locale);
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:5175/');
      await page.waitForFunction(() => window.__globe);
      await page.evaluate(() => document.fonts.ready);
      for (const route of ['exodus-wilderness','paul-1']) {
        // Baseline-only: the existing footer intercepts the phone route
        // trigger. Bypass that known input defect to measure the old layout.
        await page.evaluate(id => window.__globe.openRoute(id), route);
        await page.evaluate(() => window.__globe.advanceRoute(30));
        await page.waitForTimeout(600);
        await page.screenshot({ path:`${dir}/${name}-${locale}-${route}.png` });
        const data = await page.evaluate(() => {
          const labels = [...document.querySelectorAll('.rlab')].filter(e=>e.style.display!=='none').map(e=>({text:e.textContent,box:e.getBoundingClientRect().toJSON()}));
          const overlaps=[];
          labels.forEach((a,i)=>labels.slice(i+1).forEach(b=>{if(a.box.left<b.box.right&&a.box.right>b.box.left&&a.box.top<b.box.bottom&&a.box.bottom>b.box.top)overlaps.push([a.text,b.text]);}));
          return { labels:labels.length, overlaps, camera:window.__globe.camera.position.toArray(), card:document.querySelector('#r-card').getBoundingClientRect().toJSON() };
        });
        results.push({name,locale,route,...data});
        await page.evaluate(() => window.__globe.clearRoute());
      }
      await context.close();
    }
  }
} finally { await browser.close(); }
await writeFile(`${dir}/measurements.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
