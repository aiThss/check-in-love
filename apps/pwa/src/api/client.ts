// ── API Base Client ───────────────────────────────────────────────────────────

import { navigate } from '../router';
import { clearPrivateClientState } from '../session';

declare const __API_URL__: string;

function isLoopbackApiUrl(value: string): boolean {
  try {
    const host = (value.includes('://') ? new URL(value).hostname : value).toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function getLanDevelopmentApiUrl(): string | null {
  if (typeof window === 'undefined' || window.location.protocol !== 'http:' || window.location.port !== '5173') {
    return null;
  }

  const host = window.location.hostname;
  if (isLoopbackApiUrl(host)) {
    return null;
  }

  return `http://${host}:3001/api`;
}

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = (window as Window & { __API_URL__?: string }).__API_URL__;
    if (custom && !isLoopbackApiUrl(custom)) return custom;

    const host = window.location.hostname;
    const protocol = window.location.protocol;

    if (host === 'couple.io.vn') {
      return 'https://api.couple.io.vn/api';
    }
    if (host.startsWith('app.') || host.startsWith('pwa.')) {
      const parentDomain = host.replace(/^(app|pwa)\./, '');
      return `${protocol}//api.${parentDomain}/api`;
    }

    const lanApiUrl = getLanDevelopmentApiUrl();
    if (lanApiUrl) return lanApiUrl;

    if (custom) return custom;
  }

  const baked = typeof __API_URL__ !== 'undefined' ? __API_URL__ : '';
  if (baked && !baked.includes('localhost') && !baked.includes('127.0.0.1')) {
    return baked;
  }

  return baked || 'http://localhost:3001/api';
}

const API_URL: string = getApiUrl();

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public override message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiFetchOptions = RequestInit & {
  /** Background UI should not sign the user out when its optional request races a session update. */
  preserveSessionOnUnauthorized?: boolean;
};

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = localStorage.getItem('lovecheck_token');
  const { preserveSessionOnUnauthorized = false, ...requestOptions } = options;

  const headers: Record<string, string> = {
    ...(requestOptions.headers as Record<string, string>),
  };

  // Only set Content-Type for non-empty bodies that are not FormData
  if (requestOptions.body !== undefined && requestOptions.body !== null) {
    if (!(requestOptions.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (requestOptions.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...requestOptions,
      headers,
    });
  } catch (err) {
    throw new ApiError('Không có kết nối mạng', 'NETWORK_ERROR', 0);
  }

  // Handle 401 → not authenticated
  if (response.status === 401 && !preserveSessionOnUnauthorized) {
    clearPrivateClientState();
    navigate('/onboarding', true);
    throw new ApiError('Phiên đăng nhập hết hạn', 'UNAUTHORIZED', 401);
  }

  if (response.status === 401) {
    throw new ApiError('Phiên đăng nhập chưa sẵn sàng', 'UNAUTHORIZED', 401);
  }

  // Handle 403 with USER_BLOCKED code
  if (response.status === 403) {
    let errorData: { code?: string; message?: string } = {};
    try {
      errorData = await response.clone().json();
    } catch {
      // ignore parse errors
    }
    if (errorData.code === 'USER_BLOCKED') {
      navigate('/blocked', true);
      throw new ApiError('Tài khoản bị khóa', 'USER_BLOCKED', 403);
    }
  }

  if (!response.ok) {
    let errorData: { message?: string; error?: string; code?: string } = {};
    try {
      errorData = await response.clone().json();
    } catch {
      // ignore parse errors
    }
    throw new ApiError(
      errorData.message || errorData.error || `Lỗi ${response.status}`,
      errorData.code || 'API_ERROR',
      response.status,
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
