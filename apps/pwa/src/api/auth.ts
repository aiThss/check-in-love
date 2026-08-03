import { apiFetch } from './client';
import { store } from '../store/index';

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

export interface PasswordResetResponse {
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

export function loginWithGoogle(payload: GoogleLoginPayload): Promise<AuthResponse> {
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
