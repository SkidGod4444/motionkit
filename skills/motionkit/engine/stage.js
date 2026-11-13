/* Stage: pieces for films that show a product instead of a headline: glass panels, a camera, planes that lean away
   with depth of field, live tiles, a terminal, code, a waveform. Load after moves.js; everything is added to MOVES.
   Call MOVES.frame() first thing in renderFrame: it hands the scratch canvases back. All canvases here are software,
   and every piece is a pure function of the frame number. */
(() => {
  const M = window.MOVES, pool = []; let used = 0;
  const take = () => { if (used === pool.length) { const c = mk(W, H); pool.push([c, c.getContext("2d", SOFT)]); } const p = pool[used++], x = p[1];
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = "none"; x.globalCompositeOperation = "source-over"; x.shadowColor = "transparent"; x.shadowBlur = 0; x.shadowOffsetY = 0; x.setLineDash([]); x.clearRect(0, 0, W, H); return p; };
  M.frame = () => { used = 0; };
  /* everything a move or a piece can leave behind on a context */
  M.reset = (c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = "none"; c.globalCompositeOperation = "source-over"; c.setLineDash([]); c.lineDashOffset = 0; c.lineJoin = "miter"; c.lineCap = "butt"; c.miterLimit = 10;
    c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.imageSmoothingEnabled = true; };

  /* ---- glass: a dark rounded panel with a soft shadow and a rim of light along its edge ---- */
  M.glass = (c, x, y, w, h, o = {}) => {
    const r = o.r ?? 28;
    c.save();
    if (o.shadow !== 0) { c.shadowColor = `rgba(0,0,0,${o.shadow ?? 0.6})`; c.shadowBlur = o.blur ?? 70; c.shadowOffsetY = o.drop ?? 34; }
    const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, o.top || "rgba(38,39,45,.94)"); g.addColorStop(1, o.bottom || "rgba(17,17,21,.94)");
    c.fillStyle = g; rr(c, x, y, w, h, r); c.fill(); c.restore();
    const rim = c.createLinearGradient(x, y, x + w * 0.7, y + h); rim.addColorStop(0, o.rim || "rgba(255,255,255,.42)"); rim.addColorStop(0.45, "rgba(255,255,255,.07)"); rim.addColorStop(1, "rgba(255,255,255,.2)");
    c.strokeStyle = rim; c.lineWidth = o.line ?? 1.5; rr(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r); c.stroke();
  };

  /* ---- backdrop: near-black with slow soft pools of light, so glass has something to sit on ---- */
  M.backdrop = (c, f, o = {}) => {
    const base = o.base || "#08080a", lights = o.lights || ["#2a2c36", "#3a2a22", "#1c2333"];
    c.fillStyle = base; c.fillRect(0, 0, W, H);
    lights.forEach((col, i) => { const ph = f / (o.slow ?? 420) + i * 2.4, x = W * (0.5 + 0.42 * Math.sin(ph * 0.8 + i * 1.3)), y = H * (0.5 + 0.4 * Math.cos(ph * 0.6 + i * 2.1)), r = W * (0.5 + 0.08 * Math.sin(ph + i));
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, M.rgba(col, 0.85)); g.addColorStop(1, M.rgba(col, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); });
    if (o.streak !== false) { /* one long diagonal band of light, like a reflection on a dark surface */
      c.save(); c.translate(W * (0.3 + 0.1 * Math.sin(f / 500)), H / 2); c.rotate(-0.55); const g = c.createLinearGradient(0, -260, 0, 260); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, `rgba(255,255,255,${o.streak ?? 0.06})`); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(-W * 1.5, -260, W * 3, 520); c.restore(); }
  };

  /* ---- camera: look at a point of a larger scene. cam = { x, y, zoom, rot }; MOVES.cam(a, b, t) glides between two ---- */
  M.camera = (c, cam, draw) => { c.save(); c.translate(W / 2, H / 2); c.scale(cam.zoom ?? 1, cam.zoom ?? 1); if (cam.rot) c.rotate(cam.rot); c.translate(-(cam.x ?? W / 2), -(cam.y ?? H / 2)); draw(c); c.restore(); };
  M.cam = (a, b, t, ease = M.io) => { const p = ease(clamp(t)), L = (k, d) => lerp(a[k] ?? d, b[k] ?? d, p); return { x: L("x", W / 2), y: L("y", H / 2), zoom: Math.exp(lerp(Math.log(a.zoom ?? 1), Math.log(b.zoom ?? 1), p)), rot: L("rot", 0) }; };

  /* ---- tilt: draw a full-frame scene as a plane leaning away from the viewer, far edge smaller, darker and out of focus.
     draw(ctx) paints the plane (1920x1080). depth: how much smaller the far edge is. focus: 0 (far edge) .. 1 (near edge) is sharp.
     blur: pixels of blur away from the focus. fog: how much the far edge fades. top/height/cx/width place it on screen. roll: radians. */
  M.tilt = (c, draw, o = {}) => {
    const [src, sx] = take(); draw(sx);
    let soft = null; if (o.blur) { const p = take(); p[1].filter = `blur(${o.blur}px)`; p[1].drawImage(src, 0, 0); p[1].filter = "none"; soft = p[0]; }
    const k = Math.max(0.001, o.depth ?? 1.1), top = o.top ?? 90, hgt = o.height ?? 860, cx = o.cx ?? W / 2, wd = (o.width ?? 1.25) * W, focus = o.focus ?? 0.8, fog = o.fog ?? 0.85;
    /* one screen row at a time: row p (0 top .. 1 bottom) shows plane row v, where rows crowd together toward the far edge */
    const V = (p) => 1 - (Math.pow(1 + k, 1 - p) - 1) / k, S = (v) => 1 / (1 + k * (1 - v)), rows = Math.ceil(hgt);
    c.save(); if (o.roll) { c.translate(cx, top + hgt / 2); c.rotate(o.roll); c.translate(-cx, -(top + hgt / 2)); }
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    for (let i = 0; i < rows; i++) {
      const v0 = V(i / rows), v1 = V((i + 1) / rows), v = (v0 + v1) / 2, dw = wd * S(v), a = 1 - fog * Math.pow(1 - v, 1.6), off = Math.abs(v - focus) / Math.max(focus, 1 - focus), b = soft ? clamp(off * 1.5) : 0;
      const sy = v0 * H, sh = Math.max(0.75, (v1 - v0) * H);
      if (b < 1) { c.globalAlpha = a; c.drawImage(src, 0, sy, W, sh, cx - dw / 2, top + i, dw, 1.5); }
      if (b > 0) { c.globalAlpha = a * b; c.drawImage(soft, 0, sy, W, sh, cx - dw / 2, top + i, dw, 1.5); }
    }
    c.restore(); c.globalAlpha = 1;
  };

  /* ---- tiles: a grid of small screens, each playing something live. cells: [{ draw(ctx, t, f), len, hold, offset, bg, label }]
     Each cell is drawn through a scaled context in 1920x1080 units, so any move works inside it. ---- */
  M.tiles = (c, f, o) => {
    const { cells, cols, x, y, w } = o, gap = o.gap ?? 26, cw = (w - gap * (cols - 1)) / cols, ch = (cw * 9) / 16, r = o.r ?? 14;
    cells.forEach((cell, i) => {
      const px = x + (i % cols) * (cw + gap), py = y + Math.floor(i / cols) * (ch + gap), len = cell.len ?? 50, loop = len + (cell.hold ?? 34), ff = (((f + (cell.offset ?? i * 11)) % loop) + loop) % loop, t = clamp(ff / len);
      c.save(); rr(c, px, py, cw, ch, r); c.clip(); c.translate(px, py); c.scale(cw / W, cw / W); c.fillStyle = cell.bg || "#101013"; c.fillRect(0, 0, W, H); cell.draw(c, t, ff); c.restore(); M.reset2(c);
      c.strokeStyle = o.rim || "rgba(255,255,255,.16)"; c.lineWidth = 1.5; rr(c, px + 0.75, py + 0.75, cw - 1.5, ch - 1.5, r); c.stroke();
      if (cell.label && o.labels !== false) { txt(c, cell.label, px + 14, py + ch - 14, o.labelSize ?? 15, 500, "rgba(255,255,255,.55)", M.brand.mono); c.textAlign = "left"; }
    });
    return { cw, ch, gap };
  };
  M.reset2 = (c) => { c.globalAlpha = 1; c.filter = "none"; c.globalCompositeOperation = "source-over"; c.setLineDash([]); c.shadowColor = "transparent"; c.shadowBlur = 0; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.lineCap = "butt"; c.lineJoin = "miter"; };

  /* ---- term: terminal lines. lines: [{ text, at (frame), speed (characters a frame; leave out to appear at once), color, prompt, mark }]
     mark: a small coloured sign before the line ("ok" tick, "run" dot). The last line that is still typing gets the cursor. ---- */
  M.term = (c, f, o) => {
    const size = o.size ?? 34, lh = size * (o.lead ?? 1.6), fam = o.fam || M.brand.mono; let y = o.y, typing = null;
    o.lines.forEach((ln, i) => {
      if (f < ln.at) return; const n = ln.speed ? Math.min(ln.text.length, Math.floor((f - ln.at) * ln.speed)) : ln.text.length, a = ln.speed ? 1 : clamp((f - ln.at) / 5); let x = o.x;
      c.globalAlpha = a;
      if (ln.prompt) { txt(c, ln.prompt, x, y, size, 500, o.accent || M.brand.accentOnDark, fam); x += c.measureText(ln.prompt + " ").width; }
      if (ln.mark === "ok") { c.strokeStyle = o.ok || "#5fd38d"; c.lineWidth = size * 0.11; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); c.moveTo(x + size * 0.08, y - size * 0.3); c.lineTo(x + size * 0.3, y - size * 0.08); c.lineTo(x + size * 0.68, y - size * 0.58); c.stroke(); x += size * 1.1; }
      if (ln.mark === "run") { c.fillStyle = o.accent || M.brand.accentOnDark; c.beginPath(); c.arc(x + size * 0.32, y - size * 0.3, size * 0.16, 0, TAU); c.fill(); x += size * 1.1; }
      txt(c, ln.text.slice(0, n), x, y, size, ln.weight ?? 400, ln.color || o.color || "rgba(255,255,255,.86)", fam);
      if (ln.speed && (n < ln.text.length || ln.cursor)) typing = [x + c.measureText(ln.text.slice(0, n)).width, y];
      c.globalAlpha = 1; y += lh;
    });
    if (typing && o.cursor !== false) { c.fillStyle = o.caret || "#fff"; c.fillRect(typing[0] + size * 0.08, typing[1] - size * 0.82, size * 0.5, size * 1.02); }
    c.textAlign = "left"; c.lineCap = "butt"; c.lineJoin = "miter";
  };

  /* ---- code: lines of JavaScript with quiet syntax colour. lines: [string]; shown: how many lines are in (fractions type the last one);
     hot: index of a line to light up (the rest dim). ---- */
  const TOK = /(\/\/.*$|\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|return|function|if|else|true|false|null)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_$][\w$]*)|(\s+)|(.)/gm;
  M.code = (c, o) => {
    const size = o.size ?? 30, lh = size * (o.lead ?? 1.7), fam = o.fam || M.brand.mono, P = { com: "rgba(255,255,255,.32)", str: o.str || "#f0a37b", key: "#8fa6ff", num: "#e6c66a", fn: "#ffffff", id: "rgba(255,255,255,.78)", pun: "rgba(255,255,255,.42)", ...(o.palette || {}) };
    const shown = o.shown ?? o.lines.length;
    o.lines.forEach((line, i) => {
      if (i >= Math.ceil(shown)) return; const frac = i === Math.ceil(shown) - 1 ? shown - i || 1 : 1, max = Math.ceil(line.length * frac), y = o.y + i * lh; let x = o.x, used = 0;
      c.globalAlpha = o.hot == null || o.hot === i ? 1 : o.dim ?? 0.35;
      if (o.hot === i) { c.fillStyle = o.band || "rgba(255,255,255,.07)"; c.fillRect(o.x - 24, y - size * 1.05, o.w ?? 1400, lh); c.fillStyle = o.accent || M.brand.accentOnDark; c.fillRect(o.x - 24, y - size * 1.05, 4, lh); }
      if (o.numbers !== false) { txt(c, String(i + 1 + (o.first ?? 0)).padStart(2, " "), x, y, size, 400, "rgba(255,255,255,.22)", fam); x += size * 2.1; }
      TOK.lastIndex = 0; let m;
      while ((m = TOK.exec(line)) && used < max) { const s = m[0].slice(0, max - used); used += s.length;
        txt(c, s, x, y, size, 400, m[1] ? P.com : m[2] ? P.str : m[3] ? P.key : m[4] ? P.num : m[5] ? P.fn : m[6] ? P.id : P.pun, fam); x += c.measureText(s).width; }
    });
    c.globalAlpha = 1; c.textAlign = "left";
  };

  /* ---- wave: the shape of a real soundtrack. peaks: [0..1] (beats.py writes them), played: 0..1 share already heard,
     beats: [0..1 positions] drawn as ticks, blocks: [{ at, len (0..1), label }] sit on a lane under it. ---- */
  M.wave = (c, o) => {
    const { peaks, x, y, w, h } = o, n = peaks.length, bw = w / n, played = o.played ?? 0;
    for (let i = 0; i < n; i++) { const ph = Math.max(2, peaks[i] * h), on = i / n <= played; c.fillStyle = on ? o.hot || M.brand.accentOnDark : o.color || "rgba(255,255,255,.28)"; c.fillRect(x + i * bw, y + (h - ph) / 2, Math.max(1, bw - 2), ph); }
    (o.beats || []).forEach((b, i) => { const big = i % 4 === 0; c.fillStyle = `rgba(255,255,255,${big ? 0.5 : 0.2})`; c.fillRect(x + b * w, y + h + 18, big ? 2 : 1, big ? 22 : 12); });
    (o.blocks || []).forEach((bl) => { const bx = x + bl.at * w, by = y + h + 58, bwid = bl.len * w - 6, a = bl.alpha ?? 1; c.globalAlpha = a; c.fillStyle = bl.color || "rgba(255,255,255,.12)"; rr(c, bx, by + (bl.dy ?? 0), bwid, 54, 10); c.fill(); c.strokeStyle = "rgba(255,255,255,.22)"; c.lineWidth = 1; c.stroke();
      if (bl.label) txt(c, bl.label, bx + 14, by + 35 + (bl.dy ?? 0), 20, 500, "rgba(255,255,255,.8)", M.brand.mono); c.globalAlpha = 1; });
    c.fillStyle = "#fff"; c.fillRect(x + played * w - 1, y - 20, 2, h + 150);
    c.textAlign = "left";
  };
})();
