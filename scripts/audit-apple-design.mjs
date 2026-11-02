// Apple-design audit measurements (apple-motion / apple-look), same scan before and after a fix.
//
//   node scripts/audit-apple-design.mjs [--dir dist] [--json out.json] [--pages /,/scenes.html,...]
//        [--viewports 375x812,1440x900] [--feel]
//
// It serves a built dist/, loads each page, and reports per page and viewport:
//   targets   interactive elements below 44 px (touch) / 28 px (pointer) in either axis, by the larger of
//             the element's box and its ::before/::after hit extension (getComputedStyle cannot see
//             pseudo hit areas, so a pseudo that is absolutely positioned and inset by a negative
//             amount is counted via its computed width/height)
//   type      text elements below 12 px, and the distinct font sizes in use
//   contrast  text nodes whose colour against the nearest opaque ancestor background is under
//             4.5:1 (under 3:1 for >= 18 px or bold >= 14 px); backgrounds that are gradients or
//             images are skipped and counted as "unknown"
//   motion    with prefers-reduced-motion: reduce emulated, running CSS animations / transitions
//             longer than 0 ms, and infinite animations (document.getAnimations())
//   feel      (--feel) hover / :active / :focus-visible response of the first 40 interactive
//             elements: which show no change in colour, background, border, shadow, outline,
//             transform or opacity, and the transition duration on the pressed state
//   overflow  horizontal scroll at the viewport
// Google Fonts are blocked so numbers do not move with a third party.
import http from 'node:http';
import { readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1']] : a), []));
const DIR = resolve(ROOT, args.dir || 'dist');
const PAGES = (args.pages || '/,/scenes.html,/plan.html,/figures.html,/bible.html').split(',');
const VIEWPORTS = (args.viewports || '375x812,1440x900').split(',').map(s => s.split('x').map(Number));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.bin': 'application/octet-stream' };

const server = await new Promise(ok => {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(DIR, p);
    if (!file.startsWith(DIR) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('nf'); return; }
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'content-length': body.length, 'cache-control': 'no-store' });
    res.end(body);
  });
  s.listen(0, '127.0.0.1', () => ok(s));
});
const base = `http://127.0.0.1:${server.address().port}`;

// Runs inside the page.
const measure = ({ touch, feel }) => {
  const INTERACTIVE = 'a[href], button, [role=button], [role=tab], [role=switch], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const vis = el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && (() => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })();
  const sel = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const out = { targets: { checked: 0, small: [] }, type: { under12: [], sizes: {} }, contrast: { checked: 0, fail: [], unknown: 0 }, overflow: document.documentElement.scrollWidth > innerWidth + 1 };

  // ── targets
  const floor = touch ? 44 : 28, hard = touch ? 28 : 20; out.targets.hard = hard;
  const els = [...document.querySelectorAll(INTERACTIVE)].filter(vis);
  const seen = new Set();
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight * 3) continue;
    let w = r.width, h = r.height;
    // an inline link inside running text is exempt from the box rule (HIG: spacing matters; WCAG 2.5.8 inline exception)
    const inline = getComputedStyle(el).display === 'inline' && el.closest('p, li, td, blockquote, .verse, .vt');
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (cs.content !== 'none' && cs.position === 'absolute') {
        const pw = parseFloat(cs.width), ph = parseFloat(cs.height);
        if (pw > w) w = pw; if (ph > h) h = ph;
      }
    }
    out.targets.checked++;
    if (!inline && (w < floor || h < floor)) {
      const key = sel(el) + '|' + Math.round(w) + 'x' + Math.round(h);
      if (!seen.has(key)) { seen.add(key); out.targets.small.push({ below: Math.min(w, h) < hard, sel: sel(el), w: +w.toFixed(1), h: +h.toFixed(1), text: (el.getAttribute('aria-label') || el.textContent || el.title || '').trim().slice(0, 24) }); }
    }
  }

  // ── hit-test regression: the centre of every control must resolve to that control. An invisible
  // hit extension that steals a neighbour's tap shows up here as a control that something else answers for.
  out.hit = { checked: 0, stolen: [] };
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    // a tab scrolled out of its strip, or under a scroll container's edge, is not hit-testable at its centre
    let clipped = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a); if (!/(auto|scroll|hidden)/.test(o.overflowX + o.overflowY)) continue;
      const b = a.getBoundingClientRect(); if (x < b.left || x > b.right || y < b.top || y > b.bottom) { clipped = true; break; }
    }
    if (clipped) continue;
    out.hit.checked++;
    const t = document.elementFromPoint(x, y);
    if (t && !(el === t || el.contains(t) || t.contains(el))) out.hit.stolen.push(sel(el) + ' <- ' + sel(t));
  }
  // layout fingerprint of the chrome a hit-area or sizing change could push around
  out.layout = {};
  for (const q of ['.sitenav', '#globe-modes', '#t-range', '.readout', '.source-credit', '.sg-controls', '.bb-reader-bar']) {
    const e = document.querySelector(q); if (!e) continue; const r = e.getBoundingClientRect();
    out.layout[q] = [Math.round(r.top), Math.round(r.height)];
  }

  // ── type + contrast
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const backdrop = el => {
    // composite background layers from the nearest ancestor upward; null when a gradient/image/canvas sits in the way
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') {
        // gradient: take the stop least favourable to the text (decided by the caller); url()/canvas: unknown
        if (!/gradient/.test(cs.backgroundImage) || /url\(/.test(cs.backgroundImage)) return null;
        const stops = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0])).filter(Boolean);
        if (!stops.length) return null;
        return { stops, layers };
      }
      if (e.tagName === 'CANVAS' || e.tagName === 'VIDEO') return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let acc = { r: 10, g: 30, b: 54, a: 1 }; // --ground fallback
    if (!layers.length) return null;
    for (const l of layers.reverse()) acc = over(l, acc);
    return acc;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seenText = new Set();
  for (let n; (n = walker.nextNode());) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !vis(el)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    out.type.sizes[fs] = (out.type.sizes[fs] || 0) + 1;
    const k = sel(el) + fs;
    if (fs < 12 && !seenText.has('t' + k)) { seenText.add('t' + k); out.type.under12.push({ sel: sel(el), fs, text: n.nodeValue.trim().slice(0, 20) }); }
    const fg = parse(cs.color); if (!fg) continue;
    const bgr = backdrop(el);
    if (!bgr) { out.contrast.unknown++; continue; }
    const ground = { r: 10, g: 30, b: 54, a: 1 };
    const bgs = bgr.stops ? bgr.stops.map(st => [...bgr.layers].reverse().reduce((acc, l) => over(l, acc), over(st, ground))) : [bgr];
    let cr = Infinity;
    for (const bg of bgs) { const f = over({ ...fg, a: fg.a * parseFloat(cs.opacity) }, bg); cr = Math.min(cr, ratio(f, bg)); }
    out.contrast.checked++;
    const large = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (cr < need && !seenText.has('c' + k)) { seenText.add('c' + k); out.contrast.fail.push({ sel: sel(el), cr: +cr.toFixed(2), need, fs, text: n.nodeValue.trim().slice(0, 20) }); }
  }
  return out;
};

// Stylesheet facts: how many :hover rules fire on a touch device, how many :active rules exist,
// whether the nav's current tab is inside the strip's visible area.
const sheets = () => {
  let hoverUnguarded = 0, hoverGuarded = 0, active = 0, focusVisible = 0;
  const walk = (rules, guarded) => {
    for (const r of rules) {
      if (r.cssRules && r.media) { walk(r.cssRules, guarded || /hover:\s*hover/.test(r.media.mediaText)); continue; }
      if (r.cssRules && !r.selectorText) { walk(r.cssRules, guarded); continue; }
      const sel = r.selectorText || '';
      if (/:hover/.test(sel)) guarded ? hoverGuarded++ : hoverUnguarded++;
      if (/:active/.test(sel)) active++;
      if (/:focus-visible/.test(sel)) focusVisible++;
    }
  };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, false); } catch {} }
  const ol = document.querySelector('.sitenav ol'), cur = ol?.querySelector('[aria-current]');
  let navCurrentVisible = null, navStripWidth = null;
  if (ol && cur) { const a = ol.getBoundingClientRect(), b = cur.getBoundingClientRect(); navCurrentVisible = +(Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) / b.width).toFixed(2); navStripWidth = Math.round(a.width); }
  const backdrop = [...document.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); return (c.backdropFilter && c.backdropFilter !== 'none') || (c.webkitBackdropFilter && c.webkitBackdropFilter !== 'none'); }).length;
  return { hoverUnguarded, hoverGuarded, active, focusVisible, navCurrentVisible, navStripWidth, backdrop, rtMedia: matchMedia('(prefers-reduced-transparency: reduce)').matches, contrastMedia: matchMedia('(prefers-contrast: more)').matches };
};

const motion = () => {
  const running = document.getAnimations().map(a => ({ type: a.constructor.name, name: a.animationName || a.transitionProperty, dur: a.effect?.getComputedTiming().duration, iter: a.effect?.getComputedTiming().iterations, target: (e => e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 20)) : '?')(a.effect?.target) }));
  return { running: running.filter(a => a.type === 'CSSAnimation'), infinite: running.filter(a => a.iter === Infinity).length };
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = {};
for (const [w, h] of VIEWPORTS) {
  const touch = w < 768;
  for (const path of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, reducedMotion: 'no-preference' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    await page.goto(base + path, { waitUntil: 'load' });
    await page.waitForSelector('#loading.done', { state: 'attached', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const key = `${path} ${w}x${h}`;
    const r = await page.evaluate(measure, { touch, feel: false });
    // reduced motion: reload under emulation, sample animations after load
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#loading.done', { state: 'attached', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    r.motionReduced = await page.evaluate(motion);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#loading.done', { state: 'attached', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    r.motionNormal = await page.evaluate(motion);
    r.sheets = await page.evaluate(sheets);
    // reduced transparency: how many elements still carry a backdrop blur when the reader asked for none
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-contrast', value: 'more' }] });
    await page.waitForTimeout(200);
    r.sheetsRT = await page.evaluate(sheets);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'no-preference' }, { name: 'prefers-contrast', value: 'no-preference' }] });
    if (args.feel) r.feel = await feelScan(page, touch);
    r.errors = errs;
    report[key] = r;
    await ctx.close();
  }
}
async function feelScan(page, touch) {
  const handles = await page.$$('a[href], button, [role=button], [role=tab], summary, input[type=range], select');
  const res = { checked: 0, noHover: [], noActive: [], noFocus: [], slowPress: [] };
  const snap = el => el.evaluate(e => { const c = getComputedStyle(e); return [c.color, c.backgroundColor, c.borderColor, c.boxShadow, c.outlineStyle + c.outlineWidth + c.outlineColor, c.transform, c.opacity, c.textDecorationLine, c.filter, c.backgroundImage].join('|'); });
  const label = el => el.evaluate(e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '')) + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 18) + '"');
  let n = 0;
  for (const el of handles) {
    if (n >= 40) break;
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox(); if (!box || box.y + box.height > page.viewportSize().height || box.y < 0) continue;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const same = await el.evaluate((e, [x, y]) => { const t = document.elementFromPoint(x, y); return e === t || e.contains(t); }, [cx, cy]).catch(() => false);
    if (!same) continue;
    n++; res.checked++;
    const name = await label(el);
    await page.mouse.move(2, 2); await page.waitForTimeout(60);
    const rest = await snap(el);
    let hovered = rest;
    if (!touch) { await page.mouse.move(cx, cy); await page.waitForTimeout(260); hovered = await snap(el); if (hovered === rest) res.noHover.push(name); }
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(30);
    const pressedEarly = await snap(el); // 30 ms into the press: feedback must already have started
    await page.waitForTimeout(260);
    const pressed = await snap(el);
    const durs = await el.evaluate(e => getComputedStyle(e).transitionDuration.split(',').map(x => parseFloat(x) * (x.includes('ms') ? 1 : 1000)));
    await page.mouse.move(2, 2); await page.mouse.up();
    if (pressed === hovered && pressedEarly === hovered) res.noActive.push(name);
    if (Math.max(...durs) > 200) res.slowPress.push(name + ' ' + Math.max(...durs) + 'ms');
    await page.keyboard.press('Escape').catch(() => {});
    await el.focus().catch(() => {});
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(260);
    const focused = await el.evaluate(e => document.activeElement === e && e.matches(':focus-visible'));
    if (focused && (await snap(el)) === rest) res.noFocus.push(name);
    await page.mouse.move(2, 2); await page.waitForTimeout(40);
    await page.evaluate(() => document.activeElement?.blur?.());
  }
  return res;
}
await browser.close(); server.close();

// ── summary
const lines = [];
for (const [k, r] of Object.entries(report)) {
  lines.push(`\n## ${k}`);
  lines.push(`targets: ${r.targets.small.length} below the platform default of ${r.targets.checked} checked (${r.targets.small.filter(t => t.below).length} below the Apple minimum of ${r.targets.hard}px); overflow-x: ${r.overflow}; errors: ${r.errors.length}`);
  lines.push(`hit-test: ${r.hit.checked} control centres, ${r.hit.stolen.length} answered by another element${r.hit.stolen.length ? ' (' + r.hit.stolen.slice(0, 4).join('; ') + ')' : ''}`);
  lines.push(`layout [top,height]: ${JSON.stringify(r.layout)}`);
  lines.push(`type: ${r.type.under12.length} elements < 12px; sizes in use: ${Object.keys(r.type.sizes).length} (${Object.keys(r.type.sizes).sort((a, b) => a - b).join(', ')})`);
  lines.push(`contrast: ${r.contrast.fail.length} failing of ${r.contrast.checked} measured (${r.contrast.unknown} on gradient/image/canvas, not measured)`);
  lines.push(`rules: :hover unguarded ${r.sheets.hoverUnguarded} / guarded ${r.sheets.hoverGuarded}; :active ${r.sheets.active}; :focus-visible ${r.sheets.focusVisible}; share of the current nav tab inside the strip: ${r.sheets.navCurrentVisible} (strip ${r.sheets.navStripWidth}px wide)`);
  lines.push(`materials: backdrop-blur elements ${r.sheets.backdrop}; under reduced-transparency+more-contrast still ${r.sheetsRT.backdrop} (media supported: rt=${r.sheetsRT.rtMedia}, contrast=${r.sheetsRT.contrastMedia})`);
  lines.push(`motion: reduced -> ${r.motionReduced.running.length} CSS animations running (${r.motionReduced.infinite} infinite); normal -> ${r.motionNormal.running.length} (${r.motionNormal.infinite} infinite)`);
  if (r.feel) lines.push(`feel: checked ${r.feel.checked}; no hover ${r.feel.noHover.length}; no pressed ${r.feel.noActive.length}; slow press ${r.feel.slowPress.length}; no focus ring ${r.feel.noFocus.length}`);
}
console.log(lines.join('\n'));
if (args.json) writeFileSync(resolve(ROOT, args.json), JSON.stringify(report, null, 1));
