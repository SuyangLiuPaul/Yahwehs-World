#!/usr/bin/env bash
# Packs the app content (dist-shell/: thumbnails, Bible data, pages) into one zip with a SHA-256 file, for the GitHub Actions shell builds.
#
# Why: the content cannot be built on a CI runner. The pictures come from the T7 drive (scripts/build-pictures.mjs) and the Bible data from
# the Words checkout (scripts/reader-editions.mjs), neither of which a runner has. So the content is built here, once, and the workflows
# (.github/workflows/shell-*.yml) download this zip from a GitHub release and build the shells around it.
#
#   npm run app:dist && tools/pack_shell_content.sh
#   gh release upload <tag> dist-app/dist-shell-<version>.zip dist-app/dist-shell-<version>.zip.sha256   # YOU run this, when you decide to
set -euo pipefail
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT"
[ -f dist-shell/data/packs.json ] || { echo "dist-shell/ is missing or incomplete: run npm run app:dist first" >&2; exit 1; }
VERSION="$(awk -F'"' '/^[[:space:]]*"version":/ {print $4; exit}' src-tauri/tauri.conf.json)"
OUT="$PROJECT/dist-app"; mkdir -p "$OUT"
ZIP="$OUT/dist-shell-$VERSION.zip"
[ ! -e "$ZIP" ] || { echo "$ZIP exists already; move it away first" >&2; exit 1; }
(cd dist-shell && zip -q -r -X "$ZIP" .)
(cd "$OUT" && shasum -a 256 "$(basename "$ZIP")" > "$(basename "$ZIP").sha256")
ls -l "$ZIP" | awk '{print $5 " bytes  " $9}'
cat "$ZIP.sha256"
