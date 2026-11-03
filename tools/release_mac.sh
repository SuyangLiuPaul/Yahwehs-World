#!/usr/bin/env bash
# macOS direct download: a universal, Developer-ID-signed, notarised and stapled DMG.  NOT RUN YET (needs the owner's Developer ID
# certificate and a notarytool keychain profile; docs/gallery-shells.md has the one-time steps).
#
# Nothing secret is stored or read here. Two names come from the environment:
#   APPLE_SIGNING_IDENTITY   the certificate's name in the login keychain, e.g. "Developer ID Application: <name> (<TEAMID>)"
#   NOTARY_PROFILE           the profile created once with `xcrun notarytool store-credentials "$NOTARY_PROFILE"`
#                            (default name: yahwehs-world-notary). The credentials live in the keychain, never in a file.
#
#   tools/release_mac.sh               # signed + notarised + stapled DMG in dist-app/
#   tools/release_mac.sh --unsigned    # no certificate: universal app + DMG for a quick look (Gatekeeper will warn)
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT"
export PATH="$HOME/.cargo/bin:$PATH"
UNSIGNED=0
for a in "$@"; do case "$a" in --unsigned) UNSIGNED=1 ;; *) echo "unknown argument: $a" >&2; exit 2 ;; esac; done

VERSION="$(awk -F'"' '/^[[:space:]]*"version":/ {print $4; exit}' src-tauri/tauri.conf.json)"
NOTARY_PROFILE="${NOTARY_PROFILE:-yahwehs-world-notary}"
OUT="$PROJECT/dist-app"; mkdir -p "$OUT"

for t in aarch64-apple-darwin x86_64-apple-darwin; do
  rustup target list --installed | grep -qx "$t" || { echo "missing Rust target $t: rustup target add $t" >&2; exit 1; }
done

# the content: thumbnails + Bible data + pages (npm run app:dist); the direct build checks GitHub releases for updates
export VITE_SHELL_CHANNEL=direct

if [ "$UNSIGNED" = 1 ]; then
  echo "==> unsigned universal build"
  unset APPLE_SIGNING_IDENTITY || true
  cargo tauri build --target universal-apple-darwin --config '{"bundle":{"macOS":{"signingIdentity":null}}}'
else
  : "${APPLE_SIGNING_IDENTITY:?set APPLE_SIGNING_IDENTITY to the Developer ID Application certificate name (see docs/gallery-shells.md)}"
  security find-identity -v -p codesigning | grep -qF "$APPLE_SIGNING_IDENTITY" || { echo "no such signing identity in the keychain: $APPLE_SIGNING_IDENTITY" >&2; exit 1; }
  echo "==> signed universal build (hardened runtime)"
  cargo tauri build --target universal-apple-darwin
fi

BUNDLE="src-tauri/target/universal-apple-darwin/release/bundle"
APP="$(find "$BUNDLE/macos" -maxdepth 1 -name '*.app' | head -1)"
DMG="$(find "$BUNDLE/dmg" -maxdepth 1 -name '*.dmg' | head -1)"
[ -n "$APP" ] && [ -n "$DMG" ] || { echo "the build reported success but produced no .app/.dmg under $BUNDLE" >&2; exit 1; }
NAMED="$OUT/YahwehsWorld-$VERSION-macOS-universal.dmg"
cp "$DMG" "$NAMED"

echo "==> what the build says it is"
plutil -p "$APP/Contents/Info.plist" | grep -E 'CFBundle(Identifier|ShortVersionString|DisplayName|Name)|LSMinimumSystemVersion'
lipo -archs "$APP/Contents/MacOS/"* | head -1

if [ "$UNSIGNED" = 1 ]; then
  echo "unsigned DMG: $NAMED"; exit 0
fi

echo "==> signing the DMG"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$NAMED"
codesign --verify --deep --strict --verbose=2 "$APP"
echo "==> notarising (waits for Apple; credentials come from the keychain profile $NOTARY_PROFILE)"
xcrun notarytool submit "$NAMED" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$NAMED"
xcrun stapler validate "$NAMED"
spctl --assess --type open --context context:primary-signature --verbose=2 "$NAMED"
shasum -a 256 "$NAMED"
echo "ok: $NAMED"
