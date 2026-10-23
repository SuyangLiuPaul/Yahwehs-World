#!/usr/bin/env python3
"""Checks for the 雅伟之界 text pack. Standard library only.

    python3 data/text/tests/test_textpack.py      # prints the measurements
    python3 -m pytest data/text/tests              # same checks under pytest

What is asserted:
  * manifest: every file's sha256 matches MANIFEST.json, and no file in the
    pack is missing from it;
  * residue: zero Strong's / <H0> / <G0> tags in any raw scripture file,
    and zero markup of any kind ([ ] { } <...> ¶ <note:) in display text;
  * divine-name rule: the port matches Words' behaviour on fixed cases and
    on each edition's printed name;
  * versification: 50 sampled refs map English -> Synodal -> English, the
    Synodal ref exists, and the rst text at the English id exists;
  * section titles: 4 sets x 2,597 sections, each with title + context,
    each anchored on a verse that exists;
  * no excluded edition is in the pack.
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import re
import sys

PACK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PACK)

import divine_name as dn  # noqa: E402
import textpack as tp  # noqa: E402

REPORT: dict = {}

# Tags a Strong's-tagged module leaves behind: <H0>, <G0>, <H1234>, <G3588>,
# <WH1234>, <WG3588>, <TH8804>, <sup>..</sup> etc.
STRONGS_TAG = re.compile(r"<\s*/?\s*(?:W?[HG]\d+[a-z]?|T[HG]\d+|sup|/sup|S|FI|Fi|CM|CL|RF|Rf)\s*>")
HG0 = re.compile(r"<[HG]0>")
DISPLAY_RESIDUE = {
    "angle-tag": re.compile(r"<[^>]*>"),
    "note-open": re.compile(r"<note"),
    "square": re.compile(r"[\[\]]"),
    "brace": re.compile(r"[{}]"),
    "pilcrow": re.compile(r"[¶§]"),
    "strongs-number": re.compile(r"\b[HG]\d{1,4}\b"),
}


def _sha(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def _manifest() -> dict:
    return json.load(open(os.path.join(PACK, "MANIFEST.json"), encoding="utf-8"))


# ------------------------------------------------------------------ tests

def test_manifest_shas():
    m = _manifest()["files"]
    for rel, e in m.items():
        assert _sha(os.path.join(PACK, rel)) == e["sha256"], f"sha mismatch: {rel}"
    on_disk = set()
    for root, dirs, files in os.walk(PACK):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", ".pytest_cache")]
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), PACK)
            if rel != "MANIFEST.json" and not f.endswith(".pyc") and f != ".DS_Store":
                on_disk.add(rel)
    assert on_disk == set(m), f"not in manifest: {on_disk - set(m)}; missing: {set(m) - on_disk}"
    REPORT["manifest"] = f"{len(m)} files verified"


def test_residue_zero():
    counts = {}
    for code in tp.EDITIONS:
        raw = tp.edition(code)
        c = {"raw-<H0>/<G0>": 0, "raw-strongs-tag": 0}
        c.update({f"display-{k}": 0 for k in DISPLAY_RESIDUE})
        for t in raw.values():
            c["raw-<H0>/<G0>"] += len(HG0.findall(t))
            c["raw-strongs-tag"] += len(STRONGS_TAG.findall(t))
            d = dn.display_text(t)
            for k, rx in DISPLAY_RESIDUE.items():
                c[f"display-{k}"] += len(rx.findall(d))
        counts[code] = c
    REPORT["residue"] = counts
    bad = {code: {k: n for k, n in c.items() if n} for code, c in counts.items() if any(c.values())}
    assert not bad, f"residue found: {bad}"


def test_divine_name_rule():
    n = dn.normalize_divine_names
    assert n("The LORD is my shepherd") == "Yahweh is my shepherd"
    assert n("and the LORD said") == "and Yahweh said"
    assert n("the LORD's house") == "Yahweh's house"
    assert n("O LORD, my God") == "O Yahweh, my God"
    assert n("the Lord GOD") == "the Lord GOD"          # Adonai YHWH: untouched
    assert n("the Lord Jesus") == "the Lord Jesus"      # kyrios: untouched
    assert n("LORDS") == "LORDS"                        # whole word only
    assert n("耶和华是我的牧者") == "雅伟是我的牧者"
    assert n("耶和華是我的牧者") == "雅偉是我的牧者"
    assert n("Господь - Пастырь мой") == "Господь - Пастырь мой"  # no Russian rule
    assert n("YHWH is my shepherd") == "YHWH is my shepherd"      # JPS stays YHWH
    assert tp.verse("kjv", "Psalms", 23, 1) == "Yahweh is my shepherd; I shall not want."
    assert tp.verse("kjv", "Psalms", 23, 1, raw=True).startswith("The LORD is my shepherd")
    assert tp.verse("cuvs-yhwh", "Psalms", 23, 1) == "（大卫的诗。）雅伟是我的牧者，我必不致缺乏。"
    # Words' kEditionMeasurements printedName -> shownName
    expected_shown = {"kjv": "Yahweh", "bsb-yhwh": "Yahweh", "jps": "YHWH", "brenton": "Lord",
                      "rst": "Господь", "cuvs-yhwh": "雅伟", "cuvs-yhwh-tr": "雅偉", "wlc": "יהוה"}
    for code, shown in expected_shown.items():
        assert dn.shown_name(code) == shown, code
        assert dn.EDITIONS[code]["shown"] == shown, code
    # display_text: referent brackets marked in Chinese, plain in English, notes gone
    assert dn.display_text("主[雅伟]的道<note:注>，，好") == "主〔雅伟〕的道，好"
    assert dn.display_text("by [Jesus] {they} the LORD") == "by Jesus they Yahweh"
    # after the rule, no all-caps LORD survives in any English display text
    left = {c: sum(len(re.findall(r"\bLORD\b", dn.display_text(t), re.ASCII)) for t in tp.edition(c).values())
            for c in ("bsb-yhwh", "asv-yhwh", "web-yhwh", "kjv", "jps", "brenton")}
    assert not any(left.values()), left
    raw_lord = {c: sum(1 for t in tp.edition(c).values() if re.search(r"\bLORD\b", t, re.ASCII))
                for c in ("bsb-yhwh", "asv-yhwh", "web-yhwh", "kjv", "jps")}
    REPORT["divine-name"] = {"verses printing LORD (shown Yahweh)": raw_lord,
                             "LORD left after rule": left}


def test_versification_sample_50():
    vr = json.load(open(os.path.join(PACK, "versification-ru.json"), encoding="utf-8"))
    rst = tp.edition("rst")
    bsb = tp.edition("bsb-yhwh")
    books = vr["books"]
    must = ["019003001", "019010001", "019023001", "019051001", "019051002", "019060001", "019116010",
            "019147012", "039004001", "039004006", "045016025", "045016027", "029002028", "022001002", "064001014",
            "004013001", "002022001", "018041001", "032002001", "047013012"]
    rng = random.Random(20261023)
    pool = sorted(set(vr["enToRu"]) - set(must) - set(vr["noRussianVerse"]))
    sample = must + rng.sample(pool, 50 - len(must))
    assert len(sample) == 50 and len(set(sample)) == 50
    rows = []
    for en in sample:
        assert en in rst, f"{en} is not an English (KJV) id"
        refs = vr["enToRu"].get(en, [f"{int(en[3:6])}:{int(en[6:])}"])
        assert refs, en
        b = int(en[:3])
        for r in refs:
            c, v = map(int, r.split(":"))
            cv = vr["ruChapterVerses"][books[b - 1]]
            assert 1 <= c <= len(cv) and 1 <= v <= cv[c - 1], f"{en} -> {r} not a Synodal verse"
            sid = f"{b:03d}{c:03d}{v:03d}"
            assert vr["ruToEn"].get(sid, sid) == en, f"round trip {en} -> {r} -> {vr['ruToEn'].get(sid, sid)}"
        text = rst.get(en) or rst.get(vr["joined"].get(en, ""), "")
        assert text.strip(), f"no rst text at {en}"
        if en not in vr["bsbOmits"]:
            assert en in bsb, f"bsb-yhwh has no {en}"
        rows.append((en, refs))
    REPORT["versification"] = {
        "sampled": len(rows),
        "examples": {tp.books()[int(e[:3]) - 1] + f" {int(e[3:6])}:{int(e[6:])}": r for e, r in rows[:14]},
        "ru_ref(Psalms 23:1)": tp.ru_ref("Psalms", 23, 1),
        "ru_ref(Malachi 4:1)": tp.ru_ref("Malachi", 4, 1),
        "ru_ref(Romans 16:25)": tp.ru_ref("Romans", 16, 25),
        "counts": vr["_meta"]["counts"],
    }
    assert tp.ru_ref("Psalms", 23, 1) == "Psalms 22:1"
    assert tp.ru_ref("Romans", 16, 25) == "Romans 14:24"
    assert tp.ru_ref("Genesis", 1, 1) == "Genesis 1:1"


def test_versification_covers_every_rst_verse():
    vr = json.load(open(os.path.join(PACK, "versification-ru.json"), encoding="utf-8"))
    rst = tp.edition("rst")
    empty = {i for i, t in rst.items() if not t.strip()}
    assert empty == set(vr["joined"]), (sorted(empty), sorted(vr["joined"]))
    for i, j in vr["joined"].items():
        assert rst[j].strip(), i
    # every Synodal verse is reachable: identity or ruToEn
    n = sum(sum(cv) for cv in vr["ruChapterVerses"].values())
    assert n == vr["_meta"]["counts"]["synodalVerses"], n


def test_section_titles():
    st = json.load(open(os.path.join(PACK, "section_titles.json"), encoding="utf-8"))
    cuv = tp.edition("cuvs-yhwh")
    counts = {}
    for name in tp.SECTION_SETS:
        secs = [(b, c, s) for b, chs in st["sets"][name].items() for c, xs in chs.items() for s in xs]
        counts[name] = len(secs)
        assert len(secs) == 2597, (name, len(secs))
        for b, c, s in secs:
            assert s.get("title") and s.get("context"), (name, b, c, s)
            assert tp.vid(b, int(c), s["verse"]) in cuv, (name, b, c, s["verse"])
    forbidden = ["祂", "三位一体", "位格", "神性", "耶和华", "耶和華", "上帝", "Trinity", "triune", "Godhead"]
    blob = json.dumps(st["sets"], ensure_ascii=False)
    hits = {w: blob.count(w) for w in forbidden if w in blob}
    assert not hits, hits
    assert tp.section("Genesis", 18, 1, "cuv")["verse"] == 1
    REPORT["section-titles"] = counts


def test_excluded_editions_absent():
    present = {f[:-5] for f in os.listdir(os.path.join(PACK, "bible"))}
    assert present == set(tp.EDITIONS), present
    for code in ("leb", "net", "cnet", "cnet-tr", "csb", "nasb", "lxx", "lzz", "lzz-tr", "rst-s"):
        assert code not in present, code


if __name__ == "__main__":
    failed = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as e:
                failed += 1
                print(f"FAIL {name}: {e}")
    print(json.dumps(REPORT, ensure_ascii=False, indent=1))
    sys.exit(1 if failed else 0)
