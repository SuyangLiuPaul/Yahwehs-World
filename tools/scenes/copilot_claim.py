"""Claim the next square job for the Copilot line (takes from the END of the queue; Codex takes from the front).

    python3 tools/scenes/copilot_claim.py        # prints JSON {id, src, prompt}; moves the job to claimed-copilot/
Drive the browser yourself; when the PNG is in ~/Downloads/copilot-<id>.png run copilot_save.py <id>.
"""
import json, os, glob, sys
from PIL import Image
S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes'); J = f'{S}/codex-jobs'
SP = os.environ.get('COPILOT_TMP', '/tmp/copilot-src'); os.makedirs(SP, exist_ok=True)
jobs = sorted(glob.glob(f'{J}/square-*.json'), key=os.path.getmtime, reverse=True)
for f in jobs:
    if any(w in open(f, encoding='utf-8').read() for w in ('耶稣', '基督', 'Jesus', 'Christ')): continue   # Jesus scenes need the master reference; Codex/Gemini only
    c = f'{J}/claimed-copilot/' + os.path.basename(f); os.makedirs(os.path.dirname(c), exist_ok=True)
    try: os.rename(f, c)
    except OSError: continue
    j = json.load(open(c)); src = f"{SP}/{j['id']}.jpg"
    Image.open(j['refs'][0]).convert('RGB').save(src, quality=90)
    p = j['prompt'].replace('\n', ' ')
    print(json.dumps({'id': j['id'], 'src': src, 'prompt':
        "Generate ONE new image (16:9 landscape) by editing the attached picture. Keep its exact cute 3D voxel/block diorama style, palette, lighting and camera, and keep the small 3D voxel emblem in the top-left corner. "
        "Every man must have short natural scissor-cut hair well above the collar, varied from person to person (never shaved, never buzz-cut, never collar-length). God is never shown in human form. No Roman or medieval armour, no heraldic banners. "
        "Strictly NO text, letters, numbers or inscriptions anywhere. " + p}, ensure_ascii=False)); sys.exit(0)
print('{"id": null}')
