"""Write codex-job-v1 files for every square that has not started (no live text-free image yet).

    python3 tools/scenes/build_square_jobs.py [--dry-run]

Source picture: non-gamified-merged-live-v3/<id>.png (the old HUD version). The job asks for the same
scene with every text/HUD element removed and the small top-left emblem kept, checked against the
event's fact card. Existing jobs (queued, claimed, done, promoted) are never duplicated.
"""
import json, os, glob, subprocess, sys
S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes')
J = f'{S}/codex-jobs'
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
dry = '--dry-run' in sys.argv

g = json.loads(subprocess.run([sys.executable, f'{REPO}/tools/scenes/gate_check.py', 'square', '--all', '--json'], capture_output=True, text=True).stdout)  # exits 1 while anything fails
todo = [i['id'] for i in g['items'] if i['state'] == 'not_started']
have = {os.path.basename(f)[len('square-'):-5] for f in glob.glob(f'{J}/**/square-*.json', recursive=True)}
n = 0
for id in todo:
    if id in have: continue
    src = f'{S}/non-gamified-merged-live-v3/{id}.png'
    if not os.path.isfile(src): print('no source', id); continue
    fc = json.load(open(f'{S}/fact-cards/{id}.json'))
    who = json.dumps(fc.get('mustShow', []), ensure_ascii=False)
    act = '；'.join(a['action'] for a in fc.get('keyAction', []))
    prompt = (f"Redraw this Bible scene as a clean, 100% text-free cute 3D voxel diorama, keeping the attached image's style, composition idea and palette. "
              f"Event: {fc['verses']['ref']}. What must be shown: {who}. Key action: {act}"
              + (" No people in the scene." if fc.get('noPeople') else "") +
              "\n去掉原图所有文字和界面：标题、经文出处、左上和右上的半透明说明卡、罗马数字、箭头按钮（remove ALL titles, scripture references, translucent cards, numerals and UI arrows）。"
              "保留左上角那个小立体图标，但不要它后面的方框（keep the small 3D voxel emblem in the top-left corner, with no rectangular box behind it）。"
              "画面任何地方都不能有文字（strictly NO text, letters, numbers, or inscriptions anywhere）。"
              "If the original shows anything the rules forbid (God in human form, Trinitarian composition, shaved or long-haired men, Roman/medieval armour in the Old Testament, heraldic banners, pseudo-writing, cloned identical people), fix it.")
    job = {"schema": "codex-job-v1", "kind": "square", "id": id, "prompt": prompt, "refs": [src],
           "out": f"{S}/no-text-derivatives-v2/candidates-codex/{id}.png", "minWidth": 1536, "source": "build_square_jobs.py"}
    n += 1
    if not dry:
        json.dump(job, open(f'{J}/square-{id}.json', 'w'), ensure_ascii=False, indent=1)
print(f"{'would write' if dry else 'wrote'} {n} jobs ({len(todo)} not started)")
