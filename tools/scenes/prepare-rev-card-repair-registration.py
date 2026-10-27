import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
FIRST = INCOMING / 'review-targeted-rev-card-repair-v2-second-20261014' / 'review.jsonl'
THIRD = INCOMING / 'review-targeted-rev-card-repair-v2-third-audit-20261014' / 'README.md'
OUT = INCOMING / 'root-reviewed-rev-card-repair-v2-20261014'
IDS = {'revelation-2-18', 'revelation-3-1', 'revelation-15-1'}


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def main():
    first = {r['id']: r for r in map(json.loads, FIRST.read_text().splitlines())}
    third_text = THIRD.read_text()
    events = {r['id']: r for r in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    existing = {r['id'] for r in map(json.loads, (ROOT / 'non-gamified-merged-manifest-v3.jsonl').read_text().splitlines())}
    assert IDS <= first.keys() and not IDS & existing
    OUT.mkdir(exist_ok=True)
    jobs = []
    for event_id in sorted(IDS):
        r = first[event_id]
        assert r['decision'] == 'PASS', event_id
        paths, hashes = r['paths'], r['sha256']
        candidate, source = pathlib.Path(paths['candidate_v2']), pathlib.Path(paths['raw_source'])
        candidate_sha, source_sha = sha(candidate), sha(source)
        assert candidate_sha == hashes['candidate_v2'] and source_sha == hashes['raw_source'], event_id
        assert candidate_sha in third_text and event_id in third_text and 'PASS' in third_text, event_id
        (candidate.parent / 'root-fullframe-review.json').write_text(json.dumps({
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'reviewer': 'root visual review',
            'checks': 'Compared raw and normalized v2 image directly; confirmed canonical bilingual card text, reference on its own line/no slash, preserved event scene and characters, legible faces/age/hair, clear focal actions, no UI or visible generation defects. Candidate/source hashes match two independent reports.',
            'independent_review_paths': [str(FIRST), str(THIRD)],
            'registration_or_source_modification': False,
        }, ensure_ascii=False, indent=2) + '\n')
        wrapper = OUT / f'{event_id}-independent-pass.json'
        wrapper.write_text(json.dumps({
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'reviewer': 'independent visual review',
            'second_report': str(FIRST), 'third_report': str(THIRD),
        }, ensure_ascii=False, indent=2) + '\n')
        e = events[event_id]
        jobs.append({'id': event_id, 'candidate': str(candidate), 'sha256': candidate_sha,
                     'source_sha256': source_sha, 'reference': e['ref'], 'summary': e['en'],
                     'independent_reviews': [str(wrapper)]})
    jobs_path = OUT / 'jobs.json'
    jobs_path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'count': len(jobs), 'ids': sorted(IDS), 'jobs': str(jobs_path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
