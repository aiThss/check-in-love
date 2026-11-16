import { Hono } from 'hono';
import {
  execute,
  findPartnerUser,
  findUserById,
  queryAll,
  queryOne,
} from '../db/d1';
import {
  parseJsonSafe,
  toMessageDto,
  type ChatAttachment,
  type ChatEditHistoryEntry,
  type ChatMessageRow,
  type ChatReactionGroup,
  type CheckinRow,
  type MessageReplyReference,
  type ReferencedCheckinSnapshot,
} from '../db/types';
import { authenticate } from '../middleware/auth';
import { syncCheckinRepliesPage } from '../services/checkin-reply-message-sync';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import { deleteStoredFile, saveUploadedImage } from '../services/storage';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const messageRoutes = new Hono<HonoAppEnv>();

async function ensureLegacyRepliesSynced(db: D1Database, coupleId: string): Promise<void> {
  const checkinsWithReplies = await queryAll<CheckinRow>(
    db,
    `SELECT * FROM checkins
     WHERE couple_id = ? AND deleted_at IS NULL AND replies_json != '[]'
     ORDER BY created_at DESC LIMIT 60`,
    [coupleId],
  );
  if (checkinsWithReplies.length > 0) {
    await syncCheckinRepliesPage(db, coupleId, checkinsWithReplies);
  }
}

messageRoutes.get('/messages', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  await ensureLegacyRepliesSynced(c.env.DB, auth.coupleId);

  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') || '30', 10) || 30));
  const before = c.req.query('before')?.trim();
  const after = c.req.query('after')?.trim();

  let rows: ChatMessageRow[];
  let hasMore: boolean;

  if (after) {
    const fetched = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages
       WHERE couple_id = ? AND id > ?
       ORDER BY id ASC LIMIT ?`,
      [auth.coupleId, after, limit + 1],
    );
    hasMore = fetched.length > limit;
    rows = fetched.slice(0, limit);
  } else if (before) {
    const fetchedDesc = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages
       WHERE couple_id = ? AND id < ?
       ORDER BY id DESC LIMIT ?`,
      [auth.coupleId, before, limit + 1],
    );
    hasMore = fetchedDesc.length > limit;
    rows = fetchedDesc.slice(0, limit).reverse();
  } else {
    const fetchedDesc = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages
       WHERE couple_id = ?
       ORDER BY id DESC LIMIT ?`,
      [auth.coupleId, limit + 1],
    );
    hasMore = fetchedDesc.length > limit;
    rows = fetchedDesc.slice(0, limit).reverse();
  }

  return c.json({
    messages: rows.map(toMessageDto),
    pagination: {
      hasMore,
      beforeCursor: rows[0]?.id ?? null,
      afterCursor: rows[rows.length - 1]?.id ?? null,
    },
  });
});

messageRoutes.post('/messages', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const config = c.get('config');
  const contentType = c.req.header('content-type') || '';

  let type: ChatMessageRow['type'];
  let text: string | undefined;
  let replyToMessageId: string | undefined;
  let referencedCheckinId: string | undefined;
  let clientMutationId: string | undefined;
  let imageFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      throw new AppError('Dữ liệu form không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    const getStr = (k: string) => {
      const v = formData.get(k);
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const rawType = getStr('type');
    type = rawType === 'image' || rawType === 'sticker' || rawType === 'checkin_reply' ? rawType : 'image';
    text = getStr('text');
    replyToMessageId = getStr('replyToMessageId');
    referencedCheckinId = getStr('referencedCheckinId');
    clientMutationId = getStr('clientMutationId');
    const fileEntry = formData.get('image') ?? formData.get('file') ?? formData.get('photo');
    if (fileEntry instanceof File && fileEntry.size > 0) {
      imageFile = fileEntry;
    }
  } else {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      throw new AppError('Payload tin nhắn không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    type = body.type === 'checkin_reply' ? 'checkin_reply' : 'text';
    text = typeof body.text === 'string' && body.text.trim() ? body.text.trim() : undefined;
    replyToMessageId =
      typeof body.replyToMessageId === 'string' && body.replyToMessageId.trim()
        ? body.replyToMessageId.trim()
        : undefined;
    referencedCheckinId =
      typeof body.referencedCheckinId === 'string' && body.referencedCheckinId.trim()
        ? body.referencedCheckinId.trim()
        : undefined;
    clientMutationId =
      typeof body.clientMutationId === 'string' && body.clientMutationId.trim()
        ? body.clientMutationId.trim()
        : undefined;
  }

  if (clientMutationId) {
    const existing = await queryOne<ChatMessageRow>(
      c.env.DB,
      'SELECT * FROM chat_messages WHERE couple_id = ? AND client_mutation_id = ? LIMIT 1',
      [auth.coupleId, clientMutationId],
    );
    if (existing) {
      return c.json({ message: toMessageDto(existing) }, 200);
    }
  }

  if (!text && !imageFile) {
    throw new AppError('Tin nhắn không được để trống', 400, 'VALIDATION_ERROR');
  }
  if (text && text.length > 4000) {
    throw new AppError('Tin nhắn tối đa 4000 ký tự', 400, 'VALIDATION_ERROR');
  }

  const user = (await findUserById(c.env.DB, auth.id))!;

  let replyTo: MessageReplyReference | undefined;
  if (replyToMessageId) {
    const refMsg = await queryOne<ChatMessageRow>(
      c.env.DB,
      'SELECT * FROM chat_messages WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
      [replyToMessageId, auth.coupleId],
    );
    if (refMsg) {
      replyTo = {
        messageId: refMsg.id,
        senderId: refMsg.sender_id,
        senderName: refMsg.sender_name,
        type: refMsg.type,
        textSnippet: refMsg.text?.slice(0, 120) || undefined,
        mediaUrl: refMsg.image_url ?? undefined,
      };
    }
  }

  let referencedCheckin: ReferencedCheckinSnapshot | undefined;
  if (referencedCheckinId) {
    const checkin = await queryOne<CheckinRow>(
      c.env.DB,
      'SELECT * FROM checkins WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
      [referencedCheckinId, auth.coupleId],
    );
    if (checkin) {
      referencedCheckin = {
        checkinId: checkin.id,
        ownerId: checkin.owner_id,
        ownerName: checkin.owner_name,
        type: checkin.type,
        caption: checkin.caption ?? undefined,
        mood: checkin.mood ?? undefined,
        imageUrl: checkin.image_url ?? undefined,
        createdAt: checkin.created_at,
      };
      if (type === 'text') {
        type = 'checkin_reply';
      }
    }
  }

  let imageUrl: string | null = null;
  let storagePath: string | null = null;
  const attachments: ChatAttachment[] = [];

  if (imageFile) {
    const saved = await saveUploadedImage(c.env.STORAGE, config, imageFile, 'messages');
    imageUrl = saved.url;
    storagePath = saved.storagePath;
    attachments.push({ url: saved.url, storagePath: saved.storagePath });
    if (type === 'text') type = 'image';
  }

  const messageId = generateId();
  const nowIso = new Date().toISOString();

  await execute(
    c.env.DB,
    `INSERT INTO chat_messages (
      id, couple_id, sender_id, sender_name, type, text,
      image_url, storage_path, attachments_json,
      reply_to_message_id, reply_to_json,
      referenced_checkin_id, referenced_checkin_json,
      client_mutation_id, read_by_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      messageId,
      auth.coupleId,
      user.id,
      user.display_name,
      type,
      text ?? null,
      imageUrl,
      storagePath,
      JSON.stringify(attachments),
      replyTo?.messageId ?? null,
      replyTo ? JSON.stringify(replyTo) : null,
      referencedCheckin?.checkinId ?? null,
      referencedCheckin ? JSON.stringify(referencedCheckin) : null,
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
    const notifTitle = `${user.display_name}`;
    const notifBody =
      type === 'image'
        ? text || 'Đã gửi cho bạn một hình ảnh 📷'
        : text || 'Đã gửi một tin nhắn mới 💬';

    await Promise.allSettled([
      sendPushToUser(c.env, config, partner.id, {
        title: notifTitle,
        body: notifBody,
        url: '/app/messages',
        tag: `chat-${auth.coupleId}`,
        type: 'chat_message',
        messageId,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        photoUrl: imageUrl ?? undefined,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: 'message.created',
        messageId,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title: notifTitle,
        body: notifBody,
        photoUrl: imageUrl ?? undefined,
        url: '/app/messages',
        createdAt: nowIso,
      }),
    ]);
  }

  return c.json({ message: toMessageDto(createdRow) }, 201);
});

messageRoutes.get('/messages/:id/context', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const targetId = c.req.param('id');
  const target = await queryOne<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE id = ? AND couple_id = ? LIMIT 1',
    [targetId, auth.coupleId],
  );
  if (!target) {
    throw new AppError('Không tìm thấy tin nhắn', 404, 'MESSAGE_NOT_FOUND');
  }

  const olderDesc = await queryAll<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE couple_id = ? AND id < ? ORDER BY id DESC LIMIT 10',
    [auth.coupleId, target.id],
  );
  const newerAsc = await queryAll<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE couple_id = ? AND id > ? ORDER BY id ASC LIMIT 10',
    [auth.coupleId, target.id],
  );

  const combined = [...olderDesc.reverse(), target, ...newerAsc];
  return c.json({ messages: combined.map(toMessageDto) });
});

messageRoutes.patch('/messages/:id', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const messageId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { text?: string } | null;
  const nextText = body?.text?.trim();
  if (!nextText || nextText.length > 4000) {
    throw new AppError('Nội dung chỉnh sửa phải từ 1 đến 4000 ký tự', 400, 'VALIDATION_ERROR');
  }

  const row = await queryOne<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
    [messageId, auth.coupleId],
  );
  if (!row) {
    throw new AppError('Không tìm thấy tin nhắn', 404, 'MESSAGE_NOT_FOUND');
  }
  if (row.sender_id !== auth.id) {
    throw new AppError('Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình', 403, 'FORBIDDEN');
  }

  const nowIso = new Date().toISOString();
  const history = parseJsonSafe<ChatEditHistoryEntry[]>(row.edit_history_json, []);
  if (row.text) {
    history.push({ text: row.text, editedAt: nowIso });
  }

  await execute(
    c.env.DB,
    'UPDATE chat_messages SET text = ?, edited_at = ?, edit_history_json = ?, updated_at = ? WHERE id = ?',
    [nextText, nowIso, JSON.stringify(history), nowIso, row.id],
  );

  const updated = (await queryOne<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE id = ? LIMIT 1',
    [row.id],
  ))!;

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.updated',
      messageId: row.id,
      senderId: auth.id,
      title: '',
      body: '',
    });
  }

  return c.json({ message: toMessageDto(updated) });
});

messageRoutes.post('/messages/:id/reactions', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const messageId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { type?: string } | null;
  const reactionType = body?.type?.trim();
  if (!reactionType || reactionType.length > 32) {
    throw new AppError('Biểu tượng cảm xúc không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const row = await queryOne<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
    [messageId, auth.coupleId],
  );
  if (!row) {
    throw new AppError('Không tìm thấy tin nhắn', 404, 'MESSAGE_NOT_FOUND');
  }

  const groups = parseJsonSafe<ChatReactionGroup[]>(row.reactions_json, []);
  let toggledOn = false;

  const targetGroup = groups.find((g) => g.type === reactionType);
  if (targetGroup && targetGroup.userIds.includes(auth.id)) {
    targetGroup.userIds = targetGroup.userIds.filter((uid) => uid !== auth.id);
  } else {
    for (const group of groups) {
      group.userIds = group.userIds.filter((uid) => uid !== auth.id);
    }
    if (targetGroup) {
      targetGroup.userIds.push(auth.id);
    } else {
      groups.push({ type: reactionType, userIds: [auth.id] });
    }
    toggledOn = true;
  }

  const cleaned = groups.filter((g) => g.userIds.length > 0);
  const nowIso = new Date().toISOString();

  await execute(
    c.env.DB,
    'UPDATE chat_messages SET reactions_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(cleaned), nowIso, row.id],
  );

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.reaction',
      messageId: row.id,
      senderId: auth.id,
      title: toggledOn ? '' : '',
      body: '',
    });
  }

  return c.json({ reactions: cleaned });
});

messageRoutes.post('/messages/read', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const body = (await c.req.json().catch(() => null)) as { messageIds?: string[]; upTo?: string } | null;
  const targetIds = Array.isArray(body?.messageIds) ? body!.messageIds.filter(Boolean) : [];
  const upToId = typeof body?.upTo === 'string' && body.upTo.trim() ? body.upTo.trim() : undefined;

  let candidates: ChatMessageRow[];
  if (targetIds.length > 0) {
    const placeholders = targetIds.map(() => '?').join(', ');
    candidates = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages WHERE couple_id = ? AND id IN (${placeholders})`,
      [auth.coupleId, ...targetIds],
    );
  } else if (upToId) {
    candidates = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages
       WHERE couple_id = ? AND sender_id != ? AND id <= ?
       ORDER BY id DESC LIMIT 100`,
      [auth.coupleId, auth.id, upToId],
    );
  } else {
    candidates = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages
       WHERE couple_id = ? AND sender_id != ?
       ORDER BY id DESC LIMIT 100`,
      [auth.coupleId, auth.id],
    );
  }

  const nowIso = new Date().toISOString();
  let updatedCount = 0;

  for (const row of candidates) {
    const readBy = parseJsonSafe<string[]>(row.read_by_json, []);
    if (readBy.includes(auth.id)) continue;
    readBy.push(auth.id);
    await execute(
      c.env.DB,
      'UPDATE chat_messages SET read_by_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(readBy), nowIso, row.id],
    );
    updatedCount += 1;
  }

  if (updatedCount > 0) {
    const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
    if (partner) {
      await emitRealtimeEvent(c.env, partner.id, {
        type: 'message.read',
        senderId: auth.id,
        title: '',
        body: '',
      });
    }
  }

  return c.json({ success: true, updated: updatedCount });
});

messageRoutes.post('/messages/typing', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) return c.json({ ok: true });

  const body = (await c.req.json().catch(() => null)) as { isTyping?: boolean } | null;
  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.typing',
      senderId: auth.id,
      isTyping: Boolean(body?.isTyping),
      title: '',
      body: '',
    });
  }
  return c.json({ ok: true });
});

messageRoutes.post('/messages/presence', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) return c.json({ ok: true });

  const body = (await c.req.json().catch(() => null)) as { online?: boolean } | null;
  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.presence',
      senderId: auth.id,
      online: Boolean(body?.online),
      title: '',
      body: '',
    });
  }
  return c.json({ ok: true });
});

messageRoutes.delete('/messages/:id', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const messageId = c.req.param('id');
  const row = await queryOne<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
    [messageId, auth.coupleId],
  );
  if (!row) {
    throw new AppError('Không tìm thấy tin nhắn', 404, 'MESSAGE_NOT_FOUND');
  }
  if (row.sender_id !== auth.id) {
    throw new AppError('Bạn chỉ có thể thu hồi tin nhắn của chính mình', 403, 'FORBIDDEN');
  }

  const nowIso = new Date().toISOString();
  const attachments = parseJsonSafe<ChatAttachment[]>(row.attachments_json, []);
  for (const att of attachments) {
    if (att.storagePath) {
      await deleteStoredFile(c.env.STORAGE, att.storagePath, c.get('config').R2_PUBLIC_URL);
    }
  }
  if (row.storage_path) {
    await deleteStoredFile(c.env.STORAGE, row.storage_path, c.get('config').R2_PUBLIC_URL);
  }

  await execute(
    c.env.DB,
    `UPDATE chat_messages
     SET deleted_at = ?, text = NULL, image_url = NULL, storage_path = NULL,
         attachments_json = '[]', updated_at = ?
     WHERE id = ?`,
    [nowIso, nowIso, row.id],
  );

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.deleted',
      messageId: row.id,
      senderId: auth.id,
      title: '',
      body: '',
    });
  }

  return c.json({ success: true });
});
