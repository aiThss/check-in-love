import { Hono } from 'hono';
import { execute, findPartnerUser, findUserById, queryOne } from '../db/d1';
import { parseJsonSafe, type JourneyRow } from '../db/types';
import { authenticate } from '../middleware/auth';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';

export const journeyRoutes = new Hono<HonoAppEnv>();

export function buildNotification(
  senderName: string,
  actionType?: string,
  itemTitle?: string,
): { title: string; body: string } | null {
  const titleSuffix = itemTitle ? `: "${itemTitle}"` : '';
  switch (actionType) {
    case 'add_bucket':
      return {
        title: 'Điều ước mới trong Hành Trình 💕',
        body: `${senderName} vừa thêm một điều ước mới${titleSuffix}`,
      };
    case 'complete_bucket':
      return {
        title: 'Hoàn thành một điều ước! 🎉',
        body: `${senderName} vừa đánh dấu đã thực hiện${titleSuffix}`,
      };
    case 'add_place':
      return {
        title: 'Địa điểm mới trên bản đồ tình yêu 📍',
        body: `${senderName} vừa ghim một địa điểm mới${titleSuffix}`,
      };
    case 'visit_place':
      return {
        title: 'Thêm dấu chân kỷ niệm! ✈️',
        body: `${senderName} vừa check-in đã đến${titleSuffix}`,
      };
    case 'edit_bucket':
    case 'edit_place':
      return {
        title: 'Cập nhật Hành Trình ✨',
        body: `${senderName} vừa chỉnh sửa một kỷ niệm${titleSuffix}`,
      };
    default:
      return null;
  }
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    if (item && typeof item.id === 'string') map.set(item.id, item);
  }
  for (const item of incoming) {
    if (item && typeof item.id === 'string') {
      const prev = map.get(item.id);
      map.set(item.id, prev ? { ...prev, ...item } : item);
    }
  }
  return Array.from(map.values());
}

journeyRoutes.get('/journey', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const row = await queryOne<JourneyRow>(
    c.env.DB,
    'SELECT * FROM couple_journeys WHERE couple_id = ? LIMIT 1',
    [auth.coupleId],
  );

  return c.json({
    places: parseJsonSafe<unknown[]>(row?.places_json, []),
    bucketItems: parseJsonSafe<unknown[]>(row?.bucket_items_json, []),
  });
});

journeyRoutes.put('/journey', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const body = (await c.req.json().catch(() => null)) as {
    places?: unknown[];
    bucketItems?: unknown[];
    actionType?: string;
    itemTitle?: string;
  } | null;

  if (!body || (!Array.isArray(body.places) && !Array.isArray(body.bucketItems))) {
    throw new AppError('Dữ liệu hành trình không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await queryOne<JourneyRow>(
    c.env.DB,
    'SELECT * FROM couple_journeys WHERE couple_id = ? LIMIT 1',
    [auth.coupleId],
  );

  const nextPlaces = Array.isArray(body.places)
    ? body.places
    : parseJsonSafe<unknown[]>(existing?.places_json, []);
  const nextBucketItems = Array.isArray(body.bucketItems)
    ? body.bucketItems
    : parseJsonSafe<unknown[]>(existing?.bucket_items_json, []);

  const nowIso = new Date().toISOString();
  await execute(
    c.env.DB,
    `INSERT INTO couple_journeys (couple_id, places_json, bucket_items_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(couple_id) DO UPDATE SET
       places_json = excluded.places_json,
       bucket_items_json = excluded.bucket_items_json,
       updated_at = excluded.updated_at`,
    [auth.coupleId, JSON.stringify(nextPlaces), JSON.stringify(nextBucketItems), nowIso, nowIso],
  );

  const user = await findUserById(c.env.DB, auth.id);
  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner && user) {
    const notif = buildNotification(user.display_name, body.actionType, body.itemTitle);
    const targetUrl = body.actionType?.includes('place') ? '/app/journey?tab=map' : '/app/journey?tab=bucket';
    if (notif) {
      await sendPushToUser(c.env, c.get('config'), partner.id, {
        title: notif.title,
        body: notif.body,
        icon: user.avatar_url ?? undefined,
        badge: '/icons/icon-192.png',
        url: targetUrl,
        targetUrl,
        tag: `journey-${Date.now()}`,
        kind: 'journey',
        actionType: 'journey',
        type: 'journey',
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
      });
    }
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'journey.updated',
      journeyUpdated: true,
      journey: {
        places: nextPlaces,
        bucketItems: nextBucketItems,
      },
      senderId: user.id,
      senderName: user.display_name,
      senderAvatar: user.avatar_url ?? undefined,
      title: notif?.title ?? '',
      body: notif?.body ?? '',
      targetUrl,
      url: targetUrl,
    });
  }

  return c.json({
    places: nextPlaces,
    bucketItems: nextBucketItems,
  });
});

journeyRoutes.post('/journey/sync', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const body = (await c.req.json().catch(() => null)) as {
    localPlaces?: Array<{ id: string }>;
    localBucketItems?: Array<{ id: string }>;
  } | null;

  const existing = await queryOne<JourneyRow>(
    c.env.DB,
    'SELECT * FROM couple_journeys WHERE couple_id = ? LIMIT 1',
    [auth.coupleId],
  );

  const serverPlaces = parseJsonSafe<Array<{ id: string }>>(existing?.places_json, []);
  const serverBuckets = parseJsonSafe<Array<{ id: string }>>(existing?.bucket_items_json, []);

  const mergedPlaces = mergeById(
    serverPlaces,
    Array.isArray(body?.localPlaces) ? body!.localPlaces : [],
  );
  const mergedBuckets = mergeById(
    serverBuckets,
    Array.isArray(body?.localBucketItems) ? body!.localBucketItems : [],
  );

  const placesJson = JSON.stringify(mergedPlaces);
  const bucketsJson = JSON.stringify(mergedBuckets);
  const hasNewChanges =
    !existing || placesJson !== existing.places_json || bucketsJson !== existing.bucket_items_json;

  const nowIso = new Date().toISOString();
  await execute(
    c.env.DB,
    `INSERT INTO couple_journeys (couple_id, places_json, bucket_items_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(couple_id) DO UPDATE SET
       places_json = excluded.places_json,
       bucket_items_json = excluded.bucket_items_json,
       updated_at = excluded.updated_at`,
    [
      auth.coupleId,
      placesJson,
      bucketsJson,
      nowIso,
      nowIso,
    ],
  );

  if (hasNewChanges) {
    const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
    if (partner) {
      await emitRealtimeEvent(c.env, partner.id, {
        type: 'journey.updated',
        journeyUpdated: true,
        journey: {
          places: mergedPlaces,
          bucketItems: mergedBuckets,
        },
        title: '',
        body: '',
        targetUrl: '/app/journey',
        url: '/app/journey',
      });
    }
  }

  return c.json({
    places: mergedPlaces,
    bucketItems: mergedBuckets,
  });
});
