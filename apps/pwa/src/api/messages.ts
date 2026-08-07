import { apiFetch } from './client';
import { fetchQuery, invalidateQueries } from './query-cache';
import { invalidateRoutes } from '../route-invalidation';
import { store } from '../store/index';
import {
  isMockPreviewMode,
  loadMockPreviewData,
  saveMockPreviewData,
} from '../dev/mock-data';
import type { ChatMessage, ChatMessageReplyReference, ChatMessageType, ReferencedCheckin } from './types';

export interface RawMessage {
  _id?: string;
  id?: string;
  coupleId?: string;
  senderId?: string;
  senderName: string;
  type: ChatMessageType;
  text?: string;
  imageUrl?: string;
  replyTo?: ChatMessageReplyReference;
  referencedCheckin?: ReferencedCheckin;
  clientMutationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessagePage {
  data: ChatMessage[];
  hasMore: boolean;
  beforeCursor: string | null;
  afterCursor: string | null;
}

export function mapChatMessage(raw: RawMessage): ChatMessage {
  const senderId = String(raw.senderId ?? '');
  return {
    id: String(raw._id ?? raw.id), coupleId: String(raw.coupleId ?? ''), senderId,
    senderName: raw.senderName, type: raw.type, text: raw.text, imageUrl: raw.imageUrl,
    replyTo: raw.replyTo, referencedCheckin: raw.referencedCheckin,
    clientMutationId: raw.clientMutationId,
    isOwn: senderId === store.get().user?.id, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
  };
}

export async function getMessages(options: { limit?: number; before?: string; after?: string; force?: boolean } = {}): Promise<MessagePage> {
  const { limit = 30, before, after, force } = options;
  if (isMockPreviewMode()) {
    const items = loadMockPreviewData().messages
      .slice()
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    return Promise.resolve({
      data: items.slice(Math.max(0, items.length - limit)),
      hasMore: false,
      beforeCursor: before ?? null,
      afterCursor: after ?? null,
    });
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  if (after) params.set('after', after);
  const key = `messages:list:${before ?? ''}:${after ?? ''}:${limit}`;
  return fetchQuery(key, async () => {
    const response = await apiFetch<{ messages: RawMessage[]; pagination: Omit<MessagePage, 'data'> }>(`/messages?${params}`);
    return { data: response.messages.map(mapChatMessage), ...response.pagination };
  }, { force });
}

export async function createMessage(body: FormData | { type: 'text'; text: string; replyToMessageId?: string; referencedCheckinId?: string; clientMutationId: string }): Promise<ChatMessage> {
  if (isMockPreviewMode()) {
    const preview = loadMockPreviewData();
    const payload = body instanceof FormData ? {
      type: String(body.get('type') || 'text') as ChatMessageType,
      text: String(body.get('text') || ''),
      replyToMessageId: String(body.get('replyToMessageId') || '') || undefined,
      referencedCheckinId: String(body.get('referencedCheckinId') || '') || undefined,
      clientMutationId: String(body.get('clientMutationId') || '') || undefined,
    } : body;
    const now = new Date().toISOString();
    const referenced = payload.referencedCheckinId
      ? preview.checkins.find((item) => item.id === payload.referencedCheckinId)
      : undefined;
    const replyTarget = payload.replyToMessageId
      ? preview.messages.find((item) => item.id === payload.replyToMessageId)
      : undefined;
    const message: ChatMessage = {
      id: `mock_message_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      coupleId: preview.couple.id,
      senderId: preview.user.id,
      senderName: preview.user.displayName,
      type: payload.type,
      text: payload.text,
      isOwn: true,
      clientMutationId: payload.clientMutationId,
      replyTo: replyTarget
        ? {
            messageId: replyTarget.id,
            senderId: replyTarget.senderId,
            senderName: replyTarget.senderName,
            type: replyTarget.type,
            textSnippet: replyTarget.text,
            mediaUrl: replyTarget.imageUrl,
          }
        : undefined,
      referencedCheckin: referenced
        ? {
            checkinId: referenced.id,
            ownerId: referenced.userId,
            ownerName: referenced.ownerName,
            type: referenced.type,
            caption: referenced.caption,
            mood: referenced.mood,
            imageUrl: referenced.photoUrl,
            createdAt: referenced.createdAt,
          }
        : undefined,
      createdAt: now,
      updatedAt: now,
    };
    if (referenced) {
      referenced.replies = [
        ...referenced.replies,
        {
          userId: preview.user.id,
          userName: preview.user.displayName,
          message: payload.text,
          isOwn: true,
          createdAt: now,
        },
      ];
      referenced.updatedAt = now;
    }
    preview.messages.push(message);
    saveMockPreviewData(preview);
    return Promise.resolve(message);
  }

  const response = await apiFetch<{ message: RawMessage }>('/messages', {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  invalidateQueries('messages:list:');
  invalidateRoutes('/app/messages');
  return mapChatMessage(response.message);
}

export async function getMessageContext(id: string): Promise<ChatMessage[]> {
  if (isMockPreviewMode()) {
    const preview = loadMockPreviewData();
    const index = preview.messages.findIndex((item) => item.id === id);
    return Promise.resolve(index >= 0 ? preview.messages.slice(Math.max(0, index - 1), index + 2) : []);
  }

  return fetchQuery(`messages:context:${id}`, async () => {
    const response = await apiFetch<{ messages: RawMessage[] }>(`/messages/${id}/context`);
    return response.messages.map(mapChatMessage);
  });
}
