"""Write a redraw job for every square in state=rework that has no active job (not queued, not claimed), except 3-strike items.

    python3 tools/scenes/build_rework_jobs.py [--dry-run]

The job redraws the failing picture (live/<id>.png as the reference) with the reviewer's failure notes under 「这次要改正」,
the same shape as the first 371 rework jobs. Run after sync_reviews.py.
"""
import json, os, glob, sys
S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes'); J = f'{S}/codex-jobs'; R = f'{S}/no-text-derivatives-v2'
dry = '--dry-run' in sys.argv
active = set()
for d in ('', 'claimed/', 'claimed-gemini/', 'claimed-copilot/'):
    for f in glob.glob(f'{J}/{d}square-*.json'): active.add(os.path.basename(f)[7:-5])
esc = set()
try: esc = set(json.load(open(f'{S}/escalations/three-strikes.json')).get('escalatedIds', []))
except Exception: pass
n = 0
for f in sorted(glob.glob(f'{R}/status/*.json')):
    st = json.load(open(f)); id = st['id']
    if st.get('state') != 'rework' or id in active or id in esc or st.get('escalated_three_strikes'): continue
    live = f'{R}/live/{id}.png'
    if not os.path.isfile(live): continue
    try: fc = json.load(open(f'{S}/fact-cards/{id}.json'))
    except Exception: continue
    who = json.dumps(fc.get('mustShow', []), ensure_ascii=False)
    act = '；'.join(a['action'] for a in fc.get('keyAction', []))
    prompt = (f"Redraw this Bible scene as a cute 3D voxel diorama, keeping the attached image's style, composition idea and palette. "
              f"Event: {fc['verses']['ref']}. What must be shown: {who}. Key action: {act}"
              + (" No people in the scene." if fc.get('noPeople') else "") +
              "\n保留左上角那个小立体图标（和原图同一个图标，keep the exact small 3D voxel icon in the top-left corner from the reference image），"
              "画面任何地方都不能有文字（strictly NO text, letters, numbers, or inscriptions anywhere）."
              f"\n这次要改正：{st.get('rework_reason', '')}")
    job = {"schema": "codex-job-v1", "kind": "square", "id": id, "prompt": prompt, "refs": [live],
           "out": f"{R}/candidates-codex/{id}.png", "minWidth": 1536, "source": "build_rework_jobs.py"}
    n += 1
    if not dry: json.dump(job, open(f'{J}/square-{id}.json', 'w'), ensure_ascii=False, indent=1)
print(f"{'would write' if dry else 'wrote'} {n} rework jobs")
