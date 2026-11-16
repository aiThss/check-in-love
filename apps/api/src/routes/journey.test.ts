import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { WorkerEnv } from '../config/env';
import { createTestD1Database, MemoryR2Bucket } from '../db/sqlite-test-d1';
import { signJwt } from '../utils/crypto';
import { buildNotification } from './journey';

describe('Couple Journey SQL routes', () => {
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
      .bind('couple_j', 'MAP123', now, now)
      .run();
    await db
      .prepare(
        `INSERT INTO users (id, display_name, partner_name, email, role, status, couple_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      )
      .bind('user_d', 'Dương', 'Linh', 'duong@example.com', 'couple_j', now, now)
      .run();

    token = await signJwt({ userId: 'user_d', coupleId: 'couple_j', role: 'user' }, secret);
  });

  describe('buildNotification helper', () => {
    it('generates friendly notifications for adding or completing wishes', () => {
      expect(buildNotification('Dương', 'add_bucket', 'Đi Đà Lạt')).toEqual({
        title: 'Điều ước mới trong Hành Trình 💕',
        body: 'Dương vừa thêm một điều ước mới: "Đi Đà Lạt"',
      });
      expect(buildNotification('Dương', 'complete_bucket', 'Nấu ăn cùng nhau')).toEqual({
        title: 'Hoàn thành một điều ước! 🎉',
        body: 'Dương vừa đánh dấu đã thực hiện: "Nấu ăn cùng nhau"',
      });
    });

    it('generates friendly notifications for adding or visiting places', () => {
      expect(buildNotification('Dương', 'add_place', 'Phú Quốc')).toEqual({
        title: 'Địa điểm mới trên bản đồ tình yêu 📍',
        body: 'Dương vừa ghim một địa điểm mới: "Phú Quốc"',
      });
      expect(buildNotification('Dương', 'visit_place', 'Hội An')).toEqual({
        title: 'Thêm dấu chân kỷ niệm! ✈️',
        body: 'Dương vừa check-in đã đến: "Hội An"',
      });
    });
  });

  it('persists and merges places and bucket items across PUT and POST /journey/sync', async () => {
    const app = createApp();

    const putRes = await app.request(
      'http://localhost/api/journey',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          places: [{ id: 'p1', name: 'Đà Lạt', latitude: 11.94, longitude: 108.45, status: 'visited' }],
          bucketItems: [{ id: 'b1', title: 'Ngắm bình minh', category: 'travel', completed: false }],
          actionType: 'add_place',
          itemTitle: 'Đà Lạt',
        }),
      },
      env,
    );
    expect(putRes.status).toBe(200);

    const syncRes = await app.request(
      'http://localhost/api/journey/sync',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localPlaces: [{ id: 'p2', name: 'Phú Quốc', latitude: 10.22, longitude: 103.95, status: 'wishlist' }],
          localBucketItems: [],
        }),
      },
      env,
    );
    expect(syncRes.status).toBe(200);
    const syncJson = (await syncRes.json()) as { places: Array<{ id: string }>; bucketItems: Array<{ id: string }> };
    expect(syncJson.places).toHaveLength(2);
    expect(syncJson.bucketItems).toHaveLength(1);
  });
});
