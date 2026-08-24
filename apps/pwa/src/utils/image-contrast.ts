export type ImageTone = 'light' | 'dark';

const ANALYSIS_SIZE = 32;
const LIGHT_TONE_THRESHOLD = 0.56;

/**
 * Pick the tone for a foreground glass surface from normalized sRGB luminance.
 * The threshold intentionally leaves a little room for mixed-color photos:
 * the system event still has its own opaque-enough glass background as a
 * second contrast layer.
 */
export function toneFromLuminance(luminance: number): ImageTone {
  if (!Number.isFinite(luminance)) return 'dark';
  return Math.max(0, Math.min(1, luminance)) >= LIGHT_TONE_THRESHOLD ? 'light' : 'dark';
}

export function themeFallbackTone(): ImageTone {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light';
}

function shouldUseAnonymousCors(source: string): boolean {
  if (!/^https?:\/\//i.test(source)) return false;
  try {
    return new URL(source, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Read a small sample of an image and classify its average perceived
 * luminance. Canvas access can be blocked for a remote storage URL, so this
 * intentionally resolves null instead of affecting wallpaper rendering.
 */
export function analyzeImageTone(source: string): Promise<ImageTone | null> {
  if (!source || typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (tone: ImageTone | null) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve(tone);
    };

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = ANALYSIS_SIZE;
        canvas.height = ANALYSIS_SIZE;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          finish(null);
          return;
        }
        context.drawImage(image, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
        const pixels = context.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE).data;
        let luminanceSum = 0;
        let alphaSum = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3] / 255;
          if (alpha <= 0.05) continue;
          const luminance = (
            0.2126 * pixels[index]
            + 0.7152 * pixels[index + 1]
            + 0.0722 * pixels[index + 2]
          ) / 255;
          luminanceSum += luminance * alpha;
          alphaSum += alpha;
        }
        finish(alphaSum > 0 ? toneFromLuminance(luminanceSum / alphaSum) : null);
      } catch {
        // A cross-origin image without CORS headers taints the canvas.
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    if (shouldUseAnonymousCors(source)) image.crossOrigin = 'anonymous';
    image.src = source;
  });
}
