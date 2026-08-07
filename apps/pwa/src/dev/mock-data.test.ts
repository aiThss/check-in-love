// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { startOnboarding, getMe } from '../api/auth';
import { store } from '../store';
import {
  createMockNewGoogleUserResponse,
  isMockNewUserMode,
  isMockPreviewMode,
  loadMockNewGoogleUserResponse,
  loadMockPreviewData,
  MOCK_GOOGLE_NEW_USER_TOKEN,
  MOCK_PREVIEW_TOKEN,
} from './mock-data';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  store.clear();
});

describe('local mock data lifecycle', () => {
  it('keeps a new Google user separate and stable from the full preview mode', () => {
    const created = createMockNewGoogleUserResponse();
    localStorage.setItem('lovecheck_token', created.token);

    const loaded = loadMockNewGoogleUserResponse();

    expect(loaded.user.id).toBe(created.user.id);
    expect(loaded.user.email).toBe(created.user.email);
    expect(isMockNewUserMode()).toBe(true);
    expect(isMockPreviewMode()).toBe(false);
    expect(localStorage.getItem('lovecheck_dev_preview_data')).toBeNull();
  });

  it('completes mock Google onboarding locally and switches to preview mode', async () => {
    const created = createMockNewGoogleUserResponse();
    localStorage.setItem('lovecheck_token', MOCK_GOOGLE_NEW_USER_TOKEN);

    const result = await startOnboarding({
      deviceId: created.user.deviceId,
      displayName: 'Người dùng Dev',
      partnerName: 'Người ấy Dev',
      coupleCode: 'DEV2026',
      loveStartDate: '2024-02-14',
    });

    expect(result.token).toBe(MOCK_PREVIEW_TOKEN);
    expect(result.user.id).toBe(created.user.id);
    expect(result.user.displayName).toBe('Người dùng Dev');
    expect(result.couple?.code).toBe('DEV2026');
    localStorage.setItem('lovecheck_token', result.token);
    expect(isMockNewUserMode()).toBe(false);
    expect(isMockPreviewMode()).toBe(true);

    const me = await getMe();
    const preview = loadMockPreviewData();
    expect(me.user.id).toBe(created.user.id);
    expect(me.couple?.id).toBe(result.couple?.id);
    expect(preview.user.displayName).toBe('Người dùng Dev');
    expect(preview.partnerUser.displayName).toBe('Người ấy Dev');
  });
});
