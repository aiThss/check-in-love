import type {
  CheckInType as SharedCheckInType,
  MoodType as SharedMoodType,
  User as SharedUser,
} from '@checkinlove/shared';

export type CheckInType = SharedCheckInType;
export type ReactionType = string;

export type MoodType =
  | SharedMoodType
  | 'love'
  | 'excited'
  | 'calm';

export interface User extends Omit<SharedUser, 'role' | 'status'> {
  deviceId: string;
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

export interface CheckInReply {
  userId: string;
  userName: string;
  message: string;
  isOwn: boolean;
  createdAt: string;
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
  replies: CheckInReply[];
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
