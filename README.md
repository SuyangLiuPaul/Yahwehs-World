# 雅伟之界 · 圣经世界 — The Biblical Globe

A 3D globe of the biblical world: every place Scripture names, placed as
honestly as the evidence allows.

Part of the Yahweh's World / YsWords family. Bilingual 简体中文 / English.

## What makes it different

Five other Bible atlases already exist ([3dBibleMaps](https://3dbiblemaps.com/),
[bible-atlas.com](https://bible-atlas.com/), [iBible Maps](https://ibiblemaps.com/),
[EarthViewer](https://github.com/earthviewer/bible-atlas),
[Accordance](https://www.accordancebible.com/product/accordance-bible-atlas-2-2/)).
This one is not trying to be a sixth. Four things none of them do:

1. **中文.** Every one of them is English-only.
2. **It admits what we do not know.** 740 of the 1,332 located places — **55%** —
   have more than one rival scholarly identification. Every other atlas draws
   them all as equally confident dots. This one labels them.
3. **Today.** The sister news pipeline already matches world headlines to
   Scripture hourly. The same coordinates carry both: Gaza in Judges and Gaza
   this morning. *(Not wired up yet — see Roadmap.)*
4. **Evidence.** The 209 archaeology findings in `bible-evidence` pin to the
   same map, closing the loop from text → place → artifact. *(Roadmap.)*

## The look is generated, not licensed

There is no satellite imagery here, and that is deliberate. Aerial photography
shows a landscape that did not exist when the text was written, it costs money
per tile, and it makes every atlas look like every other atlas. The basemap is
painted at load time onto a 2D canvas — parchment land, ink sea, gilded coast,
procedural grain — and wrapped on the sphere. No imagery licence, no tile bill,
no CDN in the loading path.

## Running it

```bash
npm install
npm run dev
```

Rebuilding the place bundle from the upstream dataset:

```bash
git clone --depth 1 https://github.com/openbibleinfo/Bible-Geocoding-Data.git /tmp/ob
node scripts/build-places.mjs /tmp/ob
```

## Data

| Source | What | Licence |
|---|---|---|
| [OpenBible.info Bible Geocoding](https://www.openbible.info/geo/) | 1,342 ancient places, 1,596 modern places, 5,616 verse references, identification scores | **CC BY 4.0** — attribution required, and given in the app footer |
| [Natural Earth](https://www.naturalearthdata.com/) | Coastlines, land, lakes, rivers (50m) | Public domain |

Of 1,342 ancient places, **1,332 resolve to coordinates** and 10 do not — the
Bible names ten places nobody can locate today. They are kept in the bundle
under `unlocated` rather than dropped.

## Timeline: canonical order, not chronology

The slider moves through the 66 books in canonical order, not through calendar
years. This is a deliberate v1 choice: biblical chronology is genuinely
contested (Exodus at ~1446 BC or ~1270 BC, a 176-year gap), and OpenBible
carries no dates at all. Canonical order is objective and needs no position on
those debates.

Absolute dating comes later, as `yearEarly` / `yearLate` / `confidence` per
event, rendered as a band rather than a point wherever scholars disagree.

## Roadmap

- [ ] Curated event layer with dated year-ranges and route animations (Exodus first)
- [ ] Levant terrain patch — DEM heightfield under the globe at close zoom
- [ ] `place` field in the yswords-data news pipeline → the modern layer
- [ ] `bible-evidence` archaeology pins
- [ ] Chinese place names (和合本 地名) — OpenBible ships English only

## Licence

Code © 2026, MIT. Data licences as above; the OpenBible attribution must
survive in any deployment.
