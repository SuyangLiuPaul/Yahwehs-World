import fcntl
import hashlib
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

T7 = Path('/Volumes/T7/yahwehs-globe-scenes')
MANIFEST = T7 / 'non-gamified-merged-manifest-v3.jsonl'
STATUS_DIR = T7 / 'non-gamified-merged-status-v3'
REVIEW_LOG = T7 / 'non-gamified-merged-review-v3.jsonl'
LOCK = T7 / 'incoming-codex/.review-register.lock'


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def atomic_write(path, data):
    fd, temp_name = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def main(event_id, report_path):
    report = [json.loads(line) for line in Path(report_path).read_text().splitlines() if line.strip()]
    matches = [item for item in report if item.get('id') == event_id]
    if len(matches) != 1:
        raise SystemExit(f'{event_id}: expected one report row, found {len(matches)}')
    item = matches[0]
    if not (item.get('verdict') == item.get('root_decision') == item.get('independent_decision') == 'PASS'):
        raise SystemExit(f'{event_id}: root and independent review must both PASS')
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with open(LOCK, 'a+b') as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        lines = MANIFEST.read_text().splitlines()
        found = [(index, json.loads(line)) for index, line in enumerate(lines)
                 if json.loads(line).get('id') == event_id]
        if len(found) != 1:
            raise SystemExit(f'{event_id}: expected one manifest row, found {len(found)}')
        index, row = found[0]
        status_path = STATUS_DIR / f'{event_id}.json'
        status = json.loads(status_path.read_text())
        if row.get('merged_review') not in (None, 'inherited') or status.get('merged_review') not in (None, 'inherited'):
            raise SystemExit(f'{event_id}: review state is not inherited')
        image_sha = sha256(Path(row['derivative']))
        source_sha = sha256(Path(row['source']))
        if not (image_sha == item.get('candidate_sha256') == row.get('derivative_sha256') == status.get('derivative_sha256')):
            raise SystemExit(f'{event_id}: current image SHA mismatch')
        if not (source_sha == item.get('source_sha256') == row.get('source_sha256') == status.get('source_sha256')):
            raise SystemExit(f'{event_id}: source SHA mismatch')
        if len(status.get('summary_en', '').split()) != item.get('english_theme_words') or item.get('english_theme_words', 99) > 8:
            raise SystemExit(f'{event_id}: English theme word-count gate failed')
        audit_path = Path(item['prior_audit_path'])
        prior_pass = [json.loads(line) for line in audit_path.read_text().splitlines() if line.strip()
                      and json.loads(line).get('id') == event_id
                      and (json.loads(line).get('candidate_sha256') or json.loads(line).get('merged_sha256')) == image_sha
                      and json.loads(line).get('verdict', json.loads(line).get('result', '')).upper() == 'PASS']
        if len(prior_pass) != 1:
            raise SystemExit(f'{event_id}: expected one exact-current-SHA prior audit PASS, found {len(prior_pass)}')
        stamp = datetime.now(timezone.utc).isoformat()
        archive = T7 / 'incoming-codex' / f'{event_id}-root-current-pass-{datetime.now().strftime("%Y%m%d")}'
        archive.mkdir(exist_ok=False)
        manifest_before = MANIFEST.read_bytes()
        status_before = status_path.read_bytes()
        review_before = REVIEW_LOG.read_bytes()
        (archive / 'manifest-before.jsonl').write_bytes(manifest_before)
        (archive / 'status-before.json').write_bytes(status_before)
        (archive / 'review-log-before.jsonl').write_bytes(review_before)
        (archive / 'review-report.json').write_text(json.dumps(item, ensure_ascii=False, indent=2) + '\n')
        root_record = {
            'id': event_id, 'decision': 'PASS', 'reviewer': 'root native-image review',
            'checked': True, 'checked_at': stamp, 'source_sha256': source_sha,
            'candidate_sha256': image_sha, 'note': item['root_note'],
        }
        independent_record = {
            'id': event_id, 'decision': 'PASS', 'reviewer': 'independent refuter native-image review',
            'checked': True, 'checked_at': stamp, 'source_sha256': source_sha,
            'candidate_sha256': image_sha, 'note': item['independent_note'],
        }
        (archive / 'root-review.json').write_text(json.dumps(root_record, ensure_ascii=False, indent=2) + '\n')
        (archive / 'independent-review.json').write_text(json.dumps(independent_record, ensure_ascii=False, indent=2) + '\n')
        evidence = [str(archive / 'root-review.json'), str(archive / 'independent-review.json'), str(audit_path), str(archive / 'review-report.json')]
        note = 'Root and independent exact-current-SHA native-image review PASS; complete Chinese title/reference/introduction verified; concise English theme <=8 words; key scene and subjects clear.'
        row['merged_review'] = 'pass'
        row['merged_review_note'] = note
        row['review_evidence'] = list(dict.fromkeys((row.get('review_evidence') or []) + evidence))
        status['merged_review'] = 'pass'
        status['merged_review_note'] = note
        status['review_evidence'] = list(dict.fromkeys((status.get('review_evidence') or []) + evidence))
        status['quality_recheck_utc'] = stamp
        lines[index] = json.dumps(row, ensure_ascii=False)
        log_data = review_before + ''.join(json.dumps(record, ensure_ascii=False) + '\n'
                                            for record in (root_record, independent_record)).encode()
        try:
            atomic_write(MANIFEST, ('\n'.join(lines) + '\n').encode())
            atomic_write(status_path, (json.dumps(status, ensure_ascii=False, indent=2) + '\n').encode())
            atomic_write(REVIEW_LOG, log_data)
        except Exception:
            atomic_write(MANIFEST, manifest_before)
            atomic_write(status_path, status_before)
            atomic_write(REVIEW_LOG, review_before)
            raise
        if sha256(Path(row['derivative'])) != image_sha or sha256(Path(row['source'])) != source_sha:
            raise SystemExit(f'{event_id}: source/image changed during metadata update')
        receipt = {
            'id': event_id, 'decision': 'PASS', 'source_sha256': source_sha,
            'candidate_sha256': image_sha, 'prior_review_state': 'inherited',
            'root_and_independent_reviews': True, 'raw_or_image_or_historic_ok_true_changed': False,
            'utc': stamp, 'evidence_directory': str(archive),
        }
        (archive / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(receipt, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: python3 register-inherited-reviewed-pass.py EVENT_ID REVIEW_REPORT.jsonl')
    main(sys.argv[1], sys.argv[2])
