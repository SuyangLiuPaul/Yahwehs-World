// The whole Bible, in the order it is read, cut into the units this app can
// actually present — and what each one has today.
//
// The owner asked for all 1,443 events to be presented the way the temple and
// the tabernacle are, with a menu that shows the whole plan and marks what is
// not built yet. 1,443 hand-built rooms is not a plan, it is a wish: the
// tabernacle took a month and the temple took two passes. What IS a plan is
// this — every event belongs to one unit of the story, every unit has a depth
// it has reached, and the page counts both from the data instead of claiming
// them.
//
// The depths, shallowest first:
//   verse   the passage, its summary and the basis for its date. Every event
//           has this; it is what the events track and menu already give.
//   map     the place, on the globe. Only where the text locates it.
//   route   a journey drawn across the terrain, stop by stop, each stop
//           citing the verse that puts it there.
//   measure a card built to the measurements the text states.
//   walk    a building you can walk into on your own feet.
//
// Units are contiguous BY CONSTRUCTION: each one starts at a verse and runs
// to the start of the next. So every event lands in exactly one unit and none
// can be quietly dropped — src/plan.ts counts them and says so on the page.

/** bbbcccvvv, the same key the events payload carries in `s` and `e`. */
const k = (book: number, chapter: number, verse: number) => book * 1e6 + chapter * 1e3 + verse;

export type Depth = 'verse' | 'map' | 'route' | 'measure' | 'walk';
export type Status = 'live' | 'building' | 'planned';

export interface Planned {
  depth: Depth;
  status: Status;
  zh: string;
  en: string;
}

export interface Unit {
  id: string;
  zh: string;
  en: string;
  /** First verse of the unit; it runs to the next unit\'s first verse. */
  from: number;
  /** Where this unit can be walked into today. */
  walk?: { href: string; zh: string; en: string };
  /** What is not built yet, and what it would be. */
  plan?: Planned[];
}

const wip = (depth: Depth, zh: string, en: string, status: Status = 'planned'): Planned =>
  ({ depth, status, zh, en });

export const UNITS: Unit[] = [
  { id: 'creation', zh: '创造', en: 'The creation', from: k(1, 1, 1),
    plan: [wip('walk', '伊甸园 · 经文给了四道河与树，没有给尺寸', 'Eden — the text gives four rivers and the trees, and no measurements')] },
  { id: 'fall', zh: '堕落与该隐的后裔', en: 'The fall, and Cain\'s line', from: k(1, 3, 1) },
  { id: 'flood', zh: '洪水与方舟', en: 'The flood and the ark', from: k(1, 6, 1),
    plan: [wip('walk', '走进挪亚方舟 · 三百乘五十乘三十肘，三层', 'Walk into Noah\'s ark — 300 × 50 × 30 cubits, three decks', 'planned')] },
  { id: 'babel', zh: '巴别与列国', en: 'Babel and the nations', from: k(1, 10, 1),
    plan: [wip('map', '列国分布图 · 创世记十章的名字落在何处', 'The table of nations, mapped where its names are identified')] },
  { id: 'abraham', zh: '亚伯拉罕', en: 'Abraham', from: k(1, 11, 27) },
  { id: 'isaac-jacob', zh: '以撒与雅各', en: 'Isaac and Jacob', from: k(1, 24, 1) },
  { id: 'joseph', zh: '约瑟在埃及', en: 'Joseph in Egypt', from: k(1, 37, 1),
    plan: [wip('route', '约瑟的路线 · 从多坍到埃及', 'Joseph\'s road — Dothan to Egypt')] },
  { id: 'exodus', zh: '出埃及', en: 'The exodus', from: k(2, 1, 1),
    plan: [wip('route', '十灾与出离 · 兰塞到红海', 'The plagues and the going out — Rameses to the sea')] },
  { id: 'sinai', zh: '西乃山与律法', en: 'Sinai and the law', from: k(2, 19, 1) },
  { id: 'tabernacle', zh: '会幕', en: 'The tabernacle', from: k(2, 25, 1),
    walk: { href: '/tabernacle.html', zh: '走进会幕', en: 'Walk into the tabernacle' } },
  { id: 'leviticus', zh: '利未记的献祭与节期', en: 'Offerings and feasts', from: k(3, 1, 1) },
  { id: 'wilderness', zh: '旷野行程', en: 'The wilderness itinerary', from: k(4, 1, 1) },
  { id: 'deuteronomy', zh: '摩西的讲论', en: 'Moses\' discourses', from: k(5, 1, 1) },
  { id: 'conquest', zh: '过约但河与耶利哥', en: 'Jordan and Jericho', from: k(6, 1, 1),
    plan: [wip('route', '约书亚的征战路线', 'Joshua\'s campaigns'),
           wip('walk', '耶利哥 · 城墙的样子经文没有量', 'Jericho — the text never measures its wall')] },
  { id: 'allotment', zh: '分地给十二支派', en: 'The land divided', from: k(6, 13, 1),
    plan: [wip('map', '十二支派的地界 · 按经文所列的城邑', 'The tribal allotments, from the towns the text lists')] },
  { id: 'judges', zh: '士师', en: 'The judges', from: k(7, 1, 1),
    plan: [wip('route', '士师的地方 · 底波拉、基甸、参孙', 'Where the judges acted — Deborah, Gideon, Samson')] },
  { id: 'ruth', zh: '路得', en: 'Ruth', from: k(8, 1, 1),
    plan: [wip('route', '摩押到伯利恒', 'Moab to Bethlehem')] },
  { id: 'samuel-ark', zh: '撒母耳与约柜', en: 'Samuel and the ark', from: k(9, 1, 1) },
  { id: 'saul', zh: '扫罗与大卫的逃亡', en: 'Saul, and David in flight', from: k(9, 8, 1),
    plan: [wip('route', '大卫逃亡的路线 · 从挪伯到洗革拉', 'David\'s flight — Nob to Ziklag')] },
  { id: 'david', zh: '大卫作王', en: 'David\'s reign', from: k(10, 1, 1),
    plan: [wip('route', '约柜进耶路撒冷', 'The ark comes up to Jerusalem')] },
  { id: 'solomon', zh: '所罗门与圣殿', en: 'Solomon and the temple', from: k(11, 1, 1),
    walk: { href: '/temple.html', zh: '走进圣殿', en: 'Walk into the temple' },
    plan: [wip('walk', '所罗门的宫、黎巴嫩林宫 · 王上七章有尺寸', 'Solomon\'s palace and the house of the forest — 1 Kgs 7 gives its measures')] },
  { id: 'divided', zh: '国分为二', en: 'The kingdom divided', from: k(11, 12, 1) },
  { id: 'elijah', zh: '以利亚', en: 'Elijah', from: k(11, 17, 1) },
  { id: 'elisha', zh: '以利沙', en: 'Elisha', from: k(12, 2, 1),
    plan: [wip('route', '以利沙的行程', 'Elisha\'s circuit')] },
  { id: 'fall-israel', zh: '北国的终结', en: 'The end of the north', from: k(12, 14, 1),
    plan: [wip('map', '亚述掳掠 · 经文所记被迁的地方', 'The Assyrian deportations, where the text names them')] },
  { id: 'fall-judah', zh: '犹大与被掳', en: 'Judah and the exile', from: k(12, 18, 1),
    plan: [wip('route', '被掳巴比伦的路', 'The road to Babylon')] },
  { id: 'chronicles', zh: '历代志', en: 'Chronicles', from: k(13, 1, 1) },
  { id: 'return', zh: '归回与重建圣殿', en: 'The return, and the second house', from: k(15, 1, 1),
    plan: [wip('walk', '第二圣殿 · 以斯拉记六章给了高六十肘、宽六十肘', 'The second house — Ezra 6 gives sixty cubits high and sixty broad')] },
  { id: 'nehemiah', zh: '尼希米与城墙', en: 'Nehemiah and the wall', from: k(16, 1, 1),
    plan: [wip('map', '城墙与各门 · 尼希米记三章逐段所记', 'The wall and its gates, section by section from Nehemiah 3')] },
  { id: 'esther', zh: '以斯帖', en: 'Esther', from: k(17, 1, 1) },
  { id: 'job', zh: '约伯', en: 'Job', from: k(18, 1, 1) },
  { id: 'psalms', zh: '诗篇', en: 'The Psalms', from: k(19, 1, 1) },
  { id: 'wisdom', zh: '箴言 · 传道书 · 雅歌', en: 'Proverbs, Ecclesiastes, the Song', from: k(20, 1, 1) },
  { id: 'isaiah', zh: '以赛亚', en: 'Isaiah', from: k(23, 1, 1) },
  { id: 'jeremiah', zh: '耶利米与耶利米哀歌', en: 'Jeremiah and Lamentations', from: k(24, 1, 1) },
  { id: 'ezekiel', zh: '以西结的异象', en: 'Ezekiel\'s visions', from: k(26, 1, 1) },
  { id: 'ezekiel-temple', zh: '以西结的殿', en: 'Ezekiel\'s temple', from: k(26, 40, 1),
    plan: [wip('walk', '走进以西结的殿 · 全经量得最细的一座', 'Walk into it — the most densely measured building in the canon', 'building'),
           wip('measure', '尺寸卡 · 四十至四十二章的量度', 'A card of the measures of chapters 40–42', 'building')] },
  { id: 'daniel', zh: '但以理', en: 'Daniel', from: k(27, 1, 1) },
  { id: 'minor', zh: '十二先知', en: 'The twelve', from: k(28, 1, 1) },
  { id: 'matthew', zh: '马太福音', en: 'Matthew', from: k(40, 1, 1),
    plan: [wip('route', '降生与逃往埃及', 'The nativity, and the flight into Egypt')] },
  { id: 'mark', zh: '马可福音', en: 'Mark', from: k(41, 1, 1) },
  { id: 'luke', zh: '路加福音', en: 'Luke', from: k(42, 1, 1) },
  { id: 'john', zh: '约翰福音', en: 'John', from: k(43, 1, 1),
    plan: [wip('walk', '希律的圣殿 · 只能按约瑟夫与米示拿做，并且要说明这一点',
               'Herod\'s temple — buildable only from Josephus and the Mishnah, and must say so', 'building'),
           wip('route', '受难周 · 耶路撒冷城内', 'The last week, inside the city')] },
  { id: 'acts-jerusalem', zh: '耶路撒冷的教会', en: 'The church at Jerusalem', from: k(44, 1, 1) },
  { id: 'acts-scattered', zh: '腓利、彼得与外邦人', en: 'Philip, Peter, and the nations', from: k(44, 8, 1),
    plan: [wip('route', '腓利与彼得的行程', 'Philip\'s and Peter\'s roads')] },
  { id: 'paul-1', zh: '第一次宣教旅程', en: 'The first journey', from: k(44, 13, 1) },
  { id: 'council', zh: '耶路撒冷会议', en: 'The council at Jerusalem', from: k(44, 15, 1) },
  { id: 'paul-2', zh: '第二次宣教旅程', en: 'The second journey', from: k(44, 15, 40) },
  { id: 'paul-3', zh: '第三次宣教旅程', en: 'The third journey', from: k(44, 18, 23) },
  { id: 'paul-trials', zh: '被捕与受审', en: 'Arrest and trials', from: k(44, 21, 18) },
  { id: 'paul-rome', zh: '押解往罗马', en: 'The voyage to Rome', from: k(44, 27, 1) },
  { id: 'epistles-paul', zh: '保罗书信', en: 'Paul\'s letters', from: k(45, 1, 1) },
  { id: 'epistles-general', zh: '希伯来书与普通书信', en: 'Hebrews and the general letters', from: k(58, 1, 1) },
  { id: 'rev-churches', zh: '给七个教会的信', en: 'The seven churches', from: k(66, 1, 1),
    plan: [wip('route', '七个教会 · 亚西亚的环路', 'The seven churches — the circuit in Asia')] },
  { id: 'rev-visions', zh: '异象与审判', en: 'The visions', from: k(66, 4, 1) },
  { id: 'new-jerusalem', zh: '新耶路撒冷', en: 'The new Jerusalem', from: k(66, 21, 1),
    plan: [wip('walk', '走进新耶路撒冷 · 一万二千斯他丢见方，墙一百四十四肘',
               'Walk into it — twelve thousand furlongs square, the wall a hundred and forty-four cubits')] },
];

/** The unit a verse key belongs to. Units are sorted and contiguous, so this
 *  is the last one that starts at or before the key. */
export function unitFor(key: number): Unit | null {
  let found: Unit | null = null;
  for (const u of UNITS) {
    if (u.from <= key) found = u; else break;
  }
  return found;
}
