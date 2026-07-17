// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppState } from './index';

let store: typeof import('./index').store;

beforeAll(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });

  localStorage.clear();
  ({ store } = await import('./index'));
  const getItem = vi.spyOn(Storage.prototype, 'getItem');

  store.get();
  store.get();
  expect(getItem).not.toHaveBeenCalled();
  getItem.mockRestore();
});

afterEach(() => store.clear());

describe('in-memory store', () => {
  it('updates state, persists it, synchronizes the token, and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set({ theme: 'dark', token: 'token-a' });

    expect(store.get().theme).toBe('dark');
    expect(store.getToken()).toBe('token-a');
    expect(localStorage.getItem('lovecheck_token')).toBe('token-a');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.theme).toBe('dark');

    unsubscribe();
    store.set({ theme: 'light' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clears persisted and in-memory private state', () => {
    store.set({ token: 'token-a', hasNewCheckin: true });
    store.clear();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.get().hasNewCheckin).toBe(false);
    expect(localStorage.getItem('lovecheck_state')).toBeNull();
    expect(localStorage.getItem('lovecheck_token')).toBeNull();
  });

  it('accepts synchronized state from another tab through the storage event', () => {
    store.initTheme();
    const state: Partial<AppState> = { theme: 'dark', hasNewCheckin: true };
    localStorage.setItem('lovecheck_state', JSON.stringify(state));
    localStorage.setItem('lovecheck_token', 'token-from-other-tab');

    window.dispatchEvent(new StorageEvent('storage', { key: 'lovecheck_token' }));

    expect(store.getToken()).toBe('token-from-other-tab');
    expect(store.get().hasNewCheckin).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
