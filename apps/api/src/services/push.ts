import type { AppConfig, WorkerEnv } from '../config/env';
import { execute, findUserById, queryAll } from '../db/d1';
import { parseJsonSafe, type PushSubscriptionRow } from '../db/types';
import { base64UrlEncode } from '../utils/crypto';
import { logger } from '../utils/logger';
import { sendWebPushNotification } from './webpush';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  type?: string;
  checkinId?: string;
  messageId?: string;
  senderName?: string;
  senderAvatar?: string;
  photoUrl?: string;
}

interface FcmServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedFcmToken: { token: string; expiresAt: number; clientEmail: string } | null = null;

function parseServiceAccount(jsonStr: string): FcmServiceAccount | null {
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr) as Partial<FcmServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed as FcmServiceAccount;
  } catch {
    return null;
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getFcmAccessToken(sa: FcmServiceAccount): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    cachedFcmToken &&
    cachedFcmToken.clientEmail === sa.client_email &&
    cachedFcmToken.expiresAt > nowSec + 60
  ) {
    return cachedFcmToken.token;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: tokenUri,
      exp: nowSec + 3600,
      iat: nowSec,
    }),
  );

  const signingInput = `${header}.${claimSet}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(signingInput),
    ),
  );

  const assertion = `${signingInput}.${base64UrlEncode(signature)}`;
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`FCM OAuth token exchange failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedFcmToken = {
    token: data.access_token,
    expiresAt: nowSec + (data.expires_in ?? 3600),
    clientEmail: sa.client_email,
  };
  return data.access_token;
}

async function sendSingleFcm(
  sa: FcmServiceAccount,
  accessToken: string,
  fcmToken: string,
  payload: PushPayload,
): Promise<{ ok: boolean; removeToken?: boolean }> {
  const dataPayload: Record<string, string> = {
    title: payload.title,
    body: payload.body,
    url: payload.url || '/app/home',
    type: payload.type || 'general',
  };
  if (payload.checkinId) dataPayload.checkinId = payload.checkinId;
  if (payload.messageId) dataPayload.messageId = payload.messageId;
  if (payload.senderName) dataPayload.senderName = payload.senderName;
  if (payload.senderAvatar) dataPayload.senderAvatar = payload.senderAvatar;
  if (payload.photoUrl) dataPayload.photoUrl = payload.photoUrl;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        data: dataPayload,
        android: {
          priority: 'HIGH',
          ttl: '86400s',
        },
      },
    }),
  });

  if (res.ok) {
    return { ok: true };
  }

  const errText = await res.text();
  const isUnregistered =
    res.status === 404 ||
    errText.includes('UNREGISTERED') ||
    errText.includes('Requested entity was not found') ||
    (res.status === 400 && errText.includes('not a valid FCM registration token'));

  if (!isUnregistered) {
    logger.warn('FCM send error', { status: res.status, body: errText.slice(0, 300) });
  }
  return { ok: false, removeToken: isUnregistered };
}

export async function sendPushToUser(
  env: Pick<WorkerEnv, 'DB'>,
  config: AppConfig,
  userId: string,
  payload: PushPayload,
): Promise<{ webSent: number; fcmSent: number }> {
  let webSent = 0;
  let fcmSent = 0;

  const user = await findUserById(env.DB, userId);
  if (!user || user.status === 'blocked') {
    return { webSent: 0, fcmSent: 0 };
  }

  const sa = parseServiceAccount(config.FCM_SERVICE_ACCOUNT_JSON);
  const fcmTokens = parseJsonSafe<string[]>(user.fcm_tokens_json, []);

  if (sa && fcmTokens.length > 0) {
    try {
      const accessToken = await getFcmAccessToken(sa);
      const tokensToRemove = new Set<string>();
      await Promise.all(
        fcmTokens.map(async (token) => {
          const result = await sendSingleFcm(sa, accessToken, token, payload);
          if (result.ok) fcmSent += 1;
          else if (result.removeToken) tokensToRemove.add(token);
        }),
      );

      if (tokensToRemove.size > 0) {
        const remaining = fcmTokens.filter((t) => !tokensToRemove.has(t));
        await execute(
          env.DB,
          'UPDATE users SET fcm_tokens_json = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(remaining), new Date().toISOString(), userId],
        );
      }
    } catch (err) {
      logger.error('Failed to send FCM push batch', err, { userId });
    }
  }

  if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
    const subs = await queryAll<PushSubscriptionRow>(
      env.DB,
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [userId],
    );

    if (subs.length > 0) {
      const bodyStr = JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/app/home',
        icon: payload.icon || '/assets/icon-192.png',
        badge: payload.badge || '/assets/badge-72.png',
        tag: payload.tag || 'lovecheck-notif',
        type: payload.type || 'general',
        checkinId: payload.checkinId,
        messageId: payload.messageId,
        senderAvatar: payload.senderAvatar,
        photoUrl: payload.photoUrl,
      });

      const vapid = {
        email: config.VAPID_EMAIL || 'admin@couple.io.vn',
        publicKey: config.VAPID_PUBLIC_KEY,
        privateKey: config.VAPID_PRIVATE_KEY,
      };

      await Promise.all(
        subs.map(async (sub) => {
          try {
            const res = await sendWebPushNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
              },
              bodyStr,
              vapid,
            );
            if (res.ok) {
              webSent += 1;
            } else if (res.status === 404 || res.status === 410) {
              await execute(env.DB, 'DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
            }
          } catch (err) {
            logger.warn('Web push send failed', { userId, subId: sub.id, err: String(err) });
          }
        }),
      );
    }
  }

  return { webSent, fcmSent };
}
