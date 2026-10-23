"""Read the 雅伟之界 text pack by reference. Standard library only.

    import sys; sys.path.insert(0, "data/text")
    import textpack as tp

    tp.verse("cuvs-yhwh", "Psalms", 23, 1)   # display text, divine-name rule applied
    tp.verse("kjv", "Psalms", 23, 1)          # 'Yahweh is my shepherd; ...'
    tp.verse("kjv", "Psalms", 23, 1, raw=True) # exactly as the file has it
    tp.section("Genesis", 18, 1, "cuv")       # {'verse': 1, 'title': ..., 'context': ...}
    tp.ru_ref("Psalms", 23, 1)                # 'Psalms 22:1' (Synodal printed numbering)

Every edition file, the section titles and the Russian table share one key:
the 9-digit id BBBCCCVVV in English (KJV) numbering, book 1-66 in the
order of BOOKS. Russian rst.json is ALREADY in that numbering (Words
renumbered it), so lookups never need versification-ru.json; the table
only tells you what a Russian reader would call the verse.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache

from divine_name import display_text

HERE = os.path.dirname(os.path.abspath(__file__))

EDITIONS = (
    "cuvs-yhwh", "cuvs-yhwh-tr",
    "bsb-yhwh", "asv-yhwh", "web-yhwh", "kjv", "jps", "brenton",
    "rst",
    "wlc", "wh", "sblgnt",
)
SECTION_SETS = ("cuv", "cuv-tr", "english-classic", "ru")


@lru_cache(maxsize=None)
def _json(rel: str):
    with open(os.path.join(HERE, rel), encoding="utf-8") as f:
        return json.load(f)


def books() -> list[str]:
    return _json("section_titles.json")["_meta"]["books"]


def vid(book: str | int, chapter: int, verse: int) -> str:
    """'Psalms', 23, 1 -> '019023001' (English book name or number 1-66)."""
    b = book if isinstance(book, int) else books().index(book) + 1
    return f"{b:03d}{int(chapter):03d}{int(verse):03d}"


@lru_cache(maxsize=None)
def edition(code: str) -> dict[str, str]:
    """id -> raw text for one edition."""
    if code not in EDITIONS:
        raise KeyError(f"{code} is not in the text pack (see README: excluded editions)")
    return {v["id"]: v["text"] for v in _json(f"bible/{code}.json")}


def verse(code: str, book, chapter: int, verse_no: int, raw: bool = False) -> str | None:
    """Verse text, or None when the edition has no such verse (OT-only
    editions, the 16 verses the BSB omits, ...). rst: eight verses the
    Synodal joins to the verse before are '' here; joined_into() says where
    their text is."""
    t = edition(code).get(vid(book, chapter, verse_no))
    if t is None or raw:
        return t
    return display_text(t)


def section(book: str, chapter: int, verse_no: int, set_name: str = "cuv") -> dict | None:
    """The section (title + context) a verse falls in, for one of the four
    sets. Sections never cross a chapter boundary in the data's sense: a
    verse before the chapter's first heading belongs to the last section
    of an earlier chapter, which this walks back to find."""
    chapters = _json("section_titles.json")["sets"][set_name][book]
    c = int(chapter)
    while c >= 1:
        secs = [s for s in chapters.get(str(c), []) if c < int(chapter) or s["verse"] <= verse_no]
        if secs:
            return secs[-1]
        c -= 1
    return None


def ru_ref(book: str, chapter: int, verse_no: int) -> str:
    """The Synodal (printed Russian) reference for an English ref."""
    i = vid(book, chapter, verse_no)
    table = _json("versification-ru.json")
    i = table["joined"].get(i, i)  # joined in the Synodal: cite the verse holding it
    refs = table["enToRu"].get(i)
    if refs is None:
        c, v = int(i[3:6]), int(i[6:])
        return f"{book} {c}:{v}"
    if not refs:
        return ""  # no Synodal verse (Song 1:1, printed as the book title)
    c0, v0 = refs[0].split(":")
    c1, v1 = refs[-1].split(":")
    if len(refs) == 1:
        return f"{book} {refs[0]}"
    return f"{book} {c0}:{v0}-{v1}" if c0 == c1 else f"{book} {refs[0]}-{refs[-1]}"


def joined_into(code_id: str) -> str | None:
    """For an rst verse that is empty because the Synodal joins it to the
    verse before: the id of the verse that holds its text."""
    return _json("versification-ru.json")["joined"].get(code_id)
