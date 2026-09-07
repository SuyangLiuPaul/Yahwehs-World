import { palette } from './theme.ts';
import type { GeoJson } from './types.ts';

// The globe's surface is painted here, once, into an equirectangular canvas
// that is then wrapped on the sphere. Painting in 2D rather than triangulating
// polygons on the sphere is the single biggest simplification in this renderer:
// coastlines, lakes and rivers are just strokes and fills, the projection is
// one multiply, and the whole basemap costs one texture instead of tens of
// thousands of triangles.
const W = 4096;
const H = 2048;

const project = (lon: number, lat: number): [number, number] => [
  ((lon + 180) / 360) * W,
  ((90 - lat) / 180) * H,
];

/** Walks a GeoJSON geometry's rings, ignoring the Polygon/MultiPolygon and
 *  LineString/MultiLineString distinction — for painting, a ring is a ring. */
function eachRing(geom: { type: string; coordinates: unknown } | null, fn: (ring: number[][]) => void) {
  if (!geom) return;
  const c = geom.coordinates as never;
  switch (geom.type) {
    case 'Polygon': (c as unknown as number[][][]).forEach(fn); break;
    case 'MultiPolygon': (c as unknown as number[][][][]).forEach((poly) => poly.forEach(fn)); break;
    case 'LineString': fn(c as unknown as number[][]); break;
    case 'MultiLineString': (c as unknown as number[][][]).forEach(fn); break;
  }
}

/** Traces a ring, breaking the path where it wraps the antimeridian so a
 *  polygon spanning the date line does not smear a stripe across the map. */
function trace(ctx: CanvasRenderingContext2D, ring: number[][]) {
  let prevX: number | null = null;
  ctx.beginPath();
  for (const pt of ring) {
    const [lon, lat] = pt as [number, number];
    const [x, y] = project(lon, lat);
    if (prevX !== null && Math.abs(x - prevX) > W / 2) ctx.moveTo(x, y);
    else if (prevX === null) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    prevX = x;
  }
}

/** Parchment grain. Real manuscript maps are never flat colour, and a little
 *  low-frequency noise is what keeps the land from reading as plastic. */
function grain(ctx: CanvasRenderingContext2D) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i]! + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1]! + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);
}

export function paintBasemap(layers: {
  land: GeoJson; coastline: GeoJson; lakes: GeoJson; rivers: GeoJson;
}): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  ctx.fillStyle = palette.sea;
  ctx.fillRect(0, 0, W, H);

  // Land first, as solid parchment.
  ctx.fillStyle = palette.land;
  for (const f of layers.land.features) {
    eachRing(f.geometry, (ring) => { trace(ctx, ring); ctx.closePath(); ctx.fill(); });
  }

  // Lakes and rivers punched back out of the land.
  ctx.fillStyle = palette.lake;
  for (const f of layers.lakes.features) {
    eachRing(f.geometry, (ring) => { trace(ctx, ring); ctx.closePath(); ctx.fill(); });
  }
  ctx.strokeStyle = palette.river; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  for (const f of layers.rivers.features) eachRing(f.geometry, (ring) => { trace(ctx, ring); ctx.stroke(); });

  // The gilded coast goes on last so nothing paints over it.
  ctx.strokeStyle = palette.coast; ctx.lineWidth = 2.2;
  for (const f of layers.coastline.features) eachRing(f.geometry, (ring) => { trace(ctx, ring); ctx.stroke(); });

  // Graticule, faint — it reads as a chart rather than a photograph.
  ctx.strokeStyle = palette.graticule; ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 15) {
    const [x] = project(lon, 0);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const [, y] = project(0, lat);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  grain(ctx);
  return canvas;
}
