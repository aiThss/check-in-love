import { apiFetch } from './client';

export interface StartOnboardingPayload {
  deviceId: string;
  displayName: string;
  partnerName: string;
  coupleCode: string;
  loveStartDate?: string;
  email?: string;
  password?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: import('./types').User;
  couple: import('./types').Couple;
}

export interface MeResponse {
  user: import('./types').User;
  couple: import('./types').Couple;
}

export function startOnboarding(payload: StartOnboardingPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/onboarding', {
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

export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me');
}
