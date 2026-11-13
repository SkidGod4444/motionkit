/* Build a film: bun <engine>/build.ts <name>  ->  out-<name>/<name>.mp4 in the folder you run it from.
   <name>.html is the page (yours, or one of the engine's examples: hello, title, moves). What the film's timeline says decides the rest:
     bpm            beat-grid soundtrack (sound.py), made BEFORE the picture so moves can follow it, then checked without ears
     sound: "fx"    only the sounds the moves make, no music (for a clip that goes over footage with its own sound)
     sound: "none"  silent
     music: {file}  a real music file under the film (find its beat first with beats.py); the cuts in `sync` are checked against it
     alpha: true    an overlay: see-through background, written as <name>.mov (ProRes 4444 with alpha) for a video editor
   A film with no bpm and no sound setting gets the simpler soundtrack (audio.py). */
import { $ } from "bun";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
const E = import.meta.dir;
const name = process.argv[2];
if (!name) { console.error("usage: bun build.ts <name>"); process.exit(1); }
const out = `out-${name}`;
mkdirSync(out, { recursive: true });
await $`bun ${E}/render.ts --page ${name}.html --out ${out} --timeline`;
const tl = JSON.parse(readFileSync(`${out}/timeline.json`, "utf8"));
const ext = tl.alpha ? "mov" : "mp4", silent = `${out}/silent.${ext}`, final = `${out}/${name}.${ext}`;
const music = tl.bpm && tl.sound !== "fx" && tl.sound !== "none" && !tl.music; /* the full soundtrack, with the beat checks that go with it */
if (tl.bpm && tl.sound !== "none") {
  const s = await $`uv run --quiet ${E}/sound.py ${out} --check`.nothrow();
  if (s.exitCode === 2) console.error("WARNING: the soundtrack was made but its check failed (see above)");
  else if (s.exitCode !== 0) { console.error("sound.py crashed; not building with a stale soundtrack"); process.exit(1); }
}
if ((tl.captions || []).length && (await $`python3 ${E}/lint.py ${out}`.nothrow()).exitCode !== 0) console.error("WARNING: some on-screen text is up too briefly (see above)");
await $`bun ${E}/render.ts --page ${name}.html --out ${out}`;
if (tl.music) { /* a real music file under the film: { file, from (seconds into it), fx (0..1 level of the moves' own sounds under it, default 0.8) } */
  const len = tl.total / tl.fps, start = (tl.music.from ?? 0) + (tl.music.nudge ?? 0.02), fade = Math.max(0, len - 1.2), fx = tl.bpm && tl.sound === "fx";
  const chain = fx ? `[0:a]afade=t=out:st=${fade}:d=1.2[m];[1:a]volume=${tl.music.fx ?? 0.8}[x];[m][x]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]` : `[0:a]afade=t=out:st=${fade}:d=1.2,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`;
  const ins = fx ? ["-i", `${out}/audio.wav`] : [];
  await $`ffmpeg -v error -y -ss ${start} -t ${len} -i ${tl.music.file} ${ins} -filter_complex ${chain} -map [a] ${out}/mix.wav`;
  await $`ffmpeg -v error -y -i ${silent} -i ${out}/mix.wav -c:v copy -c:a aac -b:a 256k -shortest ${final}`;
  if ((tl.sync || []).length && (await $`python3 ${E}/sync.py ${name}`.nothrow()).exitCode !== 0) console.error("WARNING: the cuts do not land on the music's beat in the finished file (see above)");
} else if (tl.sound === "none") copyFileSync(silent, final);
else {
  if (!tl.bpm) await $`python3 ${E}/audio.py ${out}`;
  await $`ffmpeg -v error -y -i ${silent} -i ${out}/audio.wav -c:v copy -c:a aac -b:a 256k -shortest ${final}`;
}
if (music && (await $`python3 ${E}/sync.py ${name}`.nothrow()).exitCode !== 0) console.error("WARNING: picture and sound are not in step in the finished file (see above)");
console.log(`wrote ${final}`);
