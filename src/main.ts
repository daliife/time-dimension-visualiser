import './style.css';
import { CLIPS, resolveClipId } from './clips';
import { loadClipVolume } from './sample';
import { createScene } from './scene';

const view = document.querySelector<HTMLElement>('#view');
const status = document.querySelector<HTMLElement>('#status');
const statusTitle = document.querySelector<HTMLElement>('#status-title');
const statusDetail = document.querySelector<HTMLElement>('#status-detail');
const panel = document.querySelector<HTMLElement>('#panel');
const demoHeader = document.querySelector<HTMLElement>('#demo-header');
if (!view || !status || !statusTitle || !statusDetail || !panel || !demoHeader) {
  throw new Error('Missing page elements');
}

const FRAME_MS = 100;
/** Bump when clip files change so browsers refetch video assets. */
const CLIP_CACHE_VERSION = 6;

try {
  const clip = resolveClipId(new URLSearchParams(location.search).get('clip'));
  const clipUrl = `${import.meta.env.BASE_URL}${clip}.mp4?v=${CLIP_CACHE_VERSION}`;
  statusDetail.textContent = 'Loading video…';
  const volume = await loadClipVolume(clipUrl, (done, total) => {
    statusDetail.textContent =
      done === 0 ? `Preparing ${total} frames…` : `Frame ${done} of ${total}`;
  });
  const scene = createScene(view, volume);

  function required<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  }

  const playButton = required<HTMLButtonElement>('#play');
  const resetViewButton = required<HTMLButtonElement>('#reset-view');
  const playLabel = required<HTMLElement>('#play-label');
  const playIcon = required<HTMLElement>('#icon-play');
  const pauseIcon = required<HTMLElement>('#icon-pause');
  const timeInput = required<HTMLInputElement>('#time');
  const timeValue = required<HTMLElement>('#time-value');
  const gapInput = required<HTMLInputElement>('#gap');
  const gapValue = required<HTMLElement>('#gap-value');
  const clipSelect = required<HTMLSelectElement>('#clip');
  const announcer = required<HTMLElement>('#announcer');

  for (const entry of CLIPS) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    clipSelect.append(option);
  }
  clipSelect.value = clip;

  let frame = 0;
  let playing = false;
  let accumulator = 0;
  let lastTick = performance.now();

  const lastFrame = scene.frameCount - 1;
  timeInput.max = String(lastFrame);

  function frameSummary(index: number) {
    return `Frame ${index + 1} of ${scene.frameCount}`;
  }

  function syncTimeControl(index: number) {
    timeInput.value = String(index);
    timeInput.setAttribute('aria-valuetext', frameSummary(index));
    timeValue.textContent = `${index} / ${lastFrame}`;
  }

  function syncGapControl() {
    const amount = Number(gapInput.value);
    gapValue.textContent = `${amount}%`;
    gapInput.setAttribute('aria-valuetext', `Gap ${amount} percent`);
  }

  function announce(message: string) {
    announcer.textContent = message;
  }

  function showFrame(index: number) {
    frame = (index + scene.frameCount) % scene.frameCount;
    syncTimeControl(frame);
    scene.setFrame(frame);
  }

  function setPlaying(next: boolean) {
    playing = next;
    const label = playing ? 'Pause' : 'Play';
    playLabel.textContent = label;
    playButton.setAttribute('aria-pressed', String(playing));
    playIcon.toggleAttribute('hidden', playing);
    pauseIcon.toggleAttribute('hidden', !playing);
    accumulator = 0;
    lastTick = performance.now();
  }

  function shouldIgnoreGlobalShortcuts(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      tag === 'BUTTON' ||
      target.isContentEditable
    );
  }

  const initialFrame = Math.round((scene.frameCount - 1) / 2);
  showFrame(initialFrame);
  setPlaying(false);
  syncGapControl();

  playButton.addEventListener('click', () => {
    setPlaying(!playing);
    announce(playing ? 'Playing' : 'Paused');
  });
  resetViewButton.addEventListener('click', () => {
    scene.resetView();
    announce('Camera reset to default view');
  });

  timeInput.addEventListener('input', () => {
    accumulator = 0;
    showFrame(Number(timeInput.value));
  });

  gapInput.addEventListener('input', () => {
    syncGapControl();
    scene.setGap(Number(gapInput.value) / 100);
  });

  clipSelect.addEventListener('change', () => {
    const params = new URLSearchParams(location.search);
    params.set('clip', clipSelect.value);
    location.search = params.toString();
  });

  window.addEventListener('keydown', (event) => {
    if (shouldIgnoreGlobalShortcuts(event.target)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      setPlaying(!playing);
      announce(playing ? 'Playing' : 'Paused');
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      scene.resetView();
      announce('Camera reset to default view');
    }
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

  panel.hidden = false;
  demoHeader.hidden = false;
  status.classList.add('is-exiting');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('is-loaded');
    });
  });
  window.setTimeout(() => {
    status.hidden = true;
    status.classList.remove('is-exiting');
  }, 480);
} catch (error) {
  status.classList.add('is-error');
  statusTitle.textContent = 'Could not load';
  statusDetail.textContent = error instanceof Error ? error.message : 'Could not load the clip';
}
