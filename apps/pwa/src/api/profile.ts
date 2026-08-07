import { apiFetch } from './client';
import type { User } from './types';
import { isMockPreviewMode, loadMockPreviewData, saveMockPreviewData } from '../dev/mock-data';
import { store } from '../store/index';

export interface UpdateProfilePayload {
  displayName?: string;
  partnerName?: string;
  loveStartDate?: string;
  birthday?: string | null;
  partnerBirthday?: string | null;
}

export function updateProfile(data: UpdateProfilePayload): Promise<{ user: User }> {
  if (isMockPreviewMode()) {
    const preview = loadMockPreviewData();
    const updates: Partial<User> = {
      displayName: data.displayName,
      partnerName: data.partnerName,
      birthday: data.birthday ?? undefined,
      partnerBirthday: data.partnerBirthday ?? undefined,
    };
    preview.user = { ...preview.user, ...updates, updatedAt: new Date().toISOString() };
    if (data.loveStartDate) {
      preview.couple = { ...preview.couple, loveStartDate: data.loveStartDate };
    }
    saveMockPreviewData(preview);
    store.set({ user: preview.user, couple: preview.couple });
    return Promise.resolve({ user: preview.user });
  }

  return apiFetch<{ user: User }>('/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function uploadAvatar(file: File): Promise<any> {
  if (isMockPreviewMode()) return Promise.resolve({ user: loadMockPreviewData().user, fileName: file.name });

  const formData = new FormData();
  formData.append('avatar', file);
  return apiFetch<any>('/me/avatar', {
    method: 'POST',
    body: formData,
  });
}

export function uploadPartnerAvatar(file: File): Promise<any> {
  if (isMockPreviewMode()) return Promise.resolve({ user: loadMockPreviewData().user, fileName: file.name });

  const formData = new FormData();
  formData.append('avatar', file);
  return apiFetch<any>('/me/partner-avatar', {
    method: 'POST',
    body: formData,
  });
}
