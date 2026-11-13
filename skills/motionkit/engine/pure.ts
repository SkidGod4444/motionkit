/* Does every frame depend only on its number?  bun <engine>/pure.ts <name>
   Renders a spread of frames in one order, then in another, and compares the files. A difference means a frame is using
   something left behind by an earlier frame (an unfilled background, a clock, Math.random, a canvas that is not software). */
import { $ } from "bun";
import { readFileSync } from "node:fs";
const E = import.meta.dir, name = process.argv[2];
if (!name) { console.error("usage: bun pure.ts <name>"); process.exit(1); }
await $`bun ${E}/render.ts --page ${name}.html --out out-${name} --timeline`.quiet();
const tl = JSON.parse(readFileSync(`out-${name}/timeline.json`, "utf8")), n = 8;
const frames = [...new Set([...Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) * tl.total) / n)), ...(tl.cuts || []).map((c: number) => Math.min(tl.total - 1, c + 5))])].sort((a, b) => a - b);
const shuffled = frames.filter((_, i) => i % 2).reverse().concat(frames.filter((_, i) => !(i % 2)));
await $`bun ${E}/render.ts --page ${name}.html --out out-${name}/pure-a --frame ${frames.join(",")}`.quiet();
await $`bun ${E}/render.ts --page ${name}.html --out out-${name}/pure-b --frame ${shuffled.join(",")}`.quiet();
const file = (d: string, f: number) => readFileSync(`out-${name}/pure-${d}/f${String(f).padStart(4, "0")}.${tl.alpha ? "png" : "jpg"}`);
const bad = frames.filter((f) => !file("a", f).equals(file("b", f)));
console.log(bad.length ? `NOT PURE: frames ${bad.join(", ")} differ depending on what was drawn before them` : `pure: ${frames.length} frames identical in both orders`);
process.exit(bad.length ? 1 : 0);
