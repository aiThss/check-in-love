import { apiFetch } from './client';
import { fetchQuery, invalidateQueries } from './query-cache';
import { store } from '../store/index';
import type { ChatMessage, ChatMessageReplyReference, ChatMessageType, ReferencedCheckin } from './types';

interface RawMessage {
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

function mapMessage(raw: RawMessage): ChatMessage {
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
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  if (after) params.set('after', after);
  const key = `messages:list:${before ?? ''}:${after ?? ''}:${limit}`;
  return fetchQuery(key, async () => {
    const response = await apiFetch<{ messages: RawMessage[]; pagination: Omit<MessagePage, 'data'> }>(`/messages?${params}`);
    return { data: response.messages.map(mapMessage), ...response.pagination };
  }, { force });
}

export async function createMessage(body: FormData | { type: 'text'; text: string; replyToMessageId?: string; referencedCheckinId?: string; clientMutationId: string }): Promise<ChatMessage> {
  const response = await apiFetch<{ message: RawMessage }>('/messages', { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) });
  invalidateQueries('messages:list:');
  return mapMessage(response.message);
}

export async function getMessageContext(id: string): Promise<ChatMessage[]> {
  return fetchQuery(`messages:context:${id}`, async () => {
    const response = await apiFetch<{ messages: RawMessage[] }>(`/messages/${id}/context`);
    return response.messages.map(mapMessage);
  });
}
