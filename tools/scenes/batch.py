"""Print compact rows for events [start, start+count) in book order, skipping ids already saved.

    python3 tools/scenes/batch.py START COUNT [--dir /path/to/assets-scenes/raw]
"""
import json, os, re, sys
a = sys.argv[1:]
start, count = int(a[0]), int(a[1])
d = a[a.index("--dir") + 1] if "--dir" in a else "/Users/pliu0036/Documents/CodingProject/assets-scenes/raw"
ev = json.load(open("data/events/all-events.json"))["events"]
clause = lambda x: re.split(r"[，,——。；：]", x or "")[0].strip()[:22]
rows = [[e["id"], e["zh"], e["en"], e["refZh"], clause(e["summaryZh"])] for e in ev[start:start + count]
        if not os.path.exists(os.path.join(d, e["id"] + ".png"))]
print(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
