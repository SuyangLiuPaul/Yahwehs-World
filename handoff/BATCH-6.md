# BATCH-6 — The events layer, its menu, no year axis, and corridors between the pages

Implemented 2026-09-17/18. Commits `b605c67`, `ae2a97c`, `f5f0c87`, `c619573`,
`6c69c77`. Released as **v0.1.5** (tag, GitHub Release, prod, signed APK, DMG).

This supersedes `02-current-state.md` and the Phase 4 entry in `08-roadmap.md`
wherever they disagree. Everything below was measured from the repository or
from the running app, not assumed.

## 1 · Phase 4 shipped: all 1,443 events are drawn

`src/events-track.ts` (~230 lines) draws every event as a band on a **canvas**
under the verse slider — not 1,443 DOM nodes, because the track repaints on
every scrub and the hit test is one search either way. Lane packing (max 6)
turns density into something legible; the hit test takes the nearest band in
the pointer's own lane, because a 1 px band cannot be hit exactly.

`public/data/events.json` (158 kB gzipped) is projected from
`data/events/all-events.json` by `scripts/build-events-payload.mjs`, fetched
**after** first paint. The projection authors nothing.

Two spec/data mismatches were found and resolved in favour of the data, and
are recorded here so nobody re-derives them:

- **"The 105 spine events" do not exist as a subset of the 1,443.** 309 events
  carry `dateSource.kind === 'spine'`; the 105 spine entries are what dates were
  taken FROM, and many events share one (28 are dated from `isaiah` alone).
- `dateSource.id` / `e.id` resolve against nothing in
  `seeksparks-timeline.json`; the linking field is `of`.

## 2 · A menu for the 1,443

`src/events-menu.ts`. The track answers "where are the events"; it cannot
answer "take me to the crossing of the Red Sea" — at 1232 px the average band
is under a pixel. So: a book chooser (66 books with counts), a search box, and
one book's events in the DOM at a time (median 12, largest 150).

Search is **tokenised** — every token must appear somewhere in
`en + zh + hant(zh) + ref + refZh`. It was one substring until `Exod 14`
returned nothing against a reference reading "Exodus 14:1–14:31"; the comment
directly above the code claimed that exact query would land.

## 3 · The year axis was removed (D29)

It shipped, the owner looked at it, and it went: "year 那个不 make sense".
The reasons are in the data — most dates are bounded by neighbouring events
rather than attested, 549 of the dated events fall in years 0–100 (2.4 % of a
linear −4114→95 axis), and printing a year gives a derived number the same
authority as an attested one.

Gone from the **interface**: the Years/Verses toggle, the slider's year mode
and the year↔verse mapping, the BC/AD readout, the year range on every menu
row, and the band colour code (spine / inferred / disputed / undated) — that
code was a key the page never printed anywhere, and with no year on screen it
encoded a fact the interface no longer showed.

Gone from **nothing else**: `events.json` still carries `yearEarly`,
`yearLate`, `dateConfidence`, `dateBasis`, and `audit-events.mjs` still checks
them. Reversible by intent.

## 4 · Corridors — the three pages now know about each other (D30)

`src/bridges.ts`. The app had three doors and nothing between them: a reader
who opened 「立起会幕、神荣光充满」 was standing on Exodus 40 with a tabernacle
they could walk into one tab away, and nothing said so.

Everything is **joined on the verse**, because every part of this app already
cites chapter and verse:

| From | To | The join |
|---|---|---|
| event | the journey it falls inside (opens the route) | journey span = min…max of the verses its own stops cite |
| event | the card that measures it | the structure's own `ref` (`Genesis 6:15`, `Exodus 25:10`…) falls inside the event |
| event | walk into the tabernacle | **AUTHORED**: four verse anchors in `bridges.ts` (Exod 26:1, 27:18, 36:8, 40:17). Exodus 32 sits between two of them and is deliberately excluded |
| journey | the events inside its passage | same span, as a filtered menu with a chip; closing the route is deliberate (a route and the verse timeline never share the screen) |
| journey | the structure it carries | the ark: same id on both sides |
| structure card / tabernacle gate | back to the globe | `/#ref=Exodus 25:10` — a **citation**, so those pages link by the verse already printed on them and download no event data |

`/#event=<id>` opens an exact event; `/structures.html#ark` opens on that card.
Counts today: Paul 1/2/3/Rome 7/12/13/14, Mark 50, Jacob 25, Abraham 20, ark 36,
Elijah 4, wilderness **1** — the wilderness route is read out of the Numbers 33
itinerary list, so its passage really is one chapter. That number is honest, not
a bug; widening it is a content decision nobody has taken.

## 5 · Defects found and fixed while doing the above

- The events track and its menu stayed visible **under an open journey** —
  1,443 bands under a route covering thirty verses. Now hidden with the rest of
  the canon-wide reading (`route-ui.css`).
- `#t-ref` was `flex: none`, so a long event title pushed everything after it
  off the strip on a phone and was cut mid-word with no ellipsis.
- The footer grows when an event opens on a phone (links take a second line)
  and nothing re-measured `--footer-height`, so the routes bar sat on them.
- `public/data/inventory.json` was **stale** — still carrying the pre-D18 "The
  Lord Will Provide" / "The Lord Is There". The generator was right; the
  artefact was older than the decision and had been shipping that way.

## 6 · Checks that changed (read this before trusting a green run)

- `scripts/audit-events.mjs` now sweeps **every JSON in `public/data`** instead
  of two hardcoded files — adding a third payload had silently disabled the
  guarantee. It also gained a **corridor check**: every journey span, structure
  measurement verse and tabernacle anchor must land inside an event. The
  anchors are read out of the files that own them rather than restated.
  Mutation-tested by pointing one anchor at Exodus 99:1 and confirming it
  reported it.
- `scripts/audit-contrast.mjs` now also loads `/#ref=Exodus 25:10` — the globe
  with an event **open**. State-dependent text is text a reader reads, and a
  sweep that only sees the resting page cannot measure it.
- `tools/build_apk.sh` now reads the APK's own `versionName` back with `aapt2`
  and refuses if it disagrees with `tauri.conf.json`. This exists because a
  0.1.4 APK was uploaded to the 0.1.5 release: the file was copied out of the
  output directory while Gradle was still writing the new one, and every check
  until then had looked at the build's intent rather than at the artefact.

Current state of all of them: audit findings 0, uncited verses 0, 耶和华 in
shipped payloads 0, corridors broken 0, contrast failures 0 (dark and light
sweeps, four pages), `tsc --noEmit` clean.

## 7 · Native + release pipeline (see `14-native-builds.md`)

Tauri v2 shell. `tools/`: `bump_version.sh` (three manifests in lock-step),
`release_web.sh` (dev by default; `--include-prod` is the only thing that
touches production, since prod's auto-build is off), `tag_release.sh` (tag +
GitHub Release), `build_apk.sh` (re-applies signing config, localised launcher
name and icons every run, because `src-tauri/gen/` is gitignored and
regenerated).

The display version may carry a dev suffix (`0.1.5.7`); **only the plain X.Y.Z
is ever compared** to a release tag. iOS is simulator-only by decision (free
personal team ⇒ 7-day profiles).
