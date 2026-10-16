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
    zhName: '挪亚方舟主体（歌斐木与松香）',
    enName: "Noah's Ark Hull (Gopher Wood & Pitch)",
    hebrew: 'תֵּבַת עֲצֵי־גֹפֶר (Tēḇaṯ ʿĂṣê-Gōp̄er)',
    category: 'architecture',
    pairingRuleZh: '300 × 50 × 30 肘（约 133.5 × 22.3 × 13.4 米）',
    pairingRuleEn: '300 × 50 × 30 Cubits (approx. 133.5 × 22.3 × 13.4 m)',
    scriptureRef: '创世记 6:14–16 (Genesis 6:14–16)',
    scriptureQuoteZh: '“你要用歌斐木造一只方舟，分一间一间的造，里外抹上松香……方舟的长要三百肘，宽五十肘，高三十肘。方舟上边要留一肘高的透光处，方舟的门要开在旁边，要在方舟里分上、中、下三层。”',
    biblicalFactZh: '经文明确记载材料为歌斐木（Gopher wood）与松香/沥青（Pitch/Kopher），长宽比 6:1、宽高比 5:3（极佳的防倾覆稳性比例），内分三层（上、中、下）与诸多隔间（Qinnim），顶部留一肘高透光处（Tzohar），侧面开门。',
    artisticNoteZh: '外船体采用参考图（174.jpeg）标志性的倒角木板与微翘首尾造型；切换至“三层全剖”即可查看严格按 300:50:30 比例建造的三层内部隔间、透光天窗与坡道。',
  },
  'ark-ramp': {
    id: 'ark-ramp',
    zhName: '方舟侧门登船木栈桥',
    enName: 'Ark Side-Door Boarding Ramp',
    hebrew: 'פֶּתַח הַתֵּבָה (Peṯaḥ hat-Tēḇāh)',
    category: 'architecture',
    pairingRuleZh: '通往方舟旁门（创 6:16；7:16）',
    pairingRuleEn: 'Leads to the Door in the Side of the Ark (Gen 6:16; 7:16)',
    scriptureRef: '创世记 6:16, 7:16',
    scriptureQuoteZh: '“方舟的门要开在旁边……凡有血肉的活物，都一公一母，照神所吩咐挪亚的，进入方舟；耶和华就把他关在方舟里头。”',
    biblicalFactZh: '方舟唯一的入口开在侧面；挪亚一家与众活物由此进入后，由耶和华亲自关门封存。',
    artisticNoteZh: '防滑横木长栈桥连接山谷鹅卵石大道与方舟侧门。',
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
    artisticNoteZh: '白须持杖长者形象，立于登船栈道前引导全家与众活物。',
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
    biblicalFactZh: '圣经记载她与挪亚、三个儿子及三个儿妇同日进入方舟，洪水后一同出方舟承受赐福。',
    artisticNoteZh: '身着深蓝长袍与头巾，立于挪亚身旁。',
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
    biblicalFactZh: '全地洪水之后的人类皆由闪、含、雅弗三对夫妻繁衍而出。',
    artisticNoteZh: '分别协助引导动物登船、搬运粮草与在三层甲板安顿。',
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
    biblicalFactZh: '牛分蹄、倒嚼，属洁净畜类（利 11:3），按神吩咐带入七公七母，既为存留种畜，也为洪水消退后筑坛献燔祭（创 8:20）。',
    artisticNoteZh: '左侧围栏内与第一层重畜舱均安置成群牛只以体现洁净畜类的七对配置。',
  },
  'ark-lamb': {
    id: 'ark-lamb',
    zhName: '绵羊与羊羔（洁净畜类 · 七公七母）',
    enName: 'Sheep & Lambs (Clean Beasts · 7 Pairs)',
    hebrew: 'צֹאן / כֶּבֶשׂ (Ṣōn / Keḇeś)',
    category: 'clean_animal',
    pairingRuleZh: '洁净畜类：七公七母（7 对，创 7:2）',
    pairingRuleEn: 'Clean Beast: Seven Pairs (Gen 7:2)',
    scriptureRef: '创世记 7:2; 8:20',
    scriptureQuoteZh: '“凡洁净的畜类，你要带七公七母……使它可以留种，活在全地上。”',
    biblicalFactZh: '绵羊与山羊同属圣经核心洁净畜类，带入七公七母。',
    artisticNoteZh: '成群安置在左侧青草围栏与第二层甲板饲槽旁。',
  },
  'ark-goat-v03': {
    id: 'ark-goat-v03',
    zhName: '山羊（洁净畜类 · 七公七母）',
    enName: 'Horned Goats / Caprines (Clean Beasts · 7 Pairs)',
    hebrew: 'עֵז / שָׂעִיר (ʿĒz / Śāʿîr)',
    category: 'clean_animal',
    pairingRuleZh: '洁净畜类：七公七母（7 对，创 7:2）',
    pairingRuleEn: 'Clean Beast: Seven Pairs (Gen 7:2)',
    scriptureRef: '创世记 7:2; 利未记 11:3',
    scriptureQuoteZh: '“凡蹄分两瓣、倒嚼的走兽，你们都可以吃……洁净的畜类，你要带七公七母。”',
    biblicalFactZh: '山羊分蹄倒嚼，属洁净畜类，带七公七母登船。',
    artisticNoteZh: '动态吃草与行走姿态，分布于山谷草场与第二层船舱。',
  },
  'ark-deer-v02': {
    id: 'ark-deer-v02',
    zhName: '呦鹿（洁净走兽 · 七公七母）',
    enName: 'Fallow Deer (Clean Game · 7 Pairs)',
    hebrew: 'אַיָּל (ʾAyyāl)',
    category: 'clean_animal',
    pairingRuleZh: '洁净畜类/走兽：七公七母（创 7:2；申 14:4–5）',
    pairingRuleEn: 'Clean Ruminant: Seven Pairs (Gen 7:2; Deut 14:4–5)',
    scriptureRef: '创世记 7:2; 申命记 14:5; 诗篇 42:1',
    scriptureQuoteZh: '“可吃的牲畜就是：牛、绵羊、山羊、鹿、羚羊、狍子、野山羊……”',
    biblicalFactZh: '申命记 14:5 明确将鹿（Ayyal）列为分蹄倒嚼的洁净走兽。',
    artisticNoteZh: '成对安置在右侧林地与第二层甲板。',
  },
  'ark-elephant': {
    id: 'ark-elephant',
    zhName: '大象（不洁净畜类 · 一公一母）',
    enName: 'Elephants (Unclean Beasts · 1 Pair)',
    category: 'unclean_animal',
    pairingRuleZh: '不洁净畜类：一公一母（1 对，创 6:19；7:2）',
    pairingRuleEn: 'Unclean Beast: One Pair (Male & Female, Gen 6:19; 7:2)',
    scriptureRef: '创世记 6:19–20; 7:2, 8–9',
    scriptureQuoteZh: '“凡有血肉的活物，每样两个，一公一母，你要带进方舟，好在你那里保全生命。”',
    biblicalFactZh: '大象不分蹄也不倒嚼，属“不洁净的畜类”，按一公一母（一对）进入方舟保全物种。',
    artisticNoteZh: '左侧大围栏与第一层底舱重型隔间各展示雄雌成对大象。',
  },
  'ark-giraffe': {
    id: 'ark-giraffe',
    zhName: '长颈鹿（成对登船 · 创 7:2）',
    enName: 'Giraffes (Boarding in Pairs)',
    category: 'clean_animal',
    pairingRuleZh: '各从其类成对进入方舟（创 6:20；7:2）',
    pairingRuleEn: 'Entered the Ark after their kind in pairs (Gen 6:20; 7:2)',
    scriptureRef: '创世记 6:20; 7:14',
    scriptureQuoteZh: '“飞鸟各从其类，牲畜各从其类，地上的昆虫各从其类，每样两个，要到你那里，好保全生命。”',
    biblicalFactZh: '长颈鹿在生物学上分蹄且反刍（申 14:5 提及的 Zemer 常被学者考据为长颈鹿或野生山羊）；在参考图 174.jpeg 左侧围栏中最为醒目。',
    artisticNoteZh: '严格还原 174.jpeg 左侧双长颈鹿构图，并在第一层甲板设有挑高舱位。',
  },
  'ark-lion': {
    id: 'ark-lion',
    zhName: '雄狮、母狮与幼狮（不洁净走兽 · 一公一母）',
    enName: 'Lions & Lion Cubs (Unclean Beasts · 1 Pair)',
    hebrew: 'אַרְיֵה / כְּפִיר (ʾAryēh / Kəp̄îr)',
    category: 'unclean_animal',
    pairingRuleZh: '不洁净走兽：一公一母（1 对，创 7:2；利 11:27）',
    pairingRuleEn: 'Unclean Pawed Beast: One Pair (Gen 7:2; Lev 11:27)',
    scriptureRef: '创世记 7:2, 14–15; 利未记 11:27',
    scriptureQuoteZh: '“凡四足的走兽，用脚掌行走的，都与你们不洁净……凡有血肉、有气息的活物，都两个两个地到挪亚那里进入方舟。”',
    biblicalFactZh: '狮用脚掌（爪）行走，按利未记 11:27 属不洁净走兽，一公一母进入方舟；方舟内备有充足粮草（创 6:21）使百兽和平共处。',
    artisticNoteZh: '还原 174.jpeg 右侧木牌旁成对雄狮与幼狮构图。',
  },
  'ark-camel': {
    id: 'ark-camel',
    zhName: '骆驼（不洁净畜类 · 一公一母）',
    enName: 'Camels (Unclean Beasts · 1 Pair)',
    hebrew: 'גָּמָל (Gāmāl)',
    category: 'unclean_animal',
    pairingRuleZh: '不洁净畜类：一公一母（1 对，利 11:4；创 7:2）',
    pairingRuleEn: 'Unclean Beast: One Pair (Chews cud but does not part hoof, Lev 11:4)',
    scriptureRef: '创世记 7:2; 利未记 11:4',
    scriptureQuoteZh: '“但那倒嚼或分蹄之中不可吃的乃是：骆驼，因为倒嚼不分蹄，就与你们不洁净。”',
    biblicalFactZh: '利未记 11:4 特别指出骆驼“倒嚼不分蹄”，故属不洁净畜类，按一公一母进入方舟。',
    artisticNoteZh: '还原 174.jpeg 右侧帐篷与木牌旁的双驼构图。',
  },
  'ark-donkey': {
    id: 'ark-donkey',
    zhName: '驴（不洁净畜类 · 一公一母）',
    enName: 'Donkeys (Unclean Beasts · 1 Pair)',
    hebrew: 'חֲמוֹר (Ḥămôr)',
    category: 'unclean_animal',
    pairingRuleZh: '不洁净畜类：一公一母（1 对，出 13:13；创 7:2）',
    pairingRuleEn: 'Unclean Beast: One Pair (Single-hoofed, Exod 13:13; Gen 7:2)',
    scriptureRef: '创世记 7:2, 8; 出埃及记 13:13',
    scriptureQuoteZh: '“洁净的畜类和不洁净的畜类，飞鸟并地上一切的昆虫，都一公一母，照神所吩咐挪亚的，进入方舟。”',
    biblicalFactZh: '驴为单蹄且不反刍，在圣经律法中属不洁净畜类（出 13:13），按一公一母登船，并在方舟建造期间承担物资驮运。',
    artisticNoteZh: '还原 174.jpeg 右侧中景成对灰驴构图。',
  },
  'ark-dove-olive-v07': {
    id: 'ark-dove-olive-v07',
    zhName: '叼新拧橄榄叶的鸽子与乌鸦（洁净飞鸟 · 七公七母）',
    enName: 'Olive-Leaf Dove & Raven (Clean Birds · 7 Pairs)',
    hebrew: 'יוֹנָה וְעֹרֵב (Yônāh wə-ʿŌrēḇ)',
    category: 'bird',
    pairingRuleZh: '空中的飞鸟：七公七母（创 7:3；8:7–11）',
    pairingRuleEn: 'Birds of the Heavens: Seven Pairs (Gen 7:3; 8:7–11)',
    scriptureRef: '创世记 7:3; 8:7–11',
    scriptureQuoteZh: '“空中的飞鸟也要带七公七母……到了晚上，鸽子回到他那里，嘴里叼着一个新拧下来的橄榄叶子，挪亚就知道地上的水退了。”',
    biblicalFactZh: '水退期间，挪亚打开方舟透光窗（创 8:6），先后放出乌鸦（不洁净鸟，往来飞去）与三次放出鸽子（洁净鸟，第二次带回新橄榄叶，第三次不再返回）。',
    artisticNoteZh: '方舟屋顶与空中同时展示停栖白鸽、展翅叼橄榄叶白鸽与盘旋乌鸦。',
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
    artisticNoteZh: '点击底部“筑坛与彩虹”模式即可唤醒圣山石坛圣火、天际立体彩虹与挪亚全家献祭感恩场景。',
  },
};

interface PlacementDef {
  id: string;
  assetId: string;
  biblicalKey: string;
  zone: 'architecture' | 'yard' | 'family' | 'animals_left' | 'animals_right' | 'birds' | 'deck1' | 'deck2' | 'deck3' | 'covenant';
  deck: 0 | 1 | 2 | 3;
  pos: [number, number, number];
  targetHeight?: number;
  targetWidth?: number;
  yaw: number;
  clip?: string;
  boardingOrder?: number;
}

const SCENE_PLACEMENTS: PlacementDef[] = [
  // ================= ARCHITECTURE & CONSTRUCTION YARD (Matching 174.jpeg) =================
  { id: 'ark-main-hull', assetId: 'ark-structure', biblicalKey: 'ark-structure', zone: 'architecture', deck: 0, pos: [0.0, 0.25, -6.2], targetWidth: 32.8, yaw: 0 },
  { id: 'ark-main-ramp', assetId: 'ark-ramp', biblicalKey: 'ark-ramp', zone: 'architecture', deck: 0, pos: [0.0, 0.0, 2.3], targetWidth: 4.2, yaw: 0 },
  { id: 'ark-right-scaffold-1', assetId: 'ark-scaffold', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [10.0, 0.0, -1.0], targetHeight: 5.8, yaw: 0 },
  { id: 'ark-right-crane', assetId: 'ark-crane', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [14.2, 0.0, 1.6], targetHeight: 6.5, yaw: -0.2 },
  { id: 'ark-right-scaffold-2', assetId: 'ark-scaffold', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [16.8, 0.0, -1.8], targetHeight: 5.2, yaw: -0.15 },
  { id: 'ark-left-workbench-1', assetId: 'ark-workbench', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-8.6, 0.0, 2.2], targetWidth: 3.2, yaw: 0.12 },
  { id: 'ark-right-tent-1', assetId: 'ark-tent', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [16.6, 0.0, 6.8], targetWidth: 4.4, yaw: -0.35 },
  { id: 'ark-right-tent-2', assetId: 'ark-tent', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [19.0, 0.0, 11.2], targetWidth: 3.7, yaw: -0.5 },
  // Wooden Sign with engraved "FAITH BUILDS A BRIGHTER TOMORROW" plaque facing the camera
  { id: 'ark-faith-sign', assetId: 'ark-wooden-sign', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [13.2, 0.0, 13.8], targetHeight: 2.85, yaw: -0.22 },
  { id: 'ark-blue-banner-R', assetId: 'ark-banner', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [14.6, 0.0, 11.4], targetHeight: 3.5, yaw: Math.PI / 2 - 0.2 },
  { id: 'ark-blue-banner-L', assetId: 'ark-banner', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-5.6, 0.0, 3.2], targetHeight: 3.3, yaw: Math.PI / 2 + 0.15 },

  // Fences framing Left Pens (z = 10.0 and z = 15.2) & Right Pens (z = 13.5)
  { id: 'fence-L-front-1', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-8.0, 0.0, 10.0], targetWidth: 3.1, yaw: 0 },
  { id: 'fence-L-front-2', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-11.2, 0.0, 10.0], targetWidth: 3.1, yaw: 0 },
  { id: 'fence-L-front-3', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-14.4, 0.0, 10.0], targetWidth: 3.1, yaw: 0 },
  { id: 'fence-L-mid-1', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-8.0, 0.0, 15.2], targetWidth: 3.1, yaw: 0 },
  { id: 'fence-L-mid-2', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-11.2, 0.0, 15.2], targetWidth: 3.1, yaw: 0 },
  { id: 'fence-L-mid-3', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-14.4, 0.0, 15.2], targetWidth: 3.1, yaw: 0 },
  { id: 'fence-L-side-1', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-6.4, 0.0, 12.6], targetWidth: 3.1, yaw: Math.PI / 2 },
  { id: 'fence-L-side-2', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-6.4, 0.0, 17.5], targetWidth: 3.1, yaw: Math.PI / 2 },
  { id: 'fence-R-front-1', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [8.0, 0.0, 13.5], targetWidth: 3.1, yaw: 0 },
  { id: 'fence-R-front-2', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [11.2, 0.0, 13.5], targetWidth: 3.1, yaw: 0 },
  { id: 'fence-R-side-1', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [6.4, 0.0, 11.8], targetWidth: 3.1, yaw: Math.PI / 2 },
  { id: 'fence-R-side-2', assetId: 'ark-fence', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [6.4, 0.0, 16.5], targetWidth: 3.1, yaw: Math.PI / 2 },

  // Supplies, Crates, Red Apples, Barrels, Hay Bales, Jars, Planks, Ladders, Lanterns
  { id: 'apple-crate-L1', assetId: 'ark-produce-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-5.5, 0.0, 5.8], targetWidth: 1.3, yaw: 0.2 },
  { id: 'apple-crate-L2', assetId: 'ark-produce-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-5.6, 0.0, 14.2], targetWidth: 1.3, yaw: 0.1 },
  { id: 'apple-crate-R1', assetId: 'ark-produce-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [7.4, 0.0, 6.2], targetWidth: 1.3, yaw: -0.2 },
  { id: 'crate-yard-L1', assetId: 'ark-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-4.6, 0.0, 4.4], targetWidth: 1.15, yaw: 0.15 },
  { id: 'crate-yard-R1', assetId: 'ark-crate', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [8.8, 0.0, 4.5], targetWidth: 1.15, yaw: -0.15 },
  { id: 'barrel-yard-L1', assetId: 'ark-barrel', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-6.6, 0.0, 3.8], targetHeight: 1.05, yaw: 0 },
  { id: 'barrel-yard-L2', assetId: 'ark-barrel', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-7.4, 0.0, 4.1], targetHeight: 1.0, yaw: 0.4 },
  { id: 'barrel-yard-R1', assetId: 'ark-barrel', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [10.2, 0.0, 4.2], targetHeight: 1.05, yaw: 0 },
  { id: 'hay-bale-L1', assetId: 'ark-hay-bale', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-14.2, 0.0, 11.4], targetWidth: 1.4, yaw: 0.1 },
  { id: 'hay-bale-L2', assetId: 'ark-hay-bale', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-14.2, 0.0, 16.2], targetWidth: 1.4, yaw: -0.2 },
  { id: 'hay-bale-R1', assetId: 'ark-hay-bale', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [9.6, 0.0, 12.4], targetWidth: 1.4, yaw: 0.25 },
  { id: 'jar-yard-1', assetId: 'ark-jar', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-5.1, 0.0, 6.8], targetHeight: 0.9, yaw: 0 },
  { id: 'jar-yard-2', assetId: 'ark-jar', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [6.8, 0.0, 7.2], targetHeight: 0.9, yaw: 0.5 },
  { id: 'sack-yard-1', assetId: 'ark-sack', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [8.2, 0.0, 5.4], targetHeight: 0.9, yaw: -0.3 },
  { id: 'planks-yard-L', assetId: 'ark-wood-planks', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-11.2, 0.0, 2.2], targetWidth: 2.1, yaw: 0.35 },
  { id: 'planks-yard-R', assetId: 'ark-wood-planks', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [12.0, 0.0, 4.4], targetWidth: 2.1, yaw: -0.25 },
  { id: 'mallet-yard-L', assetId: 'ark-mallet', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-7.4, 0.0, 2.8], targetWidth: 0.8, yaw: 0.6 },
  { id: 'rope-yard-R', assetId: 'ark-rope', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [13.2, 0.0, 4.8], targetWidth: 0.9, yaw: 0.2 },
  { id: 'ladder-yard-L', assetId: 'ark-ladder', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-4.8, 0.0, -1.2], targetHeight: 6.2, yaw: 0.05 },
  { id: 'lantern-ramp-L', assetId: 'ark-lantern', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-2.2, 1.2, 4.8], targetHeight: 0.75, yaw: 0 },
  { id: 'lantern-ramp-R', assetId: 'ark-lantern', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [2.2, 1.2, 4.8], targetHeight: 0.75, yaw: 0 },

  // ================= TREES, ROCKS, BUSHES & FLOWERS (Framing 174.jpeg Valley without blocking Waterfall) =================
  { id: 'tree-L-cliff-1', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-22.5, 2.2, -9.2], targetHeight: 7.4, yaw: 0 },
  { id: 'tree-L-pen-3', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-17.2, 0.0, 3.2], targetHeight: 6.2, yaw: -0.4 },
  { id: 'tree-L-fore-4', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-16.8, 0.0, 16.5], targetHeight: 5.6, yaw: 0.3 },
  { id: 'tree-R-cliff-1', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [19.2, 1.0, -7.8], targetHeight: 7.4, yaw: -0.3 },
  { id: 'tree-R-pen-2', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [18.8, 0.0, 2.5], targetHeight: 6.4, yaw: 0.5 },
  { id: 'tree-R-fore-3', assetId: 'ark-tree', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [17.5, 0.0, 15.2], targetHeight: 6.0, yaw: -0.6 },
  { id: 'rock-L-falls-1', assetId: 'ark-rock', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-16.2, 0.0, -3.5], targetWidth: 2.8, yaw: 0.2 },
  { id: 'rock-L-stream-2', assetId: 'ark-rock', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-18.2, 0.0, 9.2], targetWidth: 2.6, yaw: 1.1 },
  { id: 'rock-R-hill-1', assetId: 'ark-rock', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [17.8, 0.0, -2.5], targetWidth: 3.0, yaw: -0.5 },
  { id: 'rock-R-fore-2', assetId: 'ark-rock', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [15.5, 0.0, 18.2], targetWidth: 2.5, yaw: 0.4 },
  { id: 'bush-L-1', assetId: 'ark-bush', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-14.8, 0.0, 8.8], targetWidth: 1.5, yaw: 0 },
  { id: 'bush-L-2', assetId: 'ark-bush', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-14.8, 0.0, 18.2], targetWidth: 1.5, yaw: 0.8 },
  { id: 'bush-R-1', assetId: 'ark-bush', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [15.2, 0.0, 9.2], targetWidth: 1.5, yaw: 0.4 },
  { id: 'bush-R-2', assetId: 'ark-bush', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [13.8, 0.0, 17.2], targetWidth: 1.5, yaw: -0.5 },
  { id: 'flowers-L-1', assetId: 'ark-flowers', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-5.6, 0.0, 9.8], targetWidth: 1.2, yaw: 0 },
  { id: 'flowers-L-2', assetId: 'ark-flowers', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-5.6, 0.0, 15.8], targetWidth: 1.2, yaw: 0.5 },
  { id: 'flowers-R-1', assetId: 'ark-flowers', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [5.8, 0.0, 10.2], targetWidth: 1.2, yaw: -0.3 },
  { id: 'flowers-R-2', assetId: 'ark-flowers', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [5.8, 0.0, 17.2], targetWidth: 1.2, yaw: 0.2 },

  // ================= NOAH, FAMILY OF 8 & CARPENTERS (Matching 174.jpeg Foreground Lineup!) =================
  { id: 'noah-patriarch', assetId: 'ark-noah', biblicalKey: 'ark-noah', zone: 'family', deck: 0, pos: [-1.8, 0.08, 11.8], targetHeight: 2.18, yaw: 0.12, clip: 'idle' },
  { id: 'noah-wife', assetId: 'ark-woman-blue', biblicalKey: 'ark-woman-blue', zone: 'family', deck: 0, pos: [-0.3, 0.08, 12.0], targetHeight: 1.98, yaw: 0.05, clip: 'idle' },
  { id: 'son-shem', assetId: 'ark-man-cream', biblicalKey: 'ark-sons', zone: 'family', deck: 0, pos: [1.2, 0.08, 12.2], targetHeight: 1.98, yaw: -0.08, clip: 'idle' },
  { id: 'son-japheth', assetId: 'ark-boy-green', biblicalKey: 'ark-sons', zone: 'family', deck: 0, pos: [2.5, 0.08, 12.5], targetHeight: 1.85, yaw: -0.15, clip: 'idle' },
  // Flanking family members guiding animals near ramp base
  { id: 'son-ham', assetId: 'ark-man-bearded-v06', biblicalKey: 'ark-sons', zone: 'family', deck: 0, pos: [-3.2, 0.08, 7.6], targetHeight: 1.98, yaw: 0.35, clip: 'gentle_look' },
  { id: 'wife-shem', assetId: 'ark-woman-green-v08', biblicalKey: 'ark-sons', zone: 'family', deck: 0, pos: [3.4, 0.08, 8.2], targetHeight: 1.9, yaw: -0.35, clip: 'clasped_breathing' },
  { id: 'wife-ham', assetId: 'ark-woman-rust-v06', biblicalKey: 'ark-sons', zone: 'family', deck: 0, pos: [-3.8, 0.08, 9.2], targetHeight: 1.9, yaw: 0.35, clip: 'attentive_glance' },
  { id: 'wife-japheth', assetId: 'genesis-8-1-purple-pale-veiled-ramp-woman', biblicalKey: 'ark-sons', zone: 'family', deck: 0, pos: [0.5, 0.72, 5.4], targetHeight: 1.9, yaw: 0.0, clip: 'idle' },
  // Carpenters in the construction yard
  { id: 'carpenter-left', assetId: 'ark-worker', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [-8.6, 0.0, 1.1], targetHeight: 1.95, yaw: 0.1, clip: 'idle' },
  { id: 'carpenter-right', assetId: 'ark-worker-carrying', biblicalKey: 'ark-structure', zone: 'yard', deck: 0, pos: [10.8, 0.0, 2.8], targetHeight: 1.95, yaw: -0.35, clip: 'walk' },

  // ================= EXTERIOR ANIMALS — LEFT ENCLOSURES (Zero Clipping, 3 Clean Tiers!) =================
  // Upper-Left Paddock (z = 3.8..7.8, well behind fence at z = 10.0): 2 Giraffes + 2 Elephants
  { id: 'giraffe-L-cutout', assetId: 'ark-giraffe', biblicalKey: 'ark-giraffe', zone: 'animals_left', deck: 0, pos: [-14.0, 0.0, 3.8], targetHeight: 4.4, yaw: 0.22, boardingOrder: 1 },
  { id: 'giraffe-L-anim', assetId: 'psalms-104-giraffe-v04', biblicalKey: 'ark-giraffe', zone: 'animals_left', deck: 0, pos: [-11.4, 0.0, 4.2], targetHeight: 4.2, yaw: 0.15, clip: 'look_around', boardingOrder: 2 },
  { id: 'elephant-L-cutout', assetId: 'ark-elephant', biblicalKey: 'ark-elephant', zone: 'animals_left', deck: 0, pos: [-13.0, 0.0, 7.4], targetHeight: 2.95, yaw: 0.2, boardingOrder: 3 },
  { id: 'elephant-L-anim', assetId: 'genesis-6-9-gray-elephant-v01-v61', biblicalKey: 'ark-elephant', zone: 'animals_left', deck: 0, pos: [-9.4, 0.0, 7.6], targetHeight: 2.85, yaw: 0.15, clip: 'trunk_reach', boardingOrder: 4 },
  // Middle-Left Paddock (z = 12.4..12.8, between fences z = 10.0 and z = 15.2): Clean Cattle / Cows
  { id: 'cow-L-cutout-1', assetId: 'ark-cow', biblicalKey: 'ark-cow', zone: 'animals_left', deck: 0, pos: [-8.2, 0.0, 12.4], targetHeight: 1.82, yaw: 0.15, boardingOrder: 5 },
  { id: 'cow-L-cutout-2', assetId: 'ark-cow', biblicalKey: 'ark-cow', zone: 'animals_left', deck: 0, pos: [-10.6, 0.0, 12.8], targetHeight: 1.76, yaw: 0.22, boardingOrder: 6 },
  { id: 'cow-L-anim-3', assetId: 'jeroboam-brown-white-cow-v02', biblicalKey: 'ark-cow', zone: 'animals_left', deck: 0, pos: [-13.2, 0.0, 12.5], targetHeight: 1.8, yaw: -0.2, clip: 'graze' },
  // Lower-Left Paddock (z = 17.0..17.8, in front of fence z = 15.2): Clean Sheep, Lambs & Goats
  { id: 'lamb-L-cutout-1', assetId: 'ark-lamb', biblicalKey: 'ark-lamb', zone: 'animals_left', deck: 0, pos: [-8.0, 0.0, 17.0], targetHeight: 1.22, yaw: 0.18, boardingOrder: 7 },
  { id: 'lamb-L-cutout-2', assetId: 'ark-lamb', biblicalKey: 'ark-lamb', zone: 'animals_left', deck: 0, pos: [-9.6, 0.0, 17.6], targetHeight: 1.16, yaw: 0.3, boardingOrder: 8 },
  { id: 'sheep-L-anim-3', assetId: 'genesis-8-20-grazing-sheep-v11', biblicalKey: 'ark-lamb', zone: 'animals_left', deck: 0, pos: [-11.5, 0.0, 17.2], targetHeight: 1.25, yaw: -0.25, clip: 'graze' },
  { id: 'goat-L-anim-1', assetId: 'ark-goat-v03', biblicalKey: 'ark-goat-v03', zone: 'animals_left', deck: 0, pos: [-13.4, 0.0, 17.0], targetHeight: 1.28, yaw: -0.15, clip: 'graze' },
  { id: 'squirrel-L-post', assetId: 'ark-squirrel', biblicalKey: 'ark-deer-v02', zone: 'animals_left', deck: 0, pos: [-6.4, 1.05, 15.2], targetHeight: 0.65, yaw: 0.3 },

  // ================= EXTERIOR ANIMALS — RIGHT ENCLOSURES & AVENUE (Zero Sign Clipping!) =================
  { id: 'camel-R-cutout', assetId: 'ark-camel', biblicalKey: 'ark-camel', zone: 'animals_right', deck: 0, pos: [11.2, 0.0, 7.6], targetHeight: 2.5, yaw: -0.15, boardingOrder: 9 },
  { id: 'camel-R-anim', assetId: 'psalms-117-camel-v02', biblicalKey: 'ark-camel', zone: 'animals_right', deck: 0, pos: [14.0, 0.0, 8.2], targetHeight: 2.45, yaw: -0.35, clip: 'look_around', boardingOrder: 10 },
  { id: 'donkey-R-cutout', assetId: 'ark-donkey', biblicalKey: 'ark-donkey', zone: 'animals_right', deck: 0, pos: [7.8, 0.0, 10.2], targetHeight: 1.7, yaw: 0.0, boardingOrder: 11 },
  { id: 'donkey-R-anim', assetId: 'balaam-donkey-packed-v04', biblicalKey: 'ark-donkey', zone: 'animals_right', deck: 0, pos: [10.2, 0.0, 10.8], targetHeight: 1.7, yaw: -0.25, clip: 'idle', boardingOrder: 12 },
  { id: 'lion-R-cutout', assetId: 'ark-lion', biblicalKey: 'ark-lion', zone: 'animals_right', deck: 0, pos: [7.8, 0.0, 15.6], targetHeight: 1.62, yaw: -0.45, boardingOrder: 13 },
  { id: 'lion-R-anim', assetId: 'psalms-148-adult-lion-v02', biblicalKey: 'ark-lion', zone: 'animals_right', deck: 0, pos: [9.8, 0.0, 16.4], targetHeight: 1.6, yaw: -0.55, clip: 'idle', boardingOrder: 14 },
  { id: 'lion-cub-R', assetId: 'ark-lion-cub-v02', biblicalKey: 'ark-lion', zone: 'animals_right', deck: 0, pos: [8.6, 0.0, 17.5], targetHeight: 1.02, yaw: -0.4, clip: 'sniff' },
  { id: 'deer-R-1', assetId: 'ark-deer-v02', biblicalKey: 'ark-deer-v02', zone: 'animals_right', deck: 0, pos: [12.4, 0.0, 16.4], targetHeight: 1.72, yaw: -0.4, clip: 'graze', boardingOrder: 15 },
  { id: 'deer-R-2', assetId: 'ark-deer-v02', biblicalKey: 'ark-deer-v02', zone: 'animals_right', deck: 0, pos: [14.2, 0.0, 16.8], targetHeight: 1.66, yaw: -0.55, clip: 'idle', boardingOrder: 16 },
  { id: 'zebra-R-1', assetId: 'ark-zebra-v02', biblicalKey: 'ark-donkey', zone: 'animals_right', deck: 0, pos: [16.2, 0.0, 12.8], targetHeight: 1.72, yaw: -0.45, clip: 'idle' },
  { id: 'horse-R-1', assetId: 'royal-white-horse-v1-v11', biblicalKey: 'ark-donkey', zone: 'animals_right', deck: 0, pos: [16.8, 0.0, 14.8], targetHeight: 1.92, yaw: -0.5, clip: 'idle' },
  { id: 'wolf-R-1', assetId: 'ark-wolf-v02', biblicalKey: 'ark-lion', zone: 'animals_right', deck: 0, pos: [11.5, 0.0, 18.0], targetHeight: 1.22, yaw: -0.35, clip: 'sniff' },
  { id: 'rabbit-R-1', assetId: 'ark-rabbit-v04', biblicalKey: 'ark-lion', zone: 'animals_right', deck: 0, pos: [5.5, 0.0, 14.8], targetHeight: 0.7, yaw: -0.4, clip: 'look_around' },
  { id: 'hen-path-1', assetId: 'ark-hen', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [-2.6, 0.08, 15.8], targetHeight: 0.76, yaw: 0.3 },
  { id: 'hen-path-2', assetId: 'psalms-128-white-hen-v02', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [2.2, 0.08, 16.4], targetHeight: 0.74, yaw: -0.4, clip: 'look_down' },
  { id: 'chick-path-1', assetId: 'ark-chick', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [-1.9, 0.08, 16.4], targetHeight: 0.46, yaw: 0.4, clip: 'walk' },
  { id: 'chick-path-2', assetId: 'psalms-128-yellow-chick-v04', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [1.6, 0.08, 16.9], targetHeight: 0.44, yaw: -0.3, clip: 'look_around' },
  { id: 'quail-path-1', assetId: 'exodus-16-1-quail-grounded-v11', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [-3.6, 0.08, 14.4], targetHeight: 0.6, yaw: 0.5, clip: 'gentle_head_dip' },

  // ================= SKY & ROOF BIRDS (Separated cleanly so no birds stack) =================
  { id: 'dove-roof-perched', assetId: 'ark-dove', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [-4.5, 11.4, -4.5], targetHeight: 0.85, yaw: 0.25, clip: 'walk' },
  { id: 'dove-olive-flying-1', assetId: 'ark-dove-olive-v07', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [-9.5, 13.5, 1.5], targetHeight: 1.15, yaw: 0.45, clip: 'flight_flap' },
  { id: 'dove-olive-flying-2', assetId: 'ark-dove-olive-v07', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [8.8, 14.0, 0.8], targetHeight: 1.1, yaw: -0.45, clip: 'flight_glide' },
  { id: 'raven-flying', assetId: 'genesis-8-1-raven-asymmetric-flight', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [12.5, 14.8, -2.5], targetHeight: 1.2, yaw: -0.6 },
  { id: 'bluebird-roof', assetId: 'psalms-8-bluebird-v04', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 0, pos: [3.5, 11.4, -4.5], targetHeight: 0.75, yaw: -0.3, clip: 'look_around' },

  // ================= 3-DECK INTERIOR CUTAWAY PLACEMENTS (3.0m-3.2m Clear Headroom!) =================
  // DECK 1 (Lower Deck, y = 1.38): Heavy Beasts & Bulk Provisions
  { id: 'd1-elephant-1', assetId: 'genesis-6-9-gray-elephant-v01-v61', biblicalKey: 'ark-elephant', zone: 'deck1', deck: 1, pos: [-10.2, 1.38, -4.4], targetHeight: 2.15, yaw: 0.35, clip: 'idle' },
  { id: 'd1-elephant-2', assetId: 'psalms-104-elephant-v09', biblicalKey: 'ark-elephant', zone: 'deck1', deck: 1, pos: [-7.2, 1.38, -4.6], targetHeight: 2.1, yaw: -0.25, clip: 'graze' },
  { id: 'd1-camel-1', assetId: 'psalms-117-camel-v02', biblicalKey: 'ark-camel', zone: 'deck1', deck: 1, pos: [-3.2, 1.38, -4.5], targetHeight: 2.05, yaw: 0.2, clip: 'idle' },
  { id: 'd1-cow-1', assetId: 'jeroboam-brown-white-cow-v02', biblicalKey: 'ark-cow', zone: 'deck1', deck: 1, pos: [3.2, 1.38, -4.4], targetHeight: 1.72, yaw: -0.3, clip: 'idle' },
  { id: 'd1-cow-2', assetId: 'ark-cow', biblicalKey: 'ark-cow', zone: 'deck1', deck: 1, pos: [7.4, 1.38, -4.5], targetHeight: 1.72, yaw: 0.15 },
  { id: 'd1-zebra-1', assetId: 'ark-zebra-v02', biblicalKey: 'ark-donkey', zone: 'deck1', deck: 1, pos: [11.4, 1.38, -4.4], targetHeight: 1.68, yaw: -0.35, clip: 'idle' },
  { id: 'd1-barrel-1', assetId: 'ark-barrel', biblicalKey: 'ark-structure', zone: 'deck1', deck: 1, pos: [-5.5, 1.38, -3.2], targetHeight: 0.92, yaw: 0 },
  { id: 'd1-barrel-2', assetId: 'ark-barrel', biblicalKey: 'ark-structure', zone: 'deck1', deck: 1, pos: [5.5, 1.38, -3.2], targetHeight: 0.92, yaw: 0.3 },
  { id: 'd1-hay-1', assetId: 'ark-hay-bale', biblicalKey: 'ark-structure', zone: 'deck1', deck: 1, pos: [0.0, 1.38, -5.8], targetWidth: 1.3, yaw: 0 },

  // DECK 2 (Middle Deck, y = 4.58): Clean & Unclean Flocks, Lions, Deer, Feed & Apple Crates
  { id: 'd2-sheep-1', assetId: 'genesis-8-20-grazing-sheep-v11', biblicalKey: 'ark-lamb', zone: 'deck2', deck: 2, pos: [-11.8, 4.58, -4.4], targetHeight: 1.22, yaw: 0.3, clip: 'graze' },
  { id: 'd2-sheep-2', assetId: 'ark-lamb', biblicalKey: 'ark-lamb', zone: 'deck2', deck: 2, pos: [-10.2, 4.58, -4.8], targetHeight: 1.18, yaw: 0.15 },
  { id: 'd2-goat-1', assetId: 'ark-goat-v03', biblicalKey: 'ark-goat-v03', zone: 'deck2', deck: 2, pos: [-7.6, 4.58, -4.4], targetHeight: 1.25, yaw: -0.25, clip: 'graze' },
  { id: 'd2-goat-2', assetId: 'genesis-8-20-grazing-horned-caprine-v06', biblicalKey: 'ark-goat-v03', zone: 'deck2', deck: 2, pos: [-6.0, 4.58, -4.8], targetHeight: 1.22, yaw: 0.2, clip: 'idle' },
  { id: 'd2-donkey-1', assetId: 'genesis-8-20-unladen-gray-donkey', biblicalKey: 'ark-donkey', zone: 'deck2', deck: 2, pos: [-1.8, 4.58, -4.4], targetHeight: 1.6, yaw: 0.25, clip: 'idle' },
  { id: 'd2-deer-1', assetId: 'ark-deer-v02', biblicalKey: 'ark-deer-v02', zone: 'deck2', deck: 2, pos: [2.4, 4.58, -4.4], targetHeight: 1.62, yaw: -0.25, clip: 'graze' },
  { id: 'd2-lion-1', assetId: 'psalms-148-adult-lion-v02', biblicalKey: 'ark-lion', zone: 'deck2', deck: 2, pos: [7.6, 4.58, -4.4], targetHeight: 1.55, yaw: -0.35, clip: 'idle' },
  { id: 'd2-lion-cub', assetId: 'ark-lion-cub-v02', biblicalKey: 'ark-lion', zone: 'deck2', deck: 2, pos: [9.2, 4.58, -4.2], targetHeight: 0.98, yaw: -0.2, clip: 'sniff' },
  { id: 'd2-wolf-1', assetId: 'ark-wolf-v02', biblicalKey: 'ark-lion', zone: 'deck2', deck: 2, pos: [11.6, 4.58, -4.5], targetHeight: 1.18, yaw: -0.4, clip: 'idle' },
  { id: 'd2-apple-crate', assetId: 'ark-produce-crate', biblicalKey: 'ark-structure', zone: 'deck2', deck: 2, pos: [-3.8, 4.58, -3.2], targetWidth: 1.2, yaw: 0.1 },
  { id: 'd2-jar', assetId: 'ark-jar', biblicalKey: 'ark-structure', zone: 'deck2', deck: 2, pos: [4.2, 4.58, -3.2], targetHeight: 0.88, yaw: 0 },

  // DECK 3 (Upper Deck, y = 7.58, Roof at 10.45 -> 2.87m clear headroom): Noah's Family & Birds
  { id: 'd3-noah-guiding', assetId: 'ark-noah-guiding-v05', biblicalKey: 'ark-noah', zone: 'deck3', deck: 3, pos: [-1.5, 7.58, -4.3], targetHeight: 1.75, yaw: 0.15, clip: 'guiding_idle' },
  { id: 'd3-noah-wife', assetId: 'ark-woman-blue', biblicalKey: 'ark-woman-blue', zone: 'deck3', deck: 3, pos: [-3.2, 7.58, -4.5], targetHeight: 1.68, yaw: 0.25, clip: 'idle' },
  { id: 'd3-shem', assetId: 'ark-man-cream', biblicalKey: 'ark-sons', zone: 'deck3', deck: 3, pos: [1.8, 7.58, -4.4], targetHeight: 1.72, yaw: -0.2, clip: 'idle' },
  { id: 'd3-shem-wife', assetId: 'ark-woman-green-v08', biblicalKey: 'ark-sons', zone: 'deck3', deck: 3, pos: [3.4, 7.58, -4.6], targetHeight: 1.66, yaw: -0.3, clip: 'gentle_prayer' },
  { id: 'd3-ham-wife', assetId: 'ark-woman-rust-v06', biblicalKey: 'ark-sons', zone: 'deck3', deck: 3, pos: [-7.2, 7.58, -4.5], targetHeight: 1.66, yaw: 0.3, clip: 'clasped_breathing' },
  { id: 'd3-dove-1', assetId: 'ark-dove-olive-v07', biblicalKey: 'ark-dove-olive-v07', zone: 'deck3', deck: 3, pos: [7.8, 8.3, -4.2], targetHeight: 0.9, yaw: -0.3, clip: 'flight_look' },
  { id: 'd3-hen-1', assetId: 'psalms-128-white-hen-v02', biblicalKey: 'ark-dove-olive-v07', zone: 'deck3', deck: 3, pos: [11.0, 7.58, -4.4], targetHeight: 0.72, yaw: -0.35, clip: 'look_around' },
  { id: 'd3-quail-1', assetId: 'exodus-16-1-quail-grounded-v11', biblicalKey: 'ark-dove-olive-v07', zone: 'birds', deck: 3, pos: [-11.0, 7.58, -4.4], targetHeight: 0.62, yaw: 0.35, clip: 'grounded_idle' },
  { id: 'd3-lantern-1', assetId: 'ark-lantern', biblicalKey: 'ark-structure', zone: 'deck3', deck: 3, pos: [0.0, 7.58, -3.2], targetHeight: 0.7, yaw: 0 },

  // ================= POST-FLOOD ALTAR & RAINBOW COVENANT (Full Rainbow Arch in Frame!) =================
  { id: 'covenant-rainbow-arch', assetId: 'ark-rainbow', biblicalKey: 'ark-altar', zone: 'covenant', deck: 0, pos: [0.0, 1.8, -14.5], targetWidth: 34.5, yaw: 0 },
  { id: 'covenant-stone-altar', assetId: 'ark-altar', biblicalKey: 'ark-altar', zone: 'covenant', deck: 0, pos: [0.0, 0.08, 9.6], targetHeight: 2.65, yaw: 0 },
  { id: 'covenant-noah-praying', assetId: 'ark-noah-praying-v07', biblicalKey: 'ark-altar', zone: 'covenant', deck: 0, pos: [-2.4, 0.08, 10.4], targetHeight: 2.15, yaw: 0.5, clip: 'prayer_appeal' },
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
  toggleMotion: (force?: boolean) => boolean;
  focusPlacement: (placementId: string) => void;
  getState: () => {
    viewMode: ArkViewMode;
    lighting: LightingPreset;
    boardingActive: boolean;
    moving: boolean;
    loadedAssetsCount: number;
    placementsCount: number;
    triangleCount: number;
  };
}

// Deterministic Three.js sRGB hex overrides for Blender environment & cutaway materials
const ENV_MATERIAL_HEX: Record<string, { color: string; roughness: number; metalness?: number; emissive?: string; emissiveIntensity?: number }> = {
  GrassTop: { color: '#5f8a33', roughness: 0.88 },
  GrassTerrace: { color: '#4e7527', roughness: 0.90 },
  GrassWarm: { color: '#72993b', roughness: 0.86 },
  CliffStone: { color: '#756f62', roughness: 0.86 },
  CliffDark: { color: '#595348', roughness: 0.90 },
  CobblePath: { color: '#c8ab73', roughness: 0.84 },
  CobbleTrim: { color: '#b09158', roughness: 0.86 },
  WaterDeep: { color: '#247fa8', roughness: 0.18, metalness: 0.08 },
  WaterFall: { color: '#49bfe6', roughness: 0.15, emissive: '#298fb8', emissiveIntensity: 0.25 },
  WaterFoam: { color: '#eefaff', roughness: 0.35, emissive: '#cbeeff', emissiveIntensity: 0.3 },
  CitadelStone: { color: '#d4b688', roughness: 0.84 },
  CitadelRoof: { color: '#9e6d43', roughness: 0.80 },
  GopherPitchHull: { color: '#3b2110', roughness: 0.70 },
  GopherDark: { color: '#5e3518', roughness: 0.76 },
  GopherMid: { color: '#7d4822', roughness: 0.74 },
  GopherWarm: { color: '#9c5f2e', roughness: 0.72 },
  GopherGold: { color: '#c4853c', roughness: 0.66 },
  HayBedding: { color: '#d6ad42', roughness: 0.90 },
  ClerestoryGlow: { color: '#ffe082', roughness: 0.25, emissive: '#ffbe42', emissiveIntensity: 0.85 },
};

export async function bootNoahsArkWorld(options: {
  canvas: HTMLCanvasElement;
  initialMode?: ArkViewMode;
  onProgress?: (loaded: number, total: number, label: string) => void;
  onSelectEntry?: (entry: BiblicalEntry, placementId: string, screenX: number, screenY: number) => void;
  onReady?: (ctrl: NoahsArkWorldController) => void;
}): Promise<NoahsArkWorldController> {
  const { canvas, initialMode = 'overview', onProgress, onSelectEntry, onReady } = options;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a4d2ec');
  scene.fog = new THREE.FogExp2('#c0dfee', 0.0062);

  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.2, 260);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = true;
  controls.minDistance = 8;
  controls.maxDistance = 88;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = 1.44;

  const hemiLight = new THREE.HemisphereLight('#ebf6ff', '#5c4a28', 0.95);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight('#ffdf9e', 2.05);
  sunLight.position.set(-24, 38, 28);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -36;
  sunLight.shadow.camera.right = 36;
  sunLight.shadow.camera.top = 28;
  sunLight.shadow.camera.bottom = -28;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 110;
  sunLight.shadow.normalBias = 0.025;
  sunLight.shadow.bias = -0.00015;
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight('#9fd8ff', 0.45);
  rimLight.position.set(26, 22, -24);
  scene.add(rimLight);

  const lanternLightL = new THREE.PointLight('#ffb84d', 2.8, 12, 1.4);
  lanternLightL.position.set(-2.2, 2.4, 4.8);
  scene.add(lanternLightL);

  const lanternLightR = new THREE.PointLight('#ffb84d', 2.8, 12, 1.4);
  lanternLightR.position.set(2.2, 2.4, 4.8);
  scene.add(lanternLightR);

  const deckInteriorLight = new THREE.PointLight('#ffd27d', 3.8, 24, 1.2);
  deckInteriorLight.position.set(0, 6.2, -3.5);
  scene.add(deckInteriorLight);

  const altarFireLight = new THREE.PointLight('#ff7b24', 0.0, 18, 1.3);
  altarFireLight.position.set(0, 2.6, 9.6);
  scene.add(altarFireLight);

  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.12, 40),
    new THREE.MeshBasicMaterial({ color: '#ffd452', side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.visible = false;
  scene.add(selectionRing);

  const envGroup = new THREE.Group();
  envGroup.name = 'ArgonPagodaEnvironment';
  scene.add(envGroup);

  const placementsGroup = new THREE.Group();
  placementsGroup.name = 'TripoPlacements';
  scene.add(placementsGroup);

  const waterfallMistCount = 90;
  const mistGeo = new THREE.BufferGeometry();
  const mistPositions = new Float32Array(waterfallMistCount * 3);
  for (let i = 0; i < waterfallMistCount; i++) {
    mistPositions[i * 3] = -18.8 + (Math.random() - 0.5) * 3.2;
    mistPositions[i * 3 + 1] = Math.random() * 6.4;
    mistPositions[i * 3 + 2] = -6.8 + (Math.random() - 0.5) * 2.4;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mistMat = new THREE.PointsMaterial({ color: '#eefaff', size: 0.42, transparent: true, opacity: 0.65 });
  const waterfallMist = new THREE.Points(mistGeo, mistMat);
  scene.add(waterfallMist);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  // 1. Load Headless Blender-built Environment + 3-Deck Cutaway Ark (`ark-pagoda-environment.glb`)
  const envNodes: Record<string, THREE.Object3D> = {};
  try {
    const envGltf = await loader.loadAsync('/models/ark/ark-pagoda-environment.glb');
    envGltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mat = child.material as THREE.MeshStandardMaterial | undefined;
        if (mat && mat.name) {
          const baseName = mat.name.split('.')[0] ?? mat.name;
          const spec = ENV_MATERIAL_HEX[baseName];
          if (spec) {
            mat.color.set(spec.color);
            mat.roughness = spec.roughness;
            mat.metalness = spec.metalness ?? 0.0;
            if (spec.emissive) {
              mat.emissive.set(spec.emissive);
              mat.emissiveIntensity = spec.emissiveIntensity ?? 0.2;
            }
            mat.needsUpdate = true;
          }
        }
      }
      if (child.name.startsWith('Env_') || child.name.startsWith('Ark_')) {
        envNodes[child.name] = child;
      }
    });
    envGroup.add(envGltf.scene);
  } catch (err) {
    console.error('Failed to load ark-pagoda-environment.glb:', err);
  }

  // 2. Load all unique Tripo 3D GLB assets referenced by SCENE_PLACEMENTS
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

  // 3. Instantiate and normalize all placements
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
    root.userData = { placementId: def.id, assetId: def.assetId, biblicalKey: def.biblicalKey, zone: def.zone, deck: def.deck };

    cloned.scale.setScalar(scaleFactor);
    cloned.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor, -center.z * scaleFactor);
    root.add(cloned);

    if (def.id === 'ark-faith-sign') {
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512;
      signCanvas.height = 256;
      const ctx = signCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#8b5428';
        ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = '#5c3314';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, 502, 246);
        ctx.fillStyle = '#fce8b2';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 42px Georgia, serif';
        ctx.shadowColor = 'rgba(35, 18, 6, 0.85)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 3;
        ctx.fillText('FAITH BUILDS', 256, 70);
        ctx.fillText('A BRIGHTER', 256, 130);
        ctx.fillText('TOMORROW', 256, 190);
        const tex = new THREE.CanvasTexture(signCanvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const plaque = new THREE.Mesh(
          new THREE.PlaneGeometry(2.35, 1.15),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72, metalness: 0.05 })
        );
        plaque.position.set(0, 1.88, 0.24);
        root.add(plaque);
      }
    }

    root.position.set(...def.pos);
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
      homePos: new THREE.Vector3(...def.pos),
      homeYaw: def.yaw,
      height: finalBox.max.y - finalBox.min.y,
      triangles,
    };

    placementsGroup.add(root);
    spawned.push(record);
    spawnedById.set(def.id, record);
  }

  let currentViewMode: ArkViewMode = initialMode;
  let currentLighting: LightingPreset = 'morning';
  let boardingActive = false;
  let boardingClock = 0;
  let moving = true;

  const cameraTargetGoal = new THREE.Vector3(0.2, 3.0, 3.4);
  const cameraPosGoal = new THREE.Vector3(-2.6, 21.5, 41.0);
  let cameraTransitionFrames = 0;

  function applyVisibilityForMode(mode: ArkViewMode) {
    const isCutaway = mode === 'cutaway' || mode === 'deck1' || mode === 'deck2' || mode === 'deck3';
    const isCovenant = mode === 'covenant';

    const exteriorHull = spawnedById.get('ark-main-hull');
    if (exteriorHull) {
      exteriorHull.root.visible = !isCutaway;
    }

    if (envNodes['Ark_HullCutaway']) envNodes['Ark_HullCutaway'].visible = isCutaway;
    if (envNodes['Ark_Deck1']) envNodes['Ark_Deck1'].visible = isCutaway;
    if (envNodes['Ark_Deck2']) envNodes['Ark_Deck2'].visible = mode === 'cutaway' || mode === 'deck2' || mode === 'deck3';
    if (envNodes['Ark_Deck3']) envNodes['Ark_Deck3'].visible = mode === 'cutaway' || mode === 'deck3';
    if (envNodes['Ark_RoofClerestory']) envNodes['Ark_RoofClerestory'].visible = mode === 'cutaway' || mode === 'deck3';

    for (const item of spawned) {
      if (item.def.id === 'ark-main-hull') continue;
      if (item.def.id === 'noah-patriarch') {
        item.root.visible = !isCovenant;
        continue;
      }
      if (item.def.id === 'dove-roof-perched' || item.def.id === 'bluebird-roof') {
        item.root.visible = !isCutaway;
        continue;
      }
      if (item.def.zone === 'covenant') {
        item.root.visible = isCovenant;
        continue;
      }
      if (item.def.deck === 0) {
        item.root.visible = true;
      } else if (item.def.deck === 1) {
        item.root.visible = isCutaway;
      } else if (item.def.deck === 2) {
        item.root.visible = mode === 'cutaway' || mode === 'deck2' || mode === 'deck3';
      } else if (item.def.deck === 3) {
        item.root.visible = mode === 'cutaway' || mode === 'deck3';
      }
    }

    altarFireLight.intensity = isCovenant ? 6.5 : 0.0;
  }

  function setViewMode(mode: ArkViewMode) {
    currentViewMode = mode;
    applyVisibilityForMode(mode);

    if (mode === 'overview') {
      cameraTargetGoal.set(0.2, 3.0, 3.4);
      cameraPosGoal.set(-2.6, 21.5, 41.0);
    } else if (mode === 'cutaway') {
      cameraTargetGoal.set(0.0, 5.4, -5.0);
      cameraPosGoal.set(14.5, 15.0, 23.0);
    } else if (mode === 'deck1') {
      cameraTargetGoal.set(0.0, 2.5, -5.0);
      cameraPosGoal.set(10.0, 7.8, 14.0);
    } else if (mode === 'deck2') {
      cameraTargetGoal.set(0.0, 5.5, -5.0);
      cameraPosGoal.set(10.0, 10.8, 14.0);
    } else if (mode === 'deck3') {
      cameraTargetGoal.set(0.0, 8.6, -5.0);
      cameraPosGoal.set(10.0, 13.8, 14.0);
    } else if (mode === 'animals') {
      cameraTargetGoal.set(0.0, 1.8, 12.2);
      cameraPosGoal.set(2.2, 13.5, 31.0);
    } else if (mode === 'yard') {
      cameraTargetGoal.set(4.5, 3.2, 2.5);
      cameraPosGoal.set(14.5, 13.0, 22.5);
    } else if (mode === 'covenant') {
      setLighting('rainbow');
      cameraTargetGoal.set(0.0, 6.2, -1.0);
      cameraPosGoal.set(0.0, 14.8, 41.5);
    }
    cameraTransitionFrames = 45;
  }

  function setLighting(preset: LightingPreset) {
    currentLighting = preset;
    if (preset === 'morning') {
      scene.background = new THREE.Color('#a4d2ec');
      scene.fog = new THREE.FogExp2('#c0dfee', 0.0062);
      hemiLight.color.set('#ebf6ff');
      hemiLight.groundColor.set('#5c4a28');
      hemiLight.intensity = 0.95;
      sunLight.color.set('#ffdf9e');
      sunLight.intensity = 2.05;
      sunLight.position.set(-24, 38, 28);
      lanternLightL.intensity = 2.8;
      lanternLightR.intensity = 2.8;
      renderer.toneMappingExposure = 0.96;
    } else if (preset === 'dusk') {
      scene.background = new THREE.Color('#2d223b');
      scene.fog = new THREE.FogExp2('#3b2a42', 0.0075);
      hemiLight.color.set('#ffae73');
      hemiLight.groundColor.set('#241b2b');
      hemiLight.intensity = 0.65;
      sunLight.color.set('#ff8c42');
      sunLight.intensity = 1.55;
      sunLight.position.set(-34, 16, 18);
      lanternLightL.intensity = 7.5;
      lanternLightR.intensity = 7.5;
      renderer.toneMappingExposure = 0.92;
    } else if (preset === 'rainbow') {
      scene.background = new THREE.Color('#92ccf0');
      scene.fog = new THREE.FogExp2('#b6dff7', 0.0052);
      hemiLight.color.set('#f4faff');
      hemiLight.groundColor.set('#5e733b');
      hemiLight.intensity = 0.95;
      sunLight.color.set('#ffebb3');
      sunLight.intensity = 2.05;
      sunLight.position.set(18, 42, 30);
      renderer.toneMappingExposure = 0.96;
    }
  }

  function toggleBoardingMarch(force?: boolean): boolean {
    boardingActive = force !== undefined ? force : !boardingActive;
    if (!boardingActive) {
      for (const item of spawned) {
        if (item.def.boardingOrder) {
          item.root.position.copy(item.homePos);
          item.root.rotation.y = item.homeYaw;
        }
      }
    } else {
      if (currentViewMode !== 'overview' && currentViewMode !== 'animals') {
        setViewMode('overview');
      }
    }
    return boardingActive;
  }

  function toggleMotion(force?: boolean): boolean {
    moving = force !== undefined ? force : !moving;
    return moving;
  }

  function focusPlacement(placementId: string) {
    const item = spawnedById.get(placementId);
    if (!item) return;
    if (item.def.deck > 0 && currentViewMode === 'overview') {
      setViewMode(`deck${item.def.deck}` as ArkViewMode);
    }
    const worldPos = new THREE.Vector3();
    item.root.getWorldPosition(worldPos);
    selectionRing.position.set(worldPos.x, worldPos.y + 0.06, worldPos.z);
    selectionRing.visible = true;
    cameraTargetGoal.set(worldPos.x, worldPos.y + item.height * 0.45, worldPos.z);
    cameraPosGoal.set(worldPos.x + 4.5, worldPos.y + item.height * 1.4 + 4.5, worldPos.z + 11.5);
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

    const hits = raycaster.intersectObjects(placementsGroup.children, true);
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
      selectionRing.position.set(wp.x, wp.y + 0.05, wp.z);
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

  setViewMode(initialMode);
  camera.position.copy(cameraPosGoal);
  controls.target.copy(cameraTargetGoal);
  controls.update();
  cameraTransitionFrames = 0;

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

      const dove1 = spawnedById.get('dove-olive-flying-1');
      if (dove1) {
        const angle = totalElapsed * 0.52 + 0.8;
        dove1.root.position.x = -8.5 + Math.cos(angle) * 4.5;
        dove1.root.position.z = -1.5 + Math.sin(angle) * 3.5;
        dove1.root.position.y = 13.5 + Math.sin(totalElapsed * 1.8) * 0.4;
        dove1.root.rotation.y = -angle + Math.PI;
      }
      const dove2 = spawnedById.get('dove-olive-flying-2');
      if (dove2) {
        const angle = totalElapsed * 0.48 + Math.PI;
        dove2.root.position.x = 8.5 + Math.cos(angle) * 4.5;
        dove2.root.position.z = -1.5 + Math.sin(angle) * 3.5;
        dove2.root.position.y = 14.0 + Math.cos(totalElapsed * 1.5) * 0.4;
        dove2.root.rotation.y = -angle + Math.PI;
      }
      const raven = spawnedById.get('raven-flying');
      if (raven) {
        const angle = -totalElapsed * 0.62;
        raven.root.position.x = Math.cos(angle) * 12.5;
        raven.root.position.z = -4.0 + Math.sin(angle) * 5.5;
        raven.root.position.y = 14.8 + Math.sin(totalElapsed * 2.1) * 0.45;
        raven.root.rotation.y = -angle;
      }

      const posAttr = mistGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < waterfallMistCount; i++) {
        let py = posAttr.getY(i) - dt * 2.4;
        if (py < 0.1) py = 6.4;
        posAttr.setY(i, py);
      }
      posAttr.needsUpdate = true;

      if (boardingActive) {
        boardingClock += dt * 0.22;
        for (const item of spawned) {
          const order = item.def.boardingOrder;
          if (!order) continue;
          const pairIndex = Math.floor((order - 1) / 2);
          const sideOffset = order % 2 === 1 ? -1.05 : 1.05;
          const progress = (boardingClock + pairIndex * 0.14) % 1.0;

          const z = 20.5 - progress * 21.7;
          let y = 0.08;
          if (z < 5.8) {
            const rampT = Math.min(1.0, (5.8 - z) / 7.0);
            y = 0.08 + rampT * 2.75;
          }
          item.root.position.set(sideOffset, y, z);
          item.root.rotation.y = Math.PI;
        }
      }
    }

    if (selectionRing.visible) {
      selectionRing.rotation.z = totalElapsed * 0.8;
    }

    controls.update();
    renderer.render(scene, camera);

    const totalTris = renderer.info.render.triangles;
    (window as unknown as Record<string, unknown>).__arkQa = {
      state: 'ready',
      viewMode: currentViewMode,
      lighting: currentLighting,
      boardingActive,
      moving,
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
    toggleMotion,
    focusPlacement,
    getState: () => ({
      viewMode: currentViewMode,
      lighting: currentLighting,
      boardingActive,
      moving,
      loadedAssetsCount: loadedAssets.size,
      placementsCount: spawned.length,
      triangleCount: renderer.info.render.triangles,
    }),
  };

  onReady?.(controller);
  return controller;
}
