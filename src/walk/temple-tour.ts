import type { Stop } from './tour.ts';

// A guided walk for Solomon's temple. Stops are in cubits, matching
// temple.ts: the house runs x −30…+30 with the porch to +40, the most holy
// place is the rear 20 cubits, Jachin and Boaz stand east of the porch at
// x=44, the bronze altar sits further east at x≈52, the molten sea is
// south of the house, the court wall encloses x ±72 / z ±38.
//
// Every exterior stop stands INSIDE the court. A camera outside the wall
// looks at ashlar, not at the temple.
//
// Facing is derived from the stop's own `at` target — never hand-written.

// Landmarks in cubits, matching buildTemple's placement.
const DOOR = { x: 30, z: 0 };
const SEA = { x: 42, z: -24 };
const ALTAR = { x: 60, z: 0 };
const LAMP = { x: 14, z: -5.5 };
const TABLE = { x: 14, z: 5.5 };
const INCENSE = { x: -7.5, z: 0 };
const VEIL = { x: -10, z: 0 };
const CHAMBERS = { x: -10, z: 16 };

export const TEMPLE_TOUR: Stop[] = [
  // North of the altar, looking back at the house: porch, pillars, side
  // chambers together. Exterior stops stay outside the chamber band |z|≥18.
  { x: 55, z: 22, at: { x: 32, z: 0 }, pitch: 0.08, travel: 0, dwell: 4.5,
    zh: '院内东望 · 廊与铜柱在殿前',
    en: 'In the court, looking east — the porch and the pillars stand before the house',
    ref: '王上 6:3、7:21；代下 3:1 · 1 Kgs 6:3, 7:21; 2 Chr 3:1' },
  { x: 48, z: 20, at: { x: 44, z: 5.5 }, atY: 9, travel: 5.5, dwell: 6,
    zh: '雅斤与波阿斯 · 铜柱十八肘，柱顶五肘',
    en: 'Jachin and Boaz — eighteen cubits of bronze, capitals five',
    ref: '王上 7:15、7:19、7:21 · 1 Kgs 7:15, 7:19, 7:21' },
  { x: 48, z: 18, at: ALTAR, atY: 5, travel: 4, dwell: 5,
    zh: '铜坛 · 二十肘见方，高十肘',
    en: 'The bronze altar — twenty cubits square, ten high',
    ref: '代下 4:1 · 2 Chr 4:1' },
  // South of the house, clear of the chambers and of the sea rim.
  { x: 55, z: -20, at: SEA, atY: 3.5, travel: 5, dwell: 7,
    zh: '铜海 · 十肘径，五肘高，十二只铜牛',
    en: 'The molten sea — ten across, five high, twelve bronze oxen',
    ref: '王上 7:23–26 · 1 Kgs 7:23–26' },
  // Between the pillars, looking west at the olive-wood doors.
  { x: 44, z: 0, at: DOOR, atY: 6, travel: 4.5, dwell: 5,
    zh: '廊前 · 橄榄木门，金子包裹',
    en: 'Before the porch — olive-wood doors overlaid with gold',
    ref: '王上 6:31–34 · 1 Kgs 6:31–34' },
  { x: 4, z: -7, at: LAMP, atY: 1.7, travel: 7, dwell: 6,
    zh: '圣所南面 · 金灯台',
    en: 'The south side — the lampstand',
    ref: '王上 7:48；出 25:31 · 1 Kgs 7:48; Ex 25:31' },
  { x: 4, z: 7, at: TABLE, atY: 1.5, travel: 4, dwell: 5,
    zh: '圣所北面 · 陈设饼的桌子',
    en: 'The north side — the table of the Presence',
    ref: '王上 7:48；出 25:23 · 1 Kgs 7:48; Ex 25:23' },
  { x: -2, z: 4, at: INCENSE, atY: 2, travel: 5, dwell: 5,
    zh: '金坛 · 在幔子前',
    en: 'The altar of gold — before the veil',
    ref: '王上 6:22 · 1 Kgs 6:22' },
  { x: -3, z: 2.5, at: VEIL, atY: 8, travel: 3.5, dwell: 5,
    zh: '幔子之前 · 蓝色、紫色、朱红线和细麻',
    en: 'Before the veil — blue, purple, crimson, fine linen',
    ref: '代下 3:14 · 2 Chr 3:14' },
  // Past the veil. Educational cut. Stand near the east wall of the oracle
  // looking west at the pair: each is ten cubits, wings spanning the width.
  { x: -11.5, z: 0, at: { x: -20, z: 0 }, atY: 5, travel: 0.8, dwell: 10, cut: true,
    zh: '至圣所 · 基路伯高十肘，翅膀共二十肘',
    en: 'The most holy place — cherubim ten cubits, wings twenty',
    ref: '王上 6:23–28 · 1 Kgs 6:23–28' },
  { x: 20, z: 24, at: CHAMBERS, atY: 8, travel: 6, dwell: 5,
    zh: '旁屋 · 三层，下五中六上七',
    en: 'The side chambers — three storeys: five, six, seven',
    ref: '王上 6:5–10 · 1 Kgs 6:5–10' },
];
