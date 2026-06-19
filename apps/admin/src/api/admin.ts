import { get, post, patch, del } from './client';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

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
  totalCheckins: number;
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
  userId: string;
  userName: string;
  coupleId?: string;
  coupleName?: string;
  createdAt: string;
}

/* ─── Admin API ──────────────────────────────────────────────────────────────── */

export const adminApi = {
  /* Auth */
  login(email: string, password: string): Promise<{ token: string }> {
    return post<{ token: string }>('/admin/login', { email, password });
  },

  /* Dashboard summary */
  getSummary(): Promise<AdminSummary> {
    return get<AdminSummary>('/admin/summary');
  },

  /* Users */
  getUsers(page: number, search?: string): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search && search.trim()) {
      params.set('search', search.trim());
    }
    return get<PaginatedResponse<User>>(`/admin/users?${params.toString()}`);
  },

  updateUser(id: string, data: { status?: string }): Promise<User> {
    return patch<User>(`/admin/users/${id}`, data);
  },

  /* Couples */
  getCouples(page: number): Promise<PaginatedResponse<Couple>> {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    return get<PaginatedResponse<Couple>>(`/admin/couples?${params.toString()}`);
  },

  updateCouple(id: string, data: { loveStartDate?: string }): Promise<Couple> {
    return patch<Couple>(`/admin/couples/${id}`, data);
  },

  /* Check-ins */
  getCheckins(
    page: number,
    includeDeleted = false,
  ): Promise<PaginatedResponse<CheckIn>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      includeDeleted: String(includeDeleted),
    });
    return get<PaginatedResponse<CheckIn>>(
      `/admin/checkins?${params.toString()}`,
    );
  },

  deleteCheckin(id: string): Promise<void> {
    return del<void>(`/admin/checkins/${id}`);
  },

  /* Random Events */
  getRandomEvents(page: number): Promise<PaginatedResponse<RandomEvent>> {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    return get<PaginatedResponse<RandomEvent>>(
      `/admin/random-events?${params.toString()}`,
    );
  },
};
