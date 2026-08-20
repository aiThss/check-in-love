/* ============================================================
   LoveCheck Service Worker
   Cache name: lovecheck-v7
   ============================================================ */

const CACHE_NAME = 'lovecheck-v7';
const OFFLINE_URL = '/offline.html';
const SHARE_DB = 'lovecheck-share-v1';
const SHARE_STORE = 'pending';

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
      // Keep the old worker active until the app explicitly accepts the update.
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

  // Web Share Target delivers a POST to the SPA route. Keep the private file
  // in IndexedDB, then let the authenticated Chat page upload it through the
  // normal API client. Nothing is put in Cache Storage.
  if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/app/messages') {
    event.respondWith(captureShareTarget(request));
    return;
  }

  // Skip non-GET requests, external resources, and extension requests.
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  // Never place authenticated API responses in Cache Storage.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
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

function openShareDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SHARE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function captureShareTarget(request) {
  try {
    const form = await request.formData();
    const files = [];
    for (const key of ['media', 'file', 'files']) {
      for (const value of form.getAll(key)) {
        if (value instanceof Blob && value.size > 0) {
          files.push({ blob: value, name: value.name || 'shared-image.jpg', type: value.type || 'image/jpeg' });
        }
      }
    }
    const payload = {
      text: String(form.get('text') || form.get('title') || form.get('url') || '').trim(),
      files,
      createdAt: Date.now(),
    };
    const db = await openShareDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SHARE_STORE, 'readwrite');
      tx.objectStore(SHARE_STORE).put(payload, 'latest');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('[SW] Share target capture failed', error);
  }
  return Response.redirect('/app/messages?share=pending', 303);
}

// ── Strategies ───────────────────────────────────────────────

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
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
      cache.put('/index.html', networkResponse.clone()).catch(() => {});
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(clearPrivateResponses());
    return;
  }

  if (event.data?.type === 'GET_PENDING_SHARE' && event.ports?.[0]) {
    event.waitUntil((async () => {
      let payload = null;
      try {
        const db = await openShareDb();
        payload = await new Promise((resolve, reject) => {
          const tx = db.transaction(SHARE_STORE, 'readwrite');
          const store = tx.objectStore(SHARE_STORE);
          const get = store.get('latest');
          get.onsuccess = () => {
            const value = get.result || null;
            if (value) store.delete('latest');
            resolve(value);
          };
          get.onerror = () => reject(get.error);
        });
        db.close();
      } catch (error) {
        console.warn('[SW] Share target read failed', error);
      }
      event.ports[0].postMessage(payload);
    })());
  }
});

async function clearPrivateResponses() {
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
  let data = {
    title: 'Check IN Love 💕',
    body: 'Có tương tác mới!',
    senderName: '',
    senderAvatar: '',
    actionType: 'reminder',
    targetUrl: '/app/home'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  // Normalize fields between legacy and new structure
  const actionType = data.actionType || data.kind || 'reminder';
  let targetUrl = data.targetUrl || data.url || '/app/home';
  const senderName = data.senderName || 'Người ấy';
  const senderAvatar = data.senderAvatar || data.icon || '/icons/icon-512.png';

  let displayTitle = data.title;
  let displayBody = data.body;

  if (actionType === 'reaction') {
    displayTitle = `${senderName} đã bày tỏ cảm xúc`;
    displayBody = displayBody || 'Đã react check-in của bạn';
  } else if (actionType === 'reply') {
    displayTitle = `${senderName} đã phản hồi check-in`;
    displayBody = displayBody;
  } else if (actionType === 'checkin') {
    displayTitle = `${senderName} đã gửi check-in mới! 💕`;
    displayBody = displayBody || 'Mở app xem ngay nhé!';
  } else if (actionType === 'message') {
    displayTitle = `${senderName} đã nhắn cho bạn`;
    displayBody = displayBody || 'Mở app để xem tin nhắn mới';
    targetUrl = '/app/messages';
  }

  const options = {
    body: displayBody,
    icon: senderAvatar,
    badge: '/icons/badge.svg',
    tag: data.tag || `lovecheck-${actionType}`,
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      url: targetUrl,
      kind: actionType,
      checkinId: data.checkinId,
      messageId: data.messageId || '',
      dateOfArrival: Date.now(),
    },
    actions: actionType === 'message'
      ? [
          { action: 'reply', title: 'Trả lời' },
          { action: 'open', title: 'Mở cuộc trò chuyện' },
          { action: 'close', title: 'Để sau' },
        ]
      : [
          { action: 'open', title: 'Xem ngay 💕' },
          { action: 'close', title: 'Để sau' },
        ],
  };

  event.waitUntil(self.registration.showNotification(displayTitle, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  // Reply uses the existing composer on the messages page. Web/PWA
  // notification actions cannot host a text field themselves.
  const notificationData = event.notification.data || {};
  const messageId = notificationData.messageId;
  const isReminder = event.notification.tag === 'lovecheck-reminder';
  const targetUrl = event.action === 'reply' && messageId
    ? '/app/messages?replyTo=' + encodeURIComponent(messageId)
    : isReminder
      ? '/app/checkin'
      : (notificationData.url || '/app/home');

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // If app is already open, focus it and navigate
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
