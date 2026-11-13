"""Reading-time check for on-screen text: python3 lint.py <dir>   (reads <dir>/timeline.json, key "captions")
A line needs about 0.3 s per word plus 0.4 s after it has finished appearing; shorter than that and viewers miss it.
Captions come from MOVES.captions(): every clip that has text and an `until` frame."""
import json, sys
T = json.load(open(f"{sys.argv[1]}/timeline.json")); caps = T.get("captions", []); bad = 0
for c in caps:
    words = len(c["text"].split()); held = (c["until"] - c["shown"]) / T["fps"]
    need = 0.25 if c.get("each") else 0.3 * words + 0.4  # one-word-per-beat moves only need each word to register
    ok = held >= need - 1e-6; bad += not ok
    print(f"  {'ok  ' if ok else 'SHORT'} {held:5.2f}s held, {need:.2f}s needed: {c['text']}")
print(f"captions: {len(caps)} checked, {bad} too short")
sys.exit(1 if bad else 0)
