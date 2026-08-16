import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { FastifyInstance } from 'fastify';
import path from 'path';
import { env } from './config/env';
import adminRoutes from './routes/admin/index';
import authRoutes from './routes/auth';
import checkinsRoutes from './routes/checkins';
import healthRoutes from './routes/health';
import meRoutes from './routes/me';
import messagesRoutes from './routes/messages';
import messageStickerRoutes from './routes/message-stickers';
import passwordResetRoutes from './routes/password-reset';
import pushRoutes from './routes/push';
import randomRoutes from './routes/random';
import { eventRoutes } from './routes/events';
import { installCheckinReplyMessageSync } from './services/checkin-reply-message-sync';

function isDevelopmentOrigin(origin: string): boolean {
  if (env.NODE_ENV !== 'development') return false;

  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;

    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return true;
    }

    const octets = host.split('.').map((part) => Number(part));
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }

    return octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  } catch {
    return false;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: env.MAX_UPLOAD_MB * 1024 * 1024 + 1024 * 1024,
    logger:
      env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true },
            },
          }
        : false,
  });

  // Gracefully handle empty JSON body when Content-Type: application/json is sent
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // ─── Security ───────────────────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        cb(null, true);
        return;
      }

      const isAllowed = env.ALLOWED_ORIGINS.includes(origin) || isDevelopmentOrigin(origin);

      if (isAllowed) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ─── Rate Limiting ───────────────────────────────────────────────────────────
  await app.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      retryAfter: context.after,
    }),
  });

  // ─── File Uploads ────────────────────────────────────────────────────────────
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
      files: 1,
    },
  });

  // ─── Static Files (Uploads) ──────────────────────────────────────────────────
  await app.register(fastifyStatic, {
    root: path.resolve(env.UPLOAD_DIR),
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Keep CheckIn replies and the Messages collection synchronized immediately.
  installCheckinReplyMessageSync(app);

  // ─── Routes ──────────────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/api' });
  // Keep a root liveness endpoint for container/platform health probes.
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(passwordResetRoutes, { prefix: '/api' });
  await app.register(meRoutes, { prefix: '/api' });
  await app.register(checkinsRoutes, { prefix: '/api' });
  await app.register(messagesRoutes, { prefix: '/api' });
  await app.register(messageStickerRoutes, { prefix: '/api' });
  await app.register(randomRoutes, { prefix: '/api' });
  await app.register(pushRoutes, { prefix: '/api' });
  await app.register(eventRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });

  // ─── 404 Handler ─────────────────────────────────────────────────────────────
  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: 'Route not found',
      code: 'NOT_FOUND',
    });
  });

  // ─── Global Error Handler ────────────────────────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
      });
    }

    const statusCode = error.statusCode ?? 500;
    const message =
      env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : error.message;

    return reply.status(statusCode).send({
      error: message,
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}
