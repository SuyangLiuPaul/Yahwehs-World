// Measures what a visitor on their own feet can actually do: how fast they
// cross the court, how high they jump, and how high they can climb.
//
// The owner walked the temple and reported three things in one sentence —
// too slow, no jump, and "上阶梯也上不了", you cannot go up the stairs. All
// three are numbers. The walker had no vertical axis at all, so the ramp up
// to the bronze altar (Exodus 20:26 forbids steps, so the text implies a
// slope) and the winding stair of 1 Kgs 6:8 were scenery you bumped into.
//
// The climb test drives a bot that only knows one thing: which way is up. Ten
// times a second it looks at twelve headings, asks which one has a surface it
// could step onto, and turns toward the highest. It holds W and nothing else,
// and the climbing itself is done by the walker's own physics. That is a
// reachability test — a scripted path up the spiral would prove only that I
// can write one.
//
// Usage: node scripts/audit-walk.mjs [url]   (dev server must be running)
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:5175';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let bad = 0;

const report = async (path, handle, probes) => {
  await page.goto(URL + path, { waitUntil: 'networkidle' });
  await page.waitForFunction((h) => !!globalThis[h], handle, { timeout: 30_000 });
  // The expectations stay on this side of the bridge: a function cannot be
  // serialised into the page, and the page has no business holding the
  // thresholds anyway.
  const plain = probes.map(({ want, ...rest }) => rest);
  const rows = await page.evaluate(([h, probeList]) => {
    const W = globalThis[h];
    const { walker, renderer, CUBIT } = W;
    renderer.setAnimationLoop(null);     // drive the walk deterministically
    const DT = 1 / 60;
    const key = (code, type) => dispatchEvent(new KeyboardEvent(type, { code }));
    const hold = (codes) => codes.forEach((c) => key(c, 'keydown'));
    const release = () => ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']
      .forEach((c) => key(c, 'keyup'));
    const eye = () => walker.position.y;

    // The walker's own constants, for the steering only: the physics below is
    // the walker's, not a copy of it.
    const EYE = 1.65, R = 0.32, STEP = 0.62, HEAD = 1.78;
    const solids = () => W.colliders;
    const surfaces = () => [...W.colliders, ...W.platforms];
    const supportAt = (x, z, limit) => {
      let top = W.floorY ?? 0;
      for (const c of surfaces())
        if (!(c.max.y > limit || x + R < c.min.x || x - R > c.max.x ||
              z + R < c.min.z || z - R > c.max.z)) top = Math.max(top, c.max.y);
      return top;
    };
    const blocked = (x, z, feet) => solids().some((c) =>
      !(c.max.y <= feet + 0.05 || c.min.y >= feet + HEAD ||
        x + R < c.min.x || x - R > c.max.x || z + R < c.min.z || z - R > c.max.z));
    // Look around; head for the highest thing you could step onto.
    const uphill = (x, z, feet, heading) => {
      let best = heading, bestTop = -Infinity, bestTurn = Infinity;
      for (let i = 0; i < 12; i++) {
        const a = heading + (i * Math.PI * 2) / 12;
        const px = x - Math.sin(a) * 0.45, pz = z - Math.cos(a) * 0.45;
        const top = supportAt(px, pz, feet + STEP);
        if (blocked(px, pz, Math.max(top, feet))) continue;
        const turn = Math.abs(Math.atan2(Math.sin(a - heading), Math.cos(a - heading)));
        if (top > bestTop + 0.005 || (Math.abs(top - bestTop) <= 0.005 && turn < bestTurn)) {
          best = a; bestTop = top; bestTurn = turn;
        }
      }
      return best;
    };

    const out = [];
    for (const p of probeList) {
      release();
      walker.moveTo(p.from[0] * CUBIT, p.from[1] * CUBIT, p.face, p.ceiling ?? Infinity);
      const start = { x: walker.position.x, z: walker.position.z, y: eye() };
      let top = start.y, lowest = start.y, heading = p.face;
      let reached = null;
      hold(p.keys);
      const frames = Math.round(p.seconds / DT);
      for (let f = 0; f < frames; f++) {
        if (p.climb && f % 6 === 0) {
          heading = uphill(walker.position.x, walker.position.z, eye() - EYE, heading);
          walker.yaw.rotation.y = heading;
        }
        walker.update(DT);
        top = Math.max(top, eye());
        lowest = Math.min(lowest, eye());
        if (p.target !== undefined && reached === null && eye() - start.y >= p.target * CUBIT) {
          reached = ((f + 1) * DT);
        }
      }
      release();
      const travelled = Math.hypot(walker.position.x - start.x, walker.position.z - start.z);
      out.push({
        name: p.name,
        metres: +travelled.toFixed(2),
        speed: +(travelled / p.seconds).toFixed(2),
        rise: +(top - start.y).toFixed(2),
        riseCubits: +((top - start.y) / CUBIT).toFixed(1),
        sank: +(start.y - lowest).toFixed(2),
        reached: reached === null ? null : +reached.toFixed(1),
      });
    }
    return out;
  }, [handle, plain]);
  return rows.map((r, i) => ({ ...r, want: probes[i].want }));
};

const SHOW = (rows, title) => {
  console.log(`\n${title}`);
  for (const r of rows) {
    const ok = r.want(r);
    if (!ok) bad++;
    console.log(`${ok ? '   ' : '  ✗'} ${r.name.padEnd(34)} ${String(r.speed).padStart(5)} m/s   ` +
      `rose ${String(r.rise).padStart(5)} m (${r.riseCubits} cubits)` +
      (r.reached === null ? '' : `   top in ${r.reached} s`));
  }
};

// Cubit coordinates, matching src/walk/temple.ts and src/walk/tabernacle.ts.
const temple = await report('/temple.html', '__temple', [
  // A clear lane: down the north side of the court, between the lavers and
  // the wall. A speed measured against a laver is a measure of the laver.
  { name: 'crossing the court, walking', from: [60, 31], face: Math.PI / 2, keys: ['KeyW'],
    seconds: 3, ceiling: 0.5, want: (r) => r.speed > 4.2 && r.speed < 5.2 },
  { name: 'crossing the court, running', from: [60, 31], face: Math.PI / 2, keys: ['KeyW', 'ShiftLeft'],
    seconds: 3, ceiling: 0.5, want: (r) => r.speed > 8.4 },
  { name: 'a jump from standing', from: [60, 31], face: 0, keys: ['Space'],
    seconds: 1.2, ceiling: 0.5, want: (r) => r.rise > 0.6 && r.rise < 1.1 },
  // North up the ramp: it rises from the ground at its south end to the
  // altar's ten cubits. Anything over 9 cubits of gain is the top of it.
  { name: 'up the ramp to the altar', from: [61, -33], face: Math.PI, keys: ['KeyW'],
    seconds: 8, ceiling: 0.5, climb: true, target: 9, want: (r) => r.riseCubits >= 9 },
  // In at the chambers' door (6:8) and up the winding stair to the roof of
  // the side chambers, fifteen cubits.
  // From the door of 6:8, on the south side, up the winding stair to the roof
  // of the side chambers at fifteen cubits.
  { name: 'up the winding stair (6:8)', from: [-2.6, -19], face: Math.PI, keys: ['KeyW'],
    seconds: 25, ceiling: 0.5, climb: true, target: 14, want: (r) => r.riseCubits >= 14 },
]);
SHOW(temple, '/temple.html — what a visitor can do on their own feet');

const tent = await report('/tabernacle.html', '__walk', [
  { name: 'crossing the court, walking', from: [40, 12], face: Math.PI / 2, keys: ['KeyW'],
    seconds: 3, ceiling: 0.5, want: (r) => r.speed > 4.2 && r.speed < 5.2 },
  { name: 'a jump from standing', from: [40, 12], face: 0, keys: ['Space'],
    seconds: 1.2, ceiling: 0.5, want: (r) => r.rise > 0.6 && r.rise < 1.1 },
  { name: 'standing on the sand', from: [40, 12], face: 0, keys: [],
    seconds: 1.5, ceiling: 0.5, want: (r) => r.sank < 0.05 && r.rise < 0.05 },
]);
SHOW(tent, '/tabernacle.html — the same controls, unchanged geometry');

await browser.close();
console.log(bad ? `\n${bad} of the walk's own promises are not kept.` : '\nEvery promise the walk makes is kept.');
process.exit(bad ? 1 : 0);
