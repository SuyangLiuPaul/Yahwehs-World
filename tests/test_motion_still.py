"""Unit tests for tools/scenes/motion_still.py.

Run:  python3 -m unittest tests/test_motion_still.py -v     (pytest also works)
Nothing here touches T7 or calls gate_check.py; every path is a temp folder and the gate
results are hand-made dicts. Clips are rendered small and short so the suite stays fast.
"""
import hashlib
import importlib.util
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("motion_still", ROOT / "tools" / "scenes" / "motion_still.py")
ms = importlib.util.module_from_spec(_spec)
sys.modules["motion_still"] = ms
_spec.loader.exec_module(ms)

HAVE_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))
SMALL = (320, 180)
SHORT = 2.0


def make_still(path, seed=0):
    img = Image.new("RGB", (1376, 768))
    draw = ImageDraw.Draw(img)
    for x in range(0, 1376, 8):
        draw.line([(x, 0), (x, 767)], fill=((x * 3 + seed) % 256, (x + 80) % 256, 140))
    draw.ellipse([300, 200, 700, 600], fill=(240, 220, 90))
    draw.rectangle([900, 100, 1250, 500], fill=(30, 60, 200))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, quality=92)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def gate_item(event_id, sha, passed=True):
    return {"id": event_id, "kind": "still", "pass": passed, "state": "pass" if passed else "rework",
            "reasons": [] if passed else [{"code": "state_not_pass"}], "measured": {"sha256": sha}}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="test_motion_still_"))
        self.paths = ms.Paths(str(self.tmp))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def still(self, event_id, seed=0):
        return make_still(Path(self.paths.still(event_id)), seed)

    def render(self, gate, **kw):
        return ms.render(self.paths, gate, size=SMALL, seconds=SHORT, log=lambda *_: None, **kw)


class PureTests(unittest.TestCase):
    def test_target_is_deterministic_and_known(self):
        for event_id in ("genesis-1-1", "exodus-14-21", "revelation-21-1"):
            self.assertEqual(ms.pick_target(event_id), ms.pick_target(event_id))
            self.assertIn(ms.pick_target(event_id), ms.TARGETS)

    def test_every_move_starts_at_full_frame_and_stays_gentle(self):
        graph = ms.filter_graph(ms.params_for("genesis-1-1"))
        self.assertIn("1+0.0800*(1-cos(PI*on/191))/2", graph)   # on=0 gives zoom 1 exactly
        self.assertLessEqual(ms.MAX_ZOOM, 1.10)
        self.assertIn("format=yuv420p", graph)

    def test_params_record_everything_that_changes_the_clip(self):
        p = ms.params_for("genesis-1-1")
        self.assertEqual(set(p), {"version", "size", "fps", "seconds", "maxZoom", "target", "easing"})
        self.assertEqual(p["size"], [1280, 720])
        self.assertEqual(p["seconds"], 8.0)


@unittest.skipUnless(HAVE_FFMPEG, "ffmpeg/ffprobe not installed")
class RenderTests(Base):
    def test_skips_stills_the_gate_does_not_pass(self):
        sha = self.still("genesis-1-1")
        out = self.render({"genesis-1-1": gate_item("genesis-1-1", sha, passed=False)})
        self.assertEqual(out, {"genesis-1-1": "skipped_still_not_pass"})
        self.assertFalse(os.path.exists(self.paths.clip("genesis-1-1")))

    def test_refuses_a_still_changed_after_the_gate_ran(self):
        sha = self.still("genesis-1-1")
        self.still("genesis-1-1", seed=7)                       # bytes change on disk
        out = self.render({"genesis-1-1": gate_item("genesis-1-1", sha)})
        self.assertEqual(out["genesis-1-1"], "failed_still_changed_since_gate")
        self.assertFalse(os.path.exists(self.paths.clip("genesis-1-1")))

    def test_dry_run_writes_nothing(self):
        sha = self.still("genesis-1-1")
        out = self.render({"genesis-1-1": gate_item("genesis-1-1", sha)}, dry_run=True)
        self.assertEqual(out["genesis-1-1"], "would_render")
        self.assertFalse(os.path.exists(self.paths.out))

    def test_rendered_clip_is_silent_right_length_and_starts_on_the_still(self):
        sha = self.still("exodus-14-21")
        out = self.render({"exodus-14-21": gate_item("exodus-14-21", sha)})
        self.assertEqual(out["exodus-14-21"], "rendered")
        info = ms.probe(self.paths.clip("exodus-14-21"))
        self.assertEqual(info["audioStreams"], 0)
        self.assertEqual(info["codec"], "h264")
        self.assertEqual([info["width"], info["height"]], list(SMALL))
        self.assertAlmostEqual(info["duration"], SHORT, delta=ms.DURATION_TOLERANCE)
        side = ms.read_sidecar(self.paths.sidecar("exodus-14-21"))
        self.assertEqual(side["schema"], ms.SCHEMA)
        self.assertEqual(side["sourceSha256"], sha)
        self.assertEqual(side["audio"], "none")
        self.assertEqual(side["sourceStill"], "images-live/exodus-14-21.jpg")
        self.assertEqual(ms.verify(self.paths, {"exodus-14-21": gate_item("exodus-14-21", sha)},
                                   ["exodus-14-21"]), {"exodus-14-21": []})

    def test_last_frame_is_pushed_in_not_a_copy_of_the_first(self):
        sha = self.still("genesis-1-1")
        self.render({"genesis-1-1": gate_item("genesis-1-1", sha)})
        clip = self.paths.clip("genesis-1-1")
        import subprocess, io
        last = subprocess.run(["ffmpeg", "-v", "error", "-sseof", "-0.1", "-i", clip, "-frames:v", "1",
                               "-f", "image2pipe", "-c:v", "png", "-"], capture_output=True, check=True).stdout
        a = list(ms.first_frame(clip).convert("L").tobytes())
        b = list(Image.open(io.BytesIO(last)).convert("L").tobytes())
        self.assertGreater(sum(abs(x - y) for x, y in zip(a, b)) / len(a), 1.0)

    def test_second_run_is_unchanged_and_force_rerenders(self):
        sha = self.still("genesis-1-1")
        gate = {"genesis-1-1": gate_item("genesis-1-1", sha)}
        self.render(gate)
        self.assertEqual(self.render(gate)["genesis-1-1"], "unchanged")
        self.assertEqual(self.render(gate, force=True)["genesis-1-1"], "rendered")

    def test_writes_only_inside_motion_live(self):
        sha = self.still("genesis-1-1")
        before = {p for p in self.tmp.rglob("*") if ms.OUT_DIR not in p.parts}
        self.render({"genesis-1-1": gate_item("genesis-1-1", sha)})
        after = {p for p in self.tmp.rglob("*") if ms.OUT_DIR not in p.parts}
        self.assertEqual(before, after)
        self.assertEqual(sorted(os.listdir(self.paths.out)), ["genesis-1-1.json", "genesis-1-1.mp4"])


@unittest.skipUnless(HAVE_FFMPEG, "ffmpeg/ffprobe not installed")
class VerifyTests(Base):
    def setUp(self):
        super().setUp()
        self.sha = self.still("genesis-1-1")
        self.render({"genesis-1-1": gate_item("genesis-1-1", self.sha)})

    def test_flags_a_still_that_no_longer_passes(self):
        res = ms.verify(self.paths, {"genesis-1-1": gate_item("genesis-1-1", self.sha, passed=False)},
                        ["genesis-1-1"])
        self.assertEqual(res["genesis-1-1"], ["source_not_pass"])

    def test_flags_a_still_replaced_after_rendering(self):
        res = ms.verify(self.paths, {"genesis-1-1": gate_item("genesis-1-1", "0" * 64)}, ["genesis-1-1"])
        self.assertIn("source_sha_changed", res["genesis-1-1"])

    def test_flags_a_tampered_clip(self):
        with open(self.paths.clip("genesis-1-1"), "ab") as f:
            f.write(b"\0")
        res = ms.verify(self.paths, {"genesis-1-1": gate_item("genesis-1-1", self.sha)}, ["genesis-1-1"])
        self.assertIn("clip_sha_mismatch", res["genesis-1-1"])

    def test_missing_sidecar(self):
        os.remove(self.paths.sidecar("genesis-1-1"))
        self.assertEqual(ms.verify(self.paths, {}, ["genesis-1-1"]), {"genesis-1-1": ["sidecar_missing"]})

    def test_clip_ids_lists_sidecars(self):
        self.assertEqual(ms.clip_ids(self.paths), ["genesis-1-1"])


if __name__ == "__main__":
    unittest.main()
