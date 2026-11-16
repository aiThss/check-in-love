import { Hono } from 'hono';
import { findUserById } from '../db/d1';
import type { HonoAppEnv } from '../types/hono';
import { verifyJwt } from '../utils/crypto';
import { AppError } from '../utils/errors';

export const eventRoutes = new Hono<HonoAppEnv>();

eventRoutes.get('/events', async (c) => {
  const authHeader = c.req.header('authorization');
  const queryToken = c.req.query('token');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : queryToken?.trim();

  if (!token) {
    throw new AppError('Thiếu token xác thực SSE', 401, 'UNAUTHORIZED');
  }

  const config = c.get('config');
  const payload = await verifyJwt<{ userId?: string; id?: string; sub?: string; role?: string }>(
    token,
    config.JWT_SECRET,
  );
  const userId = payload?.userId ?? payload?.id ?? (payload?.role !== 'admin' ? payload?.sub : undefined);
  if (!payload || !userId || payload.role === 'admin') {
    throw new AppError('Token SSE không hợp lệ', 401, 'UNAUTHORIZED');
  }

  const user = await findUserById(c.env.DB, String(userId));
  if (!user || user.status === 'blocked') {
    throw new AppError('Tài khoản không khả dụng', 403, 'USER_BLOCKED');
  }

  if (!c.env.REALTIME_HUB) {
    // Graceful SSE fallback when Durable Object binding is absent in unit tests
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  }

  const stub = c.env.REALTIME_HUB.get(c.env.REALTIME_HUB.idFromName(user.id));
  return stub.fetch(
    new Request('https://realtime/connect', {
      method: 'GET',
      signal: c.req.raw.signal,
    }),
  );
});
