# Every person and creature this app has to render

The buildings in this app are written as geometry from the measurements the
text states. People and animals cannot be: Scripture gives no dimensions for a
man, an ox or a dove. They are therefore **generated models** — the only meshes
in the repository that were not authored here — and they are held to four rules
that keep them from becoming an invention dressed as data.

1. **Scale is not optional.** Every figure is scaled to a stated height in
   metres and stood on `y = 0` (`src/walk/figures.ts`). A generator returns a
   mesh at whatever size it feels like; an ox the height of a dog would teach
   the ark wrong, and teaching the ark right is the only reason the page exists.
2. **Counts come from the text, never from the scene.** Where a passage counts
   — seven and seven, two and two, eight souls — that number is what is placed,
   and the placement is computed from the same numbers the room spacing is.
3. **Kinds are the text's; species are ours, and the card says which.** Genesis
   names the raven and the dove (8:7–12) and Leviticus names the camel unclean
   (11:4). The account of the loading names no other species anywhere. So one
   ox stands for "a clean kind" as a display choice, and every Evidence dialog
   that shows one says so.
4. **Provenance is recorded.** Model, prompt, job id, cost and terms go in
   `handoff/MANIFEST-assets.md` before the file is committed — including the
   jobs that were thrown away.
5. **Where the text DOES settle an appearance, it settles it.** The list is
   short, and every reference prompt has to carry it. So far it is one entry,
   and it overturns the most familiar picture there is — see *Hair* below.

**Pipeline** (the one that works; the first attempt did not):
`generate_image` → a clean full-body reference on a plain ground →
`tripo_h3_1_image_to_3d` (`texture_quality: detailed`, `geometry_quality:
detailed`) → `python3 scripts/pack-figure.py in.glb out.glb --colour 1536
--maps 512` → `public/models/`. Text-to-3D was tried first and produced 2,900
triangles under a smeared atlas with no face on it at all — the owner walked up
to one of the eight and said *八个人都没有眼睛*. Image-to-3D from a photographic
reference gives eyes, hands, sandal straps and toes at 19,000 triangles, and
the packing step takes the file from 2.6 MB to 1.0 MB.

### Hair — men are drawn short-haired

*Doth not even nature itself teach you, that, if a man have long hair, it is a
shame unto him?* — 1 Cor 11:14. It is the only statement anywhere in the
letters that bears on how a man wore his hair, and it settles the question for
every male figure in this app: **short.** The reference prompt says so, and a
generated man who comes back long-haired is rejected and regenerated.

This is not a small correction. The long-haired Jesus of nearly every painting,
film and children's Bible is an artistic convention — it descends from
classical and Byzantine models, not from anything in the text — and it is
almost certainly wrong. The app does not render him at all (below), but it does
render the twelve, the crowds, and every man from Adam onward, and all of them
are short-haired.

**The objection, answered, because it will be raised.** *Was he not a
Nazarite, and did not a Nazarite leave his hair uncut (Num 6:5)?* No: that
confuses **Nazarene** — 「拿撒勒人」, of the town, Matt 2:23 — with **Nazarite**,
the vow of Num 6. They are different words. And the text closes it from the
other side: he came *eating and drinking* and was called a winebibber (Matt
11:19; Luke 7:34), which a man under the vow could not have done (Num 6:3). So
the one argument ever offered for long hair fails on the text that supposedly
supports it.

The six figures already built pass this: the reference photograph for `man` is
short-haired and short-bearded.

---

## Built today

| Model | Height | Where it stands | Count | Basis |
|---|---|---|---|---|
| `man` | 1.72 m | ark, second deck | 4 | Gen 7:13 — Noah and his three sons |
| `woman` | 1.63 m | ark, second deck | 4 | Gen 7:13 — his wife and his sons' wives |
| `ox` | 1.45 m | ark, lower deck rooms | 14 | Gen 7:2 — of a clean kind, seven and seven. **Species is a display choice** |
| `camel` | 2.05 m | ark, lower deck rooms | 2 | Gen 7:2 with Lev 11:4 — the camel is **named** unclean |
| `dove` | 0.30 m | ark, second deck rails | 14 | Gen 7:3; 8:8 — of fowls, seven and seven |
| `raven` | 0.50 m | ark, second deck | 1 | Gen 8:7 — the one sent out first |
| `shepherd-v1` | 1.70 m | globe staffage | — | display only; names no one |
| `traveller-v1` | 1.70 m | globe staffage | — | display only; names no one |

Eight of the ten are the ark's. Two figures serve eight people and two serve
sixteen beasts, because a model is loaded once and placed many times.

---

## Still to make, unit by unit

Every unit of `src/plan-units.ts` whose planned scene has something living in
it. **Count** is what the text states; *not counted* means the passage gives a
scene and no number, and the scene will show a plausible few and say so.
Figures marked **(reuse)** are already built.

### Genesis to Joshua

| Unit | Figures | Count | Verse |
|---|---|---|---|
| creation | beasts of the field, fowl, creeping things, fish, sea creatures | not counted, "after his kind" | Gen 1:20–25 |
| creation | the man and the woman | 2 | Gen 1:27; 2:22 |
| fall | the serpent; cherubim with a flaming sword | serpent 1; cherubim not counted | Gen 3:1, 24 |
| flood | *(reuse)* man, woman, ox, camel, dove, raven | done | Gen 7:2–3, 13 |
| babel | builders, brick moulds | not counted | Gen 11:3 |
| abraham | Abraham, three visitors, a herd, a flock, a ram in a thicket | visitors 3; ram 1 | Gen 18:2; 22:13 |
| isaac-jacob | Jacob, angels on the ladder, sheep, goats (ringstraked, speckled) | not counted | Gen 28:12; 30:39 |
| joseph | Joseph, his brothers, Egyptians, oxen, asses, seven fat and seven lean kine | brothers 11; kine 7 + 7 | Gen 41:2–4; 42:3 |
| exodus | Israelites on foot, Egyptian horses and chariots, frogs, locusts, livestock | men 600,000 on foot beside children; chariots 600 chosen | Ex 12:37; 14:7 |
| sinai | Moses, Aaron, the people at the bounds, a golden calf | calf 1 | Ex 19:17; 32:4 |
| tabernacle | priests in their garments, a bullock, two rams, a lamb morning and evening | bullock 1; rams 2; lambs 2 a day | Ex 29:1, 38–39 |
| leviticus | the five offerings' beasts: bullock, sheep, goat, turtledove, young pigeon | by offering | Lev 1–7 |
| wilderness | the four camps by their standards, Levites about the tent | 603,550 numbered | Num 2:32 |
| deuteronomy | six tribes on Gerizim, six on Ebal | 6 + 6 | Deut 27:12–13 |
| conquest | priests bearing the ark, seven priests with seven trumpets, armed men | priests 7; circuits 7 | Josh 6:4 |
| judges | Gideon's three hundred with pitchers, torches and trumpets | 300 | Judg 7:16 |
| ruth | reapers, gleaners, ten elders in the gate | elders 10 | Ruth 2:3; 4:2 |

### Samuel to Chronicles

| Unit | Figures | Count | Verse |
|---|---|---|---|
| samuel-ark | Eli, Samuel, Philistine soldiers, the ark carried off | — | 1 Sam 4 |
| saul | David; **Goliath, six cubits and a span** — the one figure in the canon whose height is given | Goliath 1 | 1 Sam 17:4 |
| david | the ark's bearers, oxen, David dancing, six paces and a sacrifice | oxen and fatlings at six paces | 2 Sam 6:13 |
| solomon | priests, Levites, singers, the sacrifice at the dedication | oxen 22,000; sheep 120,000 | 1 Kgs 8:63 |
| divided | two calves of gold | 2 | 1 Kgs 12:28–29 |
| elijah | Elijah, 450 prophets of Baal, a bullock on each altar | prophets 450; bullocks 2 | 1 Kgs 18:19–23 |
| elisha | the Shunammite, her husband, the child, an ass | — | 2 Kgs 4 |
| fall-israel | Assyrian soldiers, captives | — | 2 Kgs 17:5–6 |
| fall-judah | Chaldean soldiers, captives, the vessels carried away | — | 2 Kgs 25:13–17 |
| chronicles | workmen, bearers of burdens, hewers | 70,000 + 80,000 | 1 Chr 22:2, 15 |

### Return to the prophets

| Unit | Figures | Count | Verse |
|---|---|---|---|
| return | returning families, priests, singers, horses, mules, camels, asses | horses 736; mules 245; camels 435; asses 6,720 | Ezra 2:66–67 |
| nehemiah | builders on the wall, each with a weapon and a hand to the work | — | Neh 4:17 |
| esther | the king, the guests, servants at the feast | guests: all the people in Shushan, seven days | Esth 1:5 |
| job | Job, his friends, oxen, asses, sheep, camels, and then double | first 7,000 sheep, 3,000 camels, 500 yoke oxen, 500 asses; after, double | Job 1:3; 42:12 |
| psalms | pilgrims going up | — | Ps 122:4 |
| wisdom | the bride and the bridegroom in the garden | — | Song 4:12 |
| isaiah | **seraphim, each having six wings** | wings 6 each | Isa 6:2 |
| jeremiah | the potter at his wheel | 1 | Jer 18:3 |
| ezekiel | **four living creatures**, each with four faces (man, lion, ox, eagle) and four wings; wheels full of eyes | creatures 4; faces 4; wings 4 | Ezek 1:5–18 |
| ezekiel-temple | priests in the chambers, the altar's offerings | — | Ezek 42:13 |
| daniel | the image of gold; the three in the furnace; the fourth in the fire; lions | image 1; men 3 + 1 | Dan 3:1, 25 |
| minor | Nineveh's people and cattle | 120,000 who cannot discern, and much cattle | Jonah 4:11 |

### The Gospels and Acts

| Unit | Figures | Count | Verse |
|---|---|---|---|
| matthew | the multitude on the mountain; the wise men; Herod's soldiers | wise men *not numbered* — the text counts gifts, not men | Matt 2:11; 5:1 |
| mark | the twelve in a boat, fishermen, the storm | 12 | Mark 4:35–38 |
| luke | Mary, Joseph, the child in a manger, shepherds, an ox and an ass | shepherds not counted; **the ox and the ass are not in the text** and must be omitted or flagged | Luke 2:7–8 |
| john | worshippers in Herod's courts, money changers, oxen, sheep, doves | — | John 2:14 |
| acts-jerusalem | the hundred and twenty; the three thousand added | 120; 3,000 | Acts 1:15; 2:41 |
| acts-scattered | Cornelius, his household, Peter, the sheet of creatures | — | Acts 10 |
| paul-1 | the priest of Jupiter with oxen and garlands | oxen not counted | Acts 14:13 |
| council | the apostles and elders | — | Acts 15:6 |
| paul-2 | Paul, Silas, the jailer and his house | — | Acts 16:27–33 |
| paul-3 | Demetrius, the craftsmen, the crowd in the theatre | — | Acts 19:24–29 |
| paul-trials | Agrippa, Bernice, the chief captains, Paul in bonds | — | Acts 25:23 |
| paul-rome | **two hundred and seventy-six souls** aboard | 276 | Acts 27:37 |
| epistles-paul | readers in each city | — | — |
| epistles-general | the strangers scattered through five provinces | 5 provinces | 1 Pet 1:1 |

### Revelation

| Unit | Figures | Count | Verse |
|---|---|---|---|
| rev-churches | one like unto the Son of man among seven lampstands | lampstands 7; stars 7 | Rev 1:12–16 |
| rev-visions | **twenty-four elders** on twenty-four seats; **four beasts** full of eyes, each with six wings | elders 24; beasts 4; wings 6 | Rev 4:4–8 |
| new-jerusalem | twelve angels at twelve gates | angels 12; gates 12 | Rev 21:12 |

---

## What this list is for

Three things fall out of it, and they are the reason it exists rather than a
paragraph promising figures later.

**The reusable set is small.** Across fifty-six units the recurring figures are:
a man, a woman, a priest, a soldier, a shepherd, a king; an ox, a sheep, a
goat, an ass, a camel, a horse, a lion, a dove, a raven, an eagle. Sixteen
models cover the overwhelming majority of the scenes above — a crowd of three
thousand is one figure placed three thousand times, not three thousand models.
That is what keeps the app from growing without limit, and it is why
`src/walk/figures.ts` loads by URL and clones: **one download, one geometry,
many transforms.**

**Some figures are measured, and those are not display choices.** Goliath's six
cubits and a span (1 Sam 17:4), the sixty-cubit image (Dan 3:1), the seraphim's
six wings (Isa 6:2), the living creatures' four faces and four wings (Ezek
1:6): these are stated and must be built to the number, exactly as the
buildings are.

**Some figures are famously in the pictures and not in the text.** The ox and
the ass at the manger, and a specific number of wise men, are the two that
will be asked about most. They are listed above so that the decision is made
once, in the open: they do not go in, or they go in labelled.

---

## The one figure this app does not give a face

**Decided, with the owner, 2026-09-18.** Jesus is not rendered as a figure.
Where a scene has him in it, **the camera stands where he stands.** You are in
the boat when the waves beat into it; you sit where he sat and look down at the
multitude; you see the three asleep in the garden.

Three reasons, in order of how hard they are to argue with:

1. **The text gives nothing to build from** — with the one exception above,
   which cuts against the pictures rather than toward them: the letters settle
   that a man wore his hair short, so the familiar long-haired figure is wrong
   even on the little the text does say. Beyond that there is no description of
   his appearance anywhere in the canon. The nearest thing, Isa 53:2 — *no form nor
   comeliness that we should desire him* — is a refusal to describe, not a
   description. Every other figure in this app is generic because the text is
   silent about the individual; here the silence is about the one person a
   reader would most take the picture for a portrait of.
2. **The project's own escape hatch does not reach.** Everything else unstated
   is handled by one sentence: *the number is the text's, the species is a
   display choice, and the card says which.* It works for an ox standing for a
   clean kind, because nobody remembers that ox. It does not work for a face:
   a reader will carry it for life, and a caption cannot undo that.
3. **The second commandment.** Ex 20:4, and Deut 4:15 — *ye saw no manner of
   similitude*. For an app called 雅伟之界 that is not a detail to be waved
   past.

**The twelve are rendered** — ordinary men, no attempt to say which is which,
under the same rules as everyone else.

**Revelation 1:12–16 is the one honest complication**, and it is recorded here
rather than smoothed over: that passage *does* describe him, and at length —
hair white as snow, eyes as a flame of fire, feet like fine brass, a voice as
many waters. It is the only extended description in the canon, and it is a
vision of the glorified Christ rather than a portrait. The way through is the
text's own: *his countenance was as the sun shineth in his strength*, and John
*fell at his feet as dead*. Build what is described — the lampstands, the brass,
the light — at the brightness the passage states, and what a reader can look at
is light, not a face. The literal reading and the aniconic one land in the same
place.

This is an editorial decision, not a technical one. It was weighed; if it is
ever revisited, revisit it here.
