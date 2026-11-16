import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { WorkerEnv } from '../config/env';
import { createTestD1Database, MemoryR2Bucket } from '../db/sqlite-test-d1';

describe('health route', () => {
  it('returns an OK SQL/Workers health response for /health and /api/health', async () => {
    const db = createTestD1Database();
    const env = { DB: db, STORAGE: new MemoryR2Bucket(), NODE_ENV: 'test' } as unknown as WorkerEnv;
    const app = createApp();

    const rootRes = await app.request('http://localhost/health', {}, env);
    expect(rootRes.status).toBe(200);
    await expect(rootRes.json()).resolves.toMatchObject({
      status: 'ok',
      database: 'd1-sqlite',
      runtime: 'cloudflare-workers',
    });

    const apiRes = await app.request('http://localhost/api/health', {}, env);
    expect(apiRes.status).toBe(200);
    await expect(apiRes.json()).resolves.toMatchObject({ status: 'ok' });
  });
});
