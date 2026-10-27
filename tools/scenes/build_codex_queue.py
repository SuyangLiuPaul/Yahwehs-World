"""Build assets-scenes/codex-queue.json: every event that still has no clean text-free plate.

    python3 tools/scenes/build_codex_queue.py

Sources (all in ../assets-scenes): the canonical all-events index plus any existing queue safety notes.
Legacy HUD composites never count as a finished image: every published image must have a plate.
"""
import json, os, glob
A = '/Users/pliu0036/Documents/CodingProject/assets-scenes/'
GL = ("Important: no Roman, medieval or plate armour (ancient bronze weapons only); no signs, labels, inscriptions, pseudo-writing, or glyph-like decoration anywhere in the scene; "
      "every face clean and normal; every man has short hair above the collar; every animal has exactly "
      "four legs; every person has exactly two legs and two feet.")
STYLE_REFS = (
    "Before generating, explicitly use and compare ALL THREE attached controlling references: "
    "(1) D4F32633-B285-4678-8F4E-BFE1AC2DE21B.PNG — Solomon's Temple; "
    "(2) FA93B816-233F-4112-8C78-AE8ED3698F0D.PNG — the Tabernacle; "
    "(3) 67CEF480-E4CF-4221-9B04-D4F6A4CBD777.PNG — Noah's Ark. "
    "Attach all three files to every image-generation task; do not substitute a text-only description. "
    "Use the references for VISUAL STYLE ONLY; never copy their particular buildings, animals, characters, "
    "or story motifs unless this event independently requires them. Hard visual gate: unmistakable Minecraft-like "
    "voxel/chamfered BLOCK construction across people, buildings, terrain, props and vegetation. Camera must be "
    "an elevated axonometric/isometric three-quarter view, pitched about 35 degrees downward from horizontal, "
    "with broad visible ground plane AND visible tops plus front/side faces of buildings; use orthographic or very "
    "weak perspective. Match the references' playable diorama framing, dense foreground/midground/background, "
    "warm golden daylight, painterly soft shadows, saturated handcrafted materials, and crisp readable small block "
    "figures. Keep the whole scene sharply in focus. Reject eye-level/horizon-dominant camera, close portrait framing, "
    "smooth rounded low-poly illustration, cinematic film-still lighting, bokeh, depth-of-field blur, or any style "
    "that could be mistaken for a film still."
)
VN = " Keep it non-graphic and dignified: no blood, no visible wounds, no gore; show the moment with restraint or its aftermath."
SN = " Keep it modest and family-friendly: nothing suggestive; show everyone fully clothed in a respectful, symbolic or aftermath scene."
VIOLENT = "杀死战争审判钉十字架流血击毁灭斩杀砍鞭打石头打死处决"
SEXUAL = "淫奸妓娼性裸"
TALL = " King Saul is a very tall man, a full head and shoulders taller than everyone else in the scene."

def tpl(r):
    id, zh, en, ref, sm = r[:5]
    p = (f'{STYLE_REFS} Create a CLEAN TEXT-FREE SCENE PLATE only, not a game screen; a deterministic compositor will add the event HUD and all exact text separately. '
         f'Bible event: "{en}" ({ref}); event identifier/title context: {zh}. Depict the actual event clearly and specifically, not a generic biblical village. '
         f'Use the summary only as story context: {sm} If the passage is a letter, law, psalm, prophecy or list, visualize its actual subject as a concrete scene without writing or charts. '
         f'Landscape 16:9, crisp Minecraft-like voxel/chamfered-block 3D diorama, elevated isometric three-quarter camera as defined above. Keep the primary biblical action '
         f'large enough to read at thumbnail size, in the central-right safe area; keep the upper-left title/card zone, upper-right counters zone, and lower-center button zone '
         f'visually quiet so the exact interface can be composited later. No text or UI at all: no signs, labels, inscriptions, pseudo-writing, glyph-like patterns, numbers, border, '
         f'logo, controls or watermark. References guide style only, never introduce their unrelated content. Rules: every man has '
         f'short hair; ancient Near-Eastern clothing, nothing modern; every person has exactly two legs and two feet. Jesus, if the event has him, '
         f'is shown with short hair cut above the ears and collar, gentle and majestic. God, if the event has him, is shown as a kind and majestic '
         f'figure in radiant light, or as light and cloud alone. Every animal has exactly four legs; each person exactly two arms, two legs, and two feet; all faces clean and normal.')
    return p + (' ' + r[6] if len(r) > 6 and r[6] else '')

rows = json.load(open(A + 'codex-queue-remaining.json'))
for f in ('queue-chunk2.txt', 'queue-chunk3.txt'):
    for line in open(A + f, encoding='utf-8'):
        if not line.strip(): continue
        id, zh, en, ref, sm = line.rstrip('\n').split('|')[:5]
        note = GL
        if any(c in zh for c in VIOLENT): note += VN
        if any(c in zh for c in SEXUAL): note += SN
        rows.append([id, zh, en, ref, sm, '', note])

# Existing hand-authored safety notes win; the canonical event inventory supplies
# every legacy event that predates the current clean-plate workflow.
source = {r[0]: r for r in rows}
events = json.load(open('data/events/all-events.json'))['events']

def fallback(e):
    note = GL
    if any(c in e['zh'] for c in VIOLENT): note += VN
    if any(c in e['zh'] for c in SEXUAL): note += SN
    return [e['id'], e['zh'], e['en'], e['refZh'], e['summaryZh'], '', note]

out = []
for e in events:
    r = source.get(e['id'], fallback(e))
    if os.path.exists(A + 'plates/' + r[0] + '.png'): continue
    out.append({'id': r[0], 'zh': r[1], 'en': r[2], 'refZh': r[3], 'summary': r[4], 'note': r[6] if len(r) > 6 else '', 'prompt': tpl(r), 'file': r[0] + '.png'})
json.dump(out, open(A + 'codex-queue.json', 'w'), ensure_ascii=False, indent=1)
print(len(out), 'rows ->', A + 'codex-queue.json')
