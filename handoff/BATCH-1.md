# Batch 1 · Readable, reliable journeys

Started 2026-09-15 from `f78d47a`. Implements roadmap Phase 1, with Exodus
and Paul's first journey as the acceptance scenes. Decisions D1–D18 stand.
`ALL-EVENTS.md` is not an input. The 1,443-event collection is preserved.

## Order and acceptance

1. Capture the current route views and label counts at all three sizes in
   English and Chinese. Baseline event audit: findings 0, naming findings 0,
   uncited verses 0; lexical overlap is a screening statistic, not an error.
2. Align the route head, completed line, stop selection and readout on one
   distance scale. Keep return visits and missing coordinates distinct. Stop
   verse playback when entering a journey. Camera changes only on explicit
   framing or user interaction, never playback or a mobile browser resize.
3. Measured label boxes, attached leaders, safe screen area, flat stop discs
   and subdued background places. Verify density, overlap and globe occlusion.
4. Compact bilingual player: terrain thumbnail, individually accessible stop
   selectors, previous/next, touch swipe, restart and readable source notes.
5. Projected local scale and north indicator. Verify the scale numerically.
6. Real browser checks, 12 acceptance screenshots, playback/resize/locale
   checks and a desktop CPU-throttled timing sample. Record limitations;
   desktop emulation is not a physical Android performance certification.
7. Build, final event audit, update evidence/bug ledger, commit and deploy.

## Subsequent batches

Follow `08-roadmap.md`: extend terrain and regional names; add restrained
generated staffage; render the existing 1,443 events; then complete the
journeys and measured structures. Each reconstructed scene needs a source
sheet separating stated dimensions from illustrative choices, and camera
verification on a phone. Higgsfield 3D Jutsu is connected and has no existing
project; use it when an editable model or illustrative asset earns its payload.
Do not generate a substitute for measured geographic coordinates.

## Results · 2026-09-15

Phase 1 passes local and live acceptance and is deployed. This is not
completion of the whole product.

### What changed

- One spherical distance model drives the head, line and readout. Return
  visits keep separate parameters; missing coordinates create no invented leg.
- Journey entry stops verse playback and frames once. Playback, mobile
  resize and locale changes never reframe; fit/zoom/drag are user actions.
- Measured fixed-position label boxes, attached leaders, safe screen area,
  flat route discs and subdued background pins; geographic anchors never move.
- Every narrated stage has a 44px selector, reference, previous/next and
  touch navigation. Merged/unlocated stages remain selectable, without
  inventing separate positions or travel durations.
- Cached 160×90 terrain thumbnails use a separate camera. A measured local
  scale and north indicator follow the view. The sources close control stays
  accessible while scrolling. Both acceptance journeys include bilingual
  stop notes; other journeys' English notes are not yet complete.
- Stable JSON URLs revalidate on Netlify, with a one-time version change to
  bypass the old year-immutable responses. Hashed code remains immutable.
  Shared navigation fits phones; structures/tabernacle retain attribution
  in reserved footers without covering controls.

### Accuracy corrections

The old Red Sea camp used a representative water-body point (27.08N,
34.77E). [Numbers 33:10](https://biblehub.com/bsb/numbers/33.htm) places the
camp beside the sea, not at that coordinate. The authored override retains
stop 7 as unlocated and removes both connecting legs. Result: **42 stages,
23 marker records, 22 plotted markers, 1 unlocated stage, 2 drawable runs**.
Other coordinates are unchanged.

Four inherited notes falsely claimed a missing coordinate after the OpenBible
fallback had supplied one: Pi-hahiroth, Hor-haggidgad, Mahanaim and
Kiriath-jearim. `data/journeys/narrative-overrides.json` now distinguishes
reference points from confirmed ancient sites. It also removes the stale
Exodus basis's “two unlocated camps” and walking-day claims. Verse sources:
Numbers 33:7–8,32; [Genesis 32:2](https://biblehub.com/bsb/genesis/32.htm);
[1 Samuel 7:1–2](https://biblehub.com/bsb/1_samuel/7.htm).

The tabernacle introduction no longer calls the lampstand's height and width
stated measurements. [Exodus 25:31–40](https://biblehub.com/bsb/exodus/25.htm)
specifies branches and ornament, not those dimensions. Proportions, textures,
landscape and lighting are now explicitly illustrative. No 3D geometry was
changed in this batch.

Corrections survive `build-journeys.mjs`. Before/after event audits: findings
0, misnamed/absent CUV names 0, uncited verses 0. All 1,443 event records,
the gazetteer, chronology and D1–D18 are unchanged. Mechanical audit success
does not certify every event's historical interpretation.

### Verification

Actual Chrome CSS viewports, both locales; all 12 route acceptance images
visually inspected. Sources, stop 3 and the unlocated camp have extra captures.
Raw results: `evidence/phase-1/after/measurements.json` and `behavior.json`.

| Viewport | Exodus before EN / ZH | Exodus after EN / ZH | Paul after EN / ZH |
|---|---:|---:|---:|
| 375×812 | 8 / 8 | 13 / 13 | 7 / 7 |
| 768×1024 | 16 / 16 (3 overlaps each) | 16 / 16 | 8 / 8 |
| 1440×900 | 6 / 6 (2 overlaps each) | 15 / 16 | 8 / 8 |

Final: no label overlaps or labels/markers under controls; no console errors;
nonempty terrain thumbnails; all player targets ≥44px. Player height 158px
on phone (19.5%), 166px on tablet/desktop. Baseline phone capture bypassed
the footer-blocked route trigger only to measure old layout; final tests use
real, unforced clicks. The historical baseline script refuses to overwrite it.

Behavior tests cover all 10 routes / 138 legs, every Exodus selector,
return visits, missing coordinates, live animation, manual drag, mobile
height changes, locale and dispatched touch swipe. Independent ray/sphere
measurement checks the 200km scale within 0.001%; a 30° rotation yields a
30° north indication. `navigation/` captures verify attribution/control
layout on the other two pages at all sizes/locales, not all their geometry
or all nine tabernacle tour stops.

Performance: 60.16fps, p95 frame interval 16.8ms, 57 draw calls, 280,368
triangles over five seconds of Paul's journey in headless Chrome/macOS,
375×812, DPR 2, 4× CPU throttle. **Not a physical Android/mobile GPU test.**
Build passes; the existing ~561KB shared Three.js chunk still emits Vite's
size warning. Uncompressed dist: 8,249,210 → 8,279,021 bytes (+29,811 bytes).
Evidence screenshots are not shipped in the web payload.

Reproduce with Chrome installed and the dev server on 127.0.0.1:5175:
`npm run test:routes`, then `node scripts/verify-shared-navigation.mjs`.
The visual test supports `TEST_URL`/`EVIDENCE_DIR` for production; camera
internals are asserted locally, since production omits dev handles.

### Still to do

Next: Phase 2 terrain crop extension and source-backed region names, then
staffage and the existing 1,443-event layer. Structures still need detailed
models, source sheets and English card bodies; the ark's desktop framing
must move clear of its reading card. This batch is not cinematic 3D quality.
Higgsfield was inspected; no model/image was generated, no generation credits
were consumed and no new third-party visual assets were introduced.

### Release follow-up

The first live build served the expected code/data hashes. A cold-network
check exposed that a fixed 650ms screenshot wait was too short for terrain
delivery. Thumbnails now expose loading/ready/error states, clear stale site
images while waiting, and preserve the base map if terrain fails. Tests
deliberately hold/fail the texture request and verify navigation and the
stationary camera still work (`after/network.json`). A missing stage also
no longer reveals the camp after the gap as already reached; all 42 manual
selections check that no later camp is labeled reached.

### Deployment · verified

Live: https://yahwehsworld.netlify.app — implementation commits `95aed97`
and `4a3b3c897dbcfe800bb8ee74c4428680fecc2196` pushed to main. The latter
is the source revision in `evidence/phase-1/live/release.json`.

`scripts/verify-release.mjs` confirmed all three pages return 200 and
reference the tested build; all eight referenced code/style assets and
`journeys.json` match local SHA-256 hashes. Live JSON sends
`public,max-age=0,must-revalidate`; hashed assets remain immutable.

The production browser matrix passes all 12 route/viewport/locale cases:
no overlapping labels, no undersized player controls, all stop selectors
present and populated thumbnails. Counts match the local table above.
Live screenshots were inspected at phone, tablet and desktop sizes in both
languages. Camera, gap and network-failure assertions use the local build's
dev handles; they are not misreported as production internals checks.
See `evidence/phase-1/live/measurements.json` and the accompanying screenshots.
