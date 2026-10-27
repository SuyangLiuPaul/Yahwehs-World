"""Apply verified verdicts to pictures in assets-scenes/incoming/.

    python3 tools/scenes/apply_review.py verdicts.json

verdicts.json = [{"id", "ok", "note"}] (after Claude has checked every fail on a crop).
ok   -> incoming/<id>.png moves to raw/<id>.png
fail -> incoming/<id>.png moves to rejected/<id>-<n>.png (next free n), and a redo row with the failure note
        appended as "Important: ..." goes to assets-scenes/redo-queue.json (unless the event already has 3 tries;
        then the best try is kept and the verdict is marked flag:true for the owner).
Every verdict is appended to review.jsonl.
"""
import json, os, sys, shutil, glob, re

A = '/Users/pliu0036/Documents/CodingProject/assets-scenes/'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_screen_queue import rows as queue_rows

verdicts = json.load(open(sys.argv[1]))
qrows = {r[0]: r for r in json.load(open(A + 'screen-queue.json'))}
live = {r[0]: r for r in queue_rows()}
redo_path = A + 'redo-queue.json'
redo = json.load(open(redo_path)) if os.path.exists(redo_path) else []
log = open(A + 'review.jsonl', 'a')
moved = {'ok': 0, 'fail': 0, 'missing': 0}
for v in verdicts:
    i = v['id']; src = A + 'incoming/' + i + '.png'
    if not os.path.exists(src):
        moved['missing'] += 1; print('missing', i); continue
    if v['ok']:
        assert not os.path.exists(A + 'raw/' + i + '.png'), i
        shutil.move(src, A + 'raw/' + i + '.png'); moved['ok'] += 1
        log.write(json.dumps({'id': i, 'ok': True, 'note': 'ok (2026-09-23 screen run): ' + v['note']}, ensure_ascii=False) + '\n')
        continue
    tries = [int(m.group(1)) for f in os.listdir(A + 'rejected') for m in [re.match(re.escape(i) + r'-(\d+)\.png$', f)] if m]
    n = max(tries, default=0) + 1
    shutil.move(src, A + 'rejected/%s-%d.png' % (i, n)); moved['fail'] += 1
    log.write(json.dumps({'id': i, 'ok': False, 'note': v['note']}, ensure_ascii=False) + '\n')
    row = list(live.get(i) or qrows[i])
    if n >= 5:  # older runs already used some numbers; allow a few more tries in this run
        print("5 tries reached for", i, '- keep the best one by hand and mark flag:true'); continue
    row[6] = (row[6] or '') + ' Important (the last try failed): ' + v['note'] + ' Avoid this.'
    redo = [r for r in redo if r[0] != i] + [row]
log.close()
json.dump(redo, open(redo_path, 'w'), ensure_ascii=False, indent=0)
print(moved, 'redo rows waiting:', len(redo))
