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

## Proposals (not done)

1. The real wait is globe data (6 MB raw): quantise the 50m
   coastline/land/lakes/rivers to TopoJSON or a binary format, or draw the first
   frame from 110m and upgrade after.
2. Confirm Netlify sends brotli for `/data/*`; add long cache headers for the
   versioned URLs.
3. `terrain-color.webp` (1.2 MB): tiny version first, full one after.
4. Replace `loading-globe.svg`, `icon.svg` (about 290 KB each) and `logo.png`
   (218 KB) with few-KB versions.
5. Code-split three.js / GLTFLoader / OrbitControls; manual chunks.
6. KTX2/Basis texture compression and meshopt for models (public/models is
   377 MB; the walk pages are the heavy ones).
7. Scene LQIPs: a dominant colour or 16-px blur per scene, emitted into
   events.json by the generator.
8. Self-host subset WOFF2 fonts (drops other-origin round trips and the CJK
   font CSS).
9. Split events.json (897 KB): first 60 inline, rest on demand.
10. Asset budget check in CI (for example JS < 300 KB gz, first-view data < 1.5 MB).
