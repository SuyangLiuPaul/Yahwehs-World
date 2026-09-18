# 03 · Architecture

## Principle: generated, not licensed

Every visual is either painted by code at load time (basemap, all tabernacle
textures, sky), generated from numbers in the text (structures, tabernacle
geometry, routes), or derived offline from public-domain measurement (terrain
relief). There is no image asset with a licence, no tile server, no CDN in the
loading path. Keep it that way: new visuals must be code, public domain, or
self-generated with provenance in `MANIFEST-assets.md`.

## Rendering pipeline (globe page)

```
OpenBible + SeekSparks ──scripts──▶ public/data/*.json
                                        │
Natural Earth vectors ──▶ basemap.ts ── canvas 4096×2048 ──▶ SphereGeometry(100) map
Natural Earth rasters ──offline──▶ terrain-color.webp ──▶ sphere patch 10–50E/12–45N, unlit, alpha-feathered
places.json ──▶ markers.ts InstancedMesh (1 draw call)
journeys.json ──▶ routes.ts Line2 legs + labels.ts HTML overlay
```

- Scene: one `THREE.Group` `globe` containing sphere, halo, markers, terrain,
  selection ring, route. Camera orbits with `OrbitControls`, `minDistance
  1.08 R`, `maxDistance 6 R`, pan disabled.
- Coordinates: `lonLatToVec3(lon, lat, alt)` in `globe.ts` is the single
  source of truth for the sphere mapping. Terrain patch angles are derived from
  it (`terrain.ts` comments explain three.js's reversed phi/theta naming).
- Lighting is tuned for the dark parchment. Its key light's sub-solar point is
  in the mid-Atlantic and its fill's in the Coral Sea, so over the biblical
  world a lit material is ≈ ambient × albedo. That is why the terrain is unlit
  and graded offline. Any future lit layer over the Levant needs its own rig or
  the same treatment.
- Route framing (`frameRoute`, `visibleBand`) measures the DOM to find the
  strip of screen not covered by nav or cards, then fits the route into it,
  with an aim calibration measured by a probe rotation. Do not replace with a
  fixed aspect formula — that was tried and was 2.5× off on phones.
- Labels are HTML, not sprites: Chinese type as texture turns to mud.

## Data pipeline

```
Bible-Geocoding-Data (git) ──build-places──▶ places.json (en names, coords, precision, verseCount, refs)
SeekSparks/assets/bible_places.json ──merge-chinese-names──▶ zh names (1,270/1,332; by name 1,078, bare name 111,
                                        │                     unique coord 16, from text 66; ambiguous coord 12 → no name)
                                        └── lib/zh-names.mjs  ◀── data/events/gazetteer-corrections.json (fix / withdraw / ref)
                                              │                ◀── data/places/cuv-renderings.json (Union Version form, D16)
SeekSparks/assets/bible_journeys.json ──build-journeys──┘──▶ journeys.json   (same resolver — D17)
SeekSparks/assets/bible_timeline.json ──import-seeksparks-timeline──▶ data/events/seeksparks-timeline.json
SeekSparks section index + synopses + spine ──build-all-events──▶ data/events/all-events.json (1,443)
                                              ◀── data/events/summary-overrides.json (371 rewrites)
all-events.json ──build-events-doc──▶ handoff/ALL-EVENTS.md
everything above ──audit-events──▶ handoff/EVENT-REVIEW.md   (all counts must be 0)
places.json ──build-inventory──▶ inventory.json
```

Rules the pipeline enforces and the next builder must keep:
- `placeIds` on an event are **computed** from its verse range against the
  OpenBible index, never authored.
- Nothing is `approved` per event until a human marks it in the review tool.
  The owner's 2026-09-14 clearance is recorded once, in
  `all-events.json` `meta.candidatesCleared`; it means candidates may be shown
  and built on, not that any one of them was read. Do not mass-rewrite `status`.
- A Chinese place name is decided in exactly one place, `scripts/lib/zh-names.mjs`
  (D17). Do not add a second table lookup in a consumer.
- `audit-events.mjs` must report zero on every count after any data change.
- Gentilic filter: a place link is removed when the BSB text of the verse has
  the demonym but not the place name and the demonym is ≥3 chars longer
  (this took three passes to get right; do not loosen it).
- Shared-coordinate camps are merged into one marker that says so on its label.
- Dates come from SeekSparks' Thiele-anchored spine; supplementary dates must
  cite scripture arithmetic or be bounded by two spine events — never
  "conventional".

## Dev handles (DEV builds only; absent in production)

- `window.__globe`: `scene, camera, controls, markers, globe, bundle, screenOf,
  select, selected, advance, follow, advanceRoute, openRoute, clearRoute,
  playing, route, tickRoute, routeT, snapshot`
- `window.__walk`, `window.__temple`, `window.__ark` (`scene, camera, renderer,
  walker, counts, colliders, CUBIT, updateHud, tour, startTour, endTour, TOUR,
  snapshot`). The Measures panel has no handle: drive it through the DOM —
  `#gate-measures` or `#measures` opens it, `#mp-c-range` is the cubit
- Production has no handles; drive the UI via `[data-id="paul-1"]` buttons etc.

## Design system

`src/tokens.css`: palette (sea/navy/ground/surface, gold ×3, ink ×4, line),
7-step type scale 11–28 px (ratio 1.18), 3 tracking values, 4 px space scale,
one radius (2 px), fonts Noto Sans SC / Noto Serif SC / Spectral / IBM Plex
Mono. Nothing redefines these; the last time three stylesheets each had their
own numbers there were eighteen font sizes.

## Performance budget

- Initial payload (globe page): today ≈ 7.5 MB incl. 6 MB data cached
  immutable. Ceiling for new work: **+4 MB** total for terrain/staffage/labels
  assets before lazy-loading is required.
- Frame budget: 60 fps on a 2022 mid-range Android at 375×812 with a route
  open. Draw calls today: globe 2, markers 1, terrain 1, route ≈ legs + head,
  structures/menorah heavy but isolated pages.
- Any new per-place geometry must be instanced. 1,332 meshes is not allowed.
