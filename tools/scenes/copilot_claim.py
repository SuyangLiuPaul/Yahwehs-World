"""Claim the next square job for the Copilot line (takes from the END of the queue; Codex takes from the front).

    python3 tools/scenes/copilot_claim.py        # prints JSON {id, src, prompt}; moves the job to claimed-copilot/
Drive the browser yourself; when the PNG is in ~/Downloads/copilot-<id>.png run copilot_save.py <id>.
"""
import json, os, glob, sys
from PIL import Image
S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes'); J = f'{S}/codex-jobs'
SP = os.environ.get('COPILOT_TMP', '/tmp/copilot-src'); os.makedirs(SP, exist_ok=True)
jobs = sorted(glob.glob(f'{J}/square-*.json'), key=os.path.getmtime, reverse=True)
for f in jobs:
    if any(w in open(f, encoding='utf-8').read() for w in ('耶稣', '基督', 'Jesus', 'Christ')): continue   # Jesus scenes need the master reference; Codex/Gemini only
    c = f'{J}/claimed-copilot/' + os.path.basename(f); os.makedirs(os.path.dirname(c), exist_ok=True)
    try: os.rename(f, c)
    except OSError: continue
    j = json.load(open(c)); src = f"{SP}/{j['id']}.jpg"
    Image.open(j['refs'][0]).convert('RGB').save(src, quality=90)
    import re
    # ASCII only and short: Haiku copied the long Chinese prompts with small errors, so the web sites get an English prompt
    # built from the event id (the attached picture carries the scene) plus the reviewer's English fix notes, if any.
    m = re.match(r'^(.*?)-(\d+)-(\d+)$', j['id']); book = m.group(1).replace('-', ' ').title() if m else j['id']
    ref = f"{book} {m.group(2)}:{m.group(3)}" if m else j['id']
    fix = ''
    if '这次要改正：' in j['prompt']:
        fix = j['prompt'].split('这次要改正：', 1)[1].replace('\n', ' ')
        fix = re.sub(r'[^\x20-\x7e]', ' ', fix); fix = re.sub(r'\s+', ' ', fix).strip()
        if len(fix) > 700: fix = fix[:700].rsplit(' ', 1)[0].rstrip(' ,;:(') + ' ...'   # cut at a word, never mid-word
    prompt = ("The attached picture is a style and composition guide for the Bible scene " + ref + ". It may contain text cards or boxes: do NOT copy any text, cards, boxes or labels. "
              "Draw a NEW 16:9 image of the same scene in the same cute 3D voxel/block diorama style, camera, palette and lighting, with scenery continuing where any cards were. "
              "No text, letters, numbers or labels anywhere; keep only the small 3D voxel emblem icon in the top-left corner, with no box behind it. "
              "Every man has short natural scissor-cut hair well above the collar, varied from person to person (never shaved, buzz-cut or collar-length). God is never shown in human form. "
              "No Roman or medieval armour, no heraldic banners, no cloned identical people."
              + (" Fix these problems from the previous attempt: " + fix if fix else ""))
    prompt = re.sub(r'[^\x20-\x7e]', ' ', prompt)
    print(json.dumps({'id': j['id'], 'src': src, 'prompt': prompt}, ensure_ascii=True)); sys.exit(0)
print('{"id": null}')
