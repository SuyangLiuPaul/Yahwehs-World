# 14 · Native builds (Windows / macOS / Android / iOS)

The web app (`npm run build`) is the source of truth. Everything here wraps
that same `dist/` in a native shell via [Tauri 2](https://tauri.app) — one
Rust-based wrapper, not four separate rewrites. `src-tauri/` holds the shell;
`src-tauri/gen/android` and `src-tauri/gen/apple` are generated projects and
are gitignored — regenerate them with the init commands below rather than
expecting them in a fresh clone.

Requested directly: iOS, Android (APK), Windows, macOS all usable. Status as
of 2026-09-18 (v0.1.3 released; see the release table below).

| Platform | Builds locally on this Mac | Needs from the owner |
|---|---|---|
| macOS | **Yes — built, launched, screenshotted.** Native window, correct title, globe renders, `Go to…` present, no console errors | Nothing to *run* it; a paid Apple Developer account ($99/yr) only if notarization (no Gatekeeper prompt) or the Mac App Store is wanted |
> **The repository is `SuyangLiuPaul/Yahwehs-World`** (renamed from
> `yahwehs-globe` on 2026-09-18; GitHub redirects the old URL). The local
> checkout directory and the signing key's filename are unchanged — the key
> must never be renamed or replaced, or every installed copy has to be
> uninstalled before it can update. Release artifacts are named for the
> reader: `dist-app/YahwehsWorld-<version>.apk` and
> `YahwehsWorld-<version>-macOS-arm64.dmg`.

| Android (APK) | **Yes — signed with the real release key and published.** `tools/build_apk.sh` builds it, re-applies the signing config and launcher name (gen/ is regenerated, so they cannot live there), and verifies the result with `apksigner` by reading the certificate out of the built APK. Installed and driven on the owner's Mi Pad | Nothing. Key is in `~/keys/`, backed up in Drive `PasswordManager/yahwehs-globe/`. Only a Play Console account ($25 one-time) if it should ever go on the Play Store. **MIUI refuses `adb install` unless 开发者选项 → USB 安装 is on** |
| Windows | **No** — Tauri does not cross-compile a Windows target from macOS. Not yet run anywhere; CI is written but has not been triggered | Nothing to *run* the unsigned .exe/.msi it will produce; a code-signing cert removes the SmartScreen prompt |
| iOS | **Simulator: yes — built, installed, launched and driven on an iPhone 17 Pro.** `cargo tauri ios build --target aarch64-sim` needs no signing at all. Globe renders, safe-area insets hold the nav clear of the status bar, all three readings fit, settings panel opens and reports the right version. **Device: not done, by decision** | **Decided 2026-09-18: simulator only, for now.** The account on this Mac is a *free personal team* — its provisioning profiles last 7 days (the ones for the owner's other apps expire 3–4 days from issue), so an on-device build stops launching after a week and cannot be given to anyone else. The $99/yr Developer Program is what buys 1-year profiles and TestFlight. Do not start signing for a device without asking again. iPhone users have world.yahwehword.com meanwhile |

## Prerequisites (this Mac already has all of these installed)

- Rust via `rustup` (`~/.cargo/env`)
- `cargo install tauri-cli --version "^2.0"` → gives `cargo tauri`
- Xcode (full app, not just Command Line Tools) — for macOS and iOS
- `brew install openjdk@17 android-commandlinetools` — for Android
- Android SDK platforms/build-tools/NDK were already present in
  `/opt/homebrew/share/android-commandlinetools` from another project on this
  machine (licenses pre-accepted); a fresh machine needs
  `sdkmanager --licenses` plus the platform/build-tools/ndk packages.

Environment variables needed for Android commands:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"   # match whatever version is installed
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

## Commands

```bash
# One-time per clone, once the SDKs above are installed:
cargo tauri android init --ci
cargo tauri ios init --ci

# macOS app (produces src-tauri/target/release/app; add --no-bundle to skip
# the .dmg/.app.tar.gz step and just get the runnable binary fast):
cargo tauri build

# Android APK (produces src-tauri/gen/android/app/build/outputs/apk/...):
cargo tauri android build --apk

# Android — sign before it will install anywhere (a debug key is enough to
# verify on an emulator/own device; a real release key is a separate,
# deliberate step, not this one):
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --key-pass pass:android app-universal-release-unsigned.apk
adb install -r app-universal-release-unsigned.apk

# iOS — builds for the simulator without a device or signing:
cargo tauri ios build --target aarch64-sim
# A real device needs a signing identity; see the open question above.

# Windows — cannot be built on this Mac. Runs in CI instead:
# GitHub Actions → "Desktop build" workflow (.github/workflows/desktop-build.yml),
# triggered manually (workflow_dispatch). Unsigned artifacts, downloadable from
# the run. Also builds macOS as a second matrix leg (a fresh, from-scratch
# build in CI is a second confirmation beyond this Mac's local one).
```

## Icons

`src-tauri/icon-source.svg` is the source of truth — the same navy circle and
gold cross as the site's own `<link rel="icon">` in `index.html`, squared off
with a solid background (iOS icons cannot have transparency). Regenerate every
platform size from it after any change:
```bash
rsvg-convert -w 1024 -h 1024 src-tauri/icon-source.svg -o src-tauri/icon-source.png
cargo tauri icon src-tauri/icon-source.png
```
`icon-source.png` itself is gitignored (derived, regenerable in one command);
keep the `.svg` in sync with `index.html`'s favicon by hand if that ever
changes — nothing currently generates one from the other.

## Bundle identifier

`com.yahwehsworld.globe`, set once in `src-tauri/tauri.conf.json`. Changing it
after any store submission re-creates the app as a new listing — treat it as
fixed.
