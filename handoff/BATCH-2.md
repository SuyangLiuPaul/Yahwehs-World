# Scene reconstruction pass · 2026-09-15

Owner priority: detailed, truthful terrain and a complete close-up tabernacle.
Existing route framing, D1–D18, all 1,443 events and the chronology remain fixed.

## Work order

1. Capture the current real tour cameras, then correct structural defects.
2. Replace the sealed tent box with layered draped construction, actual visible
   entrance openings, a 20-cubit holy place / 10-cubit inner room reconstruction,
   hollow bronze altar and inspectable furnishings. Cloth folds, seams, ties,
   pegs and metal edge treatment must survive a close camera, not just a hero view.
3. Author a bronze laver in Higgsfield/Blender, retain editable source, inspect
   its render, export the original mesh and verify it in the browser.
4. Build a reproducible shaded-relief atlas from NOAA ETOPO 2022 elevation,
   extend the patch westward, retain spherical geography and unlit shading.
   Modern measured relief is not a claim about ancient shorelines or roads.
5. Verify every guided stop and representative routes at 375×812, 768×1024,
   1440×900, both languages, with actual screenshots, no hidden scene swaps.
6. Measure build/payload/frame costs, run data audit, publish only checked work.

## Evidence and interpretation boundaries

- Exodus 25–30, 38 and Leviticus 24 are the construction anchors.
- The earlier veil at x=-15 made the inner room twenty cubits long; this pass
  uses the conventional 10-cubit inner room reconstruction inferred from the
  curtain/clasp layout, not a room dimension explicitly stated in Exodus.
- Basin dimensions/profile, hide species, board thickness, exact cloth motifs,
  mountaintops, lampstand height, cherub anatomy and inspection lighting are
  interpretive. A parted screen and an inner-room inspection are educational
  display choices, not representations of unrestricted historical access.
- NOAA ETOPO 2022 is CC0: https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ngdc.mgg.dem%3Aetopo_2022
- Primary construction text: https://biblehub.com/bsb/exodus/26.htm,
  https://biblehub.com/bsb/exodus/27.htm, https://biblehub.com/bsb/exodus/30.htm.
- The owner's reference is a visual-density target only. Its Paul labels over
  Sinai are not used as route data.

## Baseline

HEAD 9fec12e09b02f2402f05891ab8ad1356f4f5e4bb, initially clean.
Pre-edit audit: findings 0; naming/uncited verse counts 0.
Verification results will be appended after implementation, not predicted.

## Delivered and locally verified

- ETOPO atlas: 6600×3960 (was 2400×1980), -5°..50° E / 12°..45° N,
  1,234,044 bytes, unlit, feathered. NOAA source elevations at 15 arc seconds,
  display averaged to 30 arc seconds. Coast mask uses Natural Earth to avoid
  mistaking zero-elevation coastal cells for hundreds of tiny islands.
- 22 region/sea labels, names and references from the audited gazetteer;
  route labels win all collisions. Original instanced ships and one caravan,
  with their schematic scale and evidential limitations disclosed in Sources.
- Tabernacle: open-ended layered coverings, draped curtains, hems, cords,
  pegs, sockets, rounded metal edges, visible hollow altar/rings/network,
  new bronze basin, table/dishes/pouring vessel/twelve loaves, modeled feather
  fans, corrected room layout, floor contact shading, static shadow caching
  and material-group batching. No invented source measurements were added.
- Ten-stop tour: real pause/resume, previous/next, stop selection, replay,
  44px touch exit, bilingual evidence dialog, and an explicit educational cut
  beyond the veil. Portrait framing was widened after screenshots showed
  clipped altar/ark views. Mini-map now uses the actual court/tent ratios.
- Higgsfield/Blender basin revision 1 inspected in the 900px review render
  and in Chrome. Original source retained, app imports only the model root
  and not the review camera/lights. Failed loading leaves a procedural basin.

## Verification

- `npm run build`, type check and `git diff --check`: pass. Existing shared
  Three.js chunk-size warning remains (600.66 kB uncompressed).
- Audit before and after: findings 0, wrong-name counts 0, uncited verses 0.
  All 1,443 event records and all chronology/status fields remain untouched.
- 60 actual tour-camera captures: 10 stops × 3 viewports × 2 languages,
  `evidence/phase-2/after/`. Contact sheets and full-size phone/desktop views
  inspected. No image-generation polishing is applied to these screenshots.
- 6 bilingual viewport cases: all 10 stop selectors, pause/resume, previous/
  next, model loaded, evidence, exit and 44px controls pass (`walk-checks.json`).
- Entire tour played via real animation frames to replay state; stops 1–10
  visited in order, no page errors (`tour-playback.json`). Replay and exit pass.
- Real touch gesture: walking moved x=27.59 to 13.915 m through the open court
  gate in six seconds, then touch Exit returned to the entry screen.
- 12 route cases (Exodus + Paul 1, 3 sizes, both languages): no overlapped
  labels, no clipped controls, ≥12 Exodus phone labels (13 observed), fixed
  camera during playback. All 42 stages and 138 route legs pass regression.
- Network tests: delayed terrain placeholder → ready, failed terrain →
  explicit unavailable state, failed laver → usable fallback; controls remain
  responsive. Shared navigation/attribution checked on both 3D pages.
- CPU-emulated performance, headless Chrome/macOS, 4× throttle, 375×812 DPR2:
  globe 60.16 fps / 16.8 ms p95; walk 60.12 fps / 16.7 ms p95, 39 renderer
  calls and 713,309 triangles including post-process geometry passes.
  **Not a real Android/GPU/thermal/memory test.**
- `public/data`: 7,897,593 B; model: 330,632 B; complete `dist`: 9,119,075 B,
  +840,054 B over Batch 1 (8,279,021 B). The editable Blender source and QA
  screenshots are NOT web payload.

## Explicitly not finished

The owner's reference-image visual bar is **not certified passed**. This is
an interactive scene improvement, not a photographic reconstruction or a
completed game-production art pass. Generic desert terrain still reads as
procedural; finer historically researched objects/environment and physical
mobile GPU/memory testing remain. Only 22 of the planned ~40 region labels
are present; tents/birds and the entire L6 placement specification remain.
The 1,443-event scene system, year-axis rendering, additional structures and
measurement-card B24 are not completed by this batch.

Intermediate visual rounds are retained locally at
`/tmp/yahweh-scene-iterations.ZsaPgg/`, not in the deploy or Git history.
Historical Phase 1 evidence was preserved; rerun results are copied into
`evidence/phase-2/regression/`.

Production verification is recorded separately after the scene commit deploys.
The terrain URL carries a one-time ETOPO revision key to bypass immutable
texture responses cached by releases predating the revalidation fix.
