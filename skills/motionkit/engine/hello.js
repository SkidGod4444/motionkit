/* hello: the example film. 15.5 seconds about this toolkit, cut on a 120 bpm grid and built only from clips (moves.js).
   Every sound comes from the clips and the grid: nothing is placed by hand. The scenery is drawn in code, so there are no art files.
   Start a film of your own from it with new.ts. Every colour comes from MOVES.brand, so MOVES.setBrand({ ... }) as the first line restyles it.
   Build: bun build.ts hello  ->  out-hello/hello.mp4 */
(() => {
  const M = window.MOVES, B = M.brand, G = M.grid(120), bar = G.bar, beat = G.beat;
  const TOTAL = bar(7) + 45;
  const D = { fam: B.display, stretch: B.wide, weight: 600, color: B.paper, x: W / 2 };
  const HILLS = M.scenery();
  const sky = (x, f, dim) => { x.fillStyle = B.ink; x.fillRect(0, 0, W, H); /* always fill the frame first: a see-through layer would let the last frame show */ M.parallax(x, f / TOTAL, { layers: HILLS, pan: 260, zoom: 0.08 }); if (dim) { x.fillStyle = M.rgba(B.ink, dim); x.fillRect(0, 0, W, H); } };
  const dark = (x, f) => { M.mesh(x, f / 240, { colors: [B.ink, M.mix(B.ink, B.accent, 0.22), M.mix(B.ink, "#3355aa", 0.2)] }); x.fillStyle = M.rgba(B.accentOnDark, 0.07 * G.pulse(f)); x.fillRect(0, 0, W, H); }; /* the background breathes on every kick */

  /* ---- the clips: M.clip(move, start frame, length, options); `until` is the frame the text leaves, for the reading-time check ---- */
  const K = {
    seen: M.clip("typewriter", 4, 16, { ...D, y: 590, size: 130, text: "Like that motion?", cursor: B.accentOnDark, until: bar(1) }),
    copy: M.clip("words", bar(1) + 2, 10, { ...D, y: 590, size: 120, text: "Copy the motion.", until: bar(2) - 8 }),
    cut: M.clip("glitchCut", bar(2) - 8, 8, { from: (x) => { sky(x, bar(2) - 8, 0.72); M.words(x, 1, K.copy.o); }, to: B.ink, color: B.accentOnDark, mute: true }) /* silent: this is the half beat of silence before the drop */,
    own: M.clip("slam", bar(2), beat(3), { ...D, y: 560, size: 230, weight: 800, wide: 1, grow: 0.1, words: ["YOUR", "OWN", "WORDS."], color2: B.accentOnDark, until: bar(3) }),
    pop: M.clip("burst", bar(2) + beat(3), 14, { x: W / 2, y: 540, r0: 420, r1: 760, n: 18, color: B.accentOnDark, width: 10 }),
    path: M.clip("pathDraw", bar(3), 30, { d: "M 420 760 C 640 380, 900 330, 1090 610 S 1330 430, 1480 520", color: B.accentOnDark, width: 9, head: "#fff", keepHead: true }),
    here: M.clip("callout", bar(3) + beat(2), 18, { x: 1480, y: 520, tx: 1560, ty: 720, text: "M.clip(\"pathDraw\")", color: B.paper, fam: B.mono, size: 30 }),
    line: M.clip("lineMask", bar(3) + 2, 10, { ...D, y: 300, size: 110, lines: ["One line per move."], until: bar(4) }),
    sound: M.clip("words", bar(4) + 2, 10, { ...D, x: 590, y: 590, size: 76, text: "Sound comes with it.", until: bar(5) }),
    mark: M.clip("highlight", bar(4) + beat(2), 10, { ...D, x: 590, y: 590, size: 76, text: "Sound comes with it.", from: 0, to: 0, bar: B.accentOnDark, ink: B.ink }),
    onbeat: M.clip("words", bar(5) + 2, 6, { ...D, x: 590, y: 590, size: 76, text: "On every beat.", until: bar(6) - 12 }),
    bars: M.clip("bars", bar(5) + 4, 30, { values: [0.3, 0.46, 0.4, 0.62, 0.55, 0.82], pick: 5, box: [1180, 330, 600, 400], color: B.paper, accent: B.accentOnDark }),
    bloom: M.clip("dotBloom", bar(6) - 12, 12, { from: (x) => scene5(x, bar(6) - 12), to: (x) => sky(x, bar(6), 0.5), paper: B.ink, cell: 36 }),
    logo: M.clip("logoDraw", bar(6) + 6, 24, { x: W / 2, y: 330, size: 200, color: "#ffffff" }),
    name: M.clip("letters", bar(6) + beat(1), 16, { ...D, y: 610, size: 150, weight: 700, text: "motionkit", until: TOTAL }),
    tag: M.clip("words", bar(6) + beat(2), 10, { ...D, y: 720, size: 54, weight: 500, stretch: null, text: "Then write your own.", until: TOTAL }),
  };

  function scene5(x, f) { dark(x, f); K.onbeat.draw(x, f); K.bars.draw(x, f); }
  const SCENES = [ /* [first frame, draw, drawn after the finish passes] */
    [0, (f) => { sky(X, f, 0.72); K.seen.draw(X, f); }],
    [bar(1), (f) => { if (K.cut.on(f)) return K.cut.draw(X, f); sky(X, f, 0.72); K.copy.draw(X, f); }],
    [bar(2), (f) => { /* the drop: one word a beat, the frame kicks on each */
      const k = Math.min(2, Math.floor((f - bar(2)) / beat(1))), since = f - bar(2) - k * beat(1);
      M.shake(X, clamp(since / 10), (x) => { dark(x, f); K.own.draw(x, f); if (K.pop.on(f) && K.pop.t(f) < 1) K.pop.draw(x, f); }, { amp: 30, seed: k * 9 });
      if (since < 3) M.chroma(X, { amount: 10 - since * 3 });
    }],
    [bar(3), (f) => { dark(X, f); K.path.draw(X, f); if (K.here.on(f)) K.here.draw(X, f); K.line.draw(X, f); }],
    [bar(4), (f) => { dark(X, f); M.eq(X, f, { box: [1180, 330, 600, 400], color: B.accentOnDark, bands: 16 }); /* bars that follow the film's own soundtrack */ K.sound.draw(X, f); if (K.mark.on(f)) K.mark.draw(X, f); }],
    [bar(5), (f) => { if (K.bloom.on(f)) K.bloom.draw(X, f); else scene5(X, f); }],
    [bar(6), (f) => { sky(X, f, 0.5); const fl = 1 - clamp((f - bar(6)) / 8); if (fl > 0) { X.fillStyle = M.rgba(B.paper, 0.55 * fl); X.fillRect(0, 0, W, H); } /* a flash on the downbeat, so the cut reads */ }, (f) => { /* the end card, drawn AFTER grain and vignette so nothing sits on top of the logo */
      K.logo.draw(X, f); if (K.name.on(f)) K.name.draw(X, f); if (K.tag.on(f)) K.tag.draw(X, f);
      if (f >= bar(6) + beat(4)) txt(X, "free and open source", W / 2, 800, 30, 500, M.rgba(B.paper, 0.7), B.mono, false, "center");
    }],
  ];
  window.TOTAL = TOTAL;
  window.renderFrame = (f) => {
    f = Math.max(0, Math.min(TOTAL - 1, f | 0));
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.filter = "none"; X.globalCompositeOperation = "source-over"; X.setLineDash([]); X.textAlign = "left"; X.textBaseline = "alphabetic"; X.imageSmoothingEnabled = true;
    let i = 0; while (i + 1 < SCENES.length && f >= SCENES[i + 1][0]) i++;
    SCENES[i][1](f);
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.textAlign = "left"; X.globalCompositeOperation = "source-over";
    M.grain(X, f, { amount: 0.09 }); vignette(0.35, 0.55);
    if (SCENES[i][2]) SCENES[i][2](f);
  };
  /* sync: frames where the picture must change and a bass hit must land together (checked on the finished file by sync.py) */
  window.timeline = () => ({ fps: 30, total: TOTAL, bpm: G.bpm, sections: [[0, "intro"], [4, "build"], [8, "drop"], [24, "outro"]], cues: M.cues(), captions: M.captions(), cuts: SCENES.map((s) => s[0]), sync: [bar(2), bar(2) + beat(1), bar(2) + beat(2), bar(3), bar(4), bar(5), bar(6)] });
  window.ready = Promise.all([M.fonts(), M.levels("out-hello/levels.json")]);
})();
