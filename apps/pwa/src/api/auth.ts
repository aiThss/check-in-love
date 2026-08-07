import { apiFetch } from './client';
import { store } from '../store/index';
import {
  isMockPreviewMode,
  loadMockPreviewData,
  saveMockPreviewData,
  isMockNewUserMode,
  createMockNewGoogleUserResponse,
  loadMockNewGoogleUserResponse,
  clearMockNewUserData,
  seedMockPreviewData,
  MOCK_PREVIEW_TOKEN,
} from '../dev/mock-data';

export interface StartOnboardingPayload {
  deviceId: string;
  displayName: string;
  partnerName: string;
  coupleCode: string;
  loveStartDate?: string;
  email?: string;
  password?: string;
  otpCode?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  otpCode: string;
}

export interface GoogleLoginPayload {
  credential: string;
}

export interface AuthResponse {
  token: string;
  user: import('./types').User;
  couple: import('./types').Couple | null;
  isNewUser?: boolean;
}

export interface MeResponse {
  user: import('./types').User;
  couple: import('./types').Couple | null;
  partnerUser?: import('./types').User;
}

export interface SendOtpResponse {
  message: string;
  expiresIn: number;
}

export interface VerifyOtpResponse {
  verified: boolean;
  message: string;
}

export interface PasswordResetResponse {
  message: string;
}

export function startOnboarding(payload: StartOnboardingPayload): Promise<AuthResponse> {
  if (isMockNewUserMode() || isMockPreviewMode()) {
    const currentUser = isMockNewUserMode()
      ? loadMockNewGoogleUserResponse().user
      : undefined;
    const preview = seedMockPreviewData({
      displayName: payload.displayName,
      partnerName: payload.partnerName,
      coupleCode: payload.coupleCode,
      loveStartDate: payload.loveStartDate,
      email: payload.email,
    });
    const now = new Date().toISOString();
    const user = {
      ...(currentUser ?? preview.user),
      displayName: payload.displayName.trim(),
      partnerName: payload.partnerName.trim(),
      email: payload.email?.trim() || currentUser?.email || preview.user.email,
      coupleId: preview.couple.id,
      updatedAt: now,
    };
    preview.user = user;
    preview.partnerUser = {
      ...preview.partnerUser,
      displayName: payload.partnerName.trim(),
      partnerName: payload.displayName.trim(),
      coupleId: preview.couple.id,
      updatedAt: now,
    };
    saveMockPreviewData(preview);
    clearMockNewUserData();
    return Promise.resolve({
      token: MOCK_PREVIEW_TOKEN,
      user,
      couple: preview.couple,
      isNewUser: false,
    });
  }

  return apiFetch<AuthResponse>('/auth/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginWithGoogle(payload: GoogleLoginPayload): Promise<AuthResponse> {
  if (payload.credential.startsWith('mock-google-')) {
    if (payload.credential === 'mock-google-new-user') {
      return Promise.resolve(createMockNewGoogleUserResponse());
    }

    const preview = seedMockPreviewData();
    return Promise.resolve({
      token: MOCK_PREVIEW_TOKEN,
      user: preview.user,
      couple: preview.couple,
      isNewUser: false,
    });
  }

  return apiFetch<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendLoginOtp(
  email: string,
  password: string,
): Promise<SendOtpResponse> {
  return apiFetch<SendOtpResponse>('/auth/login/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function requestPasswordReset(email: string): Promise<SendOtpResponse> {
  return apiFetch<SendOtpResponse>('/auth/password-reset/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(
  email: string,
  otpCode: string,
  newPassword: string,
): Promise<PasswordResetResponse> {
  return apiFetch<PasswordResetResponse>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, otpCode, newPassword }),
  });
}

export async function getMe(): Promise<MeResponse> {
  if (isMockNewUserMode()) {
    const mockRes = loadMockNewGoogleUserResponse();
    store.set({ user: mockRes.user, couple: null });
    return {
      user: mockRes.user,
      couple: null,
    };
  }

  if (isMockPreviewMode()) {
    const preview = loadMockPreviewData();
    store.set({ user: preview.user, couple: preview.couple });
    return {
      user: preview.user,
      couple: preview.couple,
      partnerUser: preview.partnerUser,
    };
  }

  const response = await apiFetch<MeResponse>('/me');
  store.set({ user: response.user, couple: response.couple });
  return response;
}

export function sendOtp(email: string): Promise<SendOtpResponse> {
  return apiFetch<SendOtpResponse>('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function verifyOtp(email: string, code: string): Promise<VerifyOtpResponse> {
  return apiFetch<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}
