/* Primitives. Every frame is a pure function of its frame number: no clocks, no Math.random. */
const W = 1920, H = 1080;
const cv = document.getElementById("c");
/* software canvases throughout: the GPU path rasterised a fresh layer differently from a warm one, so a still and the same frame in sequence disagreed */
const SOFT = { willReadFrequently: true };
const X = cv.getContext("2d", SOFT);
const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const A = mk(W, H), a = A.getContext("2d", SOFT);
const B = mk(W, H), b = B.getContext("2d", SOFT);
const L = mk(240, 135), l = L.getContext("2d", { willReadFrequently: true });
const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (p, q, t) => p + (q - p) * t;
const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hash2 = (x, y) => hash(x * 12.9898 + y * 78.233);
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}

const FAM = { sans: "Geist", mono: "GeistMono", serif: "Georgia" }; /* short names for the fonts each page loads; any other name is used as given */
function setFont(c, size, weight = 500, fam = "sans", italic = false) {
  c.font = `${italic ? "italic " : ""}${weight} ${size}px ${FAM[fam] || fam}`;
}
function fit(text, width, weight = 500, fam = "sans", italic = false) {
  setFont(X, 100, weight, fam, italic);
  return (100 * width) / X.measureText(text).width;
}
function txt(c, s, x, y, size, weight, color, fam = "sans", italic = false, align = "left") {
  setFont(c, size, weight, fam, italic);
  c.fillStyle = color; c.textAlign = align; c.textBaseline = "alphabetic";
  c.fillText(s, x, y);
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

/* typed text: table of [frame, chars] read against an original length, rescaled to the new string */
function typed(str, table, origLen, f) {
  let n = 0;
  for (const [fr, cnt] of table) if (f >= fr) n = cnt;
  return str.slice(0, Math.round((n / origLen) * str.length));
}

/* ---- finishing passes ---- */
function scan(alpha = 0.05, dark = true) {
  X.fillStyle = dark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
  for (let y = 0; y < H; y += 4) X.fillRect(0, y, W, 1.5);
}
function vignette(alpha = 0.6, inner = 0.45, col = "0,0,0") {
  const g = X.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${alpha})`);
  X.fillStyle = g; X.fillRect(0, 0, W, H);
}
/* soft focus at the edges: blurred copy everywhere, sharp copy through a radial mask */
function edgeBlur(src, px = 6, cx = W / 2, cy = H / 2, r0 = 260, r1 = 900) {
  X.filter = `blur(${px}px)`; X.drawImage(src, 0, 0); X.filter = "none";
  b.globalCompositeOperation = "source-over"; b.clearRect(0, 0, W, H); b.drawImage(src, 0, 0);
  const g = b.createRadialGradient(cx, cy, r0, cx, cy, r1);
  g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
  b.globalCompositeOperation = "destination-in"; b.fillStyle = g; b.fillRect(0, 0, W, H);
  b.globalCompositeOperation = "source-over";
  X.drawImage(B, 0, 0);
}
function onA(fn, clear = true) { a.setTransform(1, 0, 0, 1, 0, 0); a.filter = "none"; a.globalAlpha = 1; if (clear) a.clearRect(0, 0, W, H); fn(a); a.setTransform(1, 0, 0, 1, 0, 0); return A; }

/* ---- the dither pass: sample anything on a coarse grid and redraw each cell as a pixel-font mark ---- */
function sample(src, cols, rows) {
  if (L.width !== cols || L.height !== rows) { L.width = cols; L.height = rows; }
  l.clearRect(0, 0, cols, rows); l.imageSmoothingEnabled = true; l.imageSmoothingQuality = "high";
  l.drawImage(src, 0, 0, cols, rows);
  return l.getImageData(0, 0, cols, rows).data;
}
function pix(src, cell, o = {}) {
  const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
  const d = sample(src, cols, rows);
  const gain = o.gain ?? 1, floor = o.floor ?? 0.05, style = o.style || "geo", c = o.ctx || X;
  const g = cell, pad = o.pad ?? Math.max(1, g * 0.08);
  c.lineWidth = o.lw ?? Math.max(1, g * 0.07);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = (j * cols + i) * 4, al = d[k + 3] / 255;
    let r = d[k] * al, gg = d[k + 1] * al, bb = d[k + 2] * al;
    let lum = ((0.2126 * r + 0.7152 * gg + 0.0722 * bb) / 255) * gain;
    if (o.alpha) lum = al * gain;
    if (o.mod) lum *= o.mod(i, j);
    if (o.invert) lum = 1 - lum;
    if (lum < floor) continue;
    lum = Math.min(1, lum);
    let col;
    if (o.mono) col = o.mono;
    else { const m = Math.max(r, gg, bb, 1), s = Math.min(255, 255 * (0.25 + lum * 0.95)) / m; col = `rgb(${r * s | 0},${gg * s | 0},${bb * s | 0})`; }
    const x = i * g, y = j * g;
    c.fillStyle = col; c.strokeStyle = col;
    if (style === "dots") { c.beginPath(); c.arc(x + g / 2, y + g / 2, (g / 2) * Math.sqrt(lum) * (o.size ?? 1), 0, TAU); c.fill(); continue; }
    if (style === "square") {
      c.fillRect(x + pad, y + pad, g - 2 * pad, g - 2 * pad);
      if (o.dot) { c.fillStyle = o.dot; const q = hash2(i, j); if (q < 0.04) { c.strokeStyle = o.dot; c.beginPath(); c.moveTo(x + pad, y + pad); c.lineTo(x + g - pad, y + g - pad); c.moveTo(x + g - pad, y + pad); c.lineTo(x + pad, y + g - pad); c.stroke(); } else c.fillRect(x + g / 2 - g * 0.06, y + g / 2 - g * 0.06, g * 0.14, g * 0.14); }
      continue;
    }
    if (style === "block") { c.fillRect(x, y, g + 0.5, g + 0.5); continue; }
    /* geo: the marks get heavier as the cell gets brighter */
    const x0 = x + pad, y0 = y + pad, s = g - 2 * pad;
    if (lum < 0.16) { c.globalAlpha = 0.75; c.beginPath(); c.moveTo(x0 + s * 0.25, y0 + s * 0.25); c.lineTo(x0 + s * 0.75, y0 + s * 0.75); c.moveTo(x0 + s * 0.75, y0 + s * 0.25); c.lineTo(x0 + s * 0.25, y0 + s * 0.75); c.stroke(); c.globalAlpha = 1; }
    else if (lum < 0.32) { c.beginPath(); c.arc(x + g / 2, y + g / 2, s * 0.38, 0, TAU); c.stroke(); }
    else if (lum < 0.5) { c.strokeRect(x0, y0, s, s); c.beginPath(); c.moveTo(x0, y0 + s); c.lineTo(x0 + s, y0); c.stroke(); }
    else if (lum < 0.72) { c.globalAlpha = 0.4; c.fillRect(x0, y0, s, s); c.globalAlpha = 1; c.strokeRect(x0, y0, s, s); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + s, y0 + s); c.moveTo(x0 + s, y0); c.lineTo(x0, y0 + s); c.stroke(); }
    else { c.fillRect(x0, y0, s, s); c.strokeStyle = "rgba(0,0,0,.55)"; c.beginPath(); if (hash2(i, j) < 0.5) { c.moveTo(x0, y0 + s); c.lineTo(x0 + s, y0); } else { c.moveTo(x0, y0); c.lineTo(x0 + s, y0 + s); } c.stroke(); }
  }
}
const RAMP = " .:;x+tTYXAHRM%W@";
function chars(src, cw, ch, o = {}) {
  const cols = Math.ceil(W / cw), rows = Math.ceil(H / ch);
  const d = sample(src, cols, rows), gain = o.gain ?? 1, c = o.ctx || X;
  setFont(c, ch * 1.02, 600, "mono"); c.textAlign = "center"; c.textBaseline = "middle";
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = (j * cols + i) * 4, al = d[k + 3] / 255;
    const r = d[k] * al, g = d[k + 1] * al, bb = d[k + 2] * al;
    const m = Math.max(r, g, bb, 1), lum = Math.min(1, (m / 255) * gain); /* level from the strongest channel, so saturated blues and violets stay bright */
    if (lum < 0.06) continue;
    const s = Math.min(255, 255 * (0.35 + lum)) / m;
    c.fillStyle = o.mono || `rgb(${r * s | 0},${g * s | 0},${bb * s | 0})`;
    const q = (hash2(i * 3 + (o.seed || 0), j * 7) * 4) | 0;
    c.fillText(RAMP[Math.min(RAMP.length - 1, 1 + ((lum * (RAMP.length - 5)) | 0) + q)], i * cw + cw / 2, j * ch + ch / 2);
  }
  c.textAlign = "left"; c.textBaseline = "alphabetic";
}

/* ---- the tracking overlay: boxes, coordinate labels, dashed orbits ---- */
function box(x, y, w, h, col = "#c9234b", rot = 0, c = X) {
  c.save(); c.translate(x, y); c.rotate(rot); c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(-w / 2, -h / 2, w, h); c.restore();
}
function label(x, y, s, rot = 0, size = 22, col = "#fff", c = X) {
  c.save(); c.translate(x, y); c.rotate(rot); setFont(c, size, 500, "mono"); c.fillStyle = col; c.textAlign = "left"; c.fillText(s, 0, 0); c.restore();
}
function dot(x, y, col = "#22e04a", r = 6, c = X) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function dash(pts, col = "rgba(255,255,255,.8)", arrow = true, c = X) {
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.5; c.setLineDash([12, 9]);
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  if (pts.length === 6) c.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); else c.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
  c.stroke(); c.setLineDash([]);
  if (arrow) {
    const n = pts.length, ex = pts[n - 2], ey = pts[n - 1], an = Math.atan2(ey - pts[n - 3], ex - pts[n - 4]);
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - 20 * Math.cos(an - 0.45), ey - 20 * Math.sin(an - 0.45)); c.moveTo(ex, ey); c.lineTo(ex - 20 * Math.cos(an + 0.45), ey - 20 * Math.sin(an + 0.45)); c.stroke();
  }
  c.restore();
}
function dashEllipse(cx, cy, rx, ry, a0 = 0, a1 = TAU, col = "rgba(255,255,255,.7)", rot = 0, c = X) {
  c.save(); c.strokeStyle = col; c.lineWidth = 2.5; c.setLineDash([12, 9]); c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, a0, a1); c.stroke(); c.restore();
}
