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

# Externals/ holds libapp.a (linked through the dependency below); as a plain source it was also copied into the bundle as a
# resource, and App Store Connect rejects the upload (90171, "libapp.a binary file is not permitted"). Keep it out of the resources.
text = spec.read_text()
EXT = "      - path: Externals\n"
EXT_FIXED = EXT + "        buildPhase: none\n"
if EXT_FIXED in text:
    print("   project.yml already keeps Externals out of the resources")
else:
    assert EXT in text, "project.yml has no Externals source"
    spec.write_text(text.replace(EXT, EXT_FIXED, 1))
    print("   project.yml: Externals is not a resource")
    subprocess.run(["xcodegen", "generate", "--spec", str(spec), "--project", str(root)], check=True)
