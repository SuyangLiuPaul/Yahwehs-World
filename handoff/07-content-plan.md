# 07 · Content plan — from what exists to all of Scripture

Each section: what the unit is, where the data comes from, the authoring rule,
the review gate, and how it renders. Nothing goes on the map without a
reference a reader can open.

## C1 · Named events, all 66 books

**Unit.** A `BibleEvent` (`src/events/schema.ts`): id, zh/en names, one-line
`summaryZh` (what happens, not what it means), canonical `start`–`end` keys,
`ref`/`refZh`, `yearEarly`/`yearLate` (BC negative, null when the text supports
no date), `dateBasis`, `dateConfidence` ∈ anchored/inferred/disputed/none,
computed `placeIds`, `status`.

**Spine.** The 105 SeekSparks events are the spine and are already approved.

**Authoring rule per book.** Candidates are proposed at passage boundaries
(narrative units, not chapters), one file per book `data/events/NN-book.json`,
`status: candidate`. Each carries the verse range; the script computes places.
Dates: (a) if the SeekSparks spine has the event, take its year; (b) if the text
states years relative to a spine event, compute and show the arithmetic; (c)
otherwise bound by the nearest spine events before and after → a band with
`confidence: inferred`; (d) Genesis 1–11 and most poetry/prophecy → `none`,
drawn undated but placed.

**Estimated volume.** See `EVENT-GAP.md` for the measured per-book ledger:
140 exist, ~730 estimated total, ~600 remaining, 42 books at zero. The estimate
is calibrated on Genesis (1.30 events/chapter authored) and scaled down by
genre — narrative 1.15/ch, law 0.25, prophets 0.30, poetry 0.08, epistles 1–2
per letter. Order of work: Genesis →
Exodus → Numbers → Joshua → Judges → Samuel → Kings → Chronicles → Ezra/Nehemiah
→ Gospels → Acts → the rest.

**Review gate — opened 2026-09-14.** The owner cleared the candidates for use.
They may be displayed and built on; nobody is waiting for a per-book approval
pass. Note precisely what that does and does not mean. Every event has been
checked against the text by `scripts/audit-events.mjs` — citations resolve, no
year band crosses into the wrong testament, all 31,102 verses of the canon fall
inside some event, neither shipped payload contains 耶和华, and each Chinese
place name appears in the verse cited for it. What has *not* been reviewed one
at a time is where an event should begin and end, whether a disputed date such
as 4114 BC should be published at all, and whether a contested identification is
one this project wants to endorse. Those are the owner's to revisit whenever a
particular event is in front of them, not a queue blocking release.

`status` therefore stays `candidate` on each event, because that remains true —
the clearance is recorded once, at the collection level, in the `meta` block of
`all-events.json` (`candidatesCleared`). Do not mass-rewrite the field to
`approved`: it would assert an individual review that did not happen.
`scripts/build-review-page.mjs` and `apply-review` still work and are still the
way to approve an event properly when someone sits down with one.

**Rendering.** A second track under the verse timeline: events as bands (band
width = yearLate − yearEarly, hatched when `disputed`, dotted when `none`),
clickable to frame their places and open the summary. Verse index and year
axis are two scales on one slider — the reader toggles which one drives.

## C2 · Chinese names for the last 69 places

1,263 of 1,332 places carry a 和合本 name. The 69 without: match by the
gazetteer's alternate spellings first (`bible_names.json` in SeekSparks
assets), then author from 和合本 text for the remaining, each with the verse
where the name appears. No transliteration invented by the builder — if the
和合本 does not name it, it stays English with a note.

## C3 · Journeys — every itinerary the text narrates

Today 10. Add, each from SeekSparks `bible_journeys.json` when present, else
authored with verse per stop:

Abraham's migration is present; add Isaac (Gen 26), Joseph to Egypt (Gen 37,
39), Jacob's return to Egypt (Gen 46), the spies (Num 13), Balaam (Num 22),
Joshua's conquest campaigns (Josh 6–12, three campaigns), Ruth (Ruth 1),
David's flight from Saul (1 Sam 19–27), David's flight from Absalom (2 Sam
15–19), the ark's return (present), Solomon's fleet (1 Kgs 9–10, sea),
Elijah (present), Elisha (2 Kgs 2–8), Jonah (Jonah 1–3, sea), exiles to
Babylon (2 Kgs 24–25), return under Zerubbabel/Ezra/Nehemiah (Ezra 1–2, 7;
Neh 2), Jesus per Matthew/Luke/John in addition to Mark (present), the flight
to Egypt (Matt 2), Philip (Acts 8), Peter (Acts 9–12), Paul ×4 (present),
the seven churches (Rev 1–3 as a circuit). ≈ 25–35 journeys.

Rules: stops in text order; a stop with no locatable coordinate breaks the
line rather than being bridged; camps sharing a coordinate merge with the
label saying so; sea legs flagged `leg: 'sea'` for dashing.

## C4 · Structures — every building the text measures

Cards today: Noah's ark, ark of the covenant, court, lampstand, New
Jerusalem. Walkable: tabernacle. Add cards, each dimension with its verse and
an "unstated" section for what the text does not say:

Table of showbread (Ex 25:23), altar of incense (Ex 30:1–2), bronze altar (Ex
27:1), Solomon's temple (1 Kgs 6:2–3, 6:16–20; porch, nave, most holy place,
side chambers), the two pillars Jachin and Boaz (1 Kgs 7:15–22), the bronze sea
(1 Kgs 7:23–26, with the π discussion stated honestly), the ten stands (1 Kgs
7:27–37), Solomon's palace and hall (1 Kgs 7:2–8), Ezekiel's temple (Ezek
40–42, gate by gate, the largest spec in Scripture), Herod's temple (only the
dimensions Josephus/Mishnah give are *not* Scripture — say so; the text gives
the 46-years remark, John 2:20), the tower of Babel (no dimensions — a card
that says so), Goliath (1 Sam 17:4–7, a "structure" of a man: height, armour
weights).

Walkable after the tabernacle: **Solomon's temple** (same generator method —
counts and cubits from 1 Kgs 6–7), then **Ezekiel's temple**.

## C5 · Evidence layer — 209 findings

Source: `../bible-evidence` (also mirrored as SeekSparks
`assets/bible_evidence.json`, 1.7 MB). Each finding has a place; join on
OpenBible id where present, else by name through the gazetteer, else manual.
Render as a distinct marker class (a spade glyph) with a panel: artifact,
date found, museum/reference, and the verses it bears on. Never phrase a
finding as "proves"; the panel states what was found and what the text says.

## C6 · News layer — today

Source: yswords-data news pipeline (hourly headline → verse matches). Needs a
`place` field in the pipeline output (OpenBible id or lon/lat). Render as a
pulsing marker with a 24-hour decay and a panel: headline, source, matched
verse, and the biblical name of the place. Disabled by default in the demo;
a toggle in the legend.

## C7 · Verse text

BSB only (`04`). Shown in the place panel (the "Appears in" list expands to
verse text on tap) and in event summaries. Chinese text: 和合本 (public
domain). No NIV.

## C8 · Inventory as the completeness proof

`inventory.json` already lists every chapter with its place count. Extend it
with per-chapter event count and journey coverage so "all of Scripture" is a
report, not a claim: the build fails if any of the 66 books has zero events
after the corresponding book file exists.
