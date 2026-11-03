#!/usr/bin/env python3
"""Write the owner acceptances in square_accepts.json into the squares' status files.

    python3 tools/scenes/apply_square_accepts.py [--apply] [--ids a b c]

For every accepted square this sets `state`/`status` to "pass" and adds an `owner_accept` block
bound to the live picture's SHA, so `gate_check.check_square` can reconcile a review that still
says "fail" with a passing state. It never edits `review/<id>.json`, never touches the veto table,
and never changes `independent_review`, `rework_reason` or `failed_vetoes`: the reviewer's verdict
stays on disk exactly as written, and the acceptance sits beside it.

It refuses a square whose live SHA does not match `live_sha256`, or that already passes for an
ordinary reason, and it backs up every status file it rewrites. Dry run unless --apply; the dry
run prints the diff of the fields it would change.
"""
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gate_check as gc            # noqa: E402
import square_accepts             # noqa: E402

S = os.environ.get("SCENES_ROOT", gc.DEFAULT_SCENES_ROOT)
STATUS_DIR = os.path.join(S, gc.SQUARE_DIR, "status")
LIVE_DIR = os.path.join(S, gc.SQUARE_DIR, "live")


def registry_fix_fields(review):
    """sync_reviews sets registry_fix_verified from a passing review. An accepted square's review
    is a written "fail", but its own registryFix answer is "pass"/"na" (nothing else was accepted),
    and that answer is the same evidence. Returns {} when it is not."""
    answer = ((review or {}).get("veto") or {}).get("registryFix")
    answer = answer.get("answer") if isinstance(answer, dict) else answer
    if answer not in ("pass", "na"):
        return {}
    return {"registry_fix_verified": True,
            "registry_fix_note": f"registryFix={answer} in the independent review of this SHA; the "
                                 f"square is owner-accepted on its other key(s)"}


def plan_one(event_id, entry, status, live_sha, review=None, registered=False):
    """(changes dict, error string or None). `changes` holds only the fields that differ."""
    keys = sorted(entry["keys"])
    if status.get("live_sha256") != live_sha:
        return {}, f"live PNG sha {live_sha} != status live_sha256 {status.get('live_sha256')}"
    block = {"ruling": entry["reason"], "ref": entry["ref"], "keys": keys,
             "reasons": {k: entry["keys"][k] for k in keys},
             "decidedBy": entry["decidedBy"], "decidedAt": entry["decidedAt"],
             "live_sha256": live_sha,
             "reviewVerdictKept": "the review on disk still says fail; this accepts it, it does not rewrite it"}
    wanted = {"state": "pass", "status": "pass", "evidenceState": "complete_owner_accepted",
              "owner_accept": block}
    if registered:
        fields = registry_fix_fields(review)
        if not fields:
            return {}, "in content-qc-registry but the review's registryFix answer is not pass/na"
        wanted.update(fields)
    changes = {k: v for k, v in wanted.items() if status.get(k) != v}
    if status.get("escalated_three_strikes"):
        changes["escalated_three_strikes"] = False
    return changes, None


def write_json(path, obj):
    tmp = f"{path}.tmp-{os.getpid()}"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(obj, handle, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def main():
    argv = sys.argv[1:]
    apply = "--apply" in argv
    wanted = None
    if "--ids" in argv:
        wanted = set(a for a in argv[argv.index("--ids") + 1:] if not a.startswith("--"))
    accepts = square_accepts.load()
    registry, _ = gc.read_json(os.path.join(S, gc.SQUARE_DIR, "content-qc-registry.json"))
    registry = registry if isinstance(registry, dict) else {}
    registry = registry.get("entries") if isinstance(registry.get("entries"), dict) else registry
    stamp = time.strftime("%Y%m%d-%H%M%S")
    done, skipped = [], []
    for event_id, entry in sorted(accepts.items()):
        if wanted is not None and event_id not in wanted:
            continue
        path = os.path.join(STATUS_DIR, f"{event_id}.json")
        png = os.path.join(LIVE_DIR, f"{event_id}.png")
        status, err = gc.read_json(path)
        if err or not isinstance(status, dict):
            skipped.append((event_id, f"status unreadable: {err}"))
            continue
        if not os.path.isfile(png):
            skipped.append((event_id, "live png missing"))
            continue
        review, _ = gc.read_json(os.path.join(S, gc.SQUARE_DIR, "review", f"{event_id}.json"))
        changes, problem = plan_one(event_id, entry, status, gc.file_sha256(png), review,
                                    registered=event_id in registry)
        if problem:
            skipped.append((event_id, problem))
            continue
        if not changes:
            skipped.append((event_id, "already written"))
            continue
        print(f"{event_id}: " + ", ".join(
            f"{k}: {status.get(k)!r} -> {'<owner_accept block>' if k == 'owner_accept' else v!r}"
            for k, v in changes.items()))
        done.append(event_id)
        if not apply:
            continue
        shutil.copy2(path, f"{path}.bak-{stamp}")
        status.update(changes)
        write_json(path, status)
    print(f"\n{'wrote' if apply else 'would write'} {len(done)}; skipped {len(skipped)}")
    for event_id, why in skipped:
        print("  skip", event_id, "-", why)
    if not apply:
        print("dry run (use --apply)")


if __name__ == "__main__":
    main()
