#!/usr/bin/env python3
"""Worker for scripts/build-pictures.mjs: text-free square PNG -> site webp files.

Reads a JSON job list on stdin, writes webp files, prints a JSON result list on stdout.
Run it with -I (isolated mode); it needs Pillow with webp support and nothing else.

  job    {"id", "src", "thumb", "full"}               convert a gate-passed square
         {"id", "placeholder": true, "thumb", "full"}  write the brand-gradient plate
  result {"id", "w", "h", "lqip", "fullSha", "thumbBytes", "fullBytes"}

Sizes: thumb 480 px wide (the grid), full 1344 px wide (hero, picture page, full screen).
A source narrower than that is not enlarged. The picture is never cropped and no text is
drawn on it: every word on the site is HTML.
"""
import base64
import hashlib
import json
import os
import sys
from multiprocessing import Pool

from PIL import Image, ImageDraw

THUMB_W, FULL_W = 480, 1344
# One rule for both sizes: WebP quality 76, encoder method 6. The full size was 78 until 2026-11-03; 76 keeps
# dist under the plan's 300 MB cap (-6.9 % of the full files, mean SSIM 0.9523 vs 0.9561 on 40 random squares).
# Measurement and the sweep script: docs/evidence/gallery-2026-11/pictures-quality-sweep.md, scripts/pictures-quality-sweep.py.
THUMB_Q, FULL_Q = 76, 76


def save(im, path, width, quality):
    w = min(width, im.width)
    h = round(im.height * w / im.width)
    r = im.resize((w, h), Image.LANCZOS) if w != im.width else im
    tmp = path + ".tmp"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    r.save(tmp, "WEBP", quality=quality, method=6)
    os.replace(tmp, path)
    return os.path.getsize(path)


def lqip(im):
    """Base64url of the average colour of the top half then the bottom half (6 bytes, 8 chars)."""
    two = im.convert("RGB").resize((1, 2), Image.BOX)
    raw = bytes([*two.getpixel((0, 0)), *two.getpixel((0, 1))])
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def placeholder():
    """Navy ground, a soft glow, a thin frame. No text, no figure."""
    w, h = FULL_W, 756
    base = Image.new("RGB", (w, h), (14, 43, 75))
    glow = Image.new("RGB", (w, h), (70, 86, 108))
    mask = Image.radial_gradient("L").resize((w, h), Image.BICUBIC).point(lambda v: max(0, 150 - v))
    im = Image.composite(glow, base, mask.point(lambda v: v // 2))
    ImageDraw.Draw(im).rectangle([24, 24, w - 25, h - 25], outline=(36, 71, 110), width=2)
    return im


def work(job):
    try:
        if job.get("placeholder"):
            im = placeholder()
        else:
            im = Image.open(job["src"])
            im.load()
            im = im.convert("RGB")
        tb = save(im, job["thumb"], THUMB_W, THUMB_Q)
        fb = save(im, job["full"], FULL_W, FULL_Q)
        with open(job["full"], "rb") as f:
            sha = hashlib.sha256(f.read()).hexdigest()
        return {"id": job["id"], "w": im.width, "h": im.height, "lqip": lqip(im),
                "fullSha": sha, "thumbBytes": tb, "fullBytes": fb}
    except Exception as e:  # reported per picture; the caller decides what a failure means
        return {"id": job["id"], "error": f"{type(e).__name__}: {e}"}


if __name__ == "__main__":
    jobs = json.load(sys.stdin)
    if not jobs:
        print("[]")
        sys.exit(0)
    with Pool(min(8, os.cpu_count() or 2)) as pool:
        out = pool.map(work, jobs, chunksize=4)
    json.dump(out, sys.stdout)
