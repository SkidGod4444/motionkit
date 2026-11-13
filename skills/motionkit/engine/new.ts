/* Start a film: bun <engine>/new.ts <name> [--overlay]  ->  <name>.html and <name>.js in the folder you run it from, copied from the
   hello example (a full-frame film with music) or, with --overlay, the title example (see-through, for placing over footage). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const E = import.meta.dir, name = process.argv[2], from = process.argv.includes("--overlay") ? "title" : "hello"; /* --overlay starts from the see-through title example */
if (!name || !/^[a-z0-9-]+$/.test(name)) { console.error("usage: bun new.ts <lowercase-name>"); process.exit(1); }
if (["hello", "title", "moves", "moves-demo", "lib"].includes(name)) { console.error(`"${name}" is one of the engine's own files; pick another name`); process.exit(1); }
if (existsSync(`${name}.html`) || existsSync(`${name}.js`)) { console.error(`${name}.html or ${name}.js already exists here`); process.exit(1); }
writeFileSync(`${name}.html`, readFileSync(join(E, `${from}.html`), "utf8").replace(`<title>${from}<`, `<title>${name}<`).replace(`${from}.js`, `${name}.js`));
writeFileSync(`${name}.js`, readFileSync(join(E, `${from}.js`), "utf8").replaceAll(`out-${from}`, `out-${name}`).replace(/^\/\*[\s\S]*?\*\//, `/* ${name}: started from the ${from} example${from === "title" ? " (an overlay: see-through background, clear the frame, never fill it)" : ""}. Replace every clip and line of copy below with your own.\n   Build (from this folder): bun <engine>/build.ts ${name}  ->  out-${name}/${name}.${from === "title" ? "mov" : "mp4"} */`));
console.log(`wrote ${name}.html and ${name}.js; edit ${name}.js, then build it with: bun ${join(E, "build.ts")} ${name}`);
