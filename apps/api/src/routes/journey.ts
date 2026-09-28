import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Couple } from '../db/models/Couple';
import { CoupleJourney, BucketItem, LovePlace } from '../db/models/CoupleJourney';
import { User } from '../db/models/User';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from './events';

const bucketItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  category: z.enum(['dating', 'travel', 'cozy', 'adventure', 'future']).default('dating'),
  completed: z.boolean().default(false),
  completedDate: z.string().max(40).optional().nullable().transform((v) => v || undefined),
  note: z.string().max(1000).optional().nullable().transform((v) => v || undefined),
  isCustom: z.boolean().optional(),
});

const placeSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  region: z.enum(['north', 'central', 'south', 'islands']).optional(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.enum(['visited', 'wishlist']).default('wishlist'),
  visitedDate: z.string().max(40).optional().nullable().transform((v) => v || undefined),
  note: z.string().max(1000).optional().nullable().transform((v) => v || undefined),
  photoUrl: z.string().max(2048).optional().nullable().transform((v) => v || undefined),
  x: z.number().optional(),
  y: z.number().optional(),
});

const updateJourneySchema = z.object({
  places: z.array(placeSchema).optional(),
  bucketItems: z.array(bucketItemSchema).optional(),
  actionType: z.enum([
    'add_bucket',
    'edit_bucket',
    'delete_bucket',
    'complete_bucket',
    'uncomplete_bucket',
    'add_place',
    'edit_place',
    'delete_place',
    'visit_place',
    'sync',
  ]).optional(),
  itemTitle: z.string().max(300).optional(),
});

const syncJourneySchema = z.object({
  localPlaces: z.array(placeSchema).optional().default([]),
  localBucketItems: z.array(bucketItemSchema).optional().default([]),
});

export function buildNotification(
  actionType: string | undefined,
  displayName: string,
  itemTitle?: string,
): { title: string; body: string } | null {
  if (!actionType || !itemTitle) return null;

  switch (actionType) {
    case 'add_bucket':
      return {
        title: 'Điều ước mới cùng nhau ✨',
        body: `${displayName} vừa thêm điều ước: "${itemTitle}"`,
      };
    case 'complete_bucket':
      return {
        title: 'Điều ước đã hoàn thành! 🎉',
        body: `${displayName} đã cùng bạn hoàn thành điều ước: "${itemTitle}" 💕`,
      };
    case 'add_place':
      return {
        title: 'Toạ độ kỷ niệm mới 📍',
        body: `${displayName} đã thêm "${itemTitle}" vào bản đồ hẹn hò!`,
      };
    case 'visit_place':
      return {
        title: 'Đánh dấu điểm đến! ✈️',
        body: `${displayName} đã đánh dấu đã ghé thăm "${itemTitle}"!`,
      };
    default:
      return null;
  }
}

export default async function journeyRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /journey — Retrieve the couple's cloud journey (places & bucket items)
   */
  app.get('/journey', { preHandler: authenticate }, async (request, reply) => {
    const coupleId = new Types.ObjectId(request.user.coupleId);
    const journey = await CoupleJourney.findOne({ coupleId }).lean();

    return reply.status(200).send({
      places: journey?.places ?? [],
      bucketItems: journey?.bucketItems ?? [],
    });
  });

  /**
   * PUT /journey — Update or replace the couple's journey data and notify partner
   */
  app.put('/journey', { preHandler: authenticate }, async (request, reply) => {
    const parsed = updateJourneySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0].message,
        code: 'VALIDATION_ERROR',
      });
    }

    const { places, bucketItems, actionType, itemTitle } = parsed.data;
    const coupleId = new Types.ObjectId(request.user.coupleId);
    const userId = new Types.ObjectId(request.user.id);

    const user = await User.findById(userId).lean();
    if (!user) {
      return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });
    }

    let journey = await CoupleJourney.findOne({ coupleId });
    if (!journey) {
      journey = new CoupleJourney({
        coupleId,
        places: places ?? [],
        bucketItems: bucketItems ?? [],
      });
    } else {
      if (places !== undefined) {
        journey.places = places as LovePlace[];
      }
      if (bucketItems !== undefined) {
        journey.bucketItems = bucketItems as BucketItem[];
      }
    }

    await journey.save();

    // Notify partner via SSE (Layer 2) and FCM/WebPush (Layer 1 & 3)
    const couple = await Couple.findById(coupleId).lean();
    if (couple) {
      const partnerId = couple.memberIds.find((id) => id.toString() !== request.user.id);
      if (partnerId) {
        const notif = buildNotification(actionType, user.displayName, itemTitle);

        emitRealtimeEvent(partnerId.toString(), {
          type: 'journey.updated',
          title: notif?.title || '',
          body: notif?.body || '',
          targetUrl: actionType?.includes('place') ? '/app/journey?tab=map' : '/app/journey?tab=bucket',
          senderName: user.displayName,
          senderAvatar: user.avatarUrl,
          journey: {
            places: journey.places,
            bucketItems: journey.bucketItems,
          },
        });

        if (notif) {
          Promise.resolve(
            sendPushToUser(partnerId.toString(), {
              title: notif.title,
              body: notif.body,
              icon: user.avatarUrl,
              badge: '/icons/icon-192.png',
              url: actionType?.includes('place') ? '/app/journey?tab=map' : '/app/journey?tab=bucket',
              tag: `journey-${Date.now()}`,
              kind: 'journey',
              senderName: user.displayName,
              senderAvatar: user.avatarUrl,
              actionType: 'journey',
              targetUrl: actionType?.includes('place') ? '/app/journey?tab=map' : '/app/journey?tab=bucket',
            }),
          ).catch((err) => {
            app.log?.error?.({ err }, 'Failed to send journey push notification');
          });
        }
      }
    }

    return reply.status(200).send({
      places: journey.places,
      bucketItems: journey.bucketItems,
    });
  });

  /**
   * POST /journey/sync — Merge client-side local items (e.g. from APK localStorage) with cloud DB
   */
  app.post('/journey/sync', { preHandler: authenticate }, async (request, reply) => {
    const parsed = syncJourneySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0].message,
        code: 'VALIDATION_ERROR',
      });
    }

    const { localPlaces, localBucketItems } = parsed.data;
    const coupleId = new Types.ObjectId(request.user.coupleId);

    let journey = await CoupleJourney.findOne({ coupleId });
    let hasNewChanges = false;

    if (!journey) {
      journey = new CoupleJourney({
        coupleId,
        places: localPlaces as LovePlace[],
        bucketItems: localBucketItems as BucketItem[],
      });
      if (localPlaces.length > 0 || localBucketItems.length > 0) {
        hasNewChanges = true;
      }
      await journey.save();
    } else {
      // Merge Bucket Items
      const serverBucketMap = new Map(journey.bucketItems.map((b) => [b.id, b]));
      for (const item of localBucketItems) {
        if (!serverBucketMap.has(item.id)) {
          journey.bucketItems.push(item as BucketItem);
          serverBucketMap.set(item.id, item as BucketItem);
          hasNewChanges = true;
        } else {
          // If local item is marked completed but server isn't, respect completion
          const existing = serverBucketMap.get(item.id)!;
          if (!existing.completed && item.completed) {
            existing.completed = true;
            existing.completedDate = item.completedDate || existing.completedDate;
            hasNewChanges = true;
          }
        }
      }

      // Merge Places
      const serverPlaceMap = new Map(journey.places.map((p) => [p.id, p]));
      for (const place of localPlaces) {
        if (!serverPlaceMap.has(place.id)) {
          journey.places.push(place as LovePlace);
          serverPlaceMap.set(place.id, place as LovePlace);
          hasNewChanges = true;
        } else {
          const existing = serverPlaceMap.get(place.id)!;
          if (existing.status !== 'visited' && place.status === 'visited') {
            existing.status = 'visited';
            existing.visitedDate = place.visitedDate || existing.visitedDate;
            hasNewChanges = true;
          }
        }
      }

      if (hasNewChanges) {
        await journey.save();
      }
    }

    if (hasNewChanges) {
      const couple = await Couple.findById(coupleId).lean();
      if (couple) {
        const partnerId = couple.memberIds.find((id) => id.toString() !== request.user.id);
        if (partnerId) {
          emitRealtimeEvent(partnerId.toString(), {
            type: 'journey.updated',
            title: '',
            body: '',
            targetUrl: '/app/journey',
            journey: {
              places: journey.places,
              bucketItems: journey.bucketItems,
            },
          });
        }
      }
    }

    return reply.status(200).send({
      places: journey.places,
      bucketItems: journey.bucketItems,
    });
  });
}
