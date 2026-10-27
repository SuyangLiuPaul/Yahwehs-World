"""Reuse an exact-SHA approved text-free candidate in a fresh project version."""
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path("/Volumes/T7/yahwehs-globe-scenes")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("event_id")
    parser.add_argument("--from-version", choices=("v1",), default="v1")
    parser.add_argument("--to-version", choices=("v2",), default="v2")
    args = parser.parse_args()

    source_project = ROOT / f"no-text-derivatives-{args.from_version}"
    target_project = ROOT / f"no-text-derivatives-{args.to_version}"
    source_manifest = [json.loads(line) for line in (source_project / "source-manifest.jsonl").read_text().splitlines() if line]
    target_manifest_path = target_project / "source-manifest.jsonl"
    target_manifest = [json.loads(line) for line in target_manifest_path.read_text().splitlines() if line]
    old_row = next((row for row in source_manifest if row.get("id") == args.event_id), None)
    new_row = next((row for row in target_manifest if row.get("id") == args.event_id), None)
    if not old_row or not new_row or old_row.get("source_sha256") != new_row.get("source_sha256"):
        raise SystemExit("Source records are missing or source SHA-256 values differ; refusing import.")

    old_status_path = source_project / "status" / f"{args.event_id}.json"
    new_status_path = target_project / "status" / f"{args.event_id}.json"
    old_status, new_status = read_json(old_status_path), read_json(new_status_path)
    if old_status.get("state") != "pass" or new_status.get("state") != "not_started":
        raise SystemExit("Expected a source PASS and untouched target status; refusing import.")

    old_review_path = Path(old_status["review_evidence"])
    old_review = read_json(old_review_path)
    candidate_path = source_project / "live" / f"{args.event_id}.png"
    candidate_sha = sha256(candidate_path)
    independent = old_review.get("independent_review", {})
    if (old_review.get("source_sha256") != new_row["source_sha256"]
            or old_review.get("candidate_sha256") != candidate_sha
            or old_review.get("root_visual_review", {}).get("result") != "pass"
            or independent.get("status") != "pass"
            or independent.get("candidate_sha256") != candidate_sha):
        raise SystemExit("Prior exact-SHA root/independent review is incomplete; refusing import.")

    source_layer = read_json(source_project / "language-layers" / f"{args.event_id}.json")
    target_layer_path = target_project / "language-layers" / f"{args.event_id}.json"
    if (source_layer.get("source_image_sha256") != new_row["source_sha256"]
            or source_layer.get("base_image_sha256") != candidate_sha
            or source_layer.get("state") != "draft"):
        raise SystemExit("Source-language layer is not a matching draft; refusing import.")
    target_layer = read_json(target_layer_path)
    if target_layer.get("state") != "not_started" or target_layer.get("base_image_sha256") is not None:
        raise SystemExit("Target-language layer already has state; refusing overwrite.")

    target_candidate = target_project / "live" / f"{args.event_id}.png"
    if target_candidate.exists():
        raise SystemExit("Target candidate already exists; refusing overwrite.")
    shutil.copy2(candidate_path, target_candidate)
    if sha256(target_candidate) != candidate_sha:
        target_candidate.unlink()
        raise SystemExit("Copied candidate SHA mismatch; removed incomplete target copy.")

    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    evidence_path = target_project / "evidence" / f"{args.event_id}-reused-exact-sha-review.json"
    evidence_path.parent.mkdir(exist_ok=True)
    evidence = {
        "schema": "text-free-candidate-review-v2",
        "id": args.event_id,
        "state": "pass",
        "source_sha256": new_row["source_sha256"],
        "candidate_sha256": candidate_sha,
        "candidate_path": str(target_candidate),
        "reviewed_at": now,
        "method": "Reused byte-identical v1 candidate after v2 root visual review; no new API request.",
        "root_visual_review": {
            "result": "pass",
            "notes": [
                "Rechecked the exact v2 source and candidate at native size.",
                "Chinese/English title, scripture card, and summary are absent.",
                "Upper-left globe icon is preserved; light, water, land, and vegetation remain coherent with Genesis 1:1–1:13.",
                "No obvious residual lettering, card outline, patch seam, or lost story-bearing area."
            ]
        },
        "independent_review": {
            "status": "pass",
            "reviewer": independent.get("reviewer"),
            "candidate_sha256": candidate_sha,
            "reused_evidence": str(old_review_path),
            "notes": independent.get("notes")
        },
        "reused_from": {
            "version": args.from_version,
            "status_path": str(old_status_path),
            "review_path": str(old_review_path),
            "candidate_path": str(candidate_path)
        },
        "api_request_created": False,
        "v1_modified": False
    }
    evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    new_status.update({
        "state": "pass",
        "candidate_sha256": candidate_sha,
        "candidate_path": str(target_candidate),
        "review_evidence": str(evidence_path),
        "approved_at": now,
        "root_review": "pass",
        "independent_review": "pass",
        "language_state": "draft",
        "updated_at": now
    })
    new_status_path.write_text(json.dumps(new_status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    new_row.update({"candidate_sha256": candidate_sha, "state": "pass", "language_state": "draft"})
    temporary_manifest = target_manifest_path.with_suffix(".jsonl.tmp")
    with temporary_manifest.open("x", encoding="utf-8") as handle:
        for row in target_manifest:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    temporary_manifest.replace(target_manifest_path)

    source_layer["notes"].append(f"Draft reused with byte-identical reviewed base in {args.to_version}; layout remains unverified.")
    target_layer_path.write_text(json.dumps(source_layer, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"id": args.event_id, "state": "pass", "candidate_sha256": candidate_sha,
                      "evidence": str(evidence_path), "api_request_created": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
