"""Claim not-started square jobs for the Higgsfield line and write a job file for the Haiku that runs it.

    python3 tools/scenes/build_higgsfield_jobs.py <count> <out.json>

Takes <count> jobs whose status is not_started (and that have no candidate yet, no Jesus in the fact card) from codex-jobs/, moves them to
codex-jobs/claimed-higgsfield/ so Copilot / Codex do not draw them twice, converts the source picture to a jpg in the hf folder and writes
[{id, jpg, prompt}]. The prompt is the same ASCII text as copilot_claim.py (the source picture carries HUD text cards that must not be copied).
"""
import json, os, glob, re, sys
from PIL import Image
S = '/Volumes/T7/yahwehs-globe-scenes'; J = f'{S}/codex-jobs'; R = f'{S}/no-text-derivatives-v2'
H = os.path.expanduser('~/Library/Application Support/yahwehs-world-kick/hf'); os.makedirs(H, exist_ok=True)
n, out = int(sys.argv[1]), sys.argv[2]
jobs = []
def make_prompt(ref):
    prompt = ("The attached picture is a style and composition guide for the Bible scene " + ref + ". It contains text: title cards, a scripture-reference box and caption boxes. Do NOT copy any text, cards, boxes or labels. "
              "Draw a NEW 16:9 image of the same scene in the same cute 3D voxel/block diorama style, camera, palette and lighting, with scenery continuing where any cards were. "
              "No text, letters, numbers or labels anywhere; keep only the small 3D voxel emblem icon in the very top-left corner, with no box behind it and nothing written on it. "
              "Every man has short natural scissor-cut hair ending well above the collar (back of the neck and ears visible), varied from person to person, never shaved, buzz-cut or collar-length, including old men with white hair. "
              "Everyone wears modest ancient clothes with tunics reaching at least the knee. God is never shown in human form. No Roman or Greek architecture (no columned temples, no round-arch bridges), no heraldic banners, no cloned identical people.")
    return re.sub(r'[^\x20-\x7e]', ' ', prompt)
for f in sorted(glob.glob(f'{J}/square-*.json'), key=os.path.getmtime):
    if len(jobs) >= n: break
    id = os.path.basename(f)[7:-5]
    try: st = json.load(open(f'{R}/status/{id}.json')); j = json.load(open(f))
    except Exception: continue
    if st.get('state') != 'not_started' or not j.get('refs'): continue
    if any(os.path.isfile(c) for c in glob.glob(f'{R}/candidates-*/{id}.png')): continue
    try:
        if any(w in open(f'{S}/fact-cards/{id}.json').read() for w in ('耶稣', '基督', '弥赛亚', '受膏')): continue
    except Exception: continue
    src = j['refs'][0]
    if not os.path.isfile(src): continue
    os.makedirs(f'{J}/claimed-higgsfield', exist_ok=True)
    try: os.rename(f, f'{J}/claimed-higgsfield/{os.path.basename(f)}')
    except OSError: continue
    jpg = f'{H}/{id}.jpg'; Image.open(src).convert('RGB').save(jpg, quality=88)
    m = re.match(r'^(.*)-(\d+)-(\d+)$', id); ref = f"{m.group(1).replace('-', ' ').title()} {m.group(2)}:{m.group(3)}" if m else id
    jobs.append({'id': id, 'jpg': jpg, 'prompt': make_prompt(ref)})
# second pass: not-started events whose job was already used (candidate rejected for leftover text, or no job left): redraw from the original
def active_job(id):
    return any(os.path.exists(f'{J}/{d}square-{id}.json') for d in ('', 'claimed/', 'claimed-gemini/', 'claimed-copilot/', 'claimed-higgsfield/'))
def pending_ok(id):
    for d in glob.glob(f'{R}/candidates-*/'):
        c = f'{d}{id}.png'
        if not os.path.isfile(c): continue
        try: rej = json.load(open(f'{d}promote-rejected.json'))
        except Exception: rej = {}
        import hashlib
        if rej.get(id) != hashlib.sha256(open(c, 'rb').read()).hexdigest(): return False   # a candidate still waits for promotion
    return True
if len(jobs) < n:
    done_ids = {j['id'] for j in jobs}
    for f in sorted(glob.glob(f'{R}/status/*.json')):
        if len(jobs) >= n: break
        try: st = json.load(open(f))
        except Exception: continue
        id = st['id']
        if st.get('state') != 'not_started' or id in done_ids or active_job(id) or not pending_ok(id): continue
        src = f'{S}/non-gamified-merged-live-v3/{id}.png'
        if not os.path.isfile(src): continue
        try:
            if any(w in open(f'{S}/fact-cards/{id}.json').read() for w in ('耶稣', '基督', '弥赛亚', '受膏')): continue
        except Exception: continue
        if os.path.isfile(f'{R}/live/{id}.png') and False: continue
        jpg = f'{H}/{id}.jpg'; Image.open(src).convert('RGB').save(jpg, quality=88)
        m = re.match(r'^(.*)-(\d+)-(\d+)$', id); ref = f"{m.group(1).replace('-', ' ').title()} {m.group(2)}:{m.group(3)}" if m else id
        jobs.append({'id': id, 'jpg': jpg, 'prompt': make_prompt(ref)})
json.dump(jobs, open(out, 'w'), indent=1)
print(f'claimed {len(jobs)} -> {out}')
