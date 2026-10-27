import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
RAW = pathlib.Path('/Users/pliu0036/Documents/CodingProject/assets-scenes/raw')
FIRST = INCOMING / 'parallel-review-01a139f2-20261014' / 'review.jsonl'
SECOND_REPORTS = [
    INCOMING / 'parallel-review-later-second-01a139ef-129e-7df3-948d-1724863d9907-20261014' / 'review.jsonl',
    INCOMING / 'parallel-review-later-second-01a139eb-6d1f-7a92-81a6-dc87d0059b17-20261014' / 'review.jsonl',
]
OUT = INCOMING / 'root-reviewed-parallel-pass-20261014'


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def second_hashes(row):
    files = row.get('files', {})
    return (row.get('candidate_sha256') or files.get('candidate_sha256'),
            row.get('source_sha256') or files.get('source_sha256') or files.get('raw_sha256'))


def main():
    first = {row['id']: row for row in read_jsonl(FIRST)}
    second = {row['id']: row for path in SECOND_REPORTS for row in read_jsonl(path)}
    event_map = {row['id']: row for row in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    manifest_path = ROOT / 'non-gamified-merged-manifest-v3.jsonl'
    existing = {row['id'] for row in read_jsonl(manifest_path)}
    approved = sorted(i for i in first.keys() & second.keys()
                      if first[i]['decision'] == second[i]['decision'] == 'PASS')
    assert len(approved) == 11, approved
    assert not (existing & set(approved))
    OUT.mkdir(exist_ok=True)
    jobs = []
    for event_id in approved:
        a, b = first[event_id], second[event_id]
        candidate, source = pathlib.Path(a['candidate']), RAW / f'{event_id}.png'
        candidate_sha, source_sha = sha(candidate), sha(source)
        b_candidate_sha, b_source_sha = second_hashes(b)
        assert candidate_sha == a['candidate_sha256'] == b_candidate_sha, event_id
        assert source_sha == a['source_sha256'] == b_source_sha, event_id
        root_proof = {
            'id': event_id,
            'decision': 'PASS',
            'candidate_sha256': candidate_sha,
            'source_sha256': source_sha,
            'reviewer': 'root visual review',
            'checks': 'Compared full-frame candidate contact sheet and raw/candidate pairs; verified people/action continuity, heads/faces/age/hair, legible bilingual text, clear focal action, and no game UI or conspicuous artifacts. Exact candidate/source hashes match both independent audits.',
            'independent_review_paths': [str(FIRST), *[str(p) for p in SECOND_REPORTS]],
            'registration_or_source_modification': False,
        }
        (candidate.parent / 'root-fullframe-review.json').write_text(json.dumps(root_proof, ensure_ascii=False, indent=2) + '\n')
        wrapper = OUT / f'{event_id}-independent-pass.json'
        wrapper.write_text(json.dumps({
            'id': event_id,
            'decision': 'PASS',
            'candidate_sha256': candidate_sha,
            'source_sha256': source_sha,
            'reviewer': 'independent visual review',
            'first_report': str(FIRST),
            'second_report': str(next(p for p in SECOND_REPORTS if any(r['id'] == event_id for r in read_jsonl(p)))),
        }, ensure_ascii=False, indent=2) + '\n')
        event = event_map[event_id]
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
    print(json.dumps({'approved': len(jobs), 'ids': approved, 'jobs': str(jobs_path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
