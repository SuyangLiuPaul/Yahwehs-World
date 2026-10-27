#!/usr/bin/env python3
"""Build a raw-preserving no-game pilot from a raw image and generated fill.

Only the three bottom-button masks are taken from the generated fill. The
opaque bilingual card covers the upper-right counters/controls. Every other
pixel remains copied from the raw source.

Example:
  python3 tools/scenes/preserve_raw_hud.py \
    --raw /path/raw.png --fill /path/generated-no-hud.png --out /tmp/pilot.png \
    --reference 'Mark 1:40–1:45' \
    --summary 'Jesus cleanses and touches the unclean.' \
    --buttons '[ [346,794,646,902,21], [688,794,979,902,21], [1022,794,1325,902,21] ]'

Coordinates are source-image pixels. Do not use a guessed/common mask without
visually checking its fit against the specific raw image. The fill is only a
reconstruction for pixels that the original UI hid; it must not replace the
visible story scene.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

CARD_BOX = (1035, 8, 1660, 96)
FEATHER = 4
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"


def component_mask(size: tuple[int, int], buttons: list[list[int]], pad: int = 0) -> np.ndarray:
    """Return a union mask for rounded button rectangles [x0,y0,x1,y1,r]."""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for x0, y0, x1, y1, radius in buttons:
        draw.rounded_rectangle(
            (x0 - pad, y0 - pad, x1 + pad, y1 + pad),
            radius=radius + pad,
            fill=255,
        )
    return np.asarray(mask) > 0


def box_mask(size: tuple[int, int], boxes: list[list[int]], pad: int = 0) -> np.ndarray:
    """Return a union mask for measured rectangular HUD boxes [x0,y0,x1,y1]."""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for x0, y0, x1, y1 in boxes:
        draw.rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), fill=255)
    return np.asarray(mask) > 0


def render_card(
    image: Image.Image, reference: str, summary: str, card_box: tuple[int, int, int, int]
) -> Image.Image:
    """Cover the top-right HUD with a compact, opaque bilingual topic card."""
    x0, y0, x1, y1 = card_box
    card_w, card_h = x1 - x0, y1 - y0
    card = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle(
        (1, 1, card_w - 2, card_h - 2),
        radius=18,
        fill=(246, 225, 177, 255),
        outline=(121, 78, 34, 255),
        width=4,
    )
    draw.rounded_rectangle(
        (8, 8, card_w - 9, card_h - 9),
        radius=13,
        outline=(255, 246, 219, 255),
        width=2,
    )
    ref_font = ImageFont.truetype(FONT_BOLD, 25)
    summary_font = ImageFont.truetype(FONT_REGULAR, 20)
    draw.text((20, 13), reference, font=ref_font, fill=(57, 38, 21, 255))
    if draw.textbbox((0, 0), summary, font=summary_font)[2] > card_w - 40:
        raise ValueError(
            "English topic summary does not fit the compact card on one line; "
            "shorten it without dropping the event's central topic."
        )
    draw.text((20, 49), summary, font=summary_font, fill=(68, 45, 24, 255))
    result = image.convert("RGBA")
    result.alpha_composite(card, (x0, y0))
    return result.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--fill", type=Path, required=True, help="Built-in imagegen no-HUD fill candidate")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--reference", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument(
        "--card-box",
        default=json.dumps(CARD_BOX),
        help="JSON [x0,y0,x1,y1] card bounds; default covers the upper-right HUD",
    )
    parser.add_argument(
        "--buttons",
        required=True,
        help="JSON list of three [x0,y0,x1,y1,radius] rounded-rectangle masks",
    )
    parser.add_argument(
        "--hud-boxes",
        default="[]",
        help="Optional JSON list of measured [x0,y0,x1,y1] HUD fragments to reconstruct from fill",
    )
    args = parser.parse_args()

    raw_img = Image.open(args.raw).convert("RGB")
    fill_img = Image.open(args.fill).convert("RGB")
    if raw_img.size != fill_img.size:
        raise ValueError(f"raw/fill dimensions differ: {raw_img.size} != {fill_img.size}")
    width, height = raw_img.size
    buttons = json.loads(args.buttons)
    hud_boxes = json.loads(args.hud_boxes)
    card_box = tuple(json.loads(args.card_box))
    if len(card_box) != 4:
        raise ValueError("card box must contain [x0,y0,x1,y1]")
    cx0, cy0, cx1, cy1 = card_box
    if not (0 <= cx0 < cx1 <= width and 0 <= cy0 < cy1 <= height):
        raise ValueError(f"card box outside image or malformed: {card_box}")
    if len(buttons) != 3:
        raise ValueError("exactly three button masks are required")
    for x0, y0, x1, y1, radius in buttons:
        if not (0 <= x0 < x1 < width and 0 <= y0 < y1 < height and radius >= 0):
            raise ValueError(f"button mask outside image or malformed: {(x0, y0, x1, y1, radius)}")
    for x0, y0, x1, y1 in hud_boxes:
        if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
            raise ValueError(f"HUD mask outside image or malformed: {(x0, y0, x1, y1)}")

    raw = np.asarray(raw_img, dtype=np.uint8)
    fill = np.asarray(fill_img, dtype=np.uint8)
    core = component_mask(raw_img.size, buttons)
    expanded = component_mask(raw_img.size, buttons, pad=FEATHER)
    hud_core = box_mask(raw_img.size, hud_boxes)
    hud_expanded = box_mask(raw_img.size, hud_boxes, pad=FEATHER)
    distance = cv2.distanceTransform(expanded.astype(np.uint8), cv2.DIST_L2, 3)
    alpha = np.clip(distance / FEATHER, 0, 1).astype(np.float32)
    alpha[core] = 1
    mixed = np.rint(raw.astype(np.float32) * (1 - alpha[..., None]) +
                    fill.astype(np.float32) * alpha[..., None]).astype(np.uint8)
    if hud_boxes:
        hud_distance = cv2.distanceTransform(hud_expanded.astype(np.uint8), cv2.DIST_L2, 3)
        hud_alpha = np.clip(hud_distance / FEATHER, 0, 1).astype(np.float32)
        hud_alpha[hud_core] = 1
        mixed = np.rint(mixed.astype(np.float32) * (1 - hud_alpha[..., None]) +
                        fill.astype(np.float32) * hud_alpha[..., None]).astype(np.uint8)
    output = render_card(Image.fromarray(mixed), args.reference, args.summary, card_box)

    # Verify the only modified areas are expanded button/HUD masks and the card.
    out = np.asarray(output)
    allowed = expanded.copy()
    allowed |= hud_expanded
    x0, y0, x1, y1 = card_box
    allowed[y0:y1, x0:x1] = True
    changed = np.any(raw != out, axis=2)
    outside_diffs = int(np.logical_and(changed, ~allowed).sum())
    if outside_diffs:
        raise RuntimeError(f"source pixels changed outside approved masks: {outside_diffs}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.out, format="PNG", optimize=True)
    print(json.dumps({
        "output": str(args.out),
        "dimensions": [width, height],
        "changed_outside_masks": outside_diffs,
        "bottom_mask_core_pixels": int(core.sum()),
        "bottom_mask_expanded_pixels": int(expanded.sum()),
        "hud_mask_core_pixels": int(hud_core.sum()),
        "hud_mask_expanded_pixels": int(hud_expanded.sum()),
        "english_card_box": list(card_box),
        "feather_px": FEATHER,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
