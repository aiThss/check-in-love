# Prompt tao PWA app tai su dung

Tai lieu nay loc tu project `check-in-love` de ban mang sang project khac. Muc tieu la khong copy nguyen logic rieng cua app cu, chi lay khung PWA: manifest, icons, service worker, install flow, SPA routing, push notification va cau hinh deploy.

## Code nen lay tu project nay

- `apps/pwa/index.html`: meta mobile/PWA, `theme-color`, manifest link, Apple touch icons, favicon, viewport `viewport-fit=cover`.
- `apps/pwa/public/manifest.webmanifest`: ten app, `start_url`, `scope`, `display: standalone`, `orientation`, mau nen/theme, icon 192/512.
- `apps/pwa/public/icons/*`: icon toi thieu `192x192`, `512x512`, Apple touch icons `120`, `152`, `180`, badge SVG neu dung push.
- `apps/pwa/public/sw.js`: service worker voi cache shell, xoa cache cu khi activate, SPA navigation fallback, static asset cache-first, API network-first timeout, push notification click handler.
- `apps/pwa/src/main.ts`: dang ky service worker sau khi load, detect iOS/standalone, route toi trang install, refresh push subscription khi user da cap quyen.
- `apps/pwa/src/pages/install.ts`: trang huong dan cai tren iOS Safari bang Share -> Add to Home Screen.
- `apps/pwa/src/api/push.ts`: kiem tra Push support, xin quyen Notification, lay VAPID public key, subscribe PushManager, gui subscription len backend.
- `apps/api/src/routes/push.ts`: API `/push/config`, `/push/subscribe`, `/push/unsubscribe`.
- `apps/api/src/db/models/PushSubscription.ts`: model luu endpoint va keys `auth`, `p256dh`.
- `apps/api/src/services/push.ts`: cau hinh `web-push`, gui notification bang VAPID, xoa subscription het han `410`.
- `apps/pwa/nginx.conf`: static asset cache dai han, rieng `sw.js`, manifest va HTML khong cache, SPA fallback ve `index.html`.

## Prompt mau de tao PWA cho project khac

Copy doan nay sang AI/dev tool khac, thay cac placeholder trong ngoac nhon.

```text
Hay bien project web hien tai thanh PWA cai duoc tren mobile/desktop.

Thong tin app:
- Ten app: {APP_NAME}
- Short name: {APP_SHORT_NAME}
- Mo ta: {APP_DESCRIPTION}
- Domain production: {PRODUCTION_URL}
- Mau theme: {THEME_COLOR}
- Mau background splash: {BACKGROUND_COLOR}
- API base URL: {API_BASE_URL}
- Framework/build tool: {VITE/REACT/VUE/SVELTE/NEXT/PLAIN_TS}
- Co can push notification khong: {YES/NO}
- Co can offline fallback khong: {YES/NO}
- Cac route can bao ve sau login: {PROTECTED_ROUTES}

Yeu cau frontend PWA:
1. Them/cap nhat file manifest tai `public/manifest.webmanifest`:
   - `name`, `short_name`, `description`, `id`, `start_url`, `scope`.
   - `display: "standalone"`, `orientation: "portrait"` neu la app mobile-first.
   - `theme_color`, `background_color`.
   - Icons toi thieu: `192x192`, `512x512`; icon 512 nen co `purpose: "any maskable"`.
2. Cap nhat HTML entry:
   - Them `<link rel="manifest" href="/manifest.webmanifest">`.
   - Them meta mobile: `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `theme-color`, `application-name`.
   - Them Apple touch icons `120x120`, `152x152`, `180x180`.
   - Dung viewport: `width=device-width, initial-scale=1.0, viewport-fit=cover`.
3. Tao `public/sw.js`:
   - Cache shell assets: `/`, `/index.html`, `/manifest.webmanifest`.
   - Khi install: mo cache, cache shell, `skipWaiting()`.
   - Khi activate: xoa cache version cu, `clients.claim()`.
   - Fetch strategy:
     - Non-GET bo qua.
     - API request: network-first co timeout 3 giay, fallback cache hoac JSON 503 offline.
     - Navigation request: network-first, fallback `/index.html` de SPA route van hoat dong.
     - Static assets: cache-first.
   - Them handler `push` va `notificationclick` neu bat push.
4. Dang ky service worker trong entry client:
   - Chi chay khi `'serviceWorker' in navigator`.
   - Dang ky `/sw.js` trong `window.load`.
   - Log warning neu fail, khong lam app crash.
5. Them trang/flow install:
   - Detect iOS: `/iPad|iPhone|iPod/`.
   - Detect standalone bang `matchMedia('(display-mode: standalone)')` hoac `navigator.standalone`.
   - Neu iOS va chua standalone, hien trang huong dan: mo Safari -> Share -> Add to Home Screen -> Add.
   - Neu da standalone, redirect ve onboarding/home.
6. Dam bao SPA routing:
   - Internal link khong reload full page neu app la SPA.
   - Server phai fallback moi route HTML ve `index.html`.
7. Them CSS mobile-safe:
   - Ho tro `100dvh`, safe area inset, touch target toi thieu 44px.
   - Khong de noi dung bi che boi notch/home indicator.

Yeu cau push notification neu `{YES}`:
1. Frontend:
   - Tao module `push` co cac ham:
     - `isPushSupported()`
     - `getPushSetupState()`
     - `ensurePushSubscription(requestPermission?: boolean)`
   - Lay VAPID public key tu `GET /api/push/config`.
   - Neu `Notification.permission === "default"` thi chi xin quyen sau hanh dong ro rang cua user.
   - Subscribe bang `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
   - Gui subscription JSON len `POST /api/push/subscribe`.
2. Backend:
   - Cai `web-push`.
   - Tao env:
     - `VAPID_PUBLIC_KEY`
     - `VAPID_PRIVATE_KEY`
     - `VAPID_EMAIL`
   - Tao model/table `PushSubscription` gom: `userId`, `endpoint`, `keys.auth`, `keys.p256dh`, `userAgent`, timestamps.
   - Tao route:
     - `GET /api/push/config` tra `{ enabled, publicKey }`.
     - `POST /api/push/subscribe` upsert subscription cua user hien tai.
     - `POST /api/push/unsubscribe` xoa subscription.
   - Tao service `sendPushToUser(userId, payload)`:
     - `webpush.setVapidDetails(...)`.
     - Gui payload JSON den moi subscription cua user.
     - Neu loi `410`, xoa subscription het han.

Yeu cau deploy/server:
1. `sw.js`, `manifest.webmanifest`, HTML phai `Cache-Control: no-store/no-cache`.
2. Static assets fingerprinted `.js/.css/.png/.svg/.woff2` co the cache dai han `public, immutable`.
3. Server phai tra dung MIME cho manifest: `application/manifest+json`.
4. Moi route SPA fallback ve `index.html`.
5. PWA phai chay tren HTTPS o production. Localhost duoc phep khi dev.

Acceptance criteria:
- Chrome DevTools Application hien manifest hop le, service worker activated.
- Lighthouse PWA khong bao loi manifest/icon/service worker nghiem trong.
- App install duoc tren Android/Chrome desktop.
- iOS Safari co trang huong dan Add to Home Screen va khi mo tu icon thi vao standalone mode.
- Reload route con, vi du `/app/home`, khong 404.
- Offline reload route da cache tra ve shell app hoac offline fallback.
- Neu bat push: user cap quyen xong backend luu subscription, server gui duoc notification, click notification mo/focus dung route.

Luu y khong copy:
- Khong copy ten, mau, route, text, logic auth, API path rieng cua project cu neu khong phu hop.
- Neu project khong can Android APK wrapper/FCM native thi bo toan bo bridge Android va FCM.
- Neu backend khong co auth thi subscription phai gan voi device/session thay vi `userId`.
```

## Checklist nhanh khi tu lam

- [ ] Tao icon `192`, `512`, Apple touch icons va badge neu can push.
- [ ] Them manifest va link manifest vao HTML.
- [ ] Dang ky service worker trong entry client.
- [ ] Viet service worker cache strategy phu hop.
- [ ] Them install page rieng cho iOS.
- [ ] Cau hinh server khong cache `sw.js`/manifest/HTML.
- [ ] Test install, reload route con, offline fallback.
- [ ] Neu co push: tao VAPID keys, backend subscription routes, frontend subscribe flow, test click notification.

