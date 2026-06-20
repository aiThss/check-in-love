import { apiFetch } from './client';

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
      message: 'Thiet bi nay chua ho tro push cho PWA',
    };
  }

  const config = await getPushConfig().catch(() => null);
  if (!config?.enabled || !config.publicKey) {
    return {
      status: 'disabled',
      message: 'Server chua cau hinh VAPID push key',
    };
  }

  if (Notification.permission === 'denied') {
    return {
      status: 'denied',
      message: 'Thong bao dang bi tat trong cai dat trinh duyet',
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
        message: 'Ban chua cap quyen thong bao',
      };
    }
  }

  const registration = await getRegistration();
  if (!registration) {
    return {
      status: 'error',
      message: 'Khong dang ky duoc service worker',
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
