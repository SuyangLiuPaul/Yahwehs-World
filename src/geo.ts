import worldUrl from './geo/world.bin.gz?url';
import { decodeWorld, type WorldGeo } from './geo-codec.ts';
import type { GeoJson } from './types.ts';

// The globe's land, coastline, lakes and rivers: one 170 KB request instead of
// four GeoJSON files (4.9 MB, about 1.5 MB on the wire). See scripts/build-geo.mjs
// for what was dropped and why it cannot be seen at the canvas's resolution.

/** The URL of the packed file. Vite gives it a content hash, so it is cached
 *  forever; index.html preloads the same URL (vite.config.ts, geoPreload). */
export const WORLD_URL = worldUrl;

const LEGACY: Record<keyof WorldGeo, string> = {
  land: '/data/ne_50m_land.geojson',
  coastline: '/data/ne_50m_coastline.geojson',
  lakes: '/data/ne_50m_lakes.geojson',
  rivers: '/data/ne_50m_rivers_lake_centerlines.geojson',
};

async function packed(): Promise<WorldGeo> {
  const res = await fetch(WORLD_URL);
  if (!res.ok) throw new Error(`${WORLD_URL} → ${res.status}`);
  let bytes: Uint8Array;
  if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream');
  const head = new Uint8Array(await res.arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b) {
    bytes = new Uint8Array(await new Response(new Blob([head]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  } else {
    bytes = head; // a host that already undid the gzip
  }
  return decodeWorld(bytes);
}

/** The four layers. A browser without DecompressionStream (before 2023) gets
 *  the original GeoJSON, which is still shipped. */
export async function loadWorld(): Promise<WorldGeo> {
  try {
    return await packed();
  } catch (e) {
    if (!(e instanceof Error) || e.message !== 'no DecompressionStream') throw e;
    const [land, coastline, lakes, rivers] = await Promise.all(
      (Object.keys(LEGACY) as (keyof WorldGeo)[]).map((k) =>
        fetch(`${LEGACY[k]}?v=2026-09-15`).then((r) => r.json() as Promise<GeoJson>)),
    );
    return { land: land!, coastline: coastline!, lakes: lakes!, rivers: rivers! };
  }
}
