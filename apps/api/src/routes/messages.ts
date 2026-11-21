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
import {
  syncLegacyCheckinsToMessagesOnce,
  toReferencedCheckinSnapshot,
} from '../services/checkin-reply-message-sync';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import { isUploadedFile, saveUploadedImage } from '../services/storage';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const messageRoutes = new Hono<HonoAppEnv>();

function snippet(message: { text?: string | null; imageUrl?: string | null }): string {
  return (message.text?.replace(/\s+/g, ' ').trim() || (message.imageUrl ? 'Ảnh' : 'Tin nhắn')).slice(0, 160);
}

async function hydrateLiveCheckins(
  db: D1Database,
  coupleId: string,
  rows: ChatMessageRow[],
): Promise<ReturnType<typeof toMessageDto>[]> {
  const referencedIds = Array.from(
    new Set(
      rows
        .map((row) => row.referenced_checkin_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (referencedIds.length === 0) {
    return rows.map(toMessageDto);
  }

  const placeholders = referencedIds.map(() => '?').join(', ');
  const checkins = await queryAll<CheckinRow>(
    db,
    `SELECT * FROM checkins
     WHERE couple_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
    [coupleId, ...referencedIds],
  );

  const liveById = new Map(checkins.map((ci) => [ci.id, ci]));

  return rows.map((row) => {
    const dto = toMessageDto(row);
    const liveCheckin = row.referenced_checkin_id
      ? liveById.get(row.referenced_checkin_id)
      : undefined;
    if (!liveCheckin) return dto;

    dto.referencedCheckin = toReferencedCheckinSnapshot(liveCheckin);
    if (dto.type === 'image' && liveCheckin.type === 'photo') {
      dto.imageUrl = liveCheckin.image_url ?? dto.imageUrl;
      dto.text = liveCheckin.caption ?? liveCheckin.quick_message ?? dto.text;
    }
    return dto;
  });
}

messageRoutes.get('/messages', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') || '30', 10) || 30));
  const before = c.req.query('before')?.trim();
  const after = c.req.query('after')?.trim();

  if (before && after) {
    throw new AppError('Không thể dùng đồng thời before và after', 400, 'VALIDATION_ERROR');
  }

  await syncLegacyCheckinsToMessagesOnce(c.env.DB, auth.coupleId);

  let rows: ChatMessageRow[];
  let hasMore: boolean;

  if (after) {
    const fetched = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages
       WHERE couple_id = ? AND deleted_at IS NULL AND id > ?
       ORDER BY id ASC LIMIT ?`,
      [auth.coupleId, after, limit + 1],
    );
    hasMore = fetched.length > limit;
    rows = fetched.slice(0, limit);
  } else if (before) {
    const fetchedDesc = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages
       WHERE couple_id = ? AND deleted_at IS NULL AND id < ?
       ORDER BY id DESC LIMIT ?`,
      [auth.coupleId, before, limit + 1],
    );
    hasMore = fetchedDesc.length > limit;
    rows = fetchedDesc.slice(0, limit).reverse();
  } else {
    const fetchedDesc = await queryAll<ChatMessageRow>(
      c.env.DB,
      `SELECT * FROM chat_messages
       WHERE couple_id = ? AND deleted_at IS NULL
       ORDER BY id DESC LIMIT ?`,
      [auth.coupleId, limit + 1],
    );
    hasMore = fetchedDesc.length > limit;
    rows = fetchedDesc.slice(0, limit).reverse();
  }

  const messages = await hydrateLiveCheckins(c.env.DB, auth.coupleId, rows);

  return c.json({
    messages,
    pagination: {
      hasMore,
      beforeCursor: rows[0]?.id ?? null,
      afterCursor: rows[rows.length - 1]?.id ?? null,
      limit,
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
    if (isUploadedFile(fileEntry) && fileEntry.size > 0) {
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
      return c.json({ message: toMessageDto(existing), duplicate: true }, 200);
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
        textSnippet: snippet({ text: refMsg.text, imageUrl: refMsg.image_url }),
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
      referencedCheckin = toReferencedCheckinSnapshot(checkin);
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
    const notifTitle = `${user.display_name} đã nhắn cho bạn`;
    const notifBody = snippet({ text, imageUrl });

    await Promise.allSettled([
      sendPushToUser(c.env, config, partner.id, {
        title: notifTitle,
        body: notifBody,
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
        photoUrl: imageUrl ?? undefined,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: 'message',
        messageId,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title: notifTitle,
        body: notifBody,
        photoUrl: imageUrl ?? undefined,
        targetUrl: '/app/messages',
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
    'SELECT * FROM chat_messages WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
    [targetId, auth.coupleId],
  );
  if (!target) {
    throw new AppError('Không tìm thấy tin nhắn', 404, 'MESSAGE_NOT_FOUND');
  }

  const [olderDesc, newerAsc] = await Promise.all([
    queryAll<ChatMessageRow>(
      c.env.DB,
      'SELECT * FROM chat_messages WHERE couple_id = ? AND deleted_at IS NULL AND id < ? ORDER BY id DESC LIMIT 10',
      [auth.coupleId, target.id],
    ),
    queryAll<ChatMessageRow>(
      c.env.DB,
      'SELECT * FROM chat_messages WHERE couple_id = ? AND deleted_at IS NULL AND id > ? ORDER BY id ASC LIMIT 10',
      [auth.coupleId, target.id],
    ),
  ]);

  const combined = [...olderDesc.reverse(), target, ...newerAsc];
  const messages = await hydrateLiveCheckins(c.env.DB, auth.coupleId, combined);
  return c.json({ messages });
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
  const previousText = row.text?.trim();
  if (previousText && previousText !== nextText) {
    history.push({ text: previousText, editedAt: row.edited_at ?? nowIso });
  }
  const trimmedHistory = history.slice(-20);

  await execute(
    c.env.DB,
    'UPDATE chat_messages SET text = ?, edited_at = ?, edit_history_json = ?, updated_at = ? WHERE id = ?',
    [nextText, nowIso, JSON.stringify(trimmedHistory), nowIso, row.id],
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
      senderName: row.sender_name,
      title: `${row.sender_name} đã chỉnh sửa tin nhắn`,
      body: snippet({ text: nextText, imageUrl: row.image_url }),
      targetUrl: '/app/messages',
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
  let active: boolean;

  const targetGroup = groups.find((g) => g.type === reactionType);
  if (targetGroup) {
    const idx = targetGroup.userIds.indexOf(auth.id);
    if (idx >= 0) {
      targetGroup.userIds.splice(idx, 1);
      active = false;
    } else {
      targetGroup.userIds.push(auth.id);
      active = true;
    }
  } else {
    groups.push({ type: reactionType, userIds: [auth.id] });
    active = true;
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
    const reactor = await findUserById(c.env.DB, auth.id);
    const reactorName = reactor?.display_name ?? row.sender_name;
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.reaction',
      messageId: row.id,
      reactionType,
      senderId: auth.id,
      senderName: reactorName,
      title: active ? `${reactorName} đã bày tỏ cảm xúc` : '',
      body: active ? reactionType : '',
      targetUrl: '/app/messages',
    });
  }

  return c.json({ messageId: row.id, reactions: cleaned, active });
});

messageRoutes.post('/messages/read', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const body = (await c.req.json().catch(() => null)) as { messageIds?: string[]; upTo?: string } | null;
  const targetIds = Array.isArray(body?.messageIds) ? body!.messageIds.filter(Boolean).slice(0, 100) : [];
  const upToId = typeof body?.upTo === 'string' && body.upTo.trim() ? body.upTo.trim() : undefined;

  let candidates: Array<{ id: string; read_by_json: string }>;
  if (targetIds.length > 0) {
    const placeholders = targetIds.map(() => '?').join(', ');
    candidates = await queryAll<{ id: string; read_by_json: string }>(
      c.env.DB,
      `SELECT id, read_by_json FROM chat_messages
       WHERE couple_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
      [auth.coupleId, ...targetIds],
    );
  } else if (upToId) {
    candidates = await queryAll<{ id: string; read_by_json: string }>(
      c.env.DB,
      `SELECT id, read_by_json FROM chat_messages
       WHERE couple_id = ? AND deleted_at IS NULL AND sender_id != ? AND id <= ?
       ORDER BY id DESC LIMIT 100`,
      [auth.coupleId, auth.id, upToId],
    );
  } else {
    candidates = await queryAll<{ id: string; read_by_json: string }>(
      c.env.DB,
      `SELECT id, read_by_json FROM chat_messages
       WHERE couple_id = ? AND deleted_at IS NULL AND sender_id != ?
       ORDER BY id DESC LIMIT 100`,
      [auth.coupleId, auth.id],
    );
  }

  const nowIso = new Date().toISOString();
  const updateStatements: D1PreparedStatement[] = [];

  for (const row of candidates) {
    const readBy = parseJsonSafe<string[]>(row.read_by_json, []);
    if (readBy.includes(auth.id)) continue;
    readBy.push(auth.id);
    updateStatements.push(
      c.env.DB
        .prepare('UPDATE chat_messages SET read_by_json = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(readBy), nowIso, row.id),
    );
  }

  const updatedCount = updateStatements.length;
  if (updatedCount > 0) {
    await c.env.DB.batch(updateStatements);
    const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
    if (partner) {
      await emitRealtimeEvent(c.env, partner.id, {
        type: 'message.read',
        senderId: auth.id,
        messageId: upToId ?? targetIds[targetIds.length - 1],
        title: '',
        body: '',
        targetUrl: '/app/messages',
      });
    }
  }

  return c.json({ success: true, updated: updatedCount, modifiedCount: updatedCount });
});

messageRoutes.post('/messages/typing', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) return c.json({ ok: true, success: true });

  const body = (await c.req.json().catch(() => null)) as { isTyping?: boolean } | null;
  const [partner, user] = await Promise.all([
    findPartnerUser(c.env.DB, auth.coupleId, auth.id),
    findUserById(c.env.DB, auth.id),
  ]);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.typing',
      senderId: auth.id,
      senderName: user?.display_name,
      isTyping: Boolean(body?.isTyping),
      title: '',
      body: '',
      targetUrl: '/app/messages',
    });
  }
  return c.json({ ok: true, success: true });
});

messageRoutes.post('/messages/presence', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) return c.json({ ok: true, success: true });

  const body = (await c.req.json().catch(() => null)) as { online?: boolean } | null;
  const online = body?.online !== false;
  const [partner, user] = await Promise.all([
    findPartnerUser(c.env.DB, auth.coupleId, auth.id),
    findUserById(c.env.DB, auth.id),
  ]);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.presence',
      senderId: auth.id,
      senderName: user?.display_name,
      online,
      title: '',
      body: '',
      targetUrl: '/app/messages',
    });
  }
  return c.json({ ok: true, success: true });
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

  await execute(
    c.env.DB,
    `UPDATE chat_messages
     SET deleted_at = ?, updated_at = ?
     WHERE id = ?`,
    [nowIso, nowIso, row.id],
  );

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'message.updated',
      deleted: true,
      messageId: row.id,
      senderId: auth.id,
      senderName: row.sender_name,
      title: `${row.sender_name} đã thu hồi tin nhắn`,
      body: 'Tin nhắn đã được thu hồi',
      targetUrl: '/app/messages',
    });
  }

  return c.json({ success: true });
});
