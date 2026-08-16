import { apiFetch } from './client';
import { logger } from '../utils/logger';
import { isMockLocalMode } from '../dev/mock-data';
import { store } from '../store';

interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

export type PushSetupStatus =
  | 'unsupported'
  | 'disabled'
  | 'prompt'
  | 'denied'
  | 'subscribed'
  | 'error';

export interface PushSetupResult {
  status: PushSetupStatus;
  message?: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function isAndroidApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    (Boolean(window.LoveCheckAndroid) ||
      navigator.userAgent.includes('LoveCheckAndroidWrapper'))
  );
}

export function isPushSupported(): boolean {
  if (isAndroidApp()) return true;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

async function getPushConfig(): Promise<PushConfig> {
  return apiFetch<PushConfig>('/push/config');
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await apiFetch<void>('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  });
}

export async function ensurePushSubscription(
  requestPermission = false,
): Promise<PushSetupResult> {
  if (isMockLocalMode()) {
    return { status: 'disabled', message: 'Thông báo đang tắt trong dữ liệu demo local' };
  }

  // Android APK wrapper uses native FCM notifications instead of web push service worker
  if (isAndroidApp()) {
    return { status: 'subscribed' };
  }

  if (!isPushSupported()) {
    return {
      status: 'unsupported',
      message: 'Thiết bị này chưa hỗ trợ push cho PWA',
    };
  }

  const config = await getPushConfig().catch(() => null);
  if (!config?.enabled || !config.publicKey) {
    return {
      status: 'disabled',
      message: 'Server chưa cấu hình VAPID push key',
    };
  }

  if (Notification.permission === 'denied') {
    return {
      status: 'denied',
      message: 'Thông báo đang bị tắt trong cài đặt trình duyệt',
    };
  }

  if (Notification.permission === 'default') {
    if (!requestPermission) {
      return { status: 'prompt' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        status: permission === 'denied' ? 'denied' : 'prompt',
        message: 'Bạn chưa cấp quyền thông báo',
      };
    }
  }

  const registration = await getRegistration();
  if (!registration) {
    return {
      status: 'error',
      message: 'Không đăng ký được service worker',
    };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey) as unknown as BufferSource,
    });
  }

  await saveSubscription(subscription);
  return { status: 'subscribed' };
}

export async function getPushSetupState(): Promise<PushSetupResult> {
  if (isMockLocalMode()) return { status: 'disabled' };

  if (isAndroidApp()) {
    return { status: 'subscribed' };
  }

  if (!isPushSupported()) {
    return { status: 'unsupported' };
  }

  if (Notification.permission === 'granted') {
    return ensurePushSubscription(false);
  }

  if (Notification.permission === 'denied') {
    return { status: 'denied' };
  }

  const config = await getPushConfig().catch(() => null);
  if (!config?.enabled || !config.publicKey) {
    return { status: 'disabled' };
  }

  return { status: 'prompt' };
}

export async function testPushNotification(): Promise<{ success: boolean; message?: string }> {
  return apiFetch<{ success: boolean; message?: string }>('/push/test', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function registerFcmToken(fcmToken: string): Promise<void> {
  await apiFetch<void>('/push/subscribe-fcm', {
    method: 'POST',
    body: JSON.stringify({ fcmToken }),
    // Token registration is optional background work. It must not clear an
    // otherwise valid session if it races a WebView reload or login restore.
    preserveSessionOnUnauthorized: true,
  });
}

export async function syncAndroidFcmNow(tokenCandidate?: string | null): Promise<boolean> {
  const token = (tokenCandidate ?? window.LoveCheckAndroid?.getFcmToken?.())?.trim();
  const sessionToken = store.getToken() || localStorage.getItem('lovecheck_token');
  if (!token || !sessionToken) return false;

  try {
    await registerFcmToken(token);
    logger.info('[FCM] Token synchronized successfully', { tokenPrefix: token.slice(0, 8) });
    return true;
  } catch (err) {
    logger.warn('[FCM] Token synchronization failed', err);
    return false;
  }
}

export function setupAndroidFcm(): void {
  let latestToken: string | null = null;
  let registeredToken: string | null = null;
  let inFlight = false;

  const sync = async (tokenCandidate?: string | null) => {
    if (tokenCandidate) {
      latestToken = tokenCandidate.trim();
    }
    if (inFlight) return;
    const token = (latestToken ?? window.LoveCheckAndroid?.getFcmToken?.())?.trim();
    const sessionToken = store.getToken() || localStorage.getItem('lovecheck_token');
    if (!token || !sessionToken) return;

    const key = `${sessionToken}:${token}`;
    if (registeredToken === key) return;

    inFlight = true;
    try {
      await registerFcmToken(token);
      registeredToken = key;
    } catch (err) {
      logger.warn('[FCM] Setup sync failed', err);
    } finally {
      inFlight = false;
    }
  };

  window.onFcmTokenReceived = (token: string) => {
    latestToken = token.trim() || null;
    void sync(token);
  };

  // Immediate sync attempt
  latestToken = window.LoveCheckAndroid?.getFcmToken?.()?.trim() || null;
  void sync();

  // Retry schedule to catch asynchronous Google Play Services token generation
  const retryIntervals = [800, 2000, 4000, 8000, 15000];
  retryIntervals.forEach((delay) => {
    setTimeout(() => {
      void sync();
    }, delay);
  });

  store.subscribe((state, previousState) => {
    if (state.token && state.token !== previousState.token) {
      latestToken = latestToken || window.LoveCheckAndroid?.getFcmToken?.()?.trim() || null;
      void sync();
    }
  });
}
