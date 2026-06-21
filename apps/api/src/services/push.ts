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
  kind?: 'checkin' | 'reaction' | 'reply' | 'reminder';
  checkinId?: string;
  senderName?: string;
  senderAvatar?: string;
  actionType?: 'checkin' | 'reaction' | 'reply' | 'reminder';
  targetUrl?: string;
  photoUrl?: string;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  // Sync fields
  if (payload.kind && !payload.actionType) {
    payload.actionType = payload.kind;
  }
  if (payload.url && !payload.targetUrl) {
    payload.targetUrl = payload.url;
  }

  // 1. Send FCM Data Message (for Android APK Native Webview Wrapper)
  if (env.FCM_SERVICE_ACCOUNT_JSON || env.FCM_SERVICE_ACCOUNT_FILE) {
    try {
      const authData = await getFcmAccessToken();
      if (authData) {
        const { accessToken, projectId } = authData;
        const user = await User.findById(userId).lean();
        if (user && user.fcmTokens && user.fcmTokens.length > 0) {
          const fcmRequests = user.fcmTokens.map(async (token) => {
            const fcmPayload = {
              message: {
                token: token,
                data: {
                  title: payload.title,
                  body: payload.body,
                  senderName: payload.senderName || '',
                  senderAvatar: payload.senderAvatar || '',
                  actionType: payload.actionType || 'reminder',
                  targetUrl: payload.targetUrl || '/app/home',
                  checkinId: payload.checkinId || '',
                  photoUrl: payload.photoUrl || '',
                },
                android: {
                  priority: 'high',
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
                logger.error('[push] FCM v1 send error for token', null, { token, details: text });
              }
            } catch (err) {
              logger.error('[push] FCM v1 network error for token', err, { token });
            }
          });
          await Promise.allSettled(fcmRequests);
        }
      }
    } catch (err) {
      logger.error('[push] Error sending FCM v1 message', err);
    }
  } else if (env.FCM_SERVER_KEY) {
    try {
      const user = await User.findById(userId).lean();
      if (user && user.fcmTokens && user.fcmTokens.length > 0) {
        const fcmPayload = {
          registration_ids: user.fcmTokens,
          data: {
            title: payload.title,
            body: payload.body,
            senderName: payload.senderName || '',
            senderAvatar: payload.senderAvatar || '',
            actionType: payload.actionType || 'reminder',
            targetUrl: payload.targetUrl || '/app/home',
            checkinId: payload.checkinId || '',
            photoUrl: payload.photoUrl || '',
          },
          priority: 'high',
        };

        fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${env.FCM_SERVER_KEY}`,
          },
          body: JSON.stringify(fcmPayload),
        })
          .then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              logger.error('[push] FCM legacy server response error', null, { details: text });
            }
          })
          .catch((err) => {
            logger.error('[push] FCM legacy fetch network error', err);
          });
      }
    } catch (err) {
      logger.error('[push] Error querying user for FCM tokens', err);
    }
  }

  // 2. Send Web Push (for iOS PWA / Chrome PWA)
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_EMAIL) {
    logger.warn(
      '[push] VAPID keys not configured — skipping Web Push notification',
    );
    return;
  }

  initVapid();

  const subscriptions = await PushSubscription.find({ userId }).lean();
  if (subscriptions.length === 0) {
    return;
  }

  const payloadStr = JSON.stringify(payload);

  const tasks = subscriptions.map(async (sub) => {
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
    } catch (err: unknown) {
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
}
