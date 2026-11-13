"""Brightness check of a rebuilt film against its reference, frame by frame.
python3 check.py <name> [limit]   reads ref/<name>/ref.json and out-<name>/silent.mp4 (build the film first)
Prints every frame whose mean brightness is more than <limit> (default 40, on a 0-255 scale) away from the reference.
A wrong cut frame, a missing flash or a background of the wrong tone shows up here before the eye finds it."""
import json, subprocess, sys

name = sys.argv[1]; limit = float(sys.argv[2]) if len(sys.argv) > 2 else 40
ref = json.load(open(f"ref/{name}/ref.json"))
out = subprocess.run(["ffmpeg", "-v", "error", "-i", f"out-{name}/silent.mp4", "-vf", f"fps={ref['fps']},signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"], capture_output=True, text=True).stdout
mine = [float(l.split("=")[1]) for l in out.splitlines() if "YAVG" in l]
n = min(len(mine), len(ref["luma"]))
bad = [(f, ref["luma"][f], mine[f]) for f in range(n) if abs(ref["luma"][f] - mine[f]) > limit]
mean = sum(abs(ref["luma"][f] - mine[f]) for f in range(n)) / max(1, n)
print(f"{name}: {n} frames compared (reference {len(ref['luma'])}, render {len(mine)}), mean difference {mean:.1f}")
for f, r, m in bad:
    print(f"  frame {f}: reference {r:.0f}, render {m:.0f}")
print(f"{len(bad)} frames over {limit:.0f}")
sys.exit(1 if bad else 0)
