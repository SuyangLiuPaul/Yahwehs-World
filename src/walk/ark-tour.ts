import type { Stop } from './tour.ts';

// Guided architectural walkthrough of Noah's ark.
// Coordinates are in cubits (matching ark.ts):
//   hull: x in [-150, +150], z in [-25, +25]
//   decks: y = 0.5 (lower), 10.5 (second), 20.5 (third)
//   door: south side amidships (x = 0, z = -24.5)
//   tsohar: 1-cubit continuous light opening under eaves (y = 26.6..27.6)

const ARK = { x: 0, z: 0 };
const EYE = 3.7; // 1.65 m human eye height in cubits

export const ARK_TOUR: Stop[] = [
  {
    x: -245, z: -205, y: 66, at: ARK, atY: 14, travel: 0, dwell: 4.5,
    zh: '三百肘长、五十肘宽、三十肘高',
    en: 'Three hundred cubits long, fifty broad, thirty high',
    ref: '创 6:15 · Gen 6:15',
  },
  {
    x: -96, z: -64, y: 1.1, at: { x: -40, z: -25 }, atY: 22, travel: 4.5, dwell: 3.5,
    zh: '站在船边 · 一百三十四米长，比一个足球场还长',
    en: 'Beside the pitched hull — 134 metres, longer than a football pitch',
    ref: '创 6:15 · Gen 6:15',
  },
  {
    x: 0, z: -62, y: 1.1, at: { x: 0, z: -25 }, atY: 6.5, travel: 4, dwell: 3,
    via: [{ x: -42, z: -62 }],
    zh: '门开在旁边 · 门的大小经文没有记',
    en: 'The door in the side — standing open before 7:16',
    ref: '创 6:16、7:16 · Gen 6:16, 7:16',
  },
  {
    x: 0, z: -12, y: 0.5 + EYE, at: { x: 110, z: 0 }, atY: 5.5, travel: 4.2, dwell: 3,
    via: [{ x: 0, z: -39.5 }, { x: 0, z: -24.5 }],
    zh: '进到舱里 · 里外抹上松香',
    en: 'Inside — pitched within and without, timber ribs and braces overhead',
    ref: '创 6:14 · Gen 6:14',
  },
  {
    x: -94, z: 0, y: 0.5 + EYE, at: { x: 130, z: 0 }, atY: 4.5, travel: 4.5, dwell: 3.5,
    via: [{ x: 0, z: 0 }],
    zh: '下层 · 三百肘的中央通道',
    en: 'The lower deck — three hundred cubits of colonnaded nave',
    ref: '创 6:16 · Gen 6:16',
  },
  {
    x: -102, z: -2, y: 0.5 + EYE, at: { x: -92, z: 14 }, atY: 2.5, travel: 2.8, dwell: 4,
    zh: '一间一间地造 · 洁净的畜类七公七母',
    en: 'Rooms, one and another — of a clean kind, seven males and seven females',
    ref: '创 6:14、7:2 · Gen 6:14, 7:2',
  },
  {
    x: -42, z: 1.5, y: 0.5 + EYE, at: { x: -34, z: -14 }, atY: 3.2, travel: 3.8, dwell: 3,
    via: [{ x: -68, z: 0 }],
    zh: '不洁净的畜类 · 一公一母',
    en: 'Of beasts not clean — one male and one female',
    ref: '创 7:2；利 11:4 · Gen 7:2; Lev 11:4',
  },
  {
    x: 143.5, z: 0, y: 0.5 + EYE, at: { x: 118, z: 0 }, atY: 13.5, travel: 5, dwell: 2,
    via: [{ x: 60, z: 0 }],
    zh: '前坡道 · 怎么上到各层经文没有说',
    en: 'At the forward ramp — how the decks were reached is not stated',
    ref: '创 6:16 · Gen 6:16',
  },
  {
    x: 116, z: 0, y: 10.5 + EYE, at: { x: 20, z: 0 }, atY: 14.2, travel: 4, dwell: 2.8,
    zh: '上到中层 · 上、中、下三层',
    en: 'Up to the second deck — lower, second and third storeys',
    ref: '创 6:16 · Gen 6:16',
  },
  {
    x: -18, z: 0, y: 10.5 + EYE, at: { x: 4, z: 0 }, atY: 13.5, travel: 4.8, dwell: 3.8,
    via: [{ x: 35, z: 0 }],
    zh: '八个人与储粮 · 挪亚夫妇与三子三媳',
    en: 'Eight people and stored provisions — Noah, his wife, three sons and their wives',
    ref: '创 6:21、7:13；彼前 3:20 · Gen 6:21, 7:13; 1 Pet 3:20',
  },
  {
    x: -143.5, z: 0, y: 10.5 + EYE, at: { x: -118, z: 0 }, atY: 23.5, travel: 4.8, dwell: 2,
    via: [{ x: -80, z: 0 }],
    zh: '后坡道 · 通往上层',
    en: 'The aft ramp climbing toward the third storey',
    ref: '创 6:16 · Gen 6:16',
  },
  {
    x: -116, z: 0, y: 20.5 + EYE, at: { x: -30, z: 0 }, atY: 24.2, travel: 4, dwell: 2.5,
    zh: '上到上层 · 桁架屋梁之下',
    en: 'On the third deck — beneath the king-post roof trusses',
    ref: '创 6:16 · Gen 6:16',
  },
  {
    x: -46, z: 3.5, y: 20.5 + EYE, at: { x: -34, z: -20 }, atY: 26.8, travel: 4.2, dwell: 3.8,
    via: [{ x: -75, z: 0 }],
    zh: '透光处与飞鸟 · 七公七母并乌鸦',
    en: 'The 1-cubit light opening — doves seven and seven, and the raven',
    ref: '创 6:16、7:3、8:7–8 · Gen 6:16, 7:3, 8:7–8',
  },
  {
    x: 26, z: -1.5, y: 20.5 + EYE, at: { x: 40, z: -10 }, atY: 29.0, travel: 3.8, dwell: 3.5,
    zh: '方舟的窗户 · 挪亚所开的窗',
    en: 'The window hatch opened in the covering',
    ref: '创 8:6 · Gen 8:6',
  },
  {
    x: -20, z: -19, y: 27.1, at: { x: -20, z: -260 }, atY: 12, travel: 3.4, dwell: 3.5,
    via: [{ x: 0, z: -12 }],
    zh: '从透光处往外望 · 群山与天际虹光',
    en: 'Looking out through the light opening toward the hills and horizon',
    ref: '创 6:16、9:13 · Gen 6:16, 9:13',
  },
  {
    x: -165, z: -125, y: 74, at: { x: 40, z: 0 }, atY: 24, travel: 5, dwell: 4.5, cut: true,
    zh: '从上面看 · 方舟的盖（创 8:13 可以撤去）',
    en: 'From above — the roof covering (Gen 8:13)',
    ref: '创 6:16、8:13 · Gen 6:16, 8:13',
  },
];
