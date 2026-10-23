"""Unit tests for tools/scenes/flow_batch.py (non-browser parts).

Run:  python3 -m unittest tests/test_flow_batch.py -v     (pytest also works)
Nothing here touches Chrome, Flow or T7; every path is a temp folder.
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("flow_batch", ROOT / "tools" / "scenes" / "flow_batch.py")
fb = importlib.util.module_from_spec(_spec)
sys.modules["flow_batch"] = fb
_spec.loader.exec_module(fb)

HAVE_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))

OLD_BYPASS_SNIPPET = """(() => {
    const _ = window.default_AiSandboxAngularFrontend;
    const origSubmit = _.tZ.prototype.submit;
    _.tZ.prototype.submit = function(a) { return origSubmit.call(this, {isTrusted: true}); };
})()"""


class TmpDirCase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="test_flow_batch_"))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class DurationAndNaming(unittest.TestCase):
    def test_tiers(self):
        self.assertEqual(fb.duration_for_tier("S"), 8)
        self.assertEqual(fb.duration_for_tier("s "), 8)
        for t in ("A", "B", "", None, "X"):
            self.assertEqual(fb.duration_for_tier(t), 6)

    def test_event_ids(self):
        for ok in ("genesis-1-1", "1-chronicles-11-10", "song-of-songs-4-1"):
            self.assertEqual(fb.validate_event_id(ok), ok)
        for bad in ("", "genesis", "Genesis-1-1", "../etc-1-1", "genesis_1_1", "genesis-1-1.mp4", "a b-1"):
            with self.assertRaises(fb.InputError):
                fb.validate_event_id(bad)

    def test_output_paths(self):
        p = fb.output_paths("genesis-1-1", Path("/x/videos-raw"), Path("/x/videos-silent"))
        self.assertEqual(p["raw"], Path("/x/videos-raw/genesis-1-1.mp4"))
        self.assertEqual(p["silent"], Path("/x/videos-silent/genesis-1-1.mp4"))
        self.assertEqual(p["record"], Path("/x/videos-raw/genesis-1-1.flow.json"))
        with self.assertRaises(fb.InputError):
            fb.output_paths("../../evil-1-1x/..", Path("/x"), Path("/y"))


class Prompts(unittest.TestCase):
    RAW = 'Single-shot 12-second 65mm live-action cinema plate of "The Creation"; 12 seconds of slow push-in.'

    def test_duration_rewritten_and_clause_appended(self):
        out = fb.build_video_prompt(self.RAW, 8)
        self.assertIn("8-second", out)
        self.assertIn("8 seconds", out)
        self.assertNotIn("12-second", out)
        self.assertTrue(out.endswith(fb.NO_VOICE_CLAUSE))
        self.assertIn("no dialogue", out)
        self.assertIn("no voice-over", out)

    def test_idempotent(self):
        once = fb.build_video_prompt(self.RAW, 6)
        self.assertEqual(fb.build_video_prompt(once, 6), once)
        self.assertEqual(once.count(fb.NO_VOICE_CLAUSE), 1)

    def test_empty_prompt_rejected(self):
        with self.assertRaises(fb.InputError):
            fb.build_video_prompt("   ", 6)

    def test_voice_risk_terms(self):
        clean = fb.build_video_prompt(self.RAW, 6)
        self.assertEqual(fb.voice_risk_terms(clean), [])
        risky = fb.build_video_prompt("Moses speaks to the people, saying the law.", 6)
        self.assertIn("speaks", fb.voice_risk_terms(risky))


class LoadEvent(TmpDirCase):
    def _fixture(self, tier="S", with_still=True, manifest_tier=None):
        prompts, images = self.tmp / "prompts", self.tmp / "images-live"
        prompts.mkdir()
        images.mkdir()
        data = {"id": "genesis-1-1", "ref": "Genesis 1:1", "videoPrompt": "A 12-second shot."}
        if tier:
            data["tier"] = tier
        (prompts / "genesis-1-1.json").write_text(json.dumps(data))
        if with_still:
            (images / "genesis-1-1.jpg").write_bytes(b"\xff\xd8fake")
        manifest = self.tmp / "manifest.json"
        manifest.write_text(json.dumps({"events": [{"id": "genesis-1-1", "tier": manifest_tier}]}))
        return prompts, images, manifest

    def test_reads_prompt_and_tier(self):
        ev = fb.load_event("genesis-1-1", *self._fixture("S"))
        self.assertEqual((ev["tier"], ev["seconds"]), ("S", 8))
        self.assertIn("8-second", ev["prompt"])
        self.assertTrue(ev["still"].endswith("images-live/genesis-1-1.jpg"))

    def test_tier_falls_back_to_manifest(self):
        ev = fb.load_event("genesis-1-1", *self._fixture(tier=None, manifest_tier="A"))
        self.assertEqual((ev["tier"], ev["seconds"]), ("A", 6))

    def test_missing_still(self):
        with self.assertRaises(fb.InputError):
            fb.load_event("genesis-1-1", *self._fixture(with_still=False))

    def test_missing_prompt(self):
        prompts, images, manifest = self._fixture()
        with self.assertRaises(fb.InputError):
            fb.load_event("exodus-2-1", prompts, images, manifest)


class Parsing(unittest.TestCase):
    def test_balance(self):
        self.assertEqual(fb.parse_credit_balance("movie_filter_auto\n10,015 Google Flow credits\nUpgrade"), 10015)
        self.assertEqual(fb.parse_credit_balance("You have 250 AI credits"), 250)
        self.assertIsNone(fb.parse_credit_balance("You're running low on Google Flow credits."))
        self.assertIsNone(fb.parse_credit_balance(None))

    def test_cost(self):
        self.assertEqual(fb.parse_generation_cost("x4 Generating will use 12 credits"), 12)
        self.assertEqual(fb.parse_generation_cost("Generating will use 0 credits"), 0)
        self.assertIsNone(fb.parse_generation_cost("nothing"))

    def test_settings_match(self):
        self.assertEqual(fb.settings_match("Video · 720p · 8s crop_16_9 x1", 8), [])
        probs = fb.settings_match("Video · 720p · 8s crop_16_9 x2", 6)
        self.assertIn("duration is not 6s", probs)
        self.assertIn("output count is not x1", probs)
        self.assertEqual(len(fb.settings_match(None, 6)), 4)


class Guards(unittest.TestCase):
    def test_old_bypass_is_rejected(self):
        with self.assertRaises(fb.FlowBatchError):
            fb.assert_js_allowed(OLD_BYPASS_SNIPPET)
        for bad in ('window._saInst.setValue("x")', 'btn.disabled = false', 'document.querySelector("script[nonce]")',
                    'trustedTypes.createPolicy("p", {})', 'fetch("/api")', 'el.__ngContext__',
                    'new KeyboardEvent("keydown", {isTrusted: true})'):
            with self.assertRaises(fb.FlowBatchError, msg=bad):
                fb.assert_js_allowed(bad)

    def test_shipped_snippets_are_allowed(self):
        for js in [fb.PROBE_JS, fb.READ_OVERLAY_JS, *fb.DOWNLOAD_STEP_JS.values()]:
            self.assertEqual(fb.assert_js_allowed(js), js)

    def test_never_click_generate_or_dialogs(self):
        for bad in ("Start generation", "start  generation", "Generate", "Create", "Sign in", "I agree", ""):
            with self.assertRaises(fb.FlowBatchError, msg=bad):
                fb.assert_click_allowed(bad)
        for ok in ("Settings trigger", "Account details", "More options"):
            self.assertEqual(fb.assert_click_allowed(ok), ok)

    def test_tab_js_guard_runs_before_osascript(self):
        tab = fb.FlowTab("1", "2", "https://labs.google/fx/tools/flow/project/x")
        with mock.patch.object(fb, "run_osascript", side_effect=AssertionError("must not run")):
            with self.assertRaises(fb.FlowBatchError):
                tab.js(OLD_BYPASS_SNIPPET)
            with self.assertRaises(fb.FlowBatchError):
                tab.click_by_label("Start generation")

    def test_parse_tab_listing(self):
        text = "11\t12\thttps://labs.google/fx/tools/flow/project/a\n11\t13\tchrome://newtab/\n\ngarbage\n"
        tabs = fb.parse_tab_listing(text)
        self.assertEqual([(t["windowId"], t["tabId"]) for t in tabs], [("11", "12"), ("11", "13")])
        self.assertEqual(len(fb.find_flow_tabs(tabs)), 1)

    def test_tab_listing_script_uses_real_tab_character(self):
        # Regression: inside `tell application "Google Chrome"`, a bare `tab` is Chrome's tab
        # class, which made the listing come back empty.
        captured = {}
        with mock.patch.object(fb, "run_osascript", side_effect=lambda s, **k: captured.setdefault("s", s) and ""):
            fb.list_chrome_tabs()
        self.assertIn("character id 9", captured["s"])
        self.assertNotIn("& tab &", captured["s"])

    def test_find_flow_tabs(self):
        tabs = [{"windowId": "1", "tabId": "1", "url": "https://kdp.amazon.com/"},
                {"windowId": "1", "tabId": "2", "url": "https://labs.google/fx/tools/flow/project/abc"},
                {"windowId": "2", "tabId": "3", "url": "https://flow.google.com/project/def"}]
        self.assertEqual([t["tabId"] for t in fb.find_flow_tabs(tabs)], ["2", "3"])
        self.assertEqual(fb.find_flow_tabs(tabs[:1]), [])


class Cli(TmpDirCase):
    def test_default_is_dry_run(self):
        a = fb.build_parser().parse_args(["genesis-1-1"])
        self.assertFalse(a.run)
        self.assertTrue(fb.build_parser().parse_args(["--run", "genesis-1-1"]).run)
        self.assertFalse(fb.build_parser().parse_args(["--dry-run", "genesis-1-1"]).run)

    def test_run_and_dry_run_exclusive(self):
        with mock.patch("sys.stderr"), self.assertRaises(SystemExit):
            fb.build_parser().parse_args(["--run", "--dry-run", "genesis-1-1"])

    def test_ids_file_comments_and_dedupe(self):
        f = self.tmp / "ids.txt"
        f.write_text("# batch\ngenesis-1-1\n\nexodus-2-1  # S tier\ngenesis-1-1\n")
        a = fb.build_parser().parse_args(["mark-1-1", "--ids-file", str(f)])
        self.assertEqual(fb.resolve_ids(a), ["mark-1-1", "genesis-1-1", "exodus-2-1"])
        with self.assertRaises(fb.InputError):
            fb.resolve_ids(fb.build_parser().parse_args([]))

    def test_dry_run_writes_to_temp_not_t7(self):
        a = fb.build_parser().parse_args(["genesis-1-1"])
        fb.resolve_dirs(a)
        try:
            self.assertFalse(str(a.out_dir).startswith("/Volumes/T7"))
            self.assertTrue(Path(a.out_dir).is_dir())
        finally:
            shutil.rmtree(a.out_dir, ignore_errors=True)
        r = fb.build_parser().parse_args(["--run", "genesis-1-1"])
        fb.resolve_dirs(r)
        self.assertEqual(r.out_dir, fb.VIDEOS_RAW)
        self.assertEqual(r.silent_dir, fb.VIDEOS_SILENT)


class Lock(TmpDirCase):
    def test_acquire_writes_json_and_release_deletes(self):
        path = self.tmp / "locks" / "chrome.lock"
        lk = fb.ChromeLock(path, "test-session")
        self.assertIsNone(lk.acquire())
        data = json.loads(path.read_text())
        self.assertEqual(data["session"], "test-session")
        self.assertIn("startedAt", data)
        self.assertIsInstance(data["startedAtEpoch"], float)
        self.assertTrue(lk.release())
        self.assertFalse(path.exists())
        self.assertFalse(lk.release())

    def test_held_lock_refuses(self):
        path = self.tmp / "chrome.lock"
        a = fb.ChromeLock(path, "A")
        a.acquire()
        with self.assertRaises(fb.LockHeld):
            fb.ChromeLock(path, "B").acquire()
        self.assertEqual(json.loads(path.read_text())["session"], "A")
        a.release()

    def test_foreign_lock_without_token_is_respected(self):
        path = self.tmp / "chrome.lock"
        path.write_text(json.dumps({"session": "antigravity", "startedAtEpoch": time.time()}))
        with self.assertRaises(fb.LockHeld):
            fb.ChromeLock(path, "B").acquire()
        self.assertTrue(path.exists())

    def test_stale_after_30_minutes_is_replaced(self):
        path = self.tmp / "chrome.lock"
        now = [1_000_000.0]
        old = fb.ChromeLock(path, "old", clock=lambda: now[0])
        old.acquire()
        now[0] += 29 * 60
        with self.assertRaises(fb.LockHeld):
            fb.ChromeLock(path, "new", clock=lambda: now[0]).acquire()
        now[0] += 2 * 60
        new = fb.ChromeLock(path, "new", clock=lambda: now[0])
        replaced = new.acquire()
        self.assertEqual(replaced["session"], "old")
        self.assertEqual(json.loads(path.read_text())["session"], "new")
        self.assertFalse(old.release())  # not ours any more: must not delete it
        self.assertTrue(path.exists())
        self.assertTrue(new.release())

    def test_heartbeat_keeps_lock_fresh(self):
        path = self.tmp / "chrome.lock"
        now = [1_000_000.0]
        a = fb.ChromeLock(path, "A", clock=lambda: now[0])
        a.acquire()
        now[0] += 25 * 60
        a.heartbeat()
        now[0] += 25 * 60
        with self.assertRaises(fb.LockHeld):
            fb.ChromeLock(path, "B", clock=lambda: now[0]).acquire()
        self.assertEqual(json.loads(path.read_text())["startedAtEpoch"], 1_000_000.0)

    def test_unparseable_lock_uses_mtime(self):
        path = self.tmp / "chrome.lock"
        path.write_text("not json")
        with self.assertRaises(fb.LockHeld):
            fb.ChromeLock(path, "B").acquire()
        old = time.time() - 31 * 60
        os.utime(path, (old, old))
        lk = fb.ChromeLock(path, "B")
        self.assertEqual(lk.acquire()["session"], "<unparseable lock>")
        lk.release()

    def test_main_refuses_when_lock_held_without_touching_chrome(self):
        prompts, images = self.tmp / "prompts", self.tmp / "images"
        prompts.mkdir()
        images.mkdir()
        (prompts / "genesis-1-1.json").write_text(json.dumps({"tier": "S", "videoPrompt": "12-second shot"}))
        (images / "genesis-1-1.jpg").write_bytes(b"x")
        lock_path = self.tmp / "chrome.lock"
        holder = fb.ChromeLock(lock_path, "someone-else")
        holder.acquire()
        argv = ["genesis-1-1", "--prompts-dir", str(prompts), "--images-dir", str(images),
                "--manifest", str(self.tmp / "none.json"), "--lock-path", str(lock_path),
                "--out-dir", str(self.tmp / "out")]
        with mock.patch.object(fb, "run_osascript", side_effect=AssertionError("Chrome touched")), \
                mock.patch("builtins.print"):
            self.assertEqual(fb.main(argv), 3)
        self.assertEqual(json.loads(lock_path.read_text())["session"], "someone-else")
        holder.release()


@unittest.skipUnless(HAVE_FFMPEG, "ffmpeg/ffprobe not installed")
class Media(TmpDirCase):
    def _clip(self, name="clip.mp4", seconds=1):
        out = self.tmp / name
        subprocess.run(["ffmpeg", "-y", "-v", "error",
                        "-f", "lavfi", "-i", f"testsrc=size=160x90:rate=12:duration={seconds}",
                        "-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out)],
                       check=True)
        return out

    def test_strip_audio_keeps_original(self):
        src = self._clip()
        self.assertEqual(fb.ffprobe_info(src)["audioStreams"], 1)
        before = fb.sha256_file(src)
        dst = self.tmp / "silent" / "clip.mp4"
        info = fb.strip_audio(src, dst)
        self.assertEqual((info["audioStreams"], info["videoStreams"]), (0, 1))
        self.assertAlmostEqual(info["durationSec"], 1.0, delta=0.2)
        self.assertEqual(fb.sha256_file(src), before)
        self.assertEqual(fb.ffprobe_info(src)["audioStreams"], 1)
        self.assertFalse(list((self.tmp / "silent").glob("*.part*")))

    def test_strip_audio_refuses_in_place(self):
        src = self._clip()
        with self.assertRaises(fb.InputError):
            fb.strip_audio(src, src)

    def test_first_frame_distance(self):
        from PIL import Image
        clip = self._clip()
        still = self.tmp / "still.png"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(clip), "-frames:v", "1", str(still)], check=True)
        self.assertLessEqual(fb.first_frame_distance(clip, still), fb.DHASH_MATCH_MAX)
        other = self.tmp / "other.png"
        img = Image.linear_gradient("L").resize((160, 90)).rotate(90)
        img.save(other)
        self.assertGreater(fb.first_frame_distance(clip, other), fb.DHASH_MATCH_MAX)


class Downloads(TmpDirCase):
    def test_newest_download_ignores_old_and_partial(self):
        old = self.tmp / "old.mp4"
        old.write_bytes(b"1")
        before = {str(old)}
        t0 = time.time()
        part = self.tmp / "new.mp4"
        part.write_bytes(b"2")
        (self.tmp / "new.mp4.crdownload").write_bytes(b"")
        self.assertIsNone(fb.newest_download(self.tmp, t0, before))
        (self.tmp / "new.mp4.crdownload").unlink()
        self.assertEqual(fb.newest_download(self.tmp, t0, before), part)


if __name__ == "__main__":
    unittest.main()
