import type {Locale} from '../locale.ts';
export type StoryId='sailing'|'camp'|'carmel'|'flight'|'whirlwind';
export interface Story {
  title:Record<Locale,string>; ref:string; url:string;
  text:Record<Locale,string>; caveat:Record<Locale,string>;
  phases:Record<Locale,string[]>; duration:number;
}
/** Authored presentation, not a second event ledger or gazetteer. Source text
 * checked 2026-09-15; no new dates, coordinates or approval status are asserted. */
export const STORIES:Record<StoryId,Story>={
  sailing:{title:{en:'Across the sea with Paul',zh:'与保罗一同渡海'},ref:'Acts 13:4–5, 13; 14:25–26',url:'https://biblehub.com/bsb/acts/13.htm',
    text:{en:'Paul and his companions travel by ship on the sea stages. On the globe the vessel moves along the same schematic line as the journey marker; people continue on the land stages.',zh:'保罗与同伴乘船走过海上行程。地图上的船沿同一条行程示意线移动；陆路段则由人物继续行走。'},
    caveat:{en:'Illustrative vessel, dress and passengers, not a recovered ship or a crew count. Inland approaches and modern land along a schematic sea connection hide the vessel; the line is not an exact sailing track.',zh:'船型、服饰和乘客是艺术示意，不是出土船只或人数复原。通往内陆及示意海程经过现代陆地处隐藏船只；连线不是精确航线。'},
    phases:{en:['On board','Under sail','Continuing the voyage'],zh:['乘船','扬帆航行','继续航程']},duration:18},
  camp:{title:{en:'Camp, pack, set out',zh:'安营、收营、起行'},ref:'Numbers 9:17–23; 33:1–49',url:'https://biblehub.com/bsb/numbers/9.htm',
    text:{en:'Numbers 33 records the stages. Numbers 9 describes Israel remaining in camp and setting out when the cloud lifted. Watch the tents rise, the bundles gather, and the people depart.',zh:'民数记33章列出各站，9章描述百姓停留安营、云彩收上去便起行。这里依次表现搭起帐篷、收拾行装、队伍出发。'},
    caveat:{en:'A small symbolic group, not the population or tribal camp layout. Ordinary tents, not the tabernacle. The animation compresses time; camp designs and most exact sites are unknown. Unlocated stages never get a map camp.',zh:'少量人物代表队伍，并非人口或十二支派布局。这里是普通帐篷，不是会幕。动画压缩时间；帐篷形制和多数精确营址未定。未定位营站不放置地图营地。'},
    phases:{en:['Pitching tents','In camp','Packing up','Setting out'],zh:['搭起帐篷','营中停留','收拾行装','队伍起行']},duration:20},
  carmel:{title:{en:'The altar on Mount Carmel',zh:'迦密山上的祭坛'},ref:'1 Kings 18:30–39',url:'https://biblehub.com/bsb/1_kings/18.htm',
    text:{en:'Elijah repairs the altar with twelve stones, arranges the wood and offering, and orders four jars of water poured three times. He prays; Yahweh’s fire consumes the offering, wood, stones, dust and water.',zh:'以利亚用十二块石头重修祭坛，摆好柴和祭物，吩咐用四个桶浇水，重复三次。他祷告，雅伟降火，烧尽祭物、柴、石头、尘土和水。'},
    caveat:{en:'Mount Carmel is named, but the text does not locate the altar on a particular summit. Twelve stones are specified; their arrangement, clothing and the appearance of fire are illustrative. This is not Elijah casting a spell.',zh:'经文指出迦密山，却没有确定祭坛所在山头。十二块石头是明文数字；堆法、服饰和火的外观是艺术示意，不表现为以利亚施法。'},
    phases:{en:['Twelve stones','Water poured three times','Elijah prays','Fire from Yahweh','The altar consumed'],zh:['十二块石头','三次浇水','以利亚祷告','雅伟降火','祭坛焚尽']},duration:22},
  flight:{title:{en:'Elijah’s flight',zh:'以利亚的逃亡'},ref:'1 Kings 18:46; 19:1–8',url:'https://biblehub.com/bsb/1_kings/19.htm',
    text:{en:'Elijah runs ahead of Ahab to Jezreel. After Jezebel’s threat he flees to Beersheba, leaves his servant, and walks a day into the wilderness. Sustained with food and water, he reaches Horeb after forty days and nights.',zh:'以利亚奔到耶斯列，在亚哈前头。耶洗别威胁后，他逃往别是巴，留下仆人，独自进入旷野一日路程；得着饮食后，行走四十昼夜到何烈。'},
    caveat:{en:'The wilderness resting place is unnamed and is not pinned. Horeb’s location is disputed; the existing map uses a traditional regional identification, not proof. The walking figure does not reconstruct the precise trail.',zh:'旷野休息处没有地名，不另造坐标。何烈的位置有争议；地图沿用传统区域考据，并非证明。人物行走不代表已复原精确足迹。'},
    phases:{en:['Leaving danger','Through the wilderness','The journey continues'],zh:['离开险境','走过旷野','继续前行']},duration:18},
  whirlwind:{title:{en:'Elijah & Elisha at the Jordan',zh:'约旦河边的以利亚与以利沙'},ref:'2 Kings 2:1–14',url:'https://biblehub.com/bsb/2_kings/2.htm',
    text:{en:'After Gilgal, Bethel and Jericho, they cross the Jordan on dry ground. A chariot and horses of fire separate them. Elijah ascends in a whirlwind; Elisha remains and picks up the fallen cloak.',zh:'经过吉甲、伯特利、耶利哥后，两人走干地过约旦河。火车火马把他们隔开，以利亚在旋风中升天；以利沙留下，拾起掉落的外衣。'},
    caveat:{en:'The scene begins after the crossing; the precise crossing and ascent sites are not supplied, so no exact event pin is added. The text says whirlwind, not riding the chariot. Two horses and the visual forms are artistic choices; their number is unstated.',zh:'场景从过河后开始；经文未给精确渡口和升天地点，因此不新增精确事件图钉。经文说在旋风中升天，并非乘车升天。两匹马及其外观是艺术选择，原文没有给马的数目。'},
    phases:{en:['Walking together','Chariot and horses separate them','Taken up in the whirlwind','The cloak remains'],zh:['两人同行','火车火马隔开他们','旋风中升天','外衣留下']},duration:22},
};
export const storyOptions=(journeyId:string):StoryId[]=>journeyId.startsWith('paul-')?['sailing']:journeyId==='exodus-wilderness'?['camp']:journeyId==='elijah'?['carmel','flight','whirlwind']:[];
export function phaseIndex(id:StoryId,t:number){return Math.min(STORIES[id].phases.en.length-1,Math.floor(Math.max(0,t)/STORIES[id].duration*STORIES[id].phases.en.length));}
