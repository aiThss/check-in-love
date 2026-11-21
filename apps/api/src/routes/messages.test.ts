import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { WorkerEnv } from '../config/env';
import { createTestD1Database, MemoryR2Bucket } from '../db/sqlite-test-d1';
import { signJwt } from '../utils/crypto';

describe('Messages SQL routes', () => {
  const secret = 'test-jwt-secret-key-min-32-chars!!';
  let db: D1Database;
  let env: WorkerEnv;
  let token1: string;
  let token2: string;

  beforeEach(async () => {
    db = createTestD1Database();
    env = {
      DB: db,
      STORAGE: new MemoryR2Bucket() as unknown as R2Bucket,
      NODE_ENV: 'test',
      JWT_SECRET: secret,
    } as unknown as WorkerEnv;

    const now = new Date().toISOString();
    await db
      .prepare('INSERT INTO couples (id, code, streak, created_at, updated_at) VALUES (?, ?, 0, ?, ?)')
      .bind('couple_msg', 'CHAT88', now, now)
      .run();
    await db
      .prepare(
        `INSERT INTO users (id, display_name, partner_name, email, role, status, couple_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      )
      .bind('u_me', 'Me', 'You', 'me@example.com', 'couple_msg', now, now)
      .run();
    await db
      .prepare(
        `INSERT INTO users (id, display_name, partner_name, email, role, status, couple_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      )
      .bind('u_you', 'You', 'Me', 'you@example.com', 'couple_msg', now, now)
      .run();

    token1 = await signJwt({ userId: 'u_me', coupleId: 'couple_msg', role: 'user' }, secret);
    token2 = await signJwt({ userId: 'u_you', coupleId: 'couple_msg', role: 'user' }, secret);
  });

  it('persists text messages, referenced checkins, edits, reactions, read receipts, and soft deletes', async () => {
    const app = createApp();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO checkins (id, couple_id, owner_id, owner_name, type, image_url, reactions_json, replies_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'photo', '/uploads/photo.jpg', '[]', '[]', ?, ?)`,
      )
      .bind('chk_ref_1', 'couple_msg', 'u_me', 'Me', now, now)
      .run();

    const res1 = await app.request(
      'http://localhost/api/messages',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'text',
          text: 'Xin chào',
          clientMutationId: 'client-1',
        }),
      },
      env,
    );
    expect(res1.status).toBe(201);
    const json1 = (await res1.json()) as { message: { id: string; text: string } };
    expect(json1.message.text).toBe('Xin chào');

    const resRef = await app.request(
      'http://localhost/api/messages',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token2}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'text',
          text: 'Nhớ ảnh này',
          referencedCheckinId: 'chk_ref_1',
        }),
      },
      env,
    );
    expect(resRef.status).toBe(201);
    const jsonRef = (await resRef.json()) as {
      message: { id: string; type: string; referencedCheckin?: { checkinId: string; ownerName: string } };
    };
    expect(jsonRef.message.type).toBe('checkin_reply');
    expect(jsonRef.message.referencedCheckin).toMatchObject({
      checkinId: 'chk_ref_1',
      ownerName: 'Me',
    });

    // Edit own message
    const editRes = await app.request(
      `http://localhost/api/messages/${json1.message.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: 'Chào buổi tối!' }),
      },
      env,
    );
    expect(editRes.status).toBe(200);
    const editJson = (await editRes.json()) as { message: { text: string; editHistory: unknown[] } };
    expect(editJson.message.text).toBe('Chào buổi tối!');
    expect(editJson.message.editHistory).toHaveLength(1);

    // Toggle reaction + mark read
    const reactRes = await app.request(
      `http://localhost/api/messages/${json1.message.id}/reactions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token2}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: '❤️' }),
      },
      env,
    );
    expect(reactRes.status).toBe(200);
    expect((await reactRes.json()) as { reactions: unknown[] }).toMatchObject({
      reactions: [{ type: '❤️', userIds: ['u_you'] }],
    });

    const readRes = await app.request(
      'http://localhost/api/messages/read',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token2}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageIds: [json1.message.id] }),
      },
      env,
    );
    expect(readRes.status).toBe(200);
    await expect(readRes.json()).resolves.toMatchObject({ success: true, updated: 1, modifiedCount: 1 });

    // Soft-deleted message must not be returned by GET /messages
    const delRes = await app.request(
      `http://localhost/api/messages/${json1.message.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token1}` } },
      env,
    );
    expect(delRes.status).toBe(200);

    const listRes = await app.request(
      'http://localhost/api/messages?limit=50',
      { headers: { Authorization: `Bearer ${token1}` } },
      env,
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { messages: Array<{ id: string }> };
    expect(listJson.messages.map((m) => m.id)).not.toContain(json1.message.id);
  });

  it('syncs historical check-in photos and replies with deterministic chronological IDs before newer messages', async () => {
    const app = createApp();
    const oldDate = '2026-06-21T08:00:00.000Z';
    const replyDate = '2026-06-21T08:05:00.000Z';
    const recentDate = '2026-11-20T10:00:00.000Z';

    await db
      .prepare(
        `INSERT INTO checkins (id, couple_id, owner_id, owner_name, type, image_url, caption, reactions_json, replies_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'photo', 'https://pub-test.r2.dev/old.jpg', 'Kỷ niệm cũ', '[]', ?, ?, ?)`,
      )
      .bind(
        '6a3790000000000000000001',
        'couple_msg',
        'u_me',
        'Me',
        JSON.stringify([{ userId: 'u_you', userName: 'You', message: 'Nhớ ngày này', createdAt: replyDate }]),
        oldDate,
        oldDate,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO chat_messages (id, couple_id, sender_id, sender_name, type, text, read_by_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'text', ?, '["u_me"]', ?, ?)`,
      )
      .bind('6afff0000000000000000001', 'couple_msg', 'u_me', 'Me', 'Tin nhắn mới nhất', recentDate, recentDate)
      .run();

    const listRes = await app.request(
      'http://localhost/api/messages?limit=10',
      { headers: { Authorization: `Bearer ${token1}` } },
      env,
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      messages: Array<{ id: string; type: string; text?: string; createdAt: string }>;
    };
    expect(listJson.messages).toHaveLength(3);
    // Chronological order: old photo -> old reply -> newest message
    expect(listJson.messages[0].id).toBe('6a3790000000000000000001');
    expect(listJson.messages[0].type).toBe('image');
    expect(listJson.messages[1].text).toBe('Nhớ ngày này');
    expect(listJson.messages[1].id < '6afff0000000000000000001').toBe(true);
    expect(listJson.messages[2].id).toBe('6afff0000000000000000001');
  });

  it('marks sticker uploads with lc-media=sticker and type image, and supports fcmToken registration', async () => {
    const app = createApp();
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const form = new FormData();
    form.append('file', new File([pngBytes], 'sticker.png', { type: 'image/png' }));

    const stickerRes = await app.request(
      'http://localhost/api/messages/sticker',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
        body: form,
      },
      env,
    );
    expect(stickerRes.status).toBe(201);
    const stickerJson = (await stickerRes.json()) as { message: { type: string; imageUrl: string } };
    expect(stickerJson.message.type).toBe('image');
    expect(stickerJson.message.imageUrl).toContain('lc-media=sticker');

    const fcmRes = await app.request(
      'http://localhost/api/push/subscribe-fcm',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fcmToken: 'test-android-fcm-token-1234567890' }),
      },
      env,
    );
    expect(fcmRes.status).toBe(200);
    await expect(fcmRes.json()).resolves.toMatchObject({ success: true, tokenCount: 1 });
  });
});
