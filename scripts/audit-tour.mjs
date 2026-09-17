// Drives each walk's guided tour along the path the camera will actually take
// and counts the frames where the eye is inside something solid.
//
// The owner watched the temple tour and reported the camera passing through
// buildings. That is not a matter of taste: the tour moves the camera in a
// straight line from one stop to the next, and a straight line from the altar
// to the molten sea goes through the altar. Whether a leg does that is a
// number — sample the leg, test each sample against the colliders the walk
// already uses to keep WASD out of walls — so it is measured here, per leg,
// before and after any change to the stops.
//
// Usage: node scripts/audit-tour.mjs [url]   (dev server must be running)
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:5175';
const PAGES = [
  { path: '/tabernacle.html', handle: '__walk' },
  { path: '/temple.html', handle: '__temple' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let bad = 0;
for (const { path, handle } of PAGES) {
  await page.goto(URL + path, { waitUntil: 'networkidle' });
  await page.waitForFunction((h) => !!globalThis[h], handle, { timeout: 30_000 });
  const report = await page.evaluate((h) => {
    const W = globalThis[h];
    const cubit = W.CUBIT;
    const EYE = 1.65;
    const stops = W.TOUR;
    // The same path the Tour class walks: from the previous stop, through any
    // `via` waypoints, to this stop, in metres.
    // A stop may stand above head height — the temple's approach and its roof
    // views do. Testing every leg at a fixed 1.65 m would call a pass ABOVE
    // the roof a collision with it, and would miss one that is genuinely
    // through a wall on the way down, so the eye's own height is interpolated
    // along the leg exactly as the Tour interpolates it.
    const eyeOf = (s) => (s.y === undefined ? EYE : s.y * cubit);
    // A house on a mountain gives the camera a second way to be inside
    // something solid, and the colliders know nothing about it: the ground
    // itself. Every sample is also tested against the height field the walker
    // stands on — three of my own first framings of the mount were taken from
    // inside the hill, which is how this check came to exist.
    const ground = typeof W.floorY === 'function' ? W.floorY : null;
    const legs = [];
    for (let i = 1; i < stops.length; i++) {
      const prev = stops[i - 1], s = stops[i];
      if (s.cut) continue; // an educational cut is a fade, not a flight
      const pts = [prev, ...(s.via ?? []), s].map((p) => [p.x * cubit, p.z * cubit]);
      const y0 = eyeOf(prev), y1 = eyeOf(s);
      // Arc length, so the eye's height moves with the camera and not with
      // the waypoint index.
      const seg = [];
      let total = 0;
      for (let k = 1; k < pts.length; k++) {
        const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        seg.push(d); total += d;
      }
      let done = 0;
      let hits = 0, samples = 0, lowest = Infinity, highest = -Infinity, buried = 0;
      for (let k = 1; k < pts.length; k++) {
        const [ax, az] = pts[k - 1], [bx, bz] = pts[k];
        const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.15));
        for (let j = 0; j <= n; j++) {
          const t = j / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          const u = total > 0 ? (done + seg[k - 1] * t) / total : 1;
          const y = y0 + (y1 - y0) * u;
          lowest = Math.min(lowest, y); highest = Math.max(highest, y);
          samples++;
          // The eye and a small body around it, so grazing a wall counts.
          const inside = W.colliders.some((c) =>
            x >= c.min.x - 0.15 && x <= c.max.x + 0.15 &&
            z >= c.min.z - 0.15 && z <= c.max.z + 0.15 &&
            y >= c.min.y && y <= c.max.y);
          if (inside) hits++;
          if (ground && y < ground(x, z) + 0.3) buried++;
        }
        done += seg[k - 1];
      }
      legs.push({
        leg: `${i} → ${s.en.slice(0, 40)}`, samples, hits: hits + buried, buried, via: (s.via ?? []).length,
        eye: highest - lowest < 0.05 ? `${lowest.toFixed(1)} m` : `${lowest.toFixed(1)}–${highest.toFixed(1)} m`,
      });
    }
    const seconds = stops.reduce((a, s) => a + s.travel + s.dwell, 0);
    return { legs, seconds };
  }, handle);
  console.log(`\n${path} — tour runs ${Math.round(report.seconds)} s`);
  for (const l of report.legs) {
    const flag = l.hits ? '  ✗' : '   ';
    console.log(`${flag} ${l.leg.padEnd(46)} ${String(l.hits).padStart(3)} / ${String(l.samples).padStart(3)} inside${l.buried ? ` (${l.buried} in the ground)` : ' a collider'}   eye ${l.eye.padEnd(12)}${l.via ? `(via ${l.via})` : ''}`);
    if (l.hits) bad++;
  }
}
await browser.close();
console.log(bad ? `\n${bad} legs pass through something solid.` : '\nNo leg passes through anything solid.');
process.exit(bad ? 1 : 0);
