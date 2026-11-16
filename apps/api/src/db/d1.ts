import type { CoupleRow, UserRow } from './types';

export async function queryOne<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const row = await bound.first<T>();
  return row ?? null;
}

export async function queryAll<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results ?? [];
}

export async function execute(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return bound.run();
}

export async function findUserById(db: D1Database, userId: string): Promise<UserRow | null> {
  return queryOne<UserRow>(db, 'SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
}

export async function findUserByEmailOrAlias(db: D1Database, email: string): Promise<UserRow | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return queryOne<UserRow>(
    db,
    `SELECT * FROM users
     WHERE lower(email) = ?
        OR EXISTS (SELECT 1 FROM json_each(email_aliases_json) WHERE lower(value) = ?)
     LIMIT 1`,
    [normalized, normalized],
  );
}

export async function findCoupleById(db: D1Database, coupleId: string): Promise<CoupleRow | null> {
  return queryOne<CoupleRow>(db, 'SELECT * FROM couples WHERE id = ? LIMIT 1', [coupleId]);
}

export async function findCoupleMembers(db: D1Database, coupleId: string): Promise<UserRow[]> {
  return queryAll<UserRow>(
    db,
    'SELECT * FROM users WHERE couple_id = ? ORDER BY created_at ASC',
    [coupleId],
  );
}

export async function findPartnerUser(
  db: D1Database,
  coupleId: string | null | undefined,
  currentUserId: string,
): Promise<UserRow | null> {
  if (!coupleId) return null;
  return queryOne<UserRow>(
    db,
    'SELECT * FROM users WHERE couple_id = ? AND id != ? LIMIT 1',
    [coupleId, currentUserId],
  );
}
