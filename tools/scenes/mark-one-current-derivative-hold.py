import argparse
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import tempfile


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
RAW = pathlib.Path('/Users/pliu0036/Documents/CodingProject/assets-scenes/raw')
MANIFEST = ROOT / 'non-gamified-merged-manifest-v3.jsonl'
STATUS_DIR = ROOT / 'non-gamified-merged-status-v3'
IMAGE_DIR = ROOT / 'non-gamified-merged-live-v3'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atomic_write(path, content):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temp = pathlib.Path(stream.name)
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('image_id')
    parser.add_argument('review_report', type=pathlib.Path)
    parser.add_argument('reason')
    parser.add_argument('--allow-inherited', action='store_true')
    args = parser.parse_args()
    image_id = args.image_id
    source = RAW / f'{image_id}.png'
    image = IMAGE_DIR / f'{image_id}.png'
    status_path = STATUS_DIR / f'{image_id}.json'
    status = json.loads(status_path.read_text())
    source_sha = sha(source)
    candidate_sha = sha(image)
    assert status['status'] == 'complete' and status['bilingual_status'] == 'complete'
    allowed_reviews = {'pass'} | ({'inherited', None} if args.allow_inherited else set())
    assert status.get('merged_review', 'pass') in allowed_reviews
    assert status['source_sha256'] == source_sha
    assert status.get('merged_sha256', status.get('derivative_sha256')) == candidate_sha
    report_rows = [json.loads(line) for line in args.review_report.read_text().splitlines() if line.strip()]
    review = next(row for row in report_rows if row['id'] == image_id)
    assert review.get('verdict', review.get('decision')) == 'HOLD'
    assert review['source_sha256'] == source_sha
    assert (review.get('candidate_sha256') or review.get('merged_sha256')) == candidate_sha
    lines = MANIFEST.read_bytes().splitlines(keepends=True)
    rows = [json.loads(line) for line in lines]
    matches = [i for i, row in enumerate(rows) if row.get('id') == image_id]
    assert len(matches) == 1
    index = matches[0]
    row = rows[index]
    assert row.get('status') == 'complete' and row.get('bilingual_status') == 'complete'
    assert row.get('merged_review', 'pass') in allowed_reviews and row.get('derivative_sha256') == candidate_sha

    evidence_dir = ROOT / 'incoming-codex' / f'{image_id}-root-current-hold-{datetime.datetime.now().strftime("%Y%m%d")}'
    evidence_dir.mkdir(exist_ok=False)
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    shutil.copy2(MANIFEST, evidence_dir / 'manifest-before.jsonl')
    shutil.copy2(status_path, evidence_dir / 'status-before.json')
    root_review = {
        'id': image_id,
        'decision': 'HOLD',
        'reviewer': 'root visual comparison against source and exact current SHA/manifest',
        'reviewed_at_utc': stamp,
        'source_sha256': source_sha,
        'candidate_sha256': candidate_sha,
        'reason': args.reason,
        'review_report': str(args.review_report),
        'source_unchanged': True,
        'merged_image_unchanged': True,
        'historical_approvals_unchanged': True,
        'action_scope': 'single current derivative review-status correction only',
    }
    root_path = evidence_dir / 'root-review.json'
    root_path.write_text(json.dumps(root_review, ensure_ascii=False, indent=2) + '\n')
    status['merged_review'] = 'hold'
    status['merged_review_note'] = args.reason
    status['review_evidence'] = list(status.get('review_evidence', [])) + [str(root_path)]
    status['quality_recheck_utc'] = stamp
    row['merged_review'] = 'hold'
    row['merged_review_note'] = args.reason
    row['review_evidence'] = status['review_evidence']
    lines[index] = (json.dumps(row, ensure_ascii=False) + '\n').encode()
    receipt = {
        'id': image_id,
        'decision': 'HOLD',
        'source_sha256': source_sha,
        'candidate_sha256': candidate_sha,
        'raw_and_image_unchanged': True,
        'historical_approvals_unchanged': True,
        'only_this_current_review_status_changed': True,
        'utc': stamp,
    }
    (evidence_dir / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    try:
        atomic_write(MANIFEST, b''.join(lines))
        atomic_write(status_path, (json.dumps(status, ensure_ascii=False, indent=2) + '\n').encode())
    except Exception:
        shutil.copy2(evidence_dir / 'manifest-before.jsonl', MANIFEST)
        shutil.copy2(evidence_dir / 'status-before.json', status_path)
        raise
    assert sha(source) == source_sha and sha(image) == candidate_sha
    print(json.dumps({'id': image_id, 'review': 'HOLD', 'source_sha256': source_sha,
                      'candidate_sha256': candidate_sha, 'evidence': str(evidence_dir)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
