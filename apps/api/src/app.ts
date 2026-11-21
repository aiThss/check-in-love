import { Hono } from 'hono';
import { resolveConfig } from './config/env';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { chatBackgroundRoutes } from './routes/chat-background';
import { checkinRoutes } from './routes/checkins';
import { eventRoutes } from './routes/events';
import { healthRoutes } from './routes/health';
import { journeyRoutes } from './routes/journey';
import { meRoutes } from './routes/me';
import { messageStickerRoutes } from './routes/message-stickers';
import { messageRoutes } from './routes/messages';
import { passwordResetRoutes } from './routes/password-reset';
import { pushRoutes } from './routes/push';
import { randomRoutes } from './routes/random';
import type { HonoAppEnv } from './types/hono';
import { AppError } from './utils/errors';
import { logger } from './utils/logger';
import { isAllowedOrigin } from './utils/origin';

export function createApp(): Hono<HonoAppEnv> {
  const app = new Hono<HonoAppEnv>();

  // Resolve runtime config from Worker env per request
  app.use('*', async (c, next) => {
    c.set('config', resolveConfig(c.env));
    await next();
  });

  // Security headers + dynamic CORS matching ALLOWED_ORIGINS + *.couple.io.vn
  app.use('*', async (c, next) => {
    const config = c.get('config');
    const origin = c.req.header('origin');
    const allowedOrigin = isAllowedOrigin(origin, config);

    if (c.req.method === 'OPTIONS') {
      const headers = new Headers();
      if (allowedOrigin) {
        headers.set('Access-Control-Allow-Origin', allowedOrigin);
        headers.set('Access-Control-Allow-Credentials', 'true');
        headers.set('Vary', 'Origin');
      }
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      headers.set('Access-Control-Max-Age', '86400');
      return new Response(null, { status: 204, headers });
    }

    await next();

    if (allowedOrigin) {
      c.res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.append('Vary', 'Origin');
    }
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        {
          error: err.message,
          message: err.message,
          code: err.code,
        },
        err.statusCode as 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503,
      );
    }

    logger.error('Unhandled API error', err, { path: c.req.path, method: c.req.method });
    return c.json(
      {
        error: 'Đã xảy ra lỗi máy chủ nội bộ',
        message: 'Đã xảy ra lỗi máy chủ nội bộ',
        code: 'INTERNAL_ERROR',
      },
      500,
    );
  });

  // Health & R2 upload fallback
  app.route('/', healthRoutes);
  app.get('/uploads/*', async (c) => {
    const key = c.req.path.replace(/^\/+uploads\//, '');
    if (!key || key.includes('..') || !c.env?.STORAGE) {
      return c.json({ error: 'Không tìm thấy tệp', message: 'Không tìm thấy tệp', code: 'NOT_FOUND' }, 404);
    }
    const obj = await c.env.STORAGE.get(key);
    if (!obj) {
      return c.json({ error: 'Không tìm thấy tệp', message: 'Không tìm thấy tệp', code: 'NOT_FOUND' }, 404);
    }
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    if (!headers.has('cache-control')) {
      headers.set('cache-control', 'public, max-age=31536000, immutable');
    }
    headers.set('etag', obj.httpEtag);
    return new Response(obj.body, { headers });
  });

  // Core /api routes
  const api = new Hono<HonoAppEnv>();
  api.route('/', healthRoutes);
  api.route('/', authRoutes);
  api.route('/', passwordResetRoutes);
  api.route('/', meRoutes);
  api.route('/', checkinRoutes);
  api.route('/', messageRoutes);
  api.route('/', messageStickerRoutes);
  api.route('/', chatBackgroundRoutes);
  api.route('/', journeyRoutes);
  api.route('/', randomRoutes);
  api.route('/', pushRoutes);
  api.route('/', eventRoutes);
  api.route('/admin', adminRoutes);

  app.route('/api', api);

  app.notFound((c) =>
    c.json(
      {
        error: 'Đường dẫn API không tồn tại',
        message: 'Đường dẫn API không tồn tại',
        code: 'NOT_FOUND',
      },
      404,
    ),
  );

  return app;
}
