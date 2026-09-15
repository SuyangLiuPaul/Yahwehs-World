# Batch 4 — people who travel, and inspectable story scenes

2026-09-15. This is a bounded interaction batch, **not completion of all
1,443 event scenes and not a photographic reconstruction**. The miniature art
direction responds to the owner's request for approachable characters.

## Implemented

- Route actors use the existing spherical `RoutePath`, not a second track.
  A rigged walking figure replaces static camel decoration. Paul's sea legs
  carry one lofted, rigged sailing vessel and three representative passengers.
  Modern Natural Earth land is only an exclusion mask: where a schematic sea
  line crosses modern land, the boat is hidden, not silently rerouted.
- Exodus visits all 42 textual stages. Each camp has a short pitch/rest/pack
  sequence, then distance-linear travel. Shared regional coordinates remain
  shared; the unlocated Red Sea camp gets no actors or connecting line.
  Twelve figures and three ordinary tents are **representative**, not population
  counts, a tribal layout or the tabernacle. Playback seconds are not chronology.
- A `3D scene` button, and tapping a visible model on the map, open a lazy
  inspector. It has play/pause, replay, scrub, manual orbit/zoom, explicit view
  reset, language switch, model-category inspection, and source/uncertainty text.
  It pauses the map's route, never moves its camera, and stops rendering when
  closed. Manual camera movement is never automated during playback.
- Five short authored demonstrations: sailing, camp life, Carmel's altar,
  Elijah's flight and the Elijah/Elisha whirlwind account. Carmel appears as
  an altar miniature at the existing Mount Carmel marker. The final ascent
  scene is a **related narrative inspector**, not a newly plotted journey or
  a fabricated precise Jordan event pin.
- Region captions now yield to visible actors; route stop labels retain priority.
  Actors draw above transparent relief, and an illustrative oblique display
  tilt makes bodies legible from a globe camera. Their size is not geographic.

## Evidence and reconstruction boundaries

Primary text checked on 2026-09-15. Public-domain BSB and the project's CUV
place-name resolver remain the sources; no NIV or new chronological model.

- [Acts 13:4–5, 13](https://biblehub.com/bsb/acts/13.htm), and route-specific
  references already shipped in the journey source dialog: travel by sea is
  narrated; this ship's hull, sail, passenger count and clothing are art choices.
- [Numbers 9:17–23](https://biblehub.com/bsb/numbers/9.htm) and Numbers 33:
  camping and departure are narrated; the scene does not model the cloud,
  census, full camp organisation or precise historical stop durations.
- [1 Kings 18:30–39](https://biblehub.com/bsb/1_kings/18.htm): twelve stones;
  four vessels of water, repeated three times; prayer precedes Yahweh's fire.
  The altar and trench contents disappear as consumed. Stone arrangement,
  vessel shapes and fire appearance are illustrative; no spell-casting effect.
- [1 Kings 19:1–8](https://biblehub.com/bsb/1_kings/19.htm): Beersheba,
  unnamed wilderness, Horeb. The unnamed resting place is not pinned;
  Horeb remains disputed. The flight vignette is a walking illustration,
  not a full reconstruction of the angel, food, broom tree or cave episodes.
- [2 Kings 2:1–14](https://biblehub.com/bsb/2_kings/2.htm): the scene starts
  after crossing the Jordan. Fire/chariot/horses separate the prophets;
  Elijah ascends **in a whirlwind**, spatially separate from the chariot.
  Elisha remains and retrieves the cloak. Two horses are an artistic count;
  the text does not specify how many. No exact crossing/ascent site is asserted.

## Assets and performance

All new geometry and fire/dust shaders are original runtime code in
`src/journey-actors/`. No stock models, new image generation, video generation
or service credentials. The inspector reuses the existing Higgsfield-generated
`desert-ground-v1.webp`; its original provenance remains in the Phase 3 ledger.
One instanced draw per part; no skeletal animation engine or video downloads.
The inspector is lazy; its renderer and geometries are reused across openings.

Measured build before final release: approximately 11.64 MB, about **39 KB
larger** than Batch 3; no change to the 7,897,593-byte public data payload.
The existing ~602 KB shared Three.js chunk warning remains. Performance
evidence uses 375×812, DPR 2, desktop Chrome with 4× CPU throttle, not a
physical Android/iOS/Safari, thermal or GPU-memory certification.

## Verification

Evidence is isolated under `evidence/phase-4/`; earlier batch evidence is not
overwritten. Failed visual iterations are explicitly under `iterations/`.

- `verify-actors.mjs`: 5 scenes × 3 viewports × 2 locales, screenshots, real
  controls, source text, canvas sizing, errors and camera invariance.
- `verify-actor-behavior.mjs`: all 42 camp states, distance speed, unlocated
  suppression, real route play/pause, passenger count, inspector pause/orbit,
  bilingual context, focus return, and count/state assertions for both fire scenes.
- `verify-actor-network.mjs`: failed lazy module leaves a visible message and
  usable map; failed ground texture retains an operational solid-material scene.
- `verify-actor-performance.mjs`: 5-second map/camp/fire samples, 8 reopenings,
  bounded resource counts. See the JSON, not an unqualified phone-FPS claim.
- Existing `verify-routes.mjs`: 12 bilingual viewport cases. The playback check
  now waits through the explicit Exodus camp dwell before asserting movement.
  The label-density gate was not weakened.
- Existing shared-navigation and release checks cover unchanged pages and
  byte-verify **lazy assets too**, not only the HTML-linked entry files.
- Data audit before/after: zero findings. All event records and authored
  coordinates remain unchanged; no mass approval or new event count is claimed.

## Still open

1443 event-to-scene coverage, fuller historical model research, wider terrain
detail, full Exodus camp organisation, the Jordan crossing and complete flight
episodes, birds/flocks, a complete Elijah/Elisha final-journey map, and physical
mobile acceptance remain future batches. Existing B7/B24/B28 remain open.
News stays disabled; D1–D18 are unchanged.

## Live acceptance

App source `b51410faeb20bd5062245093db98757d1ef55b88` is served at
<https://yahwehsworld.netlify.app/>. On 2026-09-15 at 03:34 UTC,
`evidence/phase-4/live/release.json` verified all three HTML entry references
and 21 asset/data/model/material byte hashes, including the lazy inspector.
This is a measured public deployment match, not an inferred GitHub status.

Production `live/actors/actors.json` passes 30 cases with real play/pause
through visible controls, as well as scrubbing and screenshots. Production
`live/routes/measurements.json` passes 12 route cases; the phone retains 13
Exodus labels, no overlapping route labels and a 158px player. Representative
phone, tablet and desktop production captures were visually inspected.

Final local CPU-throttled samples: map 60.15 fps, camp 60.18 fps, fire 60.16 fps;
reopening the warm inspector eight times retained 11 geometries / 4 textures
and one dialog. These are the bounded samples in the report, not a blanket
performance guarantee. An extra regression covers selecting unlocated camp 7
after camp 42 and resuming without accidentally restarting the journey.
