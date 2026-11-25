import '../styles/20-pages/camera.css';
import { logger } from '../utils/logger';
import { iconMarkup } from '../ui/icons/icons';
import { triggerHaptic } from '../ui/haptics';

export interface CameraResult {
  file: File;
  preview: string;
}

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

const ANDROID_CAMERA_CANCEL_GRACE_MS = 2000;

async function handleFileSelection(
  input: HTMLInputElement,
  onResult: (result: CameraResult) => void,
  isCamera = false,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let dummyStatePopped = false;
    let cancelFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const androidCamera = isCamera && isAndroidApp();

    const clearCancelFallback = () => {
      if (cancelFallbackTimer !== null) {
        clearTimeout(cancelFallbackTimer);
        cancelFallbackTimer = null;
      }
    };

    const cleanup = () => {
      clearCancelFallback();

      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }

      if (
        androidCamera
        && !dummyStatePopped
        && (history.state as Record<string, unknown>)?.cameraOpen
      ) {
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

    if (androidCamera) {
      history.pushState({ cameraOpen: true }, '');

      const onPop = () => {
        window.removeEventListener('popstate', onPop);
        dummyStatePopped = true;
        clearCancelFallback();
        cancelFallbackTimer = setTimeout(() => {
          cancelFallbackTimer = null;
          if (!settled) settle();
        }, ANDROID_CAMERA_CANCEL_GRACE_MS);
      };
      window.addEventListener('popstate', onPop);
    }

    input.onchange = async () => {
      clearCancelFallback();

      const file = input.files?.[0];
      input.value = '';

      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }

      if (!file) {
        settle();
        return;
      }

      settled = true;
      onResult({ file, preview: URL.createObjectURL(file) });
      resolve();
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
 * Full-bleed Editorial Viewfinder with 1:1 square grid, camera flip, flash, 3s timer,
 * tactile shutter, and friendly Vietnamese permission-denied guidance.
 */
async function openCameraStream(onResult: (result: CameraResult) => void): Promise<void> {
  const overlay = document.createElement('div');
  overlay.className = 'p-cam-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Máy ảnh chụp khoảnh khắc');

  overlay.innerHTML = `
    <div class="p-cam-topbar">
      <button type="button" class="p-cam-icon-btn" id="cam-close-btn" aria-label="Đóng máy ảnh">
        ${iconMarkup('close', { size: 20 })}
      </button>
      <div class="p-cam-tools">
        <button type="button" class="p-cam-pill-btn" id="cam-grid-btn" aria-pressed="true" aria-label="Bật tắt lưới căn khung">
          <span>3×3</span>
        </button>
        <button type="button" class="p-cam-icon-btn" id="cam-timer-btn" aria-pressed="false" aria-label="Hẹn giờ 3 giây">
          ${iconMarkup('clock', { size: 20 })}
        </button>
        <button type="button" class="p-cam-icon-btn" id="cam-flash-btn" aria-pressed="false" aria-label="Bật tắt đèn flash">
          ${iconMarkup('flash-off', { size: 20 })}
        </button>
      </div>
    </div>
    <div class="p-cam-stage">
      <video class="p-cam-video" autoplay playsinline webkit-playsinline></video>
      <div class="p-cam-frame is-grid" id="cam-frame">
        <span class="p-cam-grid-line p-cam-grid-line--v1"></span>
        <span class="p-cam-grid-line p-cam-grid-line--v2"></span>
        <span class="p-cam-grid-line p-cam-grid-line--h1"></span>
        <span class="p-cam-grid-line p-cam-grid-line--h2"></span>
      </div>
      <div class="p-cam-countdown" id="cam-countdown" hidden></div>
      <div class="p-cam-screen-flash" id="cam-screen-flash" hidden></div>
      <div class="p-cam-denied" id="cam-denied" hidden>
        <div class="p-cam-denied__icon">${iconMarkup('lock', { size: 32, variant: 'filled' })}</div>
        <h3>Chưa cấp quyền máy ảnh</h3>
        <p>Cho phép quyền truy cập Camera trong phần cài đặt trình duyệt, hoặc chọn ảnh có sẵn từ thư viện nhé.</p>
        <div class="p-cam-denied__actions">
          <button type="button" class="c-btn c-btn--primary c-btn--pill" id="cam-fallback-native">Mở máy ảnh thiết bị</button>
          <button type="button" class="c-btn c-btn--secondary c-btn--pill" id="cam-fallback-gallery">Chọn từ Album</button>
        </div>
      </div>
    </div>
    <div class="p-cam-bottombar">
      <button type="button" class="p-cam-icon-btn" id="cam-gallery-btn" aria-label="Chọn từ thư viện ảnh">
        ${iconMarkup('gallery', { size: 24 })}
      </button>
      <button type="button" class="p-cam-shutter" id="cam-shutter-btn" aria-label="Chụp ảnh">
        <span class="p-cam-shutter__ring">
          ${iconMarkup('heart', { size: 24, variant: 'filled' })}
        </span>
      </button>
      <button type="button" class="p-cam-icon-btn" id="cam-flip-btn" aria-label="Đổi camera trước sau">
        ${iconMarkup('flip-camera', { size: 24 })}
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const video = overlay.querySelector<HTMLVideoElement>('.p-cam-video')!;
  const frameEl = overlay.querySelector<HTMLElement>('#cam-frame')!;
  const countdownEl = overlay.querySelector<HTMLElement>('#cam-countdown')!;
  const flashScreenEl = overlay.querySelector<HTMLElement>('#cam-screen-flash')!;
  const deniedEl = overlay.querySelector<HTMLElement>('#cam-denied')!;
  const closeBtn = overlay.querySelector<HTMLButtonElement>('#cam-close-btn')!;
  const gridBtn = overlay.querySelector<HTMLButtonElement>('#cam-grid-btn')!;
  const timerBtn = overlay.querySelector<HTMLButtonElement>('#cam-timer-btn')!;
  const flashBtn = overlay.querySelector<HTMLButtonElement>('#cam-flash-btn')!;
  const shutterBtn = overlay.querySelector<HTMLButtonElement>('#cam-shutter-btn')!;
  const flipBtn = overlay.querySelector<HTMLButtonElement>('#cam-flip-btn')!;
  const galleryBtn = overlay.querySelector<HTMLButtonElement>('#cam-gallery-btn')!;

  let localStream: MediaStream | null = null;
  let facingMode: 'environment' | 'user' = 'environment';
  let flashEnabled = false;
  let timerEnabled = false;
  let gridEnabled = true;
  let capturing = false;

  const stopStream = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  };

  const applyTorch = async (on: boolean) => {
    const track = localStream?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    } catch {
      // Hardware torch unsupported; screen flash is used during capture
    }
  };

  const startStream = async (mode: 'environment' | 'user') => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1440 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      video.srcObject = localStream;
      video.classList.toggle('is-mirrored', mode === 'user');
      deniedEl.hidden = true;
      if (flashEnabled) void applyTorch(true);
    } catch (err) {
      logger.warn('[camera] getUserMedia failed', err);
      const name = (err as DOMException)?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        deniedEl.hidden = false;
      } else {
        stopStream();
        openCameraCapture(onResult);
      }
    }
  };

  await startStream(facingMode);

  closeBtn.addEventListener('click', stopStream);

  gridBtn.addEventListener('click', () => {
    gridEnabled = !gridEnabled;
    gridBtn.setAttribute('aria-pressed', String(gridEnabled));
    frameEl.classList.toggle('is-grid', gridEnabled);
    triggerHaptic('select');
  });

  timerBtn.addEventListener('click', () => {
    timerEnabled = !timerEnabled;
    timerBtn.setAttribute('aria-pressed', String(timerEnabled));
    timerBtn.classList.toggle('is-active', timerEnabled);
    triggerHaptic('select');
  });

  flashBtn.addEventListener('click', () => {
    flashEnabled = !flashEnabled;
    flashBtn.setAttribute('aria-pressed', String(flashEnabled));
    flashBtn.classList.toggle('is-active', flashEnabled);
    flashBtn.innerHTML = iconMarkup(flashEnabled ? 'flash' : 'flash-off', {
      size: 20,
      variant: flashEnabled ? 'filled' : 'outline',
    });
    void applyTorch(flashEnabled);
    triggerHaptic('select');
  });

  flipBtn.addEventListener('click', () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    triggerHaptic('tap');
    void startStream(facingMode);
  });

  galleryBtn.addEventListener('click', () => {
    stopStream();
    openGallery(onResult);
  });

  overlay.querySelector('#cam-fallback-native')?.addEventListener('click', () => {
    stopStream();
    openCameraCapture(onResult);
  });

  overlay.querySelector('#cam-fallback-gallery')?.addEventListener('click', () => {
    stopStream();
    openGallery(onResult);
  });

  shutterBtn.addEventListener('click', async () => {
    if (capturing || !video.videoWidth) return;
    capturing = true;

    if (timerEnabled) {
      countdownEl.hidden = false;
      for (let sec = 3; sec >= 1; sec--) {
        countdownEl.textContent = String(sec);
        triggerHaptic('select');
        await new Promise((r) => setTimeout(r, 900));
      }
      countdownEl.hidden = true;
    }

    if (flashEnabled && facingMode === 'user') {
      flashScreenEl.hidden = false;
      await new Promise((r) => setTimeout(r, 120));
    }

    triggerHaptic('threshold');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      flashScreenEl.hidden = true;
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onResult({
              file,
              preview: URL.createObjectURL(file),
            });
          }
          stopStream();
        },
        'image/jpeg',
        0.92,
      );
    } else {
      flashScreenEl.hidden = true;
      stopStream();
    }
  });
}

/**
 * Open device camera. On web browsers with getUserMedia support, opens the rich
 * viewfinder stream unless running inside the Android wrapper WebView.
 */
export function openCamera(onResult: (result: CameraResult) => void, forceStream = true): void {
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
