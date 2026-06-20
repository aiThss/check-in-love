import { get, post, patch, del } from './client';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminSummary {
  totalUsers: number;
  totalCouples: number;
  totalCheckIns: number;
  blockedUsers: number;
  totalRandomEvents: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  coupleCode?: string;
  status: 'active' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface CoupleMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status?: 'active' | 'blocked';
}

export interface Couple {
  id: string;
  code: string;
  members: CoupleMember[];
  loveStartDate?: string;
  streak: number;
  createdAt: string;
  updatedAt: string;
}

export interface CheckIn {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: 'photo' | 'text' | 'mood';
  caption?: string;
  mood?: string;
  imageUrl?: string;
  status: 'active' | 'deleted';
  deletedAt?: string;
  coupleId?: string;
  createdAt: string;
}

export interface RandomEvent {
  id: string;
  category: string;
  prompt: string;
  detail?: string;
  userId: string;
  userName: string;
  coupleId?: string;
  coupleName?: string;
  createdAt: string;
}

export interface ResetResult {
  success: boolean;
  deleted: {
    users: number;
    couples: number;
    checkIns: number;
    randomEvents: number;
    pushSubscriptions: number;
    otpCodes: number;
  };
}

export interface ResetStatus {
  enabled: boolean;
  confirmation: string;
}

type RawPagination = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
};

type RawPaginatedResponse = {
  pagination?: RawPagination;
  users?: unknown[];
  couples?: unknown[];
  checkIns?: unknown[];
  events?: unknown[];
};

/* ─── Normalizers ────────────────────────────────────────────────────────── */

function idOf(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as { _id?: unknown; id?: unknown; toString?: () => string };
    if (obj.id != null) return String(obj.id);
    if (obj._id != null) return String(obj._id);
    if (typeof obj.toString === 'function') return obj.toString();
  }
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : '';
}

function pageOf<T>(
  raw: RawPaginatedResponse,
  key: 'users' | 'couples' | 'checkIns' | 'events',
  mapItem: (item: unknown) => T,
): PaginatedResponse<T> {
  const items = raw[key] ?? [];
  const pagination = raw.pagination ?? {};
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? items.length;
  const total = pagination.total ?? items.length;

  return {
    data: items.map(mapItem),
    total,
    page,
    limit,
    totalPages: pagination.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit))),
  };
}

function normalizeSummary(raw: unknown): AdminSummary {
  const obj = asRecord(raw);
  return {
    totalUsers: Number(obj['totalUsers'] ?? 0),
    totalCouples: Number(obj['totalCouples'] ?? 0),
    totalCheckIns: Number(obj['totalCheckIns'] ?? obj['totalCheckins'] ?? 0),
    blockedUsers: Number(obj['blockedUsers'] ?? 0),
    totalRandomEvents: Number(obj['totalRandomEvents'] ?? 0),
  };
}

function normalizeUser(raw: unknown): User {
  const obj = asRecord(raw);
  const couple = asRecord(obj['coupleId']);

  return {
    id: idOf(obj),
    name: asString(obj['displayName'] ?? obj['name'], 'Ẩn danh'),
    email: asString(obj['email'], 'Chưa có email'),
    avatarUrl: asString(obj['avatarUrl']) || undefined,
    coupleCode: asString(couple['code'] ?? obj['coupleCode']) || undefined,
    status: obj['status'] === 'blocked' ? 'blocked' : 'active',
    createdAt: asDate(obj['createdAt']),
    updatedAt: asDate(obj['updatedAt']),
  };
}

function normalizeMember(raw: unknown): CoupleMember {
  const obj = asRecord(raw);
  return {
    id: idOf(obj),
    name: asString(obj['displayName'] ?? obj['name'], 'Ẩn danh'),
    email: asString(obj['email'], 'Chưa có email'),
    avatarUrl: asString(obj['avatarUrl']) || undefined,
    status: obj['status'] === 'blocked' ? 'blocked' : 'active',
  };
}

function normalizeCouple(raw: unknown): Couple {
  const obj = asRecord(raw);
  const members = Array.isArray(obj['memberIds'])
    ? obj['memberIds']
    : Array.isArray(obj['members'])
      ? obj['members']
      : [];

  return {
    id: idOf(obj),
    code: asString(obj['code'], 'UNKNOWN'),
    members: members.map(normalizeMember),
    loveStartDate: asDate(obj['loveStartDate']) || undefined,
    streak: Number(obj['streak'] ?? 0),
    createdAt: asDate(obj['createdAt']),
    updatedAt: asDate(obj['updatedAt']),
  };
}

function normalizeCheckIn(raw: unknown): CheckIn {
  const obj = asRecord(raw);

  return {
    id: idOf(obj),
    senderId: idOf(obj['ownerId'] ?? obj['senderId']),
    senderName: asString(obj['ownerName'] ?? obj['senderName'], 'Ẩn danh'),
    senderAvatar: asString(obj['senderAvatar'] ?? obj['ownerAvatar']) || undefined,
    type:
      obj['type'] === 'text' || obj['type'] === 'mood' || obj['type'] === 'photo'
        ? obj['type']
        : 'text',
    caption: asString(obj['caption']) || undefined,
    mood: asString(obj['mood']) || undefined,
    imageUrl: asString(obj['imageUrl'] ?? obj['photoUrl']) || undefined,
    status: obj['deletedAt'] ? 'deleted' : 'active',
    deletedAt: asDate(obj['deletedAt']) || undefined,
    coupleId: idOf(obj['coupleId']) || undefined,
    createdAt: asDate(obj['createdAt']),
  };
}

function normalizeRandomEvent(raw: unknown): RandomEvent {
  const obj = asRecord(raw);
  const user = asRecord(obj['userId']);
  const couple = asRecord(obj['coupleId']);

  return {
    id: idOf(obj),
    category: asString(obj['category'], 'unknown'),
    prompt: asString(obj['prompt']),
    detail: asString(obj['detail']) || undefined,
    userId: idOf(obj['userId']),
    userName: asString(user['displayName'] ?? obj['userName'], 'Ẩn danh'),
    coupleId: idOf(obj['coupleId']) || undefined,
    coupleName: asString(couple['code'] ?? obj['coupleName']) || undefined,
    createdAt: asDate(obj['createdAt']),
  };
}

/* ─── Admin API ─────────────────────────────────────────────────────────── */

export const adminApi = {
  /* Auth */
  login(email: string, password: string): Promise<{ token: string }> {
    return post<{ token: string }>('/admin/login', { email, password });
  },

  /* Dashboard summary */
  async getSummary(): Promise<AdminSummary> {
    return normalizeSummary(await get<unknown>('/admin/summary'));
  },

  /* Users */
  async getUsers(page: number, search?: string): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search && search.trim()) {
      params.set('search', search.trim());
    }
    const raw = await get<RawPaginatedResponse>(`/admin/users?${params.toString()}`);
    return pageOf(raw, 'users', normalizeUser);
  },

  async updateUser(id: string, data: { status?: string }): Promise<User> {
    const raw = await patch<{ user: unknown }>(`/admin/users/${id}`, data);
    return normalizeUser(raw.user);
  },

  deleteUser(id: string): Promise<void> {
    return del<void>(`/admin/users/${id}`);
  },

  /* Couples */
  async getCouples(page: number): Promise<PaginatedResponse<Couple>> {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    const raw = await get<RawPaginatedResponse>(`/admin/couples?${params.toString()}`);
    return pageOf(raw, 'couples', normalizeCouple);
  },

  async updateCouple(id: string, data: { loveStartDate?: string }): Promise<Couple> {
    const raw = await patch<{ couple: unknown }>(`/admin/couples/${id}`, data);
    return normalizeCouple(raw.couple);
  },

  /* Check-ins */
  async getCheckins(
    page: number,
    includeDeleted = false,
  ): Promise<PaginatedResponse<CheckIn>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      includeDeleted: String(includeDeleted),
    });
    const raw = await get<RawPaginatedResponse>(
      `/admin/checkins?${params.toString()}`,
    );
    return pageOf(raw, 'checkIns', normalizeCheckIn);
  },

  deleteCheckin(id: string): Promise<void> {
    return del<void>(`/admin/checkins/${id}`);
  },

  /* Random Events */
  async getRandomEvents(page: number): Promise<PaginatedResponse<RandomEvent>> {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    const raw = await get<RawPaginatedResponse>(
      `/admin/random-events?${params.toString()}`,
    );
    return pageOf(raw, 'events', normalizeRandomEvent);
  },

  resetAllData(confirmation: string): Promise<ResetResult> {
    return post<ResetResult>('/admin/maintenance/reset', { confirmation });
  },

  getResetStatus(): Promise<ResetStatus> {
    return get<ResetStatus>('/admin/maintenance/reset');
  },
};
