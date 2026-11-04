# 04 — Final ruling of the World architecture council

Chair: Fable 5.1, 2026-11-04. Read: dossier, five papers, devil's advocate (DA). Checked read-only: commit `1d13342`, `docs/gallery-shells.md` clipboard section, selection-widget counts in Words-184/Sword-184, `webview_flutter` 4.14.1 platforms. Not committed.

## 1. The ruling

**The council confirms the destination and withdraws the schedule.** Destination: Words, Sword and World share extracted Dart packages in one workspace; the public web stays the TypeScript site; 3D stays three.js behind one widget seam; "fork Words and strip" is dead. That is unanimous, including the DA, and is decided today. **What the DA changed:** the five papers also said "start rewriting World's native apps in Flutter now", and that rested on a quality premise measured at 18:02–18:22 on a build superseded at 20:03 by `1d13342` (19 files, 367 insertions: `content-visibility` on cards, `afterLayout()` double-rAF, precomputed search index, `unicode-range` and cache-header fixes). No post-fix measurement exists; my own paper listed a clipboard bug as "the WebView's" when `gallery-shells.md` records its fix. The quality case is **unproven, not refuted**. The plasticity case, the owner's first criterion, does not depend on frame rates and is served first and cheapest by extraction, which Words and Sword need regardless. So: **native World on Flutter is the end state; whether World 1.0 ships on the fixed web stack first or waits for Flutter is gated on one week of spikes under a fixed decision rule (§5).** No Flutter World code is written before that rule fires.

## 2. Where all voices agreed

Sunk cost is zero. Shared Dart packages in a pub workspace, Words/Sword first; the four `sed` sync scripts go. Public web = the existing TS/HTML site; Flutter web rejected for SEO/share. No fork-and-strip (12,511-line pane, 61 Provider reads; Sword proves the drift). `flutter_scene` 0.24.3 is a spike, not a dependency. A Dart World reader is new and thin (Opus: 266 escaping import edges; the pane does not lift). The data pipeline and church-vocabulary gate are stack-independent. Codex/Gemini write; only Claude runs `flutter`, serially.

## 3. Disagreements and how they are resolved

- **Cost (Fable 25–35, Opus 28, Sonnet 53, Gemini 54, Codex 58–95 agent-days).** Resolved: the council quotes **30–55, plan on 50**. My "5–7 agent-weeks" quoted the floor and is withdrawn. S1 measures the extraction rate every estimate assumes.
- **Reader: extract Words' (Codex) or build new (the other four).** New: the edge count is measured, the extraction is not.
- **Spike set.** DA's G1–G3 plus Opus S1 and S3. Codex's and Sonnet's 3–4-day release rehearsal moves to week 1 of a go branch; it proves cost, not direction.
- **Windows 3D (Opus/Gemini adapter, Fable browser hand-off, DA regression).** DA is right on fact: `webview_flutter` 4.14.1 lists android/ios/macos only. Under C it is a recorded regression against Tauri; accepted because Windows ranks below iOS/Android and 3D is post-1.0.
- **Timing (five papers: start now; DA: gate).** DA wins. Unbundling costs a week; a wrong quarter costs Words 1.8.2.

## 4. The DA's three strongest objections

1. **Stale measurement — accepted.** Verified: evidence 18:02–18:22, commit 20:03, nothing later. One correction: `gallery-shells.md` shows iOS *Safari* copy working; the iOS *Tauri shell* row reads "not tested". The clipboard fix is unverified exactly where it matters, so G2 includes iOS-shell copy.
2. **Flutter selection unproven — turned into G3.** Verified: 0 `SelectionArea`, 0 `SelectableRegion` in both apps; `SelectableText` 34/21, not the DA's 75/47, which changes nothing. Words/Sword prove CJK rendering, not drag-selection across a chapter with inline images.
3. **Cost quoted at the floor, extraction unmeasured — accepted,** turned into S1 and the 30–55 quote.

Rejected: the "two-reader tax" (DA conceded; the HTML site exists under every option). Rejected: the A→C asymmetry as grounds to prefer A outright; it is grounds to gate, which we do.

## 5. Decision procedure

**Decided now, regardless of spikes:** pub workspace + leaf-first extraction (`settings_kit`, `skeleton`, tokens, `i18n_core`) on `main` after `release/1.8.4` ships, one package per PR, sync script deleted in the same PR, no `build_runner` ever; public web = TS site; 3D = three.js behind `SceneHost(sceneId, passageId)`; no fork-and-strip; no Flutter-web World; Tauri build 4 / Windows / notarisation stay paused except what G1–G2 need.

**Spikes (one week, ~6.5 agent-days, `flutter` runs serialised):**

| # | What | Who | Days | Pass |
|---|---|---|---|---|
| G1 | Re-run `tools/perf/measure.mjs` on `1d13342` + remaining top-3 fixes, same profiles | Codex (node, no flutter) | 0.5 | fling ≥55 fps at 6× CPU, <5 % dropped, worst reader frame <100 ms, search keystroke <50 ms, first-paint fonts <300 KiB |
| G2 | Same build as installed shells on oldest Android + iPhone: fling, 3-up Psalm 119, select+copy zh-Hant/ru, **iOS-shell copy** | Claude (devices); Codex preps builds | 1 | ≥50 fps, exact copy with credit line on both, no WebView crash in 10 min |
| G3 | Throwaway Flutter app: `SliverGrid` over the real 1,443 thumbs; a chapter with an inline image inside `SelectionArea`; same devices | Codex/Gemini write; Claude runs | 1.5 | ≥55 fps **and** drag-selection across the image boundary copies correct zh-Hant and ru on both |
| S1 | Extraction dry run, fresh clone off `main`: workspace root, `settings_kit` + tokens, both apps path-depending | Codex edits; Claude runs analyze/test/CI | 2 | analyze clean, identical test counts, `design_lint`/`lint_ratchet` green, ≤1 agent-day per package |
| S3 | `src/walk/` from bundled assets in a Flutter WebView, offline, JS→Dart bridge, iOS/Android (+ `webview_windows` attempt) | Codex builds bundle; Claude runs | 1.5 | ≥30 fps on slow Android, offline relaunch, bridge round-trip |

**Decision rule (binding, no re-litigation):**
- **G3 fails on selection** → Flutter does not beat the web on the owner's actual complaint. World 1.0 ships on the fixed TS/Tauri stack; native Flutter World is revisited only when a later Flutter fixes the measured failure. Extraction continues for Words/Sword.
- **G3 passes and (G1 fails or G2 fails on either device)** → **go Flutter native World now**, provided S1 passed; Tauri shells are never submitted; TestFlight builds 1–3 stay internal.
- **G3 passes and G1 and G2 pass** → **stay on Tauri/TypeScript and fix**: ship World 1.0 on it when the owner says release; Flutter World becomes World 2.0 as a thin app on the packages after Words/Sword adopt them (then ~15 agent-days, not 50). Tauri is a bridge, not the destination.
- **S1 fails** → extraction is redesigned before any World decision depends on it; World 1.0 ships on the web stack regardless.
- **S3 fails** → 3D plan moves to `flutter_scene`-when-1.0; does not change World 1.0.

## 6. Cost, timeline, regret

**Stay and fix:** 8–12 agent-days (P0s, build 4, Windows machine). 4–6 calendar weeks to all-store-submittable; Play's 14-day closed test is the long pole. Regret: World feels less native than Words on Android/macOS; iOS selection handles never quite right; third app shares no widget; the Flutter reader is paid later anyway.

**Go Flutter now:** 30–55 agent-days (plan 50), ~35 % needing Claude's serial `flutter` slot. 10–14 calendar weeks; Play's 14 days start in week 1 with a hello-world build on Words' pipelines. Regret: reader rebuild runs double; Words 1.8.2 slips unless ring-fenced; Windows 3D opens a browser; a package bump can block a Words release.

**Extraction (both branches):** 8–12 agent-days, mostly Codex, after 1.8.4 ships.

## 7. What the owner must decide

1. Workspace + extraction for Words/Sword after 1.8.4. **Yes.**
2. One-week spike budget (~6.5 agent-days) before any World migration. **Yes.**
3. §5's decision rule is binding. **Yes**; otherwise the spikes are theatre.
4. 「release」 for the TS public site once W1/W2/W6 close. **Yes, independent of the rest.**
5. Under C, Windows opens 3D in the browser until WebView2 or Flutter GPU is proven. **Accept**; S3 shows whether it matters.

## 8. Next 7 days

Day 1: Codex runs G1, numbers into `docs/evidence/perf-2026-11-04-postfix/`; Claude clears `src-tauri/target` so the iOS shell can build. Days 1–2: Claude runs G2 on the oldest Android and an iPhone, iOS-shell copy included. Days 2–4: Codex/Gemini write the G3 app, Claude runs it on the same devices; in parallel S1 in a fresh clone off `main`, never the shared Words checkout or the release branch. Days 4–5: S3. Day 6: `05-spike-results.md`, before/after on the same harness, regression check on the previous fix. Day 7: apply §5 and record the branch. Words/Sword work untouched all week; no Flutter World code.

## 9. Still unverified

Real-device numbers for either stack. iOS Tauri-shell copy. Whether Codex's sandbox runs `dart test`. Apple 4.2 outcome for a Tauri reader app. `webview_windows` at Flutter 3.47.9. `flutter_scene` stability through 2027. Impeller desktop backend (Vulkan vs GLES; sources conflict). Per-release hours of Tauri shells vs a Flutter pipeline in this team.
