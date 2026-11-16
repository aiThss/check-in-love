import { Hono } from 'hono';
import { z } from 'zod';
import { execute, findUserById, queryAll } from '../db/d1';
import { parseJsonSafe, type PushSubscriptionRow } from '../db/types';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
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

const fcmTokenSchema = z.object({
  token: z.string().trim().min(10, 'FCM token không hợp lệ').max(4096),
});

pushRoutes.get('/push/config', authenticate, (c) => {
  const config = c.get('config');
  const enabled = Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
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

  const user = (await findUserById(c.env.DB, auth.id))!;
  const existing = parseJsonSafe<string[]>(user.fcm_tokens_json, []);
  const next = Array.from(new Set([parsed.data.token, ...existing])).slice(0, 10);

  await execute(
    c.env.DB,
    'UPDATE users SET fcm_tokens_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(next), new Date().toISOString(), user.id],
  );

  return c.json({ success: true, tokenCount: next.length });
});

pushRoutes.post('/push/unsubscribe-fcm', authenticate, async (c) => {
  const auth = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as { token?: string } | null;
  const user = await findUserById(c.env.DB, auth.id);
  if (!user) return c.json({ success: true });

  const existing = parseJsonSafe<string[]>(user.fcm_tokens_json, []);
  const next = body?.token ? existing.filter((t) => t !== body.token!.trim()) : [];

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
  const subs = await queryAll<PushSubscriptionRow>(
    c.env.DB,
    'SELECT id FROM push_subscriptions WHERE user_id = ?',
    [auth.id],
  );

  const fcmTokens = parseJsonSafe<string[]>(user?.fcm_tokens_json, []);
  const result = await sendPushToUser(c.env, c.get('config'), auth.id, {
    title: 'Check IN Love 💕',
    body: 'Thông báo đẩy đang hoạt động mượt mà!',
    url: '/app/home',
    tag: 'push-test',
    type: 'test',
  });

  return c.json({
    success: true,
    subscriptions: subs.length,
    fcmTokens: fcmTokens.length,
    delivered: result,
  });
});
