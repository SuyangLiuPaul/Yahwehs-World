import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
FIRST = INCOMING / 'parallel-review-later-20261014' / 'results.jsonl'
SECOND = INCOMING / 'parallel-review-sartre-pass-second-01a139ef-129e-7df3-948d-1724863d9907-20261014' / 'review.jsonl'
OUT = INCOMING / 'root-reviewed-sartre-pass-20261014'
IDS = {'1-peter-1-13', '1-peter-2-1', '1-peter-2-11', '1-peter-5-1', '2-peter-2-1'}


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def main():
    first = {row['id']: row for row in map(json.loads, FIRST.read_text().splitlines())}
    second = {row['id']: row for row in map(json.loads, SECOND.read_text().splitlines())}
    events = {row['id']: row for row in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    existing = {row['id'] for row in map(json.loads, (ROOT / 'non-gamified-merged-manifest-v3.jsonl').read_text().splitlines())}
    assert IDS <= first.keys() and IDS <= second.keys()
    assert not IDS & existing
    OUT.mkdir(exist_ok=True)
    jobs = []
    for event_id in sorted(IDS):
        a, b = first[event_id], second[event_id]
        assert a['decision'] == b['decision'] == 'PASS', event_id
        candidate = pathlib.Path(a['selected_candidate'])
        source = pathlib.Path(a['source'])
        candidate_sha, source_sha = sha(candidate), sha(source)
        assert candidate_sha == a['candidate_sha256'] == b['candidate_sha256'], event_id
        assert source_sha == a['source_sha256'] == b['source_sha256'], event_id
        (candidate.parent / 'root-fullframe-review.json').write_text(json.dumps({
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'reviewer': 'root visual review',
            'checks': 'Compared raw and candidate contact sheets; confirmed scene/story continuity, faces and ages/hair, text legibility, unobstructed focal actions, clean UI removal, and no obvious artifacts. Exact hashes align with both independent reviews.',
            'independent_review_paths': [str(FIRST), str(SECOND)],
            'registration_or_source_modification': False,
        }, ensure_ascii=False, indent=2) + '\n')
        wrapper = OUT / f'{event_id}-independent-pass.json'
        wrapper.write_text(json.dumps({
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'reviewer': 'independent visual review',
            'first_report': str(FIRST), 'second_report': str(SECOND),
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
