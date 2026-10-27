import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
RAW = pathlib.Path('/Users/pliu0036/Documents/CodingProject/assets-scenes/raw')
OUT = INCOMING / 'root-reviewed-text-repair-v2-20261014'
FIRST_REPORTS = [
    INCOMING / 'root-independent-v2-text-repair-first5-20261014' / 'review.jsonl',
    INCOMING / 'independent-review-text-repair-first10-last5-20261014' / 'review.jsonl',
]
SECOND_DIR = INCOMING / 'independent-review-text-repair-v2-second-audit-20261014'
APPROVED = {
    'romans-7-14', 'romans-9-1', 'romans-9-30', 'romans-11-33',
    'romans-13-8', 'romans-14-1', 'romans-15-1', 'romans-15-14',
    'romans-15-23',
}


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    first = {record['id']: record for path in FIRST_REPORTS for record in read_jsonl(path)}
    second = {}
    for path in SECOND_DIR.glob('*.jsonl'):
        records = read_jsonl(path)
        if records:
            second[records[0]['id']] = records[0]
    events = {record['id']: record for record in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    existing = {record['id'] for record in read_jsonl(ROOT / 'non-gamified-merged-manifest-v3.jsonl')}
    assert APPROVED <= first.keys() and APPROVED <= second.keys()
    to_register = APPROVED - existing
    assert to_register == {'romans-9-30'}, to_register
    OUT.mkdir(exist_ok=True)
    jobs = []
    for event_id in sorted(to_register):
        a, b = first[event_id], second[event_id]
        assert a['decision'].startswith('PASS') and b['decision'].startswith('PASS'), event_id
        candidate = pathlib.Path(a.get('candidate_path') or a['v2']['path'])
        source = RAW / f'{event_id}.png'
        candidate_sha, source_sha = sha(candidate), sha(source)
        first_candidate_sha = a.get('candidate_sha256') or a['v2']['sha256']
        first_source_sha = a.get('source_sha256') or a['raw']['sha256']
        assert candidate_sha == first_candidate_sha == b['files']['candidate_sha256'], event_id
        assert source_sha == first_source_sha == b['files']['raw_sha256'], event_id
        root_review = {
            'id': event_id,
            'decision': 'PASS',
            'candidate_sha256': candidate_sha,
            'source_sha256': source_sha,
            'reviewer': 'root visual review',
            'checks': 'Compared raw and v2 native images plus contact sheets; verified exact Chinese reference without trailing separator, legible bilingual title/theme, unobstructed focal people/actions, coherent faces/age/hair, and no visible game UI or reconstruction artifacts. Material character mismatch 2-timothy-2-1 is explicitly held and excluded.',
            'independent_review_paths': [str(FIRST_REPORTS[0]), str(FIRST_REPORTS[1]), str(SECOND_DIR)],
            'registration_or_source_modification': False,
        }
        (candidate.parent / 'root-fullframe-review.json').write_text(json.dumps(root_review, ensure_ascii=False, indent=2) + '\n')
        wrapper = OUT / f'{event_id}-independent-pass.json'
        wrapper.write_text(json.dumps({
            'id': event_id,
            'decision': 'PASS',
            'candidate_sha256': candidate_sha,
            'source_sha256': source_sha,
            'reviewer': 'independent visual review',
            'report': str(FIRST_REPORTS[0] if event_id in {r['id'] for r in read_jsonl(FIRST_REPORTS[0])} else FIRST_REPORTS[1]),
            'second_report': str(SECOND_DIR / f'{event_id}.jsonl'),
        }, ensure_ascii=False, indent=2) + '\n')
        event = events[event_id]
        jobs.append({
            'id': event_id,
            'candidate': str(candidate),
            'sha256': candidate_sha,
            'source_sha256': source_sha,
            'reference': event['ref'],
            'summary': event['en'],
            'independent_reviews': [str(wrapper)],
        })
    jobs_path = OUT / 'jobs.json'
    jobs_path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'approved': len(jobs), 'held': ['2-timothy-2-1'], 'jobs': str(jobs_path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
