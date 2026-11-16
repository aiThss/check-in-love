import { Hono } from 'hono';
import { queryOne } from '../db/d1';
import type { HonoAppEnv } from '../types/hono';

export const healthRoutes = new Hono<HonoAppEnv>();

healthRoutes.get('/health', async (c) => {
  let dbOk = true;
  if (c.env?.DB) {
    try {
      await queryOne<{ ok: number }>(c.env.DB, 'SELECT 1 AS ok');
    } catch {
      dbOk = false;
    }
  }

  return c.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'd1-sqlite' : 'error',
      runtime: 'cloudflare-workers',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
    },
    dbOk ? 200 : 503,
  );
});
