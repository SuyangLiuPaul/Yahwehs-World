// Decoder for src/geo/world.bin.gz (written by scripts/build-geo.mjs).
//
// Pure: no DOM, no Vite imports, so scripts/verify-geo.mjs can run it in Node
// and compare the result with the Natural Earth GeoJSON it was made from.
//
// Layout (all integers are LEB128 varints, signed ones zigzag-encoded):
//   "YGEO" 0x01
//   scale                       coordinates are integers of 1/scale degree
//   layerCount
//   per layer:  kind (0 = polygons, 1 = lines), featureCount
//     per feature:  rank (0 = none; rivers carry Natural Earth's scalerank),
//                   partCount
//       per part:   ringCount
//         per ring: pointCount, then x0 y0 and (dx, dy) for each next point
//
// The result has the same shape src/types.ts calls GeoJson, so basemap.ts and
// staffage.ts did not have to change. A polygon feature with one part is a
// Polygon, with several a MultiPolygon (the holes stay rings of their part, so
// staffage's even-odd fill still punches them out); a line feature is one
// MultiLineString.
import type { GeoJson } from './types.ts';

export const GEO_LAYERS = ['land', 'coastline', 'lakes', 'rivers'] as const;
export type WorldGeo = Record<(typeof GEO_LAYERS)[number], GeoJson>;

export function decodeWorld(buf: Uint8Array): WorldGeo {
  let p = 0;
  const u = () => {
    let n = 0, m = 1, b: number;
    do { b = buf[p++]!; n += (b & 127) * m; m *= 128; } while (b & 128);
    return n;
  };
  const s = () => { const n = u(); return n & 1 ? -(n + 1) / 2 : n / 2; };
  if (String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!) !== 'YGEO' || buf[4] !== 1) throw new Error('not a YGEO v1 file');
  p = 5;
  const scale = u();
  const layers = u();
  const out = {} as WorldGeo;
  for (let l = 0; l < layers; l++) {
    const kind = u(), nFeat = u();
    const features: GeoJson['features'] = [];
    for (let f = 0; f < nFeat; f++) {
      const rank = u(), nParts = u();
      const parts: number[][][][] = [];
      for (let k = 0; k < nParts; k++) {
        const nRings = u(), rings: number[][][] = [];
        for (let r = 0; r < nRings; r++) {
          const n = u(), ring: number[][] = new Array(n);
          let x = 0, y = 0;
          for (let i = 0; i < n; i++) { x += s(); y += s(); ring[i] = [x / scale, y / scale]; }
          rings.push(ring);
        }
        parts.push(rings);
      }
      const geometry = kind === 0
        ? (parts.length === 1 ? { type: 'Polygon', coordinates: parts[0]! } : { type: 'MultiPolygon', coordinates: parts })
        : { type: 'MultiLineString', coordinates: parts.flat() };
      features.push(rank ? { geometry, properties: { scalerank: rank } } : { geometry });
    }
    out[GEO_LAYERS[l]!] = { type: 'FeatureCollection', features };
  }
  return out;
}
