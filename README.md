# time-dimension-visualiser

A small, **didactic** WebGL demo: take a short clip, stack its frames in space, and explore how **each pixel moves through time**.

**Live demo:** https://daliife.github.io/time-dimension-visualiser/

## Inspiration

This project is a hands-on follow-up to the idea popularised on 9GAG as [Bradley Tangonan’s “visualization of the fourth dimension”](https://9gag.com/gag/aO8625D): treat a video not as a flat sequence, but as a **3D block of data** where **time is a spatial axis** next to width and height.

The same mental model appears in research and art tools under names like **video cubism** or **spacetime volumes**—see [Fels & Witkin, *Interactive Video Cubism* (2000)](https://hci.rwth-aachen.de/publications/fels2000a.pdf) and Matt Bierner’s [cube.gif](https://mattbierner.github.io/cube-gif/) write-up. This repo is a stripped-down, browser-only version you can rotate and scrub without a lab setup.

## What you are looking at (plain language)

1. **Sampling** — On load, the app grabs **72 frames** from a ~4 s clip and stores them as a 3D texture: `(x, y)` is position in the image, and the third axis is **frame index** (time).
2. **The cube** — The outer shell shows **slices** through that volume (edges of the stack). Side faces reveal how a row or column of pixels evolves frame by frame—those smeared bands are **motion trails**.
3. **The bright sheet** — The opaque plane is the **current time**: one full frame at the moment you chose on the **Time** slider (or during **Play**).
4. **Ghost sheets** — Fainter planes are other frames, separated along time so you can compare positions. **Gap** controls how far apart they sit (and adds a little depth); turn it up to read individual pixel paths more easily.
5. **Normal playback** — Watching the flat video is like cutting the block with a plane that moves forward one frame at a time. Orbiting the cube is like changing the angle of that cut.

```text
     time  ──────────────────────────────►
            frame 0    frame 1    …    frame N
            ┌─────┐   ┌─────┐         ┌─────┐
    image   │     │   │     │   …     │     │   ← stack of 2D frames
    (y)     └─────┘   └─────┘         └─────┘
```

**Suggested first visit:** **Reset view** → raise **Gap** to ~60% → drag to rotate slowly → scrub **Time** or press **Play** on the **hurdles** clip (clear body motion).

## Tech notes

Built with **Vite**, **TypeScript**, and **Three.js** (custom GLSL). Clips are **H.264 `.mp4`** with fast-start so mobile Safari can decode them on GitHub Pages. Texture filtering uses **nearest** sampling so pixels stay sharp when you zoom in.

## Sample clips

Three **real-time** Mixkit samples (no timelapse). Choose one in **Clip** or with `?clip=`:

| `?clip=` | Source |
| --- | --- |
| `dribble` (default) | [Player dribbling basketball](https://mixkit.co/free-stock-video/player-dribbling-basketball-2282/) |
| `kick` | [Football player kicking the ball](https://mixkit.co/free-stock-video/football-player-kicking-the-ball-2267/) |
| `hurdles` | [Athlete jumping hurdles](https://mixkit.co/free-stock-video/athlete-jumping-hurdles-on-a-sunny-day-586/) |

Files live in `public/` as `{id}.mp4`. See [Mixkit’s license](https://mixkit.co/license/) for stock footage terms.

## Local development

Requires **Node ≥ 22** and **pnpm ≥ 12**.

```bash
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:4321/time-dimension-visualiser/ (Vite `base` matches GitHub Pages).

```bash
pnpm run build    # typecheck + production bundle
pnpm preview      # serve dist on port 4321
```

Pushes to `main` deploy via GitHub Actions (`.github/workflows/deploy.yml`).

## Controls

| Control | Action |
| --- | --- |
| Scene | Drag to rotate, scroll to zoom. |
| **Clip** | Sample video (reloads the page with 72 new frames). |
| **Time** | Highlight a frame (`index / last` beside the slider). |
| **Gap** | Spreads frames in space and depth (default **42%**); higher values separate layers for clearer trails. |
| **Play / Pause** | Auto-advance frames (~10 fps). |
| **Reset view** | Default camera (elevated angle for reading motion). |
| **About** (header) | Opens a dialog with how to read the cube and keyboard shortcuts. |
| **Controls** (mobile) | Opens the panel; on small screens it starts collapsed. |
| `Space` | Play or pause (ignored when focus is on a button, input, or select). |
| `Home` | Same as **Reset view**. |

## Further reading

- [9GAG — Bradley Tangonan’s fourth-dimension visualization](https://9gag.com/gag/aO8625D) (popular reference for this stack-of-frames view)
- [Interactive Video Cubism (PDF)](https://hci.rwth-aachen.de/publications/fels2000a.pdf) — early academic treatment of the video volume and slicing planes
- [cube.gif — encoding animation time as a spatial dimension](https://mattbierner.github.io/cube-gif/)
