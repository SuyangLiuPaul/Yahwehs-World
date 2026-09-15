"""QA-only contact sheets of unchanged browser captures, not art assets."""
from pathlib import Path
import os
from PIL import Image, ImageDraw
root=Path(os.environ.get('EVIDENCE_DIR',Path(__file__).resolve().parent.parent/'handoff/evidence/phase-2/after'))
for surface in ('desktop','phone','tablet'):
    paths=sorted(root.glob(f'{surface}-en-walk-*.png'))
    thumbw=360 if surface!='phone' else 230
    thumbh=round(thumbw*(900/1440 if surface=='desktop' else 812/375 if surface=='phone' else 1024/768))
    sheet=Image.new('RGB',(thumbw*5,(thumbh+26)*2),'#111a22')
    draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(paths):
        im=Image.open(path).convert('RGB');im.thumbnail((thumbw,thumbh))
        x=(i%5)*thumbw;y=(i//5)*(thumbh+26)
        sheet.paste(im,(x,y));draw.text((x+8,y+thumbh+4),f'{i+1:02d} / 10  {surface}',fill='white')
    sheet.save(root/f'{surface}-contact.jpg',quality=90)
