#!/usr/bin/env python3
"""Gemini Web (https://gemini.google.com/app) batch generator for text-free Bible scene derivatives.

Uses the already-open logged-in Gemini Web tab (tab 3) in SPA 'New chat' mode:
- Never opens bursts of new tabs (avoiding google.com/sorry rate limits).
- Waits for `img[alt="attachment"]` / `img[src^="blob:"]` AND an enabled Send button before sending.
- Resets between scenes via the SPA `a[aria-label="New chat"]` router link (zero full-page reloads).
"""
import base64
import io
import json
import os
import subprocess
import sys
import threading
import time
from PIL import Image

CACHE_PATH = "/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2/wave-prep-cache.json"
REG_PATH = "/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2/content-qc-registry.json"
SOURCE_DIR = "/Volumes/T7/yahwehs-globe-scenes/non-gamified-merged-live-v3"
OUT_ROOT = "/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2/incoming-codex"

OSASCRIPT_LOCK = threading.Lock()


def run_osascript(script: str) -> str:
    with OSASCRIPT_LOCK:
        res = subprocess.run(["osascript", "-"], input=script, capture_output=True, text=True, timeout=30)
        if res.returncode != 0:
            raise RuntimeError(f"osascript error: {res.stderr.strip()}")
        return res.stdout.strip()


def exec_tab_js(tab_index: int, js_code: str, activate: bool = False) -> str:
    act_line = f"set active tab index of window 1 to {tab_index}\n" if activate else ""
    script = f"""
tell application "Google Chrome"
  {act_line}set t to tab {tab_index} of window 1
  return execute t javascript {json.dumps(js_code)}
end tell
"""
    return run_osascript(script)


def find_gemini_tabs() -> list[int]:
    script = """
tell application "Google Chrome"
  set w to window 1
  set tabList to {}
  set n to count of tabs of w
  repeat with i from 1 to n
    set u to URL of tab i of w
    set end of tabList to (i as string) & "|" & u
  end repeat
  return tabList
end tell
"""
    raw = run_osascript(script)
    entries = [x.strip() for x in raw.split(",") if x.strip()]
    tabs = []
    for entry in entries:
        idx_str, url = entry.split("|", 1)
        idx = int(idx_str)
        if url.startswith("https://gemini.google.com"):
            tabs.append(idx)
    if not tabs:
        raise RuntimeError("No open https://gemini.google.com tab found in Chrome window 1")
    return tabs


def reset_chat_spa(tab_index: int) -> bool:
    """Click the SPA 'New chat' link inside Gemini without doing a full-page reload, and clear any leftover attachment chips."""
    js = """
(() => {
  const vidBtn = document.querySelector('button[aria-label*="Deselect Videos"]');
  if (vidBtn) vidBtn.click();
  const closeBtns = [...document.querySelectorAll("gem-attachment button, uploader-file-preview button")];
  closeBtns.forEach(b => b.click());
  const txt = document.body.innerText || "";
  const hasGen = [...document.querySelectorAll("img")].some(i => (i.alt||"").includes("AI generated") || (i.alt||"").includes("Generated image"));
  if (location.pathname !== "/app" || hasGen || txt.includes("Gemini said") || txt.includes("Watch this image come to life")) {
    const btn = document.querySelector('a[aria-label="New chat"]') || document.querySelector('a[href="/app"]') || document.querySelector('[data-test-id="expanded-button"]');
    if (btn) {
      btn.click();
      return "clicked_new_chat";
    }
  }
  const ed = document.querySelector(".ql-editor");
  if (ed) ed.innerHTML = "<p><br></p>";
  return "already_clean";
})()
"""
    exec_tab_js(tab_index, js, activate=True)
    for _ in range(20):
        time.sleep(0.5)
        chk = exec_tab_js(
            tab_index,
            """
(() => {
  const vidBtn = document.querySelector('button[aria-label*="Deselect Videos"]');
  if (vidBtn) vidBtn.click();
  const ed = document.querySelector(".ql-editor");
  const txt = document.body.innerText || "";
  const genImgs = [...document.querySelectorAll("img")].filter(i => (i.alt||"").includes("AI generated") || (i.alt||"").includes("Generated image"));
  const attImgs = [...document.querySelectorAll("img")].filter(i => (i.src||"").startsWith("blob:") || (i.alt||"") === "attachment");
  return Boolean(ed && genImgs.length === 0 && attImgs.length === 0 && !txt.includes("Watch this image come to life"));
})()
""",
        )
        if chk == "true":
            return True
    return False


OCR_SWIFT = "/Users/pliu0036/Documents/CodingProject/yahwehs-globe/tools/scenes/ocr_text_free_images.swift"


def preblur_ocr_boxes(im: Image.Image, tmp_path: str) -> Image.Image:
    """Run Apple Vision OCR on im and replace detected text lines using top/bottom perimeter strips (protecting top-left emblem)."""
    from PIL import ImageFilter
    im.save(tmp_path)
    try:
        out = subprocess.check_output(["swift", OCR_SWIFT, tmp_path], text=True, timeout=15)
        hits = json.loads(out.strip().splitlines()[-1]).get("hits", [])
    except Exception:
        hits = []
    if not hits:
        return im
    out_im = im.copy()
    w, h = out_im.size
    for hit in hits:
        bx, by, bw, bh = hit["box"]
        y_top = 1.0 - (by + bh)
        x0 = max(0.0, bx - 0.006)
        x1 = min(1.0, bx + bw + 0.008)
        y0 = max(0.0, y_top - 0.006)
        y1 = min(1.0, y_top + bh + 0.008)
        # Protect standalone top-left graphic emblem (x < 0.088, y < 0.145)
        if y0 < 0.145 and x0 < 0.088:
            if x1 <= 0.092:
                continue
            x0 = max(x0, 0.088)
        px0, py0, px1, py1 = int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)
        cw, ch = px1 - px0, py1 - py0
        if cw < 4 or ch < 4:
            continue
        top_y0 = max(0, py0 - 4)
        top_strip = out_im.crop((px0, top_y0, px1, max(top_y0 + 1, py0)))
        bot_y1 = min(h, py1 + 4)
        bot_strip = out_im.crop((px0, min(h - 1, py1), px1, bot_y1))
        combined = Image.new("RGB", (cw, 2))
        combined.paste(top_strip.resize((cw, 1), Image.Resampling.BILINEAR), (0, 0))
        combined.paste(bot_strip.resize((cw, 1), Image.Resampling.BILINEAR), (0, 1))
        filled = combined.resize((cw, ch), Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(radius=6))
        out_im.paste(filled, (px0, py0))
    return out_im


def process_one_scene(tab_index: int, scene_id: str, meta: dict, from_candidate: bool = False) -> dict:
    cand_existing = os.path.join(OUT_ROOT, f"{scene_id}-no-text-v1-20261017", "candidate-v1.png")
    src_path = cand_existing if (from_candidate and os.path.exists(cand_existing)) else os.path.join(SOURCE_DIR, f"{scene_id}.png")
    if not os.path.exists(src_path):
        return {"id": scene_id, "ok": False, "error": "missing_source"}

    if not reset_chat_spa(tab_index):
        return {"id": scene_id, "ok": False, "error": "editor_not_ready"}

    time.sleep(1.0)

    # Pre-erase any OCR-detected text boxes using local perimeter strips so Flash-Lite never sees readable text
    src_im = Image.open(src_path).convert("RGB")
    if src_im.width > 1672:
        src_im = src_im.resize((1672, 941), Image.Resampling.LANCZOS)
    src_im = preblur_ocr_boxes(src_im, f"/tmp/preblur_{scene_id}.png")
    buf = io.BytesIO()
    src_im.save(buf, format="JPEG", quality=92)
    b64_src = base64.b64encode(buf.getvalue()).decode("ascii")

    paste_js = f"""
(() => {{
  const b64 = "{b64_src}";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], {{type: "image/jpeg"}});
  const file = new File([blob], "{scene_id}.jpg", {{type: "image/jpeg"}});
  const dt = new DataTransfer();
  dt.items.add(file);
  const ql = document.querySelector(".ql-editor");
  ql.focus();
  ql.dispatchEvent(new ClipboardEvent("paste", {{bubbles: true, cancelable: true, clipboardData: dt}}));
  return "pasted";
}})()
"""
    attached = False
    for attempt in range(2):
        exec_tab_js(tab_index, paste_js, activate=True)
        for _ in range(18):
            time.sleep(0.8)
            chk = exec_tab_js(
                tab_index,
                """
(() => {
  const errChip = document.querySelector(".gem-attachment-loading-error");
  if (errChip) return "error_chip";
  const hasBlobImg = [...document.querySelectorAll("img")].some(i => (i.src||"").startsWith("blob:") || (i.alt||"") === "attachment");
  return hasBlobImg ? "attached" : "waiting";
})()
""",
            )
            if chk == "attached":
                attached = True
                break
            if chk == "error_chip":
                # Refresh tab once if session token expired
                exec_tab_js(tab_index, "location.reload()", activate=True)
                time.sleep(4.5)
                break
        if attached:
            break

    if not attached:
        return {"id": scene_id, "ok": False, "error": "attach_failed"}

    time.sleep(1.5)

    clean_prompt = (
        "Edit this attached voxel-art Bible scene image to make it 100% TEXT-FREE and CARD-FREE: "
        "1. CRITICAL — INPAINT BLURRED TEXT/CARD REGIONS: Completely remove all blurred text patches and translucent rectangular summary card boxes in the top-left and top-right corners, and seamlessly reconstruct crisp 3D voxel sky, clouds, trees, and architecture in their place. ZERO text, letters, or card borders may remain anywhere! "
        "2. KEEP ONLY THE SMALL GRAPHIC ICON: Keep ONLY the small standalone 3D graphic symbol/emblem on the far top-left corner (with ZERO words next to it and ZERO rectangular card box behind it). "
    )
    if not from_candidate and meta.get("needs_full_content_fix") and meta.get("content_fix_instruction"):
        clean_prompt += f"3. CRITICAL BIBLICAL CONTENT FIX: {meta['content_fix_instruction']} "
    elif from_candidate and meta.get("cand_fix_instruction"):
        clean_prompt += f"3. CRITICAL VISUAL FIX: {meta['cand_fix_instruction']} "
    else:
        clean_prompt += "3. Keep all characters, postures, faces, clothing, props, and the rest of the scene 100% unchanged."

    send_js = f"""
(() => {{
  const ql = document.querySelector(".ql-editor");
  ql.focus();
  document.execCommand("insertText", false, {json.dumps(clean_prompt)});
  setTimeout(() => {{
    const btn = document.querySelector('button[aria-label*="Send"]') || [...document.querySelectorAll("button")].find(b => (b.getAttribute("aria-label")||"").includes("Send"));
    if (btn) btn.click();
  }}, 700);
  return "sent";
}})()
"""
    # Ensure mode picker is on 4 Argon (never Flash-Lite or 3.8 Flash)
    mode_chk = exec_tab_js(
        tab_index,
        """
(() => {
  const b = document.querySelector('button[aria-label*="mode picker"]');
  if (b && !(b.innerText || "").includes("Argon")) {
    b.click();
    return "opened_picker";
  }
  return b ? b.innerText.trim() : "ok";
})()
""",
    )
    if mode_chk == "opened_picker":
        time.sleep(0.8)
        exec_tab_js(
            tab_index,
            """
(() => {
  const items = [...document.querySelectorAll('gem-menu-item, [role="menuitem"], [role="menuitemradio"], button.mat-mdc-menu-item, .bard-mode-list-button')];
  const target = items.find(el => (el.innerText || "").includes("Argon"));
  if (target) {
    const innerBtn = target.querySelector('button') || target;
    innerBtn.click();
  }
  return "switched";
})()
""",
            activate=True,
        )
        time.sleep(0.8)

    exec_tab_js(tab_index, send_js, activate=True)

    # Poll up to 85 seconds for AI generated image
    t0 = time.time()
    gen_ready = False
    while time.time() - t0 < 85:
        time.sleep(2.2)
        status = exec_tab_js(
            tab_index,
            """
(() => {
  const txt = document.body.innerText || "";
  const dlBtn = document.querySelector('button[aria-label="Download full-sized image"]');
  const im = [...document.querySelectorAll("img")].find(i => ((i.alt || "").includes("AI generated") || (i.alt || "").includes("Generated image")) && !i.closest("uploader-file-preview"));
  if (dlBtn && im && im.complete && im.naturalWidth > 400) return "ready:" + im.naturalWidth + "x" + im.naturalHeight;
  const m = txt.match(/Your limit resets at [0-9: ]+[ap]m/i);
  if (m) return "quota_limit:" + m[0];
  if (txt.includes("I can create more images as soon as your limit resets")) return "quota_limit:limit_reached";
  return "waiting";
})()
""",
        )
        if status.startswith("ready:"):
            gen_ready = True
            break
        if status == "animate_upsell_error":
            return {"id": scene_id, "ok": False, "error": "flash_lite_animate_upsell_not_real_image"}
        if status.startswith("quota_limit:"):
            return {"id": scene_id, "ok": False, "error": status}

    if not gen_ready:
        return {"id": scene_id, "ok": False, "error": "timeout_waiting_for_image"}

    time.sleep(1.5)
    extract_js = """
(() => {
  const im = [...document.querySelectorAll("img")].find(i => ((i.alt || "").includes("AI generated") || (i.alt || "").includes("Generated image")) && !i.closest("uploader-file-preview"));
  if (!im) return "no_img";
  const c = document.createElement("canvas");
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  c.getContext("2d").drawImage(im, 0, 0);
  return c.toDataURL("image/png");
})()
"""
    data_url = exec_tab_js(tab_index, extract_js)
    if not data_url.startswith("data:image/"):
        return {"id": scene_id, "ok": False, "error": "extract_failed"}

    raw_bytes = base64.b64decode(data_url.split(",", 1)[1])
    donor_im = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    if donor_im.size != (2752, 1536):
        donor_im = donor_im.resize((2752, 1536), Image.Resampling.LANCZOS)

    out_dir = os.path.join(OUT_ROOT, f"{scene_id}-no-text-v1-20261017")
    os.makedirs(out_dir, exist_ok=True)
    donor_path = os.path.join(out_dir, "donor-v1.png")
    cand_path = os.path.join(out_dir, "candidate-v1.png")
    donor_im.save(donor_path)
    donor_im.save(cand_path)

    return {
        "id": scene_id,
        "ok": True,
        "sec": round(time.time() - t0, 1),
        "candidate": cand_path,
        "needs_full_content_fix": bool(meta.get("needs_full_content_fix")),
    }


import square_exceptions
def main():
    raw_args = [a for a in sys.argv[1:] if not a.startswith("--")]
    global_from_cand = "--from-candidate" in sys.argv[1:]
    if not raw_args:
        print("Usage: gemini_web_batch.py [--from-candidate] <scene_id1> [scene_id2+cand ...]")
        sys.exit(1)

    cache = json.load(open(CACHE_PATH))
    reg = json.load(open(REG_PATH))
    reg.update(square_exceptions.registry_overrides())   # per-square exceptions replace the registry text (handoff/32)

    gemini_tabs = find_gemini_tabs()
    tab_idx = gemini_tabs[0]
    print(f"Using open Gemini Web tab {tab_idx} (SPA New-Chat mode) for {len(raw_args)} scenes", flush=True)

    results = []
    for raw_sid in raw_args:
        from_cand = global_from_cand or raw_sid.endswith("+cand")
        sid = raw_sid[:-5] if raw_sid.endswith("+cand") else raw_sid
        meta = dict(cache.get(sid, {"id": sid}))
        if sid in reg and not meta.get("content_fix_instruction"):
            meta["needs_full_content_fix"] = True
            meta["content_fix_instruction"] = reg[sid] if isinstance(reg[sid], str) else json.dumps(reg[sid], ensure_ascii=False)
        res = {}
        for retry in range(3):
            try:
                res = process_one_scene(tab_idx, sid, meta, from_candidate=from_cand)
            except Exception as e:
                res = {"id": sid, "ok": False, "error": str(e)}
            if res.get("error") == "flash_lite_animate_upsell_not_real_image":
                time.sleep(1.5)
                continue
            break
        print(json.dumps(res, ensure_ascii=False), flush=True)
        results.append(res)
        if str(res.get("error", "")).startswith("quota_limit:"):
            print(f"Stopping batch early due to Gemini Web quota limit: {res['error']}", flush=True)
            break
        time.sleep(1.5)

    ok_count = sum(1 for r in results if r.get("ok"))
    print(f"Batch complete: {ok_count}/{len(raw_args)} succeeded", flush=True)


if __name__ == "__main__":
    main()
