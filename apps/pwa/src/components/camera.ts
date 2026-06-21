export interface CameraResult {
  file: File;
  preview: string;
}

export interface ImageProcessOptions {
  aspectRatio?: number;
  maxSize?: number;
  quality?: number;
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
): Promise<void> {
  return new Promise((resolve) => {
    const cleanup = () => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      input.value = '';

      if (!file) {
        cleanup();
        resolve();
        return;
      }

      try {
        onResult(await processImage(file));
      } catch {
        onResult({
          file,
          preview: URL.createObjectURL(file),
        });
      } finally {
        cleanup();
        resolve();
      }
    };

    input.oncancel = () => {
      cleanup();
      resolve();
    };

    input.click();
  });
}

export function openCamera(onResult: (result: CameraResult) => void): void {
  const input = createFileInput('image/*', 'environment');
  void handleFileSelection(input, onResult);
}

export function openGallery(onResult: (result: CameraResult) => void): void {
  const input = createFileInput('image/*');
  void handleFileSelection(input, onResult);
}
