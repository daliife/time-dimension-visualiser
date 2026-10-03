import type { Volume } from './volume';

const FRAME_WIDTH = 256;
const FRAME_COUNT = 72;
const LOAD_TIMEOUT_MS = 90_000;
const SEEK_TIMEOUT_MS = 12_000;

export async function loadClipVolume(
  url: string,
  onProgress?: (done: number, total: number) => void,
): Promise<Volume> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';
  video.src = url;
  video.load();

  await waitForMediaReady(video);
  await primeVideoForScrubbing(video);

  const width = FRAME_WIDTH;
  const height = Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth);
  if (!Number.isFinite(height) || height < 1 || !Number.isFinite(video.duration)) {
    throw new Error('Could not read the clip dimensions');
  }

  const frames = FRAME_COUNT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create a 2D canvas');

  const data = new Uint8Array(width * height * frames * 4);
  const stride = width * height * 4;
  const lastTime = Math.max(0, video.duration - 0.05);

  onProgress?.(0, frames);
  for (let frame = 0; frame < frames; frame++) {
    const time = (frame / (frames - 1)) * lastTime;
    await seekTo(video, time);
    ctx.drawImage(video, 0, 0, width, height);
    data.set(ctx.getImageData(0, 0, width, height).data, frame * stride);
    onProgress?.(frame + 1, frames);
  }

  video.removeAttribute('src');
  video.load();
  return { width, height, frames, data };
}

async function primeVideoForScrubbing(video: HTMLVideoElement): Promise<void> {
  try {
    await video.play();
    video.pause();
    video.currentTime = 0;
    await seekTo(video, 0);
  } catch {
    // iOS may block play() without a gesture; seeking often still works once metadata is ready.
  }
}

function waitForMediaReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video took too long to load. Try Wi‑Fi or refresh the page.'));
    }, LOAD_TIMEOUT_MS);

    const tryResolve = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', tryResolve);
      video.removeEventListener('canplay', tryResolve);
      video.removeEventListener('error', onError);
    };

    const onError = () => {
      cleanup();
      const detail = video.error?.code ? ` (error ${video.error.code})` : '';
      reject(new Error(`Could not load the clip${detail}`));
    };

    video.addEventListener('loadeddata', tryResolve);
    video.addEventListener('canplay', tryResolve);
    video.addEventListener('error', onError);
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Could not seek the clip (timed out)'));
    }, SEEK_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Could not seek the clip'));
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}
