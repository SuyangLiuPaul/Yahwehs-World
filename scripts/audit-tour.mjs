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
    const legs = [];
    for (let i = 1; i < stops.length; i++) {
      const prev = stops[i - 1], s = stops[i];
      if (s.cut) continue; // an educational cut is a fade, not a flight
      const pts = [prev, ...(s.via ?? []), s].map((p) => [p.x * cubit, p.z * cubit]);
      let hits = 0, samples = 0;
      for (let k = 1; k < pts.length; k++) {
        const [ax, az] = pts[k - 1], [bx, bz] = pts[k];
        const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.15));
        for (let j = 0; j <= n; j++) {
          const t = j / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          samples++;
          // The eye and a small body around it, so grazing a wall counts.
          const inside = W.colliders.some((c) =>
            x >= c.min.x - 0.15 && x <= c.max.x + 0.15 &&
            z >= c.min.z - 0.15 && z <= c.max.z + 0.15 &&
            EYE >= c.min.y && EYE <= c.max.y);
          if (inside) hits++;
        }
      }
      legs.push({ leg: `${i} → ${s.en.slice(0, 40)}`, samples, hits, via: (s.via ?? []).length });
    }
    const seconds = stops.reduce((a, s) => a + s.travel + s.dwell, 0);
    return { legs, seconds };
  }, handle);
  console.log(`\n${path} — tour runs ${Math.round(report.seconds)} s`);
  for (const l of report.legs) {
    const flag = l.hits ? '  ✗' : '   ';
    console.log(`${flag} ${l.leg.padEnd(46)} ${String(l.hits).padStart(3)} / ${String(l.samples).padStart(3)} samples inside a collider${l.via ? `  (via ${l.via})` : ''}`);
    if (l.hits) bad++;
  }
}
await browser.close();
console.log(bad ? `\n${bad} legs pass through something solid.` : '\nNo leg passes through anything solid.');
process.exit(bad ? 1 : 0);
