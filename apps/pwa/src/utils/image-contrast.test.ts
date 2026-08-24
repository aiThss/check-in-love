// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { analyzeImageTone, toneFromLuminance } from './image-contrast';

describe('image tone detection', () => {
  it('uses a dark foreground tone for dark photos', () => {
    expect(toneFromLuminance(0.18)).toBe('dark');
  });

  it('uses a light foreground tone for bright photos', () => {
    expect(toneFromLuminance(0.82)).toBe('light');
  });

  it('clamps out-of-range luminance values safely', () => {
    expect(toneFromLuminance(-1)).toBe('dark');
    expect(toneFromLuminance(2)).toBe('light');
  });

  it('reads a bright canvas sample before selecting the notification tone', async () => {
    const context = {
      drawImage: () => undefined,
      getImageData: () => ({
        data: new Uint8ClampedArray([245, 245, 245, 255, 230, 236, 240, 255]),
      }),
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => context);

    class InstantImage {
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', InstantImage);

    try {
      await expect(analyzeImageTone('/chat-backgrounds/bright.jpg')).resolves.toBe('light');
    } finally {
      getContext.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
