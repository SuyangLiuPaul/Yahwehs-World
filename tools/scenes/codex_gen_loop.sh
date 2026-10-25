#!/bin/bash
# Codex (gpt-6.1-sol image generation) as a second image generator for 雅伟之界 (square and still lines).
# The image conversation writes jobs; this loop draws candidates; the image conversation checks and promotes
# them (it stays the only writer of manifest.json / status/). Ctrl-C stops it.
#
# Job file: S/codex-jobs/<kind>-<id>.json
#   {"schema":"codex-job-v1","kind":"square|still|anchor","id":"...","prompt":"<full text>",
#    "refs":["/abs/path/ref1.png", ...],          # anchors, the source/old image to edit, style refs
#    "out":"/abs/path/candidates-codex/<kind>/<id>.png", "minWidth":1536}
# Result: the PNG at "out" plus "<out>.json" sidecar {model, sha256, width, height, job, finishedAt}.
# Finished jobs move to codex-jobs/done/, failed ones to codex-jobs/failed/ with the log path.
set -u
S="${SCENES_ROOT:-/Volumes/T7/yahwehs-globe-scenes}"
J="$S/codex-jobs"; CL="$J/claimed"; LOGS="$J/logs"
ONCE="${ONCE:-0}"
mkdir -p "$CL" "$J/done" "$J/failed" "$LOGS"
trap 'for f in "$CL"/*-$$.json; do [ -e "$f" ] && mv -n "$f" "$J/$(basename "${f%-$$.json}").json"; done; exit 0' INT TERM

while true; do
  if [ ! -d "$S" ]; then echo "$(date '+%F %T') T7 not mounted"; sleep 600; continue; fi
  job=""
  for f in $(ls -tr "$J"/*.json 2>/dev/null); do
    c="$CL/$(basename "${f%.json}")-$$.json"
    if mv -n "$f" "$c" 2>/dev/null && [ -e "$c" ]; then job="$c"; break; fi
  done
  if [ -z "$job" ]; then echo "$(date '+%F %T') no jobs; waiting 10 min"; [ "$ONCE" = 1 ] && exit 0; sleep 600; continue; fi
  name="$(basename "${job%-$$.json}")"
  log="$LOGS/$(date +%F-%H%M%S)-$name.log"
  args=$(python3 -I - "$job" <<'PY'
import json,sys,shlex,os
j=json.load(open(sys.argv[1]))
assert j.get("schema")=="codex-job-v1" and j["kind"] in ("square","still","anchor") and j.get("prompt") and j.get("out")
refs=[r for r in j.get("refs",[]) if os.path.isfile(r)]
os.makedirs(os.path.dirname(j["out"]),exist_ok=True)
print(" ".join(shlex.quote(r) for r in refs)); print(shlex.quote(j["out"])); print(int(j.get("minWidth",1536)))
PY
) || { echo "bad job $name"; mv "$job" "$J/failed/$name.json"; continue; }
  refs=$(echo "$args" | sed -n 1p); out=$(echo "$args" | sed -n 2p | tr -d "'"); minw=$(echo "$args" | sed -n 3p)
  pf="$LOGS/$name.prompt.txt"
  python3 -I - "$job" "$out" "$minw" > "$pf" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); out=sys.argv[2]; w=sys.argv[3]
style={"square":"Keep the exact visual style of the attached reference image(s): cute 3D voxel/block diorama, same palette, lighting and camera height; no text, letters, numbers or logos anywhere.",
       "still":"Photorealistic historical cinema still. Attached images are character reference sheets and/or the previous version of this scene: keep each named person's face, hair, beard and clothing consistent with their reference sheet, but show them as people in the scene, never as a reference sheet.",
       "anchor":"Character reference sheet: plain neutral limestone studio background, the same person shown full-body front view on the left and 3/4 waist-up portrait on the right, no divider line, no text."}[j["kind"]]
print(f"""Generate ONE image with your image generation tool, 16:9 landscape, at least {w} px wide. {style}
Men: short, natural scissor-cut hair above the collar, varied from person to person; never shaved, buzz-cut, faded or with shaved sides (Nazirites excepted). God is never shown in human form. No Trinitarian composition. No heraldic banners, no anachronisms. No text in the image.
Save the final image as {out} (PNG) and report its path and pixel size. Write nothing else to disk.

SCENE / SUBJECT:
{j['prompt']}""")
PY
  echo "$(date '+%F %T') drawing $name -> $out"
  eval codex exec -m gpt-6.1-sol -s workspace-write --skip-git-repo-check --ephemeral -C "$(dirname "$out")" \
       --add-dir "$S" $( [ -n "$refs" ] && for r in $refs; do printf -- "-i %s " "$r"; done ) -- < "$pf" > "$log" 2>&1
  status=$?
  if [ $status -eq 0 ] && [ -s "$out" ]; then
    python3 -I - "$job" "$out" <<'PY'
import json,sys,hashlib,datetime
from PIL import Image
j,out=sys.argv[1],sys.argv[2]; im=Image.open(out)
json.dump({"model":"gpt-6.1-sol-image","sha256":hashlib.sha256(open(out,'rb').read()).hexdigest(),"width":im.width,"height":im.height,
           "job":json.load(open(j)),"finishedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")},
          open(out+".json","w"),ensure_ascii=False,indent=1)
PY
    mv "$job" "$J/done/$name.json"; echo "  done $name"
  else
    if grep -qiE "rate limit|usage limit|spend cap|quota|429" "$log"; then
      mv "$job" "$J/$name.json"; echo "  QUOTA $name: job put back; waiting 30 min"; sleep 1800
    else
      mv "$job" "$J/failed/$name.json"; echo "  FAILED $name (exit $status) log $log"
    fi
  fi
  [ "$ONCE" = 1 ] && exit 0
done
