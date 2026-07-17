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

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
  before: z.string().optional(),
  after: z.string().optional(),
}).refine((value) => !(value.before && value.after), { message: 'before and after cannot be used together' });

const textSchema = z.object({
  type: z.literal('text'),
  text: z.string().trim().min(1).max(1000),
  replyToMessageId: z.string().trim().min(1).optional(),
  referencedCheckinId: z.string().trim().min(1).optional(),
  clientMutationId: z.string().trim().min(1).max(100).optional(),
});

async function readImage(part: MultipartFile): Promise<{ buffer: Buffer; filename: string }> {
  if (!part.mimetype.startsWith('image/')) throw Object.assign(new Error('Only image files are allowed'), { statusCode: 400 });
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of part.file) {
    total += chunk.length;
    if (total > env.MAX_UPLOAD_MB * 1024 * 1024) throw Object.assign(new Error('File too large'), { statusCode: 400 });
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), filename: part.filename };
}

function snippet(message: { type: ChatMessageType; text?: string; imageUrl?: string }): string {
  return (message.text?.replace(/\s+/g, ' ').trim() || (message.imageUrl ? 'Ảnh' : 'Tin nhắn')).slice(0, 160);
}

export default async function messagesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/messages', { preHandler: authenticate }, async (request, reply) => {
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
    const { limit, before, after } = parsed.data;
    if (before && !Types.ObjectId.isValid(before)) return reply.status(400).send({ error: 'Invalid before cursor', code: 'VALIDATION_ERROR' });
    if (after && !Types.ObjectId.isValid(after)) return reply.status(400).send({ error: 'Invalid after cursor', code: 'VALIDATION_ERROR' });
    const filter: Record<string, unknown> = { coupleId: new Types.ObjectId(request.user.coupleId), deletedAt: null };
    if (before) filter._id = { $lt: new Types.ObjectId(before) };
    if (after) filter._id = { $gt: new Types.ObjectId(after) };
    const rows = await ChatMessage.find(filter).sort({ _id: after ? 1 : -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const messages = (after ? rows.slice(0, limit) : rows.slice(0, limit).reverse());
    return reply.send({ messages, pagination: { hasMore, beforeCursor: messages[0]?._id?.toString() ?? null, afterCursor: messages.at(-1)?._id?.toString() ?? null, limit } });
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
      const buffer = await sharp(image.buffer).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      const saved = await storageService.saveFile(buffer, image.filename, 'image/jpeg');
      type = 'image'; imageUrl = saved.url; storagePath = saved.storagePath;
    } else {
      const parsed = textSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
      ({ type, text, replyToMessageId, referencedCheckinId, clientMutationId } = parsed.data);
    }
    if (clientMutationId) {
      const duplicate = await ChatMessage.findOne({ coupleId: new Types.ObjectId(request.user.coupleId), clientMutationId }).lean();
      if (duplicate) return reply.status(200).send({ message: duplicate, duplicate: true });
    }
    const coupleId = new Types.ObjectId(request.user.coupleId);
    let replyTo: {
      messageId: Types.ObjectId; senderId: Types.ObjectId; senderName: string; type: ChatMessageType; textSnippet?: string; mediaUrl?: string;
    } | undefined;
    if (replyToMessageId) {
      if (!Types.ObjectId.isValid(replyToMessageId)) return reply.status(400).send({ error: 'Invalid reply message id', code: 'VALIDATION_ERROR' });
      const original = await ChatMessage.findOne({ _id: new Types.ObjectId(replyToMessageId), coupleId, deletedAt: null }).lean();
      if (!original) return reply.status(404).send({ error: 'Reply target not found', code: 'NOT_FOUND' });
      replyTo = { messageId: original._id, senderId: original.senderId, senderName: original.senderName, type: original.type, textSnippet: snippet(original), mediaUrl: original.imageUrl };
    }
    let referencedCheckin: {
      checkinId: Types.ObjectId; ownerId: Types.ObjectId; ownerName: string; type: 'photo' | 'text' | 'mood'; caption?: string; mood?: string; imageUrl?: string; createdAt: Date;
    } | undefined;
    if (referencedCheckinId) {
      if (!Types.ObjectId.isValid(referencedCheckinId)) return reply.status(400).send({ error: 'Invalid referenced check-in id', code: 'VALIDATION_ERROR' });
      const checkin = await CheckIn.findOne({ _id: new Types.ObjectId(referencedCheckinId), coupleId, deletedAt: null }).lean();
      if (!checkin) return reply.status(404).send({ error: 'Referenced check-in not found', code: 'NOT_FOUND' });
      referencedCheckin = { checkinId: checkin._id, ownerId: checkin.ownerId, ownerName: checkin.ownerName, type: checkin.type, caption: checkin.caption ?? checkin.quickMessage, mood: checkin.mood, imageUrl: checkin.imageUrl, createdAt: checkin.createdAt };
    }
    const message = await ChatMessage.create({ coupleId, senderId: new Types.ObjectId(request.user.id), senderName: user.displayName, type, text, imageUrl, storagePath, replyToMessageId: replyTo?.messageId, replyTo, referencedCheckinId: referencedCheckin?.checkinId, referencedCheckin, clientMutationId });
    const couple = await Couple.findById(coupleId).lean();
    const partnerId = couple?.memberIds.find((id) => id.toString() !== request.user.id);
    if (partnerId) void sendPushToUser(partnerId.toString(), { title: `${user.displayName} đã nhắn cho bạn`, body: snippet({ type, text, imageUrl }), icon: user.avatarUrl, tag: `message-${message._id}`, kind: 'message', actionType: 'message', targetUrl: '/app/messages', url: '/app/messages', senderName: user.displayName, senderAvatar: user.avatarUrl });
    return reply.status(201).send({ message });
  });

  app.get('/messages/:id/context', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) return reply.status(400).send({ error: 'Invalid message id', code: 'VALIDATION_ERROR' });
    const message = await ChatMessage.findOne({ _id: new Types.ObjectId(id), coupleId: new Types.ObjectId(request.user.coupleId), deletedAt: null }).lean();
    if (!message) return reply.status(404).send({ error: 'Message not found', code: 'NOT_FOUND' });
    return reply.send({ messages: [message] });
  });

  app.delete('/messages/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) return reply.status(400).send({ error: 'Invalid message id', code: 'VALIDATION_ERROR' });
    const message = await ChatMessage.findOne({ _id: new Types.ObjectId(id), coupleId: new Types.ObjectId(request.user.coupleId), deletedAt: null });
    if (!message) return reply.status(404).send({ error: 'Message not found', code: 'NOT_FOUND' });
    if (message.senderId.toString() !== request.user.id) return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    message.deletedAt = new Date(); await message.save(); return reply.send({ success: true });
  });
}
