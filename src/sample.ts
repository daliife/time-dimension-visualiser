import type { Volume } from './volume';

const FRAME_WIDTH = 256;
const FRAME_COUNT = 40;

export async function loadClipVolume(
  url: string,
  onProgress?: (done: number, total: number) => void,
): Promise<Volume> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  await waitFor(video, 'loadeddata');

  const width = FRAME_WIDTH;
  const height = Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth);
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

function waitFor(video: HTMLVideoElement, event: 'loadeddata'): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(event, onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Could not load the clip'));
    };
    video.addEventListener(event, onReady);
    video.addEventListener('error', onError);
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
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
