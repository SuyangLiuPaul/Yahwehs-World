#!/usr/bin/env python3
"""Low-quality image placeholders for the scene grid (reads images, changes none).

  python3 scripts/build-scene-lqip.py

For each scene in public/data/events.json this reads the thumbnail the grid
shows (assets-scenes/non-gamified-merged-thumbs-v3/<id>.jpg, the same files as
https://yahwehs-scenes.netlify.app/merged-thumbs/, with thumbs/ as a fallback),
averages its top half and its bottom half, and writes src/scene-lqip.json:

  { "v": 1, "c": { "<id>": "<8 chars>" } }

8 chars is base64url of 6 bytes, top RGB then bottom RGB. src/scenes-gallery.ts
paints a card's picture frame with the vertical gradient between them until the
real image has loaded, so a card is a colour-true blur of its picture instead of
a grey box. 1,443 entries are about 50 KB raw and 30 KB on the wire; Vite gives
the file a content hash (scenes-gallery imports it with ?url), so it is cached
until the next run changes it. events.json and the scene images are not touched.
"""
import base64, json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCENES = ROOT.parent / 'assets-scenes'
events = json.loads((ROOT / 'public/data/events.json').read_text())['events']

def source(i):
    for d in ('non-gamified-merged-thumbs-v3', 'thumbs'):
        p = SCENES / d / f'{i}.jpg'
        if p.exists():
            return p
    return None

out, missing = {}, []
for e in events:
    p = source(e['id'])
    if p is None:
        missing.append(e['id']); continue
    im = Image.open(p).convert('RGB').resize((1, 2), Image.BOX)   # BOX = true average of each half
    raw = bytes(im.getpixel((0, 0)) + im.getpixel((0, 1)))
    out[e['id']] = base64.urlsafe_b64encode(raw).decode().rstrip('=')

if missing:
    print(f'{len(missing)} scenes have no local thumbnail (no placeholder for them): {missing[:5]}...', file=sys.stderr)
(ROOT / 'src/scene-lqip.json').write_text(json.dumps({'v': 1, 'c': out}, separators=(',', ':')))
size = (ROOT / 'src/scene-lqip.json').stat().st_size
print(f'{len(out)} placeholders, {size} bytes -> src/scene-lqip.json')
