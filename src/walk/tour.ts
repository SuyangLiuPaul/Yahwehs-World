import * as THREE from 'three';

// A guided walk for anyone who does not want to drive.
//
// The tabernacle is a sequence — outside, court, altar, door, holy place, veil
// — and the passage moves through it in that order. Handing a visitor WASD and
// a linen maze asks them to discover the sequence for themselves; most will
// look at a gold wall and leave. The tour walks it for them, and any input at
// all hands control straight back.

export interface Stop {
  /** Position in cubits, so the numbers read against the passage. */
  x: number; z: number;
  /** What to look at, also in cubits. Facing is derived from it rather than
   *  written by hand: hand-written yaw offsets put three of the eight stops
   *  face-first into a wall, because the sign and the magnitude both have to
   *  be right and neither is obvious from reading the number. */
  at: { x: number; z: number };
  /** Eye height of the thing being looked at, in cubits, for the pitch. */
  atY?: number;
  /** Fixed inclination, for stops that look at nothing in particular. */
  pitch?: number;
  /** Seconds to travel here, then seconds to stand still. */
  travel: number; dwell: number;
  /** Educational cut past a restricted barrier; never fly through a curtain. */
  cut?: boolean;
  zh: string; en: string; ref: string;
}

// The furnishings, in cubits, matching where tabernacle.ts places them: the
// tent runs x −35..−5, the veil stands at −15, the lampstand sits south of the
// centre line and the table opposite it (26:35), the incense altar before the
// veil (30:6).
const ALTAR = { x: 28, z: 0 };
const DOOR = { x: -5, z: 0 };
const LAMP = { x: -15, z: -3 };
const TABLE = { x: -15, z: 3 };
const INCENSE = { x: -22.8, z: 0 };
const VEIL = { x: -25, z: 0 };
const ARK = { x: -30, z: 0 };

// Stand back far enough to see the thing WITH the room around it. Standing on
// top of an object fills a phone screen with one texture, which is how a
// guided walk turns into a tour of walls.
export const TOUR: Stop[] = [
  { x: 74, z: 0, at: { x: 50, z: 0 }, pitch: 0.02, travel: 0, dwell: 3.5,
    zh: '院门之外', en: 'Outside the gate',
    ref: '出 27:16 · Ex 27:16' },
  { x: 42, z: 0, at: { x: -5, z: 0 }, pitch: 0.0, travel: 5, dwell: 3,
    zh: '进了门帘，院内', en: 'Through the screen, into the court',
    ref: '出 27:18 · Ex 27:18' },
  { x: 36, z: 7, at: ALTAR, atY: 1.6, travel: 4.5, dwell: 6,
    zh: '铜坛 · 五肘见方，四角有角', en: 'The bronze altar — five cubits square, horned',
    ref: '出 27:1–2 · Ex 27:1–2' },
  // Far enough back that the tent reads as a building rather than as a
  // rectangle of cloth: at seven metres a four-metre screen fills a portrait
  // phone completely, which is a tour of a wall.
  { x: 21, z: 5, at: {x:14,z:0}, atY:1.6, travel:5,dwell:6,
    zh:'洗濯盆 · 铜盆与铜座，尺寸未记载',en:'The bronze basin — its dimensions are not recorded',
    ref:'出 30:18、38:8 · Ex 30:18, 38:8'},
  { x: 18, z: 4, at: DOOR, atY: 5, travel: 5.5, dwell: 5,
    zh: '帐幕门口 · 五根柱子与门帘', en: 'The door of the tent — five pillars and its screen',
    ref: '出 26:36–37 · Ex 26:36–37' },
  { x: -9, z: 1.2, at: LAMP, atY: 1.7, travel: 7, dwell: 7,
    zh: '圣所南面 · 金灯台', en: 'The south side — the lampstand',
    ref: '出 25:31、26:35 · Ex 25:31, 26:35' },
  { x: -11, z: -2.6, at: TABLE, atY: 1.5, travel: 5, dwell: 6,
    zh: '圣所北面 · 陈设饼的桌子', en: 'The north side — the table of the Presence',
    ref: '出 25:23、26:35 · Ex 25:23, 26:35' },
  { x: -18, z: 2.8, at: INCENSE, atY: 2, travel: 6, dwell: 6,
    zh: '香坛 · 一肘见方，高二肘', en: 'The altar of incense — a cubit square, two high',
    ref: '出 30:1–6 · Ex 30:1–6' },
  { x: -13, z: 1.5, at: VEIL, atY: 5, travel: 4, dwell: 6,
    zh: '幔子之前 · 里面是至圣所', en: 'Before the veil — beyond it, the most holy place',
    ref: '出 26:31–33 · Ex 26:31–33' },
  // Past the veil. The text admits one man, once a year (Leviticus 16); the
  // walk goes where he went, because leaving the visitor outside the only room
  // the whole building exists for is a tour that ends before its subject.
  { x: -26.2, z: 3.4, at: ARK, atY: 1.35, travel: .8, dwell: 9, cut:true,
    zh: '至圣所 · 约柜（教学剖视，非自由进出）', en: 'The ark — an educational view beyond the veil',
    ref: '出 25:10–22；利 16:2 · Ex 25:10–22; Lev 16:2' },
];

/** Yaw that points the camera from a stop toward what it is meant to see.
 *  Rotating the camera's own −Z by θ about Y gives (−sinθ, 0, −cosθ), so the
 *  bearing is atan2 of the difference — derived, never guessed. */
function facing(s: Stop): number {
  return Math.atan2(-(s.at.x - s.x), -(s.at.z - s.z));
}

/** Downward angle to the thing's own height, so a low object is looked at
 *  rather than over. */
function inclination(s: Stop, cubit: number): number {
  if (s.atY === undefined) return s.pitch ?? 0;
  const EYE = 1.65;
  const dist = Math.hypot(s.at.x - s.x, s.at.z - s.z) * cubit;
  if (dist < 0.1) return 0;
  return Math.atan2(s.atY * cubit - EYE, dist);
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** Shortest way round for an angle, so a turn never takes the long path. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Tour {
  private index = -1;
  private phase: 'travel' | 'dwell' = 'dwell';
  private t = 0;
  private from = { x: 0, z: 0, yaw: 0, pitch: 0 };
  running = false;
  paused=false;
  /** The stop list this tour walks. Defaults to the tabernacle's; the temple
   *  passes its own so both pages share one Tour implementation. */
  private stops: readonly Stop[];

  constructor(private readonly cubit: number, stops: readonly Stop[] = TOUR) {
    this.stops = stops;
  }

  onStop?: (s: Stop, index: number, total: number) => void;
  onEnd?: () => void;

  start(current: { x: number; z: number; yaw: number; pitch: number }, stops?: readonly Stop[]) {
    if (stops) this.stops = stops;
    this.from = { ...current };
    this.index = 0;
    this.phase = this.stops[0]!.travel > 0 ? 'travel' : 'dwell';
    this.t = 0;
    this.running = true;
    this.paused=false;
    this.onStop?.(this.stops[0]!, 0, this.stops.length);
  }

  stop() { this.running = false; this.paused=false; }
  pause(){this.running=false;this.paused=true;}
  resume(){if(this.paused){this.running=true;this.paused=false;}}
  get fade(){const s=this.stops[this.index];return s?.cut&&this.phase==='travel'?Math.sin(Math.PI*Math.min(1,this.t/s.travel)):0;}
  goTo(index:number){
    this.index=THREE.MathUtils.clamp(index,0,this.stops.length-1);
    const s=this.stops[this.index]!;this.phase='dwell';this.t=0;
    this.onStop?.(s,this.index,this.stops.length);
    return {x:s.x*this.cubit,z:s.z*this.cubit,yaw:facing(s),pitch:inclination(s,this.cubit)};
  }

  /** Returns where the camera should be this frame, or null when not running. */
  update(dt: number): { x: number; z: number; yaw: number; pitch: number } | null {
    if (!this.running) return null;
    const s = this.stops[this.index];
    if (!s) { this.running = false; this.onEnd?.(); return null; }

    const target = {
      x: s.x * this.cubit, z: s.z * this.cubit,
      yaw: facing(s), pitch: inclination(s, this.cubit),
    };
    this.t += dt;

    if (this.phase === 'travel') {
      const k = easeInOut(Math.min(1, this.t / s.travel));
      if(s.cut){
        const out=this.t<s.travel/2?this.from:target;
        if(this.t>=s.travel){this.phase='dwell';this.t=0;}
        return {...out};
      }
      const yawDelta = wrap(target.yaw - this.from.yaw);
      const out = {
        x: THREE.MathUtils.lerp(this.from.x, target.x, k),
        z: THREE.MathUtils.lerp(this.from.z, target.z, k),
        yaw: this.from.yaw + yawDelta * k,
        pitch: THREE.MathUtils.lerp(this.from.pitch, target.pitch, k),
      };
      if (this.t >= s.travel) { this.phase = 'dwell'; this.t = 0; }
      return out;
    }

    if (this.t >= s.dwell) {
      this.from = { x: target.x, z: target.z, yaw: target.yaw, pitch: target.pitch };
      this.index++;
      const next = this.stops[this.index];
      if (!next) { this.running = false; this.onEnd?.(); return target; }
      this.phase = next.travel > 0 ? 'travel' : 'dwell';
      this.t = 0;
      this.onStop?.(next, this.index, this.stops.length);
    }
    return target;
  }

  get currentIndex() { return this.index; }
}
