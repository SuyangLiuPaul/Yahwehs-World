# Final pass numbers (2026-11-03, branch gallery/integrate-1)

Follows `NUMBERS-integration.md`. Nothing deployed, pushed or released. Raw files in this folder: `audit-apple-design-final.json`, `measure-loading-final.json`, `reader-robustness.json`,
`verify-ru.json`, `shots/`; the quality sweep is in `pictures-quality-sweep.md`.

## Pictures and size

| | integrate-1 (before this pass) | final |
|---|---|---|
| `gate_check.py square --all` | 1,420 PASS / 23 FAIL | **1,443 PASS / 0 FAIL** (merged `main`'s committed gate state: 24 owner-accepted squares replaced by clean Higgsfield redraws, their acceptances retired; 28 owner acceptances remain) |
| served pictures | 1,420 (+23 placeholder plates) | **1,443, 0 placeholders** (`data/gallery/pictures.json`: 1,443 `pass`, 1,443 distinct full-file hashes; `verify-gallery.mjs --strict-pictures` green) |
| `public/pictures` | 261.6 MB | **253.0 MB** (thumbs 48.9 + full 204.1) |
| `dist/` real bytes (MiB) | 302.0 MB (308.3 MB with all 1,443 at the old q78 for full) | **293.3 MB** (pictures 253.0, reader data 37.6, share stubs 1.8, pages 0.9); cap 300 |
| picture encoding | thumb q76, full q78 | q76 for both (rule and sweep: `pictures-quality-sweep.md`; mean SSIM 0.9523 vs 0.9561, full files -6.9 %) |
| `verify-gallery.mjs` size check | limit 320 | limit **300** (the plan's number) |

Decimal check: 293.3 MiB = 307.6 MB (1 MB = 10^6 bytes). The plan's cap and all earlier numbers are MiB. If the owner reads the cap as decimal, full-size q74 gives 284.6 MiB = 298.4 MB.

## Suites (all green, run on the final build)

| suite | result |
|---|---|
| `npm run test:gallery` (node) | 21 / 21 (feedback function incl. the four environment-variable names, edition table, no 1919) |
| `npm run test:reader` (node) | 90 / 90 |
| `check-budget --profile gallery` | inside budget: home 108/135 KB (js 9/15), scenes 108/135 (js 11/19), Bible 130/160 (js 32/40) |
| `verify-gallery.mjs` | 41 checks; **42 with `--strict-pictures`** (every scene `pass`, none held, none excluded) |
| `verify-redirects.mjs` | 38 / 38 |
| `verify-gallery-ui.mjs` | 334 / 334 at 375 and 1440 (338 before: the four checks on a held plate no longer apply, no plate is held) |
| `verify-ru.mjs` (new, in `verify:gallery`) | 74 / 74: data (1,443 Russian titles and captions, 2,597 of 2,597 Russian headings, `rst` and `rst-yhwh` shape and Cyrillic) and 15 pages and sheets x 2 viewports with no foreign visible text |
| `npm run verify:reader` (browser, demo build) | 169 / 169 (one run in three failed on "Escape closes the sheet and focus returns": the check read focus before the dialog's queued `close` event; the check now waits up to 1 s; two clean runs before and one after the change) |
| `audit-apple-design.mjs` (375x812, 1440x900; home, scenes, picture, Bible) | unchanged from `NUMBERS-integration.md`: 0 text under 12 px; 0 contrast failures (117 / 203 / 50 / 86 nodes at 375); distinct sizes 7 / 6 / 7 / 10; touch targets under 44 px at 375: 2 / 1 / 1 / 1; no horizontal overflow |
| `measure-loading.mjs` (mobile 1.6 Mbit, 4x CPU) | home ready 558 ms, 29 KB at ready; scenes 553 ms, 24 KB; Bible 1,284 ms, 133 KB; layout shift 0 on all three (desktop home 0.013, scenes 0.002 as before) |

## Defects found by looking at the final screenshots, and fixed

1. Home hero on a phone, English: the two buttons wrap to two rows, the words became taller than the plate's 4:3 and climbed over the top of the picture, the gold kicker and the reference
   line sat on unshaded foliage (low contrast, not measurable by the audit because it is over an image). Now the stage grows with its words (plate and words share one grid cell), the
   words start 88 px into a stronger scrim. Layout shift stays 0.
2. 对照: the edition pill read "Parallel · 2" beside the switch reading "Parallel" (two neighbouring pills named alike). The pill now reads "2 editions" / "2 个译本" / "2 個譯本" / "2 издания".
3. The licences sheet on a phone in Russian: the chip "Общественное достояние" broke inside its own border; it now wraps as one unit.
4. Russian: landmark names (site nav, language switch, tab bar, testament switch, reading-theme group) were English or bilingual; now they follow the language (`data-aria-*`). The licences sheet
   printed "Public domain" and two English phrases in the holder line under a Russian page; now translated.

## Russian

Complete and labelled "not yet read by a native speaker" (home note; reader display sheet). Details in `verify-ru.json`. Deliberately not translated: edition names and abbreviations (BSB, KJV, Berean Standard Bible ...),
the brand lockup, the credit line of an edition (written in that edition's language, as Words does), the English reference that stays beside the Russian one ("Бытие 15:1–21 · Genesis 15:1–21"),
URLs, e-mail, the version. `rst` has 8 empty verses (Acts 19:41, 2 Cor 11:33 and six more): Synodal verse merges in Words' bytes (pinned by SHA-256), shown as a dash in 对照.

## Screenshots

`shots/` (244 JPEG files, all taken from the final build; the 234 of the first integration were replaced, the stale 768 ones removed; 375x812 and 1440x900 in en, zh-Hans, zh-Hant, ru; 768x1024 in en for home, gallery, picture, reader). home, gallery, picture page, 对照 and the feedback sheet in dark, light and paper for all four languages and both sizes
(`--all-themes`: home and gallery switch their reading surfaces, the plate area stays dark by design); reader page and Psalm 119 对照; the edition sheet from home and from a picture; the licences sheet;
a picture that used to be held (`held-*`, now a normal picture); the feedback sheet after a failed send (with the mailto: way out) and after a good one. Served by `vite preview` on 127.0.0.1 (`--base`).
