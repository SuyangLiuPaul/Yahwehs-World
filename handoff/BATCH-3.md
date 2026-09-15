# Close-up materials and form · 2026-09-15

The owner again rejected the visual ceiling of the existing scenes. This pass
changes the actual walkable tabernacle and two shared furnishing generators.
It is NOT a claim that the reference-image bar, every scene, or all 1,443 events
are complete. Baseline: clean `c368645`. D1–D18 remain unchanged.

## Shipped scope

- Five original Higgsfield material studies: mineral ground, granitic rock,
  fine linen, embroidered veil, embroidered entrance screen. Generic studies
  are 1024²; the two embroidered sheets are 2048²/high generation quality.
  These are textures on live geometry, not generated still-scene replacements.
- A connected domain-warped mountain mesh, slope/concavity colour variation,
  triplanar rock projection and 360 instanced irregular stones. This is an
  original generic arid set; it does not identify the disputed Sinai location.
- Metre-scale surface grain, restrained bump, cloth sheen, roughness variation
  on metal, broad interior display lighting and a one-time local reflection
  probe. Gold no longer uses only open-sky reflections inside a closed tent.
- The lampstand's 22 blossom units now have modeled cupped petals rather than
  stacked sphere patches. Six curved branches open from successive shaft
  levels; seven lamps remain. The straight reading remains available in Measures.
- Swept altar horns, and original continuous torso/robe and layered-feather
  cherubim replace cones and toy-like body/fan primitives. Shared changes also
  reach the lampstand and ark measurement cards. They do not fix B24 framing.
- Texture downloads are progressive; failures retain the procedural materials.
  Evidence explicitly distinguishes AI materials, uncertain forms, and display
  lighting from textual dimensions and archaeological evidence.

## Evidence boundary

Construction anchors: [Exodus 25](https://biblehub.com/bsb/exodus/25.htm),
[Exodus 26](https://biblehub.com/bsb/exodus/26.htm), and
[Exodus 27](https://biblehub.com/bsb/exodus/27.htm). Textile colours, counts,
and measured furniture envelopes follow these texts. Actual dye shades,
embroidery designs, kneeling posture/clothing/anatomy, feather arrangement,
horn curvature, weathering, terrain and inspection lighting are interpretations.
No generated material is a recovered artifact or a measured surface scan.
Height channels derived from albedo are explicitly artistic approximations.

Technical references: Three.js
[standard materials](https://threejs.org/docs/pages/MeshStandardMaterial.html)
and [cube camera](https://threejs.org/docs/pages/CubeCamera.html).
All five prompts, model settings, job IDs, source PNGs and format settings are
in `evidence/phase-3/materials/`. `scripts/prepare-materials.mjs` reproduces
the WebP conversions without another generation or service charge.
Read-only preflight estimates: 3 × 1 + 2 × 3 = 9 credits; not a billing audit.

## Checks and costs

- Before/after event audit: findings 0; uncited verses 0; prohibited-name
  counts 0. Existing minimum summary overlap remains 6%. No event, place,
  chronology, approval-status or journey dataset was edited.
- Type check/build/diff check pass. Shared Three.js chunk warning remains.
- All ten actual tour views captured at 375×812, 768×1024 and 1440×900, both
  languages: 60 screenshots, not generatively retouched. Three English contact
  sheets and full-size hero/cloth views inspected; UI tests cover both languages.
- Six viewport/language interaction cases pass: ten selectors, 44px controls,
  pause/resume, previous/next, evidence dialog and exit. GLB failure retains the
  basin fallback. All five material requests failing still leaves a usable tour.
- All five generated assets verified on actual live-scene materials; reported
  court/board/socket/clasp/bar/curtain counts remain 60/48/96/50/15/10.
- Chrome/macOS, 375×812 DPR2, 4× CPU throttle: court 60.09 fps, inner room
  60.23 fps; p95 16.8 ms. Respectively 51/35 calls and 989,325/952,749 triangles
  including postprocessing geometry passes; 46 textures. Indoor lamp test
  60.01 fps/39 calls. These are NOT physical Android, GPU, thermal or memory
  benchmarks; no such certification is claimed.
- Five optimized WebPs: 2,220,142 bytes. An initial 3.89 MB conversion failed
  the 2.5 MB asset gate; optimized conversion passed, followed by fresh scene
  captures. Source PNGs remain intact outside web payload.
- Full `dist`: 11,597,864 bytes, +2,478,789 over Batch 2. `public/data` stays
  7,897,593 bytes. Geometry and raw QA/source images are not downloaded as PNGs
  by the site. Shader/material additions account for the non-image delta.

## Still open

This is a material/form improvement, not a certified photographic reconstruction.
Mountain silhouettes and several furnishings remain procedural; bread/table,
sheet-metal detailing, cover construction, calibrated indoor light transport,
close-up sculptural art direction and physical mobile validation need more work.
The terrain outside the level walk area is scenery, not a traversable game level.
B7/B24 and the 1,443-event scene/year-band system remain open. Globe terrain,
routes and their fixed playback camera are unchanged in this pass. More events
have NOT acquired fully authored scenes simply because their records exist.

The entire real-time tour reached stops 1–10 in order, then replay and exit
passed (`checks/tour-playback.json`). Shared navigation/credits pass twelve
page/viewport/language cases. Route regression passes all twelve Exodus/Paul 1
cases: no label overlaps, 13 Exodus labels on phone, camera fixed during playback.
Production acceptance is recorded separately after release.

## Production acceptance

Source `f6a0bae9f52d3f73c3a6d2609716b70e19341c34` is pushed to main and live at
https://yahwehsworld.netlify.app/tabernacle.html. `live/release.json` verifies
three HTML entry points, nine hashed code/style assets, three retained data/
model assets and all five new textures byte-for-byte against the tested build.
All six live viewport/language UI cases pass with the new textures and local
reflections ready. The complete live tour visits all ten stops, reaches replay,
and passes replay/exit with no page errors; its final phone screenshot was
inspected. `live/walk-checks.json` uses production for UI checks; its CPU and
deliberate GLB-failure sections still use the matching local development build.
The evidence/documentation follow-up commit changes no deployed app assets.
