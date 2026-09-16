#!/usr/bin/env bash
# Cuts the git tag AND the GitHub Release that src/updates.ts's update
# check reads (GET /repos/.../releases/latest). Ported from SeekSparks'
# tools/tag_release.sh, with one difference: SeekSparks has a CI
# workflow that builds and attaches an APK the moment a v* tag lands,
# so that script only needed to push the tag. yahwehs-globe has no such
# workflow yet (.github/workflows/desktop-build.yml is manual-dispatch
# only, and there is no Android release workflow at all) — so this
# script also creates the GitHub Release directly via `gh release
# create`, with no assets. Attach desktop/Android build artifacts to it
# by hand (or via `gh release upload`) until that automation exists.
#
# Run this after committing a release. It refuses rather than guesses:
# the version it tags is the one in the COMMITTED package.json, so a
# tag can never name a build that is not in the history.
#
# Usage:
#   tools/tag_release.sh                 # tag HEAD as v<package.json version>
#   tools/tag_release.sh --dry-run       # say what it would do
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT"

DRY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# The version as COMMITTED, not as sitting in the working tree. Tagging
# an uncommitted bump would put the tag on the previous commit and ship
# a release whose version string is a lie.
committed_package="$(git show HEAD:package.json)"
VERSION="$(awk -F'"' '/^[[:space:]]*"version":/ {print $4; exit}' <<<"$committed_package")"
if [[ -z "$VERSION" ]]; then
  echo "could not read version from the committed package.json" >&2
  exit 1
fi
TAG="v$VERSION"

working_version="$("$PROJECT/tools/bump_version.sh" --print)"
if [[ "$working_version" != "$VERSION" ]]; then
  echo "REFUSING: package.json says $working_version but HEAD says $VERSION." >&2
  echo "Commit the version bump first — a tag must name a build that is" >&2
  echo "in the history, or the release reports a version nobody can check out." >&2
  exit 1
fi

# package.json and tauri.conf.json must agree — that is the whole point
# of bump_version.sh writing both in lock-step. If they have drifted,
# the native build's getVersion() and the web build's release tag would
# disagree about what "this version" means.
committed_tauri_conf="$(git show HEAD:src-tauri/tauri.conf.json)"
tauri_version="$(awk -F'"' '/^[[:space:]]*"version":/ {print $4; exit}' <<<"$committed_tauri_conf")"
if [[ "$tauri_version" != "$VERSION" ]]; then
  echo "REFUSING: tauri.conf.json says $tauri_version but package.json says $VERSION." >&2
  echo "Native builds would report a different version than the web release." >&2
  exit 1
fi

# A tag names a build every reader's updater will fetch, so it must
# name a commit that is on origin/main. Skipped, loudly, when there is
# no origin/main yet rather than refusing for want of a signal that
# does not exist.
git fetch -q origin main 2>/dev/null || true
if git rev-parse --verify -q origin/main >/dev/null; then
  if ! git merge-base --is-ancestor HEAD origin/main; then
    echo "REFUSING: HEAD ($(git rev-parse --short HEAD)) is not on origin/main." >&2
    echo "Push first. A tag on a commit nobody else has is a release nobody" >&2
    echo "can reproduce." >&2
    exit 1
  fi
else
  echo "note: origin/main not found; skipping the on-main check." >&2
fi

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
    echo "Tag $TAG already exists on origin — nothing to do."
    echo "(A version is released once. Bump before releasing again.)"
    exit 0
  fi
  echo "==> $TAG exists locally but origin does not have it — pushing"
  if [[ "$DRY" = "1" ]]; then
    echo "--dry-run: would push the existing $TAG"
    exit 0
  fi
  git push origin "$TAG"
else
  echo "==> $TAG at $(git rev-parse --short HEAD)"
  if [[ "$DRY" = "1" ]]; then
    echo "--dry-run: would tag, push, and create the GitHub Release"
    exit 0
  fi
  git tag -a "$TAG" -m "$TAG"
  if ! git push origin "$TAG"; then
    git tag -d "$TAG" >/dev/null
    echo "!!! push of $TAG failed; the local tag was removed so the next" >&2
    echo "!!! run starts clean instead of reporting 'nothing to do'." >&2
    exit 1
  fi
fi

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "GitHub Release $TAG already exists — nothing to do."
else
  echo "==> creating GitHub Release $TAG"
  gh release create "$TAG" --title "$TAG" --generate-notes
fi

echo
echo "✓ $TAG pushed and released."
echo "  the in-app update check now sees $TAG."
echo "  attach build artifacts with: gh release upload $TAG <file>"
