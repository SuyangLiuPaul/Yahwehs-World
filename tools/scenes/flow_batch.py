#!/usr/bin/env python3
"""flow_batch.py: realistic-cinema stills -> short silent videos in Google Flow (ASSISTED mode).

中文说明
========
用途：把写实剧照（images-live/<id>.jpg）当首帧，在 Google Flow 里做成短视频，
存成 videos-raw/<id>.mp4，再用 ffmpeg 去掉音轨另存静音版，并记下 SHA、durationSec、
生成前后的 Flow 点数（页面上看得到时）。

模式：**协助模式（assisted）**。脚本负责准备一切（首帧文件、提示词、输出命名、检查设置、
读点数、等待渲染、下载、去音轨、记账），但 **「Generate / Start generation」这一下必须由人
（或业主认可的 agent）在可见的 Flow 页面上亲手点**。脚本永远不点这个按钮。

为什么是协助模式（如实说明）：
- 旧 session（Antigravity「Yahweh Globe Video」，对话 99afec20…）在 10/17–10/18 用
  AppleScript 往 Flow 页面里执行 JS：execCommand("insertText") 填提示词、对按钮 .click()、
  再用 More options → Download → 720p 下载。那时能用，约 650 段视频是这样出的（纯文字生视频，
  没有用首帧）。
- 10/18 约 23:40 Flow 换了新前端（Angular + ProseMirror，flow.google.com），提交函数加了
  isTrusted 检查：脚本发出的点击不再被接受。旧 session 随后把 `_.tZ.prototype.submit` 改写成
  `{isTrusted: true}` 再调用原函数（借页面的 CSP nonce 和 Trusted Types policy 注入主世界脚本），
  后来还直接调内部的 setValue / submit。这就是**被禁止的绕过**：它绕开了网站的防机器人检查，
  会让业主的 Ultra 账号有被封的风险。
- 新前端下，旧 session 没有找到任何不绕过的自动提交方法。所以本脚本不自动提交。

用法：
    # 演练（默认）：检查 Chrome 里有没有已登录的 Flow 分页、找控件、读点数，绝不点 Generate
    python3 tools/scenes/flow_batch.py genesis-1-1
    # 协助模式实跑：脚本准备好之后，等人在 Flow 里粘贴首帧和提示词并点 Generate
    python3 tools/scenes/flow_batch.py --run genesis-1-1 exodus-2-1

禁止的做法（任何情况下都不许）：
- 改写、monkey-patch、包装页面上的任何函数（prototype、submit、setValue 等）；
- 伪造 isTrusted、往主世界注入 <script>、借用页面的 nonce 或 Trusted Types policy；
- 直接调用 Flow 的内部 API / 内部对象（default_AiSandboxAngularFrontend、__ngContext__ 等），
  或用 fetch 直接打它的接口；
- 把 Generate 按钮的 disabled 改掉，或由脚本去点 Generate；
- 登录、输入密码、接受对话框、修改 Flow 或账号设置（包括 "Return silent videos"、水印等）。
- 用 Chrome 之前必须拿锁 /Volumes/T7/yahwehs-globe-scenes/locks/chrome.lock；锁被占用就拒绝运行。

English
=======
Purpose: turn a realistic still (images-live/<id>.jpg, used as the first frame) into a short
Google Flow video, save it as videos-raw/<id>.mp4, strip the audio into a separate silent file
with ffmpeg, and record SHA-256, durationSec and the Flow credit balance before and after (when
the page shows it).

Mode: **ASSISTED**. The script prepares everything (first-frame file on the clipboard, the prompt
text on the clipboard, output names, a settings check, credit reading, render wait, download,
audio strip, bookkeeping). **A human, or an agent the owner has approved, clicks Generate in the
visible Flow UI.** The script never clicks Generate.

Why assisted (honest account):
- On 10/17-10/18 the old Antigravity session drove Flow with AppleScript `execute javascript`:
  `execCommand("insertText")` for the prompt, `.click()` on the button, and More options >
  Download > 720p to download. About 650 text-to-video clips were made that way (no first frame).
- About 23:40 on 10/18 Flow shipped a new front end (Angular + ProseMirror on flow.google.com).
  Its submit path checks `event.isTrusted`, so scripted clicks stopped working. The old session
  then injected a main-world script (re-using the page's CSP nonce and a Trusted Types policy),
  rewrote `_.tZ.prototype.submit` to call the original with `{isTrusted: true}`, and later called
  internal `setValue`/`submit` directly. That is the FORBIDDEN bypass: it defeats the site's bot
  check and puts the owner's Ultra account at risk.
- The old session found no compliant automated submit for the new UI, so this tool does not
  submit by itself.

Usage:
    python3 tools/scenes/flow_batch.py genesis-1-1              # --dry-run is the default
    python3 tools/scenes/flow_batch.py --run genesis-1-1        # assisted live run
    python3 tools/scenes/flow_batch.py --ids-file ids.txt --run

Forbidden, always: overriding / monkey-patching / wrapping any page function; faking isTrusted;
injecting main-world <script> tags or borrowing the page's nonce or Trusted Types policy; calling
Flow internals (default_AiSandboxAngularFrontend, __ngContext__, ...) or its endpoints with fetch;
un-disabling or clicking Generate from script; signing in, typing credentials, accepting dialogs,
changing Flow or account settings. Take /Volumes/T7/yahwehs-globe-scenes/locks/chrome.lock before
touching Chrome; refuse to run when someone else holds it.

Every JS snippet goes through `assert_js_allowed()` before it is executed, which rejects the
tokens above, and `click_by_label()` refuses Generate-like labels.

Durations: S tier 8 s, every other tier 6 s. The prompt's "N-second" wording is rewritten to
match, and a no-dialogue / no-voice-over clause is appended.

Exit codes: 0 ok, 2 bad input, 3 Chrome lock held, 4 browser precondition failed (Chrome or Flow
not open, not signed in, JS from Apple Events off), 5 run step failed.
"""
from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

TOOL_VERSION = "flow_batch/1.0 (assisted)"

SCENES_ROOT = Path("/Volumes/T7/yahwehs-globe-scenes")
CINEMA_ROOT = SCENES_ROOT / "realistic-cinema-v1"
IMAGES_LIVE = CINEMA_ROOT / "images-live"
PROMPTS_DIR = CINEMA_ROOT / "prompts"
MANIFEST_PATH = CINEMA_ROOT / "manifest.json"
VIDEOS_RAW = CINEMA_ROOT / "videos-raw"
VIDEOS_SILENT = CINEMA_ROOT / "videos-silent"
LOCK_PATH = SCENES_ROOT / "locks" / "chrome.lock"
LOCK_STALE_SECONDS = 30 * 60
DOWNLOADS_DIR = Path.home() / "Downloads"

FLOW_URL_MARKERS = ("labs.google/fx/tools/flow", "labs.google/flow", "flow.google.com")
TIER_SECONDS = {"S": 8}
DEFAULT_SECONDS = 6
DHASH_MATCH_MAX = 20  # out of 256 bits, same bar as gate_check.py

NO_VOICE_CLAUSE = (
    "Silent footage: no dialogue, no voice-over, no narration, no speech, no singing, "
    "no lip-synced talking; nobody speaks to camera. Ambient natural sound only."
)
VOICE_RISK_TERMS = ("dialogue", "voice-over", "voiceover", "narrat", "speaks", "speaking",
                    "says", "saying", "sings", "singing", "shouts", "proclaims", "announces")

EVENT_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)+$")

# Never executed: tokens that would indicate tampering with the page (see module doc).
FORBIDDEN_JS_PATTERNS = [
    r"isTrusted", r"prototype", r"defineProperty", r"__proto__", r"trustedTypes",
    r"createPolicy", r"nonce", r"__ngContext__", r"__reactProps", r"__reactFiber",
    r"default_AiSandboxAngularFrontend", r"window\.ng\b", r"\bfetch\s*\(", r"XMLHttpRequest",
    r"createElement\(\s*['\"]script", r"\.submit\s*\(", r"setValue\s*\(", r"_tZ", r"_saInst",
    r"\.disabled\s*=(?!=)", r"\beval\s*\(", r"new\s+Function\s*\(",
]
# Labels the tool must never click.
NEVER_CLICK_LABELS = ("start generation", "generate", "create", "send", "arrow_forward",
                      "sign in", "i agree", "accept", "agree", "continue", "upgrade",
                      "add ai credits", "sign out", "switch account")


class FlowBatchError(RuntimeError):
    exit_code = 5


class InputError(FlowBatchError):
    exit_code = 2


class LockHeld(FlowBatchError):
    exit_code = 3


class BrowserNotReady(FlowBatchError):
    exit_code = 4


# --------------------------------------------------------------------------- pure helpers

def duration_for_tier(tier: str | None) -> int:
    return TIER_SECONDS.get((tier or "").strip().upper(), DEFAULT_SECONDS)


def validate_event_id(event_id: str) -> str:
    eid = (event_id or "").strip()
    if not EVENT_ID_RE.match(eid):
        raise InputError(f"bad event id {event_id!r} (expected e.g. genesis-1-1)")
    return eid


def build_video_prompt(raw_prompt: str, seconds: int) -> str:
    """Normalise the duration wording and append the no-voice clause (idempotent)."""
    text = " ".join((raw_prompt or "").split())
    if not text:
        raise InputError("empty videoPrompt")
    text = re.sub(r"\b\d{1,2}-second\b", f"{seconds}-second", text)
    text = re.sub(r"\b\d{1,2} seconds?\b", f"{seconds} seconds", text)
    if NO_VOICE_CLAUSE not in text:
        text = f"{text} {NO_VOICE_CLAUSE}"
    return text


def voice_risk_terms(prompt: str) -> list[str]:
    body = prompt.replace(NO_VOICE_CLAUSE, "").lower()
    return [t for t in VOICE_RISK_TERMS if t in body]


def output_paths(event_id: str, out_dir: Path, silent_dir: Path) -> dict[str, Path]:
    eid = validate_event_id(event_id)
    return {
        "raw": Path(out_dir) / f"{eid}.mp4",
        "silent": Path(silent_dir) / f"{eid}.mp4",
        "record": Path(out_dir) / f"{eid}.flow.json",
    }


def load_event(event_id: str, prompts_dir: Path, images_dir: Path,
               manifest_path: Path | None = None) -> dict:
    """Read prompts/<id>.json (+ tier from manifest when the prompt lacks it)."""
    eid = validate_event_id(event_id)
    prompt_file = Path(prompts_dir) / f"{eid}.json"
    still = Path(images_dir) / f"{eid}.jpg"
    if not prompt_file.is_file():
        raise InputError(f"missing prompt file {prompt_file}")
    if not still.is_file():
        raise InputError(f"missing first-frame still {still}")
    data = json.loads(prompt_file.read_text(encoding="utf-8"))
    tier = data.get("tier")
    if not tier and manifest_path and Path(manifest_path).is_file():
        manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
        for ev in manifest.get("events", []):
            if ev.get("id") == eid:
                tier = ev.get("tier")
                break
    seconds = duration_for_tier(tier)
    prompt = build_video_prompt(data.get("videoPrompt", ""), seconds)
    return {"id": eid, "tier": tier, "seconds": seconds, "prompt": prompt,
            "promptFile": str(prompt_file), "still": str(still), "ref": data.get("ref")}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_credit_balance(text: str) -> int | None:
    m = re.search(r"(\d[\d,]*)\s*(?:Google\s+Flow\s+credits|AI\s+credits|credits\s+(?:left|remaining|available))",
                  text or "", re.I)
    return int(m.group(1).replace(",", "")) if m else None


def parse_generation_cost(text: str) -> int | None:
    m = re.search(r"Generating will use\s+(\d+)\s+credits?", text or "", re.I)
    return int(m.group(1)) if m else None


def assert_js_allowed(js: str) -> str:
    for pat in FORBIDDEN_JS_PATTERNS:
        if re.search(pat, js):
            raise FlowBatchError(f"refusing to run JS containing forbidden pattern {pat!r}")
    return js


def assert_click_allowed(label: str) -> str:
    norm = " ".join((label or "").lower().split())
    if not norm or any(norm == bad or norm.startswith(bad + " ") for bad in NEVER_CLICK_LABELS):
        raise FlowBatchError(f"refusing to click {label!r}")
    return label


# --------------------------------------------------------------------------- media helpers

def ffprobe_info(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "format=duration:stream=codec_type", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    info = json.loads(out)
    kinds = [s.get("codec_type") for s in info.get("streams", [])]
    return {"durationSec": round(float(info.get("format", {}).get("duration", 0.0)), 3),
            "videoStreams": kinds.count("video"), "audioStreams": kinds.count("audio")}


def strip_audio(src: Path, dst: Path) -> dict:
    """Copy the video stream only (no re-encode) into dst; keep src untouched."""
    src, dst = Path(src), Path(dst)
    if src.resolve() == dst.resolve():
        raise InputError("strip_audio: src and dst must differ (the original is kept)")
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.stem + ".part" + dst.suffix)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-map", "0:v:0",
                    "-c", "copy", "-an", "-movflags", "+faststart", str(tmp)], check=True)
    info = ffprobe_info(tmp)
    if info["audioStreams"] != 0 or info["videoStreams"] != 1:
        tmp.unlink(missing_ok=True)
        raise FlowBatchError(f"strip_audio produced unexpected streams: {info}")
    os.replace(tmp, dst)
    return info


def dhash_bits(image_path: Path, size: int = 16) -> int:
    from PIL import Image
    with Image.open(image_path) as im:
        g = im.convert("L").resize((size + 1, size))
        px = list(g.tobytes())
    bits = 0
    for row in range(size):
        for col in range(size):
            left, right = px[row * (size + 1) + col], px[row * (size + 1) + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return bits


def first_frame_distance(video: Path, still: Path) -> int:
    with tempfile.TemporaryDirectory() as td:
        frame = Path(td) / "f0.png"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-frames:v", "1",
                        str(frame)], check=True)
        return bin(dhash_bits(frame) ^ dhash_bits(still)).count("1")


# --------------------------------------------------------------------------- chrome lock

def _now() -> float:
    return time.time()


class ChromeLock:
    """JSON lock file shared by every session that drives Chrome.

    Stale after 30 minutes since the newer of startedAt / heartbeatAt. Long runs call
    heartbeat(). release() deletes the file only if it is still ours.
    """

    def __init__(self, path: Path = LOCK_PATH, session: str | None = None,
                 stale_seconds: int = LOCK_STALE_SECONDS, clock=_now):
        self.path = Path(path)
        self.session = session or f"flow_batch:{getpass.getuser()}@{socket.gethostname()}:{os.getpid()}"
        self.stale_seconds = stale_seconds
        self.clock = clock
        self.token = uuid.uuid4().hex
        self.held = False

    def read(self) -> dict | None:
        try:
            raw = self.path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return None
        try:
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError
        except ValueError:
            data = {"session": "<unparseable lock>", "startedAtEpoch": self.path.stat().st_mtime}
        return data

    def is_stale(self, data: dict) -> bool:
        stamps = [data.get("startedAtEpoch"), data.get("heartbeatAtEpoch")]
        stamps = [float(s) for s in stamps if isinstance(s, (int, float))]
        if not stamps:
            stamps = [self.path.stat().st_mtime]
        return self.clock() - max(stamps) > self.stale_seconds

    def _payload(self, started: float) -> dict:
        return {"session": self.session, "tool": TOOL_VERSION, "pid": os.getpid(),
                "host": socket.gethostname(), "token": self.token,
                "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(started)),
                "startedAtEpoch": started, "heartbeatAtEpoch": self.clock()}

    def acquire(self) -> dict | None:
        """Take the lock. Returns the stale lock that was replaced, if any."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        replaced = None
        existing = self.read()
        if existing is not None:
            if not self.is_stale(existing):
                raise LockHeld(f"Chrome lock {self.path} is held by {existing.get('session')!r} "
                               f"since {existing.get('startedAt', '?')}; refusing to run")
            replaced = existing
            self.path.unlink(missing_ok=True)
        payload = self._payload(self.clock())
        try:
            fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
        except FileExistsError as exc:
            raise LockHeld(f"Chrome lock {self.path} was taken concurrently") from exc
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
        self.held = True
        self._started = payload["startedAtEpoch"]
        return replaced

    def heartbeat(self) -> None:
        if not self.held:
            return
        cur = self.read() or {}
        if cur.get("token") != self.token:
            raise LockHeld("Chrome lock was taken over by another session")
        tmp = self.path.with_name(self.path.name + f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps(self._payload(self._started)), encoding="utf-8")
        os.replace(tmp, self.path)

    def release(self) -> bool:
        if not self.held:
            return False
        cur = self.read()
        self.held = False
        if cur and cur.get("token") == self.token:
            self.path.unlink(missing_ok=True)
            return True
        return False

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, *exc):
        self.release()


# --------------------------------------------------------------------------- AppleScript / Chrome

def run_osascript(script: str, timeout: int = 40) -> str:
    res = subprocess.run(["osascript", "-"], input=script, capture_output=True, text=True,
                         timeout=timeout)
    if res.returncode != 0:
        err = res.stderr.strip()
        if "turned off" in err and "JavaScript" in err:
            raise BrowserNotReady("Chrome's View > Developer > 'Allow JavaScript from Apple Events' is off; "
                                  "the owner must decide whether to turn it on (this tool will not)")
        raise FlowBatchError(f"osascript error: {err}")
    return res.stdout.rstrip("\n")


def applescript_str(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def chrome_running() -> bool:
    # `application "X" is running` does not launch Chrome.
    return run_osascript('return application "Google Chrome" is running') == "true"


def list_chrome_tabs() -> list[dict]:
    # Note: inside `tell application "Google Chrome"`, `tab` is Chrome's tab class, so the
    # separator is built as `character id 9` outside the tell block.
    script = '''
set sep to character id 9
set out to ""
tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      set out to out & ((id of w) as string) & sep & ((id of t) as string) & sep & (URL of t) & linefeed
    end repeat
  end repeat
end tell
return out'''
    return parse_tab_listing(run_osascript(script))


def parse_tab_listing(text: str) -> list[dict]:
    tabs = []
    for line in (text or "").splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3 and parts[0].isdigit() and parts[1].isdigit():
            tabs.append({"windowId": parts[0], "tabId": parts[1], "url": parts[2]})
    return tabs


def find_flow_tabs(tabs: list[dict]) -> list[dict]:
    return [t for t in tabs if any(m in t["url"] for m in FLOW_URL_MARKERS)]


class FlowTab:
    """One Chrome tab running Flow. Only allowed JS, only this tab."""

    def __init__(self, window_id: str, tab_id: str, url: str):
        self.window_id, self.tab_id, self.url = window_id, tab_id, url

    def js(self, code: str, timeout: int = 40):
        assert_js_allowed(code)
        markers = " or ".join(f"(u contains {applescript_str(m)})" for m in FLOW_URL_MARKERS)
        script = f'''
tell application "Google Chrome"
  set t to tab id {int(self.tab_id)} of window id {int(self.window_id)}
  set u to URL of t
  if not ({markers}) then return "__NOT_FLOW__"
  return execute t javascript {applescript_str(code)}
end tell'''
        out = run_osascript(script, timeout=timeout)
        if out == "__NOT_FLOW__":
            raise BrowserNotReady("the target tab is no longer on Flow; stopping")
        try:
            return json.loads(out)
        except ValueError:
            return out

    def click_by_label(self, label: str, exact: bool = True):
        assert_click_allowed(label)
        cmp = "a === L" if exact else "a.startsWith(L)"
        return self.js(f"""(() => {{
  const L = {json.dumps(label)};
  const el = Array.from(document.querySelectorAll('button,[role="button"],[role="menuitem"]'))
    .find(b => {{ const a = (b.getAttribute('aria-label') || '').trim(); return {cmp}; }});
  if (!el) return JSON.stringify({{clicked: false}});
  el.click();
  return JSON.stringify({{clicked: true}});
}})()""")

    def close_overlays(self):
        return self.js("""(() => {
  const bs = Array.from(document.querySelectorAll('.cdk-overlay-backdrop'));
  bs.forEach(b => b.click());
  return JSON.stringify({closed: bs.length});
})()""")


# Read-only probe of the Flow page (selectors from the old session's UI notes, both UIs).
PROBE_JS = r"""(() => {
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const lab = e => (e.getAttribute('aria-label') || '').trim();
  const btns = qa('button,a,[role="button"]');
  const byLabel = l => btns.find(b => lab(b) === l) || null;
  const editor = q('.ProseMirror[contenteditable="true"]') || q('[data-slate-editor="true"]') ||
                 q('[contenteditable="true"]') || q('textarea');
  const gen = byLabel('Start generation');
  const settings = byLabel('Settings trigger');
  const account = btns.find(b => lab(b).startsWith('Google Account:')) || byLabel('Account details');
  const signIn = btns.find(b => /^\s*sign in\s*$/i.test(b.innerText || ''));
  const bar = q('.prompt-ingredient-bar');
  const costEl = q('flow-credit-cost-label');
  const body = document.body ? document.body.innerText : '';
  const pct = qa('body *').filter(e => e.children.length === 0 && /^\d{1,3}%$/.test((e.innerText || '').trim())).length;
  const promptBox = q('.base-prompt-box') || q('flow-base-prompt-box') || (editor && editor.parentElement);
  return JSON.stringify({
    host: location.host, path: location.pathname,
    signedIn: !!account && !signIn && location.host !== 'accounts.google.com',
    signInVisible: !!signIn,
    editor: editor ? {found: true, tag: editor.tagName, cls: (editor.className || '').toString().slice(0, 60),
                      text: (editor.innerText || '').trim()} : {found: false},
    generateButton: gen ? {found: true, disabled: !!gen.disabled || gen.getAttribute('aria-disabled') === 'true'} : {found: false},
    settingsTrigger: settings ? (settings.innerText || '').replace(/\s+/g, ' ').trim() : null,
    addIngredients: !!byLabel('Add ingredients to the prompt box'),
    addMediaMenu: !!byLabel('Add media menu'),
    uploadsNav: btns.some(b => /\bUploads\b/.test(b.innerText || '')),
    fileInputs: qa('input[type="file"]').length,
    ingredientBar: bar ? {found: true, text: (bar.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
                          images: bar.querySelectorAll('img').length} : {found: false},
    promptBoxImages: promptBox ? promptBox.querySelectorAll('img').length : 0,
    costLabel: costEl ? (costEl.innerText || '').trim() : null,
    insufficientCredits: !!byLabel('Insufficient credits warning'),
    lowCreditsBanner: /running low on Google Flow credits/i.test(body),
    balanceText: (body.match(/\d[\d,]*\s*(?:Google\s+Flow\s+credits|AI\s+credits)/i) || [null])[0],
    progressPercents: pct,
    tiles: {pending: qa('flow-pending-tile').length, video: qa('flow-video-tile').length,
            hotbars: qa('.hotbar-inner').length, videos: qa('video').length,
            videoThumbs: qa('img[alt*="video" i]').length}
  });
})()"""

READ_OVERLAY_JS = r"""(() => JSON.stringify({
  text: Array.from(document.querySelectorAll('.cdk-overlay-pane')).map(p => p.innerText || '').join(' | ')
}))()"""

DOWNLOAD_STEP_JS = {
    # Mirrors the old session's non-bypass download path on the newest tile.
    "more": r"""(() => {
  const roots = Array.from(document.querySelectorAll('.hotbar-inner, flow-video-hotbar, flow-video-tile'));
  const root = roots.find(r => r.querySelector('button[aria-label="More options"]'));
  if (!root) return JSON.stringify({ok: false, why: 'no tile with More options'});
  root.querySelector('button[aria-label="More options"]').click();
  return JSON.stringify({ok: true});
})()""",
    "download": r"""(() => {
  const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
    .filter(el => (el.innerText || '').includes('Download') && el.offsetParent !== null);
  const dl = items[items.length - 1];
  if (!dl) return JSON.stringify({ok: false, why: 'no Download item'});
  dl.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
  dl.click();
  return JSON.stringify({ok: true});
})()""",
    "720p": r"""(() => {
  const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
    .filter(el => /720p|Original/.test(el.innerText || '') && el.offsetParent !== null);
  const it = items[items.length - 1];
  if (!it) return JSON.stringify({ok: false, why: 'no 720p item'});
  it.click();
  return JSON.stringify({ok: true, label: (it.innerText || '').replace(/\s+/g, ' ').trim()});
})()""",
}


def set_clipboard_text(text: str) -> None:
    subprocess.run(["pbcopy"], input=text, text=True, check=True)


def set_clipboard_image(path: Path) -> None:
    kind = "JPEG picture" if Path(path).suffix.lower() in (".jpg", ".jpeg") else "«class PNGf»"
    run_osascript(f'set the clipboard to (read (POSIX file {applescript_str(str(path))}) as {kind})')


# --------------------------------------------------------------------------- Flow session

def connect_flow(log) -> FlowTab:
    if not chrome_running():
        raise BrowserNotReady("Google Chrome is not running; open it and the Flow project yourself")
    tabs = list_chrome_tabs()
    flow = find_flow_tabs(tabs)
    log(f"chrome tabs: {len(tabs)}, flow tabs: {len(flow)}")
    if not flow:
        raise BrowserNotReady("no Google Flow tab is open in Chrome (open the Flow project, signed in, "
                              "then re-run; this tool never opens or signs in to Flow)")
    if len(flow) > 1:
        log(f"warning: {len(flow)} Flow tabs open; using the first ({flow[0]['url'][:80]})")
    return FlowTab(flow[0]["windowId"], flow[0]["tabId"], flow[0]["url"])


def probe(tab: FlowTab) -> dict:
    data = tab.js(PROBE_JS)
    if not isinstance(data, dict):
        raise BrowserNotReady(f"could not read the Flow page: {str(data)[:200]}")
    return data


def peek_settings(tab: FlowTab) -> dict:
    """Open the Settings popover, read it, close it. Changes nothing."""
    res = tab.click_by_label("Settings trigger")
    if not (isinstance(res, dict) and res.get("clicked")):
        return {"opened": False}
    time.sleep(0.8)
    text = (tab.js(READ_OVERLAY_JS) or {}).get("text", "")
    tab.close_overlays()
    return {"opened": True, "text": " ".join(text.split())[:600], "cost": parse_generation_cost(text)}


def read_balance(tab: FlowTab, page: dict | None = None) -> dict:
    """Credit balance if visible: passive page text first, then Flow's own account popover
    (only the Flow-native 'Account details' button, never the Google account switcher)."""
    page = page or probe(tab)
    bal = parse_credit_balance(page.get("balanceText") or "")
    if bal is not None:
        return {"balance": bal, "source": "page text"}
    res = tab.click_by_label("Account details")
    if isinstance(res, dict) and res.get("clicked"):
        time.sleep(0.6)
        text = (tab.js(READ_OVERLAY_JS) or {}).get("text", "")
        tab.close_overlays()
        bal = parse_credit_balance(text)
        if bal is not None:
            return {"balance": bal, "source": "account popover"}
    return {"balance": None, "source": "not visible",
            "lowCreditsBanner": page.get("lowCreditsBanner"),
            "insufficientCredits": page.get("insufficientCredits")}


def settings_match(trigger_text: str | None, seconds: int) -> list[str]:
    """Problems with the visible Settings trigger text for a video job of `seconds`."""
    t = trigger_text or ""
    problems = []
    if "Video" not in t:
        problems.append("mode is not Video")
    if "720p" not in t:
        problems.append("resolution is not 720p")
    if not re.search(rf"\b{seconds}s\b", t):
        problems.append(f"duration is not {seconds}s")
    if not re.search(r"\bx1\b", t):
        problems.append("output count is not x1")
    return problems


def wait_for(predicate, timeout: float, interval: float = 3.0, on_tick=None):
    deadline = time.time() + timeout
    while time.time() < deadline:
        val = predicate()
        if val:
            return val
        if on_tick:
            on_tick()
        time.sleep(interval)
    return None


def newest_download(downloads: Path, since: float, before: set[str]) -> Path | None:
    cands = [p for p in Path(downloads).glob("*.mp4")
             if str(p) not in before and p.stat().st_mtime >= since - 1]
    cands = [p for p in cands if not Path(str(p) + ".crdownload").exists()]
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


# --------------------------------------------------------------------------- modes

def prepare_events(ids, args, log) -> list[dict]:
    events = []
    for raw in ids:
        ev = load_event(raw, args.prompts_dir, args.images_dir, args.manifest)
        ev["paths"] = {k: str(v) for k, v in output_paths(ev["id"], args.out_dir, args.silent_dir).items()}
        ev["stillSha256"] = sha256_file(Path(ev["still"]))
        ev["promptSha256"] = hashlib.sha256(ev["prompt"].encode("utf-8")).hexdigest()
        ev["voiceRiskTerms"] = voice_risk_terms(ev["prompt"])
        if ev["voiceRiskTerms"]:
            log(f"[{ev['id']}] warning: prompt mentions {ev['voiceRiskTerms']} (review before generating)")
        events.append(ev)
        log(f"[{ev['id']}] tier={ev['tier']} -> {ev['seconds']}s; still sha {ev['stillSha256'][:12]}; "
            f"out {ev['paths']['raw']}")
    return events


def dry_run(events, args, log) -> dict:
    """Everything except submitting. Never clicks Generate."""
    report = {"mode": "dry-run", "tool": TOOL_VERSION, "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
              "events": [{k: e[k] for k in ("id", "tier", "seconds", "still", "stillSha256",
                                            "promptSha256", "voiceRiskTerms", "paths")} for e in events],
              "generateClicked": False}
    try:
        tab = connect_flow(log)
        report["flowTab"] = {"host": tab.url.split("/")[2] if "//" in tab.url else tab.url}
        page = probe(tab)
        report["page"] = {k: v for k, v in page.items() if k != "editor"}
        report["page"]["editorFound"] = page.get("editor", {}).get("found", False)
        if not page.get("signedIn"):
            raise BrowserNotReady("Flow tab does not look signed in; sign in yourself, then re-run")
        report["balanceBefore"] = read_balance(tab, page)
        report["settings"] = peek_settings(tab) if not args.no_settings_peek else {"opened": False}
        report["settingsProblems"] = {e["id"]: settings_match(page.get("settingsTrigger"), e["seconds"])
                                      for e in events}
        set_clipboard_image(Path(events[0]["still"]))
        report["clipboard"] = f"first frame of {events[0]['id']} placed on the clipboard (nothing pasted)"
        after = probe(tab)
        report["balanceAfter"] = read_balance(tab, after)
        b0, b1 = report["balanceBefore"]["balance"], report["balanceAfter"]["balance"]
        report["creditsChanged"] = None if b0 is None or b1 is None else b1 - b0
        report["tilesBefore"], report["tilesAfter"] = page.get("tiles"), after.get("tiles")
        report["ok"] = True
    except BrowserNotReady as exc:
        report["ok"] = False
        report["stoppedBecause"] = str(exc)
    report["finishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    return report


def human_step(msg: str, log) -> None:
    log("")
    log(">>> HUMAN STEP: " + msg)


def assisted_run(events, args, lock: ChromeLock, log) -> list[dict]:
    tab = connect_flow(log)
    page = probe(tab)
    if not page.get("signedIn"):
        raise BrowserNotReady("Flow tab does not look signed in; sign in yourself, then re-run")
    records = []
    for ev in events:
        raw = Path(ev["paths"]["raw"])
        if raw.exists() and not args.force:
            log(f"[{ev['id']}] {raw} exists; skipping (use --force to redo)")
            continue
        lock.heartbeat()
        started = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        bal0 = read_balance(tab)
        page = probe(tab)
        problems = settings_match(page.get("settingsTrigger"), ev["seconds"])
        # 1. first frame
        set_clipboard_image(Path(ev["still"]))
        imgs0 = page.get("ingredientBar", {}).get("images", 0) + page.get("promptBoxImages", 0)
        human_step(f"[{ev['id']}] In the Flow tab choose Video > Frames, 720p, {ev['seconds']}s, x1"
                   + (f" (now: {', '.join(problems)})" if problems else "")
                   + f". Put the FIRST FRAME in the first-frame slot: the still is on the clipboard"
                   f" (Cmd+V), file: {ev['still']}", log)
        got = wait_for(lambda: (lambda p: p.get("ingredientBar", {}).get("images", 0)
                                + p.get("promptBoxImages", 0) > imgs0)(probe(tab)),
                       timeout=args.step_timeout, on_tick=lock.heartbeat)
        if not got:
            raise FlowBatchError(f"[{ev['id']}] no first-frame image appeared in the prompt box")
        # 2. prompt text
        set_clipboard_text(ev["prompt"])
        human_step(f"[{ev['id']}] Click the prompt box, select all, paste (Cmd+V). "
                   f"The prompt ({len(ev['prompt'])} chars, ends with the no-voice clause) is on the clipboard.", log)
        want = " ".join(ev["prompt"].split())
        ok = wait_for(lambda: " ".join((probe(tab).get("editor", {}).get("text") or "").split()) == want,
                      timeout=args.step_timeout, on_tick=lock.heartbeat)
        if not ok:
            raise FlowBatchError(f"[{ev['id']}] prompt box text never matched the prepared prompt")
        cost = peek_settings(tab).get("cost")
        # 3. human clicks Generate
        before_tiles = probe(tab).get("tiles", {})
        human_step(f"[{ev['id']}] Check the cost (page says {cost if cost is not None else '?'} credits) "
                   f"and click Generate yourself. The script will not click it.", log)

        def submitted():
            p = probe(tab)
            t = p.get("tiles", {})
            return (p.get("progressPercents", 0) > 0 or t.get("pending", 0) > before_tiles.get("pending", 0)
                    or not (p.get("editor", {}).get("text") or "").strip())
        if not wait_for(submitted, timeout=args.step_timeout, on_tick=lock.heartbeat):
            raise FlowBatchError(f"[{ev['id']}] no sign that Generate was clicked")
        dl_before = {str(p) for p in Path(args.downloads_dir).glob("*.mp4")}
        t_submit = time.time()
        log(f"[{ev['id']}] generation started; waiting for render (up to {args.render_timeout}s)")
        time.sleep(10)
        wait_for(lambda: probe(tab).get("progressPercents", 1) == 0 and probe(tab).get("tiles", {}).get("pending", 0) == 0,
                 timeout=args.render_timeout, interval=8, on_tick=lock.heartbeat)
        # 4. download (UI menu, same non-bypass path the old session used) or by hand
        if not args.no_auto_download:
            for step in ("more", "download", "720p"):
                r = tab.js(DOWNLOAD_STEP_JS[step])
                log(f"[{ev['id']}] download step {step}: {r}")
                if not (isinstance(r, dict) and r.get("ok")):
                    break
                time.sleep(1.0)
        mp4 = wait_for(lambda: newest_download(Path(args.downloads_dir), t_submit, dl_before), timeout=20, interval=2)
        if not mp4:
            human_step(f"[{ev['id']}] Download the new video (More options > Download > 720p) into "
                       f"{args.downloads_dir}", log)
            mp4 = wait_for(lambda: newest_download(Path(args.downloads_dir), t_submit, dl_before),
                           timeout=args.step_timeout, interval=3, on_tick=lock.heartbeat)
        if not mp4:
            raise FlowBatchError(f"[{ev['id']}] no new .mp4 appeared in {args.downloads_dir}")
        records.append(finish_clip(ev, Path(mp4), args, started, bal0, read_balance(tab), cost, page, log))
    return records


def finish_clip(ev, downloaded: Path, args, started, bal0, bal1, cost, page, log) -> dict:
    raw, silent, rec_path = Path(ev["paths"]["raw"]), Path(ev["paths"]["silent"]), Path(ev["paths"]["record"])
    raw.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(downloaded), str(raw))
    info_raw = ffprobe_info(raw)
    info_silent = strip_audio(raw, silent)
    dist = first_frame_distance(raw, Path(ev["still"]))
    b0, b1 = bal0.get("balance"), bal1.get("balance")
    record = {
        "id": ev["id"], "tool": TOOL_VERSION, "mode": "assisted", "tier": ev["tier"],
        "durationSecRequested": ev["seconds"], "durationSec": info_raw["durationSec"],
        "raw": str(raw), "rawSha256": sha256_file(raw), "rawAudioStreams": info_raw["audioStreams"],
        "silent": str(silent), "silentSha256": sha256_file(silent), "audio": "none",
        "silentDurationSec": info_silent["durationSec"],
        "firstFrame": ev["still"], "firstFrameSha256": ev["stillSha256"],
        "firstFrameDhashDistance": dist, "firstFrameMatchesStill": dist <= DHASH_MATCH_MAX,
        "prompt": ev["prompt"], "promptSha256": ev["promptSha256"],
        "settingsTrigger": page.get("settingsTrigger"), "costLabelCredits": cost,
        "creditsBefore": b0, "creditsAfter": b1,
        "creditsSpent": (b0 - b1) if b0 is not None and b1 is not None else None,
        "generateClickedBy": "human (assisted mode)",
        "startedAt": started, "finishedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    rec_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(Path(args.out_dir) / "flow_batch_log.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    log(f"[{ev['id']}] saved {raw} ({record['durationSec']}s, sha {record['rawSha256'][:12]}), "
        f"silent {silent}, dHash {dist}, credits {b0} -> {b1}")
    return record


# --------------------------------------------------------------------------- CLI

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Google Flow stills->video, assisted mode (see module doc).")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", dest="run", action="store_false", help="default: check everything, never submit")
    mode.add_argument("--run", dest="run", action="store_true",
                      help="assisted live run: a human clicks Generate; spends Flow credits")
    p.set_defaults(run=False)
    p.add_argument("ids", nargs="*", help="event ids, e.g. genesis-1-1")
    p.add_argument("--ids-file", type=Path, help="file with one event id per line (# comments ok)")
    p.add_argument("--images-dir", type=Path, default=IMAGES_LIVE)
    p.add_argument("--prompts-dir", type=Path, default=PROMPTS_DIR)
    p.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    p.add_argument("--out-dir", type=Path, default=None,
                   help=f"raw videos (run default {VIDEOS_RAW}; dry-run default: a new temp folder)")
    p.add_argument("--silent-dir", type=Path, default=None, help=f"silent copies (run default {VIDEOS_SILENT})")
    p.add_argument("--downloads-dir", type=Path, default=DOWNLOADS_DIR)
    p.add_argument("--lock-path", type=Path, default=LOCK_PATH)
    p.add_argument("--session", default=None, help="name written into the Chrome lock")
    p.add_argument("--step-timeout", type=int, default=900, help="seconds to wait for each human step")
    p.add_argument("--render-timeout", type=int, default=1200)
    p.add_argument("--no-auto-download", action="store_true", help="always download by hand")
    p.add_argument("--no-settings-peek", action="store_true", help="dry run: do not open the Settings popover")
    p.add_argument("--force", action="store_true", help="redo ids whose videos-raw/<id>.mp4 exists")
    return p


def resolve_ids(args) -> list[str]:
    ids = list(args.ids)
    if args.ids_file:
        for line in Path(args.ids_file).read_text(encoding="utf-8").splitlines():
            line = line.split("#", 1)[0].strip()
            if line:
                ids.append(line)
    seen, out = set(), []
    for i in ids:
        i = validate_event_id(i)
        if i not in seen:
            seen.add(i)
            out.append(i)
    if not out:
        raise InputError("no event ids given")
    return out


def resolve_dirs(args) -> None:
    if args.out_dir is None:
        args.out_dir = VIDEOS_RAW if args.run else Path(tempfile.mkdtemp(prefix="flow_batch_dry_"))
    if args.silent_dir is None:
        args.silent_dir = VIDEOS_SILENT if args.run else Path(args.out_dir) / "silent"


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    log = lambda m: print(m, flush=True)  # noqa: E731
    lock = None
    try:
        ids = resolve_ids(args)
        resolve_dirs(args)
        events = prepare_events(ids, args, log)
        lock = ChromeLock(args.lock_path, args.session)
        replaced = lock.acquire()
        if replaced:
            log(f"replaced stale Chrome lock from {replaced.get('session')!r}")
        log(f"Chrome lock taken: {args.lock_path} ({lock.session})")
        if not args.run:
            report = dry_run(events, args, log)
            Path(args.out_dir).mkdir(parents=True, exist_ok=True)
            out = Path(args.out_dir) / "dry_run_report.json"
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            log(json.dumps(report, ensure_ascii=False, indent=2))
            log(f"report: {out}")
            return 0 if report.get("ok") else BrowserNotReady.exit_code
        Path(args.out_dir).mkdir(parents=True, exist_ok=True)
        assisted_run(events, args, lock, log)
        return 0
    except FlowBatchError as exc:
        log(f"STOP: {exc}")
        return exc.exit_code
    except KeyboardInterrupt:
        log("interrupted")
        return 130
    finally:
        if lock is not None and lock.release():
            log(f"Chrome lock released: {args.lock_path}")


if __name__ == "__main__":
    sys.exit(main())
