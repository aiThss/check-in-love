import { clearQueryCache } from './api/query-cache';
import { clearPageCache } from './router';
import { store } from './store/index';
import { clearMockNewUserData } from './dev/mock-data';

/** Clear all data that belongs to the signed-in couple without reloading the app. */
export function clearPrivateClientState(): void {
  store.clear();
  clearMockNewUserData();
  clearPageCache();
  clearQueryCache();

  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHE' });
  if ('caches' in window) {
    void clearLegacyPrivateResponses();
  }
}

async function clearLegacyPrivateResponses(): Promise<void> {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(async (cacheName) => {
    if (!cacheName.startsWith('lovecheck-')) return;
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    await Promise.all(requests
      .filter((request) => new URL(request.url).pathname.startsWith('/api/'))
      .map((request) => cache.delete(request)));
  }));
}
