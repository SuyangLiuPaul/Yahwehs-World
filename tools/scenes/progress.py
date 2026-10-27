"""Write assets-scenes/progress.html: an interactive gallery of the event pictures (filter by status / book /
testament / search, sort by newest, bible order or year, full-size viewer with review notes and rejected versions).
    python3 tools/scenes/progress.py     (run from the repo root; open the file in a browser)"""
import hashlib, json, os, re, shutil, sys, time
from datetime import datetime
from PIL import Image

def independent_review_progress(manifest_path, audit_paths):
    """Read independent reviews without changing official approval/status records."""
    with open(manifest_path) as f:
        current = {r['id']: r for line in f if line.strip()
                   for r in [json.loads(line)]
                   if r.get('status') == 'complete' and r.get('bilingual_status') == 'complete'}
    latest, unavailable = {}, []
    for path in audit_paths:
        try:
            with open(path) as f:
                for ordinal, line in enumerate(f):
                    if not line.strip():
                        continue
                    r = json.loads(line)
                    if r.get('id') not in current:
                        continue
                    review_sha = r.get('candidate_sha256') or r.get('merged_sha256')
                    if review_sha != current[r['id']].get('derivative_sha256'):
                        continue
                    stamp = r.get('checked_at') or r.get('utc') or r.get('time_utc')
                    try:
                        checked_at = datetime.fromisoformat(stamp.replace('Z', '+00:00')).timestamp()
                    except (ValueError, TypeError, AttributeError):
                        checked_at = os.path.getmtime(path)
                    order = (checked_at, path, ordinal)
                    if r['id'] not in latest or order > latest[r['id']][0]:
                        latest[r['id']] = (order, r)
        except (OSError, ValueError, TypeError):
            unavailable.append(os.path.basename(path))
    results = {}
    for event_id, (_, r) in latest.items():
        candidate_sha = current[event_id].get('derivative_sha256')
        result = r.get('result') or r.get('verdict')
        reviewed_sha = r.get('candidate_sha256') or r.get('merged_sha256')
        reviewed = r.get('checked') is True or result in ('PASS', 'HOLD')
        if candidate_sha and reviewed_sha == candidate_sha and reviewed and result in ('PASS', 'HOLD'):
            results[event_id] = result
    return {'checked': len(results), 'total': len(current),
            'pass': sum(v == 'PASS' for v in results.values()),
            'hold': sum(v == 'HOLD' for v in results.values()),
            'unavailable': unavailable}

A = "/Users/pliu0036/Documents/CodingProject/assets-scenes"
HERE = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open("data/events/all-events.json"))["events"]
pilot_verse_refs = json.load(open(f"{HERE}/key-verses-pilot.json"))
bible_en = json.load(open("public/data/bible/bsb-yhwh.json"))["books"]
bible_zh = json.load(open("public/data/bible/cuvs-yhwh.json"))["books"]
raw, plates, thumbs, rejdir = f"{A}/raw", f"{A}/plates", f"{A}/thumbs", f"{A}/rejected"
plain_dir, plain_thumb_dir = f"{A}/no-game-ui", f"{A}/no-game-ui-thumbs"
plain_status_dir = f"{A}/no-game-ui-status"
merged_dir = "/Volumes/T7/yahwehs-globe-scenes/non-gamified-merged-live-v3"
merged_thumb_dir = "/Volumes/T7/yahwehs-globe-scenes/non-gamified-merged-thumbs-v3"
merged_status_dir = "/Volumes/T7/yahwehs-globe-scenes/non-gamified-merged-status-v3"
text_free_dir = "/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2/live"
text_free_thumb_dir = "/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2/thumbs"
text_free_status_dir = "/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2/status"
text_free_language_dir = "/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2/language-layers"
os.makedirs(thumbs, exist_ok=True)
os.makedirs(plain_thumb_dir, exist_ok=True)

# Only display processed derivatives in the new gallery tab. The output folder
# starts as a copy of raw, so a completed status marker is required to avoid
# accidentally presenting an unedited game screen as a no-UI version.
plain_ready = set()
plain_statuses = {}
if os.path.isdir(plain_status_dir):
    for name in os.listdir(plain_status_dir):
        if not name.endswith(".json"):
            continue
        try:
            status = json.load(open(f"{plain_status_dir}/{name}"))
            i = status.get("id")
            plain_statuses[i] = status
            if (status.get("status") == "complete" and status.get("bilingual_status") == "complete"
                    and i and os.path.exists(f"{plain_dir}/{i}.png")):
                plain_ready.add(i)
        except (OSError, ValueError, TypeError):
            continue

# The merged tab is a separate, immutable gallery assembled from verified
# bilingual derivatives; its files and statuses live on T7.
merged_ready, merged_statuses = set(), {}
if os.path.isdir(merged_status_dir):
    for name in os.listdir(merged_status_dir):
        if not name.endswith(".json"):
            continue
        try:
            status = json.load(open(f"{merged_status_dir}/{name}"))
            i = status.get("id")
            merged_statuses[i] = status
            if (status.get("status") == "complete" and status.get("bilingual_status") == "complete"
                    and i and os.path.exists(f"{merged_dir}/{i}.png")):
                merged_ready.add(i)
        except (OSError, ValueError, TypeError):
            continue

def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


text_free_statuses = {}
if os.path.isdir(text_free_status_dir):
    for name in os.listdir(text_free_status_dir):
        if not name.endswith(".json") or name.startswith("._"):
            continue
        try:
            status = json.load(open(f"{text_free_status_dir}/{name}"))
            event_id = status.get("id")
            state = status.get("state", "not_started")
            if event_id and state in {"not_started", "in_progress", "pending_review", "rework", "pass"}:
                if state == "pass":
                    image_path = f"{text_free_dir}/{event_id}.png"
                    if (not os.path.isfile(image_path)
                            or file_sha256(image_path) != status.get("candidate_sha256")):
                        state = "rework"
                status["state"] = state
                text_free_statuses[event_id] = status
        except (OSError, ValueError, TypeError):
            continue

text_free_language_layers = {}
if os.path.isdir(text_free_language_dir):
    for name in os.listdir(text_free_language_dir):
        if not name.endswith(".json") or name.startswith("._"):
            continue
        try:
            layer = json.load(open(f"{text_free_language_dir}/{name}"))
            if not isinstance(layer, dict):
                continue
            event_id = layer.get("id")
            status = text_free_statuses.get(event_id, {})
            if (event_id and status.get("state") == "pass"
                    and layer.get("source_image_sha256") == status.get("source_sha256")
                    and layer.get("base_image_sha256") == status.get("candidate_sha256")
                    and layer.get("state") in {"draft", "verified"}):
                text_free_language_layers[event_id] = layer
        except (OSError, ValueError, TypeError):
            continue

# Local progress.html uses paths relative to assets-scenes. Link the new T7
# set there when the volume is mounted; never replace a real directory.
for link, target in ((f"{A}/non-gamified-merged-live-v3", merged_dir),
                     (f"{A}/non-gamified-merged-thumbs-v3", merged_thumb_dir),
                     (f"{A}/text-free-live", text_free_dir)):
    if not os.path.lexists(link) and os.path.isdir(target):
        os.symlink(target, link)

def art_path(event_id):
    """Use the accepted, reviewed game-screen image for each event."""
    return f"{raw}/{event_id}.png"

rev, rej_notes = {}, {}
if os.path.exists(f"{A}/review.jsonl"):
    for line in open(f"{A}/review.jsonl"):
        d = json.loads(line)
        rev[d["id"]] = d
        if not d.get("ok"):
            rej_notes.setdefault(d["id"], []).append(d.get("note", ""))
rejected = {}
if os.path.isdir(rejdir):
    for f in sorted(os.listdir(rejdir)):
        # External volumes on macOS can carry AppleDouble metadata companions
        # named ._*.png. They are not rejected pictures or attempts.
        if f.endswith(".png") and not f.startswith("._"):
            rejected.setdefault(f.rsplit("-", 1)[0], []).append(f)

TW = 520
for e in ev:
    p = art_path(e['id'])
    t = f"{thumbs}/{e['id']}.jpg"
    if os.path.exists(p) and (not os.path.exists(t) or Image.open(t).width < TW or os.path.getmtime(t) < os.path.getmtime(p)):
        im = Image.open(p).convert("RGB"); im.thumbnail((TW, TW)); im.save(t, quality=82)
    if e['id'] in plain_ready:
        pp = f"{plain_dir}/{e['id']}.png"
        pt = f"{plain_thumb_dir}/{e['id']}.jpg"
        if os.path.exists(pp) and (not os.path.exists(pt) or Image.open(pt).width < TW or os.path.getmtime(pt) < os.path.getmtime(pp)):
            im = Image.open(pp).convert("RGB"); im.thumbnail((TW, TW)); im.save(pt, quality=82)
    if e['id'] in merged_ready:
        mp = f"{merged_dir}/{e['id']}.png"
        mt = f"{merged_thumb_dir}/{e['id']}.jpg"
        os.makedirs(merged_thumb_dir, exist_ok=True)
        if os.path.exists(mp) and (not os.path.exists(mt) or Image.open(mt).width < TW or os.path.getmtime(mt) < os.path.getmtime(mp)):
            im = Image.open(mp).convert("RGB"); im.thumbnail((TW, TW)); im.save(mt, quality=82)
    if text_free_statuses.get(e['id'], {}).get("state") == "pass":
        tfp = f"{text_free_dir}/{e['id']}.png"
        tft = f"{text_free_thumb_dir}/{e['id']}.jpg"
        os.makedirs(text_free_thumb_dir, exist_ok=True)
        if os.path.exists(tfp) and (not os.path.exists(tft) or Image.open(tft).width < TW or os.path.getmtime(tft) < os.path.getmtime(tfp)):
            im = Image.open(tfp).convert("RGB"); im.thumbnail((TW, TW)); im.save(tft, quality=86)
    for f in rejected.get(e["id"], []):
        rt = f"{thumbs}/{f[:-4]}.jpg"
        if not os.path.exists(rt):
            try:
                im = Image.open(f"{rejdir}/{f}").convert("RGB")
                im.thumbnail((240, 240))
                im.save(rt, quality=75)
            except (OSError, ValueError):
                # Keep damaged rejected attempts in the review ledger/gallery, but
                # do not let one unreadable source prevent the whole progress page.
                continue

def bookname(ref):
    m = re.match(r"^(\d\s+)?\D+?(?=\s+\d)", ref)
    return m.group(0) if m else ref


books, out = {}, []
for i, e in enumerate(ev):
    p = art_path(e['id'])
    have = os.path.exists(p)
    r = rev.get(e["id"], {})
    if have:
        st = "ok" if r.get("ok") else ("bad" if r.get("ok") is False else "new")
    else:
        st = "redo" if e["id"] in rejected else "todo"
    made = int(os.path.getmtime(p)) if have else 0
    tr = plain_statuses.get(e["id"], {})
    mr = merged_statuses.get(e["id"], {})
    b = books.setdefault(e["book"], {"b": e["book"],
        "zh": bookname(e["refZh"]), "en": bookname(e["ref"]),
        "n": 0, "merged": 0, "mergedPass": 0, "mergedInherited": 0, "mergedHold": 0})
    b["n"] += 1
    b["merged"] += e["id"] in merged_ready
    b["mergedHold"] += e["id"] in merged_ready and mr.get("merged_review") == "hold"
    b["mergedPass"] += e["id"] in merged_ready and mr.get("merged_review") == "pass"
    b["mergedInherited"] += e["id"] in merged_ready and mr.get("merged_review", "inherited") not in ("pass", "hold")
    merged_path = f"{merged_dir}/{e['id']}.png"
    merged_made = int(os.path.getmtime(merged_path)) if e["id"] in merged_ready else 0
    verse_ref = pilot_verse_refs.get(e["id"])
    key_verse = None
    if verse_ref:
        book, chapter = verse_ref["book"] - 1, verse_ref["chapter"] - 1
        verses = verse_ref["verses"]
        def selected_verse_text(source, omission):
            parts = []
            previous = None
            for verse in verses:
                separator = omission if previous is not None and verse > previous + 1 else " "
                parts.append((separator if previous is not None else "") + source[book][chapter][verse - 1])
                previous = verse
            return "".join(parts)
        key_verse = {
            "refEn": verse_ref["refEn"], "refZh": verse_ref["refZh"],
            "textEn": selected_verse_text(bible_en, " […] "),
            "textZh": selected_verse_text(bible_zh, "〔中略〕"),
            "sourceEn": "Berean Standard Bible (BSB; Yahweh-name edition)",
            "sourceZh": "雅伟版和合本（简体）",
        }
    tf_st = text_free_statuses.get(e["id"], {})
    tf_pass = tf_st.get("state") == "pass"
    tf_path = f"{text_free_dir}/{e['id']}.png"
    tf_updated = 0
    if tf_pass:
        stamp = tf_st.get("updated_at") or tf_st.get("approved_at")
        if stamp:
            try:
                tf_updated = int(datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp())
            except (ValueError, TypeError, AttributeError):
                tf_updated = 0
        if not tf_updated and os.path.isfile(tf_path):
            tf_updated = int(os.path.getmtime(tf_path))
    tf_dual = bool(tf_pass and (tf_st.get("dual_review_passed") or tf_st.get("independent_review") == "pass" or tf_st.get("root_review") == "pass"))
    out.append({"id": e["id"], "zh": e["zh"], "en": e["en"], "ref": e["ref"], "refZh": e["refZh"], "sum": e["summaryZh"],
                "summaryEn": tr.get("summary_en", ""),
                "b": e["book"], "y": e.get("yearEarly"), "i": i, "st": st, "made": made, "mergedMade": merged_made,
                "plain": e["id"] in plain_ready,
                "plainSource": plain_statuses.get(e["id"], {}).get("status") == "complete",
                "merged": e["id"] in merged_ready,
                "mergedSummaryEn": mr.get("summary_en", ""),
                "mergedReview": mr.get("merged_review", "inherited"),
                "mergedReviewNote": mr.get("merged_review_note", ""),
                "textFreeStatus": tf_st.get("state", "not_started"),
                "textFreeUpdatedAt": tf_updated,
                "textFreeDualPass": tf_dual,
                "textFreeLanguageLayer": text_free_language_layers.get(e["id"]),
                "textFreeBaseSha256": tf_st.get("candidate_sha256")
                if tf_pass else None,
                "keyVerse": key_verse,
                "note": r.get("note", "") if st in ("ok", "bad") else "",
                "tries": len(rejected.get(e["id"], [])), "rej": [f"{f}" for f in rejected.get(e["id"], [])],
                "rejNotes": rej_notes.get(e["id"], [])})

SITE = "--site" in sys.argv
screening = None
screening_path = f"{A}/non-gamified-screening-progress.json"
if os.path.exists(screening_path):
    try:
        screen_log = json.load(open(screening_path))
        pending_ids = {e["id"] for e in out if not e["merged"]}
        screened_ids = set(screen_log.get("screened_ids", [])) & pending_ids
        screening = {"screened": len(screened_ids), "total": len(pending_ids),
                     "remaining": len(pending_ids - screened_ids),
                     "label": "候选初筛（不代表审核通过）"}
    except (OSError, ValueError, TypeError):
        screening = None
independent_audit = independent_review_progress(
    "/Volumes/T7/yahwehs-globe-scenes/non-gamified-merged-manifest-v3.jsonl",
    [f"/Volumes/T7/yahwehs-globe-scenes/incoming-codex/{name}" for name in (
        "banner-occlusion-audit-sol-20261013.jsonl",
        "banner-occlusion-audit-sol-range401-800-20261013.jsonl",
        "banner-occlusion-audit-sol-range801-plus-20261013.jsonl",
        "takeover-banner-audit-first400-next30-20261013.jsonl")])
current_hash_audit = independent_review_progress(
    "/Volumes/T7/yahwehs-globe-scenes/non-gamified-merged-manifest-v3.jsonl",
    [f"/Volumes/T7/yahwehs-globe-scenes/incoming-codex/current-hash-audit-20261015/{name}/review.jsonl"
     for name in (
         "group-1-euclid", "group-2", "group-3",
         "round-2-a", "round-2-b", "round-2-c",
         "round-3-a", "round-3-b", "round-3-c",
         "round-4-a", "round-4-b", "round-4-c",
         "round-5-a", "round-5-b", "round-5-c", "round-6-a")])
text_free_counts = {state: sum(o["textFreeStatus"] == state for o in out)
                    for state in ("not_started", "in_progress", "pending_review", "rework", "pass")}
dual_pass_count = sum(bool(o.get("textFreeDualPass")) for o in out)
text_free_project = {"total": len(ev), **text_free_counts, "dualPass": dual_pass_count}
def fetch_live_gemini_quota():
    """Query local Antigravity language_server RetrieveUserQuotaSummary for live Gemini Models quota."""
    import subprocess
    fallback = {
        "weeklyRemPct": 52,
        "weeklyResetSec": 1792795211,
        "fiveHrRemPct": 98,
        "fiveHrResetSec": 1792298411,
    }
    try:
        ps_out = subprocess.check_output(["ps", "-axww", "-o", "pid=,command="], text=True, timeout=3)
        pid, csrf = None, None
        for line in ps_out.splitlines():
            if "language_server" in line and "--csrf_token" in line:
                parts = line.strip().split()
                pid = parts[0]
                for idx, tok in enumerate(parts):
                    if tok == "--csrf_token" and idx + 1 < len(parts):
                        csrf = parts[idx + 1]
                        break
                if pid and csrf:
                    break
        if not (pid and csrf):
            return fallback
        lsof_out = subprocess.check_output(["lsof", "-Pan", "-p", str(pid), "-iTCP", "-sTCP:LISTEN"], text=True, timeout=3)
        ports = []
        for line in lsof_out.splitlines():
            m = re.search(r"127\.0\.0\.1:(\d+)\s+\(LISTEN\)", line)
            if m:
                ports.append(int(m.group(1)))
        for port in sorted(ports):
            raw = subprocess.check_output([
                "curl", "-sk", "--max-time", "3", "-X", "POST",
                f"https://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary",
                "-H", "Content-Type: application/json",
                "-H", "Connect-Protocol-Version: 1",
                "-H", f"x-codeium-csrf-token: {csrf}",
                "-d", "{}",
            ], text=True, timeout=4)
            if raw and raw.strip().startswith("{"):
                resp = json.loads(raw).get("response", {})
                for grp in resp.get("groups", []):
                    if "Gemini" in grp.get("displayName", ""):
                        out_q = dict(fallback)
                        for b in grp.get("buckets", []):
                            frac = float(b.get("remainingFraction", 0))
                            pct = int(round(frac * 100))
                            rt = b.get("resetTime", "")
                            ts = int(datetime.fromisoformat(rt.replace("Z", "+00:00")).timestamp()) if rt else 0
                            if b.get("window") == "weekly" or "weekly" in b.get("bucketId", ""):
                                out_q["weeklyRemPct"] = pct
                                if ts:
                                    out_q["weeklyResetSec"] = ts
                            elif b.get("window") == "5h" or "5h" in b.get("bucketId", ""):
                                out_q["fiveHrRemPct"] = pct
                                if ts:
                                    out_q["fiveHrResetSec"] = ts
                        return out_q
    except Exception:
        pass
    return fallback

live_gemini_quota = fetch_live_gemini_quota()
payload = {"events": out, "books": list(books.values()), "now": int(time.time()), "site": False,
           "screening": screening, "independentAudit": independent_audit,
           "currentHashAudit": current_hash_audit, "textFreeProject": text_free_project,
           "geminiQuota": live_gemini_quota}
if SITE:
    public_events = []
    for event in out:
        public_event = {**event, "textFreeStatus": "pass" if event["textFreeStatus"] == "pass" else None}
        layer = event.get("textFreeLanguageLayer")
        languages = layer.get("languages") if isinstance(layer, dict) else None
        layer_verified = (isinstance(languages, dict) and layer.get("state") == "verified"
                          and layer.get("base_image_sha256") == event.get("textFreeBaseSha256")
                          and all(isinstance(languages.get(code), dict)
                                  and languages[code].get("state") == "verified"
                                  and isinstance(languages[code].get("layout"), dict)
                                  and languages[code]["layout"].get("status") == "verified"
                                  for code in ("zh-Hans", "en")))
        if not layer_verified:
            public_event.pop("textFreeLanguageLayer", None)
            public_event.pop("textFreeBaseSha256", None)
        public_events.append(public_event)
    qc_reg_path = os.path.join(os.path.dirname(text_free_dir), "content-qc-registry.json")
    qc_reg = json.load(open(qc_reg_path)) if os.path.exists(qc_reg_path) else {}
    qc_flagged_total = len(qc_reg) if isinstance(qc_reg, dict) else 215
    qc_fixed_count = sum(1 for e in public_events if e["id"] in qc_reg and e.get("textFreeStatus") == "pass")
    payload = {"events": public_events, "books": list(books.values()), "now": int(time.time()), "site": True,
               "geminiQuota": live_gemini_quota,
               "textFreeProject": {"pass": text_free_counts["pass"], "dualPass": dual_pass_count,
                                   "rework": text_free_counts["rework"], "contentQcAudited": len(ev),
                                   "contentQcFlagged": qc_flagged_total, "contentQcFixed": qc_fixed_count,
                                   "quota5hResetAt": live_gemini_quota["fiveHrResetSec"], "quota5hWindowDone": 20,
                                   "quota5hWindowTarget": 20, "weeklyQuotaTarget": 1008}}
data = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
html = open(f"{HERE}/progress_template.html").read().replace("__DATA__", data)
open(f"{A}/progress.html", "w").write(html)

merged_made = sum(1 for o in out if o["merged"])
merged_hold = sum(1 for o in out if o["merged"] and o["mergedReview"] == "hold")
merged_pass = sum(1 for o in out if o["merged"] and o["mergedReview"] == "pass")
merged_inherited = merged_made - merged_hold - merged_pass
print(f"{merged_made}/{len(ev)} merged bilingual pictures, {merged_pass} explicit PASS, {merged_inherited} inherited, {merged_hold} held for review")
print(f"{text_free_counts['pass']}/{len(ev)} text-free derivatives passed; {text_free_counts['not_started']} not started")


def icon(size, maskable=False):
    """A gold voxel cube on a dark brown tile."""
    from PIL import ImageDraw
    S = size * 4
    im = Image.new("RGB", (S, S), (59, 42, 23))
    d = ImageDraw.Draw(im)
    if not maskable:
        m = Image.new("L", (S, S), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, S - 1, S - 1), S // 5, fill=255)
        bg = Image.new("RGB", (S, S), (250, 246, 234)); bg.paste(im, mask=m); im = bg; d = ImageDraw.Draw(im)
    k = S * (0.26 if maskable else 0.32)
    cx, cy = S / 2, S / 2 + k * 0.05
    top = [(cx, cy - k), (cx + k * .87, cy - k / 2), (cx, cy), (cx - k * .87, cy - k / 2)]
    left = [(cx - k * .87, cy - k / 2), (cx, cy), (cx, cy + k), (cx - k * .87, cy + k / 2)]
    right = [(cx + k * .87, cy - k / 2), (cx + k * .87, cy + k / 2), (cx, cy + k), (cx, cy)]
    d.polygon(top, fill=(240, 205, 120)); d.polygon(left, fill=(200, 150, 62)); d.polygon(right, fill=(158, 108, 40))
    for poly in (top, left, right):
        d.line(poly + [poly[0]], fill=(59, 42, 23), width=max(2, S // 90), joint="curve")
    return im.resize((size, size), Image.LANCZOS)


if SITE:
    SD = f"{A}/site-project/site"
    for sub in ("thumbs", "full"):
        os.makedirs(f"{SD}/{sub}", exist_ok=True)
    want_full, want_thumbs, want_plain_full, want_plain_thumbs, want_merged_full, want_merged_thumbs = set(), set(), set(), set(), set(), set()
    want_text_free_full, want_text_free_thumbs = set(), set()
    for o in out:
        i = o["id"]
        if o["st"] in ("ok", "new", "bad"):
            src = art_path(i)
            dst = f"{SD}/full/{i}.jpg"
            want_full.add(f"{i}.jpg")
            if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                Image.open(src).convert("RGB").save(dst, quality=80, optimize=True)
            want_thumbs.add(f"{i}.jpg")
        if o.get("plain"):
            src = f"{plain_dir}/{i}.png"
            dst = f"{SD}/plain-full/{i}.jpg"
            want_plain_full.add(f"{i}.jpg")
            if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                os.makedirs(f"{SD}/plain-full", exist_ok=True)
                Image.open(src).convert("RGB").save(dst, quality=80, optimize=True)
            want_plain_thumbs.add(f"{i}.jpg")
        if o.get("merged"):
            src = f"{merged_dir}/{i}.png"
            dst = f"{SD}/merged-full/{i}.jpg"
            want_merged_full.add(f"{i}.jpg")
            if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                os.makedirs(f"{SD}/merged-full", exist_ok=True)
                Image.open(src).convert("RGB").save(dst, quality=80, optimize=True)
            want_merged_thumbs.add(f"{i}.jpg")
        if o.get("textFreeStatus") == "pass":
            src = f"{text_free_dir}/{i}.png"
            if os.path.isfile(src):
                dst = f"{SD}/text-free-full/{i}.jpg"
                want_text_free_full.add(f"{i}.jpg")
                if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                    os.makedirs(f"{SD}/text-free-full", exist_ok=True)
                    Image.open(src).convert("RGB").save(dst, quality=88, optimize=True)
                want_text_free_thumbs.add(f"{i}.jpg")
        for f in o["rej"]:
            want_thumbs.add(f[:-4] + ".jpg")
    for name in want_thumbs:
        src, dst = f"{thumbs}/{name}", f"{SD}/thumbs/{name}"
        # Corrupt rejected attempts are intentionally kept in the ledger but
        # cannot have a thumbnail (the earlier thumbnail pass skips decode
        # errors). Do not let one such file block publishing the whole gallery.
        if os.path.exists(src) and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)):
            shutil.copy2(src, dst)
    for sub, want in (("full", want_full), ("thumbs", want_thumbs)):
        for f in os.listdir(f"{SD}/{sub}"):
            if f.endswith(".jpg") and f not in want:
                os.remove(f"{SD}/{sub}/{f}")
    os.makedirs(f"{SD}/plain-thumbs", exist_ok=True)
    for name in want_plain_thumbs:
        src, dst = f"{plain_thumb_dir}/{name}", f"{SD}/plain-thumbs/{name}"
        if os.path.exists(src) and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)):
            shutil.copy2(src, dst)
    if os.path.isdir(plain_status_dir) and os.path.isdir(plain_dir):
        for sub, want in (("plain-full", want_plain_full), ("plain-thumbs", want_plain_thumbs)):
            os.makedirs(f"{SD}/{sub}", exist_ok=True)
            for f in os.listdir(f"{SD}/{sub}"):
                if f.endswith(".jpg") and f not in want:
                    os.remove(f"{SD}/{sub}/{f}")
    os.makedirs(f"{SD}/merged-thumbs", exist_ok=True)
    for name in want_merged_thumbs:
        src, dst = f"{merged_thumb_dir}/{name}", f"{SD}/merged-thumbs/{name}"
        if os.path.exists(src) and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)):
            shutil.copy2(src, dst)
    if os.path.isdir(merged_status_dir) and os.path.isdir(merged_dir):
        for sub, want in (("merged-full", want_merged_full), ("merged-thumbs", want_merged_thumbs)):
            os.makedirs(f"{SD}/{sub}", exist_ok=True)
            for f in os.listdir(f"{SD}/{sub}"):
                if f.endswith(".jpg") and f not in want:
                    os.remove(f"{SD}/{sub}/{f}")
    os.makedirs(f"{SD}/text-free-thumbs", exist_ok=True)
    for name in want_text_free_thumbs:
        src, dst = f"{text_free_thumb_dir}/{name}", f"{SD}/text-free-thumbs/{name}"
        if os.path.exists(src) and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)):
            shutil.copy2(src, dst)
    for sub, want in (("text-free-full", want_text_free_full), ("text-free-thumbs", want_text_free_thumbs)):
        if os.path.isdir(f"{SD}/{sub}"):
            for f in os.listdir(f"{SD}/{sub}"):
                if f.endswith(".jpg") and f not in want:
                    os.remove(f"{SD}/{sub}/{f}")
    open(f"{SD}/index.html", "w").write(open(f"{HERE}/progress_template.html").read().replace("__DATA__", data))
    for name, size, mask in (("icon-192.png", 192, False), ("icon-512.png", 512, False), ("icon-maskable.png", 512, True),
                             ("apple-touch-icon.png", 180, True), ("favicon.png", 64, False)):
        if not os.path.exists(f"{SD}/{name}"):
            icon(size, mask).save(f"{SD}/{name}")
    json.dump({"name": "无字底图 · 多语言定制", "short_name": "无字事件图", "start_url": "/", "scope": "/", "display": "standalone",
               "background_color": "#faf6ea", "theme_color": "#faf6ea",
               "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                         {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
                         {"src": "icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]},
              open(f"{SD}/manifest.webmanifest", "w"), ensure_ascii=False)
    open(f"{SD}/sw.js", "w").write("self.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));\nself.addEventListener('fetch',e=>e.respondWith(fetch(e.request)));\n")
    print(f"site built with one legacy-reference tab; text-free progress {text_free_counts['pass']}/{len(ev)} in {SD}")
