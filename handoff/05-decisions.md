# 05 · Decisions already made (ADR log)

These were argued and settled. Do not reopen them in code. If one must change,
add a dated entry here with the reason, then change the code.

**D1 — No satellite imagery.** Zero image licensing, zero tile cost, and every
one of the five competitors is a satellite map — it is the one look that
cannot differentiate. Relief from public-domain *elevation* rasters is allowed
(2026-09-09 amendment, owner-approved): it is measurement, not photography.

**D2 — Three.js, hand-written; no Cesium.** The biblical world is a bounded
region; a global tile scheduler is weight without benefit, and Cesium's GIS
look pulls the product back to "another map".

**D3 — Timeline v1 walks canonical order, not calendar years.** Exodus is
dated ~1446 BC or ~1270 BC depending on the school — a 176-year gap — and
OpenBible carries no dates. Canonical order is objective. Absolute years come as
`yearEarly / yearLate / confidence` bands over the same index (`07`), never as
a single-year slider that picks a side.

**D4 — Chronology comes from SeekSparks, not authored twice.** Thiele anchor at
Solomon's accession, verse arithmetic upward. Supplementary dates cite scripture
arithmetic or are bounded by two spine events, with the working shown.

**D5 — OpenBible CC BY attribution is permanent.** Footer + README on every
page and build.

**D6 — Everything visual is generated or public domain.** No licensed image
assets. New generated assets carry provenance (`04`).

**D7 — Camera does not follow route playback.** The reader pans/zooms; the
route is framed once into the visible band. Following made people motion-sick.

**D8 — Labels are HTML, never sprites.** Chinese type as texture is illegible.

**D9 — Labels are dropped, never slid.** A label moved off its marker points at
the wrong place. At the frame edge the pill swings to the marker's other side.

**D10 — Unlocated places are kept, not dropped.** Ten places nobody can locate
stay in the bundle under `unlocated` and are listed, because "the Bible names
ten places we cannot find" is information.

**D11 — Disputed identifications are shown as disputed.** 55% of places have
rival identifications; the marker dims and the panel says how many.

**D12 — Terrain is unlit and graded offline.** The scene rig cannot light the
Levant (key light over the Atlantic, fill over the Coral Sea); fighting it at
runtime produced grey-olive. The texture carries the look.

**D13 — The globe stays a globe.** At route zoom the detail increases in
place; there is no separate flat-map mode. (Owner decision 2026-09-09.)

**D14 — English default locale, Chinese one tap away.** The demo audience
today; the product's first language remains Chinese in intent — every string
exists in both, and Chinese is never a translation afterthought.

**D15 — Default to the honest number.** Where the text gives no measurement
(lampstand height, cherubim form, ark hull shape) the card says so in a
labelled "unstated" section rather than silently choosing.

**D16 — Place names follow the Union Version, not modern Mandarin.** The shared
gazetteer labels places in present-day Mandarin: 大马士革, 黎巴嫩, 马耳他, 西奈山,
塞浦路斯. Sixty-three of its names appear nowhere in the edition this project
reads, which calls those places 大马色, 利巴嫩, 米利大, 西乃山, 居比路. A reader
holding that Bible beside the map should find the same names in both, so the
Union Version's own rendering wins. The evidence for each is the verse it was
read out of, recorded in `data/places/cuv-renderings.json`; the modern form is
kept on the record as `zhModern` so nothing is lost and a search for 大马士革
still reaches 大马色. Seven places have no Union Version name at all, because the
edition translates rather than transliterates them — Gammadim as 「勇士」, Helech
as 「你的军队」 — and those keep their English label. This supersedes the earlier
reading of "Chinese names come from SeekSparks, no separate system": the source
is still SeekSparks' gazetteer, but where it and the text disagree about what a
place is called in Chinese, the text decides.

**D17 — One place decides a Chinese name.** `scripts/lib/zh-names.mjs` resolves
a gazetteer entry to the name this project shows, and both `build-journeys.mjs`
and `merge-chinese-names.mjs` call it. This is not tidiness. The logic existed
twice, and both times a correction reached one consumer and not the other: the
globe called Ephrath 伯特利 for a week after the journeys had stopped, and the
voyage to Rome still called Malta 马耳他 after the globe had started saying
米利大. A table can be data in two files; the order it is applied in cannot.

**D18 — The divine name is Yahweh / 雅伟 in every language, everywhere it ships.**
Chinese: 耶和华 never appears; inherited prose is normalised on the way through
the builders. English: small-capital LORD — the convention every English Bible
uses for יהוה — becomes Yahweh; mixed-case "the Lord" is Adonai or Kyrios (the
Lord's Supper, Lord of the Sabbath) and is never touched. Two OpenBible place
names are YHWH compounds and are renamed by exact match: Yahweh Will Provide
(Gen 22:14, 雅伟以勒) and Yahweh Is There (Ezek 48:35, 雅伟的所在); the original
spelling is kept as `nameOriginal`. The rule and its evidence live in
`data/places/cuv-renderings.json` (`englishDivineName`) and are applied by
`makeEnNormaliser` in `scripts/lib/zh-names.mjs`; `audit-events` sweeps both
shipped payloads for 耶和华, LORD and the two old names, and must print none.

**D19 — Painted scenes are allowed; painted geography is not.** A journey's
stops may carry a generated illustration, shown in the route card above the
player. This does not reopen D1: the basemap, the terrain and every coordinate
still come from data, and no generated pixel is ever load-bearing for where
something is. What a scene carries is atmosphere — what a first-century grain
ship looked like, what an open roadstead is, what it means that the harbour at
Phoenix was never reached.

Three conditions, all enforced in code or data rather than by good intentions.
(a) **The credit travels with the picture.** `src/scenes.ts` renders 「画家的想象」
/ "Artist's impression" inside the figure; a reader must never have to wonder
whether they are looking at evidence. This atlas is worth attention because it
is straight about what is known, and a painting of an unexcavated harbour is
exactly what would otherwise be mistaken for a finding.
(b) **Provenance is complete enough to regenerate.** `data/scenes/paul-rome.json`
holds the shared style clause, every per-scene prompt, the model, and the
passage each scene was written from. The shipped `public/data/scenes.json`
carries only filename and caption.
(c) **A scene never contradicts the map.** Phoenix and Syrtis are places the
text names and the travellers never reached; the map draws them as hollow,
unconnected markers, and their plates contain no ship. If a stop's status
changes, its plate is regenerated.

Style is fixed by one clause repeated verbatim in all sixteen prompts — muted
indigo/parchment/gold, visible brushwork, not photorealistic, no lettering,
figures small and distant. That repetition is the only thing making them look
like one set; do not paraphrase it per scene.
