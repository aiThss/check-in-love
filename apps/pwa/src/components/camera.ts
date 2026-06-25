export interface CameraResult {
  file: File;
  preview: string;
}
import { logger } from '../utils/logger';

export interface ImageProcessOptions {
  aspectRatio?: number;
  maxSize?: number;
  quality?: number;
}

/**
 * Checks if the current PWA is running inside the Android wrapper WebView.
 */
export function isAndroidApp(): boolean {
  return navigator.userAgent.includes('LoveCheckAndroidWrapper');
}

function createFileInput(accept: string, capture?: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = false;
  if (capture) {
    input.setAttribute('capture', capture);
  }
  input.style.cssText =
    'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px;top:-9999px;';
  document.body.appendChild(input);
  return input;
}

function targetSize(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number | undefined,
  maxSize: number,
): { width: number; height: number } {
  if (!aspectRatio) {
    const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    return {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
    };
  }

  if (aspectRatio >= 1) {
    return {
      width: maxSize,
      height: Math.round(maxSize / aspectRatio),
    };
  }

  return {
    width: Math.round(maxSize * aspectRatio),
    height: maxSize,
  };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
): void {
  const sourceRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (sourceRatio > targetRatio) {
    sw = Math.round(img.naturalHeight * targetRatio);
    sx = Math.round((img.naturalWidth - sw) / 2);
  } else {
    sh = Math.round(img.naturalWidth / targetRatio);
    sy = Math.round((img.naturalHeight - sh) / 2);
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
}

export async function processImage(
  file: File,
  options: ImageProcessOptions = {},
): Promise<CameraResult> {
  const {
    aspectRatio,
    maxSize = 1440,
    quality = 0.9,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const sourceUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(sourceUrl);

      const { width, height } = targetSize(
        img.naturalWidth,
        img.naturalHeight,
        aspectRatio,
        maxSize,
      );

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      drawCover(ctx, img, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to process image'));
            return;
          }

          const name = file.name.replace(/\.[^.]+$/, '') || 'checkin-photo';
          const processedFile = new File([blob], `${name}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve({
            file: processedFile,
            preview: URL.createObjectURL(blob),
          });
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = sourceUrl;
  });
}

export function revokePreviewUrl(preview?: string | null): void {
  if (preview?.startsWith('blob:')) {
    URL.revokeObjectURL(preview);
  }
}

async function handleFileSelection(
  input: HTMLInputElement,
  onResult: (result: CameraResult) => void,
  isCamera = false,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    // Track whether Android already popped the dummy state so cleanup doesn't double-back
    let dummyStatePopped = false;

    const cleanup = () => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
      // Pop the dummy history state only if Android hasn't already done so
      if (isCamera && !dummyStatePopped && (history.state as Record<string, unknown>)?.cameraOpen) {
        dummyStatePopped = true;
        history.back();
      }
    };

    const settle = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve();
      }
    };

    // On Android WebView, push a dummy history entry so when the native camera
    // activity closes and Android triggers onBackPressed → webView.goBack(),
    // it consumes this dummy entry instead of popping the real SPA route.
    if (isCamera && isAndroidApp()) {
      history.pushState({ cameraOpen: true }, '');

      // When Android pops the dummy state (camera close), just mark it as popped.
      // Do NOT resolve here — wait for input.onchange to deliver the file.
      const onPop = () => {
        window.removeEventListener('popstate', onPop);
        dummyStatePopped = true;
        // If camera was cancelled (no file will come), resolve after a short grace period
        // to give onchange/oncancel a chance to fire first.
        setTimeout(() => {
          if (!settled) settle();
        }, 300);
      };
      window.addEventListener('popstate', onPop);
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      input.value = '';

      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }

      if (!file) {
        if (!settled) { settled = true; resolve(); }
        return;
      }

      settled = true;

      // For camera captures, skip pre-processing here and return the raw file
      // directly — the caller (applyPhotoTransform) will do the single processing
      // pass with correct aspect-ratio / quality params.
      // Full-resolution camera shots (12–48 MP) are very slow to process twice.
      if (isCamera) {
        onResult({ file, preview: URL.createObjectURL(file) });
        resolve();
        return;
      }

      // Gallery / non-camera: pre-process to a reasonable size
      try {
        onResult(await processImage(file));
      } catch {
        onResult({
          file,
          preview: URL.createObjectURL(file),
        });
      } finally {
        resolve();
      }
    };

    input.oncancel = () => {
      settle();
    };

    input.click();
  });
}

function openCameraCapture(onResult: (result: CameraResult) => void): void {
  const input = createFileInput('image/*', 'environment');
  void handleFileSelection(input, onResult, true);
}

/**
 * Fallback Web Camera using getUserMedia streaming into an overlay video player.
 */
async function openCameraStream(onResult: (result: CameraResult) => void): Promise<void> {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `;

  const video = document.createElement('video');
  video.autoplay = true;
  video.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
  // Required attribute flags for iOS Safari
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  overlay.appendChild(video);

  const controls = document.createElement('div');
  controls.style.cssText = `
    position: absolute;
    bottom: max(40px, calc(40px + var(--safe-bottom)));
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 80%;
    max-width: 400px;
    z-index: 10000;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.type = 'button';
  closeBtn.style.cssText = `
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.25);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #fff;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  controls.appendChild(closeBtn);

  const captureBtn = document.createElement('button');
  captureBtn.type = 'button';
  captureBtn.style.cssText = `
    width: 76px;
    height: 76px;
    border-radius: 50%;
    border: 5px solid #fff;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  const innerCircle = document.createElement('div');
  innerCircle.style.cssText = 'width: 56px; height: 56px; border-radius: 50%; background: #fff;';
  captureBtn.appendChild(innerCircle);
  controls.appendChild(captureBtn);

  // Balance layout placeholder
  const placeholder = document.createElement('div');
  placeholder.style.width = '50px';
  controls.appendChild(placeholder);

  overlay.appendChild(controls);
  document.body.appendChild(overlay);

  let localStream: MediaStream | null = null;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1080 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    video.srcObject = localStream;
  } catch (err) {
    logger.warn('[camera] getUserMedia failed, falling back to file capture', err);
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    openCameraCapture(onResult);
    return;
  }

  const stopStream = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  };

  closeBtn.addEventListener('click', stopStream);

  captureBtn.addEventListener('click', async () => {
    if (!video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
            try {
              onResult(await processImage(file));
            } catch {
              onResult({
                file,
                preview: URL.createObjectURL(file),
              });
            }
          }
          stopStream();
        },
        'image/jpeg',
        0.88,
      );
    } else {
      stopStream();
    }
  });
}

/**
 * Open device camera. If forceStream is true (not on Android app), falls back to getUserMedia web stream.
 */
export function openCamera(onResult: (result: CameraResult) => void, forceStream = false): void {
  if (forceStream && !isAndroidApp() && typeof navigator.mediaDevices?.getUserMedia === 'function') {
    void openCameraStream(onResult);
  } else {
    openCameraCapture(onResult);
  }
}

export function openGallery(onResult: (result: CameraResult) => void): void {
  const input = createFileInput('image/*');
  void handleFileSelection(input, onResult);
}
