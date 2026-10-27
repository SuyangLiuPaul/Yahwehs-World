"""Save a Copilot image as a square candidate: python3 tools/scenes/copilot_save.py <id>   (reads ~/Downloads/copilot-<id>.png)."""
import sys, os, json, hashlib, datetime, shutil
from PIL import Image
S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes'); id = sys.argv[1]
src = os.path.expanduser(f'~/Downloads/copilot-{id}.png'); out = f'{S}/no-text-derivatives-v2/candidates-copilot/{id}.png'
os.makedirs(os.path.dirname(out), exist_ok=True)
im = Image.open(src).convert('RGB'); w, h = im.size; nh = round(w * 9 / 16)
if h > nh: im = im.crop((0, 0, w, nh))   # Copilot returns 3:2; keep the top (emblem) and trim the bottom
im.save(out)
job = json.load(open(f'{S}/codex-jobs/claimed-copilot/square-{id}.json'))
json.dump({"model": "m365-copilot-image", "sha256": hashlib.sha256(open(out, 'rb').read()).hexdigest(), "width": im.width, "height": im.height, "job": job,
           "finishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}, open(out + '.json', 'w'), ensure_ascii=False, indent=1)
os.rename(f'{S}/codex-jobs/claimed-copilot/square-{id}.json', f'{S}/codex-jobs/done/square-{id}.json')
tr = os.path.expanduser('~/.Trash/copilot-dl'); os.makedirs(tr, exist_ok=True); shutil.move(src, f'{tr}/{id}-{int(datetime.datetime.now().timestamp())}.png')
print('saved', out, im.size)
