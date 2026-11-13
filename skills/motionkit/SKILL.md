---
name: motionkit
description: Make motion-graphics films in code with the motionkit canvas engine - copy the motion (timing, layout, movement) of a reference video with your own words and art, or build a new film cut to a beat from 44 ready-made moves with a synthesised soundtrack. It also makes see-through animated titles and overlays and places them on an EditMax timeline through EditMax's MCP tools. Use for "clone this video", "copy this motion", "make a reel like this", "make a launch video", "add a motion / animated title / intro / outro to my edit", "add this move", "fix the sound", or any new motion film.
---

# motionkit

A film is one page plus one script whose `renderFrame(f)` draws frame `f` (30 a second, 1920x1080) and nothing else. Hidden Chrome steps the frames, ffmpeg encodes (the mp4 is doubled to 60 frames a second at high quality, about 4 to 5 MB a second of film), the soundtrack is synthesised.

## Where things are

- **Engine**: the `engine/` folder next to this file (moves, renderer, sound, checks, fonts). Call it `$E` and use its full path. Read from it; never put films in it (setup adds its own `node_modules` there, which is expected).
- **Work folder**: the folder the user is working in. Films (`<name>.html`, `<name>.js`), `assets/`, `ref/` and `out-<name>/` all go there, and every command is run from there. A page finds `lib.js`, `moves.js` and `fonts/` in the engine by itself. If the work folder is a git repo, add `out-*/` and `ref/` to its `.gitignore`.

## First: set up (once per machine)

1. Run `sh $E/setup.sh`. It only checks: bun, ffmpeg with ffprobe, python3, uv, a Chromium browser (Chrome, Chromium or Edge; `CHROME_PATH` overrides), and the engine's one package.
2. If it prints `Ready`, go on. If only `engine package` is missing (normal on a fresh install), run `sh $E/setup.sh --install` without asking: it only fetches one package into the skill's own folder. If a tool or the browser is `MISSING`, show the user that list and the install commands it printed, and ask once before installing software on their machine.
3. On a yes, run `sh $E/setup.sh --install` (Homebrew on macOS, the official installers for bun and uv), then run the check again. Lines that say `run this yourself` need the user's password (`sudo` on Linux) or a manual download: never run those; give the user the exact command and wait. If an install fails, give the user the one command to run themselves.
4. Prove it works: from the work folder run `bun $E/build.ts hello` and confirm `out-hello/hello.mp4` exists.

Tested on macOS only; say so if the user is on Linux or Windows.

Worked examples to copy from: `$E/hello.js` (a film on a beat grid, every sound from clips, scenery drawn in code), `$E/title.js` (a see-through title to lay over footage), `$E/moves-demo.js` (every move once).

## Build a film: clips first

Declare each use of a move once as a clip. The picture, the sound and the reading-time check all come from that one line.

```js
const M = window.MOVES, B = M.brand, G = M.grid(120);          // 120 bpm: a beat is 15 frames, a bar 60
const K = { line: M.clip("words", G.bar(1) + 2, 10, { text: "Copy the motion.", x: 960, y: 590, size: 110, fam: B.display, stretch: B.wide, weight: 600, color: B.paper, until: G.bar(2) }) };
// in a scene:  K.line.draw(X, f)          K.line.on(f) is true while it should be visible
window.timeline = () => ({ fps: 30, total: TOTAL, bpm: G.bpm, sections: [[0, "intro"], [4, "build"], [8, "drop"], [24, "outro"]], cues: M.cues(), captions: M.captions() });
```

Start a film with `bun $E/new.ts <name>`: it writes `<name>.html` and `<name>.js` in the work folder, copied from the hello example. Rewrite the clips, scenes and copy. `bun $E/build.ts <name>` then does, in order: timeline, soundtrack (`sound.py`), sound check, reading-time check (`lint.py`), render, join, sync check (`sync.py`), and writes `out-<name>/<name>.mp4`. A timeline without `bpm` gets a simpler soundtrack from `audio.py` (cuts only). Timeline switches: `sound: "fx"` (move sounds only, no music), `sound: "none"`, `alpha: true` (see-through background, `.mov` output; see the EditMax section).

## Anatomy of a film script

`$E/hello.js` is the model; read it once. What each part is:

- **Globals from `lib.js`**: `W`, `H` (1920, 1080), `X` (the canvas context), `clamp`, `lerp`, `TAU`, `hash`, `noise`, `txt(ctx, text, x, y, size, weight, color, fam, italic, align)`, `rr` (rounded rect), `vignette(strength, innerRadius)`.
- **`M.clip(move, start, length, options)`**: `start` and `length` are frames; `length` is how long the move takes to play, not how long it stays. It returns `{ draw(ctx, f), t(f) (0..1 through the move), on(f), o (the options) }`. After its length a clip keeps drawing its finished state: it does not hide itself. Hide it by ending the scene, or with `if (K.x.on(f))`, where `on` is true from `start` until `until` (forever without `until`). To show a finished text move inside a transition's `from`, draw it at `t = 1`: `M.words(ctx, 1, K.line.o)`. One-shot effects (`burst`, `glitchCut`) need `K.x.t(f) < 1` as well.
- **Call shapes inside a clip**: transitions take `from` and `to` in the options; wrappers (`punch`, `shake`, `sweep`, `smear`) take `draw`. Everything else (`pathDraw`, `burst`, `bars`, `chart`, `callout`, `logoDraw`, `bounce`, `ticker`) takes only options. `mesh` and `parallax` are backgrounds: call them directly, `M.mesh(ctx, f / 240, { colors })`, where `t` is just a slowly growing number.
- **Text options**: `x` is the centre of the line (`align: "center"` is the default), `y` the baseline. `stretch: B.wide` gives the wide cut, `stretch: null` turns it off. Nothing measures or wraps text for you: at size 150 wide, 13 characters span about 1,340 px, so render a still and check every line sits inside the frame with margin.
- **Scene table**: `[first frame, draw(f), drawAfterFinish(f)]`. `renderFrame` resets the context state (keep that line), draws the current scene, then grain and vignette, then the third slot for anything that must stay clean (logos).
- **`window.ready`**: a promise the renderer waits for: `Promise.all([M.fonts(), M.levels("out-<name>/levels.json"), M.load({ ... })])`. `M.levels` is only needed for `M.eq` and is safe before the file exists.
- **Timeline**: `sections` are `[beat, name]`; a short film can use just `[[0, "intro"], [8, "drop"], [16, "outro"]]`, and each `drop` start gets the silent half beat (keep or `mute:` clips there). `sync` lists frames where a cut and a bass hit must coincide: use the first frame of each scene from the drop on. "Change" is judged against the film's usual frame-to-frame difference, so a transition that finishes exactly on a sync frame leaves nothing to change there and the check prints `NO CHANGE`: add a short flash or start the next move on that frame. `cuts` is every scene start.
- **Colours**: read everything from `M.brand` (`B`). `M.rgba(B.ink, 0.7)` gives a colour at an opacity, `M.mix(a, b, t)` a colour between two. `M.setBrand` changes `M.brand` in place; call it before any clip is declared and set `accentOnDark` too (the accent used on dark backgrounds; it does not follow `accent`). For a font with no wide cut set `wide: null`.
- **Length**: reading time sets the minimum: a 3-word line needs about 1.3 s after it has appeared, so one line per bar at 120 bpm. The soundtrack runs about half a second past the last frame and is cut there; end on an `outro` section so the cut falls in its tail.
- **Build results**: `build.ts` exits 0 even when a check fails; failures print as `WARNING:` lines with the detail above them. Treat every warning as a failure: read the output (filter out the `frame n/total` progress lines), fix, rebuild until there are none. Stills are written as `out-<name>/fNNNN.jpg`; read them. `bun $E/pure.ts <name>` confirms frames render the same alone and after other frames.
- `sound.py` needs numpy and is always run through `uv run`; the other Python scripts use only the standard library.

## Motions for EditMax (a clip on a video editor's timeline)

Use this when the user is editing in EditMax and wants a motion in the cut: an animated title over footage, an intro or outro card, a kinetic-type beat between shots. It needs two things in the same agent session: a shell (to render) and EditMax's MCP tools (`inspect_timeline`, `import_media`, ...; set up from EditMax's Agents tab). EditMax's own in-app chat refuses shell commands, so it cannot run this skill: say so and tell the user to connect an agent such as Claude Code. If the EditMax tools are missing or do not answer, render the clip anyway and give the user the file path to drag in.

**1. Choose the route.** Prefer EditMax's own tools when they cover the motion, because the text stays editable in the app:

| wanted | use |
|---|---|
| a title or lower third that fades, slides, pops, types or wipes on | `add_text` / `add_lower_third` + `set_text_animation` |
| a dissolve, push, slide, wipe or iris between two clips | `set_transition` |
| a clip that moves, scales or fades | `set_keyframe`, `set_clip_transform`, `set_clip_fades` |
| anything else: slam, scramble, split-flap, word wheel, cross-out, highlight, path or logo draw, charts, counters, bursts, multi-move sequences, a full intro or outro | render a clip with this skill |

**2. Read the project.** `inspect_timeline`: note the frame size, the frame rate, the tracks, and the time where the motion goes. This engine renders 1920x1080 at 30 frames a second. A 16:9 project of another size scales it cleanly. For a vertical or square project, say plainly that the clip will be letterboxed or must be scaled up and cropped with `set_clip_transform`, and that a native title may serve better.

**3. Render.**

- **Overlay** (sits on top of footage): `bun $E/new.ts <name> --overlay`, modelled on `$E/title.js`. The timeline has `alpha: true` and `sound: "fx"`; the build writes `out-<name>/<name>.mov` (ProRes 4444 with a see-through background). Rules: clear the frame (`X.clearRect`), never fill it; no `grain`, `vignette`, `mesh`, `parallax` or full-frame transitions; put a soft shadow or a plate under type so it reads on any footage; keep type inside the middle 90% of the frame; fade it out at the end.
- **Full-frame** (intro, outro, a card between shots): `bun $E/new.ts <name>`, modelled on `$E/hello.js`; the build writes `out-<name>/<name>.mp4`.
- **Sound** (set `sound:` in the timeline): leave it out for the full soundtrack (an intro or outro standing alone); `"fx"` for only the sounds the moves make (anything that plays over footage, speech or the user's music); `"none"` for silence. Ask which the user wants if the edit already has music.
- Build, fix every `WARNING`, and read stills before going on.

**4. Put the file somewhere that lasts.** EditMax references imported files, it does not copy them. Copy the finished file out of `out-<name>/` to a folder the user keeps (ask once; suggest `~/Movies/Motions/`), and import from there.

**5. Place it without moving the user's cut.** `insert_clip` with a time is a ripple insert: it pushes every later clip on every track. Do not use it for an overlay.

1. `import_media` with the absolute path.
2. Overlay: `add_track` (kind video; a new video track goes on top, so its picture covers the rows below), then `overwrite_edit` with the asset, `source_in` 0, `source_out` the clip length, `timeline_in` the start time and `track` the new track. That touches one track only.
3. Full-frame card at the very start or end: `insert_clip` (appending needs no `at`; an intro at 0 is meant to push the cut right, so tell the user it will).
4. `capture_frame` in the middle of the clip and look: the footage must show around the title. If the background came out black instead of see-through, set `set_blend_mode` to `screen` on the clip (works for light type) and tell the user.
5. If the clip's sound fights the footage, lower it with `set_clip_properties` (`volume`).
6. `set_playhead` to the start of the clip so the user sees it. Say what was added and that Cmd-Z in EditMax removes it.

Every call moves the user's playhead and selection while Follow the agent is on; make only the calls you need, and remove anything you added and did not keep.

## Sound

- **Grid.** Use 150, 120, 100 or 90 bpm only: at 30 fps those put every beat on a whole frame. Start scenes on `G.bar(n)` and hits on `G.beat(n)`. `G.pulse(f)` is 1 on each beat and decays, for backgrounds that breathe with the kick.
- **Sections** (in beats): `intro` (pad, sparse hats), `build` (kick, snare roll, riser), `drop` (kick every beat, clap on 2 and 4, hats, bass, stabs), `break`, `outro` (impact, long chord, bell). The half beat before every drop is silent.
- **Move sounds.** Each move has its own cue list (typing clicks per letter, an impact per slammed word, a whoosh through a transition, a bell when a count lands). `M.cues()` collects them from the clips; `vol:` on a clip scales it, `mute: true` silences it. A thump that lands on a kick gives its bass to the kick.
- **Mix.** Pad and bass duck under each kick, move sounds get a short room, the master is set to -16 LUFS with peaks under -1 dB (measured again on the finished mp4). Everything is synthesised: never add downloaded samples or music.
- **Following the sound.** `sound.py` writes `levels.json` (loudness and 16 bands per frame) before the picture renders; load it in `ready` with `M.levels("out-<name>/levels.json")` and draw `M.eq(ctx, f, o)`.
- **Checking without ears.** `uv run $E/sound.py out-<name> --check` (it remakes the track, then checks it) confirms every kick and impact shows up in the bass within one frame of its scheduled time, that no bass hit is unscheduled, and that loudness and peak are on target. `python3 $E/sync.py <name>` then reads the finished mp4: at every frame listed in the timeline's `sync` (or `cuts`) the picture must change and a bass hit must land within one frame. `out-<name>/spectrum.png` is the picture of the track: read it. These checks measure timing and level, not taste: tell the user nobody has listened yet, and ask them to.

## Brand and assets

- `M.brand` is the one palette and type set the examples read: `accent`, `accentOnDark`, `ink`, `paper`, `plate`, `card`, `muted`, `display` (Archivo), `mono` (JetBrains Mono), `wide` ("expanded", Archivo's wide cut). For the user's own brand call `M.setBrand({ accent: "#...", ink: "#...", display: "TheirFont" })` as the first line of the film script, and add an `@font-face` for their font in the page (font file in the work folder). Ask for their brand kit and follow its rules.
- The user's own art goes in `assets/` in the work folder (create it). Load in `ready` with `M.load({ name: "assets/file.png" })`, draw with `M.image(ctx, name, x, y, w, h, pixel)` (`pixel: true` keeps pixel art crisp) or `M.parallax`. `M.put(name, canvas)` registers something drawn in code. With no art, `M.scenery()` returns sky-and-hills layers for `M.parallax`.
- Logos: never recolour, skew or add effects to a real logo. Draw it on with `logoDraw` (pass the logo's own strokes as `paths`), then show the logo file untouched with `M.image`, after grain and vignette so nothing sits on top of it.
- Copy: plain words, one idea per line. Never invent numbers, results or quotes; use only figures the user gives you.
- Reading time: set `until:` (the frame the text leaves) on every text clip. `lint.py` wants about 0.3 s a word plus 0.4 s, counted from when the move has finished playing (`start + length`) to `until`; `slam` shows one word at a time, each replacing the last, and needs 0.25 s after its last word.
- Text drawn outside a move: use `M.type(ctx, { text, ... })`, not `txt()`, when it needs the wide cut (setting `ctx.font` resets the width).

## Clone a clip in six steps

1. **Intake.** `bun $E/ref.ts <file or url> --name demo` writes `ref/demo/` (frames named by frame number, `sheet.jpg`, `ref.json` with cuts, holds, brightness per frame) and a starter `demo.html` + `demo.js` with the cut table filled in. It takes a local file or a direct link to a video file; for a clip on a social site, the user saves the file first.
2. **Look.** Read `ref/demo/sheet.jpg`, then tile every fifth frame for the fine timing.
3. **Write the scenes** in `demo.js`: one function per cut, built from clips plus the `lib.js` primitives (`txt`, `box`, `label`, `pix`, `chars`, `vignette`, `scan`). Detected cuts are only hard cuts; add your own entries for fades and beats inside a shot. If the source is cut to music, pick the grid tempo whose beat length matches its cut spacing.
4. **Compare.** `bun $E/render.ts --page demo.html --out out-demo --frame 10,40,80`, then `python3 $E/compare.py sheet.jpg 10 40 80 --ref ref/demo --out out-demo` puts source and render side by side. Fix timing first (the `ease` option), then size and position.
5. **Build and check.** `bun $E/build.ts demo` writes `out-demo/demo.mp4`. `python3 $E/check.py demo` lists every frame whose brightness is far from the reference.
6. **Sound.** Give the timeline a `bpm` and sections as above.

## Rules

- Copy timing, layout and motion. Never copy the source's words, logos, brand marks, characters, icons, footage or music: write new copy, draw new art, synthesise new sound, and name the studied source in the script's header comment. If the user asks for the source's own content or branding, say no and offer their own instead.
- Reference clips stay in `ref/`, which must be git-ignored: never commit them, upload them or put them in a film.
- Every frame is a pure function of `f`: no `Math.random`, no clocks. Use `hash`, `hash2`, `noise` from `lib.js`. Fill the whole frame every frame: art with see-through edges lets the previous frame show through. Test: `bun $E/pure.ts <name>`.
- All canvases stay software (`willReadFrequently`).
- A new film is a new page plus one IIFE script that sets `window.TOTAL`, `renderFrame`, `timeline`, `ready`. Do not add top-level `const`s: `lib.js` already owns the global names (`W`, `H`, `X`, `A`, `B`, `L` and more).
- Check stills with the hidden renderer (`bun $E/render.ts ... --frame`) and read the image files. Never capture the user's screen.

## Moves (`moves.js`, `window.MOVES`)

Text moves: `MOVES.name(ctx, t, { text, x, y, size, weight, color, fam, italic, align, stretch, ...options })`, `t` from 0 to 1, `y` is the baseline.
Transitions: `MOVES.name(ctx, t, from, to, options)`; `from` and `to` are a colour, a canvas, or `(ctx) => draw`.
Camera wrappers (`punch`, `shake`, `sweep`): `MOVES.name(ctx, t, draw, options)`. Finish passes: `grain(ctx, f, o)`, `glow(ctx, o)`, `chroma(ctx, o)`, `smear(ctx, f, draw, o)`, `eq(ctx, f, o)`. A draw function draws on the ctx it is given. Wrappers and transitions can be nested.
Every move takes `ease: (t) => t`; match the source's curve with it before changing anything else.
Timing helpers: `at(f, start, len)`, `out`, `expo`, `io`, `back` (overshoot), `spring`, `stagger(t, i, n, overlap)`, `grid(bpm)`.
See and hear them all: `bun $E/build.ts moves` then open `out-moves/moves.mp4` (one bar each, name on screen, each with its own sound).
The last column names the public technique or component demo each move was studied from. Every move is this project's own canvas code and a look-alike, not that site's component.

<!-- moves:start -->
| move | what it does | options | studied from |
|---|---|---|---|
| `letters` | letters rise and fade in one after another, each with a small overshoot | text, rise=0.6, overlap=0.8 | motionvideo: staggered letter reveal |
| `words` | words arrive one at a time, sliding up a little as they fade in | text, rise=0.35, overlap=0.5 | motionvideo: word by word reveal |
| `scramble` | random glyphs flicker in place and lock into the real text from left to right | text, ticks=30, dim | motionvideo: text scramble decode |
| `flap` | departure-board tiles rattle through the alphabet and land on each letter, left to right | text, tile, ink | motionvideo: split-flap text |
| `lineMask` | each line slides up from behind an invisible edge; rule adds an underline that draws in after | lines[] or text, lead=1.05, overlap=0.6, rule | motionvideo: line mask text reveal |
| `slam` | one heavy word per beat; each lands oversized and wide, then snaps to size, with a two-colour sweep | words[], color2, wide=1.3, grow=0.16 | snapcn: slam-type |
| `wheel` | a fixed lead-in while a column of endings rolls past like a wheel; the one on the line is large, the rest small and faint | prefix, words[], row=0.62, dim | snapcn: word-wheel |
| `echo` | the word stays put while fading copies of it slide out above and below | text, copies=3, gap=0.42 | snapcn: echo-stack |
| `crossOut` | two rough brush strokes cross a word out, lift off, and the rest of the line closes the gap | text, strike (word index), ink | snapcn: cross-out |
| `highlight` | a marker bar sweeps in behind some of the words and their ink flips colour | text, from, to (word indexes), bar, ink | snapcn: text-highlight |
| `tracking` | a title fades in while its letters drift apart, like a film opening | text, tight=-0.02, wide=0.3 | motionvideo: tracking expand title |
| `weight` | the same word swells from hairline to heavy (Geist is a variable font, so every weight exists) | text, w0=200, w1=900 | motionvideo: variable font weight animation |
| `ticker` | a number counts up fast and settles; digits sit in fixed slots so the figure does not shake | a, b, decimals=0, prefix, suffix | motionvideo: UI number ticker / snapcn: tally-rise |
| `chart` | a line chart draws itself left to right with a glowing head, a soft fill under it and a guide line at the current level | box [x,y,w,h], points[] (0..1), color | snapcn: ticker-climb |
| `bounce` | a ball drops and bounces along a line, stretching in flight and flattening on each landing, leaving a dot where it hit | x0, x1, ground, r, h, drop (first fall height), bounces=3, decay=0.6, color, line, span [xa, xb] | motionvideo: squash and stretch |
| `flood` | one colour grows from a point until it fills the frame and becomes the next background | x, y, r0 (starting radius) | motionvideo: color flood transition |
| `iris` | the next scene opens through a growing circle | x, y, r0 | motionvideo: iris transition |
| `push` | the next scene shoves the current one out of frame | dir: left | right | up | down | motionvideo: push transition |
| `dotBloom` | white dots pop up at random on a brightening field, take on the next scene's colours and swell until they are the picture | cell=40, paper | snapcn: dot-bloom |
| `dotDissolve` | the next scene seeps in as cloud-shaped patches of halftone dots that spread until the frame is full | cell=24, back | snapcn: dot-dissolve |
| `pixelPeak` | the next scene rises from the bottom edge as a blocky mountain with a coloured rim until it covers the frame | cell=60, at (0..1 peak position), edge | snapcn: pixel-peak |
| `typewriter` | characters appear one at a time behind a cursor; the newest one is still faint | text, cursor (colour), keep (cursor stays) | motionvideo: typewriter text / snapcn: word-flip |
| `swap` | a fixed lead-in while the last word is replaced: each new word rolls up into the slot as the old one leaves | prefix, words[], color2 | motionvideo: rotating word swap |
| `outline` | letters first draw themselves as thin outlines, then fill with solid colour | text, line (outline width) | motionvideo: outline to fill text |
| `punchWord` | a headline starts far too big and slams down to size in a few frames | text, from=2.6 | motionvideo: scale punch headline |
| `caption` | a boxed caption pops in near the bottom; words light up one by one as they are said | text, box, dim, hot | snapcn: karaoke-captions |
| `pathDraw` | a line draws itself along any SVG path, with an optional dot riding the tip | d (SVG path), width, color, head (dot colour), keepHead, at [x, y], scale | motionvideo: path draw-on |
| `burst` | short lines shoot out from a point and thin away, for an impact or a reveal | x, y, n=14, r0, r1, color, width | motionvideo: radial burst |
| `logoDraw` | a logo draws itself stroke by stroke from its SVG paths; show the real logo file after it with MOVES.image | paths[] (SVG path strings), box=64 (the size the paths are drawn in), x, y, size, color, width | snapcn: logo-assemble (idea only) |
| `callout` | a dot marks a point, a leader line draws out from it and a short label appears at the end | x, y, tx, ty, text, color, size | motionvideo: annotation callout |
| `bars` | bars grow from the baseline one after another, then all but one fade to grey and that one takes the accent colour | values[] (0..1), pick (index), box [x,y,w,h], color, accent, grey | motionvideo: highlight one bar |
| `punch` | the whole picture jumps closer on a beat | zoom=1.2, x, y (centre of the zoom) | motionvideo: punch in |
| `shake` | the frame jitters hard after an impact and settles within a few frames | amp=26, frames=12, seed | motionvideo: camera shake |
| `parallax` | stacked picture layers slide at different speeds so a flat scene gains depth; near layers move most | layers [{ img, depth 0..1, pixel }], pan=160, zoom=0.06, y, h (fill the frame first: art with see-through edges lets the last frame show) | motionvideo: parallax layers |
| `glitchCut` | for a few frames the picture tears into shifted strips with colour bars, then the next scene is there | steps=6, color | motionvideo: glitch cut |
| `wipe` | a slanted edge with a thin accent line crosses the frame and leaves the next scene behind it | slant=220, color, width | motionvideo: wipe transition |
| `zoomThrough` | the camera dives through the current scene, which swells and fades, into the next one arriving from small | x, y | motionvideo: zoom-through transition |
| `grain` | fine noise over the finished frame so flat colour looks printed and gradients do not band; call as grain(ctx, f, o) | amount=0.1, size=2 | motionvideo: film grain |
| `glow` | bright parts of the finished frame bleed soft light around themselves; call as glow(ctx, o) | radius=24, strength=0.5 | motionvideo: glow and bloom |
| `sweep` | a band of light slides across whatever was drawn (type or a shape) and only shows on it | draw (ctx) => {}, width=260, color, strength=0.7 | motionvideo: light sweep |
| `mesh` | soft colour points drift slowly under the scene and blend into a moving field of colour | colors[] (first is the base), speed=1 | motionvideo: mesh gradient |
| `chroma` | red and blue slip sideways off the picture for a frame or two, like a cheap lens under stress; call as chroma(ctx, o) | amount=8 (pixels) | motionvideo: chromatic aberration |
| `smear` | fast things streak: the scene is drawn at several moments inside one frame and averaged; call as smear(ctx, f, draw, o) with draw = (ctx, frame) => {} | samples=5, shutter=0.6 (of a frame) | motionvideo: motion blur |
| `eq` | bars that follow the film's own soundtrack, read from the levels sound.py writes; call as eq(ctx, f, o) | box [x,y,w,h], color, bands=16 | motionvideo: frequency bars |
<!-- moves:end -->

## Add a move

1. Watch the preview: `bun $E/ref.ts <preview url> --name <move>` and read the sheet.
2. Add `def("name", "site: source name", "what it does", "options", (c, t, o) => { ... })` in `$E/moves.js` (this one does change the engine; tell the user). Write it from what you see; do not paste the source's component code. Add its sound to the `CUE` table and, if it is not a plain text move, its call shape to `SIG`.
3. Add a demo line in `$E/moves-demo.js`, run `bun $E/index.ts` to refresh the table above, then `bun $E/build.ts moves`.
