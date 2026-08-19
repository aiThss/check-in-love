import webpush from 'web-push';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { PushSubscription } from '../db/models/PushSubscription';
import { User } from '../db/models/User';
import { logger } from '../utils/logger';

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

let cachedAccessToken: { token: string; expiry: number } | null = null;

function hasFcmCredentials(): boolean {
  return Boolean(
    env.FCM_SERVICE_ACCOUNT_JSON ||
    env.FCM_SERVICE_ACCOUNT_FILE ||
    env.FCM_SERVER_KEY,
  );
}

function fcmTokenReference(token: string): string {
  if (token.length <= 12) return 'redacted';
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

async function getFcmAccessToken(): Promise<{ accessToken: string; projectId: string } | null> {
  try {
    let serviceAccount: ServiceAccount | null = null;
    if (env.FCM_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
      } catch (err) {
        logger.error('[push] Failed to parse FCM_SERVICE_ACCOUNT_JSON', err);
      }
    }
    if (!serviceAccount && env.FCM_SERVICE_ACCOUNT_FILE) {
      const filePath = path.resolve(env.FCM_SERVICE_ACCOUNT_FILE);
      if (fs.existsSync(filePath)) {
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }
    if (!serviceAccount) {
      const candidates = [
        path.resolve(process.cwd(), 'firebase-service-account.json'),
        path.resolve(process.cwd(), 'check-in-couple-firebase-adminsdk-fbsvc-a9244a86c4.json'),
        path.resolve(__dirname, '../../../../firebase-service-account.json'),
        path.resolve(__dirname, '../../../../check-in-couple-firebase-adminsdk-fbsvc-a9244a86c4.json'),
        '/app/firebase-service-account.json',
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            serviceAccount = JSON.parse(fs.readFileSync(candidate, 'utf8'));
            if (serviceAccount && serviceAccount.private_key) break;
          } catch {}
        }
      }
    }

    if (!serviceAccount) {
      return null;
    }

    // Return cached token if valid (expiry has 5 mins buffer)
    if (cachedAccessToken && cachedAccessToken.expiry > Date.now() + 300000) {
      return { accessToken: cachedAccessToken.token, projectId: serviceAccount.project_id };
    }

    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const signedJwt = jwt.sign(jwtPayload, serviceAccount.private_key, { algorithm: 'RS256' });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      }).toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('[push] Failed to exchange JWT for access token', null, { details: errText });
      return null;
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    cachedAccessToken = {
      token: data.access_token,
      expiry: Date.now() + data.expires_in * 1000,
    };

    return { accessToken: data.access_token, projectId: serviceAccount.project_id };
  } catch (err) {
    logger.error('[push] Error getting FCM access token', err);
    return null;
  }
}

let vapidInitialised = false;

function initVapid(): void {
  if (
    env.VAPID_PUBLIC_KEY &&
    env.VAPID_PRIVATE_KEY &&
    env.VAPID_EMAIL &&
    !vapidInitialised
  ) {
    webpush.setVapidDetails(
      `mailto:${env.VAPID_EMAIL}`,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    );
    vapidInitialised = true;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  kind?: 'checkin' | 'reaction' | 'reply' | 'reminder' | 'message';
  checkinId?: string;
  senderName?: string;
  senderAvatar?: string;
  actionType?: 'checkin' | 'reaction' | 'reply' | 'reminder' | 'message';
  targetUrl?: string;
  photoUrl?: string;
}

export interface PushResult {
  fcm: {
    attempted: number;
    sent: number;
    failed: number;
    tokensFound: number;
    hasCredentials: boolean;
    errors: string[];
  };
  webPush: {
    attempted: number;
    sent: number;
    failed: number;
  };
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  const result: PushResult = {
    fcm: {
      attempted: 0,
      sent: 0,
      failed: 0,
      tokensFound: 0,
      hasCredentials: hasFcmCredentials(),
      errors: [],
    },
    webPush: {
      attempted: 0,
      sent: 0,
      failed: 0,
    },
  };

  // Sync fields
  if (payload.kind && !payload.actionType) {
    payload.actionType = payload.kind;
  }
  if (payload.url && !payload.targetUrl) {
    payload.targetUrl = payload.url;
  }

  const rawAvatar = payload.senderAvatar || payload.icon || '';
  const senderAvatar = rawAvatar.startsWith('/')
    ? `${(env.PUBLIC_BASE_URL || 'https://couple.io.vn').replace(/\/$/, '')}${rawAvatar}`
    : rawAvatar;

  // 1. Send FCM Message (for Android APK Native Webview Wrapper)
  if (env.FCM_SERVICE_ACCOUNT_JSON || env.FCM_SERVICE_ACCOUNT_FILE) {
    try {
      const authData = await getFcmAccessToken();
      if (authData) {
        const { accessToken, projectId } = authData;
        const user = await User.findById(userId).lean();
        const fcmTokens = user?.fcmTokens || [];
        result.fcm.tokensFound = fcmTokens.length;

        if (fcmTokens.length > 0) {
          const fcmRequests = fcmTokens.map(async (token) => {
            result.fcm.attempted++;
            const fcmPayload = {
              message: {
                token: token,
                data: {
                  title: payload.title,
                  body: payload.body,
                  senderName: payload.senderName || '',
                  senderAvatar: senderAvatar,
                  actionType: payload.actionType || 'reminder',
                  targetUrl: payload.targetUrl || '/app/home',
                  checkinId: payload.checkinId || '',
                  photoUrl: payload.photoUrl || '',
                },
                android: {
                  priority: 'HIGH',
                },
              },
            };

            try {
              const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(fcmPayload),
              });
              if (!res.ok) {
                const text = await res.text();
                result.fcm.failed++;
                result.fcm.errors.push(text);
                logger.error('[push] FCM v1 send error for token', null, {
                  fcmToken: fcmTokenReference(token),
                  details: text,
                });
                if (text.includes('UNREGISTERED')) {
                  await User.findByIdAndUpdate(userId, {
                    $pull: { fcmTokens: token },
                  });
                  logger.info('[push] Removed unregistered FCM token', {
                    userId,
                    fcmToken: fcmTokenReference(token),
                  });
                }
              } else {
                result.fcm.sent++;
              }
            } catch (err: any) {
              result.fcm.failed++;
              result.fcm.errors.push(err?.message || 'Network error');
              logger.error('[push] FCM v1 network error for token', err, {
                fcmToken: fcmTokenReference(token),
              });
            }
          });
          await Promise.allSettled(fcmRequests);
        } else {
          logger.warn('[push] Android FCM skipped: recipient has no registered device token', {
            userId,
          });
        }
      } else {
        result.fcm.errors.push('Firebase Service Account authentication failed');
        logger.error('[push] Android FCM skipped: service-account credentials are unavailable', null, {
          userId,
        });
      }
    } catch (err: any) {
      result.fcm.errors.push(err?.message || 'FCM v1 dispatch error');
      logger.error('[push] Error sending FCM v1 message', err);
    }
  } else if (env.FCM_SERVER_KEY) {
    try {
      const user = await User.findById(userId).lean();
      const fcmTokens = user?.fcmTokens || [];
      result.fcm.tokensFound = fcmTokens.length;

      if (fcmTokens.length > 0) {
        result.fcm.attempted += fcmTokens.length;
        const fcmPayload = {
          registration_ids: fcmTokens,
          data: {
            title: payload.title,
            body: payload.body,
            senderName: payload.senderName || '',
            senderAvatar: senderAvatar,
            actionType: payload.actionType || 'reminder',
            targetUrl: payload.targetUrl || '/app/home',
            checkinId: payload.checkinId || '',
            photoUrl: payload.photoUrl || '',
          },
          priority: 'high',
        };

        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${env.FCM_SERVER_KEY}`,
          },
          body: JSON.stringify(fcmPayload),
        });
        if (!res.ok) {
          const text = await res.text();
          result.fcm.failed += fcmTokens.length;
          result.fcm.errors.push(text);
          logger.error('[push] FCM legacy server response error', null, { details: text });
        } else {
          result.fcm.sent += fcmTokens.length;
        }
      }
    } catch (err: any) {
      result.fcm.errors.push(err?.message || 'FCM legacy error');
      logger.error('[push] Error querying user for FCM tokens', err);
    }
  } else if (!hasFcmCredentials()) {
    result.fcm.errors.push('No FCM credentials configured on server');
    logger.warn('[push] Android FCM skipped: no server credential is configured', {
      userId,
      expected: 'FCM_SERVICE_ACCOUNT_JSON, FCM_SERVICE_ACCOUNT_FILE, or FCM_SERVER_KEY',
    });
  }

  // 2. Send Web Push (for iOS PWA / Chrome PWA)
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_EMAIL) {
    logger.warn(
      '[push] VAPID keys not configured — skipping Web Push notification',
    );
    return result;
  }

  initVapid();

  const subscriptions = await PushSubscription.find({ userId }).lean();
  if (subscriptions.length === 0) {
    return result;
  }

  const payloadStr = JSON.stringify(payload);

  const tasks = subscriptions.map(async (sub) => {
    result.webPush.attempted++;
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.keys.auth,
            p256dh: sub.keys.p256dh,
          },
        },
        payloadStr,
      );
      result.webPush.sent++;
    } catch (err: unknown) {
      result.webPush.failed++;
      const webErr = err as { statusCode?: number };
      if (webErr.statusCode === 410) {
        // Subscription is no longer valid — clean it up
        await PushSubscription.deleteOne({ _id: sub._id });
        logger.info(`[push] Removed expired subscription ${sub.endpoint}`);
      } else {
        logger.error('[push] Failed to send web notification', err);
      }
    }
  });

  await Promise.allSettled(tasks);
  return result;
}
