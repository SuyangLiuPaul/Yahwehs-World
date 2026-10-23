#!/bin/bash
# Independent reviewer loop for 雅伟之界 (handoff/29). Owner starts it in a Mac terminal; Ctrl-C stops it.
# Each round: one `claude -p` run reviews up to 15 queued items; when the queue is empty, wait 10 minutes.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
S="${SCENES_ROOT:-/Volumes/T7/yahwehs-globe-scenes}"
QUEUE="$S/review-queue"
MODEL="${REVIEW_MODEL:-claude-opus-5-5}"
mkdir -p "$QUEUE/done" "$QUEUE/logs"

pending() { find "$QUEUE" -maxdepth 1 -name '*.json' ! -name '.tmp-*' | wc -l | tr -d ' '; }

while true; do
  if [ ! -d "$S" ]; then echo "$(date '+%F %T') T7 not mounted ($S); waiting"; sleep 600; continue; fi
  n="$(pending)"
  if [ "$n" = "0" ]; then echo "$(date '+%F %T') queue empty; waiting 10 min"; sleep 600; continue; fi
  run="$(date +%H%M%S)-$$"
  log="$QUEUE/logs/$(date +%F)-$run.log"
  echo "$(date '+%F %T') $n queued; run $run -> $log"
  ( cd "$REPO" && CLAUDE_REVIEW_RUN="$run" claude -p "$(cat "$REPO/tools/scenes/claude_review_prompt.md")" \
      --model "$MODEL" \
      --add-dir "$S" \
      --allowedTools "Read" "Write" "Glob" "Grep" \
        "Bash(python3 tools/scenes/gate_check.py:*)" "Bash(ffmpeg:*)" "Bash(ffprobe:*)" \
        "Bash(shasum:*)" "Bash(mv:*)" "Bash(mkdir:*)" "Bash(ls:*)" "Bash(date:*)" "Bash(echo:*)" \
      --disallowedTools "WebFetch" "WebSearch" "Bash(rm:*)" "Bash(curl:*)" "Bash(osascript:*)" "Bash(open:*)" \
  ) >"$log" 2>&1
  status=$?
  tail -n 20 "$log"
  if [ $status -ne 0 ]; then echo "claude -p exited $status; waiting 10 min (login or quota?)"; sleep 600; fi
done
