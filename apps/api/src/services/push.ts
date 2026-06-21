import webpush from 'web-push';
import { env } from '../config/env';
import { PushSubscription } from '../db/models/PushSubscription';
import { User } from '../db/models/User';

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
  if (env.FCM_SERVER_KEY) {
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
              console.error('[push] FCM server response error:', text);
            } else {
              console.info(`[push] FCM sent successfully to ${user.fcmTokens?.length} tokens`);
            }
          })
          .catch((err) => {
            console.error('[push] FCM fetch network error:', err);
          });
      }
    } catch (err) {
      console.error('[push] Error querying user for FCM tokens:', err);
    }
  }

  // 2. Send Web Push (for iOS PWA / Chrome PWA)
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_EMAIL) {
    console.warn(
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
        console.info(`[push] Removed expired subscription ${sub.endpoint}`);
      } else {
        console.error('[push] Failed to send web notification:', err);
      }
    }
  });

  await Promise.allSettled(tasks);
}
