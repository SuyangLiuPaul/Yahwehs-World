Choose **C: Flutter for the installed apps, shared packages with Words/Sword, and TypeScript for the public web/PWA and Three.js experiences.** Create a small World app that consumes extracted packages; do not fork Words and delete most of it. Optimize for the ministry’s future portfolio: one shared reader foundation, design system and native release infrastructure, with an independently deployable public site. C wins only if that site remains bounded; maintaining two complete feature-equivalent applications would destroy its cost advantage. Existing implementation effort receives zero weight in this recommendation.

The evidence supports migration for architectural reasons, not because it proves WebViews cannot deliver quality. The [performance audit](/Volumes/androidbuild/globe-shell/docs/review/perf-audit-2026-11-04.md) reports 2.68 MiB of unnecessary Chinese fonts on English pages, an 18.6 fps fully populated gallery under 6× CPU throttling, and a 337 ms reader frame. Those are implementation defects. They are not measurements of an installed Android or iPhone app. The [gap audit](/Volumes/androidbuild/globe-shell/docs/review/world-gap-audit-2026-11-04.md) examined a different deployed build; combining their findings into one current baseline would be dishonest.

Scores below are architectural judgments: **5 is best**, including lowest cost or risk. D represents React Native plus desktop integrations and an HTML site; the alternatives grouped under D do not deserve one supposedly universal score.

- **Extensibility:** A **4**, excellent web composition; B **4**, strong Dart modules but an awkward public-web boundary; C **5**, reusable application packages and replaceable rendering adapters; D **4**, capable but introduces another portfolio foundation.
- **Long-term release cost:** A **3**, separate native infrastructure from Words/Sword; B **4**, consolidated installed apps but recurring public-web workarounds; C **5**, shared portfolio infrastructure with bounded web duplication; D **2**, another toolchain and integration matrix.
- **Quality across all six destinations:** A **3**, substantial runtime-specific tuning; B **3**, strong installed-app potential but weaker document-web fit; C **4**, suitable rendering per destination; D **4**, capable with additional desktop engineering.
- **Remaining effort to store quality:** A **4**, targeted corrections; B **2**, native and web reconstruction; C **3**, native reconstruction plus package extraction; D **2**, reconstruction plus new infrastructure.
- **Future features and 3D:** A **5**, direct Three.js integration; B **3**, additional rendering choices and integration work; C **5**, shared native features plus isolated Three.js modules; D **3**, more integration boundaries.
- **Starting further apps:** A **3**, another web-app family; B **5**, shared Flutter foundation; C **5**, the same foundation plus public-site templates; D **3**, another reusable family to maintain.
- **SEO/share/PWA:** A **5**, direct HTML capabilities; B **2**, extra document delivery and offline engineering; C **5**, HTML retained; D **4**, requires a distinct web implementation.
- **Agent workflow:** A **5**, Codex can test TypeScript locally; B **2**, Flutter verification requires supervision; C **3**, useful TypeScript work remains but Dart still needs an external runner; D **3**, TypeScript helps without eliminating native checks.
- **Risk:** A **3**, runtime variation; B **3**, rewrite and public-web mismatch; C **3**, extraction and dual-stack drift; D **2**, broad integration uncertainty.

The first two criteria decide the result. Sharing *future changes* across three apps is an economic benefit, not a sunk-cost argument. Nevertheless, C’s release-cost advantage remains a hypothesis until measured. No framework removes platform packaging, device QA or store submissions.

Flutter’s own [web FAQ](https://docs.flutter.dev/platform-integration/web/faq) recommends HTML or Jaspr for document-like public content. Replacing this site with Flutter web would spend effort against that recommendation. Conversely, Flutter rendering does not automatically guarantee excellent selection, typography, accessibility or desktop behavior.

I would migrate in four phases. These are **58–95 agent-days**, with approximately **12–20 supervisor-days** alongside them, excluding store waiting time and production 3D authoring. They are planning estimates, not measured productivity.

1. **Evidence and public-site corrections: 8–12 days.** Run the three spikes below and establish one versioned baseline. The first shippable increment is the corrected public site: fonts, gallery windowing, reader layout scheduling and the blocking functional gaps. Record before/after using identical scans and retain the previous fix’s regression check.
2. **Extract the minimum foundation: 10–18 days.** Begin with passage identifiers, edition/catalogue contracts and immutable data packs. Next extract design tokens, typography/settings primitives, then reader state and rendering with an inline-illustration extension point. Package actual shared behavior; do not first generalize Words’ entire application.
3. **Build World: 25–40 days.** Deliver gallery → picture → passage as one complete increment, then search, four locales, parallel reading, feedback, share and explicit offline downloads. Exercise iPhone, iPad, Mac, Windows and Android from the beginning. iOS/Android are the first installed-app release candidates.
4. **Complete rollout and remove duplication: 15–25 days.** Finish desktop input/accessibility and release rehearsals. Preserve application identities, links, preferences and downloaded-data access through tested migration adapters. Replace copied Words/Sword implementations one package at a time; remove synchronization scripts only after both consumers pass.

For deletion, use an explicit feature allowlist and dependency inspection. Remove an excluded feature only after its routes, startup hooks, background jobs, permissions and storage ownership are accounted for. Preserve relevant tests with their extracted code. A small app consuming packages has a clearer boundary than a mutilated 261k-line application.

The architecture should contain:

- `apps/words`, `apps/sword`, `apps/world`: independent composition roots, identities and release cadences.
- Packages for scripture references, edition/data access, reader state, reader widgets, design, settings, localization infrastructure and platform services.
- Optional feature packages selected through explicit imports and capability interfaces. World must not initialize friends, prayer or Firebase merely because Words uses them.
- A shared content pipeline producing versioned, checksummed packs consumed by Dart and TypeScript. Preserve existing keys, placeholders and approved text bytes. Validate both consumers against common fixtures.
- A public-site consumer that generates substantive scene/passage HTML, metadata and share images, then adds search, reading and PWA behavior. Avoid making it a second implementation of every future native feature.

A fourth app starts from a small composition template, chooses packages and supplies its own identity and content. Shared-package changes trigger tests for affected consumers; they do not force simultaneous releases. [Dart workspaces](https://dart.dev/tools/pub/workspaces) provide dependency coordination, not release orchestration.

Keep Three.js behind a versioned scene interface: load asset manifest, navigate to passage, update camera, report selection, pause and dispose. Bundle renderer code; distribute versioned content packs separately. Keep ordinary reading outside the WebView. Native shells provide input, lifecycle and accessibility integration.

Windows is a specific integration risk: the official [`webview_flutter`](https://pub.dev/packages/webview_flutter) package lists Android, iOS and macOS, not Windows. Prove a Windows adapter before promising universal labs support. Preserve portable glTF assets and scene metadata so a renderer can later be replaced.

I disagree with four dossier implications:

- Counting codebases is an inadequate release-cost model. Measure duplicated behavior, release intervention and platform exceptions.
- “One renderer” does not establish pixel-identical output or selection quality. Official documentation now confirms [desktop Impeller defaults](https://docs.flutter.dev/perf/impeller), resolving that sourcing gap without proving product quality.
- Moving layout work into `requestAnimationFrame` does not inherently eliminate forced layout; callbacks run before paint. The audit’s projected gains require measurement.
- [`flutter_scene`](https://pub.dev/packages/flutter_scene) is a credible experiment, not a long-term dependency decision justified by a feature list. Neither missing Bible-app precedents nor another company’s migration establishes suitability here.

The three fastest experiments are:

1. **Reader and gallery comparison, 4 days.** Compare corrected TypeScript and minimal Flutter implementations on the same physical devices, content and gestures. Pass Flutter only with 100% correct results across 20 selection/copy cases per locale per platform, no missing glyphs, p95 frame intervals ≤20 ms on 60 Hz devices, and <1% intervals above 33.3 ms. Include inline pictures, Psalm 119 and three-edition reading. Failure blocks native migration.
2. **Shared-package and release rehearsal, 3–4 days.** Make one shared reader correction and one World-only change; produce unsigned release-mode artifacts for all four native platforms twice. Pass with all affected checks green, no required unrelated-app release, ≤60 minutes human intervention per run, and at least 30% less intervention than equivalent Tauri rehearsals. Otherwise withdraw C’s release-cost score of 5.
3. **Offline 3D lifecycle, 3–4 days.** Run a representative walk-through, animated figure and panorama through the proposed adapters, including Windows. Pass with p95 frame intervals ≤33.3 ms on the reference Android, ≤20 ms on desktop, offline relaunch working, and memory returning within 10% of baseline after ten open/close cycles. Use reader-accessible cameras and preserve existing geographic/attribution constraints.

I could not verify Words/Sword’s package boundaries, their actual platform quality, or the original Fable ruling: those files are outside the permitted checkout. I also did not verify installed-device performance, signing/submission effort, store outcomes or agent productivity. No proposed spike was executed.

Changed paths: **none**. Tests/builds: **0 executed, 0 passed, 0 failed**; a build would generate files and violate this read-only task.

<details>
<summary>Exact shell commands run; all returned exit code 0</summary>

```bash
cat handoff/README.md
cat handoff/05-decisions.md
cat docs/review/perf-audit-2026-11-04.md docs/review/world-gap-audit-2026-11-04.md
cat docs/review/world-council/01-research-dossier.md
git status --short
rg --files -g 'AGENTS.md' -g '*fable*' -g '*MODEL-RULE*' -g '*council*' -g '*reader*' -g 'package.json' -g 'Cargo.toml' -g '*pipeline*' -g '*release*' -g '*share*' -g '*lab*'
cat docs/review/perf-audit-2026-11-04.md
wc -l docs/review/world-gap-audit-2026-11-04.md docs/review/world-council/01-research-dossier.md
sed -n '1,180p' docs/review/world-gap-audit-2026-11-04.md
sed -n '1,115p' docs/review/world-council/01-research-dossier.md
cat AGENTS.md
sed -n '210,285p' handoff/05-decisions.md
cat package.json
cat src-tauri/Cargo.toml
sed -n '15,52p' docs/review/world-council/01-research-dossier.md
sed -n '181,333p' docs/review/world-gap-audit-2026-11-04.md
rg --files --no-ignore handoff | rg 'fable.*2026-11-03|05-decisions|09-verification'
sed -n '286,380p' handoff/05-decisions.md
sed -n '1,160p' src/reader/types.ts
sed -n '1,140p' scripts/build-gallery-data.mjs
sed -n '1,140p' src/gallery/reader-bridge.ts
rg -n '^##|^###|P5|P6|forced|pixel|renderer' docs/review/perf-audit-2026-11-04.md
sed -n '300,333p' docs/review/world-gap-audit-2026-11-04.md
sed -n '1,130p' handoff/09-verification-playbook.md
sed -n '630,723p' docs/review/perf-audit-2026-11-04.md
sed -n '1,150p' docs/gallery-release-runbook.md
sed -n '1,100p' docs/gallery-shells.md
git status --short
```

Primary-source web lookups supplemented these reads. The legacy Flutter `/web/faq` URL failed; the current URL succeeded. Some lengthy command outputs were truncated.

</details>

Final `git status --short`, unchanged from the initial scan:

```text
?? docs/evidence/perf-2026-11-04/
?? docs/evidence/shell-2026-11/
?? docs/review/open-items-inventory-2026-11-04.md
?? docs/review/perf-audit-2026-11-04.md
?? docs/review/world-build4-backlog.md
?? docs/review/world-council/
?? docs/review/world-stack-decision-2026-11-04.md
```