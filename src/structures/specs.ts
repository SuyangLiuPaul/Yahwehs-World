// Every structure here is built from numbers the text itself gives. Nothing is
// an artist's impression: if Scripture does not state a dimension, this file
// does not invent one — it records the gap in `unstated` and the card says so.
//
// The cubit is the whole problem. Scripture measures in cubits and never says
// how long one is, and the candidates differ by nearly 20%: Noah's ark is
// either 134 m or 157 m depending on which you pick. Rather than quietly
// choosing, the Measures panel puts the cubit on a slider and lets every
// cubit-measured structure resize at once (src/structures/panel.ts).

export interface CubitStandard {
  id: string;
  m: number;
  zh: string;
  en: string;
  note: string;
  noteEn: string;
}

export const CUBITS: CubitStandard[] = [
  {
    id: 'common',
    m: 0.445,
    zh: '普通肘',
    en: 'Common cubit',
    note: '肘至中指尖，约 44.5 厘米。最常用的换算。',
    noteEn: 'Elbow to middle fingertip, about 44.5 cm — the standard everyday cubit.',
  },
  {
    id: 'long',
    m: 0.518,
    zh: '圣所长肘',
    en: 'Long / sanctuary cubit',
    note: '「一肘零一掌」（结 40:5、代下 3:3），约 51.8 厘米。',
    noteEn: '"A cubit and a handbreadth" (Ezek 40:5; 2 Chr 3:3), about 51.8 cm.',
  },
  {
    id: 'royal',
    m: 0.523,
    zh: '埃及王室肘',
    en: 'Egyptian royal cubit',
    note: '约 52.3 厘米。摩西在埃及长大，有学者主张出埃及记用的是这个。',
    noteEn: 'About 52.3 cm. Raised in Egypt, Moses may have used this standard in Exodus.',
  },
];

/** A dimension the text actually states, with the verse that states it. */
export interface Dim {
  key: string;
  zh: string;
  en: string;
  cubits: number;
  ref: string;
  refEn: string;
}

export interface CountItem {
  zh: string;
  en: string;
  n: number;
  ref: string;
  refEn: string;
}

export interface BilingualText {
  zh: string;
  en: string;
}

export interface VariantOption {
  id: string;
  zh: string;
  en: string;
  note: string;
  noteEn: string;
}

export interface CompareItem {
  zh: string;
  en: string;
  m: number;
}

export type StructureKind =
  | 'ark'
  | 'chest'
  | 'court'
  | 'menorah'
  | 'tabernacleTent'
  | 'showbreadTable'
  | 'incenseAltar'
  | 'bronzeAltar'
  | 'highpriest'
  | 'templeHouse'
  | 'bronzePillar'
  | 'bronzeSea'
  | 'wheeledLaver'
  | 'forestHouse'
  | 'ezekielGate'
  | 'ezekielAltar'
  | 'goliath'
  | 'duraImage'
  | 'herodSanctuary'
  | 'secondTemple'
  | 'wildernessCamp'
  | 'ezekielWheels'
  | 'cube';

/** The walk-in pages. A card lives on the page where the thing it measures
 *  physically stands, which is the one rule that never needs maintaining: the
 *  ark of the covenant is in the most holy place, so its measurements are in
 *  the tabernacle walk, and nobody has to remember that they are. */
export type WalkHome = 'ark' | 'ezekiel' | 'herod' | 'new-jerusalem' | 'palace' | 'tabernacle' | 'temple';

export interface Structure {
  id: string;
  zh: string;
  en: string;
  /** The passage the card opens with. Must stay 4-space indented on its own line for audit-events.mjs. */
  ref: string;
  refZh: string;
  textZh: string;
  textEn: string;
  dims: Dim[];
  /** Rendered geometry kind — each has a builder in build.ts. */
  kind: StructureKind;
  /** Some things Scripture specifies by COUNT rather than by measurement. */
  counts?: CountItem[];
  /** Height in metres for objects the text does not measure. Traditional, not scriptural. */
  assumedHeight?: number;
  /** Where two defensible reconstructions or display views exist, both ship and the reader chooses. */
  variants?: {
    key: string;
    zh: string;
    en: string;
    options: VariantOption[];
  };
  /** Facts the text does not give. Naming them keeps the model honest. */
  unstated: BilingualText[];
  /** The line that should land once the thing is standing there at scale. */
  punchZh: string;
  punchEn: string;
  /** Real-world objects to set beside it, in metres. */
  compare: CompareItem[];
  /** Some measures are not in cubits at all. */
  unit?: { zh: string; en: string; m: number; note: string; noteEn: string };
  /** The walk this card is shown in. Absent means no walk holds this thing yet (lives on /plan.html). */
  walk?: WalkHome;
}

export const STRUCTURES: Structure[] = [
  {
    id: 'noah',
    zh: '挪亚方舟',
    en: "Noah's Ark",
    ref: 'Genesis 6:15',
    refZh: '创世记 6:15',
    textZh: '方舟的造法乃是这样：要长三百肘，宽五十肘，高三十肘。',
    textEn: 'This is how you are to build it: the ark is to be three hundred cubits long, fifty cubits wide and thirty cubits high.',
    dims: [
      { key: 'length', zh: '长', en: 'Length', cubits: 300, ref: '创 6:15', refEn: 'Gen 6:15' },
      { key: 'width',  zh: '宽', en: 'Width',  cubits: 50,  ref: '创 6:15', refEn: 'Gen 6:15' },
      { key: 'height', zh: '高', en: 'Height', cubits: 30,  ref: '创 6:15', refEn: 'Gen 6:15' },
    ],
    kind: 'ark',
    walk: 'ark',
    counts: [
      { zh: '甲板层数（上中下三层）', en: 'Decks (lower, second, third)', n: 3, ref: '创 6:16', refEn: 'Gen 6:16' },
      { zh: '透光处高度（一肘）', en: 'Roof light opening (cubit)', n: 1, ref: '创 6:16', refEn: 'Gen 6:16' },
    ],
    variants: {
      key: 'arkView',
      zh: '展示视角',
      en: 'Display view',
      options: [
        {
          id: 'cutaway',
          zh: '三层甲板剖面 · 内部隔间',
          en: 'Three-deck cutaway · internal bays',
          note: '切开近侧船壁，露出经文所记的上中下三层（创 6:16）、分间（6:14）与顶上一肘透光处。',
          noteEn: 'Cuts away the near side wall to reveal the three decks (Gen 6:16), rooms (6:14), and one-cubit light opening.',
        },
        {
          id: 'enclosed',
          zh: '完整涂松香的方箱船体',
          en: 'Enclosed pitched chest hull',
          note: '按希伯来文「箱子」（תֵּבָה）与创 6:14 里外抹松香、旁开一门的完整外形展示。',
          noteEn: 'Full gopher-wood chest (Hebrew tebah) sealed with pitch inside and out with the side door (Gen 6:14–16).',
        },
      ],
    },
    unstated: [
      {
        zh: '船体形状——经文只给了长宽高三个数，没有说船首船尾是什么样子。希伯来文「方舟」（תֵּבָה）原意是箱子，这里按方箱处理。',
        en: 'Hull shape — the text gives only three overall dimensions with no bow or stern curve. Hebrew tebah means a chest, so it is built as a chest.',
      },
      {
        zh: '隔间的具体大小、内部坡道或梯子的形制，以及歌斐木的具体树种。',
        en: 'Exact room layout, internal ramps or stairs between decks, and the botanical species of gopher wood.',
      },
    ],
    punchZh: '三个数字，一艘 134 米长的船。比一个标准足球场还长，容积超过四万立方米，比大多数人想象的大得多。',
    punchEn: 'Three numbers: a vessel **133.5 metres long** — longer than a football pitch, with three full decks and over 40,000 m³ of volume.',
    compare: [
      { zh: '标准足球场（长）', en: 'Football pitch (length)', m: 105 },
      { zh: '波音 747（机身长）', en: 'Boeing 747 fuselage', m: 70.6 },
      { zh: '蓝鲸', en: 'Blue whale', m: 30 },
    ],
  },
  {
    id: 'ark',
    zh: '约柜',
    en: 'Ark of the Covenant',
    ref: 'Exodus 25:10',
    refZh: '出埃及记 25:10',
    textZh: '要用皂荚木做一柜，长二肘半，宽一肘半，高一肘半。',
    textEn: 'Have them make an ark of acacia wood — two and a half cubits long, a cubit and a half wide, and a cubit and a half high.',
    dims: [
      { key: 'length', zh: '长', en: 'Length', cubits: 2.5, ref: '出 25:10', refEn: 'Exod 25:10' },
      { key: 'width',  zh: '宽', en: 'Width',  cubits: 1.5, ref: '出 25:10', refEn: 'Exod 25:10' },
      { key: 'height', zh: '高', en: 'Height', cubits: 1.5, ref: '出 25:10', refEn: 'Exod 25:10' },
    ],
    kind: 'chest',
    walk: 'tabernacle',
    counts: [
      { zh: '施恩座上的基路伯', en: 'Cherubim on mercy seat', n: 2, ref: '出 25:18', refEn: 'Exod 25:18' },
      { zh: '金环与脚', en: 'Gold rings & feet', n: 4, ref: '出 25:12', refEn: 'Exod 25:12' },
    ],
    unstated: [
      {
        zh: '基路伯的具体形态——经文说了「用金子锤出两个基路伯来」（出 25:18），高张翅膀遮掩施恩座，脸对脸朝向施恩座，没有给出外貌细节。',
        en: 'Form of the cherubim — Exodus 25:18–20 states only two hammered-gold winged figures facing each other over the cover, not their exact anatomy.',
      },
      {
        zh: '包金的厚度与杠的总长度（只知穿在环内永不抽出，王上 8:8 记杠头在圣所可以看见）。',
        en: 'Gold-overlay thickness and exact pole length (fixed permanently in the rings, visible from the Holy Place in 1 Kgs 8:8).',
      },
    ],
    punchZh: '一米一。整个以色列民族最神圣的器物，尺寸只有一个大号行李箱。两个人抬得动——事实上经文规定就是要用杠抬。',
    punchEn: '**1.11 metres long.** The most sacred vessel of Israel was the size of a large chest — light enough for two poles on priests’ shoulders.',
    compare: [
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '标准行李箱', en: 'Large suitcase', m: 0.75 },
    ],
  },
  {
    id: 'court',
    zh: '会幕院子',
    en: 'Court of the Tabernacle',
    ref: 'Exodus 27:18',
    refZh: '出埃及记 27:18',
    textZh: '院子要长一百肘，宽五十肘，高五肘，帷子要用捻的细麻做，带卯的座要用铜做。',
    textEn: 'The courtyard shall be a hundred cubits long and fifty cubits wide, with curtains of finely twisted linen five cubits high.',
    dims: [
      { key: 'length', zh: '长', en: 'Length', cubits: 100, ref: '出 27:18', refEn: 'Exod 27:18' },
      { key: 'width',  zh: '宽', en: 'Width',  cubits: 50,  ref: '出 27:18', refEn: 'Exod 27:18' },
      { key: 'height', zh: '帷子高', en: 'Curtain height', cubits: 5, ref: '出 27:18', refEn: 'Exod 27:18' },
      { key: 'gate',   zh: '东门帘宽', en: 'East gate screen', cubits: 20, ref: '出 27:16', refEn: 'Exod 27:16' },
    ],
    kind: 'court',
    walk: 'tabernacle',
    counts: [
      { zh: '院柱与铜座总数', en: 'Court pillars & bronze bases', n: 60, ref: '出 27:10–16', refEn: 'Exod 27:10–16' },
      { zh: '南面与北面各柱数', en: 'Pillars on south & north sides (each)', n: 20, ref: '出 27:10–11', refEn: 'Exod 27:10–11' },
      { zh: '西面柱数', en: 'Pillars on west side', n: 10, ref: '出 27:12', refEn: 'Exod 27:12' },
    ],
    unstated: [
      {
        zh: '帷子的织法细节与柱子的木料/金属材质，以及橛子与绳索如何拉紧（出 27:19 只提铜橛子）。',
        en: 'Exact curtain weave, pillar shaft material, and guy-rope tension geometry (Exod 27:19 mentions only bronze tent pegs).',
      },
    ],
    punchZh: '45 米 × 22 米，围墙只有两米二高——比一个标准篮球场大不了多少。六十根柱子围起的院子，一个人站在外面就能看见里面升起的烟。',
    punchEn: '**44.5 × 22.3 metres**, ringed by 60 pillars and linen hangings just **2.23 m high** — barely larger than two tennis courts.',
    compare: [
      { zh: '标准篮球场（长）', en: 'Basketball court (length)', m: 28 },
      { zh: '网球场（长）', en: 'Tennis court (length)', m: 23.77 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'menorah',
    zh: '金灯台',
    en: 'The Lampstand',
    ref: 'Exodus 25:31-40',
    refZh: '出埃及记 25:31-40',
    textZh: '要用精金做一个灯台。灯台的座和干与杯、球、花，都要接连一块锤出来。灯台两旁要杈出六个枝子：这旁三个，那旁三个。这旁每枝上有三个杯，形状像杏花，有球有花……',
    textEn: 'Make a lampstand of pure gold. Hammer out its base and shaft, and its flowerlike cups, buds and blossoms shall be of one piece with it. Six branches are to extend from the sides of the lampstand — three on one side and three on the other.',
    dims: [],
    counts: [
      { zh: '枝子', en: 'Side branches', n: 6, ref: '出 25:32', refEn: 'Exod 25:32' },
      { zh: '每枝上的杏花杯', en: 'Almond cups per branch', n: 3, ref: '出 25:33', refEn: 'Exod 25:33' },
      { zh: '干上的杏花杯', en: 'Almond cups on shaft', n: 4, ref: '出 25:34', refEn: 'Exod 25:34' },
      { zh: '枝子接处的球', en: 'Junction bulbs', n: 3, ref: '出 25:35', refEn: 'Exod 25:35' },
      { zh: '灯盏', en: 'Lamps', n: 7, ref: '出 25:37', refEn: 'Exod 25:37' },
    ],
    kind: 'menorah',
    walk: 'tabernacle',
    assumedHeight: 1.5,
    unstated: [
      {
        zh: '**灯台有多高，经文从头到尾没有说。** 出埃及记 25 章把每一个装饰的数量都数清楚了，却一个尺寸都没给。这里用的 1.5 米来自提图斯凯旋门浮雕的比例和犹太传统，不是经文。',
        en: '**No height or width is stated anywhere in Scripture.** Exodus 25 counts every ornament precisely yet gives zero dimensions; 1.5 m follows the Arch of Titus and rabbinic proportion.',
      },
      {
        zh: '**枝子是弧形还是直线，两千年来没有定论。** 提图斯凯旋门浮雕（公元 1 世纪）是弧形；迈蒙尼德在牛津藏本《密西拿注释》中亲笔画的是直线斜出，其子亚伯拉罕作证那是有意的。',
        en: '**Curved vs. straight branches remain debated.** The 1st-century Arch of Titus relief shows curved arms; Maimonides (12th c.) drew straight diagonal arms and his son testified this was deliberate.',
      },
      {
        zh: '**底座形状同样有争议。** 凯旋门浮雕上是两层六角带饰板的底座；犹太传统记载的是三足底座。上面的开关同时切换枝子和底座，把两种依据各自完整呈现。',
        en: '**Base form is equally disputed.** The Roman relief depicts a stepped hexagonal pedestal; rabbinic tradition describes a tripod base. The toggle switches branch and base together.',
      },
      {
        zh: '杏花杯的轮廓曲线——经文说「形状像杏花，有球有花」，给了三段结构与五瓣花形，没有给具体弧度。',
        en: 'Exact profile curve of each five-petalled almond-blossom unit.',
      },
    ],
    variants: {
      key: 'branchForm',
      zh: '枝子与底座形制',
      en: 'Branch & base form',
      options: [
        {
          id: 'arch',
          zh: '弧形枝子 · 分层六角底座',
          en: 'Arched branches · tiered hexagonal base',
          note: '提图斯凯旋门浮雕，公元 1 世纪罗马，现存最早的图像。底座为两层六角带凹槽饰板。',
          noteEn: 'Arch of Titus relief (Rome, 1st century AD), oldest surviving depiction with two-tiered hexagonal pedestal.',
        },
        {
          id: 'straight',
          zh: '直线枝子 · 三足底座',
          en: 'Straight branches · tripod base',
          note: '迈蒙尼德亲笔手稿（12 世纪）与拉比传统；哈巴德沿用至今。',
          noteEn: "Maimonides' autograph manuscript (12th century) and mainstream rabbinic tradition.",
        },
      ],
    },
    punchZh: '**二十二个杏花杯、三个接处的球、七个灯盏** —— 这些不是装饰性的猜测，是出埃及记 25 章一个一个数出来的。全部用一他连得纯金（约 34 公斤）锤成一整块，而它的高度经文一个字都没提。',
    punchEn: '**22 almond-blossom units, 3 junction bulbs, and 7 lamps** — every ornament counted in Exodus 25 and hammered from one talent (~34 kg) of pure gold, yet no linear dimension is written.',
    compare: [
      { zh: '一扇标准门（高）', en: 'Standard doorway (height)', m: 2.0 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '展示高度（传统估算）', en: 'Traditional display height', m: 1.5 },
    ],
  },
  {
    id: 'tabernacle-tent',
    zh: '会幕帐幕与竖板',
    en: 'Tabernacle Tent & Boards',
    ref: 'Exodus 26:15',
    refZh: '出埃及记 26:15',
    textZh: '你要用皂荚木做帐幕的竖板。每块要长十肘，宽一肘半；每块必有两榫相对。帐幕一切的板都要这样做。',
    textEn: 'Make upright frames of acacia wood for the tabernacle. Each frame is to be ten cubits long and a cubit and a half wide, with two projections set parallel to each other.',
    dims: [
      { key: 'length', zh: '帐幕总长（二十块板）', en: 'Tent length (20 boards)', cubits: 30, ref: '出 26:18', refEn: 'Exod 26:18' },
      { key: 'width',  zh: '帐幕宽', en: 'Tent width', cubits: 10, ref: '出 26:22–25', refEn: 'Exod 26:22–25' },
      { key: 'height', zh: '竖板高', en: 'Board height', cubits: 10, ref: '出 26:15–16', refEn: 'Exod 26:15–16' },
      { key: 'boardW', zh: '每块竖板宽', en: 'Board width', cubits: 1.5, ref: '出 26:16', refEn: 'Exod 26:16' },
      { key: 'curtainL', zh: '内层细麻幔长', en: 'Inner linen curtain length', cubits: 28, ref: '出 26:2', refEn: 'Exod 26:2' },
    ],
    kind: 'tabernacleTent',
    walk: 'tabernacle',
    counts: [
      { zh: '包金皂荚木竖板', en: 'Gold-overlaid acacia boards', n: 48, ref: '出 26:18–23', refEn: 'Exod 26:18–23' },
      { zh: '带卯的银座', en: 'Silver sockets (2 per board)', n: 96, ref: '出 26:19–25', refEn: 'Exod 26:19–25' },
      { zh: '闩（每面五根）', en: 'Horizontal bars (5 per side)', n: 15, ref: '出 26:26–28', refEn: 'Exod 26:26–28' },
      { zh: '金钩（连接十幅幔）', en: 'Gold clasps joining curtains', n: 50, ref: '出 26:6', refEn: 'Exod 26:6' },
    ],
    variants: {
      key: 'tentView',
      zh: '结构展示',
      en: 'Structural view',
      options: [
        {
          id: 'cutaway',
          zh: '四层盖顶与木板剖面',
          en: '4-layer covering & board cutaway',
          note: '逐层掀开海狗皮、染红公羊皮、山羊毛幔与绣基路伯细麻幔，清晰看见四十八块包金竖板、九十六个银座、闩与至圣所幔子。',
          noteEn: 'Steps back all four covering layers (leather, ram skins, goat hair, cherubim linen) to reveal the 48 golden boards, 96 silver sockets, bars, and inner veil.',
        },
        {
          id: 'covered',
          zh: '四层盖幔完整覆盖',
          en: 'Fully draped 4-layer tent',
          note: '按出 26:1–14 完整铺覆四层罩棚，可见山羊毛幔三十肘下垂掩盖竖板与后端余幅。',
          noteEn: 'Full four-layer tent coverings draped over the frame per Exod 26:1–14, showing the 30-cubit goat-hair overhang.',
        },
      ],
    },
    unstated: [
      {
        zh: '竖板的厚度与角板（出 26:23–24）的具体咬合方式——模型取 0.3 肘，使西端六块板加上两块角板恰好形成十肘内宽。',
        en: 'Board thickness and corner-board joinery (Exod 26:23–24) — modelled at ~0.3 cubits so six rear boards plus two corner boards match the 10-cubit span.',
      },
      {
        zh: '圣所二十肘与至圣所十肘的分界位置——由四层幔子接缝比例（出 26:33 放在钩子下）推算。',
        en: 'Exact veil placement dividing the 20-cubit Holy Place from the 10-cubit Most Holy Place, inferred from the 50 gold clasps in Exod 26:33.',
      },
      {
        zh: '「他哈施皮」（和合本作「海狗皮」）的动物学考据尚未定论，这里作深色鞣制皮革处理。',
        en: 'Identity of Hebrew tahash hides ("badger/dugong/fine leather" in Exod 26:14) remains debated; rendered as dark tanned hide.',
      },
    ],
    punchZh: '**四十八块竖板、九十六个银座、十五根金闩、四层盖顶**——出埃及记 26 章是一份完整的模块化装配清册。长三十肘、宽十肘、高十肘的便携木屋，里面隔出一个十肘见方的至圣所。',
    punchEn: '**48 gold-overlaid boards, 96 silver sockets, 15 bars, 4 roof layers** — Exodus 26 reads like a modular assembly manual for a **13.4 × 4.5 × 4.5 m** portable dwelling.',
    compare: [
      { zh: '会幕院子（长）', en: 'Tabernacle court (length)', m: 44.5 },
      { zh: '会幕帐幕（长）', en: 'Tabernacle tent (length)', m: 13.35 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'showbread-table',
    zh: '陈设饼桌子',
    en: 'Table of Showbread',
    ref: 'Exodus 25:23',
    refZh: '出埃及记 25:23',
    textZh: '要用皂荚木做一张桌子，长二肘，宽一肘，高一肘半。要包上精金，四围镶上金牙边。',
    textEn: 'Make a table of acacia wood — two cubits long, a cubit wide and a cubit and a half high. Overlay it with pure gold and make a gold molding around it.',
    dims: [
      { key: 'length', zh: '长', en: 'Length', cubits: 2,   ref: '出 25:23', refEn: 'Exod 25:23' },
      { key: 'width',  zh: '宽', en: 'Width',  cubits: 1,   ref: '出 25:23', refEn: 'Exod 25:23' },
      { key: 'height', zh: '高', en: 'Height', cubits: 1.5, ref: '出 25:23', refEn: 'Exod 25:23' },
    ],
    kind: 'showbreadTable',
    walk: 'tabernacle',
    counts: [
      { zh: '陈设饼（两行每行六个）', en: 'Loaves in 2 rows of 6', n: 12, ref: '利 24:5–6', refEn: 'Lev 24:5–6' },
      { zh: '桌脚金环', en: 'Gold rings on the 4 legs', n: 4, ref: '出 25:26', refEn: 'Exod 25:26' },
      { zh: '抬桌的杠', en: 'Carrying poles', n: 2, ref: '出 25:27–28', refEn: 'Exod 25:27–28' },
    ],
    variants: {
      key: 'tableView',
      zh: '材质剖面',
      en: 'Construction view',
      options: [
        {
          id: 'full',
          zh: '纯金包覆 · 十二个陈设饼与器皿',
          en: 'Full gold overlay · 12 loaves & vessels',
          note: '照出 25:23–30 与利 24:5–7 摆设两行各六个饼、乳香钵以及精金盘、调羹、爵与瓶。',
          noteEn: 'Complete gold-overlaid table with 12 loaves in two stacks of 6 (Lev 24:5–6), frankincense bowls, dishes, and flagons (Exod 25:29).',
        },
        {
          id: 'cutaway',
          zh: '内层皂荚木剖面',
          en: 'Acacia wood core cutaway',
          note: '局部掀开金箔包层，显示「皂荚木做底、精金包裹」的构造。',
          noteEn: 'Peels back a corner of the gold overlay to reveal the inner acacia wood construction.',
        },
      ],
    },
    unstated: [
      {
        zh: '十二个饼的形状（利 24:5–6 只说了「两行，每行六个」）与高一掌（约 7.5 厘米）围边的雕花纹样。',
        en: 'Exact loaf profile (Lev 24:5–6 specifies only two rows of six) and decorative detail on the handbreadth rim (Exod 25:25).',
      },
      {
        zh: '金盘、调羹、爵与瓶（出 25:29）各自的具体尺寸。',
        en: 'Dimensions of the gold plates, ladles, pitchers, and bowls named in Exod 25:29.',
      },
    ],
    punchZh: '长二肘、宽一肘、高一肘半——大约 **89 × 45 × 67 厘米**，正好是一张矮餐桌的尺度。桌上常年摆着十二个饼，代表以色列十二支派留在雅伟面前。',
    punchEn: '**89 × 45 × 67 cm** — the size of a compact side table, yet crowned with double gold moldings and holding **12 loaves** in two stacks of six before Yahweh.',
    compare: [
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '约柜（长）', en: 'Ark of the Covenant (length)', m: 1.1125 },
      { zh: '陈设饼桌（长）', en: 'Table of Showbread (length)', m: 0.89 },
    ],
  },
  {
    id: 'incense-altar',
    zh: '金香坛',
    en: 'Altar of Incense',
    ref: 'Exodus 30:1',
    refZh: '出埃及记 30:1',
    textZh: '你要用皂荚木做一座烧香的坛。这坛要四方的，长一肘，宽一肘，高二肘；坛的四角要与坛接连一块。',
    textEn: 'Make an altar of acacia wood for burning incense. It is to be square, a cubit long and a cubit wide, and two cubits high — its horns of one piece with it.',
    dims: [
      { key: 'length', zh: '长', en: 'Length', cubits: 1, ref: '出 30:2', refEn: 'Exod 30:2' },
      { key: 'width',  zh: '宽', en: 'Width',  cubits: 1, ref: '出 30:2', refEn: 'Exod 30:2' },
      { key: 'height', zh: '高', en: 'Height', cubits: 2, ref: '出 30:2', refEn: 'Exod 30:2' },
    ],
    kind: 'incenseAltar',
    walk: 'tabernacle',
    counts: [
      { zh: '坛角（与坛接连一块）', en: 'Corner horns (one piece)', n: 4, ref: '出 30:2', refEn: 'Exod 30:2' },
      { zh: '金牙边下金环', en: 'Gold rings under molding', n: 2, ref: '出 30:4', refEn: 'Exod 30:4' },
      { zh: '抬坛的杠', en: 'Carrying poles', n: 2, ref: '出 30:5', refEn: 'Exod 30:5' },
    ],
    variants: {
      key: 'incenseView',
      zh: '展示状态',
      en: 'Display view',
      options: [
        {
          id: 'lit',
          zh: '烧香状态 · 金牙边与四角',
          en: 'Lit incense · golden crown & horns',
          note: '早晚在香坛上烧馨香料（出 30:7–8），设四角、金牙边、二金环与包金木杠。',
          noteEn: 'Morning and evening incense rising from the altar standing before the veil (Exod 30:6–8).',
        },
        {
          id: 'cutaway',
          zh: '皂荚木胎剖面',
          en: 'Acacia wood core cutaway',
          note: '切开纯金包层一角，显出里面的皂荚木结构（出 30:1–3）。',
          noteEn: 'Cutaway revealing the inner acacia wood frame beneath the pure gold overlay (Exod 30:1–3).',
        },
      ],
    },
    unstated: [
      {
        zh: '四个坛角的高度与弯曲弧度、坛顶盛放炭火香膏的浅盘形状（经文只说接连一块包精金）。',
        en: 'Horn height/curvature and exact shallow hearth recess at the top.',
      },
      {
        zh: '「两旁」金环的数目与位置——出 30:4 说在金牙边以下「两旁做两个金环」，这里按相对两侧各一环穿杠（或两两对置）。',
        en: 'Exact ring placement beneath the molding ("two gold rings ... on both of its two sides", Exod 30:4).',
      },
    ],
    punchZh: '一肘见方、高二肘——大约 **45 × 45 × 89 厘米**，高到祭司的腰际。这是圣所里最高的一件供坛，紧贴在至圣所幔子前面，早晚升起烟云。',
    punchEn: '**45 × 45 × 89 cm** — standing waist-high directly before the veil, the tallest altar inside the Holy Place.',
    compare: [
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '金灯台（估算高）', en: 'Lampstand (est. height)', m: 1.5 },
      { zh: '金香坛（高）', en: 'Altar of Incense (height)', m: 0.89 },
    ],
  },
  {
    id: 'bronze-altar',
    zh: '铜祭坛',
    en: 'Bronze Altar of Burnt Offering',
    ref: 'Exodus 27:1',
    refZh: '出埃及记 27:1',
    textZh: '你要用皂荚木做坛，这坛要四方的，长五肘，宽五肘，高三肘。要在坛的四拐角上做四个角，与坛接连一块，用铜把坛包裹。',
    textEn: 'Build an altar of acacia wood, three cubits high; it is to be square, five cubits long and five cubits wide. Make a horn at each of the four corners, so that the horns and the altar are of one piece, and overlay the altar with bronze.',
    dims: [
      { key: 'length', zh: '长', en: 'Length', cubits: 5,   ref: '出 27:1', refEn: 'Exod 27:1' },
      { key: 'width',  zh: '宽', en: 'Width',  cubits: 5,   ref: '出 27:1', refEn: 'Exod 27:1' },
      { key: 'height', zh: '高', en: 'Height', cubits: 3,   ref: '出 27:1', refEn: 'Exod 27:1' },
      { key: 'grate',  zh: '半腰铜网高度', en: 'Mid-height bronze grating', cubits: 1.5, ref: '出 27:5', refEn: 'Exod 27:5' },
    ],
    kind: 'bronzeAltar',
    walk: 'tabernacle',
    counts: [
      { zh: '坛拐角的铜角', en: 'Corner bronze horns', n: 4, ref: '出 27:2', refEn: 'Exod 27:2' },
      { zh: '铜网四角的铜环', en: 'Bronze rings on grating', n: 4, ref: '出 27:4', refEn: 'Exod 27:4' },
      { zh: '抬坛的铜包木杠', en: 'Bronze-overlaid carrying poles', n: 2, ref: '出 27:6–7', refEn: 'Exod 27:6–7' },
    ],
    variants: {
      key: 'bronzeAltarView',
      zh: '结构剖面',
      en: 'Structural view',
      options: [
        {
          id: 'tabernacle-cutaway',
          zh: '中空坛壁剖面 · 显露半腰铜网',
          en: 'Hollow wall cutaway · mid-height grating',
          note: '切开前壁，看见出 27:8「用板做坛，坛是空的」以及出 27:5 嵌在半腰（1.5 肘）的铜网架。',
          noteEn: 'Cuts open the front wall to reveal the hollow acacia-and-bronze frame (Exod 27:8) and mid-height grating (27:5).',
        },
        {
          id: 'tabernacle-full',
          zh: '完整铜包中空祭坛',
          en: 'Complete enclosed hollow altar',
          note: '完整四壁包铜，四面铜围腰板（karkov）、四角铜环穿杠、坛侧附盆铲肉叉火鼎（出 27:3）。',
          noteEn: 'Full enclosed hollow bronze altar with perimeter ledge, four rings and poles, plus ash pan, shovels, and firepans (Exod 27:3).',
        },
      ],
    },
    unstated: [
      {
        zh: '铜围腰板（出 27:5）究竟是外围窄边还是内壁凸缘，学者有不同读法。',
        en: 'Whether the ledge (karkov, Exod 27:5) ran around the exterior or interior perimeter.',
      },
      {
        zh: '三肘高（约 1.34 米）是否由斜坡（出 20:26 禁止用台阶上坛）或泥土填实底部——出埃及记未记坡道长度，这里不擅自加造。',
        en: 'Access ramp details (Exod 20:26 forbids steps, and Exod 27 specifies no ramp dimensions).',
      },
    ],
    punchZh: '五肘见方、高三肘——大约 **2.23 × 2.23 × 1.34 米**。不是实心铜块，而是「用板做、里面是空的」可搬运框架，好在旷野行军时填土或升火（后来所罗门殿的铜坛扩大为 20×20×10 肘，代下 4:1）。',
    punchEn: '**2.23 × 2.23 × 1.34 m** — not a solid bronze block, but hollow acacia-and-bronze boards (Exod 27:8) with a bronze grating at half height (later scaled up to 20×20×10 cubits in Solomon’s temple, 2 Chr 4:1).',
    compare: [
      { zh: '所罗门铜坛（宽，代下 4:1）', en: "Solomon's altar (width, 2 Chr 4:1)", m: 8.9 },
      { zh: '会幕铜祭坛（宽）', en: 'Tabernacle bronze altar (width)', m: 2.225 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'highpriest',
    zh: '大祭司的圣服',
    en: 'Garments of the High Priest',
    ref: 'Exodus 28:16',
    refZh: '出埃及记 28:16',
    textZh: '要用巧匠的手工做决断的胸牌。胸牌要四方，叠为两层，长一虎口，宽一虎口。',
    textEn: 'Fashion the breastpiece of skilled work — it is to be a square, a span long and a span wide, and folded double.',
    dims: [
      { key: 'span', zh: '胸牌长宽（一虎口）', en: 'Breastpiece square (1 span)', cubits: 0.5, ref: '出 28:16', refEn: 'Exod 28:16' },
    ],
    kind: 'highpriest',
    walk: 'tabernacle',
    assumedHeight: 1.72,
    counts: [
      { zh: '胸牌上的宝石（四行三列）', en: 'Breastpiece gems (4×3 rows)', n: 12, ref: '出 28:17–20', refEn: 'Exod 28:17–20' },
      { zh: '肩上的红玛瑙（各刻六名）', en: 'Onyx shoulder stones', n: 2, ref: '出 28:9–12', refEn: 'Exod 28:9–12' },
      { zh: '宝石上刻的支派名', en: 'Engraved tribal names', n: 12, ref: '出 28:21', refEn: 'Exod 28:21' },
      { zh: '胸牌内的乌陵和土明', en: 'Urim and Thummim', n: 2, ref: '出 28:30', refEn: 'Exod 28:30' },
    ],
    variants: {
      key: 'priestView',
      zh: '圣服展示',
      en: 'Vestment view',
      options: [
        {
          id: 'vested',
          zh: '全套大祭司圣服（1.72 米身高比例）',
          en: 'Full high-priestly vestments (1.72 m)',
          note: '细麻内袍、蓝色以弗得外袍（下摆金铃与石榴相间）、金蓝紫朱红细麻以弗得、一虎口见方十二宝石胸牌、冠冕与「归雅伟为圣」金牌。',
          noteEn: 'Checkered linen coat, blue robe with gold bells & pomegranates, woven ephod with onyx shoulder stones, 1-span 12-gem breastpiece, and turban with gold plate.',
        },
        {
          id: 'breastpiece',
          zh: '掀开胸牌双层夹袋 · 显露乌陵土明',
          en: 'Open folded breastpiece · Urim & Thummim',
          note: '微启「叠为两层」（出 28:16）的胸牌，展示藏于其中、形式未详的乌陵与土明（出 28:30）。',
          noteEn: 'Slightly parts the folded-double breastpiece (Exod 28:16) to illustrate the Urim and Thummim inside (28:30).',
        },
      ],
    },
    unstated: [
      {
        zh: '**亚伦的身高经文没有记载。** 这里按 1.72 米成年男子短发比例站立展示（林前 11:14），只为让一虎口（约 22.3 厘米）胸牌读出真实身体尺度。',
        en: "**Aaron's stature is not stated.** Rendered at 1.72 m with short hair (1 Cor 11:14) so the half-cubit span breastpiece reads against real human scale.",
      },
      {
        zh: '**外袍下摆石榴和金铃的数目没有记载。** 出 28:33–34 只说石榴与金铃铛相间一圈；模型以十二组二十四枚示意，不作经文数字主张。',
        en: '**Bell and pomegranate count is unstated.** Exod 28:33–34 gives only the alternating pattern around the hem; 12 pairs are shown for legibility.',
      },
      {
        zh: '**乌陵和土明的形制经文没有描述。** 只说了放在决断胸牌里（出 28:30），模型用两枚示意片标记其所在。',
        en: '**Form of Urim and Thummim is unstated** (Exod 28:30); two symbolic tokens mark their place inside the folded breastpiece.',
      },
      {
        zh: '宝石的具体矿物学颜色与各支派对应关系，以及冠冕（mitre）具体的盘绕层数。',
        en: 'Exact gemological identifications and turban wrapping folds.',
      },
    ],
    punchZh: '**一虎口见方**（半肘，约 22 厘米）的胸牌叠为两层，镶十二块宝石四行三列；冠冕正面蓝细带系着纯金牌，上刻「归雅伟为圣」。这是整本出埃及记尺寸与工艺最精密的一套衣物。',
    punchEn: 'A **1-span square** (~22.3 cm) breastpiece folded double with **12 gems in 4×3 rows**, onyx shoulder stones, bells and pomegranates on a blue hem, and a pure gold crown reading **HOLINESS TO YAHWEH**.',
    compare: [
      { zh: '展示人体身高（未记）', en: 'Human scale figure (display)', m: 1.72 },
      { zh: '约柜（长，2.5 肘）', en: 'Ark of the Covenant (length)', m: 1.1125 },
      { zh: '胸牌边长（1 虎口 = 0.5 肘）', en: 'Breastpiece width (1 span)', m: 0.2225 },
    ],
  },
  {
    id: 'wilderness-camp',
    zh: '旷野十二支派安营图',
    en: "Israel's 12-Tribe Wilderness Camp",
    ref: 'Numbers 2:2',
    refZh: '民数记 2:2',
    textZh: '以色列人要各归自己的纛下，在本族的旗号那里，对着会幕的四围安营。',
    textEn: 'The Israelites are to camp around the tent of meeting some distance from it, each of them under their standard and holding the banners of their family.',
    dims: [
      { key: 'courtL', zh: '中心会幕院子长', en: 'Central court length',      cubits: 100, ref: '出 27:18',     refEn: 'Exod 27:18' },
      { key: 'courtW', zh: '中心会幕院子宽', en: 'Central court width',       cubits: 50,  ref: '出 27:18',     refEn: 'Exod 27:18' },
      { key: 'tentL',  zh: '会幕帐幕长',     en: 'Tabernacle tent length',    cubits: 30,  ref: '出 26:18',     refEn: 'Exod 26:18' },
      { key: 'tentW',  zh: '会幕帐幕宽与高', en: 'Tabernacle width & height', cubits: 10,  ref: '出 26:16, 22', refEn: 'Exod 26:16, 22' },
      { key: 'courtH', zh: '细麻院帷高',     en: 'Court curtain height',      cubits: 5,   ref: '出 27:18',     refEn: 'Exod 27:18' },
    ],
    kind: 'wildernessCamp',
    walk: 'tabernacle',
    counts: [
      { zh: '东营（日出之地）· 犹大纛下三支派', en: 'East · Camp of Judah (3 tribes)',   n: 186400, ref: '民 2:9',  refEn: 'Num 2:9' },
      { zh: '北营 · 但纛下三支派',             en: 'North · Camp of Dan (3 tribes)',    n: 157600, ref: '民 2:31', refEn: 'Num 2:31' },
      { zh: '南营 · 流便纛下三支派',           en: 'South · Camp of Reuben (3 tribes)', n: 151450, ref: '民 2:16', refEn: 'Num 2:16' },
      { zh: '西营 · 以法莲纛下三支派',         en: 'West · Camp of Ephraim (3 tribes)', n: 108100, ref: '民 2:24', refEn: 'Num 2:24' },
      { zh: '十二支派男丁总数（二十岁以上）',   en: 'Total census (12 tribes, 20+ yrs)', n: 603550, ref: '民 2:32', refEn: 'Num 2:32' },
      { zh: '内圈利未人总数（一个月以上）',     en: 'Inner ring Levites (1 mo+)',        n: 22000,  ref: '民 3:39', refEn: 'Num 3:39' },
    ],
    variants: {
      key: 'campLayout',
      zh: '营距比例',
      en: 'Camp spacing',
      options: [
        {
          id: 'proportional',
          zh: '严守人数面积比例 · 留出圣所缓冲带（民 2:2）',
          en: 'Strictly census-proportional · open sacred buffer',
          note: '外圈十二支派每一营区的占地面积与帐棚密度严格正比于民数记 2 章核点人数：东营犹大（**186,400**）比西营以法莲（**108,100**）宽出近七成，内圈由利未四营护卫会幕（民 1:53；3:21–38）。',
          noteEn: 'Every tribal parcel is strictly proportional in footprint area to its Numbers 2 census count — Judah on the east (**186,400**) visibly outweighs Ephraim on the west (**108,100**) by 72% — ringed around the four Levite divisions and 100×50 cubit Tabernacle.',
        },
        {
          id: 'compact',
          zh: '紧凑鸟瞰阵型 · 近看会幕与利未四营',
          en: 'Compact diagram spacing · close Tabernacle & Levite view',
          note: '收窄营间旷野缓冲带，便于在同一视野内近距离审视 100×50 肘会幕院子、东门摩西亚伦营位与外圈十二支派旗号，同时完全保留各支派人数面积比。',
          noteEn: 'Tightens the desert buffer so the 100×50 cubit Tabernacle courtyard, four Levite stations, and 12 tribal standards read up close while preserving exact census area ratios.',
        },
      ],
    },
    unstated: [
      {
        zh: '「对着会幕的四围安营」的具体相隔肘数，民数记 2:2 没有写出（后世拉比传统据书 3:4 推算为二千肘安息日路程，若按真实二千肘留白，中心会幕在屏幕上将缩成一个小点）；模型用两种示意间距呈现，而中心会幕严格按 100×50 肘建模。',
        en: 'Numbers 2:2 says "some distance" around the Tent of Meeting without stating a cubit gap (later tradition inferred 2,000 cubits from Josh 3:4, at which scale the Tabernacle would vanish to a speck); two schematic buffer spacings are provided around the exact 100×50 cubit court.',
      },
      {
        zh: '各支派每户帐棚的尺寸与营区总长宽未见经文记载；模型令每一支派地块的宽度严格正比于民数记 2 章的人口数，以真实反映四方营阵的不对称体量。',
        en: 'Individual family tent sizes and total camp perimeter are unstated; each tribe’s parcel width is scaled directly to its Numbers 2 census count to show the true asymmetry of the four quarters.',
      },
      {
        zh: '各营「纛」（degel）与「旗号」（ot）上的图案经文只字未提（狮、人、牛、鹰之说出自后世拉比《民数记大传》，并非圣经文本）；模型仅以纯色织旗区分四营，绝不添画圣经未记的图像；会幕上方的云柱火柱亦严守无形像光云（出 40:38）。',
        en: 'Scripture never describes emblems on the tribal standards (lion/man/ox/eagle come from late midrash, not Numbers 2); plain colored banners are used, and the pillar of cloud and fire above the Tabernacle is rendered strictly aniconically (Exod 40:38).',
      },
    ],
    punchZh: '这不是一个四面均等的几何方阵：东边日出之地犹大三支派多达 **186,400 人**，西边以法莲三支派只有 **108,100 人**；中间由 **22,000 名利未人**四面环卫（摩西亚伦守东门，哥辖南、革顺西、米拉利北），正中锁着 **100 × 50 肘**的会幕与昼夜不离的云火光辉。',
    punchEn: 'Not an equal geometric square, but a living census map: **186,400** camp on the east under Judah versus **108,100** on the west under Ephraim, buffering **22,000 Levites** in four inner divisions around the **100 × 50 cubit** Tabernacle.',
    compare: [
      { zh: '标准足球场（长）', en: 'Football pitch (length)', m: 105 },
      { zh: '中心会幕院子（长 100 肘）', en: 'Central Tabernacle court (100 c)', m: 44.5 },
      { zh: '会幕帐幕（长 30 肘）', en: 'Tabernacle tent (30 c)', m: 13.35 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'temple',
    zh: '所罗门圣殿',
    en: "Solomon's Temple",
    ref: '1 Kings 6:2',
    refZh: '列王纪上 6:2',
    textZh: '所罗门王为雅伟所建的殿，长六十肘，宽二十肘，高三十肘。',
    textEn: 'The temple that King Solomon built for Yahweh was sixty cubits long, twenty wide and thirty high.',
    dims: [
      { key: 'length',     zh: '殿长',       en: 'House length', cubits: 60, ref: '王上 6:2',  refEn: '1 Kgs 6:2' },
      { key: 'width',      zh: '殿宽',       en: 'House width',  cubits: 20, ref: '王上 6:2',  refEn: '1 Kgs 6:2' },
      { key: 'height',     zh: '殿高',       en: 'House height', cubits: 30, ref: '王上 6:2',  refEn: '1 Kgs 6:2' },
      { key: 'porchDepth', zh: '廊深',       en: 'Porch depth',  cubits: 10, ref: '王上 6:3',  refEn: '1 Kgs 6:3' },
      { key: 'hekal',      zh: '外殿（圣所）长', en: 'Main hall (Hekal)', cubits: 40, ref: '王上 6:17', refEn: '1 Kgs 6:17' },
      { key: 'debir',      zh: '内殿（至圣所）见方', en: 'Inner sanctuary (Debir)', cubits: 20, ref: '王上 6:20', refEn: '1 Kgs 6:20' },
    ],
    kind: 'templeHouse',
    walk: 'temple',
    counts: [
      { zh: '旁屋层数（下5 / 中6 / 上7肘）', en: 'Side-chamber storeys (5/6/7 cubits)', n: 3, ref: '王上 6:5–6', refEn: '1 Kgs 6:5–6' },
      { zh: '内殿橄榄木基路伯（高10肘）', en: '10-cubit cherubim in Debir', n: 2, ref: '王上 6:23', refEn: '1 Kgs 6:23' },
    ],
    variants: {
      key: 'templeView',
      zh: '剖面视图',
      en: 'Section view',
      options: [
        {
          id: 'cutaway',
          zh: '纵向剖面 · 显露圣所与 20×20×20 至圣所',
          en: 'Longitudinal cutaway · 20³ Debir cube',
          note: '切开南侧石墙与三层旁屋，显出 40 肘外殿与后部 20×20×20 肘立方体至圣所（内立两个十肘基路伯与约柜）。',
          noteEn: 'Cuts open the south wall and 3-tier side chambers to reveal the 40-cubit main hall and 20×20×20 cubit gilded Debir.',
        },
        {
          id: 'exterior',
          zh: '外观石砌与三层旁屋',
          en: 'Full exterior ashlar & side chambers',
          note: '完整呈现凿石墙身、严紧的高窗（王上 6:4）、三层旁屋台阶缩进（下五、中六、上七肘）及东面十肘廊子。',
          noteEn: 'Complete dressed-stone exterior, narrow latticed clerestory windows (6:4), three stepped side-chamber tiers, and east porch.',
        },
      ],
    },
    unstated: [
      {
        zh: '**屋顶坡度经文没有给。** 王上 6:9 只记高三十肘、用香柏木作栋梁和板，未记斜顶或平顶；模型按平顶绘制。',
        en: '**Roof pitch is unstated.** 1 Kgs 6:9 specifies cedar beams and boards at 30 cubits height with no slope angle; rendered flat.',
      },
      {
        zh: '**石墙厚度没有记载。** 模型取一肘厚，使内部空间精确等于 60×20 肘。',
        en: '**Wall thickness is unstated.** Modelled at 1 cubit to preserve the 60×20 cubit interior.',
      },
      {
        zh: '**历代志下 3:4 记廊子高一百二十肘，与王上 6:2 全殿三十肘差异极大**（部分古抄本作二十肘）；此处按王上全殿高度三十肘建模。',
        en: '**Porch height discrepancy:** 2 Chr 3:4 reads 120 cubits (possibly textual corruption for 20/30); 1 Kgs 6 height of 30 cubits is drawn here.',
      },
      {
        zh: '旁屋具体的隔间数量、门的高度与盘旋楼梯形制。',
        en: 'Number of side-chamber rooms, door heights, and exact winding-stair geometry.',
      },
    ],
    punchZh: '六十乘二十乘三十肘 —— 大约 **27 × 9 × 13 米**，比会幕帐幕长两倍、宽两倍，却是凿石香柏木盖的房子。后部**二十肘见方的至圣所**是个金包立方体，里面两个十肘高的基路伯翅膀正好撑满那二十肘。',
    punchEn: '**60 × 20 × 30 cubits** (~26.7 × 8.9 × 13.4 m) — double the tabernacle’s length and width in dressed stone and gold-overlaid cedar, enclosing a **20-cubit cubic Debir**.',
    compare: [
      { zh: '一个标准篮球场（长）', en: 'Basketball court (length)', m: 28 },
      { zh: '所罗门圣殿（不含廊子长）', en: "Solomon's Temple (house length)", m: 26.7 },
      { zh: '会幕帐幕（长）', en: 'Tabernacle tent (length)', m: 13.35 },
    ],
  },
  {
    id: 'pillars',
    zh: '雅斤与波阿斯',
    en: 'Jachin and Boaz',
    ref: '1 Kings 7:15',
    refZh: '列王纪上 7:15',
    textZh: '他制造两根铜柱，每根高十八肘，围十二肘。',
    textEn: 'He cast two pillars of bronze, each eighteen cubits high and twelve cubits in circumference.',
    dims: [
      { key: 'height',  zh: '柱高（王上）', en: 'Shaft height (1 Kgs)', cubits: 18, ref: '王上 7:15', refEn: '1 Kgs 7:15' },
      { key: 'girth',   zh: '柱围',         en: 'Circumference',        cubits: 12, ref: '王上 7:15', refEn: '1 Kgs 7:15' },
      { key: 'capital', zh: '柱顶高',       en: 'Capital height',       cubits: 5,  ref: '王上 7:16', refEn: '1 Kgs 7:16' },
      { key: 'lily',    zh: '顶上百合花宽', en: 'Lily-work span',       cubits: 4,  ref: '王上 7:19', refEn: '1 Kgs 7:19' },
    ],
    kind: 'bronzePillar',
    walk: 'temple',
    counts: [
      { zh: '每柱顶网子（七个）', en: 'Chain wreaths per capital', n: 7, ref: '王上 7:17', refEn: '1 Kgs 7:17' },
      { zh: '每柱顶石榴（王上）', en: 'Pomegranates (1 Kings)', n: 200, ref: '王上 7:20', refEn: '1 Kgs 7:20' },
      { zh: '每柱顶石榴（代下）', en: 'Pomegranates (2 Chronicles)', n: 100, ref: '代下 3:16', refEn: '2 Chr 3:16' },
    ],
    variants: {
      key: 'pillarReading',
      zh: '经文柱高与石榴记载',
      en: 'Textual height & count',
      options: [
        {
          id: 'kings-18',
          zh: '列王纪上 7:15 · 单柱高 18 肘 · 200 石榴',
          en: '1 Kings 7:15 · 18-cubit shaft · 200 pomegranates',
          note: '王上 7:15、耶 52:21、王下 25:17 均作柱高 18 肘（加柱顶 5 肘共 23 肘），两行共 200 个石榴。',
          noteEn: 'Matches 1 Kgs 7:15, 2 Kgs 25:17, and Jer 52:21 (18-cubit shaft + 5-cubit capital = 23 cubits; 200 pomegranates).',
        },
        {
          id: 'chronicles-35',
          zh: '历代志下 3:15 · 柱高 35 肘 · 100 石榴',
          en: '2 Chronicles 3:15 · 35-cubit shaft · 100 pomegranates',
          note: '代下 3:15 作「高三十五肘」（许多学者认为是将两根 18 肘柱身总长合记，减去接口约 35 肘），并作 100 石榴。',
          noteEn: 'Follows 2 Chr 3:15–16 (35-cubit shaft — often interpreted as combined length of both pillars — and 100 pomegranates).',
        },
      ],
    },
    unstated: [
      {
        zh: '**柱高的两处记载不一致。** 王上 7:15、王下 25:17 与耶 52:21 记每根高十八肘；代下 3:15 记三十五肘。上面的开关把两种读法完整呈现。',
        en: '**Two textual figures for height:** 18 cubits in 1 Kgs 7:15 / Jer 52:21 vs. 35 cubits in 2 Chr 3:15. Both can be inspected using the toggle above.',
      },
      {
        zh: '**石榴的数目也不一致。** 王上 7:20 每柱顶两行二百个；代下 3:16 作一百个（耶 52:23 说每面露九十六个，总共一百个）。',
        en: '**Pomegranate count differs:** 200 in 1 Kgs 7:20 vs. 100 in 2 Chr 3:16.',
      },
      {
        zh: '铜柱中空壁厚（耶 52:21 另记「空心，铜厚四指」）、铸造工艺与柱身装饰细节。',
        en: 'Hollow cast bronze wall thickness (Jer 52:21 adds "hollow, four fingers thick") and casting seams.',
      },
    ],
    punchZh: '单根高十八肘、围十二肘——柱身直径约 **1.7 米**，连五肘柱顶高达 **10.2 米**。立在圣殿廊前左右，各自有名字：右边「雅斤」（立定），左边「波阿斯」（在力量中）。',
    punchEn: 'Each shaft **1.70 m thick** and **10.2 m high** including its 5-cubit lily-and-pomegranate capital — two free-standing bronze monuments named **Jachin** and **Boaz** before the porch.',
    compare: [
      { zh: '雅斤/波阿斯总高（18+5肘）', en: 'Pillar total height (18+5 cubits)', m: 10.235 },
      { zh: '一层普通住宅楼高', en: 'One storey of a building', m: 3.0 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'bronze-sea',
    zh: '铜海',
    en: 'The Molten Sea',
    ref: '1 Kings 7:23',
    refZh: '列王纪上 7:23',
    textZh: '他又铸一个铜海，样式是圆的，高五肘，径十肘，围三十肘。',
    textEn: 'He made the Sea of cast metal, circular in shape, ten cubits from rim to rim and five cubits high. It took a line of thirty cubits to measure around it.',
    dims: [
      { key: 'diameter', zh: '直径', en: 'Diameter',      cubits: 10, ref: '王上 7:23', refEn: '1 Kgs 7:23' },
      { key: 'height',   zh: '高',   en: 'Height',        cubits: 5,  ref: '王上 7:23', refEn: '1 Kgs 7:23' },
      { key: 'girth',    zh: '围',   en: 'Circumference', cubits: 30, ref: '王上 7:23', refEn: '1 Kgs 7:23' },
    ],
    kind: 'bronzeSea',
    walk: 'temple',
    counts: [
      { zh: '驮海的铜牛（四向各三）', en: 'Bronze oxen (3 per quarter)', n: 12, ref: '王上 7:25', refEn: '1 Kgs 7:25' },
      { zh: '边沿下野瓜（两行每肘十个）', en: 'Cast gourds under brim (2 rows)', n: 600, ref: '王上 7:24', refEn: '1 Kgs 7:24' },
      { zh: '容量（王上：罢特）', en: 'Capacity (1 Kings, baths)', n: 2000, ref: '王上 7:26', refEn: '1 Kgs 7:26' },
      { zh: '容量（代下：罢特）', en: 'Capacity (2 Chronicles, baths)', n: 3000, ref: '代下 4:5', refEn: '2 Chr 4:5' },
    ],
    unstated: [
      {
        zh: '**容量不一致。** 王上 7:26 记二千罢特；代下 4:5 记三千罢特。按十肘径五肘高半球或圆柱估算约合二千罢特（约 45,000 升）。',
        en: '**Capacity differs:** 2,000 baths in 1 Kgs 7:26 (~45,000 L) vs. 3,000 baths in 2 Chr 4:5. The bowl geometry matches the stated 10×5 cubits.',
      },
      {
        zh: '「一虎口厚」的铜壁（代下作「一掌厚」）、百合花外翻边沿的精确曲线，以及十二只铜牛的造型比例。',
        en: 'Wall thickness ("a handbreadth"), exact lily-brim flare curve, and sculpted ox anatomy.',
      },
      {
        zh: '水如何注入、祭司如何取水洗濯（代下 4:6 只说「海是为祭司沐浴用的」）。',
        en: 'Water supply plumbing and drainage details (2 Chr 4:6 states only its use for priestly washing).',
      },
    ],
    punchZh: '直径十肘、高五肘、围三十肘 —— 大约 **4.45 米宽、2.23 米高**，重二三十吨的巨型铜盆稳稳压在十二只面向东南西北的铜牛背上。',
    punchEn: '**4.45 m wide and 2.23 m high**, weighing tens of tonnes of cast bronze resting on **12 oxen** facing the four compass points — holding ~45,000 litres of water.',
    compare: [
      { zh: '标准轿车长度', en: 'Standard sedan (length)', m: 4.5 },
      { zh: '铜海直径（10 肘）', en: 'Molten Sea diameter (10 cubits)', m: 4.45 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'wheeled-lavers',
    zh: '铜盆座与洗濯盆',
    en: 'Ten Bronze Wheeled Stands & Lavers',
    ref: '1 Kings 7:27',
    refZh: '列王纪上 7:27',
    textZh: '他又用铜制造十个盆座，每座长四肘，宽四肘，高三肘。',
    textEn: 'He also made ten movable stands of bronze; each was four cubits long, four cubits wide and three cubits high.',
    dims: [
      { key: 'length',   zh: '盆座长', en: 'Stand length', cubits: 4,   ref: '王上 7:27', refEn: '1 Kgs 7:27' },
      { key: 'width',    zh: '盆座宽', en: 'Stand width',  cubits: 4,   ref: '王上 7:27', refEn: '1 Kgs 7:27' },
      { key: 'height',   zh: '盆座高', en: 'Stand height', cubits: 3,   ref: '王上 7:27', refEn: '1 Kgs 7:27' },
      { key: 'wheelH',   zh: '铜轮高', en: 'Wheel height', cubits: 1.5, ref: '王上 7:32', refEn: '1 Kgs 7:32' },
      { key: 'mouthH',   zh: '圆座口高', en: 'Collar height', cubits: 1,  ref: '王上 7:31', refEn: '1 Kgs 7:31' },
      { key: 'mouthD',   zh: '圆座口径', en: 'Collar diameter', cubits: 1.5, ref: '王上 7:31', refEn: '1 Kgs 7:31' },
      { key: 'laverD',   zh: '洗濯盆径', en: 'Laver diameter', cubits: 4,  ref: '王上 7:38', refEn: '1 Kgs 7:38' },
    ],
    kind: 'wheeledLaver',
    walk: 'temple',
    counts: [
      { zh: '圣殿院中盆座总数（南北各五）', en: 'Total stands (5 south, 5 north)', n: 10, ref: '王上 7:39', refEn: '1 Kgs 7:39' },
      { zh: '每座铜轮（如战车轮）', en: 'Chariot-style wheels per stand', n: 4, ref: '王上 7:30, 33', refEn: '1 Kgs 7:30, 33' },
      { zh: '每盆盛水量（罢特）', en: 'Water capacity (baths)', n: 40, ref: '王上 7:38', refEn: '1 Kgs 7:38' },
    ],
    variants: {
      key: 'laverView',
      zh: '陈列方式',
      en: 'Arrangement',
      options: [
        {
          id: 'single',
          zh: '单座特写 · 轮轴、心子浮雕与铜盆',
          en: 'Single stand · wheels, relief panels & laver',
          note: '细看 4×4×3 肘框座、心子上的狮子牛基路伯与垂花（7:29）、1.5 肘车轮及上置 4 肘洗濯盆。',
          noteEn: 'Close inspection of the 4×4×3 cubit chassis, lion/ox/cherub relief panels, 1.5-cubit chariot wheels, collar, and 4-cubit basin.',
        },
        {
          id: 'five-row',
          zh: '殿侧五座列队（共十座之一侧）',
          en: 'Row of five stands (one side of court)',
          note: '王上 7:39「将五个安在殿门右边，五个安在殿门左边」，呈现五座铜车列队的壮观尺度。',
          noteEn: 'Five of the ten wheeled stands lined up as placed along the north and south flanks of the Temple (1 Kgs 7:39).',
        },
      ],
    },
    unstated: [
      {
        zh: '盆深与剖面弧度（只给了四肘口径与四十罢特容量，约 900 升；对照会幕院子无尺寸记载的铜洗濯盆，出 30:18）。',
        en: 'Exact bowl depth and profile curve (only 4-cubit rim diameter and 40-bath ≈ 900 L volume are stated; contrast the unmeasured Tabernacle laver of Exod 30:18).',
      },
      {
        zh: '面板心子上狮子、牛、基路伯与棕树（王上 7:29, 36）的构图细节。',
        en: 'Exact artistic composition of the cast lions, oxen, cherubim, and palm reliefs on the panels.',
      },
    ],
    punchZh: '比一辆越野车还高的铸铜战车座：**1.78 米见方**，连上方四肘大铜盆共超过 **2.2 米高**——圣殿两侧各摆了五辆这样的移动水车（共十座），专门用来洗净献祭之物。',
    punchEn: 'Taller than an SUV: each wheeled bronze stand measures **1.78 m square** and rises past **2.2 m** with its 4-cubit basin — ten mobile 900-litre washing chariots flanking the temple.',
    compare: [
      { zh: '五座一列总长（示例间距）', en: 'Five-stand row span', m: 24 },
      { zh: '盆座宽度（4 肘）', en: 'Stand width (4 cubits)', m: 1.78 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'forest-house',
    zh: '利巴嫩林宫',
    en: 'House of the Forest of Lebanon',
    ref: '1 Kings 7:2',
    refZh: '列王纪上 7:2',
    textZh: '又建造利巴嫩林宫，长一百肘，宽五十肘，高三十肘，有香柏木柱三行，柱上有香柏木柁梁。',
    textEn: 'He built the Palace of the Forest of Lebanon a hundred cubits long, fifty wide and thirty high, with four rows of cedar pillars supporting trimmed cedar beams.',
    dims: [
      { key: 'length', zh: '宫长', en: 'Length', cubits: 100, ref: '王上 7:2', refEn: '1 Kgs 7:2' },
      { key: 'width',  zh: '宫宽', en: 'Width',  cubits: 50,  ref: '王上 7:2', refEn: '1 Kgs 7:2' },
      { key: 'height', zh: '宫高', en: 'Height', cubits: 30,  ref: '王上 7:2', refEn: '1 Kgs 7:2' },
    ],
    kind: 'forestHouse',
    walk: 'palace',
    counts: [
      { zh: '香柏木柱总数（每行 15 根）', en: 'Cedar pillars (15 per row, v. 3)', n: 45, ref: '王上 7:3', refEn: '1 Kgs 7:3' },
      { zh: '相对齐的方窗层数', en: 'Tiers of opposing square windows', n: 3, ref: '王上 7:4–5', refEn: '1 Kgs 7:4–5' },
    ],
    variants: {
      key: 'forestRows',
      zh: '柱行读法（王上 7:2–3）',
      en: 'Pillar row reading (1 Kgs 7:2–3)',
      options: [
        {
          id: '3-rows',
          zh: '三行柱 × 15 根 = 45 根（剖面显露）',
          en: '3 rows × 15 = 45 pillars (cutaway)',
          note: '七十士译本与王上 7:3「柱子共四十五根，每行十五根」完全一致；剖开外墙显示殿内如香柏树林般的柱列。',
          noteEn: 'Follows v. 3 ("45 pillars, 15 in a row") and LXX, with cutaway wall revealing the forest-like cedar colonnade.',
        },
        {
          id: '4-rows',
          zh: '四行柱 × 15 根 = 60 根（马所拉第 2 节）',
          en: '4 rows × 15 = 60 pillars (MT v. 2)',
          note: '马所拉文本第 2 节作「四行柱」，第 3 节则记共有 45 根上承横梁；这里展示四行六十柱并排的完整大楼。',
          noteEn: 'Follows MT v. 2 ("four rows of cedar pillars") in full exterior/clerestory framing (60 pillars total).',
        },
      ],
    },
    unstated: [
      {
        zh: '**三行还是四行柱子，第 2 节与第 3 节文本历来有讨论。** 马所拉文本 7:2 说四行、7:3 又说共四十五根每行十五根；七十士译本 7:2 作三行。模型两种都能切换。',
        en: '**3 rows vs. 4 rows:** MT v. 2 says "four rows" while v. 3 counts "45, 15 in a row" (LXX reads "three rows" in v. 2). Both configurations are inspectable above.',
      },
      {
        zh: '香柏木柱径、屋顶覆盖坡度、每层窗户具体开间尺寸（7:4–5 只记「三层对齐的方窗」），以及后来存放在此的三百面金盾（王上 10:17）。',
        en: 'Pillar diameter, exact roof pitch, window pane dimensions (only "three tiers facing each other"), and storage racks for Solomon’s gold shields (1 Kgs 10:17).',
      },
    ],
    punchZh: '长一百肘、宽五十肘、高三十肘——**44.5 × 22.3 × 13.4 米**，和会幕外院一样占地面积，却全部用香柏木竖起三层高柱殿堂，容积几乎是所罗门圣殿本身的 **4.2 倍**。',
    punchEn: '**44.5 × 22.3 × 13.4 m** — matching the entire Tabernacle Courtyard in footprint and soaring 13.4 m high on 45 cedar columns, over **4× the volume** of Solomon’s Temple itself.',
    compare: [
      { zh: '利巴嫩林宫（长，100 肘）', en: 'House of the Forest (length)', m: 44.5 },
      { zh: '所罗门圣殿（不含廊子长）', en: "Solomon's Temple (length)", m: 26.7 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'ezekiel-gate',
    zh: '以西结殿的门楼',
    en: "Ezekiel's Monumental Gatehouse",
    ref: 'Ezekiel 40:6',
    refZh: '以西结书 40:6',
    textZh: '他到了朝东的门，就上门的台阶，量门的这槛，宽一竿；那槛，宽一竿。又有卫房，每房长一竿，宽一竿；房与房中间有五肘……量这门，从这卫房顶的后檐到那卫房顶的后檐，宽二十五肘……量门廊，共五十肘。',
    textEn: 'Then he went to the east gate. He climbed its steps and measured the threshold of the gate; it was one rod deep. The alcoves for the guards were one rod long and one rod wide, and the projecting walls between the alcoves were five cubits thick... From the roof of one alcove to the roof of the opposite one it was twenty-five cubits... total length fifty cubits.',
    dims: [
      { key: 'length',    zh: '门楼总长',     en: 'Total gate length',       cubits: 50, ref: '结 40:15', refEn: 'Ezek 40:15' },
      { key: 'width',     zh: '门楼总宽',     en: 'Total gate width',        cubits: 25, ref: '结 40:13', refEn: 'Ezek 40:13' },
      { key: 'thresh',    zh: '外槛深（一竿）', en: 'Threshold depth (1 reed)', cubits: 6,  ref: '结 40:6',  refEn: 'Ezek 40:6' },
      { key: 'guardroom', zh: '卫房方正（一竿）', en: 'Guardroom size (1 reed)',  cubits: 6,  ref: '结 40:7',  refEn: 'Ezek 40:7' },
      { key: 'pier',      zh: '房壁厚',       en: 'Wall pier thickness',     cubits: 5,  ref: '结 40:7',  refEn: 'Ezek 40:7' },
      { key: 'passage',   zh: '门道净宽',     en: 'Central passage width',   cubits: 10, ref: '结 40:11', refEn: 'Ezek 40:11' },
      { key: 'porch',     zh: '内廊深',       en: 'Inner porch depth',       cubits: 8,  ref: '结 40:9',  refEn: 'Ezek 40:9' },
    ],
    kind: 'ezekielGate',
    walk: 'ezekiel',
    counts: [
      { zh: '两侧卫房（各三间）', en: 'Guardrooms (3 per side)', n: 6, ref: '结 40:7, 10', refEn: 'Ezek 40:7, 10' },
      { zh: '登门台阶（外门七级）', en: 'Outer approach steps', n: 7, ref: '结 40:22, 26', refEn: 'Ezek 40:22, 26' },
      { zh: '量度的苇子（每竿六长肘）', en: 'Measuring reed (long cubits)', n: 6, ref: '结 40:5', refEn: 'Ezek 40:5' },
    ],
    variants: {
      key: 'gateView',
      zh: '剖面展示',
      en: 'Architectural view',
      options: [
        {
          id: 'cutaway',
          zh: '水平与立面剖切 · 显露六间卫房与台阶',
          en: 'Cutaway · 6 guardrooms, piers & 7 steps',
          note: '掀起屋顶与前墙，显示 6+5+6+5+6+5+6+8+2=50 肘的精密轴向布局，以及门柱上的棕树雕刻（结 40:16）。',
          noteEn: 'Reveals the exact 50-cubit axial chain (threshold, 3+3 guardrooms with 5-cubit piers, inner threshold, porch) and palm pilasters.',
        },
        {
          id: 'full',
          zh: '完整宏伟石砌门楼（高度按比例估算）',
          en: 'Full stone gatehouse massing',
          note: '展示五十肘长、二十五肘宽门楼的整座石构体量与七级入口台阶。',
          noteEn: 'Full 50 × 25 cubit ashlar gatehouse massing with 7 outer approach steps.',
        },
      ],
    },
    unstated: [
      {
        zh: '**门楼的高度以西结书 40 章没有给。** 经文细致到卫房窗框和一肘界石，却未写屋顶多高（结 40:15 等处只记长宽，传统按约 20–24 肘或高塔估算）；这里取约 20 肘（展示比例）并明确标注。',
        en: '**Overall gatehouse height is not given in Ezekiel 40** despite exhaustive floor-plan measurements; rendered at ~20 cubits for architectural proportion.',
      },
      {
        zh: '**注意量度单位：** 结 40:5 明确指出这卷使用的是**「长肘」（一肘零一掌 ≈ 51.8 厘米）**。建议把上方滑块调至中间「圣所长肘」。',
        en: '**Cubit standard:** Ezek 40:5 explicitly specifies the **long cubit** ("a cubit and a handbreadth", ~51.8 cm) — slide the cubit control to the middle stop to inspect.',
      },
    ],
    punchZh: '只是一座门楼，就长五十肘、宽二十五肘——用长肘算足有 **25.9 × 13 米**，六间一竿见方的卫房对称夹着五肘厚的石墩，整段尺寸相加严丝合缝等于 **50 肘**。',
    punchEn: 'Just one **gatehouse** spans **50 × 25 long cubits (25.9 × 13.0 m)** — threshold, 3+3 guardrooms, 5-cubit piers, and porch sum cleanly to **6+6+5+6+5+6+6+8+2 = 50 cubits**.',
    compare: [
      { zh: '以西结门楼长（按 44.5cm / 长肘 25.9m）', en: 'Ezekiel gatehouse length', m: 22.25 },
      { zh: '以西结门楼宽（25 肘）', en: 'Ezekiel gatehouse width', m: 11.125 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'ezekiel-altar',
    zh: '以西结的祭坛',
    en: "Ezekiel's Stepped Altar",
    ref: 'Ezekiel 43:13',
    refZh: '以西结书 43:13',
    textZh: '以下按肘量祭坛（这肘是一肘零一掌）：底座高一肘，边宽一肘，四围起边高一掌；这是坛的座。从底座到下层台高二肘，边宽一肘。从小台到大台高四肘，边宽一肘。坛上的供台高四肘，供台的四角上都有角。',
    textEn: 'These are the measurements of the altar in long cubits, that cubit being a cubit and a handbreadth: Its gutter is a cubit deep and a cubit wide, with a rim of one span around the edge. And this is the height of the altar: From the gutter on the ground up to the lower ledge it is two cubits high and a cubit wide, and from the smaller ledge up to the larger ledge it is four cubits high and a cubit wide. The altar hearth is four cubits high, and four horns project upward from the hearth.',
    dims: [
      { key: 'baseW',   zh: '底座总宽（含一肘边槽）', en: 'Base footprint (incl. gutter)', cubits: 18, ref: '结 43:13–17', refEn: 'Ezek 43:13–17' },
      { key: 'lowerW',  zh: '下层台宽', en: 'Lower settle width', cubits: 16, ref: '结 43:14, 17', refEn: 'Ezek 43:14, 17' },
      { key: 'upperW',  zh: '大台（上层）宽', en: 'Upper settle width', cubits: 14, ref: '结 43:14, 17', refEn: 'Ezek 43:14, 17' },
      { key: 'hearthW', zh: '供台顶见方', en: 'Altar hearth square', cubits: 12, ref: '结 43:16', refEn: 'Ezek 43:16' },
      { key: 'height',  zh: '坛总高（1+2+4+4 肘）', en: 'Total height (1+2+4+4)', cubits: 11, ref: '结 43:13–15', refEn: 'Ezek 43:13–15' },
    ],
    kind: 'ezekielAltar',
    walk: 'ezekiel',
    counts: [
      { zh: '供台四角（结 43:15）', en: 'Hearth corner horns', n: 4, ref: '结 43:15', refEn: 'Ezek 43:15' },
    ],
    variants: {
      key: 'ezekAltarView',
      zh: '视图模式',
      en: 'View mode',
      options: [
        {
          id: 'full',
          zh: '四级阶梯全坛 · 东向台阶',
          en: 'Full 4-tier stepped altar · east steps',
          note: '从下而上 18→16→14→12 肘逐层收窄，总高 11 长肘，东侧设登坛台阶（结 43:17）。',
          noteEn: 'Complete stepped tiers narrowing 18→16→14→12 cubits over 11 long cubits height, with eastward steps (Ezek 43:17).',
        },
        {
          id: 'section',
          zh: '垂直半剖面 · 显露 1/2/4/4 肘高度与槽边',
          en: 'Vertical cross-section · 1/2/4/4 tiers',
          note: '切开坛体一半，清楚比对「一肘底座槽、二肘下台、四肘上台、四肘供台」的层高。',
          noteEn: 'Half-section highlighting the exact 1, 2, 4, and 4 cubit step heights and 1-cubit perimeter gutter.',
        },
      ],
    },
    unstated: [
      {
        zh: '**底座外宽按逐级内缩推算：** 结 43:16 给供台顶 12 肘见方、43:17 给上台 14 肘见方，再向下每级宽出一肘（每边退一肘、总宽加二肘），故下台 16 肘、底座连槽约 18 肘。',
        en: '**Lower widths derived outward:** Ezek 43:16 gives a 12-cubit hearth and 43:17 a 14-cubit ledge; each 1-cubit setback adds 2 cubits overall (16 cubits, 18 cubits at base).',
      },
      {
        zh: '坛上四角的高度、东向台阶的级数，以及使用**「长肘」（约 51.8 厘米，结 43:13）**——可在上方滑块切至中间档看长肘实尺（底宽约 9.3 米、高 5.7 米）。',
        en: 'Horn height, exact step count on the east flight, and note that Ezek 43:13 uses the **long cubit** (~51.8 cm) — try the middle slider stop.',
      },
    ],
    punchZh: '底部连槽约 **十八肘见方**，四级逐层收进成 **十二肘供台**，总高十一肘——用长肘算近 **9.3 米见方、5.7 米高**，东边有台阶上去（结 43:17），是先知书里唯一逐层开列高度的阶梯祭坛。',
    punchEn: 'Stepping inward from **18 to 12 long cubits square** and rising **11 cubits high** (~9.3 m wide × 5.7 m tall at the 51.8 cm long cubit), complete with perimeter gutter, horns, and east stairs.',
    compare: [
      { zh: '以西结祭坛底宽（18 肘）', en: "Ezekiel's altar base width", m: 8.01 },
      { zh: '以西结祭坛总高（11 肘）', en: "Ezekiel's altar height", m: 4.895 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'ezekiel-wheels',
    zh: '以西结书第一章水苍玉套轮异象',
    en: "Ezekiel's Chariot-Wheels & Expanse",
    ref: 'Ezekiel 1:16',
    refZh: '以西结书 1:16',
    textZh: '轮的形状和作法好像水苍玉。四轮都是一个样式，形状和作法好像轮中套轮。轮行走的时候，向四方都能直行，并不掉转。至于轮辋，高而可畏；四个轮辋周围满有眼睛。',
    textEn: 'This was the appearance and structure of the wheels: They sparkled like beryl, and all four looked alike. Each appeared to be made like a wheel intersecting a wheel. As they moved, they would go in any one of the four directions without turning as they went. Their rims were high and awesome, and all four rims were full of eyes all around.',
    dims: [],
    counts: [
      { zh: '四活物（结 10:20 明指基路伯）', en: 'Living creatures (cherubim, 10:20)', n: 4, ref: '结 1:5；10:20',    refEn: 'Ezek 1:5; 10:20' },
      { zh: '每个活物的脸面（四向）',       en: 'Faces per creature',                 n: 4, ref: '结 1:6, 10',       refEn: 'Ezek 1:6, 10' },
      { zh: '每个活物的翅膀（两上相连、两下遮体）', en: 'Wings per creature (2 up, 2 down)', n: 4, ref: '结 1:6, 11', refEn: 'Ezek 1:6, 11' },
      { zh: '水苍玉轮中套轮（活物旁各一）', en: 'Beryl double-wheels (Ophannim)',     n: 4, ref: '结 1:15–16；10:9', refEn: 'Ezek 1:15–16; 10:9' },
    ],
    kind: 'ezekielWheels',
    walk: 'ezekiel',
    assumedHeight: 9.0,
    variants: {
      key: 'wheelsView',
      zh: '异象视距',
      en: 'Vision view',
      options: [
        {
          id: 'full-vision',
          zh: '迦巴鲁河畔全异象 · 四套轮、水晶穹苍、蓝宝石座与虹光',
          en: 'Full vision · 4 double-wheels, crystal expanse, sapphire throne & rainbow',
          note: '完整呈现结 1:4–28 的空间层级：底层四组正交水苍玉套轮与四翼擦亮铜色活物，中间碳火电光（1:13），头顶可畏的水晶穹苍（1:22），其上蓝宝石宝座纯以**精金琥珀火光（chashmal）与七彩虹弧**（1:27–28）显荣，绝不描绘人形轮廓。',
          noteEn: 'Full spatial hierarchy of Ezek 1:4–28: four orthogonal beryl double-wheels, four-winged burnished-bronze cherubic forms, central coals of fire, crystal expanse (1:22), and sapphire throne crowned **strictly aniconically** with pure amber-fire radiance and overarching rainbow (1:27–28).',
        },
        {
          id: 'wheel-detail',
          zh: '单组正交「轮中套轮」特写 · 高而可畏的满眼轮辋',
          en: 'Single orthogonal wheel-within-a-wheel detail · eye-studded rims',
          note: '把一组高 3.6 米的正交双环套轮立在 **1.72 米**参照人物身旁，细看结 1:16–18 为何说「向四方都能直行，并不掉转」：东西向与南北向两道水苍玉高轮辋呈 90 度咬合，满镶晶莹眼饰。',
          noteEn: 'Sets one 3.6 m orthogonal double-wheel beside a **1.72 m** human scale figure to show how two 90-degree intersecting beryl rims move straight toward any of the four compass points without pivoting (Ezek 1:16–18).',
        },
      ],
    },
    unstated: [
      {
        zh: '以西结书第 1 章与第 40–48 章截然不同：第 1 章没有给出任何一个肘数，只说轮辋「高而可畏」（1:18），全靠「四活物、四脸、四翼、四套轮」的精确计数构建空间秩序。此处总高 9.0 米仅为展示参照高度，不是经文尺寸。',
        en: 'Unlike Ezekiel 40–48, chapter 1 gives zero cubit measurements — stating only that the rims were "high and awesome" (1:18) while specifying exact counts of fours. The 9.0 m total height is a display convention, not a scriptural measure.',
      },
      {
        zh: '「轮中套轮」（ophan b-tokh ha-ophan，结 1:16）古今主要有两种几何读法：正交九十度咬合双轮（无需转向即可向东南西北四方直行，1:17）或同平面同心套环。本模型采用最能解释「向四方直行并不掉转」的正交双环结构。',
        en: '"A wheel within a wheel" (1:16) has two classic geometric readings: two vertical rings intersecting at 90 degrees (explaining straight motion in all four directions without turning, 1:17) or concentric coplanar rings; orthogonal rings are built here.',
      },
      {
        zh: '结 1:26–28 连用三重谨慎限定语（「宝座的形像」「仿佛……的形状」「这就是雅伟荣耀的形像的样式」）。遵照申命记 4:12, 15 不可为雅伟造任何形像的诫命，蓝宝石宝座上方仅呈现纯粹的精金琥珀光辉（chashmal）与云中彩虹（1:27–28），绝不绘制任何人体轮廓。',
        en: 'Ezekiel 1:26–28 stacks three layers of reverent indirection ("likeness of a throne... appearance of the likeness of the glory of Yahweh"). Honoring Deut 4:12, 15, only pure amber-electrum fire radiance (chashmal) and the overarching rainbow crown the sapphire throne — with zero human figure or silhouette.',
      },
    ],
    punchZh: '以西结书 40 至 48 章量遍了每一道门槛的肘数，第 1 章在迦巴鲁河边却**一个尺寸也没给**——只记下**四活物、十六张脸、十六只翅膀、四组满布眼睛的水苍玉正交套轮**，托起水晶穹苍与蓝宝石座上的虹光荣耀。',
    punchEn: 'Where chapters 40–48 measure every threshold in cubits, chapter 1 gives **zero linear dimensions** — building awe through pure geometry and count: **4 four-winged forms, 4 eye-studded orthogonal beryl double-wheels**, a **crystal expanse**, and **aniconic amber-fire glory** beneath a **rainbow**.',
    compare: [
      { zh: '异象总展示高度（传统参照）', en: 'Full vision display height (assumed)', m: 9.0 },
      { zh: '单组水苍玉套轮高（特写参照）', en: 'Single beryl double-wheel (detail)', m: 3.6 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'second-temple',
    zh: '所罗巴伯重建的第二圣殿',
    en: "Zerubbabel's Second Temple",
    ref: 'Ezra 6:3',
    refZh: '以斯拉记 6:3',
    textZh: '古列王元年，他降旨论到耶路撒冷神的殿，要建造这殿为献祭之处，坚立殿的根基。殿高六十肘，宽六十肘，用三层大石头，一层新木头，经费要出于王库。',
    textEn: 'In the first year of King Cyrus, the king issued a decree concerning the temple of God in Jerusalem: Let the temple be rebuilt as a place to present sacrifices, and let its foundations be laid. It is to be sixty cubits high and sixty cubits wide, with three courses of large stones and one of timbers.',
    dims: [
      { key: 'decreeH',  zh: '古列诏书上限高',     en: 'Cyrus decree height',      cubits: 60, ref: '拉 6:3',   refEn: 'Ezra 6:3' },
      { key: 'decreeW',  zh: '古列诏书上限宽',     en: 'Cyrus decree width',       cubits: 60, ref: '拉 6:3',   refEn: 'Ezra 6:3' },
      { key: 'solomonL', zh: '对照：所罗门殿长',   en: "Compare: Solomon's length", cubits: 60, ref: '王上 6:2', refEn: '1 Kgs 6:2' },
      { key: 'solomonH', zh: '对照：所罗门殿高',   en: "Compare: Solomon's height", cubits: 30, ref: '王上 6:2', refEn: '1 Kgs 6:2' },
      { key: 'solomonW', zh: '对照：所罗门殿内宽', en: "Compare: Solomon's width",  cubits: 20, ref: '王上 6:2', refEn: '1 Kgs 6:2' },
    ],
    kind: 'secondTemple',
    counts: [
      { zh: '大石头层数（滚石筑墙）', en: 'Courses of great dressed stones', n: 3, ref: '拉 6:4；5:8', refEn: 'Ezra 6:4; 5:8' },
      { zh: '新木头层数（黎巴嫩香柏木）', en: 'Top course of new timber', n: 1, ref: '拉 6:4；3:7', refEn: 'Ezra 6:4; 3:7' },
    ],
    variants: {
      key: 'secondTempleView',
      zh: '历史对照',
      en: 'Historical comparison',
      options: [
        {
          id: 'cyrus-decree',
          zh: '古列王诏书规模（60×60 肘框 · 三石一木与燔祭坛）',
          en: 'Cyrus decree volume (60×60 c frame · 3 stone + 1 timber)',
          note: '呈现亚兰文诏书给定的高六十肘、宽六十肘皇家拨款外框（拉 6:3），墙体按「三层大石头、一层新木头」（6:4）砌筑，东院先立燔祭坛（拉 3:2–3）。',
          noteEn: 'Shows the 60×60 cubit Achaemenid decree envelope (Ezra 6:3), built in three courses of heavy ashlar stone topped by one course of new cedar timber (6:4), fronted by the rebuilt altar (3:2–3).',
        },
        {
          id: 'compare-solomon',
          zh: '并排对照所罗门旧殿金影（拉 3:12；该 2:3）',
          en: "Side-by-side ghost of Solomon's Temple (Ezra 3:12; Hag 2:3)",
          note: '把被掳归回之民的朴素石木圣殿与所罗门 **60×20×30 肘纯金包覆、立有雅斤波阿斯双铜柱** 的旧殿金影并置，直观理解为何见过旧殿的老年人放声痛哭（拉 3:12）。',
          noteEn: "Places Zerubbabel's austere stone-and-timber house beside a translucent golden ghost of Solomon's **60×20×30 cubit** gilded Temple and twin bronze pillars to visualize why elders wept in Ezra 3:12 and Haggai 2:3.",
        },
      ],
    },
    unstated: [
      {
        zh: '以斯拉记 6:3 的波斯宫廷亚兰文档案只写了「高六十肘、宽六十肘」，未写东西长度！学者普遍认为这是王库拨款的最高建筑外廓上限（含两侧附属库房），殿基仍沿用所罗门旧址六十肘长。模型用金色线框标出 60×60 肘诏书包络，不把未记细节伪装成施工详图。',
        en: 'The Aramaic archival decree in Ezra 6:3 specifies height (60 cubits) and width (60 cubits) without stating length — widely understood as a royal treasury maximum envelope (including side chambers) laid over the 60-cubit Solomonic foundation. A wireframe marks the 60×60 cubit decree boundary honestly.',
      },
      {
        zh: '「三层大石头、一层新木头」（拉 6:4）既可指抗震石墙每三皮巨石嵌一道香柏木拉结梁（对照王上 6:36 内院做法），也可指下部石墙与上部木构层；模型兼顾两种读法的可视层次。',
        en: '"Three courses of large stones and one of new timber" (Ezra 6:4; cf. 1 Kgs 6:36) may describe seismic cedar tie-beams set above every three courses of heavy stone or an upper timber storey; rendered clearly as three monumental stone tiers crowned by cedar.',
      },
      {
        zh: '拉 3:2–3 记载归回百姓在立殿根基前先在旧基上筑起祭坛献燔祭，但经文未记此坛具体肘数。',
        en: 'Ezra 3:2–3 records that the altar of burnt offering was rebuilt first upon its former site, without recording its exact post-exilic cubit dimensions.',
      },
    ],
    punchZh: '诏书允许的包络宽达 **六十肘、高六十肘（约 26.7 米）**，外廓甚至大过所罗门内殿；但当你切到并排金影就会明白拉 3:12 与该 2:3 的眼泪——没有满殿精金、没有两根十八肘铜柱、没有约柜，只有被掳归回之民在废墟上垒起的**三层大石与一层新木**。',
    punchEn: 'Cyrus’s decree permitted a **60 × 60 cubit (~26.7 m)** envelope, yet toggling Solomon’s golden ghost beside it explains the tears of Ezra 3:12 and Haggai 2:3: gone were the pure gold plates, Jachin and Boaz, and the Ark — replaced by austere **heavy stone and new timber**.',
    compare: [
      { zh: '古列诏书高与宽（60 肘）', en: 'Cyrus decree height & width (60 c)', m: 26.7 },
      { zh: '所罗门圣殿高（30 肘）', en: "Solomon's Temple height (30 c)", m: 13.35 },
      { zh: '所罗门圣殿内宽（20 肘）', en: "Solomon's Temple width (20 c)", m: 8.9 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'goliath',
    zh: '歌利亚的身高与铜甲',
    en: "Goliath's Stature & Bronze Armour",
    ref: '1 Samuel 17:4',
    refZh: '撒母耳记上 17:4',
    textZh: '从非利士营中出来一个讨战的人，名叫歌利亚，是迦特人，身高六肘零一虎口；头戴铜盔，身穿铠甲，甲重五千舍客勒；腿上有铜护膝，两肩之中背负铜戟；枪杆粗如织布的机轴，铁枪头重六百舍客勒。',
    textEn: 'A champion named Goliath, who was from Gath, came out of the Philistine camp. His height was six cubits and a span. He had a bronze helmet on his head and wore a coat of scale armor of bronze weighing five thousand shekels; on his legs he wore bronze greaves, and a bronze javelin was slung on his back. His spear shaft was like a weaver’s rod, and its iron point weighed six hundred shekels.',
    dims: [
      { key: 'height', zh: '身高（六肘零一虎口，马所拉）', en: 'Height (6 cubits + 1 span, MT)', cubits: 6.5, ref: '撒上 17:4', refEn: '1 Sam 17:4' },
    ],
    kind: 'goliath',
    counts: [
      { zh: '铜铠甲重（舍客勒，约 57 公斤）', en: 'Bronze scale armor (shekels, ~57 kg)', n: 5000, ref: '撒上 17:5', refEn: '1 Sam 17:5' },
      { zh: '铁枪头重（舍客勒，约 6.8 公斤）', en: 'Iron spearhead (shekels, ~6.8 kg)', n: 600, ref: '撒上 17:7', refEn: '1 Sam 17:7' },
    ],
    variants: {
      key: 'goliathText',
      zh: '古抄本身高记载',
      en: 'Textual height witness',
      options: [
        {
          id: 'mt-6-cubits',
          zh: '六肘零一虎口（约 2.89–3.0 米 · 马所拉抄本）',
          en: '6 cubits + 1 span (~2.89 m · Masoretic Text)',
          note: '传统和合本与英文译本所据的马所拉文本作「六肘零一虎口」（6.5 肘），并立在 1.72 米普通以色列士兵身旁对比。',
          noteEn: 'Masoretic Text reading ("six cubits and a span" = 6.5 cubits), shown beside a 1.72 m Israelite scale figure.',
        },
        {
          id: 'lxx-4-cubits',
          zh: '四肘零一虎口（约 2.0–2.1 米 · 死海古卷与七十士译本）',
          en: '4 cubits + 1 span (~2.00 m · Dead Sea Scrolls & LXX)',
          note: '昆兰 4QSam(a) 残卷、七十士译本及约瑟夫记作「四肘零一虎口」（4.5 肘），在古代身高平均约 1.65–1.7 米的年代仍高出一头半。',
          noteEn: 'Dead Sea Scrolls (4QSam(a)), Septuagint, and Josephus reading ("four cubits and a span" = 4.5 cubits), towering over a 1.72 m contemporary.',
        },
      ],
    },
    unstated: [
      {
        zh: '**两处古抄本身高读法不同：** 马所拉文本作 6 肘 1 虎口（约 2.89 米）；昆兰 4QSam(a) 古卷与七十士译本作 4 肘 1 虎口（约 2.00 米）。模型用上方开关同时呈现两种见证，并随肘长滑块实时重算。',
        en: '**Two ancient textual witnesses:** Masoretic Text reads 6 cubits + 1 span (6.5 cubits); 4QSam(a) / LXX / Josephus read 4 cubits + 1 span (4.5 cubits). Both scale dynamically with the cubit slider.',
      },
      {
        zh: '歌利亚肩宽、铜戟（kidon）具体形制与大盾牌尺寸（17:7 只提另有人拿大盾牌走在他前面）；人物一律短发（林前 11:14）。',
        en: 'Shoulder breadth, exact javelin/scimitar form (kidon), and shield dimensions; rendered with short hair (1 Cor 11:14).',
      },
    ],
    punchZh: '即使按普通肘算，**六肘零一虎口也有 2.89 米**——比旁边 **1.72 米**的普通人高出一米一七；就算按死海古卷四肘一虎口（2.0 米），背着 **57 公斤**铜鳞甲与 **6.8 公斤**铁枪头依然令人望而生畏。',
    punchEn: 'At **6.5 cubits (~2.89 m)** Goliath towers **1.17 m** over a **1.72 m** Israelite beside him — armoured in **~57 kg** of bronze scales and bearing a **~6.8 kg** iron spearhead.',
    compare: [
      { zh: '歌利亚（6.5 普通肘）', en: 'Goliath (6.5 common cubits)', m: 2.8925 },
      { zh: '死海古卷读法（4.5 普通肘）', en: '4QSam(a) / LXX reading (4.5 cubits)', m: 2.0025 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'dura-image',
    zh: '尼布甲尼撒的金像',
    en: "Nebuchadnezzar's Golden Image",
    ref: 'Daniel 3:1',
    refZh: '但以理书 3:1',
    textZh: '尼布甲尼撒王造了一个金像，高六十肘，宽六肘，立在巴比伦省杜拉平原。',
    textEn: 'King Nebuchadnezzar made an image of gold, sixty cubits high and six cubits wide, and set it up on the plain of Dura in the province of Babylon.',
    dims: [
      { key: 'height', zh: '像高', en: 'Height', cubits: 60, ref: '但 3:1', refEn: 'Dan 3:1' },
      { key: 'width',  zh: '像宽', en: 'Width',  cubits: 6,  ref: '但 3:1', refEn: 'Dan 3:1' },
    ],
    kind: 'duraImage',
    variants: {
      key: 'imageMode',
      zh: '像制与对照',
      en: 'Statue & comparison',
      options: [
        {
          id: 'dura-gold',
          zh: '杜拉平原金像（但 3:1 · 60 × 6 肘）',
          en: 'Plain of Dura gold colossus (Dan 3:1)',
          note: '高六十肘、宽六肘的 10:1 窄高巨像比例（可能包含底座在内）；短发皇家战像形制，不绘真神。',
          noteEn: '60 × 6 cubits (10:1 towering proportion, possibly including plinth) shown in short-haired royal monument form.',
        },
        {
          id: 'daniel2-metals',
          zh: '但 2:31–35 梦中四金属大像示意（非尺寸）',
          en: 'Daniel 2 multi-metal colossus comparison',
          note: '以同样宏伟尺度对照但 2 章大像：精金头、银胸臂、铜腹腰、铁腿、半铁半泥脚（但 2 章未记尺寸）。',
          noteEn: 'Visualizes Daniel 2:31–35 materials (gold head, silver chest, bronze belly, iron legs, iron-clay feet) at monumental scale.',
        },
      ],
    },
    unstated: [
      {
        zh: '**六十肘高、宽六肘是 10:1 比例**（一般人体宽约为高的 1/4 至 1/3），学者常推测六十肘包含高耸的基座或方尖碑形立柱；模型在基底设台阶座并以主体展示 60×6 肘的垂直视觉冲击。',
        en: '**10:1 height-to-width ratio** (human proportions are ~4:1) suggests either a slender stele-like figure or a tall plinth included inside the 60 cubits.',
      },
      {
        zh: '金像描绘的对象与姿态（经文只称「金像」，或为巴比伦王像/异教偶像）；本作品严守不以人像绘神的准则，人物一律短发端正。',
        en: 'Identity and pose of the figure are unstated; rendered cleanly as an ancient royal colossus with short hair.',
      },
    ],
    punchZh: '高六十肘、宽六肘——大约 **26.7 米高**，接近九层楼高，立在平坦的杜拉平原上。站在它脚下的 **1.72 米**真人，连底座台阶的一半都够不到。',
    punchEn: '**26.7 metres tall** and **2.67 metres wide** — rising like a nine-storey tower on the flat plain of Dura above a **1.72 m** human standing at its foot.',
    compare: [
      { zh: '尼布甲尼撒金像（60 肘）', en: 'Golden image (60 cubits)', m: 26.7 },
      { zh: '十层楼参考（约 30 米）', en: '10-storey building (~30 m)', m: 30 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'herod-sanctuary',
    zh: '希律圣殿主殿',
    en: "Herod's Temple Sanctuary",
    ref: 'John 2:20',
    refZh: '约翰福音 2:20',
    textZh: '犹太人便说：「这殿是四十六年才造成的，你三日内就再建立起来吗？」',
    textEn: 'The Jews replied, "It has taken forty-six years to build this temple, and you are going to raise it in three days?"',
    dims: [
      { key: 'facadeW', zh: '东向廊殿（乌兰）总宽', en: 'East facade (Ulam) width', cubits: 100, ref: '尺寸篇 4:6–7；战记 5.207', refEn: 'Middot 4:6–7; War 5.207' },
      { key: 'height',  zh: '主殿总高（含上层楼）', en: 'Total height (incl. upper room)', cubits: 100, ref: '尺寸篇 4:6；战记 5.207', refEn: 'Middot 4:6; War 5.207' },
      { key: 'length',  zh: '东西总纵深',           en: 'Total east-west length', cubits: 100, ref: '尺寸篇 4:7', refEn: 'Middot 4:7' },
      { key: 'rearW',   zh: '后段殿身宽（T 形窄腰）', en: 'Rear sanctuary width (T-stem)', cubits: 70, ref: '尺寸篇 4:7；战记 5.207', refEn: 'Middot 4:7; War 5.207' },
      { key: 'portalH', zh: '乌兰无扇东门高',       en: 'Open Ulam portal height', cubits: 40, ref: '尺寸篇 3:7', refEn: 'Middot 3:7' },
      { key: 'portalW', zh: '乌兰无扇东门宽',       en: 'Open Ulam portal width', cubits: 20, ref: '尺寸篇 3:7', refEn: 'Middot 3:7' },
      { key: 'hekhalL', zh: '圣所（外殿）内长',     en: 'Holy Place (Hekhal) length', cubits: 40, ref: '尺寸篇 4:7；战记 5.215', refEn: 'Middot 4:7; War 5.215' },
      { key: 'debirL',  zh: '至圣所内长宽',         en: 'Most Holy Place square', cubits: 20, ref: '尺寸篇 4:7；战记 5.219', refEn: 'Middot 4:7; War 5.219' },
    ],
    kind: 'herodSanctuary',
    walk: 'herod',
    counts: [
      { zh: '登乌兰前廊台阶', en: 'Steps up to the Ulam porch', n: 12, ref: '尺寸篇 3:6；战记 5.207', refEn: 'Middot 3:6; War 5.207' },
      { zh: '环殿三层旁屋总数', en: 'Three-tier side chambers', n: 38, ref: '尺寸篇 4:3', refEn: 'Middot 4:3' },
      { zh: '隔开至圣所的双层幔子', en: 'Twin sanctuary veils (1-cubit gap)', n: 2, ref: '尺寸篇 4:7；太 27:51', refEn: 'Middot 4:7; Matt 27:51' },
    ],
    variants: {
      key: 'herodSanctuaryView',
      zh: '展示视角',
      en: 'Architectural view',
      options: [
        {
          id: 'facade',
          zh: '百肘白石金板立面 · 十二级台阶与金葡萄树',
          en: '100-cubit white & gold T-facade · 12 steps & Golden Vine',
          note: '按《密西拿·尺寸篇》4:6–7 与约瑟夫《犹太战记》5.207–224 复原：雪白琢石镶巨幅金板，前廊展宽百肘如雄狮宽肩，门楣悬垂一人高的纯金葡萄串。',
          noteEn: 'Reconstructs the 100×100×100 cubit T-plan sanctuary of Mishnah Middot 4:6–7 and Josephus War 5.207–224: snow-white limestone, flashing gold plates, and the colossal Golden Vine.',
        },
        {
          id: 'cutaway',
          zh: '南翼剖面 · 圣所三器、双幔与空无一物的至圣所',
          en: 'South cutaway · Hekhal vessels, twin veil & empty Most Holy Place',
          note: '剖开南肩、三层旁屋与四十肘上层楼，显露四十肘圣所（灯台、陈设饼桌、香坛）、双层幔子，以及第二圣殿**空无约柜、唯露裸石根基石**的至圣所（战记 5.219）。',
          noteEn: 'Slices away the south shoulder, 3-story chambers, and 40-cubit upper room to reveal the Hekhal vessels, twin veil, and **completely empty Most Holy Place** holding only the bare Foundation Stone (War 5.219).',
        },
      ],
    },
    unstated: [
      {
        zh: '新约福音书（约 2:20；可 13:1；太 27:51）记载了四十六年工期、宏伟白石与殿里的幔子，但百肘 T 形平面与各段细数来自《密西拿·尺寸篇》（Middot）与亲历者约瑟夫《犹太战记》卷五，而非圣经经文直接开列。',
        en: 'The Gospels record the 46-year construction (John 2:20), massive stones (Mark 13:1), and sanctuary veil (Matt 27:51), while the 100×100×100 cubit T-plan figures come from Mishnah Middot and eyewitness Josephus (War 5.207–224) rather than biblical verse.',
      },
      {
        zh: '乌兰东门尺寸两处古籍略有差异：《密西拿·尺寸篇》3:7 记门高四十肘、宽二十肘；约瑟夫《犹太战记》5.208 记高七十肘、宽二十五肘。此处采用尺寸篇的 40×20 肘。',
        en: 'Ulam portal opening differs between sources: Mishnah Middot 3:7 gives 40×20 cubits, whereas Josephus War 5.208 gives 70×25 cubits; Middot 40×20 cubits is built here.',
      },
      {
        zh: '第二圣殿的至圣所内没有约柜（耶 3:16；约瑟夫《犹太战记》5.219 明言「里面空无一物」），仅有一块高出地面三指宽的天然磐石「根基石」（Even HaShetiyah，赎罪日篇 5:2）。模型严守历史与圣经实情，绝不虚添约柜或神像。',
        en: 'The Second-Temple Most Holy Place contained no Ark of the Covenant (Josephus War 5.219: "nothing at all lay within it"), only the bare bedrock Foundation Stone rising three fingerbreadths above the floor (Mishnah Yoma 5:2).',
      },
    ],
    punchZh: '百肘宽、百肘深、百肘高——相当于 **十五层现代高楼（约 45 至 52 米）** 的雪白巨石与纯金立面耸立在圣殿山巅，站在十二级台阶下的 **1.72 米**真人连基座一半都不到；而穿过重重金门与双幔之后，最核心的至圣所却是一间空荡荡的房间，只露出一块天然磐石。',
    punchEn: '**100 × 100 × 100 cubits** (~44.5 to 51.8 m — fifteen storeys tall) of snow-white stone and blazing gold plates towering above a **1.72 m** visitor, yet behind the monumental twin veil the Most Holy Place stood **completely empty** save for bare bedrock.',
    compare: [
      { zh: '巴黎凯旋门（高）', en: 'Arc de Triomphe, Paris (height)', m: 50 },
      { zh: '希律圣殿主殿高与宽（100 肘）', en: "Herod's Sanctuary height & width (100 c)", m: 44.5 },
      { zh: '所罗门圣殿高（30 肘）', en: "Solomon's Temple height (30 c)", m: 13.35 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'newjerusalem',
    zh: '新耶路撒冷',
    en: 'The New Jerusalem',
    ref: 'Revelation 21:16',
    refZh: '启示录 21:16',
    textZh: '城是四方的，长宽一样。天使用苇子量那城，共有四千里，长、宽、高都是一样。',
    textEn: 'The city was laid out like a square, as long as it was wide. He measured the city with the rod and found it to be 12,000 stadia in length, and as wide and high as it is long.',
    dims: [
      { key: 'length', zh: '长', en: 'Length', cubits: 12000, ref: '启 21:16', refEn: 'Rev 21:16' },
      { key: 'width',  zh: '宽', en: 'Width',  cubits: 12000, ref: '启 21:16', refEn: 'Rev 21:16' },
      { key: 'height', zh: '高', en: 'Height', cubits: 12000, ref: '启 21:16', refEn: 'Rev 21:16' },
    ],
    kind: 'cube',
    walk: 'new-jerusalem',
    counts: [
      { zh: '城门（四面各三门）', en: 'Pearl gates (3 per side)', n: 12, ref: '启 21:12–13, 21', refEn: 'Rev 21:12–13, 21' },
      { zh: '城墙根基宝石', en: 'Gem foundation courses', n: 12, ref: '启 21:14, 19–20', refEn: 'Rev 21:14, 19–20' },
      { zh: '城墙高（肘，约 64 米）', en: 'Wall measure (cubits, ~64 m)', n: 144, ref: '启 21:17', refEn: 'Rev 21:17' },
    ],
    unit: {
      zh: '斯他丁',
      en: 'stadia',
      m: 185,
      note: '希腊长度单位 στάδιον（和合本按里数译「四千里」），约 185 米。这一节用的不是肘。',
      noteEn: 'Greek στάδιον (stadion ≈ 185 m). Revelation 21:16 uses stadia rather than cubits.',
    },
    unstated: [
      {
        zh: '这是启示异象中的圣城（精金如同明净的玻璃，启 21:18），不是地上工程图纸；下方地球弧面、国际空间站轨道（408 公里）与珠峰（8.85 公里）仅作宏观尺度参照。',
        en: 'This is a prophetic vision ("pure gold, like clear glass", Rev 21:18), not an earthly blueprint; the Earth curvature slice, ISS orbit (408 km), and Everest marker beneath provide macro scale.',
      },
      {
        zh: '1.72 米的人类在 2,220 公里的尺幅下连一百万分之一像素都不到，因此此处改以地球曲率与近地轨道高度作参照。',
        en: 'A 1.72 m human would be sub-atomic at this 2,220 km scale, so planetary curvature and orbital altitude serve as the scale reference here.',
      },
    ],
    punchZh: '**2,220 公里** —— 长、宽，**和高**。这不是一座普通城市，是一个边长近半个地球半径的发光立方体：底面盖住半个洲，顶端伸到国际空间站轨道高度的五倍以上。',
    punchEn: '**2,220 kilometres** — long, wide, **and high**. A luminous cube spanning a third of Earth’s radius and towering more than **5× higher than the International Space Station**.',
    compare: [
      { zh: '新耶路撒冷边长（12,000 斯他丁）', en: 'New Jerusalem edge (12,000 stadia)', m: 2_220_000 },
      { zh: '上海到北京', en: 'London to Rome / Shanghai to Beijing', m: 1_064_000 },
      { zh: '国际空间站轨道高度', en: 'International Space Station orbit', m: 408_000 },
      { zh: '珠穆朗玛峰', en: 'Mount Everest', m: 8_849 },
    ],
  },
];

export const metres = (cubits: number, s: Structure, cubitM: number) =>
  cubits * (s.unit ? s.unit.m : cubitM);

/** The cards one walk shows, in the order they stand in this file. */
export const structuresFor = (walk: WalkHome) => STRUCTURES.filter((s) => s.walk === walk);

/** Cards no walk holds yet. Reachable from /plan.html under their biblical unit. */
export const homelessStructures = () => STRUCTURES.filter((s) => !s.walk);

const WALK_PAGE: Record<WalkHome, string> = {
  ark: '/ark.html',
  ezekiel: '/ezekiel.html',
  herod: '/herod.html',
  'new-jerusalem': '/new-jerusalem.html',
  palace: '/palace.html',
  tabernacle: '/tabernacle.html',
  temple: '/temple.html',
};

/** Where a reader goes to read one card. */
export const measuresHref = (id: string) => {
  const s = STRUCTURES.find((x) => x.id === id);
  return `${s?.walk ? WALK_PAGE[s.walk] : '/plan.html'}#measures=${id}`;
};
