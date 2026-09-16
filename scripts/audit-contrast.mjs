// Measures the contrast of every piece of text the interface actually shows,
// in both themes, and names the ones a reader cannot comfortably read.
//
// Light mode shipped half-done: the nav, the route card and the footer scrim
// were checked by eye and the rest was assumed to follow. It did not — the
// routes button, the "Go to…" control and the place count stayed on their
// dark-ground colours, and the owner found them in a screenshot. Counting is
// the only way to know; eyes check the thing they are looking at.
//
// The background a piece of text sits on is composited the way the browser
// does it: walk up through transparent ancestors, alpha-blend each background
// colour, and average a gradient's stops when a rule uses one. Anything still
// transparent at the top is over the globe canvas, which is dark in BOTH
// themes and is treated as such.
//
// Usage: node scripts/audit-contrast.mjs [url]
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:5175';
// WCAG AA: 4.5 for body text, 3.0 for text at 18.66px+ or bold 14px+.
const PAGES = ['/', '/structures.html', '/tabernacle.html'];

const measure = async (page) => page.evaluate(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  // A gradient's stops, averaged — close enough to judge a scrim by.
  const fromGradient = (img) => {
    const stops = [...img.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter(Boolean);
    if (!stops.length) return null;
    const vis = stops.filter((s) => s.a > 0.05);
    if (!vis.length) return null;
    const n = vis.length;
    return vis.reduce((acc, s) => ({
      r: acc.r + s.r / n, g: acc.g + s.g / n, b: acc.b + s.b / n,
      a: acc.a + s.a / n,
    }), { r: 0, g: 0, b: 0, a: 0 });
  };

  // The globe canvas: dark in both themes, and what any transparent chrome
  // is actually sitting on.
  const CANVAS = { r: 6, g: 13, b: 22, a: 1 };

  // A full-bleed <canvas> paints over the body's own background, so for any
  // chrome that has no opaque surface of its own the backdrop is the scene,
  // not the page. Reading body's colour there said a cream place label on the
  // dark globe was failing, when it is the one thing that was right.
  const stage = document.getElementById('stage');
  const sceneCovers = !!stage && stage.getBoundingClientRect().width >= innerWidth - 2;

  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const isPage = n === document.body;
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage;
      if (img && img !== 'none' && !(isPage && sceneCovers)) {
        const g = fromGradient(img); if (g) layers.push(g);
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0 && !(isPage && sceneCovers)) layers.push(c);
      if (c && c.a === 1 && !(isPage && sceneCovers)) break;
    }
    let base = CANVAS;
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  };

  const out = [];
  document.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    // Only elements holding their own text.
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!text) return;
    const fg = parse(cs.color);
    if (!fg || fg.a === 0) return;
    const bg = backdrop(el);
    const size = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const got = ratio(over(fg, bg), bg);
    out.push({
      sel: el.id ? '#' + el.id : el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName.toLowerCase(),
      text: text.slice(0, 28), size: Math.round(size), need,
      ratio: Math.round(got * 100) / 100, pass: got >= need,
    });
  });
  return out;
});

const browser = await chromium.launch();
let failures = 0;
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(URL + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const rows = (await measure(page)).filter((r) => !r.pass);
    // One line per distinct selector; the same rule failing in ten places is
    // one thing to fix, not ten.
    const seen = new Map();
    for (const r of rows) if (!seen.has(r.sel) || seen.get(r.sel).ratio > r.ratio) seen.set(r.sel, r);
    if (seen.size) {
      console.log(`\n${scheme}  ${path}`);
      for (const r of [...seen.values()].sort((a, b) => a.ratio - b.ratio)) {
        console.log(`  ${String(r.ratio).padStart(5)} : ${String(r.need).padStart(3)}  ${r.sel}  “${r.text}”`);
        failures++;
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} selectors below the threshold.` : '\nEvery label clears its threshold.');
process.exit(failures ? 1 : 0);
