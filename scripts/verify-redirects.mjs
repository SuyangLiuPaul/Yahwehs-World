// Every row of the URL table in handoff/fable-gallery-release-2026-11-03.md section 1.3, tested against a built gallery dist/.
//
//   node scripts/verify-redirects.mjs [--dir dist]
//
// Server rules (dist/_redirects, then netlify.toml's [[redirects]]) are read and matched the way the host matches them; the hash
// links, which no server can see, are tested in a browser against home.html's forwarder, and the shared /p/<id> pages are opened.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRedirects, matchRedirect, serveDist } from './lib/dist-server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DIR = resolve(ROOT, argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'dist');
let bad = 0, ok = 0;
const pass = (m) => { ok++; console.log(`ok   ${m}`); };
const fail = (m) => { bad++; console.error(`FAIL ${m}`); };

// ── server rules ───────────────────────────────────────────────────────
const toml = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
const tomlRules = [...toml.matchAll(/\[\[redirects\]\]\s*from = "([^"]+)"\s*to = "([^"]+)"\s*status = (\d+)/g)].map((m) => ({ from: m[1], to: m[2], status: Number(m[3]) }));
const rules = [...parseRedirects(DIR), ...tomlRules];
// dist/_redirects ends with `/*  /404.html  404` (P0-4), which is a REWRITE with a status, not a redirect: it is
// unforced, so the host applies it only when nothing is served at the path, and it never sends a Location header.
// Following it as a hop made every chain "end at /404.html" and made every real page look redirected.
const redirects = rules.filter((r) => !r.rewrite);
const follow = (path) => { const hops = []; for (let i = 0; i < 5; i++) { const r = matchRedirect(redirects, path); if (!r) break; hops.push(r); path = r.to.split('#')[0]; } return { hops, end: path }; };

const HIDDEN = ['/tabernacle.html', '/temple.html', '/palace.html', '/ezekiel.html', '/herod.html', '/new-jerusalem.html', '/ark.html', '/figures.html', '/figures-springs.html', '/plan.html', '/video.html', '/previews/moses-tabernacle-v04/index.html', '/previews/solomon-temple-v02/index.html', '/previews/noahs-ark-v01/index.html', '/scene-assembly.html'];
for (const p of HIDDEN) {
  const { hops, end } = follow(p);
  hops[0]?.status === 302 && end === '/' ? pass(`${p} -> 302 -> /`) : fail(`${p}: ${JSON.stringify(hops)} ends at ${end}`);
}
{
  const { hops, end } = follow('/structures.html');
  hops.length === 2 && hops[0].status === 301 && hops[1].status === 302 && end === '/' ? pass('/structures.html -> 301 /tabernacle.html -> 302 /') : fail(`/structures.html: ${JSON.stringify(hops)} ends at ${end}`);
}
for (const p of ['/gallery', '/pictures']) {
  const r = matchRedirect(redirects, p);
  r?.status === 301 && r.to === '/scenes.html' ? pass(`${p} -> 301 /scenes.html`) : fail(`${p}: ${JSON.stringify(r)}`);
}
{
  const r = matchRedirect(redirects, '/privacy');
  r?.status === 301 && r.to === '/privacy.html' ? pass('/privacy -> 301 /privacy.html') : fail(`/privacy: ${JSON.stringify(r)}`);
}
for (const p of ['/', '/scenes.html', '/bible.html', '/privacy.html', '/pictures/thumb/genesis-1-1.webp', '/p/genesis-1-1']) {
  matchRedirect(redirects, p) ? fail(`${p} must not be redirected`) : pass(`${p} is served, not redirected`);
}
// our own not-found page, with the status it deserves, as the LAST rule so it shadows nothing
{
  const last = rules.filter((r) => r.rewrite).pop();
  last && last.from === '/*' && last.to === '/404.html' && last.status === 404 && !last.force
    ? pass('an unknown path gets /404.html with a 404 (unforced, last rule)')
    : fail(`the 404 rule is ${JSON.stringify(last)}`);
}

// ── in a browser ───────────────────────────────────────────────────────
const { base, close } = await serveDist(DIR);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('ydh.locale', 'en'); } catch { /* */ } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const land = async (url) => { await page.goto(base + url); await page.waitForLoadState('load'); await page.waitForTimeout(400); const u = new URL(page.url()); return u.pathname + u.search + u.hash; };

{ const u = await land('/#ref=Exodus%2025:10'); u.startsWith('/bible.html#ref=Exodus') ? pass(`/#ref=Exodus 25:10 -> ${u}`) : fail(`/#ref=Exodus 25:10 -> ${u}`);
  await page.waitForSelector('.yr-chapter .yr-title', { timeout: 15000 });
  const t = await page.locator('.yr-title').first().innerText();
  const hl = await page.locator('.yr-v.is-hl, .yr-v.is-sel').count();
  /Exodus 25/.test(t) ? pass(`the reader opened ${t.trim()}`) : fail(`the reader opened "${t}", wanted Exodus 25`);
  hl >= 1 ? pass('...with verse 10 marked') : fail('verse 10 is not marked'); }
{ const u = await land('/#ref=1%20Samuel%203:1'); u.startsWith('/bible.html#ref=1%20Samuel') ? pass(`/#ref=1 Samuel 3:1 -> ${u}`) : fail(`/#ref=1 Samuel 3:1 -> ${u}`);
  await page.waitForSelector('.yr-chapter .yr-title', { timeout: 15000 }); const t = await page.locator('.yr-title').first().innerText(); /1 Samuel 3/.test(t) ? pass('the reader opened 1 Samuel 3') : fail(`the reader opened "${t}", wanted 1 Samuel 3`); }
{ const u = await land('/bible.html?book=43&ch=3'); u.startsWith('/bible.html#ref=John') ? pass(`the old /bible.html?book=43&ch=3 -> ${u}`) : fail(`/bible.html?book=43&ch=3 -> ${u}`);
  await page.waitForSelector('.yr-chapter .yr-title', { timeout: 15000 }); const t = await page.locator('.yr-title').first().innerText(); /John 3/.test(t) ? pass('...and opens John 3') : fail(`opened "${t}"`); }
{ const u = await land('/#event=genesis-15-1'); u === '/scenes.html#p=genesis-15-1' ? pass(`/#event=genesis-15-1 -> ${u}`) : fail(`/#event=genesis-15-1 -> ${u}`);
  await page.waitForSelector('.yr-passage .yr-v', { timeout: 15000 }); pass('the picture page showed its verses'); }
for (const h of ['#journey=paul-1', '#place=jerusalem']) {
  const u = await land('/' + h);
  const shown = await page.locator('#hm-notice').isVisible();
  const link = h.startsWith('#journey') ? await page.locator('#hm-notice a').getAttribute('href').catch(() => null) : null;
  u === `/${h}` && shown && (!h.startsWith('#journey') || link?.startsWith('/scenes.html#p=')) ? pass(`/${h} stays on the home page with the notice${link ? ` and a link to ${link}` : ''}`) : fail(`/${h} -> ${u}, notice ${shown}, link ${link}`);
}
{ const u = await land('/'); u === '/' ? pass('/ stays the home page') : fail(`/ -> ${u}`); }
{ const u = await land('/scenes.html#event=genesis-1-1'); u.endsWith('#event=genesis-1-1') ? pass('/scenes.html#event=<id> (the old lightbox form) opens the picture page') : fail(u);
  await page.waitForSelector('#sc-picture:not([hidden])', { timeout: 15000 }).then(() => pass('...and shows it'), () => fail('#event= did not open the picture page')); }
{ const u = await land('/p/genesis-15-1'); u.startsWith('/scenes.html#p=genesis-15-1') ? pass(`/p/genesis-15-1 -> ${u}`) : fail(`/p/genesis-15-1 -> ${u}`);
  const og = await (await fetch(base + '/p/genesis-15-1')).text();
  og.includes('og:image" content="https://world.yahwehword.com/pictures/full/genesis-15-1.webp"') && og.includes('Covenant') ? pass('/p/<id> carries its own title and image for sharing') : fail('/p/genesis-15-1 has no own og tags'); }
{ await land('/#lang=ru'); const l = await page.evaluate(() => document.documentElement.lang); l === 'ru' ? pass('/#lang=ru opens in Russian') : fail(`/#lang=ru -> lang ${l}`); }
{ const u = await land('/p/genesis-15-1#lang=ru'); u.includes('p=genesis-15-1') && u.includes('lang=ru') ? pass('a shared link keeps its #lang') : fail(`/p/...#lang=ru -> ${u}`); }
errors.length ? fail(`page errors: ${errors.slice(0, 3)}`) : pass('no page error on any of them');
await browser.close(); close();
console.log(bad ? `\n${bad} problem(s), ${ok} ok` : `\nall ${ok} checks ok`);
process.exit(bad ? 1 : 0);
