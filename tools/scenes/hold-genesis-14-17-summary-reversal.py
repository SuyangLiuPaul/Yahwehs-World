import datetime
import hashlib
import json
import os
import pathlib
import shutil
import tempfile


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
IMAGE_ID = 'genesis-14-17'
SOURCE = pathlib.Path('/Users/pliu0036/Documents/CodingProject/assets-scenes/raw/genesis-14-17.png')
IMAGE = ROOT / 'non-gamified-merged-live-v3/genesis-14-17.png'
STATUS = ROOT / 'non-gamified-merged-status-v3/genesis-14-17.json'
MANIFEST = ROOT / 'non-gamified-merged-manifest-v3.jsonl'
REPORT = ROOT / 'incoming-codex/current-hash-audit-20261015/round-2-b/review.jsonl'
EVIDENCE = ROOT / 'incoming-codex/genesis-14-17-current-summary-reversal-hold-20261015'
REASON = 'Current bilingual card reverses the canonical Chinese fact: it says “接受所多玛王的财物”, while the canonical event summary says “拒受所多玛王的财物”. Root full-frame inspection confirms this is visible on the current derivative; the exact-SHA independent review flags the same semantic reversal. Keep the image merged but mark this specific derivative HOLD pending correction.'


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
    source_sha = sha(SOURCE)
    candidate_sha = sha(IMAGE)
    status = json.loads(STATUS.read_text())
    lines = MANIFEST.read_bytes().splitlines(keepends=True)
    parsed = [json.loads(line) for line in lines]
    matches = [i for i, row in enumerate(parsed) if row.get('id') == IMAGE_ID]
    assert len(matches) == 1
    index = matches[0]
    current = parsed[index]
    assert status['status'] == 'complete' and status['bilingual_status'] == 'complete'
    assert status['merged_review'] == 'pass' and status['derivative_sha256'] == candidate_sha
    assert status['source_sha256'] == source_sha
    assert current['merged_review'] == 'pass' and current['derivative_sha256'] == candidate_sha
    assert current['source_sha256'] == source_sha
    reviews = [json.loads(line) for line in REPORT.read_text().splitlines() if line.strip()]
    review = next(row for row in reviews if row['id'] == IMAGE_ID)
    assert review['verdict'] == 'HOLD'
    assert review['candidate_sha256'] == candidate_sha and review['source_sha256'] == source_sha
    assert '接受所多玛王的财物' in review['findings'][1]

    EVIDENCE.mkdir(exist_ok=False)
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    shutil.copy2(MANIFEST, EVIDENCE / 'manifest-before.jsonl')
    shutil.copy2(STATUS, EVIDENCE / 'status-before.json')
    root_review = {
        'id': IMAGE_ID,
        'decision': 'HOLD',
        'reviewer': 'root visual and canonical-text recheck',
        'reviewed_at_utc': stamp,
        'source_sha256': source_sha,
        'candidate_sha256': candidate_sha,
        'canonical_summary_zh': '亚伯兰得胜归来，撒冷王麦基洗德带饼和酒为他祝福；亚伯兰献上十分之一，拒受所多玛王的财物。',
        'visible_candidate_error': '亚伯兰献上十分之一，接受所多玛王的财物。',
        'reason': REASON,
        'independent_report': str(REPORT),
        'source_unchanged': True,
        'merged_image_unchanged': True,
        'historical_ok_true_unchanged': True,
        'action_scope': 'single current-SHA review-status correction only',
    }
    root_path = EVIDENCE / 'root-review.json'
    root_path.write_text(json.dumps(root_review, ensure_ascii=False, indent=2) + '\n')
    status['merged_review'] = 'hold'
    status['merged_review_note'] = REASON
    status['review_evidence'] = list(status.get('review_evidence', [])) + [str(root_path)]
    status['quality_recheck_utc'] = stamp
    current['merged_review'] = 'hold'
    current['merged_review_note'] = REASON
    current['review_evidence'] = status['review_evidence']
    lines[index] = (json.dumps(current, ensure_ascii=False) + '\n').encode()
    new_manifest = b''.join(lines)
    receipt = {
        'id': IMAGE_ID,
        'decision': 'HOLD',
        'source_sha256': source_sha,
        'candidate_sha256': candidate_sha,
        'raw_and_image_unchanged': True,
        'historical_approvals_unchanged': True,
        'only_this_current_review_status_changed': True,
        'utc': stamp,
    }
    (EVIDENCE / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    try:
        atomic_write(MANIFEST, new_manifest)
        atomic_write(STATUS, (json.dumps(status, ensure_ascii=False, indent=2) + '\n').encode())
    except Exception:
        shutil.copy2(EVIDENCE / 'manifest-before.jsonl', MANIFEST)
        shutil.copy2(EVIDENCE / 'status-before.json', STATUS)
        raise
    assert sha(SOURCE) == source_sha and sha(IMAGE) == candidate_sha
    print(json.dumps({'id': IMAGE_ID, 'review': 'HOLD', 'source_sha256': source_sha,
                      'candidate_sha256': candidate_sha, 'evidence': str(EVIDENCE)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
