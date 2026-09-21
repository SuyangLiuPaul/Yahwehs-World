"""Write assets-scenes/progress.html: an interactive gallery of the event pictures (filter by status / book /
testament / search, sort by newest, bible order or year, full-size viewer with review notes and rejected versions).
    python3 tools/scenes/progress.py     (run from the repo root; open the file in a browser)"""
import json, os, re, shutil, sys, time
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
    if os.path.exists(p) and (not os.path.exists(t) or Image.open(t).width < TW or os.path.getmtime(t) < os.path.getmtime(p)):
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

SITE = "--site" in sys.argv
data = json.dumps({"events": out, "books": list(books.values()), "now": int(time.time()), "site": False}, ensure_ascii=False).replace("</", "<\\/")
html = open(f"{HERE}/progress_template.html").read().replace("__DATA__", data)
open(f"{A}/progress.html", "w").write(html)

made = sum(1 for o in out if o["st"] in ("ok", "new", "bad"))
ok = sum(1 for o in out if o["st"] == "ok")
print(f"{made}/{len(ev)} done, {ok} reviewed ok, {sum(len(v) for v in rejected.values())} rejected")


def icon(size, maskable=False):
    """A gold voxel cube on a dark brown tile."""
    from PIL import ImageDraw
    S = size * 4
    im = Image.new("RGB", (S, S), (59, 42, 23))
    d = ImageDraw.Draw(im)
    if not maskable:
        m = Image.new("L", (S, S), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, S - 1, S - 1), S // 5, fill=255)
        bg = Image.new("RGB", (S, S), (250, 246, 234)); bg.paste(im, mask=m); im = bg; d = ImageDraw.Draw(im)
    k = S * (0.26 if maskable else 0.32)
    cx, cy = S / 2, S / 2 + k * 0.05
    top = [(cx, cy - k), (cx + k * .87, cy - k / 2), (cx, cy), (cx - k * .87, cy - k / 2)]
    left = [(cx - k * .87, cy - k / 2), (cx, cy), (cx, cy + k), (cx - k * .87, cy + k / 2)]
    right = [(cx + k * .87, cy - k / 2), (cx + k * .87, cy + k / 2), (cx, cy + k), (cx, cy)]
    d.polygon(top, fill=(240, 205, 120)); d.polygon(left, fill=(200, 150, 62)); d.polygon(right, fill=(158, 108, 40))
    for poly in (top, left, right):
        d.line(poly + [poly[0]], fill=(59, 42, 23), width=max(2, S // 90), joint="curve")
    return im.resize((size, size), Image.LANCZOS)


if SITE:
    SD = f"{A}/site-project/site"
    for sub in ("thumbs", "full"):
        os.makedirs(f"{SD}/{sub}", exist_ok=True)
    want_full, want_thumbs = set(), set()
    for o in out:
        i = o["id"]
        if o["st"] in ("ok", "new", "bad"):
            src = f"{raw}/{i}.png"
            dst = f"{SD}/full/{i}.jpg"
            want_full.add(f"{i}.jpg")
            if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                Image.open(src).convert("RGB").save(dst, quality=80, optimize=True)
            want_thumbs.add(f"{i}.jpg")
        for f in o["rej"]:
            want_thumbs.add(f[:-4] + ".jpg")
    for name in want_thumbs:
        src, dst = f"{thumbs}/{name}", f"{SD}/thumbs/{name}"
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            shutil.copy2(src, dst)
    for sub, want in (("full", want_full), ("thumbs", want_thumbs)):
        for f in os.listdir(f"{SD}/{sub}"):
            if f.endswith(".jpg") and f not in want:
                os.remove(f"{SD}/{sub}/{f}")
    site_data = data.replace('"site": false', '"site": true', 1)
    open(f"{SD}/index.html", "w").write(open(f"{HERE}/progress_template.html").read().replace("__DATA__", site_data))
    for name, size, mask in (("icon-192.png", 192, False), ("icon-512.png", 512, False), ("icon-maskable.png", 512, True),
                             ("apple-touch-icon.png", 180, True), ("favicon.png", 64, False)):
        if not os.path.exists(f"{SD}/{name}"):
            icon(size, mask).save(f"{SD}/{name}")
    json.dump({"name": "事件图进度", "short_name": "事件图", "start_url": "/", "scope": "/", "display": "standalone",
               "background_color": "#faf6ea", "theme_color": "#faf6ea",
               "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                         {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
                         {"src": "icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]},
              open(f"{SD}/manifest.webmanifest", "w"), ensure_ascii=False)
    open(f"{SD}/sw.js", "w").write("self.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));\nself.addEventListener('fetch',e=>e.respondWith(fetch(e.request)));\n")
    print(f"site built: {len(want_full)} pictures in {SD}")
