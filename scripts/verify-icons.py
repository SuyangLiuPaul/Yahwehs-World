#!/usr/bin/env python3
"""App-icon checks, run by scripts/verify-shell.mjs. Prints `ok`/`FAIL` lines; exit 1 on any failure.

 - no icon anywhere (src-tauri/icons, gen/apple, gen/android) is the Tauri default logo (md5 of AppIcon-512@2x.png starts c8280089)
 - every iOS icon has no alpha channel (App Store rejects it), in src-tauri/icons/ios and in gen/apple
 - gen/apple AppIcon.appiconset is identical to src-tauri/icons/ios (pixels)
 - the iOS 1024 icon is the Lion & Lamb master (not the navy/gold cross, not the old globe)
 - gen/android launcher images equal src-tauri/icons/android
"""
import hashlib
import pathlib
import sys

from PIL import Image, ImageChops, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[1]
ICONS = ROOT / "src-tauri/icons"
APPLE = ROOT / "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset"
ANDROID = ROOT / "src-tauri/gen/android/app/src/main/res"
DEFAULT_PREFIX = "c8280089"
fails = 0


def check(ok, what, detail=""):
    global fails
    print(("ok    " if ok else "FAIL  ") + what + (f"\n        {detail}" if detail and not ok else ""))
    fails += 0 if ok else 1


def md5(p):
    return hashlib.md5(p.read_bytes()).hexdigest()


def same_pixels(a, b):
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    return ia.size == ib.size and ImageChops.difference(ia, ib).getbbox() is None


pngs = [p for d in (ICONS, APPLE, ANDROID) if d.exists() for p in d.rglob("*.png")]
bad = [str(p.relative_to(ROOT)) for p in pngs if md5(p).startswith(DEFAULT_PREFIX)]
check(not bad, f"no icon is the Tauri default logo ({len(pngs)} PNGs scanned)", ", ".join(bad))

ios = sorted((ICONS / "ios").glob("*.png"))
check(len(ios) >= 18, f"src-tauri/icons/ios has {len(ios)} icons")
alpha = [p.name for p in ios if Image.open(p).mode != "RGB"]
check(not alpha, "src-tauri/icons/ios: every icon is RGB with no alpha channel", ", ".join(alpha))

master = ROOT / "brand/lion-lamb-1024.png"
check(master.exists() and Image.open(master).mode == "RGB" and Image.open(master).size == (1024, 1024), "brand/lion-lamb-1024.png is an opaque 1024x1024 RGB master")
if (ICONS / "ios/AppIcon-512@2x.png").exists() and master.exists():
    a = Image.open(ICONS / "ios/AppIcon-512@2x.png").convert("RGB").resize((64, 64), Image.LANCZOS)
    b = Image.open(master).convert("RGB").resize((64, 64), Image.LANCZOS)
    d = sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
    check(d < 6, f"the iOS 1024 icon is the Lion & Lamb master (mean difference {d:.1f}/255)")

if APPLE.exists():
    gen = sorted(APPLE.glob("*.png"))
    check([p.name for p in gen] == [p.name for p in ios], "gen/apple AppIcon.appiconset lists the same files as src-tauri/icons/ios")
    check(all(Image.open(p).mode == "RGB" for p in gen), "gen/apple AppIcon.appiconset: no alpha channel in any icon")
    diff = [p.name for p in gen if not (ICONS / "ios" / p.name).exists() or not same_pixels(p, ICONS / "ios" / p.name)]
    check(not diff, "gen/apple AppIcon.appiconset equals src-tauri/icons/ios", ", ".join(diff))
else:
    print("skip  gen/apple not present (run cargo tauri ios init + tools/shell/ios_patch.py)")

if ANDROID.exists():
    diff = []
    for d in (ICONS / "android").glob("mipmap-*"):
        for f in d.glob("ic_launcher*.png"):
            g = ANDROID / d.name / f.name
            if not g.exists() or md5(g) != md5(f):
                diff.append(f"{d.name}/{f.name}")
    check(not diff, "gen/android launcher images equal src-tauri/icons/android", ", ".join(diff))
else:
    print("skip  gen/android not present")

sys.exit(1 if fails else 0)
