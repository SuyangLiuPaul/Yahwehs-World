import datetime
import hashlib
import json
import pathlib
import shutil


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
IMAGE_ID = 'revelation-7-1'
MANIFEST = ROOT / 'non-gamified-merged-manifest-v3.jsonl'
STATUS = ROOT / 'non-gamified-merged-status-v3' / f'{IMAGE_ID}.json'
IMAGE = ROOT / 'non-gamified-merged-live-v3' / f'{IMAGE_ID}.png'
REPORT = ROOT / 'incoming-codex/independent-visual-review-third-batch-20261014-094726Z/review.jsonl'
EVIDENCE = ROOT / 'incoming-codex/revelation-7-1-root-quality-recheck-20261014'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    candidate_sha = sha(IMAGE)
    review = next(json.loads(line) for line in REPORT.read_text().splitlines()
                  if json.loads(line)['id'] == IMAGE_ID)
    source_sha = sha(pathlib.Path(review['raw_path']))
    assert review['decision'] == 'HOLD' and review['candidate_sha256'] == candidate_sha
    current = json.loads(STATUS.read_text())
    assert current['merged_review'] == 'pass' and current['derivative_sha256'] == candidate_sha
    EVIDENCE.mkdir(exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    shutil.copy2(MANIFEST, EVIDENCE / 'manifest-before.jsonl')
    shutil.copy2(STATUS, EVIDENCE / 'status-before.json')
    root_report = {
        'id': IMAGE_ID, 'decision': 'HOLD', 'source_sha256': source_sha,
        'candidate_sha256': candidate_sha, 'reviewer': 'root visual recheck',
        'reason': 'Raw has a white-haired, white-bearded older heavenly figure at top center; the derivative changes it to a dark-haired middle-aged figure, a material identity/age/hair mismatch. Keep this specific image merged for display but mark it awaiting review until corrected.',
        'independent_report': str(REPORT), 'raw_unchanged': True,
        'merged_image_unchanged': True, 'historical_ok_true_unchanged': True,
        'reviewed_at_utc': stamp,
    }
    (EVIDENCE / 'root-quality-recheck.json').write_text(json.dumps(root_report, ensure_ascii=False, indent=2) + '\n')
    status = dict(current)
    status['merged_review'] = 'hold'
    status['merged_review_note'] = root_report['reason']
    status['review_evidence'] = list(current.get('review_evidence', [])) + [str(EVIDENCE / 'root-quality-recheck.json')]
    status['quality_recheck_utc'] = stamp
    STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2) + '\n')
    rows = [json.loads(line) for line in MANIFEST.read_text().splitlines()]
    matches = [row for row in rows if row['id'] == IMAGE_ID]
    assert len(matches) == 1 and matches[0]['merged_review'] == 'pass'
    matches[0]['merged_review'] = 'hold'
    matches[0]['merged_review_note'] = root_report['reason']
    matches[0]['review_evidence'] = status['review_evidence']
    MANIFEST.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows))
    (EVIDENCE / 'receipt.json').write_text(json.dumps({
        'id': IMAGE_ID, 'candidate_sha256': candidate_sha, 'source_sha256': source_sha,
        'action': 'mark current derivative HOLD only; preserve image, raw and historical review records',
        'utc': stamp,
    }, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'id': IMAGE_ID, 'decision': 'HOLD', 'sha256': candidate_sha,
                      'merged_image_preserved': True, 'evidence': str(EVIDENCE)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
