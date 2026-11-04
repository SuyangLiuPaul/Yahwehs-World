# Position paper — Opus 5, World architecture council, 2026-11-04

Angle: engineering architecture and migration safety. Written without reading any other council paper. Sources:
the dossier, both audits, the Fable ruling, and a structural survey of `Words-184` / `Sword-184` / `globe-shell`.
Four web claims re-verified today; see §7.

---

## 1. Recommendation

**Take C, but cut it where the pain is, not at the language boundary: build `apps/world` as a new thin Flutter
app inside a pub workspace with Words and Sword, keep the existing TypeScript for the public site *and for the
3D*, extract shared Dart packages bottom-up in the order the import graph permits, and reject "fork Words and
delete most of it" outright.** The complaint is the gallery grid and the reader — ~16k of the 34k TypeScript
lines. The other ~18.3k (`walk/` 6,083, `voxel/` 4,819, `scene-assembly/` 3,699, `structures/` 2,007, `lowpoly/`
1,001, `journey-actors/` 477, `ark3d/` 227) is 3D work on three.js 0.185 that nobody is unhappy with and that has
no Flutter equivalent out of beta. Flutter takes the store apps and the reading surface; three.js keeps the
walk-throughs behind a one-widget seam. The decisive fact is not about renderers: this team has already solved the
shared-code problem four times by hand (`settings_kit/`, `skeleton/`, `calendar/`, `sync_addon_files.py` — ~60
files, ~10k lines of `sed`-renamed copies with `--check` drift guards, two wired into `flutter test`, three with
stale paths to `Words-182`). The workspace pays for itself on Words and Sword before World compiles a line.

## 2. Scoring (1 best, 4 worst)

| Criterion | A | B | C | D |
|---|---|---|---|---|
| Plasticity | 3 — never shares with Words/Sword | 3 — 3D on pre-1.0 `flutter_scene`, SEO gone | **1** — one workspace, every store app; swappable 3D seam | 4 |
| Release cost | 3 — four shells *beside* two Flutter pipelines | 2 — second site still needed | **1** — one pipeline template; four sync scripts deleted | 4 |
| Quality ceiling | 4 — 18.6 fps, 337 ms frame; three unpinnable engines | **1** — one renderer, Impeller on desktop (verified) | **1** native, 2 web | 2 |
| Store quality cost | 2 — 7 P0s open | 4 — rewrites reader, i18n, offline *and* 18.3k 3D lines | 3 — gallery+reader only | 4 |
| Features + 3D | 2 | 3 | **1** — per feature, one seam | 3 |
| Fourth app | 3 | **1** | **1** — `main.dart` + profile + path deps | 4 |
| SEO / PWA | **1** | 4 — canvas text invisible to crawlers | **1** — HTML site untouched | 2 |
| Agents | **1** — Codex runs `node --test` offline | 3 — Codex cannot run `flutter` | 2 — Codex TS/data/CI, Claude Dart | 3 |
| Risk | 3 — no reviewed Tauri iOS content app | 3 — pre-1.0 3D, CJK selection unproven | 2 — both stacks proven in-house | 4 |

## 3. Migration path

**The hard rule: nothing moves out of `lib/` on a release branch.** Words is on `release/1.8.4` now. Extraction
happens on `main`, one package per PR, each PR leaving `flutter analyze`, the full `flutter test`, `design_lint`
and `lint_ratchet` green in **both** apps before merge.

**Why not fork Words.** Sword *is* that experiment: a 2026-07-22 fork, now 267k divergent lines needing six
scripts to stay in step. A World fork would inherit 834 files, 42 dependencies including Firebase (15 files), 969
test files / 162k test lines, 21 CI workflows, 10 hand-generated `.g.dart` with hardcoded `lib/` paths and 35
conditional-import triples — then ask an agent to prove it had deleted *enough*, against a moving release branch.
Deletion is unbounded; addition is bounded. Safe deletion here means **not creating the thing**: `apps/world`
starts empty and path-depends.

Phases (agent-days; Codex/Gemini type, Claude runs `flutter`):

| # | Work | Days |
|---|---|---|
| P0 | SDK floor `>=3.2.3` → `^3.6.0` in both apps (verified requirement for `resolution: workspace`); workspace root, members listed explicitly since globs need Dart 3.11. CI green with zero members. | 0.5 |
| P1 | `ydh_settings_kit` + `ydh_skeleton` — already byte-identical copies with a ~2-symbol contract (`DS`/`DSType`). Delete each sync script **in the same PR** that adds its path dependency. | 2 |
| P2 | `ydh_tokens` (colours, type, motion, radii) + `ydh_i18n_core` (plural, bidi, `language_rule`, `hant()`). Extract *tokens*, not all of `lib/design/`: the full kit has ~29 escaping edges, six into `app_settings.dart`, which 157 files import. `AppSettings` is the biggest blocker to any extraction and must not move. | 3 |
| P3 | `ydh_calendar` + `ydh_addons` from the existing synced sets; deletes two more scripts, one running inside `flutter test`. | 4 |
| P4 | **Data contract.** `build-gallery-data.mjs` stays the only generator; `ydh_catalogue_world` only *reads* its JSON, gated by offline `node --test` schema tests plus Dart decode tests. | 2 |
| P5 | `apps/world`: gallery grid (`SliverGrid`, virtualised by construction), scene page, **new thin reader**. | 10 |
| P6 | One `release-<app>-<platform>.yml` template from Words' seven release workflows. | 3 |
| P7 | `ydh_labs_webview`: the three.js `walk/` scenes offline, with a JS↔Dart bridge. | 2 |
| P8 | Delete `src-tauri/` + `dist-shell/` **only after all four stores accept the Flutter build** — 146 + 361 lines of coupling, a reversible directory removal. | 0.5 |
| — | Meanwhile land the perf audit's top five TS fixes; the site keeps that code. | 1 |

≈28 agent-days plus the owner's store time.

**Do not extract Words' reader.** Measured: 15 files, 19,704 lines, a 12,511-line hub
(`bible_reading_pane.dart`), **266 escaping import edges to 161 targets**, 13 into `pages/`, and all six reader UI
files touching `MainProvider` (2,566 lines, in 94 files) directly. Lifting it drags the app shell. World's reader
needs single and inline-plate reading, not notes/highlights/plans/sync — a 3–5k-line job, strictly cheaper than
the refactor. Reuse the **data format and the tokens**, not the widgets.

**Sequence this with the churn you already owe.** Flutter 3.47 unbundled Material and Cupertino as
`material_ui`/`cupertino_ui` 1.0 and unbundled `flutter_localizations`, deprecating the in-SDK libraries at the
November stable (verified today). Words and Sword owe that import sweep regardless; it and extraction touch the
same lines, so do them in one window.

**The hazards are all in Python, none in Dart.** There is **no `build_runner` chain anywhere** — zero `freezed`,
`riverpod`, `json_serializable`, no `build.yaml`, no `l10n.yaml`; the ten `.g.dart` files are one-shot Python
outputs in git. A package move is therefore a path constant in ~10 generators, plus `design_lint.py`'s hardcoded
`lib/` walk and `EXEMPT` tuple, `lint_ratchet/baseline.json` (keyed on `lib/<path>|<lint>`),
`analysis_options.yaml`, and the ~18 root-relative `python3 test/test_*.py` calls in `flutter-ci.yml`. **Put "no
`build_runner`" in the packages' charter** — it is the one documented way agents break a Flutter build. And use
the workspace for *resolution*, not parallel test execution: concurrent `flutter test` runs here produce phantom
`ink_sparkle.frag` failures.

## 4. Architecture for extensibility

```
pubspec.yaml            # workspace: [ explicit member list ]
apps/      words  sword  world  <fourth>
packages/  ydh_tokens  ydh_settings_kit  ydh_skeleton  ydh_i18n_core  ydh_i18n_packs
           ydh_calendar  ydh_addons  ydh_editions  ydh_catalogue_world  ydh_labs_webview
tools/                  # one generator dir, outputs into packages/*/lib
.github/workflows/      # release-<app>-<platform>.yml from one template
```

Dependency direction is one-way: `apps → packages → ydh_tokens`. No package may import Firebase or `intl` — Sword
removed Firebase at v1.6.62 with a "do not re-add" note, and that constraint is what keeps `ydh_*` reusable.
`ydh_editions` needs inverting first: the pack service imports the app's 612-line `constants/bible_versions.dart`
and must take a `CatalogueSource` interface instead.

**Feature modules per app.** 33 files call `bool.fromEnvironment` ad hoc today and the only per-app discriminator
is `REGISTRY_APP`, defaulting to `'words'`. Replace it with one `AppProfile` const class per app, injected at the
root; **packages never read `fromEnvironment`**.

**3D sits behind one widget.** `SceneHost(sceneId, passageId)`, implemented by `ydh_labs_webview` (three.js,
reusing `src/walk/` verbatim) and reimplementable on `flutter_scene` later without touching a caller — which is
what makes neither 3D choice permanent. Caveat: Words' `webview_flutter` serves only media embeds (4 files), never
local bundled content, so offline asset serving to WKWebView is new work (S3).

**The site keeps its own data pipeline:** TS emits the JSON, Netlify serves it, `ydh_catalogue_world` decodes it.
One generator, two consumers, schema-tested where Codex can gate it offline.

## 5. Disagreements

- **Scoring C at 3 for "two codebases" uses the wrong unit.** Today: three toolchains, four shells, four sync
  scripts. C goes to two toolchains, one shell set, zero scripts. Count pipelines, not languages.
- **A is credited with "already built."** Sunk cost, priced at zero by the owner — and seven P0s are open,
  including no picture on the iPad, Duo or macOS first screen and Google-hosted fonts in an offline-first product.
- **B's extensibility scored 1.** B rewrites 18.3k lines of working three.js onto a pre-1.0 renderer whose Flutter
  GPU is off by default on every native platform, and surrenders SEO. That is not plasticity.
- **"Fork Words" is treated as a neutral variant.** It is the worst option on the board; Sword is the proof.
- **A's 3D edge is real; A's *app* edge is not.** The shell's own design is the problem: 1,443 whole-file protocol
  reads for the grid, a 359 KiB manifest parsed at every boot for an unshipped feature, 652 KB of JSON in one task
  in 对照.

## 6. Three spikes

1. **S1 — extraction dry run (2 days).** Off `main`: workspace root, `ydh_settings_kit` + `ydh_tokens`, both apps
   path-depending. **Pass:** `flutter analyze` clean, `flutter test` reporting the *same test count* as before in
   both apps, `design_lint` + `lint_ratchet` green, `release-ios.yml` and `play-aab.yml` producing artifacts, no
   Python tool needing more than a path constant. **Fail → stop:** World must not depend on extraction.
2. **S2 — the quality premise (2 days).** On the slowest Android and one iPhone: a Flutter `SliverGrid` of all
   1,443 thumbnails from the existing `index.json`, plus Psalm 119 in 3-up parallel with `SelectionArea` copy in
   zh-Hant and ru. **Pass:** ≥55 fps sustained fling, worst frame <33 ms, cross-verse copy yielding correct
   Traditional text (baseline: 18.6 fps / 89.3 % / 337 ms). **Fail → A plus the perf fix list wins.**
3. **S3 — the 3D seam (1.5 days).** Load `src/walk/` from bundled assets in a Flutter WebView on iOS, Android and
   Windows, network off, with a JS→Dart bridge passing a passage id. **Pass:** ≥30 fps on the slow Android,
   offline, bridge round-trips. **Fail → 3D moves to `flutter_scene`**, changing the plan's risk.

## 7. Could not verify

**Verified today (2026-11-04):** pub workspaces require `sdk: ^3.6.0`, glob members require Dart 3.11
(dart.dev/tools/pub/workspaces); Impeller is default on macOS/Windows/Linux in 3.47, Metal on macOS and Vulkan on
Windows/Linux per flutter.dev's own post — one secondary source disputes the Vulkan claim and calls desktop
Impeller GLES, so treat that detail as open; Material/Cupertino are unbundled as `material_ui`/`cupertino_ui` 1.0,
in-SDK libraries deprecated at the November stable; `flutter_scene` is 0.24.3, pre-1.0, "minor releases can carry
breaking changes", Flutter GPU off by default except on web.

**Not verified:** whether one serialized `flutter test` across a workspace avoids the `ink_sparkle.frag` phantom
failures (local symptom, no source); real frame numbers for either stack on this team's devices (S2); whether
WKWebView serves bundled 3D assets without a local HTTP server (S3); how much of the 162k test lines would need
rewriting if `AppSettings` were split; and whether `apps/world`'s reader reaches the premium bar in 10 agent-days
— the softest number here.
