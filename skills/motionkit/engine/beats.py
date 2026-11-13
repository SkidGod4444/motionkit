# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy"]
# ///
"""Find the beat of a music file:  uv run beats.py <audio> [--from seconds] [--len seconds] [--out beats.json]
Prints tempo, the time of the first beat, and how strong each bar is (to pick where an excerpt should start).
With --out it writes beats.json and beats.js (window.BEATS) for the excerpt: {bpm, from, len, fps, frames: [frame of beat 0, 1, 2, ...],
peaks: [loudness per frame, 0..1]}. A film loads beats.js and writes its scenes in beats, so another song is a rerun, not a rewrite."""
import json, subprocess, sys
import numpy as np
a = sys.argv[1:]; src = a[0]
opt = lambda n, d: (a[a.index(n) + 1] if n in a else d)
SR = 22050
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32)
hop = 256; n = (len(x) - 1024) // hop
win = np.hanning(1024); spec = np.abs(np.fft.rfft(np.stack([x[i * hop:i * hop + 1024] * win for i in range(n)]), axis=1))
fr = np.fft.rfftfreq(1024, 1 / SR)
low = spec[:, fr < 150].sum(1); full = spec.sum(1)
flux = np.maximum(0, np.diff(np.log1p(low * 20), prepend=0)) + 0.3 * np.maximum(0, np.diff(np.log1p(full), prepend=0))
flux -= flux.mean(); hz = SR / hop
best = None
for bpm in np.arange(70, 181, 0.05):
    per = 60 / bpm * hz; k = np.arange(int(len(flux) / per) - 1)
    sc = max(((flux[np.clip(np.round(ph + k * per).astype(int), 0, len(flux) - 1)].sum() / len(k), ph) for ph in np.arange(0, per, 1.0)))
    if best is None or sc[0] > best[0]: best = (sc[0], bpm, sc[1] / hz)
_, bpm, off = best
print(f"{src}: {len(x) / SR:.1f}s  tempo {bpm:.2f} bpm  first beat at {off:.3f}s  (half/double tempo is possible: check the bar strengths)")
beat = 60 / bpm; bars = int((len(x) / SR - off) / (4 * beat))
e = [float(np.sqrt((x[int((off + b * 4 * beat) * SR):int((off + (b + 1) * 4 * beat) * SR)] ** 2).mean())) for b in range(bars)]
lo = [float(low[int((off + b * 4 * beat) * hz):int((off + (b + 1) * 4 * beat) * hz)].mean()) for b in range(bars)]
m, ml = max(e), max(lo)
print("bar: loudness / bass (0-9), time")
for b in range(min(bars, 48)): print(f"  {b:3d}  {'#' * round(9 * e[b] / m):9s} {'=' * round(9 * lo[b] / ml):9s} {off + b * 4 * beat:6.1f}s")
if "--out" in a:
    t0 = float(opt("--from", "0")); ln = float(opt("--len", "30")); fps = 30
    first = off + np.ceil((t0 - off) / beat - 1e-6) * beat  # first beat at or after the excerpt start
    frames = [int(round((first - t0 + i * beat) * fps)) for i in range(int((ln - (first - t0)) / beat) + 1)]
    # the excerpt's shape, one value a frame, for MOVES.wave
    seg = x[int(t0 * SR):int((t0 + ln) * SR)]; step = SR // fps
    pk = np.array([np.abs(seg[i * step:(i + 1) * step]).max() if len(seg[i * step:(i + 1) * step]) else 0 for i in range(int(ln * fps))])
    out = opt("--out", "beats.json"); data = {"src": src, "bpm": round(float(bpm), 2), "from": t0, "len": ln, "fps": fps, "frames": frames, "peaks": [round(float(p), 3) for p in pk / (pk.max() or 1)]}
    json.dump(data, open(out, "w")); open(out.rsplit(".", 1)[0] + ".js", "w").write("window.BEATS = " + json.dumps(data) + ";\n")
    print(f"wrote {opt('--out', 'beats.json')}: {len(frames)} beats, first on frame {frames[0]}")
