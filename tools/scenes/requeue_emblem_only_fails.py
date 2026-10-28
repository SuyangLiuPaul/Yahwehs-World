"""Re-queue squares whose only failures were about the top-left emblem (owner: the emblem is a design element, not scene content).

    python3 tools/scenes/requeue_emblem_only_fails.py [--dry-run]

Finds rework / three-strike squares whose failed vetoes are all anachronism / godDepiction / modesty / trinityComposition notes that talk about the
emblem / icon / upper-left corner, and queues a fresh review of the current picture under the corrected reviewer prompts.
"""
import json, glob, os, re, sys, datetime
S = '/Volumes/T7/yahwehs-globe-scenes'; R = f'{S}/no-text-derivatives-v2'; Q = f'{S}/review-queue'
dry = '--dry-run' in sys.argv
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
EMB = re.compile(r'emblem|icon|upper-left|top-left|upper left|top left', re.I)
OK_KEYS = {'anachronism', 'godDepiction', 'trinityComposition', 'modesty'}
n = 0
for f in sorted(glob.glob(f'{R}/review/*.json')):
    id = os.path.basename(f)[:-5]
    try: d = json.load(open(f)); st = json.load(open(f'{R}/status/{id}.json'))
    except Exception: continue
    if st.get('state') != 'rework' or d.get('verdict') != 'fail' or os.path.exists(f'{Q}/square-{id}.json'): continue
    bad = {k: v for k, v in (d.get('veto') or {}).items() if (v.get('answer') if isinstance(v, dict) else v) in ('fail', 'unclear')}
    if not bad or any(k not in OK_KEYS for k in bad): continue
    if not all(EMB.search((v.get('note', '') if isinstance(v, dict) else '')) for v in bad.values()): continue
    live = f'{R}/live/{id}.png'
    if not os.path.isfile(live): continue
    n += 1; print('requeue', id, sorted(bad))
    if dry: continue
    os.makedirs(f'{R}/review-before-emblem-rule', exist_ok=True); os.rename(f, f'{R}/review-before-emblem-rule/{id}.json')
    h = st.get('live_sha256')
    json.dump({"schema": "review-request-v1", "id": id, "kind": "square", "subject": {"path": f"no-text-derivatives-v2/live/{id}.png", "sha256": h},
               "factCard": f"fact-cards/{id}.json", "generator": st.get('generator', d.get('generator', {})), "requestedAt": now(),
               "requestedBy": "requeue_emblem_only_fails.py", "imagePath": live, "imageSha256": h, "factCardPath": f"{S}/fact-cards/{id}.json"},
              open(f'{Q}/square-{id}.json', 'w'), ensure_ascii=False, indent=2)
print(('would requeue ' if dry else 'requeued ') + str(n))
