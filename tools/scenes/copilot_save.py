"""Save a web-drawn image as a square candidate: python3 tools/scenes/copilot_save.py <id> [site]
   site = copilot (default) | gemini0 | gemini1 | chatgpt ; reads ~/Downloads/<site>-<id>.png, writes candidates-<site>/<id>.png"""
import sys, os, json, hashlib, datetime, shutil
from PIL import Image
S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes'); id = sys.argv[1]; site = sys.argv[2] if len(sys.argv) > 2 else 'copilot'
src = os.path.expanduser(f'~/Downloads/{site}-{id}.png'); out = f'{S}/no-text-derivatives-v2/candidates-{site}/{id}.png'
os.makedirs(os.path.dirname(out), exist_ok=True)
im = Image.open(src).convert('RGB'); w, h = im.size; nh = round(w * 9 / 16)
if h > nh: im = im.crop((0, 0, w, nh))   # Copilot returns 3:2; keep the top (emblem) and trim the bottom
im.save(out)
jp = f'{S}/codex-jobs/claimed-copilot/square-{id}.json'
job = json.load(open(jp)) if os.path.exists(jp) else {'id': id, 'note': 'no claimed job (drawn by hand)'}
json.dump({"model": {"copilot": "m365-copilot-image", "gemini0": "gemini-web-image", "gemini1": "gemini-web-image", "chatgpt": "chatgpt-web-image", "higgsfield": "higgsfield-image-2.5"}[site], "site": site, "sha256": hashlib.sha256(open(out, 'rb').read()).hexdigest(), "width": im.width, "height": im.height, "job": job,
           "finishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}, open(out + '.json', 'w'), ensure_ascii=False, indent=1)
if os.path.exists(jp): os.rename(jp, f'{S}/codex-jobs/done/square-{id}.json')
tr = os.path.expanduser('~/.Trash/copilot-dl'); os.makedirs(tr, exist_ok=True); shutil.move(src, f'{tr}/{id}-{int(datetime.datetime.now().timestamp())}.png')
print('saved', out, im.size)
