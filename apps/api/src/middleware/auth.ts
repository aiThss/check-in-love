import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../db/models/User';

export interface JwtPayload {
  userId: string;
  coupleId: string;
  role: 'user' | 'admin';
}

// Extend FastifyRequest to carry the authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      coupleId: string;
      role: 'user' | 'admin';
    };
  }
}

function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extractToken(request);

  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const user = await User.findById(payload.userId).lean();
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  if (user.status === 'blocked') {
    return reply
      .status(403)
      .send({ error: 'Tài khoản bị khóa', code: 'USER_BLOCKED' });
  }

  request.user = {
    id: payload.userId,
    coupleId: payload.coupleId,
    role: payload.role,
  };
}

export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractToken(request);
  if (!token) {
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(payload.userId).lean();
    if (user && user.status !== 'blocked') {
      request.user = {
        id: payload.userId,
        coupleId: payload.coupleId,
        role: payload.role,
      };
    }
  } catch {
    // Invalid token is silently ignored for optional auth
  }
}
