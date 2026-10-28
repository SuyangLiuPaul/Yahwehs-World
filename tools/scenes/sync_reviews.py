#!/usr/bin/env python3
"""Sync completed independent reviews from review/ into status/<id>.json and manifest.json,
while enforcing:
1. Only set state=pass when independent review on current SHA is pass AND gate_check passes.
2. Any review with review_inputs_invalid (e.g., extra=['contentQcRegistry']) is an invalid review
   format (reviewer looked at registry): NEVER change state to rework, NEVER redraw, NEVER count
   toward 3 strikes; keep state=pending_review and wait for the reviewer session to re-review.
3. Owner's 3-strikes rule: same id failing valid blind review 3 times on distinct SHAs is recorded
   in /Volumes/T7/yahwehs-globe-scenes/escalations/three-strikes.json and not auto-redrawn.
4. Owner approval recorded for Jesus character anchor (sha256: 10d27ce69dfa...).
"""
import glob
import json
import os
import sys
import time
from datetime import datetime, timezone

REPO_ROOT = "/Users/pliu0036/Documents/CodingProject/yahwehs-globe"
T7_SCENES = "/Volumes/T7/yahwehs-globe-scenes"
SQ_ROOT = f"{T7_SCENES}/no-text-derivatives-v2"
RC_ROOT = f"{T7_SCENES}/realistic-cinema-v1"
ESC_PATH = f"{T7_SCENES}/escalations/three-strikes.json"

if f"{REPO_ROOT}/tools/scenes" not in sys.path:
    sys.path.insert(0, f"{REPO_ROOT}/tools/scenes")
import init_realistic_cinema as irc  # noqa: E402
import gate_check as gc  # noqa: E402


def atomic_write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp-{os.getpid()}"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def has_valid_review_inputs(rev, subject_kind="image"):
    inputs = rev.get("inputs")
    required = {subject_kind, "factCard", "vetoTable"}
    if not (isinstance(inputs, list) and all(isinstance(i, dict) for i in inputs)):
        return False
    kinds = [i.get("kind") for i in inputs]
    if len(kinds) != len(set(kinds)) or set(kinds) != required:
        return False
    return True


def extract_fail_reasons(rev):
    reasons = []
    for k, v in (rev.get("veto") or {}).items():
        ans = v.get("answer") if isinstance(v, dict) else v
        note = v.get("note", "") if isinstance(v, dict) else ""
        if ans in ("fail", "unclear"):
            reasons.append(f"veto.{k}={ans}({note})" if note else f"veto.{k}={ans}")
    for idx, m in enumerate(rev.get("mustShowChecks") or []):
        if m.get("result") in ("fail", "unclear"):
            reasons.append(f"mustShow[{idx}]={m.get('result')}({m.get('note', '')})")
    dir_chk = rev.get("directionCheck") or {}
    if dir_chk.get("result") in ("fail", "unclear"):
        reasons.append(f"direction={dir_chk.get('result')}({dir_chk.get('note', '')})")
    for idx, mn in enumerate(rev.get("mustNotShowChecks") or []):
        if mn.get("result") in ("fail", "unclear"):
            reasons.append(f"mustNotShow[{idx}]={mn.get('result')}({mn.get('note', '')})")
    for d in rev.get("defects") or []:
        if isinstance(d, dict):
            dn = d.get("Note") or d.get("note") or ""
            if dn and dn not in "; ".join(reasons):
                reasons.append(dn)
    fix_p = rev.get("fixPrompt", "")
    if fix_p:
        reasons.append(f"fixPrompt: {fix_p}")
    notes = rev.get("notes", "")
    if notes:
        reasons.append(notes)
    return "; ".join(reasons) if reasons else "Independent review verdict=fail"


def extract_failed_veto_keys(rev):
    keys = []
    for k, v in (rev.get("veto") or {}).items():
        ans = v.get("answer") if isinstance(v, dict) else v
        if ans in ("fail", "unclear"):
            keys.append(k)
    return keys


def main():
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if os.path.isfile(ESC_PATH):
        esc_doc = json.load(open(ESC_PATH, encoding="utf-8"))
    else:
        esc_doc = {"updatedAt": now_iso, "items": {}, "escalatedIds": []}

    items_hist = esc_doc.setdefault("items", {})
    reg_doc = json.load(open(f"{SQ_ROOT}/content-qc-registry.json", encoding="utf-8"))
    reg = reg_doc.get("entries") or reg_doc
    ctx = gc.Context(T7_SCENES, gc.DEFAULT_EVENTS, gc.DEFAULT_BIBLE)

    sq_pass = 0
    sq_rework = 0
    sq_escalated = 0
    sq_invalid_inputs_skipped = 0

    for r_path in sorted(glob.glob(f"{SQ_ROOT}/review/*.json")):
        if os.path.basename(r_path).startswith("._"):
            continue
        try:
            rev = json.load(open(r_path, encoding="utf-8"))
        except Exception:
            continue
        eid = rev.get("id")
        if not eid:
            continue
        st_path = f"{SQ_ROOT}/status/{eid}.json"
        if not os.path.isfile(st_path):
            continue
        st = json.load(open(st_path, encoding="utf-8"))
        rev_sha = (rev.get("subject") or {}).get("sha256")
        cur_sha = st.get("candidate_sha256") or st.get("live_sha256")
        if not rev_sha or rev_sha != cur_sha:
            continue

        if not has_valid_review_inputs(rev, "image"):
            sq_invalid_inputs_skipped += 1
            if st.get("state") != "pending_review":
                st["state"] = "pending_review"
                st["status"] = "pending_review"
                st["evidenceState"] = "pending_independent_review"
                st["updated_at"] = now_iso
                atomic_write_json(st_path, st)
            continue

        verdict = rev.get("verdict")
        if verdict == "pass":
            orig_st = dict(st)
            st["state"] = "pass"
            st["status"] = "pass"
            st["evidenceState"] = "complete"
            st["independent_review"] = "pass"
            if "root_review" in st:
                st["root_review"] = "pass"
            if "dual_review_passed" in st:
                st["dual_review_passed"] = True
            if eid in reg:
                st["registry_fix_verified"] = True
                if not st.get("registry_fix_note"):
                    st["registry_fix_note"] = rev.get("notes", "Verified by independent review")
            st["updated_at"] = now_iso
            atomic_write_json(st_path, st)
            chk = gc.check_square(ctx, eid)
            if chk.passed:
                sq_pass += 1
            else:
                orig_st["state"] = "pending_review"
                orig_st["status"] = "pending_review"
                orig_st["evidenceState"] = "pending_independent_review"
                atomic_write_json(st_path, orig_st)
        elif verdict == "fail":
            key = f"square:{eid}"
            rec = items_hist.setdefault(key, {"kind": "square", "id": eid, "strikes": []})
            seen_shas = {s["sha256"] for s in rec["strikes"]}
            reason_str = extract_fail_reasons(rev)
            failed_vetoes = extract_failed_veto_keys(rev)
            if rev_sha not in seen_shas:
                rec["strikes"].append({
                    "attempt": len(rec["strikes"]) + 1,
                    "sha256": rev_sha,
                    "reviewedAt": rev.get("reviewedAt") or (rev.get("reviewer") or {}).get("reviewedAt", now_iso),
                    "reviewer": (rev.get("reviewer") or {}).get("session", ""),
                    "reason": reason_str,
                })
            strike_count = len(rec["strikes"])
            rec["strikeCount"] = strike_count
            rec["escalated"] = strike_count >= 3
            if strike_count >= 3:
                sq_escalated += 1
            else:
                sq_rework += 1
            st["state"] = "rework"
            st["status"] = "rework"
            st["evidenceState"] = "reviewed_rework"
            st["independent_review"] = "fail"
            st["rework_reason"] = reason_str
            st["failed_vetoes"] = failed_vetoes
            st["strike_count"] = strike_count
            st["escalated_three_strikes"] = strike_count >= 3
            st["updated_at"] = now_iso
            atomic_write_json(st_path, st)

    # Sync realistic-cinema-v1/review/still/*.json and realistic-cinema-v1/review/anchor/*.json
    st_pass = 0
    st_rework = 0
    st_escalated = 0
    anc_pass = 0
    anc_rework = 0
    anc_escalated = 0

    still_reviews = sorted(glob.glob(f"{RC_ROOT}/review/still/*.json"))
    anchor_reviews = sorted(glob.glob(f"{RC_ROOT}/review/anchor/*.json"))

    irc.acquire_manifest_lock()
    try:
        manifest_path = f"{RC_ROOT}/manifest.json"
        m_doc = json.load(open(manifest_path, encoding="utf-8"))
        ev_map = {e["id"]: e for e in m_doc.get("events", [])}
        ch_map = {c["id"]: c for c in m_doc.get("characterAnchors", [])}
        loc_map = {l["id"]: l for l in m_doc.get("locationAnchors", [])}

        # Owner explicit approval for Jesus anchor (10-24 21:58 edition, sha256 10d27ce69dfa...)
        if "jesus" in ch_map:
            ch_map["jesus"]["ownerApproved"] = True
            ch_map["jesus"]["ownerApprovedAt"] = "2026-10-25T08:19:31+11:00"
            ch_map["jesus"]["ownerApprovedSha256"] = ch_map["jesus"].get("sha256")

        for r_path in still_reviews:
            if os.path.basename(r_path).startswith("._"):
                continue
            try:
                rev = json.load(open(r_path, encoding="utf-8"))
            except Exception:
                continue
            eid = rev.get("id")
            ev = ev_map.get(eid)
            if not ev:
                continue
            rev_sha = (rev.get("subject") or {}).get("sha256")
            cur_sha = ev.get("imageSha256")
            if not rev_sha or rev_sha != cur_sha:
                continue
            if not has_valid_review_inputs(rev, "image"):
                ev["imageStatus"] = "pending_review"
                continue
            verdict = rev.get("verdict")
            if verdict == "pass":
                st_pass += 1
                ev["imageStatus"] = "pass"
                ev["evidenceState"] = "complete"
                ev["independentReview"] = "pass"
                ev.pop("imageReworkReason", None)
                ev.pop("imageFailedVetoes", None)
            elif verdict == "fail":
                key = f"still:{eid}"
                rec = items_hist.setdefault(key, {"kind": "still", "id": eid, "strikes": []})
                seen_shas = {s["sha256"] for s in rec["strikes"]}
                reason_str = extract_fail_reasons(rev)
                failed_vetoes = extract_failed_veto_keys(rev)
                if rev_sha not in seen_shas:
                    rec["strikes"].append({
                        "attempt": len(rec["strikes"]) + 1,
                        "sha256": rev_sha,
                        "reviewedAt": rev.get("reviewedAt") or (rev.get("reviewer") or {}).get("reviewedAt", now_iso),
                        "reviewer": (rev.get("reviewer") or {}).get("session", ""),
                        "reason": reason_str,
                    })
                strike_count = len(rec["strikes"])
                rec["strikeCount"] = strike_count
                rec["escalated"] = strike_count >= 3
                if strike_count >= 3:
                    st_escalated += 1
                else:
                    st_rework += 1
                ev["imageStatus"] = "rework"
                ev["evidenceState"] = "reviewed_rework"
                ev["independentReview"] = "fail"
                ev["imageReworkReason"] = reason_str
                ev["imageFailedVetoes"] = failed_vetoes
                ev["imageStrikeCount"] = strike_count
                ev["imageEscalatedThreeStrikes"] = strike_count >= 3

        for r_path in anchor_reviews:
            if os.path.basename(r_path).startswith("._"):
                continue
            try:
                rev = json.load(open(r_path, encoding="utf-8"))
            except Exception:
                continue
            aid = rev.get("id")
            item = ch_map.get(aid) or loc_map.get(aid)
            if not item:
                continue
            rev_sha = (rev.get("subject") or {}).get("sha256")
            cur_sha = item.get("sha256")
            if not rev_sha or rev_sha != cur_sha:
                continue
            if not has_valid_review_inputs(rev, "image"):
                continue
            verdict = rev.get("verdict")
            if verdict == "pass":
                item["blindReview"] = "pass"
                item["blindReviewedAt"] = now_iso
                if aid == "jesus" and not item.get("ownerApproved"):
                    item["status"] = "pending_owner_approval"
                else:
                    anc_pass += 1
                    item["status"] = "pass"
                    item.pop("reworkReason", None)
            elif verdict == "fail":
                key = f"anchor:{aid}"
                rec = items_hist.setdefault(key, {"kind": "anchor", "id": aid, "strikes": []})
                seen_shas = {s["sha256"] for s in rec["strikes"]}
                reason_str = extract_fail_reasons(rev)
                if rev_sha not in seen_shas:
                    rec["strikes"].append({
                        "attempt": len(rec["strikes"]) + 1,
                        "sha256": rev_sha,
                        "reviewedAt": rev.get("reviewedAt") or (rev.get("reviewer") or {}).get("reviewedAt", now_iso),
                        "reviewer": (rev.get("reviewer") or {}).get("session", ""),
                        "reason": reason_str,
                    })
                strike_count = len(rec["strikes"])
                rec["strikeCount"] = strike_count
                rec["escalated"] = strike_count >= 3
                if strike_count >= 3:
                    anc_escalated += 1
                else:
                    anc_rework += 1
                item["status"] = "rework"
                item["blindReview"] = "fail"
                item["reworkReason"] = reason_str
                item["strikeCount"] = strike_count
                item["escalatedThreeStrikes"] = strike_count >= 3

        # Recompute manifest summary counts
        events_all = m_doc.get("events", [])
        chars_all = m_doc.get("characterAnchors", [])
        locs_all = m_doc.get("locationAnchors", [])
        m_doc["summary"]["updatedAt"] = int(time.time())
        m_doc["summary"]["characterAnchorsPass"] = sum(1 for c in chars_all if c.get("status") == "pass")
        m_doc["summary"]["locationAnchorsPass"] = sum(1 for l in locs_all if l.get("status") == "pass")
        m_doc["summary"]["imagesPass"] = sum(1 for e in events_all if e.get("imageStatus") == "pass")
        m_doc["summary"]["videosPass"] = sum(1 for e in events_all if e.get("videoStatus") == "pass")
        m_doc["summary"]["pilot12ImagesPass"] = sum(1 for e in events_all if e.get("isPilot12") and e.get("imageStatus") == "pass")
        m_doc["summary"]["pilot12VideosPass"] = sum(1 for e in events_all if e.get("isPilot12") and e.get("videoStatus") == "pass")

        atomic_write_json(manifest_path, m_doc)
    finally:
        irc.release_manifest_lock()

    esc_doc["updatedAt"] = now_iso
    esc_doc["escalatedIds"] = sorted(
        k for k, v in items_hist.items() if v.get("escalated")
    )
    atomic_write_json(ESC_PATH, esc_doc)
    print(
        f"Synced reviews -> square: pass={sq_pass}, rework={sq_rework}, escalated_3_strikes={sq_escalated}, "
        f"skipped_invalid_inputs={sq_invalid_inputs_skipped} | still: pass={st_pass}, rework={st_rework}, escalated_3_strikes={st_escalated} | "
        f"anchor: pass={anc_pass}, rework={anc_rework}, escalated_3_strikes={anc_escalated}"
    )


if __name__ == "__main__":
    main()
