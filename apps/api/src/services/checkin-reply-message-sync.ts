import { execute, queryAll, queryOne } from '../db/d1';
import {
  parseJsonSafe,
  type ChatMessageType,
  type CheckinReplyItem,
  type CheckinRow,
  type ReferencedCheckinSnapshot,
} from '../db/types';
import { deterministicObjectId } from '../utils/id';

const syncedCouplesByDb = new WeakMap<D1Database, Set<string>>();

function getSyncedSet(db: D1Database): Set<string> {
  let set = syncedCouplesByDb.get(db);
  if (!set) {
    set = new Set<string>();
    syncedCouplesByDb.set(db, set);
  }
  return set;
}

export function toReferencedCheckinSnapshot(checkin: CheckinRow): ReferencedCheckinSnapshot {
  return {
    checkinId: checkin.id,
    ownerId: checkin.owner_id,
    ownerName: checkin.owner_name,
    type: checkin.type,
    caption: checkin.caption ?? checkin.quick_message ?? undefined,
    mood: checkin.mood ?? undefined,
    imageUrl: checkin.image_url ?? undefined,
    createdAt: checkin.created_at,
  };
}

function buildReplyIdentity(checkinId: string, senderId: string, createdAtIso: string, text: string): string {
  const normalizedIso = new Date(createdAtIso).toISOString();
  return [checkinId, senderId, normalizedIso, text].join(':');
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
    clientMutationId?: string;
    type?: ChatMessageType;
    readBy?: string[];
  },
): Promise<{ id: string } | null> {
  const trimmedText = params.messageText.trim();
  if (!trimmedText) return null;

  const createdAtIso = params.createdAt ?? new Date().toISOString();
  const identity = buildReplyIdentity(params.checkin.id, params.senderId, createdAtIso, trimmedText);
  const deterministicId = await deterministicObjectId(createdAtIso, identity);
  const id = params.messageId ?? deterministicId;
  const clientMutationId = params.clientMutationId ?? `legacy-reply:${deterministicId}`;

  const existingByMutation = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM chat_messages
     WHERE couple_id = ? AND client_mutation_id = ?
     LIMIT 1`,
    [params.coupleId, clientMutationId],
  );
  if (existingByMutation) return existingByMutation;

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

  const snapshot = toReferencedCheckinSnapshot(params.checkin);
  const readBy = Array.from(new Set(params.readBy ?? [params.senderId]));
  const msgType: ChatMessageType = params.type ?? 'checkin_reply';

  await execute(
    db,
    `INSERT OR IGNORE INTO chat_messages (
      id, couple_id, sender_id, sender_name, type, text,
      referenced_checkin_id, referenced_checkin_json, client_mutation_id,
      read_by_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.coupleId,
      params.senderId,
      params.senderName,
      msgType,
      trimmedText,
      params.checkin.id,
      JSON.stringify(snapshot),
      clientMutationId,
      JSON.stringify(readBy),
      createdAtIso,
      createdAtIso,
    ],
  );

  return { id };
}

/**
 * Bridges historical photo check-ins and legacy embedded replies into chat_messages
 * using deterministic timestamp-ordered ObjectIds so old records never jump to the
 * top of cursor pagination (`ORDER BY id DESC`).
 */
export async function syncCheckinRepliesPage(
  db: D1Database,
  coupleId: string,
  checkins: CheckinRow[],
): Promise<number> {
  if (checkins.length === 0) return 0;

  // Load existing reply messages for these check-ins in a single query to avoid duplicates
  // even if a reply was already stored under a non-deterministic ID.
  const checkinIds = checkins.map((ci) => ci.id);
  const existingKeys = new Set<string>();
  const existingPhotoCheckins = new Set<string>();
  const QUERY_CHUNK = 80;
  for (let i = 0; i < checkinIds.length; i += QUERY_CHUNK) {
    const chunkIds = checkinIds.slice(i, i + QUERY_CHUNK);
    const placeholders = chunkIds.map(() => '?').join(', ');
    const rows = await queryAll<{
      referenced_checkin_id: string | null;
      type: string;
      sender_id: string;
      text: string | null;
      created_at: string;
    }>(
      db,
      `SELECT referenced_checkin_id, type, sender_id, text, created_at
       FROM chat_messages
       WHERE couple_id = ? AND referenced_checkin_id IN (${placeholders})`,
      [coupleId, ...chunkIds],
    );
    for (const r of rows) {
      if (!r.referenced_checkin_id) continue;
      if (r.type === 'image') {
        existingPhotoCheckins.add(r.referenced_checkin_id);
      }
      if (r.text) {
        existingKeys.add(`${r.referenced_checkin_id}::${r.sender_id}::${r.text}::${r.created_at}`);
      }
    }
  }

  const statements: D1PreparedStatement[] = [];
  const insertPhotoSql = `INSERT OR IGNORE INTO chat_messages (
    id, couple_id, sender_id, sender_name, type, text,
    image_url, storage_path, attachments_json,
    referenced_checkin_id, referenced_checkin_json, client_mutation_id,
    read_by_json, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const insertReplySql = `INSERT OR IGNORE INTO chat_messages (
    id, couple_id, sender_id, sender_name, type, text,
    referenced_checkin_id, referenced_checkin_json, client_mutation_id,
    read_by_json, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'text', ?, ?, ?, ?, ?, ?, ?)`;

  for (const checkin of checkins) {
    const snapshot = toReferencedCheckinSnapshot(checkin);
    const snapshotJson = JSON.stringify(snapshot);

    if (checkin.type === 'photo' && checkin.image_url && !existingPhotoCheckins.has(checkin.id)) {
      const attachments = [{ url: checkin.image_url, storagePath: checkin.storage_path ?? undefined }];
      statements.push(
        db.prepare(insertPhotoSql).bind(
          checkin.id,
          coupleId,
          checkin.owner_id,
          checkin.owner_name,
          checkin.caption ?? checkin.quick_message ?? null,
          checkin.image_url,
          checkin.storage_path,
          JSON.stringify(attachments),
          checkin.id,
          snapshotJson,
          `checkin-photo:${checkin.id}`,
          JSON.stringify([checkin.owner_id]),
          checkin.created_at,
          checkin.updated_at || checkin.created_at,
        ),
      );
      existingPhotoCheckins.add(checkin.id);
    }

    const replies = parseJsonSafe<CheckinReplyItem[]>(checkin.replies_json, []);
    for (const reply of replies) {
      const text = (reply.message ?? '').trim();
      if (!text || !reply.userId) continue;
      const createdAtIso = reply.createdAt || checkin.created_at;
      const key = `${checkin.id}::${reply.userId}::${text}::${createdAtIso}`;
      if (existingKeys.has(key)) continue;

      const identity = buildReplyIdentity(checkin.id, reply.userId, createdAtIso, text);
      const messageId = await deterministicObjectId(createdAtIso, identity);
      const clientMutationId = `legacy-reply:${messageId}`;

      statements.push(
        db.prepare(insertReplySql).bind(
          messageId,
          coupleId,
          reply.userId,
          reply.userName || 'Người ấy',
          text,
          checkin.id,
          snapshotJson,
          clientMutationId,
          JSON.stringify([reply.userId]),
          createdAtIso,
          createdAtIso,
        ),
      );
      existingKeys.add(key);
    }
  }

  if (statements.length === 0) return 0;

  let inserted = 0;
  const CHUNK_SIZE = 50;
  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    const chunk = statements.slice(i, i + CHUNK_SIZE);
    const results = await db.batch(chunk);
    for (const r of results) {
      inserted += Number(r.meta?.changes ?? 0);
    }
  }
  return inserted;
}

/**
 * Ensures legacy check-in photos & replies for a couple are bridged into chat_messages
 * at most ONCE per couple (cached in both isolate memory and system_kv), avoiding
 * per-request overhead on GET /messages.
 */
export async function syncLegacyCheckinsToMessagesOnce(
  db: D1Database,
  coupleId: string,
): Promise<void> {
  const syncedSet = getSyncedSet(db);
  if (syncedSet.has(coupleId)) return;

  const kvKey = `legacy_sync:v2:${coupleId}`;
  const marker = await queryOne<{ value: string }>(
    db,
    'SELECT value FROM system_kv WHERE key = ? LIMIT 1',
    [kvKey],
  );
  if (marker) {
    syncedSet.add(coupleId);
    return;
  }

  const checkins = await queryAll<CheckinRow>(
    db,
    `SELECT * FROM checkins
     WHERE couple_id = ?
       AND deleted_at IS NULL
       AND (
         (type = 'photo' AND image_url IS NOT NULL AND id NOT IN (
           SELECT referenced_checkin_id FROM chat_messages
           WHERE couple_id = ? AND referenced_checkin_id IS NOT NULL AND type = 'image'
         ))
         OR replies_json != '[]'
       )
     ORDER BY created_at DESC
     LIMIT 300`,
    [coupleId, coupleId],
  );

  if (checkins.length > 0) {
    await syncCheckinRepliesPage(db, coupleId, checkins);
  }

  const nowIso = new Date().toISOString();
  await execute(
    db,
    `INSERT INTO system_kv (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [kvKey, nowIso, nowIso],
  );
  syncedSet.add(coupleId);
}
