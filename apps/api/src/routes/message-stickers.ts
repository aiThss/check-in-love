import { MultipartFile } from '@fastify/multipart';
import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { env } from '../config/env';
import { ChatMessage } from '../db/models/ChatMessage';
import { Couple } from '../db/models/Couple';
import { User } from '../db/models/User';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { storageService } from '../services/storage';

const STICKER_QUERY_MARKER = 'lc-media=sticker';

async function readSticker(part: MultipartFile): Promise<{ buffer: Buffer; filename: string }> {
  if (!part.mimetype.startsWith('image/')) {
    throw Object.assign(new Error('Only image stickers are allowed'), { statusCode: 400 });
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of part.file) {
    total += chunk.length;
    if (total > env.MAX_UPLOAD_MB * 1024 * 1024) {
      throw Object.assign(new Error('Sticker file too large'), { statusCode: 400 });
    }
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    filename: part.filename || 'keyboard-sticker.webp',
  };
}

function markStickerUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${STICKER_QUERY_MARKER}`;
}

export default async function messageStickerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/messages/sticker', { preHandler: authenticate }, async (request, reply) => {
    const user = await User.findById(request.user.id).lean();
    if (!user) {
      return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });
    }

    let sticker: { buffer: Buffer; filename: string } | undefined;
    let clientMutationId: string | undefined;

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        sticker = await readSticker(part);
      } else if (part.fieldname === 'clientMutationId') {
        clientMutationId = String(part.value).trim().slice(0, 100) || undefined;
      }
    }

    if (!sticker) {
      return reply.status(400).send({ error: 'Sticker image required', code: 'NO_FILE' });
    }

    const coupleId = new Types.ObjectId(request.user.coupleId);
    if (clientMutationId) {
      const duplicate = await ChatMessage.findOne({ coupleId, clientMutationId }).lean();
      if (duplicate) {
        return reply.status(200).send({ message: duplicate, duplicate: true });
      }
    }

    // Keyboard sticker packs commonly provide transparent PNG/WebP clipboard images.
    // Normalize dimensions while preserving transparency instead of converting to JPEG.
    const stickerBuffer = await sharp(sticker.buffer, { animated: false })
      .rotate()
      .resize(512, 512, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 92, alphaQuality: 100 })
      .toBuffer();

    const saved = await storageService.saveFile(
      stickerBuffer,
      sticker.filename.replace(/\.[^.]+$/, '') + '.webp',
      'image/webp',
    );

    const message = await ChatMessage.create({
      coupleId,
      senderId: new Types.ObjectId(request.user.id),
      senderName: user.displayName,
      type: 'image',
      imageUrl: markStickerUrl(saved.url),
      storagePath: saved.storagePath,
      clientMutationId,
    });

    const couple = await Couple.findById(coupleId).lean();
    const partnerId = couple?.memberIds.find((id) => id.toString() !== request.user.id);
    if (partnerId) {
      void sendPushToUser(partnerId.toString(), {
        title: `${user.displayName} đã nhắn cho bạn`,
        body: 'Đã gửi một sticker',
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
}
