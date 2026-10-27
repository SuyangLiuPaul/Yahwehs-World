#!/usr/bin/env python3
"""Compose the exact, repeatable event HUD over a text-free scene plate.

Usage:
  python3 tools/scenes/composite_scene.py PLATE OUTPUT EVENT_ID

The event copy is read from assets-scenes/codex-queue.json.  Keeping words out
of the image model removes the most common rejection cause: invented glyphs.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ASSETS = Path('/Users/pliu0036/Documents/CodingProject/assets-scenes')
ZH_FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
EN_FONT = '/System/Library/Fonts/Avenir Next.ttc'


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size, index=index)


def round_panel(layer: Image.Image, box: tuple[int, int, int, int], radius: int,
                fill: tuple[int, int, int, int], outline=(255, 215, 125, 120), width=2) -> None:
    ImageDraw.Draw(layer).rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)


def shadowed(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str,
             fnt: ImageFont.FreeTypeFont, fill: str, stroke: int = 2) -> None:
    draw.text((xy[0] + 2, xy[1] + 3), text, font=fnt, fill=(0, 0, 0, 190), stroke_width=stroke, stroke_fill=(0, 0, 0, 145))
    draw.text(xy, text, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=(34, 21, 13, 225))


def resource_icon(draw: ImageDraw.ImageDraw, x: int, y: int, kind: int) -> None:
    gold = (244, 190, 70, 255)
    if kind == 0:  # timber
        draw.rounded_rectangle((x, y + 9, x + 36, y + 29), 6, fill=(157, 88, 37, 255), outline=gold, width=2)
        draw.ellipse((x - 2, y + 8, x + 16, y + 30), fill=(205, 133, 62, 255), outline=gold, width=2)
        draw.ellipse((x + 3, y + 13, x + 11, y + 25), outline=(105, 57, 30, 255), width=2)
    elif kind == 1:  # stone
        draw.polygon([(x + 3, y + 25), (x + 10, y + 7), (x + 27, y + 2), (x + 38, y + 16), (x + 31, y + 32), (x + 11, y + 34)], fill=(184, 194, 203, 255), outline=(239, 244, 245, 255))
    else:  # grain
        draw.line((x + 18, y + 34, x + 18, y + 2), fill=gold, width=3)
        for yy, side in ((7, -1), (12, 1), (17, -1), (22, 1), (27, -1)):
            cx = x + 18 + side * 7
            draw.ellipse((cx - 6, y + yy - 5, cx + 6, y + yy + 5), fill=(244, 184, 45, 255), outline=(255, 224, 115, 255))


def utility_icon(draw: ImageDraw.ImageDraw, x: int, y: int, kind: str) -> None:
    """The two reference-game controls, drawn without a font dependency."""
    ink = (244, 242, 226, 255)
    if kind == 'menu':
        for yy in (14, 25, 36):
            draw.rounded_rectangle((x + 12, y + yy, x + 41, y + yy + 4), 2, fill=ink)
        return
    cx, cy = x + 27, y + 27
    draw.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), outline=ink, width=5)
    draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=ink)
    for dx, dy in ((0,-17),(0,17),(-17,0),(17,0),(-12,-12),(12,-12),(-12,12),(12,12)):
        draw.line((cx + dx * .72, cy + dy * .72, cx + dx, cy + dy), fill=ink, width=5)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Wrap exact source copy by rendered glyph width; never truncate it."""
    lines: list[str] = []
    current = ""
    for char in text:
        candidate = current + char
        if current and draw.textbbox((0, 0), candidate, font=fnt)[2] > max_width:
            lines.append(current)
            current = char
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit('usage: composite_scene.py PLATE OUTPUT EVENT_ID')
    plate, output, event_id = map(Path, sys.argv[1:])
    queue = json.loads((ASSETS / 'codex-queue.json').read_text())
    event = next((row for row in queue if row['id'] == str(event_id)), None)
    if not event:
        raise SystemExit(f'event not found: {event_id}')

    base = Image.open(plate).convert('RGB').resize((1672, 941), Image.Resampling.LANCZOS)
    ui = Image.new('RGBA', base.size)
    d = ImageDraw.Draw(ui)

    # Legible corners without flattening the scene into one dark overlay.
    shade = Image.new('RGBA', base.size)
    sd = ImageDraw.Draw(shade)
    sd.rectangle((0, 0, 700, 300), fill=(3, 10, 18, 105))
    sd.rectangle((980, 0, 1672, 115), fill=(3, 10, 18, 80))
    sd.rectangle((300, 770, 1372, 941), fill=(3, 10, 18, 75))
    shade = shade.filter(ImageFilter.GaussianBlur(28))
    ui.alpha_composite(shade)
    d = ImageDraw.Draw(ui)

    # Event identity.
    d.ellipse((34, 30, 98, 94), fill=(208, 153, 43, 235), outline=(255, 231, 155, 255), width=3)
    d.polygon([(66, 40), (78, 61), (70, 84), (51, 70), (52, 50)], fill=(83, 41, 28, 255))
    shadowed(d, (116, 24), event['zh'], font(ZH_FONT, 48), '#fff6df', 2)
    shadowed(d, (119, 82), event['en'], font(EN_FONT, 27), '#f4d990', 1)

    # Scripture card: exact copy, no generated glyphs. Long summaries wrap and
    # grow the parchment vertically instead of spilling into the scene.
    ref_font = font(ZH_FONT, 27)
    summary_font = font(ZH_FONT, 22)
    summary_lines = wrap_text(d, event['summary'], summary_font, 392)
    summary_line_height = 31
    card_bottom = max(255, 198 + len(summary_lines) * summary_line_height + 12)
    card = (36, 128, 500, card_bottom)
    round_panel(ui, card, 16, (247, 232, 193, 241), (255, 246, 213, 255), 3)
    d = ImageDraw.Draw(ui)
    d.line((61, 151, 61, card_bottom - 20), fill=(164, 102, 40, 180), width=4)
    d.text((82, 151), event['refZh'], font=ref_font, fill=(54, 33, 20, 255))
    d.multiline_text((82, 193), '\n'.join(summary_lines), font=summary_font,
                     fill=(78, 47, 25, 255), spacing=4)

    # Resource counters are visual constants shared by the whole collection.
    for i, value in enumerate(('320', '180', '240')):
        x = 1050 + i * 157
        round_panel(ui, (x, 29, x + 143, 82), 14, (17, 37, 56, 220), (255, 231, 155, 115), 2)
        d = ImageDraw.Draw(ui)
        resource_icon(d, x + 12, 37, i)
        d.text((x + 58, 38), value, font=font(EN_FONT, 26), fill=(255, 249, 226, 255), stroke_width=1, stroke_fill=(0, 0, 0, 180))
    for x, kind in ((1518, 'gear'), (1583, 'menu')):
        round_panel(ui, (x, 29, x + 54, 83), 14, (17, 37, 56, 225), (255, 231, 155, 120), 2)
        utility_icon(ImageDraw.Draw(ui), x, 29, kind)

    # Bottom controls: real text, consistent hierarchy, generous touch targets.
    buttons = (('探索', 'Explore'), ('人物', 'People'), ('地图', 'Map'))
    bw, gap, y = 282, 18, 808
    start = (1672 - (bw * 3 + gap * 2)) // 2
    for i, (zh, en) in enumerate(buttons):
        x = start + i * (bw + gap)
        active = i == 0
        fill = (194, 130, 46, 241) if active else (79, 49, 30, 232)
        edge = (255, 223, 139, 245) if active else (207, 153, 71, 210)
        round_panel(ui, (x, y, x + bw, y + 102), 18, fill, edge, 3)
        d = ImageDraw.Draw(ui)
        # Simple deterministic icon; never introduce accidental lettering.
        cx = x + 49
        d.ellipse((cx - 17, y + 25, cx + 17, y + 59), outline=(255, 244, 205, 255), width=4)
        d.line((cx - 12, y + 55, cx + 12, y + 29), fill=(255, 244, 205, 255), width=4)
        d.text((x + 88, y + 17), zh, font=font(ZH_FONT, 30), fill=(255, 250, 227, 255))
        d.text((x + 88, y + 56), en, font=font(EN_FONT, 22), fill=(255, 234, 185, 255))

    output.parent.mkdir(parents=True, exist_ok=True)
    Image.alpha_composite(base.convert('RGBA'), ui).convert('RGB').save(output, quality=96, optimize=True)
    print(output)


if __name__ == '__main__':
    main()
