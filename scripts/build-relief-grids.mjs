// Generates src/structures/relief-data.ts from real vector geography
// (public/data/ne_50m_{land,lakes,rivers_lake_centerlines}.geojson) and the
// project's canonical coordinate payloads (places.json, journeys.json).
//
// Usage: node scripts/build-relief-grids.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

const landDoc = readJson('public/data/ne_50m_land.geojson');
const lakesDoc = readJson('public/data/ne_50m_lakes.geojson');
const riversDoc = readJson('public/data/ne_50m_rivers_lake_centerlines.geojson');
const placesDoc = readJson('public/data/places.json');
const journeysDoc = readJson('public/data/journeys.json');

// ── Spatial geometry helpers ──────────────────────────────────────────────────
function extractPolys(doc, bounds) {
  const [W, S, E, N] = bounds;
  const out = [];
  for (const f of doc.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const [lon, lat] of poly[0]) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      if (maxLon < W || minLon > E || maxLat < S || minLat > N) continue;
      out.push({ poly, bbox: [minLon, minLat, maxLon, maxLat], name: f.properties?.name ?? '' });
    }
  }
  return out;
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat)) {
      const xHit = ((xj - xi) * (lat - yi)) / (yj - yi + 1e-18) + xi;
      if (lon < xHit) inside = !inside;
    }
  }
  return inside;
}

function pointInPolys(lon, lat, polys) {
  for (const item of polys) {
    const [minLon, minLat, maxLon, maxLat] = item.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    if (!pointInRing(lon, lat, item.poly[0])) continue;
    let inHole = false;
    for (let h = 1; h < item.poly.length; h++) {
      if (pointInRing(lon, lat, item.poly[h])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

function pointSegDistDeg(lon, lat, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return Math.hypot(lon - ax, lat - ay);
  const t = Math.max(0, Math.min(1, ((lon - ax) * dx + (lat - ay) * dy) / l2));
  return Math.hypot(lon - (ax + t * dx), lat - (ay + t * dy));
}

function extractRivers(bounds) {
  const [W, S, E, N] = bounds;
  const out = [];
  for (const f of riversDoc.features) {
    const name = String(f.properties?.name ?? '');
    // Exclude modern canals (e.g., Suez Canal, Ismailiya Canal)
    if (/canal/i.test(name)) continue;
    const g = f.geometry;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    for (const line of lines) {
      if (line.some(([lon, lat]) => lon >= W - 0.5 && lon <= E + 0.5 && lat >= S - 0.5 && lat <= N + 0.5)) {
        out.push({ name, line });
      }
    }
  }
  return out;
}

const gauss = (d, r) => Math.exp(-(d * d) / (2 * r * r));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ── Grid builder ──────────────────────────────────────────────────────────────
function buildGrid({ id, cols, rows, bounds, minM, maxM, extraIslands = [], elevFn, riverRadiusDeg = 0.035 }) {
  const [west, south, east, north] = bounds;
  const dLon = (east - west) / (cols - 1);
  const dLat = (north - south) / (rows - 1);
  const landPolys = extractPolys(landDoc, bounds);
  const lakePolys = extractPolys(lakesDoc, bounds);
  const rivers = extractRivers(bounds);

  const mask = new Uint8Array(cols * rows);
  const elev = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    // r = 0 is north (world -Z), r = rows - 1 is south (world +Z)
    const lat = north - r * dLat;
    for (let c = 0; c < cols; c++) {
      const lon = west + c * dLon;
      const idx = r * cols + c;

      // 3x3 supersampling catches thin peninsulas & Aegean/Mediterranean islands cleanly
      let landHits = 0;
      for (const oy of [-0.32, 0, 0.32]) {
        for (const ox of [-0.32, 0, 0.32]) {
          if (pointInPolys(lon + ox * dLon, lat + oy * dLat, landPolys)) landHits++;
        }
      }
      const nearIsland = extraIslands.some(([ilon, ilat, rad]) => Math.hypot(lon - ilon, lat - ilat) <= rad);
      const isLand = landHits >= 3 || nearIsland;
      const isLake = pointInPolys(lon, lat, lakePolys);

      let isRiver = false;
      if (isLand && !isLake && rivers.length) {
        for (const rv of rivers) {
          for (let i = 0; i < rv.line.length - 1; i++) {
            const [ax, ay] = rv.line[i];
            const [bx, by] = rv.line[i + 1];
            if (pointSegDistDeg(lon, lat, ax, ay, bx, by) <= riverRadiusDeg) {
              isRiver = true;
              break;
            }
          }
          if (isRiver) break;
        }
      }

      mask[idx] = isLake || isRiver ? 2 : isLand ? 1 : 0;
      const rawElev = elevFn(lon, lat, mask[idx]);
      const norm = clamp((rawElev - minM) / (maxM - minM), 0, 1);
      elev[idx] = Math.round(norm * 255);
    }
  }

  return {
    id,
    cols,
    rows,
    west,
    south,
    east,
    north,
    minM,
    maxM,
    elevB64: Buffer.from(elev).toString('base64'),
    maskB64: Buffer.from(mask).toString('base64'),
  };
}

// ── 1. CANAAN GRID (Joshua 13-21, Deut 27, 12 Tribes & Cities of Refuge) ──────
const canaanElev = (lon, lat, m) => {
  if (m === 0) {
    // Sloping Mediterranean continental shelf west of coastline
    const coastDist = Math.max(0, 34.8 - (lat - 31.3) * 0.22 - lon);
    return -25 - Math.min(220, coastDist * 260);
  }
  // Rift Valley axis running N-S slightly slanted east of Hula -> Chinnereth -> Dead Sea
  const riftLon = 35.58 - (33.1 - lat) * 0.03;
  const dRift = Math.abs(lon - riftLon);
  const lakeBandGalilee = gauss(lat - 32.81, 0.085) * gauss(lon - 35.59, 0.075);
  const lakeBandDeadSea = smoothstep(31.82, 31.68, lat) * smoothstep(30.92, 31.12, lat) * gauss(lon - 35.48, 0.11);
  const riftTrough = gauss(dRift, 0.095);

  // Coastline distance east
  const coastLon = 34.45 + Math.max(0, lat - 31.2) * 0.25 - gauss(lat - 32.83, 0.07) * 0.22;
  const distCoast = Math.max(0, lon - coastLon);

  let h = 40;
  if (lon < riftLon) {
    // Cisjordan: Coastal Plain -> Shephelah -> Central Ridge
    const centralLon = 35.22 + (lat - 31.8) * 0.09;
    const ridgeW = 0.24 - gauss(lat - 32.58, 0.14) * 0.08;
    const spine = Math.exp(-Math.pow((lon - centralLon) / ridgeW, 2));
    // Jezreel Valley saddle near lat 32.55 cuts the spine down to ~90 m!
    const jezreelCut = 1 - 0.84 * gauss(lat - 32.57, 0.11) * smoothstep(35.0, 35.45, lon);
    // Shechem pass & twin peaks
    const latProfile =
      760 +
      240 * gauss(lat - 31.53, 0.22) + // Hebron plateau
      120 * gauss(lat - 31.93, 0.15) + // Bethel hills
      160 * gauss(lat - 32.23, 0.04) + // Ebal/Gerizim mass
      380 * smoothstep(32.85, 33.15, lat); // Upper Galilee (Meron)

    h = 25 + 90 * smoothstep(0.05, 0.35, distCoast) + spine * latProfile * jezreelCut;
    // Mount Carmel ridge NW into Haifa headland
    h += 480 * gauss(Math.hypot((lon - 35.02) * 1.1, (lat - 32.72) * 1.4), 0.11);
    // Subtle Beersheba Negev basin dip
    h *= 1 - 0.32 * smoothstep(31.32, 31.02, lat) * smoothstep(35.15, 34.55, lon);
  } else {
    // Transjordanian escarpment: Bashan, Gilead, Ammon, Moab + deep Arnon/Jabbok/Yarmuk wadis
    const plateauRise = smoothstep(0.05, 0.25, dRift);
    const transElev =
      780 +
      160 * gauss(lat - 33.0, 0.35) + // Golan/Bashan
      280 * gauss(lat - 32.35, 0.22) + // Gilead
      220 * gauss(lat - 31.55, 0.35); // Moab / Nebo
    h = 40 + plateauRise * transElev;
    // Deep east-west canyon incisions (Yarmuk, Jabbok, Arnon)
    const jabbok = gauss(lat - 32.22, 0.032) * smoothstep(35.5, 35.9, lon);
    const arnon = gauss(lat - 31.46, 0.032) * smoothstep(35.5, 36.1, lon);
    h -= (jabbok + arnon) * 420;
  }

  // Huge Mount Hermon massif in the far NE (33.40°N, 35.85°E)
  h += 2150 * gauss(Math.hypot((lon - 35.86) * 0.9, (lat - 33.41) * 1.15), 0.24);

  // Carve the deep Jordan Rift Valley down to -212 m (Galilee) and -430 m (Dead Sea)
  const riftFloor = -212 * smoothstep(33.25, 32.85, lat) - 218 * smoothstep(32.5, 31.7, lat);
  h = h * (1 - riftTrough * 0.95) + riftFloor * (riftTrough * 0.95);
  if (m === 2) {
    return lat > 32.65 ? -212 : lat < 31.82 ? -430 : -212 - 218 * smoothstep(32.7, 31.8, lat);
  }
  if (lakeBandGalilee > 0.55) return -210;
  if (lakeBandDeadSea > 0.55) return -425;
  return h;
};

// ── 2. EXODUS GRID (Numbers 33, Rameses -> Red Sea -> Sinai -> Moab) ──────────
const exodusElev = (lon, lat, m) => {
  if (m === 0) return -35;
  if (m === 2 && lon < 33.0) return 8; // Nile branches in Delta
  if (m === 2 && lon > 35.0) return -420; // Dead Sea / Jordan
  // Delta alluvial fan
  const delta = smoothstep(32.6, 31.2, lon) * smoothstep(29.8, 31.5, lat);
  let h = 15 * delta + 180 * (1 - delta);
  // Central Sinai & Tih escarpment
  h += 720 * gauss(Math.hypot((lon - 33.9) * 0.65, (lat - 29.4) * 1.0), 0.95);
  // Southern Sinai high granite peaks (Mount Sinai / Jebel Musa ~2,285 m)
  h += 1950 * gauss(Math.hypot((lon - 33.97) * 0.85, (lat - 28.54) * 0.95), 0.42);
  // Negev highland domes
  h += 550 * gauss(Math.hypot((lon - 34.7) * 0.9, (lat - 30.65) * 1.1), 0.5);
  // Edom & Seir high escarpment east of Arabah
  const seir = smoothstep(35.15, 35.55, lon) * smoothstep(28.5, 29.8, lat) * smoothstep(32.2, 31.4, lat);
  h += 1180 * seir + 340 * gauss(Math.hypot(lon - 35.5, lat - 30.35), 0.45);
  // Plains of Moab plateau
  h += 760 * smoothstep(35.5, 35.85, lon) * smoothstep(31.0, 31.8, lat);
  // Carve Gulf of Suez & Arabah Rift valley depression
  const arabah = gauss(lon - (35.02 + (lat - 29.55) * 0.22), 0.14) * smoothstep(29.4, 31.5, lat);
  h = h * (1 - arabah * 0.85) + -20 * arabah;
  if (lon > 35.25 && lat > 31.0 && lat < 31.85 && Math.abs(lon - 35.48) < 0.14) h = -415;
  return Math.max(5, h);
};

// ── 3. PAUL MEDITERRANEAN GRID (Acts 13-28) ──────────────────────────────────
const paulElev = (lon, lat, m) => {
  if (m === 0) return -80;
  let h = 160;
  // Anatolian Plateau & Taurus Wall
  if (lon > 26.5 && lon < 38 && lat > 36.2 && lat < 42.0) {
    h += 950 * smoothstep(27.0, 32.0, lon) * smoothstep(36.3, 37.6, lat);
    h += 1750 * gauss(lat - 37.1, 0.55) * smoothstep(29.5, 36.0, lon); // Taurus range
  }
  // Levant & Galilee highlands
  if (lon > 34.3 && lon < 37.5 && lat >= 30.8 && lat < 36.5) {
    h += 1400 * gauss(lon - 35.7, 0.55) * smoothstep(31.2, 34.2, lat);
  }
  // Cyprus Troodos massif
  h += 1650 * gauss(Math.hypot((lon - 32.9) * 0.9, (lat - 34.95) * 1.4), 0.35);
  // Greece / Macedonia Pindus spine & Thrace
  if (lon > 19.5 && lon < 26.2 && lat > 37.0) {
    h += 1550 * gauss(lon - 21.6, 0.9) + 1200 * gauss(Math.hypot(lon - 22.35, lat - 40.08), 0.4);
  }
  // Crete White Mountains
  h += 1950 * gauss(Math.hypot((lon - 24.7) * 0.55, (lat - 35.22) * 2.2), 0.35);
  // Italian Apennines & Sicily Mt Etna
  if (lon < 18.5 && lat > 36.5) {
    const apLon = 12.2 + (42.0 - lat) * 0.72;
    h += 1550 * gauss(lon - apLon, 0.75) * smoothstep(37.5, 42.2, lat);
    h += 2400 * gauss(Math.hypot(lon - 15.0, lat - 37.75), 0.32); // Etna / Sicily
  }
  return clamp(h, 40, 3150);
};

// ── 4. WESTERN ASIA SEVEN CHURCHES GRID (Rev 1-3) ────────────────────────────
const asiaElev = (lon, lat, m) => {
  if (m === 0) return -30;
  let h = 110 + 750 * smoothstep(26.8, 29.4, lon);
  // Horst-and-graben mountain ridges & deep river corridors!
  const caicus = gauss(lat - 39.12, 0.085) * smoothstep(26.9, 28.1, lon); // Pergamum valley
  const hermus = gauss(lat - (38.55 - (lon - 27.1) * 0.1), 0.1) * smoothstep(27.0, 28.8, lon); // Sardis/Phila
  const cayster = gauss(lat - 38.04, 0.075) * smoothstep(27.25, 28.3, lon); // Ephesus corridor
  const maeander = gauss(lat - 37.84, 0.095) * smoothstep(27.2, 29.3, lon); // Laodicea / Lycus
  h += 1350 * gauss(lat - 38.34, 0.14) * smoothstep(27.3, 29.1, lon); // Mt Tmolus south of Sardis
  h += 1100 * gauss(lat - 38.75, 0.16) * smoothstep(27.4, 28.9, lon); // North Lydian ridge
  h += 1650 * gauss(lat - 37.58, 0.18) * smoothstep(27.6, 29.5, lon); // Mt Cadmus south of Laodicea
  h += 750 * gauss(Math.hypot(lon - 27.15, lat - 39.28), 0.19); // Madra above Pergamum
  const valCut = clamp(caicus * 0.78 + hermus * 0.84 + cayster * 0.86 + maeander * 0.84, 0, 0.9);
  h = h * (1 - valCut) + 35 * valCut;
  return clamp(h, 15, 2250);
};

const grids = {
  canaan: buildGrid({
    id: 'canaan',
    cols: 64,
    rows: 88,
    bounds: [34.15, 30.95, 36.45, 33.45],
    minM: -450,
    maxM: 2850,
    elevFn: canaanElev,
    riverRadiusDeg: 0.04,
  }),
  exodus: buildGrid({
    id: 'exodus',
    cols: 80,
    rows: 72,
    bounds: [31.0, 27.4, 36.3, 32.1],
    minM: -430,
    maxM: 2300,
    elevFn: exodusElev,
    riverRadiusDeg: 0.055,
  }),
  paul: buildGrid({
    id: 'paul',
    cols: 96,
    rows: 52,
    bounds: [11.8, 30.8, 36.8, 42.2],
    minM: -200,
    maxM: 3200,
    extraIslands: [
      [14.44, 35.89, 0.22], // Malta (Melita)
      [26.54, 37.32, 0.14], // Patmos
      [25.48, 40.46, 0.12], // Samothrace
      [24.09, 34.84, 0.12], // Cauda
      [28.22, 36.44, 0.16], // Rhodes
    ],
    elevFn: paulElev,
    riverRadiusDeg: 0.0,
  }),
  asia: buildGrid({
    id: 'asia',
    cols: 68,
    rows: 60,
    bounds: [25.8, 37.0, 29.6, 39.6],
    minM: -100,
    maxM: 2300,
    extraIslands: [
      [26.54, 37.32, 0.075], // Patmos
      [26.93, 37.71, 0.12], // Samos
      [26.06, 38.44, 0.14], // Chios
    ],
    elevFn: asiaElev,
    riverRadiusDeg: 0.0,
  }),
};

// ── Extract places & routes from canonical project JSONs ─────────────────────
const byExact = (name) => placesDoc.places.find((p) => p.name === name);
const pickPt = (name, id, zh, en) => {
  const p = byExact(name);
  if (!p) throw new Error(`Missing place "${name}" in places.json`);
  return { id, lon: +p.lon.toFixed(4), lat: +p.lat.toFixed(4), zh: zh ?? p.zh, en: en ?? name.replace(/\s+\d+$/, '') };
};

const CANAAN_SITES = [
  pickPt('Shiloh', 'shiloh', '示罗（会幕所在）', 'Shiloh (Tabernacle)'),
  pickPt('Kedesh 1', 'kedesh', '基低斯（避难城 · 拿弗他利）', 'Kedesh (Refuge · Naphtali)'),
  pickPt('Shechem', 'shechem', '示剑（避难城 · 以法莲）', 'Shechem (Refuge · Ephraim)'),
  pickPt('Hebron', 'hebron', '希伯仑（避难城 · 犹大）', 'Hebron (Refuge · Judah)'),
  pickPt('Bezer', 'bezer', '比悉（避难城 · 流便）', 'Bezer (Refuge · Reuben)'),
  pickPt('Ramoth-gilead', 'ramoth-gilead', '基列的拉末（避难城 · 迦得）', 'Ramoth-gilead (Refuge · Gad)'),
  pickPt('Golan', 'golan', '哥兰（避难城 · 东玛拿西）', 'Golan (Refuge · East Manasseh)'),
  pickPt('Dan', 'dan', '但（北部界城）', 'Dan'),
  pickPt('Beersheba 1', 'beersheba', '别是巴（南部界城）', 'Beersheba'),
  pickPt('Jericho 1', 'jericho', '耶利哥（西岸）', 'Jericho'),
  pickPt('Megiddo', 'megiddo', '米吉多（米吉多谷）', 'Megiddo'),
  pickPt('Mount Hermon', 'hermon', '黑门山', 'Mount Hermon'),
  pickPt('Mount Ebal', 'ebal', '以巴路山', 'Mount Ebal'),
  pickPt('Mount Gerizim', 'gerizim', '基利心山', 'Mount Gerizim'),
  pickPt('Jerusalem', 'jerusalem', '耶路撒冷', 'Jerusalem'),
  pickPt('Heshbon', 'heshbon', '希实本', 'Heshbon'),
];

const ASIA_CHURCH_ORDER = [
  { key: 'Patmos', id: 'patmos', zh: '拔摩岛', en: 'Patmos' },
  { key: 'Ephesus', id: 'ephesus', zh: '以弗所', en: 'Ephesus' },
  { key: 'Smyrna', id: 'smyrna', zh: '士每拿', en: 'Smyrna' },
  { key: 'Pergamum', id: 'pergamum', zh: '别迦摩', en: 'Pergamum' },
  { key: 'Thyatira', id: 'thyatira', zh: '推雅推喇', en: 'Thyatira' },
  { key: 'Sardis', id: 'sardis', zh: '撒狄', en: 'Sardis' },
  { key: 'Philadelphia', id: 'philadelphia', zh: '非拉铁非', en: 'Philadelphia' },
  { key: 'Laodicea', id: 'laodicea', zh: '老底嘉', en: 'Laodicea' },
].map((c) => pickPt(c.key, c.id, c.zh, c.en));

const extractJourney = (id) => {
  const j = journeysDoc.journeys.find((x) => x.id === id);
  if (!j) throw new Error(`Missing journey "${id}" in journeys.json`);
  return {
    id: j.id,
    segments: j.segments.map((seg) => seg.map(([lon, lat]) => [+lon.toFixed(4), +lat.toFixed(4)])),
    markers: j.markers
      .filter((m) => m.lat !== null && m.lon !== null)
      .map((m) => ({
        n: m.n,
        lon: +m.lon.toFixed(4),
        lat: +m.lat.toFixed(4),
        place: m.place,
        zh: m.zh,
        leg: m.leg,
        attested: m.attested,
      })),
  };
};

const JOURNEY_DATA = {
  exodus: extractJourney('exodus-wilderness'),
  paul1: extractJourney('paul-1'),
  paul2: extractJourney('paul-2'),
  paul3: extractJourney('paul-3'),
  paulRome: extractJourney('paul-rome'),
};

const output = `// AUTO-GENERATED by scripts/build-relief-grids.mjs — do not edit by hand.
// Derived from Natural Earth 1:50m vectors (ne_50m_land/lakes/rivers) and
// canonical coordinates in public/data/places.json & public/data/journeys.json.

export interface ReliefGridData {
  id: string;
  cols: number;
  rows: number;
  west: number;
  south: number;
  east: number;
  north: number;
  minM: number;
  maxM: number;
  elevB64: string;
  maskB64: string;
}

export interface ReliefSite {
  id: string;
  lon: number;
  lat: number;
  zh: string;
  en: string;
}

export interface ReliefJourneyMarker {
  n: number;
  lon: number;
  lat: number;
  place: string;
  zh: string;
  leg: string | null;
  attested: boolean;
}

export interface ReliefJourneyData {
  id: string;
  segments: [number, number][][];
  markers: ReliefJourneyMarker[];
}

export const RELIEF_GRIDS: Record<'canaan' | 'exodus' | 'paul' | 'asia', ReliefGridData> = ${JSON.stringify(grids)};

export const CANAAN_SITES: readonly ReliefSite[] = ${JSON.stringify(CANAAN_SITES)};

export const ASIA_CHURCH_SITES: readonly ReliefSite[] = ${JSON.stringify(ASIA_CHURCH_ORDER)};

export const RELIEF_JOURNEYS: Record<'exodus' | 'paul1' | 'paul2' | 'paul3' | 'paulRome', ReliefJourneyData> = ${JSON.stringify(JOURNEY_DATA)};
`;

writeFileSync(join(ROOT, 'src/structures/relief-data.ts'), output);
console.log('Built src/structures/relief-data.ts:', (Buffer.byteLength(output) / 1024).toFixed(1), 'KB');
