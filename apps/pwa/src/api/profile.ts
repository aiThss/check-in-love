import { apiFetch } from './client';
import type { User } from './types';

export interface UpdateProfilePayload {
  displayName?: string;
  partnerName?: string;
  loveStartDate?: string;
  birthday?: string | null;
  partnerBirthday?: string | null;
}

export function updateProfile(data: UpdateProfilePayload): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function uploadAvatar(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('avatar', file);
  return apiFetch<any>('/me/avatar', {
    method: 'POST',
    body: formData,
  });
}

export function uploadPartnerAvatar(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('avatar', file);
  return apiFetch<any>('/me/partner-avatar', {
    method: 'POST',
    body: formData,
  });
}
