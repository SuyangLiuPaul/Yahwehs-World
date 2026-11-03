// Does the interface follow the reader's text-size setting, and does it survive it?
//
//   node scripts/verify-text-scale.mjs [dist] [/,/scenes.html,...]   (pages default to the full surface's five)
//
// Serves a built dist/ and, at a 375 px viewport, sets the root font size to 100, 125,
// 150 and 200 percent (what a raised browser default does) on the five pages. Reports the
// computed size of a nav tab / body text, the nav bar's height, and any horizontal overflow.
// Before the tokens moved to rem, text stayed at 14 px at every setting (apple-look
// typography.md > Supporting Dynamic Type); the pass condition now is: scales, and never OVERFLOW.
import { chromium } from 'playwright';
import http from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, extname } from 'node:path';
const DIR = process.argv[2] || 'dist'; const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'};
const srv = await new Promise(ok=>{const s=http.createServer((q,r)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname); if(p.endsWith('/'))p+='index.html'; const f=join(DIR,p); if(!existsSync(f)||!statSync(f).isFile()){r.writeHead(404);r.end();return;} r.writeHead(200,{'content-type':T[extname(f)]||'application/octet-stream'}); r.end(readFileSync(f));}); s.listen(0,'127.0.0.1',()=>ok(s));});
const base=`http://127.0.0.1:${srv.address().port}`;
const b = await chromium.launch({ channel:'chrome', headless:true });
for (const pct of [100,125,150,200]) { const out=[];
  for (const path of (process.argv[3] || '/,/scenes.html,/plan.html,/figures.html,/bible.html').split(',')) {
    const ctx = await b.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true}); await ctx.route(/fonts\./, r=>r.abort());
    const p = await ctx.newPage(); await p.goto(base+path); await p.waitForTimeout(1200);
    await p.addStyleTag({content:`html{font-size:${pct}% !important}`}); await p.waitForTimeout(300);
    const r = await p.evaluate(()=>({ovf: document.documentElement.scrollWidth>innerWidth+1, bodyFs:getComputedStyle(document.querySelector('.sitenav .tab, body')).fontSize, nav: Math.round(document.querySelector('.sitenav').getBoundingClientRect().height)}));
    out.push(path+':'+(r.ovf?'OVERFLOW':'ok')+' tabFs='+r.bodyFs+' navH='+r.nav); await ctx.close();
  }
  console.log(pct+'% ->', out.join(' | '));
}
await b.close(); srv.close();
