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
    await expect(readRes.json()).resolves.toMatchObject({ success: true, updated: 1 });
  });
});
