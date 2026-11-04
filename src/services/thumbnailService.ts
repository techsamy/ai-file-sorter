export interface ThumbnailResult {
  blob: Blob;
  thumbUrl: string;
  sprite: HTMLCanvasElement;
}

const THUMB_SIZE = 256;
const SPRITE_SIZE = 64;

/**
 * Creates a thumbnail and small sprite canvas from an image file.
 */
export async function makeImageThumbnail(file: File): Promise<ThumbnailResult> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // 1. Full thumbnail canvas (256x256 crop-center)
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext('2d')!;

  const minSide = Math.min(width, height);
  const sx = (width - minSide) / 2;
  const sy = (height - minSide) / 2;
  ctx.drawImage(bitmap, sx, sy, minSide, minSide, 0, 0, THUMB_SIZE, THUMB_SIZE);

  // 2. Small sprite canvas (64x64 for particle vortex)
  const sprite = document.createElement('canvas');
  sprite.width = SPRITE_SIZE;
  sprite.height = SPRITE_SIZE;
  const sCtx = sprite.getContext('2d')!;
  sCtx.drawImage(canvas, 0, 0, SPRITE_SIZE, SPRITE_SIZE);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.85)
  );
  const thumbUrl = URL.createObjectURL(blob);

  bitmap.close();
  return { blob, thumbUrl, sprite };
}

/**
 * Extracts a keyframe thumbnail from a video file without UI lag.
 */
export async function makeVideoThumbnail(file: File): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = () => {
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Video thumbnail timeout'));
      }
    }, 8000);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : 3;
      video.currentTime = Math.min(1.2, duration / 3);
    };

    video.onseeked = async () => {
      if (resolved) return;
      resolved = true;

      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) throw new Error('Video has no frame');

        const canvas = document.createElement('canvas');
        canvas.width = THUMB_SIZE;
        canvas.height = THUMB_SIZE;
        const ctx = canvas.getContext('2d')!;

        const minSide = Math.min(vw, vh);
        const sx = (vw - minSide) / 2;
        const sy = (vh - minSide) / 2;
        ctx.drawImage(video, sx, sy, minSide, minSide, 0, 0, THUMB_SIZE, THUMB_SIZE);

        const sprite = document.createElement('canvas');
        sprite.width = SPRITE_SIZE;
        sprite.height = SPRITE_SIZE;
        const sCtx = sprite.getContext('2d')!;
        sCtx.drawImage(canvas, 0, 0, SPRITE_SIZE, SPRITE_SIZE);

        const blob = await new Promise<Blob>((res) =>
          canvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.85)
        );
        const thumbUrl = URL.createObjectURL(blob);

        cleanup();
        resolve({ blob, thumbUrl, sprite });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = (e) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Failed to load video file'));
      }
    };

    video.src = url;
  });
}

/**
 * Generates a colorful file icon sprite for non-media files (PDF, Code, Zip, etc.).
 */
export function makeFileSprite(ext: string, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Rounded file background
  ctx.fillStyle = '#1e2230';
  ctx.beginPath();
  ctx.roundRect(4, 4, SPRITE_SIZE - 8, SPRITE_SIZE - 8, 8);
  ctx.fill();

  // Color border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Extension label
  ctx.fillStyle = color;
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ext.slice(0, 4).toUpperCase(), SPRITE_SIZE / 2, SPRITE_SIZE / 2);

  return canvas;
}

