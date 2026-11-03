# Gallery surface, S0-S2: before and after (2026-11-03, branch gallery/release-1)

Same scans before and after (handoff/09 bar). "Before" = the branch base built by a scratch config with only the pages that
build in a clean worktree (index, bible, scenes, figures, plan, tabernacle, temple); the full committed config does not build in a
worktree because it names pages that exist only in the dirty main checkout. Raw files in this folder.

| | before (full surface, base) | after (gallery surface) |
|---|---|---|
| dist size | 127 MB (444 files; main checkout's own dist is 666 MB with its untracked cutouts) | 278.8 MB real bytes (4,626 files): pictures 252.3 MB, data 23.8 MB, share pages 1.8 MB. Limit in the plan: 300 MB |
| pictures | merged bilingual JPEGs from another host (yahwehs-scenes.netlify.app) | text-free squares from the site's own /pictures/; 1,368 of 1,443 gate-passed, 75 held by the gate (plain placeholder plate) |
| home first view (budget scan, brotli) | globe `/`: 639 KB, js 227 KB | home `/`: 110 KB, js 12 KB (budget 135 / 15) |
| scenes first view | 235 KB, js 19 KB (events.json 172 KB) | 112 KB, js 15 KB (gallery index 66 KB; budget 135 / 19) |
| reader first view | 182 KB | 177 KB (budget 220 unchanged) |
| mobile (390x844, 1.6 Mbit, 4x CPU) total wire / layout shift | scenes 237 KB, cls 0 | home 230 KB incl. the hero picture, cls 0; scenes 115 KB, cls 0; picture page 115 KB, cls 0 |
| desktop cls | scenes 0.007 | home 0.013, scenes 0.002, picture 0 |
| distinct font sizes at 375 (<= 7 wanted) | scenes 8 | home 7, scenes 6, picture 7 |
| text under 12 px | scenes 3 | 0 on all three new pages |
| contrast failures | 0 / reader 2 | 0 on all three new pages (reader's 2 unchanged: not touched) |
| touch targets under 44 px at 375 | scenes 1, home(globe) 2 | home 2, scenes 1, picture 1 (the shared language switch's EN button, 34 px wide; its hit area is extended to 44) |
| hidden pages | all built | 302 to `/` via dist/_redirects; none built (verify-redirects) |

Gate at build time (tools/scenes/gate_check.py square --all): 1,368 pass / 75 fail (the 2026-11-03 15:05 note said 1,361 / 82).

Checks that run now (npm run verify:gallery): check-budget --profile gallery; verify-gallery 33 checks; verify-redirects 35;
verify-gallery-ui 134 (home, search, edition sheet, browse, picture, copy, failure states, four languages, paper contrast, reduced motion
at 375 and 1440); verify-bible-reader (the shipped reader, unchanged, all ok on the gallery dist). verify-text-scale: no overflow at
100/125/150/200 % on home, scenes, picture, reader.
