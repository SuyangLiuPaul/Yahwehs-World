// The arithmetic of the performance harness, tested without a browser.
//
// tools/perf/lib/probe.mjs is half instrumentation (a string injected into the page, which only a browser can run)
// and half reduction: frame deltas to a jank percentage, long tasks to Total Blocking Time, event timings to INP,
// resource rows to bytes per kind. The reduction is what every number in docs/review/perf-audit-2026-11-04.md and
// every budget in tools/perf/budgets.json is computed with, so it is tested here: a harness that counts wrong turns
// a regression into a green run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { frameStats, tbt, inpOf, bytesByKind, kindOf, INIT_SCRIPT } from '../../tools/perf/lib/probe.mjs';

test('frameStats drops the first delta and counts the two thresholds', () => {
  // first value is the gap to the first frame and is not a frame time
  const f = frameStats([900, 16, 16, 17, 40, 8, 8.5, 120]);
  assert.equal(f.frames, 7);
  assert.equal(f.over16, 3, '17, 40 and 120 are over 16.7; 16 and 16 are not');
  assert.equal(f.over50, 1);
  assert.equal(f.worst, 120);
  assert.equal(f.over8, 6, '16, 16, 17, 40, 8.5, 120 are over 8.3');
  assert.equal(f.pctOver16, +((100 * 3) / 7).toFixed(1));
  // the two that a budget is actually set on
  assert.equal(f.over20, 2, '40 and 120 are over 20');
  assert.equal(f.dropped, 2, '40 and 120 missed a 30 Hz slot too');
  assert.deepEqual(f.slowest.slice(0, 3), [120, 40, 17], 'slowest first, so the shape of the jank is visible');
});

test('frameStats does not report vsync jitter as jank', () => {
  // 600 frames of a perfectly smooth 60 Hz scroll, as a browser actually times them
  const smooth = [900, ...Array.from({ length: 600 }, (_v, i) => (i % 2 ? 16.6 : 16.8))];
  const f = frameStats(smooth);
  assert.ok(f.pctOver16 > 40, 'half of a smooth run is over 16.7 — which is why that column is not the budget');
  assert.equal(f.dropped, 0);
  assert.equal(f.over20, 0);
});

test('frameStats throws nothing on an empty or absurd series', () => {
  assert.equal(frameStats([]).frames, 0);
  assert.equal(frameStats([900]).frames, 0);
  assert.equal(frameStats([900, 5000, 16]).frames, 1, 'a 5 s delta is a tab switch, not a frame');
});

test('tbt counts only the part of a long task beyond 50 ms', () => {
  const tasks = [{ t: 100, d: 60 }, { t: 200, d: 50 }, { t: 300, d: 250 }];
  assert.equal(tbt(tasks), 10 + 0 + 200);
  assert.equal(tbt(tasks, 250), 10, 'a window cuts off the tasks that start after it');
});

test('inpOf takes the slowest interaction, grouped the way the field metric groups it', () => {
  // one tap is pointerdown + pointerup + click sharing an interactionId; the slowest of the group is the number
  const events = [
    { type: 'pointerdown', d: 20, interactionId: 1 },
    { type: 'click', d: 180, interactionId: 1 },
    { type: 'keydown', d: 40, interactionId: 2 },
    { type: 'mousemove', d: 900, interactionId: 0 },
  ];
  const r = inpOf(events);
  assert.equal(r.inp, 180);
  assert.equal(r.interactions, 2, 'a move with no interactionId is not an interaction');
  assert.deepEqual(r.worst, [180, 40]);
});

test('inpOf on a page nobody touched is 0, not NaN', () => {
  assert.deepEqual(inpOf([]), { inp: 0, interactions: 0, worst: [] });
});

test('kindOf tells this product\'s four picture and data kinds apart', () => {
  assert.equal(kindOf({ url: 'https://x/pictures/thumb/genesis-1-1.webp', kind: 'img' }), 'thumb');
  assert.equal(kindOf({ url: 'https://x/pictures/full/genesis-1-1.webp', kind: 'img' }), 'full');
  assert.equal(kindOf({ url: 'https://x/data/reader/text/bsb-yhwh/19.json', kind: 'fetch' }), 'reader-data');
  assert.equal(kindOf({ url: 'https://x/data/gallery/index.json', kind: 'fetch' }), 'data');
  assert.equal(kindOf({ url: 'https://x/fonts/NotoSerifSC-500-cjk-sc-serif.woff2', kind: 'css' }), 'font');
  assert.equal(kindOf({ url: 'https://x/assets/main-abc.js', kind: 'script' }), 'js');
  assert.equal(kindOf({ url: 'https://x/assets/main-abc.css', kind: 'link' }), 'css');
  assert.equal(kindOf({ url: 'https://x/brand-logo.webp?v=2', kind: 'img' }), 'image');
});

test('bytesByKind adds up per kind and counts cache hits', () => {
  const b = bytesByKind([
    { url: '/assets/a.js', kind: 'script', transfer: 1000, encoded: 900, decoded: 3000, cache: '' },
    { url: '/assets/b.js', kind: 'script', transfer: 0, encoded: 0, decoded: 2000, cache: 'hit' },
    { url: '/pictures/thumb/x.webp', kind: 'img', transfer: 5000, encoded: 5000, decoded: 5000, cache: '' },
  ]);
  assert.equal(b.js.n, 2);
  assert.equal(b.js.transfer, 1000);
  assert.equal(b.js.cached, 1, 'a memory-cache hit reports transferSize 0 and must be counted, not dropped');
  assert.equal(b.thumb.transfer, 5000);
});

test('the injected script is one expression and names only __perf', () => {
  // A stray backtick or a second global would either break the template literal or touch the page under test.
  assert.ok(!INIT_SCRIPT.includes('`'), 'no backtick may survive inside the template literal');
  assert.match(INIT_SCRIPT, /^\(\(\) => \{/);
  assert.match(INIT_SCRIPT, /\}\)\(\);$/);
  const globals = [...INIT_SCRIPT.matchAll(/window\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(globals)], ['__perf'], 'the probe must not write any other global');
  // the measurement must survive an engine that lacks an observer type rather than throwing
  assert.match(INIT_SCRIPT, /catch \(e\) \{ P\.support\[type\] = false; return null; \}/);
});
