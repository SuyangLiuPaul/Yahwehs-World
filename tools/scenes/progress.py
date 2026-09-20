"""Write assets-scenes/progress.html: an interactive gallery of the event pictures (filter by status / book /
testament / search, sort by newest, bible order or year, full-size viewer with review notes and rejected versions).
    python3 tools/scenes/progress.py     (run from the repo root; open the file in a browser)"""
import json, os, re, time
from PIL import Image

A = "/Users/pliu0036/Documents/CodingProject/assets-scenes"
HERE = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open("data/events/all-events.json"))["events"]
raw, thumbs, rejdir = f"{A}/raw", f"{A}/thumbs", f"{A}/rejected"
os.makedirs(thumbs, exist_ok=True)

rev, rej_notes = {}, {}
if os.path.exists(f"{A}/review.jsonl"):
    for line in open(f"{A}/review.jsonl"):
        d = json.loads(line)
        rev[d["id"]] = d
        if not d.get("ok"):
            rej_notes.setdefault(d["id"], []).append(d.get("note", ""))
rejected = {}
if os.path.isdir(rejdir):
    for f in sorted(os.listdir(rejdir)):
        if f.endswith(".png"):
            rejected.setdefault(f.rsplit("-", 1)[0], []).append(f)

TW = 520
for e in ev:
    p = f"{raw}/{e['id']}.png"
    t = f"{thumbs}/{e['id']}.jpg"
    if os.path.exists(p) and (not os.path.exists(t) or Image.open(t).width < TW):
        im = Image.open(p).convert("RGB"); im.thumbnail((TW, TW)); im.save(t, quality=82)
    for f in rejected.get(e["id"], []):
        rt = f"{thumbs}/{f[:-4]}.jpg"
        if not os.path.exists(rt):
            im = Image.open(f"{rejdir}/{f}").convert("RGB"); im.thumbnail((240, 240)); im.save(rt, quality=75)

def bookname(ref):
    m = re.match(r"^(\d\s+)?\D+?(?=\s+\d)", ref)
    return m.group(0) if m else ref


books, out = {}, []
for i, e in enumerate(ev):
    p = f"{raw}/{e['id']}.png"
    have = os.path.exists(p)
    r = rev.get(e["id"], {})
    if have:
        st = "ok" if r.get("ok") else ("bad" if r.get("ok") is False else "new")
    else:
        st = "redo" if e["id"] in rejected else "todo"
    made = int(os.path.getmtime(p)) if have else 0
    b = books.setdefault(e["book"], {"b": e["book"],
        "zh": bookname(e["refZh"]), "en": bookname(e["ref"]),
        "n": 0, "made": 0, "ok": 0})
    b["n"] += 1; b["made"] += have; b["ok"] += st == "ok"
    out.append({"id": e["id"], "zh": e["zh"], "en": e["en"], "ref": e["ref"], "refZh": e["refZh"], "sum": e["summaryZh"],
                "b": e["book"], "y": e.get("yearEarly"), "i": i, "st": st, "made": made,
                "note": r.get("note", "") if st in ("ok", "bad") else "",
                "tries": len(rejected.get(e["id"], [])), "rej": [f"{f}" for f in rejected.get(e["id"], [])],
                "rejNotes": rej_notes.get(e["id"], [])})

data = json.dumps({"events": out, "books": list(books.values()), "now": int(time.time())}, ensure_ascii=False).replace("</", "<\\/")
html = open(f"{HERE}/progress_template.html").read().replace("__DATA__", data)
open(f"{A}/progress.html", "w").write(html)

made = sum(1 for o in out if o["st"] in ("ok", "new", "bad"))
ok = sum(1 for o in out if o["st"] == "ok")
print(f"{made}/{len(ev)} done, {ok} reviewed ok, {sum(len(v) for v in rejected.values())} rejected")
