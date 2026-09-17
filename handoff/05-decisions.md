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

---

*Added 2026-09-16, after a round of reports against the live map about the
journey miniatures. Each of these was argued against a measurement, not a
preference; the numbers are in the commits.*

**D20 — The map's own miniatures are the close look. There is no separate
close-up scene.** A full-screen scene — real water, a hull at human scale, a
lit shore — was built and reachable from the ship while it sailed, then
removed at the owner's word: zooming into a stylised close-up added nothing
toward understanding the passage, and the prompt sitting on the map pulled
attention off the geography. What earns its place at close range is the
staffage itself, drawn on the map and legible there (D21). Painted scenes
(D19) remain the way atmosphere is carried, because they are captioned as an
artist's impression and live in the card, never on the geography.

**D21 — Legibility is a screen-pixel budget, checked at the closest zoom the
reader has.** `Staffage`'s group scale converts one local unit into a fixed
number of screen pixels, so a figure's apparent size is the *same at every
camera distance* — `controls.minDistance` is as close as anyone can get, and
zooming further never makes an actor bigger. A legibility multiplier was
raised to 2x, verified from a hand-placed debug camera at a convenient
distance, and shipped still unreadable; the report came straight back. Any
change to how large an actor draws is judged from a capture at
`minDistance` with the app's real FOV, or it is not judged at all.

**D22 — The oblique tilt leans toward the camera, not along the route.** The
miniature stage is tilted so a reader sees more than the tops of heads. That
tilt used to be a fixed rotation about the stage's local X — which is the
direction of travel — so it leaned the figures forward on an eastbound leg
and laid them on their side on a northbound one. The axis is now computed
each frame from the camera's own bearing within the stage's local frame. A
consequence worth keeping in mind: a pose is only real once judged under
that tilt at the app's camera. A seated pose with level thighs looks right
in an isolated side-on rig and splays out flat seen from above, which is
where this map is actually read from.

**D23 — `sea` is what the text says; the chord is not where the ship
sailed.** A marker's `leg: "sea"` records the verb the passage uses. What
`RoutePath` draws is a great-circle chord between two ports, which is not a
pilot's course: it clips islets, hugs the shore for the length of a short
coastal hop, and on one leg crosses 302 km of Asia Minor. So the hull is
placed by geometry, never by the tag alone. A leg whose interior samples are
mostly land is not sailed at all (Caesarea up the Levantine shore; Attalia
to Antioch, which sits inland on the Orontes). Inside a leg that is sailed, a
land span narrower than `SEA_GAP_KM` is the chord cutting a corner and the
ship holds course; anything wider is real ground and the party walks it.
Land and water are read from the same polygons the basemap paints, rasterised
at the same resolution, so the mask can never call water what the drawn
coastline shows as shore. A uniform coastal buffer was tried for this and
reverted before it was committed: dilating land by even one pixel closes the
Aegean and the Malta channel, which these routes sail.

**D24 — Nothing on the route is ever a bare dot; the last stop is posed as
arrived.** While a journey plays there is always a party on the line —
walking, sailing, or seated. Two rules used to blank them. A sea leg whose
current point read as land drew nothing (D23 now walks it). And any marker
with `attested: false` suppressed the whole miniature — the larger of the
two, because `markerAt` holds the last reached marker for the entire stretch
that follows it, so one inferred waypoint erased the figures across 37% of
Paul's second journey and 16% of Jesus' travels. Uncertainty about a stop is
already carried twice, by `uncertainMat` on the marker and by the card's
"inferred waypoint, not an explicitly recorded stop"; a third, unlabelled
signal only reads as the people vanishing. `aside` and a missing coordinate
still suppress, because those are structural — there is nowhere to stand a
figure. At a journey's own last stop the figures are posed seated rather
than walking, so arriving differs from passing through, on every journey
rather than by special case.

**D25 — Canon-wide autoplay stops at first mentions, and flies once per stop
rather than chasing every frame.** Reported directly: the bottom timeline's
play button made the map "move back and forth" for no legible reason. Root
cause was `follow()` lerping the camera toward the average position of
whatever the cursor sat on, recomputed every frame at 7 raw verses/second —
when consecutive verses name scattered places (a genealogy, an oracle
against a foreign nation, an epistle's greeting), that average itself
jitters, and a camera lerping toward a moving target never arrives anywhere.
Two changes, not one: autoplay now stops only at a verse naming a place for
the first time in canonical order (874 of 5,582 events, measured — still
touching all 1,332 places exactly once), and each stop commits to one
destination and flies an eased great-circle arc to it via `Vector3.
applyAxisAngle` slerp, the way `Camera.flyTo` works in Cesium or Mapbox,
rather than an unbounded per-frame lerp. The manual slider is untouched —
scrubbing by hand still walks all 5,582 raw events at full precision; only
autoplay's cadence changed. `markers.setCursor` already replays the full
history honestly from whatever index it is given, so skipping ahead to a
first-mention index costs nothing in correctness. A full autoplay now runs
roughly 15-26 minutes (measured against 874 stops' dwell and flight time),
longer than the old raw scrub's 13 minutes — expected and not a regression:
nothing was ever going to be watched start to finish in one sitting, and
what changed is that each stop now holds long enough to read.

**D26 — The canon-wide autoplay is gone; `t-goto` (book/chapter/verse) is
how a reader gets to a specific place in the timeline.** D25 fixed the
autoplay camera's jitter and made it stop only at first mentions — real
work, and the fix stands as the record of what was actually wrong with
`follow()`. But once it stopped jittering, the underlying question surfaced
plainly: a 15-26 minute unattended pan through the whole canon was never
going to be watched, and reported as such directly. What a reader actually
wants from this bar is to get to a specific verse, not to watch one. Added
`t-goto`: three selects (book, chapter, verse) built off the same
`bundle.events` the slider scrubs, offering only combinations that actually
carry a place, so no choice ever leads nowhere. Removed `#t-play` and every
line that existed only to serve it — `firstMentionStops`, `beginFlight`,
`follow`, the whole flight/dwell state machine, `userDriving`. The manual
slider is untouched and is now the only way to scrub freely; `t-goto` is
the way to jump precisely. `markers.setCursor`'s accumulation ("visited"
brightness, gold highlight on what is current) does not care how the
cursor arrived at an index, so neither removal changes what the map shows
at any given point — only how a reader gets there.

**D27 — "The last stop" means the last stop actually reached, not the
largest stop number in the data.** Asked directly to run every journey
through the standard set this round (measured before/after, not spot-
checked): a full scan of all ten turned up one real gap D24/D26 had missed.
Elijah's own two highest-numbered stops (Damascus, Abel-meholah, 1 Kings
19:15-16) are `aside` - named as where he is told to go, never drawn as
reached within this journey's own scope - and comparing straight against
`journey.stopCount` pointed the arrival pose at Abel-meholah, a marker
`valid` was already correctly refusing to draw at all. No seated figure
ever appeared there; stepping to Elijah's own last stop card showed
nothing, the exact bare-dot outcome D24 exists to prevent. Added
`lastReachedStop`: the highest stop number that lands on a real,
non-aside, coordinate-bearing marker, memoized per `Journey` object. Nine
of the ten journeys have `lastReachedStop === stopCount` and are
unaffected; Elijah's own arrival now lands on Horeb (stop 8), which is
where the text actually leaves him standing.

**D28 — There is no light mode. The whole app is dark, always.** A
"chrome-only" light theme was built at the owner's request and looked, in his
words, like a problem twice: two pale bands sandwiching a dark globe, because
the globe is deep-blue sea and parchment land in every condition and does not
flip. The palette was deleted rather than left unused. What survived is the
part that was always right: scrims, panels and route triggers now use tokens
instead of literal colours, `--ink-4` went back to being a hairline rather
than body text, and `--ink-3` was fixed on cards — **all three were dark-mode
bugs the light-mode work exposed.** Modal backdrops must be dark: the old one
was mixed from `--ground`, which fogged the globe with parchment.

**D29 — No year axis, and no year printed anywhere in the interface.** Built
in P4, removed two days later on the owner's call ("year 那个不 make sense"),
for reasons the data supports: most of these dates are bounded by the events
around them rather than attested; 549 of the dated events fall in years 0–100,
which is 2.4 % of a linear −4114→95 axis, so the New Testament was a sliver
nobody could aim at; and a printed year hands a derived number the same
authority as an attested one. Removing it also removed the band colour code
(spine / inferred / disputed / undated), which was a key the page never
printed. **The dates remain in the data and in the audit.** If a future
implementer wants dating back, it is an interface decision to re-take, not
data to recover — and it needs an answer to "how does a reader tell a derived
year from an attested one" before it ships again.

**D30 — Everything that links one part of this app to another is joined on the
verse, not asserted by hand.** A journey states the passage its stops come
from; a structure states the verse that measures it; an event carries the
range it covers. `src/bridges.ts` joins them on overlap, so a wrong link is a
wrong reference somewhere and `audit-events.mjs` can see it. The single
exception is four verse anchors for "this is the tabernacle you can walk
into", marked AUTHORED in that file. Return links use a **citation**
(`/#ref=Exodus 25:10`), never an event id, so a page that does not carry the
events payload never has to download it to link into the globe.

**D31 — Production deploys only when someone means it; artefacts are verified
by reading the artefact.** Netlify's auto-build is off for prod
(`stop_builds`), so pushing `main` publishes nothing; `tools/release_web.sh
--include-prod` is the only path, and `--no-build` in it is load-bearing
(without it Netlify rebuilds and discards the local bundle — and with it
`VITE_DISPLAY_VERSION` — while reporting success). The same rule applies to
binaries: a 0.1.4 APK once went up on the 0.1.5 release because the file was
copied while Gradle was still writing it, and every check had looked at the
build's intent rather than at the file. `build_apk.sh` now reads the APK's own
`versionName` back and refuses on a mismatch; after uploading, download the
asset again and check it there too.

**D32 — A tally on a gate says only what the verse counts.** BATCH-7's temple
gate said "39 side chambers". 1 Kings 6:5–10 counts storeys and gives their
widths and height; it never counts rooms, so 39 was the model's own number
presented as the text's. The gate now says 3 storeys. The rule generalises:
the number a reader sees beside a verse must be a number that verse states,
counted by the builder as it builds — 600 gourds because 7:24 says ten to the
cubit on a thirty-cubit line, 400 pomegranates because 7:42 says so — and
where the text gives a count for one thing and a form for nothing, the count
is exact and the form is the least that reads as the thing named.

