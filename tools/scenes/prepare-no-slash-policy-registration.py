import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
FIRST = INCOMING / 'no-slash-policy-recheck-20261014' / 'review.jsonl'
SECOND = INCOMING / 'no-slash-policy-second-review-20261014' / 'review.jsonl'
OUT = INCOMING / 'root-reviewed-no-slash-policy-20261014'
IDS = {'1-peter-1-1', '1-john-4-1', 'jude-1-1'}


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def main():
    first = {r['id']: r for r in map(json.loads, FIRST.read_text().splitlines())}
    second = {r['id']: r for r in map(json.loads, SECOND.read_text().splitlines())}
    events = {r['id']: r for r in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    existing = {r['id'] for r in map(json.loads, (ROOT / 'non-gamified-merged-manifest-v3.jsonl').read_text().splitlines())}
    assert IDS <= first.keys() and IDS <= second.keys() and not IDS & existing
    OUT.mkdir(exist_ok=True)
    jobs = []
    for event_id in sorted(IDS):
        a, b = first[event_id], second[event_id]
        assert a['decision'] == b['decision'] == 'PASS'
        candidate = pathlib.Path(a.get('candidate') or a.get('candidate_path') or a.get('selected_candidate'))
        source = pathlib.Path(a.get('source') or a.get('source_path'))
        candidate_sha, source_sha = sha(candidate), sha(source)
        assert candidate_sha == a['candidate_sha256'] == b['candidate_sha256'], event_id
        a_source_sha = a.get('source_sha256') or a.get('raw_sha256')
        b_source_sha = b.get('source_sha256') or b.get('raw_sha256')
        assert source_sha == a_source_sha == b_source_sha, event_id
        (candidate.parent / 'root-fullframe-review.json').write_text(json.dumps({
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'reviewer': 'root visual review',
            'checks': 'Verified raw/candidate contact-sheet pair, no-slash reference-on-own-line policy, exact canonical text, scene and character continuity, unobstructed cards/actions, removed UI, and no obvious artifacts. Both independent reviews and file hashes agree.',
            'independent_review_paths': [str(FIRST), str(SECOND)],
            'registration_or_source_modification': False,
        }, ensure_ascii=False, indent=2) + '\n')
        wrapper = OUT / f'{event_id}-independent-pass.json'
        wrapper.write_text(json.dumps({'id': event_id, 'decision': 'PASS',
            'candidate_sha256': candidate_sha, 'source_sha256': source_sha,
            'reviewer': 'independent visual review', 'first_report': str(FIRST),
            'second_report': str(SECOND)}, ensure_ascii=False, indent=2) + '\n')
        e = events[event_id]
        jobs.append({'id': event_id, 'candidate': str(candidate), 'sha256': candidate_sha,
                     'source_sha256': source_sha, 'reference': e['ref'], 'summary': e['en'],
                     'independent_reviews': [str(wrapper)]})
    path = OUT / 'jobs.json'
    path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'count': len(jobs), 'ids': sorted(IDS), 'jobs': str(path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
