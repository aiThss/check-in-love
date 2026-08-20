import { apiFetch } from './client';
import { fetchQuery, invalidateQueries } from './query-cache';
import { invalidateRoutes } from '../route-invalidation';
import { store } from '../store/index';
import {
  isMockPreviewMode,
  loadMockPreviewData,
  saveMockPreviewData,
} from '../dev/mock-data';
import type { ChatMessage, ChatMessageAttachment, ChatMessageEditHistoryEntry, ChatMessageReaction, ChatMessageReplyReference, ChatMessageType, ReferencedCheckin } from './types';

export interface RawMessage {
  _id?: string;
  id?: string;
  coupleId?: string;
  senderId?: string;
  senderName: string;
  type: ChatMessageType;
  text?: string;
  imageUrl?: string;
  attachments?: ChatMessageAttachment[];
  replyTo?: ChatMessageReplyReference;
  referencedCheckin?: ReferencedCheckin;
  reactions?: Array<{ type: string; userIds?: string[] }>;
  readBy?: string[];
  editedAt?: string;
  editHistory?: ChatMessageEditHistoryEntry[];
  deletedAt?: string;
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
  const currentUserId = store.get().user?.id;
  const imageUrl = raw.imageUrl ?? raw.attachments?.[0]?.url;
  return {
    id: String(raw._id ?? raw.id), coupleId: String(raw.coupleId ?? ''), senderId,
    senderName: raw.senderName, type: raw.type, text: raw.text, imageUrl,
    attachments: raw.attachments,
    replyTo: raw.replyTo, referencedCheckin: raw.referencedCheckin,
    reactions: raw.reactions?.map((reaction): ChatMessageReaction => ({
      type: reaction.type,
      count: reaction.userIds?.length ?? 0,
      reactedByMe: Boolean(currentUserId && reaction.userIds?.includes(currentUserId)),
    })),
    readBy: raw.readBy?.map(String), editedAt: raw.editedAt,
    editHistory: raw.editHistory?.map((entry) => ({ text: entry.text, editedAt: entry.editedAt })),
    deletedAt: raw.deletedAt,
    clientMutationId: raw.clientMutationId,
    isOwn: senderId === store.get().user?.id, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
  };
}

export async function editMessage(id: string, text: string): Promise<ChatMessage> {
  const response = await apiFetch<{ message: RawMessage }>(`/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ text }),
  });
  invalidateQueries('messages:list:');
  invalidateRoutes('/app/messages');
  return mapChatMessage(response.message);
}

export async function deleteMessage(id: string): Promise<void> {
  await apiFetch(`/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
  invalidateQueries('messages:list:');
  invalidateRoutes('/app/messages');
}

export async function toggleMessageReaction(id: string, type: string): Promise<ChatMessageReaction[]> {
  const response = await apiFetch<{ reactions: Array<{ type: string; userIds?: string[] }> }>(
    `/messages/${encodeURIComponent(id)}/reactions`,
    { method: 'POST', body: JSON.stringify({ type }) },
  );
  const currentUserId = store.get().user?.id;
  return response.reactions.map((reaction) => ({
    type: reaction.type,
    count: reaction.userIds?.length ?? 0,
    reactedByMe: Boolean(currentUserId && reaction.userIds?.includes(currentUserId)),
  }));
}

export async function markMessagesRead(options: { messageIds?: string[]; upTo?: string }): Promise<void> {
  await apiFetch('/messages/read', { method: 'POST', body: JSON.stringify(options) });
}

export async function setMessageTyping(isTyping: boolean): Promise<void> {
  await apiFetch('/messages/typing', { method: 'POST', body: JSON.stringify({ isTyping }) });
}

export async function setMessagePresence(online: boolean): Promise<void> {
  await apiFetch('/messages/presence', { method: 'POST', body: JSON.stringify({ online }) });
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
