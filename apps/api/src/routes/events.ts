import { FastifyInstance, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface RealtimeEvent {
  type: 'message' | 'checkin' | 'reaction' | 'reply' | 'reminder';
  title: string;
  body: string;
  targetUrl?: string;
  photoUrl?: string;
  senderName?: string;
  senderAvatar?: string;
  timestamp?: number;
}

// User ID -> Set of SSE Reply streams
const userConnections = new Map<string, Set<FastifyReply>>();

export function emitRealtimeEvent(userId: string, event: RealtimeEvent): void {
  const replies = userConnections.get(userId);
  if (!replies || replies.size === 0) return;

  const data = JSON.stringify({
    ...event,
    timestamp: event.timestamp || Date.now(),
  });

  const payload = `data: ${data}\n\n`;

  for (const reply of replies) {
    try {
      reply.raw.write(payload);
    } catch {
      replies.delete(reply);
    }
  }
}

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.get('/events', async (request, reply) => {
    // Authenticate via query param ?token= or Authorization header
    const token =
      (request.query as { token?: string })?.token ||
      request.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
      userId = decoded.id;
    } catch {
      return reply.status(401).send({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders?.();

    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(reply);

    // Send connected welcome event
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    // Keep connection alive with heartbeat comment every 20 seconds
    const interval = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(interval);
      }
    }, 20000);

    request.raw.on('close', () => {
      clearInterval(interval);
      const set = userConnections.get(userId);
      if (set) {
        set.delete(reply);
        if (set.size === 0) userConnections.delete(userId);
      }
    });
  });
}
