import './style.css';
import { loadClipVolume } from './sample';
import { createScene } from './scene';

const view = document.querySelector<HTMLElement>('#view');
const status = document.querySelector<HTMLElement>('#status');
const panel = document.querySelector<HTMLElement>('#panel');
if (!view || !status || !panel) throw new Error('Missing page elements');

const FRAME_MS = 100;

try {
  const volume = await loadClipVolume(`${import.meta.env.BASE_URL}clip.m4v`);
  const scene = createScene(view, volume);

  function required<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  }

  const playButton = required<HTMLButtonElement>('#play');
  const timeInput = required<HTMLInputElement>('#time');
  const timeValue = required<HTMLElement>('#time-value');
  const gapInput = required<HTMLInputElement>('#gap');

  let frame = 0;
  let playing = false;
  let accumulator = 0;
  let lastTick = performance.now();

  timeInput.max = String(scene.frameCount - 1);

  function showFrame(index: number) {
    frame = (index + scene.frameCount) % scene.frameCount;
    timeInput.value = String(frame);
    timeValue.textContent = String(frame);
    scene.setFrame(frame);
  }

  function setPlaying(next: boolean) {
    playing = next;
    playButton.textContent = playing ? 'Pause' : 'Play';
    playButton.setAttribute('aria-pressed', String(playing));
    accumulator = 0;
    lastTick = performance.now();
  }

  showFrame(0);
  setPlaying(false);

  playButton.addEventListener('click', () => setPlaying(!playing));

  timeInput.addEventListener('input', () => {
    accumulator = 0;
    showFrame(Number(timeInput.value));
  });

  gapInput.addEventListener('input', () => {
    scene.setGap(Number(gapInput.value) / 100);
  });

  window.addEventListener('resize', () => scene.resize());

  function tick(now: number) {
    if (playing) {
      accumulator += now - lastTick;
      while (accumulator >= FRAME_MS) {
        accumulator -= FRAME_MS;
        showFrame(frame + 1);
      }
    }
    lastTick = now;
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  status.hidden = true;
  panel.hidden = false;
} catch (error) {
  status.textContent = error instanceof Error ? error.message : 'Could not load the clip';
}
