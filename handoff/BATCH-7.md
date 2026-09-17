# BATCH-7 — Solomon's temple: walkable, measured, joined on the verse

Implemented 2026-09-17. Not released yet.

This is the house the commission called for: **圣殿**, built from the cubits
1 Kings 6–7 and 2 Chronicles 3–4 state, walkable the way the tabernacle is.

## 1 · What shipped

- **`/temple.html`** — a first-person walk through Solomon's temple. Gate with
  the real tally (2 pillars, 200 pomegranates, 12 oxen, 10 lavers, 2 cherubim,
  39 side chambers), guided tour of 11 stops, free walk, evidence dialog that
  names every measurement and every gap.
- **`src/walk/temple.ts`** — the generator. Every piece carries the verse that
  puts it there. Colliders, named anchors, batched static geometry.
- **Three new structure cards** on `/structures.html`: 所罗门圣殿,
  雅斤与波阿斯, 铜海. Each with dims, counts, punch line, and a
  「经文没有给的部分」 list. Temple cards link into the walk.
- **Corridors** — `TEMPLE_WALK_ANCHORS` in `src/bridges.ts` (1 Kgs 6:2, 6:16,
  6:37, 7:15, 7:23; 2 Chr 3:1, 4:1), joined on the verse. The audit parses
  them the same way it parses the tabernacle's.
- Nav: Temple is now a fourth tab on every page.
- Textures: ashlar stone, cedar, olive wood — generated into canvases, no
  image files.

## 2 · Decisions this batch took (they belong in `05` if anyone reopens them)

- **Ship Solomon, not Ezekiel.** Ezekiel 40–43 is the larger spec and has
  never been built; it is the next walk, not this one. The roadmap already
  ordered it that way.
- **Pillar height 18 cubits, not 35.** 1 Kgs 7:15 vs 2 Chron 3:15. The walk
  uses Kings; the card carries both. Same for the sea's capacity (2,000 vs
  3,000 baths) and the capital's pomegranates (200 vs 100).
- **Porch height uses the house height.** 2 Chron 3:3's "height 120" is left
  as a disputed reading on the card, not drawn as a 120-cubit porch.
- **Outer court is not measured, so it is not pretended.** The wall is a
  partial enclosure (three rows of stone + a cedar row, 1 Kgs 6:36) sized to
  hold the furnishings. No invented 100×50 court.
- **Roof is flat.** 1 Kgs 6:9 gives the height and never a pitch.

## 3 · What went wrong on the way (and was fixed)

- First tour cameras stood on the centre line, so the 20-cubit bronze altar
  filled the opening frame as a gold wall. Stops moved off-axis.
- Exterior stops were placed **outside** the court wall (x=58 vs wall at 55)
  and inside the side-chamber band (|z|≈14). Screenshots were ashlar, not
  temple. Every exterior stop now stands in open court, |z|≥18 or on the
  porch axis with the altar moved east to x=60.
- Cherub wings ran along the room's length, so a camera at the east wall of
  the oracle stood inside a wing. They now span the **width**: two figures
  at z=±5, each wing five cubits, tips meeting the walls and each other —
  1 Kgs 6:27–28.
- Side chambers were laid along the front as well as the flanks, swallowing
  the pillar stop. They now follow the house (x −30…30) on north, south and
  west only.
- Headless pointer lock does not fire, so `inspectStop` left the gate up
  over every screenshot. It now dismisses the gate.

## 4 · Checks

- `npx tsc --noEmit` clean.
- `node scripts/audit-events.mjs` — findings 0, corridors 0, 耶和华 0.
- Rendered and looked at at 1440×900 (gate, eleven tour stops, free walk).
  Evidence: `handoff/evidence/phase-7/temple/`.
- Phone/tablet captures exist for the gate and a free walk; the tour at
  375×812 still needs a dedicated pass before release.

## 5 · Not done

- Ezekiel's temple.
- Herod's temple (Josephus/Mishnah, not Scripture-measured — a card that
  says so, not a walk).
- A gate film clip (the tabernacle has one; the temple gate works without).
- Release scripts, version bump, APK.
