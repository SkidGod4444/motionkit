/* Rewrites the move list inside the skill file from moves.js, so the two cannot drift: bun index.ts */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
(globalThis as any).window = globalThis;
await import("./moves.js");
const rows = (globalThis as any).MOVES.index.map((m: any) => `| \`${m.name}\` | ${m.about} | ${m.opts} | ${m.from} |`);
const file = join(import.meta.dir, "../SKILL.md");
const block = `<!-- moves:start -->\n| move | what it does | options | studied from |\n|---|---|---|---|\n${rows.join("\n")}\n<!-- moves:end -->`;
writeFileSync(file, readFileSync(file, "utf8").replace(/<!-- moves:start -->[\s\S]*<!-- moves:end -->/, block));
console.log(`${rows.length} moves written to the skill file`);
