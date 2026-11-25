// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentPath: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../router', () => ({
  getCurrentPath: mocks.getCurrentPath,
  navigate: mocks.navigate,
}));

describe('Bottom Navigation v2 ("Nét Yêu" SVG + Unread Badge + Check-in Toggle)', () => {
  let createNav: typeof import('./nav').createNav;
  let setActiveNav: typeof import('./nav').setActiveNav;
  let setNavUnreadCount: typeof import('./nav').setNavUnreadCount;
  let getNavUnreadCount: typeof import('./nav').getNavUnreadCount;

  beforeAll(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, media: '(prefers-reduced-motion: reduce)', addEventListener: vi.fn() }),
    });
    ({ createNav, setActiveNav, setNavUnreadCount, getNavUnreadCount } = await import('./nav'));
  });

  beforeEach(() => {
    mocks.getCurrentPath.mockReset();
    mocks.navigate.mockReset();
    document.body.innerHTML = '';
    setNavUnreadCount(0);
  });

  it('closes check-in when the active center button is clicked', () => {
    mocks.getCurrentPath.mockReturnValue('/app/checkin');
    const nav = createNav();
    document.body.appendChild(nav);
    setActiveNav('/app/checkin');

    const button = nav.querySelector<HTMLButtonElement>('.nav-checkin-btn');
    expect(button).not.toBeNull();
    expect(button?.classList.contains('active')).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('Đóng check-in');

    button?.click();

    expect(mocks.navigate).toHaveBeenCalledWith('/app/home');
  });

  it('opens check-in when the center button is inactive', () => {
    mocks.getCurrentPath.mockReturnValue('/app/home');
    const nav = createNav();
    document.body.appendChild(nav);
    setActiveNav('/app/home');

    nav.querySelector<HTMLButtonElement>('.nav-checkin-btn')?.click();

    expect(mocks.navigate).toHaveBeenCalledWith('/app/checkin');
  });

  it('uses bespoke SVG icons for all 5 tabs with zero emojis or raster /user.png', () => {
    const nav = createNav();
    document.body.appendChild(nav);
    setActiveNav('/app/memories');

    const icons = nav.querySelectorAll('svg[data-cil-icon]');
    expect(icons.length).toBe(5);
    expect(nav.querySelector('img[src="/user.png"]')).toBeNull();
    expect(/[\u{1F300}-\u{1FAFF}]/u.test(nav.textContent ?? '')).toBe(false);

    const activeMemoriesSvg = nav.querySelector('[data-route="/app/memories"] svg');
    expect(activeMemoriesSvg?.classList.contains('c-icon--filled')).toBe(true);
  });

  it('updates unread message badge, syncs Badging API, and clears on entering /app/messages', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { setAppBadge, clearAppBadge });

    mocks.getCurrentPath.mockReturnValue('/app/home');
    const nav = createNav();
    document.body.appendChild(nav);

    window.dispatchEvent(
      new CustomEvent('lovecheck:realtime-event', { detail: { type: 'message' } }),
    );
    expect(getNavUnreadCount()).toBe(1);
    const badge = nav.querySelector<HTMLElement>('.c-nav__badge')!;
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('1');
    expect(setAppBadge).toHaveBeenCalledWith(1);

    setActiveNav('/app/messages');
    expect(getNavUnreadCount()).toBe(0);
    expect(badge.hidden).toBe(true);
    expect(clearAppBadge).toHaveBeenCalled();
  });
});
