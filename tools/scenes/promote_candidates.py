"""Promote drawn square candidates (state=not_started) into live/ and the review queue. No model involved.

    python3 tools/scenes/promote_candidates.py [--dry-run]

For each candidates-copilot/<id>.png (sidecar <id>.png.json): check size/aspect, run Apple Vision OCR (0 hits required),
copy to no-text-derivatives-v2/live/<id>.png, write evidence/<id>-ocr.json, set status/<id>.json to pending_review
and queue a review-request-v1 in review-queue/. Same steps Gemini's image session does. Rework/pending items are left alone.
An image with OCR hits or a bad size is recorded in candidates-*/promote-rejected.json and not retried.
"""
import json, os, glob, hashlib, subprocess, shutil, sys, datetime
from PIL import Image
S = '/Volumes/T7/yahwehs-globe-scenes'; R = f'{S}/no-text-derivatives-v2'; Q = f'{S}/review-queue'
dry = '--dry-run' in sys.argv
OCR = '/tmp/ocr_tf'
if not os.path.exists(OCR):
    subprocess.run(['swiftc', '-O', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ocr_text_free_images.swift'), '-o', OCR], check=True)
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
done = 0
for cdir, model in ((f'{R}/candidates-copilot', 'm365-copilot-image'), (f'{R}/candidates-codex', 'gpt-6.1-sol-image')):
    rej_p = f'{cdir}/promote-rejected.json'; rej = json.load(open(rej_p)) if os.path.exists(rej_p) else {}
    for f in sorted(glob.glob(f'{cdir}/*.png')):
        id = os.path.basename(f)[:-4]; sp = f'{R}/status/{id}.json'
        if not os.path.exists(sp): continue
        st = json.load(open(sp))
        if st.get('state') != 'not_started': continue
        h = sha(f)
        if rej.get(id) == h: continue
        w, hh = Image.open(f).size
        reason = None
        if w < 1536 or abs(w / hh - 16 / 9) > 0.02: reason = f'size {w}x{hh}'
        else:
            out = subprocess.run([OCR, f], capture_output=True, text=True).stdout.strip().splitlines()
            hits = json.loads(out[-1]).get('hits', []) if out else None
            if hits is None: reason = 'ocr failed'
            elif hits: reason = f'ocr hits {len(hits)}: ' + ' | '.join(x['text'] for x in hits[:3])
        if reason:
            print('REJECT', id, reason); rej[id] = h
            if not dry: json.dump(rej, open(rej_p, 'w'), ensure_ascii=False, indent=1)
            continue
        if dry: print('would promote', id); done += 1; continue
        live = f'{R}/live/{id}.png'; shutil.copyfile(f, live)
        json.dump({"id": id, "image_path": live, "image_sha256": h, "ocr_hits": 0, "raw_hits": [], "checked_at": now(), "tool": "tools/scenes/ocr_text_free_images.swift"},
                  open(f'{R}/evidence/{id}-ocr.json', 'w'), ensure_ascii=False, indent=2)
        st.update({"state": "pending_review", "status": "pending_review", "evidenceState": "pending_independent_review", "candidate_sha256": h, "live_sha256": h,
                   "candidate_path": live, "live_png": live, "ocr_hits": 0, "ocr_sha256": h, "ocr_evidence_path": f'{R}/evidence/{id}-ocr.json',
                   "generator": {"model": model, "session": "promote_candidates.py"}, "updated_at": now()})
        json.dump(st, open(sp, 'w'), ensure_ascii=False, indent=2)
        json.dump({"schema": "review-request-v1", "id": id, "kind": "square", "subject": {"path": f"no-text-derivatives-v2/live/{id}.png", "sha256": h},
                   "factCard": f"fact-cards/{id}.json", "generator": {"model": model, "session": "promote_candidates.py"}, "requestedAt": now(),
                   "requestedBy": "promote_candidates.py", "imagePath": live, "imageSha256": h, "factCardPath": f"{S}/fact-cards/{id}.json"},
                  open(f'{Q}/square-{id}.json', 'w'), ensure_ascii=False, indent=2)
        done += 1
print(('would promote ' if dry else 'promoted ') + str(done))
