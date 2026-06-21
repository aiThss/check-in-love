import { apiFetch } from './client';
import { store } from '../store/index';
import type {
  CheckIn,
  CheckInReply,
  CheckInType,
  MoodType,
  PaginatedResponse,
  Reaction,
  ReactionType,
} from './types';

export interface CreateCheckinResult {
  checkIn: CheckIn;
  streak?: number;
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
    ownerName: item.ownerName,
    isOwn: currentUserId ? userId === currentUserId : false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function getLatestPartnerCheckin(): Promise<CheckIn | null> {
  try {
    const res = await apiFetch<{ checkIn: RawCheckIn | null }>('/checkins/latest-partner');
    return res && res.checkIn ? mapCheckin(res.checkIn) : null;
  } catch {
    return null;
  }
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
): Promise<PaginatedResponse<CheckIn>> {
  const res = await apiFetch<{ checkIns: RawCheckIn[]; pagination: PaginationInfo }>(
    '/checkins?page=' + page + '&limit=' + limit,
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
}

export async function createCheckin(
  body: FormData | Record<string, unknown>,
): Promise<CreateCheckinResult> {
  const res = await apiFetch<{ checkIn: RawCheckIn; streak?: number }>('/checkins', {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  return {
    checkIn: mapCheckin(res.checkIn),
    streak: typeof res.streak === 'number' ? res.streak : undefined,
  };
}

export async function addReaction(
  checkinId: string,
  type: ReactionType,
): Promise<Reaction[]> {
  const res = await apiFetch<{ reactions: RawReaction[] }>(`/checkins/${checkinId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });

  return mapReactionList(res.reactions || []);
}

export async function addReply(
  checkinId: string,
  message: string,
): Promise<CheckInReply[]> {
  const res = await apiFetch<{ replies: RawReply[] }>(`/checkins/${checkinId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });

  return mapReplies(res.replies || []);
}

export function deleteCheckin(checkinId: string): Promise<void> {
  return apiFetch<void>(`/checkins/${checkinId}`, {
    method: 'DELETE',
  });
}
