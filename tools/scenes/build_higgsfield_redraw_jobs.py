"""Build Higgsfield (GPT Image 2.5) redraw jobs for the failing square pictures.

    python3 tools/scenes/build_higgsfield_redraw_jobs.py <out.json> [id ...]

Without ids: every square-<id>.json still queued in codex-jobs/ plus matthew-7-13 (job in done/). For each id it writes a jpg of the
live (failed) picture to hf-redraw/ (the style/composition reference to upload to Higgsfield) and an ASCII prompt made of the same
base text as build_higgsfield_jobs.py + the per-square 'how to change' note from square_redraw_notes.json + the reviewer's reason.
Output: [{id, jpg, prompt}]. Does not move or claim any job file (agy lanes keep working the same jobs).
"""
import json, os, glob, re, sys
from PIL import Image
S = '/Volumes/T7/yahwehs-globe-scenes'; J = f'{S}/codex-jobs'; R = f'{S}/no-text-derivatives-v2'
HERE = os.path.dirname(os.path.abspath(__file__))
H = f'{S}/hf-redraw'; os.makedirs(H, exist_ok=True)
EXTRA = {'matthew-7-13': 'Jesus appears exactly ONCE, standing at the narrow gate: an ordinary Jewish man in a plain modest tunic, short natural scissor-cut hair above the collar, short trimmed beard, no halo, no glow. '
         'A large crowd walks INTO the wide gate and wide road on one side, and the road behind that wide gate visibly leads down to a ruined, collapsing, burning city with broken walls and smoke (destruction). '
         'The narrow gate on the other side is small, with a narrow uphill path to a green bright place (life), and only two or three people go through it. No other figure resembles Jesus (different robe colours, hair, beards).'}
def base(ref, jesus):
    p = ("Style and composition guide: the attached picture, Bible scene " + ref + ". Redraw the SAME scene as a NEW 16:9 image in the same cute 3D voxel/block diorama style, camera, palette and lighting; keep everything not mentioned below unchanged, including the small voxel emblem icon in the top-left corner (no box behind it). "
         "No text, letters or numbers anywhere. Men have short natural scissor-cut hair above the collar (never shaved, buzz-cut, faded or shoulder-length). All tunics reach below the knee, no bare thighs. God is never shown in human form. No Roman/Greek architecture or armour, no columns or pediments, no round-arch bridges, no crosses, no cactus, no cloned people.")
    if jesus: p += ' Jesus, if present, is an ordinary Jewish man in a plain tunic, short scissor-cut hair, short trimmed beard, no halo, shown only once.'
    return p
notes = json.load(open(f'{HERE}/square_redraw_notes.json'))['notes']
ids = sys.argv[2:]
if not ids:
    ids = sorted(os.path.basename(f)[7:-5] for f in glob.glob(f'{J}/square-*.json')) + ['matthew-7-13']
jobs = []
for id in ids:
    f = next((x for x in (f'{J}/square-{id}.json', f'{J}/done/square-{id}.json') if os.path.isfile(x)), None)
    if not f: print('no job', id); continue
    j = json.load(open(f)); src = f'{R}/live/{id}.png'
    jpg = f'{H}/{id}.jpg'; Image.open(src).convert('RGB').save(jpg, quality=88)
    m = re.match(r'^(.*)-(\d+)-(\d+)$', id); ref = f"{m.group(1).replace('-', ' ').title()} {m.group(2)}:{m.group(3)}"
    reason = re.search(r'这次要改正：(.*?)(?:\n|$)', j['prompt']); reason = reason.group(1) if reason else ''
    reason = re.sub(r'[^\x20-\x7e]', ' ', reason.split('; Registry')[0])
    fix = notes.get(id, '') or EXTRA.get(id, '')
    if id in EXTRA and id in notes: fix = notes[id] + ' ' + EXTRA[id]
    prompt = base(ref, id in EXTRA or 'jesus' in (notes.get(id, '') + reason).lower()) + ' REQUIRED CHANGE (must be clearly visible): ' + fix + ' Problem found in the old picture: ' + reason
    jobs.append({'id': id, 'jpg': jpg, 'prompt': re.sub(r'[^\x20-\x7e]', ' ', prompt)})
json.dump(jobs, open(sys.argv[1], 'w'), indent=1); print(len(jobs), 'jobs ->', sys.argv[1])
