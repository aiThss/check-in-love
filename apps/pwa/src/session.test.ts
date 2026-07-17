// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearQueryCache: vi.fn(),
  clearPageCache: vi.fn(),
  clearStore: vi.fn(),
  postMessage: vi.fn(),
  cacheDelete: vi.fn().mockResolvedValue(true),
}));

vi.mock('./api/query-cache', () => ({ clearQueryCache: mocks.clearQueryCache }));
vi.mock('./router', () => ({ clearPageCache: mocks.clearPageCache }));
vi.mock('./store/index', () => ({ store: { clear: mocks.clearStore } }));

describe('session cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.clearQueryCache.mockClear();
    mocks.clearPageCache.mockClear();
    mocks.clearStore.mockClear();
    mocks.postMessage.mockClear();
    mocks.cacheDelete.mockClear();

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: { postMessage: mocks.postMessage } },
    });
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['lovecheck-v3', 'public-assets']),
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue([
          new Request('https://app.test/api/checkins'),
          new Request('https://app.test/assets/app.js'),
        ]),
        delete: mocks.cacheDelete,
      }),
    };
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: cacheStorage,
    });
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: cacheStorage });
  });

  it('clears store, router cache, query cache, and sends the service-worker cleanup message', async () => {
    const { clearPrivateClientState } = await import('./session');
    clearPrivateClientState();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.clearStore).toHaveBeenCalledOnce();
    expect(mocks.clearPageCache).toHaveBeenCalledOnce();
    expect(mocks.clearQueryCache).toHaveBeenCalledOnce();
    expect(mocks.postMessage).toHaveBeenCalledWith({ type: 'CLEAR_PRIVATE_CACHE' });
    expect(mocks.cacheDelete).toHaveBeenCalledOnce();
  });
});
