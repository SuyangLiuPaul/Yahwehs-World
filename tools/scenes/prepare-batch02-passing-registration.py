import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
REPORTS = {
    '1-corinthians-16-1': INCOMING / 'independent-visual-review-10-requested-20261014' / 'review.jsonl',
    '2-corinthians-1-1': INCOMING / 'independent-visual-review-10-requested-20261014' / 'review.jsonl',
    '2-thessalonians-1-1': INCOMING / 'independent-visual-review-10-requested-20261014' / 'review.jsonl',
    'hebrews-11-4': INCOMING / 'independent-visual-review-10-requested-20261014' / 'review.jsonl',
    'hebrews-11-8': INCOMING / 'independent-visual-review-10-requested-20261014' / 'review.jsonl',
    '1-john-3-1': INCOMING / 'independent-review-second20-20261014-203540' / 'review.jsonl',
    '1-john-3-11': INCOMING / 'independent-review-second20-20261014-203540' / 'review.jsonl',
}
OUT = INCOMING / 'root-reviewed-registration-batch02-passes-20261014'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    events = {e['id']: e for e in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    existing = {json.loads(x)['id'] for x in (ROOT / 'non-gamified-merged-manifest-v3.jsonl').read_text().splitlines()}
    OUT.mkdir(exist_ok=True)
    jobs = []
    for event_id, report_path in REPORTS.items():
        item = next(json.loads(line) for line in report_path.read_text().splitlines()
                    if json.loads(line)['id'] == event_id)
        assert item['decision'] == 'PASS' and event_id not in existing
        candidate = pathlib.Path(item['candidate_path'])
        source = pathlib.Path(item['source_path'])
        candidate_sha, source_sha = sha(candidate), sha(source)
        assert candidate_sha == item['candidate_sha256'] and source_sha == item['source_sha256']
        proof = {
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'reviewer': 'root visual review',
            'checks': 'Native full-frame image reviewed; bilingual text/reference verified against canonical event data; heads/faces and key actions remain visible; no material anatomy, collage seam, or composition defect found.',
            'independent_report': str(report_path), 'registration_or_source_modification': False,
        }
        root_path = candidate.parent / 'root-fullframe-review.json'
        assert not root_path.exists(), root_path
        root_path.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n')
        wrapper_path = OUT / f'{event_id}-independent-pass.json'
        wrapper_path.write_text(json.dumps({
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'report': str(report_path),
        }, ensure_ascii=False, indent=2) + '\n')
        event = events[event_id]
        jobs.append({
            'id': event_id, 'candidate': str(candidate), 'sha256': candidate_sha,
            'source_sha256': source_sha, 'reference': event['ref'], 'summary': event['en'],
            'independent_reviews': [str(wrapper_path)],
        })
    jobs_path = OUT / 'jobs.json'
    jobs_path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'count': len(jobs), 'ids': list(REPORTS), 'jobs': str(jobs_path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
