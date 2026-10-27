#!/usr/bin/env python3
"""Build and sync the /video/ subpage for https://yahwehs-scenes.netlify.app/video/
from /Volumes/T7/yahwehs-globe-scenes/realistic-cinema-v1/.

Never modifies the existing merged/text-free/raw asset directories.
"""
import json
import os
import shutil
import time
import re
import subprocess
import urllib.request
from PIL import Image

REPO_ROOT = "/Users/pliu0036/Documents/CodingProject/yahwehs-globe"
T7_ROOT = "/Volumes/T7/yahwehs-globe-scenes/realistic-cinema-v1"
SITE_DIR = os.path.realpath("/Users/pliu0036/Documents/CodingProject/assets-scenes/site-project/site")
VIDEO_SITE_DIR = os.path.join(SITE_DIR, "video")


def get_live_gemini_quota():
    """Query local Antigravity language_server for real-time Gemini quota & reset times."""
    state_path = os.path.join(T7_ROOT, "gemini_quota_state.json")
    state = {
        "weeklyBasePct": 55.2,  # 59.0% at 07:58 AEDT minus 3.8% used in the 07:58-10:40 AEDT window
        "currentWindowResetAt": "2026-10-18T04:40:11Z",
        "currentWindowRemainingFraction": 0.994,
        "weeklyResetAt": "2026-10-24T09:00:00+11:00",
    }
    if os.path.isfile(state_path):
        try:
            state.update(json.load(open(state_path, encoding="utf-8")))
        except Exception:
            pass

    live_frac = None
    live_reset = None
    try:
        ps_out = subprocess.check_output(["ps", "-ax", "-o", "pid=,command="], text=True, timeout=3)
        for line in ps_out.splitlines():
            if "language_server" in line and "--csrf_token" in line:
                parts = line.strip().split(None, 1)
                pid = parts[0]
                m_tok = re.search(r"--csrf_token\s+([0-9a-fA-F-]+)", line)
                if not m_tok:
                    continue
                csrf = m_tok.group(1)
                lsof_out = subprocess.check_output(
                    ["lsof", "-a", "-p", pid, "-iTCP", "-sTCP:LISTEN", "-P", "-n"],
                    text=True,
                    timeout=3,
                )
                ports = re.findall(r"127\.0\.0\.1:(\d+)\s+\(LISTEN\)", lsof_out)
                for port in reversed(ports):
                    for proto in ("http", "https"):
                        try:
                            url = f"{proto}://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/GetUserStatus"
                            req = urllib.request.Request(
                                url,
                                data=b'{"metadata":{"ideName":"antigravity","extensionName":"antigravity","locale":"en"}}',
                                headers={
                                    "Content-Type": "application/json",
                                    "Connect-Protocol-Version": "1",
                                    "x-codeium-csrf-token": csrf,
                                },
                                method="POST",
                            )
                            ctx = None
                            if proto == "https":
                                import ssl
                                ctx = ssl._create_unverified_context()
                            with urllib.request.urlopen(req, timeout=2, context=ctx) as resp:
                                data = json.loads(resp.read().decode("utf-8"))
                            configs = (
                                data.get("userStatus", {})
                                .get("cascadeModelConfigData", {})
                                .get("clientModelConfigs", [])
                            )
                            for c in configs:
                                if "gemini" in (c.get("modelId") or "").lower():
                                    qi = c.get("quotaInfo") or {}
                                    if "remainingFraction" in qi:
                                        live_frac = float(qi["remainingFraction"])
                                        live_reset = qi.get("resetTime") or state["currentWindowResetAt"]
                                        break
                            if live_frac is not None:
                                break
                        except Exception:
                            continue
                    if live_frac is not None:
                        break
                break
    except Exception:
        pass

    if live_frac is not None:
        if live_reset and live_reset != state.get("currentWindowResetAt"):
            # Previous 5h window rolled over; fold its used fraction into weeklyBasePct (1 5h window ≈ 10% weekly)
            prev_used = max(0.0, 1.0 - float(state.get("currentWindowRemainingFraction", 1.0)))
            state["weeklyBasePct"] = max(0.0, float(state.get("weeklyBasePct", 55.2)) - prev_used * 10.0)
            state["currentWindowResetAt"] = live_reset
        state["currentWindowRemainingFraction"] = live_frac
        try:
            with open(state_path, "w", encoding="utf-8") as sf:
                json.dump(state, sf, indent=2)
        except Exception:
            pass

    frac = float(state.get("currentWindowRemainingFraction", 0.994))
    five_hr_pct = int(round(max(0.0, min(100.0, frac * 100.0))))
    weekly_pct = int(round(max(0.0, min(100.0, float(state.get("weeklyBasePct", 55.2)) - (1.0 - frac) * 10.0))))
    return {
        "weeklyRemainingPct": weekly_pct,
        "fiveHourRemainingPct": five_hr_pct,
        "weeklyResetAt": state.get("weeklyResetAt", "2026-10-24T09:00:00+11:00"),
        "fiveHourResetAt": state.get("currentWindowResetAt", "2026-10-18T04:40:11Z"),
        "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

BOOKS = [
    {"b": 1, "zh": "创世记", "en": "Genesis"}, {"b": 2, "zh": "出埃及记", "en": "Exodus"},
    {"b": 3, "zh": "利未记", "en": "Leviticus"}, {"b": 4, "zh": "民数记", "en": "Numbers"},
    {"b": 5, "zh": "申命记", "en": "Deuteronomy"}, {"b": 6, "zh": "约书亚记", "en": "Joshua"},
    {"b": 7, "zh": "士师记", "en": "Judges"}, {"b": 8, "zh": "路得记", "en": "Ruth"},
    {"b": 9, "zh": "撒母耳记上", "en": "1 Samuel"}, {"b": 10, "zh": "撒母耳记下", "en": "2 Samuel"},
    {"b": 11, "zh": "列王纪上", "en": "1 Kings"}, {"b": 12, "zh": "列王纪下", "en": "2 Kings"},
    {"b": 13, "zh": "历代志上", "en": "1 Chronicles"}, {"b": 14, "zh": "历代志下", "en": "2 Chronicles"},
    {"b": 15, "zh": "以斯拉记", "en": "Ezra"}, {"b": 16, "zh": "尼希米记", "en": "Nehemiah"},
    {"b": 17, "zh": "以斯帖记", "en": "Esther"}, {"b": 18, "zh": "约伯记", "en": "Job"},
    {"b": 19, "zh": "诗篇", "en": "Psalms"}, {"b": 20, "zh": "箴言", "en": "Proverbs"},
    {"b": 21, "zh": "传道书", "en": "Ecclesiastes"}, {"b": 22, "zh": "雅歌", "en": "Song of Songs"},
    {"b": 23, "zh": "以赛亚书", "en": "Isaiah"}, {"b": 24, "zh": "耶利米书", "en": "Jeremiah"},
    {"b": 25, "zh": "耶利米哀歌", "en": "Lamentations"}, {"b": 26, "zh": "以西结书", "en": "Ezekiel"},
    {"b": 27, "zh": "但以理书", "en": "Daniel"}, {"b": 28, "zh": "何西阿书", "en": "Hosea"},
    {"b": 29, "zh": "约珥书", "en": "Joel"}, {"b": 30, "zh": "阿摩司书", "en": "Amos"},
    {"b": 31, "zh": "俄巴底亚书", "en": "Obadiah"}, {"b": 32, "zh": "约拿书", "en": "Jonah"},
    {"b": 33, "zh": "弥迦书", "en": "Micah"}, {"b": 34, "zh": "那鸿书", "en": "Nahum"},
    {"b": 35, "zh": "哈巴谷书", "en": "Habakkuk"}, {"b": 36, "zh": "西番雅书", "en": "Zephaniah"},
    {"b": 37, "zh": "哈该书", "en": "Haggai"}, {"b": 38, "zh": "撒迦利亚书", "en": "Zechariah"},
    {"b": 39, "zh": "玛拉基书", "en": "Malachi"}, {"b": 40, "zh": "马太福音", "en": "Matthew"},
    {"b": 41, "zh": "马可福音", "en": "Mark"}, {"b": 42, "zh": "路加福音", "en": "Luke"},
    {"b": 43, "zh": "约翰福音", "en": "John"}, {"b": 44, "zh": "使徒行传", "en": "Acts"},
    {"b": 45, "zh": "罗马书", "en": "Romans"}, {"b": 46, "zh": "哥林多前书", "en": "1 Corinthians"},
    {"b": 47, "zh": "哥林多后书", "en": "2 Corinthians"}, {"b": 48, "zh": "加拉太书", "en": "Galatians"},
    {"b": 49, "zh": "以弗所书", "en": "Ephesians"}, {"b": 50, "zh": "腓立比书", "en": "Philippians"},
    {"b": 51, "zh": "歌罗西书", "en": "Colossians"}, {"b": 52, "zh": "帖撒罗尼迦前书", "en": "1 Thessalonians"},
    {"b": 53, "zh": "帖撒罗尼迦后书", "en": "2 Thessalonians"}, {"b": 54, "zh": "提摩太前书", "en": "1 Timothy"},
    {"b": 55, "zh": "提摩太后书", "en": "2 Timothy"}, {"b": 56, "zh": "提多书", "en": "Titus"},
    {"b": 57, "zh": "腓利门书", "en": "Philemon"}, {"b": 58, "zh": "希伯来书", "en": "Hebrews"},
    {"b": 59, "zh": "雅各书", "en": "James"}, {"b": 60, "zh": "彼得前书", "en": "1 Peter"},
    {"b": 61, "zh": "彼得后书", "en": "2 Peter"}, {"b": 62, "zh": "约翰一书", "en": "1 John"},
    {"b": 63, "zh": "约翰二书", "en": "2 John"}, {"b": 64, "zh": "约翰三书", "en": "3 John"},
    {"b": 65, "zh": "犹大书", "en": "Jude"}, {"b": 66, "zh": "启示录", "en": "Revelation"},
]


def ensure_jpg_and_thumb(src_path, full_dst, thumb_dst, full_w=1672, thumb_w=480):
    if not os.path.isfile(src_path):
        return False
    src_mtime = os.path.getmtime(src_path)
    if not os.path.isfile(full_dst) or os.path.getmtime(full_dst) < src_mtime:
        im = Image.open(src_path).convert("RGB")
        if im.width > full_w:
            h = int(round(im.height * (full_w / im.width)))
            im = im.resize((full_w, h), Image.LANCZOS)
        os.makedirs(os.path.dirname(full_dst), exist_ok=True)
        im.save(full_dst, quality=88, optimize=True)
    if not os.path.isfile(thumb_dst) or os.path.getmtime(thumb_dst) < src_mtime:
        im = Image.open(src_path).convert("RGB")
        h = int(round(im.height * (thumb_w / im.width)))
        im = im.resize((thumb_w, h), Image.LANCZOS)
        os.makedirs(os.path.dirname(thumb_dst), exist_ok=True)
        im.save(thumb_dst, quality=82, optimize=True)
    return True


HTML_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>写实影视圣经 · 1,443 事件剧照与动态视频看板 | Yahweh's World</title>
<link rel="icon" href="../favicon.png">
<style>
:root{
  --bg:#0b1119;--panel:#131d2b;--panel2:#1a273a;--ink:#f2ecdd;--mute:#9aa8bc;--line:rgba(232,197,90,.24);
  --gold:#e8c55a;--gold-bright:#f7df8b;--ok:#4eb870;--vid:#3b9eff;--todo:#2a364b;--shadow:0 8px 28px rgba(0,0,0,.45);
}
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif;background:var(--bg);color:var(--ink)}
.site-switcher{background:#070b11;border-bottom:1px solid var(--line);padding:10px 20px}
.site-switcher-in{max-width:1760px;margin:auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.nav-tabs{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nav-tab{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;color:var(--ink);background:var(--panel);border:1px solid var(--line);transition:all .15s}
.nav-tab:hover{border-color:var(--gold);background:rgba(232,197,90,.14);color:var(--gold-bright)}
.nav-tab.active{background:linear-gradient(135deg,#e8c55a,#c89b2c);color:#0b1119;border-color:var(--gold-bright);box-shadow:0 2px 12px rgba(232,197,90,.3)}
.ext-links{display:flex;flex-wrap:wrap;gap:8px}
.ext-links a{color:var(--gold-bright);text-decoration:none;border:1px solid var(--line);background:rgba(21,31,46,.75);padding:6px 12px;border-radius:999px;font-size:12.5px}
.ext-links a:hover{background:rgba(232,197,90,.16);border-color:var(--gold)}

header{max-width:1760px;margin:auto;padding:20px 20px 12px}
.brand-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px}
h1{font-size:clamp(20px,2.3vw,27px);margin:0;color:var(--gold-bright);display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
h1 small{font-size:13px;color:var(--mute);font-weight:400}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:10px;margin:14px 0 8px}
.stat{background:var(--panel);border:1.5px solid var(--line);border-radius:12px;padding:11px 15px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,border-color .12s,background .12s;user-select:none}
.stat:hover{border-color:var(--gold);transform:translateY(-1px)}
.stat.on{border-color:var(--gold-bright);background:rgba(232,197,90,.13);box-shadow:0 0 0 2px rgba(232,197,90,.28),var(--shadow)}
.stat b{display:block;font-size:24px;line-height:1.15;color:var(--gold-bright)}
.stat span{color:var(--mute);font-size:12.5px}

.eta-panel{background:linear-gradient(135deg,rgba(19,29,43,.96),rgba(26,39,58,.92));border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0 10px;box-shadow:var(--shadow);display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}
.eta-col{display:flex;flex-direction:column;gap:7px;background:rgba(11,17,25,.42);border:1px solid rgba(232,197,90,.16);border-radius:10px;padding:11px 13px}
.gemini-card{background:#121316;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:13px 16px;display:flex;flex-direction:column;justify-content:space-between;gap:10px}
.gemini-title{color:#8e9196;font-size:13px;font-weight:500;margin:0 0 2px;display:flex;justify-content:space-between;align-items:center}
.gemini-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:3px 0}
.gemini-row-main{display:flex;flex-direction:column;gap:1px}
.gemini-row-main b{color:#e3e3e3;font-size:15px;font-weight:500;letter-spacing:.1px}
.gemini-row-main span{color:#8e9196;font-size:13px}
.gemini-ring-wrap{display:inline-flex;align-items:center;gap:10px;font-size:15px;font-weight:500;color:#e3e3e3;font-variant-numeric:tabular-nums}
.gemini-ring{width:22px;height:22px;transform:rotate(-90deg)}
.eta-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
.eta-head b{color:var(--gold-bright);font-size:13.5px}
.eta-head span{color:var(--ink);font-size:12.5px;font-weight:600}
.pbar-group{display:flex;flex-direction:column;gap:6px;margin:2px 0}
.pbar-row{display:grid;grid-template-columns:152px 1fr 122px;align-items:center;gap:8px;font-size:12px}
.pbar-lbl{color:var(--ink);font-weight:600;white-space:nowrap;display:flex;align-items:center;gap:5px}
.pbar-lbl.plan{color:var(--gold-bright);font-weight:500}
.pbar-track{height:11px;background:rgba(8,12,18,.9);border-radius:999px;overflow:hidden;border:1px solid rgba(232,197,90,.24);position:relative}
.pbar-fill-actual-img{height:100%;background:linear-gradient(90deg,#3fa862,#6fd98e,#e8c55a);border-radius:999px;transition:width .35s}
.pbar-fill-actual-vid{height:100%;background:linear-gradient(90deg,#2b86e5,#5eb5ff,#8fd0ff);border-radius:999px;transition:width .35s}
.pbar-fill-plan{height:100%;background:repeating-linear-gradient(135deg,rgba(232,197,90,.78) 0 6px,rgba(232,197,90,.38) 6px 12px);border-radius:999px;transition:width .35s}
.pbar-marker{position:absolute;top:-2px;bottom:-2px;width:2px;background:#fff;box-shadow:0 0 6px #fff;z-index:2;pointer-events:none}
.pbar-val{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink);font-weight:600;white-space:nowrap}
.pbar-val.plan{color:var(--gold-bright)}
.delta-pill{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:700}
.delta-pill.ahead{background:rgba(78,184,112,.2);color:#75e898;border:1px solid rgba(78,184,112,.5)}
.delta-pill.behind{background:rgba(232,197,90,.18);color:var(--gold-bright);border:1px solid rgba(232,197,90,.45)}
.eta-meta{color:var(--mute);font-size:12px;line-height:1.45;display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;padding-top:2px;border-top:1px dashed rgba(232,197,90,.14)}
.eta-meta strong{color:var(--ink)}

.tier-legend{background:rgba(19,29,43,.88);border:1px solid var(--line);border-radius:11px;padding:9px 13px;margin:8px 0 8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:9px;box-shadow:var(--shadow)}
.tier-box{display:flex;align-items:flex-start;gap:9px;padding:7px 10px;border-radius:8px;background:rgba(11,17,25,.55);border:1px solid rgba(232,197,90,.18);cursor:pointer;transition:all .14s}
.tier-box:hover,.tier-box.on{border-color:var(--gold-bright);background:rgba(232,197,90,.13)}
.tier-badge{font-size:12px;font-weight:800;padding:3px 9px;border-radius:6px;white-space:nowrap;line-height:1.25}
.tier-badge.S{background:linear-gradient(135deg,#e8c55a,#c89b2c);color:#0b1119}
.tier-badge.A{background:rgba(59,158,255,.22);color:#82c6ff;border:1px solid rgba(59,158,255,.55)}
.tier-badge.B{background:rgba(154,168,188,.18);color:#d0dae8;border:1px solid rgba(154,168,188,.4)}
.tier-desc{font-size:12px;line-height:1.4;color:var(--mute)}
.tier-desc b{color:var(--gold-bright);display:block;font-size:12.5px;margin-bottom:1px}

.view-pills{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px}
.pill-btn{font:inherit;font-size:13px;padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .14s}
.pill-btn:hover{border-color:var(--gold);color:var(--gold-bright)}
.pill-btn.on{background:var(--gold);color:#0b1119;border-color:var(--gold-bright);font-weight:700}
.pill-btn small{opacity:.82;font-size:11.5px}

.bar{position:sticky;top:0;z-index:20;background:rgba(11,17,25,.95);backdrop-filter:blur(12px);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:10px 20px}
.bar-in{max-width:1760px;margin:auto;display:flex;flex-wrap:wrap;gap:9px;align-items:center}
.search-wrap{position:relative;display:inline-flex;align-items:center}
.search-wrap input{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 28px 7px 11px;width:230px}
.search-wrap input:focus,select:focus{outline:none;border-color:var(--gold)}
.search-clear{position:absolute;right:7px;background:none;border:0;color:var(--mute);cursor:pointer;font-size:14px;display:none;padding:2px 4px}
.search-clear.show{display:block}
select{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 10px;cursor:pointer}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{font:inherit;font-size:13px;color:var(--ink);background:var(--panel);border:0;border-right:1px solid var(--line);padding:7px 12px;cursor:pointer}
.seg button:last-child{border-right:0}
.seg button.on{background:var(--gold);color:#111;font-weight:600}
.size-lbl{display:inline-flex;align-items:center;gap:6px;color:var(--mute);font-size:12.5px}
.reset-btn{font:inherit;font-size:12.5px;padding:6px 11px;border-radius:8px;border:1px solid rgba(232,197,90,.45);background:rgba(232,197,90,.12);color:var(--gold-bright);cursor:pointer;display:none}
.reset-btn.show{display:inline-flex;align-items:center;gap:4px}
.reset-btn:hover{background:rgba(232,197,90,.24)}
.count{margin-left:auto;color:var(--gold-bright);font-size:13px;font-weight:600}

details.books-drawer{max-width:1760px;margin:10px auto 0;padding:0 20px}
details.books-drawer summary{cursor:pointer;color:var(--gold-bright);font-size:13px;user-select:none;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;background:var(--panel);border:1px solid var(--line)}
.bk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:6px;margin-top:10px}
.bk-btn{font:inherit;color:var(--ink);text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 9px 8px;cursor:pointer;position:relative;overflow:hidden;transition:border-color .12s}
.bk-btn:hover{border-color:var(--gold)}
.bk-btn.on{border-color:var(--gold-bright);background:rgba(232,197,90,.15);box-shadow:0 0 0 1px var(--gold)}
.bk-btn b{display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bk-btn em{font-style:normal;font-size:11px;color:var(--mute)}
.bk-btn .bar-fill{position:absolute;left:0;bottom:0;height:3px;background:var(--ok)}

main{max-width:1760px;margin:auto;padding:14px 20px 60px}
.notice-banner{margin:0 0 14px;padding:10px 14px;border-radius:10px;background:rgba(232,197,90,.12);border:1px solid var(--gold);color:var(--gold-bright);font-size:13px;display:none;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.notice-banner.show{display:flex}
.notice-banner button{font:inherit;font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid var(--gold);background:var(--panel);color:var(--gold-bright);cursor:pointer}

.sec-title{margin:18px 0 12px;font-size:16.5px;color:var(--gold-bright);display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid var(--line);padding-bottom:6px;flex-wrap:wrap}
.sec-title small{color:var(--mute);font-size:12.5px;font-weight:400}
.anchor-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px;margin-bottom:24px}
.anchor-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;box-shadow:var(--shadow);cursor:pointer;transition:transform .14s,border-color .14s}
.anchor-card:hover,.anchor-card.on{border-color:var(--gold-bright);transform:translateY(-2px)}
.anchor-card .im{aspect-ratio:1/1;background:var(--panel2);position:relative}
.anchor-card.loc .im{aspect-ratio:16/9}
.anchor-card img{width:100%;height:100%;object-fit:cover;display:block}
.anchor-card .meta{padding:8px 10px}
.anchor-card .meta b{display:block;font-size:13px;color:var(--gold-bright)}
.anchor-card .meta span{display:block;font-size:11.5px;color:var(--mute)}
.anchor-card .act-row{display:flex;gap:6px;margin-top:6px}
.anchor-card .act-row button{flex:1;font:inherit;font-size:11px;padding:3px 6px;border-radius:5px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);cursor:pointer}
.anchor-card .act-row button:hover{border-color:var(--gold);color:var(--gold-bright)}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--w,285px),1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;cursor:pointer;transition:border-color .15s,transform .15s}
.card:hover{border-color:var(--gold);transform:translateY(-2px)}
.card .im{aspect-ratio:16/9;background:var(--panel2);position:relative;overflow:hidden}
.card img,.card video{width:100%;height:100%;object-fit:cover;display:block}
.card .ph{position:absolute;inset:0;display:grid;place-items:center;color:var(--mute);font-size:12px;padding:10px;text-align:center;background:rgba(11,17,25,.45)}
.badge-row{position:absolute;top:8px;left:8px;right:8px;display:flex;justify-content:space-between;pointer-events:none;gap:6px}
.tag{font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;background:rgba(11,17,25,.84);color:var(--ink);border:1px solid var(--line)}
.tag.img-ok{background:rgba(78,184,112,.92);color:#fff;border-color:transparent}
.tag.vid-ok{background:rgba(59,158,255,.95);color:#fff;border-color:transparent}
.tag.tier-S{border-color:var(--gold);color:var(--gold-bright)}
.card .body{padding:10px 12px 12px}
.card .body b{display:block;font-size:14px;color:var(--gold-bright);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .body .sub{display:block;font-size:12px;color:var(--ink);opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .body .ref{display:block;font-size:11.5px;color:var(--mute);margin-top:3px}
.empty-state{padding:48px 20px;text-align:center;color:var(--mute);background:var(--panel);border:1px dashed var(--line);border-radius:12px;margin-top:12px}
.empty-state button{margin-top:10px;font:inherit;padding:7px 14px;border-radius:8px;border:1px solid var(--gold);background:rgba(232,197,90,.15);color:var(--gold-bright);cursor:pointer}

#lb{position:fixed;inset:0;background:rgba(6,9,15,.93);z-index:60;display:none;grid-template-columns:1fr 390px}
#lb.show{display:grid}
#lb .stage{display:grid;place-items:center;padding:20px;position:relative;min-width:0}
#lb .stage img,#lb .stage video{max-width:100%;max-height:calc(100vh - 48px);border-radius:10px;box-shadow:0 12px 48px rgba(0,0,0,.75)}
#lb aside{background:var(--panel);border-left:1px solid var(--line);padding:20px;overflow-y:auto}
#lb aside h2{margin:0 0 4px;color:var(--gold-bright);font-size:20px}
#lb aside .en{color:var(--mute);margin-bottom:8px;font-size:14px}
#lb aside .ref-pill{display:inline-block;background:rgba(232,197,90,.14);border:1px solid var(--line);color:var(--gold-bright);padding:3px 10px;border-radius:999px;font-size:12.5px;margin-bottom:10px}
#lb .mode-tabs{display:flex;gap:8px;margin:10px 0 14px;flex-wrap:wrap}
#lb .mode-tabs button{font:inherit;font-size:12.5px;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);cursor:pointer}
#lb .mode-tabs button.on{background:var(--gold);color:#111;font-weight:600}
#lb .nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:rgba(13,19,28,.8);color:var(--gold-bright);font-size:26px;cursor:pointer}
#lb .prev{left:14px}#lb .next{right:14px}
#lb .close{position:absolute;top:14px;right:16px;font-size:22px;background:rgba(13,19,28,.8);border:1px solid var(--line);color:var(--ink);width:38px;height:38px;border-radius:50%;cursor:pointer}
@media(max-width:860px){
  #lb{grid-template-columns:1fr;grid-template-rows:52vh 1fr}
  .search-wrap,.search-wrap input{width:100%}
  .count{margin-left:0}
}
</style>
</head>
<body>
<nav class="site-switcher" aria-label="站点导航">
  <div class="site-switcher-in">
    <div class="nav-tabs">
      <a class="nav-tab" href="../">🖼️ 无字底图主站 (Main Page)</a>
      <a class="nav-tab active" href="./" aria-current="page">🎬 写实影视圣经 · 剧照与视频 (/video/)</a>
    </div>
    <div class="ext-links">
      <a href="https://world.yahwehword.com/video.html" target="_blank" rel="noopener">📖 打开《写实影视圣经》经文阅读器</a>
      <a href="https://world.yahwehword.com/bible.html" target="_blank" rel="noopener">📜 经典画卷圣经</a>
      <a href="https://world.yahwehword.com/" target="_blank" rel="noopener">🌍 雅伟之界 3D 地球主站</a>
    </div>
  </div>
</nav>

<header>
  <div class="brand-row">
    <h1>🎬 写实影视圣经 · 1,443 事件全景看板 <small id="last-updated"></small></h1>
    <button type="button" class="pill-btn" id="live-refresh-btn" title="立即拉取最新生成进度" style="font-size:12.5px;padding:5px 12px">🔄 实时同步最新进度</button>
  </div>
  <div class="stats" id="stats"></div>
  <div class="eta-panel" id="eta-panel"></div>
  <div class="tier-legend" id="tier-legend"></div>
  <div class="view-pills" id="view-pills"></div>
</header>

<div class="bar">
  <div class="bar-in">
    <div class="search-wrap">
      <input type="search" id="q" placeholder="搜索 #序号 / 标题 / 经文 / 人物…">
      <button type="button" class="search-clear" id="q-clear" title="清空搜索">✕</button>
    </div>
    <select id="filter-status" aria-label="完成状态筛选">
      <option value="done">✨ 仅看已出写实资产 (剧照/视频)</option>
      <option value="vid_pass">🎬 仅看已出动态视频</option>
      <option value="img_pass">📷 仅看已出写实剧照 (Nano Banana 2.1)</option>
      <option value="pilot12">⭐ 12 核心试点事件 (Pilot 12)</option>
      <option value="anchors">👤 人物与实尺建筑定妆母本</option>
      <option value="todo">⏳ 待生成事件</option>
      <option value="all">📚 全部 1,443 正典事件</option>
    </select>
    <span class="seg" id="testament">
      <button type="button" data-v="" class="on">全部书卷</button>
      <button type="button" data-v="ot">旧约 (39卷)</button>
      <button type="button" data-v="nt">新约 (27卷)</button>
    </span>
    <select id="book" aria-label="选择圣经书卷"></select>
    <select id="tier" aria-label="事件重要度与时长分级 (S/A/B)">
      <option value="">全部 S/A/B 分级 (重要性与时长)</option>
      <option value="S">🌟 S级 · 核心救赎与重大神迹 (177个 · 8–16s)</option>
      <option value="A">🎬 A级 · 主干历史叙事与教导 (803个 · 6–8s)</option>
      <option value="B">📜 B级 · 家谱/疆界/律法细则 (463个 · 4–8s)</option>
    </select>
    <select id="anchor-filter" aria-label="按圣经人物或建筑母本筛选">
      <option value="">全部人物 / 建筑母本</option>
    </select>
    <select id="sort" aria-label="排序方式">
      <option value="bible">圣经正典顺序 (#1 → #1443)</option>
      <option value="vid_first">动态视频优先 → 写实剧照</option>
      <option value="new">最新生成优先</option>
      <option value="year">历史年代顺序</option>
    </select>
    <label class="size-lbl">卡片 <input type="range" id="size" min="200" max="440" value="285"></label>
    <button type="button" class="reset-btn" id="reset-btn">🔄 重置筛选</button>
    <span class="count" id="count"></span>
  </div>
</div>

<details class="books-drawer" id="books-drawer">
  <summary>📖 展开 66 卷圣经分卷进度表（点击书卷一键筛选）</summary>
  <div class="bk-grid" id="bk-grid"></div>
</details>

<main>
  <div class="notice-banner" id="notice-banner"></div>
  <section id="anchors-section" style="display:none">
    <h2 class="sec-title">
      <span>👤 已定妆圣经人物与实尺建筑母本 (Consistency Anchors) <small id="anchors-count"></small></span>
      <button type="button" class="pill-btn" id="toggle-anchors-btn" style="font-size:12px;padding:4px 10px">收起母本面板</button>
    </h2>
    <div class="anchor-grid" id="anchors-grid"></div>
  </section>
  <div id="events-container"></div>
</main>

<div id="lb">
  <div class="stage">
    <button class="close" id="lb-close">✕</button>
    <button class="nav prev" id="lb-prev">‹</button>
    <div id="lb-media-wrap" style="display:grid;place-items:center;width:100%;height:100%"></div>
    <button class="nav next" id="lb-next">›</button>
  </div>
  <aside id="lb-aside"></aside>
</div>

<script id="payload" type="application/json">__PAYLOAD__</script>
<script>
let D = JSON.parse(document.getElementById('payload').textContent);
let E = D.events, BOOKS = D.books, CHARS = D.characterAnchors || [], LOCS = D.locationAnchors || [];
let CHAR_MAP = Object.fromEntries(CHARS.map(c => [c.id, c]));
let LOC_MAP = Object.fromEntries(LOCS.map(l => [l.id, l]));
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const when = t => t ? new Date(t * 1000).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
function updateHeaderTimestamp() {
  $('last-updated').textContent = `最后更新：${when(D.summary.updatedAt)} · Nano Banana 2.1 + Gemini Omni 1.1（每60秒自动同步）`;
}
updateHeaderTimestamp();

let state = {
  st: 'done',
  test: '',
  book: 0,
  tier: '',
  anchor: '',
  sort: 'bible',
  q: '',
  showAnchorsInDone: true
};

// Compute per-book counts
const bookStats = {};
function recomputeBookStats() {
  BOOKS.forEach(b => { bookStats[b.b] = { total: 0, pass: 0, vid: 0 }; });
  E.forEach(e => {
    if (!bookStats[e.b]) bookStats[e.b] = { total: 0, pass: 0, vid: 0 };
    bookStats[e.b].total++;
    if (e.imageStatus === 'pass' || e.videoStatus === 'pass') bookStats[e.b].pass++;
    if (e.videoStatus === 'pass') bookStats[e.b].vid++;
  });
}
recomputeBookStats();

function populateAnchorDropdown() {
  const readyChars = CHARS.filter(c => c.status === 'pass' || c.status === 'pending_review');
  const readyLocs = LOCS.filter(l => l.status === 'pass' || l.status === 'pending_review');
  let html = '<option value="">全部人物 / 建筑母本</option>';
  if (readyChars.length) {
    html += '<optgroup label="👤 已定妆圣经人物">';
    readyChars.forEach(c => {
      const cnt = E.filter(e => (e.characterAnchors || []).includes(c.id)).length;
      const st = c.status === 'pass' ? '✓' : '⏳';
      html += `<option value="char:${esc(c.id)}">👤 ${st} ${esc(c.zh)} ${esc(c.en)} (${cnt}事件)</option>`;
    });
    html += '</optgroup>';
  }
  if (readyLocs.length) {
    html += '<optgroup label="🏛️ 已定妆实尺建筑与场景">';
    readyLocs.forEach(l => {
      const cnt = E.filter(e => e.locationAnchor === l.id).length;
      const st = l.status === 'pass' ? '✓' : '⏳';
      html += `<option value="loc:${esc(l.id)}">🏛️ ${st} ${esc(l.zh)} (${cnt}事件)</option>`;
    });
    html += '</optgroup>';
  }
  $('anchor-filter').innerHTML = html;
}

function populateBookSelectAndGrid() {
  const booksForTest = BOOKS.filter(b => !state.test || (state.test === 'ot' ? b.b <= 39 : b.b > 39));
  $('book').innerHTML = `<option value="0">${state.test === 'ot' ? '全部旧约 39 卷' : (state.test === 'nt' ? '全部新约 27 卷' : '全部 66 卷书')}</option>` +
    booksForTest.map(b => {
      const st = bookStats[b.b] || { total: 0, pass: 0 };
      const badge = st.pass > 0 ? ` ✓ ${st.pass}/${st.total}` : ` (${st.total})`;
      return `<option value="${b.b}" ${state.book === b.b ? 'selected' : ''}>${b.b}. ${esc(b.zh)} ${esc(b.en)}${badge}</option>`;
    }).join('');

  $('bk-grid').innerHTML = booksForTest.map(b => {
    const st = bookStats[b.b] || { total: 1, pass: 0 };
    const pct = Math.round((st.pass / Math.max(1, st.total)) * 100);
    return `<button type="button" class="bk-btn ${state.book === b.b ? 'on' : ''}" data-b="${b.b}">
      <b>${b.b}. ${esc(b.zh)}</b>
      <em>${st.pass} / ${st.total} 已生成</em>
      <span class="bar-fill" style="width:${pct}%"></span>
    </button>`;
  }).join('');
}

const TIER_META = {
  S: { badge: 'S级 · 核心神迹', short: 'S级·核心神迹', full: 'S级 · 核心救赎与重大神迹 (8–16s 史诗镜头)', desc: '创世、洪水方舟、过红海、西奈颁律、大卫立约、道成肉身、十架救赎、死里复活、五旬节与新天新地等救赎高潮' },
  A: { badge: 'A级 · 主干叙事', short: 'A级·主干叙事', full: 'A级 · 主干历史叙事与使徒先知教导 (6–8s 叙事镜头)', desc: '列祖生平、旷野行程、士师与列王兴衰、先知宣讲、耶稣神迹与比喻、使徒行传宣教旅程等圣经主线事件' },
  B: { badge: 'B级 · 家谱律法', short: 'B级·家谱律法', full: 'B级 · 家谱传承 / 支派疆界 / 律法礼仪细则 (4–8s 纪实画卷)', desc: '家谱世系、会幕器物尺寸、献祭与洁净条例、十二支派分地边界、智慧诗篇与书信劝勉细则' }
};

function renderStatsAndPills() {
  const s = D.summary;
  const readyAnchors = CHARS.filter(c => c.status === 'pass').length + LOCS.filter(l => l.status === 'pass').length;
  const totalAnchors = s.characterAnchorsTotal + s.locationAnchorsTotal;
  const todoCount = s.totalEvents - s.imagesPass;
  const todoVids = s.totalEvents - s.videosPass;

  // Dynamic Schedule Math based on Project Start (2026-10-17 12:00 AEDT) and Current Date/Time
  const startMs = new Date('2026-10-17T12:00:00+11:00').getTime();
  const nowObj = new Date();
  const nowMs = nowObj.getTime();
  const nowStr = nowObj.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const elapsedHrs = Math.max(0.5, (nowMs - startMs) / 3600000);
  const elapsedDaysStr = (elapsedHrs / 24).toFixed(1);

  // Target Schedule 1: Stills (Planned 90h = 3.75 days from 2026-10-17 12:00 to 2026-10-21 06:00, ~16.03 imgs/hr average; first 12h includes anchor setup + 3 books)
  const imgPlanTotalHrs = 90;
  const plannedImgNow = Math.min(s.totalEvents, Math.max(1, Math.round(
    elapsedHrs <= 12
      ? elapsedHrs * 11.5
      : 138 + (elapsedHrs - 12) * ((s.totalEvents - 138) / (imgPlanTotalHrs - 12))
  )));
  const imgActualPct = ((s.imagesPass / Math.max(1, s.totalEvents)) * 100).toFixed(1);
  const imgPlanPct = ((plannedImgNow / Math.max(1, s.totalEvents)) * 100).toFixed(1);
  const imgDelta = s.imagesPass - plannedImgNow;
  const imgDeltaPct = (s.imagesPass / Math.max(1, plannedImgNow) * 100).toFixed(0);
  const imgActualRate = (s.imagesPass / elapsedHrs).toFixed(1);
  const imgActualDaysLeft = ((todoCount / Math.max(8, s.imagesPass / elapsedHrs)) / 24).toFixed(1);
  const imgPlanDaysLeft = Math.max(0.1, (imgPlanTotalHrs - elapsedHrs) / 24).toFixed(1);

  // Target Schedule 2: Videos (Planned 192h = 8.0 days from 2026-10-17 12:00 to 2026-10-25 12:00; first 12h ramp-up 18 vids, then ~190 vids/day = 7.9 vids/hr)
  const vidPlanTotalHrs = 192;
  const plannedVidNow = Math.min(s.totalEvents, Math.max(1, Math.round(
    elapsedHrs <= 12
      ? elapsedHrs * 1.5
      : 18 + (elapsedHrs - 12) * ((s.totalEvents - 18) / (vidPlanTotalHrs - 12))
  )));
  const vidActualPct = ((s.videosPass / Math.max(1, s.totalEvents)) * 100).toFixed(1);
  const vidPlanPct = ((plannedVidNow / Math.max(1, s.totalEvents)) * 100).toFixed(1);
  const vidDelta = s.videosPass - plannedVidNow;
  const vidDeltaPct = (s.videosPass / Math.max(1, plannedVidNow) * 100).toFixed(0);
  const vidActualRate = (s.videosPass / elapsedHrs).toFixed(1);
  const vidPlanDaysLeft = Math.max(0.1, (vidPlanTotalHrs - elapsedHrs) / 24).toFixed(1);

  // Per-tier pass counts
  const tierDone = { S: 0, A: 0, B: 0 };
  const tierVidDone = { S: 0, A: 0, B: 0 };
  E.forEach(e => {
    if (e.imageStatus === 'pass' || e.videoStatus === 'pass') tierDone[e.tier] = (tierDone[e.tier] || 0) + 1;
    if (e.videoStatus === 'pass') tierVidDone[e.tier] = (tierVidDone[e.tier] || 0) + 1;
  });

  $('stats').innerHTML = `
    <div class="stat ${state.st==='done'||state.st==='img_pass'?'on':''}" data-st="done">
      <b>${s.imagesPass} / ${s.totalEvents} <small style="font-size:14px;color:var(--ok)">(${imgActualPct}%)</small></b>
      <span>📷 实际已出写实剧照 (点击仅看已生成)</span>
    </div>
    <div class="stat ${state.st==='vid_pass'?'on':''}" data-st="vid_pass">
      <b>${s.videosPass} / ${s.totalEvents} <small style="font-size:14px;color:var(--vid)">(${vidActualPct}%)</small></b>
      <span>🎬 实际已出动态视频 (点击仅看视频)</span>
    </div>
    <div class="stat ${state.st==='pilot12'?'on':''}" data-st="pilot12">
      <b>${s.pilot12ImagesPass} 图 · ${s.pilot12VideosPass} 频 / 12</b>
      <span>⭐ 12 核心标志事件 (Pilot 12)</span>
    </div>
    <div class="stat ${state.st==='anchors'?'on':''}" data-st="anchors">
      <b>${readyAnchors} / ${totalAnchors}</b>
      <span>👤 人物与实尺建筑定妆母本</span>
    </div>
    <div class="stat ${state.st==='all'?'on':''}" data-st="all">
      <b>${s.tierCounts.S} S · ${s.tierCounts.A} A · ${s.tierCounts.B} B</b>
      <span>📚 1,443 事件分级：S核心神迹 · A主干叙事 · B家谱律法</span>
    </div>
  `;

  const imgDeltaBadge = imgDelta >= 0
    ? `<span class="delta-pill ahead">🚀 较当下计划超前 +${imgDelta} 张 (达计划 ${imgDeltaPct}%)</span>`
    : `<span class="delta-pill behind">⏳ 较当下计划差 ${Math.abs(imgDelta)} 张 (达计划 ${imgDeltaPct}%)</span>`;

  const vidDeltaBadge = vidDelta >= 0
    ? `<span class="delta-pill ahead">🚀 较当下计划超前 +${vidDelta} 支 (达计划 ${vidDeltaPct}%)</span>`
    : `<span class="delta-pill behind">⏳ 较当下计划差 ${Math.abs(vidDelta)} 支 (达计划 ${vidDeltaPct}%)</span>`;

  // Gemini Models Quota & Live Reset Countdown (synced from local Antigravity language_server)
  const gq = s.geminiQuota || {};
  const weeklyResetMs = new Date(gq.weeklyResetAt || '2026-10-24T09:00:00+11:00').getTime();
  const weeklyRemMs = Math.max(0, weeklyResetMs - nowMs);
  const wDays = Math.floor(weeklyRemMs / 86400000);
  const wHrs = Math.floor((weeklyRemMs % 86400000) / 3600000);
  const wMins = Math.floor((weeklyRemMs % 3600000) / 60000);
  const weeklyResetStr = wDays > 0 ? `Resets in ${wDays}d ${wHrs}h` : `Resets in ${wHrs}h ${wMins}m`;
  const weeklyPct = (gq.weeklyRemainingPct != null) ? gq.weeklyRemainingPct : 55;

  const fiveHrAnchorMs = new Date(gq.fiveHourResetAt || '2026-10-18T04:40:11Z').getTime();
  const fiveHrWindowMs = 5 * 3600000;
  const fiveHrRolledOver = nowMs >= fiveHrAnchorMs;
  const fiveHrNextMs = !fiveHrRolledOver
    ? fiveHrAnchorMs
    : fiveHrAnchorMs + (Math.floor((nowMs - fiveHrAnchorMs) / fiveHrWindowMs) + 1) * fiveHrWindowMs;
  const fiveHrRemMs = Math.max(0, fiveHrNextMs - nowMs);
  const fHrs = Math.floor(fiveHrRemMs / 3600000);
  const fMins = Math.floor((fiveHrRemMs % 3600000) / 60000);
  const fiveHrResetStr = fHrs > 0 ? `Resets in ${fHrs}h ${fMins}m` : `Resets in ${fMins}m`;
  const fiveHrPct = fiveHrRolledOver ? 100 : ((gq.fiveHourRemainingPct != null) ? gq.fiveHourRemainingPct : 99);

  const ringSvg = pct => {
    const c = 56.55;
    const dash = ((Math.max(0, Math.min(100, pct)) / 100) * c).toFixed(2);
    return `<svg class="gemini-ring" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2.6"></circle>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#57ab5a" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="${dash} ${c}"></circle>
    </svg>`;
  };

  const imgPlanRate = (plannedImgNow / elapsedHrs).toFixed(1);
  const vidPlanRate = (plannedVidNow / elapsedHrs).toFixed(1);

  $('eta-panel').innerHTML = `
    <div class="eta-col">
      <div class="eta-head">
        <b>📷 写实剧照：实际进度 vs 截至当下日期计划进度</b>
        ${imgDeltaBadge}
      </div>
      <div class="pbar-group">
        <div class="pbar-row">
          <span class="pbar-lbl">✅ 当前实际已完成</span>
          <div class="pbar-track" title="实际已完成 ${s.imagesPass}/1443 (${imgActualPct}%) · 白色刻度线为截至当前时刻计划应达位置">
            <div class="pbar-fill-actual-img" style="width:${Math.max(1.2, imgActualPct)}%"></div>
            <div class="pbar-marker" style="left:${Math.min(99.5, Math.max(1, imgPlanPct))}%"></div>
          </div>
          <span class="pbar-val">${s.imagesPass} / 1,443 (${imgActualPct}%)</span>
        </div>
        <div class="pbar-row">
          <span class="pbar-lbl plan">📅 截至当下计划应达</span>
          <div class="pbar-track" title="按 10-17 12:00 启动至 10-21 完工排期，截至当前时刻 (${nowStr}) 计划应完成 ${plannedImgNow}/1443 (${imgPlanPct}%)">
            <div class="pbar-fill-plan" style="width:${Math.max(1.2, imgPlanPct)}%"></div>
          </div>
          <span class="pbar-val plan">${plannedImgNow} / 1,443 (${imgPlanPct}%)</span>
        </div>
      </div>
      <div class="eta-meta">
        <span>⚡ 速度对比：<strong>实际 ${imgActualRate} 张/h</strong> vs <strong>预计 ${imgPlanRate} 张/h</strong>（已运行 ${elapsedHrs.toFixed(1)}h）</span>
        <span>🏁 计划完工：<strong>2026-10-21（剩 ${imgPlanDaysLeft} 天）</strong> · 按实测速率推算：<strong>约需 ${imgActualDaysLeft} 天</strong></span>
      </div>
    </div>
    <div class="eta-col">
      <div class="eta-head">
        <b>🎬 动态视频：实际进度 vs 截至当下日期计划进度 (Omni 1.1)</b>
        ${vidDeltaBadge}
      </div>
      <div class="pbar-group">
        <div class="pbar-row">
          <span class="pbar-lbl">✅ 当前实际已完成</span>
          <div class="pbar-track" title="实际已完成 ${s.videosPass}/1443 (${vidActualPct}%) · 白色刻度线为截至当前时刻计划应达位置">
            <div class="pbar-fill-actual-vid" style="width:${Math.max(0.8, vidActualPct)}%"></div>
            <div class="pbar-marker" style="left:${Math.min(99.5, Math.max(0.8, vidPlanPct))}%"></div>
          </div>
          <span class="pbar-val">${s.videosPass} / 1,443 (${vidActualPct}%)</span>
        </div>
        <div class="pbar-row">
          <span class="pbar-lbl plan">📅 截至当下计划应达</span>
          <div class="pbar-track" title="按 10-17 12:00 启动至 10-25 完工排期，截至当前时刻 (${nowStr}) 计划应完成 ${plannedVidNow}/1443 (${vidPlanPct}%)">
            <div class="pbar-fill-plan" style="width:${Math.max(0.8, vidPlanPct)}%"></div>
          </div>
          <span class="pbar-val plan">${plannedVidNow} / 1,443 (${vidPlanPct}%)</span>
        </div>
      </div>
      <div class="eta-meta">
        <span>⚡ 速度对比：<strong>实际 ${vidActualRate} 支/h</strong> vs <strong>预计 ${vidPlanRate} 支/h</strong>（额外账单 <strong>$0</strong>）</span>
        <span>🏁 创世记预计 <strong>10-18</strong> 完工 · 全卷 1,443 支计划：<strong>2026-10-25（剩 ${vidPlanDaysLeft} 天）</strong></span>
      </div>
    </div>
    <div class="gemini-card">
      <div class="gemini-title"><span>Gemini Models</span></div>
      <div class="gemini-row">
        <div class="gemini-row-main">
          <b>Weekly Limit Remaining</b>
          <span>${weeklyResetStr}</span>
        </div>
        <div class="gemini-ring-wrap">
          <span>${weeklyPct}%</span>
          ${ringSvg(weeklyPct)}
        </div>
      </div>
      <div class="gemini-row">
        <div class="gemini-row-main">
          <b>Five Hour Limit Remaining</b>
          <span>${fiveHrResetStr}</span>
        </div>
        <div class="gemini-ring-wrap">
          <span>${fiveHrPct}%</span>
          ${ringSvg(fiveHrPct)}
        </div>
      </div>
    </div>
  `;

  $('tier-legend').innerHTML = ['S', 'A', 'B'].map(t => {
    const m = TIER_META[t];
    const totalT = s.tierCounts[t] || 0;
    const doneT = tierDone[t] || 0;
    const vidT = tierVidDone[t] || 0;
    const pctT = ((doneT / Math.max(1, totalT)) * 100).toFixed(1);
    return `<div class="tier-box ${state.tier === t ? 'on' : ''}" data-tier="${t}" title="点击仅筛选 ${m.full}">
      <span class="tier-badge ${t}">Tier ${t}</span>
      <div class="tier-desc">
        <b>${m.full} · 已出 ${doneT}/${totalT} 图 (${pctT}%) · ${vidT} 视频</b>
        <span>${m.desc}（点击卡片可按 ${t} 级筛选）</span>
      </div>
    </div>`;
  }).join('');

  const pills = [
    { id: 'done', label: `✨ 已完成写实资产 (${s.imagesPass})` },
    { id: 'vid_pass', label: `🎬 动态视频 (${s.videosPass})` },
    { id: 'pilot12', label: `⭐ 12 核心试点 (12)` },
    { id: 'anchors', label: `👤 定妆母本库 (${readyAnchors})` },
    { id: 'todo', label: `⏳ 待生成 (${todoCount})` },
    { id: 'all', label: `📚 全部事件 (${s.totalEvents})` },
  ];
  $('view-pills').innerHTML = pills.map(p =>
    `<button type="button" class="pill-btn ${state.st === p.id ? 'on' : ''}" data-st="${p.id}">${p.label}</button>`
  ).join('');
}

function renderAnchors() {
  const readyChars = CHARS.filter(c => c.status === 'pass' || c.status === 'pending_review');
  const readyLocs = LOCS.filter(l => l.status === 'pass' || l.status === 'pending_review');
  const passCharsCount = CHARS.filter(c => c.status === 'pass').length;
  const passLocsCount = LOCS.filter(l => l.status === 'pass').length;
  const totalReady = readyChars.length + readyLocs.length;
  // Show anchors section when st === 'anchors' OR when st === 'done' with no narrowing sub-filters and showAnchorsInDone is true
  const hasNarrowFilter = state.book || state.test || state.tier || state.anchor || state.q;
  const shouldShow = totalReady > 0 && (state.st === 'anchors' || (state.st === 'done' && !hasNarrowFilter && state.showAnchorsInDone));
  if (!shouldShow) {
    $('anchors-section').style.display = 'none';
    return;
  }
  $('anchors-section').style.display = 'block';
  $('anchors-count').textContent = `已出图 ${readyChars.length}/66 位人物（盲审通过 ${passCharsCount}） · ${readyLocs.length}/25 处建筑/场景（盲审通过 ${passLocsCount}）`;
  $('toggle-anchors-btn').style.display = state.st === 'anchors' ? 'none' : 'inline-flex';
  const cards = [
    ...readyChars.map(c => {
      const active = state.anchor === `char:${c.id}` ? 'on' : '';
      const v = c.updatedAt ? `?v=${c.updatedAt}` : '';
      const badge = c.status === 'pass' ? '✅ 盲审通过' : '⏳ 待审/待批';
      return `<div class="anchor-card ${active}" data-aid="char:${esc(c.id)}" data-img="anchors/${esc(c.id)}.jpg${v}">
        <div class="im"><img loading="lazy" src="anchors-thumbs/${esc(c.id)}.jpg${v}" alt="${esc(c.zh)}"></div>
        <div class="meta">
          <b>👤 ${esc(c.zh)} · ${esc(c.en)}</b>
          <span>${esc(c.ref)} · ${badge}</span>
          <div class="act-row">
            <button type="button" data-act="filter" data-aid="char:${esc(c.id)}">🔍 筛选事件</button>
            <button type="button" data-act="open" data-url="anchors/${esc(c.id)}.jpg${v}">🖼️ 看定妆图</button>
          </div>
        </div>
      </div>`;
    }),
    ...readyLocs.map(l => {
      const active = state.anchor === `loc:${l.id}` ? 'on' : '';
      const v = l.updatedAt ? `?v=${l.updatedAt}` : '';
      const badge = l.status === 'pass' ? '✅ 盲审通过' : '⏳ 待盲审';
      return `<div class="anchor-card loc ${active}" data-aid="loc:${esc(l.id)}" data-img="anchors/${esc(l.id)}.jpg${v}">
        <div class="im"><img loading="lazy" src="anchors-thumbs/${esc(l.id)}.jpg${v}" alt="${esc(l.zh)}"></div>
        <div class="meta">
          <b>🏛️ ${esc(l.zh)}</b>
          <span>${esc(l.en)} · ${esc(l.ref)} · ${badge}</span>
          <div class="act-row">
            <button type="button" data-act="filter" data-aid="loc:${esc(l.id)}">🔍 筛选事件</button>
            <button type="button" data-act="open" data-url="anchors/${esc(l.id)}.jpg${v}">🖼️ 看实尺图</button>
          </div>
        </div>
      </div>`;
    })
  ];
  $('anchors-grid').innerHTML = cards.join('');
}

let filtered = [];

function cardHTML(e, idx) {
  const hasImg = e.imageStatus === 'pass';
  const hasVid = e.videoStatus === 'pass';
  const thumbUrl = hasImg ? `thumbs/${e.id}.jpg` : `../merged-thumbs/${e.id}.jpg`;
  let mediaHtml = '';
  if (hasVid && state.st === 'vid_pass') {
    mediaHtml = `<video src="clips/${e.id}.mp4" poster="full/${e.id}.jpg" controls preload="metadata" playsinline></video>`;
  } else if (hasImg) {
    mediaHtml = `<img loading="lazy" src="${thumbUrl}" alt="${esc(e.zh)}">`;
  } else {
    mediaHtml = `<img loading="lazy" src="${thumbUrl}" alt="${esc(e.zh)}" style="opacity:.34;filter:grayscale(.45)"><div class="ph">⏳ 待生成写实版<br><small>当前显示经典画卷参考</small></div>`;
  }
  const statusTag = hasVid
    ? `<span class="tag vid-ok">🎬 动态视频 + 剧照</span>`
    : (hasImg ? `<span class="tag img-ok">📷 写实剧照已出</span>` : `<span class="tag">待生成</span>`);
  const tMeta = TIER_META[e.tier] || { short: `Tier ${e.tier}`, full: `Tier ${e.tier}` };
  return `<article class="card" data-idx="${idx}">
    <div class="im">
      ${mediaHtml}
      <div class="badge-row">
        ${statusTag}
        <span class="tag tier-${e.tier}" title="${esc(tMeta.full)}">${tMeta.short} · ${e.durationSec}s</span>
      </div>
    </div>
    <div class="body">
      <b>#${e.index} ${esc(e.zh)}</b>
      <span class="sub">${esc(e.en)}</span>
      <span class="ref">${esc(e.refZh)} (${esc(e.ref)})</span>
    </div>
  </article>`;
}

function matchesNonStatusFilters(e, qLower) {
  if (state.book && e.b !== state.book) return false;
  if (state.test === 'ot' && e.b > 39) return false;
  if (state.test === 'nt' && e.b <= 39) return false;
  if (state.tier && e.tier !== state.tier) return false;
  if (state.anchor) {
    if (state.anchor.startsWith('char:')) {
      const cid = state.anchor.slice(5);
      if (!(e.characterAnchors || []).includes(cid)) return false;
    } else if (state.anchor.startsWith('loc:')) {
      const lid = state.anchor.slice(4);
      if (e.locationAnchor !== lid) return false;
    }
  }
  if (qLower) {
    const charNames = (e.characterAnchors || []).map(cid => CHAR_MAP[cid] ? `${CHAR_MAP[cid].zh} ${CHAR_MAP[cid].en}` : cid).join(' ');
    const locName = e.locationAnchor && LOC_MAP[e.locationAnchor] ? `${LOC_MAP[e.locationAnchor].zh} ${LOC_MAP[e.locationAnchor].en}` : '';
    const hay = `#${e.index} ${e.id} ${e.zh} ${e.en} ${e.refZh} ${e.ref} ${e.sum} ${e.sumEn} ${charNames} ${locName}`.toLowerCase();
    if (!hay.includes(qLower)) return false;
  }
  return true;
}

function matchesStatusFilter(e, stMode) {
  if (stMode === 'done' || stMode === 'img_pass') return e.imageStatus === 'pass' || e.videoStatus === 'pass';
  if (stMode === 'vid_pass') return e.videoStatus === 'pass';
  if (stMode === 'pilot12') return !!e.isPilot12;
  if (stMode === 'todo') return e.imageStatus !== 'pass' && e.videoStatus !== 'pass';
  return true; // 'all' or 'anchors'
}

function render() {
  state.q = $('q').value.trim();
  const qLower = state.q.toLowerCase();
  $('q-clear').classList.toggle('show', state.q.length > 0);
  $('filter-status').value = state.st;
  $('tier').value = state.tier;
  $('anchor-filter').value = state.anchor;
  $('sort').value = state.sort;
  document.querySelectorAll('#testament button').forEach(b => b.classList.toggle('on', b.dataset.v === state.test));

  const isNonDefault = state.st !== 'done' || state.test !== '' || state.book !== 0 || state.tier !== '' || state.anchor !== '' || state.q !== '' || state.sort !== 'bible';
  $('reset-btn').classList.toggle('show', isNonDefault);

  renderStatsAndPills();
  populateBookSelectAndGrid();
  renderAnchors();

  // If in dedicated 'anchors' view and no sub-filter is selected, show anchors prominently and also show events that use ready anchors
  let effectiveSt = state.st;
  let autoFallbackUsed = false;

  const baseMatches = E.filter(e => matchesNonStatusFilters(e, qLower));
  filtered = baseMatches.filter(e => matchesStatusFilter(e, effectiveSt));

  // Smart UX auto-fallback: if the user selected a specific book, testament, character, or search query while on 'done'/'img_pass', and 0 completed items exist yet for that book/query, show all matching canonical events for that filter with a clear banner!
  if (filtered.length === 0 && baseMatches.length > 0 && (effectiveSt === 'done' || effectiveSt === 'img_pass')) {
    filtered = baseMatches;
    autoFallbackUsed = true;
  }

  const banner = $('notice-banner');
  if (autoFallbackUsed) {
    banner.className = 'notice-banner show';
    banner.innerHTML = `<span>💡 当前筛选条件下暂未生成写实剧照，已自动为您展示该筛选下的 <b>${filtered.length}</b> 个圣经正典事件（显示经典画卷参考）。</span>
      <button type="button" onclick="resetFilters()">返回已出写实资产</button>`;
  } else if ((effectiveSt === 'done' || effectiveSt === 'img_pass') && (state.book || state.test || state.tier || state.anchor || state.q) && filtered.length < baseMatches.length) {
    banner.className = 'notice-banner show';
    banner.innerHTML = `<span>✨ 当前仅展示符合筛选且<b>已生成写实剧照/视频</b>的 <b>${filtered.length}</b> 个事件（该筛选共有 ${baseMatches.length} 个正典事件）。</span>
      <button type="button" onclick="setStatusFilter('all')">查看全部 ${baseMatches.length} 个事件</button>`;
  } else {
    banner.className = 'notice-banner';
    banner.innerHTML = '';
  }

  // Sort
  if (state.sort === 'vid_first') {
    filtered.sort((a, b) => {
      const sA = (a.videoStatus === 'pass' ? 4 : 0) + (a.imageStatus === 'pass' ? 2 : 0) + (a.isPilot12 ? 1 : 0);
      const sB = (b.videoStatus === 'pass' ? 4 : 0) + (b.imageStatus === 'pass' ? 2 : 0) + (b.isPilot12 ? 1 : 0);
      return sB - sA || a.index - b.index;
    });
  } else if (state.sort === 'new') {
    filtered.sort((a, b) => (b.videoUpdatedAt || b.imageUpdatedAt || 0) - (a.videoUpdatedAt || a.imageUpdatedAt || 0) || a.index - b.index);
  } else if (state.sort === 'year') {
    filtered.sort((a, b) => (a.y0 ?? 99999) - (b.y0 ?? 99999) || a.index - b.index);
  } else {
    filtered.sort((a, b) => a.index - b.index);
  }

  $('count').textContent = `显示 ${filtered.length} / ${E.length} 个事件`;

  if (filtered.length === 0) {
    $('events-container').innerHTML = `<div class="empty-state">
      <div style="font-size:16px;color:var(--gold-bright);margin-bottom:6px">当前筛选条件下暂无匹配事件</div>
      <div>您可以切换为「全部 1,443 正典事件」或点击下方按钮重置筛选条件。</div>
      <button type="button" onclick="resetFilters()">🔄 重置全部筛选</button>
    </div>`;
  } else {
    $('events-container').innerHTML = `<div class="grid">${filtered.map((e, i) => cardHTML(e, i)).join('')}</div>`;
  }
}

window.setStatusFilter = st => {
  state.st = st;
  if (st === 'anchors') state.showAnchorsInDone = true;
  render();
};

window.resetFilters = () => {
  state = { st: 'done', test: '', book: 0, tier: '', anchor: '', sort: 'bible', q: '', showAnchorsInDone: true };
  $('q').value = '';
  render();
};

let curIdx = -1;
let lbMode = 'auto';

function openLb(idx) {
  curIdx = idx;
  const e = filtered[idx];
  if (!e) return;
  $('lb').classList.add('show');
  const hasVid = e.videoStatus === 'pass';
  const hasImg = e.imageStatus === 'pass';
  const mode = lbMode === 'auto' ? (hasVid ? 'video' : (hasImg ? 'photo' : 'legacy')) : lbMode;

  const wrap = $('lb-media-wrap');
  if (mode === 'video' && hasVid) {
    wrap.innerHTML = `<video src="clips/${e.id}.mp4" poster="full/${e.id}.jpg" controls autoplay loop playsinline></video>`;
  } else if (mode === 'photo' && hasImg) {
    wrap.innerHTML = `<img src="full/${e.id}.jpg" alt="${esc(e.zh)}">`;
  } else {
    wrap.innerHTML = `<img src="../merged-full/${e.id}.jpg" alt="${esc(e.zh)}">`;
  }

  const tMeta = TIER_META[e.tier] || { full: `Tier ${e.tier}`, desc: '' };
  $('lb-aside').innerHTML = `
    <h2>#${e.index} ${esc(e.zh)}</h2>
    <div class="en">${esc(e.en)}</div>
    <span class="ref-pill">${esc(e.refZh)} · ${esc(e.ref)}</span>
    <div class="mode-tabs">
      ${hasVid ? `<button class="${mode==='video'?'on':''}" onclick="setMode('video')">🎬 写实视频 (${e.durationSec}s)</button>` : ''}
      ${hasImg ? `<button class="${mode==='photo'?'on':''}" onclick="setMode('photo')">📷 写实剧照 (Nano Banana 2.1)</button>` : ''}
      <button class="${mode==='legacy'?'on':''}" onclick="setMode('legacy')">🧊 经典立体画卷</button>
    </div>
    <p>${esc(e.sum)}</p>
    <p style="color:var(--mute);font-size:13px">${esc(e.sumEn)}</p>
    <p style="font-size:12px;color:var(--mute)">
      事件分级：<b style="color:var(--gold-bright)">${esc(tMeta.full)}</b><br>
      分级说明：${esc(tMeta.desc)}<br>
      关联角色母本：${(e.characterAnchors||[]).join(', ') || '通用圣经人物'}<br>
      关联场景母本：${esc(e.locationAnchor || '—')}
    </p>
    ${hasImg ? `<p><a href="full/${e.id}.jpg" target="_blank" style="color:var(--gold-bright)">🔍 打开写实剧照高清原图</a></p>` : ''}
  `;
}

window.setMode = m => { lbMode = m; openLb(curIdx); };
const closeLb = () => { $('lb').classList.remove('show'); $('lb-media-wrap').innerHTML = ''; curIdx = -1; };
const stepLb = d => { if (curIdx >= 0 && filtered.length) { lbMode = 'auto'; openLb((curIdx + d + filtered.length) % filtered.length); } };

$('lb-close').onclick = closeLb;
$('lb-prev').onclick = () => stepLb(-1);
$('lb-next').onclick = () => stepLb(1);
$('lb').onclick = ev => { if (ev.target === $('lb') || ev.target.classList.contains('stage')) closeLb(); };
document.onkeydown = ev => {
  if (curIdx < 0) return;
  if (ev.key === 'Escape') closeLb();
  else if (ev.key === 'ArrowLeft') stepLb(-1);
  else if (ev.key === 'ArrowRight') stepLb(1);
};

$('stats').onclick = ev => {
  const card = ev.target.closest('.stat[data-st]');
  if (card) setStatusFilter(card.dataset.st);
};
$('tier-legend').onclick = ev => {
  const box = ev.target.closest('.tier-box[data-tier]');
  if (box) {
    const t = box.dataset.tier;
    state.tier = state.tier === t ? '' : t;
    render();
  }
};
$('view-pills').onclick = ev => {
  const btn = ev.target.closest('.pill-btn[data-st]');
  if (btn) setStatusFilter(btn.dataset.st);
};
$('toggle-anchors-btn').onclick = () => {
  state.showAnchorsInDone = !state.showAnchorsInDone;
  renderAnchors();
};
$('anchors-grid').onclick = ev => {
  const actBtn = ev.target.closest('button[data-act]');
  if (actBtn) {
    ev.stopPropagation();
    if (actBtn.dataset.act === 'open') {
      window.open(actBtn.dataset.url, '_blank');
    } else if (actBtn.dataset.act === 'filter') {
      state.anchor = state.anchor === actBtn.dataset.aid ? '' : actBtn.dataset.aid;
      if (state.st === 'anchors') state.st = 'all';
      render();
    }
    return;
  }
  const card = ev.target.closest('.anchor-card');
  if (card) {
    state.anchor = state.anchor === card.dataset.aid ? '' : card.dataset.aid;
    if (state.st === 'anchors') state.st = 'all';
    render();
  }
};

$('q').oninput = render;
$('q-clear').onclick = () => { $('q').value = ''; render(); };
$('filter-status').onchange = ev => { state.st = ev.target.value; render(); };
$('book').onchange = ev => { state.book = +ev.target.value || 0; render(); };
$('tier').onchange = ev => { state.tier = ev.target.value; render(); };
$('anchor-filter').onchange = ev => { state.anchor = ev.target.value; if (state.anchor && state.st === 'anchors') state.st = 'all'; render(); };
$('sort').onchange = ev => { state.sort = ev.target.value; render(); };
$('size').oninput = ev => { document.documentElement.style.setProperty('--w', ev.target.value + 'px'); };
$('reset-btn').onclick = () => window.resetFilters();

$('testament').onclick = ev => {
  const btn = ev.target.closest('button[data-v]');
  if (btn) {
    state.test = btn.dataset.v;
    if (state.test === 'ot' && state.book > 39) state.book = 0;
    if (state.test === 'nt' && state.book > 0 && state.book <= 39) state.book = 0;
    render();
  }
};

$('bk-grid').onclick = ev => {
  const btn = ev.target.closest('.bk-btn[data-b]');
  if (btn) {
    const b = +btn.dataset.b;
    state.book = state.book === b ? 0 : b;
    render();
  }
};

$('events-container').onclick = ev => {
  if (ev.target.tagName === 'VIDEO') return;
  const card = ev.target.closest('.card');
  if (card) { lbMode = 'auto'; openLb(+card.dataset.idx); }
};

async function syncLiveManifest(manual = false) {
  const btn = $('live-refresh-btn');
  if (manual && btn) btn.textContent = '⏳ 正在同步最新进度…';
  try {
    const res = await fetch(`manifest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const fresh = await res.json();
      const quotaChanged = JSON.stringify((fresh && fresh.summary && fresh.summary.geminiQuota) || {}) !== JSON.stringify((D && D.summary && D.summary.geminiQuota) || {});
      if (fresh && fresh.summary && (manual || quotaChanged || fresh.summary.updatedAt !== D.summary.updatedAt || fresh.summary.imagesPass !== D.summary.imagesPass || fresh.summary.videosPass !== D.summary.videosPass)) {
        D = fresh;
        E = D.events;
        BOOKS = D.books || BOOKS;
        CHARS = D.characterAnchors || [];
        LOCS = D.locationAnchors || [];
        CHAR_MAP = Object.fromEntries(CHARS.map(c => [c.id, c]));
        LOC_MAP = Object.fromEntries(LOCS.map(l => [l.id, l]));
        recomputeBookStats();
        updateHeaderTimestamp();
        populateAnchorDropdown();
        render();
      } else {
        renderStatsAndPills();
      }
    } else {
      renderStatsAndPills();
    }
  } catch (err) {
    console.warn('Live manifest sync skipped:', err);
    renderStatsAndPills();
  } finally {
    if (manual && btn) {
      btn.textContent = '✅ 已同步最新进度';
      setTimeout(() => { btn.textContent = '🔄 实时同步最新进度'; }, 1800);
    }
  }
}

$('live-refresh-btn').onclick = () => syncLiveManifest(true);
populateAnchorDropdown();
render();
syncLiveManifest(false);
setInterval(() => syncLiveManifest(false), 60000);
</script>
</body>
</html>
"""


def main():
    os.system(f"python3 {REPO_ROOT}/tools/scenes/init_realistic_cinema.py")
    manifest = json.load(open(f"{T7_ROOT}/manifest.json"))
    manifest["summary"]["geminiQuota"] = get_live_gemini_quota()
    manifest["summary"]["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    for sub in ("full", "thumbs", "clips", "anchors", "anchors-thumbs"):
        os.makedirs(os.path.join(VIDEO_SITE_DIR, sub), exist_ok=True)

    # Sync character & location anchors
    for ch in manifest.get("characterAnchors", []):
        src = f"{T7_ROOT}/anchors/characters/{ch['id']}.png"
        if os.path.isfile(src):
            ensure_jpg_and_thumb(
                src,
                os.path.join(VIDEO_SITE_DIR, "anchors", f"{ch['id']}.jpg"),
                os.path.join(VIDEO_SITE_DIR, "anchors-thumbs", f"{ch['id']}.jpg"),
                full_w=1200,
                thumb_w=360,
            )

    for loc in manifest.get("locationAnchors", []):
        src = f"{T7_ROOT}/anchors/locations/{loc['id']}.png"
        if os.path.isfile(src):
            ensure_jpg_and_thumb(
                src,
                os.path.join(VIDEO_SITE_DIR, "anchors", f"{loc['id']}.jpg"),
                os.path.join(VIDEO_SITE_DIR, "anchors-thumbs", f"{loc['id']}.jpg"),
                full_w=1672,
                thumb_w=480,
            )

    # Remove any deleted clips or AppleDouble dotfiles from VIDEO_SITE_DIR/clips
    clips_dir = os.path.join(VIDEO_SITE_DIR, "clips")
    for fname in os.listdir(clips_dir):
        if fname.startswith("."):
            os.remove(os.path.join(clips_dir, fname))
            continue
        if fname.endswith(".mp4"):
            eid = fname[:-4]
            if not os.path.isfile(f"{T7_ROOT}/videos-live/{eid}.mp4"):
                os.remove(os.path.join(clips_dir, fname))

    # Sync event videos (auto-overwriting images-live from images-raw removed per Stage 0.f)
    for ev in manifest.get("events", []):
        eid = ev["id"]
        vid_src = f"{T7_ROOT}/videos-live/{eid}.mp4"
        if os.path.isfile(vid_src):
            vid_dst = os.path.join(VIDEO_SITE_DIR, "clips", f"{eid}.mp4")
            if not os.path.isfile(vid_dst) or os.path.getmtime(vid_dst) < os.path.getmtime(vid_src):
                shutil.copy2(vid_src, vid_dst)

    payload = {
        "summary": manifest["summary"],
        "books": BOOKS,
        "characterAnchors": [
            {k: c[k] for k in ("id", "zh", "en", "ref", "status", "updatedAt") if k in c}
            for c in manifest.get("characterAnchors", [])
        ],
        "locationAnchors": [
            {k: l[k] for k in ("id", "zh", "en", "ref", "status", "updatedAt") if k in l}
            for l in manifest.get("locationAnchors", [])
        ],
        "events": manifest["events"],
    }

    with open(os.path.join(VIDEO_SITE_DIR, "manifest.json"), "w", encoding="utf-8") as mf:
        json.dump(payload, mf, ensure_ascii=False)

    html = HTML_TEMPLATE.replace("__PAYLOAD__", json.dumps(payload, ensure_ascii=False))
    with open(os.path.join(VIDEO_SITE_DIR, "index.html"), "w", encoding="utf-8") as hf:
        hf.write(html)

    # Also update the live count badge on root index.html's .site-switcher link to /video/
    root_idx = os.path.join(SITE_DIR, "index.html")
    if os.path.isfile(root_idx):
        import re as _re
        s = manifest["summary"]
        anc = s["characterAnchorsPass"] + s["locationAnchorsPass"]
        root_html = open(root_idx, encoding="utf-8").read()
        new_link = f'<a href="./video/">🎬 写实影视圣经 · 剧照与视频 (/video/ · 已出 {s["imagesPass"]}图 / {s["videosPass"]}频 / {anc}母本)</a>'
        updated_root = _re.sub(r'<a href="\./video/">[^<]*</a>', new_link, root_html, count=1)
        if updated_root != root_html:
            with open(root_idx, "w", encoding="utf-8") as rf:
                rf.write(updated_root)

    print(
        f"Built {VIDEO_SITE_DIR}/index.html -> "
        f"Images: {manifest['summary']['imagesPass']}/1443, "
        f"Videos: {manifest['summary']['videosPass']}/1443, "
        f"Anchors: {manifest['summary']['characterAnchorsPass'] + manifest['summary']['locationAnchorsPass']}"
    )


if __name__ == "__main__":
    main()
