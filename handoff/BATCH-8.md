# BATCH-8 — The temple, rebuilt from the verses

Implemented 2026-09-18. Supersedes `BATCH-7.md`. Not yet released.

BATCH-7 got the massing right and the house wrong, and the owner said so
after one look: 「做得很差」, camera through the walls, a tour that dragged,
「圣殿要重做」. He asked whether an anime style would help. It would not have:
the problem was craft, not style, and the fix was to read 1 Kings 6–8 and
2 Chronicles 3–4 again and build what they say.

## 1 · What was wrong, measured

| | BATCH-7 | now |
|---|---|---|
| Tour legs with the camera inside something solid (`scripts/audit-tour.mjs`, new) | **4 of 10** — through the altar (64 of 116 samples), a pillar, the shut door, the whole house | **0** |
| Tour length | 109 s | 65 s |
| Holy place walls | bare cedar | gold, carved with cherubim, palms and open flowers — 6:21–22, 6:29 |
| Cherubim | two gold cylinders with spheres, facing each other | robed, winged figures, wings 5 + 5 meeting at the walls and each other, **facing the holy place** — 2 Chr 3:13 |
| The ark | absent | under the wings, poles toward the door — 8:6–8 |
| Lampstands / tables | 1 / 1 | 10 / 10, five a side — 7:49; 2 Chr 4:7–8 |
| Door width | "unstated", 6 cubits | **stated**: a fourth of the wall = 5 (6:33); the oracle's a fifth = 4 (6:31) |
| Doors | shut | folding leaves standing open — 6:34 |
| Windows | none | latticed, above the chambers — 6:4 |
| Side chambers | 39 separate boxes, "39" in the tally | three storeys stepping outward on their ledges — 6:6; the tally says 3 storeys, which is the number the verse gives |
| Molten sea | floating 0.4 m above the oxen; oxen were spheres | on the oxen's backs; 600 gourds in two rows, ten to the cubit — 7:24; brim like a lily — 7:26 |
| Pillar capitals | a lathed bowl | belly, net, seven chains, two rows of pomegranates, lily-work four across — 7:17–20 |
| Laver bases | boxes with a raised rectangle | panels with the lions, oxen and cherubim of 7:29 in relief; chariot wheels with spokes — 7:33 |
| Court gate | none | bronze-clad leaves, open — 2 Chr 4:9 |
| Surroundings | seven smooth mounds | the same generic arid highland the tabernacle stands in |

Triangles per frame: 2.64–2.67 M on desktop, against the tabernacle's 3.2 M at
its lampstand stop — the bar, not over it.

## 2 · Where the honesty is

- **Every count on the gate is a number the text gives**, counted by the
  builder as it built: 2 pillars, 400 pomegranates (7:42 — 200 a capital,
  7:20; Chronicles' 100 is on the card), 12 oxen, 600 gourds, 10 lavers, 10
  lampstands, 10 tables, 2 cherubim, 3 storeys.
- **The relief is in the normal map.** 6:29 names cherubim, palms and open
  flowers and describes none of them, so they are drawn as silhouettes of
  what the verse names — in the height field a carver would have worked in,
  not as sculpture the text does not describe. The same for the lions, oxen
  and cherubim on the laver panels (7:29).
- **Readings the two books disagree on are carried, not settled**: pillar
  height, pomegranate count, the sea's capacity, the porch's height, one
  table or ten. The walk draws the Kings figure and says so.
- **Display choices are named in the evidence dialog**: roof pitch, wall
  thickness, door heights, the windows' number and size, the court's
  extent, the sea's profile, the cherubim's anatomy, the ramp to the altar.

## 3 · What changed under the hood

- `src/structures/temple-parts.ts` (new): pillar with capital, sea with oxen
  and gourds, laver base with wheels and panels, standing cherub. Used by
  the walk AND by the measurement cards, so the pillar a reader measures is
  the one they walk past.
- `src/walk/textures.ts`: `carvedGold`, `goldPlanks`, `bronzePanel` —
  procedural, into canvases, nothing downloaded.
- `src/walk/tour.ts`: stops take `via` waypoints; travel follows the polyline
  by arc length.
- `scripts/audit-tour.mjs` (new): samples every tour leg against the walk's
  own colliders. Run it before believing a tour does not clip.
- `scripts/capture-walk.mjs`: takes `WALK_PAGE` / `WALK_HANDLE`, so the
  temple's tour is captured from the same camera positions as the
  tabernacle's. 66 views at three viewports and two readings are in
  `evidence/phase-8/temple/`.
- Nav tabs carry `data-en-narrow` labels: four English tabs did not fit a
  375 px bar.

## 4 · Not done

- Ezekiel's temple (40–43). A larger specification and the next walk.
- Herod's temple — Josephus and the Mishnah, not Scripture; a card that says
  so, not a walk.
- A gate film clip; the temple gate works without one.
- Release: version bump, APK, DMG, prod.
