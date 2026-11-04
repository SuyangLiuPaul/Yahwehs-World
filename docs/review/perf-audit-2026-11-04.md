# Yahweh's World — performance / jank audit, 2026-11-04

**What was measured** the DEV site `https://yahwehsworld-dev.netlify.app` (build id `3b9cd31b3a7b`, the one the owner
calls build 3), with Playwright 1.63 against **Chromium 153.0.8010.12** and **WebKit 26.6**, CPU-throttled through CDP
(`Emulation.setCPUThrottlingRate` 1× / 4× / 6×) and network-throttled to Lighthouse's **fast 4G** (9 Mbit down,
40 ms RTT). Harness: `tools/perf/measure.mjs`, probe `tools/perf/lib/probe.mjs`, budgets
`tools/perf/budget.mjs` + `tools/perf/budgets.json`, unit tests `tests/perf/probe.test.ts`.
Raw numbers: `docs/evidence/perf-2026-11-04/*/` (`load.json`, `scroll.json`, `interact.json`, `memory.json`,
`decode.json`, `offline.json`, and a `summary.md` of tables per run).

Nothing under `src/` was changed. No build of a native shell was run, nothing was deployed, nothing was pushed.

**Device classes.** A CPU throttle is the only honest stand-in for a phone from a Mac, and only Chromium has one.
`desktop1x` = 1440×900, 1× CPU. `phone4x` = 390×844 @3, 4× CPU — a mid-range phone. `phone6x` = 390×844 @2.625,
6× CPU — a low-end Android. `ipad1x` = 1024×1366, 1× CPU. WebKit runs **unthrottled** at the phone viewport and is
there for the **engine** difference (iOS/macOS shells are WKWebView), never as an iPhone number; see
§7 for what that means and §8 for what only a device can answer.

**How to re-run any of it.** `npx playwright install chromium webkit` once, then:

```bash
# everything, every device class, both engines (~90 min)
node tools/perf/measure.mjs --out docs/evidence/perf-$(date +%F)

# one suite, one class (each is independent)
node tools/perf/measure.mjs --suite load     --engine chromium --profile phone4x
node tools/perf/measure.mjs --suite scroll   --engine chromium --profile phone6x
node tools/perf/measure.mjs --suite interact --engine chromium --profile phone6x
node tools/perf/measure.mjs --suite memory,decode,offline --engine chromium --profile phone4x

# against a local build instead of the dev site
node tools/perf/measure.mjs --base http://localhost:4173 --suite load

# the regression gate
node tools/perf/budget.mjs --only assets      # ten seconds, no browser
node tools/perf/budget.mjs                   # all four groups
node --test "tests/perf/*.test.ts"           # the harness's own arithmetic
```

Suites are `load`, `scroll`, `interact`, `memory`, `decode`, `offline`; profiles are `desktop1x`, `phone4x`,
`phone6x`, `ipad1x`; `--repeats N` for variance. Each run writes `<suite>.json` plus a `summary.md` of the tables.
**Run one suite at a time** — two browsers measuring at once on the same machine corrupts both.

---

## 1. The short answer

The owner is right that there is lag, and the measurements say it is **three different problems wearing one coat**:

1. **A network problem on every first load, in every language.** Each of the six routes downloads
   **2.68 MiB of Simplified-Chinese font** — `NotoSerifSC-500` (1,713,024 B) and `NotoSansSC-400` (962,904 B) —
   *on an `en-US` page*. The serif file alone occupies the connection for **2.4–3.0 s** on fast 4G. It is 92 % of
   the bytes of the Bible routes. Two causes, both found exactly (§3, P1/P2).
2. **A frame problem that is only in the gallery, only once the grid is full, and only on a slow device.**
   Flinging the complete 1,443-card grid at 6× CPU gives **18.6 fps** — 373 frames in 20 s, **89.3 % of them
   dropped**, p50 **50 ms**, worst **100 ms** — and costs **3,045 ms of layout plus 1,239 ms of style recalc** for
   that one sweep. The same fling at 2,638 nodes is smooth (0.2 % dropped). On a **mid** phone the same 7,453 nodes
   dropped 1.8 % in one run and **58.7 %** in another — the grid sits on the edge of the frame budget there, which
   is why some readers see lag and others do not. The grid has no virtualisation and the codebase contains no
   `content-visibility` and no `contain` at all, so style, layout and paint stay O(all cards) (§3, P3).
3. **A main-thread problem in the reader, worst in 对照.** The worst single frame measured anywhere on the site is
   **337 ms** on `/bible.html` in parallel mode at 6× CPU, of which **224 ms is script in `session-*.js` and
   172 ms of that is forced style-and-layout** — the chapter's `innerHTML` write followed, in the same task, by
   `getBoundingClientRect` / `focus()` / `scrollIntoView` reads (§3, P5).

And three things the measurements **clear**, so no one spends a week on them:

* **Nothing leaks.** The JS heap falls over a full 1,443-card sweep (3.20 → 2.83 MiB) and over 20 chapter changes
  (10.06 → 6.53 MiB after collection); the plates' listeners detach as designed (§2.5).
* **Picture decode is not the jank.** A thumb decodes in 4.8 ms and a full picture in 12.6 ms at 4× CPU, off the
  main thread (§2.6).
* **The offline fallback and the worker are cheap.** `/offline.html` is 4,713 B with zero subresources and loads in
  78 ms; the worker precaches 54 entries with no long task (§2.7).

The cheapest four fixes — P1a+P1b, P2, P3's one CSS line, P5's one `requestAnimationFrame` — are a day's work
between them and account for every number above except the iOS blur (P6), which costs ten minutes to *measure* and
is likely the largest felt win on an iPhone.

---

## 2. Measured numbers

### 2.1 Load — Core Web Vitals per route × device class × cache state

Cold = a fresh browser context, nothing stored, no service worker. Warm = the second navigation in that same
context, with the HTTP cache and the worker it had just installed.

| engine | class | route | cache | LCP ms | CLS | TBT ms | long tasks | requests | KB | LCP element |
|---|---|---|---|---|---|---|---|---|---|---|
| chromium | desktop1x | home | cold | 1712 | 0.0123 | 0 | 0 (0ms) | 22 | 2912 | img |
| chromium | desktop1x | home | warm | 288 | 0.0123 | 0 | 0 (0ms) | 22 | 3129 | img |
| chromium | desktop1x | scenes | cold | 1256 | 0.0024 | 0 | 0 (0ms) | 57 | 4392 | img |
| chromium | desktop1x | scenes | warm | 616 | 0.0037 | 0 | 0 (0ms) | 60 | 4627 | img |
| chromium | desktop1x | scene | cold | 1728 | 0.0015 | 0 | 0 (0ms) | 28 | 3458 | img |
| chromium | desktop1x | scene | warm | 184 | 0.0016 | 0 | 0 (0ms) | 31 | 4204 | img |
| chromium | desktop1x | gen1 | cold | 992 | 0.0001 | 0 | 0 (0ms) | 25 | 2986 | img.yr-plate-img |
| chromium | desktop1x | gen1 | warm | 344 | 0.0001 | 0 | 0 (0ms) | 25 | 3412 | img.yr-plate-img |
| chromium | desktop1x | ps119 | cold | 932 | 0.0001 | 0 | 0 (0ms) | 25 | 2949 | img.yr-plate-img |
| chromium | desktop1x | ps119 | warm | 368 | 0.0001 | 0 | 0 (0ms) | 30 | 3525 | img.yr-plate-img |
| chromium | desktop1x | parallel | cold | 904 | 0.0001 | 0 | 0 (0ms) | 26 | 3017 | img.yr-plate-img |
| chromium | desktop1x | parallel | warm | 260 | 0.0001 | 0 | 0 (0ms) | 31 | 3718 | img.yr-plate-img |
| chromium | phone4x | home | cold | 1140 | 0 | 0 | 0 (0ms) | 22 | 2912 | img |
| chromium | phone4x | home | warm | 508 | 0 | 6 | 1 (56ms) | 22 | 3129 | img |
| chromium | phone4x | scenes | cold | 1716 | 0 | 0 | 0 (0ms) | 35 | 2720 | img |
| chromium | phone4x | scenes | warm | 524 | 0 | 0 | 0 (0ms) | 35 | 2931 | img |
| chromium | phone4x | scene | cold | 1988 | 0.0389 | 0 | 0 (0ms) | 28 | 3459 | img |
| chromium | phone4x | scene | warm | 776 | 0.0389 | 0 | 0 (0ms) | 28 | 4174 | img |
| chromium | phone4x | gen1 | cold | 2216 | 0 | 32 | 1 (82ms) | 24 | 2941 | img.yr-plate-img |
| chromium | phone4x | gen1 | warm | 308 | 0 | 33 | 2 (133ms) | 24 | 3367 | img.yr-plate-img |
| chromium | phone4x | ps119 | cold | 2036 | 0 | 29 | 2 (129ms) | 25 | 2949 | img.yr-plate-img |
| chromium | phone4x | ps119 | warm | 424 | 0 | 44 | 2 (144ms) | 25 | 57 | img.yr-plate-img |
| chromium | phone4x | parallel | cold | 1080 | 0 | 138 | 3 (288ms) | 26 | 3017 | img.yr-plate-img |
| chromium | phone4x | parallel | warm | 540 | 0 | 169 | 3 (319ms) | 26 | 3603 | img.yr-plate-img |
| chromium | phone6x | home | cold | 1612 | 0 | 0 | 0 (0ms) | 22 | 2912 | img |
| chromium | phone6x | home | warm | 684 | 0 | 0 | 0 (0ms) | 22 | 3129 | img |
| chromium | phone6x | scenes | cold | 1592 | 0 | 0 | 0 (0ms) | 35 | 2720 | img |
| chromium | phone6x | scenes | warm | 676 | 0 | 0 | 0 (0ms) | 35 | 2931 | img |
| chromium | phone6x | scene | cold | 1716 | 0.0389 | 0 | 0 (0ms) | 28 | 3459 | img |
| chromium | phone6x | scene | warm | 424 | 0 | 0 | 0 (0ms) | 28 | 4174 | img |
| chromium | phone6x | gen1 | cold | 1440 | 0 | 109 | 1 (159ms) | 24 | 2941 | img.yr-plate-img |
| chromium | phone6x | gen1 | warm | 592 | 0 | 117 | 2 (217ms) | 24 | 3367 | img.yr-plate-img |
| chromium | phone6x | ps119 | cold | 1248 | 0 | 157 | 2 (257ms) | 25 | 2949 | img.yr-plate-img |
| chromium | phone6x | ps119 | warm | 600 | 0 | 77 | 2 (177ms) | 25 | 3410 | img.yr-plate-img |
| chromium | phone6x | parallel | cold | 1476 | 0 | 324 | 3 (474ms) | 26 | 3017 | img.yr-plate-img |
| chromium | phone6x | parallel | warm | 892 | 0 | 333 | 2 (433ms) | 28 | 3604 | img.yr-plate-img |
| chromium | ipad1x | home | cold | 1412 | 0 | 0 | 0 (0ms) | 22 | 2912 | img |
| chromium | ipad1x | home | warm | 120 | 0 | 0 | 0 (0ms) | 25 | 3153 | img |
| chromium | ipad1x | scenes | cold | 2348 | 0 | 0 | 0 (0ms) | 55 | 3442 | img |
| chromium | ipad1x | scenes | warm | 404 | 0 | 0 | 0 (0ms) | 58 | 3677 | img |
| chromium | ipad1x | scene | cold | 1688 | 0.001 | 0 | 0 (0ms) | 28 | 3458 | img |
| chromium | ipad1x | scene | warm | 152 | 0 | 0 | 0 (0ms) | 31 | 4204 | img |
| chromium | ipad1x | gen1 | cold | 848 | 0 | 0 | 0 (0ms) | 25 | 2986 | img.yr-plate-img |
| chromium | ipad1x | gen1 | warm | 144 | 0 | 0 | 0 (0ms) | 30 | 3527 | img.yr-plate-img |
| chromium | ipad1x | ps119 | cold | 1028 | 0 | 0 | 0 (0ms) | 25 | 2949 | img.yr-plate-img |
| chromium | ipad1x | ps119 | warm | 132 | 0 | 0 | 0 (0ms) | 27 | 3411 | img.yr-plate-img |
| chromium | ipad1x | parallel | cold | 1216 | 0 | 0 | 0 (0ms) | 26 | 3017 | img.yr-plate-img |
| chromium | ipad1x | parallel | warm | 188 | 0 | 0 | 0 (0ms) | 29 | 3621 | img.yr-plate-img |
| webkit | phone4x | home | cold | 1448 | 0 | 0 | 0 (0ms) | 21 | 1972 | img |
| webkit | phone4x | home | warm | 368 | 0 | 0 | 0 (0ms) | 21 | 1742 | img |
| webkit | phone4x | scenes | cold | 404 | 0 | 0 | 0 (0ms) | 30 | 1863 | img |
| webkit | phone4x | scenes | warm | 240 | 0 | 0 | 0 (0ms) | 30 | 1742 | img |
| webkit | phone4x | scene | cold | 632 | 0 | 0 | 0 (0ms) | 29 | 3462 | img |
| webkit | phone4x | scene | warm | 352 | 0 | 0 | 0 (0ms) | 28 | 2888 | img |
| webkit | phone4x | gen1 | cold | 504 | 0 | 0 | 0 (0ms) | 23 | 2901 | img.yr-plate-img |
| webkit | phone4x | gen1 | warm | 268 | 0 | 0 | 0 (0ms) | 23 | 2748 | img.yr-plate-img |
| webkit | phone4x | ps119 | cold | 560 | 0 | 0 | 0 (0ms) | 24 | 2928 | img.yr-plate-img |
| webkit | phone4x | ps119 | warm | 356 | 0 | 0 | 0 (0ms) | 24 | 2766 | img.yr-plate-img |
| webkit | phone4x | parallel | cold | 516 | 0 | 0 | 0 (0ms) | 25 | 2996 | img.yr-plate-img |
| webkit | phone4x | parallel | warm | 252 | 0 | 0 | 0 (0ms) | 25 | 2834 | img.yr-plate-img |

### 2.2 Bytes by kind (cold) — KiB transferred (requests)

| engine | class | route | js | css | font | thumb | full | reader-data | data |
|---|---|---|---|---|---|---|---|---|---|
| chromium | desktop1x | home | 18 (7) | 21 (3) | 2718 (8) | - | 84 (1) | - | 67 (2) |
| chromium | desktop1x | scenes | 16 (5) | 21 (3) | 2705 (7) | 1579 (40) | - | - | 67 (1) |
| chromium | desktop1x | scene | 48 (8) | 25 (4) | 2707 (8) | - | 402 (2) | 66 (3) | 207 (2) |
| chromium | desktop1x | gen1 | 43 (7) | 24 (4) | 2696 (7) | 86 (2) | - | 66 (3) | 67 (1) |
| chromium | desktop1x | ps119 | 43 (7) | 24 (4) | 2706 (8) | 21 (1) | - | 83 (3) | 67 (1) |
| chromium | desktop1x | parallel | 43 (7) | 24 (4) | 2706 (8) | 21 (1) | - | 151 (4) | 67 (1) |
| chromium | phone4x | home | 18 (7) | 21 (3) | 2718 (8) | - | 84 (1) | - | 67 (2) |
| chromium | phone4x | scenes | 16 (5) | 21 (3) | 1755 (5) | 857 (20) | - | - | 67 (1) |
| chromium | phone4x | scene | 48 (8) | 25 (4) | 2707 (8) | - | 402 (2) | 66 (3) | 207 (2) |
| chromium | phone4x | gen1 | 43 (7) | 24 (4) | 2696 (7) | 41 (1) | - | 66 (3) | 67 (1) |
| chromium | phone4x | ps119 | 43 (7) | 24 (4) | 2706 (8) | 21 (1) | - | 83 (3) | 67 (1) |
| chromium | phone4x | parallel | 43 (7) | 24 (4) | 2706 (8) | 21 (1) | - | 151 (4) | 67 (1) |
| chromium | phone6x | home | 18 (7) | 21 (3) | 2718 (8) | - | 84 (1) | - | 68 (2) |
| chromium | phone6x | scenes | 16 (5) | 21 (3) | 1755 (5) | 857 (20) | - | - | 67 (1) |
| chromium | phone6x | scene | 48 (8) | 25 (4) | 2707 (8) | - | 402 (2) | 66 (3) | 207 (2) |
| chromium | phone6x | gen1 | 43 (7) | 24 (4) | 2696 (7) | 41 (1) | - | 66 (3) | 67 (1) |
| chromium | phone6x | ps119 | 43 (7) | 24 (4) | 2706 (8) | 21 (1) | - | 83 (3) | 67 (1) |
| chromium | phone6x | parallel | 43 (7) | 24 (4) | 2706 (8) | 21 (1) | - | 151 (4) | 67 (1) |
| chromium | ipad1x | home | 18 (7) | 21 (3) | 2718 (8) | - | 84 (1) | - | 67 (2) |
| chromium | ipad1x | scenes | 16 (5) | 21 (3) | 1755 (5) | 1579 (40) | - | - | 67 (1) |
| chromium | ipad1x | scene | 48 (8) | 25 (4) | 2707 (8) | - | 402 (2) | 66 (3) | 207 (2) |
| chromium | ipad1x | gen1 | 43 (7) | 24 (4) | 2696 (7) | 86 (2) | - | 66 (3) | 67 (1) |
| chromium | ipad1x | ps119 | 43 (7) | 24 (4) | 2706 (8) | 21 (1) | - | 83 (3) | 67 (1) |
| chromium | ipad1x | parallel | 43 (7) | 24 (4) | 2706 (8) | 21 (1) | - | 151 (4) | 67 (1) |
| webkit | phone4x | home | 3 (1) | 34 (8) | 1778 (7) | - | 84 (1) | - | 67 (2) |
| webkit | phone4x | scenes | 5 (1) | 29 (5) | 1756 (5) | 0 (16) | - | - | 67 (1) |
| webkit | phone4x | scene | 5 (1) | 68 (11) | 2708 (8) | - | 402 (2) | 66 (3) | 207 (2) |
| webkit | phone4x | gen1 | 1 (1) | 64 (8) | 2698 (7) | 0 (1) | - | 66 (3) | 67 (1) |
| webkit | phone4x | ps119 | 1 (1) | 64 (8) | 2708 (8) | 0 (1) | - | 84 (3) | 67 (1) |
| webkit | phone4x | parallel | 1 (1) | 64 (8) | 2708 (8) | 0 (1) | - | 152 (4) | 67 (1) |

### 2.3 Scroll smoothness

**Read the `dropped` column, not `% > 16.7 ms`.** A 60 Hz display delivers frames at 16.67 ms, so half of a
*perfectly smooth* run measures a hair over 16.7 — "42.9 % over 16.7 ms" on an idle desktop is vsync jitter.
A frame a reader loses is one over 20 ms (late) or over 33.3 ms (the display showed the previous frame twice).
Both of the asked-for columns are printed anyway, with this caveat: **`% > 8.3 ms` is 100 % in every row and
carries no information here**, because a headless browser presents at 60 Hz and no frame can be shorter than
~16.7 ms. That column only becomes meaningful on a 120 Hz device, which is §8 item 1.

`gallery-1443` = all 1,443 cards forced into the DOM, then flung. `gallery-progressive` = the grid as a reader
actually meets it, the `IntersectionObserver` adding 60 at a time while the fling runs.

The `heap MB` column here is `performance.memory`, which Chrome quantises into buckets — hence "9.5 → 9.5" in
every row. **Ignore it and read §2.5**, which uses CDP and gives real bytes. WebKit has no heap API at all, hence
the dashes.

| engine | class | case | frames | dropped >33ms | % >20ms | % >16.7ms | % >8.3ms | p50 | p95 | p99 | worst | nodes before→after | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chromium | desktop1x | gallery-1443 | 1200 | 0 (0%) | 0 | 40.4 | 100 | 16.7 | 16.7 | 16.8 | 16.8 | 7453→7453 | 9.5→9.5 |
| chromium | desktop1x | gallery-progressive | 961 | 0 (0%) | 0 | 33.1 | 100 | 16.7 | 16.7 | 16.8 | 16.8 | 538→4138 | 9.5→9.5 |
| chromium | desktop1x | ps119 | 840 | 0 (0%) | 0 | 34.3 | 100 | 16.7 | 16.7 | 16.8 | 16.8 | 977→977 | 9.5→9.5 |
| chromium | desktop1x | ps119-parallel | 840 | 0 (0%) | 0 | 29.9 | 100 | 16.7 | 16.7 | 16.8 | 16.8 | 2395→2395 | 9.5→9.5 |
| chromium | phone4x | gallery-1443 | 1155 | 21 (1.8%) | 4 | 44.9 | 100 | 16.7 | 16.8 | 33.3 | 33.4 | 7453→7453 | 9.5→9.5 |
| chromium | phone4x | gallery-progressive | 961 | 0 (0%) | 0 | 32.6 | 100 | 16.7 | 16.8 | 16.8 | 16.8 | 538→2638 | 9.5→9.5 |
| chromium | phone4x | ps119 | 840 | 0 (0%) | 0 | 32.4 | 100 | 16.7 | 16.8 | 16.8 | 16.8 | 977→977 | 9.5→9.5 |
| chromium | phone4x | ps119-parallel | 840 | 0 (0%) | 0 | 30.4 | 100 | 16.7 | 16.7 | 16.8 | 16.8 | 2395→2395 | 9.5→9.5 |
| chromium | phone6x | gallery-1443 | 373 | 333 (89.3%) | 92 | 94.6 | 100 | 50 | 66.8 | 83.4 | 100 | 7453→7453 | 9.5→9.5 |
| chromium | phone6x | gallery-progressive | 958 | 2 (0.2%) | 0.2 | 33.8 | 100 | 16.7 | 16.8 | 16.8 | 33.4 | 538→2638 | 9.5→9.5 |
| chromium | phone6x | ps119 | 840 | 0 (0%) | 0 | 31.3 | 100 | 16.7 | 16.8 | 16.8 | 16.8 | 977→977 | 9.5→9.5 |
| chromium | phone6x | ps119-parallel | 840 | 0 (0%) | 0 | 31.4 | 100 | 16.7 | 16.8 | 16.8 | 16.8 | 2395→2395 | 9.5→9.5 |
| webkit | phone4x | gallery-1443 | 1186 | 1 (0.1%) | 5 | 58.3 | 100 | 17 | 20 | 23 | 37 | 7453→7453 | - |
| webkit | phone4x | gallery-progressive | 959 | 1 (0.1%) | 0.9 | 61.1 | 99.8 | 17 | 19 | 20 | 39 | 536→2638 | - |
| webkit | phone4x | ps119 | 840 | 0 (0%) | 0 | 63 | 100 | 17 | 18 | 19 | 20 | 975→977 | - |
| webkit | phone4x | ps119-parallel | 842 | 0 (0%) | 0.5 | 63.3 | 99.8 | 17 | 18 | 20 | 33 | 2393→2395 | - |

### 2.4 Interaction latency

`visible ms` = from the input to the DOM condition that means the reader can see the result (wall clock).
`worst event ms` = the browser's own Event Timing duration, which is what field INP is built from.
`reader render ms` = `window.__yrPerf.renderMs`, the reader module's own timer around `renderBody` + `innerHTML`
(`src/reader/view.ts:304-345`), with the verse count it rendered.

**`back-nav` is `-` in every row and is a harness defect, not a finding.** The case navigated straight to
`/scenes.html#p=genesis-1-1`, so `page.goBack()` leaves the document instead of returning to the grid. The honest
version — load `/scenes.html`, click a card, then go back — is not in this run; it is a two-line change in
`tools/perf/measure.mjs` for whoever next runs the suite.

| engine | class | case | visible ms | INP ms | worst event ms | worst task ms | CLS | reader render ms (verses) |
|---|---|---|---|---|---|---|---|---|
| chromium | desktop1x | lang-menu-open | 77 | 40 | 40 | 0 | 0 | - |
| chromium | desktop1x | lang-switch-hant | 95 | 40 | 40 | 0 | 0 | - |
| chromium | desktop1x | surface-paper | 326 | 40 | 40 | 0 | 0 | 0.5 (31) |
| chromium | desktop1x | search-open | 34 | 16 | 16 | 0 | 0 | - |
| chromium | desktop1x | search-type | 798 | 24 | 24 | 0 | 0 | - |
| chromium | desktop1x | feedback-sheet | 127 | 40 | 40 | 0 | 0 | 1.7 (12) |
| chromium | desktop1x | verse-select | 37 | 48 | 48 | 0 | 0 | 2.6 (176) |
| chromium | desktop1x | verse-copy | 33 | 16 | 16 | 0 | 0 | 2.8 (176) |
| chromium | desktop1x | parallel-on | 232 | 40 | 40 | 0 | 0 | 27.2 (176) |
| chromium | desktop1x | parallel-add | 839 | 24 | 24 | 0 | 0 | 6.3 (176) |
| chromium | desktop1x | parallel-off | 89 | 48 | 48 | 0 | 0 | 6.3 (176) |
| chromium | desktop1x | chapter-next | 39 | 40 | 40 | 0 | 0 | 1.7 (7) |
| chromium | desktop1x | text-size-up | 52 | 24 | 24 | 0 | 0 | 1.9 (176) |
| chromium | desktop1x | scene-next | 41 | 48 | 48 | 0 | 0 | 0.4 (12) |
| chromium | desktop1x | back-nav | - | 0 | 0 | 0 | 0 | - |
| chromium | phone4x | lang-menu-open | 225 | 128 | 128 | 0 | 0 | - |
| chromium | phone4x | lang-switch-hant | 454 | 72 | 72 | 182 | 0 | - |
| chromium | phone4x | surface-paper | 398 | 56 | 56 | 0 | 0 | 2.2 (31) |
| chromium | phone4x | search-open | 64 | 0 | 0 | 0 | 0 | - |
| chromium | phone4x | search-type | 878 | 32 | 32 | 0 | 0 | - |
| chromium | phone4x | feedback-sheet | 139 | 48 | 48 | 0 | 0 | 5.1 (12) |
| chromium | phone4x | verse-select | 106 | 56 | 56 | 0 | 0 | 8.2 (176) |
| chromium | phone4x | verse-copy | 41 | 16 | 16 | 0 | 0 | 8.2 (176) |
| chromium | phone4x | parallel-on | 244 | 40 | 40 | 87 | 0 | 86.4 (176) |
| chromium | phone4x | parallel-add | 867 | 32 | 32 | 56 | 0 | 12.8 (176) |
| chromium | phone4x | parallel-off | 118 | 80 | 80 | 0 | 0 | 21.4 (176) |
| chromium | phone4x | chapter-next | 92 | 40 | 40 | 0 | 0 | 5.2 (7) |
| chromium | phone4x | text-size-up | 79 | 40 | 40 | 0 | 0 | 7.0 (176) |
| chromium | phone4x | scene-next | 42 | 56 | 56 | 0 | 0 | 1.5 (12) |
| chromium | phone4x | back-nav | - | 0 | 0 | 0 | 0 | - |
| chromium | phone6x | lang-menu-open | 238 | 128 | 128 | 104 | 0 | - |
| chromium | phone6x | lang-switch-hant | 457 | 128 | 128 | 117 | 0 | - |
| chromium | phone6x | surface-paper | 445 | 72 | 72 | 0 | 0 | 3.1 (31) |
| chromium | phone6x | search-open | 93 | 16 | 16 | 0 | 0 | - |
| chromium | phone6x | search-type | 945 | 48 | 48 | 0 | 0 | - |
| chromium | phone6x | feedback-sheet | 163 | 48 | 48 | 0 | 0 | 6.6 (12) |
| chromium | phone6x | verse-select | 121 | 64 | 64 | 0 | 0 | 12.0 (176) |
| chromium | phone6x | verse-copy | 119 | 16 | 24 | 0 | 0 | 12.2 (176) |
| chromium | phone6x | parallel-on | 378 | 64 | 64 | 172 | 0 | 169.9 (176) |
| chromium | phone6x | parallel-add | 929 | 64 | 64 | 97 | 0.1694 | 24.2 (176) |
| chromium | phone6x | parallel-off | 214 | 136 | 136 | 89 | 0 | 38.7 (176) |
| chromium | phone6x | chapter-next | 122 | 72 | 72 | 0 | 0 | 11.5 (7) |
| chromium | phone6x | text-size-up | 134 | 88 | 88 | 76 | 0 | 12.6 (176) |
| chromium | phone6x | scene-next | 136 | 80 | 80 | 0 | 0 | 2.2 (12) |
| chromium | phone6x | back-nav | - | 0 | 0 | 0 | 0 | - |
| webkit | phone4x | lang-menu-open | 81 | 48 | 48 | 0 | 0 | - |
| webkit | phone4x | lang-switch-hant | 329 | 48 | 48 | 0 | 0 | - |
| webkit | phone4x | surface-paper | 379 | 16 | 16 | 0 | 0 | 1.0 (31) |
| webkit | phone4x | search-open | 99 | 16 | 16 | 0 | 0 | - |
| webkit | phone4x | search-type | 840 | 16 | 16 | 0 | 0 | - |
| webkit | phone4x | feedback-sheet | 111 | 0 | 0 | 0 | 0 | 2.0 (12) |
| webkit | phone4x | verse-select | 32 | 0 | 0 | 0 | 0 | 3.0 (176) |
| webkit | phone4x | verse-copy | 34 | 16 | 16 | 0 | 0 | 4.0 (176) |
| webkit | phone4x | parallel-on | 145 | 16 | 16 | 0 | 0 | 9.0 (176) |
| webkit | phone4x | parallel-add | 334 | 0 | 0 | 0 | 0 | 6.0 (176) |
| webkit | phone4x | parallel-off | 40 | 24 | 24 | 0 | 0 | 5.0 (176) |
| webkit | phone4x | chapter-next | 32 | 16 | 16 | 0 | 0 | 1.0 (7) |
| webkit | phone4x | text-size-up | 50 | 24 | 24 | 0 | 0 | 4.0 (176) |
| webkit | phone4x | scene-next | 33 | 16 | 16 | 0 | 0 | 1.0 (12) |
| webkit | phone4x | back-nav | - | 0 | 0 | 0 | 0 | - |

**Reading the interaction table.** Nothing is catastrophic and three things are worth the owner's attention:
`search-type` is **878–945 ms** on a phone and **798 ms even at 1× CPU** — it is slow because of work, not
because of the device (P7). `parallel-add` is **867–929 ms**. `parallel-on` is **244–378 ms** with a
**87–172 ms long task**. `lang-menu-open` is **225–238 ms** on a phone for what should be an instant popover, and
its *Event Timing* duration is **128 ms** — the one interaction here that would hurt a real INP score
(P1b's `display: grid` means the menu is already laid out, so the cost is the 44 px rows' style and paint, plus
`items()` re-querying on every call in `src/gallery/lang.ts:34`).

The reader's own render timer says the markup generation is **not** the problem: 2.6–4.0 ms for 176 verses in
verse mode, 27.2 ms for the first parallel render. The cost in P5 is the **layout forced after** that write, which
`renderMs` does not include.

### 2.5 Memory

`JS heap MB` and `CDP nodes` come from CDP (`Runtime.getHeapUsage`, `Performance.getMetrics`), not from
`performance.memory`: Chrome quantises `performance.memory.usedJSHeapSize` into coarse buckets unless the browser
is started with `--enable-precise-memory-info`, and the first run of this suite duly reported "9.5 MB" for 538
nodes **and** for 7,453. `DOM nodes` is the live `document.getElementsByTagName('*').length`; `CDP nodes` counts
nodes the engine still holds, **including detached ones**. `layouts` / `recalcs` / `layout ms` / `style ms` are
cumulative since the page opened, which is what makes them the right before/after number for a fix.

| engine | class | case | sample | JS heap MB | DOM nodes | CDP nodes | imgs | listeners | layouts | recalcs | layout ms | style ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chromium | phone4x | gallery-plates | start | 3.20 | 538 | 954 | 61 | 185 | 0 | 0 | 0 | 0 |
| chromium | phone4x | gallery-plates | +60 cards | 3.44 | 1138 | 1798 | 181 | 425 | 81 | 182 | 66.1 | 64.1 |
| chromium | phone4x | gallery-plates | +120 cards | 3.60 | 1738 | 2642 | 301 | 665 | 182 | 354 | 165.7 | 132.1 |
| chromium | phone4x | gallery-plates | +180 cards | 2.68 | 2338 | 3422 | 421 | 569 | 272 | 526 | 298.2 | 210.9 |
| chromium | phone4x | gallery-plates | +240 cards | 2.87 | 2938 | 4266 | 541 | 809 | 355 | 695 | 422 | 289.8 |
| chromium | phone4x | gallery-plates | all cards in DOM | 3.10 | 7453 | 10597 | 1444 | 2417 | 371 | 772 | 661.6 | 355 |
| chromium | phone4x | gallery-plates | after full sweep | 2.83 | 7453 | 10581 | 1444 | 1715 | 883 | 1486 | 1968 | 938.8 |
| chromium | phone4x | chapter-changes | Genesis 1 | 10.06 | 300 | 927 | 4 | 79 | 0 | 0 | 0 | 0 |
| chromium | phone4x | chapter-changes | after 5 changes (Leviticus 1) | 11.13 | 236 | 1979 | 2 | 79 | 14 | 55 | 15.7 | 20.3 |
| chromium | phone4x | chapter-changes | after 10 changes (Ruth 1) | 12.74 | 265 | 3465 | 3 | 79 | 30 | 129 | 37.9 | 39.8 |
| chromium | phone4x | chapter-changes | after 15 changes (Isaiah 53) | 12.26 | 211 | 5486 | 2 | 79 | 44 | 177 | 80.4 | 57 |
| chromium | phone4x | chapter-changes | after 20 changes (Revelation 1) | 7.52 | 258 | 1213 | 3 | 59 | 62 | 247 | 99.2 | 75.9 |
| chromium | phone4x | chapter-changes | after 20 changes | 7.53 | 258 | 1213 | 3 | 59 | 62 | 248 | 99.2 | 75.9 |
| chromium | phone4x | chapter-changes | after 20 changes + GC | 6.53 | 258 | 459 | 3 | 59 | 62 | 248 | 99.2 | 75.9 |
| chromium | phone6x | gallery-plates | start | 3.19 | 538 | 954 | 61 | 185 | 0 | 0 | 0 | 0 |
| chromium | phone6x | gallery-plates | +60 cards | 3.43 | 1138 | 1798 | 181 | 425 | 94 | 173 | 93.6 | 74.3 |
| chromium | phone6x | gallery-plates | +120 cards | 3.59 | 1738 | 2642 | 301 | 665 | 189 | 344 | 230.4 | 151.1 |
| chromium | phone6x | gallery-plates | +180 cards | 2.68 | 2338 | 3422 | 421 | 599 | 286 | 528 | 393.3 | 272.1 |
| chromium | phone6x | gallery-plates | +240 cards | 2.65 | 2938 | 4260 | 541 | 661 | 377 | 701 | 568.7 | 344 |
| chromium | phone6x | gallery-plates | all cards in DOM | 3.19 | 7453 | 10602 | 1444 | 2417 | 393 | 780 | 922 | 439.3 |
| chromium | phone6x | gallery-plates | after full sweep | 2.81 | 7453 | 10581 | 1444 | 1677 | 924 | 1365 | 3045 | 1238.9 |
| chromium | phone6x | chapter-changes | Genesis 1 | 4.23 | 300 | 884 | 4 | 63 | 0 | 0 | 0 | 0 |
| chromium | phone6x | chapter-changes | after 5 changes (Leviticus 1) | 4.56 | 236 | 1936 | 2 | 63 | 14 | 46 | 22.6 | 22 |
| chromium | phone6x | chapter-changes | after 10 changes (Ruth 1) | 5.84 | 265 | 3422 | 3 | 63 | 30 | 117 | 52.4 | 59 |
| chromium | phone6x | chapter-changes | after 15 changes (Isaiah 53) | 6.67 | 211 | 5443 | 2 | 63 | 44 | 166 | 119.1 | 86.8 |
| chromium | phone6x | chapter-changes | after 20 changes (Revelation 1) | 7.54 | 258 | 7102 | 3 | 63 | 64 | 254 | 152 | 112.4 |
| chromium | phone6x | chapter-changes | after 20 changes | 7.54 | 258 | 7102 | 3 | 63 | 64 | 255 | 152 | 112.5 |
| chromium | phone6x | chapter-changes | after 20 changes + GC | 6.55 | 258 | 459 | 3 | 59 | 64 | 256 | 152 | 112.6 |

**Three readings, and two of them are good news.**

1. **Nothing leaks.** The JS heap over a full sweep of all 1,443 cards goes **3.20 → 2.83 MiB** (it falls), and the
   `load`/`error` listeners the plates attach (`src/gallery/media.ts:53-54`, both `{once: true}`) peak at
   **2,417** and drop to 1,715 as they fire and detach. Over 20 chapter changes the heap goes 10.06 → 7.53 MiB and
   **6.53 MiB after a forced collection**. There is no retention bug in either surface.
2. **The reader holds its dropped chapters until the collector runs.** Live DOM stays ~210–300 nodes, but
   `CDP nodes` climbs **927 → 1,979 → 3,465 → 5,486 → 7,102** across 20 chapter changes and collapses to **459**
   on `HeapProfiler.collectGarbage`. So ~350 detached nodes accumulate per chapter change, up to ~6,600, all
   reclaimable. Not a leak — but on iOS a WKWebView that is holding 6,600 detached nodes when the system asks for
   memory is a tab the system may discard. Cheap mitigation: null the old body before writing the new one, or
   render into a fresh element and replace, so the old tree has no references from the renderer's own closures.
3. **This is the hard number behind P3.** One sweep of the full grid costs, cumulatively:

   | device class | layouts | style recalcs | layout time | style time |
   |---|---|---|---|---|
   | `phone4x`, grid filled | 371 | 772 | 661.6 ms | 355.0 ms |
   | `phone4x`, after the sweep | 883 | 1,486 | **1,968 ms** | **938.8 ms** |
   | `phone6x`, grid filled | 393 | 780 | 922.0 ms | 439.3 ms |
   | `phone6x`, after the sweep | 924 | 1,365 | **3,045 ms** | **1,238.9 ms** |

   Three seconds of layout and 1.2 s of style recalculation for one scroll through the gallery on a low-end
   Android. By contrast 20 chapter changes in the reader cost **152 ms of layout and 112 ms of style in total**.
   The gallery is where the engine's time goes, and `content-visibility: auto` is the lever that moves it.

### 2.6 Picture decode — thumb vs full

| engine | class | id | kind | bytes | fetch ms | decode ms | px |
|---|---|---|---|---|---|---|---|
| chromium | phone4x | genesis-1-1 | thumb | 41778 | 82.4 | 11.3 | 480×270 |
| chromium | phone4x | genesis-1-1 | full | 190038 | 31.7 | 10.3 | 1344×756 |
| chromium | phone4x | genesis-1-14 | thumb | 45866 | 24.9 | 2.2 | 480×270 |
| chromium | phone4x | genesis-1-14 | full | 220920 | 29.3 | 11.9 | 1344×756 |
| chromium | phone4x | genesis-1-26 | thumb | 50480 | 43.1 | 3.7 | 480×270 |
| chromium | phone4x | genesis-1-26 | full | 234532 | 34.1 | 16.3 | 1344×756 |
| chromium | phone4x | genesis-2-1 | thumb | 44166 | 28.3 | 4.1 | 480×270 |
| chromium | phone4x | genesis-2-1 | full | 213058 | 441.2 | 10.8 | 1344×756 |
| chromium | phone4x | genesis-2-4 | thumb | 56134 | 37.8 | 4.6 | 480×270 |
| chromium | phone4x | genesis-2-4 | full | 275272 | 425 | 14.2 | 1344×756 |
| chromium | phone4x | genesis-2-18 | thumb | 53238 | 2.7 | 2.7 | 480×270 |
| chromium | phone4x | genesis-2-18 | full | 248676 | 472.5 | 12.2 | 1344×756 |
| webkit | phone4x | genesis-1-1 | thumb | 41778 | 39 | 3 | 480×270 |
| webkit | phone4x | genesis-1-1 | full | 190038 | 37 | 14 | 1344×756 |
| webkit | phone4x | genesis-1-14 | thumb | 45866 | 34 | 3 | 480×270 |
| webkit | phone4x | genesis-1-14 | full | 220920 | 41 | 13 | 1344×756 |
| webkit | phone4x | genesis-1-26 | thumb | 50480 | 38 | 3 | 480×270 |
| webkit | phone4x | genesis-1-26 | full | 234532 | 34 | 13 | 1344×756 |
| webkit | phone4x | genesis-2-1 | thumb | 44166 | 37 | 17 | 480×270 |
| webkit | phone4x | genesis-2-1 | full | 213058 | 37 | 12 | 1344×756 |
| webkit | phone4x | genesis-2-4 | thumb | 56134 | 47 | 4 | 480×270 |
| webkit | phone4x | genesis-2-4 | full | 275272 | 40 | 15 | 1344×756 |
| webkit | phone4x | genesis-2-18 | thumb | 53238 | 38 | 4 | 480×270 |
| webkit | phone4x | genesis-2-18 | full | 248676 | 50 | 15 | 1344×756 |

**Decode is not the problem — this is a negative finding worth having.** At 4× CPU a 480×270 thumb decodes in
**2.2–11.3 ms** (mean 4.8 ms, Chromium; 5.2 ms WebKit) and a 1344×756 full picture in **10.3–16.3 ms** (mean
12.6 ms; 13.1 ms WebKit). Even 40 thumbs on the first gallery screen is ~190 ms of decode spread over many frames,
and the decode happens off the main thread (`decoding="async"` is set on every image — `src/gallery/media.ts:51`,
`src/reader/render.ts:73`). A full sweep of 1,443 thumbs is ~5.8 s of cumulative decode, which is real but is
one sixth of the layout cost in §2.5 and is paid by the raster thread rather than the one the reader is touching.
**Do not spend effort on picture encoding for jank;** spend it on bytes (P4) and on layout (P3).

### 2.7 Service worker and the offline fallback

| engine | measurement | value |
|---|---|---|
| chromium | worker active after page load | **4,227 ms** |
| webkit | worker active after page load | **1,551 ms** |
| both | caches after install | `ydh-shell-3b9cd31b3a7b` **54 entries**, `ydh-meta-v1` 1, `ydh-pictures-v1` 1 |
| chromium | bytes on the install visit | 2,982,322 B over 22 requests |
| webkit | bytes on the install visit | 2,026,229 B over 23 requests |
| both | `/offline.html` size | **4,713 B transferred, 0 subresources, 41 DOM nodes** |
| chromium | `/offline.html` DCL / load | 76 ms / 78 ms |
| webkit | `/offline.html` FCP / load | 58 ms / 56 ms |

**Read:** the fallback page is as cheap as a page can be and needs no work — `src/pwa/offline.html` is
self-contained by design and the measurement agrees. The install cost is also small (54 precache entries, no long
task recorded on either engine). The one number worth noticing is the **4.2 s** before the Chromium worker is
active: `src/gallery/chrome.ts:105-108` deliberately registers on `requestIdleCallback(…, {timeout: 4000})`, which
is the right trade (nothing competes with first paint) but means **a reader who opens the site and leaves within
four seconds gets no offline copy at all**. If the owner wants "open it once and it works offline" to be
dependable, lower that timeout to ~1,500 ms once P1 and P2 have freed the connection.


---

## 3. Ranked causes

Each has an ID a Codex worker can quote, the user-visible symptom, the file and line, the trace evidence, the
change, the expected gain, effort, and the platforms it is on.

### P1 — 2.68 MiB of Simplified-Chinese font is downloaded on every route, in every language

**Impact** the largest single cost on the site. On fast 4G the two files occupy the connection for 2.4–3.0 s while
the LCP picture, the gallery index and the chapter's book file queue behind them. They are **92 %** of the 2,941 KiB
a cold `/bible.html#ref=Genesis 1` transfers.

**Evidence** `docs/evidence/perf-2026-11-04/load-all/load.json`, `biggest` of every route. Chromium, `phone4x`,
`en-US`, cold:

| file | bytes | duration |
|---|---|---|
| `/fonts/NotoSerifSC-500-cjk-sc-serif.woff2` | 1,713,024 | 2,562 ms (gen1) · 2,783 ms (ps119) · 3,040 ms (scene) |
| `/fonts/NotoSansSC-400-cjk-sc-sans.woff2` | 962,904 | 1,856 ms (gen1) · 1,999 ms (ps119) · 2,282 ms (scene) |

and §2.2's `font` column: **2,696–2,718 KiB on every one of the six routes**, at every device class.

**Two independent causes**, both confirmed by a diagnostic that lists every *rendered* CJK text node and the fonts
each page actually fetched:

**P1a — the bar still paints the Chinese name on an English page.** The deployed build serves
`<span class="zh" data-brand>雅偉之界</span>`, which no stylesheet in the repo has a rule for, so it renders as a
**60×16 px block at `opacity: 1`** with `font-family: Spectral, Georgia, "Noto Serif SC", "Songti SC", serif`
(`src/tokens.css:111` `--cjk-serif`, used by `--display` at `:112`). Four Chinese characters in a display serif
pull the **1.71 MiB** serif file. On HEAD this looks already fixed — `scripts/lib/product-name.mjs:42`
`wordmarkLockup()` now emits the `.tri` lockup whose non-matching readings are `display: none` — but that is a code
reading, not a measurement; see §8 item 5 for how to confirm it after the next deploy.

**P1b — the closed language menu demands Chinese glyphs.** `src/gallery/chrome.css:158`:

```css
.lang-pop[hidden] { display: grid; opacity: 0; scale: .96; pointer-events: none; … }
```

`display: grid` overrides the `hidden` attribute's `display: none`, so the four rows — `简体中文`, `繁體中文` — are
laid out (measured box `0×0`, `opacity: 0`) and their glyphs are demanded. That pulls the **963 KiB** sans file on
an English page. The override exists only to allow the `display .16s allow-discrete` open/close transition.

**P1c — the four CJK families are single unsubsetted files.** `public/fonts/`: `NotoSansSC` 962,604 B,
`NotoSansTC` 1,031,488 B, `NotoSerifSC` 1,712,724 B, `NotoSerifTC` 1,844,804 B, each one `@font-face` with no
`unicode-range` slicing (`public/fonts/fonts.css`). A **简体 reader who legitimately needs Chinese still waits for
all 2.68 MiB** before any serif Chinese glyph can paint, when a chapter of Genesis uses perhaps 900 distinct
characters.

**Fix** three changes, in this order:

1. `src/gallery/chrome.css:158` — replace the `display: grid` override with `content-visibility: hidden` on the
   `[hidden]` state (which keeps the element in the box tree for the transition but stops its contents being
   rendered or their fonts demanded), or drop `display` from the transition and animate only `opacity`/`scale`
   with the element kept `display: none` until first open. **Test:** load `/scenes.html` with locale `en-US`, never
   touch the menu, and assert that no `cjk-sc-sans` request appears
   (`node tools/perf/budget.mjs --only assets` fails above 2,800 KiB; the per-page check is the `font` column of
   `--suite load`).
2. `src/tokens.css` — add, after the `html[lang="zh-Hant"]` block at `:131`:
   `html[lang="en"], html[lang="ru"] { --cjk-sans: 'PingFang SC','Microsoft YaHei',sans-serif; --cjk-serif:
   'Songti SC',serif; }` so an English or Russian page can never pull a bundled CJK file whatever stray glyph
   appears. This is the belt to P1a's braces and it is three lines.
3. `tools/subset-fonts.sh` + `public/fonts/fonts.css` — slice the four CJK faces by `unicode-range` the way
   Google's own `css2` CJK delivery does (≈100 slices of 10–40 KiB, most-frequent characters first) so a page
   downloads only the slices it paints. `tools/font-coverage.mjs --check` already owns the range list and
   `npm run verify:fonts` already gates it, so the gate survives the change.

**Expected gain** −2,680 KiB and −2.4 s of connection contention on every `en`/`ru` route (steps 1+2, measurable
today); on a Chinese route, first Chinese paint from "after 2.7 MiB" to "after ~60 KiB" (step 3).
**Effort** S (1), S (2), M (3). **Platforms** web and PWA for the bytes; all four shells for the read-and-parse
cost, since the shells bundle the same files and serve them through the custom protocol.

---

### P2 — fonts and pictures are served `max-age=0, must-revalidate`

**Impact** every returning reader revalidates 2.68 MiB of fonts and every thumbnail on **every navigation**: one
conditional request per file, each a full RTT, before the page can paint. It is why §2.1's **warm** rows transfer
*more* than the cold ones (home 3,129 KiB warm vs 2,912 cold; scene 4,204 vs 3,458): the warm load revalidates
everything *and* the freshly-installed worker fetches its own precache copies.

**Evidence** measured response headers:

```
/fonts/NotoSerifSC-500-cjk-sc-serif.woff2 → cache-control: public,max-age=0,must-revalidate  (1,712,724 B)
/pictures/thumb/genesis-1-1.webp          → cache-control: public,max-age=0,must-revalidate  (41,778 B)
/pictures/full/genesis-1-1.webp           → cache-control: public,max-age=0,must-revalidate  (190,038 B)
/brand-logo.webp                          → cache-control: public,max-age=0,must-revalidate
```

**Cause** `netlify.toml` gives `immutable` only to `/assets/*.js|css|gz` (lines 73-85). `/fonts/*` and
`/pictures/*` match no rule, so Netlify's default applies. The reasoning in the file's own comment is right —
"stable names must be revalidated so source corrections reach returning readers" — but it was applied to two
directories whose contents are in fact content-addressed in practice.

**Fix**
* `/pictures/*` → `Cache-Control: public, max-age=2592000, stale-while-revalidate=604800`. A scene id is stable and
  a redrawn picture is a deliberate event; `scripts/build-pictures.mjs` already knows which ids changed, so the
  release script can issue a Netlify cache purge for exactly those.
* `/fonts/*` → put a content hash in the filename (`tools/subset-fonts.sh` writes the files and generates
  `fonts.css`, so both change in one place) and then
  `Cache-Control: public, max-age=31536000, immutable`. Without the hash, use
  `max-age=604800, stale-while-revalidate=86400`.

**Test** `curl -sI <url> | grep -i cache-control` for one file of each kind, and re-run
`node tools/perf/measure.mjs --suite load --engine chromium --profile phone4x`: the warm `requests` and `KB`
columns of §2.1 must fall, and `bytes.font.cached` in `load.json` must become non-zero.
**Expected gain** warm navigation sheds ~30–50 conditional requests on the gallery route and the whole font set
on every route; on fast 4G that is ~1.2–2.0 s off a warm LCP for a reader moving between pages.
**Effort** S. **Platforms** web and PWA only (a shell reads fonts and thumbnails locally) — except the
`/pictures/full/*` rule, which the shells **do** pay on every full picture (§6).

---

### P3 — the 1,443-card grid has no virtualisation, no `content-visibility` and no `contain`

**Impact** the measured jank. Flinging the full grid at 6× CPU gives **18.6 fps**.

**Evidence** `docs/evidence/perf-2026-11-04/scroll-*/scroll.json` and `memory-phone6x/memory.json`:

| case | device class | DOM nodes | frames in 20 s | dropped (>33 ms) | p50 | p95 | worst |
|---|---|---|---|---|---|---|---|
| `gallery-1443` | `phone6x` | 7,453 | 373 | **333 (89.3 %)** | **50.0 ms** | **66.8 ms** | **100 ms** |
| `gallery-progressive` | `phone6x` | 538 → 2,638 | 958 | 2 (0.2 %) | 16.7 ms | 16.8 ms | 33.4 ms |
| `gallery-1443` | `phone4x` | 7,453 | 1,155 | 21 (1.8 %) | 16.7 ms | 16.8 ms | 33.4 ms |
| `gallery-1443` | `desktop1x` | 7,453 | 1,200 | 0 | 16.7 ms | 16.7 ms | 16.8 ms |
| `gallery-1443` | WebKit, unthrottled | 7,453 | 1,186 | 1 (0.1 %) | 17 ms | 20 ms | 37 ms |

The difference is the DOM and nothing else: the same code, the same pictures, the same fling, 373 frames against
958. And the cumulative cost of that one sweep at 6× CPU is **3,045 ms of layout and 1,238.9 ms of style recalc**
over 924 layouts and 1,365 recalcs (§2.5) — against 661.6 ms of layout for the same grid before the sweep.
`grep -rn "content-visibility\|contain:" src/` returns **nothing** (one `overscroll-behavior: contain` aside).

**The variance is part of the finding, and it is reported rather than smoothed.** The same `phone4x` fling dropped
**1.8 %** of frames in the measurement run above and **58.7 %** (p99 50.1 ms, 77.9 % of frames over 20 ms) when
`tools/perf/budget.mjs` ran it an hour later on the same machine against the same build. Nothing about the page
changed. The honest reading is not "it is 1.8 %" or "it is 58.7 %" but **the full grid sits exactly at the edge of
the frame budget on a mid-range phone, so a little extra load tips it over a cliff** — and a low-end phone is
always over it (89.3 %). That is also the shape of the owner's complaint: some readers see lag, others do not, and
the same reader sees it some days. A desktop never notices.

**Cause** `src/gallery/scenes-page.ts:84-95` `paintGrid()` appends and never removes; the
`IntersectionObserver` at `:137-141` raises `limit` by 60 whenever the sentinel is within `rootMargin: '480px'`,
so a reader who keeps scrolling ends with all 1,443 `<a.sc-card>` (3 children each) and 1,443 `<img>` live in the
document. Style, layout and paint then cost O(all cards) per frame.

**Fix** two steps, the first one line of CSS:

1. `src/gallery/scenes-page.css:26` — add to `.sc-card`:
   `content-visibility: auto; contain-intrinsic-size: auto 240px;` (the intrinsic height of a card: the 3:2 plate
   plus two lines of caption — take the measured value from `getBoundingClientRect()` at each breakpoint rather
   than guessing, and note that `contain-intrinsic-size` must be set or the scrollbar jumps). This leaves the DOM
   alone and lets the engine skip style, layout and paint for off-screen cards.
   *Caveat to test:* `content-visibility: auto` breaks in-page find and anchor scrolling in some engines, and
   WebKit shipped it only in Safari 18 — so verify the "Back from a picture lands on the same card" behaviour
   (`scenes-page.ts:116` restores `history.state.y`) still works in both engines.
2. Windowing: keep ±3 screens of cards and replace the rest with one spacer element of the right height. That is
   the complete fix and it is what makes a shell's 1,443 protocol requests go away too (§6).

**Test** `node tools/perf/measure.mjs --suite scroll --engine chromium --profile phone6x` and compare the
`gallery-1443` row: `dropped` and `p95` must approach the `gallery-progressive` row.
**Expected gain** p95 frame from 66.8 ms to ≈17 ms at 6× CPU; 18.6 fps → 55+ fps.
**Effort** S for step 1, M for step 2. **Platforms** all six.

---

### P4 — thumbnails are 480 px / 35.5 KiB with no `srcset`, and are cropped 16:9 → 3:2

**Impact** the first screen of the gallery transfers **857 KiB on a phone** (20 thumbs) and **1,579 KiB on a
desktop or iPad** (40 thumbs). `scenes` cold LCP at `ipad1x` is the worst LCP measured on the site, **2,348 ms**.

**Evidence** §2.2 `thumb` column; `ls -l public/pictures/thumb` → 1,443 files, mean **35,537 B**, max 57,480 B,
48.9 MiB total. `scripts/lib/pictures_convert.py:24` `THUMB_W, FULL_W = 480, 1344`, quality 76. A card on a 390 px
phone is **183 CSS px** wide (two columns, `scenes-page.css:25`), so a 480 px file is 2.6× the pixels needed at
1× and still short at 3×.

A second, free finding in the same place: the thumbnail is **480×270 (16:9)** (`src/gallery/plates.ts:16-18`
states this and the reader reserves exactly that box) but `src/gallery/scenes-page.css:27` sets
`.sc-card .gx-plate { aspect-ratio: 3 / 2 }` with `object-fit: cover` (`chrome.css:232`). Every card therefore
**crops 11 % of the picture** and decodes 270 rows to paint ~122.

**Fix**
* `scripts/lib/pictures_convert.py` — add a 240 px variant (`GRID_W = 240`) beside the 480 px one; ~10 KiB each,
  ~14 MiB more on disk (watch `scripts/shell-dist.mjs`'s 100 MiB budget: the shell should bundle the **small** one
  and drop the 480 px, which is the `aspect-ratio` fix's size anyway).
* `src/gallery/media.ts:36-58` `plate()` — emit `srcset="…240.webp 240w, …480.webp 480w"` and
  `sizes="(min-width:1280px) 20vw, (min-width:900px) 25vw, (min-width:640px) 33vw, 50vw"`, plus explicit
  `width`/`height` so the box is reserved from the attributes and not only from CSS.
* decide the aspect ratio once: either make `.sc-card .gx-plate` 16:9 to match the file, or generate 3:2 thumbs.

**Test** `--suite load --profile phone4x` and read §2.2's `thumb` cell for `scenes`; and
`--suite decode` for the decode cost per size.
**Expected gain** first gallery screen from 857 KiB to ≈250 KiB on a phone, from 1,579 KiB to ≈450 KiB on an iPad;
`scenes` cold LCP at `ipad1x` well under 1.5 s. **Effort** M (needs a picture rebuild). **Platforms** all six.

---

### P5 — a chapter is one DOM write followed by forced layout in the same task

**Impact** the worst frame measured anywhere: **337 ms** (`/bible.html` parallel, 6× CPU), with **278 ms of
blocking time** in it. TBT on the parallel route is **324 ms cold / 333 ms warm** at 6× and **138–430 ms cold /
169–347 ms warm** at 4× across two independent runs (`load-all` and `load-rerender`) — the only route on the site
with a TBT a reader can feel, and the only one whose TBT is above 100 ms at all. Turning parallel on takes
**244–378 ms** with an **87–172 ms long task** inside it (§2.4 `parallel-on`); adding a third edition takes
**867–929 ms** (§2.4 `parallel-add`).

**Evidence** `docs/evidence/perf-2026-11-04/load-all/load.json`, `loafs` for `parallel`/`phone6x`/cold — a real
`long-animation-frame` entry with script attribution:

```json
{"d":337,"blocking":278,
 "scripts":[{"d":224,"fwd":172,"url":"/assets/session-C4__tUI-.js","invoker":"Cache.put.then"}]}
```

224 ms of script, of which **`forcedStyleAndLayoutDuration` is 172 ms**, invoked from a `Cache.put` continuation.
That names the path exactly: `DataStore.load()` resolves (`src/reader/store.ts:104-108` — `cache.put(url, keep)`),
`show()` runs `renderAll()` (`src/reader/view.ts:304-345`), which writes the whole chapter in one go at `:328`
(`this.bodyEl.innerHTML = title + out.html`) and then, **in the same task**, reads layout back:
`renderTools()` → `keepFocus()` → `focus({preventScroll:true})` (`:342-348`), `syncSelection()` (`:404-412`),
then `restoreAnchor()` / `scrollToTarget()` (`:716-725`) with `getBoundingClientRect()` and
`scrollIntoView()`. Each read forces a full synchronous layout of the tree just written.

Node counts (from `scroll.json`, `before.nodes`): Psalm 119 is **977 nodes** in verse mode and **2,395 nodes** in
parallel with two editions. Nothing is virtualised and no element is contained.

The reader's *markup generation* is innocent and the numbers say so: `__yrPerf.renderMs` is **2.6–4.0 ms for 176
verses** in verse mode and **27.2 ms** for the first parallel render (§2.4). The 172 ms is the layout the renderer
then forces on itself. Over 20 chapter changes the reader's total layout cost is **152 ms** (§2.5), so this is a
per-render burst, not accumulation — and it is a burst that lands exactly when the reader has just pressed
something.

A fourth, smaller item in the same place: §2.5 shows the reader holding **up to ~6,600 detached nodes**
(`CDP nodes` 927 → 7,102 over 20 chapter changes, → 459 after a forced GC) while live DOM stays at ~250. Nothing
leaks, but on iOS a webview holding that is a webview the system may discard under pressure. Writing the new
chapter into a fresh element and replacing the old one — rather than overwriting `bodyEl.innerHTML` while the
renderer's closures still reference the old tree — would let it go sooner.

**Fix**
1. `src/reader/view.ts:328-345` — do the layout **reads before the write**, and move every post-write read into one
   `requestAnimationFrame` after the paint: `captureAnchor()` already runs before (`:249`), so what remains is to
   wrap `restoreAnchor` / `scrollToTarget` / the `focus()` calls in a single `requestAnimationFrame(() => …)`.
   That alone moves 172 ms out of the blocking frame.
2. `src/reader/reader.css` — add `contain: content` to `.yr-v` and `.yr-pv` and
   `content-visibility: auto; contain-intrinsic-size: auto 3rem;` to `.yr-pv` (the tall one), so layout is scoped
   per verse instead of per chapter. Test the verse-anchor restore and `scrollIntoView` for a deep link
   (`#ref=Psalm 119:150`) in both engines before keeping `content-visibility`.
3. `src/reader/view.ts:404-412` `syncSelection()` — it currently `querySelectorAll`s **every** `[data-k]` and does
   a nested `querySelector('.yr-vn')` + `setAttribute` on each, on every verse tap: 176 elements (528 in parallel)
   of work to change one. Keep a `Map<number, HTMLElement>` built once in `renderAll()` and touch only the keys
   that entered or left `this.selected` (it already knows both sets).
4. `src/reader/render.ts:87-89` → `src/reader/text.ts` — `tokenize()` runs ~8 regexes per verse; a 3-edition
   Psalm 119 render is 528 tokenize calls. Memoise per `(edition, verse key)` in the store, or precompute the
   token form when the book file is parsed, once per book instead of once per render.

**Test** `node tools/perf/measure.mjs --suite interact --engine chromium --profile phone6x` and read
`parallel-on`, `chapter-next` and `verse-select`, plus `yrPerf.renderMs`; and `--suite load` for the `parallel`
route's TBT. **Expected gain** parallel TBT from 324 ms to under 100 ms at 6×; the 337 ms frame split into a
~60 ms write and a separate rAF. **Effort** S (1), S (2), S (3), M (4). **Platforms** all six; worst on the
low-end Android and on iOS, where the same work runs on WKWebView's single main thread.

---

### P6 — two `backdrop-filter` surfaces sit over scrolling content on a phone

**Impact** not measurable here, and on iOS this is the classic cause of exactly the symptom the owner reports.
Each blurred layer must be re-rasterised from the content behind it on **every frame** of a scroll.

**Evidence** code, not a trace: `src/gallery/chrome.css:84-88` — `.sitenav` is `position: sticky; top: 0` with
`backdrop-filter: blur(14px)` over `color-mix(in srgb, var(--ground) 94%, transparent)`, i.e. the blur is load-bearing,
not decorative. `src/nav.css:362-367` — `.tabbar` is `position: fixed; bottom: 0` with `blur(16px)`, shown under
768 px, so **a phone has one at the top and one at the bottom of every screen**. Also
`src/gallery/scenes-page.css:93` (`dialog.gx-fs`) and `chrome.css:321`.

**Fix** `src/tokens.css:250-256` already kills every `backdrop-filter` under
`@media (prefers-reduced-transparency: reduce)`, and its own comment says the cost is nil —
"every blurred surface here already sits on a fill of at least 84 % opacity, so dropping the blur costs no
legibility". That is the whole argument for doing it unconditionally on a phone:
1. inside `@media (max-width: 767px)`, give `.sitenav` (`src/gallery/chrome.css:84`) and `.tabbar`
   (`src/nav.css:362`) an **opaque** background and no `backdrop-filter`. A bar that is 94 % opaque gains almost
   nothing visually from a blur and pays for it on every frame of every scroll;
2. keep the blur on tablet and desktop, where the bar is over a wider, slower-moving surface.

**Test** the Safari Timelines A/B in §8 item 2: record a gallery fling with iOS Settings ▸ Accessibility ▸
Display & Text Size ▸ **Reduce Transparency** off, then on — which switches exactly these rules via
`prefers-reduced-transparency` — and compare the Rendering Frames track. On Chromium,
`--suite scroll --profile phone6x` before and after, since Chromium pays a smaller but real cost.
**Expected gain** unquantified on iOS; this is the highest-value *unmeasured* item and the A/B costs ten minutes.
**Effort** S. **Platforms** iOS, iPadOS, macOS shells and Safari first; Android WebView and Windows second.

---

### P7 — the search palette filters all 1,443 scenes per keystroke, with 繁體 conversion inside the loop

**Impact** typing in the palette. `search-type` (eight characters at 90 ms apart) takes **798 ms** to first result
**at 1× CPU on a desktop**, 878 ms at 4× and **945 ms** at 6×. The device barely matters, which is the signature of
a fixed amount of work rather than a slow machine — and it is the slowest interaction on the site by a factor of
two.

**Evidence** §2.4. `src/gallery/search.ts:23-42` `byText()` runs on **every** `input` event and, per scene, builds
four lowercased strings — including `hant(sc.zh)` and, once summaries have loaded, `hant(sums.zh[sc.i])`. That is
**1,443 × 2 `hant()` calls per keystroke**, and `hant()` (`src/locale.ts:145-157`) is a `String.replace` over a
CJK-run regex with two table lookups per run and **no memoisation**. `search.ts:110-113` also kicks off
`loadSummaries()` (143 KiB) on the first keystroke and re-runs the whole filter when it lands.

**Fix**
1. build the haystack once per `(index, locale)`: in `src/gallery/data.ts`, add a lazily-built
   `string[]` of `${zh} ${hant(zh)} ${en} ${ru} ${bookTitle…}`.toLowerCase() indexed by `sc.i`, invalidated on
   `onLocale`. `byText` then does one `includes` per scene over a flat array.
2. memoise `hant()` with a `Map<string,string>` keyed on the input (`src/locale.ts:145`); the table is already a
   single object and the strings repeat heavily.
3. debounce the input to one run per `requestAnimationFrame`, and start `loadSummaries()` on idle when the palette
   **opens** rather than on the first keystroke.

**Test** `--suite interact` → `search-type` at `phone6x`. **Expected gain** 945 ms → under 250 ms.
**Effort** S. **Platforms** all six.

---

### P7b — the language menu takes 225–238 ms to appear on a phone

**Impact** the first control a reader of a four-language product reaches for. `lang-menu-open` is **77 ms at 1×**
but **225 ms at 4×** and **238 ms at 6×**, with an Event Timing duration of **128 ms** — the worst
*event* duration measured on the site, and the one number here that would damage a real INP score.

**Evidence** §2.4. Two causes, both small: (a) P1b's `.lang-pop[hidden] { display: grid }` means the popover is
already in layout, so opening it is a style-and-paint of four 44 px rows **plus** the CJK font fallback for its two
Chinese rows; (b) `src/gallery/lang.ts:34` defines `items()` as a fresh
`pop.querySelectorAll('[role="menuitemradio"]')` and `mark()` / `open()` / the `keydown` handler each call it
again — four DOM queries per open, on an element whose four children never change.

**Fix** cache the four buttons once in `mountLangMenu` (`src/gallery/lang.ts:28-34`); do P1b's change, which
removes the layout and the font from the open path.
**Test** `--suite interact --profile phone6x` → `lang-menu-open`, both `visible ms` and `worst event ms`.
**Expected gain** 238 → under 80 ms. **Effort** S. **Platforms** all six.

---

### P8 — the scene page eagerly preloads both neighbouring full pictures

**Impact** ~410 KiB of speculative traffic on top of the 190 KiB the reader is looking at, competing with the
passage's book file on the same connection. The scene route is the heaviest cold load measured
(3,459 KiB) and the only route with meaningful CLS (**0.0389** at phone width).

**Evidence** §2.1 and §2.2 (`full 402 (2)` — two full pictures on a page that shows one, measured
221,220 B + 190,338 B for Genesis 1:14 and 1:1). `src/gallery/scenes-page.ts:183`:

```ts
for (const n of [next, prev]) if (n?.ok) { const i = new Image(); i.decoding = 'async'; i.src = fullUrl(n.id); }
```

**Fix** preload `next` only; start it on the current picture's `load` event rather than during `paintPicture`; and
skip it when `navigator.connection?.saveData` is true or `effectiveType` is slower than `4g`. Keep `prev` only
when the reader has actually pressed Previous once (direction of travel is known after the first move).
**Test** `--suite load --profile phone4x`, scene route: `bytes.full.n` must be 1 and `bytesTotal` must fall by
~200 KiB. **Expected gain** −200 to −410 KiB per scene view, which in a shell is also −200 to −410 KiB of
*repeated* network per revisit (§6). **Effort** S. **Platforms** all six; worst in the shells.

---

### P9 — the shell parses a 359 KiB manifest and validates 2,886 SHA-256 strings at every boot, for a feature that is not shipped

**Impact** unmeasured startup cost on iOS and Android.

**Evidence** `dist-shell/data/packs.json` is **359,265 B**. `src/shell/boot.ts:38-49` fetches and parses it during
`boot()`; `src/core/packs.ts:22-48` `parseManifest` walks every entry with a regex test and a path check. The
feature it feeds is explicitly **not in this version** — `boot.ts:21-30`: "the ENTRY is gone until it is real".

**Fix** keep the pack manager (it is what makes `media.ts localFull` work) but (a) drop the per-file SHA from the
two **bundled** packs in `scripts/shell-dist.mjs:61` — a bundled file cannot be corrupted independently of the
binary, and the hash is only needed for the downloadable `full` pack; (b) move `startPacks()` behind
`requestIdleCallback`, as `src/gallery/chrome.ts:105-108` already does for the service worker.
**Test** on a device, with the §8 item 3/4 procedure; without a device, `node -e` timing of
`parseManifest(JSON.parse(readFileSync('dist-shell/data/packs.json')))` is a lower bound.
**Expected gain** `packs.json` from 359 KiB to ~95 KiB, and the validation off the first-paint path.
**Effort** S. **Platforms** the four shells only.

---

### P10 — every gallery page ships the 56-unit plan prose and a document-wide `MutationObserver`

**Impact** small but free. `src/site-shell.ts` (18,205 B) and `src/plan-units.ts` (19,124 B) are imported by all
three gallery pages for three functions — `loadingSteps`, `loadingStep`, `pageReady` (`home.ts:3`,
`scenes-page.ts:3`, `reader-page.ts:6`, defined at `site-shell.ts:28`, `:31`, `:39`) — and bring with them the
`BUILT` list, the whole `UNITS` table, and at `site-shell.ts:310-318` a `MutationObserver` on `document.body` with
`{subtree: true, attributes: true, attributeFilter: ['hidden']}`. The gallery surface has **none** of the five
menus that observer serves, yet every `hidden` toggle on the page — `#sc-browse`, `#sc-picture`, `#sc-more-btn`,
`.lang-pop`, the reader's `.yr-selbar` and every `.yr-ctx` note — allocates records and runs the callback.

**Fix** move `loadingSteps` / `loadingStep` / `pageReady` into their own module (they are 20 lines and touch two
element ids) and import that from the three gallery entries; leave `site-shell.ts` to the full site.
**Test** `--suite load`, `bytes.js` column, and `grep -c` the built chunk for a `UNITS` string.
**Expected gain** ~10–15 KiB of parsed JS per gallery page and one observer off the document.
**Effort** S. **Platforms** all six.

---

### P11 — minor, all S, all free

| id | what | where | fix |
|---|---|---|---|
| P11a | the only non-passive listener on the surface: a `wheel` handler that `preventDefault`s, on the book strip | `src/gallery/scenes-page.ts:123-126` (`{passive: false}`) | keep it (horizontal wheel needs it) but bail out *before* the `scrollWidth`/`clientWidth` read when `Math.abs(e.deltaX) >= Math.abs(e.deltaY)`, and cache the overflow check |
| P11b | `summaries.json` (143 KiB, all three languages in one file) is fetched on the first scene view and the first keystroke | `src/gallery/data.ts:54-60`, `scenes-page.ts:266`, `search.ts:112` | split per language (a reader needs one of three) and fetch on idle |
| P11c | `overflow-wrap: anywhere` on the whole reading column forces per-character break opportunities for the full chapter | `src/reader/reader.css:116` | narrow it to `:lang(zh)` and the few long-token cases, or use `overflow-wrap: break-word` |
| P11d | `.yr-plate-img { opacity: 0; transition: opacity .3s }` with `.yr-plate-img[src] { opacity: 1 }` — `src` is always in the markup, so the rule never animates and the plate pops | `src/reader/reader.css:157-159` | drop the dead transition or key the fade on a `load` listener, as `media.ts:53` already does for `.gx-plate` |
| P11e | two IPC calls per preference change in a shell (`store.set` + `store.save`) | `src/platform/tauri.ts:70-72` | debounce `save()` by ~500 ms |
| P11f | `adopt()` hands up to 60 URLs to the freshly-installed worker, which re-fetches them | `src/gallery/pwa.ts:53-58` | pass them only if `caches.match` misses, or let the worker populate lazily |


---

## 4. Proposed budgets (automated)

`tools/perf/budgets.json` holds them; `node tools/perf/budget.mjs` enforces them and exits 1 with a line per
breach. Every value is **measured + headroom**, so the check passes on build 3 and catches a regression rather
than restating a wish. Lower a budget when a fix lands, so a win cannot be silently given back.

```
node tools/perf/budget.mjs                               # the dev site, all four groups
node tools/perf/budget.mjs --only assets                 # no browser: a 10-second CI gate
node tools/perf/budget.mjs --base http://localhost:4173  # a local `vite preview`
node tools/perf/budget.mjs --json out.json               # the numbers, for a trend line
```

**The whole gate was run end to end against build 3: `58/65 within budget`, and the seven breaches are exactly the
four subjects the audit declares defective** — the three CJK font rows (P1) and `gallery-1443`'s three frame rows
(P3). Every other row passes, which is what makes it a usable regression check rather than a wall of red.
`budgets.json` says in its own header which rows are targets and which are guards.

The `assets` group needs no browser and is the one to put in CI first:

```
      group     subject                                   metric                 measured  budget
FAIL  assets    /fonts/NotoSerifTC-500-cjk-tc-serif.woff2 largest font file KB   1802KB    300KB
FAIL  assets    cjk-sc                                    CJK fonts per page KB  2613KB    400KB
FAIL  assets    cjk-tc                                    CJK fonts per page KB  2809KB    400KB
 ok   assets    /data/gallery/index.json                  compressed KB          67KB      80KB
 ok   assets    /data/reader/text/bsb-yhwh/19.json        compressed KB          67KB      80KB
```

One trap a Codex worker should know about, because it is already handled: the asset sizes are read from
`content-length`, not from `arrayBuffer().byteLength`. Node's `fetch` transparently decompresses, so
`index.json` measures 193 KiB after decoding where the browser transfers 67 KiB — a budget set on the wrong one of
those would be wrong by 3×.

`budgets.json` also carries, beside each group, the number that row should become once the matching fix lands
(`_routes_after_P1_P2`, `_scroll_note`, `_interactions_after_P7`), so tightening the budget is part of the fix and
not a separate decision.

---

## 5. Order of fixes — cheapest biggest wins first

Ordered by measured gain per hour of work. A Codex worker can take them in this order and each step is
independently shippable and independently testable.

| # | id | change | effort | measured gain | how to prove it |
|---|---|---|---|---|---|
| 1 | **P1a+P1b** | stop an `en`/`ru` page demanding a CJK glyph: `chrome.css:158` `[hidden]` state, and the `--cjk-*` override in `tokens.css` | S | **−2,680 KiB and −2.4 s of connection on all six routes** | `budget.mjs --only assets` (cjk-sc row), then `--suite load --profile phone4x` font column |
| 2 | **P2** | `netlify.toml`: cache headers for `/fonts/*` and `/pictures/*` | S | warm navigation sheds the whole font set and ~30–50 conditional requests | `curl -sI`, then the warm rows of `--suite load` |
| 3 | **P3**(1) | one line: `content-visibility: auto` + `contain-intrinsic-size` on `.sc-card` | S | gallery fling p50 **50 → ≈17 ms** and dropped frames **89.3 % → <1 %** at 6× CPU (18.6 → 55+ fps); cumulative layout for one sweep **3,045 → ≈400 ms** | `--suite scroll --profile phone6x`, `gallery-1443` row; `--suite memory` `layoutMs` |
| 4 | **P5**(1) | move the post-`innerHTML` layout reads into one `requestAnimationFrame` | S | **172 ms of forced layout** out of the worst frame; parallel TBT 324 → <150 ms | `--suite load`, `parallel` TBT; `loafs[0].scripts[0].fwd` must collapse |
| 5 | **P7** | precomputed search haystack + memoised `hant()` + rAF debounce | S | `search-type` **945 → <250 ms** (and 798 → <150 ms on a desktop) | `--suite interact --profile phone6x` |
| 5b | **P7b** | cache the four language-menu buttons; P1b removes the layout from the open path | S | `lang-menu-open` **238 → <80 ms**, worst event 128 → <50 ms | `--suite interact --profile phone6x` |
| 6 | **P8** | preload `next` only, after the current picture loads | S | −200 to −410 KiB per scene view | `--suite load`, scene route `bytes.full.n` |
| 7 | **P6** | opaque `.sitenav` and `.tabbar` under 768 px (no `backdrop-filter`) | S | unquantified, likely the largest *felt* win on iPhone | the Safari Timelines A/B, §8 item 2 |
| 8 | **P5**(2,3) | `contain` on the verse rows; `syncSelection` touches only what changed | S | verse tap and chapter change off the O(chapter) path | `--suite interact`, `verse-select` / `chapter-next` |
| 9 | **P4** | 240 px grid thumbnail + `srcset`/`sizes`; settle the aspect ratio | M | first gallery screen **857 → ≈250 KiB** on a phone; iPad `scenes` LCP 2,348 → <1,500 ms | `--suite load`, `thumb` column; `--suite decode` |
| 10 | **P9** | drop the bundled packs' SHA list; `startPacks` on idle | S | `packs.json` 359 → ~95 KiB, off the shell's first-paint path | device trace, §8 items 3/4 |
| 11 | **P1c** | slice the four CJK faces by `unicode-range` | M | a Chinese reader's first Chinese paint after ~60 KiB instead of 2.68 MiB | `budget.mjs --only assets`, then a `zh-Hans` locale run |
| 12 | **P3**(2) | real windowing of the grid | M | removes the shell's 1,443 protocol reads as well | `--suite scroll` and a device trace |
| 13 | **P5**(detached) | write the new chapter into a fresh element and replace, so the old tree is collectable | S | ~6,600 detached nodes stop accumulating; matters on iOS under memory pressure | `--suite memory`, `chapter-changes` `cdpNodes` |
| 14 | **P10, P11a–f** | the small ones | S each | ~15 KiB of JS, one observer, three dead rules | the suites named in each row |
| 15 | — | lower the service-worker registration delay from 4,000 ms once P1/P2 have freed the connection | S | "open it once and it works offline" becomes true for a reader who leaves in under four seconds | `--suite offline`, `swReadyMs` |

**Install the budget check first, not last.** `node tools/perf/budget.mjs --only assets` takes ten seconds, needs
no browser, and already fails on today's build (the CJK rows). Put it in `npm run verify:gallery` so step 1 cannot
regress, then add the browser groups once steps 1–4 have landed and the budgets have been lowered to the new
numbers.


---

## 6. The Tauri shells (macOS / iOS / Android / Windows)

No shell was built for this audit (the owner's instruction, and `df -h /Volumes/androidbuild` has 19 GiB free).
What follows is reasoned from the same web measurements plus the shell code, and is labelled as reasoning.

**What the bundle is.** `dist-shell/shell-sizes.json` (written 2026-11-04 12:50 by the last `npm run app:dist`):
total **98,148,826 B / 93.6 MiB** against the 100 MiB budget — thumbnails 51,279,810 B (48.9 MiB, 1,443 files) and
Bible data 38,480,799 B (36.7 MiB), with 204 MiB of full pictures *not* bundled and fetched from
`https://world.yahwehword.com` (`src/config/site.ts:10`, `fullPictureHost`).

**Custom-protocol asset loading: whole file, not streamed.** `src-tauri/tauri.conf.json` sets
`build.frontendDist = "../dist-shell"`, so every page, script, thumbnail and Bible JSON is an asset embedded in the
binary by `tauri::generate_context!` and served by Tauri's own protocol handler (`tauri://localhost` on
iOS/macOS, `http://tauri.localhost` on Android/Windows). That handler answers a request by producing the **whole
file's bytes**; there is no range support and no streaming. Consequences, in order of size:

* `data/reader/text/<edition>/19.json` (Psalms) is **217,351 B of raw JSON** in the bundle — no gzip, because the
  protocol serves stored bytes. A web reader gets 68,828 B over the wire and `JSON.parse`s the same 217 KB; a shell
  reader skips the download and pays the same parse. **In parallel mode with three editions that is 652 KB of JSON
  read and parsed in one task on the webview thread**, and the measured web cost of exactly that task is the 337 ms
  frame in §3 P5. The shell does not make it better; it removes only the network part.
* The **`data/packs.json` manifest is 359,265 B** and `src/shell/boot.ts:40` fetches and parses it at every boot,
  then `parseManifest` (`src/core/packs.ts:22-48`) validates **2,886+ entries**, each with a
  `/^[a-f\d]{64}$/i` test on its SHA-256 plus a `relativePath()` call. This runs on the main thread, before the
  pack manager is useful for anything — and `boot.ts:21-30` records that the feature it feeds (the "offline
  pictures" sheet) **is deliberately not shipped in this version**. Unmeasurable without a device; reasoned at tens
  of ms on an M-series Mac and plausibly 150–400 ms on a low-end Android.
* Thumbnails are `src="/pictures/thumb/<id>.webp"` resolved against the protocol origin, so **the 1,443-card grid in
  a shell issues 1,443 protocol requests**, each a full-file read, as the grid fills. On the web those are HTTP
  requests the browser pipelines and caches; in the shell they are IPC-adjacent reads on a handler that is not
  registered as asynchronous. This is the shell's version of P3 and P4 and it is the same fix (virtualise, and ship
  a smaller grid thumbnail).

**Startup path.** `src/shell/boot.ts` is correctly ordered for first paint: it flips `link[data-late-font]` to
`media="all"` first (line 52) and only then `await getPlatform()`. Two notes:
* On the **gallery** surface the late-font trick is dead code. `scripts/lib/vite-shell-target.mjs:23` rewrites
  `onload="this.media='all'"` into `data-late-font`, but the gallery head
  (`scripts/lib/vite-gallery-surface.mjs`) emits a plain `<link rel="stylesheet" href="/fonts/fonts.css">`, so
  there is nothing to rewrite and the font stylesheet is render-blocking in the shell as on the web. Harmless
  (the file is local) but it means a Codex worker must not assume fonts are deferred in the app.
* `getPlatform()` → `createTauriPlatform` (`src/platform/tauri.ts:23-29`) dynamically imports **eight** Tauri
  modules and then awaits **four** IPC round trips in one `Promise.all` (`appLocalDataDir`, `store.load`,
  `getVersion`, `os.locale`), plus `store.get('files.index')` and one `path.join` **per indexed file**
  (`tauri.ts:42-44`). With an empty index that is cheap; once a reader has downloaded full pictures it is one IPC
  per stored picture at every boot. Fix: resolve those paths lazily in `files.url()`/`exists()` instead of eagerly
  in the constructor loop.

**IPC chatter.** Steady-state IPC is low: the pack manager's `refresh()` is a single directory listing by design
(`src/core/packs.ts:156`, and the comment at :77 says why), settings are `store.set` + `store.save` per write
(`tauri.ts:70-72` — two IPC calls for every preference change, including every theme and text-size tap), and
`openExternal` is one call per external link. The one to fix is the settings write: batch or debounce
`store.save()`, because the reader writes a preference on every size step.

**Picture fetch from SITE_HOST.** `src/gallery/media.ts:13` builds `https://world.yahwehword.com/pictures/full/<id>.webp`
and `src/gallery/scenes-page.ts:183` eagerly preloads **both** neighbours of the current scene with bare
`new Image()`. Measured on the web: 190,338 B + 221,220 B for Genesis 1:1 and 1:14. In a shell those are
cross-origin requests from `tauri://localhost` allowed by the CSP (`img-src … https://world.yahwehword.com`), they
get no service worker (the shell build deliberately removes `sw.js`, `scripts/shell-dist.mjs:38`) and no
`Cache-Control` worth anything (§3 P2) — so **a shell re-downloads a full picture every time the reader revisits
it**, unless the (unshipped) offline pack happens to hold it. This is the single biggest shell-only network cost
and the fix is the same `localFull` path plus a real HTTP cache policy on the host.

**WebView differences.** iOS and macOS are WKWebView (the WebKit column of every table above is the closest
reading available); Android is the Chromium WebView, which on an up-to-date device is close to the `phone4x`/`phone6x`
Chromium columns; Windows is WebView2, i.e. Chromium on a desktop-class CPU, so the `desktop1x` column applies.
The iOS/macOS-specific risks are in §3 P6 and §8.


---

## 7. Engine differences (Chromium vs WebKit)

**WebKit's numbers are not comparable to Chromium's, and the report must not let a zero read as a good result.**
`PerformanceObserver.observe()` does **not throw** in WebKit for an entry type it does not produce, so
`__perf.support` is `true` for everything in both engines and cannot be trusted. What can be trusted is whether
any entry ever arrived, counted across all 6 WebKit and 24 Chromium load rows of `load-all/load.json`:

| entry type | Chromium 143 | WebKit 26.6 | consequence |
|---|---|---|---|
| `largest-contentful-paint` | delivered | delivered | comparable in kind, but WebKit reports it far earlier (404 ms vs 1,716 ms on the same cold `scenes`) |
| `event` (Event Timing) | delivered | delivered | §2.4's INP column is real on both |
| `layout-shift` | 6 of 24 rows had shifts | **0 entries, ever** | **every WebKit CLS in §2.1 is `0` because nothing was observed, not because nothing moved** |
| `longtask` | 26 tasks | **0 entries, ever** | every WebKit TBT and long-task count is likewise meaningless |
| `long-animation-frame` | all 24 rows | **0 entries, ever** | the script-and-function attribution that found P5 exists only on Chromium |
| `document.fonts` `loadingdone` | 8 faces reported | **0 faces reported** (`fonts.ready` still resolved, at 719 ms) | font timing is Chromium-only |
| `performance.memory` | present | **absent** (`heap: null`) | the memory suite is Chromium-only and says so |

Two real engine findings do come out of it:

* **WebKit transfers ~900 KiB less on the home and gallery routes** (1,972 KiB vs 2,912 KiB; 1,863 vs 2,720).
  It fetched `NotoSerifSC` but **not** `NotoSansSC` on those routes, because the 0×0 language-menu rows
  (§3 P1b) do not demand glyphs in WebKit the way they do in Chromium. The same page is therefore ~1 MiB cheaper
  on iOS than on Android today — and a fix for P1b removes the Chromium-only MiB.
* **WebKit reports `transferSize: 0` for every thumbnail** (`thumb 0 (16)` in §2.2), so byte accounting on WebKit
  must use `encodedBodySize`; the harness reports both (`bytesByKind` keeps `transfer`, `encoded` and a `cached`
  count, `tools/perf/lib/probe.mjs`).


---

## 8. What could not be measured here

1. **Real-device frames on any platform.** Headless Chromium's compositor is not a phone's. The fling is driven
   from inside the page (`scrollBy` each frame, `__perf.fling`), so it exercises style, layout, paint and the
   main thread honestly, but it does **not** exercise touch handling, overscroll/rubber-banding, the
   out-of-process raster of a real GPU, or 120 Hz. Every scroll number in §2.3 is a floor, not a ceiling.
2. **iOS / WKWebView rendering cost.** `backdrop-filter` (§3 P6), `position: sticky` repaint with safe-area
   insets, `100vh` vs the dynamic viewport, momentum in the nested scroller `.pc-right`
   (`src/gallery/scenes-page.css:83`) and `-webkit-overflow-scrolling: touch` on the nav strip
   (`src/nav.css:150`) are all WebKit-compositor behaviour that headless WebKit will not show. **Procedure for the
   owner:** build and install the TestFlight build on the iPhone; on the Mac, Safari ▸ Settings ▸ Advanced ▸
   "Show features for web developers"; connect the phone by cable, unlock it, and on the phone
   Settings ▸ Safari ▸ Advanced ▸ Web Inspector ▸ on; then in Safari's **Develop** menu pick the device, then
   **Yahweh's World → the app's webview**; open **Timelines**, press record, fling the gallery, and read the
   Rendering Frames track: any bar over 16.7 ms names the layer. Then toggle iOS Settings ▸ Accessibility ▸
   Display & Text Size ▸ **Reduce Transparency** — which `src/tokens.css:250` already uses to switch every
   `backdrop-filter` off — record the identical fling again, and compare the two recordings. That single A/B
   settles P6 without changing a line of code.
3. **Android WebView frames.** **Procedure:** install the debug APK, then on the Mac open
   `chrome://inspect/#devices` in Chrome, pick the app's WebView under the device, and use Performance ▸ record
   with "Screenshots" and "Web Vitals" on. The same fling gives real `dropped frame` counts and a GPU track.
4. **The native shells' startup, protocol-read and parse costs** (§6). Nothing here is measured; the file sizes
   and the code paths are. They need `chrome://inspect` (Android/Windows) or Safari Timelines (iOS/macOS) on the
   boot of a real build.
5. **Whether HEAD already fixes P1a.** The deployed build 3 serves
   `<span class="zh" data-brand>雅偉之界</span>` in the bar; on HEAD, `scripts/lib/product-name.mjs:42`
   `wordmarkLockup()` emits the `.tri` lockup whose non-matching readings are `display: none`, which would remove
   the serif trigger. That is a **code reading, not a measurement** — the repo could not be built for this audit
   because other sessions were mid-flight in it (`git status` shows `public/data/gallery/index.json`,
   `public/data/gallery/summaries.json`, `public/data/zh-hant.json` modified, `dist/` rewritten at 13:14, and two
   release watchers running against `dist-app/`). **Procedure:** after the next deploy, run
   `node tools/perf/measure.mjs --suite load --engine chromium --profile phone4x` and check the `font` column of
   §2.2; or on any build, `node tools/perf/budget.mjs --only assets`, whose `cjk-sc` row fails while the two
   files are over 2,800 KiB.
6. **INP as a field metric.** What is in §2.4 is lab INP from one scripted interaction each. Real INP is the 98th
   percentile of a real session. The site sends no analytics, so this cannot be known from here; if the owner wants
   it, the smallest honest version is the `web-vitals` library reporting to the existing `/api/feedback` function.
7. **Font swap flashes (FOIT/FOUT) as a visible artefact.** Every `@font-face` in `public/fonts/fonts.css` is
   `font-display: swap`, so by construction there is **no FOIT** — and therefore a guaranteed **FOUT** for any text
   whose face arrives late. The harness records when each face finished (`fonts`, `fontsReady` in `load.json`), and
   §3 P1 quantifies the window: with the serif CJK file finishing 2.4–3.0 s in, any Chinese text on screen is
   re-drawn in a different face **seconds** after first paint. The *visible* flash (how much reflows, and whether
   it is ugly) needs a filmstrip, which this harness does not capture; `--screenshots` is the obvious next
   addition to `tools/perf/measure.mjs`.
8. **Windows.** No Windows machine was in reach. `desktop1x` Chromium is the right proxy for WebView2; the only
   Windows-specific unknown is the installer/first-run cost of unpacking a 93.6 MiB bundle.

