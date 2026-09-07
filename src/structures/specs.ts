// Every structure here is built from numbers the text itself gives. Nothing is
// an artist's impression: if Scripture does not state a dimension, this file
// does not invent one — it records the gap in `unstated` and the card says so.
//
// The cubit is the whole problem. Scripture measures in cubits and never says
// how long one is, and the candidates differ by nearly 20%: Noah's ark is
// either 134 m or 157 m depending on which you pick. Rather than quietly
// choosing, the page puts the cubit on a slider and lets every structure
// resize at once.

export interface CubitStandard { id: string; m: number; zh: string; en: string; note: string }

export const CUBITS: CubitStandard[] = [
  { id: 'common', m: 0.445, zh: '普通肘', en: 'Common cubit',
    note: '肘至中指尖，约 44.5 厘米。最常用的换算。' },
  { id: 'long', m: 0.518, zh: '圣所长肘', en: 'Long / sanctuary cubit',
    note: '「一肘零一掌」（结 40:5、代下 3:3），约 51.8 厘米。' },
  { id: 'royal', m: 0.523, zh: '埃及王室肘', en: 'Egyptian royal cubit',
    note: '约 52.3 厘米。摩西在埃及长大，有学者主张出埃及记用的是这个。' },
];

/** A dimension the text actually states, with the verse that states it. */
export interface Dim { key: string; zh: string; cubits: number; ref: string }

export interface Structure {
  id: string;
  zh: string; en: string;
  /** The passage the card opens with. */
  ref: string; refZh: string;
  textZh: string; textEn: string;
  dims: Dim[];
  /** Rendered geometry kind — each has a builder in build.ts. */
  kind: 'ark' | 'chest' | 'court' | 'cube' | 'menorah';
  /** Some things Scripture specifies by COUNT rather than by measurement. The
   *  lampstand is the extreme case: every ornament is numbered and no
   *  dimension is given anywhere. */
  counts?: { zh: string; n: number; ref: string }[];
  /** Height in metres for objects the text does not measure. Traditional, not
   *  scriptural — the card has to say so. */
  assumedHeight?: number;
  /** Where two defensible reconstructions exist, both ship and the reader
   *  chooses. The renderer does not get to settle what the text leaves open. */
  variants?: {
    key: string; zh: string;
    options: { id: string; zh: string; note: string }[];
  };
  /** Facts the text does not give. Naming them keeps the model honest. */
  unstated: string[];
  /** The line that should land once the thing is standing there at scale. */
  punchZh: string;
  /** Real-world objects to set beside it, in metres. */
  compare: { zh: string; m: number }[];
  /** Some measures are not in cubits at all. */
  unit?: { zh: string; m: number; note: string };
}

export const STRUCTURES: Structure[] = [
  {
    id: 'noah',
    zh: '挪亚方舟', en: "Noah's Ark",
    ref: 'Genesis 6:15', refZh: '创世记 6:15',
    textZh: '方舟的造法乃是这样：要长三百肘，宽五十肘，高三十肘。',
    textEn: 'This is how you are to build it: the ark is to be three hundred cubits long, fifty cubits wide and thirty cubits high.',
    dims: [
      { key: 'length', zh: '长', cubits: 300, ref: '创 6:15' },
      { key: 'width',  zh: '宽', cubits: 50,  ref: '创 6:15' },
      { key: 'height', zh: '高', cubits: 30,  ref: '创 6:15' },
    ],
    kind: 'ark',
    unstated: [
      '船体形状——经文只给了长宽高三个数，没有说船首船尾是什么样子。这里按方箱处理，因为那是经文唯一支持的形状。',
      '材质细节——只说了歌斐木和里外抹松香（创 6:14）。',
    ],
    punchZh: '三个数字，一艘 134 米长的船。比一个标准足球场还长，比大多数人想象的大得多。',
    compare: [
      { zh: '标准足球场（长）', m: 105 },
      { zh: '波音 747', m: 70.6 },
      { zh: '蓝鲸', m: 30 },
    ],
  },
  {
    id: 'ark',
    zh: '约柜', en: 'Ark of the Covenant',
    ref: 'Exodus 25:10', refZh: '出埃及记 25:10',
    textZh: '要用皂荚木做一柜，长二肘半，宽一肘半，高一肘半。',
    textEn: 'Have them make an ark of acacia wood — two and a half cubits long, a cubit and a half wide, and a cubit and a half high.',
    dims: [
      { key: 'length', zh: '长', cubits: 2.5, ref: '出 25:10' },
      { key: 'width',  zh: '宽', cubits: 1.5, ref: '出 25:10' },
      { key: 'height', zh: '高', cubits: 1.5, ref: '出 25:10' },
    ],
    kind: 'chest',
    unstated: [
      '基路伯长什么样——经文说了「用金子锤出两个基路伯来」（出 25:18），翅膀遮掩施恩座，脸对脸。形态没有描述。这里只放出经文明确的姿态。',
      '包金的厚度。',
    ],
    punchZh: '一米一。整个以色列民族最神圣的器物，尺寸只有一个大号行李箱。两个人抬得动——事实上经文规定就是要用杠抬。',
    compare: [
      { zh: '一个成年人（身高）', m: 1.7 },
      { zh: '标准行李箱', m: 0.75 },
    ],
  },
  {
    id: 'court',
    zh: '会幕院子', en: 'Court of the Tabernacle',
    ref: 'Exodus 27:18', refZh: '出埃及记 27:18',
    textZh: '院子要长一百肘，宽五十肘，高五肘，帷子要用捻的细麻做，带卯的座要用铜做。',
    textEn: 'The courtyard shall be a hundred cubits long and fifty cubits wide, with curtains of finely twisted linen five cubits high.',
    dims: [
      { key: 'length', zh: '长', cubits: 100, ref: '出 27:18' },
      { key: 'width',  zh: '宽', cubits: 50,  ref: '出 27:18' },
      { key: 'height', zh: '帷子高', cubits: 5, ref: '出 27:18' },
    ],
    kind: 'court',
    unstated: ['帷子的织法与颜色细节、柱子的雕饰。经文给了柱数、座与钩（出 27:9-17），没有给形制。'],
    punchZh: '45 米 × 22 米，围墙只有两米二高——比一个网球场大不了多少。神与以色列人相会的地方，尺寸是一个人站在外面就能看见里面的院子。',
    compare: [
      { zh: '网球场（长）', m: 23.77 },
      { zh: '篮球场（长）', m: 28 },
    ],
  },
  {
    id: 'menorah',
    zh: '金灯台', en: 'The Lampstand',
    ref: 'Exodus 25:31-40', refZh: '出埃及记 25:31-40',
    textZh: '要用精金做一个灯台。灯台的座和干与杯、球、花，都要接连一块锤出来。灯台两旁要杈出六个枝子：这旁三个，那旁三个。这旁每枝上有三个杯，形状像杏花，有球有花……',
    textEn: 'Make a lampstand of pure gold. Hammer out its base and shaft, and its flowerlike cups, buds and blossoms shall be of one piece with it. Six branches are to extend from the sides of the lampstand — three on one side and three on the other.',
    dims: [],
    counts: [
      { zh: '枝子', n: 6, ref: '出 25:32' },
      { zh: '每枝上的杏花杯', n: 3, ref: '出 25:33' },
      { zh: '干上的杏花杯', n: 4, ref: '出 25:34' },
      { zh: '枝子接处的球', n: 3, ref: '出 25:35' },
      { zh: '灯盏', n: 7, ref: '出 25:37' },
    ],
    kind: 'menorah',
    assumedHeight: 1.5,
    unstated: [
      '**灯台有多高，经文从头到尾没有说。** 出埃及记 25 章把每一个装饰的数量都数清楚了，却一个尺寸都没给。这里用的 1.5 米来自提图斯凯旋门浮雕的比例和犹太传统，不是经文。',
      '**枝子是弧形还是直线，两千年来没有定论。** 提图斯凯旋门浮雕（公元 1 世纪，圣殿被毁后一代人之内所刻）是弧形，也是现存最早的图像；迈蒙尼德在牛津藏本《密西拿注释》中亲笔画的是直线斜出，其子亚伯拉罕作证那是有意的。上面的开关两种都能看。',
      '**底座形状有争议。** 凯旋门浮雕上是分层的六角底座，与犹太传统记载的三足底座不符——这正是「浮雕是否忠实于圣殿原物」争论的核心证据。这里做的是接近浮雕的形式。',
      '杏花杯的具体轮廓。经文说「形状像杏花，有球有花」，给了三段结构，没有给造型曲线。',
    ],
    variants: {
      key: 'branchForm',
      zh: '枝子形状',
      options: [
        { id: 'arch', zh: '弧形 · 提图斯凯旋门', note: '公元 1 世纪罗马浮雕，现存最早的图像。' },
        { id: 'straight', zh: '直线 · 迈蒙尼德', note: '12 世纪，迈蒙尼德亲笔手稿；哈巴德沿用至今。' },
      ],
    },
    punchZh: '**二十二个杏花杯、三个接处的球、七个灯盏** —— 这些不是装饰性的猜测，是出埃及记 25 章一个一个数出来的。全部用一他连得纯金（约 34 公斤）锤成一整块，不是拼接的。这是全圣经描述最繁复的一件器物，而它的高度经文一个字都没提。',
    compare: [
      { zh: '一个成年人（身高）', m: 1.7 },
      { zh: '一扇标准门（高）', m: 2.0 },
    ],
  },
  {
    id: 'newjerusalem',
    zh: '新耶路撒冷', en: 'The New Jerusalem',
    ref: 'Revelation 21:16', refZh: '启示录 21:16',
    textZh: '城是四方的，长宽一样。天使用苇子量那城，共有四千里，长、宽、高都是一样。',
    textEn: 'The city was laid out like a square, as long as it was wide. He measured the city with the rod and found it to be 12,000 stadia in length, and as wide and high as it is long.',
    dims: [
      { key: 'length', zh: '长', cubits: 12000, ref: '启 21:16' },
      { key: 'width',  zh: '宽', cubits: 12000, ref: '启 21:16' },
      { key: 'height', zh: '高', cubits: 12000, ref: '启 21:16' },
    ],
    kind: 'cube',
    unit: { zh: '斯他丁', m: 185, note: '希腊长度单位 στάδιον，约 185 米。这一节用的不是肘。' },
    unstated: ['这是异象中的城，不是建筑图纸。这里只把经文给的数字如实立起来。'],
    punchZh: '2,220 公里 —— 长、宽，**和高**。这不是一座城，是一个立方体。底面盖住大半个中国东部，顶端伸到国际空间站轨道高度的五倍以上。大多数人读过这节，从来没算过这个数。',
    compare: [
      { zh: '上海到北京', m: 1_064_000 },
      { zh: '国际空间站轨道高度', m: 408_000 },
      { zh: '珠穆朗玛峰', m: 8_849 },
    ],
  },
];

export const metres = (cubits: number, s: Structure, cubitM: number) =>
  cubits * (s.unit ? s.unit.m : cubitM);
