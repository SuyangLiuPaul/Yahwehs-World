#!/usr/bin/env python3
"""Copies the brand icons (src-tauri/icons/ios, src-tauri/icons/android) into the generated projects, so that
`cargo tauri ios init` / `android init` can never bring the Tauri default logo back.

  icons_patch.py ios     <gen/apple dir>    -> Assets.xcassets/AppIcon.appiconset/*.png, flattened to RGB (App Store rejects alpha)
  icons_patch.py android <gen/android dir>  -> app/src/main/res/mipmap-*/ic_launcher*.png

Source of truth: brand/lion-lamb-1024.png -> `cargo tauri icon brand/icon-build/manifest.json` (see scripts/verify-icons.mjs).
"""
import pathlib
import shutil
import sys

from PIL import Image

ICONS = pathlib.Path(__file__).resolve().parents[2] / "src-tauri" / "icons"


def ios(root: pathlib.Path) -> None:
    dest = root / "Assets.xcassets" / "AppIcon.appiconset"
    dest.mkdir(parents=True, exist_ok=True)
    n = 0
    for src in sorted((ICONS / "ios").glob("*.png")):
        Image.open(src).convert("RGB").save(dest / src.name)
        n += 1
    print(f"   AppIcon.appiconset: {n} brand icons (RGB, no alpha)")


def android(root: pathlib.Path) -> None:
    res = root / "app/src/main/res"
    n = 0
    for d in sorted((ICONS / "android").glob("mipmap-*")):
        if d.name == "mipmap-anydpi-v26":
            continue
        (res / d.name).mkdir(parents=True, exist_ok=True)
        for f in d.glob("ic_launcher*"):
            shutil.copy(f, res / d.name / f.name)
            n += 1
    print(f"   res/mipmap-*: {n} brand launcher images")


if __name__ == "__main__":
    {"ios": ios, "android": android}[sys.argv[1]](pathlib.Path(sys.argv[2]))
