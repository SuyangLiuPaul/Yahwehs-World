import type { Stop } from './tour.ts';

// A guided walk for Solomon's temple. Stops are in cubits, matching
// temple.ts: the house runs x −30…+30 with the porch to +41, the most holy
// place is the rear 20 cubits, Jachin and Boaz stand east of the porch at
// x=44, the bronze altar sits further east at x=61, the molten sea is
// south of the house, the court wall encloses x ±72 / z ±38, the house
// stands 30 cubits to the cornice and the roof of the side chambers is at 15.
//
// Facing is derived from the stop's own `at` target — never hand-written.
//
// Paths are not straight lines. The first version flew stop-to-stop, and a
// straight line from the altar to the sea goes through the altar; from the
// sea to the porch, through a pillar; from the oracle to the side chambers,
// through the house. `via` waypoints route each leg round what is solid,
// and scripts/audit-tour.mjs samples every leg against the walk's own
// colliders at the height the eye is actually at.
//
// And the eye is no longer always at 1.65 m. Every stop stood at a person's
// height, so a visitor was walked round a building 30 cubits tall and never
// saw it: no view of the whole enclosure, and no sight of a roof at all.
// The owner said exactly that. The walk now begins below the mount and rises
// over it, and three more stops stand above head height — the whole precinct,
// the roof from the south, and a closing pass from the west. The Evidence
// dialog says plainly that nobody ever stood in any of them.
//
// Pacing: 109 s at first, 64 s after the last pass, ~88 s now that it begins
// in the valley. Every stop can be revisited from the list at any length.

// Landmarks in cubits, matching buildTemple's placement.
const HOUSE = { x: 0, z: 0 };
const DOOR = { x: 30, z: 0 };
const SEA = { x: 42, z: -24 };
const ALTAR = { x: 61, z: 0 };
const LAMP = { x: -3, z: -7.2 };
const TABLE = { x: 13, z: 7.6 };
const INCENSE = { x: -7.4, z: 0 };
const VEIL = { x: -10, z: 0 };
const ROOF = { x: -4, z: -10 };

export const TEMPLE_TOUR: Stop[] = [
  // From the valley, looking up. 2 Chr 3:1 puts the house on Mount Moriah and
  // the psalms speak of going UP to it; the walk now begins where a person
  // coming to it would have begun, below it.
  { x: 150, z: -230, y: -50, at: HOUSE, atY: 22, travel: 0, dwell: 4,
    zh: '从山下望 · 殿建在摩利亚山上',
    en: 'From below — the house stands on Mount Moriah',
    ref: '代下 3:1；诗 24:3 · 2 Chr 3:1; Ps 24:3' },
  // Up and over the shoulder of the mount: the whole precinct at once, the
  // house, its three storeys of chambers, the court, the altar and the sea.
  { x: 170, z: 112, y: 62, at: HOUSE, atY: 4, travel: 5, dwell: 4,
    via: [{ x: 235, z: -150 }, { x: 235, z: 30 }],
    zh: '全景 · 殿、旁屋、院子、铜坛与铜海',
    en: 'The whole house — chambers, court, altar and sea in one view',
    ref: '王上 6:1–3；代下 3:1 · 1 Kgs 6:1–3; 2 Chr 3:1' },
  // Down into the court, on the ground, where a person would have stood.
  { x: 64, z: 27, at: { x: 34, z: 0 }, atY: 14, travel: 4.5, dwell: 2.5,
    zh: '下到院内 · 廊与铜柱在殿前',
    en: 'Down into the court — the porch and the pillars before the house',
    ref: '王上 6:3、7:21 · 1 Kgs 6:3, 7:21' },
  { x: 49, z: 17, at: { x: 44, z: 5.5 }, atY: 15, travel: 3, dwell: 3,
    zh: '雅斤与波阿斯 · 铜柱十八肘，柱顶五肘',
    en: 'Jachin and Boaz — eighteen cubits of bronze, capitals five',
    ref: '王上 7:15、7:19、7:21 · 1 Kgs 7:15, 7:19, 7:21' },
  { x: 48, z: 18, at: ALTAR, atY: 5, travel: 2, dwell: 3,
    zh: '铜坛 · 二十肘见方，高十肘，南面有坡道可以上去',
    en: 'The bronze altar — twenty cubits square, ten high, its ramp walkable',
    ref: '代下 4:1；出 20:26 · 2 Chr 4:1; Ex 20:26' },
  // South of the house, clear of the chambers and of the sea rim. The way
  // there runs down the lane between the pillars (x ≤ 46.9) and the altar
  // (x ≥ 49.7) rather than across the altar.
  { x: 55, z: -20, at: SEA, atY: 3.5, travel: 4, dwell: 3,
    via: [{ x: 49.5, z: 12 }, { x: 49.5, z: -12 }],
    zh: '铜海 · 十肘径，五肘高，十二只铜牛',
    en: 'The molten sea — ten across, five high, twelve bronze oxen',
    ref: '王上 7:23–26 · 1 Kgs 7:23–26' },
  // Back up the same lane and in along the axis, between the pillars.
  { x: 44, z: 0, at: DOOR, atY: 6, travel: 3.5, dwell: 3,
    via: [{ x: 49.5, z: -12 }, { x: 49.5, z: 0 }],
    zh: '廊前 · 橄榄木门，金子包裹',
    en: 'Before the porch — olive-wood doors overlaid with gold',
    ref: '王上 6:31–34 · 1 Kgs 6:31–34' },
  // Through the open doors on the axis and down the middle of the house,
  // the carved gold on both sides, to the five lampstands on the south.
  { x: 6, z: -2.5, at: LAMP, atY: 1.7, travel: 5, dwell: 3,
    via: [{ x: 34, z: 0 }, { x: 26, z: 0 }, { x: 12, z: 0 }],
    zh: '圣所南面 · 五个金灯台',
    en: 'The south side — five lampstands of gold',
    ref: '王上 7:49；代下 4:7 · 1 Kgs 7:49; 2 Chr 4:7' },
  { x: 8, z: 2.5, at: TABLE, atY: 1.5, travel: 2, dwell: 2.5,
    zh: '圣所北面 · 五张桌子，陈设饼在其上',
    en: 'The north side — five tables, the bread of the Presence on one',
    ref: '代下 4:8；王上 7:48 · 2 Chr 4:8; 1 Kgs 7:48' },
  { x: -3, z: 3.5, at: INCENSE, atY: 2, travel: 2.5, dwell: 2.5,
    zh: '金坛 · 在内殿门前',
    en: 'The altar of gold — before the oracle',
    ref: '王上 6:20–22、7:48 · 1 Kgs 6:20–22, 7:48' },
  // Close enough to the cloth to read it: blue, purple, crimson and fine
  // linen with cherubim worked in it (2 Chr 3:14), hung in a four-cubit
  // doorway behind two open leaves of olive wood.
  { x: -5.5, z: 1.4, at: VEIL, atY: 5, travel: 2.5, dwell: 4,
    zh: '内殿的门与幔子 · 蓝色紫色朱红色细麻，绣着基路伯',
    en: 'The oracle door and the veil — blue, purple, crimson, cherubim worked in it',
    ref: '王上 6:21、6:31；代下 3:14 · 1 Kgs 6:21, 6:31; 2 Chr 3:14' },
  // Through the veil. The crossing keeps moving and the screen fills with
  // the cloth itself: an educational view, and it should feel like passing
  // through a curtain, because that is what it is.
  { x: -12.5, z: 0, at: { x: -22, z: 0 }, atY: 5, travel: 2.2, dwell: 4.5,
    cut: true, through: 'veil',
    zh: '过了幔子 · 基路伯高十肘，翅膀共二十肘，约柜在翅膀底下',
    en: 'Through the veil — cherubim ten cubits, wings twenty, the ark beneath',
    ref: '王上 6:23–28、8:6 · 1 Kgs 6:23–28, 8:6' },
  // Out again, and up: the south side from above — the cedar roof, the three
  // storeys of chambers stepping outward below it, and the stair well open in
  // the terrace with the winding stair inside it. South, because that is the
  // side 6:8 puts the door on, and because the sun is there.
  { x: 34, z: -80, y: 54, at: ROOF, atY: 16, travel: 1.2, dwell: 4, cut: true,
    zh: '屋顶 · 香柏木；旁屋三层，下五中六上七，旋转楼梯通到上面',
    en: 'The roof of cedar — three storeys of chambers below it, the winding stair coming out on top',
    ref: '王上 6:5–10、6:9 · 1 Kgs 6:5–10, 6:9' },
  // And round to the west, where the oracle end stands: the last frame is
  // the building whole again, from the side the tour never walked.
  { x: -72, z: 46, y: 32, at: HOUSE, atY: 12, travel: 4.5, dwell: 3.5,
    zh: '从西面看 · 至圣所在这一头，殿高三十肘',
    en: 'From the west — the oracle end, the house thirty cubits to the cornice',
    ref: '王上 6:2、6:16–20 · 1 Kgs 6:2, 6:16–20' },
];
