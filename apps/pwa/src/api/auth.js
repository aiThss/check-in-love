import { apiFetch } from './client';
export function startOnboarding(payload) {
    return apiFetch('/auth/onboarding', {
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
    return apiFetch('/auth/me');
}
