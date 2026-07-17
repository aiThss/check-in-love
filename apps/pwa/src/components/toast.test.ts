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
});
