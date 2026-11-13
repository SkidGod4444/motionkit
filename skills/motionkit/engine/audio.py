"""Original soundtrack, synthesised and cut to out/timeline.json (no samples, no numpy).
Key clicks land on every typed character, ticks on image swaps, noise bursts on strobes,
a kick and whoosh on each scene cut, a low pad underneath, a chord on the final mark.
python3 audio.py [dir] -> <dir>/audio.wav   (dir defaults to out; a timeline may carry its own hits, chord and pulseEnd)"""
import json, math, random, struct, sys, wave

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"

SR = 44100
T = json.load(open(f"{OUT}/timeline.json"))
N = int(SR * (T["total"] / T["fps"] + 0.1))
buf = [0.0] * N
rnd = random.Random(7)
at = lambda frame: int(frame / T["fps"] * SR)


def add(start, samples, gain=1.0):
    for i, v in enumerate(samples):
        j = start + i
        if 0 <= j < N:
            buf[j] += v * gain


def click(pitch=2300.0, dur=0.022, noise=0.7):
    n = int(SR * dur); out = []; prev = 0.0
    for i in range(n):
        env = math.exp(-i / (n * 0.18))
        w = rnd.uniform(-1, 1); hp = w - prev; prev = w
        out.append(env * (noise * hp * 0.6 + (1 - noise) * math.sin(2 * math.pi * pitch * i / SR)))
    return out


def burst(dur=0.035):
    n = int(SR * dur)
    return [rnd.uniform(-1, 1) * (1 - i / n) ** 2 for i in range(n)]


def kick(f0=130.0, f1=38.0, dur=0.26):
    n = int(SR * dur); out = []; ph = 0.0
    for i in range(n):
        t = i / n; ph += 2 * math.pi * (f1 + (f0 - f1) * math.exp(-t * 9)) / SR
        out.append(math.sin(ph) * math.exp(-t * 5))
    return out


def whoosh(dur=0.2):
    n = int(SR * dur); out = []; lp = 0.0
    for i in range(n):
        t = i / n; a = 0.02 + 0.5 * t
        lp += a * (rnd.uniform(-1, 1) - lp); out.append(lp * t * t)
    return out


def tone(freqs, dur, decay=3.0, attack=0.01):
    n = int(SR * dur); out = []
    for i in range(n):
        t = i / SR; env = min(1.0, t / attack) * math.exp(-t * decay)
        out.append(env * sum(math.sin(2 * math.pi * f * t) + 0.3 * math.sin(4 * math.pi * f * t) for f in freqs) / len(freqs))
    return out


# pad: two detuned lows with a slow swell, ducked at the very end
for i in range(N):
    t = i / SR
    swell = 0.55 + 0.45 * math.sin(2 * math.pi * 0.21 * t)
    fade = min(1.0, t / 0.4) * min(1.0, max(0.0, (N / SR - t) / 1.5))
    buf[i] += 0.085 * swell * fade * (math.sin(2 * math.pi * 55 * t) + 0.6 * math.sin(2 * math.pi * 82.6 * t) + 0.35 * math.sin(2 * math.pi * 110.4 * t))

# pulse: a soft bass pluck every half second until the mark lands
pluck = tone([55.0], 0.3, decay=11)
for k in range(int(T.get("pulseEnd", 15.2) / 0.5)):
    add(int(k * 0.5 * SR), pluck, 0.32 if k % 2 == 0 else 0.2)

for f in T["keys"]:
    add(at(f), click(2100 + rnd.uniform(-300, 500)), 0.42)
for f in T["swaps"]:
    add(at(f), click(900, 0.03, 0.25), 0.3)
for f in T["strobes"]:
    add(at(f), burst(), 0.2)
w, k = whoosh(), kick()
for f in T["cuts"][1:]:
    add(at(f) - len(w), w, 0.5)
    add(at(f), k, 0.55)
big = kick(150, 30, 0.6)
for f, g in T.get("hits", [[180, 0.95], [228, 0.8], [459, 0.7], [494, 1.0]]):
    add(at(f), big, g)
CH = T.get("chord", 494)
add(at(CH), tone([261.63, 329.63, 392.0, 523.25], 2.4, decay=1.6, attack=0.004), 0.55)
add(at(CH + 4), tone([130.81], 2.2, decay=1.4), 0.4)

# simple feedback echo for air, then soft clip
d1, d2 = int(SR * 0.093), int(SR * 0.157)
for i in range(N):
    if i >= d1: buf[i] += 0.16 * buf[i - d1]
    if i >= d2: buf[i] += 0.1 * buf[i - d2]
peak = max(abs(v) for v in buf) or 1.0
with wave.open(f"{OUT}/audio.wav", "wb") as wv:
    wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR)
    wv.writeframes(b"".join(struct.pack("<h", int(32767 * math.tanh(1.6 * v / peak) / math.tanh(1.6) * 0.55)) for v in buf))
print(f"wrote {OUT}/audio.wav  {N / SR:.2f}s  keys={len(T['keys'])} cuts={len(T['cuts'])}")
