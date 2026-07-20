// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('toast status duration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
    vi.resetModules();
  });

  afterEach(() => vi.useRealTimers());

  it('begins dismissing a status toast after three seconds', async () => {
    const { showToast } = await import('./toast');
    showToast('Đã lưu', 'success');
    const toast = document.querySelector<HTMLElement>('.toast')!;
    expect(toast).not.toBeNull();

    await vi.advanceTimersByTimeAsync(2_999);
    expect(toast.classList.contains('toast-exit')).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(toast.classList.contains('toast-exit')).toBe(true);
  });

  it('uses the animated heart checkmark for success toasts', async () => {
    const { showToast } = await import('./toast');
    showToast('Thay đổi thành công', 'success');

    const icon = document.querySelector<SVGElement>('.toast-success .toast-success-heart');
    const checkmark = icon?.querySelector<SVGPathElement>('.toast-success-checkmark');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('width')).toBe('40');
    expect(checkmark).not.toBeNull();
    expect(document.querySelector('lottie-player[src="/icons8-correct.json"]')).toBeNull();
  });

  it('uses unique gradient IDs when multiple success toasts are visible', async () => {
    const { showToast } = await import('./toast');
    showToast('Đã gửi thành công', 'success');
    showToast('Đã thay đổi thành công', 'success');

    const gradients = Array.from(
      document.querySelectorAll<SVGLinearGradientElement>('.toast-success-heart linearGradient'),
    ).map((gradient) => gradient.id);

    expect(gradients).toHaveLength(2);
    expect(new Set(gradients).size).toBe(2);
  });

  it('uses the animated heart icon for error toasts', async () => {
    const { showToast } = await import('./toast');
    showToast('Vui lòng nhập email', 'error');

    const icon = document.querySelector<SVGElement>('.toast-error .toast-error-heart');
    expect(icon).not.toBeNull();
    expect(document.querySelector('img[src="/icons8-error.gif"]')).toBeNull();
  });

  it('uses the animated love chat loader for loading toasts', async () => {
    const { showToast } = await import('./toast');
    showToast('Loading messages...', 'loading');

    const loader = document.querySelector<SVGElement>('.toast-loading .loveChat');
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute('aria-label')).toBe('love chat loader');
  });

  it('uses the animated love spark loader for loading toasts', async () => {
    const { showToast } = await import('./toast');
    showToast('Loading memories...', 'loading-spark');

    const loader = document.querySelector<SVGElement>('.toast-loading-spark .loveSpark');
    expect(loader?.getAttribute('aria-label')).toBe('love spark loader');
  });
});
