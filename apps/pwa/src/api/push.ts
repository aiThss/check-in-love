import { apiFetch } from './client';
import { logger } from '../utils/logger';

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
  });
}

declare global {
  interface Window {
    LoveCheckAndroid?: {
      updateWidget?: (streak: number, partnerName: string) => void;
      getFcmToken?: () => string;
    };
    onFcmTokenReceived?: (token: string) => void;
  }
}

export function setupAndroidFcm(): void {
  // Lắng nghe sự kiện callback từ native
  window.onFcmTokenReceived = (token: string) => {
    if (token) {
      registerFcmToken(token).catch((err) => {
        logger.warn('[FCM] Register fcm token failed', err);
      });
    }
  };

  // Chủ động lấy token nếu bridge đã sẵn sàng
  try {
    const token = window.LoveCheckAndroid?.getFcmToken?.();
    if (token) {
      registerFcmToken(token).catch((err) => {
        logger.warn('[FCM] Pull and register fcm token failed', err);
      });
    }
  } catch (_err) {
    // Ignore if bridge is not loaded yet
  }
}
