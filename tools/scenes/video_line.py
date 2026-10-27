#!/usr/bin/env python3
"""Video line of 雅伟之界 (最终方案 阶段 0 i + 阶段 4; 最终分工 2026-10-23 Prompt B).

    python3 tools/scenes/video_line.py strip --all            # videos-live -> videos-silent (stream copy, -an)
    python3 tools/scenes/video_line.py record --all           # write measured video fields into manifest.json
    python3 tools/scenes/video_line.py apply decisions.json   # write eventMatch / disposition fields
    python3 tools/scenes/video_line.py status                 # counts of the video fields in the manifest

Rules this tool enforces:
- Originals in videos-live/ are only read. The SHA of every original is checked before and after.
- Silent copies go to realistic-cinema-v1/videos-silent/<id>.mp4: the video stream copied bit for
  bit, no audio track, no re-encode.
- manifest.json is only written while holding locks/manifest.lock (same rules as chrome.lock:
  session + start time inside, stale after 30 minutes, removed right after). The manifest is
  re-read under the lock, only VIDEO_FIELDS may change (checked field by field before writing),
  and it is written atomically (temp file + rename) in its existing format (indent 2, UTF-8).
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gate_check  # noqa: E402  (dhash / frame grab: the same ruler the gate uses)

SCENES = "/Volumes/T7/yahwehs-globe-scenes"
REAL = os.path.join(SCENES, "realistic-cinema-v1")
MANIFEST = os.path.join(REAL, "manifest.json")
LOCK = os.path.join(SCENES, "locks", "manifest.lock")
LIVE = os.path.join(REAL, "videos-live")
SILENT = os.path.join(REAL, "videos-silent")
STRIP_LOG = os.path.join(SILENT, "_strip_log.jsonl")
SESSION = "antigravity-video-2026-10-24 (conv 8214dff2)"
LOCK_STALE_SECONDS = 30 * 60

# 最终分工: the video side may change only these (video*, eventMatch, videoDisposition,
# videoOrigin, durationSec), plus the fields Prompt B / handoff/28 §6 name for videos.
VIDEO_FIELDS = {
    "videoFile", "videoSha256", "videoOrigin", "durationSec", "videoStatus", "videoNote",
    "videoUpdatedAt", "videoEvidenceState", "videoDisposition", "videoFirstFrameDhash",
    "videoSourceSha256", "videoPolish", "videoMatchNote", "videoRedoNote",
    "videoAssessment", "videoReviewRequestedAt",
    "eventMatch", "hasEventAction", "lipSync", "audio", "firstFrameMatchesStill",
}
DISPOSITIONS = {"keep", "polish", "redo", "retire"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------ manifest lock

class ManifestLock:
    def __enter__(self):
        for attempt in range(60):
            if os.path.exists(LOCK):
                age = time.time() - os.stat(LOCK).st_mtime
                if age >= LOCK_STALE_SECONDS:
                    print(f"manifest.lock stale ({age:.0f}s), taking over: {open(LOCK).read().strip()!r}")
                    os.remove(LOCK)
                else:
                    if attempt == 0:
                        print(f"manifest.lock held: {open(LOCK).read().strip()!r}; waiting")
                    time.sleep(10)
                    continue
            try:
                fd = os.open(LOCK, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
            except FileExistsError:
                time.sleep(2)
                continue
            with os.fdopen(fd, "w") as f:
                f.write(f"session={SESSION}\nstarted={now_iso()}\n")
            return self
        raise SystemExit("could not get manifest.lock in 10 minutes; nothing written")

    def __exit__(self, *exc):
        for p in (LOCK, os.path.join(os.path.dirname(LOCK), "._manifest.lock")):
            try:
                os.remove(p)
            except FileNotFoundError:
                pass


def load_manifest():
    with open(MANIFEST, "rb") as f:
        raw = f.read()
    return json.loads(raw), raw


def dump_manifest(m):
    return json.dumps(m, ensure_ascii=False, indent=2).encode("utf-8")


def write_manifest_fields(updates, dry_run=False):
    """updates: {id: {field: value}}. Only VIDEO_FIELDS. Re-reads under the lock."""
    bad = {f for u in updates.values() for f in u} - VIDEO_FIELDS
    if bad:
        raise SystemExit(f"refusing: non-video fields {sorted(bad)}")
    with ManifestLock():
        m, raw = load_manifest()
        if dump_manifest(m) != raw:
            raise SystemExit("manifest format changed (not indent-2 UTF-8); stop and look before writing")
        before = json.loads(raw)
        rows = {r["id"]: r for r in m["events"]}
        missing = sorted(set(updates) - set(rows))
        if missing:
            raise SystemExit(f"ids not in manifest: {missing[:10]}")
        changed = 0
        for eid, fields in updates.items():
            row = rows[eid]
            for k, v in fields.items():
                if row.get(k, object()) != v:
                    row[k] = v
                    changed += 1
        # guard: nothing outside the video fields of the listed events moved
        assert {k: v for k, v in m.items() if k != "events"} == {k: v for k, v in before.items() if k != "events"}
        assert len(m["events"]) == len(before["events"])
        for new, old in zip(m["events"], before["events"]):
            assert new["id"] == old["id"]
            for k in set(new) | set(old):
                if new.get(k, "<absent>") != old.get(k, "<absent>"):
                    assert k in VIDEO_FIELDS and new["id"] in updates, (new["id"], k)
        if dry_run or not changed:
            return changed
        data = dump_manifest(m)
        fd, tmp = tempfile.mkstemp(prefix=".tmp-manifest-", suffix=".json", dir=REAL)
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, MANIFEST)
        with open(MANIFEST, "rb") as f:
            assert f.read() == data
        return changed


# ------------------------------------------------------------------ strip

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "format=duration:stream=index,codec_type,codec_name,width,height,nb_frames",
                          "-of", "json", path], capture_output=True, check=True, timeout=60).stdout
    d = json.loads(out)
    streams = d.get("streams", [])
    return {"duration": float(d["format"]["duration"]),
            "audio": sum(s["codec_type"] == "audio" for s in streams),
            "video": [s for s in streams if s["codec_type"] == "video"]}


def first_frame_dhash(video, event_id):
    still = os.path.join(REAL, "images-live", f"{event_id}.jpg")
    frame = gate_check.grab_frame(video, 0.0)
    if frame is None or not os.path.isfile(still):
        return None
    from PIL import Image
    with Image.open(still) as im:
        return gate_check.hamming(gate_check.dhash(frame), gate_check.dhash(im))


def strip_one(event_id):
    src = os.path.join(LIVE, f"{event_id}.mp4")
    dst = os.path.join(SILENT, f"{event_id}.mp4")
    src_sha = sha256(src)
    if not os.path.exists(dst):
        tmp = os.path.join(SILENT, f".tmp-{event_id}.mp4")
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-map", "0:v:0",
                        "-c:v", "copy", "-an", "-movflags", "+faststart", tmp],
                       check=True, capture_output=True, timeout=120)
        os.replace(tmp, dst)
    if sha256(src) != src_sha:
        raise RuntimeError(f"{event_id}: original changed during strip")
    p_src, p_dst = probe(src), probe(dst)
    if p_dst["audio"] != 0 or len(p_dst["video"]) != 1:
        raise RuntimeError(f"{event_id}: silent copy has audio or wrong streams")
    if p_src["video"][0].get("nb_frames") != p_dst["video"][0].get("nb_frames"):
        raise RuntimeError(f"{event_id}: frame count changed")
    return {"id": event_id, "source": f"videos-live/{event_id}.mp4", "sourceSha256": src_sha,
            "sourceAudioStreams": p_src["audio"], "file": f"videos-silent/{event_id}.mp4",
            "sha256": sha256(dst), "durationSec": round(p_dst["duration"], 3),
            "frames": int(p_dst["video"][0].get("nb_frames") or 0),
            "size": [p_dst["video"][0].get("width"), p_dst["video"][0].get("height")],
            "firstFrameDhash": first_frame_dhash(dst, event_id), "at": now_iso()}


def live_ids():
    return sorted(n[:-4] for n in os.listdir(LIVE) if n.endswith(".mp4") and not n.startswith("."))


def read_strip_log():
    rows = {}
    if os.path.exists(STRIP_LOG):
        for line in open(STRIP_LOG, encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                rows[r["id"]] = r
    return rows


def cmd_strip(ids):
    os.makedirs(SILENT, exist_ok=True)
    done = read_strip_log()
    todo = [i for i in ids if i not in done or not os.path.exists(os.path.join(SILENT, f"{i}.mp4"))]
    print(f"strip: {len(ids)} asked, {len(todo)} to do")
    errors = []
    with ThreadPoolExecutor(4) as pool, open(STRIP_LOG, "a", encoding="utf-8") as log:
        for eid, fut in [(i, pool.submit(strip_one, i)) for i in todo]:
            try:
                r = fut.result()
                log.write(json.dumps(r, ensure_ascii=False) + "\n")
                log.flush()
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{eid}: {exc}")
    for e in errors:
        print("ERROR", e)
    return 1 if errors else 0


def cmd_record(ids, dry_run):
    log = read_strip_log()
    updates = {}
    for eid in ids:
        r = log.get(eid)
        if not r:
            print(f"skip {eid}: not stripped")
            continue
        silent = os.path.join(REAL, r["file"])
        if sha256(silent) != r["sha256"]:
            raise SystemExit(f"{eid}: silent file changed since strip log")
        updates[eid] = {
            "videoFile": r["file"], "videoSha256": r["sha256"], "videoSourceSha256": r["sourceSha256"],
            "videoOrigin": "legacy-t2v", "durationSec": r["durationSec"], "audio": "none",
            "firstFrameMatchesStill": (r["firstFrameDhash"] is not None and r["firstFrameDhash"] <= gate_check.DHASH_MAX),
            "videoFirstFrameDhash": r["firstFrameDhash"],
        }
    m, _ = load_manifest()
    for row in m["events"]:
        if row["id"] in updates and "videoEvidenceState" not in row:
            updates[row["id"]]["videoEvidenceState"] = "missing"
    n = write_manifest_fields(updates, dry_run=dry_run)
    print(f"record: {len(updates)} events, {n} field changes{' (dry run)' if dry_run else ''}")


def from_rubric(d):
    """A worker decision (video-line/RUBRIC.md field names) -> manifest video fields."""
    if "disposition" not in d:
        return d  # already in manifest field names
    assessment = {k: d.get(k) for k in ("lipSyncSeconds", "hardErrors", "hardErrorNote", "mensHair",
                                        "blackBorder", "artifacts", "atmosphere") if k in d}
    out = {"eventMatch": d["eventMatch"], "hasEventAction": d["hasEventAction"], "lipSync": d["lipSync"],
           "videoDisposition": d["disposition"], "videoMatchNote": d.get("matchNote", ""),
           "videoPolish": d.get("polishPlan"), "videoRedoNote": d.get("redoReason", ""),
           "videoAssessment": assessment,
           # retired / redo clips are no longer live video for the event (the still carries it)
           "videoStatus": {"retire": "retired", "redo": "redo_pending"}.get(d["disposition"], "pass")}
    return out


def cmd_apply(path, dry_run):
    with open(path, encoding="utf-8") as f:
        decisions = {k: from_rubric(v) for k, v in json.load(f).items()}
    updates = {}
    for eid, d in decisions.items():
        if "videoDisposition" in d and d["videoDisposition"] not in DISPOSITIONS:
            raise SystemExit(f"{eid}: bad disposition {d['videoDisposition']}")
        updates[eid] = d
    n = write_manifest_fields(updates, dry_run=dry_run)
    print(f"apply: {len(updates)} events, {n} field changes{' (dry run)' if dry_run else ''}")


def detect_bars(path):
    """(top, bottom, left, right) black-bar pixels, max over frames 0 s and mid, via gate_check's ruler."""
    bands = []
    for t in (0.0, 2.0, 4.0, 6.0):
        frame = gate_check.grab_frame(path, t)
        if frame is not None:
            bands.append(gate_check.border_bands(frame))
    if not bands:
        return (0, 0, 0, 0)
    return tuple(max(b[i] for b in bands) for i in range(4))


POLISHED = os.path.join(REAL, "videos-polished")


def polish_one(row):
    """Cut / crop only, from the silent copy. Returns the manifest fields to write."""
    eid, plan = row["id"], row.get("videoPolish") or {}
    src = os.path.join(SILENT, f"{eid}.mp4")
    info = probe(src)
    t0 = float(plan.get("trimStart") or 0.0)
    t1 = float(plan.get("trimEnd") or info["duration"])
    t1 = min(t1, info["duration"])
    if t1 - t0 < 3.0:
        raise RuntimeError(f"{eid}: kept span {t1 - t0:.2f}s < 3s")
    w, h = info["video"][0]["width"], info["video"][0]["height"]
    vf = []
    top = bottom = left = right = 0
    if plan.get("cropBars", True):
        top, bottom, left, right = detect_bars(src)
        pad = 4  # cut a few more lines so no grey edge of the bar survives
        top, bottom = (top + pad if top else 0), (bottom + pad if bottom else 0)
        left, right = (left + pad if left else 0), (right + pad if right else 0)
    if top or bottom or left or right:
        cw, ch = w - left - right, h - top - bottom
        # keep 16:9: trim the other axis evenly
        if cw / ch > w / h:
            nw = int(ch * w / h) // 2 * 2
            left += (cw - nw) // 2
            cw = nw
        else:
            nh = int(cw * h / w) // 2 * 2
            top += (ch - nh) // 2
            ch = nh
        vf.append(f"crop={cw}:{ch}:{left}:{top},scale={w}:{h}:flags=lanczos")
    vf.append("format=yuv420p")
    os.makedirs(POLISHED, exist_ok=True)
    dst = os.path.join(POLISHED, f"{eid}.mp4")
    tmp = os.path.join(POLISHED, f".tmp-{eid}.mp4")
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-to", f"{t1:.3f}", "-i", src,
           "-vf", ",".join(vf), "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
           "-movflags", "+faststart", "-map_metadata", "-1", tmp]
    subprocess.run(cmd, check=True, capture_output=True, timeout=300)
    os.replace(tmp, dst)
    out = probe(dst)
    if out["audio"]:
        raise RuntimeError(f"{eid}: polished copy has audio")
    applied = {"source": f"videos-silent/{eid}.mp4", "sourceSha256": sha256(src), "trimStart": round(t0, 3),
               "trimEnd": round(t1, 3), "crop": vf[0] if len(vf) > 1 else None, "color": None,
               "plan": plan, "at": now_iso()}
    return {"videoFile": f"videos-polished/{eid}.mp4", "videoSha256": sha256(dst),
            "durationSec": round(out["duration"], 3), "videoFirstFrameDhash": first_frame_dhash(dst, eid),
            "videoPolish": {**plan, "applied": applied}}


def cmd_polish(ids, dry_run):
    m, _ = load_manifest()
    rows = {r["id"]: r for r in m["events"]}
    targets = [rows[i] for i in (ids or rows) if rows[i].get("videoDisposition") == "polish"
               and not (rows[i].get("videoPolish") or {}).get("applied")]
    print(f"polish: {len(targets)} to do")
    updates, errors = {}, []
    for row in targets:
        if dry_run:
            print("would polish", row["id"], row.get("videoPolish"))
            continue
        try:
            updates[row["id"]] = polish_one(row)
            print("polished", row["id"], updates[row["id"]]["durationSec"])
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{row['id']}: {exc}")
    if updates:
        write_manifest_fields(updates)
    for e in errors:
        print("ERROR", e)
    return 1 if errors else 0


QUEUE = os.path.join(SCENES, "review-queue")
GENERATOR = {"model": "google-flow-omni-1.1-flash (legacy text-to-video)",
             "session": "Yahweh Globe Video (Antigravity 99afec20, 2026-10-18)"}


def cmd_request(ids, dry_run):
    """Blind review requests (handoff/29 §2) for keep / polish clips whose current file has none."""
    m, _ = load_manifest()
    rows = {r["id"]: r for r in m["events"]}
    written, skipped = 0, []
    for eid in (ids or sorted(rows)):
        row = rows[eid]
        disp = row.get("videoDisposition")
        if disp not in ("keep", "polish") or row.get("eventMatch") != "yes":
            continue
        if disp == "polish" and not (row.get("videoPolish") or {}).get("applied"):
            skipped.append(f"{eid}: not polished yet")
            continue
        rel = f"{REALISTIC_REL}/{row['videoFile']}"
        path = os.path.join(SCENES, rel)
        sha = sha256(path)
        if sha != row.get("videoSha256"):
            skipped.append(f"{eid}: file SHA differs from manifest")
            continue
        if not os.path.isfile(os.path.join(SCENES, "fact-cards", f"{eid}.json")):
            skipped.append(f"{eid}: no fact card")
            continue
        review = os.path.join(REAL, "review", "video", f"{eid}.json")
        if os.path.exists(review):
            try:
                if json.load(open(review))["subject"]["sha256"] == sha:
                    continue  # already reviewed for this exact file
            except (ValueError, KeyError, OSError):
                pass
        req_path = os.path.join(QUEUE, f"video-{eid}.json")
        if os.path.exists(req_path):
            try:
                if json.load(open(req_path))["subject"]["sha256"] == sha:
                    continue
            except (ValueError, KeyError, OSError):
                pass
        req = {"schema": "review-request-v1", "id": eid, "kind": "video",
               "subject": {"path": rel, "sha256": sha}, "factCard": f"fact-cards/{eid}.json",
               "generator": GENERATOR, "requestedAt": now_iso()}
        if dry_run:
            print("would request", eid)
            written += 1
            continue
        tmp = os.path.join(QUEUE, f".tmp-video-{eid}.json")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(req, f, ensure_ascii=False, indent=1)
        os.replace(tmp, req_path)
        written += 1
    print(f"request: {written} written{' (dry run)' if dry_run else ''}, {len(skipped)} skipped")
    for s in skipped:
        print("  skip", s)


REALISTIC_REL = "realistic-cinema-v1"


def cmd_status():
    from collections import Counter
    m, _ = load_manifest()
    rows = [r for r in m["events"] if r.get("videoOrigin") or r.get("videoStatus") == "pass"]
    for k in ("videoStatus", "videoOrigin", "audio", "eventMatch", "videoDisposition", "hasEventAction",
              "lipSync", "firstFrameMatchesStill", "videoEvidenceState"):
        c = Counter(str(r.get(k)) if not str(r.get(k, "")).startswith("should-be:") else "should-be:*" for r in rows)
        print(f"{k:24} {dict(c.most_common())}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("strip", "record"):
        p = sub.add_parser(name)
        p.add_argument("ids", nargs="*")
        p.add_argument("--all", action="store_true")
        p.add_argument("--dry-run", action="store_true")
    p = sub.add_parser("apply")
    p.add_argument("file")
    p.add_argument("--dry-run", action="store_true")
    sub.add_parser("status")
    for name in ("polish", "request"):
        p = sub.add_parser(name)
        p.add_argument("ids", nargs="*")
        p.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "status":
        return cmd_status()
    if a.cmd == "apply":
        return cmd_apply(a.file, a.dry_run)
    if a.cmd == "polish":
        return cmd_polish(a.ids, a.dry_run)
    if a.cmd == "request":
        return cmd_request(a.ids, a.dry_run)
    if bool(a.ids) == bool(a.all):
        ap.error("give ids or --all")
    ids = live_ids() if a.all else a.ids
    if a.cmd == "strip":
        return cmd_strip(ids)
    return cmd_record(ids, a.dry_run)


if __name__ == "__main__":
    sys.exit(main())
