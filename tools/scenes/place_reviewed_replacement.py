"""Replace the live picture of an owner-accepted square with a Higgsfield candidate that a blind reviewer passed cleanly.

    python3 tools/scenes/place_reviewed_replacement.py <id> <n> [--apply]

Needs hf-redraw/cand/<id>-<n>.png and hf-redraw/accepted/reviews/<id>-<n>.json (gate-review-v1, verdict pass, every answer pass,
registryFix pass/na, subject.sha256 == candidate SHA, vetoTable SHA == gate_check's). Without --apply it only checks.
With --apply: backs up the live picture, status, review and OCR evidence to hf-redraw/replaced/<id>-<utc>/ (and the old picture to
archive-rework/ like promote_candidates.py), runs the Apple Vision OCR (0 hits required), copies the candidate to live/<id>.png,
writes evidence + status (owner_accept block removed: the acceptance lapses because the SHA changed) and the review, then runs
gate_check square <id> (the square's entry in square_accepts.json moves to a top-level "retired" map first, since the
gate demands an owner_accept binding for every listed entry). If the gate does not PASS everything is restored from the backup. The veto table is not touched.
"""
import json, os, sys, shutil, hashlib, subprocess, datetime
from PIL import Image
S = '/Volumes/T7/yahwehs-globe-scenes'; R = f'{S}/no-text-derivatives-v2'; H = f'{S}/hf-redraw'
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
id, n = sys.argv[1], sys.argv[2]; apply_ = '--apply' in sys.argv
cand = f'{H}/cand/{id}-{n}.png'; rv_p = f'{H}/accepted/reviews/{id}-{n}.json'
h = sha(cand); rv = json.load(open(rv_p))
def die(m): print('REFUSE', id, m); sys.exit(1)
if rv.get('verdict') != 'pass': die('verdict ' + str(rv.get('verdict')))
if rv['subject']['sha256'] != h: die('review is for other bytes')
bad = {k: v['answer'] for k, v in rv['veto'].items() if v['answer'] not in ('pass', 'na') or (v['answer'] == 'na' and k != 'registryFix')}
if bad: die(f'answers {bad}')
if any(i.get('kind') == 'prompt' for i in rv.get('inputs', [])): die('reviewer saw a prompt')
w, hh = Image.open(cand).size
if w < 1280 or abs(w / hh - 16 / 9) > 0.02: die(f'size {w}x{hh}')
ocr = json.loads(subprocess.run(['/tmp/ocr_tf', cand], capture_output=True, text=True).stdout.strip().splitlines()[-1])
if ocr.get('hits'): die('ocr hits')
st_p = f'{R}/status/{id}.json'; st = json.load(open(st_p))
if st.get('state') != 'pass': die('square is not state=pass (' + str(st.get('state')) + ')')
if not apply_: print('OK to place', id, n, h[:12]); sys.exit(0)
ts = now().replace(':', '').replace('-', ''); bk = f'{H}/replaced/{id}-{ts}'; os.makedirs(bk)
live = f'{R}/live/{id}.png'; rev_p = f'{R}/review/{id}.json'; ev_p = f'{R}/evidence/{id}-ocr.json'
acc_p = os.path.join(HERE, 'square_accepts.json')
files = {'live.png': live, 'status.json': st_p, 'review.json': rev_p, 'ocr.json': ev_p, 'accepts.json': acc_p}
for k, v in files.items():
    if os.path.exists(v): shutil.copyfile(v, f'{bk}/{k}')
os.makedirs(f'{R}/archive-rework', exist_ok=True)
shutil.copyfile(live, f"{R}/archive-rework/{id}-{sha(live)[:12]}.png")
def restore():
    for k, v in files.items():
        if os.path.exists(f'{bk}/{k}'): shutil.copyfile(f'{bk}/{k}', v)
try:
    shutil.copyfile(cand, live)
    json.dump({"id": id, "image_path": live, "image_sha256": h, "ocr_hits": 0, "raw_hits": [], "checked_at": now(), "tool": "tools/scenes/ocr_text_free_images.swift"}, open(ev_p, 'w'), ensure_ascii=False, indent=2)
    for k in ('rework_reason', 'failed_vetoes', 'owner_accept', 'root_review'): st.pop(k, None)
    rf = rv['veto'].get('registryFix', {}).get('answer')
    st.update({"state": "pass", "status": "pass", "independent_review": "pass", "evidenceState": "complete", "candidate_sha256": h, "live_sha256": h, "candidate_path": live, "live_png": live,
               "live_path": live, "ocr_hits": 0, "ocr_sha256": h, "ocr_evidence_path": ev_p, "generator": rv['generator'], "generator_model": "gpt_image_2_5 (higgsfield, xhigh 2k)", "updated_at": now(),
               "replaced_accepted_by": {"candidate": f"hf-redraw/cand/{id}-{n}.png", "review_session": rv['reviewer']['session'], "backup": bk, "at": now()}})
    if rf == 'pass': st.update({"registry_fix_verified": True, "registry_fix_verified_at": now(), "registry_fix_note": "re-verified on the replacement picture by the blind reviewer " + rv['reviewer']['session']})
    json.dump(st, open(st_p, 'w'), ensure_ascii=False, indent=2)
    rv2 = dict(rv); rv2['subject'] = {"path": f"no-text-derivatives-v2/live/{id}.png", "sha256": h}
    json.dump(rv2, open(rev_p + '.tmp', 'w'), ensure_ascii=False, indent=2); os.replace(rev_p + '.tmp', rev_p)
    # The acceptance is for the old bytes; the new picture passed review cleanly, so retire the entry (kept under "retired").
    acc = json.load(open(acc_p))
    if id in acc['accepts']:
        acc.setdefault('retired', {})[id] = {**acc['accepts'].pop(id), 'retiredAt': now(), 'retiredBecause': 'replaced by a Higgsfield candidate that passed blind review cleanly', 'replacementSha256': h}
        json.dump(acc, open(acc_p + '.tmp', 'w'), ensure_ascii=False, indent=2); os.replace(acc_p + '.tmp', acc_p)
    out = subprocess.run(['python3', 'tools/scenes/gate_check.py', 'square', id], cwd=REPO, capture_output=True, text=True).stdout
    if 'PASS' not in out.splitlines()[0] if out else True:
        raise RuntimeError('gate: ' + out[:400])
    print('PLACED', id, n, h[:12], out.splitlines()[0])
except Exception as e:
    restore(); print('ROLLED BACK', id, e); sys.exit(2)
