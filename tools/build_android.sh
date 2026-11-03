#!/usr/bin/env bash
# Android for the stores: a release AAB for Play (internal testing first) or a debug APK for a quick look on an emulator or a phone.
#
#   tools/build_android.sh --aab      # release AAB, package com.yahwehword.world, signed with the upload key if you point it at one
#   tools/build_android.sh --debug    # debug APK, debug-signed by the Android SDK's own debug key (never the upload key)
#
# Signing, in order of what this script does with it: NOTHING is read from disk by this script. You pass the PATH of the keystore and
# the alias as Gradle properties, and the passwords as environment variables that Gradle reads itself:
#   export ORG_GRADLE_PROJECT_ywKeystorePath=/path/to/your-upload-keystore.jks
#   export ORG_GRADLE_PROJECT_ywKeyAlias=<alias>
#   export YW_KEYSTORE_PASSWORD=...   YW_KEY_PASSWORD=...  (the second defaults to the first)
# Without the path the AAB is built unsigned (Play will not take it; sign it with bundletool/jarsigner or set the variables).
# ORG_GRADLE_PROJECT_ywBuildNumber=2 (1-9) re-uploads the same visible version with a higher versionCode.
# The GitHub APK (package com.yahwehsworld.globe, the old release key) is tools/build_apk.sh.
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE=""
for a in "$@"; do case "$a" in --aab) MODE=aab ;; --debug) MODE=debug ;; *) echo "unknown argument: $a" >&2; exit 2 ;; esac; done
[ -n "$MODE" ] || { echo "usage: tools/build_android.sh --aab | --debug" >&2; exit 2; }

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export NDK_HOME="${NDK_HOME:-$ANDROID_HOME/ndk/$(ls "$ANDROID_HOME/ndk" | sort | tail -1)}"
export PATH="$JAVA_HOME/bin:$HOME/.cargo/bin:$ANDROID_HOME/platform-tools:$PATH"
[ -x "$JAVA_HOME/bin/keytool" ] || { echo "no JDK 17 at $JAVA_HOME (brew install openjdk@17)" >&2; exit 1; }
export VITE_SHELL_CHANNEL=store
unset ORG_GRADLE_PROJECT_ywAppId 2>/dev/null || true     # the store id is the default; only build_apk.sh overrides it

cd "$PROJECT"
[ -d src-tauri/gen/android ] || cargo tauri android init --ci
python3 tools/shell/android_patch.py src-tauri/gen/android

OUT="$PROJECT/dist-app"; mkdir -p "$OUT"
VERSION="$(awk -F'"' '/^[[:space:]]*"version":/ {print $4; exit}' src-tauri/tauri.conf.json)"
if [ "$MODE" = aab ]; then
  [ -n "${ORG_GRADLE_PROJECT_ywKeystorePath:-}" ] || echo "note: ywKeystorePath is not set; the bundle will be UNSIGNED" >&2
  cargo tauri android build --aab
  ART="$(find src-tauri/gen/android/app/build/outputs/bundle -name '*.aab' | head -1)"
  [ -n "$ART" ] || { echo "no .aab was produced" >&2; exit 1; }
  NAMED="$OUT/YahwehsWorld-$VERSION-play.aab"
else
  cargo tauri android build --debug --apk
  ART="$(find src-tauri/gen/android/app/build/outputs/apk -name '*debug*.apk' | head -1)"
  [ -n "$ART" ] || { echo "no debug .apk was produced" >&2; exit 1; }
  NAMED="$OUT/YahwehsWorld-$VERSION-debug.apk"
fi
cp "$ART" "$NAMED"

# what the artifact says it is (an .aab is a zip: read its manifest with bundletool if installed; an .apk with aapt2)
AAPT2="$(find "$ANDROID_HOME/build-tools" -name aapt2 | sort -r | head -1)"
if [ "$MODE" = debug ]; then
  "$AAPT2" dump badging "$NAMED" | grep -E "^package:|application-label(-zh-TW|-ru)?:|sdkVersion|targetSdkVersion" | head
fi
ls -lh "$NAMED" | awk '{print "  " $5 "  '"$NAMED"'"}'
