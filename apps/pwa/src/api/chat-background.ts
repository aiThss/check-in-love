import { apiFetch } from './client';
import type { RawMessage } from './messages';
import type { ChatBackgroundSnapshot } from './types';
import { isMockPreviewMode } from '../dev/mock-data';
import type { ChatBackgroundSelection } from '../utils/message-background';

export interface SharedChatBackgroundResponse {
  background: ChatBackgroundSnapshot | null;
  message?: RawMessage;
}

export async function getSharedChatBackground(): Promise<SharedChatBackgroundResponse> {
  if (isMockPreviewMode()) return { background: null };
  return apiFetch<SharedChatBackgroundResponse>('/chat-background', {
    preserveSessionOnUnauthorized: true,
  });
}

export async function updateSharedChatBackground(
  selection: ChatBackgroundSelection,
): Promise<SharedChatBackgroundResponse> {
  if (isMockPreviewMode()) {
    return { background: null };
  }

  if (selection.kind === 'preset') {
    return apiFetch<SharedChatBackgroundResponse>('/chat-background', {
      method: 'PATCH',
      body: JSON.stringify({ kind: 'preset', id: selection.id }),
      preserveSessionOnUnauthorized: true,
    });
  }

  const response = await fetch(selection.dataUrl);
  if (!response.ok) throw new Error('Không đọc được ảnh nền');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Ảnh nền không hợp lệ');

  const formData = new FormData();
  formData.append('kind', 'custom');
  formData.append('file', blob, 'chat-background.jpg');
  return apiFetch<SharedChatBackgroundResponse>('/chat-background', {
    method: 'PATCH',
    body: formData,
    preserveSessionOnUnauthorized: true,
  });
}
