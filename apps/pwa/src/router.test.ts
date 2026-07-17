// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RoutePage } from './router';

vi.unmock('./router');

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const lifecycle = {
  homeActivate: 0,
  homeDeactivate: 0,
  homeDestroy: 0,
};

let router: typeof import('./router');
let store: typeof import('./store/index').store;
let homeElement: HTMLElement;
let resolveMemories: ((page: HTMLElement) => void) | undefined;

function page(id: string): HTMLElement {
  const element = document.createElement('section');
  element.id = id;
  element.textContent = id;
  return element;
}

function routePages(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#page-host [data-route-page]'));
}

function visibleRoutePages(): HTMLElement[] {
  return routePages().filter((routePage) => !routePage.hidden);
}

function expectOnlyVisibleRoute(path: string): void {
  expect(visibleRoutePages()).toHaveLength(1);
  expect(visibleRoutePages()[0].dataset.routePage).toBe(path);
  routePages().forEach((routePage) => {
    const active = routePage.dataset.routePage === path;
    expect(routePage.hidden).toBe(!active);
    expect(routePage.getAttribute('aria-hidden')).toBe(active ? 'false' : 'true');
    expect(routePage.hasAttribute('inert')).toBe(!active);
  });
}

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  history.replaceState({}, '', '/app/home');
  localStorage.setItem('lovecheck_token', 'test-token');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() }),
  });
  Object.defineProperty(window, 'scrollX', { configurable: true, writable: true, value: 0 });
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  });
  window.scrollTo = vi.fn();

  ({ store } = await import('./store/index'));
  router = await import('./router');
  homeElement = page('home');
  const homePage: RoutePage = {
    element: homeElement,
    activate: () => { lifecycle.homeActivate++; },
    deactivate: () => { lifecycle.homeDeactivate++; },
    destroy: () => { lifecycle.homeDestroy++; },
  };

  router.initRouter({
    '/app/home': () => homePage,
    '/app/memories': () => new Promise<HTMLElement>((resolve) => { resolveMemories = resolve; }),
    '/app/messages': () => page('messages'),
    '/app/profile': () => page('profile'),
    '/onboarding': () => page('onboarding'),
  });
  await flush();
});

describe('persistent router behavior', () => {
  it('keeps the nav identity, rejects stale route races, and fires lifecycle hooks', async () => {
    const nav = document.querySelector('.bottom-nav');
    expect(nav).not.toBeNull();
    expect(lifecycle.homeActivate).toBe(1);

    router.navigate('/app/memories');
    router.navigate('/app/profile');
    await flush();
    resolveMemories?.(page('memories-stale'));
    await flush();

    expect(document.querySelector('#profile')).not.toBeNull();
    expect(document.querySelector('#memories-stale')).toBeNull();
    expect(document.querySelector('.bottom-nav')).toBe(nav);
    expect(lifecycle.homeDeactivate).toBe(1);
    expectOnlyVisibleRoute('/app/profile');
  });

  it('keeps cached page identity, restores scroll, and avoids duplicate history entries', async () => {
    router.navigate('/app/home');
    await flush();
    expect(document.querySelector('#home')).toBe(homeElement);

    window.scrollY = 143;
    router.navigate('/app/messages');
    await flush();
    expectOnlyVisibleRoute('/app/messages');
    window.scrollY = 12;

    router.navigate('/app/home');
    await flush();
    expect(document.querySelector('#home')).toBe(homeElement);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 143, behavior: 'auto' });
    expectOnlyVisibleRoute('/app/home');
    expect(document.querySelector<HTMLElement>('#messages')?.closest<HTMLElement>('[data-route-page]')?.hidden).toBe(true);

    const historyLength = history.length;
    router.navigate('/app/home');
    expect(history.length).toBe(historyLength);
  });

  it('does not intercept external links and supports back/forward history', async () => {
    const external = document.createElement('a');
    external.href = 'https://example.com/';
    external.target = '_blank';
    document.body.appendChild(external);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    external.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);

    router.navigate('/app/messages');
    await flush();
    history.back();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(window.location.pathname).toBe('/app/home');
    expect(document.querySelector('#home')).toBe(homeElement);
    history.forward();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(window.location.pathname).toBe('/app/messages');
    expectOnlyVisibleRoute('/app/messages');
  });

  it('redirects protected routes after authentication is cleared and destroys cached pages', async () => {
    store.clear();
    router.navigate('/app/home');
    await flush();

    expect(window.location.pathname).toBe('/onboarding');
    expect(document.querySelector('#onboarding')).not.toBeNull();
    expect(lifecycle.homeDestroy).toBe(1);
    expectOnlyVisibleRoute('/onboarding');
  });

  it('renders an error state instead of leaving the app blank when a route import fails', async () => {
    history.replaceState({}, '', '/broken');
    router.initRouter({
      '/broken': () => Promise.reject(new Error('chunk unavailable')),
      '/': () => page('fallback'),
    });
    await flush();

    expect(document.querySelector('.route-message')).not.toBeNull();
    expect(document.querySelector('#page-host')?.childElementCount).toBe(1);
    expectOnlyVisibleRoute('route-error');
  });
});
