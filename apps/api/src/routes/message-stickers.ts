import { Hono } from 'hono';
import { execute, findPartnerUser, findUserById, queryOne } from '../db/d1';
import { toMessageDto, type ChatMessageRow } from '../db/types';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import { isUploadedFile, saveUploadedImage } from '../services/storage';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const messageStickerRoutes = new Hono<HonoAppEnv>();

const STICKER_QUERY_MARKER = 'lc-media=sticker';

function markStickerUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${STICKER_QUERY_MARKER}`;
}

messageStickerRoutes.post('/messages/sticker', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const formData = await c.req.formData().catch(() => null);
  if (!formData) {
    throw new AppError('Vui lòng tải lên tệp sticker', 400, 'VALIDATION_ERROR');
  }

  const fileEntry = formData.get('file') ?? formData.get('image') ?? formData.get('sticker');
  if (!isUploadedFile(fileEntry) || fileEntry.size <= 0) {
    throw new AppError('Tệp sticker không hợp lệ', 400, 'MISSING_FILE');
  }

  const rawMutationId = formData.get('clientMutationId');
  const clientMutationId =
    typeof rawMutationId === 'string' && rawMutationId.trim() ? rawMutationId.trim() : undefined;

  if (clientMutationId) {
    const existing = await queryOne<ChatMessageRow>(
      c.env.DB,
      'SELECT * FROM chat_messages WHERE couple_id = ? AND client_mutation_id = ? LIMIT 1',
      [auth.coupleId, clientMutationId],
    );
    if (existing) {
      return c.json({ message: toMessageDto(existing), duplicate: true }, 200);
    }
  }

  const config = c.get('config');
  const saved = await saveUploadedImage(c.env.STORAGE, config, fileEntry, 'messages');
  const stickerUrl = markStickerUrl(saved.url);
  const user = (await findUserById(c.env.DB, auth.id))!;

  const messageId = generateId();
  const nowIso = new Date().toISOString();

  await execute(
    c.env.DB,
    `INSERT INTO chat_messages (
      id, couple_id, sender_id, sender_name, type, image_url, storage_path,
      attachments_json, client_mutation_id, read_by_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'image', ?, ?, ?, ?, ?, ?, ?)`,
    [
      messageId,
      auth.coupleId,
      user.id,
      user.display_name,
      stickerUrl,
      saved.storagePath,
      JSON.stringify([{ url: stickerUrl, storagePath: saved.storagePath }]),
      clientMutationId ?? null,
      JSON.stringify([user.id]),
      nowIso,
      nowIso,
    ],
  );

  const createdRow = (await queryOne<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE id = ? LIMIT 1',
    [messageId],
  ))!;

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    const title = `${user.display_name} đã nhắn cho bạn`;
    const body = 'Đã gửi một sticker';
    await Promise.allSettled([
      sendPushToUser(c.env, config, partner.id, {
        title,
        body,
        icon: user.avatar_url ?? undefined,
        badge: '/icons/icon-192.png',
        url: '/app/messages',
        targetUrl: '/app/messages',
        tag: `message-${messageId}`,
        kind: 'message',
        actionType: 'message',
        type: 'message',
        messageId,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        photoUrl: stickerUrl,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: 'message',
        messageId,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title,
        body,
        photoUrl: stickerUrl,
        targetUrl: '/app/messages',
        url: '/app/messages',
        createdAt: nowIso,
      }),
    ]);
  }

  return c.json({ message: toMessageDto(createdRow) }, 201);
});
