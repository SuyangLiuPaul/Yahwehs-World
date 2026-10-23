"""Tests for tools/scenes/gate_check.py (plain unittest; pytest is not installed here).

    python3 -m unittest tests/test_gate_check.py -v      (from the repo root)

Every rule is tested twice: a complete fixture must PASS, and the same fixture with exactly
one field flipped must FAIL with that rule's reason code (mutation checks). Fixtures live in
temporary directories; the real T7 tree is never touched.
"""
import contextlib
import copy
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(REPO, "tools", "scenes", "gate_check.py")
sys.path.insert(0, os.path.dirname(GATE))
import gate_check as g  # noqa: E402

from PIL import Image, ImageDraw  # noqa: E402

HAVE_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None

# Three events: a plain one, an S-tier one, and one listed in content-qc-registry.json.
EVENTS = [
    {"id": "genesis-9-18", "start": 1009018, "end": 1009029, "tier": "A"},
    {"id": "matthew-3-13", "start": 40003013, "end": 40003017, "tier": "S"},
    {"id": "exodus-33-1", "start": 2033001, "end": 2033023, "tier": "B"},
]
PLAIN, S_TIER, REGISTERED = "genesis-9-18", "matthew-3-13", "exodus-33-1"


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def append(path, data, mode="ab"):
    with open(path, mode) as f:
        f.write(data)


def read(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def picture(path, seed, size=(320, 180)):
    """A structured picture so dHash has edges to compare."""
    img = Image.new("RGB", size, (90 + seed * 30 % 120, 120, 160))
    draw = ImageDraw.Draw(img)
    for i in range(8):
        x = (i * 41 + seed * 67) % size[0]
        y = (i * 23 + seed * 31) % size[1]
        draw.rectangle([x, y, x + 40 + seed * 5, y + 30], fill=((i * 37 + seed * 90) % 255, (i * 91) % 255, 40))
    draw.ellipse([100 + seed * 20, 40, 220, 150 - seed * 10], fill=(240, 220 - seed * 40, 180))
    img.save(path)


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *args], check=True)


class MediaCache:
    """Pictures and clips built once per run, copied into each fixture."""
    dir = None

    @classmethod
    def build(cls):
        if cls.dir:
            return cls.dir
        cls.dir = tempfile.mkdtemp(prefix="gate-media-")
        d = cls.dir
        picture(f"{d}/square.png", 1)
        picture(f"{d}/still.png", 2)
        Image.open(f"{d}/still.png").save(f"{d}/still.jpg", quality=92)
        picture(f"{d}/other.png", 5)
        if HAVE_FFMPEG:
            enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "12"]
            for seconds in (6, 8):
                ffmpeg("-loop", "1", "-i", f"{d}/still.png", "-t", str(seconds), *enc, f"{d}/clip{seconds}.mp4")
            ffmpeg("-loop", "1", "-i", f"{d}/still.png", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                   "-t", "6", *enc, "-c:a", "aac", "-shortest", f"{d}/audio.mp4")
            ffmpeg("-loop", "1", "-i", f"{d}/still.png", "-t", "6",
                   "-vf", "scale=320:140,pad=320:180:0:20:black", *enc, f"{d}/letterbox.mp4")
            ffmpeg("-loop", "1", "-i", f"{d}/other.png", "-t", "6", *enc, f"{d}/other.mp4")
        return d


def bible():
    books = [[["v"] * 40 for _ in range(50)] for _ in range(66)]
    books[0][8] = ["v"] * 29          # Genesis 9 has 29 verses: 9:30 does not exist
    return {"books": books}


def fact_card(event_id, start, end):
    return {"schema": g.FACT_CARD_SCHEMA, "id": event_id,
            "verses": {"s": start, "e": end, "ref": event_id},
            "mustShow": [{"who": "Noah", "count": 1}, {"who": "Shem and Japheth", "count": 2}],
            "keyAction": [{"action": "cover their father with a garment",
                           "direction": "walking backward, faces turned away", "ref": "9:23"}],
            "mustNot": ["sons facing Noah", "nudity"]}


def review(kind, event_id, subject_sha, card_sha):
    return {"schema": g.REVIEW_SCHEMA, "id": event_id, "kind": kind,
            "subject": {"path": "x", "sha256": subject_sha},
            "verdict": "pass",
            "veto": {key: {"answer": "pass", "note": ""} for key in g.VETO_KEYS},
            "reviewer": {"model": "claude-opus-5-5", "session": "review-2026-10-24-a",
                         "reviewedAt": "2026-10-24T01:00:00Z"},
            "generator": {"model": "nano-banana-2.1", "session": "yahweh-globe-images-v3"},
            "inputs": [{"kind": "video" if kind == "video" else "image", "sha256": subject_sha},
                       {"kind": "factCard", "sha256": card_sha},
                       {"kind": "vetoTable", "sha256": g.VETO_TABLE_SHA256}]}


class Fixture:
    """A complete, gate-passing scenes tree for all three events and all three kinds."""

    def __init__(self):
        media = MediaCache.build()
        self.tmp = tempfile.mkdtemp(prefix="gate-fixture-")
        self.root = os.path.join(self.tmp, "scenes")
        self.sq = os.path.join(self.root, g.SQUARE_DIR)
        self.rc = os.path.join(self.root, g.REALISTIC_DIR)
        self.events_path = os.path.join(self.tmp, "events.json")
        self.bible_path = os.path.join(self.tmp, "bible.json")
        write_json(self.events_path, {"events": [{k: e[k] for k in ("id", "start", "end")} for e in EVENTS]})
        write_json(self.bible_path, bible())
        write_json(f"{self.sq}/content-qc-registry.json", {REGISTERED: "Remove the face in the rock."})
        for d in ("live", "status", "review"):
            os.makedirs(f"{self.sq}/{d}", exist_ok=True)
        for d in ("images-live", "videos-live", "review/still", "review/video"):
            os.makedirs(f"{self.rc}/{d}", exist_ok=True)
        manifest_events = []
        for e in EVENTS:
            eid = e["id"]
            card = self.path("card", eid)
            write_json(card, fact_card(eid, e["start"], e["end"]))
            card_sha = sha(card)
            depicts = [{"s": e["start"], "e": e["start"] + 1}]
            # square
            shutil.copy(f"{media}/square.png", self.path("square", eid))
            s_sha = sha(self.path("square", eid))
            status = {"id": eid, "state": "pass", "candidate_sha256": s_sha, "live_sha256": s_sha,
                      "ocr_hits": 0, "ocr_sha256": s_sha, "depictsRef": depicts, "sectionSource": "depicts"}
            if eid == REGISTERED:
                status.update(registry_fix_verified=True, registry_fix_note="Face removed; only light remains.")
            write_json(self.path("status", eid), status)
            write_json(self.path("square_review", eid), review("square", eid, s_sha, card_sha))
            # still
            shutil.copy(f"{media}/still.jpg", self.path("still", eid))
            i_sha = sha(self.path("still", eid))
            write_json(self.path("still_review", eid), review("still", eid, i_sha, card_sha))
            row = {"id": eid, "tier": e["tier"], "imageStatus": "pass", "imageSha256": i_sha,
                   "depictsRef": depicts, "sectionSource": "provisional", "evidenceState": "complete",
                   "durationSec": 8 if e["tier"] == "S" else 6}
            # video
            if HAVE_FFMPEG:
                shutil.copy(f"{media}/clip{row['durationSec']}.mp4", self.path("video", eid))
                v_sha = sha(self.path("video", eid))
                row.update(videoStatus="pass", videoSha256=v_sha, audio="none")
                write_json(self.path("video_review", eid), review("video", eid, v_sha, card_sha))
            manifest_events.append(row)
        write_json(f"{self.rc}/manifest.json", {"project": "fixture", "events": manifest_events})

    def path(self, what, eid):
        return {
            "card": f"{self.root}/{g.FACT_CARD_DIR}/{eid}.json",
            "square": f"{self.sq}/live/{eid}.png",
            "status": f"{self.sq}/status/{eid}.json",
            "square_review": f"{self.sq}/review/{eid}.json",
            "still": f"{self.rc}/images-live/{eid}.jpg",
            "still_review": f"{self.rc}/review/still/{eid}.json",
            "video": f"{self.rc}/videos-live/{eid}.mp4",
            "video_review": f"{self.rc}/review/video/{eid}.json",
        }[what]

    def edit(self, what, eid, fn):
        p = self.path(what, eid)
        obj = read(p)
        fn(obj)
        write_json(p, obj)

    def edit_row(self, eid, fn):
        p = f"{self.rc}/manifest.json"
        m = read(p)
        fn(next(r for r in m["events"] if r["id"] == eid))
        write_json(p, m)

    def check(self, kind, eid):
        ctx = g.Context(self.root, self.events_path, self.bible_path)
        return g.run(ctx, kind, [eid])[0]

    def cli(self, *args):
        cmd = [sys.executable, GATE, *args, "--scenes-root", self.root,
               "--events", self.events_path, "--bible", self.bible_path]
        return subprocess.run(cmd, capture_output=True, text=True,
                              env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})

    def close(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


def codes(item):
    return {r["code"] for r in item.reasons}


class GateTestCase(unittest.TestCase):
    def setUp(self):
        self.fx = Fixture()

    def tearDown(self):
        self.fx.close()

    def assertPasses(self, kind, eid):
        item = self.fx.check(kind, eid)
        self.assertTrue(item.passed, f"{kind} {eid} should pass: {item.reasons}")
        return item

    def assertFailsWith(self, kind, eid, code):
        item = self.fx.check(kind, eid)
        self.assertFalse(item.passed, f"{kind} {eid} should fail with {code}")
        self.assertIn(code, codes(item), f"{kind} {eid}: expected {code}, got {item.reasons}")
        return item


def mutation_table():
    """(name, kind, event, mutate(fixture), expected code) — each flips exactly one thing."""
    def status(eid, fn):
        return lambda fx: fx.edit("status", eid, fn)

    def sreview(eid, fn, what="square_review"):
        return lambda fx: fx.edit(what, eid, fn)

    def card(fn):
        return lambda fx: fx.edit("card", PLAIN, fn)

    def setk(k, v):
        return lambda o: o.__setitem__(k, v)

    def delk(k):
        return lambda o: o.pop(k)

    P, R = PLAIN, REGISTERED
    rows = [
        # state and legacy review fields
        ("state not_started", "square", P, status(P, setk("state", "not_started")), "state_not_pass"),
        ("root_review rework", "square", P, status(P, setk("root_review", "rework")), "legacy_review_contradiction"),
        ("independent_review rework", "square", P, status(P, setk("independent_review", "rework")),
         "legacy_review_contradiction"),
        ("legacy status rework", "square", P, status(P, setk("status", "rework")), "legacy_review_contradiction"),
        ("dual_review_passed false", "square", P, status(P, setk("dual_review_passed", False)),
         "legacy_review_contradiction"),
        ("status file missing", "square", P, lambda fx: os.remove(fx.path("status", P)), "status_missing"),
        ("status file corrupt", "square", P, lambda fx: append(fx.path("status", P), b"\xb0", "wb"), "status_invalid"),
        # SHA binding
        ("live bytes changed", "square", P, lambda fx: append(fx.path("square", P), b"x"), "sha_mismatch"),
        ("live file missing", "square", P, lambda fx: os.remove(fx.path("square", P)), "live_file_missing"),
        ("live_sha256 unrecorded", "square", P, status(P, delk("live_sha256")), "sha_unrecorded"),
        ("candidate_sha256 null", "square", P, status(P, setk("candidate_sha256", None)), "sha_unrecorded"),
        ("candidate_sha256 differs", "square", P, status(P, setk("candidate_sha256", "0" * 64)), "sha_mismatch"),
        # OCR
        ("ocr_hits missing", "square", P, status(P, delk("ocr_hits")), "ocr_missing"),
        ("ocr_hits 2", "square", P, status(P, setk("ocr_hits", 2)), "ocr_hits_nonzero"),
        ("ocr_hits true", "square", P, status(P, setk("ocr_hits", True)), "ocr_missing"),
        ("ocr_sha256 stale", "square", P, status(P, setk("ocr_sha256", "1" * 64)), "ocr_not_sha_bound"),
        ("ocr_sha256 missing", "square", P, status(P, delk("ocr_sha256")), "ocr_not_sha_bound"),
        # registry
        ("registry_fix_verified missing", "square", R, status(R, delk("registry_fix_verified")),
         "registry_fix_unverified"),
        ("registry_fix_verified false", "square", R, status(R, setk("registry_fix_verified", False)),
         "registry_fix_unverified"),
        ("registry_fix_verified string", "square", R, status(R, setk("registry_fix_verified", "true")),
         "registry_fix_unverified"),
        ("registry_fix_note empty", "square", R, status(R, setk("registry_fix_note", " ")),
         "registry_fix_unverified"),
        ("registryFix na while registered", "square", R,
         sreview(R, lambda o: o["veto"].__setitem__("registryFix", {"answer": "na"})), "veto_failed"),
        # depictsRef and sectionSource
        ("depictsRef missing", "square", P, status(P, delk("depictsRef")), "depictsref_missing"),
        ("depictsRef empty", "square", P, status(P, setk("depictsRef", [])), "depictsref_invalid"),
        ("depictsRef string", "square", P, status(P, setk("depictsRef", "Genesis 9:23")), "depictsref_invalid"),
        ("depictsRef s>e", "square", P, status(P, setk("depictsRef", [{"s": 1009023, "e": 1009020}])),
         "depictsref_invalid"),
        ("depictsRef verse does not exist", "square", P,
         status(P, setk("depictsRef", [{"s": 1009023, "e": 1009030}])), "depictsref_invalid"),
        ("depictsRef crosses books", "square", P,
         status(P, setk("depictsRef", [{"s": 1009023, "e": 2001001}])), "depictsref_invalid"),
        ("depictsRef outside event", "square", P,
         status(P, setk("depictsRef", [{"s": 1010001, "e": 1010002}])), "depictsref_out_of_range"),
        ("exception without reason", "square", P, lambda fx: fx.edit("status", P, lambda o: o.update(
            depictsRef=[{"s": 1010001, "e": 1010002}], depictsRefException={"reason": ""}))),
        ("sectionSource missing", "square", P, status(P, delk("sectionSource")), "sectionsource_missing"),
        ("sectionSource guessed", "square", P, status(P, setk("sectionSource", "overlap")), "sectionsource_invalid"),
        # fact card
        ("fact card missing", "square", P, lambda fx: os.remove(fx.path("card", P)), "factcard_missing"),
        ("fact card not json", "square", P, lambda fx: append(fx.path("card", P), b"{", "wb"), "factcard_invalid"),
        ("fact card schema", "square", P, card(setk("schema", "v0")), "factcard_invalid"),
        ("fact card id", "square", P, card(setk("id", "genesis-1-1")), "factcard_invalid"),
        ("fact card verses outside event", "square", P, card(setk("verses", {"s": 1009001, "e": 1009029})),
         "factcard_invalid"),
        ("fact card verses missing", "square", P, card(delk("verses")), "factcard_invalid"),
        ("mustShow empty without noPeople", "square", P, card(setk("mustShow", [])), "factcard_invalid"),
        ("mustShow count 0", "square", P, card(setk("mustShow", [{"who": "Noah", "count": 0}])), "factcard_invalid"),
        ("mustShow count missing", "square", P, card(setk("mustShow", [{"who": "Noah"}])), "factcard_invalid"),
        ("mustShow who empty", "square", P, card(setk("mustShow", [{"who": "", "count": 1}])), "factcard_invalid"),
        ("keyAction missing", "square", P, card(delk("keyAction")), "factcard_invalid"),
        ("keyAction without direction", "square", P, card(setk("keyAction", [{"action": "cover"}])),
         "factcard_invalid"),
        ("mustNot empty", "square", P, card(setk("mustNot", [])), "factcard_invalid"),
        # review file
        ("review missing", "square", P, lambda fx: os.remove(fx.path("square_review", P)), "review_missing"),
        ("review not json", "square", P, lambda fx: append(fx.path("square_review", P), b"nope", "wb"),
         "review_invalid"),
        ("review schema", "square", P, sreview(P, setk("schema", "old")), "review_invalid"),
        ("review id", "square", P, sreview(P, setk("id", "genesis-1-1")), "review_invalid"),
        ("review kind", "square", P, sreview(P, setk("kind", "still")), "review_invalid"),
        ("review of an older file", "square", P, sreview(P, lambda o: o["subject"].__setitem__("sha256", "2" * 64)),
         "review_sha_mismatch"),
        ("review verdict rework", "square", P, sreview(P, setk("verdict", "rework")), "review_verdict_not_pass"),
        ("review verdict missing", "square", P, sreview(P, delk("verdict")), "review_verdict_not_pass"),
        ("veto table missing", "square", P, sreview(P, delk("veto")), "veto_incomplete"),
        ("veto unknown key", "square", P, sreview(P, lambda o: o["veto"].__setitem__("vibes", {"answer": "pass"})),
         "veto_unknown_key"),
        ("veto answer as bare string", "square", P, sreview(P, lambda o: o["veto"].__setitem__("modesty", "pass")),
         "veto_failed"),
        ("reviewer session = generator session", "square", P,
         sreview(P, lambda o: o["reviewer"].__setitem__("session", o["generator"]["session"])),
         "reviewer_is_generator"),
        ("reviewer missing", "square", P, sreview(P, delk("reviewer")), "reviewer_identity_missing"),
        ("generator missing", "square", P, sreview(P, delk("generator")), "reviewer_identity_missing"),
        ("reviewer model empty", "square", P, sreview(P, lambda o: o["reviewer"].__setitem__("model", "")),
         "reviewer_identity_missing"),
        ("reviewer saw the prompt", "square", P,
         sreview(P, lambda o: o["inputs"].append({"kind": "prompt", "sha256": "3" * 64})), "review_inputs_invalid"),
        ("reviewer saw generator notes", "square", P,
         sreview(P, lambda o: o["inputs"].append({"kind": "generatorVerdict", "sha256": "3" * 64})),
         "review_inputs_invalid"),
        ("reviewer without fact card", "square", P,
         sreview(P, lambda o: o.__setitem__("inputs", [i for i in o["inputs"] if i["kind"] != "factCard"])),
         "review_inputs_invalid"),
        ("inputs duplicated", "square", P, sreview(P, lambda o: o["inputs"].append(dict(o["inputs"][0]))),
         "review_inputs_invalid"),
        ("inputs not a list", "square", P, sreview(P, setk("inputs", {})), "review_inputs_invalid"),
        ("image input of another file", "square", P,
         sreview(P, lambda o: o["inputs"][0].__setitem__("sha256", "4" * 64)), "review_sha_mismatch"),
        ("fact card edited after review", "square", P,
         card(lambda o: o["mustNot"].append("ladders")), "review_factcard_stale"),
        ("old veto table", "square", P, sreview(P, lambda o: o["inputs"][2].__setitem__("sha256", "5" * 64)),
         "review_vetotable_mismatch"),
        # still line
        ("still imageStatus not_started", "still", P,
         lambda fx: fx.edit_row(P, setk("imageStatus", "not_started")), "state_not_pass"),
        ("still imageSha256 unrecorded", "still", P, lambda fx: fx.edit_row(P, delk("imageSha256")),
         "sha_unrecorded"),
        ("still bytes changed", "still", P, lambda fx: append(fx.path("still", P), b"x"), "sha_mismatch"),
        ("still file missing", "still", P, lambda fx: os.remove(fx.path("still", P)), "live_file_missing"),
        ("still review missing", "still", P, lambda fx: os.remove(fx.path("still_review", P)), "review_missing"),
        ("still review written as square", "still", P, sreview(P, setk("kind", "square"), "still_review"),
         "review_invalid"),
        ("still depictsRef missing", "still", P, lambda fx: fx.edit_row(P, delk("depictsRef")), "depictsref_missing"),
        ("still sectionSource missing", "still", P, lambda fx: fx.edit_row(P, delk("sectionSource")),
         "sectionsource_missing"),
        ("still veto fail", "still", P,
         sreview(P, lambda o: o["veto"].__setitem__("jesusHair", {"answer": "fail"}), "still_review"),
         "veto_failed"),
        ("still not in manifest", "still", P,
         lambda fx: fx.edit_row(P, setk("id", "gone")), "manifest_entry_missing"),
        ("unknown id", "still", "genesis-99-1", lambda fx: None, "unknown_id"),
        ("path-like id", "square", "../status/x", lambda fx: None, "unknown_id"),
    ]
    for key in g.VETO_KEYS:
        rows.append((f"veto {key} missing", "square", P,
                     sreview(P, lambda o, k=key: o["veto"].pop(k)), "veto_incomplete"))
        for answer in ("fail", "unclear"):
            rows.append((f"veto {key} {answer}", "square", P,
                         sreview(P, lambda o, k=key, a=answer: o["veto"].__setitem__(k, {"answer": a})),
                         "veto_failed"))
        if key != "registryFix":
            rows.append((f"veto {key} na", "square", P,
                         sreview(P, lambda o, k=key: o["veto"].__setitem__(k, {"answer": "na"})), "veto_failed"))
    return [r if len(r) == 5 else (*r, "depictsref_out_of_range") for r in rows]


class TestGateRules(GateTestCase):
    def test_complete_fixture_passes_square_and_still(self):
        for kind in ("square", "still"):
            for e in EVENTS:
                self.assertPasses(kind, e["id"])

    def test_each_single_mutation_fails_with_its_reason(self):
        table = mutation_table()
        self.assertGreater(len(table), 100)
        for name, kind, eid, mutate, code in table:
            with self.subTest(name):
                fx = Fixture()
                try:
                    mutate(fx)
                    item = fx.check(kind, eid)
                    self.assertFalse(item.passed, name)
                    self.assertIn(code, codes(item), f"{name}: {item.reasons}")
                finally:
                    fx.close()

    def test_veto_keys_are_exactly_the_plan_list(self):
        self.assertEqual(g.VETO_KEYS, ("jesusHair", "mensHair", "godDepiction", "trinityComposition",
                                       "anachronism", "headCount", "modesty", "fakeText",
                                       "duplicatedPerson", "registryFix"))

    def test_registry_fix_na_allowed_only_where_registry_does_not_apply(self):
        na = {"answer": "na"}
        self.fx.edit("square_review", PLAIN, lambda o: o["veto"].__setitem__("registryFix", na))
        self.assertPasses("square", PLAIN)
        self.fx.edit("still_review", REGISTERED, lambda o: o["veto"].__setitem__("registryFix", na))
        self.assertPasses("still", REGISTERED)   # the registry is about the square images only

    def test_unregistered_square_needs_no_registry_fields(self):
        status = read(self.fx.path("status", PLAIN))
        self.assertNotIn("registry_fix_verified", status)
        self.assertPasses("square", PLAIN)

    def test_documented_exception_allows_ref_outside_event(self):
        self.fx.edit("status", PLAIN, lambda o: o.update(
            depictsRef=[{"s": 1010001, "e": 1010002}],
            depictsRefException={"reason": "borrowed from genesis-10-1, see owner note", "source": "genesis-10-1"}))
        self.assertPasses("square", PLAIN)

    def test_provisional_section_source_passes(self):
        self.fx.edit("status", PLAIN, lambda o: o.__setitem__("sectionSource", "provisional"))
        self.assertPasses("square", PLAIN)

    def test_crowd_count_and_no_people_cards_pass(self):
        for change in (lambda o: o.__setitem__("mustShow", [{"who": "Israel", "count": "crowd"}]),
                       lambda o: o.update(mustShow=[], noPeople=True)):
            self.fx.edit("card", PLAIN, change)
            # the card changed, so the review is stale until it is redone against the new card
            self.assertFailsWith("square", PLAIN, "review_factcard_stale")
            card_sha = sha(self.fx.path("card", PLAIN))
            self.fx.edit("square_review", PLAIN, lambda o: o["inputs"][1].__setitem__("sha256", card_sha))
            self.assertPasses("square", PLAIN)

    def test_same_model_is_a_warning_not_a_failure(self):
        self.fx.edit("square_review", PLAIN, lambda o: o["reviewer"].__setitem__("model", o["generator"]["model"]))
        item = self.assertPasses("square", PLAIN)
        self.assertIn("same_model_as_generator", item.warnings)

    def test_contradiction_found_in_real_data_is_caught(self):
        """genesis-9-18 on T7: state pass, root/independent review rework, Visual_QC says PASS."""
        self.fx.edit("status", PLAIN, lambda o: o.update(
            root_review="rework", independent_review="rework", status="rework",
            Visual_QC="PASS (Triple-Verified: Main Agent + OCR 0 hits + Independent QC Subagent)"))
        self.assertFailsWith("square", PLAIN, "legacy_review_contradiction")

    def test_border_detector_flat_bars_versus_dark_scenery(self):
        bars = Image.new("L", (320, 180), 120)
        ImageDraw.Draw(bars).rectangle([0, 0, 319, 9], fill=1)
        ImageDraw.Draw(bars).rectangle([0, 170, 319, 179], fill=0)
        self.assertTrue(g.has_black_border(g.border_bands(bars), bars.size))
        one_side = Image.new("L", (320, 180), 120)
        ImageDraw.Draw(one_side).rectangle([0, 0, 319, 30], fill=0)     # dark sky only: not a letterbox
        self.assertFalse(g.has_black_border(g.border_bands(one_side), one_side.size))
        timber = Image.new("L", (320, 180), 120)                        # genesis-8-1: dark walls, mean ~10
        draw = ImageDraw.Draw(timber)
        for x in list(range(0, 60)) + list(range(260, 320)):
            draw.line([x, 0, x, 179], fill=6 + (x * 7) % 12)
        self.assertFalse(g.has_black_border(g.border_bands(timber), timber.size))

    def test_all_reasons_are_reported_not_just_the_first(self):
        os.remove(self.fx.path("square_review", PLAIN))
        os.remove(self.fx.path("card", PLAIN))
        self.fx.edit("status", PLAIN, lambda o: o.pop("depictsRef"))
        item = self.fx.check("square", PLAIN)
        self.assertTrue({"review_missing", "factcard_missing", "depictsref_missing"} <= codes(item))


@unittest.skipUnless(HAVE_FFMPEG, "ffmpeg/ffprobe not installed")
class TestVideoRules(GateTestCase):
    def media(self, name):
        return os.path.join(MediaCache.build(), name)

    def replace_video(self, eid, name):
        shutil.copy(self.media(name), self.fx.path("video", eid))
        new_sha = sha(self.fx.path("video", eid))
        self.fx.edit_row(eid, lambda r: r.__setitem__("videoSha256", new_sha))
        self.fx.edit("video_review", eid, lambda o: (o["subject"].__setitem__("sha256", new_sha),
                                                     o["inputs"][0].__setitem__("sha256", new_sha)))

    def test_complete_video_passes_both_tiers(self):
        item = self.assertPasses("video", PLAIN)
        self.assertLessEqual(item.measured["firstFrameDhash"], g.DHASH_MAX)
        self.assertEqual(item.measured["audioStreams"], 0)
        self.assertPasses("video", S_TIER)     # S tier: 8 s

    def test_audio_stream_fails(self):
        self.replace_video(PLAIN, "audio.mp4")
        self.assertFailsWith("video", PLAIN, "audio_present")

    def test_letterbox_fails(self):
        self.replace_video(PLAIN, "letterbox.mp4")
        item = self.assertFailsWith("video", PLAIN, "black_border")
        self.assertNotIn("audio_present", codes(item))

    def test_first_frame_not_the_still_fails(self):
        self.replace_video(PLAIN, "other.mp4")
        item = self.assertFailsWith("video", PLAIN, "first_frame_mismatch")
        self.assertGreater(item.measured["firstFrameDhash"], g.DHASH_MAX)

    def test_measured_duration_outside_tier_fails(self):
        self.replace_video(PLAIN, "clip8.mp4")          # A tier wants 6 s
        self.assertFailsWith("video", PLAIN, "duration_measured_out_of_tier")

    def test_declared_duration_outside_tier_fails(self):
        self.fx.edit_row(PLAIN, lambda r: r.__setitem__("durationSec", 8))
        self.assertFailsWith("video", PLAIN, "duration_out_of_tier")
        self.fx.edit_row(PLAIN, lambda r: r.__setitem__("durationSec", 6.4))
        self.assertPasses("video", PLAIN)

    def test_duration_missing_fails(self):
        self.fx.edit_row(PLAIN, lambda r: r.pop("durationSec"))
        self.assertFailsWith("video", PLAIN, "duration_missing")

    def test_video_state_and_sha(self):
        self.fx.edit_row(PLAIN, lambda r: r.__setitem__("videoStatus", "not_started"))
        self.assertFailsWith("video", PLAIN, "state_not_pass")
        self.fx.edit_row(PLAIN, lambda r: r.update(videoStatus="pass", videoSha256="6" * 64))
        self.assertFailsWith("video", PLAIN, "sha_mismatch")

    def test_video_needs_its_still_to_pass(self):
        self.fx.edit_row(PLAIN, lambda r: r.__setitem__("imageStatus", "rework"))
        self.assertFailsWith("video", PLAIN, "still_not_passed")

    def test_video_review_must_list_the_video_not_an_image(self):
        self.fx.edit("video_review", PLAIN, lambda o: o["inputs"][0].__setitem__("kind", "image"))
        self.assertFailsWith("video", PLAIN, "review_inputs_invalid")
        os.remove(self.fx.path("video_review", PLAIN))
        self.assertFailsWith("video", PLAIN, "review_missing")

    def test_unreadable_video_fails_probe(self):
        append(self.fx.path("video", PLAIN), b"not a video", "wb")
        new_sha = sha(self.fx.path("video", PLAIN))
        self.fx.edit_row(PLAIN, lambda r: r.__setitem__("videoSha256", new_sha))
        self.assertFailsWith("video", PLAIN, "probe_failed")

    def test_video_without_a_still_fails(self):
        os.remove(self.fx.path("still", PLAIN))
        item = self.assertFailsWith("video", PLAIN, "still_missing")
        self.assertIn("still_not_passed", codes(item))

    def test_video_file_can_point_at_a_silent_copy(self):
        os.makedirs(f"{self.fx.rc}/videos-silent", exist_ok=True)
        shutil.move(self.fx.path("video", PLAIN), f"{self.fx.rc}/videos-silent/{PLAIN}.mp4")
        self.assertFailsWith("video", PLAIN, "live_file_missing")
        self.fx.edit_row(PLAIN, lambda r: r.__setitem__("videoFile", f"videos-silent/{PLAIN}.mp4"))
        self.assertPasses("video", PLAIN)
        self.fx.edit_row(PLAIN, lambda r: r.__setitem__("videoFile", "../../outside.mp4"))
        self.assertFailsWith("video", PLAIN, "video_file_invalid")


class TestCommandLine(GateTestCase):
    def tree_state(self):
        state = {}
        for base, _, files in os.walk(self.fx.tmp):
            for name in files:
                p = os.path.join(base, name)
                st = os.stat(p)
                state[p] = (st.st_size, st.st_mtime_ns, sha(p))
        return state

    def test_cli_pass_exit_zero_and_text_output(self):
        r = self.fx.cli("square", PLAIN, REGISTERED)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn(f"PASS {PLAIN}", r.stdout)
        self.assertIn("2 checked, 2 PASS, 0 FAIL", r.stdout)

    def test_cli_failure_exit_one_json_and_summary(self):
        self.fx.edit("status", PLAIN, lambda o: o.__setitem__("state", "rework"))
        r = self.fx.cli("square", "--all", "--json")
        self.assertEqual(r.returncode, 1)
        out = json.loads(r.stdout)
        self.assertEqual(out["summary"]["checked"], 3)
        self.assertEqual(out["summary"]["fail"], 1)
        self.assertEqual(out["summary"]["states"], {"pass": 2, "rework": 1})
        self.assertEqual(out["summary"]["reasons"], {"state_not_pass": 1})
        bad = next(i for i in out["items"] if i["id"] == PLAIN)
        self.assertEqual(bad["reasons"], [{"code": "state_not_pass", "detail": "rework"}])
        r = self.fx.cli("square", "--all", "--summary")
        self.assertEqual(r.returncode, 1)
        self.assertNotIn("FAIL genesis", r.stdout)
        self.assertIn("state_not_pass", r.stdout)
        self.assertIn("rework", r.stdout)

    def test_cli_usage_errors(self):
        self.assertEqual(self.fx.cli("square").returncode, 2)
        self.assertEqual(self.fx.cli("square", PLAIN, "--all").returncode, 2)

    def test_veto_table_command_matches_the_constant(self):
        r = subprocess.run([sys.executable, GATE, "veto-table"], capture_output=True, text=True)
        out = json.loads(r.stdout)
        self.assertEqual(out["sha256"], g.VETO_TABLE_SHA256)
        self.assertEqual(g.canonical_sha256(out["table"]), g.VETO_TABLE_SHA256)

    def test_gate_is_read_only(self):
        before = self.tree_state()
        for kind in ("square", "still") + (("video",) if HAVE_FFMPEG else ()):
            self.fx.cli(kind, "--all", "--json")
            self.fx.cli(kind, "--all", "--summary")
        self.assertEqual(before, self.tree_state())


def tearDownModule():
    if MediaCache.dir:
        shutil.rmtree(MediaCache.dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
