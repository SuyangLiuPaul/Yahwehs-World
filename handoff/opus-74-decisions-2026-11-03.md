# The 74 escalated squares: decisions (2026-11-03)

The owner delegated the 74 three- and four-strike squares of
`handoff/picture-completion-status-2026-11-03.md` §3 B-E to me (Opus 5.5) on 2026-11-03. I looked at
every one of the 74 live pictures (full resolution crops of the region each reviewer named, not only
the thumbnail) together with its stored reviewer note, and ruled per square.

**Counts: 52 ACCEPT, 22 REDRAW, 0 LEAVE.**

| | ACCEPT | REDRAW | LEAVE |
|---|---|---|---|
| B anachronism (19) | 12 | 7 | 0 |
| C mensHair (29) | 24 | 5 | 0 |
| D modesty (22) | 15 | 7 | 0 |
| E theology keys (4) | 1 | 3 | 0 |
| **total (74)** | **52** | **22** | **0** |

Measured with the same scan before and after (`gate_check.py square --all --summary`):
**1,368 PASS / 75 FAIL → 1,420 PASS / 23 FAIL**, and "state=pass but gate FAIL" stayed 0.
The 23 that still fail are the 22 redraws plus `matthew-7-13`, whose own redraw was queued earlier
today. Regression check of the previous fix (the three restored PNGs and the daniel-5-1 inscription):
`gate_check square daniel-5-1 2-timothy-1-1 jeremiah-32-1 psalms-126-1` → 4 PASS, unchanged.

## The standard I applied

The owner's rule of 2026-10-30 is that the Bible governs (「圣经原则没错就行」), and that a veto note
which is not in the veto table is not a rule. So a square is **ACCEPT** only when the failing veto was
applied against the passage's own account, or against the period the event actually happened in.
Everything else is **REDRAW**. Nothing was accepted that depicts God the Father or Christ in a
forbidden way, nothing with a Trinity composition, and nothing that would mislead about Scripture.

**The veto table is unchanged.** `gate_check.VETO_TABLE` still reads `veto-v1-2026-10-23` and
`VETO_TABLE_SHA256` is the same, so every review ever written against it is still valid. No reviewer's
answer or note was rewritten: each accepted square's `review/<id>.json` still says `fail` on disk, and
the acceptance sits beside it as a separate, signed record (see "How an acceptance is recorded").

Three tests I used repeatedly, written down so the next agent rules the same way:

1. **Trumpets.** A straight valveless horn in an Old Testament Israelite scene is not an anachronism:
   Numbers 10:2 commands two trumpets of beaten silver, and 1 Chronicles 15:24,28, 2 Chronicles
   29:26-28 and Psalm 98:6 put them in exactly this worship. The veto's "brass trumpets" means the
   modern valved instrument, which none of these pictures draws.
2. **Men's hair.** The principle is 1 Corinthians 11:14 (a man's long hair is a shame to him) and
   Leviticus 19:27 (do not round the corners of the head). A short crop that stops at or just above the
   collar satisfies both; the squared block at the nape is how this voxel style draws short hair, and
   it is not a buzz cut or a fade. Hair that visibly falls onto the shoulders is a REDRAW, and
   anything touching **Jesus'** hair is a REDRAW whatever I think, because that iconography is the
   whole reason the rule exists.
3. **Modesty.** The veto is aimed at nakedness (Exodus 28:42, Isaiah 47:2-3), not at a period uniform.
   A Roman soldier's regulation knee-length military tunic, a prisoner's rags, a Bronze-Age military
   kilt or a smith's working tunic at the forge is the dress of the men the passage itself names, and is
   accepted. A principal figure, a child's errand-runner or a workman drawn with the hem at the upper
   thigh is a REDRAW: nothing in the passage requires it, and the fix is one sentence of prompt.

## Decisions

| square | strikes | failing veto(s) | decision | reason / what to change |
|---|---|---|---|---|
| 1-chronicles-11-1 | 3 | anachronism | **ACCEPT** | The straight valveless horn is OT Israel's own instrument, not a modern brass instrument: Numbers 10:2 commands two trumpets of beaten silver and the passage's own worship uses them (1 Chronicles 1... |
| 1-john-1-1 | 3 | jesusHair,mensHair | **REDRAW** | Jesus and every disciple must have clearly cropped hair: the nape bare, the hair ending above the robe collar, no hair block beside the jaw, never shoulder-length. Not shaved, not buzz-cut, no fade... |
| 1-samuel-2-12 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| 1-samuel-20-1 | 3 | modesty | **REDRAW** | The boy who runs for the arrows must wear a plain tunic that falls below his knees - no shorts, no bare thighs. Keep him running, keep the bow, the arrows and Jonathan where they are. |
| 1-samuel-31-1 | 3 | modesty | **ACCEPT** | The soldiers wear the Bronze-Age military kilt of their own day; the reviewer's answer was 'unclear', nothing is nude and there is no spraying gore. |
| 2-kings-10-1 | 3 | anachronism | **REDRAW** | The two spear-bearing guards at the palace gate must not wear a Roman or Greek cuirass or a strap skirt (pteruges). Dress them as 9th-century-BC Israelite guards: a knee-length tunic under a plain ... |
| 2-kings-24-1 | 3 | anachronism | **REDRAW** | Remove the many-arched stone bridge over the water at the left. Leave the river open, with a shallow ford or a low timber pier causeway on wooden posts instead. No rounded masonry arches anywhere i... |
| 2-samuel-19-1 | 3 | anachronism | **REDRAW** | The soldier in the Roman segmented cuirass with the strap skirt and short sword must be redrawn as a 10th-century-BC Israelite soldier: knee-length tunic, plain bronze scale corselet, spear or long... |
| acts-16-25 | 3 | modesty | **ACCEPT** | Acts 16:23-24 puts these men in the inner prison in the stocks; a prisoner's short ragged garment is the account's own condition, and nothing is nude. |
| acts-16-6 | 3 | anachronism | **ACCEPT** | Acts 16 is first-century Macedonia; a Greek temple on the hill of a Macedonian harbour town is historically right. The veto's ban is aimed at Greek temples in Old Testament scenes. |
| acts-20-7 | 3 | duplicatedPerson,modesty | **ACCEPT** | Acts 20:7-12 narrates Paul both in the upper room and below; the young man is clothed. |
| acts-22-22 | 3 | modesty | **ACCEPT** | These are Roman soldiers in the regulation knee-length military tunic, the dress of the very soldiers Acts names; nothing is nude or sexualised, and the modesty veto is aimed at nakedness, not at a... |
| acts-22-30 | 3 | modesty | **ACCEPT** | These are Roman soldiers in the regulation knee-length military tunic, the dress of the very soldiers Acts names; nothing is nude or sexualised, and the modesty veto is aimed at nakedness, not at a... |
| acts-23-11 | 3 | modesty | **ACCEPT** | The reviewer could not see past the bars and answered 'unclear'; on inspection Paul and the men in the barracks room are in full-length robes. These are Roman soldiers in the regulation knee-length... |
| acts-23-23 | 3 | modesty | **ACCEPT** | These are Roman soldiers in the regulation knee-length military tunic, the dress of the very soldiers Acts names; nothing is nude or sexualised, and the modesty veto is aimed at nakedness, not at a... |
| acts-24-1 | 3 | modesty | **ACCEPT** | These are Roman soldiers in the regulation knee-length military tunic, the dress of the very soldiers Acts names; nothing is nude or sexualised, and the modesty veto is aimed at nakedness, not at a... |
| acts-27-1 | 3 | modesty | **ACCEPT** | These are Roman soldiers in the regulation knee-length military tunic, the dress of the very soldiers Acts names; nothing is nude or sexualised, and the modesty veto is aimed at nakedness, not at a... |
| daniel-11-1 | 4 | mensHair | **ACCEPT** | The men's hair is a short crop that stops at or above the collar and no scalp is shaved or faded; the squared block is how this voxel style draws short hair, so 1 Corinthians 11:14 and Leviticus 19... |
| ephesians-4-1 | 3 | mensHair,modesty | **REDRAW** | The workers on the upper-right scaffold must wear working tunics that fall below the knee; no bare thighs. Everything else in the scene stays as it is. |
| ephesians-6-10 | 4 | anachronism | **ACCEPT** | Ephesians is first-century Roman Asia, where an arched stone bridge is historically right; the veto's ban is aimed at Roman bridges in Old Testament scenes. |
| esther-2-1 | 3 | mensHair | **ACCEPT** | The men's hair is a short crop that stops at or above the collar and no scalp is shaved or faded; the squared block is how this voxel style draws short hair, so 1 Corinthians 11:14 and Leviticus 19... |
| exodus-13-17 | 3 | anachronism | **REDRAW** | Remove the paddle-shaped prickly-pear and the spiny columnar succulents at the bottom of the scene. Use Sinai desert plants instead: acacia, tamarisk, white broom (rotem) and dry tussock grass. No ... |
| exodus-32-1 | 3 | mensHair | **ACCEPT** | The men's hair is a short crop that stops at or above the collar and no scalp is shaved or faded; the squared block is how this voxel style draws short hair, so 1 Corinthians 11:14 and Leviticus 19... |
| ezekiel-33-1 | 4 | anachronism | **ACCEPT** | Ezekiel 33:3 requires the watchman to blow the trumpet; Numbers 10:5,9 gives the silver trumpet as the alarm. The drawn horn is straight and valveless, not a modern brass instrument. |
| ezekiel-36-22 | 3 | anachronism,mensHair | **REDRAW** | Remove the multi-span round-arched stone bridge in the middle distance. Leave a plain riverbank with a shallow ford. No masonry arches anywhere. |
| ezekiel-37-1 | 3 | modesty | **REDRAW** | The man in red in the foreground and the kneeling man in white must wear tunics that fall below the knee; no bare thighs on any of the revived men. Keep the bones, the valley and the prophet. |
| ezekiel-38-1 | 3 | anachronism,modesty | **REDRAW** | Remove every branching columnar cactus from both rocky slopes and from beside the fortress; use cypress, terebinth and dry thorn scrub instead. The fleeing men on the right must wear tunics that fa... |
| ezekiel-8-1 | 3 | modesty | **ACCEPT** | Ezekiel 8:5-12 requires the image of jealousy and the pourtrayed abominations to be shown; the kilted horned figure is a carved idol, not a person, and its kilt is the historical form of such idols. |
| ezra-3-8 | 3 | mensHair | **ACCEPT** | The men's hair is a short crop that stops at or above the collar and no scalp is shaved or faded; the squared block is how this voxel style draws short hair, so 1 Corinthians 11:14 and Leviticus 19... |
| ezra-6-1 | 3 | mensHair | **ACCEPT** | The men's hair is a short crop that stops at or above the collar and no scalp is shaved or faded; the squared block is how this voxel style draws short hair, so 1 Corinthians 11:14 and Leviticus 19... |
| genesis-21-22 | 3 | mensHair | **ACCEPT** | The men's hair is a short crop that stops at or above the collar and no scalp is shaved or faded; the squared block is how this voxel style draws short hair, so 1 Corinthians 11:14 and Leviticus 19... |
| genesis-27-1 | 3 | mensHair | **ACCEPT** | The men's hair is a short crop that stops at or above the collar and no scalp is shaved or faded; the squared block is how this voxel style draws short hair, so 1 Corinthians 11:14 and Leviticus 19... |
| genesis-41-1 | 3 | mensHair | **ACCEPT** | The men's hair is a short crop that stops at or above the collar and no scalp is shaved or faded; the squared block is how this voxel style draws short hair, so 1 Corinthians 11:14 and Leviticus 19... |
| genesis-46-1 | 4 | fakeText,modesty | **ACCEPT** | The only fail is on the exempt corner emblem; the scene itself is clean and the robe is long. |
| genesis-5-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| hebrews-3-7 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| hebrews-7-1 | 3 | godDepiction | **ACCEPT** | The crowned elder is Melchizedek, whom Genesis 14:18 names as king of Salem and priest of the most high God - a man, not God. He stands on the ground receiving Abram with bread and wine, with no ra... |
| isaiah-26-1 | 3 | anachronism | **REDRAW** | Remove the multi-arch stone bridge near the centre-right. Put a shallow ford with stepping stones there instead. No masonry arches anywhere in this Old Testament scene. |
| isaiah-36-1 | 3 | anachronism | **REDRAW** | Remove the tall pitched-roof tower with the cross-shaped finial above the city in the upper right. In its place draw a plain square Judean fortress tower: flat roof, simple crenellations, no spire,... |
| isaiah-40-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| isaiah-45-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| jeremiah-10-1 | 3 | modesty | **REDRAW** | The hammering worker at the left and the green- and blue-clad workers must wear working tunics that fall below the knee; no bare thighs. Keep the idol workshop exactly as it is. |
| jeremiah-39-1 | 3 | anachronism,modesty | **ACCEPT** | A Babylonian soldier's military kilt, and the plants the reviewer read as cactus are cypress and shrub. |
| jeremiah-50-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| joel-3-1 | 3 | mensHair,modesty | **ACCEPT** | Short hair at the collar, and the smith's knee-length working tunic is the dress Joel 3:10 requires. |
| john-19-1 | 3 | anachronism | **ACCEPT** | John 19 is the Roman governor's praetorium in first-century Jerusalem; columns, a pediment and balustrades are the right architecture for it. |
| joshua-5-13 | 3 | anachronism,godDepiction | **REDRAW** | Keep the commander as a man with his sword drawn - Joshua 5:13 says a man stood over against him - but dress him for the Late Bronze Age: a long belted tunic and a plain bronze scale corselet, no R... |
| joshua-6-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| judges-16-23 | 3 | anachronism,modesty | **ACCEPT** | Samson's torn garment is the account's own condition; pointed arches are not a veto-table item. |
| micah-7-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| numbers-10-11 | 3 | anachronism | **ACCEPT** | Both flagged items are this verse's own furniture: Numbers 10:2,5 commands the silver trumpets for the journeying of the camps, and Numbers 2:2 commands every man to pitch by his own standard with ... |
| obadiah-1-1 | 3 | modesty | **ACCEPT** | Obadiah 1:3-4 is the fall from the clefts of the rock; the falling figure is a small clothed background man whose hem is lifted by the fall itself, and nothing is nude. |
| obadiah-1-17 | 3 | anachronism,modesty | **REDRAW** | Remove the Greek columned temple with the triangular pediment at the upper right and the multi-arched stone bridge over the river; draw Iron-Age Judean flat-roofed stone buildings and a shallow for... |
| proverbs-31-10 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| psalms-104-1 | 3 | modesty | **ACCEPT** | The figure is a child in a tunic, the reviewer's own answer was 'unclear', and nothing is nude; the modesty veto is aimed at nakedness. |
| psalms-115-1 | 3 | modesty | **REDRAW** | The two men breaking the idol at the lower left must wear working tunics that fall below the knee; no bare thighs. Keep the broken idol and the worshippers. |
| psalms-117-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| psalms-21-1 | 3 | anachronism | **ACCEPT** | The straight valveless horn is OT Israel's own instrument, not a modern brass instrument: Numbers 10:2 commands two trumpets of beaten silver and the passage's own worship uses them (trumpeters at ... |
| psalms-24-1 | 3 | anachronism | **ACCEPT** | The straight valveless horn is OT Israel's own instrument, not a modern brass instrument: Numbers 10:2 commands two trumpets of beaten silver and the passage's own worship uses them (Psalm 24 is th... |
| psalms-26-1 | 3 | anachronism | **ACCEPT** | The straight valveless horn is OT Israel's own instrument, not a modern brass instrument: Numbers 10:2 commands two trumpets of beaten silver and the passage's own worship uses them (priests with t... |
| psalms-31-1 | 3 | anachronism,modesty | **REDRAW** | Remove the three large wooden crosses mounted on the room wall: this is David's chamber, centuries before the cross, and nothing Christian belongs in the room. Draw plain plaster, a lamp niche and ... |
| psalms-76-1 | 3 | anachronism,mensHair | **ACCEPT** | Hair is a short crop at the collar, and the horn is the straight valveless trumpet of Numbers 10:2. |
| psalms-82-1 | 3 | anachronism,mensHair | **REDRAW** | Replace the colonnaded buildings with triangular pediments on the background terraces (upper right and far left) with Judean and Ancient Near Eastern architecture: flat-roofed stone halls, terraced... |
| psalms-84-1 | 3 | anachronism | **ACCEPT** | The straight valveless horn is OT Israel's own instrument, not a modern brass instrument: Numbers 10:2 commands two trumpets of beaten silver and the passage's own worship uses them (trumpets in th... |
| psalms-88-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn. |
| psalms-91-1 | 3 | anachronism,godDepiction,headCount,jesusHair | **REDRAW** | Remove the red-and-white-robed teacher figure entirely: this is an Old Testament psalm and God must never be drawn in human form, and no figure of Jesus belongs in it. Draw the shelter of the Most ... |
| psalms-94-1 | 4 | duplicatedPerson,trinityComposition | **REDRAW** | No three similar figures anywhere. Give the men on the upper steps clearly different ages, hair colour, beard shape and robe colour, and place them at different heights and distances, never symmetr... |
| psalms-97-1 | 3 | anachronism | **ACCEPT** | The straight valveless horn is OT Israel's own instrument, not a modern brass instrument: Numbers 10:2 commands two trumpets of beaten silver and the passage's own worship uses them (the enthroneme... |
| revelation-11-1 | 3 | duplicatedPerson,mensHair | **ACCEPT** | The passage requires the witnesses both prophesying and lying dead; the hair is a short crop. |
| revelation-2-12 | 3 | anachronism,mensHair | **ACCEPT** | Pergamum's fortified acropolis is right, towers are not a veto-table item, and the hair is short. |
| revelation-8-1 | 3 | mensHair | **ACCEPT** | The hair is a short crop ending at the collar, not hair falling on the shoulders; 1 Corinthians 11:14 forbids long hair on a man, which is not what is drawn; the figures are angels at the altar, an... |
| revelation-9-1 | 3 | mensHair,modesty | **REDRAW** | The fleeing bearded man at the far left and the green-clad child in front of him must wear garments that fall below the knee; no bare thighs. His hair must end above his collar, not on his shoulders. |
| song-of-songs-5-1 | 3 | anachronism | **ACCEPT** | The note is about crenellated towers, which the veto table does not list; the owner ruled on 2026-10-30 that tower/castle notes are not a rule. The Song's own imagery is towers (4:4, 7:4, 8:9-10). |
| zechariah-8-1 | 3 | anachronism | **REDRAW** | Remove the Greek colonnaded temple complex on the hill at the upper right. Draw post-exilic Judean hill terraces instead: flat-roofed stone houses, olive groves and vineyard walls. No columns with ... |
## Per-group rationale

### B · anachronism (19): 12 accept, 7 redraw

Accepted because the passage or the period requires what was flagged:

- **Straight metal trumpets** (`1-chronicles-11-1`, `psalms-21-1`, `psalms-24-1`, `psalms-26-1`,
  `psalms-84-1`, `psalms-97-1`, `ezekiel-33-1`, `numbers-10-11`, and `psalms-76-1` in group C) — test 1
  above. `numbers-10-11` is the clearest case of all: Numbers 10:2,5 commands the silver trumpets *for
  the journeying of the camps*, which is this very verse, and Numbers 2:2 commands every man to pitch
  by his own standard with the ensign of his father's house, which is the banner the reviewer flagged.
  `ezekiel-33-1` is the watchman of Ezekiel 33:3, whose one job in the verse is to blow the trumpet.
- **First-century Greek and Roman architecture in New Testament scenes** (`acts-16-6` Macedonia,
  `john-19-1` Pilate's praetorium, `ephesians-6-10` Roman Asia). The table's ban on Greek temples and
  Roman arched bridges is aimed at Old Testament scenes; in these three it is the right architecture.
- **Towers** (`song-of-songs-5-1`, and `revelation-2-12` in group C). Crenellated towers and castle-style
  battlements are not in the veto table; the owner ruled on 2026-10-30 that the tower/castle note was
  wrongly added and is not a rule — this is the same ground as the 86 he accepted then. The Song's own
  imagery is towers (4:4, 7:4, 8:9-10), and Pergamum really had a fortified acropolis.

Redrawn because the thing flagged is in the table, sits in an Old Testament scene and nothing in the
passage asks for it: Roman armour (`2-kings-10-1`, `2-samuel-19-1`), Roman arched bridges
(`2-kings-24-1`, `isaiah-26-1`, and `ezekiel-36-22` in group C), American cacti (`exodus-13-17`),
Greek temples (`zechariah-8-1`, and `psalms-82-1` in group C, `obadiah-1-17` in group D). `isaiah-36-1`
is the one I would redraw even if it were not in the table: the tower above Hezekiah's Jerusalem has a
**cross** on its finial, which is a Christian building seven centuries early.

### C · mensHair (29): 24 accept, 5 redraw

Two different complaints were both recorded as `mensHair`, and they deserve opposite answers.

- **"flat-top / buzz / blocky, not varied"** (`esther-2-1`, `exodus-32-1`, `ezra-3-8`, `ezra-6-1`,
  `genesis-21-22`, `genesis-27-1`, `genesis-41-1`, `daniel-11-1`) — accepted. Looked at full size, no
  scalp is shaved and no side is faded; the hair is a short cut drawn as a block because every head in
  this gallery is drawn as blocks. Leviticus 19:27 is satisfied, not broken. `genesis-41-1` is doubly
  right: these are Egyptians, who cropped their hair and wore wigs, and Genesis 41:14 has Joseph shave
  himself before Pharaoh.
- **"hair down the nape to the collar"** (the 16 others) — accepted. The hair ends at the collar; none of
  these men has hair falling on his shoulders, which is what 1 Corinthians 11:14 is about. The elderly
  prophets' white crops are the commonest case.
- Redrawn: `1-john-1-1` (**Jesus** — not a call I will make on his behalf, so the prompt now demands a
  bare nape), `ephesians-4-1` and `revelation-9-1` (short tunics, test 3), `ezekiel-36-22` (arched
  bridge), `psalms-82-1` (Greek temples; its hair was fine).
- `revelation-11-1` was accepted on its `duplicatedPerson` key as well: Revelation 11:3-9 itself
  requires both the witnesses prophesying and their dead bodies lying in the street, so showing both in
  one frame is the passage's own sequence, not two different people. `acts-20-7` is the same shape
  (Acts 20:9-10 has Paul in the upper room and then below, embracing Eutychus).

### D · modesty (22): 15 accept, 7 redraw

Accepted: the Roman soldiers and their attendants in Acts (`acts-22-22`, `acts-22-30`, `acts-23-11`,
`acts-23-23`, `acts-24-1`, `acts-27-1`), the prisoners in the inner prison (`acts-16-25`), Eutychus
(`acts-20-7`), the Bronze-Age soldiers at Gilboa (`1-samuel-31-1`), the Babylonian guard at the breach
(`jeremiah-39-1`), Samson in the prison-house garment of Judges 16:21 (`judges-16-23`), the smith at
the forge of Joel 3:10 (`joel-3-1`, group C), the falling Edomite of Obadiah 1:3-4 (`obadiah-1-1`), the
child in Psalm 104 (`psalms-104-1`), and the carved idol of Ezekiel 8:5-12 (`ezekiel-8-1` — an idol is
not a person, and its kilt is the historical form of such images, which the passage requires to be
shown). Five of these were only ever answered "unclear", not "fail".

`genesis-46-1` is accepted on different ground again: its only hard fail is `fakeText` on the open-book
emblem in the **top-left corner**, which the owner already ruled is a design element and not scene
content (2026-10-28, `requeue_emblem_only_fails.py`). The scene itself is text-free and OCR is 0.

Two reviewer claims did not survive looking at the picture, and I have said so in the ledger rather
than quietly accepting: `jeremiah-39-1`'s "prickly-pear cacti" are cypress and desert shrub, and
`acts-23-11`'s man "behind the bars" is in a full-length robe.

Redrawn, because nothing in the passage puts the hem at the upper thigh: `1-samuel-20-1` (Jonathan's
lad), `ezekiel-37-1`, `jeremiah-10-1`, `psalms-115-1`, `ezekiel-38-1` (also cacti), `obadiah-1-17`
(also a Greek temple and an arched bridge), `psalms-31-1` (also three Christian crosses on the wall of
David's own chamber, which is the worst anachronism in the 74).

### E · theology keys (4): 1 accept, 3 redraw

- `hebrews-7-1` **accepted**. The crowned white-bearded elder is Melchizedek, whom Genesis 14:18 names
  as king of Salem and priest of the most high God: a man. He stands on the ground receiving Abram with
  bread and wine, with no rays, no throne in the sky and no worship directed to him, so God is not
  drawn in human form here. Drawing him as an earthly king-priest also works against the error that he
  was a divine being.
- `psalms-91-1` **redraw**, without discussion: it draws the shelter of the Most High as a robed human
  teacher who reads as Jesus, in an Old Testament psalm. That is the forbidden depiction outright.
- `psalms-94-1` **redraw**: three near-identical bearded men in matching robes under the rays. The
  reviewer could not clear it and neither can I; a questionable Trinity composition is never accepted.
- `joshua-5-13` **redraw** for its armour only. The `godDepiction` answer was "unclear" because the
  commander is in human form, but Joshua 5:13 says plainly "there stood a man over against him with his
  sword drawn", so the man stays. The Roman muscle cuirass, the red cape and the cactus go.

## How an acceptance is recorded (and how it lapses)

The 86 tower/castle fails were handled by *not re-reviewing* them, which left no machine-readable
record and no way for the gate to agree. This one does, modelled on the daniel-5-1 exception
(`handoff/32`):

1. `tools/scenes/square_accepts.json` (`square-accepts-v1`) — one entry per square, naming only the
   veto keys forgiven, each with its own reason, the Scripture reference, who decided and when.
   `tools/scenes/square_accepts.py` loads and validates it; a key outside the veto table or an empty
   reason raises rather than silently forgiving.
2. `gate_check.check_review` forgives exactly those keys on exactly that square, records them in
   `measured.acceptedVetoes` and warns `owner_accepted:<key>=<answer>`. Any key **not** accepted still
   fails, and the review's own `verdict: fail` still blocks the gate unless every non-passing key is
   accepted. Nothing else is relaxed for any square.
3. `gate_check.check_accept_binding` additionally requires the status file to carry an `owner_accept`
   block whose keys match the file and whose `live_sha256` is the live picture's SHA. **Redraw the
   picture and the acceptance lapses by itself** — it cannot leak onto a later image.
4. `tools/scenes/apply_square_accepts.py` writes that block (`--apply`, backing up each status file
   first; dry run prints the field-level diff). It never touches `review/<id>.json`, and never changes
   `independent_review`, `rework_reason` or `failed_vetoes`: the reviewer's verdict stays on disk as
   written. Where the square is in `content-qc-registry.json` it sets `registry_fix_verified` from the
   review's own `registryFix=pass` answer — the same evidence `sync_reviews.py` uses.
5. `sync_reviews.py` skips a square whose `owner_accept` block is bound to the SHA the review judged;
   without that it would drive all 52 back to `rework` within half an hour.
6. `tests/test_square_accepts.py` (22 tests): the veto table and its SHA are unchanged, a bad key or an
   empty reason raises, an unaccepted key beside an accepted one still fails, a new SHA lapses the
   acceptance, the apply tool never rewrites `independent_review`, and the promote loop leaves a bound
   acceptance alone.

## The 22 redraws

Each has a concrete, picture-specific correction in `tools/scenes/square_redraw_notes.json`, which
`build_rework_jobs.py` adds to the job under 「具体怎么改（必须照做，其余保持不变）」 **after** the
reviewer's own note, not instead of it. That matters: every one of these squares has three or four
finished redraws behind it, and they were all driven by the same reviewer sentence. The jobs are
queued (`codex-jobs/square-<id>.json`, written with `--ids ... --include-escalated`); the hourly draw
lanes take them from there. Delete a square's note once it passes.

Nothing was published, pushed, mailed or paid for. `PAID_IMAGE_API_DISABLED` is untouched, no key or
keychain was read, and no draw or review lane was run.
