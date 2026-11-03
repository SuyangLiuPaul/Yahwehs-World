"""Per-square exceptions (tools/scenes/square_exceptions.json): lookup, validation, Aramaic mapping.

Only ids listed in the JSON are affected. The veto table is untouched.
"""
import json
import os
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
EXCEPTIONS_PATH = os.path.join(HERE, "square_exceptions.json")
SCHEMA = "square-exceptions-v1"
FINAL_TO_MEDIAL = {"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"}
HE_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת"          # the 22 consonants, in alphabet order
IMPERIAL = {he: chr(0x10840 + i) for i, he in enumerate(HE_LETTERS)}
BACK = {v: k for k, v in IMPERIAL.items()}


def load(path=None):
    with open(path or EXCEPTIONS_PATH, encoding="utf-8") as handle:
        data = json.load(handle)
    if data.get("schema") != SCHEMA:
        raise ValueError("bad square-exceptions schema")
    return data["exceptions"]


def get(event_id, path=None):
    return load(path).get(event_id)


def registry_overrides(path=None):
    return {k: v["registry_override"] for k, v in load(path).items() if v.get("registry_override")}


def strip_points(text):
    """Drop Hebrew points/cantillation (combining marks) and normalise final letters."""
    base = "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c))
    return "".join(FINAL_TO_MEDIAL.get(c, c) for c in base)


def to_imperial(he_consonants):
    """Hebrew square-script consonants (spaces kept) to Imperial Aramaic, same logical order."""
    return "".join(IMPERIAL[c] if c in IMPERIAL else c for c in strip_points(he_consonants))


def from_imperial(text):
    return "".join(BACK.get(c, c) for c in text)


def validate(exc):
    """Raise ValueError unless the entry's derived text is internally consistent."""
    pointed, plain = exc["text_he_pointed"], exc["text_he_consonants"]
    if strip_points(pointed) != strip_points(plain):
        raise ValueError("consonant text does not match the pointed verse text")
    words = plain.split()
    flat = sorted(i for line in exc["render"]["lines"] for i in line)
    if flat != list(range(len(words))):
        raise ValueError("render.lines must use every word exactly once")
    if any(c != " " and c not in IMPERIAL for c in strip_points(plain)):
        raise ValueError("text has a character outside the 22 consonants")
    return True


def render_lines(exc):
    """Logical Imperial Aramaic strings, one per line (first letter = rightmost when drawn)."""
    words = [to_imperial(w) for w in exc["text_he_consonants"].split()]
    return [" ".join(words[i] for i in line) for line in exc["render"]["lines"]]
