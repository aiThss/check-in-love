import { createHash } from 'node:crypto';
import { MultipartFile } from '@fastify/multipart';
import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import { env } from '../config/env';
import { ChatMessage, ChatMessageType } from '../db/models/ChatMessage';
import { CheckIn } from '../db/models/CheckIn';
import { Couple } from '../db/models/Couple';
import { User } from '../db/models/User';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { storageService } from '../services/storage';

const LEGACY_SYNC_LIMIT = 250;

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
  before: z.string().optional(),
  after: z.string().optional(),
}).refine((value) => !(value.before && value.after), {
  message: 'before and after cannot be used together',
});

const textSchema = z.object({
  type: z.literal('text'),
  text: z.string().trim().min(1).max(1000),
  replyToMessageId: z.string().trim().min(1).optional(),
  referencedCheckinId: z.string().trim().min(1).optional(),
  clientMutationId: z.string().trim().min(1).max(100).optional(),
});

interface LegacyReplyRecord {
  userId: Types.ObjectId;
  userName: string;
  message: string;
  createdAt: Date;
}

interface LegacyCheckinRecord {
  _id: Types.ObjectId;
  coupleId: Types.ObjectId;
  ownerId: Types.ObjectId;
  ownerName: string;
  type: 'photo' | 'text' | 'mood';
  imageUrl?: string;
  storagePath?: string;
  caption?: string;
  quickMessage?: string;
  mood?: string;
  replies?: LegacyReplyRecord[];
  createdAt: Date;
  updatedAt?: Date;
}

interface LeanMessageRecord {
  _id: Types.ObjectId;
  coupleId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderName: string;
  type: ChatMessageType;
  text?: string;
  imageUrl?: string;
  storagePath?: string;
  replyToMessageId?: Types.ObjectId;
  replyTo?: unknown;
  referencedCheckinId?: Types.ObjectId;
  referencedCheckin?: unknown;
  clientMutationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

async function readImage(part: MultipartFile): Promise<{ buffer: Buffer; filename: string }> {
  if (!part.mimetype.startsWith('image/')) {
    throw Object.assign(new Error('Only image files are allowed'), { statusCode: 400 });
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of part.file) {
    total += chunk.length;
    if (total > env.MAX_UPLOAD_MB * 1024 * 1024) {
      throw Object.assign(new Error('File too large'), { statusCode: 400 });
    }
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), filename: part.filename };
}

function snippet(message: { type: ChatMessageType; text?: string; imageUrl?: string }): string {
  return (message.text?.replace(/\s+/g, ' ').trim() || (message.imageUrl ? 'Ảnh' : 'Tin nhắn')).slice(0, 160);
}

function checkinSnapshot(checkin: LegacyCheckinRecord) {
  return {
    checkinId: checkin._id,
    ownerId: checkin.ownerId,
    ownerName: checkin.ownerName,
    type: checkin.type,
    caption: checkin.caption ?? checkin.quickMessage,
    mood: checkin.mood,
    imageUrl: checkin.imageUrl,
    createdAt: checkin.createdAt,
  };
}

function deterministicObjectId(dateValue: Date, identity: string): Types.ObjectId {
  const date = new Date(dateValue);
  const timestamp = Math.max(0, Math.floor(date.getTime() / 1000))
    .toString(16)
    .padStart(8, '0')
    .slice(-8);
  const suffix = createHash('sha1').update(identity).digest('hex').slice(0, 16);
  return new Types.ObjectId(`${timestamp}${suffix}`);
}

/**
 * Bridges the old shared CheckIn stream into ChatMessage without duplicating media.
 * It is idempotent and preserves original timestamps, so historical photos/replies do
 * not jump to the bottom of the conversation after a deploy.
 */
async function syncLegacyCheckinMessages(coupleId: Types.ObjectId): Promise<void> {
  const checkins = await CheckIn.find({
    coupleId,
    deletedAt: null,
    $or: [
      { type: 'photo' },
      { 'replies.0': { $exists: true } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(LEGACY_SYNC_LIMIT)
    .lean() as unknown as LegacyCheckinRecord[];

  const operations: Array<{
    updateOne: {
      filter: Record<string, unknown>;
      update: Record<string, unknown>;
      upsert: true;
    };
  }> = [];

  for (const checkin of checkins) {
    const referencedCheckin = checkinSnapshot(checkin);

    if (checkin.type === 'photo' && checkin.imageUrl) {
      operations.push({
        updateOne: {
          filter: {
            coupleId,
            referencedCheckinId: checkin._id,
            type: 'image',
          },
          update: {
            $set: {
              senderId: checkin.ownerId,
              senderName: checkin.ownerName,
              text: checkin.caption ?? checkin.quickMessage,
              imageUrl: checkin.imageUrl,
              storagePath: checkin.storagePath,
              referencedCheckinId: checkin._id,
              referencedCheckin,
              updatedAt: checkin.updatedAt ?? checkin.createdAt,
            },
            $setOnInsert: {
              _id: checkin._id,
              coupleId,
              type: 'image',
              clientMutationId: `checkin-photo:${checkin._id.toString()}`,
              createdAt: checkin.createdAt,
              deletedAt: null,
            },
          },
          upsert: true,
        },
      });
    }

    for (const legacyReply of checkin.replies ?? []) {
      const createdAt = new Date(legacyReply.createdAt);
      const identity = [
        checkin._id.toString(),
        legacyReply.userId.toString(),
        createdAt.toISOString(),
        legacyReply.message,
      ].join(':');
      const messageId = deterministicObjectId(createdAt, identity);
      const clientMutationId = `legacy-reply:${messageId.toString()}`;

      operations.push({
        updateOne: {
          filter: { coupleId, clientMutationId },
          update: {
            $setOnInsert: {
              _id: messageId,
              coupleId,
              senderId: legacyReply.userId,
              senderName: legacyReply.userName,
              type: 'text',
              text: legacyReply.message,
              referencedCheckinId: checkin._id,
              referencedCheckin,
              clientMutationId,
              createdAt,
              updatedAt: createdAt,
              deletedAt: null,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (operations.length > 0) {
    await ChatMessage.bulkWrite(operations, { ordered: false });
  }
}

async function hydrateLiveCheckins(
  messages: LeanMessageRecord[],
  coupleId: Types.ObjectId,
): Promise<LeanMessageRecord[]> {
  const referencedIds = Array.from(new Set(
    messages
      .map((message) => message.referencedCheckinId?.toString())
      .filter((value): value is string => Boolean(value)),
  ));

  if (referencedIds.length === 0) return messages;

  const checkins = await CheckIn.find({
    _id: { $in: referencedIds.map((id) => new Types.ObjectId(id)) },
    coupleId,
    deletedAt: null,
  }).lean() as unknown as LegacyCheckinRecord[];

  const liveById = new Map(checkins.map((checkin) => [checkin._id.toString(), checkin]));

  return messages.map((message) => {
    const liveCheckin = message.referencedCheckinId
      ? liveById.get(message.referencedCheckinId.toString())
      : undefined;
    if (!liveCheckin) return message;

    const next: LeanMessageRecord = {
      ...message,
      referencedCheckin: checkinSnapshot(liveCheckin),
    };

    // A photo topic is the same logical photo shown in Home and Memories. Keep its
    // visible media/caption live while retaining the embedded snapshot as fallback.
    if (message.type === 'image' && liveCheckin.type === 'photo') {
      next.imageUrl = liveCheckin.imageUrl ?? message.imageUrl;
      next.storagePath = liveCheckin.storagePath ?? message.storagePath;
      next.text = liveCheckin.caption ?? liveCheckin.quickMessage ?? message.text;
    }

    return next;
  });
}

export default async function messagesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/messages', { preHandler: authenticate }, async (request, reply) => {
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0].message,
        code: 'VALIDATION_ERROR',
      });
    }

    const { limit, before, after } = parsed.data;
    if (before && !Types.ObjectId.isValid(before)) {
      return reply.status(400).send({ error: 'Invalid before cursor', code: 'VALIDATION_ERROR' });
    }
    if (after && !Types.ObjectId.isValid(after)) {
      return reply.status(400).send({ error: 'Invalid after cursor', code: 'VALIDATION_ERROR' });
    }

    const coupleId = new Types.ObjectId(request.user.coupleId);
    try {
      await syncLegacyCheckinMessages(coupleId);
    } catch (error) {
      app.log.warn({ err: error }, 'Failed to synchronize legacy check-ins into messages');
    }

    const filter: Record<string, unknown> = { coupleId, deletedAt: null };
    if (before) filter._id = { $lt: new Types.ObjectId(before) };
    if (after) filter._id = { $gt: new Types.ObjectId(after) };

    const rows = await ChatMessage.find(filter)
      .sort({ _id: after ? 1 : -1 })
      .limit(limit + 1)
      .lean() as unknown as LeanMessageRecord[];
    const hasMore = rows.length > limit;
    const ordered = after ? rows.slice(0, limit) : rows.slice(0, limit).reverse();
    const messages = await hydrateLiveCheckins(ordered, coupleId);

    return reply.send({
      messages,
      pagination: {
        hasMore,
        beforeCursor: messages[0]?._id?.toString() ?? null,
        afterCursor: messages.at(-1)?._id?.toString() ?? null,
        limit,
      },
    });
  });

  app.post('/messages', { preHandler: authenticate }, async (request, reply) => {
    const user = await User.findById(request.user.id).lean();
    if (!user) return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });

    let type: ChatMessageType;
    let text: string | undefined;
    let imageUrl: string | undefined;
    let storagePath: string | undefined;
    let replyToMessageId: string | undefined;
    let referencedCheckinId: string | undefined;
    let clientMutationId: string | undefined;

    if ((request.headers['content-type'] ?? '').includes('multipart/form-data')) {
      let image: { buffer: Buffer; filename: string } | undefined;
      for await (const part of request.parts()) {
        if (part.type === 'file') image = await readImage(part);
        else if (part.fieldname === 'text') text = String(part.value).trim() || undefined;
        else if (part.fieldname === 'replyToMessageId') replyToMessageId = String(part.value).trim() || undefined;
        else if (part.fieldname === 'referencedCheckinId') referencedCheckinId = String(part.value).trim() || undefined;
        else if (part.fieldname === 'clientMutationId') clientMutationId = String(part.value).trim() || undefined;
      }
      if (!image) return reply.status(400).send({ error: 'Image file required', code: 'NO_FILE' });
      const buffer = await sharp(image.buffer)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      const saved = await storageService.saveFile(buffer, image.filename, 'image/jpeg');
      type = 'image';
      imageUrl = saved.url;
      storagePath = saved.storagePath;
    } else {
      const parsed = textSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }
      ({ type, text, replyToMessageId, referencedCheckinId, clientMutationId } = parsed.data);
    }

    const coupleId = new Types.ObjectId(request.user.coupleId);
    if (clientMutationId) {
      const duplicate = await ChatMessage.findOne({ coupleId, clientMutationId }).lean();
      if (duplicate) return reply.status(200).send({ message: duplicate, duplicate: true });
    }

    let replyTo: {
      messageId: Types.ObjectId;
      senderId: Types.ObjectId;
      senderName: string;
      type: ChatMessageType;
      textSnippet?: string;
      mediaUrl?: string;
    } | undefined;
    if (replyToMessageId) {
      if (!Types.ObjectId.isValid(replyToMessageId)) {
        return reply.status(400).send({ error: 'Invalid reply message id', code: 'VALIDATION_ERROR' });
      }
      const original = await ChatMessage.findOne({
        _id: new Types.ObjectId(replyToMessageId),
        coupleId,
        deletedAt: null,
      }).lean();
      if (!original) return reply.status(404).send({ error: 'Reply target not found', code: 'NOT_FOUND' });
      replyTo = {
        messageId: original._id,
        senderId: original.senderId,
        senderName: original.senderName,
        type: original.type,
        textSnippet: snippet(original),
        mediaUrl: original.imageUrl,
      };
    }

    let referencedCheckin: ReturnType<typeof checkinSnapshot> | undefined;
    if (referencedCheckinId) {
      if (!Types.ObjectId.isValid(referencedCheckinId)) {
        return reply.status(400).send({
          error: 'Invalid referenced check-in id',
          code: 'VALIDATION_ERROR',
        });
      }
      const checkin = await CheckIn.findOne({
        _id: new Types.ObjectId(referencedCheckinId),
        coupleId,
        deletedAt: null,
      }).lean() as unknown as LegacyCheckinRecord | null;
      if (!checkin) {
        return reply.status(404).send({
          error: 'Referenced check-in not found',
          code: 'NOT_FOUND',
        });
      }
      referencedCheckin = checkinSnapshot(checkin);
    }

    const message = await ChatMessage.create({
      coupleId,
      senderId: new Types.ObjectId(request.user.id),
      senderName: user.displayName,
      type,
      text,
      imageUrl,
      storagePath,
      replyToMessageId: replyTo?.messageId,
      replyTo,
      referencedCheckinId: referencedCheckin?.checkinId,
      referencedCheckin,
      clientMutationId,
    });

    const couple = await Couple.findById(coupleId).lean();
    const partnerId = couple?.memberIds.find((id) => id.toString() !== request.user.id);
    if (partnerId) {
      void sendPushToUser(partnerId.toString(), {
        title: `${user.displayName} đã nhắn cho bạn`,
        body: snippet({ type, text, imageUrl }),
        icon: user.avatarUrl,
        badge: '/icons/icon-192.png',
        tag: `message-${message._id}`,
        kind: 'message',
        actionType: 'message',
        targetUrl: '/app/messages',
        url: '/app/messages',
        senderName: user.displayName,
        senderAvatar: user.avatarUrl,
      });
    }

    return reply.status(201).send({ message });
  });

  app.get('/messages/:id/context', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ error: 'Invalid message id', code: 'VALIDATION_ERROR' });
    }

    const coupleId = new Types.ObjectId(request.user.coupleId);
    const message = await ChatMessage.findOne({
      _id: new Types.ObjectId(id),
      coupleId,
      deletedAt: null,
    }).lean() as unknown as LeanMessageRecord | null;
    if (!message) return reply.status(404).send({ error: 'Message not found', code: 'NOT_FOUND' });

    const messages = await hydrateLiveCheckins([message], coupleId);
    return reply.send({ messages });
  });

  app.delete('/messages/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ error: 'Invalid message id', code: 'VALIDATION_ERROR' });
    }

    const message = await ChatMessage.findOne({
      _id: new Types.ObjectId(id),
      coupleId: new Types.ObjectId(request.user.coupleId),
      deletedAt: null,
    });
    if (!message) return reply.status(404).send({ error: 'Message not found', code: 'NOT_FOUND' });
    if (message.senderId.toString() !== request.user.id) {
      return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    message.deletedAt = new Date();
    await message.save();
    return reply.send({ success: true });
  });
}
