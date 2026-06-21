import { apiFetch } from './client';

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

export interface AuthResponse {
  token: string;
  user: import('./types').User;
  couple: import('./types').Couple;
}

export interface MeResponse {
  user: import('./types').User;
  couple: import('./types').Couple;
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

export function startOnboarding(payload: StartOnboardingPayload): Promise<AuthResponse> {
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

export function sendLoginOtp(
  email: string,
  password: string,
): Promise<SendOtpResponse> {
  return apiFetch<SendOtpResponse>('/auth/login/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/me');
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
