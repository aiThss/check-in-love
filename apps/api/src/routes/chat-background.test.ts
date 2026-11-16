import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { WorkerEnv } from '../config/env';
import { createTestD1Database, MemoryR2Bucket } from '../db/sqlite-test-d1';
import { signJwt } from '../utils/crypto';

describe('PATCH /chat-background (SQL)', () => {
  const secret = 'test-jwt-secret-key-min-32-chars!!';
  let db: D1Database;
  let env: WorkerEnv;
  let token: string;

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
      .bind('couple_bg', 'WALL01', now, now)
      .run();
    await db
      .prepare(
        `INSERT INTO users (id, display_name, partner_name, email, role, status, couple_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      )
      .bind('user_ha', 'Thúy Hà', 'Dương', 'ha@example.com', 'couple_bg', now, now)
      .run();

    token = await signJwt({ userId: 'user_ha', coupleId: 'couple_bg', role: 'user' }, secret);
  });

  it('stores the shared preset and persists a compact system event in SQL', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/chat-background',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kind: 'preset', id: 'lavender-stars' }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      background: { kind: string; id: string; label: string };
      message: { text: string; systemEvent: { kind: string; backgroundId: string } };
    };
    expect(json.background).toMatchObject({
      kind: 'preset',
      id: 'lavender-stars',
      label: 'Đồi lavender',
    });
    expect(json.message.text).toBe('Thúy Hà đã đổi chủ đề thành Đồi lavender');
    expect(json.message.systemEvent).toMatchObject({
      kind: 'background_changed',
      backgroundId: 'lavender-stars',
    });

    const getRes = await app.request(
      'http://localhost/api/chat-background',
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(getRes.status).toBe(200);
    await expect(getRes.json()).resolves.toMatchObject({
      background: { id: 'lavender-stars', label: 'Đồi lavender' },
    });
  });
});
