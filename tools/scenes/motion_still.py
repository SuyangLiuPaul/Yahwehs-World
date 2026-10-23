#!/usr/bin/env python3
"""Slow push-in clips made from PASSED realistic stills (owner approved 2026-10-23).

    python3 tools/scenes/motion_still.py render genesis-1-1 exodus-14-21
    python3 tools/scenes/motion_still.py render --all            # every still the gate passes
    python3 tools/scenes/motion_still.py render --all --dry-run  # list what would be made
    python3 tools/scenes/motion_still.py verify --all --summary

This is not AI video: ffmpeg zooms slowly into the still itself, so it costs no Flow credits,
the first frame is the whole still, and nothing new is drawn. Rules:
- render only asks for stills that tools/scenes/gate_check.py passes right now, and checks
  that the bytes on disk still have the SHA-256 the gate measured. A still that fails the gate
  gets no clip; if a clip already exists for it, verify reports it as source_not_pass.
- Output goes to realistic-cinema-v1/motion-live/<id>.mp4 plus a <id>.json sidecar. The tool
  never touches manifest.json, videos-live/, images-live/ or any other file.
- No audio track, H.264 yuv420p, 1280x720, 24 fps, 8 s. Every move starts from the full frame
  and pushes in at most 8%; the target point (centre, left third, right third, upper centre) is
  picked from a hash of the event id, so a re-run gives the same clip.
- render is idempotent: an existing clip whose sidecar matches the same source SHA and the
  same parameters is skipped. --force re-renders.
Exit code 0 means everything rendered or verified, 1 means at least one failure, 2 a usage error.
"""
import argparse
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(HERE, "gate_check.py")
DEFAULT_SCENES_ROOT = "/Volumes/T7/yahwehs-globe-scenes"
REALISTIC_DIR = "realistic-cinema-v1"
OUT_DIR = "motion-live"

SCHEMA = "motion-still-v1"
VERSION = "1"
SIZE = (1280, 720)
FPS = 24
SECONDS = 8.0
MAX_ZOOM = 1.08
# Where the push-in ends, as a fraction of the free space left/top. Every move starts at zoom 1.
TARGETS = {
    "center": (0.5, 0.5),
    "left-third": (0.2, 0.45),
    "right-third": (0.8, 0.45),
    "upper-center": (0.5, 0.3),
}
DURATION_TOLERANCE = 0.1
DHASH_MAX = 20          # of 256 bits, the same threshold gate_check.py uses for videos


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pick_target(event_id):
    names = sorted(TARGETS)
    return names[int(hashlib.sha256(event_id.encode()).hexdigest(), 16) % len(names)]


def params_for(event_id, size=SIZE, seconds=SECONDS):
    return {"version": VERSION, "size": list(size), "fps": FPS, "seconds": seconds,
            "maxZoom": MAX_ZOOM, "target": pick_target(event_id), "easing": "cosine"}


def filter_graph(params):
    w, h = params["size"]
    frames = int(round(params["seconds"] * params["fps"]))
    fx, fy = TARGETS[params["target"]]
    last = max(frames - 1, 1)
    # Upscale 4x before zoompan so the sub-pixel crop does not jitter, then fit to 16:9.
    zoom = f"1+{params['maxZoom'] - 1:.4f}*(1-cos(PI*on/{last}))/2"
    return (f"scale={w * 4}:{h * 4}:force_original_aspect_ratio=increase:flags=lanczos,"
            f"crop={w * 4}:{h * 4},"
            f"zoompan=z='{zoom}':x='(iw-iw/zoom)*{fx}':y='(ih-ih/zoom)*{fy}'"
            f":d={frames}:s={w}x{h}:fps={params['fps']},"
            f"format=yuv420p")


def render_clip(still, out_path, params):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(suffix=".mp4", dir=os.path.dirname(out_path), prefix=".tmp-")
    os.close(fd)
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", still, "-vf", filter_graph(params), "-an",
           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart",
           "-map_metadata", "-1", tmp]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        os.replace(tmp, out_path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def probe(path):
    cmd = ["ffprobe", "-v", "error", "-show_entries",
           "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", path]
    data = json.loads(subprocess.run(cmd, check=True, capture_output=True).stdout)
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    return {"duration": float(data.get("format", {}).get("duration", 0)),
            "audioStreams": sum(s.get("codec_type") == "audio" for s in streams),
            "codec": video.get("codec_name"), "width": video.get("width"), "height": video.get("height"),
            "fps": video.get("r_frame_rate")}


def first_frame(path):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "-"]
    return Image.open(io.BytesIO(subprocess.run(cmd, check=True, capture_output=True).stdout))


def dhash(image, size=16):
    gray = image.convert("L").resize((size + 1, size), Image.LANCZOS)
    px = list(gray.tobytes())
    bits = 0
    for row in range(size):
        for col in range(size):
            left, right = px[row * (size + 1) + col], px[row * (size + 1) + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return bits


def fit_16x9(image, size):
    """The still as the clip's first frame shows it: scaled to cover, centre-cropped."""
    w, h = size
    scale = max(w / image.width, h / image.height)
    resized = image.convert("RGB").resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left, top = (resized.width - w) // 2, (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def gate_stills(scenes_root, ids):
    """{id: gate item} from gate_check.py still --json. ids=None means --all."""
    cmd = [sys.executable, GATE, "still", "--json", "--scenes-root", scenes_root]
    cmd += ["--all"] if ids is None else list(ids)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode not in (0, 1):
        raise SystemExit(f"gate_check.py failed ({proc.returncode}): {proc.stderr.strip()}")
    return {item["id"]: item for item in json.loads(proc.stdout)["items"]}


class Paths:
    def __init__(self, scenes_root):
        self.realistic = os.path.join(scenes_root, REALISTIC_DIR)
        self.out = os.path.join(self.realistic, OUT_DIR)

    def still(self, event_id):
        return os.path.join(self.realistic, "images-live", f"{event_id}.jpg")

    def clip(self, event_id):
        return os.path.join(self.out, f"{event_id}.mp4")

    def sidecar(self, event_id):
        return os.path.join(self.out, f"{event_id}.json")


def read_sidecar(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write_json_atomic(path, obj):
    fd, tmp = tempfile.mkstemp(suffix=".json", dir=os.path.dirname(path), prefix=".tmp-")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def render(paths, gate, size=SIZE, seconds=SECONDS, force=False, dry_run=False, log=print):
    """gate: {id: gate item}. Returns {id: outcome}."""
    outcomes = {}
    for event_id, item in gate.items():
        if not item.get("pass"):
            outcomes[event_id] = "skipped_still_not_pass"
            continue
        still = paths.still(event_id)
        measured = item.get("measured", {}).get("sha256")
        if not measured or not os.path.exists(still) or sha256_file(still) != measured:
            outcomes[event_id] = "failed_still_changed_since_gate"
            continue
        params = params_for(event_id, size, seconds)
        old = read_sidecar(paths.sidecar(event_id))
        if (not force and old and old.get("sourceSha256") == measured and old.get("params") == params
                and os.path.exists(paths.clip(event_id))
                and sha256_file(paths.clip(event_id)) == old.get("outputSha256")):
            outcomes[event_id] = "unchanged"
            continue
        if dry_run:
            outcomes[event_id] = "would_render"
            continue
        render_clip(still, paths.clip(event_id), params)
        info = probe(paths.clip(event_id))
        write_json_atomic(paths.sidecar(event_id), {
            "schema": SCHEMA, "id": event_id, "params": params,
            "sourceStill": os.path.relpath(still, paths.realistic), "sourceSha256": measured,
            "output": os.path.relpath(paths.clip(event_id), paths.realistic),
            "outputSha256": sha256_file(paths.clip(event_id)),
            "durationSec": round(info["duration"], 3), "audio": "none",
            "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        })
        outcomes[event_id] = "rendered"
        log(f"rendered {event_id} ({params['target']})")
    return outcomes


def verify_one(paths, event_id, gate_item):
    reasons = []
    side = read_sidecar(paths.sidecar(event_id))
    clip = paths.clip(event_id)
    if side is None or side.get("schema") != SCHEMA:
        return ["sidecar_missing"]
    if not os.path.exists(clip):
        return ["clip_missing"]
    if sha256_file(clip) != side.get("outputSha256"):
        reasons.append("clip_sha_mismatch")
    if gate_item is None or not gate_item.get("pass"):
        reasons.append("source_not_pass")
    elif gate_item.get("measured", {}).get("sha256") != side.get("sourceSha256"):
        reasons.append("source_sha_changed")
    params = side.get("params") or {}
    info = probe(clip)
    if info["audioStreams"]:
        reasons.append("has_audio")
    if info["codec"] != "h264":
        reasons.append(f"codec_{info['codec']}")
    if [info["width"], info["height"]] != params.get("size"):
        reasons.append("size_mismatch")
    if abs(info["duration"] - float(params.get("seconds", 0))) > DURATION_TOLERANCE:
        reasons.append("duration_mismatch")
    still = paths.still(event_id)
    if os.path.exists(still) and params.get("size"):
        distance = bin(dhash(first_frame(clip)) ^ dhash(fit_16x9(Image.open(still), params["size"]))).count("1")
        if distance > DHASH_MAX:
            reasons.append(f"first_frame_differs({distance})")
    return reasons


def verify(paths, gate, ids):
    return {event_id: verify_one(paths, event_id, gate.get(event_id)) for event_id in ids}


def clip_ids(paths):
    if not os.path.isdir(paths.out):
        return []
    return sorted(name[:-5] for name in os.listdir(paths.out)
                  if name.endswith(".json") and not name.startswith("."))


def main(argv=None):
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("ids", nargs="*")
    common.add_argument("--all", action="store_true")
    common.add_argument("--scenes-root", default=DEFAULT_SCENES_ROOT)
    common.add_argument("--json", action="store_true")
    common.add_argument("--summary", action="store_true", help="counts only")
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("render", parents=[common])
    r.add_argument("--force", action="store_true")
    r.add_argument("--dry-run", action="store_true")
    sub.add_parser("verify", parents=[common])
    args = parser.parse_args(argv)
    if bool(args.ids) == bool(args.all):
        parser.error("give event ids or --all (not both)")
    paths = Paths(args.scenes_root)

    if args.cmd == "render":
        gate = gate_stills(args.scenes_root, None if args.all else args.ids)
        outcomes = render(paths, gate, force=args.force, dry_run=args.dry_run,
                          log=(lambda *_: None) if args.json or args.summary else print)
        counts = Counter(outcomes.values())
        bad = counts.get("failed_still_changed_since_gate", 0)
        if args.json:
            json.dump({"counts": dict(counts), "outcomes": None if args.summary else outcomes},
                      sys.stdout, ensure_ascii=False, indent=1)
            sys.stdout.write("\n")
        else:
            for name, count in counts.most_common():
                print(f"  {name:<34}{count:>6}")
        return 1 if bad else 0

    ids = clip_ids(paths) if args.all else args.ids
    gate = gate_stills(args.scenes_root, ids) if ids else {}
    results = verify(paths, gate, ids)
    failed = {k: v for k, v in results.items() if v}
    if args.json:
        json.dump({"checked": len(results), "pass": len(results) - len(failed),
                   "fail": len(failed), "failures": failed}, sys.stdout, ensure_ascii=False, indent=1)
        sys.stdout.write("\n")
    else:
        if not args.summary:
            for event_id, reasons in results.items():
                print(("PASS " + event_id) if not reasons else f"FAIL {event_id}: {', '.join(reasons)}")
        reasons = Counter(code.split("(")[0] for v in failed.values() for code in v)
        print(f"motion_still verify: {len(results)} checked, {len(results) - len(failed)} PASS, {len(failed)} FAIL")
        for code, count in reasons.most_common():
            print(f"  {code:<28}{count:>6}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
