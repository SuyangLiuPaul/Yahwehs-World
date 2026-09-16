# 13 · The asset library — what to build, what it costs, how it lands

Written 2026-09-16 against `5c4477f`. Numbers marked **measured** were run; numbers
marked *estimated* were not, and say what they rest on.

## The line that decides everything

**Anything the text gives a measurement for is built from the measurement, never
generated.** Noah's ark, the ark of the covenant, the court, the lampstand, the
New Jerusalem and the whole tabernacle are generated in code from the cubits in
Exodus and Genesis — that is the product. A model bought or generated for any of
them would quietly replace a number with somebody's guess, and the one thing
this atlas sells is that it did not do that.

Generation is for what the text *does not* measure: what a traveller looked like,
what a grain ship looked like, what a tent camp looked like. Those are already
labelled 艺术示意 wherever they appear (D19), and that label is what makes them
allowed.

So the library is **archetypes for staffage and scenes**. It is not one model per
place, and 918 settlements do not mean 918 buildings.

## What the data actually asks for

Measured from `public/data/journeys.json` and `public/data/places.json`:

| | |
|---|---|
| Journeys | 10, **174 stops** |
| Leg types across all stops | land 106 · sea 27 · unknown 7 · start 10 · none 5 |
| Longest route | Israel's wilderness itinerary, 42 stops, every leg land |
| Events | 1,443, of which 894 carry places |
| Place types | settlement 918 · region 186 · mountain 47 · river 41 · valley 38 · campsite 32 · gate 26 · island 21 |

Land legs dominate, so the walking figure and the pack animal are the two assets
that earn their cost first. Sea legs are 27 and already have a ship.

## The inventory

### A · People — 12 archetypes
Chosen because each has a different silhouette *and* the text puts it somewhere.

traveller on foot (robe, staff, pack) · shepherd · soldier/guard · prisoner ·
sailor · prophet (cloak) · farmer at the plough · woman with a water jar ·
king or noble · priest · child · caravan driver

### B · Animals — 7
donkey · camel · ox · horse · sheep · goat · raven

### C · Vessels and vehicles — 5 (one done)
Roman grain ship **done** (`roman-grain-ship-v1.glb`) · fishing boat · ship's boat ·
chariot · ox cart

### D · Props — 15, static
tent · city gate · well · altar · threshing floor · watchtower · flat-roof house ·
market stall · palm · olive tree · rock cluster · campfire · amphorae · grain
sacks · water jars

**39 assets to make**, plus the 12 that already exist in code and must not be
touched.

## Cost — measured

Preflighted on the live account, 2026-09-16:

| Item | Credits |
|---|---:|
| Reference image (`gpt_image_2_5`) | **1** |
| Static textured model (`image_to_3d`) | **20** |
| Textured **+ rigged + one animation clip** | **38** |

So a prop is **21** and a character is **39**.

### The one decision that halves the bill

In three.js a skeleton and a clip are separate things: `AnimationMixer` will play
any `AnimationClip` on any mesh whose bone names match. The rig here is a
standard biped, so **clips should retarget across every character** — generate
each character once, generate the clip set once, and share.

*This is not yet verified.* It is the first thing to test, because everything
below turns on it.

| | Credits |
|---|---:|
| 12 characters rigged, one clip each | 468 |
| 8 shared clips (idle, walk, carry, work, sit, kneel, gesture, run) | 312 |
| 7 animals rigged | 273 |
| 4 remaining vehicles, static | 84 |
| 15 props, static | 315 |
| **Total, clips shared** | **≈ 1,450** |
| **Total, if clips do not retarget** (12 × 4 clips) | **≈ 2,550** |

**Balance today: 454.5 credits.** Either path needs a top-up. At Plus pricing the
gap is real money, so run the retarget test on two characters (78 credits) before
committing to anything.

For comparison, the market rate for a rigged low-poly character with a small
animation set is €800–€2,500 each ([Game-Ace](https://game-ace.com/blog/low-poly-models/)),
and independent developers report $200–400 of artist time per AI-generated model
to clean it up for production ([3D AI Studio](https://www.3daistudio.com/3d-generator-ai-comparison-alternatives-guide/how-much-does-ai-3d-model-generation-cost)).
The generation is the cheap half; the cleanup is not, and nothing below assumes
the meshes arrive usable.

## Payload — the constraint that actually binds

The site ships about 6 MB of data plus 2.4 MB of scenes today. Forty assets at
the 869 KB the ship landed on would be 35 MB, which is not a site any more.

Per-asset budgets, to be enforced in the build script and not by intention:

| Class | Triangles | Texture | Target file |
|---|---:|---:|---:|
| Character | ≤ 4,000 | 256² atlas | **≤ 120 KB** |
| Animal | ≤ 3,000 | 256² | ≤ 90 KB |
| Vehicle | ≤ 8,000 | 512² | ≤ 200 KB |
| Prop | ≤ 1,500 | 256² shared atlas | ≤ 50 KB |
| Animation clip | — | — | ≤ 25 KB |

That is ≈ 4 MB for the whole library, and nothing loads until a scene asks for
it. `gltf-transform optimize --texture-compress webp --compress quantize
--simplify` already took the ship 5.82 MB → 869 KB; the same pass with tighter
`--texture-size` and `--simplify-ratio` reaches these numbers.

**Do not use Draco.** It compresses further but downloads a wasm decoder at
runtime; `EXT_texture_webp` and `KHR_mesh_quantization` are native to three.js
and cost no extra request (D-note in `MANIFEST-assets.md`).

## How it lands in the project

Three things already exist and should be extended rather than replaced.

1. **`src/journey-actors/geometry.ts`** builds every actor procedurally today —
   `person`, `ship`, `tent`, `horse`, `chariot`, `jar`, and ten more — and packs
   them into one `InstancedMesh` per piece. That is why hundreds of figures cost
   one draw call. A generated model **must not** break that: it enters as an
   additional instanced source, not as one `Mesh` per figure.
2. **The ship's pattern is the template.** `viewer.ts` drew the lofted hull
   immediately and fetched the model only when the scene opened, falling back
   silently. Every asset follows it: **the procedural version stays and is what
   renders first.** An upgrade that takes the map down when a CDN has a bad
   minute is not an upgrade.
3. **`data/scenes/` holds provenance.** Every generated asset needs its prompt,
   its model, its credits and its passage recorded there, and a row in
   `MANIFEST-assets.md`. The rule is not paperwork: it is what lets the set be
   regenerated from the repo when a model version changes under you.

### Order of work

| Phase | What | Credits | Why first |
|---|---|---:|---|
| 0 | **Retarget test** — two characters, one shared clip, prove the skeletons match | 78 | Decides whether the bill is 1,450 or 2,550 |
| 1 | Traveller + donkey + tent, wired into the exodus route's staffage | ~120 | 42 land stops; the highest-traffic asset in the project |
| 2 | The 8 shared clips | 312 | Nothing else animates until these exist |
| 3 | Remaining 9 characters | 351 | |
| 4 | Animals, vehicles, props | 672 | Bulk, cheapest per asset, most parallel |

Stop after Phase 1 and look at it on a phone before spending Phase 2.

## What will go wrong

- **Meshes arrive with bad topology.** Every source above says AI 3D is good for
  props and prototypes and needs hands on hero assets. Budget cleanup time, or
  keep generated models to the middle distance and leave close-ups procedural.
- **Style drift across 39 assets.** The paintings held together because one style
  clause was repeated verbatim in all sixteen prompts. Do the same here: write
  the clause once, in `data/scenes/`, and do not paraphrase it per asset.
- **Cute costs something.** Exaggerated proportions read as a game. This atlas's
  value is that it is careful; a Mini-Football silhouette tells a reader it is
  not. That is the owner's call, but it should be made once, deliberately, and
  written down — not arrived at one asset at a time.
- **Characters assert what the text does not say.** A face, an age, a skin tone,
  a garment. The caveat line already covers it, but the more detailed the model,
  the more the caveat is doing.

## Sources

- [Low-poly models for games: pipeline, tools, and cost — Game-Ace](https://game-ace.com/blog/low-poly-models/)
- [How Much Does AI 3D Model Generation Cost in 2026 — 3D AI Studio](https://www.3daistudio.com/3d-generator-ai-comparison-alternatives-guide/how-much-does-ai-3d-model-generation-cost)
- [Meshy vs Tripo — SelfCAD](https://www.selfcad.com/blog/meshy-vs-tripo)
- [Three.js Asset Pipeline: glTF Optimisation](https://www.intelligentgraphicandcode.com/development/threejs-interfaces/asset-pipeline)
- [Polycount Budgeting for Realtime Assets — Tripo3D](https://www.tripo3d.ai/blog/explore/polycount-budgeting-for-realtime-assets)
