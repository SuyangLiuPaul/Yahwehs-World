import type { Stop } from './tour.ts';

// A guided walk through the ark. Stops are in cubits, matching ark.ts: the
// hull runs x −150…+150, z −25…+25, the decks are at 0, 10 and 20, the door
// is in the south side amidships, and the light opening of 6:16 runs under
// the eaves on both sides.
//
// Eye heights are absolute, so a stop on the second deck stands at 10 + 3.7.
//
// The walk begins outside, because three hundred cubits is the whole point
// and it cannot be seen from within.
const ARK = { x: 0, z: 0 };
const EYE = 3.7;          // 1.65 m in cubits

export const ARK_TOUR: Stop[] = [
  { x: -250, z: -210, y: 66, at: ARK, atY: 14, travel: 0, dwell: 4.5,
    zh: '三百肘长、五十肘宽、三十肘高',
    en: 'Three hundred cubits long, fifty broad, thirty high',
    ref: '创 6:15 · Gen 6:15' },
  // On the ground beside it, where the numbers stop being numbers.
  { x: -96, z: -64, y: EYE, at: { x: -40, z: -25 }, atY: 26, travel: 4.5, dwell: 3.5,
    zh: '站在船边 · 一百三十四米长，比一个足球场还长',
    en: 'Beside the hull — 134 metres, longer than a football pitch',
    ref: '创 6:15 · Gen 6:15' },
  { x: 0, z: -62, y: EYE, at: { x: 0, z: -25 }, atY: 8, travel: 4, dwell: 3,
    via: [{ x: -40, z: -60 }],
    zh: '门开在旁边 · 门的大小经文没有记',
    en: 'The door in the side — its size is not given',
    ref: '创 6:16 · Gen 6:16' },
  // In at the door, onto the lowest deck.
  { x: 0, z: -14, y: 8 + EYE - 4, at: { x: 120, z: 0 }, atY: 8, travel: 4, dwell: 3,
    zh: '进到舱里 · 里外抹上松香',
    en: 'Inside — pitched within and without',
    ref: '创 6:14 · Gen 6:14' },
  { x: -90, z: 0, y: EYE, at: { x: 140, z: 0 }, atY: EYE, travel: 4.5, dwell: 3.5,
    via: [{ x: 0, z: -4 }, { x: -40, z: 0 }],
    zh: '下层 · 三百肘的甬道',
    en: 'The lower deck — three hundred cubits of gangway',
    ref: '创 6:16 · Gen 6:16' },
  // Standing in the gangway, looking into the rooms: seven males and seven
  // females of one clean kind (7:2), which is a number and not a species.
  { x: -104, z: -3, y: EYE, at: { x: -100, z: 14 }, atY: 2.6, travel: 4, dwell: 4,
    via: [{ x: -96, z: 0 }],
    zh: '一间一间地造 · 洁净的畜类七公七母',
    en: 'Rooms, one and another — of a clean kind, seven males and seven females',
    ref: '创 6:14、7:2 · Gen 6:14, 7:2' },
  // Up the forward ramp to the second deck.
  { x: 122, z: 0, y: 10 + EYE, at: { x: 40, z: 0 }, atY: 10 + EYE, travel: 5, dwell: 2.5,
    via: [{ x: 60, z: 0 }, { x: 118, z: 0 }],
    zh: '上到中层 · 怎么上去经文没有说',
    en: 'Up to the second deck — how the decks were reached is not said',
    ref: '创 6:16 · Gen 6:16' },
  { x: 70, z: 0, y: 10 + EYE, at: { x: -150, z: 0 }, atY: 10 + EYE, travel: 4, dwell: 3.5,
    zh: '中层 · 上、中、下三层',
    en: 'The second deck — lower, second and third',
    ref: '创 6:16 · Gen 6:16' },
  // The eight, amidships on the second deck.
  { x: -18, z: 0, y: 10 + EYE, at: { x: 0, z: 0 }, atY: 10 + 3, travel: 5, dwell: 3.5,
    via: [{ x: 20, z: 0 }],
    zh: '八个人 · 挪亚、他的妻子、三个儿子和三个儿妇',
    en: 'Eight people — Noah, his wife, his three sons and their three wives',
    ref: '创 7:13；彼前 3:20 · Gen 7:13; 1 Pet 3:20' },
  // …and the aft ramp to the third.
  { x: -122, z: 0, y: 20 + EYE, at: { x: -40, z: 0 }, atY: 20 + EYE, travel: 5.5, dwell: 2.5,
    via: [{ x: -60, z: 0 }, { x: -118, z: 0 }],
    zh: '上到上层',
    en: 'Up to the third deck',
    ref: '创 6:16 · Gen 6:16' },
  { x: -20, z: 6, y: 20 + EYE, at: { x: -20, z: -25 }, atY: 27, travel: 4.5, dwell: 3.5,
    zh: '透光处 · 高一肘，开在上边',
    en: 'The light opening — a cubit high, under the eaves',
    ref: '创 6:16 · Gen 6:16' },
  // Out through it, to the daylight.
  { x: -20, z: -19, y: 27, at: { x: -20, z: -260 }, atY: 10, travel: 3, dwell: 3.5,
    zh: '从透光处往外看',
    en: 'Looking out through it',
    ref: '创 6:16、8:6 · Gen 6:16, 8:6' },
  // And the whole of it from above, where the covering is (8:13).
  { x: -150, z: -120, y: 74, at: { x: 40, z: 0 }, atY: 28, travel: 5, dwell: 4, cut: true,
    zh: '从上面看 · 方舟的盖（创 8:13 可以撤去）',
    en: 'From above — the covering, which came off (Gen 8:13)',
    ref: '创 6:16、8:13 · Gen 6:16, 8:13' },
];
