// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let store: typeof import('../store').store;
let setupAndroidFcm: typeof import('./push').setupAndroidFcm;
let request: ReturnType<typeof vi.fn>;

async function waitForRegistration(): Promise<void> {
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  request = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
  vi.stubGlobal('fetch', request);
  Object.defineProperty(window, 'LoveCheckAndroid', {
    configurable: true,
    value: { getFcmToken: vi.fn(() => 'native-fcm-token') },
  });

  ({ store } = await import('../store'));
  ({ setupAndroidFcm } = await import('./push'));
});

afterEach(() => {
  store.clear();
  delete window.LoveCheckAndroid;
  delete window.onFcmTokenReceived;
  vi.unstubAllGlobals();
});

describe('Android FCM registration', () => {
  it('registers the token retained by native immediately after login', async () => {
    setupAndroidFcm();
    expect(request).not.toHaveBeenCalled();

    store.setToken('session-one');
    await waitForRegistration();

    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fcmToken: 'native-fcm-token' }),
      }),
    );
  });

  it('keeps a callback token until a session is available', async () => {
    Object.defineProperty(window, 'LoveCheckAndroid', {
      configurable: true,
      value: { getFcmToken: vi.fn(() => '') },
    });
    setupAndroidFcm();

    window.onFcmTokenReceived?.('callback-fcm-token');
    expect(request).not.toHaveBeenCalled();

    store.setToken('session-one');
    await waitForRegistration();

    expect(request.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: JSON.stringify({ fcmToken: 'callback-fcm-token' }),
    }));
  });
});
