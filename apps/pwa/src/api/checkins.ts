import { apiFetch } from './client';
import {
  dedupeMutation,
  fetchQuery,
  getCachedQuery,
  invalidateQueries,
  updateMatchingQueries,
} from './query-cache';
import { mapChatMessage, type RawMessage } from './messages';
import { invalidateRoutes } from '../route-invalidation';
import { store } from '../store/index';
import type {
  CheckIn,
  CheckInReply,
  CheckInType,
  MessageReplyReference,
  MoodType,
  PaginatedResponse,
  Reaction,
  ReactionType,
  ChatMessage,
} from './types';

export interface CreateCheckinResult {
  checkIn: CheckIn;
  streak?: number;
  chatMessage?: ChatMessage;
}

export interface RawReply {
  userId?: string;
  userName?: string;
  message?: string;
  createdAt: string;
}

export interface RawReaction {
  type?: string;
  userId?: string;
}

export interface RawCheckIn {
  _id?: string;
  id?: string;
  ownerId?: string;
  userId?: string;
  coupleId?: string;
  type: CheckInType;
  imageUrl?: string;
  photoUrl?: string;
  caption?: string;
  mood?: MoodType;
  reactions?: RawReaction[];
  replies?: RawReply[];
  replyTo?: {
    messageId?: string;
    senderId?: string;
    senderName?: string;
    type?: CheckInType;
    textSnippet?: string;
    mediaUrl?: string;
  };
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

const legacyReactionMap: Record<string, string> = {
  heart: '❤️',
  hug: '🤗',
  kiss: '😘',
  laugh: '😂',
  miss: '🥺',
  wow: '🥰',
  fire: '🔥',
  sad: '😭',
};

function normalizeReactionType(type: string): string {
  const trimmed = type.trim();
  return legacyReactionMap[trimmed] ?? trimmed;
}

function mapReplies(rawReplies: RawReply[] = []): CheckInReply[] {
  const currentUserId = store.get().user?.id;

  return rawReplies.map((reply) => {
    const userId = String(reply.userId ?? '');
    return {
      userId,
      userName: reply.userName ?? 'Người ấy',
      message: reply.message ?? '',
      isOwn: currentUserId ? userId === currentUserId : false,
      createdAt: reply.createdAt,
    };
  });
}

function mapReactionList(rawReactions: RawReaction[] = []): Reaction[] {
  const currentUserId = store.get().user?.id;
  const reactionGroups: Record<string, { count: number; reactedByMe: boolean }> = {};

  rawReactions.forEach((rx) => {
    const type = normalizeReactionType(String(rx.type ?? ''));
    if (!type) return;

    if (!reactionGroups[type]) {
      reactionGroups[type] = { count: 0, reactedByMe: false };
    }

    reactionGroups[type].count++;
    if (currentUserId && String(rx.userId) === currentUserId) {
      reactionGroups[type].reactedByMe = true;
    }
  });

  return Object.entries(reactionGroups)
    .map(([type, value]) => ({
      type,
      count: value.count,
      reactedByMe: value.reactedByMe,
    }));
}

function mapReplyReference(raw?: RawCheckIn['replyTo']): MessageReplyReference | undefined {
  if (!raw?.messageId || !raw.senderId || !raw.senderName || !raw.type) return undefined;
  return {
    messageId: String(raw.messageId),
    senderId: String(raw.senderId),
    senderName: raw.senderName,
    type: raw.type,
    textSnippet: raw.textSnippet,
    mediaUrl: raw.mediaUrl,
  };
}

// Map raw backend check-in format to aligned PWA types
function mapCheckin(item: RawCheckIn): CheckIn {
  if (!item) return null as unknown as CheckIn;

  const currentUserId = store.get().user?.id;
  const userId = String(item.ownerId || item.userId || '');

  return {
    id: String(item._id || item.id),
    userId,
    coupleId: String(item.coupleId ?? ''),
    type: item.type,
    photoUrl: item.imageUrl || item.photoUrl,
    caption: item.caption,
    mood: item.mood,
    reactions: mapReactionList(item.reactions || []),
    replies: mapReplies(item.replies || []),
    replyTo: mapReplyReference(item.replyTo),
    ownerName: item.ownerName,
    isOwn: currentUserId ? userId === currentUserId : false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function getCachedLatestPartnerCheckin(): CheckIn | null {
  return getCachedQuery<CheckIn | null>('checkins:latest-partner') ?? null;
}

export async function getLatestPartnerCheckin(options: { force?: boolean } = {}): Promise<CheckIn | null> {
  return fetchQuery(
    'checkins:latest-partner',
    async () => {
      const res = await apiFetch<{ checkIn: RawCheckIn | null }>('/checkins/latest-partner');
      return res?.checkIn ? mapCheckin(res.checkIn) : null;
    },
    { staleTime: 30_000, force: options.force },
  );
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getCheckins(
  page: number = 1,
  limit: number = 20,
  after?: string,
  type?: string,
  options: { force?: boolean } = {},
): Promise<PaginatedResponse<CheckIn>> {
  const key = `checkins:list:${page}:${limit}:${after ?? ''}:${type ?? ''}`;
  return fetchQuery(key, async () => {
    const afterQuery = after ? '&after=' + encodeURIComponent(after) : '';
    const typeQuery = type ? '&type=' + encodeURIComponent(type) : '';
    const res = await apiFetch<{ checkIns: RawCheckIn[]; pagination: PaginationInfo }>(
      '/checkins?page=' + page + '&limit=' + limit + afterQuery + typeQuery,
    );

    const data = (res.checkIns || []).map(mapCheckin);
    const total = res.pagination?.total ?? data.length;
    const totalPages = res.pagination?.totalPages ?? 1;
    const hasMore = page < totalPages;

    return {
      data,
      total,
      page,
      limit,
      hasMore,
    };
  }, { force: options.force });
}

export async function createCheckin(
  body: FormData | Record<string, unknown>,
): Promise<CreateCheckinResult> {
  const res = await apiFetch<{ checkIn: RawCheckIn; streak?: number; chatMessage?: RawMessage }>('/checkins', {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

  // A photo check-in is represented in Home, Memories, and Messages. Invalidate all
  // related caches and cached route DOM so the next tab activation cannot show stale data.
  invalidateQueries('checkins:');
  invalidateQueries('messages:list:');
  invalidateRoutes(['/app/home', '/app/memories', '/app/messages']);

  return {
    checkIn: mapCheckin(res.checkIn),
    streak: typeof res.streak === 'number' ? res.streak : undefined,
    chatMessage: res.chatMessage ? mapChatMessage(res.chatMessage) : undefined,
  };
}

export async function addReaction(
  checkinId: string,
  type: ReactionType,
): Promise<Reaction[]> {
  return dedupeMutation(`reaction:${checkinId}:${type}`, async () => {
    const res = await apiFetch<{ reactions: RawReaction[] }>(`/checkins/${checkinId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
    const reactions = mapReactionList(res.reactions || []);
    patchCheckinInCachedQueries(checkinId, (checkin) => ({ ...checkin, reactions }));
    invalidateRoutes(['/app/home', '/app/memories', '/app/messages']);
    return reactions;
  });
}

export async function addReply(
  checkinId: string,
  message: string,
): Promise<CheckInReply[]> {
  return dedupeMutation(`reply:${checkinId}:${message}`, async () => {
    const res = await apiFetch<{ replies: RawReply[] }>(`/checkins/${checkinId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    const replies = mapReplies(res.replies || []);
    patchCheckinInCachedQueries(checkinId, (checkin) => ({ ...checkin, replies }));

    // The Messages API lazily bridges legacy CheckIn replies into ChatMessage rows.
    invalidateQueries('messages:list:');
    invalidateRoutes(['/app/home', '/app/memories', '/app/messages']);
    return replies;
  });
}

export async function deleteCheckin(checkinId: string): Promise<void> {
  await apiFetch<void>(`/checkins/${checkinId}`, {
    method: 'DELETE',
  });
  invalidateQueries('checkins:');
  invalidateQueries('messages:list:');
  invalidateRoutes(['/app/home', '/app/memories', '/app/messages']);
}

function patchCheckinInCachedQueries(
  checkinId: string,
  patch: (checkin: CheckIn) => CheckIn,
): void {
  updateMatchingQueries('checkins:', (current) => {
    if (!current) return current;
    if (isCheckIn(current)) return current.id === checkinId ? patch(current) : current;
    if (isPaginatedCheckins(current)) {
      return { ...current, data: current.data.map((item) => item.id === checkinId ? patch(item) : item) };
    }
    return current;
  });
}

function isCheckIn(value: unknown): value is CheckIn {
  return typeof value === 'object' && value !== null && 'id' in value && 'reactions' in value;
}

function isPaginatedCheckins(value: unknown): value is PaginatedResponse<CheckIn> {
  return typeof value === 'object' && value !== null && 'data' in value && Array.isArray(value.data);
}
