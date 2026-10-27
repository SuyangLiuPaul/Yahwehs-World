import hashlib
import json
import pathlib


ROOT = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = ROOT / 'incoming-codex'
EVENTS_PATH = pathlib.Path('/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json')
RAW_DIR = pathlib.Path('/Users/pliu0036/Documents/CodingProject/assets-scenes/raw')
BASE_QUEUE = INCOMING / 'api-fullframe-eight-jobs-20261013.jsonl'
QUEUE = INCOMING / 'api-text-repair-first10-20261014.jsonl'
IDS = [
    'romans-7-14', 'romans-9-1', 'romans-9-30', 'romans-11-33', 'romans-13-8',
    'romans-14-1', 'romans-15-1', 'romans-15-14', 'romans-15-23', '2-timothy-2-1',
]


def main():
    events = {e['id']: e for e in json.loads(EVENTS_PATH.read_text())['events']}
    base = json.loads(BASE_QUEUE.read_text().splitlines()[0])
    base_event = events[base['id']]
    merged = {json.loads(line)['id'] for line in (ROOT / 'non-gamified-merged-manifest-v3.jsonl').read_text().splitlines()}
    jobs = []
    for event_id in IDS:
        event = events[event_id]
        assert event_id not in merged
        raw = RAW_DIR / f'{event_id}.png'
        assert raw.is_file()
        out_dir = INCOMING / f'{event_id}-api-text-repair-v2-20261014'
        out_dir.mkdir(exist_ok=False)
        prompt = base['prompt']
        for field in ['refZh', 'summaryZh', 'zh', 'en', 'ref']:
            prompt = prompt.replace(base_event[field], event[field])
        prompt += (
            f' TEXT-ONLY PRECISION RULE: write Chinese scripture reference exactly {event["refZh"]!r}. '
            f'On the Chinese card, put the reference on its own line, then start the introduction on the next line. '
            'There must be NO slash, separator, punctuation, or extra character after the reference and before the introduction. '
            'Do not use / anywhere as a divider. Copy the Chinese title, introduction, English scripture reference, and English theme exactly as supplied; do not invent or change any characters. '
            'Text accuracy overrides decorative typography. Keep every card clear of all heads and scene-defining actions.'
        )
        (out_dir / 'prompt.txt').write_text(prompt)
        (out_dir / 'preflight.json').write_text(json.dumps({
            'id': event_id, 'source': str(raw), 'source_sha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
            'reference_zh': event['refZh'], 'reference': event['ref'],
            'repair_target': 'remove noncanonical separator slash after Chinese reference; preserve story from raw',
            'budget_policy': 'runner local cumulative $50 cap; check current ledger/limit; auto-reload OFF',
        }, ensure_ascii=False, indent=2) + '\n')
        job = dict(base)
        job.update({
            'id': event_id, 'raw': str(raw), 'prompt': prompt,
            'output': str(out_dir / 'normalized-candidate.png'),
            'raw_output': str(out_dir / 'api-return-original.png'),
            'preflight_pass': True,
        })
        jobs.append(job)
    QUEUE.write_text(''.join(json.dumps(job, ensure_ascii=False) + '\n' for job in jobs))
    print(json.dumps({'queue': str(QUEUE), 'count': len(jobs), 'ids': IDS}, ensure_ascii=False))


if __name__ == '__main__':
    main()
