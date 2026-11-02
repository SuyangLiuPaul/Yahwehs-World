// Checks src/geo/world.bin.gz against the Natural Earth files it was built from.
//   node scripts/verify-geo.mjs
// For every layer: same features, same parts and rings, and no original vertex
// farther than 0.035 degree (under half a canvas pixel) from the decoded
// outline; river ranks preserved. Exits non-zero otherwise.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeWorld, GEO_LAYERS } from '../src/geo-codec.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = { land: 'ne_50m_land', coastline: 'ne_50m_coastline', lakes: 'ne_50m_lakes', rivers: 'ne_50m_rivers_lake_centerlines' };
const MAX = 0.035;
let bad = 0;
const fail = (m) => { bad++; console.error('FAIL ' + m); };
const world = decodeWorld(new Uint8Array(gunzipSync(readFileSync(join(ROOT, 'src/geo/world.bin.gz')))));

const rings = (g) => {
  if (!g || !g.coordinates) return [];
  if (g.type === 'Polygon') return [g.coordinates.filter((r) => r.length)];
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p.filter((r) => r.length));
  if (g.type === 'LineString') return [[g.coordinates]];
  return [g.coordinates.filter((r) => r.length)];
};
function distToPolyline(p, line) {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length || i === 0; i++) {
    const a = line[i], b = line[Math.min(i + 1, line.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return best;
}
for (const name of GEO_LAYERS) {
  const orig = JSON.parse(readFileSync(join(ROOT, 'public/data', FILES[name] + '.geojson'), 'utf8'));
  const got = world[name];
  if (got.features.length !== orig.features.length) { fail(`${name}: ${got.features.length} features, expected ${orig.features.length}`); continue; }
  let worst = 0, pts = 0;
  orig.features.forEach((f, i) => {
    const a = rings(f.geometry), b = rings(got.features[i].geometry);
    // The decoder returns a polygon feature's parts as parts and a line
    // feature's lines as one part, exactly as rings() flattens the originals.
    const bFlat = got.features[i].geometry?.type === 'MultiLineString' ? [b.flat()] : b;
    if (a.length !== bFlat.length) return fail(`${name}[${i}]: ${bFlat.length} parts, expected ${a.length}`);
    a.forEach((pa, k) => {
      if (pa.length !== bFlat[k].length) return fail(`${name}[${i}] part ${k}: ring count`);
      pa.forEach((ring, r) => {
        const dec = bFlat[k][r];
        for (const pt of ring) { const d = distToPolyline(pt, dec); pts++; if (d > worst) worst = d; }
      });
    });
    if (name === 'rivers') {
      const want = Math.min(6, Math.max(1, Number(f.properties?.scalerank ?? 6)));
      if (got.features[i].properties?.scalerank !== want) fail(`rivers[${i}]: rank`);
    }
  });
  if (worst > MAX) fail(`${name}: worst vertex ${worst.toFixed(4)} deg from the decoded outline (limit ${MAX})`);
  console.log(`${name.padEnd(10)} ${got.features.length} features, ${pts} vertices checked, worst deviation ${worst.toFixed(4)} deg`);
}
console.log(bad ? `${bad} problem(s)` : 'ok');
process.exit(bad ? 1 : 0);
