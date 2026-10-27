#!/bin/bash
# Move finished event pictures from ~/Downloads into assets-scenes/incoming/ (runs in the background during a
# ChatGPT run, so the Mac tab's runner needs no agent). Only files named <event-id>.png / "<event-id> (1).png"
# whose id is in screen-queue.json are moved; everything else in Downloads is left alone.
A=/Users/pliu0036/Documents/CodingProject/assets-scenes
IDS=$(python3 -c "import json;print('\n'.join(r[0] for r in json.load(open('$A/screen-queue.json'))))")
end=$(( $(date +%s) + ${1:-43200} ))
while [ "$(date +%s)" -lt "$end" ]; do
  for f in ~/Downloads/*.png; do
    [ -e "$f" ] || continue
    b=$(basename "$f" .png); id=${b% (*)}
    if grep -qx -- "$id" <<<"$IDS" && [ ! -e "$A/incoming/$id.png" ]; then
      sleep 2; mv -n "$f" "$A/incoming/$id.png" && echo "$(date +%H:%M:%S) moved $id"
    fi
  done
  sleep 15
done
