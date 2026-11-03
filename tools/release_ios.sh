#!/usr/bin/env bash
# iOS + iPadOS: archive and send to TestFlight (App Store Connect).  NOT RUN YET: needs the owner's App Store Connect app record
# (bundle id com.yahwehword.world) and Xcode signed in to the Apple account that owns it (docs/gallery-shells.md, "Xcode login").
# No password, key or token is read or stored: signing is Xcode's automatic signing with the signed-in account.
#
#   APPLE_DEVELOPMENT_TEAM=<10-character team id> tools/release_ios.sh [--export-only]
#
#   --export-only    write the .ipa to dist-app/ instead of uploading (destination=export)
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT"
export PATH="$HOME/.cargo/bin:$PATH"
: "${APPLE_DEVELOPMENT_TEAM:?set APPLE_DEVELOPMENT_TEAM to the 10-character Apple team id}"
[[ "$APPLE_DEVELOPMENT_TEAM" =~ ^[A-Z0-9]{10}$ ]] || { echo "APPLE_DEVELOPMENT_TEAM does not look like a team id" >&2; exit 2; }
DEST=upload
for a in "$@"; do case "$a" in --export-only) DEST=export ;; *) echo "unknown argument: $a" >&2; exit 2 ;; esac; done

export VITE_SHELL_CHANNEL=store      # a store build never offers a download outside the store
VERSION="$(awk -F'"' '/^[[:space:]]*"version":/ {print $4; exit}' src-tauri/tauri.conf.json)"
OUT="$PROJECT/dist-app"; mkdir -p "$OUT"

echo "==> (re)generating the Xcode project with the team set"
cargo tauri ios init --ci
python3 tools/shell/ios_patch.py src-tauri/gen/apple

echo "==> building the archive"
cargo tauri ios build --export-method app-store-connect

ARCHIVE="$(find src-tauri/gen/apple/build -maxdepth 2 -name '*.xcarchive' | head -1)"
[ -n "$ARCHIVE" ] || { echo "no .xcarchive under src-tauri/gen/apple/build" >&2; exit 1; }
echo "archive: $ARCHIVE"
plutil -p "$ARCHIVE/Info.plist" | grep -E 'CFBundleIdentifier|CFBundleShortVersionString|SigningIdentity|Team'

OPTS="$(mktemp -t ywexport).plist"
sed -e "s/TEAMID_PLACEHOLDER/$APPLE_DEVELOPMENT_TEAM/" -e "s#<string>upload</string>#<string>$DEST</string>#" src-tauri/ios/ExportOptions.testflight.plist > "$OPTS"
plutil -lint "$OPTS"
echo "==> exportArchive (destination=$DEST)"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$OPTS" -exportPath "$OUT/ios-$VERSION" -allowProvisioningUpdates
echo "done. Builds appear in App Store Connect > TestFlight after Apple's processing (minutes to an hour)."
