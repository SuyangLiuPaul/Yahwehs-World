"""Contact sheet for review: per picture, the title/card corner at full detail and the whole picture small.

    python3 tools/scenes/sheet.py out.png id1 id2 ... [--dir raw_dir]
"""
import sys, os
from PIL import Image, ImageDraw
a = sys.argv[1:]
out = a[0]
d = a[a.index("--dir") + 1] if "--dir" in a else "/Users/pliu0036/Documents/CodingProject/assets-scenes/raw"
ids = [x for x in a[1:] if x != "--dir" and x != d]
W = 1500
tiles = []
for i in ids:
    im = Image.open(os.path.join(d, i + ".png")).convert("RGB")
    w, h = im.size
    crop = im.crop((0, 0, int(w * .34), int(h * .30))).resize((560, int(560 * (h * .30) / (w * .34))))
    whole = im.resize((640, int(640 * h / w)))
    t = Image.new("RGB", (W, max(crop.height, whole.height) + 26), "white")
    t.paste(crop, (0, 26)); t.paste(whole, (580, 26))
    ImageDraw.Draw(t).text((6, 6), i, fill="black")
    tiles.append(t)
sheet = Image.new("RGB", (W, sum(t.height for t in tiles)), "white")
y = 0
for t in tiles:
    sheet.paste(t, (0, y)); y += t.height
sheet.save(out)
