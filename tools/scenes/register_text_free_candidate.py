"""Register a new text-free candidate only after same-SHA dual review."""
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path("/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


parser = argparse.ArgumentParser()
parser.add_argument("event_id")
parser.add_argument("candidate", type=Path)
parser.add_argument("review", type=Path)
args = parser.parse_args()

manifest_path = ROOT / "source-manifest.jsonl"
manifest = [json.loads(line) for line in manifest_path.read_text(encoding="utf-8").splitlines() if line.strip()]
rows = [row for row in manifest if row.get("id") == args.event_id]
if len(rows) != 1:
    raise SystemExit("Expected exactly one matching source-manifest row.")
row = rows[0]
review = read_json(args.review)
status_path = ROOT / "status" / f"{args.event_id}.json"
layer_path = ROOT / "language-layers" / f"{args.event_id}.json"
status, layer = read_json(status_path), read_json(layer_path)
candidate_sha = sha256(args.candidate)
source_sha = sha256(Path(row["source_path"]))

if row.get("state") != "not_started" or status.get("state") != "not_started":
    raise SystemExit("Refusing to replace or downgrade a non-new text-free state.")
if row.get("source_sha256") != source_sha or status.get("source_sha256") != source_sha:
    raise SystemExit("Current source SHA differs from the initialized v2 source record.")
if review.get("id") != args.event_id or review.get("source_sha256") != source_sha:
    raise SystemExit("Review event/source identity does not match the current source.")
if review.get("candidate_sha256") != candidate_sha:
    raise SystemExit("Review candidate SHA does not match the supplied candidate.")
independent = review.get("independent_review", {})
if (review.get("state") != "pass"
        or review.get("root_visual_review", {}).get("result") != "pass"
        or independent.get("status") != "pass"
        or independent.get("candidate_sha256") != candidate_sha):
    raise SystemExit("Same-SHA root and independent PASS evidence is required.")
if layer.get("source_image_sha256") != source_sha or layer.get("base_image_sha256") is not None:
    raise SystemExit("Language layer source is mismatched or already bound; refusing overwrite.")

live_path = ROOT / "live" / f"{args.event_id}.png"
evidence_path = ROOT / "evidence" / f"{args.event_id}-no-text-review-v1.json"
if live_path.exists() or evidence_path.exists():
    raise SystemExit("Live candidate or evidence already exists; refusing overwrite.")
live_path.parent.mkdir(parents=True, exist_ok=True)
evidence_path.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(args.candidate, live_path)
if sha256(live_path) != candidate_sha:
    live_path.unlink()
    raise SystemExit("Copied candidate SHA mismatch; removed incomplete live copy.")
shutil.copy2(args.review, evidence_path)

now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
row.update({"candidate_sha256": candidate_sha, "state": "pass", "language_state": "not_started"})
manifest_tmp = manifest_path.with_suffix(".jsonl.tmp")
with manifest_tmp.open("x", encoding="utf-8") as handle:
    for item in manifest:
        handle.write(json.dumps(item, ensure_ascii=False) + "\n")
manifest_tmp.replace(manifest_path)

status.update({
    "state": "pass",
    "candidate_sha256": candidate_sha,
    "candidate_path": str(live_path),
    "review_evidence": str(evidence_path),
    "approved_at": now,
    "root_review": "pass",
    "independent_review": "pass",
    "language_state": "not_started",
    "updated_at": now,
})
status_tmp = status_path.with_suffix(".json.tmp")
status_tmp.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
status_tmp.replace(status_path)

layer["base_image_sha256"] = candidate_sha
layer["notes"].append("Text-free base is SHA-bound after same-SHA root and independent PASS; language content and layout remain not_started.")
layer_tmp = layer_path.with_suffix(".json.tmp")
layer_tmp.write_text(json.dumps(layer, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
layer_tmp.replace(layer_path)

print(json.dumps({"id": args.event_id, "state": "pass", "candidate_sha256": candidate_sha,
                  "live_path": str(live_path), "review_evidence": str(evidence_path),
                  "language_state": "not_started"}, ensure_ascii=False))
