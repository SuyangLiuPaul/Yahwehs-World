# 雅偉之界 / Yahweh's World: the native shells (Day 1)

Branch `gallery/shell-1` (from `gallery/integrate-1`), local commits only. Nothing pushed, deployed, released or version-bumped; no key, keychain item or store console was touched.
Plan: `handoff/fable-gallery-all-platforms-2026-11-03.md` §10 to §12. This page is the hand-over: what exists, how to build each shell, **the exact steps only the owner can do**, and what could not be verified.

## 1. What a shell is

One Tauri 2 project (`src-tauri/`) wraps one static build (`dist-shell/`), made by `npm run app:dist`:

| | bundled in the app | fetched from the site |
|---|---|---|
| pages and code | 2.2 MiB | |
| thumbnails | 48.9 MiB (1,443) | |
| Bible data (8 editions, headings) | 36.7 MiB | |
| **app content total** | **87.8 MiB** (budget 100) | |
| full pictures | | 204.1 MiB (1,443), one at a time, or all at once through "Offline pictures" |

The host is **one constant**: `SITE_HOST` in `src/config/site.ts` (today `https://world.yahwehword.com`). `npm run verify:shell` fails if the CSP, the HTTP permission or the deep-link host in `src-tauri/` disagree with it. Changing the host = edit that line, then the same host in `src-tauri/tauri.conf.json` (CSP, `plugins.deep-link`) and `src-tauri/capabilities/default.json`; the check lists every place still on the old one.

Names and ids (owner decisions, 2026-11-03):

| | value |
|---|---|
| product name | per language (owner, 2026-11-04): en/ru `Yahweh's World`, zh-Hans 雅伟之界, zh-Hant 雅偉之界; the label under the icon is the short one — `World`, 雅伟之界, 雅偉之界, `Мир` |
| Tauri `identifier`, Apple bundle id, Play package | `com.yahwehword.world` |
| Microsoft identity | `YahwehsPeople.YahwehsWorld` (`packaging/msix/identity.json`; Publisher is a placeholder until Partner Center shows it) |
| **Two ids** | the GitHub APKs v0.1.1..v0.1.9 were distributed as `com.yahwehsworld.globe`, and an installed copy cannot update across an id change. `tools/build_apk.sh` therefore sets the Gradle property `ywAppId=com.yahwehsworld.globe` (same idea as Words' `playAppId`) and keeps the old release key; everything else (`tools/build_android.sh`, the workflows) uses the store id. The Kotlin `namespace` stays `com.yahwehword.world` in both. |
| channel | `VITE_SHELL_CHANNEL=store` (iOS, Play: the app never offers a download outside the store) or `direct` (DMG, GitHub APK, Windows installer: the app may announce a newer GitHub release). |
| deep links | `https://world.yahwehword.com/p/<id>` and `yahwehsworld://p/<id>`, `yahwehsworld://packs` |

## 2. Build commands (this Mac)

Always build one shell at a time: they all rewrite `dist-shell/`, and the channel is baked into it.

```
npm ci
npm run app:dist                                   # content: needs public/pictures (T7) and public/data/reader (Words checkout)
npm run verify:shell                               # unit tests, 100+ static checks, built-content checks, a browser pass

# macOS, unsigned (quick look): app + DMG for this Mac
cargo tauri build
# macOS release: universal, Developer ID, notarised, stapled (section 3.4)
tools/release_mac.sh

# iOS / iPadOS simulator (no account needed)
VITE_SHELL_CHANNEL=store cargo tauri ios build --target aarch64-sim --debug
# iOS TestFlight (section 3.5)
APPLE_DEVELOPMENT_TEAM=<team id> tools/release_ios.sh

# Android: debug APK (emulator / phone), Play AAB, GitHub APK
tools/build_android.sh --debug
tools/build_android.sh --aab                       # signing: section 3.3
tools/build_apk.sh                                 # the GitHub APK: old id, old release key, as before

# Windows and CI builds of the others: GitHub Actions (section 4)
```

`tools/shell/android_patch.py` and `tools/shell/ios_patch.py` re-apply, after every `tauri ... init` (gen/ is gitignored and regenerated), everything that must survive there: application id and versionCode properties, signing from properties, the four launcher names, the launch colour, and the localised iOS names.

## 3. What only the owner can do (exact steps)

### 3.1 Three store records (30 minutes, once)

**App Store Connect** (one record serves iPhone, iPad and Mac):
1. developer.apple.com > Certificates, Identifiers & Profiles > Identifiers > + > App IDs > App > Bundle ID **Explicit** `com.yahwehword.world`, description "Yahweh's World"; tick **Associated Domains**. (Xcode's automatic signing can create it at first archive, but registering it first avoids a surprise.)
2. appstoreconnect.apple.com > Apps > + > New App: platforms **iOS** and **macOS**; Name `Yahweh's World` (30-character limit; add 雅偉之界 as the localised name for 繁體中文 and 简体中文, Russian name as you decide); primary language English; Bundle ID `com.yahwehword.world`; SKU `yahwehs-world`; User access Full.
3. Agreements, Tax, and Banking: the Paid Apps agreement only matters if the app is ever paid; free needs nothing new.
4. TestFlight > Internal Testing > + group "Owner"; add yourself.

**Google Play Console** (personal account: the 12 testers × 14 days rule applies before production; internal testing has no such gate):
1. Create app: name `Yahweh's World`, default language English (United States), App, Free.
2. The package name is fixed by the first AAB you upload (`com.yahwehword.world`): do not create it by hand.
3. Testing > Internal testing > Create new release > turn on **Play App Signing** (accept the default) > upload `dist-app/YahwehsWorld-<version>-play.aab` (section 3.3) > add testers by e-mail list.

**Microsoft Partner Center**:
1. Apps and games > New product > MSIX or PWA app > reserve the name `Yahweh's World`.
2. Product management > Product identity: copy **Package/Identity/Name** and **Package/Identity/Publisher** (a `CN=...` string) into `packaging/msix/identity.json`. The Name should read `YahwehsPeople.YahwehsWorld`; if Partner Center gives a different one, the Partner Center value wins.

### 3.2 Xcode login (one minute)

Xcode > Settings > Accounts > + > Apple ID > sign in with the account that owns the developer team. Select the team > Manage Certificates > + > **Apple Distribution** (and **Developer ID Application** for 3.4). Xcode creates the signing assets for `com.yahwehword.world` on the first archive.

### 3.3 Android keystore (upload key for Play)

This repository never reads a keystore; you give Gradle a **path** and the passwords through the environment.

```
keytool -genkeypair -v -keystore ~/keys/yahwehs-world-upload.jks -alias yahwehs-world-upload -keyalg RSA -keysize 4096 -validity 10000
```
Back it up with the others (Drive, PasswordManager). Then, in the shell that builds:
```
export ORG_GRADLE_PROJECT_ywKeystorePath=$HOME/keys/yahwehs-world-upload.jks
export ORG_GRADLE_PROJECT_ywKeyAlias=yahwehs-world-upload
read -s YW_KEYSTORE_PASSWORD; export YW_KEYSTORE_PASSWORD      # typed, not stored; YW_KEY_PASSWORD defaults to it
tools/build_android.sh --aab
```
Re-upload of the same visible version: `export ORG_GRADLE_PROJECT_ywBuildNumber=2` (1 to 9). The old key `~/keys/yahwehs-globe-release.jks` is used by `tools/build_apk.sh` only (the GitHub APK) and must never be replaced.

### 3.4 Notarisation (macOS DMG)

Once:
```
xcrun notarytool store-credentials "yahwehs-world-notary" --apple-id <your Apple ID> --team-id <TEAMID>
```
It asks for an **app-specific password** (appleid.apple.com > Sign-In and Security > App-Specific Passwords), which you type at the prompt; it goes into your keychain, nowhere else. Then:
```
export APPLE_SIGNING_IDENTITY="Developer ID Application: <name> (<TEAMID>)"     # security find-identity -v -p codesigning
tools/release_mac.sh                                                          # signs, notarises (waits), staples, spctl-checks
```
The profile name is a placeholder: use another with `NOTARY_PROFILE=<name>`.

### 3.5 TestFlight

```
export APPLE_DEVELOPMENT_TEAM=<10-character team id>
tools/release_ios.sh               # archive + upload to App Store Connect through Xcode's signed-in account
tools/release_ios.sh --export-only # or write the .ipa to dist-app/ and drag it into Transporter
```
After Apple's processing the build appears under TestFlight > Internal Testing. The macOS build for TestFlight needs the Mac App Store route (sandbox entitlements, a Mac provisioning profile, `productbuild`); it is **not set up** (section 6).

### 3.6 Site files for app links (a web deploy, so only when you say 「release」)

`https://world.yahwehword.com/.well-known/apple-app-site-association` (`{"applinks":{"details":[{"appIDs":["<TEAMID>.com.yahwehword.world"],"components":[{"/":"/p/*"}]}]}}`, served as `application/json`, no redirect) and `/.well-known/assetlinks.json` (package `com.yahwehword.world`, the SHA-256 of the **Play App Signing** certificate shown in Play Console > App integrity). Until they are live, links open in the browser and `yahwehsworld://` still works. The pictures must also be live at `SITE_HOST/pictures/full/` before the shells can show them.

## 4. GitHub Actions (written, never run)

`.github/workflows/shell-windows.yml` (NSIS installer, portable zip, optional MSIX), `shell-macos.yml` (universal DMG, optional sign + notarise), `shell-android.yml` (debug APK, optional AAB). All three are `workflow_dispatch` only, read-only permissions, and take `content_tag`: a GitHub release that holds `dist-shell-<version>.zip` + `.sha256`, because the content (pictures from T7, Bible data from the Words checkout) cannot be built on a runner. Make and upload it yourself when you decide to:
```
npm run app:dist && tools/pack_shell_content.sh
gh release upload <tag> dist-app/dist-shell-<version>.zip dist-app/dist-shell-<version>.zip.sha256
```
Secret **names** the optional steps read (none is in any file; add them under Settings > Secrets only if you want CI signing): `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_ID`, `APPLE_API_KEY_P8`, `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`. Windows signing is not wired (no certificate exists); the installer is unsigned and SmartScreen will warn. `desktop-build.yml` is marked superseded. Actions are pinned by major tag, not by SHA (Words pins SHAs; do that before the first real run).

## 5. Where things are (this branch)

`src/config/site.ts` host, names, channel · `src/platform/` the capability interface (§12.4): storage, files, share, openExternal, deepLinks, updates, optional notifications; web and Tauri adapters · `src/core/packs.ts` the pack manager (resumable, abortable, verified) · `src/features/packs/` the Offline pictures sheet (**stub**, a `FeatureModule`) · `src/shell/boot.ts`, `deeplink.ts` · `scripts/lib/vite-shell-target.mjs`, `scripts/shell-dist.mjs` · `src-tauri/` (config, per-platform overlays, capabilities, plugins) · `tools/` (build and release scripts) · `packaging/msix/` · `scripts/verify-shell.mjs`, `verify-shell-ui.mjs`.

Adding a capability later (the globe, walks...) never touches the shell: a feature asks `ctx.platform`; a new capability is an adapter method plus one plugin line in `src-tauri/src/lib.rs` and one scoped permission in `capabilities/default.json`.

## 6. Merge notes for gallery/pwa-1 (expected conflicts and decisions)

- `src/gallery/chrome.ts` registers the service worker when `import.meta.env.PROD && 'serviceWorker' in navigator`. **In the shell that must be off** (a worker under `tauri://localhost` would cache old content across app updates): gate it with `import.meta.env.VITE_TARGET !== 'shell'`. This branch does not touch the file; `scripts/shell-dist.mjs` already removes `sw.js`, `offline.html`, manifests and `pwa/` from the bundle.
- Names: settled (owner, 2026-11-04, on build 3). The name follows the page language — en and ru "Yahweh's World", zh-Hans 雅伟之界, zh-Hant 雅偉之界 — and the bar carries all four readings in the markup so `html[lang]` picks one before the first paint. One source (`PRODUCT` in `src/config/site.ts`); `verify:shell`, `verify:shell-ui`, `verify:gallery-ui`, `verify:ru` and `verify:pwa` now FAIL on a CJK character in the name of a non-Chinese page. See `docs/gallery-pwa.md`.
- Icons: `src-tauri/icons/` are the existing set (navy circle + gold cross). The PWA branch drew new icons from the Lion and Lamb mark. Decide one mark, then `cargo tauri icon <1024 png>` and rerun `tools/build_apk.sh`' icon step; the shells then match the PWA.
- The web adapter keeps offline files in Cache Storage cache `yw-packs-v1`; the PWA worker must read it (a global `caches.match(request)` does) or be told its name, so "download all" on the web and in the worker are one store.
- `public/data/zh-hant.json` is regenerated by `npm run build` with different bytes in both branches; neither commit includes it.
- Cargo: `cargo update` moved Tauri from 2.11.5 to 2.12.5 so the Rust crates match the npm packages; `tauri-cli` on this Mac is 2.11.4 (works; the CI workflows use `@tauri-apps/cli@~2.11`).

## 7. Known gaps and decisions needing the owner

- ~~**Fonts offline**~~ **DONE 2026-11-04.** The faces are self-hosted and subset in `public/fonts` (Inter, Spectral, IBM Plex Mono with Latin **and Cyrillic**, Noto Sans/Serif SC and TC subset to the characters the shipped texts and UI use, Noto Sans/Serif Hebrew, a 3-glyph symbol face). Built by `tools/subset-fonts.sh`; `npm run verify:fonts` (`tools/font-coverage.mjs --check`) fails on any codepoint a shipped page needs and no bundled file covers. All OFL-1.1, notices in `public/fonts/OFL.txt`. The Tauri CSP no longer allows `fonts.googleapis.com` / `fonts.gstatic.com` and `verify-shell` fails if either returns. Emoji are still left to the platform (a colour emoji font is 10+ MB).
- **Offline pictures UI is a stub** (a download icon in the top bar and a sheet). Wording is machine-neutral and flagged `STUB` in code: it needs the Opus medium review and, under the premium bar, a mock-up before it is final. The update toast on direct builds is a stub too (the old ⚙ settings panel in `src/updates.ts` only exists on the full surface; it is not wired here).
- Native share: no Tauri share plugin exists; the adapter uses Web Share where the web view has it and copies the link otherwise. A native share sheet needs a small plugin per platform.
- Notifications: off (no plugin, no permission), as planned.
- Apple 4.2: bundled thumbnails and Bible data, offline start, deep links and native name localisation are in; the "no browser look" items (text size, keyboard shortcuts, dark/light/paper following the system) are the web build's own and were not re-audited inside the web views.

## 8. What was built and checked (2026-11-03, this Mac; evidence)

| Target | Result | Evidence |
|---|---|---|
| App content (`npm run app:dist`) | **built**, 87.8 MiB, 2,348 files (thumbnails 48.9, Bible data 36.7, code and pages 2.2); full pictures 204.1 MiB are not inside | `dist-shell/shell-sizes.json`; `npm run verify:shell` |
| macOS (arm64, unsigned) | **built**: `Yahweh's World.app` 81 MB, DMG 70 MB, bundle id `com.yahwehword.world`, four localised names, URL scheme `yahwehsworld`, min macOS 12.0, ad-hoc signature. **Launched**: window title `雅偉之界 · Yahweh's World`, home page rendered, the Offline pictures icon is in the top bar. The hero picture was blank because the full pictures are not yet served from `world.yahwehword.com`. | `otool`/`plutil` of the bundle; a screenshot of the window (kept in the session scratch, not in the repository). Universal (x86_64) and signing/notarisation: not run. |
| iOS / iPadOS simulator (iPhone 17, iOS 27.2) | **built, installed, launched**: id `com.yahwehword.world`, device family iPhone + iPad, `Info.ios.plist` merged (ITSAppUsesNonExemptEncryption false, four localisations), entitlement `applinks:world.yahwehword.com` added by the deep-link plugin, status bar and safe areas hold, tab bar at the bottom. iPad layout not looked at. | screenshot `ios-iphone17-home.png` (scratch); `plutil -p` of the app |
| Android debug APK (arm64) | **built**: package `com.yahwehword.world`, versionCode 10091 (0.1.9 by the Words formula, build 1), labels `Yahweh's World` / `雅偉之界` (zh-TW) / `Мир Яхве` (ru) read back with `aapt2 dump badging`. Not installed on a device or emulator. | `tools/build_android.sh --debug` log |
| Android release AAB (arm64, **unsigned**) | **built**: 69 MB; manifest has package `com.yahwehword.world` and the app-link intent filter (`autoVerify`, host `world.yahwehword.com`, prefix `/p/`). Signing with an upload keystore: not run (no keystore is read here). | `unzip -p ... base/manifest/AndroidManifest.xml`; `jarsigner -verify`: "no manifest" (unsigned, as intended) |
| Windows | **not built** (no Windows machine; Tauri does not cross-compile). Workflow written, never run. | |
| GitHub APK (`com.yahwehsworld.globe`) | **not built** (needs the old release key, which was not touched). The id override is a Gradle property in the same patch as the others; `verify:shell` checks the patch is idempotent and the script sets the property. | |
| macOS notarisation, TestFlight upload, Play upload, MSIX | **not run** (owner's accounts and keys). | |

Tests: `npm run test:shell` 40 pass (platform 21, packs 11, deep links 4, site helpers 4); `npm run test:gallery` 22 pass (a new feedback-origin test included); `npx tsc --noEmit` clean; `npm run verify:shell` runs the three and passes 94 static/content checks and an 18-check browser pass (Chromium, web adapter). The wiring is mutation-tested (a wrong host and an `unsafe-eval` CSP both fail the check).

**Findings from the builds**
- The content is embedded in each native library by Tauri, so each Android ABI adds about 90 MB to a universal file: the four-ABI debug APK was 975 MB. `tools/build_android.sh` builds arm64 for debug and arm64 + armv7 for the AAB (Play serves one ABI per device, about 70 MB for arm64 in the release AAB); `tools/build_apk.sh` builds arm64 only, so the GitHub APK no longer runs on 32-bit-only phones. Override with `ANDROID_TARGETS`. Moving the content into Android `assets/` (shared by ABIs) would remove this; not done.
- Disk: the four Android ABIs plus iOS plus macOS needed about 35 GB of `src-tauri/target` and filled the shared `/Volumes/androidbuild` volume once (a build failed with "No space left on device"). `cargo clean` in this worktree freed it; the volume was at 97% when this was written. Build one platform, then clean.
- A first iOS simulator build was interrupted by SIGTERM from outside (probably another session on this machine) and succeeded on the rerun.
- Computer-use screenshots: the macOS window screenshot triggered a system "screen recording" permission prompt on the owner's Mac; it was left unanswered.
- The shared `dist-shell/` carries the channel of whichever build ran last; the browser pass accepts either.

## 9. Copy, paste and text selection (2026-11-04)

The owner's report on the TestFlight build was "World cannot copy-paste". What was measured, and on what:

| Target | Long-press / drag selection | System Copy menu | What reached the clipboard | Paste into the app's own fields |
|---|---|---|---|---|
| iOS Safari (Simulator, iPhone Duo) | works | Copy / Look Up / Translate | — | — |
| Android shell (Tauri WebView, emulator, `com.yahwehword.world`) | works | Define / Copy / Select all / Share | the word, then the reference, the edition and its credit line | pasted into the search field intact |
| macOS shell (Tauri) | works | the Edit menu has Undo/Redo/Cut/Copy/Paste/Select All | the page text | — |
| iOS shell (Tauri) | **not tested** | — | — | — |

The iOS shell could not be tested: a simulator build needs about 6 GB of build output on `/Volumes/androidbuild`
and there is not that much free. Everything else in the table reproduced nothing. So the fix addresses the one
failure that is specific to that target and is silent when it happens:

**In a WKWebView that is not Safari, `navigator.clipboard.writeText` resolves and writes nothing** outside
Safari's own user-activation window. Because the promise resolved, `copyText`'s `document.execCommand` fallback
never ran and the toast said "Copied" over an unchanged clipboard. `prefersLegacyClipboard` (src/reader/copy.ts)
now puts the synchronous path first on exactly those views — an app's webview, or a page installed to the home
screen — and keeps the async API as the fallback. The two paths are swapped, not replaced, so nothing changes in
Safari, Chrome or the Android WebView.

Three things that make the result usable rather than merely possible:

- the reading containers declare `user-select: text` and `-webkit-touch-callout: default`, and
  `scripts/verify-reader-robustness.mjs` fails the build if any of them loses it (case 8);
- a system copy is built with `buildCopy`, so it carries the reference, the credit line and the 100-verse cap,
  and `selectionText` leaves out the verse-number gutter, the parallel edition tags, the footnote markers and the
  screen-reader-only spans — those are what made a multi-verse copy read "3 And God said 4 And God saw";
- a tap anywhere on a verse selects it, a tap on a second verse extends the run, Escape clears it, and the action
  bar offers Copy, Share, Link and "Open the picture" when the verse is the one a scene starts at. A live text
  selection always wins over verse selection, so choosing a phrase never lights the whole verse.
