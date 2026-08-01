declare const __API_URL__: string;

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = (window as Window & { __API_URL__?: string }).__API_URL__;
    if (custom) return custom;

    const host = window.location.hostname;
    const protocol = window.location.protocol;

    if (host === 'admin.couple.io.vn') {
      return 'https://api.couple.io.vn/api';
    }
    if (host.startsWith('admin.')) {
      const parentDomain = host.substring(6);
      return `${protocol}//api.${parentDomain}/api`;
    }
  }

  const baked = typeof __API_URL__ !== 'undefined' ? __API_URL__ : '';
  if (baked && !baked.includes('localhost') && !baked.includes('127.0.0.1')) {
    return baked;
  }

  return baked || 'http://localhost:3001/api';
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

function redirectToLogin(): void {
  localStorage.removeItem('admin_token');
  window.location.href = '/login';
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const baseUrl = getApiUrl();
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError(0, 'Network error — unable to reach the server.');
  }

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const message =
      (body as { message?: string; error?: string })?.message ||
      (body as { message?: string; error?: string })?.error ||
      `Request failed with status ${response.status}`;

    throw new ApiError(response.status, message, body);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function del<T = void>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' });
}
