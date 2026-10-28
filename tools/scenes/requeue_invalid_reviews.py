"""Re-queue squares whose latest review was thrown away as not blind (declared handoff/prompt/... as an input).

    python3 tools/scenes/requeue_invalid_reviews.py [--dry-run]

sync_reviews.py keeps such a square in pending_review forever (the request that produced the review was already consumed).
This moves the invalid review to review-invalid/ and writes a fresh review request so a reviewer looks at the picture again.
"""
import json, glob, os, sys, time, datetime
S = '/Volumes/T7/yahwehs-globe-scenes'; R = f'{S}/no-text-derivatives-v2'; Q = f'{S}/review-queue'
dry = '--dry-run' in sys.argv
need = {'image', 'factCard', 'vetoTable'}
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
n = 0
for f in sorted(glob.glob(f'{R}/review/*.json')):
    try: d = json.load(open(f))
    except Exception: continue
    inp = d.get('inputs')
    ok = isinstance(inp, list) and all(isinstance(i, dict) for i in inp) and {i.get('kind') for i in inp} == need and len(inp) == 3
    if ok: continue
    id = os.path.basename(f)[:-5]
    try: st = json.load(open(f'{R}/status/{id}.json'))
    except Exception: continue
    if st.get('state') != 'pending_review' or os.path.exists(f'{Q}/square-{id}.json'): continue
    live = f'{R}/live/{id}.png'
    if not os.path.isfile(live): continue
    n += 1
    if dry: continue
    os.makedirs(f'{R}/review-invalid', exist_ok=True)
    os.rename(f, f"{R}/review-invalid/{id}-{int(time.time())}.json")
    h = st.get('live_sha256') or d.get('subject', {}).get('sha256')
    json.dump({"schema": "review-request-v1", "id": id, "kind": "square", "subject": {"path": f"no-text-derivatives-v2/live/{id}.png", "sha256": h},
               "factCard": f"fact-cards/{id}.json", "generator": st.get('generator', d.get('generator', {})), "requestedAt": now(),
               "requestedBy": "requeue_invalid_reviews.py", "imagePath": live, "imageSha256": h, "factCardPath": f"{S}/fact-cards/{id}.json"},
              open(f'{Q}/square-{id}.json', 'w'), ensure_ascii=False, indent=2)
print(('would requeue ' if dry else 'requeued ') + str(n))
