import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { WorkerEnv } from '../config/env';
import { createTestD1Database, MemoryR2Bucket } from '../db/sqlite-test-d1';
import { signJwt } from '../utils/crypto';
// @ts-expect-error ESM script without declaration file
import { decryptBackupPayload, encryptBackupPayload, generateD1SeedSql, parseMongoJsonContent } from '../../scripts/migrate-mongo-to-d1.mjs';

describe('migrate-mongo-to-d1 SQL converter', () => {
  it('converts MongoDB Extended JSON collections into valid D1 SQL and preserves legacy auth, media, checkins, and messages', async () => {
    const rawBundle = JSON.stringify({
      couples: [
        {
          _id: { $oid: '673000000000000000000001' },
          code: 'love24',
          loveStartDate: '2024-02-14',
          streak: { $numberInt: '12' },
          lastCheckinDate: '2026-11-15',
          createdAt: { $date: '2026-01-01T00:00:00.000Z' },
          updatedAt: { $date: '2026-11-15T10:00:00.000Z' },
        },
      ],
      users: [
        {
          _id: { $oid: '673000000000000000000011' },
          displayName: "Lan's Account",
          partnerName: 'Minh',
          email: 'lan@example.com',
          emailAliases: ['lan.alt@example.com'],
          passwordHash: '$2a$10$abcdef',
          avatarUrl: '/uploads/avatars/lan.jpg',
          coupleId: { $oid: '673000000000000000000001' },
          role: 'user',
          status: 'active',
          createdAt: { $date: '2026-01-01T00:00:00.000Z' },
          updatedAt: { $date: '2026-11-15T10:00:00.000Z' },
        },
      ],
      couplejourneys: [
        {
          _id: { $oid: '673000000000000000000021' },
          coupleId: { $oid: '673000000000000000000001' },
          places: [{ id: 'p1', name: 'Đà Lạt', latitude: 11.94, longitude: 108.45, status: 'visited' }],
          bucketItems: [{ id: 'b1', title: 'Đi ngắm mây', category: 'travel', completed: true }],
        },
      ],
      checkins: [
        {
          _id: { $oid: '673000000000000000000031' },
          coupleId: { $oid: '673000000000000000000001' },
          ownerId: { $oid: '673000000000000000000011' },
          ownerName: "Lan's Account",
          type: 'photo',
          imageUrl: '/uploads/checkins/2026-11/pic.jpg',
          storagePath: 'checkins/2026-11/pic.jpg',
          caption: 'Chào buổi sáng',
          reactions: [{ userId: '673000000000000000000011', type: '❤️' }],
          replies: [],
          createdAt: { $date: '2026-11-15T08:00:00.000Z' },
          updatedAt: { $date: '2026-11-15T08:00:00.000Z' },
        },
      ],
      chatmessages: [
        {
          _id: { $oid: '673000000000000000000041' },
          coupleId: { $oid: '673000000000000000000001' },
          senderId: { $oid: '673000000000000000000011' },
          senderName: "Lan's Account",
          type: 'text',
          text: 'Nhớ anh quá 💕',
          readBy: [{ $oid: '673000000000000000000011' }],
          createdAt: { $date: '2026-11-15T08:05:00.000Z' },
          updatedAt: { $date: '2026-11-15T08:05:00.000Z' },
        },
      ],
      pushsubscriptions: [],
      randomevents: [],
    });

    const parsed = parseMongoJsonContent(rawBundle);
    const { sql, counts } = generateD1SeedSql(parsed, {
      r2PublicUrl: 'https://pub-55b9353a3b6545fc816821cc3c7dac73.r2.dev',
    });

    expect(counts).toEqual({
      couples: 1,
      users: 1,
      couple_journeys: 1,
      checkins: 1,
      chat_messages: 1,
      push_subscriptions: 0,
      random_events: 0,
    });

    const db = createTestD1Database();
    await db.exec(sql);

    const secret = 'test-jwt-secret-key-min-32-chars!!';
    const env = { DB: db, STORAGE: new MemoryR2Bucket() as unknown as R2Bucket, NODE_ENV: 'test', JWT_SECRET: secret } as unknown as WorkerEnv;
    const token = await signJwt({ userId: '673000000000000000000011', coupleId: '673000000000000000000001', role: 'user' }, secret);

    const app = createApp();
    const meRes = await app.request('http://localhost/api/me', { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(meRes.status).toBe(200);
    await expect(meRes.json()).resolves.toMatchObject({
      user: { displayName: "Lan's Account", avatarUrl: 'https://pub-55b9353a3b6545fc816821cc3c7dac73.r2.dev/avatars/lan.jpg' },
      couple: { code: 'LOVE24', streak: 12 },
    });

    const chkRes = await app.request('http://localhost/api/checkins', { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(chkRes.status).toBe(200);
    const chkJson = (await chkRes.json()) as { checkIns: Array<{ imageUrl: string; caption: string }> };
    expect(chkJson.checkIns[0]).toMatchObject({
      caption: 'Chào buổi sáng',
      imageUrl: 'https://pub-55b9353a3b6545fc816821cc3c7dac73.r2.dev/checkins/2026-11/pic.jpg',
    });

    const msgRes = await app.request('http://localhost/api/messages', { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(msgRes.status).toBe(200);
    const msgJson = (await msgRes.json()) as { messages: Array<{ text: string }> };
    expect(msgJson.messages[0].text).toBe('Nhớ anh quá 💕');
  });

  it('encrypts and decrypts AES-256-GCM compressed backup blobs for zero-SSH transfer via R2', () => {
    const sample = JSON.stringify({ couples: [{ _id: 'c1', code: 'AB12' }], users: [] });
    const encrypted = encryptBackupPayload(sample, 'super-secret-jwt-key');
    expect(encrypted.subarray(0, 6).toString('utf8')).toBe('CILBK1');
    const decrypted = decryptBackupPayload(encrypted, 'super-secret-jwt-key');
    expect(decrypted).toBe(sample);
    expect(() => decryptBackupPayload(encrypted, 'wrong-secret')).toThrow();
  });
});
