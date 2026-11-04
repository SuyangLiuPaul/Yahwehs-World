# Fable: should 雅偉之界 / Yahweh's World move to Flutter? Decision memo (2026-11-04)

Written by Fable 5.1 as decider for non-third-party product and architecture decisions. Read-only: nothing committed, built, pushed or deployed. The 2026-11-03 Fable documents in `yahwehs-globe/handoff/` were read and not touched.

**Owner's criterion of 2026-11-04, applied as the top criterion:** sunk cost counts for nothing (「不是关于我们做了多少东西」); what matters is future plasticity and extensibility (「未来的可塑性、可延展性」), then quality ("every version is the last"), all six platforms, and low long-term release cost. He also floated: take Words as the base and delete most of it.

**Evidence read (measured, not assumed):** `globe-shell` at `gallery/shell-1` (`c3f01ae` + perf commit): `src/` 34,451 lines TS in 143 files of which gallery 1,900 + reader 5,783 (2,822 generated catalogue) + shell/platform/core/pwa/config ≈ 1,270 = **≈ 9,000 lines of product code**; the rest (≈ 25,000) is the hidden 3D/globe/walk/voxel/scene-assembly code; CSS 5,440; tests 2,860; `scripts/` 14,732 (data pipeline, stays whatever the stack); `src-tauri` 37 lines of Rust + config. `docs/gallery-shells.md`, `signing-setup.md`, `review/world-gap-audit`, `review/perf-audit`, `review/open-items-inventory` (≈ 95 open items), `review/world-build4-backlog`, `store-listing/world-1.0.0.md`. Words-184: 260,981 lines Dart / 835 files, Flutter 3.47.9, Dart 3.13.7; `lib/design/` 7,970 lines (outward deps: `models/app_settings`, `utils/font_catalog`, `utils/screen_fit`, `constants/motion`, `constants/ui_strings`, `services/device_appearance`, two widgets); `lib/widgets/bible_reading_pane.dart` **12,511 lines, 130 imports, 61 Provider look-ups, 15 services including AI, sermons, cloud auth, reading plans**; `parallel_reader.dart` 1,049; `tools/settings_kit/sync_to_sword.sh` (a `sed` copy of 11 files); 20 workflows; `tools/apple_upload.sh`, `release_web.sh`; `docs/MODEL-RULE.md` §5–6; Sword-184: 267,479 lines. `AGENT-PLAYBOOK.md`.

---

## 0. 给业主的一页摘要（中文）

**结论：改。但不是「把雅伟之言整个搬过来再删」，而是三个 app 一个仓库、一套共享 Dart 包，雅偉之界做成架在这套包上的「薄 app」。网页公开站继续用现在的 TypeScript 静态站（它负责 SEO、分享卡、PWA），由同一份数据包驱动。3D 以后作为一个 WebView 功能模块装进 Flutter app（跑的就是仓库里现有的 three.js 代码），等 Flutter 自己的 3D 成熟再换。**

为什么（按你的优先级）：

1. **可塑性。** 你以后的新功能、新 app 绝大多数是「圣经 + 设计语言 + 六个平台 + 三家商店」这一类。现在 Words 和 Sword 之间连「设置页」都要靠一个 sed 脚本同步，再加一个 TypeScript 的雅偉之界就是三套代码、两种语言、两条发布线，每个新功能做两遍。共享包（设计套件、阅读器核心、数据包、多语言、发布流水线）之后，第四个 app 是 `apps/` 下新建一个目录、填一份清单，不是再写一遍。
2. **质量。** 你自己在 TestFlight build 3 上看到的「字还是太丑」，不是一两个 CSS 能彻底解决的：WKWebView 里的中文排版、复制粘贴、系统字号、原生分享，都是在 WebView 里一项项追，而 Words 里这些本来就是对的。苹果 4.2「网页套壳」风险也随之消失。
3. **发布成本。** Words 已有 Play AAB、Mac Store、Windows MSIX、Apple 上传、网页发布的全部流水线；雅偉之界的 Tauri 壳三条 CI 一次没跑过，Windows 一次没编出来，Android 每个 ABI 要多塞 90 MB。改成 Flutter 之后它直接用同一套。
4. **3D 不是反对理由。** 不管哪种架构，原生 app 里的 3D 都是在 WebView 里跑 three.js（Tauri 本身就是 WebView）。区别只在 Windows：Flutter 的 Windows WebView 不成熟，3D 在 Windows 上先交给浏览器打开，直到 Flutter 自家 3D 可用。

**这推翻了我 11-03 的裁决。** 那次的目标是「复用全部现有代码、2–3 天上全平台」；你今天把这个目标拿掉了。目标变了，答案就变了；另外两天的实测也证明 2–3 天的估计错了（Windows 没编出来、约 95 项未完）。

**代价要说清楚：** 原生 1.0.0 从「还差一周」变成「还差 5–7 个 agent 周」。扔掉的是 Tauri 壳和它的脚本（约 1,500 行 + 配置）。**不扔**的是：1,443 幅画和数据、四语字幕、教会用词闸门、商店记录与签名、性能结论、three.js 的 3D 代码、整个 TypeScript 网站（它就是公开站）。

**不要「搬 Words 再删」。** Words 的阅读面板一个文件 12,511 行、130 个 import、61 处全局状态读取、依赖 15 个服务（含 AI、讲道、云登录）。搬过来删，删到最后还是一个 10 万行、和 Words 一起漂移的第三份副本。只搬「壳」（android/ios/macos/windows/web 工程、tools、workflows、签名配置），不搬 `lib/`。

**你现在要定的（§6）：** ① 雅偉之界原生版 = Flutter，Tauri 壳不送商店（TestFlight 里的 build 1–3 留着当内测）；② 现有 TS 网站作为公开站先发（你说 release 时）；③ 同意开一个 monorepo（建议名 `yahweh-word`），Words/Sword 在 1.8.4 发完后逐包迁入；④ Windows 上的 3D 先用浏览器打开；⑤ World 不另发 Flutter 网页版（网页就是 TS 站）。

**本周三件事（§8）：** 停掉 Tauri build 4 / Windows 工作；写包边界规格（阅读面板 130 个 import 逐个归类：进包 / 注入 / 丢弃）；给 Words 的阅读面板和设计套件补特征测试（golden），再动任何一行。

---

## 1. Recommendation (one paragraph)

**Move World's native apps to Flutter, built as a thin app on a shared Dart package set that Words and Sword also adopt (monorepo), keep the existing TypeScript static site as the public web/PWA/share layer fed by the same data packs, and host future 3D as a WebView feature module running the repository's three.js code until Flutter's own 3D is production-grade.** Ranked by the owner's priorities: (1) *plasticity*: the owner's future is three (then four) apps sharing one design language, one reader, one data model, four-plus UI languages and three stores; a TypeScript World makes every such feature a two-language job forever, while shared packages make a new app a directory and a manifest. (2) *Quality*: the shell's defects are the WebView's (CJK text the owner rejected on build 3, `navigator.clipboard` silently failing in WKWebView, system text size not honoured, no native share, Apple 4.2 exposure); Words already has those right natively. (3) *All platforms*: Words' pipelines cover six platforms and three stores today; World's Tauri CI has never run and Windows has never been built. (4) *Release cost*: one pipeline family instead of two; one kit instead of a kit plus a sync script plus a CSS token file. The price is real and stated in §3: native World 1.0.0 moves from roughly one agent-week away to **5–7 agent-weeks** away, and ≈ 1,500 lines of shell code plus the Tauri configuration are discarded. **Do not** "fork Words and strip": it produces a third 100k-line copy that drifts; fork only Words' platform scaffolding and pipelines (§4.2).

## 2. What is reusable regardless, and what is actually discarded

| Kept, whatever the stack | Discarded by the move |
|---|---|
| 1,443 pictures (thumb + full, hashed), `pictures.json`, LQIP; captions/titles/summaries ×4 languages; `summary-overrides.json`; the zh-Hant conversion tables and `audit-zh-hant.mjs` | `src-tauri/` (37 lines Rust, 5 config overlays, capabilities, entitlements, icons), `tools/release_mac.sh`, `release_ios.sh`, `build_android.sh`, `build_apk.sh`, `pack_shell_content.sh`, `tools/shell/*_patch.py`, `packaging/msix/` |
| Eight editions pinned by SHA to Words' bytes (`sources.lock.json`), headings, the licence/credit strings and the no-1919 test | `src/platform/` (361), `src/shell/` (146), `src/core/packs.ts` (158), `scripts/shell-dist.mjs`, `vite-shell-target.mjs`, `verify-shell*.mjs`, `tests/shell|platform|core` (≈ 1,500 lines TS in all) |
| Church-vocabulary gate (`scripts/lib/church-vocabulary.mjs`, `tests/reader/wording.test.ts`) — becomes a shared conformance fixture both the Dart reader and the TS site run | `.github/workflows/shell-*.yml` (never run) |
| Store records and signing: ASC app 6830164556, bundle id `com.yahwehword.world`, Apple Distribution `V6D4VV2K24`, Mac Installer `5733XK5344`, profiles `495RSHVC2W`/`GPHFL27772`, Android upload keystore, MS identity reservation plan; store listing text ×4 ×3 stores | `docs/gallery-shells.md` (becomes history), the TestFlight builds 1–3 (keep as internal tests; never submit) |
| Perf findings (fonts/unicode-range, cache headers, virtualisation, forced reflow, backdrop-filter) — apply to the site; the Flutter app gets virtualisation and a text engine for free | The three Tauri IDs decisions? No: `com.yahwehword.world` is reused by the Flutter app. Only the GitHub-APK id `com.yahwehsworld.globe` dies with the old APK line |
| The whole TypeScript site (`src/gallery`, `src/reader`, `src/pwa`, CSS, Playwright audits, `scripts/`) as the public web layer | — |
| The three.js world (≈ 25k lines TS, GLB figures, globe data) — the future 3D module in either architecture | — |

Net: about 1,500 lines of code, two days of shell work and the shell docs. Everything the owner paid for in content, data, rules, accounts and keys survives.

## 3. Options compared

Effort is in agent-days with Codex/Gemini writing most code and Claude specifying, running `flutter` (serial), reviewing. "Store quality" = passes the premium bar, the gap-audit class of checks, and is submittable on iOS/iPadOS/macOS/Android/Windows.

| | **A. Keep Tauri 2 + TS for everything** | **B. All Flutter, apps and web** | **C1. Fork Words, strip** | **C2. Shared Dart packages + thin World app + TS site + WebView labs (recommended)** |
|---|---|---|---|---|
| Cost to store quality | **8–12** (close ≈ 95 open items, build 4, Windows needs a Windows machine, share plugin per platform, offline sheet) | **35–45** (as C2 plus a Flutter-web public site and SEO workarounds that never fully work) | **12–18** to a running app; then **+10–20 per year** of drift (three copies) | **25–35**: package boundary spec 2; characterisation tests in Words 3; `yw_design` + settings kit extraction 3–4; **`yw_reader` 8–12** (not a move: a new 4–6k-line reader built from Words' render/verse/headings/copy/picker code; the 12.5k-line pane is not liftable); World app screens (home, grid, scene, search, feedback, i18n, offline packs, deep links) 6–8; store packaging on Words' pipelines 2; site slimming 1–2 |
| Long-term release/maintenance | Two stack families (Dart ×2 apps, TS ×1), two pipeline families, two kits; every cross-app feature twice | One stack, one pipeline; but the web is Flutter's weakest target and the public site suffers permanently | Worst: 3-way `sed` sync, three 100k+ trees, every fix ported twice by hand | **Lowest**: one kit, one reader, one data contract, one CI matrix; Words/Sword shed their sync script; site is static and data-driven |
| Risk | Apple 4.2 (web clip); WKWebView text/copy/text-size quirks (owner already rejected the type); Windows unbuilt; per-ABI 90 MB; no CI | Flutter web ≈ 2–3 MB runtime before content, no crawlable HTML, `/p/<id>` previews need a separate prerender anyway | Hidden coupling (61 Provider reads, Firebase, GetX) survives deletion; a "strip" that compiles still carries Words' bugs | Extraction while Words is mid-1.8.4 (62 UI + 31 perf fixes in flight): mitigated by ordering (§5.1); two readers (Dart app, TS site) must agree: conformance tests on shared fixtures |
| Quality ceiling (iOS/iPad · Mac · Android · Windows · web) | 3 · 3 · 3 · 3 · **5** | 5 · 5 · 5 · 5 · 2 | 5 · 5 · 5 · 5 · 5 (web = site) at first; decays | **5 · 5 · 5 · 5 · 5** (web = the TS site) |
| 3D future | 5 in-stack three.js, but still a WebView on every native platform | 3: WebView island on iOS/Android/macOS; Windows gap; flutter_scene later | as C2 | **4**: `yw_labs` WebView module hosts the three.js world (iOS/Android/macOS via webview_flutter); Windows opens the site in Edge until flutter_scene/Flutter GPU is stable; shared deep-link and prefs bridge |
| SEO / share / PWA | 5 | 1–2 | 5 (site kept) | **5** (site kept, slimmed) |
| Share of work Codex/Gemini can do | ≈ 90 % (node tests run offline) | ≈ 55 % (writes Dart; cannot run `flutter`; pure-Dart packages may be `dart test`-able — unverified) | ≈ 55 % | ≈ 60–65 %: pure-Dart packages (`yw_data`, `yw_i18n`, reader model, church gate) are Codex-friendly; widgets need Claude to run tests via `serial.sh` |
| Thrown away | nothing now; the future pays | 34k TS + the site + its 334/169/74 checks | nothing of Words; architecture | ≈ 1,500 lines of shell code + Tauri config (§2) |
| Plasticity (owner's top criterion) | **Low**: a fourth app or any cross-app feature is written twice | High for apps, low for web | **Lowest** (copies) | **Highest** |

**Verdict: C2.** B loses on the public web, A loses on plasticity and native quality, C1 is C2's bootstrap at best.

## 4. Architecture

### 4.1 Monorepo and package set

One git repository (proposed `yahweh-word`), Dart pub workspace (Dart ≥ 3.5; Words is on 3.13), apps and packages side by side. Data packs live outside git (as World already does: T7 + hash lock), fetched by hash at build.

```
yahweh-word/
  apps/
    words/      apps/sword/      apps/world/      (apps/<fourth>/ later)
    _template/  # the scaffold a new app is copied from (§4.4)
  packages/
    yw_design        tokens, palettes, type scale, sheets, bars, large-title, skeleton, reduce-motion, paper theme, Apple-platform helpers (from Words lib/design 7,970 lines; its 11 outward deps become `yw_design`'s own `AppearanceSettings` interface or move in)
    yw_settings      the settings kit (already a straight copy Words→Sword; the sync script is deleted the day this lands)
    yw_scripture     pure Dart: books, versification, references, edition catalogue + licence rows, headings sets, verse/paragraph/footnote model, copy rule (`decorateCopy`), church-vocabulary gate, zh-Hant rules. Codex-testable with `dart test`.
    yw_reader        Flutter: reading pane (verse / paragraph / parallel ≤ 3), picker, Aa sheet, section headings, inline plate slot, selection + action bar. Built new from Words' donor code; Words and Sword replace their panes with it in phases.
    yw_data          pack manifest + downloader + verifier (from Words `offline_pack_service` 558 lines + World `packs.ts` semantics), remote image with per-host failure memo (`remote_image.dart` 269), deferred pages.
    yw_i18n          loader + plural rules + the `tools/i18n/translate` pipeline and checker; language list and term sheets (divine-name forms per language) as data.
    yw_platform      deep links, update check, share, open-external, device appearance, notifications gate; per-platform plugins behind one interface.
    yw_labs          WebView feature module: hosts a URL of the TS site (3D world) with a JS bridge for locale, theme, deep link and "open in reader"; falls back to `openExternal` where no WebView (Windows).
    yw_release       not Dart: the workflow templates (`play-aab`, `mac-store-archive`, `windows-store-msix`, `release-ios`, `release-macos`, `release-windows`, `release-web`), `apple_upload.sh`, MSIX config generator, version/tag rules, store-listing checker; each app contributes one `release.yaml` (ids, identities, tracks).
  site/            the TypeScript public site (today's src/gallery + src/reader + pwa, Vite); consumes `yw_scripture`'s generated JSON and `yw_data`'s pack manifests; never depends on Dart.
  data-pipeline/   today's scripts/ (pictures, captions, zh-Hant, headings, events) — Node; emits the packs both the apps and the site read.
  conformance/     fixtures run by BOTH readers: headings per edition, copy output, banned vocabulary, licence strings, reference parsing.
```

Rules enforced by tests: `apps/* → packages/*` only; `packages/yw_*` never import an app; `yw_scripture` is pure Dart (no `flutter:` import) so Codex can test it; `site/` reads only generated data; a feature flag file per app (`features.json`) switches modules (reader, gallery, labs, notes, songs, sermons, AI…) on or off.

### 4.2 Why not "fork Words and strip" (the owner's floated path)

Measured: `bible_reading_pane.dart` is 12,511 lines with 130 imports, **61 Provider/context look-ups** and 15 services (AI word service, AI edition gate, sermons, commentary, cloud auth, reading plans, maps, synopsis…). A copy of Words that compiles after deletion still carries this coupling; the pane cannot be "deleted down" to a gallery reader without rewriting its interior. The result is a third 100k-line tree (Words 261k, Sword 267k) kept in step by hand, exactly the pain the owner wants to end. **What *is* worth forking from Words is the shell, not the lib:** `android/ ios/ macos/ windows/ web/ linux/`, `tools/` (upload, release, i18n), `.github/workflows/`, `pubspec` build sections (`msix_config`, `flutter_launcher_icons`), `analysis_options`, `docs/MODEL-RULE.md` and `release-policy.md`. That is one day and gives World six platform projects and the pipelines on day one.

### 4.3 How this also simplifies Words and Sword

- `tools/settings_kit/sync_to_sword.sh` and the `--check` CI step disappear; the kit is one package.
- The design kit's eleven outward imports (`app_settings`, `font_catalog`, `screen_fit`, `motion`, `ui_strings`, `device_appearance`, two widgets) become one `AppearanceSettings` interface each app implements — the same adapter pattern Words already uses for the settings surface (`settings_surface_adapter.dart`).
- One reader: Sword's reader (hidden behind `kChapterReaderAvailable=false`) and Words' pane converge on `yw_reader`; the parallel-mode and picker work done twice in October is done once from now on.
- One i18n pipeline, one term-sheet, one church-vocabulary gate for all apps and the site.
- One CI matrix: `apps/*` × platforms; a store fix (e.g. the `playAppId` trick, the MSIX store flag, the ASC upload script) is made once.
- Shared checkouts: the memory note that several sessions edit the Words checkout concurrently gets worse in a monorepo — the rule becomes "one worktree per session" (already practice under `/Volumes/androidbuild`).

### 4.4 A fourth app, later

`cp -r apps/_template apps/<name>`; fill `app.yaml` (name ×languages, ids, store identities, feature flags, colour accent, editions list); add icons; add one row to the CI matrix; create the three store records (owner). Target: a first TestFlight build in **one agent-day**. The template carries the six platform folders, the release workflows, the privacy page generator and the review-page skeleton.

### 4.5 Future 3D and other modules

- **Now and for 1.x:** `yw_labs` hosts `https://world.yahwehword.com/globe` (and walks, figures, panorama) in `webview_flutter` on iOS/iPadOS/Android/macOS, with a bridge for locale/theme/deep links and offline caching of the pack through `yw_data`. It is the same three.js code the Tauri shell would have run; Tauri's advantage here was only that it was one WebView instead of an island.
- **Windows:** `webview_flutter` has no first-party Windows implementation; community `webview_windows` (WebView2) exists and is thinly maintained (not verified at today's version). Policy: Windows opens the 3D page in the default browser until either that plugin is proven or Flutter GPU/`flutter_scene` is stable; the gallery and reader are native on Windows regardless.
- **Later:** when `flutter_scene` leaves preview, a `yw_scene` module can load the same GLB/KTX2 packs natively; the feature-module interface does not change.
- **Other futures** (notes sync, songs, sermons, AI, car/watch): they already exist in Words as features; under the package set they become modules that any app switches on.

### 4.6 The public site

The long-term architecture is **a separate, lightweight, static site generated from the same data packs** — which is what `site/` (today's `src/gallery` + `src/reader` + `pwa`) already is once the Tauri/platform code is removed. It owns: crawlable HTML for 1,443 scenes, `/p/<id>` share stubs and OG cards, sitemap, PWA install and offline for what was seen, the reader for people who will not install an app, and the 3D pages. It does **not** grow app-only features (accounts, notes, packs manager); when a feature is needed on both, the rule is "data and rules shared through generated JSON and `conformance/`, UI written twice on purpose." Flutter web for World is **not** published: a second web surface would confuse links, and Flutter web cannot do the site's job. (Words' own Flutter web stays as it is; that is Words' decision.)

## 5. Migration plan

### 5.1 Order, and what ships when

| Phase | What | Ships |
|---|---|---|
| **0 — this week** | Decision recorded; stop Tauri build 4 / Windows / notarisation work (inventory batch W3) and the 3D-hooks half of W4; keep W1 (web code batch), W2 (store paperwork: reusable), W5 (languages/content), W6 (web release). Package boundary spec (Opus medium): every one of the pane's 130 imports and the kit's 11 classified as *package / inject / drop*. Characterisation tests in Words around the pane and kit (goldens at 375/768/1440, three themes, zh/en). | **Web release of the TS site as the public site** when the owner says 「release」 (it is needed anyway: privacy URL, 404, fonts, app links). |
| **1 — weeks 1–2** | Monorepo skeleton; `apps/world` from Words' platform scaffolding (bundle id `com.yahwehword.world`, existing certs/profiles/keystore, workflows parameterised); `yw_design` + `yw_settings` extracted **after** the 62 UI / 31 perf fixes land in Words (extract the fixed kit, not the one being fixed); `yw_scripture` (pure Dart) from Words' books/references/catalogue/headings/copy code + World's `catalogue.gen` facts; `conformance/` fixtures. | World dev build: home + scene grid (virtualised) + scene page with picture; design parity with Words. |
| **2 — weeks 3–5** | `yw_reader` built from donor code (verse/paragraph/parallel, picker, Aa, headings, selection + copy with credit line, inline plate slot); `yw_data` (packs: thumbs 48.9 MiB bundled, Bible data 36.7 MiB, full pictures as a pack with real byte counts, `storage` estimate, progress, cancel); `yw_i18n` with the four languages from World's strings + Words' pipeline; `yw_platform` deep links (`/p/<id>`, universal/app links already configured server-side in W1), native share, system text size; feedback sheet to the existing Netlify function. | **Smallest first Flutter release = native World 1.0.0** to TestFlight (iOS/iPadOS/macOS), Play internal, Windows MSIX artifact: home, scenes, scene+passage, reader with inline plates, search, feedback, four languages, offline packs, deep links. Store submission on 「release」. |
| **3 — after Words/Sword 1.8.4 ship** | Words then Sword adopt `yw_settings` (delete the sync script), `yw_design`, then `yw_reader` behind a flag per app; Sword's hidden reader becomes the shared one. | Words/Sword 1.9.x on packages. |
| **4 — when the owner asks for 3D** | `yw_labs` WebView module over the site's 3D pages; Windows browser hand-off; packs through `yw_data`. | World 1.1 with 3D; no shell change. |

### 5.2 What in Words must be fixed before the split

1. Finish the in-flight **62 UI-audit defects and 31 perf causes** in Words first, then **freeze** `lib/design/` and `bible_reading_pane.dart` for extraction; extracting during those fixes doubles every merge.
2. Characterisation tests (goldens + widget tests) around the pane and kit — the move is checked against them, not against eyes.
3. Break the kit's eleven outward imports into one injected `AppearanceSettings`/`AppStrings` interface; break the pane's 61 Provider reads into constructor parameters or a `ReaderController`; nothing in `yw_reader` may import Firebase, GetX, AI, sermons or cloud auth (the 15 services become optional "verse actions" the app registers).
4. Replace `google_fonts` runtime fetch in the kit with the bundled Noto subsets (`tools/subset-fonts.sh`) so the package is offline-correct for every app.
5. Keep versions untouched (no bump without a release) and one Opus agent at a time (MODEL-RULE); the extraction is Sonnet-high implementation to an Opus-medium spec, with a different Sonnet-high reviewer.

### 5.3 Safe deletion / extraction procedure (applies to the scaffold fork and to the package moves)

1. Work in a fresh clone under `/Volumes/androidbuild`; never in the shared Words checkout.
2. Copy only `android/ ios/ macos/ windows/ linux/ web/ tools/ .github/ analysis_options.yaml docs/MODEL-RULE.md docs/release-policy.md`; rename package, ids, display names, `msix_config`, icons. **Do not copy `lib/` or `assets/`** (Words' assets are 596 MB; World needs eight editions, headings, the scene catalogue and its own fonts).
3. After every step: `flutter analyze` + `flutter test` through `serial.sh` (one suite at a time: concurrent runs give phantom `ink_sparkle.frag` failures), app size recorded, `git commit --only` the touched paths.
4. Extraction order: leaf first — `yw_settings` (no deps) → `yw_design` (deps resolved by the interface) → `yw_scripture` (pure Dart, `dart test`) → `yw_data` → `yw_reader` → `yw_platform`. Each lands in Words behind a path dependency and a flag before the old code is deleted; delete only when the goldens pass with the package in place.
5. Removals in Words/Sword later: delete the local copy only after one release has shipped on the package.
6. Checks that must stay green throughout: church-vocabulary gate, no-1919 test, licence strings, headings-from-BSB rule, `verify:fonts`, size budgets (World app ≤ 100 MB content), the premium-bar golden set.

## 6. Decisions the owner must make, and the reversal flags

**Decisions**
1. Confirm: native World = Flutter on shared packages; the Tauri shells are **not** submitted to any store (TestFlight builds 1–3 stay as internal tests). The ASC app, bundle id, certificates, profiles, keystore and listing text are reused.
2. Say 「release」 for the TS site as the public web (needed by every store form anyway).
3. Monorepo yes/no and its name (`yahweh-word` proposed); Words/Sword migrate after 1.8.4 ships.
4. No Flutter-web surface for World; the site is the web platform.
5. 3D on Windows opens in the browser until Flutter 3D or a proven WebView2 plugin; accept.
6. Timing: native World 1.0.0 moves from ≈ 1 week to ≈ 5–7 agent-weeks; accept that the gallery is web-only in the meantime.

**Reversal flags (my own 2026-11-03 rulings)**
- Reverses `fable-gallery-all-platforms` §10.2 (stack ranking) and §11 (Tauri 2 for all four shells), and §4's "never a second codebase of the gallery as Flutter".
- **What justifies it, plainly:** (a) the owner removed the objective that ranking optimised for — reuse of all existing code and a 2–3-day path (reuse was weighted ×3; with it at zero the old table still favours TS, so the honest statement is that the *criteria* changed, not only the weights: cross-app sharing, a fourth app, and one release pipeline were not criteria on 11-03 and are the top criterion now); (b) two days of measured evidence: the shells' CJK type was rejected by the owner on build 3, WKWebView clipboard writes silently failed, system text size and native share are unbuilt, Windows was never built, CI never ran, Android embeds 90 MB per ABI, ≈ 95 items remain open — the "2–3 agent-days" estimate was wrong; (c) the 3D argument was overweighted: on every native platform 3D is a WebView in either architecture, so it discriminates only on Windows.
- **Not reversed:** the web must remain a first-class, static, SEO-capable site (11-03 §4, §10); the eight editions, licence wording, church rules, product naming and per-language names; "release only when told".
- Standing owner reversals still pending from the inventory (nav order Home·Bible·Scenes; paper surface on home) are unaffected and still need his word.

## 7. Risks

1. **Extraction regressions in Words** mid-release — mitigated by freezing after the 62/31 fixes, goldens first, flags, one release on the package before deletion.
2. **Two readers diverge** (Dart app vs TS site) — `conformance/` fixtures run in both CIs; headings, copy output, banned words, licence strings, reference parsing.
3. **Codex cannot run `flutter`** — keep heavy logic in pure-Dart packages; Claude runs widget tests serially; budget ≈ 35 % of World work for Claude-run tests and review. Whether Codex's sandbox can run `dart test` is **unverified**; test it in week 1.
4. **Apple review of a new app** is unchanged by the stack (3 new store records, Play's 12 testers × 14 days); the 4.2 risk disappears.
5. **Disk**: `/Volumes/androidbuild` is at 71 % (44 GiB free) after the Tauri targets were cleaned; Flutter builds for six platforms need headroom; clean `src-tauri/target` for good.
6. **Owner expectation**: the gallery was "almost on every device"; after this decision it is on the web now and native in 5–7 weeks. Say it once, clearly.
7. **Monorepo and shared checkouts**: more sessions in one tree; enforce one worktree per session.

## 8. First three concrete steps this week

1. **Stop and redirect (today):** cancel inventory batch W3 (shell build 4, Windows, notarised DMG, GitHub APK) and the 3D-hooks part of W4; keep W1/W2/W5/W6 for the web release. Record in `world-build4-backlog.md` that build 4 is not made. Reassign the Codex worker to the site's perf fixes P1–P3 (fonts, cache headers, `content-visibility`), which the public site needs regardless.
2. **Package boundary spec (Opus medium, 1 day):** from the measured import graphs (pane 130, kit 11), a table of every symbol → `yw_design | yw_settings | yw_scripture | yw_reader | yw_data | yw_platform | inject | drop`, the `AppearanceSettings` and `ReaderController` interfaces, the `features.json` schema, the `app.yaml` schema for `apps/_template`, and the conformance fixture list. Mock-ups are not needed for this; it is architecture.
3. **Characterisation tests in Words (Codex writes, Claude runs via `serial.sh`, 2–3 days):** goldens of the reading pane (verse/paragraph/parallel, zh-Hans/zh-Hant/en/ru, three themes, 375/768/1440) and the settings/design kit specimens, committed in Words before any file moves. In parallel, one agent verifies in the Codex sandbox whether `dart test` runs for a pure-Dart package (decides how much of `yw_scripture` Codex can own).

## 9. What I could not verify

- Whether Codex's sandbox can run `dart test` (only `flutter` is known to hang).
- Current macOS/Windows status of `webview_flutter`/`webview_windows` at Flutter 3.47.9; the Windows hand-off policy above assumes the pessimistic case.
- Flutter 3.47 web (CanvasKit/wasm) payload for a World-sized app; the SEO/HTML limitation does not depend on the number.
- The real effort of `yw_reader`: the 8–12 agent-days is an estimate from the pane's size and coupling, not from a spike; the week-1 spec will narrow it.
- The state of the Play and Partner Center records (inventory marks them unverified); nothing here depends on them.
- The owner's timing for the 62 UI / 31 perf fixes in Words; Phase 1's kit extraction waits for them.
