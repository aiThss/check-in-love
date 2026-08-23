export interface ChatBackgroundPreset {
  id: string;
  name: string;
  imageUrl: string | null;
  preview: string;
}

export type ChatBackgroundSelection =
  | { kind: 'preset'; id: string }
  | { kind: 'custom'; dataUrl: string };

export const DEFAULT_CHAT_BACKGROUND_ID = 'default';
export const CHAT_BACKGROUND_STORAGE_KEY = 'lovecheck_chat_background_v1';

/**
 * Local wallpaper collection for the private two-person chat. The photos are
 * bundled with the PWA so the picker works offline and in the Android WebView
 * without depending on a third-party image host at runtime.
 *
 * The preset ids stay stable so a wallpaper selected in an older release is
 * automatically upgraded to the newer photo in this collection.
 */
export const CHAT_BACKGROUND_PRESETS: readonly ChatBackgroundPreset[] = [
  {
    id: DEFAULT_CHAT_BACKGROUND_ID,
    name: 'Mặc định',
    imageUrl: null,
    preview: 'linear-gradient(135deg, #f8e2e7 0%, #fff5f7 48%, #f5d5e5 100%)',
  },
  {
    id: 'rose-garden',
    name: 'Hoa hồng',
    imageUrl: '/chat-backgrounds/rose-bloom.jpg',
    preview: 'linear-gradient(135deg, #d88d9f, #f9dce2)',
  },
  {
    id: 'sunset-horizon',
    name: 'Hoàng hôn biển',
    imageUrl: '/chat-backgrounds/sunset-ocean.jpg',
    preview: 'linear-gradient(145deg, #f5b0a4, #e78e7e 58%, #6b3a5e)',
  },
  {
    id: 'lavender-stars',
    name: 'Đồi lavender',
    imageUrl: '/chat-backgrounds/lavender-field.jpg',
    preview: 'linear-gradient(145deg, #bbd9f5, #8969a7 55%, #4c3a76)',
  },
  {
    id: 'mint-bloom',
    name: 'Lá nhiệt đới',
    imageUrl: '/chat-backgrounds/botanical-green.jpg',
    preview: 'linear-gradient(145deg, #b9d792, #2f704a 56%, #102d27)',
  },
  {
    id: 'midnight-heart',
    name: 'Bãi biển hồng',
    imageUrl: '/chat-backgrounds/palm-sunset.jpg',
    preview: 'linear-gradient(145deg, #a9b2c7, #f0b2ba 56%, #5c3a4b)',
  },
] as const;

function isPresetSelection(value: unknown): value is { kind: 'preset'; id: string } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.kind === 'preset'
    && typeof candidate.id === 'string'
    && CHAT_BACKGROUND_PRESETS.some((preset) => preset.id === candidate.id);
}

function isCustomSelection(value: unknown): value is { kind: 'custom'; dataUrl: string } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.kind === 'custom'
    && typeof candidate.dataUrl === 'string'
    && candidate.dataUrl.startsWith('data:image/');
}

export function readChatBackground(): ChatBackgroundSelection {
  try {
    const raw = localStorage.getItem(CHAT_BACKGROUND_STORAGE_KEY);
    if (!raw) return { kind: 'preset', id: DEFAULT_CHAT_BACKGROUND_ID };

    const parsed: unknown = JSON.parse(raw);
    if (isPresetSelection(parsed) || isCustomSelection(parsed)) return parsed;
  } catch {
    // Storage may be unavailable or contain a partially written old value.
  }

  return { kind: 'preset', id: DEFAULT_CHAT_BACKGROUND_ID };
}

export function saveChatBackground(selection: ChatBackgroundSelection): boolean {
  try {
    localStorage.setItem(CHAT_BACKGROUND_STORAGE_KEY, JSON.stringify(selection));
    return true;
  } catch {
    return false;
  }
}

export function getChatBackgroundImage(selection: ChatBackgroundSelection): string | null {
  if (selection.kind === 'custom') return selection.dataUrl;
  return CHAT_BACKGROUND_PRESETS.find((preset) => preset.id === selection.id)?.imageUrl ?? null;
}
