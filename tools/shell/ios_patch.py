#!/usr/bin/env python3
"""Idempotent patch of the generated Xcode project (src-tauri/gen/apple), re-applied after every `cargo tauri ios init`.

Adds the localised name under the icon (src-tauri/locales/{en,zh-Hans,zh-Hant,ru}.lproj/InfoPlist.strings, shared with the macOS
bundle) to the app target, then regenerates app.xcodeproj with xcodegen. It touches only files under the directory it is given.
The team id is never written here: export APPLE_DEVELOPMENT_TEAM=<10-character team id> before `cargo tauri ios init`.
"""
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
spec = root / "project.yml"
text = spec.read_text()
LINE = "      - path: ../../locales\n"
if LINE in text:
    print("   project.yml already lists the localised names")
else:
    anchor = "      - path: LaunchScreen.storyboard\n"
    assert anchor in text, "project.yml has no LaunchScreen.storyboard source to anchor on"
    spec.write_text(text.replace(anchor, anchor + LINE, 1))
    print("   project.yml: added ../../locales")
    subprocess.run(["xcodegen", "generate", "--spec", str(spec), "--project", str(root)], check=True)
