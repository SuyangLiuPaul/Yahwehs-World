# 08 · Roadmap — phases in priority order, each with a definition of done

Work top to bottom. Each phase ships on its own (push to `main` deploys).
"Done" means the acceptance tests in `06`/`07` pass at all three viewports in
both locales, screenshots are in the PR/commit, and `11-known-bugs.md` is
updated.

## Phase 0 — Clean the slate — DONE 2026-09-14
B1–B6 and B11–B18 fixed; orphan deleted; manifest rows present; audit at zero.
Nothing to send Astra here.

## Phase 1 — Route experience to the standard (L3, L4, L5, L7) — DONE 2026-09-15

Local and live acceptance pass; deployed on Netlify. Measurements, source corrections, limitations and
deployment status: `BATCH-1.md`; screenshots: `evidence/phase-1/`.

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

## Phase 4 — Events layer rendered (C1) (3–4 days)
- Render **all 1,443 events** of `data/events/all-events.json` as bands on a
  year axis toggle (verse index ⇄ years); band width = yearLate − yearEarly,
  hatched when `disputed`, dotted when `none`; click frames the event's places
  and shows `summaryZh`; the 105 spine events visually distinct from candidates.
- Read `meta.candidatesCleared` and do not gate rendering on `status`.
- Do not author, re-date or re-summarise any event; data changes go through
  `summary-overrides.json` and must leave `audit-events` at zero.
Done: toggle works at three sizes; a disputed band renders hatched; clicking a
band with places frames them; 1,443 bands present; audit still zero.

## Phase 5 — Events for all 66 books (C1 full) — DATA DONE 2026-09-14
All 66 books are covered by 1,443 events; every one of the canon's 31,102
verses falls inside some event (measured by `audit-events`). The owner cleared
the candidates for use. There is no authoring left to send Astra; what remains
is Phase 4 (render them). Per-event review, if the owner ever wants it, runs
through `build-review-page` + `apply-review` at their own pace.

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
