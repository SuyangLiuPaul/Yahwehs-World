#!/usr/bin/env python3
"""Clear stale three-strikes flags on squares that now pass the gate.

    python3 tools/scenes/clear_stale_three_strikes.py [--apply]

sync_reviews.py sets items[square:<id>].escalated at the 3rd failing sha and never clears it when a later
review passes, so escalatedIds over-counts. For every escalated square whose status is state=pass AND whose
gate_check.check_square passes today, this sets escalated=false (strike history kept, clearedAt/clearedReason
added), clears status.escalated_three_strikes, and recomputes escalatedIds. Squares that still fail, and all
non-square kinds, are left alone. Dry-run unless --apply; --apply backs up the escalation file first.
"""
import json, os, shutil, sys, time
from datetime import datetime, timezone

S = os.environ.get('SCENES_ROOT', '/Volumes/T7/yahwehs-globe-scenes')
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def passes_gate(id):
    sys.path.insert(0, os.path.join(REPO, 'tools', 'scenes'))
    import gate_check as gc
    ctx = gc.Context(S, gc.DEFAULT_EVENTS, gc.DEFAULT_BIBLE)
    return gc.check_square(ctx, id).passed


def clear(esc_doc, status_dir, gate_passes, now_iso):
    """Mutates esc_doc; returns (cleared_ids, kept_failing_ids, status_paths_to_write {path: doc})."""
    cleared, kept, writes = [], [], {}
    for key, rec in esc_doc.get('items', {}).items():
        if not rec.get('escalated') or rec.get('kind') != 'square': continue
        id = rec['id']
        p = f'{status_dir}/{id}.json'
        try: st = json.load(open(p, encoding='utf-8'))
        except Exception: kept.append(id); continue
        if st.get('state') == 'pass' and gate_passes(id):
            rec['escalated'] = False
            rec['clearedAt'] = now_iso
            rec['clearedReason'] = 'state=pass and gate_check passes on current sha; stale 3-strikes flag'
            if st.get('escalated_three_strikes'):
                st['escalated_three_strikes'] = False
                writes[p] = st
            cleared.append(id)
        else:
            kept.append(id)
    esc_doc['escalatedIds'] = sorted(k for k, v in esc_doc.get('items', {}).items() if v.get('escalated'))
    esc_doc['updatedAt'] = now_iso
    return cleared, kept, writes


def write_json(path, obj):
    tmp = f'{path}.tmp-{os.getpid()}'
    with open(tmp, 'w', encoding='utf-8') as f: json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def main():
    apply = '--apply' in sys.argv
    esc_path = f'{S}/escalations/three-strikes.json'
    doc = json.load(open(esc_path, encoding='utf-8'))
    before = len(doc.get('escalatedIds', []))
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    cleared, kept, writes = clear(doc, f'{S}/no-text-derivatives-v2/status', passes_gate, now)
    print(f"escalatedIds {before} -> {len(doc['escalatedIds'])}; cleared {len(cleared)}, kept {len(kept)}")
    print('cleared:', ' '.join(sorted(cleared)))
    if not apply: print('dry run (use --apply)'); return
    bak = f'{esc_path}.bak-{time.strftime("%Y%m%d-%H%M%S")}'
    shutil.copy2(esc_path, bak); print('backup:', bak)
    for p, st in writes.items(): write_json(p, st)
    write_json(esc_path, doc)

if __name__ == '__main__': main()
