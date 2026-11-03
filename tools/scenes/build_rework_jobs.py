"""Write a redraw job for every square in state=rework that has no active job (not queued, not claimed), except 3-strike items.

    python3 tools/scenes/build_rework_jobs.py [--dry-run] [--limit N] [--ids a,b,c [--include-escalated]]

--replace-unclaimed (only with --ids) overwrites the unclaimed job of those squares with the fresh prompt.
--ids restricts the run to those squares; --include-escalated (only with --ids) lets owner-approved 3-strike
squares through. Without --ids nothing changes: escalated squares are still skipped.

The job redraws the failing picture (live/<id>.png as the reference) with the reviewer's failure notes under 「这次要改正」,
the same shape as the first 371 rework jobs. Run after sync_reviews.py.
"""
import json, os, glob, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import square_exceptions as sx   # per-square exceptions (handoff/32)
S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes'); J = f'{S}/codex-jobs'; R = f'{S}/no-text-derivatives-v2'
dry = '--dry-run' in sys.argv
REPLACE = '--replace-unclaimed' in sys.argv   # with --ids: overwrite the same square's UNCLAIMED job (claimed ones are never touched)
limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
active = set()
for d in ('', 'claimed/', 'claimed-gemini/', 'claimed-drawargon/', 'claimed-antigravity/', 'claimed-copilot/', 'claimed-higgsfield/'):
    for f in glob.glob(f'{J}/{d}square-*.json'):
        if d == '' and REPLACE and os.path.basename(f)[7:-5] in (sys.argv[sys.argv.index('--ids') + 1].split(',') if '--ids' in sys.argv else ()): continue  # unclaimed job being replaced
        active.add(os.path.basename(f)[7:-5])
only = set(sys.argv[sys.argv.index('--ids') + 1].split(',')) if '--ids' in sys.argv else None
include_esc = only is not None and '--include-escalated' in sys.argv
esc = set()
try: esc = {i.split(':', 1)[-1] for i in json.load(open(f'{S}/escalations/three-strikes.json')).get('escalatedIds', [])}  # keys look like "square:<id>"
except Exception: pass
try: _reg = json.load(open(f'{R}/content-qc-registry.json')); REG = _reg.get('entries') or _reg
except Exception: REG = {}
import hashlib
def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()
def pending_candidate(id, st, R=R):
    """A drawn candidate that promote_candidates.py has not processed yet: a new job would draw it twice.
    Not pending: the live picture, the status's candidate_sha256, a rejected sha, or one already archived in archive-rework/."""
    for d in glob.glob(f'{R}/candidates-*/'):
        c = f'{d}{id}.png'
        if not os.path.isfile(c): continue
        try: rej = json.load(open(f'{d}promote-rejected.json'))
        except Exception: rej = {}
        h = sha(c)
        if h == st.get('live_sha256') or h == st.get('candidate_sha256') or rej.get(id) == h: continue
        if os.path.exists(f'{R}/archive-rework/{id}-{h[:12]}.png'): continue
        return True
    return False
ICON_KEEP = ("保留左上角那个小立体图标（和原图同一个图标，keep the exact small 3D voxel icon in the top-left corner from the reference image），"
             "画面任何地方都不能有文字（strictly NO text, letters, numbers, or inscriptions anywhere）.")
ICON_BLANK = ("保留左上角那个小立体图标的形状和配色（keep the small 3D voxel icon in the top-left corner, same shape and colours），"
              "但图标里的书页/卷轴必须是光滑空白的奶油色，不能有任何横线、笔画或类似文字的纹路（the book or scroll in that icon must have plain blank pages: NO rows of lines, strokes or writing-like marks）。"
              "画面任何地方都不能有文字（strictly NO text, letters, numbers, or inscriptions anywhere）.")
NOTEXT_EXTRA = (" Also no glyph-like carvings, gold marks, friezes, belts, shields, scroll or tablet surfaces with writing-like strokes: "
                "every such surface must be smooth, plain or purely geometric ornament.")
EMBLEM_WORDS = ('emblem', 'icon', 'top-left', 'top left', '徽', '图标', '左上')
def icon_sentence(st):
    """The reference icon is kept by default; when the failing fakeText note is about that icon, keep its shape but blank its pages."""
    reason = (st.get('rework_reason') or '').lower()
    if 'faketext' in reason and any(w in reason for w in EMBLEM_WORDS): return ICON_BLANK
    return ICON_KEEP
def exception_for(id):
    try: return sx.get(id)
    except (OSError, ValueError): return None
def reason_for(id, st):
    """The reviewer's failure note. For an exception square the notes about the vetoes the exception supersedes
    (they ask for writing-like strokes or letters) are dropped so the generator is never told to draw letters."""
    reason = st.get('rework_reason', '')
    exc = exception_for(id)
    if not exc: return reason
    drop = {f'veto.{k}'.lower() for k in exc.get('rework_drop_veto_notes', [])}
    parts = re.split(r';\s*(?=veto\.)', reason)
    kept = [p for p in parts if p.split('=', 1)[0].strip().lower() not in drop]
    return '; '.join(kept)
REDRAW_NOTES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'square_redraw_notes.json')
def redraw_note(id, path=REDRAW_NOTES_PATH):
    """A concrete, per-square correction written after looking at the picture (square_redraw_notes.json).
    It is added to the job after the reviewer's own note, never instead of it: repeating the reviewer's
    words is what produced the same fault three and four times over."""
    try:
        doc = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError):
        return ''
    if doc.get('schema') != 'square-redraw-notes-v1': return ''
    note = (doc.get('notes') or {}).get(id)
    return note.strip() if isinstance(note, str) and note.strip() else ''
def extra_for(id, st):
    out = ''
    if 'fakeText' in (st.get('failed_vetoes') or []) or 'veto.faketext' in (st.get('rework_reason') or '').lower():
        out += NOTEXT_EXTRA
    exc = exception_for(id)
    r = exc['registry_override'] if exc else REG.get(id)
    if r: out += f" Registry-required change (must be clearly, visibly made; removing text alone does not count): {r if isinstance(r, str) else json.dumps(r, ensure_ascii=False)}"
    return out
def main():
    n = 0; ids = []
    for f in sorted(glob.glob(f'{R}/status/*.json')):
        st = json.load(open(f)); id = st['id']
        if only is not None and id not in only: continue
        if st.get('state') != 'rework' or id in active: continue
        if (id in esc or st.get('escalated_three_strikes')) and not include_esc: continue
        live = f'{R}/live/{id}.png'
        if not os.path.isfile(live) or pending_candidate(id, st): continue
        try: fc = json.load(open(f'{S}/fact-cards/{id}.json'))
        except Exception: continue
        who = json.dumps(fc.get('mustShow', []), ensure_ascii=False)
        act = '；'.join(a['action'] for a in fc.get('keyAction', []))
        prompt = (f"Redraw this Bible scene as a cute 3D voxel diorama, keeping the attached image's style, composition idea and palette. "
                  f"Event: {fc['verses']['ref']}. What must be shown: {who}. Key action: {act}"
                  + (" No people in the scene." if fc.get('noPeople') else "") + extra_for(id, st) +
                  "\n" + icon_sentence(st) +
                  f"\n这次要改正：{reason_for(id, st)}"
                  + (f"\n具体怎么改（必须照做，其余保持不变）：{redraw_note(id)}" if redraw_note(id) else ""))
        job = {"schema": "codex-job-v1", "kind": "square", "id": id, "prompt": prompt, "refs": [live],
               "out": f"{R}/candidates-codex/{id}.png", "minWidth": 1536, "source": "build_rework_jobs.py"}
        if limit is not None and n >= limit: break
        n += 1; ids.append(id)
        if not dry:
            json.dump(job, open(f'{J}/.tmp-square-{id}.json', 'w'), ensure_ascii=False, indent=1); os.replace(f'{J}/.tmp-square-{id}.json', f'{J}/square-{id}.json')
    print(f"{'would write' if dry else 'wrote'} {n} rework jobs")
    if dry: print(' '.join(ids))

if __name__ == '__main__': main()
