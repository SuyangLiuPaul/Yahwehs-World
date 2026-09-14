# 11 · Known bugs and open questions (as of `3cda3a8`)

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

**B6 — PARTLY DONE.** `public/data/terrain-normal.webp` is untracked and no
longer ships; the working-copy file still needs deleting by hand (the sandbox
refused the `rm`).

**B7 — Structures card bodies are Chinese-only** (`specs.ts` `textZh`,
`punchZh`, `unstated`). English parity needed (`08` Phase 9).

**B8 — Route declutter is centre-point based**; wide pills can still overlap
when two markers are 90 px apart. Replace with measured boxes without changing
label density (`06-L3`).

**B9 — SUPERSEDED.** The event layer is now 1,443 candidates over all 66
books (`ALL-EVENTS.md`); the 35 Genesis candidates are a subset of that work.
All of it awaits the owner's review, which is the project's only remaining
bottleneck on content.

**B10 — Markers at close zoom are noise around a route** (`06-L7`).

## Open questions for the owner
- Q1: Should the repo become public once SeekSparks-derived assets are
  replaced or licensed? (Today private for that reason.)
- Q2: Year axis default — Thiele (SeekSparks) is the spine; should the UI
  offer the late-Exodus school as an alternate band, or state one and note the
  other?
- Q3: Staffage style — silhouette sprites (fast, consistent) vs generated
  low-poly (richer, needs provenance). `06-L6` proposes sprites first.
