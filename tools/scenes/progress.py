"""Write assets-scenes/progress.html: how many event pictures are done, reviewed, redone, left,
and a thumbnail grid in book order. Open the file in a browser.   python3 tools/scenes/progress.py"""
import json, os, html
from PIL import Image
A = "/Users/pliu0036/Documents/CodingProject/assets-scenes"
ev = json.load(open("data/events/all-events.json"))["events"]
raw, thumbs = f"{A}/raw", f"{A}/thumbs"
os.makedirs(thumbs, exist_ok=True)
rev = {}
if os.path.exists(f"{A}/review.jsonl"):
    for l in open(f"{A}/review.jsonl"):
        d = json.loads(l); rev[d["id"]] = d
rejected = {}
if os.path.isdir(f"{A}/rejected"):
    for f in os.listdir(f"{A}/rejected"):
        rejected[f.rsplit("-", 1)[0]] = rejected.get(f.rsplit("-", 1)[0], 0) + 1
done = [e for e in ev if os.path.exists(f"{raw}/{e['id']}.png")]
ok = [e for e in done if rev.get(e["id"], {}).get("ok")]
for e in done:
    t = f"{thumbs}/{e['id']}.jpg"
    if not os.path.exists(t):
        im = Image.open(f"{raw}/{e['id']}.png").convert("RGB"); im.thumbnail((360, 360)); im.save(t, quality=80)
books = {}
for e in ev:
    books.setdefault(e["book"], []).append(e)
cells = []
for b, es in books.items():
    n = sum(1 for e in es if os.path.exists(f"{raw}/{e['id']}.png"))
    cells.append(f"<h3>Book {b}: {n}/{len(es)}</h3><div class=g>")
    for e in es:
        i = e["id"]
        if os.path.exists(f"{raw}/{i}.png"):
            st = "ok" if rev.get(i, {}).get("ok") else "new"
            cells.append(f"<a class={st} href='raw/{i}.png' title='{html.escape(e['zh'])} / {html.escape(e['en'])}'><img loading=lazy src='thumbs/{i}.jpg'><span>{html.escape(e['zh'])}</span></a>")
        else:
            cells.append(f"<a class=todo title='{html.escape(e['zh'])}'><span>{html.escape(e['zh'])}</span></a>")
    cells.append("</div>")
pct = 100 * len(done) / len(ev)
open(f"{A}/progress.html", "w").write(f"""<!doctype html><meta charset=utf-8><title>Event pictures</title>
<style>body{{font:14px system-ui;margin:20px;background:#faf6ea;color:#3b3222}}.bar{{height:14px;background:#e3d9bd;border-radius:7px;overflow:hidden}}.bar i{{display:block;height:100%;background:#c8963e;width:{pct:.1f}%}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}}.g a{{position:relative;display:block;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:#e9e0c6;text-decoration:none;color:inherit}}
.g img{{width:100%;height:100%;object-fit:cover}}.g span{{position:absolute;left:0;right:0;bottom:0;padding:2px 5px;font-size:11px;background:rgba(255,250,235,.85)}}
.todo{{opacity:.45}}.new{{outline:2px solid #d9a13a}}.ok{{outline:2px solid #5f9a4a}}</style>
<h2>Event pictures: {len(done)} / {len(ev)} ({pct:.1f}%)</h2><div class=bar><i></i></div>
<p>reviewed OK: {len(ok)} &nbsp; waiting for review: {len(done) - len(ok)} &nbsp; rejected and redone or redoing: {sum(rejected.values())} &nbsp; left: {len(ev) - len(done)}</p>
<p>green = reviewed OK, gold = not reviewed yet, faded = not made yet. Click a picture for the full size.</p>{''.join(cells)}""")
print(f"{len(done)}/{len(ev)} done, {len(ok)} reviewed ok, {sum(rejected.values())} rejected")
