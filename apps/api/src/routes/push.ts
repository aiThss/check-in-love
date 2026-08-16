import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env';
import { PushSubscription } from '../db/models/PushSubscription';
import { User } from '../db/models/User';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';

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

  const subscribeFcmBodySchema = z.object({
    fcmToken: z.string().min(1),
  });

  /**
   * POST /push/subscribe-fcm — Register FCM token
   */
  app.post(
    '/push/subscribe-fcm',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = subscribeFcmBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const { fcmToken } = parsed.data;

      await User.findByIdAndUpdate(
        request.user.id,
        { $addToSet: { fcmTokens: fcmToken } }
      );

      return reply.status(200).send({ success: true });
    },
  );

  /**
   * POST /push/unsubscribe-fcm — Unregister FCM token
   */
  app.post(
    '/push/unsubscribe-fcm',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = subscribeFcmBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const { fcmToken } = parsed.data;

      await User.findByIdAndUpdate(
        request.user.id,
        { $pull: { fcmTokens: fcmToken } }
      );

      return reply.status(200).send({ success: true });
    },
  );

  /**
   * POST /push/test — Send a test push notification to the current user
   */
  app.post(
    '/push/test',
    { preHandler: authenticate },
    async (request, reply) => {
      const user = await User.findById(request.user.id).lean();
      const userName = user?.displayName || 'Bạn';

      try {
        await sendPushToUser(request.user.id, {
          title: 'Kiểm tra thông báo 💕',
          body: `Xin chào ${userName}! Thông báo Check IN Love đang hoạt động rất tốt ✨`,
          senderName: 'Check IN Love',
          senderAvatar: user?.avatarUrl || '',
          actionType: 'reminder',
          targetUrl: '/app/home',
          url: '/app/home',
        });
        return reply.status(200).send({ success: true, message: 'Đã gửi thông báo thử nghiệm thành công' });
      } catch (err) {
        app.log.error({ err }, 'Failed to send test push notification');
        return reply.status(500).send({ error: 'Không thể gửi thông báo thử nghiệm', code: 'PUSH_ERROR' });
      }
    },
  );
}
