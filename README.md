# Loop

A small, beautiful focus timer built to test a UI direction before committing it to a much larger product.

Carbon glass surface, a tick-bezel dial, dot-matrix time, and a draggable ruler to set session length. Pomodoro at its core, with tasks, stats, streaks, and a distraction-free zen mode.

**Live site:** https://tala1121.github.io/loop/

## One app, four skins

The same focus timer rebuilt in four completely different design languages — same engine, same features, zero shared pixels:

| Theme | Live | The vibe |
|---|---|---|
| **Carbon** (original) | [/loop/](https://tala1121.github.io/loop/) | Dark carbon glass, tick-bezel dial, dot-matrix time |
| **Retro** | [/loop/retro/](https://tala1121.github.io/loop/retro/) | Vintage broadcast: split-flap clock, VU-meter needle, radio tuning dial, woody ticks |
| **Glass** | [/loop/glass/](https://tala1121.github.io/loop/glass/) | Liquid glass: frosted lens, time floating on a rising tide with live waves, droplet slider, glass chimes |
| **Funk** | [/loop/funk/](https://tala1121.github.io/loop/funk/) | Psychedelic turntable: spinning vinyl, orbiting eyeball progress, checkerboard floor, wah chimes |

## Why this exists

I had a UI vision I wanted for a bigger main product, but I did not want to gamble the big build on a look I had only seen in my head. So I built a tiny, self-contained app first, a focus timer, purely to feel the interaction in my hands. Real motion, real spacing, real weight of the glass, real drag on the ruler. Once it felt right here, I know it will translate.

## Features

- Focus, short break, and long break modes, each with its own accent
- Draggable ruler to set session length
- Task list with per-task session estimates that fill as you focus
- Stats: focused today, sessions, all-time hours, day streak, and a 7 day chart
- Zen mode for a clean, single-purpose screen
- Ticks and session chimes, auto-start option, all state saved locally

## Run it

Open `index.html` in a browser, or open the single-file build `loop.html` on its own. No build step, no dependencies.

## Files

- `index.html`, `styles.css`, `app.js` — the split build
- `loop.html` — the whole app in one file

## Built with

Vanilla HTML, CSS, and JavaScript. Designed and built in a fast, iterative loop with Claude.
