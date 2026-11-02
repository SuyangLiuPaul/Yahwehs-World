// Behaviour + loading check for /bible.html after the per-book data split.
//   node scripts/verify-bible-reader.mjs [--dir dist]
// Serves dist/ itself and drives Chrome. Fails (exit 1) if:
//   - the first view fetches a whole-Bible file, meta.json, places.json or events.json
//   - any viewport x language shows a layout shift of 0.02 or more
//   - a chapter, a book change, a step across a book boundary, ?book=&ch=, the picker
//     or full-text search stops working (the search must fetch the whole text, once, on demand)
import http from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const di = process.argv.indexOf('--dir');
const DIR = resolve(ROOT, di > 0 ? process.argv[di + 1] : 'dist');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.gz': 'application/gzip' };
const server = http.createServer((q, r) => {
  const f = join(DIR, new URL(q.url, 'http://x').pathname);
  if (!f.startsWith(DIR) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f));
});
await new Promise((o) => server.listen(0, '127.0.0.1', o));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.error('FAIL ' + m); } else console.log('ok   ' + m); };

async function open(loc, vp, url = '/bible.html') {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|yahwehs-scenes/, (r) => r.abort());
  await ctx.addInitScript((l) => {
    localStorage.setItem('ydh.locale', l);
    window.__cls = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  }, loc);
  const pg = await ctx.newPage();
  const urls = [];
  pg.on('request', (r) => urls.push(r.url().replace(base, '')));
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(base + url);
  await pg.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 30000 });
  await pg.waitForTimeout(300);
  return { ctx, pg, urls, errs };
}
const secs = (pg) => pg.locator('.bb-section').count();
const chBanner = (pg) => pg.locator('.bb-chapter-banner').first().textContent();

// 1. first view: which files, which shifts
for (const [name, vp] of [['phone', { width: 375, height: 812 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1440, height: 900 }]]) {
  for (const loc of ['en', 'zh-Hans', 'zh-Hant']) {
    const { ctx, pg, urls, errs } = await open(loc, vp);
    const heavy = urls.filter((u) => /-yhwh\.json|bible\/meta\.json|places\.json|events\.json/.test(u));
    const cls = await pg.evaluate(() => window.__cls);
    const n = await secs(pg);
    ok(heavy.length === 0 && errs.length === 0 && n > 0, `${name} ${loc}: Genesis renders (${n} sections), no whole-Bible/meta/places/events fetch${heavy.length ? ' [' + heavy + ']' : ''}${errs.length ? ' [' + errs[0] + ']' : ''}`);
    ok(cls < 0.02, `${name} ${loc}: layout shift ${cls.toFixed(3)} (< 0.02)`);
    if (loc === 'en') ok(urls.some((u) => u.includes('/text/bsb/1.json')) && urls.some((u) => u.includes('/text/cuvs/1.json')), `${name} en: Genesis in BSB and CUV only`);
    if (loc === 'zh-Hant') ok(urls.some((u) => u.includes('/text/cuvt/1.json')) && !urls.some((u) => u.includes('/text/bsb/')), `${name} zh-Hant: traditional text, no English`);
    await ctx.close();
  }
}

// 2. navigation, picker, search
{
  const { ctx, pg, urls } = await open('en', { width: 1440, height: 900 });
  ok((await chBanner(pg)).includes('Chapter 1'), 'starts at Genesis chapter 1');
  await pg.click('#bb-next-ch');
  await pg.waitForFunction(() => document.querySelector('.bb-chapter-banner')?.textContent?.includes('Chapter 2'));
  ok(/ch=2/.test(pg.url()), 'next chapter: Genesis 2, url updated');
  await pg.selectOption('#bb-chapter-select', '50');
  await pg.waitForFunction(() => document.querySelector('.bb-chapter-banner')?.textContent?.includes('Chapter 50'));
  await pg.click('#bb-next-ch');
  await pg.waitForFunction(() => document.querySelector('.bb-chapter-banner')?.textContent?.includes('Exodus'));
  ok(urls.some((u) => u.includes('/text/bsb/2.json')) && (await chBanner(pg)).includes('Exodus'), 'Genesis 50 -> next is Exodus 1 (loads only that book)');
  await pg.click('#bb-prev-ch');
  await pg.waitForFunction(() => document.querySelector('.bb-chapter-banner')?.textContent?.includes('Genesis'));
  ok((await chBanner(pg)).includes('Chapter 50'), 'Exodus 1 -> prev is Genesis 50');
  await pg.selectOption('#bb-book-select', '19');
  await pg.waitForFunction(() => document.querySelector('.bb-chapter-banner')?.textContent?.includes('Psalm'));
  ok((await secs(pg)) > 0 && (await pg.locator('#bb-chapter-select option').count()) === 150, 'Psalms: sections render, 150 chapters in the picker');
  ok(!urls.some((u) => /-yhwh\.json/.test(u)), 'reading never fetched a whole-Bible file');
  await pg.click('#bb-open-toc');
  ok((await pg.locator('.bb-toc-card').count()) === 66 && (await pg.locator('.bb-ch-cell').count()) === 150, 'picker lists 66 books and 150 chapters of Psalms');
  await pg.fill('#bb-global-search', '挪亚');
  await pg.waitForSelector('.bb-search-hit', { timeout: 20000 });
  ok((await pg.locator('.bb-search-hit').count()) > 5 && urls.filter((u) => /cuvs-yhwh\.json/.test(u)).length === 1, 'search finds verses; the whole Chinese text is fetched once, only now');
  await ctx.close();
}
{
  const { ctx, pg } = await open('en', { width: 1440, height: 900 }, '/bible.html?book=Rev&ch=22');
  const b = await chBanner(pg);
  ok(b.includes('Revelation') && b.includes('22'), '?book=Rev&ch=22 opens Revelation 22');
  ok(await pg.locator('#bb-next-ch').isDisabled(), 'Revelation 22: no next chapter');
  await ctx.close();
}
{
  const { ctx, pg } = await open('zh-Hant', { width: 375, height: 812 }, '/bible.html?book=43&ch=3');
  ok((await secs(pg)) > 0 && (await chBanner(pg)).includes('第 3 章'), '?book=43&ch=3 (zh-Hant): John 3');
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? `${bad} failure(s)` : 'all ok');
process.exit(bad ? 1 : 0);
