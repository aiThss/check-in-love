import { apiFetch } from './client';
import { store } from '../store/index';
import type {
  CheckIn,
  CheckInReply,
  PaginatedResponse,
  Reaction,
  ReactionType,
} from './types';

export interface CreateCheckinResult {
  checkIn: CheckIn;
  streak?: number;
}

const reactionAlias: Record<string, ReactionType> = {
  heart: 'heart',
  hug: 'hug',
  kiss: 'kiss',
  laugh: 'laugh',
  miss: 'miss',
  wow: 'wow',
  fire: 'fire',
  sad: 'sad',
};

function normalizeReactionType(type: string): ReactionType | null {
  return reactionAlias[type] ?? null;
}

function mapReplies(rawReplies: any[] = []): CheckInReply[] {
  const currentUserId = store.get().user?.id;

  return rawReplies.map((reply) => {
    const userId = String(reply.userId ?? '');
    return {
      userId,
      userName: reply.userName ?? 'Nguoi ay',
      message: reply.message ?? '',
      isOwn: currentUserId ? userId === currentUserId : false,
      createdAt: reply.createdAt,
    };
  });
}

function mapReactionList(rawReactions: any[] = []): Reaction[] {
  const currentUserId = store.get().user?.id;
  const reactionGroups: Record<ReactionType, { count: number; reactedByMe: boolean }> = {
    heart: { count: 0, reactedByMe: false },
    hug: { count: 0, reactedByMe: false },
    kiss: { count: 0, reactedByMe: false },
    laugh: { count: 0, reactedByMe: false },
    miss: { count: 0, reactedByMe: false },
    wow: { count: 0, reactedByMe: false },
    fire: { count: 0, reactedByMe: false },
    sad: { count: 0, reactedByMe: false },
  };

  rawReactions.forEach((rx: any) => {
    const type = normalizeReactionType(String(rx.type ?? ''));
    if (!type) return;

    reactionGroups[type].count++;
    if (currentUserId && String(rx.userId) === currentUserId) {
      reactionGroups[type].reactedByMe = true;
    }
  });

  return Object.entries(reactionGroups)
    .filter(([, value]) => value.count > 0 || value.reactedByMe)
    .map(([type, value]) => ({
      type: type as ReactionType,
      count: value.count,
      reactedByMe: value.reactedByMe,
    }));
}

// Map raw backend check-in format to aligned PWA types
function mapCheckin(item: any): CheckIn {
  if (!item) return null as any;

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
    const res = await apiFetch<{ checkIn: any | null }>('/checkins/latest-partner');
    return res && res.checkIn ? mapCheckin(res.checkIn) : null;
  } catch {
    return null;
  }
}

export async function getCheckins(
  page: number = 1,
  limit: number = 20,
): Promise<PaginatedResponse<CheckIn>> {
  const res = await apiFetch<{ checkIns: any[]; pagination: any }>(
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
  body: FormData | Record<string, any>,
): Promise<CreateCheckinResult> {
  const res = await apiFetch<any>('/checkins', {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  return {
    checkIn: mapCheckin(res.checkIn || res),
    streak: typeof res.streak === 'number' ? res.streak : undefined,
  };
}

export async function addReaction(
  checkinId: string,
  type: ReactionType,
): Promise<Reaction[]> {
  const res = await apiFetch<{ reactions: any[] }>(`/checkins/${checkinId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });

  return mapReactionList(res.reactions || []);
}

export async function addReply(
  checkinId: string,
  message: string,
): Promise<CheckInReply[]> {
  const res = await apiFetch<{ replies: any[] }>(`/checkins/${checkinId}/replies`, {
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
