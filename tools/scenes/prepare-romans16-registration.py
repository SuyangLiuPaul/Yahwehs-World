import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
REPORT = INCOMING / 'independent-visual-review-romans-second-pass-20261014' / 'review.jsonl'
IMAGE_ID = 'romans-16-1'
OUT = INCOMING / 'root-reviewed-registration-romans16-20261014'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    item = next(json.loads(line) for line in REPORT.read_text().splitlines()
                if json.loads(line)['id'] == IMAGE_ID)
    assert item['decision'] == 'PASS'
    candidate, source = pathlib.Path(item['candidate_path']), pathlib.Path(item['source_path'])
    candidate_sha, source_sha = sha(candidate), sha(source)
    assert candidate_sha == item['candidate_sha256'] and source_sha == item['source_sha256']
    events = {e['id']: e for e in json.loads(pathlib.Path(
        '/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json'
    ).read_text())['events']}
    merged = {json.loads(line)['id'] for line in (ROOT / 'non-gamified-merged-manifest-v3.jsonl').read_text().splitlines()}
    assert IMAGE_ID not in merged
    OUT.mkdir(exist_ok=True)
    root_report = {
        'id': IMAGE_ID, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
        'source_sha256': source_sha, 'reviewer': 'root visual review',
        'checks': 'Native full-frame visually reviewed; bilingual title/reference/summary align with canonical values, no extra mark after the Chinese reference, all visible heads and key actions remain clear, no obvious seam or major anatomy issue.',
        'independent_report': str(REPORT), 'registration_or_source_modification': False,
    }
    root_path = candidate.parent / 'root-fullframe-review.json'
    assert not root_path.exists()
    root_path.write_text(json.dumps(root_report, ensure_ascii=False, indent=2) + '\n')
    wrapper = OUT / f'{IMAGE_ID}-independent-pass.json'
    wrapper.write_text(json.dumps({
        'id': IMAGE_ID, 'decision': 'PASS', 'candidate_sha256': candidate_sha,
        'source_sha256': source_sha, 'report': str(REPORT),
    }, ensure_ascii=False, indent=2) + '\n')
    event = events[IMAGE_ID]
    jobs_path = OUT / 'jobs.json'
    jobs_path.write_text(json.dumps([{
        'id': IMAGE_ID, 'candidate': str(candidate), 'sha256': candidate_sha,
        'source_sha256': source_sha, 'reference': event['ref'], 'summary': event['en'],
        'independent_reviews': [str(wrapper)],
    }], ensure_ascii=False, indent=2) + '\n')
    print(str(jobs_path))


if __name__ == '__main__':
    main()
