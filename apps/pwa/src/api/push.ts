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

export function isPushSupported(): boolean {
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

export async function registerFcmToken(fcmToken: string): Promise<void> {
  await apiFetch<void>('/push/subscribe-fcm', {
    method: 'POST',
    body: JSON.stringify({ fcmToken }),
    // Token registration is optional background work. It must not clear an
    // otherwise valid session if it races a WebView reload or login restore.
    preserveSessionOnUnauthorized: true,
  });
}

declare global {
  interface Window {
    LoveCheckAndroid?: {
      updateWidget?: (streak: number, partnerName: string) => void;
      getFcmToken?: () => string;
      signInWithGoogle?: () => void;
    };
    onFcmTokenReceived?: (token: string) => void;
  }
}

export function setupAndroidFcm(): void {
  let latestToken: string | null = null;
  let registeredSessionKey: string | null = null;
  let registrationInFlight: Promise<void> | null = null;

  const getStoredToken = (): string | null => {
    try {
      const token = window.LoveCheckAndroid?.getFcmToken?.().trim();
      return token || null;
    } catch {
      return null;
    }
  };

  const syncToken = (candidate = latestToken): void => {
    const token = candidate?.trim();
    const sessionToken = store.getToken();
    if (!token || !sessionToken) return;

    const sessionKey = `${sessionToken}:${token}`;
    if (registeredSessionKey === sessionKey || registrationInFlight) return;

    registrationInFlight = registerFcmToken(token)
      .then(() => {
        registeredSessionKey = sessionKey;
      })
      .catch((err) => {
        logger.warn('[FCM] Register fcm token failed', err);
      })
      .finally(() => {
        registrationInFlight = null;
        const nextToken = latestToken?.trim();
        const nextSessionToken = store.getToken();
        const nextSessionKey = nextToken && nextSessionToken
          ? `${nextSessionToken}:${nextToken}`
          : null;
        if (nextSessionKey && nextSessionKey !== sessionKey && registeredSessionKey !== nextSessionKey) {
          syncToken(nextToken);
        }
      });
  };

  // Listen for tokens pushed while the native activity is already open.
  window.onFcmTokenReceived = (token: string) => {
    latestToken = token.trim() || null;
    syncToken();
  };

  // Pull the retained token as a durable fallback when the native callback
  // arrived before this module had installed its listener.
  latestToken = getStoredToken();
  syncToken();

  // Authentication can finish after the token callback. Register the retained
  // token for the new account as soon as a session becomes available.
  store.subscribe((state, previousState) => {
    if (state.token && state.token !== previousState.token) {
      latestToken = getStoredToken() ?? latestToken;
      syncToken();
    }
  });
}
