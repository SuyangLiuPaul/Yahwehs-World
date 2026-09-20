"""Build the prompt queue for the event scene pictures (one picture per event).

    python3 tools/scenes/build_queue.py [--only id,id,...] [--out queue.json]

The pictures are made one at a time in ChatGPT's web app, in the style of the owner's
three reference screens (Noah's ark, the tabernacle, Solomon's temple). This file only
writes the prompts, from data/events/all-events.json, so a picture can be regenerated
from its event id alone. Owner's rules, 2026-09-21:
  - Jesus may be shown, with short hair; God may be shown, kind but majestic.
  - every event gets a scene, even a letter, a law or a genealogy (draw its content).
  - text goes in the picture (title, reference, one-line summary); wrong text is redone.
  - all men short-haired (1 Cor 11:14), ancient Near-Eastern dress, nothing modern.
"""
import json, re, sys

argv = sys.argv[1:]
only = argv[argv.index("--only") + 1].split(",") if "--only" in argv else None
out = argv[argv.index("--out") + 1] if "--out" in argv else "queue.json"
ev = json.load(open("data/events/all-events.json"))["events"]


def first_clause(s, n=34):
    s = re.split(r"[——。；]", s or "")[0].strip()
    return s[:n]


def prompt(e):
    return (
        "Make the next picture in the same style as the three reference pictures in this chat: an isometric "
        "three-quarter top-down Minecraft-like voxel / chamfered-block diorama game screen, warm golden light, "
        "painterly soft shading, dense lively detail, tiny blocky people and animals, rich props, 16:9 landscape. "
        f"Bible event: \"{e['en']}\" ({e['refZh']}). Chinese title: {e['zh']}. Summary: {e['summaryZh']} "
        "Illustrate this event faithfully as a concrete scene. If the passage is a letter, a law, a psalm, a "
        "prophecy or a list, draw what it is about as a real scene with people and objects. "
        "Keep the same screen layout as the references: title with a small icon at top-left (Chinese title large, "
        "English title smaller under it), a parchment card beneath it, resource counters and two round buttons at "
        "top-right, and a row of three wooden buttons at the bottom. "
        f"Text in the picture must be spelled exactly: title \"{e['zh']}\" and \"{e['en']}\"; the card shows "
        f"\"{e['refZh']}\" and the line \"{first_clause(e['summaryZh'])}\"; the counters show 320, 180, 240; the "
        "three bottom buttons read \"探索 Explore\", \"人物 People\", \"地图 Map\". No other text anywhere. "
        "Rules: every man has short hair; ancient Near-Eastern clothing, nothing modern. Jesus, if the event has him, "
        "is shown with short hair, gentle and majestic. God, if the event has him, is shown as a kind and majestic "
        "figure in radiant light, or as light and cloud alone."
    )


if "--compact" in argv:
    # what runner.js takes: [id, zh, en, refZh, one-line summary]
    def clause(x):
        return re.split(r"[，,——。；：]", x or "")[0].strip()[:22]
    rows = [[e["id"], e["zh"], e["en"], e["refZh"], clause(e["summaryZh"])] for e in ev if not only or e["id"] in only]
    json.dump(rows, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(len(rows), "compact rows ->", out)
    sys.exit(0)

rows = [{"id": e["id"], "zh": e["zh"], "en": e["en"], "prompt": prompt(e)} for e in ev if not only or e["id"] in only]
json.dump(rows, open(out, "w"), ensure_ascii=False)
print(len(rows), "prompts ->", out)
