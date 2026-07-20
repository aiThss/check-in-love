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

  it('uses the animated love chat loader for loading toasts', async () => {
    const { showToast } = await import('./toast');
    showToast('Loading messages...', 'loading');

    const loader = document.querySelector<SVGElement>('.toast-loading .loveChat');
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute('aria-label')).toBe('love chat loader');
  });

  it('uses the animated love spark loader for home and memories loading toasts', async () => {
    const { showToast } = await import('./toast');
    showToast('Loading memories...', 'loading-spark');

    const loader = document.querySelector<SVGElement>('.toast-loading-spark .loveSpark');
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute('aria-label')).toBe('love spark loader');
  });
});
