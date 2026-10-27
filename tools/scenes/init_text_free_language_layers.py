"""Create empty, source-hash-bound multilingual overlay records for text-free scenes."""
import argparse
import json
from pathlib import Path


PROJECT_ROOT = Path("/Volumes/T7/yahwehs-globe-scenes")
LANGUAGES = ("zh-Hans", "en")


def load_manifest(manifest):
    rows = [json.loads(line) for line in manifest.read_text(encoding="utf-8").splitlines() if line]
    if len(rows) != 1443 or len({row["id"] for row in rows}) != 1443:
        raise SystemExit("Expected exactly 1,443 unique source rows; refusing to continue.")
    if any(not row.get("source_sha256") for row in rows):
        raise SystemExit("A source row has no SHA-256; refusing to create language layers.")
    return rows


def make_layer(row):
    return {
        "schema": "text-free-language-layer-v1",
        "id": row["id"],
        "source_image_sha256": row["source_sha256"],
        "base_image_sha256": None,
        "state": "not_started",
        "languages": {
            language: {
                "state": "not_started",
                "title": None,
                "scripture_reference": None,
                "factual_scene_caption": None,
                "key_verse": {
                    "reference": None,
                    "text": None,
                    "translation_or_source": None,
                    "verification": "not_started",
                },
                "layout": {
                    "status": "not_started",
                    "normalized_text_box": None,
                    "safe_area_review": None,
                },
            }
            for language in LANGUAGES
        },
        "notes": [],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--version", choices=("v1", "v2"), default="v1")
    args = parser.parse_args()
    project_dir = PROJECT_ROOT / f"no-text-derivatives-{args.version}"
    manifest = project_dir / "source-manifest.jsonl"
    layers_dir = project_dir / "language-layers"
    rows = load_manifest(manifest)
    existing = [row["id"] for row in rows if (layers_dir / f"{row['id']}.json").exists()]
    if existing:
        raise SystemExit(f"Refusing overwrite: {len(existing)} language-layer records already exist.")
    if args.dry_run:
        print(f"Would create {len(rows)} blank zh-Hans/en overlay records; no image text or verses populated.")
        return
    layers_dir.mkdir(parents=True, exist_ok=False)
    for row in rows:
        path = layers_dir / f"{row['id']}.json"
        with path.open("x", encoding="utf-8") as handle:
            json.dump(make_layer(row), handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    print(f"Created {len(rows)} blank language-layer records in {layers_dir}")
    print("All base_image_sha256 values are null until a matching text-free base passes review.")


if __name__ == "__main__":
    main()
