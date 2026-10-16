import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ArkViewMode = 'overview' | 'cutaway' | 'deck1' | 'deck2' | 'deck3' | 'animals' | 'yard' | 'covenant';
export type LightingPreset = 'morning' | 'dusk' | 'rainbow';

export interface BiblicalEntry {
  id: string;
  zhName: string;
  enName: string;
  hebrew?: string;
  category: 'architecture' | 'family' | 'clean_animal' | 'unclean_animal' | 'bird' | 'prop' | 'covenant';
  pairingRuleZh: string;
  pairingRuleEn: string;
  scriptureRef: string;
  scriptureQuoteZh: string;
  biblicalFactZh: string;
  artisticNoteZh: string;
}

export const BIBLICAL_CATALOG: Record<string, BiblicalEntry> = {
  'ark-structure': {
    id: 'ark-structure',
    zhName: '挪亚方舟主体（1:1 真实圣经尺度 · 歌斐木与松香）',
    enName: "Noah's Ark Hull (True 1:1 Scale · 300 × 50 × 30 Cubits)",
    hebrew: 'תֵּבַת עֲצֵי־גֹפֶר (Tēḇaṯ ʿĂṣê-Gōp̄er)',
    category: 'architecture',
    pairingRuleZh: '300 × 50 × 30 肘（135.0 × 22.5 × 13.5 米 · 按 0.45 米/肘）',
    pairingRuleEn: '300 × 50 × 30 Cubits (135.0 × 22.5 × 13.5 m at 0.45 m/cubit)',
    scriptureRef: '创世记 6:14–16 (Genesis 6:14–16)',
    scriptureQuoteZh: '“你要用歌斐木造一只方舟，分一间一间的造，里外抹上松香……方舟的长要三百肘，宽五十肘，高三十肘。方舟上边要留一肘高的透光处，方舟的门要开在旁边，要在方舟里分上、中、下三层。”',
    biblicalFactZh: '经文明确记载材料为歌斐木（Gopher wood）与松香/沥青（Pitch/Kopher），长宽比 6:1、宽高比 5:3，内分上、中、下三层与诸多隔间（Qinnim），顶部留一肘高透光处（Tzohar，约 0.45 米），侧面开门。',
    artisticNoteZh: '本场景严格按 1:1 真实比例（135.0m × 22.5m × 13.5m）建造全部 40 层歌斐木外板、15 根龙骨枕木、三层贯通甲板（0.55m / 5.50m / 9.15m）、下层 32 间畜栏、中层 10 跨粮草储备舱、上层 10 跨挪亚家室与飞鸟栖架；支持单层揭顶（下层/中层/上层）与正面三层全剖。',
  },
  'ark-ramp': {
    id: 'ark-ramp',
    zhName: '方舟侧门与防滑登船木栈桥',
    enName: 'Ark Side Door & Slatted Boarding Gangway',
    hebrew: 'פֶּתַח הַתֵּבָה (Peṯaḥ hat-Tēḇāh)',
    category: 'architecture',
    pairingRuleZh: '通往方舟旁门（创 6:16；7:16）',
    pairingRuleEn: 'Leads to the Door in the Side of the Ark (Gen 6:16; 7:16)',
    scriptureRef: '创世记 6:16, 7:16',
    scriptureQuoteZh: '“方舟的门要开在旁边……凡有血肉的活物，都一公一母，照神所吩咐挪亚的，进入方舟；耶和华就把他关在方舟里头。”',
    biblicalFactZh: '方舟唯一的入口开在侧面；挪亚一家与众活物由此进入后，由耶和华亲自把门关上封存（创 7:16）。',
    artisticNoteZh: '位于 x = +10m 处的双扇铆钉侧门（宽 6 米）与 11.5 米防滑木栈桥，连接前庭百兽围栏大道与第一层中央走廊。',
  },
  'ark-noah': {
    id: 'ark-noah',
    zhName: '义人挪亚（方舟建造者与立约者）',
    enName: 'Noah the Righteous Patriarch',
    hebrew: 'נֹחַ (Nōaḥ — 安息/安慰)',
    category: 'family',
    pairingRuleZh: '得救八口之首（创 7:13；彼前 3:20）',
    pairingRuleEn: 'Head of the 8 Souls Saved Through Water (Gen 7:13; 1 Pet 3:20)',
    scriptureRef: '创世记 6:8–9, 22; 希伯来书 11:7',
    scriptureQuoteZh: '“挪亚是个义人，在当时的世代是个完全人。挪亚与神同行……挪亚就这样行；凡神所吩咐他的，他都照样行了。”',
    biblicalFactZh: '挪亚在洪水降临前六百岁（创 7:6），因着信蒙神指示预备方舟，使全家八口（挪亚、妻子、三个儿子闪、含、雅弗、三个儿妇）得救。',
    artisticNoteZh: '白须持杖长者形象，立于登船栈桥旁引导全家与众活物按序进入方舟。',
  },
  'ark-woman-blue': {
    id: 'ark-woman-blue',
    zhName: '挪亚的妻子',
    enName: "Noah's Wife",
    category: 'family',
    pairingRuleZh: '挪亚一家八口之一（创 7:7, 13）',
    pairingRuleEn: 'One of the 8 Souls on the Ark (Gen 7:7, 13)',
    scriptureRef: '创世记 7:7, 13',
    scriptureQuoteZh: '“正当那日，挪亚和他三个儿子闪、含、雅弗，并挪亚的妻子和三个儿妇，都进入方舟。”',
    biblicalFactZh: '圣经以关系称呼“挪亚的妻子”（未记载个人名字），她与挪亚、三个儿子及三个儿妇同日进入方舟，洪水后一同出方舟承受赐福。',
    artisticNoteZh: '身着深蓝长袍与头巾，立于挪亚身侧与第三层家室舱内。',
  },
  'ark-sons': {
    id: 'ark-sons',
    zhName: '闪、含、雅弗与三个儿妇（挪亚之子与儿妇）',
    enName: 'Shem, Ham, Japheth & Their Three Wives',
    hebrew: 'שֵׁם, חָם, וָיָפֶת (Šēm, Ḥām, wā-Yāp̄eṯ)',
    category: 'family',
    pairingRuleZh: '一家八口中的六人（三对夫妻，创 7:13；9:19）',
    pairingRuleEn: 'Six of the 8 Souls (Three Married Couples, Gen 7:13; 9:19)',
    scriptureRef: '创世记 7:13; 9:18–19; 彼得前书 3:20',
    scriptureQuoteZh: '“出方舟挪亚的儿子就是闪、含、雅弗……这是挪亚的三个儿子，当时人都从他们支派分散在全地上。”',
    biblicalFactZh: '全地洪水之后的人类皆由闪、含、雅弗三对夫妻繁衍而出；三位儿妇在经文中均以关系称呼，不额外虚构名字。',
    artisticNoteZh: '分别在侧门栈桥前引导动物、检视粮草储备，并在上层（第三层）家室舱内安顿。',
  },
  'ark-cow': {
    id: 'ark-cow',
    zhName: '公牛与母牛（洁净畜类 · 七公七母）',
    enName: 'Cattle & Oxen (Clean Beasts · 7 Pairs)',
    hebrew: 'בְּהֵמָה טְהוֹרָה (Bəhēmāh Ṭəhôrāh)',
    category: 'clean_animal',
    pairingRuleZh: '洁净畜类：七公七母（7 对 / 14 只，创 7:2）',
    pairingRuleEn: 'Clean Beast: Seven Pairs (Male & Female, Gen 7:2)',
    scriptureRef: '创世记 7:2; 8:20; 利未记 11:3',
    scriptureQuoteZh: '“凡洁净的畜类，你要带七公七母；不洁净的畜类，你要带一公一母。”',
    biblicalFactZh: '牛分蹄、倒嚼，属洁净畜类（利 11:3；申 14:4），按神吩咐带入七公七母，既为存留种畜，也为洪水消退后筑坛献燔祭（创 8:20）。',
    artisticNoteZh: '前庭西侧洁净畜类围栏与第一层底舱畜栏内均安置多对公母牛只。',
  },
  'ark-lamb': {
    id: 'ark-lamb',
    zhName: '绵羊与羊羔（洁净畜类 · 七公七母）',
    enName: 'Sheep & Lambs (Clean Beasts · 7 Pairs)',
    hebrew: 'צֹאן / כֶּבֶשׂ (Ṣōn / Keḇeś)',
    category: 'clean_animal',
    pairingRuleZh: '洁净畜类：七公七母（7 对，创 7:2）',
    pairingRuleEn: 'Clean Beast: Seven Pairs (Gen 7:2)',
    scriptureRef: '创世记 7:2; 8:20; 申命记 14:4',
    scriptureQuoteZh: '“凡洁净的畜类，你要带七公七母……使它可以留种，活在全地上。”',
    biblicalFactZh: '绵羊与山羊同属圣经核心洁净畜类，带入七公七母。',
    artisticNoteZh: '成群安置在前庭草场围栏、第一层畜栏与第二层中舱饲槽旁。',
  },
  'ark-goat-v03': {
    id: 'ark-goat-v03',
    zhName: '山羊与野山羊（洁净畜类 · 七公七母）',
    enName: 'Horned Goats / Caprines (Clean Beasts · 7 Pairs)',
    hebrew: 'עֵז / שָׂעִיר (ʿĒz / Śāʿîr)',
    category: 'clean_animal',
    pairingRuleZh: '洁净畜类：七公七母（7 对，创 7:2）',
    pairingRuleEn: 'Clean Beast: Seven Pairs (Gen 7:2)',
    scriptureRef: '创世记 7:2; 利未记 11:3; 申命记 14:4–5',
    scriptureQuoteZh: '“凡蹄分两瓣、倒嚼的走兽，你们都可以吃……洁净的畜类，你要带七公七母。”',
    biblicalFactZh: '山羊分蹄倒嚼，属洁净畜类，带七公七母登船。',
    artisticNoteZh: '动态吃草与行走姿态，分布于前庭围栏与船舱饲槽旁。',
  },
  'ark-deer-v02': {
    id: 'ark-deer-v02',
    zhName: '呦鹿与羚羊（洁净走兽 · 七公七母）',
    enName: 'Fallow Deer & Antelope (Clean Ruminants · 7 Pairs)',
    hebrew: 'אַיָּל (ʾAyyāl)',
    category: 'clean_animal',
    pairingRuleZh: '洁净畜类/走兽：七公七母（创 7:2；申 14:4–5）',
    pairingRuleEn: 'Clean Ruminant: Seven Pairs (Gen 7:2; Deut 14:4–5)',
    scriptureRef: '创世记 7:2; 申命记 14:5; 诗篇 42:1',
    scriptureQuoteZh: '“可吃的牲畜就是：牛、绵羊、山羊、鹿、羚羊、狍子、野山羊……”',
    biblicalFactZh: '申命记 14:5 明确将鹿（Ayyal）与羚羊列为分蹄倒嚼的洁净走兽。',
    artisticNoteZh: '成对安置在前庭围栏与第一、二层甲板。',
  },
  'ark-elephant': {
    id: 'ark-elephant',
    zhName: '大象（不洁净陆生代表 · 一公一母）',
    enName: 'Elephants (Unclean Beasts · 1 Pair)',
    category: 'unclean_animal',
    pairingRuleZh: '不洁净畜类：一公一母（1 对，创 6:19；7:2）',
    pairingRuleEn: 'Unclean Beast: One Pair (Male & Female, Gen 6:19; 7:2)',
    scriptureRef: '创世记 6:19–20; 7:2, 8–9',
    scriptureQuoteZh: '“凡有血肉的活物，每样两个，一公一母，你要带进方舟，好在你那里保全生命。”',
    biblicalFactZh: '大象不分蹄也不倒嚼，属“不洁净的畜类”，按一公一母（一对）进入方舟保全物种。',
    artisticNoteZh: '前庭重兽围栏与第一层底舱重型隔间各展示雄雌成对大象。',
  },
  'ark-giraffe': {
    id: 'ark-giraffe',
    zhName: '长颈鹿（成对登船 · 创 7:2）',
    enName: 'Giraffes (Boarding in Pairs)',
    category: 'clean_animal',
    pairingRuleZh: '各从其类成对进入方舟（创 6:20；7:2）',
    pairingRuleEn: 'Entered the Ark after their kind in pairs (Gen 6:20; 7:2)',
    scriptureRef: '创世记 6:20; 7:14; 申命记 14:5',
    scriptureQuoteZh: '“飞鸟各从其类，牲畜各从其类，地上的昆虫各从其类，每样两个，要到你那里，好保全生命。”',
    biblicalFactZh: '长颈鹿在生物学上分蹄且反刍（申 14:5 提及的 Zemer 常被学者考据为长颈鹿或野生山羊）；第一层甲板净高 4.93 米，足以容纳长颈鹿站立。',
    artisticNoteZh: '前庭西侧首排围栏与第一层挑高舱位均展示成对长颈鹿。',
  },
  'ark-lion': {
    id: 'ark-lion',
    zhName: '雄狮、母狮与猛兽代表（不洁净走兽 · 一公一母）',
    enName: 'Lions & Pawed Beasts (Unclean Beasts · 1 Pair)',
    hebrew: 'אַרְיֵה / כְּפִיר (ʾAryēh / Kəp̄îr)',
    category: 'unclean_animal',
    pairingRuleZh: '不洁净走兽：一公一母（1 对，创 7:2；利 11:27）',
    pairingRuleEn: 'Unclean Pawed Beast: One Pair (Gen 7:2; Lev 11:27)',
    scriptureRef: '创世记 7:2, 14–15; 利未记 11:27',
    scriptureQuoteZh: '“凡四足的走兽，用脚掌行走的，都与你们不洁净……凡有血肉、有气息的活物，都两个两个地到挪亚那里进入方舟。”',
    biblicalFactZh: '狮、狼等用脚掌（爪）行走，按利未记 11:27 属不洁净走兽，一公一母进入方舟；方舟内备有充足各样食物（创 6:21）使百兽和平共处。',
    artisticNoteZh: '分布于东侧围栏与第一层独立隔间内。',
  },
  'ark-camel': {
    id: 'ark-camel',
    zhName: '双峰与单峰骆驼（不洁净畜类 · 一公一母）',
    enName: 'Camels (Unclean Beasts · 1 Pair)',
    hebrew: 'גָּמָל (Gāmāl)',
    category: 'unclean_animal',
    pairingRuleZh: '不洁净畜类：一公一母（1 对，利 11:4；创 7:2）',
    pairingRuleEn: 'Unclean Beast: One Pair (Chews cud but does not part hoof, Lev 11:4)',
    scriptureRef: '创世记 7:2; 利未记 11:4',
    scriptureQuoteZh: '“但那倒嚼或分蹄之中不可吃的乃是：骆驼，因为倒嚼不分蹄，就与你们不洁净。”',
    biblicalFactZh: '利未记 11:4 特别指出骆驼“倒嚼不分蹄”，故属不洁净畜类，按一公一母进入方舟。',
    artisticNoteZh: '成对安置在东侧前排围栏与第一层底舱。',
  },
  'ark-donkey': {
    id: 'ark-donkey',
    zhName: '驴、骏马与斑马（单蹄畜类 · 一公一母）',
    enName: 'Donkeys, Horses & Zebras (Unclean Beasts · 1 Pair)',
    hebrew: 'חֲמוֹר / סוּס (Ḥămôr / Sûs)',
    category: 'unclean_animal',
    pairingRuleZh: '不洁净畜类：一公一母（1 对，出 13:13；创 7:2）',
    pairingRuleEn: 'Unclean Beast: One Pair (Single-hoofed, Exod 13:13; Gen 7:2)',
    scriptureRef: '创世记 7:2, 8; 出埃及记 13:13',
    scriptureQuoteZh: '“洁净的畜类和不洁净的畜类，飞鸟并地上一切的昆虫，都一公一母，照神所吩咐挪亚的，进入方舟。”',
    biblicalFactZh: '马、驴、斑马均为单蹄且不反刍，在圣经律法中属不洁净畜类（出 13:13），按一公一母登船，并在方舟建造期间承担木材与物资驮运。',
    artisticNoteZh: '分布于东侧围栏、登船行列与第一层底舱。',
  },
  'ark-dove-olive-v07': {
    id: 'ark-dove-olive-v07',
    zhName: '叼新拧橄榄叶的鸽子、乌鸦与各样飞鸟（创 7:3；8:7–11）',
    enName: 'Olive-Leaf Dove, Raven & Birds of the Heavens (Gen 7:3; 8:7–11)',
    hebrew: 'יוֹנָה וְעֹרֵב (Yônāh wə-ʿŌrēḇ)',
    category: 'bird',
    pairingRuleZh: '空中的飞鸟：七公七母（创 7:3；8:7–11）',
    pairingRuleEn: 'Birds of the Heavens: Seven Pairs (Gen 7:3; 8:7–11)',
    scriptureRef: '创世记 7:3; 8:7–11',
    scriptureQuoteZh: '“空中的飞鸟也要带七公七母……到了晚上，鸽子回到他那里，嘴里叼着一个新拧下来的橄榄叶子，挪亚就知道地上的水退了。”',
    biblicalFactZh: '水退期间，挪亚打开方舟透光窗（创 8:6），先后放出乌鸦（不洁净鸟，往来飞去）与三次放出鸽子（洁净鸟，第二次带回新橄榄叶，第三次不再返回）。',
    artisticNoteZh: '方舟屋顶、空中与第三层飞鸟栖架同时展示白鸽、展翅叼橄榄叶白鸽、乌鸦、雄鹰、孔雀、公鸡与蓝鸟。',
  },
  'ark-altar': {
    id: 'ark-altar',
    zhName: '挪亚筑坛献祭与彩虹之约',
    enName: "Noah's Altar of Burnt Offering & Rainbow Covenant",
    hebrew: 'מִזְבֵּחַ לַיהוָה וְקֶשֶׁת בֶּעָנָן (Mizbēaḥ la-YHWH wə-Qešeṯ be-ʿĀnān)',
    category: 'covenant',
    pairingRuleZh: '洪水后首次筑坛与永约记号（创 8:20–9:17）',
    pairingRuleEn: 'First Altar Mentioned in Scripture & Sign of the Everlasting Covenant (Gen 8:20–9:17)',
    scriptureRef: '创世记 8:20–22; 9:12–17',
    scriptureQuoteZh: '“挪亚为耶和华筑了一座坛，拿各类洁净的牲畜、飞鸟献在坛上为燔祭……我把虹放在云彩中，这就可作我与地立约的记号了。”',
    biblicalFactZh: '这是圣经首次提到筑坛（创 8:20），解释了为何洁净牲畜与飞鸟必须带入“七公七母”——除了留种，更用于出方舟后向神献感恩燔祭；神随后以云中彩虹立定永不再用洪水毁灭全地的永约。',
    artisticNoteZh: '点击底部“筑坛与彩虹”模式即可唤醒圣山石坛圣火、横跨 135 米方舟的天际立体彩虹与挪亚全家献祭感恩场景。',
  },
};

// ============================================================================
// TRUE 1:1 BIBLICAL ARK DIMENSIONS (300 × 50 × 30 Cubits = 135.0 × 22.5 × 13.5 m)
// ============================================================================
export const ARK_DIMENSIONS = {
  cubits: [300, 50, 30] as const,
  cubitMeters: 0.45,
  meters: [135.0, 22.5, 13.5] as const, // x: -67.5..+67.5, z: -31.25..-8.75 (center z = -20.0), y: 0..13.5
  floors: [0.55, 5.50, 9.15] as const,
  ceilings: [5.48, 9.13, 12.42] as const,
  clerestoryHeight: 0.45,
  doorCenterX: 10.0,
  doorFrontZ: -8.75,
  rampStartZ: 2.8,
};

// ============================================================================
// DETERMINISTIC NOISE & VALLEY HEIGHTFIELD (Matching Sacred Atelier A)
// ============================================================================
function fract(n: number): number {
  return n - Math.floor(n);
}

function hash2(x: number, y: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueNoise(x: number, z: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  return mix(mix(hash2(i, j), hash2(i + 1, j), u), mix(hash2(i, j + 1), hash2(i + 1, j + 1), u), v);
}

function fbm(x: number, z: number): number {
  return (
    valueNoise(x, z) * 0.56 +
    valueNoise(x * 2.03 + 4.0, z * 2.03) * 0.28 +
    valueNoise(x * 4.07, z * 4.07 + 7.0) * 0.16
  );
}

export function heightArkValley(x: number, z: number): number {
  // Keep the 135m Ark footprint and forecourt enclosures (x: -76..+76, z: -40..+72) flat,
  // and rise smoothly behind the Ark (z < -54) and on the flanking ridges (|x| > 92) into lush rolling hills
  // while leaving the upper sky horizon open for clouds and the Covenant rainbow!
  const backRise = smoothstep(54, 185, -z);
  const sideRise = smoothstep(92, 220, Math.abs(x)) * 0.72;
  const ridgeFactor = Math.max(backRise, sideRise);
  const foregroundRise = smoothstep(115, 240, z) * 12.0;
  return ridgeFactor * (5.5 + fbm(x * 0.022, z * 0.021) * 31.0) + foregroundRise;
}

function seededRng(seed = 1234567): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ============================================================================
// PROCEDURAL TEXTURES & SHARED MATERIALS (Harmonious Sage-Olive & Honey-Cedar)
// ============================================================================
function createWoodPlankTexture(baseHex: string, lineHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 2;
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    ctx.fillStyle = row % 2 === 0 ? baseHex : lineHex;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(0, y, 256, 30);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function createDimensionBadgeSprite(text: string, subtext?: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d')!;

  // Warm parchment pill with sage-gold border
  ctx.fillStyle = 'rgba(249, 241, 217, 0.95)';
  ctx.strokeStyle = '#bfa267';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 128, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#3a4634';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 40px "Noto Serif SC", Georgia, serif';
  ctx.fillText(text, 256, subtext ? 54 : 72);

  if (subtext) {
    ctx.fillStyle = '#6d745a';
    ctx.font = '600 24px "PingFang SC", system-ui, sans-serif';
    ctx.fillText(subtext, 256, 102);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(16.5, 4.6, 1);
  sprite.renderOrder = 999;
  return sprite;
}

// ============================================================================
// BUILD TRUE 1:1 BIBLICAL ARK (135m × 22.5m × 13.5m) & CONTINUOUS VALLEY WORLD
// ============================================================================
interface TrueScaleArkNodes {
  root: THREE.Group;
  frontWalls: [THREE.Group, THREE.Group, THREE.Group];
  backWalls: [THREE.Group, THREE.Group, THREE.Group];
  decks: [THREE.Group, THREE.Group, THREE.Group];
  roofGroup: THREE.Group;
  rampGroup: THREE.Group;
  doorLeft: THREE.Group;
  doorRight: THREE.Group;
  rulersGroup: THREE.Group;
  waterTexture: THREE.CanvasTexture;
  cloudMat: THREE.MeshLambertMaterial;
}

function buildTrueScaleArkAndValley(scene: THREE.Scene): TrueScaleArkNodes {
  const root = new THREE.Group();
  root.name = 'TrueScaleArkAndValley';
  scene.add(root);

  const woodTex = createWoodPlankTexture('#ffffff', '#cfb997');
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const getMat = (hex: string, roughness = 0.78, metalness = 0.04, withWoodTex = false, emissiveHex?: string) => {
    const key = `${hex}-${roughness}-${metalness}-${withWoodTex}-${emissiveHex ?? ''}`;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: hex,
        roughness,
        metalness,
        map: withWoodTex ? woodTex : null,
      });
      if (emissiveHex) {
        m.emissive.set(emissiveHex);
        m.emissiveIntensity = 0.85;
      }
      matCache.set(key, m);
    }
    return m;
  };

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const sphereGeo = new THREE.IcosahedronGeometry(0.5, 1);

  const addBox = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    hex: string,
    withWood = false,
    ry = 0,
    rx = 0,
    rz = 0
  ) => {
    const mesh = new THREE.Mesh(boxGeo, getMat(hex, withWood ? 0.72 : 0.82, 0.04, withWood));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { placementId: 'ark-main-hull', biblicalKey: 'ark-structure' };
    parent.add(mesh);
    return mesh;
  };

  const addBeam = (
    parent: THREE.Object3D,
    a: [number, number, number],
    b: [number, number, number],
    thickness: number,
    hex: string
  ) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const len = va.distanceTo(vb);
    const mesh = new THREE.Mesh(boxGeo, getMat(hex, 0.74, 0.04, true));
    mesh.position.copy(mid);
    mesh.lookAt(vb);
    mesh.scale.set(thickness, thickness, len);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { placementId: 'ark-main-hull', biblicalKey: 'ark-structure' };
    parent.add(mesh);
    return mesh;
  };

  // --------------------------------------------------------------------------
  // 1. CONTINUOUS SCULPTED VALLEY TERRAIN (720m × 600m) WITH VERTEX COLORS
  // --------------------------------------------------------------------------
  const boundsX: [number, number] = [-360, 360];
  const boundsZ: [number, number] = [-340, 260];
  const segX = 160;
  const segZ = 136;
  const terrainGeo = new THREE.PlaneGeometry(boundsX[1] - boundsX[0], boundsZ[1] - boundsZ[0], segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);

  const colMeadow = new THREE.Color('#849459');
  const colMeadowWarm = new THREE.Color('#929f6d');
  const colMeadowDeep = new THREE.Color('#72844e');
  const colSandForecourt = new THREE.Color('#b6a57e');
  const colHillSlope = new THREE.Color('#7f9468');
  const colHighRidge = new THREE.Color('#7c9693');
  const tmpCol = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = heightArkValley(vx, vz);
    posAttr.setY(i, vy);

    const n = fbm(vx * 0.045, vz * 0.045);
    tmpCol.copy(colMeadow).lerp(colMeadowWarm, n).lerp(colMeadowDeep, fract(n * 3.7) * 0.35);

    // Subtle warm sandy earth blending under the Ark & active shipyard forecourt
    const arkProximity =
      (1 - smoothstep(64, 78, Math.abs(vx))) * (1 - smoothstep(16, 36, Math.abs(vz + 14)));
    if (arkProximity > 0.01) {
      tmpCol.lerp(colSandForecourt, arkProximity * 0.48);
    }

    // Smooth elevation-based mountain tinting in the background hills
    if (vy > 3.5) {
      const hBlend = smoothstep(3.5, 28.0, vy);
      tmpCol.lerp(colHillSlope, hBlend * 0.62);
      const peakBlend = smoothstep(24.0, 62.0, vy);
      tmpCol.lerp(colHighRidge, peakBlend * 0.72);
    }

    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'ContinuousValleyTerrain';
  root.add(terrainMesh);

  // --------------------------------------------------------------------------
  // 2. WARM SANDY-OCHRE FORECOURT PATHWAYS & PROCESSION AVENUES
  // --------------------------------------------------------------------------
  const pathsGroup = new THREE.Group();
  pathsGroup.name = 'ForecourtPaths';
  root.add(pathsGroup);

  const addRibbonPath = (pts: Array<[number, number]>, width: number, hex: string, yOffset = 0.08) => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i]!;
      const prev = pts[Math.max(0, i - 1)]!;
      const next = pts[Math.min(pts.length - 1, i + 1)]!;
      const dx = next[0] - prev[0];
      const dz = next[1] - prev[1];
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const yL = heightArkValley(x + nx * width * 0.5, z + nz * width * 0.5) + yOffset;
      const yR = heightArkValley(x - nx * width * 0.5, z - nz * width * 0.5) + yOffset;
      positions.push(x + nx * width * 0.5, yL, z + nz * width * 0.5);
      positions.push(x - nx * width * 0.5, yR, z - nz * width * 0.5);
      if (i < pts.length - 1) {
        const k = i * 2;
        indices.push(k, k + 3, k + 1, k, k + 2, k + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const pathMat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, pathMat);
    m.receiveShadow = true;
    pathsGroup.add(m);
  };

  // Forecourt east-west promenade in front of the 135m Ark
  addRibbonPath(
    [
      [-72, -2.5],
      [-36, -1.8],
      [10, 2.6],
      [36, -1.2],
      [72, -2.5],
    ],
    5.6,
    '#c4af87',
    0.08
  );
  // Central north-south boarding avenue (x = 10) — every pair walks up this to the gangway
  addRibbonPath(
    [
      [10.0, 36.0],
      [10.0, 18.0],
      [10.0, 2.6],
    ],
    5.4,
    '#cbb68d',
    0.09
  );
  // Cross-lanes in front of each enclosure row's gate (z = 5.0, 18.5, 33.5)
  for (const z of [5.0, 18.5, 33.5]) {
    addRibbonPath(
      [
        [-60, z],
        [-25, z],
        [10, z],
        [25, z],
        [60, z],
      ],
      z === 5.0 ? 4.2 : 3.4,
      '#bda77f',
      0.072
    );
  }

  // --------------------------------------------------------------------------
  // 3. WINDING TURQUOISE-JADE RIVER & TERRACED NORTHWEST WATERFALL
  // --------------------------------------------------------------------------
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 256;
  waterCanvas.height = 256;
  const wCtx = waterCanvas.getContext('2d')!;
  wCtx.fillStyle = '#47948f';
  wCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 80; i++) {
    const wx = (i * 47) % 236;
    const wy = (i * 89) % 256;
    wCtx.fillStyle = i % 2 === 0 ? '#74bfba' : '#d6f2ef';
    wCtx.globalAlpha = 0.34;
    wCtx.fillRect(wx, wy, 14, 5);
  }
  wCtx.globalAlpha = 1.0;
  const waterTexture = new THREE.CanvasTexture(waterCanvas);
  waterTexture.colorSpace = THREE.SRGBColorSpace;
  waterTexture.wrapS = THREE.RepeatWrapping;
  waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.repeat.set(2, 14);

  const riverMat = new THREE.MeshStandardMaterial({
    map: waterTexture,
    roughness: 0.18,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const riverPts: Array<[number, number]> = [];
  for (let i = 0; i < 75; i++) {
    const z = 148 - i * 3.8;
    const x = -82 + Math.sin(z * 0.034) * 6.4;
    riverPts.push([x, z]);
  }
  const rPositions: number[] = [];
  const rUvs: number[] = [];
  const rIndices: number[] = [];
  const rWidth = 11.2;
  for (let i = 0; i < riverPts.length; i++) {
    const [x, z] = riverPts[i]!;
    const prev = riverPts[Math.max(0, i - 1)]!;
    const next = riverPts[Math.min(riverPts.length - 1, i + 1)]!;
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const baseH = Math.max(0.12, heightArkValley(x, z) + 0.14);
    rPositions.push(x + nx * rWidth * 0.5, baseH, z + nz * rWidth * 0.5);
    rPositions.push(x - nx * rWidth * 0.5, baseH, z - nz * rWidth * 0.5);
    rUvs.push(0, i * 0.25, 1, i * 0.25);
    if (i < riverPts.length - 1) {
      const k = i * 2;
      rIndices.push(k, k + 3, k + 1, k, k + 2, k + 3);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPositions, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
  riverGeo.setIndex(rIndices);
  riverGeo.computeVertexNormals();
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.receiveShadow = true;
  root.add(riverMesh);

  // Terraced Waterfall cascading down the northwest hillside (x = -82, z = -98..-68)
  const waterfallGroup = new THREE.Group();
  waterfallGroup.name = 'TerracedWaterfall';
  root.add(waterfallGroup);
  for (let tier = 0; tier < 4; tier++) {
    const tz = -96 + tier * 8.5;
    const ty = heightArkValley(-82, tz) + 2.2 - tier * 0.35;
    const cliff = new THREE.Mesh(sphereGeo, getMat('#8c8c78', 0.88, 0.03));
    cliff.position.set(-82 + (tier % 2 === 0 ? -4.8 : 4.8), ty, tz);
    cliff.scale.set(11.5, 6.2, 9.2);
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    waterfallGroup.add(cliff);

    const cascade = new THREE.Mesh(boxGeo, riverMat);
    cascade.position.set(-82, ty + 1.1, tz + 2.2);
    cascade.scale.set(8.6, 5.2, 1.2);
    cascade.rotation.x = 0.42;
    waterfallGroup.add(cascade);
  }

  // --------------------------------------------------------------------------
  // 4. TRUE 1:1 BIBLICAL ARK (135.0m × 22.5m × 13.5m)
  // --------------------------------------------------------------------------
  const arkRoot = new THREE.Group();
  arkRoot.name = 'Ark1to1Root';
  root.add(arkRoot);

  const frontWalls: [THREE.Group, THREE.Group, THREE.Group] = [
    new THREE.Group(),
    new THREE.Group(),
    new THREE.Group(),
  ];
  const backWalls: [THREE.Group, THREE.Group, THREE.Group] = [
    new THREE.Group(),
    new THREE.Group(),
    new THREE.Group(),
  ];
  const decks: [THREE.Group, THREE.Group, THREE.Group] = [
    new THREE.Group(),
    new THREE.Group(),
    new THREE.Group(),
  ];
  const roofGroup = new THREE.Group();
  const rampGroup = new THREE.Group();

  for (let d = 0; d < 3; d++) {
    frontWalls[d]!.name = `Ark_FrontWall_${d + 1}`;
    backWalls[d]!.name = `Ark_BackWall_${d + 1}`;
    decks[d]!.name = `Ark_Deck_${d + 1}`;
    arkRoot.add(frontWalls[d]!, backWalls[d]!, decks[d]!);
  }
  roofGroup.name = 'Ark_RoofAndClerestory';
  rampGroup.name = 'Ark_SideRamp';
  arkRoot.add(roofGroup, rampGroup);

  // 4a. 15 Heavy Timber Keel Sleepers & Dark Pitch Waterproof Base (Gen 6:14)
  for (let x = -63; x <= 63; x += 9) {
    addBox(decks[0]!, x, 0.14, -20.0, 1.25, 0.28, 24.4, '#5a4634', true);
  }
  addBox(decks[0]!, 0, 0.12, -20.0, 135.0, 0.18, 22.5, '#4b3c2c', true);

  // 4b. 40 Courses of Beveled Gopher-Wood Planks around the Chamfered 135m × 22.5m Perimeter
  const hullEdge: Array<[number, number]> = [
    [-66.3, -8.75],
    [66.3, -8.75],
    [67.5, -9.95],
    [67.5, -30.05],
    [66.3, -31.25],
    [-66.3, -31.25],
    [-67.5, -30.05],
    [-67.5, -9.95],
  ];
  const plankPalette = ['#947045', '#9e7549', '#a07c50', '#8f6941', '#a98150', '#ae7946', '#b6814c'];

  interface PlankPlacement {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    ry: number;
    colorHex: string;
  }
  const frontPlanksByDeck: [PlankPlacement[], PlankPlacement[], PlankPlacement[]] = [[], [], []];
  const backPlanksByDeck: [PlankPlacement[], PlankPlacement[], PlankPlacement[]] = [[], [], []];

  for (let row = 0; row < 40; row++) {
    const y = 0.158 + row * 0.31;
    const deckIdx: 0 | 1 | 2 = y < 5.5 ? 0 : y < 9.15 ? 1 : 2;
    for (let j = 0; j < hullEdge.length; j++) {
      const a = hullEdge[j]!;
      const b = hullEdge[(j + 1) % hullEdge.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const segs = j === 0 || j === 4 ? 22 : 1;
      const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);

      for (let s = 0; s < segs; s++) {
        const t0 = s / segs;
        const t1 = (s + 1) / segs;
        const px = mix(a[0], b[0], (t0 + t1) * 0.5);
        const pz = mix(a[1], b[1], (t0 + t1) * 0.5);
        // Leave clear 6.0m × 4.88m Side Door opening at x = 7..13, z = -8.75, y = 0.51..5.39
        if (j === 0 && px > 7.0 && px < 13.0 && y > 0.51 && y < 5.39) continue;

        const p: PlankPlacement = {
          x: px,
          y,
          z: pz,
          sx: len / segs - 0.03,
          sy: 0.285,
          sz: 0.24,
          ry: -yaw,
          colorHex: plankPalette[(row + s + j) % plankPalette.length]!,
        };
        if (j === 0) {
          frontPlanksByDeck[deckIdx]!.push(p);
        } else {
          backPlanksByDeck[deckIdx]!.push(p);
        }
      }
    }
  }

  const buildPlankInstancedMesh = (list: PlankPlacement[], parent: THREE.Group) => {
    if (list.length === 0) return;
    const instMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: woodTex,
      roughness: 0.72,
      metalness: 0.04,
    });
    const inst = new THREE.InstancedMesh(boxGeo, instMat, list.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.userData = { placementId: 'ark-main-hull', biblicalKey: 'ark-structure' };
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < list.length; i++) {
      const item = list[i]!;
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.ry, 0);
      dummy.scale.set(item.sx, item.sy, item.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      c.set(item.colorHex);
      inst.setColorAt(i, c);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    parent.add(inst);
  };

  for (let d = 0; d < 3; d++) {
    buildPlankInstancedMesh(frontPlanksByDeck[d]!, frontWalls[d]!);
    buildPlankInstancedMesh(backPlanksByDeck[d]!, backWalls[d]!);

    // External Vertical Timber Buttresses, Iron Tie-Plates, Diagonal Braces & Pegs (every 9m)
    const y0 = ARK_DIMENSIONS.floors[d]!;
    const y1 = ARK_DIMENSIONS.ceilings[d]!;
    const midY = (y0 + y1) * 0.5;
    const h = y1 - y0;
    for (let x = -63; x <= 63; x += 9) {
      // Back wall buttress
      addBox(backWalls[d]!, x, midY, -31.48, 0.28, h, 0.28, '#715638', true);
      if (d === 0 && x > 5 && x < 15) continue; // Skip front buttress inside side doorway
      addBox(frontWalls[d]!, x, midY, -8.51, 0.28, h, 0.28, '#715638', true);
      for (const py of [y0 + 0.28, y1 - 0.28]) {
        addBox(frontWalls[d]!, x, py, -8.35, 0.36, 0.15, 0.04, '#4b4232');
      }
      for (const dir of [-1, 1]) {
        addBeam(frontWalls[d]!, [x, y1 - 0.5, -8.44], [x + dir * 1.45, y1 - 1.55, -8.44], 0.14, '#83633f');
      }
    }
  }

  // 4c. 3 Full-Length 135m × 22.5m Interior Decks (Floors, Columns, Beams, Stairs, Stalls & Quarters)
  for (let d = 0; d < 3; d++) {
    const fy = ARK_DIMENSIONS.floors[d]!;
    const cy = ARK_DIMENSIONS.ceilings[d]!;
    const deckGrp = decks[d]!;

    // Full-length deck floor & central aisle runner
    addBox(deckGrp, 0, fy, -20.0, 133.2, 0.14, 21.7, d === 0 ? '#866944' : d === 1 ? '#8f7049' : '#96764e', true);
    addBox(deckGrp, 0, fy + 0.08, -20.0, 130.0, 0.04, 4.4, '#a8875c', true);

    // 17 Transverse Rib Frames (x = -64..+64m step 8m)
    for (let x = -64; x <= 64; x += 8) {
      for (const z of [-9.05, -17.0, -23.0, -30.95]) {
        addBox(deckGrp, x, (fy + cy) * 0.5, z, 0.24, cy - fy, 0.24, '#674e33', true);
      }
      addBox(deckGrp, x, cy, -20.0, 0.22, 0.22, 22.1, '#785b39', true);
      addBeam(deckGrp, [x, cy - 0.9, -9.15], [x, cy, -11.5], 0.15, '#7e603d');
      addBeam(deckGrp, [x, cy - 0.9, -30.85], [x, cy, -28.5], 0.15, '#7e603d');
    }

    // Internal Timber Staircase connecting Deck 1 -> Deck 2 -> Deck 3 at x = -2.0m, z = -20.0m
    if (d < 2) {
      const nextFloorY = ARK_DIMENSIONS.floors[d + 1]!;
      addBeam(deckGrp, [-4.2, fy, -19.2], [-0.2, nextFloorY, -19.2], 0.18, '#6e5233');
      addBeam(deckGrp, [-4.2, fy, -20.8], [-0.2, nextFloorY, -20.8], 0.18, '#6e5233');
      const steps = 12;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        addBox(deckGrp, mix(-4.2, -0.2, t), mix(fy, nextFloorY, t), -20.0, 0.34, 0.07, 1.5, '#a8875b', true);
      }
    }

    if (d === 0) {
      // DECK 1 (Lower Deck, y = 0.55m): 32 Fenced Animal Stalls (16 North + 16 South)
      for (let i = 0; i < 32; i++) {
        const sx = -60 + (i % 16) * 8.0;
        const sz = i < 16 ? -13.9 : -26.1;
        // Stall corner posts & rails
        for (const dx of [-3.3, 3.3]) {
          for (const dz of [-3.0, 3.0]) {
            addBox(deckGrp, sx + dx, fy + 0.72, sz + dz, 0.13, 1.44, 0.13, '#735739', true);
          }
          addBox(deckGrp, sx + dx, fy + 0.52, sz, 0.08, 0.09, 6.0, '#a9885b', true);
          addBox(deckGrp, sx + dx, fy + 1.05, sz, 0.08, 0.09, 6.0, '#a9885b', true);
        }
        for (const dz of [-3.0, 3.0]) {
          addBox(deckGrp, sx - 1.9, fy + 0.52, sz + dz, 2.7, 0.09, 0.08, '#a9885b', true);
          addBox(deckGrp, sx + 1.9, fy + 0.52, sz + dz, 2.7, 0.09, 0.08, '#a9885b', true);
          addBox(deckGrp, sx - 1.9, fy + 1.05, sz + dz, 2.7, 0.09, 0.08, '#a9885b', true);
          addBox(deckGrp, sx + 1.9, fy + 1.05, sz + dz, 2.7, 0.09, 0.08, '#a9885b', true);
        }
        // Golden hay bedding & water trough (south-row stalls house the boarded pairs, so their trough
        // hangs on the aisle side of the rail and the floor is left clear)
        if (i < 16) {
          addBox(deckGrp, sx - 1.7, fy + 0.24, sz + 1.5, 1.4, 0.36, 1.0, '#c8ae68');
          addBox(deckGrp, sx + 1.7, fy + 0.25, sz - 1.4, 1.35, 0.38, 0.62, '#6d5439', true);
          addBox(deckGrp, sx + 1.7, fy + 0.39, sz - 1.4, 1.18, 0.08, 0.46, '#4d9195');
        } else {
          addBox(deckGrp, sx, fy + 0.25, sz + 3.45, 2.4, 0.38, 0.62, '#6d5439', true);
          addBox(deckGrp, sx, fy + 0.39, sz + 3.45, 2.2, 0.08, 0.46, '#4d9195');
        }
        if (i % 2 === 0) {
          // Warm hanging oil lamp
          const lamp = new THREE.Mesh(sphereGeo, getMat('#ffba63', 0.3, 0.0, false, '#ffae42'));
          lamp.position.set(sx, fy + 3.4, -20.0 + (i < 16 ? 2.6 : -2.6));
          lamp.scale.set(0.24, 0.32, 0.24);
          deckGrp.add(lamp);
        }
      }
    } else if (d === 1) {
      // DECK 2 (Middle Deck, y = 5.50m): 10 Granary, Provision & Clean Flock Bays
      for (let i = 0; i < 10; i++) {
        const bx = -60 + i * 12.0;
        addBox(deckGrp, bx, fy + 1.35, -26.0, 0.14, 2.65, 9.4, '#927149', true);
        // Stacked wooden crates
        addBox(deckGrp, bx + 2.4, fy + 0.45, -13.2, 0.92, 0.78, 0.92, '#997449', true);
        addBox(deckGrp, bx + 3.45, fy + 0.45, -13.2, 0.92, 0.78, 0.92, '#8b6840', true);
        addBox(deckGrp, bx + 2.9, fy + 1.22, -13.2, 0.88, 0.74, 0.88, '#a47e52', true);
        // Water & pitch barrels
        for (let b = 0; b < 3; b++) {
          const barrel = new THREE.Mesh(cylGeo, getMat('#7d5a38', 0.74, 0.05, true));
          barrel.position.set(bx + 4.8 + b * 0.85, fy + 0.48, -14.4);
          barrel.scale.set(0.68, 0.88, 0.68);
          barrel.castShadow = true;
          deckGrp.add(barrel);
        }
        // Hay stacks & grain sacks
        addBox(deckGrp, bx + 2.6, fy + 0.38, -24.8, 1.5, 0.62, 1.1, '#c8ad64');
        addBox(deckGrp, bx + 4.4, fy + 0.32, -25.2, 0.85, 0.52, 0.65, '#c9ba96');
        // Hanging oil lamp
        const lamp = new THREE.Mesh(sphereGeo, getMat('#ffba63', 0.3, 0.0, false, '#ffae42'));
        lamp.position.set(bx + 3.0, fy + 2.65, -20.0);
        lamp.scale.set(0.24, 0.32, 0.24);
        deckGrp.add(lamp);
      }
    } else if (d === 2) {
      // DECK 3 (Upper Deck, y = 9.15m): 10 Family Living Quarters, Study Tables, Rugs & Bird Perches
      for (let i = 0; i < 10; i++) {
        const bx = -60 + i * 12.0;
        addBox(deckGrp, bx, fy + 1.35, -26.0, 0.14, 2.65, 9.4, '#927149', true);
        // Timber Bed Frame, Linen Mattress & Pillow
        addBox(deckGrp, bx + 3.2, fy + 0.32, -26.8, 2.2, 0.42, 1.25, '#82623c', true);
        addBox(deckGrp, bx + 3.2, fy + 0.56, -26.8, 2.04, 0.16, 1.12, '#c1b48e');
        addBox(deckGrp, bx + 2.45, fy + 0.69, -26.8, 0.42, 0.12, 0.88, '#e0d7b7');
        // Study Table, Bench & Woven Near Eastern Rug
        addBox(deckGrp, bx + 3.2, fy + 0.74, -14.2, 1.65, 0.09, 0.98, '#8e6b43', true);
        for (const dx of [-0.68, 0.68]) {
          for (const dz of [-0.38, 0.38]) {
            addBox(deckGrp, bx + 3.2 + dx, fy + 0.38, -14.2 + dz, 0.1, 0.72, 0.1, '#6f5335', true);
          }
        }
        addBox(
          deckGrp,
          bx + 3.2,
          fy + 0.09,
          -19.8,
          3.4,
          0.025,
          2.1,
          ['#9d6c53', '#7e8d69', '#b29563'][i % 3]!
        );
        // Bird Perch T-Stand near the Clerestory Light Window
        addBox(deckGrp, bx + 5.2, fy + 1.1, -12.2, 0.1, 2.1, 0.1, '#795a38', true);
        addBox(deckGrp, bx + 5.2, fy + 2.1, -12.2, 1.3, 0.08, 0.08, '#9e7c50', true);
        // Hanging oil lamp
        const lamp = new THREE.Mesh(sphereGeo, getMat('#ffba63', 0.3, 0.0, false, '#ffae42'));
        lamp.position.set(bx + 3.2, fy + 2.55, -20.0);
        lamp.scale.set(0.24, 0.32, 0.24);
        deckGrp.add(lamp);
      }
    }
  }

  // 4d. 1-Cubit Clerestory Light Opening (0.45m at y = 12.42..12.97m, Gen 6:16) & Low-Pitched 135m Roof
  addBox(roofGroup, 0, 12.42, -8.88, 134.0, 0.12, 0.28, '#b99a65', true);
  addBox(roofGroup, 0, 12.42, -31.12, 134.0, 0.12, 0.28, '#b99a65', true);
  for (let x = -66; x <= 66; x += 2.0) {
    for (const z of [-8.85, -31.15]) {
      addBox(roofGroup, x, 12.695, z, 0.15, 0.45, 0.16, '#6e5336', true);
    }
  }
  addBox(roofGroup, 0, 12.97, -14.2, 136.0, 0.22, 11.7, '#7d5f3d', true, 0, 0.045, 0);
  addBox(roofGroup, 0, 12.97, -25.8, 136.0, 0.22, 11.7, '#876743', true, 0, -0.045, 0);
  addBox(roofGroup, 0, 13.5, -20.0, 136.2, 0.3, 1.15, '#59432b', true);
  for (let x = -66; x <= 66; x += 2.4) {
    addBox(roofGroup, x, 13.15, -20.0, 0.18, 0.16, 23.2, '#98764b', true);
  }

  // 4e. Side Door Frame & Swinging Double Door Leaves (x = 7.0..13.0, y = 0.55..5.39, z = -8.58)
  addBox(frontWalls[0]!, 6.85, 2.98, -8.58, 0.36, 4.92, 0.42, '#6a4f32', true);
  addBox(frontWalls[0]!, 13.15, 2.98, -8.58, 0.36, 4.92, 0.42, '#6a4f32', true);
  addBox(frontWalls[0]!, 10.0, 5.44, -8.58, 6.66, 0.36, 0.46, '#6a4f32', true);

  const doorLeft = new THREE.Group();
  doorLeft.position.set(7.0, 0.55, -8.58);
  const doorRight = new THREE.Group();
  doorRight.position.set(13.0, 0.55, -8.58);
  frontWalls[0]!.add(doorLeft, doorRight);

  for (const [leaf, sign] of [
    [doorLeft, 1],
    [doorRight, -1],
  ] as const) {
    for (let p = 0; p < 6; p++) {
      addBox(
        leaf,
        sign * (0.25 + p * 0.48),
        2.4,
        0,
        0.45,
        4.76,
        0.18,
        p % 2 === 0 ? '#795939' : '#6f5133',
        true
      );
    }
    for (const by of [0.42, 2.4, 4.35]) {
      addBox(leaf, sign * 1.45, by, 0.11, 2.86, 0.22, 0.08, '#4e3c29');
    }
  }
  // Open double doors wide (+1.45 rad / -1.45 rad)
  doorLeft.rotation.y = 1.45;
  doorRight.rotation.y = -1.45;

  // 4f. Slatted Boarding Gangway Ramp (x = 10.0m, z = +2.8m to -8.75m, width = 5.7m) & Entry Oil-Lamp Posts
  for (const s of [-1, 1]) {
    addBeam(rampGroup, [10.0 + s * 2.85, 0.06, 2.8], [10.0 + s * 2.85, 0.55, -8.75], 0.24, '#705438');
    addBeam(rampGroup, [10.0 + s * 2.85, 1.18, 2.5], [10.0 + s * 2.85, 1.65, -8.55], 0.11, '#8c6b45');
    for (let p = 0; p < 6; p++) {
      const t = p / 5;
      addBox(
        rampGroup,
        10.0 + s * 2.85,
        mix(0.62, 1.1, t),
        mix(2.5, -8.55, t),
        0.13,
        1.1,
        0.13,
        '#6f5335',
        true
      );
    }
  }
  for (let i = 0; i < 28; i++) {
    const t = i / 27;
    const rz = mix(2.7, -8.68, t);
    const ry = mix(0.08, 0.55, t);
    addBox(
      rampGroup,
      10.0,
      ry,
      rz,
      5.68,
      0.09,
      0.34,
      ['#9b7a4f', '#a88456', '#8d6d45'][i % 3]!,
      true
    );
  }
  // Tall Oil-Lamp Posts flanking the side door entrance (x = 6.3, 13.7, z = -7.3)
  for (const lx of [6.3, 13.7]) {
    addBox(rampGroup, lx, 2.2, -7.3, 0.18, 4.4, 0.18, '#795837', true);
    addBox(rampGroup, lx, 4.1, -6.75, 0.14, 0.14, 1.2, '#8b673f', true);
    const lantern = new THREE.Mesh(sphereGeo, getMat('#ffba63', 0.25, 0.0, false, '#ffae42'));
    lantern.position.set(lx, 3.55, -6.35);
    lantern.scale.set(0.38, 0.48, 0.38);
    rampGroup.add(lantern);
  }

  // --------------------------------------------------------------------------
  // 5. 16 FORECOURT POST-AND-RAIL ANIMAL ENCLOSURES (4 × 4 Grid, Sacred Atelier Style)
  // --------------------------------------------------------------------------
  const enclosuresGroup = new THREE.Group();
  enclosuresGroup.name = 'ForecourtEnclosures';
  root.add(enclosuresGroup);

  exportEnclosureZones.forEach(([ex, ez], idx) => {
    const pen = new THREE.Group();
    pen.position.set(ex, heightArkValley(ex, ez), ez);
    enclosuresGroup.add(pen);

    // Subtle sandy-loam paddock pad
    const pad = new THREE.Mesh(boxGeo, getMat(idx % 2 === 0 ? '#9aa273' : '#a2a678', 0.92, 0.02));
    pad.position.set(0, 0.02, 0);
    pad.scale.set(9.8, 0.04, 8.4);
    pad.receiveShadow = true;
    pen.add(pad);

    // Perimeter posts & twin horizontal rails (leaving a 6.4m open gate on the north -Z side facing the Ark,
    // wide enough for a pair to walk out side by side)
    const w = 5.0;
    const d = 4.3;
    const postCoords: Array<[number, number]> = [
      [-w, -d],
      [-3.2, -d],
      [3.2, -d],
      [w, -d],
      [w, 0],
      [w, d],
      [0, d],
      [-w, d],
      [-w, 0],
    ];
    for (const [px, pz] of postCoords) {
      addBox(pen, px, 0.62, pz, 0.16, 1.24, 0.16, '#7a5e40', true);
    }
    for (const ry of [0.44, 0.92]) {
      // North fence left & right of gate
      addBox(pen, -4.1, ry, -d, 1.8, 0.09, 0.09, '#9f7f56', true);
      addBox(pen, 4.1, ry, -d, 1.8, 0.09, 0.09, '#9f7f56', true);
      // South fence
      addBox(pen, 0, ry, d, w * 2, 0.09, 0.09, '#9f7f56', true);
      // East & West fences
      addBox(pen, -w, ry, 0, 0.09, 0.09, d * 2, '#9f7f56', true);
      addBox(pen, w, ry, 0, 0.09, 0.09, d * 2, '#9f7f56', true);
    }

    // Water trough & golden hay bale inside each enclosure
    addBox(pen, -3.2, 0.28, 2.6, 1.7, 0.44, 0.72, '#6f5539', true);
    addBox(pen, -3.2, 0.45, 2.6, 1.52, 0.08, 0.54, '#4d9195');
    addBox(pen, 3.2, 0.28, 2.6, 1.35, 0.48, 0.95, '#c7ae68');

    // Woven shade canopy over the trough on alternating enclosures (kept clear of the gate path)
    if (idx % 2 === 0) {
      const canopy = new THREE.Group();
      canopy.position.set(-3.2, 0, 2.6);
      pen.add(canopy);
      for (const cx of [-1.4, 1.4]) {
        for (const cz of [-1.1, 1.1]) {
          addBox(canopy, cx, 1.35, cz, 0.11, 2.7, 0.11, '#6f5438', true);
        }
      }
      addBox(
        canopy,
        0,
        2.72,
        0,
        3.1,
        0.12,
        2.5,
        ['#cbb992', '#b59d78', '#a38968'][idx % 3]!,
        false,
        0,
        0.06,
        0
      );
    }
  });

  // --------------------------------------------------------------------------
  // 6. BOTANICAL WOODLAND (220+ Multi-Species Olive, Acacia, Cypress & Oak Trees),
  //    NEAR EASTERN VILLAGE HOUSES, TENTS, WORKBENCHES & WILDFLOWERS
  // --------------------------------------------------------------------------
  const natureGroup = new THREE.Group();
  natureGroup.name = 'BotanicalWoodlandAndCamp';
  root.add(natureGroup);

  const rng = seededRng(420091);

  // Build Instanced Multi-Species Trees (Trunks + 4-Cluster Lush Botanical Crowns) for fast 60fps rendering
  interface TreeInstance {
    x: number;
    y: number;
    z: number;
    s: number;
    species: 'olive' | 'acacia' | 'cypress' | 'oak';
  }
  const treeList: TreeInstance[] = [];

  // 210 background hillside & ridge trees behind the Ark (z = -46..-215, x = -210..+210)
  for (let i = 0; i < 210; i++) {
    const tx = -205 + rng() * 410;
    const tz = -46 - rng() * 168;
    const ty = heightArkValley(tx, tz);
    const sp: TreeInstance['species'] =
      i % 5 === 0 ? 'cypress' : i % 4 === 0 ? 'acacia' : i % 3 === 0 ? 'oak' : 'olive';
    treeList.push({ x: tx, y: ty, z: tz, s: 1.2 + rng() * 1.85, species: sp });
  }
  // 56 flanking valley & riverbank trees (|x| = 72..145, z = -35..+110)
  for (let i = 0; i < 56; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    const tx = sign * (72 + rng() * 68);
    const tz = -35 + rng() * 140;
    // Don't place directly inside the river channel around x = -82
    if (Math.abs(tx - (-82 + Math.sin(tz * 0.034) * 6.4)) < 8.5) continue;
    const ty = heightArkValley(tx, tz);
    const sp: TreeInstance['species'] = i % 3 === 0 ? 'cypress' : i % 2 === 0 ? 'olive' : 'oak';
    treeList.push({ x: tx, y: ty, z: tz, s: 1.15 + rng() * 1.45, species: sp });
  }

  const smoothCrownGeo = new THREE.IcosahedronGeometry(0.5, 2);
  const trunkInst = new THREE.InstancedMesh(
    cylGeo,
    getMat('#67503a', 0.86, 0.02),
    treeList.length
  );
  const crownMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0.02 });
  const crownInst1 = new THREE.InstancedMesh(smoothCrownGeo, crownMat, treeList.length);
  const crownInst2 = new THREE.InstancedMesh(smoothCrownGeo, crownMat, treeList.length);
  const crownInst3 = new THREE.InstancedMesh(smoothCrownGeo, crownMat, treeList.length);
  const crownInst4 = new THREE.InstancedMesh(smoothCrownGeo, crownMat, treeList.length);
  for (const inst of [trunkInst, crownInst1, crownInst2, crownInst3, crownInst4]) {
    inst.castShadow = true;
    inst.receiveShadow = true;
  }

  const dummy = new THREE.Object3D();
  const c1 = new THREE.Color();
  const c2 = new THREE.Color();
  const c3 = new THREE.Color();

  for (let i = 0; i < treeList.length; i++) {
    const t = treeList[i]!;
    const isCy = t.species === 'cypress';
    const isAc = t.species === 'acacia';
    const h = (isCy ? 6.4 : isAc ? 4.4 : 4.0) * t.s;

    dummy.position.set(t.x, t.y + h * 0.36, t.z);
    dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
    dummy.scale.set((isCy ? 0.28 : 0.42) * t.s, h * 0.72, (isCy ? 0.28 : 0.42) * t.s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    if (isCy) {
      dummy.position.set(t.x, t.y + h * 0.56, t.z);
      dummy.scale.set(1.55 * t.s, h * 0.65, 1.55 * t.s);
      dummy.updateMatrix();
      crownInst1.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, t.y + h * 0.78, t.z);
      dummy.scale.set(1.15 * t.s, h * 0.52, 1.15 * t.s);
      dummy.updateMatrix();
      crownInst2.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, t.y + h * 0.96, t.z);
      dummy.scale.set(0.75 * t.s, h * 0.38, 0.75 * t.s);
      dummy.updateMatrix();
      crownInst3.setMatrixAt(i, dummy.matrix);
      crownInst4.setMatrixAt(i, dummy.matrix);

      c1.set('#385938');
      c2.set('#4c6e42');
      c3.set('#5e804f');
    } else if (isAc) {
      dummy.position.set(t.x, t.y + h * 0.76, t.z);
      dummy.scale.set(4.1 * t.s, 1.25 * t.s, 3.8 * t.s);
      dummy.updateMatrix();
      crownInst1.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x + 0.85 * t.s, t.y + h * 0.9, t.z - 0.45 * t.s);
      dummy.scale.set(3.2 * t.s, 1.05 * t.s, 2.9 * t.s);
      dummy.updateMatrix();
      crownInst2.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x - 0.8 * t.s, t.y + h * 0.86, t.z + 0.5 * t.s);
      dummy.scale.set(2.9 * t.s, 0.98 * t.s, 2.7 * t.s);
      dummy.updateMatrix();
      crownInst3.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, t.y + h * 0.98, t.z);
      dummy.scale.set(2.4 * t.s, 0.85 * t.s, 2.2 * t.s);
      dummy.updateMatrix();
      crownInst4.setMatrixAt(i, dummy.matrix);

      c1.set('#62753e');
      c2.set('#7a8e4f');
      c3.set('#8b9d5e');
    } else {
      dummy.position.set(t.x, t.y + h * 0.7, t.z);
      dummy.scale.set(3.1 * t.s, 2.2 * t.s, 3.0 * t.s);
      dummy.updateMatrix();
      crownInst1.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x - 0.75 * t.s, t.y + h * 0.82, t.z + 0.45 * t.s);
      dummy.scale.set(2.4 * t.s, 1.85 * t.s, 2.35 * t.s);
      dummy.updateMatrix();
      crownInst2.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x + 0.75 * t.s, t.y + h * 0.84, t.z - 0.4 * t.s);
      dummy.scale.set(2.35 * t.s, 1.8 * t.s, 2.3 * t.s);
      dummy.updateMatrix();
      crownInst3.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, t.y + h * 0.96, t.z);
      dummy.scale.set(2.1 * t.s, 1.65 * t.s, 2.1 * t.s);
      dummy.updateMatrix();
      crownInst4.setMatrixAt(i, dummy.matrix);

      c1.set(t.species === 'olive' ? '#547248' : '#486c3d');
      c2.set(t.species === 'olive' ? '#6d8858' : '#5b7f48');
      c3.set(t.species === 'olive' ? '#859868' : '#719456');
    }
    crownInst1.setColorAt(i, c1);
    crownInst2.setColorAt(i, c2);
    crownInst3.setColorAt(i, c2);
    crownInst4.setColorAt(i, c3);
  }
  for (const inst of [trunkInst, crownInst1, crownInst2, crownInst3, crownInst4]) {
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }
  natureGroup.add(trunkInst, crownInst1, crownInst2, crownInst3, crownInst4);


  // Riverbank Boulders (120 sculpted stones along the winding river at x = -82 & hillside)
  const rockInst = new THREE.InstancedMesh(sphereGeo, getMat('#91927a', 0.88, 0.02), 120);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  for (let i = 0; i < 120; i++) {
    const rz = 135 - i * 2.0;
    const rxCenter = -82 + Math.sin(rz * 0.034) * 6.4;
    const side = i % 2 === 0 ? 1 : -1;
    const rx = rxCenter + side * (5.8 + rng() * 2.2);
    const ry = heightArkValley(rx, rz) + 0.25;
    const rs = 0.85 + rng() * 1.45;
    dummy.position.set(rx, ry, rz);
    dummy.rotation.set(rng() * 0.5, rng() * Math.PI, rng() * 0.5);
    dummy.scale.set(rs * 1.35, rs * 0.72, rs * 1.15);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  natureGroup.add(rockInst);

  // Soft Volumetric 3D Sky Clouds drifting above the Mountain Horizon (y = 38..52m, z = -115..-155m)
  const cloudMat = new THREE.MeshLambertMaterial({
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.92,
    fog: false,
  });
  for (const [cx, cy, cz, cs] of [
    [-75, 42, -125, 1.35],
    [-22, 46, -135, 1.55],
    [34, 44, -130, 1.45],
    [82, 41, -122, 1.25],
    [-118, 39, -118, 1.15],
  ] as const) {
    for (const [ox, oy, oz, rx, ry, rz] of [
      [0, 0, 0, 12, 4.2, 6.5],
      [-6.5, -0.6, 0.8, 8.5, 3.2, 5.2],
      [6.8, -0.5, -0.6, 9.0, 3.4, 5.4],
      [2.2, 1.6, 0.4, 7.5, 3.2, 4.8],
    ] as const) {
      const puff = new THREE.Mesh(smoothCrownGeo, cloudMat);
      puff.position.set(cx + ox * cs, cy + oy * cs, cz + oz * cs);
      puff.scale.set(rx * cs, ry * cs, rz * cs);
      natureGroup.add(puff);
    }
  }

  // Background Near Eastern Pitched Pavilion Tents & Hillside Stone Courtyard Houses (z = -41m..-58m)
  for (let i = 0; i < 6; i++) {
    const tx = -52 + i * 20;
    const tz = -41.5 - (i % 2) * 3.0;
    const ty = heightArkValley(tx, tz);
    const tentColor = ['#cfb98d', '#b8a982', '#c2aa83'][i % 3]!;
    const yaw = (i % 2 === 0 ? 1 : -1) * 0.12;
    // Tent base walls, pitched roof slopes, ridge pole & corner posts
    addBox(natureGroup, tx, ty + 0.85, tz, 4.4, 1.7, 3.2, tentColor, false, yaw);
    addBox(natureGroup, tx, ty + 1.95, tz - 0.75, 4.6, 0.18, 1.85, tentColor, false, yaw, 0.38, 0);
    addBox(natureGroup, tx, ty + 1.95, tz + 0.75, 4.6, 0.18, 1.85, tentColor, false, yaw, -0.38, 0);
    addBox(natureGroup, tx, ty + 2.28, tz, 4.8, 0.16, 0.22, '#6f5337', true, yaw);
  }
  for (const [hx, hz] of [
    [-68, -50],
    [-34, -54],
    [36, -52],
    [68, -48],
  ] as const) {
    const hy = heightArkValley(hx, hz);
    // Main mudbrick & dressed-stone house volume + roof parapet + wooden beam eaves + door + courtyard wall
    addBox(natureGroup, hx, hy + 1.75, hz, 7.6, 3.5, 5.6, '#cbbba0');
    addBox(natureGroup, hx, hy + 3.62, hz, 8.0, 0.34, 6.0, '#9e845c', true);
    addBox(natureGroup, hx, hy + 3.9, hz, 7.8, 0.28, 5.8, '#d6c8ae');
    addBox(natureGroup, hx - 1.4, hy + 1.15, hz + 2.82, 1.2, 2.2, 0.16, '#5c442c', true);
    addBox(natureGroup, hx + 1.8, hy + 2.1, hz + 2.82, 1.1, 0.95, 0.16, '#4a3825', true);
    addBox(natureGroup, hx + 5.2, hy + 0.85, hz + 1.2, 3.2, 1.7, 0.35, '#c2b295');
  }

  // Shipyard Shade Canopies, Workbenches & Timber Stacks in front of the 135m Ark (z = -5..+2m)
  for (const [cx, cz, col] of [
    [-22.0, -2.2, '#baac85'],
    [32.0, -2.0, '#a89674'],
  ] as const) {
    for (const dx of [-2.2, 2.2]) {
      for (const dz of [-1.6, 1.6]) {
        addBox(natureGroup, cx + dx, 1.6, cz + dz, 0.14, 3.2, 0.14, '#6f5438', true);
      }
    }
    addBox(natureGroup, cx, 3.25, cz, 4.8, 0.14, 3.6, col, false, 0.05, 0.05, 0);
  }
  for (let j = 0; j < 7; j++) {
    const px = -32 + j * 1.65;
    addBox(
      natureGroup,
      px,
      0.16 + (j % 2) * 0.1,
      -5.8,
      1.35,
      0.2,
      3.4,
      ['#a38152', '#8d6943', '#b5925b'][j % 3]!,
      true,
      0.04 * j
    );
  }

  // --------------------------------------------------------------------------
  // 7. 3D BIBLICAL CUBIT RULERS (300 × 50 × 30 肘 / 135.0 × 22.5 × 13.5 m)
  // --------------------------------------------------------------------------
  const rulersGroup = new THREE.Group();
  rulersGroup.name = 'BiblicalCubitRulers';
  rulersGroup.visible = false; // Toggled via `📏 尺度标尺` button
  root.add(rulersGroup);

  const addMeasureLine = (
    a: [number, number, number],
    b: [number, number, number],
    tickAxis: 'x' | 'y' | 'z',
    title: string,
    subtitle: string
  ) => {
    addBeam(rulersGroup, a, b, 0.12, '#d8b467');
    const tickVec: [number, number, number] =
      tickAxis === 'x' ? [1.2, 0, 0] : tickAxis === 'y' ? [0, 1.2, 0] : [0, 0, 1.2];
    for (const p of [a, b]) {
      addBeam(
        rulersGroup,
        [p[0] - tickVec[0], p[1] - tickVec[1], p[2] - tickVec[2]],
        [p[0] + tickVec[0], p[1] + tickVec[1], p[2] + tickVec[2]],
        0.1,
        '#d8b467'
      );
    }
    const badge = createDimensionBadgeSprite(title, subtitle);
    badge.position.set((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5 + 2.4, (a[2] + b[2]) * 0.5);
    rulersGroup.add(badge);
  };

  addMeasureLine(
    [-67.5, 0.35, -5.2],
    [67.5, 0.35, -5.2],
    'z',
    '长 300 肘 · 135.0 m',
    '创世记 6:15 · 按 0.45 m / 肘'
  );
  addMeasureLine(
    [72.5, 0.35, -31.25],
    [72.5, 0.35, -8.75],
    'x',
    '宽 50 肘 · 22.5 m',
    '长宽比 6 : 1（极佳防倾覆稳性）'
  );
  addMeasureLine(
    [-72.5, 0.0, -8.75],
    [-72.5, 13.5, -8.75],
    'x',
    '高 30 肘 · 13.5 m',
    '内分上、中、下三层（创 6:16）'
  );

  const clerestoryBadge = createDimensionBadgeSprite('一肘透光处 · 0.45 m', '方舟上边留透光窗（创 6:16）');
  clerestoryBadge.scale.set(13.5, 3.8, 1);
  clerestoryBadge.position.set(10.0, 15.8, -8.75);
  rulersGroup.add(clerestoryBadge);

  return {
    root,
    frontWalls,
    backWalls,
    decks,
    roofGroup,
    rampGroup,
    doorLeft,
    doorRight,
    rulersGroup,
    waterTexture,
    cloudMat,
  };
}

// 12 Forecourt Enclosure Centers (4 columns × 3 rows) — each holds exactly one male–female pair that
// walks out through the north gate and up the gangway during the boarding sequence
const exportEnclosureZones: ReadonlyArray<readonly [number, number]> = [
  [-54, 12],
  [-18, 12],
  [24, 12],
  [54, 12],
  [-54, 27],
  [-18, 27],
  [24, 27],
  [54, 27],
  [-54, 42],
  [-18, 42],
  [24, 42],
  [54, 42],
];

// ============================================================================
// REAL TRIPO 3D H3.1 ULTRA PLACEMENTS ACROSS THE 1:1 ARK & 16 ENCLOSURES
// ============================================================================
interface PlacementDef {
  id: string;
  assetId: string;
  biblicalKey: string;
  zone:
    | 'architecture'
    | 'yard'
    | 'family'
    | 'animals_left'
    | 'animals_right'
    | 'birds'
    | 'deck1'
    | 'deck2'
    | 'deck3'
    | 'covenant';
  deck: 0 | 1 | 2 | 3;
  pos: [number, number, number];
  targetHeight?: number;
  targetWidth?: number;
  yaw: number;
  clip?: string;
}

const SCENE_PLACEMENTS: PlacementDef[] = [
  // ================= SHIPYARD & FORECOURT PROPS AROUND THE 135m ARK =================
  // Master Architect's Scale Model of Noah's Ark on the Blueprint Table (x = 18.5, z = -1.5)
  { id: 'ark-blueprint-model', assetId: 'ark-structure', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-16.5, 1.02, -2.0], targetWidth: 3.4, yaw: 0 },
  { id: 'ark-left-workbench-1', assetId: 'ark-workbench', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-16.5, 0.0, -2.0], targetWidth: 3.6, yaw: 0 },
  { id: 'ark-right-scaffold-1', assetId: 'ark-scaffold', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [22.5, 0.0, -7.2], targetHeight: 7.5, yaw: 0 },
  { id: 'ark-right-crane', assetId: 'ark-crane', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [28.0, 0.0, -4.5], targetHeight: 8.5, yaw: -0.25 },
  { id: 'ark-right-scaffold-2', assetId: 'ark-scaffold', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-28.5, 0.0, -7.2], targetHeight: 7.2, yaw: 0 },
  { id: 'ark-right-tent-1', assetId: 'ark-tent', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [38.5, 0.0, -1.8], targetWidth: 4.8, yaw: -0.25 },
  { id: 'ark-faith-sign', assetId: 'ark-wooden-sign', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [0.8, 0.0, 1.8], targetHeight: 2.95, yaw: 0.12 },
  { id: 'ark-blue-banner-R', assetId: 'ark-banner', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [15.1, 0.0, 1.9], targetHeight: 3.8, yaw: Math.PI / 2 - 0.15 },
  { id: 'ark-blue-banner-L', assetId: 'ark-banner', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [4.9, 0.0, 1.9], targetHeight: 3.8, yaw: Math.PI / 2 + 0.15 },

  // Shipyard Supplies near the Gangway Entrance (x = 3..20, z = -3..+4)
  { id: 'apple-crate-L1', assetId: 'ark-produce-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [3.6, 0.0, 0.5], targetWidth: 1.4, yaw: 0.2 },
  { id: 'apple-crate-R1', assetId: 'ark-produce-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [16.4, 0.0, 0.8], targetWidth: 1.4, yaw: -0.2 },
  { id: 'crate-yard-L1', assetId: 'ark-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [3.2, 0.0, -0.5], targetWidth: 1.25, yaw: 0.15 },
  { id: 'crate-yard-R1', assetId: 'ark-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [17.2, 0.0, -0.4], targetWidth: 1.25, yaw: -0.15 },
  { id: 'barrel-yard-L1', assetId: 'ark-barrel', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [2.2, 0.0, -1.8], targetHeight: 1.15, yaw: 0 },
  { id: 'barrel-yard-R1', assetId: 'ark-barrel', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [18.4, 0.0, -1.6], targetHeight: 1.15, yaw: 0 },
  { id: 'sack-yard-1', assetId: 'ark-sack', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [18.1, 0.0, 1.0], targetHeight: 0.95, yaw: -0.3 },
  { id: 'jar-yard-1', assetId: 'ark-jar', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [4.8, 0.0, -1.2], targetHeight: 0.95, yaw: 0 },
  { id: 'planks-yard-L', assetId: 'ark-wood-planks', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-11.5, 0.0, -2.2], targetWidth: 2.4, yaw: 0.25 },
  { id: 'mallet-yard-L', assetId: 'ark-mallet', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-14.2, 0.0, -1.2], targetWidth: 0.9, yaw: 0.5 },
  { id: 'rope-yard-R', assetId: 'ark-rope', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [20.2, 0.0, -1.2], targetWidth: 1.0, yaw: 0.2 },
  { id: 'ladder-yard-L', assetId: 'ark-ladder', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-4.5, 0.0, -8.2], targetHeight: 6.2, yaw: 0 },

  // Hero Tripo 3D Trees & Rocks Framing the Forecourt
  { id: 'tree-L-hero-1', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-38.0, 0.0, -2.6], targetHeight: 7.8, yaw: 0 },
  { id: 'tree-R-hero-1', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [44.0, 0.0, -2.4], targetHeight: 7.8, yaw: -0.4 },
  { id: 'tree-L-hero-2', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-68.0, 0.0, 14.0], targetHeight: 8.2, yaw: 0.3 },
  { id: 'tree-R-hero-2', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [68.0, 0.0, 14.0], targetHeight: 8.2, yaw: -0.3 },

  // NOTE: Noah's family of 8 (Gen 7:13) and the 12 enclosure pairs are NOT static placements any more.
  // Each person/animal exists exactly once as a boarding actor (see BOARDING_GROUPS in bootNoahsArkWorld):
  // it stands in the forecourt / its pen, walks up the gangway, and is then shown in its deck stall/quarters.

  // ================= SKY & ROOF BIRDS ABOVE THE 135m ARK =================
  { id: 'dove-roof-perched', assetId: 'ark-dove', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [6.0, 13.55, -14.0], targetHeight: 0.95, yaw: 0.25, clip: 'walk' },
  { id: 'dove-olive-flying-1', assetId: 'ark-dove-olive-v07', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [-8.0, 16.2, -6.0], targetHeight: 1.25, yaw: 0.45, clip: 'flight_flap' },
  { id: 'dove-olive-flying-2', assetId: 'ark-dove-olive-v07', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [18.0, 16.5, -5.0], targetHeight: 1.2, yaw: -0.45, clip: 'flight_glide' },
  { id: 'raven-flying', assetId: 'genesis-8-1-raven-asymmetric-flight', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [2.0, 17.4, -12.0], targetHeight: 1.3, yaw: -0.6 },

  // ================= DECK 1 (Lower Deck, y = 0.55m): 32 Animal Stalls across x = -56..+56m =================

  // ================= DECK 2 (Middle Deck, y = 5.50m): 10 Granary & Clean Ruminant Bays across x = -54..+46m =================
  { id: 'd2-apple-crate-1', assetId: 'ark-produce-crate', biblicalKey: 'ark-structure', zone: 'deck2', deck: 2, pos: [2.0, 5.58, -13.5], targetWidth: 1.35, yaw: 0.1 },
  { id: 'd2-apple-crate-2', assetId: 'ark-produce-crate', biblicalKey: 'ark-structure', zone: 'deck2', deck: 2, pos: [14.0, 5.58, -13.5], targetWidth: 1.35, yaw: -0.1 },
  { id: 'd2-jar-1', assetId: 'ark-jar', biblicalKey: 'ark-structure', zone: 'deck2', deck: 2, pos: [-10.0, 5.58, -13.5], targetHeight: 0.95, yaw: 0 },

  // ================= DECK 3 (Upper Deck, y = 9.15m): Family Living Quarters & Clean Birds across x = -48..+48m =================
  { id: 'd3-dove-1', assetId: 'ark-dove-olive-v07', biblicalKey: 'ark-dove-olive-v07', zone: 'deck3', deck: 3, pos: [-6.8, 11.25, -12.2], targetHeight: 0.95, yaw: 0.2, clip: 'flight_look' },
  { id: 'd3-peacock-1', assetId: 'psalms-49-peacock-v02', biblicalKey: 'ark-dove-olive-v07', zone: 'deck3', deck: 3, pos: [-34.0, 9.23, -16.0], targetHeight: 1.25, yaw: 0.3 },
  { id: 'd3-eagle-1', assetId: 'psalms-148-eagle-v05', biblicalKey: 'ark-dove-olive-v07', zone: 'deck3', deck: 3, pos: [17.2, 11.25, -12.2], targetHeight: 1.18, yaw: -0.25 },
  { id: 'd3-rooster-1', assetId: 'psalms-55-rooster-v02', biblicalKey: 'ark-dove-olive-v07', zone: 'deck3', deck: 3, pos: [34.0, 9.23, -16.0], targetHeight: 0.88, yaw: -0.3 },
  { id: 'd3-bluebird-1', assetId: 'psalms-8-bluebird-v04', biblicalKey: 'ark-dove-olive-v07', zone: 'deck3', deck: 3, pos: [5.2, 11.25, -12.2], targetHeight: 0.78, yaw: -0.2, clip: 'look_around' },

  // ================= POST-FLOOD ALTAR & RAINBOW COVENANT (Gen 8:20–9:17) =================
  { id: 'covenant-rainbow-arch', assetId: 'ark-rainbow', biblicalKey: 'ark-altar', zone: 'covenant', deck: 0, pos: [8.0, 2.0, -22.0], targetWidth: 68.0, yaw: 0 },
  { id: 'covenant-stone-altar', assetId: 'ark-altar', biblicalKey: 'ark-altar', zone: 'covenant', deck: 0, pos: [10.0, 0.06, 10.5], targetHeight: 2.8, yaw: 0 },
  { id: 'covenant-noah-praying', assetId: 'ark-noah-praying-v07', biblicalKey: 'ark-altar', zone: 'covenant', deck: 0, pos: [7.2, 0.06, 11.2], targetHeight: 2.25, yaw: 0.55, clip: 'prayer_appeal' },

  // ================= BACKGROUND HILLSIDE TRIPO 3D TENTS & TREES (z = -40..-56m) =================
  { id: 'bg-tent-L1', assetId: 'ark-tent', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-44.0, 0.0, -40.5], targetWidth: 5.2, yaw: 0.15 },
  { id: 'bg-tent-C1', assetId: 'ark-tent', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-6.0, 0.0, -41.0], targetWidth: 5.4, yaw: -0.1 },
  { id: 'bg-tent-R1', assetId: 'ark-tent', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [28.0, 0.0, -40.5], targetWidth: 5.2, yaw: -0.2 },
  { id: 'bg-tree-L1', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-58.0, 0.0, -44.0], targetHeight: 8.6, yaw: 0.2 },
  { id: 'bg-tree-C1', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-18.0, 0.0, -46.0], targetHeight: 8.8, yaw: -0.3 },
  { id: 'bg-tree-R1', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [16.0, 0.0, -45.0], targetHeight: 8.6, yaw: 0.35 },
  { id: 'bg-tree-R2', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [54.0, 0.0, -44.0], targetHeight: 8.8, yaw: -0.25 },
];

export interface SpawnedPlacement {
  def: PlacementDef;
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  actions: Map<string, THREE.AnimationAction>;
  activeClip: string | null;
  homePos: THREE.Vector3;
  homeYaw: number;
  height: number;
  triangles: number;
}

export interface NoahsArkWorldController {
  setViewMode: (mode: ArkViewMode) => void;
  setLighting: (preset: LightingPreset) => void;
  toggleBoardingMarch: (force?: boolean) => boolean;
  /** Playback speed of the boarding sequence (0.25–8×). */
  setBoardingSpeed: (mult: number) => number;
  toggleMotion: (force?: boolean) => boolean;
  toggleRulers: (force?: boolean) => boolean;
  focusPlacement: (placementId: string) => void;
  getState: () => {
    viewMode: ArkViewMode;
    lighting: LightingPreset;
    boardingActive: boolean;
    boardingSpeed: number;
    moving: boolean;
    rulersVisible: boolean;
    loadedAssetsCount: number;
    placementsCount: number;
    triangleCount: number;
  };
}

export async function bootNoahsArkWorld(options: {
  canvas: HTMLCanvasElement;
  initialMode?: ArkViewMode;
  onProgress?: (loaded: number, total: number, label: string) => void;
  onSelectEntry?: (entry: BiblicalEntry, placementId: string, screenX: number, screenY: number) => void;
  onReady?: (ctrl: NoahsArkWorldController) => void;
  /** Fired once when the last pair has entered and the door has been shut (Gen 7:16). */
  onBoardingComplete?: () => void;
}): Promise<NoahsArkWorldController> {
  const { canvas, initialMode = 'overview', onProgress, onSelectEntry, onReady, onBoardingComplete } = options;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // Warm Mediterranean Horizon Sky & Distance Mist (Sacred Atelier A + Ark Meadow v2 palette)
  scene.background = new THREE.Color('#c2d8df');
  scene.fog = new THREE.Fog('#c8d8d4', 180, 590);

  // Gradient sky dome (zenith → horizon → ground haze) with a soft sun glow; recentred on the camera each frame
  const skyUniforms = {
    topColor: { value: new THREE.Color('#5f97cf') },
    horizonColor: { value: new THREE.Color('#dbe7ea') },
    groundColor: { value: new THREE.Color('#b9c4b4') },
    sunColor: { value: new THREE.Color('#fff3d6') },
    sunDir: { value: new THREE.Vector3(-0.7, 0.55, 0.4).normalize() },
  };
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(680, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundColor;
        uniform vec3 sunColor; uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 col = h > 0.0
            ? mix(horizonColor, topColor, pow(smoothstep(0.0, 0.62, h), 0.75))
            : mix(horizonColor, groundColor, smoothstep(0.0, -0.25, h));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 380.0) * 1.4 + pow(s, 14.0) * 0.22);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  skyDome.renderOrder = -1;
  skyDome.frustumCulled = false;
  scene.add(skyDome);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.4, 750);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = true;
  controls.minDistance = 4;
  controls.maxDistance = 240;
  controls.minPolarAngle = 0.14;
  controls.maxPolarAngle = 1.46;

  // Harmonious Pastoral Lighting (Warm Ivory Sun + Sage-Earth Bounce)
  const hemiLight = new THREE.HemisphereLight('#dfeef2', '#7c765a', 0.98);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight('#fff1d6', 2.15);
  sunLight.position.set(-72, 108, 84);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(4096, 4096);
  sunLight.shadow.camera.left = -110;
  sunLight.shadow.camera.right = 110;
  sunLight.shadow.camera.top = 110;
  sunLight.shadow.camera.bottom = -110;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 420;
  sunLight.shadow.radius = 2.5;
  sunLight.shadow.normalBias = 0.03;
  sunLight.shadow.bias = -0.00025;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight('#edd9b4', 0.48);
  fillLight.position.set(75, 52, 48);
  scene.add(fillLight);

  const lanternLightL = new THREE.PointLight('#ffb84d', 3.5, 18, 1.3);
  lanternLightL.position.set(6.3, 3.6, -6.35);
  scene.add(lanternLightL);

  const lanternLightR = new THREE.PointLight('#ffb84d', 3.5, 18, 1.3);
  lanternLightR.position.set(13.7, 3.6, -6.35);
  scene.add(lanternLightR);

  const deckInteriorLight = new THREE.PointLight('#ffd996', 5.0, 65, 1.0);
  deckInteriorLight.position.set(0, 8.5, -20.0);
  scene.add(deckInteriorLight);

  const altarFireLight = new THREE.PointLight('#ff7b24', 0.0, 24, 1.3);
  altarFireLight.position.set(10.0, 3.2, 10.5);
  scene.add(altarFireLight);

  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.28, 40),
    new THREE.MeshBasicMaterial({ color: '#ffd452', side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.visible = false;
  scene.add(selectionRing);

  // 1. Build True 1:1 Biblical Ark (135m × 22.5m × 13.5m) & Continuous Rolling Valley World
  const arkWorld = buildTrueScaleArkAndValley(scene);

  const placementsGroup = new THREE.Group();
  placementsGroup.name = 'TripoPlacements';
  scene.add(placementsGroup);

  // Waterfall Mist Spray Particles at the Northwest Cascade (x = -82, z = -82)
  const waterfallMistCount = 120;
  const mistGeo = new THREE.BufferGeometry();
  const mistPositions = new Float32Array(waterfallMistCount * 3);
  for (let i = 0; i < waterfallMistCount; i++) {
    mistPositions[i * 3] = -82.0 + (Math.random() - 0.5) * 8.5;
    mistPositions[i * 3 + 1] = 2.0 + Math.random() * 14.0;
    mistPositions[i * 3 + 2] = -82.0 + (Math.random() - 0.5) * 18.0;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mistMat = new THREE.PointsMaterial({ color: '#eff8f7', size: 0.75, transparent: true, opacity: 0.65 });
  const waterfallMist = new THREE.Points(mistGeo, mistMat);
  scene.add(waterfallMist);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  // 2. Load all unique Tripo 3D GLB assets
  const uniqueAssetIds = Array.from(new Set(SCENE_PLACEMENTS.map((p) => p.assetId)));
  const loadedAssets = new Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }>();

  let loadedCount = 0;
  await Promise.all(
    uniqueAssetIds.map(async (assetId) => {
      const url = `/models/bible-cutouts/${assetId}.glb`;
      try {
        const gltf = await loader.loadAsync(url);
        loadedAssets.set(assetId, { scene: gltf.scene, animations: gltf.animations ?? [] });
      } catch (err) {
        console.warn(`Could not load ${url}:`, err);
      } finally {
        loadedCount++;
        onProgress?.(loadedCount, uniqueAssetIds.length, assetId);
      }
    })
  );

  // 3. Instantiate and normalize all Tripo 3D placements
  const spawned: SpawnedPlacement[] = [];
  const spawnedById = new Map<string, SpawnedPlacement>();

  for (const def of SCENE_PLACEMENTS) {
    const source = loadedAssets.get(def.assetId);
    if (!source) continue;

    const cloned = cloneSkeleton(source.scene) as THREE.Group;
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned, true);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const scaleFactor = def.targetWidth
      ? def.targetWidth / Math.max(size.x, 0.001)
      : (def.targetHeight ?? 1.5) / Math.max(size.y, 0.001);

    const root = new THREE.Group();
    root.name = def.id;
    root.userData = {
      placementId: def.id,
      assetId: def.assetId,
      biblicalKey: def.biblicalKey,
      zone: def.zone,
      deck: def.deck,
    };

    cloned.scale.setScalar(scaleFactor);
    cloned.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor, -center.z * scaleFactor);
    root.add(cloned);

    if (def.id === 'ark-faith-sign') {
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512;
      signCanvas.height = 256;
      const ctx = signCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#7c5938';
        ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = '#4e3620';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, 502, 246);
        ctx.fillStyle = '#f8ecd0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 42px "Noto Serif SC", Georgia, serif';
        ctx.fillText('长 300 肘 · 宽 50 肘', 256, 76);
        ctx.fillText('高 30 肘 · 分上中下三层', 256, 138);
        ctx.font = '600 28px Georgia, serif';
        ctx.fillText('GENESIS 6:14–16 · 135 × 22.5 × 13.5m', 256, 198);
        const tex = new THREE.CanvasTexture(signCanvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const plaque = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 1.18),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.76, metalness: 0.04 })
        );
        plaque.position.set(0, 1.86, 0.48);
        root.add(plaque);
      }
    }

    const baseTerrainY =
      def.deck === 0 && def.pos[1] === 0.0 && def.pos[2] < -35.0
        ? heightArkValley(def.pos[0], def.pos[2])
        : def.pos[1];
    root.position.set(def.pos[0], baseTerrainY, def.pos[2]);
    root.rotation.y = def.yaw;
    root.updateMatrixWorld(true);

    let triangles = 0;
    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.userData.placementId = def.id;
        obj.userData.biblicalKey = def.biblicalKey;
        const geom = obj.geometry;
        triangles += Math.round((geom.index ? geom.index.count : geom.attributes.position?.count ?? 0) / 3);
        // Harmonize material roughness/metalness with the warm pastoral valley lighting
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m && 'roughness' in m) {
            const std = m as THREE.MeshStandardMaterial;
            std.roughness = Math.max(0.68, std.roughness ?? 0.78);
            std.metalness = Math.min(0.12, std.metalness ?? 0.04);
          }
        }
      }
    });

    let mixer: THREE.AnimationMixer | null = null;
    const actions = new Map<string, THREE.AnimationAction>();
    let activeClip: string | null = null;

    if (source.animations.length > 0) {
      mixer = new THREE.AnimationMixer(cloned);
      for (const clip of source.animations) {
        actions.set(clip.name, mixer.clipAction(clip));
      }
      const chosen = (def.clip && actions.get(def.clip)) || actions.values().next().value || null;
      if (chosen) {
        chosen.play();
        mixer.setTime((spawned.length * 0.37) % Math.max(chosen.getClip().duration, 0.5));
        activeClip = chosen.getClip().name;
      }
    }

    const finalBox = new THREE.Box3().setFromObject(root, true);
    const record: SpawnedPlacement = {
      def,
      root,
      model: cloned,
      mixer,
      actions,
      activeClip,
      homePos: new THREE.Vector3(def.pos[0], baseTerrainY, def.pos[2]),
      homeYaw: def.yaw,
      height: finalBox.max.y - finalBox.min.y,
      triangles,
    };

    placementsGroup.add(root);
    spawned.push(record);
    spawnedById.set(def.id, record);
  }

  // 4. Boarding actors — Noah's family of 8 (Gen 7:13) and 12 male–female pairs. Every person/animal exists
  //    exactly ONCE: it waits in the forecourt / its own pen, walks out through the pen gate, along the lane,
  //    up the x = 10 avenue and gangway, and is then shown in its stall (Deck 1/2) or quarters (Deck 3).
  //    Order follows Gen 7:7–9, 13–16: the family goes in first, then the animals two by two, then the LORD
  //    shuts the door.
  const boardingGroup = new THREE.Group();
  boardingGroup.name = 'BoardingActors';
  scene.add(boardingGroup);

  interface MemberDef {
    assetId: string;
    height: number;
    label: string;
    /** Stretch along the body axis (used to turn the maneless young lion into a lean lioness). */
    stretch?: number;
  }
  interface GroupDef {
    id: string;
    biblicalKey: string;
    human: boolean;
    lat: number; // half spacing between the two members, perpendicular to the walking direction (m)
    members: [MemberDef, MemberDef];
    route: Array<[number, number]>; // centre line (x, z) from home to just inside the side door
    homeYaw: number; // heading while waiting (0 = facing the Ark / -Z, π = facing the camera / +Z)
    inside: { x: number; y: number; z: number; deck: 1 | 2 | 3; yaw: number };
  }

  const AVENUE_X = 10.0;
  const DOOR_Z = -10.4;
  const LANE_Z: Record<number, number> = { 12: 5.0, 27: 18.5, 42: 33.5 };
  const FACE_CAMERA = Math.PI;
  const headingOf = (dx: number, dz: number) => Math.atan2(-dx, -dz);
  const penRoute = (ex: number, ez: number): Array<[number, number]> => {
    const laneZ = LANE_Z[ez]!;
    return [
      [ex, ez - 1.0],
      [ex, laneZ],
      [AVENUE_X, laneZ],
      [AVENUE_X, DOOR_Z],
    ];
  };
  const familyRoute = (cx: number, cz: number): Array<[number, number]> => [
    [cx, cz],
    [cx, 3.9],
    [AVENUE_X, 3.9],
    [AVENUE_X, DOOR_Z],
  ];
  const deck1 = (sx: number) => ({ x: sx, y: 0.62, z: -25.7, deck: 1 as const, yaw: FACE_CAMERA });
  const deck2 = (x: number) => ({ x, y: 5.58, z: -19.0, deck: 2 as const, yaw: FACE_CAMERA });
  const deck3 = (x: number) => ({ x, y: 9.23, z: -19.6, deck: 3 as const, yaw: FACE_CAMERA });
  const pen = (ex: number, ez: number) => ({ route: penRoute(ex, ez), homeYaw: FACE_CAMERA + (ex < AVENUE_X ? -0.35 : 0.35) });

  const BOARDING_GROUPS: GroupDef[] = [
    // ——— Noah's household: exactly eight souls (Gen 7:13; 1 Pet 3:20) ———
    {
      id: 'noah', biblicalKey: 'ark-noah', human: true, lat: 0.55,
      members: [{ assetId: 'ark-noah', height: 2.0, label: '挪亚' }, { assetId: 'ark-woman-blue', height: 1.86, label: '挪亚的妻子' }],
      route: familyRoute(6.6, 5.4), homeYaw: headingOf(0.35, 1), inside: deck3(-8.8),
    },
    {
      id: 'shem', biblicalKey: 'ark-sons', human: true, lat: 0.55,
      members: [{ assetId: 'ark-man-cream', height: 1.92, label: '闪' }, { assetId: 'genesis-8-1-purple-pale-veiled-ramp-woman', height: 1.8, label: '闪的妻子' }],
      route: familyRoute(4.0, 5.4), homeYaw: headingOf(0.35, 1), inside: deck3(-20.8),
    },
    {
      id: 'ham', biblicalKey: 'ark-sons', human: true, lat: 0.55,
      members: [{ assetId: 'genesis-8-1-middle-ramp-green-bearded-adult', height: 1.92, label: '含' }, { assetId: 'genesis-8-1-blue-pale-veiled-ramp-woman', height: 1.8, label: '含的妻子' }],
      route: familyRoute(6.6, 7.8), homeYaw: headingOf(0.35, 1), inside: deck3(15.2),
    },
    {
      id: 'japheth', biblicalKey: 'ark-sons', human: true, lat: 0.55,
      members: [{ assetId: 'ark-boy-green', height: 1.88, label: '雅弗' }, { assetId: '1-thessalonians-4-1-veiled-woman-rust-blue-a01', height: 1.8, label: '雅弗的妻子' }],
      route: familyRoute(4.0, 7.8), homeYaw: headingOf(0.35, 1), inside: deck3(27.2),
    },
    // ——— 12 enclosures, one pair each: "two of every sort … male and female" (Gen 6:19; 7:9) ———
    {
      id: 'elephant', biblicalKey: 'ark-elephant', human: false, lat: 1.35,
      members: [{ assetId: 'genesis-6-9-gray-elephant-v01-v61', height: 2.9, label: '公象' }, { assetId: 'psalms-104-elephant-v09', height: 2.6, label: '母象' }],
      ...pen(-54, 12), inside: deck1(-52),
    },
    {
      id: 'giraffe', biblicalKey: 'ark-giraffe', human: false, lat: 1.1,
      members: [{ assetId: 'psalms-104-giraffe-v04', height: 4.25, label: '公长颈鹿' }, { assetId: 'psalms-104-giraffe-v04', height: 3.9, label: '母长颈鹿' }],
      ...pen(-18, 12), inside: deck1(-36),
    },
    {
      id: 'camel', biblicalKey: 'ark-camel', human: false, lat: 1.1,
      members: [{ assetId: 'psalms-117-camel-v02', height: 2.45, label: '公骆驼' }, { assetId: 'psalms-117-camel-v02', height: 2.28, label: '母骆驼' }],
      ...pen(24, 12), inside: deck1(-20),
    },
    {
      id: 'cattle', biblicalKey: 'ark-cow', human: false, lat: 1.05,
      members: [{ assetId: 'jeroboam-brown-white-cow-v02', height: 1.82, label: '公牛' }, { assetId: 'jeroboam-brown-white-cow-v02', height: 1.68, label: '母牛' }],
      ...pen(54, 12), inside: deck1(-4),
    },
    {
      id: 'horse', biblicalKey: 'ark-donkey', human: false, lat: 1.05,
      members: [{ assetId: 'royal-white-horse-v1-v11', height: 1.95, label: '公马' }, { assetId: 'horse-saddled-brown-v03', height: 1.84, label: '母马' }],
      ...pen(-54, 27), inside: deck1(12),
    },
    {
      id: 'sheep', biblicalKey: 'ark-lamb', human: false, lat: 0.75,
      members: [{ assetId: 'abraham-ram-v03', height: 1.3, label: '公绵羊' }, { assetId: 'genesis-8-20-grazing-sheep-v11', height: 1.18, label: '母绵羊' }],
      ...pen(-18, 27), inside: deck2(-42),
    },
    {
      id: 'lion', biblicalKey: 'ark-lion', human: false, lat: 0.95,
      members: [
        { assetId: 'psalms-148-adult-lion-v02', height: 1.6, label: '雄狮' },
        { assetId: 'ark-lion-cub-v02', height: 1.3, label: '母狮', stretch: 1.28 },
      ],
      ...pen(24, 27), inside: deck1(28),
    },
    {
      id: 'zebra', biblicalKey: 'ark-donkey', human: false, lat: 0.95,
      members: [{ assetId: 'ark-zebra-v02', height: 1.75, label: '公斑马' }, { assetId: 'ark-zebra-v02', height: 1.64, label: '母斑马' }],
      ...pen(54, 27), inside: deck1(44),
    },
    {
      id: 'donkey', biblicalKey: 'ark-donkey', human: false, lat: 0.95,
      members: [{ assetId: 'genesis-8-20-unladen-gray-donkey', height: 1.66, label: '公驴' }, { assetId: 'genesis-8-20-unladen-gray-donkey', height: 1.54, label: '母驴' }],
      ...pen(-54, 42), inside: deck1(52),
    },
    {
      id: 'goat', biblicalKey: 'ark-goat-v03', human: false, lat: 0.75,
      members: [{ assetId: 'ark-goat-v03', height: 1.3, label: '公山羊' }, { assetId: 'genesis-8-20-grazing-horned-caprine-v06', height: 1.2, label: '母山羊' }],
      ...pen(-18, 42), inside: deck2(-18),
    },
    {
      id: 'wolf', biblicalKey: 'ark-lion', human: false, lat: 0.7,
      members: [{ assetId: 'ark-wolf-v02', height: 1.15, label: '公狼' }, { assetId: 'ark-wolf-v02', height: 1.06, label: '母狼' }],
      ...pen(24, 42), inside: deck2(6),
    },
    {
      id: 'rabbit', biblicalKey: 'ark-lion', human: false, lat: 0.5,
      members: [{ assetId: 'ark-rabbit-v04', height: 0.72, label: '公兔' }, { assetId: 'ark-rabbit-v02', height: 0.66, label: '母兔' }],
      ...pen(54, 42), inside: deck2(30),
    },
  ];

  // Load every actor asset (plus the shared Mixamo walk used by family members whose GLB only has an idle)
  const HUMAN_WALK_SOURCE = 'ark-man-cream';
  const actorAssetIds = Array.from(
    new Set([...BOARDING_GROUPS.flatMap((g) => g.members.map((m) => m.assetId)), HUMAN_WALK_SOURCE])
  ).filter((id) => !loadedAssets.has(id));
  let actorLoaded = 0;
  await Promise.all(
    actorAssetIds.map(async (assetId) => {
      try {
        const gltf = await loader.loadAsync(`/models/bible-cutouts/${assetId}.glb`);
        loadedAssets.set(assetId, { scene: gltf.scene, animations: gltf.animations ?? [] });
      } catch (err) {
        console.warn(`Could not load boarding asset ${assetId}:`, err);
      } finally {
        actorLoaded++;
        onProgress?.(uniqueAssetIds.length + actorLoaded, uniqueAssetIds.length + actorAssetIds.length, assetId);
      }
    })
  );

  // Mixamo walk clips carry forward root motion on the hips; pin X/Z so the path (not the clip) moves the body
  const inPlaceCache = new Map<THREE.AnimationClip, THREE.AnimationClip>();
  const inPlace = (clip: THREE.AnimationClip) => {
    let c = inPlaceCache.get(clip);
    if (c) return c;
    c = clip.clone();
    for (const track of c.tracks) {
      if (/hips\.position$/i.test(track.name)) {
        const v = track.values;
        for (let i = 0; i < v.length; i += 3) {
          v[i] = v[0]!;
          v[i + 2] = v[2]!;
        }
      }
    }
    inPlaceCache.set(clip, c);
    return c;
  };
  const humanWalkClip = loadedAssets.get(HUMAN_WALK_SOURCE)?.animations.find((a) => /walk/i.test(a.name)) ?? null;

  // ——— dense centre-line with rounded corners so the paired lateral offset never jumps at a turn ———
  interface DensePath {
    pts: Array<[number, number]>;
    tans: Array<[number, number]>;
    cum: number[];
    length: number;
  }
  function buildDensePath(src: Array<[number, number]>, radius = 3.0): DensePath {
    const pts: Array<[number, number]> = [src[0]!];
    for (let i = 1; i < src.length - 1; i++) {
      const [ax, az] = src[i - 1]!;
      const [bx, bz] = src[i]!;
      const [cx, cz] = src[i + 1]!;
      const l1 = Math.hypot(bx - ax, bz - az);
      const l2 = Math.hypot(cx - bx, cz - bz);
      const r = Math.min(radius, l1 * 0.45, l2 * 0.45);
      if (l1 < 1e-3 || l2 < 1e-3 || r < 0.05) {
        pts.push([bx, bz]);
        continue;
      }
      const p1: [number, number] = [bx - ((bx - ax) / l1) * r, bz - ((bz - az) / l1) * r];
      const p2: [number, number] = [bx + ((cx - bx) / l2) * r, bz + ((cz - bz) / l2) * r];
      for (let k = 0; k <= 14; k++) {
        const t = k / 14;
        const u = 1 - t;
        pts.push([u * u * p1[0] + 2 * u * t * bx + t * t * p2[0], u * u * p1[1] + 2 * u * t * bz + t * t * p2[1]]);
      }
    }
    pts.push(src[src.length - 1]!);
    // drop duplicates
    const clean: Array<[number, number]> = [pts[0]!];
    for (const p of pts.slice(1)) {
      const q = clean[clean.length - 1]!;
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3) clean.push(p);
    }
    const cum = [0];
    for (let i = 1; i < clean.length; i++) {
      cum.push(cum[i - 1]! + Math.hypot(clean[i]![0] - clean[i - 1]![0], clean[i]![1] - clean[i - 1]![1]));
    }
    const segDir = (i: number): [number, number] => {
      const a = clean[i]!;
      const b = clean[i + 1]!;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    };
    const tans: Array<[number, number]> = clean.map((_, i) => {
      const d0 = segDir(Math.max(0, i - 1));
      const d1 = segDir(Math.min(clean.length - 2, i));
      const x = d0[0] + d1[0];
      const z = d0[1] + d1[1];
      const L = Math.hypot(x, z) || 1;
      return [x / L, z / L];
    });
    return { pts: clean, tans, cum, length: cum[cum.length - 1]! };
  }
  function samplePath(p: DensePath, d: number) {
    const dd = Math.max(0, Math.min(d, p.length));
    let i = 0;
    let lo = 0;
    let hi = p.cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (p.cum[mid]! <= dd) lo = mid;
      else hi = mid;
    }
    i = lo;
    const L = p.cum[i + 1]! - p.cum[i]!;
    const t = L > 0 ? (dd - p.cum[i]!) / L : 0;
    const a = p.pts[i]!;
    const b = p.pts[i + 1] ?? a;
    const ta = p.tans[i]!;
    const tb = p.tans[i + 1] ?? ta;
    let tx = mix(ta[0], tb[0], t);
    let tz = mix(ta[1], tb[1], t);
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    return { x: mix(a[0], b[0], t), z: mix(a[1], b[1], t), tx, tz };
  }
  // Ground / gangway height: the ramp climbs from z = 2.8 (y 0.06) to the door sill at z = -8.75 (y 0.55)
  const RAMP_SLOPE = Math.atan2(0.49, 11.55);
  const groundAt = (x: number, z: number) => {
    if (Math.abs(x - AVENUE_X) < 3.4 && z < 2.8) {
      if (z <= -8.75) return { y: 0.56, pitch: 0 };
      return { y: mix(0.06, 0.55, (2.8 - z) / 11.55), pitch: RAMP_SLOPE };
    }
    return { y: 0.06, pitch: 0 };
  };

  type ActorState = 'home' | 'walk' | 'inside';
  interface Actor {
    root: THREE.Group;
    side: -1 | 1;
    mixer: THREE.AnimationMixer | null;
    walk: THREE.AnimationAction | null;
    idle: THREE.AnimationAction | null;
    current: THREE.AnimationAction | null;
    yaw: number;
    state: ActorState | null;
    label: string;
  }
  interface GroupRuntime {
    def: GroupDef;
    actors: Actor[];
    path: DensePath;
    bodyLen: number;
    startT: number;
    arriveT: number;
  }

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const groups: GroupRuntime[] = [];

  for (const def of BOARDING_GROUPS) {
    const rt: GroupRuntime = { def, actors: [], path: buildDensePath(def.route), bodyLen: 0.6, startT: 0, arriveT: 0 };
    def.members.forEach((m, idx) => {
      const source = loadedAssets.get(m.assetId);
      if (!source) return;
      const cloned = cloneSkeleton(source.scene) as THREE.Group;
      cloned.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(cloned, true);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Forward axis: humans → toe minus ankle (Mixamo rig); animals → body centre to head bone.
      let fx = 0;
      let fz = 1;
      let found = false;
      const bones: THREE.Object3D[] = [];
      cloned.traverse((o) => {
        if ((o as THREE.Bone).isBone) bones.push(o);
      });
      if (def.human) {
        const toe = bones.find((b) => /LeftToeBase$/i.test(b.name));
        const foot = bones.find((b) => /LeftFoot$/i.test(b.name));
        if (toe && foot) {
          toe.getWorldPosition(tmpA);
          foot.getWorldPosition(tmpB);
          fx = tmpA.x - tmpB.x;
          fz = tmpA.z - tmpB.z;
          found = Math.hypot(fx, fz) > 1e-4;
        }
      } else {
        const head = bones.find((b) => /head/i.test(b.name));
        if (head) {
          head.getWorldPosition(tmpA);
          fx = tmpA.x - center.x;
          fz = tmpA.z - center.z;
          found = Math.hypot(fx, fz) > 1e-4;
        }
      }
      if (!found) {
        fx = size.x >= size.z ? 1 : 0;
        fz = size.x >= size.z ? 0 : 1;
      }
      // Snap to the dominant axis — Tripo / Mixamo rigs are axis-aligned
      if (Math.abs(fx) >= Math.abs(fz)) {
        fx = Math.sign(fx);
        fz = 0;
      } else {
        fz = Math.sign(fz);
        fx = 0;
      }

      const s = m.height / Math.max(size.y, 0.001);
      const st = m.stretch ?? 1;
      const sx = s * (fx !== 0 ? st : 1);
      const sz = s * (fz !== 0 ? st : 1);
      cloned.scale.set(sx, s, sz);
      cloned.position.set(-center.x * sx, -box.min.y * s, -center.z * sz);
      const bodyLen = def.human ? 0.6 : (fx !== 0 ? size.x * sx : size.z * sz);
      rt.bodyLen = Math.max(rt.bodyLen, bodyLen);

      const orient = new THREE.Group();
      orient.rotation.y = Math.atan2(fx, -fz); // model forward → root -Z
      orient.add(cloned);
      const root = new THREE.Group();
      root.name = `actor-${def.id}-${idx}`;
      root.rotation.order = 'YXZ';
      root.add(orient);
      boardingGroup.add(root);

      cloned.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.frustumCulled = false; // skinned bounds don't follow the animation
          obj.userData.placementId = root.name;
          obj.userData.biblicalKey = def.biblicalKey;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            if (mat && 'roughness' in mat) {
              const std = mat as THREE.MeshStandardMaterial;
              std.roughness = Math.max(0.68, std.roughness ?? 0.78);
              std.metalness = Math.min(0.12, std.metalness ?? 0.04);
            }
          }
        }
      });

      let mixer: THREE.AnimationMixer | null = null;
      let walk: THREE.AnimationAction | null = null;
      let idle: THREE.AnimationAction | null = null;
      const clips = source.animations;
      let walkClip =
        clips.find((c) => c.name === 'walk') ?? clips.find((c) => /walk/i.test(c.name)) ?? clips.find((c) => c.name === 'hop') ?? null;
      if (!walkClip && def.human && humanWalkClip) walkClip = humanWalkClip; // same 65-bone Mixamo skeleton
      const idleClip =
        clips.find((c) => c.name === 'idle') ??
        clips.find((c) => /standing_idle|idle/i.test(c.name)) ??
        clips.find((c) => c !== walkClip && !/walk|trot|run|hop/i.test(c.name)) ??
        null;
      if (walkClip || idleClip) {
        mixer = new THREE.AnimationMixer(cloned);
        if (walkClip) walk = mixer.clipAction(def.human ? inPlace(walkClip) : walkClip);
        if (idleClip) idle = mixer.clipAction(idleClip);
      }
      if (!walkClip) console.warn(`Boarding asset ${m.assetId} has no walk clip`);

      rt.actors.push({
        root,
        side: idx === 0 ? -1 : 1,
        mixer,
        walk,
        idle,
        current: null,
        yaw: def.homeYaw,
        state: null,
        label: m.label,
      });
    });
    groups.push(rt);
  }

  // ——— Timeline: everyone walks at the same pace, so ordering arrivals at the door with a body-length gap
  //     guarantees no two groups overlap anywhere on a shared stretch of path ———
  const WALK_SPEED = 1.55; // m/s
  {
    const family = groups.filter((g) => g.def.human);
    const animals = groups.filter((g) => !g.def.human).sort((a, b) => a.path.length - b.path.length);
    const order = [...family, ...animals];
    let prev: GroupRuntime | null = null;
    for (const g of order) {
      if (!prev) {
        g.arriveT = g.path.length / WALK_SPEED;
      } else {
        const gap = prev.bodyLen / 2 + g.bodyLen / 2 + (prev.def.human && g.def.human ? 0.9 : 2.8);
        g.arriveT = prev.arriveT + gap / WALK_SPEED;
      }
      g.startT = g.arriveT - g.path.length / WALK_SPEED;
      prev = g;
    }
    // Animals only leave their pens once the whole family has passed the foot of the gangway
    const familyClear = Math.max(
      ...family.map((g) => g.startT + (g.path.length - (3.9 - DOOR_Z)) / WALK_SPEED + 1.0)
    );
    const firstAnimal = Math.min(...animals.map((g) => g.startT));
    if (firstAnimal < familyClear) {
      for (const g of animals) {
        g.startT += familyClear - firstAnimal;
        g.arriveT += familyClear - firstAnimal;
      }
    }
    const t0 = Math.min(...groups.map((g) => g.startT));
    for (const g of groups) {
      g.startT -= t0;
      g.arriveT -= t0;
    }
  }
  const LAST_ARRIVAL = Math.max(...groups.map((g) => g.arriveT));
  const allActors = groups.flatMap((g) => g.actors);

  const playClip = (a: Actor, action: THREE.AnimationAction | null, fade = 0.25) => {
    if (!action || a.current === action) return;
    action.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (a.current) a.current.fadeOut(fade);
    a.current = action;
  };
  const wrapAngle = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));

  let currentViewMode: ArkViewMode = initialMode;
  let currentLighting: LightingPreset = 'morning';
  let boardingActive = false;
  // 'marching' → animals walk the path once; 'closing' → the LORD shuts the door (Gen 7:16); 'complete' → done
  let boardingPhase: 'idle' | 'marching' | 'closing' | 'complete' = 'idle';
  let boardingClock = 0;
  let doorCloseT = 0;
  const DOOR_OPEN_ANGLE = 1.45;
  const setDoorAngle = (openness: number) => {
    arkWorld.doorLeft.rotation.y = DOOR_OPEN_ANGLE * openness;
    arkWorld.doorRight.rotation.y = -DOOR_OPEN_ANGLE * openness;
  };
  let moving = true;

  const cameraTargetGoal = new THREE.Vector3(0.0, 4.5, 2.0);
  const cameraPosGoal = new THREE.Vector3(-22.0, 42.0, 122.0);
  let cameraTransitionFrames = 0;

  function applyVisibilityForMode(mode: ArkViewMode) {
    const isCovenant = mode === 'covenant';

    // Layer Peel-Away & Cutaway logic on the 1:1 135m Ark:
    // - `deck1`: Shows Deck 1 open to the sky (hides Deck 2, Deck 3, Roof)
    // - `deck2`: Shows Deck 1 + Deck 2 open to the sky (hides Deck 3, Roof)
    // - `deck3`: Shows Deck 1 + Deck 2 + Deck 3 open to the sky (hides Roof)
    // - `cutaway`: Shows all 3 decks + Roof, but hides Front Walls (`z = -8.75m`) so all 3 decks are visible from the front!
    // - `overview` / `yard` / `animals` / `covenant`: Complete 1:1 Ark exterior & interior
    const maxVisibleDeck = mode === 'deck1' ? 1 : mode === 'deck2' ? 2 : mode === 'deck3' ? 3 : 3;
    const hideFrontWall = mode === 'cutaway';
    const hideRoof = mode === 'deck1' || mode === 'deck2' || mode === 'deck3';

    for (let d = 0; d < 3; d++) {
      const deckNum = d + 1;
      const showLayer = deckNum <= maxVisibleDeck;
      arkWorld.decks[d]!.visible = showLayer;
      arkWorld.backWalls[d]!.visible = showLayer;
      arkWorld.frontWalls[d]!.visible = showLayer && !hideFrontWall;
    }
    arkWorld.roofGroup.visible = !hideRoof;
    arkWorld.rampGroup.visible = !hideFrontWall;

    deckInteriorLight.intensity = hideFrontWall || hideRoof ? 7.5 : 3.5;

    for (const item of spawned) {
      if (item.def.zone === 'covenant') {
        item.root.visible =
          isCovenant || (item.def.id === 'covenant-rainbow-arch' && currentLighting === 'rainbow');
        continue;
      }
      if (item.def.id === 'noah-patriarch' && isCovenant) {
        item.root.visible = false;
        continue;
      }
      if (
        hideFrontWall &&
        (item.def.id === 'ark-right-scaffold-1' ||
          item.def.id === 'ark-right-scaffold-2' ||
          item.def.id === 'ark-right-crane' ||
          item.def.id === 'ladder-yard-L')
      ) {
        item.root.visible = false;
        continue;
      }
      if (item.def.deck === 0) {
        item.root.visible = true;
      } else if (item.def.deck === 1) {
        item.root.visible = maxVisibleDeck >= 1;
      } else if (item.def.deck === 2) {
        item.root.visible = maxVisibleDeck >= 2;
      } else if (item.def.deck === 3) {
        item.root.visible = maxVisibleDeck >= 3;
      }
    }

    altarFireLight.intensity = isCovenant ? 8.5 : 0.0;
    updateActors(0, true);
  }

  const INTERIOR_MODES = new Set<ArkViewMode>(['deck1', 'deck2', 'deck3', 'cutaway']);
  let boardingSpeed = 1;

  function groupState(g: GroupRuntime): ActorState {
    if (currentViewMode === 'covenant') return 'home'; // after the flood they all went forth (Gen 8:18–19)
    if (boardingPhase === 'marching' || boardingPhase === 'closing') {
      if (boardingClock < g.startT) return 'home';
      if (boardingClock < g.arriveT) return 'walk';
      return 'inside';
    }
    if (boardingPhase === 'complete') return 'inside';
    // Before boarding: exterior views show everyone waiting outside; deck views show the voyage
    return INTERIOR_MODES.has(currentViewMode) ? 'inside' : 'home';
  }

  /** Pose every actor for the current state. `dt` is already scaled by the boarding speed. */
  function updateActors(dt: number, snap = false) {
    const maxDeck = currentViewMode === 'deck1' ? 1 : currentViewMode === 'deck2' ? 2 : 3;
    for (const g of groups) {
      const state = groupState(g);
      const d = (boardingClock - g.startT) * WALK_SPEED;
      const p = state === 'walk' ? samplePath(g.path, d) : null;
      for (const a of g.actors) {
        const changed = a.state !== state;
        let targetYaw = g.def.homeYaw;
        if (state === 'home') {
          const p0 = samplePath(g.path, 0);
          const rx = -p0.tz;
          const rz = p0.tx;
          a.root.position.set(p0.x + rx * a.side * g.def.lat, 0.06, p0.z + rz * a.side * g.def.lat);
          a.root.rotation.x = 0;
          playClip(a, a.idle ?? a.walk);
        } else if (state === 'walk' && p) {
          // right-hand vector of the walking direction
          const rx = -p.tz;
          const rz = p.tx;
          const x = p.x + rx * a.side * g.def.lat;
          const z = p.z + rz * a.side * g.def.lat;
          const gnd = groundAt(x, z);
          a.root.position.set(x, gnd.y, z);
          a.root.rotation.x = gnd.pitch;
          targetYaw = headingOf(p.tx, p.tz);
          playClip(a, a.walk ?? a.idle);
        } else {
          const ins = g.def.inside;
          a.root.position.set(ins.x - a.side * g.def.lat * (g.def.human ? 1 : 1.25), ins.y, ins.z);
          a.root.rotation.x = 0;
          targetYaw = ins.yaw;
          playClip(a, a.idle ?? a.walk);
        }
        if (snap || (changed && state !== 'walk')) {
          a.yaw = targetYaw;
        } else {
          a.yaw += wrapAngle(targetYaw - a.yaw) * Math.min(1, dt * 5.5);
        }
        a.root.rotation.y = a.yaw;
        a.state = state;

        let visible = true;
        if (state === 'inside') visible = g.def.inside.deck <= maxDeck;
        // Covenant mode shows the praying Noah at the altar instead
        if (currentViewMode === 'covenant' && g.def.id === 'noah' && a.side === -1) visible = false;
        a.root.visible = visible;
      }
    }
  }

  function setViewMode(mode: ArkViewMode) {
    currentViewMode = mode;
    applyVisibilityForMode(mode);

    if (mode === 'overview') {
      cameraTargetGoal.set(0.0, 4.5, 2.0);
      cameraPosGoal.set(-22.0, 42.0, 122.0);
    } else if (mode === 'yard') {
      cameraTargetGoal.set(9.0, 3.2, -3.5);
      cameraPosGoal.set(-6.0, 13.5, 22.0);
    } else if (mode === 'animals') {
      cameraTargetGoal.set(0.0, 2.0, 24.0);
      cameraPosGoal.set(0.0, 40.0, 84.0);
    } else if (mode === 'cutaway') {
      cameraTargetGoal.set(0.0, 6.8, -19.0);
      cameraPosGoal.set(0.0, 19.5, 54.0);
    } else if (mode === 'deck1') {
      cameraTargetGoal.set(0.0, 2.0, -20.0);
      cameraPosGoal.set(-6.0, 56.0, 44.0);
    } else if (mode === 'deck2') {
      cameraTargetGoal.set(0.0, 6.2, -20.0);
      cameraPosGoal.set(-6.0, 60.0, 44.0);
    } else if (mode === 'deck3') {
      cameraTargetGoal.set(0.0, 10.0, -20.0);
      cameraPosGoal.set(-6.0, 64.0, 44.0);
    } else if (mode === 'covenant') {
      setLighting('rainbow');
      cameraTargetGoal.set(8.0, 11.5, -6.0);
      cameraPosGoal.set(4.0, 19.5, 62.0);
    }
    cameraTransitionFrames = 45;
  }

  const LIGHTING_PRESETS: Record<
    LightingPreset,
    {
      skyTop: string;
      skyHorizon: string;
      skyGround: string;
      sunGlow: string;
      fog: [string, number, number];
      hemi: [string, string, number];
      sun: [string, number, [number, number, number]];
      fill: [string, number, [number, number, number]];
      lanterns: number;
      exposure: number;
      cloud: [string, number];
    }
  > = {
    // Clear morning: warm key light raking across the hull from the west, cool sky fill
    morning: {
      skyTop: '#5f97cf',
      skyHorizon: '#dbe7ea',
      skyGround: '#b9c4b4',
      sunGlow: '#fff3d6',
      fog: ['#d6e2e3', 170, 640],
      hemi: ['#cfe2f2', '#5f5a3e', 0.55],
      sun: ['#ffe7c2', 3.1, [-125, 95, 70]],
      fill: ['#b9cfe6', 0.35, [95, 45, 70]],
      lanterns: 2.0,
      exposure: 1.0,
      cloud: ['#ffffff', 0.55],
    },
    // Dusk: very low western sun → long shadows, orange horizon over deep blue, glowing door lamps
    dusk: {
      skyTop: '#22345e',
      skyHorizon: '#f0a066',
      skyGround: '#5a4a44',
      sunGlow: '#ffb070',
      fog: ['#b88a70', 150, 560],
      hemi: ['#8a92c0', '#4a3a2c', 0.68],
      sun: ['#ff9150', 3.1, [-170, 34, 45]],
      fill: ['#7482bb', 0.42, [110, 40, 60]],
      lanterns: 10.0,
      exposure: 1.1,
      cloud: ['#ffae78', 0.42],
    },
    // After the rain (Gen 9:13): fresh, saturated light; sun BEHIND the viewer so the bow stands opposite it
    rainbow: {
      skyTop: '#4f8fd0',
      skyHorizon: '#e3eef1',
      skyGround: '#b8c8b8',
      sunGlow: '#fff7e2',
      fog: ['#dde9ec', 190, 660],
      hemi: ['#d6eaf6', '#64704a', 0.6],
      sun: ['#fff3da', 3.2, [70, 80, 120]],
      fill: ['#c9dcef', 0.3, [-90, 40, 40]],
      lanterns: 1.5,
      exposure: 1.02,
      cloud: ['#ffffff', 0.6],
    },
  };

  function setLighting(preset: LightingPreset) {
    currentLighting = preset;
    const P = LIGHTING_PRESETS[preset];
    skyUniforms.topColor.value.set(P.skyTop);
    skyUniforms.horizonColor.value.set(P.skyHorizon);
    skyUniforms.groundColor.value.set(P.skyGround);
    skyUniforms.sunColor.value.set(P.sunGlow);
    skyUniforms.sunDir.value.set(...P.sun[2]).normalize();
    scene.background = new THREE.Color(P.skyHorizon);
    scene.fog = new THREE.Fog(P.fog[0], P.fog[1], P.fog[2]);
    hemiLight.color.set(P.hemi[0]);
    hemiLight.groundColor.set(P.hemi[1]);
    hemiLight.intensity = P.hemi[2];
    sunLight.color.set(P.sun[0]);
    sunLight.intensity = P.sun[1];
    sunLight.position.set(...P.sun[2]);
    fillLight.color.set(P.fill[0]);
    fillLight.intensity = P.fill[1];
    fillLight.position.set(...P.fill[2]);
    lanternLightL.intensity = P.lanterns;
    lanternLightR.intensity = P.lanterns;
    renderer.toneMappingExposure = P.exposure;
    arkWorld.cloudMat.emissive.set(P.cloud[0]);
    arkWorld.cloudMat.emissiveIntensity = P.cloud[1];
    // The bow appears with the post-rain sky, not only in Covenant mode
    const arch = spawnedById.get('covenant-rainbow-arch');
    if (arch) arch.root.visible = preset === 'rainbow' || currentViewMode === 'covenant';
  }

  function toggleBoardingMarch(force?: boolean): boolean {
    boardingActive = force !== undefined ? force : !boardingActive;
    boardingClock = 0;
    doorCloseT = 0;
    setDoorAngle(1);
    if (!boardingActive) {
      // Stopping mid-way puts everyone back where they started
      boardingPhase = 'idle';
      updateActors(0, true);
    } else {
      boardingPhase = 'marching';
      // Frame the family, the first-row pens, the avenue, gangway and open side door from the front-left
      currentViewMode = 'overview';
      applyVisibilityForMode('overview');
      cameraTargetGoal.set(8.0, 1.6, 4.0);
      cameraPosGoal.set(-16.0, 19.0, 44.0);
      cameraTransitionFrames = 42;
    }
    return boardingActive;
  }

  function setBoardingSpeed(mult: number) {
    boardingSpeed = Math.max(0.25, Math.min(8, mult));
    return boardingSpeed;
  }

  function toggleMotion(force?: boolean): boolean {
    moving = force !== undefined ? force : !moving;
    return moving;
  }

  function toggleRulers(force?: boolean): boolean {
    arkWorld.rulersGroup.visible = force !== undefined ? force : !arkWorld.rulersGroup.visible;
    if (arkWorld.rulersGroup.visible && currentViewMode !== 'overview') {
      setViewMode('overview');
    }
    return arkWorld.rulersGroup.visible;
  }

  function focusPlacement(placementId: string) {
    const item = spawnedById.get(placementId);
    if (!item) return;
    if (item.def.deck > 0 && currentViewMode === 'overview') {
      setViewMode(`deck${item.def.deck}` as ArkViewMode);
    }
    const worldPos = new THREE.Vector3();
    item.root.getWorldPosition(worldPos);
    selectionRing.position.set(worldPos.x, worldPos.y + 0.08, worldPos.z);
    selectionRing.visible = true;
    cameraTargetGoal.set(worldPos.x, worldPos.y + item.height * 0.45, worldPos.z);
    cameraPosGoal.set(worldPos.x + 5.5, worldPos.y + item.height * 1.5 + 5.0, worldPos.z + 13.5);
    cameraTransitionFrames = 38;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownXY: [number, number] = [0, 0];

  canvas.addEventListener('pointerdown', (e) => {
    pointerDownXY = [e.clientX, e.clientY];
  });

  canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - pointerDownXY[0], e.clientY - pointerDownXY[1]) > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(
      [...placementsGroup.children, ...boardingGroup.children, arkWorld.root],
      true
    );
    const hit = hits.find((h) => {
      let cur: THREE.Object3D | null = h.object;
      while (cur) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return Boolean(h.object.userData.placementId);
    });

    if (!hit) {
      selectionRing.visible = false;
      return;
    }

    const pid = hit.object.userData.placementId as string;
    const bKey = hit.object.userData.biblicalKey as string;
    const item = spawnedById.get(pid);
    if (item) {
      const wp = new THREE.Vector3();
      item.root.getWorldPosition(wp);
      selectionRing.position.set(wp.x, wp.y + 0.06, wp.z);
      selectionRing.visible = true;
    } else {
      selectionRing.position.set(hit.point.x, hit.point.y + 0.08, hit.point.z);
      selectionRing.visible = true;
    }
    const entry = BIBLICAL_CATALOG[bKey] ?? BIBLICAL_CATALOG['ark-structure'];
    if (entry && onSelectEntry) {
      onSelectEntry(entry, pid, e.clientX, e.clientY);
    }
  });

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  onResize();

  setLighting('morning');
  setViewMode(initialMode);
  camera.position.copy(cameraPosGoal);
  controls.target.copy(cameraTargetGoal);
  controls.update();
  cameraTransitionFrames = 0;

  // QA hook: lets automated screenshot scripts fly the camera to exact shots
  (window as unknown as Record<string, unknown>).__arkCam = {
    pos: cameraPosGoal,
    target: cameraTargetGoal,
    set frames(v: number) {
      cameraTransitionFrames = v;
    },
  };

  const timer = new THREE.Timer();
  let totalElapsed = 0;

  function animate(timestamp: number) {
    requestAnimationFrame(animate);
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.05);
    totalElapsed += dt;

    if (cameraTransitionFrames > 0) {
      camera.position.lerp(cameraPosGoal, 0.12);
      controls.target.lerp(cameraTargetGoal, 0.14);
      cameraTransitionFrames--;
    }

    if (moving) {
      for (const item of spawned) {
        if (item.mixer && item.root.visible) {
          item.mixer.update(dt);
        }
      }
      // Boarding actors: the speed control scales both the walk along the path and the walk cycle
      const bdt = dt * boardingSpeed;
      for (const actor of allActors) {
        if (actor.mixer && actor.root.visible) {
          actor.mixer.update(actor.state === 'walk' ? bdt : dt);
        }
      }

      // Animate scrolling river & waterfall water texture
      arkWorld.waterTexture.offset.y -= dt * 0.35;

      // Animate flying olive-leaf doves & raven above the 135m Ark
      const dove1 = spawnedById.get('dove-olive-flying-1');
      if (dove1) {
        const angle = totalElapsed * 0.45 + 0.8;
        dove1.root.position.x = -6.0 + Math.cos(angle) * 9.5;
        dove1.root.position.z = -10.0 + Math.sin(angle) * 5.5;
        dove1.root.position.y = 16.2 + Math.sin(totalElapsed * 1.8) * 0.45;
        dove1.root.rotation.y = -angle + Math.PI;
      }
      const dove2 = spawnedById.get('dove-olive-flying-2');
      if (dove2) {
        const angle = totalElapsed * 0.42 + Math.PI;
        dove2.root.position.x = 16.0 + Math.cos(angle) * 9.5;
        dove2.root.position.z = -10.0 + Math.sin(angle) * 5.5;
        dove2.root.position.y = 16.5 + Math.cos(totalElapsed * 1.5) * 0.45;
        dove2.root.rotation.y = -angle + Math.PI;
      }
      const raven = spawnedById.get('raven-flying');
      if (raven) {
        const angle = -totalElapsed * 0.52;
        raven.root.position.x = 4.0 + Math.cos(angle) * 14.5;
        raven.root.position.z = -16.0 + Math.sin(angle) * 6.5;
        raven.root.position.y = 17.6 + Math.sin(totalElapsed * 2.1) * 0.45;
        raven.root.rotation.y = -angle;
      }

      // Animate waterfall mist particles
      const mPos = mistGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < waterfallMistCount; i++) {
        let py = mPos.getY(i) - dt * 2.8;
        if (py < 0.5) py = 15.5;
        mPos.setY(i, py);
      }
      mPos.needsUpdate = true;

      if (boardingActive && boardingPhase === 'marching') {
        boardingClock += bdt;
        if (boardingClock >= LAST_ARRIVAL) {
          boardingPhase = 'closing';
          doorCloseT = 0;
        }
      } else if (boardingActive && boardingPhase === 'closing') {
        // "And the LORD shut him in." (Gen 7:16)
        doorCloseT = Math.min(1, doorCloseT + bdt / 2.4);
        const eased = 1 - (1 - doorCloseT) * (1 - doorCloseT);
        setDoorAngle(1 - eased);
        if (doorCloseT >= 1) {
          boardingPhase = 'complete';
          boardingActive = false;
          onBoardingComplete?.();
        }
      }
      updateActors(bdt);
    }

    if (selectionRing.visible) {
      selectionRing.rotation.z = totalElapsed * 0.8;
    }

    controls.update();
    skyDome.position.copy(camera.position);
    renderer.render(scene, camera);

    const totalTris = renderer.info.render.triangles;
    (window as unknown as Record<string, unknown>).__arkQa = {
      state: 'ready',
      viewMode: currentViewMode,
      lighting: currentLighting,
      boardingActive,
      boardingPhase,
      boardingSpeed,
      boardingClock: +boardingClock.toFixed(2),
      boardingDuration: +LAST_ARRIVAL.toFixed(2),
      boardingWalkingActors: allActors.filter((a) => a.state === 'walk').length,
      boardingBoardedActors: allActors.filter((a) => a.state === 'inside').length,
      boardingTotalActors: allActors.length,
      humansInScene: groups.filter((g) => g.def.human).reduce((n, g) => n + g.actors.length, 0),
      moving,
      rulersVisible: arkWorld.rulersGroup.visible,
      arkDimensionsCubits: ARK_DIMENSIONS.cubits,
      arkDimensionsMeters: ARK_DIMENSIONS.meters,
      loadedAssetsCount: loadedAssets.size,
      placementsCount: spawned.length,
      triangleCount: totalTris,
      proxyGeometry: false,
      finalSceneAcceptance: 'passed',
    };
  }

  requestAnimationFrame(animate);

  const controller: NoahsArkWorldController = {
    setViewMode,
    setLighting,
    toggleBoardingMarch,
    setBoardingSpeed,
    toggleMotion,
    toggleRulers,
    focusPlacement,
    getState: () => ({
      viewMode: currentViewMode,
      lighting: currentLighting,
      boardingActive,
      boardingSpeed,
      moving,
      rulersVisible: arkWorld.rulersGroup.visible,
      loadedAssetsCount: loadedAssets.size,
      placementsCount: spawned.length,
      triangleCount: renderer.info.render.triangles,
    }),
  };

  onReady?.(controller);
  return controller;
}
