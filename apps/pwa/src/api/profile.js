import { apiFetch } from './client';
export function updateProfile(data) {
    return apiFetch('/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}
export function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiFetch('/me/avatar', {
        method: 'POST',
        body: formData,
    });
}
export function uploadPartnerAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiFetch('/me/partner-avatar', {
        method: 'POST',
        body: formData,
    });
}
