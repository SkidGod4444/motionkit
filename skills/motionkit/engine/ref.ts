/* Reference intake: turn any clip into what a clone needs, in one step.
   bun ref.ts <file|url> --name demo [--fps 30] [--force]
   -> ref/demo/src.mp4      the clip (ref/ is git-ignored: reference only, never shipped)
      ref/demo/NNNN.jpg     one still per frame, 0-based, so NNNN is the f passed to renderFrame
      ref/demo/sheet.jpg    contact sheet, 5 frames a second
      ref/demo/ref.json     size, fps, frame count, cuts, holds, per-frame luma and change
      demo.html + demo.js   starter film with the cut table filled in (only when missing, or --force) */
import { $ } from "bun";
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd(); /* ref/ and the starter film go in the folder you run this from */
const args = process.argv.slice(2);
const opt = (n: string, d = "") => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const src = args[0];
const name = opt("--name");
if (!src || src.startsWith("--") || !/^[a-z0-9-]+$/.test(name)) { console.error("usage: bun ref.ts <file|url> --name <lowercase-name> [--fps 30] [--force]"); process.exit(1); }
const RESERVED = ["index", "moves", "moves-demo", "hello", "title", "lib", "render", "build", "ref", "check", "compare", "sound", "audio", "lint", "sync"];
if (RESERVED.includes(name)) { console.error(`"${name}" is already a file in this folder; pick another name`); process.exit(1); }
const dir = join(root, "ref", name);
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (/^\d{4}\.jpg$/.test(f)) unlinkSync(join(dir, f));
const clip = join(dir, "src.mp4");

if (/^https?:/.test(src)) await $`curl -sSfL -A Mozilla/5.0 -o ${clip} ${src}`;
else copyFileSync(src, clip);

const probe = JSON.parse(await $`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate:format=duration -of json ${clip}`.text());
const [n, d] = probe.streams[0].r_frame_rate.split("/").map(Number);
const srcFps = n / (d || 1);
const fps = +opt("--fps", String(Math.min(30, Math.round(srcFps))));
const { width, height } = probe.streams[0];

await $`ffmpeg -v error -y -i ${clip} -vf fps=${fps} -start_number 0 -q:v 3 ${join(dir, "%04d.jpg")}`;
const frames = readdirSync(dir).filter((f) => /^\d{4}\.jpg$/.test(f)).length;
const cols = 6, rows = Math.max(1, Math.ceil((frames / fps) * 5 / cols));
await $`ffmpeg -v error -y -i ${clip} -vf fps=5,scale=320:-1,tile=${cols}x${rows}:padding=3 -frames:v 1 ${join(dir, "sheet.jpg")}`;

/* per-frame brightness, and how much each frame differs from the one before */
const stat = async (vf: string) => (await $`ffmpeg -v error -i ${clip} -vf ${vf} -f null -`.text()).split("\n").filter((l) => l.includes("YAVG")).map((l) => +(+l.split("=")[1]).toFixed(2));
const luma = await stat(`fps=${fps},signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`);
const diff = [0, ...(await stat(`fps=${fps},tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`))].slice(0, luma.length); /* tblend's first output is frame 1 against frame 0 */

/* a cut is a frame that changes far more than its neighbours; a hold is 6+ frames that barely change */
const sorted = [...diff].sort((p, q) => p - q), med = sorted[sorted.length >> 1] || 0;
const cuts = [0];
for (let f = 1; f < diff.length; f++) {
  const near = Math.max(diff[f - 1] || 0, diff[f + 1] || 0);
  if (diff[f] > Math.max(10, med * 6) && diff[f] > near * 2.5 && f - cuts[cuts.length - 1] >= 3) cuts.push(f);
}
const holds: number[][] = [];
for (let f = 1, s = -1; f <= diff.length; f++) {
  const still = f < diff.length && diff[f] < 0.12;
  if (still && s < 0) s = f;
  if (!still && s >= 0) { if (f - s >= 6) holds.push([s, f - 1]); s = -1; }
}
writeFileSync(join(dir, "ref.json"), JSON.stringify({ name, source: /^https?:/.test(src) ? src : "local file", width, height, srcFps, fps, frames, cuts, holds, luma, diff }));

/* starter film: one stub per cut, named so the frame range is obvious */
const html = join(root, `${name}.html`), js = join(root, `${name}.js`);
if ((!existsSync(js) && !existsSync(html)) || args.includes("--force")) {
  const ends = [...cuts.slice(1), frames];
  const scenes = cuts.map((c, i) => `  function s${i}(f, t) { /* frames ${c}-${ends[i] - 1}: f counts from 0 inside the scene, t runs 0..1 */\n    X.fillStyle = "#0a0a0c"; X.fillRect(0, 0, W, H);\n    M.letters(X, t * 2, { text: "scene ${i}", x: W / 2, y: H / 2, size: 120 });\n  }`).join("\n");
  writeFileSync(js, `/* ${name}: timing studied from ref/${name} (${/^https?:/.test(src) ? src : "local clip"}). Words, drawings and sound are our own.
   Run from this folder; <engine> is the folder ref.ts lives in.
   Build: bun <engine>/build.ts ${name}    Stills: bun <engine>/render.ts --page ${name}.html --out out-${name} --frame 0,10
   Compare: python3 <engine>/compare.py sheet.jpg 0 10 --ref ref/${name} --out out-${name}    Check: python3 <engine>/check.py ${name} */
(() => {
  const M = window.MOVES;
  const TOTAL = ${frames};
${scenes}
  const CUTS = [${cuts.map((c, i) => `[${c}, s${i}]`).join(", ")}];
  window.TOTAL = TOTAL;
  window.renderFrame = (f) => {
    f = Math.max(0, Math.min(TOTAL - 1, f | 0));
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.filter = "none"; X.globalCompositeOperation = "source-over"; X.setLineDash([]); X.textAlign = "left";
    let i = 0; while (i + 1 < CUTS.length && f >= CUTS[i + 1][0]) i++;
    const a = CUTS[i][0], z = i + 1 < CUTS.length ? CUTS[i + 1][0] : TOTAL;
    CUTS[i][1](f - a, (f - a) / Math.max(1, z - a - 1));
  };
  window.timeline = () => ({ fps: ${fps}, total: TOTAL, cuts: CUTS.map((c) => c[0]), keys: [], swaps: [], strobes: [] });
  window.ready = M.fonts();
})();
`);
  writeFileSync(html, `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${name}</title>
<style>
@font-face { font-family: Geist; src: url(fonts/Geist-Variable.woff2); font-weight: 100 900; font-style: normal; }
@font-face { font-family: Geist; src: url(fonts/Geist-Italic-Variable.woff2); font-weight: 100 900; font-style: italic; }
@font-face { font-family: GeistMono; src: url(fonts/GeistMono-Variable.woff2); font-weight: 100 900; }
@font-face { font-family: Archivo; src: url(fonts/Archivo-Variable.ttf); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: JetBrainsMono; src: url(fonts/JetBrainsMono-Variable.ttf); font-weight: 100 800; }
html, body { margin: 0; background: #000; }
canvas { display: block; width: 100vw; height: auto; }
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<script src="lib.js"></script>
<script src="moves.js"></script>
<script src="${name}.js"></script>
</body>
</html>
`);
  console.log(`wrote ${name}.html and ${name}.js`);
}
console.log(`${name}: ${width}x${height}, source ${srcFps.toFixed(2)} fps read at ${fps} fps, ${frames} frames (${(frames / fps).toFixed(2)} s)`);
console.log(`cuts at frames: ${cuts.join(", ")}`);
console.log(`holds: ${holds.map((h) => h.join("-")).join(", ") || "none"}`);
console.log(`look at ref/${name}/sheet.jpg, then edit ${name}.js`);
