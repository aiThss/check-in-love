import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AdminJwtPayload {
  role: 'admin';
  sub: string;
}

// Extend FastifyRequest to include admin info when needed
declare module 'fastify' {
  interface FastifyRequest {
    admin?: {
      role: 'admin';
    };
  }
}

export async function authenticateAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply
      .status(401)
      .send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);

  let payload: AdminJwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;
  } catch {
    return reply
      .status(401)
      .send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  if (payload.role !== 'admin') {
    return reply
      .status(403)
      .send({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  request.admin = { role: 'admin' };
}
