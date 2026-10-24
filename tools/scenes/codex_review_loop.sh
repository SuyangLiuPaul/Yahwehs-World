#!/bin/bash
# Second blind reviewer for 雅伟之界 (handoff/29): Codex (OpenAI) reviews kind=still requests only,
# so the Gemini review conversation and this loop never take the same request.
# Each round claims up to 10 still-*.json by moving them to review-queue/claimed-codex/ (atomic mv),
# runs one `codex exec`, and puts back anything it did not finish. Ctrl-C stops it.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
S="${SCENES_ROOT:-/Volumes/T7/yahwehs-globe-scenes}"
Q="$S/review-queue"; C="$Q/claimed-codex"
BATCH="${BATCH:-10}"; ONCE="${ONCE:-0}"
mkdir -p "$C" "$Q/done" "$Q/logs"

release() { for f in "$C"/*.json; do [ -e "$f" ] && mv -n "$f" "$Q/"; done; }
trap 'release; exit 0' INT TERM

while true; do
  if [ ! -d "$S" ]; then echo "$(date '+%F %T') T7 not mounted; waiting"; sleep 600; continue; fi
  release
  n=0
  for f in $(ls -tr "$Q"/still-*.json 2>/dev/null); do
    mv -n "$f" "$C/" 2>/dev/null && n=$((n+1)); [ "$n" -ge "$BATCH" ] && break
  done
  if [ "$n" = "0" ]; then echo "$(date '+%F %T') no still requests; waiting 15 min"; [ "$ONCE" = 1 ] && exit 0; sleep 900; continue; fi
  run="$(date +%H%M%S)-$$"; log="$Q/logs/codex-$(date +%F)-$run.log"
  echo "$(date '+%F %T') claimed $n; run $run -> $log"
  ( cd "$REPO" && CODEX_REVIEW_RUN="$run" codex exec -m gpt-6.1-sol -s workspace-write --skip-git-repo-check \
      --ephemeral -C "$REPO" --add-dir "$S" "$(cat "$REPO/tools/scenes/codex_review_prompt.md")

Your run id is $run: use it where the prompt says $CODEX_REVIEW_RUN." ) >"$log" 2>&1
  status=$?
  tail -n 15 "$log"
  release
  if [ $status -ne 0 ]; then echo "codex exited $status; waiting 15 min (quota?)"; [ "$ONCE" = 1 ] && exit $status; sleep 900; fi
  [ "$ONCE" = 1 ] && exit 0
done
