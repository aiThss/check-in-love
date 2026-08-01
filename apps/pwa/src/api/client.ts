// ── API Base Client ───────────────────────────────────────────────────────────

import { navigate } from '../router';
import { clearPrivateClientState } from '../session';

declare const __API_URL__: string;
function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = (window as Window & { __API_URL__?: string }).__API_URL__;
    if (custom) return custom;

    const host = window.location.hostname;
    const protocol = window.location.protocol;

    if (host === 'couple.io.vn') {
      return 'https://api.couple.io.vn/api';
    }
    if (host === 'preview.couple.io.vn') {
      return 'https://api-preview.couple.io.vn/api';
    }
    if (host.startsWith('preview.')) {
      const parentDomain = host.replace(/^preview\./, '');
      return `${protocol}//api-preview.${parentDomain}/api`;
    }
    if (host.startsWith('app.') || host.startsWith('pwa.')) {
      const parentDomain = host.replace(/^(app|pwa)\./, '');
      return `${protocol}//api.${parentDomain}/api`;
    }
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

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('lovecheck_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError('Không có kết nối mạng', 'NETWORK_ERROR', 0);
  }

  // Handle 401 → not authenticated
  if (response.status === 401) {
    clearPrivateClientState();
    navigate('/onboarding', true);
    throw new ApiError('Phiên đăng nhập hết hạn', 'UNAUTHORIZED', 401);
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
