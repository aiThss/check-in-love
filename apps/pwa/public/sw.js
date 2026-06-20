/* ============================================================
   LoveCheck Service Worker
   Cache name: lovecheck-v1
   ============================================================ */

const CACHE_NAME = 'lovecheck-v3';
const OFFLINE_URL = '/offline.html';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Cache shell assets, ignore failures for optional assets
      await Promise.allSettled(
        SHELL_ASSETS.map((url) => cache.add(url).catch(() => {}))
      );
      // Try to cache offline fallback
      try {
        await cache.add(OFFLINE_URL);
      } catch {
        // offline.html is optional
      }
      await self.skipWaiting();
    })()
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete old caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API requests: network-first with 3s timeout, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTimeout(request, 3000));
    return;
  }

  // Navigation requests: network first, fallback to /index.html
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Static assets: cache-first
  event.respondWith(cacheFirst(request));
});

// ── Strategies ───────────────────────────────────────────────

async function networkFirstWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    clearTimeout(timeoutId);
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({ error: 'Offline', message: 'Không có kết nối mạng' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function navigationHandler(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    // Fallback to cached index.html for SPA routing
    const cached = await caches.match('/index.html');
    if (cached) return cached;

    // Last resort: offline page
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ||
      new Response('<h1>Không có kết nối mạng</h1>', {
        headers: { 'Content-Type': 'text/html' },
      })
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

// ── Background Sync ──────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'checkin-sync') {
    event.waitUntil(syncPendingCheckins());
  }
});

async function syncPendingCheckins() {
  try {
    // Read pending check-ins from IndexedDB or localStorage via postMessage
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_CHECKINS' });
    });
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

// ── Push Notifications ───────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'LoveCheck 💕', body: 'Người ấy vừa gửi check-in mới!' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-512.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'check-in-love',
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/app/home',
      kind: data.kind,
      checkinId: data.checkinId,
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Xem ngay 💕' },
      { action: 'close', title: 'Để sau' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/app/home';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // If app is already open, focus it
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
