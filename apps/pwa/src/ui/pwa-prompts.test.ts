// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INSTALL_DISMISSED_KEY, initInstallPrompt, isInstallPromptDismissed, showUpdateToast } from './pwa-prompts';

function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const btn = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === text);
  if (!btn) throw new Error(`Không thấy nút "${text}"`);
  return btn;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('update toast', () => {
  it('is non-blocking (status role, no modal backdrop) and appears only once', () => {
    const first = showUpdateToast(() => {});
    const second = showUpdateToast(() => {});

    expect(second).toBe(first);
    expect(first.getAttribute('role')).toBe('status');
    expect(document.querySelectorAll('[data-prompt="update"]')).toHaveLength(1);
    expect(document.querySelector('.modal-backdrop, .c-modal')).toBeNull();
  });

  it('calls onConfirm only for "Cập nhật", never for "Để sau"', () => {
    const onConfirm = vi.fn();
    const toast = showUpdateToast(onConfirm);

    buttonByText(toast, 'Để sau').click();
    expect(onConfirm).not.toHaveBeenCalled();

    document.body.innerHTML = '';
    const again = showUpdateToast(onConfirm);
    buttonByText(again, 'Cập nhật').click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('install prompt', () => {
  function fireInstallEvent(userChoice: 'accepted' | 'dismissed' = 'accepted') {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = vi.fn().mockResolvedValue(undefined);
    event.userChoice = Promise.resolve({ outcome: userChoice });
    window.dispatchEvent(event);
    return event;
  }

  it('waits for the delay and a signed-in user, then remembers "Để sau"', () => {
    vi.useFakeTimers();
    let signedIn = false;
    initInstallPrompt({ isAuthenticated: () => signedIn, delayMs: 1000 });

    const event = fireInstallEvent();
    expect(event.defaultPrevented).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(document.querySelector('[data-prompt="install"]')).toBeNull();

    signedIn = true;
    fireInstallEvent();
    vi.advanceTimersByTime(1000);
    const banner = document.querySelector<HTMLElement>('[data-prompt="install"]');
    expect(banner).not.toBeNull();

    buttonByText(banner!, 'Để sau').click();
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');
    expect(isInstallPromptDismissed()).toBe(true);
  });

  it('does not show again once dismissed', () => {
    vi.useFakeTimers();
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    initInstallPrompt({ isAuthenticated: () => true, delayMs: 10 });

    fireInstallEvent();
    vi.advanceTimersByTime(50);
    expect(document.querySelector('[data-prompt="install"]')).toBeNull();
  });
});
