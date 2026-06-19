import { apiFetch } from './client';
import type { RandomCategory, RandomHistoryItem, RandomItem } from './types';

export async function getCategories(): Promise<RandomCategory[]> {
  const res = await apiFetch<{ categories: RandomCategory[] }>('/random/categories');
  return res.categories || [];
}

export function drawRandom(category?: string): Promise<RandomItem> {
  return apiFetch<RandomItem>('/random/draw', {
    method: 'POST',
    body: category ? JSON.stringify({ category }) : undefined,
  });
}

export async function getHistory(): Promise<RandomHistoryItem[]> {
  const res = await apiFetch<{ events: RandomHistoryItem[] }>('/random/history');
  return res.events || [];
}
