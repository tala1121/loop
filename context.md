# Loop — Context

**Folder:** `vibecoding/folcus pusle`
**Type:** Web app — focus / Pomodoro timer
**Status:** Shipped — live on GitHub Pages
**Live:** https://tala1121.github.io/loop/
**Built with:** Claude

## What it is
A small, polished focus timer built to prove out a UI direction (carbon-glass surface, tick-bezel dial, dot-matrix time, draggable ruler to set session length) before committing that look to a larger product. Pomodoro at its core, plus tasks, stats, streaks, and a distraction-free zen mode.

## Why it exists
A deliberate UI prototype: build a tiny self-contained app first to feel the real motion, spacing, and interaction weight before gambling a bigger build on an unproven look.

## Features
- Focus / short break / long break modes, each with its own accent
- Draggable ruler to set session length
- Task list with per-task session estimates
- Stats: focused today, sessions, all-time hours, day streak, 7-day chart
- Zen mode, tick/chime sounds, auto-start, local state persistence

## Stack
- Vanilla HTML / CSS / JS — no build step, no dependencies

## Key files
- `index.html` — the app
- `loop.html` — single-file build (open standalone)
- `app.js`, `styles.css`
- `README.md` — original project readme
- `.git/` — version control

## How to run
Open `index.html` (or `loop.html`) in a browser.
