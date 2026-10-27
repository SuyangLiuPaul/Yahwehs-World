import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
REPORT = INCOMING / 'independent-visual-review-third-batch-20261014-094726Z' / 'review.jsonl'
IDS = {'1-john-5-13', '2-john-1-1', '3-john-1-9', 'revelation-2-8'}
OUT = INCOMING / 'root-reviewed-registration-batch03-more-passes-20261014'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    report = {d['id']: d for d in map(json.loads, REPORT.read_text().splitlines())}
    events = {e['id']: e for e in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    existing = {json.loads(x)['id'] for x in (ROOT / 'non-gamified-merged-manifest-v3.jsonl').read_text().splitlines()}
    OUT.mkdir(exist_ok=True)
    jobs = []
    for event_id in sorted(IDS):
        item = report[event_id]
        assert item['decision'] == 'PASS' and event_id not in existing
        candidate, source = pathlib.Path(item['candidate_path']), pathlib.Path(item['raw_path'])
        candidate_sha, source_sha = sha(candidate), sha(source)
        assert candidate_sha == item['candidate_sha256'] and source_sha == item['raw_sha256']
        proof = {
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'reviewer': 'root visual review',
            'checks': 'Native full-frame reviewed; canonical bilingual text checked; heads/faces and scene action are clear; no material overlap, seam, or anatomy defect found.',
            'independent_report': str(REPORT), 'registration_or_source_modification': False,
        }
        root_path = candidate.parent / 'root-fullframe-review.json'
        assert not root_path.exists(), root_path
        root_path.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n')
        wrapper = OUT / f'{event_id}-independent-pass.json'
        wrapper.write_text(json.dumps({
            'id': event_id, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
            'source_sha256': source_sha, 'report': str(REPORT),
        }, ensure_ascii=False, indent=2) + '\n')
        event = events[event_id]
        jobs.append({
            'id': event_id, 'candidate': str(candidate), 'sha256': candidate_sha,
            'source_sha256': source_sha, 'reference': event['ref'], 'summary': event['en'],
            'independent_reviews': [str(wrapper)],
        })
    jobs_path = OUT / 'jobs.json'
    jobs_path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'count': len(jobs), 'ids': sorted(IDS), 'jobs': str(jobs_path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
