# 08 · Roadmap — phases in priority order, each with a definition of done

Work top to bottom. Each phase ships on its own (push to `main` deploys).
"Done" means the acceptance tests in `06`/`07` pass at all three viewports in
both locales, screenshots are in the PR/commit, and `11-known-bugs.md` is
updated.

## Phase 0 — Clean the slate (½ day)
- Fix bugs B1–B6 in `11`.
- Delete orphan `public/data/terrain-normal.webp`.
- Add `handoff/MANIFEST-assets.md` rows for the terrain files.
Done: build green, live site shows no `第 N 站` in English, jacob stop 9 reads 以法他.

## Phase 1 — Route experience to the standard (L3, L4, L5, L7) (3–4 days)
- Measured-box declutter + leaders; pills never under the card.
- Player card: thumbnail, dots, swipe, localisation.
- Scale bar + north arrow.
- Route-open marker dimming; flat gold stop discs.
Done: `06` tests L3–L5, L7 pass; exodus-wilderness and paul-1 screenshots at three sizes committed under `handoff/evidence/phase-1/`.

## Phase 2 — Terrain extension + names (L1, L2) (2–3 days)
- Crop to 5W–50E, 12N–45N; optional GEBCO height field.
- Sea/region labels with 和合本 names.
Done: paul-rome fully on terrain; L1/L2 tests pass; payload delta ≤ +3 MB.

## Phase 3 — Staffage (L6) (3–5 days)
- Sprite tier first (ships, camels, tents, birds), then low-poly tier if
  budget allows. Provenance in the manifest for anything generated.
Done: L6 tests pass; frame time measured and recorded.

## Phase 4 — Events layer rendered (C1 spine) (3 days)
- Render the 105 approved events as bands on a year axis toggle; click to
  frame places + summary; Genesis 35 candidates through the review tool.
Done: year/verse toggle works; bands hatch when disputed; owner has reviewed Genesis.

## Phase 5 — Events for all 66 books (C1 full) (ongoing; ≈ 1 book/day authoring + owner review)
- Author candidates book by book in the order in `07`; review gate per book;
  inventory shows per-book event counts.
Done: every book has an approved event file; build fails on a zero-event book.

## Phase 6 — Journeys to full coverage (C3) (4–6 days)
Done: ≈ 25–35 journeys; each stop cites a verse; sea legs dashed.

## Phase 7 — Structures to full coverage (C4) (1–2 days per card; 1–2 weeks per walkable)
- Cards for every measured structure; Solomon's temple walkable; then Ezekiel's.
Done: each card's "unstated" section written; walk tours verified on phone.

## Phase 8 — Evidence + news (C5, C6) (3–4 days + pipeline change in yswords-data)
Done: 209 evidence pins with panels; news toggle live with 24 h decay.

## Phase 9 — Chinese completeness + English parity (C2, structures bodies) (2 days)
Done: 1,332/1,332 Chinese names or a stated reason; every string in both locales.

## Phase 10 — Performance & loading (L10) (2 days)
Done: first paint ≤ 1.5 s on throttled 4G; 60 fps on the reference Android with a route open.

Rough total: 6–9 weeks of focused work plus the owner's review time for events.
