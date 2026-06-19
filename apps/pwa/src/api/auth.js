import { apiFetch } from './client';
export function startOnboarding(payload) {
    return apiFetch('/auth/start', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
export function login(payload) {
    return apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
export function getMe() {
    return apiFetch('/me');
}
export function sendOtp(email) {
    return apiFetch('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
}
export function verifyOtp(email, code) {
    return apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
    });
}
