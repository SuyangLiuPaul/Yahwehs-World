#!/usr/bin/env bash
# Single-command web release for yahwehs-globe. Ported from SeekSparks'
# tools/release_web.sh — same versioning rule, same reasoning:
#
# THE VERSION DOES NOT MOVE FOR A DEV DEPLOY. The version number is the
# owner's release marker, not a progress counter: the in-app update
# check (src/updates.ts) and GitHub Releases both read it, so a version
# that moved without a release tells every user something shipped when
# nothing did.
#
# Which left dev builds indistinguishable from each other, so a dev
# build shows e.g. `0.1.0.12`, where the last number is the commit
# count since the last `v*` tag. It is derived, not stored: nothing to
# bump, nothing to forget, and it cannot disagree with the tree it was
# built from. It goes ONLY into the displayed version, via the
# VITE_DISPLAY_VERSION env var Vite exposes as
# import.meta.env.VITE_DISPLAY_VERSION — never into package.json or
# tauri.conf.json. public/version.json (what verify_site below checks)
# and Tauri's getVersion() both keep reading the plain release version,
# so a dev suffix can never leak into a machine comparison.
#
# A run with --include-prod is a RELEASE and carries no dev suffix.
#
# Usage:
#   tools/release_web.sh                   # build, deploy dev only (NO bump)
#   tools/release_web.sh --bump            # bump the patch version first
#   tools/release_web.sh --include-prod    # ALSO push to yahwehsworld prod (REQUIRES user OK)
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NETLIFY="${NETLIFY:-$HOME/Documents/CodingProject/SmartHome/node_modules/.bin/netlify}"

if [ ! -x "$NETLIFY" ]; then
  echo "netlify CLI not found or not executable at:" >&2
  echo "  $NETLIFY" >&2
  echo "Restore it with:" >&2
  echo "  (cd ~/Documents/CodingProject/SmartHome && npm install netlify-cli --no-save --legacy-peer-deps)" >&2
  echo "or point NETLIFY= at another copy." >&2
  exit 1
fi

BUMP=0
INCLUDE_PROD=0
for arg in "$@"; do
  case "$arg" in
    --bump) BUMP=1 ;;
    --no-bump) BUMP=0 ;;
    --include-prod) INCLUDE_PROD=1 ;;
  esac
done

if [[ "$BUMP" = "1" ]]; then
  "$PROJECT/tools/bump_version.sh"
fi
APP_VERSION="$("$PROJECT/tools/bump_version.sh" --print)"
echo "==> APP_VERSION=$APP_VERSION"

# The version a READER sees. Same as APP_VERSION for a release; for a
# dev deploy it carries the dev build number described at the top.
DISPLAY_VERSION="$APP_VERSION"
if [[ "$INCLUDE_PROD" = "0" ]]; then
  LAST_TAG="$(git -C "$PROJECT" describe --tags --abbrev=0 --match 'v*' \
    2>/dev/null || true)"
  DEV_BUILD="$(git -C "$PROJECT" rev-list --count \
    "${LAST_TAG:+$LAST_TAG..}HEAD" 2>/dev/null || echo 0)"
  DISPLAY_VERSION="$APP_VERSION.$DEV_BUILD"
  echo "==> dev build $DEV_BUILD since ${LAST_TAG:-the first commit};" \
    "readers see $DISPLAY_VERSION"
fi

cd "$PROJECT"

RELEASE_VERIFY_SLEEP="${RELEASE_VERIFY_SLEEP:-5}"
verify_site() {
  local name="$1" host="$2" served="" attempt
  for attempt in 1 2 3; do
    served="$(curl -fsS --max-time 30 "https://$host/version.json" 2>/dev/null \
      | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    if [[ "$served" = "$APP_VERSION" ]]; then
      echo "  ✓ $name — https://$host serves v$APP_VERSION"
      return 0
    fi
    if [[ "$attempt" != "3" ]]; then sleep "$RELEASE_VERIFY_SLEEP"; fi
  done
  echo "  ✗ $name — https://$host serves version '${served:-none}', expected $APP_VERSION" >&2
  return 1
}

deploy_sites() {
  local -a pids=() names=() hosts=()
  local failed=0 id name host
  for entry in "$@"; do
    IFS=':' read -r id name host <<<"$entry"
    echo "==> deploying $name ($id)"
    # --no-build is LOAD-BEARING. Without it the CLI runs netlify.toml's
    # own `npm run build` and uploads THAT, discarding the bundle built
    # above — and with it VITE_DISPLAY_VERSION, which only exists in this
    # shell. The first run of this script deployed a bundle with no dev
    # version in it and still reported success.
    "$NETLIFY" deploy --prod --no-build --site "$id" --dir dist \
      --message "v$APP_VERSION $name" &
    pids+=("$!")
    names+=("$name")
    hosts+=("$host")
  done
  local i
  for i in "${!pids[@]}"; do
    if ! wait "${pids[$i]}"; then
      echo "!!! deploy FAILED: ${names[$i]}" >&2
      failed=1
    fi
  done
  if [ "$failed" -ne 0 ]; then
    echo "!!! at least one site did not receive this build. Nothing was" >&2
    echo "!!! released. Fix the cause and re-run; do not tag." >&2
    exit 1
  fi
  echo "==> verifying what each site serves"
  for i in "${!names[@]}"; do
    if ! verify_site "${names[$i]}" "${hosts[$i]}"; then
      failed=1
    fi
  done
  if [ "$failed" -ne 0 ]; then
    echo "!!! the CLI reported success but at least one site above is not" >&2
    echo "!!! serving v$APP_VERSION. Nothing counts as released until it" >&2
    echo "!!! does. Re-run the deploy for that site; do not tag." >&2
    exit 1
  fi
}

echo "==> building web bundle"
VITE_DISPLAY_VERSION="$DISPLAY_VERSION" npm run build

# "id:name:host" — the host is what verify_site re-fetches version.json
# from after the deploy, so it must be the address readers actually
# use, not the Netlify alias.
SITES=(
  "20521d7e-6559-4bd1-a51e-f276f67d5986:dev:yahwehsworld-dev.netlify.app"
)
if [[ "$INCLUDE_PROD" = "1" ]]; then
  echo "==> --include-prod set; build will also go to yahwehsworld prod."
  SITES+=("be08eb2a-6b57-4013-bb21-2729aa11e0bb:prod:world.yahwehword.com")
fi
deploy_sites "${SITES[@]}"

echo
echo "✓ v$DISPLAY_VERSION deployed."
echo "  next: git commit + push"
echo "  then:  tools/tag_release.sh   # cuts the GitHub Release"
echo "         (without it the in-app update check keeps reporting the"
echo "          last tag, which is not the build you just deployed)"
