import { MultipartFile } from '@fastify/multipart';
import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import { env } from '../config/env';
import { CheckIn, ReactionType } from '../db/models/CheckIn';
import { Couple } from '../db/models/Couple';
import { User } from '../db/models/User';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { storageService } from '../services/storage';
import { updateStreak } from '../services/streak';

const createCheckInBodySchema = z.object({
  type: z.enum(['text', 'mood']),
  caption: z.string().max(280).optional(),
  mood: z
    .enum(['happy', 'miss', 'tired', 'studying', 'out', 'eating', 'needhug'])
    .optional(),
  quickMessage: z.string().max(100).optional(),
});

const addReactionSchema = z.object({
  type: z.string().trim().min(1).max(32),
});

const addReplySchema = z.object({
  message: z.string().trim().min(1).max(500),
});

const legacyReactionMap: Record<string, string> = {
  heart: '❤️',
  hug: '🤗',
  kiss: '😘',
  laugh: '😂',
  miss: '🥺',
  wow: '🥰',
  fire: '🔥',
  sad: '😭',
};

function normalizeReactionType(type: string): string {
  const trimmed = type.trim();
  return legacyReactionMap[trimmed] ?? trimmed;
}

async function readMultipartBuffer(
  part: MultipartFile,
  maxBytes: number,
): Promise<{ buffer: Buffer; mimetype: string; filename: string }> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of part.file) {
    total += chunk.length;
    if (total > maxBytes) {
      throw Object.assign(new Error('File too large'), { code: 'FILE_TOO_LARGE' });
    }
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    mimetype: part.mimetype,
    filename: part.filename,
  };
}

export default async function checkinsRoutes(
  app: FastifyInstance,
): Promise<void> {
  /**
   * GET /checkins/latest — My latest check-in
   */
  app.get(
    '/checkins/latest',
    { preHandler: authenticate },
    async (request, reply) => {
      const checkIn = await CheckIn.findOne({
        ownerId: new Types.ObjectId(request.user.id),
        deletedAt: null,
      })
        .sort({ createdAt: -1 })
        .lean();

      return reply.status(200).send({ checkIn: checkIn ?? null });
    },
  );

  /**
   * GET /checkins/latest-partner — Partner's latest check-in
   */
  app.get(
    '/checkins/latest-partner',
    { preHandler: authenticate },
    async (request, reply) => {
      const couple = await Couple.findById(request.user.coupleId).lean();
      if (!couple) {
        return reply
          .status(404)
          .send({ error: 'Couple not found', code: 'NOT_FOUND' });
      }

      const partnerMemberId = couple.memberIds.find(
        (id) => id.toString() !== request.user.id,
      );

      if (!partnerMemberId) {
        return reply.status(200).send({ checkIn: null });
      }

      const checkIn = await CheckIn.findOne({
        ownerId: partnerMemberId,
        deletedAt: null,
      })
        .sort({ createdAt: -1 })
        .lean();

      return reply.status(200).send({ checkIn: checkIn ?? null });
    },
  );

  /**
   * GET /checkins — Paginated couple check-ins
   */
  app.get(
    '/checkins',
    { preHandler: authenticate },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        type?: string;
      };

      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {
        coupleId: new Types.ObjectId(request.user.coupleId),
        deletedAt: null,
      };

      if (query.type) {
        filter.type = query.type;
      }

      const [checkIns, total] = await Promise.all([
        CheckIn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        CheckIn.countDocuments(filter),
      ]);

      return reply.status(200).send({
        checkIns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * POST /checkins — Create a new check-in (photo, text, or mood)
   */
  app.post(
    '/checkins',
    { preHandler: authenticate },
    async (request, reply) => {
      const user = await User.findById(request.user.id).lean();
      if (!user) {
        return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });
      }

      const contentType = request.headers['content-type'] ?? '';

      let checkInData: {
        type: 'photo' | 'text' | 'mood';
        imageUrl?: string;
        storagePath?: string;
        caption?: string;
        mood?: string;
        quickMessage?: string;
      };

      if (contentType.includes('multipart/form-data')) {
        // Photo check-in
        const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
        const parts = request.parts();

        let imageFile: {
          buffer: Buffer;
          mimetype: string;
          filename: string;
        } | null = null;
        let caption: string | undefined;
        let quickMessage: string | undefined;

        for await (const part of parts) {
          if (part.type === 'file') {
            if (!part.mimetype.startsWith('image/')) {
              return reply
                .status(400)
                .send({ error: 'Only image files are allowed', code: 'INVALID_MIME' });
            }
            imageFile = await readMultipartBuffer(part, maxBytes);
          } else if (part.type === 'field') {
            if (part.fieldname === 'caption') caption = part.value as string;
            if (part.fieldname === 'quickMessage')
              quickMessage = part.value as string;
          }
        }

        if (!imageFile) {
          return reply
            .status(400)
            .send({ error: 'Image file required', code: 'NO_FILE' });
        }

        let { buffer } = imageFile;

        // Resize to max 1080px wide while preserving quality
        buffer = await sharp(buffer)
          .rotate()
          .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer();

        const saved = await storageService.saveFile(
          buffer,
          imageFile.filename,
          'image/jpeg',
        );

        checkInData = {
          type: 'photo',
          imageUrl: saved.url,
          storagePath: saved.storagePath,
          caption,
          quickMessage,
        };
      } else {
        // Text or mood check-in from JSON body
        const parsed = createCheckInBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            error: parsed.error.errors[0].message,
            code: 'VALIDATION_ERROR',
          });
        }
        checkInData = parsed.data;
      }

      const checkIn = await CheckIn.create({
        coupleId: new Types.ObjectId(request.user.coupleId),
        ownerId: new Types.ObjectId(request.user.id),
        ownerName: user.displayName,
        ...checkInData,
        reactions: [],
        replies: [],
      });

      // Update streak
      const newStreak = await updateStreak(request.user.coupleId);

      // Notify partner
      const couple = await Couple.findById(request.user.coupleId).lean();
      if (couple) {
        const partnerId = couple.memberIds.find(
          (id) => id.toString() !== request.user.id,
        );
        if (partnerId) {
          sendPushToUser(partnerId.toString(), {
            title: `${user.displayName} đã check-in! 💕`,
            body: checkInData.caption ?? checkInData.quickMessage ?? 'Xem ngay nào!',
            icon: user.avatarUrl,
            badge: '/icons/icon-192.png',
            url: '/app/home',
            tag: `checkin-${checkIn._id.toString()}`,
            kind: 'checkin',
            checkinId: checkIn._id.toString(),
          }).catch((err) => {
            app.log.error({ err }, 'Failed to send push notification');
          });
        }
      }

      return reply.status(201).send({ checkIn, streak: newStreak });
    },
  );

  /**
   * POST /checkins/:id/reactions — Toggle reaction on check-in
   */
  app.post(
    '/checkins/:id/reactions',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const parsed = addReactionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const type = normalizeReactionType(parsed.data.type);

      const checkIn = await CheckIn.findOne({
        _id: new Types.ObjectId(id),
        coupleId: new Types.ObjectId(request.user.coupleId),
        deletedAt: null,
      });

      if (!checkIn) {
        return reply
          .status(404)
          .send({ error: 'Check-in not found', code: 'NOT_FOUND' });
      }

      const userId = new Types.ObjectId(request.user.id);
      const existingIdx = checkIn.reactions.findIndex(
        (r) =>
          r.userId.toString() === request.user.id &&
          normalizeReactionType(r.type) === type,
      );

      if (existingIdx !== -1) {
        // Toggle off — remove existing reaction
        checkIn.reactions.splice(existingIdx, 1);
      } else {
        // Add new reaction
        checkIn.reactions.push({
          userId,
          type: type as ReactionType,
          createdAt: new Date(),
        });
      }

      await checkIn.save();

      if (existingIdx === -1 && checkIn.ownerId.toString() !== request.user.id) {
        const reactor = await User.findById(request.user.id).lean();
        sendPushToUser(checkIn.ownerId.toString(), {
          title: `${reactor?.displayName ?? 'Người ấy'} đã react check-in của bạn`,
          body: 'Mở app để xem reaction mới',
          icon: reactor?.avatarUrl,
          badge: '/icons/icon-192.png',
          url: '/app/memories',
          tag: `reaction-${checkIn._id.toString()}`,
          kind: 'reaction',
          checkinId: checkIn._id.toString(),
        }).catch((err) => {
          app.log.error({ err }, 'Failed to send reaction push notification');
        });
      }

      return reply.status(200).send({ reactions: checkIn.reactions });
    },
  );

  /**
   * POST /checkins/:id/replies - Add a reply to a check-in
   */
  app.post(
    '/checkins/:id/replies',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const parsed = addReplySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const [checkIn, user] = await Promise.all([
        CheckIn.findOne({
          _id: new Types.ObjectId(id),
          coupleId: new Types.ObjectId(request.user.coupleId),
          deletedAt: null,
        }),
        User.findById(request.user.id).lean(),
      ]);

      if (!checkIn) {
        return reply
          .status(404)
          .send({ error: 'Check-in not found', code: 'NOT_FOUND' });
      }

      if (!user) {
        return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });
      }

      checkIn.replies.push({
        userId: new Types.ObjectId(request.user.id),
        userName: user.displayName,
        message: parsed.data.message,
        createdAt: new Date(),
      });

      await checkIn.save();

      if (checkIn.ownerId.toString() !== request.user.id) {
        sendPushToUser(checkIn.ownerId.toString(), {
          title: `${user.displayName} đã reply check-in của bạn`,
          body: parsed.data.message,
          icon: user.avatarUrl,
          badge: '/icons/icon-192.png',
          url: '/app/memories',
          tag: `reply-${checkIn._id.toString()}`,
          kind: 'reply',
          checkinId: checkIn._id.toString(),
        }).catch((err) => {
          app.log.error({ err }, 'Failed to send reply push notification');
        });
      }

      return reply.status(201).send({ replies: checkIn.replies });
    },
  );

  /**
   * DELETE /checkins/:id - Soft delete a check-in
   */
  app.delete(
    '/checkins/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const checkIn = await CheckIn.findById(new Types.ObjectId(id));
      if (!checkIn) {
        return reply
          .status(404)
          .send({ error: 'Check-in not found', code: 'NOT_FOUND' });
      }

      // Only owner or admin can delete
      if (
        checkIn.ownerId.toString() !== request.user.id &&
        request.user.role !== 'admin'
      ) {
        return reply
          .status(403)
          .send({ error: 'Forbidden', code: 'FORBIDDEN' });
      }

      checkIn.deletedAt = new Date();
      await checkIn.save();

      return reply.status(200).send({ success: true });
    },
  );
}
