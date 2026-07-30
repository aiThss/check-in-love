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

describe('center check-in navigation button', () => {
  let createNav: typeof import('./nav').createNav;
  let setActiveNav: typeof import('./nav').setActiveNav;

  beforeAll(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() }),
    });
    ({ createNav, setActiveNav } = await import('./nav'));
  });

  beforeEach(() => {
    mocks.getCurrentPath.mockReset();
    mocks.navigate.mockReset();
    document.body.innerHTML = '';
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
});
