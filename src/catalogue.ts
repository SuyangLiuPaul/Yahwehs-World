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

export type Kind = 'cast' | 'people' | 'creatures' | 'made';

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
  /** Rigged, with its own clips — the viewer offers them and swings the cloth. */
  moves?: boolean;
}

/** The cast: people built here, on a MakeHuman body, in a tunic sewn from
 *  flat panels and draped by cloth simulation, with six clips retargeted from
 *  motion capture and spring bones in the hem, the girdle, the veil and the
 *  beard (tools/autorig/, person.py → mocap.py). Their files live in
 *  /models/springs/ and their ids carry that folder, so the picture and the
 *  model are found by the same name. */
const cast = (file: string, en: string, zh: string, height: number,
  noteEn: string, noteZh: string, ref?: string, refZh?: string): Item => ({
  id: `springs/${file}`, kind: 'cast', en, zh, height, ref, refZh, noteEn, noteZh, moves: true,
  whereEn: 'Here — made ahead of the scenes, six motions each', whereZh: '在这里——为场景先做好，每人六个动作' });

/** The register's own entries, so a height can never be stated twice. */
const fromRegister = (id: keyof typeof FIGURES, kind: Kind,
  ref: string, refZh: string, whereEn: string, whereZh: string): Item => {
  const f = FIGURES[id]!;
  return { id: f.file, kind, en: f.en, zh: f.zh, height: f.height, withers: f.withers,
           ref, refZh, noteEn: f.noteEn, noteZh: f.noteZh, whereEn, whereZh };
};

export const CATALOGUE: Item[] = [
  cast('young-man', 'A young man', '少年人', 1.74,
    'Generic; identifies no one. Slight, and his tunic is cut short and narrow in the sleeve — a working man\'s cut.',
    '通用形象，不指任何人。身形偏瘦，内袍裁得短、袖子窄——干活的人的剪法。'),
  cast('man', 'A man of forty', '四十岁的男子', 1.72,
    'Generic; identifies no one. His face is painted from a generated reference picture, not from any real person.',
    '通用形象，不指任何人。脸是照一张生成的参考图画上去的，不是哪个真人。'),
  cast('elijah', 'Elijah', '以利亚', 1.70,
    'Named because the text describes him: an hairy man, girt with a girdle of leather about his loins. So a mantle of rough hair-cloth over the tunic, and the leather girdle outermost, over the mantle. The face is not a portrait; nobody knows it.',
    '经文描写了他，所以才具名：「他身穿毛衣，腰束皮带」。所以内袍外罩一件粗毛外氅，皮带系在最外面、在外氅之上。脸不是画像——没有人知道他的长相。',
    '2 Kings 1:8', '列王纪下 1:8'),
  cast('old-man', 'An old man', '老人', 1.66,
    'Generic; identifies no one. White-haired, in a long, full robe. The face is painted from a generated reference picture.',
    '通用形象，不指任何人。白发，长袍又长又宽。脸是照一张生成的参考图画上去的。',
    'Leviticus 19:32', '利未记 19:32'),
  cast('woman', 'A woman', '女子', 1.62,
    'Generic; identifies no one. Veiled, and her robe is the fullest of the five, to the ground.',
    '通用形象，不指任何人。蒙着帕子，袍子是五个人里最宽的，一直到地。',
    'Genesis 24:65', '创世记 24:65'),
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
  { id: 'basket', kind: 'made', en: 'A basket', zh: '筐子', height: 0.22,
    ref: 'Deuteronomy 26:2', refZh: '申命记 26:2',
    noteEn: 'Not generated and not made here: a photographic scan from Poly Haven, released CC0. The firstfruits were carried in a basket; the text gives it no size, and this one is a real basket\'s.',
    noteZh: '不是生成的，也不是这里做的：Poly Haven 的实物扫描，CC0 公共领域。初熟的土产要装在筐子里；经文没有给尺寸，这是一只真筐子的尺寸。',
    whereEn: 'Here — for the offering scenes', whereZh: '在这里——为献祭场景备用' },
  { id: 'clay-pot', kind: 'made', en: 'An earthen pot', zh: '瓦器', height: 0.22,
    ref: 'Jeremiah 18:4', refZh: '耶利米书 18:4',
    noteEn: 'A scan of a plain terracotta pot (Poly Haven, CC0). The vessel that he made of clay was marred in the hand of the potter.',
    noteZh: '一只素面陶盆的实物扫描（Poly Haven，CC0）。「窑匠用泥做的器皿，在他手中做坏了」。',
    whereEn: 'Here — for the house scenes', whereZh: '在这里——为家中场景备用' },
  { id: 'bowl', kind: 'made', en: 'A bowl', zh: '盆', height: 0.09,
    ref: 'Judges 6:38', refZh: '士师记 6:38',
    noteEn: 'A scan of a carved wooden bowl (Poly Haven, CC0). Gideon wrung the dew out of the fleece, a bowl full of water.',
    noteZh: '一只木雕碗的实物扫描（Poly Haven，CC0）。基甸把羊毛上的露水拧出来，满了一盆水。',
    whereEn: 'Here — for the house scenes', whereZh: '在这里——为家中场景备用' },
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
  { key: 'cast', en: 'The cast — they move', zh: '会动的人',
    whatEn: 'Built here rather than generated: a measured body, a tunic sewn from flat panels and draped by cloth simulation, six motions taken from motion capture, and cloth that swings as they walk. Open one and choose what it does.',
    whatZh: '这几个是在这里造出来的，不是生成的：量过的身体，平面裁片缝出来、用布料模拟披上去的内袍，六个取自动作捕捉的动作，走起路来衣服会摆。点开一个，选它做什么。' },
  { key: 'people', en: 'People — still', zh: '人（静态）',
    whatEn: 'Generic forms. They identify no individual, and every man among them is short-haired — 1 Cor 11:14 is the only word in the letters on the subject.',
    whatZh: '通用形象，不指任何一个人。其中的男子都是短发——林前 11:14 是书信里唯一论到这件事的话。' },
  { key: 'creatures', en: 'Living creatures', zh: '活物',
    whatEn: 'Where the text names a kind — the raven, the dove, the camel — the kind is the text\'s. Where it does not, the species is a display choice and it says so.',
    whatZh: '经文点名的种类——乌鸦、鸽子、骆驼——就照经文。经文没有点名的，种类是展示选择，并且注明。' },
  { key: 'made', en: 'Things made', zh: '造物',
    whatEn: 'Only what the text describes without measuring. Everything the text measures is written as geometry instead — see below. The basket, the pot and the bowl are photographic scans of real objects, released into the public domain.',
    whatZh: '只有经文描述了却没有给尺寸的东西。凡经文给了尺寸的，一律用代码照尺寸写出来——见下。筐子、瓦器和盆是真实器物的扫描，已放入公共领域。' },
];
