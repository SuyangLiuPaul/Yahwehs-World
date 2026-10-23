#!/usr/bin/env python3
"""Build (or rebuild) the 雅伟之界 text pack, data/text/.

    python3 data/text/tools/build_textpack.py \
        --words /Volumes/androidbuild/Words-182 \
        --sword /Volumes/androidbuild/Sword-182 \
        [--russyn-vpl path/to/russyn_vpl.txt]

1. Copies each shipped edition and section_titles.json from Words' HEAD
   commit (git cat-file, not the working tree), and refuses if the working
   file differs from HEAD, so a copy is always a committed version.
2. Compares section_titles.json with Sword's copy and records the result.
3. With --russyn-vpl, rebuilds versification-ru.json by aligning eBible's
   Synodal (Synodal numbering) with Words' rst.json (KJV numbering). Every
   rst verse must be reassembled exactly from the Synodal verses mapped to
   it, or the build stops. Without it the existing table is kept.
4. Writes MANIFEST.json (sha256 of every file in the pack).

Only this script writes the pack. Never edit a copied file by hand.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys

PACK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# code -> licence + attribution. Wording quotes Words' About page
# (lib/constants/ui_strings.dart aboutLicense*) and docs/permissions/README.md.
EDITIONS = {
    "cuvs-yhwh": dict(
        name="和合本雅伟版（简体）/ CUV, Yahweh edition (Simplified)",
        licence="Permission (Yahweh De Hua Ministry)",
        attribution="© 雅伟的话事工 · 经授权使用。 / © Yahweh De Hua Ministry · used with permission.",
        notes="Words' revised text: the pastor's rulings 凯撒/希腊/总督/预备 applied; 1,207 <note:> popups and 352 [雅伟]/[耶稣]/[基督] referent brackets are the edition's own apparatus (display_text strips / marks them)."),
    "cuvs-yhwh-tr": dict(
        name="和合本雅偉版（繁體）/ CUV, Yahweh edition (Traditional)",
        licence="Permission (Yahweh De Hua Ministry)",
        attribution="© 雅偉的話事工 · 經授權使用。 / © Yahweh De Hua Ministry · used with permission.",
        notes="Traditional counterpart of cuvs-yhwh, same verse set and apparatus."),
    "bsb-yhwh": dict(
        name="Berean Standard Bible (Yahweh)",
        licence="Public domain (BSB since 2023-04-30); divine-name restoration by Yahweh De Hua Ministry",
        attribution="Public domain since 2023-04-30, no permission required for any use · the Yahweh edition's divine-name restoration is the work of Yahweh De Hua Ministry.",
        notes="31,086 verses: the BSB omits 16 verses the KJV numbers (listed in versification-ru.json bsbOmits)."),
    "asv-yhwh": dict(
        name="American Standard Version 1901 (Yahweh)",
        licence="Public domain (1901); divine-name restoration by Yahweh De Hua Ministry",
        attribution="Public domain (1901) · the divine name is rendered Yahweh where the ASV printed Jehovah, an editorial restoration by Yahweh De Hua Ministry.",
        notes=""),
    "web-yhwh": dict(
        name="World English Bible (Yahweh)",
        licence="Public domain",
        attribution="Public domain. The World English Bible, with the divine name as Yahweh; supplied by Yahwehdehua (from eBible.org). The Apocrypha is not included.",
        notes=""),
    "kjv": dict(
        name="King James Version (1611 / 1769)",
        licence="Public domain",
        attribution="Public domain.",
        notes="Prints LORD; shown as Yahweh by divine_name.py. (In the UK the KJV text is under Crown letters patent; Words records it as public domain.)"),
    "jps": dict(
        name="JPS 1917 (Tanakh)",
        licence="Public domain",
        attribution="Public domain. The Jewish Publication Society's 1917 translation, the divine name written YHWH; digital text from Open Siddur / JPS (CC0), supplied by Yahwehdehua. Old Testament only.",
        notes="OT only (23,145 verses)."),
    "brenton": dict(
        name="Brenton's English Septuagint (1851)",
        licence="Public domain",
        attribution="Public domain. Lancelot C. L. Brenton's English translation of the Septuagint (1851), from eBible.org, supplied by Yahwehdehua at this app's verse numbers. The Apocrypha and Psalm 151 are not included.",
        notes="OT only (22,780 verses), at KJV verse numbers. This is Brenton's English, not the Greek LXX (excluded)."),
    "rst": dict(
        name="Синодальный перевод (1876) / Russian Synodal",
        licence="Public domain (1876)",
        attribution="Общественное достояние. / Public domain. Синодальный перевод (1876), digital text eBible.org (russyn).",
        notes="The plain public-domain Synodal from eBible.org, NOT the Strong's-tagged RusSynodalLIO (rst-s, licence pending, unmerged branch). Renumbered by Words to KJV numbering (tools/import_rst.py, CrossWire's Synodal->KJV rules); see versification-ru.json."),
    "wlc": dict(
        name="Westminster Leningrad Codex (Hebrew OT)",
        licence="Public domain",
        attribution="Public-domain Hebrew text (Westminster Leningrad Codex).",
        notes="Text only. Words' lemma/morphology layer (Open Scriptures Hebrew Bible, CC BY 4.0) is NOT in this pack. 23,142 verses at KJV ids."),
    "wh": dict(
        name="Westcott-Hort Greek NT (1881)",
        licence="Public domain (1881)",
        attribution="Public domain. Westcott & Hort, The New Testament in the Original Greek (1881).",
        notes="The editors' single and double brackets for doubtful text are in the file; display_text removes the bracket characters."),
    "sblgnt": dict(
        name="SBL Greek New Testament (2010)",
        licence="CC BY 4.0",
        attribution=("The Greek New Testament: SBL Edition (SBLGNT), edited by Michael W. Holmes. "
                     "Copyright © 2010 Society of Biblical Literature and Logos Bible Software. "
                     "Licensed under the Creative Commons Attribution 4.0 International License "
                     "(https://creativecommons.org/licenses/by/4.0/), provided as-is without warranties; "
                     "source: https://sblgnt.com/license/. "
                     "Changes: supplied via Yahwehdehua with paragraph and apparatus anchors already removed upstream; "
                     "Words keeps the 6,901 apparatus notes as <note:> markup; this pack's display_text() removes them and the bracket marks. No wording edits."),
        notes="CC BY 4.0 requires, wherever the text is shown or shared: the creators, the copyright notice, a link to the licence, the no-warranty notice, a link to the source, and a statement of changes. Use the attribution string verbatim (README §SBLGNT)."),
}

EXCLUDED = {
    "leb": "LEB: free to give away, but every quotation must carry its credit line and use is subject to reporting duties (docs/leb-licence-request.md). App-only reading; not redistributed in the globe.",
    "net": "NET (English): bundled in the app on the owner's relayed decision (2026-09-09), not a written publisher grant for redistribution. App-only.",
    "cnet / cnet-tr": "Chinese NET: permission recorded in the source index but no written notice on file. App-only.",
    "csb": "CSB: grant to Raymond Suen personally for one named work, gratis while free; already barred from images in Words (kVerseImageRestrictedVersions). App-only.",
    "nasb": "NASB: licence request unresolved (docs/nasb-licence-request.md); hidden in Words. Not used at all.",
    "lxx": "LXX (Greek): critical edition unnamed, licence unresolved (Peter to judge); barred from images in Words. Not used at all.",
    "lzz / lzz-tr": "吕振中译本: oral permission only. Not used at all.",
    "rst-s": "Russian Synodal with Strong's (RusSynodalLIO / LiO / BJU): copyrighted, permission requested, dev-only branch. Not used.",
}


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git(repo: str, *args: str, binary: bool = False):
    out = subprocess.run(["git", "-C", repo, *args], check=True, capture_output=True).stdout
    return out if binary else out.decode().strip()


def copy_from_head(repo: str, rel: str, dest: str) -> dict:
    blob = git(repo, "show", f"HEAD:{rel}", binary=True)
    with open(os.path.join(repo, rel), "rb") as f:
        work = f.read()
    if work != blob:
        sys.exit(f"STOP: {repo}/{rel} differs from HEAD (uncommitted edits). Copy only committed text.")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(blob)
    return {
        "sourceRepo": repo,
        "sourcePath": rel,
        "sourceCommit": git(repo, "rev-parse", "HEAD"),
        "sourceBranch": git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
        "sourceGitBlob": git(repo, "rev-parse", f"HEAD:{rel}"),
        "sourceLastChangedIn": git(repo, "log", "-1", "--format=%H %cI", "--", rel),
    }


# ---------------------------------------------------------------- Russian

EB = ["GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH",
      "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SOL", "ISA", "JER", "LAM", "EZE", "DAN", "HOS",
      "JOE", "AMO", "OBA", "JON", "MIC", "NAH", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MAR", "LUK",
      "JOH", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHI", "COL", "1TH", "2TH", "1TI", "2TI", "TIT",
      "PHM", "HEB", "JAM", "1PE", "2PE", "1JO", "2JO", "3JO", "JUD", "REV"]


def build_versification_ru(vpl_path: str, words: str) -> dict:
    rst = json.load(open(os.path.join(PACK, "bible", "rst.json"), encoding="utf-8"))
    bsb_ids = {v["id"] for v in json.load(open(os.path.join(PACK, "bible", "bsb-yhwh.json"), encoding="utf-8"))}
    books = json.load(open(os.path.join(PACK, "section_titles.json"), encoding="utf-8"))["_meta"]["books"]
    by_book = collections.defaultdict(list)
    for i, v in enumerate(rst):
        by_book[int(v["id"][:3])].append(i)

    syn = []
    for line in open(vpl_path, encoding="utf-8"):
        m = re.match(r"(\w+) (\d+):(\d+) (.*)", line.rstrip("\n"))
        if m:
            syn.append((EB.index(m.group(1)) + 1, int(m.group(2)), int(m.group(3)), m.group(4).strip()))

    # Align: each Synodal verse lands inside exactly one KJV-numbered rst
    # verse (Words' importer concatenates, never splits). Ties between
    # identical short verses go to the nearest candidate at or after the
    # previous match, which keeps the order.
    mapping, lost, prev = [], [], None
    for b, c, v, t in syn:
        idxs = by_book[b]
        if prev is None or prev[0] != b:
            prev = (b, idxs[0])
        cands = [i for i in idxs if t in rst[i]["text"]]
        if not cands:
            lost.append((b, c, v, t))
            continue
        best = min(cands, key=lambda i: (0 if i >= prev[1] else 1, abs(i - prev[1])))
        mapping.append(((b, c, v), best))
        prev = (b, best)

    # Proof: removing every mapped Synodal verse from its rst verse leaves
    # nothing, for all 31,102 verses (one known exception, below).
    texts = {(b, c, v): t for b, c, v, t in syn}
    groups = collections.defaultdict(list)
    for k, i in mapping:
        groups[i].append(k)
    leftovers = {}
    for i, v in enumerate(rst):
        t = v["text"]
        for k in sorted(groups.get(i, []), key=lambda k: -len(texts[k])):
            j = t.find(texts[k])
            if j < 0:
                sys.exit(f"STOP: alignment failed at {v['id']}")
            t = t[:j] + t[j + len(texts[k]):]
        if t.strip():
            leftovers[v["id"]] = t.strip()
    if set(leftovers) != {"022001001"}:
        sys.exit(f"STOP: unexpected leftover text {leftovers}")

    # Lost title halves: two-verse Psalm superscriptions where Words'
    # importer kept only the second verse. They belong to verse 1.
    lost_in_words = []
    for b, c, v, t in lost:
        nxt = next(i for k, i in mapping if k == (b, c, v + 1))
        groups[nxt].append((b, c, v))
        lost_in_words.append({"ru": f"{books[b-1]} {c}:{v}", "en": rst[nxt]["id"], "missingText": t})

    en_to_ru, ru_to_en, joined, no_ru = {}, {}, {}, []
    for i, v in enumerate(rst):
        ks = sorted(groups.get(i, []))
        c, vv = int(v["chapter"]), int(v["verse"])
        refs = [f"{kc}:{kv}" for (_, kc, kv) in ks]
        if not v["text"].strip():
            # joined to the verse before in the Synodal
            joined[v["id"]] = rst[i - 1]["id"]
            continue
        if not ks:
            no_ru.append(v["id"])
            en_to_ru[v["id"]] = []
            continue
        if refs != [f"{c}:{vv}"]:
            en_to_ru[v["id"]] = refs
        for (kb, kc, kv) in ks:
            sid = f"{kb:03d}{kc:03d}{kv:03d}"
            if sid != v["id"]:
                ru_to_en[sid] = v["id"]

    # Human-readable runs: consecutive verses with one Synodal verse each
    # and a constant offset collapse into one line.
    ranges = collections.OrderedDict()
    run = None

    def flush():
        if run:
            b, ec, ev0, ev1, rc, rv0, rv1 = run
            en = f"{ec}:{ev0}" + (f"-{ev1}" if ev1 != ev0 else "")
            ru = f"{rc}:{rv0}" + (f"-{rv1}" if rv1 != rv0 else "")
            ranges.setdefault(books[b - 1], []).append({"en": en, "ru": ru})

    for vid_, refs in en_to_ru.items():
        b, ec, ev = int(vid_[:3]), int(vid_[3:6]), int(vid_[6:])
        if len(refs) == 1:
            rc, rv = map(int, refs[0].split(":"))
            if run and run[0] == b and run[1] == ec and run[3] == ev - 1 and run[4] == rc and run[6] == rv - 1:
                run = (b, ec, run[2], ev, rc, run[5], rv)
                continue
            flush()
            run = (b, ec, ev, ev, rc, rv, rv)
        else:
            flush()
            run = None
            ranges.setdefault(books[b - 1], []).append(
                {"en": f"{ec}:{ev}", "ru": " + ".join(refs) if refs else "(none: printed as the book title)"})
    flush()

    ru_cv = collections.OrderedDict()
    for b, c, v, _ in syn:
        cv = ru_cv.setdefault(books[b - 1], {})
        cv[c] = max(cv.get(c, 0), v)
    ru_chapter_verses = {bk: [cv[c] for c in sorted(cv)] for bk, cv in ru_cv.items()}

    vpl_sha = sha256(vpl_path)
    return {
        "_meta": {
            "what": "Russian Synodal (printed) numbering vs English (KJV/BSB) numbering, for rst.json in this pack.",
            "keyRule": ("All files in data/text/ use 9-digit ids BBBCCCVVV in English numbering. rst.json is ALREADY renumbered "
                        "to it by Words, so rst text is looked up by the English id directly. Use this table only to show or "
                        "parse a Russian (Synodal) reference."),
            "enToRu": "English id -> Synodal 'chapter:verse' list for the same book; omitted when identical; [] = no Synodal verse.",
            "ruToEn": "Synodal id (same 9-digit form, Synodal numbers) -> English id; omitted when identical.",
            "joined": "English ids that are empty in rst.json because the Synodal joins them to the verse before; value = id holding the text.",
            "lostInWords": ("Synodal verses missing from Words' rst.json: the first half of two-verse Psalm superscriptions, "
                            "dropped by Words' tools/import_rst.py (titles dict keeps only the last title verse). Report to Words; "
                            "not patched here."),
            "bsbOmits": "English ids the KJV numbers but bsb-yhwh.json has no verse for.",
            "ruChapterVerses": "Synodal verse count per chapter, per book (Protestant canon form, as eBible's russyn).",
            "source": {
                "synodal": "eBible.org russyn_vpl.txt (Синодальный перевод, public domain), sha256 " + vpl_sha,
                "synodalUrl": "https://ebible.org/Scriptures/russyn_vpl.zip",
                "rst": "data/text/bible/rst.json (copy of Words-182 assets/rst.json)",
                "method": ("text alignment: every Synodal verse found inside exactly one rst verse; every rst verse reassembled "
                           "exactly from its Synodal verses (only exception: Song 1:1, whose title Words supplies)."),
            },
            "counts": {
                "synodalVerses": len(syn),
                "englishVerses": len(rst),
                "enToRuEntries": len(en_to_ru),
                "ruToEnEntries": len(ru_to_en),
                "joined": len(joined),
                "lostInWords": len(lost_in_words),
            },
            "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "books": books,
        "ranges": ranges,
        "enToRu": en_to_ru,
        "ruToEn": ru_to_en,
        "joined": joined,
        "noRussianVerse": no_ru,
        "lostInWords": lost_in_words,
        "bsbOmits": sorted(v["id"] for v in rst if v["id"] not in bsb_ids),
        "ruChapterVerses": ru_chapter_verses,
    }


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--words", default="/Volumes/androidbuild/Words-182")
    ap.add_argument("--sword", default="/Volumes/androidbuild/Sword-182")
    ap.add_argument("--russyn-vpl")
    a = ap.parse_args()

    entries = {}
    for code, info in EDITIONS.items():
        dest = os.path.join(PACK, "bible", f"{code}.json")
        src = copy_from_head(a.words, f"assets/{code}.json", dest)
        verses = json.load(open(dest, encoding="utf-8"))
        entries[f"bible/{code}.json"] = {
            "kind": "scripture", "edition": code, **info, "verses": len(verses), **src}

    dest = os.path.join(PACK, "section_titles.json")
    src = copy_from_head(a.words, "assets/section_titles.json", dest)
    w = json.load(open(dest, encoding="utf-8"))
    s = json.load(open(os.path.join(a.sword, "assets/section_titles.json"), encoding="utf-8"))
    meta_diff = sorted(k for k in set(w["_meta"]) | set(s["_meta"]) if w["_meta"].get(k) != s["_meta"].get(k))
    counts = {k: sum(len(x) for b in v.values() for x in b.values()) for k, v in w["sets"].items()}
    entries["section_titles.json"] = {
        "kind": "section titles + context notes",
        "name": "Section titles and context notes (4 sets: cuv, cuv-tr, english-classic, ru)",
        "licence": "BSB headings (public domain) + text written for the Words app",
        "attribution": w["_meta"].get("source", ""),
        "notes": w["_meta"].get("description", ""),
        "sections": counts,
        **src,
        "swordComparison": {
            "swordPath": os.path.join(a.sword, "assets/section_titles.json"),
            "swordCommit": git(a.sword, "rev-parse", "HEAD"),
            "swordSha256": sha256(os.path.join(a.sword, "assets/section_titles.json")),
            "wordsSha256": sha256(dest),
            "setsIdentical": w["sets"] == s["sets"],
            "metaKeysDiffering": meta_diff,
        },
    }

    vr = os.path.join(PACK, "versification-ru.json")
    if a.russyn_vpl:
        table = build_versification_ru(a.russyn_vpl, a.words)
        with open(vr, "w", encoding="utf-8") as f:
            json.dump(table, f, ensure_ascii=False, indent=1)
            f.write("\n")
    if not os.path.exists(vr):
        sys.exit("STOP: versification-ru.json missing; pass --russyn-vpl")

    written = {
        "versification-ru.json": "Russian Synodal vs English numbering table (built by tools/build_textpack.py)",
        "divine_name.py": "Port of Words' divine-name display rule and display sanitiser",
        "textpack.py": "Lookup helpers (verse by ref, section by ref, Russian ref)",
        "README.md": "What is here, exclusions, usage (zh + en)",
        "tools/build_textpack.py": "This builder",
        "tests/test_textpack.py": "Residue, versification, manifest and rule checks",
    }
    for rel, what in written.items():
        entries[rel] = {"kind": "written for this pack", "notes": what}

    for rel, e in entries.items():
        p = os.path.join(PACK, rel)
        e["bytes"] = os.path.getsize(p)
        e["sha256"] = sha256(p)

    words_head = git(a.words, "rev-parse", "HEAD")
    manifest = {
        "_meta": {
            "pack": "雅伟之界 text pack (data/text/), deliverable 2 of 最终方案 §三",
            "rule": "只用 data/text/，不要读 Sword-182/Words-182 的工作副本 / Read only data/text/, never the Words-182 or Sword-182 working copies.",
            "wordsRepo": a.words,
            "wordsHead": words_head,
            "wordsBranch": git(a.words, "rev-parse", "--abbrev-ref", "HEAD"),
            "builtAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "totalBytes": sum(e["bytes"] for e in entries.values()),
            "excluded": EXCLUDED,
        },
        "files": entries,
    }
    with open(os.path.join(PACK, "MANIFEST.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"pack written: {len(entries)} files, {manifest['_meta']['totalBytes']:,} bytes, Words HEAD {words_head}")


if __name__ == "__main__":
    main()
