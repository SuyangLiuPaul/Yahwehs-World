# 雅伟之界 · 圣经世界 — Handoff & Build Plan

这个文件夹是交给下一位实现者（人或模型）的全部计划与文档。目标：把
yahwehs-globe 做成一个**完整、成熟、包含全部圣经内容**的 3D 圣经世界产品，
达到 `06-visual-standard.md` 定义的画面标准，并保持 `05-decisions.md` 里已经
裁决的边界。

This folder is the complete plan and documentation for whoever builds the
rest of yahwehs-globe. Read it in order. Nothing in here is aspirational
without an acceptance test; nothing here is a fact unless it was measured
from the repository on 2026-09-14.

## Reading order

Latest implemented batch: **`BATCH-8.md` (2026-09-18)** — Solomon's temple
rebuilt from the verses: gold and carving inside, cherubim facing the holy
place with the ark beneath, ten lampstands and tables, a tour measured for
clipping (4 legs → 0). Before it, **`BATCH-6.md` (2026-09-18)** — all 1,443 events
drawn, a menu for them, the year axis removed, and the three pages joined to
each other on the verses they cite. Released as v0.1.5. Read it before `02`,
which it supersedes wherever they disagree. `BATCH-5.md` (2026-09-15) is
altitude-scaled globe dragging, immediate release stop and gesture/tap
separation. `BATCH-4.md`
provides route-linked people and
ships, the 42-stage Exodus camp cycle, and five inspectable story demonstrations.
`BATCH-3.md` remains the current tabernacle material/environment pass. Neither
marks the full 1,443-event product or photographic visual target complete.

| # | File | What it settles |
|---|------|-----------------|
| 01 | `01-vision-and-scope.md` | What the product is, the four things that make it different, and what "all of Scripture" means as a countable target |
| 02 | `02-current-state.md` | Exactly what exists today — pages, modules, data, counts, what works |
| 03 | `03-architecture.md` | How it renders, how data flows, module map, dev handles |
| 04 | `04-data-and-licensing.md` | Every source, its licence, its obligations, and what is forbidden |
| 05 | `05-decisions.md` | Decisions already made. Do not reopen them. |
| 06 | `06-visual-standard.md` | The reference image dissected into layers, each with an acceptance test |
| 07 | `07-content-plan.md` | How to get from 105 events to every event in 66 books, with dating bands, structures, journeys, evidence, news |
| 08 | `08-roadmap.md` | Phases, in priority order, each with a definition of done |
| 09 | `09-verification-playbook.md` | How to prove a change works — viewports, dev handles, the gotchas that produced false passes |
| 10 | `10-operations.md` | Repo, deploy, where secrets live (not their values), commands, ownership |
| 11 | `11-known-bugs.md` | Open defects with repro steps |
| 12 | `12-glossary.md` | 中英术语对照 |
| — | `ALL-EVENTS.md` | **The complete event layer — 1,443 events, Genesis to Revelation, each with its passage range, parallels, date band and computed places** |
| — | `EVENT-GAP.md` | Per-book ledger of how many events exist and how many are missing, with the estimation method |
| — | `ASTRA-PROMPTS.md` | Phase-by-phase execution prompts for a token-scarce executor model |
| — | `MANIFEST-assets.md` | Provenance ledger for every non-code asset; append to it, never delete from it |
| 13 | `13-asset-library.md` | The 39 models the map and scenes still want, what they cost (measured), the payload budget that binds, and the rule that anything the text measures is built from the measurement and never generated |
| — | `BATCH-8.md` | **The current batch** — the temple walk, rebuilt from 1 Kings 6–8 / 2 Chronicles 3–4 |
| — | `BATCH-6.md` | Events layer, events menu, why there is no year axis, and the corridors between the three pages |
| 14 | `14-native-builds.md` | macOS/Android/iOS builds, the signing key, and the four release scripts |
| — | `EVENT-REVIEW.md` | Output of `node scripts/audit-events.mjs`. Regenerated, never hand-edited. Every number in it is measured — read it before believing any claim about coverage |

## Rules for whoever builds this

1. **Run `node scripts/audit-events.mjs` before and after you touch data.** It
   checks that every citation resolves, that no year band crosses into the wrong
   testament, that all 31,102 verses of the canon fall inside some event, that
   neither shipped JSON contains 耶和华 (this edition reads 雅伟), and that each
   Chinese place name actually appears in the verse cited for it. Every count is
   0 as of `c62d052`; if your change makes one non-zero, that is your change and
   not a fault you inherited.
2. **Screenshots are the referee.** A change is not done until it has been
   rendered at 375×812, 768×1024 and 1440×900 and looked at. `09` explains how.
3. **The four differentiators are the product** (`01`). A feature that does not
   strengthen one of them is a feature for a sixth Bible atlas.
4. **Licences are not negotiable** (`04`). No satellite imagery, no NIV text,
   OpenBible attribution stays in the footer.
5. **Decisions in `05` stand.** If one must change, write the reason as a new
   entry there first, then change the code.
6. **Every asset gets a line in `MANIFEST-assets.md`** — source, licence,
   generation prompt if generated, and the commit that introduced it.
7. **Commit messages explain the why**, in the style of the existing history
   (`git log`). No attribution trailers.
8. **Run the pipeline honestly**: `set -o pipefail` before any `npm run build | …`.
   A previous commit shipped broken TypeScript because a pipe masked the exit code.

## Where things are

- Repo: `SuyangLiuPaul/yahwehsworld` (**public** since 2026-09-16, so GitHub
  Releases can be fetched without a token), default branch `main`
- Live: <https://world.yahwehword.com> (= `yahwehsworld.netlify.app`).
  **Prod does NOT auto-deploy** — `stop_builds` is on, by decision (D31); only
  `tools/release_web.sh --include-prod` publishes it
- Dev: <https://yahwehsworld-dev.netlify.app> — `tools/release_web.sh`, every
  push-worthy change goes here first
- This folder: `handoff/` at the repo root
- Sister data: `../SeekSparks/assets/` (chronology, journeys, Chinese gazetteer, `cuvs-yhwh.json` — the text everything is checked against)
- Authored corrections that survive regeneration: `data/events/summary-overrides.json`, `data/events/gazetteer-corrections.json`, `data/places/cuv-renderings.json`, `data/places/names-from-text.json` — every row cites its verse
- The one place a Chinese place name is decided: `scripts/lib/zh-names.mjs` (D17)
- The audit: `node scripts/audit-events.mjs` → `handoff/EVENT-REVIEW.md`; all counts 0 as of `6b3471b`
