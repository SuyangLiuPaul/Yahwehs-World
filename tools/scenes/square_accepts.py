"""Per-square owner acceptances (tools/scenes/square_accepts.json): lookup and validation.

An acceptance forgives ONE named veto key on ONE named square, for ONE set of bytes. It never
changes `gate_check.VETO_TABLE` (so `VETO_TABLE_SHA256` is unchanged and every existing review
stays valid), it never rewrites a reviewer's answer or note, and it never applies to a square
that is not listed here. The reviewer's "fail"/"unclear" stays in `review/<id>.json` as written;
the acceptance is the separate, signed record that the owner (or an agent he delegated to) read
that note against the passage and ruled the picture acceptable anyway.

Binding: `gate_check.check_square` additionally requires the square's status file to carry an
`owner_accept` block whose `keys` are exactly the accepted keys and whose `live_sha256` equals
the live picture's SHA. Redraw the picture and the acceptance lapses by itself.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ACCEPTS_PATH = os.path.join(HERE, "square_accepts.json")
SCHEMA = "square-accepts-v1"
REQUIRED = ("reason", "ref", "decidedBy", "decidedAt")


def load(path=None):
    with open(path or ACCEPTS_PATH, encoding="utf-8") as handle:
        data = json.load(handle)
    if data.get("schema") != SCHEMA:
        raise ValueError("bad square-accepts schema")
    accepts = data["accepts"]
    if not isinstance(accepts, dict):
        raise ValueError("accepts must be an object")
    return accepts


def get(event_id, path=None):
    """The acceptance entry for one square, or None."""
    return load(path).get(event_id)


def accepted_keys(event_id, veto_keys, path=None):
    """The veto keys forgiven on this square, as a sorted tuple. () when it has no acceptance.

    Raises ValueError if the entry is malformed or names a key outside the veto table: a typo must
    stop the gate, not silently forgive nothing (or everything).
    """
    entry = get(event_id, path)
    if entry is None:
        return ()
    missing = [field for field in REQUIRED if not str(entry.get(field) or "").strip()]
    if missing:
        raise ValueError(f"{event_id}: acceptance is missing {','.join(missing)}")
    keys = entry.get("keys")
    if not (isinstance(keys, dict) and keys):
        raise ValueError(f"{event_id}: acceptance has no keys")
    for key, why in keys.items():
        if key not in veto_keys:
            raise ValueError(f"{event_id}: '{key}' is not a veto-table key")
        if not str(why or "").strip():
            raise ValueError(f"{event_id}: acceptance of '{key}' has no reason")
    return tuple(sorted(keys))
