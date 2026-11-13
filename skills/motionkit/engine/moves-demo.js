/* Gallery film: every move in moves.js for one bar (two seconds at 120 bpm) with its name on screen.
   It is the catalogue and the test: each card is a clip, so each move also plays its own sound.
   Build: bun build.ts moves   ->  out-moves/moves.mp4 */
(() => {
  const M = window.MOVES, B = M.brand, G = M.grid(120), LEN = G.bar(1), INK = B.paper, BG = B.ink, HOT = B.accentOnDark;
  const D = { fam: B.display, stretch: B.wide, weight: 600 };
  const DAWN = M.scenery(); /* sky and hills drawn in code, so the gallery needs no art files */
  const before = (x) => { x.fillStyle = BG; x.fillRect(0, 0, W, H); M.type(x, { ...D, text: "any motion", y: 590, size: 150, color: INK }); };
  const after = (x) => { M.parallax(x, 0.5, { layers: DAWN }); M.type(x, { ...D, text: "yours", y: 440, size: 220, weight: 700, color: B.paper }); };
  const mid = { x: W / 2, y: 600, color: INK, ...D }, tr = { from: before, to: after };
  const ball = (x, fr) => { x.fillStyle = BG; x.fillRect(0, 0, W, H); const u = (fr % LEN) / LEN; x.fillStyle = HOT; x.beginPath(); x.arc(lerp(200, 1720, M.io(clamp(u * 1.6))), 600 - 260 * Math.sin(u * 9), 70, 0, TAU); x.fill(); };
  const DEMOS = { /* name: [options, draw-before (ctx, f, t), draw-after] */
    letters: [{ ...mid, text: "one letter at a time", size: 150 }],
    words: [{ ...mid, text: "then word by word", size: 130 }],
    typewriter: [{ ...mid, text: "typed as you watch", size: 140, cursor: HOT }],
    scramble: [{ ...mid, text: "DECODING THE TITLE", size: 120, fam: B.mono, stretch: null, weight: 500 }],
    flap: [{ ...mid, y: 560, text: "NOW BOARDING", size: 170, fam: B.mono, stretch: null }],
    lineMask: [{ ...mid, y: 500, lines: ["rises from", "behind a line"], size: 170, rule: HOT }],
    slam: [{ ...mid, y: 560, words: ["ONE", "WORD", "A BEAT"], size: 170, weight: 800, wide: 1, color: INK, color2: HOT }],
    punchWord: [{ ...mid, y: 690, text: "BANG", size: 400, weight: 800 }],
    wheel: [{ ...mid, y: 580, prefix: "titles that", words: ["slide", "spin", "drop", "fade", "snap", "land"], size: 110, dim: B.muted }],
    swap: [{ ...mid, prefix: "make it", words: ["bold", "fast", "loud", "yours"], size: 130, color2: HOT }],
    echo: [{ ...mid, y: 610, text: "again", size: 280, color: "#fff" }, () => { X.fillStyle = B.accent; X.fillRect(0, 0, W, H); }],
    crossOut: [{ ...mid, text: "hand draw every frame", strike: 1, size: 120, color: B.ink, ink: B.accent }, () => { X.fillStyle = B.paper; X.fillRect(0, 0, W, H); }],
    highlight: [{ ...mid, text: "mark the key word", from: 1, to: 1, size: 130, bar: HOT, ink: B.ink }],
    outline: [{ ...mid, y: 640, text: "LINES FIRST", size: 190, weight: 800 }],
    tracking: [{ ...mid, text: "A FILM OPENING", size: 90 }],
    weight: [{ ...mid, y: 660, text: "HEAVY", size: 330, stretch: null }],
    caption: [{ ...mid, stretch: null, text: "each word lights up as it is spoken aloud", size: 58, color: B.ink, box: B.paper, dim: "rgba(18,20,19,.35)", hot: B.accent }, () => M.parallax(X, 0.5, { layers: DAWN })],
    ticker: [{ ...mid, y: 620, a: 0, b: 2640, size: 300, weight: 700 }, null, () => { txt(X, "frames in this gallery", W / 2, 740, 40, 500, B.muted, B.mono, false, "center"); X.textAlign = "left"; }],
    chart: [{ box: [260, 300, 1400, 560], color: HOT }],
    bars: [{ values: [0.3, 0.46, 0.4, 0.62, 0.55, 0.82], pick: 5, color: B.paper, accent: HOT }],
    callout: [{ x: 720, y: 660, tx: 1040, ty: 430, text: "look here", color: INK, fam: B.mono, size: 40 }],
    pathDraw: [{ d: "M 300 760 C 600 200, 900 900, 1200 420 S 1500 300, 1640 520", color: HOT, width: 8, head: "#fff" }],
    burst: [{ x: 960, y: 580, color: INK, n: 16 }],
    logoDraw: [{ y: 560, size: 380 }],
    bounce: [{ x0: 520, x1: 1400, ground: 800, r: 64, color: HOT }],
    flood: [{ from: before, to: B.accent, x: 960, y: 760, r0: 40 }],
    iris: [tr], push: [{ ...tr, dir: "left" }], wipe: [{ ...tr, color: HOT }], zoomThrough: [tr], glitchCut: [{ ...tr }, null, null, 18],
    dotBloom: [{ ...tr, paper: B.paper }], dotDissolve: [tr], pixelPeak: [{ ...tr, at: 0.42, edge: HOT }],
    punch: [{ draw: before, zoom: 1.3 }, null, null, 14], shake: [{ draw: before }, null, null, 24],
    parallax: [{ layers: DAWN, pan: 320, zoom: 0.1 }],
    mesh: [{ colors: [B.ink, B.accent, "#1c3f6e", HOT] }],
    grain: [{ amount: 0.28 }, (f, t) => M.mesh(X, t, { colors: [B.ink, B.accent, "#1c3f6e", HOT] })],
    glow: [{ radius: 30, strength: 0.8 }, () => { M.type(X, { ...D, text: "soft light", y: 620, size: 200, color: HOT }); }],
    sweep: [{ draw: (x) => { M.type(x, { ...D, text: "light sweep", y: 620, size: 190, weight: 700, color: B.accent }); } }],
    chroma: [{}, (f, t) => before(X), null, 0, (t) => ({ amount: 14 * (1 - t) })],
    smear: [{ draw: ball, samples: 6, shutter: 0.9 }],
    eq: [{ box: [460, 420, 1000, 300], color: HOT }],
  };
  const LIST = M.index.filter((m) => DEMOS[m.name]);
  const CLIPS = LIST.map((m, i) => { const [o, , , len] = DEMOS[m.name]; return M.clip(m.name, i * LEN + 6, len || 40, o); });
  const TOTAL = LIST.length * LEN;
  window.TOTAL = TOTAL;
  window.renderFrame = (f) => {
    f = Math.max(0, Math.min(TOTAL - 1, f | 0));
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.filter = "none"; X.globalCompositeOperation = "source-over"; X.setLineDash([]); X.textAlign = "left"; X.textBaseline = "alphabetic";
    const i = Math.floor(f / LEN), m = LIST[i], k = CLIPS[i], d = DEMOS[m.name], t = k.t(f);
    X.fillStyle = BG; X.fillRect(0, 0, W, H);
    if (d[1]) d[1](f, t);
    if (d[4]) Object.assign(k.o, d[4](t));
    k.draw(X, f);
    if (d[2]) d[2](f, t);
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.textAlign = "left"; X.textBaseline = "alphabetic"; X.globalCompositeOperation = "source-over";
    X.fillStyle = "rgba(18,20,19,.88)"; rr(X, 62, 62, 860, 132, 14); X.fill();
    txt(X, String(i + 1).padStart(2, "0") + "  " + m.name, 90, 120, 44, 600, INK, B.mono);
    txt(X, m.from, 90, 168, 24, 500, "#9aa09b", B.mono);
  };
  window.timeline = () => ({ fps: 30, total: TOTAL, bpm: G.bpm, sections: [[0, "intro"]], cues: M.cues(), captions: [] });
  window.ready = Promise.all([M.fonts(), M.levels("out-moves/levels.json")]);
})();
