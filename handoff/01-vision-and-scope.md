# 01 · Vision and scope

## What it is

A 3D globe of the biblical world: every place Scripture names, placed as
honestly as the evidence allows, walked through in canonical order, with the
buildings Scripture measures rebuilt from their own numbers. Bilingual 简体中文
/ English, Chinese-first in intent.

Part of the Yahweh's World / YsWords family (雅伟之界). Owner: Paul Liu.

## The four differentiators — the product, not a feature list

Five Bible atlases already exist (3dBibleMaps, bible-atlas.com, iBible Maps,
EarthViewer, Accordance). This one is not a sixth. Exactly four things none of
them do:

1. **中文.** Every competitor is English-only. Chinese is the first language of
   the interface, the labels, the place names and the event summaries.
2. **It admits what it does not know.** 740 of 1,332 located places — 55% —
   have more than one rival scholarly identification. Every competitor draws
   them as equally confident dots. Here they are labelled as disputed, and
   every authored date carries `yearEarly / yearLate / confidence` and is drawn
   as a band, never a point, where scholars disagree.
3. **Today.** The sister news pipeline matches world headlines to Scripture
   hourly. The same coordinates carry both: Gaza in Judges and Gaza this morning.
   (Not wired yet — see `07`.)
4. **Evidence.** The 209 archaeology findings in `bible-evidence` pin to the
   same map, closing text → place → artifact. (Not wired yet — see `07`.)

Test for any proposed feature: which of the four does it strengthen? If none,
it does not go in.

## What "全部圣经内容 / all of Scripture" means, countably

"All" is only a target if it can be counted. The counts, from the data in the
repo today:

| Layer | Unit | Today | Target | Where the target comes from |
|---|---|---|---|---|
| Places | located ancient places | 1,332 (+10 unlocatable, kept) | 1,332 — already complete | OpenBible geocoding is the full index of every place name in the text |
| Place-verses | verses naming ≥1 locatable place | 5,582 (8,702 instances) | 5,582 — already complete | Same index; the timeline already walks all of them |
| Chinese place names | places with 和合本 name | 1,263 / 1,332 | 1,332 | 69 remain; `07` says how |
| Named events | dated, summarised, place-linked events | 105 approved + 35 Genesis candidates = **140**; 42 of 66 books have zero | est. **~730** (range 600–900) — see `EVENT-GAP.md` for the per-book ledger and the method | SeekSparks chronology spine + authored candidates per book (`07`) |
| Journeys | routes with ordered stops | 10 (174 stops) | every itinerary the text narrates; est. 25–35 | `07` lists them |
| Structures | buildings rebuilt from measurements | 5 cards + 1 walkable (tabernacle) | every structure the text measures; `07` lists 11 | Exodus 25–27, 1 Kings 6–7, Ezekiel 40–48, Genesis 6, Revelation 21, and more |
| Books covered by inventory | | 61 / 66 | 66 (the 5 name no place; they still get events) | |
| Evidence pins | archaeology findings | 0 wired | 209 | `bible-evidence` repo |
| News layer | headlines → coordinates | 0 wired | live feed | yswords-data news pipeline |

"Complete" for this product means every row of that table at its target, with
every authored claim carrying a reference a reader can open.

## Non-goals

- Not a Bible reader. Verse text is shown only where a place or event needs
  it, from BSB (see `04`).
- Not a commentary. Summaries state what happens, not what it means.
- Not a GIS. No global tile scheduler, no satellite, no Cesium (`05`).
- Not a game. The tabernacle walk is a guided visit, not a level.

## Audiences

1. Chinese-reading Bible students on phones — the primary audience; every
   decision is tested at 375×812 first.
2. English readers cross-referencing with other atlases — English names are
   kept beside Chinese, never replaced.
3. Teachers projecting on a screen — desktop 1440×900 is the second test size.
