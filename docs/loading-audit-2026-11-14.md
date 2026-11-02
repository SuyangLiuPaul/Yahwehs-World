# Loading audit, 2026-11-14 (owner principle: TODO §2cy, skeletons not spinners)

Method: `vite build` output served by `vite preview` (no compression, so byte
counts are raw; Netlify serves brotli, which cuts JSON/GeoJSON roughly 4-5x).
Chrome via Playwright (`channel: 'chrome'`), cold context per run. "mobile-4G"
= 390x844, 1.6 Mbit/s down, 150 ms RTT, 4x CPU slowdown. Google Fonts was the
live network in both runs. Single runs: treat differences under ~10% as noise.

## What the app loaded before (index.html, mobile-4G)

| Stage | Finding |
|---|---|
| HTML | 19 KB. Already carried a loading screen (shell, `scripts/build-shell.mjs`). |
| Render-blocking | The Google Fonts stylesheet (other origin) and `main-*.css` (48 KB) blocked first paint. The screen's own CSS lived in `main.css`, so first paint was a plain dark page. |
| JS | `main` 104 KB + three.js chunk + GLTFLoader etc., about 946 KB raw. Start-up fetches only began after the module had downloaded and run. |
| Data awaited before the globe draws | places.json 1.0 MB, coastline 1.6 MB, land 1.6 MB, lakes 0.86 MB, rivers 0.81 MB, journeys: about 6 MB raw. This is the time to ready. |
| Other | terrain-color.webp 1.2 MB, loading-globe.svg 291 KB (a logo, not a globe), icon.svg 290 KB, logo.png 218 KB. |
| Failure | If a payload or chunk failed, the loading screen stayed forever (no error, no retry). |
| Announcement | None (no live region). |
| Scenes page | events.json 897 KB gates the grid; card images were lazy but a card was a black box until its picture appeared. |

## Before / after

| Page, profile | Metric | Before | After |
|---|---|---|---|
| / desktop | Ready (loading screen lifts) | 2035 ms | 425 ms |
| / mobile-4G | First contentful paint | 5072 ms | 736 ms |
| / mobile-4G | Ready | 37.6 s | 37.3 s (bytes-bound, see proposals) |
| /scenes.html desktop | FCP / ready | 1224 / 1276 ms | 40 / 101 ms |
| /scenes.html mobile-4G | FCP / ready | 3844 / 10146 ms | 528 / 3988 ms |
| all | Layout shift (CLS) | 0.000-0.016 | 0.000-0.015 |
| / | Requests / raw KB | 45 / 13,103 | 45 / 13,107 |

Desktop FCP for `/` was not captured in the "after" run. The desktop gains are
mostly the fonts stylesheet leaving the critical path (the real Google Fonts
round trip dominated the before numbers) plus the data preloads. Bytes are
unchanged on purpose: no asset was touched.

## What changed

1. `scripts/build-shell.mjs` (regenerates all 8 pages):
   - loading-screen CSS is inline in `<head>` (removed from `nav.css`), so the
     placeholder paints with the HTML;
   - a CSS-only sphere silhouette with a calm gold shimmer shows at once and
     cross-fades to the logo SVG when it arrives (the 291 KB SVG is now
     `fetchpriority=low`, explicit 180x180);
   - title in the three readings (雅伟之界 / 雅偉之界 / Yahweh's World);
   - page-shaped skeletons: sphere (globe, walks), 3 card frames (scenes,
     figures), text lines (bible, plan);
   - `prefers-reduced-motion`: shimmer off, transitions near zero;
   - one live region (`role=status aria-live=polite aria-busy`); decorative
     parts `aria-hidden`; `aria-busy` flips to false when the screen lifts. The
     app is dark-only, so there is no light variant; `color-scheme: dark` is
     unchanged;
   - error/retry state: shown when a script fails to load, a start-up promise
     rejects, or 90 s pass; "Try again" reloads; removed if the page does
     finish; `<noscript>` hides the screen so it cannot hang without JS;
   - Google Fonts stylesheet made non-blocking (`media=print` + onload, with a
     `<noscript>` twin).
2. `index.html`: `rel=preload as=fetch` for the six start-up payloads, URLs
   identical to `src/main.ts` (including `?v=`).
3. `src/scenes-gallery.{css,ts}`: the card image frame (already 16:9, no
   shift) shimmers until the picture loads, then fades in; a dead image stops
   the shimmer. Images were already `loading=lazy decoding=async`.
4. `scripts/verify-loading.mjs`: static check (live region, retry, inline CSS,
   non-blocking fonts, preload URLs equal main.ts fetches, no duplicate
   `#loading` CSS in `src/`). Run `node scripts/verify-loading.mjs`.

Bug found and fixed on the way: a MutationObserver that re-edited the class it
watched looped forever and froze the page; it now disconnects once done.

Not done: LQIP / dominant-colour blur-up for the 1,443 scene images needs a
per-scene value that does not exist yet (scene data is out of scope here).

## Checks run

- `tsc --noEmit` clean; `vite build` ok; `verify-loading.mjs` ok.
- `verify-routes.mjs` passes (phone/tablet/desktop, en/zh).
- `verify-route-behavior`, `verify-route-network`, `verify-shared-navigation`
  time out on selectors (`#r-open` etc.) that no longer exist in the source;
  they were stale before this change.

## Pass 2 (owner approved the bigger wins, same day)

Method change: pass 1 was measured on `vite preview` (no compression, raw
bytes). Pass 2 uses `scripts/measure-loading.mjs`: it serves `dist/` itself with
brotli (quality 5, close to Netlify) and reports **wire** bytes (what is
transferred, Content-Encoding applied) next to **raw** bytes (decoded). Same
phone profile as before (390x844, 1.6 Mbit/s, 150 ms RTT, CPU 4x slower), cold
context per run, Google Fonts blocked so a third party does not move the
numbers, one run per cell (differences under ~10% are noise). "Ready" = the
page's loading screen lifts. "Before" = the tree after pass 1, built and
measured with this tool on 2026-11-14 (so the pass-1 skeleton is in both columns).

### Before / after, wire bytes at ready (raw in brackets)

| Page, profile | Metric | Before | After |
|---|---|---|---|
| / mobile-4G | First contentful paint | 1,636 ms | 664 ms |
| / mobile-4G | Home fully ready | 14.4 s | 5.1 s |
| / mobile-4G | Transferred by ready | 2,590 KB (7,790) | 659 KB (2,330) |
| / desktop | Ready / transferred by ready | 902 ms / 2,363 KB | 511 ms / 659 KB |
| /scenes.html mobile-4G | Ready | 2.65 s | 2.06 s |
| /scenes.html mobile-4G | Transferred by ready | 420 KB (1,193) | 235 KB (1,032) |
| /figures.html mobile-4G | Ready / transferred | 4.3 s / 754 KB | 2.6 s / 370 KB |
| /plan.html mobile-4G | Ready / transferred | 2.8 s / 451 KB | 2.0 s / 253 KB |
| /bible.html mobile-4G | Ready / transferred | 16.4 s / 3,089 KB | 14.5 s / 2,663 KB |

Layout shift is 0.000-0.002 on /, /scenes and /figures, unchanged elsewhere
(bible 0.925 on mobile and plan 0.01 are untouched, see "What remains").
The 1.2 MB terrain texture is no longer in the first view on any profile; it is
fetched on first zoom-in or about 4 s after the home page is ready (desktop
"transferred in total" for / is therefore 843 KB at ready+1.5 s and 2.0 MB once
the texture lands).

### What changed

1. **Geography data, 4.9 MB raw / 1.47 MB wire -> 170 KB.** `scripts/build-geo.mjs`
   packs the four Natural Earth layers into `src/geo/world.bin.gz`: coordinates
   snapped to 0.01 deg, Douglas-Peucker at 0.02 deg (never a chord over 30 deg,
   antimeridian runs simplified on their own), only the river rank kept, varint
   deltas, gzip -9 (a browser can undo gzip with `DecompressionStream`, and a
   `.gz` is sent as it is; brotli of the same data is no smaller). 166,504 ->
   94,265 points. `src/geo-codec.ts` decodes to the same GeoJSON shape, so
   `basemap.ts` and `staffage.ts` did not change; `src/geo.ts` falls back to the
   original GeoJSON in a browser without `DecompressionStream`. Vite hashes the
   file name and a small plugin (`geoPreload` in `vite.config.ts`) preloads it.
   Checks: `scripts/verify-geo.mjs` (every original vertex within 0.035 deg of
   the decoded outline, same features and rings), and a pixel comparison of the
   painted 4096x2048 basemap against the old data: 0.084% of pixels differ by
   more than 40/255, all on single edge pixels. A first version of the
   simplifier merged the collinear bottom edge of Antarctica into one 360-degree
   chord, which the basemap's antimeridian cut then removed (7% of the canvas
   wrong); the 30-degree chord limit is the fix and the comparison is what found it.
   "Detail by region/zoom" was not built: the code paints one 4096x2048 canvas
   and never swaps it, so there is no zoom-dependent geometry to attach detail to.
2. **Terrain texture on demand** (`src/terrain.ts`): fetched when the camera
   gets within 0.5 radii of the zoom band where it fades in, when the route
   thumbnail asks for it, or after ~4 s of idle (not on Save-Data).
3. **Brand images** (`scripts/build-small-brand.py`): `logo.png` (218 KB, shown
   at 34 px), `icon.svg` (290 KB, a tab icon) and `loading-globe.svg` (291 KB,
   shown at 180 px) each embedded a 512 px PNG. New files at display size, as
   WebP: `brand-logo.webp` 3.9 KB, `icon-sm.svg` 7 KB, `loading-globe-sm.svg`
   27 KB. `build-shell.mjs` points the pages at them; the originals are untouched.
4. **Figures page no longer loads three.js** at first view: `catalogue.ts` only
   needed the register of figures, which sat in the same module as the GLTF
   loader. Split into `src/walk/figures-data.ts` (re-exported from `figures.ts`).
   The 3D viewer and three.js now load when a card is opened (checked).
5. **Scene placeholders** (`scripts/build-scene-lqip.py` -> `src/scene-lqip.json`,
   37 KB raw / 14 KB gzip, hashed by Vite): the top-half and bottom-half average
   colour of each of the 1,443 thumbnails, painted as a gradient in the card frame
   until the picture is in. Read from `assets-scenes/`, nothing there changed.
6. **Size budget** (`scripts/check-budget.mjs`): static, from `dist/`, wire bytes
   (brotli q5), per page: HTML + everything it references + the start-up data
   the page fetches. Budgets are the measured sizes plus ~20%. The Netlify build
   command now ends with it, so an over-budget build fails. Static numbers match
   the browser run within 1-5%.
7. **Headers** (`netlify.toml`): immutable only for `/assets/*.js|css|gz` (the
   hashed files; `/assets/` also holds unhashed copies from `public/`, which the
   old `/assets/*` rule covered); `no-cache` for `*.html`, `/` and
   `/version.json`; `/data/*` stays `must-revalidate`. Parsed and matched with
   Netlify's own `@netlify/headers-parser` (from the installed netlify-cli).
8. Tests: `#loading.done` is `visibility:hidden` once lifted (pass 1), so
   `waitForSelector` (visible) raced it; the four scripts that waited on it now
   wait for `attached`. `verify-routes.mjs` passes on a production build.

### Not done, and why

- **JS bundle split by route**: the site already is one entry per page; only the
  figures page paid for three.js without using it (fixed). The home page is the
  globe, so there is no earlier moment to defer the engine to. What is left on
  home is 251 KB wire of JS, of which three.js is 171 KB. A further 30-40 KB
  (GLTFLoader, bridges, specs, event-media) could be deferred out of the 1,300
  line `main.ts`; not done, risk higher than the gain.
- **Texture compression (KTX2/Basis)**: no loader for it exists in the code
  (`TextureLoader` + webp), and the only large texture, `terrain-color.webp`,
  is already webp and now off the first view. Models and scene art are in other
  sessions' pipelines.
- **Self-hosted subset fonts, events.json split (897 KB raw / 172 KB wire,
  gates scenes/plan/bible)**: not asked for in this pass.

## What remains

1. ~~`bible.html`: 2.6 MB wire at ready, layout shift 0.925~~ done in pass 3 below.
2. `events.json` (135 KB wire) still gates scenes and plan (bible no longer reads it);
   the first 60 events inline and the rest on demand would take ~100 KB off each.
3. `figures.html`: 300 KB of card JPEGs load with the page; sizes are 25-50 KB
   each and could be a 2x-sized WebP set.
4. `ark.html` carries a 465 KB reference JPEG in its own markup
   (`/assets/scene-assembly-references/174.jpeg`); the other walk pages are code only.
5. `terrain-color.webp`: 1.2 MB when it does load; a half-size first pass
   would make the first zoom-in softer-then-sharper instead of empty-then-sharp.
6. Fonts (Google Fonts, other origin) are outside every number here.
7. `public/` is not mirrored by a `_headers` file; a direct (non-Git) deploy that
   ignores `netlify.toml` would not get the new cache rules or the budget check.
8. Scene thumbnails come from yahwehs-scenes.netlify.app, a separate site with its
   own headers; this repo cannot set them.

## Checks run (pass 2)

`tsc --noEmit`; `vite build`; `verify-loading.mjs`; `verify-geo.mjs`;
`check-budget.mjs`; `verify-routes.mjs` (phone/tablet/desktop, en/zh, against a
production build served by `vite preview`); a browser check that the globe, the
terrain fade-in, the figures 3D viewer and the scene placeholders work.

## Pass 3: the Bible reader (/bible.html)

Same tool and profile as pass 2 (`scripts/measure-loading.mjs`, brotli q5, 390x844,
1.6 Mbit/s, 150 ms RTT, CPU 4x, Google Fonts blocked, one cold run per cell, English).
Layout shifts are now itemised with `--shifts`. "Before" = HEAD `dbc0e3d`
(pass-2 tree) built and measured on 2026-11-03: it reproduces the pass-2 figure
(2,624 KB against 2,663 KB). Raw JSON on disk, not on the wire, in brackets.

### Before / after, /bible.html, wire bytes at ready (Genesis 1, English)

| Profile | Metric | Before | After |
|---|---|---|---|
| mobile-4G | Ready (screen lifts) | 14,480 ms | 1,584 ms |
| mobile-4G | Transferred by ready | 2,624 KB (10,101 raw) | 182 KB (546 raw) |
| mobile-4G | Requests at ready | 14 | 13 |
| mobile-4G | First contentful paint | 552 ms | 500 ms |
| mobile-4G | CLS | 0.924 | 0.000 |
| desktop | Ready / transferred by ready | 576 ms / 2,624 KB | 244 ms / 182 KB |
| desktop | CLS | 0.545 | 0.000 |
| budget (`check-budget.mjs`, static) | first view | 3,100 KB allowed, ~2,600 used | 220 KB allowed, 179 used |

CLS across widths (320, 360, 375, 390, 414, 430, 480, 481, 520, 560, 600, 640,
700, 768, 769, 900, 1024, 1440 px, English and Simplified, unthrottled): before
0.545-0.939 at every width; after 0.000-0.001 (the 0.001 is the site nav's
`routes-group`/`tab-group`, shared shell, not the reader). `verify-bible-reader.mjs`
asserts < 0.02 at 375/768/1440 in en, zh-Hans and zh-Hant: all 0.000.

### What was wrong

1. Data: the page fetched both whole Bibles it might show (BSB 1,035 KB + CUV 962 KB
   wire), `meta.json` (277 KB; 385 KB raw of it, `referents`, is read by no code),
   `places.json` (164 KB, loaded into a map that nothing used) and `events.json`
   (135 KB), then rendered one chapter.
2. Shift: the reader bar fills in after the data (its height is 47-93 px depending
   on width and language, so it cannot be reserved with one number), the chapter
   lands under it, and the bar, article and pager all moved when the screen lifted.

### What changed

1. `scripts/build-bible-split.mjs` cuts the existing files by book into
   `public/data/bible/split/`: `core.json` (183 B, chapters per book), `text/<bsb|cuvs|cuvt>/<n>.json`,
   `book/<n>.json` (that book's intro, paragraph starts, reference verses, section titles, and its events
   with their global position `ci`). Nothing new is written by hand. `--check` rebuilds in
   memory and proves the files on disk are current and reassemble to the originals
   (text of all three Bibles, paraStarts, refVerses, intros, wordsSections, all 1,443 events).
   Wired into `npm run build` after `events`. Genesis costs 59 KB (BSB) + 56 KB (CUV) + 26 KB (book)
   gzip; the largest book (Psalms) about 72 + 73 + 39 KB.
2. `src/bible-book.ts`: reads `core.json`, then only the opened book, in the language shown
   (English adds the BSB, Chinese does not fetch it; Traditional fetches the Traditional file only). The
   first book's files are requested together with `core.json`, from the URL's `?book=&ch=`, instead of
   one after another. Next/prev and the pickers use the chapter counts, so crossing a book
   boundary loads one small book. A render superseded by a faster click is dropped.
   Full-text search is the one thing that needs every verse: the whole Chinese text
   (`cuvs-yhwh.json` or `cuvt`, about 1 MB wire) is now fetched on the first query, once, with a
   "Loading" line; it used to be paid by every visit.
   `places.json` and the unread `events.json`/`meta.json` fetches are gone.
3. `src/bible-book.css`: until the first chapter is rendered, `#bible-book-page` is
   `visibility:hidden` (its box and space stay; a box that is not painted cannot shift),
   and `bible-book.ts` adds `body.bb-ready` right before the loading screen lifts. The
   screen already covers the page until then, so nothing the reader sees changes.
   The skeleton is the existing loading screen; the 100vh minimum on the page keeps the
   footer below the fold. A height-reservation per breakpoint was tried on paper and
   rejected: the bar wraps at 47/52/61/84/93 px depending on width and language.
4. `scripts/measure-loading.mjs --shifts` lists each layout shift with the elements that moved;
   `scripts/verify-bible-reader.mjs` (new) is the behaviour check: Genesis renders in all
   three languages at three viewports with no whole-Bible/meta/places/events fetch, next/prev
   including Genesis 50 <-> Exodus 1, book and chapter pickers (Psalms: 150 chapters), the
   picker dialog, search (one fetch, only then), `?book=Rev&ch=22`, `?book=43&ch=3` in Traditional.

### Regression (the pass-2 checks, same tool, this tree)

| Page, mobile-4G | Transferred by ready: pass 2 after -> now | CLS |
|---|---|---|
| / | 659 KB -> 637 KB | 0.002 |
| /scenes.html | 235 KB -> 197 KB | 0.000 |
| /figures.html | 370 KB -> 344 KB | 0.000 |
| /plan.html | 253 KB -> 209 KB | 0.010 |

(Lower than the pass-2 table on all four. None of these pages reads a file this pass
touched, so I read it as run-to-run and tree differences; I did not isolate the cause.) `verify-loading.mjs` ok, `verify-geo.mjs` ok (worst river
deviation 0.025 deg), `check-budget.mjs` ok for index/scenes/plan/figures/bible,
`build-bible-split.mjs --check` ok, `verify-bible-reader.mjs` all ok.

### Not done / left for the owner

- The monolithic `*-yhwh.json` and `meta.json` stay in `public/data/bible/`
  (the epub/pdf builders and search read them); about 11 MB is shipped that a reader
  never downloads unless they search. Moving them out of `public/` needs those scripts and
  `gate_check.py` (which defaults to `bsb-yhwh.json`) repointed.
- The first plate (`merged-full/*.jpg`, 360-410 KB, another site) loads right after ready
  on desktop; a `srcset` with the 520 px `merged-thumbs` would only help screens that
  need <= 520 px, and the mobile profile (2x) would still pick the full image.
- Build caveat in this session: HEAD `dbc0e3d` does not build on its own (vite.config.ts
  names pages that are only in another session's uncommitted work), so the
  before/after were built from a worktree with the page list trimmed to the five measured
  pages; that trim is not committed. `tsc --noEmit` reports `sumEn`/`img` errors that exist at HEAD too.
