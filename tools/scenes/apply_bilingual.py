"""Add English passage references and concise topic summaries to approved no-UI images."""
import hashlib
import json
import os
import shutil
import tempfile
import glob
import sys
from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = "/Volumes/T7/yahwehs-globe-scenes"
IMAGES = f"{ROOT}/non-gamified-live-20261007"
STATUS = f"{ROOT}/non-gamified-status"
TRANSLATIONS = f"{ROOT}/non-gamified-translations/translations.jsonl"
BASE = f"{ROOT}/non-gamified-clean-20261007"

def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def load_translations():
    result = {}
    paths = [p for p in glob.glob(f"{os.path.dirname(TRANSLATIONS)}/*.jsonl")
             if not os.path.basename(p).startswith("._")]
    # Bulk range translations provide the base coverage. Specific image-agent
    # translations take precedence on intentional overlaps; root corrections
    # and the pilot file are applied last.
    paths.sort(key=lambda p: (0 if os.path.basename(p).startswith("translate") else
                              1 if os.path.basename(p).startswith("agent") else
                              3 if os.path.basename(p) == "root-gaps.jsonl" else 2,
                              os.path.basename(p)))
    for path in paths:
        with open(path) as f:
            for line in f:
                try:
                    row = json.loads(line)
                    if row.get("id") and row.get("ref_en") and row.get("summary_en"):
                        result[row["id"]] = row
                except (ValueError, TypeError):
                    continue
    return result

def font(path, size):
    return ImageFont.truetype(path, size)

def add_english(source, target, reference, summary, anchor=None):
    im = Image.open(source).convert("RGBA")
    scale = im.width / 1672
    x0 = round(40*scale)
    # Find the lower edge of the Chinese parchment card by tracking its cream
    # fill in the left card column. Card heights differ by event; a fixed y
    # coordinate can cover the last Chinese summary line.
    rgb = np.asarray(im.convert("RGB"), dtype=np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    card_bottom = None
    x_start, x_end = round(45*scale), min(round(400*scale), im.width)
    for y in range(round(110*scale), min(round(360*scale), im.height)):
        beige = (r[y, x_start:x_end] > 220) & (g[y, x_start:x_end] > 170) & \
                (b[y, x_start:x_end] > 110) & ((r[y, x_start:x_end]-g[y, x_start:x_end]) < 100) & \
                ((g[y, x_start:x_end]-b[y, x_start:x_end]) > 5) & \
                ((r[y, x_start:x_end]-b[y, x_start:x_end]) < 150)
        if beige.mean() > 0.65:
            card_bottom = y
    if card_bottom is None:
        card_bottom = round(222*scale)
    y0 = card_bottom + round(8*scale)
    panel_w = min(round(515*scale), im.width - x0 - round(24*scale))
    # Busy illustrations may put a key person or story detail immediately
    # below the Chinese card. Callers can place the English panel elsewhere
    # without changing its typography or the default layout used in other art.
    if anchor is not None:
        x0, y0 = (round(anchor[0]*scale), round(anchor[1]*scale))
        panel_w = min(round(anchor[2]*scale), im.width - x0 - round(24*scale))
    pad = round(16*scale)
    head_size, body_size = max(12, round(19*scale)), max(12, round(18*scale))
    head_path = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
    body_path = "/System/Library/Fonts/Supplemental/Georgia.ttf"
    head, body = font(head_path, head_size), font(body_path, body_size)
    draw = ImageDraw.Draw(im)
    max_width = panel_w - 2*pad
    words, lines, line = summary.split(), [], ""
    for word in words:
        candidate = (line + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=body)[2] <= max_width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    line_h = round(body_size * 1.28)
    panel_h = round(10*scale) + head_size + round(6*scale) + len(lines)*line_h + round(10*scale)
    x1, y1 = x0 + panel_w, y0 + panel_h
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0+round(3*scale), y0+round(4*scale),
        x1+round(3*scale), y1+round(4*scale)), radius=round(12*scale), fill=(55, 35, 10, 70))
    im = Image.alpha_composite(im, shadow)
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((x0, y0, x1, y1), radius=round(12*scale),
        fill=(250, 235, 199, 246), outline=(171, 127, 61, 255), width=max(1, round(2*scale)))
    ink = (73, 50, 25, 255)
    draw.text((x0+pad, y0+round(9*scale)), reference, font=head, fill=ink)
    text_y = y0 + round(10*scale) + head_size + round(4*scale)
    for line in lines:
        draw.text((x0+pad, text_y), line, font=body, fill=ink)
        text_y += line_h
    os.makedirs(os.path.dirname(target), exist_ok=True)
    im.convert("RGB").save(target, format="PNG", optimize=True)

def main():
    translations = load_translations()
    completed = 0
    for name in os.listdir(STATUS):
        if not name.endswith(".json") or name.startswith("._"):
            continue
        status_path = os.path.join(STATUS, name)
        try:
            with open(status_path) as f:
                marker = json.load(f)
        except (OSError, ValueError):
            continue
        image_id = marker.get("id")
        row = translations.get(image_id)
        image_path = f"{IMAGES}/{image_id}.png"
        refresh = "--refresh" in sys.argv
        if (marker.get("status") != "complete" or (marker.get("bilingual_status") == "complete" and not refresh)
                or not row or not os.path.exists(image_path)):
            continue
        os.makedirs(BASE, exist_ok=True)
        base_path = f"{BASE}/{image_id}.png"
        if not os.path.exists(base_path):
            actual = sha(image_path)
            if marker.get("derivative_sha256") != actual:
                raise RuntimeError(f"Refusing to overlay {image_id}: derivative checksum does not match its review marker")
            shutil.copy2(image_path, base_path)
        fd, temp_path = tempfile.mkstemp(suffix=".png", dir=os.path.dirname(image_path))
        os.close(fd)
        try:
            add_english(base_path, temp_path, row["ref_en"], row["summary_en"])
            os.replace(temp_path, image_path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        marker.update({"bilingual_status": "complete", "ref_en": row["ref_en"],
            "summary_en": row["summary_en"], "bilingual_sha256": sha(image_path)})
        with open(status_path, "w") as f:
            json.dump(marker, f, ensure_ascii=False, indent=2)
        completed += 1
    print(f"Added English cards to {completed} no-UI images")

if __name__ == "__main__":
    main()
