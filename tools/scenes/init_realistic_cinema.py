#!/usr/bin/env python3
"""Initialize and sync /Volumes/T7/yahwehs-globe-scenes/realistic-cinema-v1/
with:
1. 66 Canonical Biblical Character Anchors + 25 Canonical Location/Structure Anchors
2. 1,443 Event Photorealistic Prompts (Nano Banana 2.1) & Adaptive Video Prompts (Gemini Omni 1.1)
3. Authoritative manifest.json on /Volumes/T7:
   - Never infers status from file existence (preserves existing imageStatus, videoStatus, anchor status).
   - Preserves all unknown/existing fields (evidenceState, imageSha256, provenance, depictsRef, video*, audio, etc.).
   - Reads scripture and section titles/notes exclusively from data/text/ (retiring old sum/sumEn).
   - Uses the canonical men's hair rule and disambiguated character & location anchor assignments.
   - Acquires /Volumes/T7/yahwehs-globe-scenes/locks/manifest.lock before updating manifest.json.
"""
import csv
import json
import os
import re
import sys
import time

REPO_ROOT = "/Users/pliu0036/Documents/CodingProject/yahwehs-globe"
T7_SCENES = "/Volumes/T7/yahwehs-globe-scenes"
T7_ROOT = f"{T7_SCENES}/realistic-cinema-v1"
DEFAULT_CSV_PATH = "/Users/pliu0036/Documents/CodingProject/雅伟之界_1443事件处理清单_2026-10-23.csv"
LOCK_FILE = f"{T7_SCENES}/locks/manifest.lock"
SESSION_ID = os.environ.get("AGY_SESSION_ID", "e928c3d9-e04e-422d-975a-bd74418bb125")

if f"{REPO_ROOT}/data/text" not in sys.path:
    sys.path.insert(0, f"{REPO_ROOT}/data/text")
import textpack as tp  # noqa: E402

HAIR_RULE = (
    "Men: short, natural scissor-cut hair above the collar, varied from person to person; "
    "never shaved, buzz-cut, faded or with shaved sides (Nazirites excepted)."
)

PILOT_12_IDS = [
    "genesis-1-1",
    "genesis-2-1",
    "genesis-6-9",
    "exodus-12-29",
    "exodus-14-1",
    "joshua-10-12",
    "1-samuel-17-1",
    "1-kings-18-1",
    "daniel-6-1",
    "matthew-14-13",
    "john-11-1",
    "revelation-21-1",
]

CHARACTER_ANCHORS = [
    # Creation & Patriarchs
    {"id": "adam", "zh": "亚当", "en": "Adam", "era": "creation", "ref": "Genesis 1:26–2:7", "height": 1.75,
     "desc": "First man, ruddy earth-toned skin, strong natural build, short dark hair above collar and ears, short beard, clothed in simple undyed animal-skin tunic after Eden.",
     "keywords": ["亚当", "Adam"]},
    {"id": "eve", "zh": "夏娃", "en": "Eve", "era": "creation", "ref": "Genesis 2:21–25; 3:20", "height": 1.63,
     "desc": "First woman, warm olive skin, dark wavy hair draped modestly over shoulders, modest undyed woven/skin tunic.",
     "keywords": ["夏娃", "Eve"]},
    {"id": "cain-abel", "zh": "该隐与亚伯", "en": "Cain & Abel", "era": "creation", "ref": "Genesis 4:1–16", "height": 1.73,
     "desc": "Two early Near Eastern brothers with short dark hair above collar and ears: Cain the tiller of the ground in coarse woven tunic, Abel the keeper of fat-tailed sheep in shepherd's woollen wrap.",
     "keywords": ["该隐", "亚伯", "Cain", "Abel"]},
    {"id": "enoch", "zh": "以诺", "en": "Enoch", "era": "creation", "ref": "Genesis 5:21–24", "height": 1.73,
     "desc": "Righteous antediluvian patriarch who walked with God, short dark/silver hair above collar and ears, neatly trimmed beard, undyed woollen robe.",
     "keywords": ["以诺", "Enoch"]},
    {"id": "noah", "zh": "挪亚", "en": "Noah", "era": "patriarch", "ref": "Genesis 6:8–9:29", "height": 1.75,
     "desc": "Broad-shouldered, square-jawed ancient Near Eastern patriarch and master ark-builder, deeply weathered sun-bronzed face, short wavy charcoal-and-iron-grey hair streaked with silver above the collar, full chest-length square-bottomed iron-grey and silver beard (distinct from Moses's shorter rounded snow-white beard), dark walnut-brown work tunic under a heavy rust-terracotta and dark olive-umber woollen coat with wide leather tool belt, holding a wooden shipwright's mallet, hemp rope coil, and carpenter's square.",
     "keywords": ["挪亚", "Noah"]},
    {"id": "abraham", "zh": "亚伯拉罕", "en": "Abraham", "era": "patriarch", "ref": "Genesis 12:1–25:8", "height": 1.73,
     "desc": "Dignified Near Eastern chieftain-patriarch from Ur, deeply weathered bronze face, short grey-white hair above collar, full white beard, earth-toned striped woollen mantle over ankle-length linen tunic, shepherd's staff.",
     "keywords": ["亚伯拉罕", "亚伯兰", "Abraham", "Abram"]},
    {"id": "sarah", "zh": "撒拉", "en": "Sarah", "era": "patriarch", "ref": "Genesis 12:11; 18:9–15", "height": 1.61,
     "desc": "Noble Near Eastern matriarch of striking dignified beauty, modest indigo-and-cream head veil, ankle-length finely woven woollen robe with subtle geometric border.",
     "keywords": ["撒拉", "撒莱", "Sarah", "Sarai"]},
    {"id": "isaac", "zh": "以撒", "en": "Isaac", "era": "patriarch", "ref": "Genesis 21:1–35:29", "height": 1.72,
     "desc": "Gentle contemplative Near Eastern patriarch, short dark/grey hair above collar, short beard, undyed cream woollen tunic and warm ochre cloak.",
     "keywords": ["以撒", "Isaac"]},
    {"id": "rebekah", "zh": "利百加", "en": "Rebekah", "era": "patriarch", "ref": "Genesis 24:15–67", "height": 1.62,
     "desc": "Graceful young Aramean woman from Nahor, modest woven headscarf, terracotta-and-cream ankle-length tunic, carrying an earthenware water jar on her shoulder.",
     "keywords": ["利百加", "Rebekah"]},
    {"id": "jacob", "zh": "雅各（以色列）", "en": "Jacob (Israel)", "era": "patriarch", "ref": "Genesis 25:26–49:33", "height": 1.72,
     "desc": "Resilient Near Eastern shepherd-patriarch, short dark/silver hair above collar, short full beard, weathered pastoral cloak, woven sash, wooden staff.",
     "keywords": ["雅各", "Jacob"]},
    {"id": "rachel", "zh": "拉结", "en": "Rachel", "era": "patriarch", "ref": "Genesis 29:6–18", "height": 1.60,
     "desc": "Young Near Eastern shepherdess, expressive dark eyes, modest linen head covering, soft woollen pastoral dress.",
     "keywords": ["拉结", "Rachel"]},
    {"id": "joseph-patriarch", "zh": "约瑟", "en": "Joseph", "era": "egypt", "ref": "Genesis 37:3; 41:42", "height": 1.74,
     "desc": "Handsome Semitic man with short dark hair above collar and clean-shaven or neatly trimmed beard; in Canaan wearing an ornate multi-colored woven tunic, in Egypt wearing fine white pleated linen robe, gold collar and signet ring.",
     "keywords": ["约瑟", "Joseph"]},
    # Exodus & Conquest
    {"id": "moses", "zh": "摩西", "en": "Moses", "era": "exodus", "ref": "Exodus 3:1–34:30", "height": 1.72,
     "desc": "Elderly but vigorous 80-year-old Hebrew prophet, short white hair above the collar, short full white beard, plain undyed woollen robe with woven sash, leather sandals, holding the plain wooden rod of God.",
     "keywords": ["摩西", "Moses"]},
    {"id": "aaron-high-priest", "zh": "大祭司亚伦", "en": "Aaron the High Priest", "era": "exodus", "ref": "Exodus 28:4–38", "height": 1.72,
     "desc": "Bearded Hebrew High Priest in exact Exodus 28 vestments: white linen tunic, sleeveless blue robe with gold bells and pomegranates at hem, gold-blue-purple-scarlet ephod with onyx shoulder clasps, square breastpiece with 12 gemstones in 4 rows of 3, white linen turban with pure gold plate on forehead, barefoot, short grey hair above collar.",
     "keywords": ["亚伦", "大祭司", "Aaron", "High Priest"]},
    {"id": "miriam", "zh": "米利暗", "en": "Miriam", "era": "exodus", "ref": "Exodus 15:20", "height": 1.60,
     "desc": "Older Hebrew prophetess, modest woven head covering, ankle-length linen robe, holding a hand-frame timbrel (tambourine).",
     "keywords": ["米利暗", "Miriam"]},
    {"id": "pharaoh-exodus", "zh": "出埃及法老", "en": "Pharaoh of the Exodus", "era": "egypt", "ref": "Exodus 5:1–14:28", "height": 1.74,
     "desc": "Ancient Egyptian New Kingdom Pharaoh, blue-and-gold Nemes royal headdress or Khepresh crown, broad gold/lapis collar, pleated white royal linen shendyt kilt, clean-shaven, bronze skin.",
     "keywords": ["法老", "Pharaoh"]},
    {"id": "joshua", "zh": "约书亚", "en": "Joshua", "era": "conquest", "ref": "Joshua 1:1–24:29", "height": 1.74,
     "desc": "Seasoned Hebrew commander, short dark/grey hair above collar, short beard, leather-and-bronze breastplate over woollen tunic, bronze sword at hip, leather sandals.",
     "keywords": ["约书亚", "Joshua"]},
    {"id": "caleb", "zh": "迦勒", "en": "Caleb", "era": "conquest", "ref": "Numbers 13:30; Joshua 14:10–11", "height": 1.73,
     "desc": "Vigorous faithful warrior of Judah, short hair above collar, short beard, bronze-age leather tunic and wooden shield.",
     "keywords": ["迦勒", "Caleb"]},
    {"id": "rahab", "zh": "喇合", "en": "Rahab", "era": "conquest", "ref": "Joshua 2:1–21", "height": 1.61,
     "desc": "Canaanite woman of Jericho, modest woven robe and head veil, holding a scarlet cord by a mud-brick city-wall window.",
     "keywords": ["喇合", "Rahab"]},
    # Judges & Ruth
    {"id": "deborah", "zh": "底波拉", "en": "Deborah", "era": "judges", "ref": "Judges 4:4–5", "height": 1.62,
     "desc": "Matronly prophetess and judge of Israel, dignified dark blue and undyed woollen mantle, seated beneath a date palm in Ephraim.",
     "keywords": ["底波拉", "Deborah"]},
    {"id": "gideon", "zh": "基甸", "en": "Gideon", "era": "judges", "ref": "Judges 6:11–8:28", "height": 1.73,
     "desc": "Israelite leader of Manasseh, short dark hair above collar, short beard, coarse woollen tunic, holding a clay pitcher, torch, and ram's horn shofar.",
     "keywords": ["基甸", "Gideon"]},
    {"id": "samson", "zh": "参孙（拿细耳人）", "en": "Samson (Nazarite)", "era": "judges", "ref": "Judges 13:5; 16:17", "height": 1.85,
     "desc": "Powerfully muscled Danite Nazarite — explicit scriptural exception with seven braided locks of hair (Judges 16:13,19), full beard, rough linen tunic and leather belt.",
     "keywords": ["参孙", "Samson"]},
    {"id": "ruth", "zh": "路得", "en": "Ruth", "era": "judges", "ref": "Ruth 1:16–4:13", "height": 1.60,
     "desc": "Humble young woman of Moab, modest earth-toned ankle-length gleaner's dress, linen head covering, carrying bundled stalks of golden barley.",
     "keywords": ["路得", "Ruth"]},
    {"id": "boaz", "zh": "波阿斯", "en": "Boaz", "era": "judges", "ref": "Ruth 2:1–4:13", "height": 1.74,
     "desc": "Kind, honorable elder landowner of Bethlehem, short greying hair above collar, neatly trimmed beard, fine woven woollen robe and cloak.",
     "keywords": ["波阿斯", "Boaz"]},
    {"id": "hannah", "zh": "哈拿", "en": "Hannah", "era": "judges", "ref": "1 Samuel 1:9–2:10", "height": 1.60,
     "desc": "Devout Israelite mother in earnest prayer at Shiloh, modest deep-blue and cream linen robe and head veil.",
     "keywords": ["哈拿", "Hannah"]},
    # United & Divided Monarchy
    {"id": "samuel", "zh": "撒母耳", "en": "Samuel", "era": "monarchy", "ref": "1 Samuel 3:19–25:1", "height": 1.71,
     "desc": "Venerable prophet and judge of Israel, short white hair above collar, white beard, linen ephod over a long woven robe (1 Sam 2:18; 15:27), carrying a horn of anointing oil.",
     "keywords": ["撒母耳", "Samuel"]},
    {"id": "saul", "zh": "扫罗王", "en": "King Saul", "era": "monarchy", "ref": "1 Samuel 9:2; 10:23", "height": 1.95,
     "desc": "Unusually tall, well-built Israelite king — a full head and shoulders taller than everyone else in the scene (1.95m, 1 Sam 9:2). Short dark hair above collar, short beard, royal blue-and-crimson woollen robe, simple gold circlet, bronze spear.",
     "keywords": ["扫罗", "Saul"]},
    {"id": "david-youth", "zh": "少年牧童大卫", "en": "Young Shepherd David", "era": "monarchy", "ref": "1 Samuel 16:12; 17:40", "height": 1.68,
     "desc": "Ruddy, bright-eyed teenage Bethlehem shepherd, short dark hair above the collar, clean-shaven, simple undyed knee-length shepherd's tunic, leather scrip with five smooth brook stones, leather sling in hand, wooden staff.",
     "keywords": ["牧童大卫", "少年大卫"]},
    {"id": "david-king", "zh": "大卫王", "en": "King David", "era": "monarchy", "ref": "2 Samuel 5:1–24:25", "height": 1.73,
     "desc": "Ruddy, noble King of Israel, short dark/silver hair above the collar, short trimmed beard, royal crimson-and-linen robe, simple gold crown, often with a 10-stringed wooden kinnor lyre.",
     "keywords": ["大卫", "David"]},
    {"id": "goliath", "zh": "歌利亚", "en": "Goliath of Gath", "era": "monarchy", "ref": "1 Samuel 17:4–7", "height": 2.97,
     "desc": "Giant Philistine champion standing six cubits and a span (2.97m) — towering over normal men. Bronze helmet, heavy bronze scale-mail coat to knees, bronze greaves on shins, bronze javelin between shoulders, massive spear with shaft like a weaver's beam, short dark hair and short beard.",
     "keywords": ["歌利亚", "Goliath"]},
    {"id": "jonathan", "zh": "约拿单", "en": "Jonathan", "era": "monarchy", "ref": "1 Samuel 14:1; 18:4", "height": 1.76,
     "desc": "Brave young prince of Israel, short dark hair above collar, short beard, prince's robe, belt, bow and bronze sword.",
     "keywords": ["约拿单", "Jonathan"]},
    {"id": "solomon", "zh": "所罗门王", "en": "King Solomon", "era": "monarchy", "ref": "1 Kings 1:39–11:43", "height": 1.73,
     "desc": "Wise and regal King of Israel, short dark hair above collar, neatly trimmed short beard, fine white linen and Tyrian purple-and-gold embroidered royal mantle, simple gold crown.",
     "keywords": ["所罗门", "Solomon"]},
    {"id": "elijah", "zh": "先知以利亚", "en": "Prophet Elijah", "era": "prophets", "ref": "2 Kings 1:8; 1 Kings 17–19", "height": 1.72,
     "desc": "Weathered middle-aged Tishbite prophet, rough undyed coarse hair-cloth mantle over plain tunic, wide leather belt around his waist (2 Kings 1:8), short dark hair above collar, short full beard, bare feet or dusty sandals.",
     "keywords": ["以利亚", "Elijah"]},
    {"id": "elisha", "zh": "先知以利沙", "en": "Prophet Elisha", "era": "prophets", "ref": "2 Kings 2:13, 23", "height": 1.70,
     "desc": "Bald-headed Near Eastern prophet (completely bald crown with short fringe at sides per 2 Kings 2:23), short dark beard, wearing Elijah's coarse woollen mantle over a plain tunic with leather belt.",
     "keywords": ["以利沙", "Elisha"]},
    {"id": "hezekiah", "zh": "希西家王", "en": "King Hezekiah", "era": "prophets", "ref": "2 Kings 18–20", "height": 1.73,
     "desc": "Righteous King of Judah, short dark hair above collar, short beard, royal Judean robe or humble sackcloth in prayer before Yahweh in the Temple.",
     "keywords": ["希西家", "Hezekiah"]},
    {"id": "josiah", "zh": "约西亚王", "en": "King Josiah", "era": "prophets", "ref": "2 Kings 22–23", "height": 1.73,
     "desc": "Young reforming King of Judah, short dark hair above collar, short beard, Judean royal garments, reading the Book of the Law.",
     "keywords": ["约西亚", "Josiah"]},
    # Major & Minor Prophets & Exile
    {"id": "isaiah", "zh": "先知以赛亚", "en": "Prophet Isaiah", "era": "prophets", "ref": "Isaiah 1:1; 6:1–8", "height": 1.71,
     "desc": "Dignified Jerusalem prophet, short greying hair above collar, short beard, long linen tunic and dark woollen prophetic cloak, holding a leather scroll.",
     "keywords": ["以赛亚", "Isaiah"]},
    {"id": "jeremiah", "zh": "先知耶利米", "en": "Prophet Jeremiah", "era": "prophets", "ref": "Jeremiah 1:1–52:34", "height": 1.71,
     "desc": "Sorrowful weeping prophet of Anathoth, short hair above collar, short beard, dusty plain woollen robe, sometimes wearing a wooden yoke on his neck (Jer 27:2).",
     "keywords": ["耶利米", "Jeremiah"]},
    {"id": "ezekiel", "zh": "先知以西结", "en": "Prophet Ezekiel", "era": "exile", "ref": "Ezekiel 1:1–48:35", "height": 1.71,
     "desc": "Priest-prophet by the Kebar river in Babylon, short dark hair above collar, short beard, plain linen priestly tunic.",
     "keywords": ["以西结", "Ezekiel"]},
    {"id": "daniel", "zh": "但以理", "en": "Daniel", "era": "exile", "ref": "Daniel 1:4–6:28", "height": 1.72,
     "desc": "Noble Judean statesman and prophet in Babylon/Persia (both as wise young Judean exile and as dignified 80-year-old elder in Daniel 6), short hair above collar, neatly trimmed beard, fine Babylonian/Persian court robe in deep blue and gold.",
     "keywords": ["但以理", "Daniel"]},
    {"id": "nebuchadnezzar", "zh": "尼布甲尼撒王", "en": "King Nebuchadnezzar", "era": "exile", "ref": "Daniel 2:1–4:37", "height": 1.75,
     "desc": "Neo-Babylonian monarch in tiered royal mitre crown, richly fringed lapis-blue and gold embroidered robe, square-cut curled beard (or in Dan 4:33 humbled in the field with matted hair).",
     "keywords": ["尼布甲尼撒", "Nebuchadnezzar"]},
    {"id": "esther", "zh": "以斯帖王后", "en": "Queen Esther", "era": "exile", "ref": "Esther 2:17; 5:1", "height": 1.62,
     "desc": "Jewish Queen of Persia, modest royal Achaemenid court attire in fine cream, royal blue and gold, delicate gold diadem over head veil.",
     "keywords": ["以斯帖", "Esther"]},
    {"id": "mordecai", "zh": "末底改", "en": "Mordecai", "era": "exile", "ref": "Esther 2:5; 8:15", "height": 1.71,
     "desc": "Older Jewish elder in Susa, short grey hair above collar, short beard, wearing royal blue-and-white Persian court robes (Esth 8:15).",
     "keywords": ["末底改", "Mordecai"]},
    {"id": "ezra", "zh": "文士以斯拉", "en": "Ezra the Scribe", "era": "exile", "ref": "Ezra 7:6–8:36", "height": 1.70,
     "desc": "Priest and scribe of the Law, short greying hair above collar, short beard, white linen tunic and woollen mantle, holding an open Torah scroll.",
     "keywords": ["以斯拉", "Ezra"]},
    {"id": "nehemiah", "zh": "省长尼希米", "en": "Nehemiah", "era": "exile", "ref": "Nehemiah 1:1–13:31", "height": 1.73,
     "desc": "Practical builder-governor of Jerusalem, short dark hair above collar, short beard, travel cloak over work tunic, overseeing stone masons.",
     "keywords": ["尼希米", "Nehemiah"]},
    {"id": "job", "zh": "约伯", "en": "Job", "era": "patriarch", "ref": "Job 1:1–42:17", "height": 1.71,
     "desc": "Righteous man of Uz, short grey hair above collar, short beard, either in dignified patriarchal woollen robes or seated humbly in coarse sackcloth among ashes.",
     "keywords": ["约伯", "Job"]},
    {"id": "jonah", "zh": "先知约拿", "en": "Prophet Jonah", "era": "prophets", "ref": "Jonah 1:1–4:11", "height": 1.71,
     "desc": "Hebrew prophet, short dark hair above collar, short beard, weathered woollen travel tunic and cloak.",
     "keywords": ["约拿", "Jonah"]},
    # New Testament — Gospels & Acts
    {"id": "jesus", "zh": "主耶稣", "en": "Lord Jesus", "era": "nt", "ref": "Matthew–Revelation; 1 Cor 11:14", "height": 1.73,
     "desc": f"First-century Jewish man in his early thirties, warm olive-bronze Middle Eastern complexion, deep dark-brown eyes beneath a slightly deep-set brow ridge, a deep, steadfast, gentle, and weighty gaze (not a posed smile), fuller well-bodied naturally shaped dark beard (not a thin short layer), short natural wavy scissor-cut dark hair strictly above the collar with ears visible (never shoulder-length long hair; {HAIR_RULE}), wearing an unbleached white/natural coarse-woven tunic with authentic fabric texture and a natural mantle (tallit) with blue border stripes and corner tassels (tzitzit), leather sandals, lit with warm directional side light for facial depth and warmth.",
     "keywords": ["耶稣", "基督", "人子", "主耶稣", "Jesus", "Christ"]},
    {"id": "mary-mother", "zh": "马利亚（耶稣之母）", "en": "Mary (Mother of Jesus)", "era": "nt", "ref": "Luke 1:27–2:51; Acts 1:14", "height": 1.60,
     "desc": "Humble first-century Jewish woman of Nazareth, modest deep-blue and earth-toned woollen dress and linen head covering draped over shoulders.",
     "keywords": ["马利亚", "Mary"]},
    {"id": "joseph-carpenter", "zh": "木匠约瑟", "en": "Joseph of Nazareth", "era": "nt", "ref": "Matthew 1:18–2:23", "height": 1.72,
     "desc": "Righteous first-century Jewish carpenter, short dark hair above collar, short beard, coarse brown woollen work tunic and mantle, leather sandals, wooden staff.",
     "keywords": ["约瑟", "Joseph"]},
    {"id": "john-baptist", "zh": "施洗约翰", "en": "John the Baptist", "era": "nt", "ref": "Matthew 3:4", "height": 1.71,
     "desc": "Lean wilderness prophet by the Jordan River, short dark hair above the collar, short beard, rough tan camel-hair garment with a wide leather belt around his waist (Matt 3:4), bare feet.",
     "keywords": ["施洗约翰", "John the Baptist"]},
    {"id": "peter", "zh": "使徒彼得", "en": "Apostle Peter", "era": "nt", "ref": "Matthew 4:18; Acts 2:14", "height": 1.72,
     "desc": "Sturdy Galilean fisherman-apostle, weathered face, short curly grey-streaked dark hair above collar, short thick beard, plain undyed tunic and rustic earth-brown cloak.",
     "keywords": ["彼得", "西门彼得", "矶法", "Peter", "Cephas"]},
    {"id": "john-apostle", "zh": "使徒约翰", "en": "Apostle John", "era": "nt", "ref": "John 13:23; Revelation 1:9", "height": 1.71,
     "desc": "Youngest apostle in the Gospels (early twenties, short dark hair above collar, clean-shaven or light beard, warm tunic) and elderly white-bearded short-haired apostle on Patmos in Revelation.",
     "keywords": ["使徒约翰", "约翰", "John"]},
    {"id": "paul", "zh": "使徒保罗", "en": "Apostle Paul", "era": "nt", "ref": "Acts 9:1–28:31", "height": 1.68,
     "desc": "Intense, energetic first-century Jewish apostle of Tarsus, receding short dark/grey hair above collar, short full beard, weathered travel-stained tunic and cloak, often holding a reed pen and parchment scroll.",
     "keywords": ["保罗", "扫罗", "Paul"]},
    {"id": "stephen", "zh": "司提反", "en": "Stephen", "era": "nt", "ref": "Acts 6:5–7:60", "height": 1.72,
     "desc": "Young first-century Jewish deacon in Jerusalem, face shining like an angel's, short dark hair above collar, plain white-cream linen tunic.",
     "keywords": ["司提反", "Stephen"]},
    {"id": "timothy", "zh": "提摩太", "en": "Timothy", "era": "nt", "ref": "Acts 16:1; 1 Timothy 4:12", "height": 1.72,
     "desc": "Young faithful co-worker of Paul, short dark hair above collar, light beard, simple first-century Greco-Roman/Jewish tunic and travel cloak.",
     "keywords": ["提摩太", "Timothy"]},
    {"id": "zacchaeus", "zh": "撒该", "en": "Zacchaeus", "era": "nt", "ref": "Luke 19:2–3", "height": 1.48,
     "desc": "Short-statured adult Jewish chief tax collector of Jericho (1.48m per Luke 19:3), short dark hair above collar, short beard, fine dyed robe with embroidered border.",
     "keywords": ["撒该", "Zacchaeus"]},
    # Generic Period Archetypes & Creatures
    {"id": "levite-priest", "zh": "祭司与利未人", "en": "Israelite Priest / Levite", "era": "ot", "ref": "Exodus 28:40–42; Ezekiel 44:20", "height": 1.70,
     "desc": "Israelite priest in white linen ankle-length coat, woven sash of blue-purple-scarlet, white linen head wrap, barefoot, short, natural scissor-cut hair above the collar.",
     "keywords": ["祭司", "利未", "priest", "Levite"]},
    {"id": "soldier-egyptian", "zh": "古埃及兵", "en": "Ancient Egyptian Soldier", "era": "egypt", "ref": "Exodus 14:7", "height": 1.72,
     "desc": "New Kingdom Egyptian soldier, white linen kilt, striped headcloth, bronze khopesh sword, wooden shield, leather sandals.",
     "keywords": ["埃及军", "埃及追兵", "法老的车辆", "Egyptian army", "chariots of Pharaoh"]},
    {"id": "soldier-philistine", "zh": "非利士兵", "en": "Philistine Warrior", "era": "monarchy", "ref": "1 Samuel 4–31", "height": 1.74,
     "desc": "Iron Age Philistine warrior, feathered headband, bronze-studded leather corselet, round shield, bronze/iron spear, short hair.",
     "keywords": ["非利士", "Philistine"]},
    {"id": "soldier-assyrian", "zh": "亚述兵", "en": "Assyrian Soldier", "era": "prophets", "ref": "2 Kings 17–19", "height": 1.73,
     "desc": "Neo-Assyrian soldier, pointed conical bronze helmet, scale armor tunic, round bronze shield, laced boots, square-cut beard.",
     "keywords": ["亚述", "Assyria"]},
    {"id": "soldier-babylonian", "zh": "迦勒底（巴比伦）兵", "en": "Babylonian Soldier", "era": "exile", "ref": "2 Kings 25; Daniel 1–5", "height": 1.73,
     "desc": "Neo-Babylonian soldier, bronze helmet, fringed tunic under scale corselet, bow and spear.",
     "keywords": ["巴比伦军", "迦勒底", "Chaldean"]},
    {"id": "soldier-roman", "zh": "第一世纪罗马兵", "en": "First-Century Roman Soldier", "era": "nt", "ref": "Matthew 27; Acts 10; 21–28", "height": 1.72,
     "desc": "First-century Roman legionary/centurion (ONLY in New Testament events!), segmented iron lorica segmentata over red tunic, galea helmet, rectangular scutum shield, hobnailed caligae sandals, clean-shaven with short hair.",
     "keywords": ["百夫长", "千夫长", "罗马兵", "兵丁", "centurion", "Roman soldier"]},
    {"id": "fat-tailed-sheep", "zh": "近东肥尾绵羊与羊羔", "en": "Near Eastern Fat-Tailed Sheep", "era": "all", "ref": "Leviticus 3:9; Exodus 12:5", "height": 0.86,
     "desc": "Authentic Near Eastern fat-tailed sheep and yearling Passover lamb with creamy wool and heavy fat rump/tail (Lev 3:9).",
     "keywords": ["羊群", "绵羊", "羊羔", "牧羊", "逾越节的羊", "sheep", "flock"]},
    {"id": "angel-messenger", "zh": "雅伟的使者（天使）", "en": "Angel of Yahweh", "era": "all", "ref": "Genesis 18; Luke 1; Matthew 28:3", "height": 1.82,
     "desc": "Majestic, awe-inspiring heavenly messenger in radiant pure white linen garments, short hair above collar, surrounded by warm golden-white light.",
     "keywords": ["使者", "天使", "基路伯", "撒拉弗", "angel", "cherubim", "seraphim"]},
    {"id": "twelve-apostles", "zh": "十二使徒群体", "en": "The Twelve Apostles", "era": "nt", "ref": "Matthew 10:1–4; Acts 1:13", "height": 1.72,
     "desc": "Twelve first-century Galilean Jewish men, ALL with short, natural scissor-cut hair above the collar (1 Cor 11:14), short beards, authentic first-century undyed and earth-toned woollen tunics and mantles, leather sandals.",
     "keywords": ["门徒", "十二门徒", "十二使徒", "使徒", "disciples", "apostles"]},
]

LOCATION_ANCHORS = [
    {"id": "eden-garden", "zh": "伊甸园", "en": "Garden of Eden", "ref": "Genesis 2:8–14",
     "desc": "Lush primeval Near Eastern paradise watered by four crystal rivers, ancient fig, olive, and fruit trees, golden morning mist, Tree of Life and Tree of Knowledge at center."},
    {"id": "noahs-ark", "zh": "挪亚方舟（300×50×30肘平底长方体）", "en": "Noah's Ark (300x50x30 Cubits Rectangular)", "ref": "Genesis 6:14–16",
     "desc": "Massive 1:1 biblical scale rectangular box-shaped gopher-wood vessel (135m long, 22.5m wide, 13.5m high), straight flat sides, flat bottom, three internal decks, 1-cubit continuous window opening under the roof ridge, one large side door with timber boarding ramp, coated in dark pitch — NO curved sailboat hull, NO pointed bow, NO masts or sails."},
    {"id": "babel-tower", "zh": "示拿平原与巴别塔", "en": "Plain of Shinar & Tower of Babel", "ref": "Genesis 11:1–9",
     "desc": "Ancient Mesopotamian brick-kiln plain with an unfinished monumental stepped mud-brick ziggurat surrounded by timber scaffolding, bitumen pits, and mud-brick huts."},
    {"id": "patriarch-tent-camp", "zh": "族长黑山羊毛帐棚营地", "en": "Patriarchal Black Goat-Hair Tent Camp", "ref": "Genesis 12:8; 18:1",
     "desc": "Authentic Bronze Age Near Eastern nomadic encampment of black woven goat-hair tents under ancient oaks of Mamre in the Judean hills, stone altar, sheepfolds."},
    {"id": "egypt-goshen-palace", "zh": "古埃及歌珊地与法老王宫", "en": "Ancient Egypt (Goshen & Pharaoh's Court)", "ref": "Genesis 41; Exodus 1–12",
     "desc": "New Kingdom Egyptian mud-brick store-cities with straw-and-clay brick pits, and monumental sandstone lotus-columned palace court along the Nile."},
    {"id": "red-sea-crossing", "zh": "红海分开之路", "en": "Parted Waters of the Red Sea", "ref": "Exodus 14:21–22",
     "desc": "Colossal vertical walls of dark-blue sea water standing like heaps on the right and left, exposing a wide wind-dried seabed path between them, with the pillar of fire and cloud behind."},
    {"id": "mount-sinai", "zh": "西乃山与旷野安营", "en": "Mount Sinai & Wilderness Camp", "ref": "Exodus 19–20",
     "desc": "Jagged granite peak of Mount Sinai in the desert peninsula, wreathed in thick dark thunderclouds, lightning, fire, and smoke, with Israel's orderly tent camp at the base."},
    {"id": "moses-tabernacle", "zh": "摩西会幕与外院（1:1实尺）", "en": "The Tabernacle in the Wilderness (1:1)", "ref": "Exodus 26–27; 40",
     "desc": "Exact Exodus 26–27 measured Tabernacle: 100×50 cubit white linen courtyard fence on bronze sockets, bronze altar of burnt offering, bronze laver, and the 30×10×10 cubit tent covered in ram skins dyed red and goat hair, with the pillar of cloud/fire above the Holy of Holies."},
    {"id": "jordan-jericho", "zh": "约旦河与耶利哥城墙", "en": "Jordan River & Walls of Jericho", "ref": "Joshua 3–6",
     "desc": "Mud-brick double rampart walls of Bronze Age Jericho in the Jordan Rift Valley, surrounded by date palms and dry desert plains."},
    {"id": "shiloh-sanctuary", "zh": "示罗会幕", "en": "Sanctuary at Shiloh", "ref": "1 Samuel 1–4",
     "desc": "Stone-walled compound in the Ephraimite hills housing the Tabernacle tent, bronze altar, and oil lamps."},
    {"id": "elah-valley", "zh": "以拉谷战场", "en": "Valley of Elah", "ref": "1 Samuel 17:1–3",
     "desc": "Sunlit stony dry brook bed running between two terraced limestone hillsides in Judah, with Israelite and Philistine battle lines on opposite ridges."},
    {"id": "jerusalem-city-of-david", "zh": "耶路撒冷大卫城", "en": "Jerusalem (City of David)", "ref": "2 Samuel 5–7",
     "desc": "Limestone ridge of ancient Jerusalem (Ophel and Mount Zion), stepped stone structure, cedar palace of David, overlooking the Kidron Valley."},
    {"id": "solomons-temple", "zh": "所罗门圣殿与院落（1:1实尺）", "en": "Solomon's Temple (1:1 Measured)", "ref": "1 Kings 6–7; 2 Chronicles 3–4",
     "desc": "Exact 1 Kings 6–7 measured First Temple on Mount Moriah: white Jerusalem limestone exterior, two freestanding bronze pillars Jachin and Boaz at the porch, cast bronze Sea resting on 12 bronze oxen, ten bronze wheeled lavers, great bronze altar, and gold-lined cedar sanctuary."},
    {"id": "mount-carmel", "zh": "迦密山祭坛", "en": "Mount Carmel Altar", "ref": "1 Kings 18:30–38",
     "desc": "Wind-swept rocky ridge of Mount Carmel overlooking the Mediterranean Sea, an altar rebuilt of 12 uncut field stones surrounded by a water-filled trench."},
    {"id": "babylon-exile", "zh": "巴比伦城与迦巴鲁河畔", "en": "Babylon & Kebar Canal", "ref": "Daniel 1–6; Ezekiel 1",
     "desc": "Glazed blue brick walls of Neo-Babylonian Babylon with reliefs, palm-lined Kebar irrigation canal, and royal palace courts."},
    {"id": "susa-palace", "zh": "书珊城波斯王宫", "en": "Susa Palace (Persia)", "ref": "Esther 1:5–6; Nehemiah 1:1",
     "desc": "Achaemenid Persian royal apadana hall in Susa with bull-capital stone columns, marble pavement, and white-and-violet linen hangings."},
    {"id": "bethlehem-manger", "zh": "伯利恒马槽与牧羊野地", "en": "Bethlehem Cave-Stable & Shepherds' Field", "ref": "Luke 2:7–16",
     "desc": "Authentic first-century Judean limestone cave-stable in Bethlehem with a rough-hewn stone feeding trough (manger), oil lamp, and terraced olive hills outside under starry night sky."},
    {"id": "jordan-baptism", "zh": "约旦河受洗渡口", "en": "Jordan River Ford (Bethany Beyond Jordan)", "ref": "Matthew 3:13–17; John 1:28",
     "desc": "Flowing muddy-green waters of the lower Jordan River lined with reeds, tamarisk trees, and limestone banks."},
    {"id": "sea-of-galilee", "zh": "加利利海与第一世纪木渔船", "en": "Sea of Galilee & 1st-Century Fishing Boat", "ref": "Matthew 4:18; Mark 4:37",
     "desc": "Freshwater lake surrounded by the Golan and Galilean hills, with an authentic 8-meter first-century cedar-and-oak Galilee fishing boat with oars and linen square sail."},
    {"id": "capernaum-synagogue", "zh": "迦百农会堂与犹太村落", "en": "Capernaum Synagogue & Village", "ref": "Mark 1:21; Luke 4:16",
     "desc": "First-century Galilean basalt-and-limestone synagogue with stone benches along the walls, central reading stand with Torah scrolls, and flat-roofed stone courtyard houses."},
    {"id": "herods-temple", "zh": "第一世纪耶路撒冷圣殿（第二圣殿）", "en": "Second Temple in Jerusalem (1st Century)", "ref": "Luke 2:46; John 2:14; Acts 3:2",
     "desc": "Monumental Herodian white-stone and gold Temple complex on Mount Moriah, Royal Stoa colonnades, Court of the Women with treasury chests, and Beautiful Gate."},
    {"id": "upper-room-gethsemane", "zh": "马可楼与客西马尼园", "en": "Upper Room & Garden of Gethsemane", "ref": "Matthew 26:20–46",
     "desc": "Stone-walled Jerusalem upper dining room lit by warm oil lamps with low triclinium cushions, and ancient gnarled olive trees in Gethsemane by moonlit Kidron valley."},
    {"id": "golgotha-empty-tomb", "zh": "各各他与花园空坟墓", "en": "Golgotha & the Garden Tomb", "ref": "John 19:17–20:18",
     "desc": "Rocky limestone knoll outside Jerusalem's walls, and a nearby rock-hewn garden tomb with a heavy circular rolling stone rolled back in golden dawn light."},
    {"id": "paul-roman-world", "zh": "使徒行传地中海港口与罗马城", "en": "Mediterranean Ports & First-Century Rome", "ref": "Acts 13–28",
     "desc": "First-century Eastern Mediterranean stone harbor with merchant grain ships, Greco-Roman stone theater/agora, and Paul's rented Roman lodging."},
    {"id": "new-jerusalem", "zh": "新天新地与圣城新耶路撒冷", "en": "New Heaven, New Earth & New Jerusalem", "ref": "Revelation 21:1–22:5",
     "desc": "Radiant holy city descending from heaven, jasper walls with 12 pearl gates, crystal-clear River of the Water of Life flowing from the throne of God and the Lamb, Tree of Life on either side."},
]

# Tier S epic event IDs or keyword patterns
TIER_S_EXACT = set(PILOT_12_IDS) | {
    "genesis-1-14", "genesis-1-26", "genesis-3-1", "genesis-3-22",
    "genesis-7-1", "genesis-8-1", "genesis-9-1", "genesis-11-1",
    "genesis-12-1", "genesis-15-1", "genesis-22-1", "genesis-28-10",
    "genesis-37-18", "genesis-41-1", "genesis-45-1",
    "exodus-3-1", "exodus-7-14", "exodus-12-1", "exodus-14-19",
    "exodus-19-1", "exodus-20-1", "exodus-32-1", "exodus-40-1",
    "leviticus-16-1", "numbers-13-1", "numbers-21-4",
    "deuteronomy-34-1", "joshua-1-1", "joshua-3-1", "joshua-6-1",
    "judges-6-1", "judges-7-1", "judges-16-23", "ruth-2-1",
    "1-samuel-3-1", "1-samuel-16-1", "1-samuel-17-40",
    "2-samuel-5-1", "2-samuel-6-1", "2-samuel-7-1",
    "1-kings-6-1", "1-kings-8-1", "1-kings-18-20", "1-kings-19-1",
    "2-kings-2-1", "2-kings-5-1", "2-kings-19-1", "2-kings-25-1",
    "2-chronicles-7-1", "ezra-3-1", "nehemiah-8-1", "esther-4-1", "esther-5-1",
    "job-1-1", "job-38-1", "psalms-23-1",
    "isaiah-6-1", "isaiah-53-1", "jeremiah-31-31",
    "ezekiel-1-1", "ezekiel-37-1", "ezekiel-47-1",
    "daniel-2-1", "daniel-3-1", "daniel-5-1", "daniel-7-1",
    "jonah-1-1", "jonah-2-1",
    "matthew-1-18", "matthew-2-1", "matthew-3-13", "matthew-5-1",
    "matthew-8-23", "matthew-17-1", "matthew-26-26", "matthew-27-32", "matthew-28-1", "matthew-28-16",
    "mark-1-9", "mark-4-35", "mark-5-1", "mark-15-21", "mark-16-1",
    "luke-1-26", "luke-2-1", "luke-2-8", "luke-4-16", "luke-10-25", "luke-15-11",
    "luke-22-39", "luke-23-33", "luke-24-1", "luke-24-13", "luke-24-50",
    "john-1-1", "john-2-1", "john-3-1", "john-4-1", "john-6-1", "john-9-1",
    "john-13-1", "john-19-16", "john-20-1", "john-20-19", "john-21-1",
    "acts-1-1", "acts-2-1", "acts-7-54", "acts-8-26", "acts-9-1", "acts-10-1",
    "acts-16-16", "acts-17-16", "acts-27-1", "acts-28-1",
    "romans-8-1", "1-corinthians-13-1", "1-corinthians-15-1",
    "hebrews-11-1", "revelation-1-9", "revelation-4-1", "revelation-5-1",
    "revelation-12-1", "revelation-19-11", "revelation-20-1", "revelation-22-1",
}

# Explicit event sets for NT characters with common homonyms
MARY_MOTHER_EVENTS = {
    "matthew-1-18", "matthew-2-1", "matthew-2-13", "matthew-12-46", "matthew-13-53",
    "mark-3-20", "mark-6-1",
    "luke-1-26", "luke-1-39", "luke-1-46", "luke-2-1", "luke-2-8", "luke-2-21", "luke-2-41", "luke-8-19",
    "john-2-1", "john-2-12", "john-19-16",
    "acts-1-12",
}

JOSEPH_CARPENTER_EVENTS = {
    "matthew-1-18", "matthew-2-1", "matthew-2-13",
    "luke-1-26", "luke-2-1", "luke-2-8", "luke-2-21", "luke-2-41",
}

JOHN_BAPTIST_EVENTS = {
    "matthew-3-1", "matthew-3-13", "matthew-11-1", "matthew-14-1",
    "mark-1-1", "mark-1-9", "mark-6-14",
    "luke-1-5", "luke-1-57", "luke-3-1", "luke-3-21", "luke-7-18",
    "john-1-19", "john-1-29", "john-3-22",
}

# Gospel events where Jesus himself is not yet born or not in the scene
NT_NON_JESUS_EVENTS = {
    "matthew-2-13",  # infant Jesus only
    "matthew-3-1", "matthew-14-1",
    "mark-1-1", "mark-6-14",
    "luke-1-1", "luke-1-5", "luke-1-26", "luke-1-39", "luke-1-57", "luke-3-1",
    "john-1-19", "john-3-22",
}


def decode_verse_code(code):
    b = code // 1_000_000
    c = (code // 1000) % 1000
    v = code % 1000
    return b, c, v


def book_slug(b, books_list=None):
    if books_list is None:
        books_list = tp.books()
    bn = books_list[b - 1]
    if bn == "Song of Solomon":
        return "song-of-songs"
    return re.sub(r"\s+", "-", bn.lower())


def build_section_index(repo_root=REPO_ROOT):
    """Build canonical section index from data/text/section_titles.json and cuvs-yhwh.json."""
    st_path = os.path.join(repo_root, "data/text/section_titles.json")
    cuv_path = os.path.join(repo_root, "data/text/bible/cuvs-yhwh.json")
    with open(st_path, encoding="utf-8") as f:
        st = json.load(f)
    with open(cuv_path, encoding="utf-8") as f:
        cuv_verses = json.load(f)

    max_v = {}
    max_c = {}
    for v in cuv_verses:
        vid = v["id"]
        b, c, vn = int(vid[:3]), int(vid[3:6]), int(vid[6:])
        if vn > max_v.get((b, c), 0):
            max_v[(b, c)] = vn
        if c > max_c.get(b, 0):
            max_c[b] = c

    books_list = st["_meta"]["books"]
    secs_by_book = {}
    sec_by_id = {}
    for bi, bn in enumerate(books_list, 1):
        starts = sorted(
            (int(c), it["verse"], it)
            for c, l in st["sets"]["cuv"].get(bn, {}).items()
            for it in l
        )
        en_map = {
            (int(c), it["verse"]): it
            for c, l in st["sets"]["english-classic"].get(bn, {}).items()
            for it in l
        }
        b_secs = []
        for k, (c, v, it_zh) in enumerate(starts):
            if k + 1 < len(starts):
                nc, nv, _ = starts[k + 1]
                ec, ev = (nc, nv - 1) if nv > 1 else (nc - 1, max_v[(bi, nc - 1)])
            else:
                ec = max_c[bi]
                ev = max_v[(bi, ec)]
            sec_id = f"sec:{book_slug(bi, books_list)}-{c}-{v}"
            vcodes = []
            for ch in range(c, ec + 1):
                vs = v if ch == c else 1
                ve = ev if ch == ec else max_v[(bi, ch)]
                for vv in range(vs, ve + 1):
                    vcodes.append(bi * 1_000_000 + ch * 1000 + vv)
            it_en = en_map[(c, v)]
            sec_obj = {
                "sec_id": sec_id,
                "b": bi,
                "c": c,
                "v": v,
                "s": bi * 1_000_000 + c * 1000 + v,
                "e": bi * 1_000_000 + ec * 1000 + ev,
                "vset": set(vcodes),
                "zh_title": it_zh["title"],
                "zh_context": it_zh["context"],
                "en_title": it_en["title"],
                "en_context": it_en["context"],
            }
            b_secs.append(sec_obj)
            sec_by_id[sec_id] = sec_obj
        secs_by_book[bi] = b_secs
    return secs_by_book, sec_by_id, max_v


def load_csv_sections_map(csv_path=DEFAULT_CSV_PATH):
    """Load provisional primarySection and sections from 雅伟之界_1443事件处理清单_2026-10-23.csv."""
    out = {}
    if not csv_path or not os.path.isfile(csv_path):
        return out
    with open(csv_path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            eid = r["event_id"]
            prim = r["主段落(按经节重叠最多)"].split()[0]
            all_secs = [m.group(0) for m in re.finditer(r"sec:[a-z0-9-]+", r["覆盖的新段落(sec id 标题 范围)"])]
            out[eid] = {"primarySection": prim, "sections": all_secs}
    return out


def resolve_event_section(ev, prev, secs_by_book, sec_by_id, csv_sections_map, max_v):
    """Resolve primarySection, sections, sectionSource ('depicts' or 'provisional'), and section text."""
    eid = ev["id"]
    bi = ev.get("b") or ev.get("book")
    s_default = ev.get("s") or ev.get("start")
    e_default = ev.get("e") or ev.get("end")

    depicts_ref = prev.get("depictsRef") if isinstance(prev, dict) else None
    if isinstance(depicts_ref, list) and depicts_ref:
        vset = set()
        for rng in depicts_ref:
            if not isinstance(rng, dict):
                continue
            rs, re_code = rng.get("s"), rng.get("e")
            if isinstance(rs, int) and isinstance(re_code, int) and rs <= re_code:
                rb, c1, v1 = decode_verse_code(rs)
                _, c2, v2 = decode_verse_code(re_code)
                for ch in range(c1, c2 + 1):
                    vs = v1 if ch == c1 else 1
                    ve = v2 if ch == c2 else max_v.get((rb, ch), v2)
                    for vv in range(vs, ve + 1):
                        vset.add(rb * 1_000_000 + ch * 1000 + vv)
        if vset:
            cov = [sec for sec in secs_by_book.get(bi, []) if sec["vset"] & vset]
            if cov:
                primary = max(cov, key=lambda sec: len(sec["vset"] & vset))
                return primary["sec_id"], [sec["sec_id"] for sec in cov], "depicts", primary

    # Provisional: use CSV mapping if available, otherwise overlap with event [s, e]
    if eid in csv_sections_map:
        prim_id = csv_sections_map[eid]["primarySection"]
        cov = [sec for sec in secs_by_book.get(bi, []) if sec["s"] <= e_default and sec["e"] >= s_default]
        sec_ids = [sec["sec_id"] for sec in cov] if cov else csv_sections_map[eid]["sections"]
        prim_sec = sec_by_id.get(prim_id) or (cov[0] if cov else None)
        if prim_sec:
            return prim_id, sec_ids, "provisional", prim_sec

    cov = [sec for sec in secs_by_book.get(bi, []) if sec["s"] <= e_default and sec["e"] >= s_default]
    c1, v1 = (s_default // 1000) % 1000, s_default % 1000
    c2, v2 = (e_default // 1000) % 1000, e_default % 1000
    ev_vset = set()
    for ch in range(c1, c2 + 1):
        vs = v1 if ch == c1 else 1
        ve = v2 if ch == c2 else max_v.get((bi, ch), v2)
        for vv in range(vs, ve + 1):
            ev_vset.add(bi * 1_000_000 + ch * 1000 + vv)
    primary = max(cov, key=lambda sec: len(sec["vset"] & ev_vset))
    return primary["sec_id"], [sec["sec_id"] for sec in cov], "provisional", primary


def extract_passage_excerpt(b, s_code, e_code, max_v, max_verses=6):
    """Extract display-normalized scripture excerpt from data/text/ via textpack."""
    _, c1, v1 = decode_verse_code(s_code)
    _, c2, v2 = decode_verse_code(e_code)
    zh_lines, en_lines = [], []
    count = 0
    for c in range(c1, c2 + 1):
        v_start = v1 if c == c1 else 1
        v_end = v2 if c == c2 else max_v.get((b, c), v2)
        for v in range(v_start, v_end + 1):
            if count < max_verses:
                zt = tp.verse("cuvs-yhwh", b, c, v) or ""
                et = tp.verse("bsb-yhwh", b, c, v) or ""
                if zt:
                    zh_lines.append(f"{c}:{v} {zt}")
                if et:
                    en_lines.append(f"{c}:{v} {et}")
            count += 1
    return "\n".join(zh_lines), "\n".join(en_lines), count


def classify_event_tier(ev, total_verses, sec_info=None):
    eid = ev["id"]
    b = ev.get("b") or ev.get("book")
    sec_zh = f"{sec_info['zh_title']} {sec_info['zh_context']}" if sec_info else ""
    zh_hay = f"{ev['zh']} {sec_zh}"
    if eid in TIER_S_EXACT:
        return "S", 12
    if b in (19, 20, 21, 22) and eid not in TIER_S_EXACT:
        return "B", 5
    if 45 <= b <= 65 and eid not in TIER_S_EXACT:
        return "B", 5
    if any(k in zh_hay for k in ("家谱", "条例", "律例", "洁净之例", "宗族", "名单", "核计", "数点", "地界", "分地", "规矩", "书信", "问安", "劝勉", "箴言")):
        return "B", 5
    if any(k in zh_hay for k in ("创造", "洪水", "过红海", "十诫", "立约", "复活", "钉十字架", "升天", "五旬节", "变像", "降生")):
        return "S", 10
    return "A", 7 if total_verses <= 18 else 8


def match_character_anchors(ev, sec_info=None):
    """Assign character anchors using strict book/era ranges and homonym disambiguation."""
    eid = ev["id"]
    b = ev.get("b") or ev.get("book")
    s = ev.get("s") or ev.get("start")
    title_hay = f"{ev.get('zh', '')} {ev.get('en', '')}"
    sec_hay = (
        f"{sec_info.get('zh_title', '')} {sec_info.get('en_title', '')} "
        f"{sec_info.get('zh_context', '')} {sec_info.get('en_context', '')}"
        if sec_info else ""
    )
    hay = f"{title_hay} {sec_hay}"

    # Remove known false-positive substrings before keyword checks
    clean_hay = hay
    for phrase in (
        "大卫的子孙", "Son of David", "大卫城", "City of David", "大卫的宝座", "大卫家",
        "亚伯拉罕、以撒、雅各的神", "亚伯拉罕的后裔", "亚伯拉罕的子孙", "所罗门的廊", "Solomon’s Portico", "Solomon's Portico",
        "摩西的律法", "Law of Moses", "约拿的神迹", "约拿的兆头", "Sign of Jonah", "约翰的洗礼",
        "古利奈人西门", "亚利马太的约瑟", "抹大拉的马利亚", "马大的妹子马利亚", "伯大尼的马利亚",
        "西庇太的儿子雅各", "亚勒腓的儿子雅各", "主的兄弟雅各",
    ):
        clean_hay = clean_hay.replace(phrase, " ")

    matched = []

    def add(cid):
        if cid not in matched:
            matched.append(cid)

    # 1. Creation & Patriarchs (Genesis)
    if b == 1:
        if s <= 1005005 and any(k in clean_hay for k in ("亚当", "Adam", "造人", "伊甸")):
            add("adam")
        if 1002018 <= s <= 1004026 and any(k in clean_hay for k in ("夏娃", "Eve", "女人")):
            add("eve")
        if eid == "genesis-4-1":
            add("cain-abel")
        if eid == "genesis-5-1":
            add("enoch")
        if 1005028 <= s <= 1010032 and any(k in clean_hay for k in ("挪亚", "Noah", "方舟", "洪水")):
            add("noah")
        if 1011010 <= s <= 1025011 and any(k in clean_hay for k in ("亚伯拉罕", "亚伯兰", "Abraham", "Abram")):
            add("abraham")
        if 1011010 <= s <= 1023020 and any(k in clean_hay for k in ("撒拉", "撒莱", "Sarah", "Sarai")):
            add("sarah")
        if 1017015 <= s <= 1035029 and any(k in clean_hay for k in ("以撒", "Isaac")):
            add("isaac")
        if 1024001 <= s <= 1028009 and any(k in clean_hay for k in ("利百加", "Rebekah")):
            add("rebekah")
        if 1025019 <= s <= 1050014 and any(k in clean_hay for k in ("雅各", "Jacob")):
            add("jacob")
        if 1029001 <= s <= 1035020 and any(k in clean_hay for k in ("拉结", "Rachel")):
            add("rachel")
        if 1030022 <= s <= 1050026 and any(k in clean_hay for k in ("约瑟", "Joseph")):
            add("joseph-patriarch")

    # 2. Exodus & Wilderness (Exodus–Deuteronomy)
    if 2 <= b <= 5:
        if s >= 2002001 and any(k in clean_hay for k in ("摩西", "Moses")):
            add("moses")
        if b in (2, 3, 4) and s <= 4020029 and any(k in clean_hay for k in ("亚伦", "大祭司", "Aaron", "High Priest")):
            add("aaron-high-priest")
        if b in (2, 4) and any(k in clean_hay for k in ("米利暗", "Miriam")):
            add("miriam")
        if b == 2 and s <= 2015021 and any(k in clean_hay for k in ("法老", "Pharaoh")):
            add("pharaoh-exodus")
        if any(k in clean_hay for k in ("约书亚", "Joshua")):
            add("joshua")
        if b == 4 and any(k in clean_hay for k in ("迦勒", "Caleb")):
            add("caleb")

    # 3. Conquest, Judges & Ruth
    if b == 6:
        if any(k in clean_hay for k in ("约书亚", "Joshua")):
            add("joshua")
        if any(k in clean_hay for k in ("迦勒", "Caleb")):
            add("caleb")
        if s <= 6006027 and any(k in clean_hay for k in ("喇合", "Rahab")):
            add("rahab")
    elif b == 7:
        if s <= 7001036 and any(k in clean_hay for k in ("迦勒", "Caleb")):
            add("caleb")
        if 7004001 <= s <= 7005031 and any(k in clean_hay for k in ("底波拉", "Deborah")):
            add("deborah")
        if 7006001 <= s <= 7008035 and any(k in clean_hay for k in ("基甸", "Gideon")):
            add("gideon")
        if 7013001 <= s <= 7016031 and any(k in clean_hay for k in ("参孙", "Samson")):
            add("samson")
    elif b == 8:
        if any(k in clean_hay for k in ("路得", "Ruth")):
            add("ruth")
        if any(k in clean_hay for k in ("波阿斯", "Boaz")):
            add("boaz")

    # 4. Monarchy & Prophets (1 Samuel – Malachi)
    if b == 9:
        if s <= 9002021 and any(k in clean_hay for k in ("哈拿", "Hannah")):
            add("hannah")
        if s <= 9028025 and any(k in clean_hay for k in ("撒母耳", "Samuel")):
            add("samuel")
        if s >= 9009001 and any(k in clean_hay for k in ("扫罗", "Saul")):
            add("saul")
        if eid in ("1-samuel-16-1", "1-samuel-16-14", "1-samuel-17-1", "1-samuel-17-40"):
            add("david-youth")
        elif s >= 9018001 and any(k in clean_hay for k in ("大卫", "David")):
            add("david-king")
        if eid in ("1-samuel-17-1", "1-samuel-17-40"):
            add("goliath")
        if s >= 9013001 and any(k in clean_hay for k in ("约拿单", "Jonathan")):
            add("jonathan")
    elif b == 10:
        if any(k in clean_hay for k in ("大卫", "David")):
            add("david-king")
        if eid == "2-samuel-1-1" and any(k in clean_hay for k in ("约拿单", "Jonathan")):
            add("jonathan")
    elif b in (11, 12, 13, 14):
        if (b == 11 and s <= 11002011) or (b == 13 and s >= 13011001):
            if any(k in clean_hay for k in ("大卫", "David")):
                add("david-king")
        if (b == 11 and s <= 11011043) or (b == 13 and s >= 13022001) or (b == 14 and s <= 14009031):
            if any(k in clean_hay for k in ("所罗门", "Solomon")):
                add("solomon")
        if b in (11, 12) and 11017001 <= s <= 12002018 and any(k in clean_hay for k in ("以利亚", "Elijah")):
            add("elijah")
        if b in (11, 12) and 11019015 <= s <= 12013021 and any(k in clean_hay for k in ("以利沙", "Elisha")):
            add("elisha")
        if b in (12, 14) and any(k in clean_hay for k in ("希西家", "Hezekiah")):
            add("hezekiah")
        if b in (12, 14) and any(k in clean_hay for k in ("约西亚", "Josiah")):
            add("josiah")
        if b in (12, 14) and any(k in clean_hay for k in ("以赛亚", "Isaiah")):
            add("isaiah")
        if b in (12, 14) and any(k in clean_hay for k in ("尼布甲尼撒", "Nebuchadnezzar")):
            add("nebuchadnezzar")
    elif b == 15:
        if s >= 15007001 and any(k in clean_hay for k in ("以斯拉", "Ezra")):
            add("ezra")
    elif b == 16:
        if any(k in clean_hay for k in ("尼希米", "Nehemiah")):
            add("nehemiah")
        if any(k in clean_hay for k in ("以斯拉", "Ezra")):
            add("ezra")
    elif b == 17:
        if any(k in clean_hay for k in ("以斯帖", "Esther")):
            add("esther")
        if any(k in clean_hay for k in ("末底改", "Mordecai")):
            add("mordecai")
    elif b == 18:
        if any(k in clean_hay for k in ("约伯", "Job")):
            add("job")
    elif b == 23:
        if any(k in clean_hay for k in ("以赛亚", "Isaiah")):
            add("isaiah")
        if any(k in clean_hay for k in ("希西家", "Hezekiah")):
            add("hezekiah")
    elif b in (24, 25):
        if any(k in clean_hay for k in ("耶利米", "Jeremiah")):
            add("jeremiah")
        if any(k in clean_hay for k in ("尼布甲尼撒", "Nebuchadnezzar")):
            add("nebuchadnezzar")
    elif b == 26:
        if any(k in clean_hay for k in ("以西结", "Ezekiel")):
            add("ezekiel")
    elif b == 27:
        if any(k in clean_hay for k in ("但以理", "Daniel")):
            add("daniel")
        if s <= 27005031 and any(k in clean_hay for k in ("尼布甲尼撒", "Nebuchadnezzar")):
            add("nebuchadnezzar")
    elif b == 32:
        add("jonah")

    # 5. New Testament (Matthew – Revelation)
    if 40 <= b <= 43:
        if eid not in NT_NON_JESUS_EVENTS and any(k in clean_hay for k in ("耶稣", "基督", "人子", "主", "夫子", "Jesus", "Christ")):
            add("jesus")
        if eid in MARY_MOTHER_EVENTS:
            add("mary-mother")
        if eid in JOSEPH_CARPENTER_EVENTS:
            add("joseph-carpenter")
        if eid in JOHN_BAPTIST_EVENTS:
            add("john-baptist")
        if any(k in clean_hay for k in ("彼得", "西门彼得", "矶法", "Peter", "Cephas")) or eid in ("mark-1-14", "mark-1-29", "luke-4-38", "luke-5-1"):
            add("peter")
        if eid not in JOHN_BAPTIST_EVENTS and any(
            k in clean_hay for k in ("使徒约翰", "雅各和约翰", "彼得、雅各、约翰", "彼得和约翰", "John and his brother", "James and John")
        ):
            add("john-apostle")
        if eid == "luke-19-1":
            add("zacchaeus")
        if eid in ("matthew-17-1", "mark-9-2", "luke-9-28"):
            add("moses")
            add("elijah")
    elif b == 44:
        if eid in ("acts-1-1", "acts-1-6", "acts-7-54", "acts-9-1"):
            add("jesus")
        if eid == "acts-1-12":
            add("mary-mother")
        if s <= 44015041 and any(k in clean_hay for k in ("彼得", "西门彼得", "Peter")):
            add("peter")
        if eid in ("acts-3-1", "acts-4-1", "acts-8-14"):
            add("john-apostle")
        if s >= 44007054 and any(k in clean_hay for k in ("保罗", "扫罗", "Paul", "Saul")):
            add("paul")
        if eid in ("acts-6-1", "acts-6-8", "acts-7-1", "acts-7-54"):
            add("stephen")
        if s >= 44016001 and any(k in clean_hay for k in ("提摩太", "Timothy")):
            add("timothy")
    elif 45 <= b <= 57:
        add("paul")
        if any(k in clean_hay for k in ("提摩太", "Timothy")):
            add("timothy")
    elif b == 66:
        add("john-apostle")
        if eid in ("revelation-1-1", "revelation-1-9", "revelation-19-11", "revelation-22-12"):
            add("jesus")

    # 6. Period Archetypes & Creatures (disambiguated)
    if b <= 39 and any(k in clean_hay for k in ("祭司", "利未人", "priest", "Levite")):
        add("levite-priest")
    if b == 2 and s <= 2015021 and any(k in clean_hay for k in ("埃及军", "追兵", "法老的车辆", "战车", "chariots")):
        add("soldier-egyptian")
    if b in (7, 9, 10, 13) and any(k in clean_hay for k in ("非利士", "Philistine")):
        add("soldier-philistine")
    if b in (12, 14, 23, 34) and any(k in clean_hay for k in ("亚述", "西拿基立", "Assyria", "Sennacherib")):
        add("soldier-assyrian")
    if b in (12, 14, 24, 25, 26, 27) and any(k in clean_hay for k in ("迦勒底", "巴比伦军", "巴比伦王", "Chaldean", "Babylonian army")):
        add("soldier-babylonian")
    if 40 <= b <= 44 and any(k in clean_hay for k in ("百夫长", "千夫长", "罗马兵", "兵丁", "看守", "centurion", "Roman soldier")):
        add("soldier-roman")
    if b <= 43 and eid != "john-1-29" and any(k in clean_hay for k in ("羊群", "绵羊", "羊羔", "牧羊", "逾越节的羊", "sheep", "flock", "Passover lamb")):
        add("fat-tailed-sheep")
    if any(k in clean_hay for k in ("天使", "雅伟的使者", "基路伯", "撒拉弗", "加百列", "米迦勒", "angel", "cherubim", "seraphim")):
        add("angel-messenger")
    if 40 <= b <= 44 and any(k in clean_hay for k in ("门徒", "十二使徒", "十二门徒", "使徒们", "disciples", "apostles")):
        add("twelve-apostles")

    return matched[:4]


def match_location_anchor(ev, sec_info=None):
    """Assign a canonical locationAnchor ONLY when the event genuinely takes place at that anchor."""
    b = ev.get("b") or ev.get("book")
    s = ev.get("s") or ev.get("start")
    eid = ev["id"]
    sec_hay = (
        f"{sec_info.get('zh_title', '')} {sec_info.get('en_title', '')} "
        f"{sec_info.get('zh_context', '')} {sec_info.get('en_context', '')}"
        if sec_info else ""
    )
    hay = f"{ev.get('zh', '')} {ev.get('en', '')} {sec_hay}"
    places_en = set(ev.get("placeNames") or [])

    # Book 1: Genesis
    if b == 1:
        if s <= 1003024:
            return "eden-garden"
        if 1006009 <= s <= 1009017:
            return "noahs-ark"
        if eid == "genesis-11-1":
            return "babel-tower"
        if eid == "genesis-12-10" or s >= 1039001:
            return "egypt-goshen-palace"
        return "patriarch-tent-camp"

    # Book 2: Exodus
    if b == 2:
        if s <= 2012051 and eid not in ("exodus-3-1", "exodus-4-1", "exodus-18-1"):
            return "egypt-goshen-palace"
        if eid in ("exodus-4-1", "exodus-6-1"):
            return "egypt-goshen-palace"
        if 2013017 <= s <= 2015021:
            return "red-sea-crossing"
        if 2025001 <= s <= 2031017 or s >= 2035001:
            return "moses-tabernacle"
        if 2019001 <= s <= 2024018 or 2031018 <= s <= 2034035:
            return "mount-sinai"
        return None  # Wilderness of Shur / Sin / Rephidim / Midian

    # Book 3: Leviticus (spoken at the Tabernacle in Sinai wilderness)
    if b == 3:
        return "moses-tabernacle"

    # Book 4: Numbers
    if b == 4:
        if s <= 4010010:
            return "moses-tabernacle"
        return None  # Wilderness of Paran, Kadesh-barnea, Mount Hor, Plains of Moab

    # Book 5: Deuteronomy (Plains of Moab / Mount Nebo)
    if b == 5:
        return None

    # Book 6: Joshua
    if b == 6:
        if s <= 6006027:
            return "jordan-jericho"
        if eid in ("joshua-18-1", "joshua-21-1"):
            return "shiloh-sanctuary"
        return None  # Ai, Mount Ebal, Gibeon, Hazor, Hebron, Shechem

    # Book 7: Judges & Book 8: Ruth
    if b == 7:
        if eid == "judges-21-1":
            return "shiloh-sanctuary"
        return None
    if b == 8:
        return None  # Moab road & Bethlehem barley fields / threshing floor / gate

    # Book 9: 1 Samuel
    if b == 9:
        if s <= 9004022:
            return "shiloh-sanctuary"
        if eid in ("1-samuel-17-1", "1-samuel-17-40"):
            return "elah-valley"
        return None  # Mizpah, Ramah, Gilgal, Gibeah, Nob, En-gedi, Ziklag, Gilboa

    # Book 10: 2 Samuel
    if b == 10:
        if s >= 10005001 and eid not in ("2-samuel-10-1", "2-samuel-12-26", "2-samuel-17-1", "2-samuel-18-1", "2-samuel-19-1"):
            return "jerusalem-city-of-david"
        return None

    # Books 11-14: Kings & Chronicles
    if b in (11, 12, 13, 14):
        if eid in ("1-kings-18-1", "1-kings-18-20"):
            return "mount-carmel"
        if eid in ("2-kings-25-1", "2-kings-25-22", "2-chronicles-36-15"):
            return "babylon-exile"
        if any(k in hay for k in ("建殿", "圣殿", "献殿", "约柜运入圣殿", "洁净圣殿", "修葺圣殿", "Temple")):
            return "solomons-temple"
        if "Jerusalem" in places_en and not any(
            p in places_en for p in ("Samaria 1", "Jezreel 2", "Damascus", "Shunem", "Bethel 1", "Jericho 1")
        ):
            return "jerusalem-city-of-david"
        if (b == 11 and s <= 11011043) or (b == 13 and s >= 13011001) or (b == 14 and s <= 14009031):
            if not places_en or "Jerusalem" in places_en:
                return "jerusalem-city-of-david"
        return None

    # Books 15-17: Ezra, Nehemiah, Esther
    if b == 15:
        if eid in ("ezra-3-1", "ezra-3-8", "ezra-5-1", "ezra-6-1", "ezra-6-13"):
            return "solomons-temple"
        if "Jerusalem" in places_en and eid not in ("ezra-1-1", "ezra-7-1", "ezra-8-1"):
            return "jerusalem-city-of-david"
        return None
    if b == 16:
        if eid in ("nehemiah-1-1", "nehemiah-2-1"):
            return "susa-palace"
        return "jerusalem-city-of-david"
    if b == 17:
        return "susa-palace"

    # Book 18: Job (Land of Uz)
    if b == 18:
        return None

    # Books 19-22: Psalms & Wisdom
    if b in (19, 20, 21, 22):
        if any(k in hay for k in ("圣殿", "院宇", "圣所")):
            return "solomons-temple"
        if any(k in hay for k in ("锡安", "耶路撒冷", "大卫城", "Zion", "Jerusalem")):
            return "jerusalem-city-of-david"
        return None

    # Books 23-39: Prophets
    if 23 <= b <= 39:
        if eid == "isaiah-6-1" or b == 37:
            return "solomons-temple"
        if eid == "daniel-8-1":
            return "susa-palace"
        if b == 27 or (b == 26 and s < 26040001 and eid not in ("ezekiel-8-1", "ezekiel-9-1", "ezekiel-10-1", "ezekiel-11-1")):
            if b == 27 or "Babylon 1" in places_en or "Chebar" in places_en or not places_en:
                return "babylon-exile"
        if eid in ("ezekiel-8-1", "ezekiel-9-1", "ezekiel-10-1", "ezekiel-11-1"):
            return "solomons-temple"
        if b in (23, 24, 25, 33, 36, 38, 39) and "Jerusalem" in places_en and len(places_en) <= 4:
            return "jerusalem-city-of-david"
        return None

    # Books 40-43: Gospels
    if b in (40, 41, 42, 43):
        if eid in ("matthew-2-1", "luke-2-1", "luke-2-8"):
            return "bethlehem-manger"
        if eid in ("matthew-3-1", "matthew-3-13", "mark-1-1", "mark-1-9", "luke-3-1", "luke-3-21", "john-1-19", "john-1-29", "john-3-22", "john-10-40"):
            return "jordan-baptism"
        if eid in (
            "matthew-4-18", "matthew-8-18", "matthew-8-23", "matthew-13-1", "matthew-14-13", "matthew-14-22", "matthew-15-29", "matthew-15-32", "matthew-16-1",
            "mark-1-14", "mark-3-7", "mark-4-1", "mark-4-35", "mark-6-30", "mark-6-45", "mark-6-53", "mark-8-1", "mark-8-11",
            "luke-5-1", "luke-8-22", "john-6-1", "john-6-16", "john-21-1", "john-21-15",
        ):
            return "sea-of-galilee"
        if eid in (
            "matthew-8-5", "matthew-8-14", "matthew-9-1", "matthew-9-9", "matthew-9-18", "matthew-17-24",
            "mark-1-21", "mark-1-29", "mark-2-1", "mark-2-13", "mark-3-1", "mark-9-33",
            "luke-4-31", "luke-4-38", "luke-5-17", "luke-5-27", "luke-6-6", "luke-7-1",
            "john-2-12", "john-4-43", "john-6-22", "john-6-59",
        ):
            return "capernaum-synagogue"
        if eid in (
            "luke-1-5", "luke-2-21", "luke-2-41",
            "matthew-21-12", "matthew-21-23", "matthew-21-33", "matthew-22-1", "matthew-22-15", "matthew-22-23", "matthew-22-34", "matthew-23-1",
            "mark-11-15", "mark-11-27", "mark-12-1", "mark-12-13", "mark-12-18", "mark-12-28", "mark-12-35", "mark-12-41",
            "luke-19-45", "luke-20-1", "luke-20-9", "luke-20-19", "luke-20-27", "luke-20-41", "luke-21-1",
            "john-2-13", "john-5-1", "john-7-1", "john-7-14", "john-7-25", "john-7-37", "john-8-1", "john-8-12", "john-8-31", "john-10-22", "john-12-20",
        ):
            return "herods-temple"
        if eid in (
            "matthew-26-17", "matthew-26-26", "matthew-26-36", "matthew-26-47",
            "mark-14-12", "mark-14-22", "mark-14-32", "mark-14-43",
            "luke-22-7", "luke-22-14", "luke-22-24", "luke-22-39", "luke-22-47",
            "john-13-1", "john-13-18", "john-13-31", "john-14-1", "john-14-15", "john-15-1", "john-15-18", "john-16-1", "john-16-16", "john-17-1", "john-18-1",
            "john-20-19", "john-20-24",
        ):
            return "upper-room-gethsemane"
        if eid in (
            "matthew-27-27", "matthew-27-32", "matthew-27-45", "matthew-27-57", "matthew-28-1", "matthew-28-11",
            "mark-15-16", "mark-15-21", "mark-15-33", "mark-15-42", "mark-16-1", "mark-16-9",
            "luke-23-26", "luke-23-33", "luke-23-44", "luke-23-50", "luke-24-1",
            "john-19-16", "john-19-28", "john-19-38", "john-20-1", "john-20-11",
        ):
            return "golgotha-empty-tomb"
        return None

    # Book 44: Acts
    if b == 44:
        if eid in ("acts-1-12", "acts-2-1", "acts-2-14"):
            return "upper-room-gethsemane"
        if eid in ("acts-2-42", "acts-3-1", "acts-3-11", "acts-5-12", "acts-21-27", "acts-22-1"):
            return "herods-temple"
        if s >= 44013001 and eid not in ("acts-15-1", "acts-15-22", "acts-21-15", "acts-22-30", "acts-23-1", "acts-23-12"):
            return "paul-roman-world"
        return None

    # Books 45-65: Epistles
    if 45 <= b <= 57:
        return "paul-roman-world"
    if 58 <= b <= 65:
        return None

    # Book 66: Revelation
    if b == 66:
        if s >= 66021001:
            return "new-jerusalem"
        return None

    return None


def build_setting_description(ev, loc_id, sec_info=None):
    """Build accurate Setting & Architecture text from locationAnchor or event-specific biblical setting."""
    loc_map = {l["id"]: l for l in LOCATION_ANCHORS}
    if loc_id and loc_id in loc_map:
        return loc_map[loc_id]["desc"]

    b = ev.get("b") or ev.get("book")
    s = ev.get("s") or ev.get("start")
    eid = ev["id"]
    places_en = [re.sub(r"\s+\d+$", "", p) for p in (ev.get("placeNames") or []) if p]
    places_zh = [p for p in (ev.get("placeNamesZh") or []) if p]

    # Filter out purely rhetorical "Egypt" mentions in Wilderness/Canaan books
    if b >= 3 and "Egypt" in places_en and len(places_en) > 1:
        places_en = [p for p in places_en if p != "Egypt"]
        places_zh = [p for p in places_zh if p != "埃及"]

    place_str = ""
    if places_en:
        en_joined = ", ".join(dict.fromkeys(places_en[:4]))
        zh_joined = "、".join(dict.fromkeys(places_zh[:4])) if places_zh else ""
        place_str = f"Biblical location: {en_joined}" + (f" ({zh_joined}). " if zh_joined else ". ")

    if b == 2:
        return f"{place_str}Sinai peninsula desert and Midianite/Rephidim rocky wadi, acacia trees, sunlit sandstone and granite cliffs, Bronze Age nomadic camp."
    if b == 4:
        return f"{place_str}Wilderness of Paran, Kadesh-barnea, and Plains of Moab: arid Near Eastern desert plateau, orderly Israelite tent encampment, limestone hills."
    if b == 5:
        return f"{place_str}Plains of Moab east of the Jordan River overlooking the Jordan Rift Valley and Mount Nebo, Bronze Age Israelite assembly in the wilderness."
    if b == 6:
        return f"{place_str}Bronze Age Canaanite hill country and fortified stone/mud-brick cities (Ai, Mount Ebal & Gerizim, Gibeon, Shechem), olive groves and limestone ridges."
    if b == 7:
        return f"{place_str}Early Iron Age hill country and valleys of Canaan (Ephraim, Gilead, Jezreel Valley, Philistine plain), rustic stone villages, threshing floors, and olive groves."
    if b == 8:
        return f"{place_str}Sunlit golden barley harvest fields, stone threshing floor, and town gate of ancient Bethlehem in Judah."
    if b == 9:
        return f"{place_str}Early Iron Age hill country of Judah, Benjamin, and Ephraim (Ramah, Mizpah, Gilgal, Gibeah, En-gedi wilderness crags), dressed limestone and mud-brick architecture."
    if b in (10, 11, 12, 13, 14, 15):
        return f"{place_str}Iron Age Kingdom of Israel and Judah, authentic ancient Near Eastern dressed-limestone fortifications, city gates, royal courts, and terraced hills."
    if b == 18:
        return f"{place_str}Ancient patriarchal land of Uz in the Near East, weathered stone courtyard, black goat-hair tents, arid wind-swept hills and dramatic sky."
    if b in (19, 20, 21, 22):
        return f"{place_str}Ancient Israelite pastoral hills, Judean wilderness streams, stone courtyards, and oil-lit chambers."
    if b == 32:
        if eid == "jonah-1-1":
            return f"{place_str}Eastern Mediterranean timber merchant ship in a raging tempest off Joppa, heavy wooden hull and linen sail."
        if eid == "jonah-2-1":
            return "Deep underwater Mediterranean abyss with filtered shafts of light in the sea."
        return f"{place_str}Monumental Neo-Assyrian mud-brick and limestone city walls, gates, and streets of ancient Nineveh."
    if 23 <= b <= 39:
        return f"{place_str}Ancient Near Eastern prophetic setting in Judah, Israel, or Mesopotamia, authentic stone architecture, scrolls, and natural dramatic lighting."
    if b in (40, 41, 42, 43):
        return f"{place_str}Authentic first-century Judean, Galilean, or Samaritan setting: flat-roofed limestone village houses, dusty olive-lined roads, terraced hillsides, and stone courtyards."
    if b == 44:
        return f"{place_str}Authentic first-century Jerusalem, Judea, Samaria, and Damascus road setting: Herodian dressed stone streets, courtyard houses, and ancient gates."
    if 58 <= b <= 65:
        return f"{place_str}First-century early Christian house-church gathering room lit by clay oil lamps, stone walls, wooden table with parchment scrolls."
    if b == 66:
        if s < 66004001:
            return f"{place_str}Wind-swept volcanic rock coast of the island of Patmos in the Aegean Sea and the seven first-century cities of Asia Minor."
        return f"{place_str}Awe-inspiring apocalyptic vision seen by Apostle John: heavenly sanctuary with golden lampstands, sea of glass, and radiant prophetic light (God is never depicted in human form)."
    return f"{place_str}Authentic ancient Near Eastern biblical environment matching {ev['ref']}."


def build_event_prompts(ev, char_ids, loc_id, tier, duration_sec, excerpt_zh, excerpt_en, sec_info):
    char_map = {c["id"]: c for c in CHARACTER_ANCHORS}
    char_notes = "; ".join(
        f"{char_map[cid]['en']} ({char_map[cid]['zh']}): {char_map[cid]['desc']}"
        for cid in char_ids if cid in char_map
    )
    loc_note = build_setting_description(ev, loc_id, sec_info)

    b = ev.get("b") or ev.get("book")
    if b <= 5:
        era_rule = "Bronze Age Ancient Near East / Egyptian New Kingdom / Sinai Wilderness. Authentic bronze weapons, wooden/wicker shields, woven wool and linen robes, desert tents, dressed stone."
    elif b <= 17:
        era_rule = "Iron Age Ancient Israel, Judah, Mesopotamia, or Persia. Period-accurate woven wool and linen tunics, bronze/iron weapons, mud-brick and dressed-limestone architecture."
    elif b <= 39:
        era_rule = "Ancient Near Eastern prophetic and wisdom setting in Israel, Judah, or Babylon. Authentic woven garments, clay oil lamps, leather scrolls, stone altars."
    else:
        era_rule = "First-century Roman Judea, Galilee, and Eastern Mediterranean. Authentic 1st-century Jewish woollen/linen tunics and mantles (tallit/himation), Roman military gear where specified, leather sandals, stone synagogues, Herodian limestone."

    sec_title_en = sec_info["en_title"]
    sec_title_zh = sec_info["zh_title"]
    sec_ctx_en = sec_info["en_context"]
    sec_ctx_zh = sec_info["zh_context"]

    zh_hay = f"{ev.get('zh', '')} {sec_title_zh} {sec_ctx_zh}"
    dignity_note = ""
    if any(c in zh_hay for c in "淫奸妓娼性裸赤"):
        dignity_note = " Portray the biblical fact faithfully with historical dignity and modesty: all figures clothed appropriately, showing the narrative tension or immediate context without nudity or sexual explicitness."
    elif any(c in zh_hay for c in "尸体斩首砍头剖"):
        dignity_note = " Portray the biblical event faithfully and dramatically with classical cinematic restraint, avoiding gratuitous visceral gore."

    image_prompt = (
        f"Photorealistic 16:9 widescreen historical cinema still captured on ARRI Alexa 65 with 50mm anamorphic prime lens, "
        f"natural physically accurate daylight or warm oil-lamp/firelight, rich authentic textures of ancient Near Eastern stone, dust, and hand-woven linen and wool. "
        f"Biblical Event #{ev.get('idx', 1)}: \"{ev['en']}\" ({ev['ref']} / {ev['zh']} {ev['refZh']}). "
        f"Biblical Fact & Scene Action: [{sec_title_en} / {sec_title_zh}] {sec_ctx_en} ({sec_ctx_zh}). "
        f"Setting & Architecture: {loc_note} "
        f"{f'Character Continuity Reference: {char_notes} ' if char_notes else ''}"
        f"Historical Era & Material Authenticity: {era_rule} "
        f"Mandatory Biblical & Visual Rules: "
        f"(1) 100% fidelity to the Biblical text ({ev['ref']}) — depict the actual scriptural event, objects, altars, weapons, and narrative action truthfully without watering down; "
        f"(2) {HAIR_RULE} "
        f"(3) Exact biblical counts and proportions as stated in Scripture; complete anatomical accuracy (clear faces, two hands, two legs, four legs on animals); "
        f"(4) Clean photographic frame with zero text, zero subtitles, zero watermarks, and zero inscriptions.{dignity_note}"
    )

    zero_ai_rule = (
        "STRICT REAL-CINEMA RULES (ZERO AI FEEL): Single continuous uninterrupted live-action shot locked strictly to the input keyframe "
        "(NO multi-clip cuts, NO cross-dissolves, NO scene replacement, NO morphing faces/hands/trees/architecture). "
        "Filmed on a heavy locked-off 65mm tripod or ultra-slow 2% physical dolly with natural 24fps motion blur and authentic film grain; "
        "only subtle, physically grounded real-world motion (gentle wind in woven cloth and foliage, natural breathing, subtle head/hand movement, realistic fire/water surface ripples)."
    )
    if tier == "S":
        motion_style = (
            f"Single-shot {duration_sec}-second 65mm live-action cinema plate from the exact start keyframe of \"{ev['en']}\" ({ev['ref']}): "
            f"ultra-slow steady tripod or subtle fluid-head push-in; natural physically grounded motion of wind, water, firelight, dust, and dignified human gestures 100% faithful to Scripture. {zero_ai_rule}"
        )
    elif tier == "A":
        motion_style = (
            f"Single-shot {duration_sec}-second 65mm live-action cinema plate from the exact start keyframe of \"{ev['en']}\" ({ev['ref']}): "
            f"steady tripod framing with subtle slow camera breathing as the biblical action unfolds with restrained, realistic human movement and natural cloth/light physics. {zero_ai_rule}"
        )
    else:
        motion_style = (
            f"Single-shot {duration_sec}-second 65mm live-action tableau from the exact start keyframe of \"{ev['en']}\" ({ev['ref']}): "
            f"locked-off tripod shot with warm flickering oil-lamp or sunlight rays and gentle breeze moving woven robes and leaves. {zero_ai_rule}"
        )

    return image_prompt, motion_style


def acquire_manifest_lock(lock_file=LOCK_FILE):
    os.makedirs(os.path.dirname(lock_file), exist_ok=True)
    while os.path.exists(lock_file):
        try:
            with open(lock_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if time.time() - data.get("timestamp", 0) > 1800:
                os.unlink(lock_file)
                break
        except Exception:
            if time.time() - os.path.getmtime(lock_file) > 1800:
                os.unlink(lock_file)
                break
        time.sleep(0.5)
    with open(lock_file, "w", encoding="utf-8") as f:
        json.dump({"session": SESSION_ID, "timestamp": time.time(), "step": "init_realistic_cinema"}, f)


def release_manifest_lock(lock_file=LOCK_FILE):
    if os.path.exists(lock_file):
        try:
            os.unlink(lock_file)
        except OSError:
            pass


def main(t7_root=T7_ROOT, repo_root=REPO_ROOT, csv_path=DEFAULT_CSV_PATH, lock_file=LOCK_FILE):
    all_events_path = os.path.join(repo_root, "data/events/all-events.json")
    pub_events_path = os.path.join(repo_root, "public/data/events.json")
    with open(all_events_path, encoding="utf-8") as f:
        all_events_list = json.load(f)["events"]
    with open(pub_events_path, encoding="utf-8") as f:
        pub_events_map = {e["id"]: e for e in json.load(f)["events"]}

    secs_by_book, sec_by_id, max_v = build_section_index(repo_root)
    csv_sections_map = load_csv_sections_map(csv_path)

    os.makedirs(os.path.join(t7_root, "prompts"), exist_ok=True)
    manifest_path = os.path.join(t7_root, "manifest.json")

    acquire_manifest_lock(lock_file)
    try:
        existing_manifest = {}
        if os.path.exists(manifest_path):
            try:
                with open(manifest_path, encoding="utf-8") as mf:
                    existing_manifest = json.load(mf)
            except Exception:
                existing_manifest = {}

        existing_events = {e["id"]: e for e in existing_manifest.get("events", [])}
        existing_chars = {c["id"]: c for c in existing_manifest.get("characterAnchors", [])}
        existing_locs = {l["id"]: l for l in existing_manifest.get("locationAnchors", [])}

        char_out = []
        for ch in CHARACTER_ANCHORS:
            prev = existing_chars.get(ch["id"], {})
            if ch["id"] == "twelve-apostles":
                prompt = (
                    f"Photorealistic 16:9 widescreen full-body studio group reference sheet on a single continuous seamless unadorned neutral warm limestone studio background "
                    f"(NO vertical black dividing line, NO split-screen seam, NO outdoor scenery), shot on ARRI Alexa 65 with 50mm prime lens, soft natural key light. "
                    f"Biblical group: {ch['en']} ({ch['zh']}, {ch['ref']}). Show EXACTLY TWELVE (12) distinct first-century Galilean Jewish men arranged in three clear groups of four (4 + 4 + 4 = 12 men total). "
                    f"Physical appearance & attire: {ch['desc']} "
                    f"Strict rule: {HAIR_RULE} "
                    f"Sharp photographic skin and hand-woven ancient textile detail, natural anatomy, zero text or labels in image."
                )
            else:
                prompt = (
                    f"Photorealistic 16:9 widescreen full-body & three-quarter character reference sheet on a single continuous seamless unadorned neutral warm limestone studio background "
                    f"(NO vertical black dividing line, NO split-screen border, NO seam down the middle), shot on ARRI Alexa 65 with 50mm prime lens, warm directional side key light. "
                    f"Biblical character: {ch['en']} ({ch['zh']}, {ch['ref']}). "
                    f"Physical appearance & attire: {ch['desc']} "
                    f"Strict rule: {HAIR_RULE} "
                    f"Sharp photographic skin and hand-woven ancient textile detail, natural anatomy, zero text or labels in image."
                )
            char_out.append({
                **prev,
                **ch,
                "prompt": prompt,
                "status": prev.get("status", "not_started"),
                "file": prev.get("file", f"anchors/characters/{ch['id']}.png"),
                "updatedAt": prev.get("updatedAt"),
            })

        loc_out = []
        for loc in LOCATION_ANCHORS:
            prev = existing_locs.get(loc["id"], {})
            prompt = (
                f"Photorealistic 16:9 widescreen uninhabited architectural & environmental reference plate (PURE ENVIRONMENT PLATE: ZERO people, ZERO human figures, ZERO crowds), "
                f"shot on ARRI Alexa 65 with 24mm/35mm prime lens, natural golden hour / biblical lighting. "
                f"Biblical setting: {loc['en']} ({loc['zh']}, {loc['ref']}). "
                f"Details: {loc['desc']} Authentic ancient Near Eastern archaeology and 1:1 biblical proportions, "
                f"CRITICAL ZERO-TEXT RULE: zero text, zero inscriptions, zero hieroglyphs, zero letters, and zero watermarks anywhere in the image."
            )
            loc_out.append({
                **prev,
                **loc,
                "prompt": prompt,
                "status": prev.get("status", "not_started"),
                "file": prev.get("file", f"anchors/locations/{loc['id']}.png"),
                "updatedAt": prev.get("updatedAt"),
            })

        events_out = []
        tier_counts = {"S": 0, "A": 0, "B": 0}
        for idx, aev in enumerate(all_events_list):
            eid = aev["id"]
            pev = pub_events_map.get(eid, {})
            ev = {
                "id": eid,
                "idx": idx + 1,
                "b": aev["book"],
                "s": aev["start"],
                "e": aev["end"],
                "zh": aev["zh"],
                "en": aev["en"],
                "ref": aev["ref"],
                "refZh": aev["refZh"],
                "y0": pev.get("y0", aev.get("yearEarly")),
                "placeNames": aev.get("placeNames", []),
                "placeNamesZh": aev.get("placeNamesZh", []),
            }
            prev = existing_events.get(eid, {})
            prim_sec_id, sec_ids, sec_source, sec_info = resolve_event_section(
                ev, prev, secs_by_book, sec_by_id, csv_sections_map, max_v
            )
            excerpt_zh, excerpt_en, v_count = extract_passage_excerpt(ev["b"], ev["s"], ev["e"], max_v)
            tier, planned_duration_sec = classify_event_tier(ev, v_count, sec_info)
            tier_counts[tier] += 1
            char_ids = match_character_anchors(ev, sec_info)
            loc_id = match_location_anchor(ev, sec_info)
            img_prompt, vid_prompt = build_event_prompts(
                ev, char_ids, loc_id, tier, planned_duration_sec, excerpt_zh, excerpt_en, sec_info
            )

            # Never infer status from file existence; preserve existing status
            img_status = prev.get("imageStatus", "not_started")
            vid_status = prev.get("videoStatus", "not_started")
            # Preserve existing durationSec if set (e.g. measured by video line)
            duration_sec = prev["durationSec"] if ("durationSec" in prev and prev["durationSec"] is not None) else planned_duration_sec

            prompt_record = {
                "id": eid,
                "index": idx + 1,
                "b": ev["b"],
                "s": ev["s"],
                "e": ev["e"],
                "zh": ev["zh"],
                "en": ev["en"],
                "ref": ev["ref"],
                "refZh": ev["refZh"],
                "primarySection": prim_sec_id,
                "sections": sec_ids,
                "sectionSource": sec_source,
                "sectionTitleZh": sec_info["zh_title"],
                "sectionTitleEn": sec_info["en_title"],
                "sectionContextZh": sec_info["zh_context"],
                "sectionContextEn": sec_info["en_context"],
                "tier": tier,
                "durationSec": duration_sec,
                "isPilot12": eid in PILOT_12_IDS,
                "characterAnchors": char_ids,
                "locationAnchor": loc_id,
                "excerptZh": excerpt_zh,
                "excerptEn": excerpt_en,
                "imagePrompt": img_prompt,
                "videoPrompt": vid_prompt,
            }
            with open(os.path.join(t7_root, "prompts", f"{eid}.json"), "w", encoding="utf-8") as pf:
                json.dump(prompt_record, pf, ensure_ascii=False, indent=2)

            # Preserve all unknown/existing fields from prev, remove retired sum/sumEn
            merged_event = {k: v for k, v in prev.items() if k not in ("sum", "sumEn")}
            merged_event.update({
                "id": eid,
                "index": idx + 1,
                "b": ev["b"],
                "s": ev["s"],
                "e": ev["e"],
                "zh": ev["zh"],
                "en": ev["en"],
                "ref": ev["ref"],
                "refZh": ev["refZh"],
                "primarySection": prim_sec_id,
                "sections": sec_ids,
                "sectionSource": sec_source,
                "sectionTitleZh": sec_info["zh_title"],
                "sectionTitleEn": sec_info["en_title"],
                "y0": ev["y0"],
                "tier": tier,
                "durationSec": duration_sec,
                "isPilot12": eid in PILOT_12_IDS,
                "characterAnchors": char_ids,
                "locationAnchor": loc_id,
                "imageStatus": img_status,
                "videoStatus": vid_status,
                "imageUpdatedAt": prev.get("imageUpdatedAt"),
                "videoUpdatedAt": prev.get("videoUpdatedAt"),
                "imageNote": prev.get("imageNote", ""),
                "videoNote": prev.get("videoNote", ""),
                "evidenceState": prev.get("evidenceState", "missing"),
            })
            events_out.append(merged_event)

        prev_summary = existing_manifest.get("summary", {})
        summary = {
            **prev_summary,
            "updatedAt": int(time.time()),
            "totalEvents": len(events_out),
            "tierCounts": tier_counts,
            "characterAnchorsTotal": len(char_out),
            "characterAnchorsPass": sum(1 for c in char_out if c["status"] == "pass"),
            "locationAnchorsTotal": len(loc_out),
            "locationAnchorsPass": sum(1 for l in loc_out if l["status"] == "pass"),
            "imagesPass": sum(1 for e in events_out if e["imageStatus"] == "pass"),
            "videosPass": sum(1 for e in events_out if e["videoStatus"] == "pass"),
            "pilot12ImagesPass": sum(1 for e in events_out if e["isPilot12"] and e["imageStatus"] == "pass"),
            "pilot12VideosPass": sum(1 for e in events_out if e["isPilot12"] and e["videoStatus"] == "pass"),
        }

        manifest = {
            **existing_manifest,
            "project": "Yahweh's World — 1,443 Photorealistic Biblical Scenes & Videos (Nano Banana 2.1 + Gemini Omni 1.1)",
            "storageRoot": t7_root,
            "summary": summary,
            "pilot12Ids": PILOT_12_IDS,
            "characterAnchors": char_out,
            "locationAnchors": loc_out,
            "events": events_out,
        }

        tmp_path = f"{manifest_path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as mf:
            json.dump(manifest, mf, ensure_ascii=False, indent=2)
        os.replace(tmp_path, manifest_path)
        print("Initialized realistic-cinema-v1 manifest:", json.dumps(summary, ensure_ascii=False))
        return manifest
    finally:
        release_manifest_lock(lock_file)


if __name__ == "__main__":
    main()
