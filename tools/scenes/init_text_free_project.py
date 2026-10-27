"""Initialize an immutable-source intake manifest for the text-free scene derivatives."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
SOURCE_DIR = Path("/Volumes/T7/yahwehs-globe-scenes/non-gamified-merged-live-v3")
PROJECT_ROOT = Path("/Volumes/T7/yahwehs-globe-scenes")
EVENTS_FILE = REPO / "data/events/all-events.json"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


parser = argparse.ArgumentParser()
parser.add_argument("--version", choices=("v1", "v2"), default="v1")
args = parser.parse_args()
PROJECT_DIR = PROJECT_ROOT / f"no-text-derivatives-{args.version}"

events = json.loads(EVENTS_FILE.read_text())["events"]
if len(events) != 1443 or len({event["id"] for event in events}) != 1443:
    raise SystemExit("Expected exactly 1,443 unique event IDs; refusing initialization.")
if PROJECT_DIR.exists():
    raise SystemExit(f"Project directory already exists; refusing overwrite: {PROJECT_DIR}")
if not SOURCE_DIR.is_dir():
    raise SystemExit(f"Immutable source directory is unavailable: {SOURCE_DIR}")

missing = [event["id"] for event in events if not (SOURCE_DIR / f"{event['id']}.png").is_file()]
if missing:
    raise SystemExit(f"Missing {len(missing)} source images; refusing partial initialization.")

status_dir = PROJECT_DIR / "status"
live_dir = PROJECT_DIR / "live"
status_dir.mkdir(parents=True)
live_dir.mkdir()
created_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
manifest_path = PROJECT_DIR / "source-manifest.jsonl"

with manifest_path.open("x", encoding="utf-8") as manifest:
    for event in events:
        source = SOURCE_DIR / f"{event['id']}.png"
        row = {
            "schema": "text-free-source-v1",
            "id": event["id"],
            "title_zh": event.get("zh"),
            "title_en": event.get("en"),
            "reference_zh": event.get("refZh"),
            "reference_en": event.get("ref"),
            "source_path": str(source),
            "source_sha256": sha256(source),
            "candidate_path": str(live_dir / f"{event['id']}.png"),
            "candidate_sha256": None,
            "state": "not_started",
            "language_state": "not_started",
            "created_at": created_at,
        }
        manifest.write(json.dumps(row, ensure_ascii=False) + "\n")
        status_path = status_dir / f"{event['id']}.json"
        status_path.write_text(json.dumps({
            "id": event["id"],
            "state": "not_started",
            "source_sha256": row["source_sha256"],
            "candidate_sha256": None,
            "language_state": "not_started",
            "updated_at": created_at,
        }, ensure_ascii=False) + "\n")

print(f"Initialized {len(events)} source records; no source images copied or modified.")
print(f"Manifest: {manifest_path}")
