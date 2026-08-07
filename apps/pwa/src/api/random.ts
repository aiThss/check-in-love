import { apiFetch } from './client';
import type { RandomCategory, RandomHistoryItem, RandomItem } from './types';
import { isMockPreviewMode, loadMockPreviewData, saveMockPreviewData } from '../dev/mock-data';

export async function getCategories(): Promise<RandomCategory[]> {
  if (isMockPreviewMode()) return Promise.resolve(loadMockPreviewData().categories);

  const res = await apiFetch<{ categories: RandomCategory[] }>('/random/categories');
  return res.categories || [];
}

export function drawRandom(category?: string): Promise<RandomItem> {
  if (isMockPreviewMode()) {
    const preview = loadMockPreviewData();
    const selected = category || preview.categories[Math.floor(Math.random() * preview.categories.length)].category;
    const prompts: Record<string, [string, string]> = {
      questions: ['Điều gì làm bạn mỉm cười hôm nay?', 'Kể cho nhau nghe một điều nhỏ bé nhưng thật vui.'],
      snap: ['Chụp một tấm ảnh theo màu của hôm nay.', 'Cùng lưu lại khoảnh khắc hiện tại nhé.'],
      today: ['Tối nay dành 15 phút chỉ để nói chuyện với nhau.', 'Một khoảng thời gian nhỏ cũng đủ làm ngày vui hơn.'],
      food: ['Cùng chọn một món ăn chưa thử bao giờ.', 'Biết đâu hai đứa lại có thêm món tủ mới.'],
      universe: ['Nếu được đi đâu ngay lúc này, bạn sẽ chọn nơi nào?', 'Cùng mơ một chuyến đi thật đẹp nhé.'],
    };
    const [prompt, detail] = prompts[selected] ?? prompts.questions;
    const eventId = `mock_random_${Date.now()}`;
    const eventDetails = {
      id: eventId,
      coupleId: preview.couple.id,
      userId: preview.user.id,
      category: selected,
      prompt,
      detail,
      createdAt: new Date().toISOString(),
    };
    const historyItem: RandomHistoryItem = { _id: eventId, ...eventDetails };
    const event: RandomItem = {
      category: selected,
      prompt,
      detail,
      event: eventDetails,
    };
    preview.randomHistory.unshift(historyItem);
    saveMockPreviewData(preview);
    return Promise.resolve(event);
  }

  return apiFetch<RandomItem>('/random/draw', {
    method: 'POST',
    body: category ? JSON.stringify({ category }) : undefined,
  });
}

export async function getHistory(): Promise<RandomHistoryItem[]> {
  if (isMockPreviewMode()) return Promise.resolve(loadMockPreviewData().randomHistory);

  const res = await apiFetch<{ events: RandomHistoryItem[] }>('/random/history');
  return res.events || [];
}
