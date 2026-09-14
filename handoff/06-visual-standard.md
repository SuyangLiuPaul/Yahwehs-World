# 06 · Visual standard — the reference image, dissected

The owner supplied a reference image (a painterly bird's-eye of a route over
terrain, with numbered gold stops, sea/region names, boats, caravans, tents,
a scale bar, a north arrow, and a bottom player card). It is the bar for
*finish*, not a map to copy: **its geography is wrong** — it draws Paphos,
Perga, Iconium, Derbe and Antioch over Sinai, Egypt and the Red Sea, while
those cities are on Cyprus, in southern Asia Minor and in Syria. Take the
style and the information hierarchy; keep our real coordinates.

Every layer below has an acceptance test. A layer is done when the test passes
at 375×812, 768×1024 and 1440×900, in both locales.

## L1 · Terrain — done at v1, extend

What: real relief (mountains, wadis, coastal shelf, sea depth), warm ochre
desert, deep saturated sea, green fertile strips.

Today: Natural Earth 60 px/° crop 10–50E / 12–45N, unlit, feathered, fades in
1.55–2.45 R. Paul's voyage to Rome runs west of the crop.

To do:
- Extend the crop west to **5W** so Italy, Malta and Carthage are covered; the
  western boundary should fall in open Atlantic, not across a route.
- If a sharper look is wanted at leg scale, move to GEBCO 2024 (15 arc-second,
  240 px/°, free) for the height field and keep Natural Earth's tint. Budget:
  ≤ 3 MB per patch, WebP q85, still feathered.
- Sea depth: today it is a lightness ramp; with GEBCO it becomes measured
  bathymetry.

Test: at `camera.position.length() = 125` over lon 34 / lat 31 the Dead Sea
rift, the Jordan valley, the Sinai gulfs and the Nile delta must each be
identifiable without labels. No visible rectangle edge at any zoom. Gold route
head (`#fff2c4`) remains legible over the brightest desert pixel.

## L2 · Sea and region names — not started

What: 地中海 / Mediterranean, 红海 / Red Sea, 西乃 / Sinai, 埃及 / Egypt,
迦南 / Canaan, 亚拉伯 / Arabia, 尼罗河 / Nile — Union Version spellings
throughout (D16), each with the verse it is read from — letter-spaced, set in the
display face, curved along water bodies where the shape warrants it.

Source: Natural Earth `ne_10m_geography_regions_polys` and
`ne_10m_geography_marine_polys` (public domain) give English names and
label points; Chinese names are a curated map (≈ 40 entries) authored in
`data/regions.zh.json` with the 和合本 form (e.g. 迦南, 亚兰, 亚述, 巴比伦).
Biblical-era names, not modern ones: 迦南 not 以色列, 亚兰 not 叙利亚 — the
modern name may appear as a secondary line.

Rules: rendered as HTML like route labels (D8); visible only between 1.3 R and
3.0 R; hidden when they collide with a route label (route labels win); tracking
`--tr-caps` for Latin, `--tr-cjk` for CJK.

Test: open exodus-wilderness at 375×812 — 红海, 西乃 and 埃及 visible,
none overlapping a stop pill.

## L3 · Numbered stop pills — partly done

What: every reached stop carries a gold-bordered pill `5 别加` with the ordinal
in mono and the name in the UI face; the current stop is filled gold; start
carries 起, end carries 终; merged camps show `13–19`.

Today: exists (`labels.ts`), ranks start/end/now, edge-anchoring done.

To do:
- Point-based declutter → measured-box declutter, **without** changing density
  on the wilderness route (the last attempt cut the label count; measure before
  and after with `[...document.querySelectorAll('.rlab')].filter(e=>e.style.display!=='none').length`).
- Leader line from pill to marker when the pill is anchored off-centre.
- Pills fade with the limb like markers do (already `op`), and must not render
  under the bottom card (`visibleBand` gives the safe strip).

Test: exodus-wilderness fully played at 375×812 shows ≥ 12 pills, none
overlapping, none under the card, every one within 1 px of its marker or joined
by a leader.

## L4 · Bottom player card — partly done

What: title (保罗第一次宣教旅程), stop counter (第 15 站 · 安提阿), verse
reference, a thumbnail of the terrain at the stop, play/pause, dot pagination
(one dot per stop, current filled), close.

Today: `#r-card` has title, counts, stop line, reference, play. No thumbnail,
no dots, and the stop line is hard-coded Chinese `第 ${n} 站` in the English UI
(bug `11-B3`).

To do:
- Thumbnail: render the globe at the stop into a 160×90 offscreen target once
  per stop (cache), unlit terrain makes this cheap. Never a photo.
- Dots: `stopCount` dots, tap to jump (`routeT` set to the stop's parameter).
- Localise the stop line (`Stop 15 · Antioch in Syria`).
- Swipe left/right on the card advances/rewinds a stop (touch only).

Test: card height ≤ 26% of a 375×812 viewport; every control ≥ 44 px hit area;
dots reflect `route.reachedIndex` during playback.

## L5 · Cartographic furniture — not started

What: scale bar (0 · 50 · 100 · 200 公里/km) and a north arrow.

Rules: scale computed from the projected length of a great-circle 100 km at
screen centre, recomputed on zoom; hidden above 3 R (a globe needs no scale
bar). North arrow shows the direction of +Y projected; hidden when the camera
is within 5° of north-up.

Test: at 1.3 R over Jerusalem the bar reads within 5% of true; rotating the
globe rotates the arrow.

## L6 · Staffage — ships, caravans, tents, flocks, birds — not started

What gives the reference its life. Decorative, scale-gated, never claiming a
location the text does not give.

Rules:
- **Instanced, procedural or self-generated only** (D6). Three tiers:
  1. *Sprites*: canvas-painted billboards (sail, camel silhouette, tent, bird)
     instanced with `InstancedMesh`, always facing camera, ≤ 2 KB each.
  2. *Low-poly meshes*: generated GLB (e.g. via a 3D generator) ≤ 60 KB each,
     ≤ 800 triangles, one material, provenance in the manifest.
  3. *Animated*: birds on a slow orbit, sails rocking — cheap sine, no skeletal.
- Ships appear only on sea legs of the open route; caravans only on land legs;
  tents only at the current stop; birds anywhere over land at < 1.6 R.
- Density caps: ≤ 6 ships, ≤ 2 caravans (each ≤ 5 camels), ≤ 3 tents, ≤ 8 birds
  on screen. Fade in over 400 ms; none visible above 2.2 R.
- Nothing is placed on a disputed marker as if it were certain.

Test: exodus-wilderness at 375×812, stop 12: a caravan on the land leg behind
the head, one tent at the head, no ship; paul-1 stop 3: a ship on the dashed
sea leg. Frame time ≤ 16 ms on a 2022 mid-range Android.

## L7 · Markers at close zoom — partly done

Today: 1,332 spheres shrink with zoom (`setZoom`). At terrain height they are
still visual noise around a route.

To do: below 1.8 R, when a route is open, non-route markers fade to 25%
opacity and lose their afterglow; route stops render as flat gold discs with a
dark ring (the reference's style) instead of shaded spheres.

Test: paul-1 open at 1.3 R — the eye finds the 15 stops before anything else.

## L8 · Typography and colour — done, enforce

`tokens.css` is the only source. Display: Noto Serif SC; UI: Noto Sans SC;
Latin display: Spectral; numerals/ordinals: IBM Plex Mono. Gold `#c9a227`,
bright gold `#e8c55a` for the current stop only. No new colours without a
token.

## L9 · Motion — done, enforce

Ease `1 - exp(-dt·k)` for every fade (frame-rate independent). Route head
speed constant in km/s, not in stops/s. No camera motion during playback (D7).
Tour travel uses ease-in-out with shortest-arc yaw.

## L10 · Loading — to do

Today a text "Drawing the world…". Target: the parchment globe appears within
1.5 s on 4G; terrain and journeys stream after; a thin gold progress line under
the nav. No spinner.
