# POSITION PAPER: Architectural Foundation for 雅偉之界 (Yahweh’s World)

**To:** Council Overseer (Paul Liu)  
**From:** Multi-Model Design Council (Gemini Voice)  
**Date:** 2026-11-04  
**Subject:** Long-Term Technical Architecture for Yahweh’s World and Future Ministry Applications  

---

### 1. Recommendation

Adopt an **Amended Option C (Clean-Core Dart Monorepo + Headless Web/SEO + Modular 3D Facade)**. Reject Tauri 2 for native releases: maintaining three diverging webview engines across four native OS stores imposes a permanent jank and maintenance tax that breaks your quality ceiling. Reject Option B (all-Flutter including web): Flutter Web remains an architectural dead end for public search indexing, social unfurl previews (Open Graph), and first-contentful-paint latency. Reject "fork-and-strip Words": cloning a 261k-line codebase saddled with a 12,511-line, 61-Provider reading pane will choke Codex and Gemini in cascading compile breaks. Instead, build a **Melos-governed monorepo** containing `Words`, `Sword`, and a newly scaffolded `World` that shares extracted leaf packages (`design_system`, `bible_engine`, `content_store`, `ci_pipelines`). Retain the existing Vite/TypeScript codebase solely as a lightweight, static-first web/PWA/SEO shell consuming the identical compiled JSON/SQLite scripture-art pack. Implement 3D via a decoupled interface that boots an offline Three.js WebGL canvas inside a native platform view today, preserving immediate asset interchange with the web site while allowing a zero-overhead drop-in replacement with `flutter_scene` once that engine achieves 1.0 stability.

---

### 2. Scoring of Options A–D Against Council Criteria

Scored 1 (Best) to 4 (Worst) based on long-term value, with sunk cost counted as zero.

| Criterion (Priority Order) | Option A: Tauri 2 + TS Everywhere | Option B: Flutter Rewrite Everywhere (incl. Web) | Option C+: Flutter Native + TS Web/SEO + 3D Facade | Option D: KMP / React Native / Per-Platform Native |
| :--- | :---: | :---: | :---: | :---: |
| **1. Extensibility & Long-Term Release Cost** *(Top)* | **3** — Triplicated webview bugs across mobile; separate build system from Words/Sword. | **2** — Single language, but Flutter Web workarounds create parallel maintenance debt. | **1** — One CI/CD pipeline, shared Dart packages across 3+ apps, unified desktop/mobile engine. | **4** — Introduces a foreign runtime (Kotlin/TS/C#); fragments CI and discards Words’ assets. |
| **2. Quality Ceiling on Every Platform** | **3** — Bound to WebKit/WebView2/Android WebView quirks; measured 89% dropped frames on grid. | **1** — Hardware-accelerated Impeller across macOS/iOS/Android/Windows; pixel-exact typography. | **1** — Impeller native quality on iOS/Android/macOS/Windows; native HTML DOM text selection on web. | **2** — High on mobile, but desktop Windows/macOS experience is second-class in RN/Capacitor. |
| **3. Cost to Reach Store Quality** | **2** — UI is written, but eliminating 337ms reflow jank and passing Apple 4.2 review requires heavy refactoring. | **3** — Complete rewrite of 1,443-image grid, reader, search, i18n, and web prerendering engine. | **2** — Clean Flutter native rewrite importing existing Words CI/signing; existing web site kept untouched. | **4** — Complete rewrite on an unfamiliar platform with zero reusable ministry assets. |
| **4. Future Features & 3D (Walk-throughs)** | **2** — Three.js is mature and runs in webviews, but high-draw-call native scenes will suffer memory throttles. | **3** — `flutter_scene` is pre-1.0 (v0.24.3) with breaking minor releases; Unity/Godot embeds are broken. | **1** — Dual-adapter architecture: stable Three.js in webview now, zero-churn swap to `flutter_scene` later. | **3** — RN/KMP 3D bridges are brittle, undocumented, or require heavy C++ platform channels. |
| **5. Ability to Spin Up Further Apps** | **3** — Web kit is isolated; cannot tap into Words/Sword study packages or offline SQLite stores. | **1** — Melos package registry enables new apps in days via standard Dart dependency graphs. | **1** — Monorepo workspace yields a template `app_scaffold` linking shared design, reader, and sync. | **4** — High marginal engineering cost for every successive product. |
| **6. SEO / Share / PWA for Public Web** | **1** — Vite/TS site is indexable, fast, and unfurls rich social preview cards natively. | **4** — CanvasKit/Wasm canvas is opaque to web crawlers; prerender tools are brittle hacks. | **1** — Public web remains Vite/SSR with static meta tags; instant page loads and universal PWA support. | **3** — RN Web / Compose Web have identical crawler indexing and bundle bloat penalties. |
| **7. Friendliness to AI Coding Agents** | **2** — TS is highly capable in Codex, but Tauri Rust bridges confuse agents. | **2** — Dart analyzer catches errors, but agent test-concurrency bugs and build runners cause churn. | **1** — Pure Dart packages allow Codex to run unit tests offline without Flutter sandbox constraints. | **3** — Multi-language bridges (Kotlin/Swift/C++) dramatically degrade agent autonomy. |
| **8. Platform & Execution Risk** | **3** — Tauri mobile is "closer to alpha"; Android system WebView divergence across OEM devices. | **3** — Total web rebuild risks losing web visibility; Impeller Windows Vulkan regressions on older GPUs. | **2** — Low risk on native (proven by Words/Sword); zero risk on web (leverages existing site). | **4** — High organizational risk from stack sprawl and zero internal organizational knowledge. |

---

### 3. Recommended Migration Path: Clean-Room Assembly (Not Fork-and-Strip)

#### The "Fork Words" Trap
Do **not** clone Words to build World. Words' `bible_reading_pane.dart` is an architectural tar pit: 12,511 lines, 130 imports, and 61 Provider bindings. If an AI coding agent attempts to strip sermons, prayer, and sync from this monolith, the cascade of broken imports and unresolved state bindings will consume dozens of unproductive agent cycles. 

Instead, adopt **Clean-Room Assembly**: extract leaf contracts into isolated packages, then construct World from the ground up inside the monorepo.

```
                    ┌─────────────────────────┐
                    │  Shared Foundation PKGs │
                    │ (design, bible_core, ui)│
                    └────────────┬────────────┘
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Yahweh's Words  │     │ Yahweh's Sword  │     │ 雅偉之界 (World) │
│ (Full Study/Dev)│     │ (Workbench/Lex) │     │ (Clean Flutter) │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                        Shared Content   ▼
                                        Pipeline Pack ──────► Vite/TS Web
                                                              (SEO/Share/PWA)
```

#### Phased Execution Schedule (Estimated ~54 Agent-Days)

*Assumptions: Claude plans and supervises; Gemini performs large edits; Codex runs automated offline Dart unit tests; human reviews and signs off.*

* **Phase 0: Monorepo Foundation & Tooling Setup (Days 1–5)**
  * Establish a Dart/Flutter workspace with Melos at repo root.
  * Move shared GitHub Actions, signing configurations, and Fastlane pipelines into `.github/workflows/reusable/`.
  * *Deliverable:* Green unified CI checking `pubspec.yaml` resolution across `apps/` and `packages/`.
* **Phase 1: Extraction of Pure Dart Leaves from Words (Days 6–14)**
  * Extract `packages/bible_models` (canonical references, versification, parsing) — zero Flutter dependencies, 100% offline-testable by Codex.
  * Extract `packages/design_tokens` (color palette, typography curves, spacing contracts).
  * Extract `packages/world_art_pack` (metadata indices for the 1,443 scenes, image CDN resolvers, localized tags).
  * *Deliverable:* Independent Dart packages with >90% test coverage run via `/Volumes/androidbuild/tools/serial.sh`.
* **Phase 2: Scaffolding Clean `apps/world_flutter` (Days 15–24)**
  * Initialize a bare Flutter application importing `design_tokens` and `world_art_pack`.
  * Build the 1,443-card gallery grid using `CustomScrollView` and `SliverGrid` with fixed-extent virtualized builders and tuned `cacheWidth/cacheHeight` constraints.
  * Implement offline caching via `cached_network_image` backed by disk storage.
  * *Deliverable:* Smooth 60fps scrolling on low-end Android hardware; memory ceiling capped under 180MB.
* **Phase 3: Clean Reader Assembly & Search (Days 25–36)**
  * Implement `WorldReadingPane` using pure `SelectionArea` and decoupled sliver lists. Display scene art inline at the target anchor verse without pulling in Words' study provider tree.
  * Implement search using an embedded SQLite FTS5 database (pre-indexed during CI pipeline build).
  * Wire 4-language i18n (`en`, `zh-Hans`, `zh-Hant`, `ru`) matching existing ARB files.
  * *Deliverable:* Keystroke search latency dropping from 798ms to <30ms; native text copy/selection functioning flawlessly across desktop and mobile.
* **Phase 4: Store Compliance, Desktop Shells & Web Sync (Days 37–46)**
  * Validate Apple App Review Guideline 4.2 compliance: ensure rich local interactions (offline mode, smooth pan/zoom on scene art, native share sheets).
  * Package desktop targets (macOS DMG via existing notary scripts, Windows MSIX).
  * Connect the existing Vite web pipeline to ingest the exact same `world_art_pack` JSON export.
  * *Deliverable:* TestFlight build and staging Netlify web deployment in full parity.
* **Phase 5: 3D Scene Viewport Facade (Days 47–54)**
  * Implement the `World3DViewport` interface.
  * Embed an offline WebView running the existing Three.js viewer as the primary renderer.
  * Build an experimental feature-flagged `flutter_scene` renderer for desktop platforms.
  * *Deliverable:* Offline rendering of sample 3D model (Ark/Tabernacle) within the Flutter shell.

---

### 4. Target Architecture for Long-Term Extensibility

```
yahweh-monorepo/
├── apps/
│   ├── words/                 # Yahweh's Words (Full devotional suite)
│   ├── sword/                 # Yahweh's Sword (Original languages workbench)
│   ├── world/                 # 雅偉之界 (Clean Flutter app: Gallery + Art Reader)
│   └── app_template/          # 24-hour starter scaffold for App #4
├── packages/
│   ├── bible_models/          # Pure Dart: versification, OSIS tokens, book IDs
│   ├── design_system/         # Flutter: typography, themes, buttons, sheet builders
│   ├── content_engine/        # SQLite FTS5, scene-passage indexing, offline cache
│   ├── viewport_3d/           # 3D abstraction layer (WebView/Three.js + Flutter Scene)
│   └── store_pipeline/        # Fastlane, export profiles, store submission logic
├── web/
│   └── world_public/          # Vite/TS: SSG/SSR public gallery, PWA, dynamic meta tags
└── tools/
    ├── asset_bundler/         # Pre-compiles scripture + 1,443 images to SQLite/JSON
    └── serial.sh              # Single-instance concurrency guard
```

#### Key Architecture Contracts

1. **Decoupled Feature Registry:**  
   Every app declares a `FeatureManifest`. Words enables `[Notes, Plans, Sermons, Sync]`. World registers only `[ArtGallery, ContextReader, SceneSearch, OfflineMedia]`. No unneeded provider or service is instantiated.
2. **The 3D Abstraction Boundary (`viewport_3d`):**  
   Create an abstract widget `World3DCanvas(modelUri: ..., config: ...)` exposing high-level camera coordinates and hotspot selection hooks. Under the hood, conditionally instantiate:
   * `WebglThreeJsAdapter`: Loads an internal `localhost`/asset-bundled HTML5 page via platform webview. Battle-tested, zero-risk, reuses web 3D assets immediately.
   * `FlutterSceneAdapter`: Native GPU-driven engine using `SceneView`. Activated via labs flag on macOS/Windows. Once `flutter_scene` hits 1.0, it becomes default across all native builds without altering UI code.
3. **Spinning Up App #4 in Days:**  
   Creating a fourth product requires only running `melos exec -- flutter create apps/new_app`, adding `packages/*` dependencies to `pubspec.yaml`, and instantiating the design system's root theme. All Bible models, text sharding, and CI release automation are inherited automatically.
4. **Data Delivery to the Public Site:**  
   Data never diverges. `tools/asset_bundler` compiles the 1,443 image manifests and passage alignments into both an optimized binary pack for Flutter app bundle deployment and a static JSON tree for the Vite web build (`web/world_public/public/data/`). The web site builds statically to Netlify, guaranteeing pristine Open Graph unfurling (`<meta property="og:image">`) for every scene.

---

### 5. Dissent: Disagreements with the Dossier and Conventional Takes

1. **Disagreement with the Dossier’s Equating of Flutter Web with Native:**  
   The dossier suggests Option B (Flutter everywhere) solves the single-language dream. This is an illusion. Flutter Web’s canvas rendering engine cannot serve the core mission of an evangelistic site: instant public search indexing and frictionless link sharing on WhatsApp/iMessage/X. Forcing Flutter onto the public web will degrade outreach metrics. The web *must* remain standard HTML/DOM.
2. **Disagreement with Fable’s Original Tauri-Centric Assessment:**  
   Tauri 2 is a fine solution for developer-oriented desktop tools, but a poor choice for high-polish mobile apps. Relying on host-managed webviews subjects the ministry to the worst cross-platform failure mode: system-dependent font fallback failures, broken touch-event boundaries, and device-specific reflow hiccups on low-end Android phones. Sunk cost is zero; do not defend a flawed mobile foundation.
3. **Disagreement with Relying Wholly on `flutter_scene` Today:**  
   The dossier notes `flutter_scene` 0.24.3 is rapidly progressing on Flutter 3.47. However, adopting a pre-1.0 3D engine as a hard dependency for an app’s critical roadmap invites severe release blockers whenever minor updates introduce breaking API shifts. The dual-adapter bridge proposed above completely shields the project from this volatility.
4. **Disagreement with Applying Shopify’s Native Reversal Here:**  
   Shopify discarded cross-platform frameworks because their organization employs hundreds of engineers who can afford duplicate platform squads. For a church ministry relying on automated AI coding agents supervised by a single maintainer, fragmenting into separate Swift, Kotlin, and C# codebases would prove disastrous.

---

### 6. Fast-Path Verification Experiments (Spikes)

Run these three deterministic experiments to eliminate the top architectural uncertainties:

#### Spike 1: 1,443-Item Virtualized Grid Stress Test (Low-End Android)
* **Goal:** Contrast memory footprint and frame stability between Tauri system WebView and Flutter `SliverGrid`.
* **Method:** Run a 1,443-image card feed (rendering high-res local asset thumbnails) on an API 29 Android test device throttled to 4x CPU slowdown. Continuously fling-scroll for 60 seconds.
* **Pass/Fail Threshold:**  
  * *Pass:* >55 fps average, 0 native process crashes, peak RSS memory < 180MB.  
  * *Fail:* Dropped frames > 15%, frame time spikes > 50ms, or WebView memory blowout.

#### Spike 2: Offline Pure-Dart Extraction and AI Agent Autonomy
* **Goal:** Prove that Codex and Gemini can maintain and iterate on extracted Bible core modules completely sandboxed.
* **Method:** Isolate `bible_models` and its suite of 500 unit tests into a standalone package without Flutter SDK dependencies. Prompt Codex to implement a complete Hebrew/Greek versification mapping rule and execute testing fully offline.
* **Pass/Fail Threshold:**  
  * *Pass:* Agent achieves clean pass across all tests without human manual intervention; test run finishes in < 15 seconds.  
  * *Fail:* Agent demands host toolchain modifications or gets trapped in environment loops.

#### Spike 3: Offline 3D Scene Viewport Spike
* **Goal:** Validate performance and memory bounds of embedding a 25MB glTF architectural model (e.g., Tabernacle/Temple) via an offline WebView running Three.js vs. `flutter_scene`.
* **Method:** Load the identical asset in both runners on an iPhone and a mid-tier Android phone. Measure initial load time, orbital camera gesture responsiveness, and memory consumption.
* **Pass/Fail Threshold:**  
  * *Pass:* Sustained 60 fps during orbital rotation; asset initialization completed in under 1.5 seconds.  
  * *Fail:* Thermal throttling, texture memory discard, or white-screen canvas context loss on background/foreground transitions.

---

### 7. Unverified Assumptions & Known Blind Spots

1. **Tauri 2 iOS App Review 4.2 Track Record:** No direct 2026 public data exists detailing rejection rates for content-centric Tauri 2 apps submitted to Apple App Review.
2. **Impeller Stability on Legacy Windows Vulkan Drivers:** Unverified whether Flutter 3.47’s default Impeller backend triggers crash-to-desktop rates on legacy Intel integrated GPUs commonly found in emerging-market Windows PCs.
3. **`flutter_scene` Production Walk-Through Precedents:** No documented public production apps currently deploy large-scale, animated, multi-mesh 3D walk-throughs using `flutter_scene`.
4. **Multi-App Monorepo Fastlane Scoping:** We could not inspect internal signing keys or verify how Fastlane environment secrets are segmented between Words and World in existing CI workflows.
5. **Desktop Screen-Reader Completeness in Flutter 3.47:** Native VoiceOver and NVDA/JAWS accessibility integration with Flutter desktop widgets remains unverified by internal team testing.
6. **Concurrent CI Runner Licensing:** Unverified whether existing continuous integration runners can support parallel desktop build matrix executions without running into licensing or concurrency caps.

---

### Operational Reporting (Task Rule 8 Compliance)

* **(a) Changed Paths:** None. (Task executed in strict accordance with READ-ONLY mandate; no files were created, modified, or deleted).
* **(b) Commands Run:**
  * `git status --short` → Exited with code 128 (`fatal: not a git repository (or any parent up to mount point /Volumes)`).
* **(c) Incomplete / Unsure Items:** None regarding the position paper's scope. All evaluations were derived from the supplied dossier, measured internal benchmarks, and architectural design principles.
* **(d) Git Status Output:**
  ```
  fatal: not a git repository (or any parent up to mount point /Volumes)
  ```
