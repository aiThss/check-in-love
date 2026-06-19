// Shared types used across API modules

export type ReactionType = '❤️' | '🤗' | '💋' | '😂' | '🥺';

export type MoodType =
  | 'happy'
  | 'love'
  | 'sad'
  | 'excited'
  | 'tired'
  | 'calm'
  | 'miss';

export type CheckInType = 'photo' | 'text' | 'mood';

export interface User {
  id: string;
  deviceId: string;
  displayName: string;
  partnerName: string;
  avatarUrl?: string;
  partnerAvatarUrl?: string;
  email?: string;
  coupleId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Couple {
  id: string;
  coupleCode: string;
  loveStartDate?: string;
  streak: number;
  totalDays: number;
  createdAt: string;
}

export interface Reaction {
  type: ReactionType;
  count: number;
  reactedByMe: boolean;
}

export interface CheckIn {
  id: string;
  userId: string;
  coupleId: string;
  type: CheckInType;
  photoUrl?: string;
  caption?: string;
  mood?: MoodType;
  reactions: Reaction[];
  ownerName: string;
  ownerAvatarUrl?: string;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RandomCategory {
  category: string;
  icon: string;
  label: string;
  description: string;
  usageCount: number;
}

export interface RandomItem {
  category: string;
  prompt: string;
  detail: string | null;
  event?: {
    id: string;
    coupleId: string;
    userId: string;
    category: string;
    prompt: string;
    detail?: string;
    createdAt: string;
  };
}

export interface RandomHistoryItem {
  _id: string;
  coupleId: string;
  userId: string;
  category: string;
  prompt: string;
  detail?: string;
  createdAt: string;
}
