# 11 · Known bugs and open questions (as of `3cda3a8`)

## Bugs

**B1 — Wrong Chinese name on jacob stop 9.** `journeys.json` jacob marker
n=9 is `place: "Ephrath"` with `zh: "伯特利"` (the previous stop's name).
Should be 以法他 (伯利恒). Cause: join in `scripts/build-journeys.mjs`
carries the prior gazetteer hit when a lookup misses. Fix the join, regenerate,
diff every journey's zh column against its English column.

**B2 — Paul's voyage to Rome runs off the terrain crop.** Crop is 10E–50E;
Malta, Italy, Sicily sit on parchment with a visible transition. Fix: extend
to 5W (`06-L1`).

**B3 — `第 ${n} 站` hard-coded Chinese in the English UI** (`src/main.ts`
≈ line 373). Localise via `T`.

**B4 — `onLocale` does not call `updateRouteReadout()`.** After a language
switch with a route open, `#t-here` / `#t-ref` keep the old locale until the
route advances (and `applyCursor()` overwrites them with timeline text).

**B5 — 25 timeline verses show a duplicated Chinese name** (e.g. Gen 35:16
伯特利 | 伯特利) because two OpenBible places share one 和合本 name in that
verse. Dedupe adjacent identical names in the readout, or qualify.

**B6 — Orphan asset** `public/data/terrain-normal.webp` (0.3 MB, unused
since the terrain went unlit). Delete.

**B7 — Structures card bodies are Chinese-only** (`specs.ts` `textZh`,
`punchZh`, `unstated`). English parity needed (`08` Phase 9).

**B8 — Route declutter is centre-point based**; wide pills can still overlap
when two markers are 90 px apart. Replace with measured boxes without changing
label density (`06-L3`).

**B9 — 35 Genesis event candidates unreviewed** (`data/events/01-genesis.json`).

**B10 — Markers at close zoom are noise around a route** (`06-L7`).

## Open questions for the owner
- Q1: Should the repo become public once SeekSparks-derived assets are
  replaced or licensed? (Today private for that reason.)
- Q2: Year axis default — Thiele (SeekSparks) is the spine; should the UI
  offer the late-Exodus school as an alternate band, or state one and note the
  other?
- Q3: Staffage style — silhouette sprites (fast, consistent) vs generated
  low-poly (richer, needs provenance). `06-L6` proposes sprites first.
