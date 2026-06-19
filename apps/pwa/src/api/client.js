// ── API Base Client ───────────────────────────────────────────────────────────
const API_URL = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null) ||
    window.__API_URL__ ||
    'http://localhost:3001/api';
// ── Error class ───────────────────────────────────────────────────────────────
export class ApiError extends Error {
    constructor(message, code, status) {
        super(message);
        Object.defineProperty(this, "message", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: message
        });
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: code
        });
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: status
        });
        this.name = 'ApiError';
    }
}
// ── Core fetch wrapper ────────────────────────────────────────────────────────
export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('lovecheck_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    // Don't set Content-Type for FormData — browser sets it with boundary
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const url = path.startsWith('http') ? path : `${API_URL}${path}`;
    let response;
    try {
        response = await fetch(url, {
            ...options,
            headers,
        });
    }
    catch (err) {
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
        let errorData = {};
        try {
            errorData = await response.clone().json();
        }
        catch {
            // ignore parse errors
        }
        if (errorData.code === 'USER_BLOCKED') {
            window.location.href = '/blocked';
            throw new ApiError('Tài khoản bị khóa', 'USER_BLOCKED', 403);
        }
    }
    if (!response.ok) {
        let errorData = {};
        try {
            errorData = await response.clone().json();
        }
        catch {
            // ignore parse errors
        }
        throw new ApiError(errorData.message || `Lỗi ${response.status}`, errorData.code || 'API_ERROR', response.status);
    }
    // 204 No Content
    if (response.status === 204) {
        return undefined;
    }
    return response.json();
}
