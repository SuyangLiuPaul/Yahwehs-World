import { FIGURES } from './walk/figures.ts';

// WHAT THIS APP HAS ACTUALLY BUILT, IN ONE PLACE YOU CAN LOOK AT.
//
// Until now a reader met a figure only by walking into the room it happens to
// stand in: the priest exists, but nothing in the app shows him to you, and
// nothing anywhere says how tall he is or why he is barefoot. Fifteen models
// were in public/models/ and four of them had never been on screen at all.
//
// So this is the register, made visible. Every entry says the same four things
// the walks say about a building — what it is, how big it is, what verse it
// comes from, and what part of it is a display choice rather than the text's.
//
// THE DIVISION IS THE PROJECT'S POLICY, NOT A LAYOUT.
//   · Living things are GENERATED and then measured, because Scripture gives
//     no dimensions for a man or an ox.
//   · Everything built — the ark, the tent, the house, the sea, the lampstand
//     — is WRITTEN AS GEOMETRY from the cubits the text states, and is not
//     generated at all. That is why the last section links to rooms you walk
//     into rather than to files.

export type Kind = 'people' | 'creatures' | 'made';

export interface Item {
  /** The model's stem in /models, or null for something written as geometry. */
  id: string;
  kind: Kind;
  en: string;
  zh: string;
  /** Overall height as posed, in metres — what loadFigure scales it to. */
  height: number;
  /** Shoulder height for a quadruped. Recorded because the two get confused. */
  withers?: number;
  /** The verse it stands on, where there is one. */
  ref?: string;
  refZh?: string;
  noteEn: string;
  noteZh: string;
  /** Where in the app it stands today, and how many of it. */
  whereEn: string;
  whereZh: string;
}

/** The register's own entries, so a height can never be stated twice. */
const fromRegister = (id: keyof typeof FIGURES, kind: Kind,
  ref: string, refZh: string, whereEn: string, whereZh: string): Item => {
  const f = FIGURES[id]!;
  return { id: f.file, kind, en: f.en, zh: f.zh, height: f.height, withers: f.withers,
           ref, refZh, noteEn: f.noteEn, noteZh: f.noteZh, whereEn, whereZh };
};

export const CATALOGUE: Item[] = [
  fromRegister('man', 'people', 'Genesis 7:13', '创世记 7:13',
    'The ark, second deck — four of the eight', '方舟第二层——八个人中的四个'),
  fromRegister('woman', 'people', 'Genesis 7:13', '创世记 7:13',
    'The ark, second deck — four of the eight', '方舟第二层——八个人中的四个'),
  fromRegister('priest', 'people', 'Exodus 28:40–42', '出埃及记 28:40–42',
    'Made ahead of the tabernacle service scenes', '为会幕的事奉场景先做好，等场景'),
  { id: 'shepherd-v1', kind: 'people', en: 'A shepherd', zh: '牧人', height: 1.70,
    noteEn: 'Staffage on the globe: it names no one and stands for no passage. A figure at a stop so the terrain has a human scale.',
    noteZh: '地球上的点景：不指任何人，也不对应任何一段经文。放在站点上，好让地形有个人的尺度。',
    whereEn: 'The globe, at journey stops', whereZh: '地球上，路线的站点' },
  { id: 'traveller-v1', kind: 'people', en: 'A traveller', zh: '行路的人', height: 1.70,
    noteEn: 'Staffage on the globe, as above.',
    noteZh: '地球上的点景，同上。',
    whereEn: 'The globe, at journey stops', whereZh: '地球上，路线的站点' },

  fromRegister('ox', 'creatures', 'Genesis 7:2', '创世记 7:2',
    'The ark, lower deck — fourteen', '方舟底层——十四头'),
  fromRegister('camel', 'creatures', 'Genesis 7:2; Leviticus 11:4', '创世记 7:2；利未记 11:4',
    'The ark, lower deck — two', '方舟底层——两只'),
  fromRegister('sheep', 'creatures', 'Leviticus 3:9', '利未记 3:9',
    'Made ahead of the offering scenes', '为献祭场景先做好，等场景'),
  fromRegister('lamb', 'creatures', 'Exodus 12:5; 29:38', '出埃及记 12:5；29:38',
    'Made ahead of the passover and the daily offering', '为逾越节和常献的燔祭先做好'),
  fromRegister('goat', 'creatures', 'Matthew 25:32', '马太福音 25:32',
    'Made ahead of the offering scenes', '为献祭场景先做好，等场景'),
  fromRegister('ass', 'creatures', 'Genesis 22:3', '创世记 22:3',
    'Made ahead of the journey scenes', '为旅程场景先做好，等场景'),
  fromRegister('dove', 'creatures', 'Genesis 8:8', '创世记 8:8',
    'The ark, second deck rails — fourteen', '方舟第二层栏杆——十四只'),
  fromRegister('raven', 'creatures', 'Genesis 8:7', '创世记 8:7',
    'The ark, second deck — one', '方舟第二层——一只'),

  { id: 'laver', kind: 'made', en: 'The laver', zh: '洗濯盆', height: 0.90,
    ref: 'Exodus 30:18', refZh: '出埃及记 30:18',
    noteEn: 'The one made thing here that is a model rather than code: Exodus gives the laver of brass and his foot of brass, and no dimension at all. Where the text states no measurement there is nothing to write, so it is modelled and labelled.',
    noteZh: '这里唯一一件不是用代码写出来的「造物」：出埃及记只说铜盆和铜座，一个尺寸都没有给。经文没有给尺寸就没有东西可写，所以它是做出来的模型，并且注明。',
    whereEn: 'The tabernacle court', whereZh: '会幕的院子' },
  { id: 'roman-grain-ship-v1', kind: 'made', en: 'A grain ship of Alexandria', zh: '亚历山大的运粮船',
    height: 4.60, ref: 'Acts 27:6, 37', refZh: '使徒行传 27:6, 37',
    noteEn: 'An illustrative miniature on the globe, not to scale with the terrain and not evidence of a particular vessel. Acts gives the ship of Alexandria and two hundred and seventy-six souls aboard, and no dimensions.',
    noteZh: '地球上的示意小模型，不与地形同比例，也不是某一条船的凭据。使徒行传只说「亚历山大的船」和船上二百七十六个人，没有给尺寸。',
    whereEn: 'The globe, on the voyage to Rome', whereZh: '地球上，押解往罗马的航程' },
];

/** The rooms you walk into: written as geometry from the stated cubits, and
 *  deliberately NOT generated. They are here because a reader looking for
 *  "what has been built" means these too. */
export const BUILT: { href: string; en: string; zh: string; refEn: string; refZh: string }[] = [
  { href: '/ark.html', en: "Noah's ark", zh: '挪亚方舟',
    refEn: 'Genesis 6:15 — 300 × 50 × 30 cubits', refZh: '创世记 6:15 —— 长三百肘，宽五十肘，高三十肘' },
  { href: '/tabernacle.html', en: 'The tabernacle', zh: '会幕',
    refEn: 'Exodus 26–27 — the boards, the court, the hanging', refZh: '出埃及记 26–27 —— 竖板、院子、幔子' },
  { href: '/temple.html', en: "Solomon's temple", zh: '所罗门的圣殿',
    refEn: '1 Kings 6–7 — 60 × 20 × 30 cubits, and the two pillars', refZh: '列王纪上 6–7 —— 长六十肘，宽二十肘，高三十肘，并两根柱子' },
];

export const KINDS: { key: Kind; en: string; zh: string; whatEn: string; whatZh: string }[] = [
  { key: 'people', en: 'People', zh: '人',
    whatEn: 'Generic forms. They identify no individual, and every man among them is short-haired — 1 Cor 11:14 is the only word in the letters on the subject.',
    whatZh: '通用形象，不指任何一个人。其中的男子都是短发——林前 11:14 是书信里唯一论到这件事的话。' },
  { key: 'creatures', en: 'Living creatures', zh: '活物',
    whatEn: 'Where the text names a kind — the raven, the dove, the camel — the kind is the text\'s. Where it does not, the species is a display choice and it says so.',
    whatZh: '经文点名的种类——乌鸦、鸽子、骆驼——就照经文。经文没有点名的，种类是展示选择，并且注明。' },
  { key: 'made', en: 'Things made', zh: '造物',
    whatEn: 'Only what the text describes without measuring. Everything the text measures is written as geometry instead — see below.',
    whatZh: '只有经文描述了却没有给尺寸的东西。凡经文给了尺寸的，一律用代码照尺寸写出来——见下。' },
];
