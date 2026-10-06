# time-dimension-visualiser

Explore a short video as a **3D stack of frames**. Scrub time, play through the sequence, and orbit the cube to see **pixel motion trails** through time.

Built with **Vite**, **TypeScript**, and **Three.js** (custom shaders). Each visit samples **72 frames** from a ~4 s clip and uploads them as a 3D texture. Clips are **H.264 `.mp4`** (fast-start) so mobile Safari can decode them on GitHub Pages.

**Live demo:** https://daliife.github.io/time-dimension-visualiser/

## Sample clips

Three **real-time** Mixkit samples (no timelapse). Choose one in **Clip** or with `?clip=`:

| `?clip=` | Source |
| --- | --- |
| `dribble` (default) | [Player dribbling basketball](https://mixkit.co/free-stock-video/player-dribbling-basketball-2282/) |
| `kick` | [Football player kicking the ball](https://mixkit.co/free-stock-video/football-player-kicking-the-ball-2267/) |
| `hurdles` | [Athlete jumping hurdles](https://mixkit.co/free-stock-video/athlete-jumping-hurdles-on-a-sunny-day-586/) |

Video files live in `public/` as `{id}.mp4`. See [Mixkit’s license](https://mixkit.co/license/) for stock footage terms.

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
| **Controls** (mobile) | Opens the panel; on small screens it starts collapsed. |
| `Space` | Play or pause (ignored when focus is on a button, input, or select). |
| `Home` | Same as **Reset view**. |
