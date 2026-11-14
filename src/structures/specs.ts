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
  | 'nehemiahWall'
  | 'carmelAltar'
  | 'shunammiteChamber'
  | 'shushanCourt'
  | 'paulShip'
  | 'rev4ThroneRoom'
  | 'sevenLampstands'
  | 'pentecostRoom'
  | 'canaanAllotment'
  | 'exodusRelief'
  | 'gerizimEbalRelief'
  | 'paulJourneysRelief'
  | 'asiaChurchesRelief'
  | 'jordanCrossing'
  | 'gideonDiorama'
  | 'arkToZion'
  | 'redSeaCrossing'
  | 'sinaiBounds'
  | 'zionAscent'
  | 'isaiahThrone'
  | 'ninevehRelief'
  | 'beatitudesHillside'
  | 'galileeBoat'
  | 'bethlehemManger'
  | 'paulLettersRelief'
  | 'dispersionRelief'
  | 'davidPreparations'
  | 'enclosedGarden'
  | 'pottersHouse'
  | 'mamreJordanRelief'
  | 'bethelPillar'
  | 'josephGranaries'
  | 'perpetualAltar'
  | 'actsCoastalRelief'
  | 'jobWhirlwind'
  | 'caesareaHall'
  | 'cube';

/** The walk-in pages. A card lives on the page where the thing it measures
 *  physically stands, which is the one rule that never needs maintaining: the
 *  ark of the covenant is in the most holy place, so its measurements are in
 *  the tabernacle walk, and nobody has to remember that they are. */
export type WalkHome = 'ark' | 'ezekiel' | 'herod' | 'nehemiah' | 'new-jerusalem' | 'palace' | 'tabernacle' | 'temple';

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
    id: 'nehemiah-wall',
    zh: '尼希米重修的耶路撒冷城墙',
    en: "Nehemiah's Rebuilt Wall of Jerusalem",
    ref: 'Nehemiah 3:8',
    refZh: '尼希米记 3:8',
    textZh: '其次是银匠哈海雅的儿子乌薛修造；其次是做香的哈拿尼雅修造。他们修坚耶路撒冷，直到宽墙。',
    textEn: 'Uzziel son of Harhaiah, one of the goldsmiths, repaired the next section; and Hananiah, one of the perfume-makers, made repairs next to that. They restored Jerusalem as far as the Broad Wall.',
    dims: [
      { key: 'valleyToDung', zh: '谷门到粪厂门城墙段长', en: 'Valley Gate to Dung Gate span', cubits: 1000, ref: '尼 3:13', refEn: 'Neh 3:13' },
    ],
    kind: 'nehemiahWall',
    walk: 'nehemiah',
    counts: [
      { zh: '尼希米记第三章点名的城门', en: 'Named gates in Nehemiah 3', n: 10, ref: '尼 3:1–32', refEn: 'Neh 3:1–32' },
      { zh: '点名的城楼（哈米亚楼、哈楠业楼、炉楼、凸出来的楼）', en: 'Named towers (Meah, Hananel, Furnaces, Projecting)', n: 4, ref: '尼 3:1, 11, 25–27', refEn: 'Neh 3:1, 11, 25–27' },
      { zh: '城墙完工所用日数', en: 'Days to finish the wall', n: 52, ref: '尼 6:15', refEn: 'Neh 6:15' },
      { zh: '在城墙上行走称谢的大队', en: 'Wall-top thanksgiving choirs', n: 2, ref: '尼 12:31', refEn: 'Neh 12:31' },
    ],
    variants: {
      key: 'nehemiahWallView',
      zh: '展示视角',
      en: 'Display view',
      options: [
        {
          id: 'broad-wall',
          zh: '宽墙 · 城门与城楼',
          en: 'Broad Wall · gate & tower',
          note: '呈现宽墙、凸出城楼与双扇木城门：外侧琢石面、城内粗石面与登墙石阶，门内安有包铁大木闩与守卫房（尼 3:3、6、13–15）。',
          noteEn: 'Shows a monumental Broad Wall, projecting tower, and twin-leaf gate: dressed outer ashlar, rough fieldstone inner face with wall stairs, timber crossbar, and guardroom (Neh 3:3, 6, 13–15).',
        },
        {
          id: 'gate-cutaway',
          zh: '剖面 · 碎石墙心与木横梁',
          en: 'Cutaway · rubble core & crossbars',
          note: '揭开右侧外墙面与女墙，露出两层石面之间的碎石大石填心与纵横木拉梁；城门一扇向内推开、木闩抽出卯槽，另一扇切开显出双层厚木板结构。',
          noteEn: 'Peels back the outer stone skin and parapet to expose the boulder-and-rubble core and timber crossbars; swings one gate leaf open with the bar drawn back, and slices the other leaf to reveal its two-ply plank core.',
        },
      ],
    },
    unstated: [
      {
        zh: '经文给出的唯一尺寸是谷门到粪厂门「修城墙一千肘」（尼 3:13，约 445 至 523 米），并未记载城墙的高度与厚度。模型截取约 24 肘宽、18 肘高的城门与宽墙局部，而非拉出四百多米的细长石带，以便在 1.72 米参照人像旁看清城防构造。',
        en: 'The sole explicit dimension in the text is the 1,000-cubit Valley-to-Dung Gate span (Neh 3:13; ~445–523 m); wall height and thickness are unstated. Rather than drawing a 445 m ribbon, the model cuts a ~24 × 16 × 18 cubit Broad Wall, gate, and tower section that reads clearly beside the 1.72 m human figure.',
      },
      {
        zh: '约 7 米（约 15.5 肘）的「宽墙」厚度来自考古实测：20 世纪 70 年代在耶路撒冷犹太区发掘出一段约 7 米厚的铁器时代晚期石墙（多归入希西家加固工程，参赛 22:10），学界普遍认为即尼 3:8 与 12:38 所提的「宽墙」。这一厚度属于考古比定，而非经文数字。',
        en: "The ~7 m (~15.5-cubit) Broad Wall thickness is archaeological, measured on the late Iron Age fortification excavated in Jerusalem's Jewish Quarter in the 1970s (widely linked to Hezekiah in Isa 22:10 and identified with the Broad Wall of Neh 3:8; 12:38), not a figure written in Scripture.",
      },
      {
        zh: '门洞宽高、城楼高度、守卫房布局均参照铁器时代及波斯时期城门考古形制；经文只记各段「立起门扇，安上门闩和横木」。两队城上称谢的诗班仅列于计数，不在模型中塑人像。',
        en: 'Gate dimensions, tower height, and guardroom layout follow Iron Age and Persian-period gate archaeology; the text records only setting up the doors, bolts, and bars. The two thanksgiving choirs are recorded in the counts rather than sculpted as figures.',
      },
    ],
    punchZh: '单是谷门到粪厂门这一段就达 **一千肘（约 445 米）**，整圈十座城门、四座城楼却只用 **五十二天** 修完（尼 6:15）。站在约 **7 米厚** 的宽墙切面旁，四个 **1.72 米** 的成年人首尾相接躺下，才刚刚够横跨墙顶的步道——难怪两大队称谢诗班能在城墙顶上并肩游行（尼 12:31、38）。',
    punchEn: '**1,000 cubits (~445 m)** between the Valley Gate and Dung Gate alone — yet all ten gates and the entire circuit were completed in **52 days** (Neh 6:15). Beside a **1.72 m** person, the **~7 m** Broad Wall is wide enough for four adults lying head-to-toe across the wall-walk where the two thanksgiving choirs marched (Neh 12:31, 38).',
    compare: [
      { zh: '谷门到粪厂门段长（1000 肘）', en: 'Valley Gate to Dung Gate span (1,000 c)', m: 445 },
      { zh: '宽墙城楼参照高（18 肘）', en: 'Tower reference height (18 c)', m: 8.01 },
      { zh: '宽墙厚度（考古实测约 7 米）', en: 'Broad Wall thickness (archaeological)', m: 7.0 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'carmel-altar',
    zh: '以利亚在迦密山筑的十二石坛',
    en: "Elijah's Twelve-Stone Altar on Mount Carmel",
    ref: '1 Kings 18:31',
    refZh: '列王纪上 18:31',
    textZh: '以利亚照雅各子孙支派的数目，取了十二块石头（雅伟的话曾临到雅各说：「你的名要叫以色列。」），用这些石头为雅伟的名筑一座坛，在坛的四围挖沟，可容谷种二细亚。',
    textEn: "Elijah took twelve stones, one for each of the tribes descended from Jacob, to whom the word of Yahweh had come, saying, 'Your name shall be Israel.' With the stones he built an altar in the name of Yahweh, and he dug a trench around it large enough to hold two seahs of seed.",
    dims: [],
    kind: 'carmelAltar',
    assumedHeight: 1.8,
    counts: [
      { zh: '筑坛的石头（照雅各子孙十二支派）', en: "Stones (for Jacob's twelve tribes)", n: 12, ref: '王上 18:31', refEn: '1 Kgs 18:31' },
      { zh: '坛四围水沟容量（谷种细亚数）', en: 'Perimeter trench capacity (seahs of seed)', n: 2, ref: '王上 18:32', refEn: '1 Kgs 18:32' },
      { zh: '每次盛满水的桶/缸数', en: 'Water jars filled per pouring', n: 4, ref: '王上 18:33', refEn: '1 Kgs 18:33' },
      { zh: '连倒三次的次数', en: 'Pourings over offering & wood', n: 3, ref: '王上 18:34', refEn: '1 Kgs 18:34' },
      { zh: '倾倒的总缸数（4 缸 × 3 次）', en: 'Total jars of water poured (4 × 3)', n: 12, ref: '王上 18:33–34', refEn: '1 Kgs 18:33–34' },
    ],
    variants: {
      key: 'carmelAltarView',
      zh: '叙事时刻',
      en: 'Narrative moment',
      options: [
        {
          id: 'water-filled',
          zh: '十二缸水倾注 · 沟里满了水',
          en: 'Water-filled trench · four jars',
          note: '外圈可逐一数出十二块天然大石，坛上摆好木柴与切块的燔祭公牛；四只双耳陶水缸连倒三次，水流在坛的四围，沟里也满了水（王上 18:33–35）。',
          noteEn: 'Twelve countable unhewn fieldstones ring the hearth beneath stacked wood and the cut bullock; four amphora jars poured three times soak the stones and fill the perimeter trench with glistening water (1 Kgs 18:33–35).',
        },
        {
          id: 'fire-from-heaven',
          zh: '天火降临 · 烧干沟水',
          en: 'Fire from heaven · consuming pillar',
          note: '「于是雅伟降下火来，烧尽燔祭、木柴、石头、尘土，又烧干沟里的水」（王上 18:38）。降下的火严守无像原则，仅以纯粹的琥珀金光火焰柱呈现。',
          noteEn: '"Then the fire of Yahweh fell and burned up the sacrifice, the wood, the stones and the soil, and also licked up the water in the trench" (1 Kgs 18:38) — rendered strictly aniconically as a pure amber-gold pillar of consuming fire.',
        },
      ],
    },
    unstated: [
      {
        zh: '经文只记石头与水缸的数目，未给祭坛长宽高。模型取 1.8 米为至燔祭顶部的参照高度（契合出 20:25–26 不凿石、不设台阶就能在坛旁献祭的尺度），并将十二块原石排成一圈，方便读者逐块点数。',
        en: 'Scripture specifies counts rather than linear dimensions. The 1.8 m reference height to the top of the offering fits an unhewn altar workable from ground level without steps (cf. Exod 20:25–26), with all twelve boulders arranged around the perimeter so each stone can be counted.',
      },
      {
        zh: '「可容谷种二细亚」（王上 18:32）有两种解释：一指水沟本身的容积约合二细亚（约 15 至 24 升）；二指水沟围出的地面相当于撒二细亚谷种的面积。模型中的环沟宽深仅为示意。',
        en: '"Large enough to hold two seahs of seed" (1 Kgs 18:32) is read either as trench volume (~15–24 litres) or as the ground area sown by two seahs of seed; the trench width and depth here are illustrative.',
      },
      {
        zh: '陶水缸的具体容量与雅伟之火的视觉形态经文均未描述；火焰柱完全采用纯粹几何光柱与火舌，绝不附加任何人形或受造物形像。',
        en: 'Jar capacity and the visual form of the fire are unstated; the consuming fire is built strictly from geometric light columns and flame cones with zero anthropomorphic form.',
      },
    ],
    punchZh: '在南北分裂的时代，以利亚偏偏取了 **十二块石头**——照雅各十二支派的数目筑一座高不过胸口（参照高 **1.8 米**）的野石坛；再用四只水缸连倒三次、共 **十二缸水** 灌满四围的沟，直到天火降下，连石头、尘土与满沟的水一并烧尽（王上 18:31–38）。',
    punchEn: 'In a divided kingdom, Elijah deliberately laid **12 fieldstones** for all twelve tribes of Jacob at chest-to-shoulder scale (**1.8 m** reference height), drenched them with **4 jars × 3 = 12 jarfuls** of water until the 2-seah trench overflowed, before fire fell and consumed offering, wood, stones, soil, and trench water alike (1 Kgs 18:31–38).',
    compare: [
      { zh: '会幕铜祭坛高（3 肘）', en: 'Tabernacle bronze altar height (3 c)', m: 1.34 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '迦密山石坛参照高度', en: 'Carmel altar reference height', m: 1.8 },
    ],
  },
  {
    id: 'shunammite-chamber',
    zh: '书念妇人为以利沙盖的墙上小楼',
    en: "The Shunammite's Upper Chamber for Elisha",
    ref: '2 Kings 4:10',
    refZh: '列王纪下 4:10',
    textZh: '我们可以为他在墙上盖一间小楼，在其中安放床榻、桌子、椅子、灯台。他来到我们这里，就可以住在其中。',
    textEn: "Let's make a small walled upper room and put in it a bed and a table, a chair and a lampstand for him. Then he can stay there whenever he comes to us.",
    dims: [],
    kind: 'shunammiteChamber',
    assumedHeight: 5.2,
    counts: [
      { zh: '楼内点名安放的家具器物（床榻、桌子、椅子、灯台）', en: 'Named furnishings inside (bed, table, chair, lampstand)', n: 4, ref: '王下 4:10', refEn: '2 Kgs 4:10' },
      { zh: '香柏木床榻', en: 'Bed (mittah)', n: 1, ref: '王下 4:10, 21', refEn: '2 Kgs 4:10, 21' },
      { zh: '木桌与木椅（各一）', en: 'Table and chair/stool (1 each, 2 pieces)', n: 2, ref: '王下 4:10', refEn: '2 Kgs 4:10' },
      { zh: '陶油灯台', en: 'Lampstand (menorah)', n: 1, ref: '王下 4:10', refEn: '2 Kgs 4:10' },
    ],
    variants: {
      key: 'shunammiteView',
      zh: '展示视角',
      en: 'Display view',
      options: [
        {
          id: 'cutaway',
          zh: '剖面 · 小楼四器与四室石屋',
          en: 'Cutaway · upper room & 4 furnishings',
          note: '切开上层小楼近侧墙与屋顶，只陈列经文点名的四样器物——香柏木床榻、木桌、木椅与陶油灯台；下层展示典型铁器时代以色列四室柱院石屋与外侧登顶石阶。',
          noteEn: 'Cuts open the upper guest room (aliyya) to show ONLY the four named items — cedar bed, wooden table, chair/stool, and terracotta oil lampstand — above an Israelite four-room pillared courtyard house with exterior stairs.',
        },
        {
          id: 'rooftop',
          zh: '合顶 · 泥砖墙与草席木梁顶',
          en: 'Closed · mud-brick & reed-beam roof',
          note: '四面泥砖灰泥墙砌齐，上铺圆木横梁、草席与压实泥顶（总高 5.2 米），侧面开木格小窗，平顶四围筑有护栏（申 22:8）。',
          noteEn: 'Closes the plastered mud-brick walls under round ceiling beams, woven reed/grass matting, and packed clay roofing (5.2 m total height), surrounded by a rooftop parapet (Deut 22:8).',
        },
      ],
    },
    unstated: [
      {
        zh: '经文只说「一间有墙的小楼」（עֲלִיַּת־קִיר，王下 4:10），未给长宽高。模型取总高 5.2 米（下层院屋高约 2.85 米，上层小楼高约 2.35 米）作为铁器时代两层民居的参照尺度。',
        en: 'Scripture calls it "a small walled upper chamber" (aliyyat-qir, 2 Kgs 4:10) without dimensions. The 5.2 m reference height (~2.85 m ground storey plus ~2.35 m upper room) reflects typical Iron Age two-level domestic construction.',
      },
      {
        zh: '下层的「四室柱院屋」及外侧露石阶梯依据铁器时代以色列民居考古复原（外梯使客旅出入不必穿过内室），经文并未描写书念妇人住宅的下层平面。',
        en: 'The pillared four-room courtyard house below and the exterior stone staircase follow Iron Age Israelite domestic archaeology (allowing a guest to come and go straight from the street); the ground-floor layout is not described in the text.',
      },
      {
        zh: '此处「灯台」希伯来文虽亦作 menorah（מְנוֹרָה），但在民居中指承托单盏捏嘴陶油灯的陶制或木制灯架，并非圣所七枝金灯台；床、桌、椅的具体木作造型亦按铁器时代日常家具复原。',
        en: 'Although Hebrew uses menorah for the lampstand, in a private home this denotes a household stand holding a single pinched-spout clay oil lamp, not the seven-branched sanctuary lampstand; furniture joinery follows Iron Age domestic finds.',
      },
    ],
    punchZh: '没有金银帷幔，只有经文逐一点名的 **四件日常家具：一张床、一张桌、一把椅、一座灯台**（王下 4:10）。正是这张安静摆在二楼泥砖小屋里的客床，后来承接了书念妇人死去的独生子，见证孩子在房里连打 **七次嚏**、重新睁开眼睛（王下 4:21、32–35）。',
    punchEn: 'No gold or tapestries — only **four everyday furnishings** named one by one: **1 bed, 1 table, 1 chair, 1 lampstand** (2 Kgs 4:10). Yet on that very bed inside this modest **5.2 m**-high rooftop room the Shunammite laid her dead son, and there the child sneezed seven times and opened his eyes (2 Kgs 4:21, 32–35).',
    compare: [
      { zh: '现代两层住宅（约）', en: 'Modern two-storey house (approx.)', m: 6.0 },
      { zh: '书念妇人院屋连小楼参照高', en: 'House & upper room reference height', m: 5.2 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'shushan-court',
    zh: '书珊城王宫御园的院子',
    en: 'The Palace Garden Court at Shushan (Susa)',
    ref: 'Esther 1:6',
    refZh: '以斯帖记 1:6',
    textZh: '有白色、绿色、蓝色的帐子，用细麻绳、紫色绳从银环内系在白玉石柱上；有金银的床榻摆在红、白、黄、黑玉石铺的石地上。',
    textEn: 'There were hangings of white, green and blue, fastened with cords of fine linen and purple to silver rings and pillars of marble; the couches were of gold and silver, on a pavement of porphyry, marble, mother-of-pearl and black stone.',
    dims: [],
    kind: 'shushanCourt',
    assumedHeight: 7.2,
    counts: [
      { zh: '展示帝国荣耀财富的日数', en: 'Days displaying imperial riches', n: 180, ref: '斯 1:4', refEn: 'Esth 1:4' },
      { zh: '王宫御园院子设摆筵席的日数', en: 'Days of court garden banquet', n: 7, ref: '斯 1:5', refEn: 'Esth 1:5' },
      { zh: '天篷帐子的颜色（白、绿/棉、蓝）', en: 'Canopy hanging colours (white, green/cotton, blue)', n: 3, ref: '斯 1:6', refEn: 'Esth 1:6' },
      { zh: '镶嵌铺地的名贵石材（红、白、云母/黄、黑）', en: 'Mosaic pavement stones (porphyry, alabaster, pearl, black marble)', n: 4, ref: '斯 1:6', refEn: 'Esth 1:6' },
    ],
    variants: {
      key: 'shushanView',
      zh: '展示视角',
      en: 'Display view',
      options: [
        {
          id: 'canopied',
          zh: '三色天篷张开 · 银环与紫细麻绳',
          en: 'Draped canopies · silver rings & cords',
          note: '两排凹槽白玉石柱上架起香柏木贴金横梁，白、绿（棉）、蓝三色帐篷借细麻绳与紫色绳紧系在石柱的银环上（斯 1:6）。',
          noteEn: 'Fluted white-marble columns with Persian double-volute capitals carry white, turquoise-cotton, and royal-blue canopies tensioned by fine-linen and purple cords to silver column rings (Esth 1:6).',
        },
        {
          id: 'pavement-detail',
          zh: '收起帐篷 · 四色镶嵌石地与各异金器',
          en: 'Pavement detail · 4-stone inlay & gold vessels',
          note: '将三色帐子收起束在石柱旁，完整显露红斑石、白玉、珍珠母、黑大理石四色拼花石地、金银卧榻，以及「器皿各有不同」的纯金酒器（斯 1:6–7）。',
          noteEn: 'Draws back the canopies to reveal the four-stone mosaic floor (porphyry, white marble, mother-of-pearl, black marble), gold and silver couches, and golden drinking vessels "diverse one from another" (Esth 1:6–7).',
        },
      ],
    },
    unstated: [
      {
        zh: '以斯帖记详列材质、颜色与日数，却未记一处长宽高尺寸。模型按高 7.2 米复原一座尺度亲人的御园凉亭柱廊（考古发掘的书珊百柱大殿石柱高达约 19 至 20 米，而斯 1:5 明言筵席设在「王宫御园的院子里」而非大殿内）。',
        en: "Esther itemises materials, colours, and durations without giving linear dimensions. The 7.2 m reference height models an intimate garden-court pavilion rather than Susa's ~19–20 m Apadana hall columns, matching Esth 1:5 (\"in the court of the garden of the king's palace\").",
      },
      {
        zh: '斯 1:6 四种铺地石材的希伯来文专名（bahat、shesh、dar、socheret）学界考证不一，通常比定为红斑石、雪花白玉、珍珠母（或黄玉）与黑石；「绿色」（karpas，波斯/梵语借词）原意为细棉布，模型取青绿细棉色调兼顾两种译法。',
        en: 'Exact identifications of the four Hebrew stone terms (bahat, shesh, dar, socheret) vary among scholars — rendered here as red porphyry, white marble/alabaster, mother-of-pearl, and black marble — while karpas ("green" / fine cotton) is tinted turquoise-green.',
      },
      {
        zh: '石柱根数、金银卧榻张数与金杯的具体器形经文均未规定；桌上六种金杯故意做成造型各异，以回应「用金器皿赐酒，器皿各有不同」（斯 1:7）。',
        en: 'Column count, couch count, and individual cup profiles are unstated; six distinct golden vessel silhouettes are modelled specifically to reflect "vessels of gold, the vessels being diverse one from another" (Esth 1:7).',
      },
    ],
    punchZh: '整整 **一百八十天** 的帝国炫富之后，又是 **七天** 御园豪宴：三色帐子、两色绳索、银环白玉柱、金银卧榻、四色拼花石地、**没有两只重样的金酒杯**（斯 1:4–7）。以斯帖记全卷未提一次神的名，开篇却把波斯王庭的排场细数到脚下每一块石头——为后文整场权势的忽然翻转埋下最强烈的反差。',
    punchEn: "After **180 days** of imperial display came **7 days** in the garden court: **3** canopy colours, **2** cord dyes, silver rings on marble pillars, gold and silver couches on a **4-stone** mosaic floor, and golden cups **no two alike** (Esth 1:4–7) — itemised down to the pavement before the silent providence of Esther overturns the empire's schemes.",
    compare: [
      { zh: '波斯波利斯大殿石柱（约）', en: 'Persepolis Apadana column (approx.)', m: 19.0 },
      { zh: '书珊御园柱廊参照高度', en: 'Shushan garden court reference height', m: 7.2 },
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
    id: 'upper-room-pentecost',
    zh: '五旬节的楼房',
    en: 'The Upper Room at Pentecost',
    ref: 'Acts 2:2',
    refZh: '使徒行传 2:2',
    textZh: '忽然，从天上有响声下来，好像一阵大风吹过，充满了他们所坐的屋子；',
    textEn: 'Suddenly a sound like the blowing of a violent wind came from heaven and filled the whole house where they were sitting.',
    dims: [],
    counts: [
      { zh: '聚会的人数', en: 'People gathered', n: 120, ref: '徒 1:15', refEn: 'Acts 1:15' },
      { zh: '使徒（马提亚补上）', en: 'Apostles (with Matthias)', n: 12, ref: '徒 1:26', refEn: 'Acts 1:26' },
    ],
    kind: 'pentecostRoom',
    assumedHeight: 6.2,
    variants: {
      key: 'roomView',
      zh: '展示方式',
      en: 'View',
      options: [
        {
          id: 'cutaway-flames',
          zh: '剖开墙与屋顶 · 看见楼房里分开的火舌',
          en: 'Walls and roof cut away · divided tongues of fire inside',
          note: '拿掉近侧的墙与大半屋顶，看见楼下的拱顶厅、楼上的拱廊与香柏木梁、墙边的陶油灯，以及「舌头如火焰显现出来，分开落在他们各人头上」（2:3）。不塑任何人物。',
          noteEn: 'Near wall and most of the roof removed to show the vaulted ground hall, the arcaded upper hall under cedar beams, the clay lamps, and the "tongues of fire that separated and came to rest on each of them" (2:3). No persons are modelled.',
        },
        {
          id: 'jerusalem-house',
          zh: '完整的两层院落房屋',
          en: 'Whole two-storey courtyard house',
          note: '按一世纪耶路撒冷石造房屋展示：外墙石阶通往楼上，平顶四围有栏杆（申 22:8），前有院子和水池口。',
          noteEn: 'A 1st-century Jerusalem stone house: an outer stair to the upper floor, a flat roof with a parapet (Deut 22:8), and a walled courtyard with a cistern mouth.',
        },
      ],
    },
    unstated: [
      {
        zh: '**房子多大，经文没有说。** 这里约 12 x 9 米、6.2 米高，只够说明一百二十人（1:15）需要多大的地方。',
        en: '**The size of the house is not stated.** About 12 x 9 m and 6.2 m high is shown only to suggest the room 120 people (1:15) would need.',
      },
      {
        zh: '2:1–2 只说他们「都聚集在一处」、风声「充满了他们所坐的屋子」，并没有明说就是 1:13 的那间楼房；把两处连在一起是传统读法。今天锡安山上的「最后晚餐厅」是十字军时期的建筑，比使徒行传晚了一千多年。',
        en: 'Acts 2:1–2 says only that they were all together in one place and the sound filled the house; it does not explicitly name the upper room of 1:13, which is a traditional link. The Cenacle on Mount Zion today is a Crusader-period building, over a thousand years later.',
      },
      {
        zh: '火舌的数目经文没有给，只说落在「他们各人头上」（2:3）。这里的十二道只是展示数目。',
        en: 'The number of tongues of fire is not given; they rested "on each of them" (2:3). The twelve shown are a display count.',
      },
    ],
    punchZh: '**一百二十个人**聚在一处，忽然有响声像大风吹过，充满了整间屋子，火焰般的舌头分开落在各人头上（2:2–3）。',
    punchEn: '**120 people** in one place, then a sound like a violent wind filling the whole house, and tongues of fire separating to rest on each of them (2:2–3).',
    compare: [
      { zh: '房屋展示高度（含栏杆）', en: 'House display height (to parapet)', m: 6.2 },
      { zh: '楼上房间净高（展示参照）', en: 'Upper room clear height (display)', m: 2.55 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'paul-ship',
    zh: '保罗所乘的亚历山大运粮船',
    en: "Paul's Alexandrian Grain Ship",
    ref: 'Acts 27:37',
    refZh: '使徒行传 27:37',
    textZh: '我们在船上的共有二百七十六个人。',
    textEn: 'Altogether there were 276 of us on board.',
    dims: [],
    counts: [
      { zh: '船上的人数', en: 'Souls on board', n: 276, ref: '徒 27:37', refEn: 'Acts 27:37' },
      { zh: '从船尾抛下的锚', en: 'Anchors dropped from the stern', n: 4, ref: '徒 27:29', refEn: 'Acts 27:29' },
      { zh: '第一次探深（寻）', en: 'First sounding (fathoms)', n: 20, ref: '徒 27:28', refEn: 'Acts 27:28' },
      { zh: '第二次探深（寻）', en: 'Second sounding (fathoms)', n: 15, ref: '徒 27:28', refEn: 'Acts 27:28' },
      { zh: '在亚得里亚海飘来飘去的夜数', en: 'Nights driven across the Adriatic', n: 14, ref: '徒 27:27', refEn: 'Acts 27:27' },
    ],
    kind: 'paulShip',
    assumedHeight: 14.0,
    variants: {
      key: 'shipView',
      zh: '展示时刻',
      en: 'Moment shown',
      options: [
        {
          id: 'hull-cutaway',
          zh: '第十四夜抛锚 · 半边船体剖开',
          en: 'Fourteenth night at anchor · half-hull cutaway',
          note: '切开右舷，露出船舱里的麦袋与陶瓮（27:38 才把麦子抛在海里）、兜住船底的缆索（27:17）、收上船的小船（27:16），以及从船尾抛下的四个锚（27:29）。',
          noteEn: 'Starboard half cut away to show the wheat sacks and jars still in the hold (not jettisoned until 27:38), the cables undergirding the hull (27:17), the boat hoisted aboard (27:16) and the four anchors let down from the stern (27:29).',
        },
        {
          id: 'melita-reef',
          zh: '米利大搁浅 · 船头胶住，船尾冲坏',
          en: 'Aground at Malta · bow stuck fast, stern broken',
          note: '砍断锚缆、把锚弃在海里，松开舵绳，拉起前帆（27:40）；遇着两水夹流的地方，船头胶住不动，船尾被浪的猛力冲坏（27:41）。',
          noteEn: 'Anchors cut away and left in the sea, rudder ropes untied, foresail hoisted (27:40); striking a sandbar where two seas met, the bow stuck fast and the stern was broken by the pounding surf (27:41).',
        },
      ],
    },
    unstated: [
      {
        zh: '**船有多长，经文一个数字都没有给。** 这里的 24 米甲板长、14 米桅顶只是展示用的参照高度。古代亚历山大运粮船大小悬殊：琉善笔下的「伊西斯号」约 55 米，约瑟夫说他坐过的船载了约六百人。能载 276 人的船，实际很可能比这个模型大。',
        en: '**Acts gives no length, beam or tonnage.** The 24 m deck and 14 m masthead are display conventions. Alexandrian grain ships varied widely: Lucian describes the Isis at about 55 m, and Josephus sailed on one carrying about 600; a ship holding 276 may well have been larger than this model.',
      },
      {
        zh: '「用缆索捆绑船底」（27:17）的具体做法有争议：横向兜住船身，还是纵向从船头拉到船尾，古代文献都有。这里按横向兜底处理。',
        en: 'How the ship was undergirded (27:17) is debated: cables passed under the hull crosswise, or rigged lengthwise from bow to stern. Crosswise frapping is shown.',
      },
      {
        zh: '一寻约 1.85 米，二十寻约 37 米，十五寻约 28 米。模型里的海水深度大幅压缩，不按比例。',
        en: 'A fathom is about 1.85 m, so the soundings were about 37 m and 28 m. The sea in the model is heavily compressed, not to scale.',
      },
      {
        zh: '搁浅的确切地点经文只说是「两水夹流的地方」（27:41），马耳他的圣保罗湾是传统说法。这条船的船名和船首标记都没有记载；28:11 的「丢斯古利」是另一条船。',
        en: "The grounding site is described only as a place where two seas met (27:41); St Paul's Bay on Malta is the traditional identification. This ship's name and figurehead are not recorded; the Twin Brothers of 28:11 belong to a different ship.",
      },
    ],
    punchZh: '**二百七十六个人**，十四夜不见日头星辰，四个锚抛在船尾等天亮……船头胶住，船尾冲坏，结果「众人都得了救，上了岸」（27:44）。',
    punchEn: '**276 people**, fourteen nights without sun or stars, four anchors out astern waiting for daylight; then the bow stuck and the stern broke, "and in this way everyone reached land safely" (27:44).',
    compare: [
      { zh: '模型甲板长（展示参照）', en: 'Model deck length (display)', m: 24.0 },
      { zh: '模型桅顶高（展示参照）', en: 'Model masthead height (display)', m: 14.0 },
      { zh: '第一次探深：二十寻', en: 'First sounding: 20 fathoms', m: 37.0 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'seven-lampstands',
    zh: '七个金灯台',
    en: 'The Seven Golden Lampstands',
    ref: 'Revelation 1:12',
    refZh: '启示录 1:12',
    textZh: '我转过身来，要看是谁发声与我说话；既转过来，就看见七个金灯台。',
    textEn: 'I turned around to see the voice that was speaking to me. And when I turned I saw seven golden lampstands.',
    dims: [],
    counts: [
      { zh: '金灯台（就是七个教会）', en: 'Golden lampstands (the seven churches)', n: 7, ref: '启 1:12, 20', refEn: 'Rev 1:12, 20' },
      { zh: '星（就是七个教会的使者）', en: 'Stars (the messengers of the seven churches)', n: 7, ref: '启 1:16, 20', refEn: 'Rev 1:16, 20' },
    ],
    kind: 'sevenLampstands',
    assumedHeight: 3.0,
    variants: {
      key: 'lampstandView',
      zh: '展示方式',
      en: 'View',
      options: [
        {
          id: 'seven-churches',
          zh: '七灯台围成弧形 · 当中只有光',
          en: 'Seven lampstands in an arc · only light in their midst',
          note: '七个各自独立的金灯台排成弧形，当中「面貌如同烈日放光」（1:16），所以这里看见的是光，不是脸；上方是七颗星。',
          noteEn: 'Seven separate golden lampstands in an arc; in their midst a face "like the sun shining in all its brilliance" (1:16), so what is shown is the light, not a face. Seven stars hang above.',
        },
        {
          id: 'compare-menorah',
          zh: '对照出埃及记 25 章的灯台',
          en: 'Beside the menorah of Exodus 25',
          note: '同一平台上，左边是启示录的七个独立灯台，右边是出埃及记 25:31–37 那一个有七盏灯的金灯台。',
          noteEn: "On one platform: Revelation's seven separate lampstands on the left, and the single seven-lamp menorah of Exodus 25:31–37 on the right.",
        },
      ],
    },
    unstated: [
      {
        zh: '**灯台的高度与样式，经文都没有说。** 这里每座约 1.5 米、单盏灯，3.0 米是星顶的展示参照高度。灯台排成弧形也是展示安排，经文只说那一位在「灯台中间」（1:13）。',
        en: '**Neither height nor form of the lampstands is given.** Each is shown about 1.5 m tall with a single lamp; 3.0 m is a display height for the stars. The arc is a display choice; the text says only "among the lampstands" (1:13).',
      },
      {
        zh: '1:13–16 描写了「一位好像人子」的衣着、头发、眼目、脚和口中的利剑。模型一概不塑人形，只用光来表示。',
        en: 'Revelation 1:13–16 describes one like a son of man, his robe, hair, eyes, feet and the sharp sword from his mouth. None of this is sculpted; the model shows only light.',
      },
    ],
    punchZh: '出埃及记 25 章是**一个**灯台上点七盏灯；启示录 1 章是**七个**灯台，各是一个教会，各自可以「从原处挪去」（2:5）。',
    punchEn: 'Exodus 25 is **one** lampstand bearing seven lamps; Revelation 1 is **seven** lampstands, each a church, each of which can be "removed from its place" (2:5).',
    compare: [
      { zh: '每座灯台（展示参照）', en: 'Each lampstand (display)', m: 1.5 },
      { zh: '会幕金灯台（传统估算）', en: 'Tabernacle menorah (traditional)', m: 1.5 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'rev4-throne-room',
    zh: '启示录第四章天上的宝座',
    en: 'The Throne Room of Revelation 4',
    ref: 'Revelation 4:4',
    refZh: '启示录 4:4',
    textZh: '宝座的周围又有二十四个座位，其上坐着二十四位长老，身穿白衣，头上戴着金冠冕。',
    textEn: 'Surrounding the throne were twenty-four other thrones, and seated on them were twenty-four elders. They were dressed in white and had crowns of gold on their heads.',
    dims: [],
    counts: [
      { zh: '宝座周围的座位', en: 'Thrones around the throne', n: 24, ref: '启 4:4', refEn: 'Rev 4:4' },
      { zh: '金冠冕', en: 'Crowns of gold', n: 24, ref: '启 4:4, 10', refEn: 'Rev 4:4, 10' },
      { zh: '宝座前点着的火灯', en: 'Lamps of fire before the throne', n: 7, ref: '启 4:5', refEn: 'Rev 4:5' },
      { zh: '四活物', en: 'Living creatures', n: 4, ref: '启 4:6', refEn: 'Rev 4:6' },
      { zh: '每个活物的翅膀', en: 'Wings per creature', n: 6, ref: '启 4:8', refEn: 'Rev 4:8' },
    ],
    kind: 'rev4ThroneRoom',
    assumedHeight: 8.5,
    variants: {
      key: 'throneView',
      zh: '展示范围',
      en: 'View',
      options: [
        {
          id: 'full-council',
          zh: '全景 · 二十四座位、四活物、七灯与玻璃海',
          en: 'Full council · 24 thrones, 4 living creatures, 7 lamps, sea of glass',
          note: '中央宝座只用碧玉与红宝石的光彩呈现（4:3），座上不放任何人形；二十四个白色座位上只放金冠冕，不塑长老的身形；四活物以六翼与满身眼睛的徽记柱表示。',
          noteEn: 'The central throne is shown only by the radiance of jasper and carnelian (4:3), with no figure upon it; the 24 white seats hold only their golden crowns, with no sculpted elders; the living creatures are six-winged emblem pillars full of eyes.',
        },
        {
          id: 'throne-and-lamps',
          zh: '近景 · 宝座、绿宝石虹、七灯与玻璃海',
          en: 'Close view · throne, emerald rainbow, 7 lamps, sea of glass',
          note: '只留宝座、围着宝座的绿宝石色的虹（4:3）、宝座前的七盏火灯（4:5）和宝座前如同水晶的玻璃海（4:6）。',
          noteEn: 'Only the throne, the emerald rainbow encircling it (4:3), the seven lamps of fire before it (4:5) and the crystal-clear sea of glass (4:6).',
        },
      ],
    },
    unstated: [
      {
        zh: '**整章没有一个尺寸。** 8.5 米只是虹顶的展示参照高度。约翰描述坐在宝座上的，只说「看那坐着的，好像碧玉和红宝石」（4:3），没有描述形貌；模型据此只用宝石的光，宝座上不放任何形象。',
        en: '**The chapter gives no measurement at all.** 8.5 m is a display height for the top of the rainbow. John describes the one seated only as having "the appearance of jasper and ruby" (4:3), with no form described, so the model shows only the light of the stones and nothing on the throne.',
      },
      {
        zh: '「有虹围着宝座，好像绿宝石」（4:3）：虹是竖立如拱，还是平放如环，经文没有说。这里两者都画：竖立的翠绿光环，加上宝座脚下的一道平环。',
        en: 'Whether the emerald rainbow "encircling" the throne (4:3) stands upright or lies flat is not said; both are drawn, an upright emerald ring and a flat ring at the foot of the throne.',
      },
      {
        zh: '四活物「头一个像狮子，第二个像牛犊，第三个脸面像人，第四个像飞鹰」（4:7），模型只用简化徽记表示，不塑形体。二十四个座位排成圆环、玻璃海的大小与位置，都是展示安排。',
        en: 'The living creatures are like a lion, an ox, one with a face like a man, and a flying eagle (4:7); here they are reduced to emblems, not bodies. The circular ring of 24 seats and the size and placement of the sea of glass are display choices.',
      },
    ],
    punchZh: '**二十四个座位、二十四顶金冠冕、七盏火灯、四活物各有六个翅膀** —— 全是数出来的，没有一个是量出来的。宝座上只有光。',
    punchEn: '**24 thrones, 24 golden crowns, 7 lamps of fire, 4 living creatures with 6 wings each**: everything is counted and nothing is measured. On the throne there is only light.',
    compare: [
      { zh: '虹顶展示高度（参照）', en: 'Rainbow top display height (assumed)', m: 8.5 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'exodus-sinai-relief',
    zh: '出埃及与西乃旷野地形沙盘',
    en: 'Exodus & Wilderness Relief Sandbox',
    ref: 'Numbers 33:2',
    refZh: '民数记 33:2',
    textZh: '摩西遵着雅伟的吩咐记载他们所行的路程，其路程乃是这样：',
    textEn: 'Moses wrote their goings out according to their journeys by the commandment of Yahweh: and these are their journeys according to their goings out.',
    dims: [
      { key: 'ew-span', zh: '东西跨度（兰塞至以旬迦别）', en: 'East–west span (Rameses to Ezion-geber)', cubits: 280, ref: '出 12:37; 民 33:35', refEn: 'Exod 12:37; Num 33:35' },
      { key: 'ns-span', zh: '南北跨度（歌珊至西乃南端）', en: 'North–south span (Goshen to Sinai)', cubits: 360, ref: '出 19:1; 民 33:15', refEn: 'Exod 19:1; Num 33:15' },
    ],
    counts: [
      { zh: '民数记三十三章所记安营站数', en: 'Encampment stages listed in Num 33', n: 42, ref: '民 33:5–49', refEn: 'Num 33:5–49' },
      { zh: '以琳的水泉', en: 'Springs of water at Elim', n: 12, ref: '出 15:27', refEn: 'Exod 15:27' },
      { zh: '以琳的棕树', en: 'Palm trees at Elim', n: 70, ref: '出 15:27', refEn: 'Exod 15:27' },
    ],
    kind: 'exodusRelief',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '区域地形跨度按经纬度折算公里；垂直高程放大以便辨识山谷与海沟。',
      noteEn: 'Regional span in kilometres from georeferenced lat/lon; vertical relief exaggerated for legibility.',
    },
    variants: {
      key: 'exodusView',
      zh: '展示重点',
      en: 'Focus',
      options: [
        {
          id: 'full-itinerary',
          zh: '兰塞至摩押平原全程 · 未考证站段虚线标示',
          en: 'Full Rameses-to-Moab itinerary · unlocated stages dashed',
          note: '从尼罗河三角洲东缘兰塞出发，绕行西乃半岛南端，穿过亚拉巴谷绕行以东、摩押至耶利哥对面；经文有站名而今址尚无定论的中途旷野段，用虚线连贯，不强行伪造准确坐标。',
          noteEn: 'Runs from Rameses on the eastern Nile Delta around southern Sinai and up through the Arabah east of Edom and Moab to opposite Jericho; unlocated wilderness stations are bridged with an honest dashed track.',
        },
        {
          id: 'red-sea-sinai',
          zh: '过红海与西乃山密云烈火 · 山下设界限',
          en: 'Red Sea crossing & Sinai in cloud and fire · boundary at the foot',
          note: '聚焦苏伊士海湾过红海（左右分开的水墙）与西乃山山顶的密云、火柱，以及山下绕行警戒百姓不可擅近的界限（出 19:12–18）。',
          noteEn: 'Focuses on the Red Sea crossing (parted water corridor) and Mount Sinai crowned in cloud and fire with the boundary ring fenced around its foot (Exod 19:12–18).',
        },
      ],
    },
    unstated: [
      {
        zh: '比哈希录与过海的确切地点、西乃山地多座传统候选主峰中哪一座是何烈山，以及民数记三十三章约半数旷野小站（如利萨、基希拉他、哈拉大等）的今日坐标，经文未留足够地形数据来定案，沙盘只实线标出有历史地理依据的锚点，其余以虚线示意。',
        en: 'The exact site of Pi-hahiroth and the sea crossing, which granite massif is Horeb/Sinai, and roughly half the wilderness stations in Numbers 33 (such as Rissah, Kehelathah and Haradah) remain debated; only grounded anchors are plotted solid, with debated spans dashed.',
      },
      {
        zh: '沙盘垂直海拔与海墙、云火高度均为立体辨识而放大，非等比地形切片；依循经文严谨不塑任何神形，雅伟的显现仅以密云、火与界限表达（出 19:16–18）。',
        en: 'Vertical elevation, parted sea walls and cloud/fire plumes are scaled for three-dimensional clarity. In keeping with Scripture, no bodily image is made of Yahweh — only thick cloud, fire and the foot-of-mountain boundary.',
      },
    ],
    punchZh: '**四十二站旷野行记**不再只是地图上一条细线，而是尼罗河沃土、分岔红海、高原断崖与约但河东荒原之间的实景行军沙盘。',
    punchEn: '**Forty-two recorded encampments** lifted off a flat map into a carved relief spanning the Nile delta, the forked Red Sea gulfs, Sinai highlands and the Transjordan plateau.',
    compare: [
      { zh: '尼罗河口至西乃南端跨度', en: 'Delta to southern Sinai span', m: 360_000 },
      { zh: '兰塞至以旬迦别东西跨度', en: 'Rameses to Ezion-geber span', m: 280_000 },
    ],
  },
  {
    id: 'gerizim-ebal-valley',
    zh: '基利心山与以巴路山谷地沙盘',
    en: 'Mount Gerizim & Mount Ebal Relief',
    ref: 'Deuteronomy 27:12',
    refZh: '申命记 27:12',
    textZh: '你们过了约但河，西缅、利未、犹大、以萨迦、约瑟、便雅悯六个支派的人都要站在基利心山上为百姓祝福。',
    textEn: 'These shall stand upon mount Gerizim to bless the people, when ye are come over Jordan; Simeon, and Levi, and Judah, and Issachar, and Joseph, and Benjamin:',
    dims: [
      { key: 'ebal-h', zh: '以巴路山海拔（北峰）', en: 'Mount Ebal elevation (north)', cubits: 940, ref: '申 27:13; 书 8:30', refEn: 'Deut 27:13; Josh 8:30' },
      { key: 'gerizim-h', zh: '基利心山海拔（南峰）', en: 'Mount Gerizim elevation (south)', cubits: 881, ref: '申 27:12; 书 8:33', refEn: 'Deut 27:12; Josh 8:33' },
      { key: 'pass-w', zh: '两山之间示剑隘口谷底宽', en: 'Shechem valley floor width between slopes', cubits: 500, ref: '书 8:33', refEn: 'Josh 8:33' },
    ],
    counts: [
      { zh: '站基利心山祝福的支派', en: 'Tribes facing Gerizim to bless', n: 6, ref: '申 27:12', refEn: 'Deut 27:12' },
      { zh: '站以巴路山宣告咒诅的支派', en: 'Tribes facing Ebal for the curse', n: 6, ref: '申 27:13', refEn: 'Deut 27:13' },
    ],
    kind: 'gerizimEbalRelief',
    unit: {
      zh: '米',
      en: 'm',
      m: 1,
      note: '示剑隘口实测海拔高度与谷宽，按米标示。',
      noteEn: 'Measured elevations and pass width at the Shechem saddle, in metres.',
    },
    variants: {
      key: 'shechemView',
      zh: '场景视图',
      en: 'Scene view',
      options: [
        {
          id: 'covenant-assembly',
          zh: '两山对立宣读祝福与咒诅 · 约柜与利未人在谷中',
          en: 'Six tribes on each mount · Ark and Levites in the valley',
          note: '南面青翠的基利心山坡列六支派、北面较陡峭裸露的以巴路山坡列六支派，金色约柜与抬柜的利未祭司立在两山夹峙的天然露天剧场谷底（书 8:33）。',
          noteEn: 'Six tribes ranged along the gentler southern slope of Gerizim and six across the steeper northern slope of Ebal, with the Ark and Levites in the narrow natural amphitheatre between (Josh 8:33).',
        },
        {
          id: 'ebal-altar',
          zh: '以巴路山未凿整石祭坛与墁灰立石',
          en: 'Uncut fieldstone altar & plastered law stones on Ebal',
          note: '凸出以巴路山坡上不可动铁器的未凿整石祭坛（申 27:5–6；书 8:30–31），及旁边抹上石灰、写明律法的立石（申 27:2–4, 8）。',
          noteEn: 'Highlights the altar of unhewn whole stones built without iron tool on Mount Ebal (Deut 27:5–6; Josh 8:30–31), beside the great stones plastered with lime bearing the words of the law (Deut 27:2–8).',
        },
      ],
    },
    unstated: [
      {
        zh: '约书亚在以巴路山所筑未凿石坛的长宽高（申 27:5–6；书 8:30–31），以及抹灰大石的块数与高度（申 27:2–4），经文都没有写明；图中坛形与白灰碑石仅作示意。',
        en: 'Scripture does not state the dimensions of the unhewn altar on Ebal (Deut 27:5–6; Josh 8:30–31) or the size and number of the plastered stones (Deut 27:2–4); their proportions and the tribal rank markers are schematic.',
      },
      {
        zh: '两山高度 940 米、881 米取自现代撒玛利亚示剑（纳布卢斯）实测海拔；沙盘谷宽经比例收敛以便同框看清对山坡与谷底约柜。',
        en: 'The 940 m and 881 m figures reflect the modern elevations at the Shechem pass; horizontal width and vertical rise in the tabletop relief are compressed into a single frame.',
      },
    ],
    punchZh: '一面翠绿、一面荒峻，两座山挟着一道仅约 **500 米** 宽的天然回音谷——约柜立在正中，全以色列站上两坡彼此对答阿们。',
    punchEn: 'Two opposing slopes pinching the **500 m** Shechem pass into a natural acoustic bowl — the Ark in the trough, six tribes answering six across the valley.',
    compare: [
      { zh: '以巴路山海拔（北）', en: 'Mount Ebal summit (north)', m: 940 },
      { zh: '基利心山海拔（南）', en: 'Mount Gerizim summit (south)', m: 881 },
      { zh: '两山之间谷底窄处', en: 'Shechem valley pass width', m: 500 },
    ],
  },
  {
    id: 'jordan-twelve-stones',
    zh: '过约但河与十二块纪念石',
    en: 'Jordan Crossing & Twelve Stones',
    ref: 'Joshua 3:16',
    refZh: '约书亚记 3:16',
    textZh: '那从上往下流的水，便在极远之地、撒拉但旁的亚当城那里停住，立起成垒；那往亚拉巴的海，就是盐海，下流的水全然断绝。于是百姓在耶利哥的对面过去了。',
    textEn: 'That the waters which came down from above stood and rose up upon an heap very far from the city Adam, that is beside Zaretan: and those that came down toward the sea of the plain, even the salt sea, failed, and were cut off: and the people passed over right against Jericho.',
    dims: [
      { key: 'gap', zh: '百姓离约柜当留的距离', en: 'Clearance kept behind the Ark', cubits: 2000, ref: '书 3:4', refEn: 'Josh 3:4' },
      { key: 'ark-l', zh: '约柜长（标准 2.5 肘）', en: 'Ark length', cubits: 2.5, ref: '出 25:10; 书 3:6', refEn: 'Exod 25:10; Josh 3:6' },
      { key: 'ark-w', zh: '约柜宽', en: 'Ark width', cubits: 1.5, ref: '出 25:10', refEn: 'Exod 25:10' },
      { key: 'ark-h', zh: '约柜高', en: 'Ark height', cubits: 1.5, ref: '出 25:10', refEn: 'Exod 25:10' },
    ],
    counts: [
      { zh: '从河中抬出立在吉甲的石头', en: 'Stones taken from Jordan to Gilgal', n: 12, ref: '书 4:3, 8, 20', refEn: 'Josh 4:3, 8, 20' },
      { zh: '约书亚另立在祭司站脚之处的石头', en: 'Stones set up inside the riverbed', n: 12, ref: '书 4:9', refEn: 'Josh 4:9' },
      { zh: '抬约柜的白衣祭司（短发）', en: 'Priests bearing the Ark', n: 4, ref: '书 3:6, 17', refEn: 'Josh 3:6, 17' },
    ],
    kind: 'jordanCrossing',
    variants: {
      key: 'jordanView',
      zh: '叙事瞬间',
      en: 'Moment shown',
      options: [
        {
          id: 'riverbed-ark',
          zh: '干河床 · 祭司抬约柜站立，上游水立起成垒',
          en: 'Dry riverbed · priests bearing the Ark while waters stand upstream',
          note: '呈现约书亚记三至四章的核心张力：四位穿白麻衣的祭司稳立在干涸的河床正中，上游收割时节涨溢的河水停住立起成垒，身旁另有十二块留在河心祭司脚立之处的大石（书 4:9）。',
          noteEn: 'Four priests in white linen stand firm on dry river gravel bearing the Ark, upstream floodwaters banked up in a wall while the lower reach drains toward the Dead Sea; twelve boulders mark the inner riverbed memorial (Josh 4:9).',
        },
        {
          id: 'gilgal-monument',
          zh: '吉甲立十二块石头作纪念 · 书 4:20–24',
          en: 'Twelve stones pitched at Gilgal · Josh 4:20–24',
          note: '各支派一人从约但河祭司站立处扛出来的一十二块河卵大石，安放在吉甲阶地高台上，作日后子孙询问「这些石头是什么意思」的见证。',
          noteEn: 'The twelve river boulders lifted onto twelve shoulders from the dry Jordan bed and erected at Gilgal as a perpetual witness when children ask, "What mean these stones?" (Josh 4:20–24).',
        },
      ],
    },
    unstated: [
      {
        zh: '书 3:4 明确要求百姓与约柜之间相离 **两千肘**（约 890 米至 1,046 米）；为让祭司、河心石堆与对岸队伍同框，三维场景缩短了这一间距，而上方尺寸表会按你所选的肘尺实时换算真实米数。',
        en: 'Joshua 3:4 specifies a separation of **2,000 cubits** (~890–1,046 m) between Ark and people. That gap is compressed in the 3D scene so all elements fit in one frame, while the dimension table computes the full real-world metres as you slide the cubit standard.',
      },
      {
        zh: '亚当城上游距离、春汛收割期间约但河涨过两岸的实际宽度（书 3:15），以及十二人各扛在肩上的河石形状与重量（书 4:5），经文均未记载。',
        en: 'The exact river width during the harvest flood (3:15), upstream distance to Adam near Zaretan (3:16), and exact weight/size of each shoulder-carried stone (4:5) are unstated.',
      },
    ],
    punchZh: '经文不仅数出**十二块石头**，还数出**两套十二块**（河心一组、吉甲一组），并在河东与约柜之间划下**两千肘**不可逾越的间隔。',
    punchEn: 'Not twelve stones only, but **two sets of twelve** (one buried in the riverbed, one pitched at Gilgal) — and a **2,000-cubit** clearance between the people and the Ark.',
    compare: [
      { zh: '百姓离约柜的距离（2,000 普通肘）', en: 'Ark clearance (2,000 common cubits)', m: 890 },
      { zh: '约柜长（2.5 普通肘）', en: 'Ark length (2.5 cubits)', m: 1.11 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'canaan-allotment',
    zh: '迦南十二支派分地与逃城沙盘',
    en: 'Canaan Tribal Allotment & Refuge Relief',
    ref: 'Joshua 18:10',
    refZh: '约书亚记 18:10',
    textZh: '约书亚就在示罗、雅伟面前，为他们拈阄。约书亚在那里，按着以色列人的支派，将地分给他们。',
    textEn: 'And Joshua cast lots for them in Shiloh before Yahweh: and there Joshua divided the land unto the children of Israel according to their divisions.',
    dims: [
      { key: 'dan-beersheba', zh: '但至别是巴南北全长', en: 'Dan to Beersheba north–south span', cubits: 240, ref: '书 15–19', refEn: 'Josh 15–19' },
      { key: 'coast-gilead', zh: '地中海至约但河东东西跨度', en: 'Mediterranean coast to Transjordan span', cubits: 145, ref: '书 13–19', refEn: 'Josh 13–19' },
    ],
    counts: [
      { zh: '河西在示罗拈阄所得支派（九支派半）', en: 'Cisjordan lots cast at Shiloh (9.5 tribes)', n: 9.5, ref: '书 14:2; 18:10', refEn: 'Josh 14:2; 18:10' },
      { zh: '河东已分给的支派（二支派半）', en: 'Transjordan allotments (2.5 tribes)', n: 2.5, ref: '书 13:8', refEn: 'Josh 13:8' },
      { zh: '分定的逃城（河西三座、河东三座）', en: 'Cities of refuge (3 west, 3 east)', n: 6, ref: '书 20:7–8', refEn: 'Josh 20:7–8' },
      { zh: '分给利未人的城邑总数（含六座逃城）', en: 'Levitical cities (including the 6 refuge cities)', n: 48, ref: '书 21:41', refEn: 'Josh 21:41' },
    ],
    kind: 'canaanAllotment',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '但至别是巴、地中海至约但河东高原的实测地理跨度。',
      noteEn: 'Georeferenced span from Dan to Beersheba and Mediterranean coast to Transjordan plateau.',
    },
    variants: {
      key: 'canaanView',
      zh: '分地层',
      en: 'Layer shown',
      options: [
        {
          id: 'tribes-west-east',
          zh: '河西拈阄九支派半与河东二支派半 · 示罗立会幕',
          en: 'Cisjordan & Transjordan tribal allotments · Tabernacle at Shiloh',
          note: '按实测海岸线、加利利海、约但河谷大裂谷、低于海平面四百多米的死海深谷及东西高地绘出十二支派核心锚点，金色双环标出分地中心示罗。',
          noteEn: 'Plots the attested heartlands of all twelve tribes across the Natural Earth coastline, central spine, sunken Jordan Rift and Transjordan plateau, anchored at Shiloh.',
        },
        {
          id: 'refuge-levites',
          zh: '六座逃城（河西三座、河东三座）与利未人四十八城纲要',
          en: 'Six cities of refuge (three west, three east) & Shiloh center',
          note: '聚焦书 20:7–8 河西、河东两列南北对称分布的六座逃城：基低斯、示剑、希伯仑（河西）与比悉、基列拉末、哥兰（河东），并以金环标出各城往返通道。',
          noteEn: 'Isolates the six symmetrical cities of refuge appointed in Josh 20:7–8 — Kedesh, Shechem and Hebron west of Jordan; Bezer, Ramoth-gilead and Golan east of Jordan.',
        },
      ],
    },
    unstated: [
      {
        zh: '书 15–19 章所列边界小城有相当一部分今日确址已失传；因此沙盘不擅自画出现代政区式硬边界线，只在经文与地理可考的支派中心与六座逃城插标定位。',
        en: 'Many minor boundary towns in Joshua 15–19 have lost their ancient identifications; rather than fabricating hard modern border lines, the relief marks verified tribal heartlands, Shiloh and the six cities of refuge.',
      },
      {
        zh: '垂直高程按沙盘展示需要适度放大，以清楚呈现沿海平原、中央山地、低于海平面约 430 米的死海裂谷与约但河东高原的阶梯落差。',
        en: 'Vertical elevation is exaggerated on the relief slab so the coastal plain, central hill country, -430 m Dead Sea Rift and eastern tableland read clearly at a glance.',
      },
    ],
    punchZh: '九支派半在示罗拈阄，两支派半守着约但河东高原，当中深陷一条大裂谷；**六座逃城**东西三对三分布其间，让误杀人的无论在何处总有路可达。',
    punchEn: 'Nine and a half tribes west of the deep Rift, two and a half on the eastern plateau — flanked by **six symmetrical cities of refuge**, three west and three east.',
    compare: [
      { zh: '但至别是巴南北跨度', en: 'Dan to Beersheba length', m: 240_000 },
      { zh: '海岸至约但河东东西跨度', en: 'Coast to Transjordan width', m: 145_000 },
    ],
  },
  {
    id: 'gideon-three-hundred',
    zh: '基甸三百人与空瓶火把角',
    en: "Gideon's Three Hundred",
    ref: 'Judges 7:16',
    refZh: '士师记 7:16',
    textZh: '于是基甸将三百人分作三队，把角和空瓶交在各人手里，瓶内都藏着火把；',
    textEn: "And he divided the three hundred men into three companies, and he put a trumpet in every man's hand, with empty pitchers, and lamps within the pitchers.",
    dims: [],
    counts: [
      { zh: '用手捧着舔水的精简人数', en: 'Men chosen who lapped water', n: 300, ref: '士 7:6–7', refEn: 'Judg 7:6–7' },
      { zh: '夜间合围米甸营的分队数', en: 'Attacking companies at night', n: 3, ref: '士 7:16', refEn: 'Judg 7:16' },
      { zh: '空瓶与瓶内所藏火把', en: 'Empty pitchers with torches inside', n: 300, ref: '士 7:16, 20', refEn: 'Judg 7:16, 20' },
      { zh: '左手所拿吹响的公羊角', en: "Rams'-horn trumpets blown together", n: 300, ref: '士 7:16, 20', refEn: 'Judg 7:16, 20' },
    ],
    kind: 'gideonDiorama',
    assumedHeight: 1.6,
    variants: {
      key: 'gideonView',
      zh: '展示视角',
      en: 'View',
      options: [
        {
          id: 'three-companies',
          zh: '哈律泉与摩利冈谷地 · 三队各百人夜围米甸营',
          en: 'Valley by Moreh · three companies of 100 ringing the Midianite camp',
          note: '深蓝夜色沙盘实数绘出 **3 × 100 = 300** 点同时晃动亮起的火把光簇，分三队绕在哈律泉南侧坡壁与摩利冈山下四十八顶黑山羊毛米甸帐棚四周（士 7:1, 16）。',
          noteEn: 'Night relief diorama rendering **3 × 100 = 300** individual torch points divided into three flanking companies above forty-eight black goat-hair Midianite tents in the valley below Moreh (Judg 7:1, 16).',
        },
        {
          id: 'pitcher-torch-horn',
          zh: '一比一器物细看 · 瓦瓶藏火把与公羊角（士 7:16, 20）',
          en: '1:1 equipment study · clay pitcher, torch within & ram’s-horn trumpet',
          note: '按 1:1 比例放在人物身旁展示这一夜每个人手中的三样兵器（竟无刀枪）：素陶双耳空瓶（一旁是击碎的瓦片）、渗脂松明火把，以及左手持吹的曲弯公羊角。',
          noteEn: 'Sets beside the 1.72 m reference figure the exact three items carried by every soldier — no sword at all: the earthenware pitcher (with broken sherds), the burning pitch torch once hidden inside, and the curved shophar.',
        },
      ],
    },
    unstated: [
      {
        zh: '米甸与亚玛力联营在谷中「多如蝗虫」（士 7:12），其实际帐棚数目与营地面积经文并未统计，沙盘以四十八顶黑色帐棚示意敌营规模。',
        en: 'Scripture compares the Midianite host in the valley to "locusts for multitude" (Judg 7:12) without giving a tent count or acreage; the 48 dark tents are a schematic camp footprint.',
      },
      {
        zh: '陶瓶高约 36 厘米与羊角长度依照铁器时代以色列民居日用器皿形制复原，经文只写明「空瓶、瓶内藏火把、角」与分作三队各百人。',
        en: 'The ~36 cm clay pitcher and curved ram’s horn follow Iron Age I domestic pottery and shophar proportions; Judges gives the exact counts (300 men, 3 companies, 300 pitchers, torches and trumpets) without citing lengths.',
      },
    ],
    punchZh: '零把刀剑，只靠 **三队 × 一百支骤然齐明、同时呐喊吹响的火把与公羊角** —— 经文在数字上写透了这场夜晚的以少胜多。',
    punchEn: 'Not a drawn sword in hand — **three companies × 100 torches** suddenly unmasked with 300 trumpets in the dead of night.',
    compare: [
      { zh: '展示台跨度（谷地沙盘模式）', en: 'Valley diorama table span', m: 12.0 },
      { zh: '一个成年人（器物模式参照身高）', en: 'Adult human (artifact mode height)', m: 1.72 },
      { zh: '铁器时代日用素陶水瓶（约高）', en: 'Iron Age I clay pitcher (approx.)', m: 0.36 },
    ],
  },
  {
    id: 'ark-up-to-zion',
    zh: '抬约柜走六步与大卫的帐幕',
    en: 'The Ark Brought Up to Zion',
    ref: '2 Samuel 6:13',
    refZh: '撒母耳记下 6:13',
    textZh: '抬雅伟约柜的人走了六步，大卫就献牛与肥羊为祭。',
    textEn: 'And it was so, that when they that bare the ark of Yahweh had gone six paces, he sacrificed oxen and fatlings.',
    dims: [
      { key: 'ark-l', zh: '约柜长（出 25:10 同款按经建柜）', en: 'Ark length (same Exod 25:10 chest)', cubits: 2.5, ref: '出 25:10; 撒下 6:13', refEn: 'Exod 25:10; 2 Sam 6:13' },
      { key: 'ark-w', zh: '约柜宽', en: 'Ark width', cubits: 1.5, ref: '出 25:10', refEn: 'Exod 25:10' },
      { key: 'ark-h', zh: '约柜高', en: 'Ark height', cubits: 1.5, ref: '出 25:10', refEn: 'Exod 25:10' },
    ],
    counts: [
      { zh: '每逢前进停下来献祭的步数', en: 'Paces walked before each sacrifice', n: 6, ref: '撒下 6:13', refEn: '2 Sam 6:13' },
      { zh: '在祭坛献上的牺牲（一牛与一肥羊/肥牛）', en: 'Sacrifices offered (ox and fatling)', n: 2, ref: '撒下 6:13', refEn: '2 Sam 6:13' },
      { zh: '用杠抬约柜的利未人（短发白麻衣）', en: 'Levitical bearers carrying poles', n: 4, ref: '代上 15:15; 撒下 6:13', refEn: '1 Chr 15:15; 2 Sam 6:13' },
    ],
    kind: 'arkToZion',
    variants: {
      key: 'zionArkView',
      zh: '所见一幕',
      en: 'Moment shown',
      options: [
        {
          id: 'six-paces',
          zh: '抬约柜走六步献牛与肥畜 · 撒下 6:13',
          en: 'Six paces & sacrifice of ox and fatling · 2 Sam 6:13',
          note: '不再用牛车（撒下 6:3–7），而是由四名利未人遵律法用肩扛杠；石灰石道上精确刻出六个步距标点，旁设现筑石坛献上一牛与一肥畜。',
          noteEn: 'No longer placed on a new cart (2 Sam 6:3–7), the Ark rides on golden poles upon four Levites’ shoulders along six marked paces before an altar bearing the ox and fatling.',
        },
        {
          id: 'tent-of-david',
          zh: '安放在大卫所搭的帐幕里 · 撒下 6:17',
          en: 'Set inside the tent David pitched · 2 Sam 6:17',
          note: '呈现大卫城平台上的「大卫的帐幕」：幔子敞开，没有外院铜祭坛的隔断——因为摩西当年所造的会幕与铜坛此时仍留在基遍的高邱（代上 16:39）。',
          noteEn: 'Shows the Ark enthroned beneath the open-curtained tent David pitched in the City of David — distinct from Moses’ Tabernacle and bronze altar still standing at Gibeon (1 Chr 16:39).',
        },
      ],
    },
    unstated: [
      {
        zh: '大卫在耶路撒冷为约柜另外支搭的帐幕究竟有多大，经文没有记下一肘一寸；所呈帐蓬大小、一步步距（以约 0.75 米示意）以及献祭石坛的尺寸，均属于未记而标明之补充。',
        en: 'Scripture records no dimensions for the tent David pitched for the Ark (2 Sam 6:17; 1 Chr 16:1); tent size, single pace stride (~0.75 m) and stone altar proportions are unstated display assumptions.',
      },
      {
        zh: '「走了六步」是仅在起程时献一次，还是沿路每六步就停下献一次，历代解经皆有两解；三维场景突出这六个实步的节律。',
        en: 'Whether David sacrificed once after the opening six paces proved safe or repeatedly every six paces along the climb is debated by commentators; the model highlights the measured six-pace interval itself.',
      },
    ],
    punchZh: '牛车出了事，律法重新归位：**四个人扛起两肘半长的约柜，刚迈出六步**，就在路旁立刻筑坛献祭。',
    punchEn: 'After the oxcart tragedy, the poles return to Levite shoulders: **four bearers carry the 2.5-cubit Ark six careful paces**, and halt for sacrifice.',
    compare: [
      { zh: '六步总长（按约 0.75 米/步示意）', en: 'Six-pace span (approx. 0.75 m/pace)', m: 4.5 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '约柜长（2.5 普通肘）', en: 'Ark length (2.5 cubits)', m: 1.11 },
    ],
  },
  {
    id: 'paul-journeys-relief',
    zh: '保罗四次行程与地中海地形沙盘',
    en: "Paul's Journeys Mediterranean Relief",
    ref: 'Acts 13:4',
    refZh: '使徒行传 13:4',
    textZh: '他们既被圣灵差遣，就下到西流基，从那里坐船往居比路去。',
    textEn: 'So they, being sent forth by the Holy Spirit, departed unto Seleucia; and from thence they sailed to Cyprus.',
    dims: [
      { key: 'med-ew', zh: '东西海陆跨度（安提阿至罗马）', en: 'East–west basin span (Antioch to Rome)', cubits: 2300, ref: '徒 13:4–28:16', refEn: 'Acts 13:4–28:16' },
      { key: 'med-ns', zh: '南北跨度（马其顿至亚历山大港）', en: 'North–south span (Philippi to Alexandria)', cubits: 1250, ref: '徒 16:12; 27:6', refEn: 'Acts 16:12; 27:6' },
    ],
    counts: [
      { zh: '使徒行传所记四次主要行程', en: 'Major journeys recorded in Acts', n: 4, ref: '徒 13–28', refEn: 'Acts 13–28' },
      { zh: '押解船上总共的人数', en: 'Souls aboard the Rome grain ship', n: 276, ref: '徒 27:37', refEn: 'Acts 27:37' },
      { zh: '亚得里亚海被风飘荡的夜数', en: 'Nights adrift on the Adriatic', n: 14, ref: '徒 27:27', refEn: 'Acts 27:27' },
    ],
    kind: 'paulJourneysRelief',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '东地中海至意大利的实测经纬度跨度（安提阿至罗马）。',
      noteEn: 'Georeferenced Mediterranean basin span from Antioch and Jerusalem to Rome.',
    },
    variants: {
      key: 'paulReliefView',
      zh: '筛选路线',
      en: 'Routes shown',
      options: [
        {
          id: 'all-four',
          zh: '四段行程总览 · 宣教一至三次与押解往罗马',
          en: 'All four routes · three missionary journeys & voyage to Rome',
          note: '在同一块中地中海至黎凡特整版立体地形沙盘上，以四种色彩同时呈现第一次（金）、第二次（翠绿）、第三次（碧蓝）宣教路线与押解往罗马（朱红）海路。',
          noteEn: 'Overlays all four Acts routes simultaneously across the Natural Earth relief of Italy, Greece, Anatolia, Cyprus, Crete, Malta and the Levant: 1st (gold), 2nd (emerald), 3rd (cerulean) and Rome voyage (crimson).',
        },
        {
          id: 'aegean-galatia',
          zh: '三次宣教行程 · 居比路、加拉太、马其顿、亚该亚与以弗所',
          en: 'Three missionary journeys · Cyprus, Galatia, Macedonia, Achaia & Ephesus',
          note: '收起罗马航线，清楚看见保罗反复横越安纳托利亚托鲁斯山脉、爱琴海群岛与哥林多地峡、马其顿海岸之间的陆路与航线交会枢纽——安提阿、以弗所、帖撒罗尼迦与哥林多。',
          noteEn: 'Hides the Rome voyage so the three missionary circuits stand out across the Taurus passes, Pisidian plateau, Aegean crossings, Macedonia and the Isthmus of Corinth.',
        },
        {
          id: 'rome-voyage',
          zh: '押解往罗马航线 · 该撒利亚经革哩底、米利大至罗马（徒 27–28）',
          en: 'Voyage to Rome · Caesarea via Crete and Malta to Rome (Acts 27–28)',
          note: '单挑出使徒行传二十七至二十八章的冬航遇险线：从该撒利亚北绕居比路背风处至每拉换船，沿着革哩底南岸在佳澳避风，被「友拉革罗」东北狂风吹过开阔海面十四昼夜，在米利大搁浅，再北上叙拉古、部丢利沿阿庇乌大道入罗马。',
          noteEn: 'Isolates Acts 27–28: sailing leeward of Cyprus to Myra, creeping under southern Crete to Fair Havens, driven 14 nights by Euroclydon to the wreck marker on Malta, then Syracuse, Puteoli and Rome.',
        },
      ],
    },
    unstated: [
      {
        zh: '路加仔细记下港口、省分与主城次序，但内陆驿道的逐里拐弯与大风中船只飘移的精确经纬度轨迹，经文并未逐段实测；路线管线连接的是使徒行传指名经过的城邑与海岛。',
        en: 'Luke carefully logs provinces, ports and sequential towns, but not road bends or open-sea drift telemetry; route arcs smoothly connect the named cities and islands of Acts.',
      },
      {
        zh: '为使托鲁斯山脉、品都斯山脉、革哩底白山与亚平宁山脊在桌面沙盘中一眼可辨，地形高程相较 2,300 公里水平海陆跨度做了显著放大。',
        en: 'Terrain elevation is markedly exaggerated relative to the 2,300 km horizontal sea-and-land basin so mountain barriers like the Taurus and Crete ridges remain tactile.',
      },
    ],
    punchZh: '**两千三百公里**海岸与山口尽收一张桌子：保罗三次越过托鲁斯高岭、两渡爱琴海，又借一条载满二百七十六人的冬船，在米利大滩头以后走上罗马大道。',
    punchEn: '**2,300 kilometres** of sea and mountain pass on one relief table — Taurus ridges crossed on foot, Aegean straits sailed twice, and a 276-soul winter wreck landing in Italy.',
    compare: [
      { zh: '安提阿至罗马东西直线跨度', en: 'Antioch to Rome east–west span', m: 2_300_000 },
      { zh: '雅典至哥林多地峡短距（对照）', en: 'Athens to Corinth (reference)', m: 78_000 },
    ],
  },
  {
    id: 'seven-churches-circuit',
    zh: '亚细亚七教会驿道与拔摩岛沙盘',
    en: 'Seven Churches of Asia Relief',
    ref: 'Revelation 1:11',
    refZh: '启示录 1:11',
    textZh: '你所看见的，当写在书上，达与以弗所、示每拿、别迦摩、推雅推喇、撒狄、非拉铁非、老底嘉，那七个教会。',
    textEn: 'What thou seest, write in a book, and send it unto the seven churches which are in Asia; unto Ephesus, and unto Smyrna, and unto Pergamum, and unto Thyatira, and unto Sardis, and unto Philadelphia, and unto Laodicea.',
    dims: [
      { key: 'patmos-ephesus', zh: '拔摩岛渡海至以弗所港口距离', en: 'Patmos to Ephesus sea crossing', cubits: 90, ref: '启 1:9, 11', refEn: 'Rev 1:9, 11' },
      { key: 'seven-loop', zh: '七城顺时针罗马驿道环线总长', en: 'Clockwise Roman road circuit through the 7 cities', cubits: 560, ref: '启 1:11', refEn: 'Rev 1:11' },
    ],
    counts: [
      { zh: '按地理次序致书的亚细亚教会', en: 'Churches in Asia addressed in sequence', n: 7, ref: '启 1:11; 2–3', refEn: 'Rev 1:11; 2–3' },
      { zh: '约翰被放逐所在的海岛（拔摩岛）', en: 'Island of exile — Patmos', n: 1, ref: '启 1:9', refEn: 'Rev 1:9' },
    ],
    kind: 'asiaChurchesRelief',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '拔摩岛与亚细亚省七城之间的实测地理距离。',
      noteEn: 'Georeferenced distances across Patmos and the seven cities of Roman Asia.',
    },
    variants: {
      key: 'asiaCircuitView',
      zh: '阅读焦点',
      en: 'Focus',
      options: [
        {
          id: 'postal-loop',
          zh: '顺时针驿道环路 · 拔摩岛与以弗所至老底嘉七城次序',
          en: 'Clockwise road circuit · Patmos & the sequence from Ephesus to Laodicea',
          note: '按拔摩岛上岸以弗所港口后向北经示每拿、别迦摩，再折向东南循内陆河谷经推雅推喇、撒狄、非拉铁非直抵老底嘉的真实罗马驿道次序连出金色环路。',
          noteEn: 'Traces the postal loop from Patmos ashore at Ephesus, north up the coast through Smyrna and Pergamum, then southeast down the valleys through Thyatira, Sardis and Philadelphia to Laodicea.',
        },
        {
          id: 'valleys-acropoleis',
          zh: '河谷与卫城地貌 · 推雅推喇平原通道至老底嘉吕科斯河谷',
          en: 'River valleys & acropoleis · Hermus, Cayster & Lycus corridors',
          note: '放大高差并高亮盖迪兹河（赫耳摩斯）、门德列斯河（迈安德尔）与吕科斯河谷走廊，看清老底嘉三岔谷地、撒狄险峻卫城台地与别迦摩高岗在地形上的天然位置。',
          noteEn: 'Emphasizes the relief corridors of the Hermus, Cayster and Maeander–Lycus valleys, clarifying Pergamum’s citadel ridge, Sardis’ acropolis spur and Laodicea’s tri-city valley floor.',
        },
      ],
    },
    unstated: [
      {
        zh: '启 1:11 将七个教会按绕行罗马亚细亚省的顺时针邮路精确排定次序，但书卷实际上由何人递送、是否在以弗所抄写分送各城，经文并未细述。',
        en: 'Revelation 1:11 orders the seven cities in exact geographic sequence along the Asian Roman postal circuit, though Scripture does not specify the couriers or copying logistics from Patmos.',
      },
      {
        zh: '小亚细亚西岸群岛、海湾与内陆河谷台地在桌面沙盘中经过垂直起伏加强，以便一眼读出海岸线与三条东西河谷走廊。',
        en: 'Western Anatolian coastal bays, Aegean islands and inland river valleys are vertically exaggerated on the slab for clear visual contrast.',
      },
    ],
    punchZh: '从爱琴海孤岛**拔摩岛**渡海九十公里登陆以弗所，再绕着亚细亚西岸走一圈约**五百六十公里**的顺时针大环路——启示录第一章十节的七城点名，原来就是这张地形图上的一条不回头驿道。',
    punchEn: 'Cross **90 km** from Patmos to Ephesus, then follow a **560 km** clockwise road loop through all seven cities — the exact geographic order in Revelation 1:11.',
    compare: [
      { zh: '七城顺时针陆路环线全长', en: 'Clockwise seven-city postal loop', m: 560_000 },
      { zh: '拔摩岛至以弗所海程', en: 'Patmos to Ephesus sea crossing', m: 90_000 },
    ],
  },
  {
    id: 'red-sea-walls',
    zh: '过红海 · 水立为墙垣与云火柱',
    en: 'Red Sea Crossing · Waters as Walls',
    ref: 'Exodus 14:22',
    refZh: '出埃及记 14:22',
    textZh: '以色列人下海中走干地，水在他们的左右作了墙垣。',
    textEn: 'And the children of Israel went into the midst of the sea upon the dry ground: and the waters were a wall unto them on their right hand, and on their left.',
    dims: [],
    kind: 'redSeaCrossing',
    assumedHeight: 4.2,
    counts: [
      { zh: '左右分开立作墙垣的海水列墙', en: 'Parted water walls (left and right)', n: 2, ref: '出 14:22, 29', refEn: 'Exod 14:22, 29' },
      { zh: '转到以色列营后分隔两营的云火柱', en: 'Pillar of cloud and fire between camps', n: 1, ref: '出 14:19–20, 24', refEn: 'Exod 14:19–20, 24' },
      { zh: '法老所调动特选的战车', en: 'Pharaoh’s chosen chariots', n: 600, ref: '出 14:7', refEn: 'Exod 14:7' },
    ],
    variants: {
      key: 'redSeaView',
      zh: '展示视角',
      en: 'View',
      options: [
        {
          id: 'night-corridor',
          zh: '夜间干道 · 左右水墙、云火柱与两岸军队',
          en: 'Night dry-seabed corridor · water walls, cloud-fire pillar & both hosts',
          note: '呈现整夜大东风吹干的干海床通道（出 14:21–22）：以色列人持火光行在左右水墙之间，雅伟使者所在的云柱火柱转到营后挡住埃及军，面朝西发黑阻隔追兵、面朝东发光照亮干道（14:19–20；仅以云与火表达，不塑神形）。',
          noteEn: 'Models the dry seabed path opened by the strong east wind (Exod 14:21–22): Israel advances between vertical water walls while the aniconic Pillar of Cloud and Fire stands between camps — dark to Egypt and shining light toward Israel (14:19–20).',
        },
        {
          id: 'seabed-and-wheels',
          zh: '一比一海床细看 · 水墙、海底砂石与脱落战车轮（出 14:25）',
          en: '1:1 seabed detail · 4.2 m water wall & chariot with detached wheels (Exod 14:25)',
          note: '将视角降到干涸海床地面，在 **1.72 米**参照人旁展示高耸的透明蓝绿水墙，以及陷在泥沙中车轮脱落的晚青铜时代埃及双轮战车（出 14:25）。',
          noteEn: 'Drops to ground level beside a **1.72 m** human figure: a sheer 4.2 m translucent water wall beside seabed cobbles and a mired Late Bronze Age Egyptian chariot with detached six-spoke wheels (Exod 14:25).',
        },
      ],
    },
    unstated: [
      {
        zh: '水墙的实际高度、海底干道的长度与宽度，以及过海的确切海湾湾口位置，出埃及记均未给出尺码；沙盘中的水墙与 4.2 米地面示意均按经文记述的相对比例构建。',
        en: 'Water-wall height, dry corridor breadth and length, and the exact crossing embayment are unstated in Exodus; both diorama proportions and the 4.2 m 1:1 wall study are schematic.',
      },
      {
        zh: '经文记法老带了「六百辆特选的车和埃及所有的车」（出 14:7），未计全部兵员总数；模型在西岸摆出微缩战车列阵以表意，严格不作神明人形。',
        en: 'Scripture counts 600 chosen chariots plus all the chariots of Egypt (Exod 14:7) without listing total cavalry numbers; only representative chariot silhouettes are placed, with zero anthropomorphic depiction of Yahweh.',
      },
    ],
    punchZh: '一面吹起干地，一面把 **左右海水立作墙垣**——更在两营之间立起 **一面黑暗、一面发光的云火柱**，把追赶的 **六百辆特选战车** 拖到车轮脱落。',
    punchEn: 'Not merely shallow water: **walls of sea to left and right**, a dry seabed lane, and an **aniconic pillar of dark cloud and bright fire** standing between Israel and Pharaoh’s **600 chosen chariots**.',
    compare: [
      { zh: '近景水墙参照高度', en: 'Close-up water wall reference height', m: 4.2 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'sinai-covenant-pillars',
    zh: '西乃山界限 · 密云烈火与十二支派柱子',
    en: 'Mount Sinai Bounds, Cloud & Twelve Pillars',
    ref: 'Exodus 19:18',
    refZh: '出埃及记 19:18',
    textZh: '西乃全山冒烟，因为雅伟在火中降于山上。山的烟气上腾，如烧窑一般，遍山大大的震动。',
    textEn: 'And mount Sinai was altogether on a smoke, because Yahweh descended upon it in fire: and the smoke thereof ascended as the smoke of a furnace, and the whole mount quaked greatly.',
    dims: [],
    kind: 'sinaiBounds',
    assumedHeight: 1.85,
    counts: [
      { zh: '立约清早在山下所筑石坛', en: 'Uncut stone altar built below Sinai', n: 1, ref: '出 24:4; 20:25', refEn: 'Exod 24:4; 20:25' },
      { zh: '按以色列十二支派立的柱子', en: 'Standing pillars for the 12 tribes', n: 12, ref: '出 24:4', refEn: 'Exod 24:4' },
      { zh: '盛血洒向坛与百姓的盆（成对记述）', en: 'Basins for covenant blood', n: 2, ref: '出 24:6', refEn: 'Exod 24:6' },
    ],
    variants: {
      key: 'sinaiView',
      zh: '场景焦点',
      en: 'Focus',
      options: [
        {
          id: 'mountain-bounds',
          zh: '西乃全山冒烟 · 密云、烈火、闪电与四围定界限（出 19）',
          en: 'Sinai in smoke and fire · cloud, lightning & perimeter bounds (Exod 19)',
          note: '红赭色花岗石峰顶笼罩浓密雷云、烧窑般的浓烟、火焰与闪电（全按圣经戒命只绘云与火，绝不塑任何神形），山脚四围沿平原铺开不可逾越的石头界线（出 19:12, 23）。',
          noteEn: 'Shows the granite massif crowned in thick thunderclouds, furnace-like smoke, fire and lightning (strictly aniconic), encircled at its base by the inviolable stone boundary cordon (Exod 19:12, 23).',
        },
        {
          id: 'altar-twelve-pillars',
          zh: '一比一立约石坛与十二根石柱 · 约书与血盆（出 24:4–7）',
          en: '1:1 covenant altar & 12 tribal pillars · Book of the Covenant (Exod 24:4–7)',
          note: '按 **1.72 米**人身比例在山脚摆开出 24:4 场景：不动铁器（出 20:25）叠起的天然山石祭坛、代表以色列十二支派半圆排开的十二根粗琢石柱、两个铜血盆与摊开的约书。',
          noteEn: 'At 1:1 scale beside a 1.72 m reference figure: the altar built of unhewn natural fieldstones (Exod 20:25), 12 granite pillars raised around it for the 12 tribes, blood basins, and the open Book of the Covenant (24:4–7).',
        },
      ],
    },
    unstated: [
      {
        zh: '西乃山哪一座具体山峰对应出埃及记的何烈山、界限距山脚多少步、以及出 24:4 十二根柱子的高度（图中取约 1.5–1.85 米人高近尺）均未载明。',
        en: 'Which southern Sinai massif corresponds to Mount Sinai, the boundary radius at its foot, and the exact height of the 12 standing pillars (shown near human stature ~1.5–1.85 m) are unstated in Exodus.',
      },
      {
        zh: '申命记明确警告百姓在何烈山火中「没有看见什么形像」（申 4:15）；本模型严格不塑任何神明形象，只表现密云、浓烟、火焰、闪电与不可触摸的山界。',
        en: 'Deuteronomy 4:15 explicitly stresses Israel "saw no manner of similitude" in the fire at Horeb; strictly no bodily form appears here — only cloud, smoke, fire, lightning and the mountain bounds.',
      },
    ],
    punchZh: '一面是在山顶 **如烧窑冒烟的火与不可近前的界限**，一面是在山下清早 **一座未动铁器的石坛和十二根按支派立起的柱子**——律法与立约在同一座山脚同时立定。',
    punchEn: 'Above: **aniconic cloud, furnace smoke, fire and strict mountain bounds**. Below at dawn: **one unhewn altar and twelve standing stone pillars**, one for each tribe of Israel.',
    compare: [
      { zh: '十二支派柱子参照高度', en: 'Twelve standing pillars (approx. height)', m: 1.85 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'songs-of-ascents-zion',
    zh: '上行之诗 · 登雅伟的山与十五级台阶',
    en: 'Songs of Ascents · Going Up to Zion',
    ref: 'Psalms 122:4',
    refZh: '诗篇 122:4',
    textZh: '众支派，就是雅伟的支派，上那里去，按以色列的常例称赞雅伟的名。',
    textEn: 'Whither the tribes go up, the tribes of Yahweh, unto the testimony of Israel, to give thanks unto the name of Yahweh.',
    dims: [],
    kind: 'zionAscent',
    assumedHeight: 3.15,
    counts: [
      { zh: '上行之诗篇数（诗 120 至 134 篇）', en: 'Songs of Ascents (Pss 120–134)', n: 15, ref: '诗 120–134 题注', refEn: 'Pss 120–134 titles' },
      { zh: '传统所记圣殿门前十五级台阶（密西拿）', en: 'Traditional 15 steps before sanctuary court (Mishnah)', n: 15, ref: '诗 122; 尺寸篇 2:5', refEn: 'Ps 122; Middot 2:5' },
    ],
    variants: {
      key: 'zionAscentView',
      zh: '展示视角',
      en: 'View',
      options: [
        {
          id: 'pilgrim-climb',
          zh: '登锡安山地形沙盘 · 西罗亚池沿俄斐勒阶梯上圣殿山',
          en: 'Topographic ascent relief · Siloam pool climbing Ophel spur to Temple gates',
          note: '从南端低谷的西罗亚池出发，沿着俄斐勒山脊石灰石阶道一级级爬上北端的圣殿山门垣；沿路点亮十五座金色灯台标石，呼应诗篇 120–134 共十五篇「上行之诗」。',
          noteEn: 'Follows the pilgrim climb from the lower Pool of Siloam up the stepped limestone Ophel ridge to the Temple gates at the crest, marked by 15 golden lamp markers matching the 15 Songs of Ascents (Pss 120–134).',
        },
        {
          id: 'fifteen-steps',
          zh: '一比一十五级半圆石阶 · 利未人在阶上歌颂（诗 134）',
          en: '1:1 fifteen semicircular steps · Levites singing on the ascents (Ps 134)',
          note: '按约 3.15 米总爬升呈现半圆扇形展铺的十五级耶路撒冷石灰石台阶与双扇铜金殿门（阶数见犹太传统口传对照，短发利未人站在不同石阶上持竖琴颂赞）。',
          noteEn: 'At 1:1 scale beside a 1.72 m reference figure: 15 concentric limestone steps (~3.15 m total rise) rising to sanctuary portals, with four short-haired Levites playing lyres along the steps.',
        },
      ],
    },
    unstated: [
      {
        zh: '诗篇 120–134 共有十五篇题记「上行之诗」，至于当时众支派朝圣是边走山路上耶路撒冷（诗 122:2–4），还是《密西拿·尺寸篇》2:5 与《圣殿节期篇》5:4 所记利未人在圣殿十五级半圆石阶上分班高唱这十五篇诗，经文本身没有注明；模型用两个视角同时说明。',
        en: 'Psalms 120–134 bear 15 "Song of Ascents" headings, without specifying whether they were sung climbing the roads/Ophel ridge to Jerusalem (Ps 122:2–4) or by Levites on the 15 semicircular courtyard steps remembered in Mishnah Middot 2:5; both are shown.',
      },
      {
        zh: '每级台阶踏步宽与踢面高（0.21 米 × 15 ≈ 3.15 米）属建筑参照尺度，人物发式一律短发（林前 11:14）。',
        en: 'Step riser height (~0.21 m × 15 ≈ 3.15 m) is an architectural assumption; all male figures are rendered short-haired (1 Cor 11:14).',
      },
    ],
    punchZh: '一共 **十五篇上行之诗**，一路从谷底水池爬上锡安门垣——每走一段路、每迈上一级台阶，诗行都把眼睛从四周高山再抬高一点，直到站在雅伟的殿门口（诗 121:1；122:1）。',
    punchEn: 'Exact **15 Songs of Ascents**: a steady physical and spiritual climb up the limestone ridge toward the gates of Yahweh’s house — whether read on the **Ophel road** or across **15 semicircular steps**.',
    compare: [
      { zh: '十五级台阶总升高度（约）', en: 'Fifteen steps total rise (approx.)', m: 3.15 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'isaiah-throne-vision',
    zh: '以赛亚书六章 · 高高宝座、衣裳与六翼撒拉弗',
    en: "Isaiah 6 Temple Vision & Seraphim",
    ref: 'Isaiah 6:1',
    refZh: '以赛亚书 6:1',
    textZh: '当乌西雅王崩的那年，我见主坐在高高的宝座上。他的衣裳垂下，遮满圣殿。',
    textEn: 'In the year that king Uzziah died I saw also Yahweh sitting upon a throne, high and lifted up, and his train filled the temple.',
    dims: [
      { key: 'hekhal-w', zh: '圣殿内殿宽（参照王上 6:2）', en: 'Sanctuary inner breadth (ref. 1 Kgs 6:2)', cubits: 20, ref: '赛 6:1; 王上 6:2', refEn: 'Isa 6:1; 1 Kgs 6:2' },
      { key: 'hekhal-h', zh: '圣殿高度参照（约 20–30 肘）', en: 'Sanctuary height frame', cubits: 20, ref: '赛 6:1, 4', refEn: 'Isa 6:1, 4' },
    ],
    kind: 'isaiahThrone',
    counts: [
      { zh: '每个撒拉弗身上的翅膀数（两遮脸、两遮脚、两飞翔）', en: 'Wings on each Seraph (2 face, 2 feet, 2 fly)', n: 6, ref: '赛 6:2', refEn: 'Isa 6:2' },
      { zh: '从香坛取到以赛亚嘴边的红炭', en: 'Live coal lifted from altar with tongs', n: 1, ref: '赛 6:6–7', refEn: 'Isa 6:6–7' },
    ],
    variants: {
      key: 'isaiahView',
      zh: '展示范围',
      en: 'View',
      options: [
        {
          id: 'high-throne-train',
          zh: '内殿剖面 · 高高宝座辉光、衣裳遮满殿地、浓烟门槛与六翼撒拉弗',
          en: 'Cutaway sanctuary · aniconic glory above high throne, train filling floor & 6-winged Seraphim',
          note: '按王上 6:2 二十肘宽圣殿比例切开东侧壁面：高耸台阶宝座上**绝不塑人形**，仅以纯白与精金圣光环表达荣光；深紫金边衣摆沿阶垂落遮满二十肘殿地；左右两位撒拉弗各按「两翼遮脸、两翼遮脚、两翼飞翔」（赛 6:2）建造，殿内香烟上升（6:4）。',
          noteEn: 'Opens the 20-cubit sanctuary (1 Kgs 6:2): stepped high throne crowned strictly with aniconic radiance (no bodily form), purple-gold hem folds filling the golden floor, smoking incense altar and threshold posts (Isa 6:4), and two 6-winged Seraphim — upper pair crossed over face, lower pair covering feet, middle pair spread in flight (6:2).',
        },
        {
          id: 'altar-live-coal',
          zh: '圣所香坛与火剪 · 撒拉弗挟红炭飞来（赛 6:6）',
          en: 'Smoking altar & bronze tongs · Seraph lifting live coal (Isa 6:6)',
          note: '放大呈现正在冒烟的香坛与红炭火盘、伸出红炭的长铜火剪，以及一旁双翼遮脸、双翼遮脚、展翅凌空的六翼撒拉弗——随时响应滑块改变肘长标准。',
          noteEn: 'Focuses on the smoking horned altar heaped with glowing coals, bronze tongs lifting one live coal, and a hovering six-winged Seraph; resizes dynamically with the cubit slider.',
        },
      ],
    },
    unstated: [
      {
        zh: '以赛亚书六章没有开出宝座、撒拉弗或台阶的肘数；模型借用所罗门圣殿内殿二十肘宽的实地建筑背景（王上 6:2），把异象的宝座与「遮满圣殿」的衣裳摆进真实殿堂空间，故会随上方肘尺滑块缩放。',
        en: 'Isaiah 6 states no cubit numbers for the throne or Seraphim; because the vision explicitly takes place inside the Jerusalem sanctuary threshold (Isa 6:1, 4), the 20-cubit temple hall of 1 Kgs 6:2 provides the cubit-reactive architectural frame.',
      },
      {
        zh: '严守不以人形绘神的原则：高高宝座上只作圣洁光芒与光环；撒拉弗虽在异象中有手、面与脚的记述（6:2, 6），模型令其上两翼严实遮脸、下两翼严实遮脚，保持肃穆敬畏的徽记形态。',
        en: 'Strictly aniconic regarding Yahweh: only pure radiance sits upon the elevated throne, while each Seraph keeps its upper pair of wings folded completely across its head/face and lower pair over its feet exactly as Isaiah 6:2 describes.',
      },
    ],
    punchZh: '六章全章记下最精准的身体秩序：宝座只见至高荣光与 **垂下遮满圣殿的衣裳**；而在左右侍立的撒拉弗连六个翅膀都有严格分工——**两翼遮脸、两翼遮脚，只有两翼用来飞**。',
    punchEn: 'Every detail follows the holiness of the room: an **aniconic throne** whose train fills the 20-cubit sanctuary floor, flanked by **Seraphim using 4 of their 6 wings for reverence** (covering face and feet) and only 2 to fly.',
    compare: [
      { zh: '圣殿内殿宽（20 普通肘）', en: 'Sanctuary inner width (20 cubits)', m: 8.9 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'nineveh-three-days',
    zh: '尼尼微大城三日路程与约拿城东的棚',
    en: 'Nineveh & Jonah’s Eastward Booth',
    ref: 'Jonah 3:3',
    refZh: '约拿书 3:3',
    textZh: '约拿便照雅伟的话起来，往尼尼微去。这尼尼微是极大的城，有三日的路程。',
    textEn: 'So Jonah arose, and went unto Nineveh, according to the word of Yahweh. Now Nineveh was an exceeding great city of three days’ journey.',
    dims: [
      { key: 'basin-w', zh: '沙盘底格里斯河谷东西跨度', en: 'Upper Tigris basin relief east–west span', cubits: 90, ref: '拿 3:3; 4:5', refEn: 'Jonah 3:3; 4:5' },
      { key: 'basin-h', zh: '沙盘南北跨度（含东面丘陵）', en: 'North–south basin relief span', cubits: 88, ref: '拿 3:3–4', refEn: 'Jonah 3:3–4' },
    ],
    kind: 'ninevehRelief',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '底格里斯河东岸尼尼微古城遗址至东部山丘的实测地理跨度。',
      noteEn: 'Georeferenced span across the Upper Tigris river plain at Nineveh and its eastern hills.',
    },
    counts: [
      { zh: '形容尼尼微极大的路程日数', en: 'Days’ journey across Nineveh', n: 3, ref: '拿 3:3', refEn: 'Jonah 3:3' },
      { zh: '约拿初进城宣告的日数', en: 'Days’ journey Jonah walked in declaring judgement', n: 1, ref: '拿 3:4', refEn: 'Jonah 3:4' },
      { zh: '城中不能分辨左手右手的人口下限', en: 'Population unable to tell right hand from left (minimum)', n: 120000, ref: '拿 4:11', refEn: 'Jonah 4:11' },
      { zh: '全城闻警宣告禁食回转的限期天数', en: 'Days warned until overthrow ("yet 40 days")', n: 40, ref: '拿 3:4', refEn: 'Jonah 3:4' },
    ],
    variants: {
      key: 'ninevehView',
      zh: '展示视角',
      en: 'View',
      options: [
        {
          id: 'walled-metropolis',
          zh: '尼尼微地形沙盘 · 底格里斯河、十五城门垣、一日入城路与城东山冈',
          en: 'Tigris basin relief · walled city (15 gates), 1-day entry & east hill',
          note: '按实测经纬度（43.15°E, 36.36°N）画出流经城西的底格里斯河、护城土墙与十五座大城门轮廓、古运吉克宫殿台地、入城走了一日的金色轴线（拿 3:4），以及约拿出城所坐的东面高坡（拿 4:5）。',
          noteEn: 'Georeferenced Upper Tigris relief showing the river along Nineveh’s western wall, its walled enclosure with 15 historic gate towers, Kuyunjik and Nebi Yunus mounds, the 1-day proclamation path (Jonah 3:4) and Jonah’s eastern overlook hill (4:5).',
        },
        {
          id: 'jonah-booth',
          zh: '一比一城东的棚 · 蓖麻荫凉与黎明虫咬枯萎（拿 4:5–8）',
          en: '1:1 booth east of Nineveh · gourd shade & withered base (Jonah 4:5–8)',
          note: '把镜头拉进城东土台，并立在 **1.72 米**参照人旁：四根粗木搭起稀疏透光的枝条小棚、雅伟神安排迅速长起遮顶的一棵宽叶蓖麻（兼标茎基遭虫咬与迎向东风焦枯的边缘叶，拿 4:6–8），远眺西边低谷城墙线。',
          noteEn: 'At 1:1 scale beside a 1.72 m reference figure on the eastern terrace: Jonah’s gappy 4-post branch booth (Jonah 4:5), the towering broad-leaved gourd overhead showing both cool shade and the worm-gnawed stem base / east-wind scorched edge (4:6–8), looking west toward the distant city wall.',
        },
      ],
    },
    unstated: [
      {
        zh: '「三日的路程」究竟指绕城一圈或贯穿大尼尼微行政都会区的总步行距离（现代发掘尼尼微内城墙周长约 12 公里、十五座门，而包含周边附郭村镇的大尼尼微都区约合古代三日步行），学者向有两解；沙盘内墙框按地形放大以便看清城内丘阜与西岸大河。',
        en: 'Whether "three days’ journey" denotes the greater Nineveh administrative triangle (~50–90 km, inside which >120,000 people dwelt) or ceremonial diplomatic inspection of the walled inner city (~12 km wall circuit with 15 gates) is debated; the inner rampart is enlarged relative to the basin relief for clarity.',
      },
      {
        zh: '拿 4:5 所搭之棚与 4:6「蓖麻」（希伯来文 qiqayon，多考为高大宽叶蓖麻树）的具体尺寸经文未记；1:1 棚景高约 1.9–2.3 米属生活比例还原。',
        en: 'Dimensions of the eastern booth (Jonah 4:5) and rapid gourd vine (Hebrew qiqayon, 4:6) are unstated; the 1:1 terrace model uses domestic human scale (~1.9–2.3 m).',
      },
    ],
    punchZh: '一面是底格里斯河畔 **容纳超过十二万不能分辨左右手之人、三日路程方能走尽** 的亚述大城；另一面却是城东山坡上 **一间漏风草棚与一棵一夜长成又一夜枯干的蓖麻**——经文故意用两套极端大小对比出一先知的狭隘与神对全城的怜惜。',
    punchEn: 'Side by side on one card: the **Tigris river metropolis** of **>120,000** souls on a **three days’ journey** scale, and **one fragile branch booth** shaded by a single gourd plant — setting Jonah’s smallness against Yahweh’s mercy.',
    compare: [
      { zh: '底格里斯河谷与东坡沙盘跨度', en: 'Nineveh basin relief span', m: 90_000 },
      { zh: '尼尼微城东草棚与蓖麻（约高）', en: 'Jonah’s booth & gourd (1:1 approx.)', m: 2.3 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'beatitudes-multitude',
    zh: '山上的宝训与五千人草地分坐沙盘',
    en: 'Mount of Beatitudes Amphitheatre Relief',
    ref: 'Matthew 5:1',
    refZh: '马太福音 5:1',
    textZh: '耶稣看见这许多的人，就上了山，既已坐下，门徒到他跟前来，',
    textEn: 'And seeing the multitudes, he went up into a mountain: and when he was set, his disciples came unto him:',
    dims: [],
    kind: 'beatitudesHillside',
    counts: [
      { zh: '上山就近他的门徒', en: 'Disciples gathering beside him', n: 12, ref: '太 5:1; 10:1–4', refEn: 'Matt 5:1; 10:1–4' },
      { zh: '马太五至七章登山宝训所记八福条目', en: 'Beatitudes opening the discourse', n: 8, ref: '太 5:3–10', refEn: 'Matt 5:3–10' },
      { zh: '后来绿草地分坐的男人人数（另有妇女儿童）', en: 'Men later fed on the green grass (besides women & children)', n: 5000, ref: '太 14:21; 可 6:40', refEn: 'Matt 14:21; Mark 6:40' },
      { zh: '收拾剩下零碎装满的篮子', en: 'Baskets full of gathered fragments', n: 12, ref: '太 14:20', refEn: 'Matt 14:20' },
    ],
    variants: {
      key: 'beatitudesView',
      zh: '山地视角',
      en: 'Hillside view',
      options: [
        {
          id: 'hillside-seat',
          zh: '山上座位 · 从玄武石座向下俯瞰整片面向加利利海的听众',
          en: 'Teacher’s basalt seat · looking down the natural amphitheatre toward Galilee',
          note: '遵守设计原意（「你坐在他坐的地方，看见那群人」）：高处深灰玄武石座上只留一件叠放的麻布外衣（不塑耶稣面容），十二位短发门徒围坐近旁，顺着面向碧蓝加利利海的青草斜坡一层层坐满倾听的群众（太 5:1–2）。',
          noteEn: 'Places the viewer at the crest basalt seat (bearing only a folded linen cloak — no facial sculpture of Jesus) encircled by 12 short-haired disciples, looking down the green grassy slope toward the Sea of Galilee and the gathered multitude (Matt 5:1–2).',
        },
        {
          id: 'five-thousand-ranks',
          zh: '青草地一排一排坐下 · 五饼二鱼、百人与五十人方阵及十二个篮子（太 14:19–21；可 6:40）',
          en: 'Companies of 100s & 50s on green grass · 5 loaves, 2 fish & 12 baskets (Matt 14:19–21)',
          note: '切换成五千人吃饱时刻：草坡上的群众按马可福音 6:40 整齐分成「一百的、五十的」一排一排方阵（每组队列清楚分明）；上方石盘放着五个大麦饼与两条鱼，左右摆开装满剩零碎的十二个提篮（太 14:17, 20）。',
          noteEn: 'Re-arranges the hillside crowd into the ordered green-grass companies of 100s and 50s described in Mark 6:40 / Matt 14:19, placing 5 loaves, 2 fish and all 12 full baskets beside the crest seat (Matt 14:17, 20).',
        },
      ],
    },
    unstated: [
      {
        zh: '太 5:1 与可 6:40 / 太 14:19 都记述了面对加利利海青草坡面的天然露天剧场式地形，但经文并未定出「那山」的海拔高度或斜坡面积；沙盘人群点位按比例示意「许多人 / 一排一排有一百的有五十的」，而非逐一摆出五千个独立模型。',
        en: 'Neither the exact hill coordinates above Galilee nor slope area are stated in Matthew 5:1 or 14:19; crowd ranks are scaled schematically around the 12 disciples and ordered 50/100 groups.',
      },
      {
        zh: '全场景不雕琢耶稣五官容貌：仅以山巅玄武石座与身旁十二短发门徒确定讲话人的视角位置，让读者自己站在山顶看见下方直到湖岸的人群。',
        en: 'No procedural facial portrait of Jesus is sculpted; the upper basalt boulder and linen mantle establish the speaker’s vantage point looking out over disciples, hillside crowd and lake.',
      },
    ],
    punchZh: '从山坡高处的玄武石座往下看，整面斜坡就是一座天然回音剧场：**背后是青草与风声，脚下一直延伸到加利利海面**；无论宝训还是分坐 **一百的、五十的**，都在这张山海坡地上发生。',
    punchEn: 'From the speaker’s basalt boulder down to the blue Sea of Galilee, the grassy slope acts as one natural amphitheatre — both for **the Beatitudes** and for the ordered companies with **12 gathered baskets**.',
    compare: [
      { zh: '展示沙盘跨度（加利利山坡）', en: 'Galilee hillside diorama span', m: 12.2 },
      { zh: '一个成年人（比例参照）', en: 'Adult human (scale reference)', m: 1.72 },
    ],
  },
  {
    id: 'galilee-storm-boat',
    zh: '加利利海风浪中的渔船与船尾枕头',
    en: 'Galilee Boat in Storm & Great Calm',
    ref: 'Mark 4:37',
    refZh: '马可福音 4:37',
    textZh: '忽然起了暴风，波浪打入船内，甚至船要满了水。',
    textEn: 'And there arose a great storm of wind, and the waves beat into the ship, so that it was now full.',
    dims: [
      { key: 'hull-l', zh: '一世纪加利利海木船参照船长（基诺萨遗址）', en: '1st-century Galilee boat length (Ginosar hull ref.)', cubits: 8.2, ref: '可 4:37（考古参照）', refEn: 'Mark 4:37 (arch. ref.)' },
      { key: 'hull-w', zh: '船腹最大宽度', en: 'Beam width', cubits: 2.3, ref: '可 4:37（考古参照）', refEn: 'Mark 4:37 (arch. ref.)' },
      { key: 'hull-h', zh: '船舷深', en: 'Hull depth', cubits: 1.2, ref: '可 4:37（考古参照）', refEn: 'Mark 4:37 (arch. ref.)' },
    ],
    kind: 'galileeBoat',
    unit: {
      zh: '米',
      en: 'm',
      m: 1,
      note: '马可福音未给出船只尺寸；采用加利利湖西北岸（基诺萨 / Kinneret）出土的一世纪同年代渔船实测尺寸（约 8.2 × 2.3 × 1.2 米）作为物理尺度。',
      noteEn: 'Mark gives no dimensions for the boat; this 1:1 model uses the real measurements of the excavated 1st-century Sea of Galilee boat from Ginosar (~8.2 × 2.3 × 1.2 m).',
    },
    counts: [
      { zh: '可 4:37–38 记载在船尾睡觉所垫的物件（枕头）', en: 'Cushion in the stern (Mark 4:38)', n: 1, ref: '可 4:38', refEn: 'Mark 4:38' },
      { zh: '船内可见的橡木肋骨框架（考古参照）', en: 'Oak hull frame ribs (Ginosar ref.)', n: 12, ref: '可 4:37（考古参照）', refEn: 'Mark 4:37 (arch. ref.)' },
      { zh: '每侧划桨（配四支长木桨）', en: 'Wooden rowing oars', n: 4, ref: '可 4:37', refEn: 'Mark 4:37' },
    ],
    variants: {
      key: 'galileeBoatView',
      zh: '海况瞬间',
      en: 'Sea state',
      options: [
        {
          id: 'storm-waves',
          zh: '暴风骇浪 · 浪头打过左舷、船舱积水与船尾枕头（可 4:37–38）',
          en: 'Great squall · breaking waves over gunwale, flooded bilge & stern cushion (Mark 4:37–38)',
          note: '木船仅 8.2 米长、舷高 1.2 米：迎着突然从戈兰山谷猛冲下来的狂风大浪剧烈倾斜，白沫浪头正翻过左船舷灌入敞开的腰舱（可 4:37），主桅已放倒缚在座板上，高起的船尾甲板下只见那个编织枕头（可 4:38，不塑耶稣面容）。',
          noteEn: 'At full 1:1 scale (only 8.2 m long, 1.2 m hull depth!), the cedar hull heels in a steep Galilee trough as foam breaks over the port gunwale into the open bilge (Mark 4:37), the lowered mast lashed along the thwarts and the woven stern cushion resting under the raised stern deck (4:38 — zero figure of Jesus sculpted).',
        },
        {
          id: 'great-calm',
          zh: '风止大静 · 镜面湖水上静立，细看一世纪香柏橡木船体（可 4:39）',
          en: 'Great calm · glass-smooth Galilee water & full timber frame inspection (Mark 4:39)',
          note: '斥责风与海之后「大大地平静了」（可 4:39）：船身平正浮在如镜水面，桅杆重新立起，旁边立着 **1.72 米**普通人身高对照，能清楚感受一条能坐十几个渔夫的船实际有多浅多小。',
          noteEn: 'After "Peace, be still!" comes "a great calm" (Mark 4:39): level on mirror-still water with stepped mast beside the 1.72 m figure — making clear just how shallow a 1.2 m open hull feels in a sudden squall.',
        },
      ],
    },
    unstated: [
      {
        zh: '**马可福音本身没有记录船的长宽高尺寸**，只指明这是一只小渔船，有可放倒的帆具或桨、有水打入舱内、还有高出水面可供躺卧垫头的船尾（「船尾上，枕着枕头」，可 4:38）。上方 **8.2 × 2.3 × 1.2 米** 取自 1986 年在加利利湖边基诺萨出土的公元一世纪木船实物。',
        en: '**Mark records no linear measurements** for the boat, stating only that it carried disciples across the lake, took waves into its open hull, and had a stern with a cushion (Mark 4:37–38). The **8.2 × 2.3 × 1.2 m** hull derives from the excavated 1st-century Kinneret/Ginosar boat.',
      },
      {
        zh: '严守不轻率用低模雕出耶稣面像的原则，模型只实做船尾甲板下那一只「枕头」，让你站在 **1.72 米**高人的旁边亲眼测量船舷究竟离浪面有多近。',
        en: 'Following the policy against low-poly facial depictions of Jesus, only the stern cushion beneath the raised stern deck is modelled, letting the 1.72 m reference figure reveal the exact freeboard height.',
      },
    ],
    punchZh: '船身只有 **八米二长、一米二深**：在旁边站一个 **1.72 米** 的人就会立刻明白，为什么戈兰谷口突然吹下一阵狂风，浪头轻易就能直接漫过齐腰的船舷，让全船「就要满了水」。',
    punchEn: 'Only **8.2 m long and 1.2 m deep** beside a **1.72 m** human — standing next to the real gunwale height immediately explains why a sudden downslope squall could fill an open boat in minutes.',
    compare: [
      { zh: '一世纪加利利渔船长（考古参照）', en: '1st-century Galilee boat length (arch. ref.)', m: 8.2 },
      { zh: '木船船腹最大宽度', en: 'Boat beam width', m: 2.3 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '船舷总深（近齐人胸）', en: 'Hull depth (only chest-high)', m: 1.2 },
    ],
  },
  {
    id: 'bethlehem-manger',
    zh: '伯利恒石屋与石灰石马槽（无牛驴臆测）',
    en: 'Bethlehem Guest-Room House & Stone Manger',
    ref: 'Luke 2:7',
    refZh: '路加福音 2:7',
    textZh: '就生了头胎的儿子，用布包起来，放在马槽里，因为客店里没有地方。',
    textEn: 'And she brought forth her firstborn son, and wrapped him in swaddling clothes, and laid him in a manger; because there was no room for them in the inn.',
    dims: [],
    kind: 'bethlehemManger',
    assumedHeight: 3.63,
    counts: [
      { zh: '路 2:7–12 实际点名的三件实在事物（婴孩所裹的布、马槽、已满的客店）', en: 'Three things actually named (swaddling cloth, manger, crowded guest room)', n: 3, ref: '路 2:7, 12', refEn: 'Luke 2:7, 12' },
      { zh: '牛与驴在四卷福音书中的出现次数（零次）', en: 'Oxen and donkeys mentioned at the manger in Scripture (zero)', n: 0, ref: '路 2:7', refEn: 'Luke 2:7' },
    ],
    variants: {
      key: 'mangerView',
      zh: '建筑视角',
      en: 'View',
      options: [
        {
          id: 'cutaway-house',
          zh: '伯利恒两层犹大山地石屋剖面 · 满挤的楼上客房（κατάλυμα）与下层石柱喂槽间',
          en: 'Cutaway Judean limestone house · packed upper guest room & lower stone-trough bay',
          note: '拆去后世欧式木棚、牛与驴的浪漫加添：呈现实地常见的一世纪犹大山地两层石屋剖面。高出一米多的上层客房（κατάλυμα）已铺满旅人的卷席、行囊与水罐（「客店里没有地方」）；下方依山石底层石柱之间凿有整块石灰石槽，中心石槽铺草放着白细麻包布襁褓（不塑脸部）。',
          noteEn: 'Replaces later European wooden-barn and ox/ass traditions with an authentic two-level 1st-century Judean limestone house cutaway: the raised guest room (katalyma) packed with traveler mats and jars ("no room"), and the lower rock-backed pillar bay holding monolithic carved limestone feeding troughs with folded swaddling cloth inside (zero ox/ass, zero sculpted face).',
        },
        {
          id: 'stone-manger-detail',
          zh: '一比一整块凿空石灰石马槽与系绳石柱 · 包布与希律时期陶油灯',
          en: '1:1 chiselled limestone manger & tie-pier · swaddling bands & oil lamp',
          note: '按一比一放在 **1.72 米**人旁细看：一世纪犹大地一带马槽多整块从厚重石灰石中凿空（约 0.95 × 0.58 米），并非欧洲木架草槽；槽旁立着带穿孔系绳眼的门柱石墩，上面点着一盏单嘴陶油灯，照亮槽里洁净的细麻包布。',
          noteEn: 'At 1:1 scale beside the 1.72 m companion figure: a monolithic hollowed Judean limestone manger (~0.95 × 0.58 m — unlike timber troughs of medieval Europe), flanked by a drilled tethering pier with a Herodian clay oil lamp illuminating the clean linen swaddling cloth inside.',
        },
      ],
    },
    unstated: [
      {
        zh: '**路加福音只记了三件事：用布包起来、放在马槽里、因为客店（κατάλυμα，民居高起的客房/客堂）里没有地方。** 牛、驴、高顶木仓房在整卷新约全无根据，因此本模型一头牛、一头驴都没有画。',
        en: '**Luke mentions only swaddling clothes, a manger, and no room in the katalyma (guest chamber).** Oxen, donkeys, and northern timber barns do not appear anywhere in the text and are deliberately omitted.',
      },
      {
        zh: '马槽尺寸（约 0.95 × 0.56 × 0.58 米）、两层犹大山地灰石民居高低落差（上层客房高约 1 米）系依据伯利恒、巴勒斯坦山地一世纪民居与米吉多、贝尔谢巴一带凿石喂槽考古实例复原，经文本身未记寸尺；不塑婴孩面孔。',
        en: 'Trough size (~0.95 × 0.56 × 0.58 m) and two-level stone house geometry come from 1st-century Judean hill-country domestic archaeology and ancient carved limestone troughs rather than explicit measurements in Luke; zero facial features are sculpted.',
      },
    ],
    punchZh: '经文只记下 **洁净包布、石头马槽、挤满人的上层客房**——牛和驴一只都不在场。一世纪犹大地的马槽通常就是从整块白色石灰石凿出来、安在民居下层石柱之间的厚实石槽。',
    punchEn: 'Only **linen swaddling bands, a hollowed limestone trough, and a packed upper guest room** appear in Luke 2:7 — zero oxen, zero donkeys, and zero medieval wooden stable.',
    compare: [
      { zh: '伯利恒石屋剖面参照总高', en: 'Bethlehem stone house cutaway height', m: 3.63 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '凿空整石马槽长（考古参照）', en: 'Carved limestone manger length (arch. ref.)', m: 0.95 },
    ],
  },
  {
    id: 'paul-letters-network',
    zh: '保罗十三卷书信收信城邑与地中海地形沙盘',
    en: 'Paul’s Letters & Recipient Cities Relief',
    ref: 'Romans 1:7',
    refZh: '罗马书 1:7',
    textZh: '我写信给你们在罗马、为神所爱、奉召作圣徒的众人。愿恩惠、平安从我们的父神并主耶稣基督归与你们！',
    textEn: 'To all that be in Rome, beloved of God, called to be saints: Grace to you and peace from God our Father, and the Lord Jesus Christ.',
    dims: [
      { key: 'basin-ew', zh: '收信城邑东西跨度（罗马至加拉太）', en: 'Recipient span (Rome to Galatia)', cubits: 1950, ref: '罗–门', refEn: 'Rom–Phlm' },
      { key: 'basin-ns', zh: '南北跨度（帖撒罗尼迦至革哩底 / 耶路撒冷）', en: 'North–south span (Thessalonica to Crete / Jerusalem)', cubits: 1120, ref: '帖前–多; 罗 15:25', refEn: '1 Thess–Titus; Rom 15:25' },
    ],
    kind: 'paulLettersRelief',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '罗马、马其顿、亚该亚、亚西亚、加拉太与革哩底各收信教会之间的实测地理跨度。',
      noteEn: 'Georeferenced Mediterranean distances across every city and island addressed by Paul’s thirteen epistles.',
    },
    counts: [
      { zh: '保罗书信正典卷数（九卷致教会/地区、四卷致同工个人）', en: 'Canonical epistles of Paul (9 church/regional, 4 personal/pastoral)', n: 13, ref: '罗 1–门 1', refEn: 'Rom–Phlm' },
      { zh: '写信最常驻留的三大中心（哥林多、以弗所、罗马）', en: 'Three major writing hubs (Corinth, Ephesus, Rome)', n: 3, ref: '徒 18–28; 罗 16:1', refEn: 'Acts 18–28; Rom 16:1' },
    ],
    variants: {
      key: 'paulLettersView',
      zh: '书信网层',
      en: 'Epistle layer',
      options: [
        {
          id: 'all-epistles',
          zh: '全部十三封书信递送弧线 · 从哥林多、以弗所、马其顿与罗马分送八方',
          en: 'All 13 epistles · dispatch arcs from Corinth, Ephesus, Macedonia & Rome',
          note: '按实际山川海陆高程在每座收信城邑垒起红蜡封印的羊皮书卷（例如罗马一卷、哥林多两卷、加拉太一卷、以弗所三卷含提摩太上下、腓立比一卷、歌罗西两卷含腓利门、帖撒罗尼迦两卷、革哩底提多书一卷），金色、翠绿与朱红弧线飞越海湾与托鲁斯山地标明去向。',
          noteEn: 'Stacks the exact number of wax-sealed scrolls on each attested destination city (Rome 1, Corinth 2, Galatia 1, Ephesus 3 incl. 1–2 Tim, Philippi 1, Colossae 2 incl. Phlm, Thessalonica 2, Crete 1) with arched dispatch lines over sea and Taurus highlands.',
        },
        {
          id: 'prison-and-pastoral',
          zh: '聚焦罗马监狱书信弧线 · 腓立比、以弗所、歌罗西（带老底嘉互念）、腓利门与提后',
          en: 'Focus · Rome imprisonment arcs (Eph, Phil, Col, Phlm, 2 Tim)',
          note: '淡化早期宣教行程书信，凸显亚庇乌尽头的罗马如何以朱红跨海高弧把四封监狱书信与提摩太后书送回腓立比、以弗所与吕科斯河谷的歌罗西（并旁标西 4:16 要与老底嘉互换宣读）。',
          noteEn: 'Highlights the Roman dispatch arcs sweeping back across the Adriatic and Aegean to Philippi, Ephesus and Colossae/Laodicea (Col 4:16), plus 2 Timothy back to Ephesus.',
        },
      ],
    },
    unstated: [
      {
        zh: '十三卷书信绝大多数在经文中显明了收信城邑或地区，但发信地点有一半以上（如哥林多后书、以弗所写加拉太或哥林多前书等）需比对使徒行传行踪与信末问安（如林前 16:8；罗 16:1；西 4:9）推定；加拉太书系写给南加拉太（以哥念、路司得一带）或北加拉太，沙盘兼标省区与南城枢纽。',
        en: 'Destination cities are named in the letters themselves, whereas several dispatch origins (e.g. Corinth/Cenchreae for Romans, Ephesus for 1 Corinthians, Macedonia for 2 Corinthians, and Rome vs. Ephesus/Caesarea for the Prison Epistles) are inferred from Acts and closing greetings; South Galatian cities and Galatia province are both marked.',
      },
      {
        zh: '跨海弧线高起仅为跨过安纳托利亚与希腊高山起伏而作立体视觉抬升，不代表实际航线走直线不靠港。',
        en: 'Elevated parabolic courier arcs rise over mountain terrain purely for visual legibility rather than implying non-stop direct flights.',
      },
    ],
    punchZh: '保罗十三卷书信占尽新约一多半篇幅，但它们原不是抽象论文，而是 **十三封真正坐船过山、写给八处实打实城邑与同工、按邮路送上手的信**。',
    punchEn: 'Paul’s **13 letters** were never floating essays — they travelled over real Aegean straits, Macedonian roads and Lycus valleys between **eight concrete cities and islands**.',
    compare: [
      { zh: '罗马至加拉太东西跨度', en: 'Rome to Galatia east–west span', m: 1_950_000 },
      { zh: '歌罗西至老底嘉互换书信仅隔（西 4:16）', en: 'Colossae to Laodicea letter exchange (Col 4:16)', m: 17_000 },
    ],
  },
  {
    id: 'dispersion-provinces-relief',
    zh: '彼得前书五省分散寄居地形沙盘',
    en: 'Five Provinces of 1 Peter 1:1 Relief',
    ref: '1 Peter 1:1',
    refZh: '彼得前书 1:1',
    textZh: '耶稣基督的使徒彼得写信给那分散在本都、加拉太、加帕多家、亚西亚、庇推尼寄居的，',
    textEn: 'Peter, an apostle of Jesus Christ, to the strangers scattered throughout Pontus, Galatia, Cappadocia, Asia, and Bithynia,',
    dims: [
      { key: 'anatolia-ew', zh: '小亚细亚东西全宽（爱琴海至黑海东部本都）', en: 'Anatolian east–west span (Aegean to eastern Pontus)', cubits: 1280, ref: '彼前 1:1', refEn: '1 Pet 1:1' },
      { key: 'anatolia-ns', zh: '黑海至托鲁斯山脉南北跨度', en: 'Black Sea to Taurus north–south span', cubits: 680, ref: '彼前 1:1', refEn: '1 Pet 1:1' },
    ],
    kind: 'dispersionRelief',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '黑海沿岸本都、中央高原加拉太与火山高地加帕多家、爱琴海东岸亚西亚与西北庇推尼的实测地形跨度。',
      noteEn: 'Georeferenced relief span across northern, central and western Asia Minor.',
    },
    counts: [
      { zh: '彼得前书开篇依顺时针所列的罗马行省数', en: 'Roman provinces named in clockwise order', n: 5, ref: '彼前 1:1', refEn: '1 Pet 1:1' },
      { zh: '递送此信的书信执笔者 / 携信人（西拉）', en: 'Bearer / amanuensis named (Silvanus)', n: 1, ref: '彼前 5:12', refEn: '1 Pet 5:12' },
    ],
    variants: {
      key: 'dispersionView',
      zh: '阅读焦点',
      en: 'Focus',
      options: [
        {
          id: 'five-provinces-loop',
          zh: '黑海登岸顺时针大环路 · 本都（1）→ 加拉太（2）→ 加帕多家（3）→ 亚西亚（4）→ 庇推尼（5）',
          en: 'Clockwise courier loop · 1 Pontus -> 2 Galatia -> 3 Cappadocia -> 4 Asia -> 5 Bithynia',
          note: '按 1 Peter 1:1 经文的点名次序与底层金环圈数（1 至 5 圈）：先从黑海西诺普 / 阿米苏港口上岸进入**本都**，翻越高山南入**加拉太、加帕多家**，再顺河谷西行抵达**亚西亚**（以弗所），最后北上**庇推尼**归海。',
          noteEn: 'Marks the exact order of 1 Peter 1:1 with 1–5 stacked gold rings at each province: landing from the Black Sea into Pontus (1), crossing highland Galatia (2) and volcanic Cappadocia (3), descending to Asia (4) and turning north through Bithynia (5).',
        },
        {
          id: 'anatolian-highlands',
          zh: '全区山脉与高原对照 · 庞廷海岸山脉、安纳托利亚大高原、艾尔吉耶斯火山与托鲁斯南墙',
          en: 'Highland barriers · Pontic Alps, Galatian steppe, Mt. Argaeus & Taurus wall',
          note: '放淡路线管线，直观辨认这五个广袤行省之间为什么难以一步跨过——北边是险峻多雨的庞廷海岸山脊、当中是严寒干旷的安纳托利亚高原与加帕多家高地、南边阻着高耸的托鲁斯雪山。',
          noteEn: 'Recedes the road tube so the physical barriers dividing the five provinces stand clear: forested Pontic coastal ridges in the north, the central plateau, Cappadocia’s eastern massif and the southern Taurus range.',
        },
      ],
    },
    unstated: [
      {
        zh: '彼前 1:1 点的是五个涵盖百万平方公里级的辽阔罗马省分而非单一城名；沙盘上的标桩落在各省的历史地理核心位置（加帕多家与加拉太边界随罗马时期略有调整），虚金线所连乃是从黑海入山区的顺时针合理驿道顺序。',
        en: '1 Peter 1:1 names five huge Roman provinces rather than individual towns; pins sit at historic provincial heartlands (Pontus, Galatia, Cappadocia, Asia, Bithynia), and the loop traces the clockwise courier route explaining why Pontus opens and Bithynia closes the list.',
      },
      {
        zh: '垂直高差相对 1,280 公里横宽显著放大，使黑海海岸山脉、中土高原与加帕多家火山群峰手感清晰。',
        en: 'Vertical elevation is exaggerated against the 1,280 km span so Pontic ridges, Anatolian tableland and Cappadocian peaks read tactilely.',
      },
    ],
    punchZh: '彼得前书开头一串地理名词并非乱排：**本都、加拉太、加帕多家、亚西亚、庇推尼**，顺着地形画出来，恰好是一条**从黑海港口登录，顺时针绕遍整个小亚细亚高地与河谷**的不折返送信环路。',
    punchEn: 'The order of provinces in 1 Peter 1:1 is not random: plotted across real Anatolian relief, **Pontus -> Galatia -> Cappadocia -> Asia -> Bithynia** traces an exact clockwise mail loop entering from the Black Sea.',
    compare: [
      { zh: '小亚细亚五省东西宽', en: 'Five provinces east–west width', m: 1_280_000 },
      { zh: '黑海至托鲁斯山脉南北跨度', en: 'Black Sea to Taurus span', m: 680_000 },
    ],
  },
  {
    id: 'david-temple-preparations',
    zh: '大卫预备建殿的材料与样式桌',
    en: 'David’s Temple Preparations & Pattern Table',
    ref: '1 Chronicles 22:14',
    refZh: '历代志上 22:14',
    textZh: '我在困难之中为雅伟的殿预备了金子十万他连得，银子一百万他连得，铜和铁多得无法可称；我也预备了木头、石头，你还可以增添。',
    textEn: 'Now, behold, in my affliction I have prepared for the house of Yahweh a hundred thousand talents of gold, and a thousand thousand talents of silver, and of brass and iron without weight; for it is in abundance: timber also and stone have I prepared; and thou mayest add thereto.',
    dims: [
      { key: 'beam-span', zh: '圣所参照横梁宽（所罗门殿内宽 20 肘）', en: 'Sanctuary reference beam (20 cubits breadth)', cubits: 20, ref: '代上 28:11; 王上 6:2', refEn: '1 Chr 28:11; 1 Kgs 6:2' },
      { key: 'maquette-len', zh: '殿宇正身样式对照长', en: 'Pattern Temple main length reference', cubits: 60, ref: '王上 6:2; 代上 28:11', refEn: '1 Kgs 6:2; 1 Chr 28:11' },
    ],
    kind: 'davidPreparations',
    counts: [
      { zh: '预备金子（他连得）', en: 'Gold prepared (talents)', n: 100000, ref: '代上 22:14', refEn: '1 Chr 22:14' },
      { zh: '预备银子（他连得）', en: 'Silver prepared (talents)', n: 1000000, ref: '代上 22:14', refEn: '1 Chr 22:14' },
    ],
    variants: {
      key: 'davidPrepView',
      zh: '场景视图',
      en: 'Scene view',
      options: [
        {
          id: 'stockpile-yard',
          zh: '大卫预备料场 · 20 肘参照木梁旁金、银、铜、铁与香柏木凿石堆场',
          en: 'Treasury stockpile yard beside 20-cubit sanctuary reference beam',
          note: '以真实比例摆放十万他连得金锭叠堆、十倍体量的银锭叠堆、铜环铜柱、成捆熟铁、凿好方石与黎巴嫩香柏木；后方架设按所罗门圣所内宽 **20 肘** 实测的香柏参照横梁，可拖动**肘长滑块**观察基准尺度随肘长微调。',
          noteEn: 'Displays gold and tenfold-larger silver ingot pyramids alongside bronze rings, forged iron bundles, dressed ashlar stone, cedar logs, and a rear cedar reference beam matching the **20-cubit** sanctuary breadth (live cubit-slider reactive).',
        },
        {
          id: 'blueprint-table',
          zh: '交与所罗门的样式桌 · 殿宇比例模型、写下样式的书卷与按分两称出的器皿坯料',
          en: 'Pattern table · Temple maquette, written scrolls & weighed vessel blanks',
          note: '呈现大卫将殿的廊子、旁屋、库房与施恩座的指示交与所罗门（代上 28:11–18）：桌面按 **60 × 20 肘** 等比缩放木与金的殿宇样式，旁列写有指示的羊皮卷轴与按分两秤好的金灯台、银器皿坯件。',
          noteEn: 'Shows David handing Solomon the pattern of the porch, houses, treasuries and mercy seat (1 Chr 28:11–18): a **60 × 20 cubit** scaled Temple maquette beside written scrolls and weighed gold lampstand and silver vessel blanks.',
        },
      ],
    },
    unstated: [
      {
        zh: '十万他连得金（约合三千余公吨）与一百万他连得银若全部实际堆放，体量远超单座庭院；本场景在保留 10:1 金银叠堆体量对比的前提下将其按可观览规模呈现，并以实测 20 肘香柏参照梁与 1.72 米人像锚定地面比例。',
        en: 'Full physical stacking of 100,000 talents of gold and 1,000,000 talents of silver (~3,400 and ~34,000 metric tons) would dwarf a single courtyard; the stacks preserve a 10:1 visual mass ratio anchored against a true 20-cubit beam and 1.72 m figure.',
      },
    ],
    punchZh: '大卫一生被雅伟告知不可亲手建殿（代上 22:8），却把**整座圣所的尺寸样式与金银铜铁木石全部预备齐整**，好叫儿子所罗门直接兴工。',
    punchEn: 'Forbidden to build the Temple himself (1 Chr 22:8), David prepared every measure, written pattern and stockpile in advance so Solomon could begin immediately.',
    compare: [
      { zh: '参照圣所横梁宽（20 肘）', en: 'Reference sanctuary beam (20 cubits)', m: 10.5 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'enclosed-garden-seven-pillars',
    zh: '关锁的园、封闭的井与智慧的七根柱子',
    en: 'Enclosed Garden, Sealed Fountain & Wisdom’s Seven Pillars',
    ref: 'Song of Songs 4:12',
    refZh: '雅歌 4:12',
    textZh: '我妹子，我新妇，乃是关锁的园，禁闭的井，封闭的泉源。',
    textEn: 'A garden shut up is my sister, my bride; a spring shut up, a fountain sealed.',
    dims: [
      { key: 'garden-w', zh: '石砌果园东西围墙跨度', en: 'Walled garden east–west span', cubits: 7.2, ref: '歌 4:12', refEn: 'Song 4:12' },
      { key: 'wall-h', zh: '园墙高度', en: 'Garden enclosure wall height', cubits: 2.05, ref: '歌 4:12', refEn: 'Song 4:12' },
    ],
    kind: 'enclosedGarden',
    unit: {
      zh: '米',
      en: 'm',
      m: 1,
      note: '按古代以色列石砌庭园泉井与柱廊常见实尺呈现。',
      noteEn: 'Illustrative metre scale matching ancient Israelite walled gardens, spring wells and pillared porticos.',
    },
    counts: [
      { zh: '智慧房屋凿成的柱子（箴 9:1）', en: 'Carved pillars of Wisdom’s house (Prov 9:1)', n: 7, ref: '箴 9:1', refEn: 'Prov 9:1' },
      { zh: '井泉四周结果子的石榴树（歌 4:13）', en: 'Fruiting pomegranate trees (Song 4:13)', n: 4, ref: '歌 4:13', refEn: 'Song 4:13' },
    ],
    variants: {
      key: 'enclosedGardenView',
      zh: '智慧诗歌场景',
      en: 'Wisdom poetry view',
      options: [
        {
          id: 'walled-spring-garden',
          zh: '关锁的园与封闭的泉源 · 上闩香柏木门、铜印封盖的八角井与四棵石榴树（歌 4:12–15）',
          en: 'Walled garden · barred cedar gate, sealed octagonal well & pomegranate orchard',
          note: '四周高约 **2.05 米**的石砌园墙把果园围护起来，正中木门上着青铜门闩；园心是一座盖有封印铜盖的八角井与活水泉池，四围栽种结满红果的石榴树。',
          noteEn: 'A **2.05 m** stone perimeter wall with a bronze-barred cedar gate encloses an octagonal sealed well, living water spring basin and four fruiting pomegranate trees.',
        },
        {
          id: 'seven-pillars-portico',
          zh: '智慧的七根柱子与筵席长桌 · 箴言九章凿成的石柱门廊、调和之酒与陈设饼（箴 9:1–5）',
          en: 'Wisdom’s seven carved pillars & banquet table (Prov 9:1–5)',
          note: '台基上矗立 **7 根**凿成的石灰石柱（后排四根、前排三根）托住香柏过梁，内中陈设长桌与陶制双耳酒坛，呼应“智慧建造房屋，凿成七根柱子，调和了酒，也摆设了筵席”。',
          noteEn: 'Seven carved limestone pillars support cedar lintels over a courtyard dais holding a banquet table and wine amphorae (Prov 9:1–5).',
        },
      ],
    },
    unstated: [
      {
        zh: '雅歌 4:12–15 与箴言 9:1–5 均未指定门墙或柱廊的精确肘数；所给米数仅据古近东宅院泉井与石柱廊考古尺度作可视比例参照。',
        en: 'Neither Song of Songs 4:12–15 nor Proverbs 9:1–5 gives exact cubit measurements; the metre dimensions serve solely as realistic architectural proportion.',
      },
    ],
    punchZh: '所罗门诗歌以两幅对映的空间意象起兴：一面是**关锁护持、唯有良人开启的活水园井**，一面是**七根石柱撑开、向外呼唤愚蒙人同席的智慧廊厅**。',
    punchEn: 'Hebrew wisdom poetry contrasts two architectural spaces: an **inclosed garden and sealed spring** guarded within walls, and **Wisdom’s seven-pillared portico** thrown open with set wine and bread.',
    compare: [
      { zh: '关锁的园石墙跨度', en: 'Enclosed garden wall span', m: 7.2 },
      { zh: '智慧柱廊石柱通高', en: 'Seven-pillar portico column height', m: 3.49 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'potters-house-two-wheels',
    zh: '窑匠的家与藏在瓦器里的买地文契',
    en: 'Potter’s House Wheels & Sealed Deeds in an Earthen Jar',
    ref: 'Jeremiah 18:3',
    refZh: '耶利米书 18:3',
    textZh: '我就下到窑匠的家里去，正遇他转轮做器皿。',
    textEn: 'Then I went down to the potter’s house, and, behold, he was making a work on the wheels.',
    dims: [
      { key: 'workshop-span', zh: '陶坊作坊台面跨度', en: 'Workshop floor span', cubits: 6.4, ref: '耶 18:2–3', refEn: 'Jer 18:2–3' },
      { key: 'jar-h', zh: '双耳储藏大瓦罐参照高', en: 'Storage earthen jar reference height', cubits: 1.05, ref: '耶 32:14', refEn: 'Jer 32:14' },
    ],
    kind: 'pottersHouse',
    unit: {
      zh: '米',
      en: 'm',
      m: 1,
      note: '依据犹大铁器时代双石快轮作坊与亚拿突买地文献（耶 18；32）按 1:1 人像尺度重建。',
      noteEn: 'Reconstructed at 1:1 human scale from Iron Age Judean dual-stone potter’s wheels and storage amphorae (Jer 18; 32).',
    },
    counts: [
      { zh: '“转轮”原文直译：上下两片轮石（ha-obnayim）', en: '“The wheels” (Heb. ha-obnayim: two discs)', n: 2, ref: '耶 18:3', refEn: 'Jer 18:3' },
      { zh: '亚拿突田地银价（十七舍客勒，耶 32:9）', en: 'Silver weighed for Anathoth field (shekels, Jer 32:9)', n: 17, ref: '耶 32:9', refEn: 'Jer 32:9' },
    ],
    variants: {
      key: 'pottersHouseView',
      zh: '先知兆头视图',
      en: 'Prophetic sign view',
      options: [
        {
          id: 'potter-wheels',
          zh: '窑匠的双石转轮作坊 · 上下两块轮盘、做坏坍塌的泥坯与烧窑红火（耶 18:2–4）',
          en: 'Potter’s workshop · dual-stone wheels, marred wet pot & glowing kiln',
          note: '希伯来文 **ha-obnayim** 用了双数词尾——古代犹大窑匠用脚踢动下层沉重石飞轮，带动上层工作石盘飞转。轮旁地上摆着刚在手里做坏的坍塌泥坯（耶 18:4），后架木棚晾干成品，右侧土砖升焰窑内炭火微明。',
          noteEn: 'Hebrew **ha-obnayim** is literally dual ("the two stones"): a heavy foot-driven lower flywheel linked by vertical shaft to the upper throwing wheel. Beside the seated potter lies a slumped marred vessel (Jer 18:4) before a drying rack and glowing mudbrick updraft kiln.',
        },
        {
          id: 'earthen-jar-deeds',
          zh: '战火围城中的买地封契瓦器 · 平天平、十七舍客勒银、双份封存契约与大瓦罐（耶 32:9–14）',
          en: 'Anathoth purchase deeds · bronze balance, 17 silver shekels & storage jar',
          note: '耶路撒冷被围之际，耶利米在护卫兵院当众在平天平上称出 **十七舍客勒银子**，并照律例写好**封缄正本**与**敞开副本**两卷买地契约，一同交托巴录放入这只高挑的双耳大瓦罐中“可以存留多日”（耶 32:14）。',
          noteEn: 'During the siege of Jerusalem, Jeremiah weighs **17 shekels of silver** on a balance, executes both a **sealed deed and open duplicate**, and places them inside a tall two-handled earthen jar to endure many days (Jer 32:9–14).',
        },
      ],
    },
    unstated: [
      {
        zh: '耶利米书 18 章未写窑匠作坊大小，也未记 32 章瓦罐精确口径；模型按犹大地层出土的双轮陶车与铁器时代双耳贮藏罐形制呈现实尺比对。',
        en: 'Jeremiah 18 and 32 specify neither workshop floor dimensions nor vessel height; proportions reflect excavated Iron Age Judean kick-wheels and storage jars.',
      },
    ],
    punchZh: '“轮”（**ha-obnayim**）是两块石头连成一根轴：**泥在手中做坏了，窑匠只消一捏，便在同一个双轮上重造别器**——正如后来十七舍客勒契约封进瓦器，越过拆毁指向重回。',
    punchEn: 'Hebrew calls the potter’s wheel **ha-obnayim** ("the two stones"): when clay mars in the potter’s hand, it is reshaped on the same spindle—echoed in Jeremiah’s **17-shekel deed sealed inside a clay jar** through the siege.',
    compare: [
      { zh: '窑匠泥砖烧窑高（约）', en: 'Mudbrick updraft kiln height (approx.)', m: 1.9 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '双耳契约大瓦罐高', en: 'Two-handled deed jar height', m: 1.05 },
    ],
  },
  {
    id: 'mamre-altar-jordan-plain',
    zh: '约但全平原地形抉择与幔利橡树筑坛',
    en: 'Jordan Plain Overlook & Abraham’s Altar at Mamre',
    ref: 'Genesis 13:10',
    refZh: '创世记 13:10',
    textZh: '罗得举目看见约但河的全平原，直到琐珥，都是滋润的，那地在雅伟未灭所多玛、蛾摩拉以先，如同雅伟的园子，也像埃及地。',
    textEn: 'And Lot lifted up his eyes, and beheld all the Plain of the Jordan, that it was well watered every where, before Yahweh destroyed Sodom and Gomorrah, like the garden of Yahweh, like the land of Egypt, as thou goest unto Zoar.',
    dims: [
      { key: 'ridge-to-plain', zh: '伯特利—艾城高地至约但平原东南缘跨度', en: 'Bethel–Ai ridge to south Jordan Plain span', cubits: 95, ref: '创 13:10–12', refEn: 'Gen 13:10–12' },
      { key: 'mamre-route', zh: '伯特利沿中央山地南下希伯仑幔利距离', en: 'Bethel ridge southward to Hebron / Mamre', cubits: 52, ref: '创 13:18', refEn: 'Gen 13:18' },
    ],
    kind: 'mamreJordanRelief',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '实测犹大山地、死海与约但谷地南段地形（东经 34.8°–35.75°，北纬 31.0°–32.1°）。',
      noteEn: 'Georeferenced Judean highland and Jordan Valley / Dead Sea terrain relief.',
    },
    counts: [
      { zh: '雅伟向亚伯兰指出的四方举目方位（东西南北）', en: 'Cardinal directions Abram was told to view', n: 4, ref: '创 13:14', refEn: 'Gen 13:14' },
    ],
    variants: {
      key: 'mamreJordanView',
      zh: '视图模式',
      en: 'View mode',
      options: [
        {
          id: 'parting-overlook',
          zh: '伯特利—艾城高地俯瞰沙盘 · 罗得向东入繁茂约但平原，亚伯兰沿山脊南下幔利（创 13:10–18）',
          en: 'Bethel–Ai overlook relief · Lot’s plainward choice vs. Abram’s ridge path',
          note: '自**伯特利与艾城**之间的高岭东望，四枚方向指向标示“东西南北”（创 13:14）：金线示意罗得下到尚且青翠滋润的约但河全平原、直趋所多玛与琐珥；绿线示意亚伯兰搬帐棚南行山地、安居希伯仑的**幔利橡树**。',
          noteEn: 'Looking east from the high ridge between **Bethel and Ai** with four cardinal sight-lines (Gen 13:14): Lot’s golden path descends into the well-watered Jordan Plain toward Sodom and Zoar, while Abram moves along the hill ridge south to **Hebron / Mamre**.',
        },
        {
          id: 'mamre-oaks-altar',
          zh: '幔利橡树下的帐棚与筑坛 · 1:1 黑毛帐棚、枝叶婆娑的橡树与未凿石祭坛（创 13:18; 18:1）',
          en: '1:1 Oaks of Mamre · black goat-hair tent & unhewn stone altar',
          note: '近景切回希伯仑幔利橡树下（创 13:18; 18:1）：宽阔浓荫的橡树旁支搭黑山羊毛帐棚，棚外立着一座以未凿原石垒成的祭坛，炭火与微烟缓缓升起。',
          noteEn: 'Cuts to 1:1 scale beneath the spreading **oaks of Mamre** at Hebron (Gen 13:18; 18:1): Abram’s black goat-hair tent and unhewn fieldstone altar with glowing embers.',
        },
      ],
    },
    unstated: [
      {
        zh: '创 13 章只点明“伯特利与艾的中间”、“约但河的全平原直直到琐珥”及“希伯仑幔利的橡树”；所多玛与琐珥在死海东南岸的标注系按圣经地理主流考据定位。',
        en: 'Genesis 13 names Bethel–Ai, the Plain of the Jordan unto Zoar, and Mamre in Hebron; the southern Dead Sea basin positions for Sodom and Zoar follow standard historical-geography consensus.',
      },
      {
        zh: '地形高度相对 95 公里跨度有立体放大，使中央分水岭高地与低于海平面的约但谷地落差一目了然。',
        en: 'Vertical elevation is exaggerated over the horizontal span so the watershed ridge drop into the deep Jordan rift reads clearly.',
      },
    ],
    punchZh: '站在伯特利高岭上，**东边下谷地水草丰美像雅伟的园子，南走山脊却是旱地石头**——地图把亚伯兰与罗得的分道扬镳一眼摆开。',
    punchEn: 'From the ridge between Bethel and Ai, **Lot stepped down toward a lush valley garden** while **Abram kept the stony hill crest** south to the oaks of Mamre.',
    compare: [
      { zh: '伯特利至琐珥（约但平原南端）', en: 'Bethel ridge to Zoar (south plain)', m: 95_000 },
      { zh: '伯特利至希伯仑幔利', en: 'Bethel to Hebron / Mamre', m: 52_000 },
    ],
  },
  {
    id: 'bethel-ladder-pillar',
    zh: '伯特利天梯异象与膏油石柱',
    en: 'Jacob’s Bethel Ladder & Anointed Pillar',
    ref: 'Genesis 28:12',
    refZh: '创世记 28:12',
    textZh: '梦见一个梯子立在地上，梯子的头顶着天，有神的使者在梯子上，上去下来。',
    textEn: 'And he dreamed; and behold, a ladder set up on the earth, and the top of it reached to heaven; and, behold, the angels of God ascending and descending on it.',
    dims: [
      { key: 'pillar-h', zh: '浇油立作记号的石柱参照高', en: 'Anointed limestone pillar height (approx.)', cubits: 1.38, ref: '创 28:18', refEn: 'Gen 28:18' },
    ],
    kind: 'bethelPillar',
    unit: {
      zh: '米',
      en: 'm',
      m: 1,
      note: '“天梯”主景采用夜间博物馆基座微缩山丘呈现，切换视图则可 1:1 查看次晨立起浇油的枕头石柱（创 28:18）。',
      noteEn: 'Museum-plinth diorama for the night vision; alternate view shows the ~1.38 m anointed standing stone (matzevah) at 1:1 scale.',
    },
    counts: [
      { zh: '梦境所见的石阶梯数与次晨所立独石柱', en: 'Standing stone set as a pillar (matzevah)', n: 1, ref: '创 28:18', refEn: 'Gen 28:18' },
    ],
    variants: {
      key: 'bethelPillarView',
      zh: '创世记 28 章视角',
      en: 'Genesis 28 view',
      options: [
        {
          id: 'heavenward-steps',
          zh: '夜间梦境微缩台座 · 石阶梯（sullam）立在山石上、顶端微光环晕与往来使者（创 28:11–13）',
          en: 'Night vision diorama · stone ramp-stairway, ascending messengers & aniconic glory',
          note: '希伯来文 **sullam** 本义接近层叠石阶坡道（犹似古代庙塔或高山天阶）。夜色伯特利山丘基座上，雅各头枕一块荒石睡卧，22 级光洁石阶从山石拔起直连天顶三圈光环——**天顶纯以无形光环示意雅伟同在**，绝不造任何人形偶像，阶上有使者往来上下。',
          noteEn: 'Hebrew **sullam** denotes a stepped stone ramp-stairway. On a night Bethel hillside plinth, Jacob sleeps with his stone pillow while a 22-step stone ramp climbs toward pure **aniconic golden light rings** at the summit (strictly no bodily form of God) as luminous messengers ascend and descend.',
        },
        {
          id: 'anointed-pillar',
          zh: '次晨清早立柱浇油 · 1:1 石灰石立柱（matzevah）、倾注的橄榄油光泽与陶制油瓶（创 28:18）',
          en: '1:1 Dawn anointed stone pillar (matzevah) & olive-oil flask (Gen 28:18)',
          note: '雅各清早起来，把昨夜所枕的石头竖立成约 **1.38 米**高的立柱（**matzevah**），倒上橄榄油分别为圣，将“路斯”改名叫**伯特利**（“神的殿”）。',
          noteEn: 'At dawn Jacob sets the pillow stone upright as an ~1.38 m limestone pillar (**matzevah**), pours golden olive oil over its crown, and names the place **Bethel** ("House of God").',
        },
      ],
    },
    unstated: [
      {
        zh: '创世记 28:11–18 未注明雅各石柱或梦中天梯的具体尺寸；立柱约 1.38 米参考伽南立石考古均值，微缩天梯坡道则为表达 **sullam**（石阶梯）与高空光环关系的博物馆示意模型。',
        en: 'Genesis 28 gives no cubit or metre count for either the pillar or the stairway; the ~1.38 m matzevah follows Canaanite standing-stone averages and the ramp-stairway illustrates the Hebrew word sullam.',
      },
    ],
    punchZh: '梦里“梯子（**sullam**）立在地上，头顶着天”，天明却只是**一块立起来、浇上橄榄油的荒山石柱**——这地方既非圣殿也无房顶，雅各却惊呼“这真不是别的，乃是神的殿、天的门”。',
    punchEn: 'At night a **stepped stone ramp reached heaven**; by dawn only an **oil-anointed field stone** stood on the hill—yet Jacob called that open mountainside "the house of God, and the gate of heaven".',
    compare: [
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '伯特利浇油石柱（参照高）', en: 'Anointed Bethel stone pillar (ref.)', m: 1.38 },
    ],
  },
  {
    id: 'joseph-granaries-and-road',
    zh: '约瑟的蜂巢谷仓与从多坍到埃及歌珊路线沙盘',
    en: 'Joseph’s Beehive Granaries & Dothan-to-Goshen Road',
    ref: 'Genesis 41:49',
    refZh: '创世记 41:49',
    textZh: '约瑟积蓄五谷甚多，如同海边的沙，无法计算，因为谷不可胜数。',
    textEn: 'And Joseph laid up grain as the sand of the sea, very much, until he left off numbering; for it was without number.',
    dims: [
      { key: 'yard-w', zh: '泥砖谷仓围院宽', en: 'Granary mudbrick court width', cubits: 9.6, ref: '创 41:48–49', refEn: 'Gen 41:48–49' },
      { key: 'yard-d', zh: '泥砖谷仓围院深', en: 'Granary mudbrick court depth', cubits: 7.8, ref: '创 41:48–49', refEn: 'Gen 41:48–49' },
    ],
    kind: 'josephGranaries',
    unit: {
      zh: '米',
      en: 'm',
      m: 1,
      note: '默认视图为按新/中王国泥砖蜂巢筒仓重建的 1:1 皇家积谷庭院；可切换为横跨 380 公里的多坍至歌珊地形沙盘。',
      noteEn: 'Default view scales the 7-silo Egyptian mudbrick compound at 1:1; alternate view switches to the ~380 km Dothan-to-Goshen terrain corridor.',
    },
    counts: [
      { zh: '丰年数 / 庭院内置泥砖圆顶蜂巢谷仓数', en: 'Abundant years / conical beehive grain silos', n: 7, ref: '创 41:47–49', refEn: 'Gen 41:47–49' },
      { zh: '七个丰年每年征收储谷比例（五分之一）', en: 'Abundant-year grain levy fraction (one fifth)', n: 5, ref: '创 41:34', refEn: 'Gen 41:34' },
    ],
    variants: {
      key: 'josephGranaryView',
      zh: '视图模式',
      en: 'View mode',
      options: [
        {
          id: 'beehive-silos',
          zh: '1:1 埃及官府七座蜂巢谷仓院落 · 顶部倒粮台阶、下部放粮木门、倾泻谷堆与书记量斗（创 41:34, 47–49）',
          en: '1:1 Egyptian granary compound · 7 beehive silos, loading stair & scribe desk',
          note: '切开正面泥砖围墙以供窥视院内：**7 座**锥顶泥砖蜂巢大仓对应七个大丰年，后沿外置阶梯让人扛袋登上高台从仓顶口倾入麦粒；下部各有放粮活门泄出金黄麦堆，院前设司秤登记量斗的木案。',
          noteEn: 'Front cutaway exposes an Egyptian mudbrick granary courtyard containing **7 conical beehive silos** for the seven years of plenty: an exterior stair climbs to the top loading deck while lower front shutters spill golden grain heaps beside the scribe’s measuring table.',
        },
        {
          id: 'dothan-to-egypt',
          zh: '多坍—歌珊地形路线沙盘 · 希伯仑寻兄、基列米甸商队、沿海驿道直下歌珊与兰塞（创 37; 46）',
          en: 'Canaan-to-Egypt terrain relief · Dothan spice caravan & Jacob’s migration to Goshen',
          note: '跨 **约 380 公里**的实测西奈与迦南地形沙盘：绿线标明约瑟从**希伯仑**出发经**示剑**至**多坍**；琥珀线示出从**基列**越过河谷西行的香料商队把他带往埃及；红线再标明雅各全家经**别是巴**南下**歌珊与兰塞**。',
          noteEn: 'Spans **~380 km** from **Hebron -> Shechem -> Dothan** (green), the **Gilead caravan** sweeping through Dothan down the coastal corridor into Egypt (amber), and **Jacob’s household** migrating via **Beersheba** to **Goshen & Rameses** (crimson).',
        },
      ],
    },
    unstated: [
      {
        zh: '创世记 41 章没有记述谷仓的尺寸与圆仓数目；7 座蜂巢谷仓系据埃及中/新王国泥砖筒仓遗址与庭院模型复原，用来具体化“七个丰年积谷如沙”。',
        en: 'Genesis 41 records no silo count or cubit dimensions; the 7-silo courtyard adapts excavated Egyptian New/Middle Kingdom beehive granary compounds.',
      },
    ],
    punchZh: '“无法计算”并非只有一处大仓：埃及法老与约瑟用**一成排顶部进料、底门出粮的泥砖蜂巢筒仓**吞吐全地 **1/5 收成**——也是从多坍坑井沿西奈沙道一路走来的果效。',
    punchEn: 'Joseph’s "grain like sea sand" moved through real infrastructure: **mudbrick beehive silos filled from roof stairs and drawn from floor shutters**, tying Dothan’s pit to Goshen’s store-cities.',
    compare: [
      { zh: '多坍至埃及歌珊陆路全长（约）', en: 'Dothan to Goshen caravan road (approx.)', m: 380_000 },
      { zh: '埃及官府谷仓围院宽', en: 'Granary courtyard width', m: 9.6 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
    ],
  },
  {
    id: 'altar-perpetual-fire-offerings',
    zh: '坛上常常烧着的火与利未记五祭铜坛',
    en: 'Perpetual Burnt-Offering Altar & Five Offerings',
    ref: 'Leviticus 6:13',
    refZh: '利未记 6:13',
    textZh: '在坛上必有常常烧着的火，不可熄灭。”',
    textEn: 'Fire shall be kept burning upon the altar continually; it shall not go out.',
    dims: [
      { key: 'altar-w', zh: '燔祭铜坛宽与长（正方四面）', en: 'Bronze altar width & length (square)', cubits: 5, ref: '出 27:1; 利 6:13', refEn: 'Exod 27:1; Lev 6:13' },
      { key: 'altar-h', zh: '燔祭铜坛高', en: 'Bronze altar height', cubits: 3, ref: '出 27:1', refEn: 'Exod 27:1' },
    ],
    kind: 'perpetualAltar',
    counts: [
      { zh: '利未记 1–7 章五种献祭陈列台', en: 'Five ordered offering stations (Lev 1–7)', n: 5, ref: '利 1–7', refEn: 'Lev 1–7' },
      { zh: '铜坛四角抹赎罪血的坛角', en: 'Four blood-touched altar horns', n: 4, ref: '出 27:2; 利 4:25', refEn: 'Exod 27:2; Lev 4:25' },
    ],
    variants: {
      key: 'perpetualAltarView',
      zh: '利未记坛火视图',
      en: 'Altar view',
      options: [
        {
          id: 'ever-burning-hearth',
          zh: '1:1 五肘见方三肘高铜祭坛 · 抹血四角、无阶斜坡、常燃柴炭烈焰与收灰铲盆（出 27:1; 利 6:12–13）',
          en: '1:1 5 × 5 × 3 cubit bronze altar · blood-touched horns, unstepped ramp & perpetual fire',
          note: '严格按 **出 27:1 实测 5 肘 × 5 肘 × 3 肘高**（拖动肘长滑块即可实时伸缩铜坛全尺寸）：四角各起抹红铜角，南侧设**不造台阶的光面坡道**（出 20:26），坛心赤炭与摇曳火苗常燃不止，旁置穿杠与收灰盆。',
          noteEn: 'Built to the exact **5 × 5 × 3 cubit** specification of Exodus 27:1 (live cubit-slider reactive): four blood-tipped horns, a step-free ramp (Exod 20:26), animated embers and continual flames (Lev 6:12–13), carrying poles and ash pan.',
        },
        {
          id: 'five-offerings-table',
          zh: '利未记一至七章五祭陈列台 · 燔祭、素祭、平安祭、赎罪祭、赎愆祭五大站位（利 1–7）',
          en: 'Five offerings array before the altar · Burnt, Grain, Peace, Sin & Trespass',
          note: '在常燃铜坛前方依次陈设利未记前七章的五祭要物：**燔祭**（柴与盆）、**素祭**（细面堆与油瓶）、**平安祭**（无酵饼与调油饼）、**赎罪祭**（铜盆血迹）与**赎愆祭**（天平与祭物），对照坛角抹血礼仪。',
          noteEn: 'Sets five ordered stations in front of the perpetual altar summarizing Leviticus 1–7: **Burnt** (logs & basin), **Grain** (fine flour & oil), **Peace** (unleavened cakes), **Sin** (blood basin) and **Trespass** (balance scale & restitution).',
        },
      ],
    },
    unstated: [
      {
        zh: '铜坛宽高（5×5×3 肘）来自出埃及记 27:1 明文；南侧斜坡宽斜度、收灰器具形制及“五祭陈列台”摆位皆为助读复原，利未记原文只在会幕外院设一总铜坛献五祭。',
        en: 'The 5 × 5 × 3 cubit altar dimensions come verbatim from Exodus 27:1; ramp slope, ash pan geometry and the five-station display table are pedagogical staging rather than extra architectural furniture in the court.',
      },
    ],
    punchZh: '整卷利未记的一切规矩都在同一件尺度严谨的铜器旁运行：**5 × 5 × 3 肘坛顶昼夜不息的火**（利 6:13），日日烧掉早晨添上的木柴并托住全部五种献祭。',
    punchEn: 'All five offerings of Leviticus 1–7 turn around one precisely sized **5 × 5 × 3 cubit bronze hearth** whose wood fire “shall never go out” day or night (Lev 6:13).',
    compare: [
      { zh: '铜祭坛宽长（5 肘，长肘）', en: 'Bronze altar square side (5 cubits)', m: 2.625 },
      { zh: '一个成年人（身高）', en: 'Adult human (height)', m: 1.72 },
      { zh: '铜祭坛高（3 肘，长肘）', en: 'Bronze altar height (3 cubits)', m: 1.575 },
    ],
  },
  {
    id: 'joppa-caesarea-coastal-vision',
    zh: '约帕房顶异象与犹太—沙仑沿海宣教沙盘',
    en: 'Joppa Housetop Vision & Judea–Caesarea Coastal Relief',
    ref: 'Acts 10:9',
    refZh: '使徒行传 10:9',
    textZh: '第二天，他们行路将近那城。彼得约在午正，上房顶去祷告，',
    textEn: 'Now on the morrow, as they were on their journey, and drew nigh unto the city, Peter went up upon the housetop to pray, about the sixth hour:',
    dims: [
      { key: 'coast-ew', zh: '沿海（约帕/迦萨）至内陆耶路撒冷东西跨度', en: 'Coast (Joppa/Gaza) to Jerusalem east–west span', cubits: 95, ref: '徒 8–10', refEn: 'Acts 8–10' },
      { key: 'coast-ns', zh: '迦萨旷野南端至该撒利亚南北全长', en: 'Gaza desert to Caesarea north–south span', cubits: 155, ref: '徒 8:26–40; 10:24', refEn: 'Acts 8:26–40; 10:24' },
    ],
    kind: 'actsCoastalRelief',
    unit: {
      zh: '公里',
      en: 'km',
      m: 1000,
      note: '实测地中海东岸沙仑平原、非利士海岸、犹大与撒玛利亚山地地形。',
      noteEn: 'Georeferenced terrain of the Sharon Plain, Philistine coast, Judea and Samaria.',
    },
    counts: [
      { zh: '在约帕城外叩门的哥尼流差役（两人仆从+一兵丁）', en: 'Messengers sent from Cornelius to Joppa', n: 3, ref: '徒 10:7–8, 17', refEn: 'Acts 10:7–8, 17' },
      { zh: '异象大布系住的四只角', en: 'Four corners holding the descending sheet', n: 4, ref: '徒 10:11', refEn: 'Acts 10:11' },
    ],
    variants: {
      key: 'actsCoastalView',
      zh: '视图模式',
      en: 'View mode',
      options: [
        {
          id: 'coastal-roads',
          zh: '腓利与彼得沿海宣教沙盘 · 撒玛利亚、迦萨旷野至该撒利亚 + 吕大、约帕至该撒利亚（徒 8–10）',
          en: 'Coastal terrain relief · Philip’s Gaza-to-Caesarea road & Peter’s Joppa circuit',
          note: '按真实山海岸线标出两股向外推进的路：**腓利**先北上**撒玛利亚**（徒 8:5），再顺南路下**迦萨旷野**往北走**亚实突（亚锁都）—该撒利亚**（徒 8:26–40）；**彼得**则从耶路撒冷巡行**吕大、约帕**再北上**该撒利亚**哥尼流家（徒 9:32–10:24）。',
          noteEn: 'Plots two interlocking coastal expansions across true topography: **Philip** north to **Samaria** (Acts 8:5) and down the **Gaza** desert road north through **Azotus (Ashdod) to Caesarea** (8:26–40), followed by **Peter** via **Lydda (Lod) and Joppa** to **Caesarea** (9:32–10:24).',
        },
        {
          id: 'joppa-rooftop',
          zh: '1:1 约帕海边硝皮匠西门房顶 · 外阶梯、硝皮石槽、门前三人与系着四角缒下的大布（徒 10:6–17）',
          en: '1:1 Simon the tanner’s seaside rooftop · exterior stair, vats & 4-corner sheet vision',
          note: '近海边石砌平顶宅院：海浪拍打石岸（徒 10:6 靠海而居好取水清洗皮料），院角凿有两只硝皮石槽；外墙石阶通往平屋顶，午正祷告的彼得跪在顶棚旁，头顶上方金色光环缓缓缒下**四角系着的大布**（10:11），同时门外已站着从该撒利亚赶来的三人。',
          noteEn: 'At **Simon the tanner’s house by the sea** (Acts 10:6), stone tanning vats sit beside Mediterranean surf while an exterior stone stair climbs to the flat rooftop where Peter prays at noon beneath a descending **four-cornered sheet** suspended from an aniconic sky ring as three messengers arrive at the gate (10:7–17).',
        },
      ],
    },
    unstated: [
      {
        zh: '使徒行传第 8–10 章写明了每座城镇名与约帕海边房子方位，但未详述硝皮匠西门宅院尺寸与各城间小路拐点；沿海路线依据罗马帝国滨海驿道走势重建。',
        en: 'Acts 8–10 names every city and Simon’s seaside house without giving house measurements; road tubes follow coastal Roman highway alignments between the attested stops.',
      },
    ],
    punchZh: '福音跨入外邦并非发生在深山密林：**沿着沙仑平原地中海边一条平直大路**，约帕房顶午正一块缒下的四角大布，把门外的**三位该撒利亚来客**直领到港口大城。',
    punchEn: 'Across the Sharon coast, a **four-cornered sheet lowered onto a Joppa rooftop by the sea** turned a single coastal road from **Gaza and Lydda straight to Caesarea**.',
    compare: [
      { zh: '约帕至该撒利亚沿海行程', en: 'Joppa to Caesarea coastal walk', m: 58_000 },
      { zh: '迦萨旷野道至该撒利亚全程（约）', en: 'Gaza to Caesarea full road (approx.)', m: 145_000 },
      { zh: '海边平顶石头屋总高（1:1）', en: 'Seaside flat-roof stone house height', m: 3.17 },
    ],
  },
  {
    id: 'whirlwind-foundations-constellations',
    zh: '约伯记三十八章：大地根基、海门与星宿带',
    en: 'Job 38 Out of the Whirlwind: Foundations, Sea Doors & Constellations',
    ref: 'Job 38:4',
    refZh: '约伯记 38:4',
    textZh: '我立大地根基的时候，你在哪里呢？你若有聪明，只管说吧！',
    textEn: 'Where wast thou when I laid the foundations of the earth? Declare, if thou hast understanding.',
    dims: [
      { key: 'diorama-span', zh: '宇宙论断面博物馆基座宽', en: 'Cosmological diorama museum plinth width', cubits: 10.2, ref: '伯 38:4–11', refEn: 'Job 38:4–11' },
    ],
    kind: 'jobWhirlwind',
    unit: {
      zh: '米',
      en: 'm',
      m: 1,
      note: '双视图皆安放在博物馆展台基座上，将希伯来古宇宙观诗意意象（地脚底座、角石准绳、海的双门门闩与三大星群）具象并列。',
      noteEn: 'Both views rest on museum plinths translating Job 38’s Hebrew poetic cosmology (earth sockets, cornerstone plumb line, bolted sea doors and star bands).',
    },
    counts: [
      { zh: '约伯记 38:31–32 点名的三大北方星群（昴星、参星、北斗）', en: 'Star groups named in Job 38:31–32 (Pleiades, Orion, Bear)', n: 3, ref: '伯 38:31–32', refEn: 'Job 38:31–32' },
    ],
    variants: {
      key: 'jobWhirlwindView',
      zh: '天问断面视角',
      en: 'Cosmological view',
      options: [
        {
          id: 'cornerstone-and-sea-doors',
          zh: '大地根基、准绳角石与双扇海门 · 安放底座、波涛止于门闩与旋风无形回环（伯 38:1–11）',
          en: 'Earth foundation sockets, cornerstone line, bolted sea doors & aniconic whirlwind',
          note: '左侧切开地壳深石，露出“根基的底座、安放的角石”（38:6）与拉在墩柱上的**黄铜准绳**（38:5）；右侧涌动深蓝海水撞在一对**装上门闩的巨型海门**前受阻停住（38:8–11）；中央坐着约伯，上方升起**纯以盘旋光环构成的旋风柱**（不作人形），体现雅伟“从旋风中回答”（38:1）。',
          noteEn: 'A museum-plinth cutaway contrasts **sunken foundation sockets, cornerstone and brass measuring line** on the left (Job 38:4–6) with **twin bolted doors halting the surging ocean** on the right (38:8–11), crowned by a strictly **aniconic spiraling whirlwind** descending above seated Job (38:1).',
        },
        {
          id: 'pleiades-and-orion',
          zh: '昴星、参星与北斗（天球青铜子午环）· 紧系的昴星七星带与解开的参星腰带（伯 38:31–32）',
          en: 'Celestial meridian arcs · bound Pleiades, Orion’s cords & the Bear',
          note: '两道黄铜天体子午环托出约伯记 38:31–32 质问的三组星宿：**昴星（七星）**由金环紧系成团，**参星（猎户座）**列三腰星与四角外星却显松开铜索，北方高弧则悬起按时领出的**北斗七星**。',
          noteEn: 'Twin brass meridian arcs frame the constellations asked of Job (38:31–32): **Pleiades** bound tightly in a golden 7-star cluster, **Orion’s** three-star belt and outer stars with loosened bronze cords, and the **Bear (Dipper)** circling the northern arc.',
        },
      ],
    },
    unstated: [
      {
        zh: '约伯记第 38 章通篇使用建城筑房（底座、角石、准绳）与城门门闩（海的胎门与门闩）的宏大诗意隐喻来反衬人智有限，并非按科学地理刻度丈量地球。',
        en: 'Job 38 casts creation in majestic architectural and coastal metaphors (sockets, cornerstone, measuring line, bolted doors) to humble human wisdom rather than specifying literal metres.',
      },
    ],
    punchZh: '当人追问受苦理由时，神没有画一张哲学图，而是领他站到**地角石与拉起的准绳前、装上门闩的海涛前、连结昴星七星的天球前**问：“我立根基时你在哪里？”',
    punchEn: 'Out of the whirlwind, Yahweh placed Job before **foundation sockets, a stretched plumb line, bolted sea doors and bound Pleiades**, asking not *why* but **where man stood when earth was founded**.',
    compare: [
      { zh: '宇宙断面陈列基座宽', en: 'Cosmological diorama plinth width', m: 10.2 },
      { zh: '天球黄铜子午环基座宽', en: 'Celestial meridian plinth width', m: 9.6 },
    ],
  },
  {
    id: 'caesarea-audience-hall',
    zh: '该撒利亚海角希律王宫与亚基帕公厅听审',
    en: 'Caesarea Promontory Praetorium & Agrippa’s Audience Hall',
    ref: 'Acts 25:23',
    refZh: '使徒行传 25:23',
    textZh: '第二天，亚基帕和百尼基大张威势而来，同着众千夫长和城里的尊贵人进了公厅。非斯都吩咐一声，就有人将保罗带进来。',
    textEn: 'So on the morrow, when Agrippa was come, and Bernice, with great pomp, and they were entered into the place of hearing with the chief captains and principal men of the city, at the command of Festus Paul was brought in.',
    dims: [
      { key: 'hall-w', zh: '1:1 切开式公厅（akroaterion）东西宽', en: '1:1 Cutaway audience basilica width', cubits: 10.6, ref: '徒 25:23', refEn: 'Acts 25:23' },
      { key: 'hall-d', zh: '公厅南北纵深（双排柱廊）', en: 'Audience hall depth (paired colonnades)', cubits: 8.0, ref: '徒 25:23', refEn: 'Acts 25:23' },
    ],
    kind: 'caesareaHall',
    unit: {
      zh: '米',
      en: 'm',
      m: 1,
      note: '公厅主视图按 1:1 人像尺度剖开南墙呈现在堂辩论（徒 25:23–26:32），另一视图以博物馆缩尺展示伸入地中海的希律海角总督宫（徒 23:35）。',
      noteEn: 'Primary view shows a 1:1 cutaway audience basilica; secondary view shows a museum model of Herod’s rock-cut Promontory Palace.',
    },
    counts: [
      { zh: '听审公厅两侧整齐石柱（素柱廊，每排六根）', en: 'Clean fluted colonnade shafts (6 + 6)', n: 12, ref: '徒 25:23', refEn: 'Acts 25:23' },
      { zh: '按五支驻屯营编制的众千夫长（Acts 25:23）', en: 'Tribunes / chiliarchs seated along north bench', n: 5, ref: '徒 25:23', refEn: 'Acts 25:23' },
    ],
    variants: {
      key: 'caesareaHallView',
      zh: '该撒利亚视角',
      en: 'Caesarea view',
      options: [
        {
          id: 'agrippa-hearing',
          zh: '1:1 亚基帕与非斯都公厅听审 · 高台三席、五千夫长旁听、带锁链申诉的保罗与西侧海浪（徒 25:23; 26:1）',
          en: '1:1 Audience basilica (akroaterion) · bema dais, 5 tribunes & chained Paul',
          note: '切开希律海角王宫上层大厅（希腊原文 **akroaterion**“听审大厅”）：两排 **6+6** 洁净凹槽大理石柱廊外即地中海湛蓝波涛（徒 23:35 保罗曾被看守在此宫中）；西端石砌**审讯高台（bema）**并列**非斯都、亚基帕王与百尼基**三座，北席坐着**五位千夫长**，东侧中央站着带着手链却挺身申辩的保罗。',
          noteEn: 'Cutaway of the upper audience basilica (**akroaterion**) overlooking Mediterranean surf outside its west colonnade: **6 + 6 clean fluted marble columns** frame a raised stone **bema** dais seating **Festus, Agrippa II and Bernice**, **five tribunes** along the north bench, and chained **Paul** standing in defense.',
        },
        {
          id: 'promontory-praetorium',
          zh: '海角希律王宫全区微缩模型 · 下层凿石海中淡水柱廊泳池 + 上层行政公厅与兵营翼楼（徒 23:35）',
          en: 'Museum model of Herod’s Promontory Palace · lower sea-pool & upper praetorium',
          note: '呈现海角考古发掘实景：前伸入地中海的礁石半岛上建起下层围有四面柱廊的凿石淡水宫池，后方地势抬升的上层官邸即是罗马巡抚驻节的“希律的衙门（praitorion）”，也是保罗羁押两年、面向君王作见证的所在。',
          noteEn: 'Museum-plinth architectural massing of Caesarea Maritima’s excavated **Promontory Palace**: a rock-cut peristyle sea-pool projecting into Mediterranean surf below the elevated eastern governor’s praetorium where Paul was kept (Acts 23:35) before his hearing.',
        },
      ],
    },
    unstated: [
      {
        zh: '使徒行传未记录公厅内部开间尺数与千夫长确切人数（历史上驻扎该撒利亚及犹太省约有五营辅助步兵千夫长）；素柱廊按 1:12 柱列比例简化示意，不设多余徽章旗号。',
        en: 'Acts neither specifies hall metre dimensions nor an exact count of tribunes (five cohort tribunes reflect Roman Judea’s auxiliary garrison history); the cutaway omits anachronistic heraldic eagles or banners.',
      },
    ],
    punchZh: '保罗被囚两年“在希律的衙门”并非地牢黑屋，而是**三面环海、白石柱廊迎浪的希律海角宫殿上厅**——正因有这高台 **bema** 与公厅 **akroaterion**，他直面巡抚、王与众千夫长伸手分诉。',
    punchEn: 'Paul’s two-year Caesarea custody lay inside **Herod’s sea-girt Promontory Palace**—so when Festus summoned Agrippa, Bernice and the tribunes into the **akroaterion**, a single chained prisoner addressed the coastal court overlooking the Mediterranean.',
    compare: [
      { zh: '海角希律王宫遗址长（约）', en: 'Excavated Promontory Palace full length', m: 110 },
      { zh: '切开公厅内场东西跨度', en: 'Cutaway audience hall interior span', m: 10.6 },
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
  nehemiah: '/nehemiah.html',
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
