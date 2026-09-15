# Asset provenance manifest

Append a row for every non-code file under `public/` that a script in
`scripts/` does not generate. Never delete a row; mark removed assets as such.

| Path | What | Source / generation | Licence | Commit | Status |
|---|---|---|---|---|---|
| `public/data/terrain-color.webp` | 2400×1980 RGBA relief, 10E–50E / 12N–45N, colour-graded, 9 % feathered border | Natural Earth 10m rasters `HYP_HR_SR_OB_DR.tif` (colour) + `SR_HR.tif` (relief), cropped and graded with Pillow (script kept in session notes; re-create per `06-L1`) | Public domain | `a6c3378`, regraded `3cda3a8` | active |
| `public/data/terrain-normal.webp` | normal map derived from `SR_HR` luminance | as above | Public domain | `a6c3378` | **removed** — untracked `4a32bd6`, absent from disk as of `04385cc` (B6) |
| `public/data/ne_*.geojson` | Natural Earth 50m/110m vectors | naturalearthdata.com | Public domain | `b596a67` | active |
| `public/data/places.json`, `journeys.json`, `inventory.json` | generated | `scripts/` | data licences per `04` | — | generated |
| `handoff/evidence/phase-1/before/*.png`, `after/*.png`, `navigation/*.png` | Browser QA captures, not web payload | Playwright/Chrome; before from `f78d47a`, after from Phase 1. No image-generation prompt | Project UI over existing OpenBible CC BY 4.0 / Natural Earth public-domain data; credits visible | Phase 1 implementation commit (contains this row) | evidence only |
| `index.html` inline SVG favicon | Authored globe mark | Original SVG source; no external asset or generation prompt | Project-authored code | Phase 1 implementation commit (contains this row) | active |
