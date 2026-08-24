import { store } from '../store';
import { logger } from '../utils/logger';
import type { ChatBackgroundSnapshot } from './types';

export interface RealtimeEventData {
  type:
    | 'message'
    | 'message.updated'
    | 'message.reaction'
    | 'message.read'
    | 'message.typing'
    | 'message.presence'
    | 'chat.background.updated'
    | 'checkin'
    | 'reaction'
    | 'reply'
    | 'reminder'
    | 'connected';
  title?: string;
  body?: string;
  targetUrl?: string;
  photoUrl?: string;
  senderName?: string;
  senderAvatar?: string;
  messageId?: string;
  deleted?: boolean;
  chatBackground?: ChatBackgroundSnapshot;
  timestamp?: number;
}

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function initRealtimeEvents(): void {
  const connect = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    const token = store.getToken() || localStorage.getItem('lovecheck_token');
    if (!token) return;

    try {
      const url = `/api/events?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RealtimeEventData;
          if (data.type === 'connected') {
            logger.info('[SSE] Connected to real-time events stream');
            return;
          }

          logger.info('[SSE] Real-time event received', data);

          // 1. Dispatch custom event for in-app UI listeners
          window.dispatchEvent(
            new CustomEvent('lovecheck:realtime-event', { detail: data }),
          );

          // 2. Trigger native Android notification if running inside APK
          if (data.title && data.body) {
            window.LoveCheckAndroid?.showLocalNotification?.(
              data.title,
              data.body,
              data.targetUrl || '/app/home',
              data.photoUrl || null,
              data.senderAvatar || null,
              data.messageId || null,
            );
          }
        } catch (err) {
          logger.warn('[SSE] Failed to parse event data', err);
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 5000);
        }
      };
    } catch (err) {
      logger.warn('[SSE] Connection error', err);
    }
  };

  connect();

  store.subscribe((state, prev) => {
    if (state.token !== prev.token) {
      connect();
    }
  });
}
