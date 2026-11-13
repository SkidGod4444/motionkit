/* title: the example overlay. A 4 second animated title with a see-through background, made to sit on top of footage in a
   video editor. The timeline says alpha: true, so the build writes out-title/title.mov (ProRes 4444 with alpha), and
   sound: "fx", so it carries only the sounds its moves make, no music.
   An overlay CLEARS the frame instead of filling it, and uses no grain, vignette or full-frame background.
   Start an overlay of your own from it: bun <engine>/new.ts <name> --overlay
   Build: bun <engine>/build.ts title  ->  out-title/title.mov */
(() => {
  const M = window.MOVES, B = M.brand, G = M.grid(120), beat = G.beat;
  const TOTAL = 120, OUT = TOTAL - 12; /* the last 12 frames fade the whole title out */
  const LEFT = 150, BASE = 880; /* lower left, inside the title-safe area */
  const K = {
    rule: M.clip("pathDraw", 0, 12, { d: `M ${LEFT} ${BASE - 150} L ${LEFT} ${BASE + 50}`, color: B.accentOnDark, width: 12 }),
    name: M.clip("lineMask", 4, 14, { lines: ["Your title here"], x: LEFT + 50, y: BASE - 40, align: "left", size: 96, fam: B.display, stretch: B.wide, weight: 700, color: "#ffffff", until: OUT }),
    role: M.clip("typewriter", beat(1) + 4, 18, { text: "a second line under it", x: LEFT + 52, y: BASE + 30, align: "left", size: 40, fam: B.mono, weight: 500, color: "#ffffff", cursor: B.accentOnDark, until: OUT }),
  };
  window.TOTAL = TOTAL;
  window.renderFrame = (f) => {
    f = Math.max(0, Math.min(TOTAL - 1, f | 0));
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.filter = "none"; X.globalCompositeOperation = "source-over"; X.setLineDash([]); X.textAlign = "left"; X.textBaseline = "alphabetic"; X.shadowColor = "transparent"; X.shadowBlur = 0;
    X.clearRect(0, 0, W, H); /* see-through, not black */
    const fade = 1 - clamp((f - OUT) / (TOTAL - 1 - OUT));
    if (fade <= 0) return;
    const draw = (x) => { K.rule.draw(x, f); K.name.draw(x, f); if (K.role.on(f)) K.role.draw(x, f); };
    /* a soft dark shadow under the type, so it reads on bright footage as well as dark */
    X.globalAlpha = fade; X.shadowColor = "rgba(0,0,0,.55)"; X.shadowBlur = 24; X.shadowOffsetY = 4;
    draw(X);
    X.shadowColor = "transparent"; X.shadowBlur = 0; X.shadowOffsetY = 0; X.globalAlpha = 1;
  };
  window.timeline = () => ({ fps: 30, total: TOTAL, bpm: G.bpm, alpha: true, sound: "fx", cues: M.cues(), captions: M.captions(), cuts: [0] });
  window.ready = M.fonts();
})();
