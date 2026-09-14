# 11 · Known bugs and open questions (as of `6b3471b`)

## Bugs

**B1 — FIXED (`5084e26`+).** The cause was not the join — it was the upstream
gazetteer: SeekSparks `bible_places.json` gives `Ephrath` the Chinese name
伯特利, which belongs to Bethel. Genesis 35:16 names both in one sentence as
places 26km apart, and 35:19 says 以法他就是伯利恒. A systematic audit paired
every place sharing a Chinese name with a different English root — 89 pairs —
and checked each against the Union Version: almost all are genuine homonyms
(拉玛 for both Ramah and Raamah) or spelling variants of one place
(Asshur/Assyria). Two were wrong: Ephrath, and Caphtor, which had been given
迦萨 (Gaza) instead of 迦斐托. Corrections with their verse evidence live in
`data/events/gazetteer-corrections.json` and are applied on read, because the
gazetteer is a shared asset this repo does not edit.

**B2 — Paul's voyage to Rome runs off the terrain crop.** Crop is 10E–50E;
Malta, Italy, Sicily sit on parchment with a visible transition. Fix: extend
to 5W (`06-L1`).

**B3 — FIXED.** `T.stop`, `T.stopsMerged` and `T.stopCount` added; the route
readout is bilingual.

**B4 — FIXED.** `onLocale` now calls `updateRouteReadout()` when a route is
open, after `applyCursor()` has overwritten the readout with timeline text.

**B5 — FIXED.** The readout de-duplicates identical rendered names and now
follows the active locale instead of always printing Chinese.

**B6 — CLOSED by state, not by a step recorded here.** As of `04385cc`
`public/data/terrain-normal.webp` is absent from the working copy and from
git. The `rm` was refused by the sandbox twice and was never run from this
session, so who removed the file is not known; only the end state was
verified (`ls`, `git ls-files`). Nothing references it.

**B7 — Structures card bodies are Chinese-only** (`specs.ts` `textZh`,
`punchZh`, `unstated`). English parity needed (`08` Phase 9).

**B8 — Route declutter is centre-point based**; wide pills can still overlap
when two markers are 90 px apart. Replace with measured boxes without changing
label density (`06-L3`).

**B9 — SUPERSEDED, then CLEARED.** The event layer is 1,443 candidates over
all 66 books (`ALL-EVENTS.md`); the 35 Genesis candidates are a subset. On
2026-09-14 the owner cleared them for use on the strength of the mechanical
review (`all-events.json` `meta.candidatesCleared`). They are not a bottleneck.
Per-event `status` stays `candidate` because no one has read them one at a time;
see `07` · Review gate for what that does and does not mean.

**B10 — Markers at close zoom are noise around a route** (`06-L7`).

**B11 — FIXED.** The route card and the journey menu spoke the wrong language.
The menu listed the ten journeys by their Chinese names with a Chinese stop
count regardless of locale; the card's title, range, basis and stat labels
were Chinese-only; and the marker reference went the other way, printing
"Acts 27:16" to a Chinese reader because journeys.json stores `range` in
Chinese but every marker `ref` in English. The upstream asset already carries
`range` and `basis` in both languages — `build-journeys.mjs` was dropping the
English — so both are now carried through as `rangeEn`/`basisEn`. The marker
reference is translated on the way to the screen by `localiseRef` in
`books.ts`, which swaps the book name (longest match first, every occurrence,
so "撒母耳记上4章 – 撒母耳记下6章" becomes "1 Samuel 4 – 2 Samuel 6") and
leaves anything it does not recognise untouched. `renderRouteList`,
`renderRouteHeader` and `renderRouteStats` are called from `onLocale`, so a
switch with a route open reaches all of it.

**B12 — FIXED. Chinese names were attached by proximity, and 62 places got
another place's name.** `merge-chinese-names.mjs` matched a place to the
gazetteer by name, then by bare name, then by "first entry within 2 km". That
last rule is the bug: a great many biblical sites are recorded at the
coordinate of the city they belong to — every feature in and around Jerusalem
sits on 31.77, 35.23 — so the fallback handed out whichever entry came first in
the file. King's Valley (Gen 14:17) was labelled 亚革大马, the field of blood
from Acts 1:19; Abraham's 雅伟以勒 got the same name; Timnah was labelled 亚珊.
Two things were wrong. Eight of those places would have matched by name if
apostrophes were normalised (`King’s Valley` against `King's Valley`), and the
coordinate rule never checked whether the point held more than one candidate.
Now names are matched on a normalised key, the coordinate rule fires only when
exactly one gazetteer place is within the radius, and an ambiguous point yields
no name at all — an English label beats another place's name. The script also
clears `zh` before each pass, without which tightening the rules left every
label the old rules had produced exactly where it was.

**B13 — FIXED. The gazetteer corrections only reached the journeys.** They were
read by `build-journeys.mjs` alone, so the globe's own 1,332 labels still called
Ephrath 伯特利. They are applied in `merge-chinese-names.mjs` now, the one place
a Chinese name is attached, and so reach the globe, the journeys and the events
alike.

**B14 — 183 quotations did not match the edition the project cites.** Of 483
strings in 「」 across the summaries, 223 were not in the passage they were
attached to. Thirty of those are not quotations at all but terms — 「原始福音」,
「登山宝训」 — and are correct as they stand. The rest were remembered, or taken
from another translation: 「不住地祷告」 for the edition's 「不住的祷告」. 183 are
corrected against the text and 50 strings still differ, of which the 30 terms
are deliberate. Two are misattributions rather than misquotations and are listed
as open items below.

**B15 — FIXED.** `revelation-3-7` quoted 「我必不抹去你的名」, which is Revelation
3:5 to Sardis, not the letter to Philadelphia, and `exodus-11-1` quoted 「自己的
长子」, which is Exodus 4:22. Neither could be repaired by swapping the quotation,
so both summaries are rewritten from their own passage.

**B16 — FIXED.** `amos-9-11` said Amos 9:11 is quoted in 「雅各书15章」. James has
five chapters; the quotation is Acts 15:16, where James is the speaker.
`psalms-16-1` quoted 「我要尽心赞美你」, which is not in Psalm 16 at all — verse 1
reads 「神啊！求你保佑我，因为我投靠你」. Both rewritten, and the Acts 2 reference
that was correct is kept.

**B17 — FIXED. 耶和华 was shipping to the browser.** A place carried the label
「耶和华的所在」 (Ezekiel 48:35) and the wilderness route's own basis note said
「摩西奉耶和华的吩咐」. This edition reads 雅伟 throughout, and nothing was
checking the two files the browser downloads — the audit only looked at the
events. Both are 雅伟 now, `public/data/places.json` and
`public/data/journeys.json` are clean, and `audit-events.mjs` counts occurrences
in both so this cannot come back quietly.

**B18 — FIXED. The three long-open name questions are settled from the text.**
`Elkosh` was cited at Habakkuk 1:1; 伊勒歌斯 appears exactly once in the whole
Union Version, at Nahum 1:1, and the abbreviation `Hah` is used once in the
entire gazetteer while Habakkuk uses `Hab` and Nahum uses `hum` — a one-off
corrupt code. `Beth-gilgal` was cited at Nehemiah 12:29, which this edition
merges into 12:28, where 伯吉甲 is written plainly: a versification artefact, not
an error. `Ephron 1` and `Ephron 2` were given one merged citation list by the
gazetteer, and one of its two verses (Joshua 18:15) contains no Ephron at all.
OpenBible keeps them apart: Ephron 1 is anchored at Joshua 18:15 with modern
Al Qastal, west of Jerusalem, and its name 以弗仑山 is written at Joshua 15:9 —
the same boundary line described from Judah's side; Ephron 2 is 2 Chronicles
13:19 with modern Taybeh, which is the standard identification of that town
(bibleatlas.org/mount_ephron.htm; biblestudytools.com/dictionary/ephron/). So
以弗仑 is right for the first and 以法拉音 for the second. All three are recorded
in `gazetteer-corrections.json` under `refCorrections`, with `nameAttestedAt`
for the case where the name and the location live in different verses.

## Open questions for the owner
- Q1: Should the repo become public once SeekSparks-derived assets are
  replaced or licensed? (Today private for that reason.)
- Q2: Year axis default — Thiele (SeekSparks) is the spine; should the UI
  offer the late-Exodus school as an alternate band, or state one and note the
  other?
- Q3: Staffage style — silhouette sprites (fast, consistent) vs generated
  low-poly (richer, needs provenance). `06-L6` proposes sprites first.
