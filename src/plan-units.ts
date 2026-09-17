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

export type Depth = 'verse' | 'map' | 'route' | 'measure' | 'scene' | 'walk';
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
    plan: [
      wip('scene', '创造的六日 · 光、穹苍、旱地、发光体、生物，按记载的次序', 'The six days, in the order the text sets them'),
      wip('walk', '伊甸园 · 经文给了四道河与树，没有给尺寸', 'Eden — the text gives four rivers and the trees, and no measurements')] },
  { id: 'fall', zh: '堕落与该隐的后裔', en: 'The fall, and Cain\'s line', from: k(1, 3, 1),
    plan: [wip('scene', '园的东边 · 基路伯和四面转动发火焰的剑（创 3:24）', 'East of the garden — cherubim and a flaming sword (Gen 3:24)')] },
  { id: 'flood', zh: '洪水与方舟', en: 'The flood and the ark', from: k(1, 6, 1),
    walk: { href: '/ark.html', zh: '走进方舟', en: 'Walk into the ark' },
    plan: [wip('scene', '洪水本身 · 水势比山高过十五肘（创 7:20）', 'The flood itself — the waters fifteen cubits above the mountains (Gen 7:20)')] },
  { id: 'babel', zh: '巴别与列国', en: 'Babel and the nations', from: k(1, 10, 1),
    plan: [
      wip('scene', '那城和塔 · 砖当石头、石漆当灰泥（创 11:3）；高度未记', 'The city and the tower — brick for stone, slime for mortar (Gen 11:3); no height is given'),
      wip('map', '列国分布图 · 创世记十章的名字落在何处', 'The table of nations, mapped where its names are identified')] },
  { id: 'abraham', zh: '亚伯拉罕', en: 'Abraham', from: k(1, 11, 27),
    plan: [wip('scene', '幔利的橡树与所多玛的平原（创 13:10–18）', 'The oaks of Mamre, and the plain of Sodom (Gen 13:10–18)')] },
  { id: 'isaac-jacob', zh: '以撒与雅各', en: 'Isaac and Jacob', from: k(1, 24, 1),
    plan: [wip('scene', '伯特利的梯子 · 立在地上，梯顶通天（创 28:12）', 'The ladder at Bethel — set on the earth, its top reaching heaven (Gen 28:12)')] },
  { id: 'joseph', zh: '约瑟在埃及', en: 'Joseph in Egypt', from: k(1, 37, 1),
    plan: [
      wip('scene', '埃及的积谷 · 多如海沙，无法计算（创 41:49）', 'The granaries of Egypt — as the sand of the sea (Gen 41:49)'),
      wip('route', '约瑟的路线 · 从多坍到埃及', 'Joseph\'s road — Dothan to Egypt')] },
  { id: 'exodus', zh: '出埃及', en: 'The exodus', from: k(2, 1, 1),
    plan: [
      wip('scene', '过红海 · 水在左右作了墙垣（出 14:22）', 'Through the sea — the waters a wall on their right hand and on their left (Ex 14:22)'),
      wip('route', '十灾与出离 · 兰塞到红海', 'The plagues and the going out — Rameses to the sea')] },
  { id: 'sinai', zh: '西乃山与律法', en: 'Sinai and the law', from: k(2, 19, 1),
    plan: [wip('scene', '山上的密云、火与角声，以及山的界限（出 19:12–18）', 'The mountain in cloud and fire, and the bounds set about it (Ex 19:12–18)')] },
  { id: 'tabernacle', zh: '会幕', en: 'The tabernacle', from: k(2, 25, 1),
    walk: { href: '/tabernacle.html', zh: '走进会幕', en: 'Walk into the tabernacle' } },
  { id: 'leviticus', zh: '利未记的献祭与节期', en: 'Offerings and feasts', from: k(3, 1, 1),
    plan: [wip('scene', '坛上常常烧着的火与五种祭（利 6:13）', 'The fire ever burning on the altar, and the five offerings (Lev 6:13)')] },
  { id: 'wilderness', zh: '旷野行程', en: 'The wilderness itinerary', from: k(4, 1, 1),
    plan: [wip('scene', '营的排列 · 四营各归本纛，会幕在当中（民 2）', 'The camp in its order — four camps by their standards, the tent in the midst (Num 2)')] },
  { id: 'deuteronomy', zh: '摩西的讲论', en: 'Moses\' discourses', from: k(5, 1, 1),
    plan: [wip('scene', '基利心山与以巴路山 · 祝福与咒诅（申 27:12–13）', 'Gerizim and Ebal — the blessing and the curse (Deut 27:12–13)')] },
  { id: 'conquest', zh: '过约但河与耶利哥', en: 'Jordan and Jericho', from: k(6, 1, 1),
    plan: [
      wip('scene', '约但河的水立起成垒，和绕城七次（书 3:16、6:4）', 'Jordan standing in a heap, and the seven circuits (Josh 3:16, 6:4)'),
      wip('route', '约书亚的征战路线', 'Joshua\'s campaigns'),
           wip('walk', '耶利哥 · 城墙的样子经文没有量', 'Jericho — the text never measures its wall')] },
  { id: 'allotment', zh: '分地给十二支派', en: 'The land divided', from: k(6, 13, 1),
    plan: [wip('map', '十二支派的地界 · 按经文所列的城邑', 'The tribal allotments, from the towns the text lists')] },
  { id: 'judges', zh: '士师', en: 'The judges', from: k(7, 1, 1),
    plan: [
      wip('scene', '基甸的三百人 · 瓶里的火把与角（士 7:16）', 'Gideon\'s three hundred — torches in pitchers, and trumpets (Judg 7:16)'),
      wip('route', '士师的地方 · 底波拉、基甸、参孙', 'Where the judges acted — Deborah, Gideon, Samson')] },
  { id: 'ruth', zh: '路得', en: 'Ruth', from: k(8, 1, 1),
    plan: [
      wip('scene', '收割的田与城门口的十个长老（得 2:3、4:2）', 'The harvest field, and the ten elders in the gate (Ruth 2:3, 4:2)'),
      wip('route', '摩押到伯利恒', 'Moab to Bethlehem')] },
  { id: 'samuel-ark', zh: '撒母耳与约柜', en: 'Samuel and the ark', from: k(9, 1, 1),
    plan: [wip('scene', '示罗的殿，和约柜被掳的那一日（撒上 4）', 'The house at Shiloh, and the day the ark was taken (1 Sam 4)')] },
  { id: 'saul', zh: '扫罗与大卫的逃亡', en: 'Saul, and David in flight', from: k(9, 8, 1),
    plan: [
      wip('scene', '大卫与歌利亚 · 身高六肘零一虎口，甲重五千舍客勒（撒上 17:4–7）', 'David and Goliath — six cubits and a span, his coat five thousand shekels (1 Sam 17:4–7)'),
      wip('route', '大卫逃亡的路线 · 从挪伯到洗革拉', 'David\'s flight — Nob to Ziklag')] },
  { id: 'david', zh: '大卫作王', en: 'David\'s reign', from: k(10, 1, 1),
    plan: [
      wip('scene', '约柜进大卫的城 · 抬的人走六步就献祭（撒下 6:13）', 'The ark comes up — six paces, and a sacrifice (2 Sam 6:13)'),
      wip('route', '约柜进耶路撒冷', 'The ark comes up to Jerusalem')] },
  { id: 'solomon', zh: '所罗门与圣殿', en: 'Solomon and the temple', from: k(11, 1, 1),
    walk: { href: '/temple.html', zh: '走进圣殿', en: 'Walk into the temple' },
    plan: [wip('walk', '所罗门的宫、黎巴嫩林宫 · 王上七章有尺寸', 'Solomon\'s palace and the house of the forest — 1 Kgs 7 gives its measures')] },
  { id: 'divided', zh: '国分为二', en: 'The kingdom divided', from: k(11, 12, 1),
    plan: [wip('scene', '伯特利与但的两只金牛犊（王上 12:28–29）', 'The two calves of gold, at Bethel and at Dan (1 Kgs 12:28–29)')] },
  { id: 'elijah', zh: '以利亚', en: 'Elijah', from: k(11, 17, 1),
    plan: [wip('scene', '迦密山的坛 · 十二块石头，沟容谷种二细亚，水浇三次（王上 18:31–35）', 'The altar on Carmel — twelve stones, a trench of two measures, water three times (1 Kgs 18:31–35)')] },
  { id: 'elisha', zh: '以利沙', en: 'Elisha', from: k(12, 2, 1),
    plan: [
      wip('scene', '书念妇人的楼房 · 床、桌子、椅子、灯台（王下 4:10）', 'The chamber on the wall — a bed, a table, a stool, a lamp (2 Kgs 4:10)'),
      wip('route', '以利沙的行程', 'Elisha\'s circuit')] },
  { id: 'fall-israel', zh: '北国的终结', en: 'The end of the north', from: k(12, 14, 1),
    plan: [
      wip('scene', '撒玛利亚被围三年（王下 17:5）', 'Samaria besieged three years (2 Kgs 17:5)'),
      wip('map', '亚述掳掠 · 经文所记被迁的地方', 'The Assyrian deportations, where the text names them')] },
  { id: 'fall-judah', zh: '犹大与被掳', en: 'Judah and the exile', from: k(12, 18, 1),
    plan: [
      wip('scene', '耶路撒冷被焚 · 铜柱、铜海与盆座被打碎运走（王下 25:13–17）', 'Jerusalem burned — the pillars, the sea and the bases broken up and carried away (2 Kgs 25:13–17)'),
      wip('route', '被掳巴比伦的路', 'The road to Babylon')] },
  { id: 'chronicles', zh: '历代志', en: 'Chronicles', from: k(13, 1, 1),
    plan: [wip('scene', '大卫为殿预备的材料 · 金银铜铁无法称量（代上 22:14）', 'What David prepared — gold and silver and brass without weight (1 Chr 22:14)')] },
  { id: 'return', zh: '归回与重建圣殿', en: 'The return, and the second house', from: k(15, 1, 1),
    plan: [wip('walk', '第二圣殿 · 以斯拉记六章给了高六十肘、宽六十肘', 'The second house — Ezra 6 gives sixty cubits high and sixty broad')] },
  { id: 'nehemiah', zh: '尼希米与城墙', en: 'Nehemiah and the wall', from: k(16, 1, 1),
    plan: [wip('map', '城墙与各门 · 尼希米记三章逐段所记', 'The wall and its gates, section by section from Nehemiah 3')] },
  { id: 'esther', zh: '以斯帖', en: 'Esther', from: k(17, 1, 1),
    plan: [wip('scene', '书珊宫院的筵席 · 白绿蓝的帐子、紫细麻绳、银环、白玉石柱（斯 1:6）', 'The feast at Shushan — white, green and blue hangings on silver rings and pillars of marble (Esth 1:6)')] },
  { id: 'job', zh: '约伯', en: 'Job', from: k(18, 1, 1),
    plan: [wip('scene', '从旋风中说话 · 地的根基、海的门、昴星与参星（伯 38）', 'Out of the whirlwind — the foundations of the earth, the doors of the sea, Pleiades and Orion (Job 38)')] },
  { id: 'psalms', zh: '诗篇', en: 'The Psalms', from: k(19, 1, 1),
    plan: [wip('scene', '上行之诗 · 上到耶和华的山（诗 120–134、24:3）', 'The songs of ascents — going up to the mountain of Yahweh (Ps 120–134, 24:3)')] },
  { id: 'wisdom', zh: '箴言 · 传道书 · 雅歌', en: 'Proverbs, Ecclesiastes, the Song', from: k(20, 1, 1),
    plan: [wip('scene', '关锁的园与封闭的井（歌 4:12–15）', 'A garden enclosed, a spring shut up (Song 4:12–15)')] },
  { id: 'isaiah', zh: '以赛亚', en: 'Isaiah', from: k(23, 1, 1),
    plan: [wip('scene', '主坐在高高的宝座上 · 撒拉弗各有六个翅膀（赛 6:1–4）', 'The Lord upon a throne, the seraphim each with six wings (Isa 6:1–4)')] },
  { id: 'jeremiah', zh: '耶利米与耶利米哀歌', en: 'Jeremiah and Lamentations', from: k(24, 1, 1),
    plan: [wip('scene', '窑匠的家 · 泥在窑匠手中（耶 18:3–4）', 'The potter\'s house — the clay in his hand (Jer 18:3–4)')] },
  { id: 'ezekiel', zh: '以西结的异象', en: 'Ezekiel\'s visions', from: k(26, 1, 1),
    plan: [wip('scene', '四活物与轮中套轮 · 轮辋满有眼睛（结 1:15–18）', 'The living creatures and the wheel within a wheel, the rings full of eyes (Ezek 1:15–18)')] },
  { id: 'ezekiel-temple', zh: '以西结的殿', en: 'Ezekiel\'s temple', from: k(26, 40, 1),
    plan: [wip('walk', '走进以西结的殿 · 全经量得最细的一座', 'Walk into it — the most densely measured building in the canon', 'building'),
           wip('measure', '尺寸卡 · 四十至四十二章的量度', 'A card of the measures of chapters 40–42', 'building')] },
  { id: 'daniel', zh: '但以理', en: 'Daniel', from: k(27, 1, 1),
    plan: [wip('scene', '尼布甲尼撒的金像 · 高六十肘、宽六肘（但 3:1）', 'The image of gold — sixty cubits high and six broad (Dan 3:1)')] },
  { id: 'minor', zh: '十二先知', en: 'The twelve', from: k(28, 1, 1),
    plan: [wip('scene', '尼尼微 · 三日的路程（拿 3:3）', 'Nineveh — three days\' journey across (Jonah 3:3)')] },
  { id: 'matthew', zh: '马太福音', en: 'Matthew', from: k(40, 1, 1),
    plan: [
      wip('scene', '山上的宝训 · 坐下教训人的山（太 5:1）', 'The mountain where he sat down and taught (Matt 5:1)'),
      wip('route', '降生与逃往埃及', 'The nativity, and the flight into Egypt')] },
  { id: 'mark', zh: '马可福音', en: 'Mark', from: k(41, 1, 1),
    plan: [wip('scene', '加利利海上的船与风浪（可 4:37–39）', 'The boat on the sea, and the storm (Mark 4:37–39)')] },
  { id: 'luke', zh: '路加福音', en: 'Luke', from: k(42, 1, 1),
    plan: [wip('scene', '客店与马槽（路 2:7）', 'The inn, and the manger (Luke 2:7)')] },
  { id: 'john', zh: '约翰福音', en: 'John', from: k(43, 1, 1),
    plan: [wip('walk', '希律的圣殿 · 只能按约瑟夫与米示拿做，并且要说明这一点',
               'Herod\'s temple — buildable only from Josephus and the Mishnah, and must say so', 'building'),
           wip('route', '受难周 · 耶路撒冷城内', 'The last week, inside the city')] },
  { id: 'acts-jerusalem', zh: '耶路撒冷的教会', en: 'The church at Jerusalem', from: k(44, 1, 1),
    plan: [wip('scene', '五旬节的楼房 · 舌头如火焰显现（徒 2:1–3）', 'The upper room at Pentecost — tongues like as of fire (Acts 2:1–3)')] },
  { id: 'acts-scattered', zh: '腓利、彼得与外邦人', en: 'Philip, Peter, and the nations', from: k(44, 8, 1),
    plan: [
      wip('scene', '该撒利亚 · 哥尼流的家与彼得的异象（徒 10）', 'Caesarea — the house of Cornelius, and the vision (Acts 10)'),
      wip('route', '腓利与彼得的行程', 'Philip\'s and Peter\'s roads')] },
  { id: 'paul-1', zh: '第一次宣教旅程', en: 'The first journey', from: k(44, 13, 1),
    plan: [wip('scene', '路司得 · 祭司牵着牛、拿着花圈（徒 14:13）', 'Lystra — the priest with oxen and garlands (Acts 14:13)')] },
  { id: 'council', zh: '耶路撒冷会议', en: 'The council at Jerusalem', from: k(44, 15, 1),
    plan: [wip('scene', '耶路撒冷的聚会（徒 15:6）', 'The council at Jerusalem (Acts 15:6)')] },
  { id: 'paul-2', zh: '第二次宣教旅程', en: 'The second journey', from: k(44, 15, 40),
    plan: [wip('scene', '腓立比的监 · 地大震动，门都开了（徒 16:26）', 'The prison at Philippi — the doors opened (Acts 16:26)')] },
  { id: 'paul-3', zh: '第三次宣教旅程', en: 'The third journey', from: k(44, 18, 23),
    plan: [wip('scene', '以弗所 · 银龛与那座戏园（徒 19:24、29）', 'Ephesus — the silver shrines, and the theatre (Acts 19:24, 29)')] },
  { id: 'paul-trials', zh: '被捕与受审', en: 'Arrest and trials', from: k(44, 21, 18),
    plan: [wip('scene', '该撒利亚的公堂（徒 25:23）', 'The hall of audience at Caesarea (Acts 25:23)')] },
  { id: 'paul-rome', zh: '押解往罗马', en: 'The voyage to Rome', from: k(44, 27, 1),
    plan: [wip('scene', '船上二百七十六人，和船头胶住的地方（徒 27:37、41）', 'Two hundred and seventy-six souls, and the place where the bow stuck fast (Acts 27:37, 41)')] },
  { id: 'epistles-paul', zh: '保罗书信', en: 'Paul\'s letters', from: k(45, 1, 1),
    plan: [wip('scene', '写信的城 · 每封信落在它写给的地方', 'The cities the letters go to, each letter set where it was sent')] },
  { id: 'epistles-general', zh: '希伯来书与普通书信', en: 'Hebrews and the general letters', from: k(58, 1, 1),
    plan: [wip('scene', '分散寄居的各处（彼前 1:1）', 'The dispersion, province by province (1 Pet 1:1)')] },
  { id: 'rev-churches', zh: '给七个教会的信', en: 'The seven churches', from: k(66, 1, 1),
    plan: [
      wip('scene', '七个金灯台，和人子在灯台中间（启 1:12–16）', 'Seven golden lampstands, and one in the midst of them (Rev 1:12–16)'),
      wip('route', '七个教会 · 亚西亚的环路', 'The seven churches — the circuit in Asia')] },
  { id: 'rev-visions', zh: '异象与审判', en: 'The visions', from: k(66, 4, 1),
    plan: [wip('scene', '宝座、二十四个座位、四活物与玻璃海（启 4）', 'The throne, the twenty-four seats, the living creatures and the sea of glass (Rev 4)')] },
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
