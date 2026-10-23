"""Divine-name display rule for the 雅伟之界 text pack (data/text/).

A line-for-line port of Words' render-side rule, so the globe shows each
edition exactly as the Words app shows it. Source of truth:

    Words-182  lib/constants/text_patterns.dart
               _normalizeDivineNames, sanitizeForSearch, displayVerseText,
               _collapsePostStripDuplicates
    Words-182  lib/features/versions/edition_measurements.g.dart
               (printedName per edition)

The rule is applied when text is DISPLAYED. The scripture files in
data/text/bible/ are byte-identical copies of Words' assets and are never
rewritten. If Words changes the rule, port the change here and update
tests/test_textpack.py; do not edit the JSON.

What it does (identical to Words):
  * Chinese: 耶和华 -> 雅伟, 耶和華 -> 雅偉.
  * English: "the LORD" / "The LORD" -> "Yahweh", then any other all-caps
    LORD -> "Yahweh". Whole word, case-sensitive, ASCII word boundaries
    (Dart's RegExp \\b is ASCII-only, so re.ASCII here). Mixed-case "Lord"
    (Adonai / kyrios, often Jesus) is NOT touched; nor is "GOD" in
    "Lord GOD".
  * Russian: no rule. The Synodal prints Господь for YHWH and it is shown
    as printed (owner decision pending; see README.md).
  * Hebrew / Greek: no rule (יהוה stays יהוה).

Text the globe WRITES ITSELF (titles, notes, cards, captions) is not
scripture and is not run through this rule; it must use the name directly,
see APP_WRITTEN_NAME. Jesus is never called 雅伟/Yahweh.
"""
from __future__ import annotations

import re

__all__ = [
    "normalize_divine_names",
    "sanitize_for_search",
    "display_text",
    "shown_name",
    "EDITIONS",
    "APP_WRITTEN_NAME",
    "BRACKET_PRESERVING_EDITIONS",
]

# The name in text the app/globe writes itself (church rule, 2026-10-22).
APP_WRITTEN_NAME = {
    "zh-Hans": "雅伟",   # also 雅伟神 / 父神雅伟 where natural
    "zh-Hant": "雅偉",
    "en": "Yahweh",
    "ru": "Яхве",
}

# Editions whose [..] brackets are the edition's own notation (Words'
# kBracketPreservingVersions): 和合本雅伟版's [雅伟] / [耶稣] / [基督] mark a
# referent the editor supplied beside 主. display_text() keeps them marked
# as 〔雅伟〕; in every other edition bracketed words read as plain words.
BRACKET_PRESERVING_EDITIONS = frozenset({"cuvs-yhwh", "cuvs-yhwh-tr"})

# Per edition in this pack: the name as printed in the file, and as shown
# after normalize_divine_names(). printed values are Words'
# edition_measurements.g.dart at the commit recorded in MANIFEST.json.
EDITIONS = {
    "cuvs-yhwh":    {"lang": "zh-Hans", "printed": "雅伟",    "shown": "雅伟"},
    "cuvs-yhwh-tr": {"lang": "zh-Hant", "printed": "雅偉",    "shown": "雅偉"},
    "bsb-yhwh":     {"lang": "en", "printed": "Yahweh",  "shown": "Yahweh",
                     "note": "110 verses still print LORD (Words leaves them for display); shown as Yahweh"},
    "asv-yhwh":     {"lang": "en", "printed": "Yahweh",  "shown": "Yahweh",
                     "note": "JEHOVAH kept inside quoted inscriptions (Exod 28:36, 39:30, Deut 28:58, Zech 14:20)"},
    "web-yhwh":     {"lang": "en", "printed": "Yahweh",  "shown": "Yahweh"},
    "kjv":          {"lang": "en", "printed": "LORD",    "shown": "Yahweh"},
    "jps":          {"lang": "en", "printed": "YHWH",    "shown": "YHWH",
                     "note": "the rule does not touch YHWH; Words shows YHWH"},
    "brenton":      {"lang": "en", "printed": "Lord",    "shown": "Lord",
                     "note": "LXX kyrios, mixed case: not touched"},
    "rst":          {"lang": "ru", "printed": "Господь", "shown": "Господь",
                     "note": "no Russian rule; owner decision pending"},
    "wlc":          {"lang": "he", "printed": "יהוה",    "shown": "יהוה"},
    "wh":           {"lang": "el", "printed": "",        "shown": ""},
    "sblgnt":       {"lang": "el", "printed": "",        "shown": ""},
}

_THE_LORD = re.compile(r"\bthe LORD\b", re.ASCII)
_THE_LORD_CAP = re.compile(r"\bThe LORD\b", re.ASCII)
_LORD = re.compile(r"\bLORD\b", re.ASCII)

_NOTE = re.compile(r"<note:([^>]+)>")
_BRACE = re.compile(r"\{([^}]+)\}")
_SQUARE = re.compile(r"\[([^\]]+)\]")
_PILCROW = re.compile(r"[¶§]\s*")
_CJK = re.compile(r"[㐀-鿿]")
_DUP_CJK_PUNCT = re.compile(r"([，。；：？！、])\1+")


def normalize_divine_names(text: str) -> str:
    """Words' _normalizeDivineNames, same replacements in the same order."""
    out = text.replace("耶和华", "雅伟").replace("耶和華", "雅偉")
    out = _THE_LORD.sub("Yahweh", out)
    out = _THE_LORD_CAP.sub("Yahweh", out)
    out = _LORD.sub("Yahweh", out)
    return out


def _collapse_post_strip_duplicates(text: str) -> str:
    text = _DUP_CJK_PUNCT.sub(r"\1", text)
    return re.sub(r"  +", " ", text)


def sanitize_for_search(text: str) -> str:
    """Words' sanitizeForSearch: <note:..> removed, {x} -> x, pilcrows
    removed, divine names normalised. [..] and line breaks are kept."""
    t = _NOTE.sub("", text)
    t = _BRACE.sub(lambda m: m.group(1) or "", t)
    t = _PILCROW.sub("", t)
    return _collapse_post_strip_duplicates(normalize_divine_names(t).strip())


def display_text(text: str) -> str:
    """Words' displayVerseText: plain verse text for surfaces that cannot
    style a span (Words uses it for widgets, the watch, notifications; the
    globe uses it for every caption, card and layer).

    No markup survives: notes gone, braces gone (content kept), a
    bracketed Chinese referent kept as 〔雅伟〕, any other bracketed word
    kept as a plain word, every remaining [ ] { } and <...> tag removed,
    whitespace collapsed.
    """
    def _square(m: re.Match) -> str:
        inner = m.group(1) or ""
        return f"〔{inner}〕" if _CJK.search(inner) else inner

    t = _SQUARE.sub(_square, sanitize_for_search(text))
    t = re.sub(r"[\[\]{}]", "", t)
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", t).strip()


def shown_name(code: str) -> str:
    """The divine name as the globe shows it for edition `code`."""
    printed = EDITIONS[code]["printed"]
    return sanitize_for_search(printed).strip() if printed else ""


if __name__ == "__main__":
    for code in EDITIONS:
        print(f"{code:13} printed={EDITIONS[code]['printed']!r:12} shown={shown_name(code)!r}")
