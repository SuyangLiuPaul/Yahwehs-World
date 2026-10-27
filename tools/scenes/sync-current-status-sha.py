import fcntl
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

T7 = Path('/Volumes/T7/yahwehs-globe-scenes')
MANIFEST = T7 / 'non-gamified-merged-manifest-v3.jsonl'
STATUS_DIR = T7 / 'non-gamified-merged-status-v3'
ARCHIVE = T7 / 'incoming-codex/status-sidecar-sha-sync-20261016'
LOCK = ARCHIVE / '.sync.lock'


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def atomic_write(path, data):
    fd, temp_name = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def main():
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    manifest = [json.loads(line) for line in MANIFEST.read_text().splitlines() if line.strip()]
    with open(LOCK, 'a+b') as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        changed = 0
        for row in manifest:
            event_id = row['id']
            status_path = STATUS_DIR / f'{event_id}.json'
            status = json.loads(status_path.read_text())
            if status.get('id') != event_id:
                raise SystemExit(f'{event_id}: status ID mismatch')
            image_sha = sha256(Path(row['derivative']))
            if image_sha != row.get('derivative_sha256'):
                raise SystemExit(f'{event_id}: current image does not match manifest; stop')
            if status.get('derivative_sha256') == image_sha:
                continue
            before_sha = status.get('derivative_sha256')
            item_dir = ARCHIVE / event_id
            item_dir.mkdir(exist_ok=False)
            before = json.dumps(status, ensure_ascii=False, indent=2) + '\n'
            (item_dir / 'status-before.json').write_text(before)
            receipt = {
                'id': event_id,
                'previous_sidecar_sha256': before_sha,
                'current_image_and_manifest_sha256': image_sha,
                'review_state_before': status.get('merged_review', 'inherited'),
                'review_state_changed': False,
                'only_sidecar_field_updated': 'derivative_sha256',
                'image_raw_lock_historic_approval_changed': False
            }
            (item_dir / 'sync-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
            status['derivative_sha256'] = image_sha
            after = json.dumps(status, ensure_ascii=False, indent=2) + '\n'
            restored = json.loads(after)
            restored['derivative_sha256'] = before_sha
            if restored != json.loads(before):
                raise SystemExit(f'{event_id}: unexpected sidecar field change')
            atomic_write(status_path, after.encode())
            changed += 1
            print(f'{event_id}: sidecar SHA synced; review state unchanged')
        print(f'complete: {changed} sidecar hashes synced; backups/receipts: {ARCHIVE}')


if __name__ == '__main__':
    if len(sys.argv) != 1:
        raise SystemExit('usage: python3 tools/scenes/sync-current-status-sha.py')
    main()
