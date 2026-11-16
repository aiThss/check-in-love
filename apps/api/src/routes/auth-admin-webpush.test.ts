import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { WorkerEnv } from '../config/env';
import { createTestD1Database, MemoryR2Bucket } from '../db/sqlite-test-d1';
import { createVapidJwt, encryptWebPushPayload } from '../services/webpush';
import { base64UrlEncode } from '../utils/crypto';

describe('Auth, Admin, Random & WebPush Crypto (SQL + Workers)', () => {
  const secret = 'test-jwt-secret-key-min-32-chars!!';
  let db: D1Database;
  let env: WorkerEnv;

  beforeEach(() => {
    db = createTestD1Database();
    env = {
      DB: db,
      STORAGE: new MemoryR2Bucket() as unknown as R2Bucket,
      NODE_ENV: 'test',
      MOCK_EMAIL: 'true',
      JWT_SECRET: secret,
      ADMIN_EMAIL: 'admin@couple.io.vn',
      ADMIN_PASSWORD: 'StrongAdminPassword123',
      ADMIN_ENABLE_TEST_RESET: 'true',
      R2_PUBLIC_URL: 'https://pub-test.r2.dev',
    } as unknown as WorkerEnv;
  });

  it('completes OTP registration, couple joining, profile updates, random draw, and admin management', async () => {
    const app = createApp();

    // 1) User 1 sends OTP and creates couple
    const otp1Res = await app.request(
      'http://localhost/api/auth/send-otp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user1@couple.test' }),
      },
      env,
    );
    expect(otp1Res.status).toBe(200);

    const otpRow1 = await db
      .prepare('SELECT code FROM otp_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1')
      .bind('user1@couple.test')
      .first<{ code: string }>();
    expect(otpRow1?.code).toMatch(/^\d{6}$/);

    const verify1Res = await app.request(
      'http://localhost/api/auth/verify-otp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user1@couple.test', code: otpRow1!.code }),
      },
      env,
    );
    expect(verify1Res.status).toBe(200);

    const start1Res = await app.request(
      'http://localhost/api/auth/start',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'dev-1',
          displayName: 'Minh',
          partnerName: 'Linh',
          coupleCode: 'SUN2026',
          loveStartDate: '2024-02-14',
          email: 'user1@couple.test',
          password: 'Password123!',
          otpCode: otpRow1!.code,
        }),
      },
      env,
    );
    expect(start1Res.status).toBe(201);
    const auth1 = (await start1Res.json()) as {
      token: string;
      user: { id: string; displayName: string };
      couple: { id: string; code: string };
    };
    expect(auth1.couple.code).toBe('SUN2026');

    // 2) Trusted device login succeeds cleanly
    const loginRes = await app.request(
      'http://localhost/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user1@couple.test',
          password: 'Password123!',
          deviceId: 'dev-1',
        }),
      },
      env,
    );
    expect(loginRes.status).toBe(200);

    // 3) Reminder update & Random draw
    const remRes = await app.request(
      'http://localhost/api/me/reminder',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${auth1.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: true, time: '21:15', timezone: 'Asia/Ho_Chi_Minh' }),
      },
      env,
    );
    expect(remRes.status).toBe(200);
    await expect(remRes.json()).resolves.toMatchObject({
      reminderEnabled: true,
      reminderTime: '21:15',
    });

    const drawRes = await app.request(
      'http://localhost/api/random/draw',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth1.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'questions' }),
      },
      env,
    );
    expect(drawRes.status).toBe(201);

    // 4) Admin login, summary, and maintenance reset
    const adminLoginRes = await app.request(
      'http://localhost/api/admin/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@couple.io.vn', password: 'StrongAdminPassword123' }),
      },
      env,
    );
    expect(adminLoginRes.status).toBe(200);
    const { token: adminToken } = (await adminLoginRes.json()) as { token: string };

    const summaryRes = await app.request(
      'http://localhost/api/admin/summary',
      { headers: { Authorization: `Bearer ${adminToken}` } },
      env,
    );
    expect(summaryRes.status).toBe(200);
    await expect(summaryRes.json()).resolves.toMatchObject({
      totalUsers: 1,
      totalCouples: 1,
      totalRandomEvents: 1,
    });

    const resetRes = await app.request(
      'http://localhost/api/admin/maintenance/reset',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmation: 'RESET CHECK IN LOVE' }),
      },
      env,
    );
    expect(resetRes.status).toBe(200);
    await expect(resetRes.json()).resolves.toMatchObject({
      success: true,
      deleted: { users: 1, couples: 1, randomEvents: 1 },
    });
  });

  it('signs ES256 VAPID JWTs and encrypts RFC 8291 Web Push payloads with WebCrypto', async () => {
    const vapidPair = (await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )) as CryptoKeyPair;
    const vapidJwk = (await crypto.subtle.exportKey('jwk', vapidPair.privateKey)) as JsonWebKey;
    const vapidPubRaw = new Uint8Array((await crypto.subtle.exportKey('raw', vapidPair.publicKey)) as ArrayBuffer);

    const uaPair = (await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )) as CryptoKeyPair;
    const uaPubRaw = new Uint8Array((await crypto.subtle.exportKey('raw', uaPair.publicKey)) as ArrayBuffer);
    const authSecret = crypto.getRandomValues(new Uint8Array(16));

    const jwt = await createVapidJwt('https://fcm.googleapis.com/fcm/send/abc', {
      email: 'admin@couple.io.vn',
      publicKey: base64UrlEncode(vapidPubRaw),
      privateKey: vapidJwk.d!,
    });
    expect(jwt.split('.')).toHaveLength(3);

    const encrypted = await encryptWebPushPayload(
      {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: {
          p256dh: base64UrlEncode(uaPubRaw),
          auth: base64UrlEncode(authSecret),
        },
      },
      JSON.stringify({ title: 'Hello', body: 'World' }),
    );
    expect(encrypted.byteLength).toBeGreaterThan(86);
  });
});
