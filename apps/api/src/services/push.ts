import webpush from 'web-push';
import { env } from '../config/env';
import { PushSubscription } from '../db/models/PushSubscription';

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
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_EMAIL) {
    console.warn(
      '[push] VAPID keys not configured — skipping push notification',
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
        console.error('[push] Failed to send notification:', err);
      }
    }
  });

  await Promise.allSettled(tasks);
}
