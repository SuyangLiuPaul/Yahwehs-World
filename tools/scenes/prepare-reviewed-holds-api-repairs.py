import hashlib
import json
import pathlib
import uuid


T7 = pathlib.Path('/Volumes/T7/yahwehs-globe-scenes')
INCOMING = T7 / 'incoming-codex'
EVENTS = pathlib.Path('/Users/pliu0036/Documents/CodingProject/yahwehs-globe/data/events/all-events.json')
RAW = pathlib.Path('/Users/pliu0036/Documents/CodingProject/assets-scenes/raw')
REFS = [
    '/Users/pliu0036/Documents/CodingProject/assets-scenes/refs/ref-ark.jpg',
    '/Users/pliu0036/Documents/CodingProject/assets-scenes/refs/ref-a.jpg',
    '/Users/pliu0036/Documents/CodingProject/assets-scenes/refs/ref-b.jpg',
]
QUEUE = INCOMING / 'api-targeted-first-audit-holds-20261014.jsonl'
TARGETS = {
    'romans-13-1': 'The current text omits the full canonical Chinese introduction. Render the exact complete Chinese introduction below; do not abbreviate it.',
    '1-corinthians-15-1': 'The current text omits the full Chinese account. Render the exact complete canonical Chinese introduction below; do not abbreviate it.',
    'galatians-5-22': 'Preserve the raw image’s elderly white-haired, white-bearded teacher exactly; the candidate changed him to a younger dark-haired person. Also use the exact reference with no trailing slash.',
    '2-timothy-2-1': 'Preserve the raw image’s elderly gray-haired, bearded seated teacher, his age, hair, beard, pose, count of people, and compact teaching scene. Do not add runners, construction, field workers, or other story elements.',
    'hebrews-12-1': 'Keep the Chinese card clear of every witness’s head; specifically do not cover the left white-haired, bearded witness’s crown or forehead. Place cards only over empty sky.',
    'james-3-1': 'Keep the English card out of the sail and rigging, which are essential to the ship-rudder analogy. Place cards only over empty sky and preserve the complete ship and mast.',
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    events = {e['id']: e for e in json.loads(EVENTS.read_text())['events']}
    manifest = T7 / 'non-gamified-merged-manifest-v3.jsonl'
    merged = {json.loads(line)['id'] for line in manifest.read_text().splitlines() if line.strip()}
    refs = [pathlib.Path(p) for p in REFS]
    assert all(p.is_file() for p in refs)
    rows = []
    for event_id, fix in TARGETS.items():
        assert event_id not in merged, f'already merged: {event_id}'
        lock = INCOMING / 'locks' / f'{event_id}.lock'
        assert not lock.exists(), f'active lock: {lock}'
        e = events[event_id]
        raw = RAW / f'{event_id}.png'
        assert raw.is_file()
        outdir = INCOMING / f'{event_id}-api-targeted-repair-batch1-20261014'
        assert not outdir.exists(), f'output already exists: {outdir}'
        outdir.mkdir(parents=True)
        prompt = f'''Edit Image 1 into a finished bilingual Bible-event illustration matching the warm, detailed voxel-diorama style of Images 2–4. Images 2–4 are STYLE references only. Preserve the source event and its central scene, people, identities, count, clothing, positions, poses, age, hair, beards, faces, hands, feet, props and architectural setting. Apply only the specific fix below while retaining the full event depiction.

Targeted correction: {fix}

Remove the game interface: all bottom Explore/People/Map buttons and all upper-right counters, settings, menu controls, icons, outlines and shadows. Naturally reconstruct only what those UI elements hid; no residual UI, blurry bands, blank button shapes, duplicated limbs, rectangular seams or repeated textures. Keep complete landscape framing, no collage or watermark.

Render the following card text exactly, with no omissions or invented characters. Chinese title: {e['zh']}. English title/theme: {e['en']}. Chinese scripture reference: {e['refZh']}. Full Chinese introduction, verbatim: {e['summaryZh']}. English scripture reference: {e['ref']}. English theme summary: {e['en']}.

Put the Chinese title and English title at upper left. Put the Chinese reference and complete Chinese introduction in a legible parchment card below the titles. Put the English reference and English theme in a separate compact card over genuinely empty sky, never over any person, face, key story action or defining prop. Put each reference on its own line. Add no slash, divider punctuation, or text after either reference. Preserve all wording verbatim. Ensure the two cards do not collide or overlap. Check every visible face and head; no text may cover them. Keep the main narrative action and all event-defining scenery fully visible.

No changes to the raw/source file; this is a new candidate only.'''
        row = {
            'id': event_id,
            'raw': str(raw),
            'references': REFS,
            'prompt': prompt,
            'output': str(outdir / 'normalized-candidate.png'),
            'raw_output': str(outdir / 'api-return-original.png'),
            'preflight_pass': True,
            'quality': 'medium',
            'size': '1536x864',
        }
        (outdir / 'preflight.json').write_text(json.dumps({
            'id': event_id,
            'raw': str(raw),
            'raw_sha256': sha(raw),
            'references': [{'path': str(p), 'sha256': sha(p)} for p in refs],
            'correction': fix,
            'review_source': '/Volumes/T7/yahwehs-globe-scenes/incoming-codex/quick-resume-audit-20261014/batch-1/review.jsonl',
            'new_candidate_only': True,
            'registered': False,
        }, ensure_ascii=False, indent=2) + '\n')
        rows.append(row)
    QUEUE.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows))
    print(json.dumps({'queue': str(QUEUE), 'count': len(rows), 'ids': list(TARGETS),
                      'reference_images_each': 3, 'api_calls_sent': False}, ensure_ascii=False))


if __name__ == '__main__':
    main()
