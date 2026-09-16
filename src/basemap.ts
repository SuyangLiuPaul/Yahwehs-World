import { palette } from './theme.ts';
import type { GeoJson } from './types.ts';

// The globe's surface is painted here, once, into an equirectangular canvas
// that is then wrapped on the sphere. Painting in 2D rather than triangulating
// polygons on the sphere is the single biggest simplification in this renderer:
// coastlines, lakes and rivers are just strokes and fills, the projection is
// one multiply, and the whole basemap costs one texture instead of tens of
// thousands of triangles.
// Exported so any other consumer of the same `land` GeoJSON — the sea/land
// mask in staffage.ts, notably — rasterizes at the same fidelity this paints
// at. A mask coarser than the coastline it's checking against silently
// smooths away real headlands and inlets, reading as "water" a little past
// where the drawn coastline actually ends.
export const W = 4096;
export const H = 2048;

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

/** A random value at every grid point, bilinearly sampled in between. Cheap
 *  low-frequency noise: real parchment mottles in blotches the size of a
 *  fingerprint, not grain the size of a pixel, and a value-noise grid several
 *  hundred times coarser than the canvas is what makes that shape. */
function makeValueNoise(gw: number, gh: number) {
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random() * 2 - 1;
  return (u: number, v: number) => {
    const gx = u * (gw - 1), gy = v * (gh - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, gw - 1), y1 = Math.min(y0 + 1, gh - 1);
    const fx = gx - x0, fy = gy - y0;
    const a = grid[y0 * gw + x0]!, b = grid[y0 * gw + x1]!;
    const c = grid[y1 * gw + x0]!, d = grid[y1 * gw + x1]!;
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
}

/** Parchment grain. Real manuscript maps are never flat colour, and a little
 *  low-frequency mottling is what keeps the land from reading as plastic — the
 *  old version added independent per-pixel white noise, which is closer to
 *  television static than to a stained sheet, however small its amplitude. Two
 *  octaves of value noise stand in for the coarse blotch a real skin has and
 *  the finer mottling inside it. */
function grain(ctx: CanvasRenderingContext2D) {
  const coarse = makeValueNoise(48, 24);
  const fine = makeValueNoise(160, 80);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const n = coarse(u, v) * 11 + fine(u, v) * 5;
      const i = (y * W + x) * 4;
      d[i] = Math.max(0, Math.min(255, d[i]! + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1]! + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2]! + n));
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Natural Earth's importance rank for a river, 1 (the Nile) to 6 (a
 *  tributary too small to name). Lower is more important; a feature with no
 *  rank at all is drawn at the thin end rather than dropped. */
function riverWidth(f: GeoJson['features'][number]): number {
  const rank = Math.min(6, Math.max(1, Number(f.properties?.scalerank ?? 6)));
  return 2.6 + (0.6 - 2.6) * ((rank - 1) / 5);
}

export function paintBasemap(layers: {
  land: GeoJson; coastline: GeoJson; lakes: GeoJson; rivers: GeoJson;
}): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  ctx.fillStyle = palette.sea;
  ctx.fillRect(0, 0, W, H);

  // Shallow water: three concentric strokes of the coastline, wide and faint,
  // fading from a lighter blue into the open sea. Drawn before land so the
  // land-side half of each stroke is simply painted over — only the seaward
  // half of the band survives, which is the only half a chart would ever draw.
  ctx.strokeStyle = palette.shallowWater; ctx.lineJoin = 'round';
  for (const [width, alpha] of [[26, 0.16], [15, 0.24], [7, 0.34]] as const) {
    ctx.lineWidth = width; ctx.globalAlpha = alpha;
    for (const f of layers.coastline.features) eachRing(f.geometry, (ring) => { trace(ctx, ring); ctx.stroke(); });
  }
  ctx.globalAlpha = 1;

  // Land, as solid parchment, on top of the shallow bands.
  ctx.fillStyle = palette.land;
  for (const f of layers.land.features) {
    eachRing(f.geometry, (ring) => { trace(ctx, ring); ctx.closePath(); ctx.fill(); });
  }

  // Lakes and rivers punched back out of the land.
  ctx.fillStyle = palette.lake;
  for (const f of layers.lakes.features) {
    eachRing(f.geometry, (ring) => { trace(ctx, ring); ctx.closePath(); ctx.fill(); });
  }
  // Each river at its own width — the Nile and a nameless wadi were the same
  // 1.6px before, which is honest about neither of them.
  ctx.strokeStyle = palette.river; ctx.lineJoin = 'round';
  for (const f of layers.rivers.features) {
    ctx.lineWidth = riverWidth(f);
    eachRing(f.geometry, (ring) => { trace(ctx, ring); ctx.stroke(); });
  }

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
