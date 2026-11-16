import { execute, queryAll, queryOne } from '../db/d1';
import {
  parseJsonSafe,
  type CheckinReplyItem,
  type CheckinRow,
  type ReferencedCheckinSnapshot,
} from '../db/types';
import { generateId } from '../utils/id';

function toReferencedCheckinSnapshot(checkin: CheckinRow): ReferencedCheckinSnapshot {
  return {
    checkinId: checkin.id,
    ownerId: checkin.owner_id,
    ownerName: checkin.owner_name,
    type: checkin.type,
    caption: checkin.caption ?? undefined,
    mood: checkin.mood ?? undefined,
    imageUrl: checkin.image_url ?? undefined,
    createdAt: checkin.created_at,
  };
}

export async function syncCheckinReplyToMessage(
  db: D1Database,
  params: {
    coupleId: string;
    checkin: CheckinRow;
    senderId: string;
    senderName: string;
    messageText: string;
    createdAt?: string;
    messageId?: string;
    readBy?: string[];
  },
): Promise<{ id: string } | null> {
  const trimmedText = params.messageText.trim();
  if (!trimmedText) return null;

  const createdAtIso = params.createdAt ?? new Date().toISOString();

  const existing = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM chat_messages
     WHERE couple_id = ?
       AND referenced_checkin_id = ?
       AND sender_id = ?
       AND text = ?
       AND created_at = ?
     LIMIT 1`,
    [params.coupleId, params.checkin.id, params.senderId, trimmedText, createdAtIso],
  );
  if (existing) return existing;

  const id = params.messageId ?? generateId();
  const snapshot = toReferencedCheckinSnapshot(params.checkin);
  const readBy = Array.from(new Set(params.readBy ?? [params.senderId]));

  await execute(
    db,
    `INSERT INTO chat_messages (
      id, couple_id, sender_id, sender_name, type, text,
      referenced_checkin_id, referenced_checkin_json, read_by_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'checkin_reply', ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.coupleId,
      params.senderId,
      params.senderName,
      trimmedText,
      params.checkin.id,
      JSON.stringify(snapshot),
      JSON.stringify(readBy),
      createdAtIso,
      createdAtIso,
    ],
  );

  return { id };
}

export async function syncCheckinRepliesPage(
  db: D1Database,
  coupleId: string,
  checkins: CheckinRow[],
): Promise<number> {
  let created = 0;

  for (const checkin of checkins) {
    const replies = parseJsonSafe<CheckinReplyItem[]>(checkin.replies_json, []);
    if (replies.length === 0) continue;

    const existingRows = await queryAll<{ sender_id: string; text: string | null; created_at: string }>(
      db,
      `SELECT sender_id, text, created_at
       FROM chat_messages
       WHERE couple_id = ? AND referenced_checkin_id = ?`,
      [coupleId, checkin.id],
    );

    const existingKeys = new Set(
      existingRows.map((r) => `${r.sender_id}::${r.text ?? ''}::${r.created_at}`),
    );

    for (const reply of replies) {
      const text = (reply.message ?? '').trim();
      if (!text || !reply.userId) continue;
      const createdAtIso = reply.createdAt || checkin.created_at;
      const key = `${reply.userId}::${text}::${createdAtIso}`;
      if (existingKeys.has(key)) continue;

      const synced = await syncCheckinReplyToMessage(db, {
        coupleId,
        checkin,
        senderId: reply.userId,
        senderName: reply.userName || 'Người ấy',
        messageText: text,
        createdAt: createdAtIso,
        readBy: [reply.userId],
      });
      if (synced) {
        existingKeys.add(key);
        created += 1;
      }
    }
  }

  return created;
}
