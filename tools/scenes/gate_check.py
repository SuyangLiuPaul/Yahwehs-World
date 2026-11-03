#!/usr/bin/env python3
"""Read-only PASS gate for the 雅伟之界 image and video lines (最终方案 §1.5, handoff/28).

    python3 tools/scenes/gate_check.py square genesis-9-18 exodus-33-1
    python3 tools/scenes/gate_check.py still --all --summary
    python3 tools/scenes/gate_check.py video --all --json > /tmp/video-gate.json
    python3 tools/scenes/gate_check.py veto-table        # the table reviewers receive

An item passes only when its state, its review, its evidence and the bytes on disk agree.
The script never calls a model or the network and never writes a file: it opens JSON and
media read-only, and ffmpeg/ffprobe frames are piped to memory, not to disk. Exit code 0
means every checked item passed, 1 means at least one failed, 2 means a usage error.
Field names, paths and the review/fact-card schemas are defined in handoff/28-gate-schema.md.
"""
import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import sys
from collections import Counter

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import square_accepts  # noqa: E402  per-square owner acceptances (handoff/opus-74-decisions-2026-11-03)
import square_exceptions  # noqa: E402  per-square exceptions (handoff/32)

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_SCENES_ROOT = "/Volumes/T7/yahwehs-globe-scenes"
DEFAULT_EVENTS = os.path.join(REPO, "data", "events", "all-events.json")
DEFAULT_BIBLE = os.path.join(REPO, "public", "data", "bible", "bsb-yhwh.json")

SQUARE_DIR = "no-text-derivatives-v2"
REALISTIC_DIR = "realistic-cinema-v1"
FACT_CARD_DIR = "fact-cards"

REVIEW_SCHEMA = "gate-review-v1"
FACT_CARD_SCHEMA = "fact-card-v1"
SECTION_SOURCES = ("depicts", "provisional")
DHASH_MAX = 20                   # of 256 bits (16x16 dHash)
TIER_SECONDS = {"S": 8.0}        # every other tier: DEFAULT_TIER_SECONDS
DEFAULT_TIER_SECONDS = 6.0
DURATION_TOLERANCE = 0.5
# Existing text-to-video clips (owner 2026-10-23: no new videos, improve the 651). They were never
# made from the still, so the first-frame rule is reported, not enforced; instead the clip must be
# checked against its event (they were mapped by grid position) and kept or polished, not retired.
LEGACY_ORIGIN = "legacy-t2v"
LEGACY_SECONDS = (3.0, 8.5)
LEGACY_DISPOSITIONS = ("keep", "polish")
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# 最终方案 §1.5. A reviewer answers every key with "pass" (no violation seen, including
# "the subject is absent"), "fail" or "unclear". Only registryFix may be "na", and only
# where the registry does not apply (see registry_applies). Changing this table changes
# VETO_TABLE_SHA256, which invalidates every review written against the old table.
VETO_TABLE = {
    "version": "veto-v1-2026-10-23",
    "answers": ["pass", "fail", "unclear", "na"],
    "items": [
        {"key": "jesusHair", "zh": "耶稣的发型",
         "rule": "Jesus as the project depicts him: natural scissor-cut short hair above the collar; "
                 "never shaved, buzz-cut, faded, shaved at the sides, or long."},
        {"key": "mensHair", "zh": "男子发型",
         "rule": "Men: short, natural scissor-cut hair above the collar, varied from person to person; "
                 "never shaved, buzz-cut, faded or with shaved sides (Nazirites excepted)."},
        {"key": "godDepiction", "zh": "神的形象",
         "rule": "God is never drawn in human form (no white-bearded elder, no giant face); "
                 "light, cloud and fire only."},
        {"key": "trinityComposition", "zh": "三一构图",
         "rule": "No Trinity composition: no three identical symmetrical figures, no triangular "
                 "arrangement or human form in the sky at the baptism, transfiguration or Pentecost."},
        {"key": "anachronism", "zh": "时代错误",
         "rule": "No Roman or medieval armour in Old Testament scenes, no heraldic banners, brass "
                 "trumpets, Greek temples, Roman arched bridges or American cacti."},
        {"key": "headCount", "zh": "人数",
         "rule": "Every count in the fact card's mustShow is exactly what the picture shows."},
        {"key": "modesty", "zh": "端庄",
         "rule": "No nudity, exposed thighs or spraying gore."},
        {"key": "fakeText", "zh": "假文字",
         "rule": "No letters, pseudo-writing or text-like strokes anywhere, including on tablets and scrolls."},
        {"key": "duplicatedPerson", "zh": "同一人物重复出现",
         "rule": "The same person does not appear twice in one frame."},
        {"key": "registryFix", "zh": "registry 登记要求的修改有没有做到",
         "rule": "If the event is in content-qc-registry.json, the change it demands is visibly made "
                 "(removing text alone does not count)."},
    ],
}
VETO_KEYS = tuple(item["key"] for item in VETO_TABLE["items"])


def canonical_sha256(obj):
    data = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


VETO_TABLE_SHA256 = canonical_sha256(VETO_TABLE)


# ---------------------------------------------------------------- small read-only helpers

def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_json(path):
    """(object, None) or (None, error string). Never raises for a bad file."""
    try:
        with open(path, "rb") as handle:
            return json.loads(handle.read().decode("utf-8")), None
    except FileNotFoundError:
        return None, "missing"
    except (OSError, UnicodeDecodeError, ValueError) as exc:
        return None, f"unreadable: {exc.__class__.__name__}"


def nonempty_str(value):
    return isinstance(value, str) and value.strip() != ""


def is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def split_ref(code):
    return code // 1_000_000, (code // 1000) % 1000, code % 1000


class Item:
    def __init__(self, kind, event_id):
        self.kind, self.id = kind, event_id
        self.state = None
        self.reasons, self.warnings, self.measured = [], [], {}
        self.evidence_state = None

    def fail(self, code, detail=None):
        self.reasons.append({"code": code, "detail": detail} if detail is not None else {"code": code})

    @property
    def passed(self):
        return not self.reasons

    def as_dict(self):
        return {"id": self.id, "kind": self.kind, "state": self.state, "pass": self.passed,
                "reasons": self.reasons, "warnings": self.warnings,
                "evidenceState": self.evidence_state, "measured": self.measured}


# ---------------------------------------------------------------- context (all inputs, loaded once)

class Context:
    def __init__(self, scenes_root, events_path, bible_path):
        self.root = scenes_root
        self.square_root = os.path.join(scenes_root, SQUARE_DIR)
        self.realistic_root = os.path.join(scenes_root, REALISTIC_DIR)
        self.fact_card_root = os.path.join(scenes_root, FACT_CARD_DIR)
        events, err = read_json(events_path)
        if err:
            raise SystemExit(f"gate_check: cannot read events file {events_path}: {err}")
        rows = events["events"] if isinstance(events, dict) else events
        self.event_order = [row["id"] for row in rows]
        self.events = {row["id"]: row for row in rows}
        bible, err = read_json(bible_path)
        if err:
            raise SystemExit(f"gate_check: cannot read bible file {bible_path}: {err}")
        self.books = bible["books"]
        self._registry = self._manifest = None
        self._still_cache = {}
        self.exceptions_path = square_exceptions.EXCEPTIONS_PATH
        try:
            self.exception_ids = set(square_exceptions.load(self.exceptions_path))
        except (OSError, ValueError):
            self.exception_ids = set()
        self.accepts_path = square_accepts.ACCEPTS_PATH

    @property
    def registry(self):
        if self._registry is None:
            data, err = read_json(os.path.join(self.square_root, "content-qc-registry.json"))
            self._registry = data if isinstance(data, dict) else {}
        return self._registry

    @property
    def manifest_events(self):
        if self._manifest is None:
            data, err = read_json(os.path.join(self.realistic_root, "manifest.json"))
            if err or not isinstance(data, dict):
                raise SystemExit(f"gate_check: cannot read realistic manifest: {err or 'not an object'}")
            self._manifest = {row.get("id"): row for row in data.get("events", [])}
        return self._manifest

    def verse_exists(self, code):
        if not is_int(code):
            return False
        book, chapter, verse = split_ref(code)
        if not (1 <= book <= len(self.books)):
            return False
        chapters = self.books[book - 1]
        return 1 <= chapter <= len(chapters) and 1 <= verse <= len(chapters[chapter - 1])

    def event_range(self, event_id):
        row = self.events[event_id]
        return row["start"], row["end"]


# ---------------------------------------------------------------- shared evidence checks

def check_fact_card(ctx, item):
    """Validate fact-cards/<id>.json; return its byte SHA-256 (or None if absent)."""
    path = os.path.join(ctx.fact_card_root, f"{item.id}.json")
    if not os.path.isfile(path):
        item.fail("factcard_missing")
        return None
    card_sha = file_sha256(path)
    card, err = read_json(path)
    if err or not isinstance(card, dict):
        item.fail("factcard_invalid", err or "not an object")
        return card_sha
    problems = []
    if card.get("schema") != FACT_CARD_SCHEMA:
        problems.append("schema")
    if card.get("id") != item.id:
        problems.append("id")
    start, end = ctx.event_range(item.id)
    verses = card.get("verses")
    if not (isinstance(verses, dict) and is_int(verses.get("s")) and is_int(verses.get("e"))
            and verses["s"] <= verses["e"] and start <= verses["s"] and verses["e"] <= end
            and ctx.verse_exists(verses["s"]) and ctx.verse_exists(verses["e"])):
        problems.append("verses")
    must_show = card.get("mustShow")
    if not isinstance(must_show, list):
        problems.append("mustShow")
    elif not must_show and card.get("noPeople") is not True:
        problems.append("mustShow")
    elif not all(isinstance(p, dict) and nonempty_str(p.get("who"))
                 and ((is_int(p.get("count")) and p["count"] >= 1) or p.get("count") == "crowd")
                 for p in must_show):
        problems.append("mustShow")
    actions = card.get("keyAction")
    if not (isinstance(actions, list) and actions and all(
            isinstance(a, dict) and nonempty_str(a.get("action")) and nonempty_str(a.get("direction"))
            for a in actions)):
        problems.append("keyAction")
    must_not = card.get("mustNot")
    if not (isinstance(must_not, list) and must_not and all(nonempty_str(x) for x in must_not)):
        problems.append("mustNot")
    if problems:
        item.fail("factcard_invalid", ",".join(problems))
    return card_sha


def check_depicts(ctx, item, record):
    refs = record.get("depictsRef")
    if refs is None:
        item.fail("depictsref_missing")
    else:
        start, end = ctx.event_range(item.id)
        valid = isinstance(refs, list) and bool(refs)
        outside = False
        for ref in refs if isinstance(refs, list) else []:
            s, e = (ref.get("s"), ref.get("e")) if isinstance(ref, dict) else (None, None)
            if not (is_int(s) and is_int(e) and s <= e and split_ref(s)[0] == split_ref(e)[0]
                    and ctx.verse_exists(s) and ctx.verse_exists(e)):
                valid = False
                break
            if s < start or e > end:
                outside = True
        if not valid:
            item.fail("depictsref_invalid")
        elif outside:
            exception = record.get("depictsRefException")
            if not (isinstance(exception, dict) and nonempty_str(exception.get("reason"))):
                item.fail("depictsref_out_of_range")
    source = record.get("sectionSource")
    if source is None:
        item.fail("sectionsource_missing")
    elif source not in SECTION_SOURCES:
        item.fail("sectionsource_invalid", source)


def check_review(ctx, item, review_path, subject_kind, subject_sha, card_sha, registry_applies,
                 accepted=()):
    """`accepted` is the tuple of veto keys the owner has accepted on this one square
    (square_accepts.json). An accepted key's "fail"/"unclear" answer is recorded and does not fail
    the gate; nothing else about the review, the veto table or any other square is relaxed."""
    review, err = read_json(review_path)
    if err == "missing":
        item.fail("review_missing")
        return
    if err or not isinstance(review, dict):
        item.fail("review_invalid", err or "not an object")
        return
    problems = [name for name, ok in (
        ("schema", review.get("schema") == REVIEW_SCHEMA),
        ("id", review.get("id") == item.id),
        ("kind", review.get("kind") == item.kind)) if not ok]
    if problems:
        item.fail("review_invalid", ",".join(problems))
    subject = review.get("subject")
    reviewed_sha = subject.get("sha256") if isinstance(subject, dict) else None
    if subject_sha is None or reviewed_sha != subject_sha:
        item.fail("review_sha_mismatch")
    veto = review.get("veto")
    veto = veto if isinstance(veto, dict) else {}
    missing = [key for key in VETO_KEYS if key not in veto]
    unknown = sorted(key for key in veto if key not in VETO_KEYS)
    if missing:
        item.fail("veto_incomplete", ",".join(missing))
    if unknown:
        item.fail("veto_unknown_key", ",".join(unknown))
    failed, forgiven = [], []
    for key in VETO_KEYS:
        if key not in veto:
            continue
        answer = veto[key].get("answer") if isinstance(veto[key], dict) else None
        allowed = {"pass"} if (key != "registryFix" or registry_applies) else {"pass", "na"}
        if answer in allowed:
            continue
        (forgiven if key in accepted else failed).append(f"{key}={answer}")
    if failed:
        item.fail("veto_failed", ",".join(failed))
    if forgiven:
        item.measured["acceptedVetoes"] = forgiven
        item.warnings.append("owner_accepted:" + ",".join(forgiven))
    # An owner-accepted square's review is a written "fail"; it stays that way on disk. The verdict
    # only blocks the gate when something the owner did not accept is still failing.
    if review.get("verdict") != "pass" and not (forgiven and not failed):
        item.fail("review_verdict_not_pass", review.get("verdict"))

    reviewer, generator = review.get("reviewer"), review.get("generator")
    if not all(isinstance(who, dict) and nonempty_str(who.get("model")) and nonempty_str(who.get("session"))
               for who in (reviewer, generator)):
        item.fail("reviewer_identity_missing")
    else:
        if reviewer["session"].strip() == generator["session"].strip():
            item.fail("reviewer_is_generator")
        if reviewer["model"].strip().lower() == generator["model"].strip().lower():
            item.warnings.append("same_model_as_generator")

    inputs = review.get("inputs")
    required = {subject_kind, "factCard", "vetoTable"}
    if not (isinstance(inputs, list) and all(isinstance(i, dict) for i in inputs)):
        item.fail("review_inputs_invalid", "not a list")
        return
    kinds = [i.get("kind") for i in inputs]
    if len(kinds) != len(set(kinds)) or set(kinds) != required:
        extra = sorted(str(k) for k in set(kinds) - required)
        absent = sorted(required - set(kinds))
        item.fail("review_inputs_invalid", f"extra={extra} missing={absent}" if extra or absent else "duplicate")
    by_kind = {i.get("kind"): i.get("sha256") for i in inputs}
    if subject_kind in by_kind and (subject_sha is None or by_kind[subject_kind] != subject_sha):
        item.fail("review_sha_mismatch", "inputs")
    if "factCard" in by_kind and (card_sha is None or by_kind["factCard"] != card_sha):
        item.fail("review_factcard_stale")
    if "vetoTable" in by_kind and by_kind["vetoTable"] != VETO_TABLE_SHA256:
        item.fail("review_vetotable_mismatch")


def check_subject_file(item, path, recorded):
    """Hash the live file and compare with every recorded SHA field. Returns the SHA or None."""
    if not os.path.isfile(path):
        item.fail("live_file_missing", os.path.basename(path))
        return None
    actual = file_sha256(path)
    item.measured["sha256"] = actual
    for field, value in recorded:
        if value is None:
            item.fail("sha_unrecorded", field)
        elif value != actual:
            item.fail("sha_mismatch", field)
    return actual


# ---------------------------------------------------------------- media (ffmpeg / ffprobe, read-only)

def ffprobe(path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=index,codec_type",
           "-of", "json", path]
    try:
        out = subprocess.run(cmd, capture_output=True, check=True, timeout=60, stdin=subprocess.DEVNULL)
        return json.loads(out.stdout.decode("utf-8")), None
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        return None, exc.__class__.__name__


def grab_frame(path, at_seconds=0.0):
    """Decode one frame into memory (PNG over a pipe; nothing touches the disk)."""
    cmd = ["ffmpeg", "-nostdin", "-v", "error"]
    if at_seconds > 0:
        cmd += ["-ss", f"{at_seconds:.3f}"]
    cmd += ["-i", path, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]
    try:
        out = subprocess.run(cmd, capture_output=True, check=True, timeout=60, stdin=subprocess.DEVNULL)
        image = Image.open(io.BytesIO(out.stdout))
        image.load()
        return image
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def pixels(image):
    flat = getattr(image, "get_flattened_data", None)   # Pillow >= 12.1; getdata is deprecated
    return list(flat() if flat else image.getdata())


def dhash(image, size=16):
    gray = image.convert("L").resize((size + 1, size), Image.LANCZOS)
    px = pixels(gray)
    bits = 0
    for row in range(size):
        for col in range(size):
            left, right = px[row * (size + 1) + col], px[row * (size + 1) + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return bits


def hamming(a, b):
    return bin(a ^ b).count("1")


def dark_run(lines):
    """Count leading lines that are flat black, as an encoder's bar is.

    Calibrated on T7 2026-10-23: real bars (genesis-22-1, genesis-25-29, judges-5-1) have mean
    luminance <= 1 and max <= 2; the dark timber walls in genesis-8-1 average about 10 with
    highlights, and must not count as a pillarbox."""
    count = 0
    for line in lines:
        ordered = sorted(line)
        if ordered[min(len(ordered) - 1, int(len(ordered) * 0.98))] > 16 or sum(line) > 6 * len(line):
            break
        count += 1
    return count


def border_bands(image):
    """(top, bottom, left, right) near-black bands in pixels of the original frame."""
    gray = image.convert("L")
    width, height = gray.size
    rows_img = gray.resize((min(width, 320), height), Image.BOX)
    rw = rows_img.size[0]
    rpx = pixels(rows_img)
    rows = [rpx[y * rw:(y + 1) * rw] for y in range(height)]
    cols_img = gray.resize((width, min(height, 180)), Image.BOX)
    ch = cols_img.size[1]
    cpx = pixels(cols_img)
    cols = [[cpx[y * width + x] for y in range(ch)] for x in range(width)]
    return dark_run(rows), dark_run(rows[::-1]), dark_run(cols), dark_run(cols[::-1])


def has_black_border(bands, size):
    width, height = size
    top, bottom, left, right = bands
    min_rows, min_cols = max(3, int(height * 0.02)), max(3, int(width * 0.02))
    return (top >= min_rows and bottom >= min_rows) or (left >= min_cols and right >= min_cols)


# ---------------------------------------------------------------- the three kinds

def legacy_contradictions(status):
    bad = [f"{field}={status[field]}" for field in ("root_review", "independent_review", "status")
           if field in status and status[field] != "pass"]
    if status.get("dual_review_passed") is False:
        bad.append("dual_review_passed=false")
    return bad


def check_inscription(ctx, item, live_sha):
    """Squares with an inscription exception (square_exceptions.json): the live picture is checked like any other
    (fakeText unchanged); in addition the script-composited inscribed/<id>.png must exist, be bound to this live
    SHA and carry exactly the exception's text. Nothing else about the veto table is relaxed."""
    try:
        exc = square_exceptions.get(item.id, ctx.exceptions_path)
    except (OSError, ValueError) as err:
        item.fail("inscription_exception_unreadable", str(err))
        return
    if not exc:
        return
    out_dir = exc.get("inscribed_output_dir", "inscribed")
    png = os.path.join(ctx.square_root, out_dir, f"{item.id}.png")
    ev, err = read_json(os.path.join(ctx.square_root, out_dir, f"{item.id}.inscription.json"))
    if err or not isinstance(ev, dict):
        item.fail("inscription_evidence_missing", err or "not an object")
        return
    problems = []
    if ev.get("schema") != "inscription-evidence-v1" or ev.get("id") != item.id:
        problems.append("schema")
    if live_sha is None or ev.get("base_sha256") != live_sha:
        problems.append("base_sha_not_live")
    if not os.path.isfile(png) or file_sha256(png) != ev.get("output_sha256"):
        problems.append("output_sha")
    expected = square_exceptions.strip_points(exc["text_he_consonants"])
    lines = ev.get("rendered_lines")
    got = " ".join(" ".join(square_exceptions.from_imperial(w) for w in line.split()) for line in lines) \
        if isinstance(lines, list) and all(isinstance(x, str) for x in lines) else None
    if got is None or sorted(got.split()) != sorted(expected.split()):
        problems.append("text_mismatch")
    font = exc["render"]["font_path"]
    if not (os.path.isfile(font) and ev.get("font_sha256") == file_sha256(font)):
        problems.append("font_sha")
    if problems:
        item.fail("inscription_evidence_invalid", ",".join(problems))
    item.measured["inscription"] = {"png": png, "problems": problems}


def check_accept_binding(item, status, accepted, live_sha):
    """An acceptance counts only while the status file says so against these exact bytes."""
    block = status.get("owner_accept")
    if not isinstance(block, dict):
        item.fail("owner_accept_missing")
        return
    problems = []
    if sorted(block.get("keys") or ()) != sorted(accepted):
        problems.append("keys")
    if live_sha is None or block.get("live_sha256") != live_sha:
        problems.append("live_sha")
    for field in ("ruling", "decidedBy", "decidedAt"):
        if not nonempty_str(block.get(field)):
            problems.append(field)
    if problems:
        item.fail("owner_accept_invalid", ",".join(problems))
    item.measured["ownerAccept"] = {"keys": sorted(accepted), "problems": problems}


def check_square(ctx, event_id):
    item = Item("square", event_id)
    status, err = read_json(os.path.join(ctx.square_root, "status", f"{event_id}.json"))
    if err or not isinstance(status, dict):
        item.fail("status_missing" if err == "missing" else "status_invalid", err)
        status = {}
    try:
        accepted = square_accepts.accepted_keys(event_id, VETO_KEYS, ctx.accepts_path)
    except (OSError, ValueError) as exc:
        item.fail("square_accept_unreadable", str(exc))
        accepted = ()
    item.state = status.get("state")
    item.evidence_state = status.get("evidenceState")
    if item.state != "pass":
        item.fail("state_not_pass", item.state)
    else:
        # An accepted square keeps its original "fail" review and independent_review on disk; the
        # acceptance, bound below to the live SHA, is what reconciles them with state=pass.
        bad = [] if accepted else legacy_contradictions(status)
        if bad:
            item.fail("legacy_review_contradiction", ",".join(bad))
    live = os.path.join(ctx.square_root, "live", f"{event_id}.png")
    sha = check_subject_file(item, live, [("live_sha256", status.get("live_sha256")),
                                          ("candidate_sha256", status.get("candidate_sha256"))])
    hits = status.get("ocr_hits")
    if not is_int(hits):
        item.fail("ocr_missing")
    elif hits != 0:
        item.fail("ocr_hits_nonzero", hits)
    if status.get("ocr_sha256") is None or status.get("ocr_sha256") != sha:
        item.fail("ocr_not_sha_bound")
    registered = event_id in ctx.registry
    if registered and not (status.get("registry_fix_verified") is True
                           and nonempty_str(status.get("registry_fix_note"))):
        item.fail("registry_fix_unverified")
    check_depicts(ctx, item, status)
    card_sha = check_fact_card(ctx, item)
    check_review(ctx, item, os.path.join(ctx.square_root, "review", f"{event_id}.json"),
                 "image", sha, card_sha, registry_applies=registered, accepted=accepted)
    if accepted:
        check_accept_binding(item, status, accepted, sha)
    if event_id in ctx.exception_ids:
        check_inscription(ctx, item, sha)
    return item


def manifest_row(ctx, item):
    row = ctx.manifest_events.get(item.id)
    if row is None:
        item.fail("manifest_entry_missing")
        return {}
    return row


def still_path(ctx, event_id):
    return os.path.join(ctx.realistic_root, "images-live", f"{event_id}.jpg")


def check_still(ctx, event_id):
    if event_id in ctx._still_cache:
        return ctx._still_cache[event_id]
    item = Item("still", event_id)
    row = manifest_row(ctx, item)
    item.state = row.get("imageStatus")
    item.evidence_state = row.get("evidenceState")
    if item.state != "pass":
        item.fail("state_not_pass", item.state)
    sha = check_subject_file(item, still_path(ctx, event_id), [("imageSha256", row.get("imageSha256"))])
    check_depicts(ctx, item, row)
    card_sha = check_fact_card(ctx, item)
    check_review(ctx, item, os.path.join(ctx.realistic_root, "review", "still", f"{event_id}.json"),
                 "image", sha, card_sha, registry_applies=False)
    ctx._still_cache[event_id] = item
    return item


def video_path(ctx, item, row):
    rel = row.get("videoFile")
    if rel is None:
        return os.path.join(ctx.realistic_root, "videos-live", f"{item.id}.mp4")
    if not nonempty_str(rel) or os.path.isabs(rel) or ".." in rel.split("/"):
        item.fail("video_file_invalid", rel)
        return None
    return os.path.join(ctx.realistic_root, rel)


def check_video(ctx, event_id):
    item = Item("video", event_id)
    row = manifest_row(ctx, item)
    item.state = row.get("videoStatus")
    item.evidence_state = row.get("videoEvidenceState")
    if item.state != "pass":
        item.fail("state_not_pass", item.state)
    path = video_path(ctx, item, row)
    sha = check_subject_file(item, path, [("videoSha256", row.get("videoSha256"))]) if path else None

    origin = row.get("videoOrigin")
    legacy = origin == LEGACY_ORIGIN
    if origin is not None and not legacy:
        item.fail("video_origin_invalid", origin)
    if legacy:
        if row.get("eventMatch") != "yes":
            item.fail("event_match_unverified", row.get("eventMatch"))
        if row.get("videoDisposition") not in LEGACY_DISPOSITIONS:
            item.fail("disposition_not_kept", row.get("videoDisposition"))

    target = TIER_SECONDS.get(row.get("tier"), DEFAULT_TIER_SECONDS)
    declared = row.get("durationSec")
    if not isinstance(declared, (int, float)) or isinstance(declared, bool):
        item.fail("duration_missing")
        declared = None
    elif legacy:
        if not LEGACY_SECONDS[0] <= declared <= LEGACY_SECONDS[1]:
            item.fail("duration_out_of_range", f"durationSec={declared} range={LEGACY_SECONDS}")
    elif abs(declared - target) > DURATION_TOLERANCE:
        item.fail("duration_out_of_tier", f"durationSec={declared} tier={row.get('tier')} target={target}")

    if sha is not None:
        probe, err = ffprobe(path)
        if err or not isinstance(probe, dict):
            item.fail("probe_failed", err)
        else:
            streams = probe.get("streams", [])
            audio = sum(1 for s in streams if s.get("codec_type") == "audio")
            item.measured["audioStreams"] = audio
            if audio:
                item.fail("audio_present", audio)
            try:
                measured = float(probe.get("format", {}).get("duration"))
            except (TypeError, ValueError):
                measured = None
            item.measured["durationSec"] = measured
            if measured is None:
                item.fail("probe_failed", "duration")
            elif legacy:
                if not LEGACY_SECONDS[0] <= measured <= LEGACY_SECONDS[1]:
                    item.fail("duration_measured_out_of_range", f"measured={measured:.2f}")
                if declared is not None and abs(measured - declared) > DURATION_TOLERANCE:
                    item.fail("duration_field_mismatch", f"durationSec={declared} measured={measured:.2f}")
            elif abs(measured - target) > DURATION_TOLERANCE:
                item.fail("duration_measured_out_of_tier", f"measured={measured:.2f} target={target}")
            first = grab_frame(path, 0.0)
            middle = grab_frame(path, measured / 2) if measured else None
            if first is None:
                item.fail("frame_grab_failed")
            else:
                frames = [first] + ([middle] if middle is not None else [])
                bands = [border_bands(f) for f in frames]
                item.measured["borderBands"] = bands
                if any(has_black_border(b, f.size) for b, f in zip(bands, frames)):
                    item.fail("black_border")
                still_file = still_path(ctx, event_id)
                if not os.path.isfile(still_file):
                    item.fail("still_missing")
                else:
                    with Image.open(still_file) as still:
                        distance = hamming(dhash(first), dhash(still))
                    item.measured["firstFrameDhash"] = distance
                    if distance > DHASH_MAX:
                        if legacy:
                            item.warnings.append("first_frame_legacy")
                        else:
                            item.fail("first_frame_mismatch", f"{distance}/256")

    if not check_still(ctx, event_id).passed:
        item.fail("still_not_passed")
    check_depicts(ctx, item, row)
    card_sha = check_fact_card(ctx, item)
    check_review(ctx, item, os.path.join(ctx.realistic_root, "review", "video", f"{event_id}.json"),
                 "video", sha, card_sha, registry_applies=False)
    return item


CHECKERS = {"square": check_square, "still": check_still, "video": check_video}


def run(ctx, kind, ids):
    results = []
    for event_id in ids:
        if not ID_RE.match(event_id) or event_id not in ctx.events:
            item = Item(kind, event_id)
            item.fail("unknown_id")
            results.append(item)
            continue
        results.append(CHECKERS[kind](ctx, event_id))
    return results


def summarize(kind, results):
    reasons_all, reasons_pass_state = Counter(), Counter()
    for item in results:
        for code in sorted({r["code"] for r in item.reasons}):
            reasons_all[code] += 1
            if item.state == "pass":
                reasons_pass_state[code] += 1
    return {
        "kind": kind,
        "vetoTableSha256": VETO_TABLE_SHA256,
        "checked": len(results),
        "pass": sum(item.passed for item in results),
        "fail": sum(not item.passed for item in results),
        "states": dict(Counter(str(item.state) for item in results).most_common()),
        "statePassButGateFail": sum(item.state == "pass" and not item.passed for item in results),
        "reasons": dict(reasons_all.most_common()),
        "reasonsAmongStatePass": dict(reasons_pass_state.most_common()),
        "warnings": dict(Counter(w for item in results for w in item.warnings).most_common()),
        "evidenceState": dict(Counter(str(item.evidence_state) for item in results).most_common()),
    }


def print_summary(summary, out):
    s = summary
    out.write(f"gate_check {s['kind']}: {s['checked']} checked, {s['pass']} PASS, {s['fail']} FAIL "
              f"(state=pass but gate FAIL: {s['statePassButGateFail']})\n")
    out.write("state:\n")
    for name, count in s["states"].items():
        out.write(f"  {name:<28}{count:>6}\n")
    out.write("failure reasons (items; all / among state=pass):\n")
    for code, count in s["reasons"].items():
        out.write(f"  {code:<28}{count:>6} / {s['reasonsAmongStatePass'].get(code, 0)}\n")
    if s["warnings"]:
        out.write("warnings:\n")
        for code, count in s["warnings"].items():
            out.write(f"  {code:<28}{count:>6}\n")
    out.write("evidenceState (reported, not gated):\n")
    for name, count in s["evidenceState"].items():
        out.write(f"  {name:<28}{count:>6}\n")


def main(argv=None):
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("ids", nargs="*", help="event ids, e.g. genesis-9-18")
    common.add_argument("--all", action="store_true", help="every event in the events file")
    common.add_argument("--json", action="store_true", help="machine-readable output")
    common.add_argument("--summary", action="store_true", help="counts per state and failure reason")
    common.add_argument("--scenes-root", default=DEFAULT_SCENES_ROOT)
    common.add_argument("--events", default=DEFAULT_EVENTS)
    common.add_argument("--bible", default=DEFAULT_BIBLE, help="versification used to validate refs")
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="kind", required=True)
    for kind in CHECKERS:
        sub.add_parser(kind, parents=[common], help=f"gate the {kind} line")
    sub.add_parser("veto-table", help="print the veto table and its SHA-256")
    args = parser.parse_args(argv)

    if args.kind == "veto-table":
        json.dump({"sha256": VETO_TABLE_SHA256, "table": VETO_TABLE}, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return 0
    if bool(args.ids) == bool(args.all):
        parser.error("give event ids or --all (not both)")
    ctx = Context(args.scenes_root, args.events, args.bible)
    ids = ctx.event_order if args.all else args.ids
    results = run(ctx, args.kind, ids)
    summary = summarize(args.kind, results)
    if args.json:
        payload = {"summary": summary}
        if not args.summary:
            payload["items"] = [item.as_dict() for item in results]
        json.dump(payload, sys.stdout, ensure_ascii=False, indent=1)
        sys.stdout.write("\n")
    else:
        if not args.summary:
            for item in results:
                if item.passed:
                    sys.stdout.write(f"PASS {item.id}\n")
                else:
                    detail = ", ".join(r["code"] + (f"({r['detail']})" if "detail" in r else "")
                                       for r in item.reasons)
                    sys.stdout.write(f"FAIL {item.id}: {detail}\n")
        print_summary(summary, sys.stdout)
    return 0 if summary["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
