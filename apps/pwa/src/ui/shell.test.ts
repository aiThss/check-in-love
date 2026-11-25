// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearQueryCache, fetchQuery } from '../api/query-cache';
import { closeModal, showModal } from '../components/modal';
import { createThemeToggleButton } from '../components/theme-toggle';
import {
  inferTransitionKind,
  initSwrBar,
  runViewTransition,
  setUiReducedMotion,
  startSwrActivity,
  triggerHaptic,
} from './index';

describe('App Shell v2 (P2 — Haptics, View Transitions, SWR Bar, Modal Focus Trap)', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#f8e2e7" />';
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-reduced-motion');
    document.documentElement.removeAttribute('data-vt-kind');
    localStorage.clear();
    clearQueryCache();
  });

  it('triggers navigator.vibrate only when reduced motion is not active', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });

    setUiReducedMotion('off');
    expect(triggerHaptic('select')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(10);

    vibrate.mockClear();
    setUiReducedMotion('on');
    expect(triggerHaptic('confirm')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('infers transition kind and uses startViewTransition with safe fallback', async () => {
    expect(inferTransitionKind('/app/home', '/app/memories')).toBe('tab');
    expect(inferTransitionKind('/app/home', '/app/checkin')).toBe('forward');
    expect(inferTransitionKind('/app/checkin', '/app/home')).toBe('back');
    expect(inferTransitionKind('/app/home', '/app/home')).toBe('none');

    setUiReducedMotion('off');
    let swapped = false;
    runViewTransition(() => {
      swapped = true;
    }, 'tab');
    expect(swapped).toBe(true);

    let resolveFinished!: () => void;
    const finished = new Promise<void>((r) => {
      resolveFinished = r;
    });
    const startVT = vi.fn((cb: () => void) => {
      cb();
      return { finished };
    });
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startVT });

    let ranInVT = false;
    runViewTransition(() => {
      ranInVT = true;
      expect(document.documentElement.getAttribute('data-vt-kind')).toBe('forward');
    }, 'forward');
    expect(ranInVT).toBe(true);
    expect(startVT).toHaveBeenCalledTimes(1);

    resolveFinished();
    await finished;
    await Promise.resolve();
    expect(document.documentElement.getAttribute('data-vt-kind')).toBeNull();
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('lights up the non-blocking SWR top bar during background query revalidation', async () => {
    const bar = initSwrBar(document)!;
    expect(bar.classList.contains('is-active')).toBe(false);

    const stopManual = startSwrActivity();
    expect(bar.classList.contains('is-active')).toBe(true);
    stopManual();
    expect(bar.classList.contains('is-active')).toBe(false);

    // Seed initial query cache
    await fetchQuery('home:test', async () => 'v1', { staleTime: 0 });
    expect(bar.classList.contains('is-active')).toBe(false);

    // Background revalidation (existing data is present -> SWR bar activates!)
    let finishReval!: (v: string) => void;
    const revalPromise = fetchQuery(
      'home:test',
      () => new Promise<string>((r) => { finishReval = r; }),
      { force: true },
    );
    expect(bar.classList.contains('is-active')).toBe(true);
    finishReval('v2');
    await revalPromise;
    expect(bar.classList.contains('is-active')).toBe(false);
  });

  it('renders bespoke SVG theme toggle and traps Tab focus inside global showModal', () => {
    const toggle = createThemeToggleButton();
    document.body.appendChild(toggle);
    expect(toggle.querySelector('svg[data-cil-icon="moon"]')).not.toBeNull();
    toggle.click();
    expect(toggle.querySelector('svg[data-cil-icon="sun"]')).not.toBeNull();

    showModal({
      title: 'Xác nhận đăng xuất',
      content: 'Bạn muốn đăng xuất khỏi thiết bị này?',
      confirmText: 'Đăng xuất',
      cancelText: 'Ở lại',
      danger: true,
    });

    const buttons = document.querySelectorAll<HTMLButtonElement>('.modal .modal-actions button');
    expect(buttons.length).toBe(2);
    buttons[1].focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabEvent);
    expect(document.activeElement).toBe(buttons[0]);
    closeModal();
  });
});
