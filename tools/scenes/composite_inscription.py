"""Composite the genuine Daniel 5:25 inscription onto the blank plaster wall of a text-free square.

    python3 tools/scenes/composite_inscription.py daniel-5-1 [--box x0 y0 x1 y1 (normalised)] [--out PATH]

Reads S/no-text-derivatives-v2/live/<id>.png (which stays text-free and is never modified), draws the
exception's Imperial Aramaic letters with a real font (never the image generator), and writes
S/no-text-derivatives-v2/inscribed/<id>.png plus <id>.inscription.json (base/output SHA, codepoints,
font SHA, box, changed bbox). gate_check.py requires that evidence for ids that have this exception.
Refuses when the box is not plain wall (stddev above the exception's max_box_stddev), the font lacks a
glyph, or the output exists. Letters are placed one by one right to left, so no text shaper is involved.
"""
import argparse
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import square_exceptions as sx  # noqa: E402

SCENES = os.environ.get("SCENES_ROOT", "/Volumes/T7/yahwehs-globe-scenes")
SQUARE = os.path.join(SCENES, "no-text-derivatives-v2")
SS = 3                      # supersampling for the glyph mask
GOLD = (255, 226, 150)
GLOW = (255, 214, 120)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def font_has_glyphs(font_path, text):
    from fontTools.ttLib import TTFont
    cmap = TTFont(font_path, fontNumber=0)["cmap"].getBestCmap()
    return [hex(ord(c)) for c in set(text) if c != " " and ord(c) not in cmap]


def layout_mask(lines, font_path, box_px):
    """L mask (size of box_px, SS times) with the lines drawn right to left, centred. Returns (mask, glyph count)."""
    x0, y0, x1, y1 = box_px
    w, h = (x1 - x0) * SS, (y1 - y0) * SS
    n = len(lines)
    size = int(h / (n * 1.45))
    while True:
        font = ImageFont.truetype(font_path, size)
        advance = lambda ch: font.getlength(ch) if ch != " " else size * 0.35
        widths = [sum(advance(c) + size * 0.06 for c in line) for line in lines]
        if max(widths) <= w * 0.94 or size < 8:
            break
        size = int(size * 0.95)
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    pitch = h / n
    count = 0
    for row, line in enumerate(lines):
        x = (w + widths[row]) / 2           # start at the right edge of the centred line
        for ch in line:                       # logical order = right to left
            step = advance(ch) + size * 0.06
            x -= step
            if ch != " ":
                draw.text((x, row * pitch + pitch * 0.5), ch, font=font, fill=255, anchor="lm")
                count += 1
    return mask, count


def render(base, mask_ss, box_px, margin):
    """Incised lettering lit from the upper left, plus a restrained pale gold glow. Returns RGB image."""
    x0, y0, x1, y1 = box_px
    full = Image.new("L", base.size, 0)
    full.paste(mask_ss.resize((x1 - x0, y1 - y0), Image.LANCZOS), (x0, y0))
    arr = np.asarray(base, dtype=np.float32)
    m = np.asarray(full, dtype=np.float32)[..., None] / 255.0
    glow = np.asarray(full.filter(ImageFilter.GaussianBlur(margin / 3)), dtype=np.float32)[..., None] / 255.0
    out = arr + glow * 0.5 * (np.array(GLOW, np.float32) - arr) * 0.55      # soft gold light, never opaque
    shade = np.asarray(ImageChops.offset(full, 2, 2).filter(ImageFilter.GaussianBlur(1.2)), np.float32)[..., None] / 255.0
    out = out * (1 - 0.45 * np.clip(shade - m, 0, 1))                         # shadow edge down-right inside the cut
    hi = np.asarray(ImageChops.offset(full, -1, -1), np.float32)[..., None] / 255.0
    out = out * (1 - 0.30 * np.clip(hi - m, 0, 1))                            # darker rim upper-left (incised wall)
    out = out * (1 - m) + (0.55 * np.array(GOLD, np.float32) + 0.45 * out) * m  # lettering floor: gold lit by the lampstand
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def inscribe(event_id, base_path, out_path, box_norm=None, exc=None, scenes_root=SCENES):
    exc = exc or sx.get(event_id)
    if not exc:
        raise SystemExit(f"{event_id} has no entry in square_exceptions.json")
    sx.validate(exc)
    spec = exc["render"]
    font_path = spec["font_path"]
    lines = sx.render_lines(exc)
    missing = font_has_glyphs(font_path, "".join(lines))
    if missing:
        raise SystemExit(f"font lacks glyphs {missing}")
    if os.path.exists(out_path):
        raise SystemExit("refusing to overwrite an existing output")
    base = Image.open(base_path).convert("RGB")
    W, H = base.size
    nb = box_norm or spec["box_norm"]
    box_px = (int(nb[0] * W), int(nb[1] * H), int(nb[2] * W), int(nb[3] * H))
    region = np.asarray(base.crop(box_px), dtype=np.float32)
    sd = float(region.std(axis=(0, 1)).mean())
    if sd > spec["max_box_stddev"]:
        raise SystemExit(f"box is not empty plaster (stddev {sd:.1f} > {spec['max_box_stddev']}); pass --box")
    mask, count = layout_mask(lines, font_path, box_px)
    margin = max(6, (box_px[3] - box_px[1]) // 10)
    out = render(base, mask, box_px, margin)
    changed = (np.asarray(base) != np.asarray(out)).any(axis=2)       # any channel, any level
    diff = Image.fromarray((changed * 255).astype(np.uint8)).getbbox()
    gx = (max(0, box_px[0] - 3 * margin), max(0, box_px[1] - 3 * margin), min(W, box_px[2] + 3 * margin), min(H, box_px[3] + 3 * margin))
    if diff and (diff[0] < gx[0] or diff[1] < gx[1] or diff[2] > gx[2] or diff[3] > gx[3]):
        raise SystemExit("composite changed pixels outside the allowed region")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out.save(out_path, format="PNG", optimize=True)
    evidence = {
        "schema": "inscription-evidence-v1", "id": event_id, "ref": exc["ref"],
        "base_path": base_path, "base_sha256": sha256(base_path),
        "output_path": out_path, "output_sha256": sha256(out_path),
        "text_he_pointed": exc["text_he_pointed"], "text_he_consonants": exc["text_he_consonants"],
        "rendered_lines": lines, "rendered_codepoints": [[hex(ord(c)) for c in line] for line in lines],
        "glyphs_drawn": count, "font_family": spec["font_family"], "font_path": font_path, "font_sha256": sha256(font_path),
        "box_xyxy": list(box_px), "box_stddev": round(sd, 2), "changed_bbox_xyxy": list(diff) if diff else None,
    }
    with open(out_path[:-4] + ".inscription.json", "w", encoding="utf-8") as f:
        json.dump(evidence, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return evidence


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("id")
    ap.add_argument("--box", type=float, nargs=4)
    ap.add_argument("--out")
    ap.add_argument("--base")
    a = ap.parse_args()
    base = a.base or os.path.join(SQUARE, "live", f"{a.id}.png")
    out = a.out or os.path.join(SQUARE, "inscribed", f"{a.id}.png")
    print(json.dumps(inscribe(a.id, base, out, a.box), ensure_ascii=False)[:600])


if __name__ == "__main__":
    main()
