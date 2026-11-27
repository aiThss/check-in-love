import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { WorkerEnv } from '../config/env';
import { createTestD1Database, MemoryR2Bucket } from '../db/sqlite-test-d1';
import { getCalendarDate, toDateKey } from '../services/occasion-schedule';
import { signJwt } from '../utils/crypto';

describe('Two-way secret occasion cards & birthday cross-sync', () => {
  const secret = 'test-jwt-secret-key-min-32-chars!!';
  let db: D1Database;
  let env: WorkerEnv;
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    db = createTestD1Database();
    env = {
      DB: db,
      STORAGE: new MemoryR2Bucket() as unknown as R2Bucket,
      NODE_ENV: 'test',
      JWT_SECRET: secret,
    } as unknown as WorkerEnv;

    const now = '2026-01-10T00:00:00.000Z';
    await db
      .prepare('INSERT INTO couples (id, code, love_start_date, streak, created_at, updated_at) VALUES (?, ?, ?, 5, ?, ?)')
      .bind('couple_cards', 'LOVE99', '2025-01-10T00:00:00.000Z', now, now)
      .run();

    await db
      .prepare(
        `INSERT INTO users (id, display_name, partner_name, email, role, status, couple_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      )
      .bind('user_a', 'Thái', 'Hà', 'thai@example.com', 'couple_cards', now, now)
      .run();

    await db
      .prepare(
        `INSERT INTO users (id, display_name, partner_name, email, role, status, couple_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      )
      .bind('user_b', 'Hà', 'Thái', 'ha@example.com', 'couple_cards', now, now)
      .run();

    tokenA = await signJwt({ userId: 'user_a', coupleId: 'couple_cards', role: 'user' }, secret);
    tokenB = await signJwt({ userId: 'user_b', coupleId: 'couple_cards', role: 'user' }, secret);
  });

  it('cross-syncs birthday and partnerBirthday onto partner when partner fields are empty', async () => {
    const app = createApp();

    const patchRes = await app.request(
      'http://localhost/api/me',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          birthday: '2002-05-10',
          partnerBirthday: '2003-08-15',
        }),
      },
      env,
    );
    expect(patchRes.status).toBe(200);

    const meBRes = await app.request(
      'http://localhost/api/me',
      {
        headers: { Authorization: `Bearer ${tokenB}` },
      },
      env,
    );
    expect(meBRes.status).toBe(200);
    const meB = (await meBRes.json()) as {
      user: { birthday?: string | null; partnerBirthday?: string | null };
    };
    expect(meB.user.birthday).toContain('2003-08-15');
    expect(meB.user.partnerBirthday).toContain('2002-05-10');
  });

  it('never leaks future partner-authored secret cards before the occasion date', async () => {
    const app = createApp();

    const putRes = await app.request(
      'http://localhost/api/occasion-cards/custom-future-surprise',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'custom',
          enabled: true,
          scheduleType: 'once',
          customDate: '2099-12-31',
          occasionLabel: 'Ngày bí mật',
          title: 'Bí mật tuyệt đối',
          message: 'Không được lộ nội dung trước giờ G',
          signature: 'Yêu em, Thái',
          pattern: 'hearts',
          colors: ['#ff8fb1', '#ff4d88', '#8a2148'],
        }),
      },
      env,
    );
    expect(putRes.status).toBe(200);

    // Partner checks dashboard -> must NOT see user_a's secret card or text
    const dashBRes = await app.request(
      'http://localhost/api/occasion-cards',
      { headers: { Authorization: `Bearer ${tokenB}` } },
      env,
    );
    expect(dashBRes.status).toBe(200);
    const rawBody = await dashBRes.text();
    expect(rawBody).not.toContain('Bí mật tuyệt đối');
    expect(rawBody).not.toContain('Không được lộ nội dung trước giờ G');
    const dashB = JSON.parse(rawBody) as {
      authoredCards: unknown[];
      receivedAlbum: unknown[];
    };
    expect(dashB.authoredCards).toHaveLength(0);
    expect(dashB.receivedAlbum).toHaveLength(0);

    // Author CAN see their own authored card
    const dashARes = await app.request(
      'http://localhost/api/occasion-cards',
      { headers: { Authorization: `Bearer ${tokenA}` } },
      env,
    );
    const dashA = (await dashARes.json()) as {
      authoredCards: Array<{ occasionKey: string; title?: string }>;
    };
    expect(dashA.authoredCards).toHaveLength(1);
    expect(dashA.authoredCards[0].occasionKey).toBe('custom-future-surprise');
    expect(dashA.authoredCards[0].title).toBe('Bí mật tuyệt đối');
  });

  it('unlocks partner card on the exact Vietnam date and persists to receivedAlbum only after reveal', async () => {
    const app = createApp();
    const todayKey = toDateKey(getCalendarDate(new Date()));

    const putRes = await app.request(
      'http://localhost/api/occasion-cards/custom-today-gift',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'custom',
          enabled: true,
          scheduleType: 'once',
          customDate: todayKey,
          occasionLabel: 'Quà hôm nay',
          title: 'Bất ngờ đúng ngày',
          message: 'Chúc em một ngày ngập tràn niềm vui!',
          signature: 'Thương em — Thái',
          coverText: 'Cào lớp nhũ này nha',
          scratchCoverUrl: 'https://cdn.example.com/foil-cover.jpg',
          backgroundImageUrl: 'https://cdn.example.com/inner-bg.jpg',
        }),
      },
      env,
    );
    expect(putRes.status).toBe(200);

    const todayRes = await app.request(
      'http://localhost/api/occasion-cards/today',
      { headers: { Authorization: `Bearer ${tokenB}` } },
      env,
    );
    expect(todayRes.status).toBe(200);
    const todayJson = (await todayRes.json()) as {
      dateKey: string;
      alreadyRevealed: boolean;
      card: {
        occasionKey: string;
        title: string;
        scratchCoverUrl?: string;
        backgroundImageUrl?: string;
      } | null;
    };
    expect(todayJson.alreadyRevealed).toBe(false);
    expect(todayJson.card?.occasionKey).toBe('custom-today-gift');
    expect(todayJson.card?.title).toBe('Bất ngờ đúng ngày');
    expect(todayJson.card?.scratchCoverUrl).toBe('https://cdn.example.com/foil-cover.jpg');
    expect(todayJson.card?.backgroundImageUrl).toBe('https://cdn.example.com/inner-bg.jpg');

    // Before scratching, receivedAlbum is still empty
    const beforeAlbumRes = await app.request(
      'http://localhost/api/occasion-cards',
      { headers: { Authorization: `Bearer ${tokenB}` } },
      env,
    );
    const beforeAlbum = (await beforeAlbumRes.json()) as { receivedAlbum: unknown[] };
    expect(beforeAlbum.receivedAlbum).toHaveLength(0);

    // Scratch & reveal
    const revealRes = await app.request(
      'http://localhost/api/occasion-cards/reveal',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenB}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ occasionKey: 'custom-today-gift' }),
      },
      env,
    );
    expect(revealRes.status).toBe(201);

    // After scratching, receivedAlbum stores the permanent keepsake snapshot and /today marks alreadyRevealed
    const afterAlbumRes = await app.request(
      'http://localhost/api/occasion-cards',
      { headers: { Authorization: `Bearer ${tokenB}` } },
      env,
    );
    const afterAlbum = (await afterAlbumRes.json()) as {
      receivedAlbum: Array<{ occasionKey: string; card: { title: string } }>;
    };
    expect(afterAlbum.receivedAlbum).toHaveLength(1);
    expect(afterAlbum.receivedAlbum[0].occasionKey).toBe('custom-today-gift');
    expect(afterAlbum.receivedAlbum[0].card.title).toBe('Bất ngờ đúng ngày');

    const todayAfterRes = await app.request(
      'http://localhost/api/occasion-cards/today',
      { headers: { Authorization: `Bearer ${tokenB}` } },
      env,
    );
    const todayAfter = (await todayAfterRes.json()) as { alreadyRevealed: boolean };
    expect(todayAfter.alreadyRevealed).toBe(true);
  });
});
