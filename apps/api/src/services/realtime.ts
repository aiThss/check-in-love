import type { WorkerEnv } from '../config/env';

export interface RealtimeEventPayload {
  type: string;
  checkinId?: string;
  messageId?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  title?: string;
  body?: string;
  photoUrl?: string;
  targetUrl?: string;
  url?: string;
  deleted?: boolean;
  reactionType?: string;
  createdAt?: string;
  partnerAvatarUrl?: string;
  isTyping?: boolean;
  online?: boolean;
  chatBackground?: Record<string, unknown>;
  journey?: {
    places: unknown[];
    bucketItems: unknown[];
  };
  journeyUpdated?: boolean;
  timestamp?: number;
  [key: string]: unknown;
}

export async function emitRealtimeEvent(
  env: Partial<WorkerEnv> | undefined,
  userId: string,
  event: RealtimeEventPayload,
): Promise<void> {
  if (!env?.REALTIME_HUB || !userId) return;
  try {
    const resolvedTargetUrl = event.targetUrl ?? event.url;
    const normalized: RealtimeEventPayload = {
      ...event,
      ...(resolvedTargetUrl ? { targetUrl: resolvedTargetUrl, url: resolvedTargetUrl } : {}),
      timestamp: event.timestamp ?? Date.now(),
    };
    const id = env.REALTIME_HUB.idFromName(userId);
    const stub = env.REALTIME_HUB.get(id);
    await stub.fetch('https://realtime/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
  } catch {
    // Non-fatal real-time emit error
  }
}
