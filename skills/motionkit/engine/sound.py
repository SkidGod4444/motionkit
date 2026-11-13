# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy"]
# ///
"""Beat-grid soundtrack, synthesised from a film's timeline. No samples, no downloaded music.
uv run sound.py <dir>          reads <dir>/timeline.json, writes <dir>/audio.wav (stereo), levels.json, events.json, spectrum.png
uv run sound.py <dir> --check  also verifies the result without ears (see check() below)

timeline.json needs: fps, total, bpm, and optionally
  sections  [[beat, name], ...]   intro | build | drop | break | outro   (default: one "drop")
  cues      [{f, kind, gain, dur, pan}, ...]   from MOVES.cues(): the sound each move makes, at its frame
  root      midi note of the key (default 45 = A, minor)
  target    integrated loudness in LUFS (default -16, the usual level for web video; -20 for sound "fx")
  sound     "fx" = only the move sounds, no music: for a clip that will sit over footage that has its own sound
Music sits on the grid (kick, clap, hats, bass, pad, riser, half a beat of silence before each drop);
the pad and bass duck on every kick; move sounds go on top with a little room reverb; a limiter keeps peaks under -1 dB."""
import json, re, subprocess, sys, wave
import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "out"
T = json.load(open(f"{OUT}/timeline.json"))
SR, FPS, BPM = 44100, T["fps"], T["bpm"]
DUR = T["total"] / FPS + 0.6
N = int(SR * DUR)
BEAT = 60.0 / BPM
rng = np.random.default_rng(7)
ROOT = T.get("root", 45)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
tt = lambda d: np.arange(int(SR * d)) / SR


def filt(x, lo=None, hi=None, order=4):
    """Zero-phase band filter in the frequency domain: keep lo..hi Hz."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo: g *= 1 - 1 / np.sqrt(1 + (f / lo) ** (2 * order))
    return np.fft.irfft(X * g, len(x))


def sweep(f0, f1, d, curve=6.0):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * curve / max(d, 1e-3) * 1.0)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


noise = lambda d: rng.uniform(-1, 1, int(SR * d))
dec = lambda d, k: np.exp(-tt(d) * k)
saw = lambda f, d: 2 * ((f * tt(d)) % 1.0) - 1


# ---- drum kit ----
def kick():
    d = 0.32; return sweep(150, 44, d, 9) * dec(d, 9) + 0.5 * filt(noise(d), 1500, 6000) * dec(d, 160)
def clap():
    d = 0.22; e = sum(np.where(tt(d) >= o, np.exp(-(tt(d) - o) * (38 if o < 0.02 else 22)), 0) for o in (0, 0.011, 0.024)); return filt(noise(d), 900, 5200) * e * 0.8
def hat(open_=False):
    d = 0.2 if open_ else 0.045; return filt(noise(d), 7000) * dec(d, 18 if open_ else 90)
def snare():
    d = 0.16; return (filt(noise(d), 1500, 8000) * dec(d, 28) + 0.5 * sweep(240, 170, d, 20) * dec(d, 30)) * 0.9
def bass(m, d):
    f = hz(m); return (filt(saw(f, d), None, 420) * 0.8 + np.sin(2 * np.pi * f * tt(d))) * np.minimum(1, tt(d) / 0.006) * dec(d, 7)
def pad(notes, d):
    x = sum(saw(hz(n) * det, d) for n in notes for det in (0.996, 1.0, 1.005)) / (3 * len(notes))
    return filt(x, 90, 1100) * np.minimum(1, tt(d) / 0.35) * np.minimum(1, (d - tt(d)) / 0.3)
def stab(notes, d=0.5):
    x = sum(saw(hz(n), d) for n in notes) / len(notes); return filt(x, 200, 3200) * dec(d, 9)


# ---- move sounds: one function per cue kind, d = length in seconds when the cue carries one ----
def fx(kind, d=None):
    if kind == "type": q = 0.02; return filt(noise(q), 2500) * dec(q, 260) + 0.4 * np.sin(2 * np.pi * rng.uniform(1900, 2700) * tt(q)) * dec(q, 300)
    if kind == "tick": q = 0.04; return np.sin(2 * np.pi * 1320 * tt(q)) * dec(q, 110) + 0.5 * filt(noise(q), 3000) * dec(q, 400)
    if kind == "pop": q = 0.09; return sweep(620, 190, q, 9) * dec(q, 38)
    if kind == "thud": q = 0.22; return sweep(110, 52, q, 8) * dec(q, 16) + 0.35 * filt(noise(q), None, 900) * dec(q, 70)
    if kind == "impact": q = 0.9; return 1.1 * sweep(84, 34, q, 5) * dec(q, 5.5) + 0.6 * filt(noise(q), None, 3200) * dec(q, 30) + 0.3 * filt(noise(q), 2000) * dec(q, 55)
    if kind == "ding": q = 1.4; return sum(a * np.sin(2 * np.pi * hz(ROOT + 43) * r * tt(q)) * dec(q, k) for r, a, k in ((1, 1, 3.5), (2.76, 0.45, 6), (5.4, 0.25, 10))) * 0.6
    if kind == "scratch": q = 0.13; return filt(noise(q), 1800, 6500) * np.sin(np.pi * tt(q) / q) ** 0.5 * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 90 * tt(q))))
    if kind == "swipe": q = 0.18; return filt(noise(q), 3500) * np.sin(np.pi * tt(q) / q) ** 2
    d = max(d or 0.4, 0.12); t = tt(d); u = t / d
    if kind == "whoosh": return sum(filt(noise(d), lo, hi) * np.exp(-((u - c) / 0.2) ** 2) for lo, hi, c in ((200, 700, 0.3), (600, 2200, 0.5), (2000, 7000, 0.68))) * 0.9
    if kind == "riser": return (filt(noise(d), 1200) * u ** 2 + 0.5 * np.sin(2 * np.pi * np.cumsum(180 * 2 ** (u * 2.2)) / SR) * u ** 2) * 0.8
    if kind == "rise": return np.sin(2 * np.pi * np.cumsum(220 * 2 ** (u * 2)) / SR) * np.sin(np.pi * u) ** 0.6 * (0.75 + 0.25 * np.sin(2 * np.pi * 11 * t)) * 0.6
    if kind == "swell": return filt(sum(saw(hz(ROOT + 12 + n), d) for n in (0, 7, 12)) / 3, 150, 1800) * u ** 2 * np.minimum(1, (1 - u) / 0.04) * 0.8
    if kind == "glitch": return np.round(filt(noise(d), 700, 5500) * 3) / 3 * (rng.uniform(0, 1, int(d * 34) + 1)[(t * 34).astype(int)] > 0.45) * 0.8
    if kind == "flap": x = np.zeros(len(t)); c = filt(noise(0.03), 250, 2200) * dec(0.03, 150); [x.__setitem__(slice(i, i + len(c)), x[i:i + len(c)] + c[:len(x) - i] * rng.uniform(0.5, 1)) for i in range(0, len(x) - len(c), int(SR * 0.047))]; return x
    if kind == "sparkle":
        x = np.zeros(len(t))
        for i in rng.integers(0, max(1, len(t) - 900), int(d * 42) + 1):
            p = np.sin(2 * np.pi * rng.uniform(3200, 7200) * tt(0.02)) * dec(0.02, 220); x[i:i + len(p)] += p * rng.uniform(0.3, 1)
        return x * np.sin(np.pi * u) ** 0.5
    if kind == "draw": return filt(noise(d), 2200, 5200) * (0.6 + 0.4 * np.sin(2 * np.pi * 17 * t)) * np.minimum(1, u / 0.05) * np.minimum(1, (1 - u) / 0.1) * 0.5
    return np.zeros(1)


LOW = {"kick", "impact", "thud"}  # sounds with a low thump: check() looks for each of these in the bass band
BASSY = LOW | {"bass", "pad", "pop", "rise", "riser", "swell", "outro"}  # everything that puts energy under 95 Hz
events = []


def place(bus, t, x, gain=1.0, pan=0.0, kind=None):
    i = int(round(t * SR))
    if i >= N or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[: N - i]; a = (pan + 1) * np.pi / 4
    bus[i:i + len(x), 0] += x * gain * np.cos(a); bus[i:i + len(x), 1] += x * gain * np.sin(a)
    if kind: events.append({"t": round(t, 4), "kind": kind, "low": kind in LOW and gain >= 0.3})


drums, music, fxb = (np.zeros((N, 2)) for _ in range(3))
duck = np.ones(N)
FXONLY = T.get("sound") == "fx"
secs = [[0, "none"]] if FXONLY else sorted(T.get("sections") or [[0, "drop"]])
nbeats = int(T["total"] / FPS / BEAT) + 1
sec_at = lambda b: [n for s, n in secs if s <= b][-1] if b >= secs[0][0] else "intro"
PROG = [(0, [0, 3, 7]), (-4, [-4, 0, 3]), (3, [3, 7, 10]), (-2, [-2, 2, 5])]  # i, VI, III, VII of the minor key
K, C, H, OH, SN = kick(), clap(), hat(), hat(True), snare()

for b in range(nbeats):
    t0, name, bar, inbar = b * BEAT, sec_at(b), b // 4, b % 4
    root, chord = PROG[bar % 4]
    nxt = sec_at(b + 1)
    gap = name != "drop" and nxt == "drop"  # the last beat before a drop: everything stops for its second half
    if inbar == 0 and name in ("intro", "build", "break", "drop"):
        place(music, t0, pad([ROOT + 12 + n for n in chord], 4 * BEAT + 0.3), 0.5 if name != "drop" else 0.32, 0, "pad")
    if name == "intro":
        if inbar in (1, 3): place(drums, t0 + BEAT / 2, H, 0.16, 0.3, "hat")
    elif name == "build":
        place(drums, t0, K, 0.75, 0, "kick"); kt = t0
        i = int(kt * SR); n = int(0.26 * SR); duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.5 * np.exp(-np.arange(len(duck[i:i + n])) / (0.09 * SR)))
        steps = 4 if nxt == "drop" or sec_at(b + 2) == "drop" else 2
        for s in range(steps):
            if not (gap and s >= steps / 2): place(drums, t0 + s * BEAT / steps, SN, 0.3 + 0.25 * (b % 4) / 4 + 0.05 * s, -0.1, "snare")
    elif name == "drop":
        place(drums, t0, K, 0.95, 0, "kick")
        i = int(t0 * SR); n = int(0.3 * SR); duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.65 * np.exp(-np.arange(len(duck[i:i + n])) / (0.1 * SR)))
        if inbar in (1, 3): place(drums, t0, C, 0.6, 0.05, "clap")
        place(drums, t0, H, 0.22, 0.35, "hat"); place(drums, t0 + BEAT / 2, OH, 0.2, -0.3, "hat")
        place(music, t0 + BEAT / 2, bass(ROOT - 12 + root, BEAT * 0.45), 0.62, 0, "bass")
        if inbar == 0: place(music, t0, stab([ROOT + 24 + n for n in chord]), 0.3, -0.2)
        if inbar == 2: place(music, t0 + BEAT / 2, stab([ROOT + 24 + n for n in chord], 0.3), 0.2, 0.25)
    elif name == "outro" and (b == 0 or sec_at(b - 1) != "outro"):
        place(drums, t0, fx("impact"), 0.9, 0, "impact")
        place(music, t0, pad([ROOT + 12 + n for n in (0, 7, 12, 16)], min(DUR - t0, 5.0)) * dec(min(DUR - t0, 5.0), 0.7), 0.7, 0, "outro")
        place(fxb, t0, fx("ding"), 0.5, 0.2)
    if gap:  # silence before the drop
        i = int((t0 + BEAT / 2) * SR); j = int((t0 + BEAT) * SR); f = np.linspace(1, 0, min(400, j - i))
        for bus in (drums, music): bus[i:i + len(f)] *= f[:, None]; bus[i + len(f):j] = 0

# a riser fills every build section, ending where the silence starts
for k, (s, n) in enumerate(secs):
    if n == "build":
        e = secs[k + 1][0] if k + 1 < len(secs) else nbeats
        place(fxb, s * BEAT, fx("riser", (e - s - 0.5) * BEAT), 0.5)

kicks = [e["t"] for e in events if e["kind"] == "kick"]
for c in T.get("cues", []):
    t, x, kind = c["f"] / FPS, fx(c["kind"], c.get("dur")), c["kind"]
    if kind in LOW and any(-0.03 <= k - t <= 0.5 for k in kicks):  # a move's thump that lands on or just before a kick keeps its crack and gives the bass to the kick
        x = filt(x, 160); kind = kind + "-high"
    place(fxb, t, x, 0.55 * c.get("gain", 1), 0.6 * c.get("pan", 0), kind)

# mix: music ducks under the kick; move sounds and claps get a short room; then loudness and a limiter
music *= duck[:, None]
ir = np.stack([filt(rng.uniform(-1, 1, int(SR * 0.9)) * np.exp(-tt(0.9) * 6.5), 250, 6000) for _ in range(2)], 1)
send = fxb + 0.25 * drums
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, ch], N + len(ir)) * np.fft.rfft(ir[:, ch], N + len(ir)))[:N] for ch in range(2)], 1)
mix = drums + music + fxb + 0.05 * wet
mix *= np.minimum(1, np.arange(N) / (0.01 * SR))[:, None] * np.minimum(1, (N - np.arange(N)) / (0.5 * SR))[:, None]


def write(x):
    with wave.open(f"{OUT}/audio.wav", "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def loud():
    err = subprocess.run(["ffmpeg", "-nostats", "-i", f"{OUT}/audio.wav", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = err[err.rfind("Summary:"):]
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1)), float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1))


mix /= max(np.abs(mix).max(), 1e-9) / 0.5
write(mix); target = T.get("target", -20.0 if FXONLY else -16.0)
for _ in range(3):  # raise to the target, squash what pokes over the ceiling, measure again
    I, _pk = loud()
    if I < -60: break  # too little sound to measure (a very short or silent clip): leave it as it is
    mix *= 10 ** ((target - I) / 20)
    mix = np.where(np.abs(mix) > 0.6, np.sign(mix) * (0.6 + 0.22 * np.tanh((np.abs(mix) - 0.6) / 0.22)), mix); write(mix)  # ceiling 0.82 = -1.7 dB, leaving room for what AAC adds
I, PK = loud()

# per-frame levels for moves that follow the sound (MOVES.eq)
mono = mix.mean(1); win = 2048; edges = np.geomspace(40, 12000, 17); fr = np.fft.rfftfreq(win, 1 / SR); rows = []; rms = []
for f in range(T["total"]):
    c = int((f + 0.5) / FPS * SR); seg = mono[max(0, c - win // 2): c + win // 2]; seg = np.pad(seg, (0, win - len(seg)))
    sp = np.abs(np.fft.rfft(seg * np.hanning(win))); rows.append([float(sp[(fr >= a) & (fr < b)].mean()) for a, b in zip(edges[:-1], edges[1:])]); rms.append(float(np.sqrt((seg ** 2).mean())))
rows = np.array(rows); rows = np.clip(rows / (np.percentile(rows, 97, axis=0) + 1e-9), 0, 1) ** 0.6
json.dump({"fps": FPS, "rms": [round(v / (max(rms) or 1), 3) for v in rms], "bands": np.round(rows, 3).tolist()}, open(f"{OUT}/levels.json", "w"))
json.dump({"bpm": BPM, "events": sorted(events, key=lambda e: e["t"])}, open(f"{OUT}/events.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/audio.wav", "-lavfi", "showspectrumpic=s=1600x500:legend=0:scale=log:fscale=log", f"{OUT}/spectrum.png"])
print(f"wrote {OUT}/audio.wav  {DUR:.2f}s  {BPM} bpm  {len(T.get('cues', []))} move sounds  {len(events)} scheduled hits  {I:.1f} LUFS  peak {PK:.1f} dBFS")


def check():
    """Without ears: (1) every scheduled low hit (kick, impact, thud) shows up as a jump in bass energy within one frame of its time,
    (2) no bass jump happens where nothing was scheduled, (3) loudness and peak are where they should be."""
    low = filt(mono, None, 95, 6); hop = int(SR * 0.005); e = np.array([np.sqrt((low[i:i + hop * 2] ** 2).mean()) for i in range(0, N - hop * 2, hop)])
    on = [i * hop / SR for i in range(4, len(e)) if e[i] > 0.05 * e.max() and e[i] > 1.5 * e[i - 4:i - 1].mean() + 1e-6]
    on = [t for k, t in enumerate(on) if k == 0 or t - on[k - 1] > 0.05]
    want = sorted({round(ev["t"], 3) for ev in events if ev["low"]}); tol = 1.0 / FPS + 0.012
    hit = [t for t in want if any(abs(o - t - 0.005) <= tol for o in on)]
    known = sorted(ev["t"] for ev in events if ev["kind"] in BASSY)  # a stray is a bass jump with no bass-carrying sound scheduled near it
    stray = [o for o in on if not any(-0.02 <= o - t <= 0.15 for t in known)]
    print(f"bass hits found on time: {len(hit)} of {len(want)}   bass jumps with no scheduled hit: {len(stray)}")
    if "--debug" in sys.argv:
        for t in want: print(f"   want {t:.3f} nearest {min((o - t for o in on), key=abs):+.3f} {[ev['kind'] for ev in events if abs(ev['t'] - t) < 0.002]}")
    for t in want:
        if t not in hit: print(f"  missing at {t:.2f}s (frame {t * FPS:.0f}): {[ev['kind'] for ev in events if abs(ev['t'] - t) < 0.002]}")
    for o in stray[:8]: print(f"  unscheduled at {o:.2f}s (frame {o * FPS:.0f})")
    level = abs(I - target) <= 1.0 or (FXONLY and I < -60)  # a few sparse move sounds are too little to measure
    ok = len(hit) == len(want) and not stray and level and PK <= -1.0
    print(f"loudness {I:.1f} LUFS (target {target:.0f}, within 1: {abs(I - target) <= 1.0})   peak {PK:.1f} dBFS (under -1: {PK <= -1.0})   {'PASS' if ok else 'FAIL'}")
    return ok


if "--check" in sys.argv and not check(): sys.exit(2)  # 2 = made the track but a check failed; anything else non-zero is a crash
