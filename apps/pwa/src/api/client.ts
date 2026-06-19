// ── API Base Client ───────────────────────────────────────────────────────────

declare const __API_URL__: string;
const API_URL: string =
  (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null) ||
  (window as Window & { __API_URL__?: string }).__API_URL__ ||
  'http://localhost:3001/api';

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
    localStorage.removeItem('lovecheck_token');
    localStorage.removeItem('lovecheck_state');
    window.location.href = '/onboarding';
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
      window.location.href = '/blocked';
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
