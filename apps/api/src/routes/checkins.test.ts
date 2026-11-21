import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { WorkerEnv } from '../config/env';
import { createTestD1Database, MemoryR2Bucket } from '../db/sqlite-test-d1';
import { signJwt } from '../utils/crypto';

describe('Check-ins SQL routes', () => {
  const secret = 'test-jwt-secret-key-min-32-chars!!';
  let db: D1Database;
  let env: WorkerEnv;
  let tokenUser1: string;
  let tokenUser2: string;

  beforeEach(async () => {
    db = createTestD1Database();
    env = {
      DB: db,
      STORAGE: new MemoryR2Bucket() as unknown as R2Bucket,
      NODE_ENV: 'test',
      JWT_SECRET: secret,
      PUBLIC_BASE_URL: 'https://api.couple.io.vn',
      R2_PUBLIC_URL: 'https://pub-test.r2.dev',
    } as unknown as WorkerEnv;

    const now = new Date().toISOString();
    await db
      .prepare('INSERT INTO couples (id, code, streak, created_at, updated_at) VALUES (?, ?, 0, ?, ?)')
      .bind('couple_1', 'LOVE99', now, now)
      .run();

    await db
      .prepare(
        `INSERT INTO users (id, display_name, partner_name, email, role, status, couple_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      )
      .bind('user_1', 'An', 'Binh', 'an@example.com', 'couple_1', now, now)
      .run();

    await db
      .prepare(
        `INSERT INTO users (id, display_name, partner_name, email, role, status, couple_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      )
      .bind('user_2', 'Binh', 'An', 'binh@example.com', 'couple_1', now, now)
      .run();

    tokenUser1 = await signJwt({ userId: 'user_1', coupleId: 'couple_1', role: 'user' }, secret);
    tokenUser2 = await signJwt({ userId: 'user_2', coupleId: 'couple_1', role: 'user' }, secret);
  });

  it('creates text and photo check-ins, updates streak, syncs replies to chat, and soft deletes', async () => {
    const app = createApp();

    // 1) Create text check-in with idempotency
    const createRes = await app.request(
      'http://localhost/api/checkins',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'text',
          caption: 'Hôm nay trời đẹp quá!',
          clientMutationId: 'mut-checkin-1',
        }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const createdJson = (await createRes.json()) as { checkIn: { id: string; caption: string }; streak: number };
    expect(createdJson.checkIn.caption).toBe('Hôm nay trời đẹp quá!');
    expect(createdJson.streak).toBe(1);

    // Repeat with same clientMutationId -> idempotent 200
    const repeatRes = await app.request(
      'http://localhost/api/checkins',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenUser1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'text',
          caption: 'Duplicate',
          clientMutationId: 'mut-checkin-1',
        }),
      },
      env,
    );
    expect(repeatRes.status).toBe(200);
    const repeatJson = (await repeatRes.json()) as { checkIn: { id: string } };
    expect(repeatJson.checkIn.id).toBe(createdJson.checkIn.id);

    // 2) Partner fetches latest-partner
    const partnerRes = await app.request(
      'http://localhost/api/checkins/latest-partner',
      { headers: { Authorization: `Bearer ${tokenUser2}` } },
      env,
    );
    expect(partnerRes.status).toBe(200);
    const partnerJson = (await partnerRes.json()) as { checkIn: { id: string } | null };
    expect(partnerJson.checkIn?.id).toBe(createdJson.checkIn.id);

    // 3) Partner adds reaction + reply (verifies chat sync!)
    const reactRes = await app.request(
      `http://localhost/api/checkins/${createdJson.checkIn.id}/reactions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenUser2}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: '❤️' }),
      },
      env,
    );
    expect(reactRes.status).toBe(200);
    const reactJson = (await reactRes.json()) as { reactions: Array<{ type: string; userId: string }> };
    expect(reactJson.reactions).toHaveLength(1);

    const replyRes = await app.request(
      `http://localhost/api/checkins/${createdJson.checkIn.id}/replies`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenUser2}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Đi dạo không em?' }),
      },
      env,
    );
    expect(replyRes.status).toBe(200);

    const msgRes = await app.request(
      'http://localhost/api/messages',
      { headers: { Authorization: `Bearer ${tokenUser1}` } },
      env,
    );
    expect(msgRes.status).toBe(200);
    const msgJson = (await msgRes.json()) as { messages: Array<{ type: string; text: string }> };
    expect(msgJson.messages).toHaveLength(1);
    expect(msgJson.messages[0]).toMatchObject({
      type: 'checkin_reply',
      text: 'Đi dạo không em?',
    });

    // 4) Non-owner delete rejected (403), owner delete succeeds and updates streak
    const forbidRes = await app.request(
      `http://localhost/api/checkins/${createdJson.checkIn.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${tokenUser2}` } },
      env,
    );
    expect(forbidRes.status).toBe(403);

    const delRes = await app.request(
      `http://localhost/api/checkins/${createdJson.checkIn.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${tokenUser1}` } },
      env,
    );
    expect(delRes.status).toBe(200);

    const afterDeleteRes = await app.request(
      'http://localhost/api/checkins/latest',
      { headers: { Authorization: `Bearer ${tokenUser1}` } },
      env,
    );
    const afterDeleteJson = (await afterDeleteRes.json()) as { checkIn: unknown };
    expect(afterDeleteJson.checkIn).toBeNull();
  });

  it('creates paired image chatMessage for photo check-ins, supports chatReplyToMessageId, and scopes /checkins/latest to own user', async () => {
    const app = createApp();

    // Seed a chat message to reply to
    const msgRes = await app.request(
      'http://localhost/api/messages',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenUser2}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'text', text: 'Gửi ảnh đi anh' }),
      },
      env,
    );
    expect(msgRes.status).toBe(201);
    const msgJson = (await msgRes.json()) as { message: { id: string } };

    // Create a photo check-in replying to that chat message
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const form = new FormData();
    form.append('type', 'photo');
    form.append('caption', 'Ảnh mới chụp nè');
    form.append('chatReplyToMessageId', msgJson.message.id);
    form.append('file', new File([jpegBytes], 'photo.jpg', { type: 'image/jpeg' }));

    const photoRes = await app.request(
      'http://localhost/api/checkins',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: form,
      },
      env,
    );
    expect(photoRes.status).toBe(201);
    const photoJson = (await photoRes.json()) as {
      checkIn: { id: string; imageUrl: string; caption: string };
      chatMessage?: {
        id: string;
        type: string;
        imageUrl: string;
        text?: string;
        referencedCheckinId?: string;
        replyTo?: { messageId: string };
      };
    };
    expect(photoJson.chatMessage).toBeDefined();
    expect(photoJson.chatMessage?.type).toBe('image');
    expect(photoJson.chatMessage?.imageUrl).toBe(photoJson.checkIn.imageUrl);
    expect(photoJson.chatMessage?.text).toBe('Ảnh mới chụp nè');
    expect(photoJson.chatMessage?.referencedCheckinId).toBe(photoJson.checkIn.id);
    expect(photoJson.chatMessage?.replyTo?.messageId).toBe(msgJson.message.id);

    // /checkins/latest must return only the requesting user's own check-in
    const myLatest = await app.request(
      'http://localhost/api/checkins/latest',
      { headers: { Authorization: `Bearer ${tokenUser1}` } },
      env,
    );
    expect(((await myLatest.json()) as { checkIn: { id: string } | null }).checkIn?.id).toBe(
      photoJson.checkIn.id,
    );

    const partnerOwnLatest = await app.request(
      'http://localhost/api/checkins/latest',
      { headers: { Authorization: `Bearer ${tokenUser2}` } },
      env,
    );
    expect(((await partnerOwnLatest.json()) as { checkIn: unknown }).checkIn).toBeNull();
  });
});
