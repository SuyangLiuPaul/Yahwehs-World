# Council paper 02: Sonnet (implementer and maintainer angle)

Date 2026-11-04. Written before reading any other council paper. I read the brief, the research dossier, the perf and gap audits, the 2026-11-03 Fable ruling (first 400 lines of 498 plus the summary), and sampled the Words code. I ran no web searches; the dossier's sourcing is what I rely on, and its [S]/[U] tags apply to my claims too.

## 1. Recommendation

Choose C, with two amendments. (1) World becomes a **new, lean Flutter app in a monorepo with Words and Sword**, not a fork of Words. (2) The TypeScript site stays as the public web, share and PWA layer and as the host for 3D "labs", but it stops being wrapped in Tauri. Extract first a small `design` package, then an `editions/i18n` data package. Do not extract Words' reader. World gets its own reader of about 2,000 lines, because Words' reading pane is 12,511 lines in one file and carries notes, highlights, sync and AI. The reason is cost per release, and it is mostly not code. Words already has about 20 GitHub workflows, signing recipes and three store records. A third Flutter app reuses all of that. A Tauri shell adds a fourth toolchain (Rust, tauri-cli, a generated Gradle and Xcode project, a Capacitor fallback) that only World uses, and its quality problems (selection, fonts, three web engines) are structural. Expect about 50 agent-days to the first store-quality release, mostly gated by Flutter-capable supervision, not by typing.

## 2. Scoring (1 worst, 5 best; the owner's order)

| Criterion | A Tauri+web | B Flutter incl. web | C hybrid (amended) | D other |
|---|---|---|---|---|
| Extensibility / plasticity | 3: TS is flexible, but it is a third codebase beside two Dart apps; design and editions are copied between languages | 4: one language, but forces Flutter onto the public web | **5**: one Dart kit/data base for 3 apps, TS where TS is stronger (SEO, 3D) | 2 |
| Low all-platform release cost | 2: four custom shells, a separate pipeline, three WebView engines to regression-test | 4: one pipeline, but a second web site is needed anyway | **4**: native pipeline shared with Words; web is a Netlify push | 1 |
| Quality ceiling per platform | 2: copy/selection, fonts and jank are webview-dependent (owner's own complaint) | 4 native, 2 on web | **4** native everywhere; web is real HTML | 3 (Compose/RN each lose somewhere) |
| Store-quality cost | 3: built, but 4.2 risk is unmeasured and gap audit lists 7 P0 incl. shells showing no picture | 2: rewrite everything | 3: rewrite of about 6-9k lines, no web rewrite | 1 |
| 3D future | **5** three.js native to stack | 2: flutter_scene pre-1.0 | 4: three.js in a WebView lab now, flutter_scene as an option | 3 |
| Start further apps from the base | 2 | **5** | **5** | 1 |
| AI-agent friendliness | **4**: TS tests run in Codex's sandbox | 3 | 3: logic in pure Dart packages helps, UI needs Claude | 2 |
| Risk | 3: Tauri mobile, Android WebView | 3 | **3**: two stacks, but both already run in production here | 4 |

Totals are roughly A 24, B 27, C 31, D 17. The margin of C over B rests on one judgement: a Flutter web build is the wrong tool for the share and SEO page (dossier section 2, all [S]), so B pays for a second site anyway.

## 3. Migration path (what I would do, with agent-day estimates)

Assumptions: Codex edits TS and Dart but cannot run flutter or commit; Gemini edits only; Claude runs flutter, tests and commits. So the effective throughput is capped by Claude verification slots, not by how many agents type. I estimate at 60% of agent-days needing a Flutter-running session.

**Phase 0, two days: freeze and measure.** Land the cheap perf fixes in the TS site (audit P1-P3 is "a day's work"), since the web stays. Do not touch the Tauri shells further. Retire them from the store plan, keep them as unreleased fallback.

**Phase 1, about 8 agent-days: monorepo and the design package.** Move Words and Sword into one repo with `apps/` and `packages/` (pub workspaces; the dossier marks melos glob behaviour [U]). First package: `ydh_design`. Measured coupling: `lib/design` has about 30 imports back into the app (`models/app_settings` 6x, `utils/font_catalog` 4x, `constants/ui_strings` 3x, and several widgets). Each back-edge becomes an interface injected by the app. This is the true cost of "extract first", and it is one to two days of agent work per ten edges, not hours. The existing settings-kit sync script between Words and Sword is then deleted, which is a maintenance win in itself.

**Phase 2, about 6 agent-days: `ydh_editions` data package** (edition loading, section titles, copy-with-citation rule, credit strings) plus a **`world_catalog` contract**: the globe-shell repo emits `catalogue.json`, picture hashes, editions and thumbs as one versioned data pack; a JSON schema test runs in both Dart and Node. This is the single source of truth that both the Flutter app and the TS public site read.

**Phase 3, about 32 agent-days: World app.** Breakdown:
- scaffold, theme, nav, 4-language strings: 4
- catalogue, cached/LQIP thumbs, windowed 1,443 grid (SliverGrid, `cacheWidth`): 5
- reader with inline plates at section start, paragraph/verse mode, 8 editions, edition-per-language default, SelectionArea copy with citation: 9
- picture page, prev/next, share link, "continue in Words": 4
- search over books, references, captions: 3
- feedback sheet (reuse the existing endpoint; fix CORS list): 2
- offline picture packs with byte counts and cancel: 4
- polish, accessibility pass, device QA across 5 platforms: 1 beyond the rest because QA is spread throughout

**Phase 4, about 5 agent-days plus owner calendar time: stores.** New app records (ASC, Play, Partner Center), privacy page and labels, listing text x4, screenshots. Play's closed-test gate (12 testers x 14 days, which Sword already tripped over) is calendar, not effort; start it in week 1 using a hello-world build.

**Total about 53 agent-days, roughly 9-12 calendar weeks** for the minimal release (reader with plates, gallery, search, feedback, 4 languages, offline pictures). I would not promise less. A pure speed-up here would come from cutting the reader to verse mode only in 1.0; I would not, because the product sentence in the gap audit is "text opens to picture and back".

**Deleting safely.** Do not fork-and-delete. Words is one package: 523 files import `package:yahwehs_words/...` into themselves, `bible_reading_pane.dart` is 12.5k lines, 23 files use GetX, `assets/` is 596 MB. Deleting 90% of it means chasing transitive imports through a monolith, and every deletion needs `flutter test`, which Codex cannot run. A clean app that copies selected files from Words, with a provenance comment, is cheaper and safer. When the extracted packages land, Words consumes them, and deleting from Words later is its own owner-scheduled refactor. The old Tauri code is deleted only after World 1.0 ships on all stores.

## 4. Architecture sketch

```
repo/
  apps/ words/ sword/ world/ (app4/)
  packages/
    ydh_design/        tokens, sheets, type scale, a11y helpers
    ydh_i18n/          strings, plural rules, locale->edition default
    ydh_editions/      Bible text access, citation/copy rules
    ydh_data_world/    catalogue, picture hashes, reader overlay (plates by passage)
    ydh_feedback/      endpoint client, privacy strings
    ydh_offline/       pack download service (from Words' offline_pack_service)
    ydh_labs/          LabsView(featureId): WebView host for bundled web modules
  tools/ ci/           parameterized workflows: app name -> bundle id, secrets scope
  web/ (existing TS site)  imports the same data pack; owns /p/<id>, SEO, PWA
```

- **Feature modules per app.** A `FeatureRegistry` of const flags per app's `main.dart`; packages never import apps. Words enables notes and sync; World enables gallery and plates; Sword enables lexicon.
- **3D.** `ydh_labs` serves a bundled, versioned web build from a local origin into `flutter_inappwebview` (the dossier reports this works, [S]). The globe, ark, tabernacle and temple stay three.js, the same code as the public site, with a thin JS bridge for passage/plate deep links. Text selection does not matter inside a 3D scene, which removes the webview's weakness. flutter_scene stays a measured spike; if it is stable at 1.0 by the time the walk-throughs start, port one walk-through and compare.
- **Fourth app.** `tools/new_app.sh <name>` copies `apps/world` skeleton, wires registry, creates CI parameters. Store records are still manual. Target: scaffolded app on TestFlight in under 2 days.
- **Public site data.** A CI job in the monorepo builds the data pack and publishes it to `world.yahwehword.com/data/` with a version; the TS site and the app both fetch/bundle that. A redrawn picture changes its hash, nothing else.

## 5. Disagreements

1. **With the dossier's scoring:** it rates C's release cost worse than A's (3 vs 2) because "two codebases". That counts languages, not pipelines. Words already pays for signing, notarization, MSIX, Play AAB and 20 workflows; World as a third app is marginal. Tauri is the fourth pipeline, owned by no other product.
2. **With the Fable 2026-11-03 ruling:** it rated "one language, agents strongest in TS" as decisive and dismissed Flutter on 3D and a "second codebase". Today's facts differ from its premises: the owner reports webview selection, fonts and jank (structural), the gap audit finds the shells show no picture on three of five platforms, and the Fable plan itself includes a Capacitor fallback for iOS, i.e. a fifth toolchain. Sunk cost is zero, so "it already exists" cannot weigh.
3. **With "fork Words and delete":** see section 3. It is the obvious answer and the more expensive one.
4. **With the perf audit as an argument for A:** its findings are mostly cheap web fixes (fonts of 2.68 MiB, missing `content-visibility`, an `innerHTML` reflow). They improve the web site I keep. They do not fix selection or three-engine variance.
5. **With any rewrite of the public site into Flutter web:** SEO and share previews are the documented Flutter-web weak spot; plain HTML wins and already exists.
6. **Where Fable was right:** the data side of the Tauri plan (hash-pinned editions, versioned catalogue, pictures fetched not bundled) is excellent and carries over unchanged.

## 6. Three spikes (each about 2-3 agent-days)

**Spike 1: reader and grid on the worst device.** A throwaway Flutter app on the same low-end Android class the web audit emulated (6x CPU). Contents: 1,443-card windowed grid with real thumbs; Genesis 1 and Psalm 119 in zh-Hant and ru with an inline plate widget and `SelectionArea`; a WebView with the existing three.js globe. *Pass:* grid p95 frame at most 20 ms during a 20 s fling (web currently 66.8 ms); selecting across a plate boundary and copying yields correct text on iOS, Android and Windows; globe in WebView at 30 fps or better. *Fail:* any of the three, which would reopen A for the reader.

**Spike 2: design-package extraction.** In a clone of Words, extract `lib/design` into a package by interface-injecting back-edges. *Pass:* `flutter analyze` and the existing design and widget tests green, at most 60 touched files, at most 2 agent-days. *Fail:* the extraction exceeds that, then I switch to copy-and-diverge for the design kit and accept sync-script maintenance.

**Spike 3: pipeline reuse.** Make a hello-world third app build through Words' iOS, Android and Windows workflows with parameters changed (no new workflow files). *Pass:* TestFlight, Play internal and an MSIX artifact produced within 3 agent-days, excluding owner account creation. *Fail:* more than 6 days, which means the pipeline is Words-specific and the shared-release-cost argument is weaker than I claim.

## 7. What I could not verify

- Whether Codex's sandbox can run `dart test` (not `flutter test`). If yes, pure-Dart packages become a strong agent-friendliness argument; if no, Claude is the only verifier for all Dart and my estimates stretch.
- The real per-release hours of the current Tauri shells. Nobody measured them; my claim that they cost more than a shared Flutter pipeline is inference from toolchain count.
- Flutter 3.47 desktop Impeller behaviour on older Windows GPUs and CJK/Cyrillic selection quality in long scrolling text. Words and Sword are local evidence for CJK, but I did not test text selection with inline image widgets.
- Whether the design kit and edition code extract as cheaply as I assume; I counted import edges only, not runtime coupling (providers, GetX, Firebase options).
- App Review outcomes for either stack. The Tauri 4.2 risk is unmeasured; the Flutter app is not exempt from 4.2 but carries original native UI.
- flutter_scene's stability through 2027, and the frame rate of a three.js walk-through inside a WebView on low-end Android (spike 1 tests only the globe).
- My estimates carry roughly plus or minus 40%; they come from line counts in the Words and World trees, not from a prior attempt at this exact work.
