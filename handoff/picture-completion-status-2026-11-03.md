# 雅伟之界 picture completion status (measured 2026-11-03 ~14:40-15:05 AEDT)

Method: `gate_check.py square|still --all --summary`, status/*.json, codex-jobs/ folders, realistic-cinema-v1/manifest.json, non-gamified-merged-status-v3/. Standards untouched (veto table SHA `veto-v1-2026-10-23`, owner's 2026-10-30 ruling: literal veto table, no re-review of the 86 tower/castle fails).

## 1. Squares (text-free line, 1,443 events)

| state | before my changes | now |
|---|---|---|
| pass (gate PASS) | 1,357 | **1,361** |
| rework (failed review) | 82 | 82 |
| pending_review | 4 | 0 |
| not started | 0 | 0 |

Every one of the 82 rework squares is `escalated_three_strikes` (74 at 3 strikes, 8 at 4). `build_rework_jobs.py` skips escalated squares unless `--ids ... --include-escalated`, so the hourly loop has written 0 jobs ("wrote 0 rework jobs" in every promote.log entry) and draw loops idle. Nothing is lost in a claim: claimed-* folders hold 0 square jobs; review-queue has 0 square requests.

Failing vetoes across the 82 (a square can fail several): anachronism 30, mensHair 29, modesty 25, duplicatedPerson 5, registryFix 3, headCount 3, godDepiction 3, jesusHair 2, fakeText 2, trinityComposition 1.

### Redraw job state of the 82

| job state | squares |
|---|---|
| queued (unclaimed) in codex-jobs | **8** (queued today, group A) |
| claimed by a lane | 0 |
| done, candidate awaiting promote | 0 (every `promoted/` candidate has already been promoted and reviewed) |
| awaiting review | 0 |
| no active job, escalated, waiting on the owner | **74** |

(Each of the 74 has 3-4 finished redraw attempts in codex-jobs/done and/or promoted.)

## 2. What was wrong, and what I fixed

| # | finding | fix | evidence |
|---|---|---|---|
| 1 | **3 live PNGs were corrupt** (2-timothy-1-1, jeremiah-32-1, psalms-126-1): written 10:13-10:31 AEDT, byte-identical to the candidate up to 1.5 MiB / 1.7 MiB, then zero-filled to the same length (broken PNG). Status/review/OCR were bound to the good SHA, so `sync_reviews` silently skipped them (SHA mismatch), leaving three Codex-reviewed PASS pictures stuck at pending_review. | Restored `live/<id>.png` from the candidate whose SHA equals status `live_sha256` (copy to .tmp, SHA verified, rename). Corrupt copies kept in the scratchpad. A full decode of all 1,443 live + 1,822 candidate PNGs found exactly those 3 broken files. | `gate_check`: sha_mismatch / ocr_not_sha_bound / review_sha_mismatch cleared, then sync_reviews promoted all 3 to pass. |
| 2 | daniel-5-1 (handoff/32): review PASS, inscription composite not yet made. | Ran `composite_inscription.py daniel-5-1 --box 0.68 0.07 0.93 0.28` (the default box falls on the pillar; this box is plain plaster above the hand), viewed the output, then `sync_reviews`. Live picture untouched; output `inscribed/daniel-5-1.png`. | `gate_check square daniel-5-1`: PASS. |
| 3 | Build gap: promote loop never queues escalated squares and logs only "wrote 0". | Queued group A (below) via `build_rework_jobs.py --ids ... --include-escalated`. | 8 files `codex-jobs/square-*.json`. |
| 4 | Observation, not changed: `promote_candidates.py` never handles stills, so 240 drawn still candidates (237 of them for stills still marked rework) sit in `realistic-cinema-v1/candidates-codex/` with no promote or review lane. | Reported (section 4). | |

What I ran: `gate_check` (read-only), a read-only PNG decode scan, three file restores, `composite_inscription.py daniel-5-1`, `sync_reviews.py` twice (the same step the 30-minute promote loop runs; no model, no network, no paid API), `build_rework_jobs.py --dry-run` then for real with `--ids`. I did not run any draw or review lane, did not touch keys, PAID_IMAGE_API_DISABLED, git state of foreign files, or push.

### Group A queued (failing vetoes all mechanical; no job existed)

| square | strikes | veto |
|---|---|---|
| 2-chronicles-33-1 | 3 | registryFix |
| acts-16-16 | 4 | registryFix |
| acts-27-27 | 4 | registryFix |
| 2-kings-4-8 | 3 | duplicatedPerson |
| matthew-7-13 | 3 | duplicatedPerson |
| acts-26-24 | 3 | headCount |
| genesis-49-1 | 3 | headCount |
| daniel-9-1 | 4 | fakeText |

Not queued although mechanical keys are among their failures, because they also fail an owner-decision key: acts-20-7 (modesty+duplicatedPerson), genesis-46-1 (modesty+fakeText), revelation-11-1 (mensHair+duplicatedPerson), psalms-94-1 (trinityComposition+duplicatedPerson), psalms-91-1 (jesusHair+godDepiction+anachronism+headCount).

## 3. The 74 squares waiting on the owner, grouped

Counts: mensHair 29, modesty 22 (25 incl. mixed), anachronism 19 (30 incl. mixed), theology-key mixes 4. Reviewer notes are the stored reasons, truncated.

### A. Mechanical only (redraw queued 2026-11-03) (8)

| square | strikes | failing vetoes | reviewer note |
|---|---|---|---|
| 2-chronicles-33-1 | 3 | registryFix | veto.registryFix=fail(Manasseh is not shown humbled in bronze chains praying; scene is idol-making workshop with golden calf, registry change not made); Manasseh is not s |
| 2-kings-4-8 | 3 | duplicatedPerson | duplicatedPerson: the woman in blue with white veil appears both at the bedside and standing in the courtyard; the boy likewise |
| acts-16-16 | 4 | registryFix | registryFix: The girl, seized men, magistrates and rod-bearing lictors are visible, but Paul's hands hang at his sides; his rebuke of the spirit is not visually clear. |
| acts-26-24 | 3 | headCount | headCount: card asks 'crowd' but picture shows only 4 people: Paul (chained), Agrippa, Bernice, Festus; no audience/those sitting with them |
| acts-27-27 | 4 | registryFix | registryFix: Brown-bearded Paul wears wrist chains and holds a loaf, but also holds a broken piece beside his mouth while others eat. Giving thanks is not visually established, and th |
| daniel-9-1 | 4 | fakeText | fakeText: Open scroll shows rows of text-like strokes |
| genesis-49-1 | 3 | headCount | headCount: 雅各1；站立和跪着的儿子我数到13个，应为12（含约瑟） |
| matthew-7-13 | 3 | duplicatedPerson | veto.duplicatedPerson=fail(Right foreground figure has the same crimson mantle, curly hair and beard as Jesus: Jesus appears twice, and the second walks toward the wide g |

### B. anachronism (alone or with mechanical) (19)

| square | strikes | failing vetoes | reviewer note |
|---|---|---|---|
| 1-chronicles-11-1 | 3 | anachronism | anachronism: Two men blow golden brass-style trumpets/horns in the left foreground. |
| 2-kings-10-1 | 3 | anachronism | anachronism: 右侧宫门两名持矛卫兵穿罗马/希腊式胸甲和皮条裙(pteruges)，旧约场景 |
| 2-kings-24-1 | 3 | anachronism | anachronism: stone arch bridge with several arches over the water at left |
| 2-samuel-19-1 | 3 | anachronism | anachronism: one soldier wears a Roman-style segmented cuirass with strap skirt and short sword |
| acts-16-6 | 3 | anachronism | anachronism: Greek temple with columns and pediment (Parthenon-style) on the hillside of the harbour town in the background |
| ephesians-6-10 | 4 | anachronism | anachronism: A Roman-style bridge with multiple rounded arches crosses the river in the left background. |
| exodus-13-17 | 3 | anachronism | anachronism: prickly-pear style cacti at bottom of the scene (American cacti) |
| ezekiel-33-1 | 4 | anachronism | anachronism: Watchman blows a long straight brass trumpet |
| isaiah-26-1 | 3 | anachronism | anachronism: A multi-arch Roman-style stone bridge crosses the river near the center-right of this Old Testament scene. |
| isaiah-36-1 | 3 | anachronism | anachronism: A cross-topped, pitched-roof bell-tower-like building rises above the city in the upper-right background, an anachronistic Christian architectural feature in this Old Tes |
| john-19-1 | 3 | anachronism | anachronism: Balustrades and a columned building with a pediment (temple-like) in the Roman governor scene |
| numbers-10-11 | 3 | anachronism | anachronism: Heraldic blue banners with golden eagle emblems on poles, and golden/brass trumpets blown by the men at left. |
| psalms-21-1 | 3 | anachronism | anachronism: brass trumpets held by three musicians |
| psalms-24-1 | 3 | anachronism | anachronism: straight brass trumpets blown by priests |
| psalms-26-1 | 3 | anachronism | anachronism: brass trumpets blown by two priests |
| psalms-84-1 | 3 | anachronism | anachronism: The white-robed musician at the top of the steps blows a straight golden metal trumpet with a flared bell; the veto table forbids brass trumpets. |
| psalms-97-1 | 3 | anachronism | veto.anachronism=fail(阶梯右侧三人吹奏亮黄色金属直筒小号/铜管小号 (brass trumpets)，违反旧约时代错误规则); 台阶右侧吹奏铜管小号 (brass trumpets)，触犯旧约时代错误否决项 |
| song-of-songs-5-1 | 3 | anachronism | anachronism: castle-like crenellated towers across the hill |
| zechariah-8-1 | 3 | anachronism | veto.anachronism=fail(右上角远景山丘上赫然出现希腊柱廊神庙建筑群 (Greek temple)，违反旧约时代错误规则); 远景山顶出现希腊神庙建筑群 (Greek temple)，违反旧约时代错误禁令 |

### C. mensHair (alone or mixed) (29)

| square | strikes | failing vetoes | reviewer note |
|---|---|---|---|
| 1-john-1-1 | 3 | jesusHair, mensHair | jesusHair: Jesus standing at center in a white tunic and red sash (x=0.50..0.57, y=0.44..0.52) has dark hair extending down to his collar/shoulders. / mensHair: All five disciples standing around Jesus (x=0.28..0.35, y=0.54..0.62; x=0.38..0.44, y=0.47..0.55; x=0.62..0.68, y=0.53..0.61; x=0.67..0.74, y=0.46..0.54; x=0.77..0.85, y= |
| 1-samuel-2-12 | 3 | mensHair | mensHair: The foreground man at lower left with a white headband has black hair hanging onto his shoulders; it is not above the collar. |
| daniel-11-1 | 4 | mensHair | mensHair: The white-and-blue-robed scroll holder beside the left throne and the red-robed king on the right have very closely cropped flat tops with shaved-looking/faded sides, rat |
| ephesians-4-1 | 3 | mensHair, modesty | mensHair: The seated white-robed man at lower right has dark hair reaching his shoulders/collar. / modesty: The workers on the upper-right scaffold wear short tunics exposing their thighs. |
| esther-2-1 | 3 | mensHair | mensHair: About 14 men below share identical flat-top black block haircuts, reading as buzz/flat-top, not varied scissor cuts |
| exodus-32-1 | 3 | mensHair | mensHair: Foreground men have flat-top, squared blocky dark hair that reads as buzz/flat-top cut (dancing men centre) |
| ezekiel-36-22 | 3 | mensHair, anachronism | mensHair: The standing prophet at left has curls extending down the back of his neck to his shoulders; several other men also have hair reaching their robe collars. / anachronism: A multi-span round-arched stone bridge crosses the river in the middle distance. |
| ezra-3-8 | 3 | mensHair | mensHair: Foreground men have flat-top, squared blocky dark hair that reads as buzz/flat-top cut (foreground crowd lower left/right) |
| ezra-6-1 | 3 | mensHair | mensHair: Foreground men have flat-top, squared blocky dark hair that reads as buzz/flat-top cut (crowd in foreground, uniform black block caps) |
| genesis-21-22 | 3 | mensHair | mensHair: Foreground men have flat-top, squared blocky dark hair that reads as buzz/flat-top cut (two men right foreground) |
| genesis-27-1 | 3 | mensHair | mensHair: Foreground men have flat-top, squared blocky dark hair that reads as buzz/flat-top cut (man foreground right, Jacob dark blocky hair) |
| genesis-41-1 | 3 | mensHair | mensHair: Several Egyptian men (lower-left guard, seated scribes) have flat uniform dark crop/bowl cuts reading as buzz-cut |
| genesis-5-1 | 3 | mensHair | mensHair: The gray-haired elder in the blue vest left of center has long side hair reaching his collar/shoulders; the far-left elder also has long gray side hair. |
| hebrews-3-7 | 3 | mensHair | mensHair: The elderly speaker has white hair hanging down the nape to his robe collar, rather than remaining above the collar. |
| isaiah-40-1 | 3 | mensHair | mensHair: The elevated gray-haired speaker has long hair hanging to his shoulders below the collar; no Nazirite exception is identified in the fact card. |
| isaiah-45-1 | 3 | mensHair | mensHair: The white-haired speaker has hair extending onto his shoulder and robe collar behind his head. |
| jeremiah-50-1 | 3 | mensHair | mensHair: The elderly pointing man has white hair extending down his nape to the robe collar. |
| joel-3-1 | 3 | mensHair, modesty | mensHair: Several foreground men have bulky locks down to their garment necklines, particularly the bent smith at lower left; short above-collar hair is not consistently clear. / modesty: The standing smith at the far left wears a short tunic ending above his knees, leaving parts of his thighs exposed. |
| joshua-6-1 | 3 | mensHair | mensHair: Priests blowing horns and some men have long dark hair reaching the shoulders, below the collar |
| micah-7-1 | 3 | mensHair | mensHair: The male traveler with the large backpack at right has brown hair extending down to his robe collar. |
| proverbs-31-10 | 3 | mensHair | mensHair: The seated bread recipient at lower right has black hair hanging to his shoulders; the bearded man in the far-left room also has collar-length or longer hair. |
| psalms-117-1 | 3 | mensHair | mensHair: Several bearded worshippers on the right have dark hair descending to the robe neckline; especially the foreground man in a dark cap and gray-gold robe, whose hair cannot |
| psalms-76-1 | 3 | mensHair, anachronism | mensHair: Several foreground male worshippers have curls extending down the neck to the shoulders, including the men in green and blue at lower left. / anachronism: The musician at upper left plays a straight gold-colored brass trumpet with a flared bell. |
| psalms-82-1 | 3 | mensHair, anachronism | mensHair: Several seated male council figures have hair hanging to their shoulders, including the blue-robed man at far left and the white-robed man at far right. / anachronism: Classical colonnaded temples with triangular pediments appear on the background terraces at upper right and far left, outside the exempt corner emblem. |
| psalms-88-1 | 3 | mensHair | mensHair: The back-facing headband wearer in the lower centre has thick curls extending onto the shoulders/collar; the seated bearded headband wearer at centre-right also has hair  |
| revelation-11-1 | 3 | mensHair, duplicatedPerson | mensHair: Dark-haired witness has long hair past the collar; several men have bushy/afro-like cubic hair / duplicatedPerson: The two witnesses appear twice: standing on platform and again lying dead (same red/white-haired and blue/dark-haired figures) |
| revelation-2-12 | 3 | mensHair, anachronism | mensHair: The speaker at left has brown hair hanging down the nape to his robe collar. / anachronism: The dominant hilltop fortress has medieval castle-style projecting battlements and corbelled tower crowns in the first-century Pergamum scene. |
| revelation-8-1 | 3 | mensHair | mensHair: Several masculine trumpet-bearing angels have bob-length hair reaching the nape/robe collar, especially the front-center dark-haired angel. |
| revelation-9-1 | 3 | mensHair, modesty | mensHair: The bearded fleeing man at far left has long dark hair extending below his collar to his shoulders. / modesty: The fleeing man at far left and the green-clad child in front have exposed thighs below their short garments. |

### D. modesty (alone or mixed) (22)

| square | strikes | failing vetoes | reviewer note |
|---|---|---|---|
| 1-samuel-20-1 | 3 | modesty | modesty: The running arrow boy wears short shorts, leaving his thighs exposed. |
| 1-samuel-31-1 | 3 | modesty | modesty: short kilts leave much of the thigh bare on several soldiers |
| acts-16-25 | 3 | modesty | modesty: The prisoners inside the doorway wear short ragged garments that expose their thighs. |
| acts-20-7 | 3 | modesty, duplicatedPerson | modesty: Eutychus lies in a short white garment with his upper legs exposed above his footwear. / duplicatedPerson: The brown-haired, bearded man in a blue outer robe over white clothing appears both at the upstairs table and embracing Eutychus below. |
| acts-22-22 | 3 | modesty | modesty: The foreground commander and helmeted officer wear short tunics that leave their thighs exposed. |
| acts-22-30 | 3 | modesty | modesty: The left guards have bare legs below short tunics; the block anatomy does not clearly establish that their thighs are covered. |
| acts-23-11 | 3 | modesty | modesty: The leftmost man behind the barred door wears a short red garment, but the bars obscure whether his exposed legs include thighs. |
| acts-23-23 | 3 | modesty | modesty: Both leading foot soldiers have bare thighs below their short red military skirts. |
| acts-24-1 | 3 | modesty | modesty: The Roman guards wear short red military skirts leaving their thighs exposed. |
| acts-27-1 | 3 | modesty | modesty: The two guards on the gangplank wear short military tunics exposing their thighs. |
| ezekiel-37-1 | 3 | modesty | modesty: The foreground man in red and kneeling man in white have exposed thighs below their short tunics. |
| ezekiel-38-1 | 3 | anachronism, modesty | anachronism: Numerous branching American-style columnar cacti grow on both rocky slopes and beside the fortress. / modesty: Several fleeing men on the right have raised short tunics and bare upper legs; the small figures do not clearly establish that all thighs are covered. |
| ezekiel-8-1 | 3 | modesty | modesty: The horned humanoid idol in the upper central niche wears a short skirt with exposed thighs; this idol is within the scene, not the corner emblem. |
| genesis-46-1 | 4 | modesty, fakeText | modesty: The green-clad man’s short tunic ends at the upper knee area; the image does not make it clear whether the exposed portion of his legs includes thighs. / fakeText: The open-book emblem in the top-left corner has repeated gray writing-like horizontal strokes on its pages. |
| jeremiah-10-1 | 3 | modesty | modesty: The hammering worker at left and the green- and blue-clad workers wear short tunics exposing their thighs. |
| jeremiah-39-1 | 3 | anachronism, modesty | anachronism: Paddle-shaped prickly-pear cacti appear beside the right city wall, with another cactus at the far left. / modesty: The sword-raising guard at lower left wears a short tunic leaving his lower thighs exposed. |
| judges-16-23 | 3 | anachronism, modesty | anachronism: 殿内为尖拱窗、石拱、带栏杆阳台，像中世纪/罗马建筑，非青铜时代迦南庙 / modesty: 参孙短袍露出大腿 |
| obadiah-1-1 | 3 | modesty | modesty: The central falling man at the collapsing wall has a short raised tunic exposing his thighs. |
| obadiah-1-17 | 3 | anachronism, modesty | anachronism: A Greek-style columned temple with a triangular pediment stands at upper right, and a multi-arched stone bridge spans the river. / modesty: Several celebrating people on the right steps wear short tunics exposing their lower thighs. |
| psalms-104-1 | 3 | modesty | modesty: The boy in blue near the lower-left has a short tunic and bare legs; the small block-shaped legs do not establish that his thighs are fully covered. |
| psalms-115-1 | 3 | modesty | modesty: The two idol breakers at the lower-left wear short tunics with bare upper legs visible above their knees. |
| psalms-31-1 | 3 | anachronism, modesty | anachronism: Three large Christian crosses are mounted on the actual room wall in this David/Psalm scene, separate from the exempt top-left emblem. / modesty: Several spear-bearing guards across the ravine wear short tunics exposing their thighs. |

### E. Theology keys (godDepiction/jesusHair/trinityComposition), mixed (4)

| square | strikes | failing vetoes | reviewer note |
|---|---|---|---|
| hebrews-7-1 | 3 | godDepiction | godDepiction: Central crowned white-bearded elder (Melchizedek) in royal robes reads close to a white-bearded elder figure |
| joshua-5-13 | 3 | godDepiction, anachronism | godDepiction: Commander is a human-form figure; scripture says a man with a sword, but cannot confirm it is not God drawn as human / anachronism: Commander wears Roman muscle cuirass, red cape and Roman-style soldiers' tunics with spears; agave/cactus-like plants at lower right |
| psalms-91-1 | 3 | jesusHair, godDepiction, anachronism, headCount | jesusHair: 旧约诗篇场景中出现红袍白衣的耶稣形象，且头发波浪卷长垂及领 / godDepiction: 旧约诗篇91篇将至高者/全能者的庇护画为红袍白衣的人形教师/耶稣形象，违反神不画成人形规则 / anachronism: 旧约场景出现新约耶稣形像 / veto.headCount=fail(数得庇护所内中央红袍者1人、孩童3人、男子1人，右侧山头远景3人，共8人，未达 crowd 规模); 旧约诗篇出现拟人化神形象/耶稣，发长垂领，人数未达 crowd |
| psalms-94-1 | 4 | trinityComposition, duplicatedPerson | trinityComposition: Three near-identical bearded men in matching white-and-gold robes stand apart across the upper steps beneath the heavenly rays. This creates a questionable three-figure c / duplicatedPerson: The three white-robed men on the upper steps share the same face, hair and costume; the two maroon-robed men at left also have matching faces and hair. Separate identitie |
Decision needed per group: (a) queue another redraw round with `--ids <group> --include-escalated` (each round is one draw plus one Claude review per square); (b) rule the item acceptable on Bible-principle grounds, as was done for the 86 tower/castle fails and daniel-5-1; (c) leave as is. The mensHair group (29) is the most mechanical in practice (the picture shows buzz/fade or bald), but the owner told me not to touch mensHair/anachronism/modesty, so they are not queued. Of these, 3-strike redraw histories suggest the generator keeps reproducing the same fault: repeating the same prompt is unlikely to help.

## 4. Merged bilingual pictures, stills, videos, gallery

| line | measure | state |
|---|---|---|
| Merged bilingual (text baked into the picture, `non-gamified-merged-status-v3`) | 1,443 = 468 explicit PASS + 484 inherited + **491 HOLD** | what the site serves today (`src/event-media.ts` uses `merged-full/` and `merged-thumbs/`, raw `full/` for img=r) |
| Why held (491) | 375 English summary exceeds the eight-word theme maximum; 23 Chinese reference or range wrong; 7 event/scene mismatch; 4 figure anatomy; 1 fake text; 1 HUD residue; 79 other (mostly notes about overlap, garbled summaries, or review-source quirks) | holds are a visible-text-quality verdict by independent review of the text overlay, not of the scene |
| What releases them | re-render the bilingual card (shorter English summary, correct reference) from the text-free square, then a fresh independent review on the new SHA. The text-free squares exist (1,361 pass), but `language_state` is `not_started` for 1,272 (3 draft, 86 unset) and `language-layers/` holds 1,443 stub files, so the composite step is the real remaining work for the 491 | not queued; no tool in tools/scenes builds the final bilingual composite from squares (init_text_free_language_layers.py only initialises layers) |
| Stills (realistic-cinema-v1) | 241 pass, 1,169 rework, 29 not_started, 4 pending_review | manifest `imagesPass` 241 |
| Still jobs | 848 queued, 237 done (drawn, candidates in `candidates-codex/`, awaiting promote and review), 84 rework + 29 not_started + 4 pending with no job, 1 claimed (ecclesiastes-12-1, claimed-drawstill and a copy in claimed-higgsfield, which I must not touch) | drawstill lane: 13 stills drawn this run, ended 14:41, no quota failure |
| Still blockers | no promote tool for stills; no builder for the 84+29 jobless; Gemini-drawn stills need a non-Gemini review (Claude agy exhausted) | not fixed, see section 5 |
| Videos | gate-passing: 0 (corrected: an earlier version of this table said 1; the manifest status field reads 1 pass, but no video passes the gate); manifest: 1 "pass" status, 792 not_started, 631 retired, 19 redo_pending; 651 files in videos-live | the site does not use stills or videos (src has no reference to realistic-cinema; src/video-bible.ts is unrelated to these files as far as grep shows). `gate_check video --all` is slow (>2 min) and was left running in the background |

## 5. Loops and schedules

| lane | scheduled | state now |
|---|---|---|
| promote (no model) | launchd every 30 min | healthy, last run 14:30; "promoted 0 / wrote 0 rework jobs" was correct for the escalated set |
| drawloop (gemini-3.8-flash) | hourly | idle for lack of square jobs; will take the 8 queued jobs on its next start |
| drawargon (gemini-4-argon) | hourly | same |
| drawstill | hourly | working: 13 stills in the last session; image quota pool healthy |
| review, reviewloop, review3loop, reviewopus, reviewsonnet2 | hourly | Claude models in agy exhausted until about 2026-11-06 21:20 AEDT; they exit harmlessly |
| Claude subagent reviewers (this session family) | manual | the only live way to review squares and stills before 11-06 |

## 6. Time to done (estimates, assumptions stated)

- Group A (8 squares): draw about 1 hour (the lanes draw roughly 13 pictures per hourly session), promote within 30 min, review by Claude subagents the same day. Expect about 3-5 passes of 8 given the 4-strike history (pass rate of redraws on these squares is low).
- Squares overall: 1,361 of 1,443 (94.3%) pass. The remaining 74 cannot finish without an owner decision; with (b) accepted on Bible-principle grounds they are done immediately; with (a) each round costs about 1 hour of drawing and 74 Claude reviews, and with a 20-30% redraw pass rate it takes 4-6 rounds, roughly 1-2 days of loops plus Claude reviewer capacity.
- Stills (1,202 not passing): drawing 848 queued at about 13 per hour is roughly 65 hours (about 3 days); the 237 drawn need a promote step and about 1,100+ independent reviews by non-Gemini models. Claude agy returns about 2026-11-06 21:20 AEDT; until then reviews must be done by Claude subagents or Codex gpt-6.1-sol.
- Videos: 0 of 1,443 pass the gate (corrected from 1; the manifest's one "pass" status is not a gate pass); not started in earnest, and no consumer on the site. Not estimated.
- Merged bilingual 491 holds: depends on building the composite step; not estimated until that tool exists.

## 7. Waiting on

- Owner: decision per group in section 3 (74 squares); whether to build the still promote lane and the bilingual composite; Daniel 5:1 is closed.
- Quota: Claude models via agy until about 2026-11-06 21:20 AEDT (reviews); image pool currently healthy (resets observed ~daily).
- Not blocked by quota: group A drawing and promote.
