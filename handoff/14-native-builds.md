# 14 · Native builds (Windows / macOS / Android / iOS)

The web app (`npm run build`) is the source of truth. Everything here wraps
that same `dist/` in a native shell via [Tauri 2](https://tauri.app) — one
Rust-based wrapper, not four separate rewrites. `src-tauri/` holds the shell;
`src-tauri/gen/android` and `src-tauri/gen/apple` are generated projects and
are gitignored — regenerate them with the init commands below rather than
expecting them in a fresh clone.

Requested directly: iOS, Android (APK), Windows, macOS all usable. Status as
of 2026-09-16:

| Platform | Builds locally on this Mac | Needs from the owner |
|---|---|---|
| macOS | **Yes — built, launched, screenshotted.** Native window, correct title, globe renders, `Go to…` present, no console errors | Nothing to *run* it; a paid Apple Developer account ($99/yr) only if notarization (no Gatekeeper prompt) or the Mac App Store is wanted |
| Android (APK) | **Yes — built, signed with a debug key, installed on a running emulator (`emulator-5554`), launched, screenshotted.** Same result: globe renders, markers and labels correct, `Go to…` present | Nothing to *sideload* it; only a Google Play Console account ($25 one-time) if it should go on the Play Store. The release APK ships **unsigned** — `apksigner` with a real release key (or Play's own signing) replaces the debug key used only for this verification |
| Windows | **No** — Tauri does not cross-compile a Windows target from macOS. Not yet run anywhere; CI is written but has not been triggered | Nothing to *run* the unsigned .exe/.msi it will produce; a code-signing cert removes the SmartScreen prompt |
| iOS | Project scaffolded (`src-tauri/gen/apple`), not yet built to a device or simulator | An Apple ID at minimum. A free ID can sign for on-device testing but the provisioning expires in 7 days and needs re-signing from Xcode each time; the $99/yr Apple Developer Program signs for 1 year, unlocks TestFlight, and is required for the App Store. **Which of these the owner wants is still open — do not pick one and start signing without asking.** |

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
