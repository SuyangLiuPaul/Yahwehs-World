// The in-page probe: everything that can only be seen from inside the document.
//
// INIT_SCRIPT is injected with addInitScript(), so it runs BEFORE the page's own modules and catches the entries
// a late PerformanceObserver would miss. It writes one global, window.__perf, and nothing else; it mutates no
// prototype and touches no app state, so a measured page behaves exactly as a reader's does.
//
// Everything here must work in BOTH engines. WebKit has no 'longtask', no 'long-animation-frame', no
// 'layout-shift', no 'event' timing and no performance.memory — each observer is therefore attempted on its own
// and a missing one leaves its bucket empty rather than throwing. The report says which numbers an engine cannot
// give instead of printing a zero that reads like a good result.

export const INIT_SCRIPT = `(() => {
  if (window.__perf) return;
  const P = {
    lcp: 0, lcpEl: '', lcpUrl: '',
    cls: 0, shifts: [],
    longTasks: [], loafs: [], events: [], fonts: [],
    marks: {}, errors: [], support: {},
  };
  window.__perf = P;
  const obs = (type, fn, opts) => {
    try {
      const o = new PerformanceObserver((l) => { for (const e of l.getEntries()) fn(e); });
      o.observe(Object.assign({ type, buffered: true }, opts || {}));
      P.support[type] = true;
      return o;
    } catch (e) { P.support[type] = false; return null; }
  };
  const name = (n) => {
    if (!n || !n.tagName) return '';
    let s = n.tagName.toLowerCase();
    if (n.id) s += '#' + n.id;
    else if (n.className && typeof n.className === 'string') s += '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.');
    return s;
  };

  obs('largest-contentful-paint', (e) => { P.lcp = e.startTime; P.lcpEl = name(e.element); P.lcpUrl = e.url || ''; });
  obs('layout-shift', (e) => {
    if (e.hadRecentInput) return;
    P.cls += e.value;
    if (e.value > 0.0005 && P.shifts.length < 40) {
      P.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), nodes: (e.sources || []).slice(0, 3).map((s) => name(s.node)) });
    }
  });
  obs('longtask', (e) => {
    if (P.longTasks.length > 400) return;
    const a = (e.attribution || [])[0];
    P.longTasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration), name: e.name, cn: a ? a.containerName || a.containerType || '' : '', src: a ? a.containerSrc || '' : '' });
  });
  // Chromium 123+: the only API that names the FUNCTION and the SCRIPT URL behind a slow frame.
  obs('long-animation-frame', (e) => {
    if (P.loafs.length > 300) return;
    P.loafs.push({
      t: Math.round(e.startTime), d: Math.round(e.duration),
      blocking: Math.round(e.blockingDuration || 0),
      styleAndLayout: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
      scripts: (e.scripts || []).slice(0, 4).map((s) => ({
        d: Math.round(s.duration), fwd: Math.round(s.forcedStyleAndLayoutDuration || 0),
        url: s.sourceURL || '', fn: s.sourceFunctionName || '', invoker: s.invoker || '',
      })),
    });
  });
  obs('event', (e) => {
    if (P.events.length > 600) return;
    P.events.push({ type: e.name, t: Math.round(e.startTime), d: Math.round(e.duration), target: name(e.target), interactionId: e.interactionId || 0 });
  }, { durationThreshold: 16 });
  obs('first-input', (e) => { P.fid = Math.round(e.processingStart - e.startTime); });

  // Fonts: when each face finished and what the page was showing meanwhile (FOIT vs FOUT).
  try {
    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', (ev) => {
        for (const f of ev.fontfaces || []) P.fonts.push({ family: f.family, weight: f.weight, display: f.display, t: Math.round(performance.now()) });
      });
      document.fonts.ready.then(() => { P.fontsReady = Math.round(performance.now()); });
    }
  } catch (e) { /* no font API */ }

  addEventListener('error', (e) => { if (P.errors.length < 20) P.errors.push(String((e && e.message) || e)); });
  addEventListener('unhandledrejection', (e) => { if (P.errors.length < 20) P.errors.push('rejection: ' + String(e.reason)); });

  // ── what the runner calls ───────────────────────────────────────────────────────────────────────────────────
  /** Frame deltas over the given duration, while the caller drives a scroll. Returns the raw deltas, in ms. */
  P.frames = (ms) => new Promise((done) => {
    const out = [];
    let last = performance.now();
    const t0 = last;
    const step = (now) => {
      out.push(now - last); last = now;
      if (now - t0 < ms) requestAnimationFrame(step); else done(out);
    };
    requestAnimationFrame(step);
  });

  /** A programmatic fling: scrollBy every frame, so the page does the same work a real finger makes it do. */
  P.fling = (px, perFrame) => new Promise((done) => {
    let moved = 0;
    const step = () => {
      const before = scrollY;
      scrollBy(0, perFrame);
      moved += perFrame;
      if (moved < px && scrollY !== before) requestAnimationFrame(step); else done({ moved, y: scrollY, h: document.documentElement.scrollHeight });
    };
    requestAnimationFrame(step);
  });

  P.heap = () => (performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null);

  P.dom = () => ({
    nodes: document.getElementsByTagName('*').length,
    imgs: document.images.length,
    imgsLoaded: Array.prototype.filter.call(document.images, (i) => i.complete).length,
    scrollH: document.documentElement.scrollHeight,
  });

  /** Bytes on the wire, by kind. transferSize is 0 for a cross-origin response without Timing-Allow-Origin and for
   *  a memory-cache hit, so encodedBodySize is reported beside it and the report says which is which. */
  P.resources = () => performance.getEntriesByType('resource').map((r) => ({
    url: r.name, kind: r.initiatorType, t: Math.round(r.startTime), dur: Math.round(r.duration),
    transfer: r.transferSize, encoded: r.encodedBodySize, decoded: r.decodedBodySize,
    cache: r.transferSize === 0 && r.decodedBodySize > 0 ? 'hit' : '',
    protocol: r.nextHopProtocol || '',
  }));

  P.nav = () => {
    const n = performance.getEntriesByType('navigation')[0];
    const paints = {};
    for (const p of performance.getEntriesByType('paint')) paints[p.name] = Math.round(p.startTime);
    if (!n) return { paints };
    return {
      paints,
      ttfb: Math.round(n.responseStart), domContentLoaded: Math.round(n.domContentLoadedEventEnd),
      load: Math.round(n.loadEventEnd), domInteractive: Math.round(n.domInteractive),
      transfer: n.transferSize, decoded: n.decodedBodySize, type: n.type,
    };
  };

  /** Decode cost of one picture, measured the way the browser pays it: fetch, then createImageBitmap. */
  P.decode = async (url) => {
    const t0 = performance.now();
    const res = await fetch(url, { cache: 'no-store' });
    const blob = await res.blob();
    const t1 = performance.now();
    let bmp = null, err = '';
    try { bmp = await createImageBitmap(blob); } catch (e) { err = String(e); }
    const t2 = performance.now();
    const out = { url, bytes: blob.size, fetchMs: +(t1 - t0).toFixed(1), decodeMs: +(t2 - t1).toFixed(1), w: bmp ? bmp.width : 0, h: bmp ? bmp.height : 0, err };
    if (bmp && bmp.close) bmp.close();
    return out;
  };

  P.reset = () => { P.cls = 0; P.shifts.length = 0; P.longTasks.length = 0; P.loafs.length = 0; P.events.length = 0; };
})();`;

/**
 * Frames slower than a budget, from raw rAF deltas. The first delta is noise (the gap to the first frame).
 *
 * READ `dropped` AND NOT `over16`. A 60 Hz display delivers frames at 16.67 ms, so a perfectly smooth scroll has
 * HALF its deltas measuring a hair over 16.7 — "42.9% of frames over 16.7 ms" on an idle desktop is vsync jitter,
 * not jank. A frame the reader actually loses is one that missed its slot: over 20 ms is a late frame and over
 * 33.3 ms is a frame the display showed twice. Those two are what a budget is set on. over16/over8 are kept
 * because they were asked for, and because at 120 Hz (an iPhone Pro) the 8.3 ms column is the real one.
 */
export function frameStats(deltas) {
  const d = deltas.slice(1).filter((x) => x > 0 && x < 2000);
  if (!d.length) return { frames: 0 };
  const sorted = [...d].sort((a, b) => a - b);
  const pct = (p) => +sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))].toFixed(1);
  const n = (f) => d.filter(f).length;
  return {
    frames: d.length,
    over16: n((x) => x > 16.7),
    over8: n((x) => x > 8.3),
    over20: n((x) => x > 20),
    dropped: n((x) => x > 33.3),
    over50: n((x) => x > 50),
    pctOver16: +((100 * n((x) => x > 16.7)) / d.length).toFixed(1),
    pctOver8: +((100 * n((x) => x > 8.3)) / d.length).toFixed(1),
    pctOver20: +((100 * n((x) => x > 20)) / d.length).toFixed(1),
    pctDropped: +((100 * n((x) => x > 33.3)) / d.length).toFixed(1),
    p50: pct(50), p95: pct(95), p99: pct(99), worst: +Math.max(...d).toFixed(1),
    /** the slowest twenty, so a report can show the shape of the jank and not only its percentage */
    slowest: sorted.slice(-20).reverse().map((x) => +x.toFixed(1)),
  };
}

/** Total Blocking Time: every long task's time beyond 50 ms, up to the end of the load window. */
export function tbt(longTasks, until = Infinity) {
  return Math.round(longTasks.filter((t) => t.t < until).reduce((s, t) => s + Math.max(0, t.d - 50), 0));
}

/** INP as the field metric defines it: the slowest interaction, by the group of events sharing an interactionId. */
export function inpOf(events) {
  const groups = new Map();
  for (const e of events) {
    if (!e.interactionId) continue;
    groups.set(e.interactionId, Math.max(groups.get(e.interactionId) ?? 0, e.d));
  }
  const all = [...groups.values()].sort((a, b) => b - a);
  return { inp: all[0] ?? 0, interactions: all.length, worst: all.slice(0, 5) };
}

/** Bytes by kind, from P.resources(). */
export function bytesByKind(resources) {
  const out = {};
  for (const r of resources) {
    const k = kindOf(r);
    const b = out[k] ?? (out[k] = { n: 0, transfer: 0, encoded: 0, decoded: 0, cached: 0 });
    b.n++; b.transfer += r.transfer || 0; b.encoded += r.encoded || 0; b.decoded += r.decoded || 0;
    if (r.cache === 'hit') b.cached++;
  }
  return out;
}

export function kindOf(r) {
  const u = r.url.split('?')[0];
  if (/\.woff2?$/.test(u)) return 'font';
  if (/\.css$/.test(u) || r.kind === 'css' || r.kind === 'link') return 'css';
  if (/\.m?js$/.test(u) || r.kind === 'script') return 'js';
  if (/\/pictures\/thumb\//.test(u)) return 'thumb';
  if (/\/pictures\/full\//.test(u)) return 'full';
  if (/\.(webp|png|jpe?g|svg|avif)$/.test(u) || r.kind === 'img') return 'image';
  if (/\/data\/reader\//.test(u)) return 'reader-data';
  if (/\.json$/.test(u) || r.kind === 'fetch' || r.kind === 'xmlhttprequest') return 'data';
  return 'other';
}
