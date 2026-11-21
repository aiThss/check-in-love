import { Hono } from 'hono';
import { RANDOM_CATEGORIES, RANDOM_PROMPTS } from '../constants';
import { execute, findPartnerUser, findUserById, queryAll } from '../db/d1';
import { toRandomEventDto, type RandomEventRow } from '../db/types';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const randomRoutes = new Hono<HonoAppEnv>();

const VALID_CATEGORIES = new Set<string>(RANDOM_CATEGORIES.map((item) => item.category));

randomRoutes.get('/random/categories', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const rows = await queryAll<{ category: string; cnt: number }>(
    c.env.DB,
    `SELECT category, COUNT(*) AS cnt
     FROM random_events
     WHERE couple_id = ?
     GROUP BY category`,
    [auth.coupleId],
  );
  const countMap = new Map<string, number>(rows.map((r) => [r.category, Number(r.cnt)]));
  const categories = RANDOM_CATEGORIES.map((cat) => ({
    ...cat,
    usageCount: countMap.get(cat.category) ?? 0,
  }));

  return c.json({ categories });
});

randomRoutes.get('/random/history', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const limit = Math.min(50, Math.max(1, Number.parseInt(c.req.query('limit') || '10', 10) || 10));
  const rows = await queryAll<RandomEventRow>(
    c.env.DB,
    `SELECT * FROM random_events
     WHERE couple_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [auth.coupleId, limit],
  );

  return c.json({ events: rows.map(toRandomEventDto) });
});

randomRoutes.post('/random/draw', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const body = (await c.req.json().catch(() => null)) as { category?: string } | null;
  const rawCategory = body?.category?.trim();

  if (rawCategory && !VALID_CATEGORIES.has(rawCategory)) {
    throw new AppError('Chủ đề ngẫu nhiên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const category = rawCategory || RANDOM_CATEGORIES[Math.floor(Math.random() * RANDOM_CATEGORIES.length)].category;
  const pool = RANDOM_PROMPTS[category as keyof typeof RANDOM_PROMPTS] ?? RANDOM_PROMPTS.questions;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const id = generateId();
  const nowIso = new Date().toISOString();

  await execute(
    c.env.DB,
    `INSERT INTO random_events (id, couple_id, user_id, category, prompt, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.coupleId, auth.id, category, chosen.prompt, chosen.detail ?? null, nowIso],
  );

  const eventRow: RandomEventRow = {
    id,
    couple_id: auth.coupleId,
    user_id: auth.id,
    category,
    prompt: chosen.prompt,
    detail: chosen.detail ?? null,
    created_at: nowIso,
  };

  const user = await findUserById(c.env.DB, auth.id);
  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner && user) {
    const title = `${user.display_name} vừa bốc thẻ Vũ trụ! 🎲`;
    await Promise.allSettled([
      sendPushToUser(c.env, c.get('config'), partner.id, {
        title,
        body: chosen.prompt,
        url: '/app/random',
        tag: `random-${id}`,
        type: 'random',
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: 'random.drawn',
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title,
        body: chosen.prompt,
        url: '/app/random',
      }),
    ]);
  }

  return c.json({
    category,
    prompt: chosen.prompt,
    detail: chosen.detail,
    event: toRandomEventDto(eventRow),
  }, 201);
});
