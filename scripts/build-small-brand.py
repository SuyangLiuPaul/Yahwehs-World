#!/usr/bin/env python3
"""Small, fast stand-ins for the three heavy brand images (originals untouched).

  python3 scripts/build-small-brand.py

public/icon.svg, public/loading-globe.svg and public/logo.png each carry (or
are) a 512 px PNG of the emblem: about 218 KB on the wire apiece, three times
per page view, to draw a 34 px nav mark, a 180 px loading mark and a 16 px tab
icon. This writes new files at the size they are shown (twice over for dense
screens), as WebP:

  public/brand-logo.webp        96 px   nav mark (shown at 34 css px)
  public/loading-globe-sm.svg   384 px  same SVG and halo, emblem re-embedded
  public/icon-sm.svg            128 px  tab icon

scripts/build-shell.mjs points the pages at them. The originals stay for
anything that still names them (the app stores, the video page).
"""
import base64, io, re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / 'public'

def embedded(path):
    s = path.read_text()
    m = re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)', s)
    return s, m, Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')

def webp(img, size, q):
    b = io.BytesIO()
    img.resize((size, size), Image.LANCZOS).save(b, 'WEBP', quality=q, method=6)
    return b.getvalue()

for src, dst, size, q in (('loading-globe.svg', 'loading-globe-sm.svg', 384, 82), ('icon.svg', 'icon-sm.svg', 128, 85)):
    s, m, img = embedded(PUB / src)
    w = webp(img, size, q)
    (PUB / dst).write_text(s.replace(m.group(0), 'data:image/webp;base64,' + base64.b64encode(w).decode()))
    print(f'{dst}: {len(w)} B image, {(PUB / dst).stat().st_size} B file')

logo = Image.open(PUB / 'logo.png').convert('RGBA')
w = webp(logo, 96, 85)
(PUB / 'brand-logo.webp').write_bytes(w)
print(f'brand-logo.webp: {len(w)} B')
