"""Build assets-scenes/screen-queue.json: every event whose latest review verdict is not ok:true, in book order,
as runner3 rows [id, zh, en, refZh, summary, suffix, note].

    python3 tools/scenes/build_screen_queue.py            # all rows
    python3 tools/scenes/build_screen_queue.py A 0 40     # print JSON rows for tab A, its rows 0..39
                                                          # (three tabs: A takes rows 0,3,6..; B 1,4,7..; C 2,5,8..; S = one tab, all rows)

This is the owner's full game-screen style (2026-09-23): ChatGPT draws the title, card, counters and buttons,
as in the three reference screens. (build_codex_queue.py is Codex's text-free plate route, not used now.)
"""
import json, sys, os

A = '/Users/pliu0036/Documents/CodingProject/assets-scenes/'
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

GL = ("Important: no Roman, medieval or plate armour, no plumed or crested helmets, no catapults, trebuchets or other medieval siege engines (ancient bronze weapons, "
      "wicker or wooden shields only); no fortune-teller props, crystal balls or occult symbols; no signs, labels, "
      "inscriptions or pseudo-writing anywhere in the scene; every face clean and normal; every man has short hair "
      "above the collar; Jesus' short hair must have visible natural texture and modest volume, never flat/buzzed "
      "or cap-like; keep his ears and nape substantially visible; every animal has exactly four legs; every person "
      "has exactly two legs and two feet.")
VN = " Keep it non-graphic and dignified: no blood, no visible wounds; show the moment with restraint or its aftermath."
SN = " Keep it modest and family-friendly: everyone fully clothed, a respectful, symbolic or aftermath scene."
VIOLENT = "杀死战争审判钉十字架流血击毁灭斩杀砍鞭打石头打死处决"
SEXUAL = "淫奸妓娼性裸"
TALL = " King Saul is a very tall man, a full head and shoulders taller than everyone else in the scene."

# Redo notes from reviews (the reason the last picture failed), so the next try avoids it.
EXTRA = {
    'exodus-15-1': "The crossing is over: the sea is calm and closed again; Moses and Israel stand safely on the far shore singing, and Miriam leads the women with timbrels.",
    'deuteronomy-18-15': "Every man, including those seen from behind, has short hair above the collar; no fortune-teller tent or occult objects.",
    'deuteronomy-30-11': "Every man, including small background figures, has short hair above the collar.",
    'deuteronomy-31-1': "Joshua, who is commissioned by Moses, has short hair above the collar.",
    'deuteronomy-32-1': "Joshua, standing beside Moses, has short hair above the collar.",
    '1-samuel-9-1': "Saul is a very tall young man, a full head and shoulders taller than everyone else (1 Samuel 9:2).",
    '1-samuel-10-1': "Samuel pours oil from a flask on Saul's head while Saul KNEELS before him; even kneeling Saul is big, and standing he would be a head and shoulders taller than everyone (1 Samuel 10:23).",
    '1-samuel-17-1': "Goliath wears a plain bronze helmet with no plume or crest, bronze scale armour, a bronze javelin and a large spear; David is a young shepherd with a sling.",
    'judges-13-1': "Samson is the one exception to the short-hair rule: a Nazirite with long hair in seven braids.",
    '2-samuel-5-6': "Jerusalem is a small hill fortress (the stronghold of Zion); there is no temple yet.",
    'mark-10-13': "Jesus has short, naturally textured, softly curling hair with modest volume; not a flat/buzzed cut. Keep both ears and the nape substantially visible.",
}

def rows():
    last = {}
    for l in open(A + 'review.jsonl'):
        if l.strip():
            r = json.loads(l); last[r['id']] = r
    out = []
    for e in json.load(open(os.path.join(REPO, 'data/events/all-events.json')))['events']:
        if last.get(e['id'], {}).get('ok'):
            continue
        note = GL
        if any(c in e['zh'] for c in VIOLENT): note += VN
        if any(c in e['zh'] for c in SEXUAL): note += SN
        b, ch = e['id'].rsplit('-', 2)[0], int(e['id'].rsplit('-', 2)[1])
        if (b == '1-samuel' and 9 <= ch <= 31) or e['id'] == '2-samuel-1-1':
            note += TALL
        if e['id'] in EXTRA:
            note += ' ' + EXTRA[e['id']]
        out.append([e['id'], e['zh'], e['en'], e['refZh'], e['summaryZh'], '', note])
    return out

if __name__ == '__main__':
    R = rows()
    if len(sys.argv) > 1:
        # tab slices come from the saved snapshot, so offsets stay stable while reviews change the live list
        tab, start, n = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
        snap = json.load(open(A + 'screen-queue.json'))
        # tab S = a single tab walking the snapshot in order (since 2026-09-23 18:00; the 3-tab run covered rows 0..35)
        mine = (snap if tab == 'S' else snap['ABC'.index(tab)::3])[start:start + n]
        # redo rows (written by apply_review.py) go first; up to 4 are taken off redo-queue.json per call
        rp = A + 'redo-queue.json'
        redo = json.load(open(rp)) if os.path.exists(rp) else []
        take, keep = redo[:4], redo[4:]
        json.dump(keep, open(rp, 'w'), ensure_ascii=False, indent=0)
        print(json.dumps(take + mine, ensure_ascii=False))
    else:
        json.dump(R, open(A + 'screen-queue.json', 'w'), ensure_ascii=False, indent=0)
        print(len(R), 'rows ->', A + 'screen-queue.json')
