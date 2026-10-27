import fcntl
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

T7 = Path('/Volumes/T7/yahwehs-globe-scenes')
MANIFEST = T7 / 'non-gamified-merged-manifest-v3.jsonl'
STATUS_DIR = T7 / 'non-gamified-merged-status-v3'
REVIEW_LOG = T7 / 'non-gamified-merged-review-v3.jsonl'
ARCHIVE = T7 / 'incoming-codex/manifest-review-reconciliation-20261016'
LOCK = ARCHIVE / '.reconcile.lock'


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def atomic_write(path, data):
    path = Path(path)
    fd, temp_name = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def main(event_id):
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    with open(LOCK, 'a+b') as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        lines = MANIFEST.read_text().splitlines()
        matches = [(index, json.loads(line)) for index, line in enumerate(lines)
                   if json.loads(line).get('id') == event_id]
        if len(matches) != 1:
            raise SystemExit(f'expected one manifest row for {event_id}, found {len(matches)}')
        index, row = matches[0]
        status_path = STATUS_DIR / f'{event_id}.json'
        status = json.loads(status_path.read_text())
        receipt_path = ARCHIVE / event_id / 'reconciliation.json'
        if (row.get('merged_review') == 'pass' and status.get('merged_review') == 'pass'
                and str(receipt_path) in (row.get('review_evidence') or [])
                and receipt_path.is_file()):
            print(f'{event_id}: already reconciled; no change')
            return
        image_path = Path(row['derivative'])
        image_sha = sha256(image_path)
        status_sha = status.get('derivative_sha256')
        manifest_sha = row.get('derivative_sha256')
        if not (image_sha == manifest_sha == status_sha):
            raise SystemExit(f'{event_id}: current image/status/manifest SHA mismatch')
        if row.get('merged_review', 'inherited') not in ('inherited', None):
            raise SystemExit(f'{event_id}: manifest review state is already {row.get("merged_review")}')
        if status.get('merged_review') != 'pass':
            raise SystemExit(f'{event_id}: sidecar is not PASS')
        source_sha = sha256(Path(row['source']))
        if source_sha != row.get('source_sha256') or source_sha != status.get('source_sha256'):
            raise SystemExit(f'{event_id}: source SHA mismatch')
        reviews = [json.loads(line) for line in REVIEW_LOG.read_text().splitlines()
                   if line.strip() and json.loads(line).get('id') == event_id]
        exact = [r for r in reviews
                 if (r.get('candidate_sha256') or r.get('merged_sha256')) == image_sha
                 and (r.get('decision') or r.get('result') or r.get('verdict', '')).lower() == 'pass']
        if len(exact) != 1:
            raise SystemExit(f'{event_id}: expected exactly one exact-SHA PASS review, found {len(exact)}')
        review = exact[0]
        if 'root' not in review.get('reviewer', '').lower() and 'root' not in review.get('note', '').lower():
            raise SystemExit(f'{event_id}: exact-SHA review does not include root review')
        reviewer_note = status.get('merged_review_note', '')
        if not reviewer_note.strip():
            raise SystemExit(f'{event_id}: status sidecar has no review rationale')

        item_dir = ARCHIVE / event_id
        item_dir.mkdir(exist_ok=False)
        receipt_path = item_dir / 'reconciliation.json'
        evidence = [str(REVIEW_LOG), str(receipt_path)]
        receipt = {
            'id': event_id,
            'decision': 'PASS',
            'source_sha256': source_sha,
            'candidate_sha256': image_sha,
            'review_record': review,
            'sidecar_review_note': reviewer_note,
            'sidecar_sha256_matches_current_image': True,
            'manifest_review_before': row.get('merged_review', 'inherited'),
            'status_review_before': status.get('merged_review'),
            'operation': 'reconcile_manifest_review_from_exact_sha_pass_record',
            'raw_or_historic_ok_true_changed': False
        }
        (item_dir / 'manifest-before.json').write_text(json.dumps(row, ensure_ascii=False, indent=2) + '\n')
        (item_dir / 'status-before.json').write_text(json.dumps(status, ensure_ascii=False, indent=2) + '\n')
        receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')

        row['merged_review'] = 'pass'
        row['merged_review_note'] = reviewer_note
        row['review_evidence'] = list(dict.fromkeys((row.get('review_evidence') or []) + evidence))
        status['review_evidence'] = list(dict.fromkeys((status.get('review_evidence') or []) + evidence))
        lines[index] = json.dumps(row, ensure_ascii=False)
        atomic_write(MANIFEST, ('\n'.join(lines) + '\n').encode())
        atomic_write(status_path, (json.dumps(status, ensure_ascii=False, indent=2) + '\n').encode())
        print(f'{event_id}: PASS metadata reconciled at SHA {image_sha}; backup/evidence {item_dir}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('usage: python3 tools/scenes/reconcile-exact-sha-pass.py EVENT_ID')
    main(sys.argv[1])
