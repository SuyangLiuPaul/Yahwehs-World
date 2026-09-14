# Asset provenance manifest

Append a row for every non-code file under `public/` that a script in
`scripts/` does not generate. Never delete a row; mark removed assets as such.

| Path | What | Source / generation | Licence | Commit | Status |
|---|---|---|---|---|---|
| `public/data/terrain-color.webp` | 2400×1980 RGBA relief, 10E–50E / 12N–45N, colour-graded, 9 % feathered border | Natural Earth 10m rasters `HYP_HR_SR_OB_DR.tif` (colour) + `SR_HR.tif` (relief), cropped and graded with Pillow (script kept in session notes; re-create per `06-L1`) | Public domain | `a6c3378`, regraded `3cda3a8` | active |
| `public/data/terrain-normal.webp` | normal map derived from `SR_HR` luminance | as above | Public domain | `a6c3378` | **orphan — delete (B6)** |
| `public/data/ne_*.geojson` | Natural Earth 50m/110m vectors | naturalearthdata.com | Public domain | `b596a67` | active |
| `public/data/places.json`, `journeys.json`, `inventory.json` | generated | `scripts/` | data licences per `04` | — | generated |
