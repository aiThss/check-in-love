import type { MiddlewareHandler } from 'hono';
import { findUserById } from '../db/d1';
import type { HonoAppEnv } from '../types/hono';
import { verifyJwt } from '../utils/crypto';
import { AppError } from '../utils/errors';

interface UserTokenPayload {
  userId?: string;
  id?: string;
  sub?: string;
  coupleId?: string | null;
  role?: 'user' | 'admin';
  [key: string]: unknown;
}

export const authenticate: MiddlewareHandler<HonoAppEnv> = async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Phiên đăng nhập không hợp lệ', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7).trim();
  const config = c.get('config');
  const payload = await verifyJwt<UserTokenPayload>(token, config.JWT_SECRET);
  const userId = payload?.userId ?? payload?.id ?? (payload?.role !== 'admin' ? payload?.sub : undefined);

  if (!payload || !userId || payload.role === 'admin') {
    throw new AppError('Token hết hạn hoặc không hợp lệ', 401, 'UNAUTHORIZED');
  }

  const userRow = await findUserById(c.env.DB, String(userId));
  if (!userRow) {
    throw new AppError('Tài khoản không tồn tại', 401, 'UNAUTHORIZED');
  }
  if (userRow.status === 'blocked') {
    throw new AppError('Tài khoản đã bị khóa bởi quản trị viên', 403, 'USER_BLOCKED');
  }

  c.set('user', {
    id: userRow.id,
    coupleId: userRow.couple_id,
    role: userRow.role,
  });

  await next();
};

export const authenticateAdmin: MiddlewareHandler<HonoAppEnv> = async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Chưa đăng nhập quản trị viên', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7).trim();
  const config = c.get('config');
  const payload = await verifyJwt<{ role?: string; sub?: string; email?: string }>(token, config.JWT_SECRET);
  if (!payload || payload.role !== 'admin' || payload.sub !== 'admin') {
    throw new AppError('Không có quyền truy cập quản trị', 403, 'FORBIDDEN');
  }

  c.set('admin', {
    email: payload.email || config.ADMIN_EMAIL,
    role: 'admin',
  });

  await next();
};
