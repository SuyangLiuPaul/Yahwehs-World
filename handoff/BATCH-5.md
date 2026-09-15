# Batch 5 — controllable globe dragging

2026-09-15. Scope: the owner's report that dragging the globe is much too
fast compared with a map. No new scenery, generated assets or data changes.

## Change and measured reason

The old fixed `rotateSpeed = 0.42` turned the same angle at every altitude.
At radius 125, a 40px mouse drag moved a centre-surface landmark roughly
458–537px across the tested viewports. At radius 108 it moved 1,363–1,608px.
The old 0.06 damping also left a long release tail (at radius 125: 213–250px
of additional drift in the recorded gesture).

`src/globe-navigation.ts` now derives the rotation gain from camera altitude,
effective field of view and globe radius. At the centre of the screen this
approximately equates pointer pixels and ground pixels, independent of zoom.
It updates immediately after zoom, route framing and other camera changes.
The distant whole-globe rotation rate is capped at 0.42. Direct manipulation
has no damping: no lag while held and no residual camera motion on release.

This remains a north-up spherical orbit, **not a claim to reproduce Google's
gesture engine**. Longitude movement is foreshortened at high latitudes and
there is no cursor-anchored zoom or arbitrary globe roll. The inspector and
tabernacle use their own controls and are unchanged. D7 and D13 stand.

Pointer tracking now rejects an entire multi-finger gesture, cancellation,
modified/right clicks, and any drag that exceeded 5px even if it returned to
its origin. A real mouse/touch tap still opens a place. Cursor state is cleared
on release, pointer cancellation, lost capture and window blur. Hover picking
is skipped during a drag and for touch moves.

## Acceptance

Evidence: `evidence/phase-5/`. Nothing overwrites prior batch evidence.

- `before/drag.json`: 24 measured baseline mouse drags, three viewports,
  four camera radii (108/125/200/400), horizontal and vertical motion.
- `after/drag.json`: 80 mouse/touch cases, three viewports and both locales.
  A 40px drag moves the centre-surface landmark **34.16–40.00px**; maximum
  recorded release drift is below 0.000001px (floating-point noise).
- `gestures/gestures.json`: one vs forty mouse events give the same movement;
  returning drags do not select; pinch zoom and a transition to one finger do
  not jump or tap; touch cancellation clears the gesture; real taps still
  select; wheel/buttons refresh gain; zoom limits, poles/date-line stay finite.
- `ui/ui.json`: 12 rendered-UI cases, three sizes × two locales × two zoom
  states. Mouse on desktop, touch on phone/tablet. Measures visible SVG route
  anchors, so the same test works without dev handles in production.
- `routes/`: 12 existing bilingual route-layout/playback checks. Phone Exodus
  retains 13 labels and its 158px card. No route-label overlap or automatic
  route camera movement introduced.
- `behavior/`: all 42 Exodus selectors, 138 legs, gaps, explicit Fit,
  resize/locale preservation and mobile card swipe. Five-second 4× CPU-throttle
  sample: 60.16fps, p95 16.8ms, 67 draws / 299,936 triangles for the sampled view.
- `actors/`: camp sequence, sailing passengers, stationary map camera and
  independent inspector play/pause/orbit/locale continue to pass.
- `navigation/`: shared page/locale/attribution regression checks.
- In-app browser: manually dragged the Paul route, zoomed twice, dragged again;
  inspected the actual resulting views. Bilingual phone/tablet/desktop captures
  were also inspected. No viewport override was left on the user's browser.

The touch and performance checks use desktop Chrome/CDP, **not a physical
iPhone/Android or a Safari certification**. Production verification is recorded
separately after deployment, not inferred from a successful push.

## Payload and data

Build: 11,637,443 bytes in `dist/`. JS/CSS grows by 1,152 bytes versus the last
verified Batch 4 release. Public data stays 7,897,593 bytes; all 1,443 event
records, dates, coordinates and provenance stay unchanged. Data audit: zero
findings. The existing shared-Three chunk-size warning remains.

Reproduce with `node scripts/verify-globe-drag.mjs`,
`node scripts/verify-globe-gestures.mjs`, and
`node scripts/verify-globe-drag-ui.mjs`. For public UI acceptance use `TEST_URL`,
`PRODUCTION=1` and a separate `EVIDENCE_DIR`. `verify-route-behavior.mjs` now
also accepts `EVIDENCE_DIR` so future changes need not overwrite Phase 1.

Full photographic scenery and all-event scene coverage remain open; this
interaction repair does not close B7/B24/B28.
