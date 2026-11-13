"""Side-by-side sheet: reference frame (left) against the render (right), one row per frame.
python3 compare.py <sheet.jpg> <frame> [frame ...] --ref ref/<name> --out out-<name>
Render the stills first: bun render.ts --page <name>.html --out out-<name> --frame 10,40"""
import subprocess, sys

a = sys.argv[1:]
def opt(name, dflt):
    if name in a:
        i = a.index(name); v = a[i + 1]; del a[i:i + 2]; return v
    return dflt
ref, rend = opt("--ref", "ref"), opt("--out", "out")
out, frames = a[0], [int(x) for x in a[1:]]
cmd, parts = ["ffmpeg", "-v", "error", "-y"], []
for i, f in enumerate(frames):
    cmd += ["-i", f"{ref}/{f:04d}.jpg", "-i", f"{rend}/f{f:04d}.jpg"]
    parts.append(f"[{2 * i}]scale=960:540[a{i}];[{2 * i + 1}]scale=960:540[b{i}];[a{i}][b{i}]hstack[r{i}]")
rows = "".join(f"[r{i}]" for i in range(len(frames)))
tail = f"{rows}vstack=inputs={len(frames)}" if len(frames) > 1 else "[r0]null"
cmd += ["-filter_complex", ";".join(parts) + ";" + tail, out]
subprocess.run(cmd, check=True)
