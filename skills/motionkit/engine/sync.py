"""Are picture and sound in step in the finished file?   python3 sync.py <name>   (reads out-<name>/<name>.mp4 and timeline.json)
For every frame in the timeline's `sync` list (or `cuts` when there is none) it checks, in the mp4 itself:
  the picture changes at that frame (frame difference well above the film's usual), and
  a bass hit starts within one frame of it in the audio track.
It also measures loudness and true peak after AAC encoding. No ears needed; still, nobody has listened."""
import json, re, struct, subprocess, sys
name = sys.argv[1]; out = f"out-{name}"; mp4 = f"{out}/{name}.mp4"
T = json.load(open(f"{out}/timeline.json")); FPS = T["fps"]
want = [f for f in (T.get("sync") or T.get("cuts", [])) if f > 0]
txt = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"fps={FPS},tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-an", "-f", "null", "-"], capture_output=True, text=True).stdout
diff = [0.0] + [float(l.split("=")[1]) for l in txt.splitlines() if "YAVG" in l]
med = sorted(diff)[len(diff) // 2]
SR = 4000
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vn", "-af", "lowpass=f=95,lowpass=f=95", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
x = struct.unpack(f"<{len(raw) // 2}h", raw); hop = SR // 200
e = [(sum(v * v for v in x[i:i + hop * 2]) / (hop * 2)) ** 0.5 for i in range(0, len(x) - hop * 2, hop)]; top = max(e) or 1
on = [i * hop / SR for i in range(4, len(e)) if e[i] > 0.05 * top and e[i] > 1.5 * (sum(e[i - 4:i - 1]) / 3) + 1e-6]
bad = 0
for f in want:
    t = f / FPS; near = min(on, key=lambda o: abs(o - t)) if on else 99; off = (near - t) * FPS
    pic = diff[f] if f < len(diff) else 0; ok_p = pic > max(1.0, 3 * med); ok_s = abs(off) <= 1.5
    bad += not (ok_p and ok_s)
    print(f"  frame {f:4d}: picture change {pic:5.1f} ({'ok' if ok_p else 'NO CHANGE'}; usual {med:.1f})   bass hit {off:+.1f} frames away ({'ok' if ok_s else 'OFF'})")
err = subprocess.run(["ffmpeg", "-nostats", "-i", mp4, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr; tail = err[err.rfind("Summary:"):]
I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1)); PK = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1))
print(f"{name}.mp4: {len(want) - bad} of {len(want)} sync points in step   loudness {I:.1f} LUFS   true peak {PK:.1f} dBFS ({'ok' if PK <= -1.0 else 'OVER -1'})")
sys.exit(1 if bad or PK > -1.0 else 0)
