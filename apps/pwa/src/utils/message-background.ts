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
 * Small, local-only wallpaper collection for the private two-person chat.
 * The SVGs are shipped with the PWA so the picker also works offline and in
 * the Android WebView without depending on a third-party image host.
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
    name: 'Vườn hồng',
    imageUrl: '/chat-backgrounds/rose-garden.svg',
    preview: 'linear-gradient(135deg, #ffd8e6, #fff1f4)',
  },
  {
    id: 'sunset-horizon',
    name: 'Hoàng hôn',
    imageUrl: '/chat-backgrounds/sunset-horizon.svg',
    preview: 'linear-gradient(145deg, #ffad9c, #e6a4d8 58%, #6971b9)',
  },
  {
    id: 'lavender-stars',
    name: 'Sao tím',
    imageUrl: '/chat-backgrounds/lavender-stars.svg',
    preview: 'linear-gradient(145deg, #d8ccff, #b8cdfc 55%, #7e8bd0)',
  },
  {
    id: 'mint-bloom',
    name: 'Vườn bạc hà',
    imageUrl: '/chat-backgrounds/mint-bloom.svg',
    preview: 'linear-gradient(145deg, #c9f2e4, #fff0d7 56%, #f5a9af)',
  },
  {
    id: 'midnight-heart',
    name: 'Tim đêm',
    imageUrl: '/chat-backgrounds/midnight-heart.svg',
    preview: 'linear-gradient(145deg, #17234c, #34235f 56%, #7f426d)',
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
