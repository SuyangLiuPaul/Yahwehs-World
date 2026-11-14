import * as THREE from 'three';
import { altarHorn, batchStatic, bevelBox } from './craft';
import { buildEzekielTextures } from './ezekiel-tex';

export const NEHEMIAH_DEFAULT_CUBIT = 0.445;

const gauss = (x: number, z: number, cx: number, cz: number, r: number): number =>
  Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

const smax = (a: number, b: number, k = 0.18): number => {
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(k * (a - m)) + Math.exp(k * (b - m))) / k;
};

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Ophel and City of David ridge descending south from Mount Moriah toward Siloam. */
function cityOfDavidRidge(x: number, z: number): number {
  const ax = 115;
  const az = 170;
  const bx = 10;
  const bz = -330;
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lenSq));
  const dist = Math.hypot(x - (ax + dx * u), z - (az + dz * u));
  return (58 - 40 * u) * Math.exp(-((dist / 100) ** 2));
}

/** Sculpted Jerusalem hills & surrounding Kidron / Hinnom / Tyropoeon topography in cubits. */
export function naturalCubits(x: number, z: number): number {
  let h = 0;
  h = smax(h, 66 * gauss(x, z, 135, 250, 160)); // Mount Moriah / Temple summit
  h = smax(h, 64 * gauss(x, z, -135, 160, 165)); // Western hill (Mishneh)
  h = smax(h, 56 * gauss(x, z, -125, -90, 140)); // SW shoulder above Hinnom
  h = smax(h, cityOfDavidRidge(x, z)); // Ophel & City of David spur
  h = smax(h, 86 * gauss(x, z, 540, 250, 240)); // Mount of Olives across Kidron
  h = smax(h, 60 * gauss(x, z, 60, -640, 260)); // Southern rise beyond Hinnom
  h = smax(h, 58 * gauss(x, z, -560, 40, 280)); // Western ridge
  h = smax(h, 52 * gauss(x, z, -60, 600, 280)); // Northern plateau
  return h - 14;
}

// Counter-clockwise circuit matching Nehemiah 3:1-32
export const RING_VERTS: readonly (readonly [number, number])[] = [
  [190, 340], // 0 NE corner — Upper Chamber of the Corner (Neh 3:31-32)
  [-130, 340], // 1 North wall west end
  [-210, 270], // 2 NW shoulder
  [-210, -40], // 3 West wall south of Valley Gate
  [-80, -320], // 4 SW Hinnom bend
  [40, -320], // 5 Southern tip past Dung Gate
  [60, -304], // 6 SE corner below Pool of Shelah
  [60, -218], // 7 Fountain Gate straight run
  [80, -118], // 8 City of David eastern crest
  [90, 0], // 9 Ophel southern approach
  [90, 110], // 10 Ophel northern junction
  [190, 110], // 11 SE Temple Mount corner past Horse Gate
];

export interface RingSeg {
  i: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  L: number;
  s0: number;
  dx: number;
  dz: number;
  nx: number;
  nz: number;
}

const SEGS: RingSeg[] = [];
let PERIM = 0;
for (let i = 0; i < RING_VERTS.length; i++) {
  const a = RING_VERTS[i]!;
  const b = RING_VERTS[(i + 1) % RING_VERTS.length]!;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / L;
  const dz = (b[1] - a[1]) / L;
  SEGS.push({ i, ax: a[0], az: a[1], bx: b[0], bz: b[1], L, s0: PERIM, dx, dz, nx: dz, nz: -dx });
  PERIM += L;
}

export const RING_SEGS: readonly RingSeg[] = SEGS;
export const PERIMETER = PERIM;

const wrapS = (s: number): number => ((s % PERIM) + PERIM) % PERIM;

export function ringPoint(s: number): { x: number; z: number; seg: RingSeg } {
  const w = wrapS(s);
  let seg = SEGS[SEGS.length - 1]!;
  for (const sg of SEGS) {
    if (w < sg.s0 + sg.L) {
      seg = sg;
      break;
    }
  }
  const t = w - seg.s0;
  return { x: seg.ax + seg.dx * t, z: seg.az + seg.dz * t, seg };
}

export function ringS(x: number, z: number): number {
  let best = Infinity;
  let bs = 0;
  for (const sg of SEGS) {
    const t = Math.max(0, Math.min(sg.L, (x - sg.ax) * sg.dx + (z - sg.az) * sg.dz));
    const d = Math.hypot(sg.ax + sg.dx * t - x, sg.az + sg.dz * t - z);
    if (d < best) {
      best = d;
      bs = sg.s0 + t;
    }
  }
  return bs;
}

const dS = (a: number, b: number): number => {
  let d = wrapS(a - b);
  if (d > PERIM / 2) d -= PERIM;
  return d;
};

export function insideCity(x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = RING_VERTS.length - 1; i < RING_VERTS.length; j = i++) {
    const [xi, zi] = RING_VERTS[i]!;
    const [xj, zj] = RING_VERTS[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Broad Wall (Neh 3:8; 12:38): 16 cubits (~7.1 m, matching Avigad's ~7 m excavation) on Seg 2
const S_BROAD_A = SEGS[2]!.s0 + (270 - 230);
const S_BROAD_B = SEGS[2]!.s0 + (270 - 130);
export const WALL_T = 9;
export const BROAD_T = 16;

export function wallThick(s: number): number {
  const w = wrapS(s);
  const k = smoothstep(S_BROAD_A - 10, S_BROAD_A, w) * (1 - smoothstep(S_BROAD_B, S_BROAD_B + 10, w));
  return WALL_T + (BROAD_T - WALL_T) * k;
}

export const BROAD_WALL = { sA: S_BROAD_A, sB: S_BROAD_B, x: -210, z0: 130, z1: 230 };

const PARAPET_T = 1.3;
const PARAPET_H = 2.6;
const INNER_CURB_T = 0.9;
const INNER_CURB_H = 1.65;
const GATE_HALF = 12;
const PASS_HALF = 4;
const GATE_OUT = 5.5;
const GATE_IN = 2.0;
const PASS_CLEAR = 9.0;
const BASTION_PAD = 2.5;

export interface GateDef {
  id: string;
  en: string;
  zh: string;
  ref: string;
  x: number;
  z: number;
  /** Direction along segment from gate where the inner wall-stair top landing sits (+1 or -1). */
  stairSide?: 1 | -1;
}

export const GATE_DEFS: readonly GateDef[] = [
  { id: 'sheep', en: 'Sheep Gate', zh: '羊门', ref: 'Neh 3:1, 32; 12:39', x: 150, z: 340, stairSide: 1 },
  { id: 'fish', en: 'Fish Gate', zh: '鱼门', ref: 'Neh 3:3; 12:39', x: -15, z: 340 },
  { id: 'old', en: 'Old Gate (Jeshanah)', zh: '古门（耶沙拿门）', ref: 'Neh 3:6; 12:39', x: -95, z: 340 },
  { id: 'valley', en: 'Valley Gate', zh: '谷门', ref: 'Neh 2:13; 3:13; 12:31', x: -210, z: 0, stairSide: -1 },
  { id: 'dung', en: 'Dung Gate', zh: '粪厂门', ref: 'Neh 3:13–14; 12:31', x: -45, z: -320 },
  { id: 'fountain', en: 'Fountain Gate', zh: '泉门', ref: 'Neh 3:15; 12:37', x: 60, z: -282, stairSide: 1 },
  { id: 'water', en: 'Water Gate', zh: '水门', ref: 'Neh 3:26; 8:1–3; 12:37', x: 90, z: 24, stairSide: 1 },
  { id: 'horse', en: 'Horse Gate', zh: '马门', ref: 'Neh 3:28', x: 150, z: 110 },
  { id: 'east', en: 'East Gate', zh: '东门', ref: 'Neh 3:29', x: 190, z: 250 },
  { id: 'miphkad', en: 'Inspection Gate (Miphkad)', zh: '哈米弗甲门（检阅门）', ref: 'Neh 3:31', x: 190, z: 305 },
];

export interface TowerDef {
  id: string;
  en: string;
  zh: string;
  ref: string;
  x: number;
  z: number;
  half: number;
  proj: number;
  rise: number;
}

export const TOWER_DEFS: readonly TowerDef[] = [
  { id: 'meah', en: 'Tower of the Hundred (Meah)', zh: '哈米亚楼（百人楼）', ref: 'Neh 3:1; 12:39', x: 82, z: 340, half: 7, proj: 10, rise: 13 },
  { id: 'hananel', en: 'Tower of Hananel', zh: '哈楠业楼', ref: 'Neh 3:1; 12:39', x: 36, z: 340, half: 7, proj: 10, rise: 15 },
  { id: 'furnaces', en: 'Tower of the Furnaces', zh: '炉楼', ref: 'Neh 3:11; 12:38', x: -210, z: 92, half: 7, proj: 10, rise: 12 },
  { id: 'ophel', en: 'Great Projecting Tower (Ophel)', zh: '突出来的大楼（俄斐勒）', ref: 'Neh 3:25–27', x: 90, z: 90, half: 8.5, proj: 16, rise: 16 },
];

export interface StairSpec {
  id: string;
  gateId: string;
  seg: RingSeg;
  side: 1 | -1;
  uTop0: number;
  uTop1: number;
  uBot: number;
  vNear: number;
  vFar: number;
  yBot: number;
  yTop: number;
  steps: number;
  sOpen0: number;
  sOpen1: number;
}

export interface GateInfo extends GateDef {
  s: number;
  seg: RingSeg;
  floor: number;
  top: number;
  thick: number;
  stairSpec?: StairSpec;
}

export interface TowerInfo extends TowerDef {
  s: number;
  seg: RingSeg;
  top: number;
  thick: number;
}

interface Pad {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  level: number;
  margin: number;
}

export interface NehemiahPlan {
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  gates: GateInfo[];
  towers: TowerInfo[];
  stairs: StairSpec[];
  wallTop: (s: number) => number;
  maxWallTop: number;
  groundC: (x: number, z: number) => number;
  terrainVisualC: (x: number, z: number) => number;
  citySteps: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; steps: number };
  temple: {
    x0: number; x1: number; z0: number; z1: number;
    level: number; podium: number; sideH: number; naveH: number;
    naveZ0: number; naveZ1: number;
    altar: { x: number; z: number; half: number; h: number };
  };
  square: {
    x0: number; x1: number; z0: number; z1: number; level: number;
    podium: { x0: number; x1: number; z0: number; z1: number; h: number };
  };
  pool: { cx: number; cz: number; hx: number; hz: number; rim: number; depth: number; water: number };
  houses: { x: number; z: number; w: number; d: number; h: number; base: number }[];
  bastions: { x: number; z: number; half: number; top: number; base: number; sides: [number, number][] }[];
}

let PLAN_CACHE: NehemiahPlan | null = null;

export function nehemiahPlan(): NehemiahPlan {
  if (PLAN_CACHE) return PLAN_CACHE;

  const gateS = GATE_DEFS.map((g) => ringS(g.x, g.z));
  const crossMax = (s: number, half: number): number => {
    const p = ringPoint(s);
    let m = -Infinity;
    for (const o of [-half, -half * 0.5, 0, half * 0.5, half]) {
      m = Math.max(m, naturalCubits(p.x + p.seg.nx * o, p.z + p.seg.nz * o));
    }
    return m;
  };

  // Level stations at corners and gates (wider on stair landing sides)
  const stations: { s: number; halfBack: number; halfFwd: number; level: number }[] = [];
  for (const sg of SEGS) {
    const h = wallThick(sg.s0) * 0.5 + BASTION_PAD + 1.5;
    stations.push({ s: sg.s0, halfBack: h, halfFwd: h, level: 0 });
  }
  for (let i = 0; i < GATE_DEFS.length; i++) {
    const def = GATE_DEFS[i]!;
    const s = gateS[i]!;
    stations.push({ s, halfBack: GATE_HALF + 2, halfFwd: GATE_HALF + 2, level: 0 });
    if (def.stairSide) {
      stations.push({ s: wrapS(s + def.stairSide * 50), halfBack: 10, halfFwd: 10, level: 0 });
    }
  }
  stations.sort((a, b) => a.s - b.s);

  const extra: typeof stations = [];
  for (let i = 0; i < stations.length; i++) {
    const a = stations[i]!;
    const b = stations[(i + 1) % stations.length]!;
    const gap = wrapS(b.s - a.s);
    const n = Math.floor(gap / 44);
    for (let j = 1; j < n; j++) {
      extra.push({ s: wrapS(a.s + (gap * j) / n), halfBack: 0, halfFwd: 0, level: 0 });
    }
  }
  stations.push(...extra);
  stations.sort((a, b) => a.s - b.s);

  const MIN_WALL_RISE = 11.5;
  for (const st of stations) {
    let m = -Infinity;
    for (let d = -st.halfBack - 6; d <= st.halfFwd + 6; d += 2) {
      m = Math.max(m, crossMax(st.s + d, wallThick(st.s + d) * 0.5 + 2.5));
    }
    st.level = m + MIN_WALL_RISE;
  }

  const MAX_SLOPE = 0.29;
  for (let it = 0; it < 64; it++) {
    for (let i = 0; i < stations.length; i++) {
      const a = stations[i]!;
      const b = stations[(i + 1) % stations.length]!;
      const gap = Math.max(1, wrapS(b.s - b.halfBack - (a.s + a.halfFwd)));
      const lim = MAX_SLOPE * gap;
      if (b.level < a.level - lim) b.level = a.level - lim;
      if (a.level < b.level - lim) a.level = b.level - lim;
    }
  }

  let maxWallTop = -Infinity;
  for (const st of stations) maxWallTop = Math.max(maxWallTop, st.level);

  const wallTop = (s0: number): number => {
    const s = wrapS(s0);
    for (let i = 0; i < stations.length; i++) {
      const a = stations[i]!;
      const b = stations[(i + 1) % stations.length]!;
      const sa = a.s;
      const sb = b.s > sa ? b.s : b.s + PERIM;
      const ss = s >= sa ? s : s + PERIM;
      if (ss >= sa && ss <= sb) {
        const e0 = sa + a.halfFwd;
        const e1 = sb - b.halfBack;
        if (ss <= e0) return a.level;
        if (ss >= e1 || e1 <= e0) return b.level;
        return a.level + ((b.level - a.level) * (ss - e0)) / (e1 - e0);
      }
    }
    return stations[0]!.level;
  };

  const pads: Pad[] = [];

  // Temple Mount esplanade pad (Ezra 6:3-4)
  const templeLevel = naturalCubits(124, 250);
  const temple = {
    x0: 82,
    x1: 142,
    z0: 220,
    z1: 280,
    level: templeLevel,
    podium: 3.5,
    sideH: 26,
    naveH: 56.5, // podium 3.5 + naveH 56.5 = 60.0 cubits total height (Ezra 6:3)!
    naveZ0: 238,
    naveZ1: 262,
    altar: { x: 164, z: 250, half: 6, h: 4.5 },
  };
  pads.push({ x0: 72, x1: 180, z0: 210, z1: 290, level: templeLevel, margin: 30 });

  // Water Gate Square pad (Neh 8:1-4)
  const squareLevel = naturalCubits(60, 32);
  const square = {
    x0: 34,
    x1: 79,
    z0: 8,
    z1: 58,
    level: squareLevel,
    podium: { x0: 56, x1: 68, z0: 27, z1: 37, h: 3.2 },
  };
  pads.push({ x0: 30, x1: 82, z0: 4, z1: 62, level: squareLevel, margin: 18 });

  // Pool of Shelah / Siloam terrace pad (Neh 3:15)
  const poolRim = naturalCubits(16, -284);
  const pool = { cx: 16, cz: -284, hx: 11, hz: 7.5, rim: poolRim, depth: 3.6, water: poolRim - 1.4 };
  pads.push({ x0: -6, x1: 42, z0: -300, z1: -266, level: poolRim, margin: 14 });

  // Gate thresholds
  const gates: GateInfo[] = GATE_DEFS.map((def, i) => {
    const s = gateS[i]!;
    const p = ringPoint(s);
    const seg = p.seg;
    const thick = wallThick(s);
    const floor = def.id === 'east' ? templeLevel : def.id === 'water' ? squareLevel : def.id === 'fountain' ? poolRim : naturalCubits(p.x, p.z);
    const reach = thick * 0.5 + 22;
    const alongX = Math.abs(seg.dx) > 0.5;
    pads.push(
      alongX
        ? { x0: p.x - 10, x1: p.x + 10, z0: p.z - reach, z1: p.z + reach, level: floor, margin: 15 }
        : { x0: p.x - reach, x1: p.x + reach, z0: p.z - 10, z1: p.z + 10, level: floor, margin: 15 },
    );
    return { ...def, x: p.x, z: p.z, s, seg, floor, top: wallTop(s), thick };
  });

  const evalPads = (x: number, z: number): number => {
    let h = naturalCubits(x, z);
    for (const p of pads) {
      const ex = Math.max(p.x0 - x, 0, x - p.x1);
      const ez = Math.max(p.z0 - z, 0, z - p.z1);
      const d = Math.hypot(ex, ez);
      if (d >= p.margin) continue;
      const w = 1 - smoothstep(0, p.margin, d);
      h = h * (1 - w) + p.level * w;
    }
    return h;
  };

  // Build 4 axis-aligned inner wall staircases starting right beside each gate plaza!
  const stairs: StairSpec[] = [];
  for (const g of gates) {
    if (!g.stairSide) continue;
    const side = g.stairSide;
    const seg = g.seg;
    const uBot = GATE_HALF + 2.0; // 14.0c right beside gate threshold!
    const vNear = g.thick * 0.5;
    const vFar = g.thick * 0.5 + 5.4;
    const inX = -seg.nx;
    const inZ = -seg.nz;

    const bx = g.x + seg.dx * side * (uBot - 1.5) + inX * (vNear + 2.7);
    const bz = g.z + seg.dz * side * (uBot - 1.5) + inZ * (vNear + 2.7);
    const alongX = Math.abs(seg.dx) > 0.5;
    pads.push(
      alongX
        ? { x0: bx - 5, x1: bx + 5, z0: bz - 4, z1: bz + 4, level: g.floor, margin: 12 }
        : { x0: bx - 4, x1: bx + 4, z0: bz - 5, z1: bz + 5, level: g.floor, margin: 12 },
    );
    const yBot = evalPads(bx, bz);

    const estTop = wallTop(g.s + side * 50);
    const totalRise = Math.max(4, estTop - yBot);
    const steps = Math.max(12, Math.ceil(totalRise / 0.34)); // step rise <= 0.34c (~0.18 m <= 0.50 m!)
    const uTop0 = uBot + steps * 0.72;
    const uTop1 = uTop0 + 6.5;
    const yTop = wallTop(g.s + side * ((uTop0 + uTop1) * 0.5));
    const sA = g.s + side * uTop0;
    const sB = g.s + side * uTop1;
    const spec: StairSpec = {
      id: `${g.id}-stair`,
      gateId: g.id,
      seg,
      side,
      uTop0,
      uTop1,
      uBot,
      vNear,
      vFar,
      yBot,
      yTop,
      steps,
      sOpen0: Math.min(sA, sB) - 0.3,
      sOpen1: Math.max(sA, sB) + 0.3,
    };
    g.stairSpec = spec;
    stairs.push(spec);
  }

  // City of David Stepped Street (Neh 3:15; 12:37): ascending north from Siloam terrace
  const cdZ0 = -265;
  const cdZ1 = -193;
  const cdY0 = poolRim;
  const cdY1 = evalPads(34, cdZ1);
  pads.push({ x0: 29, x1: 39, z0: cdZ1 - 2, z1: cdZ1 + 8, level: cdY1, margin: 12 });
  const citySteps = {
    x0: 30,
    x1: 38,
    z0: cdZ0,
    z1: cdZ1,
    y0: cdY0,
    y1: cdY1,
    steps: Math.max(24, Math.ceil(Math.abs(cdY1 - cdY0) / 0.30)),
  };

  const inPoolBasin = (x: number, z: number, pad = 0): boolean =>
    Math.abs(x - pool.cx) <= pool.hx + pad && Math.abs(z - pool.cz) <= pool.hz + pad;

  const groundC = (x: number, z: number): number => {
    const h = evalPads(x, z);
    if (inPoolBasin(x, z, 0)) {
      const edge = Math.max(
        0,
        1 - Math.min((pool.hx - Math.abs(x - pool.cx)) / 4, (pool.hz - Math.abs(z - pool.cz)) / 4),
      );
      return pool.rim - pool.depth * (1 - edge * 0.65);
    }
    return h;
  };

  const terrainVisualC = (x: number, z: number): number => {
    const h = evalPads(x, z);
    if (inPoolBasin(x, z, 1.2)) return pool.rim - pool.depth - 1.2;
    return h;
  };

  // Colliders & Platforms
  const colliders: THREE.Box3[] = [];
  const platforms: THREE.Box3[] = [];

  const mkBox = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): THREE.Box3 =>
    new THREE.Box3(
      new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
      new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)),
    );

  const stripBox = (s0: number, s1: number, v0: number, v1: number, y0: number, y1: number): THREE.Box3 => {
    const a = ringPoint(s0);
    const seg = a.seg;
    const t0 = wrapS(s0) - seg.s0;
    const t1 = t0 + (s1 - s0);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const t of [t0, t1]) {
      for (const v of [v0, v1]) {
        const x = seg.ax + seg.dx * t + seg.nx * v;
        const z = seg.az + seg.dz * t + seg.nz * v;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
    }
    return mkBox(x0, y0, z0, x1, y1, z1);
  };

  const baseUnder = (s: number, half: number): number => {
    const p = ringPoint(s);
    let m = Infinity;
    for (const o of [-half, 0, half]) m = Math.min(m, evalPads(p.x + p.seg.nx * o, p.z + p.seg.nz * o));
    return m - 3.5;
  };

  const towers: TowerInfo[] = TOWER_DEFS.map((def) => {
    const s = ringS(def.x, def.z);
    const p = ringPoint(s);
    return { ...def, x: p.x, z: p.z, s, seg: p.seg, top: wallTop(s), thick: wallThick(s) };
  });

  const nearVertex = (s: number, pad: number): boolean =>
    SEGS.some((sg) => Math.abs(dS(s, sg.s0)) < wallThick(sg.s0) * 0.5 + BASTION_PAD + pad);
  const inTower = (s: number): boolean => towers.some((t) => Math.abs(dS(s, t.s)) < t.half);
  const inStairOpening = (s: number): boolean =>
    stairs.some((st) => s >= st.sOpen0 && s <= st.sOpen1);

  // Wall segments: 1.0c step platforms on top + solid wall collider stopping 0.45c below top
  for (const sg of SEGS) {
    const cuts = gates
      .filter((g) => g.seg === sg)
      .map((g) => [g.s - GATE_HALF, g.s + GATE_HALF] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const runs: [number, number][] = [];
    let cur = sg.s0;
    for (const [a, b] of cuts) {
      if (a > cur) runs.push([cur, a]);
      cur = b;
    }
    if (cur < sg.s0 + sg.L) runs.push([cur, sg.s0 + sg.L]);

    for (const [ra, rb] of runs) {
      // Wall body collider chunks (2.0c)
      const nBody = Math.max(1, Math.ceil((rb - ra) / 2.0));
      for (let k = 0; k < nBody; k++) {
        const s0 = ra + ((rb - ra) * k) / nBody;
        const s1 = ra + ((rb - ra) * (k + 1)) / nBody;
        const sm = (s0 + s1) * 0.5;
        const T = wallThick(sm);
        const minTop = Math.min(wallTop(s0), wallTop(s1));
        colliders.push(stripBox(s0, s1, -T * 0.5, T * 0.5, baseUnder(sm, T * 0.5), minTop - 0.45));
      }

      // Walkable wall-top platforms & compact 1.0c parapet chunks (wide clear diagonal path!)
      const nStep = Math.max(1, Math.ceil((rb - ra) / 1.0));
      for (let k = 0; k < nStep; k++) {
        const s0 = ra + ((rb - ra) * k) / nStep;
        const s1 = ra + ((rb - ra) * (k + 1)) / nStep;
        const sm = (s0 + s1) * 0.5;
        const T = wallThick(sm);
        const top = wallTop(sm);
        platforms.push(stripBox(s0, s1, -T * 0.5 + INNER_CURB_T, T * 0.5 - PARAPET_T, top - 1.2, top));

        if (!nearVertex(sm, 0.4) && !inTower(sm)) {
          colliders.push(stripBox(s0, s1, T * 0.5 - PARAPET_T, T * 0.5, top, top + PARAPET_H));
        }
        if (!nearVertex(sm, 0.4) && !inStairOpening(sm)) {
          colliders.push(stripBox(s0, s1, -T * 0.5, -T * 0.5 + INNER_CURB_T, top, top + INNER_CURB_H));
        }
      }
    }
  }

  // Corner bastions
  const bastions: NehemiahPlan['bastions'] = [];
  for (let i = 0; i < SEGS.length; i++) {
    const out = SEGS[i]!;
    const inc = SEGS[(i - 1 + SEGS.length) % SEGS.length]!;
    const T = wallThick(out.s0);
    const half = T * 0.5 + BASTION_PAD;
    const top = wallTop(out.s0);
    const vx = out.ax;
    const vz = out.az;
    let base = Infinity;
    for (const [ox, oz] of [[-half, -half], [half, -half], [-half, half], [half, half], [0, 0]] as const) {
      base = Math.min(base, evalPads(vx + ox, vz + oz));
    }
    base -= 3.5;
    colliders.push(mkBox(vx - half, base, vz - half, vx + half, top - 0.45, vz + half));
    platforms.push(mkBox(vx - half, top - 1.2, vz - half, vx + half, top, vz + half));

    const bx = inc.nx + out.nx;
    const bz = inc.nz + out.nz;
    const bl = Math.hypot(bx, bz) || 1;
    const sides: [number, number][] = [];
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const attached = sx * -inc.dx + sz * -inc.dz > 0.55 || sx * out.dx + sz * out.dz > 0.55;
      if (attached) continue;
      const outward = (sx * bx + sz * bz) / bl > 0.1;
      const hPar = outward ? PARAPET_H : INNER_CURB_H;
      const tPar = outward ? PARAPET_T : INNER_CURB_T;
      if (outward) sides.push([sx, sz]);
      if (sx !== 0) {
        const xa = vx + sx * half;
        colliders.push(mkBox(xa, top, vz - half, xa - sx * tPar, top + hPar, vz + half));
      } else {
        const za = vz + sz * half;
        colliders.push(mkBox(vx - half, top, za, vx + half, top + hPar, za - sz * tPar));
      }
    }
    bastions.push({ x: vx, z: vz, half, top, base, sides });
  }

  // Gatehouses: flanking piers + clear passage + overhead deck platform + parapets
  for (const g of gates) {
    const seg = g.seg;
    const T = g.thick;
    const base = Math.min(g.floor, baseUnder(g.s, T * 0.5 + GATE_OUT)) - 3.5;
    const ux = seg.dx;
    const uz = seg.dz;
    const nx = seg.nx;
    const nz = seg.nz;
    const rect = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number): THREE.Box3 => {
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (const u of [u0, u1]) {
        for (const v of [v0, v1]) {
          const x = g.x + ux * u + nx * v;
          const z = g.z + uz * u + nz * v;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          z0 = Math.min(z0, z);
          z1 = Math.max(z1, z);
        }
      }
      return mkBox(x0, y0, z0, x1, y1, z1);
    };
    const vIn = -T * 0.5 - GATE_IN;
    const vOut = T * 0.5 + GATE_OUT;
    // Two gate piers
    colliders.push(rect(-GATE_HALF, -PASS_HALF, vIn, vOut, base, g.top - 0.45));
    colliders.push(rect(PASS_HALF, GATE_HALF, vIn, vOut, base, g.top - 0.45));
    // Overhead masonry lintel collider (above PASS_CLEAR = 9.0c so tall headroom below!)
    colliders.push(rect(-PASS_HALF, PASS_HALF, vIn, vOut, g.floor + PASS_CLEAR, g.top - 0.45));
    // Full roof deck platform across piers & passage
    platforms.push(rect(-GATE_HALF - 0.3, GATE_HALF + 0.3, vIn + INNER_CURB_T, vOut - PARAPET_T, g.top - 1.2, g.top));
    // Outer & side parapets + inner guard curb on roof deck
    colliders.push(rect(-GATE_HALF, GATE_HALF, vOut - PARAPET_T, vOut, g.top, g.top + PARAPET_H));
    colliders.push(rect(-GATE_HALF, -GATE_HALF + PARAPET_T, T * 0.5, vOut, g.top, g.top + PARAPET_H));
    colliders.push(rect(GATE_HALF - PARAPET_T, GATE_HALF, T * 0.5, vOut, g.top, g.top + PARAPET_H));
    colliders.push(rect(-GATE_HALF, GATE_HALF, vIn, vIn + INNER_CURB_T, g.top, g.top + INNER_CURB_H));
    colliders.push(rect(-GATE_HALF, -GATE_HALF + INNER_CURB_T, vIn, -T * 0.5, g.top, g.top + INNER_CURB_H));
    colliders.push(rect(GATE_HALF - INNER_CURB_T, GATE_HALF, vIn, -T * 0.5, g.top, g.top + INNER_CURB_H));
  }

  // Named Towers projecting outward from outer wall face
  for (const t of towers) {
    const T = t.thick;
    colliders.push(
      stripBox(t.s - t.half, t.s + t.half, T * 0.5 - PARAPET_T, T * 0.5 + t.proj, baseUnder(t.s, T * 0.5 + t.proj), t.top + t.rise),
    );
  }

  // 4 Inner Wall Staircases: step platforms + top landing platform + outer balustrade
  for (const st of stairs) {
    const seg = st.seg;
    const g = gates.find((gg) => gg.id === st.gateId)!;
    const inX = -seg.nx;
    const inZ = -seg.nz;
    const sx = seg.dx * st.side;
    const sz = seg.dz * st.side;
    const sRect = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number): THREE.Box3 => {
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (const u of [u0, u1]) {
        for (const v of [v0, v1]) {
          const x = g.x + sx * u + inX * v;
          const z = g.z + sz * u + inZ * v;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          z0 = Math.min(z0, z);
          z1 = Math.max(z1, z);
        }
      }
      return mkBox(x0, y0, z0, x1, y1, z1);
    };

    const runStep = (st.uTop0 - st.uBot) / st.steps;
    const riseStep = (st.yTop - st.yBot) / st.steps;
    for (let i = 0; i < st.steps; i++) {
      const uA = st.uBot + i * runStep - 0.08;
      const uB = st.uBot + (i + 1) * runStep + 0.12;
      const yStep = st.yBot + (i + 1) * riseStep;
      platforms.push(sRect(uA, uB, st.vNear - 0.2, st.vFar, yStep - 0.8, yStep));
    }
    // Top landing connecting smoothly through sOpen0..sOpen1 onto wall-walk
    platforms.push(sRect(st.uTop0 - 0.2, st.uTop1, st.vNear - 1.5, st.vFar, st.yTop - 1.2, st.yTop));
    // Balustrade along open inner edge of stair & end of top landing so climbers turn onto wall-walk
    colliders.push(sRect(st.uTop1, st.uTop1 + 0.8, st.vNear, st.vFar + 0.8, st.yBot - 2, st.yTop + 2.0));
    const nBal = 8;
    for (let k = 0; k < nBal; k++) {
      const uA = st.uBot + 1.5 + ((st.uTop1 - (st.uBot + 1.5)) * k) / nBal;
      const uB = st.uBot + 1.5 + ((st.uTop1 - (st.uBot + 1.5)) * (k + 1)) / nBal;
      const hBal = st.yBot + ((st.yTop - st.yBot) * (k + 1)) / nBal + 1.8;
      colliders.push(sRect(uA, uB, st.vFar, st.vFar + 0.8, st.yBot - 2, hBal));
    }
  }

  // City of David Stepped Street (Neh 3:15; 12:37)
  {
    const cs = citySteps;
    const dz = (cs.z1 - cs.z0) / cs.steps;
    const dy = (cs.y1 - cs.y0) / cs.steps;
    for (let i = 0; i < cs.steps; i++) {
      const zA = cs.z0 + i * dz - 0.08;
      const zB = cs.z0 + (i + 1) * dz + 0.12;
      const yTop = cs.y0 + (i + 1) * dy;
      platforms.push(mkBox(cs.x0, yTop - 0.8, zA, cs.x1, yTop, zB));
    }
    // Low cheek curbs flanking the stepped street
    colliders.push(mkBox(cs.x0 - 1.0, cs.y0 - 2, cs.z0 + 2, cs.x0, cs.y1 + 1.6, cs.z1 - 1));
    colliders.push(mkBox(cs.x1, cs.y0 - 2, cs.z0 + 2, cs.x1 + 1.0, cs.y1 + 1.6, cs.z1 - 1));
  }

  // Pool of Shelah / Siloam walkable basin steps & coping
  {
    const p = pool;
    // Low stone coping on North, West, South; East side faces stepped descent
    colliders.push(mkBox(p.cx - p.hx - 1.2, p.rim - 2, p.cz + p.hz, p.cx + p.hx + 1.2, p.rim + 1.7, p.cz + p.hz + 1.2));
    colliders.push(mkBox(p.cx - p.hx - 1.2, p.rim - 2, p.cz - p.hz - 1.2, p.cx + p.hx + 1.2, p.rim + 1.7, p.cz - p.hz));
    colliders.push(mkBox(p.cx - p.hx - 1.2, p.rim - 2, p.cz - p.hz, p.cx - p.hx, p.rim + 1.7, p.cz + p.hz));
    // 5 wide eastern immersion steps down to water edge
    for (let i = 0; i < 5; i++) {
      const xA = p.cx + p.hx - (i + 1) * 1.1;
      const xB = p.cx + p.hx - i * 1.1 + 0.1;
      const yT = p.rim - (i + 1) * 0.28;
      platforms.push(mkBox(xA, yT - 0.8, p.cz - p.hz + 0.5, xB, yT, p.cz + p.hz - 0.5));
    }
    // Prevent wading into deep water past step 5
    colliders.push(mkBox(p.cx - p.hx, p.rim - 4, p.cz - p.hz, p.cx + p.hx - 5.5, p.rim + 1.8, p.cz + p.hz));
  }

  // Ezra's Wooden Podium in Water Gate Square (Neh 8:4) — walkable via 10 west steps!
  {
    const pd = square.podium;
    const L = square.level;
    colliders.push(mkBox(pd.x0, L - 1, pd.z0, pd.x1, L + pd.h - 0.45, pd.z1));
    platforms.push(mkBox(pd.x0, L + pd.h - 1.0, pd.z0, pd.x1, L + pd.h, pd.z1));
    // Reading lectern & parapet on east/north/south of podium
    colliders.push(mkBox(pd.x0 + 1.2, L + pd.h, pd.z0 + 3.2, pd.x0 + 3.2, L + pd.h + 2.4, pd.z1 - 3.2));
    const nS = 10;
    for (let i = 0; i < nS; i++) {
      const xA = pd.x0 - (nS - i) * 0.85;
      const xB = pd.x0 - (nS - i - 1) * 0.85 + 0.1;
      const yS = L + ((i + 1) * pd.h) / nS;
      platforms.push(mkBox(xA, yS - 0.7, pd.z0 + 1.8, xB, yS, pd.z1 - 1.8));
    }
  }

  // Zerubbabel's 60x60c Second Temple (Ezra 6:3-4) — walkable Porch & Holy Place + Altar (Ezra 3:2-3)
  {
    const L = temple.level;
    const podTop = L + temple.podium;
    // Podium base (collider below top, platform on top)
    colliders.push(mkBox(temple.x0 - 2, L - 3, temple.z0 - 2, temple.x1 + 2, podTop - 0.45, temple.z1 + 2));
    platforms.push(mkBox(temple.x0 - 2, podTop - 1.2, temple.z0 - 2, temple.x1 + 2, podTop, temple.z1 + 2));
    // 10 eastern porch steps (X = 144 .. 152.5, Z = 240 .. 260)
    for (let i = 0; i < 10; i++) {
      const xA = temple.x1 + 2 + (9 - i) * 0.85 - 0.08;
      const xB = temple.x1 + 2 + (10 - i) * 0.85 + 0.08;
      const yS = L + ((i + 1) * temple.podium) / 10;
      platforms.push(mkBox(xA, yS - 0.8, 240, xB, yS, 260));
    }
    // North & South 20c side-chamber wings (Z = 220..240 and 260..280) + West Most Holy / rear block (X = 82..105)
    colliders.push(mkBox(temple.x0, podTop, temple.z0, temple.x1, podTop + temple.sideH, 240));
    colliders.push(mkBox(temple.x0, podTop, 260, temple.x1, podTop + temple.sideH, temple.z1));
    colliders.push(mkBox(temple.x0, podTop, 240, 105, podTop + temple.naveH, 260)); // Veil & Most Holy Place blocked
    // East front piers flanking the 8-cubit wide sanctuary portal (Z = 240..246 & 254..260, X = 136..142)
    colliders.push(mkBox(136, podTop, 240, temple.x1, podTop + temple.naveH, 246));
    colliders.push(mkBox(136, podTop, 254, temple.x1, podTop + temple.naveH, 260));
    // Overhead portal lintel & nave roof
    colliders.push(mkBox(105, podTop + 16, 240, temple.x1, podTop + temple.naveH, 260));

    // Altar of Burnt Offering (Ezra 3:2-3) at (164, 250)
    const a = temple.altar;
    colliders.push(mkBox(a.x - a.half, L - 2, a.z - a.half, a.x + a.half, L + a.h, a.z + a.half));
  }

  // Post-exilic Courtyard Houses ("each opposite his own house", Neh 3:10, 23, 28-30; spacious plots Neh 7:4)
  const houseSpots: [number, number, number, number, number][] = [
    [108, 130, 12, 9, 7.2],
    [130, 128, 11, 8.5, 6.8],
    [168, 130, 11, 9, 7.0],
    [58, -42, 12, 9, 7.0],
    [56, -74, 11, 8.5, 6.5],
    [60, -108, 12, 9, 7.0],
    [14, -222, 13, 10, 7.5], // House of David terrace area (Neh 12:37)
    [14, -204, 12, 9, 7.0],
    [26, 86, 12, 10, 7.4],
    [-58, 288, 12, 10, 7.2],
    [-86, 304, 11, 9, 6.8],
    [-162, 46, 12, 9, 7.0],
  ];
  const houses = houseSpots.map(([x, z, w, d, h]) => {
    let base = Infinity;
    for (const [ox, oz] of [[-w * 0.5, -d * 0.5], [w * 0.5, -d * 0.5], [-w * 0.5, d * 0.5], [w * 0.5, d * 0.5]] as const) {
      base = Math.min(base, evalPads(x + ox, z + oz));
    }
    base -= 2.0;
    colliders.push(mkBox(x - w * 0.5, base, z - d * 0.5, x + w * 0.5, base + 2.0 + h, z + d * 0.5));
    return { x, z, w, d, h, base };
  });

  PLAN_CACHE = {
    colliders,
    platforms,
    gates,
    towers,
    stairs,
    wallTop,
    maxWallTop,
    groundC,
    terrainVisualC,
    citySteps,
    temple,
    square,
    pool,
    houses,
    bastions,
  };
  return PLAN_CACHE;
}

export interface NehemiahCounts {
  gates: number;
  towers: number;
  broadWallCubits: number;
  templeCubits: number;
  daysRebuilt: number;
  stairs: number;
}

export interface NehemiahCity {
  group: THREE.Group;
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  counts: NehemiahCounts;
  plan: NehemiahPlan;
  CUBIT: number;
  MAX_WALL_Y: number;
  floorY: (x: number, z: number) => number;
  rescale: (newCubit: number) => number;
  update: (dt: number, elapsed: number) => void;
}

function paintLimestoneEarthCanvas(): HTMLCanvasElement {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c4baa3';
  ctx.fillRect(0, 0, S, S);
  let seed = 44503;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 2400; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 0.6 + rand() * 2.4;
    const v = 148 + Math.round(rand() * 88);
    ctx.fillStyle = `rgba(${v + 8},${v + 2},${v - 14},${0.16 + rand() * 0.28})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 36; i++) {
    ctx.fillStyle = `rgba(236,228,210,${0.22 + rand() * 0.26})`;
    ctx.beginPath();
    ctx.ellipse(rand() * S, rand() * S, 4 + rand() * 8, 2 + rand() * 5, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function buildNehemiah(initialCubit = NEHEMIAH_DEFAULT_CUBIT): NehemiahCity {
  const plan = nehemiahPlan();
  const tex = buildEzekielTextures();

  const root = new THREE.Group();
  root.name = 'NehemiahJerusalemRoot';
  const unitGroup = new THREE.Group();
  unitGroup.name = 'NehemiahUnitScale';
  root.add(unitGroup);

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  unitGroup.add(staticGroup);
  unitGroup.add(dynamicGroup);

  const counts: NehemiahCounts = {
    gates: plan.gates.length,
    towers: plan.towers.length,
    broadWallCubits: BROAD_T,
    templeCubits: 60,
    daysRebuilt: 52,
    stairs: plan.stairs.length + 3,
  };

  // Materials
  const wallMat = tex.ashlarMat.clone();
  wallMat.color = new THREE.Color('#d8c6a2');
  const broadWallMat = tex.ashlarMat.clone();
  broadWallMat.color = new THREE.Color('#cbb68e');
  const towerMat = tex.ashlarMat.clone();
  towerMat.color = new THREE.Color('#cfb993');
  const trimMat = tex.ashlarTrimMat;
  const pavingMat = tex.pavingMat;
  const ritzpahMat = tex.ritzpahMat;
  const cedarMat = tex.cedarPlainMat;
  const cedarCarvedMat = tex.cedarCarvedMat;
  const goldMat = tex.debirGoldMat;
  const bronzeMat = tex.bronzeMat;
  const plasterMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e5dac2'), roughness: 0.88 });
  const scrollMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f5ebd2'), roughness: 0.72 });
  const veilMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#425692'), roughness: 0.75 });
  const flameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffc168'),
    emissive: new THREE.Color('#ff7b1c'),
    emissiveIntensity: 2.3,
    roughness: 0.5,
  });
  const bannerSouthMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dfb044'),
    roughness: 0.58,
    side: THREE.DoubleSide,
  });
  const bannerNorthMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3b6eb2'),
    roughness: 0.58,
    side: THREE.DoubleSide,
  });

  function addBox(
    parent: THREE.Object3D,
    cx: number,
    y0: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    bevel = 0.04,
    uvMul = 0.2,
  ): THREE.Mesh {
    const m = bevelBox(Math.max(0.02, w), Math.max(0.02, h), Math.max(0.02, d), mat, bevel);
    m.position.set(cx, y0 + h * 0.5, cz);
    const uv = m.geometry.attributes.uv;
    if (uv) {
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvMul, uv.getY(i) * uvMul);
      uv.needsUpdate = true;
    }
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ---------------------------------------------------------------------------
  // 1. SCULPTED JERUSALEM HILLS, VALLEYS & KING'S GARDEN TERRACES (ZERO DUNES!)
  // ---------------------------------------------------------------------------
  const earthCanvas = paintLimestoneEarthCanvas();
  const earthTex = new THREE.CanvasTexture(earthCanvas);
  earthTex.wrapS = THREE.RepeatWrapping;
  earthTex.wrapT = THREE.RepeatWrapping;
  earthTex.colorSpace = THREE.SRGBColorSpace;
  earthTex.anisotropy = 8;

  const terrainMat = new THREE.MeshStandardMaterial({
    map: earthTex,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.0,
  });
  terrainMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNehTerrain;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNehTerrain = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNehTerrain;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 tNear = texture2D(map, vNehTerrain.xz / 15.0);
          vec4 tFar = texture2D(map, vNehTerrain.xz / 64.0 + 0.31);
          diffuseColor *= mix(tNear, tFar, 0.44) * 1.24;
        #endif`,
      );
  };
  terrainMat.customProgramCacheKey = () => 'nehemiah-hills-triplanar';

  const T_SIZE = 2700;
  const T_SEG = 270;
  const tGeo = new THREE.PlaneGeometry(T_SIZE, T_SIZE, T_SEG, T_SEG);
  tGeo.rotateX(-Math.PI / 2);
  const tPos = tGeo.attributes.position!;
  const tCols = new Float32Array(tPos.count * 3);
  const colCity = new THREE.Color('#ccb892');
  const colLimestone = new THREE.Color('#b0a17f');
  const colValley = new THREE.Color('#778750');
  const colGarden = new THREE.Color('#557c42');
  const colOlives = new THREE.Color('#6f814b');
  const cTmp = new THREE.Color();

  for (let i = 0; i < tPos.count; i++) {
    const vx = tPos.getX(i);
    const vz = tPos.getZ(i);
    const vy = plan.terrainVisualC(vx, vz);
    tPos.setY(i, vy);

    if (insideCity(vx, vz)) {
      const green = gauss(vx, vz, 16, -284, 34) * 0.42;
      cTmp.copy(colCity).lerp(colGarden, green);
    } else {
      const lowValley = 1 - smoothstep(2, 26, vy);
      cTmp.copy(colLimestone).lerp(colValley, lowValley * 0.82);
      const kingsGarden = gauss(vx, vz, 95, -285, 58);
      cTmp.lerp(colGarden, kingsGarden * 0.78);
      if (vx > 310) cTmp.lerp(colOlives, smoothstep(310, 420, vx) * 0.62);
    }
    tCols[i * 3] = cTmp.r;
    tCols[i * 3 + 1] = cTmp.g;
    tCols[i * 3 + 2] = cTmp.b;
  }
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCols, 3));
  tGeo.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(tGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.userData.dynamic = true;
  terrainMesh.userData.noCast = true;
  dynamicGroup.add(terrainMesh);

  // ---------------------------------------------------------------------------
  // 2. CONTINUOUS FORTIFICATION CIRCUIT WALL & BROAD WALL (VERIFIED +N / +Y WINDING)
  // ---------------------------------------------------------------------------
  const wallPositions: number[] = [];
  const wallUvs: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nTest = new THREE.Vector3();

  /** Pushes a quad guaranteed to wind counter-clockwise toward `wantNormal`. */
  const pushOrientedQuad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    wantNormal: THREE.Vector3,
    ua: [number, number],
    ub: [number, number],
    uc: [number, number],
    ud: [number, number],
  ) => {
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    nTest.crossVectors(e1, e2);
    if (nTest.dot(wantNormal) >= 0) {
      wallPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
      wallUvs.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
    } else {
      wallPositions.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
      wallUvs.push(...ua, ...ud, ...uc, ...ua, ...uc, ...ub);
    }
  };

  const UP = new THREE.Vector3(0, 1, 0);
  const UV_SCALE = 1 / 9;
  const merlonMatrices: THREE.Matrix4[] = [];
  const pushMerlon = (x: number, y0: number, z: number, w: number, h: number, d: number, rotY: number) => {
    merlonMatrices.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y0 + h * 0.5, z),
        new THREE.Quaternion().setFromAxisAngle(UP, rotY),
        new THREE.Vector3(w, h, d),
      ),
    );
  };

  const nearVertexS = (s: number, pad: number): boolean =>
    RING_SEGS.some((sg) => Math.abs(dS(s, sg.s0)) < wallThick(sg.s0) * 0.5 + BASTION_PAD + pad);
  const inTowerS = (s: number): boolean => plan.towers.some((t) => Math.abs(dS(s, t.s)) < t.half + 0.5);
  const inStairS = (s: number): boolean => plan.stairs.some((st) => s >= st.sOpen0 && s <= st.sOpen1);

  const sValley = plan.gates.find((g) => g.id === 'valley')!.s;
  const sWater = plan.gates.find((g) => g.id === 'water')!.s;
  const sSheep = plan.gates.find((g) => g.id === 'sheep')!.s;
  const choirBanners: { x: number; y: number; z: number; rot: number; southChoir: boolean }[] = [];

  for (const sg of RING_SEGS) {
    const cuts = plan.gates
      .filter((g) => g.seg === sg)
      .map((g) => [g.s - GATE_HALF, g.s + GATE_HALF] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const runs: [number, number][] = [];
    let cur = sg.s0;
    for (const [a, b] of cuts) {
      if (a > cur) runs.push([cur, a]);
      cur = b;
    }
    if (cur < sg.s0 + sg.L) runs.push([cur, sg.s0 + sg.L]);

    const nOut = new THREE.Vector3(sg.nx, 0, sg.nz);
    const nIn = new THREE.Vector3(-sg.nx, 0, -sg.nz);
    const nFwd = new THREE.Vector3(sg.dx, 0, sg.dz);
    const nBack = new THREE.Vector3(-sg.dx, 0, -sg.dz);
    const yawSeg = Math.atan2(sg.dx, sg.dz);

    for (const [ra, rb] of runs) {
      const n = Math.max(1, Math.ceil((rb - ra) / 2.0));
      const rows: { s: number; P: THREE.Vector3[] }[] = [];
      for (let k = 0; k <= n; k++) {
        const s = ra + ((rb - ra) * k) / n;
        const t = s - sg.s0;
        const cx = sg.ax + sg.dx * t;
        const cz = sg.az + sg.dz * t;
        const T = wallThick(s);
        const top = plan.wallTop(s);
        const curbH = inStairS(s) ? 0.02 : 1.15;
        const off = (v: number): [number, number] => [cx + sg.nx * v, cz + sg.nz * v];
        const [ox, oz] = off(T * 0.5);
        const [px, pz] = off(T * 0.5 - PARAPET_T);
        const [qx, qz] = off(-T * 0.5 + INNER_CURB_T);
        const [ix, iz] = off(-T * 0.5);
        const baseO = plan.terrainVisualC(ox, oz) - 3.5;
        const baseI = plan.terrainVisualC(ix, iz) - 3.5;
        rows.push({
          s,
          P: [
            new THREE.Vector3(ox, baseO, oz), // 0 outer foot
            new THREE.Vector3(ox, top + 1.55, oz), // 1 outer parapet top
            new THREE.Vector3(px, top + 1.55, pz), // 2 outer parapet inner top
            new THREE.Vector3(px, top, pz), // 3 wall-walk outer edge
            new THREE.Vector3(qx, top, qz), // 4 wall-walk inner edge
            new THREE.Vector3(qx, top + curbH, qz), // 5 inner coping inner top
            new THREE.Vector3(ix, top + curbH, iz), // 6 inner coping outer top
            new THREE.Vector3(ix, baseI, iz), // 7 inner wall foot
          ],
        });
      }

      for (let k = 0; k < n; k++) {
        const A = rows[k]!;
        const B = rows[k + 1]!;
        const ua = A.s * UV_SCALE;
        const ub = B.s * UV_SCALE;
        const pa = A.P;
        const pb = B.P;
        pushOrientedQuad(pa[0]!, pa[1]!, pb[1]!, pb[0]!, nOut, [ua, pa[0]!.y * UV_SCALE], [ua, pa[1]!.y * UV_SCALE], [ub, pb[1]!.y * UV_SCALE], [ub, pb[0]!.y * UV_SCALE]);
        pushOrientedQuad(pa[1]!, pb[1]!, pb[2]!, pa[2]!, UP, [ua, 0], [ub, 0], [ub, 0.2], [ua, 0.2]);
        pushOrientedQuad(pa[2]!, pa[3]!, pb[3]!, pb[2]!, nIn, [ua, pa[2]!.y * UV_SCALE], [ua, pa[3]!.y * UV_SCALE], [ub, pb[3]!.y * UV_SCALE], [ub, pb[2]!.y * UV_SCALE]);
        pushOrientedQuad(pa[3]!, pb[3]!, pb[4]!, pa[4]!, UP, [ua, 0], [ub, 0], [ub, 0.75], [ua, 0.75]);
        pushOrientedQuad(pa[4]!, pa[5]!, pb[5]!, pb[4]!, nOut, [ua, 0], [ua, 0.16], [ub, 0.16], [ub, 0]);
        pushOrientedQuad(pa[5]!, pb[5]!, pb[6]!, pa[6]!, UP, [ua, 0], [ub, 0], [ub, 0.14], [ua, 0.14]);
        pushOrientedQuad(pa[6]!, pa[7]!, pb[7]!, pb[6]!, nIn, [ua, pa[6]!.y * UV_SCALE], [ua, pa[7]!.y * UV_SCALE], [ub, pb[7]!.y * UV_SCALE], [ub, pb[6]!.y * UV_SCALE]);
      }

      // End caps at gate breaks
      const capStart = rows[0]!.P;
      pushOrientedQuad(capStart[0]!, capStart[7]!, capStart[4]!, capStart[3]!, nBack, [0, 0], [1, 0], [1, 1], [0, 1]);
      const capEnd = rows[rows.length - 1]!.P;
      pushOrientedQuad(capEnd[0]!, capEnd[3]!, capEnd[4]!, capEnd[7]!, nFwd, [0, 0], [0, 1], [1, 1], [1, 0]);

      // Outer merlons & dedication choir banners (Neh 12:31-39)
      for (let s = ra + 1.6; s < rb - 0.8; s += 3.3) {
        if (nearVertexS(s, 0.4) || inTowerS(s)) continue;
        const t = s - sg.s0;
        const T = wallThick(s);
        const top = plan.wallTop(s);
        const v = T * 0.5 - PARAPET_T * 0.5;
        pushMerlon(sg.ax + sg.dx * t + sg.nx * v, top + 1.55, sg.az + sg.dz * t + sg.nz * v, 1.7, 1.35, PARAPET_T, yawSeg);
      }

      for (let s = ra + 8; s < rb - 6; s += 38) {
        if (nearVertexS(s, 1.2) || inTowerS(s)) continue;
        const southChoir = dS(s, sValley) > 0 && dS(s, sWater) < 0;
        const northChoir = dS(s, sValley) < 0 && dS(s, sSheep) > 0;
        if (!southChoir && !northChoir) continue;
        const t = s - sg.s0;
        const T = wallThick(s);
        const top = plan.wallTop(s);
        const v = T * 0.5 - PARAPET_T * 0.5;
        choirBanners.push({
          x: sg.ax + sg.dx * t + sg.nx * v,
          y: top + 2.9,
          z: sg.az + sg.dz * t + sg.nz * v,
          rot: yawSeg,
          southChoir,
        });
      }
    }
  }

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
  wallGeo.computeVertexNormals();
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  wallMesh.userData.dynamic = true;
  dynamicGroup.add(wallMesh);

  // Monumental Broad Wall drafted lower masonry courses highlight (X = -210, Z = 130..230, Neh 3:8; 12:38)
  {
    const zMid = 180;
    const baseB = plan.terrainVisualC(-210, zMid) - 3;
    const topB = plan.wallTop(ringS(-210, zMid));
    addBox(staticGroup, -210, baseB, zMid, BROAD_T + 0.5, (topB - baseB) * 0.55, 98, broadWallMat, 0.06, 0.12);
    // Builder stack of cut ashlar blocks & timber beams beside Broad Wall ("half the wall height", Neh 4:6, 17)
    addBox(staticGroup, -197, plan.terrainVisualC(-197, 176), 176, 3.2, 2.2, 4.4, trimMat, 0.05, 0.25);
    addBox(staticGroup, -196.5, plan.terrainVisualC(-197, 182), 182, 2.6, 1.4, 6.2, cedarMat, 0.03, 0.3);
  }

  // ---------------------------------------------------------------------------
  // 3. CORNER BASTIONS & UPPER CHAMBER OF THE CORNER (Neh 3:31-32)
  // ---------------------------------------------------------------------------
  for (const b of plan.bastions) {
    addBox(staticGroup, b.x, b.base, b.z, b.half * 2, b.top - b.base, b.half * 2, towerMat, 0.06, 0.14);
    addBox(staticGroup, b.x, b.top - 0.45, b.z, b.half * 2 + 0.6, 0.48, b.half * 2 + 0.6, trimMat, 0.04, 0.2);
    for (const [sx, sz] of b.sides) {
      for (let a = -b.half + 1.2; a < b.half - 0.6; a += 3.2) {
        const px = sx !== 0 ? b.x + sx * (b.half - PARAPET_T * 0.5) : b.x + a;
        const pz = sz !== 0 ? b.z + sz * (b.half - PARAPET_T * 0.5) : b.z + a;
        pushMerlon(px, b.top, pz, sx !== 0 ? PARAPET_T : 1.7, 2.8, sx !== 0 ? 1.7 : PARAPET_T, 0);
      }
    }
  }
  // Upper Chamber of the NE Corner (Neh 3:31-32) — perched on outer corner so inner walkway stays open
  {
    const ne = plan.bastions[0]!;
    addBox(staticGroup, ne.x + ne.half * 0.52, ne.top, ne.z + ne.half * 0.52, ne.half * 0.9, 6.2, ne.half * 0.9, plasterMat, 0.05, 0.2);
    addBox(staticGroup, ne.x + ne.half * 0.52, ne.top + 6.2, ne.z + ne.half * 0.52, ne.half * 1.05, 0.6, ne.half * 1.05, cedarMat, 0.03, 0.28);
  }

  // ---------------------------------------------------------------------------
  // 4. TEN TIMBER-FRAMED ASHLAR GATEHOUSES (Neh 3:1-32)
  // ---------------------------------------------------------------------------
  const flames: { mesh: THREE.Mesh; phase: number }[] = [];
  const addTorch = (x: number, y: number, z: number) => {
    addBox(staticGroup, x, y - 0.85, z, 0.34, 0.85, 0.34, bronzeMat, 0.02, 0.4);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 8), flameMat);
    fl.position.set(x, y + 0.45, z);
    fl.userData.dynamic = true;
    fl.userData.noAO = true;
    fl.userData.noCast = true;
    fl.castShadow = false;
    dynamicGroup.add(fl);
    flames.push({ mesh: fl, phase: x * 0.29 + z * 0.17 });
  };

  for (const g of plan.gates) {
    const seg = g.seg;
    const T = g.thick;
    const alongX = Math.abs(seg.dx) > 0.5;
    const W = (u0: number, u1: number, v0: number, v1: number) => {
      const uc = (u0 + u1) * 0.5;
      const vc = (v0 + v1) * 0.5;
      return {
        x: g.x + seg.dx * uc + seg.nx * vc,
        z: g.z + seg.dz * uc + seg.nz * vc,
        w: alongX ? Math.abs(u1 - u0) : Math.abs(v1 - v0),
        d: alongX ? Math.abs(v1 - v0) : Math.abs(u1 - u0),
      };
    };

    const vIn = -T * 0.5 - GATE_IN;
    const vOut = T * 0.5 + GATE_OUT;
    const base = g.floor - 4.5;

    // Two flanking gate piers
    for (const [u0, u1] of [[-GATE_HALF, -PASS_HALF], [PASS_HALF, GATE_HALF]] as const) {
      const r = W(u0, u1, vIn, vOut);
      addBox(staticGroup, r.x, base, r.z, r.w, g.top - base, r.d, towerMat, 0.07, 0.14);
      addBox(staticGroup, r.x, g.floor - 0.25, r.z, r.w + 0.45, 1.3, r.d + 0.45, trimMat, 0.05, 0.2);
    }

    // Overhead masonry architrave + heavy cedar gatebeams (Neh 3:3, 6)
    {
      const r = W(-PASS_HALF, PASS_HALF, vIn, vOut);
      addBox(staticGroup, r.x, g.floor + PASS_CLEAR, r.z, r.w, g.top - (g.floor + PASS_CLEAR), r.d, towerMat, 0.05, 0.14);
      for (let k = 0; k < 5; k++) {
        const v = vIn + 1.0 + ((vOut - vIn - 2.0) * k) / 4;
        const rb = W(-PASS_HALF - 0.35, PASS_HALF + 0.35, v - 0.35, v + 0.35);
        addBox(staticGroup, rb.x, g.floor + PASS_CLEAR - 0.72, rb.z, rb.w, 0.72, rb.d, cedarMat, 0.03, 0.3);
      }
    }

    // Sheep Gate priestly consecration lintel frieze (Neh 3:1)
    if (g.id === 'sheep') {
      const rf = W(-GATE_HALF + 1, GATE_HALF - 1, vOut - 0.2, vOut + 0.35);
      addBox(staticGroup, rf.x, g.floor + PASS_CLEAR + 0.8, rf.z, rf.w, 1.6, rf.d, trimMat, 0.04, 0.25);
    }

    // Fountain Gate roofed timber canopy ("Shallun built it and roofed it", Neh 3:15)
    if (g.id === 'fountain') {
      const rc = W(-PASS_HALF - 2.5, PASS_HALF + 2.5, vOut, vOut + 4.8);
      addBox(staticGroup, rc.x, g.floor + PASS_CLEAR - 0.4, rc.z, rc.w, 0.85, rc.d, cedarCarvedMat, 0.04, 0.28);
      for (const su of [-1, 1]) {
        const rp = W(su * (PASS_HALF + 1.6) - 0.45, su * (PASS_HALF + 1.6) + 0.45, vOut + 3.6, vOut + 4.5);
        addBox(staticGroup, rp.x, g.floor, rp.z, rp.w, PASS_CLEAR - 0.4, rp.d, trimMat, 0.03, 0.25);
      }
    }

    // Roof deck parapets & merlons
    {
      const ro = W(-GATE_HALF, GATE_HALF, vOut - PARAPET_T, vOut);
      addBox(staticGroup, ro.x, g.top, ro.z, ro.w, 1.55, ro.d, towerMat, 0.04, 0.14);
      const ri = W(-GATE_HALF, GATE_HALF, vIn, vIn + INNER_CURB_T);
      addBox(staticGroup, ri.x, g.top, ri.z, ri.w, 1.15, ri.d, trimMat, 0.03, 0.2);
      for (let u = -GATE_HALF + 1.2; u < GATE_HALF - 0.6; u += 3.2) {
        const m = W(u - 0.85, u + 0.85, vOut - PARAPET_T, vOut);
        pushMerlon(m.x, g.top + 1.55, m.z, m.w, 1.35, m.d, 0);
      }
    }

    // Paved stone gateway road & swung-open bronze-strapped cedar double doors + bolts/bars (Neh 3:3, 6, 13-15)
    {
      const rp = W(-PASS_HALF - 1.5, PASS_HALF + 1.5, vIn - 10, vOut + 10);
      addBox(staticGroup, rp.x, g.floor - 0.28, rp.z, rp.w, 0.32, rp.d, pavingMat, 0.02, 0.18);
      for (const su of [-1, 1]) {
        const doorLeaf = W(su * (PASS_HALF - 0.28) - 0.18, su * (PASS_HALF - 0.28) + 0.18, -2.2, 1.8);
        addBox(staticGroup, doorLeaf.x, g.floor + 0.06, doorLeaf.z, doorLeaf.w, PASS_CLEAR - 0.9, doorLeaf.d, cedarCarvedMat, 0.02, 0.28);
        for (const bh of [1.8, 4.4, 7.0]) {
          const strap = W(su * (PASS_HALF - 0.28) - 0.24, su * (PASS_HALF - 0.28) + 0.24, -2.1, 1.7);
          addBox(staticGroup, strap.x, g.floor + bh, strap.z, strap.w, 0.22, strap.d, bronzeMat, 0.01, 0.4);
        }
        const tOut = W(su * (PASS_HALF + 1.4) - 0.1, su * (PASS_HALF + 1.4) + 0.1, vOut + 0.35, vOut + 0.55);
        addTorch(tOut.x, g.floor + 5.6, tOut.z);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. FOUR NAMED TOWERS: MEAH, HANANEL, FURNACES & GREAT OPHEL TOWER
  // ---------------------------------------------------------------------------
  for (const t of plan.towers) {
    const seg = t.seg;
    const T = t.thick;
    const alongX = Math.abs(seg.dx) > 0.5;
    const vc = T * 0.5 + t.proj * 0.5 - 0.4;
    const tx = t.x + seg.nx * vc;
    const tz = t.z + seg.nz * vc;
    const w = alongX ? t.half * 2 : t.proj + 0.8;
    const d = alongX ? t.proj + 0.8 : t.half * 2;
    const base = plan.terrainVisualC(tx, tz) - 5;
    const topY = t.top + t.rise;
    addBox(staticGroup, tx, base, tz, w, topY - base, d, towerMat, 0.08, 0.13);
    addBox(staticGroup, tx, topY - 0.6, tz, w + 0.8, 0.7, d + 0.8, trimMat, 0.05, 0.2);

    // Watchman brazier / furnace glow atop Hananel & Tower of the Furnaces
    if (t.id === 'hananel' || t.id === 'furnaces') {
      addBox(staticGroup, tx, topY, tz, 2.6, 1.3, 2.6, bronzeMat, 0.04, 0.3);
      addTorch(tx, topY + 1.4, tz);
    }
    // Crenelations around tower crown
    for (const sx of [-1, 0, 1]) {
      for (const sz of [-1, 0, 1]) {
        if (sx === 0 && sz === 0) continue;
        pushMerlon(tx + sx * (w * 0.5 - 0.7), topY, tz + sz * (d * 0.5 - 0.7), 1.6, 1.5, 1.4, 0);
      }
    }
  }

  // Instanced merlons across the entire circuit
  counts && void counts;
  const merlonInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trimMat, merlonMatrices.length);
  for (let i = 0; i < merlonMatrices.length; i++) merlonInst.setMatrixAt(i, merlonMatrices[i]!);
  merlonInst.instanceMatrix.needsUpdate = true;
  merlonInst.castShadow = true;
  merlonInst.receiveShadow = true;
  merlonInst.userData.dynamic = true;
  dynamicGroup.add(merlonInst);

  // Thanksgiving Choir Banners from Valley Gate (Neh 12:31, 38)
  for (const b of choirBanners) {
    addBox(staticGroup, b.x, b.y - 1.4, b.z, 0.18, 4.8, 0.18, cedarMat, 0.01, 0.4);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.4), b.southChoir ? bannerSouthMat : bannerNorthMat);
    flag.position.set(b.x, b.y + 1.8, b.z);
    flag.rotation.y = b.rot;
    flag.castShadow = true;
    staticGroup.add(flag);
  }

  // ---------------------------------------------------------------------------
  // 6. FOUR WALL STAIRCASES + MONUMENTAL STAIRS OF THE CITY OF DAVID (Neh 3:15; 12:37)
  // ---------------------------------------------------------------------------
  for (const st of plan.stairs) {
    const seg = st.seg;
    const g = plan.gates.find((gg) => gg.id === st.gateId)!;
    const alongX = Math.abs(seg.dx) > 0.5;
    const inX = -seg.nx;
    const inZ = -seg.nz;
    const sx = seg.dx * st.side;
    const sz = seg.dz * st.side;
    const sBox = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, mat: THREE.Material) => {
      const uc = (u0 + u1) * 0.5;
      const vc = (v0 + v1) * 0.5;
      const cx = g.x + sx * uc + inX * vc;
      const cz = g.z + sz * uc + inZ * vc;
      const w = alongX ? Math.abs(u1 - u0) : Math.abs(v1 - v0);
      const d = alongX ? Math.abs(v1 - v0) : Math.abs(u1 - u0);
      addBox(staticGroup, cx, y0, cz, w, y1 - y0, d, mat, 0.03, 0.18);
    };

    const runStep = (st.uTop0 - st.uBot) / st.steps;
    const riseStep = (st.yTop - st.yBot) / st.steps;
    for (let i = 0; i < st.steps; i++) {
      const uA = st.uBot + i * runStep;
      const uB = st.uBot + (i + 1) * runStep + 0.04;
      const yStep = st.yBot + (i + 1) * riseStep;
      sBox(uA, uB, st.vNear - 0.1, st.vFar, st.yBot - 2.2, yStep, trimMat);
    }
    sBox(st.uTop0, st.uTop1, st.vNear - 0.4, st.vFar, st.yBot - 2.2, st.yTop, towerMat);
    sBox(st.uTop1, st.uTop1 + 0.7, st.vNear, st.vFar + 0.7, st.yBot - 2.2, st.yTop + 1.5, trimMat);
    const nB = 8;
    for (let k = 0; k < nB; k++) {
      const uA = st.uBot + 1.2 + ((st.uTop1 - (st.uBot + 1.2)) * k) / nB;
      const uB = st.uBot + 1.2 + ((st.uTop1 - (st.uBot + 1.2)) * (k + 1)) / nB;
      const hBal = st.yBot + ((st.yTop - st.yBot) * (k + 1)) / nB + 1.3;
      sBox(uA, uB, st.vFar, st.vFar + 0.7, st.yBot - 2.2, hBal, trimMat);
    }
  }

  // Monumental Stepped Street of the City of David (Neh 3:15; 12:37)
  {
    const cs = plan.citySteps;
    const dz = (cs.z1 - cs.z0) / cs.steps;
    const dy = (cs.y1 - cs.y0) / cs.steps;
    for (let i = 0; i < cs.steps; i++) {
      const zA = cs.z0 + i * dz;
      const yTop = cs.y0 + (i + 1) * dy;
      addBox(staticGroup, (cs.x0 + cs.x1) * 0.5, cs.y0 - 2.0, zA + dz * 0.5, cs.x1 - cs.x0, yTop - (cs.y0 - 2.0), dz + 0.08, pavingMat, 0.03, 0.2);
    }
    addBox(staticGroup, cs.x0 - 0.5, cs.y0 - 2.0, (cs.z0 + cs.z1) * 0.5, 0.9, cs.y1 - cs.y0 + 3.2, cs.z1 - cs.z0, trimMat, 0.04, 0.16);
    addBox(staticGroup, cs.x1 + 0.5, cs.y0 - 2.0, (cs.z0 + cs.z1) * 0.5, 0.9, cs.y1 - cs.y0 + 3.2, cs.z1 - cs.z0, trimMat, 0.04, 0.16);
  }

  // ---------------------------------------------------------------------------
  // 7. POOL OF SHELAH / SILOAM & KING'S GARDEN TERRACES (Neh 3:15 — userData.noAO = true!)
  // ---------------------------------------------------------------------------
  {
    const p = plan.pool;
    // Paved Siloam plaza apron
    addBox(staticGroup, p.cx + 4, p.rim - 0.32, p.cz, p.hx * 2 + 16, 0.32, p.hz * 2 + 12, ritzpahMat, 0.02, 0.18);
    // Stone basin floor & four stepped retaining walls
    addBox(staticGroup, p.cx, p.rim - p.depth - 0.6, p.cz, p.hx * 2 + 2.4, 0.6, p.hz * 2 + 2.4, trimMat, 0.03, 0.2);
    addBox(staticGroup, p.cx, p.rim - p.depth, p.cz + p.hz + 0.6, p.hx * 2 + 2.4, p.depth + 1.4, 1.2, trimMat, 0.04, 0.2);
    addBox(staticGroup, p.cx, p.rim - p.depth, p.cz - p.hz - 0.6, p.hx * 2 + 2.4, p.depth + 1.4, 1.2, trimMat, 0.04, 0.2);
    addBox(staticGroup, p.cx - p.hx - 0.6, p.rim - p.depth, p.cz, 1.2, p.depth + 1.4, p.hz * 2, trimMat, 0.04, 0.2);
    // Hezekiah's Tunnel spring conduit arch on north basin wall
    addBox(staticGroup, p.cx - 3, p.rim - p.depth, p.cz + p.hz - 0.2, 3.6, 3.2, 1.6, towerMat, 0.04, 0.25);
    // 5 eastern limestone immersion steps
    for (let i = 0; i < 5; i++) {
      const xC = p.cx + p.hx - i * 1.1 - 0.55;
      const yT = p.rim - (i + 1) * 0.28;
      addBox(staticGroup, xC, p.rim - p.depth, p.cz, 1.12, yT - (p.rim - p.depth), p.hz * 2, trimMat, 0.02, 0.22);
    }

    // Translucent sparkling Siloam water plane (+Y normal, userData.noAO = true)
    const waterGeo = new THREE.PlaneGeometry(p.hx * 2 - 0.2, p.hz * 2 - 0.2, 12, 8);
    waterGeo.rotateX(-Math.PI / 2);
    const poolWater = new THREE.Mesh(waterGeo, tex.waterMat);
    poolWater.position.set(p.cx, p.water, p.cz);
    poolWater.receiveShadow = true;
    poolWater.userData.dynamic = true;
    poolWater.userData.noCast = true;
    poolWater.userData.noAO = true;
    dynamicGroup.add(poolWater);

    // King's Garden irrigation stream outside Fountain Gate (X = 72..120, Z = -282)
    const chanGeo = new THREE.PlaneGeometry(48, 2.8, 16, 2);
    chanGeo.rotateX(-Math.PI / 2);
    const cp = chanGeo.attributes.position!;
    for (let i = 0; i < cp.count; i++) {
      const wx = 96 + cp.getX(i);
      const wz = -282 + cp.getZ(i);
      cp.setX(i, wx);
      cp.setZ(i, wz);
      cp.setY(i, plan.terrainVisualC(wx, wz) + 0.22);
    }
    chanGeo.computeVertexNormals();
    const chanWater = new THREE.Mesh(chanGeo, tex.waterMat);
    chanWater.userData.dynamic = true;
    chanWater.userData.noCast = true;
    chanWater.userData.noAO = true;
    dynamicGroup.add(chanWater);
  }

  // ---------------------------------------------------------------------------
  // 8. WATER GATE SQUARE & EZRA'S WOODEN PODIUM FOR TORAH READING (Neh 8:1-8)
  // ---------------------------------------------------------------------------
  {
    const sq = plan.square;
    const L = sq.level;
    addBox(staticGroup, (sq.x0 + sq.x1) * 0.5, L - 0.3, (sq.z0 + sq.z1) * 0.5, sq.x1 - sq.x0, 0.34, sq.z1 - sq.z0, ritzpahMat, 0.02, 0.16);

    const pd = sq.podium;
    const pw = pd.x1 - pd.x0;
    const pdp = pd.z1 - pd.z0;
    const pcx = (pd.x0 + pd.x1) * 0.5;
    const pcz = (pd.z0 + pd.z1) * 0.5;
    // Timber deck & stout corner posts ("wooden platform made for the purpose", Neh 8:4)
    addBox(staticGroup, pcx, L, pcz, pw, pd.h, pdp, cedarMat, 0.04, 0.26);
    for (const ox of [-pw * 0.45, pw * 0.45]) {
      for (const oz of [-pdp * 0.45, pdp * 0.45]) {
        addBox(staticGroup, pcx + ox, L, pcz + oz, 0.75, pd.h + 2.1, 0.75, cedarCarvedMat, 0.02, 0.35);
      }
    }
    // 10 cedar steps on west approach
    for (let i = 0; i < 10; i++) {
      const xC = pd.x0 - (10 - i - 0.5) * 0.85;
      const yS = L + ((i + 1) * pd.h) / 10;
      addBox(staticGroup, xC, L - 0.2, pcz, 0.88, yS - (L - 0.2), pdp - 3.6, cedarMat, 0.02, 0.3);
    }
    // Carved reading lectern + unrolled Torah scroll (Neh 8:5)
    addBox(staticGroup, pd.x0 + 2.2, L + pd.h, pcz, 1.8, 2.2, 3.2, cedarCarvedMat, 0.03, 0.32);
    addBox(staticGroup, pd.x0 + 2.2, L + pd.h + 2.2, pcz, 1.5, 0.16, 2.6, scrollMat, 0.02, 0.4);
    for (const sz of [-1.35, 1.35]) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.8, 10), bronzeMat);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(pd.x0 + 2.2, L + pd.h + 2.3, pcz + sz);
      staticGroup.add(roller);
    }
  }

  // ---------------------------------------------------------------------------
  // 9. ZERUBBABEL'S 60x60 CUBIT SECOND TEMPLE & ALTAR (Ezra 3:2-3; 6:3-4)
  // ---------------------------------------------------------------------------
  const smokePuffs: { sprite: THREE.Sprite; baseY: number; phase: number }[] = [];
  let altarLight: THREE.PointLight;
  let hekhalLight: THREE.PointLight;
  {
    const tm = plan.temple;
    const L = tm.level;
    const podTop = L + tm.podium;

    // Paved Temple Court esplanade
    addBox(staticGroup, 130, L - 0.32, 250, 108, 0.34, 80, pavingMat, 0.02, 0.16);
    // 60x60c Temple podium + 10 eastern steps
    addBox(staticGroup, 112, L - 2.0, 250, 64, tm.podium + 2.0, 64, trimMat, 0.06, 0.16);
    for (let i = 0; i < 10; i++) {
      const xC = tm.x1 + 2 + (9.5 - i) * 0.85;
      const yS = L + ((i + 1) * tm.podium) / 10;
      addBox(staticGroup, xC, L - 0.5, 250, 0.88, yS - (L - 0.5), 20, trimMat, 0.02, 0.22);
    }

    // Ezra 6:4: "three layers of great stones and one layer of new timber"
    // Side chamber blocks (North & South wings of the 60x60c footprint)
    addBox(staticGroup, 112, podTop, 230, 60, tm.sideH, 20, wallMat, 0.06, 0.14);
    addBox(staticGroup, 112, podTop, 270, 60, tm.sideH, 20, wallMat, 0.06, 0.14);
    for (const ty of [6.5, 13.5, 20.5]) {
      addBox(staticGroup, 112, podTop + ty, 230, 60.4, 1.1, 20.4, cedarMat, 0.02, 0.25);
      addBox(staticGroup, 112, podTop + ty, 270, 60.4, 1.1, 20.4, cedarMat, 0.02, 0.25);
    }

    // Central Sanctuary Nave rising to 60 cubits total height (Ezra 6:3)
    addBox(staticGroup, 93.5, podTop, 250, 23, tm.naveH, 20, wallMat, 0.07, 0.13); // West Debir mass
    addBox(staticGroup, 139, podTop, 243, 6, tm.naveH, 6, trimMat, 0.05, 0.15); // South portal pier
    addBox(staticGroup, 139, podTop, 257, 6, tm.naveH, 6, trimMat, 0.05, 0.15); // North portal pier
    addBox(staticGroup, 123.5, podTop + 16, 250, 37, tm.naveH - 16, 20, wallMat, 0.07, 0.13); // Upper nave & Ulam facade
    for (const ty of [18, 28, 38, 48]) {
      addBox(staticGroup, 112, podTop + ty, 250, 60.5, 1.2, 20.5, cedarMat, 0.02, 0.25);
    }
    // Roof crown cornice at 60 cubits
    addBox(staticGroup, 112, podTop + tm.naveH - 1.2, 250, 61.2, 1.2, 21.2, trimMat, 0.04, 0.2);

    // Walkable Hekhal interior floor, cedar ceiling, Veil, Golden Menorah (Zech 4:2), Showbread & Incense Altar
    addBox(staticGroup, 121, podTop - 0.1, 250, 32, 0.18, 19.6, cedarCarvedMat, 0.01, 0.25);
    addBox(staticGroup, 121, podTop + 15.6, 250, 32, 0.4, 19.6, cedarCarvedMat, 0.02, 0.25);
    addBox(staticGroup, 105.3, podTop, 250, 0.35, 15.6, 19.4, veilMat, 0.01, 0.3);
    // Golden Lampstand (south), Showbread Table (north), Incense Altar (west before veil)
    addBox(staticGroup, 116, podTop, 245.5, 1.2, 3.4, 2.2, goldMat, 0.03, 0.4);
    addBox(staticGroup, 116, podTop, 254.5, 2.2, 1.8, 1.4, goldMat, 0.03, 0.4);
    addBox(staticGroup, 109, podTop, 250, 1.2, 2.4, 1.2, goldMat, 0.03, 0.4);

    hekhalLight = new THREE.PointLight('#ffd685', 14, 34 * initialCubit, 1.6);
    hekhalLight.position.set(116, podTop + 8, 250);
    dynamicGroup.add(hekhalLight);

    // Rebuilt Altar of Burnt Offering (Ezra 3:2-3) at (164, 250)
    const a = tm.altar;
    addBox(staticGroup, a.x, L, a.z, a.half * 2, a.h, a.half * 2, tex.hearthMat, 0.06, 0.22);
    addBox(staticGroup, a.x, L + a.h, a.z, a.half * 1.5, 0.35, a.half * 1.5, tex.emberMat, 0.02, 0.3);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const horn = altarHorn(1.0, 0.45, trimMat);
        horn.position.set(a.x + sx * (a.half - 0.5), L + a.h, a.z + sz * (a.half - 0.5));
        staticGroup.add(horn);
      }
    }
    altarLight = new THREE.PointLight('#ff8c3a', 15, 38 * initialCubit, 1.6);
    altarLight.position.set(a.x, L + a.h + 2.5, a.z);
    dynamicGroup.add(altarLight);

    for (let i = 0; i < 5; i++) {
      const smMat = new THREE.SpriteMaterial({
        map: tex.smokeTex,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(smMat);
      sp.position.set(a.x + (i - 2) * 0.4, L + a.h + 1.5, a.z);
      sp.userData.dynamic = true;
      sp.userData.noCast = true;
      sp.userData.noAO = true;
      dynamicGroup.add(sp);
      smokePuffs.push({ sprite: sp, baseY: L + a.h + 1.2, phase: i * 0.2 });
    }
  }

  // ---------------------------------------------------------------------------
  // 10. POST-EXILIC JERUSALEM COURTYARD HOUSES & OLIVE / FIG GROVES
  // ---------------------------------------------------------------------------
  for (const h of plan.houses) {
    addBox(staticGroup, h.x, h.base, h.z, h.w, h.h + 2.0, h.d, plasterMat, 0.05, 0.2);
    addBox(staticGroup, h.x, h.base + h.h + 2.0, h.z, h.w + 0.5, 0.45, h.d + 0.5, cedarMat, 0.03, 0.28);
  }

  const addTree = (tx: number, tz: number, sc: number) => {
    const ty = plan.terrainVisualC(tx, tz);
    const g = new THREE.Group();
    g.position.set(tx, ty, tz);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * sc, 0.62 * sc, 4.4 * sc, 7), tex.barkMat);
    trunk.position.y = 2.2 * sc;
    trunk.castShadow = true;
    g.add(trunk);
    for (const [ox, oy, oz, r] of [[0, 5.2, 0, 2.7], [-1.3, 4.5, 0.9, 2.0], [1.4, 4.6, -0.8, 1.9]] as const) {
      const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(r * sc, 1), tex.foliageMat);
      cr.position.set(ox * sc, oy * sc, oz * sc);
      cr.castShadow = true;
      cr.receiveShadow = true;
      g.add(cr);
    }
    staticGroup.add(g);
  };

  // King's Garden orchard (Neh 3:15), Mount of Olives grove (Neh 8:15), and scattered courtyard trees
  const treeSpots: [number, number, number][] = [
    [76, -294, 1.05], [88, -270, 1.15], [102, -296, 1.0], [114, -274, 1.1], [82, -256, 0.95], [108, -258, 1.05],
    [-4, -292, 0.95], [38, -294, 0.9], [46, 52, 0.95], [110, 198, 1.0], [72, 268, 0.95],
    [350, 210, 1.2], [380, 245, 1.25], [365, 285, 1.15], [410, 225, 1.3], [425, 270, 1.2], [395, 180, 1.15],
  ];
  for (const [tx, tz, sc] of treeSpots) addTree(tx, tz, sc);

  // Batch static meshes into single GPU draws per material
  batchStatic(staticGroup);

  const scaledColliders: THREE.Box3[] = [];
  const scaledPlatforms: THREE.Box3[] = [];
  let currentCubit = initialCubit;

  const syncScale = (cubitVal: number) => {
    scaledColliders.length = 0;
    for (const b of plan.colliders) {
      scaledColliders.push(new THREE.Box3(b.min.clone().multiplyScalar(cubitVal), b.max.clone().multiplyScalar(cubitVal)));
    }
    scaledPlatforms.length = 0;
    for (const p of plan.platforms) {
      scaledPlatforms.push(new THREE.Box3(p.min.clone().multiplyScalar(cubitVal), p.max.clone().multiplyScalar(cubitVal)));
    }
    unitGroup.scale.setScalar(cubitVal);
    altarLight.distance = 38 * cubitVal;
    hekhalLight.distance = 34 * cubitVal;
  };
  syncScale(currentCubit);

  const result: NehemiahCity = {
    group: root,
    colliders: scaledColliders,
    platforms: scaledPlatforms,
    counts,
    plan,
    CUBIT: currentCubit,
    MAX_WALL_Y: (plan.maxWallTop + 6) * currentCubit,
    floorY(x: number, z: number): number {
      return plan.groundC(x / result.CUBIT, z / result.CUBIT) * result.CUBIT;
    },
    rescale(newCubit: number): number {
      const clamped = Math.max(0.4, Math.min(0.6, newCubit));
      currentCubit = clamped;
      result.CUBIT = clamped;
      result.MAX_WALL_Y = (plan.maxWallTop + 6) * clamped;
      syncScale(clamped);
      return clamped;
    },
    update(dt: number, elapsed: number): void {
      tex.waterAlbedo.offset.x -= dt * 0.28;
      tex.waterNormal.offset.x -= dt * 0.42;
      tex.waterNormal.offset.y += Math.sin(elapsed * 0.8) * dt * 0.03;

      tex.emberMat.emissiveIntensity = 1.25 + Math.sin(elapsed * 3.2) * 0.24;
      altarLight.intensity = 15 + Math.sin(elapsed * 3.8) * 2.5;

      for (const fl of flames) {
        const s = 0.88 + Math.sin(elapsed * 8.5 + fl.phase) * 0.14;
        fl.mesh.scale.set(s, 0.9 + Math.cos(elapsed * 10.2 + fl.phase) * 0.16, s);
      }

      for (const p of smokePuffs) {
        const cyc = (elapsed * 0.26 + p.phase) % 1;
        p.sprite.position.y = p.baseY + cyc * 9.5;
        const m = p.sprite.material as THREE.SpriteMaterial;
        m.opacity = Math.sin(cyc * Math.PI) * 0.3;
        const sc = 3.2 + cyc * 3.8;
        p.sprite.scale.set(sc, sc, 1);
      }
    },
  };

  return result;
}
