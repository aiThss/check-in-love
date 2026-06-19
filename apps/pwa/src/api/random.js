import { apiFetch } from './client';
export async function getCategories() {
    const res = await apiFetch('/random/categories');
    return res.categories || [];
}
export function drawRandom(category) {
    return apiFetch('/random/draw', {
        method: 'POST',
        body: category ? JSON.stringify({ category }) : undefined,
    });
}
export async function getHistory() {
    const res = await apiFetch('/random/history');
    return res.events || [];
}
