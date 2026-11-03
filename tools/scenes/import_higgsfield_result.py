"""Import a Higgsfield result image into the square pipeline (staging first, then one candidate at a time).

    python3 tools/scenes/import_higgsfield_result.py stage <id> <url-or-path> <job_id> [credits]   # download, check, save as hf-redraw/cand/<id>-<n>.png
    python3 tools/scenes/import_higgsfield_result.py place <id> [n]                                # copy staged candidate n (default: newest unplaced) to candidates-higgsfield/<id>.png (+ .json sidecar)

promote_candidates.py reads candidates-higgsfield/<id>.png and sets the status to pending_review; it takes ONE file per id per folder, so staged
alternatives wait in hf-redraw/cand/ until the previous one has been reviewed (fail -> rework). Every spend is appended to hf-redraw/spend.jsonl.
Checks: 16:9 within 2%, width >= 1280 (the promote limit). Resizes nothing; refuses anything smaller.
"""
import json, os, sys, hashlib, shutil, glob, io, datetime, urllib.request
from PIL import Image
S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes'); R = f'{S}/no-text-derivatives-v2'; H = f'{S}/hf-redraw'; C = f'{H}/cand'
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def check(im):
    w, h = im.size
    if w < 1280 or abs(w / h - 16 / 9) > 0.02: raise ValueError(f'size {w}x{h}')

def stage(id, src, job_id='', credits=0.0):
    data = open(src, 'rb').read() if os.path.exists(src) else urllib.request.urlopen(urllib.request.Request(src, headers={'User-Agent': 'curl/8'}), timeout=120).read()
    im = Image.open(io.BytesIO(data)); check(im)
    os.makedirs(C, exist_ok=True)
    n = 1
    while os.path.exists(f'{C}/{id}-{n}.png'): n += 1
    out = f'{C}/{id}-{n}.png'; im.convert('RGB').save(out)
    sha = hashlib.sha256(open(out, 'rb').read()).hexdigest()
    json.dump({'id': id, 'n': n, 'sha256': sha, 'job_id': job_id, 'model': 'gpt_image_2_5', 'width': im.width, 'height': im.height, 'credits': credits, 'stagedAt': now()}, open(out + '.json', 'w'), indent=1)
    with open(f'{H}/spend.jsonl', 'a') as f: f.write(json.dumps({'at': now(), 'id': id, 'job_id': job_id, 'credits': credits, 'file': out}) + '\n')
    return out

def place(id, n=None):
    if n is None:
        placed = {json.load(open(p)).get('n') for p in glob.glob(f'{C}/{id}-*.png.placed')}
        n = next(i for i in range(49, 0, -1) if os.path.exists(f'{C}/{id}-{i}.png') and i not in placed)
    src = f'{C}/{id}-{n}.png'; dst = f'{R}/candidates-higgsfield/{id}.png'
    shutil.copyfile(src, dst)
    meta = json.load(open(src + '.json')); meta['placedAt'] = now()
    json.dump({'model': 'higgsfield-image-2.5', **meta}, open(dst + '.json', 'w'), indent=1)
    json.dump({'n': n, 'at': now()}, open(f'{src}.placed', 'w'))
    return dst

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'stage': print(stage(a[1], a[2], a[3] if len(a) > 3 else '', float(a[4]) if len(a) > 4 else 0.0))
    elif a and a[0] == 'place': print(place(a[1], int(a[2]) if len(a) > 2 else None))
    else: print(__doc__)
