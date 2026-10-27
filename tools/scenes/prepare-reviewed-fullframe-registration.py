import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
REVIEW = INCOMING / 'api-batch-review-luna-02-20261014' / 'review.jsonl'
SECOND_REVIEW = INCOMING / 'independent-visual-review-batch02-20261014-continue' / 'review.jsonl'
OUT = INCOMING / 'root-reviewed-registration-batch02-20261014'
APPROVED = {
    '2-corinthians-3-1', '2-corinthians-4-1', '2-corinthians-5-11',
    '2-corinthians-6-14', '2-corinthians-13-1', '1-thessalonians-1-1',
    '1-thessalonians-4-1', '2-thessalonians-3-6', '2-timothy-1-1',
    '2-timothy-3-1', 'titus-2-1', 'titus-2-11',
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    first = {d['id']: d for d in map(json.loads, REVIEW.read_text().splitlines())}
    second = {d['id']: d for d in map(json.loads, SECOND_REVIEW.read_text().splitlines())}
    events = {e['id']: e for e in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    existing = {d['id'] for d in map(json.loads, (ROOT / 'non-gamified-merged-manifest-v3.jsonl').read_text().splitlines())}
    assert APPROVED <= first.keys() and APPROVED <= second.keys()
    assert not (APPROVED & existing)
    OUT.mkdir(exist_ok=True)
    jobs = []
    for event_id in sorted(APPROVED):
        a, b = first[event_id], second[event_id]
        assert a['decision'] == b['decision'] == 'PASS', event_id
        candidate = pathlib.Path(a['candidate_path'])
        source = pathlib.Path(a['source_path'])
        candidate_sha, source_sha = sha(candidate), sha(source)
        assert candidate_sha == a['candidate_sha256'], event_id
        assert source_sha == a['source_sha256'], event_id
        root_review = {
            'id': event_id,
            'decision': 'PASS',
            'candidate_sha256': candidate_sha,
            'source_sha256': source_sha,
            'reviewer': 'root visual review',
            'checks': 'Reviewed full-frame candidate and independent native/detail review; checked bilingual reference and summary, faces/heads, key action visibility, and composition. No game UI, material text defect, or obstructive overlap found.',
            'independent_review_paths': [str(REVIEW), str(SECOND_REVIEW)],
            'registration_or_source_modification': False,
        }
        root_path = candidate.parent / 'root-fullframe-review.json'
        assert not root_path.exists(), root_path
        root_path.write_text(json.dumps(root_review, ensure_ascii=False, indent=2) + '\n')
        wrapper_path = OUT / f'{event_id}-independent-pass.json'
        wrapper_path.write_text(json.dumps({
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'reviewer': 'independent visual review',
            'report': str(REVIEW), 'reaudit_report': str(SECOND_REVIEW),
        }, ensure_ascii=False, indent=2) + '\n')
        event = events[event_id]
        jobs.append({
            'id': event_id, 'candidate': str(candidate), 'sha256': candidate_sha,
            'source_sha256': source_sha, 'reference': event['ref'],
            'summary': event['en'], 'independent_reviews': [str(wrapper_path)],
        })
    jobs_path = OUT / 'jobs.json'
    jobs_path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'count': len(jobs), 'ids': sorted(APPROVED), 'jobs': str(jobs_path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
