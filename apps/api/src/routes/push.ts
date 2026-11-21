import { Hono } from 'hono';
import { z } from 'zod';
import { execute, findUserById, queryAll } from '../db/d1';
import { parseJsonSafe, type PushSubscriptionRow } from '../db/types';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const pushRoutes = new Hono<HonoAppEnv>();

const subscribeWebSchema = z.object({
  endpoint: z.string().trim().url('Endpoint push không hợp lệ'),
  keys: z.object({
    auth: z.string().trim().min(1),
    p256dh: z.string().trim().min(1),
  }),
  userAgent: z.string().trim().max(500).optional(),
});

const fcmTokenSchema = z
  .object({
    fcmToken: z.string().trim().min(1).max(4096).optional(),
    token: z.string().trim().min(1).max(4096).optional(),
  })
  .refine((v) => Boolean(v.fcmToken || v.token), {
    message: 'FCM token không hợp lệ',
  });

pushRoutes.get('/push/config', (c) => {
  const config = c.get('config');
  const enabled = Boolean(config.VAPID_PUBLIC_KEY);
  return c.json({
    enabled,
    publicKey: enabled ? config.VAPID_PUBLIC_KEY : null,
  });
});

pushRoutes.post('/push/subscribe', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const body = await c.req.json().catch(() => null);
  const parsed = subscribeWebSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Dữ liệu push không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const nowIso = new Date().toISOString();
  await execute(
    c.env.DB,
    `INSERT INTO push_subscriptions (
      id, user_id, couple_id, endpoint, keys_auth, keys_p256dh, user_agent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      couple_id = excluded.couple_id,
      keys_auth = excluded.keys_auth,
      keys_p256dh = excluded.keys_p256dh,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at`,
    [
      generateId(),
      auth.id,
      auth.coupleId,
      parsed.data.endpoint,
      parsed.data.keys.auth,
      parsed.data.keys.p256dh,
      parsed.data.userAgent ?? null,
      nowIso,
      nowIso,
    ],
  );

  return c.json({ success: true });
});

pushRoutes.post('/push/unsubscribe', authenticate, async (c) => {
  const auth = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as { endpoint?: string } | null;
  if (body?.endpoint) {
    await execute(
      c.env.DB,
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      [auth.id, body.endpoint.trim()],
    );
  } else {
    await execute(c.env.DB, 'DELETE FROM push_subscriptions WHERE user_id = ?', [auth.id]);
  }
  return c.json({ success: true });
});

pushRoutes.post('/push/subscribe-fcm', authenticate, async (c) => {
  const auth = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const parsed = fcmTokenSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'FCM token không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const fcmToken = (parsed.data.fcmToken ?? parsed.data.token)!;
  const user = (await findUserById(c.env.DB, auth.id))!;
  const existing = parseJsonSafe<string[]>(user.fcm_tokens_json, []);
  const next = Array.from(new Set([fcmToken, ...existing])).slice(0, 10);

  await execute(
    c.env.DB,
    'UPDATE users SET fcm_tokens_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(next), new Date().toISOString(), user.id],
  );

  return c.json({ success: true, tokenCount: next.length });
});

pushRoutes.post('/push/unsubscribe-fcm', authenticate, async (c) => {
  const auth = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as { fcmToken?: string; token?: string } | null;
  const user = await findUserById(c.env.DB, auth.id);
  if (!user) return c.json({ success: true });

  const tokenToRemove = body?.fcmToken?.trim() || body?.token?.trim();
  const existing = parseJsonSafe<string[]>(user.fcm_tokens_json, []);
  const next = tokenToRemove ? existing.filter((t) => t !== tokenToRemove) : [];

  await execute(
    c.env.DB,
    'UPDATE users SET fcm_tokens_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(next), new Date().toISOString(), user.id],
  );

  return c.json({ success: true });
});

pushRoutes.post('/push/test', authenticate, async (c) => {
  const auth = c.get('user')!;
  const user = await findUserById(c.env.DB, auth.id);
  const userName = user?.display_name || 'Bạn';
  const subs = await queryAll<PushSubscriptionRow>(
    c.env.DB,
    'SELECT id FROM push_subscriptions WHERE user_id = ?',
    [auth.id],
  );

  const fcmTokens = parseJsonSafe<string[]>(user?.fcm_tokens_json, []);
  const title = 'Kiểm tra thông báo 💕';
  const msgBody = `Xin chào ${userName}! Thông báo Check IN Love đang hoạt động rất tốt ✨`;

  await emitRealtimeEvent(c.env, auth.id, {
    type: 'reminder',
    title,
    body: msgBody,
    targetUrl: '/app/home',
    url: '/app/home',
    senderName: 'Check IN Love',
    senderAvatar: user?.avatar_url ?? undefined,
  });

  const result = await sendPushToUser(c.env, c.get('config'), auth.id, {
    title,
    body: msgBody,
    senderName: 'Check IN Love',
    senderAvatar: user?.avatar_url ?? undefined,
    actionType: 'reminder',
    kind: 'reminder',
    targetUrl: '/app/home',
    url: '/app/home',
    tag: 'push-test',
    type: 'reminder',
  });

  const targets: string[] = [];
  if (result.fcmSent > 0) targets.push(`${result.fcmSent} app Android (FCM)`);
  if (result.webSent > 0) targets.push(`${result.webSent} web browser`);

  return c.json({
    success: true,
    message: targets.length > 0
      ? `Đã gửi thông báo thành công tới ${targets.join(' và ')}! ✨`
      : 'Đã gửi thông báo tức thời tới ứng dụng của bạn! ✨',
    subscriptions: subs.length,
    fcmTokens: fcmTokens.length,
    delivered: result,
    details: {
      fcm: { sent: result.fcmSent },
      webPush: { sent: result.webSent },
    },
  });
});
