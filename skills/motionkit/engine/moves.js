/* Moves: named motions to build scenes from, so a clone is assembled instead of hand-drawn.
   Studied from the technique list at motionvideo.xyz/moves and the component previews at snapcn.dev/docs/components.
   Every move here is our own canvas drawing; none of their code or prompts is used. The snapcn-credited moves were written
   from watching the public preview clips; the motionvideo-credited ones from the technique's name and one-line description.
   Load after lib.js. Call as MOVES.name(ctx, t, options): t runs 0..1 through the move, and a move is a pure function of t.
   Transitions are MOVES.name(ctx, t, from, to, options); from and to are each a colour, a canvas, or (ctx) => draw.
   A draw function must draw on the ctx it is given, and must not call another transition (they share scratch layers).
   Text options everywhere: text, x, y (baseline), size, weight, color, fam, italic, align.
   Every move takes ease: (t) => t to replace its curve, because when copying a clip the curve is what is being copied. */
(() => {
  const M = {}, INDEX = [];
  /* Width (Archivo's wide cut) has to ride inside the font string: setting ctx.font resets ctx.fontStretch, so a separate setting is lost. */
  let STRETCH = "normal";
  const setFont = (c, size, weight = 500, fam = "sans", italic = false) => { c.font = `${italic ? "italic " : ""}${weight} ${STRETCH === "normal" ? "" : STRETCH + " "}${size}px ${FAM[fam] || fam}`; };
  const def = (name, from, about, opts, fn) => {
    /* every move releases the layers it took and puts the text width back; stretch: "expanded" gives the wide cut */
    M[name] = (c, ...a) => { const d = depth, was = STRETCH, o = a[a.length - 1]; STRETCH = (o && o.stretch) || "normal"; try { return fn(c, ...a); } finally { depth = d; STRETCH = was; } };
    INDEX.push({ name, from, about, opts });
  };

  /* ---- timing ---- */
  M.at = (f, start, len) => clamp((f - start) / len);                       /* frame -> 0..1 */
  M.out = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);                      /* ease-out entrance */
  M.expo = (t) => { t = clamp(t); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  M.io = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }; /* slow in, slow out */
  M.back = (t, s = 1.70158) => { t = clamp(t) - 1; return 1 + (s + 1) * t * t * t + s * t * t; };    /* overshoot and settle */
  M.spring = (t, freq = 2.5, decay = 6) => { t = clamp(t); return t >= 1 ? 1 : 1 - Math.exp(-decay * t) * Math.cos(TAU * freq * t); };
  M.stagger = (t, i, n, overlap = 0.7) => { const span = 1 / (1 + (n - 1) * (1 - overlap)); return clamp((t - i * span * (1 - overlap)) / span); };
  M.fonts = () => document.fonts.ready.then(async () => { await Promise.all(["200 20px Geist", "600 20px Geist", "900 20px Geist", "italic 300 20px Geist", "italic 500 20px Geist", "500 20px GeistMono", "600 20px Archivo", "800 20px Archivo", "500 20px JetBrainsMono"].map((q) => document.fonts.load(q, "Aa0"))); return true; });

  /* ---- shared helpers ---- */
  const T = (o) => ({ size: 120, weight: 600, color: "#fff", fam: "sans", italic: false, x: W / 2, y: H / 2, align: "center", ...o });
  function glyphs(c, o, text = o.text, track = 0) {
    setFont(c, o.size, o.weight, o.fam, o.italic); c.textBaseline = "alphabetic";
    const ch = [...text], off = ch.map((_, i) => c.measureText(text.slice(0, i)).width + i * track);
    const total = c.measureText(text).width + Math.max(0, ch.length - 1) * track;
    const x0 = o.align === "center" ? o.x - total / 2 : o.align === "right" ? o.x - total : o.x;
    const xs = off.map((v) => x0 + v), w = ch.map((_, i) => (i + 1 < ch.length ? off[i + 1] - off[i] - track : total - off[i]));
    return { ch, xs, w, total, x0 };
  }
  function wordSpans(c, o) {
    const g = glyphs(c, o), out = []; let s = -1;
    g.ch.forEach((q, i) => { if (q !== " " && s < 0) s = i; if ((q === " " || i === g.ch.length - 1) && s >= 0) { const e = q === " " ? i - 1 : i; out.push({ text: o.text.slice(s, e + 1), x: g.xs[s], w: g.xs[e] + g.w[e] - g.xs[s] }); s = -1; } });
    return out;
  }
  /* scratch layers come from a stack, so a wrapper can wrap a transition that wraps another drawing */
  const LAYERS = []; let depth = 0;
  function grab() {
    const i = depth++; if (!LAYERS[i]) { const k = mk(W, H); LAYERS[i] = [k, k.getContext("2d", SOFT)]; }
    const x = LAYERS[i][1]; x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.filter = "none"; x.setLineDash([]); x.clearRect(0, 0, W, H);
    return LAYERS[i];
  }
  function layer(v) {
    if (v && v.getContext) return v;
    const [k, x] = grab();
    if (typeof v === "string") { x.fillStyle = v; x.fillRect(0, 0, W, H); } else if (typeof v === "function") { x.save(); v(x); x.restore(); }
    return k;
  }
  const put = (c, v) => { if (typeof v === "string") { c.fillStyle = v; c.fillRect(0, 0, W, H); } else if (v) c.drawImage(layer(v), 0, 0); };
  const cellRGB = (d, k) => `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`;

  /* ---- type ---- */
  def("letters", "motionvideo: staggered letter reveal", "letters rise and fade in one after another, each with a small overshoot", "text, rise=0.6, overlap=0.8", (c, t, o) => {
    o = T(o); const g = glyphs(c, o); c.fillStyle = o.color; c.textAlign = "left";
    g.ch.forEach((s, i) => { const p = M.stagger(t, i, g.ch.length, o.overlap ?? 0.8); if (p <= 0) return; c.globalAlpha = clamp(p * 2.5); c.fillText(s, g.xs[i], o.y + (1 - (o.ease || M.back)(p)) * o.size * (o.rise ?? 0.6)); });
    c.globalAlpha = 1;
  });
  def("words", "motionvideo: word by word reveal", "words arrive one at a time, sliding up a little as they fade in", "text, rise=0.35, overlap=0.5", (c, t, o) => {
    o = T(o); const ws = wordSpans(c, o); c.fillStyle = o.color; c.textAlign = "left";
    ws.forEach((w, i) => { const p = M.stagger(t, i, ws.length, o.overlap ?? 0.5); if (p <= 0) return; c.globalAlpha = clamp(p * 2); c.fillText(w.text, w.x, o.y + (1 - (o.ease || M.expo)(p)) * o.size * (o.rise ?? 0.35)); });
    c.globalAlpha = 1;
  });
  const POOL = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/<>";
  def("scramble", "motionvideo: text scramble decode", "random glyphs flicker in place and lock into the real text from left to right", "text, ticks=30, dim", (c, t, o) => {
    o = T(o); const g = glyphs(c, o), n = g.ch.length, tick = Math.floor(t * (o.ticks ?? 30)); c.textAlign = "center";
    g.ch.forEach((s, i) => { const done = t >= ((i + 1) / n) * 0.92 || s === " "; c.fillStyle = done ? o.color : o.dim || "rgba(255,255,255,.45)"; c.fillText(done ? s : POOL[Math.floor(hash2(i * 7.3 + 1, tick) * POOL.length)], g.xs[i] + g.w[i] / 2, o.y); });
    c.textAlign = "left";
  });
  const ALPHA = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  def("flap", "motionvideo: split-flap text", "departure-board tiles rattle through the alphabet and land on each letter, left to right", "text, tile, ink", (c, t, o) => {
    o = T({ fam: "mono", weight: 600, ...o }); const str = o.text.toUpperCase(), n = str.length;
    const tw = o.size * 0.74, th = o.size * 1.22, gap = o.size * 0.09, total = n * tw + (n - 1) * gap, x0 = o.align === "center" ? o.x - total / 2 : o.x, top = o.y - th / 2;
    setFont(c, o.size, o.weight, o.fam); c.textAlign = "center"; c.textBaseline = "middle";
    const glyph = (s, x) => { c.fillStyle = o.color; c.fillText(s, x + tw / 2, o.y + o.size * 0.04); };
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (tw + gap), steps = 5 + i * 2, p = clamp(t / (0.4 + 0.58 * ((i + 1) / n))), k = Math.max(0, ALPHA.indexOf(str[i]));
      const s = Math.min(steps, Math.floor(p * steps)), ph = p >= 1 ? 0 : p * steps - s, idx = (q) => ALPHA[(((k - (steps - q)) % 37) + 37) % 37];
      c.fillStyle = o.tile || "#17171c"; rr(c, x, top, tw, th, o.size * 0.08); c.fill();
      glyph(p >= 1 ? str[i] : idx(s), x);
      if (ph > 0) { c.save(); c.beginPath(); c.rect(x, top, tw, th / 2); c.clip(); c.fillStyle = o.tile || "#17171c"; c.fillRect(x, top, tw, th / 2); c.translate(0, o.y); c.scale(1, 1 - ph); c.translate(0, -o.y); glyph(idx(s - 1), x); c.fillStyle = `rgba(0,0,0,${0.5 * ph})`; c.fillRect(x, top, tw, th / 2); c.restore(); }
      c.fillStyle = o.ink || "#000"; c.fillRect(x, o.y - 1.5, tw, 3);
    }
    c.textAlign = "left"; c.textBaseline = "alphabetic";
  });
  def("lineMask", "motionvideo: line mask text reveal", "each line slides up from behind an invisible edge; rule adds an underline that draws in after", "lines[] or text, lead=1.05, overlap=0.6, rule", (c, t, o) => {
    o = T(o); const lines = o.lines || [o.text], lh = o.size * (o.lead ?? 1.05); c.fillStyle = o.color; let last = null;
    lines.forEach((s, i) => {
      const p = (o.ease || M.expo)(M.stagger(t, i, lines.length, o.overlap ?? 0.6)), y = o.y + i * lh, g = glyphs(c, o, s); last = { g, y, p };
      c.save(); if (p < 1) { c.beginPath(); c.rect(0, y - o.size * 0.92, W, o.size * (o.rule ? 1.04 : 1.16)); c.clip(); } c.textAlign = "left"; c.fillText(s, g.x0, y + (1 - p) * o.size * 1.2); c.restore(); /* with a rule the word rises out of the rule itself */
    });
    if (o.rule && last) { const p = M.expo(clamp(t * 1.6 - 0.5)); c.fillStyle = o.rule === true ? o.color : o.rule; c.fillRect(last.g.x0, last.y + o.size * 0.13, last.g.total * p, Math.max(3, o.size * 0.045)); }
  });
  def("slam", "snapcn: slam-type", "one heavy word per beat; each lands oversized and wide, then snaps to size, with a two-colour sweep", "words[], color2, wide=1.3, grow=0.16", (c, t, o) => {
    o = T({ weight: 900, ...o }); const n = o.words.length, s = Math.min(n - 1, Math.floor(t * n)), p = t * n - s, e = M.expo(p * 2.4);
    const size = o.size * (1 + (o.grow ?? 0.16) * s), sc = lerp(1.5, 1, e), wide = (o.wide ?? 1.3) * lerp(1.25, 1, e);
    setFont(c, size, o.weight, o.fam); const w = c.measureText(o.words[s]).width;
    c.save(); c.translate(o.x, o.y); c.scale(sc * wide, sc);
    const gr = c.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, s % 2 ? o.color : o.color2 || o.color); gr.addColorStop(1, s % 2 ? o.color2 || o.color : o.color);
    c.fillStyle = gr; c.textAlign = "center"; c.textBaseline = "middle"; c.globalAlpha = clamp(p * 6); c.fillText(o.words[s], 0, 0); c.restore();
    c.textAlign = "left"; c.textBaseline = "alphabetic"; c.globalAlpha = 1;
  });
  def("wheel", "snapcn: word-wheel", "a fixed lead-in while a column of endings rolls past like a wheel; the one on the line is large, the rest small and faint", "prefix, words[], row=0.62, dim", (c, t, o) => {
    o = T({ weight: 500, ...o }); const n = o.words.length, s = t * n, k = Math.min(n - 1, Math.floor(s)), pos = t >= 1 ? n : k + M.io(clamp((s - k) * 1.7)), rowH = o.size * (o.row ?? 0.62);
    setFont(c, o.size, o.weight, o.fam); const gap = o.size * 0.28, pw = c.measureText(o.prefix).width, lw = Math.max(...o.words.map((q) => c.measureText(q).width));
    const x0 = o.x - (pw + gap + lw) / 2;
    c.fillStyle = o.color; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText(o.prefix, x0, o.y);
    for (let j = Math.floor(pos) - 6; j <= Math.floor(pos) + 7; j++) {
      const d = j - pos, near = clamp(1 - Math.abs(d)), sz = o.size * lerp(0.4, 1, near * near), al = near > 0.5 ? 1 : clamp(0.62 - Math.abs(d) * 0.1);
      if (al <= 0) continue;
      setFont(c, sz, o.weight, o.fam); c.fillStyle = near > 0.5 ? o.color : o.dim || o.color; c.globalAlpha = al;
      c.fillText(o.words[((j % n) + n) % n], x0 + pw + gap, o.y + d * rowH + (1 - near) * Math.sign(d) * o.size * 0.16);
    }
    c.globalAlpha = 1;
  });
  def("echo", "snapcn: echo-stack", "the word stays put while fading copies of it slide out above and below", "text, copies=3, gap=0.42", (c, t, o) => {
    o = T(o); const p = (o.ease || M.out)(t), n = o.copies ?? 3; setFont(c, o.size, o.weight, o.fam); c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillStyle = o.color;
    for (let k = n; k >= 1; k--) for (const dir of [-1, 1]) { c.globalAlpha = (0.5 / k) * p; c.fillText(o.text, o.x, o.y + dir * k * o.size * (o.gap ?? 0.42) * p); }
    c.globalAlpha = 1; c.fillText(o.text, o.x, o.y); c.textAlign = "left";
  });
  function brush(c, x1, y1, x2, y2, a, b, width, col, seed) {
    if (b - a < 0.01) return; const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, N = 26, L = [], R = [];
    for (let i = 0; i <= N; i++) { const s = lerp(a, b, i / N), u = (s - a) / (b - a), wd = width * Math.pow(Math.sin(Math.PI * clamp(0.08 + u * 0.84)), 0.55) * (0.82 + 0.4 * noise(seed + s * 11, 1.5)); L.push([x1 + dx * s + nx * wd, y1 + dy * s + ny * wd]); R.push([x1 + dx * s - nx * wd, y1 + dy * s - ny * wd]); }
    c.fillStyle = col; c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (const q of L) c.lineTo(q[0], q[1]); for (const q of R.reverse()) c.lineTo(q[0], q[1]); c.closePath(); c.fill();
  }
  def("crossOut", "snapcn: cross-out", "two rough brush strokes cross a word out, lift off, and the rest of the line closes the gap", "text, strike (word index), ink", (c, t, o) => {
    o = T(o); const ws = wordSpans(c, o), k = o.strike ?? 0, w = ws[k], close = M.io(clamp((t - 0.72) / 0.28)), space = glyphs(c, o, " ").total;
    const shift = (w.w + space) * close; c.textAlign = "left";
    ws.forEach((q, i) => { c.globalAlpha = i === k ? 1 - clamp((t - 0.62) / 0.14) : 1; c.fillStyle = o.color; c.fillText(q.text, q.x + (i < k ? shift / 2 : i > k ? -shift / 2 : 0), o.y); });
    c.globalAlpha = 1;
    const off = clamp((t - 0.5) / 0.2), top = o.y - o.size * 1.25, bot = o.y + o.size * 0.55, ink = o.ink || "#27c26a", bw = o.size * 0.1, cx = w.x + w.w / 2, hw = Math.max(w.w * 0.66, o.size * 0.9);
    brush(c, cx - hw, top + o.size * 0.3, cx + hw * 0.8, bot - o.size * 0.15, off, M.out(clamp(t / 0.14)), bw, ink, 3);
    brush(c, cx + hw * 0.45, top, cx - hw * 0.35, bot, off, M.out(clamp((t - 0.1) / 0.14)), bw, ink, 9);
  });
  def("highlight", "snapcn: text-highlight", "a marker bar sweeps in behind some of the words and their ink flips colour", "text, from, to (word indexes), bar, ink", (c, t, o) => {
    o = T(o); const ws = wordSpans(c, o), a = ws[o.from ?? 0], z = ws[o.to ?? o.from ?? 0], p = (o.ease || M.expo)(t), pad = o.size * 0.1, x = a.x - pad, w = (z.x + z.w - a.x + pad * 2) * p;
    c.textAlign = "left"; c.fillStyle = o.color; c.fillText(o.text, ws[0].x, o.y);
    c.fillStyle = o.bar || "#e8ff59"; c.fillRect(x, o.y - o.size * 0.86, w, o.size * 1.1);
    c.save(); c.beginPath(); c.rect(x, o.y - o.size * 0.86, w, o.size * 1.1); c.clip(); c.fillStyle = o.ink || "#0a0a0c"; c.fillText(o.text, ws[0].x, o.y); c.restore();
  });
  def("tracking", "motionvideo: tracking expand title", "a title fades in while its letters drift apart, like a film opening", "text, tight=-0.02, wide=0.3", (c, t, o) => {
    o = T({ weight: 500, ...o }); const g = glyphs(c, o, o.text, lerp(o.tight ?? -0.02, o.wide ?? 0.3, (o.ease || ((q) => M.out(q, 2)))(t)) * o.size);
    c.fillStyle = o.color; c.globalAlpha = clamp(t * 3); c.textAlign = "left"; g.ch.forEach((s, i) => c.fillText(s, g.xs[i], o.y)); c.globalAlpha = 1;
  });
  def("weight", "motionvideo: variable font weight animation", "the same word swells from hairline to heavy (Geist is a variable font, so every weight exists)", "text, w0=200, w1=900", (c, t, o) => {
    o = T(o); setFont(c, o.size, Math.round(lerp(o.w0 ?? 200, o.w1 ?? 900, (o.ease || M.io)(t))), o.fam, o.italic); c.fillStyle = o.color; c.textAlign = o.align; c.textBaseline = "alphabetic"; c.fillText(o.text, o.x, o.y); c.textAlign = "left";
  });

  /* ---- numbers and charts ---- */
  def("ticker", "motionvideo: UI number ticker / snapcn: tally-rise", "a number counts up fast and settles; digits sit in fixed slots so the figure does not shake", "a, b, decimals=0, prefix, suffix", (c, t, o) => {
    o = T(o); const v = lerp(o.a ?? 0, o.b, (o.ease || M.expo)(t)), s = (o.prefix || "") + v.toLocaleString("en-US", { minimumFractionDigits: o.decimals ?? 0, maximumFractionDigits: o.decimals ?? 0 }) + (o.suffix || "");
    setFont(c, o.size, o.weight, o.fam); const dw = Math.max(...[..."0123456789"].map((q) => c.measureText(q).width)), ws = [...s].map((q) => (/\d/.test(q) ? dw : c.measureText(q).width)), total = ws.reduce((p, q) => p + q, 0);
    let x = o.align === "center" ? o.x - total / 2 : o.x; c.fillStyle = o.color; c.textAlign = "center"; c.textBaseline = "alphabetic";
    [...s].forEach((q, i) => { c.fillText(q, x + ws[i] / 2, o.y); x += ws[i]; }); c.textAlign = "left";
  });
  def("chart", "snapcn: ticker-climb", "a line chart draws itself left to right with a glowing head, a soft fill under it and a guide line at the current level", "box [x,y,w,h], points[] (0..1), color", (c, t, o) => {
    const [bx, by, bw, bh] = o.box || [240, 260, 1440, 560], col = o.color || "#22e04a", n = 60;
    const pts = o.points || Array.from({ length: n }, (_, i) => clamp(0.12 + (i / n) * 0.62 + 0.09 * Math.sin(i * 0.42) + 0.05 * noise(i * 0.3, 4)));
    const p = (o.ease || ((q) => M.out(q, 2)))(t) * (pts.length - 1), at = (i) => { const k = Math.min(pts.length - 2, Math.floor(i)), u = i - k; return [bx + (i / (pts.length - 1)) * bw, by + bh - lerp(pts[k], pts[k + 1], u) * bh]; };
    const path = []; for (let i = 0; i < p; i += 0.25) path.push(at(i)); path.push(at(p)); const [hx, hy] = path[path.length - 1];
    c.save(); const g = c.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = 0.28; c.fillStyle = g; c.beginPath(); c.moveTo(path[0][0], by + bh); for (const q of path) c.lineTo(q[0], q[1]); c.lineTo(hx, by + bh); c.closePath(); c.fill();
    c.globalAlpha = 0.25; c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.setLineDash([6, 10]); c.beginPath(); c.moveTo(bx, hy); c.lineTo(bx + bw, hy); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 6; c.lineJoin = "round"; c.lineCap = "round"; c.beginPath(); path.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
    c.globalAlpha = 0.25; c.fillStyle = col; c.beginPath(); c.arc(hx, hy, 30, 0, TAU); c.fill(); c.globalAlpha = 1; c.beginPath(); c.arc(hx, hy, 13, 0, TAU); c.fill(); c.restore();
  });

  /* ---- shapes ---- */
  def("bounce", "motionvideo: squash and stretch", "a ball drops and bounces along a line, stretching in flight and flattening on each landing, leaving a dot where it hit", "x0, x1, ground, r, h, drop (first fall height), bounces=3, decay=0.6, color, line, span [xa, xb]", (c, t, o) => {
    const x0 = o.x0 ?? 500, x1 = o.x1 ?? 1400, gy = o.ground ?? 760, r = o.r ?? 60, n = o.bounces ?? 3, s = t * n + 0.5, k = Math.floor(s), u = s - k;
    const hk = k === 0 && o.drop ? o.drop : (o.h ?? 460) * Math.pow(o.decay ?? 0.6, k), q = clamp(1 - Math.min(u, 1 - u) / 0.09), fly = Math.abs(1 - 2 * u) * (1 - q);
    const sy = (1 + 0.28 * fly) * (1 - 0.42 * q), sx = 1 / sy, x = lerp(x0, x1, t), y = Math.min(gy - r * sy, gy - r - hk * 4 * u * (1 - u));
    if (o.line !== false) { c.fillStyle = o.line || "rgba(255,255,255,.8)"; const sp = o.span || [x0 - 160, x1 + 160]; c.fillRect(sp[0], gy, sp[1] - sp[0], 3); }
    c.fillStyle = "#fff"; for (let j = 1; j <= k; j++) { const tx = (j - 0.5) / n; c.beginPath(); c.arc(lerp(x0, x1, tx), gy + 1, 6, 0, TAU); c.fill(); }
    c.fillStyle = o.color || "#ff4b1f"; c.beginPath(); c.ellipse(x, y, r * sx, r * sy, 0, 0, TAU); c.fill();
  });

  /* ---- transitions ---- */
  function circle(c, t, from, to, o = {}) {
    put(c, from); const x = o.x ?? W / 2, y = o.y ?? H / 2, far = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));
    const r = lerp(o.r0 ?? 0, far + 4, (o.ease || M.io)(t)); if (r <= 0) return;
    c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip(); put(c, to); c.restore();
  };
  def("flood", "motionvideo: color flood transition", "one colour grows from a point until it fills the frame and becomes the next background", "x, y, r0 (starting radius)", circle);
  def("iris", "motionvideo: iris transition", "the next scene opens through a growing circle", "x, y, r0", circle);
  def("push", "motionvideo: push transition", "the next scene shoves the current one out of frame", "dir: left | right | up | down", (c, t, from, to, o = {}) => {
    const p = (o.ease || M.io)(t), d = o.dir || "left", dx = d === "left" ? -1 : d === "right" ? 1 : 0, dy = d === "up" ? -1 : d === "down" ? 1 : 0, A1 = layer(from), B1 = layer(to);
    c.drawImage(A1, dx * p * W, dy * p * H); c.drawImage(B1, dx * (p - 1) * W, dy * (p - 1) * H);
  });
  def("dotBloom", "snapcn: dot-bloom", "white dots pop up at random on a brightening field, take on the next scene's colours and swell until they are the picture", "cell=40, paper", (c, t, from, to, o = {}) => {
    const g = o.cell ?? 40, cols = Math.ceil(W / g), rows = Math.ceil(H / g), d = sample(layer(to), cols, rows);
    put(c, from); c.globalAlpha = clamp(t / 0.45); c.fillStyle = o.paper || "#f3e9d6"; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const start = (0.55 * hash2(i, j) + 0.45 * noise(i * 0.16, j * 0.16)) * 0.62; if (t < start) continue;
      const p = clamp((t - start) / 0.3); c.fillStyle = p < 0.35 ? "#fff" : cellRGB(d, (j * cols + i) * 4);
      c.beginPath(); c.arc(i * g + g / 2, j * g + g / 2, (g / 2) * lerp(0.32, 1.02, p), 0, TAU); c.fill();
    }
    if (t > 0.86) { c.globalAlpha = clamp((t - 0.86) / 0.14); put(c, to); c.globalAlpha = 1; }
  });
  def("dotDissolve", "snapcn: dot-dissolve", "the next scene seeps in as cloud-shaped patches of halftone dots that spread until the frame is full", "cell=24, back", (c, t, from, to, o = {}) => {
    const g = o.cell ?? 24, cols = Math.ceil(W / g), rows = Math.ceil(H / g), d = sample(layer(to), cols, rows), lv = t * 1.3;
    put(c, from);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const m = 0.8 * noise(i * 0.11 + 3, j * 0.11) + 0.2 * hash2(i, j); if (m > lv) continue;
      const k = (j * cols + i) * 4, lum = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255, e = clamp((lv - m) * 7);
      c.fillStyle = o.back || "#000"; c.fillRect(i * g, j * g, g + 0.5, g + 0.5);
      c.fillStyle = cellRGB(d, k); c.beginPath(); c.arc(i * g + g / 2, j * g + g / 2, (g / 2) * 0.94 * e * Math.sqrt(0.25 + 0.75 * lum), 0, TAU); c.fill();
    }
    if (t > 0.84) { c.globalAlpha = clamp((t - 0.84) / 0.16); put(c, to); c.globalAlpha = 1; }
  });
  def("pixelPeak", "snapcn: pixel-peak", "the next scene rises from the bottom edge as a blocky mountain with a coloured rim until it covers the frame", "cell=60, at (0..1 peak position), edge", (c, t, from, to, o = {}) => {
    const g = o.cell ?? 60, cols = Math.ceil(W / g), cx = o.at ?? 0.5, e = (o.ease || M.io)(t) * (1.15 + 1.5 * Math.max(cx, 1 - cx)), hs = [];
    put(c, from);
    for (let i = 0; i < cols; i++) hs.push(Math.max(0, Math.round(((e - Math.abs((i + 0.5) / cols - cx) * 1.5) * H + (hash(i * 3.1) - 0.5) * g * 1.6) / g)) * g);
    c.save(); c.beginPath(); hs.forEach((h, i) => { if (h > 0) c.rect(i * g, H - h, g + 0.5, h); }); c.clip(); put(c, to); c.restore();
    hs.forEach((h, i) => { if (h <= 0 || h > H + g) return; c.globalAlpha = 0.55 + 0.45 * hash(i * 7.7 + Math.round(h / g)); c.fillStyle = o.edge || "#2f7bff"; c.fillRect(i * g, H - h, g + 0.5, g); });
    c.globalAlpha = 1;
  });

  /* ================= second set: beat grid, real assets, finish passes, camera, vector, data ================= */

  /* ---- beat grid: at 30 frames a second a beat is 1800 / bpm frames, so use 150, 120, 100 or 90 bpm and every beat lands on a frame ---- */
  M.grid = (bpm) => { const fpb = 1800 / bpm; return { bpm, fpb, beat: (n) => Math.round(n * fpb), bar: (n) => Math.round(n * 4 * fpb), pulse: (f, decay = 0.3) => Math.exp(-(((f % fpb) + fpb) % fpb) / (fpb * decay)) }; };

  /* ---- real assets: images and SVGs from assets/, loaded before the first frame ---- */
  const IMG = {};
  M.load = (map) => Promise.all(Object.entries(map).map(([k, url]) => new Promise((ok, no) => { const i = new Image(); i.onload = () => { IMG[k] = i; ok(); }; i.onerror = () => no(new Error("missing asset " + url)); i.src = url; })));
  M.img = (k) => IMG[k];
  M.image = (c, k, x, y, w, h, pixel) => { const i = IMG[k]; if (!i) return; c.imageSmoothingEnabled = !pixel; c.drawImage(i, x, y, w, h ?? (w * i.height) / i.width); c.imageSmoothingEnabled = true; };
  M.put = (k, canvas) => { IMG[k] = canvas; }; /* register a canvas you drew yourself as an asset */
  /* The brand: one palette and two typefaces that every example reads. Replace it for your own film, before your film script runs
     or as its first line: MOVES.setBrand({ accent: "#0c8457", display: "YourFont" }). Canvas takes width keywords only, so
     wide: "expanded" is Archivo at 125%; set wide: null for a typeface without a wide cut. */
  M.brand = { accent: "#e4572e", accentOnDark: "#ff6b3d", ink: "#0f1115", paper: "#f3f1ea", plate: "#e6e3da", card: "#fbfaf6", muted: "#6f737a", display: "Archivo", mono: "JetBrainsMono", wide: "expanded" };
  M.setBrand = (o) => Object.assign(M.brand, o);
  /* Scenery with no art files: a sky and three ridges of hills drawn into canvases, registered as assets, returned as parallax layers.
     MOVES.parallax(ctx, t, { layers: MOVES.scenery() }). Options: sky [top, bottom], sun (colour or null), hills [far, mid, near], seed. */
  M.scenery = (o = {}) => {
    const w = 2400, sky = o.sky || ["#1a2233", "#e8a66b"], hills = o.hills || ["#3a4763", "#232c40", "#11151d"], seed = o.seed ?? 3, id = "scenery" + seed;
    const cs = mk(w, H), g = cs.getContext("2d", SOFT), gr = g.createLinearGradient(0, 0, 0, H * 0.8); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, H);
    if (o.sun !== null) { g.fillStyle = o.sun || "#ffe2b0"; g.beginPath(); g.arc(w * 0.62, H * 0.6, 90, 0, TAU); g.fill(); }
    IMG[id + "sky"] = cs; const layers = [{ img: id + "sky", depth: 0.1 }];
    hills.forEach((col, i) => {
      const ch = mk(w, H), q = ch.getContext("2d", SOFT), base = H * (0.66 + i * 0.1), amp = 250 - i * 50; q.fillStyle = col; q.beginPath(); q.moveTo(0, H);
      for (let x = 0; x <= w; x += 6) q.lineTo(x, base - amp * (0.62 * noise(x / 330 + seed * 9.1 + i * 40, i) + 0.28 * noise(x / 110 + seed + i * 17, 2) + 0.1 * noise(x / 34, i + 5)));
      q.lineTo(w, H); q.closePath(); q.fill(); IMG[id + "hill" + i] = ch; layers.push({ img: id + "hill" + i, depth: 0.3 + 0.35 * i });
    });
    return layers;
  };
  let LEVELS = null; /* per-frame loudness and 16 frequency bands of the real soundtrack, written by sound.py */
  M.levels = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => { LEVELS = j; }).catch(() => {});
  const rgba = (hex, al) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${al})`; };
  M.rgba = rgba; /* a #rrggbb colour at an opacity: MOVES.rgba(B.ink, 0.7) */
  M.mix = (p, q, t) => { const a = parseInt(p.slice(1), 16), b = parseInt(q.slice(1), 16), ch = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t)); return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); }; /* a colour between two #rrggbb colours */
  const tmp = (v, fn) => { const d = depth; try { return fn(layer(v)); } finally { depth = d; } };

  /* plain text with the same options as the moves (so stretch works): MOVES.type(ctx, { text, x, y, size, ... }) */
  M.type = (c, o) => { o = T(o); const was = STRETCH; STRETCH = o.stretch || "normal"; setFont(c, o.size, o.weight, o.fam, o.italic); STRETCH = was; c.fillStyle = o.color; c.textAlign = o.align; c.textBaseline = "alphabetic"; c.fillText(o.text, o.x, o.y); c.textAlign = "left"; };

  /* ---- more type ---- */
  def("typewriter", "motionvideo: typewriter text / snapcn: word-flip", "characters appear one at a time behind a cursor; the newest one is still faint", "text, cursor (colour), keep (cursor stays)", (c, t, o) => {
    o = T(o); const g = glyphs(c, o), n = g.ch.length, s = (o.ease || ((q) => q))(clamp(t)) * n, k = Math.min(n, Math.floor(s)); c.textAlign = "left"; c.fillStyle = o.color;
    for (let i = 0; i <= k && i < n; i++) { c.globalAlpha = i < k ? 1 : clamp(s - k) * 0.55; c.fillText(g.ch[i], g.xs[i], o.y); }
    c.globalAlpha = 1; if (t < 1 || o.keep) { c.fillStyle = o.cursor || o.color; c.fillRect((k < n ? g.xs[k] + (s - k) * g.w[k] : g.x0 + g.total) + o.size * 0.06, o.y - o.size * 0.82, Math.max(3, o.size * 0.045), o.size * 1.0); }
  });
  def("swap", "motionvideo: rotating word swap", "a fixed lead-in while the last word is replaced: each new word rolls up into the slot as the old one leaves", "prefix, words[], color2", (c, t, o) => {
    o = T(o); const n = o.words.length, s = Math.min(n - 1e-6, t * n), k = Math.floor(s), p = (o.ease || M.back)(clamp((s - k) * 2.4));
    setFont(c, o.size, o.weight, o.fam); const gap = o.size * 0.26, pw = c.measureText(o.prefix).width, lw = Math.max(...o.words.map((q) => c.measureText(q).width)), x0 = o.x - (pw + gap + lw) / 2, wx = x0 + pw + gap;
    c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillStyle = o.color; c.fillText(o.prefix, x0, o.y);
    c.save(); c.beginPath(); c.rect(wx - 20, o.y - o.size * 0.95, lw + 60, o.size * 1.25); c.clip(); c.fillStyle = o.color2 || o.color;
    c.fillText(o.words[k], wx, o.y + (1 - p) * o.size * 1.15); if (k > 0) c.fillText(o.words[k - 1], wx, o.y - p * o.size * 1.15); c.restore();
  });
  def("outline", "motionvideo: outline to fill text", "letters first draw themselves as thin outlines, then fill with solid colour", "text, line (outline width)", (c, t, o) => {
    o = T(o); setFont(c, o.size, o.weight, o.fam, o.italic); c.textAlign = o.align; c.textBaseline = "alphabetic"; const L = o.size * 7;
    c.strokeStyle = o.color; c.lineWidth = o.line ?? Math.max(2, o.size * 0.012); c.lineJoin = "round"; c.setLineDash([L, L]); c.lineDashOffset = L * (1 - (o.ease || M.io)(clamp(t / 0.62)));
    c.strokeText(o.text, o.x, o.y); c.setLineDash([]); c.lineDashOffset = 0; c.globalAlpha = clamp((t - 0.55) / 0.4); c.fillStyle = o.color; c.fillText(o.text, o.x, o.y); c.globalAlpha = 1; c.textAlign = "left";
  });
  def("punchWord", "motionvideo: scale punch headline", "a headline starts far too big and slams down to size in a few frames", "text, from=2.6", (c, t, o) => {
    o = T({ weight: 800, ...o }); const sc = lerp(o.from ?? 2.6, 1, (o.ease || M.expo)(t * 1.5)); setFont(c, o.size, o.weight, o.fam, o.italic);
    c.save(); c.translate(o.x, o.y - o.size * 0.35); c.scale(sc, sc); c.globalAlpha = clamp(t * 6); c.fillStyle = o.color; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(o.text, 0, o.size * 0.35); c.restore(); c.textAlign = "left";
  });
  def("caption", "snapcn: karaoke-captions", "a boxed caption pops in near the bottom; words light up one by one as they are said", "text, box, dim, hot", (c, t, o) => {
    o = T({ size: 56, y: H - 150, ...o }); const ws = wordSpans(c, o), pad = o.size * 0.5, a = ws[0], z = ws[ws.length - 1], w = z.x + z.w - a.x + pad * 2, pop = M.back(clamp(t * 7)), said = Math.ceil(clamp((t - 0.06) / 0.86) * ws.length);
    c.save(); c.translate(o.x, o.y - o.size * 0.3); c.scale(lerp(0.9, 1, pop), lerp(0.9, 1, pop)); c.translate(-o.x, -(o.y - o.size * 0.3)); c.globalAlpha = clamp(t * 7);
    c.fillStyle = o.box || "#121413"; rr(c, a.x - pad, o.y - o.size * 1.08, w, o.size * 1.56, o.size * 0.22); c.fill(); c.textAlign = "left";
    ws.forEach((q, i) => { c.fillStyle = i === said - 1 ? o.hot || o.color : i < said ? o.color : o.dim || "rgba(255,255,255,.38)"; c.fillText(q.text, q.x, o.y); }); c.restore(); c.globalAlpha = 1;
  });

  /* ---- vector ---- */
  const PEL = {}; const pel = (d) => PEL[d] || (PEL[d] = (() => { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); return { p, len: p.getTotalLength() }; })());
  def("pathDraw", "motionvideo: path draw-on", "a line draws itself along any SVG path, with an optional dot riding the tip", "d (SVG path), width, color, head (dot colour), keepHead, at [x, y], scale", (c, t, o) => {
    const { p: el, len } = pel(o.d), p = (o.ease || M.io)(t); if (p <= 0) return;
    c.save(); if (o.at) c.translate(o.at[0], o.at[1]); if (o.scale) c.scale(o.scale, o.scale); c.strokeStyle = o.color || "#fff"; c.lineWidth = o.width ?? 6; c.lineCap = "round"; c.lineJoin = "round";
    c.setLineDash([len * p, len + 10]);
    c.stroke(new Path2D(o.d)); c.setLineDash([]);
    if (o.head && (p < 1 || o.keepHead)) { const q = el.getPointAtLength(len * p); c.fillStyle = o.head; c.beginPath(); c.arc(q.x, q.y, (o.width ?? 6) * 1.6, 0, TAU); c.fill(); }
    c.restore();
  });
  def("burst", "motionvideo: radial burst", "short lines shoot out from a point and thin away, for an impact or a reveal", "x, y, n=14, r0, r1, color, width", (c, t, o) => {
    const n = o.n ?? 14, r0 = o.r0 ?? 60, r1 = o.r1 ?? 320, head = lerp(r0, r1, M.out(t, 3)), tail = lerp(r0, r1, M.out(clamp(t * 1.5 - 0.5), 2));
    c.save(); c.translate(o.x ?? W / 2, o.y ?? H / 2); c.strokeStyle = o.color || "#fff"; c.lineWidth = (o.width ?? 8) * (1 - t * 0.7); c.lineCap = "round"; c.globalAlpha = clamp((1 - t) * 3);
    for (let i = 0; i < n; i++) { const an = (i / n) * TAU + (o.rot ?? 0), k = 0.75 + 0.5 * hash(i * 5.3 + (o.seed ?? 0)); c.beginPath(); c.moveTo(Math.cos(an) * tail * k, Math.sin(an) * tail * k); c.lineTo(Math.cos(an) * head * k, Math.sin(an) * head * k); c.stroke(); }
    c.restore(); c.globalAlpha = 1;
  });
  const MARK = ["M10 48 L10 16 L32 40 L54 16 L54 48", "M10 56 L54 56"]; /* a placeholder mark; pass your own logo's strokes as paths */
  def("logoDraw", "snapcn: logo-assemble (idea only)", "a logo draws itself stroke by stroke from its SVG paths; show the real logo file after it with MOVES.image", "paths[] (SVG path strings), box=64 (the size the paths are drawn in), x, y, size, color, width", (c, t, o) => {
    const size = o.size ?? 300, bx = o.box ?? 64, ps = o.paths || MARK; c.save(); c.translate((o.x ?? W / 2) - size / 2, (o.y ?? H / 2) - size / 2); c.scale(size / bx, size / bx);
    c.strokeStyle = o.color || M.brand.accentOnDark; c.lineWidth = o.width ?? bx * 0.0875; c.lineCap = "round"; c.lineJoin = "round";
    ps.forEach((d, i) => { const p = (o.ease || M.io)(M.stagger(t, i, ps.length, 0.45)), len = pel(d).len; if (p <= 0) return; c.setLineDash([len * p, len + 10]); c.stroke(new Path2D(d)); });
    c.setLineDash([]); c.restore();
  });

  /* ---- data ---- */
  def("callout", "motionvideo: annotation callout", "a dot marks a point, a leader line draws out from it and a short label appears at the end", "x, y, tx, ty, text, color, size", (c, t, o) => {
    const col = o.color || "#fff", p = M.out(clamp(t / 0.5)), q = clamp((t - 0.4) / 0.4), dir = o.tx >= o.x ? 1 : -1, ex = lerp(o.x, o.tx, p), ey = lerp(o.y, o.ty, p);
    c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.5; c.globalAlpha = 1 - clamp(t * 1.4); c.beginPath(); c.arc(o.x, o.y, 8 + 34 * M.out(t), 0, TAU); c.stroke(); c.globalAlpha = 1;
    c.beginPath(); c.arc(o.x, o.y, 7, 0, TAU); c.fill(); c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(ex, ey); if (p >= 1) c.lineTo(o.tx + dir * 70 * M.out(q), o.ty); c.stroke();
    setFont(c, o.size ?? 30, 500, o.fam || "mono"); c.textAlign = dir > 0 ? "left" : "right"; c.textBaseline = "middle"; c.globalAlpha = q; c.fillText(o.text, o.tx + dir * (84 - 14 * (1 - M.out(q))), o.ty); c.restore(); c.textBaseline = "alphabetic"; c.textAlign = "left"; c.globalAlpha = 1;
  });
  def("bars", "motionvideo: highlight one bar", "bars grow from the baseline one after another, then all but one fade to grey and that one takes the accent colour", "values[] (0..1), pick (index), box [x,y,w,h], color, accent, grey", (c, t, o) => {
    const [bx, by, bw, bh] = o.box || [360, 260, 1200, 560], n = o.values.length, gap = bw / n, w = gap * 0.62, hl = M.io(clamp((t - 0.62) / 0.3));
    c.fillStyle = o.axis || "rgba(255,255,255,.35)"; c.fillRect(bx, by + bh, bw, 2);
    o.values.forEach((v, i) => { const p = M.back(M.stagger(clamp(t / 0.6), i, n, 0.6), 1.2), h = v * bh * p, x = bx + i * gap + (gap - w) / 2; if (p <= 0) return;
      c.fillStyle = o.color || "#f2f3f0"; c.fillRect(x, by + bh - h, w, h);
      if (hl > 0) { c.globalAlpha = hl; c.fillStyle = i === (o.pick ?? n - 1) ? o.accent || M.brand.accentOnDark : o.grey || "#3a3d3b"; c.fillRect(x, by + bh - h, w, h); c.globalAlpha = 1; } });
  });

  /* ---- camera: wrap any drawing (a canvas or (ctx) => draw) ---- */
  def("punch", "motionvideo: punch in", "the whole picture jumps closer on a beat", "zoom=1.2, x, y (centre of the zoom)", (c, t, draw, o = {}) => tmp(draw, (L) => {
    const z = lerp(1, o.zoom ?? 1.2, (o.ease || M.expo)(t)), x = o.x ?? W / 2, y = o.y ?? H / 2; c.save(); c.translate(x, y); c.scale(z, z); c.translate(-x, -y); c.drawImage(L, 0, 0); c.restore();
  }));
  def("shake", "motionvideo: camera shake", "the frame jitters hard after an impact and settles within a few frames", "amp=26, frames=12, seed", (c, t, draw, o = {}) => tmp(draw, (L) => {
    const k = Math.round(clamp(t) * (o.frames ?? 12)), amp = (o.amp ?? 26) * Math.pow(1 - clamp(t), 2), s = o.seed ?? 0, dx = (hash(k * 1.7 + s) - 0.5) * 2 * amp, dy = (hash(k * 2.9 + s + 5) - 0.5) * 2 * amp;
    c.save(); c.translate(W / 2 + dx, H / 2 + dy); c.rotate((hash(k * 4.1 + s) - 0.5) * 0.012 * (amp / 26)); c.scale(1.04, 1.04); c.translate(-W / 2, -H / 2); c.drawImage(L, 0, 0); c.restore();
  }));
  def("parallax", "motionvideo: parallax layers", "stacked picture layers slide at different speeds so a flat scene gains depth; near layers move most", "layers [{ img, depth 0..1, pixel }], pan=160, zoom=0.06, y, h (fill the frame first: art with see-through edges lets the last frame show)", (c, t, o) => {
    const p = (o.ease || ((q) => q))(t) - 0.5, h = o.h ?? H, y = o.y ?? 0;
    for (const ly of o.layers) { const i = IMG[ly.img]; if (!i) continue; const z = 1 + (o.zoom ?? 0.06) * ly.depth * (p + 0.5), hh = h * z, ww = (hh * i.width) / i.height, x = (W - ww) / 2 - p * (o.pan ?? 160) * ly.depth;
      c.imageSmoothingEnabled = !ly.pixel; c.globalAlpha = ly.alpha ?? 1; c.drawImage(i, x, y - (hh - h) * 0.6, ww, hh); }
    c.imageSmoothingEnabled = true; c.globalAlpha = 1;
  });

  /* ---- more transitions ---- */
  def("glitchCut", "motionvideo: glitch cut", "for a few frames the picture tears into shifted strips with colour bars, then the next scene is there", "steps=6, color", (c, t, from, to, o = {}) => tmp(t < 0.5 ? from : to, (L) => {
    const k = Math.floor(clamp(t) * (o.steps ?? 6)), str = 1 - Math.abs(2 * clamp(t) - 1) * 0.5; c.drawImage(L, 0, 0);
    for (let i = 0; i < 9; i++) { const y = Math.floor(hash2(k, i) * H), h = 20 + hash2(k + 9, i) * 150, dx = (hash2(k + 3, i) - 0.5) * W * 0.3 * str; c.drawImage(L, 0, y, W, h, dx, y, W, h);
      if (i < 3) { c.globalCompositeOperation = i ? "difference" : "source-over"; c.fillStyle = i ? "#fff" : o.color || M.brand.accentOnDark; c.globalAlpha = i ? 1 : 0.85; c.fillRect(hash2(k + 5, i) * W * 0.6, y, W * (0.15 + 0.4 * hash2(k + 7, i)), 6 + h * 0.12); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; } }
  }));
  def("wipe", "motionvideo: wipe transition", "a slanted edge with a thin accent line crosses the frame and leaves the next scene behind it", "slant=220, color, width", (c, t, from, to, o = {}) => {
    put(c, from); const s = o.slant ?? 220, x = lerp(-s - 20, W + 20, (o.ease || M.io)(t));
    c.save(); c.beginPath(); c.moveTo(-10, -10); c.lineTo(x + s, -10); c.lineTo(x, H + 10); c.lineTo(-10, H + 10); c.closePath(); c.clip(); put(c, to); c.restore();
    c.strokeStyle = o.color || "#fff"; c.lineWidth = o.width ?? 6; c.beginPath(); c.moveTo(x + s, -10); c.lineTo(x, H + 10); c.stroke();
  });
  def("zoomThrough", "motionvideo: zoom-through transition", "the camera dives through the current scene, which swells and fades, into the next one arriving from small", "x, y", (c, t, from, to, o = {}) => {
    const p = (o.ease || M.io)(t), x = o.x ?? W / 2, y = o.y ?? H / 2, A1 = layer(to), B1 = layer(from), z1 = lerp(0.55, 1, p), z2 = lerp(1, 7, p * p);
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H); c.save(); c.translate(x, y); c.scale(z1, z1); c.translate(-x, -y); c.globalAlpha = clamp(p * 2.2); c.drawImage(A1, 0, 0); c.restore();
    c.save(); c.translate(x, y); c.scale(z2, z2); c.translate(-x, -y); c.globalAlpha = 1 - clamp(p * 1.6); c.drawImage(B1, 0, 0); c.restore(); c.globalAlpha = 1;
  });

  /* ---- finish passes: call after the scene is drawn ---- */
  let GRAIN = null;
  def("grain", "motionvideo: film grain", "fine noise over the finished frame so flat colour looks printed and gradients do not band; call as grain(ctx, f, o)", "amount=0.1, size=2", (c, f, o = {}) => {
    if (!GRAIN) { GRAIN = mk(320, 320); const x = GRAIN.getContext("2d", SOFT), d = x.createImageData(320, 320); for (let i = 0; i < 320 * 320; i++) { const v = (hash2(i % 320, Math.floor(i / 320) + 0.5) * 255) | 0; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; } x.putImageData(d, 0, 0); }
    const s = 320 * (o.size ?? 2), ox = -Math.floor(hash(f * 1.31) * s), oy = -Math.floor(hash(f * 2.17 + 3) * s);
    c.save(); c.globalCompositeOperation = "overlay"; c.globalAlpha = o.amount ?? 0.1; c.imageSmoothingEnabled = false;
    for (let y = oy; y < H; y += s) for (let x = ox; x < W; x += s) c.drawImage(GRAIN, x, y, s, s);
    c.restore(); c.imageSmoothingEnabled = true;
  });
  def("glow", "motionvideo: glow and bloom", "bright parts of the finished frame bleed soft light around themselves; call as glow(ctx, o)", "radius=24, strength=0.5", (c, o = {}) => tmp(c.canvas, () => {
    const [k, x] = grab(); x.drawImage(c.canvas, 0, 0); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = `blur(${o.radius ?? 24}px)`; c.globalCompositeOperation = "screen"; c.globalAlpha = o.strength ?? 0.5; c.drawImage(k, 0, 0); c.restore(); c.filter = "none";
  }));
  def("sweep", "motionvideo: light sweep", "a band of light slides across whatever was drawn (type or a shape) and only shows on it", "draw (ctx) => {}, width=260, color, strength=0.7", (c, t, draw, o = {}) => {
    const [k, x] = grab(); x.save(); draw(x); x.restore(); c.drawImage(k, 0, 0);
    const w = o.width ?? 260, cx = lerp(-w * 2, W + w * 2, (o.ease || M.io)(t)), g = x.createLinearGradient(cx - w, 0, cx + w, 0), col = o.color || "#ffffff";
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, o.strength ?? 0.7)); g.addColorStop(1, rgba(col, 0));
    x.globalCompositeOperation = "source-in"; x.setTransform(1, 0, -0.35, 1, H * 0.175, 0); x.fillStyle = g; x.fillRect(-W, 0, W * 3, H); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over";
    c.drawImage(k, 0, 0);
  });
  def("mesh", "motionvideo: mesh gradient", "soft colour points drift slowly under the scene and blend into a moving field of colour", "colors[] (first is the base), speed=1", (c, t, o) => {
    const cols = o.colors; c.fillStyle = cols[0]; c.fillRect(0, 0, W, H);
    for (let i = 1; i < cols.length; i++) { const ph = t * (o.speed ?? 1) * TAU * 0.5 + i * 2.1, x = W * (0.5 + 0.4 * Math.sin(ph * 0.7 + i)), y = H * (0.5 + 0.4 * Math.cos(ph * 0.9 + i * 1.7)), r = W * (0.42 + 0.1 * Math.sin(ph + i));
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(cols[i], 0.9)); g.addColorStop(1, rgba(cols[i], 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  });
  def("chroma", "motionvideo: chromatic aberration", "red and blue slip sideways off the picture for a frame or two, like a cheap lens under stress; call as chroma(ctx, o)", "amount=8 (pixels)", (c, o = {}) => {
    const a = o.amount ?? 8; if (!a) return; const src = grab(); src[1].drawImage(c.canvas, 0, 0); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#000"; c.fillRect(0, 0, W, H); c.globalCompositeOperation = "lighter";
    [["#ff0000", -a], ["#00ff00", 0], ["#0000ff", a]].forEach(([col, dx]) => { const [k, x] = grab(); x.drawImage(src[0], 0, 0); x.globalCompositeOperation = "multiply"; x.fillStyle = col; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over"; c.drawImage(k, dx, 0); depth--; });
    c.restore();
  });
  def("smear", "motionvideo: motion blur", "fast things streak: the scene is drawn at several moments inside one frame and averaged; call as smear(ctx, f, draw, o) with draw = (ctx, frame) => {}", "samples=5, shutter=0.6 (of a frame)", (c, f, draw, o = {}) => {
    const n = o.samples ?? 5, sh = o.shutter ?? 0.6;
    for (let k = 0; k < n; k++) tmp((x) => draw(x, f - (sh * k) / (n - 1)), (L) => { c.globalAlpha = 1 / (k + 1); c.drawImage(L, 0, 0); });
    c.globalAlpha = 1;
  });
  def("eq", "motionvideo: frequency bars", "bars that follow the film's own soundtrack, read from the levels sound.py writes; call as eq(ctx, f, o)", "box [x,y,w,h], color, bands=16", (c, f, o = {}) => {
    const [bx, by, bw, bh] = o.box || [560, 760, 800, 160], n = o.bands ?? 16, row = (LEVELS && LEVELS.bands[Math.max(0, Math.min(LEVELS.bands.length - 1, f | 0))]) || [], gap = bw / n;
    c.fillStyle = o.color || "#fff"; for (let i = 0; i < n; i++) { const v = Math.max(0.03, row[Math.floor((i * row.length) / n)] || 0), h = v * bh; c.fillRect(bx + i * gap + gap * 0.18, by + (bh - h) / 2, gap * 0.64, h); }
  });

  /* ---- clips: declare each use of a move once, and both the picture and the sound come from it ---- */
  const SIG = { flood: "trans", iris: "trans", push: "trans", dotBloom: "trans", dotDissolve: "trans", pixelPeak: "trans", glitchCut: "trans", wipe: "trans", zoomThrough: "trans", punch: "wrap", shake: "wrap", sweep: "wrap", grain: "frame", eq: "frame", smear: "smear", glow: "pass", chroma: "pass" };
  const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).filter(Boolean);
  const CUE = { /* [when (0..1 through the clip), sound, gain, { dur: share of the clip }] */
    letters: (o) => seq([...o.text].length, (i) => o.text[i] !== " " && [i * (1 - (o.overlap ?? 0.8)) / (1 + ([...o.text].length - 1) * (1 - (o.overlap ?? 0.8))), "type", 0.5]),
    words: (o) => seq(o.text.split(" ").length, (i) => [(i * 0.5) / (1 + (o.text.split(" ").length - 1) * 0.5), "pop", 0.6]),
    typewriter: (o) => seq([...o.text].length, (i) => o.text[i] !== " " && [i / [...o.text].length, "type", 0.55]),
    scramble: () => [[0, "glitch", 0.45, { dur: 0.9 }], [0.92, "tick", 0.7]],
    flap: (o) => [[0, "flap", 0.5, { dur: 0.95 }], ...seq(o.text.length, (i) => [0.4 + 0.58 * ((i + 1) / o.text.length), "tick", 0.5])],
    lineMask: () => [[0, "whoosh", 0.45, { dur: 0.5 }], [0.55, "thud", 0.7]],
    slam: (o) => seq(o.words.length, (i) => [i / o.words.length, "impact", 1]),
    punchWord: () => [[0.1, "impact", 1]],
    wheel: (o) => seq(o.words.length, (i) => [(i + 0.25) / o.words.length, "tick", 0.5]),
    swap: (o) => seq(o.words.length, (i) => [i / o.words.length, "pop", 0.6]),
    echo: () => [[0, "swell", 0.5, { dur: 1 }]], tracking: () => [[0, "swell", 0.45, { dur: 1 }]], weight: () => [[0, "swell", 0.5, { dur: 0.9 }], [0.85, "thud", 0.5]],
    outline: () => [[0, "draw", 0.5, { dur: 0.6 }], [0.6, "swell", 0.4, { dur: 0.4 }]],
    crossOut: () => [[0.02, "scratch", 0.7], [0.12, "scratch", 0.7], [0.72, "swipe", 0.4]], highlight: () => [[0, "swipe", 0.6]], caption: () => [[0, "pop", 0.4]],
    ticker: () => [...seq(12, (i) => [0.8 * Math.pow((i + 1) / 12, 1.8), "tick", 0.3]), [0.9, "ding", 0.6]],
    chart: () => [[0, "rise", 0.45, { dur: 1 }], [1, "ding", 0.5]], bars: (o) => [...seq(o.values.length, (i) => [0.6 * (i * 0.4) / (1 + (o.values.length - 1) * 0.4), "tick", 0.45]), [0.64, "ding", 0.6]],
    callout: () => [[0, "pop", 0.6], [0.45, "tick", 0.5]], pathDraw: () => [[0, "draw", 0.55, { dur: 1 }]], logoDraw: () => [[0, "draw", 0.5, { dur: 0.9 }], [0.95, "ding", 0.7]], burst: () => [[0, "pop", 0.8], [0, "sparkle", 0.35, { dur: 0.6 }]],
    bounce: (o) => seq(o.bounces ?? 3, (k) => [(k + 0.5) / (o.bounces ?? 3), "thud", 0.8 * Math.pow(0.75, k)]),
    flood: () => [[0, "riser", 0.5, { dur: 1 }], [1, "impact", 0.9]], iris: () => [[0, "whoosh", 0.7, { dur: 1 }]], push: () => [[0, "whoosh", 0.7, { dur: 1 }]], wipe: () => [[0, "whoosh", 0.6, { dur: 1 }]], zoomThrough: () => [[0, "whoosh", 0.8, { dur: 1 }], [0.75, "thud", 0.5]],
    dotBloom: () => [[0, "sparkle", 0.6, { dur: 1 }]], dotDissolve: () => [[0, "sparkle", 0.55, { dur: 1 }]], pixelPeak: () => [[0, "rise", 0.5, { dur: 1 }], [0.9, "thud", 0.6]],
    glitchCut: () => [[0, "glitch", 0.8, { dur: 1 }]], punch: () => [[0, "thud", 0.7]], shake: () => [[0, "impact", 0.9]], sweep: () => [[0.15, "swell", 0.35, { dur: 0.7 }]],
  };
  const CLIPS = [];
  M.clip = (name, at, len, o = {}) => {
    const k = { name, at, len, o, t: (f) => clamp((f - at) / len), on: (f) => f >= at && (o.until == null || f < o.until) };
    const sig = SIG[name];
    k.draw = (c, f) => { const t = k.t(f); return sig === "trans" ? M[name](c, t, o.from, o.to, o) : sig === "wrap" ? M[name](c, t, o.draw, o) : sig === "frame" ? M[name](c, f, o) : sig === "smear" ? M.smear(c, f, o.draw, o) : sig === "pass" ? M[name](c, o) : M[name](c, t, o); };
    CLIPS.push(k); return k;
  };
  /* every sound the declared clips make, as frames; pass the result to timeline() as cues */
  M.cues = () => CLIPS.flatMap((k) => (k.o.mute || !CUE[k.name] ? [] : CUE[k.name](k.o)).map(([t, kind, gain = 1, x = {}]) => ({ f: +(k.at + t * k.len).toFixed(2), kind, gain: +(gain * (k.o.vol ?? 1)).toFixed(3), dur: x.dur ? +((x.dur * k.len) / 30).toFixed(3) : undefined, pan: +(((k.o.x ?? W / 2) / W) * 2 - 1).toFixed(2) })));
  /* every piece of on-screen text with how long it stays up, for lint.py (set until: on a clip to say when it leaves) */
  M.captions = () => CLIPS.filter((k) => k.o.until != null && (k.o.text || k.o.lines || k.o.words)).map((k) => ({ text: k.o.text || (k.o.lines || k.o.words).join(" "), from: k.at, shown: k.at + k.len, until: k.o.until, each: !!k.o.words && !k.o.prefix }));

  M.index = INDEX;
  window.MOVES = M;
})();
