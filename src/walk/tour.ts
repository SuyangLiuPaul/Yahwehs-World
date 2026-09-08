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
  /** Facing, radians. +PI/2 looks west, along the building's axis. */
  yaw: number;
  pitch: number;
  /** Seconds to travel here, then seconds to stand still. */
  travel: number; dwell: number;
  zh: string; en: string; ref: string;
}

export const TOUR: Stop[] = [
  { x: 72, z: 0, yaw: Math.PI / 2, pitch: 0.02, travel: 0, dwell: 3.5,
    zh: '院门之外', en: 'Outside the gate',
    ref: '出 27:16 · Ex 27:16' },
  { x: 44, z: 0, yaw: Math.PI / 2, pitch: 0.0, travel: 5, dwell: 3,
    zh: '进了门帘，院内', en: 'Through the screen, into the court',
    ref: '出 27:18 · Ex 27:18' },
  { x: 33, z: 7.5, yaw: Math.PI / 2 + 0.75, pitch: -0.05, travel: 4.5, dwell: 4,
    zh: '铜坛 · 五肘见方，四角有角', en: 'The bronze altar — five cubits square, horned',
    ref: '出 27:1–2 · Ex 27:1–2' },
  { x: 6, z: 0, yaw: Math.PI / 2, pitch: 0.06, travel: 5.5, dwell: 3.5,
    zh: '帐幕门口 · 五根柱子', en: 'The door of the tent — five pillars',
    ref: '出 26:36–37 · Ex 26:36–37' },
  { x: -6, z: -1.2, yaw: Math.PI / 2 - 1.15, pitch: -0.02, travel: 5, dwell: 4.5,
    zh: '圣所南面 · 金灯台', en: 'The south side — the lampstand',
    ref: '出 25:31、26:35 · Ex 25:31, 26:35' },
  { x: -6, z: 1.2, yaw: Math.PI / 2 + 1.15, pitch: -0.02, travel: 3.5, dwell: 4,
    zh: '圣所北面 · 陈设饼的桌子', en: 'The north side — the table of the Presence',
    ref: '出 25:23、26:35 · Ex 25:23, 26:35' },
  { x: -11, z: 0, yaw: Math.PI / 2, pitch: 0.0, travel: 3.5, dwell: 4,
    zh: '香坛 · 一肘见方，高二肘', en: 'The altar of incense — a cubit square, two high',
    ref: '出 30:1–6 · Ex 30:1–6' },
  { x: -14, z: 0, yaw: Math.PI / 2, pitch: 0.03, travel: 3, dwell: 5,
    zh: '幔子之前 · 里面是至圣所', en: 'Before the veil — beyond it, the most holy place',
    ref: '出 26:31–33 · Ex 26:31–33' },
];

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** Shortest way round for an angle, so a turn never takes the long path. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Tour {
  private index = -1;
  private phase: 'travel' | 'dwell' = 'dwell';
  private t = 0;
  private from = { x: 0, z: 0, yaw: 0, pitch: 0 };
  running = false;

  constructor(private readonly cubit: number) {}

  onStop?: (s: Stop, index: number, total: number) => void;
  onEnd?: () => void;

  start(current: { x: number; z: number; yaw: number; pitch: number }) {
    this.from = { ...current };
    this.index = 0;
    this.phase = TOUR[0]!.travel > 0 ? 'travel' : 'dwell';
    this.t = 0;
    this.running = true;
    this.onStop?.(TOUR[0]!, 0, TOUR.length);
  }

  stop() { this.running = false; }

  /** Returns where the camera should be this frame, or null when not running. */
  update(dt: number): { x: number; z: number; yaw: number; pitch: number } | null {
    if (!this.running) return null;
    const s = TOUR[this.index];
    if (!s) { this.running = false; this.onEnd?.(); return null; }

    const target = { x: s.x * this.cubit, z: s.z * this.cubit, yaw: s.yaw, pitch: s.pitch };
    this.t += dt;

    if (this.phase === 'travel') {
      const k = easeInOut(Math.min(1, this.t / s.travel));
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
      const next = TOUR[this.index];
      if (!next) { this.running = false; this.onEnd?.(); return target; }
      this.phase = next.travel > 0 ? 'travel' : 'dwell';
      this.t = 0;
      this.onStop?.(next, this.index, TOUR.length);
    }
    return target;
  }

  get currentIndex() { return this.index; }
}
