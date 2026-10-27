#!/bin/bash
# Second blind reviewer for 雅伟之界 (handoff/29): Codex (OpenAI) reviews kind=$KIND (default still; KIND=square for the square line) and never images drawn by OpenAI-family models (gpt/codex/chatgpt/copilot),
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
  for f in $(ls -tr "$Q"/${KIND:-still}-*.json 2>/dev/null); do
    # never review an image Codex drew itself: those stay in the queue for the Gemini reviewer
    python3 -I -c 'import json,sys; m=str(json.load(open(sys.argv[1])).get("generator",{}).get("model","")).lower(); sys.exit(1 if any(k in m for k in ("gpt","codex","openai","copilot")) else 0)' "$f" 2>/dev/null || continue
    mv -n "$f" "$C/" 2>/dev/null && n=$((n+1)); [ "$n" -ge "$BATCH" ] && break
  done
  if [ "$n" = "0" ]; then echo "$(date '+%F %T') no ${KIND:-still} requests; waiting 15 min"; [ "$ONCE" = 1 ] && exit 0; sleep 900; continue; fi
  run="$(date +%H%M%S)-$$"; log="$Q/logs/codex-$(date +%F)-$run.log"
  echo "$(date '+%F %T') claimed $n; run $run -> $log"
  ( cd "$REPO" && CODEX_REVIEW_RUN="$run" codex exec -m gpt-6.1-sol -s workspace-write --skip-git-repo-check \
      --ephemeral -C "$REPO" --add-dir "$S" "$(cat "$REPO/tools/scenes/codex_review_prompt.md")

Your run id is $run: use it where the prompt says \$CODEX_REVIEW_RUN." ) >"$log" 2>&1
  status=$?
  tail -n 15 "$log"
  release
  if [ $status -ne 0 ]; then w=900; grep -qiE "spend cap|usage limit|quota" "$log" && w=3600; echo "codex exited $status; waiting $((w/60)) min (quota?)"; [ "$ONCE" = 1 ] && exit $status; sleep $w; fi
  [ "$ONCE" = 1 ] && exit 0
done
