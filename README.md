# time-dimension-visualiser

A WebGL view of a short clip as a stack of frames. Time runs left to right, and playback lights the current frame.

Each load samples **72 frames** from a ~4 s clip. Default: [Player dribbling basketball](https://mixkit.co/free-stock-video/player-dribbling-basketball-2282/) (`dribble.mp4`, Mixkit Stock Video Free License). Clips use `.mp4` so mobile Safari can decode them on GitHub Pages.

Three real-time samples (no timelapse). Pick one in the **Clip** menu or with `?clip=`:

| `?clip=` | Source |
| --- | --- |
| `dribble` (default) | [Player dribbling basketball](https://mixkit.co/free-stock-video/player-dribbling-basketball-2282/) |
| `kick` | [Football player kicking the ball](https://mixkit.co/free-stock-video/football-player-kicking-the-ball-2267/) |
| `skate` | [Boy skating in a park](https://mixkit.co/free-stock-video/boy-skating-in-a-park-on-a-sunny-day-34388/) |

`public/example.mp4` is the 9gag reference.

```bash
corepack enable
pnpm install
pnpm dev
```

GitHub Pages: https://daliife.github.io/time-dimension-visualiser/

## Controls

| Control | Action |
| --- | --- |
| Scene | Drag to rotate, scroll to zoom. |
| **Clip** | Chooses the sample video (reloads with 72 frames). |
| **Time** | Highlight a frame (`index / last` beside the slider). |
| **Gap** | Space between frames in the cube (`%` beside the slider). |
| **Play / Pause** | Auto-advance frames. |
| **Reset view** | Default camera angle. |
| `Space` | Play or pause (not while dragging a slider). |
| `Home` | Same as **Reset view** (keyboard only). |
