// =============================================================================
// Shared TypeScript types for LoveCheck
// Used by both API and frontend
// =============================================================================

// ─── User ────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'blocked';

export interface User {
  id: string;
  displayName: string;
  partnerName: string;
  email?: string;
  avatarUrl?: string;
  partnerAvatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  coupleId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Couple ──────────────────────────────────────────────────────────────────

export interface Couple {
  id: string;
  code: string;
  loveStartDate?: string; // ISO date string
  memberIds: string[];
  streak: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Check-in ────────────────────────────────────────────────────────────────

export type CheckInType = 'photo' | 'text' | 'mood';

export type MoodType =
  | 'happy'
  | 'miss'
  | 'tired'
  | 'studying'
  | 'out'
  | 'eating'
  | 'needhug';

export type ReactionType = 'heart' | 'hug' | 'kiss' | 'laugh' | 'miss';

export interface Reaction {
  userId: string;
  type: ReactionType;
  createdAt: string;
}

export interface CheckIn {
  id: string;
  coupleId: string;
  ownerId: string;
  ownerName: string;
  type: CheckInType;
  imageUrl?: string;
  caption?: string;
  mood?: MoodType;
  quickMessage?: string;
  reactions: Reaction[];
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Random ──────────────────────────────────────────────────────────────────

export type RandomCategory =
  | 'questions'
  | 'snap'
  | 'today'
  | 'food'
  | 'universe';

export interface RandomEvent {
  id: string;
  coupleId: string;
  userId: string;
  category: RandomCategory;
  prompt: string;
  detail?: string;
  createdAt: string;
}

// ─── Push ────────────────────────────────────────────────────────────────────

export interface PushKeys {
  auth: string;
  p256dh: string;
}

export interface PushSubscriptionData {
  id: string;
  userId: string;
  coupleId: string;
  endpoint: string;
  keys: PushKeys;
  userAgent?: string;
  createdAt: string;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code: string;
}

export interface ApiSuccess<T = unknown> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthStartPayload {
  displayName: string;
  partnerName: string;
  coupleCode: string;
  loveStartDate: string;
  email?: string;
  password?: string;
  deviceId?: string;
}

export interface AuthLoginPayload {
  email?: string;
  password?: string;
  deviceId?: string;
  coupleCode?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  couple: Couple;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminSummary {
  totalUsers: number;
  totalCouples: number;
  totalCheckIns: number;
  blockedUsers: number;
  totalRandomEvents: number;
}

export interface AdminLoginPayload {
  email: string;
  password: string;
}

export interface AdminAuthResponse {
  token: string;
}
