#!/usr/bin/env python3
"""Audit a source-preserving bilingual derivative manifest without modifying files.

The complete run requires one verified derivative for every event in
data/events/all-events.json. --allow-partial is intended for staging checks.
Each derivative may differ from raw only inside its bottom-button masks (plus
the configured 4 px feather), its opaque English-card rectangle, and any
explicitly declared `hud_mask_boxes` used for small HUD fragments outside the
card.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest(path: Path) -> list[dict]:
    rows = []
    for line_no, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_no}: invalid JSON: {exc}") from exc
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            raise ValueError(f"{path}:{line_no}: expected JSON object with string id")
        rows.append(row)
    return rows


def allowed_pixels(size: tuple[int, int], row: dict) -> np.ndarray:
    width, height = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    feather = int(row.get("feather_px", 4))
    buttons = row.get("button_masks")
    cluster = row.get("button_cluster_mask_bbox")
    if isinstance(buttons, list) and len(buttons) == 3:
        for button in buttons:
            if not isinstance(button, list) or len(button) != 5:
                raise ValueError(f"malformed button mask: {button!r}")
            x0, y0, x1, y1, radius = map(int, button)
            if not (0 <= x0 < x1 < width and 0 <= y0 < y1 < height and radius >= 0):
                raise ValueError(f"button mask outside image or malformed: {button!r}")
            draw.rounded_rectangle(
                (x0 - feather, y0 - feather, x1 + feather, y1 + feather),
                radius=radius + feather,
                fill=255,
            )
    elif isinstance(cluster, list) and len(cluster) == 5:
        x0, y0, x1, y1, radius = map(int, cluster)
        if not (0 <= x0 < x1 < width and 0 <= y0 < y1 < height and radius >= 0):
            raise ValueError(f"button cluster mask outside image or malformed: {cluster!r}")
        draw.rounded_rectangle(
            (x0 - feather, y0 - feather, x1 + feather, y1 + feather),
            radius=radius + feather,
            fill=255,
        )
    else:
        raise ValueError("provide three button_masks or one button_cluster_mask_bbox")
    box = row.get("card_box")
    if not isinstance(box, list) or len(box) != 4:
        raise ValueError("card_box must be [x0,y0,x1,y1]")
    x0, y0, x1, y1 = map(int, box)
    if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
        raise ValueError(f"card_box outside image or malformed: {box!r}")
    mask_array = np.asarray(mask) > 0
    mask_array[y0:y1, x0:x1] = True
    hud_boxes = row.get("hud_mask_boxes", [])
    if not isinstance(hud_boxes, list):
        raise ValueError("hud_mask_boxes must be a list of [x0,y0,x1,y1] boxes")
    for box in hud_boxes:
        if not isinstance(box, list) or len(box) != 4:
            raise ValueError(f"malformed HUD mask box: {box!r}")
        hx0, hy0, hx1, hy1 = map(int, box)
        if not (0 <= hx0 < hx1 <= width and 0 <= hy0 < hy1 <= height):
            raise ValueError(f"HUD mask box outside image or malformed: {box!r}")
        mask_array[hy0:hy1, hx0:hx1] = True
    return mask_array


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument(
        "--events",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data/events/all-events.json",
    )
    parser.add_argument("--raw-dir", type=Path, required=True)
    parser.add_argument("--derivative-dir", type=Path, required=True)
    parser.add_argument("--allow-partial", action="store_true")
    args = parser.parse_args()

    events = json.loads(args.events.read_text())["events"]
    expected = [event["id"] for event in events]
    expected_set = set(expected)
    errors: list[str] = []
    rows = read_manifest(args.manifest)
    by_id: dict[str, dict] = {}
    for row in rows:
        event_id = row["id"]
        if event_id in by_id:
            errors.append(f"duplicate manifest entry: {event_id}")
        by_id[event_id] = row
        if event_id not in expected_set:
            errors.append(f"unknown event id: {event_id}")

    missing = sorted(expected_set - set(by_id), key=expected.index)
    if missing and not args.allow_partial:
        errors.append(f"missing {len(missing)} event ids; first: {', '.join(missing[:10])}")

    checked = 0
    for event_id, row in by_id.items():
        if event_id not in expected_set:
            continue
        if row.get("status") != "complete" or row.get("preserving_complete") is not True:
            errors.append(f"{event_id}: not marked source-preserving complete")
        if row.get("bilingual_status") != "complete":
            errors.append(f"{event_id}: not marked bilingual complete")
        if row.get("review") != "pass":
            errors.append(f"{event_id}: missing passing review")
        raw_path = args.raw_dir / f"{event_id}.png"
        derivative_path = args.derivative_dir / f"{event_id}.png"
        if not raw_path.is_file():
            errors.append(f"{event_id}: missing raw file {raw_path}")
            continue
        if not derivative_path.is_file():
            errors.append(f"{event_id}: missing derivative file {derivative_path}")
            continue
        raw_hash = sha256(raw_path)
        derivative_hash = sha256(derivative_path)
        if row.get("source_sha256") != raw_hash:
            errors.append(f"{event_id}: raw/source SHA-256 mismatch")
        if row.get("derivative_sha256") != derivative_hash:
            errors.append(f"{event_id}: derivative SHA-256 mismatch")
        with Image.open(raw_path) as source, Image.open(derivative_path) as derivative:
            source_rgb = np.asarray(source.convert("RGB"))
            derivative_rgb = np.asarray(derivative.convert("RGB"))
        if source_rgb.shape != derivative_rgb.shape:
            errors.append(f"{event_id}: dimension mismatch {source_rgb.shape} != {derivative_rgb.shape}")
            continue
        try:
            allowed = allowed_pixels((source_rgb.shape[1], source_rgb.shape[0]), row)
        except (TypeError, ValueError) as exc:
            errors.append(f"{event_id}: invalid masks/card: {exc}")
            continue
        changed = np.any(source_rgb != derivative_rgb, axis=2)
        outside = int(np.logical_and(changed, ~allowed).sum())
        if outside:
            errors.append(f"{event_id}: {outside} changed pixels outside approved masks/card")
        if row.get("changed_outside_masks") != 0:
            errors.append(f"{event_id}: recorded changed_outside_masks is not zero")
        checked += 1

    report = {
        "expected_events": len(expected),
        "manifest_rows": len(rows),
        "checked_images": checked,
        "missing_event_ids": len(missing),
        "allow_partial": args.allow_partial,
        "errors": errors,
        "result": "PASS" if not errors and (args.allow_partial or not missing) else "FAIL",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
