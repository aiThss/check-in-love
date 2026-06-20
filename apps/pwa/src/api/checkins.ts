import { apiFetch } from './client';
import { store } from '../store/index';
import type { CheckIn, PaginatedResponse, Reaction, ReactionType } from './types';

export interface CreateCheckinResult {
  checkIn: CheckIn;
  streak?: number;
}

// Map raw backend check-in format to aligned PWA types
function mapCheckin(item: any): CheckIn {
  if (!item) return null as any;
  
  const currentUserId = store.get().user?.id;
  
  // Aggregate reactions: Group raw reactions by emoji/type
  const rawReactions = item.reactions || [];
  const reactionGroups: Record<string, { count: number; reactedByMe: boolean }> = {};
  
  rawReactions.forEach((rx: any) => {
    const type = rx.type;
    const emojiMap: Record<string, string> = {
      heart: '❤️',
      hug: '🤗',
      kiss: '💋',
      laugh: '😂',
      miss: '🥺',
      '❤️': '❤️',
      '🤗': '🤗',
      '💋': '💋',
      '😂': '😂',
      '🥺': '🥺'
    };
    
    const emoji = emojiMap[type] || type;
    
    if (!reactionGroups[emoji]) {
      reactionGroups[emoji] = { count: 0, reactedByMe: false };
    }
    
    reactionGroups[emoji].count++;
    if (currentUserId && rx.userId === currentUserId) {
      reactionGroups[emoji].reactedByMe = true;
    }
  });
  
  const reactionsList: Reaction[] = Object.keys(reactionGroups).map(type => ({
    type: type as ReactionType,
    count: reactionGroups[type].count,
    reactedByMe: reactionGroups[type].reactedByMe
  }));

  return {
    id: item._id || item.id,
    userId: item.ownerId || item.userId,
    coupleId: item.coupleId,
    type: item.type,
    photoUrl: item.imageUrl || item.photoUrl,
    caption: item.caption,
    mood: item.mood,
    reactions: reactionsList,
    ownerName: item.ownerName,
    isOwn: currentUserId ? (item.ownerId || item.userId) === currentUserId : false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
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
  const res = await apiFetch<{ checkIns: any[]; pagination: any }>('/checkins?page=' + page + '&limit=' + limit);
  
  const data = (res.checkIns || []).map(mapCheckin);
  const total = res.pagination?.total ?? data.length;
  const totalPages = res.pagination?.totalPages ?? 1;
  const hasMore = page < totalPages;
  
  return {
    data,
    total,
    page,
    limit,
    hasMore
  };
}

export async function createCheckin(body: FormData | Record<string, any>): Promise<CreateCheckinResult> {
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
  const nameMap: Record<string, string> = {
    '❤️': 'heart',
    '🤗': 'hug',
    '💋': 'kiss',
    '😂': 'laugh',
    '🥺': 'miss'
  };
  const backendType = nameMap[type] || type;

  const res = await apiFetch<{ reactions: any[] }>(`/checkins/${checkinId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ type: backendType }),
  });
  
  const currentUserId = store.get().user?.id;
  const reactionGroups: Record<string, { count: number; reactedByMe: boolean }> = {};
  
  const rawReactions = res.reactions || [];
  rawReactions.forEach((rx: any) => {
    const emojiMap: Record<string, string> = {
      heart: '❤️',
      hug: '🤗',
      kiss: '💋',
      laugh: '😂',
      miss: '🥺',
      '❤️': '❤️',
      '🤗': '🤗',
      '💋': '💋',
      '😂': '😂',
      '🥺': '🥺'
    };
    
    const emoji = emojiMap[rx.type] || rx.type;
    
    if (!reactionGroups[emoji]) {
      reactionGroups[emoji] = { count: 0, reactedByMe: false };
    }
    
    reactionGroups[emoji].count++;
    if (currentUserId && rx.userId === currentUserId) {
      reactionGroups[emoji].reactedByMe = true;
    }
  });

  return Object.keys(reactionGroups).map(t => ({
    type: t as ReactionType,
    count: reactionGroups[t].count,
    reactedByMe: reactionGroups[t].reactedByMe
  }));
}

export function deleteCheckin(checkinId: string): Promise<void> {
  return apiFetch<void>(`/checkins/${checkinId}`, {
    method: 'DELETE',
  });
}
