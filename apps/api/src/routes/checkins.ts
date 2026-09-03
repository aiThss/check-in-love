import { MultipartFile } from '@fastify/multipart';
import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import { env } from '../config/env';
import { CheckIn, ReactionType } from '../db/models/CheckIn';
import { ChatMessage } from '../db/models/ChatMessage';
import { Couple } from '../db/models/Couple';
import { User } from '../db/models/User';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { storageService } from '../services/storage';
import { updateStreak } from '../services/streak';
import { emitRealtimeEvent } from './events';

const createCheckInBodySchema = z.object({
  type: z.enum(['text', 'mood']),
  caption: z.string().max(280).optional(),
  includeScratch: z.boolean().optional(),
  surpriseText: z.string().trim().max(120).optional(),
  mood: z
    .enum(['happy', 'miss', 'tired', 'studying', 'out', 'eating', 'needhug'])
    .optional(),
  quickMessage: z.string().max(100).optional(),
  clientMutationId: z.string().trim().min(1).max(100).optional(),
  replyToMessageId: z.string().trim().min(1).optional(),
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

function replySnippet(checkIn: { caption?: string; quickMessage?: string; imageUrl?: string }): string {
  const value = (checkIn.caption ?? checkIn.quickMessage ?? (checkIn.imageUrl ? 'Ảnh' : 'Tin nhắn'))
    .replace(/\s+/g, ' ')
    .trim();
  return value.slice(0, 160) || 'Tin nhắn';
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
        after?: string;
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

      if (query.after) {
        const after = new Date(query.after);
        if (!Number.isNaN(after.getTime())) {
          // A reply to an older photo belongs in the current chat stream too.
          filter.$or = [
            { createdAt: { $gt: after } },
            { 'replies.createdAt': { $gt: after } },
          ];
        }
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
        includeScratch?: boolean;
        surpriseText?: string;
        mood?: string;
        quickMessage?: string;
        clientMutationId?: string;
        replyToMessageId?: string;
        chatReplyToMessageId?: string;
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
        let includeScratch = true;
        let surpriseText: string | undefined;
        let quickMessage: string | undefined;
        let clientMutationId: string | undefined;
        let replyToMessageId: string | undefined;
        let chatReplyToMessageId: string | undefined;

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
            if (part.fieldname === 'includeScratch') includeScratch = String(part.value).toLowerCase() === 'true';
            if (part.fieldname === 'surpriseText') surpriseText = String(part.value).trim() || undefined;
            if (part.fieldname === 'quickMessage')
              quickMessage = part.value as string;
            if (part.fieldname === 'clientMutationId')
              clientMutationId = String(part.value).trim() || undefined;
            if (part.fieldname === 'replyToMessageId')
              replyToMessageId = String(part.value).trim() || undefined;
            if (part.fieldname === 'chatReplyToMessageId')
              chatReplyToMessageId = String(part.value).trim() || undefined;
          }
        }

        if (!imageFile) {
          return reply
            .status(400)
            .send({ error: 'Image file required', code: 'NO_FILE' });
        }

        let { buffer } = imageFile;

        // Keep photos sharp and crisp (up to 2560px for chat or 2048px for checkin)
        // without pixelation or compression artifacts
        const isChatPhoto = Boolean(chatReplyToMessageId);
        const maxDimension = isChatPhoto ? 2560 : 2048;
        const quality = isChatPhoto ? 92 : 90;

        buffer = await sharp(buffer)
          .rotate()
          .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality })
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
          includeScratch,
          surpriseText,
          quickMessage,
          clientMutationId,
          replyToMessageId,
          chatReplyToMessageId,
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

      const coupleId = new Types.ObjectId(request.user.coupleId);
      if (checkInData.clientMutationId) {
        const duplicate = await CheckIn.findOne({
          coupleId,
          clientMutationId: checkInData.clientMutationId,
        }).lean();
        if (duplicate) {
          const chatMessage = duplicate.type === 'photo'
            ? await ChatMessage.findOne({ referencedCheckinId: duplicate._id }).lean()
            : undefined;
          // A network interruption can happen after CheckIn is saved but before its
          // paired chat message is written. Repair that partial write on retry.
          if (!chatMessage && duplicate.type === 'photo' && duplicate.imageUrl) {
            const repairedChatMessage = await ChatMessage.create({
              coupleId: duplicate.coupleId,
              senderId: duplicate.ownerId,
              senderName: duplicate.ownerName,
              type: 'image',
              text: duplicate.caption ?? duplicate.quickMessage,
              imageUrl: duplicate.imageUrl,
              storagePath: duplicate.storagePath,
              referencedCheckinId: duplicate._id,
              referencedCheckin: {
                checkinId: duplicate._id,
                ownerId: duplicate.ownerId,
                ownerName: duplicate.ownerName,
                type: duplicate.type,
                caption: duplicate.caption ?? duplicate.quickMessage,
                mood: duplicate.mood,
                imageUrl: duplicate.imageUrl,
                createdAt: duplicate.createdAt,
              },
              clientMutationId: `checkin-photo:${duplicate._id.toString()}`,
            });
            return reply.status(200).send({
              checkIn: duplicate,
              chatMessage: repairedChatMessage,
              duplicate: true,
            });
          }
          return reply.status(200).send({
            checkIn: duplicate,
            chatMessage,
            duplicate: true,
          });
        }
      }

      let replyTo: {
        messageId: Types.ObjectId;
        senderId: Types.ObjectId;
        senderName: string;
        type: 'photo' | 'text' | 'mood';
        textSnippet: string;
        mediaUrl?: string;
      } | undefined;
      if (checkInData.replyToMessageId) {
        if (!Types.ObjectId.isValid(checkInData.replyToMessageId)) {
          return reply.status(400).send({ error: 'Invalid reply message id', code: 'VALIDATION_ERROR' });
        }

        const original = await CheckIn.findOne({
          _id: new Types.ObjectId(checkInData.replyToMessageId),
          coupleId: new Types.ObjectId(request.user.coupleId),
          deletedAt: null,
        }).lean();
        if (!original) {
          return reply.status(404).send({ error: 'Reply target not found', code: 'NOT_FOUND' });
        }

        replyTo = {
          messageId: original._id,
          senderId: original.ownerId,
          senderName: original.ownerName,
          type: original.type,
          textSnippet: replySnippet(original),
          mediaUrl: original.imageUrl,
        };
      }

      let chatReplyTo: {
        messageId: Types.ObjectId;
        senderId: Types.ObjectId;
        senderName: string;
        type: 'text' | 'image';
        textSnippet: string;
        mediaUrl?: string;
      } | undefined;
      if (checkInData.chatReplyToMessageId) {
        if (!Types.ObjectId.isValid(checkInData.chatReplyToMessageId)) {
          return reply.status(400).send({ error: 'Invalid chat reply message id', code: 'VALIDATION_ERROR' });
        }
        const original = await ChatMessage.findOne({
          _id: new Types.ObjectId(checkInData.chatReplyToMessageId),
          coupleId: new Types.ObjectId(request.user.coupleId),
          deletedAt: null,
        }).lean();
        if (!original) {
          return reply.status(404).send({ error: 'Chat reply target not found', code: 'NOT_FOUND' });
        }
        chatReplyTo = {
          messageId: original._id,
          senderId: original.senderId,
          senderName: original.senderName,
          type: original.type,
          textSnippet: (original.text?.replace(/\s+/g, ' ').trim() || (original.imageUrl ? 'Ảnh' : 'Tin nhắn')).slice(0, 160),
          mediaUrl: original.imageUrl,
        };
      }

      const checkIn = await CheckIn.create({
        coupleId,
        ownerId: new Types.ObjectId(request.user.id),
        ownerName: user.displayName,
        ...checkInData,
        replyToMessageId: replyTo?.messageId,
        replyTo,
        reactions: [],
        replies: [],
      });

      let chatMessage;
      if (checkIn.type === 'photo' && checkIn.imageUrl) {
        chatMessage = await ChatMessage.create({
          coupleId: checkIn.coupleId,
          senderId: checkIn.ownerId,
          senderName: checkIn.ownerName,
          type: 'image',
          text: checkIn.caption ?? checkIn.quickMessage,
          imageUrl: checkIn.imageUrl,
          storagePath: checkIn.storagePath,
          replyToMessageId: chatReplyTo?.messageId,
          replyTo: chatReplyTo,
          referencedCheckinId: checkIn._id,
          referencedCheckin: {
            checkinId: checkIn._id,
            ownerId: checkIn.ownerId,
            ownerName: checkIn.ownerName,
            type: checkIn.type,
            caption: checkIn.caption ?? checkIn.quickMessage,
            mood: checkIn.mood,
            imageUrl: checkIn.imageUrl,
            createdAt: checkIn.createdAt,
          },
          clientMutationId: `checkin-photo:${checkIn._id.toString()}`,
        });
      }

      // Update streak
      const newStreak = await updateStreak(request.user.coupleId);

      // Notify partner
      const couple = await Couple.findById(request.user.coupleId).lean();
      const photoTopic = checkIn.type === 'photo';
      if (couple) {
        const partnerId = couple.memberIds.find(
          (id) => id.toString() !== request.user.id,
        );
        if (partnerId) {
          emitRealtimeEvent(partnerId.toString(), {
            type: photoTopic ? 'message' : 'checkin',
            title: photoTopic ? `${user.displayName} đã gửi ảnh mới 📸` : `${user.displayName} đã check-in! 💕`,
            body: checkInData.caption ?? checkInData.quickMessage ?? 'Xem ngay nào!',
            targetUrl: photoTopic ? '/app/messages' : '/app/home',
            photoUrl: checkInData.imageUrl || '',
            senderName: user.displayName,
            senderAvatar: user.avatarUrl,
          });

          sendPushToUser(partnerId.toString(), {
            title: photoTopic ? `${user.displayName} đã gửi ảnh mới` : `${user.displayName} đã check-in! 💕`,
            body: checkInData.caption ?? checkInData.quickMessage ?? 'Xem ngay nào!',
            icon: user.avatarUrl,
            badge: '/icons/icon-192.png',
            url: photoTopic ? '/app/messages' : '/app/home',
            tag: `checkin-${checkIn._id.toString()}`,
            kind: photoTopic ? 'message' : 'checkin',
            checkinId: checkIn._id.toString(),
            senderName: user.displayName,
            senderAvatar: user.avatarUrl,
            actionType: photoTopic ? 'message' : 'checkin',
            targetUrl: photoTopic ? '/app/messages' : '/app/home',
            photoUrl: checkInData.imageUrl || '',
          }).catch((err) => {
            app.log.error({ err }, 'Failed to send push notification');
          });
        }
      }

      return reply.status(201).send({ checkIn, chatMessage, streak: newStreak });
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
        emitRealtimeEvent(checkIn.ownerId.toString(), {
          type: 'reaction',
          title: `${reactor?.displayName ?? 'Người ấy'} đã react check-in của bạn 💕`,
          body: 'Mở app để xem reaction mới',
          targetUrl: '/app/memories',
          senderName: reactor?.displayName || 'Người ấy',
          senderAvatar: reactor?.avatarUrl,
        });

        sendPushToUser(checkIn.ownerId.toString(), {
          title: `${reactor?.displayName ?? 'Người ấy'} đã react check-in của bạn`,
          body: 'Mở app để xem reaction mới',
          icon: reactor?.avatarUrl,
          badge: '/icons/icon-192.png',
          url: '/app/memories',
          tag: `reaction-${checkIn._id.toString()}`,
          kind: 'reaction',
          checkinId: checkIn._id.toString(),
          senderName: reactor?.displayName || 'Người ấy',
          senderAvatar: reactor?.avatarUrl,
          actionType: 'reaction',
          targetUrl: '/app/memories',
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
        emitRealtimeEvent(checkIn.ownerId.toString(), {
          type: 'reply',
          title: `${user.displayName} đã reply check-in của bạn`,
          body: parsed.data.message,
          targetUrl: '/app/messages',
          senderName: user.displayName,
          senderAvatar: user.avatarUrl,
        });

        sendPushToUser(checkIn.ownerId.toString(), {
          title: `${user.displayName} đã reply check-in của bạn`,
          body: parsed.data.message,
          icon: user.avatarUrl,
          badge: '/icons/icon-192.png',
          url: '/app/messages',
          tag: `reply-${checkIn._id.toString()}`,
          kind: 'reply',
          checkinId: checkIn._id.toString(),
          senderName: user.displayName,
          senderAvatar: user.avatarUrl,
          actionType: 'reply',
          targetUrl: '/app/messages',
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
