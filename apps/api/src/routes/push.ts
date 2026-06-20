import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env';
import { PushSubscription } from '../db/models/PushSubscription';
import { authenticate } from '../middleware/auth';

const subscribeBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

const unsubscribeBodySchema = z.object({
  endpoint: z.string().url(),
});

export default async function pushRoutes(app: FastifyInstance): Promise<void> {
  app.get('/push/config', async (_request, reply) => {
    return reply.status(200).send({
      enabled: Boolean(env.VAPID_PUBLIC_KEY),
      publicKey: env.VAPID_PUBLIC_KEY ?? null,
    });
  });

  /**
   * POST /push/subscribe — Register or update a push subscription
   */
  app.post(
    '/push/subscribe',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = subscribeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const { endpoint, keys, userAgent } = parsed.data;

      await PushSubscription.findOneAndUpdate(
        { endpoint },
        {
          userId: new Types.ObjectId(request.user.id),
          coupleId: new Types.ObjectId(request.user.coupleId),
          endpoint,
          keys,
          userAgent,
        },
        { upsert: true, new: true },
      );

      return reply.status(200).send({ success: true });
    },
  );

  /**
   * POST /push/unsubscribe — Remove a push subscription
   */
  app.post(
    '/push/unsubscribe',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = unsubscribeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const { endpoint } = parsed.data;

      await PushSubscription.deleteOne({
        endpoint,
        userId: new Types.ObjectId(request.user.id),
      });

      return reply.status(200).send({ success: true });
    },
  );
}
