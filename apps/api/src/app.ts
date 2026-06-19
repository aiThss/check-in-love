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
import pushRoutes from './routes/push';
import randomRoutes from './routes/random';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
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

  // ─── Security ───────────────────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin) {
        // Allow requests with no origin (e.g., curl, mobile apps)
        cb(null, true);
        return;
      }
      if (env.ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`), false);
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

  // ─── Routes ──────────────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(meRoutes, { prefix: '/api' });
  await app.register(checkinsRoutes, { prefix: '/api' });
  await app.register(randomRoutes, { prefix: '/api' });
  await app.register(pushRoutes, { prefix: '/api' });
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
