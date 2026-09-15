# 02 · Current state (measured 2026-09-15, commit `6b3471b`)

Scene update 2026-09-15: `BATCH-2.md` supersedes the old tabernacle/terrain
entries below. The globe now uses NOAA ETOPO relief at 6600×3960, 22 audited
gazetteer-derived region labels, and schematic instanced ships/caravans.
The tabernacle has a 10-stop tour, an original Higgsfield/Blender laver,
layered open-ended construction, a corrected interpretive 20/10 room layout,
close-up material/geometry improvements and an evidence/assumptions dialog.
Scene evidence: `evidence/phase-2/`. Historical tables remain for context.

Phase 1 update, 2026-09-15: `BATCH-1.md` supersedes the route behavior and
payload/cache measurements below. Exodus keeps all 42 stages, with 22
plotted markers and one explicitly unlocated camp. New modules:
`route-path.ts`, `route-thumbnail.ts`, `cartography.ts`, `route-ui.css`.
Stable data now revalidates; three-viewport bilingual evidence is committed
under `evidence/phase-1/`. The historical measurements below are retained.

## Pages

| URL | Module | What it does | State |
|---|---|---|---|
| `/` | `src/main.ts` (651 lines) | The globe: 1,332 places, verse-level timeline (5,582 steps), 10 journeys with playback, place panel, legend, terrain patch | Shipping. Demo-quality; see `11` for defects |
| `/structures.html` | `src/structures/*` | Measurement cards: Noah's ark, ark of the covenant, court, lampstand (two variants), New Jerusalem; each rebuilt in three.js from its stated cubits, with a cubit switch (common 0.445 m / long 0.518 m / royal 0.523 m) | Shipping. Card bodies are Chinese only |
| `/tabernacle.html` | `src/walk/*` | First-person walk through the tabernacle of Exodus 26–27, generated from the counts the text gives (60 court pillars, 48 boards, 96 sockets, 15 bars, 10 curtains, 50 clasps), with a 9-stop guided tour | Shipping. Verified on phone/tablet/desktop |

All three share `src/nav.css` (nav, language switch), `src/tokens.css` (design
system) and `src/locale.ts` (default `en`, persisted in `localStorage['ydh.locale']`,
`data-en` / `data-zh` attributes for static strings).

## Modules

| File | Lines | Responsibility |
|---|---|---|
| `src/main.ts` | 651 | Globe page orchestration: data load, camera/controls, timeline, place panel, routes UI, route framing (`frameRoute`, `visibleBand`), render loop, i18n `T` table, dev handle `window.__globe` (DEV only) |
| `src/basemap.ts` | 101 | Paints the whole-globe parchment basemap into a 4096×2048 canvas from Natural Earth vectors (land, coastline, lakes, rivers) |
| `src/globe.ts` | 69 | `GLOBE_RADIUS = 100`, `lonLatToVec3`, sphere + rim halo, scene lighting (ambient 1.35, key 1.6 at (1,0.6,1), fill 0.5) |
| `src/terrain.ts` | 91 | High-res relief patch over 10–50E / 12–45N, unlit, feathered alpha, fades in between 2.45 R and 1.55 R camera distance |
| `src/markers.ts` | 132 | One InstancedMesh for all places; size by log verse-count; timeline afterglow; `setZoom` keeps screen size roughly constant |
| `src/routes.ts` | 294 | `Route`: Line2 legs with per-vertex progress colours, dashed sea legs, chevrons, interpolated head; `faceCamera` scales markers/dashes to screen px |
| `src/labels.ts` | 167 | HTML route-stop labels: hemisphere cull, off-frame cull, greedy declutter, edge-anchoring (swings pill to the marker's other side rather than clipping) |
| `src/names.ts` | 31 | Strips OpenBible's homonym numbers; names the two Antiochs |
| `src/books.ts` | 78 | Canon order, `bookName`, and `localiseRef` — swaps the book name in a reference string between languages (journeys.json stores `range` in Chinese but marker `ref` in English) |
| `src/theme.ts`, `src/types.ts`, `src/locale.ts` | | Palette/precision colours, data types, locale |
| `src/events/schema.ts` | 69 | `BibleEvent` with `yearEarly/yearLate/dateConfidence/status` — **defined, not yet rendered** |
| `src/structures/specs.ts` | 182 | The five structures with every dimension carrying its verse |
| `src/structures/build.ts` | 231 | Geometry from specs (`ark` chest with mouldings/rings/poles/two cherubim, `court`, `cube`, `ark` hull…) |
| `src/structures/menorah.ts` | 366 | The lampstand, ~70k triangles, arch/straight variants |
| `src/walk/tabernacle.ts` | 567 | The tabernacle, generated from counts; materials linen/acacia/gold/silver/bronze/hide/goat/veil/screen |
| `src/walk/textures.ts` | 323 | Canvas-painted procedural textures (sand, linen, beaten gold, bronze, hide, goat hair, embroidered screens with cherubim, desert sky equirect) — **no image assets** |
| `src/walk/controls.ts` | 187 | Pointer-lock + WASD + two-thumb touch walker |
| `src/walk/tour.ts` | 161 | 9 stops defined as "stand here, look at that"; facing derived, never hand-written |

## Data shipped (`public/data/`, ~6 MB, cached immutable)

| File | Content | Source |
|---|---|---|
| `places.json` | 1,332 located + 10 unlocated places; 5,582 place-verses; 8,702 instances; Chinese names for 1,270 (by name 1,078; bare name 111; unique coordinate 16; read from the text 66; corrected 8; withdrawn 4; ambiguous coordinate 12; none 45). 47 carry the Union Version rendering with the modern form in `zhModern` (D16). Zero occurrences of 耶和华 | OpenBible geocoding (CC BY 4.0) + SeekSparks gazetteer, resolved through `scripts/lib/zh-names.mjs` |
| `journeys.json` | 10 journeys, 174 stops (exodus-wilderness merges 7 shared-coordinate camps); `range`/`basis` in both languages (`rangeEn`, `basisEn`); 耶和华 → 雅伟 in the Chinese basis prose; stop names through the same resolver as the globe | SeekSparks `bible_journeys.json` |
| `inventory.json` | Coverage ledger over all 66 books / 1,189 chapters | derived |
| `ne_*.geojson` | Natural Earth 50m/110m vectors | public domain |
| `terrain-color.webp` | 2400×1980 RGBA relief, colour-graded, feathered | Natural Earth HYP_HR_SR_OB_DR + SR_HR (public domain), processed offline |

## Data authored (`data/`, not yet rendered)

| File | Content |
|---|---|
| `events/seeksparks-timeline.json` | 105 events, all `approved` (86 directly, 19 repaired), 1,423 place links, Thiele-anchored years, 22 gentilic links removed after BSB check |
| `events/all-events.json` | **The complete event layer: 1,443 events over all 66 books**, derived by `build-all-events.mjs` from SeekSparks' section index + `ot_synopsis`/`gospel_synopsis` parallels + the spine. 894 with places, 1,207 with years, 306 with parallels. Per-event `status: candidate`; **`meta.candidatesCleared` records the owner's clearance for use (2026-09-14)** and states what was and was not reviewed. `handoff/ALL-EVENTS.md` is its human-readable render |
| `events/summary-overrides.json` | 371 summaries rewritten against the passage text: 202 that interpreted rather than reported, 183 whose 「」 quotations did not match the edition, 4 that cited the wrong passage. Keyed by event id; survives regeneration |
| `events/gazetteer-corrections.json` | 8 corrections, 4 withdrawals, 3 reference corrections and 6 verified-correct entries for the shared gazetteer, each with the verse that settles it. Applied on read; the shared asset is never edited |
| `events/01-genesis.json` | 35 early Genesis candidates — superseded by `all-events.json`, kept as the format exemplar |
| `places/cuv-renderings.json` | 56 places whose gazetteer name is modern Mandarin (大马士革) and whose Union Version name (大马色) was read out of the cited verse; 7 that the edition translates rather than transliterates. Verse cited for every row (D16) |
| `places/names-from-text.json` | 66 places the gazetteer has no entry for, or that sit on an ambiguous coordinate, named from the verse that names them. Verse cited for every row |

## Scripts (`scripts/`)

`build-places` (OpenBible → bundle) · `merge-chinese-names` (SeekSparks gazetteer
→ zh, idempotent; clears before each pass) · `lib/zh-names.mjs` (**the one place a
Chinese name is decided**; both `merge-chinese-names` and `build-journeys` call it —
D17) · `build-journeys` (SeekSparks journeys → routes, with the merge rule for
shared-coordinate camps) · `build-all-events` (→ `data/events/all-events.json`) ·
`build-events-doc` (→ `handoff/ALL-EVENTS.md`) · **`audit-events`** (→
`handoff/EVENT-REVIEW.md`; every count 0 as of `6b3471b`; run before and after any
data change) · `import-seeksparks-timeline` · `review-pass` + `apply-review` +
`build-review-page` (the per-event review loop, still valid) · `build-events` +
`date-candidates` (the older per-book path; superseded by `build-all-events`) ·
`build-inventory` + `build-inventory-page` · `chapters`, `books.json`.

Regeneration order when data changes:
`merge-chinese-names → build-journeys → build-all-events → build-events-doc → audit-events`.

Review artifacts published earlier (Claude artifacts, private):
inventory <https://claude.ai/code/artifact/dac05bc9-acb7-4879-ad9d-cbeecb1d2d49>,
review tool <https://claude.ai/code/artifact/5becb3c7-fdfc-4ee0-bb09-58ae3024211f>.

## What works, verified by screenshot

- Globe loads at 4 R with parchment look; zooming into the Levant fades in
  real relief (Nile, Sinai, Dead Sea rift, Taurus, Cyprus all correct).
- Route playback keeps the camera still (user pans/zooms); sea legs dashed;
  head interpolates; labels rank start/end/now; pills never clip the frame.
- Timeline scrubs 5,582 verses; places accumulate; selection ring breathes.
- Tabernacle tour runs at all three sizes; door screen, veil with cherubim,
  ark with two cherubim visible side by side from the veil.
- Language switch (中文/EN) rebuilds labels, static strings, the journey menu,
  the route card (title, range, basis, stat labels) and the marker reference
  (`Acts 27:16` ⇄ `使徒行传 27:16`), with a route open.
- Place labels follow the Union Version (大马色, 米利大, 西乃山); a search for the
  modern form still resolves via `zhModern`.

## Build & deploy

`npm run build` = `tsc --noEmit && vite build`. Netlify builds on push to
`main` (Node 22). Bundle warning about chunk size is known and harmless.
