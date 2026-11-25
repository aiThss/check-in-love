import { iconMarkup, type IconName } from './icons/icons';
import type { ReactionType } from '../api/types';

export interface BespokeReactionDef {
  type: ReactionType;
  icon: IconName;
  label: string;
}

export const BESPOKE_REACTIONS: readonly BespokeReactionDef[] = [
  { type: '❤️', icon: 'heart', label: 'Yêu' },
  { type: '🥰', icon: 'react-love', label: 'Thương' },
  { type: '😘', icon: 'react-hug', label: 'Hôn' },
  { type: '😂', icon: 'react-haha', label: 'Cười' },
  { type: '🥺', icon: 'react-ouch', label: 'Nhớ' },
  { type: '🤗', icon: 'react-hug', label: 'Ôm' },
  { type: '🔥', icon: 'react-fire', label: 'Cháy' },
  { type: '✨', icon: 'sparkle', label: 'Lấp lánh' },
];

const REACTION_LOOKUP: Record<string, IconName> = {
  '❤️': 'heart',
  '💛': 'heart',
  '💕': 'react-love',
  '🥰': 'react-love',
  '😘': 'react-hug',
  '🤗': 'react-hug',
  '😂': 'react-haha',
  '😆': 'react-haha',
  '🥺': 'react-ouch',
  '😭': 'react-ouch',
  '😢': 'react-ouch',
  '🔥': 'react-fire',
  '✨': 'sparkle',
  '👏': 'star',
  '😮': 'react-wow',
};

export const MOOD_ICON_LOOKUP: Record<string, { icon: IconName; label: string }> = {
  happy: { icon: 'sparkle', label: 'Vui vẻ' },
  love: { icon: 'react-love', label: 'Đang yêu' },
  sad: { icon: 'react-ouch', label: 'Buồn' },
  excited: { icon: 'star', label: 'Hào hứng' },
  tired: { icon: 'moon', label: 'Mệt mỏi' },
  calm: { icon: 'sun', label: 'Bình yên' },
  miss: { icon: 'heart', label: 'Nhớ nhung' },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderReactionSymbolHtml(type: string, active = false): string {
  const mapped = REACTION_LOOKUP[type];
  if (mapped) {
    return iconMarkup(mapped, {
      size: 16,
      variant: active ? 'filled' : 'outline',
      className: 'c-reaction-svg',
    });
  }
  return `<span class="c-reaction-custom-txt">${escapeHtml(type)}</span>`;
}
