// Builds src/geo/world.bin.gz from the Natural Earth GeoJSON in public/data.
//
//   node scripts/build-geo.mjs
//
// Why: the globe's four layers were 4.9 MB of GeoJSON (about 1.5 MB on the wire
// even with brotli) and every digit past the second decimal was thrown away by
// the 4096x2048 canvas they are painted on (0.088 degrees to the pixel).
//   - coordinates are snapped to 0.01 degree (a tenth of a pixel);
//   - rings are simplified with Douglas-Peucker at 0.02 degree (a quarter of a
//     pixel), never below 4 points for a polygon ring or 2 for a line;
//   - everything but Natural Earth's river rank is dropped (basemap.ts and
//     staffage.ts read nothing else);
//   - integers are delta-coded as varints, then gzip -9. Gzip rather than brotli
//     because a browser can undo it with DecompressionStream, and a .gz is not
//     recompressed by the host (an octet-stream would be sent as it is).
// The originals in public/data stay: they are the fallback for a browser
// without DecompressionStream and the input of scripts/build-relief.py.
// Vite hashes the output name (src/geo.ts imports it with ?url), so it is
// served immutable. Format: src/geo-codec.ts. Check: node scripts/verify-geo.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SCALE = 100;
export const TOLERANCE = 0.02;
const MAX_CHORD = 30; // degrees
const LAYERS = [
  ['land', 'ne_50m_land.geojson', 0],
  ['coastline', 'ne_50m_coastline.geojson', 1],
  ['lakes', 'ne_50m_lakes.geojson', 0],
  ['rivers', 'ne_50m_rivers_lake_centerlines.geojson', 1],
];

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let worst = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i];
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
      if (d > worst) { worst = d; at = i; }
    }
    // A chord longer than MAX_CHORD is never accepted, however straight the
    // points under it are: the 360-degree bottom edge of Antarctica is a run of
    // collinear vertices, and merged into one segment it would look like an
    // antimeridian jump to basemap.ts and be cut.
    const longChord = Math.max(Math.abs(dx), Math.abs(dy)) > MAX_CHORD && b - a > 1;
    if (longChord && !(at > 0 && worst > tol)) at = a + ((b - a) >> 1);
    if (at > 0 && (worst > tol || longChord)) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Antarctica and a few Pacific rings cross the antimeridian; basemap.ts breaks
// the path where two points are more than half the map apart. Douglas-Peucker
// must not see that jump as a real 360-degree segment (it deleted the points
// that make the polygon), so each run between jumps is simplified on its own
// and the run ends, which are the jump's two sides, are always kept.
function simplifyRing(ring, tol) {
  const runs = []; let from = 0;
  for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) { runs.push(ring.slice(from, i)); from = i; }
  runs.push(ring.slice(from));
  return runs.flatMap((r) => simplify(r, tol));
}

const out = [];
const u = (n) => { while (n > 127) { out.push((n & 127) | 128); n = Math.floor(n / 128); } out.push(n); };
const s = (n) => u(n < 0 ? -n * 2 - 1 : n * 2);

out.push(...Buffer.from('YGEO'), 1);
u(SCALE); u(LAYERS.length);
let before = 0, after = 0;
for (const [, file, kind] of LAYERS) {
  const g = JSON.parse(readFileSync(join(ROOT, 'public/data', file), 'utf8'));
  u(kind); u(g.features.length);
  for (const f of g.features) {
    const geom = f.geometry;
    // Polygon -> 1 part of N rings; MultiPolygon -> N parts; a LineString or
    // MultiLineString -> one part whose rings are the lines.
    let parts = [];
    if (!geom || !geom.coordinates) parts = [];
    else if (geom.type === 'Polygon') parts = [geom.coordinates];
    else if (geom.type === 'MultiPolygon') parts = geom.coordinates;
    else if (geom.type === 'LineString') parts = [[geom.coordinates]];
    else if (geom.type === 'MultiLineString') parts = [geom.coordinates];
    else throw new Error('unexpected geometry ' + geom.type);
    parts = parts.map((rings) => rings.filter((r) => r.length));
    const rank = f.properties && f.properties.scalerank != null ? Math.min(6, Math.max(1, Number(f.properties.scalerank))) : 0;
    u(file.includes('rivers') ? rank || 6 : 0);
    u(parts.length);
    for (const rings of parts) {
      u(rings.length);
      for (const ring of rings) {
        before += ring.length;
        const closed = kind === 0;
        const min = closed ? Math.min(4, ring.length) : Math.min(2, ring.length);
        // A tiny island or pond can collapse to a sliver: halve the tolerance
        // until the ring keeps its shape (>= 4 points closed, >= 2 for a line).
        let r = simplifyRing(ring, TOLERANCE);
        for (let t = TOLERANCE; r.length < min && t > 1e-6; t /= 2) r = simplifyRing(ring, t);
        if (r.length < min) r = ring;
        after += r.length;
        u(r.length);
        let px = 0, py = 0;
        for (const [x, y] of r) {
          const X = Math.round(x * SCALE), Y = Math.round(y * SCALE);
          s(X - px); s(Y - py); px = X; py = Y;
        }
      }
    }
  }
}
const bin = Buffer.from(out);
const gz = gzipSync(bin, { level: 9 });
mkdirSync(join(ROOT, 'src/geo'), { recursive: true });
writeFileSync(join(ROOT, 'src/geo/world.bin.gz'), gz);
console.log(`geo: ${before} -> ${after} points, ${bin.length} B binary, ${gz.length} B gzip -> src/geo/world.bin.gz`);
