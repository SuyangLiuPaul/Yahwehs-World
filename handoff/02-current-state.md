# 02 · Current state (measured 2026-09-14, commit `3cda3a8`)

## Pages

| URL | Module | What it does | State |
|---|---|---|---|
| `/` | `src/main.ts` (609 lines) | The globe: 1,332 places, verse-level timeline (5,582 steps), 10 journeys with playback, place panel, legend, terrain patch | Shipping. Demo-quality; see `11` for defects |
| `/structures.html` | `src/structures/*` | Measurement cards: Noah's ark, ark of the covenant, court, lampstand (two variants), New Jerusalem; each rebuilt in three.js from its stated cubits, with a cubit switch (common 0.445 m / long 0.518 m / royal 0.523 m) | Shipping. Card bodies are Chinese only |
| `/tabernacle.html` | `src/walk/*` | First-person walk through the tabernacle of Exodus 26–27, generated from the counts the text gives (60 court pillars, 48 boards, 96 sockets, 15 bars, 10 curtains, 50 clasps), with a 9-stop guided tour | Shipping. Verified on phone/tablet/desktop |

All three share `src/nav.css` (nav, language switch), `src/tokens.css` (design
system) and `src/locale.ts` (default `en`, persisted in `localStorage['ydh.locale']`,
`data-en` / `data-zh` attributes for static strings).

## Modules

| File | Lines | Responsibility |
|---|---|---|
| `src/main.ts` | 609 | Globe page orchestration: data load, camera/controls, timeline, place panel, routes UI, route framing (`frameRoute`, `visibleBand`), render loop, i18n `T` table, dev handle `window.__globe` (DEV only) |
| `src/basemap.ts` | 101 | Paints the whole-globe parchment basemap into a 4096×2048 canvas from Natural Earth vectors (land, coastline, lakes, rivers) |
| `src/globe.ts` | 69 | `GLOBE_RADIUS = 100`, `lonLatToVec3`, sphere + rim halo, scene lighting (ambient 1.35, key 1.6 at (1,0.6,1), fill 0.5) |
| `src/terrain.ts` | 91 | High-res relief patch over 10–50E / 12–45N, unlit, feathered alpha, fades in between 2.45 R and 1.55 R camera distance |
| `src/markers.ts` | 132 | One InstancedMesh for all places; size by log verse-count; timeline afterglow; `setZoom` keeps screen size roughly constant |
| `src/routes.ts` | 294 | `Route`: Line2 legs with per-vertex progress colours, dashed sea legs, chevrons, interpolated head; `faceCamera` scales markers/dashes to screen px |
| `src/labels.ts` | 167 | HTML route-stop labels: hemisphere cull, off-frame cull, greedy declutter, edge-anchoring (swings pill to the marker's other side rather than clipping) |
| `src/names.ts` | 31 | Strips OpenBible's homonym numbers; names the two Antiochs |
| `src/books.ts`, `src/theme.ts`, `src/types.ts`, `src/locale.ts` | | Canon order, palette/precision colours, data types, locale |
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
| `places.json` | 1,332 located + 10 unlocated places; 5,582 place-verses; 8,702 instances; Chinese names for 1,263 | OpenBible geocoding (CC BY 4.0) + SeekSparks gazetteer |
| `journeys.json` | 10 journeys, 174 stops (exodus-wilderness merges 7 shared-coordinate camps) | SeekSparks `bible_journeys.json` |
| `inventory.json` | Coverage ledger over all 66 books / 1,189 chapters | derived |
| `ne_*.geojson` | Natural Earth 50m/110m vectors | public domain |
| `terrain-color.webp` | 2400×1980 RGBA relief, colour-graded, feathered | Natural Earth HYP_HR_SR_OB_DR + SR_HR (public domain), processed offline |
| `terrain-normal.webp` | **orphan** — no longer referenced since the terrain went unlit; delete | |

## Data authored (`data/events/`, not yet rendered)

| File | Content |
|---|---|
| `seeksparks-timeline.json` | 105 events, all `approved` (86 directly, 19 repaired), 1,423 place links, Thiele-anchored years, 22 gentilic links removed after BSB check |
| `01-genesis.json` | 35 supplementary Genesis candidates, `status: candidate`, dated by scripture-interval or spine-bounding; **unreviewed** |

## Scripts (`scripts/`)

`build-places` (OpenBible → bundle) · `merge-chinese-names` (SeekSparks gazetteer
→ zh) · `build-journeys` (SeekSparks journeys → routes, with the merge rule for
shared-coordinate camps) · `import-seeksparks-timeline` · `review-pass` +
`apply-review` + `build-review-page` (the human review loop) · `build-events` +
`date-candidates` (authored candidates per book) · `build-inventory` +
`build-inventory-page` · `chapters`, `books.json`.

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
- Language switch (中文/EN) rebuilds labels and static strings.

## Build & deploy

`npm run build` = `tsc --noEmit && vite build`. Netlify builds on push to
`main` (Node 22). Bundle warning about chunk size is known and harmless.
