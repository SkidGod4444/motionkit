/* Headless render: serves the folder you run it from (your films) on top of this engine folder (lib.js, moves.js, fonts) on localhost, steps renderFrame(f) in hidden Chrome, pipes JPEGs to ffmpeg.
   bun render.ts --page hello.html --out out-hello                  every frame -> out-hello/silent.mp4 (bun build.ts adds the sound)
   bun render.ts --page hello.html --out out-hello --frame 10,25    stills -> out-hello/f0010.jpg ...
   bun render.ts --page hello.html --out out-hello --range 0 96     stills for a span
   Chrome: set CHROME_PATH if Chrome, Chromium or Edge is not in one of the usual places. */
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const engine = import.meta.dir, work = process.cwd(); /* films, ref and out folders live where you run the command; the engine stays where it was installed */
const find = (p: string) => (existsSync(join(work, p)) ? join(work, p) : join(engine, p));
const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const PAGE = opt("--page", "moves.html"); /* which film */
const out = join(work, opt("--out", "out-" + PAGE.replace(/\.html$/, "")));
mkdirSync(out, { recursive: true });
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => p && existsSync(p));
if (!CHROME) { console.error("No Chrome found. Install Chrome or Chromium, or set CHROME_PATH to the browser's program file."); process.exit(1); }

const server = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  async fetch(req) {
    const p = decodeURIComponent(new URL(req.url).pathname);
    const file = Bun.file(find(p === "/" ? PAGE : p));
    return (await file.exists()) ? new Response(file, { headers: { "cache-control": "no-store" } }) : new Response("no", { status: 404 });
  },
});
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) console.error("console:", m.text()); });
page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico") && !r.url().endsWith("/levels.json")) /* levels.json is written by the soundtrack step, after the first pass */ console.error(`missing file: ${r.url()} (${r.status()})`); });
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(`http://127.0.0.1:${server.port}/${PAGE}`);
await page.evaluate(() => (window as any).ready);
const total: number = await page.evaluate(() => (window as any).TOTAL);
const tl0 = await page.evaluate(() => (window as any).timeline());
const ALPHA = !!tl0.alpha; /* an overlay film: see-through background, so frames are PNG and the video is ProRes 4444 with alpha */
const shot = async (f: number, q = 0.93) => {
  const url: string = await page.evaluate((f, q, png) => { (window as any).renderFrame(f); const c = document.getElementById("c") as HTMLCanvasElement; return png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", q); }, f, q, ALPHA);
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
};
const ext = ALPHA ? "png" : "jpg";

let list: number[] | null = null;
if (args.includes("--frame")) list = args[args.indexOf("--frame") + 1].split(",").map(Number);
if (args.includes("--range")) { const i = args.indexOf("--range"); const a = +args[i + 1], b = +args[i + 2]; list = Array.from({ length: b - a + 1 }, (_, k) => a + k); }

if (args.includes("--timeline")) { /* only the timeline: the soundtrack is made from it before the picture is rendered */
  writeFileSync(join(out, "timeline.json"), JSON.stringify(await page.evaluate(() => (window as any).timeline())));
} else if (list) {
  for (const f of list) writeFileSync(join(out, `f${String(f).padStart(4, "0")}.${ext}`), await shot(f));
  console.log(`wrote ${list.length} stills to ${out}`);
} else {
  writeFileSync(join(out, "timeline.json"), JSON.stringify(await page.evaluate(() => (window as any).timeline())));
  const silent = join(out, ALPHA ? "silent.mov" : "silent.mp4");
  const enc = ALPHA ? ["-c:v", "png", "-i", "-", "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-vendor", "apl0"] : ["-c:v", "mjpeg", "-i", "-", "-vf", "fps=60", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p"];
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", "30", ...enc, silent], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const buf = await shot(f, 0.95);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 60 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(`wrote ${silent}`);
}
await browser.close();
server.stop(true);
